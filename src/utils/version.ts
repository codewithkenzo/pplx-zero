/**
 * Version utility for PPLX-Zero
 * Provides version information from package.json
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Hardcoded version info - used as fallback when package.json is not accessible
 * This ensures the version command always works, especially in global installations
 */
const FALLBACK_VERSION = '1.1.4';
const FALLBACK_PACKAGE_INFO = {
  version: FALLBACK_VERSION,
  name: 'pplx-zero',
  description: 'Fast Perplexity AI search CLI with multimodal support - minimal setup, maximal results',
  author: 'Kenzo',
  repository: {
    url: 'https://github.com/codewithkenzo/pplx-zero'
  },
  engines: {
    bun: '>=1.0.0'
  }
};

/**
 * Cached package.json content
 */
let packageJsonCache: any = null;

/**
 * Get package.json content with caching
 * Tries multiple paths to find package.json in both development and global installations
 */
async function getPackageJson(): Promise<any> {
  if (packageJsonCache !== null) {
    return packageJsonCache;
  }

  // Try multiple possible paths for package.json
  const possiblePaths = [
    // Development path (relative to this file)
    join(__dirname, '..', '..', 'package.json'),
    // Global installation paths
    join(__dirname, '..', 'package.json'),
    join(__dirname, 'package.json'),
    // Alternative global paths
    join(process.cwd(), 'package.json'),
    // Try to find from import.meta.url (works for global npm installations)
    join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
  ];

  for (const packageJsonPath of possiblePaths) {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const parsed = JSON.parse(content);
      // Cache the successfully parsed content
      packageJsonCache = parsed;
      return parsed;
    } catch {
      // Continue to next path
      continue;
    }
  }

  // If all paths fail, use fallback info
  packageJsonCache = FALLBACK_PACKAGE_INFO;
  return FALLBACK_PACKAGE_INFO;
}

/**
 * Get current version from package.json
 */
export async function getVersion(): Promise<string> {
  const packageJson = await getPackageJson();
  return packageJson.version || FALLBACK_VERSION;
}

/**
 * Get package name from package.json
 */
export async function getPackageName(): Promise<string> {
  const packageJson = await getPackageJson();
  return packageJson.name || 'pplx-zero';
}

/**
 * Get package description from package.json
 */
export async function getDescription(): Promise<string> {
  const packageJson = await getPackageJson();
  return packageJson.description || FALLBACK_PACKAGE_INFO.description;
}

/**
 * Get author information from package.json
 */
export async function getAuthor(): Promise<string> {
  const packageJson = await getPackageJson();
  return packageJson.author || FALLBACK_PACKAGE_INFO.author;
}

/**
 * Get repository information from package.json
 */
export async function getRepository(): Promise<string> {
  const packageJson = await getPackageJson();
  if (packageJson.repository?.url) {
    return packageJson.repository.url.replace('git+', '').replace('.git', '');
  }
  return FALLBACK_PACKAGE_INFO.repository.url;
}

/**
 * Get engines information from package.json
 */
export async function getEngines(): Promise<Record<string, string>> {
  const packageJson = await getPackageJson();
  return packageJson.engines || FALLBACK_PACKAGE_INFO.engines;
}

/**
 * Get version information object
 */
export async function getVersionInfo(): Promise<{
  version: string;
  name: string;
  description: string;
  author: string;
  repository: string;
  engines: Record<string, string>;
}> {
  const [version, name, description, author, repository, engines] = await Promise.all([
    getVersion(),
    getPackageName(),
    getDescription(),
    getAuthor(),
    getRepository(),
    getEngines(),
  ]);

  return {
    version,
    name,
    description,
    author,
    repository,
    engines,
  };
}

/**
 * Format version information for display
 */
export async function formatVersionInfo(verbose: boolean = false): Promise<string> {
  const versionInfo = await getVersionInfo();

  if (verbose) {
    return [
      `${versionInfo.name} v${versionInfo.version}`,
      '',
      `Description: ${versionInfo.description}`,
      `Author: ${versionInfo.author}`,
      `Repository: ${versionInfo.repository}`,
      `Engines: ${Object.entries(versionInfo.engines).map(([key, value]) => `${key} ${value}`).join(', ')}`,
    ].join('\n');
  }

  return `${versionInfo.name} v${versionInfo.version}`;
}

/**
 * Compare two version strings
 */
export function compareVersions(version1: string, version2: string): number {
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
 * Check if version is newer than another version
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0;
}

/**
 * Parse version string into semver components
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
} {
  const mainVersion = version.split('-')[0];
  const [majorStr, minorStr, patchStr] = mainVersion.split('.');

  const prereleaseMatch = version.match(/-(.+)/);
  const buildMatch = version.match(/\+(.+)/);

  const prerelease = prereleaseMatch?.[1];
  const build = buildMatch?.[1];

  return {
    major: parseInt(majorStr, 10) || 0,
    minor: parseInt(minorStr, 10) || 0,
    patch: parseInt(patchStr, 10) || 0,
    ...(prerelease && { prerelease }),
    ...(build && { build }),
  };
}

/**
 * Validate version string format
 */
export function isValidVersion(version: string): boolean {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
  return semverRegex.test(version);
}