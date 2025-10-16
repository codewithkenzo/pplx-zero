/**
 * Configuration loader with discovery mechanism
 * Handles finding, reading, and parsing configuration files
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { findConfigFile, getDefaultConfigPath, getDirectoryPaths, ensureDirectories } from '../utils/dirs.js';
import { validateConfig, createDefaultConfig, PplxConfig, ConfigValidationResult } from './schema.js';

export interface ConfigLoadOptions {
  configFile?: string;
  createIfMissing?: boolean;
  validateOnly?: boolean;
  allowInvalid?: boolean;
}

export interface ConfigLoadResult {
  success: boolean;
  config?: PplxConfig;
  configPath?: string;
  errors: string[];
  warnings: string[];
  wasCreated?: boolean;
}

/**
 * Load configuration from file with discovery and validation
 */
export async function loadConfig(options: ConfigLoadOptions = {}): Promise<ConfigLoadResult> {
  const {
    configFile: customConfigPath,
    createIfMissing = false,
    validateOnly = false,
    allowInvalid = false,
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  let configPath: string | undefined;
  let wasCreated = false;

  try {
    // Determine which config file to load
    if (customConfigPath) {
      configPath = customConfigPath;
      if (!existsSync(configPath)) {
        errors.push(`Custom config file not found: ${configPath}`);
      }
    } else {
      // Discover config file
      configPath = findConfigFile();

      if (!configPath && createIfMissing) {
        configPath = await createDefaultConfigFile();
        wasCreated = true;
        warnings.push(`Created default config file at: ${configPath}`);
      }
    }

    if (!configPath) {
      errors.push('No configuration file found and createIfMissing is false');
      return {
        success: false,
        errors,
        warnings,
      };
    }

    if (!existsSync(configPath)) {
      errors.push(`Configuration file not found: ${configPath}`);
      return {
        success: false,
        errors,
        warnings,
      };
    }

    if (validateOnly) {
      // Just validate the file without loading
      const validationResult = await validateConfigFile(configPath);
      return {
        success: validationResult.valid,
        config: validationResult.config,
        configPath,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      };
    }

    // Load and parse the configuration
    const loadResult = await parseConfigFile(configPath);

    if (!loadResult.success) {
      return {
        success: false,
        configPath,
        errors: loadResult.errors,
        warnings,
      };
    }

    // Validate the loaded configuration
    const validationResult = validateConfig(loadResult.config);

    if (!validationResult.valid && !allowInvalid) {
      return {
        success: false,
        configPath,
        errors: validationResult.errors,
        warnings: [...warnings, ...validationResult.warnings],
      };
    }

    return {
      success: true,
      config: validationResult.config!,
      configPath,
      errors: [],
      warnings: [...warnings, ...validationResult.warnings],
      wasCreated,
    };

  } catch (error) {
    errors.push(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      configPath,
      errors,
      warnings,
    };
  }
}

/**
 * Parse configuration file from disk
 */
async function parseConfigFile(configPath: string): Promise<{ success: boolean; config?: unknown; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Read file content
    const content = await readFile(configPath, 'utf-8');

    if (!content.trim()) {
      errors.push('Configuration file is empty');
      return { success: false, errors };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      errors.push(`Invalid JSON in configuration file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return { success: false, errors };
    }

    return {
      success: true,
      config: parsed,
      errors: [],
    };

  } catch (error) {
    errors.push(`Failed to read configuration file: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, errors };
  }
}

/**
 * Validate configuration file without fully loading it
 */
async function validateConfigFile(configPath: string): Promise<ConfigValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parseResult = await parseConfigFile(configPath);

    if (!parseResult.success) {
      return {
        valid: false,
        errors: parseResult.errors,
        warnings,
      };
    }

    return validateConfig(parseResult.config);

  } catch (error) {
    errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Create a default configuration file
 */
async function createDefaultConfigFile(): Promise<string> {
  const configPath = getDefaultConfigPath();
  const configDir = dirname(configPath);

  // Ensure config directory exists
  ensureDirectories({ configDir });

  // Create default config
  const defaultConfig = createDefaultConfig();

  // Write to file with pretty formatting
  const content = JSON.stringify(defaultConfig, null, 2) + '\n';

  await writeFile(configPath, content, 'utf-8');

  return configPath;
}

/**
 * Write configuration to file
 */
export async function saveConfig(config: PplxConfig, configPath?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const targetPath = configPath || getDefaultConfigPath();
    const configDir = dirname(targetPath);

    // Ensure directory exists
    ensureDirectories({ configDir });

    // Update metadata
    const configWithMetadata = {
      ...config,
      metadata: {
        ...config.metadata,
        updated: new Date().toISOString(),
      },
    };

    // Validate before saving
    const validation = validateConfig(configWithMetadata);
    if (!validation.valid) {
      return {
        success: false,
        error: `Configuration validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Write to file
    const content = JSON.stringify(configWithMetadata, null, 2) + '\n';
    await writeFile(targetPath, content, 'utf-8');

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Load multiple configuration files and merge them
 * Search order: project -> user -> global (last one wins)
 */
export async function loadConfigHierarchy(): Promise<ConfigLoadResult> {
  const searchPaths = [
    findConfigFile('config.json'),
    findConfigFile('.pplx-zero.json'),
    getDefaultConfigPath(),
  ].filter(Boolean) as string[];

  let finalConfig: PplxConfig | undefined;
  let finalConfigPath: string | undefined;
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const configPath of searchPaths) {
    if (!existsSync(configPath)) continue;

    const result = await loadConfig({ configFile: configPath });

    if (result.success && result.config) {
      if (!finalConfig) {
        finalConfig = result.config;
        finalConfigPath = result.configPath;
      } else {
        // Merge configurations (later ones override earlier ones)
        const { validateConfig, mergeConfigs } = await import('./schema.js');
        const merged = mergeConfigs(finalConfig, result.config);
        const validation = validateConfig(merged);

        if (validation.valid) {
          finalConfig = validation.config;
          finalConfigPath = result.configPath; // Last successful load wins
        } else {
          allErrors.push(...validation.errors);
        }
      }

      allWarnings.push(...result.warnings);
    } else {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
  }

  if (!finalConfig) {
    allErrors.push('No valid configuration file found in hierarchy');
    return {
      success: false,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  return {
    success: true,
    config: finalConfig,
    configPath: finalConfigPath,
    errors: [],
    warnings: allWarnings,
  };
}

/**
 * Get effective configuration by merging with environment variables
 */
export function getEffectiveConfig(config: PplxConfig): PplxConfig {
  const envConfig: Partial<PplxConfig> = {};

  // Override with environment variables if present
  if (process.env.PPLX_MODEL) {
    envConfig.defaults = { ...config.defaults, model: process.env.PPLX_MODEL };
  }

  if (process.env.PPLX_MAX_RESULTS) {
    const maxResults = parseInt(process.env.PPLX_MAX_RESULTS, 10);
    if (!isNaN(maxResults)) {
      envConfig.defaults = { ...envConfig.defaults, ...config.defaults, maxResults };
    }
  }

  if (process.env.PPLX_CONCURRENCY) {
    const concurrency = parseInt(process.env.PPLX_CONCURRENCY, 10);
    if (!isNaN(concurrency)) {
      envConfig.defaults = { ...envConfig.defaults, ...config.defaults, concurrency };
    }
  }

  if (process.env.PPLX_TIMEOUT) {
    const timeout = parseInt(process.env.PPLX_TIMEOUT, 10);
    if (!isNaN(timeout)) {
      envConfig.defaults = { ...envConfig.defaults, ...config.defaults, timeout };
    }
  }

  if (process.env.PPLX_OUTPUT_FORMAT) {
    envConfig.defaults = { ...envConfig.defaults, ...config.defaults, outputFormat: process.env.PPLX_OUTPUT_FORMAT as any };
  }

  // Merge with original config
  const { mergeConfigs } = require('./schema.js');
  return mergeConfigs(config, envConfig);
}

/**
 * Check if configuration file exists and is readable
 */
export function configExists(configPath?: string): boolean {
  const targetPath = configPath || findConfigFile();
  return targetPath ? existsSync(targetPath) : false;
}

/**
 * Get configuration file info
 */
export async function getConfigInfo(configPath?: string): Promise<{
  exists: boolean;
  path?: string;
  size?: number;
  modified?: Date;
  readable?: boolean;
}> {
  const targetPath = configPath || findConfigFile();

  if (!targetPath || !existsSync(targetPath)) {
    return { exists: false };
  }

  try {
    const stats = await import('node:fs').then(fs => fs.promises.stat(targetPath));
    const content = await readFile(targetPath, 'utf-8');

    try {
      JSON.parse(content);
      return {
        exists: true,
        path: targetPath,
        size: stats.size,
        modified: stats.mtime,
        readable: true,
      };
    } catch {
      return {
        exists: true,
        path: targetPath,
        size: stats.size,
        modified: stats.mtime,
        readable: false,
      };
    }
  } catch (error) {
    return { exists: false };
  }
}

// Helper function for file writing
async function writeFile(path: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
  const { writeFile: fsWriteFile } = await import('node:fs/promises');
  await fsWriteFile(path, content, encoding);
}