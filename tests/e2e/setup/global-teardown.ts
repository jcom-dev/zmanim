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
import { cleanupUserPool } from '../utils/shared-users';
import { cleanupTestData, closePool } from '../utils/test-fixtures';
import { isMailSlurpConfigured, cleanupAllInboxes } from '../utils/email-testing';

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

  // Clean up shared user pool
  try {
    console.log('Cleaning up shared user pool...');
    await cleanupUserPool();
  } catch (error) {
    console.error('Error cleaning up user pool:', error);
  }

  // Clean up database data
  try {
    console.log('Cleaning up database test data...');
    await cleanupTestData();
    console.log('Closing database connection pool...');
    await closePool();
  } catch (error) {
    console.error('Error cleaning up database data:', error);
  }

  // Clean up MailSlurp inboxes
  try {
    if (isMailSlurpConfigured()) {
      console.log('Cleaning up MailSlurp inboxes...');
      await cleanupAllInboxes();
    }
  } catch (error) {
    console.error('Error cleaning up email inboxes:', error);
  }

  console.log('\n========================================');
  console.log('Global Teardown Complete');
  console.log('========================================\n');
}

export default globalTeardown;
