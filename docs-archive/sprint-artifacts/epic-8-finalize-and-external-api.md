# Epic 8: Finalize Features, External API & Performance Optimization

**Epic:** Epic 8 - Finalize & External API
**Author:** BMad
**Date:** 2025-12-10
**Status:** Planning
**Estimated Stories:** 16
**Dependencies:** Epic 7 (AWS Migration)

---

## Executive Summary

Epic 8 completes the Shtetl Zmanim platform for production deployment. It addresses incomplete dashboard features, activates the audit trail, creates an external API for downstream systems (Shul Management Platform), optimizes location search for better user experience, and ensures geo data integrity through hierarchy validation and cleanup.

### What We're Building

**30% Feature Completion:**
- Wire algorithm version history (backend exists, routes missing)
- Implement calculation logging for real dashboard stats
- Activate audit trail using existing `actions` table

**30% External API:**
- Clerk M2M authentication for machine-to-machine access
- Bulk zmanim calculation endpoint (up to 365 days)
- Publisher zmanim listing with version IDs
- Rate limiting (10 req/min, 100 req/hour)

**25% Search & UX:**
- Unified location search with smart ranking
- Population-weighted results
- Hierarchical parsing ("London England", "Salford Manchester")

**15% Geo Data Cleanup:**
- Ensure complete hierarchy: city → district → region → country → continent
- Validate and repair missing parent relationships using PostGIS boundaries
- Remove SimpleMaps dependency (use GeoNames/Natural Earth only)

---

## Goals & Success Criteria

### Primary Goals

1. **Complete Dashboard** - Real metrics, working version history, active audit trail
2. **External API** - Production-ready API for Shul Management Platform
3. **Location Search** - Intuitive, fast, smart results
4. **Geo Data Integrity** - Complete hierarchy with validated relationships
5. **Production Ready** - All features tested and deployment-ready

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard stats accuracy | 100% | Compare to DB queries |
| Version history working | All ACs pass | E2E tests |
| Audit trail capturing events | >95% coverage | Event count |
| External API latency (bulk) | <2s for 365 days | Load testing |
| Location search relevance | Top 3 results 90%+ correct | User testing |
| "London England" returns London UK first | Yes | Manual test |
| Cities with complete hierarchy | 100% | Validation query |
| Orphaned geo records | 0 | Validation query |

---

## Research Findings Summary

### Current State Assessment

| Feature | Current State | Gap |
|---------|---------------|-----|
| **Algorithm Version History** | Backend 100%, Routes 0% | 5 routes need registration |
| **Dashboard Analytics** | Placeholder (shows 0) | No `calculation_logs` table |
| **Activity Log** | "Coming Soon" banner | `actions` table exists, not used |
| **Publisher Snapshots** | Fully working | None |
| **Caching** | Fully working (Redis) | None |
| **Location Search** | Works but inconsistent | Ranking, parsing issues |

### External API Requirements

