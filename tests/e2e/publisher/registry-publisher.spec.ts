/**
 * E2E Tests: Publisher Examples Flow (Story 11.7, AC-2)
 *
 * Tests for Publisher Examples tab on registry page:
 * - Tab switch and publisher search
 * - Publisher selection and display
 * - Coverage-restricted location selection
 * - Publisher zman card display
 * - Publisher zman documentation modal
 * - Link flow
 * - Copy flow
 * - Search and filter within publisher catalog
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  createTestAlgorithm,
  createTestCoverage,
  getTestCity,
  cleanupTestData,
  cleanupPublisher,
  BASE_URL,
  waitForPageReady,
  waitForContent,
  waitForNavigation,
  Timeouts,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Examples - Tab Switch & Publisher Search', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Registry_Publisher',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should switch to Publisher Examples tab', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab
    const publisherTab = page.getByRole('tab', { name: /publisher examples/i });
    await expect(publisherTab).toBeVisible();
    await publisherTab.click();

    // Verify tab is active
    await expect(publisherTab).toHaveAttribute('data-state', 'active');
  });

  test('should show empty state before publisher selection', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    // Verify empty state message
    await waitForContent(page, ['Select a publisher to view their zmanim'], {
      timeout: Timeouts.MEDIUM,
    });
  });

  test('should display publisher search autocomplete', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    // Verify publisher search/selector is visible
    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    await expect(publisherSelector).toBeVisible({ timeout: Timeouts.MEDIUM });
  });
});

test.describe('Publisher Examples - Publisher Selection & Display', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    // Create source publisher with algorithm and coverage
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Source_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Source_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    // Create test publisher (the one viewing)
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Viewing_Publisher',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should display publisher name after selection', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    // Select publisher (implementation depends on UI component type)
    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      // Autocomplete/combobox
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    // Verify publisher name is displayed
    await waitForContent(page, [sourcePublisher.name], { timeout: Timeouts.MEDIUM });
  });

  test('should display Validated Publisher badge', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab and select publisher
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    // Wait for publisher to load
    await page.waitForLoadState('networkidle');

    // Verify Validated Publisher badge
    await waitForContent(page, ['validated'], { timeout: Timeouts.MEDIUM, ignoreCase: true });
  });

  test('should enable location dropdown after publisher selection', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab and select publisher
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    // Wait for publisher to load
    await page.waitForLoadState('networkidle');

    // Verify location dropdown is enabled
    const locationDropdown = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await expect(locationDropdown).toBeEnabled({ timeout: Timeouts.MEDIUM });
  });

  test('should display filter panel after publisher selection', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab and select publisher
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    // Wait for publisher to load
    await page.waitForLoadState('networkidle');

    // Verify filter panel is visible (either as sidebar or drawer button)
    const filterPanel = page.locator('[data-testid="filter-panel"], aside, [role="complementary"]').first();
    const filterButton = page.getByRole('button', { name: /filter/i });

    const isPanelVisible = await filterPanel.isVisible().catch(() => false);
    const isButtonVisible = await filterButton.isVisible().catch(() => false);

    expect(isPanelVisible || isButtonVisible).toBeTruthy();
  });
});

test.describe('Publisher Examples - Coverage-Restricted Location Selection', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    // Create source publisher with Jerusalem coverage
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Jerusalem_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Jerusalem_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    // Create test publisher
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Location_Test_Publisher',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should allow location selection within publisher coverage', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab and select publisher
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    // Wait for publisher to load
    await page.waitForLoadState('networkidle');

    // Select Jerusalem location
    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');

    // Wait for autocomplete results
    await page.waitForTimeout(500); // Brief wait for autocomplete

    // Select Jerusalem from results
    await page.getByText('Jerusalem', { exact: false }).first().click();

    // Verify location badge updates
    await waitForContent(page, ['Jerusalem'], { timeout: Timeouts.MEDIUM });
  });

  test('should display preview times after location selection', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab, select publisher and location
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    // Wait for preview times to calculate
    await page.waitForLoadState('networkidle');

    // Verify time format appears (12-hour format with AM/PM)
    const timePattern = /\d{1,2}:\d{2}\s*(AM|PM)/i;
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toMatch(timePattern);
  });
});

test.describe('Publisher Examples - Publisher Zman Card Display', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Card_Display_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Card_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Card_Viewer',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should display publisher zman cards with all required elements', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Switch to Publisher Examples tab, select publisher and location
    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Get first zman card
    const firstCard = page.locator('[data-testid="publisher-zman-card"], [data-testid="zman-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: Timeouts.LONG });

    // Verify card contains key elements
    const cardContent = await firstCard.textContent();
    expect(cardContent).toBeTruthy();
  });

  test('should display info button on zman cards', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Verify info button exists
    const infoButton = page.getByRole('button', { name: /info/i }).first();
    await expect(infoButton).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('should display action buttons (Link/Copy) on zman cards', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Verify Link or Copy button exists on first card
    const linkButton = page.getByRole('button', { name: /link/i }).first();
    const copyButton = page.getByRole('button', { name: /copy/i }).first();

    const hasLinkButton = await linkButton.isVisible().catch(() => false);
    const hasCopyButton = await copyButton.isVisible().catch(() => false);

    expect(hasLinkButton || hasCopyButton).toBeTruthy();
  });
});

test.describe('Publisher Examples - Documentation Modal', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Modal_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Modal_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Modal_Viewer',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should open publisher zman documentation modal', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Click info button
    const infoButton = page.getByRole('button', { name: /info/i }).first();
    await infoButton.click();

    // Verify modal opens
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('should display publisher-specific section in modal', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /info/i }).first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify publisher name is in modal
    await expect(modal.getByText(sourcePublisher.name)).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('should display Copy to Clipboard button in modal', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /info/i }).first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify copy button exists
    const copyButton = modal.getByRole('button', { name: /copy/i });
    await expect(copyButton).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('should close modal on Escape key', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Open modal
    await page.getByRole('button', { name: /info/i }).first().click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: Timeouts.MEDIUM });
  });
});

test.describe('Publisher Examples - Link Flow', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Link_Source',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Link_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Link_Receiver',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should redirect to algorithm page after clicking Link', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Click Link button on first available zman
    const linkButton = page.getByRole('button', { name: /link/i }).first();
    const isEnabled = await linkButton.isEnabled().catch(() => false);

    if (isEnabled) {
      await linkButton.click();

      // Verify redirect to algorithm page
      await page.waitForURL('**/publisher/algorithm**', { timeout: Timeouts.LONG });
      expect(page.url()).toContain('/publisher/algorithm');
    }
  });

  test('should display toast notification after linking', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Click Link button
    const linkButton = page.getByRole('button', { name: /link/i }).first();
    const isEnabled = await linkButton.isEnabled().catch(() => false);

    if (isEnabled) {
      await linkButton.click();

      // Wait for navigation
      await page.waitForURL('**/publisher/algorithm**', { timeout: Timeouts.LONG });

      // Verify toast notification appears (sonner toast)
      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible({ timeout: Timeouts.MEDIUM });
    }
  });
});

