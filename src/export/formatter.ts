import type { ExportData, ExportOptions, ExportTemplate } from './types.js';

/**
 * Export formatter for different output formats
 */
export class ExportFormatter {
  private static templates: Record<string, ExportTemplate> = {
    txt: {
      format: 'txt',
      extension: '.txt',
      template: (data: ExportData) => {
        const lines: string[] = [];

        if (data.includeTimestamp) {
          lines.push(`Generated: ${new Date(data.metadata.timestamp).toLocaleString()}`);
          lines.push('');
        }

        lines.push(`Search Results (${data.queries.length} queries)`);
        lines.push('='.repeat(50));
        lines.push('');

        data.queries.forEach((query, index) => {
          lines.push(`Query ${index + 1}: ${query}`);
          lines.push('-'.repeat(30));

          const result = data.results[index];
          if (result && result.ok) {
            if (result.content) {
              // Chat-based result
              lines.push(result.content);
              if (result.citations && result.citations.length > 0) {
                lines.push('\nSources:');
                result.citations.forEach((citation: string) => {
                  lines.push(`  - ${citation}`);
                });
              }
            } else if (result.results && Array.isArray(result.results)) {
              // Search-based result
              result.results.forEach((item: any) => {
                lines.push(`• ${item.title}`);
                lines.push(`  ${item.snippet}`);
                if (item.url) lines.push(`  🔗 ${item.url}`);
                lines.push('');
              });
            }
          } else {
            lines.push('❌ Search failed');
            if (result.error) {
              lines.push(`Error: ${result.error}`);
            }
          }
          lines.push('\n');
        });

        if (data.includeMetadata) {
          lines.push('Metadata:');
          lines.push(`- Total queries: ${data.metadata.queryCount}`);
          lines.push(`- Total results: ${data.metadata.totalResults}`);
          lines.push(`- Execution time: ${data.metadata.executionTime.toFixed(0)}ms`);
          lines.push(`- Model: ${data.metadata.model || 'default'}`);
          lines.push(`- Success: ${data.metadata.success ? 'Yes' : 'No'}`);
        }

        return lines.join('\n');
      },
    },

    md: {
      format: 'md',
      extension: '.md',
      template: (data: ExportData) => {
        let markdown = '';

        if (data.includeTimestamp) {
          markdown += `*Generated: ${new Date(data.metadata.timestamp).toLocaleString()}*\n\n`;
        }

        markdown += `# Search Results (${data.queries.length} queries)\n\n`;

        data.queries.forEach((query, index) => {
          markdown += `## Query ${index + 1}: ${query}\n\n`;

          const result = data.results[index];
          if (result && result.ok) {
            if (result.content) {
              // Chat-based result
              markdown += `${result.content}\n\n`;

              if (result.citations && result.citations.length > 0) {
                markdown += `### Sources:\n\n`;
                result.citations.forEach((citation: string) => {
                  markdown += `- ${citation}\n`;
                });
                markdown += '\n';
              }
            } else if (result.results && Array.isArray(result.results)) {
              // Search-based result
              result.results.forEach((item: any) => {
                markdown += `### ${item.title}\n\n`;
                markdown += `${item.snippet}\n\n`;
                if (item.url) {
                  markdown += `🔗 [View Source](${item.url})\n\n`;
                }
              });
            }
          } else {
            markdown += `❌ **Search failed**\n\n`;
            if (result.error) {
              markdown += `**Error:** ${result.error}\n\n`;
            }
          }

          markdown += '---\n\n';
        });

        if (data.includeMetadata) {
          markdown += `## Metadata\n\n`;
          markdown += `- **Total queries:** ${data.metadata.queryCount}\n`;
          markdown += `- **Total results:** ${data.metadata.totalResults}\n`;
          markdown += `- **Execution time:** ${data.metadata.executionTime.toFixed(0)}ms\n`;
          markdown += `- **Model:** ${data.metadata.model || 'default'}\n`;
          markdown += `- **Success:** ${data.metadata.success ? '✅ Yes' : '❌ No'}\n\n`;
        }

        return markdown;
      },
    },

    json: {
      format: 'json',
      extension: '.json',
      template: (data: ExportData) => {
        return JSON.stringify(data, null, 2);
      },
    },
  };

  /**
   * Format export data according to specified format
   */
  static format(data: ExportData, options: ExportOptions): string {
    const template = this.templates[options.format];
    if (!template) {
      throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Enhance data with format-specific options
    const enhancedData = {
      ...data,
      includeTimestamp: options.includeTimestamp !== false,
      includeMetadata: options.includeMetadata !== false,
    };

    return template.template(enhancedData);
  }

  /**
   * Get supported formats
   */
  static getSupportedFormats(): ExportFormat[] {
    return Object.keys(this.templates) as ExportFormat[];
  }

  /**
   * Get file extension for format
   */
  static getExtension(format: ExportFormat): string {
    const template = this.templates[format];
    return template ? template.extension : '.txt';
  }

  /**
   * Clean and sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove file extension if present
    let cleanName = filename.replace(/\.[^/.]+$/, '');

    // Replace invalid characters with underscores
    cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');

    // Remove leading/trailing spaces and dots
    cleanName = cleanName.trim().replace(/^\.+|\.+$/g, '');

    // Ensure filename is not empty
    if (!cleanName) {
      cleanName = 'export';
    }

    return cleanName;
  }

  /**
   * Generate filename with timestamp if needed
   */
  static generateFilename(baseFilename: string, format: ExportFormat, includeTimestamp: boolean = true): string {
    const cleanName = this.sanitizeFilename(baseFilename);
    const extension = this.getExtension(format);

    if (includeTimestamp) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      return `${cleanName}_${timestamp}${extension}`;
    }

    return `${cleanName}${extension}`;
  }
}