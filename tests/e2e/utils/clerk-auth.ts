/**
 * Clerk Authentication Helpers for E2E Tests
 *
 * Creates dedicated test users at the start of each test run,
 * and cleans them up at the end.
 *
 * Uses @clerk/testing package for reliable authentication in Playwright tests.
 */

import { createClerkClient } from '@clerk/backend';
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { createTestInbox } from './email-testing';
import { linkClerkUserToPublisher } from './test-fixtures';
import {
  BASE_URL,
  TEST_PASSWORD,
  TEST_EMAIL_DOMAINS,
  TEST_EMAIL_PREFIX,
  TIMEOUTS,
  PAGINATION,
} from '../../config';

// Cache for slug -> ID resolution
const slugCache: Map<string, string> = new Map();

/**
 * Resolve a publisher slug to its actual UUID
 */
async function resolvePublisherSlug(slug: string): Promise<string | null> {
  // Check cache first
  if (slugCache.has(slug)) {
    return slugCache.get(slug) || null;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set - cannot resolve slug');
    return null;
  }

  // Enable SSL for cloud databases (Xata, etc.) - required in CI
  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const result = await pool.query(
      'SELECT id FROM publishers WHERE slug = $1',
      [slug]
    );

    if (result.rows.length > 0) {
      const id = result.rows[0].id;
      slugCache.set(slug, id);
      return id;
    }
    return null;
  } catch (error) {
    console.warn('Failed to resolve slug:', error);
    return null;
  } finally {
    await pool.end();
  }
}

// Initialize Clerk client
const getClerkClient = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY environment variable is required');
  }
  return createClerkClient({ secretKey });
};

// TEST_PASSWORD imported from ../../config

// Test user session - created once per test run
interface TestUserSession {
  adminUser: { id: string; email: string } | null;
  publisherUser: { id: string; email: string; publisherId: string } | null;
  regularUser: { id: string; email: string } | null;
}

const testSession: TestUserSession = {
  adminUser: null,
  publisherUser: null,
  regularUser: null,
};

// Track all users created in this session for cleanup
const createdUserIds: string[] = [];

/**
 * Generate a unique test email using MailSlurp (real email addresses)
 * Falls back to a known working test format if MailSlurp unavailable
 */
async function generateTestEmail(role: string): Promise<string> {
  try {
    // Use MailSlurp for real, deliverable email addresses
    const inbox = await createTestInbox(`e2e-${role}`);
    return inbox.emailAddress;
  } catch (error) {
    // Fallback: Use a timestamp-based email that Clerk will accept
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    // Use mailslurp.dev domain which is typically whitelisted
    return `${TEST_EMAIL_PREFIX}${role}-${timestamp}-${random}@mailslurp.dev`;
  }
}

/**
 * Create a test admin user in Clerk
 * If user already exists with that email, return the existing user
 */
export async function createTestAdmin(): Promise<{ id: string; email: string }> {
  // Return cached user if exists
  if (testSession.adminUser) {
    return testSession.adminUser;
  }

  const email = await generateTestEmail('admin');
  const clerkClient = getClerkClient();

  try {
    // First check if user already exists
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      // Ensure admin status is set
      await clerkClient.users.updateUser(existingUser.id, {
        publicMetadata: {
          ...existingUser.publicMetadata,
          is_admin: true,
        },
      });
      testSession.adminUser = { id: existingUser.id, email };
      console.log(`Reusing existing admin (updated status): ${email}`);
      return testSession.adminUser;
    }

    // Create new user
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password: TEST_PASSWORD,
      firstName: 'E2E',
      lastName: 'Admin',
      publicMetadata: {
        is_admin: true,
      },
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    createdUserIds.push(user.id);
    testSession.adminUser = { id: user.id, email };
    console.log(`Created test admin: ${email}`);
    return testSession.adminUser;
  } catch (error: any) {
    // If error is "email taken", try to find and return existing user
    if (error?.errors?.[0]?.code === 'form_identifier_exists') {
      const existingUsers = await clerkClient.users.getUserList({
        emailAddress: [email],
      });
      if (existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0];
        testSession.adminUser = { id: existingUser.id, email };
        console.log(`Found existing admin after conflict: ${email}`);
        return testSession.adminUser;
      }
    }
    console.error('Clerk createUser error:', error?.errors || error?.message || error);
    throw error;
  }
}

/**
 * Create a test publisher user in Clerk linked to a publisher
 * If user already exists with that email, return the existing user
 */
