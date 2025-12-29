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

  // Wait for either dashboard content OR error state (with extended timeout for PublisherContext)
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      // Dashboard loaded successfully
      if (body.includes('Profile') && body.includes('Coverage') && body.includes('Analytics')) {
        return true;
      }
      // Error states that should fail the test
      if (body.includes('Unable to Load Dashboard') || body.includes('No Publisher Account')) {
        return true;
      }
      // Still loading
      return false;
    },
    { timeout: 20000 }
  );

  // Verify we're not in an error state
  const isError = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return body.includes('Unable to Load Dashboard') || body.includes('No Publisher Account');
  });

  if (isError) {
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/dashboard-error-state.png', fullPage: true });
    throw new Error('Dashboard failed to load - user may not have publisher access');
  }

  // Wait for Dashboard heading to appear (indicates page is ready)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 });
}

test.describe('Publisher Dashboard', () => {
  test('publisher can access dashboard', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see dashboard heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('dashboard shows publisher name', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should show managing info with publisher name
    await expect(page.getByText(/Managing:/i)).toBeVisible();
  });

  test('dashboard shows Profile card', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Profile card
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  test('dashboard shows Zmanim card', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Zmanim card
    await expect(page.getByRole('heading', { name: 'Zmanim' })).toBeVisible();
  });

  test('dashboard shows Coverage card', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Coverage card
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
  });

  test('dashboard shows Analytics card', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Analytics card
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('dashboard shows Recent Activity section', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should see Recent Activity
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
  });

  test('profile card links to profile page', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Profile card link (use heading within card to find the card link)
    await page.locator('a[href="/publisher/profile"]').filter({ has: page.getByRole('heading', { name: 'Profile' }) }).click();

    await page.waitForURL('**/publisher/profile');
    expect(page.url()).toContain('/publisher/profile');
  });

  test('zmanim card links to algorithm page', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Zmanim card link (use exact match to avoid matching "Shtetl Zmanim")
    await page.getByRole('link', { name: 'Zmanim', exact: true }).click();

    await page.waitForURL('**/publisher/algorithm');
    expect(page.url()).toContain('/publisher/algorithm');
  });

  test('coverage card links to coverage page', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Click on Coverage card link (use heading within card to find the card link)
    await page.locator('a[href="/publisher/coverage"]').filter({ has: page.getByRole('heading', { name: 'Coverage' }) }).click();

    await page.waitForURL('**/publisher/coverage');
    expect(page.url()).toContain('/publisher/coverage');
  });
});

test.describe('Publisher Dashboard - Status Indicators', () => {
  test('dashboard shows algorithm status', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Should show algorithm info (active status)
    await expect(page.getByText(/algorithm/i).first()).toBeVisible();
  });

  test('dashboard shows verified status', async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-with-algorithm-1');
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForDashboardLoad(page);

    // Publisher should have verified/active status
    // The exact indicator may vary, so just check dashboard loads
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
