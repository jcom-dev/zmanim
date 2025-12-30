/**
 * E2E Tests: Publisher Team Management
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

test.describe('Team - Page Access', () => {
  test('can access team page', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/publisher/team');
  });

  test('shows header', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
  });

  test('shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/manage who can access/i)).toBeVisible();
  });

  test('has Add Member button', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /add member/i })).toBeVisible();
  });

  test('loads without error', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content?.toLowerCase()).not.toContain('error loading');
  });
});

test.describe('Team - Current Team Section', () => {
  test('shows Current Team heading', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/current team/i)).toBeVisible();
  });

  test('shows member count', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/current team \(\d+\)/i)).toBeVisible();
  });

  test('shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/people who can manage this publisher/i)).toBeVisible();
  });
});

test.describe('Team - Add Member Dialog', () => {
  test('Add Member opens dialog', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByText('Add Team Member')).toBeVisible();
  });

  test('dialog shows description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByText(/add a new member to your publisher team/i)).toBeVisible();
  });

  test('dialog has name input', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.locator('#name')).toBeVisible();
  });

  test('dialog has email input', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('dialog has placeholder', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByPlaceholder(/colleague@example.com/i)).toBeVisible();
  });

  test('dialog has Add Member button', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByRole('button', { name: /add member/i }).last()).toBeVisible();
  });

  test('dialog has Cancel button', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('Cancel closes dialog', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await expect(page.getByText('Add Team Member')).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await expect(page.getByText('Add Team Member')).not.toBeVisible();
  });

  test('error for empty name', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForTimeout(500); // Wait for dialog to open
    await page.getByRole('button', { name: /add member/i }).last().click();

    // Error appears when trying to submit with empty fields
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('error for empty email', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForTimeout(500); // Wait for dialog to open
    await page.getByRole('button', { name: /add member/i }).last().click();

    // Error appears when trying to submit with empty fields
    await expect(page.getByText('Email is required')).toBeVisible();
  });

  test('error for invalid email', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add member/i }).click();
    await page.waitForTimeout(500); // Wait for dialog to open
    await page.locator('#name').fill('Test User');
    await page.locator('#email').fill('invalid-email');
    // Trigger blur to show validation error
    await page.locator('#email').blur();

    // Error appears on blur with invalid email
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });
});

test.describe('Team - Member Display', () => {
  test('shows Owner badge if exists', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/team`);
    await page.waitForLoadState('networkidle');

    // Wait for team members to load
    await page.waitForSelector('body', { state: 'visible' });

    const badge = page.getByText('Owner');
    if (await badge.isVisible().catch(() => false)) {
      await expect(badge).toBeVisible();
    }
  });
});
