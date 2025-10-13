/**
 * Comprehensive monitoring and logging utilities
 * Provides structured logging, metrics collection, and performance monitoring
 */

import type { EventV1 } from '../schema.js';

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly error?: Error;
  readonly duration?: number;
  readonly traceId?: string;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface Metric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly tags?: Readonly<Record<string, string>>;
  readonly timestamp: number;
}

export interface PerformanceMetrics {
  readonly operation: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly success: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export class Logger {
  private readonly minLevel: LogLevel;
  private readonly context: Readonly<Record<string, unknown>>;
  private readonly traceId?: string;

  constructor(
    minLevel: LogLevel = LogLevel.INFO,
    context: Readonly<Record<string, unknown>> = {},
    traceId?: string
  ) {
    this.minLevel = minLevel;
    this.context = context;
    this.traceId = traceId;
  }

  withContext(additionalContext: Readonly<Record<string, unknown>>): Logger {
    return new Logger(
      this.minLevel,
      { ...this.context, ...additionalContext },
      this.traceId
    );
  }

  withTraceId(traceIdentifier: string): Logger {
    return new Logger(this.minLevel, this.context, traceIdentifier);
  }

  debug(logMessage: string, additionalContext?: Readonly<Record<string, unknown>>): void {
    this.createLogEntry(LogLevel.DEBUG, logMessage, additionalContext);
  }

  info(logMessage: string, additionalContext?: Readonly<Record<string, unknown>>): void {
    this.createLogEntry(LogLevel.INFO, logMessage, additionalContext);
  }

  warn(logMessage: string, additionalContext?: Readonly<Record<string, unknown>>): void {
    this.createLogEntry(LogLevel.WARN, logMessage, additionalContext);
  }

  error(
    logMessage: string,
    error?: Error,
    additionalContext?: Readonly<Record<string, unknown>>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message: logMessage,
      context: this.mergeContexts(additionalContext),
      error,
      traceId: this.traceId,
    };

    this.output(entry);
  }

  fatal(
    logMessage: string,
    error?: Error,
    additionalContext?: Readonly<Record<string, unknown>>
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.FATAL,
      message: logMessage,
      context: this.mergeContexts(additionalContext),
      error,
      traceId: this.traceId,
    };

    this.output(entry);
  }

  private createLogEntry(
    logLevel: LogLevel,
    logMessage: string,
    additionalContext?: Readonly<Record<string, unknown>>
  ): void {
    if (logLevel < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message: logMessage,
      context: this.mergeContexts(additionalContext),
      traceId: this.traceId,
    };

    this.output(entry);
  }

  private mergeContexts(
    additionalContext?: Readonly<Record<string, unknown>>
  ): Readonly<Record<string, unknown>> {
    return additionalContext ? { ...this.context, ...additionalContext } : this.context;
  }

  private output(entry: LogEntry): void {
    const formattedOutput = this.formatLogEntry(entry);
    console.error(JSON.stringify(formattedOutput));
  }

  private formatLogEntry(entry: LogEntry): Record<string, unknown> {
    return {
      ...entry,
      level: LogLevel[entry.level].toLowerCase(),
      ...(entry.error && this.formatError(entry.error)),
    };
  }

  private formatError(error: Error): Record<string, unknown> {
    return {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    };
  }

  // Create structured event
  createEvent(eventLevel: EventV1['level'], eventType: string, eventData?: unknown): EventV1 {
    return {
      time: new Date().toISOString(),
      level: eventLevel,
      event: eventType,
      id: this.traceId,
      data: eventData,
    };
  }

  // Performance measurement with high precision timing
  async measure<T>(
    operationName: string,
    operationFunction: () => Promise<T>,
    operationMetadata?: Readonly<Record<string, unknown>>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = Date.now();
    const startHighResTime = process.hrtime.bigint();

    try {
      const result = await operationFunction();
      const performanceMetrics = this.createSuccessfulMetrics(
        operationName,
        startTime,
        startHighResTime,
        operationMetadata
      );

      this.info(`Operation completed: ${operationName}`, {
        duration: performanceMetrics.duration,
        operation: operationName,
        ...operationMetadata,
      });

      return { result, metrics: performanceMetrics };
    } catch (error) {
      const performanceMetrics = this.createFailedMetrics(
        operationName,
        startTime,
        startHighResTime,
        error,
        operationMetadata
      );

      this.error(
        `Operation failed: ${operationName}`,
        error instanceof Error ? error : new Error(String(error)),
        {
          duration: performanceMetrics.duration,
          operation: operationName,
          ...operationMetadata,
        }
      );

      throw error;
    }
  }

  private createSuccessfulMetrics(
    operationName: string,
    startTime: number,
    startHighResTime: bigint,
    metadata?: Readonly<Record<string, unknown>>
  ): PerformanceMetrics {
    const endTime = Date.now();
    const endHighResTime = process.hrtime.bigint();
    const duration = endTime - startTime;
    const precisionDuration = Number(endHighResTime - startHighResTime) / 1000000; // Convert to ms

    return {
      operation: operationName,
      startTime,
      endTime,
      duration,
      success: true,
      metadata: {
        ...metadata,
        precisionDuration,
      },
    };
  }

  private createFailedMetrics(
    operationName: string,
    startTime: number,
    startHighResTime: bigint,
    error: unknown,
    metadata?: Readonly<Record<string, unknown>>
  ): PerformanceMetrics {
    const endTime = Date.now();
    const endHighResTime = process.hrtime.bigint();
    const duration = endTime - startTime;
    const precisionDuration = Number(endHighResTime - startHighResTime) / 1000000;

    return {
      operation: operationName,
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
  }
}

