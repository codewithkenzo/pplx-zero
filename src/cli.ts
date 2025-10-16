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
PPLX-Zero - Perplexity AI search CLI

USAGE:
  pplx [OPTIONS] [QUERY...]

OPTIONS:
  -m, --model <model>         AI model: sonar, sonar-pro, sonar-reasoning, sonar-deep-research
  -n, --max-results <n>       Maximum results per query (default: 5)
  -c, --concurrency <n>       Concurrency for batch searches (default: 5)
  -t, --timeout <ms>           Request timeout in milliseconds (default: 30000)
  -f, --file <file>           Attach document for analysis
  -i, --image <file>          Attach image for analysis
  -o, --format <format>       Output format: json|jsonl (default: json)
  -q, --query <query>         Search query

EXAMPLES:
  pplx "latest AI developments"

  pplx --model sonar-pro "Explain quantum computing"

  pplx --file report.pdf "Summarize this document"

  pplx --image screenshot.png "What is this showing?"

  pplx --concurrency 3 "query 1" "query 2" "query 3"

  pplx --max-results 10 "machine learning trends"

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
  console.error(`pplx v${packageInfo.default.version}`);
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

async function executeChatWithAttachments(
  query: string,
  filePaths: string[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{
  success: boolean;
  content?: string;
  citations?: string[];
  images?: any[];
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Perplexity API key not found in environment variables",
      };
    }

    const engine = new OptimizedPerplexitySearchEngine(apiKey);

    // Process file attachments
    const attachments = await engine['processFileAttachments'](filePaths);

    const result = await engine.executeChatWithAttachments(query, attachments, {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    return {
      success: true,
      content: result.content,
      citations: result.citations,
      images: result.images,
      executionTime: result.executionTime,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeAdvancedModel(
  query: string,
  options: {
    model: string;
    filePaths?: string[];
    maxTokens?: number;
    temperature?: number;
    webhook?: string;
    async?: boolean;
  }
): Promise<{
  success: boolean;
  content?: string;
  requestId?: string;
  status?: string;
  citations?: string[];
  images?: any[];
  executionTime?: number;
  isAsync?: boolean;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Perplexity API key not found in environment variables",
      };
    }

    const engine = new OptimizedPerplexitySearchEngine(apiKey);

    let attachments;
    if (options.filePaths && options.filePaths.length > 0) {
      attachments = await engine['processFileAttachments'](options.filePaths);
    }

    const result = await engine.executeAdvancedModel(query, {
      model: options.model,
      attachments,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      webhook: options.webhook,
    });

    return {
      success: true,
      content: result.content,
      requestId: result.requestId,
      status: result.status,
      citations: result.citations,
      images: result.images,
      executionTime: result.executionTime,
      isAsync: result.isAsync,
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

    // Collect all file paths
    const filePaths: string[] = [];
    if (cliOptions.file) filePaths.push(cliOptions.file);
    if (cliOptions.image) filePaths.push(cliOptions.image);
    if (cliOptions.attach) filePaths.push(...cliOptions.attach);
    if (cliOptions['attach-image']) filePaths.push(...cliOptions['attach-image']);

    // Determine execution mode and routing
    const hasAttachments = filePaths.length > 0;
    const isAdvancedModel = selectedModel && ['sonar-reasoning', 'sonar-deep-research'].includes(selectedModel);
    const needsAdvancedRouting = hasAttachments || isAdvancedModel;

    logEvent('info', 'execution_mode_selected', {
      mode: needsAdvancedRouting ? 'advanced' : 'search-api',
      hasAttachments,
      isAdvancedModel,
      attachmentCount: filePaths.length,
      model: selectedModel
    });

    let results: any;

    if (queries.length === 1) {
      // Single query execution
      const query = queries[0];

      if (isAdvancedModel) {
        // Use advanced model routing
        results = await executeAdvancedModel(query, {
          model: selectedModel!,
          filePaths: hasAttachments ? filePaths : undefined,
          webhook: cliOptions.webhook,
          async: cliOptions.async,
        });
      } else if (hasAttachments) {
        // Use chat with attachments
        results = await executeChatWithAttachments(query, filePaths, {
          model: selectedModel,
        });
      } else {
        // Use standard search
        results = await executeFastSearch(query, {
          maxResults,
          model: selectedModel,
        });
      }

      // Build output based on execution type
      const output: any = {
        version: '1.0.0',
        ok: results.success,
        query,
        executionTime: results.executionTime,
        mode: isAdvancedModel ? 'advanced-model' : (hasAttachments ? 'chat-attachments' : 'search-api'),
      };

      if (isAdvancedModel) {
        if (results.isAsync) {
          output.requestId = results.requestId;
          output.status = results.status;
          output.isAsync = true;
        } else {
          output.content = results.content;
          output.citations = results.citations;
          output.images = results.images;
        }
      } else if (hasAttachments) {
        output.content = results.content;
        output.citations = results.citations;
        output.images = results.images;
      } else {
        output.results = results.results || [];
      }

      if (results.error) {
        output.error = results.error;
      }

      if (outputFormat === 'jsonl') {
        console.log(JSON.stringify(output));
      } else {
        console.log(JSON.stringify(output, null, 2));
      }

    } else {
      // Multiple queries
      if (needsAdvancedRouting) {
        // For multiple queries with attachments or advanced models, process sequentially
        const multiResults: any[] = [];
        let totalSuccess = 0;
        let totalFailed = 0;

        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];

          try {
            let result: any;

            if (isAdvancedModel) {
              result = await executeAdvancedModel(query, {
                model: selectedModel!,
                filePaths: hasAttachments ? filePaths : undefined,
                webhook: cliOptions.webhook,
                async: cliOptions.async,
              });
            } else if (hasAttachments) {
              result = await executeChatWithAttachments(query, filePaths, {
                model: selectedModel,
              });
            } else {
              result = await executeFastSearch(query, {
                maxResults,
                model: selectedModel,
              });
            }

            const outputResult: any = {
              query,
              ok: result.success,
              executionTime: result.executionTime,
              mode: isAdvancedModel ? 'advanced-model' : (hasAttachments ? 'chat-attachments' : 'search-api'),
            };

            if (isAdvancedModel) {
              if (result.isAsync) {
                outputResult.requestId = result.requestId;
                outputResult.status = result.status;
                outputResult.isAsync = true;
              } else {
                outputResult.content = result.content;
                outputResult.citations = result.citations;
                outputResult.images = result.images;
              }
            } else if (hasAttachments) {
              outputResult.content = result.content;
              outputResult.citations = result.citations;
              outputResult.images = result.images;
            } else {
              outputResult.results = result.results || [];
            }

            if (result.error) {
              outputResult.error = result.error;
              totalFailed++;
            } else {
              totalSuccess++;
            }

            multiResults.push(outputResult);

            logEvent('info', 'progress', { completed: i + 1, total: queries.length });

          } catch (error) {
            multiResults.push({
              query,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime: 0,
              mode: 'advanced-model',
            });
            totalFailed++;
          }
        }

        const output = {
          version: '1.0.0',
          ok: totalFailed === 0,
          summary: {
            total: queries.length,
            successful: totalSuccess,
            failed: totalFailed,
            totalDuration: multiResults.reduce((sum, r) => sum + (r.executionTime || 0), 0),
          },
          results: multiResults,
          mode: needsAdvancedRouting ? 'advanced' : 'search-api',
        };

        if (outputFormat === 'jsonl') {
          for (const result of multiResults) {
            console.log(JSON.stringify(result));
          }
        } else {
          console.log(JSON.stringify(output, null, 2));
        }

        results = { success: totalFailed === 0 };

      } else {
        // Standard batch search for multiple queries without attachments
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
          mode: 'search-api',
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
    }

    const totalDuration = Date.now() - executionStartTime;
    logEvent('info', 'execution_completed', {
      duration: totalDuration,
      success: results.success,
      queryCount: queries.length,
      mode: needsAdvancedRouting ? 'advanced' : 'search-api'
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