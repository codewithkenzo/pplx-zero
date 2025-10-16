/**
 * Streaming output utilities for real-time token display
 * Provides clean, formatted streaming output with proper buffering
 */

import type { AbortSignal } from 'abort-controller';

/**
 * Streaming output configuration
 */
export interface StreamingOutputConfig {
  useColors?: boolean;
  showProgress?: boolean;
  bufferDelay?: number;
  minChunkSize?: number;
  enableTypewriterEffect?: boolean;
  typewriterDelay?: number;
}

/**
 * Default streaming configuration
 */
const DEFAULT_CONFIG: Required<StreamingOutputConfig> = {
  useColors: true,
  showProgress: true,
  bufferDelay: 50,
  minChunkSize: 1,
  enableTypewriterEffect: false,
  typewriterDelay: 10,
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Check if terminal supports colors
 */
function supportsColors(): boolean {
  return (
    process.stdout.isTTY &&
    process.env.NO_COLOR !== '1' &&
    process.env.TERM !== 'dumb'
  );
}

/**
 * Streaming output manager
 */
export class StreamingOutput {
  private config: Required<StreamingOutputConfig>;
  private buffer: string = '';
  private lastFlushTime: number = 0;
  private tokenCount: number = 0;
  private startTime: number = Date.now();
  private isWriting: boolean = false;
  private abortSignal?: AbortSignal;

  constructor(config: StreamingOutputConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.useColors = this.config.useColors && supportsColors();
  }

  /**
   * Set abort signal for cancellation
   */
  setAbortSignal(signal: AbortSignal): void {
    this.abortSignal = signal;
  }

  /**
   * Check if streaming should continue
   */
  private shouldContinue(): boolean {
    return !this.abortSignal?.aborted;
  }

  /**
   * Format text with colors if enabled
   */
  private colorize(text: string, color: keyof typeof COLORS): string {
    if (!this.config.useColors) return text;
    return `${COLORS[color]}${text}${COLORS.reset}`;
  }

  /**
   * Show streaming indicator
   */
  showStreamingIndicator(): void {
    if (!this.shouldContinue()) return;

    const indicator = this.colorize('🔄 Thinking...', 'cyan');
    const timing = this.colorize('Streaming mode enabled', 'dim');
    process.stderr.write(`${indicator} ${timing}\n`);
  }

  /**
   * Show cancellation message
   */
  showCancellationMessage(): void {
    const message = this.colorize('\n✋ Request cancelled by user', 'yellow');
    const stats = this.colorize(`Received ${this.tokenCount} tokens in ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`, 'dim');
    process.stderr.write(`${message} ${stats}\n`);
  }

  /**
   * Show completion message
   */
  showCompletionMessage(): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const message = this.colorize(`\n✅ Stream completed`, 'green');
    const stats = this.colorize(`Received ${this.tokenCount} tokens in ${duration}s`, 'dim');
    process.stderr.write(`${message} ${stats}\n`);
  }

  /**
   * Show error message
   */
  showErrorMessage(error: string): void {
    const message = this.colorize(`\n❌ Streaming error: ${error}`, 'red');
    process.stderr.write(`${message}\n`);
  }

  /**
   * Flush buffer to stdout
   */
  private flushBuffer(): void {
    if (this.buffer.length >= this.config.minChunkSize && !this.isWriting) {
      this.isWriting = true;

      if (this.config.enableTypewriterEffect) {
        this.typewriterWrite(this.buffer);
      } else {
        process.stdout.write(this.buffer);
      }

      this.buffer = '';
      this.lastFlushTime = Date.now();
      this.isWriting = false;
    }
  }

  /**
   * Write text with typewriter effect
   */
  private async typewriterWrite(text: string): Promise<void> {
    for (const char of text) {
      if (!this.shouldContinue()) break;

      process.stdout.write(char);
      await new Promise(resolve => setTimeout(resolve, this.config.typewriterDelay));
    }
  }

  /**
   * Write streaming chunk
   */
  writeChunk(chunk: string): void {
    if (!this.shouldContinue()) return;

    this.tokenCount += chunk.length;
    this.buffer += chunk;

    // Flush based on buffer delay or size
    const now = Date.now();
    if (
      this.buffer.length >= this.config.minChunkSize ||
      (now - this.lastFlushTime) >= this.config.bufferDelay
    ) {
      this.flushBuffer();
    }

    // Show progress indicator periodically
    if (this.config.showProgress && this.tokenCount % 100 === 0) {
      this.showProgressIndicator();
    }
  }

  /**
   * Show progress indicator
   */
  private showProgressIndicator(): void {
    if (!this.shouldContinue() || !this.config.showProgress) return;

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const tokensPerSec = (this.tokenCount / parseFloat(elapsed)).toFixed(0);

    // Clear the current line and show progress
    process.stderr.write(`\r${COLORS.dim}📊 ${this.tokenCount} tokens (${tokensPerSec} tok/s)${COLORS.reset}`);
  }

  /**
   * End streaming and flush remaining buffer
   */
  end(): void {
    if (this.buffer.length > 0) {
      this.flushBuffer();
    }

    if (this.config.showProgress) {
      process.stderr.write('\n');
    }

    if (this.shouldContinue()) {
      this.showCompletionMessage();
    }
  }

  /**
   * Handle streaming error
   */
  error(error: string): void {
    if (this.buffer.length > 0) {
      this.flushBuffer();
    }
    this.showErrorMessage(error);
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    tokenCount: number;
    duration: number;
    tokensPerSecond: number;
  } {
    const duration = (Date.now() - this.startTime) / 1000;
    return {
      tokenCount: this.tokenCount,
      duration,
      tokensPerSecond: duration > 0 ? this.tokenCount / duration : 0,
    };
  }

  /**
   * Reset streaming state
   */
  reset(): void {
    this.buffer = '';
    this.tokenCount = 0;
    this.startTime = Date.now();
    this.lastFlushTime = 0;
    this.isWriting = false;
  }
}

