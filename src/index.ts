import { randomUUID } from 'node:crypto';
import { search as perplexitySearch } from 'perplexityai';
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
  EventV1
} from './schema.js';
import { BoundedConcurrencyPool } from './util/concurrency.js';
import { WorkspaceSandbox } from './util/fs.js';
import { ResilienceManager, DEFAULT_CONFIGS } from './util/resilience.js';
import { Logger, MetricsCollector, createLogger } from './util/monitoring.js';

export class PerplexitySearchTool {
  private client: typeof perplexitySearch;
  private workspace: WorkspaceSandbox;
  private resilience: ResilienceManager;
  private logger: Logger;
  private metrics: MetricsCollector;

  constructor(
    workspacePath?: string,
    options: {
      resilienceProfile?: 'conservative' | 'balanced' | 'aggressive' | 'custom';
      resilienceConfig?: any;
      logLevel?: 'debug' | 'info' | 'warn' | 'error';
    } = {}
  ) {
    const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY or PERPLEXITY_AI_API_KEY environment variable is required');
    }
    
    this.client = perplexitySearch;
    this.workspace = new WorkspaceSandbox(workspacePath);
    
    // Initialize resilience patterns
    const resilienceConfig = options.resilienceProfile && options.resilienceProfile !== 'custom'
      ? DEFAULT_CONFIGS[options.resilienceProfile]
      : options.resilienceConfig || DEFAULT_CONFIGS.balanced;
    this.resilience = new ResilienceManager(resilienceConfig);
    
    // Initialize monitoring
    this.logger = createLogger({
      component: 'PerplexitySearchTool',
      workspace: workspacePath,
      resilienceProfile: options.resilienceProfile || 'balanced',
    });
    
    this.metrics = new MetricsCollector();
    
    this.logger.info('PerplexitySearchTool initialized', {
      workspace: workspacePath,
      resilienceProfile: options.resilienceProfile || 'balanced',
    });
  }

  async runTask(input: SearchInputV1, signal?: AbortSignal): Promise<SearchOutputV1> {
    const startTime = Date.now();
    const id = input.id || randomUUID();
    const traceLogger = this.logger.withContext({ taskId: id });
    
    try {
      // Validate input against schema
      const validatedInput = SearchInputV1Schema.parse(input);
      
      traceLogger.info('Starting search task', {
        query: validatedInput.args.query,
        maxResults: validatedInput.args.maxResults,
        country: validatedInput.args.country,
      });
      
      // Set up timeout
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
            this.performSearch(validatedInput.args, controller.signal)
          ),
          {
            query: validatedInput.args.query,
            maxResults: validatedInput.args.maxResults,
            country: validatedInput.args.country,
          }
        );
        
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.metrics.recordMetric('search_duration', duration, 'ms', {
          query: validatedInput.args.query,
          success: 'true',
        });
        this.metrics.incrementCounter('search_requests_total', 1, { status: 'success' });
        this.metrics.recordHistogram('search_result_count', result.length, {
          maxResults: validatedInput.args.maxResults?.toString(),
        });
        
        traceLogger.info('Search task completed successfully', {
          resultCount: result.length,
          duration,
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
      
      // Record error metrics
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
      // Validate batch input
      const validatedBatch = BatchSearchInputV1Schema.parse(batchInput);
      
      const concurrency = validatedBatch.options?.concurrency || 5;
      const pool = new BoundedConcurrencyPool(concurrency);
      
      // Create enhanced inputs with default IDs
      const enhancedInputs = validatedBatch.requests.map((req, index) => ({
        ...req,
        id: req.id || randomUUID(),
        options: {
          ...req.options,
          timeoutMs: req.options?.timeoutMs || validatedBatch.options?.timeoutMs || 30000,
        },
      }));

      const results = await pool.execute(enhancedInputs, async (input) => {
        return this.runTask(input as SearchInputV1, signal);
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

  private async performSearch(query: SearchQuery, signal: AbortSignal): Promise<SearchResult[]> {
    try {
      // The perplexityai package returns { concise, detailed, sources }
      const searchResult = await this.client(query.query);

      // Transform the sources array to our SearchResult format
      if (searchResult.sources && Array.isArray(searchResult.sources)) {
        return searchResult.sources.map((source: any) => ({
          title: source.name || 'Untitled',
          url: source.url || '',
          snippet: searchResult.detailed || searchResult.concise || '',
          date: undefined, // perplexityai doesn't provide date info
        }));
      }

      // If no sources, return a single result with the text content
      return [{
        title: 'Search Result',
        url: 'https://www.perplexity.ai/',
        snippet: searchResult.detailed || searchResult.concise || 'No content available',
        date: undefined,
      }];
    } catch (error) {
      // Transform API errors to our error format
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Search request timed out');
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

  // Event logging utility
  createEvent(level: EventV1['level'], event: string, id?: string, data?: unknown): EventV1 {
    return {
      time: new Date().toISOString(),
      level,
      event,
      id,
      data,
    };
  }

  // Health and metrics methods
  getHealthStatus(): {
    healthy: boolean;
    apiKeyPresent: boolean;
    workspaceValid: boolean;
    resilienceStats: any;
    timestamp: string;
  } {
    const apiKeyPresent = !!(process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY);
    const workspaceValid = this.workspace.getWorkspacePath() !== null;
    const resilienceStats = this.resilience.getStats();
    
    return {
      healthy: apiKeyPresent && workspaceValid,
      apiKeyPresent,
      workspaceValid,
      resilienceStats,
      timestamp: new Date().toISOString(),
    };
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

  // Method to register health checks
  registerHealthChecks(healthChecker: any): void {
    healthChecker.registerCheck('api_key', async () => {
      return !!(process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY);
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
      // Consider unhealthy if circuit breaker is open
      return stats.circuitBreaker.state !== 'OPEN';
    });
  }
}

// Re-export schemas for external use
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
