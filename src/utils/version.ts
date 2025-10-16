/**
 * Version utility for PPLX-Zero
 * Provides version information from package.json
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Cached package.json content
 */
let packageJsonCache: any = null;

/**
 * Get package.json content with caching
 */
async function getPackageJson(): Promise<any> {
  if (packageJsonCache !== null) {
    return packageJsonCache;
  }

  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const content = await readFile(packageJsonPath, 'utf-8');
    packageJsonCache = JSON.parse(content);
    return packageJsonCache;
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get current version from package.json
 */
export async function getVersion(): Promise<string> {
  try {
    const packageJson = await getPackageJson();
    return packageJson.version || '0.0.0';
  } catch (error) {
    return '0.0.0';
  }
}

/**
 * Get package name from package.json
 */
export async function getPackageName(): Promise<string> {
  try {
    const packageJson = await getPackageJson();
    return packageJson.name || 'pplx-zero';
  } catch (error) {
    return 'pplx-zero';
  }
}

/**
 * Get package description from package.json
 */
export async function getDescription(): Promise<string> {
  try {
    const packageJson = await getPackageJson();
    return packageJson.description || 'Fast Perplexity AI search CLI';
  } catch (error) {
    return 'Fast Perplexity AI search CLI';
  }
}

/**
 * Get author information from package.json
 */
export async function getAuthor(): Promise<string> {
  try {
    const packageJson = await getPackageJson();
    return packageJson.author || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Get repository information from package.json
 */
export async function getRepository(): Promise<string> {
  try {
    const packageJson = await getPackageJson();
    if (packageJson.repository?.url) {
      return packageJson.repository.url.replace('git+', '').replace('.git', '');
    }
    return 'https://github.com/codewithkenzo/pplx-zero';
  } catch (error) {
    return 'https://github.com/codewithkenzo/pplx-zero';
  }
}

/**
 * Get engines information from package.json
 */
export async function getEngines(): Promise<Record<string, string>> {
  try {
    const packageJson = await getPackageJson();
    return packageJson.engines || { bun: '>=1.0.0' };
  } catch (error) {
    return { bun: '>=1.0.0' };
  }
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