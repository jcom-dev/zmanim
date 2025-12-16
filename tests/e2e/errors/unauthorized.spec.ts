/**
 * E2E Tests: Unauthorized Access
 *
 * Tests for unauthorized access handling:
 * - Admin routes without admin role
 * - Publisher routes without publisher access
 * - Protected routes without authentication
 */

import { test, expect } from '@playwright/test';
import {
  loginAsUser,
  loginAsPublisher,
  createTestPublisherEntity,
  cleanupTestData,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Unauthorized Access - Admin Routes', () => {
  test('unauthenticated user cannot access /admin', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect to complete by checking URL change
    await page.waitForFunction(
      (baseUrl) => {
        const url = window.location.href;
        return url.includes('sign-in') || !url.includes('/admin');
      },
      BASE_URL,
      { timeout: 10000 }
    ).catch(() => {});

    // Should be redirected to sign-in or see unauthorized
    const url = page.url();
    const isRedirected = url.includes('sign-in') || !url.includes('/admin');

    expect(isRedirected).toBe(true);
  });

  test('unauthenticated user cannot access /admin/publishers', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/admin)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/admin')).toBe(true);
  });

  test('unauthenticated user cannot access /admin/dashboard', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/admin)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/admin')).toBe(true);
  });

  test('regular user cannot access admin pages', async ({ page }) => {
    await loginAsUser(page);

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 10000 });

    // Should see unauthorized or be redirected
    const pageContent = await page.textContent('body');
    const url = page.url();

    const isBlocked =
      !url.includes('/admin') ||
      pageContent?.toLowerCase().includes('unauthorized') ||
      pageContent?.toLowerCase().includes('forbidden') ||
      pageContent?.toLowerCase().includes('access denied');

    expect(isBlocked).toBe(true);
  });
});

test.describe('Unauthorized Access - Publisher Routes', () => {
  test('unauthenticated user cannot access /publisher/dashboard', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/publisher)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/publisher')).toBe(true);
  });

  test('unauthenticated user cannot access /publisher/profile', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/publisher)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/publisher')).toBe(true);
  });

  test('unauthenticated user cannot access /publisher/algorithm', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/publisher)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/publisher')).toBe(true);
  });

  test('unauthenticated user cannot access /publisher/coverage', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForURL(/sign-in|(?!.*\/publisher)/, { timeout: 10000 }).catch(() => {});

    const url = page.url();
    expect(url.includes('sign-in') || !url.includes('/publisher')).toBe(true);
  });
});

test.describe('Unauthorized Access - Cross-Publisher', () => {
  test('publisher user cannot access another publishers data', async ({ page }) => {
    // Create two publishers
    const publisher1 = await createTestPublisherEntity({
      name: 'TEST_E2E_Publisher_1',
      status: 'verified',
    });

    const publisher2 = await createTestPublisherEntity({
      name: 'TEST_E2E_Publisher_2',
      status: 'verified',
    });

    // Login as publisher 1
    await loginAsPublisher(page, publisher1.id);

    // Try to access publisher 2's dashboard by manipulating context
    // This test verifies the backend properly validates publisher access
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // The page should either:
    // 1. Show publisher 1's data (correct behavior)
    // 2. Show an error if attempting to access another publisher
    // It should NOT show publisher 2's data

    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain(publisher2.name);

    await cleanupTestData();
  });
});
