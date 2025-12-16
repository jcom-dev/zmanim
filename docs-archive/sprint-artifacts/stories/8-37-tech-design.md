# Technical Design: Story 8-37 - Unified Publisher Onboarding Flow

## Overview

This document provides detailed technical specifications for implementing the unified publisher onboarding flow, consolidating stories 8-28, 8-30, and 8-32.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  /become-publisher          │  /register/verify/[token]                  │
│  ────────────────────────   │  ───────────────────────────               │
│  Form:                      │  States:                                   │
│  - First Name*              │  - Loading (validating token)              │
│  - Last Name*               │  - Invalid/Expired                         │
│  - Email*                   │  - New User → "Under Review"               │
│  - Organization Name*       │  - Existing User → Confirm Dialog          │
│  - Website                  │  - Confirmed → "Under Review"              │
│  - Description* (10+ chars) │                                            │
│  - reCAPTCHA v3 (invisible) │                                            │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (Go API)                               │
├──────────────────────────────────────────────────────────────────────────┤
│  Services:                                                                │
│  ├── RecaptchaService      - Verify reCAPTCHA tokens                     │
│  ├── RegistrationService   - Handle registration flow                    │
│  ├── ClerkService          - Manage users and magic links                │
│  └── EmailService          - Send transactional emails                   │
│                                                                           │
│  Handlers:                                                                │
│  ├── POST /public/publisher-requests         - Submit + reCAPTCHA        │
│  ├── GET  /public/publisher-requests/verify/{token}                      │
│  ├── POST /public/publisher-requests/verify/{token}/confirm              │
│  ├── POST /public/publisher-requests/verify/{token}/cancel               │
│  ├── GET  /auth/admin/publisher-requests     - List verified only        │
│  ├── POST /auth/admin/publisher-requests/{id}/approve                    │
│  └── POST /auth/admin/publisher-requests/{id}/reject                     │
└──────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (PostgreSQL)                           │
├──────────────────────────────────────────────────────────────────────────┤
│  Tables:                                                                  │
│  ├── publisher_registration_tokens  - Enhanced with new fields           │
│  ├── blocked_emails                 - Permanent blocklist                │
│  ├── publishers                     - Created on approval                │
│  └── user_publishers                - Links users to publishers          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Database Changes

### Migration: 00000000000013_enhanced_publisher_registration.sql

```sql
-- Migration: Enhanced Publisher Registration for Story 8-37
-- Purpose: Add fields for unified onboarding flow

-- 1. Add new columns to publisher_registration_tokens
ALTER TABLE publisher_registration_tokens
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS existing_clerk_user_id TEXT,
    ADD COLUMN IF NOT EXISTS confirmed_existing_user BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_message TEXT,
    ADD COLUMN IF NOT EXISTS recaptcha_score NUMERIC(3,2);

-- 2. Make first_name/last_name required for new records
-- (existing records can have NULL for backwards compatibility)

-- 3. Create blocked_emails table
CREATE TABLE IF NOT EXISTS blocked_emails (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    blocked_by TEXT NOT NULL,  -- Admin clerk_user_id
    blocked_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT
);

-- Unique constraint on lowercase email
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_emails_email_lower
    ON blocked_emails(LOWER(email));

-- 4. Add index for admin queue (verified applications)
CREATE INDEX IF NOT EXISTS idx_reg_tokens_status_verified
    ON publisher_registration_tokens(status)
    WHERE status = 'verified';

-- 5. Comments
COMMENT ON COLUMN publisher_registration_tokens.first_name IS 'Applicant first name';
COMMENT ON COLUMN publisher_registration_tokens.last_name IS 'Applicant last name';
COMMENT ON COLUMN publisher_registration_tokens.existing_clerk_user_id IS 'Set if email matches existing Clerk user (server-side only)';
COMMENT ON COLUMN publisher_registration_tokens.confirmed_existing_user IS 'True if user confirmed "Yes, that is me" on verification page';
COMMENT ON COLUMN publisher_registration_tokens.recaptcha_score IS 'reCAPTCHA v3 score (0.0-1.0) for audit purposes';
COMMENT ON TABLE blocked_emails IS 'Emails permanently blocked from registration. Submissions silently ignored.';
```

### SQLc Queries: api/internal/db/queries/registration.sql

