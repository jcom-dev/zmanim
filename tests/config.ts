/**
 * Centralized Test Configuration
 *
 * Single source of truth for all test configuration values.
 * Import from here instead of hardcoding values in test files.
 *
 * @example
 * ```typescript
 * import { TestConfig } from '../config';
 *
 * const response = await fetch(`${TestConfig.BASE_URL}/api/health`);
 * await page.waitForTimeout(TestConfig.TIMEOUTS.CLERK_AUTH);
 * ```
 */

// =============================================================================
// URLs and Ports
// =============================================================================

/**
 * Base URL for the web application.
 * Override with BASE_URL environment variable.
 */
export const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

/**
 * Base URL for the API.
 * Override with API_URL environment variable.
 */
export const API_URL = process.env.API_URL || 'http://localhost:8080';

// =============================================================================
// Authentication
// =============================================================================

/**
 * Test user password used for all E2E test accounts.
 * Override with TEST_PASSWORD environment variable.
 */
export const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPassword123!';

// =============================================================================
// Email Domains
// =============================================================================

/**
 * Domain used for test fixture emails (database seeding).
 */
export const TEST_EMAIL_DOMAIN = 'test-zmanim.example.com';

/**
 * All domains used by MailSlurp and test email generation.
 * Used for identifying and cleaning up test users.
 */
export const TEST_EMAIL_DOMAINS = [
  '@clerk.test',
  '@mailslurp.xyz',
  '@mailslurp.world',
  '@tempsmtp.com',
  '@mailslurp.info',
  '@mailslurp.dev',
  '@mailslurp.biz',
  '@mailslurp.net',
  `@${TEST_EMAIL_DOMAIN}`,
] as const;

/**
 * Prefix for E2E test user emails.
 */
export const TEST_EMAIL_PREFIX = 'e2e-';

// =============================================================================
// Timeouts
// =============================================================================

/**
 * Standard timeout values for E2E tests.
 * Use these instead of hardcoding timeout values.
 */
export const TIMEOUTS = {
  /** Short timeout for fast operations (5s) */
  SHORT: 5000,
  /** Medium timeout for typical page loads (15s) */
  MEDIUM: 15000,
  /** Long timeout for slow operations (30s) */
  LONG: 30000,
  /** Extended timeout for very slow operations (60s) */
  EXTENDED: 60000,

  /** Clerk authentication timeout (30s) */
  CLERK_AUTH: 30000,
  /** Clerk JavaScript load timeout (10s) */
  CLERK_LOAD: 10000,

  /** Email delivery wait timeout (60s) */
  EMAIL_WAIT: 60000,

  /** Polling interval for retry operations (500ms) */
  POLL_INTERVAL: 500,
} as const;

// =============================================================================
// Pagination
// =============================================================================

/**
 * Pagination settings for API calls.
 */
export const PAGINATION = {
  /** Default limit for Clerk user list API */
  CLERK_LIST_LIMIT: 100,
  /** Default limit for database queries */
  DB_QUERY_LIMIT: 100,
} as const;

// =============================================================================
// Test Data Prefixes
// =============================================================================

/**
 * Prefix for test data in the database.
 */
export const TEST_PREFIX = 'TEST_';

/**
 * Prefix for E2E shared publisher fixtures.
 */
export const E2E_PUBLISHER_PREFIX = 'e2e-shared';

/**
 * Test website URL for publisher fixtures.
 */
export const TEST_WEBSITE_URL = 'https://test.example.com';

// =============================================================================
// Algorithm Defaults (Halachic Constants)
// =============================================================================

/**
 * Default solar angles for zmanim calculations.
 * These are standard halachic values.
 */
export const ALGORITHM_ANGLES = {
  /** Alos hashachar (dawn) angle */
  ALOS: 16.1,
  /** Misheyakir (earliest tallis) angle */
  MISHEYAKIR: 11.5,
  /** Tzeis hakochavim (nightfall) angle */
  TZEIS: 8.5,
} as const;

/**
 * Default proportional hours for zmanim calculations.
 * Based on GRA (Vilna Gaon) opinion.
 */
export const ALGORITHM_HOURS = {
  /** Sof zman shma (latest shema) */
  SOF_ZMAN_SHMA: 3,
  /** Sof zman tefillah (latest prayer) */
  SOF_ZMAN_TEFILLAH: 4,
  /** Mincha gedola (earliest afternoon prayer) */
  MINCHA_GEDOLA: 6.5,
  /** Mincha ketana (late afternoon prayer) */
  MINCHA_KETANA: 9.5,
  /** Plag hamincha */
  PLAG_HAMINCHA: 10.75,
} as const;

/**
 * Additional algorithm timing values.
 */
export const ALGORITHM_MINUTES = {
  /** Rabbeinu Tam tzeis (72 minutes after sunset) */
  TZEIS_RT: 72,
} as const;

// =============================================================================
// Email Subject Patterns
// =============================================================================

/**
 * Email subject patterns for waiting on specific email types.
 */
export const EMAIL_SUBJECTS = {
  INVITATION: 'invited',
  PASSWORD_RESET: 'reset',
  APPROVAL: 'approved',
} as const;

// =============================================================================
// Storage State Paths
// =============================================================================

/**
 * Paths for Playwright authentication storage state files.
 */
export const STORAGE_STATE = {
  ADMIN: 'test-results/.auth/admin.json',
  PUBLISHER: 'test-results/.auth/publisher.json',
  USER: 'test-results/.auth/user.json',
} as const;

// =============================================================================
// Consolidated Export
// =============================================================================

/**
 * All configuration values in a single object.
 * Useful for destructuring or passing to functions.
 */
export const TestConfig = {
  // URLs
  BASE_URL,
  API_URL,

  // Auth
  TEST_PASSWORD,

  // Email
  TEST_EMAIL_DOMAIN,
  TEST_EMAIL_DOMAINS,
  TEST_EMAIL_PREFIX,

  // Timeouts
  TIMEOUTS,

  // Pagination
  PAGINATION,

  // Prefixes
  TEST_PREFIX,
  E2E_PUBLISHER_PREFIX,
  TEST_WEBSITE_URL,

  // Algorithm
  ALGORITHM_ANGLES,
  ALGORITHM_HOURS,
  ALGORITHM_MINUTES,

  // Email subjects
  EMAIL_SUBJECTS,

  // Storage
  STORAGE_STATE,
} as const;

export default TestConfig;
