import { describe, test, expect } from "bun:test";
import {
  SearchConfigSchema,
  SearchResultSchema,
  QueryResultSchema,
  ToolOutputSchema,
  StreamingEventSchema,
  PerplexitySearchError,
  ErrorCode,
} from "../src/types.js";

describe("Type Schemas", () => {
  describe("SearchConfigSchema", () => {
    test("validates single mode configuration", () => {
      const config = {
        mode: "single" as const,
        query: "test query",
        maxResults: 5,
        country: "US",
        concurrency: 3,
        timeout: 30000,
      };

      const result = SearchConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.query).toBe("test query");
      expect(result.data.mode).toBe("single");
    });

    test("validates multi mode configuration", () => {
      const config = {
        mode: "multi" as const,
        queries: ["query1", "query2", "query3"],
        maxResults: 10,
        concurrency: 5,
        timeout: 60000,
      };

      const result = SearchConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      expect(result.data.queries).toHaveLength(3);
      expect(result.data.mode).toBe("multi");
    });

    test("rejects invalid mode", () => {
      const config = {
        mode: "invalid",
        query: "test",
      };

      const result = SearchConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    test("rejects single mode without query", () => {
      const config = {
        mode: "single" as const,
      };

      const result = SearchConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    test("rejects multi mode without queries", () => {
      const config = {
        mode: "multi" as const,
      };

      const result = SearchConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    test("validates constraints", () => {
      const invalidConfigs = [
        { mode: "single", query: "test", maxResults: 0 }, // min: 1
        { mode: "single", query: "test", maxResults: 51 }, // max: 50
        { mode: "single", query: "test", concurrency: 0 }, // min: 1
        { mode: "single", query: "test", concurrency: 11 }, // max: 10
        { mode: "single", query: "test", timeout: 999 }, // min: 1000
        { mode: "single", query: "test", timeout: 300001 }, // max: 300000
        { mode: "single", query: "test", country: "USA" }, // invalid format
      ];

      for (const config of invalidConfigs) {
        const result = SearchConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("SearchResultSchema", () => {
    test("validates complete search result", () => {
      const result = {
        title: "Test Title",
        url: "https://example.com",
        snippet: "Test snippet",
        date: "2024-01-01",
      };

      const parsed = SearchResultSchema.parse(result);
      expect(parsed.title).toBe("Test Title");
      expect(parsed.url).toBe("https://example.com");
    });

    test("validates minimal search result", () => {
      const result = {
        title: "Test Title",
        url: "https://example.com",
      };

      const parsed = SearchResultSchema.parse(result);
      expect(parsed.title).toBe("Test Title");
      expect(parsed.snippet).toBeUndefined();
    });

    test("rejects invalid URL", () => {
      const result = {
        title: "Test Title",
        url: "not-a-url",
      };

      const parsedResult = SearchResultSchema.safeParse(result);
      expect(parsedResult.success).toBe(false);
    });
  });

  describe("QueryResultSchema", () => {
    test("validates successful query result", () => {
      const result = {
        query: "test query",
        results: [
          {
            title: "Result 1",
            url: "https://example.com/1",
          },
          {
            title: "Result 2", 
            url: "https://example.com/2",
            snippet: "Snippet 2",
          },
        ],
      };

      const parsed = QueryResultSchema.parse(result);
      expect(parsed.query).toBe("test query");
      expect(parsed.results).toHaveLength(2);
    });

    test("validates query result with error", () => {
      const result = {
        query: "test query",
        results: [],
        error: {
          code: "API_ERROR",
          message: "Request failed",
          details: { status: 500 },
        },
      };

      const parsed = QueryResultSchema.parse(result);
      expect(parsed.error?.code).toBe("API_ERROR");
    });
  });

  describe("ToolOutputSchema", () => {
    test("validates successful tool output", () => {
      const output = {
        success: true,
        results: [
          {
            query: "test query",
            results: [
              {
                title: "Result 1",
                url: "https://example.com",
              },
            ],
          },
        ],
        metadata: {
          totalQueries: 1,
          totalResults: 1,
          executionTime: 2500,
          mode: "single" as const,
        },
      };

      const parsed = ToolOutputSchema.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.metadata.totalResults).toBe(1);
    });

    test("validates failed tool output", () => {
      const output = {
        success: false,
        results: [],
        error: {
          code: "API_KEY_MISSING",
          message: "API key required",
        },
        metadata: {
          totalQueries: 0,
          totalResults: 0,
          executionTime: 100,
          mode: "single" as const,
        },
      };

      const parsed = ToolOutputSchema.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.code).toBe("API_KEY_MISSING");
    });
  });

  describe("StreamingEventSchema", () => {
    test("validates all event types", () => {
      const eventTypes = ["start", "progress", "query_start", "query_complete", "error", "complete"];
      
      for (const type of eventTypes) {
        const event = {
          type: type as any,
          timestamp: new Date().toISOString(),
          data: { test: "data" },
        };

        const parsed = StreamingEventSchema.parse(event);
        expect(parsed.type).toBe(type);
      }
    });
  });
});

describe("PerplexitySearchError", () => {
  test("creates error with code and details", () => {
    const details = { status: 500, endpoint: "/search" };
    const error = new PerplexitySearchError(
      "Test error message",
      "API_ERROR",
      details
    );

    expect(error.message).toBe("Test error message");
    expect(error.code).toBe("API_ERROR");
    expect(error.details).toEqual(details);
    expect(error.name).toBe("PerplexitySearchError");
  });

  test("creates error without details", () => {
    const error = new PerplexitySearchError(
      "Simple error",
      "VALIDATION_ERROR"
    );

    expect(error.details).toBeUndefined();
  });
});

describe("ErrorCode", () => {
  test("contains all expected error codes", () => {
    const expectedCodes = [
      "VALIDATION_ERROR",
      "API_KEY_MISSING", 
      "API_ERROR",
      "TIMEOUT_ERROR",
      "NETWORK_ERROR",
      "RATE_LIMIT_ERROR",
      "UNEXPECTED_ERROR",
    ];

    expectedCodes.forEach(code => {
      expect(ErrorCode[code as keyof typeof ErrorCode]).toBe(code);
    });
  });
});
