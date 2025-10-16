#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { OptimizedPerplexitySearchEngine, fastSearch, fastMultiSearch, processFileAttachments, getApiKey } from './core.js';
import { ErrorCode } from './types.js';
import { HistoryManager } from './history/manager.js';
import { ExportFormatter } from './export/formatter.js';
import { UpdateChecker } from './update/checker.js';
import { PplxUpdateStrategy } from './update/strategy.js';
import { FileUtils } from './utils/file.js';
import { CliFormatter } from './cli/formatter.js';
import { initializeSignalHandling, addCleanupCallback } from './utils/signals.js';
import { processStreamingOutput } from './utils/output.js';
import { ConfigManager, initializeConfig } from './config/manager.js';
import type { SearchResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);

interface OptimizedCliOptions {
  // Basic options
  query?: string;
  file?: string;
  image?: string;
  format?: string;
  model?: string;

  // Commands
  version?: boolean;
  help?: boolean;
  'help-advanced'?: boolean;
  history?: boolean;
  'search-files'?: boolean;
  'update-check'?: boolean;
  'auto-update'?: boolean;

  // Configuration options
  config?: string;
  'save-config'?: boolean;
  'show-config'?: boolean;
  'reset-config'?: boolean;
  'validate-config'?: boolean;
  profile?: string;

  // Export options
  export?: string;

  // Advanced options
  input?: string;
  stdin?: boolean;
  concurrency?: string;
  timeout?: string;
  workspace?: string;
  attach?: string[];
  'attach-image'?: string[];
  async?: boolean;
  webhook?: string;

  // Performance options
  'use-search-api'?: boolean;
  'max-results'?: string;
  'batch-size'?: string;

  // Streaming options
  stream?: boolean;
}

interface ParsedArgs {
  values: OptimizedCliOptions;
  positionals: string[];
}

// Parse arguments, handling history override for help
const args = process.argv.slice(2);
const hasHistoryFlag = args.includes('--history') || args.includes('-h');
const hasHelpFlag = args.includes('--help');
const hasVersionFlag = args.includes('--version') || args.includes('-v');

// If -h is used and not combined with other flags, treat as history
const historyOverride = hasHistoryFlag && !hasHelpFlag && !hasVersionFlag && args.length <= 2;

const { values: cliOptions, positionals: commandLineQueries }: ParsedArgs = parseArgs({
  args: args,
  options: {
    // Basic options
    query: { type: 'string', short: 'q' },
    file: { type: 'string', short: 'f' },
    image: { type: 'string', short: 'i' },
    format: { type: 'string', short: 'o', default: 'json' },
    model: { type: 'string', short: 'm' },

    // Commands
    version: { type: 'boolean', short: 'v' },
    help: { type: 'boolean' },
    'help-advanced': { type: 'boolean' },
    history: { type: 'boolean', short: 'h' },
    'search-files': { type: 'boolean' },
    'update-check': { type: 'boolean' },
    'auto-update': { type: 'boolean' },

    // Configuration options
    config: { type: 'string' },
    'save-config': { type: 'boolean' },
    'show-config': { type: 'boolean' },
    'reset-config': { type: 'boolean' },
    'validate-config': { type: 'boolean' },
    profile: { type: 'string' },

    // Export options
    export: { type: 'string' },

    // Advanced options
    input: { type: 'string', short: 'I' },
    stdin: { type: 'boolean', short: 's' },
    concurrency: { type: 'string', short: 'c' },
    timeout: { type: 'string', short: 't' },
    workspace: { type: 'string', short: 'w' },
    attach: { type: 'string', multiple: true },
    'attach-image': { type: 'string', multiple: true },
    async: { type: 'boolean' },
    webhook: { type: 'string' },

    // Performance options
    'use-search-api': { type: 'boolean', default: true },
    'max-results': { type: 'string', short: 'n', default: '5' },
    'batch-size': { type: 'string', default: '20' },

    // Streaming options
    stream: { type: 'boolean' },
  },
  allowPositionals: true,
}) as ParsedArgs;

