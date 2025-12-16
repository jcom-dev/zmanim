# Story 8-32: Publisher Registration with Email Verification - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium (Security-Sensitive)

---

## Executive Summary

Implement a secure publisher registration flow that:
1. Requires email verification before submission to admin queue
2. Never reveals whether an email exists in the system
3. Links existing users seamlessly
4. Creates new user accounts during verification
5. Auto-cleans unverified requests after 30 days

---

## Flow Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PUBLIC REGISTRATION FORM                             │
├────────────────────────────────────────────────────────────────────────┤
│  Step 1: Publisher Details                                              │
│    - Publisher Name: [____________]                                     │
│    - Contact Email:  [____________] (for public inquiries)             │
│    - Description:    [____________]                                     │
│                                                                         │
│  Step 2: Your Details                                                   │
│    - Your Email:     [____________] (for your login)                   │
│                                                                         │
│  [Submit] → "Verification email sent to your inbox"                    │
│             (Same message whether user exists or not)                   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    EMAIL SENT TO REGISTRANT                            │
├────────────────────────────────────────────────────────────────────────┤
│  "Click to verify your email and complete your publisher registration" │
│  (Same email text regardless of user existence)                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    VERIFICATION PAGE (/register/verify/[token])        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  IF EXISTING USER:              │  IF NEW USER:                        │
│  ─────────────────              │  ────────────                        │
│  "Welcome back, John!"          │  "Create your account"               │
│  "Click to submit your          │                                      │
│   publisher request"            │  First Name: [____________]          │
│                                 │  Last Name:  [____________]          │
│  [Confirm & Submit]             │                                      │
│                                 │  [Create Account & Submit]           │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    SUCCESS                                              │
├────────────────────────────────────────────────────────────────────────┤
│  "Your publisher request has been submitted for review."               │
│  "You'll receive an email when it's approved."                        │
│                                                                         │
│  → Request now visible in Admin queue (only verified requests shown)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### publisher_registration_tokens Table

```sql
-- File: db/migrations/00000000000012_publisher_registration_tokens.sql

CREATE TABLE publisher_registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Registrant info
    registrant_email TEXT NOT NULL,

    -- Publisher details (stored as JSON until approved)
    publisher_data JSONB NOT NULL,
    -- Example: {"name": "My Shul", "contact_email": "info@myshul.org", "description": "..."}

    -- Token management
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, verified, completed, expired

    -- Server-side tracking (never exposed to public)
    user_exists BOOLEAN,  -- Set during verification
    clerk_user_id TEXT,   -- Set when user is created/linked

    -- Timestamps
    verified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Index for cleanup job
    CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'completed', 'expired'))
);

CREATE INDEX idx_reg_tokens_token ON publisher_registration_tokens(token);
CREATE INDEX idx_reg_tokens_email ON publisher_registration_tokens(registrant_email);
CREATE INDEX idx_reg_tokens_status ON publisher_registration_tokens(status);
CREATE INDEX idx_reg_tokens_cleanup ON publisher_registration_tokens(status, created_at)
    WHERE status = 'pending';
```

### SQLc Queries

```sql
-- File: api/internal/db/queries/registration.sql

-- name: CreateRegistrationToken :one
INSERT INTO publisher_registration_tokens (
    registrant_email, publisher_data, token, expires_at
) VALUES (
    $1, $2, $3, NOW() + INTERVAL '7 days'
)
RETURNING *;

-- name: GetRegistrationByToken :one
SELECT * FROM publisher_registration_tokens
WHERE token = $1 AND status IN ('pending', 'verified') AND expires_at > NOW();

-- name: VerifyRegistrationToken :one
UPDATE publisher_registration_tokens
SET status = 'verified', user_exists = $2, verified_at = NOW()
WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
RETURNING *;

-- name: CompleteRegistration :one
UPDATE publisher_registration_tokens
SET status = 'completed', clerk_user_id = $2, completed_at = NOW()
WHERE token = $1 AND status = 'verified'
RETURNING *;

-- name: ListVerifiedRegistrations :many
-- Only show verified (not pending) in admin queue
SELECT * FROM publisher_registration_tokens
WHERE status IN ('verified', 'completed')
ORDER BY created_at DESC;

-- name: CleanupExpiredRegistrations :execrows
-- Run periodically (cron job or on-demand)
DELETE FROM publisher_registration_tokens
WHERE (status = 'pending' AND created_at < NOW() - INTERVAL '30 days')
   OR (status = 'expired');

-- name: ExpireOldPendingRegistrations :exec
UPDATE publisher_registration_tokens
SET status = 'expired'
WHERE status = 'pending' AND expires_at < NOW();
```

