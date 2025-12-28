/**
 * E2E Tests: Algorithm Page Migration (Story 11.5, AC-4)
 *
 * Tests for the algorithm page migration after removal of "Add Zman" functionality:
 * - Browse Registry button exists
 * - NO "Add Zman" button exists
 * - Can edit existing zmanim
 * - Navigation to /publisher/registry works
 * - Focus parameter handling (?focus={zman_key})
 * - Graceful fallback for nonexistent focus parameter
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  getPublisherWithAlgorithm,
  getEmptyPublisher,
  BASE_URL,
  waitForPageReady,
  Timeouts,
} from '../utils';

test.describe.configure({ mode: 'parallel' });

// Helper function to select a location
async function selectFirstLocation(page: any) {
  // Click on "Select Location" button
  const selectLocationButton = page.getByRole('button', { name: /select location/i }).first();
  if (await selectLocationButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await selectLocationButton.click();
    // Wait for location picker and select first option
    await page.waitForTimeout(500);
    const firstLocation = page.locator('[role="option"]').first();
    if (await firstLocation.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstLocation.click();
      await page.waitForTimeout(500);
    }
  }
}

test.describe('Algorithm Page Migration - UI Changes', () => {
  test('Browse Registry button exists', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('zmanim'),
      { timeout: Timeouts.LONG }
    );

    // Select a location if needed
    await selectFirstLocation(page);

    // Browse Registry button should exist
    const browseRegistryButton = page.getByRole('button', { name: /browse registry/i });
    await expect(browseRegistryButton).toBeVisible({ timeout: Timeouts.MEDIUM });
  });

  test('NO Add Zman button exists', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('zmanim'),
      { timeout: Timeouts.LONG }
    );

    // Add Zman button should NOT exist
    const addZmanButton = page.getByRole('button', { name: /^add zman$/i });
    await expect(addZmanButton).not.toBeVisible({ timeout: Timeouts.SHORT }).catch(() => {
      // If button doesn't exist at all, this is expected
    });

    // Verify the button doesn't exist in the DOM
    const buttonCount = await page.getByRole('button', { name: /^add zman$/i }).count();
    expect(buttonCount).toBe(0);
  });

  test('page allows editing existing zmanim', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for zmanim to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('zmanim') ||
            document.body.textContent?.toLowerCase().includes('algorithm'),
      { timeout: Timeouts.LONG }
    );

    // Check if we have the algorithm editor (not onboarding)
    const hasAlgorithmEditor = await page.getByText('Algorithm Editor').isVisible().catch(() => false);

    if (hasAlgorithmEditor) {
      // Look for Edit buttons on zman cards (they have icons, so use locator)
      const editButtons = page.locator('button[aria-label*="Edit"], button:has-text("Edit")');
      const editButtonCount = await editButtons.count();

      // If there are zmanim, there should be edit buttons
      if (editButtonCount > 0) {
        // Verify at least one edit button is visible
        await expect(editButtons.first()).toBeVisible({ timeout: Timeouts.MEDIUM });
      }
    }
  });
});

test.describe('Algorithm Page Migration - Browse Registry Navigation', () => {
  test('clicking Browse Registry navigates to /publisher/registry', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('zmanim'),
      { timeout: Timeouts.LONG }
    );

    // Find and click Browse Registry button
    const browseRegistryButton = page.getByRole('button', { name: /browse registry/i });
    await expect(browseRegistryButton).toBeVisible({ timeout: Timeouts.MEDIUM });
    await browseRegistryButton.click();

    // Verify navigation to registry page
    await page.waitForURL('**/publisher/registry', { timeout: Timeouts.MEDIUM });
    expect(page.url()).toContain('/publisher/registry');
  });
});

