# Story 8.32: Publisher Registration with Email Verification

Status: approved

## Story

As a person wanting to register a new publisher,
I want to verify my email address during registration,
So that my existing Shtetl Zmanim account (if any) is automatically linked without revealing account existence publicly.

## Context

**Public-Facing Security:**
When someone requests to register a new publisher, the system must NOT reveal whether their email already has an account. This prevents enumeration attacks.

**User Experience:**
- If user exists: Link new publisher to existing account seamlessly
- If user is new: Create account during publisher registration
- In both cases: Email verification proves ownership

**Flow:**
1. User fills publisher registration form (publisher name, contact info, their email)
2. System sends verification email (doesn't reveal if account exists)
3. User clicks verification link
4. **If existing user:** "Welcome back! Your new publisher will be linked to your account"
5. **If new user:** "Create your account to complete publisher registration"
6. Publisher request submitted for admin approval

## Acceptance Criteria

1. Publisher registration form collects: publisher name, publisher contact email, registrant's email
2. Registrant's email requires verification before submission
3. System does NOT reveal if registrant's email exists in system
4. Verification email sent to registrant (not publisher contact email)
5. Existing users see streamlined "link account" flow
6. New users complete account creation during verification
7. After verification, publisher request goes to admin queue
8. Admin sees registrant user info when reviewing request
9. **Unverified requests are NOT visible in admin queue** (only verified ones)
10. **Unverified registration tokens auto-deleted after 30 days** (cleanup job)
11. Verification token expires after 7 days (user must restart if expired)

## Tasks / Subtasks

- [ ] Task 1: Backend - Registration token system
  - [ ] 1.1 Create `publisher_registration_tokens` table
  - [ ] 1.2 Store: registrant_email, publisher_data (JSON), token, expires_at
  - [ ] 1.3 Token generation on registration form submit
  - [ ] 1.4 Token validation endpoint
- [ ] Task 2: Backend - Registration API
  - [ ] 2.1 `POST /public/publishers/register` - Start registration (sends verification)
  - [ ] 2.2 `GET /public/publishers/register/verify/{token}` - Verify token, return status
  - [ ] 2.3 `POST /public/publishers/register/complete/{token}` - Complete registration
- [ ] Task 3: Backend - User handling (server-side)
  - [ ] 3.1 On verification: check if email exists in Clerk
  - [ ] 3.2 If exists: return "existing_user" status (to verification page only)
  - [ ] 3.3 If new: return "new_user" status with registration form requirements
  - [ ] 3.4 On complete: link or create user, submit publisher request
- [ ] Task 4: Frontend - Registration form
  - [ ] 4.1 Step 1: Publisher details (name, contact email, description)
  - [ ] 4.2 Step 2: Your details (your email for login)
  - [ ] 4.3 Submit: "Verification email sent to [email]"
  - [ ] 4.4 No indication of whether email exists
- [ ] Task 5: Frontend - Verification page
  - [ ] 5.1 `/register/verify/[token]` page
  - [ ] 5.2 If existing user: "Welcome back, [name]! Confirm to submit publisher request"
  - [ ] 5.3 If new user: "Create your account" form (first/last name, password via Clerk)
  - [ ] 5.4 Success: "Publisher request submitted for review"
- [ ] Task 6: Email templates
  - [ ] 6.1 Verification email (same for existing/new - no account status revealed)
  - [ ] 6.2 Subject: "Verify your email to complete publisher registration"
  - [ ] 6.3 Body: Link to verification page
- [ ] Task 7: Admin review enhancements
  - [ ] 7.1 Admin sees registrant user info (name, email) in request
  - [ ] 7.2 Admin can approve → creates publisher + links user as owner
  - [ ] 7.3 Approval email sent to registrant
- [ ] Task 8: Backend - Cleanup job for unverified requests
  - [ ] 8.1 Create scheduled job (cron or on-demand) to delete expired tokens
  - [ ] 8.2 Delete registration tokens older than 30 days with status != 'completed'
  - [ ] 8.3 Log cleanup stats for monitoring
  - [ ] 8.4 Ensure admin queue only shows verified/completed requests
- [ ] Task 9: Testing
  - [ ] 9.1 E2E: New user registers publisher → creates account → request submitted
  - [ ] 9.2 E2E: Existing user registers publisher → links account → request submitted
  - [ ] 9.3 Security: Public form doesn't reveal account existence
  - [ ] 9.4 E2E: Admin approval flow works correctly
  - [ ] 9.5 Test: Unverified requests don't appear in admin queue
  - [ ] 9.6 Test: 30-day cleanup job deletes stale tokens

## Dev Notes

### Database Schema

```sql
CREATE TABLE publisher_registration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registrant_email TEXT NOT NULL,
    publisher_data JSONB NOT NULL,  -- name, contact_email, description, etc.
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, verified, completed, expired
    user_exists BOOLEAN,  -- Set on verification (server-side only)
    verified_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reg_tokens_token ON publisher_registration_tokens(token);
CREATE INDEX idx_reg_tokens_email ON publisher_registration_tokens(registrant_email);
```

### Registration Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ PUBLIC FORM (no auth required)                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Enter publisher details                                      │
│ 2. Enter your email (for login)                                │
│ 3. Submit → "Verification email sent"                          │
│    (Does NOT reveal if email exists)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ EMAIL SENT                                                      │
│ "Click to verify your email and complete registration"          │
│ (Same email for existing and new users)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ VERIFICATION PAGE /register/verify/[token]                     │
├─────────────────────────────────────────────────────────────────┤
│ IF EXISTING USER:                │ IF NEW USER:                 │
│ "Welcome back, John!"            │ "Create your account"        │
│ "Click to submit your            │ - First name                 │
│  publisher request"              │ - Last name                  │
│ [Confirm & Submit]               │ - Password (via Clerk)       │
│                                  │ [Create Account & Submit]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUCCESS                                                         │
│ "Your publisher request has been submitted for review."         │
│ "You'll receive an email when it's approved."                  │
└─────────────────────────────────────────────────────────────────┘
```

### API Responses

```json
// Step 1: Start registration (public)
POST /public/publishers/register
Request: {
  "publisher_name": "My Shul",
  "publisher_contact_email": "info@myshul.org",
  "publisher_description": "...",
  "registrant_email": "rabbi@gmail.com"
}

Response (always same - no leak):
{
  "success": true,
  "message": "Verification email sent. Please check your inbox."
}

// Step 2: Verify token (reveals status to user only)
GET /public/publishers/register/verify/{token}

Response (existing user):
{
  "valid": true,
  "user_status": "existing",
  "user_name": "Rabbi Cohen",  // From Clerk
  "publisher_name": "My Shul"
}

Response (new user):
{
  "valid": true,
  "user_status": "new",
  "publisher_name": "My Shul",
  "required_fields": ["first_name", "last_name"]
}
```

### Differentiation from Story 8.31

| Story 8.31 (Invitation) | Story 8.32 (Registration) |
|-------------------------|---------------------------|
| Admin invites user to existing publisher | User requests new publisher |
| Publisher already exists | Publisher will be created |
| Admin initiates | User initiates |
| User joins as member/admin | User becomes owner |

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md)
- **Context File:** [8-32-publisher-registration-email-verification.context.xml](./8-32-publisher-registration-email-verification.context.xml)
- **Tech Design:** See "Database Schema", "Registration Flow Diagram", and "API Responses" sections above
- **Related Stories:** Story 8.30 (entity separation), Story 8.31 (shares token/email patterns)

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

### Code Quality
- [ ] `publisher_registration_tokens` table created with proper schema
- [ ] Token generation is secure (UUID + signature)
- [ ] Token expiration (7 days) enforced
- [ ] 30-day cleanup job for unverified tokens implemented
- [ ] Admin queue only shows verified requests

### Functionality
- [ ] Registration form works without revealing account existence
- [ ] Existing users can link accounts seamlessly (verified via token)
- [ ] New users can create accounts during registration
- [ ] Admin review shows registrant user info
- [ ] Approval email sent to registrant on admin approval

### Security
- [ ] No user enumeration: Public API response identical for existing/new users
- [ ] Unverified requests never visible in admin queue
- [ ] Expired tokens handled gracefully with appropriate error

### Testing
- [ ] Backend tests pass: `cd api && go test ./...`
- [ ] Type check passes: `cd web && npm run type-check`
- [ ] E2E tests created and pass:
  - [ ] E2E: New user registers publisher → creates account → request submitted
  - [ ] E2E: Existing user registers publisher → links account → request submitted
  - [ ] E2E: Admin approval flow works correctly
  - [ ] E2E: Unverified requests don't appear in admin queue
- [ ] Security test: Public form doesn't reveal account existence

### Verification Commands
```bash
# Backend tests
cd api && go test ./...

# Frontend type check
cd web && npm run type-check

# E2E tests
cd tests && npx playwright test registration

# Security test: Verify no user enumeration
# Register with existing email
curl -X POST http://localhost:8080/api/v1/public/publishers/register \
     -H "Content-Type: application/json" \
     -d '{"publisher_name": "Test", "publisher_contact_email": "info@test.com", "registrant_email": "existing@example.com"}'
# Expected: {"success": true, "message": "Verification email sent. Please check your inbox."}

# Register with new email (response should be IDENTICAL)
curl -X POST http://localhost:8080/api/v1/public/publishers/register \
     -H "Content-Type: application/json" \
     -d '{"publisher_name": "Test", "publisher_contact_email": "info@test.com", "registrant_email": "new@example.com"}'
# Expected: {"success": true, "message": "Verification email sent. Please check your inbox."}

# Verify admin queue only shows verified requests
curl -H "Authorization: Bearer $ADMIN_JWT" \
     http://localhost:8080/api/v1/auth/admin/publisher-requests | jq '.[] | .status'
# Expected: All should be "verified" or "completed", no "pending"

# Test cleanup job (if implemented as endpoint)
curl -X POST http://localhost:8080/api/v1/internal/cleanup-expired-registrations
```

## Estimated Points

8 points (Feature - Security-sensitive)

## Dependencies

- Story 8.30 (User vs Publisher separation) - conceptual foundation
- Story 8.31 (Invitation flow) - shares token/email patterns

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted for publisher registration flow | Claude Opus 4.5 |
