/**
 * Version command handler for PPLX-Zero
 * Handles version display and version-related information
 */

import { UpdateChecker } from '../../update/checker.js';
import { formatVersionInfo, getVersionInfo } from '../../utils/version.js';
import { CliFormatter } from '../../cli/formatter.js';
import type {
  VersionCommandOptions,
  CommandResult,
  ExitCode
} from '../types.js';

/**
 * Handle version command
 */
export async function handleVersionCommand(options: {
  verbose: boolean;
  checkForUpdates: boolean;
}): Promise<CommandResult> {
  try {
    if (options.checkForUpdates) {
      return await handleVersionWithUpdateCheck(options.verbose);
    } else {
      return await handleVersionDisplay(options.verbose);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Show fallback version even on error
    const fallbackVersion = 'pplx-zero v1.1.8';
    console.log(fallbackVersion);

    // Only show error if not a simple version lookup issue
    if (!errorMessage.includes('ENOENT') && !errorMessage.includes('package.json')) {
      const formattedError = CliFormatter.formatError(`Warning: ${errorMessage}`);
      console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));
    }

    return {
      exitCode: 0,
      output: fallbackVersion,
    };
  }
}

/**
 * Handle version display only
 */
async function handleVersionDisplay(verbose: boolean): Promise<CommandResult> {
  const versionInfo = await getVersionInfo();
  const formattedVersion = await formatVersionInfo(verbose);

  // Use console.log for version output (not console.error)
  const output = CliFormatter.supportsColors() ? formattedVersion : CliFormatter.formatPlainText(formattedVersion);
  console.log(output);

  return {
    exitCode: 0,
    output: `${versionInfo.name} v${versionInfo.version}`,
  };
}

/**
 * Handle version display with update check
 */
async function handleVersionWithUpdateCheck(verbose: boolean): Promise<CommandResult> {
  const updateChecker = new UpdateChecker();

  // Get version info
  const versionInfo = await updateChecker.getVersionInfo();
  const cleanVersionInfo = CliFormatter.supportsColors() ? versionInfo : CliFormatter.formatPlainText(versionInfo);

  // Display version info
  console.log(cleanVersionInfo);

  try {
    // Check for updates
    const updateCheckResult = await updateChecker.checkForUpdates(true);

    if (updateCheckResult.updateAvailable && updateCheckResult.latest !== 'unknown') {
      const updateMessage = CliFormatter.formatUpdateNotification(
        updateCheckResult.current,
        updateCheckResult.latest
      );
      const cleanUpdateMessage = CliFormatter.supportsColors() ? updateMessage : CliFormatter.formatPlainText(updateMessage);
      console.log(cleanUpdateMessage);

      return {
        exitCode: 0,
        output: `Update available: ${updateCheckResult.current} → ${updateCheckResult.latest}`,
      };
    } else {
      const upToDateMessage = CliFormatter.formatSuccess('You are using the latest version');
      const cleanUpToDateMessage = CliFormatter.supportsColors() ? upToDateMessage : CliFormatter.formatPlainText(upToDateMessage);
      console.log(cleanUpToDateMessage);

      return {
        exitCode: 0,
        output: 'Up to date',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const warningMessage = CliFormatter.formatWarning(`Update check failed: ${errorMessage}`);
    const cleanWarning = CliFormatter.supportsColors() ? warningMessage : CliFormatter.formatPlainText(warningMessage);
    console.error(cleanWarning);

    return {
      exitCode: 0,
      output: 'Version displayed, update check failed',
    };
  }
}

/**
 * Validate version command options
 */
export function validateVersionOptions(options: VersionCommandOptions): {
  valid: boolean;
  error?: string;
} {
  // Version command options are always valid
  return { valid: true };
}