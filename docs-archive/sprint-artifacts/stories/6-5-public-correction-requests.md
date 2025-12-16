# Story 6.5: Public Correction Requests (Minimal Admin)

**Epic:** Epic 6 - Code Cleanup, Consolidation & Publisher Data Overrides
**Status:** ready-for-dev
**Priority:** P2
**Story Points:** 16
**Dependencies:** 6.1 (Type definitions)

---

## Story

As a **publisher**,
I want **to request corrections to city data that affect all users (not just my publisher)**,
So that **everyone benefits from accurate location data and I can help improve the global dataset**.

As an **admin**,
I want **to review and approve/reject correction requests with evidence links and reasoning**,
So that **data quality is maintained while allowing community contributions**.

---

## Background

Sometimes city data in the global database is incorrect for everyone:
- Coordinates are wrong
- Elevation is inaccurate
- Timezone is incorrect

Publishers discover these issues when working with their coverage areas. Instead of just overriding for themselves (Story 6.4), they should be able to request public corrections that benefit all users.

**Workflow:**
1. Publisher finds incorrect city data
2. Publisher submits correction request with evidence URLs and reasoning
3. Admin reviews request
4. Admin approves → Global data updated → All users benefit
5. Admin rejects → Publisher notified with reason

---

## Acceptance Criteria

### AC-6.5.1: Create Database Schema
- [ ] Create migration `00000000000027_city_correction_requests.sql`
- [ ] Create table `city_correction_requests` with fields:
  - id (UUID)
  - city_id (BIGINT, references geo_cities)
  - publisher_id (UUID, nullable)
  - requester_email, requester_name
  - proposed_latitude, proposed_longitude, proposed_elevation, proposed_timezone (all nullable)
  - correction_reason (TEXT, required)
  - evidence_urls (TEXT array)
  - status (pending/approved/rejected)
  - reviewed_by, reviewed_at, review_notes
  - created_at, updated_at
- [ ] Add indexes on status, city_id, publisher_id

### AC-6.5.2: Create SQLc Queries
- [ ] Create `api/internal/db/queries/correction_requests.sql`
- [ ] Add query: `CreateCorrectionRequest`
- [ ] Add query: `GetPublisherCorrectionRequests`
- [ ] Add query: `GetPendingCorrectionRequests` (admin)
- [ ] Add query: `GetCorrectionRequestByID`
- [ ] Add query: `UpdateCorrectionRequestStatus`
- [ ] Add query: `ApplyCityCorrection` (update geo_cities)
- [ ] Run `sqlc generate`

### AC-6.5.3: Create Publisher API Endpoints
- [ ] Create handler `api/internal/handlers/correction_requests.go`
- [ ] Implement `POST /api/v1/publisher/correction-requests`
- [ ] Implement `GET /api/v1/publisher/correction-requests`
- [ ] Add routes to router

### AC-6.5.4: Create Admin API Endpoints
- [ ] Create handler `api/internal/handlers/admin_corrections.go`
- [ ] Implement `GET /api/v1/admin/correction-requests?status=pending`
- [ ] Implement `POST /api/v1/admin/correction-requests/{id}/approve`
- [ ] Implement `POST /api/v1/admin/correction-requests/{id}/reject`
- [ ] Add routes to router

### AC-6.5.5: Create Publisher UI Component
- [ ] Create `web/components/publisher/CorrectionRequestDialog.tsx`
- [ ] Dialog shows: current city data (read-only) + proposed values (editable)
- [ ] Fields: latitude, longitude, elevation, timezone, reason, evidence URLs
- [ ] Validate: all proposed values are optional, but at least one must be provided
- [ ] Reason is required (min 20 characters)
- [ ] Evidence URLs are optional but validated if provided
- [ ] Handle submit action

### AC-6.5.6: Create Publisher Correction Requests Page
- [ ] Create `web/app/publisher/correction-requests/page.tsx`
- [ ] Show table of publisher's correction requests
- [ ] Columns: city, proposed changes, status, submission date
- [ ] Status badges: pending (blue), approved (green), rejected (red)
- [ ] Click row to see details
- [ ] Link from coverage page: "Request Public Correction"

