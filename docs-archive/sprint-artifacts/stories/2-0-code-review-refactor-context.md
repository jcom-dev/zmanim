# Story Context: 2.0 Code Review & Refactor

**Generated:** 2025-11-26
**Story:** Code Review & Refactor (Last Commit)
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Epic 2 Spec (docs/epic-2-publisher-user-management.md)

**Key Difference from Existing Code:**

The last commit creates a NEW Clerk user when creating a publisher. Epic 2 specifies:
> "Admin creates publisher, then invites a NEW or EXISTING user. User has metadata linking them to specific publisher(s)."

**Correct Metadata Structure (from Tech Spec):**
```json
{
  "role": "publisher",
  "publisher_access_list": ["pub_uuid_1", "pub_uuid_2"],
  "primary_publisher_id": "pub_uuid_1"
}
```

---

## Code from Last Commit (ef140ee)

### File: `api/internal/services/clerk_service.go`

**Current Implementation:**
```go
// CreatePublisherUser creates a new Clerk user with publisher role and sends invitation
func (s *ClerkService) CreatePublisherUser(ctx context.Context, email, name, organization string) (string, error) {
    publicMetadata := map[string]interface{}{
        "role":         "publisher",
        "organization": organization,
    }
    // Creates NEW user...
}
```

**Problem:** This creates a user tied to ONE organization, not supporting multi-publisher access.

**Needed Changes:**
1. Remove `CreatePublisherUser` or deprecate
2. Add `AddPublisherToUser(clerkUserID, publisherID string)` method
3. Modify invitation to pass `publisherID` in redirect URL or metadata

### File: `api/internal/handlers/admin.go`

**Current AdminCreatePublisher (lines 82-200):**
```go
func (h *Handlers) AdminCreatePublisher(w http.ResponseWriter, r *http.Request) {
    // ...
    // Create Clerk user with publisher role
    if h.clerkService != nil {
        userID, err := h.clerkService.CreatePublisherUser(ctx, req.Email, req.Name, req.Organization)
        // ...
        // Send invitation email
        if inviteErr := h.clerkService.SendInvitation(ctx, req.Email); inviteErr != nil {
            // ...
        }
    }
    // Insert new publisher
    // ...
}
```

**Problem:** Couples publisher creation with user creation. Epic 2 specifies these as separate flows.

**Needed Changes:**
1. Remove Clerk calls from `AdminCreatePublisher`
2. Create separate `AdminInviteUserToPublisher` endpoint

### File: `api/internal/services/algorithm_service.go`

**Status:** Good - no changes needed. Well-structured service with:
- Clean dependency injection pattern
- Template loading from files
- Validation methods
- Draft/published status workflow

### File: `db/migrations/20240005_update_algorithms_for_editor.sql`

**Status:** Good - demonstrates proper migration patterns:
- `ADD COLUMN IF NOT EXISTS` for idempotency
- CHECK constraints for status values
- Compound indexes for common queries
- Comments for documentation

### File: `api/main` (Binary)

**Status:** Remove - binary files should never be committed.

### File: `test.html`

**Status:** Review - appears to be a temporary test file in project root.

---

## Refactoring Plan

### Phase 1: Cleanup (Immediate)

```bash
# Remove binary from git tracking
git rm --cached api/main

# Add to .gitignore
echo "api/main" >> .gitignore

# Handle test.html
rm test.html  # or move to tests/ if needed
```

### Phase 2: Clerk Service Refactor

**New Method - Add Publisher to User:**
```go
// AddPublisherToUser adds a publisher ID to user's access list
func (s *ClerkService) AddPublisherToUser(ctx context.Context, clerkUserID, publisherID string) error {
    // Get current user to read existing metadata
    user, err := clerkUser.Get(ctx, clerkUserID)
    if err != nil {
        return fmt.Errorf("failed to get user: %w", err)
    }

    // Parse existing metadata
    var metadata map[string]interface{}
    if user.PublicMetadata != nil {
        if err := json.Unmarshal(user.PublicMetadata, &metadata); err != nil {
            metadata = make(map[string]interface{})
        }
    } else {
        metadata = make(map[string]interface{})
    }

    // Get or create publisher_access_list
    var accessList []string
    if existing, ok := metadata["publisher_access_list"].([]interface{}); ok {
        for _, v := range existing {
            if s, ok := v.(string); ok {
                accessList = append(accessList, s)
            }
        }
    }

    // Check if already in list
    for _, id := range accessList {
        if id == publisherID {
            return nil // Already has access
        }
    }

    // Add new publisher
    accessList = append(accessList, publisherID)
    metadata["publisher_access_list"] = accessList
    metadata["role"] = "publisher"

    // Set primary if first publisher
    if _, hasPrimary := metadata["primary_publisher_id"]; !hasPrimary {
        metadata["primary_publisher_id"] = publisherID
    }

    return s.UpdateUserMetadata(ctx, clerkUserID, metadata)
}

// RemovePublisherFromUser removes a publisher ID from user's access list
func (s *ClerkService) RemovePublisherFromUser(ctx context.Context, clerkUserID, publisherID string) error {
    // Similar pattern: get user, modify list, update metadata
}
```

