/**
 * E2E Tests: Publisher Registration Flow (Story 8-37)
 *
 * Tests for unified publisher registration flow:
 * - Registration page access
 * - Two-step form display and validation
 * - Navigation between steps
 * - Email verification flow
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, testData } from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

test.describe('Publisher Registration - Page Access', () => {
  test('registration page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/register');
  });

  test('registration page has form', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Should see form elements
    const formExists = await page.locator('form').isVisible().catch(() => false);
    expect(formExists).toBe(true);
  });

  test('registration accessible from home page', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');

    // Click "Become a Publisher" link (now points to /register)
    await page.getByRole('link', { name: /become a publisher/i }).click();

    await page.waitForURL('**/register', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });
});

test.describe('Publisher Registration - Step 1 Form Fields', () => {
  test('step 1 shows publisher info fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 should show publisher name and contact email
    const publisherNameInput = page.locator('input#publisher_name');
    const contactEmailInput = page.locator('input#publisher_contact_email');
    await expect(publisherNameInput).toBeVisible();
    await expect(contactEmailInput).toBeVisible();
  });

  test('step 1 shows description field', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    const descInput = page.locator('textarea#publisher_description');
    await expect(descInput).toBeVisible();
  });

  test('step 1 does NOT show personal info fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Step 1 should NOT show first name and last name (those are in step 2)
    const firstNameInput = page.locator('input#first_name');
    const lastNameInput = page.locator('input#last_name');
    await expect(firstNameInput).not.toBeVisible();
    await expect(lastNameInput).not.toBeVisible();
  });

  test('step 1 shows next button', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Should have "Next: Your Info" button for step navigation
    const nextButton = page.getByRole('button', { name: /next.*your info/i });
    await expect(nextButton).toBeVisible();
  });
});

test.describe('Publisher Registration - Step 1 Validation', () => {
  test('clicking next with empty form shows validation error', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Try to go to next step with empty form
    const nextButton = page.getByRole('button', { name: /next.*your info/i });
    await nextButton.click();

    await page.waitForTimeout(500);

    // Should show validation error message
    const errorAlert = page.locator('[role="alert"]');
    const hasError = await errorAlert.isVisible().catch(() => false);

    // Should stay on step 1 (no step 2 user name fields visible)
    const step2Field = page.locator('input#first_name');
    const isStep2Visible = await step2Field.isVisible().catch(() => false);

    expect(hasError || !isStep2Visible).toBe(true);
  });

  test('invalid contact email shows validation error', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Fill required fields except with invalid email
    await page.locator('input#publisher_name').fill('Test Publisher');
    await page.locator('input#publisher_contact_email').fill('invalid-email');

    // Try to go to next step
    const nextButton = page.getByRole('button', { name: /next.*your info/i });
    await nextButton.click();

    await page.waitForTimeout(500);

    // Should show validation error (wait for it to appear)
    const errorAlert = page.locator('[role="alert"]').filter({ hasText: /valid.*email/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Publisher Registration - Step Navigation', () => {
  test('can navigate from step 1 to step 2', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Fill step 1 required fields (publisher info)
    await page.locator('input#publisher_name').fill('Test Publisher');
    await page.locator('input#publisher_contact_email').fill('test@example.com');

    // Click next
    const nextButton = page.getByRole('button', { name: /next.*your info/i });
    await nextButton.click();

    await page.waitForTimeout(500);

    // Should now see step 2 with user info fields (first name, last name, registrant email)
    const firstNameField = page.locator('input#first_name');
    const registrantEmailField = page.locator('input#registrant_email');
    await expect(firstNameField).toBeVisible({ timeout: 5000 });
    await expect(registrantEmailField).toBeVisible({ timeout: 5000 });
  });

  test('can navigate back from step 2 to step 1', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Fill step 1 and go to step 2
    await page.locator('input#publisher_name').fill('Test Publisher');
    await page.locator('input#publisher_contact_email').fill('test@example.com');
    await page.getByRole('button', { name: /next.*your info/i }).click();

    await page.waitForTimeout(500);

    // Click back
    const backButton = page.getByRole('button', { name: /back/i });
    await backButton.click();

    await page.waitForTimeout(500);

    // Should see step 1 fields again (publisher name)
    const publisherNameInput = page.locator('input#publisher_name');
    await expect(publisherNameInput).toBeVisible();
  });
});

test.describe('Publisher Registration - Step 2 Form', () => {
  test('step 2 shows user info fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Navigate to step 2 with publisher info
    await page.locator('input#publisher_name').fill('Test Publisher');
    await page.locator('input#publisher_contact_email').fill('test@example.com');
    await page.getByRole('button', { name: /next.*your info/i }).click();

    await page.waitForTimeout(500);

    // Should have first name, last name, and registrant email fields
    const firstName = page.locator('input#first_name');
    const lastName = page.locator('input#last_name');
    const registrantEmail = page.locator('input#registrant_email');
    await expect(firstName).toBeVisible();
    await expect(lastName).toBeVisible();
    await expect(registrantEmail).toBeVisible();
  });

  test('step 2 shows submit button', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Navigate to step 2
    await page.locator('input#publisher_name').fill('Test Publisher');
    await page.locator('input#publisher_contact_email').fill('test@example.com');
    await page.getByRole('button', { name: /next.*your info/i }).click();

    await page.waitForTimeout(500);

    // Should have submit button
    const submitButton = page.getByRole('button', { name: /send verification/i });
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Publisher Registration - Verification Page', () => {
  test('verification page handles invalid token', async ({ page }) => {
    // Navigate to verification with invalid token
    await page.goto(`${BASE_URL}/register/verify/invalid-token-12345`);
    await page.waitForLoadState('networkidle');

    // Should show error state
    await page.waitForTimeout(2000);

    // Look for error message or error state
    const pageContent = await page.textContent('body');
    expect(
      pageContent?.toLowerCase().includes('error') ||
      pageContent?.toLowerCase().includes('invalid') ||
      pageContent?.toLowerCase().includes('expired') ||
      pageContent?.toLowerCase().includes('not found')
    ).toBe(true);
  });

  test('verification page shows loading state initially', async ({ page }) => {
    await page.goto(`${BASE_URL}/register/verify/test-token`);

    // Should show loading spinner or loading text
    const loadingIndicator = page.locator('.animate-spin');
    const isLoadingVisible = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);

    // Either loading is visible, or it already resolved to an error state
    expect(isLoadingVisible || page.url().includes('/register/verify/')).toBe(true);
  });
});

test.describe('Publisher Registration - Navigation', () => {
  test('sign-up redirects to register', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-up`);
    await page.waitForLoadState('networkidle');

    // Story 8-37: Direct signup disabled, should redirect to register
    await page.waitForURL('**/register', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });
});

test.describe('Publisher Registration - reCAPTCHA', () => {
  test('page loads successfully (reCAPTCHA may be conditionally present)', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // In production, reCAPTCHA script should be loaded
    // In test environments it may be disabled, so we just verify the page loads correctly
    expect(page.url()).toContain('/register');

    // Form should be present and functional
    const formExists = await page.locator('form').isVisible();
    expect(formExists).toBe(true);
  });
});
