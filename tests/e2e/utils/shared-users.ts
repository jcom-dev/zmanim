/**
 * Shared User Pool Management for E2E Tests
 *
 * Creates a pool of reusable test users at the start of the test run
 * and saves them to a JSON file. All tests share these users instead
 * of creating new ones per test.
 *
 * This dramatically reduces Clerk API calls and avoids rate limiting:
 * - Old approach: Create/delete users per test = 100s of API calls
 * - New approach: Create 3 users once = 3 API calls total
 *
 * User Pool Structure:
 * - Admin user: Has is_admin: true in publicMetadata
 * - Publisher user: Has publisher_access_list in publicMetadata
 * - Regular user: No special metadata
 */

import { createClerkClient } from '@clerk/backend';
import * as fs from 'fs';
import * as path from 'path';
import { TEST_PASSWORD, TEST_EMAIL_PREFIX } from '../../config';

const USER_POOL_FILE = path.resolve(__dirname, '../../../test-results/.auth/users.json');

export interface UserPoolEntry {
  role: 'admin' | 'publisher' | 'user';
  id: string;
  email: string;
  publisherId?: string; // Only for publisher role
}

export interface UserPool {
  admin: UserPoolEntry;
  publisher: UserPoolEntry;
  user: UserPoolEntry;
}

/**
 * Get Clerk client instance
 */
function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY environment variable is required');
  }
  return createClerkClient({ secretKey });
}

/**
 * Generate a unique email address for testing
 * Uses timestamp to ensure uniqueness across test runs
 */
function generateTestEmail(role: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${TEST_EMAIL_PREFIX}${role}-${timestamp}-${random}@mailslurp.world`;
}

/**
 * Create a single user in Clerk
 */
async function createUser(
  email: string,
  metadata: Record<string, any>,
  firstName: string = 'E2E',
  lastName: string = 'Test'
): Promise<{ id: string; email: string }> {
  const clerkClient = getClerkClient();

  try {
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password: TEST_PASSWORD,
      firstName,
      lastName,
      publicMetadata: metadata,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });

    console.log(`Created user: ${email} (${user.id})`);
    return { id: user.id, email };
  } catch (error: any) {
    console.error(`Failed to create user ${email}:`, error?.errors || error?.message);
    throw error;
  }
}

/**
 * Create the shared user pool
 * Called once during global setup
 */
export async function createUserPool(publisherId?: string): Promise<UserPool> {
  console.log('\n=== Creating Shared User Pool ===\n');

  // Ensure directory exists
  const dir = path.dirname(USER_POOL_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create admin user
  console.log('Creating admin user...');
  const adminEmail = generateTestEmail('admin');
  const admin = await createUser(adminEmail, { is_admin: true }, 'E2E', 'Admin');

  // Create publisher user
  console.log('Creating publisher user...');
  const publisherEmail = generateTestEmail('publisher');
  const publisher = await createUser(
    publisherEmail,
    { publisher_access_list: publisherId ? [publisherId] : [] },
    'E2E',
    'Publisher'
  );

  // Create regular user
  console.log('Creating regular user...');
  const userEmail = generateTestEmail('user');
  const user = await createUser(userEmail, {}, 'E2E', 'User');

  // Build user pool
  const userPool: UserPool = {
    admin: { role: 'admin', ...admin },
    publisher: { role: 'publisher', ...publisher, publisherId },
    user: { role: 'user', ...user },
  };

  // Save to file
  fs.writeFileSync(USER_POOL_FILE, JSON.stringify(userPool, null, 2));
  console.log(`\nUser pool saved to: ${USER_POOL_FILE}`);
  console.log('User pool contents:', JSON.stringify(userPool, null, 2));

  return userPool;
}

/**
 * Load the shared user pool from file
 * Called by tests and auth setup
 */
export function loadUserPool(): UserPool {
  if (!fs.existsSync(USER_POOL_FILE)) {
    throw new Error(
      `User pool file not found: ${USER_POOL_FILE}\n` +
      'Run global setup first to create the user pool.'
    );
  }

  const content = fs.readFileSync(USER_POOL_FILE, 'utf-8');
  return JSON.parse(content) as UserPool;
}

/**
 * Cleanup the user pool
 * Called during global teardown
 */
export async function cleanupUserPool(): Promise<void> {
  console.log('\n=== Cleaning Up User Pool ===\n');

  // Skip cleanup if file doesn't exist
  if (!fs.existsSync(USER_POOL_FILE)) {
    console.log('User pool file not found, skipping cleanup');
    return;
  }

  // Skip cleanup if explicitly disabled
  if (process.env.SKIP_CLEANUP === 'true') {
    console.log('Skipping user pool cleanup (SKIP_CLEANUP=true)');
    return;
  }

  try {
    const userPool = loadUserPool();
    const clerkClient = getClerkClient();

    // Delete all users in the pool
    const users = [userPool.admin, userPool.publisher, userPool.user];
    for (const user of users) {
      try {
        await clerkClient.users.deleteUser(user.id);
        console.log(`Deleted ${user.role} user: ${user.email}`);
      } catch (error: any) {
        // User may already be deleted
        if (!error?.message?.includes('not found')) {
          console.warn(`Failed to delete ${user.role} user:`, error?.message);
        }
      }
    }

    // Remove the user pool file
    fs.unlinkSync(USER_POOL_FILE);
    console.log(`\nUser pool file removed: ${USER_POOL_FILE}`);
  } catch (error) {
    console.error('Error cleaning up user pool:', error);
    throw error;
  }
}
