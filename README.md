# PPLX‑Zero

🚀 **Lightning-fast Perplexity AI in your terminal** — sub‑1s search responses with multimodal support. Built for developers, coding agents, and automation workflows that demand speed and reliability.

Perfect for rapid research, document analysis, image understanding, and batch processing with minimal configuration.

---

## ✨ What Makes PPLX‑Zero Special

- **⚡ Blazing Fast**: Get answers in under a second with optimized API calls
- **🧠 Smart Models**: Choose from Sonar, Sonar‑Pro, Sonar‑Reasoning, and Deep‑Research models
- **📎 Multimodal**: Analyze documents, images, and combinations seamlessly
- **🔄 Auto‑Update**: Stay current with simplified update management
- **⚙️ Developer‑First**: Built for CI/CD, agent pipelines, and programmatic use
- **🎯 Minimal Setup**: One environment variable and you're ready to go

## 📦 Installation

Choose the installation method that works best for you:

### 🚀 Quick Install (Recommended)

```bash
# npm or bun (global)
npm install -g pplx-zero
# or
bun install -g pplx-zero

# Verify installation
pplx --version
```

### 📦 Binary Download (No Node.js required)

```bash
# Download the appropriate binary for your platform
# Linux (x64) - Most servers and desktops
wget https://github.com/codewithkenzo/pplx-zero/releases/latest/download/pplx-v1.1.7-linux-x64
chmod +x pplx-v1.1.7-linux-x64
sudo mv pplx-v1.1.7-linux-x64 /usr/local/bin/pplx

# Linux (ARM64) - Raspberry Pi, ARM servers
wget https://github.com/codewithkenzo/pplx-zero/releases/latest/download/pplx-v1.1.7-linux-arm64
chmod +x pplx-v1.1.7-linux-arm64
sudo mv pplx-v1.1.7-linux-arm64 /usr/local/bin/pplx

# macOS (Intel) - Macs with Intel processors
wget https://github.com/codewithkenzo/pplx-zero/releases/latest/download/pplx-v1.1.7-darwin-x64
chmod +x pplx-v1.1.7-darwin-x64
sudo mv pplx-v1.1.7-darwin-x64 /usr/local/bin/pplx

# macOS (Apple Silicon) - Macs with M1/M2/M3 chips
wget https://github.com/codewithkenzo/pplx-zero/releases/latest/download/pplx-v1.1.7-darwin-arm64
chmod +x pplx-v1.1.7-darwin-arm64
sudo mv pplx-v1.1.7-darwin-arm64 /usr/local/bin/pplx

# Windows (x64) - Most Windows computers
# Download pplx-v1.1.7-windows-x64.exe from GitHub releases
# Add to your PATH or run directly
```

**Alternative Installation Script (Linux/macOS):**

```bash
# Automated installation script
curl -sSL https://github.com/codewithkenzo/pplx-zero/releases/latest/download/pplx-v1.1.7-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/') -o pplx
chmod +x pplx
sudo mv pplx /usr/local/bin/pplx
```

### 🏛️ AUR (Arch Linux)

```bash
# Using yay (recommended)
yay -S pplx-zero

# Using paru
paru -S pplx-zero

# Verify installation
pplx --version
```

### 🔧 Build from Source

```bash
# 1) Clone the repository
git clone https://github.com/codewithkenzo/pplx-zero.git
cd pplx-zero

# 2) Install dependencies and build
bun install && bun run build

# 3) Link the CLI (system-wide)
sudo ln -s "$(pwd)/dist/index.js" /usr/local/bin/pplx

# 4) Verify installation
pplx --version
```

---

## ⚙️ Configuration

### API Key Setup

Set your Perplexity API key as an environment variable:

**Linux/macOS:**
```bash
# Temporary (current session)
export PERPLEXITY_API_KEY="your-api-key"

# Permanent (add to ~/.bashrc, ~/.zshrc, etc.)
echo 'export PERPLEXITY_API_KEY="your-api-key"' >> ~/.bashrc
source ~/.bashrc
```

**Windows (PowerShell):**
```powershell
# Temporary (current session)
$env:PERPLEXITY_API_KEY = "your-api-key"

# Permanent
[Environment]::SetEnvironmentVariable("PERPLEXITY_API_KEY", "your-api-key", "User")
```

**Windows (CMD):**
```cmd
# Permanent
setx PERPLEXITY_API_KEY "your-api-key"
```

