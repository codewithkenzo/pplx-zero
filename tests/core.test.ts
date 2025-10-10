import { describe, test, expect, mock, beforeEach } from "bun:test";
import { PerplexitySearchEngine } from "../src/core.js";
import { PerplexitySearchError, ErrorCode } from "../src/types.js";

// Mock the Perplexity SDK
const mockSearch = {
  create: mock(() => Promise.resolve({
    results: [
      {
        title: "Test Result 1",
        url: "https://example.com/1",
        snippet: "Test snippet 1",
        date: "2024-01-01",
      },
      {
        title: "Test Result 2",
        url: "https://example.com/2",
        snippet: "Test snippet 2",
      },
    ],
  })),
};

const mockPerplexity = mock(() => mockSearch);

// Mock the module
const originalModule = await import("@perplexity-ai/perplexity_ai");
const originalDefault = originalModule.default;

beforeEach(() => {
  mockSearch.create.mockClear();
  mockPerplexity.mockClear();
  // Replace the module import with our mock
  (global as any).__mocks__ = {
    "@perplexity-ai/perplexity_ai": {
      default: mockPerplexity,
    },
  };
});

describe("PerplexitySearchEngine", () => {
  describe("constructor", () => {
    test("creates engine with valid API key", () => {
      const engine = new PerplexitySearchEngine("test-api-key");
      expect(engine).toBeDefined();
    });

    test("throws error without API key", () => {
      expect(() => {
        new PerplexitySearchEngine("");
      }).toThrow(PerplexitySearchError);
    });

    test("throws specific error code for missing API key", () => {
      try {
        new PerplexitySearchEngine("");
      } catch (error) {
        expect(error).toBeInstanceOf(PerplexitySearchError);
        expect((error as PerplexitySearchError).code).toBe(ErrorCode.API_KEY_MISSING);
      }
    });
  });

  describe("search", () => {
    let engine: PerplexitySearchEngine;

    beforeEach(() => {
      engine = new PerplexitySearchEngine("test-api-key");
    });

    test("executes single query search successfully", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
        maxResults: 5,
      };

      // Mock the console.error to capture streaming events
      const consoleSpy = mock(console, "error");

      const result = await engine.search(config);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].query).toBe("test query");
      expect(result.results[0].results).toHaveLength(2);
      expect(result.metadata.totalQueries).toBe(1);
      expect(result.metadata.totalResults).toBe(2);
      expect(result.metadata.mode).toBe("single");

      // Verify streaming events were emitted
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test("executes multi-query search successfully", async () => {
      const config = {
        mode: "multi" as const,
        queries: ["query1", "query2", "query3"],
        maxResults: 3,
        concurrency: 2,
      };

      const result = await engine.search(config);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.metadata.totalQueries).toBe(3);
      expect(result.metadata.mode).toBe("multi");

      // Verify results are in order
      expect(result.results[0].query).toBe("query1");
      expect(result.results[1].query).toBe("query2");
      expect(result.results[2].query).toBe("query3");
    });

    test("handles country parameter", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
        maxResults: 5,
        country: "US",
      };

      await engine.search(config);

      expect(mockSearch.create).toHaveBeenCalledWith({
        query: "test query",
        max_results: 5,
        country: "US",
      });
    });

    test("handles timeout and abort signal", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
        timeout: 1000,
      };

      const controller = new AbortController();
      
      // Simulate timeout
      mockSearch.create.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const result = await engine.search(config, controller.signal);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    test("handles abort signal", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
      };

      const controller = new AbortController();
      
      // Abort immediately
      controller.abort();

      const result = await engine.search(config, controller.signal);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.TIMEOUT_ERROR);
    });

    test("handles API errors gracefully", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
      };

      mockSearch.create.mockRejectedValueOnce(new Error("API rate limit exceeded"));

      const result = await engine.search(config);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
    });

    test("handles network errors", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
      };

      mockSearch.create.mockRejectedValueOnce(new Error("Network error"));

      const result = await engine.search(config);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.NETWORK_ERROR);
    });

    test("handles authentication errors", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
      };

      mockSearch.create.mockRejectedValueOnce(new Error("401 Unauthorized"));

      const result = await engine.search(config);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.API_KEY_MISSING);
    });

    test("handles server errors", async () => {
      const config = {
        mode: "single" as const,
        query: "test query",
      };

      mockSearch.create.mockRejectedValueOnce(new Error("500 Internal Server Error"));

      const result = await engine.search(config);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.API_ERROR);
    });

    test("continues processing other queries when one fails in multi mode", async () => {
      const config = {
        mode: "multi" as const,
        queries: ["query1", "query2", "query3"],
        concurrency: 2,
      };

      // Make the second query fail
      mockSearch.create
        .mockResolvedValueOnce({
          results: [{ title: "Success 1", url: "https://example.com/1" }],
        })
        .mockRejectedValueOnce(new Error("Query 2 failed"))
        .mockResolvedValueOnce({
          results: [{ title: "Success 3", url: "https://example.com/3" }],
        });

      const result = await engine.search(config);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].results).toHaveLength(1);
      expect(result.results[1].error).toBeDefined();
      expect(result.results[2].results).toHaveLength(1);
      expect(result.metadata.totalQueries).toBe(3);
      expect(result.metadata.totalResults).toBe(2);
    });

    test("respects concurrency limits", async () => {
      const config = {
        mode: "multi" as const,
        queries: ["q1", "q2", "q3", "q4", "q5"],
        concurrency: 2,
      };

      const startTimes: number[] = [];
      mockSearch.create.mockImplementation(() => {
        startTimes.push(Date.now());
        return Promise.resolve({
          results: [{ title: "Result", url: "https://example.com" }],
        });
      });

      await engine.search(config);

      // Should have called create for each query
      expect(mockSearch.create).toHaveBeenCalledTimes(5);
      expect(startTimes).toHaveLength(5);
    });
  });
});
