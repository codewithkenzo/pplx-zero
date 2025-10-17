# PPLX‑Zero

Use the Perplexity API straight from the terminal — sub‑1s search API, ideal for coding agents and automation.
Minimal setup, fast results, and practical flags for files, images, streaming, and batch workflows.

### What you can do
- Ask, research, and stream answers instantly from the CLI with sensible defaults for rapid iteration.
- Summarize documents and analyze images using a single command with optional model control.
- Run batch jobs with concurrency and timeouts for agent pipelines and CI flows.

### Install
Choose one:

```bash
# npm or bun (global)
npm install -g pplx-zero
pplx --version
```


or

```bash
# AUR (Arch Linux)
yay -S pplx-zero
pplx --version
```


or

```bash
# Build from source
# 1) clone the repository
# 2) enter the folder
# 3) build and link the CLI
bun install && bun run build
sudo ln -s "$(pwd)/dist/cli.js" /usr/local/bin/pplx
pplx --version
```


### Configure
Set your API key as an environment variable before running commands.

Linux/macOS:
```bash
export PERPLEXITY_API_KEY="your-api-key"
```


Windows:
```cmd
setx PERPLEXITY_API_KEY "your-api-key"
```


Get your key from your Perplexity account and keep it private to your machine or CI secrets manager.

### Quick examples
Simple search (default model: sonar)
```bash
pplx "python type hints best practices"
```


Deep research or sonar-pro or reasoning when you need more steps or web context
```bash
pplx -m sonar-pro "React 19 Hooks"
pplx -m sonar-deep-research "best Rust web frameworks 2025"
pplx -m sonar-reasoning "prove this algorithm runs in O(n log n)"
```


Summarize a PDF report quickly
```bash
pplx -f report.pdf "summarize key findings and risks"
```


Understand an interface from a screenshot
```bash
pplx -i screenshot.png "what is this UI and what are the next steps?"
```


Combine a doc and an image in one prompt
```bash
pplx -f data.csv -i chart.png "spot anomalies and explain the chart"
```


Stream newline‑delimited JSON for agents or UNIX pipes
```bash
pplx -o jsonl "ai trends"
```


Batch from a JSON file (concurrency and timeout shown)
```json
{
  "version": "1.0.0",
  "requests": [
    { "op": "search", "args": { "query": "AI trends", "maxResults": 5 } },
    { "op": "search", "args": { "query": "TypeScript patterns", "maxResults": 3 } }
  ],
  "options": { "concurrency": 5, "timeoutMs": 30000 }
}
```


```bash
pplx -I queries.json -o jsonl -c 5 -t 30000
```


Fire‑and‑forget async with a webhook callback (agent workflows)
```bash
pplx --async --webhook http://localhost:3000/callback "long research task"
```


### Flags
- -m, --model: sonar | sonar-pro | sonar-deep-research | sonar-reasoning (default: sonar) 
- -f, --file: attach a document (PDF, DOC, DOCX, TXT, RTF, MD; up to ~50MB)
- -i, --image: attach an image (PNG, JPEG, WebP, HEIF/HEIC, GIF; up to ~50MB)
- -o, --format: json | jsonl (default: json) 
- -I, --input: read batch requests from a JSON file
- -c, --concurrency: max parallel requests, e.g., 5 (default: 5)
- -t, --timeout: request timeout in ms, e.g., 30000 (default: 30000)
- --async: process requests asynchronously
- --webhook: URL receiving async notifications
- -h, --help: show help
- -v, --version: show version

### Programmatic use (optional)
Use the toolkit directly in TypeScript when embedding into agents or services.
```ts
import { PerplexitySearchTool } from 'pplx-zero';

const tool = new PerplexitySearchTool();

const result = await tool.runBatch({
  version: "1.0.0",
  requests: [{ op: "search", args: { query: "TypeScript best practices", maxResults: 5 } }]
});

console.log(result);
```


### Notes
- Use pplx --help to see all available options and short flags without scanning long docs.
- Keep output in jsonl for streaming pipelines and agent frameworks that consume line‑by‑line events.*Built with [Bun](https://bun.sh) and [Perplexity AI](https://www.perplexity.ai)**
