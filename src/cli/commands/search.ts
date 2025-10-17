/**
 * Search command handler for PPLX-Zero
 * Handles single and multi-search operations with full functionality
 */

import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  fastSearch,
  fastMultiSearch,
  processFileAttachments,
  getApiKey,
  OptimizedPerplexitySearchEngine
} from '../../core.js';
import { ErrorCode } from '../../types.js';
import { HistoryManager } from '../../history/manager.js';
import { ExportFormatter } from '../../export/formatter.js';
import { FileUtils } from '../../utils/file.js';
import { CliFormatter } from '../../cli/formatter.js';
import { checkForUpdatesCached } from '../../update/service.js';
import type {
  SearchOptions,
  SearchContext,
  SearchExecutionResult,
  MultiSearchExecutionResult,
  ParsedQueries,
  CommandResult,
  ExitCode,
  ProgressCallback,
  CliEvent
} from '../types.js';
import type { SearchResult } from '../../types.js';

/**
 * Parse number with validation
 */
function parseNumber(value: string | undefined, defaultValue: number, min: number, max: number, name: string): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

/**
 * Log CLI event for debugging
 */
function logEvent(level: 'info' | 'error', event: string, data?: any): void {
  if (process.env.PPLX_DEBUG) {
    const logData: CliEvent = {
      timestamp: new Date().toISOString(),
      level,
      event,
      data
    };
    console.error(JSON.stringify(logData));
  }
}

/**
 * Parse queries from various input sources
 */
