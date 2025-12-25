/**
 * Shared Test Fixtures for Parallel E2E Testing
 *
 * Creates publishers ONCE at global setup and reuses them across all tests.
 * This dramatically speeds up test execution by avoiding:
 * - Repeated publisher creation/deletion
 * - Repeated Clerk user creation
 * - Repeated authentication flows
 *
 * IMPORTANT: Since test workers run in separate processes, we use a
 * deterministic slug-based lookup from the database instead of in-memory Map.
 */

import { Pool } from 'pg';

export interface SharedPublisher {
  id: string;
  name: string;
  email: string;
  status: string;
  type: 'verified' | 'pending' | 'suspended' | 'with_algorithm' | 'with_coverage' | 'empty';
}

// Publisher config map - defines the expected publishers (used for getSharedPublisher)
const publisherConfigs: Record<string, { slug: string; type: SharedPublisher['type'] }> = {
  'verified-1': { slug: 'e2e-shared-verified-1', type: 'verified' },
  'verified-2': { slug: 'e2e-shared-verified-2', type: 'verified' },
  'verified-3': { slug: 'e2e-shared-verified-3', type: 'verified' },
  'verified-4': { slug: 'e2e-shared-verified-4', type: 'verified' },
  'verified-5': { slug: 'e2e-shared-verified-5', type: 'verified' },
  'pending': { slug: 'e2e-shared-pending', type: 'pending' },
  'suspended': { slug: 'e2e-shared-suspended', type: 'suspended' },
  'with-algorithm-1': { slug: 'e2e-shared-with-algorithm-1', type: 'with_algorithm' },
  'with-algorithm-2': { slug: 'e2e-shared-with-algorithm-2', type: 'with_algorithm' },
  'with-coverage': { slug: 'e2e-shared-with-coverage', type: 'with_coverage' },
  'empty-1': { slug: 'e2e-shared-empty-1', type: 'empty' },
  'empty-2': { slug: 'e2e-shared-empty-2', type: 'empty' },
  'empty-3': { slug: 'e2e-shared-empty-3', type: 'empty' },
};

// In-memory cache (populated by initializeSharedPublishers during global setup)
// Note: This cache is ONLY valid in the global-setup process
const sharedPublishers: Map<string, SharedPublisher> = new Map();

// Track if shared fixtures are initialized (only true in global-setup process)
let isInitialized = false;

/**
 * Initialize shared publishers at global setup
 * Call this ONCE in global-setup.ts
 */
