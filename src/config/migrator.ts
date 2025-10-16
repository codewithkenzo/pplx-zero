/**
 * Configuration migration system
 * Handles version-to-version configuration migrations with backup support
 */

import { PplxConfig, validateConfig, createDefaultConfig } from './schema.js';
import { getBackupDir, getMigrationsDir, getDirectoryPaths, ensureDirectories } from '../utils/dirs.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface Migration {
  version: string;
  description: string;
  up: (config: any) => Promise<any>;
  down: (config: any) => Promise<any>;
}

export interface MigrationResult {
  success: boolean;
  fromVersion?: string;
  toVersion?: string;
  backupPath?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration migrator
 */
export class ConfigMigrator {
  private migrations: Map<string, Migration> = new Map();

  constructor() {
    this.registerDefaultMigrations();
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  /**
   * Get all registered migrations
   */
  getMigrations(): Migration[] {
    return Array.from(this.migrations.values()).sort((a, b) =>
      this.compareVersions(a.version, b.version)
    );
  }

  /**
   * Migrate configuration to target version
   */
  async migrate(
    config: PplxConfig | any,
    targetVersion: string,
    options: { createBackup?: boolean; backupDir?: string } = {}
  ): Promise<MigrationResult> {
    const { createBackup = true, backupDir } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const fromVersion = this.parseVersion(config.version || '0.0.0');
      const toVersion = this.parseVersion(targetVersion);

      if (this.compareVersions(fromVersion, toVersion) >= 0) {
        errors.push(`Target version ${targetVersion} is not newer than current version ${config.version || 'unknown'}`);
        return { success: false, errors, warnings };
      }

      let currentConfig = config;
      let backupPath: string | undefined;

      // Create backup if requested
      if (createBackup) {
        backupPath = await this.createBackup(currentConfig, backupDir);
      }

      // Apply migrations in order
      const applicableMigrations = this.getMigrations().filter(m => {
        const migrationVersion = this.parseVersion(m.version);
        return this.compareVersions(migrationVersion, fromVersion) > 0 &&
               this.compareVersions(migrationVersion, toVersion) <= 0;
      });

      for (const migration of applicableMigrations) {
        try {
          currentConfig = await migration.up(currentConfig);
          warnings.push(`Applied migration: ${migration.description}`);
        } catch (migrationError) {
          errors.push(`Failed to apply migration ${migration.version}: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`);
          break;
        }
      }

      // Update version
      currentConfig.version = targetVersion;

      // Validate final configuration
      const validation = validateConfig(currentConfig);
      if (!validation.valid) {
        errors.push(`Configuration validation after migration failed: ${validation.errors.join(', ')}`);
      }

      return {
        success: errors.length === 0,
        fromVersion: config.version || '0.0.0',
        toVersion: targetVersion,
        backupPath,
        errors,
        warnings: [...warnings, ...validation.warnings],
      };

    } catch (error) {
      errors.push(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * Check if migration is needed
   */
  needsMigration(config: PplxConfig | any, targetVersion: string): boolean {
    const currentVersion = this.parseVersion(config.version || '0.0.0');
    const target = this.parseVersion(targetVersion);
    return this.compareVersions(currentVersion, target) < 0;
  }

  /**
   * Create backup of configuration
   */
  private async createBackup(config: any, customBackupDir?: string): Promise<string> {
    const backupDir = customBackupDir || getBackupDir();
    ensureDirectories({ [backupDir]: backupDir });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `config-backup-${timestamp}-${randomUUID().slice(0, 8)}.json`;
    const backupPath = join(backupDir, backupFileName);

    const backupContent = {
      version: config.version || '0.0.0',
      timestamp: new Date().toISOString(),
      config,
      migratorVersion: '1.0.0',
    };

    await writeFile(backupPath, JSON.stringify(backupContent, null, 2) + '\n');
    return backupPath;
  }

  /**
   * Parse version string for comparison
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      return { major: 0, minor: 0, patch: 0 };
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }

  /**
   * Compare two version strings
   */
  private compareVersions(v1: { major: number; minor: number; patch: number }, v2: { major: number; minor: number; patch: number }): number {
    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  /**
   * Register default migrations
   */
  private registerDefaultMigrations(): void {
    // Migration from pre-v1.0.0 configurations
    this.registerMigration({
      version: '1.0.0',
      description: 'Initialize v1.0.0 configuration format',
      up: async (config: any) => {
        const defaultConfig = createDefaultConfig();

        // Handle legacy configuration formats
        if (config.model || config.maxResults || config.timeout) {
          // This looks like a pre-v1.0.0 config
          return {
            version: '1.0.0',
            defaults: {
              model: config.model || defaultConfig.defaults?.model,
              maxResults: config.maxResults || defaultConfig.defaults?.maxResults,
              concurrency: config.concurrency || defaultConfig.defaults?.concurrency,
              timeout: config.timeout || defaultConfig.defaults?.timeout,
              batchSize: config.batchSize || defaultConfig.defaults?.batchSize,
              outputFormat: config.outputFormat || defaultConfig.defaults?.outputFormat,
              stream: config.stream || defaultConfig.defaults?.stream,
              useSearchApi: config.useSearchApi !== false,
              temperature: config.temperature || defaultConfig.defaults?.temperature,
              maxTokens: config.maxTokens || defaultConfig.defaults?.maxTokens,
            },
            metadata: {
              created: new Date().toISOString(),
              description: 'Migrated from pre-v1.0.0 configuration',
              source: 'migration',
            },
          };
        }

        // Already v1.0.0 compatible
        return {
          ...defaultConfig,
          ...config,
          version: '1.0.0',
        };
      },
      down: async (config: any) => {
        // Convert v1.0.0 back to legacy format
        const defaults = config.defaults || {};
        return {
          model: defaults.model,
          maxResults: defaults.maxResults,
          concurrency: defaults.concurrency,
          timeout: defaults.timeout,
          batchSize: defaults.batchSize,
          outputFormat: defaults.outputFormat,
          stream: defaults.stream,
          useSearchApi: defaults.useSearchApi,
          temperature: defaults.temperature,
          maxTokens: defaults.maxTokens,
        };
      },
    });

    // Future migrations can be registered here
    // Example:
    // this.registerMigration({
    //   version: '1.1.0',
    //   description: 'Add experimental features support',
    //   up: async (config) => {
    //     return {
    //       ...config,
    //       version: '1.1.0',
    //       experimental: config.experimental || {
    //         features: [],
    //         enableDebug: false,
    //         betaModels: false,
    //         advancedFeatures: false,
    //       },
    //     };
    //   },
    //   down: async (config) => {
    //     const { experimental, ...rest } = config;
    //     { ...rest, version: '1.0.0' };
    //   },
    // });
  }

  /**
   * Get migration path from current to target version
   */
  getMigrationPath(fromVersion: string, toVersion: string): Migration[] {
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);

    return this.getMigrations().filter(m => {
      const migrationVersion = this.parseVersion(m.version);
      return this.compareVersions(migrationVersion, from) > 0 &&
             this.compareVersions(migrationVersion, to) <= 0;
    });
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ path: string; timestamp: Date; version: string; size: number }>> {
    const backupDir = getBackupDir();
    if (!existsSync(backupDir)) {
      return [];
    }

    const backups = [];
    const files = await import('node:fs').then(fs => fs.promises.readdir(backupDir));

    for (const file of files) {
      if (file.startsWith('config-backup-') && file.endsWith('.json')) {
        const filePath = join(backupDir, file);
        const stats = await import('node:fs').then(fs => fs.promises.stat(filePath));

        try {
          const content = JSON.parse(await readFile(filePath, 'utf-8'));
          backups.push({
            path: filePath,
            timestamp: new Date(content.timestamp || stats.mtime),
            version: content.version || 'unknown',
            size: stats.size,
          });
        } catch {
          // Skip invalid backup files
        }
      }
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<{ success: boolean; error?: string; config?: any }> {
    try {
      const content = JSON.parse(await readFile(backupPath, 'utf-8'));

      if (!content.config) {
        return { success: false, error: 'Invalid backup file: no configuration found' };
      }

      return { success: true, config: content.config };
    } catch (error) {
      return { success: false, error: `Failed to restore backup: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups(keepCount = 10): Promise<{ success: boolean; error?: string; cleaned: number }> {
    try {
      const backups = await this.listBackups();

      if (backups.length <= keepCount) {
        return { success: true, cleaned: 0 };
      }

      const toDelete = backups.slice(keepCount);
      let cleaned = 0;

      for (const backup of toDelete) {
        try {
          await import('node:fs').then(fs => fs.promises.unlink(backup.path));
          cleaned++;
        } catch {
          // Skip files that can't be deleted
        }
      }

      return { success: true, cleaned };
    } catch (error) {
      return { success: false, error: `Failed to cleanup backups: ${error instanceof Error ? error.message : String(error)}`, cleaned: 0 };
    }
  }
}

/**
 * Global migrator instance
 */
const globalMigrator = new ConfigMigrator();

export function getConfigMigrator(): ConfigMigrator {
  return globalMigrator;
}

/**
 * Quick migration function
 */
export async function migrateConfig(
  config: PplxConfig | any,
  targetVersion: string = '1.0.0'
): Promise<MigrationResult> {
  const migrator = getConfigMigrator();
  return await migrator.migrate(config, targetVersion);
}