import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { UpdateInstaller, PackageManager, InstallationMethod, UpdateResult } from './types.js';

const execAsync = promisify(spawn);

/**
 * Enhanced Auto-Update Installer for PPLX-Zero
 * Supports multiple package managers and installation methods
 */
export class AutoUpdateInstaller implements UpdateInstaller {
  private readonly configDir: string;
  private readonly packageName = 'pplx-zero';

  constructor() {
    this.configDir = join(homedir(), '.pplx-zero');
  }

  /**
   * Detect available package managers
   */
  async detectAvailableManagers(): Promise<PackageManager[]> {
    const managers: PackageManager[] = [];
    const checks = [
      { name: 'npm', global: 'npm list -g --depth=0', check: 'npm list -g --depth=0' },
      { name: 'yarn', global: 'yarn global list', check: 'yarn --version' },
      { name: 'bun', global: 'bun pm ls -g', check: 'bun --version' },
      { name: 'pnpm', global: 'pnpm list -g', check: 'pnpm --version' },
    ];

    for (const manager of checks) {
      try {
        await this.executeCommand(manager.check);

        // Check if package is installed globally
        try {
          await this.executeCommand(`${manager.global} | grep -q "${this.packageName}"`);
          managers.push(manager.name as PackageManager);
        } catch {
          // Package not installed globally with this manager
        }
      } catch {
        // Manager not available
      }
    }

    return managers;
  }

  /**
   * Detect installation method based on current setup
   */
  async detectInstallationMethod(): Promise<InstallationMethod> {
    try {
      // Try to find the executable location
      const whichOutput = await this.executeCommand('which pplx');
      const executablePath = whichOutput.stdout.trim();

      if (!executablePath) {
        return { method: 'unknown', path: null };
      }

      // Analyze installation path
      if (executablePath.includes('node_modules')) {
        const managers = await this.detectAvailableManagers();
        if (managers.length > 0) {
          return { method: 'package', manager: managers[0], path: executablePath };
        }
      }

      if (executablePath.includes('.nvm') || executablePath.includes('fnm')) {
        return { method: 'nvm', path: executablePath };
      }

      if (executablePath.includes('homebrew') || executablePath.includes('brew')) {
        return { method: 'homebrew', path: executablePath };
      }

      if (executablePath.includes('snap')) {
        return { method: 'snap', path: executablePath };
      }

      // Check for cargo/crates.io installation
      try {
        await this.executeCommand('cargo install --list | grep -q pplx-zero');
        return { method: 'cargo', path: executablePath };
      } catch {
        // Not cargo installation
      }

      return { method: 'binary', path: executablePath };
    } catch {
      return { method: 'unknown', path: null };
    }
  }

