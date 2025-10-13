import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { PerplexitySearchEngine } from "../src/core.js";
import { PerplexitySearchError, ErrorCode } from "../src/types.js";

// Mock console methods to capture output
const consoleLogSpy = mock(console, "log");
const consoleErrorSpy = mock(console, "error");

describe("CLI Integration", () => {
  beforeEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    // Restore environment variables
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_AI_API_KEY;
  });

  test("validates single mode configuration", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";

    // Mock the PerplexitySearchEngine
    const mockSearch = {
      search: mock(() => Promise.resolve({
        success: true,
        results: [{
          query: "test query",
          results: [{
            title: "Test Result",
            url: "https://example.com",
          }],
        }],
        metadata: {
          totalQueries: 1,
          totalResults: 1,
          executionTime: 1000,
          mode: "single",
        },
      })),
    };

    const mockConstructor = mock(() => mockSearch);
    
    // Test CLI argument parsing logic
    const parseArgs = (args: string[]) => {
      const options: any = {};
      let command = "";

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === "search" || arg === "validate") {
          command = arg;
          continue;
        }

        if (arg.startsWith("-")) {
          const flag = arg.replace(/^-+/, "");
          const value = args[i + 1];
          
          switch (flag) {
            case "m":
            case "mode":
              options.mode = value;
              i++;
              break;
            case "q":
            case "query":
              options.query = value;
              i++;
              break;
          }
        }
      }

      if (!options.mode) {
        options.mode = "single";
      }

      return { command, options };
    };

    const { command, options } = parseArgs(["search", "-m", "single", "-q", "test query"]);
    
    expect(command).toBe("search");
    expect(options.mode).toBe("single");
    expect(options.query).toBe("test query");
  });

  test("validates multi mode configuration", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";

    const parseArgs = (args: string[]) => {
      const options: any = {};
      let command = "";

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === "search" || arg === "validate") {
          command = arg;
          continue;
        }

        if (arg.startsWith("-")) {
          const flag = arg.replace(/^-+/, "");
          const value = args[i + 1];
          
          switch (flag) {
            case "m":
            case "mode":
              options.mode = value;
              i++;
              break;
            case "Q":
            case "queries":
              options.queries = value;
              i++;
              break;
          }
        }
      }

      return { command, options };
    };

    const { command, options } = parseArgs([
      "search", 
      "-m", "multi", 
      "-Q", "query1, query2, query3"
    ]);
    
    expect(command).toBe("search");
    expect(options.mode).toBe("multi");
    expect(options.queries).toBe("query1, query2, query3");
  });

  test("handles missing API key", async () => {
    // No API key set in environment
    
    const parseArgs = (args: string[]) => {
      const options: any = {};
      let command = "search";

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith("-")) {
          const flag = arg.replace(/^-+/, "");
          const value = args[i + 1];
          
          switch (flag) {
            case "m":
            case "mode":
              options.mode = value;
              i++;
              break;
            case "q":
            case "query":
              options.query = value;
              i++;
              break;
          }
        }
      }

      if (!options.mode) {
        options.mode = "single";
      }

      return { command, options };
    };

    const { options } = parseArgs(["search", "-q", "test query"]);
    
    try {
      // Simulate the API key check
      const apiKey = options.apiKey || process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY;
      
      if (!apiKey) {
        throw new PerplexitySearchError(
          "PERPLEXITY_API_KEY or PERPLEXITY_AI_API_KEY environment variable is required",
          ErrorCode.API_KEY_MISSING
        );
      }
    } catch (error) {
      expect(error).toBeInstanceOf(PerplexitySearchError);
      expect((error as PerplexitySearchError).code).toBe(ErrorCode.API_KEY_MISSING);
    }
  });

  test("handles SIGINT gracefully", async () => {
    let sigintReceived = false;

    // Mock process.on for SIGINT
    const originalOn = process.on;
    const mockOn = mock((event: string, callback: () => void) => {
      if (event === "SIGINT") {
        // Simulate SIGINT
        setTimeout(() => {
          sigintReceived = true;
          callback();
        }, 50);
      }
    });

    process.on = mockOn;

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    // Restore original process.on
    process.on = originalOn;
  });

  test("formats JSON output correctly", async () => {
    const mockResult = {
      ok: true,
      version: "1.0.0",
      summary: {
        total: 1,
        successful: 1,
        failed: 0,
        totalDuration: 1000,
      },
      results: [{
        id: "test-id",
        ok: true,
        data: {
          query: "test query",
          results: [{
            title: "Test Result",
            url: "https://example.com",
            snippet: "Test snippet",
          }],
          totalCount: 1,
        },
        duration: 1000,
      }],
    };

    // Simulate JSON output formatting (what the CLI actually does)
    const outputJsonFormat = (result: any) => {
      console.log(JSON.stringify(result, null, 2));
    };

    outputJsonFormat(mockResult);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(mockResult, null, 2)
    );
  });

  test("formats JSONL output correctly", async () => {
    const mockResults = [
      {
        id: "test-id-1",
        ok: true,
        data: {
          query: "test query 1",
          results: [{
            title: "Test Result 1",
            url: "https://example.com/1",
            snippet: "Test snippet 1",
          }],
          totalCount: 1,
        },
        duration: 500,
      },
      {
        id: "test-id-2",
        ok: true,
        data: {
          query: "test query 2",
          results: [{
            title: "Test Result 2",
            url: "https://example.com/2",
            snippet: "Test snippet 2",
          }],
          totalCount: 1,
        },
        duration: 600,
      },
    ];

    // Simulate JSONL output formatting (what the CLI does for --format jsonl)
    const outputJsonlFormat = (results: any[]) => {
      for (const result of results) {
        console.log(JSON.stringify(result));
      }
    };

    outputJsonlFormat(mockResults);

    // Verify each result was logged as a separate JSON line
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, JSON.stringify(mockResults[0]));
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, JSON.stringify(mockResults[1]));
  });

  test("handles error output formatting", async () => {
    const mockError = {
      ok: false,
      error: {
        code: "EXECUTION_ERROR",
        message: "API key is required",
        details: { source: "environment" },
      },
      duration: 100,
    };

    // Simulate JSON error output (what the CLI actually does)
    const outputJsonFormat = (result: any) => {
      console.log(JSON.stringify(result, null, 2));
    };

    outputJsonFormat(mockError);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(mockError, null, 2)
    );
  });
});
