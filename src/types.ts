import { z } from "zod";

export const SearchModeSchema = z.enum(["single", "multi"]);

export const SearchConfigSchema = z.object({
  mode: SearchModeSchema,
  query: z.string().min(1).optional(),
  queries: z.array(z.string().min(1)).min(1).optional(),
  maxResults: z.number().int().min(1).max(50).default(5),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  concurrency: z.number().int().min(1).max(10).default(3),
  timeout: z.number().int().min(1000).max(300000).default(30000),
}).refine(
  (data) => {
    if (data.mode === "single") {
      return data.query !== undefined && data.query.length > 0;
    }
    if (data.mode === "multi") {
      return data.queries !== undefined && data.queries.length > 0;
    }
    return false;
  },
  {
    message: "Either 'query' (single mode) or 'queries' (multi mode) must be provided",
    path: ["mode"],
  }
);

export type SearchConfig = z.infer<typeof SearchConfigSchema>;

export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const QueryResultSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }).optional(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

export const ToolOutputSchema = z.object({
  success: z.boolean(),
  results: z.array(QueryResultSchema),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }).optional(),
  metadata: z.object({
    totalQueries: z.number(),
    totalResults: z.number(),
    executionTime: z.number(),
    mode: SearchModeSchema,
  }),
});

export type ToolOutput = z.infer<typeof ToolOutputSchema>;

export const StreamingEventSchema = z.object({
  type: z.enum(["start", "progress", "query_start", "query_complete", "error", "complete"]),
  timestamp: z.string(),
  data: z.any(),
});

export type StreamingEvent = z.infer<typeof StreamingEventSchema>;

export class PerplexitySearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "PerplexitySearchError";
  }
}

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  API_KEY_MISSING: "API_KEY_MISSING",
  API_ERROR: "API_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
} as const;
