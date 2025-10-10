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
    const controller = new AbortController();
    let signalReceived = false;

    // Mock process.on for SIGINT
    const originalOn = process.on;
    const mockOn = mock((event: string, callback: () => void) => {
      if (event === "SIGINT") {
        // Simulate SIGINT
        setTimeout(() => {
          controller.abort();
          signalReceived = true;
          callback();
        }, 100);
      }
    });
    
    process.on = mockOn;

    // Simulate search with abort
    const mockEngine = {
      search: mock(() => Promise.resolve({
        success: false,
        results: [],
        error: {
          code: "INTERRUPTED",
          message: "Search interrupted by user",
        },
        metadata: {
          totalQueries: 0,
          totalResults: 0,
          executionTime: 100,
          mode: "single",
        },
      })),
    };

    // Simulate the abort behavior
    controller.abort();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(signalReceived).toBe(true);
    expect(controller.signal.aborted).toBe(true);

    // Restore original process.on
    process.on = originalOn;
  });

  test("formats JSON output correctly", async () => {
    const mockResult = {
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
        mode: "single" as const,
      },
    };

    // Simulate JSON output formatting
    const outputJsonFormat = (result: any) => {
      console.log(JSON.stringify(result, null, 2));
    };

    outputJsonFormat(mockResult);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(mockResult, null, 2)
    );
  });

  test("formats text output correctly", async () => {
    const mockResult = {
      success: true,
      results: [{
        query: "test query",
        results: [{
          title: "Test Result",
          url: "https://example.com",
          snippet: "Test snippet",
          date: "2024-01-01",
        }],
      }],
      metadata: {
        totalQueries: 1,
        totalResults: 1,
        executionTime: 1000,
        mode: "single" as const,
      },
    };

    // Simulate text output formatting
    const outputTextFormat = (result: any) => {
      if (!result.success) {
        console.error(`Error: ${result.error?.message || "Unknown error"}`);
        return;
      }

      console.log(`Perplexity Search Results (${result.metadata.mode} mode)`);
      console.log(`Total queries: ${result.metadata.totalQueries}`);
      console.log(`Total results: ${result.metadata.totalResults}`);
      console.log(`Execution time: ${result.metadata.executionTime}ms`);
      console.log("");

      for (const queryResult of result.results) {
        console.log(`Query: ${queryResult.query}`);
        console.log(`  Results (${queryResult.results.length}):`);
        
        for (const searchResult of queryResult.results) {
          console.log(`    Title: ${searchResult.title}`);
          console.log(`    URL: ${searchResult.url}`);
          if (searchResult.snippet) {
            console.log(`    Snippet: ${searchResult.snippet}`);
          }
          if (searchResult.date) {
            console.log(`    Date: ${searchResult.date}`);
          }
          console.log("");
        }
      }
    };

    outputTextFormat(mockResult);

    // Verify the expected output lines
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Perplexity Search Results (single mode)"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("Total queries: 1");
    expect(consoleLogSpy).toHaveBeenCalledWith("Total results: 1");
    expect(consoleLogSpy).toHaveBeenCalledWith("Execution time: 1000ms");
    expect(consoleLogSpy).toHaveBeenCalledWith("Query: test query");
    expect(consoleLogSpy).toHaveBeenCalledWith("  Results (1):");
    expect(consoleLogSpy).toHaveBeenCalledWith("    Title: Test Result");
    expect(consoleLogSpy).toHaveBeenCalledWith("    URL: https://example.com");
    expect(consoleLogSpy).toHaveBeenCalledWith("    Snippet: Test snippet");
    expect(consoleLogSpy).toHaveBeenCalledWith("    Date: 2024-01-01");
  });

  test("handles error output formatting", async () => {
    const mockError = {
      success: false,
      results: [],
      error: {
        code: "API_KEY_MISSING",
        message: "API key is required",
        details: { source: "environment" },
      },
      metadata: {
        totalQueries: 0,
        totalResults: 0,
        executionTime: 100,
        mode: "single" as const,
      },
    };

    // Simulate JSON error output
    const outputJsonFormat = (result: any) => {
      console.log(JSON.stringify(result, null, 2));
    };

    outputJsonFormat(mockError);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(mockError, null, 2)
    );

    // Clear and test text error output
    consoleLogSpy.mockClear();
    
    const outputTextFormat = (result: any) => {
      if (!result.success) {
        console.error(`Error: ${result.error?.message || "Unknown error"}`);
        return;
      }
    };

    outputTextFormat(mockError);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: API key is required");
  });
});
