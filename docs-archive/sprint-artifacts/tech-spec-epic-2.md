# Epic Technical Specification: Publisher User Management & Dashboard

Date: 2025-11-26
Author: BMad
Epic ID: 2
Status: Draft

---

## Overview

Epic 2 transforms the Shtetl Zmanim platform from entity-only publisher management to full user lifecycle integration. This epic enables admins to invite real users to manage publishers via Clerk authentication, supports users managing multiple publishers with a dashboard switcher, provides admin impersonation for support, and builds a comprehensive publisher dashboard with analytics and activity logging.

This builds directly on Epic 1's foundation (Clerk auth, publisher CRUD, coverage management) and leverages existing infrastructure including the Go backend with Chi router, Next.js frontend with Clerk React components, and PostgreSQL database.

## Objectives and Scope

### In Scope

- **User-Publisher Linking:** Clerk invitation system with `publisher_access_list` metadata
- **Multi-Publisher Support:** Dashboard switcher for users managing multiple publishers
- **Admin Impersonation:** Full edit capabilities when acting as a publisher
- **Role-Based Navigation:** Dynamic home page buttons based on user metadata
- **Enhanced Coverage:** Country/region/city hierarchy with multi-location management
- **Publisher Dashboard Hub:** Central view with profile, algorithm, coverage, analytics
- **Simple Analytics:** Calculation counts and coverage statistics
- **Activity Logging:** Track all publisher account changes with actor attribution

### Out of Scope

- User self-registration for publishers (remains admin-only)
- Advanced analytics (charts, trends, time-series)
- Publisher notifications system
- Mobile app specific features
- Multi-language support

## System Architecture Alignment

### Components Affected

| Component | Changes | Reference |
|-----------|---------|-----------|
| `api/internal/handlers/admin.go` | Add user invitation, impersonation endpoints | Existing file |
| `api/internal/services/clerk_service.go` | Enhance invitation with publisher_access_list | Existing file |
| `api/internal/middleware/auth.go` | Add impersonation context handling | Existing file |
| `web/app/page.tsx` | Add role-based navigation buttons | Existing file |
| `web/app/publisher/` | Dashboard hub, switcher, enhanced coverage | Existing directory |
| `api/internal/services/activity_service.go` | New activity logging service | New file |

### Architecture Constraints

- User-publisher linking stored in Clerk metadata (not database) per Clerk best practices
- Impersonation uses session/cookie with backend validation
- Activity logs stored in PostgreSQL for queryability and retention
- Coverage hierarchy queries existing cities table structure

## Detailed Design

### Services and Modules

| Service | Responsibility | Inputs | Outputs |
|---------|---------------|--------|---------|
| `ClerkService` (enhanced) | User invitation with publisher_access_list | email, publisher_id(s) | invitation_id |
| `ActivityService` (new) | Log and query activity events | action_type, publisher_id, actor | activity_log entries |
| `AnalyticsService` (new) | Aggregate calculation stats | publisher_id, date_range | stats object |
| `ImpersonationMiddleware` (new) | Validate and inject impersonation context | session, admin role | publisher context |

### Data Models and Contracts

#### New Tables

```sql
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
    action_type TEXT NOT NULL,  -- 'profile_update', 'algorithm_save', 'algorithm_publish', 'coverage_add', 'coverage_remove', 'user_invited', 'user_removed'
    description TEXT NOT NULL,
    actor_id TEXT NOT NULL,      -- Clerk user ID
    actor_type TEXT NOT NULL,    -- 'publisher', 'admin', 'admin_impersonation'
    metadata JSONB,              -- Optional additional context
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_publisher ON activity_logs(publisher_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_action ON activity_logs(action_type);
```

#### Schema Modifications

