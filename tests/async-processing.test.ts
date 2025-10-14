import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { PerplexitySearchTool } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Async Processing Functionality Test Suite', () => {
  let agent: PerplexitySearchTool;
  const testWorkspace = '/tmp/pplx-async-test-workspace';
  const originalEnv = process.env;

  // Mock the Perplexity API for async testing
  beforeAll(async () => {
    // Mock API key for testing
    process.env = {
      ...originalEnv,
      PERPLEXITY_API_KEY: 'test-api-key-for-async-testing'
    };

    // Mock async utilities
    mock.module('../src/util/async.js', () => ({
      createAsyncJob: mock((id: string, model: string) => ({
        id,
        model,
        status: 'CREATED',
        createdAt: Date.now(),
      })),
      startAsyncJob: mock((id: string) => ({
        id,
        model: 'sonar',
        status: 'IN_PROGRESS',
        createdAt: Date.now() - 1000,
        startedAt: Date.now(),
      })),
      completeAsyncJob: mock((id: string, response: any) => ({
        id,
        model: 'sonar',
        status: 'COMPLETED',
        createdAt: Date.now() - 2000,
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        response,
      })),
      failAsyncJob: mock((id: string, error: string) => ({
        id,
        model: 'sonar',
        status: 'FAILED',
        createdAt: Date.now() - 2000,
        startedAt: Date.now() - 1000,
        failedAt: Date.now(),
        errorMessage: error,
      })),
      sendWebhook: mock(async (webhookUrl: string, jobId: string, status: string, data: any) => {
        console.log(`Mock webhook sent to: ${webhookUrl}`);
      }),
      getAsyncJob: mock((id: string) => {
        // Simulate job status progression
        return {
          id,
          model: 'sonar',
          status: 'COMPLETED',
          createdAt: Date.now() - 2000,
          startedAt: Date.now() - 1000,
          completedAt: Date.now(),
          response: {
            query: 'Async test query',
            results: [{
              title: 'Async Result',
              url: 'https://example.com/async-result',
              snippet: 'This is an async processed result.'
            }]
          }
        };
      }),
      pollJobCompletion: mock(async (jobId: string) => ({
        job: {
          id: jobId,
          model: 'sonar',
          status: 'COMPLETED',
          createdAt: Date.now() - 2000,
          startedAt: Date.now() - 1000,
          completedAt: Date.now(),
          response: {
            query: 'Async test query',
            results: [{
              title: 'Async Result',
              url: 'https://example.com/async-result',
              snippet: 'This is an async processed result.'
            }]
          }
        },
        success: true
      })),
      isJobComplete: mock((job: any) => job.status === 'COMPLETED'),
      getJobResult: mock((job: any) => ({
        success: true,
        data: job.response
      })),
      cleanupOldJobs: mock(() => 0),
      getAllAsyncJobs: mock(() => [])
    }));

    // Mock the Perplexity API
    mock.module("@perplexity-ai/perplexity_ai", () => {
      class MockPerplexity {
        chat = {
          completions: {
            create: mock(async (params: any) => {
              // Simulate longer processing time for async
              await new Promise(resolve => setTimeout(resolve, 100));

              return {
                id: 'mock-async-response-id',
                object: 'chat.completion',
                created: Date.now(),
                model: params.model || 'sonar',
                choices: [{
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: `Async response for query: ${params.messages?.[1]?.content || 'unknown query'}`
                  }
                }],
                usage: {
                  prompt_tokens: 50,
                  completion_tokens: 150,
                  total_tokens: 200
                },
                citations: [],
                search_results: []
              };
            }),
            _client: {}
          }
        };
      }

      return {
        default: MockPerplexity,
      };
    });

    // Create test workspace
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  beforeEach(() => {
    agent = new PerplexitySearchTool(testWorkspace, {
      resilienceProfile: 'balanced',
      logLevel: 'error'
    });
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

  describe('Current Async Behavior (Not Yet Implemented)', () => {
    it.skip('should create async job when async option is true', async () => {
      // NOTE: Async processing is not yet implemented
      // Current implementation processes synchronously even with async=true
      // This test is skipped until async functionality is properly implemented
    });

    it('should process synchronously even when async option is true', async () => {
      // Test current behavior - processes synchronously despite async flag
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test current async behavior',
          maxResults: 2,
          model: 'sonar' as const
        },
        options: {
          async: true
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Current implementation returns synchronous results
        expect(result.data).toHaveProperty('query', 'Test current async behavior');
        expect(result.data).toHaveProperty('results');
        expect(result.data).toHaveProperty('totalCount');
        expect(Array.isArray(result.data.results)).toBe(true);
      }
    });
  });

  describe('Sync Processing (async: false)', () => {
    it('should process synchronously when async option is false', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test sync processing',
          maxResults: 2,
          model: 'sonar' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result).toHaveProperty('id', input.id);
      expect(result).toHaveProperty('ok');
      if (result.ok) {
        expect(result.data).toHaveProperty('query', 'Test sync processing');
        expect(result.data).toHaveProperty('results');
        expect(result.data).toHaveProperty('totalCount');
        expect(Array.isArray(result.data.results)).toBe(true);
        expect(result.data.results.length).toBeGreaterThan(0);
      }
    });

    it('should handle synchronous processing as default behavior', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test default sync behavior',
          maxResults: 2,
          model: 'sonar' as const
        }
        // No options.async specified - should default to sync
      };

      const result = await agent.runTask(input);

      expect(result).toHaveProperty('id', input.id);
      if (result.ok) {
        expect(result.data).toHaveProperty('query', 'Test default sync behavior');
        expect(result.data).toHaveProperty('results');
        expect(Array.isArray(result.data.results)).toBe(true);
      }
    });
  });

  describe('Batch Processing with Async Flag', () => {
    it('should handle requests with async flag in batch (current behavior)', async () => {
      const batchInput = {
        version: '1.0.0',
        requests: [
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Request without async flag',
              maxResults: 1,
              model: 'sonar' as const
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Request with async flag',
              maxResults: 1,
              model: 'sonar' as const
            },
            options: {
              async: true // Currently ignored, processes synchronously
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

      expect(result.summary.total).toBe(2);
      expect(result.results).toHaveLength(2);

      // All requests should process synchronously and succeed
      result.results.forEach((itemResult) => {
        expect(itemResult).toHaveProperty('id');
        expect(itemResult).toHaveProperty('ok');
        if (itemResult.ok) {
          expect(itemResult.data).toHaveProperty('query');
          expect(itemResult.data).toHaveProperty('results');
        }
      });
    });
  });

  describe('Async Error Handling (Not Yet Implemented)', () => {
    it.skip('should handle async processing errors gracefully', async () => {
      // NOTE: Async processing is not yet implemented
      // This test is skipped until async functionality is properly implemented
    });

    it.skip('should validate async request parameters', async () => {
      // NOTE: Async validation is not yet implemented
      // This test is skipped until async functionality is properly implemented
    });
  });

  describe('Async Performance Characteristics (Not Yet Implemented)', () => {
    it.skip('should create async jobs quickly', async () => {
      // NOTE: Async processing is not yet implemented
      // This test is skipped until async functionality is properly implemented
    });

    it.skip('should handle concurrent async job creation', async () => {
      // NOTE: Async processing is not yet implemented
      // This test is skipped until async functionality is properly implemented
    });
  });

  describe('Async with Different Models (Not Yet Implemented)', () => {
    it.skip('should create async jobs with different models', async () => {
      // NOTE: Async processing is not yet implemented
      // This test is skipped until async functionality is properly implemented
    });
  });
});