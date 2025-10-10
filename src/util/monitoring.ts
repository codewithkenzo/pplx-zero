/**
 * Comprehensive monitoring and logging utilities
 * Provides structured logging, metrics collection, and performance monitoring
 */

import type { EventV1 } from '../schema.js';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  duration?: number;
  traceId?: string;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: number;
}

export interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private level: LogLevel;
  private context: Record<string, unknown>;
  private traceId?: string;

  constructor(
    private minLevel: LogLevel = LogLevel.INFO,
    context: Record<string, unknown> = {}
  ) {
    this.level = minLevel;
    this.context = context;
  }

  withContext(context: Record<string, unknown>): Logger {
    return new Logger(
      this.minLevel,
      { ...this.context, ...context }
    );
  }

  withTraceId(traceId: string): Logger {
    const logger = new Logger(this.minLevel, this.context);
    logger.traceId = traceId;
    return logger;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context: { ...this.context, ...context },
      error,
      traceId: this.traceId,
    };

    this.output(entry);
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.FATAL,
      message,
      context: { ...this.context, ...context },
      error,
      traceId: this.traceId,
    };

    this.output(entry);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      traceId: this.traceId,
    };

    this.output(entry);
  }

  private output(entry: LogEntry): void {
    const output = {
      ...entry,
      level: LogLevel[entry.level].toLowerCase(),
      ...(entry.error && {
        error: {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name,
        },
      }),
    };

    // Output to stderr for structured logging
    console.error(JSON.stringify(output));
  }

  // Create OpenCode-compatible event
  createEvent(level: EventV1['level'], event: string, data?: unknown): EventV1 {
    return {
      time: new Date().toISOString(),
      level,
      event,
      id: this.traceId,
      data,
    };
  }

  // Performance measurement
  measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    return this.measureSync(operation, fn, metadata);
  }

  async measureSync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = Date.now();
    const startHrTime = process.hrtime.bigint();

    try {
      const result = await fn();
      const endTime = Date.now();
      const endHrTime = process.hrtime.bigint();
      const duration = endTime - startTime;
      const precisionDuration = Number(endHrTime - startHrTime) / 1000000; // Convert to ms

      const metrics: PerformanceMetrics = {
        operation,
        startTime,
        endTime,
        duration,
        success: true,
        metadata: {
          ...metadata,
          precisionDuration,
        },
      };

      this.info(`Operation completed: ${operation}`, {
        duration,
        operation,
        ...metadata,
      });

      return { result, metrics };
    } catch (error) {
      const endTime = Date.now();
      const endHrTime = process.hrtime.bigint();
      const duration = endTime - startTime;
      const precisionDuration = Number(endHrTime - startHrTime) / 1000000;

      const metrics: PerformanceMetrics = {
        operation,
        startTime,
        endTime,
        duration,
        success: false,
        metadata: {
          ...metadata,
          precisionDuration,
          error: error instanceof Error ? error.message : String(error),
        },
      };

      this.error(`Operation failed: ${operation}`, error instanceof Error ? error : new Error(String(error)), {
        duration,
        operation,
        ...metadata,
      });

      throw error;
    }
  }
}

/**
 * Metrics collector for application performance monitoring
 */
export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      unit,
      tags,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Keep only last 1000 metrics per name to prevent memory leaks
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    this.recordMetric(`${name}_count`, current + value, 'count', tags);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    this.gauges.set(key, value);
    this.recordMetric(`${name}_gauge`, value, 'value', tags);
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.createKey(name, tags);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }

    const values = this.histograms.get(key)!;
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }

    this.recordMetric(`${name}_histogram`, value, 'value', tags);
  }

  getMetricSummary(name: string, tags?: Record<string, string>): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.createKey(name, tags);
    const metrics = this.histograms.get(key);

    if (!metrics || metrics.length === 0) {
      return null;
    }

    const sorted = [...metrics].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = sorted.reduce((sum, val) => sum + val, 0) / count;

    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    return { count, min, max, avg, p50, p95, p99 };
  }

  getSnapshot(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, ReturnType<MetricsCollector['getMetricSummary']>>;
  } {
    const counters: Record<string, number> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, ReturnType<MetricsCollector['getMetricSummary']>> = {};

    for (const [key, value] of this.counters) {
      counters[key] = value;
    }

    for (const [key, value] of this.gauges) {
      gauges[key] = value;
    }

    for (const [key] of this.histograms) {
      histograms[key] = this.getMetricSummary(key) || {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    return { counters, gauges, histograms };
  }

  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private createKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagString}}`;
  }
}

/**
 * Health check system for monitoring application state
 */
export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private lastResults: Map<string, { healthy: boolean; timestamp: number; error?: string }> = new Map();

  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async runCheck(name: string): Promise<{ healthy: boolean; error?: string }> {
    const check = this.checks.get(name);
    if (!check) {
      return { healthy: false, error: `Check '${name}' not found` };
    }

    try {
      const result = await check();
      const status = { healthy: result, timestamp: Date.now() };
      this.lastResults.set(name, status);
      return { healthy: result };
    } catch (error) {
      const status = {
        healthy: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      this.lastResults.set(name, status);
      return { healthy: false, error: status.error };
    }
  }

  async runAllChecks(): Promise<{
    overall: boolean;
    checks: Record<string, { healthy: boolean; error?: string; lastChecked: number }>;
  }> {
    const results: Record<string, { healthy: boolean; error?: string; lastChecked: number }> = {};
    let overall = true;

    for (const name of this.checks.keys()) {
      const result = await this.runCheck(name);
      results[name] = {
        ...result,
        lastChecked: this.lastResults.get(name)?.timestamp || Date.now(),
      };
      overall = overall && result.healthy;
    }

    return { overall, checks: results };
  }

  getLastResults(): Record<string, { healthy: boolean; timestamp: number; error?: string }> {
    const results: Record<string, { healthy: boolean; timestamp: number; error?: string }> = {};
    
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }

    return results;
  }
}

// Global instances for convenience
export const logger = new Logger();
export const metrics = new MetricsCollector();
export const healthChecker = new HealthChecker();

// Utility functions
export function createLogger(context: Record<string, unknown> = {}): Logger {
  return new Logger(LogLevel.INFO, context);
}

export function withTrace<T>(
  traceId: string,
  operation: (logger: Logger) => Promise<T>
): Promise<T> {
  const tracedLogger = logger.withTraceId(traceId);
  return operation(tracedLogger);
}
