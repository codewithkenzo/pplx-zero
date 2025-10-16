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
    const formattedError = CliFormatter.formatError(`Version command failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));

    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}

/**
 * Handle version display only
 */
async function handleVersionDisplay(verbose: boolean): Promise<CommandResult> {
  try {
    const versionInfo = await getVersionInfo();
    const formattedVersion = await formatVersionInfo(verbose);

    console.error(CliFormatter.supportsColors() ? formattedVersion : CliFormatter.formatPlainText(formattedVersion));

    return {
      exitCode: 0,
      output: `${versionInfo.name} v${versionInfo.version}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Fallback to basic version info
    console.error('pplx-zero v1.1.4');

    return {
      exitCode: 0,
      output: 'pplx-zero v1.1.4',
    };
  }
}

/**
 * Handle version display with update check
 */
async function handleVersionWithUpdateCheck(verbose: boolean): Promise<CommandResult> {
  try {
    const updateChecker = new UpdateChecker();

    // Get version info
    const versionInfo = await updateChecker.getVersionInfo();

    // Display version info
    console.error(CliFormatter.supportsColors() ? versionInfo : CliFormatter.formatPlainText(versionInfo));

    // Check for updates
    const notificationResult = await updateChecker.showUpdateNotification(true);

    if (notificationResult?.updateAvailable) {
      const updateMessage = CliFormatter.formatUpdateNotification(
        notificationResult.current,
        notificationResult.latest
      );
      console.log(CliFormatter.supportsColors() ? updateMessage : CliFormatter.formatPlainText(updateMessage));

      return {
        exitCode: 0,
        output: `Update available: ${notificationResult.current} → ${notificationResult.latest}`,
      };
    } else {
      const upToDateMessage = CliFormatter.formatSuccess('You are using the latest version');
      console.log(CliFormatter.supportsColors() ? upToDateMessage : CliFormatter.formatPlainText(upToDateMessage));

      return {
        exitCode: 0,
        output: 'Up to date',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Still show version even if update check fails
    const versionInfo = await formatVersionInfo(verbose);
    console.error(CliFormatter.supportsColors() ? versionInfo : CliFormatter.formatPlainText(versionInfo));

    const warningMessage = CliFormatter.formatWarning(`Update check failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? warningMessage : CliFormatter.formatPlainText(warningMessage));

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