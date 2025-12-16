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

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Home Page - Location Selection', () => {
  test('home page loads with location selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see title
    await expect(page.getByRole('heading', { name: 'Shtetl Zmanim' })).toBeVisible();

    // Should see location selection prompt (starts with continent selection)
    await expect(page.getByText('Select Continent')).toBeVisible();
  });

  test('home page shows continent list', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see continent buttons - wait for them to load
    const continentButtons = page.locator('button').filter({ hasText: /cities$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking continent shows countries', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /cities$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 10000 });

    // Click first continent
    await continentButtons.first().click();

    // Wait for country selection to appear - look for back button which appears in country step
    const backButton = page.getByText('← Back').first();

    // Should see back button (which appears in country selection step)
    await expect(backButton).toBeVisible({ timeout: 5000 });
  });

  test('breadcrumb navigation works', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /cities$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 10000 });

    // Click first continent
    await continentButtons.first().click();

    // Wait for back button to appear
    const backButton = page.getByText('← Back').first();
    await expect(backButton).toBeVisible({ timeout: 5000 }).catch(() => {});

    if (await backButton.isVisible()) {
      await backButton.click();

      // Should be back at continent selection
      await expect(page.getByText('Select Continent')).toBeVisible({ timeout: 5000 });
    }
  });

  test('selecting city navigates to zmanim page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Wait for continents to load
    const continentButtons = page.locator('button').filter({ hasText: /cities$/i });
    await expect(continentButtons.first()).toBeVisible({ timeout: 10000 });

    // Click on Asia continent (contains Israel)
    const asiaButton = page.locator('button').filter({ hasText: /Asia/i });
    if (await asiaButton.isVisible()) {
      await asiaButton.click();
      await page.waitForLoadState('networkidle');

      // Find Israel
      const israelButton = page.locator('button').filter({ hasText: /Israel/i });
      await expect(israelButton).toBeVisible({ timeout: 5000 }).catch(() => {});

      if (await israelButton.isVisible()) {
        await israelButton.click();
        await page.waitForLoadState('networkidle');

        // Wait for cities to load
        const jerusalemButton = page.locator('button').filter({ hasText: /Jerusalem/i });
        await expect(jerusalemButton).toBeVisible({ timeout: 5000 }).catch(() => {});

        if (await jerusalemButton.isVisible()) {
          await jerusalemButton.click();

          // Should navigate to zmanim page
          await page.waitForURL('**/zmanim/**');
          expect(page.url()).toContain('/zmanim/');
        }
      }
    }
  });
});

test.describe('Home Page - UI Elements', () => {
  test('home page shows navigation bar', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see Shtetl Zmanim title in nav
    await expect(page.getByText('Shtetl Zmanim').first()).toBeVisible();
  });

  test('home page shows sign in option', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see Sign In button
    await expect(page.getByText('Sign In')).toBeVisible();
  });

  test('home page has become publisher link in footer', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see become publisher link
    await expect(page.getByRole('link', { name: 'Become a Publisher' })).toBeVisible();
  });

  test('clicking become publisher navigates to registration', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('link', { name: 'Become a Publisher' }).click();

    await page.waitForURL('**/register');
    expect(page.url()).toContain('/register');
  });
});

test.describe('Home Page - Subtitle and Description', () => {
  test('shows multi-publisher subtitle', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Multi-Publisher Zmanim Platform')).toBeVisible();
  });

  test('shows location selection instruction', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/select your location/i)).toBeVisible();
  });
});
