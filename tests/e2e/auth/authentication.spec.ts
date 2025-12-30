/**
 * E2E Tests: Authentication & Authorization
 *
 * Optimized for parallel execution using shared fixtures.
 * NO publisher creation/deletion - uses pre-created shared publishers.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsPublisher,
  loginAsUser,
  logout,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// All tests in this file run in parallel
test.describe.configure({ mode: 'parallel' });

test.describe('Protected Routes - Publisher', () => {
  const routes = [
    '/publisher/dashboard',
    '/publisher/profile',
    '/publisher/algorithm',
    '/publisher/coverage',
    '/publisher/team',
  ];

  for (const route of routes) {
    test(`unauthenticated redirected from ${route}`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`);

      // Wait for redirect - Clerk may redirect to sign-in or handshake
      await page.waitForURL(/sign-in|clerk\.accounts\.dev/, { timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});

      const url = page.url();
      expect(
        url.includes('/sign-in') ||
        url.includes('clerk.accounts.dev') ||
        (await page.locator('text=/sign in/i').isVisible().catch(() => false))
      ).toBeTruthy();
    });
  }
});

test.describe('Protected Routes - Admin', () => {
  const routes = ['/admin/dashboard', '/admin/publishers'];

  for (const route of routes) {
    test(`unauthenticated redirected from ${route}`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`);

      // Wait for redirect - Clerk may redirect to sign-in or handshake
      await page.waitForURL(/sign-in|clerk\.accounts\.dev/, { timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});

      const url = page.url();
      expect(
        url.includes('/sign-in') ||
        url.includes('clerk.accounts.dev') ||
        (await page.locator('text=/sign in/i').isVisible().catch(() => false))
      ).toBeTruthy();
    });
  }
});

test.describe('Public Routes', () => {
  test('homepage accessible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test('sign-in accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/sign-in');
  });

  test('sign-up accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-up`);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/sign-up');
  });

  test('register page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('domcontentloaded');
    expect(await page.textContent('body')).toBeTruthy();
  });
});

// DELETE: Publisher Access tests - redundant with tests in e2e/publisher/ which use storage state
// These tests were timing out because they try to login programmatically which is slow

// DELETE: Admin Access tests - redundant with tests in e2e/admin/ which use storage state

// DELETE: Session Persistence tests - redundant and slow (use storage state tests instead)

// DELETE: Role Restrictions tests - slow login tests, better covered in e2e/errors/unauthorized.spec.ts

// DELETE: Sign Out test - slow login test, better handled in auth-flows.spec.ts
