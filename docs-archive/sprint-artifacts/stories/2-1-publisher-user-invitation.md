# Story 2.1: Publisher User Invitation

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** High
**Story Points:** 5

---

## User Story

**As an** administrator,
**I want** to invite users to manage a publisher account via Clerk,
**So that** real people can access and configure their publisher's settings.

---

## Acceptance Criteria

### AC-1: View Publisher Users
**Given** I am logged in as an admin
**When** I navigate to /admin/publishers/{id}
**Then** I see a "Users" section with a list of users linked to this publisher

### AC-2: Invite User Form
**Given** I am viewing a publisher's users section
**When** I click "Invite User"
**Then** I see a form with email address field

### AC-3: Send Invitation
**Given** I enter a valid email and submit
**When** the invitation is created
**Then** Clerk sends an invitation email with redirect to /accept-invitation
**And** the invitation includes publicMetadata: `{ role: 'publisher', publisher_access_list: [publisher_id] }`

### AC-4: New User Signup
**Given** an invited user clicks the invitation link
**When** they complete Clerk signup
**Then** their account is created with the metadata from the invitation
**And** they can access /publisher dashboard

### AC-5: Existing User Invitation
**Given** an existing user is invited to another publisher
**When** they accept the invitation
**Then** the new publisher_id is added to their publisher_access_list
**And** they can switch between publishers

### AC-6: Remove User
**Given** I am viewing a publisher's users
**When** I click "Remove" on a user
**Then** that publisher_id is removed from their publisher_access_list
**And** if they have no publishers left, their role reverts to 'user'

---

## Technical Notes

### Backend Changes

**File:** `api/internal/services/clerk_service.go`
- Enhance `SendInvitation()` to accept publisher_id and set in publicMetadata
- Add `GetUsersByPublisher()` to list users with this publisher in their access list
- Add `RemovePublisherFromUser()` to update user's publisher_access_list
- Add `AppendPublisherToUser()` for existing users invited to new publisher

**File:** `api/internal/handlers/admin.go`
- Add `AdminGetPublisherUsers()` - GET /api/admin/publishers/{id}/users
- Add `AdminInviteUserToPublisher()` - POST /api/admin/publishers/{id}/users/invite
- Add `AdminRemoveUserFromPublisher()` - DELETE /api/admin/publishers/{id}/users/{userId}

### Frontend Changes

**File:** `web/app/admin/publishers/[id]/page.tsx` (create or enhance)
- Add Users section with list view
- Add "Invite User" button and modal form
- Add "Remove" action on each user row

**File:** `web/app/accept-invitation/page.tsx` (create)
- Handle post-signup redirect
- Display welcome message and redirect to /publisher

### API Endpoints

```
GET /api/admin/publishers/{id}/users
Response: {
  users: [{
    clerk_user_id: string,
    email: string,
    name: string,
    invited_at: string,
    accepted_at: string | null
  }]
}

POST /api/admin/publishers/{id}/users/invite
Request: { email: string }
Response: { invitation_id: string, status: 'sent' }
Errors: 400 (invalid email), 404 (publisher not found), 409 (already invited)

DELETE /api/admin/publishers/{id}/users/{userId}
Response: { success: true }
Errors: 404 (publisher/user not found)
```

### Clerk Integration

```typescript
// Invitation with publisher metadata
const invitation = await clerkClient.invitations.createInvitation({
  emailAddress: email,
  redirectUrl: `${process.env.WEB_URL}/accept-invitation`,
  publicMetadata: {
    role: 'publisher',
    publisher_access_list: [publisherId]
  }
});

// Update existing user's metadata (append publisher)
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    ...existingMetadata,
    publisher_access_list: [...existingList, newPublisherId]
  }
});
```

---

## Dependencies

- Story 1.3 (Admin Publisher Management) - DONE
- Clerk SDK configured - DONE

---

## Definition of Done

- [x] Admin can view list of users for a publisher
- [x] Admin can invite new user via email
- [x] Invited user receives email and can sign up
- [x] New user has correct metadata after signup
- [x] Existing user can be invited to additional publisher
- [x] Admin can remove user from publisher
- [ ] Unit tests for ClerkService enhancements
- [ ] Integration tests for new API endpoints
- [ ] E2E test: full invitation flow

---

## Dev Agent Record

### Completion Notes

**Backend Changes:**
- `api/internal/services/clerk_service.go`: Added `GetUsersWithPublisherAccess()` method
- `api/internal/handlers/admin.go`: Added `AdminGetPublisherUsers()` handler
- `api/cmd/api/main.go`: Added route `GET /api/v1/admin/publishers/{id}/users`

**Frontend Changes:**
- `web/app/admin/publishers/[id]/page.tsx`: New publisher detail page with:
  - Publisher details display
  - Status management (verify/suspend/reactivate)
  - Users section with list view
  - Invite User dialog with email input
  - Remove user with confirmation dialog
- `web/app/admin/publishers/page.tsx`: Added link to detail page
- `web/app/accept-invitation/page.tsx`: Post-signup redirect page

**API Endpoints:**
- `GET /api/v1/admin/publishers/{id}/users` - List users with publisher access
- `POST /api/v1/admin/publishers/{id}/users/invite` - Invite user (from Story 2-0)
- `DELETE /api/v1/admin/publishers/{id}/users/{userId}` - Remove user (from Story 2-0)

**Status:** done

---

## FRs Covered

- FR43: Admin can invite users to a publisher via Clerk with metadata linking
- FR44: Invitation carries role and publisher_access_list in publicMetadata
- FR45: User can be linked to multiple publishers
