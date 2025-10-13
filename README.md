# Perplexity Search Tool

Production-ready TypeScript implementation of Perplexity AI search integration, built with Bun runtime and comprehensive error handling. Features intelligent web scouting capabilities with concurrent batch processing and real-time streaming.

## Features

- **Batch & Single Query Support**: Execute single searches or process multiple queries concurrently
- **Configurable Concurrency**: Control concurrent execution with built-in rate limiting
- **JSONL Streaming**: Real-time progress updates via stderr streaming events
- **Zod Validation**: Strict input/output schema validation with type safety
- **Error Recovery**: Comprehensive error classification and recovery mechanisms
- **Cross-Platform**: Bun runtime with native shell integration
- **Dry Run Mode**: Validate input without executing searches
- **Multiple Output Formats**: JSON and JSONL output support

## Installation

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd perplexity-droid-tool

# Install dependencies
bun install

# Build the tool
bun run build
```

### Global Installation

```bash
# Install globally for system-wide access
npm config set prefix ~/.local
npm install -g .

# Tool is now available as:
pplx --help
```

## Environment Setup

Required environment variables:

```bash
# Primary API key (recommended)
export PERPLEXITY_API_KEY="your-perplexity-api-key"

# Alternative API key (fallback)
export PERPLEXITY_AI_API_KEY="your-alternative-api-key"
```

## Usage

### Command Line Interface

#### Single Query Search

```bash
# Basic single query
pplx "latest AI developments"

# With custom concurrency and timeout
pplx --concurrency 3 --timeout 45000 "machine learning trends"

# JSONL output format
pplx --format jsonl "Python programming"

# Dry run validation
pplx --dry-run "test query"
```

#### Batch Search from File

```bash
# Process multiple queries from JSON file
pplx --input queries.json

# High concurrency batch processing
pplx --input queries.json --concurrency 10 --timeout 60000

# JSONL output for streaming results
pplx --format jsonl --input queries.json
```

#### Streaming from Stdin

```bash
# Process JSONL requests from stdin
cat queries.jsonl | pplx --stdin

# With custom settings
cat queries.jsonl | pplx --stdin --concurrency 5 --format jsonl
```

### Programmatic Usage

```typescript
import { PerplexitySearchTool } from "./src/index.js";

const tool = new PerplexitySearchTool();

// Single query batch input
const singleInput = {
  version: "1.0.0",
  requests: [{
    op: "search",
    args: {
      query: "latest AI trends",
      maxResults: 5,
    },
  }],
  options: {
    concurrency: 5,
    timeoutMs: 30000,
  },
};

const singleResult = await tool.runBatch(singleInput);
console.log(singleResult);

// Multi-query batch input
const multiInput = {
  version: "1.0.0",
  requests: [
    {
      op: "search",
      args: {
        query: "AI trends",
        maxResults: 3,
      },
    },
    {
      op: "search",
      args: {
        query: "machine learning",
        maxResults: 3,
      },
    },
    {
      op: "search",
      args: {
        query: "neural networks",
        maxResults: 3,
      },
    },
  ],
  options: {
    concurrency: 2,
    timeoutMs: 30000,
  },
};

const multiResult = await tool.runBatch(multiInput);
console.log(multiResult);
```

## JSONL Streaming Events

The tool streams real-time events to stderr in JSONL format:

```json
{"type":"start","timestamp":"2024-01-01T12:00:00.000Z","data":{"mode":"single","maxResults":5}}
{"type":"query_start","timestamp":"2024-01-01T12:00:01.000Z","data":{"query":"AI trends","index":0,"total":1}}
{"type":"query_complete","timestamp":"2024-01-01T12:00:02.000Z","data":{"query":"AI trends","index":0,"resultCount":5}}
{"type":"complete","timestamp":"2024-01-01T12:00:02.500Z","data":{"totalQueries":1,"totalResults":5,"executionTime":2500}}
```

Event types:
- `start`: Search operation initiated
- `progress`: General progress updates
- `query_start`: Individual query execution started
- `query_complete`: Individual query completed
- `error`: Error occurred (with recovery details)
- `complete`: All operations finished

## Output Format

### JSON Output (Default)

```json
{
  "success": true,
  "results": [
    {
      "query": "AI trends",
      "results": [
        {
          "title": "Latest AI Developments",
          "url": "https://example.com/ai-trends",
          "snippet": "Recent advances in artificial intelligence...",
          "date": "2024-01-01"
        }
      ]
    }
  ],
  "metadata": {
    "totalQueries": 1,
    "totalResults": 5,
    "executionTime": 2500,
    "mode": "single"
  }
}
```

### Text Output

```
Perplexity Search Results (single mode)
Total queries: 1
Total results: 5
Execution time: 2500ms

Query: AI trends
  Results (5):
    Title: Latest AI Developments
    URL: https://example.com/ai-trends
    Snippet: Recent advances in artificial intelligence...
    Date: 2024-01-01
```

## Error Handling

The tool provides comprehensive error classification:

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

### Error Response Format

```json
{
  "success": false,
  "results": [],
  "error": {
    "code": "API_KEY_MISSING",
    "message": "PERPLEXITY_API_KEY environment variable is required",
    "details": {}
  },
  "metadata": {
    "totalQueries": 0,
    "totalResults": 0,
    "executionTime": 100,
    "mode": "single"
  }
}
```

## Configuration Options

| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `-i, --input` | `string` | - | - | Read batch requests from JSON file |
| `-s, --stdin` | `boolean` | `false` | - | Read JSONL requests from stdin |
| `-c, --concurrency` | `number` | `5` | 1-20 | Max concurrent requests |
| `-t, --timeout` | `number` | `30000` | 1000-300000 | Request timeout in milliseconds |
| `-w, --workspace` | `string` | - | - | Workspace directory for sandboxing |
| `-f, --format` | `json\|jsonl` | `json` | - | Output format |
| `-d, --dry-run` | `boolean` | `false` | - | Validate input without executing searches |
| `-v, --version` | `boolean` | - | - | Show version |
| `-h, --help` | `boolean` | - | - | Show help |

### Batch Input Format

For file-based input, use JSON format:

```json
{
  "version": "1.0.0",
  "requests": [
    {
      "op": "search",
      "args": {
        "query": "AI trends",
        "maxResults": 5
      }
    }
  ],
  "options": {
    "concurrency": 3,
    "timeoutMs": 45000
  }
}
```

## Tool Integration

The tool includes a `.tool-contract.json` file defining the complete interface specification:

- **Input Schema**: Zod-validated configuration structure
- **Output Schema**: Standardized response format with metadata
- **Environment Requirements**: API key configuration
- **Capability Declaration**: Supported features and modes

## Development

```bash
# Development mode
bun run dev

# Type checking
bun run typecheck

# Linting
bun run lint

# Formatting
bun run format

# Testing
bun test
```

## Building

```bash
# Build production executable
bun run build

# The built binary will be available at:
# ./dist/cli.js
```

## Performance Considerations

- **Concurrency Control**: Built-in semaphore pattern prevents API rate limiting
- **Timeout Management**: Configurable timeouts with AbortController cancellation
- **Memory Efficiency**: Streaming events prevent memory accumulation
- **Error Recovery**: Individual query failures don't abort batch operations

## Security Features

- **API Key Protection**: Environment variable based key management
- **Input Validation**: Zod schema validation prevents injection attacks
- **Request Sanitization**: All inputs are validated and sanitized
- **Error Sanitization**: Sensitive information excluded from error outputs

## License

MIT License - see LICENSE file for details.