```sql
-- name: IsEmailBlocked :one
SELECT EXISTS(
    SELECT 1 FROM blocked_emails WHERE LOWER(email) = LOWER($1)
) AS blocked;

-- name: BlockEmail :exec
INSERT INTO blocked_emails (email, blocked_by, reason)
VALUES (LOWER($1), $2, $3)
ON CONFLICT (LOWER(email)) DO NOTHING;

-- name: CreateRegistrationToken :one
INSERT INTO publisher_registration_tokens (
    first_name,
    last_name,
    registrant_email,
    publisher_data,
    token,
    status,
    recaptcha_score,
    expires_at
) VALUES (
    $1, $2, LOWER($3), $4, $5, 'pending_verification', $6,
    NOW() + INTERVAL '7 days'
)
RETURNING *;

-- name: GetRegistrationByToken :one
SELECT * FROM publisher_registration_tokens
WHERE token = $1 AND status != 'expired';

-- name: MarkTokenVerified :exec
UPDATE publisher_registration_tokens
SET
    status = 'verified',
    verified_at = NOW(),
    user_exists = $2,
    existing_clerk_user_id = $3
WHERE token = $1 AND status = 'pending_verification';

-- name: ConfirmExistingUser :exec
UPDATE publisher_registration_tokens
SET confirmed_existing_user = true
WHERE token = $1 AND status = 'verified';

-- name: CancelRegistration :exec
UPDATE publisher_registration_tokens
SET status = 'cancelled'
WHERE token = $1;

-- name: GetVerifiedRegistrations :many
SELECT * FROM publisher_registration_tokens
WHERE status = 'verified'
ORDER BY created_at DESC;

-- name: ApproveRegistration :exec
UPDATE publisher_registration_tokens
SET
    status = 'approved',
    reviewed_by = $2,
    reviewed_at = NOW()
WHERE id = $1;

-- name: RejectRegistration :exec
UPDATE publisher_registration_tokens
SET
    status = 'rejected',
    reviewed_by = $2,
    reviewed_at = NOW(),
    rejection_message = $3
WHERE id = $1;

-- name: CleanupExpiredTokens :execrows
UPDATE publisher_registration_tokens
SET status = 'expired'
WHERE status = 'pending_verification'
  AND expires_at < NOW();

-- name: DeleteOldExpiredTokens :execrows
DELETE FROM publisher_registration_tokens
WHERE status IN ('expired', 'cancelled')
  AND created_at < NOW() - INTERVAL '30 days';
```

## Backend Implementation

### 1. reCAPTCHA Service

**File:** `api/internal/services/recaptcha_service.go`

```go
package services

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
    "os"
)

type RecaptchaService struct {
    secretKey string
    client    *http.Client
    threshold float64
}

type RecaptchaResponse struct {
    Success     bool     `json:"success"`
    Score       float64  `json:"score"`
    Action      string   `json:"action"`
    ChallengeTS string   `json:"challenge_ts"`
    Hostname    string   `json:"hostname"`
    ErrorCodes  []string `json:"error-codes,omitempty"`
}

func NewRecaptchaService() *RecaptchaService {
    return &RecaptchaService{
        secretKey: os.Getenv("RECAPTCHA_SECRET_KEY"),
        client:    &http.Client{},
        threshold: 0.5,
    }
}

func (s *RecaptchaService) Verify(token, expectedAction string) (*RecaptchaResponse, error) {
    if s.secretKey == "" {
        // In development without reCAPTCHA configured, allow through
        return &RecaptchaResponse{Success: true, Score: 1.0}, nil
    }

    resp, err := s.client.PostForm("https://www.google.com/recaptcha/api/siteverify",
        url.Values{
            "secret":   {s.secretKey},
            "response": {token},
        })
    if err != nil {
        return nil, fmt.Errorf("recaptcha verification failed: %w", err)
    }
    defer resp.Body.Close()

    var result RecaptchaResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("failed to decode recaptcha response: %w", err)
    }

    return &result, nil
}

func (s *RecaptchaService) IsValid(resp *RecaptchaResponse, expectedAction string) bool {
    return resp.Success &&
           resp.Score >= s.threshold &&
           (expectedAction == "" || resp.Action == expectedAction)
}
```