async function parseQueries(options: {
  stdin: boolean;
  input?: string;
  query?: string;
  positionals: readonly string[];
}): Promise<ParsedQueries> {
  const queries: string[] = [];
  let source: 'cli' | 'stdin' | 'file' = 'cli';
  let metadata: ParsedQueries['metadata'];

  if (options.query) {
    queries.push(options.query);
  } else if (options.positionals.length > 0) {
    queries.push(...options.positionals);
  } else if (options.stdin) {
    source = 'stdin';
    const readlineInterface = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    let lineCount = 0;
    for await (const line of readlineInterface) {
      const trimmed = line.trim();
      if (trimmed) {
        lineCount++;
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
    metadata = { lineCount };
  } else if (options.input) {
    source = 'file';
    let fileContent: string;
    if (typeof Bun !== 'undefined') {
      fileContent = await Bun.file(options.input).text();
    } else {
      const fs = await import('node:fs');
      fileContent = await fs.promises.readFile(options.input, 'utf-8');
    }
    const parsed = JSON.parse(fileContent);

    if (parsed.queries && Array.isArray(parsed.queries)) {
      queries.push(...parsed.queries);
    } else if (parsed.requests && Array.isArray(parsed.requests)) {
      queries.push(...parsed.requests.map((req: any) => req.args?.query).filter(Boolean));
    } else if (parsed.query) {
      queries.push(parsed.query);
    }
    metadata = { filename: options.input };
  }

  if (queries.length === 0) {
    throw new Error('No queries provided. Use --help for usage information.');
  }

  return { queries, source, metadata };
}

/**
 * Execute single search with proper routing
 */
async function executeSearch(
  query: string,
  options: SearchOptions,
  filePaths: string[] = []
): Promise<SearchExecutionResult> {
  const startTime = performance.now();
  const hasAttachments = filePaths.length > 0;
  const isAdvancedModel = options.model && ['sonar-pro', 'sonar-reasoning', 'sonar-deep-research'].includes(options.model);

  try {
    let result: any;
    let mode: SearchExecutionResult['mode'];

    if (isAdvancedModel || hasAttachments) {
      // ALL advanced models and attachments use chat completions API
      mode = isAdvancedModel ? 'advanced-model' : 'chat-attachments';
      const apiKey = getApiKey();
      const engine = new OptimizedPerplexitySearchEngine({ apiKey });

      const attachments = hasAttachments ? await processFileAttachments(filePaths) : undefined;

      let response: any;

      if (isAdvancedModel) {
        // Use advanced model handler
        response = await engine.executeAdvancedModel(query, {
          model: options.model,
          attachments,
          webhook: options.webhook,
          timeout: options.timeout,
        });

        result = {
          success: true,
          content: response.content,
          requestId: response.requestId,
          status: response.status,
          citations: response.citations,
          images: response.images,
          isAsync: response.isAsync,
        };
      } else {
        // Use chat with attachments handler
        response = await engine.executeChatWithAttachments(query, attachments!, {
          model: options.model,
        });

        result = {
          success: true,
          content: response.content,
          citations: response.citations,
          images: response.images,
        };
      }
    } else {
      // Pure text queries use search API
      mode = 'search-api';
      const searchParams: { maxResults: number; model?: string } = {
        maxResults: options.maxResults,
      };
      if (options.model) {
        searchParams.model = options.model;
      }

      result = await fastSearch(query, searchParams);
    }

    const executionTime = performance.now() - startTime;

    const searchResult: SearchExecutionResult = {
      success: result.success,
      executionTime,
      mode,
      metadata: {
        queryCount: 1,
        model: options.model,
        maxResults: options.maxResults,
      }
    };

    // Handle different result formats
    if (result.results && Array.isArray(result.results)) {
      // Search API results
      searchResult.results = result;
    } else if (result.content !== undefined) {
      // Chat completion results
      searchResult.results = result;
    } else if (result.error) {
      searchResult.error = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
    }

    return searchResult;
  } catch (error) {
    // Properly serialize error
    let errorMessage = error instanceof Error ? error.message : String(error);

    // Try to parse JSON errors
    if (typeof error === 'string' && error.startsWith('{')) {
      try {
        const parsed = JSON.parse(error);
        errorMessage = parsed.message || error;
      } catch {
        // Keep original error message
      }
    }

    return {
      success: false,
      executionTime: performance.now() - startTime,
      mode: isAdvancedModel ? 'advanced-model' : (hasAttachments ? 'chat-attachments' : 'search-api'),
      error: errorMessage,
      metadata: {
        queryCount: 1,
        model: options.model,
        maxResults: options.maxResults,
      }
    };
  }
}

/**
 * Execute multi-search with proper routing
 */
async function executeMultiSearch(
  queries: string[],
  options: SearchOptions,
  filePaths: string[] = [],
  onProgress?: ProgressCallback
): Promise<MultiSearchExecutionResult> {
  const startTime = performance.now();
  const hasAttachments = filePaths.length > 0;
  const isAdvancedModel = options.model && ['sonar-pro', 'sonar-reasoning', 'sonar-deep-research'].includes(options.model);
  const needsAdvancedRouting = hasAttachments || isAdvancedModel;

  try {
    if (needsAdvancedRouting) {
      // Process sequentially for advanced routing
      const results: SearchResult[] = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const searchResult = await executeSearch(query, options, filePaths);

        if (searchResult.success) {
          successCount++;
        } else {
          failCount++;
        }

        // Convert to SearchResult format
        const searchResultFormatted: SearchResult = {
          ok: searchResult.success,
          query,
          results: searchResult.results,
          content: (searchResult.results as any)?.content,
          citations: (searchResult.results as any)?.citations,
          images: (searchResult.results as any)?.images,
          error: searchResult.error,
          model: options.model,
          duration: searchResult.executionTime,
        };

        results.push(searchResultFormatted);

        if (onProgress) {
          onProgress(i + 1, queries.length);
        }
      }

      const totalDuration = performance.now() - startTime;

      return {
        success: failCount === 0,
        results,
        summary: {
          total: queries.length,
          successful: successCount,
          failed: failCount,
          totalDuration,
        },
        executionTime: totalDuration,
        mode: 'advanced',
      };
    } else {
      // Use batch search for standard queries
      const multiSearchParams: {
        maxResults: number;
        concurrency: number;
        model?: string;
        onProgress?: ProgressCallback;
      } = {
        maxResults: options.maxResults,
        concurrency: options.concurrency,
        onProgress,
      };
      if (options.model) {
        multiSearchParams.model = options.model;
      }

      const result = await fastMultiSearch(queries, multiSearchParams);

      const totalDuration = performance.now() - startTime;

      const multiResult: MultiSearchExecutionResult = {
        success: result.success,
        results: result.results || [],
        summary: {
          total: queries.length,
          successful: result.success ? queries.length : 0,
          failed: result.success ? 0 : queries.length,
          totalDuration,
        },
        executionTime: totalDuration,
        mode: 'search-api',
      };

      if (result.error) {
        multiResult.error = result.error;
      }

      return multiResult;
    }
  } catch (error) {
    return {
      success: false,
      results: [],
      summary: {
        total: queries.length,
        successful: 0,
        failed: queries.length,
        totalDuration: performance.now() - startTime,
      },
      executionTime: performance.now() - startTime,
      mode: 'search-api',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Export results to file
 */
async function exportResults(
  results: any,
  queries: string[],
  exportFilename: string,
  metadata: any
): Promise<string> {
  const format = exportFilename.endsWith('.md') ? 'md' :
                 exportFilename.endsWith('.json') ? 'json' : 'txt';

  const exportData = {
    queries,
    results: Array.isArray(results.results) ? results.results : [results],
    metadata: {
      timestamp: new Date().toISOString(),
      queryCount: queries.length,
      totalResults: Array.isArray(results.results) ?
        results.results.reduce((sum: number, r: any) => sum + (r.results?.length || 1), 0) :
        (results.results?.length || 1),
      executionTime: metadata.executionTime,
      model: metadata.model,
      success: metadata.success,
    }
  };

  const formattedContent = ExportFormatter.format(exportData, {
    format,
    filename: exportFilename,
    includeMetadata: true,
    includeTimestamp: true,
    cleanText: true,
  });

  const exportDir = await FileUtils.createExportDir();
  const fullFilename = ExportFormatter.generateFilename(exportFilename, format, false);
  const exportPath = join(exportDir, fullFilename);

  await FileUtils.writeFileWithBackup(exportPath, formattedContent);

  return exportPath;
}

/**
 * Log search to history
 */
async function logToHistory(
  queries: string[],
  results: any,
  metadata: any,
  exportPath?: string
): Promise<void> {
  try {
    const historyManager = new HistoryManager();

    await historyManager.addEntry({
      sessionId: randomUUID(),
      queries,
      queryCount: queries.length,
      model: metadata.model,
      maxResults: metadata.maxResults,
      executionTime: metadata.executionTime,
      success: metadata.success,
      resultsCount: Array.isArray(results.results) ?
        results.results.reduce((sum: number, r: any) => sum + (r.results?.length || 1), 0) :
        (results.results?.length || 1),
      exportPath,
      mode: metadata.mode,
    });
  } catch (error) {
    // Don't let history errors break the main flow
    logEvent('error', 'history_logging_failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Main search command handler
 */
export async function handleSearchCommand(options: {
  query?: string;
  file?: string;
  image?: string;
  format: string;
  model?: string;
  maxResults: string;
  concurrency?: string;
  timeout?: string;
  batchSize: string;
  useSearchAPI: boolean;
  stdin: boolean;
  input?: string;
  attach: readonly string[];
  attachImage: readonly string[];
  export?: string;
  async: boolean;
  webhook?: string;
  positionals: readonly string[];
}): Promise<CommandResult> {
  const startTime = Date.now();
  const sessionId = randomUUID();

  // Check for updates in background with 24-hour caching
  // This will only make an API call if 24 hours have passed since last check
  checkForUpdatesCached().catch(error => {
    // Silently ignore update errors to not interfere with search functionality
    if (process.env.PPLX_DEBUG) {
      console.error('Background update check failed:', error);
    }
  });

  try {
    // Parse and validate options
    const maxResults = parseNumber(options.maxResults, 5, 1, 20, 'Max results');
    const concurrency = parseNumber(options.concurrency, 5, 1, 20, 'Concurrency');
    const timeout = parseNumber(options.timeout, 30000, 1000, 300000, 'Timeout');
    const batchSize = parseNumber(options.batchSize, 20, 1, 100, 'Batch size');

    const outputFormat = options.format as 'json' | 'jsonl';
    if (!['json', 'jsonl'].includes(outputFormat)) {
      throw new Error('Format must be json or jsonl');
    }

    // Validate model
    let selectedModel: string | undefined;
    if (options.model) {
      const validModels = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-deep-research'];
      if (!validModels.includes(options.model)) {
        throw new Error(`Invalid model: ${options.model}. Valid models: ${validModels.join(', ')}`);
      }
      selectedModel = options.model;
    }

    // Parse queries
    const parsedQueries = await parseQueries({
      stdin: options.stdin,
      input: options.input,
      query: options.query,
      positionals: options.positionals,
    });

    // Collect and validate file paths
    const filePaths: string[] = [];
    const filesToValidate: string[] = [];

    if (options.file) {
      filePaths.push(options.file);
      filesToValidate.push(options.file);
    }
    if (options.image) {
      filePaths.push(options.image);
      filesToValidate.push(options.image);
    }
    if (options.attach) {
      filePaths.push(...options.attach);
      filesToValidate.push(...options.attach);
    }
    if (options.attachImage) {
      filePaths.push(...options.attachImage);
      filesToValidate.push(...options.attachImage);
    }

    // Validate that all files exist and are readable
    if (filesToValidate.length > 0) {
      const missingFiles: string[] = [];

      for (const filePath of filesToValidate) {
        try {
          // Use Bun if available, otherwise fallback to Node.js fs
          if (typeof Bun !== 'undefined') {
            const file = Bun.file(filePath);
            if (!(await file.exists())) {
              missingFiles.push(filePath);
            } else if (file.size === 0) {
              throw new Error(`File is empty: ${filePath}`);
            }
          } else {
            // Node.js fallback
            const fs = await import('node:fs');
            const stats = await fs.promises.stat(filePath);
            if (!stats.isFile()) {
              missingFiles.push(filePath);
            } else if (stats.size === 0) {
              throw new Error(`File is empty: ${filePath}`);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('File is empty')) {
            throw error;
          }
          missingFiles.push(filePath);
        }
      }

      if (missingFiles.length > 0) {
        const fileList = missingFiles.length === 1
          ? `File "${missingFiles[0]}" does not exist or is not readable`
          : `Files do not exist or are not readable:\n${missingFiles.map(f => `  - ${f}`).join('\n')}`;
        throw new Error(`${fileList}\nPlease check the file paths and try again.`);
      }
    }

    // Create search options
    const searchOptions: SearchOptions = {
      maxResults,
      concurrency,
      timeout,
      batchSize,
      useSearchAPI: options.useSearchAPI,
      outputFormat,
      model: selectedModel as any,
      filePaths,
      webhook: options.webhook,
      async: options.async,
    };

    // Create search context
    const context: SearchContext = {
      queries: parsedQueries.queries,
      options: searchOptions,
      exportConfig: options.export ? {
        filename: options.export,
        includeMetadata: true,
        includeTimestamp: true,
        cleanText: true,
      } : undefined,
      source: parsedQueries.source,
      sessionId,
      startTime,
    };

    logEvent('info', 'search_initialized', {
      queryCount: parsedQueries.queries.length,
      source: parsedQueries.source,
      model: selectedModel,
      hasAttachments: filePaths.length > 0,
    });

    let results: any;
    let output: any;

    if (parsedQueries.queries.length === 1) {
      // Single query execution
      const searchResult = await executeSearch(parsedQueries.queries[0], searchOptions, filePaths);

      output = {
        version: '1.0.0',
        ok: searchResult.success,
        query: parsedQueries.queries[0],
        executionTime: searchResult.executionTime,
        mode: searchResult.mode,
      };

      // Handle different modes properly
      if (searchResult.results && typeof searchResult.results === 'object') {
        const results = searchResult.results as any;

        if (searchResult.mode === 'advanced-model') {
          if (results.isAsync && results.requestId) {
            output.requestId = results.requestId;
            output.status = results.status;
            output.isAsync = true;
          } else {
            output.content = results.content || '';
            output.citations = Array.isArray(results.citations) ? results.citations : [];
            output.images = Array.isArray(results.images) ? results.images : [];
          }
        } else if (searchResult.mode === 'chat-attachments') {
          output.content = results.content || '';
          output.citations = Array.isArray(results.citations) ? results.citations : [];
          output.images = Array.isArray(results.images) ? results.images : [];
        } else if (searchResult.mode === 'search-api') {
          // Search API results
          if (results.results && Array.isArray(results.results)) {
            output.results = results.results;
          }
        }
      }

      if (searchResult.error) {
        output.error = searchResult.error;
      }

      results = { success: searchResult.success };
    } else {
      // Multiple queries execution
      const onProgress: ProgressCallback = (completed, total) => {
        logEvent('info', 'progress', { completed, total });
      };

      const multiResult = await executeMultiSearch(parsedQueries.queries, searchOptions, filePaths, onProgress);

      output = {
        version: '1.0.0',
        ok: multiResult.success,
        summary: multiResult.summary,
        results: multiResult.results,
        mode: multiResult.mode,
      };

      // Ensure proper serialization of results
      if (multiResult.results && Array.isArray(multiResult.results)) {
        output.results = multiResult.results.map(result => {
          if (typeof result === 'object' && result !== null) {
            // Ensure no circular references and proper serialization
            return {
              ok: result.ok,
              query: result.query,
              content: result.content,
              results: result.results,
              citations: Array.isArray(result.citations) ? result.citations : [],
              images: Array.isArray(result.images) ? result.images : [],
              error: result.error,
              model: result.model,
              duration: result.duration,
            };
          }
          return result;
        });
      }

      if (multiResult.error) {
        output.error = typeof multiResult.error === 'string' ? multiResult.error : JSON.stringify(multiResult.error);
      }

      results = { success: multiResult.success };
    }

    // Handle export if requested
    let exportPath: string | undefined;
    if (options.export) {
      try {
        exportPath = await exportResults(output, parsedQueries.queries, options.export, {
          executionTime: output.executionTime || output.summary?.totalDuration || 0,
          model: selectedModel,
          maxResults,
          success: results.success,
          mode: output.mode,
        });

        const exportStats = await FileUtils.getFileInfo(exportPath);
        const exportMessage = CliFormatter.formatExportStatus(
          exportPath.split('/').pop() || exportPath,
          exportPath.endsWith('.md') ? 'markdown' : exportPath.endsWith('.json') ? 'json' : 'text',
          exportStats.size
        );
        console.error(CliFormatter.supportsColors() ? exportMessage : CliFormatter.formatPlainText(exportMessage));
      } catch (error) {
        const errorMessage = CliFormatter.formatError(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        console.error(CliFormatter.supportsColors() ? errorMessage : CliFormatter.formatPlainText(errorMessage));
      }
    }

    // Log to history
    await logToHistory(parsedQueries.queries, output, {
      executionTime: output.executionTime || output.summary?.totalDuration || 0,
      model: selectedModel,
      maxResults,
      success: results.success,
      mode: output.mode,
    }, exportPath);

    // Output results with proper serialization
    if (outputFormat === 'jsonl') {
      if (Array.isArray(output.results)) {
        for (const result of output.results) {
          // Ensure each result is properly serialized
          const serializedResult = typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : result;
          console.log(JSON.stringify({ ...serializedResult, mode: output.mode }));
        }
      } else {
        console.log(JSON.stringify(output, null, 0));
      }
    } else {
      // Use custom replacer to handle circular references and ensure proper serialization
      const seen = new WeakSet();
      const jsonString = JSON.stringify(output, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      }, 2);
      console.log(jsonString);
    }

    const totalDuration = Date.now() - startTime;
    logEvent('info', 'search_completed', {
      duration: totalDuration,
      success: results.success,
      queryCount: parsedQueries.queries.length,
      mode: output.mode,
    });

    return {
      exitCode: results.success ? 0 : 1,
      output: `Processed ${parsedQueries.queries.length} queries successfully`,
    };

  } catch (error) {
    const executionDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logEvent('error', 'search_failed', {
      error: errorMessage,
      duration: executionDuration,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Format error with clean CLI output
    const formattedError = CliFormatter.formatError(`Search failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));

    // Also output structured error for logging with canonical error codes
    let canonicalErrorCode = ErrorCode.UNEXPECTED_ERROR;
    const errorMessageLower = errorMessage.toLowerCase();

    if (errorMessageLower.includes('api key') || errorMessageLower.includes('unauthorized')) {
      canonicalErrorCode = ErrorCode.API_KEY_MISSING;
    } else if (errorMessageLower.includes('rate limit') || errorMessageLower.includes('too many requests')) {
      canonicalErrorCode = ErrorCode.RATE_LIMIT_ERROR;
    } else if (errorMessageLower.includes('timeout') || errorMessageLower.includes('aborted')) {
      canonicalErrorCode = ErrorCode.TIMEOUT_ERROR;
    } else if (errorMessageLower.includes('network') || errorMessageLower.includes('enotfound') || errorMessageLower.includes('connection')) {
      canonicalErrorCode = ErrorCode.NETWORK_ERROR;
    } else if (errorMessageLower.includes('validation') || errorMessageLower.includes('invalid')) {
      canonicalErrorCode = ErrorCode.VALIDATION_ERROR;
    }

    const errorOutput = {
      version: '1.0.0',
      ok: false,
      error: {
        code: canonicalErrorCode,
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      duration: executionDuration,
    };

    console.log(JSON.stringify(errorOutput, null, 2));

    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}