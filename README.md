# PPLX‑Zero

Perplexity API in your terminal — fast, multimodal search built for developers, agents, and automation workflows.
Run rapid research, document analysis, image understanding, and batch jobs with a single command and one API key.

### What you can do
- Run quick searches and stream results for UNIX pipes and agent frameworks.
- Analyze documents and images together or separately with model selection when needed.
- Process batches with concurrency and timeouts for CI and coding agents.

### Install
```bash
# npm (global)
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
git clone https://github.com/codewithkenzo/pplx-zero.git
cd pplx-zero
bun install && bun run build
sudo ln -s "$(pwd)/dist/cli.js" /usr/local/bin/pplx
pplx --version
```


### Configure
```bash
# Linux/macOS
export PERPLEXITY_API_KEY="your-api-key"
```


```cmd
:: Windows (CMD)
setx PERPLEXITY_API_KEY "your-api-key"
```


### Quick examples
Basic search (default model: sonar)
```bash
pplx "python type hints best practices"
```


Pick a model for depth or reasoning
```bash
pplx -m sonar-pro "React 19 Hooks new features"
pplx -m sonar-deep-research "best Rust web frameworks 2025"
pplx -m sonar-reasoning "prove this algorithm runs in O(n log n)"
```


Document and image analysis
```bash
pplx -f report.pdf "summarize key findings and risks"
pplx -i screenshot.png "what is this UI and next steps?"
pplx -f data.csv -i chart.png "spot anomalies and explain the chart"
```


Stream JSONL for agents and pipelines
```bash
pplx -o jsonl "AI trends"
```


Batch with concurrency and timeout
```bash
pplx -I queries.json -o jsonl -c 5 -t 30000
```


Async + webhook for long tasks
```bash
pplx --async --webhook http://localhost:3000/callback "long research task"
```


### Flags
- -m, --model: sonar | sonar-pro | sonar-deep-research | sonar-reasoning (default: sonar) 
- -f, --file: attach a document (PDF, DOC, DOCX, TXT, RTF, MD; up to ~50MB)
- -i, --image: attach an image (PNG, JPEG, WebP, HEIF/HEIC, GIF; up to ~50MB)
- -o, --format: json | jsonl (default: json) 
- -I, --input: read batch requests from a JSON file
- -c, --concurrency: max parallel requests (default: 5)
- -t, --timeout: request timeout in ms (default: 30000)
- -n, --max-results: limit results per query
- --async, --webhook: asynchronous processing with callback URL
- -h, --help and -v, --version: quick reference and version info

### Programmatic (optional)
```ts
import { PerplexitySearchTool } from 'pplx-zero';

const tool = new PerplexitySearchTool();

const result = await tool.runBatch({
  version: "1.0.0",
  requests: [{ op: "search", args: { query: "TypeScript best practices", maxResults: 5 } }]
});

console.log(result);
```Built with ❤️ using [Bun](https://bun.sh) and powered by [Perplexity AI](https://www.perplexity.ai)*
