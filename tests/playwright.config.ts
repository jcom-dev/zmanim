import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

/**
 * Playwright Configuration for Shtetl Zmanim E2E Tests
 *
 * This configuration is designed to work with:
 * - Local development (npm run dev in web/)
 * - Coder cloud development environment
 * - CI/CD pipelines
 * - Playwright MCP server for AI-assisted testing
 *
 * Features:
 * - Global setup/teardown for test user management
 * - Authentication setup projects (sign in ONCE, reuse storage state)
 * - Clerk auth helpers for authenticated testing
 * - Database fixtures for test data
 *
 * AUTHENTICATION STRATEGY:
 * To avoid Clerk rate limits (5 sign-ins per 10 seconds), we use:
 * 1. Setup projects that sign in ONCE per role
 * 2. Storage state files that persist authentication
 * 3. Tests reuse the storage state instead of signing in
 *
 * @see https://playwright.dev/docs/test-configuration
 * @see https://playwright.dev/docs/auth
 */

// Base URL from environment or default to local dev
const baseURL = process.env.BASE_URL || 'http://localhost:3001';

// Storage state file paths for authenticated sessions
const ADMIN_STORAGE_STATE = 'test-results/.auth/admin.json';
const PUBLISHER_STORAGE_STATE = 'test-results/.auth/publisher.json';
const USER_STORAGE_STATE = 'test-results/.auth/user.json';

export default defineConfig({
  // Global setup - runs once before all tests
  globalSetup: path.resolve(__dirname, './e2e/setup/global-setup.ts'),

  // Global teardown - runs once after all tests (cleanup)
  globalTeardown: path.resolve(__dirname, './e2e/setup/global-teardown.ts'),

  // Test directory
  testDir: './e2e',

  // Run tests in parallel (significantly speeds up test execution)
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only (reduced from 2 to 1 for speed)
  retries: process.env.CI ? 1 : 0,

  // Number of parallel workers
  // - CI: 8 workers for maximum parallel execution
  // - Local: Use 75% of CPUs for faster execution
  workers: process.env.CI ? 8 : '75%',

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { outputFolder: './test-results/html-report' }],
    ['json', { outputFile: './test-results/results.json' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL,

    // Collect trace only on retry to reduce overhead
    trace: 'on-first-retry',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Disable video recording for speed (enable for debugging)
    video: 'off',

    // Default timeout for actions (15s is plenty for most actions)
    actionTimeout: 15000,

    // Default navigation timeout (30s is sufficient)
    navigationTimeout: 30000,
  },

  // Configure projects with authentication setup
  // The setup projects run FIRST and create storage state files
  // The test projects then REUSE those files (no sign-in per test)
  projects: [
    // ========================================
    // SETUP PROJECTS - Run first to create auth state
    // ========================================
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // ========================================
    // TEST PROJECTS - Use pre-authenticated state
    // ========================================

    // Chromium tests with admin auth
    {
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: ADMIN_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: /.*\/admin\/.*\.spec\.ts/,
    },

    // Chromium tests with publisher auth
    {
      name: 'chromium-publisher',
      use: {
        ...devices['Desktop Chrome'],
        storageState: PUBLISHER_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: /.*\/publisher\/.*\.spec\.ts/,
    },

    // Chromium tests with regular user auth
    {
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: USER_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testMatch: /.*\/user\/.*\.spec\.ts/,
    },

    // Chromium tests without auth (public pages, auth flows)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: [
        /.*\/admin\/.*\.spec\.ts/,
        /.*\/publisher\/.*\.spec\.ts/,
        /.*\/user\/.*\.spec\.ts/,
        /.*\.setup\.ts/,
      ],
    },

    // Mobile tests - only run critical responsive tests
    // Skip mobile tests in CI for speed, run locally with INCLUDE_MOBILE=true
    ...(process.env.INCLUDE_MOBILE ? [
      {
        name: 'mobile-chrome-publisher',
        use: {
          ...devices['Pixel 5'],
          storageState: PUBLISHER_STORAGE_STATE,
        },
        dependencies: ['setup'],
        testMatch: /.*\/publisher\/.*\.spec\.ts/,
      },
      {
        name: 'mobile-chrome-admin',
        use: {
          ...devices['Pixel 5'],
          storageState: ADMIN_STORAGE_STATE,
        },
        dependencies: ['setup'],
        testMatch: /.*\/admin\/.*\.spec\.ts/,
      },
      {
        name: 'mobile-chrome',
        use: { ...devices['Pixel 5'] },
        dependencies: ['setup'],
        testIgnore: [
          /.*\/admin\/.*\.spec\.ts/,
          /.*\/publisher\/.*\.spec\.ts/,
          /.*\.setup\.ts/,
        ],
      },
    ] : []),
  ],

  // Output folder for test artifacts
  outputDir: './test-results/artifacts',

  // Run local dev server before starting the tests (disabled when using MCP)
  // The MCP server manages browser instances separately
  // In CI, the E2E workflow starts the server separately, so we just reuse it
  webServer: process.env.PLAYWRIGHT_MCP
    ? undefined
    : {
        command: 'cd ../web && npm run dev',
        url: baseURL,
        reuseExistingServer: true, // Always reuse - CI starts server in workflow, local dev starts separately
        timeout: 120000,
      },

  // Global timeout for each test (60s is sufficient for most tests)
  timeout: 60000,

  // Expect timeout (10s is sufficient for most assertions)
  expect: {
    timeout: 10000,
  },
});
