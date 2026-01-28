# Subtitle Translator

Multi-provider AI subtitle translator with support for **OpenAI**, **Anthropic**, **Google Gemini**, **Kimi**, and **Whisper** (free local option).

## Features

- **Multi-provider support**: OpenAI, Anthropic, Gemini, Kimi, and free Whisper
- **Auto-detection**: Automatically detects provider from API key or environment
- **Multi-format**: SRT, VTT, ASS/SSA input and output
- **Video extraction**: Extract subtitles from MKV/MP4/AVI/WebM files
- **Free option**: Use Whisper for free local transcription/translation
- **Batch processing**: Translate multiple files with YAML config
- **Smart batching**: Optimized API calls to minimize costs

## Quick Start

```bash
# Clone and install
git clone https://github.com/morphaxl/subtitle-translator.git
cd subtitle-translator
pnpm install

# Set your API key (pick one)
export OPENAI_API_KEY=sk-...
# or ANTHROPIC_API_KEY, GEMINI_API_KEY, KIMI_API_KEY

# Translate!
pnpm run translate movie.srt --to Spanish
```

## Installation

```bash
pnpm install
```

### Prerequisites

- **Node.js 18+**
- **ffmpeg** (for extracting subtitles from video)
- **Whisper** (optional, for free local transcription)

```bash
# Install ffmpeg
brew install ffmpeg        # macOS
sudo apt install ffmpeg    # Linux

# Install Whisper (optional, for free transcription)
pip install -U openai-whisper
```

---

## Providers

### Available Providers

| Provider | Models | Pricing | Best For |
|----------|--------|---------|----------|
| **OpenAI** | gpt-4o, gpt-4o-mini | Per token | High quality, fast |
| **Anthropic** | claude-3.5-sonnet, claude-3-haiku | Per token | Natural translations |
| **Gemini** | gemini-1.5-pro, gemini-1.5-flash | Per token | Cost effective |
| **Kimi** | kimi-for-coding | Per request | Bulk translations |
| **Whisper** | tiny, base, small, medium, large | **FREE** | Audio transcription |

### Configuration

Set API keys via environment variables:

```bash
# .env file or export
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
KIMI_API_KEY=sk-kimi-...
```

Or pass via CLI:

```bash
pnpm run translate movie.srt --to Hindi --provider openai --api-key sk-...
```

### Auto-Detection

The tool automatically detects which provider to use:

1. **Explicit**: `--provider openai` flag
2. **Key prefix**: `sk-kimi-` → Kimi, `sk-ant-` → Anthropic, `AIza` → Gemini
3. **Environment**: Checks OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, KIMI_API_KEY
4. **Fallback**: Whisper (free, local)

### List Configured Providers

```bash
pnpm run providers
```

---

## Commands

### Translate Subtitles

```bash
pnpm run translate <input> [options]

Options:
  -o, --output <path>      Output file path
  -f, --from <lang>        Source language (default: English)
  -t, --to <lang>          Target language (default: Hindi)
  --format <fmt>           Output format: srt, vtt, ass
  -p, --provider <name>    Provider: openai, anthropic, gemini, kimi
  -k, --api-key <key>      API key
  -m, --model <model>      Model name (provider-specific)
  -b, --batch-size <n>     Subtitles per API call (default: 100)
  -q, --quiet              Minimal output
```

**Examples:**

```bash
# Auto-detect provider from environment
pnpm run translate movie.srt --to Spanish

# Use specific provider
pnpm run translate movie.srt --to Japanese --provider anthropic

# Use specific model
pnpm run translate movie.srt --to Korean --provider openai --model gpt-4o
```

### Extract from Video

```bash
pnpm run extract <video> [options]

Options:
  -l, --list               List available subtitle streams
  -s, --stream <n>         Extract specific stream (default: 0)
  -a, --all                Extract all streams
  -o, --output <path>      Output file path
```

**Examples:**

```bash
# List available subtitles
pnpm run extract movie.mkv --list

# Extract stream 0
pnpm run extract movie.mkv --stream 0

# Extract all streams
pnpm run extract movie.mkv --all
```

### Transcribe with Whisper (FREE)

```bash
pnpm run transcribe <audio/video> [options]

Options:
  -m, --model <model>      Whisper model: tiny, base, small, medium, large
  -l, --language <lang>    Source language (auto-detected if omitted)
  --translate              Translate to English (only TO English)
  -f, --format <fmt>       Output format: srt, vtt, txt, json
  -o, --output <dir>       Output directory
  --list-models            Show available Whisper models
```

**Examples:**