---

## API Design

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/public/publishers/register` | None | Start registration |
| GET | `/public/publishers/register/verify/{token}` | None | Validate token |
| POST | `/public/publishers/register/complete/{token}` | None | Complete registration |
| GET | `/admin/publisher-requests` | Admin | List verified requests |
| POST | `/admin/publisher-requests/{id}/approve` | Admin | Approve request |

### Request/Response Schemas

**POST /public/publishers/register**
```go
type StartRegistrationRequest struct {
    PublisherName        string `json:"publisher_name" validate:"required,min=2,max=100"`
    PublisherContactEmail string `json:"publisher_contact_email" validate:"required,email"`
    PublisherDescription string `json:"publisher_description,omitempty"`
    RegistrantEmail      string `json:"registrant_email" validate:"required,email"`
}

// Response is ALWAYS the same - no enumeration
type StartRegistrationResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"` // "Verification email sent. Please check your inbox."
}
```

**GET /public/publishers/register/verify/{token}**
```go
type VerifyTokenResponse struct {
    Valid          bool     `json:"valid"`
    UserStatus     string   `json:"user_status,omitempty"`      // "existing" or "new"
    UserName       string   `json:"user_name,omitempty"`        // For existing users
    PublisherName  string   `json:"publisher_name,omitempty"`
    RequiredFields []string `json:"required_fields,omitempty"` // For new users: ["first_name", "last_name"]
}
```

**POST /public/publishers/register/complete/{token}**
```go
type CompleteRegistrationRequest struct {
    // Only required for new users
    FirstName string `json:"first_name,omitempty"`
    LastName  string `json:"last_name,omitempty"`
}

type CompleteRegistrationResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"` // "Your publisher request has been submitted for review."
}
```

---

## Backend Implementation

### Start Registration Handler

```go
// File: api/internal/handlers/publisher_registration.go

