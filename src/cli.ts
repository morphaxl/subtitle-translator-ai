#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { config } from 'dotenv';
import { parse, serialize, batchSubtitles, detectFormat, type Subtitle, type SubtitleFormat } from './subtitles.js';
import { listSubtitleStreams, extractSubtitle, extractAllSubtitles } from './extract.js';
import { loadBatchConfig, needsExtraction } from './batch.js';
import { 
  createProvider, 
  listProviders, 
  getProviderHelp, 
  PROVIDERS,
  type ProviderName,
  type TranslationStats,
  transcribeWithWhisper,
  isWhisperInstalled,
  getWhisperModels,
} from './providers/index.js';

config();

const LANGUAGES: Record<string, string> = {
  en: 'English', hi: 'Hindi', ja: 'Japanese', zh: 'Chinese',
  ko: 'Korean', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', ru: 'Russian', ar: 'Arabic',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
  tr: 'Turkish', pl: 'Polish', nl: 'Dutch', sv: 'Swedish',
};

function resolveLanguage(input: string): string {
  const lower = input.toLowerCase();
  return LANGUAGES[lower] || input;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function printBanner(): void {
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ${chalk.bold('Subtitle Translator')}                                       ║
║   ${chalk.dim('Multi-provider AI translation for subtitles')}               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));
}

