/**
 * E2E Tests: Admin Settings
 *
 * Tests for admin settings page:
 * - Settings page loads
 * - Shows system configuration
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Admin Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('settings page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/settings`);
    await waitForClientReady(page);

    // Should see settings-related content
    await expect(page.locator('body')).toContainText(/setting|config|system/i, { timeout: 15000 });
  });

  test('has navigation back to admin portal', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/settings`);
    await waitForClientReady(page);

    // Should have navigation elements
    const hasNav = await page.locator('a[href*="/admin"]').first().isVisible();
    expect(hasNav).toBeTruthy();
  });
});
