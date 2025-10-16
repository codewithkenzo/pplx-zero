import Perplexity from '@perplexity-ai/perplexity_ai';
import type { SearchConfig, QueryResult, ToolOutput, StreamingEvent } from "./types.js";
import { PerplexitySearchError, ErrorCode } from "./types.js";
import type { SearchResult } from "./schema.js";

/**
 * Optimized Perplexity Search Engine with minimal abstraction and maximum performance
 */
export class OptimizedPerplexitySearchEngine {
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

  /**
   * Fast single query execution with minimal overhead
   */
  async executeSingle(
    query: string,
    options: {
      maxResults?: number;
      model?: string;
      timeout?: number;
    } = {}
  ): Promise<QueryResult> {
    const startTime = performance.now();

    try {
      const searchResponse = await this.client.search.create({
        query,
        max_results: options.maxResults || 5,
        model: options.model,
      });

      const results = this.transformResponse(searchResponse, options.maxResults || 5);

      return {
        query,
        results,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        query,
        results: [],
        executionTime: performance.now() - startTime,
        error: this.formatError(error),
      };
    }
  }

  /**
   * Optimized multi-query execution using native SDK array support
   */
  async executeMulti(
    queries: string[],
    options: {
      maxResults?: number;
      model?: string;
      concurrency?: number;
      timeout?: number;
    } = {}
  ): Promise<QueryResult[]> {
    const startTime = performance.now();

    // Use SDK's native multi-query support for optimal performance
    if (queries.length <= 10) {
      try {
        const searchResponse = await this.client.search.create({
          query: queries,
          max_results: options.maxResults || 5,
          model: options.model,
        });

        return queries.map((query, index) => ({
          query,
          results: this.extractQueryResults(searchResponse, index, options.maxResults || 5),
          executionTime: (performance.now() - startTime) / queries.length,
        }));
      } catch (error) {
        // Fall back to concurrent execution if array query fails
        return this.executeConcurrent(queries, options);
      }
    }

    // For larger batches, use optimized concurrent execution
    return this.executeConcurrent(queries, options);
  }