function printStats(stats: TranslationStats, duration: number, subtitleCount: number, providerName: string): void {
  console.log(chalk.cyan('\n┌─────────────────────────────────────────┐'));
  console.log(chalk.cyan('│') + chalk.bold('          Translation Summary            ') + chalk.cyan('│'));
  console.log(chalk.cyan('├─────────────────────────────────────────┤'));
  console.log(chalk.cyan('│') + ` Provider:             ${chalk.magenta(providerName.padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ` Subtitles translated: ${chalk.green(subtitleCount.toString().padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ` API calls made:       ${chalk.yellow(stats.apiCalls.toString().padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ` Retries:              ${chalk.yellow(stats.retries.toString().padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ` Total tokens:         ${chalk.blue(stats.totalTokens.toString().padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ` Duration:             ${chalk.magenta(formatDuration(duration).padStart(16))} ` + chalk.cyan('│'));
  console.log(chalk.cyan('└─────────────────────────────────────────┘'));
}

const program = new Command();

program
  .name('stt')
  .description('Subtitle Translator - Multi-provider AI translation for subtitles')
  .version('2.0.0');

// Providers command
program
  .command('providers')
  .description('List available translation providers and their status')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    console.log(chalk.cyan('\n📦 Available Providers:\n'));

    const providers = listProviders();
    
    for (const provider of providers) {
      const status = provider.configured 
        ? chalk.green('✓ Configured')
        : chalk.yellow('○ Not configured');
      
      console.log(`  ${chalk.bold(provider.displayName.padEnd(15))} ${status}`);
      console.log(chalk.dim(`    ${provider.description}`));
      
      if (options.verbose) {
        if (provider.envVar) {
          console.log(chalk.dim(`    Env: ${provider.envVar}`));
        }
        console.log(chalk.dim(`    Models: ${provider.models.join(', ')}`));
      }
      console.log();
    }

    console.log(chalk.dim('  Use --provider <name> to select a provider'));
    console.log(chalk.dim('  Use "stt providers --verbose" for more details\n'));
  });

// Extract command
program
  .command('extract <input>')
  .description('Extract subtitles from MKV/MP4/video files')
  .option('-o, --output <path>', 'Output file path')
  .option('-s, --stream <n>', 'Subtitle stream index (use "list" to see available)', '0')
  .option('-a, --all', 'Extract all subtitle streams')
  .option('-l, --list', 'List available subtitle streams')
  .action(async (input: string, options) => {
    if (!existsSync(input)) {
      console.error(chalk.red(`\n✖ Error: File not found: ${input}`));
      process.exit(1);
    }

    const spinner = ora({ color: 'cyan' });

    try {
      if (options.list || options.stream === 'list') {
        spinner.start('Scanning subtitle streams...');
        const streams = await listSubtitleStreams(input);
        spinner.stop();

        if (streams.length === 0) {
          console.log(chalk.yellow('\n⚠ No subtitle streams found in this file.\n'));
          process.exit(0);
        }

        console.log(chalk.cyan(`\n📼 Subtitle streams in ${chalk.bold(input)}:\n`));
        console.log(chalk.dim('─'.repeat(70)));
        
        for (const stream of streams) {
          const langName = LANGUAGES[stream.language] || stream.language;
          const titlePart = stream.title ? chalk.dim(` - ${stream.title}`) : '';
          console.log(
            `  ${chalk.yellow(stream.index.toString())}  │  ` +
            `${chalk.green(stream.codec.padEnd(10))}  │  ` +
            `${chalk.blue(langName.padEnd(12))}` +
            titlePart
          );
        }
        
        console.log(chalk.dim('─'.repeat(70)));
        console.log(chalk.dim(`\nUse: stt extract "${input}" --stream <n>\n`));
        return;
      }

      if (options.all) {
        spinner.start('Extracting all subtitle streams...');
        const results = await extractAllSubtitles(input);
        spinner.succeed(`Extracted ${chalk.green(results.length)} subtitle stream(s)`);

        for (const result of results) {
          const langName = LANGUAGES[result.stream.language] || result.stream.language;
          console.log(chalk.dim(`  → ${result.outputPath} (${langName})`));
        }
        console.log();
        return;
      }

      const streamIndex = parseInt(options.stream, 10);
      spinner.start(`Extracting subtitle stream ${streamIndex}...`);
      
      const outputPath = await extractSubtitle(input, streamIndex, options.output);
      spinner.succeed(`Extracted subtitles to ${chalk.green(outputPath)}\n`);

    } catch (error) {
      spinner.fail('Extraction failed');
      console.error(chalk.red(`\n✖ Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

// Transcribe command (Whisper)
program
  .command('transcribe <input>')
  .description('Transcribe audio/video to subtitles using Whisper (FREE, local)')
  .option('-o, --output <path>', 'Output directory')
  .option('-m, --model <model>', 'Whisper model: tiny, base, small, medium, large, turbo', 'base')
  .option('-l, --language <lang>', 'Source language (auto-detected if not specified)')
  .option('--translate', 'Translate to English (only works TO English)')
  .option('-f, --format <fmt>', 'Output format: srt, vtt, txt, json', 'srt')
  .option('-v, --verbose', 'Show Whisper output')
  .option('--list-models', 'List available Whisper models')
  .action(async (input: string, options) => {
    if (options.listModels) {
      console.log(chalk.cyan('\n🎤 Available Whisper Models:\n'));
      const models = getWhisperModels();
      console.log(chalk.dim('─'.repeat(75)));
      console.log(`  ${'Model'.padEnd(8)} │ ${'Params'.padEnd(8)} │ ${'VRAM'.padEnd(8)} │ ${'Speed'.padEnd(8)} │ Notes`);
      console.log(chalk.dim('─'.repeat(75)));
      for (const m of models) {
        console.log(`  ${chalk.green(m.name.padEnd(8))} │ ${m.params.padEnd(8)} │ ${m.vram.padEnd(8)} │ ${m.speed.padEnd(8)} │ ${chalk.dim(m.note)}`);
      }
      console.log(chalk.dim('─'.repeat(75)));
      console.log(chalk.dim('\n  Note: "turbo" model does NOT support translation.\n'));
      return;
    }

    if (!existsSync(input)) {
      console.error(chalk.red(`\n✖ Error: File not found: ${input}`));
      process.exit(1);
    }

    const spinner = ora({ color: 'cyan' });

    try {
      spinner.start('Checking Whisper installation...');
      const installed = await isWhisperInstalled();
      
      if (!installed) {
        spinner.fail('Whisper not installed');
        console.error(chalk.red('\n✖ Whisper CLI is not installed.\n'));
        console.log(chalk.yellow('Install with:'));
        console.log(chalk.dim('  pip install -U openai-whisper'));
        console.log(chalk.dim('  brew install ffmpeg  # macOS'));
        console.log(chalk.dim('  apt install ffmpeg   # Linux\n'));
        process.exit(1);
      }

      spinner.text = `Transcribing with Whisper (model: ${options.model})...`;
      
      const result = await transcribeWithWhisper(input, {
        model: options.model,
        task: options.translate ? 'translate' : 'transcribe',
        language: options.language,
        outputFormat: options.format,
        outputDir: options.output || '.',
        verbose: options.verbose,
      });

      spinner.succeed(`Transcription complete!`);
      console.log(chalk.green(`\n✔ Output: ${chalk.bold(result.outputFile)}`));
      
      if (result.subtitles) {
        console.log(chalk.dim(`  ${result.subtitles.length} subtitles generated`));
      }
      if (result.duration) {
        console.log(chalk.dim(`  Duration: ${formatDuration(result.duration)}`));
      }
      console.log();

    } catch (error) {
      spinner.fail('Transcription failed');
      console.error(chalk.red(`\n✖ Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

// Translate command (default)
program
  .command('translate <input>', { isDefault: true })
  .description('Translate subtitle file (SRT, VTT, or ASS)')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --from <lang>', 'Source language', 'English')
  .option('-t, --to <lang>', 'Target language', 'Hindi')
  .option('--format <format>', 'Output format (srt, vtt, ass)')
  .option('-p, --provider <name>', 'AI provider: openai, anthropic, gemini, kimi')
  .option('-k, --api-key <key>', 'API key (or set via environment variable)')
  .option('-m, --model <model>', 'Model to use (provider-specific)')
  .option('-b, --batch-size <n>', 'Subtitles per batch', '100')
  .option('--base-url <url>', 'Custom API base URL')
  .option('--max-retries <n>', 'Max retries per request', '3')
  .option('--delay <ms>', 'Delay between batches in ms', '300')
  .option('-q, --quiet', 'Minimal output')
  .option('--no-banner', 'Skip banner')
  .action(async (input: string, options) => {
    const startTime = Date.now();
    
    if (options.banner !== false && !options.quiet) {
      printBanner();
    }

    if (!existsSync(input)) {
      console.error(chalk.red(`\n✖ Error: File not found: ${input}`));
      process.exit(1);
    }

    const sourceLang = resolveLanguage(options.from);
    const targetLang = resolveLanguage(options.to);
    const batchSize = Math.min(500, Math.max(10, parseInt(options.batchSize, 10)));

    const spinner = ora({ text: 'Initializing provider...', color: 'cyan' }).start();

    try {
      // Create provider with auto-detection
      const provider = createProvider({
        provider: options.provider as ProviderName | undefined,
        apiKey: options.apiKey,
        model: options.model,
        baseUrl: options.baseUrl,
        sourceLang,
        targetLang,
        maxRetries: parseInt(options.maxRetries, 10),
      });

      const providerInfo = PROVIDERS[provider.name];
      spinner.succeed(`Using ${chalk.magenta(providerInfo.displayName)} (${provider.name})`);

      spinner.start('Reading input file...');
      const content = await readFile(input, 'utf-8');
      const inputFormat = detectFormat(content, input);
      const outputFormat: SubtitleFormat = options.format || inputFormat;
      
      const subtitles = parse(content, inputFormat);
      spinner.succeed(`Parsed ${chalk.green(subtitles.length)} subtitles (${inputFormat.toUpperCase()})`);

      if (subtitles.length === 0) {
        console.error(chalk.red('\n✖ Error: No subtitles found in file'));
        process.exit(1);
      }

      const outputExt = outputFormat === 'vtt' ? 'vtt' : outputFormat === 'ass' ? 'ass' : 'srt';
      const outputPath = options.output || 
        input.replace(/\.(srt|vtt|ass|ssa)$/i, `.${targetLang.toLowerCase()}.${outputExt}`);

      console.log(chalk.blue(`\n📝 Translation: ${chalk.bold(sourceLang)} → ${chalk.bold(targetLang)}`));
      console.log(chalk.blue(`📁 Output: ${chalk.dim(outputPath)}\n`));

      const batches = batchSubtitles(subtitles, batchSize);

      const progressBar = new cliProgress.SingleBar({
        format: `${chalk.cyan('Translating')} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total} subtitles | Batch {batch}/{batches}`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
      });

      if (!options.quiet) {
        progressBar.start(subtitles.length, 0, { batch: 0, batches: batches.length });
      }

      const translatedSubtitles: Subtitle[] = [...subtitles];
      let processedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const startIdx = subtitles.indexOf(batch[0]);

        const translations = await provider.translateBatch(batch);

        for (let j = 0; j < batch.length; j++) {
          translatedSubtitles[startIdx + j] = {
            ...batch[j],
            text: translations[j],
          };
        }

        processedCount += batch.length;
        
        if (!options.quiet) {
          progressBar.update(processedCount, { batch: i + 1, batches: batches.length });
        }

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, parseInt(options.delay, 10)));
        }
      }

      if (!options.quiet) {
        progressBar.stop();
      }

      const output = serialize(translatedSubtitles, outputFormat);
      await writeFile(outputPath, output, 'utf-8');

      const duration = Date.now() - startTime;
      const stats = provider.getStats();

      if (!options.quiet) {
        printStats(stats, duration, subtitles.length, providerInfo.displayName);
      }

      console.log(chalk.green(`\n✔ Successfully saved to: ${chalk.bold(outputPath)}\n`));

    } catch (error) {
      spinner.fail('Translation failed');
      console.error(chalk.red(`\n✖ Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('batch [config]')
  .description('Process multiple jobs from a YAML config file')
  .option('-p, --provider <name>', 'AI provider: openai, anthropic, gemini, kimi')
  .option('-k, --api-key <key>', 'API key (or set via environment variable)')
  .option('-m, --model <model>', 'Model to use (provider-specific)')
  .option('--base-url <url>', 'Custom API base URL')
  .option('--dry-run', 'Show what would be done without executing')
  .action(async (configPath: string = 'jobs.yaml', options) => {
    printBanner();

    const spinner = ora({ color: 'cyan' });

    try {
      spinner.start(`Loading config from ${configPath}...`);
      const batchConfig = await loadBatchConfig(configPath);
      spinner.succeed(`Loaded ${chalk.green(batchConfig.jobs.length)} job(s) from config`);

      if (options.dryRun) {
        console.log(chalk.yellow('\n🔍 Dry run - showing planned actions:\n'));
        for (let i = 0; i < batchConfig.jobs.length; i++) {
          const job = batchConfig.jobs[i];
          const needsExtract = needsExtraction(job);
          console.log(chalk.cyan(`Job ${i + 1}:`));
          console.log(`  Input:  ${job.input}`);
          if (needsExtract) {
            console.log(`  Extract: Stream ${job.stream} → .srt`);
          }
          console.log(`  Translate: ${job.from} → ${job.to}`);
          console.log(`  Output: ${job.output || '(auto-generated)'}\n`);
        }
        return;
      }

      console.log(chalk.blue(`\n📋 Processing ${batchConfig.jobs.length} job(s)...\n`));

      let completed = 0;
      let failed = 0;

      for (let i = 0; i < batchConfig.jobs.length; i++) {
        const job = batchConfig.jobs[i];
        const jobNum = `[${i + 1}/${batchConfig.jobs.length}]`;
        
        console.log(chalk.cyan(`\n${'─'.repeat(60)}`));
        console.log(chalk.cyan(`${jobNum} ${job.input} → ${job.to}`));
        console.log(chalk.cyan('─'.repeat(60)));

        try {
          let subtitlePath = job.input;

          if (needsExtraction(job)) {
            spinner.start('Extracting subtitles from video...');
            subtitlePath = await extractSubtitle(job.input, job.stream ?? 0);
            spinner.succeed(`Extracted to ${chalk.dim(subtitlePath)}`);
          }

          spinner.start('Reading subtitle file...');
          const content = await readFile(subtitlePath, 'utf-8');
          const inputFormat = detectFormat(content, subtitlePath);
          const subtitles = parse(content, inputFormat);
          spinner.succeed(`Parsed ${chalk.green(subtitles.length)} subtitles`);

          const outputFormat: SubtitleFormat = job.format || inputFormat;
          const outputExt = outputFormat === 'vtt' ? 'vtt' : outputFormat === 'ass' ? 'ass' : 'srt';
          const outputPath = job.output || 
            subtitlePath.replace(/\.(srt|vtt|ass|ssa)$/i, `.${job.to.toLowerCase()}.${outputExt}`);

          // Create provider
          const provider = createProvider({
            provider: options.provider as ProviderName | undefined,
            apiKey: options.apiKey,
            model: options.model,
            baseUrl: options.baseUrl,
            sourceLang: resolveLanguage(job.from || 'English'),
            targetLang: resolveLanguage(job.to),
          });

          const batches = batchSubtitles(subtitles, 100);
          const translatedSubtitles: Subtitle[] = [...subtitles];

          const progressBar = new cliProgress.SingleBar({
            format: `${chalk.cyan('Translating')} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total}`,
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true,
          });

          progressBar.start(subtitles.length, 0);

          let processedCount = 0;
          for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const startIdx = subtitles.indexOf(batch[0]);
            const translations = await provider.translateBatch(batch);

            for (let j = 0; j < batch.length; j++) {
              translatedSubtitles[startIdx + j] = { ...batch[j], text: translations[j] };
            }

            processedCount += batch.length;
            progressBar.update(processedCount);

            if (b < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }

          progressBar.stop();

          const output = serialize(translatedSubtitles, outputFormat);
          await writeFile(outputPath, output, 'utf-8');

          console.log(chalk.green(`✔ Saved: ${outputPath}`));
          completed++;

        } catch (error) {
          console.error(chalk.red(`✖ Failed: ${error instanceof Error ? error.message : error}`));
          failed++;
        }
      }

      console.log(chalk.cyan(`\n${'═'.repeat(60)}`));
      console.log(chalk.bold('\n📊 Batch Summary:'));
      console.log(`   ${chalk.green('✔')} Completed: ${completed}`);
      if (failed > 0) {
        console.log(`   ${chalk.red('✖')} Failed: ${failed}`);
      }
      console.log();

    } catch (error) {
      spinner.fail('Batch processing failed');
      console.error(chalk.red(`\n✖ Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Create a sample jobs.yaml config file')
  .action(async () => {
    const sampleConfig = `# Subtitle Translation Jobs
# Run with: pnpm run batch

defaults:
  from: English
  to: Hindi

jobs:
  # Translate an SRT file
  - input: movie.srt
    to: Hindi

  # Translate to multiple languages
  - input: movie.srt
    to: Japanese

  - input: movie.srt
    to: Korean

  # Extract from MKV and translate
  - input: movie.mkv
    stream: 0          # subtitle stream index
    to: Spanish

  # Custom output path
  - input: episode1.srt
    to: French
    output: translations/episode1_fr.srt
`;

    if (existsSync('jobs.yaml')) {
      console.log(chalk.yellow('\n⚠ jobs.yaml already exists. Not overwriting.\n'));
      return;
    }

    await writeFile('jobs.yaml', sampleConfig, 'utf-8');
    console.log(chalk.green('\n✔ Created jobs.yaml\n'));
    console.log(chalk.dim('Edit the file and run: pnpm run batch\n'));
  });

program.parse();