function showHelp() {
  console.error(`
PPLX-Zero - Perplexity AI search CLI with multi-search, history, and export

USAGE:
  pplx [OPTIONS] [QUERY...]

SEARCH OPTIONS:
  -m, --model <model>         AI model: sonar, sonar-pro, sonar-reasoning, sonar-deep-research
  -n, --max-results <n>       Maximum results per query (default: 5)
  -c, --concurrency <n>       Concurrency for batch searches (default: 5)
  -t, --timeout <ms>           Request timeout in milliseconds (default: 30000)
  -f, --file <file>           Attach document for analysis
  -i, --image <file>          Attach image for analysis
  -o, --format <format>       Output format: json|jsonl (default: json)
  -q, --query <query>         Search query
      --stream                Enable real-time streaming output (Ctrl+C to cancel)

CONFIGURATION OPTIONS:
      --config <path>         Use custom configuration file
      --save-config           Save current CLI options to configuration
      --show-config           Show effective configuration
      --validate-config       Validate configuration and show status
      --reset-config          Reset configuration to defaults
      --profile <name>        Use named configuration profile

EXPORT OPTIONS:
      --export <filename>     Export results to file (supports .txt, .md, .json)

HISTORY OPTIONS:
  -h, --history [n]           Show search history (last n searches, max 50)
      --search-files          Show individual search files with query+date naming
      --update-check          Check for available updates
      --auto-update           Install available updates and relaunch

HELP OPTIONS:
      --help                  Show this help message
  -v, --version               Show version information

EXAMPLES:
  # Single search
  pplx "latest AI developments"

  # Streaming search (real-time output)
  pplx --stream "latest AI developments"
  pplx --stream --model sonar-pro "What are the recent tech trends?"

  # Multi-search (automatic detection)
  pplx "AI trends 2024" "Rust vs Go" "Web3 adoption"

  # Multi-search with export
  pplx --model sonar-pro --export research.txt "quantum" "blockchain"

  # Search with file attachments
  pplx --file report.pdf "Summarize this document"
  pplx --image screenshot.png "What is this showing?"

  # Streaming with attachments
  pplx --stream --file document.pdf "Analyze this document in real-time"

  # Configuration management
  pplx --show-config                          # Show current configuration
  pplx --validate-config                      # Validate configuration
  pplx --save-config --model sonar-pro        # Save current options to config
  pplx --profile work "company research"       # Use named profile
  pplx --reset-config                         # Reset to defaults

  # View history
  pplx --history          # Show all history (up to 50)
  pplx --history 10       # Show last 10 searches
  pplx -h 10             # Same as above

  # Export results
  pplx --export results.md "machine learning trends"
  pplx --export analysis.txt "AI developments" "blockchain news"

  # Advanced models
  pplx --model sonar-reasoning "Explain quantum computing"
  pplx --model sonar-deep-research --export research.pdf "comprehensive AI analysis"

  # Streaming with advanced models
  pplx --stream --model sonar-reasoning "Step by step analysis of quantum computing"

HISTORY & EXPORT:
  • History is automatically saved to ~/.pplx-zero/history/
  • Export files are saved with cleaned, readable text
  • All searches are logged with metadata and performance metrics

CONFIGURATION:
  • Configuration is automatically discovered in: ~/.pplx-zero/config.json, ~/.config/pplx-zero/config.json
  • Project-specific configs can be placed as: .pplx-zero.json or config.json
  • CLI flags always override configuration file settings
  • Environment variables override both: PPLX_MODEL, PPLX_MAX_RESULTS, PPLX_CONCURRENCY, etc.

Get your API key: https://www.perplexity.ai/account/api/keys
Set environment variable: export PERPLEXITY_API_KEY="your-key"
`);
  process.exit(0);
}


function parseNumber(value: string | undefined, defaultValue: number, min: number, max: number, name: string): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function logEvent(level: 'info' | 'error', event: string, data?: any): void {
  console.error(JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    data
  }));
}

/**
 * Load and initialize configuration
 */
