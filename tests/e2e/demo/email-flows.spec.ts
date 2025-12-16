/**
 * Demo Test: Email Flows with MailSlurp
 *
 * Verifies email testing utilities work correctly
 * and demonstrates email flow testing patterns.
 */

import { test, expect } from '@playwright/test';
import {
  createTestInbox,
  waitForEmail,
  getEmails,
  extractLinksFromEmail,
  isMailSlurpConfigured,
  loginAsAdmin,
  createTestPublisherEntity,
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

test.describe('Email Testing Infrastructure', () => {
  test('can create a test inbox with real email address', async () => {
    const inbox = await createTestInbox('demo-inbox');

    expect(inbox.id).toBeTruthy();
    expect(inbox.emailAddress).toBeTruthy();
    // MailSlurp uses various domains: @mailslurp.xyz, @mailslurp.world, @tempsmtp.com
    expect(inbox.emailAddress).toMatch(/@(mailslurp\.(xyz|world|com)|tempsmtp\.com)$/);

    console.log(`Created test inbox: ${inbox.emailAddress}`);
  });

  test('can extract links from email body', async () => {
    const emailBody = `
      Welcome to Shtetl Zmanim!

      Click here to accept your invitation:
      https://zmanim.com/accept-invite?token=abc123

      Or visit your dashboard:
      https://zmanim.com/publisher/dashboard

      Thanks,
      The Shtetl Zmanim Team
    `;

    const links = extractLinksFromEmail(emailBody);

    expect(links).toHaveLength(2);
    expect(links).toContain('https://zmanim.com/accept-invite?token=abc123');
    expect(links).toContain('https://zmanim.com/publisher/dashboard');
  });
});

test.describe('Publisher Invitation Email Flow', () => {
  test.skip('admin invites user and user receives email', async ({ page }) => {
    // This test demonstrates the full flow but may need real email service
    // Skip for now - enable when email service is fully configured

    // 1. Create a test inbox to receive the invitation
    const inbox = await createTestInbox('invitation-test');
    console.log(`Test email: ${inbox.emailAddress}`);

    // 2. Login as admin
    await loginAsAdmin(page);

    // 3. Navigate to publisher management
    await page.goto(`${BASE_URL}/admin/publishers`);
    await page.waitForLoadState('networkidle');

    // 4. Create a publisher or find existing one
    // (This depends on your UI - adjust selectors as needed)

    // 5. Invite user to publisher using the test email
    // await page.click('[data-testid="invite-user"]');
    // await page.fill('[data-testid="invite-email"]', inbox.emailAddress);
    // await page.click('[data-testid="send-invitation"]');

    // 6. Wait for invitation email
    // const { email, acceptLink } = await waitForInvitationEmail(inbox.id);
    // expect(email.subject).toContain('invited');
    // expect(acceptLink).toBeTruthy();

    // 7. Visit the accept link
    // await page.goto(acceptLink!);
    // await page.waitForLoadState('networkidle');

    // 8. Verify user is now associated with publisher
  });
});

test.describe('Publisher Registration Email Flow', () => {
  test.skip('user registers as publisher and receives approval email', async ({
    page,
  }) => {
    // This test demonstrates the registration + approval flow
    // Skip for now - enable when email service is fully configured

    // 1. Create a test inbox for the applicant
    const inbox = await createTestInbox('registration-test');

    // 2. Go to register page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // 3. Fill registration form
    // await page.fill('[name="name"]', 'Test Rabbi');
    // await page.fill('[name="organization"]', 'Test Synagogue');
    // await page.fill('[name="email"]', inbox.emailAddress);
    // await page.fill('[name="description"]', 'Test registration for E2E');
    // await page.click('[type="submit"]');

    // 4. Verify confirmation shown
    // await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // 5. Login as admin and approve
    // await loginAsAdmin(page);
    // await page.goto(`${BASE_URL}/admin/publishers`);
    // await page.click('[data-testid="pending-requests"]');
    // await page.click('[data-testid="approve"]');

    // 6. Wait for approval email
    // const { email, dashboardLink } = await waitForApprovalEmail(inbox.id);
    // expect(email.subject).toContain('approved');
    // expect(dashboardLink).toBeTruthy();
  });
});

test.describe('Password Reset Email Flow', () => {
  test.skip('user requests password reset and receives email', async ({
    page,
  }) => {
    // This test demonstrates password reset flow
    // Skip for now - depends on Clerk or custom password reset implementation

    // 1. Create test inbox
    const inbox = await createTestInbox('password-reset-test');

    // 2. Go to profile or sign-in page
    // 3. Click "Forgot Password" or "Reset Password"
    // 4. Enter test email
    // 5. Wait for reset email
    // const { email, resetLink } = await waitForPasswordResetEmail(inbox.id);
    // expect(resetLink).toBeTruthy();
    // 6. Visit reset link and set new password
  });
});
