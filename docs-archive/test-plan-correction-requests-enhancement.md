# Test Plan: Correction Requests Enhancement

**Feature:** Duplicate Warnings, History Tracking, and Revert Functionality
**Plan Reference:** `/home/daniel/.claude/plans/reflective-noodling-duckling.md`
**Date:** 2025-12-22
**Status:** Ready for Testing

---

## Overview

This test plan covers the comprehensive testing of the correction requests enhancement, which adds:

1. **Publisher Duplicate Warning** - Warn publishers when other publishers have pending requests for the same locality
2. **Admin Conflict Warning** - Warn admins when approving a request if other pending requests exist
3. **History Tracking** - Show history of all approved/reverted corrections on admin page
4. **Revert Functionality** - Enable revert to restore previous values
5. **Latest Approved Wins** - Ensure the most recently approved correction takes precedence
6. **Cache Invalidation** - Verify that zmanim calculations use updated coordinates after corrections

---

## Prerequisites

### Services Running
```bash
./restart.sh  # Start all services (API, Web, Redis, PostgreSQL)
tmux attach -t zmanim  # View logs (optional)
```

### Test Data Requirements
- At least 2 publisher accounts with verified status
- At least 1 admin account
- Sample locality IDs (examples from database):
  - `4993250` (common test locality)
  - `13523639` (São Sebastião)
  - `13523640` (Sao Domigos I)

### Authentication Setup
Get test tokens for API testing:
```bash
# Step 1: Get JWT token (copy the eyJ... token from output)
source api/.env && node scripts/get-test-token.js

# Step 2: Set environment variables for testing
export ADMIN_TOKEN="eyJhbG..."  # Paste admin token
export PUBLISHER_1_TOKEN="eyJhbG..."  # Paste publisher 1 token
export PUBLISHER_2_TOKEN="eyJhbG..."  # Paste publisher 2 token
export PUBLISHER_1_ID="2"  # Set publisher ID
export PUBLISHER_2_ID="3"  # Set publisher ID
export TEST_LOCALITY_ID="4993250"  # Sample locality
```

---

## Test Scenarios

### Scenario 1: Publisher Duplicate Warning

**Objective:** Verify that publishers see a warning when other publishers have pending requests for the same locality.

#### Setup
1. Ensure no pending correction requests exist for test locality
2. Prepare two publisher accounts (Publisher A and Publisher B)

#### Steps

**Step 1.1: Publisher A submits a correction request**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/correction-requests \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '$TEST_LOCALITY_ID',
    "proposed_latitude": 32.0853,
    "proposed_longitude": 34.7818,
    "proposed_elevation": 50,
    "correction_reason": "Updated coordinates based on recent survey data from municipal records",
    "evidence_urls": ["https://example.com/survey-2024.pdf"]
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Response contains correction request with `status: "pending"`
- `id` field returned (save this as `$REQUEST_1_ID`)

**Step 1.2: Publisher B checks for duplicates before submitting**
```bash
curl -s http://localhost:8080/api/v1/publisher/correction-requests/check-duplicates?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $PUBLISHER_2_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_2_ID" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array containing Publisher A's pending request
- Response includes: `id`, `locality_id`, `publisher_id`, `status: "pending"`, `publisher_name`
- Warning should be displayed in UI: "There is 1 pending request for this locality from other publishers"

**Step 1.3: Publisher B submits their own correction request (not blocked)**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/correction-requests \
  -H "Authorization: Bearer $PUBLISHER_2_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_2_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '$TEST_LOCALITY_ID',
    "proposed_latitude": 32.0855,
    "proposed_longitude": 34.7820,
    "proposed_elevation": 48,
    "correction_reason": "Coordinates verified using GPS measurement on-site with professional equipment",
    "evidence_urls": ["https://example.com/gps-data.json"]
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Response contains correction request with `status: "pending"`
- Publisher B can submit despite Publisher A's pending request (warning, not blocking)

**Step 1.4: Verify both requests are now shown in duplicate check**
```bash
curl -s http://localhost:8080/api/v1/publisher/correction-requests/check-duplicates?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains 2 pending requests
- Both Publisher A and Publisher B's requests are listed

#### Verification
- [ ] Publisher sees warning when other pending requests exist
- [ ] Publisher can still submit despite warning (not blocked)
- [ ] Duplicate check API returns all pending requests for the locality
- [ ] UI displays appropriate warning message with count

