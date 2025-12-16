# Story 2.10: Publisher Member Invitation

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Drafted
**Priority:** Medium
**Sprint Change:** Added 2025-11-26

---

## User Story

**As a** publisher,
**I want** to invite team members to help manage my publisher account,
**So that** I can delegate algorithm and coverage management.

---

## Acceptance Criteria

### AC1: Team Page Access
**Given** I am logged in as a publisher
**When** I navigate to `/publisher/team`
**Then** I see a "Team Members" page
**And** I see a list of current team members with their email and access date

### AC2: Current Team Display
**Given** I am viewing my team page
**When** there are team members
**Then** I see each member's:
  - Email address
  - Name (if available from Clerk)
  - Date added
  - "Remove" button

**Given** I am the only team member
**When** I view the page
**Then** I see myself listed with "(Owner)" badge
**And** I cannot remove myself

### AC3: Invite New Member
**Given** I am viewing my team page
**When** I click "Invite Member"
**Then** I see a dialog/form with email address field

**Given** I enter a valid email and submit
**When** the invitation is created
**Then** an invitation email is sent via Resend
**And** I see a success message
**And** the pending invitation appears in my team list with "Pending" status

### AC4: Pending Invitations Display
**Given** I have sent invitations
**When** I view my team page
**Then** I see pending invitations in a separate section
**And** each shows: email, sent date, "Resend" and "Cancel" options
**And** expired invitations show "Expired" status

### AC5: Accept Invitation Flow
**Given** an invitee receives the invitation email
**When** they click the invitation link
**Then** they are directed to `/accept-publisher-invite?token=xxx`

**Given** the invitee is not logged in
**When** they access the accept page
**Then** they are prompted to sign in or create an account

**Given** the invitee is logged in
**When** they access the accept page with valid token
**Then** they are added to the publisher's access list
**And** the invitation status changes to "accepted"
**And** they see a success message
**And** they are redirected to the publisher dashboard

### AC6: Invalid/Expired Token
**Given** an invitee accesses the accept page
**When** the token is invalid or expired
**Then** they see an error message: "This invitation is invalid or has expired. Please request a new invitation."

### AC7: Remove Team Member
**Given** I am viewing my team
**When** I click "Remove" on a team member
**Then** I see a confirmation dialog
**And** upon confirmation, they are removed from my publisher's access list
**And** they can no longer access my publisher dashboard
**And** they keep their Clerk account (just lose publisher access)

### AC8: Resend Invitation
**Given** I have a pending invitation
**When** I click "Resend"
**Then** a new invitation email is sent
**And** the expiration is reset
**And** I see a success message

### AC9: Cancel Invitation
**Given** I have a pending invitation
**When** I click "Cancel"
**Then** the invitation is deleted
**And** if the link is used, it shows as invalid

---

## Technical Notes

### New Files

```
web/app/publisher/team/page.tsx              # Team management page
web/app/accept-publisher-invite/page.tsx     # Accept invitation page
web/components/publisher/TeamMemberList.tsx  # Team member list component
web/components/publisher/InviteDialog.tsx    # Invite member dialog
api/internal/handlers/publisher_team.go      # Team handlers
api/internal/models/publisher_invitation.go  # Invitation model
```

### Database Schema

```sql
CREATE TABLE publisher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL, -- UUID or secure random token
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, cancelled
    invited_by TEXT NOT NULL, -- clerk_user_id of inviter
    expires_at TIMESTAMPTZ NOT NULL, -- 7 days from creation
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publisher_invitations_token ON publisher_invitations(token);
CREATE INDEX idx_publisher_invitations_publisher ON publisher_invitations(publisher_id);
CREATE INDEX idx_publisher_invitations_email ON publisher_invitations(email, publisher_id);
```

### API Endpoints

```
# Publisher endpoints (require publisher auth)
GET /api/publisher/team
Response: {
    "data": {
        "members": [
            {
                "user_id": "clerk_user_id",
                "email": "member@example.com",
                "name": "John Doe",
                "added_at": "2025-11-20T10:00:00Z",
                "is_owner": false
            }
        ],
        "pending_invitations": [
            {
                "id": "uuid",
                "email": "invited@example.com",
                "status": "pending",
                "expires_at": "2025-12-03T10:00:00Z",
                "created_at": "2025-11-26T10:00:00Z"
            }
        ]
    }
}

POST /api/publisher/team/invite
Body: { "email": "newmember@example.com" }
Response: { "success": true, "message": "Invitation sent" }

DELETE /api/publisher/team/{userId}
Response: { "success": true, "message": "Member removed" }

POST /api/publisher/team/invitations/{id}/resend
Response: { "success": true, "message": "Invitation resent" }

DELETE /api/publisher/team/invitations/{id}
Response: { "success": true, "message": "Invitation cancelled" }

# Public endpoint (with token)
POST /api/publisher/team/accept
Body: { "token": "invitation-token-uuid" }
Response: {
    "success": true,
    "publisher_id": "uuid",
    "publisher_name": "Congregation Beth Israel",
    "message": "You've been added to the team!"
}
```

### Token Generation

```go
import (
    "crypto/rand"
    "encoding/base64"
)

func generateInvitationToken() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)
    if err != nil {
        return "", err
    }
    return base64.URLEncoding.EncodeToString(b), nil
}
```

### Clerk Metadata Update

When invitation is accepted:
```go
// Get current publisher_access_list from Clerk
// Append new publisher_id
// Update Clerk user metadata
clerkClient.Users.UpdateUserMetadata(userId, &clerk.UpdateUserMetadataParams{
    PublicMetadata: map[string]interface{}{
        "role": "publisher",
        "publisher_access_list": append(existingList, publisherId),
    },
})
```

### Email Integration

```go
acceptURL := fmt.Sprintf("https://zmanim.com/accept-publisher-invite?token=%s", token)
emailService.SendInvitation(
    invitation.Email,
    inviterName,
    publisherName,
    acceptURL,
)
```

---

## Dependencies

- Story 2.11: Email Service Integration (Resend)
- Story 2.1: Publisher User Invitation (pattern reference)

## Dependent Stories

- None

---

## Definition of Done

- [ ] Team page at `/publisher/team` implemented
- [ ] Invite dialog with email validation
- [ ] Invitation emails sent via Resend
- [ ] Accept invitation page with token validation
- [ ] Clerk metadata updated on acceptance
- [ ] Remove member functionality
- [ ] Resend/cancel invitation options
- [ ] Expiration handling (7-day default)
- [ ] Mobile responsive design
- [ ] Success/error toast notifications

---

## FRs Covered

| FR | Description |
|----|-------------|
| FR58 | Publisher can view team members |
| FR59 | Publisher can invite new team members via email |
| FR60 | Publisher can remove team members |

---

_Sprint Change Addition: 2025-11-26_