  /**
   * Install update using detected method
   */
  async installUpdate(method: InstallationMethod, targetVersion?: string): Promise<UpdateResult> {
    try {
      switch (method.method) {
        case 'package':
          return await this.updateViaPackageManager(method.manager!, targetVersion);

        case 'homebrew':
          return await this.updateViaHomebrew(targetVersion);

        case 'cargo':
          return await this.updateViaCargo(targetVersion);

        case 'snap':
          return await this.updateViaSnap(targetVersion);

        case 'nvm':
          return await this.updateViaNVM(targetVersion);

        case 'binary':
          return await this.updateViaBinary(targetVersion);

        case 'github':
          return await this.updateViaGitHubRelease(targetVersion);

        default:
          return {
            success: false,
            error: 'Unsupported installation method',
            method: method.method,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: method.method,
      };
    }
  }

  /**
   * Update via package manager
   */
  private async updateViaPackageManager(manager: PackageManager, targetVersion?: string): Promise<UpdateResult> {
    const commands = {
      npm: `npm install -g ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`,
      yarn: `yarn global add ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`,
      bun: `bun install -g ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`,
      pnpm: `pnpm add -g ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`,
    };

    const command = commands[manager];
    const result = await this.executeCommand(command);

    return {
      success: true,
      command,
      output: result.stdout,
      method: 'package',
      manager,
    };
  }

  /**
   * Update via Homebrew
   */
  private async updateViaHomebrew(targetVersion?: string): Promise<UpdateResult> {
    // First update brew
    await this.executeCommand('brew update');

    const command = `brew upgrade ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`;
    const result = await this.executeCommand(command);

    return {
      success: true,
      command,
      output: result.stdout,
      method: 'homebrew',
    };
  }

  /**
   * Update via Cargo
   */
  private async updateViaCargo(targetVersion?: string): Promise<UpdateResult> {
    const command = `cargo install ${targetVersion ? `${this.packageName} --version ${targetVersion}` : this.packageName}`;
    const result = await this.executeCommand(command);

    return {
      success: true,
      command,
      output: result.stdout,
      method: 'cargo',
    };
  }

  /**
   * Update via Snap
   */
  private async updateViaSnap(targetVersion?: string): Promise<UpdateResult> {
    const command = `sudo snap refresh ${targetVersion ? `${this.packageName} --channel=${targetVersion}` : this.packageName}`;
    const result = await this.executeCommand(command);

    return {
      success: true,
      command,
      output: result.stdout,
      method: 'snap',
    };
  }

  /**
   * Update via NVM (Node Version Manager)
   */
  private async updateViaNVM(targetVersion?: string): Promise<UpdateResult> {
    // Detect which node version manager is being used
    let nvmCommand = 'nvm';

    try {
      await this.executeCommand('fnm --version');
      nvmCommand = 'fnm';
    } catch {
      // nvm is being used
    }

    const command = `${nvmCommand} use node && npm install -g ${targetVersion ? `${this.packageName}@${targetVersion}` : this.packageName}`;
    const result = await this.executeCommand(command);

    return {
      success: true,
      command,
      output: result.stdout,
      method: 'nvm',
      nvmType: nvmCommand as 'nvm' | 'fnm',
    };
  }

  /**
   * Update via binary download
   */
  private async updateViaBinary(targetVersion?: string): Promise<UpdateResult> {
    const version = targetVersion || 'latest';

    // Fetch latest release info from GitHub
    const releaseInfo = await this.fetchGitHubReleaseInfo(version);

    if (!releaseInfo) {
      // No update available or failed to fetch - not an error
      return {
        success: false,
        error: 'No update available',
        method: 'binary',
      };
    }

    // Determine platform and architecture
    const platform = this.getPlatform();
    const architecture = this.getArchitecture();

    // Find appropriate binary asset
    const asset = this.findBinaryAsset(releaseInfo.assets, platform, architecture);

    if (!asset) {
      return {
        success: false,
        error: `No binary found for ${platform}-${architecture}`,
        method: 'binary',
      };
    }

    // Download and install binary
    const installPath = await this.downloadAndInstallBinary(asset);

    return {
      success: true,
      command: `Downloaded ${asset.name} to ${installPath}`,
      output: `Binary updated to ${releaseInfo.tag_name}`,
      method: 'binary',
      installedPath: installPath,
    };
  }

  /**
   * Update via GitHub release
   */
  private async updateViaGitHubRelease(targetVersion?: string): Promise<UpdateResult> {
    return this.updateViaBinary(targetVersion);
  }

  /**
   * Fetch GitHub release information
   */
  private async fetchGitHubReleaseInfo(version: string): Promise<any> {
    const apiUrl = version === 'latest'
      ? `https://api.github.com/repos/pplx-zero/pplx-zero/releases/latest`
      : `https://api.github.com/repos/pplx-zero/pplx-zero/releases/tags/${version}`;

    try {
      const response = await fetch(apiUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'pplx-zero-auto-update',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Version not found - not an error, just no update available
          return null;
        }
        throw new Error(`Failed to fetch release info: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // Handle network errors, timeouts, etc.
      return null;
    }
  }

  /**
   * Get platform identifier
   */
  private getPlatform(): string {
    const platform = process.platform;
    switch (platform) {
      case 'darwin': return 'macos';
      case 'linux': return 'linux';
      case 'win32': return 'windows';
      default: return platform;
    }
  }

  /**
   * Get architecture identifier
   */
  private getArchitecture(): string {
    const arch = process.arch;
    switch (arch) {
      case 'x64': return 'x64';
      case 'arm64': return 'arm64';
      case 'arm': return 'arm';
      default: return arch;
    }
  }

  /**
   * Find appropriate binary asset for platform/arch
   */
  private findBinaryAsset(assets: any[], platform: string, arch: string): any {
    const patterns = [
      `${platform}-${arch}`,
      `${arch}-${platform}`,
      platform,
      arch,
    ];

    return assets.find(asset => {
      const name = asset.name.toLowerCase();
      return patterns.some(pattern =>
        name.includes(pattern.toLowerCase()) &&
        (name.endsWith('.tar.gz') || name.endsWith('.zip') || name.endsWith('.bin'))
      );
    });
  }

  /**
   * Download and install binary
   */
  private async downloadAndInstallBinary(asset: any): Promise<string> {
    const tempDir = join(this.configDir, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const fileName = asset.name;
    const filePath = join(tempDir, fileName);

    // Download the asset
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) {
      throw new Error(`Failed to download binary: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Extract if compressed
    if (fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz')) {
      return await this.extractTarGz(filePath);
    } else if (fileName.endsWith('.zip')) {
      return await this.extractZip(filePath);
    }

    // Move binary to appropriate location
    const installPath = this.getBinaryInstallPath();
    await fs.copyFile(filePath, installPath);
    await fs.chmod(installPath, '755');

    return installPath;
  }

  /**
   * Extract tar.gz archive
   */
  private async extractTarGz(filePath: string): Promise<string> {
    const extractDir = join(this.configDir, 'extracted');
    await fs.mkdir(extractDir, { recursive: true });

    await this.executeCommand(`tar -xzf "${filePath}" -C "${extractDir}"`);

    // Find the binary in extracted files
    const files = await fs.readdir(extractDir);
    const binaryFile = files.find(file => file === 'pplx' || file === 'pplx-zero');

    if (!binaryFile) {
      throw new Error('Binary not found in extracted archive');
    }

    const installPath = this.getBinaryInstallPath();
    const sourcePath = join(extractDir, binaryFile);

    await fs.copyFile(sourcePath, installPath);
    await fs.chmod(installPath, '755');

    return installPath;
  }

  /**
   * Extract zip archive
   */
  private async extractZip(filePath: string): Promise<string> {
    const extractDir = join(this.configDir, 'extracted');
    await fs.mkdir(extractDir, { recursive: true });

    await this.executeCommand(`unzip "${filePath}" -d "${extractDir}"`);

    // Find the binary in extracted files
    const files = await fs.readdir(extractDir);
    const binaryFile = files.find(file => file === 'pplx' || file === 'pplx-zero');

    if (!binaryFile) {
      throw new Error('Binary not found in extracted archive');
    }

    const installPath = this.getBinaryInstallPath();
    const sourcePath = join(extractDir, binaryFile);

    await fs.copyFile(sourcePath, installPath);
    await fs.chmod(installPath, '755');

    return installPath;
  }

  /**
   * Get binary installation path
   */
  private getBinaryInstallPath(): string {
    const homeDir = homedir();
    const binDir = join(homeDir, '.local', 'bin');

    // Ensure bin directory exists
    fs.mkdir(binDir, { recursive: true }).catch(() => {});

    return join(binDir, 'pplx');
  }

  /**
   * Execute command and return result
   */
  private async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Handle complex commands that need shell
      const needsShell = command.includes('|') || command.includes('&&') || command.includes('||') || command.includes('>');

      let child;

      if (needsShell) {
        // Use shell for complex commands
        child = spawn(command, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });
      } else {
        // Parse command for direct execution
        const [cmd, ...args] = command.split(' ');
        child = spawn(cmd, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
        });
      }

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
   * Check if current user has permission to update
   */
  async canUpdate(): Promise<boolean> {
    try {
      // Test write permissions in common installation directories
      const testPaths = [
        join(homedir(), '.local', 'bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
      ];

      for (const path of testPaths) {
        try {
          await fs.access(path, fs.constants.W_OK);
          return true;
        } catch {
          continue;
        }
      }

      // If no write access to system directories, check if sudo is available
      await this.executeCommand('echo "sudo test" | sudo -S true');
      return true;
    } catch {
      return false;
    }
  }
}