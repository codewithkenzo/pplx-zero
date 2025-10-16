/**
 * Types for history management system
 */

export interface HistoryEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  queries: string[];
  queryCount: number;
  model?: string;
  maxResults?: number;
  executionTime: number;
  success: boolean;
  resultsCount: number;
  exportPath?: string;
  mode: 'search-api' | 'chat-attachments' | 'advanced-model';
}

export interface HistorySession {
  id: string;
  startTime: string;
  endTime: string;
  totalQueries: number;
  successfulQueries: number;
  totalResults: number;
  totalExecutionTime: number;
  model?: string;
  exportPaths?: string[];
}

export interface HistoryStats {
  totalSessions: number;
  totalQueries: number;
  totalResults: number;
  averageExecutionTime: number;
  successRate: number;
  mostUsedModel?: string;
  lastQueryTime?: string;
}

export interface HistoryConfig {
  maxEntries: number;
  maxSessionAge: number; // in days
  autoCleanup: boolean;
  historyPath: string;
  sessionsPath: string;
}