/**
 * Configuration manager for high-level operations
 * Provides a clean API for configuration management tasks
 */

import { loadConfig, saveConfig, loadConfigHierarchy, getEffectiveConfig, type ConfigLoadResult } from './loader.js';
import { PplxConfig, Defaults, Profile, createDefaultConfig, mergeConfigs, validateConfig } from './schema.js';
import { getDefaultConfigPath, getProfilesDir, getDirectoryPaths, ensureDirectories } from '../utils/dirs.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ConfigManagerOptions {
  configFile?: string;
  autoCreate?: boolean;
  allowInvalid?: boolean;
  environment?: string;
}

export interface ProfileManagerOptions {
  profileName?: string;
  inherit?: string;
}

/**
 * High-level configuration manager
 */
export class ConfigManager {
  private config: PplxConfig | null = null;
  private configPath: string | null = null;
  private options: ConfigManagerOptions;
  private currentProfile: string | null = null;

  constructor(options: ConfigManagerOptions = {}) {
    this.options = {
      autoCreate: true,
      allowInvalid: false,
      environment: process.env.PPLX_ENV || 'default',
      ...options,
    };
  }

  /**
   * Initialize configuration manager
   */
  async initialize(): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load configuration
      const loadResult = await this.loadConfiguration();

      if (!loadResult.success) {
        errors.push(...loadResult.errors);
        return { success: false, errors, warnings };
      }

      this.config = loadResult.config!;
      this.configPath = loadResult.configPath!;

      warnings.push(...loadResult.warnings);

      // Apply environment-specific settings if configured
      if (this.options.environment && this.config.environments?.[this.options.environment]) {
        this.config = this.applyEnvironmentSettings(this.config, this.options.environment);
        warnings.push(`Applied environment settings for: ${this.options.environment}`);
      }

      // Set default profile if specified
      if (this.options.environment && this.config.profiles?.[this.options.environment]) {
        this.currentProfile = this.options.environment;
      }