### AC-6.5.7: Create Admin Correction Requests Page
- [ ] Create `web/app/admin/correction-requests/page.tsx`
- [ ] Show table of all pending correction requests
- [ ] Columns: city, publisher, proposed changes, submission date, actions
- [ ] Show diff view: current vs proposed values
- [ ] Show reason, evidence URLs, requester info
- [ ] Approve button opens confirmation dialog with review notes field
- [ ] Reject button opens dialog requiring reason
- [ ] After action: update status, refresh list

### AC-6.5.8: Approval Logic Updates Global Data
- [ ] On approve: call `ApplyCityCorrection` to update geo_cities table
- [ ] Only update fields that have proposed values
- [ ] Log changes in admin audit log (if exists)

### AC-6.5.9: Admin Direct Edit Capability
- [ ] Add `PUT /api/v1/admin/cities/{cityId}` endpoint
- [ ] Admin can directly update lat/long/elevation/timezone without correction request
- [ ] Add admin UI on correction requests page: "Edit City Directly" button
- [ ] Opens dialog with current values, allows direct modification
- [ ] Log all admin edits in audit trail
- [ ] Use case: Admin discovers error independently, or wants to make quick fix

### AC-6.5.10: Email Notifications (Required)
- [ ] On approval: Send email to requester with:
  - Subject: "Your correction request for [City] was approved"
  - Body: Shows approved values, thank you message
- [ ] On rejection: Send email to requester with:
  - Subject: "Your correction request for [City] was not approved"
  - Body: Shows admin's review notes explaining why
- [ ] Use existing Resend email service (from Story 2-11)
- [ ] Create email templates: `correction-approved.tsx`, `correction-rejected.tsx`

---

## Tasks / Subtasks

- [ ] Task 1: Database Schema (AC: 6.5.1)
  - [ ] 1.1 Create migration file
  - [ ] 1.2 Define table schema
  - [ ] 1.3 Add constraints and indexes
  - [ ] 1.4 Run migration
  - [ ] 1.5 Verify schema

- [ ] Task 2: SQLc Queries (AC: 6.5.2)
  - [ ] 2.1 Create `correction_requests.sql`
  - [ ] 2.2 Write CreateCorrectionRequest query
  - [ ] 2.3 Write GetPublisherCorrectionRequests query
  - [ ] 2.4 Write GetPendingCorrectionRequests query
  - [ ] 2.5 Write UpdateCorrectionRequestStatus query
  - [ ] 2.6 Write ApplyCityCorrection query
  - [ ] 2.7 Run `sqlc generate`

- [ ] Task 3: Publisher API (AC: 6.5.3)
  - [ ] 3.1 Create handler file
  - [ ] 3.2 Implement CreateCorrectionRequest handler
  - [ ] 3.3 Implement GetPublisherRequests handler
  - [ ] 3.4 Add routes to router
  - [ ] 3.5 Test endpoints

- [ ] Task 4: Admin API (AC: 6.5.4)
  - [ ] 4.1 Create admin handler file
  - [ ] 4.2 Implement GetPendingRequests handler
  - [ ] 4.3 Implement ApproveRequest handler
  - [ ] 4.4 Implement RejectRequest handler
  - [ ] 4.5 Add routes to router
  - [ ] 4.6 Test endpoints

- [ ] Task 5: Publisher Dialog Component (AC: 6.5.5)
  - [ ] 5.1 Create CorrectionRequestDialog.tsx
  - [ ] 5.2 Show current city data (read-only)
  - [ ] 5.3 Add proposed value fields
  - [ ] 5.4 Add reason textarea (required, min 20 chars)
  - [ ] 5.5 Add evidence URLs input (optional, multi-input)
  - [ ] 5.6 Validate inputs
  - [ ] 5.7 Handle submit

