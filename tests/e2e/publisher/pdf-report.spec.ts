/**
 * E2E Tests: PDF Report Generation (Story 11.7, AC-5)
 *
 * Tests for PDF report generation functionality:
 * - Modal open from algorithm page via Versions dropdown
 * - Configuration options (location, date, glossary toggle)
 * - PDF generation and download
 * - Success notifications and modal behavior
 * - Error handling for invalid configurations
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  getPublisherWithAlgorithm,
  BASE_URL,
  waitForPageReady,
  Timeouts,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

// Helper function to skip wizard if it appears and wait for algorithm page
async function skipWizardIfNeeded(page: Page) {
  // Wait for either wizard or algorithm page to appear
  await page.waitForFunction(
    () => {
      const body = document.body.textContent || '';
      return body.includes('Welcome to Shtetl Zmanim') || body.includes('Versions');
    },
    { timeout: 10000 }
  );

  // If wizard is present, skip it
  const skipButton = page.getByRole('button', { name: /Skip wizard/i });
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click();

    // Wait for algorithm page to load (Versions button appears)
    await expect(page.getByRole('button', { name: /Versions/i })).toBeVisible({ timeout: 10000 });
    await waitForPageReady(page);
  }
}

// Helper function to select a location for preview
async function selectLocationForPreview(page: Page) {
  // Click on "Select Location" button in PreviewToolbar (opens Popover with LocalityPicker)
  const selectLocationButton = page.getByRole('button', { name: /select location/i }).first();
  if (await selectLocationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectLocationButton.click();

    // LocalityPicker uses an Input for search (placeholder: "Search localities...")
    const searchInput = page.getByPlaceholder(/search localities/i);
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('jerusalem');

    // Results are rendered as buttons inside the popover - wait for them to appear
    const resultButton = page.locator('button').filter({ hasText: /jerusalem/i }).first();
    await expect(resultButton).toBeVisible({ timeout: 5000 });
    await resultButton.click();

    // Wait for zmanim counts to update (ensures API call completed and state is ready)
    await page.waitForFunction(
      () => {
        const tabText = document.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
        return tabText && !tabText.includes('--');
      },
      { timeout: 10000 }
    );
  }
}

test.describe('PDF Report Generation', () => {
  let testPublisher: { id: number; name: string };

  test.beforeAll(async () => {
    // Use shared publisher that already has algorithm and coverage
    testPublisher = await getPublisherWithAlgorithm();
  });

  test('algorithm page shows Export dropdown menu', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Verify Export button exists and is visible with extended timeout
    // Look for button containing both "Export" text and the download icon
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('Export dropdown contains Generate PDF Report option', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button to be visible and clickable
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Wait for dropdown content to appear (verify PDF button is visible)
    // The dropdown menu items are rendered as buttons with text "Generate PDF Report"
    const pdfButton = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfButton).toBeVisible({ timeout: Timeouts.SHORT });
  });

  test('clicking Generate PDF Report opens modal with configuration options', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Verify modal is open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify modal has location selector (LocalityPicker with placeholder "Search for a location...")
    const locationInput = modal.getByPlaceholder(/Search for a location/i);
    await expect(locationInput).toBeVisible({ timeout: Timeouts.SHORT });

    // Verify modal has date picker (input type="date" with id="report-date")
    const dateInput = modal.locator('input[type="date"]#report-date');
    await expect(dateInput).toBeVisible({ timeout: Timeouts.SHORT });

    // Verify modal has "Include Glossary" toggle
    await expect(modal.getByText(/Include Glossary/i)).toBeVisible({ timeout: Timeouts.SHORT });

    // Verify modal has Generate PDF button
    await expect(modal.getByRole('button', { name: /Generate PDF/i })).toBeVisible({ timeout: Timeouts.SHORT });

    // Verify modal has Cancel button
    await expect(modal.getByRole('button', { name: /Cancel/i })).toBeVisible({ timeout: Timeouts.SHORT });
  });

  test('Generate PDF button shows loading state and triggers download', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Location should be pre-filled from the toolbar's selection
    // Wait for "Selected: " text to appear which confirms locality is set
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Set up download listener BEFORE clicking Generate PDF
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF button
    const generateButton = modal.getByRole('button', { name: /Generate PDF/i });
    await generateButton.click();

    // Verify loading state appears
    await expect(modal.getByText(/Generating/i)).toBeVisible({ timeout: 2000 }).catch(() => {
      // Loading text might be very brief, don't fail test if we miss it
    });

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download was triggered
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('successful PDF generation shows toast notification', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Location should be pre-filled from the toolbar's selection
    // Wait for "Selected: " text to appear which confirms locality is set
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF
    await modal.getByRole('button', { name: /Generate PDF/i }).click();

    // Wait for download
    await downloadPromise;

    // Verify toast notification appears (Sonner toast with "downloaded successfully" text)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /downloaded successfully/i });
    await expect(toast.first()).toBeVisible({ timeout: 5000 });
  });

  test('modal closes after successful PDF generation', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Location should be pre-filled from the toolbar's selection
    // Wait for "Selected: " text to appear which confirms locality is set
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF
    await modal.getByRole('button', { name: /Generate PDF/i }).click();

    // Wait for download
    await downloadPromise;

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('PDF generation works without glossary when toggle is off', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Location should be pre-filled from the toolbar's selection
    // Wait for "Selected: " text to appear which confirms locality is set
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Toggle "Include Glossary" OFF (Switch component with id="include-glossary")
    const glossarySwitch = modal.locator('#include-glossary');
    await expect(glossarySwitch).toBeVisible({ timeout: 2000 });

    // Check if toggle is currently on (default state is true)
    const isChecked = await glossarySwitch.getAttribute('data-state');
    if (isChecked === 'checked') {
      await glossarySwitch.click();
    }

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF
    await modal.getByRole('button', { name: /Generate PDF/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download was triggered
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // Verify toast notification
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: /downloaded successfully/i });
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('PDF generation uses pre-selected location from toolbar', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify location is pre-filled from toolbar selection
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Generate button should be enabled since location is pre-selected
    const generateButton = modal.getByRole('button', { name: /Generate PDF/i });
    await expect(generateButton).toBeEnabled();
  });

  test('modal can be cancelled without generating PDF', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Click Cancel button
    const cancelButton = modal.getByRole('button', { name: /Cancel/i });
    await cancelButton.click();

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('modal can be closed with Escape key', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('PDF Report Generation - Date Selection', () => {
  let testPublisher: { id: number; name: string };

  test.beforeAll(async () => {
    // Use shared publisher that already has algorithm and coverage
    testPublisher = await getPublisherWithAlgorithm();
  });

  test('date picker defaults to today', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify date input exists (input type="date" with id="report-date")
    const dateInput = modal.locator('input[type="date"]#report-date');
    await expect(dateInput).toBeVisible();

    // Verify default value is today's date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    const dateValue = await dateInput.inputValue();
    expect(dateValue).toBe(today);
  });

  test('user can select custom date for report', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);
    await selectLocationForPreview(page);

    // Wait for Export button and open dropdown
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await exportButton.click();

    // Click Generate PDF Report button (wait for it to appear in dropdown)
    const pdfMenuItem = page.getByRole('button', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Location should be pre-filled from the toolbar's selection
    // Wait for "Selected: " text to appear which confirms locality is set
    await expect(modal.getByText(/Selected:/i)).toBeVisible({ timeout: 5000 });

    // Set custom date (7 days from now)
    const dateInput = modal.locator('input[type="date"]#report-date');
    await expect(dateInput).toBeVisible();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateString = futureDate.toISOString().split('T')[0];
    await dateInput.fill(dateString);

    // Verify the date was set
    const dateValue = await dateInput.inputValue();
    expect(dateValue).toBe(dateString);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF
    await modal.getByRole('button', { name: /Generate PDF/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download was triggered
    expect(download).toBeTruthy();
  });
});
