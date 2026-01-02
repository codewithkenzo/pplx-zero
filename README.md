# pplx-zero

Minimal Perplexity AI CLI - search from terminal.

## Installation

```bash
bun install -g pplx-zero
```

Or with npm:

```bash
npm install -g pplx-zero
```

## Setup

```bash
export PERPLEXITY_API_KEY="your-api-key"
```

## Usage

```bash
pplx "what is bun"
pplx -m sonar-pro "explain quantum computing"
pplx -m sonar-deep-research "comprehensive analysis of AI trends"
pplx -f report.pdf "summarize this document"
pplx -i screenshot.png "what's in this image"
pplx --json "get structured response"
```

## Options

| Flag | Description |
|------|-------------|
| `-m, --model` | Model: sonar, sonar-pro, sonar-reasoning, sonar-reasoning-pro, sonar-deep-research |
| `-f, --file` | Attach a file (PDF, TXT, etc.) |
| `-i, --image` | Attach an image (PNG, JPG, etc.) |
| `--json` | Output as JSON |
| `-h, --help` | Show help |

## License

MIT
