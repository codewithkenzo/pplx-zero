#!/usr/bin/env bun
/**
 * PPLX-Zero CLI - Thin entrypoint with Commander.js
 * Modular, testable, and maintainable CLI structure
 */

import { Command } from 'commander';
import { getHelpMessage, getAdvancedHelpMessage } from './help/usage.js';
import { handleSearchCommand } from './commands/search.js';
import { handleHistoryCommand, parseHistoryArgs, validateHistoryOptions } from './commands/history.js';
import { handleUpdateCommand, validateUpdateOptions } from './commands/update.js';
import { handleVersionCommand, validateVersionOptions } from './commands/version.js';
import type { CommandResult, ExitCode } from './types.js';

/**
 * Main CLI program setup
 */
const program = new Command();

// Configure program
program
  .name('pplx')
  .description('Fast Perplexity AI search CLI with multi-search, history, and export')
  .version('1.1.4', '-v, --version', 'Show version information')
  .helpOption('-h, --help', 'Show this help message');

// Global options
program
  .option('-m, --model <model>', 'AI model: sonar, sonar-pro, sonar-reasoning, sonar-deep-research')
  .option('-n, --max-results <n>', 'Maximum results per query (default: 5, range: 1-20)', '5')
  .option('-c, --concurrency <n>', 'Concurrency for batch searches (default: 5, range: 1-20)', '5')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds (default: 30000, range: 1000-300000)', '30000')
  .option('-f, --file <file>', 'Attach document for analysis')
  .option('-i, --image <file>', 'Attach image for analysis')
  .option('-o, --format <format>', 'Output format: json|jsonl (default: json)', 'json')
  .option('-q, --query <query>', 'Search query (alternative to positional queries)')
  .option('--export <filename>', 'Export results to file')
  .option('-I, --input <file>', 'Read queries from JSON file')
  .option('-s, --stdin', 'Read queries from stdin (JSON format)')
  .option('--attach <files...>', 'Additional file attachments (multiple allowed)')
  .option('--attach-image <files...>', 'Additional image attachments (multiple allowed)')
  .option('--async', 'Enable async mode for advanced models')
  .option('--webhook <url>', 'Webhook URL for async results')
  .option('--workspace <path>', 'Workspace directory for file operations')
  .option('--use-search-api', 'Use search API (default: true)', true)
  .option('--batch-size <n>', 'Batch size for processing (default: 20, range: 1-100)', '20')
  .allowExcessArguments(true)
  .argument('[queries...]', 'Search queries (multiple queries enable multi-search)');

// History command
program
  .command('history')
  .description('Show search history')
  .argument('[limit]', 'Number of recent searches to show (max 50)')
  .option('-f, --files', 'Show individual search files with query+date naming')
  .option('--query-pattern <pattern>', 'Filter search files by query pattern')
  .action(async (limit: string | undefined, options, command) => {
    const args = command.parent?.args.slice(command.parent!.args.indexOf(command.name()) + 1) || [];
    const historyOptions = parseHistoryArgs(args);

    if (limit && /^\d+$/.test(limit)) {
      historyOptions.limit = parseInt(limit, 10);
    }

    const validation = validateHistoryOptions(historyOptions);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }

    const result = await handleHistoryCommand({
      limit: historyOptions.limit,
      showFiles: historyOptions.showFiles,
      queryPattern: historyOptions.queryPattern,
      rawArgs: args,
    });

    process.exit(result.exitCode);
  });

// Update command
program
  .command('update')
  .description('Manage PPLX-Zero updates')
  .option('--check', 'Check for available updates')
  .option('--auto', 'Install available updates and relaunch')
  .action(async (options) => {
    const validation = validateUpdateOptions(options);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }

    const result = await handleUpdateCommand({
      check: options.check,
      auto: options.auto,
    });

    process.exit(result.exitCode);
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .option('--verbose', 'Show detailed version information')
  .option('--check-updates', 'Check for available updates')
  .action(async (options) => {
    const validation = validateVersionOptions(options);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }

    const result = await handleVersionCommand({
      verbose: options.verbose || false,
      checkForUpdates: options.checkUpdates || false,
    });

    process.exit(result.exitCode);
  });



// Handle special cases for backward compatibility
program.hook('preSubcommand', async (thisCommand) => {
  const commandName = thisCommand.name();

  // Handle legacy flags that should be treated as commands
  const args = process.argv.slice(2);
  const hasHistoryFlag = args.includes('--history') || args.includes('-h');
  const hasSearchFilesFlag = args.includes('--search-files');
  const hasUpdateCheckFlag = args.includes('--update-check');
  const hasAutoUpdateFlag = args.includes('--auto-update');
  const hasVersionFlag = args.includes('--version') || args.includes('-v');

  // Handle legacy history flag
  if (hasHistoryFlag && !commandName) {
    const historyArgs = args.slice(args.indexOf('--history') + 1) ||
                       args.slice(args.indexOf('-h') + 1);

    const limitArg = historyArgs.find(arg => /^\d+$/.test(arg));
    const limit = limitArg ? parseInt(limitArg, 10) : undefined;

    const result = await handleHistoryCommand({
      limit,
      showFiles: false,
      queryPattern: undefined,
      rawArgs: args,
    });

    process.exit(result.exitCode);
  }

  // Handle legacy search-files flag
  if (hasSearchFilesFlag && !commandName) {
    const result = await handleHistoryCommand({
      limit: undefined,
      showFiles: true,
      queryPattern: undefined,
      rawArgs: args,
    });

    process.exit(result.exitCode);
  }

  // Handle legacy update flags
  if ((hasUpdateCheckFlag || hasAutoUpdateFlag) && !commandName) {
    const result = await handleUpdateCommand({
      check: hasUpdateCheckFlag,
      auto: hasAutoUpdateFlag,
    });

    process.exit(result.exitCode);
  }

  // Handle legacy version flag
  if (hasVersionFlag && !commandName) {
    const result = await handleVersionCommand({
      verbose: false,
      checkForUpdates: false,
    });

    process.exit(result.exitCode);
  }
});

// Main action handler for search functionality
program.action(async (queries: string[], options) => {
  const result = await handleSearchCommand({
    query: options.query,
    file: options.file,
    image: options.image,
    format: options.format,
    model: options.model,
    maxResults: options.maxResults,
    concurrency: options.concurrency,
    timeout: options.timeout,
    batchSize: options.batchSize,
    useSearchAPI: options.useSearchApi,
    stdin: options.stdin,
    input: options.input,
    attach: options.attach || [],
    attachImage: options.attachImage || [],
    export: options.export,
    async: options.async,
    webhook: options.webhook,
    positionals: queries,
  });

  process.exit(result.exitCode);
});

// Error handling
program.exitOverride();

// Process signals for graceful shutdown
process.on('SIGINT', () => {
  console.error('\\nReceived SIGINT. Exiting gracefully...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.error('\\nReceived SIGTERM. Exiting gracefully...');
  process.exit(143);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  // Don't treat help output as an error
  if (error.message === '(outputHelp)') {
    process.exit(0);
  }
  // Don't treat version output as an error (but it's already been printed)
  if (/^\d+\.\d+\.\d+$/.test(error.message)) {
    process.exit(0);
  }
  console.error(`Uncaught Exception: ${error.message}`);
  if (process.env.PPLX_DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  if (process.env.PPLX_DEBUG) {
    console.error(reason);
  }
  process.exit(1);
});

// Parse and execute
program.parse();