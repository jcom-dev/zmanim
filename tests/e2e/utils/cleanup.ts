/**
 * Test Cleanup Utilities
 *
 * Comprehensive cleanup functions for removing all test data
 * after test runs. Used in global teardown.
 */

import { cleanupTestUsers, clearUserCache } from './clerk-auth';
import { cleanupTestData, clearEntityCache } from './test-fixtures';
import { cleanupAllInboxes, isMailSlurpConfigured } from './email-testing';

/**
 * Run complete cleanup of all test artifacts
 * - Clerk test users
 * - Database test data
 * - MailSlurp test inboxes
 */
export async function runFullCleanup(): Promise<void> {
  console.log('Starting full test cleanup...');

  try {
    // Clean up Clerk users
    await cleanupTestUsers();
  } catch (error) {
    console.error('Error cleaning up Clerk users:', error);
  }

  try {
    // Clean up database data
    await cleanupTestData();
  } catch (error) {
    console.error('Error cleaning up database data:', error);
  }

  try {
    // Clean up MailSlurp inboxes
    if (isMailSlurpConfigured()) {
      await cleanupAllInboxes();
    }
  } catch (error) {
    console.error('Error cleaning up email inboxes:', error);
  }

  console.log('Full test cleanup complete');
}

/**
 * Clear all caches (for between-test cleanup)
 */
export function clearAllCaches(): void {
  clearUserCache();
  clearEntityCache();
}

/**
 * Cleanup only database test data (preserves Clerk users for faster reruns)
 */
export async function cleanupDatabaseOnly(): Promise<void> {
  console.log('Cleaning up database test data only...');
  await cleanupTestData();
  clearEntityCache();
  console.log('Database cleanup complete');
}

/**
 * Cleanup only Clerk test users (preserves database data)
 */
export async function cleanupClerkOnly(): Promise<void> {
  console.log('Cleaning up Clerk test users only...');
  await cleanupTestUsers();
  clearUserCache();
  console.log('Clerk cleanup complete');
}

// Re-export individual cleanup functions
export { cleanupTestUsers, cleanupTestData };
