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
- **Minimal** — ~300 lines of code, one dependency (zod)
- **Powerful** — 5 models including deep research, file & image support
- **Unix-friendly** — Pipes, JSON output, exit codes done right

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

# Get JSON output for scripting
pplx --json "capital of france" | jq .answer

# Pipe-friendly
echo "explain this error" | pplx
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
| `--json` | Output as JSON |
| `-h, --help` | Show help |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | API error |
| `2` | Configuration error |

## License

MIT
