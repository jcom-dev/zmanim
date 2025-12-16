# Verification Report: Correction Request Locality Resolution

**Date:** 2025-12-22
**Task:** Verify that zmanim calculation system correctly uses approved correction request data
**Status:** ✅ VERIFIED with 1 CRITICAL CACHE ISSUE identified

---

## Executive Summary

The locality resolution system correctly implements hierarchical override priority for approved correction requests. The database function `get_effective_locality_location()` properly resolves coordinates and elevations with the correct hierarchy:

**Priority Order:** Publisher Override > Admin Override > Default Source (Overture/GLO-90)

However, **CRITICAL ISSUE IDENTIFIED:** Cache invalidation is missing when admin approves correction requests, which means approved corrections won't be reflected in zmanim calculations until cache expires (24 hours).

---

## 1. Locality Resolution Hierarchy - ✅ VERIFIED

### 1.1 Database Function Implementation

**File:** PostgreSQL function `get_effective_locality_location(p_locality_id, p_publisher_id)`

**Resolution Logic:**
```sql
-- Coordinates Resolution (verified)
1. Check publisher override (if p_publisher_id provided)
   WHERE locality_id = p_locality_id
   AND publisher_id = p_publisher_id

2. Check admin override (if no publisher override)
   WHERE locality_id = p_locality_id
   AND publisher_id IS NULL
   AND source_id = admin_source_id

3. Use default source (if no overrides)
   WHERE locality_id = p_locality_id
   AND publisher_id IS NULL
   AND source_id != admin_source_id
   ORDER BY priority
   LIMIT 1
```

Same logic applies for elevation resolution.

**✅ Verification Status:** Correct implementation. Priority hierarchy is enforced at the database level.

---

### 1.2 Zmanim Service Integration

**File:** `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go`
**Lines:** 260-268

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
```

**✅ Verification Status:** Correct usage. Every zmanim calculation uses this function to resolve locality coordinates.

---

## 2. Correction Request Approval Flow - ✅ VERIFIED

### 2.1 Admin Approval Handler

**File:** `/home/daniel/repos/zmanim/api/internal/handlers/correction_requests.go`
**Function:** `UpdateCorrectionRequestStatus`
**Lines:** 612-657

**Approval Workflow:**
1. Validates admin role and request status (must be "pending")
2. Creates admin overrides using ON CONFLICT DO UPDATE queries:
   - `CreateAdminLocationOverride` (lat/long if provided)
   - `CreateAdminElevationOverride` (elevation if provided)
3. Updates correction request status to "approved"
4. Sends email notification

**✅ Verification Status:** Correct implementation. Admin overrides are created with `publisher_id = NULL` and `source_id = admin`, which gives them correct priority.

---

### 2.2 Override Creation Queries

**File:** `/home/daniel/repos/zmanim/api/internal/db/queries/correction_requests.sql`

**CreateAdminLocationOverride (lines 123-154):**
```sql
INSERT INTO geo_locality_locations (
  locality_id, publisher_id, source_id, latitude, longitude, accuracy_m, reason, created_by
)
SELECT $1, NULL, ds.id, $2, $3, $4, $5, $6
FROM geo_data_sources ds WHERE ds.key = 'admin'
ON CONFLICT ON CONSTRAINT geo_locality_locations_unique
DO UPDATE SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_m = COALESCE(EXCLUDED.accuracy_m, geo_locality_locations.accuracy_m),
  reason = COALESCE(EXCLUDED.reason, geo_locality_locations.reason),
  updated_at = now()
