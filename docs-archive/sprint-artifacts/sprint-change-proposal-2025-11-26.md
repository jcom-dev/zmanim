# Sprint Change Proposal: Epic 2 Additions

**Date:** 2025-11-26
**Type:** Additive Change (new stories at end of sprint)
**Scope:** Minor - Direct implementation by dev team
**Requested By:** BMad

---

## 1. Issue Summary

### Problem Statement

Epic 2 is nearing completion with stories 2.7 and 2.8 ready for development. The following features are needed to complete the user experience but were not included in the original epic:

1. **Self-service Publisher Registration** - Currently only admins can create publishers. Potential publishers need a way to request access.
2. **Publisher-initiated Member Invitations** - Story 2.1 allows admins to invite users, but publishers should be able to invite their own team members.
3. **Email System** - The platform lacks transactional email capability. Resend has been configured but not integrated.
4. **User Profile UI** - No way for users to view their account info, see their role, or access account functions from the header.

### Context

- Epic 2 focus is "Connect People to Publishers"
- These additions align with that theme
- Resend API key already configured in `.env.resend`
- Clerk currently handles emails, but we want branded emails via Resend

### Evidence

- `.env.resend` exists with valid credentials
- No profile dropdown component in current codebase
- No public publisher registration page exists
- Publisher user invitation (2.1) is admin-only

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Notes |
|------|--------|-------|
| Epic 2 | Extended | 4 new stories added (2.9-2.12) |
| Epic 3+ | None | No impact on future epics |

### Story Impact

| Story | Impact | Notes |
|-------|--------|-------|
| 2.7, 2.8 | None | Remain ready-for-dev, unchanged |
| 2.1 | Enhanced | Publisher member invitation builds on admin invitation pattern |
| 2.3 | Referenced | Impersonation banner pattern reused for profile dropdown |

### Artifact Conflicts

| Artifact | Conflict | Required Update |
|----------|----------|-----------------|
| PRD | None | No core goals affected |
| Architecture | Minor | Add email service component |
| UX Design | Minor | Add profile dropdown pattern |
| Epic 2 Doc | Update | Add new stories 2.9-2.12 |

### Technical Impact

| Area | Impact |
|------|--------|
| Go Backend | New email service, new endpoints |
| Database | New `publisher_requests` table |
| Frontend | New pages, profile dropdown component |
| Environment | Resend vars already configured |

---

## 3. Recommended Approach

**Selected Path:** Direct Adjustment - Add new stories within existing Epic 2

### Rationale

- Changes are additive, not disruptive
- Aligns with Epic 2 theme
- Email infrastructure (Resend) already set up
- No rollback or MVP scope change needed

### Effort Estimate

| Story | Effort | Risk |
|-------|--------|------|
| 2.9 Publisher Registration | Medium | Low |
| 2.10 Publisher Member Invitation | Medium | Low |
| 2.11 Email Service (Resend) | Medium | Low |
| 2.12 User Profile Dropdown | Low | Low |

**Total Additional Effort:** ~4 story points

---

## 4. Detailed Change Proposals

### Story 2.9: Publisher Registration Request

**As a** potential publisher,
**I want** to submit a registration request with my details,
**So that** I can become a publisher on Shtetl Zmanim after admin approval.

#### Acceptance Criteria

**Given** I am not logged in or logged in as a regular user
**When** I navigate to `/become-publisher`
**Then** I see a registration form

**Given** I am viewing the registration form
**When** I fill in: name, organization, email, website (optional), description
**Then** I can submit the request

**Given** I submit a valid registration request
**When** the submission is processed
**Then** I see a confirmation message
**And** my request is stored with status "pending"
**And** (future) admin receives notification

**Given** I am an admin viewing `/admin/publishers`
**When** I look at the page
**Then** I see a "Pending Requests" section with count badge

**Given** I am an admin viewing a pending request
**When** I click "Approve"
**Then** a publisher account is created
**And** an approval email is sent to the requester
**And** the request status changes to "approved"

**Given** I am an admin viewing a pending request
**When** I click "Reject"
**Then** the request status changes to "rejected"
**And** a rejection email is sent (optional)

#### Technical Notes

```sql
CREATE TABLE publisher_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization TEXT,
    email TEXT NOT NULL,
    website TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by TEXT, -- admin clerk_user_id
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publisher_requests_status ON publisher_requests(status);
```

- New page: `web/app/become-publisher/page.tsx`
- New API endpoints:
  - `POST /api/publisher-requests` - submit request (public)
  - `GET /api/admin/publisher-requests` - list pending (admin)
  - `POST /api/admin/publisher-requests/{id}/approve` - approve (admin)
  - `POST /api/admin/publisher-requests/{id}/reject` - reject (admin)