```bash
# Transcribe audio to SRT (same language)
pnpm run transcribe podcast.mp3 --model base

# Translate foreign audio to English (FREE!)
pnpm run transcribe spanish_movie.mp4 --model medium --translate

# List available models
pnpm run transcribe --list-models
```

> **Note**: Whisper can only translate **TO English**. For translation to other languages, use AI providers.

### Batch Processing

```bash
# Create config
pnpm run init

# Edit jobs.yaml, then run
pnpm run batch

# Preview without executing
pnpm run batch --dry-run
```

**jobs.yaml example:**

```yaml
defaults:
  from: English

jobs:
  - input: movie.srt
    to: Hindi

  - input: movie.srt
    to: Japanese

  - input: movie.mkv
    stream: 0
    to: Spanish
```

---

## Provider Comparison

### Quality vs Cost

| Provider | Quality | Speed | Cost |
|----------|---------|-------|------|
| OpenAI GPT-4o | ★★★★★ | Fast | $$$ |
| OpenAI GPT-4o-mini | ★★★★☆ | Very Fast | $$ |
| Anthropic Claude 3.5 | ★★★★★ | Fast | $$$ |
| Anthropic Haiku | ★★★★☆ | Very Fast | $ |
| Gemini 1.5 Pro | ★★★★☆ | Fast | $$ |
| Gemini 1.5 Flash | ★★★☆☆ | Very Fast | $ |
| Kimi | ★★★★☆ | Medium | $ (per request) |
| Whisper | N/A | Slow | **FREE** |

### Recommended Setup

**Budget-conscious:**
```bash
export GEMINI_API_KEY=AIza...
# Uses gemini-1.5-flash by default
```

**High quality:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Uses claude-3.5-sonnet by default
```

**Bulk translations:**
```bash
export KIMI_API_KEY=sk-kimi-...
# Pay per request, not per token - great for large files
```

**Free (audio only):**
```bash
pip install -U openai-whisper
pnpm run transcribe video.mp4 --translate
# Then translate the English SRT to target language
```

---

## Complete Workflow Examples

### Video to Translated Subtitles

```bash
# 1. Check available subtitle streams
pnpm run extract movie.mkv --list

# 2. Extract English subtitles
pnpm run extract movie.mkv --stream 0 -o movie.srt

# 3. Translate to Turkish
pnpm run translate movie.srt --to Turkish

# Result: movie.turkish.srt
```

### Foreign Audio to Any Language

```bash
# 1. Transcribe/translate to English with Whisper (FREE)
pnpm run transcribe foreign_movie.mp4 --model medium --translate -o .

# 2. Translate English to target language
pnpm run translate foreign_movie.srt --to Hindi --provider gemini

# Result: foreign_movie.hindi.srt
```

### Batch Multi-Language

```bash
# Create jobs.yaml
cat > jobs.yaml << 'EOF'
defaults:
  from: English

jobs:
  - input: movie.srt
    to: Spanish
  - input: movie.srt
    to: French
  - input: movie.srt
    to: German
  - input: movie.srt
    to: Japanese
  - input: movie.srt
    to: Korean
EOF

# Run batch
pnpm run batch --provider gemini
```

---

## Language Codes

Use full names or ISO codes:

| Code | Language | Code | Language |
|------|----------|------|----------|
| en | English | ko | Korean |
| hi | Hindi | es | Spanish |
| ja | Japanese | fr | French |
| zh | Chinese | de | German |
| tr | Turkish | it | Italian |
| ar | Arabic | pt | Portuguese |
| ru | Russian | nl | Dutch |

---

## Troubleshooting

### "API key required"

Set an API key via environment variable or `--api-key` flag:

```bash
export OPENAI_API_KEY=sk-...
# or
pnpm run translate movie.srt --to Hindi --api-key sk-...
```

### "Whisper not installed"

Install Whisper CLI:

```bash
pip install -U openai-whisper
brew install ffmpeg  # also required
```

### "ffmpeg not found"

Install ffmpeg:

```bash
brew install ffmpeg        # macOS
sudo apt install ffmpeg    # Linux
choco install ffmpeg       # Windows
```

### Rate limits / 429 errors

The tool automatically retries with exponential backoff. For persistent issues:

```bash
# Reduce batch size
pnpm run translate movie.srt --to Hindi --batch-size 50

# Add delay between batches
pnpm run translate movie.srt --to Hindi --delay 1000
```

---

## API Key Links

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys
- **Google Gemini**: https://aistudio.google.com/apikey
- **Kimi**: https://kimi.com/coding/profile

---

## License

MIT
