/**
 * E2E Tests: Admin Invitation UI Flows
 *
 * Tests for admin invitation UI (not actual email delivery):
 * - Admin can open invite dialog
 * - Admin can send invitation (creates invitation in DB)
 *
 * Note: These tests verify the UI and API flow. Actual email delivery
 * is tested separately when MAILSLURP_API_KEY is configured.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  createTestPublisherEntity,
  createTestInbox,
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
});
