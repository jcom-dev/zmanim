# Story 8-31: Secure User Invitation Flow - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium (Security-Sensitive)

---

## Executive Summary

Implement a secure invitation flow that:
1. Never reveals whether an email exists in the system (prevents enumeration)
2. Sends different email content based on user existence (server-side only)
3. Links existing users seamlessly
4. Onboards new users with account creation

---

## Security Design Principles

### 1. No User Enumeration

**Problem:** If the system says "User found" vs "User not found", attackers can enumerate valid emails.

**Solution:** API always returns the same response regardless of user existence:
```json
{
  "success": true,
  "message": "Invitation sent to user@example.com"
}
```

### 2. Email-Based User Detection (Server-Side Only)

The server checks Clerk for existing users and sends different email templates:
- **Existing user:** "Link this publisher to your account"
- **New user:** "Create an account to join this publisher"

The admin UI never sees which template was sent.

### 3. Token Security

- Cryptographically secure random tokens
- Single-use (invalidated after acceptance)
- 7-day expiration
- Unique per publisher+email combination

---

## Database Schema

### publisher_invitations Table

```sql
-- File: db/migrations/00000000000011_publisher_invitations_v2.sql

-- Check if table exists and add missing columns, or create fresh
CREATE TABLE IF NOT EXISTS publisher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id INT NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',     -- Role to assign: owner, admin, member
    invited_by TEXT NOT NULL,                -- Clerk user ID of inviter
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, cancelled
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Can't invite same email twice to same publisher (pending)
    UNIQUE(publisher_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON publisher_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON publisher_invitations(publisher_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON publisher_invitations(email);
```

### SQLc Queries

```sql
-- File: api/internal/db/queries/invitations.sql

-- name: CreateInvitation :one
INSERT INTO publisher_invitations (publisher_id, email, token, role, invited_by, expires_at)
VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')
ON CONFLICT (publisher_id, email)
DO UPDATE SET
    token = EXCLUDED.token,
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    status = 'pending',
    expires_at = NOW() + INTERVAL '7 days',
    accepted_at = NULL
RETURNING *;

-- name: GetInvitationByToken :one
SELECT pi.*, p.name as publisher_name
FROM publisher_invitations pi
JOIN publishers p ON p.id = pi.publisher_id
WHERE pi.token = $1 AND pi.status = 'pending' AND pi.expires_at > NOW();

-- name: AcceptInvitation :one
UPDATE publisher_invitations
SET status = 'accepted', accepted_at = NOW()
WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
RETURNING *;

-- name: ListPendingInvitations :many
SELECT id, email, role, status, expires_at, created_at
FROM publisher_invitations
WHERE publisher_id = $1 AND status = 'pending'
ORDER BY created_at DESC;

-- name: CancelInvitation :exec
UPDATE publisher_invitations
SET status = 'cancelled'
WHERE id = $1 AND publisher_id = $2;

-- name: ExpireOldInvitations :exec
UPDATE publisher_invitations
SET status = 'expired'
WHERE status = 'pending' AND expires_at < NOW();
```

---

## API Design

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/publisher/invite` | Publisher owner/admin | Send invitation |
| GET | `/auth/publisher/invitations` | Publisher owner/admin | List pending |
| DELETE | `/auth/publisher/invitations/{id}` | Publisher owner/admin | Cancel invitation |
| POST | `/auth/publisher/invitations/{id}/resend` | Publisher owner/admin | Resend |
| POST | `/public/invitations/{token}/accept` | None (public) | Accept invitation |
| GET | `/public/invitations/{token}` | None (public) | Validate token |

### Request/Response Schemas

**POST /auth/publisher/invite**
```go
type InviteRequest struct {
    Email string `json:"email" validate:"required,email"`
    Role  string `json:"role,omitempty"` // default: member
}

// Response is ALWAYS the same - no user enumeration
type InviteResponse struct {
    Success bool   `json:"success"`
    Message string `json:"message"` // "Invitation sent to {email}"
}
```

**GET /public/invitations/{token}**
```go
// Only called by the invitee - safe to reveal user status here
type ValidateTokenResponse struct {
    Valid         bool   `json:"valid"`
    UserStatus    string `json:"user_status"`     // "existing" or "new"
    UserName      string `json:"user_name,omitempty"` // Only if existing
    PublisherName string `json:"publisher_name"`
    Role          string `json:"role"`
}
```

**POST /public/invitations/{token}/accept**
```go
type AcceptInvitationRequest struct {
    // Only required for new users
    FirstName string `json:"first_name,omitempty"`
    LastName  string `json:"last_name,omitempty"`
}

