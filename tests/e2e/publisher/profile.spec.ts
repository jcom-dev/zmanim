/**
 * E2E Tests: Publisher Profile
 *
 * Tests for publisher profile functionality:
 * - Profile view
 * - Profile editing
 * - Form validation
 * - Success/error messages
 */

import { test, expect } from '@playwright/test';
import {
  loginAsPublisher,
  createTestPublisherEntity,
  cleanupTestData,
  cleanupPublisher,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Profile', () => {
  let testPublisher: { id: string; name: string };

  test.beforeAll(async () => {
    testPublisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Profile_Publisher',
      email: 'test-profile@test.zmanim.local',
      status: 'verified',
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('publisher can access profile page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Should see profile heading
    await expect(page.getByRole('heading', { name: 'Publisher Profile' })).toBeVisible();
  });

  test('profile page shows form fields', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Should see form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('profile form is pre-filled with current data', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Name field should be filled - wait for it to have value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(testPublisher.name, { timeout: 10000 });
  });

  test('profile has save and cancel buttons', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('cancel button navigates back to dashboard', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /cancel/i }).click();

    await page.waitForURL('**/publisher/dashboard');
    expect(page.url()).toContain('/publisher/dashboard');
  });

  test('profile shows account status section', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Account Status')).toBeVisible();
  });

  test('profile shows required field indicators', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Required fields marked with asterisk
    await expect(page.getByText('Name *')).toBeVisible();
    await expect(page.getByText('Contact Email *')).toBeVisible();
  });
});

test.describe('Publisher Profile Editing', () => {
  test('publisher can update profile name', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Edit_Name',
      status: 'verified',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Update name
    await nameInput.clear();
    await nameInput.fill('TEST_E2E_Updated_Name');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see success message
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

    await cleanupPublisher(publisher.id);
  });

  test('validation error on empty name', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Validate_Name',
      status: 'verified',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Clear name
    await nameInput.clear();

    // Try to save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see error
    await expect(page.getByText(/required/i)).toBeVisible({ timeout: 5000 });

    await cleanupPublisher(publisher.id);
  });

  test('validation error on empty email', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Validate_Email',
      email: 'test@test.zmanim.local',
      status: 'verified',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Clear email
    const emailInput = page.getByLabel(/email/i);
    await emailInput.clear();

    // Try to save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see error
    await expect(page.getByText(/required/i)).toBeVisible({ timeout: 5000 });

    await cleanupPublisher(publisher.id);
  });

  test('publisher can update website', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Edit_Website',
      status: 'verified',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Update website
    const websiteInput = page.getByLabel(/website/i);
    await websiteInput.fill('https://example.com');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see success message
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

    await cleanupPublisher(publisher.id);
  });

  test('publisher can update bio', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Edit_Bio',
      status: 'verified',
    });

    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/name/i).first();
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Update bio
    const bioInput = page.getByLabel(/bio/i);
    await bioInput.fill('This is a test bio for E2E testing.');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see success message
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

    await cleanupPublisher(publisher.id);
  });
});
