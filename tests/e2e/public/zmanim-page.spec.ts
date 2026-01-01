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

// Test with a known locality ID (Jerusalem = 281184)
const TEST_LOCALITY_ID = '281184';

test.describe('Public Zmanim Page', () => {
  test('zmanim locality page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show some content (locality name, zmanim, or publisher selection)
    await expect(page.locator('body')).toContainText(/zmanim|publisher|location|jerusalem/i, { timeout: 15000 });
  });

  test('zmanim page has change location link', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have "Change location" link
    await expect(page.locator('body')).toContainText(/change.*location/i, { timeout: 15000 });
  });

  test('zmanim page shows publisher or coverage info', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show either publisher selection or coverage info
    await expect(page.locator('body')).toContainText(/publisher|authority|coverage|select|default/i, { timeout: 15000 });
  });

  test('zmanim page has theme toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have dark/light mode toggle
    await expect(page.getByRole('button', { name: /toggle theme/i })).toBeVisible({ timeout: 15000 });
  });

  test('clicking change location navigates to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Find and click change location link
    const changeLocationLink = page.getByText(/change.*location/i);
    if (await changeLocationLink.isVisible({ timeout: 5000 })) {
      await changeLocationLink.click();
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

  test('zmanim page shows action options', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show some action options (view zmanim, select publisher, etc.)
    const hasActions = await page.locator('button, a').filter({ hasText: /view|select|default|zmanim/i }).first().isVisible({ timeout: 10000 });
    expect(hasActions).toBeTruthy();
  });

  test('zmanim page has footer', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });
  });
});
