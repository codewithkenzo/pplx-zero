import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  SearchInputV1Schema,
  BatchSearchInputV1Schema,
  SearchInputV1,
  SearchOutputV1,
  BatchSearchInputV1,
  BatchOutputV1,
  SearchQuery,
  SearchResult,
  ERROR_CODES,
  EventV1,
  SonarModel,
  Attachment,
  AttachmentInput
} from './schema.js';
import { BoundedConcurrencyPool } from './util/concurrency.js';
import { WorkspaceSandbox } from './util/fs.js';
import { ResilienceManager, DEFAULT_CONFIGS } from './util/resilience.js';
import { Logger, MetricsCollector, createLogger } from './util/monitoring.js';
import { processAttachments, validateAttachmentInputs } from './util/attachments.js';
import { createAsyncJob, startAsyncJob, completeAsyncJob, failAsyncJob, sendWebhook, getAsyncJob } from './util/async.js';
import { UnifiedPerplexityEngine, getApiKey, type FileAttachment } from './engine/unified.js';

export class PerplexitySearchTool {
  private engine: UnifiedPerplexityEngine;
  private workspace: WorkspaceSandbox;
  private resilience: ResilienceManager;
  private logger: Logger;
  private metrics: MetricsCollector;
  private defaultModel: SonarModel;

  constructor(
    workspacePath?: string,
    options: {
      resilienceProfile?: 'conservative' | 'balanced' | 'aggressive' | 'custom';
      resilienceConfig?: any;
      logLevel?: 'debug' | 'info' | 'warn' | 'error';
      defaultModel?: SonarModel;
    } = {}
  ) {
    // Use unified engine with environment variable fallback
    this.engine = new UnifiedPerplexityEngine({
      apiKey: getApiKey(),
      defaultModel: options.defaultModel || 'sonar',
      enableResilience: true,
      logLevel: options.logLevel || 'info',
    });

    this.workspace = new WorkspaceSandbox(workspacePath);
    this.defaultModel = options.defaultModel || 'sonar';

    const resilienceConfig = options.resilienceProfile && options.resilienceProfile !== 'custom'
      ? DEFAULT_CONFIGS[options.resilienceProfile]
      : options.resilienceConfig || DEFAULT_CONFIGS.balanced;
    this.resilience = new ResilienceManager(resilienceConfig);

    this.logger = createLogger({
      component: 'PerplexitySearchTool',
      workspace: workspacePath,
      resilienceProfile: options.resilienceProfile || 'balanced',
    });

    this.metrics = new MetricsCollector();

    this.logger.info('PerplexitySearchTool initialized', {
      workspace: workspacePath,
      resilienceProfile: options.resilienceProfile || 'balanced',
      defaultModel: this.defaultModel,
    });
  }

