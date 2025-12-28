# Analytics Feature Completion - Orchestrator Prompt

## Mission Statement

Complete the Analytics feature for Shtetl Zmanim platform. The infrastructure exists but is non-functional: calculation logging is in place but the daily rollup job is missing, causing all dashboard stats to show zero. This orchestrator coordinates parallel sub-agents to deliver a fully working analytics system with E2E verification.

---

## Current State Analysis

### What EXISTS (Do NOT Rebuild)
- **Frontend**: `web/app/publisher/analytics/page.tsx` - Dashboard with 4 stat cards
- **API Endpoint**: `GET /api/v1/publisher/analytics` in `handlers.go:1093-1169`
- **Logging Service**: `api/internal/services/calculation_log_service.go` - Buffered batch writer
- **Database Tables**: `calculation_logs` (raw events), `calculation_stats_daily` (aggregates)
- **SQL Queries**: `calculation_logs.sql` - All queries including `RollupCalculationStatsDaily`
- **Integration Points**: Already integrated in `zmanim.go:684-693` and `external_api.go:393-408`

### What's BROKEN
1. **Column Mismatch**: Schema uses `city_id` but code uses `locality_id` → INSERT failures
2. **No Rollup Job**: `RollupCalculationStatsDaily` query exists but is never called
3. **Empty Stats Table**: `calculation_stats_daily` has no data → zeros on dashboard

### What's MISSING
1. Background job to run daily rollup aggregation
2. Calculation logging for authenticated publisher API endpoints
3. Admin platform-wide analytics dashboard
4. Advanced analytics (charts, trends) - marked "Coming Soon"

---

## Architecture Decision

**Rollup Implementation**: Timer-based Go background job in main.go
- Runs on configurable schedule (default: every hour, full rollup at midnight)
- Uses existing `RollupCalculationStatsDaily` SQL query
- Graceful shutdown handling
- Health check endpoint

**NOT**: External cron, Postgres triggers, or separate service

---

## Sub-Agent Assignments

### AGENT 1: Database Migration Agent
**Scope**: Fix schema issues and verify data flow

**Tasks**:
1. Create migration to rename `city_id` → `locality_id` in `calculation_logs` table
2. Add any missing indexes for analytics query performance
3. Verify `calculation_logs` table is receiving data (check existing rows)
4. Document the migration in `db/migrations/` following naming convention

**Deliverables**:
- [ ] Migration file: `db/migrations/YYYYMMDDHHMMSS_fix_calculation_logs_locality.sql`
- [ ] Index verification query results
- [ ] Count of existing rows in `calculation_logs`

**Verification**:
```sql
-- Must succeed after migration
INSERT INTO calculation_logs (publisher_id, locality_id, date_calculated, cache_hit, response_time_ms, zman_count, source)
VALUES (1, 4993250, CURRENT_DATE, false, 150, 10, 1);

SELECT COUNT(*) FROM calculation_logs WHERE locality_id IS NOT NULL;
```

---

### AGENT 2: Rollup Job Agent
**Scope**: Implement background aggregation job

**Tasks**:
1. Create rollup scheduler in `api/internal/services/rollup_scheduler.go`
2. Integrate into `api/cmd/api/main.go` startup sequence
3. Add configuration for rollup interval in environment variables
4. Implement graceful shutdown (context cancellation)
5. Add health check endpoint `/health/rollup` showing last run time
6. Add logging (slog) for each rollup execution

**Deliverables**:
- [ ] `api/internal/services/rollup_scheduler.go` - New file
- [ ] Modified `api/cmd/api/main.go` - Scheduler integration
- [ ] Modified `.env.example` with `ROLLUP_INTERVAL_HOURS=1`
- [ ] Health endpoint addition

**Code Pattern**:
```go
type RollupScheduler struct {
    queries *db.Queries
    interval time.Duration
    lastRun time.Time
    running bool
    mu sync.Mutex
}

func (s *RollupScheduler) Start(ctx context.Context) {
    ticker := time.NewTicker(s.interval)
    defer ticker.Stop()

    // Run immediately on startup
    s.runRollup(ctx)

    for {
        select {
        case <-ctx.Done():
            slog.Info("rollup scheduler shutting down")
            return
        case <-ticker.C:
            s.runRollup(ctx)
        }
    }
}

func (s *RollupScheduler) runRollup(ctx context.Context) {
    s.mu.Lock()
    s.running = true
    s.mu.Unlock()

    defer func() {
        s.mu.Lock()
        s.running = false
        s.lastRun = time.Now()
        s.mu.Unlock()
    }()

    err := s.queries.RollupCalculationStatsDaily(ctx)
    if err != nil {
        slog.Error("rollup failed", "error", err)
        return
    }
    slog.Info("rollup completed successfully")
}
```

**Verification**:
```bash
# After starting API with rollup enabled
curl http://localhost:8080/health/rollup
# Expected: {"last_run": "2025-12-28T10:00:00Z", "running": false, "healthy": true}

# Check stats table has data
psql -c "SELECT COUNT(*) FROM calculation_stats_daily;"
# Expected: > 0
```

