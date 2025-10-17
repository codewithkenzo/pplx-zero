# PPLX-Zero

> Perplexity API in your terminal — fast, multimodal search built for developers, agents, and automation workflows.

Run rapid research, document analysis, image understanding, and batch jobs with a single command and one API key.

### Key Features
*   Run quick searches and stream results for UNIX pipes and agent frameworks.
*   Analyze documents and images together or separately, with model selection when needed.
*   Process batches with concurrency and timeouts for CI and coding agents.

### Installation

**NPM** (Global)
```bash
npm install -g pplx-zero
pplx --version
```

**AUR** (Arch Linux)
```bash
yay -S pplx-zero
pplx --version
```

**Build from Source**
```bash
git clone https://github.com/codewithkenzo/pplx-zero.git
cd pplx-zero
bun install && bun run build
sudo ln -s "$(pwd)/dist/cli.js" /usr/local/bin/pplx
pplx --version
```

### Configuration
Set your Perplexity API key as an environment variable.

**Linux / macOS**
```bash
export PERPLEXITY_API_KEY="your-api-key"
```

**Windows (CMD)**
```bash
setx PERPLEXITY_API_KEY "your-api-key"
```

### Usage Examples

#### Basic Search
The default model is `sonar`.
```bash
pplx "python type hints best practices"
```

#### Model Selection
Choose a model for more depth or advanced reasoning.
```bash
# Use a more powerful model for a detailed answer
pplx -m sonar-pro "React 19 Hooks new features"

# Use a research-focused model for comprehensive topics
pplx -m sonar-deep-research "best Rust web frameworks 2025"

# Use a reasoning model for logic and algorithms
pplx -m sonar-reasoning "prove this algorithm runs in O(n log n)"
```

#### Document and Image Analysis
Analyze files using the `-f` (file) or `-i` (image) flag.
```bash
# Summarize a PDF report
pplx -f report.pdf "summarize key findings and risks"

# Analyze a UI screenshot
pplx -i screenshot.png "what is this UI and next steps?"

# Combine file and image analysis
pplx -f data.csv -i chart.png "spot anomalies and explain the chart"
```

#### Automation and Pipelines
Handle automated workflows, pipelines, and large jobs.
```bash
# Stream results as JSONL for piping to other tools
pplx -o jsonl "AI trends"

# Process a batch of queries from a JSON file with 5 concurrent requests
pplx -I queries.json -o jsonl -c 5 -t 30000

# Run a long task asynchronously and receive a callback
pplx --async --webhook http://localhost:3000/callback "long research task"
```

### Command-Line Flags

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| `--model` | `-m` | Specify model: `sonar`, `sonar-pro`, `sonar-deep-research`, `sonar-reasoning`. | `sonar` |
| `--file` | `-f` | Attach a document (PDF, DOC, DOCX, TXT, RTF, MD; up to 50MB). | N/A |
| `--image` | `-i` | Attach an image (PNG, JPEG, WebP, HEIF/HEIC, GIF; up to 50MB). | N/A |
| `--format` | `-o` | Set output format: `json` or `jsonl`. | `json` |
| `--input` | `-I` | Read batch requests from a JSON file. | N/A |
| `--concurrency` | `-c` | Set max parallel requests for batch jobs. | `5` |
| `--timeout` | `-t` | Set request timeout in milliseconds. | `30000` |
| `--max-results` | `-n` | Limit results per query. | N/A |
| `--async` | | Enable asynchronous processing. | `false` |
| `--webhook` | | Provide a callback URL for asynchronous requests. | N/A |
| `--help` | `-h` | Display the help menu. | N/A |
| `--version` | `-v` | Show the installed version number. | N/A |

### Programmatic Usage (Optional)
You can also import `pplx-zero` as a tool in your TypeScript/JavaScript projects.

```javascript
import { PerplexitySearchTool } from 'pplx-zero';

const tool = new PerplexitySearchTool();

const result = await tool.runBatch({
  version: "1.0.0",
  requests: [{ 
    op: "search", 
    args: { 
      query: "TypeScript best practices", 
      maxResults: 5 
    } 
  }]
});

console.log(result);
```
