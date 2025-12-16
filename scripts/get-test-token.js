#!/usr/bin/env node
/**
 * Get a Test Token for API Testing
 *
 * This script uses the Clerk Backend SDK to:
 * 1. List existing users with admin or publisher access
 * 2. Get or create a session token for testing
 *
 * Usage:
 *   source api/.env && node scripts/get-test-token.js [email]
 *
 * Examples:
 *   node scripts/get-test-token.js                    # Auto-select user with active session
 *   node scripts/get-test-token.js admin@example.com  # Target specific user
 *
 * Requires:
 *   CLERK_SECRET_KEY environment variable
 */

const https = require('https');

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // Preferred admin from .env
const TARGET_EMAIL = process.argv[2]; // Optional: specify user email (overrides ADMIN_EMAIL)

if (!CLERK_SECRET_KEY) {
  console.error('Error: CLERK_SECRET_KEY environment variable is required');
  console.error('Run: source api/.env && node scripts/get-test-token.js');
  process.exit(1);
}

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
  plain: (msg) => console.log(msg)
};

/**
 * Make a request to the Clerk API
 */
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

async function listUsers() {
  log.info('Fetching users from Clerk...\n');

  const response = await clerkApi('GET', '/users?limit=100');

  return response.map(user => ({
    id: user.id,
    email: user.email_addresses?.[0]?.email_address || 'no-email',
    isAdmin: user.public_metadata?.is_admin === true,
    publisherAccess: user.public_metadata?.publisher_access_list || [],
  }));
}

async function listSessions(userId) {
  const response = await clerkApi('GET', `/sessions?user_id=${userId}`);
  return response;
}

async function getSessionToken(sessionId, expiresInSeconds = 1800) {
  log.info(`Getting token for session ${sessionId} (expires in ${expiresInSeconds}s / ${Math.round(expiresInSeconds/60)} min)...`);

  // Clerk's session token with custom expiry (default 30 minutes)
  const response = await clerkApi('POST', `/sessions/${sessionId}/tokens`, {
    expires_in_seconds: expiresInSeconds
  });
  return response.jwt;
}

async function createSignInToken(userId) {
  log.info(`\nCreating sign-in token for user ${userId}...`);

  const response = await clerkApi('POST', '/sign_in_tokens', {
    user_id: userId,
    expires_in_seconds: 3600,
  });

  return response.token;
}

/**
 * Find best user: prioritize users with active sessions
 */
async function findBestUser(users) {
  // Filter to users with access
  const usersWithAccess = users.filter(u => u.isAdmin || u.publisherAccess.length > 0);

  if (usersWithAccess.length === 0) {
    return null;
  }

  // Prefer admins over publisher-only users
  const sortedUsers = usersWithAccess.sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return 0;
  });

  // Check each user for active sessions
  for (const user of sortedUsers) {
    const sessions = await listSessions(user.id);
    const activeSession = sessions.find(s => s.status === 'active');
    if (activeSession) {
      return { user, activeSession };
    }
  }

  // No active sessions found, return first admin (or first user with access)
  return { user: sortedUsers[0], activeSession: null };
}

async function main() {
  log.info('========================================');
  log.info('Shtetl Zmanim - Get Test Token');
  log.info('========================================');
  log.plain('');

  if (TARGET_EMAIL) {
    log.info(`Targeting user: ${TARGET_EMAIL}`);
  }

  try {
    // List all users
    const users = await listUsers();

    log.plain('Available users:');
    log.plain('================');

    for (const user of users) {
      const roleStr = user.isAdmin ? '[admin]' : (user.publisherAccess.length > 0 ? '[publisher]' : '[user]');
      const accessStr = user.publisherAccess.length > 0
        ? `publishers: ${user.publisherAccess.join(', ')}`
        : '';
      log.plain(`  ${user.email} ${roleStr} ${accessStr}`);
    }
    log.plain('');

    let targetUser;
    let activeSession;

    // Priority: 1) CLI argument, 2) ADMIN_EMAIL from .env, 3) auto-select
    const emailToFind = TARGET_EMAIL || ADMIN_EMAIL;

    if (emailToFind) {
      // Find specific user by email
      const source = TARGET_EMAIL ? 'CLI argument' : 'ADMIN_EMAIL from .env';
      log.info(`Looking for user: ${emailToFind} (${source})`);

      targetUser = users.find(u => u.email.toLowerCase() === emailToFind.toLowerCase());
      if (!targetUser) {
        if (ADMIN_EMAIL && !TARGET_EMAIL) {
          // ADMIN_EMAIL not found, fall back to auto-select
          log.warn(`ADMIN_EMAIL (${ADMIN_EMAIL}) not found in Clerk, falling back to auto-select...`);
          const result = await findBestUser(users);
          if (result) {
            targetUser = result.user;
            activeSession = result.activeSession;
          }
        } else {
          log.error(`User not found: ${emailToFind}`);
          process.exit(1);
        }
      } else {
        const sessions = await listSessions(targetUser.id);
        activeSession = sessions.find(s => s.status === 'active');
      }
    } else {
      // Auto-select best user (prefer those with active sessions)
      log.info('Searching for user with active session...');
      const result = await findBestUser(users);

      if (!result) {
        log.warn('No user with admin status or publisher access found.');
        log.plain('\nTo create a test user with publisher access:');
        log.plain('1. Sign up on the web app at http://localhost:3001');
        log.plain('2. Go to Clerk Dashboard and add publicMetadata: { "publisher_access_list": ["<publisher-id>"] }');
        process.exit(0);
      }

      targetUser = result.user;
      activeSession = result.activeSession;
    }

    const userType = targetUser.isAdmin ? 'admin' : 'publisher';
    log.success(`Selected user: ${targetUser.email} [${userType}]`);

    if (activeSession) {
      log.success(`Found active session: ${activeSession.id}`);

      const token = await getSessionToken(activeSession.id);

      log.plain('');
      log.info('========================================');
      log.success('JWT TOKEN (use this for API testing):');
      log.info('========================================');
      log.plain(token);
      log.info('========================================');
      log.plain('');
      log.plain('Example curl commands:');
      log.plain('');
      log.success('# Admin endpoint:');
      log.plain(`curl -s -H "Authorization: Bearer ${token.substring(0, 20)}..." http://localhost:8080/api/v1/admin/stats | jq '.'`);
      log.plain('');
      log.success('# Publisher endpoint (with X-Publisher-Id header):');
      log.plain(`curl -s -H "Authorization: Bearer ${token.substring(0, 20)}..." -H "X-Publisher-Id: 2" "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-20" | jq '.'`);
      log.plain('');
      log.plain('Full token for copy/paste:');
      log.plain(token);
    } else {
      log.warn('No active session found. Creating a sign-in token...');

      const signInToken = await createSignInToken(targetUser.id);

      log.plain('');
      log.info('========================================');
      log.plain('Sign-in Token Created');
      log.info('========================================');
      log.plain('');
      log.plain('To get a JWT token:');
      log.plain('1. Open browser to the web app');
      log.plain(`2. Go to: http://localhost:3001/sign-in#/sso-callback?__clerk_ticket=${signInToken}`);
      log.plain('3. You will be signed in automatically');
      log.plain('4. Run this script again to get the JWT token');
      log.plain('');
      log.plain('Or sign in manually at http://localhost:3001/sign-in');
    }

  } catch (error) {
    log.error(`Error: ${error?.message || JSON.stringify(error)}`);
    if (error?.body) {
      log.error(`Details: ${JSON.stringify(error.body, null, 2)}`);
    }
    process.exit(1);
  }
}

main();
