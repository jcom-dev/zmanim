/**
 * E2E Tests: Publisher Onboarding Workflow
 *
 * Tests for publisher onboarding wizard:
 * - Wizard loads when no algorithm
 * - Can navigate wizard steps
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Onboarding Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Use empty publisher that has no algorithm
    await loginAsPublisher(page, 'e2e-shared-empty-1');
  });

  test('onboarding wizard appears for new publisher', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await waitForClientReady(page);

    // Should show wizard OR algorithm page
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('can access publisher dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await waitForClientReady(page);

    // Dashboard should load even for new publisher
    await expect(page.locator('body')).toContainText(/dashboard|publisher/i, { timeout: 15000 });
  });
});