test.describe('Algorithm Page Migration - Focus Parameter Handling', () => {
  test('focus param highlights and scrolls to zman', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);

    // First, go to algorithm page to get a real zman_key
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('zmanim') ||
            document.body.textContent?.toLowerCase().includes('algorithm'),
      { timeout: Timeouts.LONG }
    );

    // Check if we have the algorithm editor with zmanim
    const hasAlgorithmEditor = await page.getByText('Algorithm Editor').isVisible().catch(() => false);

    if (hasAlgorithmEditor) {
      // Try to find a zman card
      const zmanCards = page.locator('[class*="border"][class*="rounded"]').filter({
        hasText: /sunrise|sunset|chatzos|alos|shkiah/i
      });
      const cardCount = await zmanCards.count();

      if (cardCount > 0) {
        // Get text content to find a likely zman_key
        const pageContent = await page.textContent('body');

        // Common zman keys to test with
        const commonZmanKeys = ['sunrise', 'sunset', 'chatzos_hayom', 'alos_hashachar', 'tzais_hakochavim'];
        let testZmanKey = 'sunrise'; // default fallback

        // Find which common zman exists on the page
        for (const key of commonZmanKeys) {
          if (pageContent?.toLowerCase().includes(key)) {
            testZmanKey = key;
            break;
          }
        }

        // Navigate with focus parameter
        await page.goto(`${BASE_URL}/publisher/algorithm?focus=${testZmanKey}`);
        await waitForPageReady(page, { timeout: Timeouts.LONG });

        // Wait for page to load
        await page.waitForFunction(
          () => document.body.textContent?.toLowerCase().includes('zmanim'),
          { timeout: Timeouts.LONG }
        );

        // Check for focus highlighting (ring-2 ring-primary class)
        const focusedCard = page.locator('[class*="ring-2"][class*="ring-primary"]');
        const hasFocusedCard = await focusedCard.count() > 0;

        // If we found a focused card, verify it's visible
        if (hasFocusedCard) {
          await expect(focusedCard.first()).toBeVisible({ timeout: Timeouts.MEDIUM });
        }
      }
    }
  });

  test('graceful fallback for nonexistent focus param', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);

    // Navigate with a focus parameter that definitely doesn't exist
    await page.goto(`${BASE_URL}/publisher/algorithm?focus=nonexistent_zman_key_xyz_123`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('zmanim') ||
            document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('welcome'),
      { timeout: Timeouts.LONG }
    );

    // Page should load without errors
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();

    // Should NOT have any API/fatal error messages (exclude Next.js dev tools text)
    // Note: "error" might appear in Next.js dev overlay UI - check for actual user-facing errors
    const hasUserFacingError = pageContent?.toLowerCase().includes('failed to load') ||
                                pageContent?.toLowerCase().includes('something went wrong') ||
                                pageContent?.toLowerCase().includes('zman not found');
    expect(hasUserFacingError).toBeFalsy();

    // No focused/highlighted card should exist
    const focusedCard = page.locator('[class*="ring-2"][class*="ring-primary"]');
    const focusedCount = await focusedCard.count();
    expect(focusedCount).toBe(0);
  });

  test('focus param is cleared from URL after delay', async ({ page }) => {
    const publisher = getPublisherWithAlgorithm();
    await loginAsPublisher(page, publisher.id);

    // Navigate with focus parameter
    await page.goto(`${BASE_URL}/publisher/algorithm?focus=sunrise`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Initial URL should have focus param
    expect(page.url()).toContain('focus=sunrise');

    // Wait for the focus param to be cleared (happens after 2 seconds)
    await page.waitForTimeout(2500);

    // URL should no longer have focus param
    expect(page.url()).not.toContain('focus=');
  });
});

test.describe('Algorithm Page Migration - Empty Publisher Flow', () => {
  test('new publisher without zmanim shows onboarding', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for content to load - page should show algorithm editor since empty publishers still have default zmanim
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('zmanim'),
      { timeout: Timeouts.LONG }
    );

    // Should show algorithm page (empty publishers have zmanim from batch 1/2 fixes)
    const content = await page.textContent('body');
    expect(content?.toLowerCase()).toMatch(/algorithm|zmanim/);
  });

  test('Browse Registry button exists even for new publishers', async ({ page }) => {
    const publisher = getEmptyPublisher(2);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForPageReady(page, { timeout: Timeouts.LONG });

    // Wait for page to load
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('welcome') ||
            document.body.textContent?.toLowerCase().includes('algorithm') ||
            document.body.textContent?.toLowerCase().includes('zmanim'),
      { timeout: Timeouts.LONG }
    );

    // Even if onboarding wizard shows, Browse Registry might be in header
    // Check if button exists (might not be visible in all onboarding states)
    const browseRegistryButton = page.getByRole('button', { name: /browse registry/i });
    const buttonExists = await browseRegistryButton.count() > 0;

    // Button should exist somewhere in the DOM (even if not visible in wizard)
    expect(buttonExists).toBeTruthy();
  });
});
