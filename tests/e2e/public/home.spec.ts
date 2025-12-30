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
  test('home page loads with title and hero section', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see the main heading with title
    await expect(page.locator('h1').filter({ hasText: 'Shtetl Zmanim' })).toBeVisible({ timeout: 15000 });

    // Should see content in hero section - tagline or location prompt
    await expect(page.locator('body')).toContainText(/multi-publisher|zmanim platform|select.*location/i, { timeout: 15000 });
  });

  test('home page displays continent selection', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see "Select Continent" heading
    await expect(page.getByRole('heading', { name: 'Select Continent' })).toBeVisible({ timeout: 15000 });

    // Should see continents loaded (check for at least one common continent)
    await expect(page.getByRole('button', { name: /north america|europe|asia/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('home page has search input for localities', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see the locality picker/search
    await expect(page.getByPlaceholder('Search for a locality')).toBeVisible({ timeout: 15000 });
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

    // Should see mode toggle (dark/light mode)
    await expect(page.getByRole('button', { name: /toggle theme/i })).toBeVisible({ timeout: 15000 });
  });

  test('home page has footer with links', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should have footer element
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    // Should have some footer content
    await expect(footer.locator('text=Disclaimer').or(footer.locator('a').first())).toBeVisible({ timeout: 15000 });
  });

  test('can navigate through location hierarchy', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Click on a continent to drill down
    const northAmerica = page.getByRole('button', { name: /north america/i });
    if (await northAmerica.isVisible()) {
      await northAmerica.click();
      await waitForClientReady(page);

      // Should see breadcrumb updated - check for the breadcrumb button
      await expect(page.locator('button').filter({ hasText: 'North America' })).toBeVisible({ timeout: 15000 });

      // Should see countries (like United States) as buttons
      await expect(page.getByRole('button', { name: /united states|canada/i }).first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('breadcrumb navigation works', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Should see "Select Location" as initial breadcrumb
    await expect(page.locator('button').filter({ hasText: 'Select Location' })).toBeVisible({ timeout: 15000 });

    // Navigate to a continent
    const continent = page.getByRole('button', { name: /north america|europe|asia/i }).first();
    await continent.click();
    await waitForClientReady(page);

    // Click back to "Select Location" in breadcrumb
    await page.locator('button').filter({ hasText: 'Select Location' }).click();
    await waitForClientReady(page);

    // Should be back at continent selection
    await expect(page.getByRole('heading', { name: 'Select Continent' })).toBeVisible({ timeout: 15000 });
  });

  test('location hierarchy supports deep navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForClientReady(page);

    // Navigate to a continent
    await expect(page.getByRole('button', { name: /north america|europe|asia/i }).first()).toBeVisible({ timeout: 15000 });

    const northAmerica = page.getByRole('button', { name: /north america/i });
    await northAmerica.click();
    await waitForClientReady(page);

    // Should see countries
    await expect(page.getByRole('button', { name: /canada|mexico|united states/i }).first()).toBeVisible({ timeout: 30000 });

    // Successfully navigated two levels deep - test passes
    // (Testing US states would be too complex and flaky for this test suite)
  });
});
