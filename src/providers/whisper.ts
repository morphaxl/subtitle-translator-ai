import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Subtitle } from '../subtitles.js';
import type { ProviderConfig, TranslationProvider, TranslationStats } from './types.js';
import { parse } from '../subtitles.js';

export interface WhisperConfig extends ProviderConfig {
  whisperModel?: string;
  device?: string;
  language?: string;
}

/**
 * Whisper provider for FREE local transcription/translation.
 * 
 * IMPORTANT LIMITATIONS:
 * - Whisper can only translate TO English, not from English to other languages
 * - For translating TO other languages, use AI providers (openai, anthropic, gemini, kimi)
 * - This provider is best for: extracting subtitles from audio/video without existing subs
 * 
 * Use cases:
 * - Transcribe audio in any language -> same language subtitles
 * - Translate foreign audio -> English subtitles (free!)
 */
export function createWhisperProvider(config: WhisperConfig): TranslationProvider {
  const {
    sourceLang,
    targetLang,
  } = config;

  const whisperModel = config.whisperModel || 'base';

  const stats: TranslationStats = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    apiCalls: 0,
    retries: 0,
  };

  // Whisper can only translate TO English
  if (targetLang.toLowerCase() !== 'english' && targetLang.toLowerCase() !== 'en') {
    throw new Error(
      `Whisper can only translate TO English, not to ${targetLang}.\n` +
      `For translation to other languages, use: --provider openai|anthropic|gemini|kimi`
    );
  }

  async function translateBatch(subtitles: Subtitle[]): Promise<string[]> {
    // Whisper doesn't translate text - it transcribes/translates audio
    // This function is a pass-through since we handle audio in a separate command
    throw new Error(
      'Whisper provider does not support text translation.\n' +
      'Use "stt transcribe <audio/video>" to transcribe audio files.\n' +
      'For text translation, use: --provider openai|anthropic|gemini|kimi'
    );
  }

  function getStats(): TranslationStats {
    return { ...stats };
  }

  function resetStats(): void {
    stats.totalTokens = 0;
    stats.inputTokens = 0;
    stats.outputTokens = 0;
    stats.cachedTokens = 0;
    stats.apiCalls = 0;
    stats.retries = 0;
  }

  return { name: 'whisper', translateBatch, getStats, resetStats };
}

export interface TranscribeOptions {
  model?: string;
  task?: 'transcribe' | 'translate';
  language?: string;
  outputFormat?: 'srt' | 'vtt' | 'txt' | 'json';
  outputDir?: string;
  verbose?: boolean;
}

export interface TranscribeResult {
  success: boolean;
  outputFile: string;
  subtitles?: Subtitle[];
  duration?: number;
}

/**
 * Check if whisper CLI is installed
 */
export async function isWhisperInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('whisper', ['--help']);
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Transcribe or translate audio/video using Whisper CLI
 * 
 * @param inputPath - Path to audio/video file
 * @param options - Transcription options
 */
export async function transcribeWithWhisper(
  inputPath: string,
  options: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const {
    model = 'base',
    task = 'transcribe',
    language,
    outputFormat = 'srt',
    outputDir = os.tmpdir(),
    verbose = false,
  } = options;

  // Check if whisper is installed
  const installed = await isWhisperInstalled();
  if (!installed) {
    throw new Error(
      'Whisper CLI is not installed.\n\n' +
      'Install with: pip install -U openai-whisper\n' +
      'Also requires ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)'
    );
  }

  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Build whisper command args
  const args = [
    inputPath,
    '--model', model,
    '--task', task,
    '--output_format', outputFormat,
    '--output_dir', outputDir,
  ];

  if (language) {
    args.push('--language', language);
  }

  // Note: turbo model doesn't support translation
  if (task === 'translate' && model === 'turbo') {
    throw new Error(
      'The "turbo" model does not support translation.\n' +
      'Use --model medium or --model large for translation tasks.'
    );
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const proc = spawn('whisper', args);
    
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (verbose) {
        process.stdout.write(text);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (verbose) {
        process.stderr.write(text);
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to run whisper: ${error.message}`));
    });

    proc.on('close', async (code) => {
      const duration = Date.now() - startTime;
      
      if (code !== 0) {
        reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
        return;
      }

      // Construct output file path
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputFile = path.join(outputDir, `${baseName}.${outputFormat}`);

      // Try to read and parse the output
      let subtitles: Subtitle[] | undefined;
      if (outputFormat === 'srt' || outputFormat === 'vtt') {
        try {
          const content = await readFile(outputFile, 'utf-8');
          subtitles = parse(content, outputFormat);
        } catch {
          // Subtitles couldn't be parsed, but file should still exist
        }
      }

      resolve({
        success: true,
        outputFile,
        subtitles,
        duration,
      });
    });
  });
}

/**
 * Get available Whisper models with their characteristics
 */
export function getWhisperModels() {
  return [
    { name: 'tiny', params: '39M', vram: '~1GB', speed: '~10x', note: 'Fastest, lowest quality' },
    { name: 'base', params: '74M', vram: '~1GB', speed: '~7x', note: 'Good balance for quick tasks' },
    { name: 'small', params: '244M', vram: '~2GB', speed: '~4x', note: 'Better accuracy' },
    { name: 'medium', params: '769M', vram: '~5GB', speed: '~2x', note: 'High quality, supports translation' },
    { name: 'large', params: '1550M', vram: '~10GB', speed: '1x', note: 'Best accuracy' },
    { name: 'turbo', params: '809M', vram: '~6GB', speed: '~8x', note: 'Fast, NO translation support' },
  ];
}
