/**
 * Database Test Fixtures
 *
 * Provides utilities to create test data in the database
 * for E2E testing scenarios.
 *
 * Uses native PostgreSQL client (pg).
 */

import { Pool, PoolClient } from 'pg';

// Lazy initialization of pool - only created when needed
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for test fixtures');
    }
    // Enable SSL for cloud databases (Xata, etc.) - required in CI
    const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

/**
 * Check if database is configured
 */
export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

// Test data prefix - used to identify and cleanup test data
const TEST_PREFIX = 'TEST_';
const TEST_EMAIL_DOMAIN = 'test-zmanim.example.com';

// Cache for created test entities
const testEntityCache = new Map<string, any>();

/**
 * Map status values to valid database values
 * Database constraint: status IN ('pending', 'active', 'suspended')
 */
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    verified: 'active',
    approved: 'active',
    pending: 'pending',
    suspended: 'suspended',
    active: 'active',
  };
  return statusMap[status] || 'pending';
}

/**
 * Create a test publisher entity in the database
 */
export async function createTestPublisherEntity(
  overrides: Partial<{
    name: string;
    email: string;
    status: string;
    website: string;
    bio: string;
  }> = {}
): Promise<{
  id: string;
  name: string;
  email: string;
  status: string;
}> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured - cannot create test publisher');
  }

  const cacheKey = 'publisher-entity';
  if (testEntityCache.has(cacheKey) && !Object.keys(overrides).length) {
    return testEntityCache.get(cacheKey);
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const testPublisher = {
    name: overrides.name || `${TEST_PREFIX}Publisher ${timestamp}`,
    email: overrides.email || `test-publisher-${timestamp}-${random}@${TEST_EMAIL_DOMAIN}`,
    slug: `test-publisher-${timestamp}-${random}`,
    status: mapStatus(overrides.status || 'active'),
    website: overrides.website || 'https://test.example.com',
    bio: overrides.bio || 'Test publisher for E2E testing',
  };

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `INSERT INTO publishers (name, contact_email, slug, status_id, website, bio, is_verified)
       VALUES ($1, $2, $3, (SELECT id FROM publisher_statuses WHERE key = $4), $5, $6, $7)
       RETURNING id, name, contact_email as email, (SELECT key FROM publisher_statuses WHERE id = status_id) as status`,
      [
        testPublisher.name,
        testPublisher.email,
        testPublisher.slug,
        testPublisher.status,
        testPublisher.website,
        testPublisher.bio,
        testPublisher.status === 'active',  // is_verified = true for active publishers
      ]
    );

    const data = result.rows[0];

    if (!Object.keys(overrides).length) {
      testEntityCache.set(cacheKey, data);
    }

    return data;
  } finally {
    client.release();
  }
}

/**
 * Create a test algorithm for a publisher
 */
export async function createTestAlgorithm(
  publisherId: string,
  overrides: Partial<{
    name: string;
    status: string;
    config: object;
  }> = {}
): Promise<{
  id: string;
  publisher_id: string;
  name: string;
  status: string;
  config: object;
}> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured - cannot create test algorithm');
  }

  const cacheKey = `algorithm-${publisherId}`;
  if (testEntityCache.has(cacheKey) && !Object.keys(overrides).length) {
    return testEntityCache.get(cacheKey);
  }

  const defaultConfig = {
    name: 'Test GRA Algorithm',
    description: 'Test algorithm for E2E testing',
    zmanim: {
      alos: { method: 'solar_angle', params: { degrees: 16.1 } },
      misheyakir: { method: 'solar_angle', params: { degrees: 11.5 } },
      sunrise: { method: 'sunrise', params: {} },
      sof_zman_shma_gra: {
        method: 'proportional',
        params: { hours: 3, base: 'gra' },
      },
      sof_zman_tefillah_gra: {
        method: 'proportional',
        params: { hours: 4, base: 'gra' },
      },
      chatzos: { method: 'midday', params: {} },
      mincha_gedola: {
        method: 'proportional',
        params: { hours: 6.5, base: 'gra' },
      },
      mincha_ketana: {
        method: 'proportional',
        params: { hours: 9.5, base: 'gra' },
      },
      plag_hamincha: {
        method: 'proportional',
        params: { hours: 10.75, base: 'gra' },
      },
      sunset: { method: 'sunset', params: {} },
      tzeis: { method: 'solar_angle', params: { degrees: 8.5 } },
      tzeis_rt: { method: 'fixed_minutes', params: { minutes: 72 } },
    },
  };

  const testAlgorithm = {
    publisher_id: publisherId,
    name: overrides.name || `${TEST_PREFIX}Algorithm`,
    status: overrides.status || 'published',
    config: overrides.config || defaultConfig,
  };

  const client = await getPool().connect();
  try {
    // Schema: id, publisher_id, name, description, configuration, status, is_public, forked_from, attribution_text, fork_count
    const result = await client.query(
      `INSERT INTO algorithms (publisher_id, name, description, configuration, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, publisher_id, name, status, configuration as config`,
      [
        testAlgorithm.publisher_id,
        testAlgorithm.name,
        'Test algorithm for E2E testing',
        JSON.stringify(testAlgorithm.config),
        testAlgorithm.status,
      ]
    );

    const data = result.rows[0];

    if (!Object.keys(overrides).length) {
      testEntityCache.set(cacheKey, data);
    }

    return data;
  } finally {
    client.release();
  }
}

