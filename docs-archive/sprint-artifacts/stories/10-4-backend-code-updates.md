# Story 10.4: Backend Code Updates (SQLc, Handlers, Commands)

**Story ID:** 10.4
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 8
**Priority:** HIGH - Backend API compatibility
**Risk:** Medium

---

## User Story

**As a** developer
**I want** backend code updated to use the new geo_localities schema
**So that** existing API endpoints continue to work with the new data structure

---

## Background

With the new schema in place and data imported, we need to:
- Update SQLc queries to use geo_localities instead of geo_cities
- Update handlers to work with new data model
- Update related commands (import-elevation, seed-geodata)
- Maintain API backward compatibility

---

## Acceptance Criteria

### AC1: SQLc Queries Updated - localities.sql
- [ ] File renamed/created: `api/internal/db/queries/localities.sql`
- [ ] All queries reference `geo_localities` instead of `geo_cities`
- [ ] Queries include `locality_type_id` joins for type information
- [ ] `SearchLocalities` query from Story 10.3 present and working
- [ ] All queries compile: `cd api && sqlc generate` succeeds

**Required Queries:**
```sql
-- name: GetLocalityByID :one
-- name: ListLocalities :many
-- name: GetLocalitiesNearPoint :many
-- name: GetLocalitiesByCountry :many
-- name: GetLocalitiesByRegion :many
-- name: UpdateLocalityElevation :exec
-- name: UpdateLocalityTimezone :exec
-- name: SearchLocalities :many (from 10.3)
```

**Verification:**
```bash
cd api && sqlc generate
# Expected: No errors

ls api/internal/db/sqlcgen/ | grep -i localit
# Expected: locality-related generated files
```

### AC2: Handlers Updated - localities.go
- [ ] File created/updated: `api/internal/handlers/localities.go`
- [ ] Uses 6-step handler pattern (per coding-standards.md)
- [ ] All handlers use SQLc queries (no raw SQL)
- [ ] Uses `slog` for logging (no `log.Printf` or `fmt.Printf`)
- [ ] Generic error messages for 500s (no stack traces exposed)
- [ ] API response format: `{ "data": <payload>, "meta": {...} }`

**Required Handlers:**
```go
func (h *Handlers) GetLocality(w http.ResponseWriter, r *http.Request)
func (h *Handlers) ListLocalities(w http.ResponseWriter, r *http.Request)
func (h *Handlers) SearchLocalities(w http.ResponseWriter, r *http.Request)
func (h *Handlers) GetNearbyLocalities(w http.ResponseWriter, r *http.Request)
```

**Verification:**
```bash
# Check for forbidden patterns
grep -r "log\.Printf\|fmt\.Printf" api/internal/handlers/localities.go
# Expected: No matches

grep -r "SELECT.*FROM" api/internal/handlers/localities.go
# Expected: No matches (all queries via SQLc)
```

### AC3: API Backward Compatibility
- [ ] Existing `/cities/*` endpoints still work
- [ ] Response format unchanged (or mapped for compatibility)
- [ ] No breaking changes for frontend
- [ ] cities.go internally uses localities queries with mapping

**Verification:**
```bash
./restart.sh

# Test existing endpoints
curl http://localhost:8080/api/v1/cities/1234
# Expected: Returns city data (mapped from locality)

curl "http://localhost:8080/api/v1/cities/search?q=Jerusalem"
# Expected: Returns search results
```

### AC4: import-elevation Command Updated
- [ ] Uses `geo_localities` instead of `geo_cities`
- [ ] Updates `UpdateLocalityElevation` SQLc query
- [ ] Batch processing still works
- [ ] No hardcoded SQL strings

**Verification:**
```bash
cd api && go build ./cmd/import-elevation

# Check source
grep -r "geo_cities" api/cmd/import-elevation/
# Expected: No matches

grep -r "geo_localities" api/cmd/import-elevation/
# Expected: Matches found
```

### AC5: seed-geodata Command Updated
- [ ] `geoTables` list updated: removes `geo_cities`, adds `geo_localities`
- [ ] FK constraint queries updated for new table references
- [ ] Index management updated for new indexes

**Verification:**
```bash
cd api && go build ./cmd/seed-geodata

# Check table list
grep -A 20 "geoTables" api/cmd/seed-geodata/main.go
# Expected: geo_localities in list, NOT geo_cities
```

### AC6: geo-hierarchy Command Updated
- [ ] Uses new locality/region hierarchy model
- [ ] Properly sets `parent_locality_id` for neighborhoods
- [ ] Properly sets `parent_region_id` for sub-regions

**Verification:**
```bash
cd api && go build ./cmd/geo-hierarchy
# Expected: Builds without error
```

### AC7: publisher_coverage Integration
- [ ] Coverage can reference `locality_id` (new column)
- [ ] Queries updated to use locality_id when available
- [ ] Backward compatible with city_id (transition period)

**Verification:**
```sql
SELECT COUNT(*) FROM publisher_coverage WHERE locality_id IS NOT NULL;
-- Expected: Can have locality references

-- After transition, this will be deprecated:
SELECT COUNT(*) FROM publisher_coverage WHERE city_id IS NOT NULL;
```