async function loadConfiguration(): Promise<ConfigManager | null> {
  try {
    const configManager = await initializeConfig({
      configFile: cliOptions.config,
      autoCreate: true,
      allowInvalid: false,
      environment: process.env.PPLX_ENV,
    });

    // Set profile if specified
    if (cliOptions.profile) {
      const profileResult = await configManager.switchProfile(cliOptions.profile);
      if (!profileResult.success) {
        console.error(`Warning: Failed to switch to profile "${cliOptions.profile}": ${profileResult.error}`);
      }
    }

    return configManager;
  } catch (error) {
    // Don't fail the entire CLI if config loading fails, just warn
    console.error(`Warning: Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Merge CLI options with configuration defaults
 */
function mergeOptionsWithConfig(cliOptions: OptimizedCliOptions, configManager: ConfigManager | null) {
  if (!configManager) {
    return cliOptions;
  }

  const defaults = configManager.getDefaults();
  const merged = { ...cliOptions };

  // Apply defaults where CLI options are not provided
  if (!cliOptions.model && defaults.model) {
    merged.model = defaults.model;
  }
  if (!cliOptions['max-results'] && defaults.maxResults) {
    merged['max-results'] = defaults.maxResults.toString();
  }
  if (!cliOptions.concurrency && defaults.concurrency) {
    merged.concurrency = defaults.concurrency.toString();
  }
  if (!cliOptions.timeout && defaults.timeout) {
    merged.timeout = defaults.timeout.toString();
  }
  if (!cliOptions['batch-size'] && defaults.batchSize) {
    merged['batch-size'] = defaults.batchSize.toString();
  }
  if (!cliOptions.format && defaults.outputFormat) {
    merged.format = defaults.outputFormat;
  }
  if (!cliOptions.stream && defaults.stream !== undefined) {
    merged.stream = defaults.stream;
  }
  if (cliOptions['use-search-api'] === undefined && defaults.useSearchApi !== undefined) {
    merged['use-search-api'] = defaults.useSearchApi;
  }

  return merged;
}

async function executeFastSearch(query: string, options: {
  maxResults: number;
  model?: string;
}): Promise<{
  success: boolean;
  results?: SearchResult[];
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const result = await fastSearch(query, {
      maxResults: options.maxResults,
      model: options.model,
    });

    return {
      success: result.success,
      results: result.results,
      executionTime: result.executionTime || performance.now() - startTime,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeBatchSearch(queries: string[], options: {
  maxResults: number;
  concurrency: number;
  model?: string;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{
  success: boolean;
  results?: any[];
  totalResults?: number;
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    const result = await fastMultiSearch(queries, {
      maxResults: options.maxResults,
      concurrency: options.concurrency,
      model: options.model,
      onProgress: options.onProgress,
    });

    return {
      success: result.success,
      results: result.results,
      totalResults: result.totalResults,
      executionTime: result.executionTime,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeChatWithAttachments(
  query: string,
  filePaths: string[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<{
  success: boolean;
  content?: string;
  citations?: string[];
  images?: any[];
  executionTime?: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    // Use unified environment variable handling
    const apiKey = getApiKey();
    const engine = new OptimizedPerplexitySearchEngine({ apiKey });

    // Process file attachments using public API
    const attachments = await processFileAttachments(filePaths);

    const result = await engine.executeChatWithAttachments(query, attachments, {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    return {
      success: true,
      content: result.content,
      citations: result.citations,
      images: result.images,
      executionTime: result.executionTime,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeAdvancedModel(
  query: string,
  options: {
    model: string;
    filePaths?: string[];
    maxTokens?: number;
    temperature?: number;
    webhook?: string;
    async?: boolean;
  }
): Promise<{
  success: boolean;
  content?: string;
  requestId?: string;
  status?: string;
  citations?: string[];
  images?: any[];
  executionTime?: number;
  isAsync?: boolean;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    // Use unified environment variable handling
    const apiKey = getApiKey();
    const engine = new OptimizedPerplexitySearchEngine({ apiKey });

    let attachments;
    if (options.filePaths && options.filePaths.length > 0) {
      // Process file attachments using public API
      attachments = await processFileAttachments(options.filePaths);
    }

    const result = await engine.executeAdvancedModel(query, {
      model: options.model,
      attachments,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      webhook: options.webhook,
    });

    return {
      success: true,
      content: result.content,
      requestId: result.requestId,
      status: result.status,
      citations: result.citations,
      images: result.images,
      executionTime: result.executionTime,
      isAsync: result.isAsync,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute streaming search with real-time output
 */
async function executeStreamingSearch(
  query: string,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    filePaths?: string[];
  },
  abortSignal: AbortSignal
): Promise<{
  success: boolean;
  content?: string;
  citations?: string[];
  images?: any[];
  executionTime: number;
  tokenCount: number;
  error?: string;
}> {
  const startTime = performance.now();

  try {
    // Use unified environment variable handling
    const apiKey = getApiKey();
    const engine = new OptimizedPerplexitySearchEngine({ apiKey });

    let attachments;
    let messages: any[] = [];

    // Process file attachments if provided
    if (options.filePaths && options.filePaths.length > 0) {
      attachments = await processFileAttachments(options.filePaths);

      // Create messages with attachments
      const userMessage: any = {
        role: "user",
        content: [
          { type: "text", text: query }
        ]
      };

      for (const attachment of attachments) {
        if (attachment.type === 'image') {
          userMessage.content.push({
            type: "image_url",
            image_url: {
              url: `data:${attachment.mimeType};base64,${attachment.content.toString('base64')}`
            }
          });
        } else {
          const textContent = attachment.content instanceof Buffer
            ? attachment.content.toString('utf-8')
            : attachment.content;

          userMessage.content.push({
            type: "text",
            text: `\n\n[Document: ${attachment.filename}]\n${textContent}`
          });
        }
      }

      messages = [
        {
          role: "system",
          content: "You are a helpful AI assistant. Analyze the provided files and query accurately. Provide citations when possible."
        },
        userMessage
      ];
    } else {
      // Standard messages without attachments
      messages = [
        { role: "system", content: "You are a helpful AI assistant. Provide accurate, concise responses with citations when possible." },
        { role: "user", content: query }
      ];
    }

    // Execute streaming chat completion
    const stream = engine.executeStreamingChatCompletion(query, {
      model: options.model || 'sonar',
      maxTokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.1,
      messages,
    }, abortSignal);

    // Process streaming output
    const result = await processStreamingOutput(stream, {
      useColors: true,
      showProgress: true,
      bufferDelay: 50,
      enableTypewriterEffect: false,
    }, abortSignal);

    const executionTime = performance.now() - startTime;

    if (result.success) {
      return {
        success: true,
        executionTime,
        tokenCount: result.tokenCount,
      };
    } else {
      return {
        success: false,
        executionTime,
        tokenCount: result.tokenCount,
        error: result.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      executionTime: performance.now() - startTime,
      tokenCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Export results to file with appropriate formatting
 */
async function exportResults(
  results: any,
  queries: string[],
  exportFilename: string,
  metadata: any
): Promise<string> {
  try {
    // Determine export format from file extension
    const format = exportFilename.endsWith('.md') ? 'md' :
                   exportFilename.endsWith('.json') ? 'json' : 'txt';

    // Prepare export data
    const exportData = {
      queries,
      results: Array.isArray(results.results) ? results.results : [results],
      metadata: {
        timestamp: new Date().toISOString(),
        queryCount: queries.length,
        totalResults: Array.isArray(results.results) ?
          results.results.reduce((sum: number, r: any) => sum + (r.results?.length || 1), 0) :
          (results.results?.length || 1),
        executionTime: metadata.executionTime,
        model: metadata.model,
        success: metadata.success,
      }
    };

    // Format content
    const formattedContent = ExportFormatter.format(exportData, {
      format,
      filename: exportFilename,
      includeMetadata: true,
      includeTimestamp: true,
      cleanText: true,
    });

    // Create export directory and write file
    const exportDir = await FileUtils.createExportDir();
    const fullFilename = ExportFormatter.generateFilename(exportFilename, format, false);
    const exportPath = join(exportDir, fullFilename);

    await FileUtils.writeFileWithBackup(exportPath, formattedContent);

    return exportPath;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

/**
 * Log search to history
 */
async function logToHistory(
  queries: string[],
  results: any,
  metadata: any,
  exportPath?: string
): Promise<void> {
  try {
    const historyManager = new HistoryManager();

    await historyManager.addEntry({
      sessionId: randomUUID(),
      queries,
      queryCount: queries.length,
      model: metadata.model,
      maxResults: metadata.maxResults,
      executionTime: metadata.executionTime,
      success: metadata.success,
      resultsCount: Array.isArray(results.results) ?
        results.results.reduce((sum: number, r: any) => sum + (r.results?.length || 1), 0) :
        (results.results?.length || 1),
      exportPath,
      mode: metadata.mode,
    });
  } catch (error) {
    // Don't let history errors break the main flow
    console.error('History logging failed:', error);
  }
}

async function main(): Promise<void> {
  const executionStartTime = Date.now();
  const sessionId = randomUUID();

  try {
    // Load configuration first
    const configManager = await loadConfiguration();

    // Handle configuration-specific commands
    if (cliOptions['show-config']) {
      if (!configManager) {
        console.error('No configuration available');
        process.exit(1);
      }
      const config = configManager.getEffectiveConfig();
      console.log(JSON.stringify(config, null, 2));
      process.exit(0);
    }

    if (cliOptions['validate-config']) {
      if (!configManager) {
        console.error('No configuration to validate');
        process.exit(1);
      }
      const validation = configManager.validateConfig();
      if (validation.valid) {
        console.log('✓ Configuration is valid');
        if (validation.warnings.length > 0) {
          console.log('Warnings:');
          validation.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        process.exit(0);
      } else {
        console.error('✗ Configuration is invalid:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        if (validation.warnings.length > 0) {
          console.log('Warnings:');
          validation.warnings.forEach(warning => console.log(`  - ${warning}`));
        }
        process.exit(1);
      }
    }

    if (cliOptions['reset-config']) {
      if (!configManager) {
        console.error('No configuration available to reset');
        process.exit(1);
      }
      const result = await configManager.resetConfig();
      if (result.success) {
        console.log('✓ Configuration reset to defaults');
        process.exit(0);
      } else {
        console.error(`✗ Failed to reset configuration: ${result.error}`);
        process.exit(1);
      }
    }

    // Merge CLI options with configuration
    const mergedOptions = mergeOptionsWithConfig(cliOptions, configManager);

    // Check for updates (non-blocking) but skip during auto-update scenarios
    const skipUpdateCheck = mergedOptions['auto-update'] || process.env.PPLX_AUTO_UPDATE_RELAUNCH === '1';

    if (!skipUpdateCheck) {
      const updateChecker = new UpdateChecker();
      updateChecker.showUpdateNotification().then((versionInfo) => {
        // If update is available, show enhanced notification
        if (versionInfo && versionInfo.updateAvailable) {
          const updateMessage = CliFormatter.formatUpdateNotification(versionInfo.current, versionInfo.latest);
          console.error(CliFormatter.supportsColors() ? updateMessage : CliFormatter.formatPlainText(updateMessage));
        }
      }).catch(() => {
        // Don't let update checks fail the main execution
      });
    }

    // Initialize signal handling and get abort signal
    const abortSignal = initializeSignalHandling();

    // Add cleanup callbacks for proper resource management
    addCleanupCallback(async () => {
      // Log cancellation to event log
      logEvent('info', 'operation_cancelled', {
        sessionId,
        queryCount: queries.length,
        mode: mergedOptions.stream ? 'streaming' : 'standard',
      });
    });

    // Use unified environment variable handling with fallback
    const apiKey = getApiKey();

    // Parse options using merged configuration
    const maxResults = parseNumber(mergedOptions['max-results'], 5, 1, 20, 'Max results');
    const concurrency = parseNumber(mergedOptions.concurrency, 5, 1, 20, 'Concurrency');
    const timeout = parseNumber(mergedOptions.timeout, 30000, 1000, 300000, 'Timeout');
    const batchSize = parseNumber(mergedOptions['batch-size'], 20, 1, 100, 'Batch size');

    const useSearchAPI = mergedOptions['use-search-api'] !== false;
    const outputFormat = mergedOptions.format as 'json' | 'jsonl';

    if (!['json', 'jsonl'].includes(outputFormat)) {
      throw new Error('Format must be json or jsonl');
    }

    // Validate model
    let selectedModel: string | undefined;
    if (mergedOptions.model) {
      const validModels = ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-deep-research'];
      if (!validModels.includes(mergedOptions.model)) {
        throw new Error(`Invalid model: ${mergedOptions.model}. Valid models: ${validModels.join(', ')}`);
      }
      selectedModel = mergedOptions.model;
    }

    logEvent('info', 'cli_initialized', {
      useSearchAPI,
      maxResults,
      concurrency,
      timeout,
      batchSize,
      model: selectedModel,
      format: outputFormat,
      hasAttachments: !!(mergedOptions.file || mergedOptions.image ||
        (mergedOptions.attach?.length || 0) + (mergedOptions['attach-image']?.length || 0)) > 0,
      configFile: configManager ? 'loaded' : 'none',
      profile: configManager?.getCurrentProfile() || 'none'
    });

    // Save current CLI options to config if requested
    if (cliOptions['save-config'] && configManager) {
      const configUpdates: any = {
        defaults: {
          model: selectedModel,
          maxResults,
          concurrency,
          timeout,
          batchSize,
          outputFormat: outputFormat as 'json' | 'jsonl',
          stream: mergedOptions.stream,
          useSearchApi: useSearchAPI,
        }
      };

      const saveResult = await configManager.updateConfig(configUpdates);
      if (saveResult.success) {
        console.log('✓ Current options saved to configuration');
      } else {
        console.error(`Warning: Failed to save configuration: ${saveResult.error}`);
      }
    }

    // Determine execution mode
    let queries: string[] = [];

    if (mergedOptions.query) {
      queries = [mergedOptions.query];
    } else if (commandLineQueries.length > 0) {
      queries = commandLineQueries;
    } else if (mergedOptions.stdin) {
      // Read from stdin
      const readLineInterface = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      for await (const line of readLineInterface) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.query) queries.push(parsed.query);
            if (parsed.queries && Array.isArray(parsed.queries)) {
              queries.push(...parsed.queries);
            }
          } catch {
            // Treat as plain query
            queries.push(trimmed);
          }
        }
      }
    } else if (mergedOptions.input) {
      // Read from file
      const fileContent = await Bun.file(mergedOptions.input).text();
      const parsed = JSON.parse(fileContent);

      if (parsed.queries && Array.isArray(parsed.queries)) {
        queries = parsed.queries;
      } else if (parsed.requests && Array.isArray(parsed.requests)) {
        queries = parsed.requests.map((req: any) => req.args?.query).filter(Boolean);
      } else if (parsed.query) {
        queries = [parsed.query];
      }
    }

    if (queries.length === 0) {
      throw new Error('No queries provided. Use --help for usage information.');
    }

    // Validate streaming mode compatibility
    if (mergedOptions.stream) {
      // Streaming is not compatible with certain options
      if (queries.length > 1) {
        throw new Error('Streaming mode is only supported for single queries. Remove --stream for multi-query searches.');
      }

      if (mergedOptions.export) {
        throw new Error('Streaming mode is not compatible with export functionality. Remove --stream or --export.');
      }

      if (outputFormat === 'jsonl') {
        console.error('⚠️ Warning: Streaming with JSONL output format may produce mixed output. Consider using default JSON format.');
      }
    }

    logEvent('info', 'queries_loaded', {
      source: mergedOptions.stdin ? 'stdin' : mergedOptions.input || 'cli',
      queryCount: queries.length
    });

    // Collect all file paths
    const filePaths: string[] = [];
    if (mergedOptions.file) filePaths.push(mergedOptions.file);
    if (mergedOptions.image) filePaths.push(mergedOptions.image);
    if (mergedOptions.attach) filePaths.push(...mergedOptions.attach);
    if (mergedOptions['attach-image']) filePaths.push(...mergedOptions['attach-image']);

    // Determine execution mode and routing
    const hasAttachments = filePaths.length > 0;
    const isAdvancedModel = selectedModel && ['sonar-reasoning', 'sonar-deep-research'].includes(selectedModel);
    const needsAdvancedRouting = hasAttachments || isAdvancedModel;

    logEvent('info', 'execution_mode_selected', {
      mode: needsAdvancedRouting ? 'advanced' : 'search-api',
      hasAttachments,
      isAdvancedModel,
      attachmentCount: filePaths.length,
      model: selectedModel
    });

    let results: any;

    if (queries.length === 1) {
      // Single query execution
      const query = queries[0];

      // Handle streaming mode
      if (mergedOptions.stream) {
        results = await executeStreamingSearch(query, {
          model: selectedModel,
          filePaths: hasAttachments ? filePaths : undefined,
        }, abortSignal);
      } else if (isAdvancedModel) {
        // Use advanced model routing
        results = await executeAdvancedModel(query, {
          model: selectedModel!,
          filePaths: hasAttachments ? filePaths : undefined,
          webhook: mergedOptions.webhook,
          async: mergedOptions.async,
        });
      } else if (hasAttachments) {
        // Use chat with attachments
        results = await executeChatWithAttachments(query, filePaths, {
          model: selectedModel,
        });
      } else {
        // Use standard search
        results = await executeFastSearch(query, {
          maxResults,
          model: selectedModel,
        });
      }

      // Build output based on execution type
      const output: any = {
        version: '1.0.0',
        ok: results.success,
        query,
        executionTime: results.executionTime,
        mode: mergedOptions.stream ? 'streaming' : (isAdvancedModel ? 'advanced-model' : (hasAttachments ? 'chat-attachments' : 'search-api')),
      };

      // Handle streaming-specific output
      if (mergedOptions.stream) {
        if (results.tokenCount !== undefined) {
          output.tokenCount = results.tokenCount;
          output.tokensPerSecond = results.tokenCount / (results.executionTime / 1000);
        }
      } else if (isAdvancedModel) {
        if (results.isAsync) {
          output.requestId = results.requestId;
          output.status = results.status;
          output.isAsync = true;
        } else {
          output.content = results.content;
          output.citations = results.citations;
          output.images = results.images;
        }
      } else if (hasAttachments) {
        output.content = results.content;
        output.citations = results.citations;
        output.images = results.images;
      } else {
        output.results = results.results || [];
      }

      if (results.error) {
        output.error = results.error;
      }

      // Prepare metadata for export and history
      const metadata = {
        executionTime: results.executionTime || 0,
        model: selectedModel,
        maxResults,
        success: results.success,
        mode: output.mode,
      };

      // Handle export if requested
      let exportPath: string | undefined;
      if (mergedOptions.export) {
        try {
          exportPath = await exportResults(output, queries, mergedOptions.export, metadata);
          const exportStats = await FileUtils.getFileInfo(exportPath);
          const exportMessage = CliFormatter.formatExportStatus(
            exportPath.split('/').pop() || exportPath,
            exportPath.endsWith('.md') ? 'markdown' : exportPath.endsWith('.json') ? 'json' : 'text',
            exportStats.size
          );
          console.error(CliFormatter.supportsColors() ? exportMessage : CliFormatter.formatPlainText(exportMessage));
        } catch (error) {
          const errorMessage = CliFormatter.formatError(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
          console.error(CliFormatter.supportsColors() ? errorMessage : CliFormatter.formatPlainText(errorMessage));
        }
      }

      // Log to history
      await logToHistory(queries, output, metadata, exportPath);

      // For streaming mode, don't output JSON to stdout as content was already streamed
      if (!mergedOptions.stream) {
        if (outputFormat === 'jsonl') {
          console.log(JSON.stringify(output));
        } else {
          console.log(JSON.stringify(output, null, 2));
        }
      }

    } else {
      // Multiple queries
      if (needsAdvancedRouting) {
        // For multiple queries with attachments or advanced models, process sequentially
        const multiResults: any[] = [];
        let totalSuccess = 0;
        let totalFailed = 0;

        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];

          try {
            let result: any;

            if (isAdvancedModel) {
              result = await executeAdvancedModel(query, {
                model: selectedModel!,
                filePaths: hasAttachments ? filePaths : undefined,
                webhook: mergedOptions.webhook,
                async: mergedOptions.async,
              });
            } else if (hasAttachments) {
              result = await executeChatWithAttachments(query, filePaths, {
                model: selectedModel,
              });
            } else {
              result = await executeFastSearch(query, {
                maxResults,
                model: selectedModel,
              });
            }

            const outputResult: any = {
              query,
              ok: result.success,
              executionTime: result.executionTime,
              mode: isAdvancedModel ? 'advanced-model' : (hasAttachments ? 'chat-attachments' : 'search-api'),
            };

            if (isAdvancedModel) {
              if (result.isAsync) {
                outputResult.requestId = result.requestId;
                outputResult.status = result.status;
                outputResult.isAsync = true;
              } else {
                outputResult.content = result.content;
                outputResult.citations = result.citations;
                outputResult.images = result.images;
              }
            } else if (hasAttachments) {
              outputResult.content = result.content;
              outputResult.citations = result.citations;
              outputResult.images = result.images;
            } else {
              outputResult.results = result.results || [];
            }

            if (result.error) {
              outputResult.error = result.error;
              totalFailed++;
            } else {
              totalSuccess++;
            }

            multiResults.push(outputResult);

            logEvent('info', 'progress', { completed: i + 1, total: queries.length });

          } catch (error) {
            multiResults.push({
              query,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
              executionTime: 0,
              mode: 'advanced-model',
            });
            totalFailed++;
          }
        }

        const output = {
          version: '1.0.0',
          ok: totalFailed === 0,
          summary: {
            total: queries.length,
            successful: totalSuccess,
            failed: totalFailed,
            totalDuration: multiResults.reduce((sum, r) => sum + (r.executionTime || 0), 0),
          },
          results: multiResults,
          mode: needsAdvancedRouting ? 'advanced' : 'search-api',
        };

        // Prepare metadata for export and history
        const metadata = {
          executionTime: output.summary.totalDuration,
          model: selectedModel,
          maxResults,
          success: output.ok,
          mode: output.mode,
        };

        // Handle export if requested
        let exportPath: string | undefined;
        if (mergedOptions.export) {
          try {
            exportPath = await exportResults(output, queries, mergedOptions.export, metadata);
            console.error(`📄 Results exported to: ${exportPath}`);
          } catch (error) {
            console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
          }
        }

        // Log to history
        await logToHistory(queries, output, metadata, exportPath);

        if (outputFormat === 'jsonl') {
          for (const result of multiResults) {
            console.log(JSON.stringify(result));
          }
        } else {
          console.log(JSON.stringify(output, null, 2));
        }

        results = { success: totalFailed === 0 };

      } else {
        // Standard batch search for multiple queries without attachments
        results = await executeBatchSearch(queries, {
          maxResults,
          concurrency,
          model: selectedModel,
          onProgress: (completed, total) => {
            logEvent('info', 'progress', { completed, total });
          }
        });

        const output = {
          version: '1.0.0',
          ok: results.success,
          summary: {
            total: queries.length,
            successful: results.success ? queries.length : 0,
            failed: results.success ? 0 : queries.length,
            totalDuration: results.executionTime,
          },
          results: results.results || [],
          mode: 'search-api',
          error: results.error,
        };

        // Prepare metadata for export and history
        const metadata = {
          executionTime: results.executionTime || 0,
          model: selectedModel,
          maxResults,
          success: results.success,
          mode: output.mode,
        };

        // Handle export if requested
        let exportPath: string | undefined;
        if (mergedOptions.export) {
          try {
            exportPath = await exportResults(output, queries, mergedOptions.export, metadata);
            console.error(`📄 Results exported to: ${exportPath}`);
          } catch (error) {
            console.error('❌ Export failed:', error instanceof Error ? error.message : String(error));
          }
        }

        // Log to history
        await logToHistory(queries, output, metadata, exportPath);

        if (outputFormat === 'jsonl') {
          for (const result of output.results || []) {
            console.log(JSON.stringify({
              ...result,
              mode: output.mode,
            }));
          }
        } else {
          console.log(JSON.stringify(output, null, 2));
        }
      }
    }

    const totalDuration = Date.now() - executionStartTime;
    logEvent('info', 'execution_completed', {
      duration: totalDuration,
      success: results.success,
      queryCount: queries.length,
      mode: needsAdvancedRouting ? 'advanced' : 'search-api'
    });

    process.exit(results.success ? 0 : 1);

  } catch (error) {
    const executionDuration = Date.now() - executionStartTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logEvent('error', 'execution_failed', {
      error: errorMessage,
      duration: executionDuration,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Format error with clean CLI output
    const formattedError = CliFormatter.formatError(`Execution failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));

    // Also output structured error for logging with canonical error codes
    let canonicalErrorCode = ErrorCode.UNEXPECTED_ERROR;
    const errorMessageLower = errorMessage.toLowerCase();

    if (errorMessageLower.includes('api key') || errorMessageLower.includes('unauthorized')) {
      canonicalErrorCode = ErrorCode.API_KEY_MISSING;
    } else if (errorMessageLower.includes('rate limit') || errorMessageLower.includes('too many requests')) {
      canonicalErrorCode = ErrorCode.RATE_LIMIT_ERROR;
    } else if (errorMessageLower.includes('timeout') || errorMessageLower.includes('aborted')) {
      canonicalErrorCode = ErrorCode.TIMEOUT_ERROR;
    } else if (errorMessageLower.includes('network') || errorMessageLower.includes('enotfound') || errorMessageLower.includes('connection')) {
      canonicalErrorCode = ErrorCode.NETWORK_ERROR;
    } else if (errorMessageLower.includes('validation') || errorMessageLower.includes('invalid')) {
      canonicalErrorCode = ErrorCode.VALIDATION_ERROR;
    }

    const errorOutput = {
      version: '1.0.0',
      ok: false,
      error: {
        code: canonicalErrorCode,
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      duration: executionDuration,
    };

    console.log(JSON.stringify(errorOutput, null, 2));
    process.exit(1);
  }
}