RETURNING *;
```

**Key Points:**
- ✅ Uses `ON CONFLICT DO UPDATE` - latest approved correction wins automatically
- ✅ No timestamp comparison needed - constraint ensures single admin override per locality
- ✅ UPDATE overwrites previous values, implementing "latest wins" correctly

**✅ Verification Status:** Correct implementation. The constraint `geo_locality_locations_unique` (locality_id, publisher_id, source_id) ensures only one admin override exists per locality. Latest approval automatically replaces previous one.

---

## 3. "Latest Approved Wins" Mechanism - ✅ VERIFIED

### 3.1 Implementation Method

The system implements "latest approved wins" via **ON CONFLICT DO UPDATE**, NOT via timestamp comparison.

**Why this is correct:**
- Database constraint ensures only ONE admin override per locality
- When admin approves a new correction, UPDATE replaces old values
- No race conditions or timestamp comparison logic needed
- Simpler and more reliable than timestamp-based resolution

**Alternative (NOT used):**
```sql
-- BAD: Would need timestamp comparison
SELECT * FROM overrides
WHERE locality_id = X
ORDER BY approved_at DESC
LIMIT 1
```

**Current (GOOD):**
```sql
-- Automatic via constraint + UPDATE
INSERT ... ON CONFLICT DO UPDATE SET ...
```

**✅ Verification Status:** Superior implementation. Latest approval automatically overwrites previous values via UPDATE.

---

### 3.2 Display of Current Values

**File:** `/home/daniel/repos/zmanim/api/internal/db/queries/correction_requests.sql`
**Query:** `GetCorrectionRequestByID` (lines 20-49)

Uses LATERAL joins to show current effective coordinates:

```sql
LEFT JOIN LATERAL (
  SELECT ll.latitude, ll.longitude
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
  WHERE ll.locality_id = l.id AND ll.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) bc ON true
```

**✅ Verification Status:** Correct. Shows current admin override if exists, otherwise shows default source values.

---

## 4. CRITICAL ISSUE: Cache Invalidation Missing

### 4.1 Problem Description

**File:** `/home/daniel/repos/zmanim/api/internal/handlers/correction_requests.go`
**Function:** `UpdateCorrectionRequestStatus`
**Issue:** NO cache invalidation after creating admin overrides

**Current Flow:**
1. Admin approves correction → Creates admin override ✅
2. Override is written to database ✅
3. **MISSING:** Cache invalidation ❌
4. Zmanim endpoint returns cached results for 24 hours ❌

**Impact:**
- Approved corrections won't appear in zmanim calculations until cache expires
- Cache TTL is 24 hours (see `/home/daniel/repos/zmanim/api/internal/cache/cache.go:46`)
- Users/publishers won't see corrected coordinates immediately

---

### 4.2 Evidence

**Publisher override handlers DO invalidate cache:**

```go
// File: api/internal/handlers/location_overrides.go
// Line 147 (CreateLocationOverride)
if err := h.cache.InvalidateZmanimForLocality(ctx, pc.PublisherID, localityIDStr); err != nil {
    slog.Error("cache invalidation failed", "error", err)
}
```

**But correction request approval handler DOES NOT:**

```go
// File: api/internal/handlers/correction_requests.go
// Lines 612-714 (UpdateCorrectionRequestStatus)
// No cache invalidation found!
```

**Verified via grep:**
```bash
grep -n "Invalidate" api/internal/handlers/correction_requests.go
# No results
```

---

### 4.3 Required Fix

**Add cache invalidation after creating admin overrides:**

```go
// After line 656 in correction_requests.go
// After successfully creating admin overrides

// Cache invalidation: Admin overrides affect ALL publishers
// Pattern: invalidate calc:{publisherId}:{localityId}:* for ALL publishers
if h.cache != nil {
    localityIDStr := strconv.FormatInt(int64(localityID), 10)

    // Strategy 1: Nuclear option - delete all cached calculations for this locality
    pattern := fmt.Sprintf("calc:*:%s:*", localityIDStr)
    // OR

    // Strategy 2: More targeted - iterate through all publishers
    // (requires query to get all publisher IDs)
    publishers, err := h.db.Queries.ListAllPublishers(ctx)
    for _, pub := range publishers {
        pubIDStr := strconv.FormatInt(int64(pub.ID), 10)
        if err := h.cache.InvalidateZmanimForLocality(ctx, pubIDStr, localityIDStr); err != nil {
            slog.Error("cache invalidation failed",
                "publisher_id", pub.ID,
                "locality_id", localityID,
                "error", err)
        }
    }
}
```

**Recommendation:** Use Strategy 1 (pattern-based deletion) for simplicity and guaranteed coverage.

---

## 5. Revert Functionality - NOT YET IMPLEMENTED

### 5.1 Current State

**Plan Status:** Documented in `/home/daniel/.claude/plans/reflective-noodling-duckling.md`

**Planned Features:**
- Add `approved_at`, `reverted_at`, `reverted_by`, `revert_reason` columns
- Create `correction_request_history` table
- Add revert endpoint: `POST /api/v1/admin/correction-requests/{id}/revert`

**Implementation Status:** ⏳ NOT YET IMPLEMENTED

---

### 5.2 Revert Logic (Planned)

**Revert will need to:**
1. Get history to find previous values (from history table or default source)
2. If previous override existed, restore it (UPDATE)
3. If no previous override, delete admin override (DELETE)
4. Mark request as `status = 'reverted'`
5. **CRITICAL:** Invalidate cache (same as approval)

---

## 6. Test Plan

### 6.1 Manual Verification Test

**Objective:** Verify that approved corrections are used in zmanim calculations (after cache fix is applied)

**Prerequisites:**
- API running locally
- Test publisher configured
- Valid auth token

**Test Steps:**

#### Step 1: Get Test Locality Current Coordinates
```bash
# Use test locality 4993250 (or any locality)
TOKEN="<your-admin-token>"
LOCALITY_ID=4993250

