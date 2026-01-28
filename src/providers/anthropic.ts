import type { Subtitle } from '../subtitles.js';
import type { ProviderConfig, TranslationProvider, TranslationStats } from './types.js';
import { SYSTEM_PROMPT, PROVIDERS } from './types.js';

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt > maxRetries) break;
      
      const isRetryable = lastError.message.includes('429') || 
                          lastError.message.includes('500') ||
                          lastError.message.includes('502') ||
                          lastError.message.includes('503');
      
      if (!isRetryable) break;
      
      onRetry?.(attempt, lastError);
      await sleep(baseDelay * Math.pow(2, attempt - 1));
    }
  }
  
  throw lastError;
}

export function createAnthropicProvider(config: ProviderConfig): TranslationProvider {
  const { 
    apiKey, 
    baseUrl = PROVIDERS.anthropic.baseUrl,
    model = PROVIDERS.anthropic.defaultModel,
    sourceLang, 
    targetLang,
    maxRetries = 3,
    retryDelay = 1000,
  } = config;

  if (!apiKey) {
    throw new Error('Anthropic API key is required');
  }

  const stats: TranslationStats = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    apiCalls: 0,
    retries: 0,
  };

  async function translateBatch(subtitles: Subtitle[]): Promise<string[]> {
    const inputLines = subtitles.map(s => s.text);
    const userPrompt = `Translate these ${subtitles.length} subtitle lines from ${sourceLang} to ${targetLang}:

${inputLines.map((line, i) => `[${i + 1}] ${line}`).join('\n')}

Output exactly ${subtitles.length} translated lines:`;

    const doRequest = async (): Promise<AnthropicResponse> => {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${error}`);
      }

      return response.json() as Promise<AnthropicResponse>;
    };

    const data = await fetchWithRetry(
      doRequest,
      maxRetries,
      retryDelay,
      (attempt, error) => {
        stats.retries++;
        console.warn(`\n  ⚠ Retry ${attempt}/${maxRetries}: ${error.message.substring(0, 50)}...`);
      }
    );

    stats.apiCalls++;
    if (data.usage) {
      stats.inputTokens += data.usage.input_tokens || 0;
      stats.outputTokens += data.usage.output_tokens || 0;
      stats.totalTokens += (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0);
    }

    const translatedText = data.content[0]?.text || '';
    return parseTranslations(translatedText, subtitles);
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

  return { name: 'anthropic', translateBatch, getStats, resetStats };
}

function parseTranslations(text: string, subtitles: Subtitle[]): string[] {
  const lineMap = new Map<number, string>();
  const lines = text.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s*(.+)$/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      lineMap.set(idx, match[2].trim());
    } else {
      const cleanLine = line.trim();
      if (cleanLine && lineMap.size < subtitles.length) {
        lineMap.set(lineMap.size, cleanLine);
      }
    }
  }

  const translatedLines: string[] = [];
  for (let i = 0; i < subtitles.length; i++) {
    translatedLines.push(lineMap.get(i) || subtitles[i].text);
  }

  return translatedLines;
}
