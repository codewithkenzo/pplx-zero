/**
 * Directory resolution utilities for XDG Base Directory compliance
 * Provides cross-platform support for config, data, and cache directories
 */

import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export interface DirectoryPaths {
  configDir: string;
  dataDir: string;
  cacheDir: string;
  runtimeDir: string;
  logDir: string;
}

/**
 * Get XDG Base Directory paths with platform-specific fallbacks
 */
export function getDirectoryPaths(appName = 'pplx-zero'): DirectoryPaths {
  const home = homedir();
  const isWindows = platform() === 'win32';

  // Config directory
  let configDir: string;
  if (process.env.XDG_CONFIG_HOME) {
    configDir = join(process.env.XDG_CONFIG_HOME, appName);
  } else if (isWindows) {
    configDir = join(home, 'AppData', 'Local', appName);
  } else {
    configDir = join(home, '.config', appName);
  }

  // Data directory
  let dataDir: string;
  if (process.env.XDG_DATA_HOME) {
    dataDir = join(process.env.XDG_DATA_HOME, appName);
  } else if (isWindows) {
    dataDir = join(home, 'AppData', 'Roaming', appName);
  } else {
    dataDir = join(home, '.local', 'share', appName);
  }

  // Cache directory
  let cacheDir: string;
  if (process.env.XDG_CACHE_HOME) {
    cacheDir = join(process.env.XDG_CACHE_HOME, appName);
  } else if (isWindows) {
    cacheDir = join(home, 'AppData', 'Local', appName, 'Cache');
  } else {
    cacheDir = join(home, '.cache', appName);
  }

  // Runtime directory (runtime sockets, etc.)
  let runtimeDir: string;
  if (process.env.XDG_RUNTIME_DIR) {
    runtimeDir = join(process.env.XDG_RUNTIME_DIR, appName);
  } else if (isWindows) {
    runtimeDir = join(home, 'AppData', 'Local', 'Temp', appName);
  } else {
    runtimeDir = join(home, '.pplx-zero', 'tmp');
  }

  // Log directory
  const logDir = join(dataDir, 'logs');

  return {
    configDir,
    dataDir,
    cacheDir,
    runtimeDir,
    logDir,
  };
}

/**
 * Ensure directories exist, creating them if necessary
 */
export function ensureDirectories(paths: Partial<DirectoryPaths> = {}): void {
  const defaultPaths = getDirectoryPaths();
  const pathsToEnsure = { ...defaultPaths, ...paths };

  for (const [name, path] of Object.entries(pathsToEnsure)) {
    if (!existsSync(path)) {
      try {
        mkdirSync(path, { recursive: true });
      } catch (error) {
        throw new Error(`Failed to create ${name} directory at ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

/**
 * Find configuration file in standard locations
 * Search order: project -> user -> global
 */
export function findConfigFile(fileName = 'config.json'): string | null {
  const searchPaths: string[] = [];

  // Project-specific config (current directory and parents)
  let currentDir = process.cwd();
  while (currentDir !== resolve(currentDir, '..')) {
    searchPaths.push(join(currentDir, `.${fileName}`));
    searchPaths.push(join(currentDir, fileName));
    currentDir = resolve(currentDir, '..');
  }

  // User config directory
  const paths = getDirectoryPaths();
  searchPaths.push(join(paths.configDir, fileName));

  // Legacy ~/.pplx-zero/config.json for backward compatibility
  searchPaths.push(join(homedir(), '.pplx-zero', fileName));

  // Return first existing file
  for (const configPath of searchPaths) {
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Get default config file path (user config directory)
 */
export function getDefaultConfigPath(fileName = 'config.json'): string {
  const paths = getDirectoryPaths();
  return join(paths.configDir, fileName);
}

/**
 * Get profiles directory path
 */
export function getProfilesDir(): string {
  const paths = getDirectoryPaths();
  return join(paths.configDir, 'profiles');
}

/**
 * Get migrations directory path
 */
export function getMigrationsDir(): string {
  const paths = getDirectoryPaths();
  return join(paths.configDir, 'migrations');
}

/**
 * Get backup directory path for config migrations
 */
export function getBackupDir(): string {
  const paths = getDirectoryPaths();
  return join(paths.dataDir, 'backups');
}

/**
 * Platform-specific path handling
 */
export function normalizePath(path: string): string {
  const isWindows = platform() === 'win32';
  return isWindows ? path.replace(/\//g, '\\') : path;
}

/**
 * Check if a path is writable
 */
export function isPathWritable(path: string): boolean {
  try {
    // Try to create a test file
    const testFile = join(path, '.write-test');
    mkdirSync(path, { recursive: true });
    require('node:fs').writeFileSync(testFile, 'test');
    require('node:fs').unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get temporary directory for operations
 */
export function getTempDir(): string {
  const paths = getDirectoryPaths();
  return join(paths.cacheDir, 'temp');
}

/**
 * Cleanup old temporary files
 */
export function cleanupTempDir(maxAge = 24 * 60 * 60 * 1000): void {
  const tempDir = getTempDir();
  if (!existsSync(tempDir)) return;

  try {
    const fs = require('node:fs');
    const now = Date.now();
    const files = fs.readdirSync(tempDir);

    for (const file of files) {
      const filePath = join(tempDir, file);
      const stats = fs.statSync(filePath);

      // Remove files older than maxAge
      if (now - stats.mtime.getTime() > maxAge) {
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (error) {
    // Don't let cleanup errors break the application
    console.warn(`Warning: Failed to cleanup temp directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}