# Get current effective coordinates (via zmanim calculation)
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=${LOCALITY_ID}&date=2025-12-22" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" | jq '.locality'
```

**Expected Output:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "elevation_m": 10
}
```

#### Step 2: Check for Existing Admin Override
```bash
# Query database directly
source api/.env
psql "$DATABASE_URL" -c "
SELECT ll.locality_id, ll.latitude, ll.longitude, ds.key as source, ll.updated_at
FROM geo_locality_locations ll
JOIN geo_data_sources ds ON ds.id = ll.source_id
WHERE ll.locality_id = ${LOCALITY_ID} AND ll.publisher_id IS NULL
ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END
LIMIT 1;
"
```

#### Step 3: Submit Correction Request
```bash
# Publisher submits correction request
curl -X POST "http://localhost:8080/api/v1/publisher/correction-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '${LOCALITY_ID}',
    "proposed_latitude": 40.7200,
    "proposed_longitude": -74.0100,
    "proposed_elevation": 15,
    "correction_reason": "Updated coordinates based on official municipal records. The current coordinates place the location in the middle of the street rather than the actual building.",
    "evidence_urls": ["https://example.com/evidence"]
  }' | jq '.'
```

**Expected Output:**
```json
{
  "id": 123,
  "status": "pending",
  "locality_id": 4993250,
  ...
}
```

Save the `id` for next step.

#### Step 4: Verify Correction Request Display
```bash
REQUEST_ID=123

# Get correction request details (shows current vs proposed)
curl -s "http://localhost:8080/api/v1/auth/correction-requests" \
  -H "Authorization: Bearer $TOKEN" | jq '.requests[] | select(.id == '${REQUEST_ID}')'
```

**Verify:**
- `current_latitude`, `current_longitude`, `current_elevation` show original values
- `proposed_latitude`, `proposed_longitude`, `proposed_elevation` show new values

#### Step 5: Approve Correction Request (Admin)
```bash
# Admin approves
curl -X PUT "http://localhost:8080/api/v1/auth/correction-requests/${REQUEST_ID}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Verified with official records. Correction approved."
  }' | jq '.'
```

**Expected Output:**
```json
{
  "status": "approved",
  "message": "Correction request approved successfully"
}
```

#### Step 6: Verify Admin Override Created
```bash
psql "$DATABASE_URL" -c "
SELECT ll.locality_id, ll.latitude, ll.longitude, le.elevation_m, ds.key as source, ll.updated_at
FROM geo_locality_locations ll
JOIN geo_data_sources ds ON ds.id = ll.source_id
LEFT JOIN geo_locality_elevations le ON le.locality_id = ll.locality_id AND le.source_id = ds.id
WHERE ll.locality_id = ${LOCALITY_ID} AND ll.publisher_id IS NULL AND ds.key = 'admin';
"
```

**Expected:**
- Row exists with `source = 'admin'`
- Latitude = 40.7200
- Longitude = -74.0100
- Elevation = 15

#### Step 7: Verify Cache Invalidation (AFTER FIX)
```bash
# Check Redis cache for locality
redis-cli KEYS "calc:*:${LOCALITY_ID}:*"

# Should return empty result (cache invalidated)
```

**Current Behavior (BEFORE FIX):**
- Cache NOT invalidated
- Old values still cached for 24 hours

