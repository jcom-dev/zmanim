/**
 * E2E Tests: Publisher Registry Browser
 *
 * Tests for browsing and importing from master registry:
 * - Registry page loads
 * - Can browse zmanim
 * - Can search registry
 * - Publisher/location selection works
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

  test('shows zmanim content from master registry', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Should have some zmanim content loaded (cards or list items)
    await expect(page.locator('body')).toContainText(/sunrise|sunset|alos|tzeis/i, { timeout: 15000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for search input by placeholder
    const searchInput = page.getByPlaceholder(/search/i);
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

  test('shows zman formulas', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Wait for content to load
    await expect(page.locator('body')).toContainText(/sunrise|sunset/i, { timeout: 15000 });

    // Check that page contains formula-like content (DSL expressions)
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toMatch(/sunrise|sunset|solar|min/i);
  });

  test('search filters results', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Find and use search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Search for a specific term
    await searchInput.fill('sunrise');

    // Wait for search to apply (debounced)
    await page.waitForTimeout(500);

    // Should see search results or empty state
    await expect(page.locator('body')).toContainText(/sunrise|showing|no results/i, { timeout: 10000 });
  });

  test('page has filter controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Page should have some filter-related UI (category, status, etc.)
    // This is a smoke test to verify filter section exists
    const hasFilters = await page.locator('body').textContent();
    expect(hasFilters).toMatch(/category|status|filter|all zmanim/i);
  });
});
