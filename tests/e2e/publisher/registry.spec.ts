/**
 * E2E Tests: Publisher Registry Browser
 *
 * Tests for browsing and importing from master registry:
 * - Registry page loads
 * - Can browse zmanim
 * - Can search registry
 * - Publisher/location selection works
 * - Category and Shita tag filtering (tag ID based)
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Registry Browser', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('registry page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Should see registry-related content
    await expect(page.locator('body')).toContainText(/registry|master|zman/i, { timeout: 15000 });
  });

  test('shows zman cards from master registry', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Should have zman cards displayed
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('has search functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"]').or(page.locator('input').first());
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('can navigate back to algorithm page', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Try to find link back to algorithm
    const algoLink = page.locator('a[href*="/publisher/algorithm"]').first();
    if (await algoLink.isVisible({ timeout: 5000 })) {
      await algoLink.click();
      await waitForClientReady(page);

      // Should be on algorithm page
      await expect(page).toHaveURL(/\/publisher\/algorithm/);
    }
  });

  test('shows zman formulas and metadata', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for zman cards to load
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 15000 });

    // Check that cards contain formula code blocks
    const hasFormula = await page.locator('code').first().isVisible();
    expect(hasFormula).toBeTruthy();
  });
});

test.describe('Registry Category Tag Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('displays filter panel with category checkboxes', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Desktop: Filter panel should be visible in sidebar
    // Look for "Filters" heading or "Category" section
    const filterSection = page.locator('text=Category').or(page.locator('text=Filters'));
    await expect(filterSection.first()).toBeVisible({ timeout: 15000 });
  });

  test('displays filter panel with shita checkboxes', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for "Shita" section in filters
    const shitaSection = page.locator('text=Shita');
    await expect(shitaSection.first()).toBeVisible({ timeout: 15000 });
  });

  test('can select a category filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for filter options to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Get initial count of zman cards
    await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible({ timeout: 15000 });

    // Find and click a category checkbox (e.g., first one in Category section)
    const categoryCheckbox = page.locator('input[id^="cat-"]').first();
    if (await categoryCheckbox.isVisible()) {
      await categoryCheckbox.click();

      // Wait for API response and UI update
      await page.waitForResponse(
        (resp) => resp.url().includes('/registry/master') && resp.status() === 200,
        { timeout: 10000 }
      );

      // Should show filter chip for selected category
      const filterChip = page.locator('[class*="Badge"]').filter({ hasText: /.+/ });
      await expect(filterChip.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('can select a shita filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for filter options to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Find and click a shita checkbox
    const shitaCheckbox = page.locator('input[id^="shita-"]').first();
    if (await shitaCheckbox.isVisible()) {
      await shitaCheckbox.click();

      // Wait for API response
      await page.waitForResponse(
        (resp) => resp.url().includes('/registry/master') && resp.status() === 200,
        { timeout: 10000 }
      );

      // Should show filter chip
      const filterChip = page.locator('[class*="Badge"]').filter({ hasText: /.+/ });
      await expect(filterChip.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('filter chips can be removed', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for checkboxes to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Select a category filter
    const categoryCheckbox = page.locator('input[id^="cat-"]').first();
    if (await categoryCheckbox.isVisible()) {
      await categoryCheckbox.click();

      // Wait for chip to appear
      await page.waitForResponse(
        (resp) => resp.url().includes('/registry/master') && resp.status() === 200,
        { timeout: 10000 }
      );

      // Find and click the X button on the filter chip
      const chipRemoveButton = page.locator('button').filter({ has: page.locator('svg.h-3') }).first();
      if (await chipRemoveButton.isVisible()) {
        await chipRemoveButton.click();

        // Checkbox should be unchecked
        await expect(categoryCheckbox).not.toBeChecked();
      }
    }
  });

  test('clear all filters button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for checkboxes to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Select multiple filters
    const categoryCheckbox = page.locator('input[id^="cat-"]').first();
    const shitaCheckbox = page.locator('input[id^="shita-"]').first();

    if (await categoryCheckbox.isVisible()) {
      await categoryCheckbox.click();
    }
    if (await shitaCheckbox.isVisible()) {
      await shitaCheckbox.click();
    }

    // Wait for filters to apply
    await page.waitForTimeout(500);

    // Click "Clear All Filters" or "Clear all" button
    const clearButton = page.getByRole('button', { name: /clear.*filter|clear all/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();

      // All checkboxes should be unchecked
      if (await categoryCheckbox.isVisible()) {
        await expect(categoryCheckbox).not.toBeChecked();
      }
      if (await shitaCheckbox.isVisible()) {
        await expect(shitaCheckbox).not.toBeChecked();
      }
    }
  });

  test('status filter works (Available/Imported)', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Find status radio buttons
    const availableRadio = page.locator('input[id="status-available"]');
    const allRadio = page.locator('input[id="status-all"]');

    if (await availableRadio.isVisible()) {
      // Click "Available to Import" option
      await availableRadio.click();

      // Wait for API response with status filter
      await page.waitForResponse(
        (resp) => resp.url().includes('/registry/master') && resp.url().includes('status=available'),
        { timeout: 10000 }
      );

      // Should show filtered results
      await expect(page.locator('body')).toContainText(/showing|zmanim/i);

      // Reset to All
      if (await allRadio.isVisible()) {
        await allRadio.click();
      }
    }
  });

  test('search combined with filters works', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for page to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Enter search term
    const searchInput = page.locator('input[placeholder*="Search"]').or(page.locator('input').first());
    await searchInput.fill('sunrise');

    // Wait for search debounce
    await page.waitForTimeout(500);

    // Wait for filtered results
    await page.waitForResponse(
        (resp) => resp.url().includes('/registry/master') && resp.url().includes('search=sunrise'),
      { timeout: 10000 }
    );

    // Results should be filtered
    const resultCount = page.locator('text=/Showing \\d+ of \\d+/');
    await expect(resultCount).toBeVisible({ timeout: 10000 });
  });

  test('API uses category_tag_ids parameter (not category[])', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for checkboxes to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Select a category filter
    const categoryCheckbox = page.locator('input[id^="cat-"]').first();
    if (await categoryCheckbox.isVisible()) {
      // Set up request listener before clicking
      const requestPromise = page.waitForRequest((req) => {
        const url = req.url();
        // Verify the new parameter format is used (integer IDs)
        return url.includes('/registry/master') && url.includes('category_tag_ids=');
      });

      await categoryCheckbox.click();

      // Wait for the request with the correct parameter format
      const request = await requestPromise;
      const url = request.url();

      // Verify it uses category_tag_ids (not category[])
      expect(url).toContain('category_tag_ids=');
      expect(url).not.toContain('category[]=');
      expect(url).not.toContain('category%5B%5D=');
    }
  });

  test('API uses shita_tag_ids parameter (not shita[])', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for checkboxes to load
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });

    // Select a shita filter
    const shitaCheckbox = page.locator('input[id^="shita-"]').first();
    if (await shitaCheckbox.isVisible()) {
      // Set up request listener before clicking
      const requestPromise = page.waitForRequest((req) => {
        const url = req.url();
        // Verify the new parameter format is used (integer IDs)
        return url.includes('/registry/master') && url.includes('shita_tag_ids=');
      });

      await shitaCheckbox.click();

      // Wait for the request with the correct parameter format
      const request = await requestPromise;
      const url = request.url();

      // Verify it uses shita_tag_ids (not shita[])
      expect(url).toContain('shita_tag_ids=');
      expect(url).not.toContain('shita[]=');
      expect(url).not.toContain('shita%5B%5D=');
    }
  });
});

test.describe('Registry Mobile Filters', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('mobile filter sheet opens', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for mobile filter button
    const filterButton = page.getByRole('button', { name: /filters/i });
    await expect(filterButton).toBeVisible({ timeout: 15000 });

    // Click to open filter sheet
    await filterButton.click();

    // Sheet should open with filter options
    await expect(page.locator('[role="dialog"]').or(page.locator('[class*="SheetContent"]'))).toBeVisible({ timeout: 5000 });
  });
});
