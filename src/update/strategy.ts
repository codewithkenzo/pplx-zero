import type { UpdateStrategy, InstallationMethodData, UpdateResult, PackageManager } from './types.js';
import { AutoUpdateInstaller } from './installer.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Update strategy system for PPLX-Zero
 * Prioritizes different installation methods based on reliability and user preferences
 */
export class PplxUpdateStrategy implements UpdateStrategy {
  private readonly installer: AutoUpdateInstaller;
  private readonly configPath: string;

  constructor() {
    this.installer = new AutoUpdateInstaller();
    this.configPath = join(homedir(), '.pplx-zero', 'update-strategy.json');
  }

  /**
   * Get prioritized list of installation methods
   */
  async prioritizeMethods(): Promise<InstallationMethodData[]> {
    const availableMethods: InstallationMethodData[] = [];

    // 1. Check for package manager installations (most common and reliable)
    const managers = await this.installer.detectAvailableManagers();
    if (managers.includes('bun')) {
      availableMethods.push({ method: 'package', manager: 'bun', path: await this.getExecutablePath() });
    }
    if (managers.includes('npm')) {
      availableMethods.push({ method: 'package', manager: 'npm', path: await this.getExecutablePath() });
    }
    if (managers.includes('yarn')) {
      availableMethods.push({ method: 'package', manager: 'yarn', path: await this.getExecutablePath() });
    }
    if (managers.includes('pnpm')) {
      availableMethods.push({ method: 'package', manager: 'pnpm', path: await this.getExecutablePath() });
    }

    // 2. Check for system package managers
    const systemManagers = await this.checkSystemManagers();
    availableMethods.push(...systemManagers);

    // 3. Check for NVM installations
    const nvmMethod = await this.checkNVMInstallation();
    if (nvmMethod) {
      availableMethods.push(nvmMethod);
    }

    // 4. Binary installation as fallback
    availableMethods.push({ method: 'binary', path: await this.getExecutablePath() });

    // 5. GitHub releases as last resort
    availableMethods.push({ method: 'github', path: null });

    return availableMethods;
  }

  /**
   * Select the best installation method from available options
   */
  async selectBestMethod(availableMethods: InstallationMethodData[]): Promise<InstallationMethodData | null> {
    if (availableMethods.length === 0) {
      return null;
    }

    // Load user preferences
    const preferences = await this.loadPreferences();

    // Apply user preference if available and valid
    if (preferences.preferredManager) {
      const preferredMethod = availableMethods.find(method =>
        method.method === 'package' && method.manager === preferences.preferredManager
      );
      if (preferredMethod) {
        return preferredMethod;
      }
    }

    // Select based on priority order
    const priorityOrder: InstallationMethodData['method'][] = [
      'package',    // Most reliable and common
      'homebrew',   // System package manager
      'nvm',        // Node version manager
      'binary',     // Direct binary installation
      'github',     // GitHub releases
    ];

    for (const priority of priorityOrder) {
      const method = availableMethods.find(m => m.method === priority);
      if (method) {
        return method;
      }
    }

    // Return first available method as fallback
    return availableMethods[0];
  }

  /**
   * Attempt update using best available method
   */
  async attemptUpdate(targetVersion?: string): Promise<UpdateResult> {
    try {
      // Check if user has update permissions
      const canUpdate = await this.installer.canUpdate();
      if (!canUpdate) {
        return {
          success: false,
          error: 'Insufficient permissions to update. Try running with sudo or check installation directory permissions.',
          method: 'unknown',
        };
      }

      const availableMethods = await this.prioritizeMethods();
      const bestMethod = await this.selectBestMethod(availableMethods);

      if (!bestMethod) {
        return {
          success: false,
          error: 'No supported installation method found',
          method: 'unknown',
        };
      }

      // Attempt update with selected method
      const result = await this.installer.installUpdate(bestMethod, targetVersion);

      if (result.success) {
        // Save successful method for future reference
        await this.savePreferredMethod(bestMethod);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'unknown',
      };
    }
  }

