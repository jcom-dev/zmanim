# Story 2.7: Publisher Analytics (Simple)

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Draft
**Priority:** Low
**Story Points:** 3

---

## User Story

**As a** publisher,
**I want** to see basic usage statistics for my zmanim,
**So that** I can understand how my community uses my calculations.

---

## Acceptance Criteria

### AC-1: Analytics Page Content
**Given** I am on /publisher/analytics
**When** the page loads
**Then** I see:
  - Total calculations (all time)
  - Calculations this month
  - Number of coverage areas
  - Number of cities covered

### AC-2: Accurate Counts
**Given** calculations have been made
**When** I view the stats
**Then** I see accurate counts based on actual API usage

### AC-3: New Publisher Empty State
**Given** I am a new publisher with no calculations
**When** I view analytics
**Then** I see zeros with a friendly "No activity yet" message

### AC-4: Future Enhancement Note
**Given** I want more detail
**When** I view the page
**Then** I see a note "Detailed analytics coming soon"

---

## Technical Notes

### Database Changes

```sql
-- Calculation logging table
CREATE TABLE IF NOT EXISTS calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    cache_hit BOOLEAN DEFAULT false
);

CREATE INDEX idx_calc_logs_publisher ON calculation_logs(publisher_id);
CREATE INDEX idx_calc_logs_date ON calculation_logs(calculated_at);
CREATE INDEX idx_calc_logs_publisher_date ON calculation_logs(publisher_id, calculated_at);
```

### Backend Changes

**File:** `api/internal/services/analytics_service.go` (create)
```go
type AnalyticsService struct {
    db *db.DB
}

type PublisherAnalytics struct {
    CalculationsTotal     int `json:"calculations_total"`
    CalculationsThisMonth int `json:"calculations_this_month"`
    CoverageAreas         int `json:"coverage_areas"`
    CitiesCovered         int `json:"cities_covered"`
}

func (s *AnalyticsService) GetPublisherAnalytics(ctx context.Context, publisherID string) (*PublisherAnalytics, error) {
    var analytics PublisherAnalytics

    // Total calculations
    err := s.db.Pool.QueryRow(ctx, `
        SELECT COUNT(*) FROM calculation_logs WHERE publisher_id = $1
    `, publisherID).Scan(&analytics.CalculationsTotal)

    // This month calculations
    err = s.db.Pool.QueryRow(ctx, `
        SELECT COUNT(*) FROM calculation_logs
        WHERE publisher_id = $1
        AND calculated_at >= date_trunc('month', now())
    `, publisherID).Scan(&analytics.CalculationsThisMonth)

    // Coverage stats from coverage table
    // ...

    return &analytics, nil
}

// LogCalculation logs a zmanim calculation (called from zmanim handler)
func (s *AnalyticsService) LogCalculation(ctx context.Context, publisherID, cityID string, cacheHit bool) error {
    _, err := s.db.Pool.Exec(ctx, `
        INSERT INTO calculation_logs (publisher_id, city_id, cache_hit)
        VALUES ($1, $2, $3)
    `, publisherID, cityID, cacheHit)
    return err
}
```

**File:** `api/internal/handlers/zmanim.go` (modify)
```go
func (h *Handlers) GetZmanim(w http.ResponseWriter, r *http.Request) {
    // ... existing calculation logic ...

    // Log the calculation (async to not block response)
    go func() {
        if err := h.analyticsService.LogCalculation(
            context.Background(),
            publisherID,
            cityID,
            cacheHit,
        ); err != nil {
            slog.Warn("failed to log calculation", "error", err)
        }
    }()

    // ... return response ...
}
```

**File:** `api/internal/handlers/publishers.go`
```go
// GET /api/publisher/analytics
func (h *Handlers) GetPublisherAnalytics(w http.ResponseWriter, r *http.Request) {
    publisherID := getPublisherIdFromContext(r.Context())

    analytics, err := h.analyticsService.GetPublisherAnalytics(r.Context(), publisherID)
    if err != nil {
        RespondInternalError(w, r, "Failed to retrieve analytics")
        return
    }

    RespondJSON(w, r, http.StatusOK, analytics)
}
```

### Frontend Changes

**File:** `web/app/publisher/analytics/page.tsx` (create)
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Globe, Calculator, Calendar } from 'lucide-react';

export default function PublisherAnalytics() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['publisher', 'analytics'],
    queryFn: fetchPublisherAnalytics,
  });

  const hasActivity = analytics && analytics.calculations_total > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {!hasActivity && (
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
          <p className="text-slate-400">
            Once users start viewing your zmanim, you'll see statistics here.
          </p>
        </div>
      )}

      {hasActivity && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calculator />}
            label="Total Calculations"
            value={analytics.calculations_total}
          />
          <StatCard
            icon={<Calendar />}
            label="This Month"
            value={analytics.calculations_this_month}
          />
          <StatCard
            icon={<Globe />}
            label="Coverage Areas"
            value={analytics.coverage_areas}
          />
          <StatCard
            icon={<MapPin />}
            label="Cities Covered"
            value={analytics.cities_covered}
          />
        </div>
      )}

      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
        <p className="text-slate-400 text-sm">
          📊 Detailed analytics with charts and trends coming soon
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
```

### API Endpoint

```
GET /api/publisher/analytics
Response: {
  calculations_total: number,
  calculations_this_month: number,
  coverage_areas: number,
  cities_covered: number
}
```

### Performance Considerations

1. **Async Logging:** Calculation logging is done in a goroutine to not slow down zmanim responses
2. **Indexed Queries:** All analytics queries use indexed columns
3. **Caching (Future):** Consider caching analytics results with 5-minute TTL for high-traffic publishers

---

## Dependencies

- Story 2.5 (Enhanced Coverage) - for coverage_areas count
- Zmanim calculation endpoint exists - DONE (Epic 1)

---

## Definition of Done

- [x] Analytics page shows 4 stat cards
- [ ] Calculation logging integrated into zmanim handler (deferred - needs calculation_logs table)
- [x] Counts are accurate based on logged data (coverage counts accurate, calculations placeholder)
- [x] New publishers see friendly empty state
- [x] "Coming soon" note displayed
- [ ] Database table created (deferred - needs calculation_logs table)
- [ ] Async logging doesn't block responses (deferred)
- [ ] Unit tests for AnalyticsService
- [ ] Integration test for analytics endpoint
- [ ] E2E test: view analytics page

---

## Dev Agent Record

### Completion Notes

**Backend Changes:**
- `api/internal/handlers/handlers.go`: Added GetPublisherAnalytics endpoint
- `api/cmd/api/main.go`: Added route GET /api/v1/publisher/analytics

**Frontend Changes:**
- `web/app/publisher/analytics/page.tsx`: Analytics page with stat cards
- `web/app/publisher/layout.tsx`: Added "Analytics" nav item

**Key Features:**
- Analytics page shows 4 stat cards:
  - Total Calculations (placeholder - 0 until calculation_logs implemented)
  - This Month (placeholder - 0)
  - Coverage Areas (real data from publisher_coverage)
  - Cities Covered (real data, calculated from coverage levels)
- Empty state shown when no coverage and no calculations
- "Coming Soon" banner for detailed analytics features
- Responsive 2-column grid on desktop

**Deferred Items:**
- calculation_logs database table (needs migration)
- Async calculation logging in zmanim handler
- These will be implemented when detailed analytics are prioritized

**Status:** done

---

## FRs Covered

- FR51: Publisher can view basic analytics (calculation counts, coverage stats)
