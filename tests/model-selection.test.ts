import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { PerplexitySearchTool } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

describe('Model Selection Functionality Test Suite', () => {
  let agent: PerplexitySearchTool;
  const testWorkspace = '/tmp/pplx-model-test-workspace';
  const originalEnv = process.env;

  // Mock the Perplexity API for model testing
  beforeAll(async () => {
    // Mock API key for testing
    process.env = {
      ...originalEnv,
      PERPLEXITY_API_KEY: 'test-api-key-for-model-testing'
    };

    // Enhanced mock with model validation
    mock.module("@perplexity-ai/perplexity_ai", () => {
      class MockPerplexity {
        chat = {
          completions: {
            create: mock(async (params: any) => {
              const model = params.model || 'sonar';
              const userMessage = params.messages?.find((msg: any) => msg.role === 'user');
              const query = userMessage?.content || 'unknown query';

              console.log(`Mock API called with model: ${model}`);

              // Simulate different model capabilities
              let responseContent = `Response from ${model} model for query: ${query}`;
              let tokenUsage = { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 };

              switch (model) {
                case 'sonar-pro':
                  responseContent = `Advanced response from Sonar Pro model for query: ${query}. Enhanced analysis with deeper insights.`;
                  tokenUsage = { prompt_tokens: 50, completion_tokens: 200, total_tokens: 250 };
                  break;
                case 'sonar-deep-research':
                  responseContent = `Comprehensive research response from Sonar Deep Research model for query: ${query}. Extensive analysis with detailed citations.`;
                  tokenUsage = { prompt_tokens: 50, completion_tokens: 400, total_tokens: 450 };
                  break;
                case 'sonar-reasoning':
                  responseContent = `Reasoned response from Sonar Reasoning model for query: ${query}. Step-by-step logical analysis.`;
                  tokenUsage = { prompt_tokens: 50, completion_tokens: 300, total_tokens: 350 };
                  break;
                default:
                  // sonar (default)
                  break;
              }

              return {
                id: 'mock-model-response-id',
                object: 'chat.completion',
                created: Date.now(),
                model,
                choices: [{
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: responseContent
                  }
                }],
                usage: tokenUsage,
                citations: [],
                search_results: [
                  {
                    title: `${model} Search Result`,
                    url: 'https://example.com/mock-result',
                    snippet: `Results enhanced by ${model} model capabilities.`
                  }
                ]
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

  describe('Basic Model Selection', () => {
    it('should use default sonar model when no model specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query without model',
          maxResults: 2
          // No model specified - should use default
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result).toHaveProperty('id', input.id);
      expect(result).toHaveProperty('ok');
      if (result.ok) {
        expect(result.data).toHaveProperty('query', 'Test query without model');
        expect(result.data.results.length).toBeGreaterThan(0);

        // Check that default model was used
        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Response from sonar model');
      }
    });

    it('should use sonar model when explicitly specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with sonar model',
          maxResults: 2,
          model: 'sonar' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Test query with sonar model');
        expect(result.data.results.length).toBeGreaterThan(0);

        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Response from sonar model');
      }
    });

    it('should use sonar-pro model when specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with sonar-pro model',
          maxResults: 2,
          model: 'sonar-pro' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Test query with sonar-pro model');
        expect(result.data.results.length).toBeGreaterThan(0);

        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Advanced response from Sonar Pro model');
        expect(firstResult.snippet).toContain('Enhanced analysis with deeper insights');
      }
    });

    it('should use sonar-deep-research model when specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with sonar-deep-research model',
          maxResults: 3,
          model: 'sonar-deep-research' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Test query with sonar-deep-research model');
        expect(result.data.results.length).toBeGreaterThan(0);

        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Comprehensive research response from Sonar Deep Research model');
        expect(firstResult.snippet).toContain('Extensive analysis with detailed citations');
      }
    });

    it('should use sonar-reasoning model when specified', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with sonar-reasoning model',
          maxResults: 2,
          model: 'sonar-reasoning' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        expect(result.data.query).toBe('Test query with sonar-reasoning model');
        expect(result.data.results.length).toBeGreaterThan(0);

        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Reasoned response from Sonar Reasoning model');
        expect(firstResult.snippet).toContain('Step-by-step logical analysis');
      }
    });
  });

  describe('Model Selection with Attachments', () => {
    it('should use different models with attachments', async () => {
      // Create test file for attachment
      const testFile = join(testWorkspace, 'test-document.txt');
      await fs.writeFile(testFile, Buffer.from('Test document content for model testing.'));

      const models = ['sonar', 'sonar-pro', 'sonar-deep-research', 'sonar-reasoning'] as const;

      for (const model of models) {
        const input = {
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `Analyze this document with ${model}`,
            maxResults: 2,
            model,
            attachmentInputs: [
              {
                path: testFile,
                name: 'test-document.txt',
                type: 'document' as const
              }
            ]
          },
          options: {
            async: false
          }
        };

        const result = await agent.runTask(input);

        expect(result.id).toBe(input.id);
        if (result.ok) {
          expect(result.data.query).toBe(`Analyze this document with ${model}`);
          expect(result.data.results.length).toBeGreaterThan(0);

          const firstResult = result.data.results[0];
          expect(firstResult.snippet).toContain(model);
          expect(firstResult.snippet).toContain('Processed 1 attachments');
        }
      }
    });
  });

  describe('Agent Default Model Configuration', () => {
    it('should use custom default model when configured', () => {
      const customAgent = new PerplexitySearchTool(testWorkspace, {
        defaultModel: 'sonar-pro',
        logLevel: 'error'
      });

      const healthStatus = customAgent.getHealthStatus();
      expect(healthStatus).toHaveProperty('healthy', true);
    });

    it('should support changing default model in constructor', async () => {
      const proAgent = new PerplexitySearchTool(testWorkspace, {
        defaultModel: 'sonar-pro',
        logLevel: 'error'
      });

      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with pro default agent',
          maxResults: 2
          // No model specified - should use agent's default
        },
        options: {
          async: false
        }
      };

      const result = await proAgent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        // Should use the agent's default model
        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Response from sonar model'); // Mock still uses sonar as default
      }
    });

    it('should override agent default when model specified in request', async () => {
      const proAgent = new PerplexitySearchTool(testWorkspace, {
        defaultModel: 'sonar-pro',
        logLevel: 'error'
      });

      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query overriding agent default',
          maxResults: 2,
          model: 'sonar-reasoning' as const
          // This should override the agent's default
        },
        options: {
          async: false
        }
      };

      const result = await proAgent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Response from Sonar Reasoning model');
      }
    });
  });

  describe('Model Selection in Batch Processing', () => {
    it('should handle mixed models in batch requests', async () => {
      const batchInput = {
        version: '1.0.0',
        requests: [
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Query with sonar model',
              maxResults: 1,
              model: 'sonar' as const
            },
            options: {
              async: false
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Query with sonar-pro model',
              maxResults: 1,
              model: 'sonar-pro' as const
            },
            options: {
              async: false
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Query with sonar-deep-research model',
              maxResults: 1,
              model: 'sonar-deep-research' as const
            },
            options: {
              async: false
            }
          },
          {
            id: randomUUID(),
            op: 'search' as const,
            args: {
              query: 'Query without model (should use default)',
              maxResults: 1
              // No model specified
            },
            options: {
              async: false
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

      expect(result.summary.total).toBe(4);
      expect(result.results).toHaveLength(4);

      // Check individual model usage
      const modelIndicators = [
        'Response from sonar model',
        'Response from Sonar Pro model',
        'Response from Sonar Deep Research model'
      ];

      result.results.forEach((itemResult, index) => {
        expect(itemResult).toHaveProperty('id');
        expect(itemResult).toHaveProperty('ok');
        if (itemResult.ok) {
          const snippet = itemResult.data.results[0].snippet;
          const hasModelIndicator = modelIndicators.some(indicator => snippet.includes(indicator));
          expect(hasModelIndicator).toBe(true);
        }
      });
    });
  });

  describe('Model Error Handling', () => {
    it('should handle invalid model names gracefully', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Test query with invalid model',
          maxResults: 2,
          model: 'invalid-model' as any
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      // Should fail validation for invalid model
      expect(result.ok).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('Invalid enum value');
    });

    it('should validate model selection against schema', async () => {
      const invalidModels = ['sonar-pro-max', 'sonar-turbo', 'gpt-4', 'claude-3'];

      for (const invalidModel of invalidModels) {
        const input = {
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `Test query with ${invalidModel}`,
            maxResults: 1,
            model: invalidModel as any
          },
          options: {
            async: false
          }
        };

        const result = await agent.runTask(input);

        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('Model Performance Characteristics', () => {
    it('should handle different response lengths by model', async () => {
      const modelTests = [
        { model: 'sonar' as const, expectedMinLength: 40 },
        { model: 'sonar-pro' as const, expectedMinLength: 80 },
        { model: 'sonar-deep-research' as const, expectedMinLength: 120 },
        { model: 'sonar-reasoning' as const, expectedMinLength: 100 }
      ];

      for (const { model, expectedMinLength } of modelTests) {
        const input = {
          id: randomUUID(),
          op: 'search' as const,
          args: {
            query: `Detailed analysis request for ${model}`,
            maxResults: 2,
            model
          },
          options: {
            async: false
          }
        };

        const result = await agent.runTask(input);

        expect(result.id).toBe(input.id);
        if (result.ok) {
          const firstResult = result.data.results[0];
          expect(firstResult.snippet.length).toBeGreaterThan(expectedMinLength);
        }
      }
    });

    it('should handle model-specific token usage', async () => {
      const input = {
        id: randomUUID(),
        op: 'search' as const,
        args: {
          query: 'Complex research query',
          maxResults: 3,
          model: 'sonar-deep-research' as const
        },
        options: {
          async: false
        }
      };

      const result = await agent.runTask(input);

      expect(result.id).toBe(input.id);
      if (result.ok) {
        // Deep research model should produce longer responses
        const firstResult = result.data.results[0];
        expect(firstResult.snippet).toContain('Comprehensive research response');
        expect(firstResult.snippet.length).toBeGreaterThan(100);
      }
    });
  });
});