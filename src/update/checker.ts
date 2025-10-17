import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  lastChecked: string;
}

interface PackageInfo {
  version: string;
  name: string;
  repository?: {
    url: string;
  };
}

/**
 * Auto-update checker for PPLX-Zero
 */
export class UpdateChecker {
  private readonly configPath: string;
  private readonly packageName = 'pplx-zero';

  constructor() {
    const configDir = join(homedir(), '.pplx-zero');
    this.configPath = join(configDir, 'config.json');
  }

  /**
   * Get current version from package.json
   */
  private async getCurrentVersion(): Promise<string> {
    // Import the version utility to use its robust path resolution
    const { getVersion } = await import('../utils/version.js');
    try {
      return await getVersion();
    } catch (error) {
      console.error('Failed to read current version:', error);
      return '1.1.8'; // Use known version as fallback
    }
  }

  /**
   * Get latest version from npm registry
   */
  private async getLatestVersion(): Promise<string> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${this.packageName}/latest`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const packageInfo: PackageInfo = await response.json();
      return packageInfo.version;
    } catch (error) {
      console.error('Failed to fetch latest version:', error);
      return 'unknown';
    }
  }

  /**
   * Load update check configuration
   */
  private async loadConfig(): Promise<{ lastChecked: string }> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configContent);
      return {
        lastChecked: config.lastChecked || '1970-01-01T00:00:00.000Z',
      };
    } catch {
      return { lastChecked: '1970-01-01T00:00:00.000Z' };
    }
  }

  /**
   * Save update check configuration
   */
  private async saveConfig(lastChecked: string): Promise<void> {
    try {
      const configDir = dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      let config: any = {};
      try {
        const existingConfig = await fs.readFile(this.configPath, 'utf-8');
        config = JSON.parse(existingConfig);
      } catch {
        // File doesn't exist, start with empty config
      }

      config.lastChecked = lastChecked;
      config.updateLastChecked = new Date().toISOString();

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save update config:', error);
    }
  }

  /**
   * Check if update check is needed (check at most once per day)
   */
  private async shouldCheck(): Promise<boolean> {
    const config = await this.loadConfig();
    const lastChecked = new Date(config.lastChecked);
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;

    return (now.getTime() - lastChecked.getTime()) > dayInMs;
  }

  /**
   * Compare two versions
   */
  private compareVersions(current: string, latest: string): number {
    const cleanCurrent = current.replace(/^v/, '');
    const cleanLatest = latest.replace(/^v/, '');

    const currentParts = cleanCurrent.split('.').map(Number);
    const latestParts = cleanLatest.split('.').map(Number);

    const maxLength = Math.max(currentParts.length, latestParts.length);

    for (let i = 0; i < maxLength; i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (currentPart < latestPart) return -1;
      if (currentPart > latestPart) return 1;
    }

    return 0;
  }

  /**
   * Check for updates
   */
  async checkForUpdates(force: boolean = false): Promise<VersionInfo> {
    const currentVersion = await this.getCurrentVersion();

    // Check if we should update the last checked time
    if (!force && !(await this.shouldCheck())) {
      const config = await this.loadConfig();
      return {
        current: currentVersion,
        latest: 'unknown',
        updateAvailable: false,
        lastChecked: config.lastChecked,
      };
    }

    try {
      const latestVersion = await this.getLatestVersion();
      const updateAvailable = this.compareVersions(currentVersion, latestVersion) < 0;

      // Save the check time
      await this.saveConfig(new Date().toISOString());

      return {
        current: currentVersion,
        latest: latestVersion,
        updateAvailable,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Update check failed:', error);
      return {
        current: currentVersion,
        latest: 'unknown',
        updateAvailable: false,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Display update notification if available
   */
  async showUpdateNotification(force: boolean = false): Promise<void> {
    const versionInfo = await this.checkForUpdates(force);

    if (versionInfo.updateAvailable && versionInfo.latest !== 'unknown') {
      console.error(`\n🔄 Update available: ${versionInfo.current} → ${versionInfo.latest}`);
      console.error('💡 Run the following command to update:');
      console.error('   npm install -g pplx-zero');
      console.error('   or');
      console.error('   yarn global add pplx-zero');
      console.error('   or');
      console.error('   bun install -g pplx-zero');
      console.error('');
    }
  }

  /**
   * Get version information for display
   */
  async getVersionInfo(): Promise<string> {
    const versionInfo = await this.checkForUpdates(true);

    if (versionInfo.latest === 'unknown') {
      return `pplx v${versionInfo.current}`;
    }

    const status = versionInfo.updateAvailable ? ' (update available)' : '';
    return `pplx v${versionInfo.current}${status}`;
  }
}