---

### Scenario 2: Admin Conflict Warning

**Objective:** Verify that admins see a warning when approving a request if multiple pending requests exist.

#### Setup
1. Continue from Scenario 1 (2 pending requests for the same locality)
2. Admin account authenticated

#### Steps

**Step 2.1: Admin fetches all pending correction requests**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests?status=pending \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains both pending requests from Scenario 1
- Each request shows `locality_name`, `publisher_name`, `current_latitude`, `current_longitude`, `current_elevation`

**Step 2.2: Admin checks for conflicts before approving Request 1**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/check-duplicates?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains 2 pending requests
- Warning should be displayed in UI: "There are 2 pending requests for this locality"

**Step 2.3: Admin approves Publisher A's request**
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Coordinates verified against municipal records"
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Response includes:
  - `status: "approved"`
  - `approved_at` timestamp
  - `warning` field (optional) indicating other pending requests exist
  - `conflicting_request_ids` array (optional) with Publisher B's request ID

**Step 2.4: Verify Publisher B's request still pending**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests?status=pending \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains only Publisher B's request
- Publisher A's request no longer in pending list

**Step 2.5: Check duplicate status after approval**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/check-duplicates?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains 2 requests:
  - Publisher A's request with `status: "approved"` and `approved_at` timestamp
  - Publisher B's request with `status: "pending"`
- Requests ordered by status (pending first, then approved)

#### Verification
- [ ] Admin sees warning about multiple pending requests
- [ ] Admin can approve despite conflicts
- [ ] Approval response includes warning/conflict information
- [ ] Other pending requests remain pending after one is approved
- [ ] UI displays conflict warning with list of other pending requests

---

### Scenario 3: History Tracking

**Objective:** Verify that approved corrections are tracked in history with before/after values.

#### Setup
1. Continue from Scenario 2 (one approved request)
2. Admin account authenticated

#### Steps

**Step 3.1: Fetch correction history for the locality**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/history?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains at least 1 history record for the approved correction
- History record includes:
  - `correction_request_id`: ID of the approved request
  - `locality_id`: Test locality ID
  - `action: "approved"`
  - `performed_by`: Admin user ID
  - `performed_at`: Timestamp
  - `previous_latitude`, `previous_longitude`, `previous_elevation`: Original values
  - `new_latitude`, `new_longitude`, `new_elevation`: Corrected values
  - `notes`: Review notes from approval

**Step 3.2: Fetch history for specific correction request**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID/history \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains history records for this specific request
- Shows the approval action with all details

**Step 3.3: Verify admin override was created**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    ll.locality_id,
    ll.latitude,
    ll.longitude,
    ds.key as source_key,
    ll.reason,
    ll.created_by
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id
  WHERE ll.locality_id = $TEST_LOCALITY_ID
    AND ll.publisher_id IS NULL
    AND ds.key = 'admin'
  ORDER BY ll.updated_at DESC
  LIMIT 1;
"
```

**Expected Result:**
- Row returned with:
  - `latitude` and `longitude` matching approved correction values
  - `source_key: "admin"`
  - `reason`: Contains reference to correction request
  - `created_by`: Admin user ID

**Step 3.4: Verify elevation override was created**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    le.locality_id,
    le.elevation_m,
    ds.key as source_key,
    le.reason,
    le.created_by
  FROM geo_locality_elevations le
  JOIN geo_data_sources ds ON ds.id = le.source_id
  WHERE le.locality_id = $TEST_LOCALITY_ID
    AND le.publisher_id IS NULL
    AND ds.key = 'admin'
  ORDER BY le.updated_at DESC
  LIMIT 1;
"
```

**Expected Result:**
- Row returned with:
  - `elevation_m` matching approved correction value
  - `source_key: "admin"`
  - `reason`: Contains reference to correction request
  - `created_by`: Admin user ID

#### Verification
- [ ] History record created when correction is approved
- [ ] History contains before and after values
- [ ] History shows performer and timestamp
- [ ] Admin overrides created in geo_locality_locations table
- [ ] Admin overrides created in geo_locality_elevations table
- [ ] UI History tab displays all approved corrections
- [ ] All fields displayed correctly in UI

---

### Scenario 4: Revert Functionality

**Objective:** Verify that admins can revert approved corrections and restore previous values.

