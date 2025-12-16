import { test, expect } from '@playwright/test';
import { pages, TIMEOUTS, testData } from './helpers/mcp-playwright';

/**
 * Authentication E2E Tests
 *
 * These tests verify the authentication flow including:
 * - Sign-in page functionality
 * - Sign-up page functionality
 * - Protected routes
 */

// Enable parallel execution (Story 5.14)
test.describe.configure({ mode: 'parallel' });

test.describe('Authentication - Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pages.signIn);
    await page.waitForLoadState('networkidle');
  });

  test('should load sign-in page', async ({ page }) => {
    // Verify page loads
    const response = await page.goto(pages.signIn);
    expect(response?.status()).toBe(200);

    // Check for Clerk component
    await expect(page).toHaveTitle(/Sign in/i);
  });

  test('should display Clerk sign-in component', async ({ page }) => {
    // Wait for Clerk to load
    await page.waitForTimeout(TIMEOUTS.SHORT);

    // Clerk components should be present in the DOM
    const clerkContainer = page.locator('[data-clerk-id]').first();
    await expect(clerkContainer).toBeVisible({ timeout: TIMEOUTS.MEDIUM });
  });
});

test.describe('Authentication - Sign Up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pages.signUp);
    await page.waitForLoadState('networkidle');
  });

  test('should load sign-up page', async ({ page }) => {
    // Verify page loads
    const response = await page.goto(pages.signUp);
    expect(response?.status()).toBe(200);

    // Check for Clerk component
    await expect(page).toHaveTitle(/Sign up/i);
  });
});

test.describe('Authentication - Protected Routes', () => {
  test('should redirect to sign-in when accessing publisher dashboard without auth', async ({ page }) => {
    // Try to access publisher dashboard
    await page.goto(pages.publisher);

    // Should be redirected to sign-in
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

    // Verify we're on sign-in page
    expect(page.url()).toContain('sign-in');
  });

  test('should allow access to home page without auth', async ({ page }) => {
    // Navigate to home
    const response = await page.goto(pages.home);

    // Should load successfully
    expect(response?.status()).toBe(200);

    // Should stay on home page
    expect(page.url()).toBe(pages.home);
  });
});

test.describe('Authentication - Clerk Integration', () => {
  test('should load Clerk JavaScript', async ({ page }) => {
    await page.goto(pages.home);

    // Check for Clerk script
    const clerkScript = page.locator('script[data-clerk-js-script]');
    await expect(clerkScript).toHaveAttribute('src', expect.stringContaining('clerk'));
  });

  test('should have Clerk publishable key configured', async ({ page }) => {
    await page.goto(pages.home);

    // Check for Clerk script with publishable key
    const clerkScript = page.locator('script[data-clerk-js-script]');
    await expect(clerkScript).toHaveAttribute(
      'data-clerk-publishable-key',
      expect.stringMatching(/^pk_/)
    );
  });
});
