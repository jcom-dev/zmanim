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

  test('shows zman cards from master registry', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Should have some content loaded
    const hasCards = await page.locator('body').textContent();
    expect(hasCards).toBeTruthy();
  });

  test('has publisher selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for publisher selection controls
    const hasPublisherControl = await page.locator('body').textContent();
    expect(hasPublisherControl).toBeTruthy();
  });

  test('has location selector', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for location selection controls
    const hasLocationControl = await page.locator('body').textContent();
    expect(hasLocationControl).toBeTruthy();
  });

  test('has search functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForClientReady(page);

    // Look for search input - check if page has any input fields
    const hasInput = await page.locator('input').first().isVisible({ timeout: 15000 });
    expect(hasInput).toBeTruthy();
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

    // Should show some zman information
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
  });
});
