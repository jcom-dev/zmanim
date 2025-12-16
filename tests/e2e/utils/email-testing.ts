/**
 * Email Testing Utilities using MailSlurp
 *
 * Provides utilities to test email flows in E2E tests:
 * - Create test inboxes with real email addresses
 * - Wait for and retrieve emails
 * - Verify email content
 * - Extract links from emails (for invitation flows, password resets)
 */

import { MailSlurp } from 'mailslurp-client';
import { MatchOptionFieldEnum, MatchOptionShouldEnum } from 'mailslurp-client/dist/generated/models';

// Cache for created inboxes
const inboxCache = new Map<string, { id: string; emailAddress: string }>();

// Lazy-load MailSlurp client to avoid initialization errors when API key is missing
let mailslurp: MailSlurp | null = null;

function getMailSlurp(): MailSlurp {
  if (!mailslurp) {
    if (!process.env.MAILSLURP_API_KEY) {
      throw new Error('MAILSLURP_API_KEY environment variable is required');
    }
    mailslurp = new MailSlurp({
      apiKey: process.env.MAILSLURP_API_KEY,
    });
  }
  return mailslurp;
}

/**
 * Create a test inbox for receiving emails
 * Returns a real email address that can receive emails
 *
 * NOTE: To avoid exceeding free tier limits (30 inboxes/month), this function
 * reuses existing inboxes. It first checks cache, then looks for existing
 * inboxes by name, then reuses any available inbox.
 */
export async function createTestInbox(
  name?: string
): Promise<{ id: string; emailAddress: string }> {
  const cacheKey = name || 'default';

  if (inboxCache.has(cacheKey)) {
    return inboxCache.get(cacheKey)!;
  }

  // Get all existing inboxes
  const existingInboxes = await getMailSlurp().inboxController.getInboxes({});

  // Try to find an existing inbox with this name first
  let existingInbox = existingInboxes.find(
    (inbox) => inbox.name === cacheKey || inbox.name === `e2e-${cacheKey}`
  );

  // If no named inbox found, reuse any available inbox not already in cache
  if (!existingInbox && existingInboxes.length > 0) {
    const usedInboxIds = new Set([...inboxCache.values()].map((i) => i.id));
    existingInbox = existingInboxes.find((inbox) => !usedInboxIds.has(inbox.id));
  }

  if (existingInbox) {
    const result = {
      id: existingInbox.id,
      emailAddress: existingInbox.emailAddress!,
    };
    inboxCache.set(cacheKey, result);
    console.log(`Reusing existing inbox for "${cacheKey}": ${result.emailAddress}`);

    // Clear any old emails in this inbox to start fresh
    try {
      await getMailSlurp().inboxController.deleteAllInboxEmails({ inboxId: existingInbox.id });
    } catch {
      // Ignore cleanup errors
    }

    return result;
  }

  // Only create new inbox if absolutely no inboxes exist (shouldn't happen with free tier)
  console.log(`Creating new inbox for "${cacheKey}"...`);
  const inbox = await getMailSlurp().inboxController.createInbox({
    name: `e2e-${cacheKey}`,
    description: 'E2E test inbox - reusable',
  });

  const result = {
    id: inbox.id,
    emailAddress: inbox.emailAddress!,
  };

  inboxCache.set(cacheKey, result);
  console.log(`Created test inbox: ${result.emailAddress}`);

  return result;
}

/**
 * Create a named test inbox (useful for specific test scenarios)
 * Reuses existing inbox with same name if available, or any available inbox.
 */
export async function createNamedInbox(
  name: string
): Promise<{ id: string; emailAddress: string }> {
  // Check cache first
  if (inboxCache.has(name)) {
    return inboxCache.get(name)!;
  }

  // Get all existing inboxes
  const existingInboxes = await getMailSlurp().inboxController.getInboxes({});

  // Try to find existing inbox with this name
  let existingInbox = existingInboxes.find(
    (inbox) => inbox.name === name || inbox.name === `e2e-${name}`
  );

  // If no named inbox found, reuse any available inbox not already in cache
  if (!existingInbox && existingInboxes.length > 0) {
    const usedInboxIds = new Set([...inboxCache.values()].map((i) => i.id));
    existingInbox = existingInboxes.find((inbox) => !usedInboxIds.has(inbox.id));
  }

  if (existingInbox) {
    const result = {
      id: existingInbox.id,
      emailAddress: existingInbox.emailAddress!,
    };
    inboxCache.set(name, result);
    console.log(`Reusing inbox for "${name}": ${result.emailAddress}`);

    // Clear any old emails
    try {
      await getMailSlurp().inboxController.deleteAllInboxEmails({ inboxId: existingInbox.id });
    } catch {
      // Ignore cleanup errors
    }

    return result;
  }

  // Create new inbox only if none exists (should rarely happen)
  console.log(`Creating new inbox for "${name}"...`);
  const inbox = await getMailSlurp().inboxController.createInbox({
    name: `e2e-${name}`,
    description: `Test inbox for: ${name}`,
  });

  const result = {
    id: inbox.id,
    emailAddress: inbox.emailAddress!,
  };

  inboxCache.set(name, result);
  console.log(`Created named inbox "${name}": ${result.emailAddress}`);

  return result;
}

/**
 * Wait for an email to arrive in the inbox
 * Returns the email when it arrives
 */
export async function waitForEmail(
  inboxId: string,
  options: {
    timeout?: number;
    subject?: string;
    unreadOnly?: boolean;
  } = {}
): Promise<{
  id: string;
  subject: string;
  from: string;
  body: string;
  htmlBody?: string;
}> {
  const timeout = options.timeout || 60000; // Default 60s timeout

  const email = await getMailSlurp().waitController.waitForLatestEmail({
    inboxId,
    timeout,
    unreadOnly: options.unreadOnly ?? true,
  });

  return {
    id: email.id,
    subject: email.subject || '',
    from: email.from || '',
    body: email.body || '',
    htmlBody: email.body,
  };
}

