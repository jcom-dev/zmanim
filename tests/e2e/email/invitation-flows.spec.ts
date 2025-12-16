/**
 * E2E Tests: Email Invitation Flows
 *
 * Tests for email-based invitation flows using MailSlurp:
 * - Admin inviting user to publisher
 * - User receiving invitation email
 * - Accept invitation flow
 *
 * These tests require MAILSLURP_API_KEY to be configured.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  createTestPublisherEntity,
  createTestInbox,
  waitForInvitationEmail,
  isMailSlurpConfigured,
  cleanupTestData,
  cleanupAllInboxes,
  BASE_URL,
} from '../utils';

// Enable parallel mode for faster test execution
test.describe.configure({ mode: 'parallel' });

// Skip all tests if MailSlurp is not configured
test.beforeEach(async () => {
  if (!isMailSlurpConfigured()) {
    test.skip();
  }
});

test.afterAll(async () => {
  await cleanupTestData();
  if (isMailSlurpConfigured()) {
    await cleanupAllInboxes();
  }
});

test.describe('Admin Invitation Flow', () => {
  test('admin can open invite dialog on publisher details', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Invite_Flow',
      status: 'verified',
    });

    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Click invite user button
    await page.getByRole('button', { name: 'Invite User' }).click();

    // Dialog should open
    await expect(page.getByText('Invite User to Publisher')).toBeVisible();
    await expect(page.getByPlaceholder('user@example.com')).toBeVisible();
  });

  test('admin can send invitation to test email', async ({ page }) => {
    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Send_Invite',
      status: 'verified',
    });

    // Create a test inbox
    const inbox = await createTestInbox('invite-test');

    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Open invite dialog
    await page.getByRole('button', { name: 'Invite User' }).click();

    // Fill in the test email
    await page.getByPlaceholder('user@example.com').fill(inbox.emailAddress);

    // Send invitation
    await page.getByRole('button', { name: /send/i }).click();

    // Should see success message
    await expect(page.getByText(/success|sent/i)).toBeVisible({ timeout: 10000 });
  });

  test.skip('invitation email is received and contains accept link', async ({ page }) => {
    // This test is skipped by default as it requires a working email service
    // Enable when email sending is fully configured

    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Email_Received',
      status: 'verified',
    });

    const inbox = await createTestInbox('email-received-test');

    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    // Send invitation
    await page.getByRole('button', { name: 'Invite User' }).click();
    await page.getByPlaceholder('user@example.com').fill(inbox.emailAddress);
    await page.getByRole('button', { name: /send/i }).click();

    // Wait for success
    await expect(page.getByText(/success|sent/i)).toBeVisible({ timeout: 10000 });

    // Wait for email to arrive
    const { email, acceptLink } = await waitForInvitationEmail(inbox.id);

    expect(email).toBeTruthy();
    expect(email.subject).toContain('invited');
    expect(acceptLink).toBeTruthy();
  });

  test.skip('accept invitation link works', async ({ page }) => {
    // This test is skipped by default
    // Enable when full invitation flow is working

    const publisher = await createTestPublisherEntity({
      name: 'TEST_E2E_Accept_Invite',
      status: 'verified',
    });

    const inbox = await createTestInbox('accept-invite-test');

    await loginAsAdmin(page);

    // Send invitation
    await page.goto(`${BASE_URL}/admin/publishers/${publisher.id}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Invite User' }).click();
    await page.getByPlaceholder('user@example.com').fill(inbox.emailAddress);
    await page.getByRole('button', { name: /send/i }).click();

    await expect(page.getByText(/success|sent/i)).toBeVisible({ timeout: 10000 });

    // Get the accept link from email
    const { acceptLink } = await waitForInvitationEmail(inbox.id);
    expect(acceptLink).toBeTruthy();

    // Clear admin auth
    await page.context().clearCookies();

    // Visit accept link
    await page.goto(acceptLink!);
    await page.waitForLoadState('networkidle');

    // Should show accept invitation page or sign-up flow
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
