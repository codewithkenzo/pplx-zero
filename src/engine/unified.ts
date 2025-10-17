import Perplexity from '@perplexity-ai/perplexity_ai';
import type { SearchConfig, QueryResult, ToolOutput, StreamingEvent } from "../types.js";
import { PerplexitySearchError, ErrorCode } from "../types.js";
import type { SearchResult } from "../types.js";
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * File attachment interface for processing different file types
 */
export interface FileAttachment {
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
 * Unified environment variable handling with fallback strategy
 */
export function getApiKey(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY;
  if (!apiKey) {
    throw new PerplexitySearchError(
      "Perplexity API key is required. Set PERPLEXITY_API_KEY or PERPLEXITY_AI_API_KEY environment variable",
      ErrorCode.API_KEY_MISSING
    );
  }
  return apiKey;
}

/**
 * Public attachment processor utility
 */
export async function processFileAttachments(filePaths: string[]): Promise<FileAttachment[]> {
  const attachments: FileAttachment[] = [];

  for (const filePath of filePaths) {
    try {
      const fileExtension = extname(filePath).toLowerCase();
      const mimeType = SUPPORTED_FILE_TYPES[fileExtension as keyof typeof SUPPORTED_FILE_TYPES];

      if (!mimeType) {
        throw new PerplexitySearchError(
          `Unsupported file type: ${fileExtension}. Supported types: ${Object.keys(SUPPORTED_FILE_TYPES).join(', ')}`,
          ErrorCode.VALIDATION_ERROR
        );
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
      if (error instanceof PerplexitySearchError) {
        throw error;
      }
      throw new PerplexitySearchError(
        `Failed to process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.UNEXPECTED_ERROR,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  return attachments;
}

/**
 * Configuration interface for the unified engine
 */
export interface UnifiedEngineConfig {
  apiKey?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableResilience?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Unified Perplexity Search Engine
 * Consolidates functionality from OptimizedPerplexitySearchEngine and PerplexitySearchTool
 */
export class UnifiedPerplexityEngine {
  private readonly client: Perplexity;
  private readonly config: Required<UnifiedEngineConfig>;
  private readonly requestId: string;

  constructor(config: UnifiedEngineConfig = {}) {
    // Use provided API key or get from environment with fallback
    const apiKey = config.apiKey || getApiKey();

    this.config = {
      apiKey,
      defaultModel: config.defaultModel || 'sonar',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      enableResilience: config.enableResilience ?? true,
      logLevel: config.logLevel || 'info',
    };

    this.client = new Perplexity({ apiKey: this.config.apiKey });
    this.requestId = randomUUID();
  }

  /**
   * Execute search with smart mode selection
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
          model: undefined, // Will use default model
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
          ErrorCode.VALIDATION_ERROR
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
      const searchResponse = await this.executeWithTimeout(
        this.client.search.create({
          query,
          max_results: options.maxResults || 5,
          model: options.model || this.config.defaultModel,
        }),
        options.timeout || this.config.timeout
      );

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
        const searchResponse = await this.executeWithTimeout(
          this.client.search.create({
            query: queries,
            max_results: options.maxResults || 5,
            model: options.model || this.config.defaultModel,
          }),
          options.timeout || this.config.timeout
        );

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

      const response = await this.executeWithTimeout(
        this.client.chat.completions.create(chatParams),
        this.config.timeout
      );

      // Properly extract content from chat completion response
      let content = '';
      if (response && response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        if (choice && choice.message && choice.message.content) {
          content = choice.message.content;
        }
      }

      // Extract citations and images safely
      const citations = response && Array.isArray(response.citations) ? response.citations : [];
      const images = response && Array.isArray(response.images) ? response.images : [];

      return {
        content,
        citations,
        images,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      throw this.formatError(error);
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
      timeout?: number;
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
      const { model, attachments, webhook, timeout } = options;

      // Advanced models (sonar-pro, sonar-deep-research, sonar-reasoning) use chat completions
      if (model === 'sonar-pro' || model === 'sonar-deep-research' || model === 'sonar-reasoning') {
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
                : model === 'sonar-pro'
                ? "You are a helpful AI assistant. Provide comprehensive, detailed responses with thorough analysis and citations."
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
                : model === 'sonar-pro'
                ? "You are a helpful AI assistant. Provide comprehensive, detailed responses with thorough analysis and citations."
                : "You are a helpful AI assistant. Use step-by-step reasoning to provide accurate, well-reasoned responses."
            },
            { role: "user", content: query }
          ];
        }

        // Deep research model needs significantly more time (3-5 minutes)
        const effectiveTimeout = model === 'sonar-deep-research'
          ? Math.max(timeout || 300000, 300000) // Minimum 5 minutes for deep research
          : timeout || this.config.timeout;

        const response = await this.executeWithTimeout(
          this.client.chat.completions.create({
            model,
            messages,
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.1,
          }),
          effectiveTimeout
        );

        // Properly extract content from chat completion response
        let content = '';
        if (response && response.choices && response.choices.length > 0) {
          const choice = response.choices[0];
          if (choice && choice.message && choice.message.content) {
            content = choice.message.content;
          }
        }

        // Extract citations and images safely
        const citations = response && Array.isArray(response.citations) ? response.citations : [];
        const images = response && Array.isArray(response.images) ? response.images : [];

        return {
          content,
          citations,
          images,
          executionTime: performance.now() - startTime,
          isAsync: false,
        };
      }
    } catch (error) {
      // Format error properly for serialization
      const formattedError = this.formatError(error);
      throw new Error(JSON.stringify(formattedError));
    }

    // Default return for unsupported models
    return {
      executionTime: performance.now() - startTime,
      isAsync: false,
    };
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
        model: options.model || this.config.defaultModel,
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

      const response = await this.executeWithTimeout(
        this.client.chat.completions.create(chatParams),
        this.config.timeout
      );

      // Properly extract content from chat completion response
      let content = '';
      if (response && response.choices && response.choices.length > 0) {
        const choice = response.choices[0];
        if (choice && choice.message && choice.message.content) {
          content = choice.message.content;
        }
      }

      // Extract additional fields safely
      const citations = response && Array.isArray(response.citations) ? response.citations : [];
      const images = response && Array.isArray(response.images) ? response.images : [];
      const relatedQuestions = response && Array.isArray(response.related_questions) ? response.related_questions : [];

      return {
        content,
        citations,
        images,
        relatedQuestions,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      throw this.formatError(error);
    }
  }

  /**
   * Streaming chat completion with abort signal support
   */
  async *executeStreamingChatCompletion(
    query: string,
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      messages?: any[];
    } = {},
    abortSignal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Check if operation is already aborted
      if (abortSignal?.aborted) {
        throw new Error('Operation was cancelled before it started');
      }

      const messages = options.messages || [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: query }
      ];

      // Create abortable timeout
      const timeoutPromise = abortSignal
        ? new Promise<never>((_, reject) => {
            const handleAbort = () => {
              reject(new Error('Operation was cancelled'));
            };
            abortSignal.addEventListener('abort', handleAbort, { once: true });
          })
        : null;

      // Create the stream with abort signal support
      const streamPromise = this.client.chat.completions.create({
        model: options.model || this.config.defaultModel,
        messages,
        max_tokens: options.maxTokens || 4000,
        temperature: options.temperature || 0.1,
        stream: true,
      });

      // Race between stream creation and abort
      const stream = timeoutPromise
        ? await Promise.race([streamPromise, timeoutPromise])
        : await streamPromise;

      // Process the stream with abort checking
      for await (const chunk of stream) {
        // Check for abort before processing each chunk
        if (abortSignal?.aborted) {
          throw new Error('Operation was cancelled during streaming');
        }

        if (chunk.choices[0]?.delta?.content) {
          yield chunk.choices[0].delta.content;
        }
      }
    } catch (error) {
      // Check if this is an abort error
      if (abortSignal?.aborted && error instanceof Error) {
        throw new Error('Operation was cancelled');
      }
      throw this.formatError(error);
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
      throw this.formatError(error);
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
   * Execute with timeout and optional retry logic
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout?: number,
    retries = 0
  ): Promise<T> {
    const timeoutMs = timeout || this.config.timeout;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
        })
      ]);
    } catch (error) {
      // Implement retry logic if enabled
      if (this.config.enableResilience && retries < this.config.maxRetries) {
        const isRetryable = this.isRetryableError(error);
        if (isRetryable) {
          await this.delay(this.config.retryDelay * Math.pow(2, retries));
          return this.executeWithTimeout(promise, timeout, retries + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('rate limit') ||
             message.includes('timeout') ||
             message.includes('network') ||
             message.includes('connection');
    }
    return false;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Consistent error formatting with canonical error codes
   */
  private formatError(error: unknown): {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  } {
    // Handle stringified errors (from JSON.parse)
    if (typeof error === 'string') {
      try {
        const parsed = JSON.parse(error);
        if (parsed.code && parsed.message) {
          return parsed;
        }
      } catch {
        // Not a JSON string, continue with normal processing
      }
    }

    if (error instanceof PerplexitySearchError) {
      return {
        code: error.code as ErrorCode,
        message: error.message,
        details: error.details,
      };
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Map common error patterns to canonical error codes
      if (message.includes('api key') || message.includes('unauthorized')) {
        return {
          code: ErrorCode.API_KEY_MISSING,
          message: error.message,
          details: { originalError: error.stack },
        };
      }

      if (message.includes('rate limit') || message.includes('too many requests')) {
        return {
          code: ErrorCode.RATE_LIMIT_ERROR,
          message: error.message,
          details: { originalError: error.stack },
        };
      }

      if (message.includes('timeout') || message.includes('aborted')) {
        return {
          code: ErrorCode.TIMEOUT_ERROR,
          message: error.message,
          details: { originalError: error.stack },
        };
      }

      if (message.includes('network') || message.includes('enotfound') || message.includes('connection')) {
        return {
          code: ErrorCode.NETWORK_ERROR,
          message: error.message,
          details: { originalError: error.stack },
        };
      }

      return {
        code: ErrorCode.UNEXPECTED_ERROR,
        message: error.message,
        details: { stack: error.stack },
      };
    }

    return {
      code: ErrorCode.UNEXPECTED_ERROR,
      message: "Unknown error occurred",
      details: { originalError: String(error) },
    };
  }

  /**
   * Get engine configuration and status
   */
  getConfig(): Required<UnifiedEngineConfig> & { requestId: string } {
    return {
      ...this.config,
      requestId: this.requestId,
    };
  }

  /**
   * Health check for the engine
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    apiKeyPresent: boolean;
    lastCheck: string;
    requestId: string;
  }> {
    try {
      // Simple health check - try to validate API key
      const apiKeyPresent = !!this.config.apiKey;

      return {
        healthy: apiKeyPresent,
        apiKeyPresent,
        lastCheck: new Date().toISOString(),
        requestId: this.requestId,
      };
    } catch (error) {
      return {
        healthy: false,
        apiKeyPresent: false,
        lastCheck: new Date().toISOString(),
        requestId: this.requestId,
      };
    }
  }
}

/**
 * Factory function to create unified engine with optional configuration
 */
export function createPerplexityEngine(config?: UnifiedEngineConfig): UnifiedPerplexityEngine {
  return new UnifiedPerplexityEngine(config);
}

/**
 * Backward compatibility exports
 */
export { UnifiedPerplexityEngine as OptimizedPerplexitySearchEngine };
export { processFileAttachments as processAttachments };