### 2. Registration Handler Updates

**File:** `api/internal/handlers/publisher_registration.go` (new file)

```go
package handlers

import (
    "encoding/json"
    "log/slog"
    "net/http"
    "strings"

    "github.com/go-chi/chi/v5"
)

type SubmitRegistrationRequest struct {
    FirstName        string `json:"first_name"`
    LastName         string `json:"last_name"`
    Email            string `json:"email"`
    OrganizationName string `json:"organization_name"`
    Website          string `json:"website"`
    Description      string `json:"description"`
    RecaptchaToken   string `json:"recaptcha_token"`
}

// SubmitPublisherRegistration handles new publisher applications
// POST /api/v1/public/publisher-requests
func (h *Handlers) SubmitPublisherRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req SubmitRegistrationRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Validate required fields
    validationErrors := make(map[string]string)
    if strings.TrimSpace(req.FirstName) == "" {
        validationErrors["first_name"] = "First name is required"
    }
    if strings.TrimSpace(req.LastName) == "" {
        validationErrors["last_name"] = "Last name is required"
    }
    if strings.TrimSpace(req.Email) == "" {
        validationErrors["email"] = "Email is required"
    } else if !isValidEmail(req.Email) {
        validationErrors["email"] = "Invalid email format"
    }
    if strings.TrimSpace(req.OrganizationName) == "" {
        validationErrors["organization_name"] = "Organization name is required"
    }
    if len(strings.TrimSpace(req.Description)) < 10 {
        validationErrors["description"] = "Description must be at least 10 characters"
    }
    if strings.TrimSpace(req.RecaptchaToken) == "" {
        validationErrors["recaptcha_token"] = "reCAPTCHA verification required"
    }

    if len(validationErrors) > 0 {
        RespondValidationError(w, r, "Invalid request", validationErrors)
        return
    }

    // Verify reCAPTCHA
    recaptchaResp, err := h.recaptchaService.Verify(req.RecaptchaToken, "publisher_registration")
    if err != nil {
        slog.Error("reCAPTCHA verification error", "error", err)
        // Don't reveal internal errors - treat as success to prevent enumeration
        h.respondRegistrationSuccess(w, r)
        return
    }

    if !h.recaptchaService.IsValid(recaptchaResp, "publisher_registration") {
        slog.Warn("reCAPTCHA score too low",
            "score", recaptchaResp.Score,
            "email", req.Email)
        RespondBadRequest(w, r, "Unable to verify you're not a robot. Please try again.")
        return
    }

    // Check if email is blocked (SILENT - always return success)
    blocked, err := h.db.Queries.IsEmailBlocked(ctx, req.Email)
    if err != nil {
        slog.Error("failed to check blocked email", "error", err)
    }
    if blocked.Blocked {
        slog.Info("blocked email attempted registration", "email", req.Email)
        h.respondRegistrationSuccess(w, r)
        return
    }

    // Generate verification token
    token, err := generateSecureToken()
    if err != nil {
        slog.Error("failed to generate token", "error", err)
        RespondInternalError(w, r, "Failed to process request")
        return
    }

    // Prepare publisher data JSON
    publisherData := map[string]string{
        "organization_name": strings.TrimSpace(req.OrganizationName),
        "website":           strings.TrimSpace(req.Website),
        "description":       strings.TrimSpace(req.Description),
    }
    publisherDataJSON, _ := json.Marshal(publisherData)

    // Create registration token
    _, err = h.db.Queries.CreateRegistrationToken(ctx, sqlcgen.CreateRegistrationTokenParams{
        FirstName:       strings.TrimSpace(req.FirstName),
        LastName:        strings.TrimSpace(req.LastName),
        RegistrantEmail: strings.ToLower(strings.TrimSpace(req.Email)),
        PublisherData:   publisherDataJSON,
        Token:           token,
        RecaptchaScore:  &recaptchaResp.Score,
    })
    if err != nil {
        slog.Error("failed to create registration token", "error", err)
        RespondInternalError(w, r, "Failed to process request")
        return
    }

    // Send verification email
    if h.emailService != nil {
        verificationURL := fmt.Sprintf("%s/register/verify/%s", h.emailService.GetWebURL(), token)
        go func() {
            _ = h.emailService.SendPublisherRegistrationVerification(
                req.Email,
                req.OrganizationName,
                verificationURL,
            )
        }()
    }

    h.respondRegistrationSuccess(w, r)
}

// respondRegistrationSuccess returns the standard success response
// Used for both successful submissions AND blocked emails (to prevent enumeration)
func (h *Handlers) respondRegistrationSuccess(w http.ResponseWriter, r *http.Request) {
    RespondJSON(w, r, http.StatusCreated, map[string]interface{}{
        "success": true,
        "message": "Please check your email to verify your application.",
    })
}

// VerifyRegistrationToken checks a verification token
// GET /api/v1/public/publisher-requests/verify/{token}
func (h *Handlers) VerifyRegistrationToken(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    reg, err := h.db.Queries.GetRegistrationByToken(ctx, token)
    if err != nil {
        RespondNotFound(w, r, "Invalid or expired verification link")
        return
    }

    // Check if expired
    if reg.ExpiresAt.Before(time.Now()) {
        RespondJSON(w, r, http.StatusGone, map[string]interface{}{
            "valid":   false,
            "expired": true,
            "message": "This verification link has expired. Please submit a new application.",
        })
        return
    }

    // Check if email exists in Clerk (server-side)
    var emailExists bool
    var userName string
    var clerkUserID string

    if reg.Status == "pending_verification" {
        // First verification - check Clerk
        user, err := h.clerkService.GetUserByEmail(ctx, reg.RegistrantEmail)
        if err == nil && user != nil {
            emailExists = true
            userName = fmt.Sprintf("%s %s", user.FirstName, user.LastName)
            clerkUserID = user.ID
        }

        // Mark as verified
        _ = h.db.Queries.MarkTokenVerified(ctx, sqlcgen.MarkTokenVerifiedParams{
            Token:              token,
            UserExists:         &emailExists,
            ExistingClerkUserID: &clerkUserID,
        })
    } else {
        // Already verified - use stored values
        emailExists = reg.UserExists != nil && *reg.UserExists
        if emailExists && reg.ExistingClerkUserID != nil {
            user, _ := h.clerkService.GetUserByID(ctx, *reg.ExistingClerkUserID)
            if user != nil {
                userName = fmt.Sprintf("%s %s", user.FirstName, user.LastName)
            }
        }
    }

    // Parse publisher data
    var publisherData map[string]string
    _ = json.Unmarshal(reg.PublisherData, &publisherData)

    response := map[string]interface{}{
        "valid":             true,
        "email_exists":      emailExists,
        "organization_name": publisherData["organization_name"],
        "status":            reg.Status,
    }

    if emailExists {
        response["user_name"] = userName
    }

    RespondJSON(w, r, http.StatusOK, response)
}

// ConfirmRegistration confirms an existing user's registration
// POST /api/v1/public/publisher-requests/verify/{token}/confirm
func (h *Handlers) ConfirmRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    err := h.db.Queries.ConfirmExistingUser(ctx, token)
    if err != nil {
        RespondNotFound(w, r, "Invalid verification link")
        return
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Your application has been submitted for review. You'll receive an email when it's approved.",
    })
}

// CancelRegistration silently cancels a registration
// POST /api/v1/public/publisher-requests/verify/{token}/cancel
func (h *Handlers) CancelRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    token := chi.URLParam(r, "token")

    _ = h.db.Queries.CancelRegistration(ctx, token)

    // Always return success (silent cancellation)
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
    })
}
```