/**
 * Metrics collector for application performance monitoring
 */
export class MetricsCollector {
  private readonly metrics: Map<string, Metric[]> = new Map();
  private readonly counters: Map<string, number> = new Map();
  private readonly gauges: Map<string, number> = new Map();
  private readonly histograms: Map<string, number[]> = new Map();

  private static readonly MAX_METRICS_HISTORY = 1000;

  recordMetric(
    metricName: string,
    metricValue: number,
    metricUnit: string,
    metricTags?: Readonly<Record<string, string>>
  ): void {
    const metric: Metric = {
      name: metricName,
      value: metricValue,
      unit: metricUnit,
      tags: metricTags,
      timestamp: Date.now(),
    };

    this.addMetricToHistory(metricName, metric);
  }

  incrementCounter(
    counterName: string,
    incrementValue: number = 1,
    counterTags?: Readonly<Record<string, string>>
  ): void {
    const counterKey = this.createKey(counterName, counterTags);
    const currentCount = this.counters.get(counterKey) || 0;
    const newCount = currentCount + incrementValue;

    this.counters.set(counterKey, newCount);
    this.recordMetric(`${counterName}_count`, newCount, 'count', counterTags);
  }

  setGauge(
    gaugeName: string,
    gaugeValue: number,
    gaugeTags?: Readonly<Record<string, string>>
  ): void {
    const gaugeKey = this.createKey(gaugeName, gaugeTags);
    this.gauges.set(gaugeKey, gaugeValue);
    this.recordMetric(`${gaugeName}_gauge`, gaugeValue, 'value', gaugeTags);
  }

  recordHistogram(
    histogramName: string,
    histogramValue: number,
    histogramTags?: Readonly<Record<string, string>>
  ): void {
    const histogramKey = this.createKey(histogramName, histogramTags);

    this.addHistogramValue(histogramKey, histogramValue);
    this.recordMetric(`${histogramName}_histogram`, histogramValue, 'value', histogramTags);
  }

  private addMetricToHistory(metricName: string, metric: Metric): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }

    const metricHistory = this.metrics.get(metricName)!;
    metricHistory.push(metric);

    // Prevent memory leaks by limiting history
    if (metricHistory.length > MetricsCollector.MAX_METRICS_HISTORY) {
      metricHistory.splice(0, metricHistory.length - MetricsCollector.MAX_METRICS_HISTORY);
    }
  }

  private addHistogramValue(histogramKey: string, value: number): void {
    if (!this.histograms.has(histogramKey)) {
      this.histograms.set(histogramKey, []);
    }

    const histogramValues = this.histograms.get(histogramKey)!;
    histogramValues.push(value);

    // Keep only last 1000 values to prevent memory leaks
    if (histogramValues.length > MetricsCollector.MAX_METRICS_HISTORY) {
      histogramValues.splice(0, histogramValues.length - MetricsCollector.MAX_METRICS_HISTORY);
    }
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