> 🔑 **Get your API key** from your [Perplexity account settings](https://www.perplexity.ai/settings/api) and keep it secure. Never share your API key or commit it to version control.

---

## 🔄 Auto‑Update Management

PPLX‑Zero includes a simplified auto‑update system that keeps you current with the latest features and security updates.

### Basic Update Commands

```bash
# Check for available updates
pplx update --check

# Install updates and relaunch automatically
pplx update --auto
```

### Update Workflow

1. **Automatic Notifications**: PPLX‑Zero checks for updates once per day and notifies you when a new version is available
2. **Smart Installation**: The updater detects your installation method (npm, AUR, binary) and uses the appropriate update mechanism
3. **Seamless Relaunch**: When using `--auto`, PPLX‑Zero installs the update and relaunches with your original command

### Advanced Update Options

```bash
# Force update check (ignores cache)
pplx update --check

# Update during automation without interaction
pplx update --auto --quiet
```

### Troubleshooting Updates

| Issue | Solution |
|-------|----------|
| **Permission denied** | Run with `sudo` or check installation directory permissions |
| **Network timeout** | Check internet connection and try again |
| **Update fails** | Manually install using your original installation method |
| **Lock file error** | Wait for current update to complete or manually remove `~/.pplx-zero/.updating.lock` |

The auto‑update system respects your system configuration and won't modify files without proper permissions.

---

## 🚀 Quick Examples

### Basic Search

```bash
# Simple search (default model: sonar)
pplx "python type hints best practices"

# Multiple queries in one command
pplx "React hooks tutorial" "TypeScript generics" "Docker best practices"
```

### Advanced Models

```bash
# Research with Sonar Pro (more detailed analysis)
pplx -m sonar-pro "React 19 Hooks new features"

# Deep research with comprehensive web context
pplx -m sonar-deep-research "best Rust web frameworks 2025"

# Mathematical reasoning and proofs
pplx -m sonar-reasoning "prove this algorithm runs in O(n log n)"
```

### Document & Image Analysis

```bash
# Summarize a PDF report quickly
pplx -f report.pdf "summarize key findings and risks"

# Understand an interface from a screenshot
pplx -i screenshot.png "what is this UI and what are the next steps?"

# Combine multiple files in one analysis
pplx -f data.csv -i chart.png "spot anomalies and explain the chart"

# Multiple file attachments
pplx -f report.pdf --attach data.csv --attach summary.md "analyze all documents"

# Multiple documents of same type using --attach
pplx --attach doc1.pdf --attach doc2.pdf --attach doc3.txt "compare all reports"

# Multiple images using --attach-image
pplx --attach-image screenshot1.png --attach-image screenshot2.png "analyze the UI flow"

# Mixed multiple files (documents + images)
pplx -f main.pdf --attach appendix.md --attach-image chart.png --attach-image diagram.jpg "comprehensive analysis"

# Multiple files with positional arguments (all treated as files)
pplx file1.pdf file2.txt file3.md "what's in these files"
```

### Batch Processing

```bash
# Stream newline-delimited JSON for agents or UNIX pipes
pplx -o jsonl "AI trends"

# Batch from a JSON file with custom concurrency
pplx -I queries.json -o jsonl -c 5 -t 30000
```

**Batch JSON format:**
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

### Advanced Workflows

```bash
# Fire-and-forget async with webhook callback
pplx --async --webhook http://localhost:3000/callback "long research task"

# Export results to file
pplx --export results.json "machine learning trends"

# Search with custom result limits
pplx -n 10 "latest web development frameworks"

# Query from stdin (for pipelines)
echo '{"query": "best practices for API design"}' | pplx -s
```

### Real‑World Scenarios

```bash
# Security researcher: Analyze vulnerability report
pplx -f vuln_report.pdf --attach screenshots/ "explain security implications"

# Data analyst: Extract insights from datasets
pplx -f sales_data.csv -i revenue_chart.png "identify growth opportunities"

# Developer: Code review and optimization
pplx -f app.py --attach perf_metrics.json "suggest performance improvements"

# Product manager: Competitive analysis
pplx -f competitor_data.pdf "summarize key differentiators and market position"
```


---

## 📋 Command Reference

### Main Options

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--model` | `-m` | AI model to use | `-m sonar-pro` |
| `--max-results` | `-n` | Max results per query (1-20) | `-n 10` |
| `--file` | `-f` | Attach document for analysis | `-f report.pdf` |
| `--image` | `-i` | Attach image for analysis | `-i screenshot.png` |
| `--format` | `-o` | Output format: json/jsonl | `-o jsonl` |
| `--query` | `-q` | Search query (alternative to positional) | `-q "search term"` |
| `--export` | | Export results to file | `--export results.json` |
| `--input` | `-I` | Read queries from JSON file | `-I batch.json` |
| `--stdin` | `-s` | Read queries from stdin | `cat query.json \| pplx -s` |
| `--attach` | | Additional file attachments | `--attach file1.pdf --attach file2.txt` |
| `--attach-image` | | Additional image attachments | `--attach-image img1.png --attach-image img2.jpg` |
| `--async` | | Enable async mode for advanced models | `--async` |
| `--webhook` | | Webhook URL for async results | `--webhook http://localhost:3000` |
| `--workspace` | | Workspace directory for file operations | `--workspace ./project` |
| `--use-search-api` | | Use search API (default: true) | `--use-search-api` |
| `--batch-size` | | Batch size for processing (1-100) | `--batch-size 50` |

### Performance & Control

| Flag | Description | Default | Range |
|------|-------------|---------|-------|
| `--concurrency` | Max parallel requests for batch operations | 5 | 1-20 |
| `--timeout` | Request timeout in milliseconds | 30000 | 1000-300000 |

### Utility Commands

| Command | Description | Example |
|---------|-------------|---------|
| `update --check` | Check for available updates | `pplx update --check` |
| `update --auto` | Install updates and relaunch | `pplx update --auto` |
| `history [limit]` | Show search history | `pplx history 10` |
| `version` | Show version information | `pplx version` |
| `--help` | Show help message | `pplx --help` |
| `--version` | Show version number | `pplx --version` |

### Supported File Formats

**Documents (up to 50MB):**
- PDF, DOC, DOCX, TXT, RTF, MD
- CSV, JSON (structured data)
- XML, YAML (configuration files)

**Images (up to 50MB):**
- PNG, JPEG, WebP, HEIF/HEIC, GIF
- BMP, TIFF (legacy formats)

### AI Models

| Model | Best For | Speed | Detail |
|-------|----------|-------|--------|
| `sonar` | Quick answers, general queries | ⚡ Fast | Standard detail |
| `sonar-pro` | Detailed analysis, research | 🚀 Fast | Enhanced detail |
| `sonar-reasoning` | Mathematical reasoning, logic | 🐢 Moderate | Step-by-step |
| `sonar-deep-research` | Comprehensive research with web context | 🐌 Slow | Maximum detail |

---

## 💻 Programmatic Use

### TypeScript API

Use the toolkit directly in TypeScript when embedding into agents or services.

```ts
import { PerplexitySearchTool } from 'pplx-zero';

// Initialize the search tool
const tool = new PerplexitySearchTool();

// Single search query
const result = await tool.search({
  query: "TypeScript best practices",
  model: "sonar-pro",
  maxResults: 5
});

console.log(result);
```

### Batch Processing

```ts
import { PerplexitySearchTool } from 'pplx-zero';

const tool = new PerplexitySearchTool();

// Batch search with custom configuration
const batchResult = await tool.runBatch({
  version: "1.0.0",
  requests: [
    {
      op: "search",
      args: {
        query: "TypeScript best practices",
        maxResults: 5,
        model: "sonar-pro"
      }
    },
    {
      op: "search",
      args: {
        query: "React performance optimization",
        maxResults: 3,
        model: "sonar"
      }
    }
  ],
  options: {
    concurrency: 3,
    timeoutMs: 30000
  }
});

console.log('Batch results:', batchResult);
```

### Advanced Usage with Error Handling

```ts
import { PerplexitySearchTool } from 'pplx-zero';

async function searchWithRetry(query: string, maxRetries = 3) {
  const tool = new PerplexitySearchTool();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await tool.search({
        query,
        model: "sonar-pro",
        maxResults: 5
      });

      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Search failed after ${maxRetries} attempts: ${error}`);
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Usage
searchWithRetry("latest AI trends")
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### API Key Problems
```bash
# Error: "API key not found"
export PERPLEXITY_API_KEY="your-api-key"

# Verify key is set
echo $PERPLEXITY_API_KEY
```

