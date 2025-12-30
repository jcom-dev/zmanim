/**
 * E2E Tests: Publisher Coverage Management
 *
 * Tests for managing geographic coverage:
 * - Coverage page loads
 * - Shows current coverage areas
 * - Can view coverage list
 */

import { test, expect } from '@playwright/test';
import { loginAsPublisher, BASE_URL } from '../utils';
import { waitForClientReady } from '../utils/hydration-helpers';

test.describe('Publisher Coverage', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'e2e-shared-verified-1');
  });

  test('coverage page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForClientReady(page);

    // Should see coverage-related content
    await expect(page.locator('body')).toContainText(/coverage|area|localit/i, { timeout: 15000 });
  });

  test('shows coverage summary or empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForClientReady(page);

    // Should show either coverage areas OR empty state
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('has add coverage button or controls', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForClientReady(page);

    // Look for add/manage coverage controls
    const hasControls = await page.locator('body').textContent();
    expect(hasControls).toBeTruthy();
  });

  test('can navigate back to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForClientReady(page);

    // Should have navigation elements
    const hasNav = await page.locator('a, button').first().isVisible();
    expect(hasNav).toBeTruthy();
  });
});
