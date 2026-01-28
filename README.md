# Subtitle Translator

AI-powered subtitle translation tool with support for **SRT**, **VTT**, and **ASS** formats. Extract subtitles from MKV/MP4 files and translate them to any language.

## Features

- **Multi-format support**: SRT, VTT, ASS/SSA input and output
- **Video extraction**: Extract subtitles directly from MKV/MP4/AVI/WebM files
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

- **Node.js 18+**
- **ffmpeg** (for extracting subtitles from video files)
- **Kimi API key** from [kimi.com/coding](https://kimi.com/coding/profile)

#### Installing ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (with chocolatey)
choco install ffmpeg
```

## Quick Start

```bash
# Translate a subtitle file
pnpm run translate movie.srt --to Spanish

# Extract subtitles from video
pnpm run extract movie.mkv --list
pnpm run extract movie.mkv --stream 0

# Batch process multiple files
pnpm run init    # creates jobs.yaml
pnpm run batch   # processes all jobs
```

---

## Extracting Subtitles from Video Files

Extract embedded subtitles from MKV, MP4, AVI, WebM, and other video containers.

### Supported Formats

| Input | Subtitle Codecs |
|-------|-----------------|
| MKV | SRT, ASS/SSA, VobSub, PGS |
| MP4 | SRT, tx3g |
| AVI | SRT |
| WebM | WebVTT |

### List Available Subtitle Streams

```bash
pnpm run extract movie.mkv --list
```

Output:
```
📼 Subtitle streams in movie.mkv:

──────────────────────────────────────────────────────────────────────
  0  │  subrip      │  English      - SDH
  1  │  subrip      │  Spanish     
  2  │  ass         │  Japanese     - Styled
  3  │  hdmv_pgs    │  English      - Forced
──────────────────────────────────────────────────────────────────────

Use: stt extract "movie.mkv" --stream <n>
```

### Extract a Specific Stream

```bash
# Extract stream 0 (first subtitle)
pnpm run extract movie.mkv --stream 0

# Extract with custom output path
pnpm run extract movie.mkv --stream 1 -o spanish.srt

# Extract all streams at once
pnpm run extract movie.mkv --all
```

### Extract Command Options

```bash
pnpm run extract <video> [options]

Options:
  -o, --output <path>      Output file path
  -s, --stream <n>         Subtitle stream index (default: 0)
  -l, --list               List available subtitle streams
  -a, --all                Extract all subtitle streams
```

---

## Translating Subtitles

### Basic Translation

```bash
pnpm run translate movie.srt --to Hindi
```

Output: `movie.hindi.srt`

### Translate Command Options

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

### Convert Between Formats

```bash
# SRT to VTT
pnpm run translate movie.srt --to English --format vtt

# SRT to ASS
pnpm run translate movie.srt --to English --format ass
```

---

## Batch Processing

Process multiple files with a single YAML config.

### Create Config

```bash
pnpm run init
```

### Edit jobs.yaml

```yaml
defaults:
  from: English
  batchSize: 500

jobs:
  # Translate SRT to multiple languages
  - input: movie.srt
    to: Hindi

  - input: movie.srt
    to: Japanese

  - input: movie.srt
    to: Korean

  # Extract from MKV and translate
  - input: movie.mkv
    stream: 0
    to: Spanish
    output: movie_es.srt

  # Custom output path
  - input: episode1.srt
    to: French
    output: translations/episode1_fr.srt
```

### Run Batch

```bash
# Preview what will happen
pnpm run batch --dry-run

# Execute all jobs
pnpm run batch
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
| th | Thai | pl | Polish |
| vi | Vietnamese | sv | Swedish |

---

## Configuration

### Environment Variables

Create a `.env` file:

```bash
KIMI_API_KEY=sk-kimi-xxx
```

Or pass via CLI:

```bash
pnpm run translate movie.srt --to Hindi --api-key sk-kimi-xxx
```

### Get Your API Key

1. Go to [kimi.com/coding](https://kimi.com/coding/profile)
2. Sign in / create account
3. Copy your API key (starts with `sk-kimi-`)

### Optimizing for API Costs

Kimi Code API is billed **per request**, not tokens. Use larger batch sizes:

```bash
# Default: 500 subtitles per request (~3 requests for a movie)
pnpm run translate movie.srt --to Hindi

# Aggressive: 1000 subtitles per request (~2 requests)
pnpm run translate movie.srt --to Hindi --batch-size 1000
```

---

## Complete Workflow Example

### MKV → Translated Subtitles

```bash
# 1. Check available subtitles in the video
pnpm run extract movie.mkv --list

# 2. Extract English subtitles (stream 3 in this example)
pnpm run extract movie.mkv --stream 3 -o movie.srt

# 3. Translate to Turkish
pnpm run translate movie.srt --to Turkish

# Result: movie.turkish.srt (synced with original timing)
```

### Translate to Multiple Languages

```bash
# Create jobs.yaml
cat > jobs.yaml << 'EOF'
defaults:
  from: English

jobs:
  - input: movie.srt
    to: Hindi
  - input: movie.srt
    to: Turkish
  - input: movie.srt
    to: Arabic
  - input: movie.srt
    to: Japanese
EOF

# Run batch translation
pnpm run batch
```

---

## Troubleshooting

### "ffmpeg not found"
Install ffmpeg (see [Installing ffmpeg](#installing-ffmpeg))

### "No subtitle streams found"
The video file doesn't have embedded subtitles. You'll need an external SRT file.

### "API key required"
Set your API key in `.env` or pass via `--api-key`

### Subtitles out of sync
The tool preserves original timestamps exactly. If sync is off, the source SRT was already out of sync.

---

## License

MIT
