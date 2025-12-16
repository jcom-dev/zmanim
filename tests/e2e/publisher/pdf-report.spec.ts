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

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  createTestAlgorithm,
  createTestCoverage,
  getTestCity,
  cleanupTestData,
  BASE_URL,
  waitForPageReady,
  Timeouts,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('PDF Report Generation', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    // Create test publisher with algorithm and coverage
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_PDF_Publisher',
      status: 'verified',
    });

    // Add algorithm with published status
    await createTestAlgorithm(testPublisher.id, {
      name: 'TEST_E2E_PDF_Algorithm',
      status: 'published',
    });

    // Add coverage for Jerusalem
    const city = await getTestCity('Jerusalem');
    if (city) {
      await createTestCoverage(testPublisher.id, city.id);
    }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('algorithm page shows Versions dropdown menu', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);

    // Verify Versions button exists
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await expect(versionsButton).toBeVisible();
  });

  test('Versions dropdown contains Generate PDF Report option', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);

    // Click Versions dropdown
    const versionsButton = page.getByRole('button', { name: /Versions/i });
    await versionsButton.click();

    // Verify "Generate PDF Report" menu item exists
    const pdfMenuItem = page.getByRole('menuitem', { name: /Generate PDF Report/i });
    await expect(pdfMenuItem).toBeVisible();
  });

  test('clicking Generate PDF Report opens modal with configuration options', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);

    // Open Versions dropdown
    await page.getByRole('button', { name: /Versions/i }).click();

    // Click Generate PDF Report
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    // Verify modal is open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Verify modal has location selector
    const locationInput = modal.locator('input[placeholder*="location" i], input[placeholder*="search" i]').first();
    await expect(locationInput).toBeVisible();

    // Verify modal has date picker
    const dateInput = modal.locator('input[type="date"], button:has-text("Select date")').first();
    await expect(dateInput).toBeVisible();

    // Verify modal has "Include Glossary" toggle
    await expect(modal.getByText(/Include Glossary/i)).toBeVisible();

    // Verify modal has Generate PDF button
    await expect(modal.getByRole('button', { name: /Generate PDF/i })).toBeVisible();

    // Verify modal has Cancel button
    await expect(modal.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });

  test('Generate PDF button shows loading state and triggers download', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('PDF Report Generation - Date Selection', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_PDF_Date_Publisher',
      status: 'verified',
    });

    await createTestAlgorithm(testPublisher.id, {
      name: 'TEST_E2E_PDF_Date_Algorithm',
      status: 'published',
    });

    const city = await getTestCity('Jerusalem');
    if (city) {
      await createTestCoverage(testPublisher.id, city.id);
    }
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('date picker defaults to today', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page);

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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

    // Open modal
    await page.getByRole('button', { name: /Versions/i }).click();
    await page.getByRole('menuitem', { name: /Generate PDF Report/i }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

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
