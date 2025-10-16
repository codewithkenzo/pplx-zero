/**
 * Signal handling utilities for graceful cancellation
 * Provides AbortController-based cancellation with proper cleanup
 */

/**
 * Signal handler manager for graceful cancellation
 */
export class SignalHandler {
  private abortController: AbortController | null = null;
  private isCleanupComplete = false;
  private cleanupCallbacks: Array<() => Promise<void> | void> = [];

  /**
   * Initialize signal handling with AbortController
   */
  initialize(): AbortSignal {
    // Create new abort controller for this session
    this.abortController = new AbortController();
    this.isCleanupComplete = false;

    // Set up signal handlers
    const handleSignal = async (signal: NodeJS.Signals) => {
      if (this.isCleanupComplete) {
        // If cleanup is already done, exit immediately
        process.exit(128 + (signal === 'SIGINT' ? 2 : 15));
      }

      console.error(`\n🛑 Received ${signal}. Gracefully cancelling request...`);

      // Abort the in-flight request
      if (this.abortController) {
        this.abortController.abort();
      }

      // Run cleanup callbacks
      await this.runCleanup();

      // Mark cleanup as complete
      this.isCleanupComplete = true;

      // Exit with appropriate code
      if (signal === 'SIGINT') {
        process.exit(130);
      } else if (signal === 'SIGTERM') {
        process.exit(143);
      }
    };

    // Register signal handlers
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);

    // Handle unexpected errors during cleanup
    process.once('uncaughtException', async (error) => {
      console.error('\n💥 Uncaught exception during cancellation:');
      console.error(error);
      await this.runCleanup();
      process.exit(1);
    });

    process.once('unhandledRejection', async (reason, promise) => {
      console.error('\n💥 Unhandled rejection during cancellation:');
      console.error('Reason:', reason);
      await this.runCleanup();
      process.exit(1);
    });

    return this.abortController.signal;
  }

  /**
   * Register a cleanup callback to run on cancellation
   */
  addCleanupCallback(callback: () => Promise<void> | void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Run all cleanup callbacks
   */
  private async runCleanup(): Promise<void> {
    const cleanupPromises = this.cleanupCallbacks.map(async (callback) => {
      try {
        await callback();
      } catch (error) {
        console.error('⚠️ Cleanup callback failed:', error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * Check if the operation has been aborted
   */
  isAborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }

  /**
   * Get the abort signal for passing to async operations
   */
  get signal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  /**
   * Manually trigger cancellation (for testing or programmatic cancellation)
   */
  abort(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
  }

  /**
   * Reset the handler (useful for re-initialization in long-running processes)
   */
  reset(): void {
    this.abortController = null;
    this.isCleanupComplete = false;
    this.cleanupCallbacks = [];
  }
}

/**
 * Global signal handler instance
 */
const globalSignalHandler = new SignalHandler();

/**
 * Initialize global signal handling and get abort signal
 */
export function initializeSignalHandling(): AbortSignal {
  return globalSignalHandler.initialize();
}

/**
 * Get the current abort signal
 */
export function getAbortSignal(): AbortSignal | undefined {
  return globalSignalHandler.signal;
}

/**
 * Check if operation has been aborted
 */
export function isAborted(): boolean {
  return globalSignalHandler.isAborted();
}

/**
 * Add cleanup callback for cancellation
 */
export function addCleanupCallback(callback: () => Promise<void> | void): void {
  globalSignalHandler.addCleanupCallback(callback);
}

/**
 * Manually abort current operation
 */
export function abortOperation(): void {
  globalSignalHandler.abort();
}

/**
 * Create a timeout promise that respects abort signal
 */
export function createAbortableTimeout(
  signal: AbortSignal,
  timeoutMs: number
): Promise<never> {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new Error('Operation was cancelled'));
    }, { once: true });
  });
}

/**
 * Wrap a promise to make it abortable
 */
export async function withAbortSignal<T>(
  signal: AbortSignal,
  promise: Promise<T>
): Promise<T> {
  if (signal.aborted) {
    throw new Error('Operation was cancelled before it started');
  }

  // Create a promise that rejects when the signal is aborted
  const abortPromise = new Promise<never>((_, reject) => {
    const handleAbort = () => {
      reject(new Error('Operation was cancelled'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });

  // Race between the original promise and the abort promise
  return Promise.race([promise, abortPromise]);
}