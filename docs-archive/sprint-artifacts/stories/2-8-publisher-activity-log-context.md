# Story Context: 2.8 Publisher Activity Log

**Generated:** 2025-11-26
**Story:** Publisher Activity Log
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**FRs Covered:**
- FR52: Publisher can view activity log of changes
- FR53: Activity log tracks algorithm, coverage, and profile changes
- FR54: Admin can view any publisher's activity log

**Database Table:**
```sql
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
CREATE INDEX idx_activity_action ON activity_logs(action_type);
```

**Action Types:**
- `profile_update` - Profile changes
- `algorithm_save` - Algorithm saved as draft
- `algorithm_publish` - Algorithm published
- `coverage_add` - Coverage area added
- `coverage_remove` - Coverage area removed
- `user_invited` - User invited to publisher
- `user_removed` - User removed from publisher

**Actor Types:**
- `publisher` - Regular publisher user
- `admin` - Admin user directly
- `admin_impersonation` - Admin impersonating publisher

---

## Existing Code References

### Backend - Handlers to Integrate

**File:** `api/internal/handlers/publishers.go`
- Profile update handler - needs activity logging

**File:** `api/internal/handlers/publisher_algorithm.go`
- Algorithm save/publish handlers - need activity logging

**File:** `api/internal/handlers/coverage.go`
- Coverage add/remove handlers - need activity logging

**File:** `api/internal/handlers/admin.go`
- User invitation handler (Story 2.1) - needs activity logging

### Backend - Auth Middleware

**File:** `api/internal/middleware/auth.go`

Helper functions to use:
```go
func GetUserID(ctx context.Context) string { ... }
func GetUserRole(ctx context.Context) string { ... }
```

Will also need (from Story 2.3):
```go
func IsImpersonating(ctx context.Context) bool { ... }
func GetImpersonatingAdminID(ctx context.Context) string { ... }
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Story 2.3 (Impersonation) | Soft | For actor_type attribution |
| Story 2.5 (Coverage) | Soft | For coverage change logging |
| Auth middleware | ✅ Done | User context available |

---

## Implementation Details

### Activity Service

**File to create:** `api/internal/services/activity_service.go`

```go
package services

import (
    "context"
    "encoding/json"
    "log/slog"

    "github.com/jackc/pgx/v5/pgxpool"
)

// Action types
const (
    ActionProfileUpdate    = "profile_update"
    ActionAlgorithmSave    = "algorithm_save"
    ActionAlgorithmPublish = "algorithm_publish"
    ActionCoverageAdd      = "coverage_add"
    ActionCoverageRemove   = "coverage_remove"
    ActionUserInvited      = "user_invited"
    ActionUserRemoved      = "user_removed"
)

// Actor types
const (
    ActorPublisher          = "publisher"
    ActorAdmin              = "admin"
    ActorAdminImpersonation = "admin_impersonation"
)

type ActivityService struct {
    pool *pgxpool.Pool
}

func NewActivityService(pool *pgxpool.Pool) *ActivityService {
    return &ActivityService{pool: pool}
}

type ActivityEntry struct {
    ID          string                 `json:"id"`
    PublisherID string                 `json:"publisher_id"`
    ActionType  string                 `json:"action_type"`
    Description string                 `json:"description"`
    ActorID     string                 `json:"actor_id"`
    ActorType   string                 `json:"actor_type"`
    Metadata    map[string]interface{} `json:"metadata,omitempty"`
    CreatedAt   string                 `json:"created_at"`
}

type LogActivityParams struct {
    PublisherID string
    ActionType  string
    Description string
    ActorID     string
    ActorType   string
    Metadata    map[string]interface{}
}

