/**
 * E2E Tests: Not Found / 404 Handling
 *
 * Tests for handling non-existent resources:
 * - Invalid publisher ID
 * - Invalid city ID
 * - Non-existent pages
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Not Found - Admin Routes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('invalid publisher ID shows appropriate error', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/publishers/invalid-uuid-here`);
    await page.waitForLoadState('networkidle');

    // Should show error or not found message
    const pageContent = await page.textContent('body');
    const hasError =
      pageContent?.toLowerCase().includes('not found') ||
      pageContent?.toLowerCase().includes('error') ||
      pageContent?.toLowerCase().includes("doesn't exist");

    expect(hasError).toBe(true);
  });

  test('non-existent UUID publisher shows not found', async ({ page }) => {
    // Use a valid UUID format but non-existent
    await page.goto(`${BASE_URL}/admin/publishers/00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle');

    const pageContent = await page.textContent('body');
    const hasError =
      pageContent?.toLowerCase().includes('not found') ||
      pageContent?.toLowerCase().includes('error');

    expect(hasError).toBe(true);
  });
});

test.describe('Not Found - Public Routes', () => {
  test('invalid city ID on zmanim page handles gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/invalid-city-id`);
    await page.waitForLoadState('networkidle');

    // Should show error or empty state
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Should not crash - page should render something
    const hasContent = pageContent!.length > 100;
    expect(hasContent).toBe(true);
  });

  test('non-existent page shows 404', async ({ page }) => {
    await page.goto(`${BASE_URL}/this-page-does-not-exist`);
    await page.waitForLoadState('networkidle');

    // Should show 404 page or redirect to home
    const pageContent = await page.textContent('body');
    const is404 =
      pageContent?.includes('404') ||
      pageContent?.toLowerCase().includes('not found') ||
      page.url() === `${BASE_URL}/`;

    expect(is404).toBe(true);
  });
});

test.describe('Not Found - API Error Handling', () => {
  test('admin publishers page handles API errors gracefully', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to publishers page
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Page should load even if API has issues
    // Should show either data or a retry option
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Should have some UI rendered
    const hasUI =
      pageContent?.toLowerCase().includes('publisher') ||
      pageContent?.toLowerCase().includes('retry') ||
      pageContent?.toLowerCase().includes('loading');

    expect(hasUI).toBe(true);
  });
});
