# Story Context: 2.6 Publisher Dashboard Hub

**Generated:** 2025-11-26
**Story:** Publisher Dashboard Hub
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**FR50:** Publisher dashboard hub displays all sections

**Dashboard Summary API Response:**
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

### From Architecture (docs/architecture.md)

**Project Structure:**
```
web/app/publisher/
├── dashboard/        # Current dashboard page
├── algorithm/        # Algorithm editor
├── coverage/         # Coverage management
└── profile/          # Publisher profile
```

---

## Existing Code References

### Frontend - Current Publisher Dashboard

**File:** `web/app/publisher/dashboard/page.tsx`
- Currently exists but may need refactoring to become the hub

### Frontend - Publisher Pages

**File:** `web/app/publisher/algorithm/page.tsx`
- Algorithm editor - will be linked from hub

**File:** `web/app/publisher/profile/page.tsx`
- Profile page - will be linked from hub

### Frontend - Existing Components

Available shadcn/ui components:
- Card, CardHeader, CardContent, CardFooter
- Button
- Badge
- Skeleton (for loading states)

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 2.2 (Publisher Switcher) | Required | For header integration |
| Story 2.5 (Enhanced Coverage) | Required | For coverage stats |
| Story 2.7 (Analytics) | Required | For calculation counts |
| Story 2.8 (Activity Log) | Required | For recent activity |

---

## Component Specifications

### DashboardCard Component

**File to create:** `web/components/publisher/DashboardCard.tsx`

```typescript
'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  href: string;
  icon: ReactNode;
  children: ReactNode;
  status?: 'verified' | 'pending' | 'draft' | 'published';
  warning?: boolean;
  emptyState?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DashboardCard({
  title,
  href,
  icon,
  children,
  status,
  warning,
  emptyState,
  emptyMessage,
  className,
}: DashboardCardProps) {
  return (
    <Link href={href}>
      <Card className={cn(
        "hover:bg-slate-800/50 transition-colors cursor-pointer h-full",
        warning && "border-yellow-500/50",
        className
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-700 rounded-lg">
              {icon}
            </div>
            <h3 className="font-semibold">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {warning && (
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            )}
            {status && (
              <Badge variant={status === 'verified' || status === 'published' ? 'default' : 'secondary'}>
                {status}
              </Badge>
            )}
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </CardHeader>
        <CardContent>
          {emptyState ? (
            <p className="text-sm text-slate-400">{emptyMessage}</p>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

### ActivityPreview Component

**File to create:** `web/components/publisher/ActivityPreview.tsx`

```typescript
'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  User, Calculator, Globe, ChevronRight,
  Activity
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
  actor_type: string;
}

interface ActivityPreviewProps {
  activities: ActivityEntry[];
  limit?: number;
}

const ACTION_ICONS: Record<string, ReactNode> = {
  profile_update: <User className="w-4 h-4" />,
  algorithm_save: <Calculator className="w-4 h-4" />,
  algorithm_publish: <Calculator className="w-4 h-4" />,
  coverage_add: <Globe className="w-4 h-4" />,
  coverage_remove: <Globe className="w-4 h-4" />,
};

