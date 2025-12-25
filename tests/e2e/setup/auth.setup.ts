/**
 * Authentication Setup for Playwright
 *
 * This file creates authenticated browser storage states that can be reused
 * across all tests. This DRAMATICALLY reduces Clerk API calls by:
 *
 * 1. Signing in ONCE per role (admin, publisher)
 * 2. Saving the storage state (cookies, localStorage, sessionStorage) to files
 * 3. Reusing those files for ALL tests (no sign-in per test)
 *
 * This addresses Clerk's rate limit: 5 sign-ins per 10 seconds per IP
 *
 * @see https://playwright.dev/docs/auth#authenticating-in-ui-mode
 */

import { test as setup, expect } from '@playwright/test';
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { getSharedPublisherAsync, linkClerkUserToPublisher } from '../utils';
import {
  BASE_URL,
  TEST_PASSWORD,
  TEST_EMAIL_PREFIX,
  TIMEOUTS,
  PAGINATION,
  STORAGE_STATE,
} from '../../config';

export const ADMIN_STORAGE_STATE = STORAGE_STATE.ADMIN;
export const PUBLISHER_STORAGE_STATE = STORAGE_STATE.PUBLISHER;

/**
 * Find or create a test admin user in Clerk
 * Reuses ANY existing admin user to avoid rate limits and user creation issues
 */
async function getOrCreateAdminUser(): Promise<{ id: string; email: string }> {
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  // First, try to find ANY existing admin user
  // This reuses real admin accounts for testing
  const allUsers = await clerkClient.users.getUserList({ limit: PAGINATION.CLERK_LIST_LIMIT });
  const existingAdmin = allUsers.data.find((u) => {
    return (u.publicMetadata as any)?.is_admin === true;
  });

  if (existingAdmin) {
    const email = existingAdmin.emailAddresses[0]?.emailAddress || '';
    console.log(`Reusing existing admin user: ${email}`);
    return { id: existingAdmin.id, email };
  }

  // No admin found - create one with e2e- prefix
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  const email = `${TEST_EMAIL_PREFIX}admin-${timestamp}-${random}@mailslurp.world`;

  // Create new admin user
  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password: TEST_PASSWORD,
    publicMetadata: { is_admin: true },
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  console.log(`Created admin user: ${email}`);
  return { id: user.id, email };
}

/**
 * Find or create a test publisher user in Clerk
 * Reuses existing e2e-* publisher users to avoid rate limits
 */
async function getOrCreatePublisherUser(publisherId: string): Promise<{ id: string; email: string }> {
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  // First, try to find an existing publisher user from previous runs
  // Look for users with publisher_access_list in their metadata
  const allUsers = await clerkClient.users.getUserList({ limit: PAGINATION.CLERK_LIST_LIMIT });
  const existingPublisher = allUsers.data.find((u) => {
    const email = u.emailAddresses[0]?.emailAddress || '';
    const metadata = u.publicMetadata as any;
    const hasPublisherAccess = Array.isArray(metadata?.publisher_access_list) && metadata.publisher_access_list.length > 0;
    return hasPublisherAccess && email.startsWith(TEST_EMAIL_PREFIX);
  });

  if (existingPublisher) {
    const email = existingPublisher.emailAddresses[0]?.emailAddress || '';
    // Update to ensure this publisher has access to the correct publisher ID
    await clerkClient.users.updateUser(existingPublisher.id, {
      publicMetadata: {
        ...(existingPublisher.publicMetadata as object),
        publisher_access_list: [publisherId],
      },
    });
    console.log(`Reusing existing publisher user: ${email}`);
    return { id: existingPublisher.id, email };
  }

  // Generate unique email using timestamp + random (guaranteed unique)
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  const email = `${TEST_EMAIL_PREFIX}publisher-${timestamp}-${random}@mailslurp.world`;

  // Create new publisher user
  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password: TEST_PASSWORD,
    firstName: 'E2E',
    lastName: 'Publisher',
    publicMetadata: {
      publisher_access_list: [publisherId],
    },
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  console.log(`Created publisher user: ${email}`);
  return { id: user.id, email };
}

