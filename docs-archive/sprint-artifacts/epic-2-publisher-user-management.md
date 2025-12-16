# Epic 2: Publisher User Management & Dashboard

**Author:** BMad
**Date:** 2025-11-26
**Status:** Draft
**Depends On:** Epic 1 (Shtetl Zmanim MVP) - COMPLETED

---

## Overview

Epic 2 transforms publisher management from entity-only to full user lifecycle. Admins can invite real users to manage publishers via Clerk, users can manage multiple publishers with a switcher, and admins can impersonate publishers for support. The publisher dashboard becomes a comprehensive hub with coverage management, algorithm status, analytics, and activity logging.

**Core Theme:** "Connect People to Publishers"

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories | 12 (8 original + 4 added via sprint change) |
| New FRs | 24 (FR43-FR66) |
| Enhanced FRs | FR1, FR16-FR20 |
| Primary Users | Admins, Publishers, Users |

---

## New Functional Requirements

| FR | Description | Story |
|----|-------------|-------|
| FR43 | Admin can invite users to a publisher via Clerk with metadata linking | 2.1 |
| FR44 | Invitation carries role and publisher_access_list in publicMetadata | 2.1 |
| FR45 | User can be linked to multiple publishers | 2.1 |
| FR46 | Publisher dashboard shows switcher for multi-publisher users | 2.2 |
| FR47 | Admin can impersonate any publisher with full edit capabilities | 2.3 |
| FR48 | Impersonation mode clearly indicated in UI | 2.3 |
| FR49 | Home page shows dynamic navigation based on user role | 2.4 |
| FR50 | Publisher dashboard hub displays all sections | 2.6 |
| FR51 | Publisher can view basic analytics (calculation counts, coverage stats) | 2.7 |
| FR52 | Publisher can view activity log of changes | 2.8 |
| FR53 | Activity log tracks algorithm, coverage, and profile changes | 2.8 |
| FR54 | Admin can view any publisher's activity log | 2.8 |
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

---

## Story Dependency Chain

```
2.1 Publisher User Invitation
 └── 2.2 Multi-Publisher Switcher
      └── 2.3 Admin Impersonation Mode
           └── 2.4 Dynamic Home Navigation
                └── 2.5 Enhanced Coverage Management
                     └── 2.6 Publisher Dashboard Hub
                          ├── 2.7 Publisher Analytics (Simple)
                          └── 2.8 Publisher Activity Log

Sprint Change Additions (2025-11-26):
2.11 Email Service (Resend)  ← Foundation for email features
 ├── 2.9 Publisher Registration Request
 ├── 2.10 Publisher Member Invitation
 └── 2.12 User Profile Dropdown
```

---

## Story 2.1: Publisher User Invitation

**As an** administrator,
**I want** to invite users to manage a publisher account via Clerk,
**So that** real people can access and configure their publisher's settings.

### Acceptance Criteria

**Given** I am logged in as an admin
**When** I navigate to /admin/publishers/{id}
**Then** I see a "Users" section with a list of users linked to this publisher

**Given** I am viewing a publisher's users section
**When** I click "Invite User"
**Then** I see a form with email address field

**Given** I enter a valid email and submit
**When** the invitation is created
**Then** Clerk sends an invitation email with redirect to /accept-invitation
**And** the invitation includes publicMetadata: `{ role: 'publisher', publisher_access_list: [publisher_id] }`

**Given** an invited user clicks the invitation link
**When** they complete Clerk signup
**Then** their account is created with the metadata from the invitation
**And** they can access /publisher dashboard

**Given** an existing user is invited to another publisher
**When** they accept the invitation
**Then** the new publisher_id is added to their publisher_access_list
**And** they can switch between publishers

**Given** I am viewing a publisher's users
**When** I click "Remove" on a user
**Then** that publisher_id is removed from their publisher_access_list
**And** if they have no publishers left, their role reverts to 'user'

### Prerequisites

Story 1.3 (Admin Publisher Management)