/**
 * Wait for an email with a specific subject
 */
export async function waitForEmailWithSubject(
  inboxId: string,
  subjectContains: string,
  timeout: number = 60000
): Promise<{
  id: string;
  subject: string;
  from: string;
  body: string;
}> {
  const email = await getMailSlurp().waitController.waitForMatchingFirstEmail({
    inboxId,
    timeout,
    matchOptions: {
      matches: [
        {
          field: MatchOptionFieldEnum.SUBJECT,
          should: MatchOptionShouldEnum.CONTAIN,
          value: subjectContains,
        },
      ],
    },
  });

  return {
    id: email.id,
    subject: email.subject || '',
    from: email.from || '',
    body: email.body || '',
  };
}

/**
 * Get all emails in an inbox
 */
export async function getEmails(
  inboxId: string
): Promise<
  Array<{
    id: string;
    subject: string;
    from: string;
    createdAt: Date;
  }>
> {
  const response = await getMailSlurp().emailController.getEmailsPaginated({
    inboxId: [inboxId],
  });

  return (response.content || []).map((email) => ({
    id: email.id,
    subject: email.subject || '',
    from: email.from || '',
    createdAt: new Date(email.createdAt),
  }));
}

/**
 * Get full email content by ID
 */
export async function getEmailContent(emailId: string): Promise<{
  id: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  htmlBody?: string;
  attachments: string[];
}> {
  const email = await getMailSlurp().emailController.getEmail({ emailId });

  return {
    id: email.id,
    subject: email.subject || '',
    from: email.from || '',
    to: email.to || [],
    body: email.body || '',
    htmlBody: email.body,
    attachments: email.attachments || [],
  };
}

/**
 * Extract all links from an email body
 */
export function extractLinksFromEmail(emailBody: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const matches = emailBody.match(urlRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Extract a specific link containing a pattern (e.g., invitation token)
 */
export function extractLinkContaining(
  emailBody: string,
  pattern: string
): string | null {
  const links = extractLinksFromEmail(emailBody);
  return links.find((link) => link.includes(pattern)) || null;
}

/**
 * Wait for invitation email and extract the accept link
 */
export async function waitForInvitationEmail(
  inboxId: string,
  options: { timeout?: number } = {}
): Promise<{
  email: { id: string; subject: string; body: string };
  acceptLink: string | null;
}> {
  const email = await waitForEmailWithSubject(
    inboxId,
    'invited',
    options.timeout || 60000
  );

  const acceptLink = extractLinkContaining(email.body, 'accept') ||
    extractLinkContaining(email.body, 'invite') ||
    extractLinkContaining(email.body, 'token');

  return { email, acceptLink };
}

/**
 * Wait for password reset email and extract the reset link
 */
export async function waitForPasswordResetEmail(
  inboxId: string,
  options: { timeout?: number } = {}
): Promise<{
  email: { id: string; subject: string; body: string };
  resetLink: string | null;
}> {
  const email = await waitForEmailWithSubject(
    inboxId,
    'reset',
    options.timeout || 60000
  );

  const resetLink = extractLinkContaining(email.body, 'reset') ||
    extractLinkContaining(email.body, 'password');

  return { email, resetLink };
}

/**
 * Wait for publisher approval email
 */
export async function waitForApprovalEmail(
  inboxId: string,
  options: { timeout?: number } = {}
): Promise<{
  email: { id: string; subject: string; body: string };
  dashboardLink: string | null;
}> {
  const email = await waitForEmailWithSubject(
    inboxId,
    'approved',
    options.timeout || 60000
  );

  const dashboardLink = extractLinkContaining(email.body, 'publisher') ||
    extractLinkContaining(email.body, 'dashboard');

  return { email, dashboardLink };
}

/**
 * Delete an inbox (cleanup)
 */
export async function deleteInbox(inboxId: string): Promise<void> {
  await getMailSlurp().inboxController.deleteInbox({ inboxId });

  // Remove from cache
  for (const [key, value] of inboxCache.entries()) {
    if (value.id === inboxId) {
      inboxCache.delete(key);
      break;
    }
  }
}

/**
 * Clean up test inboxes
 * NOTE: We clear emails but DON'T delete inboxes to avoid exceeding
 * free tier inbox creation limits (30/month).
 */
export async function cleanupAllInboxes(): Promise<void> {
  console.log('Cleaning up test email inboxes (clearing emails, preserving inboxes)...');

  for (const [name, inbox] of inboxCache.entries()) {
    try {
      // Clear emails instead of deleting inbox
      await getMailSlurp().inboxController.deleteAllInboxEmails({ inboxId: inbox.id });
      console.log(`Cleared emails in inbox: ${name} (${inbox.emailAddress})`);
    } catch (error) {
      console.warn(`Failed to clear inbox ${name}:`, error);
    }
  }

  inboxCache.clear();
  console.log('Email inbox cleanup complete');
}

/**
 * Clear all emails in an inbox (without deleting the inbox)
 */
export async function clearInbox(inboxId: string): Promise<void> {
  await getMailSlurp().inboxController.deleteAllInboxEmails({ inboxId });
}

/**
 * Check if MailSlurp is configured
 */
export function isMailSlurpConfigured(): boolean {
  return !!process.env.MAILSLURP_API_KEY;
}

/**
 * Get the MailSlurp client instance (for advanced usage)
 */
export function getMailSlurpClient(): MailSlurp {
  return getMailSlurp();
}
