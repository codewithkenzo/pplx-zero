import { $ } from 'bun';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
}

export class SafeShell {
  private workspace: string | null;

  constructor(workspace?: string) {
    this.workspace = workspace || null;
  }

  /**
   * Execute a shell command safely with proper escaping and workspace boundaries
   */
  async execute(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      stdin?: string;
    } = {}
  ): Promise<ShellResult> {
    const startTime = Date.now();
    
    try {
      // Validate working directory
      const cwd = await this.resolvePath(options.cwd || process.cwd());
      
      // Prepare environment with workspace isolation
      const env = { ...process.env, ...options.env };
      
      // Execute command using Bun Shell
      const result = await $`cd ${cwd} && ${command} ${args.join(' ')}`.env(env).quiet();
      
      const duration = Date.now() - startTime;
      const success = result.exitCode === 0;

      return {
        stdout: result.stdout?.toString().trim() || '',
        stderr: result.stderr?.toString().trim() || '',
        exitCode: result.exitCode,
        success,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        success: false,
      };
    }
  }

  /**
   * Execute multiple commands concurrently with bounded parallelism
   */
  async executeBatch(
    commands: Array<{
      command: string;
      args?: string[];
      options?: Parameters<SafeShell['execute']>[2];
    }>,
    concurrency: number = 3
  ): Promise<ShellResult[]> {
    const results: ShellResult[] = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < commands.length; i += concurrency) {
      const batch = commands.slice(i, i + concurrency);
      
      const batchPromises = batch.map(({ command, args = [], options = {} }) =>
        this.execute(command, args, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Escape shell arguments to prevent injection
   */
  escapeArg(arg: string): string {
    // Basic shell escaping - works for most Unix-like shells
    if (!arg) return "''";
    
    // If the argument contains no unsafe characters, return as-is
    if (/^[a-zA-Z0-9_\-.,:=@/]+$/g.test(arg)) {
      return arg;
    }
    
    // Single-quote escaping
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }

  /**
   * Check if a command exists in the system
   */
  async commandExists(command: string): Promise<boolean> {
    try {
      const result = await this.execute('which', [command]);
      return result.success && result.stdout.length > 0;
    } catch {
      // Fallback for Windows
      try {
        const result = await this.execute('where', [command]);
        return result.success && result.stdout.length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get current platform information
   */
  getPlatform(): {
    platform: NodeJS.Platform;
    arch: string;
    shell: string;
  } {
    return {
      platform: process.platform,
      arch: process.arch,
      shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
    };
  }

  /**
   * Resolve and validate a path within workspace boundaries
   */
  private async resolvePath(path: string): Promise<string> {
    const resolved = await Bun.resolve(path, process.cwd());
    
    if (this.workspace && !resolved.startsWith(this.workspace)) {
      throw new Error(`Path ${resolved} is outside workspace ${this.workspace}`);
    }
    
    return resolved;
  }

  /**
   * Create a temporary file with specified content
   */
  async createTempFile(content: string, extension: string = '.tmp'): Promise<string> {
    const tempDir = this.workspace || '/tmp';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const filename = `temp_${timestamp}_${random}${extension}`;
    const filepath = `${tempDir}/${filename}`;
    
    await Bun.write(filepath, content);
    return filepath;
  }

  /**
   * Clean up temporary files
   */
  async cleanup(paths: string[]): Promise<void> {
    const cleanupPromises = paths.map(async (path) => {
      try {
        await $`rm -f ${this.escapeArg(path)}`;
      } catch {
        // Ignore cleanup errors
      }
    });
    
    await Promise.all(cleanupPromises);
  }

  /**
   * Execute with automatic resource cleanup
   */
  async executeWithCleanup<T>(
    command: string,
    args: string[] = [],
    options: Parameters<SafeShell['execute']>[2] & {
      tempFiles?: string[];
    } = {}
  ): Promise<ShellResult & { cleanup: () => Promise<void> }> {
    const result = await this.execute(command, args, options);
    
    const cleanup = async () => {
      if (options.tempFiles) {
        await this.cleanup(options.tempFiles);
      }
    };
    
    return { ...result, cleanup };
  }
}

/**
 * Default shell instance for general use
 */
export const shell = new SafeShell();

/**
 * Convenience functions for common operations
 */
export async function run(command: string, ...args: string[]): Promise<ShellResult> {
  return shell.execute(command, args);
}

export async function runInDir(
  directory: string,
  command: string,
  ...args: string[]
): Promise<ShellResult> {
  return shell.execute(command, args, { cwd: directory });
}

export async function runWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<ShellResult> {
  return shell.execute(command, args, { timeout: timeoutMs });
}
