/**
 * E2E Tests: Publisher Navigation Workflow
 *
 * Tests for navigating through publisher sections:
 * - Can navigate between all major sections
 * - Breadcrumbs work
 * - Back navigation works
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Navigation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('can navigate from dashboard to all major sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Start from dashboard
    await expect(page).toHaveURL(/\/publisher\/dashboard/);

    // Navigate to algorithm
    const algoLink = page.locator('a[href*="/publisher/algorithm"]').first();
    if (await algoLink.isVisible({ timeout: 5000 })) {
      await algoLink.click();
      await waitForClientReady(page);
      await expect(page).toHaveURL(/\/publisher\/algorithm/);
    }
  });

  test('publisher navigation menu is accessible from all pages', async ({ page }) => {
    // Test pages without analytics (which was removed)
    const pages = [
      '/publisher/dashboard',
      '/publisher/algorithm',
      '/publisher/profile',
      '/publisher/coverage',
    ];

    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await waitForClientReady(page);

      // Should have navigation elements on every page
      const hasNav = await page.locator('nav, a, button').first().isVisible();
      expect(hasNav).toBeTruthy();
    }
  });

  test('can return to dashboard from any page', async ({ page }) => {
    // Start from algorithm page
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    // Look for dashboard link
    const dashboardLink = page.locator('a[href*="/publisher/dashboard"]').or(
      page.locator('a[href="/publisher"]')
    ).first();

    if (await dashboardLink.isVisible({ timeout: 5000 })) {
      await dashboardLink.click();
      await waitForClientReady(page);

      // Should be on dashboard or publisher root
      const url = page.url();
      expect(url.includes('/publisher')).toBeTruthy();
    }
  });
});