**Modified Invitation with Publisher ID:**
```go
// SendPublisherInvitation sends invitation with publisher context
func (s *ClerkService) SendPublisherInvitation(ctx context.Context, email, publisherID string) error {
    publicMetadata := map[string]interface{}{
        "role":                 "publisher",
        "publisher_access_list": []string{publisherID},
        "primary_publisher_id": publisherID,
    }

    metadataJSON, err := json.Marshal(publicMetadata)
    if err != nil {
        return fmt.Errorf("failed to marshal metadata: %w", err)
    }

    webURL := os.Getenv("WEB_URL")
    if webURL == "" {
        webURL = "http://localhost:3001"
    }

    params := &clerkInvitation.CreateParams{
        EmailAddress:   email,
        PublicMetadata: clerk.JSONRawMessage(metadataJSON),
        RedirectURL:    clerk.String(fmt.Sprintf("%s/publisher?invited=%s", webURL, publisherID)),
    }

    _, err = clerkInvitation.Create(ctx, params)
    return err
}
```

### Phase 3: Handler Separation

**Simplified AdminCreatePublisher:**
```go
func (h *Handlers) AdminCreatePublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var req struct {
        Name         string  `json:"name"`
        Organization string  `json:"organization"`
        Website      *string `json:"website"`
        Bio          *string `json:"bio"`
    }

    // Decode and validate (no email required - that's for invitation)
    // ...

    // Create publisher without any Clerk involvement
    query := `
        INSERT INTO publishers (name, organization, slug, website, description, status)
        VALUES ($1, $2, $3, $4, $5, 'pending_verification')
        RETURNING id, name, organization, status, created_at
    `
    // ...
}
```

**New AdminInviteUserToPublisher:**
```go
// POST /api/admin/publishers/{id}/invite
func (h *Handlers) AdminInviteUserToPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := chi.URLParam(r, "id")

    var req struct {
        Email string `json:"email"`
    }
    // Decode and validate...

    // Verify publisher exists
    // ...

    // Send invitation with publisher context
    if err := h.clerkService.SendPublisherInvitation(ctx, req.Email, publisherID); err != nil {
        slog.Error("failed to send publisher invitation", "error", err)
        RespondInternalError(w, r, "Failed to send invitation")
        return
    }

    RespondJSON(w, r, http.StatusOK, map[string]string{
        "message": "Invitation sent",
        "email":   req.Email,
    })
}
```

---

## Good Patterns to Document

### 1. Service Pattern with Dependency Injection
```go
type Service struct {
    db *db.DB
}

func NewService(database *db.DB) *Service {
    return &Service{db: database}
}
```

### 2. Environment-Based Configuration
```go
secretKey := os.Getenv("CLERK_SECRET_KEY")
if secretKey == "" {
    return nil, fmt.Errorf("CLERK_SECRET_KEY is not set")
}
```

### 3. Graceful Error Handling with Cleanup
```go
if err != nil {
    // If operation A failed but operation B succeeded, clean up B
    if previousResourceCreated {
        cleanup()
    }
    return err
}
```

### 4. Structured Logging
```go
slog.Info("operation completed",
    "id", id,
    "status", status,
    "extra_field", value,
)
```

### 5. SQL Query Patterns
```go
query := `
    SELECT ...
    ORDER BY
        CASE status
            WHEN 'published' THEN 1
            WHEN 'draft' THEN 2
        END,
        created_at DESC
    LIMIT 1
`
```

---

## Implementation Checklist

### Cleanup Tasks
- [ ] `git rm --cached api/main`
- [ ] Add `api/main` to `.gitignore`
- [ ] Remove or relocate `test.html`
- [ ] Commit cleanup changes

### Refactor Tasks
- [ ] Add `AddPublisherToUser` method to clerk_service.go
- [ ] Add `RemovePublisherFromUser` method
- [ ] Create `SendPublisherInvitation` method
- [ ] Deprecate/remove `CreatePublisherUser`
- [ ] Simplify `AdminCreatePublisher` (remove Clerk calls)
- [ ] Create `AdminInviteUserToPublisher` handler
- [ ] Add route for invite endpoint

### Testing Tasks
- [ ] Test publisher creation without Clerk
- [ ] Test invitation flow with publisher metadata
- [ ] Verify existing algorithm functionality unaffected

### Documentation Tasks
- [ ] Document patterns in dev notes
- [ ] Update any affected API documentation

---

## Files to Modify

| File | Action |
|------|--------|
| `api/internal/services/clerk_service.go` | Add new methods, deprecate old |
| `api/internal/handlers/admin.go` | Simplify publisher creation, add invite |
| `api/internal/handlers/routes.go` | Add invite route |
| `.gitignore` | Add api/main |
| `test.html` | Remove |
| `api/main` | Remove from git |
