# Dev Orchestrator Prompt: Fix Year Export Locality Lookup

## Problem Analysis

**Error:** `ApiError: latitude and longitude are required` at `/api/v1/publisher/zmanim/year?hebrew_year=5786&locality_id=542028`

**Root Cause:** The year export endpoint (`GetPublisherZmanimYear` in `api/internal/handlers/publisher_zmanim.go:653`) expects raw latitude/longitude parameters instead of accepting a `locality_id` and resolving coordinates centrally via `ZmanimService`.

**Current Broken Flow:**
1. Frontend sends `locality_id=542028` via `useYearExport.ts:141`
2. Backend expects `latitude` and `longitude` params (line 681-684)
3. Backend returns 400: "latitude and longitude are required"

**Required Flow (Tag-Driven Architecture):**
1. Frontend sends `locality_id` only
2. Backend handler passes `locality_id` to `ZmanimService`
3. `ZmanimService.CalculateZmanim()` calls `GetEffectiveLocalityLocation` (already implemented!)
4. Coordinates resolved with hierarchy: publisher override > admin override > default
5. Never expose lat/lon/elevation to frontend

---

## Reference Files

### Must Read First
- `/home/daniel/repos/zmanim/docs/coding-standards.md` - CAST-IRON RULES

### Backend (Primary Changes)
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go` - Handler to fix (line 636-840)
- `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go` - THE source of truth for ALL zmanim calculations

### Frontend (Secondary Changes)
- `/home/daniel/repos/zmanim/web/lib/hooks/useYearExport.ts` - Hook calling API
- `/home/daniel/repos/zmanim/web/components/publisher/YearExportDialog.tsx` - Dialog component

### Reference (Pattern to Follow)
- `ZmanimService.CalculateZmanim()` - Already handles locality_id → coordinates correctly (line 253-440)
- `GetPublisherZmanim` handler - Uses locality_id pattern (line 175-492)

---

## Implementation Tasks

### Task 1: Fix Backend Handler (CRITICAL)
**File:** `api/internal/handlers/publisher_zmanim.go` - `GetPublisherZmanimYear`

**Changes Required:**
1. Replace latitude/longitude/timezone params with `locality_id` (required)
2. Use `h.db.Queries.GetEffectiveLocalityLocation()` to resolve coordinates (same as `CalculateZmanim`)
3. Get timezone from locality, not from query param
4. Remove validation for lat/lon - validate locality_id instead
5. Update Swagger docs to reflect locality_id param

**Pattern to Follow (from CalculateZmanim, line 273-290):**
```go
// Get effective locality location with hierarchical override resolution
// Priority: publisher override > admin override > default (overture/glo90)
localityID32 := int32(params.LocalityID)
location, err := s.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
    LocalityID:  localityID32,
    PublisherID: pgtype.Int4{Int32: params.PublisherID, Valid: true},
})
if err != nil {
    return nil, fmt.Errorf("locality not found: %w", err)
}

// Load timezone from locality
tz, err := time.LoadLocation(location.Timezone)
// Coordinates already resolved with correct priority
latitude := location.Latitude
longitude := location.Longitude
elevation := float64(location.ElevationM)
```

**Remove these lines (680-701):**
```go
// DELETE: if latStr == "" || lonStr == "" { RespondBadRequest... }
// DELETE: latitude, err := strconv.ParseFloat(latStr, 64)
// DELETE: longitude, err := strconv.ParseFloat(lonStr, 64)
// DELETE: if timezone == "" { timezone = "UTC" }
// DELETE: if locationName == "" { locationName = fmt.Sprintf(...) }
```

**Add locality_id handling:**
```go
localityIDStr := r.URL.Query().Get("locality_id")
if localityIDStr == "" {
    RespondBadRequest(w, r, "locality_id is required")
    return
}
localityID, err := strconv.ParseInt(localityIDStr, 10, 64)
if err != nil {
    RespondBadRequest(w, r, "Invalid locality_id")
    return
}

// Get effective locality location (same as CalculateZmanim)
location, err := h.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
    LocalityID:  int32(localityID),
    PublisherID: pgtype.Int4{Int32: publisherIDInt32, Valid: true},
})
if err != nil {
    RespondNotFound(w, r, "Locality not found")
    return
}

// Extract coordinates (resolved with publisher overrides)
latitude := location.Latitude
longitude := location.Longitude
elevation := float64(location.ElevationM)

// Load timezone from locality
tz, err := time.LoadLocation(location.Timezone)
if err != nil {
    tz = time.UTC
}