func (h *Handlers) StartPublisherRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req StartRegistrationRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Validate inputs
    if err := h.validator.Struct(req); err != nil {
        RespondBadRequest(w, r, "Validation failed")
        return
    }

    // Generate secure token
    token := generateSecureToken()

    // Store publisher data as JSON
    publisherData, _ := json.Marshal(map[string]string{
        "name":          req.PublisherName,
        "contact_email": req.PublisherContactEmail,
        "description":   req.PublisherDescription,
    })

    // Create registration record
    _, err := h.db.Queries.CreateRegistrationToken(ctx, sqlcgen.CreateRegistrationTokenParams{
        RegistrantEmail: req.RegistrantEmail,
        PublisherData:   publisherData,
        Token:           token,
    })
    if err != nil {
        slog.Error("failed to create registration token", "error", err)
        RespondInternalError(w, r, "Failed to process registration")
        return
    }

    // Send verification email (async)
    go h.sendRegistrationVerificationEmail(ctx, req.RegistrantEmail, token)

    // ALWAYS return same response (no enumeration)
    RespondJSON(w, r, http.StatusOK, StartRegistrationResponse{
        Success: true,
        Message: "Verification email sent. Please check your inbox.",
    })
}
```

### Verify Token Handler

```go
func (h *Handlers) VerifyRegistrationToken(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    // Get registration record
    registration, err := h.db.Queries.GetRegistrationByToken(ctx, token)
    if err != nil {
        RespondJSON(w, r, http.StatusOK, VerifyTokenResponse{Valid: false})
        return
    }

    // Check if user exists in Clerk
    userExists := h.checkUserExistsInClerk(ctx, registration.RegistrantEmail)

    // Update registration with user existence info
    h.db.Queries.VerifyRegistrationToken(ctx, sqlcgen.VerifyRegistrationTokenParams{
        Token:      token,
        UserExists: userExists,
    })

    // Parse publisher data
    var publisherData map[string]string
    json.Unmarshal(registration.PublisherData, &publisherData)

    response := VerifyTokenResponse{
        Valid:         true,
        UserStatus:    ifThenElse(userExists, "existing", "new"),
        PublisherName: publisherData["name"],
    }

    if userExists {
        // Get user's name from Clerk
        users, _ := h.clerkClient.Users().List(ctx, clerk.ListUsersParams{
            EmailAddress: []string{registration.RegistrantEmail},
        })
        if len(users) > 0 {
            response.UserName = fmt.Sprintf("%s %s", users[0].FirstName, users[0].LastName)
        }
    } else {
        response.RequiredFields = []string{"first_name", "last_name"}
    }

    RespondJSON(w, r, http.StatusOK, response)
}
```

### Complete Registration Handler

```go
func (h *Handlers) CompleteRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    var req CompleteRegistrationRequest
    json.NewDecoder(r.Body).Decode(&req)

    // Get verified registration
    registration, err := h.db.Queries.GetRegistrationByToken(ctx, token)
    if err != nil || registration.Status != "verified" {
        RespondNotFound(w, r, "Invalid or expired registration")
        return
    }

    var clerkUserID string

    if registration.UserExists {
        // Get existing user's ID
        users, _ := h.clerkClient.Users().List(ctx, clerk.ListUsersParams{
            EmailAddress: []string{registration.RegistrantEmail},
        })
        if len(users) > 0 {
            clerkUserID = users[0].ID
        }
    } else {
        // Validate required fields for new user
        if req.FirstName == "" || req.LastName == "" {
            RespondBadRequest(w, r, "First and last name required")
            return
        }

        // Create user in Clerk (will send welcome email)
        newUser, err := h.clerkClient.Users().Create(ctx, clerk.CreateUserParams{
            EmailAddress: []string{registration.RegistrantEmail},
            FirstName:    &req.FirstName,
            LastName:     &req.LastName,
        })
        if err != nil {
            RespondInternalError(w, r, "Failed to create account")
            return
        }
        clerkUserID = newUser.ID
    }

    // Parse publisher data
    var publisherData map[string]string
    json.Unmarshal(registration.PublisherData, &publisherData)

    // Create publisher with pending status
    publisher, err := h.db.Queries.CreatePublisher(ctx, sqlcgen.CreatePublisherParams{
        Name:        publisherData["name"],
        Email:       publisherData["contact_email"],
        StatusID:    1, // pending
        ClerkUserID: &clerkUserID,
    })
    if err != nil {
        RespondInternalError(w, r, "Failed to create publisher request")
        return
    }

    // Mark registration as completed
    h.db.Queries.CompleteRegistration(ctx, sqlcgen.CompleteRegistrationParams{
        Token:       token,
        ClerkUserID: clerkUserID,
    })

    // Notify admins (async)
    go h.notifyAdminsOfNewPublisherRequest(ctx, publisher)

    RespondJSON(w, r, http.StatusOK, CompleteRegistrationResponse{
        Success: true,
        Message: "Your publisher request has been submitted for review.",
    })
}
```

---

## Cleanup Job

### Background Cleanup Service

```go
// File: api/internal/services/cleanup_service.go

type CleanupService struct {
    db *db.DB
}

func (s *CleanupService) CleanupExpiredRegistrations(ctx context.Context) (int64, error) {
    // 1. Expire old pending tokens
    s.db.Queries.ExpireOldPendingRegistrations(ctx)

    // 2. Delete tokens older than 30 days
    count, err := s.db.Queries.CleanupExpiredRegistrations(ctx)
    if err != nil {
        slog.Error("failed to cleanup expired registrations", "error", err)
        return 0, err
    }

    slog.Info("cleaned up expired registrations", "count", count)
    return count, nil
}
```

### Cron Endpoint (Admin)

```go
// File: api/internal/handlers/admin.go

// GET /admin/cleanup/registrations - Trigger cleanup manually or via cron
func (h *Handlers) CleanupExpiredRegistrations(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    count, err := h.cleanupService.CleanupExpiredRegistrations(ctx)
    if err != nil {
        RespondInternalError(w, r, "Cleanup failed")
        return
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "cleaned_up": count,
    })
}
```

---

## Frontend Implementation

### Registration Form

```typescript
// File: web/app/register/publisher/page.tsx

'use client';

import { useState } from 'react';