- [ ] Task 6: Publisher Requests Page (AC: 6.5.6)
  - [ ] 6.1 Create page file
  - [ ] 6.2 Fetch publisher's requests
  - [ ] 6.3 Show table with status badges
  - [ ] 6.4 Add "Request Correction" button in coverage page
  - [ ] 6.5 Open dialog on button click

- [ ] Task 7: Admin Requests Page (AC: 6.5.7)
  - [ ] 7.1 Create page file
  - [ ] 7.2 Fetch pending requests
  - [ ] 7.3 Show table with diff view
  - [ ] 7.4 Add approve button with confirmation
  - [ ] 7.5 Add reject button with reason dialog
  - [ ] 7.6 Handle approve action
  - [ ] 7.7 Handle reject action
  - [ ] 7.8 Refresh list after action

- [ ] Task 8: Approval Logic (AC: 6.5.8)
  - [ ] 8.1 Update ApproveRequest handler to call ApplyCityCorrection
  - [ ] 8.2 Apply only non-null proposed values
  - [ ] 8.3 Update request status to 'approved'
  - [ ] 8.4 Add logging
  - [ ] 8.5 Test approval flow

- [ ] Task 9: Admin Direct Edit API (AC: 6.5.9)
  - [ ] 9.1 Create SQLc query `AdminUpdateCity`
  - [ ] 9.2 Create handler `PUT /api/v1/admin/cities/{cityId}`
  - [ ] 9.3 Add audit logging for direct edits
  - [ ] 9.4 Add route to router
  - [ ] 9.5 Test endpoint with curl

- [ ] Task 10: Admin Direct Edit UI (AC: 6.5.9)
  - [ ] 10.1 Create `web/components/admin/AdminCityEditDialog.tsx`
  - [ ] 10.2 Add "Edit City Directly" button to admin correction requests page
  - [ ] 10.3 Show current city data (lat/long/elevation/timezone)
  - [ ] 10.4 Allow direct modification of values
  - [ ] 10.5 Connect dialog to API
  - [ ] 10.6 Refresh data after save

- [ ] Task 11: Email Notifications (AC: 6.5.10)
  - [ ] 11.1 Create `api/internal/emails/correction-approved.tsx` template
  - [ ] 11.2 Create `api/internal/emails/correction-rejected.tsx` template
  - [ ] 11.3 Update ApproveRequest handler to send approval email
  - [ ] 11.4 Update RejectRequest handler to send rejection email
  - [ ] 11.5 Test email delivery for both scenarios

---

## Dev Notes

### Database Schema

**File:** `db/migrations/00000000000027_city_correction_requests.sql`

```sql
CREATE TABLE city_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id BIGINT NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,
  publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL,

  -- Requester info
  requester_email TEXT NOT NULL,
  requester_name TEXT,

  -- Proposed corrections (NULL = no change proposed)
  proposed_latitude DOUBLE PRECISION,
  proposed_longitude DOUBLE PRECISION,
  proposed_elevation INTEGER,
  proposed_timezone TEXT,

  -- Request details
  correction_reason TEXT NOT NULL,
  evidence_urls TEXT[],

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Admin review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one proposed value must be non-null
  CONSTRAINT at_least_one_proposed_value CHECK (
    proposed_latitude IS NOT NULL OR
    proposed_longitude IS NOT NULL OR
    proposed_elevation IS NOT NULL OR
    proposed_timezone IS NOT NULL
  )
);

CREATE INDEX idx_correction_requests_status ON city_correction_requests(status);
CREATE INDEX idx_correction_requests_city ON city_correction_requests(city_id);
CREATE INDEX idx_correction_requests_publisher ON city_correction_requests(publisher_id);

COMMENT ON TABLE city_correction_requests IS 'Community-submitted corrections to global city data';
```

### SQLc Query: Apply Correction

**File:** `api/internal/db/queries/correction_requests.sql`

```sql
-- name: ApplyCityCorrection :exec
UPDATE geo_cities
SET
  latitude = COALESCE($2, latitude),
  longitude = COALESCE($3, longitude),
  elevation = COALESCE($4, elevation),
  timezone = COALESCE($5, timezone),
  updated_at = now()
WHERE id = $1;
```

