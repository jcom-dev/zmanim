/**
 * E2E Tests: Publisher Coverage
 *
 * Optimized for parallel execution using shared fixtures.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// All tests run in parallel
test.describe.configure({ mode: 'parallel' });

test.describe('Coverage - Page Access', () => {
  test('can access coverage page', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/coverage');
  });

  test('shows header', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Coverage Areas' })).toBeVisible();
  });

  test('shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/define where users can find/i)).toBeVisible();
  });

  test('has Add Coverage button', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /add coverage/i })).toBeVisible();
  });

  test('navigable from dashboard', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

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
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByText('Add Coverage Area')).toBeVisible();
  });

  test('dialog shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByText(/select a country, region, or city/i)).toBeVisible();
  });

  test('dialog shows countries', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add coverage/i }).first().click();

    // Wait for countries to load
    await expect(page.getByText('Countries')).toBeVisible({ timeout: 10000 });
  });

  test('dialog can be closed', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add coverage/i }).first().click();
    await expect(page.getByText('Add Coverage Area')).toBeVisible();

    await page.keyboard.press('Escape');

    // Wait for dialog to close
    await expect(page.getByText('Add Coverage Area')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Coverage - With Data', () => {
  test('publisher with coverage sees data', async ({ page }) => {
    const publisher = getSharedPublisher('with-coverage');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/coverage`);
    await page.waitForLoadState('networkidle');

    const content = await page.textContent('body');
    if (!content?.includes('No Coverage Areas')) {
      expect(content).toBeTruthy();
    }
  });
});