type AcceptInvitationResponse struct {
    Success     bool   `json:"success"`
    RedirectURL string `json:"redirect_url"` // "/publisher/dashboard"
}
```

---

## Backend Implementation

### Invite Handler

```go
// File: api/internal/handlers/publisher_invitations.go

func (h *Handlers) InviteToPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context (must be owner/admin)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    // 2. Parse request
    var req InviteRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 3. Validate email format
    if !isValidEmail(req.Email) {
        RespondBadRequest(w, r, "Invalid email format")
        return
    }

    // 4. Check rate limit (max 10 invitations per hour per publisher)
    // TODO: Implement rate limiting

    // 5. Generate secure token
    token := generateSecureToken()

    // 6. Create/update invitation record
    publisherID, _ := strconv.ParseInt(pc.PublisherID, 10, 32)
    invitation, err := h.db.Queries.CreateInvitation(ctx, sqlcgen.CreateInvitationParams{
        PublisherID: int32(publisherID),
        Email:       req.Email,
        Token:       token,
        Role:        req.Role,
        InvitedBy:   pc.UserID,
    })
    if err != nil {
        slog.Error("failed to create invitation", "error", err)
        RespondInternalError(w, r, "Failed to create invitation")
        return
    }

    // 7. Check if user exists in Clerk (SERVER-SIDE ONLY - never expose to admin)
    userExists := h.checkUserExistsInClerk(ctx, req.Email)

    // 8. Send appropriate email template (async)
    go h.sendInvitationEmail(ctx, invitation, userExists)

    // 9. ALWAYS return same response (no enumeration)
    RespondJSON(w, r, http.StatusOK, InviteResponse{
        Success: true,
        Message: fmt.Sprintf("Invitation sent to %s", req.Email),
    })
}

func (h *Handlers) checkUserExistsInClerk(ctx context.Context, email string) bool {
    // Call Clerk API to check if email exists
    // This is server-side only - result never exposed to caller
    users, err := h.clerkClient.Users().List(ctx, clerk.ListUsersParams{
        EmailAddress: []string{email},
    })
    if err != nil {
        slog.Error("failed to check Clerk for user", "error", err)
        return false
    }
    return len(users) > 0
}

func generateSecureToken() string {
    b := make([]byte, 32)
    rand.Read(b)
    return base64.URLEncoding.EncodeToString(b)
}
```

### Validate Token Handler (Public)

```go
func (h *Handlers) ValidateInvitationToken(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    // 1. Get invitation
    invitation, err := h.db.Queries.GetInvitationByToken(ctx, token)
    if err != nil {
        RespondJSON(w, r, http.StatusOK, ValidateTokenResponse{Valid: false})
        return
    }

    // 2. Check if user exists (safe to reveal to the invitee themselves)
    userExists := h.checkUserExistsInClerk(ctx, invitation.Email)

    var userName string
    if userExists {
        // Get user's name from Clerk
        users, _ := h.clerkClient.Users().List(ctx, clerk.ListUsersParams{
            EmailAddress: []string{invitation.Email},
        })
        if len(users) > 0 {
            userName = fmt.Sprintf("%s %s", users[0].FirstName, users[0].LastName)
        }
    }

    RespondJSON(w, r, http.StatusOK, ValidateTokenResponse{
        Valid:         true,
        UserStatus:    ifThenElse(userExists, "existing", "new"),
        UserName:      userName,
        PublisherName: invitation.PublisherName,
        Role:          invitation.Role,
    })
}
```

### Accept Invitation Handler (Public)

```go
func (h *Handlers) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    var req AcceptInvitationRequest
    json.NewDecoder(r.Body).Decode(&req)

    // 1. Get and validate invitation
    invitation, err := h.db.Queries.GetInvitationByToken(ctx, token)
    if err != nil {
        RespondNotFound(w, r, "Invalid or expired invitation")
        return
    }

    // 2. Check if user exists
    userExists := h.checkUserExistsInClerk(ctx, invitation.Email)

    var clerkUserID string

    if userExists {
        // 3a. Get existing user
        users, _ := h.clerkClient.Users().List(ctx, clerk.ListUsersParams{
            EmailAddress: []string{invitation.Email},
        })
        if len(users) > 0 {
            clerkUserID = users[0].ID
        }
    } else {
        // 3b. Create new user in Clerk
        if req.FirstName == "" || req.LastName == "" {
            RespondBadRequest(w, r, "First and last name required for new users")
            return
        }

        newUser, err := h.clerkClient.Users().Create(ctx, clerk.CreateUserParams{
            EmailAddress: []string{invitation.Email},
            FirstName:    &req.FirstName,
            LastName:     &req.LastName,
            // Password handling via Clerk magic link or OAuth
        })
        if err != nil {
            RespondInternalError(w, r, "Failed to create user account")
            return
        }
        clerkUserID = newUser.ID
    }

    // 4. Link user to publisher (update Clerk metadata)
    err = h.addUserToPublisher(ctx, clerkUserID, invitation.PublisherID, invitation.Role)
    if err != nil {
        RespondInternalError(w, r, "Failed to link user to publisher")
        return
    }

    // 5. Mark invitation as accepted
    h.db.Queries.AcceptInvitation(ctx, token)

    // 6. Return success with redirect
    RespondJSON(w, r, http.StatusOK, AcceptInvitationResponse{
        Success:     true,
        RedirectURL: "/publisher/dashboard",
    })
}
```

---

## Email Templates

### Existing User Template

```html
Subject: You've been invited to join {{.PublisherName}} on Shtetl Zmanim

