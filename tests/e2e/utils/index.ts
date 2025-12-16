/**
 * Test Utilities Index
 *
 * Central export for all test utilities.
 * Import from '../utils' in test files.
 */

// Clerk Authentication
export {
  createTestAdmin,
  createTestPublisher,
  createTestUser,
  loginAsAdmin,
  loginAsPublisher,
  loginAsUser,
  cleanupTestUsers,
  clearUserCache,
  getTestPassword,
  getTestEmailDomain,
  logout,
} from './clerk-auth';

// Database Fixtures
export {
  createTestPublisherEntity,
  createTestAlgorithm,
  createTestCoverage,
  getTestCity,
  createFullTestPublisher,
  cleanupTestData,
  cleanupPublisher,  // Use this for individual test cleanup (parallel-safe)
  clearEntityCache,
  getTestPrefix,
  isDatabaseConfigured,
  closePool,
  linkClerkUserToPublisher,
} from './test-fixtures';

// Email Testing (MailSlurp)
export {
  createTestInbox,
  createNamedInbox,
  waitForEmail,
  waitForEmailWithSubject,
  getEmails,
  getEmailContent,
  extractLinksFromEmail,
  extractLinkContaining,
  waitForInvitationEmail,
  waitForPasswordResetEmail,
  waitForApprovalEmail,
  deleteInbox,
  cleanupAllInboxes,
  clearInbox,
  isMailSlurpConfigured,
  getMailSlurpClient,
} from './email-testing';

// Cleanup Utilities
export {
  runFullCleanup,
  clearAllCaches,
  cleanupDatabaseOnly,
  cleanupClerkOnly,
} from './cleanup';

// Re-export existing helpers
export { BASE_URL, TIMEOUTS, sleep, pages, selectors, testData } from '../helpers/mcp-playwright';

// Algorithm Fixtures
export {
  AlgorithmConfigs,
  GRA_CONFIG,
  MGA_CONFIG,
  MINIMAL_CONFIG,
  EMPTY_CONFIG,
  getAlgorithmConfig,
  createFullAlgorithmConfig,
  createTestAlgorithmConfig,
  generateTestAlgorithmName,
  validateAlgorithmConfig,
  getZmanKeys,
  hasZman,
  type AlgorithmConfig,
  type FullAlgorithmConfig,
  type AlgorithmConfigName,
  type ZmanCalculation,
} from './algorithm-fixtures';

// Wait Helpers
export {
  Timeouts,
  waitForPageReady,
  waitForClerkReady,
  waitForNavigation,
  waitForContent,
  waitForElementText,
  waitForLoadingComplete,
  waitForApiContent,
  retryAction,
  pollUntil,
  waitFor,
  waitForElementStable,
  type WaitForPageReadyOptions,
  type WaitForContentOptions,
  type WaitForApiOptions,
  type RetryOptions,
} from './wait-helpers';

// Test Builders
export {
  TestPublisher,
  TestContext,
  TestEntityTracker,
  createMinimalPublisher,
  createVerifiedPublisherWithAlgorithm,
  createFullTestSetup,
  generateTestName,
  generateTestEmail,
  type TestPublisherData,
  type TestAlgorithmData,
  type TestCoverageData,
  type TestPublisherBuildResult,
  type TestContextData,
} from './test-builders';

// Shared Fixtures (for parallel tests)
export {
  getSharedPublisher,
  getSharedPublisherAsync,
  getAnyVerifiedPublisher,
  getPublisherWithAlgorithm,
  getEmptyPublisher,
  getAllSharedPublishers,
  isSharedFixturesInitialized,
  getAvailablePublisherKeys,
  type SharedPublisher,
} from './shared-fixtures';

// API Helpers (for new API structure)
export {
  API_PATHS,
  normalizeApiPath,
  buildApiUrl,
  getApiBasePath,
  publisherApiUrl,
  adminApiUrl,
  publicApiUrl,
  apiUrl,
} from './api-helpers';

// Performance Metrics (for performance testing)
export {
  measurePageLoad,
  measureOperation,
  measureOperationDetailed,
  measureAPIResponse,
  measureMultipleAPIResponses,
  assertPageLoadPerformance,
  assertOperationPerformance,
  assertAPIPerformance,
  calculatePercentile,
  calculateStats,
  formatDuration,
  logPerformanceMetrics,
  type PageLoadMetrics,
  type APIResponseMetrics,
  type OperationMetrics,
} from './performance-metrics';
