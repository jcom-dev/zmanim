/**
 * E2E Tests: Location Selection
 *
 * Tests for home page location selection:
 * - Country selection
 * - Region selection
 * - City selection
 * - Navigation to zmanim page
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Home Page - Location Selection', () => {
  test('home page loads with location selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see title
    await expect(page.getByRole('heading', { name: 'Shtetl Zmanim' })).toBeVisible({ timeout: 15000 });

    // Should see location selection heading in breadcrumb area
    await expect(page.getByText('Select Location')).toBeVisible({ timeout: 15000 });
  });

  test('home page shows continent list', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see continent selection heading
    await expect(page.getByText('Select Continent')).toBeVisible({ timeout: 15000 });

    // Should see continent buttons with location counts
    const continentButtons = page.locator('button').filter({ hasText: /locations?$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 15000 });
  });

  test('breadcrumb navigation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /locations?$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 15000 });

    // Click first continent
    await continentButtons.first().click();
    await waitForClientReady(page);

    // Wait for country list to load
    await expect(page.locator('button').filter({ hasText: /locations?$/i }).first()).toBeVisible({ timeout: 15000 });

    // Click "Select Location" breadcrumb to go back to continents
    const selectLocationBreadcrumb = page.locator('button').filter({ hasText: 'Select Location' });
    await expect(selectLocationBreadcrumb).toBeVisible({ timeout: 15000 });
    await selectLocationBreadcrumb.click();

    // Should be back at continent selection
    await expect(page.getByText('Select Continent')).toBeVisible({ timeout: 15000 });
  });

});

test.describe('Home Page - UI Elements', () => {
  test('home page shows navigation bar', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see Shtetl Zmanim title in nav
    await expect(page.getByText('Shtetl Zmanim').first()).toBeVisible({ timeout: 15000 });
  });

});
