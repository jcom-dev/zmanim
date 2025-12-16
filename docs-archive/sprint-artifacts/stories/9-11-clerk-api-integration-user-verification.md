# Story 9.11: Clerk API Integration for User Verification

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Medium (Feature implementation)
**Story Points:** 3

---

## User Story

**As a** system administrator,
**I want** to verify users exist in Clerk before processing invitation acceptances,
**So that** we maintain data integrity and prevent orphaned records.

---

## Context

The invitation acceptance flow currently skips Clerk user verification due to a TODO placeholder. This means invitations could theoretically be accepted with invalid user IDs, leading to data integrity issues.

**Source TODO:**
- `api/internal/handlers/invitations.go:621` - "TODO: Implement Clerk API check when Clerk client is available"

**Current State:**
```go
func (h *Handlers) checkUserExistsInClerk(ctx context.Context, email string) bool {
    // TODO: Implement Clerk API check when Clerk client is available
    // For now, return false (assume new user)
    return false
}
```

**Target State:**
- Clerk SDK integrated for user lookup
- Users verified before invitation acceptance
- Proper handling of edge cases (deleted users, suspended users)
- Server-side only - never exposed to API

---

## Acceptance Criteria

### AC1: Clerk SDK Integration
**Given** the application starts
**When** the Clerk client is initialized
**Then** the SDK is properly configured with API keys

### AC2: User Existence Check
**Given** an invitation acceptance request
**When** the system processes the request
**Then** it verifies the user exists in Clerk before proceeding

### AC3: Email-Based Lookup
**Given** an email address
**When** `checkUserExistsInClerk` is called
**Then** it queries Clerk for users with that email
**And** returns true if found, false otherwise

### AC4: Suspended User Handling
**Given** a user exists but is suspended in Clerk
**When** they try to accept an invitation
**Then** the invitation is rejected with appropriate error

### AC5: Deleted User Handling
**Given** a user was deleted from Clerk
**When** they try to accept an invitation
**Then** the invitation is rejected with appropriate error

### AC6: Server-Side Only
**Given** the user verification function
**When** called from any context
**Then** the result is NEVER exposed to API responses (security)

---

## Technical Notes

### Clerk SDK Installation

```bash
cd api
go get github.com/clerk/clerk-sdk-go/v2
```

### Environment Variables

```bash
# Already exists in SSM
CLERK_SECRET_KEY=sk_live_xxx
```

### Implementation

**Clerk Client Setup (in main.go or services):**
```go
import (
    "github.com/clerk/clerk-sdk-go/v2"
    "github.com/clerk/clerk-sdk-go/v2/user"
)

func NewClerkClient(secretKey string) (*clerk.APIClient, error) {
    config := clerk.NewConfiguration()
    config.AddDefaultHeader("Authorization", "Bearer "+secretKey)
    return clerk.NewAPIClient(config), nil
}
```

**Updated checkUserExistsInClerk:**
```go
func (h *Handlers) checkUserExistsInClerk(ctx context.Context, email string) bool {
    if h.clerkClient == nil {
        slog.Warn("Clerk client not configured, skipping user check")
        return false
    }

    users, err := h.clerkClient.Users.List(ctx, &clerk.UserListParams{
        EmailAddress: []string{email},
    })
    if err != nil {
        slog.Error("failed to query Clerk", "error", err, "email", email)
        return false // Fail open - don't block invitation
    }

    for _, u := range users.Data {
        if u.Banned || u.Locked {
            slog.Info("user exists but is suspended", "email", email)
            return false
        }
        return true
    }

    return false
}
```

**Extended Version for AcceptInvitation:**
```go
func (h *Handlers) verifyUserForInvitation(ctx context.Context, userID string) error {
    if h.clerkClient == nil {
        return nil // Skip check if not configured
    }

    user, err := h.clerkClient.Users.Get(ctx, userID)
    if err != nil {
        if clerk.IsNotFoundError(err) {
            return fmt.Errorf("user not found in Clerk")
        }
        slog.Error("failed to verify user", "error", err, "userID", userID)
        return nil // Fail open
    }

    if user.Banned {
        return fmt.Errorf("user account is suspended")
    }

    if user.Locked {
        return fmt.Errorf("user account is locked")
    }

    return nil
}
```

### Integration Points

**Handlers struct update:**
```go
type Handlers struct {
    db          *db.DB
    cfg         *config.Config
    clerkClient *clerk.APIClient  // Add this
    emailService email.Service    // From Story 9.10
}
```

