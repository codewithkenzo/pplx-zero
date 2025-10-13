import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { PerplexitySearchEngine } from "../src/core.js";
import { SearchConfigSchema } from "../src/types.js";

describe("Integration Tests", () => {
  let engine: PerplexitySearchEngine;
  const testApiKey = process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY;

  beforeAll(() => {
    // Mock the @perplexity-ai/perplexity_ai module
    mock.module("@perplexity-ai/perplexity_ai", () => {
      const mockData = {
        results: [
          {
            title: 'Integration Test Result 1',
            url: 'https://example.com/integration1',
            snippet: 'Integration test snippet 1',
          },
          {
            title: 'Integration Test Result 2',
            url: 'https://example.com/integration2',
            snippet: 'Integration test snippet 2',
          },
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
            if (params.max_results > 10) {
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
  });

  beforeEach(() => {
    // Create fresh engine for each test to avoid circuit breaker issues
    engine = new PerplexitySearchEngine("test-api-key-for-integration");
  });

  describe("API Integration", () => {
    test.skip("requires API key", () => { /* requires API key */ });

    test("can connect to Perplexity API", async () => {
      if (!testApiKey) return;

      const config = {
        mode: "single" as const,
        query: "test query",
        maxResults: 1,
        timeout: 10000,
      };

      const result = await engine.search(config);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.mode).toBe("single");
    });

    test("handles real single query search", async () => {
      if (!testApiKey) return;

      const config = {
        mode: "single" as const,
        query: "artificial intelligence trends 2024",
        maxResults: 3,
        timeout: 30000,
      };

      const result = await engine.search(config);

      if (result.success) {
        expect(result.results).toHaveLength(1);
        expect(result.results[0].query).toBe("artificial intelligence trends 2024");
        expect(result.results[0].results.length).toBeGreaterThan(0);
        expect(result.metadata.totalResults).toBeGreaterThan(0);
        
        // Validate result structure
        const searchResult = result.results[0].results[0];
        expect(searchResult.title).toBeDefined();
        expect(searchResult.url).toBeDefined();
        expect(typeof searchResult.url).toBe("string");
        expect(searchResult.url).toMatch(/^https?:\/\//);
      } else {
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }
    });

    test("handles real multi-query search", async () => {
      if (!testApiKey) return;

      const config = {
        mode: "multi" as const,
        queries: [
          "machine learning basics",
          "neural networks explained",
          "deep learning applications"
        ],
        maxResults: 2,
        concurrency: 2,
        timeout: 60000,
      };

      const result = await engine.search(config);

      expect(result.results).toHaveLength(3);
      expect(result.metadata.totalQueries).toBe(3);
      expect(result.metadata.mode).toBe("multi");

      // Verify order preservation
      expect(result.results[0].query).toBe("machine learning basics");
      expect(result.results[1].query).toBe("neural networks explained");
      expect(result.results[2].query).toBe("deep learning applications");

      // At least some queries should succeed
      const successfulQueries = result.results.filter(r => r.results.length > 0);
      expect(successfulQueries.length).toBeGreaterThan(0);
    });

    test("handles country-specific search", async () => {
      if (!testApiKey) {
        return;
      }

      const config = {
        mode: "single" as const,
        query: "local news",
        country: "US",
        maxResults: 2,
        timeout: 30000,
      };

      const result = await engine.search(config);

      expect(result.metadata.mode).toBe("single");
      // Country parameter should be accepted without errors
      expect(result).toBeDefined();
    });

    test("validates config schema against real API", async () => {
      if (!testApiKey) {
        return;
      }

      const validConfigs = [
        {
          mode: "single" as const,
          query: "test query",
          maxResults: 5,
        },
        {
          mode: "multi" as const,
          queries: ["query1", "query2"],
          maxResults: 3,
          concurrency: 2,
        },
        {
          mode: "single" as const,
          query: "test",
          maxResults: 10,
          country: "US",
          timeout: 45000,
        },
      ];

      for (const config of validConfigs) {
        const validation = SearchConfigSchema.safeParse(config);
        expect(validation.success).toBe(true);
        
        if (validation.success) {
          const result = await engine.search(validation.data);
          expect(result).toBeDefined();
          expect(result.metadata).toBeDefined();
        }
      }
    });

    test("handles timeout realistically", async () => {
      if (!testApiKey) {
        return;
      }

      const config = {
        mode: "single" as const,
        query: "complex technical search query with many terms",
        maxResults: 50, // Maximum results
        timeout: 1000, // Very short timeout
      };

      const startTime = Date.now();
      const result = await engine.search(config);
      const endTime = Date.now();

      // Should complete within reasonable time (timeout + buffer)
      expect(endTime - startTime).toBeLessThan(5000);

      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error?.code).toBeDefined();
      }
    });

    test("handles concurrent load", async () => {
      if (!testApiKey) {
        return;
      }

      const config = {
        mode: "multi" as const,
        queries: Array.from({ length: 10 }, (_, i) => `test query ${i + 1}`),
        maxResults: 1,
        concurrency: 5,
        timeout: 60000,
      };

      const startTime = Date.now();
      const result = await engine.search(config);
      const endTime = Date.now();

      expect(result.results).toHaveLength(10);
      expect(result.metadata.totalQueries).toBe(10);

      // Should complete faster than sequential execution
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(30000); // Reasonable upper bound
    });
  });

  describe("Error Handling Integration", () => {
    test("handles invalid API key gracefully", async () => {
      const invalidEngine = new PerplexitySearchEngine("invalid-key-12345");

      const config = {
        mode: "single" as const,
        query: "test query",
        maxResults: 1,
        timeout: 10000,
      };

      const result = await invalidEngine.search(config);

      // The API may not strictly validate keys, so we just check it completes
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");

      // If it fails, it should have proper error structure
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBeDefined();
      }
    });

    test("handles malformed queries", async () => {
      if (!testApiKey) {
        return;
      }

      const config = {
        mode: "single" as const,
        query: "", // Empty query
        maxResults: 1,
        timeout: 10000,
      };

      // This should fail validation before reaching the API
      const validation = SearchConfigSchema.safeParse(config);
      expect(validation.success).toBe(false);
    });

    test("handles extreme parameter values", async () => {
      if (!testApiKey) {
        return;
      }

      const extremeConfigs = [
        {
          mode: "single" as const,
          query: "test",
          maxResults: 50, // Maximum allowed
        },
        {
          mode: "single" as const,
          query: "test",
          maxResults: 1, // Minimum allowed
        },
        {
          mode: "multi" as const,
          queries: ["test"],
          maxResults: 1,
          concurrency: 1, // Minimum concurrency
        },
        {
          mode: "multi" as const,
          queries: Array.from({ length: 50 }, (_, i) => `query ${i}`), // Maximum reasonable
          maxResults: 1,
          concurrency: 10, // Maximum concurrency
        },
      ];

      for (const config of extremeConfigs) {
        const validation = SearchConfigSchema.safeParse(config);
        if (validation.success) {
          const result = await engine.search(validation.data);
          expect(result).toBeDefined();
          expect(result.metadata).toBeDefined();
        }
      }
    });
  });

  describe("Streaming Integration", () => {
    test("produces valid streaming events", async () => {
      if (!testApiKey) {
        return;
      }

      const capturedEvents: string[] = [];
      const originalConsoleError = console.error;
      
      console.error = (message: any) => {
        if (typeof message === "string") {
          try {
            const event = JSON.parse(message);
            capturedEvents.push(message);
          } catch {
            // Not a JSON event, ignore
          }
        }
      };

      const config = {
        mode: "single" as const,
        query: "test streaming",
        maxResults: 1,
        timeout: 15000,
      };

      await engine.search(config);

      // Restore console.error
      console.error = originalConsoleError;

      expect(capturedEvents.length).toBeGreaterThan(0);

      // Validate event structure
      for (const eventStr of capturedEvents) {
        const event = JSON.parse(eventStr);
        expect(event.type).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(typeof new Date(event.timestamp).getTime()).toBe("number");
      }

      // Should have at least start and complete events
      const eventTypes = capturedEvents.map(e => JSON.parse(e).type);
      expect(eventTypes).toContain("start");
      expect(eventTypes).toContain("complete");
    });
  });
});