### Approval Handler Logic

**File:** `api/internal/handlers/admin_corrections.go`

```go
func (h *AdminCorrectionsHandler) ApproveRequest(w http.ResponseWriter, r *http.Request) {
    // 1. Admin context
    ac := h.adminResolver.MustResolve(w, r)

    // 2. Parse ID
    requestID := chi.URLParam(r, "id")

    // 3. Parse body
    var req struct {
        ReviewNotes string `json:"reviewNotes"`
    }
    json.NewDecoder(r.Body).Decode(&req)

    // 4. Validate
    uuid, err := uuid.Parse(requestID)
    if err != nil {
        RespondError(w, r, http.StatusBadRequest, "Invalid request ID")
        return
    }

    // 5. Get request and apply correction
    ctx := r.Context()
    correctionReq, err := h.db.Queries.GetCorrectionRequestByID(ctx, uuid)
    if err != nil {
        RespondError(w, r, http.StatusNotFound, "Request not found")
        return
    }

    // Apply correction to geo_cities
    err = h.db.Queries.ApplyCityCorrection(ctx, sqlcgen.ApplyCityCorrectionParams{
        ID:                correctionReq.CityID,
        ProposedLatitude:  correctionReq.ProposedLatitude,
        ProposedLongitude: correctionReq.ProposedLongitude,
        ProposedElevation: correctionReq.ProposedElevation,
        ProposedTimezone:  correctionReq.ProposedTimezone,
    })
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "Failed to apply correction")
        return
    }

    // Update request status
    err = h.db.Queries.UpdateCorrectionRequestStatus(ctx, sqlcgen.UpdateCorrectionRequestStatusParams{
        ID:          uuid,
        Status:      "approved",
        ReviewedBy:  &ac.UserID,
        ReviewNotes: &req.ReviewNotes,
    })
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "Failed to update status")
        return
    }

    slog.Info("Correction request approved",
        "request_id", requestID,
        "city_id", correctionReq.CityID,
        "admin_id", ac.UserID)

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, map[string]string{"status": "approved"})
}
```

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md).

**Backend:**
- Follow 6-step handler pattern
- Use PublisherResolver for publisher endpoints
- Use AdminResolver for admin endpoints
- Use SQLc for all queries
- Use `slog` for logging

**Frontend:**
- Use `useApi` for publisher endpoints
- Use `useAdminApi` for admin endpoints
- Use Tailwind design tokens
- Validate inputs before submission

### References

- [web/components/publisher/CorrectionRequestDialog.tsx](../../../../web/components/publisher/CorrectionRequestDialog.tsx)
- [web/app/admin/correction-requests/page.tsx](../../../../web/app/admin/correction-requests/page.tsx)
- [docs/coding-standards.md](../../coding-standards.md)

---

## Testing Requirements

### Unit Tests
- [ ] Correction request validation
- [ ] ApplyCityCorrection only updates provided fields
- [ ] AdminUpdateCity updates all fields correctly

### Integration Tests
- [ ] Create correction request
- [ ] Get publisher requests
- [ ] Get admin pending requests
- [ ] Approve request updates geo_cities
- [ ] Reject request does not update geo_cities
- [ ] Admin direct edit updates geo_cities
- [ ] Email sent on approval
- [ ] Email sent on rejection

### E2E Tests
- [ ] Publisher submits correction request
- [ ] Request appears in publisher's list
- [ ] Admin sees request in pending list
- [ ] Admin approves request
- [ ] Global city data is updated
- [ ] Admin rejects request
- [ ] Publisher sees rejection status
- [ ] Admin directly edits city data
- [ ] Publisher receives approval email
- [ ] Publisher receives rejection email

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/6-5-public-correction-requests-context.md (to be generated)

### Agent Model Used
TBD

### Completion Notes
TBD

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-08 | Story created from Epic 6 | Bob (Scrum Master) |
