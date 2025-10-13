import Perplexity from '@perplexity-ai/perplexity_ai';
import type { SearchConfig, QueryResult, ToolOutput, StreamingEvent } from "./types.js";
import { PerplexitySearchError, ErrorCode } from "./types.js";
import { PerplexitySearchTool } from "./index.js";
import type { SearchResult } from "./schema.js";

export class PerplexitySearchEngine {
  private readonly client: Perplexity;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new PerplexitySearchError(
        "Perplexity API key is required",
        ErrorCode.API_KEY_MISSING
      );
    }
    this.client = new Perplexity({ apiKey });
  }

  private createStreamingEvent(eventType: StreamingEvent["type"], eventData: unknown): StreamingEvent {
    return {
      type: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
    };
  }

  private streamEvent(event: StreamingEvent): void {
    console.error(JSON.stringify(event));
  }

  private async executeSingleQuery(
    searchQuery: string,
    searchConfig: SearchConfig,
    abortSignal: AbortSignal
  ): Promise<QueryResult> {
    try {
      const searchParameters: any = {
        query: searchQuery,
        max_results: searchConfig.maxResults || 5,
      };

      const searchResponse = await this.executeWithTimeout(
        () => this.client.search.create(searchParameters),
        searchConfig.timeout || 30000,
        abortSignal
      );

      const transformedResults = this.transformSearchResponse(searchResponse, searchConfig.maxResults || 5);

      return {
        query: searchQuery,
        results: transformedResults,
      };
    } catch (error) {
      if (error instanceof PerplexitySearchError) {
        throw error;
      }

      const searchError = this.categorizeSearchError(error);
      throw searchError;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    abortSignal: AbortSignal
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        if (abortSignal.aborted) {
          reject(new PerplexitySearchError("Request aborted", ErrorCode.UNEXPECTED_ERROR));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new PerplexitySearchError(
            `Request timeout after ${timeoutMs}ms`,
            ErrorCode.UNEXPECTED_ERROR
          ));
        }, timeoutMs);

        abortSignal.addEventListener("abort", () => {
          clearTimeout(timeoutId);
          reject(new PerplexitySearchError("Request aborted", ErrorCode.UNEXPECTED_ERROR));
        });
      }),
    ]);
  }

  private transformSearchResponse(searchResponse: any, maxResults: number): SearchResult[] {
    let results: SearchResult[] = [];

    if (searchResponse.results && Array.isArray(searchResponse.results)) {
      results = searchResponse.results.map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        snippet: result.snippet || '',
        date: result.date || undefined,
      }));
    } else {
      results = [{
        title: 'Search Result',
        url: 'https://www.perplexity.ai/',
        snippet: 'No content available',
        date: undefined,
      }];
    }

    return results.slice(0, maxResults);
  }

  private categorizeSearchError(error: unknown): PerplexitySearchError {
    let message = "Unexpected error occurred";
    let details: Record<string, unknown> = {};

    if (error instanceof Error) {
      message = error.message;
      details = {
        originalError: error.message,
        stack: error.stack,
      };
    }

    return new PerplexitySearchError(message, ErrorCode.UNEXPECTED_ERROR, details);
  }

  private async executeBatchQueries(
    queryList: string[],
    searchConfig: SearchConfig,
    abortSignal: AbortSignal
  ): Promise<QueryResult[]> {
    const concurrencyLimit = searchConfig.concurrency || 5;
    const semaphore = new Array(concurrencyLimit).fill(null);

    let queryIndex = 0;
    const results: QueryResult[] = [];

    const executeNextQuery = async (): Promise<void> => {
      if (abortSignal.aborted) {
        return;
      }

      const currentQueryIndex = queryIndex++;
      if (currentQueryIndex >= queryList.length) {
        return;
      }

      const currentQuery = queryList[currentQueryIndex];

      this.streamEvent(this.createStreamingEvent("query_start", {
        query: currentQuery,
        index: currentQueryIndex,
        total: queryList.length
      }));

      try {
        const queryResult = await this.executeSingleQuery(currentQuery, searchConfig, abortSignal);
        results.push(queryResult);

        this.streamEvent(this.createStreamingEvent("query_complete", {
          query: currentQuery,
          index: currentQueryIndex,
          resultCount: queryResult.results.length
        }));
      } catch (error) {
        const errorResult = this.createErrorQueryResult(currentQuery, error);
        results.push(errorResult);

        this.streamEvent(this.createStreamingEvent("error", {
          query: currentQuery,
          index: currentQueryIndex,
          error: errorResult.error
        }));
      }
    };

    const workerPromises = semaphore.map(async () => {
      while (!abortSignal.aborted && queryIndex < queryList.length) {
        await executeNextQuery();
      }
    });

    await Promise.all(workerPromises);

    return results.sort((resultA, resultB) => {
      const indexA = queryList.indexOf(resultA.query);
      const indexB = queryList.indexOf(resultB.query);
      return indexA - indexB;
    });
  }

  private createErrorQueryResult(query: string, error: unknown): QueryResult {
    return {
      query,
      results: [],
      error: error instanceof PerplexitySearchError ? {
        code: error.code,
        message: error.message,
        details: error.details,
      } : {
        code: ErrorCode.UNEXPECTED_ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }

  async search(
  searchConfig: SearchConfig,
  abortSignal: AbortSignal = new AbortController().signal
): Promise<ToolOutput> {
    const searchStartTime = Date.now();

    try {
      this.streamEvent(this.createStreamingEvent("start", {
        mode: searchConfig.mode,
        maxResults: searchConfig.maxResults,
        concurrency: searchConfig.concurrency,
      }));

      const queryResults = await this.executeQueryBasedOnMode(searchConfig, abortSignal);
      const searchMetrics = this.calculateSearchMetrics(queryResults, searchStartTime);

      this.streamEvent(this.createStreamingEvent("complete", searchMetrics));

      return {
        success: true,
        results: queryResults,
        metadata: searchMetrics,
      };
    } catch (error) {
      const executionTime = Date.now() - searchStartTime;
      const errorOutput = this.formatSearchError(error);

      this.streamEvent(this.createStreamingEvent("error", errorOutput));

      return {
        success: false,
        results: [],
        error: errorOutput,
        metadata: {
          totalQueries: 0,
          totalResults: 0,
          executionTime,
          mode: searchConfig.mode,
        },
      };
    }
  }

  private async executeQueryBasedOnMode(
    searchConfig: SearchConfig,
    abortSignal: AbortSignal
  ): Promise<QueryResult[]> {
    if (searchConfig.mode === "single") {
      return [await this.executeSingleQuery(searchConfig.query!, searchConfig, abortSignal)];
    } else {
      return this.executeBatchQueries(searchConfig.queries!, searchConfig, abortSignal);
    }
  }

  private calculateSearchMetrics(queryResults: QueryResult[], startTime: number): {
    totalQueries: number;
    totalResults: number;
    executionTime: number;
    mode: string;
  } {
    const totalResults = queryResults.reduce((sum, result) => sum + result.results.length, 0);
    const executionTime = Date.now() - startTime;

    return {
      mode: queryResults.length === 1 ? 'single' : 'multi',
      totalQueries: queryResults.length,
      totalResults,
      executionTime,
    } as const;
  }

  private formatSearchError(error: unknown): {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
  } {
    return error instanceof PerplexitySearchError ? {
      code: error.code,
      message: error.message,
      details: error.details,
    } : {
      code: ErrorCode.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? { stack: error.stack } : {},
    };
  }
}

/**
 * Simplified API for single query search (matches original perplexity-search-sdk.js)
 */
export async function search(
  query: string,
  options: {
    maxResults?: number;
    country?: string;
    timeout?: number;
    workspace?: string;
  } = {}
): Promise<{
  success: boolean;
  results?: SearchResult[];
  error?: string;
  totalCount?: number;
  duration?: number;
}> {
  try {
    const tool = new PerplexitySearchTool(options.workspace, {
      resilienceProfile: 'balanced',
    });

    const result = await tool.runTask({
      op: 'search',
      args: {
        query,
        maxResults: options.maxResults || 5,
        country: options.country,
      },
      options: {
        timeoutMs: options.timeout || 30000,
        workspace: options.workspace,
      },
    });

    if (result.ok && result.data) {
      return {
        success: true,
        results: result.data.results,
        totalCount: result.data.totalCount,
        duration: result.duration,
      };
    } else {
      return {
        success: false,
        error: result.error?.message || 'Unknown error occurred',
        duration: result.duration,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Simplified API for multi-query search (matches original perplexity-multi-search-sdk.js)
 */
export async function multiSearch(
  queries: string[],
  options: {
    maxResults?: number;
    country?: string;
    concurrency?: number;
    timeout?: number;
    workspace?: string;
    failFast?: boolean;
  } = {}
): Promise<{
  success: boolean;
  results?: Array<{
    query: string;
    results: SearchResult[];
    totalCount: number;
    success: boolean;
    error?: string;
  }>;
  error?: string;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    totalDuration: number;
  };
}> {
  try {
    const tool = new PerplexitySearchTool(options.workspace, {
      resilienceProfile: 'balanced',
    });

    const batchInput = {
      version: '1.0.0' as const,
      requests: queries.map(query => ({
        op: 'search' as const,
        args: {
          query,
          maxResults: options.maxResults || 5,
          country: options.country,
        },
      })),
      options: {
        concurrency: options.concurrency || 5,
        timeoutMs: options.timeout || 60000,
        workspace: options.workspace,
        failFast: options.failFast || false,
      },
    };

    const result = await tool.runBatch(batchInput);

    if (result.ok) {
      const processedResults = result.results.map(searchResult => {
        if (searchResult.ok && searchResult.data) {
          return {
            query: searchResult.data.query,
            results: searchResult.data.results,
            totalCount: searchResult.data.totalCount,
            success: true,
          };
        } else {
          return {
            query: 'unknown',
            results: [],
            totalCount: 0,
            success: false,
            error: searchResult.error?.message || 'Unknown error',
          };
        }
      });

      return {
        success: true,
        results: processedResults,
        summary: result.summary,
      };
    } else {
      return {
        success: false,
        error: 'Batch search failed',
        summary: result.summary,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validate API key
 */
export async function validateApiKey(apiKey?: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const originalKey = process.env.PERPLEXITY_API_KEY;
    if (apiKey) {
      process.env.PERPLEXITY_API_KEY = apiKey;
    }

    const tool = new PerplexitySearchTool();

    const result = await tool.runTask({
      op: 'search',
      args: {
        query: 'test',
        maxResults: 1,
      },
      options: {
        timeoutMs: 5000,
      },
    });

    if (apiKey) {
      process.env.PERPLEXITY_API_KEY = originalKey;
    }

    return {
      valid: result.ok,
      error: result.ok ? undefined : result.error?.message,
    };
  } catch (error) {
    if (apiKey) {
      process.env.PERPLEXITY_API_KEY = process.env.PERPLEXITY_AI_API_KEY;
    }
    
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get tool health and status information
 */
export async function getHealthStatus(workspace?: string): Promise<{
  healthy: boolean;
  apiKeyPresent: boolean;
  workspaceValid: boolean;
  resilienceStats: any;
  timestamp: string;
}> {
  const tool = new PerplexitySearchTool(workspace);
  return tool.getHealthStatus();
}

/**
 * Get performance metrics
 */
export async function getMetrics(workspace?: string): Promise<{
  metrics: any;
  resilienceStats: any;
  timestamp: string;
}> {
  const tool = new PerplexitySearchTool(workspace);
  return tool.getMetrics();
}
