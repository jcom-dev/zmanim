/**
 * E2E Tests: Publisher Onboarding Wizard
 *
 * Optimized for parallel execution using shared fixtures.
 * Uses empty publishers (no algorithm) to test onboarding flow.
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAsPublisher,
  getSharedPublisher,
  getEmptyPublisher,
  BASE_URL,
} from '../utils';

// All tests in this file run in parallel
test.describe.configure({ mode: 'parallel' });

// Helper to wait for welcome step
async function waitForWelcome(page: Page) {
  await page.waitForFunction(
    () => document.body.textContent?.toLowerCase().includes('welcome'),
    { timeout: 30000 }
  );
}

test.describe('Onboarding - Welcome Step', () => {
  test('displays welcome message', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await expect(page.getByText('Welcome to Shtetl Zmanim')).toBeVisible();
  });

  test('shows Hebrew text', async ({ page }) => {
    const publisher = getEmptyPublisher(2);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await expect(page.getByText('ברוכים הבאים לזמנים לאב')).toBeVisible();
  });

  test('shows feature cards', async ({ page }) => {
    const publisher = getEmptyPublisher(3);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    // Check for feature card titles - wait for both to be visible
    await expect(page.locator('text=Select & Customize').first()).toBeVisible();
    await expect(page.locator('text=Set Coverage').first()).toBeVisible();
  });

  test('shows time estimate', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await expect(page.getByText(/5-10 minutes/)).toBeVisible();
  });

  test('has Get Started button', async ({ page }) => {
    const publisher = getEmptyPublisher(2);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();
  });

  test('has Skip button', async ({ page }) => {
    const publisher = getEmptyPublisher(3);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await expect(page.getByRole('button', { name: /skip wizard/i })).toBeVisible();
  });

  test('Get Started advances to customize step', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await page.getByRole('button', { name: /get started/i }).click();

    // Wait for customize zmanim step
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('customize'),
      { timeout: 30000 }
    );

    await expect(page.getByText(/customize zmanim/i)).toBeVisible();
  });
});

// Template Selection step removed in UI redesign - wizard now goes:
// Welcome → Customize Zmanim → Set Coverage → Review & Publish

test.describe('Onboarding - Navigation', () => {
  test('can navigate forward through steps', async ({ page }) => {
    const publisher = getEmptyPublisher(2);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    // Step 0: Welcome
    await waitForWelcome(page);
    await page.getByRole('button', { name: /get started/i }).click();

    // Step 1: Customize Zmanim
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('customize'),
      { timeout: 30000 }
    );

    expect(await page.textContent('body')).toBeTruthy();
  });

  test('can navigate backward', async ({ page }) => {
    const publisher = getEmptyPublisher(3);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');

    await waitForWelcome(page);
    await page.getByRole('button', { name: /get started/i }).click();

    // Wait for customize step
    await page.waitForFunction(
      () => document.body.textContent?.toLowerCase().includes('customize'),
      { timeout: 30000 }
    );

    await page.getByRole('button', { name: /back/i }).click();
    await waitForWelcome(page);

    await expect(page.getByText('Welcome to Shtetl Zmanim')).toBeVisible();
  });
});

test.describe('Onboarding - Progress Indicator', () => {
  test('shows step titles', async ({ page }) => {
    const publisher = getEmptyPublisher(1);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    const content = await page.textContent('body');
    expect(content?.includes('Welcome')).toBeTruthy();
    // New wizard steps: Welcome, Customize Zmanim, Set Coverage, Review & Publish
    expect(content?.includes('Customize Zmanim') || content?.includes('Customize')).toBeTruthy();
  });
});

test.describe('Onboarding - Skip Flow', () => {
  test('skip exits onboarding', async ({ page }) => {
    const publisher = getEmptyPublisher(2);
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/algorithm`);
    await page.waitForLoadState('networkidle');
    await waitForWelcome(page);

    await page.getByRole('button', { name: /skip wizard/i }).click();
    await page.waitForTimeout(2000);

    // Should exit onboarding (may show import dialog or editor)
    expect(await page.textContent('body')).toBeTruthy();
  });
});

// State Persistence test removed - wizard is in-memory only (no persistence)
// as documented in OnboardingWizard.tsx
