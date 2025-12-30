import { test, expect } from '@playwright/test';
import { BASE_URL, TIMEOUTS } from './helpers/mcp-playwright';

/**
 * Admin Authentication & Authorization Tests
 * Story 1.3: Admin Publisher Management
 *
 * These tests verify that admin routes are properly protected
 * and require authentication + admin role.
 */

// Enable parallel execution (Story 5.14)
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Route Protection', () => {
  const adminRoutes = [
    '/admin/publishers',
    '/admin/publishers/new',
    '/admin/dashboard',
    '/admin/settings',
  ];

  test('all admin routes should require authentication', async ({ page }) => {
    for (const route of adminRoutes) {
      await page.goto(`${BASE_URL}${route}`);

      // Should be redirected to sign-in
      await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

      // Verify we're on sign-in page with redirect URL
      expect(page.url()).toContain('sign-in');
      expect(page.url()).toContain('redirect_url');
      expect(page.url()).toContain(encodeURIComponent(route));
    }
  });

  test('sign-in page should load successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });

    // Verify we're on sign-in page
    expect(page.url()).toContain('/sign-in');

    // Check for Clerk component - wait for it to appear
    const clerkContainer = page.locator('[data-clerk-id]').first();
    await expect(clerkContainer).toBeVisible({ timeout: TIMEOUTS.LONG });
  });

  test('home page should be accessible without authentication', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    // Should load successfully (200 or 304 for cached)
    expect(response?.status()).toBeLessThanOrEqual(304);
    expect(response?.status()).toBeGreaterThanOrEqual(200);

    // Should not redirect to sign-in
    expect(page.url()).not.toContain('sign-in');

    // Verify we're on home page
    const url = page.url();
    expect(url === `${BASE_URL}/` || url === `${BASE_URL}`).toBeTruthy();
  });
});

test.describe('Middleware Runtime Errors', () => {
  test('should not throw immutable headers error', async ({ page }) => {
    // This test verifies the fix for the middleware bug
    const response = await page.goto(`${BASE_URL}/admin/publishers`, { waitUntil: 'domcontentloaded' });

    // Should redirect (not error 500)
    // The fact that we get a redirect instead of 500 error means middleware works
    const status = response?.status();
    expect(status).not.toBe(500);

    // Should successfully redirect to sign-in (allow time for redirect)
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });
    expect(page.url()).toContain('sign-in');
  });
});