// LogActivity records an activity
func (s *ActivityService) LogActivity(ctx context.Context, params LogActivityParams) error {
    var metadataJSON []byte
    var err error

    if params.Metadata != nil {
        metadataJSON, err = json.Marshal(params.Metadata)
        if err != nil {
            slog.Warn("failed to marshal activity metadata", "error", err)
            metadataJSON = nil
        }
    }

    _, err = s.pool.Exec(ctx, `
        INSERT INTO activity_logs (publisher_id, action_type, description, actor_id, actor_type, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, params.PublisherID, params.ActionType, params.Description,
       params.ActorID, params.ActorType, metadataJSON)

    if err != nil {
        slog.Error("failed to log activity",
            "error", err,
            "publisher_id", params.PublisherID,
            "action_type", params.ActionType,
        )
        return err
    }

    slog.Debug("activity logged",
        "publisher_id", params.PublisherID,
        "action_type", params.ActionType,
        "actor_type", params.ActorType,
    )

    return nil
}

// GetActivities returns activities for a publisher with pagination
func (s *ActivityService) GetActivities(ctx context.Context, publisherID string, limit, offset int) ([]ActivityEntry, int, error) {
    // Get total count
    var total int
    err := s.pool.QueryRow(ctx, `
        SELECT COUNT(*) FROM activity_logs WHERE publisher_id = $1
    `, publisherID).Scan(&total)
    if err != nil {
        return nil, 0, err
    }

    // Get activities
    rows, err := s.pool.Query(ctx, `
        SELECT id, publisher_id, action_type, description, actor_id, actor_type, metadata, created_at
        FROM activity_logs
        WHERE publisher_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `, publisherID, limit, offset)
    if err != nil {
        return nil, 0, err
    }
    defer rows.Close()

    var activities []ActivityEntry
    for rows.Next() {
        var a ActivityEntry
        var metadata []byte
        var createdAt time.Time

        err := rows.Scan(&a.ID, &a.PublisherID, &a.ActionType, &a.Description,
            &a.ActorID, &a.ActorType, &metadata, &createdAt)
        if err != nil {
            continue
        }

        if metadata != nil {
            json.Unmarshal(metadata, &a.Metadata)
        }
        a.CreatedAt = createdAt.Format(time.RFC3339)

        activities = append(activities, a)
    }

    return activities, total, nil
}

// GetRecentActivities returns the most recent activities (for dashboard)
func (s *ActivityService) GetRecentActivities(ctx context.Context, publisherID string, limit int) ([]ActivityEntry, error) {
    activities, _, err := s.GetActivities(ctx, publisherID, limit, 0)
    return activities, err
}
```

### Helper to Determine Actor Type

**File:** `api/internal/handlers/helpers.go` (or add to existing)

```go
package handlers

import (
    "context"

    "github.com/jcom-dev/zmanim/api/internal/middleware"
    "github.com/jcom-dev/zmanim/api/internal/services"
)

// getActorInfo returns actor_id and actor_type based on context
func getActorInfo(ctx context.Context) (actorID, actorType string) {
    if middleware.IsImpersonating(ctx) {
        return middleware.GetImpersonatingAdminID(ctx), services.ActorAdminImpersonation
    }

    userID := middleware.GetUserID(ctx)
    role := middleware.GetUserRole(ctx)

    if role == "admin" {
        return userID, services.ActorAdmin
    }
    return userID, services.ActorPublisher
}
```

### Integration Example - Profile Update

**File:** `api/internal/handlers/publishers.go` (modify)

```go
func (h *Handlers) UpdatePublisherProfile(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := getPublisherIDFromContext(ctx)

    // ... existing update logic ...

    // After successful update, log activity
    actorID, actorType := getActorInfo(ctx)
    h.activityService.LogActivity(ctx, services.LogActivityParams{
        PublisherID: publisherID,
        ActionType:  services.ActionProfileUpdate,
        Description: "Profile updated",
        ActorID:     actorID,
        ActorType:   actorType,
        Metadata: map[string]interface{}{
            "fields_updated": []string{"name", "organization"}, // track what changed
        },
    })

    RespondJSON(w, r, http.StatusOK, profile)
}
```

### Activity Handlers

**File:** `api/internal/handlers/activity.go` (create)

```go
package handlers

import (
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"
)

// GET /api/publisher/activity
func (h *Handlers) GetPublisherActivity(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := getPublisherIDFromContext(ctx)

    limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
    offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

    if limit <= 0 || limit > 100 {
        limit = 50
    }

    activities, total, err := h.activityService.GetActivities(ctx, publisherID, limit, offset)
    if err != nil {
        RespondInternalError(w, r, "Failed to retrieve activity log")
        return
    }

    var nextOffset *int
    if offset+len(activities) < total {
        next := offset + limit
        nextOffset = &next
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "activities":  activities,
        "total":       total,
        "next_offset": nextOffset,
    })
}

// GET /api/admin/publishers/{id}/activity
func (h *Handlers) AdminGetPublisherActivity(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := chi.URLParam(r, "id")

    limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
    offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

    if limit <= 0 || limit > 100 {
        limit = 50
    }

    activities, total, err := h.activityService.GetActivities(ctx, publisherID, limit, offset)
    if err != nil {
        RespondInternalError(w, r, "Failed to retrieve activity log")
        return
    }

    var nextOffset *int
    if offset+len(activities) < total {
        next := offset + limit
        nextOffset = &next
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "activities":  activities,
        "total":       total,
        "next_offset": nextOffset,
    })
}
```

---

## Frontend Implementation

### Activity Page

**File to create:** `web/app/publisher/activity/page.tsx`

```typescript
'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import {
  User, Calculator, Globe, UserPlus, UserMinus,
  Activity, Loader2
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  action_type: string;
  description: string;
  actor_type: string;
  created_at: string;
}

interface ActivityPage {
  activities: ActivityEntry[];
  total: number;
  next_offset: number | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  profile_update: <User className="w-4 h-4" />,
  algorithm_save: <Calculator className="w-4 h-4" />,
  algorithm_publish: <Calculator className="w-4 h-4" />,
  coverage_add: <Globe className="w-4 h-4" />,
  coverage_remove: <Globe className="w-4 h-4" />,
  user_invited: <UserPlus className="w-4 h-4" />,
  user_removed: <UserMinus className="w-4 h-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  profile_update: 'bg-blue-500/20 text-blue-400',
  algorithm_save: 'bg-yellow-500/20 text-yellow-400',
  algorithm_publish: 'bg-green-500/20 text-green-400',
  coverage_add: 'bg-emerald-500/20 text-emerald-400',
  coverage_remove: 'bg-red-500/20 text-red-400',
  user_invited: 'bg-purple-500/20 text-purple-400',
  user_removed: 'bg-orange-500/20 text-orange-400',
};

async function fetchActivity(publisherId: string, offset: number): Promise<ActivityPage> {
  const res = await fetch(
    `/api/publisher/activity?publisherId=${publisherId}&limit=20&offset=${offset}`
  );
  if (!res.ok) throw new Error('Failed to fetch activity');
  return res.json();
}

export default function PublisherActivity() {
  const { selectedPublisherId } = usePublisherContext();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['publisher', 'activity', selectedPublisherId],
    queryFn: ({ pageParam = 0 }) => fetchActivity(selectedPublisherId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.next_offset,
    enabled: !!selectedPublisherId,
  });

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  if (isLoading) {
    return <ActivitySkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <span className="text-sm text-slate-400">
          {data?.pages[0]?.total || 0} total entries
        </span>
      </div>

      {activities.length === 0 ? (
        <Card className="p-8 text-center">
          <Activity className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
          <p className="text-slate-400">
            Changes to your profile, algorithm, and coverage will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityEntry }) {
  const isAdminAction = activity.actor_type === 'admin_impersonation';
  const colorClass = ACTION_COLORS[activity.action_type] || 'bg-slate-500/20 text-slate-400';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {ACTION_ICONS[activity.action_type] || <Activity className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium">{activity.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500">
              {formatDistanceToNow(new Date(activity.created_at))} ago
            </span>
            {isAdminAction && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                Admin (Support)
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
```

---

## Database Migration

**File to create:** `db/migrations/XXXXXX_create_activity_logs.sql`

```sql
-- Create activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_activity_publisher ON activity_logs(publisher_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_action ON activity_logs(action_type);

-- Comments
COMMENT ON TABLE activity_logs IS 'Audit log of all publisher account changes';
COMMENT ON COLUMN activity_logs.action_type IS 'profile_update, algorithm_save, algorithm_publish, coverage_add, coverage_remove, user_invited, user_removed';
COMMENT ON COLUMN activity_logs.actor_type IS 'publisher, admin, admin_impersonation';
```

---

## API Endpoints

### GET /api/publisher/activity

**Query Parameters:**
- `limit` (optional, default 50, max 100)
- `offset` (optional, default 0)

**Response:**
```json
{
  "activities": [
    {
      "id": "uuid",
      "action_type": "algorithm_publish",
      "description": "Algorithm published",
      "actor_type": "publisher",
      "created_at": "2025-11-25T10:30:00Z"
    }
  ],
  "total": 25,
  "next_offset": 20
}
```

### GET /api/admin/publishers/{id}/activity

Same response format as above, but accessible by admins for any publisher.

---

## Implementation Checklist

### Database Tasks
- [ ] Create migration for activity_logs table
- [ ] Run migration
- [ ] Verify indexes created

### Backend Tasks
- [ ] Create `ActivityService`
- [ ] Add `LogActivity` method
- [ ] Add `GetActivities` method
- [ ] Create `getActorInfo` helper
- [ ] Integrate logging into profile handler
- [ ] Integrate logging into algorithm handlers
- [ ] Integrate logging into coverage handlers
- [ ] Create `GetPublisherActivity` handler
- [ ] Create `AdminGetPublisherActivity` handler
- [ ] Add routes

### Frontend Tasks
- [ ] Create activity page with infinite scroll
- [ ] Create `ActivityRow` component
- [ ] Add color coding by action type
- [ ] Handle empty state
- [ ] Add loading skeleton

### Testing
- [ ] Unit test: ActivityService methods
- [ ] Integration test: Perform actions, verify logged
- [ ] Integration test: Activity pagination
- [ ] E2E test: View activity log
- [ ] E2E test: Impersonation shows correct actor_type