#### Setup
1. Continue from Scenario 3 (one approved correction with history)
2. Admin account authenticated

#### Steps

**Step 4.1: Get current locality coordinates (after correction)**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    l.id,
    l.name,
    ll.latitude,
    ll.longitude,
    le.elevation_m
  FROM geo_localities l
  LEFT JOIN LATERAL (
    SELECT ll2.latitude, ll2.longitude
    FROM geo_locality_locations ll2
    JOIN geo_data_sources ds ON ds.id = ll2.source_id AND ds.is_active = true
    WHERE ll2.locality_id = l.id AND ll2.publisher_id IS NULL
    ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
    LIMIT 1
  ) ll ON true
  LEFT JOIN LATERAL (
    SELECT le2.elevation_m
    FROM geo_locality_elevations le2
    JOIN geo_data_sources ds ON ds.id = le2.source_id AND ds.is_active = true
    WHERE le2.locality_id = l.id AND le2.publisher_id IS NULL
    ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
    LIMIT 1
  ) le ON true
  WHERE l.id = $TEST_LOCALITY_ID;
"
```

**Expected Result:**
- Coordinates match the approved correction values (32.0853, 34.7818, 50m)

**Step 4.2: Calculate zmanim with corrected coordinates**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Zmanim calculated using corrected coordinates (32.0853, 34.7818, 50m)
- Save sample zman time (e.g., sunrise time) for comparison

**Step 4.3: Revert the approved correction**
```bash
curl -X POST http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID/revert \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revert_reason": "Correction reverted due to conflicting data from newer survey"
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Response confirms revert success
- Correction request status changed to "reverted"

**Step 4.4: Verify correction request status updated**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- `status: "reverted"`
- `reverted_at`: Timestamp
- `reverted_by`: Admin user ID
- `revert_reason`: "Correction reverted due to conflicting data from newer survey"

**Step 4.5: Verify revert history record created**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID/history \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Array contains 2 history records:
  1. Original approval action
  2. New revert action with:
     - `action: "reverted"`
     - `performed_by`: Admin user ID
     - `performed_at`: Recent timestamp
     - `previous_latitude`, `previous_longitude`, `previous_elevation`: Corrected values
     - `new_latitude`, `new_longitude`, `new_elevation`: Original values (restored)
     - `notes`: Revert reason

**Step 4.6: Verify admin override was deleted or restored**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    ll.locality_id,
    ll.latitude,
    ll.longitude,
    ds.key as source_key
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id
  WHERE ll.locality_id = $TEST_LOCALITY_ID
    AND ll.publisher_id IS NULL
  ORDER BY
    CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
    ds.priority
  LIMIT 1;
"
```

**Expected Result:**
- Either:
  - Admin override deleted (falls back to default source)
  - OR admin override restored to previous values (if there was a prior admin override)

**Step 4.7: Calculate zmanim after revert**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Zmanim calculated using original coordinates (before correction)
- Sample zman time (e.g., sunrise) should differ from Step 4.2 result

**Step 4.8: Verify cannot revert again (already reverted)**
```bash
curl -X POST http://localhost:8080/api/v1/admin/correction-requests/$REQUEST_1_ID/revert \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revert_reason": "Attempting second revert"
  }' | jq '.'
```

**Expected Result:**
- HTTP 400 Bad Request or 409 Conflict
- Error message: "Correction request is not in approved status" or similar

#### Verification
- [ ] Admin can revert approved correction
- [ ] Correction request status changes to "reverted"
- [ ] Revert history record created with before/after values
- [ ] Admin override deleted or restored to previous values
- [ ] Zmanim calculations use original coordinates after revert
- [ ] Cannot revert already-reverted request
- [ ] UI displays revert button only for approved corrections
- [ ] UI shows revert confirmation dialog with reason input

---

### Scenario 5: Cache Invalidation

**Objective:** Verify that zmanim cache is invalidated when corrections are approved or reverted.

#### Setup
1. Fresh locality with no corrections
2. Publisher account authenticated

#### Steps

**Step 5.1: Calculate zmanim (cache miss, will cache result)**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.data[] | select(.key == "sunrise") | .time'
```

**Expected Result:**
- HTTP 200 OK
- Sunrise time calculated using original coordinates
- Save this time as `$ORIGINAL_SUNRISE`

