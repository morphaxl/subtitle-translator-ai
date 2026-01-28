# Subtitle Translator

AI-powered subtitle translation tool with support for **SRT**, **VTT**, and **ASS** formats. Extract subtitles from MKV/MP4 files and translate them to any language.

## Features

- **Multi-format support**: SRT, VTT, ASS/SSA input and output
- **Video extraction**: Extract subtitles directly from MKV/MP4 files (requires ffmpeg)
- **Batch processing**: Translate multiple files with a single YAML config
- **Natural translations**: AI-powered translations that preserve tone and cultural context
- **Progress tracking**: Real-time progress bars and statistics
- **Request-optimized**: Large batch sizes to minimize API calls

## Installation

```bash
# Clone the repository
git clone https://github.com/morphaxl/subtitle-translator.git
cd subtitle-translator

# Install dependencies
pnpm install

# Set up your API key
echo "KIMI_API_KEY=your-api-key" > .env
```

### Prerequisites

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/) (for extracting subtitles from video files)
- Kimi API key from [kimi.com](https://kimi.com/coding/profile)

## Quick Start

### Translate a subtitle file

```bash
pnpm run translate movie.srt --to Spanish
```

### Extract subtitles from MKV

```bash
# List available subtitle streams
pnpm run extract movie.mkv --list

# Extract a specific stream
pnpm run extract movie.mkv --stream 0
```

### Batch processing

```bash
# Create a config file
pnpm run init

# Edit jobs.yaml, then run
pnpm run batch
```

## Usage

### Translate Command

```bash
pnpm run translate <input> [options]

Options:
  -o, --output <path>      Output file path
  -f, --from <lang>        Source language (default: English)
  -t, --to <lang>          Target language (default: Hindi)
  --format <fmt>           Output format: srt, vtt, ass
  -b, --batch-size <n>     Subtitles per API request (default: 500)
  -k, --api-key <key>      API key (or use KIMI_API_KEY env)
  -q, --quiet              Minimal output
```

### Extract Command

```bash
pnpm run extract <video> [options]

Options:
  -o, --output <path>      Output file path
  -s, --stream <n>         Subtitle stream index (default: 0)
  -l, --list               List available subtitle streams
  -a, --all                Extract all subtitle streams
```

### Batch Config (jobs.yaml)

```yaml
defaults:
  from: English
  batchSize: 500

jobs:
  - input: movie.srt
    to: Hindi

  - input: movie.srt
    to: Japanese

  - input: movie.mkv
    stream: 0
    to: Spanish
    output: movie_es.srt
```

## Language Codes

Use full names or ISO codes:

| Code | Language |
|------|----------|
| en | English |
| hi | Hindi |
| ja | Japanese |
| zh | Chinese |
| ko | Korean |
| es | Spanish |
| fr | French |
| de | German |
| tr | Turkish |
| ar | Arabic |
| ru | Russian |
| pt | Portuguese |

## Configuration

### Environment Variables

```bash
KIMI_API_KEY=sk-kimi-xxx    # Your Kimi API key
```

### Optimizing for API Requests

The Kimi Code API is billed per request, not tokens. Increase batch size to reduce costs:

```bash
# Default: 500 subtitles per request
pnpm run translate movie.srt --to Hindi

# Aggressive: 1000 subtitles per request
pnpm run translate movie.srt --to Hindi --batch-size 1000
```

## Examples

### Full workflow: MKV to translated SRT

```bash
# 1. Check available subtitles
pnpm run extract movie.mkv --list

# 2. Extract English subtitles (stream 0)
pnpm run extract movie.mkv --stream 0 -o movie.srt

# 3. Translate to Turkish
pnpm run translate movie.srt --to Turkish
```

### Translate to multiple languages

```yaml
# jobs.yaml
defaults:
  from: English

jobs:
  - input: movie.srt
    to: Hindi
  - input: movie.srt
    to: Japanese
  - input: movie.srt
    to: Korean
  - input: movie.srt
    to: Spanish
```

```bash
pnpm run batch
```

## License

MIT
