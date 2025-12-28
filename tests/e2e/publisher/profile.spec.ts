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
  cleanupPublisher,
  getSharedPublisher,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Profile', () => {
  const testPublisher = getSharedPublisher('verified-1');

  test('publisher can access profile page', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    // First navigate to dashboard to ensure PublisherContext loads
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');

    // Then navigate to profile
    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Should see profile heading
    await expect(page.getByRole('heading', { name: 'Publisher Profile' })).toBeVisible();
  });

  test('profile page shows form fields', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Should see form fields
    await expect(page.getByLabel(/publisher.*organization.*name/i)).toBeVisible();
    await expect(page.getByLabel(/contact.*email/i)).toBeVisible();
  });

  test('profile form is pre-filled with current data', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Name field should be filled - wait for it to have value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
    await expect(nameInput).toHaveValue(testPublisher.name, { timeout: 10000 });
  });

  test('profile has save and cancel buttons', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('cancel button navigates back to dashboard', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /cancel/i }).click();

    await page.waitForURL('**/publisher/dashboard');
    expect(page.url()).toContain('/publisher/dashboard');
  });

  test('profile shows account status section', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Account Status')).toBeVisible();
  });

  test('profile shows required field indicators', async ({ page }) => {
    await loginAsPublisher(page, testPublisher.id);

    await page.goto(`${BASE_URL}/publisher/profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Required fields marked with asterisk
    await expect(page.getByText('Publisher / Organization Name *')).toBeVisible();
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

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
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

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
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

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Clear email
    const emailInput = page.getByLabel(/contact.*email/i);
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

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Update website
    const websiteInput = page.getByLabel('Website');
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

    // Wait for the form to load (not the error state)
    await expect(page.getByText('Profile Information')).toBeVisible({ timeout: 15000 });

    // Wait for form to load by checking name field has value
    const nameInput = page.getByLabel(/publisher.*organization.*name/i);
    await expect(nameInput).toHaveValue(publisher.name, { timeout: 10000 });

    // Update bio
    const bioInput = page.getByLabel('Bio');
    await bioInput.fill('This is a test bio for E2E testing.');

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Should see success message
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

    await cleanupPublisher(publisher.id);
  });
});
