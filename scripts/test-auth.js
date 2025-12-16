#!/usr/bin/env node
/**
 * Authentication Testing Script for Shtetl Zmanim API
 *
 * Usage:
 *   node test-auth.js <token> [api_base]
 *   CLERK_TEST_TOKEN=xxx node test-auth.js
 *
 * To get a token:
 *   1. Open browser DevTools on the Shtetl Zmanim site
 *   2. Go to Network tab, find any API request
 *   3. Copy the Authorization header value (without 'Bearer ')
 */

const https = require('https');
const http = require('http');

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

// Configuration
const TOKEN = process.argv[2] || process.env.CLERK_TEST_TOKEN;
const API_BASE = process.argv[3] || process.env.API_BASE || 'http://localhost:8080';

if (!TOKEN) {
  log.error('Error: No token provided');
  log.plain('');
  log.plain('Usage: node test-auth.js <token> [api_base]');
  log.plain('');
  log.plain('To get a token:');
  log.plain('  1. Open browser DevTools on the Shtetl Zmanim site');
  log.plain('  2. Go to Network tab, find any API request with Authorization header');
  log.plain('  3. Copy the Bearer token (without "Bearer " prefix)');
  log.plain('');
  log.plain('Or set CLERK_TEST_TOKEN environment variable');
  process.exit(1);
}

// Parse URL
const url = new URL(API_BASE);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

/**
 * Make an HTTP request
 */
function makeRequest(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...options.headers
      }
    };

    const req = httpModule.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test an endpoint and report results
 */
async function testEndpoint(method, path, description, options = {}) {
  log.plain(`  ${method} ${path}`);

  try {
    const response = await makeRequest(method, path, options);

    if (response.status >= 200 && response.status < 300) {
      log.success(`  Status: ${response.status} OK`);
      const preview = JSON.stringify(response.body).substring(0, 150);
      log.plain(`  Response: ${preview}...`);
    } else if (response.status === 401) {
      log.error(`  Status: ${response.status} UNAUTHORIZED`);
      log.error(`  Response: ${JSON.stringify(response.body)}`);
    } else if (response.status === 403) {
      log.warn(`  Status: ${response.status} FORBIDDEN (missing role?)`);
      log.plain(`  Response: ${JSON.stringify(response.body)}`);
    } else {
      log.warn(`  Status: ${response.status}`);
      log.plain(`  Response: ${JSON.stringify(response.body)}`);
    }

    return response;
  } catch (err) {
    log.error(`  Error: ${err.message}`);
    return null;
  }
}

/**
 * Decode JWT and inspect claims
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (part 1)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Main test function
 */
async function runTests() {
  log.info('========================================');
  log.info('Shtetl Zmanim API Authentication Test');
  log.info('========================================');
  log.plain('');
  log.plain(`API Base: ${API_BASE}`);
  log.plain(`Token: ${TOKEN.substring(0, 20)}...`);
  log.plain('');

  // 1. Health check
  log.info('1. Health Check (No Auth)');
  log.info('----------------------------------------');
  await testEndpoint('GET', '/health', 'Health check');
  log.plain('');

  // 2. Public endpoints
  log.info('2. Public Endpoints');
  log.info('----------------------------------------');
  await testEndpoint('GET', '/api/v1/publishers', 'List publishers');
  await testEndpoint('GET', '/api/v1/cities?q=New%20York', 'Search cities');
  log.plain('');

  // 3. Publisher endpoints (require publisher role)
  log.info('3. Publisher Endpoints (Require "publisher" role)');
  log.info('----------------------------------------');
  const accessibleResponse = await testEndpoint('GET', '/api/v1/publisher/accessible', 'Get accessible publishers');
  await testEndpoint('GET', '/api/v1/publisher/algorithm/templates', 'Get algorithm templates');
  log.plain('');

  // 4. Publisher endpoints with X-Publisher-Id
  log.info('4. Publisher Endpoints (with X-Publisher-Id)');
  log.info('----------------------------------------');

  let publisherId = null;
  if (accessibleResponse?.status === 200 && accessibleResponse?.body) {
    const publishers = accessibleResponse.body.data?.publishers ||
                       accessibleResponse.body.publishers ||
                       [];
    if (publishers.length > 0) {
      publisherId = publishers[0].id;
      log.success(`Found publisher ID: ${publisherId}`);
    }
  }

  if (publisherId) {
    await testEndpoint('GET', '/api/v1/publisher/algorithm', 'Get algorithm', {
      headers: { 'X-Publisher-Id': publisherId }
    });
    await testEndpoint('GET', '/api/v1/publisher/coverage', 'Get coverage', {
      headers: { 'X-Publisher-Id': publisherId }
    });
  } else {
    log.warn('No publisher ID found - user may not have publisher access');
  }
  log.plain('');

  // 5. Admin endpoints
  log.info('5. Admin Endpoints (Require "admin" role)');
  log.info('----------------------------------------');
  await testEndpoint('GET', '/api/v1/admin/stats', 'Admin stats');
  log.plain('');

  // 6. JWT inspection
  log.info('6. JWT Token Inspection');
  log.info('----------------------------------------');

  const claims = decodeJWT(TOKEN);
  if (claims) {
    log.plain('JWT Claims:');
    log.plain(JSON.stringify(claims, null, 2));
    log.plain('');

    // Check for role
    const role = claims.metadata?.role || claims.public_metadata?.role;
    if (role) {
      log.success(`Role found: ${role}`);
    } else {
      log.warn('No "role" field found in token metadata');
      log.warn('The user needs "publisher" or "admin" role in Clerk to access protected endpoints');
    }

    // Check expiration
    if (claims.exp) {
      const expDate = new Date(claims.exp * 1000);
      const now = new Date();
      if (expDate < now) {
        log.error(`Token EXPIRED at: ${expDate.toISOString()}`);
      } else {
        log.success(`Token valid until: ${expDate.toISOString()}`);
      }
    }

    // Show subject (user ID)
    if (claims.sub) {
      log.plain(`User ID (sub): ${claims.sub}`);
    }
  } else {
    log.error('Failed to decode JWT token');
  }

  log.plain('');
  log.info('========================================');
  log.info('Test Complete');
  log.info('========================================');
}

// Run tests
runTests().catch(err => {
  log.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
