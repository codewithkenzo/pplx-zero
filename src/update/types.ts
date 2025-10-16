/**
 * Types for auto-update system
 */

export type PackageManager = 'npm' | 'yarn' | 'bun' | 'pnpm';
export type InstallationMethod = 'package' | 'homebrew' | 'cargo' | 'snap' | 'nvm' | 'binary' | 'github' | 'unknown';
export type NVMType = 'nvm' | 'fnm';

export interface UpdateInstaller {
  detectAvailableManagers(): Promise<PackageManager[]>;
  detectInstallationMethod(): Promise<InstallationMethodData>;
  installUpdate(method: InstallationMethodData, targetVersion?: string): Promise<UpdateResult>;
  canUpdate(): Promise<boolean>;
}

export interface InstallationMethodData {
  method: InstallationMethod;
  manager?: PackageManager;
  path?: string | null;
  nvmType?: NVMType;
}

export interface UpdateResult {
  success: boolean;
  command?: string;
  output?: string;
  method: InstallationMethod;
  manager?: PackageManager;
  nvmType?: NVMType;
  installedPath?: string;
  error?: string;
}

export interface UpdateStrategy {
  prioritizeMethods(): Promise<InstallationMethodData[]>;
  selectBestMethod(availableMethods: InstallationMethodData[]): InstallationMethodData | null;
  attemptUpdate(targetVersion?: string): Promise<UpdateResult>;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  name: string;
  content_type: string;
  size: number;
  browser_download_url: string;
}

export interface UpdateConfig {
  autoUpdate: boolean;
  checkInterval: number; // hours
  preferredManager?: PackageManager;
  allowPreRelease: boolean;
  skipBackup: boolean;
}

export interface UpdateNotificationOptions {
  showProgress: boolean;
  autoInstall: boolean;
  requireConfirmation: boolean;
  verbose: boolean;
}