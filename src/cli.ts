#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { OptimizedPerplexitySearchEngine, fastSearch, fastMultiSearch } from './core.js';
import type { SearchResult } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptimizedCliOptions {
  // Basic options
  query?: string;
  file?: string;
  image?: string;
  format?: string;
  model?: string;

  // Commands
  version?: boolean;
  help?: boolean;
  'help-advanced'?: boolean;

  // Advanced options
  input?: string;
  stdin?: boolean;
  concurrency?: string;
  timeout?: string;
  workspace?: string;
  attach?: string[];
  'attach-image'?: string[];
  async?: boolean;
  webhook?: string;

  // Performance options
  'use-search-api'?: boolean;
  'max-results'?: string;
  'batch-size'?: string;
}

interface ParsedArgs {
  values: OptimizedCliOptions;
  positionals: string[];
}

const { values: cliOptions, positionals: commandLineQueries }: ParsedArgs = parseArgs({
  args: process.argv.slice(2),
  options: {
    // Basic options
    query: { type: 'string', short: 'q' },
    file: { type: 'string', short: 'f' },
    image: { type: 'string', short: 'i' },
    format: { type: 'string', short: 'o', default: 'json' },
    model: { type: 'string', short: 'm' },

    // Commands
    version: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
    'help-advanced': { type: 'boolean' },

    // Advanced options
    input: { type: 'string', short: 'I' },
    stdin: { type: 'boolean', short: 's' },
    concurrency: { type: 'string', short: 'c' },
    timeout: { type: 'string', short: 't' },
    workspace: { type: 'string', short: 'w' },
    attach: { type: 'string', multiple: true },
    'attach-image': { type: 'string', multiple: true },
    async: { type: 'boolean' },
    webhook: { type: 'string' },

    // Performance options
    'use-search-api': { type: 'boolean', default: true },
    'max-results': { type: 'string', short: 'n', default: '5' },
    'batch-size': { type: 'string', default: '20' },
  },
  allowPositionals: true,
}) as ParsedArgs;

function showHelp() {
  console.error(`
PPLX-Zero - Optimized Perplexity AI search CLI

USAGE:
  pplx-opt [OPTIONS] [QUERY...]

BASIC OPTIONS:
  -q, --query <query>         Search query (fast mode)
  -f, --file <file>           Attach document for analysis
  -i, --image <file>          Attach image for analysis
  -m, --model <model>         AI model: sonar, sonar-pro, sonar-reasoning, sonar-deep-research
  -n, --max-results <n>       Maximum results per query (default: 5)
  -o, --format <format>       Output format: json|jsonl (default: json)

PERFORMANCE OPTIONS:
  --use-search-api             Use fast Search API (default: true)
  --batch-size <n>            Batch size for processing (default: 20)

EXAMPLES:
  # Fast search using Search API (500ms)
  pplx-opt "latest AI developments"

  # Detailed analysis using Chat API (20s)
  pplx-opt --model sonar-pro "Explain quantum computing in detail"

  # Batch searches with optimized performance
  pplx-opt --use-search-api --concurrency 10 "AI trends" "ML breakthroughs"

  # File analysis (requires Chat API)
  pplx-opt --file report.pdf "Summarize this document"

  # Performance comparison
  pplx-opt "test query"        # Search API (fast)
  pplx-opt --model sonar-pro "test query"  # Chat API (slow)

Get your API key: https://www.perplexity.ai/account/api/keys
Set environment variable: export PERPLEXITY_API_KEY="your-key"
`);
  process.exit(0);
}

if (cliOptions.help) {
  showHelp();
}

if (cliOptions.version) {
  const packageInfo = await import('../package.json', { assert: { type: 'json' } });
  console.error(`pplx-opt v${packageInfo.default.version} (Optimized Version)`);
  process.exit(0);
}

function parseNumber(value: string | undefined, defaultValue: number, min: number, max: number, name: string): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function logEvent(level: 'info' | 'error', event: string, data?: any): void {
  console.error(JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    data
  }));
}