### 3. Admin Approval with Clerk Magic Link

**File:** `api/internal/handlers/admin_registration.go`

```go
// AdminApproveRegistration approves and sends magic link
// POST /api/v1/auth/admin/publisher-requests/{id}/approve
func (h *Handlers) AdminApproveRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    registrationID := chi.URLParam(r, "id")
    adminUserID := middleware.GetUserID(ctx)

    // Parse UUID
    regUUID, err := uuid.Parse(registrationID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid registration ID")
        return
    }

    // Get registration
    reg, err := h.db.Queries.GetRegistrationByID(ctx, regUUID)
    if err != nil {
        RespondNotFound(w, r, "Registration not found")
        return
    }

    if reg.Status != "verified" {
        RespondBadRequest(w, r, "Registration is not in verified status")
        return
    }

    // Parse publisher data
    var publisherData map[string]string
    _ = json.Unmarshal(reg.PublisherData, &publisherData)

    // Start transaction
    tx, err := h.db.Pool.Begin(ctx)
    if err != nil {
        RespondInternalError(w, r, "Failed to process request")
        return
    }
    defer tx.Rollback(ctx)

    qtx := h.db.Queries.WithTx(tx)

    // Create or get Clerk user
    var clerkUserID string
    if reg.ExistingClerkUserID != nil && *reg.ExistingClerkUserID != "" {
        clerkUserID = *reg.ExistingClerkUserID
    } else {
        // Create new Clerk user (passwordless)
        newUser, err := h.clerkService.CreateUser(ctx, ClerkCreateUserParams{
            Email:     reg.RegistrantEmail,
            FirstName: reg.FirstName,
            LastName:  reg.LastName,
        })
        if err != nil {
            slog.Error("failed to create Clerk user", "error", err)
            RespondInternalError(w, r, "Failed to create user account")
            return
        }
        clerkUserID = newUser.ID
    }

    // Create publisher
    slug := generateSlug(publisherData["organization_name"])
    publisher, err := qtx.CreatePublisher(ctx, sqlcgen.CreatePublisherParams{
        Name:         publisherData["organization_name"],
        Slug:         &slug,
        ContactEmail: reg.RegistrantEmail, // Applicant email becomes contact email
        Description:  &publisherData["description"],
        Website:      &publisherData["website"],
    })
    if err != nil {
        slog.Error("failed to create publisher", "error", err)
        RespondInternalError(w, r, "Failed to create publisher")
        return
    }

    // Link user to publisher as owner
    err = qtx.AddUserToPublisher(ctx, sqlcgen.AddUserToPublisherParams{
        ClerkUserID: clerkUserID,
        PublisherID: publisher.ID,
        Role:        "owner",
    })
    if err != nil {
        slog.Error("failed to link user to publisher", "error", err)
        RespondInternalError(w, r, "Failed to link user to publisher")
        return
    }

    // Update registration status
    err = qtx.ApproveRegistration(ctx, sqlcgen.ApproveRegistrationParams{
        ID:         regUUID,
        ReviewedBy: &adminUserID,
    })
    if err != nil {
        slog.Error("failed to update registration", "error", err)
        RespondInternalError(w, r, "Failed to update registration")
        return
    }

    // Commit transaction
    if err := tx.Commit(ctx); err != nil {
        slog.Error("failed to commit", "error", err)
        RespondInternalError(w, r, "Failed to process request")
        return
    }

    // Send magic link email
    if h.emailService != nil {
        magicLink, err := h.clerkService.CreateMagicLink(ctx, clerkUserID, "/publisher/dashboard")
        if err != nil {
            slog.Error("failed to create magic link", "error", err)
            // Continue - user can still sign in normally
        } else {
            go func() {
                _ = h.emailService.SendPublisherApprovalMagicLink(
                    reg.RegistrantEmail,
                    reg.FirstName,
                    publisherData["organization_name"],
                    magicLink,
                )
            }()
        }
    }

    slog.Info("publisher registration approved",
        "registration_id", registrationID,
        "publisher_id", publisher.ID,
        "admin", adminUserID)

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success":      true,
        "publisher_id": publisher.ID,
        "message":      "Publisher created and magic link sent to applicant",
    })
}

// AdminRejectRegistration rejects with optional email blocking
// POST /api/v1/auth/admin/publisher-requests/{id}/reject
func (h *Handlers) AdminRejectRegistration(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    registrationID := chi.URLParam(r, "id")
    adminUserID := middleware.GetUserID(ctx)

    var req struct {
        Message    string `json:"message"`
        BlockEmail bool   `json:"block_email"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    if strings.TrimSpace(req.Message) == "" {
        RespondValidationError(w, r, "Rejection message is required", nil)
        return
    }

    regUUID, err := uuid.Parse(registrationID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid registration ID")
        return
    }

    reg, err := h.db.Queries.GetRegistrationByID(ctx, regUUID)
    if err != nil {
        RespondNotFound(w, r, "Registration not found")
        return
    }

    // Reject registration
    err = h.db.Queries.RejectRegistration(ctx, sqlcgen.RejectRegistrationParams{
        ID:               regUUID,
        ReviewedBy:       &adminUserID,
        RejectionMessage: &req.Message,
    })
    if err != nil {
        RespondInternalError(w, r, "Failed to reject registration")
        return
    }

    // Block email if requested
    if req.BlockEmail {
        _ = h.db.Queries.BlockEmail(ctx, sqlcgen.BlockEmailParams{
            Email:     reg.RegistrantEmail,
            BlockedBy: adminUserID,
            Reason:    &req.Message,
        })
    }

    // Parse publisher data for email
    var publisherData map[string]string
    _ = json.Unmarshal(reg.PublisherData, &publisherData)

    // Send rejection email
    if h.emailService != nil {
        go func() {
            _ = h.emailService.SendPublisherRejected(
                reg.RegistrantEmail,
                publisherData["organization_name"],
                req.Message,
            )
        }()
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "success": true,
        "message": "Registration rejected",
    })
}
```

## Frontend Implementation

### 1. Registration Form Component

**File:** `web/app/become-publisher/page.tsx` (update)

Key changes:
- Add `firstName`, `lastName` fields
- Integrate Google reCAPTCHA v3
- Remove "Already have an account" link
- Update success state

```tsx
'use client';

