# Story 9.10: Email Service Integration for Invitations

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Medium (Feature implementation)
**Story Points:** 5

---

## User Story

**As a** publisher admin,
**I want** invitation emails to be sent automatically when I invite team members,
**So that** invited users receive proper notification and can join my publisher organization.

---

## Context

The invitation system has TODO placeholders for email functionality. Currently, invitations are created in the database but no emails are sent, meaning invited users have no way to know they've been invited unless they're told out-of-band.

**Source TODOs:**
- `api/internal/handlers/invitations.go:201` - "TODO: Implement email sending"
- `api/internal/handlers/invitations.go:453` - "TODO: Link user to publisher via user_publishers table"

**Current State:**
- Invitations created in database with invite tokens
- No email notifications sent
- Users must be told invitation URL manually
- No user-publisher linking on acceptance

**Target State:**
- Email service configured (SendGrid, AWS SES, or Resend)
- Invitation emails sent automatically with secure links
- Confirmation emails on acceptance
- Users linked to publishers via user_publishers table

---

## Acceptance Criteria

### AC1: Email Service Configuration
**Given** the application is deployed
**When** an invitation is created
**Then** the email service is configured and ready to send

### AC2: Invitation Email Sending
**Given** a publisher admin creates an invitation
**When** the invitation is saved to the database
**Then** an email is sent to the invitee with:
- Publisher name and inviter information
- Secure accept link with token
- Expiration information
- Clear call-to-action

### AC3: Email Content Differentiation
**Given** an invitation is created
**When** the email is sent
**Then** the content differs based on whether the user exists in Clerk (server-side only):
- Existing user: "You've been invited to join [Publisher]"
- New user: "Create an account to join [Publisher]"

### AC4: Confirmation Email on Acceptance
**Given** a user accepts an invitation
**When** the invitation status is updated
**Then** confirmation emails are sent to:
- The invitee (welcome email)
- The original inviter (notification)

### AC5: User-Publisher Linking
**Given** a user accepts an invitation
**When** they complete the acceptance flow
**Then** a record is created in user_publishers table linking user to publisher

### AC6: Email Error Handling
**Given** the email service is unavailable
**When** an invitation is created
**Then** the invitation is still created
**And** email failure is logged for retry
**And** the response indicates email delivery status

---

## Technical Notes

### Email Service Options

| Service | Pros | Cons | Cost |
|---------|------|------|------|
| **Resend** | Simple API, good DX | Newer service | Free tier: 3k/month |
| **SendGrid** | Mature, reliable | Complex setup | Free tier: 100/day |
| **AWS SES** | Already have AWS | More setup | ~$0.10/1000 |

**Recommendation:** Resend for simplicity, or AWS SES to stay within AWS ecosystem.

### Email Templates Required

**1. Invitation Email:**
```
Subject: You've been invited to join [Publisher Name] on Shtetl Zmanim

Hi [Invitee Name],

[Inviter Name] has invited you to join [Publisher Name] as a team member on Shtetl Zmanim.

[Accept Invitation Button]

This invitation expires on [Date].

If you weren't expecting this invitation, you can ignore this email.
```

**2. Acceptance Confirmation (to invitee):**
```
Subject: Welcome to [Publisher Name]!

Hi [User Name],

You're now a team member of [Publisher Name] on Shtetl Zmanim.

[Go to Dashboard Button]
```

**3. Acceptance Notification (to inviter):**
```
Subject: [User Name] joined [Publisher Name]

Hi [Inviter Name],

[User Name] has accepted your invitation to join [Publisher Name].

[View Team Button]
```

### Database Changes

**user_publishers table (if not exists):**
```sql
CREATE TABLE IF NOT EXISTS user_publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,          -- Clerk user ID
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, publisher_id)
);
```

### Environment Variables

```bash
# Email service configuration
EMAIL_PROVIDER=resend          # resend, sendgrid, or ses
EMAIL_API_KEY=re_xxx           # API key for chosen provider
EMAIL_FROM_ADDRESS=noreply@shtetl.io
EMAIL_FROM_NAME="Shtetl Zmanim"

# For AWS SES
AWS_SES_REGION=eu-west-1
```

### Code Structure

**New files:**
```
api/internal/
├── email/
│   ├── email.go              # Email service interface
│   ├── resend.go             # Resend implementation
│   ├── sendgrid.go           # SendGrid implementation
│   ├── ses.go                # AWS SES implementation
│   └── templates/
│       ├── invitation.html
│       ├── invitation.txt
│       ├── welcome.html
│       ├── welcome.txt
│       ├── notification.html
│       └── notification.txt
```

