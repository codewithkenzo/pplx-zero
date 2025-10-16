/**
 * Types for export functionality
 */

export type ExportFormat = 'txt' | 'md' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  includeMetadata?: boolean;
  includeTimestamp?: boolean;
  cleanText?: boolean;
}

export interface ExportData {
  queries: string[];
  results: any[];
  metadata: {
    timestamp: string;
    queryCount: number;
    totalResults: number;
    executionTime: number;
    model?: string;
    success: boolean;
  };
}

export interface ExportTemplate {
  format: ExportFormat;
  template: (data: ExportData) => string;
  extension: string;
}