import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { HistoryEntry, HistorySession, HistoryStats, HistoryConfig } from './types.js';
import { randomUUID } from 'node:crypto';

/**
 * History Manager for PPLX-Zero search history
 */
export class HistoryManager {
  private readonly config: HistoryConfig;
  private readonly historyDir: string;

  constructor() {
    this.historyDir = join(homedir(), '.pplx-zero');
    this.config = {
      maxEntries: 1000,
      maxSessionAge: 30, // 30 days
      autoCleanup: true,
      historyPath: join(this.historyDir, 'history', 'search_history.jsonl'),
      sessionsPath: join(this.historyDir, 'history', 'sessions'),
    };
  }

  /**
   * Initialize history directory structure
   */
  async initialize(): Promise<void> {
    try {
      const historyDir = dirname(this.config.historyPath);
      await fs.mkdir(historyDir, { recursive: true });
      await fs.mkdir(this.config.sessionsPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize history directory:', error);
    }
  }

  /**
   * Add a search entry to history
   */
  async addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.initialize();

    const fullEntry: HistoryEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    try {
      const entryLine = JSON.stringify(fullEntry) + '\n';
      await fs.appendFile(this.config.historyPath, entryLine);

      if (this.config.autoCleanup) {
        await this.cleanup();
      }

      return fullEntry.id;
    } catch (error) {
      console.error('Failed to add history entry:', error);
      throw error;
    }
  }

  /**
   * Get history entries with optional limit
   */
  async getHistory(limit?: number): Promise<HistoryEntry[]> {
    try {
      await this.initialize();

      const data = await fs.readFile(this.config.historyPath, 'utf-8');
      const lines = data.trim().split('\n').filter(line => line);

      let entries: HistoryEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as HistoryEntry;
          entries.push(entry);
        } catch {
          // Skip malformed entries
          continue;
        }
      }

      // Sort by timestamp (newest first) and apply limit
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (limit && limit > 0) {
        entries = entries.slice(0, Math.min(limit, 50)); // Max 50 for display
      }

      return entries;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []; // File doesn't exist yet
      }
      console.error('Failed to read history:', error);
      return [];
    }
  }

  /**
   * Get search statistics
   */
  async getStats(): Promise<HistoryStats> {
    try {
      const entries = await this.getHistory();

      if (entries.length === 0) {
        return {
          totalSessions: 0,
          totalQueries: 0,
          totalResults: 0,
          averageExecutionTime: 0,
          successRate: 0,
        };
      }

      const totalQueries = entries.reduce((sum, entry) => sum + entry.queryCount, 0);
      const totalResults = entries.reduce((sum, entry) => sum + entry.resultsCount, 0);
      const successfulQueries = entries.filter(entry => entry.success).length;
      const totalExecutionTime = entries.reduce((sum, entry) => sum + entry.executionTime, 0);

      // Find most used model
      const modelCounts: Record<string, number> = {};
      entries.forEach(entry => {
        if (entry.model) {
          modelCounts[entry.model] = (modelCounts[entry.model] || 0) + 1;
        }
      });

      const mostUsedModel = Object.entries(modelCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      return {
        totalSessions: entries.length,
        totalQueries,
        totalResults,
        averageExecutionTime: totalExecutionTime / entries.length,
        successRate: (successfulQueries / entries.length) * 100,
        mostUsedModel,
        lastQueryTime: entries[0]?.timestamp,
      };
    } catch (error) {
      console.error('Failed to get history stats:', error);
      return {
        totalSessions: 0,
        totalQueries: 0,
        totalResults: 0,
        averageExecutionTime: 0,
        successRate: 0,
      };
    }
  }

  /**
   * Clean up old history entries
   */
  async cleanup(): Promise<void> {
    try {
      const entries = await this.getHistory();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxSessionAge);

      const validEntries = entries.filter(entry =>
        new Date(entry.timestamp) > cutoffDate
      );

      // Keep only the most recent entries up to maxEntries
      const finalEntries = validEntries.slice(0, this.config.maxEntries);

      // Rewrite history file with cleaned entries
      const historyContent = finalEntries
        .map(entry => JSON.stringify(entry))
        .join('\n') + '\n';

      await fs.writeFile(this.config.historyPath, historyContent);
    } catch (error) {
      console.error('Failed to cleanup history:', error);
    }
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    try {
      await fs.writeFile(this.config.historyPath, '');

      // Clean up session files
      try {
        const sessionFiles = await fs.readdir(this.config.sessionsPath);
        await Promise.all(
          sessionFiles.map(file => fs.unlink(join(this.config.sessionsPath, file)))
        );
      } catch {
        // Sessions directory might not exist
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }

  /**
   * Get history file path for display
   */
  getHistoryPath(): string {
    return this.config.historyPath;
  }

  /**
   * Format history entry for display
   */
  formatEntry(entry: HistoryEntry): string {
    const date = new Date(entry.timestamp).toLocaleString();
    const queries = entry.queries.slice(0, 3).join(', ');
    const more = entry.queries.length > 3 ? ` +${entry.queries.length - 3} more` : '';

    return `🔍 ${date} | ${entry.model || 'default'} | ${entry.queryCount} queries | ${entry.executionTime.toFixed(0)}ms | ${entry.success ? '✅' : '❌'}\n   ${queries}${more}`;
  }

  /**
   * Format multiple entries for display
   */
  async formatHistory(limit?: number): Promise<string> {
    const entries = await this.getHistory(limit);

    if (entries.length === 0) {
      return '📝 No search history found.';
    }

    const stats = await this.getStats();
    const header = `📚 Search History (showing ${entries.length} of ${stats.totalSessions} searches)\n`;
    const footer = `\n📊 Total: ${stats.totalQueries} queries, ${stats.totalResults} results, ${stats.successRate.toFixed(1)}% success rate`;

    const formattedEntries = entries.map(entry => this.formatEntry(entry)).join('\n\n');

    return header + formattedEntries + footer;
  }
}