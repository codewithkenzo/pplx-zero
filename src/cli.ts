#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { PerplexitySearchTool } from './index.js';
import { type EventV1, type BatchSearchInputV1 } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliOptions {
  input?: string;
  stdin?: boolean;
  concurrency?: string;
  timeout?: string;
  workspace?: string;
  format?: string;
  version?: boolean;
  help?: boolean;
  model?: string;
  attach?: string[];
  'attach-image'?: string[];
  async?: boolean;
  webhook?: string;
}

interface ParsedArgs {
  values: CliOptions;
  positionals: string[];
}

const { values: cliOptions, positionals: commandLineQueries }: ParsedArgs = parseArgs({
  args: process.argv.slice(2),
  options: {
    input: { type: 'string', short: 'i' },
    stdin: { type: 'boolean', short: 's' },
    concurrency: { type: 'string', short: 'c' },
    timeout: { type: 'string', short: 't' },
    workspace: { type: 'string', short: 'w' },
    format: { type: 'string', short: 'f', default: 'json' },
    version: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
    model: { type: 'string', short: 'm' },
    attach: { type: 'string', multiple: true },
    'attach-image': { type: 'string', multiple: true },
    async: { type: 'boolean' },
    webhook: { type: 'string' },
  },
  allowPositionals: true,
}) as ParsedArgs;

if (cliOptions.help) {
  console.error(`
PPLX-Zero - Minimal, fast Perplexity AI search CLI with multimodal support

USAGE:
  pplx [OPTIONS] [QUERY...]

OPTIONS:
  -i, --input <file>              Read batch requests from JSON file
  -s, --stdin                     Read JSONL requests from stdin
  -c, --concurrency <n>          Max concurrent requests (default: 5)
  -t, --timeout <ms>              Request timeout in milliseconds (default: 30000)
  -w, --workspace <path>          Workspace directory for sandboxing
  -f, --format <format>           Output format: json|jsonl (default: json)
  -m, --model <model>             AI model: sonar, sonar-pro, sonar-deep-research, sonar-reasoning (default: sonar)
  --attach <file>                 Attach document files (PDF, DOC, DOCX, TXT, RTF) - can be used multiple times
  --attach-image <file>           Attach image files (PNG, JPEG, WebP, HEIF, HEIC, GIF) - can be used multiple times
  --async                         Process requests asynchronously
  --webhook <url>                 Webhook URL for async notifications
  -v, --version                   Show version
  -h, --help                      Show this help

EXAMPLES:
  # Basic query
  pplx "latest AI developments"

  # Model selection
  pplx --model sonar-pro "Detailed analysis"
  pplx --model sonar-deep-research "Comprehensive research"
  pplx --model sonar-reasoning "Complex problem solving"

  # Image analysis
  pplx --attach-image screenshot.png --model sonar-pro "Analyze this interface"

  # Document analysis
  pplx --attach report.pdf --model sonar-deep-research "Summarize this document"

  # Multimodal analysis
  pplx --attach document.txt --attach-image chart.png --model sonar-reasoning "Analyze this data"

  # Async processing with webhook
  pplx --async --webhook https://api.example.com/callback "Long research task"

  # Batch from file
  pplx --input queries.json

  # Streaming from stdin
  cat queries.jsonl | pplx --stdin

  # JSONL output for streaming
  pplx --format jsonl --input queries.json

  # High concurrency batch with attachments
  pplx --concurrency 10 --timeout 60000 --input queries.json --attach appendix.pdf

SUPPORTED FORMATS:
  Images: PNG, JPEG, WebP, HEIF, HEIC, GIF (max 50MB, 10 files)
  Documents: PDF, DOC, DOCX, TXT, RTF (max 50MB, 10 files)
`);
  process.exit(0);
}

if (cliOptions.version) {
  const packageInfo = await import('../package.json', { assert: { type: 'json' } });
  console.error(`pplx v${packageInfo.default.version}`);
  process.exit(0);
}

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

const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 20;
const MIN_TIMEOUT = 1000;
const MAX_TIMEOUT = 300000;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TIMEOUT = 30000;

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

async function main(): Promise<void> {
  const executionStartTime = Date.now();

  try {
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

    if (!['json', 'jsonl'].includes(outputFormat)) {
      throw new Error('Format must be json or jsonl');
    }

    // Validate model if provided
  let selectedModel: string | undefined;
  if (cliOptions.model) {
    const validModels = ['sonar', 'sonar-pro', 'sonar-deep-research', 'sonar-reasoning'];
    if (!validModels.includes(cliOptions.model)) {
      throw new Error(`Invalid model: ${cliOptions.model}. Valid models: ${validModels.join(', ')}`);
    }
    selectedModel = cliOptions.model;
  }

  const searchTool = new PerplexitySearchTool(workspaceDirectory, {
    defaultModel: selectedModel as any,
  });

  logEvent({
    time: new Date().toISOString(),
    level: 'info',
    event: 'tool_initialized',
    data: {
      concurrency: maxConcurrency,
      timeout: requestTimeout,
      workspace: workspaceDirectory,
      format: outputFormat,
      model: selectedModel,
      async: cliOptions.async,
      webhook: cliOptions.webhook,
      hasAttachments: (cliOptions.attach?.length || 0) + (cliOptions['attach-image']?.length || 0) > 0
    }
  });

    let batchSearchInput: BatchSearchInputV1;
    let inputSourceType: string;

    if (cliOptions.stdin) {
      batchSearchInput = await readJsonlFromStdin();
      inputSourceType = 'stdin';
    } else if (cliOptions.input) {
      batchSearchInput = await readJsonFile(cliOptions.input) as BatchSearchInputV1;
      inputSourceType = cliOptions.input;
    } else if (commandLineQueries.length > 0) {
      const combinedQuery = commandLineQueries.join(' ');

      // Build attachment inputs from CLI options
      const attachmentInputs: any[] = [];

      // Process document attachments
      if (cliOptions.attach && cliOptions.attach.length > 0) {
        for (const filePath of cliOptions.attach) {
          attachmentInputs.push({
            path: filePath,
            type: 'document',
          });
        }
      }

      // Process image attachments
      if (cliOptions['attach-image'] && cliOptions['attach-image'].length > 0) {
        for (const filePath of cliOptions['attach-image']) {
          attachmentInputs.push({
            path: filePath,
            type: 'image',
          });
        }
      }

      batchSearchInput = {
        version: '1.0.0',
        requests: [{
          op: 'search',
          args: {
            query: combinedQuery,
            maxResults: 5,
            model: selectedModel as any,
            attachmentInputs: attachmentInputs.length > 0 ? attachmentInputs : undefined,
          },
          options: {
            timeoutMs: requestTimeout,
            async: cliOptions.async,
            webhook: cliOptions.webhook,
          }
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

    batchSearchInput.options = {
      concurrency: maxConcurrency,
      timeoutMs: requestTimeout,
      workspace: workspaceDirectory,
      failFast: false,
      ...batchSearchInput.options,
    };

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

    if (outputFormat === 'jsonl') {
      for (const searchResult of searchResults.results) {
        console.log(JSON.stringify(searchResult));
      }
    } else {
      console.log(JSON.stringify(searchResults, null, 2));
    }

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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
