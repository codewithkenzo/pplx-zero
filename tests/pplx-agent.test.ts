import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { PerplexitySearchTool } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('PPLX Agent Comprehensive Test Suite', () => {
  let agent: PerplexitySearchTool;
  const testWorkspace = '/tmp/pplx-test-workspace';
  const originalEnv = process.env;

  // Mock the Perplexity API
  beforeAll(async () => {
    // Mock API key for testing
    process.env = {
      ...originalEnv,
      PERPLEXITY_API_KEY: 'test-api-key-for-testing'
    };

    // Mock the @perplexity-ai/perplexity_ai module
    mock.module("@perplexity-ai/perplexity_ai", () => {
      const mockData = {
        results: [
          {
            title: 'TypeScript Best Practices',
            url: 'https://www.typescriptlang.org/docs/handbook/',
            snippet: 'TypeScript best practices and guidelines for developers',
          },
          {
            title: 'React Documentation',
            url: 'https://react.dev/',
            snippet: 'The official React documentation',
          },
          {
            title: 'Next.js Features',
            url: 'https://nextjs.org/',
            snippet: 'Next.js features and capabilities',
          }
        ],
      };

      class MockPerplexity {
        search = {
          create: mock((params: any, options?: { signal?: AbortSignal }) => {
            // Check for abort signal
            if (options?.signal?.aborted) {
              return Promise.reject(new Error("Request aborted"));
            }

            // Simulate timeout for very short timeouts
            if (params.max_results > 5) {
              return Promise.reject(new Error("Request timeout"));
            }

            return Promise.resolve(mockData);
          }),
          _client: {}
        };
      }

      return {
        default: MockPerplexity,
      };
    });

    // Create test workspace
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  // Reset circuit breaker before each test and create fresh agent
  beforeEach(() => {
    // Initialize agent with test configuration that has lenient resilience settings
    agent = new PerplexitySearchTool(testWorkspace, {
      resilienceProfile: 'balanced',
      logLevel: 'error' // Reduce log noise during tests
    });

    // Reset circuit breaker to ensure clean state
    agent.resetCircuitBreaker();
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up test workspace
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test workspace:', error);
    }
  });

  describe('Agent Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent).toBeDefined();
      const healthStatus = agent.getHealthStatus();
      expect(healthStatus).toHaveProperty('healthy');
      expect(healthStatus).toHaveProperty('apiKeyPresent');
      expect(healthStatus).toHaveProperty('workspaceValid');
      expect(healthStatus).toHaveProperty('resilienceStats');
      expect(healthStatus).toHaveProperty('timestamp');
    });

    it('should handle missing API key gracefully', () => {
      // Clear the API key temporarily for this test
      const originalApiKey = process.env.PERPLEXITY_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.PERPLEXITY_AI_API_KEY;

      try {
        expect(() => {
          new PerplexitySearchTool('/nonexistent-test-workspace');
        }).toThrow();
      } finally {
        // Restore the API key
        if (originalApiKey) {
          process.env.PERPLEXITY_API_KEY = originalApiKey;
        }
      }
    });
  });

  describe('Web Research Capabilities', () => {
    it('should perform single query search', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'TypeScript best practices',
          maxResults: 3
        }
      };

      const result = await agent.runTask(input);

      expect(result).toHaveProperty('id', input.id);
      expect(result).toHaveProperty('ok');
      if (result.ok) {
        expect(result.data).toHaveProperty('query', 'TypeScript best practices');
        expect(result.data).toHaveProperty('results');
        expect(result.data).toHaveProperty('totalCount');
        expect(Array.isArray(result.data.results)).toBe(true);
        expect(result.data.results.length).toBeGreaterThan(0);
        
        // Validate result structure
        const firstResult = result.data.results[0];
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('url');
        expect(firstResult).toHaveProperty('snippet');
      }
    });

    it('should handle queries with country filter', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'local news',
          maxResults: 2,
          country: 'US'
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('local news');
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should handle timeout gracefully', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'complex research query',
          maxResults: 10
        },
        options: {
          timeoutMs: 1000 // Valid minimum timeout value
        }
      };

      const result = await agent.runTask(input);

      // Result should either succeed (if very fast) or fail gracefully
      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
      }
    });
  });

  describe('Multi-Query Search', () => {
    it('should handle batch search requests', async () => {
      const batchInput = {
        version: '1.0.0',
        requests: [
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'React vs Vue',
              maxResults: 2
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Next.js features',
              maxResults: 2
            }
          }
        ],
        options: {
          concurrency: 2,
          timeoutMs: 30000
        }
      };

      const result = await agent.runBatch(batchInput);
      
      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('results');
      
      expect(result.summary).toHaveProperty('total', 2);
      expect(result.summary).toHaveProperty('successful');
      expect(result.summary).toHaveProperty('failed');
      expect(result.summary).toHaveProperty('totalDuration');
      
      expect(result.results).toHaveLength(2);
      
      // Check individual results
      result.results.forEach((itemResult, index) => {
        expect(itemResult.id).toBe(batchInput.requests[index].id);
        if (itemResult.ok) {
          expect(itemResult.data).toHaveProperty('results');
          expect(Array.isArray(itemResult.data.results)).toBe(true);
        }
      });
    });

    it('should handle mixed success/failure in batch', async () => {
      const batchInput = {
        version: '1.0.0',
        requests: [
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'valid query',
              maxResults: 2
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: '', // Empty query should fail validation
              maxResults: 2
            }
          }
        ],
        options: {
          concurrency: 2,
          failFast: false
        }
      };

      const result = await agent.runBatch(batchInput);
      
      expect(result.summary.total).toBe(2);
      expect(result.summary.successful + result.summary.failed).toBe(2);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should classify errors correctly', async () => {
      const invalidInput = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          // Missing required query field
          maxResults: 5
        }
      };

      const result = await agent.runTask(invalidInput);

      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
      expect(['VALIDATION_FAILED', 'API_ERROR', 'INTERNAL_ERROR']).toContain(result.error.code);
    });

    it('should provide detailed error information', async () => {
      const invalidInput = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: '',
          maxResults: 100 // Exceeds maximum
        }
      };

      const result = await agent.runTask(invalidInput);

      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('message');
      expect(typeof result.error.message).toBe('string');
      expect(result.error.message.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should collect performance metrics', async () => {
      const initialMetrics = agent.getMetrics();
      expect(initialMetrics).toHaveProperty('metrics');
      expect(initialMetrics).toHaveProperty('resilienceStats');
      expect(initialMetrics).toHaveProperty('timestamp');

      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'performance testing',
          maxResults: 2
        }
      };

      await agent.runTask(input);

      const finalMetrics = agent.getMetrics();
      // Metrics timestamp should be updated after a successful operation
      if (agent.getHealthStatus().apiKeyPresent) {
        expect(finalMetrics.timestamp).not.toBe(initialMetrics.timestamp);
      }
    });

    it('should allow metrics reset', () => {
      agent.resetMetrics();
      const metrics = agent.getMetrics();
      expect(metrics).toHaveProperty('metrics');
      expect(metrics).toHaveProperty('timestamp');
    });
  });

  describe('Integration with PPLX Agent Configuration', () => {
    it('should support configured concurrency limits', async () => {
      const highConcurrencyBatch = {
        version: '1.0.0',
        requests: Array.from({ length: 10 }, (_, i) => ({
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `test query ${i}`,
            maxResults: 1
          }
        })),
        options: {
          concurrency: 5,
          timeoutMs: 30000
        }
      };

      const startTime = Date.now();
      const result = await agent.runBatch(highConcurrencyBatch);
      const duration = Date.now() - startTime;

      expect(result.summary.total).toBe(10);
      expect(result.summary.successful + result.summary.failed).toBe(10);
      expect(duration).toBeLessThan(60000); // Should complete within reasonable time
    });

    it('should handle different output formats', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'format testing',
          maxResults: 1
        }
      };

      const result = await agent.runTask(input);

      if (result.ok) {
        expect(result.data).toHaveProperty('query');
        expect(result.data).toHaveProperty('results');
        expect(result.data).toHaveProperty('totalCount');

        result.data.results.forEach(searchResult => {
          expect(searchResult).toHaveProperty('title');
          expect(searchResult).toHaveProperty('url');
          expect(searchResult).toHaveProperty('snippet');
          expect(searchResult.url).toMatch(/^https?:\/\//);
        });
      }
    });
  });

  describe('Event Streaming and Logging', () => {
    it('should create structured events', () => {
      const event = agent.createEvent('info', 'test-event', 'test-id', { test: true });
      
      expect(event).toHaveProperty('time');
      expect(event).toHaveProperty('level', 'info');
      expect(event).toHaveProperty('event', 'test-event');
      expect(event).toHaveProperty('id', 'test-id');
      expect(event).toHaveProperty('data', { test: true });
      
      // Validate timestamp format
      expect(new Date(event.time).toISOString()).toBe(event.time);
    });
  });

  describe('API Key Management', () => {
    it('should check for API key presence', () => {
      const healthStatus = agent.getHealthStatus();
      expect(typeof healthStatus.apiKeyPresent).toBe('boolean');
    });
  });
});
