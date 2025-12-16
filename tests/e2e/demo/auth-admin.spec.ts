/**
 * Demo Test: Admin Authentication
 *
 * Verifies that the loginAsAdmin() helper works correctly
 * and admin can access protected routes.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL, TIMEOUTS } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Authentication Demo', () => {
  test('admin can login and access /admin route', async ({ page }) => {
    // Login as admin using our helper
    await loginAsAdmin(page);

    // Navigate to admin dashboard
    await page.goto(`${BASE_URL}/admin`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we're on an admin page (not redirected to sign-in)
    const url = page.url();
    expect(url).not.toContain('sign-in');

    // Check for admin-specific content
    // The page should have some admin indicator
    const pageContent = await page.textContent('body');

    // Should have some admin content (adjust based on actual page content)
    // This is a basic check - actual content will vary
    expect(
      url.includes('/admin') ||
        pageContent?.toLowerCase().includes('admin') ||
        pageContent?.toLowerCase().includes('publisher')
    ).toBe(true);
  });

  test('admin can access /admin/publishers', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);

    // Navigate to publishers management
    await page.goto(`${BASE_URL}/admin/publishers`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should not be redirected to sign-in
    expect(page.url()).not.toContain('sign-in');

    // Should be on publishers page
    expect(page.url()).toContain('/admin/publishers');
  });

  test('admin session persists across navigation', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);

    // Navigate to admin dashboard
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Navigate to publishers
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Navigate back to dashboard
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (not redirected)
    expect(page.url()).not.toContain('sign-in');
  });
});