**Step 5.2: Calculate again (cache hit, same result)**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.data[] | select(.key == "sunrise") | .time'
```

**Expected Result:**
- HTTP 200 OK (cache hit)
- Same sunrise time as Step 5.1

**Step 5.3: Publisher submits correction with different coordinates**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/correction-requests \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '$TEST_LOCALITY_ID',
    "proposed_latitude": 31.7683,
    "proposed_longitude": 35.2137,
    "proposed_elevation": 750,
    "correction_reason": "Correcting to Jerusalem coordinates for significant timezone difference test",
    "evidence_urls": []
  }' | jq '.id'
```

**Expected Result:**
- HTTP 200 OK
- Save request ID as `$CORRECTION_REQUEST_ID`

**Step 5.4: Admin approves the correction**
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/correction-requests/$CORRECTION_REQUEST_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Approved for cache invalidation test"
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Correction approved

**Step 5.5: Calculate zmanim immediately after approval (cache should be invalidated)**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.data[] | select(.key == "sunrise") | .time'
```

**Expected Result:**
- HTTP 200 OK
- Sunrise time calculated using NEW coordinates (31.7683, 35.2137, 750m)
- Time should differ from `$ORIGINAL_SUNRISE` (Jerusalem has different sunrise than original location)

**Step 5.6: Verify cache invalidation via Redis**
```bash
redis-cli -h redis KEYS "*zmanim*locality:$TEST_LOCALITY_ID*"
```

**Expected Result:**
- Empty result or no keys for the specific date/locality combination
- OR new cache key with updated timestamp (depends on implementation)

**Step 5.7: Revert the correction**
```bash
curl -X POST http://localhost:8080/api/v1/admin/correction-requests/$CORRECTION_REQUEST_ID/revert \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revert_reason": "Reverting for cache test"
  }' | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Correction reverted

**Step 5.8: Calculate zmanim after revert (cache should be invalidated again)**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.data[] | select(.key == "sunrise") | .time'
```

**Expected Result:**
- HTTP 200 OK
- Sunrise time back to original value (same as `$ORIGINAL_SUNRISE`)
- Confirms cache was invalidated on revert

#### Verification
- [ ] Zmanim cached on first calculation
- [ ] Cache hit on subsequent calculation (same result)
- [ ] Cache invalidated when correction approved
- [ ] New coordinates used immediately after approval
- [ ] Cache invalidated when correction reverted
- [ ] Original coordinates used immediately after revert
- [ ] Redis keys properly cleared or updated

---

### Scenario 6: Latest Approved Wins

**Objective:** Verify that when multiple corrections are approved for the same locality, the latest approval takes precedence.

#### Setup
1. Fresh locality or cleaned up from previous tests
2. Two publisher accounts
3. Admin account

#### Steps

**Step 6.1: Publisher A submits Correction A (latitude 32.0)**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/correction-requests \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '$TEST_LOCALITY_ID',
    "proposed_latitude": 32.0,
    "proposed_longitude": 34.78,
    "correction_reason": "First correction with latitude 32.0",
    "evidence_urls": []
  }' | jq '.id'
```

**Expected Result:**
- HTTP 200 OK
- Save as `$CORRECTION_A_ID`

**Step 6.2: Publisher B submits Correction B (latitude 32.1)**
```bash
curl -X POST http://localhost:8080/api/v1/publisher/correction-requests \
  -H "Authorization: Bearer $PUBLISHER_2_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_2_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "locality_id": '$TEST_LOCALITY_ID',
    "proposed_latitude": 32.1,
    "proposed_longitude": 34.78,
    "correction_reason": "Second correction with latitude 32.1",
    "evidence_urls": []
  }' | jq '.id'
```

**Expected Result:**
- HTTP 200 OK
- Save as `$CORRECTION_B_ID`

**Step 6.3: Admin approves Correction A**
```bash
curl -X PATCH http://localhost:8080/api/v1/admin/correction-requests/$CORRECTION_A_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Approving first correction"
  }' | jq '.approved_at'
```

**Expected Result:**
- HTTP 200 OK
- `approved_at` timestamp saved as `$APPROVAL_A_TIME`

**Step 6.4: Verify locality uses latitude 32.0**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    ll.latitude,
    ll.longitude,
    ds.key as source_key
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id
  WHERE ll.locality_id = $TEST_LOCALITY_ID
    AND ll.publisher_id IS NULL
    AND ds.key = 'admin'
  LIMIT 1;