// These signal handlers are now managed by the signal handling utility
// The initializeSignalHandling() call in main() handles SIGINT/SIGTERM properly

(async () => {
  // Handle special commands first
  if (historyOverride || cliOptions.history) {
    const historyManager = new HistoryManager();
    const limit = args.find(arg => /^\d+$/.test(arg)) ? parseInt(args.find(arg => /^\d+$/.test(arg))!) : undefined;

    if (limit && limit > 0) {
      const entries = await historyManager.getHistory(limit);
      const formattedHistory = CliFormatter.formatHistoryList(entries);
      console.log(CliFormatter.supportsColors() ? formattedHistory : CliFormatter.formatPlainText(formattedHistory));
    } else {
      const entries = await historyManager.getHistory();
      const formattedHistory = CliFormatter.formatHistoryList(entries);
      console.log(CliFormatter.supportsColors() ? formattedHistory : CliFormatter.formatPlainText(formattedHistory));
    }
    process.exit(0);
  }

  if (cliOptions['search-files']) {
    const historyManager = new HistoryManager();
    const queryPattern = args.find(arg => !arg.startsWith('-') && !/^\d+$/.test(arg));
    const limit = args.find(arg => /^\d+$/.test(arg)) ? parseInt(args.find(arg => /^\d+$/.test(arg))!) : undefined;

    const searchFiles = await historyManager.getSearchFiles(queryPattern);
    const formattedFiles = CliFormatter.formatSearchFilesList(limit ? searchFiles.slice(0, limit) : searchFiles);
    console.log(CliFormatter.supportsColors() ? formattedFiles : CliFormatter.formatPlainText(formattedFiles));
    process.exit(0);
  }

  if (cliOptions['auto-update']) {
    const updateLockFile = join(homedir(), '.pplx-zero', '.updating.lock');
    const currentPid = process.pid;

    try {
      // Check if update is already in progress
      try {
        const lockContent = await Bun.file(updateLockFile).text();
        const lockPid = parseInt(lockContent.trim());

        // Check if the process is still running
        try {
          process.kill(lockPid, 0); // Signal 0 just checks if process exists
          // If we reach here, process is still running, exit silently
          process.exit(0);
        } catch {
          // Process is dead, remove stale lock
          await unlink(updateLockFile);
        }
      } catch {
        // Lock file doesn't exist, proceed
      }

      // Create lock file with current PID
      await writeFile(updateLockFile, currentPid.toString());

      const updateStrategy = new PplxUpdateStrategy();

      try {
        // Check for update silently
        const result = await updateStrategy.attemptUpdate();

        if (result.success) {
          // Store original command for perfect relaunch
          const originalCommand = {
            args: process.argv.slice(1),
            cwd: process.cwd(),
            env: { ...process.env }
          };

          // Remove --auto-update from arguments for relaunch
          const relaunchArgs = originalCommand.args.filter(arg => arg !== '--auto-update');

          // Silent relaunch without showing any update messages
          const subprocess = spawn(process.argv[0], relaunchArgs, {
            stdio: 'inherit',
            env: originalCommand.env,
            shell: false,
            cwd: originalCommand.cwd
          });

          subprocess.on('exit', (code) => {
            // Clean up lock file on exit
            unlink(updateLockFile).catch(() => {});
            process.exit(code || 0);
          });

          subprocess.on('error', (error) => {
            // Clean up lock file on error
            unlink(updateLockFile).catch(() => {});
            process.exit(1);
          });

          return; // Don't exit parent process immediately
        } else {
          // Silent failure - just continue with normal execution
          // This handles cases where no update is available
        }
      } catch (error) {
        // Silent failure - continue with normal execution
        // This handles network errors, permission issues, etc.
      } finally {
        // Always clean up lock file
        await unlink(updateLockFile);
      }
    } catch (error) {
      // If lock file creation fails, continue with normal execution
    }

    // Continue to main execution if auto-update fails or no update needed
  }

  if (cliOptions['update-check']) {
    const updateChecker = new UpdateChecker();
    const versionInfo = await updateChecker.getVersionInfo();
    console.log(versionInfo);
    await updateChecker.showUpdateNotification(true);
    process.exit(0);
  }

  if (cliOptions.help) {
    showHelp();
  }

  if (cliOptions.version) {
    const updateChecker = new UpdateChecker();
    const versionInfo = await updateChecker.getVersionInfo();
    console.error(versionInfo);
    process.exit(0);
  }

  await main();
})().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});