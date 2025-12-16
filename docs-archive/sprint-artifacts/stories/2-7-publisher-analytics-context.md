# Story Context: 2.7 Publisher Analytics (Simple)

**Generated:** 2025-11-26
**Story:** Publisher Analytics (Simple)
**Epic:** Epic 2 - Publisher User Management & Dashboard

---

## Relevant Documentation

### From Tech Spec (docs/sprint-artifacts/tech-spec-epic-2.md)

**FR51:** Publisher can view basic analytics (calculation counts, coverage stats)

**Database Table:**
```sql
CREATE TABLE calculation_logs (
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

**Performance Target:**
- Calculation logging: <10ms overhead (async insert, non-blocking)

---

## Existing Code References

### Backend - Zmanim Handler

**File:** `api/internal/handlers/zmanim.go`

This is where calculation logging will be integrated. The handler processes zmanim calculation requests and needs to log each calculation asynchronously.

### Backend - Admin Stats

**File:** `api/internal/handlers/admin.go` (lines 267-313)

Existing stats pattern:
```go
func (h *Handlers) AdminGetStats(w http.ResponseWriter, r *http.Request) {
    // Get publisher counts
    // ...

    // Get calculation count (from cache or logs - for now returning placeholder)
    totalCalculations := 0
    // TODO: Implement calculation tracking in Task 5

    // Get cache hit ratio (placeholder)
    cacheHitRatio := 0.0
    // TODO: Implement cache stats retrieval in Task 5

    // ...
}
```

This shows the existing placeholder for calculation stats that needs to be implemented.

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Zmanim calculation endpoint | ✅ Done | `api/internal/handlers/zmanim.go` |
| Story 2.5 (Coverage) | Required | For coverage_areas count |
| Database connection | ✅ Done | pgx configured |

---

## Implementation Details

### Analytics Service

**File to create:** `api/internal/services/analytics_service.go`

```go
package services

import (
    "context"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsService struct {
    pool *pgxpool.Pool
}

func NewAnalyticsService(pool *pgxpool.Pool) *AnalyticsService {
    return &AnalyticsService{pool: pool}
}

type PublisherAnalytics struct {
    CalculationsTotal     int64 `json:"calculations_total"`
    CalculationsThisMonth int64 `json:"calculations_this_month"`
    CoverageAreas         int   `json:"coverage_areas"`
    CitiesCovered         int   `json:"cities_covered"`
}

// GetPublisherAnalytics returns analytics for a publisher
func (s *AnalyticsService) GetPublisherAnalytics(ctx context.Context, publisherID string) (*PublisherAnalytics, error) {
    analytics := &PublisherAnalytics{}

    // Total calculations
    err := s.pool.QueryRow(ctx, `
        SELECT COALESCE(COUNT(*), 0)
        FROM calculation_logs
        WHERE publisher_id = $1
    `, publisherID).Scan(&analytics.CalculationsTotal)
    if err != nil {
        return nil, err
    }

    // This month calculations
    err = s.pool.QueryRow(ctx, `
        SELECT COALESCE(COUNT(*), 0)
        FROM calculation_logs
        WHERE publisher_id = $1
        AND calculated_at >= date_trunc('month', CURRENT_TIMESTAMP)
    `, publisherID).Scan(&analytics.CalculationsThisMonth)
    if err != nil {
        return nil, err
    }

    // Coverage areas count
    err = s.pool.QueryRow(ctx, `
        SELECT COALESCE(COUNT(*), 0)
        FROM publisher_cities
        WHERE publisher_id = $1 AND is_active = true
    `, publisherID).Scan(&analytics.CoverageAreas)
    if err != nil {
        return nil, err
    }

    // Cities covered (may include calculated cities for country/region coverage)
    err = s.pool.QueryRow(ctx, `
        SELECT COALESCE(COUNT(DISTINCT city_id), 0)
        FROM publisher_cities
        WHERE publisher_id = $1 AND is_active = true AND city_id IS NOT NULL
    `, publisherID).Scan(&analytics.CitiesCovered)
    if err != nil {
        return nil, err
    }

    return analytics, nil
}

// LogCalculation logs a zmanim calculation (async-safe)
func (s *AnalyticsService) LogCalculation(ctx context.Context, publisherID, cityID string, cacheHit bool) error {
    _, err := s.pool.Exec(ctx, `
        INSERT INTO calculation_logs (publisher_id, city_id, cache_hit)
        VALUES ($1, $2, $3)
    `, publisherID, cityID, cacheHit)
    return err
}

// LogCalculationAsync logs a calculation without blocking
func (s *AnalyticsService) LogCalculationAsync(publisherID, cityID string, cacheHit bool) {
    go func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        if err := s.LogCalculation(ctx, publisherID, cityID, cacheHit); err != nil {
            // Log error but don't fail
            slog.Warn("failed to log calculation",
                "error", err,
                "publisher_id", publisherID,
                "city_id", cityID,
            )
        }
    }()
}
```

### Integration into Zmanim Handler

**File:** `api/internal/handlers/zmanim.go` (modify)

```go
func (h *Handlers) GetZmanim(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Parse request params
    cityID := r.URL.Query().Get("cityId")
    publisherID := r.URL.Query().Get("publisherId")
    dateStr := r.URL.Query().Get("date")

    // ... existing validation ...

    // Check cache first
    cacheKey := fmt.Sprintf("zmanim:%s:%s:%s", publisherID, cityID, dateStr)
    cached, cacheHit := h.cacheService.Get(ctx, cacheKey)

    var result *ZmanimResult
    if cacheHit {
        result = cached
    } else {
        // Calculate zmanim
        result, err = h.zmanimService.Calculate(ctx, cityID, publisherID, date)
        if err != nil {
            RespondInternalError(w, r, "Failed to calculate zmanim")
            return
        }

        // Cache result
        h.cacheService.Set(ctx, cacheKey, result, 24*time.Hour)
    }

    // Log calculation asynchronously (doesn't block response)
    h.analyticsService.LogCalculationAsync(publisherID, cityID, cacheHit)

    RespondJSON(w, r, http.StatusOK, result)
}
```

### Database Migration

**File to create:** `db/migrations/XXXXXX_create_calculation_logs.sql`

```sql
-- Create calculation logs table for analytics
CREATE TABLE IF NOT EXISTS calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    cache_hit BOOLEAN DEFAULT false
);

