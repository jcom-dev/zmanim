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

// Cache for slug -> ID resolution (populated from file written by global-setup)
const slugCache: Map<string, string> = new Map();

// Track which user-publisher links have been verified this session
const verifiedLinks: Set<string> = new Set();

// Shared connection pool (lazy initialized)
let sharedPool: Pool | null = null;

/**
 * Get or create a shared database connection pool
 * This avoids creating/destroying pools on every call
 */
function getSharedPool(): Pool | null {
  if (sharedPool) return sharedPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  sharedPool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
    max: 3, // Limit connections for parallel workers
    idleTimeoutMillis: 30000,
  });

  return sharedPool;
}

/**
 * Load pre-resolved slugs from file (written by global-setup)
 * This eliminates DB calls during tests
 */
function loadSlugCacheFromFile(): void {
  if (slugCache.size > 0) return; // Already loaded

  try {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.resolve(__dirname, '../../test-results/.slug-cache.json');

    if (fs.existsSync(cacheFile)) {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      for (const [slug, id] of Object.entries(data)) {
        slugCache.set(slug, id as string);
      }
      // Only log once when cache is loaded
      if (slugCache.size > 0) {
        console.log(`[slugCache] Loaded ${slugCache.size} pre-resolved slugs from cache file`);
      }
    }
  } catch {
    // Cache file not available, will fall back to DB lookup
  }
}

/**
 * Resolve a publisher slug to its actual integer ID
 * OPTIMIZED: Uses file-based cache first, then falls back to DB
 */
async function resolvePublisherSlug(slug: string): Promise<string | null> {
  // Try file-based cache first (populated by global-setup)
  loadSlugCacheFromFile();

  if (slugCache.has(slug)) {
    return slugCache.get(slug) || null;
  }

  // Fallback to DB lookup (only for dynamically created publishers)
  const pool = getSharedPool();
  if (!pool) {
    console.warn('DATABASE_URL not set - cannot resolve slug');
    return null;
  }

  try {
    const result = await pool.query(
      'SELECT id FROM publishers WHERE slug = $1',
      [slug]
    );

    if (result.rows.length > 0) {
      const id = result.rows[0].id.toString();
      slugCache.set(slug, id);
      console.log(`[resolvePublisherSlug] Resolved "${slug}" to ID: ${id}`);
      return id;
    }

    console.warn(`[resolvePublisherSlug] No publisher found with slug: ${slug}`);
    return null;
  } catch (error) {
    console.error('Failed to resolve slug:', error);
    return null;
  }
  // Note: Don't close the shared pool here
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
 * OPTIMIZED: Uses shared pool and skips if link already verified this session
 * Also updates Clerk user metadata with publisher access
 */
export async function linkClerkUserToPublisher(
  clerkUserId: string,
  publisherId: string
): Promise<void> {
  // Skip if we've already verified this link in this worker session
  const linkKey = `${clerkUserId}:${publisherId}`;
  if (verifiedLinks.has(linkKey)) {
    return; // Already linked, skip DB call
  }

  const pool = getSharedPool();
  if (!pool) {
    console.warn('DATABASE_URL not set - cannot link user to publisher');
    return;
  }

  try {
    const publisherIdInt = parseInt(publisherId, 10);
    if (isNaN(publisherIdInt)) {
      throw new Error(`Invalid publisher ID: ${publisherId}`);
    }

    // Check if already linked (avoid unnecessary UPDATE)
    const existing = await pool.query(
      `SELECT clerk_user_id FROM publishers WHERE id = $1`,
      [publisherIdInt]
    );

    const alreadyLinkedInDb = existing.rows.length > 0 && existing.rows[0].clerk_user_id === clerkUserId;

    if (!alreadyLinkedInDb) {
      // Need to update database
      await pool.query(
        `UPDATE publishers SET clerk_user_id = $1 WHERE id = $2`,
        [clerkUserId, publisherIdInt]
      );
    }

    // Always update Clerk user metadata (even if DB was already linked)
    // This ensures metadata is consistent with database
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (secretKey) {
      try {
        const { createClerkClient } = await import('@clerk/backend');
        const clerkClient = createClerkClient({ secretKey });

        // Get current metadata
        const user = await clerkClient.users.getUser(clerkUserId);
        const currentMetadata = user.publicMetadata as any || {};

        // Add publisher to access list if not already present
        const accessList = currentMetadata.publisher_access_list || [];
        if (!accessList.includes(publisherId)) {
          accessList.push(publisherId);
        }

        // Update metadata with publisher access and primary publisher
        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...currentMetadata,
            publisher_access_list: accessList,
            primary_publisher_id: publisherId
          }
        });
      } catch (error) {
        console.warn('Warning: Failed to update Clerk user metadata:', error);
      }
    }

    verifiedLinks.add(linkKey);
    console.log(`Linked Clerk user ${clerkUserId} to publisher ${publisherId}`);
  } catch (error) {
    console.error('Failed to link user to publisher:', error);
    throw error;
  }
  // Note: Don't close the shared pool here
}

/**
 * Setup Clerk testing token and sign in using the official @clerk/testing approach
 * This bypasses bot detection and uses Clerk's programmatic sign-in
 *
 * Includes retry logic with exponential backoff to handle intermittent Clerk loading issues
 */
async function performClerkSignIn(page: Page, email: string): Promise<void> {
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 2000; // 2 seconds

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Navigate to the app first (Clerk needs to be loaded)
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');

      // Setup testing token to bypass bot detection
      try {
        await setupClerkTestingToken({ page });
      } catch (error: any) {
        console.warn('Warning: setupClerkTestingToken failed:', error?.message);
      }

      // Wait for Clerk to be loaded with retry-friendly timeout
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

      // Success - return without retrying
      console.log(`[performClerkSignIn] Successfully authenticated as ${email}`);
      return;

    } catch (error: any) {
      lastError = error;
      const isClerkLoadError = error.message?.includes('Clerk') ||
                               error.message?.includes('timeout') ||
                               error.message?.includes('TimeoutError');

      if (isClerkLoadError && attempt < MAX_RETRIES) {
        // Calculate exponential backoff delay: 2s, 4s, 8s
        const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
        console.warn(
          `[performClerkSignIn] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}. ` +
          `Retrying in ${delay}ms...`
        );
        await page.waitForTimeout(delay);
      } else if (!isClerkLoadError) {
        // Non-retryable error (not Clerk-related), throw immediately
        throw error;
      }
    }
  }

  // All retries exhausted - throw the last error
  throw new Error(
    `Failed to authenticate after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`
  );
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
  const userPool = loadUserPool();
  const user = userPool.publisher;

  // Resolve slug to actual ID if needed
  let publisherId = publisherIdOrSlug;

  if (publisherIdOrSlug) {
    const publisherStr = String(publisherIdOrSlug);
    if (publisherStr.startsWith('e2e-shared-') || publisherStr.startsWith('e2e-')) {
      const resolvedId = await resolvePublisherSlug(publisherStr);
      if (resolvedId) {
        publisherId = resolvedId;
      }
    } else {
      publisherId = publisherStr;
    }
  }

  // Use the publisher from the pool if no specific publisher requested
  if (!publisherId && user.publisherId) {
    publisherId = String(user.publisherId);
  }

  // Link the Clerk user to the publisher in the database
  if (publisherId) {
    await linkClerkUserToPublisher(user.id, String(publisherId));
  }

  // Sign in (if not already signed in from storage state)
  await performClerkSignIn(page, user.email);
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