### Technical Notes

- Use Clerk Admin API: `clerkClient.invitations.createInvitation()`
- Invitation payload:
  ```typescript
  {
    emailAddress: 'user@example.com',
    redirectUrl: 'https://app.zmanim.com/accept-invitation',
    publicMetadata: {
      role: 'publisher',
      publisher_access_list: [publisher_uuid]
    }
  }
  ```
- Create `web/app/accept-invitation/page.tsx` - handles post-signup redirect
- For existing users, use `clerkClient.users.updateUserMetadata()` to append to publisher_access_list
- Create API endpoints:
  - `GET /api/admin/publishers/{id}/users` - list users for publisher
  - `POST /api/admin/publishers/{id}/users/invite` - send invitation
  - `DELETE /api/admin/publishers/{id}/users/{userId}` - remove user from publisher
- Database: No new tables needed - user-publisher linking is in Clerk metadata
- Update `web/app/admin/publishers/[id]/page.tsx` to show users section

### FRs

FR43, FR44, FR45

---

## Story 2.2: Multi-Publisher Switcher

**As a** user managing multiple publishers,
**I want** to switch between publishers in the dashboard,
**So that** I can manage each publisher's settings independently.

### Acceptance Criteria

**Given** I am logged in with publisher_access_list containing multiple publisher IDs
**When** I navigate to /publisher
**Then** I see a publisher switcher dropdown in the dashboard header

**Given** the publisher switcher is visible
**When** I click on it
**Then** I see a list of all publishers I have access to (name + organization)

**Given** I select a different publisher from the switcher
**When** the selection is applied
**Then** the entire dashboard context switches to that publisher
**And** coverage, algorithm, analytics all reflect the selected publisher

**Given** I am logged in with only one publisher in publisher_access_list
**When** I navigate to /publisher
**Then** the switcher is hidden (or shows as static text)

**Given** I select a publisher
**When** I navigate between dashboard sections
**Then** the selected publisher persists until I switch again

### Prerequisites

Story 2.1 (Publisher User Invitation)

### Technical Notes

- Create `web/components/publisher/PublisherSwitcher.tsx`
- Use shadcn/ui Select or Popover component
- Store selected publisher in:
  - URL param: `/publisher?p={publisher_id}` (allows direct linking)
  - Or localStorage with URL override
- Create React context: `PublisherContext` with `selectedPublisherId`
- Fetch publisher list from Clerk metadata on auth
- API needs to validate user has access to requested publisher_id
- Create `web/hooks/usePublisherContext.ts`

### FRs

FR46

---

## Story 2.3: Admin Impersonation Mode

**As an** administrator,
**I want** to view and edit any publisher's dashboard as if I were them,
**So that** I can provide support and troubleshoot issues.

### Acceptance Criteria

**Given** I am logged in as an admin
**When** I am on /admin/publishers/{id}
**Then** I see an "Impersonate Publisher" button

**Given** I click "Impersonate Publisher"
**When** impersonation mode activates
**Then** I am redirected to /publisher with that publisher selected
**And** a prominent banner shows "Impersonating: {Publisher Name} - Exit"

**Given** I am in impersonation mode
**When** I make changes (coverage, algorithm, profile)
**Then** the changes are saved to that publisher's data
**And** the activity log records "Changed by Admin (impersonating)"

**Given** I am in impersonation mode
**When** I click "Exit" in the impersonation banner
**Then** I am returned to /admin/publishers/{id}
**And** impersonation mode ends

**Given** I am not an admin
**When** I try to access impersonation mode via URL manipulation
**Then** I receive a 403 Forbidden error

### Prerequisites

Story 2.2 (Multi-Publisher Switcher)

### Technical Notes

- Impersonation state stored in session/cookie: `impersonating_publisher_id`
- Create `web/components/admin/ImpersonationBanner.tsx`
- Middleware checks:
  1. If user is admin AND impersonating_publisher_id is set → allow publisher routes
  2. Pass `impersonating: true` flag to API calls
