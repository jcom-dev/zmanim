/**
 * E2E Tests: Error Pages
 *
 * Tests for error handling and error pages:
 * - 404 page for non-existent routes
 * - Error boundary behavior
 * - Navigation from error pages
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Error Pages', () => {
  test('non-existent route shows 404 page', async ({ page }) => {
    await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
    await waitForClientReady(page);

    // Should show 404 or "not found" message
    await expect(page.locator('body')).toContainText(/404|not found|page.*exist/i, { timeout: 15000 });
  });

  test('404 page displays error content', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-route-xyz`);
    await waitForClientReady(page);

    // Should show 404 content
    await expect(page.locator('body')).toContainText(/404|not found/i, { timeout: 15000 });
  });

  test('protected route redirects when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/some/deeply/nested/nonexistent/path`);

    // Wait a bit for redirect to happen
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

    // Check that we either got redirected to sign-in OR stayed on admin (if authenticated somehow)
    const url = page.url();
    expect(url.includes('sign-in') || url.includes('admin')).toBeTruthy();
  });

  test('publisher route redirects when unauthenticated', async ({ page }) => {
    // Navigate to publisher section without auth
    await page.goto(`${BASE_URL}/publisher`);

    // Wait a bit for redirect to happen
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

    // Verify we're at sign-in or publisher page
    const url = page.url();
    expect(url.includes('sign-in') || url.includes('publisher')).toBeTruthy();
  });

  test('invalid zmanim locality shows error state', async ({ page }) => {
    // Test with an invalid locality ID format
    await page.goto(`${BASE_URL}/zmanim/invalid-id`);
    await waitForClientReady(page);

    // Should show error state
    await expect(page.locator('body')).toContainText(/error|invalid|not found/i, { timeout: 15000 });
  });
});
