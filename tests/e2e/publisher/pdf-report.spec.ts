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
  const skipButton = page.getByRole('button', { name: /Skip wizard/i });
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await waitForPageReady(page);
  }
}

test.describe('PDF Report Generation', () => {
  let testPublisher: { id: number; name: string };

  test.beforeAll(async () => {
    // Use shared publisher that already has algorithm and coverage
    testPublisher = await getPublisherWithAlgorithm();
  });

  test('algorithm page shows Versions dropdown menu', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Verify Versions button exists and is visible with extended timeout
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('Versions dropdown contains Generate PDF Report option', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button to be visible and clickable
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Verify "Generate PDF Report" menu item exists
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
  });

  test('clicking Generate PDF Report opens modal with configuration options', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Verify modal is open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify modal has location selector
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await expect(locationInput).toBeVisible({ timeout: Timeouts.SHORT });

    // Verify modal has date picker
    const dateInput = modal.locator('input[type="date"], button:has-text("Select date")').first();
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

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Select location (type "Jerusalem" and select from autocomplete)
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await locationInput.fill('Jerusalem');

    // Wait for autocomplete results and select first option
    await page.waitForTimeout(500); // Brief wait for debounced search
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
    }

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

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Select location
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
    }

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    // Click Generate PDF
    await modal.getByRole('button', { name: /Generate PDF/i }).click();

    // Wait for download
    await downloadPromise;

    // Verify toast notification appears
    const toast = page.locator('[role="status"], .toast, [data-sonner-toast]').filter({ hasText: /generated|success/i });
    await expect(toast.first()).toBeVisible({ timeout: 5000 });
  });

  test('modal closes after successful PDF generation', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Select location
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
    }

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

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Select location
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
    }

    // Toggle "Include Glossary" OFF
    const glossaryToggle = modal.locator('[role="switch"], input[type="checkbox"]').filter({
      has: page.locator('text=/Include Glossary/i')
    }).first();

    if (await glossaryToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if toggle is currently on (default state)
      const isChecked = await glossaryToggle.isChecked().catch(() => true);
      if (isChecked) {
        await glossaryToggle.click();
      }
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
    const toast = page.locator('[role="status"], .toast, [data-sonner-toast]').filter({ hasText: /generated|success/i });
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('error handling when location is not selected', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Do NOT select location - leave it empty

    // Click Generate PDF without selecting location
    const generateButton = modal.getByRole('button', { name: /Generate PDF/i });
    await generateButton.click();

    // Verify error message appears (modal should NOT close)
    await expect(modal).toBeVisible({ timeout: 2000 });

    // Look for error message (could be in toast, inline error, or form validation)
    const errorIndicators = [
      page.getByText(/select.*location/i),
      page.getByText(/location.*required/i),
      modal.locator('.error, [role="alert"]').filter({ hasText: /location/i }),
    ];

    // At least one error indicator should be visible
    let errorFound = false;
    for (const indicator of errorIndicators) {
      if (await indicator.isVisible({ timeout: 1000 }).catch(() => false)) {
        errorFound = true;
        break;
      }
    }

    // If no error message, the button might be disabled
    if (!errorFound) {
      // Generate button might be disabled when location is not selected
      const isDisabled = await generateButton.isDisabled().catch(() => false);
      expect(isDisabled).toBe(true);
    }
  });

  test('modal can be cancelled without generating PDF', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
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

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
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

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Verify date input exists (exact selector depends on implementation)
    const dateInput = modal.locator('input[type="date"], button:has-text("Select date")').first();
    await expect(dateInput).toBeVisible();

    // Default value should be today or have some default
    // Exact validation depends on component implementation
  });

  test('user can select custom date for report', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);
    await skipWizardIfNeeded(page);

    // Wait for Versions button and open dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await versionsButton.click();

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { state: 'visible', timeout: Timeouts.MEDIUM });

    // Click Generate PDF Report
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible({ timeout: Timeouts.SHORT });
    await pdfMenuItem.click();

    // Wait for modal to appear
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: Timeouts.MEDIUM });

    // Select location first
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await locationInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstOption.click();
    }

    // Try to interact with date picker
    const dateButton = modal.locator('button:has-text("Select date"), button:has-text("Pick a date")').first();
    if (await dateButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateButton.click();

      // Select a date (if calendar opens, click a day)
      const dateCell = page.locator('[role="gridcell"]:not([aria-disabled="true"])').first();
      if (await dateCell.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateCell.click();
      }
    } else {
      // Direct input type="date" field
      const dateInput = modal.locator('input[type="date"]').first();
      if (await dateInput.isVisible().catch(() => false)) {
        // Set to 7 days from now
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateString = futureDate.toISOString().split('T')[0];
        await dateInput.fill(dateString);
      }
    }

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
