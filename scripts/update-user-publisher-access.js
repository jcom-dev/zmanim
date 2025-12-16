#!/usr/bin/env node
/**
 * Update a user's publisher_access_list in Clerk metadata
 *
 * Usage:
 *   node scripts/update-user-publisher-access.js <user_id> <publisher_ids_comma_separated>
 *   node scripts/update-user-publisher-access.js user_36XTsPj1mJSja1kkZDOZnPcJBGg 2,5
 */

const https = require('https');

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('Error: CLERK_SECRET_KEY environment variable is required');
  process.exit(1);
}

function clerkApi(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.clerk.com',
      port: 443,
      path: `/v1${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, body: parsed });
          }
        } catch {
          reject({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  const userId = process.argv[2] || 'user_36XTsPj1mJSja1kkZDOZnPcJBGg';
  const publisherIds = process.argv[3] ? process.argv[3].split(',') : ['2', '5'];

  console.log(`Updating user ${userId} with publisher access: [${publisherIds.join(', ')}]`);

  try {
    // First get current user to see existing metadata
    const user = await clerkApi('GET', `/users/${userId}`);
    console.log('Current metadata:', JSON.stringify(user.public_metadata, null, 2));

    // Update with new publisher access list
    const updatedMetadata = {
      ...user.public_metadata,
      publisher_access_list: publisherIds,
      primary_publisher_id: publisherIds[0]
    };

    const result = await clerkApi('PATCH', `/users/${userId}`, {
      public_metadata: updatedMetadata
    });

    console.log('\nUpdated metadata:', JSON.stringify(result.public_metadata, null, 2));
    console.log('\nSuccess! User now has access to publishers:', publisherIds.join(', '));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