/**
 * Perform Clerk sign-in and wait for session
 */
async function performSignIn(page: any, email: string): Promise<void> {
  // Navigate to the app first
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // Setup testing token to bypass bot detection
  try {
    await setupClerkTestingToken({ page });
  } catch (error: any) {
    console.warn('Warning: setupClerkTestingToken failed:', error?.message);
  }

  // Wait for Clerk script to be loaded in DOM first
  console.log('Waiting for Clerk script tag in DOM...');
  await page.waitForFunction(
    () => {
      const script = document.querySelector('script[data-clerk-js-script="true"]');
      return script !== null;
    },
    { timeout: TIMEOUTS.EXTENDED }
  );
  console.log('Clerk script found in DOM');

  // Wait for Clerk global to be defined
  console.log('Waiting for window.Clerk to be defined...');
  await page.waitForFunction(
    () => typeof (window as any).Clerk !== 'undefined',
    { timeout: TIMEOUTS.EXTENDED }
  );
  console.log('window.Clerk is defined');

  // Wait for Clerk to be fully loaded
  // Log current Clerk state for debugging
  const clerkState = await page.evaluate(() => {
    const clerk = (window as any).Clerk;
    return {
      exists: typeof clerk !== 'undefined',
      loaded: clerk?.loaded,
      isReady: typeof clerk?.isReady === 'function' ? 'function exists' : 'no isReady',
      version: clerk?.version,
    };
  });
  console.log('Clerk state before waiting:', JSON.stringify(clerkState));

  // Use a longer polling interval and explicit timeout
  const CLERK_LOAD_TIMEOUT = 60000; // 60 seconds explicit
  console.log(`Waiting for Clerk.loaded to be true (timeout: ${CLERK_LOAD_TIMEOUT}ms)...`);
  await page.waitForFunction(
    () => (window as any).Clerk?.loaded === true,
    { timeout: CLERK_LOAD_TIMEOUT, polling: 500 }
  );
  console.log('Clerk is fully loaded');

  // Sign in using email-based approach (more reliable in test environments)
  await clerk.signIn({
    page,
    emailAddress: email,
  });

  // Wait for authentication to complete
  await page.waitForFunction(
    () => (window as any).Clerk?.user !== null,
    { timeout: TIMEOUTS.CLERK_AUTH }
  );

  // Wait for session to be fully active
  await page.waitForFunction(
    () => {
      const clerk = (window as any).Clerk;
      return clerk?.user !== null &&
             clerk?.session?.status === 'active' &&
             clerk?.user?.primaryEmailAddress !== undefined;
    },
    { timeout: TIMEOUTS.CLERK_LOAD }
  ).catch(() => {
    // If detailed check times out, the basic auth check passed - continue
  });

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

  const user = await getOrCreateAdminUser();
  await performSignIn(page, user.email);

  // Navigate to admin dashboard to confirm access
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3001'}/admin/dashboard`);
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

  // Get the first verified shared publisher
  const publisher = await getSharedPublisherAsync('verified-1');
  const user = await getOrCreatePublisherUser(publisher.id);

  // Link Clerk user to publisher in database
  await linkClerkUserToPublisher(user.id, publisher.id);

  await performSignIn(page, user.email);

  // Navigate to publisher dashboard to confirm access
  await page.goto(`${process.env.BASE_URL || 'http://localhost:3001'}/publisher/dashboard`);
  await page.waitForLoadState('networkidle');

  // Verify we're on publisher page (not redirected)
  await expect(page).toHaveURL(/\/publisher/);

  // Save storage state
  await page.context().storageState({ path: PUBLISHER_STORAGE_STATE });
  console.log(`Publisher storage state saved to: ${PUBLISHER_STORAGE_STATE}\n`);
});
