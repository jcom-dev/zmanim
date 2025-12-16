/**
 * E2E Tests: Registry Duplicate Prevention
 *
 * Tests for duplicate prevention across the Publisher Zmanim Registry Interface.
 * Covers UI-level, cross-tab, and API-level duplicate prevention.
 *
 * Story: 11.7 - E2E Testing & Performance Validation
 * Acceptance Criteria: AC-6 (Duplicate Prevention Tests)
 *
 * Test Coverage:
 * 1. UI-level duplicate prevention in Master Registry
 * 2. Cross-tab duplicate prevention (Master -> Publisher Examples)
 * 3. API-level duplicate prevention (direct API calls)
 *
 * Success Criteria:
 * - Import button disabled after importing from Master Registry
 * - Link/Copy buttons disabled for already-imported zmanim in Publisher Examples
 * - API returns 400 error when attempting duplicate import
 * - No duplicate records created in database
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  cleanupTestData,
  cleanupPublisher,
  BASE_URL,
  waitForPageReady,
  waitForLoadingComplete,
  Timeouts,
  publisherApiUrl,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Registry Duplicate Prevention - UI Level', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    // Create a fresh test publisher for these tests
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Duplicate_Prevention_UI',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupPublisher(testPublisher.id);
  });

  test('should show "Imported" badge and disable Import button after importing from Master Registry', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Navigate to registry page
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Verify Master Registry tab is active (default)
    const masterTab = page.getByRole('tab', { name: /master registry/i });
    await expect(masterTab).toHaveAttribute('aria-selected', 'true');

    // Wait for zman cards to load
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Find first available (not imported) zman card
    const firstAvailableCard = page.locator('[data-testid="zman-card"]').filter({
      hasNot: page.locator('[data-testid="imported-badge"]')
    }).first();

    // Get the zman key for later verification
    const zmanKey = await firstAvailableCard.getAttribute('data-zman-key');
    expect(zmanKey).toBeTruthy();

    // Verify Import button is enabled
    const importButton = firstAvailableCard.getByRole('button', { name: /import/i });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();

    // Click Import button
    await importButton.click();

    // Wait for navigation to algorithm page with focus parameter
    await page.waitForURL(new RegExp(`/publisher/algorithm\\?focus=${zmanKey}`), {
      timeout: Timeouts.LONG,
    });

    // Verify toast notification appears
    await expect(page.locator('text=/imported successfully/i')).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify zman is highlighted on algorithm page
    const highlightedZman = page.locator(`[data-zman-key="${zmanKey}"]`);
    await expect(highlightedZman).toBeVisible();

    // Return to registry page
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for zman cards to reload
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Find the same zman card (by data-zman-key)
    const importedCard = page.locator(`[data-testid="zman-card"][data-zman-key="${zmanKey}"]`);
    await expect(importedCard).toBeVisible();

    // Verify "Imported" badge is now visible
    const importedBadge = importedCard.locator('[data-testid="imported-badge"]');
    await expect(importedBadge).toBeVisible();
    await expect(importedBadge).toContainText(/imported/i);

    // Verify Import button is now disabled
    const disabledImportButton = importedCard.getByRole('button', { name: /import/i });
    await expect(disabledImportButton).toBeDisabled();

    // Verify button has disabled styling (opacity-50, cursor-not-allowed)
    const buttonClasses = await disabledImportButton.getAttribute('class');
    expect(buttonClasses).toContain('opacity-50');
    expect(buttonClasses).toContain('cursor-not-allowed');

    // Hover over disabled button to check tooltip
    await disabledImportButton.hover();

    // Wait for tooltip to appear
    const tooltip = page.locator('[role="tooltip"]').filter({
      hasText: /already imported/i
    });
    await expect(tooltip).toBeVisible({ timeout: Timeouts.SHORT });
  });
});

test.describe('Registry Duplicate Prevention - Cross-Tab', () => {
  let testPublisher: { id: string; name: string };
  let masterZmanId: string;
  let masterZmanKey: string;

  test.beforeAll(async () => {
    // Create a fresh test publisher for cross-tab tests
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Duplicate_Prevention_CrossTab',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupPublisher(testPublisher.id);
  });

  test('should disable Link and Copy buttons in Publisher Examples after importing from Master Registry', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Step 1: Import a master zman from Master Registry tab
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for zman cards to load
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Find first available zman and get its master_zmanim_id
    const firstCard = page.locator('[data-testid="zman-card"]').first();
    masterZmanKey = (await firstCard.getAttribute('data-zman-key')) || '';
    masterZmanId = (await firstCard.getAttribute('data-master-zman-id')) || '';

    expect(masterZmanKey).toBeTruthy();
    expect(masterZmanId).toBeTruthy();

    // Import the zman
    const importButton = firstCard.getByRole('button', { name: /import/i });
    await importButton.click();

    // Wait for navigation to algorithm page
    await page.waitForURL(new RegExp(`/publisher/algorithm\\?focus=${masterZmanKey}`), {
      timeout: Timeouts.LONG,
    });

    // Verify import succeeded
    await expect(page.locator('text=/imported successfully/i')).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Step 2: Switch to Publisher Examples tab
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Click Publisher Examples tab
    const publisherTab = page.getByRole('tab', { name: /publisher examples/i });
    await publisherTab.click();

    // Verify tab is active
    await expect(publisherTab).toHaveAttribute('aria-selected', 'true');

    // Wait for publisher selection UI
    await expect(page.getByText(/select a publisher/i)).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Step 3: Select a publisher who has the same master zman
    // In real scenario, we'd select a validated publisher (e.g., Publisher 1)
    // For this test, we'll search for and select any available publisher
    const publisherSearch = page.getByPlaceholder(/search publishers/i);
    await publisherSearch.click();

    // Wait for publisher dropdown to appear
    await page.waitForSelector('[role="listbox"]', { timeout: Timeouts.MEDIUM });

    // Select first publisher from the list (Publisher 1 or any validated publisher)
    const firstPublisher = page.locator('[role="option"]').first();
    await firstPublisher.click();

    // Wait for location selection UI to appear
    await waitForLoadingComplete(page);
    await page.waitForSelector('[data-testid="location-selector"]', { timeout: Timeouts.MEDIUM });

    // Select a location within publisher's coverage
    const locationSelector = page.getByPlaceholder(/select location/i);
    await locationSelector.click();

    // Wait for location dropdown
    await page.waitForSelector('[role="listbox"]', { timeout: Timeouts.MEDIUM });

    // Select first location from coverage
    const firstLocation = page.locator('[role="option"]').first();
    await firstLocation.click();

    // Wait for zman cards to load for selected publisher
    await waitForLoadingComplete(page);
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Step 4: Find the zman with matching master_zmanim_id
    // This zman should show "Already in Your Catalog" status
    const matchingZmanCard = page.locator(
      `[data-testid="zman-card"][data-master-zman-id="${masterZmanId}"]`
    ).first();

    // Verify card exists
    await expect(matchingZmanCard).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify status shows "Already in Your Catalog"
    const statusBadge = matchingZmanCard.locator('[data-testid="catalog-status"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText(/already in your catalog/i);

    // Verify Link button is disabled
    const linkButton = matchingZmanCard.getByRole('button', { name: /link/i });
    await expect(linkButton).toBeDisabled();

    // Verify Copy button is disabled
    const copyButton = matchingZmanCard.getByRole('button', { name: /copy/i });
    await expect(copyButton).toBeDisabled();

    // Verify buttons have disabled styling
    const linkButtonClasses = await linkButton.getAttribute('class');
    expect(linkButtonClasses).toContain('opacity-50');
    expect(linkButtonClasses).toContain('cursor-not-allowed');

    const copyButtonClasses = await copyButton.getAttribute('class');
    expect(copyButtonClasses).toContain('opacity-50');
    expect(copyButtonClasses).toContain('cursor-not-allowed');

    // Hover over disabled Link button to verify tooltip
    await linkButton.hover();
    const linkTooltip = page.locator('[role="tooltip"]').filter({
      hasText: /already have this/i
    });
    await expect(linkTooltip).toBeVisible({ timeout: Timeouts.SHORT });

    // Hover over disabled Copy button to verify tooltip
    await copyButton.hover();
    const copyTooltip = page.locator('[role="tooltip"]').filter({
      hasText: /already have this/i
    });
    await expect(copyTooltip).toBeVisible({ timeout: Timeouts.SHORT });
  });
});

test.describe('Registry Duplicate Prevention - API Level', () => {
  let testPublisher: { id: string; name: string };
  let importedMasterZmanId: string;
  let authToken: string;

  test.beforeAll(async () => {
    // Create a fresh test publisher for API tests
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Duplicate_Prevention_API',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupPublisher(testPublisher.id);
  });

  test('should return 400 error when attempting duplicate import via API', async ({ page, request }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Step 1: Import a master zman via UI first
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for zman cards to load
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Get first available zman
    const firstCard = page.locator('[data-testid="zman-card"]').first();
    importedMasterZmanId = (await firstCard.getAttribute('data-master-zman-id')) || '';
    expect(importedMasterZmanId).toBeTruthy();

    // Import the zman via UI
    const importButton = firstCard.getByRole('button', { name: /import/i });
    await importButton.click();

    // Wait for successful import
    await page.waitForURL(/\/publisher\/algorithm/, { timeout: Timeouts.LONG });
    await expect(page.locator('text=/imported successfully/i')).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Step 2: Extract auth token from cookies or storage
    // Get Clerk session token from page context
    authToken = await page.evaluate(() => {
      // Clerk stores session token in __session cookie or __clerk_db_jwt
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === '__session' || name === '__clerk_db_jwt') {
          return value;
        }
      }
      return '';
    });

    // If token not found in cookies, try to get it from Clerk client
    if (!authToken) {
      authToken = await page.evaluate(async () => {
        // Access Clerk's session token
        const clerk = (window as any).Clerk;
        if (clerk && clerk.session) {
          return await clerk.session.getToken();
        }
        return '';
      });
    }

    expect(authToken).toBeTruthy();

    // Step 3: Attempt to import the same master zman via direct API call
    const apiUrl = publisherApiUrl('/registry/import');

    const response = await request.post(apiUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Publisher-Id': testPublisher.id,
        'Content-Type': 'application/json',
      },
      data: {
        master_zmanim_id: parseInt(importedMasterZmanId, 10),
      },
    });

    // Verify response status is 400 (Bad Request)
    expect(response.status()).toBe(400);

    // Verify response body contains error message
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error');

    // Error message should indicate duplicate
    const errorMessage = responseBody.error.toLowerCase();
    expect(
      errorMessage.includes('already') ||
      errorMessage.includes('duplicate') ||
      errorMessage.includes('exists')
    ).toBe(true);

    // Step 4: Verify no duplicate record was created
    // Navigate to algorithm page and verify only ONE instance exists
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Count zman cards with matching master_zmanim_id
    const matchingCards = page.locator(
      `[data-testid="zman-card"][data-master-zman-id="${importedMasterZmanId}"]`
    );

    const count = await matchingCards.count();

    // Should have exactly ONE card (not duplicated)
    expect(count).toBe(1);
  });

  test('should handle API duplicate prevention gracefully with proper error response', async ({ page, request }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Import a master zman via UI
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    // Get a different zman for this test
    const secondCard = page.locator('[data-testid="zman-card"]').nth(1);
    const secondMasterZmanId = (await secondCard.getAttribute('data-master-zman-id')) || '';
    expect(secondMasterZmanId).toBeTruthy();

    // Import via UI
    const importButton = secondCard.getByRole('button', { name: /import/i });
    await importButton.click();

    await page.waitForURL(/\/publisher\/algorithm/, { timeout: Timeouts.LONG });
    await expect(page.locator('text=/imported successfully/i')).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Get auth token
    const token = await page.evaluate(async () => {
      const clerk = (window as any).Clerk;
      if (clerk && clerk.session) {
        return await clerk.session.getToken();
      }
      return '';
    });

    expect(token).toBeTruthy();

    // Attempt duplicate import via API
    const apiUrl = publisherApiUrl('/registry/import');

    const response = await request.post(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Publisher-Id': testPublisher.id,
        'Content-Type': 'application/json',
      },
      data: {
        master_zmanim_id: parseInt(secondMasterZmanId, 10),
      },
    });

    // Verify error response structure
    expect(response.status()).toBe(400);

    const body = await response.json();

    // Response should have standard error structure
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);

    // Optionally verify error details if API provides them
    if (body.details) {
      expect(body.details).toHaveProperty('master_zmanim_id');
      expect(body.details.master_zmanim_id).toBe(parseInt(secondMasterZmanId, 10));
    }
  });
});

test.describe('Registry Duplicate Prevention - Edge Cases', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Duplicate_EdgeCases',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupPublisher(testPublisher.id);
  });

  test('should prevent duplicate when switching between tabs multiple times', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Import a zman from Master Registry
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    const zmanCard = page.locator('[data-testid="zman-card"]').first();
    const zmanKey = await zmanCard.getAttribute('data-zman-key');
    const masterZmanId = await zmanCard.getAttribute('data-master-zman-id');

    // Import
    await zmanCard.getByRole('button', { name: /import/i }).click();
    await page.waitForURL(/\/publisher\/algorithm/, { timeout: Timeouts.LONG });

    // Switch tabs multiple times
    for (let i = 0; i < 3; i++) {
      // Go to Master Registry tab
      await page.goto(`${BASE_URL}/publisher/registry`);
      await waitForPageReady(page);

      const masterTab = page.getByRole('tab', { name: /master registry/i });
      await masterTab.click();

      // Verify zman still shows as imported
      const importedCard = page.locator(`[data-testid="zman-card"][data-zman-key="${zmanKey}"]`);
      await expect(importedCard.locator('[data-testid="imported-badge"]')).toBeVisible();
      await expect(importedCard.getByRole('button', { name: /import/i })).toBeDisabled();

      // Switch to Publisher Examples tab
      const publisherTab = page.getByRole('tab', { name: /publisher examples/i });
      await publisherTab.click();

      // Even after multiple tab switches, duplicate prevention should persist
      await expect(publisherTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('should maintain duplicate prevention state after page refresh', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // Import a zman
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    const zmanCard = page.locator('[data-testid="zman-card"]').nth(1);
    const zmanKey = await zmanCard.getAttribute('data-zman-key');

    await zmanCard.getByRole('button', { name: /import/i }).click();
    await page.waitForURL(/\/publisher\/algorithm/, { timeout: Timeouts.LONG });

    // Refresh the registry page
    await page.goto(`${BASE_URL}/publisher/registry`);
    await page.reload();
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Verify duplicate prevention persists after refresh
    await page.waitForSelector('[data-testid="zman-card"]', { timeout: Timeouts.LONG });

    const importedCard = page.locator(`[data-testid="zman-card"][data-zman-key="${zmanKey}"]`);
    await expect(importedCard.locator('[data-testid="imported-badge"]')).toBeVisible();
    await expect(importedCard.getByRole('button', { name: /import/i })).toBeDisabled();
  });
});
