/**
 * Performance Metrics Utilities for E2E Tests
 *
 * Helper functions for measuring and validating performance in Playwright tests.
 * Used for tracking page load times, operation durations, and API response times.
 *
 * @example
 * ```typescript
 * import { measurePageLoad, measureOperation, measureAPIResponse } from '../utils';
 *
 * // Measure page load performance
 * const loadMetrics = await measurePageLoad(page, '/publisher/registry');
 * expect(loadMetrics.firstContentfulPaint).toBeLessThan(2000);
 *
 * // Measure specific operation
 * const duration = await measureOperation(page, async () => {
 *   await page.click('[data-testid="filter-button"]');
 * });
 * expect(duration).toBeLessThan(300);
 *
 * // Measure API response time
 * const apiMetrics = await measureAPIResponse(page, '/api/v1/auth/publisher/registry/master');
 * expect(apiMetrics.duration).toBeLessThan(1000);
 * ```
 */

import { Page } from '@playwright/test';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Page load performance metrics
 */
export interface PageLoadMetrics {
  /** Time to first contentful paint (milliseconds) */
  firstContentfulPaint: number;
  /** Time to DOM content loaded (milliseconds) */
  domContentLoaded: number;
  /** Time to full page load (milliseconds) */
  loadComplete: number;
  /** Total time from navigation start to page ready (milliseconds) */
  totalTime: number;
  /** Largest Contentful Paint (milliseconds) */
  largestContentfulPaint: number;
}

/**
 * API response performance metrics
 */
export interface APIResponseMetrics {
  /** API response duration (milliseconds) */
  duration: number;
  /** HTTP status code */
  status: number;
  /** Whether response was successful (2xx) */
  ok: boolean;
  /** Response URL */
  url: string;
}

/**
 * Operation performance result
 */
export interface OperationMetrics {
  /** Operation duration (milliseconds) */
  duration: number;
  /** Operation start timestamp */
  startTime: number;
  /** Operation end timestamp */
  endTime: number;
}

// =============================================================================
// Page Load Measurement
// =============================================================================

/**
 * Measure page load performance metrics.
 *
 * Captures critical performance metrics including:
 * - First Contentful Paint (FCP)
 * - Largest Contentful Paint (LCP)
 * - DOM Content Loaded
 * - Full page load
 *
 * @param page - Playwright page instance
 * @param url - URL to navigate to and measure
 * @returns Performance metrics
 *
 * @example
 * ```typescript
 * const metrics = await measurePageLoad(page, '/publisher/registry');
 * console.log(`Page loaded in ${metrics.totalTime}ms`);
 * expect(metrics.firstContentfulPaint).toBeLessThan(2000);
 * ```
 */
export async function measurePageLoad(page: Page, url: string): Promise<PageLoadMetrics> {
  const startTime = Date.now();

  // Navigate to page
  await page.goto(url, { waitUntil: 'networkidle' });

  // Collect performance metrics from browser
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((entry) => entry.name === 'first-contentful-paint');

    // Get LCP from PerformanceObserver (if available)
    let lcp = 0;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstContentfulPaint: fcp ? fcp.startTime : 0,
      largestContentfulPaint: lcp,
    };
  });

  const totalTime = Date.now() - startTime;

  return {
    ...metrics,
    totalTime,
  };
}

// =============================================================================
// Operation Measurement
// =============================================================================

/**
 * Measure the duration of a specific operation.
 *
 * Useful for timing user interactions, state changes, or any async operation.
 *
 * @param page - Playwright page instance (unused but kept for consistency)
 * @param operation - Async function to measure
 * @returns Operation duration in milliseconds
 *
 * @example
 * ```typescript
 * // Measure filter operation
 * const duration = await measureOperation(page, async () => {
 *   await page.click('[data-testid="filter-alos"]');
 *   await page.waitForSelector('[data-testid="zman-card"]');
 * });
 * expect(duration).toBeLessThan(300);
 *
 * // Measure modal open
 * const modalTime = await measureOperation(page, async () => {
 *   await page.click('[data-testid="info-button"]');
 *   await page.waitForSelector('[role="dialog"]');
 * });
 * expect(modalTime).toBeLessThan(200);
 * ```
 */