### Integration Points

**invitations.go:201 - SendInvitationEmail:**
```go
// Replace TODO with:
if err := h.emailService.SendInvitation(ctx, email.InvitationEmail{
    To:           req.Email,
    InviterName:  inviterName,
    PublisherName: publisher.Name,
    AcceptURL:    fmt.Sprintf("%s/invitations/accept?token=%s", h.cfg.BaseURL, invite.Token),
    ExpiresAt:    invite.ExpiresAt,
    IsNewUser:    !h.checkUserExistsInClerk(ctx, req.Email),
}); err != nil {
    slog.Error("failed to send invitation email", "error", err, "email", req.Email)
    // Don't fail the request, just log
}
```

**invitations.go:453 - LinkUserToPublisher:**
```go
// Replace TODO with:
if err := h.db.Queries.LinkUserToPublisher(ctx, db.LinkUserToPublisherParams{
    UserID:      userID,
    PublisherID: invite.PublisherID,
    Role:        invite.Role,
}); err != nil {
    return fmt.Errorf("failed to link user to publisher: %w", err)
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Set up email service infrastructure
  - [ ] 1.1 Choose email provider (Resend recommended)
  - [ ] 1.2 Create email service account
  - [ ] 1.3 Verify sending domain (shtetl.io)
  - [ ] 1.4 Add environment variables to SSM parameters
  - [ ] 1.5 Add environment variables to local .env

- [ ] Task 2: Create email service abstraction
  - [ ] 2.1 Create `api/internal/email/email.go` interface
  - [ ] 2.2 Define Email struct and service interface
  - [ ] 2.3 Create provider factory function
  - [ ] 2.4 Add error types for email failures

- [ ] Task 3: Implement chosen email provider
  - [ ] 3.1 Create provider implementation file
  - [ ] 3.2 Implement Send method
  - [ ] 3.3 Add retry logic with exponential backoff
  - [ ] 3.4 Add logging for debugging

- [ ] Task 4: Create email templates
  - [ ] 4.1 Create invitation email template (HTML + text)
  - [ ] 4.2 Create welcome email template (HTML + text)
  - [ ] 4.3 Create notification email template (HTML + text)
  - [ ] 4.4 Add template rendering function
  - [ ] 4.5 Test templates with sample data

- [ ] Task 5: Integrate with invitations handler
  - [ ] 5.1 Add emailService to Handlers struct
  - [ ] 5.2 Update CreateInvitation to send email
  - [ ] 5.3 Update AcceptInvitation to send confirmation emails
  - [ ] 5.4 Add email delivery status to response

- [ ] Task 6: Create user_publishers table and queries
  - [ ] 6.1 Create migration for user_publishers table
  - [ ] 6.2 Add SQLc queries for user-publisher linking
  - [ ] 6.3 Generate SQLc code
  - [ ] 6.4 Update AcceptInvitation to link user

- [ ] Task 7: Testing
  - [ ] 7.1 Create email service mock for unit tests
  - [ ] 7.2 Test invitation email sending
  - [ ] 7.3 Test confirmation email sending
  - [ ] 7.4 Test user-publisher linking
  - [ ] 7.5 Test error handling (email service down)
  - [ ] 7.6 Manual testing with real email

---

## Dependencies

**Depends On:**
- Email service account setup (external)
- Domain verification for sending (external)

**Dependent Stories:**
- Story 9.11 (Clerk API) - uses similar infrastructure

---

## Definition of Done

- [ ] Email service configured and working
- [ ] Invitation emails sent automatically on creation
- [ ] Email content differs for new vs existing users
- [ ] Confirmation emails sent on acceptance
- [ ] User-publisher linking implemented
- [ ] Email failures logged but don't block invitations
- [ ] Templates created for all email types
- [ ] Unit tests pass with mocked email service
- [ ] Manual testing confirms emails delivered
- [ ] Environment variables documented
- [ ] No regressions in existing invitation flow

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Email deliverability issues | MEDIUM | HIGH | Use established provider, verify domain |
| API rate limits | LOW | MEDIUM | Add rate limiting, queue for large batches |
| Template rendering errors | LOW | LOW | Test templates thoroughly |
| Secrets exposure | LOW | HIGH | Use SSM parameters, never log API keys |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 5_
