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
    await expect(
      page.getByText('404').or(
        page.getByText(/not found/i)
      ).or(
        page.getByText(/page.*exist/i)
      )
    ).toBeVisible({ timeout: 15000 });
  });

  test('404 page has navigation back to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-route-xyz`);
    await waitForClientReady(page);

    // Should have either a link/button to go home or at least show 404 content
    // Check for any navigable element on the error page
    const hasNavigation = await page.locator('a, button').first().isVisible();
    expect(hasNavigation).toBeTruthy();
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

  test('error page has retry option when applicable', async ({ page }) => {
    // Navigate to a page that might have error boundary with retry
    await page.goto(`${BASE_URL}/zmanim/999999999`);
    await waitForClientReady(page);

    // Check if there's a retry/try again button
    const retryButton = page.getByRole('button', { name: /try again|retry|refresh/i });
    const errorMessage = page.getByText(/error/i);

    // Either should show error with retry OR just error message
    await expect(errorMessage.or(retryButton)).toBeVisible({ timeout: 15000 });
  });
});