export function ActivityPreview({ activities, limit = 5 }: ActivityPreviewProps) {
  const displayActivities = activities?.slice(0, limit) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h3 className="font-semibold">Recent Activity</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/publisher/activity">
            View all
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {displayActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="p-1.5 bg-slate-700 rounded">
                  {ACTION_ICONS[activity.action_type] || <Activity className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(activity.created_at))} ago
                    {activity.actor_type === 'admin_impersonation' && (
                      <span className="ml-2 text-yellow-500">• Admin</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Publisher Dashboard Hub Page

**File:** `web/app/publisher/page.tsx` (refactor)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { DashboardCard } from '@/components/publisher/DashboardCard';
import { ActivityPreview } from '@/components/publisher/ActivityPreview';
import { PublisherSwitcher } from '@/components/publisher/PublisherSwitcher';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, Calculator, Globe, BarChart3
} from 'lucide-react';

async function fetchDashboardSummary(publisherId: string) {
  const res = await fetch(`/api/publisher/dashboard-summary?publisherId=${publisherId}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
  return res.json();
}

export default function PublisherDashboard() {
  const { selectedPublisherId } = usePublisherContext();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['publisher', 'dashboard-summary', selectedPublisherId],
    queryFn: () => fetchDashboardSummary(selectedPublisherId!),
    enabled: !!selectedPublisherId,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Publisher Dashboard</h1>
        <PublisherSwitcher />
      </div>

      {/* Main Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <DashboardCard
          title="Profile"
          href="/publisher/profile"
          icon={<User className="w-5 h-5" />}
          status={summary?.profile.is_verified ? 'verified' : 'pending'}
        >
          <p className="font-medium">{summary?.profile.name}</p>
          <p className="text-sm text-slate-400">{summary?.profile.organization}</p>
        </DashboardCard>

        {/* Algorithm Card */}
        <DashboardCard
          title="Algorithm"
          href="/publisher/algorithm"
          icon={<Calculator className="w-5 h-5" />}
          status={summary?.algorithm.status}
          warning={summary?.algorithm.status === 'draft'}
        >
          <p className="font-medium">{summary?.algorithm.name || 'No algorithm'}</p>
          {summary?.algorithm.updated_at && (
            <p className="text-sm text-slate-400">
              Updated {formatDistanceToNow(new Date(summary.algorithm.updated_at))} ago
            </p>
          )}
        </DashboardCard>

        {/* Coverage Card */}
        <DashboardCard
          title="Coverage"
          href="/publisher/coverage"
          icon={<Globe className="w-5 h-5" />}
          emptyState={summary?.coverage.total_areas === 0}
          emptyMessage="Add your first coverage area"
        >
          <p className="text-2xl font-bold">{summary?.coverage.total_areas}</p>
          <p className="text-sm text-slate-400">
            coverage areas • {summary?.coverage.total_cities} cities
          </p>
        </DashboardCard>

        {/* Analytics Card */}
        <DashboardCard
          title="Analytics"
          href="/publisher/analytics"
          icon={<BarChart3 className="w-5 h-5" />}
        >
          <p className="text-2xl font-bold">
            {summary?.analytics.calculations_this_month?.toLocaleString() || 0}
          </p>
          <p className="text-sm text-slate-400">calculations this month</p>
        </DashboardCard>
      </div>

      {/* Activity Preview */}
      <ActivityPreview activities={summary?.recent_activity || []} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
```

---

## API Endpoint

### GET /api/publisher/dashboard-summary

**Backend Implementation:**

```go
func (h *Handlers) GetPublisherDashboardSummary(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := getPublisherIDFromContext(ctx)

    // Use goroutines for parallel fetching
    var wg sync.WaitGroup
    var mu sync.Mutex
    var errs []error

    summary := make(map[string]interface{})

    // Fetch profile
    wg.Add(1)
    go func() {
        defer wg.Done()
        profile, err := h.publisherService.GetPublisherProfile(ctx, publisherID)
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            summary["profile"] = map[string]interface{}{
                "name":        profile.Name,
                "organization": profile.Organization,
                "is_verified": profile.Status == "verified",
            }
        }
        mu.Unlock()
    }()

    // Fetch algorithm status
    wg.Add(1)
    go func() {
        defer wg.Done()
        algo, err := h.algorithmService.GetActiveAlgorithm(ctx, publisherID)
        mu.Lock()
        if err != nil && err != ErrNotFound {
            errs = append(errs, err)
        } else if algo != nil {
            summary["algorithm"] = map[string]interface{}{
                "status":     algo.Status,
                "name":       algo.Name,
                "updated_at": algo.UpdatedAt,
            }
        } else {
            summary["algorithm"] = map[string]interface{}{
                "status": "none",
            }
        }
        mu.Unlock()
    }()

    // Fetch coverage stats
    wg.Add(1)
    go func() {
        defer wg.Done()
        stats, err := h.coverageService.GetCoverageStats(ctx, publisherID)
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            summary["coverage"] = stats
        }
        mu.Unlock()
    }()

    // Fetch analytics
    wg.Add(1)
    go func() {
        defer wg.Done()
        analytics, err := h.analyticsService.GetPublisherAnalytics(ctx, publisherID)
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            summary["analytics"] = analytics
        }
        mu.Unlock()
    }()

    // Fetch recent activity
    wg.Add(1)
    go func() {
        defer wg.Done()
        activities, _, err := h.activityService.GetActivities(ctx, publisherID, 5, 0)
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            summary["recent_activity"] = activities
        }
        mu.Unlock()
    }()

    wg.Wait()

    if len(errs) > 0 {
        slog.Error("dashboard summary errors", "errors", errs)
    }

    RespondJSON(w, r, http.StatusOK, summary)
}
```

---

## Implementation Checklist

### Backend Tasks
- [ ] Create `GetPublisherDashboardSummary` handler
- [ ] Add `GetCoverageStats` to coverage service
- [ ] Ensure analytics and activity services are ready
- [ ] Add route: GET /api/publisher/dashboard-summary

### Frontend Tasks
- [ ] Create `DashboardCard` component
- [ ] Create `ActivityPreview` component
- [ ] Refactor `/publisher/page.tsx` to dashboard hub
- [ ] Add loading skeleton
- [ ] Ensure responsive layout

### Testing
- [ ] Unit test: DashboardCard component
- [ ] Integration test: Dashboard summary endpoint
- [ ] E2E test: Navigate to each section from dashboard