From Shul Management Platform needs:

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /external/publishers/{id}/zmanim` | List available zmanim with version IDs | Clerk M2M |
| `POST /external/zmanim/calculate` | Bulk calculation (up to 365 days) | Clerk M2M |

**Request format (bulk):**
```json
{
  "publisher_id": "uuid",
  "location": { "city_id": 12345 },
  "date_range": { "start": "2025-01-01", "end": "2025-12-31" },
  "zmanim": [
    { "zman_id": "sunrise", "version_id": "v3" },
    { "zman_id": "sunset", "version_id": "v2" }
  ]
}
```

**Response format:**
```json
{
  "publisher_id": "uuid",
  "location": { "city_id": 12345, "name": "Jerusalem", "timezone": "Asia/Jerusalem" },
  "zmanim": [
    {
      "zman_id": "sunrise",
      "version_id": "v3",
      "times": {
        "2025-01-01": "06:42:30",
        "2025-01-02": "06:42:45"
      }
    }
  ],
  "cached": true,
  "generated_at": "2025-12-10T10:00:00Z"
}
```

---

## Story Breakdown

### Story 8.1: Wire Algorithm Version History Routes

**As a** publisher,
**I want** working version history with diff and rollback,
**So that** I can track and revert algorithm changes.

**Context:** Backend handlers, queries, and frontend components ALL exist. Just need to wire 5 routes in `main.go`.

**Acceptance Criteria:**
- [ ] `GET /publisher/algorithm/history` returns version list
- [ ] `GET /publisher/algorithm/history/{version}` returns version detail
- [ ] `GET /publisher/algorithm/diff?v1=X&v2=Y` returns diff
- [ ] `POST /publisher/algorithm/rollback` creates new version from old
- [ ] `POST /publisher/algorithm/snapshot` saves current state
- [ ] Frontend version history dialog works
- [ ] E2E test: create versions, compare, rollback

**Work Items:**
1. Add 5 routes to `api/cmd/api/main.go`
2. Test each endpoint manually
3. Verify frontend integration
4. Write E2E tests

**Estimated:** 3 points

---

### Story 8.2: Implement Calculation Logging

**As a** publisher,
**I want** real calculation statistics on my dashboard,
**So that** I can see how my zmanim are being used.

**Acceptance Criteria:**
- [ ] `calculation_logs` table created
- [ ] Every zmanim calculation logged (async, non-blocking)
- [ ] Dashboard shows real "Total Calculations" count
- [ ] Dashboard shows real "This Month" count
- [ ] Cache hit/miss ratio tracked
- [ ] Admin dashboard shows platform-wide stats

**Work Items:**
1. Create migration for `calculation_logs` table
2. Update zmanim handler to log calculations (goroutine)
3. Create SQLc queries for stats aggregation
4. Update publisher analytics endpoint
5. Update admin stats endpoint
6. Add indexes for efficient aggregation

**Database:**
```sql
CREATE TABLE calculation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id BIGINT REFERENCES geo_cities(id),
    date_calculated DATE NOT NULL,
    cache_hit BOOLEAN DEFAULT false,
    response_time_ms INTEGER,
    zman_count INTEGER,
    source TEXT, -- 'web', 'api', 'external'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calc_logs_publisher ON calculation_logs(publisher_id);
