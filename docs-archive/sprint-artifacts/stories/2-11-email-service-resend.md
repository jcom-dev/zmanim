# Story 2.11: Email Service Integration (Resend)

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Drafted
**Priority:** High (Foundation - implement first)
**Sprint Change:** Added 2025-11-26

---

## User Story

**As the** system,
**I want** to send transactional emails via Resend,
**So that** users receive branded invitations and notifications.

---

## Acceptance Criteria

### AC1: Email Service Configuration
**Given** the email service is configured with Resend credentials
**When** the API server starts
**Then** the email service initializes successfully
**And** logs confirmation of Resend connection

### AC2: Invitation Emails
**Given** an invitation is triggered (publisher team or admin)
**When** the system sends the invitation
**Then** the email is delivered via Resend
**And** uses the `publisher-invitation` template
**And** includes Shtetl Zmanim branding

### AC3: Publisher Approval Email
**Given** an admin approves a publisher request
**When** the approval is processed
**Then** a welcome email is sent to the new publisher
**And** uses the `publisher-approved` template
**And** includes link to publisher dashboard

### AC4: Publisher Rejection Email
**Given** an admin rejects a publisher request
**When** the rejection is processed
**Then** a notification email is sent
**And** uses the `publisher-rejected` template

### AC5: Password Reset Email
**Given** a user requests password reset
**When** the request is submitted
**Then** a password reset email is sent via Resend
**And** uses the `password-reset` template
**And** includes secure reset link with expiration

### AC6: Error Handling
**Given** the Resend API is unavailable
**When** an email send fails
**Then** the error is logged with details
**And** the operation continues (non-blocking)
**And** no user-facing error is shown

---

## Technical Notes

### New Files

```
api/internal/services/email_service.go    # Main email service
api/internal/templates/email/             # Fallback HTML templates
  ├── invitation.html
  ├── publisher-approved.html
  ├── publisher-rejected.html
  ├── password-reset.html
  └── welcome.html
```

### Resend Dashboard Templates