#### New FRs

- **FR55**: User can submit publisher registration request
- **FR56**: Admin can view pending publisher requests
- **FR57**: Admin can approve/reject publisher requests

---

### Story 2.10: Publisher Member Invitation

**As a** publisher,
**I want** to invite team members to help manage my publisher account,
**So that** I can delegate algorithm and coverage management.

#### Acceptance Criteria

**Given** I am logged in as a publisher
**When** I navigate to `/publisher/team`
**Then** I see a list of current team members with their email and role

**Given** I am viewing my team page
**When** I click "Invite Member"
**Then** I see a form with email address field

**Given** I enter a valid email and submit
**When** the invitation is created
**Then** an invitation email is sent via Resend
**And** the invitation is stored with status "pending"
**And** I see the pending invitation in my team list

**Given** an invitee clicks the invitation link
**When** they sign up or sign in
**Then** they are added to my publisher's access list
**And** the invitation status changes to "accepted"

**Given** I am viewing my team
**When** I click "Remove" on a team member
**Then** they are removed from my publisher's access list
**And** (they keep their Clerk account, just lose publisher access)

#### Technical Notes

```sql
CREATE TABLE publisher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL, -- for magic link
    status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired
    invited_by TEXT NOT NULL, -- clerk_user_id
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publisher_invitations_token ON publisher_invitations(token);
CREATE INDEX idx_publisher_invitations_publisher ON publisher_invitations(publisher_id);
```

- New page: `web/app/publisher/team/page.tsx`
- New page: `web/app/accept-publisher-invite/page.tsx`
- New API endpoints:
  - `GET /api/publisher/team` - list team members
  - `POST /api/publisher/team/invite` - send invitation
  - `DELETE /api/publisher/team/{userId}` - remove member
  - `POST /api/publisher/team/accept` - accept invitation (with token)

#### New FRs

- **FR58**: Publisher can view team members
- **FR59**: Publisher can invite new team members via email
- **FR60**: Publisher can remove team members

---

### Story 2.11: Email Service Integration (Resend)

**As the** system,
**I want** to send transactional emails via Resend,
**So that** users receive branded invitations and notifications.

#### Acceptance Criteria

**Given** the email service is configured
**When** an invitation is sent
**Then** the email is delivered via Resend with Shtetl Zmanim branding

**Given** a publisher request is approved
**When** the approval is processed
**Then** a welcome email is sent to the new publisher

**Given** a user requests password reset
**When** the request is submitted
**Then** a password reset email is sent via Resend (not Clerk)

**Given** the Resend API is unavailable
**When** an email send fails
**Then** the error is logged
**And** the operation continues (email is non-blocking)

#### Technical Notes

- New service: `api/internal/services/email_service.go`
- Use Resend Go SDK or REST API

**Resend Dashboard Templates to Create:**