import { useState, useCallback } from 'react';
import Script from 'next/script';
// ... other imports

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function BecomePublisherPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organizationName: '',
    website: '',
    description: '',
  });
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  const executeRecaptcha = useCallback(async () => {
    if (!RECAPTCHA_SITE_KEY || !recaptchaLoaded) return '';
    return new Promise<string>((resolve) => {
      window.grecaptcha.ready(async () => {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
          action: 'publisher_registration',
        });
        resolve(token);
      });
    });
  }, [recaptchaLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... validation

    const recaptchaToken = await executeRecaptcha();
    if (!recaptchaToken && RECAPTCHA_SITE_KEY) {
      setSubmitError('Unable to verify you are not a robot. Please refresh and try again.');
      return;
    }

    await api.public.post('/publisher-requests', {
      body: JSON.stringify({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        organization_name: formData.organizationName.trim(),
        website: formData.website.trim() || null,
        description: formData.description.trim(),
        recaptcha_token: recaptchaToken,
      }),
    });
    // ...
  };

  return (
    <>
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          onLoad={() => setRecaptchaLoaded(true)}
        />
      )}
      {/* Form with firstName, lastName fields */}
    </>
  );
}
```

### 2. Verification Page

**File:** `web/app/register/verify/[token]/page.tsx` (new)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@/lib/api-client';

type VerificationState =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'new-user'
  | 'existing-user'
  | 'confirmed';

interface VerificationData {
  valid: boolean;
  expired?: boolean;
  email_exists: boolean;
  user_name?: string;
  organization_name: string;
}

export default function VerifyRegistrationPage() {
  const { token } = useParams<{ token: string }>();
  const api = useApi();
  const [state, setState] = useState<VerificationState>('loading');
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const result = await api.public.get(`/publisher-requests/verify/${token}`);
        setData(result);

        if (!result.valid) {
          setState(result.expired ? 'expired' : 'invalid');
        } else if (result.email_exists) {
          setState('existing-user');
        } else {
          setState('new-user');
        }
      } catch {
        setState('invalid');
      }
    }
    verify();
  }, [token]);

  const handleConfirm = async () => {
    await api.public.post(`/publisher-requests/verify/${token}/confirm`);
    setState('confirmed');
  };

  const handleCancel = async () => {
    await api.public.post(`/publisher-requests/verify/${token}/cancel`);
    // Silent redirect to home
    window.location.href = '/';
  };

  // Render based on state...
}
```

