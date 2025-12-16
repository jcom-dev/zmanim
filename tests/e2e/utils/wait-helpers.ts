/**
 * Wait Helpers for E2E Tests
 *
 * Centralized wait utilities that replace the 220+ scattered wait patterns
 * across test files. These helpers provide consistent timeouts, better
 * error messages, and retry logic.
 *
 * @example
 * ```typescript
 * import { waitForPageReady, waitForContent, retryAction } from './wait-helpers';
 *
 * // Wait for page to be fully loaded
 * await waitForPageReady(page);
 *
 * // Wait for specific content to appear
 * await waitForContent(page, ['Dashboard', 'Welcome']);
 *
 * // Retry a flaky action
 * await retryAction(() => page.click('button'), { maxRetries: 3 });
 * ```
 */

import { Page, expect } from '@playwright/test';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Standard timeout values used across tests.
 * Centralized here to ensure consistency.
 */
export const Timeouts = {
  /** Short timeout for fast operations */
  SHORT: 5000,
  /** Medium timeout for typical page loads */
  MEDIUM: 15000,
  /** Long timeout for slow operations (Clerk auth, etc.) */
  LONG: 30000,
  /** Extended timeout for very slow operations */
  EXTENDED: 60000,
  /** Polling interval for retry operations */
  POLL_INTERVAL: 500,
} as const;

// =============================================================================
// Page Ready Helpers
// =============================================================================

export interface WaitForPageReadyOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Wait for network to be idle */
  waitForNetwork?: boolean;
  /** Wait for specific selector to appear */
  waitForSelector?: string;
  /** Additional selectors that indicate the page is ready */
  readyIndicators?: string[];
}

/**
 * Wait for a page to be fully loaded and ready for interaction.
 *
 * This is the primary helper that should be used after navigation.
 * It combines multiple checks to ensure the page is truly ready.
 *
 * @param page - Playwright page instance
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * await page.goto('/dashboard');
 * await waitForPageReady(page);
 *
 * // With custom options
 * await waitForPageReady(page, {
 *   timeout: 30000,
 *   waitForSelector: '[data-testid="dashboard-content"]',
 * });
 * ```
 */
export async function waitForPageReady(
  page: Page,
  options: WaitForPageReadyOptions = {}
): Promise<void> {
  const {
    timeout = Timeouts.MEDIUM,
    waitForNetwork = true,
    waitForSelector = 'main',
    readyIndicators = [],
  } = options;

  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded', { timeout });

  // Wait for network idle if requested
  if (waitForNetwork) {
    await page.waitForLoadState('networkidle', { timeout }).catch(() => {
      // Network idle can timeout on pages with polling - continue anyway
    });
  }

  // Wait for main content area
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout, state: 'visible' }).catch(() => {
      // Selector might not exist on all pages - continue anyway
    });
  }

  // Wait for any additional ready indicators
  for (const indicator of readyIndicators) {
    await page.waitForSelector(indicator, { timeout: timeout / 2, state: 'visible' }).catch(() => {
      // Optional indicators - don't fail if not found
    });
  }
}

/**
 * Wait for Clerk authentication to be ready.
 *
 * This waits for Clerk's JavaScript to load and initialize.
 * Should be called before any auth-dependent operations.
 *
 * @param page - Playwright page instance
 * @param timeout - Timeout in milliseconds
 */
export async function waitForClerkReady(page: Page, timeout: number = Timeouts.LONG): Promise<void> {
  await page.waitForFunction(
    () => {
      // Clerk is injected as a global by the Clerk SDK
      return typeof (window as { Clerk?: { loaded?: boolean } }).Clerk !== 'undefined' &&
        (window as { Clerk?: { loaded?: boolean } }).Clerk?.loaded;
    },
    { timeout }
  );
}

/**
 * Wait for navigation to complete after a click or action.
 *
 * @param page - Playwright page instance
 * @param urlPattern - URL pattern to wait for (string or RegExp)
 * @param timeout - Timeout in milliseconds
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = Timeouts.MEDIUM
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout });
  await waitForPageReady(page, { timeout });
}

// =============================================================================
// Content Helpers
// =============================================================================

export interface WaitForContentOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether all patterns must match (default: true) */
  matchAll?: boolean;
  /** Case-insensitive matching */
  ignoreCase?: boolean;
}

/**
 * Wait for specific text content to appear on the page.
 *
 * Useful for verifying that dynamic content has loaded.
 *
 * @param page - Playwright page instance
 * @param patterns - Array of text patterns to wait for
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * // Wait for multiple text elements
 * await waitForContent(page, ['Welcome', 'Dashboard', 'Profile']);
 *
 * // Wait for any of the patterns (not all)
 * await waitForContent(page, ['Success', 'Complete'], { matchAll: false });
 * ```
 */
export async function waitForContent(
  page: Page,
  patterns: string[],
  options: WaitForContentOptions = {}
): Promise<void> {
  const { timeout = Timeouts.MEDIUM, matchAll = true, ignoreCase = true } = options;

  const checkContent = async () => {
    const content = await page.textContent('body');
    if (!content) return false;

    const searchContent = ignoreCase ? content.toLowerCase() : content;

    if (matchAll) {
      return patterns.every((pattern) => {
        const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;
        return searchContent.includes(searchPattern);
      });
    } else {
      return patterns.some((pattern) => {
        const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;
        return searchContent.includes(searchPattern);
      });
    }
  };

  await page.waitForFunction(
    async ([patterns, matchAll, ignoreCase]) => {
      const content = document.body?.textContent || '';
      const searchContent = ignoreCase ? content.toLowerCase() : content;

      if (matchAll) {
        return patterns.every((pattern: string) => {
          const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;
          return searchContent.includes(searchPattern);
        });
      } else {
        return patterns.some((pattern: string) => {
          const searchPattern = ignoreCase ? pattern.toLowerCase() : pattern;
          return searchContent.includes(searchPattern);
        });
      }
    },
    [patterns, matchAll, ignoreCase] as const,
    { timeout }
  );
}