### AC8: Response Helper Usage
- [ ] All handlers use `RespondJSON`, `RespondError`, etc.
- [ ] No direct `json.Marshal` + `w.Write` patterns
- [ ] Consistent error response format

**Verification:**
```bash
grep -r "json\.Marshal" api/internal/handlers/localities.go
# Expected: No matches (use RespondJSON instead)
```

### AC9: Type Definitions Updated
- [ ] Go types generated correctly by SQLc
- [ ] Any manual types updated for new schema
- [ ] No `any` or `interface{}` where typed struct is appropriate

**Verification:**
```bash
grep -r "interface{}" api/internal/handlers/localities.go
# Expected: Minimal/no matches (proper types used)
```

### AC10: Build and Tests Pass
- [ ] `cd api && go build ./...` succeeds
- [ ] `cd api && go test ./...` succeeds
- [ ] `cd api && go vet ./...` no issues
- [ ] `cd api && golangci-lint run ./...` passes

**Verification:**
```bash
cd api
go build ./...
go test ./...
go vet ./...
golangci-lint run ./...
# Expected: All pass
```

---

## Technical Implementation

### Handler Pattern (6-step)
```go
func (h *Handlers) GetLocality(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. No publisher context needed for public endpoint
    // (If publisher endpoint, use: pc := h.publisherResolver.MustResolve(w, r))

    // 2. Extract URL params
    idStr := chi.URLParam(r, "id")
    id, err := strconv.ParseInt(idStr, 10, 32)
    if err != nil {
        RespondBadRequest(w, r, "Invalid locality ID")
        return
    }

    // 3. No body to parse for GET

    // 4. Validate (already done via parsing)

    // 5. SQLc query
    locality, err := h.db.Queries.GetLocalityByID(ctx, int32(id))
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            RespondNotFound(w, r, "Locality not found")
            return
        }
        slog.Error("failed to get locality", "error", err, "id", id)
        RespondInternalError(w, r)
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, locality)
}
```

### Backward Compatibility Mapping
```go
// Map new locality to old city response format
func mapLocalityToCity(l sqlcgen.GetLocalityByIDRow) CityResponse {
    return CityResponse{
        ID:          l.ID,
        Name:        l.Name,
        NameASCII:   l.NameAscii,
        CountryID:   l.CountryID,
        CountryCode: l.CountryCode,
        RegionID:    l.RegionID,
        RegionName:  l.RegionName,
        Latitude:    l.Latitude,
        Longitude:   l.Longitude,
        Timezone:    l.Timezone,
        Population:  l.Population,
        ElevationM:  l.ElevationM,
        // New fields (optional for backward compat)
        LocalityType: l.LocalityTypeCode,
        ParentID:     l.ParentLocalityID,
    }
}
```

---

## Definition of Done

### Code Complete
- [ ] `localities.sql` with all required queries
- [ ] `localities.go` handlers with 6-step pattern
- [ ] import-elevation updated
- [ ] seed-geodata updated
- [ ] geo-hierarchy updated

### Coding Standards Compliance (MANDATORY)
- [ ] No raw SQL in handlers (SQLc only)
- [ ] No `log.Printf` or `fmt.Printf` (slog only)
- [ ] No raw `fetch()` in generated TypeScript (N/A for backend)
- [ ] No TODO/FIXME/DEPRECATED markers
- [ ] PublisherResolver used for publisher endpoints
- [ ] Generic 500 messages (no stack traces)
- [ ] Response helpers used (RespondJSON, etc.)

### Tests Pass
- [ ] `go build ./...` succeeds
- [ ] `go test ./...` passes
- [ ] `go vet ./...` clean
- [ ] `golangci-lint run ./...` passes
- [ ] E2E tests for city endpoints pass

### API Compatibility
- [ ] `/cities/{id}` returns valid response
- [ ] `/cities/search` returns valid response
- [ ] No frontend breaking changes

### Commit Requirements
- [ ] Commit message: `feat(api): update backend to use geo_localities schema`
- [ ] Push to remote after commit

---

## Out of Scope

- Renaming `/cities/*` to `/localities/*` (deferred to future story)
- Frontend changes (Story 10.5)
- Performance optimization (Story 10.6)

---

## Dependencies

- Story 10.1 (Database Schema Migration) - MUST be complete
- Story 10.2 (import-overture) - Data should be imported
- Story 10.3 (Search Index) - Search query needed

## Blocks

- Story 10.5 (Frontend Unification - needs working API)

---

## Estimated Effort

| Task | Hours |
|------|-------|
| SQLc queries | 3 |
| Handlers | 4 |
| import-elevation update | 1 |
| seed-geodata update | 1 |
| geo-hierarchy update | 1 |
| Backward compat mapping | 2 |
| Testing | 3 |
| Documentation | 1 |
| **Total** | **16** |

---

## Notes

- Keep `/cities/*` endpoints working; they're used by frontend
- Locality type information is bonus data for UI enhancements
- Parent hierarchy enables breadcrumb display in future
