/**
 * Demo Test: Unauthenticated Redirects
 *
 * Verifies that protected routes redirect unauthenticated users
 * to the sign-in page.
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, TIMEOUTS } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Unauthenticated Redirect Demo', () => {
  test('unauthenticated user redirected from /admin to sign-in', async ({
    page,
  }) => {
    // Navigate to admin without authentication
    await page.goto(`${BASE_URL}/admin`);

    // Wait for redirect
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

    // Verify redirected to sign-in
    expect(page.url()).toContain('sign-in');

    // Should have redirect_url param pointing back to admin
    expect(page.url()).toContain('redirect_url');
  });

  test('unauthenticated user redirected from /admin/publishers to sign-in', async ({
    page,
  }) => {
    // Navigate to admin publishers without authentication
    await page.goto(`${BASE_URL}/admin/publishers`);

    // Wait for redirect
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

    // Verify redirected to sign-in
    expect(page.url()).toContain('sign-in');
  });

  test('unauthenticated user redirected from /publisher to sign-in', async ({
    page,
  }) => {
    // Navigate to publisher without authentication
    await page.goto(`${BASE_URL}/publisher`);

    // Wait for redirect
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

    // Verify redirected to sign-in
    expect(page.url()).toContain('sign-in');
  });

  test('unauthenticated user redirected from /publisher/dashboard to sign-in', async ({
    page,
  }) => {
    // Navigate to publisher dashboard without authentication
    await page.goto(`${BASE_URL}/publisher/dashboard`);

    // Wait for redirect
    await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

    // Verify redirected to sign-in
    expect(page.url()).toContain('sign-in');
  });

  test('public routes remain accessible without authentication', async ({
    page,
  }) => {
    // Home page should be accessible
    const homeResponse = await page.goto(`${BASE_URL}/`);
    expect(homeResponse?.status()).toBe(200);
    expect(page.url()).toBe(`${BASE_URL}/`);

    // Sign-in page should be accessible
    const signInResponse = await page.goto(`${BASE_URL}/sign-in`);
    expect(signInResponse?.status()).toBeLessThan(400);
    expect(page.url()).toContain('/sign-in');
  });
});
