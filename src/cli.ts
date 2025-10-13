#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { PerplexitySearchTool } from './index.js';
import { type EventV1, type BatchSearchInputV1 } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define CLI configuration
interface CliOptions {
  input?: string;
  stdin?: boolean;
  concurrency?: string;
  timeout?: string;
  workspace?: string;
  format?: string;
  'dry-run'?: boolean;
  version?: boolean;
  help?: boolean;
}

interface ParsedArgs {
  values: CliOptions;
  positionals: string[];
}

// Parse CLI arguments
const { values: cliOptions, positionals: commandLineQueries }: ParsedArgs = parseArgs({
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
}) as ParsedArgs;

// Show help
if (cliOptions.help) {
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
if (cliOptions.version) {
  const packageInfo = await import('../package.json', { assert: { type: 'json' } });
  console.error(`pplx v${packageInfo.default.version}`);
  process.exit(0);
}

// Utility functions
function logEvent(event: EventV1): void {
  console.error(JSON.stringify(event));
}

async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const fileContent = await Bun.file(filePath).text();
    return JSON.parse(fileContent);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEvent({
      time: new Date().toISOString(),
      level: 'error',
      event: 'file_read_error',
      data: { file: filePath, error: errorMessage }
    });
    throw error;
  }
}

async function readJsonlFromStdin(): Promise<BatchSearchInputV1> {
  const readLineInterface = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const searchRequests: unknown[] = [];
  let currentLineNumber = 0;

  for await (const line of readLineInterface) {
    currentLineNumber++;
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      const parsedRequest = JSON.parse(trimmedLine);
      searchRequests.push(parsedRequest);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logEvent({
        time: new Date().toISOString(),
        level: 'error',
        event: 'jsonl_parse_error',
        data: { line: currentLineNumber, content: trimmedLine, error: errorMessage }
      });
      throw new Error(`Invalid JSON on line ${currentLineNumber}: ${errorMessage}`);
    }
  }

  return {
    version: '1.0.0',
    requests: searchRequests,
  };
}

// Constants for validation
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 20;
const MIN_TIMEOUT = 1000;
const MAX_TIMEOUT = 300000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT = 30000;

// Validate and parse numeric arguments
function parseNumericArgument(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  name: string
): number {
  if (!value) return defaultValue;

  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue) || parsedValue < min || parsedValue > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }

  return parsedValue;
}

// Main execution
async function main(): Promise<void> {
  const executionStartTime = Date.now();

  try {
    // Parse and validate CLI arguments
    const maxConcurrency = parseNumericArgument(
      cliOptions.concurrency,
      DEFAULT_CONCURRENCY,
      MIN_CONCURRENCY,
      MAX_CONCURRENCY,
      'Concurrency'
    );

    const requestTimeout = parseNumericArgument(
      cliOptions.timeout,
      DEFAULT_TIMEOUT,
      MIN_TIMEOUT,
      MAX_TIMEOUT,
      'Timeout'
    );

    const workspaceDirectory = cliOptions.workspace;
    const outputFormat = cliOptions.format as 'json' | 'jsonl';
    const isDryRunMode = cliOptions['dry-run'];

    // Validate output format
    if (!['json', 'jsonl'].includes(outputFormat)) {
      throw new Error('Format must be json or jsonl');
    }

    // Initialize search tool
    const searchTool = new PerplexitySearchTool(workspaceDirectory);

    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'tool_initialized',
      data: {
        concurrency: maxConcurrency,
        timeout: requestTimeout,
        workspace: workspaceDirectory,
        format: outputFormat,
        dryRun: isDryRunMode
      }
    });

    let batchSearchInput: BatchSearchInputV1;
    let inputSourceType: string;

    // Determine input source
    if (cliOptions.stdin) {
      batchSearchInput = await readJsonlFromStdin();
      inputSourceType = 'stdin';
    } else if (cliOptions.input) {
      batchSearchInput = await readJsonFile(cliOptions.input) as BatchSearchInputV1;
      inputSourceType = cliOptions.input;
    } else if (commandLineQueries.length > 0) {
      // Single query from command line
      const combinedQuery = commandLineQueries.join(' ');
      batchSearchInput = {
        version: '1.0.0',
        requests: [{
          op: 'search',
          args: {
            query: combinedQuery,
            maxResults: 5,
          },
        }],
      };
      inputSourceType = 'cli';
    } else {
      throw new Error('No input provided. Use --help for usage information.');
    }

    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'input_loaded',
      data: {
        source: inputSourceType,
        requestCount: batchSearchInput.requests?.length || 1
      }
    });

    // Merge global options with batch input options
    batchSearchInput.options = {
      concurrency: maxConcurrency,
      timeoutMs: requestTimeout,
      workspace: workspaceDirectory,
      failFast: false,
      ...batchSearchInput.options,
    };

    // Handle dry run mode
    if (isDryRunMode) {
      logEvent({
        time: new Date().toISOString(),
        level: 'info',
        event: 'dry_run_completed',
        data: { requestCount: batchSearchInput.requests?.length || 1 }
      });

      console.log(JSON.stringify({
        ok: true,
        message: 'Dry run completed - input validation passed',
        requestCount: batchSearchInput.requests?.length || 1,
        inputSource: inputSourceType,
      }, null, 2));
      return;
    }

    // Execute search
    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'search_started',
      data: { requestCount: batchSearchInput.requests?.length || 1 }
    });

    const searchResults = await searchTool.runBatch(batchSearchInput);

    logEvent({
      time: new Date().toISOString(),
      level: 'info',
      event: 'search_completed',
      data: {
        totalDuration: searchResults.summary.totalDuration,
        successful: searchResults.summary.successful,
        failed: searchResults.summary.failed,
      }
    });

    // Output results in requested format
    if (outputFormat === 'jsonl') {
      // Output each result as a separate JSON line
      for (const searchResult of searchResults.results) {
        console.log(JSON.stringify(searchResult));
      }
    } else {
      // Output as a single JSON object
      console.log(JSON.stringify(searchResults, null, 2));
    }

    // Exit with appropriate code
    process.exit(searchResults.ok ? 0 : 1);

  } catch (error) {
    const executionDuration = Date.now() - executionStartTime;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? error.stack : undefined;

    logEvent({
      time: new Date().toISOString(),
      level: 'error',
      event: 'execution_failed',
      data: {
        error: errorMessage,
        duration: executionDuration,
      }
    });

    // Output error envelope
    console.log(JSON.stringify({
      ok: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
        details: errorDetails,
      },
      duration: executionDuration,
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