export async function initializeSharedPublishers(): Promise<void> {
  if (isInitialized) return;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set - skipping shared publisher initialization');
    return;
  }

  // Enable SSL for cloud databases (Xata, etc.) - required in CI
  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('Initializing shared test publishers...');

    // Define publishers to create
    const publisherConfigs = [
      // Verified publishers for most tests
      { key: 'verified-1', name: 'E2E Shared Verified 1', status: 'verified', type: 'verified' as const },
      { key: 'verified-2', name: 'E2E Shared Verified 2', status: 'verified', type: 'verified' as const },
      { key: 'verified-3', name: 'E2E Shared Verified 3', status: 'verified', type: 'verified' as const },
      { key: 'verified-4', name: 'E2E Shared Verified 4', status: 'verified', type: 'verified' as const },
      { key: 'verified-5', name: 'E2E Shared Verified 5', status: 'verified', type: 'verified' as const },

      // Publishers with specific states
      { key: 'pending', name: 'E2E Shared Pending', status: 'pending', type: 'pending' as const },
      { key: 'suspended', name: 'E2E Shared Suspended', status: 'suspended', type: 'suspended' as const },

      // Publishers for algorithm tests (will have algorithms created)
      { key: 'with-algorithm-1', name: 'E2E With Algorithm 1', status: 'verified', type: 'with_algorithm' as const },
      { key: 'with-algorithm-2', name: 'E2E With Algorithm 2', status: 'verified', type: 'with_algorithm' as const },

      // Publishers for coverage tests
      { key: 'with-coverage', name: 'E2E With Coverage', status: 'verified', type: 'with_coverage' as const },

      // Empty publishers for onboarding tests
      { key: 'empty-1', name: 'E2E Empty 1', status: 'verified', type: 'empty' as const },
      { key: 'empty-2', name: 'E2E Empty 2', status: 'verified', type: 'empty' as const },
      { key: 'empty-3', name: 'E2E Empty 3', status: 'verified', type: 'empty' as const },
    ];

    for (const config of publisherConfigs) {
      const slug = `e2e-shared-${config.key}`;
      const email = `e2e-shared-${config.key}@test.zmanim.com`;

      // Map status values to status_id: pending=1, active=2, suspended=3
      const statusMap: Record<string, number> = { 'pending': 1, 'verified': 2, 'active': 2, 'suspended': 3 };
      const statusId = statusMap[config.status] || 2;
      const isVerified = config.status === 'verified';

      // Check if exists
      const existing = await pool.query(
        `SELECT p.id, p.name, p.contact_email as email, ps.key as status
         FROM publishers p
         JOIN publisher_statuses ps ON p.status_id = ps.id
         WHERE p.slug = $1`,
        [slug]
      );

      let publisher: SharedPublisher;

      if (existing.rows.length > 0) {
        publisher = {
          ...existing.rows[0],
          type: config.type,
        };
        console.log(`  Reusing: ${config.name}`);
      } else {
        const result = await pool.query(
          `INSERT INTO publishers (name, slug, contact_email, status_id, website, bio, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, name, contact_email as email, (SELECT key FROM publisher_statuses WHERE id = $4) as status`,
          [
            config.name,
            slug,
            email,
            statusId,
            'https://test.example.com',
            `Shared test publisher: ${config.type}`,
            isVerified,
          ]
        );
        publisher = {
          ...result.rows[0],
          type: config.type,
        };
        console.log(`  Created: ${config.name}`);
      }

      sharedPublishers.set(config.key, publisher);

      // Create algorithm for algorithm-type publishers
      if (config.type === 'with_algorithm') {
        await ensureAlgorithm(pool, publisher.id);
      }

      // Create coverage for coverage-type publishers
      if (config.type === 'with_coverage') {
        await ensureCoverage(pool, publisher.id);
      }
    }

    isInitialized = true;
    console.log(`Initialized ${sharedPublishers.size} shared publishers`);
  } finally {
    await pool.end();
  }
}

async function ensureAlgorithm(pool: Pool, publisherId: string): Promise<void> {
  const existing = await pool.query(
    'SELECT id FROM algorithms WHERE publisher_id = $1',
    [publisherId]
  );

  if (existing.rows.length === 0) {
    // Schema: id, publisher_id, name, description, configuration, status_id, is_public, forked_from, attribution_text, fork_count
    await pool.query(
      `INSERT INTO algorithms (publisher_id, name, description, configuration, status_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        publisherId,
        'E2E Shared Algorithm',
        'Shared algorithm for E2E testing',
        JSON.stringify({ name: 'E2E Shared GRA Algorithm' }),
        2, // active
      ]
    );
  }
}

async function ensureCoverage(pool: Pool, publisherId: string): Promise<void> {
  try {
    const existing = await pool.query(
      'SELECT id FROM publisher_coverage WHERE publisher_id = $1',
      [publisherId]
    );

    if (existing.rows.length === 0) {
      // Get a city with its country code from geo_countries table
      const city = await pool.query(`
        SELECT c.id, gc.code as country_code
        FROM cities c
        JOIN geo_countries gc ON c.country_id = gc.id
        LIMIT 1
      `);
      if (city.rows.length > 0) {
        await pool.query(
          `INSERT INTO publisher_coverage (publisher_id, coverage_level, city_id, country_code, priority, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [publisherId, 'city', city.rows[0].id, city.rows[0].country_code, 10, true]
        );
      }
    }
  } catch (error: any) {
    // Gracefully handle missing geo data in CI environments
    if (error?.message?.includes('relation "cities" does not exist')) {
      console.log('  Skipping coverage (cities table not available in CI)');
    } else {
      throw error;
    }
  }
}

// Synchronous cache for test workers - loaded lazily from database
let workerCache: Map<string, SharedPublisher> | null = null;