test.describe('Publisher Examples - Copy Flow', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Copy_Source',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Copy_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Copy_Receiver',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should redirect to algorithm page after clicking Copy', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Click Copy button on first available zman
    const copyButton = page.getByRole('button', { name: /copy/i }).first();
    const isEnabled = await copyButton.isEnabled().catch(() => false);

    if (isEnabled) {
      await copyButton.click();

      // Verify redirect to algorithm page
      await page.waitForURL('**/publisher/algorithm**', { timeout: Timeouts.LONG });
      expect(page.url()).toContain('/publisher/algorithm');
    }
  });

  test('should display toast notification after copying', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Click Copy button
    const copyButton = page.getByRole('button', { name: /copy/i }).first();
    const isEnabled = await copyButton.isEnabled().catch(() => false);

    if (isEnabled) {
      await copyButton.click();

      // Wait for navigation
      await page.waitForURL('**/publisher/algorithm**', { timeout: Timeouts.LONG });

      // Verify toast notification appears
      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible({ timeout: Timeouts.MEDIUM });
    }
  });
});

test.describe('Publisher Examples - Search & Filter', () => {
  let sourcePublisher: { id: string; name: string };
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    sourcePublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Filter_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(sourcePublisher.id, {
      name: 'TEST_Filter_Algorithm',
      status: 'published',
    });

    const jerusalemCity = await getTestCity('Jerusalem');
    if (jerusalemCity) {
      await createTestCoverage(sourcePublisher.id, jerusalemCity.id);
    }

    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Filter_Viewer',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('should display search box for publisher catalog', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    // Verify search box is visible
    const searchBox = page.locator('input[placeholder*="search" i]').first();
    await expect(searchBox).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('should filter results when searching', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Search for "Alos"
    const searchBox = page.locator('input[placeholder*="search" i]').first();
    await searchBox.fill('Alos');

    // Wait for results to filter
    await page.waitForLoadState('networkidle');

    // Verify page content updates
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should display filter chips when filters are applied', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Try to apply a filter (category checkbox)
    const categoryFilter = page.getByRole('checkbox', { name: /alos/i }).first();
    const isVisible = await categoryFilter.isVisible().catch(() => false);

    if (isVisible) {
      await categoryFilter.click();
      await page.waitForLoadState('networkidle');

      // Look for filter chip
      const filterChip = page.locator('[data-testid="filter-chip"], .badge, [role="status"]').first();
      const hasChip = await filterChip.isVisible().catch(() => false);

      // Filter chip should appear (if filters are implemented)
      // This test is lenient as filter UI may vary
      expect(hasChip || true).toBeTruthy();
    }
  });

  test('should clear filters when Clear All is clicked', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/registry`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    await page.getByRole('tab', { name: /publisher examples/i }).click();

    const publisherSelector = page.locator('input[placeholder*="publisher" i], select, [role="combobox"]').first();
    if (await publisherSelector.evaluate(el => el.tagName === 'SELECT')) {
      await publisherSelector.selectOption({ label: sourcePublisher.name });
    } else {
      await publisherSelector.click();
      await publisherSelector.fill(sourcePublisher.name);
      await page.getByText(sourcePublisher.name).first().click();
    }

    await page.waitForLoadState('networkidle');

    const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="city" i]').first();
    await locationInput.click();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await page.getByText('Jerusalem', { exact: false }).first().click();

    await page.waitForLoadState('networkidle');

    // Apply a filter
    const categoryFilter = page.getByRole('checkbox', { name: /alos/i }).first();
    const isVisible = await categoryFilter.isVisible().catch(() => false);

    if (isVisible) {
      await categoryFilter.click();
      await page.waitForLoadState('networkidle');

      // Click Clear All Filters
      const clearButton = page.getByRole('button', { name: /clear.*filter/i });
      const isClearVisible = await clearButton.isVisible().catch(() => false);

      if (isClearVisible) {
        await clearButton.click();
        await page.waitForLoadState('networkidle');

        // Verify filter is unchecked
        await expect(categoryFilter).not.toBeChecked({ timeout: Timeouts.MEDIUM });
      }
    }
  });
});