#### File Attachment Issues
```bash
# Error: "File too large" (files must be < 50MB)
ls -lh your-file.pdf

# Supported formats check
file your-document.pdf  # Should show PDF format
```

#### Network/Timeout Issues
```bash
# Increase timeout for complex queries
pplx -t 60000 "complex research question"

# Check internet connectivity
curl -I https://api.perplexity.ai
```

#### Permission Issues
```bash
# Permission denied during installation
npm install -g pplx-zero --unsafe-perm

# Or use npx to avoid global installation
npx pplx-zero "your query"
```

### Debug Mode

```bash
# Enable verbose output for debugging
DEBUG=pplx:* pplx "your query"

# Check configuration
pplx --version
pplx update --check
```

### Performance Tips

| Scenario | Recommended Settings |
|----------|---------------------|
| **Quick searches** | Default settings (sonar model) |
| **Deep research** | `-m sonar-deep-research -t 60000` |
| **Batch processing** | `-c 10 -t 45000` |
| **File analysis** | `-m sonar-pro -t 60000` |
| **Real-time queries** | `-m sonar -n 3` |

---

## 📚 Additional Resources

- **GitHub Repository**: [github.com/codewithkenzo/pplx-zero](https://github.com/codewithkenzo/pplx-zero)
- **Bug Reports & Issues**: [GitHub Issues](https://github.com/codewithkenzo/pplx-zero/issues)
- **Perplexity API Documentation**: [docs.perplexity.ai](https://docs.perplexity.ai)
- **Model Comparison**: Detailed model comparison in the [AI Models](#ai-models) section above

---

### Quick Reference Commands

```bash
# Show all available options
pplx --help

# Check for updates
pplx update --check

# Auto-update
pplx update --auto

# Show version
pplx --version

# Search history
pplx history 10

# Quick test
pplx "test query"
```

---

*Built with ❤️ using [Bun](https://bun.sh) and powered by [Perplexity AI](https://www.perplexity.ai)*