- API endpoints accept optional `X-Impersonating-Publisher` header (admin only)
- Go middleware validates admin role before honoring impersonation header
- Activity log entries include `actor_type: 'admin_impersonation'` when applicable
- Create API endpoint: `POST /api/admin/impersonate/{publisherId}` - sets session
- Create API endpoint: `POST /api/admin/impersonate/exit` - clears session

### FRs

FR47, FR48

---

## Story 2.4: Dynamic Home Navigation

**As a** user,
**I want** to see relevant navigation options on the home page based on my role,
**So that** I can quickly access the areas I need.

### Acceptance Criteria

**Given** I am not logged in
**When** I view the home page
**Then** I see the location search and "Sign In" button
**And** no admin or publisher navigation

**Given** I am logged in as a regular user (no publisher_access_list, no admin role)
**When** I view the home page
**Then** I see the location search
**And** no admin or publisher buttons

**Given** I am logged in with publisher_access_list containing at least one publisher
**When** I view the home page
**Then** I see a "Publisher Dashboard" button
**And** clicking it navigates to /publisher

**Given** I am logged in as an admin
**When** I view the home page
**Then** I see an "Admin Portal" button
**And** clicking it navigates to /admin

**Given** I am logged in as an admin with publisher_access_list
**When** I view the home page
**Then** I see both "Admin Portal" and "Publisher Dashboard" buttons

### Prerequisites

Story 2.3 (Admin Impersonation Mode)

### Technical Notes

- Update `web/app/page.tsx` (home page)
- Use Clerk's `useUser()` hook to get publicMetadata
- Extract role and publisher_access_list from metadata
- Create `web/components/home/RoleNavigation.tsx`
- Button styling should be prominent but not overwhelming
- Consider card-based layout for role options
- Admin role check: `publicMetadata.role === 'admin'` OR check Clerk organization membership

### FRs

FR49

---

## Story 2.5: Enhanced Coverage Management

**As a** publisher,
**I want** to manage my geographic coverage with an intuitive multi-location interface,
**So that** I can precisely define where my zmanim are available.

### Acceptance Criteria

**Given** I am on /publisher/coverage
**When** the page loads
**Then** I see my current coverage areas listed with country/region/city breakdown
**And** I see a map visualization of my coverage

**Given** I want to add coverage
**When** I click "Add Coverage"
**Then** I see a hierarchical selector: Country → Region → City

**Given** I select a country (e.g., "United States")
**When** I choose to add at country level
**Then** all cities in that country are included in my coverage

**Given** I select a country and then a region (e.g., "New York")
**When** I choose to add at region level
**Then** all cities in that region are included in my coverage

**Given** I drill down to city level (e.g., "Brooklyn")
**When** I select the city
**Then** only that specific city is added to my coverage

**Given** I have multiple coverage areas
**When** I view the coverage list
**Then** each area shows: level (country/region/city), name, priority, active status

**Given** I want to remove coverage
**When** I click the delete icon on a coverage area
**Then** a confirmation dialog appears
**And** upon confirmation, the coverage is removed

**Given** I have overlapping coverage (e.g., "United States" + "Brooklyn")
**When** a user searches for Brooklyn
**Then** the more specific coverage (Brooklyn) takes priority

**Given** I modify coverage
**When** I save changes
**Then** the map updates to reflect new coverage areas

### Prerequisites

Story 2.4 (Dynamic Home Navigation), builds on Story 1.6

### Technical Notes

- Refactor `web/app/publisher/coverage/page.tsx` for better UX
- Create `web/components/publisher/CoverageManager.tsx` - main component
- Create `web/components/publisher/CoverageHierarchyPicker.tsx` - country/region/city selector
- Create `web/components/publisher/CoverageList.tsx` - list with actions
- Update database schema:
  ```sql
  -- Add coverage_level to track hierarchy
  ALTER TABLE publisher_coverage ADD COLUMN coverage_level TEXT NOT NULL DEFAULT 'city';
  -- coverage_level: 'country', 'region', 'city'

  -- Add geo_reference for non-city levels
  ALTER TABLE publisher_coverage ADD COLUMN geo_reference TEXT;
  -- For country: country code (e.g., 'US')
  -- For region: region identifier (e.g., 'US-NY')
  -- For city: NULL (use city_id)
  ```
