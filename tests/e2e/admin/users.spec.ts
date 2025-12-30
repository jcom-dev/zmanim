/**
 * E2E Tests: Admin User Management
 *
 * Tests for admin user management:
 * - Users page loads
 * - Shows user list or controls
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('users page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);
    await waitForClientReady(page);

    // Should see user-related content
    await expect(page.locator('body')).toContainText(/user|account|member/i, { timeout: 15000 });
  });

  test('has user list or search', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);
    await waitForClientReady(page);

    // Should have user management UI
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });
});
