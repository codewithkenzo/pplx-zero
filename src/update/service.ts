/**
 * Auto-Update Service for PPLX-Zero
 * Provides background update checking with intelligent caching
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

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

export class AutoUpdateService {
  private static readonly UPDATE_CACHE_FILE = join(homedir(), '.pplx-zero', 'update-cache.json');
  private static readonly DEFAULT_CONFIG: AutoUpdateConfig = {
    enabled: true,
    checkInterval: 1440, // 24 hours
    autoInstall: false,
    quietMode: true,
  };

  private readonly config: AutoUpdateConfig;
  private updateCache: UpdateInfo | null = null;

  constructor(config: Partial<AutoUpdateConfig> = {}) {
    this.config = { ...AutoUpdateService.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check for updates with intelligent caching
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      // Load cached update info
      await this.loadUpdateCache();

      // Check if we need to check for updates (interval-based)
      const now = new Date();
      const timeSinceLastCheck = this.updateCache?.lastChecked
        ? now.getTime() - this.updateCache.lastChecked.getTime()
        : Infinity;

      const checkIntervalMs = this.config.checkInterval * 60 * 1000;

      if (this.updateCache && timeSinceLastCheck < checkIntervalMs) {
        return this.updateCache;
      }

      // Perform update check
      const updateInfo = await this.fetchUpdateInfo();

      // Cache the result
      await this.saveUpdateCache(updateInfo);

      // Auto-install if enabled and update is available
      if (this.config.autoInstall && updateInfo.updateAvailable) {
        this.performAutoUpdate(updateInfo).catch(error => {
          if (!this.config.quietMode) {
            console.error('Auto-update failed:', error);
          }
        });
      }

      return updateInfo;
    } catch (error) {
      if (!this.config.quietMode) {
        console.error('Update check failed:', error);
      }
      return null;
    }
  }

  /**
   * Fetch update information from registry
   */
  private async fetchUpdateInfo(): Promise<UpdateInfo> {
    const currentVersion = await this.getCurrentVersion();

    try {
      // Check npm registry for latest version
      const npmResponse = await fetch('https://registry.npmjs.org/pplx-zero');
      const npmData = await npmResponse.json();

      const latestVersion = npmData['dist-tags']?.latest || currentVersion;
      const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;

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
  private async getCurrentVersion(): Promise<string> {
    try {
      // Try to read version from package.json
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.version || '1.1.4';
    } catch {
      // Fallback version
      return '1.1.4';
    }
  }

  /**
   * Compare version strings
   */
  private compareVersions(version1: string, version2: string): number {
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
   * Load update cache from disk
   */
  private async loadUpdateCache(): Promise<void> {
    try {
      const cacheData = await fs.readFile(AutoUpdateService.UPDATE_CACHE_FILE, 'utf-8');
      this.updateCache = JSON.parse(cacheData);
    } catch {
      this.updateCache = null;
    }
  }

  /**
   * Save update cache to disk
   */
  private async saveUpdateCache(updateInfo: UpdateInfo): Promise<void> {
    try {
      await fs.mkdir(join(homedir(), '.pplx-zero'), { recursive: true });
      await fs.writeFile(
        AutoUpdateService.UPDATE_CACHE_FILE,
        JSON.stringify(updateInfo, null, 2),
        'utf-8'
      );
      this.updateCache = updateInfo;
    } catch (error) {
      // Don't let cache errors break the main flow
      if (!this.config.quietMode) {
        console.error('Failed to save update cache:', error);
      }
    }
  }

  /**
   * Perform automatic update in background
   */
  private async performAutoUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (!updateInfo.updateAvailable || !updateInfo.updateUrl) {
      return;
    }

    try {
      // This would integrate with the existing update infrastructure
      // For now, just notify about available update
      if (!this.config.quietMode) {
        console.log(`🔄 Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
        console.log(`💡 Run 'pplx update --auto' to install`);
      }
    } catch (error) {
      if (!this.config.quietMode) {
        console.error('Auto-update failed:', error);
      }
    }
  }

  /**
   * Get update status for logging
   */
  async getUpdateStatus(): Promise<{
    enabled: boolean;
    lastChecked?: Date;
    updateAvailable?: boolean;
    currentVersion?: string;
    latestVersion?: string;
  }> {
    await this.loadUpdateCache();

    return {
      enabled: this.config.enabled,
      lastChecked: this.updateCache?.lastChecked,
      updateAvailable: this.updateCache?.updateAvailable,
      currentVersion: this.updateCache?.currentVersion,
      latestVersion: this.updateCache?.latestVersion,
    };
  }

  /**
   * Force update check regardless of cache
   */
  async forceUpdateCheck(): Promise<UpdateInfo | null> {
    // Clear cache and check
    this.updateCache = null;
    try {
      await fs.unlink(AutoUpdateService.UPDATE_CACHE_FILE);
    } catch {
      // Cache file might not exist
    }

    return this.checkForUpdates();
  }
}

export default AutoUpdateService;