- API endpoints:
  - `GET /api/publisher/coverage` - list with hierarchy info
  - `POST /api/publisher/coverage` - add coverage `{ level, geo_id_or_reference, priority }`
  - `PUT /api/publisher/coverage/{id}` - update priority/active
  - `DELETE /api/publisher/coverage/{id}` - remove
- Map component: Use Leaflet or Mapbox GL to highlight covered regions
- When querying publishers for a city, check: exact city match → region match → country match

### FRs

FR16, FR17, FR18, FR19, FR20 (enhanced from Epic 1)

---

## Story 2.6: Publisher Dashboard Hub

**As a** publisher,
**I want** a central dashboard that shows all my publisher management sections,
**So that** I can quickly navigate and see the status of my publisher account.

### Acceptance Criteria

**Given** I am logged in as a publisher
**When** I navigate to /publisher
**Then** I see a dashboard hub with cards/sections for:
  - Profile (name, org, status)
  - Algorithm (status: draft/published, last updated)
  - Coverage (count of areas, quick stats)
  - Analytics (total calculations this month)
  - Activity Log (recent changes)

**Given** I view the Profile card
**When** I click on it
**Then** I navigate to /publisher/profile

**Given** I view the Algorithm card
**When** the status shows "Draft"
**Then** I see a warning indicator that algorithm is not published

**Given** I view the Coverage card
**When** I have no coverage areas
**Then** I see a prompt "Add your first coverage area"

**Given** I view the Analytics card
**When** I click on it
**Then** I navigate to /publisher/analytics

**Given** I view the Activity Log section
**When** changes have been made
**Then** I see the 5 most recent activities with timestamps

### Prerequisites

Story 2.5 (Enhanced Coverage Management)

### Technical Notes

- Refactor `web/app/publisher/page.tsx` to be the dashboard hub (currently may redirect)
- Create `web/components/publisher/DashboardCard.tsx` - reusable card component
- Create layout: 2x2 grid on desktop, stack on mobile
- Fetch summary data via new API:
  - `GET /api/publisher/dashboard-summary` returns:
    ```json
    {
      "profile": { "name": "...", "is_verified": true },
      "algorithm": { "status": "published", "updated_at": "..." },
      "coverage": { "total_areas": 5, "total_cities": 120 },
      "analytics": { "calculations_this_month": 1234 },
      "recent_activity": [...]
    }
    ```
- Use TanStack Query to fetch and cache dashboard data
- Add quick action buttons on each card (Edit Profile, Edit Algorithm, etc.)

### FRs

FR50

---

## Story 2.7: Publisher Analytics (Simple)

**As a** publisher,
**I want** to see basic usage statistics for my zmanim,
**So that** I can understand how my community uses my calculations.

### Acceptance Criteria

**Given** I am on /publisher/analytics
**When** the page loads
**Then** I see:
  - Total calculations (all time)
  - Calculations this month
  - Number of coverage areas
  - Number of cities covered

**Given** calculations have been made
**When** I view the stats
**Then** I see accurate counts based on actual API usage

**Given** I am a new publisher with no calculations
**When** I view analytics
**Then** I see zeros with a friendly "No activity yet" message

**Given** I want more detail
**When** I view the page
**Then** I see a note "Detailed analytics coming soon"

### Prerequisites

Story 2.6 (Publisher Dashboard Hub)

### Technical Notes

