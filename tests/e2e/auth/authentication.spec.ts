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
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(
        url.includes('/sign-in') ||
        url.includes('clerk') ||
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
      await page.waitForLoadState('networkidle');

      const url = page.url();
      expect(
        url.includes('/sign-in') ||
        url.includes('clerk') ||
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

test.describe('Publisher Access', () => {
  test('can access dashboard', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('can access profile', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/profile');
  });

  test('can access algorithm', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/algorithm');
  });

  test('can access coverage', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/coverage');
  });

  test('can access team', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/team');
  });
});

test.describe('Admin Access', () => {
  test('can access admin dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin');
    await expect(page.getByText(/admin/i)).toBeVisible();
  });

  test('can access publishers page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/admin/publishers');
  });
});

test.describe('Session Persistence', () => {
  test('persists across navigation', async ({ page }) => {
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    expect(page.url()).toContain('/publisher/dashboard');

    await page.goto(`${BASE_URL}/publisher/profile`);
    expect(page.url()).toContain('/publisher/profile');

    await page.goto(`${BASE_URL}/publisher/algorithm`);
    expect(page.url()).toContain('/publisher/algorithm');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('persists after refresh', async ({ page }) => {
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('Role Restrictions', () => {
  test('publisher cannot access admin', async ({ page }) => {
    const publisher = getSharedPublisher('verified-3');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const content = await page.textContent('body');

    expect(
      !url.includes('/admin/dashboard') ||
      content?.toLowerCase().includes('denied') ||
      content?.toLowerCase().includes('not authorized')
    ).toBeTruthy();
  });

  test('user cannot access admin', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const content = await page.textContent('body');

    expect(
      !url.includes('/admin/publishers') ||
      content?.toLowerCase().includes('denied') ||
      content?.toLowerCase().includes('not authorized')
    ).toBeTruthy();
  });

  test('user cannot access publisher', async ({ page }) => {
    await loginAsUser(page);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const content = await page.textContent('body');

    expect(
      !url.includes('/publisher/dashboard') ||
      content?.toLowerCase().includes('denied') ||
      content?.toLowerCase().includes('not authorized')
    ).toBeTruthy();
  });
});

test.describe('Sign Out', () => {
  test('can sign out', async ({ page }) => {
    const publisher = getSharedPublisher('verified-4');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/dashboard');

    await logout(page);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    expect(
      url.includes('/sign-in') ||
      url.includes('clerk') ||
      !url.includes('/publisher/dashboard')
    ).toBeTruthy();
  });
});
