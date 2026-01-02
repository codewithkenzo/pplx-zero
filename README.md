# pplx-zero

[![npm version](https://img.shields.io/npm/v/pplx-zero.svg)](https://www.npmjs.com/package/pplx-zero)
[![AUR version](https://img.shields.io/aur/version/pplx-zero)](https://aur.archlinux.org/packages/pplx-zero)
![Bun](https://img.shields.io/badge/runtime-bun-f9f1e1)
![License](https://img.shields.io/badge/license-MIT-blue)

Search the web with AI from your terminal. Zero bloat, maximum speed.

```bash
pplx "what is bun"
```

## Why pplx-zero?

- **Fast** — Bun-native, streams responses as they arrive
- **Minimal** — ~400 lines of code, one dependency (zod)
- **Powerful** — 5 models including deep research, file & image support
- **Conversational** — Continue previous queries with `-c`
- **Unix-friendly** — Pipes, JSON output, history, exit codes done right

## Installation

```bash
# Bun (recommended)
bun install -g pplx-zero

# npm (requires bun installed)
npm install -g pplx-zero

# Arch Linux
yay -S pplx-zero
```

## Setup

Get your API key from [Perplexity Settings](https://www.perplexity.ai/settings/api).

```bash
export PERPLEXITY_API_KEY="pplx-..."
```

## Usage

```bash
# Quick search
pplx "best practices for error handling in typescript"

# Use a more powerful model
pplx -m sonar-pro "explain quantum entanglement simply"

# Deep research mode (takes longer, more comprehensive)
pplx -m sonar-deep-research "comprehensive analysis of AI regulation in 2024"

# Analyze a document
pplx -f report.pdf "summarize the key findings"

# Describe an image
pplx -i screenshot.png "what's happening in this image"

# Continue a conversation
pplx "what is rust"
pplx -c "how does it compare to go?"
pplx -c "which should I learn first?"

# Save research to markdown
pplx -m sonar-deep-research "AI trends 2025" -o research.md

# Get JSON output for scripting
pplx --json "capital of france" | jq .answer

# View query history
pplx --history

# Search without saving to history
pplx --no-history "sensitive query"
```

## Models

| Model | Best For |
|-------|----------|
| `sonar` | Quick answers (default) |
| `sonar-pro` | Complex questions |
| `sonar-reasoning` | Step-by-step thinking |
| `sonar-reasoning-pro` | Advanced reasoning |
| `sonar-deep-research` | Comprehensive research |

## Options

| Flag | Description |
|------|-------------|
| `-m, --model <name>` | Select model |
| `-f, --file <path>` | Attach document (PDF, TXT, MD, etc.) |
| `-i, --image <path>` | Attach image (PNG, JPG, WebP, etc.) |
| `-o, --output <path>` | Save output to file (.md, .txt) |
| `-c, --continue` | Continue from last query |
| `--history` | Show query history |
| `--no-history` | Don't save query to history |
| `--json` | Output as JSON |
| `-h, --help` | Show help |

## History & Sessions

pplx-zero keeps a local history of your queries at `~/.pplx/history.jsonl`.

```bash
# View recent queries
pplx --history

# Filter with grep
pplx --history | grep "typescript"

# Continue last conversation
pplx -c "tell me more"

# Skip history for sensitive queries
pplx --no-history "private question"
```

History auto-rotates at 1000 entries to keep the file small.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | API error |
| `2` | Configuration error |

## License

MIT
