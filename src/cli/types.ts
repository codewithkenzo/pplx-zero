/**
 * CLI-specific types for PPLX-Zero
 * Provides strong typing for all CLI operations and interfaces
 */

import type { SearchResult } from '../types.js';
import type { ExportOptions } from '../export/types.js';
import type { HistoryEntry } from '../history/types.js';

/**
 * Valid AI models for search operations
 */
export type ValidModel = 'sonar' | 'sonar-pro' | 'sonar-reasoning' | 'sonar-deep-research';

/**
 * Valid output formats for search results
 */
export type OutputFormat = 'json' | 'jsonl';

/**
 * Execution mode for search operations
 */
export type ExecutionMode = 'search-api' | 'chat-attachments' | 'advanced-model' | 'advanced';

/**
 * Command handler exit codes
 */
export type ExitCode = 0 | 1 | 130 | 143; // 0=success, 1=error, 130=SIGINT, 143=SIGTERM

/**
 * Command handler return type
 */
export interface CommandResult {
  readonly exitCode: ExitCode;
  readonly output?: string;
  readonly error?: string;
}

/**
 * Search execution options
 */
export interface SearchOptions {
  readonly maxResults: number;
  readonly concurrency: number;
  readonly timeout: number;
  readonly batchSize: number;
  readonly useSearchAPI: boolean;
  readonly outputFormat: OutputFormat;
  readonly model?: ValidModel;
  readonly filePaths: readonly string[];
  readonly webhook?: string;
  readonly async: boolean;
}

/**
 * File input options
 */
export interface FileInputOptions {
  readonly stdin: boolean;
  readonly input?: string;
  readonly query?: string;
  readonly attach: readonly string[];
  readonly attachImage: readonly string[];
}

/**
 * Export configuration
 */
export interface ExportConfig {
  readonly filename?: string;
  readonly format?: 'txt' | 'md' | 'json';
  readonly includeMetadata: boolean;
  readonly includeTimestamp: boolean;
  readonly cleanText: boolean;
}

/**
 * Search execution context
 */
export interface SearchContext {
  readonly queries: readonly string[];
  readonly options: SearchOptions;
  readonly exportConfig?: ExportConfig;
  readonly source: 'cli' | 'stdin' | 'file';
  readonly sessionId: string;
  readonly startTime: number;
}

/**
 * Search execution result
 */
export interface SearchExecutionResult {
  readonly success: boolean;
  readonly results?: SearchResult[];
  readonly totalResults?: number;
  readonly executionTime: number;
  readonly mode: ExecutionMode;
  readonly error?: string;
  readonly metadata: {
    readonly queryCount: number;
    readonly model?: ValidModel;
    readonly maxResults: number;
    readonly exportPath?: string;
  };
}

/**
 * Multi-search execution result
 */
export interface MultiSearchExecutionResult {
  readonly success: boolean;
  readonly results: readonly SearchResult[];
  readonly summary: {
    readonly total: number;
    readonly successful: number;
    readonly failed: number;
    readonly totalDuration: number;
  };
  readonly executionTime: number;
  readonly mode: ExecutionMode;
  readonly error?: string;
}

/**
 * Parsed command line arguments
 */
export interface CliArguments {
  // Basic options
  readonly query?: string;
  readonly file?: string;
  readonly image?: string;
  readonly format: OutputFormat;
  readonly model?: ValidModel;

  // Commands
  readonly version: boolean;
  readonly help: boolean;
  readonly helpAdvanced: boolean;
  readonly history: boolean;
  readonly searchFiles: boolean;
  readonly updateCheck: boolean;
  readonly autoUpdate: boolean;

  // Export options
  readonly export?: string;

  // Advanced options
  readonly input?: string;
  readonly stdin: boolean;
  readonly concurrency?: string;
  readonly timeout?: string;
  readonly workspace?: string;
  readonly attach: readonly string[];
  readonly attachImage: readonly string[];
  readonly async: boolean;
  readonly webhook?: string;

  // Performance options
  readonly useSearchAPI: boolean;
  readonly maxResults: string;
  readonly batchSize: string;

  // Positional queries
  readonly positionals: readonly string[];
}

/**
 * History command options
 */
export interface HistoryCommandOptions {
  readonly limit?: number;
  readonly showFiles: boolean;
  readonly queryPattern?: string;
}

/**
 * Update command options
 */
export interface UpdateCommandOptions {
  readonly check: boolean;
  readonly auto: boolean;
  readonly silent?: boolean;
}

/**
 * Version command options
 */
export interface VersionCommandOptions {
  readonly verbose: boolean;
  readonly checkForUpdates: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly value?: any;
}

/**
 * Event logging interface
 */
export interface CliEvent {
  readonly timestamp: string;
  readonly level: 'info' | 'error' | 'warn' | 'debug';
  readonly event: string;
  readonly data?: Record<string, unknown>;
}

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * Query parsing result
 */
export interface ParsedQueries {
  readonly queries: readonly string[];
  readonly source: 'cli' | 'stdin' | 'file';
  readonly metadata?: {
    readonly filename?: string;
    readonly lineCount?: number;
  };
}

/**
 * Error context for command failures
 */
export interface ErrorContext {
  readonly command: string;
  readonly arguments: Record<string, unknown>;
  readonly error: Error;
  readonly timestamp: string;
  readonly stack?: string;
}

/**
 * Type guard for valid models
 */
export function isValidModel(model: unknown): model is ValidModel {
  return typeof model === 'string' &&
         ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-deep-research'].includes(model);
}

/**
 * Type guard for output formats
 */
export function isValidOutputFormat(format: unknown): format is OutputFormat {
  return format === 'json' || format === 'jsonl';
}

/**
 * Type guard for execution modes
 */
export function isValidExecutionMode(mode: unknown): mode is ExecutionMode {
  return typeof mode === 'string' &&
         ['search-api', 'chat-attachments', 'advanced-model', 'advanced'].includes(mode);
}