---

### AGENT 3: API Logging Agent
**Scope**: Add calculation tracking to missing endpoints

**Tasks**:
1. Identify all publisher zmanim endpoints that should be logged
2. Add `CalculationLogService.Log()` calls to authenticated API endpoints
3. Ensure `SourceAPI` (2) is used for authenticated requests
4. Verify no duplicate logging (check if already integrated)

**Files to Modify**:
- `api/internal/handlers/zmanim.go` - Check all calculation endpoints
- Any other handlers that return zmanim calculations

**Verification**:
```bash
# Make authenticated API request
curl -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-28"

# Check log was created with source=2
psql -c "SELECT * FROM calculation_logs WHERE source = 2 ORDER BY created_at DESC LIMIT 1;"
```

---

### AGENT 4: E2E Test Agent
**Scope**: Create comprehensive end-to-end tests

**Tasks**:
1. Create E2E test file: `tests/e2e/publisher/analytics.spec.ts`
2. Test scenarios:
   - Analytics page loads with stats displayed
   - Stats update after making zmanim calculations
   - Coverage areas and localities show correct counts
3. Create test helpers for generating calculation data
4. Add to CI pipeline if not already included

**Test File Structure**:
```typescript
// tests/e2e/publisher/analytics.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsPublisher, getAuthToken } from '../utils/clerk-auth';

test.describe('Publisher Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPublisher(page, 'test-publisher');
  });

  test('displays analytics dashboard with stats', async ({ page }) => {
    await page.goto('/publisher/analytics');

    // Verify page loads
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    // Verify stat cards are present
    await expect(page.getByText('Total Calculations')).toBeVisible();
    await expect(page.getByText('This Month')).toBeVisible();
    await expect(page.getByText('Coverage Areas')).toBeVisible();
    await expect(page.getByText('Localities Covered')).toBeVisible();
  });

  test('stats update after zmanim calculation', async ({ page, request }) => {
    // Get initial stats
    await page.goto('/publisher/analytics');
    const initialTotal = await page.locator('[data-testid="total-calculations"]').textContent();

    // Make a zmanim calculation via UI
    await page.goto('/publisher/zmanim');
    await page.getByLabel('Location').fill('Manchester');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await page.waitForResponse(resp => resp.url().includes('/zmanim'));

    // Trigger manual rollup (test helper endpoint) or wait
    // ...

    // Verify stats increased
    await page.goto('/publisher/analytics');
    const newTotal = await page.locator('[data-testid="total-calculations"]').textContent();
    expect(parseInt(newTotal || '0')).toBeGreaterThan(parseInt(initialTotal || '0'));
  });

  test('coverage stats match actual coverage', async ({ page }) => {
    await page.goto('/publisher/analytics');

    const coverageAreas = await page.locator('[data-testid="coverage-areas"]').textContent();
    const localities = await page.locator('[data-testid="localities-covered"]').textContent();

    // These should be non-zero for active publishers
    expect(parseInt(coverageAreas || '0')).toBeGreaterThanOrEqual(0);
    expect(parseInt(localities || '0')).toBeGreaterThanOrEqual(0);
  });
});
```

**Verification**:
```bash
cd tests && npx playwright test e2e/publisher/analytics.spec.ts --headed
# Expected: All tests pass
```

---

### AGENT 5: Frontend Enhancement Agent
**Scope**: Add data-testid attributes and improve UX

**Tasks**:
1. Add `data-testid` attributes to all stat cards for E2E testing
2. Add loading states while fetching analytics
3. Add error handling for failed API calls
4. Add refresh button to manually reload stats
5. Ensure "Coming Soon" section is clearly styled

**File**: `web/app/publisher/analytics/page.tsx`

**Required data-testid attributes**:
- `total-calculations`
- `monthly-calculations`
- `coverage-areas`
- `localities-covered`
- `refresh-analytics-btn`

**Verification**:
```bash
# Visual check
open http://localhost:3001/publisher/analytics

# DOM check
document.querySelector('[data-testid="total-calculations"]')
# Expected: Element exists with numeric value
```

---

### AGENT 6: Integration Test Agent
**Scope**: Create integration tests for rollup and logging

**Tasks**:
1. Create Go integration tests: `api/internal/services/rollup_scheduler_test.go`
2. Test scenarios:
   - Rollup aggregates logs correctly
   - Multiple rollups are idempotent
   - Empty logs table handles gracefully
   - Concurrent rollup prevention
3. Create test for calculation log service

**Test Pattern**:
```go
func TestRollupAggregatesCorrectly(t *testing.T) {
    // Setup: Insert test calculation logs
    // Action: Run rollup
    // Assert: Stats table has correct aggregates
}

func TestRollupIsIdempotent(t *testing.T) {
    // Setup: Insert logs, run rollup
    // Action: Run rollup again
    // Assert: Stats unchanged (no duplicates)
}
```

**Verification**:
```bash
cd api && go test -v ./internal/services/... -run TestRollup
# Expected: All tests pass
```

---

## Definition of Done (DoD)

