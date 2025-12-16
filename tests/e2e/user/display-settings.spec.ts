/**
 * E2E Tests: Display Settings Toggle
 *
 * Tests for seconds display preferences on anonymous zmanim pages:
 * - Toggle persists across page refresh
 * - Settings stored in cookies
 * - Story 8-34: Seconds Display Toggle
 *
 * Note: Rounding mode is now a per-zman publisher setting (set via ZmanCard),
 * not a user preference. These tests focus on the Show Seconds toggle only.
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

test.describe('Display Settings - Anonymous Zmanim Page', () => {
  let testPublisher: { id: string; name: string };
  let testCity: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    // Create a publisher with coverage
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_DisplaySettings_Publisher',
    });

    // Add algorithm (status: 'active' is the valid value, not 'published')
    await createTestAlgorithm(testPublisher.id, {
      name: 'TEST_DisplaySettings_Algorithm',
      status: 'active',
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

  test('zmanim page shows display settings toggle', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Should have "Show Seconds" label
    await expect(page.getByText('Show Seconds')).toBeVisible({ timeout: 10000 });
  });

  test('seconds toggle defaults to OFF on anonymous page', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // The switch should exist
    const switchElement = page.locator('#show-seconds');
    await expect(switchElement).toBeVisible({ timeout: 10000 });

    // Should be unchecked (OFF) by default on anonymous page
    const isChecked = await switchElement.getAttribute('aria-checked');
    expect(isChecked).toBe('false');
  });

  test('seconds toggle can be turned ON', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // The switch should be OFF initially
    const switchElement = page.locator('#show-seconds');
    await expect(switchElement).toHaveAttribute('aria-checked', 'false');

    // Click to turn it ON
    await switchElement.click();

    // Should now be ON
    await expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  test('seconds toggle can be turned OFF after being ON', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Turn ON seconds
    const switchElement = page.locator('#show-seconds');
    await switchElement.click();
    await expect(switchElement).toHaveAttribute('aria-checked', 'true');

    // Turn it back OFF
    await switchElement.click();
    await expect(switchElement).toHaveAttribute('aria-checked', 'false');
  });

  test('seconds toggle persists across page refresh', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/${testPublisher.id}`);
    await page.waitForLoadState('networkidle');

    // Toggle seconds ON
    const switchElement = page.locator('#show-seconds');
    await switchElement.click();

    // Verify it's ON
    await expect(switchElement).toHaveAttribute('aria-checked', 'true');

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be ON after refresh
    const switchAfterRefresh = page.locator('#show-seconds');
    await expect(switchAfterRefresh).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Display Settings - Cookie Verification', () => {
  let testCity: { id: string; name: string } | null = null;

  test.beforeAll(async () => {
    testCity = await getTestCity('Jerusalem');
  });

  test('seconds preference stored in cookie', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/default`);
    await page.waitForLoadState('networkidle');

    // Toggle seconds ON
    const switchElement = page.locator('#show-seconds');
    await switchElement.click();

    // Check cookie was set
    const cookies = await page.context().cookies();
    const secondsCookie = cookies.find(c => c.name === 'zmanim_show_seconds');
    expect(secondsCookie).toBeDefined();
    expect(secondsCookie?.value).toBe('true');
  });

  test('seconds OFF stored in cookie', async ({ page }) => {
    if (!testCity) {
      test.skip();
      return;
    }

    // Clear cookies first
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/zmanim/${testCity.id}/default`);
    await page.waitForLoadState('networkidle');

    // First turn ON to set a cookie
    const switchElement = page.locator('#show-seconds');
    await switchElement.click();

    // Wait for cookie to be set
    await page.waitForTimeout(100);

    // Turn it OFF
    await switchElement.click();

    // Check cookie was updated to 'false'
    const cookies = await page.context().cookies();
    const secondsCookie = cookies.find(c => c.name === 'zmanim_show_seconds');
    expect(secondsCookie).toBeDefined();
    expect(secondsCookie?.value).toBe('false');
  });
});
