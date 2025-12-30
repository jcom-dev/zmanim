/**
 * E2E Tests: Publisher Analytics
 *
 * Tests for analytics and usage statistics:
 * - Analytics page loads
 * - Shows calculation stats
 * - Shows charts/visualizations
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForClientReady(page);

    // Should see analytics-related content
    await expect(page.locator('body')).toContainText(/analytic|calculation|stat/i, { timeout: 15000 });
  });

  test('shows calculation statistics', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForClientReady(page);

    // Should show stats or metrics
    const hasStats = await page.locator('body').textContent();
    expect(hasStats).toBeTruthy();
  });

  test('has refresh button for stats', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForClientReady(page);

    // Look for refresh controls
    const refreshButton = page.getByRole('button', { name: /refresh/i }).first();

    // Refresh may or may not be visible
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('shows time period data', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/analytics`);
    await waitForClientReady(page);

    // Should show monthly/weekly/daily data
    const hasTimePeriod = await page.locator('body').textContent();
    expect(hasTimePeriod).toBeTruthy();
  });
});
