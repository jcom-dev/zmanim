/**
 * One-time cleanup script to remove test data from database
 *
 * Run with: npx tsx cleanup-test-data.ts
 *
 * This cleans up:
 * - TEST_% prefix publishers (from test-fixtures.ts)
 * - E2E Test% publishers (from global-setup.ts)
 * - e2e-% slug publishers (EXCLUDING e2e-shared-% which are shared fixtures)
 * - @test-zmanim.example.com emails
 * - @mailslurp.dev emails
 *
 * DOES NOT DELETE:
 * - e2e-shared-% publishers (shared fixtures that persist for test runs)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../web/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanupTestData(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  // Enable SSL for cloud databases (Xata, etc.) - required in CI
  const requiresSSL = databaseUrl.includes('xata.sh') || process.env.CI === 'true';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Find ALL test publishers EXCEPT shared fixtures
    // e2e-shared-% publishers must persist for entire test runs
    const publisherResult = await pool.query(
      `SELECT id, name, email, slug FROM publishers
       WHERE (
         name LIKE $1
         OR name LIKE $2
         OR (slug LIKE $3 AND (slug IS NULL OR slug NOT LIKE 'e2e-shared-%'))
         OR email LIKE $4
         OR email LIKE $5
       )
       AND (slug IS NULL OR slug NOT LIKE 'e2e-shared-%')`,
      [
        'TEST_%',                    // TEST_Publisher...
        'E2E Test%',                 // E2E Test Publisher - Verified, etc.
        'e2e-%',                     // e2e-test-verified, etc. (but NOT e2e-shared-*)
        '%@test-zmanim.example.com', // TEST_EMAIL_DOMAIN
        '%@mailslurp.dev',           // fallback emails
      ]
    );

    const publisherIds = publisherResult.rows.map((p) => p.id);

    console.log(`\nFound ${publisherIds.length} test publishers to clean up:\n`);

    if (publisherIds.length === 0) {
      console.log('No test data found - database is clean!');
      return;
    }

    // Show what we're about to delete
    for (const pub of publisherResult.rows) {
      console.log(`  - ${pub.name}`);
      console.log(`    Email: ${pub.email}`);
      console.log(`    Slug: ${pub.slug || '(none)'}`);
      console.log(`    ID: ${pub.id}`);
      console.log('');
    }

    // Confirm deletion
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log('\nDeleting test data...');

    // Delete algorithms
    const algResult = await pool.query(
      `DELETE FROM algorithms WHERE publisher_id = ANY($1)`,
      [publisherIds]
    );
    console.log(`  Deleted ${algResult.rowCount} algorithms`);

    // Delete coverage
    const covResult = await pool.query(
      `DELETE FROM publisher_coverage WHERE publisher_id = ANY($1)`,
      [publisherIds]
    );
    console.log(`  Deleted ${covResult.rowCount} coverage records`);

    // Delete publishers
    const pubResult = await pool.query(
      `DELETE FROM publishers WHERE id = ANY($1)`,
      [publisherIds]
    );
    console.log(`  Deleted ${pubResult.rowCount} publishers`);

    console.log('\nCleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run cleanup
cleanupTestData();