  async runTask(input: SearchInputV1, signal?: AbortSignal): Promise<SearchOutputV1> {
    const startTime = Date.now();
    const id = input.id || randomUUID();
    const traceLogger = this.logger.withContext({ taskId: id });

    try {
      const validatedInput = SearchInputV1Schema.parse(input);

      traceLogger.info('Starting search task', {
        query: validatedInput.args.query,
        model: validatedInput.args.model || this.defaultModel,
        maxResults: validatedInput.args.maxResults,
        country: validatedInput.args.country,
        hasAttachments: validatedInput.args.attachments && validatedInput.args.attachments.length > 0,
        hasAttachmentInputs: validatedInput.args.attachmentInputs && validatedInput.args.attachmentInputs.length > 0,
        async: validatedInput.options?.async,
        webhook: validatedInput.options?.webhook,
      });

      // Process attachment inputs if provided
      let attachments: Attachment[] = [];
      if (validatedInput.args.attachmentInputs && validatedInput.args.attachmentInputs.length > 0) {
        const validation = validateAttachmentInputs(validatedInput.args.attachmentInputs);
        if (!validation.valid) {
          throw new Error(`Attachment validation failed: ${validation.errors.join(', ')}`);
        }

        attachments = await processAttachments(validatedInput.args.attachmentInputs);
      } else if (validatedInput.args.attachments) {
        attachments = validatedInput.args.attachments;
      }

  
      const timeoutMs = validatedInput.options?.timeoutMs || 30000;
      const controller = new AbortController();

      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const { result, metrics } = await traceLogger.measure(
          'search_operation',
          () => this.resilience.execute(() =>
            this.performChatCompletion(validatedInput.args, attachments, controller.signal)
          ),
          {
            query: validatedInput.args.query,
            model: validatedInput.args.model || this.defaultModel,
            maxResults: validatedInput.args.maxResults,
            country: validatedInput.args.country,
            attachmentCount: attachments.length,
          }
        );

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;

        this.metrics.recordMetric('search_duration', duration, 'ms', {
          query: validatedInput.args.query,
          model: validatedInput.args.model || this.defaultModel,
          success: 'true',
        });
        this.metrics.incrementCounter('search_requests_total', 1, { status: 'success' });
        this.metrics.recordHistogram('search_result_count', result.length, {
          maxResults: validatedInput.args.maxResults?.toString(),
        });

        traceLogger.info('Search task completed successfully', {
          resultCount: result.length,
          duration,
          model: validatedInput.args.model || this.defaultModel,
        });

        return {
          id,
          ok: true,
          data: {
            query: validatedInput.args.query,
            results: result,
            totalCount: result.length,
          },
          duration,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      this.metrics.incrementCounter('search_requests_total', 1, {
        status: 'error',
        errorType: this.getErrorCode(error),
      });
      this.metrics.recordMetric('search_duration', duration, 'ms', {
        success: 'false',
        errorType: this.getErrorCode(error),
      });

      traceLogger.error('Search task failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          duration,
          errorCode: this.getErrorCode(error),
        }
      );

      return {
        id,
        ok: false,
        error: {
          code: this.getErrorCode(error),
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof Error ? error.stack : undefined,
        },
        duration,
      };
    }
  }

