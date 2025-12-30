import { test, expect } from '@playwright/test';
import { pages, selectors, TIMEOUTS } from './helpers/mcp-playwright';
import { waitForClientReady } from './utils/hydration-helpers';

/**
 * Home Page E2E Tests
 *
 * These tests verify the home page functionality including:
 * - Page loads correctly
 * - Content is displayed
 * - Navigation works
 */

// Enable parallel execution (Story 5.14)
test.describe.configure({ mode: 'parallel' });

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto(pages.home);
    await waitForClientReady(page);
  });

  test('should load the home page successfully', async ({ page }) => {
    // Verify page title
    await expect(page).toHaveTitle(/Shtetl Zmanim/, { timeout: 15000 });
  });

  test('should display main heading and branding', async ({ page }) => {
    // Check for main heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).toContainText('Shtetl Zmanim');
  });

  test('should display subtitle', async ({ page }) => {
    // Check for subtitle - use first occurrence (in hero section)
    const subtitle = page.locator('p').filter({ hasText: 'Multi-Publisher Zmanim Platform' }).first();
    await expect(subtitle).toBeVisible({ timeout: 15000 });
  });

  test('should display description text', async ({ page }) => {
    // Check for description - updated text from current UI
    const description = page.getByText(/Select your location to view Zmanim/i);
    await expect(description).toBeVisible({ timeout: 15000 });
  });

  test('should show location selection UI', async ({ page }) => {
    // Check for location selection heading
    const locationHeading = page.getByText('Select Location');
    await expect(locationHeading).toBeVisible({ timeout: 15000 });
  });

  test('should have proper meta tags', async ({ page }) => {
    // Check meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute(
      'content',
      expect.stringContaining('Halachic Authorities')
    );

    // Check meta author
    const metaAuthor = page.locator('meta[name="author"]');
    await expect(metaAuthor).toHaveAttribute('content', 'Shtetl Zmanim');

    // Check theme color
    const metaTheme = page.locator('meta[name="theme-color"]');
    await expect(metaTheme).toHaveAttribute('content', '#3b82f6');
  });

  test('should display footer', async ({ page }) => {
    // Check for footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    // Check footer text - look specifically in footer element
    const footerText = footer.locator('text=Shtetl Zmanim - Multi-Publisher Zmanim Platform');
    await expect(footerText).toBeVisible({ timeout: 15000 });
  });
});
