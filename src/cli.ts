#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { PerplexitySearchTool } from './index.js';
import { type EventV1, type BatchSearchInputV1 } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse CLI arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    input: { type: 'string', short: 'i' },
    stdin: { type: 'boolean', short: 's' },
    concurrency: { type: 'string', short: 'c' },
    timeout: { type: 'string', short: 't' },
    workspace: { type: 'string', short: 'w' },
    format: { type: 'string', short: 'f', default: 'json' },
    'dry-run': { type: 'boolean', short: 'd' },
    version: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

// Show help
if (values.help) {
  console.error(`
Perplexity Search Tool

USAGE:
  pplx [OPTIONS] [QUERY...]

OPTIONS:
  -i, --input <file>     Read batch requests from JSON file
  -s, --stdin            Read JSONL requests from stdin
  -c, --concurrency <n>  Max concurrent requests (default: 5)
  -t, --timeout <ms>     Request timeout in milliseconds (default: 30000)
  -w, --workspace <path> Workspace directory for sandboxing
  -f, --format <format>  Output format: json|jsonl (default: json)
  -d, --dry-run          Validate input without executing searches
  -v, --version          Show version
  -h, --help             Show this help

EXAMPLES:
  # Single query
  pplx "latest AI developments"

  # Batch from file
  pplx --input queries.json

  # Streaming from stdin
  cat queries.jsonl | pplx --stdin

  # JSONL output for streaming
  pplx --format jsonl --input queries.json

  # High concurrency batch
  pplx --concurrency 10 --timeout 60000 --input queries.json
`);
  process.exit(0);
}

// Show version
if (values.version) {
  const packageJson = await import('../package.json', { assert: { type: 'json' } });
  console.error(`pplx v${packageJson.default.version}`);
  process.exit(0);
}

// Utility functions
function logEvent(event: EventV1): void {
  console.error(JSON.stringify(event));
}

async function readJsonFile(filePath: string): Promise<any> {
  try {
    const content = await Bun.file(filePath).text();
    return JSON.parse(content);
  } catch (error) {
    logEvent({
      time: new Date().toISOString(),
      level: 'error',
      event: 'file_read_error',
      data: { file: filePath, error: error instanceof Error ? error.message : String(error) }
    });
    throw error;
  }
}

async function readJsonlFromStdin(): Promise<BatchSearchInputV1> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const requests = [];
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const request = JSON.parse(trimmed);
      requests.push(request);
    } catch (error) {
      logEvent({
        time: new Date().toISOString(),
        level: 'error',
        event: 'jsonl_parse_error',
        data: { line: lineNumber, content: trimmed, error: error instanceof Error ? error.message : String(error) }
      });
      throw new Error(`Invalid JSON on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    version: '1.0.0',
    requests,
  };
}

// Main execution
async function main(): Promise<void> {
  const startTime = Date.now();
  
  try {
    const concurrency = values.concurrency ? parseInt(values.concurrency) : 5;
    const timeout = values.timeout ? parseInt(values.timeout) : 30000;
    const workspace = values.workspace;
    const format = values.format as 'json' | 'jsonl';
    const isDryRun = values['dry-run'];

    // Validate arguments
    if (concurrency < 1 || concurrency > 20) {
      throw new Error('Concurrency must be between 1 and 20');
    }
    if (timeout < 1000 || timeout > 300000) {
      throw new Error('Timeout must be between 1000ms and 300000ms (5 minutes)');
    }
    if (!['json', 'jsonl'].includes(format)) {
      throw new Error('Format must be json or jsonl');
    }

    // Initialize tool
    const tool = new PerplexitySearchTool(workspace);
    
    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'tool_initialized',
      data: { concurrency, timeout, workspace, format, dryRun: isDryRun }
    });

    let batchInput: BatchSearchInputV1;
    let inputSource: string;

    // Determine input source
    if (values.stdin) {
      batchInput = await readJsonlFromStdin();
      inputSource = 'stdin';
    } else if (values.input) {
      batchInput = await readJsonFile(values.input);
      inputSource = values.input;
    } else if (positionals.length > 0) {
      // Single query from command line
      batchInput = {
        version: '1.0.0',
        requests: [{
          op: 'search',
          args: {
            query: positionals.join(' '),
            maxResults: 5,
          },
        }],
      };
      inputSource = 'cli';
    } else {
      throw new Error('No input provided. Use --help for usage information.');
    }

    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'input_loaded',
      data: { source: inputSource, requestCount: batchInput.requests?.length || 1 }
    });

    // Add global options to batch input
    batchInput.options = {
      concurrency,
      timeoutMs: timeout,
      workspace,
      failFast: false,
      ...batchInput.options,
    };

    if (isDryRun) {
      logEvent({
        time: new Date().toISOString(),
        level: 'info',
        event: 'dry_run_completed',
        data: { requestCount: batchInput.requests?.length || 1 }
      });
      
      console.log(JSON.stringify({
        ok: true,
        message: 'Dry run completed - input validation passed',
        requestCount: batchInput.requests?.length || 1,
        inputSource,
      }, null, 2));
      return;
    }

    // Execute search
    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'search_started',
      data: { requestCount: batchInput.requests?.length || 1 }
    });

    const result = await tool.runBatch(batchInput);

    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'search_completed',
      data: {
        totalDuration: result.summary.totalDuration,
        successful: result.summary.successful,
        failed: result.summary.failed,
      }
    });

    // Output results
    if (format === 'jsonl') {
      // Output each result as a separate JSON line
      for (const searchResult of result.results) {
        console.log(JSON.stringify(searchResult));
      }
    } else {
      // Output as a single JSON object
      console.log(JSON.stringify(result, null, 2));
    }

    // Exit with appropriate code
    process.exit(result.ok ? 0 : 1);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logEvent({
      time: new Date().toISOString(),
      level: 'error',
      event: 'execution_failed',
      data: {
        error: error instanceof Error ? error.message : String(error),
        duration,
      }
    });

    // Output error envelope
    console.log(JSON.stringify({
      ok: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined,
      },
      duration,
    }, null, 2));

    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  logEvent({
    time: new Date().toISOString(),
    level: 'info',
    event: 'termination_signal',
    data: { signal: 'SIGINT' }
  });
  process.exit(130);
});

process.on('SIGTERM', () => {
  logEvent({
    time: new Date().toISOString(),
    level: 'info',
    event: 'termination_signal',
    data: { signal: 'SIGTERM' }
  });
  process.exit(143);
});

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