  /**
   * Fast chat completion for when AI generation is needed
   */
  async executeChatCompletion(
    query: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      searchRecencyFilter?: string;
      searchDomainFilter?: string[];
      returnImages?: boolean;
      returnRelatedQuestions?: boolean;
      messages?: any[];
    } = {}
  ): Promise<{
    content: string;
    citations?: string[];
    images?: any[];
    relatedQuestions?: string[];
    executionTime: number;
  }> {
    const startTime = performance.now();

    try {
      const messages = options.messages || [
        { role: "system", content: "You are a helpful AI assistant. Provide accurate, concise responses with citations when possible." },
        { role: "user", content: query }
      ];

      const chatParams: any = {
        model: options.model || "sonar",
        messages,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.1,
      };

      // Add search options if provided
      if (options.searchRecencyFilter || options.searchDomainFilter || options.returnImages || options.returnRelatedQuestions) {
        chatParams.search_recency_filter = options.searchRecencyFilter;
        chatParams.search_domain_filter = options.searchDomainFilter;
        chatParams.return_images = options.returnImages || false;
        chatParams.return_related_questions = options.returnRelatedQuestions || false;
      }

      const response = await this.client.chat.completions.create(chatParams);

      return {
        content: response.choices[0]?.message?.content || '',
        citations: response.citations,
        images: response.images,
        relatedQuestions: response.related_questions,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Streaming chat completion
   */
  async *executeStreamingChatCompletion(
    query: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      messages?: any[];
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    try {
      const messages = options.messages || [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: query }
      ];

      const stream = await this.client.chat.completions.create({
        model: options.model || "sonar",
        messages,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.1,
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    } catch (error) {
      throw new Error(`Streaming chat completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Async chat completion for long-running tasks
   */
  async executeAsyncChatCompletion(
    query: string,
    options: {
      model?: string;
      maxTokens?: number;
      webhook?: string;
      messages?: any[];
    } = {}
  ): Promise<{
    requestId: string;
    status: string;
  }> {
    try {
      const messages = options.messages || [
        { role: "user", content: query }
      ];

      // Note: Async completions are only available for sonar-deep-research model
      const asyncRequest = await this.client.async.chat.completions.create({
        messages,
        model: options.model || "sonar-deep-research",
        max_tokens: options.maxTokens || 2000,
      });

      return {
        requestId: asyncRequest.request_id,
        status: asyncRequest.status,
      };
    } catch (error) {
      throw new Error(`Async chat completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimized concurrent execution with proper parallelization
   */
  private async executeConcurrent(
    queries: string[],
    options: {
      maxResults?: number;
      model?: string;
      concurrency?: number;
      timeout?: number;
    } = {}
  ): Promise<QueryResult[]> {
    const concurrency = Math.min(options.concurrency || 5, queries.length);
    const results: QueryResult[] = [];

    // Process queries in optimized batches
    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency);

      const batchPromises = batch.map(query =>
        this.executeSingle(query, {
          maxResults: options.maxResults,
          model: options.model,
          timeout: options.timeout,
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      results.push(...batchResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            query: batch[index],
            results: [],
            executionTime: 0,
            error: this.formatError(result.reason),
          };
        }
      }));
    }

    return results;
  }

  /**
   * Optimized search with smart mode selection
   */
  async search(
    config: SearchConfig,
    abortSignal?: AbortSignal
  ): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      let results: QueryResult[];

      if (config.mode === "single") {
        results = [await this.executeSingle(config.query!, {
          maxResults: config.maxResults,
          timeout: config.timeout,
        })];
      } else if (config.mode === "multi" && config.queries) {
        results = await this.executeMulti(config.queries, {
          maxResults: config.maxResults,
          concurrency: config.concurrency,
          timeout: config.timeout,
        });
      } else {
        throw new PerplexitySearchError(
          "Invalid search configuration",
          ErrorCode.UNEXPECTED_ERROR
        );
      }

      const executionTime = Date.now() - startTime;
      const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);

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

      return {
        success: false,
        results: [],
        error: this.formatError(error),
        metadata: {
          totalQueries: 0,
          totalResults: 0,
          executionTime,
          mode: config.mode,
        },
      };
    }
  }

  /**
   * High-performance batch processing
   */
  async processBatch(
    queries: string[],
    options: {
      maxResults?: number;
      batchSize?: number;
      concurrency?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<QueryResult[]> {
    const batchSize = options.batchSize || 20;
    const allResults: QueryResult[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await this.executeMulti(batch, {
        maxResults: options.maxResults,
        concurrency: options.concurrency,
      });

      allResults.push(...batchResults);

      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, queries.length), queries.length);
      }
    }

    return allResults;
  }

  /**
   * Optimized response transformation
   */
  private transformResponse(searchResponse: any, maxResults: number): SearchResult[] {
    if (!searchResponse.results || !Array.isArray(searchResponse.results)) {
      return [];
    }

    return searchResponse.results
      .slice(0, maxResults)
      .map((result: any) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        snippet: result.snippet || '',
        date: result.date || undefined,
      }));
  }

  /**
   * Extract specific query results from multi-query response
   */
  private extractQueryResults(searchResponse: any, queryIndex: number, maxResults: number): SearchResult[] {
    if (!searchResponse.results || !Array.isArray(searchResponse.results)) {
      return [];
    }

    // For multi-query responses, results are typically structured per query
    // This handles both array and object-based response formats
    if (Array.isArray(searchResponse.results[queryIndex])) {
      return searchResponse.results[queryIndex]
        .slice(0, maxResults)
        .map((result: any) => ({
          title: result.title || 'Untitled',
          url: result.url || '',
          snippet: result.snippet || '',
          date: result.date || undefined,
        }));
    }

    // Fallback to flat structure
    return this.transformResponse(searchResponse, maxResults);
  }

  /**
   * Consistent error formatting
   */
  private formatError(error: unknown): {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (error instanceof PerplexitySearchError) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
      };
    }

    return {
      code: ErrorCode.UNEXPECTED_ERROR,
      message: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? { stack: error.stack } : undefined,
    };
  }
}

/**
 * Simplified high-performance search functions
 */
export async function fastSearch(
  query: string,
  options: {
    maxResults?: number;
    model?: string;
    timeout?: number;
  } = {}
): Promise<{
  success: boolean;
  results?: SearchResult[];
  executionTime?: number;
  error?: string;
}> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Perplexity API key not found in environment variables",
      };
    }

    const engine = new OptimizedPerplexitySearchEngine(apiKey);
    const result = await engine.executeSingle(query, options);

    return {
      success: result.results.length > 0,
      results: result.results,
      executionTime: result.executionTime,
      error: result.error?.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fastMultiSearch(
  queries: string[],
  options: {
    maxResults?: number;
    model?: string;
    concurrency?: number;
    timeout?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  success: boolean;
  results?: QueryResult[];
  executionTime?: number;
  totalResults?: number;
  error?: string;
}> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "Perplexity API key not found in environment variables",
      };
    }

    const engine = new OptimizedPerplexitySearchEngine(apiKey);
    const startTime = performance.now();

    const results = await engine.processBatch(queries, {
      ...options,
      onProgress: options.onProgress,
    });

    const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
    const executionTime = performance.now() - startTime;

    return {
      success: true,
      results,
      executionTime,
      totalResults,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}