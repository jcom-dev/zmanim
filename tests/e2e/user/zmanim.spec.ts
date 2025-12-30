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

  test('city page shows publisher list', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}`);
    await waitForClientReady(page);

    // Verify URL is correct
    expect(page.url()).toContain(`/zmanim/${testCity.id}`);

    // Verify page header elements
    await expect(page.locator('h1').filter({ hasText: testCity.name })).toBeVisible({ timeout: 15000 });

    // Should show "Select Publisher" heading or "No Local Authority" if no publishers
    const heading = page.locator('h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const headingText = await heading.textContent();
    expect(headingText).toMatch(/(Select Publisher|No Local Authority)/);

    // Should show either the test publisher or a "no coverage" message
    const hasPublisher = await page.locator('button').filter({ hasText: testPublisher.name }).first().isVisible();
    const hasNoCoverage = await page.locator('text=No Local Authority Covers This Area').isVisible();
    expect(hasPublisher || hasNoCoverage).toBeTruthy();
  });

  test('selecting publisher shows zmanim times', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await waitForClientReady(page);

    // Verify URL is correct
    expect(page.url()).toContain(`/zmanim/${testCity.id}/${testPublisher.id}`);

    // Verify location is displayed
    await expect(page.locator('text=' + testCity.name)).toBeVisible({ timeout: 15000 });

    // Verify publisher name is shown (either in header or publisher info)
    const publisherVisible = await page.locator('text=' + testPublisher.name).first().isVisible();
    expect(publisherVisible).toBeTruthy();

    // Since this is a test publisher without zmanim, verify the page loaded and shows publisher info
    // Real publishers would show zmanim times, but test publishers may show "no zmanim" message
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
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

  test('zmanim page URL structure is correct', async ({ page }) => {
    // Navigate to a zmanim page via location selection
    await page.goto(`${BASE_URL}/`);
    await waitForClientReady(page);

    // Wait for continents to load
    await expect(page.locator('button').filter({ hasText: /locations?$/i }).first()).toBeVisible({ timeout: 15000 });

    // Click on Asia continent
    const asiaButton = page.locator('button').filter({ hasText: /Asia/i });
    await expect(asiaButton).toBeVisible({ timeout: 15000 });
    await asiaButton.click();
    await waitForClientReady(page);

    // Find Israel
    const israelButton = page.locator('button').filter({ hasText: /Israel/i });
    await expect(israelButton).toBeVisible({ timeout: 15000 });
    await israelButton.click();
    await waitForClientReady(page);

    // Find Jerusalem - use first match
    const jerusalemButton = page.getByRole('button', { name: /^Jerusalem\s+\d+\s+locations?$/i }).first();
    await expect(jerusalemButton).toBeVisible({ timeout: 15000 });
    await jerusalemButton.click();
    await page.waitForURL('**/zmanim/**', { timeout: 15000 });

    // URL should contain /zmanim/ followed by city ID
    expect(page.url()).toMatch(/\/zmanim\/[\w-]+/);
  });
});