async function executeFastSearch(query: string, options: {
  maxResults: number;
  model?: string;
}): Promise<{
  success: boolean;
  results?: SearchResult[];
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const result = await fastSearch(query, {
      maxResults: options.maxResults,
      model: options.model,
    });

    return {
      success: result.success,
      results: result.results,
      executionTime: result.executionTime || performance.now() - startTime,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeBatchSearch(queries: string[], options: {
  maxResults: number;
  concurrency: number;
  model?: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  success: boolean;
  results?: any[];
  totalResults?: number;
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const result = await fastMultiSearch(queries, {
      maxResults: options.maxResults,
      concurrency: options.concurrency,
      model: options.model,
      onProgress: options.onProgress,
    });

    return {
      success: result.success,
      results: result.results,
      totalResults: result.totalResults,
      executionTime: result.executionTime,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const executionStartTime = Date.now();

  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }

    // Parse options
    const maxResults = parseNumber(cliOptions['max-results'], 5, 1, 20, 'Max results');
    const concurrency = parseNumber(cliOptions.concurrency, 5, 1, 20, 'Concurrency');
    const timeout = parseNumber(cliOptions.timeout, 30000, 1000, 300000, 'Timeout');
    const batchSize = parseNumber(cliOptions['batch-size'], 20, 1, 100, 'Batch size');

    const useSearchAPI = cliOptions['use-search-api'] !== false;
    const outputFormat = cliOptions.format as 'json' | 'jsonl';

    if (!['json', 'jsonl'].includes(outputFormat)) {
      throw new Error('Format must be json or jsonl');
    }

    // Validate model
    let selectedModel: string | undefined;
    if (cliOptions.model) {
      const validModels = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-deep-research'];
      if (!validModels.includes(cliOptions.model)) {
        throw new Error(`Invalid model: ${cliOptions.model}. Valid models: ${validModels.join(', ')}`);
      }
      selectedModel = cliOptions.model;
    }

    logEvent('info', 'cli_initialized', {
      useSearchAPI,
      maxResults,
      concurrency,
      timeout,
      batchSize,
      model: selectedModel,
      format: outputFormat,
      hasAttachments: !!(cliOptions.file || cliOptions.image ||
        (cliOptions.attach?.length || 0) + (cliOptions['attach-image']?.length || 0)) > 0
    });

    // Determine execution mode
    let queries: string[] = [];

    if (cliOptions.query) {
      queries = [cliOptions.query];
    } else if (commandLineQueries.length > 0) {
      queries = commandLineQueries;
    } else if (cliOptions.stdin) {
      // Read from stdin
      const readLineInterface = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      for await (const line of readLineInterface) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.query) queries.push(parsed.query);
            if (parsed.queries && Array.isArray(parsed.queries)) {
              queries.push(...parsed.queries);
            }
          } catch {
            // Treat as plain query
            queries.push(trimmed);
          }
        }
      }
    } else if (cliOptions.input) {
      // Read from file
      const fileContent = await Bun.file(cliOptions.input).text();
      const parsed = JSON.parse(fileContent);

      if (parsed.queries && Array.isArray(parsed.queries)) {
        queries = parsed.queries;
      } else if (parsed.requests && Array.isArray(parsed.requests)) {
        queries = parsed.requests.map((req: any) => req.args?.query).filter(Boolean);
      } else if (parsed.query) {
        queries = [parsed.query];
      }
    }

    if (queries.length === 0) {
      throw new Error('No queries provided. Use --help for usage information.');
    }

    logEvent('info', 'queries_loaded', {
      source: cliOptions.stdin ? 'stdin' : cliOptions.input || 'cli',
      queryCount: queries.length
    });

    // Force Chat API mode for attachments or specific models
    const needsChatAPI = !!(cliOptions.file || cliOptions.image ||
      (cliOptions.attach?.length || 0) + (cliOptions['attach-image']?.length || 0) > 0 ||
      selectedModel && ['sonar-reasoning', 'sonar-deep-research'].includes(selectedModel));

    const actualUseSearchAPI = useSearchAPI && !needsChatAPI;

    logEvent('info', 'execution_mode_selected', {
      mode: actualUseSearchAPI ? 'search-api' : 'chat-api',
      reason: needsChatAPI ? 'attachments or advanced model' : 'performance optimization'
    });

    let results: any;

    if (queries.length === 1) {
      // Single query
      results = await executeFastSearch(queries[0], {
        maxResults,
        model: selectedModel,
      });

      const output = {
        version: '1.0.0',
        ok: results.success,
        query: queries[0],
        results: results.results || [],
        executionTime: results.executionTime,
        mode: actualUseSearchAPI ? 'search-api' : 'chat-api',
        error: results.error,
      };

      if (outputFormat === 'jsonl') {
        console.log(JSON.stringify(output));
      } else {
        console.log(JSON.stringify(output, null, 2));
      }

    } else {
      // Multiple queries
      results = await executeBatchSearch(queries, {
        maxResults,
        concurrency,
        model: selectedModel,
        onProgress: (completed, total) => {
          logEvent('info', 'progress', { completed, total });
        }
      });

      const output = {
        version: '1.0.0',
        ok: results.success,
        summary: {
          total: queries.length,
          successful: results.success ? queries.length : 0,
          failed: results.success ? 0 : queries.length,
          totalDuration: results.executionTime,
        },
        results: results.results || [],
        mode: actualUseSearchAPI ? 'search-api' : 'chat-api',
        error: results.error,
      };

      if (outputFormat === 'jsonl') {
        for (const result of output.results || []) {
          console.log(JSON.stringify({
            ...result,
            mode: output.mode,
          }));
        }
      } else {
        console.log(JSON.stringify(output, null, 2));
      }
    }

    const totalDuration = Date.now() - executionStartTime;
    logEvent('info', 'execution_completed', {
      duration: totalDuration,
      success: results.success,
      queryCount: queries.length,
      mode: actualUseSearchAPI ? 'search-api' : 'chat-api'
    });

    process.exit(results.success ? 0 : 1);

  } catch (error) {
    const executionDuration = Date.now() - executionStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logEvent('error', 'execution_failed', {
      error: errorMessage,
      duration: executionDuration,
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorOutput = {
      version: '1.0.0',
      ok: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      duration: executionDuration,
    };

    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logEvent('info', 'termination_signal', { signal: 'SIGINT' });
  process.exit(130);
});

process.on('SIGTERM', () => {
  logEvent('info', 'termination_signal', { signal: 'SIGTERM' });
  process.exit(143);
});

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});