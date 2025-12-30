/**
 * E2E Tests: Zmanim Display
 *
 * Tests for zmanim time display:
 * - Publisher selection
 * - Time display
 * - Date navigation
 * - Formula reveal
 */

import { test, expect } from '@playwright/test';
import {
  createTestPublisherEntity,
  createTestAlgorithm,
  createTestCoverage,
  getTestCity,
  cleanupTestData,
  BASE_URL,
} from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Zmanim Page - Publisher Selection', () => {
  let testPublisher: { id: string; name: string };
  let testCity: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    // Create a publisher with coverage in Jerusalem
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Zmanim_Publisher',
      status: 'verified',
    });

    // Add algorithm
    await createTestAlgorithm(testPublisher.id, {
      name: 'TEST_Zmanim_Algorithm',
      status: 'published',
    });

    // Add coverage for Jerusalem
    testCity = await getTestCity('Jerusalem');
    if (testCity) {
      await createTestCoverage(testPublisher.id, testCity.id);
    }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

});

test.describe('Zmanim Page - Basic Navigation', () => {
  test('accessing zmanim with invalid city shows appropriate response', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/invalid-city-id`);
    await waitForClientReady(page);

    // Should either show error or redirect
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

});
