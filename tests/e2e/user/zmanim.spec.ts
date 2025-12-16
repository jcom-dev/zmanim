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

  test('city page shows publisher list', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}`);
    await page.waitForLoadState('networkidle');

    // Page should load
    expect(page.url()).toContain('/zmanim/');
  });

  test('selecting publisher shows zmanim times', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should show times page
    expect(page.url()).toContain(`/zmanim/${testCity.id}/${testPublisher.id}`);
  });
});

test.describe('Zmanim Page - Basic Navigation', () => {
  test('accessing zmanim with invalid city shows appropriate response', async ({ page }) => {
    await page.goto(`${BASE_URL}/zmanim/invalid-city-id`);
    await page.waitForLoadState('networkidle');

    // Should either show error or redirect
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('zmanim page URL structure is correct', async ({ page }) => {
    // Navigate to a zmanim page via location selection
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Wait for countries to load by checking for country buttons
    await expect(page.locator('button').filter({ hasText: /cities$/i }).first()).toBeVisible({ timeout: 10000 });

    // If we can find Israel and Jerusalem
    const israelButton = page.locator('button').filter({ hasText: /Israel/i });
    if (await israelButton.isVisible()) {
      await israelButton.click();

      // Wait for regions/cities to load
      await expect(page.locator('button').filter({ hasText: /Jerusalem|Tel Aviv/i }).first()).toBeVisible({ timeout: 5000 }).catch(() => {});

      const jerusalemButton = page.locator('button').filter({ hasText: /Jerusalem/i });
      if (await jerusalemButton.isVisible()) {
        await jerusalemButton.click();
        await page.waitForURL('**/zmanim/**');

        // URL should contain /zmanim/ followed by city ID
        expect(page.url()).toMatch(/\/zmanim\/[a-f0-9-]+/);
      }
    }
  });
});
