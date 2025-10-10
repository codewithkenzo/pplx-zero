import { z } from 'zod';

// Version: 1.0.0
export const SCHEMA_VERSION = '1.0.0';

// Input schemas
export const SearchQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  maxResults: z.number().int().min(1).max(50).optional().default(5),
  country: z.string().length(2).regex(/^[A-Z]{2}$/, 'Invalid country code').optional(),
});

export const SearchInputV1Schema = z.object({
  id: z.string().uuid().optional(),
  op: z.literal('search'),
  args: SearchQuerySchema,
  options: z.object({
    timeoutMs: z.number().int().min(1000).max(300000).optional().default(30000),
    workspace: z.string().optional(),
  }).optional(),
});

export const BatchSearchInputV1Schema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default(SCHEMA_VERSION),
  requests: z.array(SearchInputV1Schema).min(1).max(100),
  options: z.object({
    concurrency: z.number().int().min(1).max(20).optional().default(5),
    timeoutMs: z.number().int().min(1000).max(300000).optional().default(60000),
    workspace: z.string().optional(),
    failFast: z.boolean().optional().default(false),
  }).optional(),
});

// Output schemas
export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

export const SearchOutputV1Schema = z.object({
  id: z.string().uuid(),
  ok: z.boolean(),
  data: z.object({
    query: z.string(),
    results: z.array(SearchResultSchema),
    totalCount: z.number().int(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }).optional(),
  duration: z.number().int(), // milliseconds
});

export const BatchOutputV1Schema = z.object({
  version: z.string(),
  ok: z.boolean(),
  summary: z.object({
    total: z.number().int(),
    successful: z.number().int(),
    failed: z.number().int(),
    totalDuration: z.number().int(),
  }),
  results: z.array(SearchOutputV1Schema),
});

// Event schemas for streaming
export const EventV1Schema = z.object({
  time: z.string().datetime(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  event: z.string(),
  id: z.string().optional(),
  data: z.unknown().optional(),
});

// Error codes
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_ERROR: 'API_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  WORKSPACE_VIOLATION: 'WORKSPACE_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchInputV1 = z.infer<typeof SearchInputV1Schema>;
export type BatchSearchInputV1 = z.infer<typeof BatchSearchInputV1Schema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchOutputV1 = z.infer<typeof SearchOutputV1Schema>;
export type BatchOutputV1 = z.infer<typeof BatchOutputV1Schema>;
export type EventV1 = z.infer<typeof EventV1Schema>;
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