```sql
-- Add coverage level tracking to existing publisher_coverage (or publisher_cities)
ALTER TABLE publisher_cities ADD COLUMN IF NOT EXISTS coverage_level TEXT NOT NULL DEFAULT 'city';
-- coverage_level: 'country', 'region', 'city'

ALTER TABLE publisher_cities ADD COLUMN IF NOT EXISTS geo_reference TEXT;
-- For country: country code (e.g., 'US')
-- For region: region identifier (e.g., 'US-NY')
-- For city: NULL (use city_id)

-- Add index for coverage queries
CREATE INDEX IF NOT EXISTS idx_publisher_cities_level ON publisher_cities(coverage_level);
```

#### Clerk Metadata Schema

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

### APIs and Interfaces

#### New Admin Endpoints

```
POST /api/admin/publishers/{id}/users/invite
  Request: { email: string }
  Response: { invitation_id: string, status: 'sent' }
  Errors: 400 (invalid email), 404 (publisher not found), 409 (already invited)

GET /api/admin/publishers/{id}/users
  Response: { users: [{ clerk_user_id, email, name, invited_at, accepted_at }] }
  Errors: 404 (publisher not found)

DELETE /api/admin/publishers/{id}/users/{userId}
  Response: { success: true }
  Errors: 404 (publisher/user not found), 400 (cannot remove last user)

POST /api/admin/impersonate/{publisherId}
  Response: { token: string, publisher: {...} }  -- Sets session cookie
  Errors: 404 (publisher not found), 403 (not admin)

POST /api/admin/impersonate/exit
  Response: { success: true }  -- Clears session cookie
  Errors: 400 (not impersonating)

GET /api/admin/publishers/{id}/activity
  Query: ?limit=50&offset=0
  Response: { activities: [...], total: number }
```

#### New/Updated Publisher Endpoints

```
GET /api/publisher/dashboard-summary
  Response: {
    profile: { name, organization, is_verified },
    algorithm: { status: 'draft'|'published', updated_at },
    coverage: { total_areas: number, total_cities: number },
    analytics: { calculations_this_month: number, calculations_total: number },
    recent_activity: [{ action_type, description, created_at }]
  }

GET /api/publisher/analytics
  Response: {
    calculations_total: number,
    calculations_this_month: number,
    coverage_areas: number,
    cities_covered: number
  }

GET /api/publisher/activity
  Query: ?limit=50&offset=0
  Response: { activities: [...], total: number }

GET /api/publisher/coverage  (enhanced)
  Response: {
    coverage: [{
      id, coverage_level, geo_reference, city_id,
      name, priority, is_active, created_at
    }]
  }

POST /api/publisher/coverage  (enhanced)
  Request: { level: 'country'|'region'|'city', geo_id: string, priority?: number }
  Response: { coverage: {...} }
  Errors: 400 (invalid level/geo_id), 409 (already covered)

DELETE /api/publisher/coverage/{id}
  Response: { success: true }
  Errors: 404 (coverage not found)
```

### Workflows and Sequencing

#### User Invitation Flow

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
            │
            └── User completes signup
                │
                └── Metadata transfers to user account
                    │
                    └── User can access /publisher routes
```

#### Multi-Publisher User Adding Second Publisher

```
Admin → POST /api/admin/publishers/{other_id}/users/invite
    │
    ├── Validate publisher exists
    ├── Check if user already exists in Clerk
    │
    └── If existing user:
        └── ClerkService.UpdateUserMetadata()
            │
            └── Append new publisher_id to publisher_access_list
    │
    └── If new user:
        └── Standard invitation flow