// Use locality name for export
locationName := location.Name
```

### Task 2: Update Frontend Hook (Minor)
**File:** `web/lib/hooks/useYearExport.ts`

The hook already sends `locality_id` correctly (line 142). No changes needed here.

### Task 3: Add LocalityPicker to YearExportDialog (UX Enhancement)
**File:** `web/components/publisher/YearExportDialog.tsx`

**Current:** Shows static "Locality ID: 542028" text
**Required:** Add `LocalityPicker` component with default from algorithm page

**Changes:**
1. Import `LocalityPicker` from `@/components/shared/LocalityPicker`
2. Import `LocalitySelection` type
3. Add state for selected locality
4. Replace static display with `<LocalityPicker mode="single" onSelect={...} />`
5. Use `selectedLocality.id` when calling export

**Pattern to Follow (from ZmanimReportDialog.tsx:145-158):**
```tsx
<LocalityPicker
  mode="single"
  variant="dropdown"
  filterPreset="coverage"
  onSelect={handleLocalityChange}
  placeholder="Search for a location..."
/>
```

### Task 4: Ensure Candle Lighting Only Shows on Friday (Verification)
**File:** `api/internal/services/zmanim_service.go`

The tag filtering is already centralized in `ShouldShowZman()` (line 817-960). Verify:
1. Candle lighting zman has tag `shabbos` + timing tag `day_before`
2. `ShouldShowZman()` correctly matches `erev_shabbos` in `activeEventCodes`
3. On Friday, `activeEventCodes` includes `erev_shabbos` from calendar service

**Filtering Logic (line 883-893):**
```go
// Timing-modified match: if zman has day_before timing tag,
// also check if "erev_" + event code is in activeEventCodes
// Example: shabbos + day_before should match erev_shabbos
if !isActive && hasDayBefore && !tag.IsNegated {
    erevCode := "erev_" + tag.TagKey
    if s.sliceContainsString(activeEventCodes, erevCode) {
        isActive = true
    }
}
```

---

## Validation Checklist

### Pre-Implementation
- [ ] Read `docs/coding-standards.md`
- [ ] Understand `ZmanimService.CalculateZmanim()` pattern
- [ ] Understand `GetEffectiveLocalityLocation` SQL query

### Backend Changes
- [ ] Handler accepts `locality_id` param (NOT lat/lon)
- [ ] Uses `GetEffectiveLocalityLocation` for coordinate resolution
- [ ] Timezone loaded from locality (not query param)
- [ ] Swagger docs updated
- [ ] No lat/lon exposed in response (use `location.Name` instead)
- [ ] Run `cd api && go build ./cmd/api` - must pass
- [ ] Run `cd api && sqlc generate` if any SQL changes

### Frontend Changes
- [ ] `YearExportDialog` uses `LocalityPicker` component
- [ ] Default locality from algorithm page pre-selected
- [ ] Run `cd web && npm run type-check` - must pass

### Integration Testing
1. `./restart.sh`
2. Navigate to Algorithm page in browser
3. Open Year Export dialog
4. Select locality (should default to algorithm page locality)
5. Click Export
6. **Verify:** Excel file downloads with correct zmanim
7. **Verify:** Candle lighting only appears on Fridays in export

### Test Commands
```bash
# Test API directly with locality_id
source api/.env && node scripts/get-test-token.js
# Copy token, then:
curl -s -H "Authorization: Bearer eyJhbG..." -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim/year?hebrew_year=5786&locality_id=542028" | jq '.data.location'

# Expected response:
# {
#   "name": "Manchester",
#   "latitude": 53.4808,
#   "longitude": -2.2426,
#   "timezone": "Europe/London"
# }
```

---

## Critical Rules (from coding-standards.md)

### FORBIDDEN
- Hardcoded lat/lon in handlers
- Raw fetch() in frontend
- Manual header extraction (use PublisherResolver)
- Text-based lookups (use numeric IDs)

### REQUIRED
- `ZmanimService` as single source for ALL zmanim calculations
- `locality_id` for ALL geographic lookups
- `useApi()` hook for all API calls
- Design tokens for colors
- slog for logging

---

## Files Modified Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `api/internal/handlers/publisher_zmanim.go` | Major | Replace lat/lon with locality_id lookup |
| `web/components/publisher/YearExportDialog.tsx` | Minor | Add LocalityPicker, remove static ID display |
| `api/internal/services/zmanim_service.go` | None | Verify tag filtering (no changes expected) |

---

## Success Criteria

1. **API accepts locality_id:** `GET /publisher/zmanim/year?hebrew_year=5786&locality_id=542028` returns 200
2. **Coordinates resolved server-side:** Response contains location name, coordinates come from DB
3. **LocalityPicker in dialog:** User can search/select locality
4. **Default locality works:** Opens with algorithm page locality pre-selected
5. **Candle lighting filtering:** Only appears on Fridays in export
6. **All filtering in ZmanimService:** No hardcoded event logic in handlers