/**
 * Create test coverage for a publisher
 */
export async function createTestCoverage(
  publisherId: string,
  cityId: string,
  overrides: Partial<{
    level: string;
    priority: number;
    is_active: boolean;
  }> = {}
): Promise<{
  id: string;
  publisher_id: string;
  city_id: string;
  level: string;
  priority: number;
  is_active: boolean;
}> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured - cannot create test coverage');
  }

  const cacheKey = `coverage-${publisherId}-${cityId}`;
  if (testEntityCache.has(cacheKey) && !Object.keys(overrides).length) {
    return testEntityCache.get(cacheKey);
  }

  const testCoverage = {
    publisher_id: publisherId,
    city_id: cityId,
    level: overrides.level || 'city',
    priority: overrides.priority ?? 5,
    is_active: overrides.is_active ?? true,
  };

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `INSERT INTO publisher_coverage (publisher_id, city_id, coverage_level, priority, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, publisher_id, city_id, coverage_level as level, priority, is_active`,
      [
        testCoverage.publisher_id,
        testCoverage.city_id,
        testCoverage.level,
        testCoverage.priority,
        testCoverage.is_active,
      ]
    );

    const data = result.rows[0];

    if (!Object.keys(overrides).length) {
      testEntityCache.set(cacheKey, data);
    }

    return data;
  } finally {
    client.release();
  }
}

/**
 * Get a test city from the database
 * Returns first city matching name, or any city if name not provided
 */
export async function getTestCity(
  name?: string
): Promise<{ id: string; name: string; country: string } | null> {
  if (!isDatabaseConfigured()) {
    console.warn('Database not configured - cannot get test city');
    return null;
  }

  const client = await getPool().connect();
  try {
    let result;
    // Cities now use country_id FK to geo_countries table
    if (name) {
      result = await client.query(
        `SELECT c.id, c.name, gc.name as country
         FROM cities c
         JOIN geo_countries gc ON c.country_id = gc.id
         WHERE c.name ILIKE $1
         LIMIT 1`,
        [`%${name}%`]
      );
    } else {
      result = await client.query(
        `SELECT c.id, c.name, gc.name as country
         FROM cities c
         JOIN geo_countries gc ON c.country_id = gc.id
         LIMIT 1`
      );
    }

    if (result.rows.length === 0) {
      console.warn(`Could not find test city${name ? ` matching "${name}"` : ''}`);
      return null;
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Link a Clerk user ID to a publisher in the database
 */
export async function linkClerkUserToPublisher(
  clerkUserId: string,
  publisherId: string
): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn('Database not configured - cannot link user to publisher');
    return;
  }

  const client = await getPool().connect();
  try {
    // First, clear this clerk_user_id from any other publishers (to avoid unique constraint)
    await client.query(
      `UPDATE publishers SET clerk_user_id = NULL WHERE clerk_user_id = $1 AND id != $2`,
      [clerkUserId, publisherId]
    );

    // Then assign to this publisher
    await client.query(
      `UPDATE publishers SET clerk_user_id = $1 WHERE id = $2`,
      [clerkUserId, publisherId]
    );
    console.log(`Linked Clerk user ${clerkUserId} to publisher ${publisherId}`);
  } finally {
    client.release();
  }
}

/**
 * Create a complete test publisher setup (publisher + algorithm + coverage)
 */
export async function createFullTestPublisher(): Promise<{
  publisher: Awaited<ReturnType<typeof createTestPublisherEntity>>;
  algorithm: Awaited<ReturnType<typeof createTestAlgorithm>>;
  coverage: Awaited<ReturnType<typeof createTestCoverage>> | null;
}> {
  // Create publisher
  const publisher = await createTestPublisherEntity();

  // Create algorithm
  const algorithm = await createTestAlgorithm(publisher.id);

  // Try to create coverage if we have cities
  let coverage = null;
  const city = await getTestCity('New York');
  if (city) {
    coverage = await createTestCoverage(publisher.id, city.id);
  }

  return { publisher, algorithm, coverage };
}

/**
 * Clean up a specific publisher and its related data
 * Use this in individual tests to avoid affecting parallel tests
 */
export async function cleanupPublisher(publisherId: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    return;
  }

  const client = await getPool().connect();
  try {
    // Delete algorithm for this publisher
    await client.query(
      `DELETE FROM algorithms WHERE publisher_id = $1`,
      [publisherId]
    );

    // Delete coverage for this publisher
    await client.query(
      `DELETE FROM publisher_coverage WHERE publisher_id = $1`,
      [publisherId]
    );

    // Delete the publisher
    await client.query(
      `DELETE FROM publishers WHERE id = $1`,
      [publisherId]
    );
  } catch (error) {
    console.error(`Error cleaning up publisher ${publisherId}:`, error);
  } finally {
    client.release();
  }
}

