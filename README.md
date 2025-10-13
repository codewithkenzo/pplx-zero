# 🚀 PPLX-Zero

> Minimal, fast Perplexity AI search CLI - zero configuration, zero compromises

PPLX-Zero is a blazing-fast, production-ready TypeScript implementation of Perplexity AI search integration. Built with Bun runtime for maximum performance and zero bloat.

## ✨ Key Features

- **⚡ Lightning Fast** - Concurrent searches with intelligent rate limiting
- **🎯 Zero Config** - Works out of the box with just an API key
- **📦 Batch Processing** - Handle multiple queries simultaneously
- **🔄 Real-time Streaming** - Progress updates via JSONL events
- **🛡️ Type Safe** - Full Zod validation and TypeScript support
- **🌍 Cross-Platform** - Native Bun runtime everywhere

## 🚀 Quick Start

### 1️⃣ Install

```bash
# Global installation (recommended)
npm install -g pplx-zero

# Or clone and build locally
git clone https://github.com/codewithkenzo/pplx-zero.git
cd pplx-zero
bun install && bun run build
```

### 2️⃣ Setup API Key

```bash
export PERPLEXITY_API_KEY="your-perplexity-api-key"
# Or use the fallback
export PERPLEXITY_AI_API_KEY="your-alternative-api-key"
```

### 3️⃣ Start Searching

```bash
# Single query (CLI command is 'pplx')
pplx "latest AI developments"

# Batch from file
pplx --input queries.json

# Stream from stdin
cat queries.jsonl | pplx --stdin
```

## 📖 Usage Guide

### Command Line Interface

```bash
# Basic usage
pplx "your search query"

# Advanced options
pplx --concurrency 10 --timeout 60000 --format jsonl "machine learning trends"

# Dry run validation
pplx --dry-run "test query"
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

## ⚙️ Configuration

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--input` | `-i` | string | - | Read batch requests from JSON file |
| `--stdin` | `-s` | boolean | false | Read JSONL requests from stdin |
| `--concurrency` | `-c` | number | 5 | Max concurrent requests (1-20) |
| `--timeout` | `-t` | number | 30000 | Request timeout in ms (1000-300000) |
| `--format` | `-f` | string | json | Output format: json|jsonl |
| `--dry-run` | `-d` | boolean | false | Validate input without executing |
| `--version` | `-v` | boolean | - | Show version |
| `--help` | `-h` | boolean | - | Show help |

## 📊 Output Formats

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

## 🔧 Development

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

## 🏗️ Architecture

- **Bun Runtime** - Ultra-fast JavaScript runtime
- **Zod Validation** - Type-safe schema validation
- **Circuit Breaker** - Resilient error handling
- **Semaphore Pattern** - Controlled concurrency
- **Streaming Events** - Real-time progress updates

## 🛡️ Security Features

- Environment variable API key management
- Input validation and sanitization
- Request timeout protection
- Error information filtering
- No external dependencies beyond core runtime

## 📋 Error Handling

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using [Bun](https://bun.sh) and [Perplexity AI](https://www.perplexity.ai)**