export async function createTestPublisher(
  publisherId: string
): Promise<{ id: string; email: string }> {
  // Return cached user if exists and matches publisher
  if (testSession.publisherUser && testSession.publisherUser.publisherId === publisherId) {
    return { id: testSession.publisherUser.id, email: testSession.publisherUser.email };
  }

  const email = await generateTestEmail('publisher');
  const clerkClient = getClerkClient();

  try {
    // First check if user already exists
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      // Update metadata to include publisher access
      await clerkClient.users.updateUser(existingUser.id, {
        publicMetadata: {
          ...existingUser.publicMetadata,
          publisher_access_list: [publisherId],
        },
      });
      testSession.publisherUser = { id: existingUser.id, email, publisherId };
      console.log(`Reusing existing publisher user: ${email}`);
      return { id: existingUser.id, email };
    }

    // Create new user
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password: TEST_PASSWORD,
      firstName: 'E2E',
      lastName: 'Test Publisher',
      publicMetadata: {
        publisher_access_list: [publisherId],
      },
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    createdUserIds.push(user.id);
    testSession.publisherUser = { id: user.id, email, publisherId };
    console.log(`Created test publisher: ${email} for publisher ${publisherId}`);
    return { id: user.id, email };
  } catch (error: any) {
    // If error is "email taken", try to find and return existing user
    if (error?.errors?.[0]?.code === 'form_identifier_exists') {
      const existingUsers = await clerkClient.users.getUserList({
        emailAddress: [email],
      });
      if (existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0];
        testSession.publisherUser = { id: existingUser.id, email, publisherId };
        console.log(`Found existing publisher after conflict: ${email}`);
        return { id: existingUser.id, email };
      }
    }
    console.error('Clerk createUser error:', error?.errors || error?.message || error);
    throw error;
  }
}

/**
 * Create a test regular user in Clerk (no special roles)
 * If user already exists with that email, return the existing user
 */
export async function createTestUser(): Promise<{ id: string; email: string }> {
  // Return cached user if exists
  if (testSession.regularUser) {
    return testSession.regularUser;
  }

  const email = await generateTestEmail('user');
  const clerkClient = getClerkClient();

  try {
    // First check if user already exists
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      // Regular users don't need special metadata
      testSession.regularUser = { id: existingUser.id, email };
      console.log(`Reusing existing user: ${email}`);
      return testSession.regularUser;
    }

    // Create new user (no special metadata needed for regular users)
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password: TEST_PASSWORD,
      publicMetadata: {},
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    createdUserIds.push(user.id);
    testSession.regularUser = { id: user.id, email };
    console.log(`Created test user: ${email}`);
    return testSession.regularUser;
  } catch (error: any) {
    // If error is "email taken", try to find and return existing user
    if (error?.errors?.[0]?.code === 'form_identifier_exists') {
      const existingUsers = await clerkClient.users.getUserList({
        emailAddress: [email],
      });
      if (existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0];
        testSession.regularUser = { id: existingUser.id, email };
        console.log(`Found existing user after conflict: ${email}`);
        return testSession.regularUser;
      }
    }
    console.error('Clerk createUser error:', error?.errors || error?.message || error);
    throw error;
  }
}

/**
 * Setup Clerk testing token and sign in using the official @clerk/testing approach
 * This bypasses bot detection and uses Clerk's programmatic sign-in
 */
async function performClerkSignIn(page: Page, email: string): Promise<void> {
  // Navigate to the app first (Clerk needs to be loaded)
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // Setup testing token to bypass bot detection
  try {
    await setupClerkTestingToken({ page });
  } catch (error: any) {
    console.warn('Warning: setupClerkTestingToken failed:', error?.message);
  }

  // Wait for Clerk to be loaded
  await page.waitForFunction(
    () => typeof (window as any).Clerk !== 'undefined',
    { timeout: TIMEOUTS.CLERK_AUTH }
  );

  await page.waitForFunction(
    () => (window as any).Clerk?.loaded === true,
    { timeout: TIMEOUTS.CLERK_AUTH }
  );

  // Check if already signed in (from storage state)
  const isAlreadySignedIn = await page.evaluate(() => {
    const clerk = (window as any).Clerk;
    return clerk?.user !== null && clerk?.session?.status === 'active';
  });

  if (isAlreadySignedIn) {
    // Already signed in from storage state, skip sign-in
    return;
  }

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

  // Wait for app to recognize the authenticated state
  // Instead of hard wait, wait for auth-dependent UI to appear
  await page.waitForFunction(
    () => {
      const clerk = (window as any).Clerk;
      // Verify session is fully active and user data is loaded
      return clerk?.user !== null &&
             clerk?.session?.status === 'active' &&
             clerk?.user?.primaryEmailAddress !== undefined;
    },
    { timeout: TIMEOUTS.CLERK_LOAD }
  ).catch(() => {
    // If detailed check times out, the basic auth check passed - continue
  });
}

