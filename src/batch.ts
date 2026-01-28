import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { extname } from 'path';

export interface Job {
  input: string;
  from?: string;
  to: string;
  output?: string;
  format?: 'srt' | 'vtt' | 'ass';
  stream?: number;
  batchSize?: number;
}

export interface BatchConfig {
  defaults?: {
    from?: string;
    to?: string;
    format?: 'srt' | 'vtt' | 'ass';
    batchSize?: number;
  };
  jobs: Job[];
}

function isVideoFile(path: string): boolean {
  const ext = extname(path).toLowerCase();
  return ['.mkv', '.mp4', '.avi', '.mov', '.webm', '.m4v'].includes(ext);
}

export async function loadBatchConfig(configPath: string): Promise<BatchConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = await readFile(configPath, 'utf-8');
  const config = parseYAML(content) as BatchConfig;

  if (!config.jobs || !Array.isArray(config.jobs)) {
    throw new Error('Config must have a "jobs" array');
  }

  const defaults = config.defaults || {};
  
  const normalizedJobs: Job[] = config.jobs.map((job, i) => {
    if (!job.input) {
      throw new Error(`Job ${i + 1}: missing "input" field`);
    }
    if (!job.to && !defaults.to) {
      throw new Error(`Job ${i + 1}: missing "to" field (target language)`);
    }

    return {
      input: job.input,
      from: job.from || defaults.from || 'English',
      to: job.to || defaults.to || 'Hindi',
      output: job.output,
      format: job.format || defaults.format,
      stream: job.stream ?? 0,
      batchSize: job.batchSize || defaults.batchSize || 500,
    };
  });

  return { defaults, jobs: normalizedJobs };
}

export function needsExtraction(job: Job): boolean {
  return isVideoFile(job.input);
}