/**
 * Create streaming output with configuration
 */
export function createStreamingOutput(config?: StreamingOutputConfig): StreamingOutput {
  return new StreamingOutput(config);
}

/**
 * Process async generator for streaming output
 */
export async function processStreamingOutput(
  stream: AsyncGenerator<string, void, unknown>,
  config?: StreamingOutputConfig,
  abortSignal?: AbortSignal
): Promise<{
  success: boolean;
  tokenCount: number;
  duration: number;
  error?: string;
}> {
  const output = createStreamingOutput(config);

  if (abortSignal) {
    output.setAbortSignal(abortSignal);
  }

  try {
    output.showStreamingIndicator();

    for await (const chunk of stream) {
      if (abortSignal?.aborted) {
        output.showCancellationMessage();
        return {
          success: false,
          tokenCount: output.getStats().tokenCount,
          duration: output.getStats().duration,
          error: 'Request was cancelled',
        };
      }

      output.writeChunk(chunk);
    }

    output.end();
    const stats = output.getStats();

    return {
      success: true,
      tokenCount: stats.tokenCount,
      duration: stats.duration,
    };
  } catch (error) {
    output.error(error instanceof Error ? error.message : String(error));
    const stats = output.getStats();

    return {
      success: false,
      tokenCount: stats.tokenCount,
      duration: stats.duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Buffer and chunk text for optimal streaming display
 */
export function* createTextChunks(
  text: string,
  chunkSize: number = 10
): Generator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
  }
}

/**
 * Create a debounced write function to prevent flickering
 */
export function createDebouncedWriter(
  writeFn: (text: string) => void,
  delay: number = 50
): (text: string) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let buffer: string = '';

  return (text: string) => {
    buffer += text;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      writeFn(buffer);
      buffer = '';
      timeoutId = null;
    }, delay);
  };
}