CREATE INDEX idx_calc_logs_created ON calculation_logs(created_at);
CREATE INDEX idx_calc_logs_publisher_month ON calculation_logs(publisher_id, date_trunc('month', created_at));
```

**Estimated:** 5 points

---

### Story 8.3: Activate Audit Trail

**As a** publisher,
**I want** to see a log of changes to my account,
**So that** I can track what was modified and when.

**Context:** The `actions` table exists with full schema. SQLc queries exist (`RecordAction`, `CompleteAction`, `GetEntityActionHistory`). Just need to call them from handlers.

**Acceptance Criteria:**
- [ ] Profile updates logged to `actions` table
- [ ] Algorithm saves/publishes logged
- [ ] Coverage add/remove logged
- [ ] Activity endpoint returns real data
- [ ] Admin impersonation shows "Admin (Support)"
- [ ] Activity page displays log entries

**Work Items:**
1. Create `ActivityService` to wrap action logging
2. Integrate into profile update handler
3. Integrate into algorithm save/publish handlers
4. Integrate into coverage handlers
5. Update activity endpoint to query `actions` table
6. Remove "Coming Soon" banner from frontend

**Action Types:**
```go
const (
    ActionProfileUpdate    = "profile_update"
    ActionAlgorithmSave    = "algorithm_save"
    ActionAlgorithmPublish = "algorithm_publish"
    ActionCoverageAdd      = "coverage_add"
    ActionCoverageRemove   = "coverage_remove"
    ActionZmanCreate       = "zman_create"
    ActionZmanUpdate       = "zman_update"
    ActionZmanDelete       = "zman_delete"
)
```

**Estimated:** 5 points

---

### Story 8.4: External API - Clerk M2M Authentication

**As a** developer integrating with Shtetl Zmanim,
**I want** API key authentication via Clerk M2M tokens,
**So that** my backend can securely access zmanim data.

**Acceptance Criteria:**
- [ ] Clerk M2M token validation middleware
- [ ] `/external/*` routes protected by M2M auth
- [ ] Tokens can be created in Clerk dashboard
- [ ] Token validation returns client_id for logging
- [ ] Rate limiting headers returned
- [ ] Documentation for obtaining tokens

**Work Items:**
1. Create M2M auth middleware using Clerk Go SDK
2. Register middleware for `/external/*` routes
3. Create rate limiting middleware (token bucket)
4. Add rate limit headers to responses
5. Document M2M setup process
6. Test with sample M2M token

**Middleware:**
```go
func (h *Handlers) M2MAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractBearerToken(r)

        claims, err := clerk.VerifyToken(token)
        if err != nil {
            RespondUnauthorized(w, r, "Invalid M2M token")
            return
        }

        ctx := context.WithValue(r.Context(), "client_id", claims.Subject)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Estimated:** 5 points

---

### Story 8.5: External API - List Publisher Zmanim

**As a** developer integrating with Shtetl Zmanim,
**I want** to list available zmanim for a publisher,
**So that** I know which zman IDs and versions to request.

**Acceptance Criteria:**
- [ ] `GET /external/publishers/{id}/zmanim` endpoint
- [ ] Returns zman list with: master_zman_id, name_english, version_id
- [ ] Only returns enabled zmanim
- [ ] Includes formula metadata (for transparency)
- [ ] Response is cacheable (1 hour)
- [ ] Rate limited

**Response:**
```json
{
  "publisher_id": "uuid",
  "publisher_name": "Orthodox Union",
  "zmanim": [
    {
      "zman_key": "alos_hashachar",
      "master_zman_id": "uuid",
      "name_english": "Dawn (Alos Hashachar)",
      "name_hebrew": "עלות השחר",
      "version_id": "v3",
      "formula_type": "solar_angle",
      "formula_summary": "16.1° below horizon"
    }
  ],
  "total": 25,
  "generated_at": "2025-12-10T10:00:00Z"
}
```

**Work Items:**
1. Create handler `GetExternalPublisherZmanim`
2. Create SQLc query for zmanim with versions
3. Add route to external API group
4. Add caching (1 hour TTL)
5. Write tests

**Estimated:** 5 points

---

### Story 8.6: External API - Bulk Zmanim Calculation

**As a** developer integrating with Shtetl Zmanim,
**I want** to request zmanim for up to 365 days in one call,
**So that** my app can cache yearly schedules efficiently.

**Acceptance Criteria:**
- [ ] `POST /external/zmanim/calculate` endpoint
- [ ] Accepts date range up to 365 days
- [ ] Accepts list of zman IDs with version IDs
- [ ] Returns calculated times for each day
- [ ] Response cached by publisher+city+date range
- [ ] Performance: <2s for 365 days, 10 zmanim
- [ ] Rate limited: 10 req/min, 100 req/hour

**Request:**
```json
{
  "publisher_id": "uuid",
  "city_id": 12345,
  "date_range": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  },
  "zmanim": [
    { "zman_key": "sunrise" },
    { "zman_key": "sunset" },
    { "zman_key": "alos_hashachar", "version_id": "v2" }
  ]
}
```

**Response:**
```json
{
  "publisher_id": "uuid",
  "location": {
    "city_id": 12345,
    "name": "Jerusalem",
    "country": "Israel",
    "latitude": 31.7683,
    "longitude": 35.2137,
    "timezone": "Asia/Jerusalem"
  },
  "results": [
    {
      "zman_key": "sunrise",
      "version_id": "v3",
      "times": {
        "2025-01-01": "06:42:30",
        "2025-01-02": "06:42:45",
        "...": "..."
      }
    }
  ],
  "date_range": { "start": "2025-01-01", "end": "2025-12-31", "days": 365 },
  "cached": false,
  "calculation_time_ms": 1234,
  "generated_at": "2025-12-10T10:00:00Z"
}
```

**Work Items:**
1. Create handler `CalculateExternalBulkZmanim`
2. Implement batch calculation logic
3. Add specialized caching for bulk requests
4. Optimize with parallel date calculations
5. Add rate limiting (token bucket per client_id)
6. Performance testing
7. Write tests

**Performance Strategy:**
- Calculate in parallel (goroutines per week)
- Cache individual days, compose bulk response
- Return from cache if all days cached

**Estimated:** 13 points

---

### Story 8.7: Rate Limiting for External API

**As a** platform operator,
**I want** rate limiting on external API,
**So that** the system isn't overwhelmed by bulk requests.

**Acceptance Criteria:**
- [ ] Token bucket rate limiter per client_id
- [ ] Limits: 10 requests/minute, 100 requests/hour
- [ ] Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] 429 response when limit exceeded
- [ ] Limits stored in Redis for distributed enforcement
- [ ] Admin can adjust limits per client

**Response Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1702200000
```

**429 Response:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please wait 45 seconds.",
  "retry_after": 45
}
```

**Work Items:**
1. Implement token bucket rate limiter
2. Store counters in Redis
3. Create rate limit middleware
4. Add headers to responses
5. Create admin endpoint to adjust limits
6. Document rate limits

**Estimated:** 5 points

---

### Story 8.8: Unified Location Search Endpoint

**As a** user,
**I want** a single search that finds cities, regions, and countries,
**So that** I don't need to know what type of location I'm looking for.

**Acceptance Criteria:**
- [ ] `GET /locations/search` unified endpoint
- [ ] `types` parameter filters by city/region/district/country
- [ ] Smart ranking: exact > prefix > substring > fuzzy
- [ ] Population weighting for cities
- [ ] Returns top 10 high-quality results (not always 20)
- [ ] Response includes `match_score`

**Request:**
```
GET /locations/search?search=london&types=city,region&limit=10
```

**Response:**
```json
{
  "results": [
    {
      "type": "city",
      "id": "2643743",
      "name": "London",
      "description": "Greater London, United Kingdom",
      "country": "United Kingdom",
      "country_code": "GB",
      "population": 9002488,
      "latitude": 51.5074,
      "longitude": -0.1278,
      "timezone": "Europe/London",
      "match_score": 95
    },
    {
      "type": "region",
      "id": "eng",
      "name": "Greater London",
      "description": "United Kingdom",
      "country": "United Kingdom",
      "country_code": "GB",
      "match_score": 80
    }
  ],
  "total": 2,
  "took_ms": 15
}
```

**Work Items:**
1. Create `SearchLocationsUnified` SQLc query
2. Implement multi-factor scoring
3. Create handler with parameter validation
4. Add caching for common searches
5. Update frontend to use new endpoint
6. Deprecate old `/cities` search mode

**Estimated:** 8 points

---

### Story 8.9: Hierarchical Location Parsing

**As a** user,
**I want** to search "London England" or "Salford Manchester",
**So that** I get the right location without seeing 20 irrelevant results.

**Acceptance Criteria:**
- [ ] "London England" → London, UK (first result)
- [ ] "Salford Manchester" → Salford, Greater Manchester (first result)
- [ ] "New York USA" → New York City (first result)
- [ ] Parser understands [city] [region/country] pattern
- [ ] Falls back to fuzzy search if no hierarchy match

**Work Items:**
1. Create `ParseLocationQuery` function
2. Extract location and parent terms
3. Query with parent context filter
4. Add region/country alias lookup
5. Update `SearchLocationsUnified` to use parser
6. Add tests for all patterns

**Parser Logic:**
```go
func ParseLocationQuery(query string) (location, parent string) {
    terms := strings.Fields(strings.ToLower(query))

    if len(terms) == 2 {
        // Try [city] [country/region]
        return terms[0], terms[1]
    }

    if len(terms) == 3 {
        // Try [city city] [country] or [city] [region region]
        // "new york usa" → "new york", "usa"
        // "london greater manchester" → "london", "greater manchester"
    }

    return query, ""
}
```

**Estimated:** 5 points

---

### Story 8.10: Population-Weighted Search Ranking

**As a** user,
**I want** major cities to appear before small towns,
**So that** I find the most relevant location quickly.

**Acceptance Criteria:**
- [ ] "London" shows London UK (9M) before London Ontario (400K)
- [ ] Population data populated for 90%+ of cities
- [ ] Ranking formula: match_score + log(population) boost
- [ ] Cities without population use 0 (no boost)

**Work Items:**
1. Verify population data coverage
2. Fill missing population from GeoNames (migration)
3. Update search query with population ranking
4. Add population to search response
5. Test ranking with common city names

**Ranking Formula:**
```sql
ORDER BY
    -- Match quality first
    CASE
        WHEN name_ascii = search THEN 100
        WHEN name_ascii ILIKE search || '%' THEN 80
        WHEN name_ascii ILIKE '%' || search || '%' THEN 60
        ELSE 40 + (similarity * 20)
    END DESC,
    -- Then population boost
    COALESCE(population, 0) DESC,
    -- Then type (city before region)
    type_priority ASC,
    -- Finally alphabetical
    name ASC
```

**Estimated:** 3 points

---

### Story 8.11: Extended Location Aliases

**As a** user,
**I want** to search "UK" or "England" and find United Kingdom,
**So that** common names work intuitively.

**Acceptance Criteria:**
- [ ] "UK" → United Kingdom
- [ ] "England" → resolves correctly
- [ ] "USA" → United States
- [ ] 100+ country/region aliases loaded
- [ ] Admin can add aliases

**Work Items:**
1. Create `geo_location_aliases` table
2. Seed with common aliases (countries + major regions)
3. Update search to join aliases
4. Admin UI for managing aliases (optional)

**Table:**
```sql
CREATE TABLE geo_location_aliases (
    id SERIAL PRIMARY KEY,
    location_type TEXT NOT NULL CHECK (location_type IN ('country', 'region', 'district', 'city')),
    location_id INTEGER NOT NULL,
    alias TEXT NOT NULL UNIQUE,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_aliases_alias ON geo_location_aliases(alias);
```

**Seed Data:**
```sql
INSERT INTO geo_location_aliases (location_type, location_id, alias) VALUES
('country', (SELECT id FROM geo_countries WHERE code = 'GB'), 'uk'),
('country', (SELECT id FROM geo_countries WHERE code = 'GB'), 'england'),
('country', (SELECT id FROM geo_countries WHERE code = 'GB'), 'united kingdom'),
('country', (SELECT id FROM geo_countries WHERE code = 'US'), 'usa'),
('country', (SELECT id FROM geo_countries WHERE code = 'US'), 'america'),
-- ... 100+ more
```

**Estimated:** 3 points

---

### Story 8.12: E2E Testing & Bug Fixes

**As a** developer,
**I want** comprehensive E2E tests for all new features,
**So that** we can deploy with confidence.

**Acceptance Criteria:**
- [ ] E2E tests for version history flow
- [ ] E2E tests for dashboard analytics
- [ ] E2E tests for activity log
- [ ] E2E tests for external API (with M2M token)
- [ ] E2E tests for location search improvements
- [ ] All existing E2E tests still pass
- [ ] Bug fixes for issues found during testing

**Work Items:**
1. Write E2E tests for each story
2. Run full test suite
3. Fix bugs discovered
4. Performance testing for bulk API
5. Load testing for rate limiting
6. Documentation updates

**Estimated:** 5 points

---

### Story 8.13: Geo Data Hierarchy Validation & Repair

**As a** platform operator,
**I want** complete geographic hierarchy data,
**So that** every location has proper parent relationships for accurate coverage matching.

**Context:** Current geo data may have gaps where cities lack districts/regions, districts lack regions, etc. Need to ensure complete hierarchy: city → district → region → country → continent.

**Acceptance Criteria:**
- [ ] Every city has `district_id` and `region_id` populated
- [ ] Every district has `region_id` populated
- [ ] Every region has `country_id` populated
- [ ] Every country has `continent_id` populated
- [ ] Use PostGIS boundary data to assign missing relationships
- [ ] Validation query identifies orphaned records
- [ ] Migration repairs all hierarchy gaps
- [ ] Report generated showing repair statistics

**Work Items:**
1. Create hierarchy validation queries
2. Analyze current data gaps (count orphaned records)
3. Write migration to assign missing district_id using PostGIS `ST_Contains`
4. Write migration to assign missing region_id using boundaries
5. Write migration to ensure country→continent links
6. Create data quality report
7. Add database constraint to prevent future orphans

**Validation Query:**
```sql
-- Find cities without complete hierarchy
SELECT
    'city' as type,
    COUNT(*) FILTER (WHERE district_id IS NULL) as missing_district,
    COUNT(*) FILTER (WHERE region_id IS NULL) as missing_region
FROM geo_cities;

-- Find districts without region
SELECT COUNT(*) as orphaned_districts
FROM geo_districts WHERE region_id IS NULL;

-- Find regions without country
SELECT COUNT(*) as orphaned_regions
FROM geo_regions WHERE country_id IS NULL;
```

**Repair Logic:**
```sql
-- Assign district to city using boundary containment
UPDATE geo_cities c
SET district_id = d.id
FROM geo_districts d
WHERE c.district_id IS NULL
  AND ST_Contains(d.boundary, c.location);

-- Assign region to city using boundary containment
UPDATE geo_cities c
SET region_id = r.id
FROM geo_regions r
WHERE c.region_id IS NULL
  AND ST_Contains(r.boundary, c.location);
```

**Estimated:** 5 points

---

### Story 8.14: SimpleMaps Dependency Removal

**As a** developer,
**I want** to remove SimpleMaps from the data pipeline,
**So that** we rely only on validated boundary data for geo hierarchy.

**Context:** SimpleMaps was used as a supplementary data source but introduces inconsistency. For MVP, use only boundary-validated data. SimpleMaps can be re-introduced later if gaps are identified.

**Acceptance Criteria:**
- [ ] SimpleMaps import scripts removed or disabled
- [ ] No SimpleMaps tables referenced in application code
- [ ] Migration scripts reference only GeoNames/Natural Earth data
- [ ] Documentation updated to reflect data sources
- [ ] All 163k cities still functional after cleanup

**Work Items:**
1. Audit SimpleMaps references in codebase
2. Remove/disable SimpleMaps import scripts
3. Drop unused SimpleMaps staging tables (if any)
4. Update geo data documentation
5. Verify city count unchanged after cleanup
6. Document path to re-enable SimpleMaps if needed

**Data Source Strategy:**
| Data Type | Source | Status |
|-----------|--------|--------|
| Cities | GeoNames | Primary |
| Boundaries | Natural Earth | Primary |
| Population | GeoNames | Primary |
| SimpleMaps | Removed | Disabled for MVP |

**Estimated:** 3 points

---

### Story 8.15: React Query Cache Invalidation Bug Fixes

**As a** publisher,
**I want** UI updates to reflect my changes immediately,
**So that** I don't see stale data after saving.

**Context:** Several components use raw `api` calls instead of the mutation hooks with proper `invalidateKeys`. This causes stale data issues where:
- Location override saves don't update the map
- Coverage changes don't reflect until page refresh
- Algorithm/DSL saves may show old data when dialogs reopen

**Root Cause:** The codebase has a solid pattern in `useApiQuery.ts` with automatic cache invalidation via `invalidateKeys`, but some components bypass this by using raw `api` calls.

**Acceptance Criteria:**
- [ ] LocationOverrideDialog uses mutation hooks with cache invalidation
- [ ] Coverage page uses mutation hooks instead of raw api calls
- [ ] Algorithm editor properly invalidates zmanim cache on save
- [ ] All dialogs that modify data invalidate relevant queries
- [ ] No stale data visible after any save operation
- [ ] E2E tests verify UI updates after mutations

**Components to Fix:**

| Component | File | Action | Issue | Status |
|-----------|------|--------|-------|--------|
| **Coverage Page** | `web/app/publisher/coverage/page.tsx` | Add Coverage | Raw `api.post` + manual refetch | FIX |
| | | Delete Coverage | Raw `api.delete` + manual refetch | FIX |
| | | Toggle Active | Raw `api.put` + manual refetch | FIX |
| **LocationOverrideDialog** | `web/components/publisher/LocationOverrideDialog.tsx` | Save Override | Raw api calls, no invalidation | FIX |
| **Profile Page** | `web/app/publisher/profile/page.tsx` | Save Profile | Raw `api.put`, no cache invalidation | FIX |
| **Algorithm Editor** | `web/app/publisher/algorithm/page.tsx` | Restart Wizard | Raw `api.delete` + manual refetch | FIX |
| **Admin Publishers** | `web/app/admin/publishers/page.tsx` | Status Changes | Raw `api.admin.put` + manual refetch | FIX |
| | | Restore Publisher | Raw `api.admin.put` + manual refetch | FIX |
| | | Import Publisher | Raw fetch, bypasses auth | FIX |

**Already Working Correctly:**
| Component | File | Action | Pattern | Status |
|-----------|------|--------|---------|--------|
| RequestZmanModal | `web/components/publisher/RequestZmanModal.tsx` | Submit Request | `usePublisherMutation` with invalidateKeys | OK |
| ZmanAliasEditor | `web/components/publisher/ZmanAliasEditor.tsx` | Save/Delete Alias | `usePublisherMutation` with invalidateKeys | OK |
| Zman Editor | `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` | Save Zman | `createZman`/`updateZman` mutations | OK |
| Snapshot Dialogs | `web/components/publisher/SaveVersionDialog.tsx` | Save Version | `useSaveVersion` with invalidateKeys | OK |

**Work Items:**
1. Fix LocationOverrideDialog - replace raw api with mutation hook
2. Create `usePublisherCoverage` hook with proper mutations
3. Update Coverage page to use new hook
4. Audit Algorithm editor for cache issues
5. Review and fix CorrectionRequestDialog
6. Test all save operations for immediate UI updates
7. Add E2E tests for cache invalidation scenarios

**Key Cache Keys:**
```typescript
// Keys that must be invalidated after mutations
'publisher-zmanim'           // Main zmanim list
'publisher-coverage'         // Coverage areas
'publisher-profile'          // Publisher profile
'publisher-location-overrides' // Location overrides
'publisher-snapshots'        // Version history
```

**Example Fix Pattern:**
```tsx
// BEFORE (LocationOverrideDialog)
try {
  await api.put(`/publisher/location-overrides/${id}`, { body: JSON.stringify(payload) });
  onSuccess();  // No cache invalidation!
} catch (err) { ... }

// AFTER
const saveOverride = useDynamicMutation<Override, OverrideRequest>(
  (vars) => existingOverride
    ? `/publisher/location-overrides/${existingOverride.id}`
    : `/publisher/locations/${city.id}/override`,
  existingOverride ? 'PUT' : 'POST',
  (data) => data,
  { invalidateKeys: ['publisher-location-overrides', 'publisher-zmanim'] }
);

// Usage
saveOverride.mutate(payload, {
  onSuccess: () => {
    onSuccess();
    onOpenChange(false);
  }
});
```

**Estimated:** 5 points

---

### Story 8.16: Redis Cache Invalidation Bug Fixes

**As a** user,
**I want** zmanim calculations to reflect the latest publisher settings,
**So that** I don't receive outdated prayer times after publishers make changes.

**Context:** The Redis cache stores calculated zmanim times (24hr TTL) but several handlers that modify calculation inputs don't invalidate the cache. This means changes to coverage, location overrides, and tags can take up to 24 hours to take effect.

**Root Cause:** The cache has proper invalidation methods (`InvalidatePublisherCache`, `InvalidateZmanimForCity`) but they're not called from all relevant handlers.

**Acceptance Criteria:**
- [ ] Coverage add/update/delete invalidates Redis cache
- [ ] Location override add/update/delete invalidates Redis cache
- [ ] Tag add/update/delete invalidates Redis cache
- [ ] Zman metadata changes (not just formula) invalidate cache
- [ ] Integration tests verify cache invalidation

**Current Cache Status:**

| Change Type | Cached | Invalidated | Status |
|-------------|--------|-------------|--------|
| Algorithm formula change | Yes | YES | OK |
| Algorithm publish | Yes | YES | OK |
| Add/Update/Delete zman | Yes | Partial* | FIX |
| Add/Update/Delete zman tags | Yes | NO | FIX |
| Create coverage | Yes | NO | FIX |
| Update coverage | Yes | NO | FIX |
| Delete coverage | Yes | NO | FIX |
| Create location override | Yes | NO | FIX |
| Update location override | Yes | NO | FIX |
| Delete location override | Yes | NO | FIX |

*Only invalidates when `FormulaDSL` or `IsEnabled` changes, not other metadata

**Files Requiring Changes:**

| File | Handlers | Lines |
|------|----------|-------|
| `api/internal/handlers/coverage.go` | Create, Update, Delete | 269, 374, 439 |
| `api/internal/handlers/location_overrides.go` | Create, Update, Delete | 107, 265, 338 |
| `api/internal/handlers/publisher_zmanim.go` | Tag operations | 1769, 1831, 1903, 1961 |
| `api/internal/handlers/publisher_zmanim.go` | UpdatePublisherZman condition | 1206 |

**Work Items:**
1. Add `h.cache.InvalidatePublisherCache()` to coverage handlers
2. Add `h.cache.InvalidateZmanimForCity()` to location override handlers
3. Add `h.cache.InvalidatePublisherCache()` to tag handlers
4. Broaden UpdatePublisherZman to invalidate on any field change
5. Add integration tests for cache invalidation scenarios

**Example Fix:**
```go
// In CreatePublisherCoverage, after successful insert:
if h.cache != nil {
    if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
        slog.Warn("failed to invalidate cache after coverage change", "error", err)
    }
}

// In CreateLocationOverride, after successful insert:
if h.cache != nil {
    if err := h.cache.InvalidateZmanimForCity(ctx, publisherIDStr, cityIDStr); err != nil {
        slog.Warn("failed to invalidate cache after location override", "error", err)
    }
}
```

**Impact of NOT fixing:**
- Users see stale zmanim for up to 24 hours after publisher changes
- Location override changes (lat/lon/elevation) produce incorrect times
- Coverage removal still serves cached zmanim for removed cities

**Estimated:** 3 points

---

## Location Search Improvement Details

### Current Issues

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Shows 20 low-quality results | Hard-coded limit | Smart limit based on match quality |
| "London England" shows wrong London | No hierarchy parsing | Parse [city] [parent] pattern |
| Small towns rank same as cities | Population not in ORDER BY | Add population boost |
| Inconsistent fuzzy matching | Two code paths | Unified search endpoint |

### Search Ranking Formula

```sql
-- Multi-factor ranking score
WITH scored_results AS (
    SELECT
        *,
        -- Base match score (0-100)
        CASE
            WHEN name_ascii = $search THEN 100
            WHEN name_ascii ILIKE $search || '%' THEN 80
            WHEN name_ascii ILIKE '%' || $search || '%' THEN 60
            ELSE 40 + (similarity(name_ascii, $search) * 40)
        END as match_score,

        -- Population boost (0-15)
        CASE
            WHEN population > 1000000 THEN 15
            WHEN population > 100000 THEN 10
            WHEN population > 10000 THEN 5
            ELSE 0
        END as pop_boost,

        -- Type priority (city = 0, region = 5, country = 10)
        type_priority

    FROM coverage_search_mv
    WHERE name_ascii ILIKE '%' || $search || '%'
       OR similarity(name_ascii, $search) > 0.3
)
SELECT *, (match_score + pop_boost - type_priority) as final_score
FROM scored_results
ORDER BY final_score DESC, name ASC
LIMIT 10;
```

### Smart Limit Logic

```go
func smartLimit(results []SearchResult, requestedLimit int) []SearchResult {
    // Find natural quality boundary
    qualityThreshold := 70.0

    for i, r := range results {
        if r.MatchScore < qualityThreshold && i >= 5 {
            return results[:i]  // Stop at quality drop
        }
    }

    return results[:min(len(results), requestedLimit)]
}
```

---

## External API Documentation

### Authentication

External API uses Clerk M2M (Machine-to-Machine) tokens.

**Setup:**
1. Go to Clerk Dashboard → Machines
2. Create new machine
3. Copy the M2M token
4. Include in requests: `Authorization: Bearer <token>`

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/external/publishers/{id}/zmanim` | 100 req/hour |
| `/external/zmanim/calculate` | 10 req/min, 100 req/hour |

### Endpoints

#### List Publisher Zmanim

```
GET /external/publishers/{publisher_id}/zmanim
Authorization: Bearer <m2m_token>
```

#### Bulk Calculate Zmanim

```
POST /external/zmanim/calculate
Authorization: Bearer <m2m_token>
Content-Type: application/json

{
  "publisher_id": "uuid",
  "city_id": 12345,
  "date_range": { "start": "2025-01-01", "end": "2025-12-31" },
  "zmanim": [
    { "zman_key": "sunrise" },
    { "zman_key": "sunset" }
  ]
}
```

---

## Story Summary

| Story | Title | Points | Type |
|-------|-------|--------|------|
| 8.1 | Wire Algorithm Version History Routes | 3 | Quick Win |
| 8.2 | Implement Calculation Logging | 5 | Dashboard |
| 8.3 | Activate Audit Trail | 5 | Dashboard |
| 8.4 | External API - Clerk M2M Authentication | 5 | External API |
| 8.5 | External API - List Publisher Zmanim | 5 | External API |
| 8.6 | External API - Bulk Zmanim Calculation | 13 | External API |
| 8.7 | Rate Limiting for External API | 5 | External API |
| 8.8 | Unified Location Search Endpoint | 8 | Search |
| 8.9 | Hierarchical Location Parsing | 5 | Search |
| 8.10 | Population-Weighted Search Ranking | 3 | Search |
| 8.11 | Extended Location Aliases | 3 | Search |
| 8.12 | E2E Testing & Bug Fixes | 5 | Quality |
| 8.13 | Geo Data Hierarchy Validation & Repair | 5 | Geo Data |
| 8.14 | SimpleMaps Dependency Removal | 3 | Geo Data |
| 8.15 | React Query Cache Invalidation Bug Fixes | 5 | Bug Fix |
| 8.16 | Redis Cache Invalidation Bug Fixes | 3 | Bug Fix |
| **Total** | | **81 points** | |

---

## Dependencies

```
Epic 7 (AWS Migration)
    └── Story 7.10 (Go-Live)
            └── Epic 8 (This Epic)
                    ├── 8.1-8.3 (Dashboard features)
                    ├── 8.4-8.7 (External API)
                    └── 8.8-8.12 (Search & Testing)
```

Epic 8 can start immediately after Epic 7 go-live, or features can be developed in parallel and deployed after AWS migration.

---

## Non-Goals (Future Epics)

- Detailed analytics charts and trends (Epic 9)
- Publisher self-registration (Epic 9)
- Mobile apps (Epic 10+)
- Multi-language support (Epic 10+)

---

**Generated:** 2025-12-10
**Status:** READY FOR REVIEW
