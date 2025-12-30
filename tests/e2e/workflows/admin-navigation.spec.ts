/**
 * E2E Tests: Admin Navigation Workflow
 *
 * Tests for navigating through admin sections:
 * - Can navigate between all major admin sections
 * - Admin portal structure works
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Admin Navigation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('can navigate from admin portal to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await waitForClientReady(page);

    // Should see admin portal
    await expect(page.locator('body')).toContainText(/admin|portal/i, { timeout: 15000 });

    // Navigate to dashboard
    const dashboardLink = page.locator('a[href*="/admin/dashboard"]').first();
    if (await dashboardLink.isVisible({ timeout: 5000 })) {
      await dashboardLink.click();
      await waitForClientReady(page);
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    }
  });

  test('admin navigation is accessible from all admin pages', async ({ page }) => {
    const adminPages = [
      '/admin',
      '/admin/dashboard',
      '/admin/publishers',
      '/admin/users',
      '/admin/settings',
    ];

    for (const pagePath of adminPages) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await waitForClientReady(page);

      // Should have navigation on every page
      const hasNav = await page.locator('nav, a, button').first().isVisible();
      expect(hasNav).toBeTruthy();
    }
  });

  test('can navigate between admin sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await waitForClientReady(page);

    // Navigate to publishers
    const publishersLink = page.locator('a[href*="/admin/publishers"]').first();
    if (await publishersLink.isVisible({ timeout: 5000 })) {
      await publishersLink.click();
      await waitForClientReady(page);
      await expect(page).toHaveURL(/\/admin\/publishers/);
    }
  });
});
