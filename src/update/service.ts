/**
 * Simplified Auto-Update Functions for PPLX-Zero
 * Query-time update checking with 24-hour caching
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  lastChecked: Date;
  updateUrl?: string;
  releaseNotes?: string;
}

export interface AutoUpdateConfig {
  enabled: boolean;
  checkInterval: number; // minutes
  autoInstall: boolean;
  quietMode: boolean;
}

const UPDATE_CACHE_FILE = join(homedir(), '.pplx-zero', 'update-cache.json');
const CONFIG_FILE = join(homedir(), '.pplx-zero', 'config.json');
const DEFAULT_CONFIG: AutoUpdateConfig = {
  enabled: true,
  checkInterval: 1440, // 24 hours
  autoInstall: false,
  quietMode: true,
};

/**
 * Load auto-update configuration
 */
export async function loadAutoUpdateConfig(): Promise<AutoUpdateConfig> {
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configContent);
    return { ...DEFAULT_CONFIG, ...config.autoUpdate };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Save auto-update configuration
 */
export async function saveAutoUpdateConfig(config: AutoUpdateConfig): Promise<void> {
  try {
    const configDir = join(homedir(), '.pplx-zero');
    await fs.mkdir(configDir, { recursive: true });

    const existingConfig = await loadAutoUpdateConfig();
    const updatedConfig = { ...existingConfig, ...config };

    await fs.writeFile(CONFIG_FILE, JSON.stringify({ autoUpdate: updatedConfig }, null, 2), 'utf-8');
  } catch (error) {
    // Don't let config errors break the main flow
    if (process.env.PPLX_DEBUG) {
      console.error('Failed to save auto-update config:', error);
    }
  }
}

/**
 * Check for updates with intelligent caching
 */
export async function checkForUpdatesCached(): Promise<UpdateInfo | null> {
  try {
    const config = await loadAutoUpdateConfig();
    if (!config.enabled) {
      return null;
    }

    // Load cached update info
    let updateCache: UpdateInfo | null = null;
    try {
      const cacheData = await fs.readFile(UPDATE_CACHE_FILE, 'utf-8');
      updateCache = JSON.parse(cacheData);
    } catch {
      updateCache = null;
    }

    // Check if we need to check for updates (interval-based)
    const now = new Date();
    const timeSinceLastCheck = updateCache?.lastChecked
      ? now.getTime() - new Date(updateCache.lastChecked).getTime()
      : Infinity;

    const checkIntervalMs = config.checkInterval * 60 * 1000;

    if (updateCache && timeSinceLastCheck < checkIntervalMs) {
      return updateCache;
    }

    // Perform update check
    const updateInfo = await fetchUpdateInfo();

    // Cache the result
    await saveUpdateCache(updateInfo);

    return updateInfo;
  } catch (error) {
    if (process.env.PPLX_DEBUG) {
      console.error('Update check failed:', error);
    }
    return null;
  }
}

/**
 * Force update check regardless of cache
 */
export async function forceUpdateCheck(): Promise<UpdateInfo | null> {
  // Clear cache and check
  try {
    await fs.unlink(UPDATE_CACHE_FILE);
  } catch {
    // Cache file might not exist
  }

  return fetchUpdateInfo();
}

/**
 * Toggle auto-update on/off
 */
export async function toggleAutoUpdate(enabled: boolean, autoInstall: boolean = false): Promise<void> {
  const config = await loadAutoUpdateConfig();
  const updatedConfig = {
    ...config,
    enabled,
    autoInstall,
  };
  await saveAutoUpdateConfig(updatedConfig);
}

/**
 * Get auto-update status
 */
export async function getAutoUpdateStatus(): Promise<{
  enabled: boolean;
  autoInstall: boolean;
  lastChecked?: Date;
  updateAvailable?: boolean;
  currentVersion?: string;
  latestVersion?: string;
}> {
  const config = await loadAutoUpdateConfig();

  // Load cached update info
  let updateCache: UpdateInfo | null = null;
  try {
    const cacheData = await fs.readFile(UPDATE_CACHE_FILE, 'utf-8');
    updateCache = JSON.parse(cacheData);
  } catch {
    updateCache = null;
  }

  return {
    enabled: config.enabled,
    autoInstall: config.autoInstall,
    lastChecked: updateCache?.lastChecked ? new Date(updateCache.lastChecked) : undefined,
    updateAvailable: updateCache?.updateAvailable,
    currentVersion: updateCache?.currentVersion,
    latestVersion: updateCache?.latestVersion,
  };
}

/**
 * Fetch update information from registry
 */
async function fetchUpdateInfo(): Promise<UpdateInfo> {
  const currentVersion = await getCurrentVersion();

  try {
    // Check npm registry for latest version
    const npmResponse = await fetch('https://registry.npmjs.org/pplx-zero');
    const npmData = await npmResponse.json();

    const latestVersion = npmData['dist-tags']?.latest || currentVersion;
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      lastChecked: new Date(),
      updateUrl: npmData.versions?.[latestVersion]?.dist?.tarball,
      releaseNotes: npmData.versions?.[latestVersion]?.description,
    };
  } catch (error) {
    // Fallback to local version if registry check fails
    return {
      currentVersion,
      latestVersion: currentVersion,
      updateAvailable: false,
      lastChecked: new Date(),
    };
  }
}

/**
 * Get current CLI version
 */
async function getCurrentVersion(): Promise<string> {
  try {
    // Try to read version from package.json
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    return packageJson.version || '1.1.7';
  } catch {
    // Fallback version
    return '1.1.7';
  }
}

/**
 * Compare version strings
 */
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }

  return 0;
}

/**
 * Save update cache to disk
 */
async function saveUpdateCache(updateInfo: UpdateInfo): Promise<void> {
  try {
    const configDir = join(homedir(), '.pplx-zero');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(UPDATE_CACHE_FILE, JSON.stringify(updateInfo, null, 2), 'utf-8');
  } catch (error) {
    // Don't let cache errors break the main flow
    if (process.env.PPLX_DEBUG) {
      console.error('Failed to save update cache:', error);
    }
  }
}