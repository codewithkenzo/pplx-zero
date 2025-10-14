# PPLX-Zero

> Fast Perplexity AI search CLI - minimal setup, maximal results

<p align="center">
  <a href="https://badge.fury.io/js/pplx-zero"><img src="https://badge.fury.io/js/pplx-zero.svg" alt="npm version"></a>
  <a href="https://aur.archlinux.org/packages/pplx-zero"><img src="https://img.shields.io/aur/version/pplx-zero?style=flat-square" alt="AUR package"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-black?logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

A fast TypeScript CLI for Perplexity AI search with multimodal support. Built with Bun runtime for performance and reliability.

## Features

- **⚡ Fast Search** - Concurrent queries with intelligent rate limiting
- **🎯 Simple Setup** - Works with just an API key, no configuration required
- **📦 Batch Processing** - Handle multiple searches simultaneously
- **🔄 Real-time Updates** - JSONL streaming progress events
- **🖼️ File Analysis** - Process documents and images with AI models
- **🤖 AI Models** - Sonar, Sonar Pro, Sonar Deep Research, Sonar Reasoning
- **🛡️ Type Safe** - Full Zod validation and TypeScript support
- **🌍 Cross-Platform** - Native Bun runtime support

## Quick Start

### 1️⃣ Install

**📦 Package Manager Installation (Recommended)**

```bash
# npm (Node.js package manager)
npm install -g pplx-zero

# AUR (Arch Linux)
yay -S pplx-zero
# or manual AUR
git clone https://aur.archlinux.org/pplx-zero.git
cd pplx-zero
makepkg -si
```

**🔨 Manual Installation**

```bash
# Clone and build locally
git clone https://github.com/codewithkenzo/pplx-zero.git
cd pplx-zero
bun install && bun run build

# Add to PATH
sudo ln -s "$(pwd)/dist/cli.js" /usr/local/bin/pplx
```

### 2️⃣ Setup API Key

**Linux/macOS:**
```bash
export PERPLEXITY_API_KEY="your-api-key"
```

**Windows:**
```cmd
setx PERPLEXITY_API_KEY "your-api-key"
```

**Get your API key:** https://www.perplexity.ai/account/api/keys

### 3️⃣ Start Searching

```bash
# Basic search
pplx "latest AI developments"

# Choose model
pplx --model sonar-pro "Detailed analysis"

# Document analysis
pplx --attach report.pdf "Summarize this document"

# Image analysis
pplx --attach-image screenshot.png "Analyze this interface"

# Batch processing
pplx --input queries.json

# Stream processing
cat queries.jsonl | pplx --stdin
```

## Usage Guide

### Command Line Options

```bash
# Search with custom settings
pplx --concurrency 10 --timeout 60000 --format jsonl "machine learning trends"

# Model selection
pplx --model sonar-pro "Detailed analysis"
pplx --model sonar-reasoning "Complex problem solving"

# File attachments
pplx --attach document.pdf "Summarize this report"
pplx --attach-image chart.png "Analyze this chart"

# Async processing
pplx --async --webhook https://api.example.com/callback "Research task"
```

### Batch Processing

Create `queries.json`:

```json
{
  "version": "1.0.0",
  "requests": [
    {"op": "search", "args": {"query": "AI trends", "maxResults": 5}},
    {"op": "search", "args": {"query": "TypeScript patterns", "maxResults": 3}},
    {"op": "search", "args": {"query": "Bun performance", "maxResults": 3}}
  ],
  "options": {
    "concurrency": 5,
    "timeoutMs": 30000
  }
}
```

Process with:

```bash
pplx --input queries.json --format jsonl
```

### File Attachments

Supported file formats for analysis:

**Documents (max 50MB):**
- PDF, DOC, DOCX, TXT, RTF

**Images (max 50MB):**
- PNG, JPEG, WebP, HEIF, HEIC, GIF

**Examples:**
```bash
# Document analysis
pplx --attach report.pdf "Summarize this document"

# Image analysis
pplx --attach-image screenshot.png "Analyze this interface"

# Multiple files
pplx --attach document.txt --attach-image chart.png "Analyze this data"
```

### Programmatic Usage

```typescript
import { PerplexitySearchTool } from 'pplx-zero';

const tool = new PerplexitySearchTool();

const result = await tool.runBatch({
  version: "1.0.0",
  requests: [{
    op: "search",
    args: { query: "TypeScript best practices", maxResults: 5 }
  }]
});

console.log(result);
```

## Configuration

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--input` | `-i` | string | - | Read batch requests from JSON file |
| `--stdin` | `-s` | boolean | false | Read JSONL requests from stdin |
| `--concurrency` | `-c` | number | 5 | Max concurrent requests (1-20) |
| `--timeout` | `-t` | number | 30000 | Request timeout in ms (1000-300000) |
| `--format` | `-f` | string | json | Output format: json|jsonl |
| `--model` | `-m` | string | sonar | AI model to use |
| `--attach` | - | string[] | - | Attach document files |
| `--attach-image` | - | string[] | - | Attach image files |
| `--async` | - | boolean | false | Process requests asynchronously |
| `--webhook` | - | string | - | Webhook URL for async notifications |
| `--version` | `-v` | boolean | - | Show version |
| `--help` | `-h` | boolean | - | Show help |

### AI Models

- `sonar` - Fast, concise responses (default)
- `sonar-pro` - Detailed, comprehensive responses
- `sonar-deep-research` - In-depth research with web search
- `sonar-reasoning` - Step-by-step logical reasoning

## Output Formats

### JSON (Default)
```json
{
  "version": "1.0.0",
  "ok": true,
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0,
    "totalDuration": 572
  },
  "results": [...]
}
```

### JSONL (Streaming)
```bash
pplx --format jsonl "AI trends"
```
Each result printed as a separate JSON line for real-time processing.

## Development

```bash
# Development mode
bun run dev

# Type checking
bun run typecheck

# Run tests
bun test

# Build for production
bun run build

# Create binary
bun run build:binary
```

## Architecture

- **Bun Runtime** - Fast JavaScript runtime
- **Zod Validation** - Type-safe schema validation
- **Error Handling** - Resilient error recovery
- **Concurrency Control** - Semaphore pattern for rate limiting
- **Streaming Events** - Real-time progress updates

## Security Features

- Environment variable API key management
- Input validation and sanitization
- Request timeout protection
- Error information filtering
- No external dependencies beyond core runtime

## Error Handling

PPLX-Zero provides comprehensive error classification:

```typescript
enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  API_KEY_MISSING = "API_KEY_MISSING",
  API_ERROR = "API_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  UNEXPECTED_ERROR = "UNEXPECTED_ERROR"
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with [Bun](https://bun.sh) and [Perplexity AI](https://www.perplexity.ai)**
