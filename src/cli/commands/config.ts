/**
 * Configuration management CLI commands
 * Provides comprehensive configuration management functionality
 */

import { ConfigManager, initializeConfig } from '../../config/manager.js';
import { getConfigMigrator } from '../../config/migrator.js';
import { CliFormatter } from '../formatter.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ConfigCommandOptions {
  configFile?: string;
  profile?: string;
  verbose?: boolean;
}

/**
 * Show current effective configuration
 */
export async function showConfig(options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: false,
      allowInvalid: true,
    });

    // Switch profile if specified
    if (options.profile) {
      const result = await configManager.switchProfile(options.profile);
      if (!result.success) {
        console.error(`Error: Failed to switch to profile "${options.profile}": ${result.error}`);
        process.exit(1);
      }
    }

    const config = configManager.getEffectiveConfig();
    const status = await configManager.getStatus();

    // Display configuration information
    console.log(CliFormatter.formatSection('Configuration Status'));
    console.log(`Version: ${config.version}`);
    console.log(`Config File: ${status.configPath || 'None'}`);
    console.log(`Current Profile: ${status.currentProfile || 'Default'}`);
    console.log(`Profile Count: ${status.profileCount}`);
    if (status.lastModified) {
      console.log(`Last Modified: ${status.lastModified.toISOString()}`);
    }

    if (options.verbose) {
      console.log(CliFormatter.formatSection('Full Configuration'));
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(CliFormatter.formatSection('Current Defaults'));
      const defaults = configManager.getDefaults();
      console.log(JSON.stringify(defaults, null, 2));

      if (config.profiles && Object.keys(config.profiles).length > 0) {
        console.log(CliFormatter.formatSection('Available Profiles'));
        Object.keys(config.profiles).forEach(profileName => {
          const profile = config.profiles![profileName];
          console.log(`  ${profileName}: ${profile.description || 'No description'}`);
        });
      }
    }

    // Show warnings if any
    const validation = configManager.validateConfig();
    if (validation.warnings.length > 0) {
      console.log(CliFormatter.formatSection('Warnings'));
      validation.warnings.forEach(warning => {
        console.log(`  ⚠️  ${warning}`);
      });
    }

  } catch (error) {
    console.error(`Error: Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
export async function validateConfig(options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: false,
      allowInvalid: true,
    });

    const validation = configManager.validateConfig();

    if (validation.valid) {
      console.log('✅ Configuration is valid');

      if (validation.warnings.length === 0) {
        console.log('No warnings detected.');
      } else {
        console.log(`\n⚠️  ${validation.warnings.length} warning(s) detected:`);
        validation.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }

      const status = await configManager.getStatus();
      console.log(`\nConfiguration file: ${status.configPath || 'None'}`);
      console.log(`Current profile: ${status.currentProfile || 'Default'}`);

    } else {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => {
        console.error(`  - ${error}`);
      });

      if (validation.warnings.length > 0) {
        console.log(`\n⚠️  ${validation.warnings.length} warning(s) also detected:`);
        validation.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }

      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to validate configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig(options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: true,
      allowInvalid: false,
    });

    const status = await configManager.getStatus();

    if (!status.initialized) {
      console.log('Creating new default configuration...');
    } else {
      console.log(`Resetting configuration at: ${status.configPath}`);
    }

    const result = await configManager.resetConfig();

    if (result.success) {
      console.log('✅ Configuration reset to defaults');

      const newStatus = await configManager.getStatus();
      console.log(`Configuration file: ${newStatus.configPath}`);

    } else {
      console.error(`❌ Failed to reset configuration: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to reset configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Save current CLI options to configuration
 */
export async function saveConfig(options: ConfigCommandOptions = {}, cliOptions: any = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: true,
      allowInvalid: false,
    });

    // Build configuration updates from CLI options
    const updates: any = {
      defaults: {
        model: cliOptions.model,
        maxResults: cliOptions['max-results'] ? parseInt(cliOptions['max-results'], 10) : undefined,
        concurrency: cliOptions.concurrency ? parseInt(cliOptions.concurrency, 10) : undefined,
        timeout: cliOptions.timeout ? parseInt(cliOptions.timeout, 10) : undefined,
        batchSize: cliOptions['batch-size'] ? parseInt(cliOptions['batch-size'], 10) : undefined,
        outputFormat: cliOptions.format,
        stream: cliOptions.stream,
        useSearchApi: cliOptions['use-search-api'],
      }
    };

    // Remove undefined values
    Object.keys(updates.defaults).forEach(key => {
      if (updates.defaults[key] === undefined) {
        delete updates.defaults[key];
      }
    });

    if (Object.keys(updates.defaults).length === 0) {
      console.log('No configuration options to save. Use other CLI flags to set options first.');
      return;
    }

    const result = await configManager.updateConfig(updates);

    if (result.success) {
      console.log('✅ Current options saved to configuration');

      const status = await configManager.getStatus();
      console.log(`Configuration file: ${status.configPath}`);

      if (options.verbose) {
        const savedDefaults = configManager.getDefaults();
        console.log(CliFormatter.formatSection('Saved Defaults'));
        console.log(JSON.stringify(updates.defaults, null, 2));
      }

    } else {
      console.error(`❌ Failed to save configuration: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * List available profiles
 */
export async function listProfiles(options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: false,
      allowInvalid: true,
    });

    const profiles = configManager.getProfiles();
    const currentProfile = configManager.getCurrentProfile();

    if (profiles.length === 0) {
      console.log('No profiles configured.');
      return;
    }

    console.log(CliFormatter.formatSection('Available Profiles'));

    profiles.forEach(profileName => {
      const isCurrent = profileName === currentProfile;
      const prefix = isCurrent ? '👉 ' : '   ';
      console.log(`${prefix}${profileName}`);

      if (options.verbose) {
        const config = configManager.getConfig();
        const profile = config.profiles?.[profileName];
        if (profile) {
          console.log(`     Description: ${profile.description || 'No description'}`);
          if (profile.defaults) {
            console.log(`     Defaults: ${JSON.stringify(profile.defaults, null, 6)}`);
          }
          if (profile.inherit) {
            console.log(`     Inherits from: ${profile.inherit}`);
          }
        }
        console.log('');
      }
    });

    console.log(`\nCurrent profile: ${currentProfile || 'Default'}`);

  } catch (error) {
    console.error(`Error: Failed to list profiles: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Create a new profile
 */
export async function createProfile(name: string, options: ConfigCommandOptions & {
  description?: string;
  inherit?: string;
} = {}): Promise<void> {
  try {
    if (!name || name.trim().length === 0) {
      console.error('Error: Profile name is required');
      process.exit(1);
    }

    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: true,
      allowInvalid: false,
    });

    const profile = {
      name: name.trim(),
      description: options.description,
      inherit: options.inherit,
      defaults: {}, // Can be extended later
    };

    const result = await configManager.createProfile(name.trim(), profile);

    if (result.success) {
      console.log(`✅ Profile "${name}" created successfully`);

      if (options.inherit) {
        console.log(`Inherits from: ${options.inherit}`);
      }

    } else {
      console.error(`❌ Failed to create profile: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to create profile: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Delete a profile
 */
export async function deleteProfile(name: string, options: ConfigCommandOptions = {}): Promise<void> {
  try {
    if (!name || name.trim().length === 0) {
      console.error('Error: Profile name is required');
      process.exit(1);
    }

    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: false,
      allowInvalid: true,
    });

    const result = await configManager.deleteProfile(name.trim());

    if (result.success) {
      console.log(`✅ Profile "${name}" deleted successfully`);
    } else {
      console.error(`❌ Failed to delete profile: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to delete profile: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Export configuration to file
 */
export async function exportConfig(exportPath: string, options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: false,
      allowInvalid: true,
    });

    const result = await configManager.exportConfig(exportPath);

    if (result.success) {
      console.log(`✅ Configuration exported to: ${exportPath}`);
    } else {
      console.error(`❌ Failed to export configuration: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to export configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Import configuration from file
 */
export async function importConfig(importPath: string, options: ConfigCommandOptions = {}): Promise<void> {
  try {
    const configManager = await initializeConfig({
      configFile: options.configFile,
      autoCreate: true,
      allowInvalid: false,
    });

    const result = await configManager.importConfig(importPath);

    if (result.success) {
      console.log(`✅ Configuration imported from: ${importPath}`);

      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n⚠️  ${result.warnings.length} warning(s) during import:`);
        result.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }

    } else {
      console.error(`❌ Failed to import configuration: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}