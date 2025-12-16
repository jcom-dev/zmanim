/**
 * Playwright Global Teardown
 *
 * Runs once after all tests complete.
 * - Cleans up test users from Clerk
 * - Cleans up test data from database
 */

import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function globalTeardown(config: FullConfig) {
  console.log('\n========================================');
  console.log('Playwright Global Teardown');
  console.log('========================================\n');

  // Skip cleanup if running in watch mode or explicitly disabled
  if (process.env.SKIP_CLEANUP === 'true') {
    console.log('Skipping cleanup (SKIP_CLEANUP=true)');
    return;
  }

  // Clean up Clerk users
  try {
    console.log('Cleaning up Clerk test users...');
    const clerkAuth = await import('../utils/clerk-auth');
    if (typeof clerkAuth.cleanupTestUsers === 'function') {
      await clerkAuth.cleanupTestUsers();
    } else {
      console.log('cleanupTestUsers not available, skipping Clerk cleanup');
    }
  } catch (error) {
    console.error('Error cleaning up Clerk users:', error);
  }

  // Clean up database data
  try {
    console.log('Cleaning up database test data...');
    const testFixtures = await import('../utils/test-fixtures');
    if (typeof testFixtures.cleanupTestData === 'function') {
      await testFixtures.cleanupTestData();
    }
    // Close pool
    if (typeof testFixtures.closePool === 'function') {
      console.log('Closing database connection pool...');
      await testFixtures.closePool();
    }
  } catch (error) {
    console.error('Error cleaning up database data:', error);
  }

  // Clean up MailSlurp inboxes
  try {
    const emailTesting = await import('../utils/email-testing');
    if (typeof emailTesting.isMailSlurpConfigured === 'function' && emailTesting.isMailSlurpConfigured()) {
      console.log('Cleaning up MailSlurp inboxes...');
      if (typeof emailTesting.cleanupAllInboxes === 'function') {
        await emailTesting.cleanupAllInboxes();
      }
    }
  } catch (error) {
    console.error('Error cleaning up email inboxes:', error);
  }

  console.log('\n========================================');
  console.log('Global Teardown Complete');
  console.log('========================================\n');
}

export default globalTeardown;
