import type { Subtitle } from '../subtitles.js';

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'kimi' | 'whisper';

export interface TranslationStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  apiCalls: number;
  retries: number;
}

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  sourceLang: string;
  targetLang: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface TranslationProvider {
  name: ProviderName;
  translateBatch(subtitles: Subtitle[]): Promise<string[]>;
  getStats(): TranslationStats;
  resetStats(): void;
}

export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  description: string;
  requiresApiKey: boolean;
  envVar: string;
  defaultModel: string;
  models: string[];
  baseUrl?: string;
}

export const PROVIDERS: Record<ProviderName, ProviderInfo> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    description: 'GPT-4o and GPT-4o-mini models',
    requiresApiKey: true,
    envVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com',
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude 3.5 Sonnet and Claude 3 models',
    requiresApiKey: true,
    envVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    baseUrl: 'https://api.anthropic.com',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini 1.5 Pro and Flash models',
    requiresApiKey: true,
    envVar: 'GEMINI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'],
    baseUrl: 'https://generativelanguage.googleapis.com',
  },
  kimi: {
    name: 'kimi',
    displayName: 'Kimi',
    description: 'Moonshot Kimi models (pay per request)',
    requiresApiKey: true,
    envVar: 'KIMI_API_KEY',
    defaultModel: 'kimi-for-coding',
    models: ['kimi-for-coding', 'kimi-for-coding-thinking'],
    baseUrl: 'https://api.kimi.com/coding',
  },
  whisper: {
    name: 'whisper',
    displayName: 'Whisper (Local)',
    description: 'Free local transcription/translation using OpenAI Whisper',
    requiresApiKey: false,
    envVar: '',
    defaultModel: 'base',
    models: ['tiny', 'base', 'small', 'medium', 'large', 'turbo'],
  },
};

export const SYSTEM_PROMPT = `You are an expert subtitle translator. Translate naturally while:
- Adapting idioms and cultural references for the target audience
- Keeping translations concise for subtitle timing
- Preserving tone, emotion, and formality level
- Handling sentence fragments gracefully

CRITICAL: You will receive N numbered lines. Return EXACTLY N translations, one per line.
Format each line as: [number] translation
Example input: [1] Hello [2] Goodbye
Example output: [1] Hola [2] Adiós`;

export function detectProvider(apiKey: string): ProviderName | null {
  if (apiKey.startsWith('sk-kimi-')) return 'kimi';
  if (apiKey.startsWith('sk-ant-') || apiKey.startsWith('sk-')) {
    // Anthropic keys start with sk-ant- but OpenAI also uses sk-
    // Check for Anthropic pattern first
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    // Default sk- to OpenAI
    return 'openai';
  }
  if (apiKey.startsWith('AIza')) return 'gemini';
  return null;
}

export function getApiKey(provider: ProviderName, explicitKey?: string): string | undefined {
  if (explicitKey) return explicitKey;
  
  const info = PROVIDERS[provider];
  if (!info.requiresApiKey) return undefined;
  
  return process.env[info.envVar];
}
