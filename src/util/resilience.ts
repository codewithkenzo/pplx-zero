/**
 * Resilience patterns for production-ready API interactions
 * Includes rate limiting, circuit breaker, and retry mechanisms
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  strategy?: 'sliding' | 'fixed';
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedRecoveryTime?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  retryCondition?: (error: Error) => boolean;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Token bucket implementation for rate limiting
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(
    private maxTokens: number,
    private refillInterval: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = maxTokens / refillInterval;
  }

  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  waitForToken(): Promise<void> {
    return new Promise((resolve) => {
      const checkToken = () => {
        if (this.consume()) {
          resolve();
        } else {
          setTimeout(checkToken, 10);
        }
      };
      checkToken();
    });
  }
}

/**
 * Rate limiter with sliding window support
 */
export class RateLimiter {
  private tokenBucket: TokenBucket;
  private requests: Array<{ timestamp: number; count: number }> = [];

  constructor(private config: RateLimitConfig) {
    this.tokenBucket = new TokenBucket(
      config.maxRequests,
      config.windowMs
    );
  }

  async acquire(tokens: number = 1): Promise<void> {
    if (this.config.strategy === 'sliding') {
      return this.acquireSliding(tokens);
    } else {
      return this.acquireFixed(tokens);
    }
  }

  private async acquireFixed(tokens: number): Promise<void> {
    if (!this.tokenBucket.consume(tokens)) {
      await this.tokenBucket.waitForToken();
    }
  }

  private async acquireSliding(tokens: number): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Clean old requests
    this.requests = this.requests.filter(req => req.timestamp > windowStart);
    
    // Count current requests
    const currentRequests = this.requests.reduce((sum, req) => sum + req.count, 0);
    
    if (currentRequests + tokens > this.config.maxRequests) {
      // Wait until we can make the request
      const oldestRequest = this.requests[0];
      if (oldestRequest) {
        const waitTime = oldestRequest.timestamp + this.config.windowMs - now;
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      return this.acquireSliding(tokens);
    }
    
    this.requests.push({ timestamp: now, count: tokens });
  }

  getStats(): {
    available: number;
    used: number;
    windowUtilization: number;
  } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    const currentRequests = this.requests
      .filter(req => req.timestamp > windowStart)
      .reduce((sum, req) => sum + req.count, 0);
    
    return {
      available: this.tokenBucket.getAvailableTokens(),
      used: currentRequests,
      windowUtilization: (currentRequests / this.config.maxRequests) * 100,
    };
  }
}

/**
 * Circuit breaker for preventing cascade failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.reset();
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Retry mechanism with configurable backoff strategies
 */
export class RetryMechanism {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry this error
        if (this.config.retryCondition && !this.config.retryCondition(lastError)) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === this.config.maxAttempts) {
          throw lastError;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        await this.wait(delay);
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.backoffStrategy) {
      case 'exponential':
        delay = this.config.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = this.config.baseDelay * attempt;
        break;
      case 'fixed':
        delay = this.config.baseDelay;
        break;
      default:
        delay = this.config.baseDelay;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(this.config.maxDelay, delay + jitter);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Combined resilience manager that coordinates all patterns
 */
export class ResilienceManager {
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private retryMechanism: RetryMechanism;

  constructor(config: {
    rateLimit?: RateLimitConfig;
    circuitBreaker?: CircuitBreakerConfig;
    retry?: RetryConfig;
  } = {}) {
    this.rateLimiter = new RateLimiter(config.rateLimit || {
      maxRequests: 10,
      windowMs: 60000, // 10 requests per minute
      strategy: 'sliding',
    });

    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker || {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000,
    });

    this.retryMechanism = new RetryMechanism(config.retry || {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffStrategy: 'exponential',
      retryCondition: (error) => {
        // Retry on network errors and 5xx server errors
        return error.message.includes('network') ||
               error.message.includes('timeout') ||
               error.message.includes('ECONNRESET') ||
               error.message.includes('rate limit');
      },
    });
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Apply rate limiting first
    await this.rateLimiter.acquire();

    // Then apply circuit breaker and retry mechanisms
    return this.circuitBreaker.execute(() =>
      this.retryMechanism.execute(operation)
    );
  }

  getStats(): {
    rateLimiter: ReturnType<RateLimiter['getStats']>;
    circuitBreaker: ReturnType<CircuitBreaker['getStats']>;
  } {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      circuitBreaker: this.circuitBreaker.getStats(),
    };
  }

  // Manual control methods
  resetCircuitBreaker(): void {
    (this.circuitBreaker as any).reset();
  }

  forceOpenCircuitBreaker(): void {
    (this.circuitBreaker as any).state = CircuitState.OPEN;
    (this.circuitBreaker as any).failureCount = (this.circuitBreaker as any).config.failureThreshold;
  }
}

// Default configurations for different use cases
export const DEFAULT_CONFIGS = {
  conservative: {
    rateLimit: {
      maxRequests: 5,
      windowMs: 60000,
      strategy: 'sliding' as const,
    },
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      monitoringPeriod: 120000,
    },
    retry: {
      maxAttempts: 2,
      baseDelay: 2000,
      maxDelay: 8000,
      backoffStrategy: 'exponential' as const,
    },
  },
  balanced: {
    rateLimit: {
      maxRequests: 10,
      windowMs: 60000,
      strategy: 'sliding' as const,
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
    },
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffStrategy: 'exponential' as const,
    },
  },
  aggressive: {
    rateLimit: {
      maxRequests: 20,
      windowMs: 60000,
      strategy: 'sliding' as const,
    },
    circuitBreaker: {
      failureThreshold: 8,
      recoveryTimeout: 15000,
      monitoringPeriod: 30000,
    },
    retry: {
      maxAttempts: 4,
      baseDelay: 500,
      maxDelay: 8000,
      backoffStrategy: 'exponential' as const,
    },
  },
} as const;
