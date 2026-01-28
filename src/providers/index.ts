import type { ProviderConfig, ProviderName, TranslationProvider } from './types.js';
import { PROVIDERS, detectProvider, getApiKey } from './types.js';
import { createOpenAIProvider } from './openai.js';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import { createKimiProvider } from './kimi.js';
import { createWhisperProvider } from './whisper.js';

export * from './types.js';
export * from './whisper.js';

export interface CreateProviderOptions {
  provider?: ProviderName;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  sourceLang: string;
  targetLang: string;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Create a translation provider with automatic detection
 * 
 * Provider selection priority:
 * 1. Explicit --provider flag
 * 2. Auto-detect from API key prefix
 * 3. Check environment variables in order: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, KIMI_API_KEY
 * 4. Default to whisper (free, local)
 */
export function createProvider(options: CreateProviderOptions): TranslationProvider {
  const {
    provider: explicitProvider,
    apiKey: explicitKey,
    model,
    baseUrl,
    sourceLang,
    targetLang,
    maxRetries,
    retryDelay,
  } = options;

  // Determine which provider to use
  let providerName: ProviderName;
  let apiKey: string | undefined;

  if (explicitProvider) {
    // Explicit provider specified
    providerName = explicitProvider;
    apiKey = explicitKey || getApiKey(providerName);
  } else if (explicitKey) {
    // Try to detect provider from API key
    const detected = detectProvider(explicitKey);
    if (detected) {
      providerName = detected;
      apiKey = explicitKey;
    } else {
      // Unknown key format, default to OpenAI-compatible
      providerName = 'openai';
      apiKey = explicitKey;
    }
  } else {
    // Auto-detect from environment variables
    const detectedProvider = detectFromEnv();
    if (detectedProvider) {
      providerName = detectedProvider.name;
      apiKey = detectedProvider.apiKey;
    } else {
      // No API keys found, default to whisper (free)
      providerName = 'whisper';
    }
  }

  const config: ProviderConfig = {
    apiKey,
    model: model || PROVIDERS[providerName].defaultModel,
    baseUrl: baseUrl || PROVIDERS[providerName].baseUrl,
    sourceLang,
    targetLang,
    maxRetries,
    retryDelay,
  };

  // Validate API key requirement
  if (PROVIDERS[providerName].requiresApiKey && !apiKey) {
    const envVar = PROVIDERS[providerName].envVar;
    throw new Error(
      `${PROVIDERS[providerName].displayName} requires an API key.\n` +
      `Set ${envVar} environment variable or use --api-key flag.`
    );
  }

  return createProviderByName(providerName, config);
}

function createProviderByName(name: ProviderName, config: ProviderConfig): TranslationProvider {
  switch (name) {
    case 'openai':
      return createOpenAIProvider(config);
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'gemini':
      return createGeminiProvider(config);
    case 'kimi':
      return createKimiProvider(config);
    case 'whisper':
      return createWhisperProvider(config);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

function detectFromEnv(): { name: ProviderName; apiKey: string } | null {
  // Check providers in preference order
  const checkOrder: ProviderName[] = ['openai', 'anthropic', 'gemini', 'kimi'];
  
  for (const name of checkOrder) {
    const info = PROVIDERS[name];
    const key = process.env[info.envVar];
    if (key) {
      return { name, apiKey: key };
    }
  }
  
  return null;
}

/**
 * List all available providers with their status
 */
export function listProviders(): Array<{
  name: ProviderName;
  displayName: string;
  description: string;
  configured: boolean;
  envVar: string;
  models: string[];
}> {
  return Object.values(PROVIDERS).map(info => ({
    name: info.name,
    displayName: info.displayName,
    description: info.description,
    configured: info.requiresApiKey ? !!process.env[info.envVar] : true,
    envVar: info.envVar,
    models: info.models,
  }));
}

/**
 * Get configuration help for a provider
 */
export function getProviderHelp(name: ProviderName): string {
  const info = PROVIDERS[name];
  
  if (name === 'whisper') {
    return `
${info.displayName} - ${info.description}

This is a FREE local option that uses OpenAI's Whisper for speech recognition.

Installation:
  pip install -U openai-whisper
  brew install ffmpeg  # macOS
  apt install ffmpeg   # Linux

Usage:
  # Transcribe audio/video to subtitles (same language)
  stt transcribe video.mp4 --model base

  # Translate foreign audio to English subtitles (FREE!)
  stt transcribe foreign_video.mp4 --model medium --task translate

Models: ${info.models.join(', ')}

Note: Whisper can only translate TO English. For other target languages,
use AI providers like OpenAI, Anthropic, or Gemini.
`;
  }

  return `
${info.displayName} - ${info.description}

Configuration:
  # Set API key in environment
  export ${info.envVar}=your-api-key

  # Or use .env file
  echo "${info.envVar}=your-api-key" >> .env

  # Or pass via CLI
  stt translate movie.srt --to Spanish --provider ${name} --api-key your-key

Models: ${info.models.join(', ')}
Default: ${info.defaultModel}
`;
}