/**
 * Clean up all test data from the database
 * Call this in global teardown
 *
 * Cleans up ALL test data patterns:
 * - TEST_% prefix (from test-fixtures.ts createTestPublisherEntity)
 * - E2E Test% (from global-setup.ts seedTestPublishers)
 * - E2E Shared% (from shared-fixtures.ts)
 * - e2e-% slugs (from various E2E test sources)
 * - @test-zmanim.example.com emails (from test-fixtures.ts)
 * - @mailslurp.dev emails (from clerk-auth.ts generateTestEmail fallback)
 */
export async function cleanupTestData(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('Database not configured - skipping test data cleanup');
    return;
  }

  console.log('Cleaning up test data from database...');

  const client = await getPool().connect();
  try {
    // Find ALL test publishers using comprehensive pattern matching
    // This catches all sources of test data:
    // 1. TEST_% - createTestPublisherEntity
    // 2. E2E Test% - global-setup seedTestPublishers
    // 3. E2E Shared% - shared-fixtures
    // 4. e2e-% slugs - all E2E sources
    // 5. @test-zmanim.example.com - TEST_EMAIL_DOMAIN
    // 6. @mailslurp.dev - fallback email domain from generateTestEmail
    const publisherResult = await client.query(
      `SELECT id, name, contact_email as email, slug FROM publishers
       WHERE name LIKE $1
          OR name LIKE $2
          OR name LIKE $3
          OR slug LIKE $4
          OR contact_email LIKE $5
          OR contact_email LIKE $6`,
      [
        `${TEST_PREFIX}%`,        // TEST_Publisher...
        'E2E Test%',              // E2E Test Publisher - Verified, etc.
        'E2E Shared%',            // E2E Shared Verified 1, etc.
        'e2e-%',                  // e2e-test-verified, e2e-shared-*, etc.
        `%@${TEST_EMAIL_DOMAIN}`, // @test-zmanim.example.com
        '%@mailslurp.dev',        // @mailslurp.dev (fallback emails)
      ]
    );

    const publisherIds = publisherResult.rows.map((p) => p.id);

    console.log(`Found ${publisherIds.length} test publishers to clean up`);

    if (publisherIds.length > 0) {
      // Log what we're deleting for debugging
      for (const pub of publisherResult.rows) {
        console.log(`  Deleting: ${pub.name} (${pub.slug || 'no-slug'}) - ${pub.email}`);
      }

      // Delete test algorithms for these publishers
      const algResult = await client.query(
        `DELETE FROM algorithms WHERE publisher_id = ANY($1)`,
        [publisherIds]
      );
      console.log(`  Deleted ${algResult.rowCount} algorithms`);

      // Delete test coverage for these publishers
      const covResult = await client.query(
        `DELETE FROM publisher_coverage WHERE publisher_id = ANY($1)`,
        [publisherIds]
      );
      console.log(`  Deleted ${covResult.rowCount} coverage records`);

      // Delete test publishers
      const pubResult = await client.query(
        `DELETE FROM publishers WHERE id = ANY($1)`,
        [publisherIds]
      );
      console.log(`  Deleted ${pubResult.rowCount} publishers`);
    }

    // Clear the cache
    testEntityCache.clear();

    console.log('Test data cleanup complete');
  } catch (error) {
    console.error('Error during test data cleanup:', error);
  } finally {
    client.release();
  }
}

/**
 * Clear the test entity cache
 */
export function clearEntityCache(): void {
  testEntityCache.clear();
}

/**
 * Get the test prefix
 */
export function getTestPrefix(): string {
  return TEST_PREFIX;
}

/**
 * Close the database pool (call in global teardown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
