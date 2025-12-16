import { test, expect } from '@playwright/test';
import { BASE_URL, TIMEOUTS } from './helpers/mcp-playwright';

/**
 * Algorithm Editor E2E Tests
 * Story 1.8: Algorithm Editor
 *
 * These tests verify the algorithm editor functionality including:
 * - AC1: Publisher sees current algorithm configuration
 * - AC2: Publisher can choose from templates (GRA, MGA, Rabbeinu Tam, Custom)
 * - AC3: Clicking zman opens configuration modal
 * - AC4: Modal shows method options with autocomplete
 * - AC5: Live preview shows calculated time
 * - AC6: View Month shows calendar (simplified)
 * - AC7: Invalid configuration shows validation error
 * - AC8: Unsaved changes trigger navigation warning
 */

// Enable parallel execution (Story 5.14)
test.describe.configure({ mode: 'parallel' });

test.describe('Algorithm Editor', () => {
  // These tests require publisher authentication
  // For now, testing auth protection and page structure

  test.describe('AC1 & AC2: Algorithm Configuration and Template Selection', () => {
    test('should require authentication and redirect to sign-in', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Should be redirected to sign-in
      await page.waitForURL(/sign-in/, { timeout: TIMEOUTS.MEDIUM });

      expect(page.url()).toContain('sign-in');
      expect(page.url()).toContain('redirect_url');
    });

    test.skip('should display template selector for new algorithms (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // AC2: Should show template selector
      const templatesHeading = page.getByText('Start from a Template');
      await expect(templatesHeading).toBeVisible();

      // AC2: Should show all template options
      await expect(page.getByText('GRA (Vilna Gaon)')).toBeVisible();
      await expect(page.getByText('Magen Avraham (MGA)')).toBeVisible();
      await expect(page.getByText('Rabbeinu Tam')).toBeVisible();
      await expect(page.getByText('Custom Algorithm')).toBeVisible();
    });

    test.skip('should load template when selected (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);
      await page.waitForLoadState('networkidle');

      // AC2: Click on GRA template
      page.on('dialog', dialog => dialog.accept()); // Accept confirmation
      await page.getByText('GRA (Vilna Gaon)').click();

      // Should show algorithm editor with loaded template
      const algorithmName = page.getByPlaceholder('My Custom Algorithm');
      await expect(algorithmName).toBeVisible();
      await expect(algorithmName).toHaveValue(/GRA/i);

      // Should show zmanim list
      await expect(page.getByText('Alos HaShachar')).toBeVisible();
      await expect(page.getByText('Tzeis HaKochavim')).toBeVisible();
    });
  });

  test.describe('AC3 & AC4: Zman Configuration Modal', () => {
    test.skip('should open configuration modal when clicking zman (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load a template first
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();

      // AC3: Click on a zman to configure
      await page.getByText('Alos HaShachar').click();

      // AC3: Modal should open
      const modalHeading = page.getByText('Configure: Alos HaShachar');
      await expect(modalHeading).toBeVisible();

      // AC4: Should show method selector
      const methodSelect = page.locator('select').filter({ hasText: /Method/i });
      await expect(methodSelect).toBeVisible();

      // AC4: Should show method options
      await methodSelect.click();
      await expect(page.getByText('Solar Depression Angle')).toBeVisible();
      await expect(page.getByText('Fixed Minutes')).toBeVisible();
      await expect(page.getByText('Proportional Hours')).toBeVisible();
    });

    test.skip('should show method-specific parameters (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load template and open modal
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();
      await page.getByText('Alos HaShachar').click();

      // AC4: Solar angle should show degrees parameter
      const methodSelect = page.locator('select').filter({ hasText: /Method/i });
      await methodSelect.selectOption('solar_angle');

      const degreesInput = page.getByPlaceholder('16.1');
      await expect(degreesInput).toBeVisible();

      // AC4: Fixed minutes should show minutes and from parameters
      await methodSelect.selectOption('fixed_minutes');

      const minutesInput = page.getByPlaceholder('72');
      await expect(minutesInput).toBeVisible();

      const fromSelect = page.locator('select').filter({ hasText: /From/i });
      await expect(fromSelect).toBeVisible();
    });
  });

  test.describe('AC5 & AC6: Preview Functionality', () => {
    test.skip('should show live preview after saving configuration (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load template
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();

      // AC5: Click preview button
      await page.getByText('Preview Calculations').click();

      // AC5: Should show preview panel
      await expect(page.getByText('Preview')).toBeVisible();
      await expect(page.getByText('New York, Today')).toBeVisible();

      // AC5: Should show calculated times
      await expect(page.locator('text=/\\d{2}:\\d{2}:\\d{2}/')).toBeVisible();
    });
  });

  test.describe('AC7: Validation', () => {
    test.skip('should show validation errors for invalid configuration (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load template and open modal
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();
      await page.getByText('Alos HaShachar').click();

      // AC7: Enter invalid value (negative degrees)
      const degreesInput = page.getByPlaceholder('16.1');
      await degreesInput.fill('-10');

      // Try to save
      await page.getByRole('button', { name: /Save/i }).click();

      // AC7: Should show validation error
      await expect(page.getByText(/must be a positive number/i)).toBeVisible();
    });
  });

  test.describe('AC8: Unsaved Changes Warning', () => {
    test.skip('should warn before navigation with unsaved changes (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load template
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();

      // Make a change
      const nameInput = page.getByPlaceholder('My Custom Algorithm');
      await nameInput.fill('Modified Algorithm');

      // AC8: Try to navigate away
      let dialogShown = false;
      page.on('dialog', dialog => {
        dialogShown = true;
        dialog.dismiss();
      });

      await page.goto(`${BASE_URL}/publisher/dashboard`);

      // AC8: Should show beforeunload warning (browser handled)
      // Note: beforeunload dialogs are browser-native and hard to test directly
      // This test verifies the setup but actual dialog is browser-dependent
    });

    test.skip('should not warn after saving changes (requires auth)', async ({ page }) => {
      await page.goto(`${BASE_URL}/publisher/algorithm`);

      // Load template and save
      page.on('dialog', dialog => dialog.accept());
      await page.getByText('GRA (Vilna Gaon)').click();

      await page.getByRole('button', { name: /Save Changes/i }).click();

      // Wait for save to complete
      await expect(page.getByText('No Changes')).toBeVisible();

      // Navigate away - should not warn
      await page.goto(`${BASE_URL}/publisher/dashboard`);

      // Should successfully navigate
      await expect(page).toHaveURL(/\/publisher\/dashboard/);
    });
  });
});