```

#### Impersonation Flow

```
Admin UI → Click "Impersonate Publisher"
    │
    └── POST /api/admin/impersonate/{publisherId}
        │
        ├── Validate admin role
        ├── Validate publisher exists
        ├── Set session: { impersonating_publisher_id: publisherId }
        │
        └── Return success + redirect to /publisher
            │
            └── Frontend shows impersonation banner
                │
                ├── All /api/publisher/* calls include X-Impersonating-Publisher header
                │
                └── Activity logs record actor_type: 'admin_impersonation'

Exit:
    └── POST /api/admin/impersonate/exit
        │
        └── Clear session, redirect to /admin
```

## Non-Functional Requirements

### Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Dashboard summary load | <500ms | Aggregate query with indexes |
| Activity log query | <200ms | Paginated, indexed by publisher_id |
| Calculation logging | <10ms overhead | Async insert, non-blocking |
| Coverage hierarchy load | <300ms | Cached country/region lists |

### Security

- **Invitation Security:** Clerk handles invitation tokens; no custom token generation
- **Impersonation Audit:** All impersonation sessions logged with admin user ID
- **Metadata Isolation:** Publisher access validated on every request via middleware
- **Activity Log Integrity:** Activity logs are append-only, no delete API exposed
- **Role Escalation Prevention:** Admin role checked server-side, not client metadata

### Reliability/Availability

- **Graceful Degradation:** If Clerk API fails, user invitation shows retry option
- **Activity Log Async:** Calculation logging failures don't block zmanim responses
- **Cache Fallback:** Dashboard stats cached 5 minutes, stale data acceptable on cache miss

### Observability

| Signal | Implementation |
|--------|----------------|
| Invitation sent | `slog.Info("invitation_sent", "publisher_id", id, "email", email)` |
| Impersonation start/end | `slog.Info("impersonation_started/ended", "admin_id", admin, "publisher_id", pub)` |
| Activity logged | `slog.Debug("activity_logged", "action", type, "publisher_id", id)` |
| Analytics query | `slog.Info("analytics_queried", "publisher_id", id, "duration_ms", dur)` |

## Dependencies and Integrations

### Go Backend (api/go.mod)

```go
require (
    github.com/clerk/clerk-sdk-go/v2 v2.5.0  // Existing - invitation APIs
    github.com/go-chi/chi/v5 v5.0.11         // Existing - router
    github.com/jackc/pgx/v5 v5.5.1           // Existing - database
)
```

No new Go dependencies required.

### Frontend (web/package.json)

```json
{
  "@clerk/nextjs": "^6.35.5",     // Existing - useUser(), metadata access
  "@tanstack/react-query": "^5.x" // Existing - data fetching
}
```

No new frontend dependencies required.

### Clerk Integration Points

- `clerkClient.invitations.createInvitation()` - User invitation
- `clerkClient.users.updateUserMetadata()` - Add publisher to existing user
- `useUser()` hook - Access publicMetadata in frontend
- Webhook (optional future): `user.created` to sync with database

## Acceptance Criteria (Authoritative)

### Story 2.1: Publisher User Invitation

1. Admin can view list of users linked to a publisher at /admin/publishers/{id}
2. Admin can send invitation via email to new user
3. Invitation email contains correct redirect URL
4. New user signing up via invitation has publisher_access_list metadata set
5. Existing user invited to another publisher gets that ID appended to their list
6. Admin can remove user from publisher (removes from access list)

### Story 2.2: Multi-Publisher Switcher

7. Users with 2+ publishers see switcher dropdown in publisher dashboard header
8. Selecting different publisher switches all dashboard data context
9. Users with 1 publisher do not see switcher (or it's disabled)
10. Selected publisher persists across page navigation

### Story 2.3: Admin Impersonation

11. Admin sees "Impersonate" button on publisher detail page
12. Clicking starts impersonation and redirects to /publisher
13. Impersonation banner visible with publisher name and "Exit" button
14. All edits during impersonation are saved to that publisher
15. Activity logs show "admin_impersonation" as actor_type
16. Exit returns to admin portal

### Story 2.4: Dynamic Home Navigation

17. Unauthenticated users see only location search
18. Regular users (no publisher access) see only location search
19. Users with publisher_access_list see "Publisher Dashboard" button
20. Admin users see "Admin Portal" button
21. Admin with publisher access sees both buttons

### Story 2.5: Enhanced Coverage Management

22. Publisher can add coverage at country level (all cities in country)
23. Publisher can add coverage at region level (all cities in region)
24. Publisher can add coverage at city level (single city)
25. Publisher can delete any coverage area
26. Coverage list shows level indicator (country/region/city)
27. Map visualization shows covered areas

### Story 2.6: Publisher Dashboard Hub

28. Dashboard shows cards for: Profile, Algorithm, Coverage, Analytics
29. Each card shows summary status and click-navigates to detail
30. Algorithm card shows draft/published status
31. Coverage card shows count of areas
32. Recent activity shows last 5 changes

### Story 2.7: Publisher Analytics

33. Analytics page shows total calculations (all time)
34. Analytics page shows calculations this month
35. Analytics page shows coverage area count
36. New publishers see zeros with friendly message

### Story 2.8: Publisher Activity Log

37. Activity page shows chronological list of changes
38. Each entry shows: timestamp, action type, description, actor
39. Profile updates logged
40. Algorithm saves and publishes logged
41. Coverage additions and removals logged
42. Admin impersonation changes show "Admin (Support)" as actor

## Traceability Mapping

| AC# | Spec Section | Component(s) | Test Approach |
|-----|--------------|--------------|---------------|
| 1-6 | APIs - Admin Endpoints | `admin.go`, `clerk_service.go` | Integration test: create publisher, invite user, verify metadata |
| 7-10 | Workflows - Multi-Publisher | `PublisherSwitcher.tsx`, `PublisherContext` | E2E: login multi-pub user, verify switcher, switch, verify data |
| 11-16 | Workflows - Impersonation | `auth.go`, `ImpersonationBanner.tsx` | E2E: admin login, impersonate, edit, verify activity log |
| 17-21 | Frontend - Home Page | `page.tsx`, `RoleNavigation.tsx` | E2E: test each role scenario, verify buttons |
| 22-27 | APIs - Coverage | `coverage.go`, `CoverageManager.tsx` | Integration: add country/region/city, verify queries |
| 28-32 | APIs - Dashboard | `handlers.go`, `DashboardHub.tsx` | Integration: verify summary endpoint returns all sections |
| 33-36 | Data Models - calculation_logs | `analytics_service.go` | Unit: verify count queries, edge cases |
| 37-42 | Data Models - activity_logs | `activity_service.go` | Integration: perform actions, query log, verify entries |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Clerk metadata sync issues | Low | Medium | Validate metadata on each request; don't cache |
| Activity log table growth | Medium | Low | Add retention policy (90 days); archive old logs |
| Impersonation abuse | Low | High | Audit all impersonation; require MFA for admins |

### Assumptions

- Clerk invitation API supports publicMetadata pass-through (confirmed in docs)
- Clerk user metadata is immediately available after signup (no propagation delay)
- Existing `publisher_cities` table can be extended without migration issues
- Frontend can read Clerk publicMetadata via `useUser()` hook

### Open Questions

1. **Q:** Should we notify the original publisher users when an admin impersonates?
   **A:** Defer to post-MVP - add notification system later

2. **Q:** Retention policy for activity logs?
   **A:** Keep 90 days initially, configurable via system_config

3. **Q:** Should calculation logging be opt-in per publisher?
   **A:** No, always log for all publishers (needed for platform analytics)

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Target |
|-------|-----------|-----------------|
| Unit (Go) | `go test` + testify | Services: 80%+ |
| Unit (TS) | Vitest | Hooks, utils: 80%+ |
| Integration | `go test` + test DB | All new API endpoints |
| E2E | Playwright | Critical flows: invitation, impersonation, dashboard |

### Critical Test Scenarios

1. **Invitation Happy Path:** Admin invites user → user signs up → user has access
2. **Multi-Publisher User:** User with 2 publishers can switch between them
3. **Impersonation Full Cycle:** Admin starts → edits → activity logged → exits
4. **Coverage Hierarchy:** Add country → verify all cities covered
5. **Activity Log Completeness:** Perform all loggable actions → verify all logged

### Edge Cases

- Invite user who already exists in Clerk (should append, not create)
- Remove last user from publisher (should warn/prevent)
- Impersonate while already impersonating (should switch, not nest)
- Dashboard summary for publisher with no data (graceful empty state)

---

_Generated by BMAD Epic Tech Context Workflow_
_Date: 2025-11-26_