Create these templates in Resend Dashboard (https://resend.com/emails) with Shtetl Zmanim branding:

| Template ID | Name | Purpose | Variables |
|-------------|------|---------|-----------|
| `publisher-invitation` | Publisher Invitation | Invite user to join a publisher team | `{{inviter_name}}`, `{{publisher_name}}`, `{{accept_url}}` |
| `publisher-approved` | Publisher Approved | Welcome new publisher after admin approval | `{{publisher_name}}`, `{{dashboard_url}}` |
| `publisher-rejected` | Publisher Rejected | Notify rejected publisher request | `{{publisher_name}}`, `{{reason}}` (optional) |
| `password-reset` | Password Reset | Password reset link | `{{reset_url}}`, `{{expires_in}}` |
| `welcome` | Welcome | Welcome new user | `{{user_name}}` |

**Template Design Guidelines:**
- Use Midnight Trust color scheme (#1e3a5f primary)
- Include Shtetl Zmanim logo header
- Simple, clean layout (no heavy graphics)
- Mobile-responsive
- Unsubscribe link in footer (for compliance)

**Local Email Templates (fallback):**
- Store HTML templates in `api/internal/templates/email/`
- Use Go's `html/template` package for variable substitution
- Templates: `invitation.html`, `publisher-approved.html`, `password-reset.html`

- Environment variables (already configured):
  - `RESEND_API_KEY`
  - `RESEND_DOMAIN`
  - `RESEND_FROM`
- Configure Clerk to disable its email sending (use custom SMTP or webhooks)

```go
// api/internal/services/email_service.go
type EmailService struct {
    apiKey string
    from   string
    domain string
}

type EmailTemplate string

const (
    TemplatePublisherInvitation EmailTemplate = "publisher-invitation"
    TemplatePublisherApproved   EmailTemplate = "publisher-approved"
    TemplatePublisherRejected   EmailTemplate = "publisher-rejected"
    TemplatePasswordReset       EmailTemplate = "password-reset"
    TemplateWelcome             EmailTemplate = "welcome"
)

func (s *EmailService) SendWithTemplate(to string, template EmailTemplate, data map[string]string) error
func (s *EmailService) SendInvitation(to, inviterName, publisherName, acceptURL string) error
func (s *EmailService) SendPublisherApproved(to, publisherName, dashboardURL string) error
func (s *EmailService) SendPasswordReset(to, resetURL string) error
```

#### New FRs

- **FR61**: System sends transactional emails via Resend
- **FR62**: Emails use Shtetl Zmanim branding
- **FR66**: Email templates created in Resend dashboard

---

### Story 2.12: User Profile Dropdown

**As a** logged-in user,
**I want** to see my profile information in a dropdown menu,
**So that** I can view my account details and sign out.

#### Acceptance Criteria

**Given** I am logged in
**When** I view any page
**Then** I see a profile icon/avatar in the top-right header

**Given** I click the profile icon
**When** the dropdown opens
**Then** I see:
  - My display name
  - My email address
  - My role (admin/publisher/user)
  - List of publishers I have access to (if any)
  - "Change Password" link
  - "Sign Out" button

**Given** I have access to multiple publishers
**When** I view the dropdown
**Then** I see all publisher names listed

**Given** I click "Change Password"
**When** the action is triggered
**Then** I receive a password reset email via Resend

**Given** I click "Sign Out"
**When** I confirm
**Then** I am logged out and redirected to home page

**Given** I am not logged in
**When** I view the header
**Then** I see "Sign In" button instead of profile dropdown

#### Technical Notes

- New component: `web/components/shared/ProfileDropdown.tsx`
- Update layout: `web/app/layout.tsx` or header component
- Use shadcn/ui DropdownMenu component
- Get user data from Clerk `useUser()` hook
- Extract from `publicMetadata`:
  - `role`
  - `publisher_access_list`
- Fetch publisher names from API for display
- "Change Password" triggers API call → sends Resend email

#### New FRs

- **FR63**: User can view profile info in header dropdown
- **FR64**: User can sign out from dropdown
- **FR65**: User can request password reset from dropdown

---

## 5. Implementation Handoff

### Scope Classification

**Minor** - Direct implementation by development team

### Story Sequence

```
2.11 Email Service (Resend)  ← Foundation, implement first
 └── 2.9 Publisher Registration Request
 └── 2.10 Publisher Member Invitation
 └── 2.12 User Profile Dropdown
```

Story 2.11 should be implemented first as other stories depend on email capability.

### Deliverables

1. **Database migrations** for `publisher_requests` and `publisher_invitations` tables
2. **Go email service** with Resend integration
3. **API endpoints** for registration, invitations, profile actions
4. **Frontend pages**: `/become-publisher`, `/publisher/team`, `/accept-publisher-invite`
5. **Profile dropdown component** in header

### Success Criteria

- [ ] Users can submit publisher registration requests
- [ ] Admins can approve/reject requests with email notifications
- [ ] Publishers can invite team members via email
- [ ] Profile dropdown shows user info and publisher list
- [ ] All emails sent via Resend with proper branding
- [ ] Password reset works through Resend (not Clerk email)

---

## 6. FR Summary

| FR | Description | Story |
|----|-------------|-------|
| FR55 | User can submit publisher registration request | 2.9 |
| FR56 | Admin can view pending publisher requests | 2.9 |
| FR57 | Admin can approve/reject publisher requests | 2.9 |
| FR58 | Publisher can view team members | 2.10 |
| FR59 | Publisher can invite new team members via email | 2.10 |
| FR60 | Publisher can remove team members | 2.10 |
| FR61 | System sends transactional emails via Resend | 2.11 |
| FR62 | Emails use Shtetl Zmanim branding | 2.11 |
| FR63 | User can view profile info in header dropdown | 2.12 |
| FR64 | User can sign out from dropdown | 2.12 |
| FR65 | User can request password reset from dropdown | 2.12 |
| FR66 | Email templates created in Resend dashboard | 2.11 |

**Total New FRs:** 12 (FR55-FR66)

---

## Approval

- [x] User approves this Sprint Change Proposal (YOLO mode - 2025-11-26)
- [x] Stories added to Epic 2 document
- [x] Sprint status updated with new stories
- [x] Story files created in docs/sprint-artifacts/stories/

---

_Generated by Correct Course Workflow_
_Date: 2025-11-26_
