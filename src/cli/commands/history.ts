/**
 * History command handler for PPLX-Zero
 * Handles history viewing and search file management
 */

import { HistoryManager } from '../../history/manager.js';
import { CliFormatter } from '../../cli/formatter.js';
import type {
  HistoryCommandOptions,
  CommandResult,
  ExitCode
} from '../types.js';

/**
 * Handle history command
 */
export async function handleHistoryCommand(options: {
  limit?: number;
  showFiles: boolean;
  queryPattern?: string;
  rawArgs: readonly string[];
}): Promise<CommandResult> {
  try {
    const historyManager = new HistoryManager();

    if (options.showFiles) {
      // Handle search files display
      const searchFiles = await historyManager.getSearchFiles(options.queryPattern);
      const limitedFiles = options.limit ? searchFiles.slice(0, options.limit) : searchFiles;

      const formattedFiles = CliFormatter.formatSearchFilesList(limitedFiles);
      console.log(CliFormatter.supportsColors() ? formattedFiles : CliFormatter.formatPlainText(formattedFiles));

      return {
        exitCode: 0,
        output: `Displayed ${limitedFiles.length} search files${options.limit ? ` (limited to ${options.limit})` : ''}`,
      };
    } else {
      // Handle regular history display
      const entries = options.limit ?
        await historyManager.getHistory(options.limit) :
        await historyManager.getHistory();

      const formattedHistory = CliFormatter.formatHistoryList(entries);
      console.log(CliFormatter.supportsColors() ? formattedHistory : CliFormatter.formatPlainText(formattedHistory));

      return {
        exitCode: 0,
        output: `Displayed ${entries.length} history entries${options.limit ? ` (limited to ${options.limit})` : ''}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const formattedError = CliFormatter.formatError(`History command failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));

    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}

/**
 * Parse history command arguments from raw args
 */
export function parseHistoryArgs(args: readonly string[]): HistoryCommandOptions {
  const options: HistoryCommandOptions = {
    limit: undefined,
    showFiles: false,
    queryPattern: undefined,
  };

  for (const arg of args) {
    if (arg === '--search-files') {
      options.showFiles = true;
    } else if (/^\d+$/.test(arg)) {
      const num = parseInt(arg, 10);
      if (num > 0) {
        options.limit = num;
      }
    } else if (!arg.startsWith('-')) {
      // Treat non-flag, non-numeric arguments as query pattern
      options.queryPattern = arg;
    }
  }

  return options;
}

/**
 * Validate history command options
 */
export function validateHistoryOptions(options: HistoryCommandOptions): {
  valid: boolean;
  error?: string;
} {
  if (options.limit !== undefined && (options.limit < 1 || options.limit > 1000)) {
    return {
      valid: false,
      error: 'History limit must be between 1 and 1000',
    };
  }

  return { valid: true };
}