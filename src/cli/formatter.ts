import type { SearchResult } from '../types.js';
import type { HistoryEntry } from '../history/types.js';
import type { ExportData } from '../export/types.js';

/**
 * CLI Response Formatter for PPLX-Zero
 * Provides clean, human-readable output formatting
 */
export class CliFormatter {
  private static readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  private static readonly symbols = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    search: '🔍',
    processing: '⏳',
    rocket: '🚀',
    file: '📄',
    folder: '📁',
    chart: '📊',
    clock: '🕐',
    gear: '⚙️',
    sparkles: '✨',
  };

  /**
   * Format search result for clean CLI output
   */
  static formatSearchResult(result: SearchResult, query: string, showMetadata: boolean = true): string {
    const lines: string[] = [];

    // Header with query and status
    lines.push(this.formatHeader(`Query: ${query}`, 'search'));
    lines.push('');

    if (result.ok && result.content) {
      // Chat-based result
      lines.push(this.formatContent(result.content));
      lines.push('');

      // Citations if available
      if (result.citations && result.citations.length > 0) {
        lines.push(this.formatSection('Sources', 'info'));
        result.citations.forEach((citation, index) => {
          lines.push(`  ${index + 1}. ${this.dim(citation)}`);
        });
        lines.push('');
      }
    } else if (result.ok && result.results && Array.isArray(result.results)) {
      // Search-based result
      lines.push(this.formatSection('Search Results', 'search'));
      result.results.forEach((item: any, index: number) => {
        lines.push(this.formatSearchItem(item, index + 1));
      });
      lines.push('');
    } else {
      // Error result
      lines.push(this.formatError(result.error || 'Search failed'));
      lines.push('');
    }

    // Metadata
    if (showMetadata) {
      lines.push(this.formatMetadata(result));
    }

    return lines.join('\n');
  }

  /**
   * Format multi-search results
   */
  static formatMultiSearchResults(results: SearchResult[], queries: string[]): string {
    const lines: string[] = [];

    lines.push(this.formatHeader(`Multi-Search: ${queries.length} queries`, 'search'));
    lines.push('');

    queries.forEach((query, index) => {
      const result = results[index];
      lines.push(this.formatSubHeader(`${index + 1}. ${query}`, 'search'));

      if (result.ok && result.content) {
        // Truncate long content for cleaner display
        const content = this.truncateContent(result.content, 300);
        lines.push(this.formatContent(content));
        lines.push('');
      } else if (result.ok && result.results && Array.isArray(result.results)) {
        lines.push(`${this.symbols.info} Found ${result.results.length} results`);
        if (result.results.length > 0) {
          const topResult = result.results[0];
          lines.push(`  📄 ${topResult.title}`);
          lines.push(`     ${this.dim(topResult.snippet || '')}`);
        }
        lines.push('');
      } else {
        lines.push(this.formatError(result.error || 'Search failed'));
        lines.push('');
      }
    });

    // Summary
    const successCount = results.filter(r => r.ok).length;
    const summary = `${successCount}/${results.length} queries successful`;
    lines.push(this.formatSection(summary, successCount === results.length ? 'success' : 'warning'));

    return lines.join('\n');
  }

  /**
   * Format history entry for clean display
   */
  static formatHistoryEntry(entry: HistoryEntry): string {
    const date = new Date(entry.timestamp).toLocaleString();
    const queries = entry.queries.slice(0, 2).join(', ');
    const more = entry.queries.length > 2 ? ` +${entry.queries.length - 2}` : '';

    const status = entry.success ? this.symbols.success : this.symbols.error;
    const model = entry.model || 'default';

    return [
      this.formatSubHeader(`${status} ${date} | ${model} | ${entry.queryCount} queries | ${entry.executionTime.toFixed(0)}ms`),
      `   ${queries}${more}`,
    ].join('\n');
  }

  /**
   * Format history list
   */
  static formatHistoryList(entries: HistoryEntry[]): string {
    if (entries.length === 0) {
      return this.formatInfo('No search history found.');
    }

    const lines: string[] = [];
    lines.push(this.formatHeader(`Search History (${entries.length} entries)`, 'folder'));
    lines.push('');

    entries.forEach((entry, index) => {
      lines.push(`${index + 1}. ${this.formatHistoryEntry(entry)}`);
      if (index < entries.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format search files list
   */
  static formatSearchFilesList(files: Array<{ filename: string; entry: HistoryEntry }>): string {
    if (files.length === 0) {
      return this.formatInfo('No search files found.');
    }

    const lines: string[] = [];
    lines.push(this.formatHeader(`Search Files (${files.length} files)`, 'folder'));
    lines.push('');

    files.forEach(({ filename, entry }, index) => {
      const date = new Date(entry.timestamp).toLocaleString();
      const queries = entry.queries.slice(0, 2).join(', ');
      const more = entry.queries.length > 2 ? ` +${entry.queries.length - 2}` : '';
      const status = entry.success ? this.symbols.success : this.symbols.error;

      lines.push(`${index + 1}. ${this.formatSubHeader(filename, 'file')}`);
      lines.push(`   ${date} | ${entry.model || 'default'} | ${entry.queryCount} queries ${status}`);
      lines.push(`   ${queries}${more}`);

      if (index < files.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format export status
   */
  static formatExportStatus(filename: string, format: string, size: number): string {
    const lines: string[] = [];

    lines.push(this.formatHeader('Export Complete', 'success'));
    lines.push('');

    lines.push(`${this.symbols.file} File: ${this.bold(filename)}`);
    lines.push(`${this.symbols.gear} Format: ${format.toUpperCase()}`);
    lines.push(`${this.symbols.chart} Size: ${this.formatFileSize(size)}`);

    lines.push('');
    lines.push(this.formatInfo('Export saved successfully!'));

    return lines.join('\n');
  }

  /**
   * Format update notification
   */
  static formatUpdateNotification(current: string, latest: string): string {
    const lines: string[] = [];

    lines.push(this.formatHeader('Update Available', 'warning'));
    lines.push('');

    lines.push(`${this.symbols.rocket} Update: ${this.dim(current)} → ${this.bold(latest)}`);
    lines.push('');

    lines.push(this.formatSection('Installation Options:', 'info'));
    lines.push(`  npm install -g pplx-zero@${latest}`);
    lines.push(`  yarn global add pplx-zero@${latest}`);
    lines.push(`  bun install -g pplx-zero@${latest}`);

    return lines.join('\n');
  }

  /**
   * Format update progress
   */
  static formatUpdateProgress(stage: string, details?: string): string {
    const lines: string[] = [];

    lines.push(`${this.symbols.processing} ${this.bold(stage)}`);
    if (details) {
      lines.push(`   ${this.dim(details)}`);
    }

    return lines.join('\n');
  }

  /**
   * Format error message
   */
  static formatError(message: string): string {
    return `${this.colors.red}${this.symbols.error} Error: ${message}${this.colors.reset}`;
  }

  /**
   * Format info message
   */
  static formatInfo(message: string): string {
    return `${this.colors.blue}${this.symbols.info} ${message}${this.colors.reset}`;
  }

  /**
   * Format warning message
   */
  static formatWarning(message: string): string {
    return `${this.colors.yellow}${this.symbols.warning} Warning: ${message}${this.colors.reset}`;
  }

  /**
   * Format success message
   */
  static formatSuccess(message: string): string {
    return `${this.colors.green}${this.symbols.success} ${message}${this.colors.reset}`;
  }

  /**
   * Format header text
   */
  private static formatHeader(text: string, symbol?: keyof typeof CliFormatter.symbols): string {
    const sym = symbol ? CliFormatter.symbols[symbol] : '';
    return `${this.colors.bright}${this.colors.cyan}${sym} ${text}${this.colors.reset}`;
  }

  /**
   * Format sub-header
   */
  private static formatSubHeader(text: string, symbol?: keyof typeof CliFormatter.symbols): string {
    const sym = symbol ? CliFormatter.symbols[symbol] : '';
    return `${this.colors.bright}${sym} ${text}${this.colors.reset}`;
  }

  /**
   * Format section header
   */
  private static formatSection(title: string, symbol?: keyof typeof CliFormatter.symbols): string {
    const sym = symbol ? CliFormatter.symbols[symbol] : '';
    return `${this.colors.bright}${sym} ${title}${this.colors.reset}`;
  }

  /**
   * Format content with proper spacing
   */
  private static formatContent(content: string): string {
    // Add proper spacing and formatting for content
    const paragraphs = content.split('\n\n');
    return paragraphs
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `  ${p}`)
      .join('\n\n');
  }

  /**
   * Format search result item
   */
  private static formatSearchItem(item: any, index: number): string {
    const lines: string[] = [];

    lines.push(`  ${index}. ${this.bold(item.title)}`);

    if (item.snippet) {
      lines.push(`     ${this.dim(item.snippet)}`);
    }

    if (item.url) {
      lines.push(`     🔗 ${this.dim(item.url)}`);
    }

    return lines.join('\n');
  }

  /**
   * Format metadata section
   */
  private static formatMetadata(result: SearchResult): string {
    const lines: string[] = [];

    lines.push(this.formatSection('Metadata', 'chart'));

    if (result.model) {
      lines.push(`  Model: ${result.model}`);
    }

    if (result.usage) {
      lines.push(`  Tokens: ${result.usage.prompt_tokens || 0} prompt, ${result.usage.completion_tokens || 0} completion`);
    }

    if (result.duration) {
      lines.push(`  Duration: ${result.duration.toFixed(0)}ms`);
    }

    return lines.join('\n');
  }

  /**
   * Format file size
   */
  private static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Truncate content to specified length
   */
  private static truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Bold text formatting
   */
  private static bold(text: string): string {
    return `${this.colors.bright}${text}${this.colors.reset}`;
  }

  /**
   * Dim text formatting
   */
  private static dim(text: string): string {
    return `${this.colors.dim}${text}${this.colors.reset}`;
  }

  /**
   * Check if terminal supports colors
   */
  static supportsColors(): boolean {
    // Check if we're in a TTY and not a dumb terminal
    const isTTY = process.stdout.isTTY;
    const isNotDumb = process.env.TERM !== 'dumb';
    const isWindows = process.platform === 'win32';

    // On Windows, enable colors for common terminals
    if (isWindows) {
      const term = process.env.TERM_PROGRAM || '';
      return isTTY && (term.includes('vscode') || term.includes('hyper') || term.includes('terminal') || isNotDumb);
    }

    return isTTY && isNotDumb;
  }

  /**
   * Get plain text version (no colors/symbols)
   */
  static formatPlainText(text: string): string {
    // Always remove color codes
    let cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');

    // Replace unicode symbols with ASCII alternatives for better compatibility
    cleanText = cleanText.replace(/[✅❌⚠️ℹ️🔍⏳🚀📄📁📊🕐⚙️✨🔗]/g, (match) => {
      const symbolMap: Record<string, string> = {
        '✅': '[OK]',
        '❌': '[ERROR]',
        '⚠️': '[WARNING]',
        'ℹ️': '[INFO]',
        '🔍': '[SEARCH]',
        '⏳': '[PROCESSING]',
        '🚀': '[UPDATE]',
        '📄': '[FILE]',
        '📁': '[FOLDER]',
        '📊': '[CHART]',
        '🕐': '[TIME]',
        '⚙️': '[SETTINGS]',
        '✨': '[SPARKLES]',
        '🔗': '[LINK]',
      };
      return symbolMap[match] || match;
    });

    // Ensure proper UTF-8 encoding by normalizing the string
    if (typeof cleanText.normalize === 'function') {
      cleanText = cleanText.normalize('NFC');
    }

    return cleanText;
  }
}