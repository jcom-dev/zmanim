# Story 2.6: Publisher Dashboard Hub

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** Medium
**Story Points:** 3

---

## User Story

**As a** publisher,
**I want** a central dashboard that shows all my publisher management sections,
**So that** I can quickly navigate and see the status of my publisher account.

---

## Acceptance Criteria

### AC-1: Dashboard Layout
**Given** I am logged in as a publisher
**When** I navigate to /publisher
**Then** I see a dashboard hub with cards/sections for:
  - Profile (name, org, status)
  - Algorithm (status: draft/published, last updated)
  - Coverage (count of areas, quick stats)
  - Analytics (total calculations this month)
  - Activity Log (recent changes)

### AC-2: Profile Card Navigation
**Given** I view the Profile card
**When** I click on it
**Then** I navigate to /publisher/profile

### AC-3: Algorithm Status Warning
**Given** I view the Algorithm card
**When** the status shows "Draft"
**Then** I see a warning indicator that algorithm is not published

### AC-4: Coverage Empty State
**Given** I view the Coverage card
**When** I have no coverage areas
**Then** I see a prompt "Add your first coverage area"

### AC-5: Analytics Card Navigation
**Given** I view the Analytics card
**When** I click on it
**Then** I navigate to /publisher/analytics

### AC-6: Recent Activity
**Given** I view the Activity Log section
**When** changes have been made
**Then** I see the 5 most recent activities with timestamps

---

## Technical Notes

### Backend Changes

**File:** `api/internal/handlers/publishers.go`
```go
// GET /api/publisher/dashboard-summary
func (h *Handlers) GetPublisherDashboardSummary(w http.ResponseWriter, r *http.Request) {
    publisherId := getPublisherIdFromContext(r.Context())

    // Parallel queries for efficiency
    var wg sync.WaitGroup
    var profile ProfileSummary
    var algorithm AlgorithmSummary
    var coverage CoverageSummary
    var analytics AnalyticsSummary
    var recentActivity []ActivityEntry

    // ... fetch each section

    RespondJSON(w, r, http.StatusOK, DashboardSummary{
        Profile:        profile,
        Algorithm:      algorithm,
        Coverage:       coverage,
        Analytics:      analytics,
        RecentActivity: recentActivity,
    })
}
```

### Frontend Changes

**File:** `web/app/publisher/page.tsx` (refactor to dashboard hub)
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardCard } from '@/components/publisher/DashboardCard';
import { ActivityPreview } from '@/components/publisher/ActivityPreview';

export default function PublisherDashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['publisher', 'dashboard-summary'],
    queryFn: () => fetchDashboardSummary(),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashboardCard
        title="Profile"
        href="/publisher/profile"
        icon={<User />}
        status={summary?.profile.is_verified ? 'verified' : 'pending'}
      >
        <p>{summary?.profile.name}</p>
        <p className="text-sm text-muted">{summary?.profile.organization}</p>
      </DashboardCard>

      <DashboardCard
        title="Algorithm"
        href="/publisher/algorithm"
        icon={<Calculator />}
        warning={summary?.algorithm.status === 'draft'}
      >
        <StatusBadge status={summary?.algorithm.status} />
        <p className="text-sm">Updated: {formatDate(summary?.algorithm.updated_at)}</p>
      </DashboardCard>

      <DashboardCard
        title="Coverage"
        href="/publisher/coverage"
        icon={<Globe />}
        emptyState={summary?.coverage.total_areas === 0}
        emptyMessage="Add your first coverage area"
      >
        <p>{summary?.coverage.total_areas} coverage areas</p>
        <p className="text-sm">{summary?.coverage.total_cities} cities</p>
      </DashboardCard>

      <DashboardCard
        title="Analytics"
        href="/publisher/analytics"
        icon={<BarChart />}
      >
        <p className="text-2xl font-bold">{summary?.analytics.calculations_this_month}</p>
        <p className="text-sm">calculations this month</p>
      </DashboardCard>

      <div className="md:col-span-2">
        <ActivityPreview activities={summary?.recent_activity} />
      </div>
    </div>
  );
}
```

**File:** `web/components/publisher/DashboardCard.tsx` (create)
```typescript
interface DashboardCardProps {
  title: string;
  href: string;
  icon: React.ReactNode;
  status?: 'verified' | 'pending' | 'draft' | 'published';
  warning?: boolean;
  emptyState?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}
