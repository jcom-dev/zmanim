/**
 * E2E Tests: Publisher Dashboard
 *
 * Smoke tests for publisher dashboard functionality:
 * - Dashboard loads with summary data
 * - Quick action links work
 * - Profile, algorithm, coverage, analytics cards display
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('dashboard loads and shows publisher name', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Should see dashboard heading or publisher name
    await expect(page.locator('body')).toContainText(/dashboard|publisher/i, { timeout: 15000 });
  });

  test('dashboard shows profile card', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Should see profile card using data-testid
    const profileCard = page.getByTestId('publisher-dashboard-profile-card');
    await expect(profileCard).toBeVisible({ timeout: 15000 });
    await expect(profileCard).toContainText(/profile/i);
  });

  test('dashboard shows algorithm status', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Should see algorithm card using data-testid
    const algorithmCard = page.getByTestId('publisher-dashboard-algorithm-card');
    await expect(algorithmCard).toBeVisible({ timeout: 15000 });
    await expect(algorithmCard).toContainText(/zmanim/i);
  });

  test('dashboard shows coverage information', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Should see coverage card using data-testid
    const coverageCard = page.getByTestId('publisher-dashboard-coverage-card');
    await expect(coverageCard).toBeVisible({ timeout: 15000 });
    await expect(coverageCard).toContainText(/coverage/i);
  });

  test('dashboard shows analytics summary', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Should see analytics card using data-testid
    const analyticsCard = page.getByTestId('publisher-dashboard-analytics-card');
    await expect(analyticsCard).toBeVisible({ timeout: 15000 });
    await expect(analyticsCard).toContainText(/analytics/i);
  });

  test('can navigate to profile from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Click on profile card using data-testid
    const profileCard = page.getByTestId('publisher-dashboard-profile-card');
    await profileCard.click();
    await waitForClientReady(page);

    // Should be on profile page
    await expect(page).toHaveURL(/\/publisher\/profile/);
  });

  test('can navigate to algorithm from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Click on algorithm card using data-testid
    const algorithmCard = page.getByTestId('publisher-dashboard-algorithm-card');
    await algorithmCard.click();
    await waitForClientReady(page);

    // Should be on algorithm page
    await expect(page).toHaveURL(/\/publisher\/algorithm/);
  });

  test('can navigate to coverage from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Click on coverage card using data-testid
    const coverageCard = page.getByTestId('publisher-dashboard-coverage-card');
    await coverageCard.click();
    await waitForClientReady(page);

    // Should be on coverage page
    await expect(page).toHaveURL(/\/publisher\/coverage/);
  });

  test('can navigate to analytics from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Click on analytics card using data-testid
    const analyticsCard = page.getByTestId('publisher-dashboard-analytics-card');
    await analyticsCard.click();
    await waitForClientReady(page);

    // Should be on analytics page
    await expect(page).toHaveURL(/\/publisher\/analytics/);
  });
});
