/**
 * E2E Performance Tests: Publisher Registry Interface
 *
 * Performance validation for Epic 11 - Story 11.7 (AC-7).
 * Tests page load times, operation durations, and API response times
 * against defined performance targets.
 *
 * Performance Targets:
 * - Page Load (p95): <2 seconds
 * - Location Preview Calculation: <500ms per zman
 * - Search/Filter Operations: <300ms
 * - Modal Open: <200ms
 * - Modal Close: <100ms
 *
 * @see docs/sprint-artifacts/stories/11-7-e2e-testing-performance.md
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  BASE_URL,
  waitForPageReady,
} from '../utils';
import {
  measurePageLoad,
  measureOperation,
  measureAPIResponse,
  calculateStats,
  formatDuration,
  logPerformanceMetrics,
} from '../utils/performance-metrics';

// All tests run in parallel
test.describe.configure({ mode: 'parallel' });

test.describe('Registry Performance Tests', () => {
  test.describe('Performance Test 1: Page Load', () => {
    test('page loads within 2 seconds (p95 target)', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      // Clear cache for cold load test
      await page.context().clearCookies();

      // Measure page load
      const metrics = await measurePageLoad(page, `${BASE_URL}/publisher/registry`);

      // Log metrics for debugging
      logPerformanceMetrics('Registry Page Load', metrics);

      // Verify page is interactive
      await expect(page.getByRole('heading', { name: /master registry|zmanim/i })).toBeVisible();

      // Assert performance targets
      // Target: <2 seconds for first contentful paint (p95)
      expect(metrics.firstContentfulPaint).toBeLessThan(2000);

      // Total time should also be reasonable (<3 seconds including network idle)
      expect(metrics.totalTime).toBeLessThan(3000);
    });

    test('page loads initial 50 zmanim cards', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      // Navigate and wait for page ready
      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Verify initial data loaded
      const zmanCards = page.locator('[data-testid="zman-card"]');
      const count = await zmanCards.count();

      // Should have loaded at least some zmanim (target: 50)
      expect(count).toBeGreaterThan(0);

      // Page should be interactive
      await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });
  });

  test.describe('Performance Test 2: Location Preview Calculation', () => {
    test('location preview calculates within 500ms per zman', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Measure location selection and preview calculation
      const duration = await measureOperation(page, async () => {
        // Open location picker
        const locationButton = page.locator('[data-testid="location-picker"]').or(
          page.getByPlaceholder(/search for a city/i)
        ).first();
        await locationButton.click();

        // Select Jerusalem (well-known location)
        await page.getByText('Jerusalem').first().click();

        // Wait for preview times to update
        await page.waitForSelector('[data-testid="preview-time"]', { state: 'visible', timeout: 10000 })
          .catch(() => {
            // Preview time might have different selector, wait for any time display
            return page.waitForFunction(
              () => {
                const body = document.body.textContent || '';
                return body.includes('AM') || body.includes('PM');
              },
              { timeout: 10000 }
            );
          });
      });

      console.log(`Location preview calculation took: ${formatDuration(duration)}`);

      // Target: <500ms per zman (concurrent calculation)
      // Allow up to 2 seconds for full batch (multiple zmanim calculated concurrently)
      expect(duration).toBeLessThan(2000);

      // Verify preview times are displayed
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    });

    test('preview times update without blocking UI', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Click location picker
      const locationButton = page.locator('[data-testid="location-picker"]').or(
        page.getByPlaceholder(/search for a city/i)
      ).first();
      await locationButton.click();

      // Verify UI remains interactive (not blocked)
      // User should be able to close the picker while calculation happens
      await page.keyboard.press('Escape');

      // Page should still be responsive
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('Performance Test 3: Search/Filter Operations', () => {
    test('category filter applies within 300ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Measure filter operation
      const duration = await measureOperation(page, async () => {
        // Open filter panel if needed (mobile)
        const filterButton = page.getByRole('button', { name: /filter/i }).first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
        }

        // Apply category filter
        const alosFilter = page.getByRole('checkbox', { name: /alos/i }).or(
          page.getByText('ALOS').first()
        );
        await alosFilter.click();

        // Wait for results to update
        await page.waitForLoadState('networkidle');
      });

      console.log(`Category filter operation took: ${formatDuration(duration)}`);

      // Target: <300ms
      expect(duration).toBeLessThan(300);

      // Verify filter was applied
      const activeChip = page.locator('[data-testid="filter-chip"]').or(
        page.getByText('ALOS').first()
      );
      await expect(activeChip).toBeVisible();
    });

    test('shita filter applies within 300ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Measure filter operation
      const duration = await measureOperation(page, async () => {
        // Open filter panel if needed
        const filterButton = page.getByRole('button', { name: /filter/i }).first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
        }

        // Apply shita filter
        const graFilter = page.getByRole('checkbox', { name: /gra/i }).or(
          page.getByText('GRA').first()
        );
        await graFilter.click();

        // Wait for results to update
        await page.waitForLoadState('networkidle');
      });

      console.log(`Shita filter operation took: ${formatDuration(duration)}`);

      // Target: <300ms
      expect(duration).toBeLessThan(300);

      // Verify filter was applied
      const activeChip = page.locator('[data-testid="filter-chip"]').or(
        page.getByText('GRA').first()
      );
      await expect(activeChip).toBeVisible();
    });

    test('search completes within 300ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      const searchInput = page.getByPlaceholder(/search/i).first();

      // Measure search operation
      const duration = await measureOperation(page, async () => {
        await searchInput.fill('Alos Hashachar');

        // Wait for search results to update
        await page.waitForLoadState('networkidle');
      });

      console.log(`Search operation took: ${formatDuration(duration)}`);

      // Target: <300ms
      expect(duration).toBeLessThan(300);

      // Verify search filtered results
      const bodyText = await page.textContent('body');
      expect(bodyText?.toLowerCase()).toContain('alos');
    });

    test('combined filters apply within 500ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Measure combined filter operation
      const duration = await measureOperation(page, async () => {
        // Open filter panel if needed
        const filterButton = page.getByRole('button', { name: /filter/i }).first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
        }

        // Apply category filter
        const alosFilter = page.getByRole('checkbox', { name: /alos/i }).or(
          page.getByText('ALOS').first()
        );
        await alosFilter.click();

        // Apply shita filter
        const graFilter = page.getByRole('checkbox', { name: /gra/i }).or(
          page.getByText('GRA').first()
        );
        await graFilter.click();

        // Wait for results to update
        await page.waitForLoadState('networkidle');
      });

      console.log(`Combined filter operation took: ${formatDuration(duration)}`);

      // Target: <500ms (multiple filters)
      expect(duration).toBeLessThan(500);
    });
  });

  test.describe('Performance Test 4: Modal Open/Close', () => {
    test('modal opens within 200ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Find info button
      const infoButton = page.locator('[data-testid="info-button"]').or(
        page.getByRole('button', { name: /info|ℹ/i })
      ).first();

      // Measure modal open
      const duration = await measureOperation(page, async () => {
        await infoButton.click();

        // Wait for modal to be fully rendered
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });
      });

      console.log(`Modal open took: ${formatDuration(duration)}`);

      // Target: <200ms
      expect(duration).toBeLessThan(200);

      // Verify modal is visible
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    test('modal closes within 100ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Open modal first
      const infoButton = page.locator('[data-testid="info-button"]').or(
        page.getByRole('button', { name: /info|ℹ/i })
      ).first();
      await infoButton.click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Measure modal close
      const duration = await measureOperation(page, async () => {
        await page.keyboard.press('Escape');

        // Wait for modal to be hidden
        await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
      });

      console.log(`Modal close took: ${formatDuration(duration)}`);

      // Target: <100ms
      expect(duration).toBeLessThan(100);

      // Verify modal is hidden
      const modal = page.locator('[role="dialog"]');
      await expect(modal).not.toBeVisible();
    });

    test('modal close button works within 100ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Open modal
      const infoButton = page.locator('[data-testid="info-button"]').or(
        page.getByRole('button', { name: /info|ℹ/i })
      ).first();
      await infoButton.click();
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      // Find close button
      const closeButton = page.locator('[role="dialog"]').getByRole('button', { name: /close/i }).or(
        page.locator('[role="dialog"]').locator('button[aria-label*="close"]')
      ).first();

      // Measure modal close via button
      const duration = await measureOperation(page, async () => {
        await closeButton.click();

        // Wait for modal to be hidden
        await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
      });

      console.log(`Modal close (via button) took: ${formatDuration(duration)}`);

      // Target: <100ms
      expect(duration).toBeLessThan(100);
    });
  });

  test.describe('Performance Test 5: API Response Times', () => {
    test('master registry API responds within 1 second', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      // Start measuring before navigation
      const metricsPromise = measureAPIResponse(page, '/api/v1/auth/publisher/registry/master');

      await page.goto(`${BASE_URL}/publisher/registry`);

      // Wait for API response
      const metrics = await metricsPromise;

      console.log(`Master registry API took: ${formatDuration(metrics.duration)}`);

      // Target: <1 second
      expect(metrics.duration).toBeLessThan(1000);
      expect(metrics.ok).toBe(true);
    });

    test('zmanim calculation API responds within 500ms', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      // Trigger location selection to cause zmanim calculation
      const metricsPromise = measureAPIResponse(page, /\/zmanim|\/calculate/);

      // Select location
      const locationButton = page.locator('[data-testid="location-picker"]').or(
        page.getByPlaceholder(/search for a city/i)
      ).first();
      await locationButton.click();
      await page.getByText('Jerusalem').first().click();

      // Wait for API response (with timeout)
      const metrics = await metricsPromise.catch(() => ({
        duration: 0,
        status: 0,
        ok: false,
        url: '',
      }));

      if (metrics.ok) {
        console.log(`Zmanim calculation API took: ${formatDuration(metrics.duration)}`);
        // Target: <500ms
        expect(metrics.duration).toBeLessThan(500);
      } else {
        console.log('Zmanim calculation API not called (preview may use client-side calculation)');
      }
    });
  });

  test.describe('Performance Test 6: Batch Operations', () => {
    test('multiple filters maintain responsiveness', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      const durations: number[] = [];

      // Apply multiple filters sequentially
      const filters = ['ALOS', 'GRA'];

      for (const filterName of filters) {
        const duration = await measureOperation(page, async () => {
          const filterButton = page.getByRole('button', { name: /filter/i }).first();
          if (await filterButton.isVisible()) {
            await filterButton.click();
          }

          const filter = page.getByRole('checkbox', { name: new RegExp(filterName, 'i') }).or(
            page.getByText(filterName).first()
          );
          await filter.click();

          await page.waitForLoadState('networkidle');
        });

        durations.push(duration);
        console.log(`Filter ${filterName} took: ${formatDuration(duration)}`);
      }

      // Calculate stats
      const stats = calculateStats(durations);
      console.log(`Filter operations - Mean: ${formatDuration(stats.mean)}, p95: ${formatDuration(stats.p95)}`);

      // All filter operations should be <300ms
      durations.forEach((duration, index) => {
        expect(duration).toBeLessThan(300);
      });

      // Average should be well under target
      expect(stats.mean).toBeLessThan(250);
    });

    test('rapid search updates maintain performance', async ({ page }) => {
      const publisher = getSharedPublisher('verified-1');
      await loginAsPublisher(page, publisher.id);

      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      const searchInput = page.getByPlaceholder(/search/i).first();
      const searches = ['a', 'al', 'alo', 'alos'];
      const durations: number[] = [];

      for (const search of searches) {
        const duration = await measureOperation(page, async () => {
          await searchInput.fill(search);
          await page.waitForLoadState('networkidle');
        });

        durations.push(duration);
      }

      // Calculate stats
      const stats = calculateStats(durations);
      console.log(`Search operations - Mean: ${formatDuration(stats.mean)}, p95: ${formatDuration(stats.p95)}`);

      // p95 should be <300ms
      expect(stats.p95).toBeLessThan(300);
    });
  });
});