## Testing Plan

### Unit Tests

1. **RecaptchaService**: Mock HTTP responses, test threshold logic
2. **RegistrationHandler**: Test blocked email detection, token generation
3. **AdminHandler**: Test approval flow, Clerk integration

### E2E Tests

```typescript
// tests/e2e/publisher-onboarding.spec.ts

test.describe('Publisher Onboarding', () => {
  test('new user complete flow', async ({ page }) => {
    // Submit form
    await page.goto('/become-publisher');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'new@example.com');
    // ... fill other fields
    await page.click('button[type="submit"]');
    await expect(page.getByText('check your email')).toBeVisible();

    // Verify email (get token from test email service)
    const token = await getVerificationToken('new@example.com');
    await page.goto(`/register/verify/${token}`);
    await expect(page.getByText('under review')).toBeVisible();

    // Admin approval (separate admin test)
  });

  test('existing user confirmation flow', async ({ page }) => {
    // ... similar but check for "Is this your account?" dialog
  });

  test('blocked email silent ignore', async ({ page }) => {
    // Pre-block email in DB
    // Submit form with blocked email
    // Should see success message (no error)
    // Verify no email sent
  });
});
```

## Rollout Plan

1. **Phase 1**: Database migration + reCAPTCHA service
2. **Phase 2**: Backend API endpoints
3. **Phase 3**: Frontend form updates + verification page
4. **Phase 4**: Admin UI updates
5. **Phase 5**: E2E testing + security verification