  async runBatch(batchInput: BatchSearchInputV1, signal?: AbortSignal): Promise<BatchOutputV1> {
    const startTime = Date.now();

    try {
      const basicBatchSchema = BatchSearchInputV1Schema.omit({ requests: true }).extend({
        requests: z.array(z.any()).min(1).max(100), // Accept any requests, validate individually
      });
      const validatedBatch = basicBatchSchema.parse(batchInput);

      const concurrency = validatedBatch.options?.concurrency || 5;
      const pool = new BoundedConcurrencyPool(concurrency);

      const enhancedInputs = validatedBatch.requests.map((req, index) => ({
        ...req,
        id: req.id || randomUUID(),
        options: {
          ...req.options,
          timeoutMs: req.options?.timeoutMs || validatedBatch.options?.timeoutMs || 30000,
        },
      }));

      const results = await pool.execute(enhancedInputs, async (input) => {
        try {
          const validatedRequest = SearchInputV1Schema.parse(input);
          return await this.runTask(validatedRequest, signal);
        } catch (error) {
          return {
            id: input.id || randomUUID(),
            ok: false,
            error: {
              code: ERROR_CODES.VALIDATION_FAILED,
              message: error instanceof Error ? error.message : String(error),
              details: error instanceof Error ? error.stack : undefined,
            },
            duration: 0,
          };
        }
      });

      const successful = results.filter(r => r.ok).length;
      const failed = results.length - successful;
      const totalDuration = Date.now() - startTime;

      return {
        version: validatedBatch.version,
        ok: failed === 0 || !validatedBatch.options?.failFast,
        summary: {
          total: results.length,
          successful,
          failed,
          totalDuration,
        },
        results,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      return {
        version: '1.0.0',
        ok: false,
        summary: {
          total: 0,
          successful: 0,
          failed: 1,
          totalDuration,
        },
        results: [{
          id: randomUUID(),
          ok: false,
          error: {
            code: this.getErrorCode(error),
            message: error instanceof Error ? error.message : String(error),
            details: error instanceof Error ? error.stack : undefined,
          },
          duration: totalDuration,
        }],
      };
    }
  }

  private async performChatCompletion(query: SearchQuery, attachments: Attachment[], signal: AbortSignal): Promise<SearchResult[]> {
    try {
      // Convert Attachment interface to FileAttachment interface for unified engine
      const fileAttachments: FileAttachment[] = attachments.map(att => ({
        path: att.url, // Use URL as path for external attachments
        type: att.mimeType.startsWith('image/') ? 'image' : 'document',
        mimeType: att.mimeType,
        content: att.content || Buffer.from(''), // Handle base64 content
        filename: att.name || 'attachment',
      }));

      // Use unified engine's chat completion with attachments
      const result = await this.engine.executeChatWithAttachments(query.query, fileAttachments, {
        model: query.model || this.defaultModel,
        maxTokens: 4000,
        temperature: 0.1,
      });

      // Convert response back to SearchResult format
      const results: SearchResult[] = [];

      // Add main response as a search result
      results.push({
        title: 'AI Response',
        url: 'https://www.perplexity.ai/',
        snippet: result.content,
        date: new Date().toISOString().split('T')[0],
      });

      // Ensure we don't exceed the max results requested
      const maxResults = query.maxResults || 5;
      return results.slice(0, maxResults);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Chat completion request timed out');
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('API key')) return ERROR_CODES.API_KEY_MISSING;
      if (error.message.includes('rate limit')) return ERROR_CODES.API_RATE_LIMIT;
      if (error.message.includes('timeout')) return ERROR_CODES.TIMEOUT;
      if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        return ERROR_CODES.NETWORK_ERROR;
      }
    }
    return ERROR_CODES.API_ERROR;
  }

  createEvent(level: EventV1['level'], event: string, id?: string, data?: unknown): EventV1 {
    return {
      time: new Date().toISOString(),
      level,
      event,
      id,
      data,
    };
  }

  getHealthStatus(): {
    healthy: boolean;
    apiKeyPresent: boolean;
    workspaceValid: boolean;
    resilienceStats: any;
    timestamp: string;
  } {
    try {
      const apiKeyPresent = !!getApiKey();
      const workspaceValid = this.workspace.getWorkspacePath() !== null;
      const resilienceStats = this.resilience.getStats();

      return {
        healthy: apiKeyPresent && workspaceValid,
        apiKeyPresent,
        workspaceValid,
        resilienceStats,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        healthy: false,
        apiKeyPresent: false,
        workspaceValid: false,
        resilienceStats: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  getMetrics(): {
    metrics: any;
    resilienceStats: any;
    timestamp: string;
  } {
    return {
      metrics: this.metrics.getSnapshot(),
      resilienceStats: this.resilience.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  resetMetrics(): void {
    this.metrics.reset();
  }

  resetCircuitBreaker(): void {
    this.resilience.resetCircuitBreaker();
  }

  registerHealthChecks(healthChecker: any): void {
    healthChecker.registerCheck('api_key', async () => {
      try {
        return !!getApiKey();
      } catch {
        return false;
      }
    });

    healthChecker.registerCheck('workspace', async () => {
      try {
        return this.workspace.getWorkspacePath() !== null;
      } catch {
        return false;
      }
    });

    healthChecker.registerCheck('resilience', async () => {
      const stats = this.resilience.getStats();
      return stats.circuitBreaker.state !== 'OPEN';
    });

    healthChecker.registerCheck('engine', async () => {
      const health = await this.engine.healthCheck();
      return health.healthy;
    });
  }
}

export {
  SearchInputV1Schema,
  BatchSearchInputV1Schema,
  SearchOutputV1Schema,
  BatchOutputV1Schema,
  EventV1Schema,
  type SearchInputV1,
  type BatchSearchInputV1,
  type SearchOutputV1,
  type BatchOutputV1,
  type EventV1,
} from './schema.js';