Hi {{.UserName}},

{{.InviterName}} has invited you to join {{.PublisherName}} as a {{.Role}}.

Since you already have a Shtetl Zmanim account, clicking the link below
will add {{.PublisherName}} to your account.

[Accept Invitation]({{.AcceptURL}})

This invitation expires in 7 days.

---
Shtetl Zmanim
```

### New User Template

```html
Subject: You've been invited to join {{.PublisherName}} on Shtetl Zmanim

Hi,

{{.InviterName}} has invited you to join {{.PublisherName}} as a {{.Role}}.

Click below to create your Shtetl Zmanim account and join {{.PublisherName}}.

[Create Account & Join]({{.AcceptURL}})

This invitation expires in 7 days.

---
Shtetl Zmanim
```

---

## Frontend Implementation

### Invitation Page

```typescript
// File: web/app/invite/[token]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface TokenValidation {
  valid: boolean;
  user_status: 'existing' | 'new';
  user_name?: string;
  publisher_name: string;
  role: string;
}

export default function InvitationPage() {
  const { token } = useParams();
  const router = useRouter();
  const [validation, setValidation] = useState<TokenValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    fetch(`/api/v1/public/invitations/${token}`)
      .then(r => r.json())
      .then(setValidation)
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    const body = validation?.user_status === 'new'
      ? { first_name: firstName, last_name: lastName }
      : {};

    const res = await fetch(`/api/v1/public/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.success) {
      router.push(data.redirect_url);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!validation?.valid) {
    return (
      <div className="text-center p-8">
        <h1>Invalid or Expired Invitation</h1>
        <p>This invitation link is no longer valid. Please request a new invitation.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">
        Join {validation.publisher_name}
      </h1>

      {validation.user_status === 'existing' ? (
        <>
          <p className="mb-4">
            Welcome back, {validation.user_name}!
            Click below to add {validation.publisher_name} to your account.
          </p>
          <button onClick={handleAccept} className="btn-primary w-full">
            Accept & Join
          </button>
        </>
      ) : (
        <>
          <p className="mb-4">
            Create your account to join {validation.publisher_name}.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); handleAccept(); }}>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="input mb-2 w-full"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="input mb-4 w-full"
            />
            <button type="submit" className="btn-primary w-full">
              Create Account & Join
            </button>
          </form>
        </>
      )}
    </div>
  );
}
```

---

## Security Checklist

- [ ] API never reveals if email exists to admin
- [ ] Token is cryptographically secure (32 bytes)
- [ ] Token is single-use (status changes on accept)
- [ ] Token expires after 7 days
- [ ] Rate limiting on invitation creation (10/hour/publisher)
- [ ] Email templates don't leak information to external observers
- [ ] Validation endpoint only reveals user status to the email owner

---

## Files to Create/Modify

| File | Action |
|------|---------|
| `db/migrations/00000000000011_publisher_invitations_v2.sql` | Create/update schema |
| `api/internal/db/queries/invitations.sql` | New queries |
| `api/internal/handlers/publisher_invitations.go` | New handlers |
| `api/cmd/api/main.go` | Register routes |
| `web/app/invite/[token]/page.tsx` | New page |
| `api/internal/email/templates/invitation_existing.html` | Email template |
| `api/internal/email/templates/invitation_new.html` | Email template |

---

## Estimated Effort

| Task | Points |
|------|--------|
| Database schema | 1 |
| Backend handlers | 3 |
| Email integration | 2 |
| Frontend page | 2 |
| Testing | 1 |
| Total | **8 points** |

---

## Dependencies

- Story 8-30 (User vs Publisher separation) - Conceptual foundation
- Clerk API access for user lookup/creation
- Email service configuration
