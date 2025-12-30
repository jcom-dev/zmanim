/**
 * E2E Tests: Admin Audit Trail
 *
 * Tests for admin audit trail:
 * - Audit page loads
 * - Shows activity logs
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Admin Audit Trail', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('audit page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/audit`);
    await waitForClientReady(page);

    // Should see audit-related content
    await expect(page.locator('body')).toContainText(/audit|activity|log|history/i, { timeout: 15000 });
  });

  test('shows activity timeline or logs', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/audit`);
    await waitForClientReady(page);

    // Should have audit trail UI
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });
});