- Create `web/app/publisher/analytics/page.tsx`
- Create `web/components/publisher/AnalyticsDisplay.tsx`
- Database: Add calculation tracking table
  ```sql
  CREATE TABLE calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id),
    city_id UUID REFERENCES cities(id),
    calculated_at TIMESTAMPTZ DEFAULT now(),
    cache_hit BOOLEAN DEFAULT false
  );

  CREATE INDEX idx_calc_logs_publisher ON calculation_logs(publisher_id);
  CREATE INDEX idx_calc_logs_date ON calculation_logs(calculated_at);
  ```
- Log calculations in `api/internal/services/zmanim_service.go`
- API endpoint: `GET /api/publisher/analytics`
- Aggregate queries:
  ```sql
  SELECT COUNT(*) FROM calculation_logs WHERE publisher_id = $1;
  SELECT COUNT(*) FROM calculation_logs
    WHERE publisher_id = $1
    AND calculated_at >= date_trunc('month', now());
  ```
- Consider async logging to not slow down calculation response

### FRs

FR51

---

## Story 2.8: Publisher Activity Log

**As a** publisher,
**I want** to see a log of changes made to my publisher account,
**So that** I can track what was modified and when.

### Acceptance Criteria

**Given** I am on /publisher/activity
**When** the page loads
**Then** I see a chronological list of activities

**Given** I view an activity entry
**When** I look at the details
**Then** I see: timestamp, action type, description, actor (me or admin)

**Given** I update my profile
**When** I save changes
**Then** an activity is logged: "Profile updated"

**Given** I modify my algorithm
**When** I save or publish
**Then** activities are logged: "Algorithm saved (draft)" or "Algorithm published"

**Given** I add or remove coverage
**When** the change is saved
**Then** an activity is logged: "Coverage added: Brooklyn, NY" or "Coverage removed: ..."

**Given** an admin makes changes while impersonating
**When** I view the activity log
**Then** I see "Changed by Admin (Support)" for those entries

**Given** I am an admin viewing a publisher's details
**When** I want to see their activity
**Then** I can access their full activity log

### Prerequisites

Story 2.6 (Publisher Dashboard Hub)

### Technical Notes

- Create `web/app/publisher/activity/page.tsx`
- Create `web/components/publisher/ActivityLog.tsx`
- Database:
  ```sql
  CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id),
    action_type TEXT NOT NULL,  -- 'profile_update', 'algorithm_save', 'algorithm_publish', 'coverage_add', 'coverage_remove'
    description TEXT NOT NULL,
    actor_id TEXT NOT NULL,      -- Clerk user ID
    actor_type TEXT NOT NULL,    -- 'publisher', 'admin', 'admin_impersonation'
    metadata JSONB,              -- Optional additional data
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX idx_activity_publisher ON activity_logs(publisher_id);
  CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
  ```
- Create Go service: `api/internal/services/activity_service.go`
  - `LogActivity(ctx, publisherId, actionType, description, actorId, actorType, metadata)`
- Integrate logging into existing handlers:
  - `publishers.go` - profile updates
  - Algorithm handlers - save/publish
  - Coverage handlers - add/remove
- API endpoints:
  - `GET /api/publisher/activity` - get own activity (paginated)
  - `GET /api/admin/publishers/{id}/activity` - admin view of publisher activity

### FRs

FR52, FR53, FR54

---

## Story 2.9: Publisher Registration Request

**As a** potential publisher,
**I want** to submit a registration request with my details,
**So that** I can become a publisher on Shtetl Zmanim after admin approval.

### Acceptance Criteria

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

**Given** I am an admin viewing `/admin/publishers`
**When** I look at the page
**Then** I see a "Pending Requests" section with count badge

**Given** I am an admin viewing a pending request
**When** I click "Approve"
**Then** a publisher account is created
**And** an approval email is sent via Resend
**And** the request status changes to "approved"

**Given** I am an admin viewing a pending request
**When** I click "Reject"
**Then** the request status changes to "rejected"
**And** a rejection email is sent via Resend

### Prerequisites

Story 2.11 (Email Service)

### Technical Notes