-- Indexes for efficient queries
CREATE INDEX idx_calc_logs_publisher ON calculation_logs(publisher_id);
CREATE INDEX idx_calc_logs_date ON calculation_logs(calculated_at);
CREATE INDEX idx_calc_logs_publisher_date ON calculation_logs(publisher_id, calculated_at);

-- Comment
COMMENT ON TABLE calculation_logs IS 'Tracks zmanim calculations for publisher analytics';
```

### Analytics Handler

**File:** `api/internal/handlers/publishers.go` (add)

```go
// GET /api/publisher/analytics
func (h *Handlers) GetPublisherAnalytics(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    publisherID := getPublisherIDFromContext(ctx)

    analytics, err := h.analyticsService.GetPublisherAnalytics(ctx, publisherID)
    if err != nil {
        slog.Error("failed to get analytics", "error", err, "publisher_id", publisherID)
        RespondInternalError(w, r, "Failed to retrieve analytics")
        return
    }

    RespondJSON(w, r, http.StatusOK, analytics)
}
```

---

## Frontend Implementation

### Analytics Page

**File to create:** `web/app/publisher/analytics/page.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calculator, Calendar, Globe, MapPin, BarChart3
} from 'lucide-react';

interface Analytics {
  calculations_total: number;
  calculations_this_month: number;
  coverage_areas: number;
  cities_covered: number;
}

async function fetchAnalytics(publisherId: string): Promise<Analytics> {
  const res = await fetch(`/api/publisher/analytics?publisherId=${publisherId}`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

export default function PublisherAnalytics() {
  const { selectedPublisherId } = usePublisherContext();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['publisher', 'analytics', selectedPublisherId],
    queryFn: () => fetchAnalytics(selectedPublisherId!),
    enabled: !!selectedPublisherId,
  });

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  const hasActivity = analytics && analytics.calculations_total > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {!hasActivity ? (
        <Card className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
          <p className="text-slate-400">
            Once users start viewing your zmanim, you'll see statistics here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calculator className="w-5 h-5" />}
            label="Total Calculations"
            value={analytics.calculations_total}
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="This Month"
            value={analytics.calculations_this_month}
          />
          <StatCard
            icon={<Globe className="w-5 h-5" />}
            label="Coverage Areas"
            value={analytics.coverage_areas}
          />
          <StatCard
            icon={<MapPin className="w-5 h-5" />}
            label="Cities Covered"
            value={analytics.cities_covered}
          />
        </div>
      )}

      <Card className="p-4 text-center bg-slate-800/50">
        <p className="text-slate-400 text-sm">
          📊 Detailed analytics with charts and trends coming soon
        </p>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
```

---

## API Endpoint

### GET /api/publisher/analytics

**Response:**
```json
{
  "calculations_total": 5678,
  "calculations_this_month": 1234,
  "coverage_areas": 3,
  "cities_covered": 45
}
```

**Response (new publisher):**
```json
{
  "calculations_total": 0,
  "calculations_this_month": 0,
  "coverage_areas": 0,
  "cities_covered": 0
}
```

---

## Implementation Checklist

### Database Tasks
- [ ] Create migration for calculation_logs table
- [ ] Run migration
- [ ] Verify indexes created

### Backend Tasks
- [ ] Create `AnalyticsService`
- [ ] Add `LogCalculationAsync` method
- [ ] Integrate logging into zmanim handler
- [ ] Create `GetPublisherAnalytics` handler
- [ ] Add route: GET /api/publisher/analytics
- [ ] Wire up service in dependency injection

### Frontend Tasks
- [ ] Create analytics page
- [ ] Create StatCard component
- [ ] Add loading skeleton
- [ ] Handle empty state

### Testing
- [ ] Unit test: AnalyticsService queries
- [ ] Integration test: Calculation logging
- [ ] Integration test: Analytics endpoint
- [ ] E2E test: View analytics page
- [ ] Performance test: Verify async logging doesn't block
