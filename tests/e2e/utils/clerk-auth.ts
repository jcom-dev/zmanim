/**
 * Clerk Authentication Helpers for E2E Tests
 *
 * Simplified version that uses the shared user pool instead of creating new users.
 * Provides helper functions for authentication in tests and maintains backward compatibility.
 *
 * Uses @clerk/testing package for reliable authentication in Playwright tests.
 */

import { createClerkClient } from '@clerk/backend';
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';
import { loadUserPool } from './shared-users';
import { BASE_URL, TIMEOUTS, STORAGE_STATE } from '../../config';

// Cache for slug -> ID resolution
const slugCache: Map<string, string> = new Map();

/**
 * Resolve a publisher slug to its actual integer ID
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
    // First try exact slug match
    console.log(`[resolvePublisherSlug] Looking for slug: "${slug}"`);
    let result = await pool.query(
      'SELECT id, slug FROM publishers WHERE slug = $1',
      [slug]
    );
    console.log(`[resolvePublisherSlug] Exact match found: ${result.rows.length} rows`);

    // If no match, try case-insensitive slug match
    if (result.rows.length === 0) {
      result = await pool.query(
        'SELECT id, slug FROM publishers WHERE LOWER(slug) = LOWER($1)',
        [slug]
      );
      console.log(`[resolvePublisherSlug] Case-insensitive match found: ${result.rows.length} rows`);
    }

    // If still no match, try by name (convert slug to name format)
    // e.g., "e2e-shared-verified-1" -> "E2E Shared Verified 1"
    if (result.rows.length === 0 && slug.startsWith('e2e-')) {
      const nameParts = slug.split('-').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1)
      );
      const name = nameParts.join(' ');
      console.log(`[resolvePublisherSlug] Trying name match: "${name}"`);
      result = await pool.query(
        'SELECT id, name FROM publishers WHERE name = $1',
        [name]
      );
      console.log(`[resolvePublisherSlug] Name match found: ${result.rows.length} rows`);
      if (result.rows.length > 0) {
        console.log(`Resolved slug "${slug}" to ID via name match: ${name} (row: ${JSON.stringify(result.rows[0])})`);
      }
    }

    if (result.rows.length > 0) {
      const id = result.rows[0].id.toString(); // Convert integer to string
      slugCache.set(slug, id);
      console.log(`Resolved slug "${slug}" to ID: ${id}`);
      return id;
    }
    console.warn(`No publisher found with slug: ${slug}`);
    // DO NOT cache NULL - publisher might be created later
    return null;
  } catch (error) {
    console.error('Failed to resolve slug:', error);
    return null;
  } finally {
    await pool.end();
  }
}

/**
 * Get Clerk client instance
 */
const getClerkClient = () => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY environment variable is required');
  }
  return createClerkClient({ secretKey });
};

/**
 * Link a Clerk user to a publisher in the database
 * Updates the publisher's clerk_user_id field
 */
export async function linkClerkUserToPublisher(
  clerkUserId: string,
  publisherId: string
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set - cannot link user to publisher');
    return;
  }

  // Enable SSL for cloud databases (Xata, etc.) - required in CI
  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Update the publisher's clerk_user_id
    // Convert publisherId to integer for the database query
    const publisherIdInt = parseInt(publisherId, 10);
    if (isNaN(publisherIdInt)) {
      throw new Error(`Invalid publisher ID: ${publisherId}`);
    }

    await pool.query(
      `UPDATE publishers SET clerk_user_id = $1 WHERE id = $2`,
      [clerkUserId, publisherIdInt]
    );
    console.log(`Linked Clerk user ${clerkUserId} to publisher ${publisherId}`);
  } catch (error) {
    console.error('Failed to link user to publisher:', error);
    throw error;
  } finally {
    await pool.end();
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
 * Uses the pre-authenticated storage state from auth.setup.ts
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  // When using storage state, no need to sign in manually
  // The page context already has the admin session
  // This function is kept for backward compatibility

  // If not using storage state, fall back to manual sign-in
  const userPool = loadUserPool();
  await performClerkSignIn(page, userPool.admin.email);
}

/**
 * Inject publisher authentication into a Playwright page
 * Uses the pre-authenticated storage state from auth.setup.ts
 * Also links the Clerk user to the publisher in the database
 *
 * @param page - Playwright page
 * @param publisherIdOrSlug - Publisher ID (integer) or slug (e2e-shared-*)
 */
export async function loginAsPublisher(
  page: Page,
  publisherIdOrSlug?: string | number
): Promise<void> {
  console.log(`[loginAsPublisher] Called with publisherIdOrSlug: ${publisherIdOrSlug} (type: ${typeof publisherIdOrSlug})`);
  const userPool = loadUserPool();
  const user = userPool.publisher;
  console.log(`[loginAsPublisher] Publisher user from pool: ${user.id}`);

  // Resolve slug to actual ID if needed
  let publisherId = publisherIdOrSlug;

  if (publisherIdOrSlug) {
    // Convert to string for consistent handling
    const publisherStr = String(publisherIdOrSlug);
    console.log(`[loginAsPublisher] Checking if "${publisherStr}" starts with "e2e-shared-"`);
    if (publisherStr.startsWith('e2e-shared-')) {
      console.log(`[loginAsPublisher] YES - Resolving slug: ${publisherStr}`);
      const resolvedId = await resolvePublisherSlug(publisherStr);
      if (resolvedId) {
        console.log(`[loginAsPublisher] Resolved slug ${publisherStr} to ID: ${resolvedId}`);
        publisherId = resolvedId; // Already a string from resolvePublisherSlug
      } else {
        console.warn(`[loginAsPublisher] Failed to resolve slug: ${publisherStr}`);
      }
    } else {
      console.log(`[loginAsPublisher] NO - Not a slug, using as-is: ${publisherStr}`);
      publisherId = publisherStr;
    }
  }

  // Use the publisher from the pool if no specific publisher requested
  if (!publisherId && user.publisherId) {
    publisherId = String(user.publisherId);
    console.log(`[loginAsPublisher] No publisher specified, using pool publisher: ${publisherId}`);
  }

  // Link the Clerk user to the publisher in the database
  if (publisherId) {
    console.log(`[loginAsPublisher] Linking user ${user.id} to publisher ${publisherId}`);
    await linkClerkUserToPublisher(user.id, String(publisherId));
  }

  // If not using storage state, fall back to manual sign-in
  await performClerkSignIn(page, user.email);
  console.log(`[loginAsPublisher] Complete`);
}

/**
 * Inject regular user authentication into a Playwright page
 * Uses the pre-authenticated storage state from auth.setup.ts
 */
export async function loginAsUser(page: Page): Promise<void> {
  // When using storage state, no need to sign in manually
  // The page context already has the user session
  // This function is kept for backward compatibility

  // If not using storage state, fall back to manual sign-in
  const userPool = loadUserPool();
  await performClerkSignIn(page, userPool.user.email);
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
 * This is now handled by shared-users.ts cleanupUserPool
 * Kept for backward compatibility
 */
export async function cleanupTestUsers(): Promise<void> {
  console.log('cleanupTestUsers() is deprecated - use cleanupUserPool() instead');
  // No-op - cleanup is handled by shared-users.ts
}

/**
 * Get the current user pool
 * Useful for debugging or accessing user credentials
 */
export function getUserPool() {
  return loadUserPool();
}
