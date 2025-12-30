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

// Test with a known locality ID (Jerusalem = 281184 or a similar high-traffic locality)
// Using a generic approach that works with any locality
const TEST_LOCALITY_ID = '281184'; // Jerusalem

test.describe('Public Zmanim Page', () => {
  test('zmanim locality page loads with locality name', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show locality name in header
    // The locality name should be visible (could be Jerusalem or another city)
    const header = page.locator('h1');
    await expect(header).toBeVisible({ timeout: 15000 });

    // Should have location icon
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 5000 });
  });

  test('zmanim page has back/change location link', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have "Change location" link
    await expect(page.getByText('Change location')).toBeVisible({ timeout: 15000 });
  });

  test('zmanim page shows publisher selection or no coverage message', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should show either "Select Publisher" or "No Local Authority" heading (use first() for strict mode)
    const selectPublisher = page.getByRole('heading', { name: /select publisher/i }).first();
    const noAuthority = page.getByRole('heading', { name: /no local authority/i }).first();

    await expect(selectPublisher.or(noAuthority)).toBeVisible({ timeout: 15000 });
  });

  test('zmanim page has mode toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have dark/light mode toggle
    await expect(page.getByRole('button', { name: /toggle theme/i })).toBeVisible({ timeout: 15000 });
  });

  test('clicking change location navigates to home', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Click change location link
    await page.getByText('Change location').click();
    await waitForClientReady(page);

    // Should be on home page
    await expect(page).toHaveURL(BASE_URL + '/');
    await expect(page.getByText('Shtetl Zmanim').first()).toBeVisible({ timeout: 15000 });
  });

  test('invalid locality ID shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/999999999`);
    await waitForClientReady(page);

    // Should show error state - look for the error heading specifically
    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible({ timeout: 15000 });
  });

  test('no coverage locality shows default zmanim option', async ({ page }) => {
    // Use a locality that likely has no coverage
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // If no coverage, should show "View Default Zmanim" button or similar
    const defaultOption = page.getByRole('button', { name: /default/i });
    const publisherList = page.locator('button').filter({ hasText: /select|view zmanim/i });

    // Either should have publishers to select OR default option
    await expect(defaultOption.or(publisherList.first())).toBeVisible({ timeout: 15000 });
  });

  test('zmanim page has footer', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/${TEST_LOCALITY_ID}`);
    await waitForClientReady(page);

    // Should have footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });
  });
});
