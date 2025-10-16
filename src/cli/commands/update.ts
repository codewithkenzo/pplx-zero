/**
 * Update command handler for PPLX-Zero
 * Handles update checking and auto-update functionality
 */

import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import AutoUpdateService from '../../update/service.js';
import { CliFormatter } from '../../cli/formatter.js';
import type {
  UpdateCommandOptions,
  CommandResult,
  ExitCode
} from '../types.js';

/**
 * Handle update command
 */
export async function handleUpdateCommand(options: {
  check: boolean;
  auto: boolean;
  silent?: boolean;
}): Promise<CommandResult> {
  try {
    if (options.check) {
      return await handleUpdateCheck(options.silent);
    } else if (options.auto) {
      return await handleAutoUpdate();
    } else {
      // Default to checking for updates
      return await handleUpdateCheck(false);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const formattedError = CliFormatter.formatError(`Update command failed: ${errorMessage}`);
    console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));

    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}

/**
 * Handle update check
 */
async function handleUpdateCheck(silent: boolean = false): Promise<CommandResult> {
  const autoUpdateService = new AutoUpdateService({
    enabled: true,
    checkInterval: 0, // Force check regardless of cache
    autoInstall: false,
    quietMode: silent,
  });

  try {
    const updateInfo = await autoUpdateService.forceUpdateCheck();

    if (!updateInfo) {
      const errorMessage = 'Update check failed';
      if (!silent) {
        const formattedError = CliFormatter.formatError(errorMessage);
        console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));
      }
      return {
        exitCode: 1,
        error: errorMessage,
      };
    }

    if (!silent) {
      console.log(`Current version: ${updateInfo.currentVersion}`);
      console.log(`Latest version: ${updateInfo.latestVersion}`);
    }

    if (updateInfo.updateAvailable && !silent) {
      const updateMessage = CliFormatter.formatUpdateNotification(
        updateInfo.currentVersion,
        updateInfo.latestVersion
      );
      console.log(CliFormatter.supportsColors() ? updateMessage : CliFormatter.formatPlainText(updateMessage));
      console.log('💡 Run "pplx update --auto" to install automatically');
    }

    return {
      exitCode: 0,
      output: updateInfo.updateAvailable ?
        `Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}` :
        'Up to date',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!silent) {
      const formattedError = CliFormatter.formatError(`Update check failed: ${errorMessage}`);
      console.error(CliFormatter.supportsColors() ? formattedError : CliFormatter.formatPlainText(formattedError));
    }

    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}

/**
 * Handle auto-update
 */
async function handleAutoUpdate(): Promise<CommandResult> {
  const updateLockFile = join(homedir(), '.pplx-zero', '.updating.lock');
  const currentPid = process.pid;

  try {
    // Check if update is already in progress
    try {
      const lockContent = await Bun.file(updateLockFile).text();
      const lockPid = parseInt(lockContent.trim());

      // Check if the process is still running
      try {
        process.kill(lockPid, 0); // Signal 0 just checks if process exists
        // If we reach here, process is still running, exit silently
        return {
          exitCode: 0,
          output: 'Update already in progress',
        };
      } catch {
        // Process is dead, remove stale lock
        await unlink(updateLockFile);
      }
    } catch {
      // Lock file doesn't exist, proceed
    }

    // Create lock file with current PID
    await writeFile(updateLockFile, currentPid.toString());

    try {
      // Check for updates using AutoUpdateService
      const autoUpdateService = new AutoUpdateService({
        enabled: true,
        checkInterval: 0, // Force check
        autoInstall: false,
        quietMode: false,
      });

      const updateInfo = await autoUpdateService.forceUpdateCheck();

      if (!updateInfo || !updateInfo.updateAvailable) {
        console.log('ℹ️ No updates available. You are running the latest version.');
        return {
          exitCode: 0,
          output: 'No update available',
        };
      }

      console.log(`🔄 Update available: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`);
      console.log('📦 Starting update process...');

      // Try npm update as the most common method
      const updateMethods = [
        { command: 'npm', args: ['update', '-g', 'pplx-zero'], name: 'npm global' },
        { command: 'bun', args: ['update', '-g', 'pplx-zero'], name: 'bun global' },
        { command: 'yarn', args: ['global', 'upgrade', 'pplx-zero'], name: 'yarn global' },
        { command: 'pnpm', args: ['update', '-g', 'pplx-zero'], name: 'pnpm global' },
      ];

      let updateSuccessful = false;
      let usedMethod = '';

      for (const method of updateMethods) {
        try {
          console.log(`🔧 Trying ${method.name}...`);
          await executeCommand(method.command, method.args);
          console.log(`✅ Update successful using ${method.name}!`);
          updateSuccessful = true;
          usedMethod = method.name;
          break;
        } catch (error) {
          console.log(`❌ ${method.name} failed: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
      }

      if (updateSuccessful) {
        console.log(`🎉 PPLX-Zero has been updated to ${updateInfo.latestVersion}!`);
        console.log('💡 The update will take effect on next run.');

        return {
          exitCode: 0,
          output: `Successfully updated using ${usedMethod}`,
        };
      } else {
        console.log('❌ All update methods failed. Please update manually:');
        console.log(`   npm: npm update -g pplx-zero`);
        console.log(`   bun: bun update -g pplx-zero`);
        console.log(`   yarn: yarn global upgrade pplx-zero`);
        console.log(`   pnpm: pnpm update -g pplx-zero`);

        return {
          exitCode: 1,
          error: 'All automatic update methods failed',
        };
      }
    } catch (error) {
      console.log(`❌ Update failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Always clean up lock file
      await unlink(updateLockFile);
    }
  } catch (error) {
    // If lock file creation fails, continue with normal execution
    return {
      exitCode: 0,
      output: 'Update lock could not be acquired, continuing normal execution',
    };
  }
}

/**
 * Execute command helper
 */
async function executeCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    let stderr = '';

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
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
 * Validate update command options
 */
export function validateUpdateOptions(options: UpdateCommandOptions): {
  valid: boolean;
  error?: string;
} {
  if (!options.check && !options.auto) {
    // At least one option should be specified
    return {
      valid: false,
      error: 'Either --check or --auto must be specified for update command',
    };
  }

  if (options.check && options.auto) {
    // Cannot specify both options
    return {
      valid: false,
      error: 'Cannot specify both --check and --auto options',
    };
  }

  return { valid: true };
}