**AcceptInvitation update:**
```go
func (h *Handlers) AcceptInvitation(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...

    // Verify user before accepting
    if err := h.verifyUserForInvitation(ctx, userID); err != nil {
        RespondError(w, r, http.StatusForbidden, err.Error())
        return
    }

    // ... continue with acceptance ...
}
```

### Error Handling Strategy

| Scenario | Action | Reason |
|----------|--------|--------|
| Clerk API unavailable | Log + continue | Don't block invitations |
| User not found | Return error | Data integrity |
| User suspended | Return error | Security |
| User locked | Return error | Security |
| Rate limited | Retry with backoff | Transient error |

---

## Tasks / Subtasks

- [ ] Task 1: Install Clerk SDK
  - [ ] 1.1 Add clerk-sdk-go dependency
  - [ ] 1.2 Run go mod tidy
  - [ ] 1.3 Verify SDK version compatibility

- [ ] Task 2: Create Clerk client wrapper
  - [ ] 2.1 Create `api/internal/clerk/client.go`
  - [ ] 2.2 Implement NewClient function
  - [ ] 2.3 Add error handling and logging
  - [ ] 2.4 Add graceful degradation if not configured

- [ ] Task 3: Update Handlers struct
  - [ ] 3.1 Add clerkClient field to Handlers
  - [ ] 3.2 Update NewHandlers to accept Clerk client
  - [ ] 3.3 Update main.go to initialize Clerk client

- [ ] Task 4: Implement user verification
  - [ ] 4.1 Update checkUserExistsInClerk implementation
  - [ ] 4.2 Create verifyUserForInvitation function
  - [ ] 4.3 Handle suspended/locked users
  - [ ] 4.4 Add appropriate error messages

- [ ] Task 5: Integrate with invitation flow
  - [ ] 5.1 Update AcceptInvitation to call verifyUserForInvitation
  - [ ] 5.2 Add proper error responses for invalid users
  - [ ] 5.3 Ensure user info NEVER exposed to API responses

- [ ] Task 6: Testing
  - [ ] 6.1 Create Clerk client mock
  - [ ] 6.2 Test user exists scenario
  - [ ] 6.3 Test user not found scenario
  - [ ] 6.4 Test suspended user scenario
  - [ ] 6.5 Test Clerk API unavailable scenario
  - [ ] 6.6 Test rate limiting handling

- [ ] Task 7: Documentation
  - [ ] 7.1 Document Clerk integration in CLAUDE.md
  - [ ] 7.2 Document environment variables
  - [ ] 7.3 Document error handling strategy

---

## Dependencies

**Depends On:**
- Clerk account configured (already exists)
- CLERK_SECRET_KEY in SSM (already exists)

**Dependent Stories:**
- Story 9.10 (Email Service) - may share infrastructure patterns

---

## Definition of Done

- [ ] Clerk SDK installed and configured
- [ ] checkUserExistsInClerk properly implemented
- [ ] User verification before invitation acceptance
- [ ] Suspended/locked users handled correctly
- [ ] Clerk API failures don't block invitations (fail open)
- [ ] No user information exposed in API responses
- [ ] Unit tests with mocked Clerk client
- [ ] Manual testing with real Clerk integration
- [ ] Environment variables documented

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Clerk API rate limits | LOW | MEDIUM | Implement caching, rate limiting |
| Clerk API downtime | LOW | LOW | Fail open strategy |
| SDK breaking changes | LOW | MEDIUM | Pin SDK version |
| Secrets exposure | LOW | HIGH | Use SSM, never log secrets |

---

## Dev Notes

### Clerk API Rate Limits

Clerk has the following rate limits:
- 20 requests/second for most endpoints
- Consider caching user lookups for repeated checks

### Caching Strategy (Optional Enhancement)

```go
// Optional: Cache user existence checks
type UserCache struct {
    mu    sync.RWMutex
    cache map[string]cacheEntry
    ttl   time.Duration
}

type cacheEntry struct {
    exists    bool
    expiresAt time.Time
}

func (c *UserCache) Get(email string) (bool, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    if entry, ok := c.cache[email]; ok && time.Now().Before(entry.expiresAt) {
        return entry.exists, true
    }
    return false, false
}
```

### Security Considerations

1. **Never expose user existence to API** - This is an enumeration vector
2. **Never log Clerk API keys** - Use redaction in logs
3. **Never return Clerk errors verbatim** - May contain sensitive info

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 3_
