/**
 * Backward compatibility layer for the core module
 * This re-exports the unified engine with legacy interfaces
 */

export {
  UnifiedPerplexityEngine as OptimizedPerplexitySearchEngine,
  createPerplexityEngine,
  processFileAttachments,
  getApiKey,
  type FileAttachment,
  type UnifiedEngineConfig,
} from './engine/unified.js';

// Re-export fast search functions with backward compatibility
import { UnifiedPerplexityEngine } from './engine/unified.js';
import type { SearchResult, QueryResult } from './types.js';
import type { SearchConfig, ToolOutput } from './types.js';

/**
 * Simplified high-performance search functions (backward compatible)
 */
export async function fastSearch(
  query: string,
  options: {
    maxResults?: number;
    model?: string;
    timeout?: number;
  } = {}
): Promise<{
  success: boolean;
  results?: SearchResult[];
  executionTime?: number;
  error?: string;
}> {
  try {
    const engine = new UnifiedPerplexityEngine();
    const result = await engine.executeSingle(query, options);

    return {
      success: result.results.length > 0,
      results: result.results,
      executionTime: result.executionTime,
      error: result.error?.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fastMultiSearch(
  queries: string[],
  options: {
    maxResults?: number;
    model?: string;
    concurrency?: number;
    timeout?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<{
  success: boolean;
  results?: QueryResult[];
  executionTime?: number;
  totalResults?: number;
  error?: string;
}> {
  try {
    const engine = new UnifiedPerplexityEngine();
    const startTime = performance.now();

    const results = await engine.processBatch(queries, {
      ...options,
      onProgress: options.onProgress,
    });

    const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);
    const executionTime = performance.now() - startTime;

    return {
      success: true,
      results,
      executionTime,
      totalResults,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Re-export types for backward compatibility
export type { FileAttachment } from './engine/unified.js';
export type { UnifiedEngineConfig as PerplexityEngineConfig } from './engine/unified.js';
export { SearchConfig, ToolOutput, QueryResult, SearchResult } from './types.js';
export { ErrorCode, PerplexitySearchError } from './types.js';