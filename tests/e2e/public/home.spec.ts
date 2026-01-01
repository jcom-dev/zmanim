/**
 * E2E Tests: Home Page (Public)
 *
 * Tests for the public home page functionality:
 * - Page loads and displays correctly
 * - Location browsing works
 * - Search functionality
 * - Navigation elements are present
 */

import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Home Page', () => {
  test('home page loads with title', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see the main heading with title
    await expect(page.locator('body')).toContainText(/shtetl zmanim/i, { timeout: 15000 });
  });

  test('home page displays location selection', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see location selection UI
    await expect(page.locator('body')).toContainText(/select|location|continent/i, { timeout: 15000 });
  });

  test('home page has search input for localities', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see a search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 15000 });
  });

  test('home page has Use My Location button', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see "Use My Location" button
    await expect(page.getByRole('button', { name: /use my location/i })).toBeVisible({ timeout: 15000 });
  });

  test('home page has navigation elements', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see Sign In button (for non-authenticated users)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 15000 });
  });

  test('home page has footer', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should have footer element
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });
  });

  test('can interact with location selection', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Look for clickable location elements (continents, countries, etc.)
    const locationButtons = page.locator('button').filter({ hasText: /america|europe|asia|africa|australia/i });

    // If continent buttons exist, click one
    if (await locationButtons.first().isVisible({ timeout: 5000 })) {
      await locationButtons.first().click();
      await waitForClientReady(page);

      // Should update the UI after clicking
      await expect(page.locator('body')).toContainText(/select|country|state|region/i, { timeout: 15000 });
    }
  });

  test('breadcrumb or navigation exists', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should have some navigation breadcrumb or location indicator
    await expect(page.locator('body')).toContainText(/select.*location|home|browse/i, { timeout: 15000 });
  });
});