"
```

**Expected Result:**
- `latitude: 32.0`
- `longitude: 34.78`
- `source_key: "admin"`

**Step 6.5: Wait 2 seconds, then admin approves Correction B**
```bash
sleep 2
curl -X PATCH http://localhost:8080/api/v1/admin/correction-requests/$CORRECTION_B_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "review_notes": "Approving second correction (should override first)"
  }' | jq '.approved_at'
```

**Expected Result:**
- HTTP 200 OK
- `approved_at` timestamp saved as `$APPROVAL_B_TIME`
- `$APPROVAL_B_TIME` should be later than `$APPROVAL_A_TIME`

**Step 6.6: Verify locality now uses latitude 32.1 (latest wins)**
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    ll.locality_id,
    ll.latitude,
    ll.longitude,
    ds.key as source_key,
    ll.updated_at
  FROM geo_locality_locations ll
  JOIN geo_data_sources ds ON ds.id = ll.source_id
  WHERE ll.locality_id = $TEST_LOCALITY_ID
    AND ll.publisher_id IS NULL
    AND ds.key = 'admin'
  LIMIT 1;
"
```

**Expected Result:**
- `latitude: 32.1` (NOT 32.0)
- `longitude: 34.78`
- `source_key: "admin"`
- `updated_at` matches Correction B approval time

**Step 6.7: Verify both corrections in history**
```bash
curl -s http://localhost:8080/api/v1/admin/correction-requests/history?locality_id=$TEST_LOCALITY_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq 'length'
```

**Expected Result:**
- HTTP 200 OK
- At least 2 history records (both approvals)
- Latest record shows Correction B (latitude 32.1)
- Earlier record shows Correction A (latitude 32.0)

**Step 6.8: Calculate zmanim to confirm latitude 32.1 is used**
```bash
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=$TEST_LOCALITY_ID&date=2025-12-25" \
  -H "Authorization: Bearer $PUBLISHER_1_TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_1_ID" | jq '.'
```

**Expected Result:**
- HTTP 200 OK
- Zmanim calculated using latitude 32.1 (latest approved value)

#### Verification
- [ ] Multiple corrections can be approved for same locality
- [ ] Latest approved correction takes precedence (ON CONFLICT UPDATE works)
- [ ] Database stores only the most recent correction
- [ ] History shows all approvals in chronological order
- [ ] Zmanim calculations use latest approved coordinates
- [ ] UI shows warning when approving if newer approvals exist

---

## API Endpoints Reference

### Publisher Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/publisher/correction-requests` | Submit new correction request |
| GET | `/api/v1/publisher/correction-requests` | List own correction requests |
| GET | `/api/v1/publisher/correction-requests/check-duplicates?locality_id={id}` | Check for existing requests |
| PATCH | `/api/v1/publisher/correction-requests/{id}` | Update pending request |
| DELETE | `/api/v1/publisher/correction-requests/{id}` | Delete pending request |

### Admin Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/correction-requests` | List all correction requests |
| GET | `/api/v1/admin/correction-requests?status={status}` | Filter by status |
| GET | `/api/v1/admin/correction-requests/{id}` | Get single request |
| PATCH | `/api/v1/admin/correction-requests/{id}` | Approve/reject request |
| POST | `/api/v1/admin/correction-requests/{id}/revert` | Revert approved correction |
| GET | `/api/v1/admin/correction-requests/history?locality_id={id}` | Get locality history |
| GET | `/api/v1/admin/correction-requests/{id}/history` | Get request history |
| GET | `/api/v1/admin/correction-requests/check-duplicates?locality_id={id}` | Check for duplicates |

### Public Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/publisher/zmanim?locality_id={id}&date={date}` | Calculate zmanim |

---

## Database Verification Steps

### Check Correction Request Status
```sql
SELECT
  id,
  locality_id,
  publisher_id,
  status,
  approved_at,
  reverted_at,
  created_at
FROM city_correction_requests
WHERE locality_id = <test_locality_id>
ORDER BY created_at DESC;
```

