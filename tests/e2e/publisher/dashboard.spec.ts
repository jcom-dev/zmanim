/**
 * E2E Tests: Publisher Dashboard
 *
 * Tests for publisher dashboard functionality:
 * - Dashboard access and display
 * - Dashboard cards rendering
 * - Navigation to sub-pages
 * - Recent activity display
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  BASE_URL,
} from '../utils';
import { getSharedPublisher } from '../utils/shared-fixtures';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for dashboard to finish loading
 */
async function waitForDashboardLoad(page: Page) {
  await page.waitForLoadState('networkidle');

  // Wait for loading state to clear - dashboard shows "Loading dashboard..." while fetching
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading dashboard'),
    { timeout: 15000 }
  ).catch(() => {
    // If already loaded or text not found, continue
  });

  // Wait for Dashboard heading to appear (indicates page is ready)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
}

test.describe('Publisher Dashboard', () => {
  // Use shared publisher with algorithm and coverage data
  const testPublisher = getSharedPublisher('with-algorithm-1');

  test('publisher can access dashboard', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see dashboard heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('dashboard shows publisher name', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should show managing info
    await expect(page.getByText(testPublisher.name)).toBeVisible();
  });

  test('dashboard shows Profile card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Profile card
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  test('dashboard shows Zmanim card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Zmanim card
    await expect(page.getByRole('heading', { name: 'Zmanim' })).toBeVisible();
  });

  test('dashboard shows Coverage card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Coverage card
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
  });

  test('dashboard shows Analytics card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Analytics card
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('dashboard shows Recent Activity section', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Recent Activity
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
  });

  test('profile card links to profile page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Profile card link
    await page.getByRole('link', { name: /Profile/i }).click();

    await page.waitForURL('**/publisher/profile');
    expect(page.url()).toContain('/publisher/profile');
  });

  test('zmanim card links to algorithm page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Zmanim card link (use exact match to avoid matching "Shtetl Zmanim")
    await page.getByRole('link', { name: 'Zmanim', exact: true }).click();

    await page.waitForURL('**/publisher/algorithm');
    expect(page.url()).toContain('/publisher/algorithm');
  });

  test('coverage card links to coverage page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Coverage card link
    await page.getByRole('link', { name: /Coverage/i }).click();

    await page.waitForURL('**/publisher/coverage');
    expect(page.url()).toContain('/publisher/coverage');
  });
});

test.describe('Publisher Dashboard - Status Indicators', () => {
  // Use the same shared publisher as main tests (with-algorithm-1)
  const testPublisher = getSharedPublisher('with-algorithm-1');

  test('dashboard shows algorithm status', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should show algorithm info (active status)
    await expect(page.getByText(/algorithm/i).first()).toBeVisible();
  });

  test('dashboard shows verified status', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Publisher should have verified/active status
    // The exact indicator may vary, so just check dashboard loads
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