- New page: `web/app/become-publisher/page.tsx`
- Database: `publisher_requests` table
- API endpoints:
  - `POST /api/publisher-requests` - submit request (public)
  - `GET /api/admin/publisher-requests` - list pending (admin)
  - `POST /api/admin/publisher-requests/{id}/approve` - approve (admin)
  - `POST /api/admin/publisher-requests/{id}/reject` - reject (admin)

### FRs

FR55, FR56, FR57

---

## Story 2.10: Publisher Member Invitation

**As a** publisher,
**I want** to invite team members to help manage my publisher account,
**So that** I can delegate algorithm and coverage management.

### Acceptance Criteria

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

### Prerequisites

Story 2.11 (Email Service), Story 2.1 (Publisher User Invitation pattern)

### Technical Notes

- New page: `web/app/publisher/team/page.tsx`
- New page: `web/app/accept-publisher-invite/page.tsx`
- Database: `publisher_invitations` table
- API endpoints:
  - `GET /api/publisher/team` - list team members
  - `POST /api/publisher/team/invite` - send invitation
  - `DELETE /api/publisher/team/{userId}` - remove member
  - `POST /api/publisher/team/accept` - accept invitation (with token)

### FRs

FR58, FR59, FR60

---

## Story 2.11: Email Service Integration (Resend)

**As the** system,
**I want** to send transactional emails via Resend,
**So that** users receive branded invitations and notifications.

### Acceptance Criteria

**Given** the email service is configured
**When** an invitation is sent
**Then** the email is delivered via Resend with Shtetl Zmanim branding

**Given** a publisher request is approved
**When** the approval is processed
**Then** a welcome email is sent to the new publisher

**Given** a user requests password reset
**When** the request is submitted
**Then** a password reset email is sent via Resend

**Given** the Resend API is unavailable
**When** an email send fails
**Then** the error is logged
**And** the operation continues (email is non-blocking)

### Prerequisites

None (foundation story)

### Technical Notes

- New service: `api/internal/services/email_service.go`
- Use Resend REST API
- Create templates in Resend Dashboard:
  - `publisher-invitation` - Invite user to publisher team
  - `publisher-approved` - Welcome new publisher
  - `publisher-rejected` - Rejection notice
  - `password-reset` - Password reset link
  - `welcome` - Welcome new user