/**
 * Inject admin authentication into a Playwright page
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const user = await createTestAdmin();
  await performClerkSignIn(page, user.email);
}

/**
 * Inject publisher authentication into a Playwright page
 * Also links the Clerk user to the publisher in the database
 *
 * @param page - Playwright page
 * @param publisherIdOrSlug - Publisher ID (UUID) or slug (e2e-shared-*)
 */
export async function loginAsPublisher(
  page: Page,
  publisherIdOrSlug: string
): Promise<void> {
  // Resolve slug to actual ID if needed
  let publisherId = publisherIdOrSlug;

  // Check if this looks like a slug (e2e-shared-*) vs a UUID
  if (publisherIdOrSlug.startsWith('e2e-shared-')) {
    const resolvedId = await resolvePublisherSlug(publisherIdOrSlug);
    if (resolvedId) {
      publisherId = resolvedId;
    }
  }

  const user = await createTestPublisher(publisherId);

  // Link the Clerk user to the publisher in the database
  // This is necessary for the app to know which publisher this user owns
  await linkClerkUserToPublisher(user.id, publisherId);

  await performClerkSignIn(page, user.email);
}

/**
 * Inject regular user authentication into a Playwright page
 */
export async function loginAsUser(page: Page): Promise<void> {
  const user = await createTestUser();
  await performClerkSignIn(page, user.email);
}

/**
 * Sign out the current user
 */
export async function logout(page: Page): Promise<void> {
  try {
    await clerk.signOut({ page });
  } catch (error) {
    await page.goto(`${BASE_URL}/sign-out`);
  }
}

/**
 * Clean up all test users from Clerk
 * Call this in global teardown
 */
export async function cleanupTestUsers(): Promise<void> {
  console.log('Cleaning up test users from Clerk...');

  const clerkClient = getClerkClient();

  // First, delete users we explicitly created in this session
  for (const userId of createdUserIds) {
    try {
      await clerkClient.users.deleteUser(userId);
      console.log(`Deleted session user: ${userId}`);
    } catch (error: any) {
      // User may already be deleted
      if (!error?.message?.includes('not found')) {
        console.warn(`Failed to delete user ${userId}:`, error?.message);
      }
    }
  }

  // Also clean up any orphaned test users (from previous failed runs)
  // Use centralized TEST_EMAIL_DOMAINS from config
  let offset = 0;
  const limit = PAGINATION.CLERK_LIST_LIMIT;
  let hasMore = true;
  let deletedCount = 0;

  while (hasMore) {
    try {
      const response = await clerkClient.users.getUserList({ limit, offset });

      const testUsers = response.data.filter((user) =>
        user.emailAddresses.some((email) =>
          TEST_EMAIL_DOMAINS.some((domain) => email.emailAddress.endsWith(domain)) ||
          email.emailAddress.startsWith(TEST_EMAIL_PREFIX)
        )
      );

      for (const user of testUsers) {
        if (!createdUserIds.includes(user.id)) {
          try {
            await clerkClient.users.deleteUser(user.id);
            deletedCount++;
            console.log(`Deleted orphaned test user: ${user.emailAddresses[0]?.emailAddress}`);
          } catch {
            // Ignore errors for orphaned users
          }
        }
      }

      hasMore = response.data.length === limit;
      offset += limit;
    } catch (error) {
      console.warn('Error listing users for cleanup:', error);
      break;
    }
  }

  // Clear session
  testSession.adminUser = null;
  testSession.publisherUser = null;
  testSession.regularUser = null;
  createdUserIds.length = 0;

  console.log(`Test user cleanup complete. Deleted ${deletedCount} orphaned users.`);
}

/**
 * Clear the test user cache (useful between test files)
 */
export function clearUserCache(): void {
  testSession.adminUser = null;
  testSession.publisherUser = null;
  testSession.regularUser = null;
}

/**
 * Get the test password (for UI login fallback)
 */
export function getTestPassword(): string {
  return TEST_PASSWORD;
}

/**
 * Get the test email domain
 */
export function getTestEmailDomain(): string {
  return 'clerk.test';
}
