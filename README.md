# Perplexity Search Tool for OpenCode

Production-ready TypeScript implementation of Perplexity AI search integration for OpenCode, built with Bun runtime and comprehensive error handling.

## Features

- **Dual Search Modes**: Single query and batch multi-query support
- **Bounded Concurrency**: Configurable concurrent execution with order preservation
- **JSONL Streaming**: Real-time progress updates via stderr streaming events
- **Zod Validation**: Strict input/output schema validation with type safety
- **AbortController Support**: Cancellable operations with graceful shutdown
- **Error Recovery**: Comprehensive error classification and recovery mechanisms
- **Cross-Platform**: Bun runtime with native shell integration
- **OpenCode Compatible**: Full tool contract compliance for OpenCode integration

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd perplexity-opencode-tool

# Install dependencies
bun install

# Build the tool
bun run build
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
perplexity-search search -m single -q "latest AI developments"

# With country and result limits
perplexity-search search -m single -q "local news" -c US -r 10

# Text format output
perplexity-search search -m single -q "machine learning" -f text
```

#### Multi-Query Search

```bash
# Multiple queries with comma separation
perplexity-search search -m multi -Q "AI trends, machine learning, neural networks"

# With custom concurrency and timeout
perplexity-search search -m multi -Q "topic1, topic2, topic3" -C 5 -t 60000
```

#### API Key Validation

```bash
# Validate environment API key
perplexity-search validate

# Validate with custom API key
perplexity-search validate -k "your-api-key"
```

### Programmatic Usage

```typescript
import { PerplexitySearchEngine, SearchConfig } from "./src/index.js";

const engine = new PerplexitySearchEngine(process.env.PERPLEXITY_API_KEY!);

// Single query
const singleConfig: SearchConfig = {
  mode: "single",
  query: "latest AI trends",
  maxResults: 5,
  country: "US",
};

const singleResult = await engine.search(singleConfig);
console.log(singleResult);

// Multi-query with concurrency
const multiConfig: SearchConfig = {
  mode: "multi",
  queries: ["AI trends", "machine learning", "neural networks"],
  maxResults: 3,
  concurrency: 2,
  timeout: 30000,
};

const multiResult = await engine.search(multiConfig);
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
| `mode` | `single\|multi` | `single` | - | Search operation mode |
| `query` | `string` | - | - | Single search query (single mode) |
| `queries` | `string[]` | - | 1-50 items | Multiple search queries (multi mode) |
| `maxResults` | `number` | `5` | 1-50 | Maximum results per query |
| `country` | `string` | - | 2-char ISO | Country code for location-based search |
| `concurrency` | `number` | `3` | 1-10 | Concurrent query limit (multi mode) |
| `timeout` | `number` | `30000` | 1000-300000 | Request timeout in milliseconds |

## OpenCode Integration

The tool includes a `.tool-contract.json` file defining the complete interface specification for OpenCode integration:

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
