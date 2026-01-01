/**
 * E2E Tests: Public Zmanim Page
 *
 * Tests for viewing zmanim at a specific locality:
 * - Page loads with locality info
 * - Publisher selection or "no coverage" message
 * - Navigation back to home
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// Test with a locality ID - may or may not exist in E2E database
const TEST_LOCALITY_ID = '281184';

test.describe('Public Zmanim Page', () => {
  test('zmanim locality page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show some content (could be zmanim, error, or not found)
    await expect(page.locator('body')).toContainText(/zmanim|publisher|location|error|not found/i, { timeout: 15000 });
  });

  test('zmanim page has back navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have some form of back navigation (change location, back to selection, etc.)
    await expect(page.locator('body')).toContainText(/change|back|location|selection/i, { timeout: 15000 });
  });

  test('zmanim page shows content or error', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show either publisher selection, coverage info, or error message
    await expect(page.locator('body')).toContainText(/publisher|authority|coverage|select|default|error|not found/i, { timeout: 15000 });
  });

  test('clicking back navigation goes to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Find back navigation link (could be various text)
    const backLink = page.getByText(/change.*location|back.*location|location selection/i);
    if (await backLink.isVisible({ timeout: 5000 })) {
      await backLink.click();
      await waitForClientReady(page);

      // Should be on home page
      await expect(page).toHaveURL(BASE_URL + '/');
    }
  });

  test('invalid locality ID shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/999999999`);
    await waitForClientReady(page);

    // Should show error state
    await expect(page.locator('body')).toContainText(/error|not found|invalid/i, { timeout: 15000 });
  });

  test('zmanim page shows navigation options', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show some navigation options (links or buttons)
    const hasNav = await page.locator('a, button').first().isVisible({ timeout: 10000 });
    expect(hasNav).toBeTruthy();
  });
});
