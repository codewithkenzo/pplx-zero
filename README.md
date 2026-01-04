<p align="center">
  <img src="https://raw.githubusercontent.com/codewithkenzo/pplx-zero/main/logo.png" alt="pplx-zero" width="140" />
</p>

<h1 align="center">pplx</h1>

<p align="center">
  <strong>AI search from your terminal. Zero bloat.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/pplx-zero"><img src="https://img.shields.io/npm/v/pplx-zero.svg?color=00d4ff" alt="npm"></a>
  <a href="https://aur.archlinux.org/packages/pplx-zero"><img src="https://img.shields.io/aur/version/pplx-zero?color=00d4ff" alt="AUR"></a>
  <img src="https://img.shields.io/npm/dw/pplx-zero?color=00d4ff&label=downloads" alt="npm downloads">
  <img src="https://img.shields.io/badge/bun-runtime-fbf0df?logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

---

```bash
pplx "what is bun"
```

Query [Perplexity AI](https://perplexity.ai) directly from your terminal. Responses stream in real-time with beautiful markdown formatting.

## Features

- **⚡ Streaming** — Answers appear as they're generated
- **💬 Conversations** — Continue with `-c` for multi-turn
- **📄 Documents** — Analyze PDFs, code, text files
- **🖼️ Images** — Describe screenshots and diagrams
- **📝 Export** — Save research to markdown
- **🎨 Pretty** — Rendered markdown by default
- **🕐 History** — Browse and search past queries
- **🧠 Local RAG** — Index your own notes with `--ingest`

## Install

```bash
bun install -g pplx-zero    # recommended
npm install -g pplx-zero    # requires bun
yay -S pplx-zero            # arch linux
```

## Setup

```bash
export PERPLEXITY_API_KEY="pplx-..."
```

Get your key at [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

## Usage

```bash
# search
pplx "best typescript patterns 2025"

# models
pplx -m sonar-pro "explain transformers"
pplx -m sonar-deep-research "AI regulation analysis"

# conversation
pplx "what is rust"
pplx -c "compare to go"

# files
pplx -f paper.pdf "summarize"
pplx -i diagram.png "explain this"

# export
pplx "topic" -o research.md

# pretty markdown is default
pplx "explain monads"

# raw output (no formatting)
pplx --raw "explain monads"

# history
pplx --history

# local knowledge base
pplx --ingest notes.md           # index a file
pplx --ingest ./docs/             # index a directory
pplx -l "my notes on rust"        # search local knowledge
```

## Models

| Model | Use |
|-------|-----|
| `sonar` | Quick answers |
| `sonar-pro` | Complex questions |
| `sonar-reasoning-pro` | Advanced reasoning |
| `sonar-deep-research` | Research reports |

## Options

| Flag | Description |
|------|-------------|
| `-m` | Model selection |
| `-f` | Attach file |
| `-i` | Attach image |
| `-o` | Output to file |
| `-c` | Continue conversation |
| `-l` | Search local knowledge |
| `--ingest` | Index files to local knowledge |
| `--raw` | Raw output (no markdown) |
| `--history` | View history |
| `--json` | JSON output |

## Philosophy

Minimal. 1 dependency. No frameworks.

---

<p align="center">MIT © <a href="https://github.com/codewithkenzo">kenzo</a></p>