- Template design: Midnight Trust color scheme (#1e3a5f)
- Environment variables: `RESEND_API_KEY`, `RESEND_DOMAIN`, `RESEND_FROM`
- Fallback: Local HTML templates in `api/internal/templates/email/`

### FRs

FR61, FR62, FR66

---

## Story 2.12: User Profile Dropdown

**As a** logged-in user,
**I want** to see my profile information in a dropdown menu,
**So that** I can view my account details and sign out.

### Acceptance Criteria

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

### Prerequisites

Story 2.11 (Email Service for password reset)

### Technical Notes

- New component: `web/components/shared/ProfileDropdown.tsx`
- Update layout or header component
- Use shadcn/ui DropdownMenu
- Get user data from Clerk `useUser()` hook
- Extract `role` and `publisher_access_list` from `publicMetadata`
- Fetch publisher names from API for display

### FRs

FR63, FR64, FR65

---

## FR Coverage Matrix

| FR | Description | Story |
|----|-------------|-------|
| FR1 | Admin creates publisher accounts | 2.1 (enhanced with user invitation) |
| FR16 | Define coverage (country/region/city) | 2.5 (enhanced) |
| FR17 | View coverage on map | 2.5 (enhanced) |
| FR18 | Coverage priorities | 2.5 (enhanced) |
| FR19 | Name/describe coverage | 2.5 (enhanced) |
| FR20 | Activate/deactivate coverage | 2.5 (enhanced) |
| FR43 | Admin invites users to publishers | 2.1 |
| FR44 | Invitation carries metadata | 2.1 |
| FR45 | User linked to multiple publishers | 2.1 |
| FR46 | Publisher switcher for multi-publisher users | 2.2 |
| FR47 | Admin impersonation with edit capabilities | 2.3 |
| FR48 | Impersonation mode UI indicator | 2.3 |
| FR49 | Dynamic home navigation by role | 2.4 |
| FR50 | Publisher dashboard hub | 2.6 |
| FR51 | Publisher analytics (simple counts) | 2.7 |
| FR52 | Publisher activity log view | 2.8 |
| FR53 | Activity log tracks all changes | 2.8 |
| FR54 | Admin can view publisher activity | 2.8 |
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

---

## Database Schema Additions

```sql
-- Coverage level tracking (alter existing table)
ALTER TABLE publisher_coverage ADD COLUMN coverage_level TEXT NOT NULL DEFAULT 'city';
ALTER TABLE publisher_coverage ADD COLUMN geo_reference TEXT;

-- Calculation logging for analytics
CREATE TABLE calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    cache_hit BOOLEAN DEFAULT false
);

CREATE INDEX idx_calc_logs_publisher ON calculation_logs(publisher_id);
CREATE INDEX idx_calc_logs_date ON calculation_logs(calculated_at);

-- Activity logging
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_publisher ON activity_logs(publisher_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- Publisher registration requests (Story 2.9)
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

-- Publisher team invitations (Story 2.10)
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

---

## API Endpoints Summary

### New Admin Endpoints
```
GET    /api/admin/publishers/{id}/users          - List users for publisher
POST   /api/admin/publishers/{id}/users/invite   - Send invitation
DELETE /api/admin/publishers/{id}/users/{userId} - Remove user from publisher
POST   /api/admin/impersonate/{publisherId}      - Start impersonation
POST   /api/admin/impersonate/exit               - End impersonation
GET    /api/admin/publishers/{id}/activity       - View publisher activity
GET    /api/admin/publisher-requests             - List pending requests (2.9)
POST   /api/admin/publisher-requests/{id}/approve - Approve request (2.9)
POST   /api/admin/publisher-requests/{id}/reject  - Reject request (2.9)
```

### New/Updated Publisher Endpoints
```
GET    /api/publisher/dashboard-summary          - Hub summary data
GET    /api/publisher/coverage                   - List coverage (enhanced)
POST   /api/publisher/coverage                   - Add coverage (with level)
PUT    /api/publisher/coverage/{id}              - Update coverage
DELETE /api/publisher/coverage/{id}              - Remove coverage
GET    /api/publisher/analytics                  - Analytics data
GET    /api/publisher/activity                   - Activity log
GET    /api/publisher/team                       - List team members (2.10)
POST   /api/publisher/team/invite                - Send invitation (2.10)
DELETE /api/publisher/team/{userId}              - Remove team member (2.10)
POST   /api/publisher/team/accept                - Accept invitation (2.10)
```

### Public Endpoints
```
POST   /api/publisher-requests                   - Submit registration request (2.9)
```

### User Endpoints
```
POST   /api/user/request-password-reset          - Request password reset email (2.12)
```

---

## Summary

**Epic 2: Publisher User Management & Dashboard**
- **Stories:** 12 (8 original + 4 sprint change additions)
- **New FRs:** 24 (FR43-FR66)
- **Focus:** Connect real users to publishers, comprehensive dashboard, self-service onboarding

**After Epic 2 Completion:**
- Admins can invite users to publishers via Clerk
- Users can manage multiple publishers with a switcher
- Admins can impersonate publishers for support
- Home page shows role-appropriate navigation
- Publishers have a comprehensive dashboard hub
- Coverage management supports country/region/city hierarchy
- Basic analytics show usage counts
- Activity log tracks all changes
- **[NEW]** Potential publishers can request to join via self-service form
- **[NEW]** Publishers can invite their own team members
- **[NEW]** Transactional emails sent via Resend with branding
- **[NEW]** User profile dropdown shows account info and sign out

---

_Generated by BMAD Epic Workflow v1.0_
_Date: 2025-11-26_
