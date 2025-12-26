/**
 * Authentication Setup for Playwright
 *
 * This file creates authenticated browser storage states that can be reused
 * across all tests. This DRAMATICALLY reduces Clerk API calls by:
 *
 * 1. Signing in ONCE per role (admin, publisher, user)
 * 2. Saving the storage state (cookies, localStorage, sessionStorage) to files
 * 3. Reusing those files for ALL tests (no sign-in per test)
 *
 * Now uses shared user pool created in global-setup instead of creating new users.
 *
 * This addresses Clerk's rate limit: 5 sign-ins per 10 seconds per IP
 *
 * @see https://playwright.dev/docs/auth#authenticating-in-ui-mode
 */

import { test as setup, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { linkClerkUserToPublisher } from '../utils';
import { loadUserPool } from '../utils/shared-users';
import {
  BASE_URL,
  TIMEOUTS,
  STORAGE_STATE,
} from '../../config';

export const ADMIN_STORAGE_STATE = STORAGE_STATE.ADMIN;
export const PUBLISHER_STORAGE_STATE = STORAGE_STATE.PUBLISHER;
export const USER_STORAGE_STATE = STORAGE_STATE.USER;

/**
 * Perform Clerk sign-in and wait for session
 *
 * Uses @clerk/testing helpers which handle Clerk loading internally.
 */
async function performSignIn(page: any, email: string): Promise<void> {
  console.log(`Starting sign-in process for: ${email}`);

  // Navigate to the app first
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  console.log('Page loaded, waiting for Clerk...');

  // Use email-based sign-in which creates a sign-in token via backend API
  // This bypasses password requirements and email verification
  await clerk.signIn({
    page,
    emailAddress: email,
  });
  console.log(`Sign-in completed for: ${email}`);

  // Wait for authentication to complete with generous timeout
  console.log('Waiting for user to be authenticated...');
  await page.waitForFunction(
    () => (window as any).Clerk?.user !== null,
    { timeout: TIMEOUTS.EXTENDED }
  );

  console.log(`Successfully signed in as: ${email}`);
}

/**
 * Setup project: Authenticate as Admin
 *
 * This runs ONCE before all admin tests.
 * The storage state is saved and reused by all tests that need admin auth.
 */
setup('authenticate as admin', async ({ page }) => {
  console.log('\n=== Setting up Admin Authentication ===\n');

  // Load user from shared pool
  const userPool = loadUserPool();
  const user = userPool.admin;
  console.log(`Using admin user from pool: ${user.email}`);

  await performSignIn(page, user.email);

  // Navigate to admin dashboard to confirm access
  await page.goto(`${BASE_URL}/admin/dashboard`);
  await page.waitForLoadState('networkidle');

  // Verify we're on admin page (not redirected)
  await expect(page).toHaveURL(/\/admin/);

  // Save storage state
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  console.log(`Admin storage state saved to: ${ADMIN_STORAGE_STATE}\n`);
});

/**
 * Setup project: Authenticate as Publisher
 *
 * This runs ONCE before all publisher tests.
 * The storage state is saved and reused by all tests that need publisher auth.
 */
setup('authenticate as publisher', async ({ page }) => {
  console.log('\n=== Setting up Publisher Authentication ===\n');

  // Load user from shared pool
  const userPool = loadUserPool();
  const user = userPool.publisher;
  console.log(`Using publisher user from pool: ${user.email}`);

  // Link Clerk user to publisher in database
  if (user.publisherId) {
    await linkClerkUserToPublisher(user.id, user.publisherId);
  }

  await performSignIn(page, user.email);

  // Navigate to publisher dashboard to confirm access
  await page.goto(`${BASE_URL}/publisher/dashboard`);
  await page.waitForLoadState('networkidle');

  // Verify we're on publisher page (not redirected)
  await expect(page).toHaveURL(/\/publisher/);

  // Save storage state
  await page.context().storageState({ path: PUBLISHER_STORAGE_STATE });
  console.log(`Publisher storage state saved to: ${PUBLISHER_STORAGE_STATE}\n`);
});

/**
 * Setup project: Authenticate as Regular User
 *
 * This runs ONCE before all user tests.
 * The storage state is saved and reused by all tests that need regular user auth.
 */
setup('authenticate as user', async ({ page }) => {
  console.log('\n=== Setting up Regular User Authentication ===\n');

  // Load user from shared pool
  const userPool = loadUserPool();
  const user = userPool.user;
  console.log(`Using regular user from pool: ${user.email}`);

  await performSignIn(page, user.email);

  // Navigate to home page to confirm auth
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // Verify user is signed in (check for user button or similar)
  await page.waitForFunction(
    () => (window as any).Clerk?.user !== null,
    { timeout: TIMEOUTS.EXTENDED }
  );

  // Save storage state
  await page.context().storageState({ path: USER_STORAGE_STATE });
  console.log(`User storage state saved to: ${USER_STORAGE_STATE}\n`);
});
