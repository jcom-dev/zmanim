/**
 * List Clerk users to see what's in the database
 * Run with: npx tsx list-clerk-users.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClerkClient } from '@clerk/backend';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  console.log('📋 Listing Clerk users...\n');

  const response = await clerkClient.users.getUserList({
    limit: 10,
  });

  console.log(`Total users in first page: ${response.data.length}`);
  console.log(`Total count: ${response.totalCount}\n`);

  response.data.forEach((user, index) => {
    const email = user.emailAddresses[0]?.emailAddress || 'No email';
    const role = user.publicMetadata?.role || 'No role';
    console.log(`${index + 1}. ${email} (${role})`);
  });

  console.log(`\n✅ Listed ${response.data.length} users`);
}

main().catch(console.error);
