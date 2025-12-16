/**
 * Demo Test: Publisher Authentication
 *
 * Verifies that the loginAsPublisher() helper works correctly
 * and publisher can access protected routes.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  BASE_URL,
  TIMEOUTS,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Authentication Demo', () => {
  let publisherId: string;

  test.beforeAll(async () => {
    // Create a test publisher entity in the database
    try {
      const publisher = await createTestPublisherEntity();
      publisherId = publisher.id;
      console.log(`Created test publisher: ${publisherId}`);
    } catch (error) {
      console.warn('Could not create test publisher (database may not be configured):', error);
      // Use a placeholder ID - the auth will still work, just no real publisher data
      publisherId = 'test-publisher-placeholder';
    }
  });

  test('publisher can login and access /publisher route', async ({ page }) => {
    // Login as publisher using our helper
    await loginAsPublisher(page, publisherId);

    // Navigate to publisher dashboard
    await page.goto(`${BASE_URL}/publisher`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we're on a publisher page (not redirected to sign-in)
    const url = page.url();
    expect(url).not.toContain('sign-in');

    // Should be on publisher route
    expect(url).toContain('/publisher');
  });

  test('publisher can access dashboard', async ({ page }) => {
    // Login as publisher
    await loginAsPublisher(page, publisherId);

    // Navigate to publisher dashboard
    await page.goto(`${BASE_URL}/publisher/dashboard`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Should not be redirected to sign-in
    expect(page.url()).not.toContain('sign-in');

    // Should be on dashboard
    expect(page.url()).toContain('/publisher');
  });

  test('publisher session persists across navigation', async ({ page }) => {
    // Login as publisher
    await loginAsPublisher(page, publisherId);

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Navigate to profile
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Navigate to algorithm
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Should still be authenticated (not redirected)
    expect(page.url()).not.toContain('sign-in');
  });
});
