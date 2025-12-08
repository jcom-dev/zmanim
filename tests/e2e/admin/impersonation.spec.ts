/**
 * E2E Tests: Admin Impersonation
 *
 * Tests for admin impersonation functionality:
 * - Starting impersonation from publisher details
 * - Viewing publisher dashboard as admin
 * - Impersonation banner visibility and functionality
 * - Exiting impersonation via banner button
 * - Session storage state management
 * - Navigation while impersonating
 *
 * Impersonation Concept:
 * Impersonation allows admins to view the platform as if they were a specific publisher.
 * This is crucial for:
 * - Debugging publisher-specific issues
 * - Verifying publisher data and settings
 * - Providing support without asking for screenshots
 *
 * Technical Implementation:
 * - State stored in sessionStorage (persists across page reloads within tab)
 * - ImpersonationBanner component shows yellow warning bar
 * - PublisherContext manages impersonation state
 * - X-Publisher-Id header is set to impersonated publisher's ID
 */

import { test, expect } from '@playwright/test';
import {
  getSharedPublisherAsync,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
// Uses shared fixtures (pre-created publishers) for parallel safety
test.describe.configure({ mode: 'parallel' });

test.describe('Admin Impersonation', () => {
  // Use shared fixtures - pre-created publishers that are safe for parallel tests
  // Each test gets its own shared publisher to avoid state conflicts
  // These publishers are created in global-setup and cleaned up in global-teardown
  //
  // NOTE: Authentication is handled via Playwright storage state.
  // The 'chromium-admin' and 'mobile-chrome-admin' projects use pre-authenticated
  // storage state created by the setup project. No need to call loginAsAdmin().

  test('admin can click impersonate button on publisher details', async ({ page }) => {
    // Get a shared publisher for this test - use async version to ensure proper UUID
    const testPublisher = await getSharedPublisherAsync('verified-1');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should see impersonation button - tooltip says "View as publisher"
    const impersonateButton = page.getByRole('button', { name: /view as publisher/i });
    await expect(impersonateButton).toBeVisible();

    // Click impersonate
    await impersonateButton.click();

    // Should navigate to publisher dashboard
    await page.waitForURL('**/publisher/dashboard');
    expect(page.url()).toContain('/publisher/dashboard');
  });

  test('impersonation stores state in session storage', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-2');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click impersonate
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');

    // Check session storage - this is how impersonation persists across page reloads
    const impersonating = await page.evaluate(() => {
      return sessionStorage.getItem('impersonating');
    });

    expect(impersonating).toBeTruthy();
    const parsed = JSON.parse(impersonating!);
    expect(parsed.publisherId).toBe(String(testPublisher.id));
    expect(parsed.publisher).toBeDefined();
    expect(parsed.publisher.name).toBe(testPublisher.name);
  });

  test('impersonation banner is visible while impersonating', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-3');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click impersonate
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see the yellow impersonation banner with publisher name
    await expect(page.getByText(/impersonating/i)).toBeVisible();
    await expect(page.getByText(testPublisher.name)).toBeVisible();

    // Should see Exit button in banner
    await expect(page.getByRole('button', { name: /exit/i })).toBeVisible();
  });

  test('admin can view publisher dashboard while impersonating', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-4');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click impersonate
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');
    await page.waitForLoadState('networkidle');

    // Should see dashboard content
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Should see the impersonated publisher's name in the dashboard
    await expect(page.getByText(testPublisher.name).first()).toBeVisible();
  });

  test('admin can exit impersonation via banner Exit button', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-5');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');
    await page.waitForLoadState('networkidle');

    // Click Exit button in the impersonation banner
    await page.getByRole('button', { name: /exit/i }).click();

    // Should navigate back to admin publisher details page
    await page.waitForURL(`**/admin/publishers/${testPublisher.id}`);
    expect(page.url()).toContain(`/admin/publishers/${testPublisher.id}`);

    // Impersonation banner should no longer be visible
    await expect(page.getByText(/impersonating/i)).not.toBeVisible();
  });

  test('session storage is cleared on exit impersonation', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('with-algorithm-1');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');

    // Verify impersonation is stored
    let impersonating = await page.evaluate(() => sessionStorage.getItem('impersonating'));
    expect(impersonating).toBeTruthy();

    // Exit via banner
    await page.getByRole('button', { name: /exit/i }).click();
    await page.waitForURL('**/admin/publishers/**');

    // Session storage should be cleared
    impersonating = await page.evaluate(() => sessionStorage.getItem('impersonating'));
    expect(impersonating).toBeNull();
  });

  test('admin can navigate to different publisher pages while impersonating', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('with-algorithm-2');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');

    // Navigate to profile - impersonation should persist
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Should still be on publisher pages
    expect(page.url()).toContain('/publisher/profile');

    // Impersonation banner should still be visible
    await expect(page.getByText(/impersonating/i)).toBeVisible();
    await expect(page.getByText(testPublisher.name).first()).toBeVisible();
  });

  test('impersonation persists after page reload', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('with-coverage');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');
    await page.waitForLoadState('networkidle');

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Impersonation should persist (session storage survives reload)
    await expect(page.getByText(/impersonating/i)).toBeVisible();
    await expect(page.getByText(testPublisher.name).first()).toBeVisible();
  });

  test('admin can access algorithm page while impersonating', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-1');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');

    // Navigate to algorithm page
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Should be on algorithm page
    expect(page.url()).toContain('/publisher/algorithm');

    // Impersonation banner should still be visible
    await expect(page.getByText(/impersonating/i)).toBeVisible();
  });

  test('admin can access coverage page while impersonating', async ({ page }) => {
    const testPublisher = await getSharedPublisherAsync('verified-2');

    await page.goto(`${BASE_URL}/admin/publishers/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Start impersonation
    await page.getByRole('button', { name: /view as publisher/i }).click();
    await page.waitForURL('**/publisher/dashboard');

    // Navigate to coverage page
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    // Should be on coverage page
    expect(page.url()).toContain('/publisher/coverage');

    // Impersonation banner should still be visible
    await expect(page.getByText(/impersonating/i)).toBeVisible();
  });
});