      return { success: true, errors, warnings };

    } catch (error) {
      errors.push(`Failed to initialize configuration: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PplxConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Get effective configuration (with environment variables applied)
   */
  getEffectiveConfig(): PplxConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return getEffectiveConfig(this.config);
  }

  /**
   * Get current defaults (from profile or global)
   */
  getDefaults(): Defaults {
    const config = this.getEffectiveConfig();

    if (this.currentProfile && config.profiles?.[this.currentProfile]) {
      const profile = config.profiles[this.currentProfile];
      return { ...config.defaults, ...profile.defaults };
    }

    return config.defaults || createDefaultConfig().defaults!;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<PplxConfig>): Promise<{ success: boolean; error?: string }> {
    if (!this.config || !this.configPath) {
      return { success: false, error: 'Configuration not initialized' };
    }

    try {
      // Merge updates with current config
      const updatedConfig = mergeConfigs(this.config, updates);

      // Validate updated config
      const validation = validateConfig(updatedConfig);
      if (!validation.valid) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }

      // Save to file
      const saveResult = await saveConfig(validation.config!, this.configPath);
      if (!saveResult.success) {
        return saveResult;
      }

      // Update internal state
      this.config = validation.config!;

      return { success: true };

    } catch (error) {
      return { success: false, error: `Failed to update configuration: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<{ success: boolean; error?: string }> {
    const defaultConfig = createDefaultConfig();
    return await this.updateConfig(defaultConfig);
  }

  /**
   * Save current configuration
   */
  async saveConfig(): Promise<{ success: boolean; error?: string }> {
    if (!this.config || !this.configPath) {
      return { success: false, error: 'Configuration not initialized' };
    }

    return await saveConfig(this.config, this.configPath);
  }

  /**
   * Switch to a different profile
   */
  async switchProfile(profileName: string): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig();

    if (!config.profiles?.[profileName]) {
      return { success: false, error: `Profile "${profileName}" not found` };
    }

    this.currentProfile = profileName;
    return { success: true };
  }

  /**
   * Get available profiles
   */
  getProfiles(): string[] {
    const config = this.getConfig();
    return Object.keys(config.profiles || {});
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): string | null {
    return this.currentProfile;
  }

  /**
   * Create a new profile
   */
  async createProfile(name: string, profile: Profile): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig();

    // Validate profile
    const profileValidation = await import('./schema.js').then(m => m.validateProfile(profile));
    if (!profileValidation.valid) {
      return { success: false, error: `Profile validation failed: ${profileValidation.errors.join(', ')}` };
    }

    // Add to config
    const updatedProfiles = { ...config.profiles, [name]: profile };
    const updates = { profiles: updatedProfiles };

    return await this.updateConfig(updates);
  }

  /**
   * Delete a profile
   */
  async deleteProfile(name: string): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig();

    if (!config.profiles?.[name]) {
      return { success: false, error: `Profile "${name}" not found` };
    }

    // Remove profile
    const { [name]: deletedProfile, ...remainingProfiles } = config.profiles;
    const updates = { profiles: remainingProfiles };

    // If current profile is being deleted, switch to default
    if (this.currentProfile === name) {
      this.currentProfile = null;
    }

    return await this.updateConfig(updates);
  }

  /**
   * Get configuration status and info
   */
  async getStatus(): Promise<{
    initialized: boolean;
    configPath?: string;
    profileCount: number;
    currentProfile?: string;
    version?: string;
    lastModified?: Date;
  }> {
    if (!this.config || !this.configPath) {
      return {
        initialized: false,
        profileCount: 0,
      };
    }

    const stats = existsSync(this.configPath)
      ? await import('node:fs').then(fs => fs.promises.stat(this.configPath!))
      : undefined;

    return {
      initialized: true,
      configPath: this.configPath,
      profileCount: Object.keys(this.config.profiles || {}).length,
      currentProfile: this.currentProfile || undefined,
      version: this.config.version,
      lastModified: stats?.mtime,
    };
  }

  /**
   * Validate current configuration
   */
  validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    if (!this.config) {
      return { valid: false, errors: ['Configuration not initialized'], warnings: [] };
    }

    const validation = validateConfig(this.config);
    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  /**
   * Export configuration to file
   */
  async exportConfig(exportPath: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config) {
      return { success: false, error: 'Configuration not initialized' };
    }

    try {
      const content = JSON.stringify(this.config, null, 2) + '\n';
      await writeFile(exportPath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to export configuration: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Import configuration from file
   */
  async importConfig(importPath: string): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    try {
      const content = await readFile(importPath, 'utf-8');
      const importedConfig = JSON.parse(content);

      const validation = validateConfig(importedConfig);
      if (!validation.valid) {
        return { success: false, error: `Invalid configuration: ${validation.errors.join(', ')}` };
      }

      const result = await this.updateConfig(validation.config!);
      return { ...result, warnings: validation.warnings };

    } catch (error) {
      return { success: false, error: `Failed to import configuration: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Load configuration
   */
  private async loadConfiguration(): Promise<ConfigLoadResult> {
    if (this.options.configFile) {
      return await loadConfig({
        configFile: this.options.configFile,
        createIfMissing: this.options.autoCreate,
        allowInvalid: this.options.allowInvalid,
      });
    }

    return await loadConfigHierarchy();
  }

  /**
   * Apply environment-specific settings
   */
  private applyEnvironmentSettings(config: PplxConfig, environmentName: string): PplxConfig {
    const environment = config.environments?.[environmentName];
    if (!environment) return config;

    const updates: Partial<PplxConfig> = {};

    // Apply environment variables
    if (environment.variables) {
      Object.assign(process.env, environment.variables);
    }

    // Switch to environment-specific profiles
    if (environment.profiles) {
      // This would need more complex logic for multiple profiles
      // For now, just set the first one as current
      if (environment.profiles.length > 0 && config.profiles?.[environment.profiles[0]]) {
        this.currentProfile = environment.profiles[0];
      }
    }

    return mergeConfigs(config, updates);
  }
}

/**
 * Create a singleton configuration manager instance
 */
let globalConfigManager: ConfigManager | null = null;

export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(options);
  }
  return globalConfigManager;
}

/**
 * Initialize global configuration manager
 */
export async function initializeConfig(options?: ConfigManagerOptions): Promise<ConfigManager> {
  const manager = getConfigManager(options);
  const result = await manager.initialize();

  if (!result.success) {
    throw new Error(`Failed to initialize configuration: ${result.errors.join(', ')}`);
  }

  return manager;
}

/**
 * Quick access to configuration defaults
 */
export function getDefaults(options?: ConfigManagerOptions): Defaults {
  const manager = getConfigManager(options);
  return manager.getDefaults();
}

/**
 * Quick access to effective configuration
 */
export function getEffectiveConfiguration(options?: ConfigManagerOptions): PplxConfig {
  const manager = getConfigManager(options);
  return manager.getEffectiveConfig();
}