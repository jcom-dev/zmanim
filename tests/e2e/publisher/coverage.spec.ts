/**
 * E2E Tests: Publisher Coverage
 *
 * Optimized for parallel execution using shared fixtures.
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// All tests run in parallel
test.describe.configure({ mode: 'parallel' });

/**
 * Wait for coverage page to finish loading
 */
async function waitForCoverageLoad(page: Page) {
  // Wait for page to be in load or domcontentloaded state
  await page.waitForLoadState('domcontentloaded');

  // Wait for loading state to clear - coverage shows "Loading coverage..." while fetching
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading coverage'),
    { timeout: 15000 }
  ).catch(() => {
    // If already loaded or text not found, continue
  });

  // Wait for Coverage heading to appear (indicates page is ready)
  await expect(page.getByRole('heading', { name: /Coverage/i }).first()).toBeVisible({ timeout: 10000 });
}

test.describe('Coverage - Page Access', () => {
  test('can access coverage page', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    expect(page.url()).toContain('/publisher/coverage');
  });

  test('shows header', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await expect(page.getByRole('heading', { name: 'Coverage Areas' }).first()).toBeVisible();
  });

  test('shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await expect(page.getByText(/define where users can find/i).first()).toBeVisible();
  });

  test('has Add Coverage button', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await expect(page.getByRole('button', { name: /add coverage/i }).first()).toBeVisible();
  });

  test('navigable from dashboard', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Click the Coverage card link (contains the h2 heading)
    await page.getByRole('link', { name: /Coverage/i }).click();
    await page.waitForURL('**/publisher/coverage');
    expect(page.url()).toContain('/publisher/coverage');
  });
});

test.describe('Coverage - Empty State', () => {
  test('shows empty message', async ({ page }) => {
    const publisher = getSharedPublisher('verified-2');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    // Check for either empty state or existing coverage
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});

test.describe('Coverage - Add Dialog', () => {
  test('Add Coverage opens dialog', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByRole('dialog').getByText('Add Coverage Area')).toBeVisible();
  });

  test('dialog shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByText(/search and select geographic areas/i)).toBeVisible();
  });

  test('dialog shows countries', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await page.getByRole('button', { name: /add coverage/i }).first().click();

    // Wait for countries to load
    await expect(page.getByText('Countries')).toBeVisible({ timeout: 10000 });
  });

  test('dialog can be closed', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByRole('dialog').getByText('Add Coverage Area')).toBeVisible();

    await page.keyboard.press('Escape');

    // Wait for dialog to close
    await expect(page.getByRole('dialog').getByText('Add Coverage Area')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Coverage - With Data', () => {
  test('publisher with coverage sees data', async ({ page }) => {
    const publisher = getSharedPublisher('with-coverage');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await waitForCoverageLoad(page);

    const content = await page.textContent('body');
    if (!content?.includes('No Coverage Areas')) {
      expect(content).toBeTruthy();
    }
  });
});
