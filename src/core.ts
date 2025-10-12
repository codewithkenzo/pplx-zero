import { search as perplexitySearch } from 'perplexityai';
import type { SearchConfig, QueryResult, ToolOutput, StreamingEvent } from "./types.js";
import { PerplexitySearchError, ErrorCode } from "./types.js";
import { PerplexitySearchTool } from "./index.js";
import type { SearchResult } from "./schema.js";

export class PerplexitySearchEngine {
  private client: typeof perplexitySearch;

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new PerplexitySearchError(
        "Perplexity API key is required",
        ErrorCode.API_KEY_MISSING
      );
    }
    this.client = perplexitySearch;
  }

  private createStreamingEvent(type: StreamingEvent["type"], data: any): StreamingEvent {
    return {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private streamEvent(event: StreamingEvent): void {
    console.error(JSON.stringify(event));
  }

  private async executeSingleQuery(
    query: string,
    config: SearchConfig,
    signal: AbortSignal
  ): Promise<QueryResult> {
    try {
      const searchParams: any = {
        query,
        max_results: config.maxResults,
      };

      if (config.country) {
        searchParams.country = config.country;
      }

      const search = await Promise.race([
        this.client(searchParams.query),
        new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new PerplexitySearchError("Request aborted", ErrorCode.UNEXPECTED_ERROR));
          }
          const timeout = setTimeout(() => {
            reject(new PerplexitySearchError(
              `Request timeout after ${config.timeout}ms`,
              ErrorCode.UNEXPECTED_ERROR
            ));
          }, config.timeout);
          signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new PerplexitySearchError("Request aborted", ErrorCode.UNEXPECTED_ERROR));
          });
        }),
      ]);

      // Transform the perplexityai package response to our format
      let results: SearchResult[] = [];
      
      if (search.sources && Array.isArray(search.sources)) {
        results = search.sources.map((source: any) => ({
          title: source.name || 'Untitled',
          url: source.url || '',
          snippet: search.detailed || search.concise || '',
          date: undefined,
        }));
      } else {
        // If no sources, create a single result with the text content
        results = [{
          title: 'Search Result',
          url: 'https://www.perplexity.ai/',
          snippet: search.detailed || search.concise || 'No content available',
          date: undefined,
        }];
      }

      // Limit results to maxResults if specified
      const maxResults = config.maxResults || 5;
      const limitedResults = results.slice(0, maxResults);

      return {
        query,
        results: limitedResults,
      };
    } catch (error) {
      if (error instanceof PerplexitySearchError) {
        throw error;
      }

      let code = ErrorCode.UNEXPECTED_ERROR;
      let message = "Unexpected error occurred";
      let details: Record<string, any> = {};

      if (error instanceof Error) {
        message = error.message;
        
        if (error.message.includes("timeout") || error.message.includes("aborted")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        } else if (error.message.includes("rate limit")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        } else if (error.message.includes("429")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        } else if (error.message.includes("401") || error.message.includes("403")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        } else if (error.message.includes("4") || error.message.includes("5")) {
          code = ErrorCode.UNEXPECTED_ERROR;
        }

        details = {
          originalError: error.message,
          stack: error.stack,
        };
      }

      throw new PerplexitySearchError(message, code, details);
    }
  }

  private async executeBatchQueries(
    queries: string[],
    config: SearchConfig,
    signal: AbortSignal
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    const semaphore = new Array(config.concurrency!).fill(null);
    
    let index = 0;
    const executeNext = async (): Promise<QueryResult | null> => {
      if (signal.aborted) {
        return null;
      }

      const currentIndex = index++;
      if (currentIndex >= queries.length) {
        return null;
      }

      const query = queries[currentIndex];
      this.streamEvent(this.createStreamingEvent("query_start", { 
        query, 
        index: currentIndex,
        total: queries.length 
      }));

      try {
        const result = await this.executeSingleQuery(query, config, signal);
        this.streamEvent(this.createStreamingEvent("query_complete", { 
          query, 
          index: currentIndex,
          resultCount: result.results.length 
        }));
        return result;
      } catch (error) {
        const errorResult: QueryResult = {
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
        this.streamEvent(this.createStreamingEvent("error", { 
          query, 
          index: currentIndex,
          error: errorResult.error 
        }));
        return errorResult;
      }
    };

    const workers = semaphore.map(async () => {
      while (!signal.aborted) {
        const result = await executeNext();
        if (result === null) break;
        results.push(result);
      }
    });

    await Promise.all(workers);

    return results.sort((a, b) => {
      const aIndex = queries.indexOf(a.query);
      const bIndex = queries.indexOf(b.query);
      return aIndex - bIndex;
    });
  }

  async search(config: SearchConfig, signal: AbortSignal = new AbortController().signal): Promise<ToolOutput> {
    const startTime = Date.now();
    
    try {
      this.streamEvent(this.createStreamingEvent("start", { 
        mode: config.mode,
        maxResults: config.maxResults,
        concurrency: config.concurrency,
      }));

      let results: QueryResult[];

      if (config.mode === "single") {
        results = [await this.executeSingleQuery(config.query!, config, signal)];
      } else {
        results = await this.executeBatchQueries(config.queries!, config, signal);
      }

      const totalResults = results.reduce((sum, result) => sum + result.results.length, 0);
      const executionTime = Date.now() - startTime;

      this.streamEvent(this.createStreamingEvent("complete", { 
        totalQueries: results.length,
        totalResults,
        executionTime,
      }));

      return {
        success: true,
        results,
        metadata: {
          totalQueries: results.length,
          totalResults,
          executionTime,
          mode: config.mode,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const errorOutput = error instanceof PerplexitySearchError ? {
        code: error.code,
        message: error.message,
        details: error.details,
      } : {
        code: ErrorCode.UNEXPECTED_ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? { stack: error.stack } : {},
      };

      this.streamEvent(this.createStreamingEvent("error", errorOutput));

      return {
        success: false,
        results: [],
        error: errorOutput,
        metadata: {
          totalQueries: 0,
          totalResults: 0,
          executionTime,
          mode: config.mode,
        },
      };
    }
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
    // If API key is provided, use it temporarily
    const originalKey = process.env.PERPLEXITY_API_KEY;
    if (apiKey) {
      process.env.PERPLEXITY_API_KEY = apiKey;
    }

    const tool = new PerplexitySearchTool();
    
    // Try a simple search to validate the key
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

    // Restore original key
    if (apiKey) {
      process.env.PERPLEXITY_API_KEY = originalKey;
    }

    return {
      valid: result.ok,
      error: result.ok ? undefined : result.error?.message,
    };
  } catch (error) {
    // Restore original key in case of error
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