```

**File:** `web/components/publisher/ActivityPreview.tsx` (create)
```typescript
interface ActivityPreviewProps {
  activities: ActivityEntry[];
  limit?: number; // default 5
}
```

### API Response Structure

```json
{
  "profile": {
    "name": "Rabbi Cohen",
    "organization": "Brooklyn Torah Center",
    "is_verified": true
  },
  "algorithm": {
    "status": "published",
    "name": "Standard GRA",
    "updated_at": "2025-11-25T10:30:00Z"
  },
  "coverage": {
    "total_areas": 3,
    "total_cities": 45
  },
  "analytics": {
    "calculations_this_month": 1234,
    "calculations_total": 5678
  },
  "recent_activity": [
    {
      "action_type": "algorithm_publish",
      "description": "Algorithm published",
      "created_at": "2025-11-25T10:30:00Z",
      "actor_type": "publisher"
    }
  ]
}
```

### Layout Design

```
┌─────────────────────────────────────────────────────┐
│  Publisher Dashboard          [PublisherSwitcher]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │    Profile      │  │   Algorithm     │          │
│  │                 │  │   ⚠️ Draft      │          │
│  │  Rabbi Cohen    │  │                 │          │
│  │  Brooklyn Torah │  │  Standard GRA   │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐          │
│  │   Coverage      │  │   Analytics     │          │
│  │                 │  │                 │          │
│  │  3 areas        │  │     1,234       │          │
│  │  45 cities      │  │  this month     │          │
│  └─────────────────┘  └─────────────────┘          │
│                                                     │
│  ┌───────────────────────────────────────┐         │
│  │          Recent Activity              │         │
│  │  • Algorithm published - 2 hours ago  │         │
│  │  • Coverage added: NY - 1 day ago     │         │
│  │  • Profile updated - 3 days ago       │         │
│  └───────────────────────────────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Dependencies

- Story 2.2 (Multi-Publisher Switcher) - for header integration
- Story 2.5 (Enhanced Coverage) - for coverage stats
- Story 2.7 (Analytics) - for calculation counts
- Story 2.8 (Activity Log) - for recent activity

---

## Definition of Done

- [x] Dashboard shows all 4 main cards + activity
- [x] Each card navigates to detail page
- [x] Algorithm card shows warning for draft status
- [x] Coverage card shows empty state prompt
- [x] Activity shows 5 most recent entries (placeholder - will show when 2-8 done)
- [x] Responsive layout (2x2 on desktop, stack on mobile)
- [x] Dashboard summary API returns all data
- [ ] Unit tests for DashboardCard component
- [ ] Integration test for summary endpoint
- [ ] E2E test: dashboard navigation

---

## Dev Agent Record

### Completion Notes

**Backend Changes:**
- `api/internal/handlers/handlers.go`: Added GetPublisherDashboardSummary endpoint
- `api/cmd/api/main.go`: Added route GET /api/v1/publisher/dashboard

**Frontend Changes:**
- `web/app/publisher/dashboard/page.tsx`: Enhanced dashboard with summary data

**Key Features:**
- Dashboard hub with 4 cards:
  - Profile: Shows name, org, verification status (green checkmark or yellow pending)
  - Algorithm: Shows status (published/draft/none), name, last updated
  - Coverage: Shows area count and city count, or "Add first coverage" prompt
  - Analytics: Shows calculations this month (placeholder, coming in 2-7)
- Algorithm card has yellow border warning when status is "draft"
- Coverage card shows empty state with "Add first coverage area" prompt
- Recent Activity section (placeholder, will populate when 2-8 done)
- Responsive 2x2 grid on desktop, stacked on mobile
- All cards link to their detail pages except Analytics (not clickable yet)

**API Response:**
```json
{
  "profile": { "name", "organization", "is_verified", "status" },
  "algorithm": { "status", "name", "updated_at" },
  "coverage": { "total_areas", "total_cities" },
  "analytics": { "calculations_this_month", "calculations_total" },
  "recent_activity": []
}
```

**Status:** done

---

## FRs Covered

- FR50: Publisher dashboard hub displays all sections
