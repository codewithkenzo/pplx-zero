import Perplexity from '@perplexity-ai/perplexity_ai';
import type { SearchConfig, QueryResult, ToolOutput, StreamingEvent } from "./types.js";
import { PerplexitySearchError, ErrorCode } from "./types.js";
import type { SearchResult } from "./schema.js";
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

/**
 * File attachment interface for processing different file types
 */
interface FileAttachment {
  path: string;
  type: 'image' | 'document' | 'data';
  mimeType: string;
  content: string | Buffer;
  filename: string;
}

/**
 * Supported file types and their MIME types
 */
const SUPPORTED_FILE_TYPES = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',

  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
} as const;

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
   * Process file attachments for Chat API
   */
  private async processFileAttachments(filePaths: string[]): Promise<FileAttachment[]> {
    const attachments: FileAttachment[] = [];

    for (const filePath of filePaths) {
      try {
        const fileExtension = extname(filePath).toLowerCase();
        const mimeType = SUPPORTED_FILE_TYPES[fileExtension as keyof typeof SUPPORTED_FILE_TYPES];

        if (!mimeType) {
          throw new Error(`Unsupported file type: ${fileExtension}. Supported types: ${Object.keys(SUPPORTED_FILE_TYPES).join(', ')}`);
        }

        const content = await readFile(filePath);
        const filename = filePath.split('/').pop() || filePath;

        // Determine file type category
        let type: 'image' | 'document' | 'data';
        if (mimeType.startsWith('image/')) {
          type = 'image';
        } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('markdown')) {
          type = 'document';
        } else {
          type = 'data';
        }

        attachments.push({
          path: filePath,
          type,
          mimeType,
          content,
          filename,
        });
      } catch (error) {
        throw new Error(`Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return attachments;
  }

  /**
   * Execute Chat API with file attachments
   */
  async executeChatWithAttachments(
    query: string,
    attachments: FileAttachment[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<{
    content: string;
    citations?: string[];
    images?: any[];
    executionTime: number;
  }> {
    const startTime = performance.now();

    try {
      // Create user message with attachments
      const userMessage: any = {
        role: "user",
        content: [
          { type: "text", text: query }
        ]
      };

      // Add attachments to the message
      for (const attachment of attachments) {
        if (attachment.type === 'image') {
          userMessage.content.push({
            type: "image_url",
            image_url: {
              url: `data:${attachment.mimeType};base64,${attachment.content.toString('base64')}`
            }
          });
        } else {
          // For documents, add as text content
          const textContent = attachment.content instanceof Buffer
            ? attachment.content.toString('utf-8')
            : attachment.content;

          userMessage.content.push({
            type: "text",
            text: `\n\n[Document: ${attachment.filename}]\n${textContent}`
          });
        }
      }

      const messages = [
        {
          role: "system",
          content: "You are a helpful AI assistant. Analyze the provided files and query accurately. Provide citations when possible."
        },
        userMessage
      ];

      const chatParams: any = {
        model: options.model || "sonar-pro",
        messages,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.1,
      };

      const response = await this.client.chat.completions.create(chatParams);

      return {
        content: response.choices[0]?.message?.content || '',
        citations: response.citations,
        images: response.images,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Chat completion with attachments failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute advanced model (reasoning/deep-research) with proper routing
   */
  async executeAdvancedModel(
    query: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
      attachments?: FileAttachment[];
      webhook?: string;
    } = {}
  ): Promise<{
    content?: string;
    requestId?: string;
    status?: string;
    citations?: string[];
    images?: any[];
    executionTime: number;
    isAsync: boolean;
  }> {
    const startTime = performance.now();

    try {
      const { model, attachments, webhook } = options;

      // Deep research and reasoning models use chat completions
      if (model === 'sonar-deep-research' || model === 'sonar-reasoning') {
        let messages: any[] = [];

        if (attachments && attachments.length > 0) {
          // Process with attachments
          const userMessage: any = {
            role: "user",
            content: [
              { type: "text", text: query }
            ]
          };

          for (const attachment of attachments) {
            if (attachment.type === 'image') {
              userMessage.content.push({
                type: "image_url",
                image_url: {
                  url: `data:${attachment.mimeType};base64,${attachment.content.toString('base64')}`
                }
              });
            } else {
              const textContent = attachment.content instanceof Buffer
                ? attachment.content.toString('utf-8')
                : attachment.content;

              userMessage.content.push({
                type: "text",
                text: `\n\n[Document: ${attachment.filename}]\n${textContent}`
              });
            }
          }

          messages = [
            {
              role: "system",
              content: model === 'sonar-deep-research'
                ? "You are a helpful AI assistant. Conduct thorough research and analysis. Provide detailed, well-cited responses."
                : "You are a helpful AI assistant. Use step-by-step reasoning to provide accurate, well-reasoned responses."
            },
            userMessage
          ];
        } else {
          messages = [
            {
              role: "system",
              content: model === 'sonar-deep-research'
                ? "You are a helpful AI assistant. Conduct thorough research and analysis. Provide detailed, well-cited responses."
                : "You are a helpful AI assistant. Use step-by-step reasoning to provide accurate, well-reasoned responses."
            },
            { role: "user", content: query }
          ];
        }

        const response = await this.client.chat.completions.create({
          model,
          messages,
          max_tokens: options.maxTokens || 4000,
          temperature: options.temperature || 0.1,
        });

        return {
          content: response.choices[0]?.message?.content || '',
          citations: response.citations,
          images: response.images,
          executionTime: performance.now() - startTime,
          isAsync: false,
        };
      }
    } catch (error) {
      throw new Error(`Advanced model execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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