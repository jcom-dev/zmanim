/**
 * Cleanup script for test users in Clerk
 *
 * Run with: npx tsx cleanup-clerk-users.ts
 */

import { createClerkClient } from '@clerk/backend';
import * as dotenv from 'dotenv';
import { TEST_EMAIL_DOMAINS, TEST_EMAIL_PREFIX, PAGINATION } from './config';

// Load environment variables
dotenv.config();
dotenv.config({ path: '../web/.env.local' });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error('CLERK_SECRET_KEY not set');
  process.exit(1);
}

const clerkClient = createClerkClient({ secretKey });

async function cleanupAllTestUsers() {
  console.log('Fetching all users from Clerk...\n');

  let offset = 0;
  const limit = PAGINATION.CLERK_LIST_LIMIT;
  let hasMore = true;
  let totalDeleted = 0;
  let totalFound = 0;

  while (hasMore) {
    const response = await clerkClient.users.getUserList({ limit, offset });
    console.log(`Fetched ${response.data.length} users (offset: ${offset})`);

    const testUsers = response.data.filter((user) =>
      user.emailAddresses.some((email) =>
        TEST_EMAIL_DOMAINS.some((domain) => email.emailAddress.endsWith(domain)) ||
        email.emailAddress.startsWith(TEST_EMAIL_PREFIX)
      )
    );

    totalFound += testUsers.length;

    for (const user of testUsers) {
      const email = user.emailAddresses[0]?.emailAddress || 'unknown';
      try {
        await clerkClient.users.deleteUser(user.id);
        totalDeleted++;
        console.log(`  Deleted: ${email}`);
      } catch (error: any) {
        console.log(`  Failed to delete ${email}: ${error.message}`);
      }
    }

    hasMore = response.data.length === limit;
    offset += limit;
  }

  console.log(`\n========================================`);
  console.log(`Cleanup complete: ${totalDeleted}/${totalFound} test users deleted`);
  console.log(`========================================`);
}

cleanupAllTestUsers().catch(console.error);
