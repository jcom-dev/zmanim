import { test, expect } from '@playwright/test';
import { pages, selectors, TIMEOUTS } from './helpers/mcp-playwright';

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
    await page.waitForLoadState('networkidle');
  });

  test('should load the home page successfully', async ({ page }) => {
    // Verify page loads with 200 status
    const response = await page.goto(pages.home);
    expect(response?.status()).toBe(200);

    // Verify page title
    await expect(page).toHaveTitle(/Shtetl Zmanim/);
  });

  test('should display main heading and branding', async ({ page }) => {
    // Check for main heading
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Shtetl Zmanim');

    // Check for emoji icon
    const icon = page.locator('span').filter({ hasText: '🕍' });
    await expect(icon).toBeVisible();
  });

  test('should display subtitle', async ({ page }) => {
    // Check for subtitle
    const subtitle = page.locator('p').filter({ hasText: 'Multi-Publisher Zmanim Platform' });
    await expect(subtitle).toBeVisible();
  });

  test('should display description text', async ({ page }) => {
    // Check for description
    const description = page.getByText(/Choose your preferred halachic authority/i);
    await expect(description).toBeVisible();
  });

  test('should show loading state for publishers', async ({ page }) => {
    // Check for loading indicator
    const loadingText = page.getByText(/Loading publishers/i);
    await expect(loadingText).toBeVisible({ timeout: TIMEOUTS.SHORT });
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
    await expect(footer).toBeVisible();

    // Check footer text
    const footerText = page.getByText(/Multi-Publisher Prayer Times Platform/i);
    await expect(footerText).toBeVisible();
  });
});
