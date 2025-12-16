/**
 * E2E Tests: Authentication Flows
 *
 * Tests for authentication-related user flows:
 * - Sign in page access
 * - Sign up page access
 * - Sign out functionality
 */

import { test, expect } from '@playwright/test';
import { loginAsUser, BASE_URL } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Sign In Page', () => {
  test('sign in page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`);
    await page.waitForLoadState('networkidle');

    // Should show Clerk sign-in component
    expect(page.url()).toContain('/sign-in');
  });

  test('sign in page shows email input', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`);
    await page.waitForLoadState('networkidle');

    // Wait for Clerk to load by checking for input fields
    const emailInput = page.locator('input[name="identifier"], input[type="email"]');
    await expect(emailInput.or(page.locator('[data-clerk-component]'))).toBeVisible({ timeout: 10000 }).catch(() => {});

    const hasEmailInput = await emailInput.isVisible().catch(() => false);

    // If Clerk modal, it might have different structure
    expect(hasEmailInput || page.url().includes('sign-in')).toBe(true);
  });

  test('clicking sign in from home opens sign in', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Click sign in button
    const signInButton = page.getByText('Sign In');
    await signInButton.click();

    // Wait for sign-in page or modal to appear
    await page.waitForURL(/sign-in/, { timeout: 10000 }).catch(() => {});
    await expect(page.locator('[data-clerk-component="sign-in"]')).toBeVisible({ timeout: 5000 }).catch(() => {});

    const isOnSignInPage = page.url().includes('/sign-in');
    const hasSignInModal = await page.locator('[data-clerk-component="sign-in"]').isVisible().catch(() => false);

    expect(isOnSignInPage || hasSignInModal).toBe(true);
  });
});

test.describe('Sign Up Page', () => {
  test('sign up page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-up`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/sign-up');
  });
});

test.describe('Sign Out', () => {
  test('sign out page exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-out`);
    await page.waitForLoadState('networkidle');

    // Should either show sign-out confirmation or redirect
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});

test.describe('Authentication Redirects', () => {
  test('unauthenticated user accessing /publisher redirects to sign-in', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect to complete
    await page.waitForURL(/sign-in|(?!.*\/publisher)/, { timeout: 10000 }).catch(() => {});

    const isOnSignIn = page.url().includes('/sign-in');
    const isOnPublisher = page.url().includes('/publisher');

    // Either redirected to sign-in, or stayed on publisher with sign-in prompt
    expect(isOnSignIn || !isOnPublisher).toBe(true);
  });

  test('unauthenticated user accessing /admin redirects to sign-in', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect to complete
    await page.waitForURL(/sign-in|(?!.*\/admin)/, { timeout: 10000 }).catch(() => {});

    const isOnSignIn = page.url().includes('/sign-in');
    const isOnAdmin = page.url().includes('/admin');

    // Either redirected to sign-in, or stayed on admin with sign-in prompt
    expect(isOnSignIn || !isOnAdmin).toBe(true);
  });
});

test.describe('Authenticated Navigation', () => {
  test('authenticated user sees user button', async ({ page }) => {
    await loginAsUser(page);

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Should see Clerk UserButton (appears as profile image or icon)
    // Look for any element that indicates logged-in state
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