Create these templates in Resend Dashboard (https://resend.com/emails):

| Template ID | Name | Purpose | Variables |
|-------------|------|---------|-----------|
| `publisher-invitation` | Publisher Invitation | Invite to publisher team | `inviter_name`, `publisher_name`, `accept_url` |
| `publisher-approved` | Publisher Approved | Welcome new publisher | `publisher_name`, `dashboard_url` |
| `publisher-rejected` | Publisher Rejected | Rejection notice | `publisher_name`, `reason` |
| `password-reset` | Password Reset | Password reset link | `reset_url`, `expires_in` |
| `welcome` | Welcome | Welcome new user | `user_name` |

### Template Design Guidelines

- **Primary Color:** #1e3a5f (Midnight Trust)
- **Logo:** Include Shtetl Zmanim header
- **Layout:** Clean, simple, mobile-responsive
- **Footer:** Include unsubscribe link for compliance

### Go Service Implementation

```go
// api/internal/services/email_service.go
package services

import (
    "bytes"
    "encoding/json"
    "fmt"
    "log/slog"
    "net/http"
    "os"
)

type EmailService struct {
    apiKey string
    from   string
    domain string
    client *http.Client
}

type EmailTemplate string

const (
    TemplatePublisherInvitation EmailTemplate = "publisher-invitation"
    TemplatePublisherApproved   EmailTemplate = "publisher-approved"
    TemplatePublisherRejected   EmailTemplate = "publisher-rejected"
    TemplatePasswordReset       EmailTemplate = "password-reset"
    TemplateWelcome             EmailTemplate = "welcome"
)

type SendEmailRequest struct {
    From    string            `json:"from"`
    To      []string          `json:"to"`
    Subject string            `json:"subject"`
    HTML    string            `json:"html,omitempty"`
    Text    string            `json:"text,omitempty"`
    Tags    []EmailTag        `json:"tags,omitempty"`
}

type EmailTag struct {
    Name  string `json:"name"`
    Value string `json:"value"`
}

func NewEmailService() *EmailService {
    return &EmailService{
        apiKey: os.Getenv("RESEND_API_KEY"),
        from:   os.Getenv("RESEND_FROM"),
        domain: os.Getenv("RESEND_DOMAIN"),
        client: &http.Client{},
    }
}

func (s *EmailService) SendInvitation(to, inviterName, publisherName, acceptURL string) error {
    subject := fmt.Sprintf("You've been invited to join %s on Shtetl Zmanim", publisherName)
    html := s.renderTemplate(TemplatePublisherInvitation, map[string]string{
        "inviter_name":   inviterName,
        "publisher_name": publisherName,
        "accept_url":     acceptURL,
    })
    return s.send(to, subject, html)
}

func (s *EmailService) SendPublisherApproved(to, publisherName, dashboardURL string) error {
    subject := "Welcome to Shtetl Zmanim - Your Publisher Account is Ready!"
    html := s.renderTemplate(TemplatePublisherApproved, map[string]string{
        "publisher_name": publisherName,
        "dashboard_url":  dashboardURL,
    })
    return s.send(to, subject, html)
}

func (s *EmailService) SendPublisherRejected(to, publisherName, reason string) error {
    subject := "Shtetl Zmanim Publisher Application Update"
    html := s.renderTemplate(TemplatePublisherRejected, map[string]string{
        "publisher_name": publisherName,
        "reason":         reason,
    })
    return s.send(to, subject, html)
}

func (s *EmailService) SendPasswordReset(to, resetURL, expiresIn string) error {
    subject := "Reset Your Shtetl Zmanim Password"
    html := s.renderTemplate(TemplatePasswordReset, map[string]string{
        "reset_url":  resetURL,
        "expires_in": expiresIn,
    })
    return s.send(to, subject, html)
}

func (s *EmailService) send(to, subject, html string) error {
    if s.apiKey == "" {
        slog.Warn("email service not configured, skipping send", "to", to)
        return nil
    }

    req := SendEmailRequest{
        From:    s.from,
        To:      []string{to},
        Subject: subject,
        HTML:    html,
    }

    body, _ := json.Marshal(req)
    httpReq, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
    if err != nil {
        return err
    }

    httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := s.client.Do(httpReq)
    if err != nil {
        slog.Error("failed to send email", "error", err, "to", to)
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 400 {
        slog.Error("resend API error", "status", resp.StatusCode, "to", to)
        return fmt.Errorf("resend API error: %d", resp.StatusCode)
    }

    slog.Info("email sent successfully", "to", to, "subject", subject)
    return nil
}

func (s *EmailService) renderTemplate(template EmailTemplate, data map[string]string) string {
    // TODO: Load from template files or use Resend templates
    // For now, return simple HTML
    return fmt.Sprintf("<html><body><h1>Shtetl Zmanim</h1><p>Template: %s</p></body></html>", template)
}
```

### Environment Variables

Already configured in `api/.env`:
```
RESEND_API_KEY=re_j1PQEusy_4iVRQdZYEgYVwYUtfvzoY4pK
RESEND_DOMAIN=shtetl.dev
RESEND_FROM=zmanim@shtetl.dev
```

### API Endpoint

```
POST /api/user/request-password-reset
Body: { "email": "user@example.com" }
Response: { "success": true, "message": "If an account exists, a reset email has been sent" }
```

### Clerk Configuration

Configure Clerk to disable built-in email sending:
- Clerk Dashboard → Email & SMS → Disable email verification emails
- Use Clerk webhooks to trigger custom emails if needed

---

## Dependencies

- None (foundation story)

## Dependent Stories

- Story 2.9: Publisher Registration Request (uses approval/rejection emails)
- Story 2.10: Publisher Member Invitation (uses invitation emails)
- Story 2.12: User Profile Dropdown (uses password reset emails)

---

## Definition of Done

- [ ] Email service implemented in Go backend
- [ ] All 5 templates created in Resend dashboard
- [ ] Fallback HTML templates in `api/internal/templates/email/`
- [ ] Password reset endpoint implemented
- [ ] Error handling logs failures but doesn't block operations
- [ ] Integration tests for email service
- [ ] Environment variables documented

---

## FRs Covered

| FR | Description |
|----|-------------|
| FR61 | System sends transactional emails via Resend |
| FR62 | Emails use Shtetl Zmanim branding |
| FR66 | Email templates created in Resend dashboard |

---

_Sprint Change Addition: 2025-11-26_
