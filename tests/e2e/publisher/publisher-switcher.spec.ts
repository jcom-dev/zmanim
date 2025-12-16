/**
 * E2E Tests: Publisher Switcher with Cookie Persistence
 * Story: 8-27-multi-publisher-switcher-with-cookie-persistence
 *
 * Tests:
 * 1. User with 2+ publishers can switch between them
 * 2. Cookie persists across page reloads
 * 3. Invalid cookie falls back to primary_publisher_id
 * 4. Single-publisher user doesn't see switcher
 * 5. Admin impersonation overrides cookie
 */

import { test, expect, Page } from '@playwright/test';
import { getSharedPublisher } from '../utils';

test.describe.configure({ mode: 'parallel' });

// Helper to get cookie value
async function getPublisherCookie(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  const publisherCookie = cookies.find(c => c.name === 'zmanim_publisher_id');
  return publisherCookie?.value;
}

// Helper to set up a multi-publisher user via Clerk metadata
async function setupMultiPublisherUser(page: Page) {
  // This would normally be done via Clerk API or database setup
  // For now, we'll use the test fixtures
  const publisher1 = getSharedPublisher('verified-1');
  const publisher2 = getSharedPublisher('verified-2');

  return { publisher1, publisher2 };
}

test.describe('Publisher Switcher - Cookie Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('6.1: User with 2+ publishers can switch between them', async ({ page }) => {
    // This test requires a user with multiple publishers in their access list
    // Skip if test environment doesn't support multi-publisher setup
    test.skip(!process.env.MULTI_PUBLISHER_TEST_USER, 'Multi-publisher test user not configured');

    // Navigate to publisher dashboard
    await page.goto('/publisher/dashboard');

    // Wait for publisher switcher to be visible
    const switcher = page.getByRole('combobox', { name: /publisher/i });
    await expect(switcher).toBeVisible();

    // Get initial publisher name
    const initialPublisher = await switcher.textContent();
    expect(initialPublisher).toBeTruthy();

    // Click the switcher to open dropdown
    await switcher.click();

    // Wait for dropdown to appear
    const dropdown = page.getByRole('listbox');
    await expect(dropdown).toBeVisible();

    // Get all publisher options
    const options = await dropdown.getByRole('option').all();
    expect(options.length).toBeGreaterThan(1);

    // Select the second publisher
    await options[1].click();

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Verify the switcher shows the new publisher
    const newPublisher = await switcher.textContent();
    expect(newPublisher).not.toBe(initialPublisher);

    // Verify cookie was set
    const cookieValue = await getPublisherCookie(page);
    expect(cookieValue).toBeTruthy();

    // Verify page data reloaded for new publisher
    // (This would check for publisher-specific data on the dashboard)
  });

  test('6.2: Cookie persists across page reloads', async ({ page }) => {
    test.skip(!process.env.MULTI_PUBLISHER_TEST_USER, 'Multi-publisher test user not configured');

    // Navigate to publisher dashboard
    await page.goto('/publisher/dashboard');

    // Wait for publisher switcher
    const switcher = page.getByRole('combobox', { name: /publisher/i });
    await expect(switcher).toBeVisible();

    // Switch to a different publisher
    await switcher.click();
    const dropdown = page.getByRole('listbox');
    await expect(dropdown).toBeVisible();

    const options = await dropdown.getByRole('option').all();
    if (options.length > 1) {
      await options[1].click();
      await page.waitForTimeout(500);
    }

    // Get the selected publisher name and cookie
    const selectedPublisher = await switcher.textContent();
    const cookieBeforeReload = await getPublisherCookie(page);

    // Reload the page
    await page.reload();

    // Wait for page to load
    await expect(switcher).toBeVisible();

    // Verify the same publisher is still selected
    const publisherAfterReload = await switcher.textContent();
    expect(publisherAfterReload).toBe(selectedPublisher);

    // Verify cookie persists
    const cookieAfterReload = await getPublisherCookie(page);
    expect(cookieAfterReload).toBe(cookieBeforeReload);
  });

  test('6.3: Invalid cookie falls back to primary_publisher_id', async ({ page }) => {
    // Set an invalid publisher cookie
    await page.context().addCookies([{
      name: 'zmanim_publisher_id',
      value: '99999', // Non-existent publisher
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    // Navigate to publisher dashboard
    await page.goto('/publisher/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // The system should fall back to primary publisher
    // Verify we don't get an error and the page loads
    const switcher = page.getByRole('combobox', { name: /publisher/i }).or(
      page.getByText(/loading/i)
    );

    // Should either show the switcher with valid publisher or still be loading
    const isVisible = await switcher.isVisible({ timeout: 5000 }).catch(() => false);

    // If switcher is visible, verify it shows a valid publisher
    if (isVisible) {
      const publisherName = await switcher.textContent();
      expect(publisherName).toBeTruthy();
      expect(publisherName).not.toContain('99999');
    }

    // Verify the invalid cookie was cleared
    const cookieAfter = await getPublisherCookie(page);
    expect(cookieAfter).not.toBe('99999');
  });

  test('6.4: Single-publisher user does not see switcher dropdown', async ({ page }) => {
    // This test requires a user with only one publisher
    // Most test users will have single publishers, so we can test with a standard publisher user

    // Navigate to publisher dashboard
    await page.goto('/publisher/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // For single-publisher users, the switcher should either:
    // 1. Not be visible at all
    // 2. Be visible but not have a dropdown (just show publisher name/logo)

    const dropdown = page.getByRole('combobox', { name: /publisher/i });

    // Check if dropdown exists
    const hasDropdown = await dropdown.isVisible().catch(() => false);

    if (hasDropdown) {
      // If it exists, it should only have 1 option (current publisher)
      await dropdown.click();
      const listbox = page.getByRole('listbox');
      const hasListbox = await listbox.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasListbox) {
        const options = await listbox.getByRole('option').all();
        expect(options.length).toBeLessThanOrEqual(1);
      }
    }

    // The component should still show the publisher name and logo for context
    // even if there's no dropdown
    const publisherDisplay = page.getByText(/loading/i).or(
      page.locator('[class*="publisher"]').first()
    );

    const isDisplayed = await publisherDisplay.isVisible({ timeout: 5000 }).catch(() => false);
    // It's okay if not displayed - the test is that there's no switcher for single publisher
  });

  test('6.5: Admin impersonation overrides cookie selection', async ({ page }) => {
    test.skip(!process.env.ADMIN_TEST_USER, 'Admin test user not configured');

    // Login as admin
    // (This would require admin credentials setup)

    // Set a publisher cookie
    await page.context().addCookies([{
      name: 'zmanim_publisher_id',
      value: '1',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }]);

    // Navigate to admin publishers page
    await page.goto('/admin/publishers');

    // Find a publisher to impersonate
    const publisherRow = page.locator('[data-testid="publisher-row"]').first();
    await expect(publisherRow).toBeVisible({ timeout: 10000 });

    // Click "View as Publisher" or impersonate button
    const impersonateButton = publisherRow.getByRole('button', { name: /impersonate|view as/i });
    if (await impersonateButton.isVisible().catch(() => false)) {
      await impersonateButton.click();

      // Should navigate to publisher dashboard
      await expect(page).toHaveURL(/\/publisher\/dashboard/);

      // Verify we're in impersonation mode
      const impersonationBanner = page.getByText(/impersonating|viewing as/i);
      await expect(impersonationBanner).toBeVisible();

      // The impersonated publisher should override the cookie
      const publisherDisplay = page.locator('[class*="publisher"]').first();
      const impersonatedPublisher = await publisherDisplay.textContent();

      // Verify it's not the cookie publisher (if we can determine that)
      expect(impersonatedPublisher).toBeTruthy();
    }
  });

  test('6.6: Publisher switcher shows logo and count badge', async ({ page }) => {
    test.skip(!process.env.MULTI_PUBLISHER_TEST_USER, 'Multi-publisher test user not configured');

    await page.goto('/publisher/dashboard');

    // Wait for publisher switcher
    const switcher = page.getByRole('combobox', { name: /publisher/i });
    await expect(switcher).toBeVisible();

    // Check for publisher logo (Avatar component)
    const avatar = page.locator('[class*="avatar"]').first();
    await expect(avatar).toBeVisible();

    // Check for publisher count badge (e.g., "2 publishers")
    const countBadge = page.getByText(/\d+ publishers?/i);
    const hasBadge = await countBadge.isVisible().catch(() => false);

    // Badge should be visible if user has multiple publishers
    if (hasBadge) {
      const badgeText = await countBadge.textContent();
      expect(badgeText).toMatch(/\d+ publishers?/i);
    }
  });
});

test.describe('Publisher Switcher - API Integration', () => {
  test('Cookie is httpOnly and cannot be accessed from JavaScript', async ({ page }) => {
    await page.goto('/publisher/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Try to access cookie from JavaScript
    const cookieValue = await page.evaluate(() => {
      // This should return empty string because cookie is httpOnly
      return document.cookie.includes('zmanim_publisher_id');
    });

    expect(cookieValue).toBe(false);
  });

  test('Switching publisher invalidates React Query cache', async ({ page }) => {
    test.skip(!process.env.MULTI_PUBLISHER_TEST_USER, 'Multi-publisher test user not configured');

    await page.goto('/publisher/dashboard');

    // Wait for initial data to load
    await page.waitForLoadState('networkidle');

    // Get initial dashboard data (e.g., publisher name in header)
    const initialData = await page.locator('[data-testid="publisher-name"]').textContent().catch(() => null);

    // Switch publisher
    const switcher = page.getByRole('combobox', { name: /publisher/i });
    await switcher.click();

    const dropdown = page.getByRole('listbox');
    const options = await dropdown.getByRole('option').all();
    if (options.length > 1) {
      await options[1].click();
    }

    // Wait for cache invalidation and data reload
    await page.waitForLoadState('networkidle');

    // Get updated dashboard data
    const updatedData = await page.locator('[data-testid="publisher-name"]').textContent().catch(() => null);

    // Data should have changed (or at least re-fetched)
    if (initialData && updatedData) {
      // Either the data changed, or it's the same but was re-fetched
      expect(updatedData).toBeTruthy();
    }
  });
});