### Check Admin Overrides (Coordinates)
```sql
SELECT
  ll.locality_id,
  ll.latitude,
  ll.longitude,
  ds.key as source_key,
  ll.reason,
  ll.created_by,
  ll.created_at,
  ll.updated_at
FROM geo_locality_locations ll
JOIN geo_data_sources ds ON ds.id = ll.source_id
WHERE ll.locality_id = <test_locality_id>
  AND ll.publisher_id IS NULL
ORDER BY
  CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
  ds.priority;
```

### Check Admin Overrides (Elevation)
```sql
SELECT
  le.locality_id,
  le.elevation_m,
  ds.key as source_key,
  le.reason,
  le.created_by,
  le.created_at,
  le.updated_at
FROM geo_locality_elevations le
JOIN geo_data_sources ds ON ds.id = le.source_id
WHERE le.locality_id = <test_locality_id>
  AND le.publisher_id IS NULL
ORDER BY
  CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
  ds.priority;
```

### Check History Records
```sql
SELECT
  id,
  correction_request_id,
  locality_id,
  action,
  performed_by,
  performed_at,
  previous_latitude,
  previous_longitude,
  previous_elevation,
  new_latitude,
  new_longitude,
  new_elevation,
  notes
FROM correction_request_history
WHERE locality_id = <test_locality_id>
ORDER BY performed_at DESC;
```

### Check Current Resolved Coordinates
```sql
SELECT
  l.id,
  l.name,
  ll.latitude,
  ll.longitude,
  le.elevation_m,
  ds_loc.key as location_source,
  ds_elev.key as elevation_source
FROM geo_localities l
LEFT JOIN LATERAL (
  SELECT ll2.latitude, ll2.longitude, ll2.source_id
  FROM geo_locality_locations ll2
  JOIN geo_data_sources ds ON ds.id = ll2.source_id AND ds.is_active = true
  WHERE ll2.locality_id = l.id AND ll2.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) ll ON true
LEFT JOIN geo_data_sources ds_loc ON ds_loc.id = ll.source_id
LEFT JOIN LATERAL (
  SELECT le2.elevation_m, le2.source_id
  FROM geo_locality_elevations le2
  JOIN geo_data_sources ds ON ds.id = le2.source_id AND ds.is_active = true
  WHERE le2.locality_id = l.id AND le2.publisher_id IS NULL
  ORDER BY CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END, ds.priority
  LIMIT 1
) le ON true
LEFT JOIN geo_data_sources ds_elev ON ds_elev.id = le.source_id
WHERE l.id = <test_locality_id>;
```

---

## Cache Verification Steps

### Check Redis for Zmanim Cache Keys
```bash
# List all zmanim cache keys
redis-cli -h redis KEYS "*zmanim*"

# List cache keys for specific locality
redis-cli -h redis KEYS "*locality:<locality_id>*"

# Get cache key value
redis-cli -h redis GET "zmanim:locality:<locality_id>:publisher:<publisher_id>:date:<date>"

# Check TTL on cache key
redis-cli -h redis TTL "zmanim:locality:<locality_id>:publisher:<publisher_id>:date:<date>"

# Flush all cache (for testing)
redis-cli -h redis FLUSHDB
```

---

## Test Data Cleanup

### Clean Up Test Correction Requests
```sql
-- Delete correction requests for test locality
DELETE FROM city_correction_requests
WHERE locality_id IN (4993250, 13523639, 13523640);

-- Delete admin overrides created during testing
DELETE FROM geo_locality_locations
WHERE locality_id IN (4993250, 13523639, 13523640)
  AND publisher_id IS NULL
  AND source_id = (SELECT id FROM geo_data_sources WHERE key = 'admin');

DELETE FROM geo_locality_elevations
WHERE locality_id IN (4993250, 13523639, 13523640)
  AND publisher_id IS NULL
  AND source_id = (SELECT id FROM geo_data_sources WHERE key = 'admin');

-- Clear cache
TRUNCATE TABLE correction_request_history;
```

### Reset Database to Clean State
```bash
# Flush Redis cache
redis-cli -h redis FLUSHDB

# Restart services
./restart.sh
```

---

## Known Limitations and Notes

### Prerequisites
1. **Services must be running:** API, Web, PostgreSQL, Redis via `./restart.sh`
2. **Database migrations:** The `20251223000000_correction_request_enhancements.sql` migration must be applied
3. **Test users:** At least 2 publisher accounts and 1 admin account required
4. **Shell limitation:** Command substitution `$()` causes "Exit code 2" - use manual token copy/paste

