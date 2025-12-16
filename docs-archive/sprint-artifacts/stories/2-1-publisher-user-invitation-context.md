# Story Context: 2.1 Publisher User Invitation

**Generated:** 2025-11-26
**Story:** Publisher User Invitation
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From PRD (docs/prd.md)

**User Management Requirements:**
- FR1: Admins can create publisher accounts with email, name, and organization
- FR2: Publishers can log in via Clerk authentication
- FR4: Admins can verify, suspend, or reactivate publisher accounts

**Permission Model:**
| Role | Capabilities |
|------|--------------|
| Admin | Full platform access, publisher management, system configuration |
| Publisher | Manage own algorithms, coverage areas, profile; view own analytics |

### From Architecture (docs/architecture.md)

**Authentication Flow:**
```
User → Clerk UI → Clerk Service → JWT issued
                                      │
Frontend stores JWT ◀─────────────────┘
                                      │
API Request + JWT ────────────────────▼
                              Go Middleware
                              (Clerk validation)
                                      │
                              Extract user_id
                              Check role (admin/publisher/user)
```

**Clerk Integration:**
- All `/api/publisher/*` and `/api/admin/*` endpoints require Clerk JWT
- JWT passed via `Authorization: Bearer {token}` header
- Go middleware validates JWT with Clerk public key

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**Clerk Metadata Schema:**
```typescript
// User publicMetadata structure
interface UserPublicMetadata {
  role: 'user' | 'publisher' | 'admin';
  publisher_access_list?: string[];  // Array of publisher UUIDs
}

// Invitation publicMetadata
interface InvitationMetadata {
  role: 'publisher';
  publisher_access_list: string[];  // Publisher UUIDs user will have access to
}
```

**User Invitation Flow:**
```
Admin → POST /api/admin/publishers/{id}/users/invite
    │
    ├── Validate publisher exists
    ├── Check user not already linked
    │
    └── Call ClerkService.CreateInvitation()
        │
        ├── Create invitation with publicMetadata:
        │   { role: 'publisher', publisher_access_list: [publisher_id] }
        │
        └── Clerk sends email with redirect to /accept-invitation
```

---

## Existing Code References

### Backend - Clerk Service

**File:** `api/internal/services/clerk_service.go`

Current implementation has:
- `CreatePublisherUser()` - Creates Clerk user with publisher role
- `SendInvitation()` - Sends invitation email (needs enhancement for publisher_access_list)
- `UpdateUserMetadata()` - Updates user's public metadata
- `DeleteUser()` - Deletes Clerk user

**Key code pattern:**
```go
// Current invitation (line 67-96)
func (s *ClerkService) SendInvitation(ctx context.Context, email string) error {
    publicMetadata := map[string]interface{}{
        "role": "publisher",
    }
    // ... needs publisher_access_list added
}
```

### Backend - Admin Handlers

**File:** `api/internal/handlers/admin.go`

Existing endpoints:
- `AdminListPublishers()` - GET /api/admin/publishers (line 17)
- `AdminCreatePublisher()` - POST /api/admin/publishers (line 82)
- `AdminVerifyPublisher()` - PUT /api/admin/publishers/{id}/verify (line 204)
- `AdminSuspendPublisher()` - PUT /api/admin/publishers/{id}/suspend (line 225)
- `AdminReactivatePublisher()` - PUT /api/admin/publishers/{id}/reactivate (line 246)

**Needs to add:**
- `AdminGetPublisherUsers()` - GET /api/admin/publishers/{id}/users
- `AdminInviteUserToPublisher()` - POST /api/admin/publishers/{id}/users/invite
- `AdminRemoveUserFromPublisher()` - DELETE /api/admin/publishers/{id}/users/{userId}

### Backend - Auth Middleware

**File:** `api/internal/middleware/auth.go`

Key context keys (line 20-27):
```go
const (
    UserIDKey contextKey = "user_id"
    UserRoleKey contextKey = "user_role"
)
```

Claims structure (line 30-38):
```go
type Claims struct {
    Subject   string                 `json:"sub"`
    Metadata  map[string]interface{} `json:"metadata"`
    // ...
}
```

### Frontend - Admin Publishers Page

**File:** `web/app/admin/publishers/page.tsx`
- Existing publisher list page
- Needs enhancement to link to individual publisher detail with users section

**File:** `web/app/admin/publishers/new/page.tsx`
- Existing new publisher form
- Reference for form patterns

### Database Schema

**Table:** `publishers`
```sql
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE,  -- Links to Clerk user
    name TEXT NOT NULL,
    organization TEXT,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending_verification',
    -- ...
);
```

Note: User-publisher linking is stored in Clerk metadata, NOT in database. The `clerk_user_id` in publishers table is for the original creator, not all linked users.

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Clerk SDK configured | ✅ Done | `github.com/clerk/clerk-sdk-go/v2` in go.mod |
| Admin handlers exist | ✅ Done | `api/internal/handlers/admin.go` |
| Publisher CRUD | ✅ Done | Story 1.3 completed |
| Clerk React components | ✅ Done | `@clerk/nextjs` in package.json |

---

## API Contracts

### GET /api/admin/publishers/{id}/users

**Response:**
```json
{
  "users": [
    {
      "clerk_user_id": "user_abc123",
      "email": "rabbi@example.com",
      "name": "Rabbi Cohen",
      "invited_at": "2025-11-25T10:00:00Z",
      "accepted_at": "2025-11-25T12:00:00Z"
    }
  ]
}
```

### POST /api/admin/publishers/{id}/users/invite

**Request:**
```json
{
  "email": "newuser@example.com"
}
```

**Response:**
```json
{
  "invitation_id": "inv_abc123",
  "status": "sent"
}
```

**Errors:**
- 400: Invalid email format
- 404: Publisher not found
- 409: User already has access to this publisher

### DELETE /api/admin/publishers/{id}/users/{userId}

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- 404: Publisher or user not found

---

## Implementation Checklist

### Backend Tasks
- [ ] Enhance `ClerkService.SendInvitation()` to accept publisherId and include in metadata
- [ ] Add `ClerkService.GetUsersByMetadata()` to query users with publisher in access list
- [ ] Add `ClerkService.AppendPublisherToUser()` for existing users
- [ ] Add `ClerkService.RemovePublisherFromUser()` to update access list
- [ ] Create `AdminGetPublisherUsers` handler
- [ ] Create `AdminInviteUserToPublisher` handler
- [ ] Create `AdminRemoveUserFromPublisher` handler
- [ ] Add routes to router

### Frontend Tasks
- [ ] Create `/admin/publishers/[id]/page.tsx` with Users section
- [ ] Create invite user modal/form component
- [ ] Add remove user confirmation dialog
- [ ] Create `/accept-invitation/page.tsx` for post-signup redirect

### Testing
- [ ] Unit test: ClerkService invitation with metadata
- [ ] Integration test: Full invitation flow
- [ ] E2E test: Admin invites user, user signs up, user has access