export default function PublisherRegistrationPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [publisherName, setPublisherName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [description, setDescription] = useState('');
  const [registrantEmail, setRegistrantEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch('/api/v1/public/publishers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publisher_name: publisherName,
        publisher_contact_email: contactEmail,
        publisher_description: description,
        registrant_email: registrantEmail,
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
        <p>We've sent a verification link to <strong>{registrantEmail}</strong>.</p>
        <p className="mt-2 text-muted-foreground">
          Click the link in the email to complete your publisher registration.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Register Your Publisher</h1>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Publisher Details</h2>
            <div className="space-y-4">
              <div>
                <label>Publisher Name</label>
                <input
                  type="text"
                  value={publisherName}
                  onChange={(e) => setPublisherName(e.target.value)}
                  placeholder="e.g., Congregation Beth Israel"
                  required
                />
              </div>
              <div>
                <label>Contact Email (for public inquiries)</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="info@example.org"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This email will be displayed publicly. It's not your login.
                </p>
              </div>
              <div>
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us about your organization..."
                />
              </div>
              <button type="button" onClick={() => setStep(2)} className="btn-primary w-full">
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Your Login Details</h2>
            <div className="space-y-4">
              <div>
                <label>Your Email</label>
                <input
                  type="email"
                  value={registrantEmail}
                  onChange={(e) => setRegistrantEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This will be your login email for Shtetl Zmanim.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                  Back
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Submit & Verify Email
                </button>
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
```

### Verification Page

```typescript
// File: web/app/register/verify/[token]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface TokenValidation {
  valid: boolean;
  user_status: 'existing' | 'new';
  user_name?: string;
  publisher_name: string;
  required_fields?: string[];
}

export default function VerifyRegistrationPage() {
  const { token } = useParams();
  const router = useRouter();
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    fetch(`/api/v1/public/publishers/register/verify/${token}`)
      .then(r => r.json())
      .then(setValidation)
      .finally(() => setLoading(false));
  }, [token]);

  const handleComplete = async () => {
    setSubmitting(true);

    const body = validation?.user_status === 'new'
      ? { first_name: firstName, last_name: lastName }
      : {};

    const res = await fetch(`/api/v1/public/publishers/register/complete/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push('/register/success');
    }

    setSubmitting(false);
  };

  if (loading) return <div>Loading...</div>;

  if (!validation?.valid) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Link Expired</h1>
        <p>This verification link has expired or is invalid.</p>
        <a href="/register/publisher" className="btn-primary mt-4 inline-block">
          Start New Registration
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">
        Complete Registration for {validation.publisher_name}
      </h1>

      {validation.user_status === 'existing' ? (
        <>
          <p className="mb-6">
            Welcome back, <strong>{validation.user_name}</strong>!
            Click below to submit your publisher request.
          </p>
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'Submitting...' : 'Confirm & Submit Request'}
          </button>
        </>
      ) : (
        <>
          <p className="mb-4">Create your account to complete registration.</p>
          <div className="space-y-4">
            <div>
              <label>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
            <button
              onClick={handleComplete}
              disabled={submitting || !firstName || !lastName}
              className="btn-primary w-full"
            >
              {submitting ? 'Creating Account...' : 'Create Account & Submit'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## Admin Queue Updates

### Filter Unverified Requests

```go
// Existing admin endpoint should ONLY show verified requests
func (h *Handlers) GetPendingPublisherRequests(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Only show publishers where registration is verified/completed
    // OR publishers created through other means (direct admin creation)
    publishers, err := h.db.Queries.GetPendingPublishersWithVerifiedRegistration(ctx)
    // ...
}
```

---

## Security Checklist

- [ ] Public form never reveals if email exists
- [ ] Token is cryptographically secure
- [ ] Token expires after 7 days
- [ ] Unverified requests not shown in admin queue
- [ ] Cleanup job removes stale tokens after 30 days
- [ ] Verification page only reveals user status to email owner

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `db/migrations/00000000000012_publisher_registration_tokens.sql` | Create |
| `api/internal/db/queries/registration.sql` | Create |
| `api/internal/handlers/publisher_registration.go` | Create |
| `api/internal/services/cleanup_service.go` | Create |
| `api/cmd/api/main.go` | Register routes |
| `web/app/register/publisher/page.tsx` | Create |
| `web/app/register/verify/[token]/page.tsx` | Create |
| `web/app/register/success/page.tsx` | Create |

---

## Estimated Effort

| Task | Points |
|------|--------|
| Database schema | 1 |
| Backend handlers | 3 |
| Cleanup service | 1 |
| Frontend pages | 2 |
| Testing | 1 |
| Total | **8 points** |

---

## Dependencies

- Story 8-30 (User vs Publisher separation) - Conceptual foundation
- Story 8-31 (Invitation flow) - Shares token/email patterns
- Clerk API for user creation
- Email service for verification emails