  /**
   * Check system package managers
   */
  private async checkSystemManagers(): Promise<InstallationMethodData[]> {
    const methods: InstallationMethodData[] = [];

    // Check Homebrew
    try {
      await this.executeCommand('brew --version');
      const brewPath = await this.executeCommand('which pplx');
      if (brewPath.stdout.includes('brew')) {
        methods.push({ method: 'homebrew', path: brewPath.stdout.trim() });
      }
    } catch {
      // Homebrew not available or pplx not installed via brew
    }

    // Check Cargo
    try {
      await this.executeCommand('cargo --version');
      await this.executeCommand('cargo install --list | grep -q pplx-zero');
      const cargoPath = await this.executeCommand('which pplx');
      methods.push({ method: 'cargo', path: cargoPath.stdout.trim() });
    } catch {
      // Cargo not available or pplx not installed via cargo
    }

    // Check Snap
    try {
      await this.executeCommand('snap list | grep -q pplx-zero');
      const snapPath = await this.executeCommand('which pplx');
      methods.push({ method: 'snap', path: snapPath.stdout.trim() });
    } catch {
      // Snap not available or pplx not installed via snap
    }

    return methods;
  }

  /**
   * Check NVM installation
   */
  private async checkNVMInstallation(): Promise<InstallationMethodData | null> {
    try {
      let nvmType: 'nvm' | 'fnm' = 'nvm';

      // Check if fnm is being used
      try {
        await this.executeCommand('fnm --version');
        nvmType = 'fnm';
      } catch {
        // Check if nvm is being used
        await this.executeCommand('nvm --version');
      }

      const nvmPath = await this.executeCommand('which pplx');
      if (nvmPath.stdout.includes('.nvm') || nvmPath.stdout.includes('.fnm')) {
        return {
          method: 'nvm',
          nvmType,
          path: nvmPath.stdout.trim(),
        };
      }
    } catch {
      // NVM not available or pplx not installed via NVM
    }

    return null;
  }

  /**
   * Get executable path
   */
  private async getExecutablePath(): Promise<string | null> {
    try {
      const result = await this.executeCommand('which pplx');
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Execute command
   */
  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');

      const child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Load user preferences
   */
  private async loadPreferences(): Promise<{
    preferredManager?: PackageManager;
    lastSuccessfulMethod?: InstallationMethodData;
  }> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch {
      return {};
    }
  }

  /**
   * Save preferred method for future updates
   */
  private async savePreferredMethod(method: InstallationMethodData): Promise<void> {
    try {
      const config = await this.loadPreferences();
      const updatedConfig = {
        ...config,
        lastSuccessfulMethod: method,
        preferredManager: method.manager,
        updatedAt: new Date().toISOString(),
      };

      const configDir = join(homedir(), '.pplx-zero');
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      console.warn('Failed to save update preferences:', error);
    }
  }

  /**
   * Get update method description for display
   */
  getMethodDescription(method: InstallationMethodData): string {
    switch (method.method) {
      case 'package':
        return `Package Manager (${method.manager})`;
      case 'homebrew':
        return 'Homebrew';
      case 'cargo':
        return 'Cargo (crates.io)';
      case 'snap':
        return 'Snap Store';
      case 'nvm':
        return `Node Version Manager (${method.nvmType})`;
      case 'binary':
        return 'Binary Installation';
      case 'github':
        return 'GitHub Release';
      default:
        return 'Unknown Method';
    }
  }

  /**
   * Get available package managers for user selection
   */
  async getAvailablePackageManagers(): Promise<PackageManager[]> {
    return this.installer.detectAvailableManagers();
  }

  /**
   * Set user preferred package manager
   */
  async setPreferredManager(manager: PackageManager): Promise<void> {
    const config = await this.loadPreferences();
    const updatedConfig = {
      ...config,
      preferredManager: manager,
      updatedAt: new Date().toISOString(),
    };

    const configDir = join(homedir(), '.pplx-zero');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2));
  }
}