/**
 * Load shared publishers from database into worker cache
 * This is called lazily when getSharedPublisher is first called
 */
async function loadPublishersIntoCache(): Promise<void> {
  if (workerCache !== null) return;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set - cannot load shared publishers');
  }

  // Enable SSL for cloud databases (Xata, etc.) - required in CI
  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    workerCache = new Map();

    for (const [key, config] of Object.entries(publisherConfigs)) {
      const result = await pool.query(
        `SELECT p.id, p.name, p.contact_email as email, ps.key as status
         FROM publishers p
         JOIN publisher_statuses ps ON p.status_id = ps.id
         WHERE p.slug = $1`,
        [config.slug]
      );

      if (result.rows.length > 0) {
        workerCache.set(key, {
          ...result.rows[0],
          type: config.type,
        });
      }
    }
  } finally {
    await pool.end();
  }
}

// Sync version that uses cached data
let cacheLoadPromise: Promise<void> | null = null;

/**
 * Get a shared publisher by key
 * Use in tests to avoid creating new publishers
 *
 * IMPORTANT: This function loads from database on first call (async internally)
 * but returns synchronously from cache on subsequent calls.
 */
export function getSharedPublisher(key: string): SharedPublisher {
  // Check config first
  const config = publisherConfigs[key];
  if (!config) {
    throw new Error(`Unknown publisher key '${key}'. Available: ${Object.keys(publisherConfigs).join(', ')}`);
  }

  // If cache is loaded, return from cache
  if (workerCache !== null) {
    const publisher = workerCache.get(key);
    if (!publisher) {
      throw new Error(`Shared publisher '${key}' not found in database. Run global-setup first.`);
    }
    return publisher;
  }

  // Fallback: Return a publisher object with just the ID from slug pattern
  // The actual publisher ID will be looked up by the auth helper
  // This is a workaround since we can't do async in a sync function
  // The loginAsPublisher function handles the actual lookup
  return {
    id: config.slug, // Will be resolved by loginAsPublisher
    name: `E2E Shared ${key}`,
    email: `e2e-shared-${key}@test.zmanim.com`,
    status: config.type === 'pending' ? 'pending' : config.type === 'suspended' ? 'suspended' : 'active',
    type: config.type,
  };
}

/**
 * Async version that ensures cache is loaded
 */
export async function getSharedPublisherAsync(key: string): Promise<SharedPublisher> {
  if (workerCache === null) {
    if (cacheLoadPromise === null) {
      cacheLoadPromise = loadPublishersIntoCache();
    }
    await cacheLoadPromise;
  }
  return getSharedPublisher(key);
}

/**
 * Get any available verified publisher
 * Useful for tests that just need any publisher
 */
export function getAnyVerifiedPublisher(): SharedPublisher {
  return getSharedPublisher('verified-1');
}

/**
 * Get a publisher with algorithm
 */
export function getPublisherWithAlgorithm(): SharedPublisher {
  return getSharedPublisher('with-algorithm-1');
}

/**
 * Get an empty publisher (no algorithm)
 */
export function getEmptyPublisher(index: number = 1): SharedPublisher {
  return getSharedPublisher(`empty-${index}`);
}

/**
 * Get all shared publishers (for debugging)
 */
export function getAllSharedPublishers(): SharedPublisher[] {
  if (workerCache !== null) {
    return Array.from(workerCache.values());
  }
  // Return configs as fallback
  return Object.entries(publisherConfigs).map(([key, config]) => ({
    id: config.slug,
    name: `E2E Shared ${key}`,
    email: `e2e-shared-${key}@test.zmanim.com`,
    status: config.type === 'pending' ? 'pending' : config.type === 'suspended' ? 'suspended' : 'active',
    type: config.type,
  }));
}

/**
 * Check if shared fixtures are initialized
 */
export function isSharedFixturesInitialized(): boolean {
  return isInitialized;
}

/**
 * Get available publisher keys
 */
export function getAvailablePublisherKeys(): string[] {
  return Object.keys(publisherConfigs);
}

/**
 * Export the map for direct access if needed
 */
export { sharedPublishers };