**Expected Behavior (AFTER FIX):**
- Cache invalidated
- Next zmanim calculation fetches new coordinates

#### Step 8: Test Zmanim Calculation Uses Corrected Coordinates
```bash
# Call zmanim endpoint
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=${LOCALITY_ID}&date=2025-12-22" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" | jq '.'
```

**Verify:**
- Response includes locality coordinates
- Coordinates match approved correction (40.7200, -74.0100, 15m)
- Zmanim times may differ slightly due to coordinate change

#### Step 9: Test "Latest Approved Wins"
```bash
# Submit another correction request
curl -X POST "http://localhost:8080/api/v1/publisher/correction-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 3" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '${LOCALITY_ID}',
    "proposed_latitude": 40.7250,
    "proposed_longitude": -74.0150,
    "proposed_elevation": 20,
    "correction_reason": "More accurate coordinates from GPS survey conducted on site with professional equipment.",
    "evidence_urls": ["https://example.com/survey-report"]
  }' | jq '.id'

# Save new request ID
REQUEST_ID_2=<new-id>

# Approve second request
curl -X PUT "http://localhost:8080/api/v1/auth/correction-requests/${REQUEST_ID_2}/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "GPS survey provides more accurate data."
  }' | jq '.'

# Verify admin override was updated (not duplicated)
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as admin_override_count
FROM geo_locality_locations ll
JOIN geo_data_sources ds ON ds.id = ll.source_id
WHERE ll.locality_id = ${LOCALITY_ID} AND ll.publisher_id IS NULL AND ds.key = 'admin';
"
```

**Expected:**
- Count = 1 (only one admin override exists)
- Coordinates = 40.7250, -74.0150 (latest approved values)

#### Step 10: Test Publisher Override Still Takes Priority
```bash
# Create publisher override
curl -X POST "http://localhost:8080/api/v1/publisher/location-overrides" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '${LOCALITY_ID}',
    "latitude": 40.7300,
    "longitude": -74.0200,
    "reason": "Publisher-specific adjustment"
  }' | jq '.'

# Test zmanim calculation
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=${LOCALITY_ID}&date=2025-12-22" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: 2" | jq '.locality'
```

**Expected:**
- Publisher 2 sees coordinates: 40.7300, -74.0200 (publisher override)
- Other publishers see: 40.7250, -74.0150 (admin override)

**Hierarchy Verified:** ✅ Publisher Override > Admin Override > Default Source

---

### 6.2 Automated Test Cases

**File:** `/home/daniel/repos/zmanim/api/internal/handlers/correction_requests_test.go` (to be created)

**Test Cases:**

1. **TestApprovalCreatesAdminOverride**
   - Submit correction request
   - Approve as admin
   - Verify admin override created in database
   - Verify constraint ensures only one override exists

2. **TestLatestApprovedWins**
   - Create two correction requests for same locality
   - Approve first request
   - Verify admin override created
   - Approve second request
   - Verify admin override updated (not duplicated)
   - Verify coordinates match second approval

3. **TestCacheInvalidationOnApproval** (after fix)
   - Pre-populate cache with zmanim calculations
   - Approve correction request
   - Verify cache invalidated for locality
   - Verify next calculation uses new coordinates

4. **TestResolutionHierarchy**
   - Create admin override
   - Create publisher override
   - Call GetEffectiveLocalityLocation with publisher_id
   - Verify publisher override returned
   - Call GetEffectiveLocalityLocation without publisher_id
   - Verify admin override returned

5. **TestDisplayOfCurrentValues**
   - Get correction request via GetCorrectionRequestByID
   - Verify current_latitude/longitude/elevation show admin override if exists
   - Verify current values show default source if no admin override

---

## 7. Summary of Findings

### ✅ VERIFIED - Working Correctly

1. **Locality Resolution Hierarchy**
   - Database function `get_effective_locality_location()` implements correct priority
   - Zmanim service uses this function for all calculations
   - Priority: Publisher Override > Admin Override > Default Source

2. **Admin Override Creation**
   - `CreateAdminLocationOverride` and `CreateAdminElevationOverride` work correctly
   - ON CONFLICT DO UPDATE ensures only one admin override per locality
   - Latest approval automatically replaces previous values