/**
 * Wait for an element to contain specific text.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param text - Text to wait for
 * @param timeout - Timeout in milliseconds
 */
export async function waitForElementText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = Timeouts.MEDIUM
): Promise<void> {
  await page.waitForSelector(selector, { timeout, state: 'visible' });
  await expect(page.locator(selector)).toContainText(text, { timeout });
}

/**
 * Wait for a loading indicator to disappear.
 *
 * @param page - Playwright page instance
 * @param selector - Selector for the loading indicator
 * @param timeout - Timeout in milliseconds
 */
export async function waitForLoadingComplete(
  page: Page,
  selector: string = '[data-loading="true"], .loading, .spinner',
  timeout: number = Timeouts.MEDIUM
): Promise<void> {
  // First check if loading indicator exists
  const hasLoading = await page.locator(selector).count();
  if (hasLoading > 0) {
    await page.waitForSelector(selector, { state: 'hidden', timeout });
  }
}

// =============================================================================
// API Response Helpers
// =============================================================================

export interface WaitForApiOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** HTTP status code to expect */
  expectedStatus?: number;
}

/**
 * Wait for an API response and optionally verify content.
 *
 * @param page - Playwright page instance
 * @param urlPattern - URL pattern to match (string or RegExp)
 * @param contentPatterns - Optional text patterns to verify in response
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * // Wait for API call to complete
 * await waitForApiContent(page, '/api/v1/auth/publisher/profile');
 *
 * // Wait and verify response contains certain data
 * await waitForApiContent(page, '/api/v1/auth/publisher/zmanim', ['sunrise', 'sunset']);
 * ```
 */
export async function waitForApiContent(
  page: Page,
  urlPattern: string | RegExp,
  contentPatterns?: string[],
  options: WaitForApiOptions = {}
): Promise<void> {
  const { timeout = Timeouts.MEDIUM, expectedStatus = 200 } = options;

  const response = await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );

  expect(response.status()).toBe(expectedStatus);

  if (contentPatterns && contentPatterns.length > 0) {
    const body = await response.text();
    for (const pattern of contentPatterns) {
      expect(body).toContain(pattern);
    }
  }
}

// =============================================================================
// Retry Helpers
// =============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Whether to use exponential backoff */
  exponentialBackoff?: boolean;
  /** Function to determine if error is retryable */
  shouldRetry?: (error: Error) => boolean;
  /** Callback on each retry */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry an async action with configurable options.
 *
 * Useful for handling flaky operations in E2E tests.
 *
 * @param action - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the action
 *
 * @example
 * ```typescript
 * // Simple retry
 * await retryAction(() => page.click('button'));
 *
 * // With custom options
 * const result = await retryAction(
 *   () => fetchData(),
 *   {
 *     maxRetries: 5,
 *     retryDelay: 1000,
 *     exponentialBackoff: true,
 *   }
 * );
 * ```
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = Timeouts.POLL_INTERVAL,
    exponentialBackoff = false,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: Error = new Error('No attempts made');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      onRetry?.(attempt, lastError);

      const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt - 1) : retryDelay;
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Poll for a condition to become true.
 *
 * @param condition - Async function that returns boolean
 * @param timeout - Maximum time to wait
 * @param interval - Polling interval
 *
 * @example
 * ```typescript
 * await pollUntil(
 *   async () => {
 *     const count = await page.locator('.item').count();
 *     return count > 0;
 *   },
 *   10000,
 *   500
 * );
 * ```
 */
export async function pollUntil(
  condition: () => Promise<boolean>,
  timeout: number = Timeouts.MEDIUM,
  interval: number = Timeouts.POLL_INTERVAL
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a specific amount of time (explicit delay).
 *
 * Use sparingly - prefer waiting for specific conditions instead.
 *
 * @param page - Playwright page instance
 * @param ms - Duration in milliseconds
 */
export async function waitFor(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Wait for an element to be stable (not moving/changing).
 *
 * Useful before clicking on animated elements.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector for the element
 * @param timeout - Timeout in milliseconds
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  timeout: number = Timeouts.SHORT
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });

  // Wait for element position to stabilize
  let lastBoundingBox = await element.boundingBox();
  let stableCount = 0;
  const requiredStableChecks = 3;
  const checkInterval = 100;

  const startTime = Date.now();
  while (stableCount < requiredStableChecks && Date.now() - startTime < timeout) {
    await sleep(checkInterval);
    const currentBoundingBox = await element.boundingBox();

    if (
      currentBoundingBox &&
      lastBoundingBox &&
      currentBoundingBox.x === lastBoundingBox.x &&
      currentBoundingBox.y === lastBoundingBox.y &&
      currentBoundingBox.width === lastBoundingBox.width &&
      currentBoundingBox.height === lastBoundingBox.height
    ) {
      stableCount++;
    } else {
      stableCount = 0;
    }

    lastBoundingBox = currentBoundingBox;
  }
}