export async function measureOperation(
  page: Page,
  operation: () => Promise<void>
): Promise<number> {
  const startTime = Date.now();
  await operation();
  const duration = Date.now() - startTime;
  return duration;
}

/**
 * Measure operation with detailed metrics.
 *
 * Returns full operation metrics including start/end timestamps.
 *
 * @param page - Playwright page instance
 * @param operation - Async function to measure
 * @returns Detailed operation metrics
 *
 * @example
 * ```typescript
 * const metrics = await measureOperationDetailed(page, async () => {
 *   await page.click('button');
 * });
 * console.log(`Operation took ${metrics.duration}ms`);
 * ```
 */
export async function measureOperationDetailed(
  page: Page,
  operation: () => Promise<void>
): Promise<OperationMetrics> {
  const startTime = Date.now();
  await operation();
  const endTime = Date.now();

  return {
    duration: endTime - startTime,
    startTime,
    endTime,
  };
}

// =============================================================================
// API Response Measurement
// =============================================================================

/**
 * Measure API response time for a specific endpoint.
 *
 * Waits for an API call matching the URL pattern and measures response time.
 *
 * @param page - Playwright page instance
 * @param urlPattern - URL pattern to match (string or RegExp)
 * @returns API response metrics
 *
 * @example
 * ```typescript
 * // Measure specific API endpoint
 * const metrics = await measureAPIResponse(page, '/api/v1/auth/publisher/registry/master');
 * expect(metrics.duration).toBeLessThan(1000);
 * expect(metrics.ok).toBe(true);
 *
 * // Use RegExp pattern
 * const metricsRegex = await measureAPIResponse(page, /\/registry\/master/);
 * ```
 */
export async function measureAPIResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<APIResponseMetrics> {
  const startTime = Date.now();

  const response = await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 30000 }
  );

  const duration = Date.now() - startTime;
  const status = response.status();

  return {
    duration,
    status,
    ok: response.ok(),
    url: response.url(),
  };
}

/**
 * Measure multiple API responses concurrently.
 *
 * Useful for testing parallel API calls (e.g., batch operations).
 *
 * @param page - Playwright page instance
 * @param urlPatterns - Array of URL patterns to measure
 * @returns Array of API response metrics
 *
 * @example
 * ```typescript
 * const metrics = await measureMultipleAPIResponses(page, [
 *   '/api/v1/auth/publisher/registry/master',
 *   '/api/v1/auth/publisher/zmanim'
 * ]);
 * expect(metrics[0].duration).toBeLessThan(1000);
 * expect(metrics[1].duration).toBeLessThan(500);
 * ```
 */
export async function measureMultipleAPIResponses(
  page: Page,
  urlPatterns: (string | RegExp)[]
): Promise<APIResponseMetrics[]> {
  const measurements = await Promise.all(
    urlPatterns.map((pattern) => measureAPIResponse(page, pattern))
  );
  return measurements;
}

// =============================================================================
// Performance Assertions
// =============================================================================

/**
 * Assert that page load metrics meet performance targets.
 *
 * @param metrics - Page load metrics to validate
 * @param targets - Performance targets (all optional)
 *
 * @example
 * ```typescript
 * const metrics = await measurePageLoad(page, '/publisher/registry');
 * assertPageLoadPerformance(metrics, {
 *   firstContentfulPaint: 2000,
 *   totalTime: 3000
 * });
 * ```
 */