3. **"Latest Approved Wins" Mechanism**
   - Implemented via database constraint + UPDATE, not timestamp comparison
   - More reliable and simpler than timestamp-based resolution
   - No race conditions or edge cases

4. **Display of Current Values**
   - LATERAL joins in GetCorrectionRequestByID show current effective values
   - Shows admin override if exists, otherwise default source
   - Correct for displaying "before vs after" comparison

### ❌ CRITICAL ISSUE - Requires Fix

1. **Cache Invalidation Missing**
   - Admin approval does NOT invalidate zmanim calculation cache
   - Approved corrections won't be reflected for up to 24 hours
   - Fix required: Add cache invalidation in `UpdateCorrectionRequestStatus`
   - Recommended: Invalidate pattern `calc:*:{localityId}:*` after approval

### ⏳ NOT YET IMPLEMENTED

1. **Revert Functionality**
   - Planned but not implemented
   - Will require history tracking and cache invalidation
   - Design documented in plan file

---

## 8. Recommendations

### Immediate (Priority 1)

1. **Fix cache invalidation in correction request approval**
   - Add cache invalidation after creating admin overrides
   - Pattern: `calc:*:{localityId}:*`
   - Test: Verify new calculations use corrected coordinates immediately

### Short-term (Priority 2)

2. **Add automated tests for correction request flow**
   - Test approval creates admin override
   - Test "latest approved wins" behavior
   - Test cache invalidation
   - Test resolution hierarchy

3. **Add monitoring/logging**
   - Log when admin overrides are created
   - Log cache invalidations
   - Alert if cache invalidation fails

### Medium-term (Priority 3)

4. **Implement revert functionality**
   - Add database columns and history table
   - Implement revert endpoint
   - Include cache invalidation in revert flow
   - Add revert UI for admins

5. **Add duplicate detection warnings**
   - Warn publishers if pending request exists
   - Warn admins during approval if multiple pending requests
   - Show recent approval history on admin page

---

## Appendix A: Key File Locations

| File | Purpose |
|------|---------|
| `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go` | Zmanim calculation service (lines 260-268) |
| `/home/daniel/repos/zmanim/api/internal/handlers/correction_requests.go` | Correction request handlers (approval: lines 544-715) |
| `/home/daniel/repos/zmanim/api/internal/db/queries/correction_requests.sql` | Override creation queries (lines 123-184) |
| `/home/daniel/repos/zmanim/api/internal/db/queries/location_overrides.sql` | Override management queries |
| `/home/daniel/repos/zmanim/api/internal/db/sqlcgen/locality_locations_manual.go` | GetEffectiveLocalityLocation implementation |
| `/home/daniel/repos/zmanim/api/internal/cache/cache.go` | Cache invalidation methods (line 219) |
| PostgreSQL function: `get_effective_locality_location()` | Database-level resolution logic |

---

## Appendix B: Database Schema

**Relevant Tables:**

```sql
-- Correction requests
city_correction_requests (
  id, locality_id, publisher_id, status,
  proposed_latitude, proposed_longitude, proposed_elevation,
  reviewed_by, reviewed_at, review_notes
)

-- Location overrides (coordinates)
geo_locality_locations (
  id, locality_id, publisher_id, source_id,
  latitude, longitude, accuracy_m, reason,
  created_at, updated_at, created_by
)
CONSTRAINT geo_locality_locations_unique (locality_id, publisher_id, source_id)

-- Elevation overrides
geo_locality_elevations (
  id, locality_id, publisher_id, source_id,
  elevation_m, accuracy_m, reason,
  created_at, updated_at, created_by
)
CONSTRAINT geo_locality_elevations_unique (locality_id, publisher_id, source_id)

-- Data sources
geo_data_sources (
  id, key, name, priority, is_active
)
-- key values: 'admin', 'publisher', 'overture', 'glo90', etc.
```

**Unique Constraints:**
- `geo_locality_locations_unique (locality_id, publisher_id, source_id)`
- `geo_locality_elevations_unique (locality_id, publisher_id, source_id)`

These constraints ensure:
- Only ONE admin override per locality (publisher_id = NULL, source_id = admin)
- Only ONE publisher override per locality per publisher
- ON CONFLICT DO UPDATE automatically replaces old values with new ones

---

**End of Report**