## Security Checklist

- [ ] reCAPTCHA validation server-side only
- [ ] No email enumeration on public endpoints
- [ ] Blocked emails silently ignored
- [ ] Tokens are single-use and expire
- [ ] Admin endpoints require authentication
- [ ] Rate limiting on registration endpoint
- [ ] Clerk user creation is secure (no password leaks)

## User Signup Removal ⚠️ CRITICAL

**IMPORTANT**: This story requires complete removal of the user signup flow. Only publisher signup exists.

### Files to DELETE

| File | Type | Reason |
|------|------|--------|
| `web/app/sign-up/[[...sign-up]]/page.tsx` | React Page | Clerk signup page |
| `web/app/sign-up/` | Directory | Entire signup directory |

### Files to UPDATE

| File | Line(s) | Change |
|------|---------|--------|
| `web/app/accept-invitation/page.tsx` | 69 | Change `router.push('/sign-up')` to `router.push('/become-publisher')` or remove entire `handleClerkInvitation` function |
| `web/app/become-publisher/page.tsx` | 264-271 | **DELETE** the "Already have an account? Sign in" section |
| `web/.env.example` | 12 | **DELETE** the `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` comment |
| `api/internal/services/clerk_service.go` | 95 | Change `RedirectURL` from `/sign-up` to `/publisher/dashboard` |

### Code Snippets for Updates

**accept-invitation/page.tsx** - Update handleClerkInvitation:
```tsx
// BEFORE:
const handleClerkInvitation = () => {
  if (!isSignedIn || !user) {
    router.push('/sign-up');  // ❌ Remove this
    return;
  }
  // ...
};

// AFTER:
const handleClerkInvitation = () => {
  if (!isSignedIn || !user) {
    router.push('/become-publisher');  // ✅ Redirect to publisher signup
    return;
  }
  // ...
};
```

**become-publisher/page.tsx** - Delete lines 264-271:
```tsx
// DELETE THIS ENTIRE BLOCK:
{/* Info */}
<div className="mt-8 text-center text-sm text-muted-foreground">
  <p>
    Already have an account?{' '}
    <Link href="/sign-in" className="text-primary hover:underline">
      Sign in
    </Link>
  </p>
</div>
```

**clerk_service.go** - Update SendInvitation redirect:
```go
// BEFORE:
RedirectURL: clerk.String(webURL + "/sign-up"),  // ❌

// AFTER:
RedirectURL: clerk.String(webURL + "/publisher/dashboard"),  // ✅
```

### Clerk Dashboard Configuration

1. Navigate to Clerk Dashboard → Settings → User & Authentication
2. Set "Sign-up mode" to **Restricted**
3. Disable "Allow users to sign up"
4. Enable "Require invitation or admin approval"
5. Verify sign-in still works (needed for returning users)

### Verification Commands

```bash
# After implementation, verify:

# 1. Sign-up page should 404
curl -I http://localhost:3001/sign-up
# Expected: HTTP 404

# 2. Sign-in should still work
curl -I http://localhost:3001/sign-in
# Expected: HTTP 200

# 3. No signup references in frontend code
grep -r "sign-up" web/app/ --include="*.tsx" --include="*.ts"
# Expected: No matches

# 4. No signup references in backend code (except comments)
grep -r "/sign-up" api/ --include="*.go" | grep -v "// "
# Expected: No matches (only comments allowed)
```