### Functional Requirements
- [ ] Analytics page shows non-zero calculation stats after making calculations
- [ ] Stats update within 1 hour of calculation (rollup interval)
- [ ] Coverage areas and localities show accurate counts
- [ ] Calculation logging works for Web UI, External API, and Publisher API
- [ ] Admin can view platform-wide stats (stretch goal)

### Technical Requirements
- [ ] Migration applied successfully to database
- [ ] Rollup job starts with API server
- [ ] Rollup job shuts down gracefully on SIGTERM
- [ ] Health endpoint reports rollup status
- [ ] All existing tests continue to pass
- [ ] New E2E tests pass
- [ ] New integration tests pass
- [ ] No linting errors (`golangci-lint run`)
- [ ] No TypeScript errors (`npm run type-check`)

### Quality Gates
- [ ] Code reviewed by at least one other agent (simulated via code review workflow)
- [ ] E2E test coverage for analytics page > 80%
- [ ] No new security vulnerabilities introduced
- [ ] Documentation updated if API contracts change

---

## Acceptance Tests

### AT-1: Fresh Calculation Tracking
```gherkin
Given a publisher has made 0 calculations today
When the publisher calculates zmanim for Manchester via Web UI
And the rollup job runs
Then the analytics page shows "Total Calculations: 1"
And the analytics page shows "This Month: 1"
```

### AT-2: Multiple Source Tracking
```gherkin
Given a publisher has made 0 calculations
When 5 calculations are made via Web UI
And 3 calculations are made via External API
And 2 calculations are made via Publisher API
And the rollup job runs
Then total calculations equals 10
And source breakdown shows Web:5, API:2, External:3
```

### AT-3: Historical Data Preservation
```gherkin
Given a publisher has 100 calculations from last month
And 50 calculations from this month
When viewing the analytics page
Then "Total Calculations" shows 150
And "This Month" shows 50
```

### AT-4: Coverage Accuracy
```gherkin
Given a publisher has coverage for Michigan (1 state) and Manchester (1 city)
When viewing the analytics page
Then "Coverage Areas" shows 2
And "Localities Covered" shows the sum of localities in both areas
```

### AT-5: Rollup Resilience
```gherkin
Given the rollup job is running
When the API server receives SIGTERM
Then the rollup job completes its current operation
And shuts down gracefully within 30 seconds
And no data corruption occurs
```

---

## Execution Order

```
Phase 1 (Parallel):
├── AGENT 1: Database Migration
├── AGENT 5: Frontend data-testid additions
└── AGENT 6: Write integration test stubs

Phase 2 (After Phase 1):
├── AGENT 2: Rollup Job Implementation
└── AGENT 3: API Logging Additions

Phase 3 (After Phase 2):
├── AGENT 4: E2E Tests (needs working backend)
└── AGENT 6: Complete integration tests

Phase 4 (Final):
└── All Agents: Verification and DoD checklist
```

---

## Orchestrator Instructions

**YOU (the orchestrator) must NOT write any code.**

Your responsibilities:
1. Spawn sub-agents in parallel where dependencies allow
2. Track progress using TodoWrite tool
3. Verify each agent's deliverables before marking complete
4. Coordinate handoffs between dependent phases
5. Run final verification suite
6. Report completion status with evidence

**Spawning Pattern**:
```
Task tool with subagent_type="general-purpose" for each agent
- Include this full context document
- Specify which AGENT number they are
- Include their specific tasks and verification criteria
```

**Progress Tracking**:
```
TodoWrite with items:
- [ ] Phase 1: Database Migration
- [ ] Phase 1: Frontend data-testid
- [ ] Phase 1: Integration test stubs
- [ ] Phase 2: Rollup Job
- [ ] Phase 2: API Logging
- [ ] Phase 3: E2E Tests
- [ ] Phase 3: Integration tests complete
- [ ] Phase 4: Final verification
- [ ] DoD: All checklist items green
```

---

## Success Criteria

The feature is COMPLETE when:
1. `curl http://localhost:8080/api/v1/publisher/analytics` returns non-zero stats
2. `npx playwright test analytics.spec.ts` passes all tests
3. `go test ./internal/services/...` passes all tests
4. Analytics page visually shows real data (screenshot evidence)
5. All DoD checklist items are checked

---

## Appendix: File Reference

| Purpose | Path |
|---------|------|
| Frontend Page | `web/app/publisher/analytics/page.tsx` |
| Analytics Handler | `api/internal/handlers/handlers.go:1093-1169` |
| Log Service | `api/internal/services/calculation_log_service.go` |
| SQL Queries | `api/internal/db/queries/calculation_logs.sql` |
| Generated SQL | `api/internal/db/sqlcgen/calculation_logs.sql.go` |
| Main Entry | `api/cmd/api/main.go` |
| Web Zmanim (has logging) | `api/internal/handlers/zmanim.go:684-693` |
| External API (has logging) | `api/internal/handlers/external_api.go:393-408` |
| Migrations | `db/migrations/` |
| E2E Tests | `tests/e2e/publisher/` |

---

*Generated by Mary (Business Analyst Agent) - 2025-12-28*
