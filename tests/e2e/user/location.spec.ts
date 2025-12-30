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

  test('clicking continent shows countries', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /locations?$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 15000 });

    // Click first continent
    await continentButtons.first().click();
    await waitForClientReady(page);

    // Wait for country list to load - countries will have location counts
    await expect(page.locator('button').filter({ hasText: /locations?$/i }).first()).toBeVisible({ timeout: 15000 });

    // Breadcrumb should update to show continent name
    await expect(page.locator('button').filter({ hasText: /Select Location in/ })).toBeVisible({ timeout: 15000 });
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

  test('selecting city navigates to zmanim page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /locations?$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 15000 });

    // Click on Asia continent (contains Israel)
    const asiaButton = page.locator('button').filter({ hasText: /Asia/i });
    await expect(asiaButton).toBeVisible({ timeout: 15000 });
    await asiaButton.click();
    await waitForClientReady(page);

    // Find Israel
    const israelButton = page.locator('button').filter({ hasText: /Israel/i });
    await expect(israelButton).toBeVisible({ timeout: 15000 });
    await israelButton.click();
    await waitForClientReady(page);

    // Wait for cities to load - click first Jerusalem button (city, not district)
    const jerusalemButton = page.getByRole('button', { name: /^Jerusalem\s+\d+\s+locations?$/i }).first();
    await expect(jerusalemButton).toBeVisible({ timeout: 15000 });
    await jerusalemButton.click();

    // Should navigate to zmanim page
    await page.waitForURL('**/zmanim/**', { timeout: 15000 });
    expect(page.url()).toContain('/zmanim/');
  });
});

test.describe('Home Page - UI Elements', () => {
  test('home page shows navigation bar', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see Shtetl Zmanim title in nav
    await expect(page.getByText('Shtetl Zmanim').first()).toBeVisible({ timeout: 15000 });
  });

  test('home page shows sign in option', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see Sign In button
    await expect(page.getByText('Sign In')).toBeVisible({ timeout: 15000 });
  });

  test('home page has become publisher link in footer', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Should see become publisher link
    await expect(page.getByRole('link', { name: 'Become a Publisher' })).toBeVisible({ timeout: 15000 });
  });

  test('clicking become publisher navigates to registration', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    await page.getByRole('link', { name: 'Become a Publisher' }).click();

    await page.waitForURL('**/register', { timeout: 15000 });
    expect(page.url()).toContain('/register');
  });
});

test.describe('Home Page - Subtitle and Description', () => {
  test('shows multi-publisher subtitle', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    await expect(page.getByText('Multi-Publisher Zmanim Platform').first()).toBeVisible({ timeout: 15000 });
  });

  test('shows location selection instruction', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    await expect(page.getByText(/select your location/i)).toBeVisible({ timeout: 15000 });
  });
});
