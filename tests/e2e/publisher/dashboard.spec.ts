/**
 * E2E Tests: Publisher Dashboard
 *
 * Tests for publisher dashboard functionality:
 * - Dashboard access and display
 * - Dashboard cards rendering
 * - Navigation to sub-pages
 * - Recent activity display
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  createTestAlgorithm,
  createTestCoverage,
  getTestCity,
  cleanupTestData,
  cleanupPublisher,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Dashboard', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    // Create test publisher with algorithm and coverage
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Publisher_Dashboard',
      status: 'verified',
    });

    // Add algorithm
    await createTestAlgorithm(testPublisher.id, {
      name: 'TEST_E2E_Algorithm',
      status: 'published',
    });

    // Add coverage
    const city = await getTestCity('Jerusalem');
    if (city) {
      await createTestCoverage(testPublisher.id, city.id);
    }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('publisher can access dashboard', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see dashboard heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('dashboard shows publisher name', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should show managing info
    await expect(page.getByText(testPublisher.name)).toBeVisible();
  });

  test('dashboard shows Profile card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see Profile card
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  test('dashboard shows Zmanim card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see Zmanim card
    await expect(page.getByRole('heading', { name: 'Zmanim' })).toBeVisible();
  });

  test('dashboard shows Coverage card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see Coverage card
    await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
  });

  test('dashboard shows Analytics card', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see Analytics card
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('dashboard shows Recent Activity section', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should see Recent Activity
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
  });

  test('profile card links to profile page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Click on Profile card link
    await page.getByRole('link', { name: /Profile/i }).click();

    await page.waitForURL('**/publisher/profile');
    expect(page.url()).toContain('/publisher/profile');
  });

  test('zmanim card links to algorithm page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Click on Zmanim card link (use exact match to avoid matching "Shtetl Zmanim")
    await page.getByRole('link', { name: 'Zmanim', exact: true }).click();

    await page.waitForURL('**/publisher/algorithm');
    expect(page.url()).toContain('/publisher/algorithm');
  });

  test('coverage card links to coverage page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Click on Coverage card link
    await page.getByRole('link', { name: /Coverage/i }).click();

    await page.waitForURL('**/publisher/coverage');
    expect(page.url()).toContain('/publisher/coverage');
  });
});

test.describe('Publisher Dashboard - Status Indicators', () => {
  test('shows verified status badge for verified publisher', async ({ page }) => {
    const verifiedPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Verified_Status',
      status: 'verified',
    });

    await loginAsPublisher(page, verifiedPublisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should show verified indicator
    await expect(page.getByText(/verified/i)).toBeVisible();

    await cleanupPublisher(verifiedPublisher.id);
  });

  test('shows pending status badge for pending publisher', async ({ page }) => {
    const pendingPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Pending_Status',
      status: 'pending',
    });

    await loginAsPublisher(page, pendingPublisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should show pending indicator
    await expect(page.getByText(/pending/i)).toBeVisible();

    await cleanupPublisher(pendingPublisher.id);
  });

  test('shows draft warning for unpublished algorithm', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Draft_Algorithm',
      status: 'verified',
    });

    await createTestAlgorithm(publisher.id, {
      name: 'TEST_Draft_Algo',
      status: 'draft',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should show draft warning
    await expect(page.getByText(/draft/i)).toBeVisible();

    await cleanupPublisher(publisher.id);
  });
});