### Test Environment Considerations
1. **Token expiry:** JWT tokens expire after 30 minutes by default. Re-run `get-test-token.js` if expired.
2. **Cache timing:** Cache invalidation is synchronous but allow 1-2 seconds for propagation in tests.
3. **Timestamp precision:** PostgreSQL timestamps use microsecond precision; allow small differences when comparing.
4. **Concurrent testing:** Run tests sequentially to avoid race conditions on same locality.

### Business Rules
1. **Publisher scope:** Publishers see warnings for ALL pending requests (global scope, not just their own)
2. **Admin override precedence:** Admin source always wins over default source (Overture/OSM)
3. **Latest wins:** ON CONFLICT UPDATE ensures latest approved correction overwrites previous
4. **History immutability:** History records are append-only, never modified or deleted
5. **Revert behavior:** Revert deletes admin override (falls back to default source) unless a prior admin override existed

### Edge Cases to Test
1. **No previous override:** Revert should delete admin override, fall back to Overture/OSM
2. **Multiple sequential approvals:** Each approval should update the same admin override row (ON CONFLICT)
3. **Partial corrections:** Correction request may have only latitude, only longitude, or only elevation
4. **Concurrent approvals:** Two admins approve different requests simultaneously (rare, handled by database transaction)
5. **Locality deleted:** Foreign key keeps history intact even if locality is deleted

---

## Success Criteria

### Functional Requirements
- [ ] Publishers receive duplicate warnings but are not blocked from submitting
- [ ] Admins receive conflict warnings when multiple pending requests exist
- [ ] History is created for all approved corrections with before/after values
- [ ] Admins can revert approved corrections to restore previous values
- [ ] Latest approved correction always takes precedence
- [ ] Cache is invalidated on approval and revert

### Data Integrity
- [ ] Admin overrides created in `geo_locality_locations` table
- [ ] Admin overrides created in `geo_locality_elevations` table
- [ ] History records created in `correction_request_history` table
- [ ] Correction request status updated correctly (pending → approved/rejected/reverted)
- [ ] Timestamps (`approved_at`, `reverted_at`) set correctly

### API Behavior
- [ ] All endpoints return correct HTTP status codes
- [ ] Response payloads match expected format
- [ ] Validation errors return 400 with details
- [ ] Authorization enforced (401/403 for unauthorized)
- [ ] IDOR prevention (publishers can't access others' requests)

### UI Behavior
- [ ] Duplicate warning displayed in publisher correction dialog
- [ ] Conflict warning displayed in admin approval dialog
- [ ] History tab shows all approved/reverted corrections
- [ ] Revert button only visible for approved corrections
- [ ] Revert dialog requires reason input
- [ ] Success/error toasts displayed appropriately

### Performance
- [ ] Duplicate check query uses index on `(locality_id, status)`
- [ ] History query uses index on `locality_id` and `performed_at`
- [ ] Cache invalidation completes within 1 second
- [ ] No N+1 queries in list endpoints

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Services running via `./restart.sh`
- [ ] Database migrations applied
- [ ] Test users created (2 publishers, 1 admin)
- [ ] JWT tokens obtained and exported as environment variables
- [ ] Test locality IDs identified
- [ ] Redis cache cleared

### Test Execution
- [ ] Scenario 1: Publisher Duplicate Warning (PASS/FAIL)
- [ ] Scenario 2: Admin Conflict Warning (PASS/FAIL)
- [ ] Scenario 3: History Tracking (PASS/FAIL)
- [ ] Scenario 4: Revert Functionality (PASS/FAIL)
- [ ] Scenario 5: Cache Invalidation (PASS/FAIL)
- [ ] Scenario 6: Latest Approved Wins (PASS/FAIL)

### Post-Test Cleanup
- [ ] Test correction requests deleted
- [ ] Admin overrides removed
- [ ] History records cleared (if needed)
- [ ] Redis cache flushed
- [ ] Services restarted

---

## Contact and Support

For questions or issues with this test plan:
- Reference the implementation plan: `/home/daniel/.claude/plans/reflective-noodling-duckling.md`
- Check coding standards: `/home/daniel/repos/zmanim/docs/coding-standards.md`
- Review API documentation: http://localhost:8080/swagger/index.html
- View logs: `tmux attach -t zmanim` (Ctrl+B, 0=API, 1=Web, D=detach)

---

**End of Test Plan**