export function assertPageLoadPerformance(
  metrics: PageLoadMetrics,
  targets: {
    firstContentfulPaint?: number;
    domContentLoaded?: number;
    loadComplete?: number;
    totalTime?: number;
    largestContentfulPaint?: number;
  }
): void {
  if (targets.firstContentfulPaint !== undefined && metrics.firstContentfulPaint > targets.firstContentfulPaint) {
    throw new Error(
      `First Contentful Paint too slow: ${metrics.firstContentfulPaint}ms (target: ${targets.firstContentfulPaint}ms)`
    );
  }

  if (targets.domContentLoaded !== undefined && metrics.domContentLoaded > targets.domContentLoaded) {
    throw new Error(
      `DOM Content Loaded too slow: ${metrics.domContentLoaded}ms (target: ${targets.domContentLoaded}ms)`
    );
  }

  if (targets.loadComplete !== undefined && metrics.loadComplete > targets.loadComplete) {
    throw new Error(
      `Load Complete too slow: ${metrics.loadComplete}ms (target: ${targets.loadComplete}ms)`
    );
  }

  if (targets.totalTime !== undefined && metrics.totalTime > targets.totalTime) {
    throw new Error(
      `Total page load too slow: ${metrics.totalTime}ms (target: ${targets.totalTime}ms)`
    );
  }

  if (targets.largestContentfulPaint !== undefined && metrics.largestContentfulPaint > targets.largestContentfulPaint) {
    throw new Error(
      `Largest Contentful Paint too slow: ${metrics.largestContentfulPaint}ms (target: ${targets.largestContentfulPaint}ms)`
    );
  }
}

/**
 * Assert that operation duration meets performance target.
 *
 * @param duration - Measured operation duration
 * @param target - Target duration in milliseconds
 * @param operationName - Name of operation (for error message)
 *
 * @example
 * ```typescript
 * const duration = await measureOperation(page, async () => {
 *   await page.click('[data-testid="filter"]');
 * });
 * assertOperationPerformance(duration, 300, 'Filter operation');
 * ```
 */
export function assertOperationPerformance(
  duration: number,
  target: number,
  operationName: string = 'Operation'
): void {
  if (duration > target) {
    throw new Error(
      `${operationName} too slow: ${duration}ms (target: ${target}ms)`
    );
  }
}

/**
 * Assert that API response meets performance target.
 *
 * @param metrics - API response metrics
 * @param target - Target response time in milliseconds
 *
 * @example
 * ```typescript
 * const metrics = await measureAPIResponse(page, '/api/v1/auth/publisher/registry/master');
 * assertAPIPerformance(metrics, 1000);
 * ```
 */
export function assertAPIPerformance(
  metrics: APIResponseMetrics,
  target: number
): void {
  if (metrics.duration > target) {
    throw new Error(
      `API response too slow: ${metrics.url} took ${metrics.duration}ms (target: ${target}ms)`
    );
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate percentile value from array of measurements.
 *
 * @param values - Array of numeric measurements
 * @param percentile - Percentile to calculate (0-100)
 * @returns Percentile value
 *
 * @example
 * ```typescript
 * const durations = [100, 200, 300, 400, 500];
 * const p95 = calculatePercentile(durations, 95);
 * console.log(`p95: ${p95}ms`);
 * ```
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate basic statistics for array of measurements.
 *
 * @param values - Array of numeric measurements
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const durations = [100, 200, 300, 400, 500];
 * const stats = calculateStats(durations);
 * console.log(`Mean: ${stats.mean}ms, p95: ${stats.p95}ms`);
 * ```
 */
export function calculateStats(values: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p50: calculatePercentile(values, 50),
    p95: calculatePercentile(values, 95),
    p99: calculatePercentile(values, 99),
  };
}

/**
 * Format duration for display.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatDuration(1234); // "1234ms"
 * formatDuration(567);  // "567ms"
 * ```
 */
export function formatDuration(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

/**
 * Log performance metrics to console (for debugging).
 *
 * @param label - Label for the metrics
 * @param metrics - Page load metrics to log
 *
 * @example
 * ```typescript
 * const metrics = await measurePageLoad(page, '/publisher/registry');
 * logPerformanceMetrics('Registry Page Load', metrics);
 * ```
 */
export function logPerformanceMetrics(label: string, metrics: PageLoadMetrics): void {
  console.log(`\n=== ${label} ===`);
  console.log(`First Contentful Paint: ${formatDuration(metrics.firstContentfulPaint)}`);
  console.log(`Largest Contentful Paint: ${formatDuration(metrics.largestContentfulPaint)}`);
  console.log(`DOM Content Loaded: ${formatDuration(metrics.domContentLoaded)}`);
  console.log(`Load Complete: ${formatDuration(metrics.loadComplete)}`);
  console.log(`Total Time: ${formatDuration(metrics.totalTime)}`);
  console.log('=================\n');
}
