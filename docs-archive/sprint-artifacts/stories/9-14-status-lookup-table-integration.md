# Story 9.14: Status Lookup Table Integration

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Low (Bug fix / Data integrity)
**Story Points:** 2

---

## User Story

**As an** admin user,
**I want** publisher status to be derived from the database lookup table,
**So that** status values accurately reflect the real state of each publisher.

---

## Context

The admin handlers currently hardcode "active" status instead of fetching the actual status from the database. This means publishers could appear as "active" when they're actually "pending" or "suspended".

**Source TODOs:**
- `api/internal/handlers/admin.go:809` - "TODO: Get actual status from lookup"
- `api/internal/handlers/admin.go:944` - "TODO: Get actual status from lookup"

**Current State:**
```go
"status": "active", // TODO: Get actual status from lookup
```

**Target State:**
- Status derived from `publishers.status_id` joined to `statuses` lookup table
- Admin views show accurate status
- No hardcoded status values anywhere

---

## Acceptance Criteria

### AC1: Status Lookup Join
**Given** an admin queries for publishers
**When** the response is built
**Then** status is fetched from the statuses lookup table

### AC2: Accurate Status Display
**Given** a publisher with status_id = 2 (pending)
**When** viewed in admin dashboard
**Then** status shows "pending" not "active"

### AC3: All Status Types Supported
**Given** the statuses lookup table
**When** building admin responses
**Then** all status types are handled:
- active
- pending
- suspended
- rejected

### AC4: No Hardcoded Values
**Given** the admin handlers
**When** auditing the code
**Then** no hardcoded "active" or other status strings exist

---

## Technical Notes

### Database Schema

**Existing `statuses` table:**
```sql
CREATE TABLE statuses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Data:
-- 1: active
-- 2: pending
-- 3: suspended
-- 4: rejected
```

**Existing `publishers` table:**
```sql
CREATE TABLE publishers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    status_id INTEGER REFERENCES statuses(id) DEFAULT 2, -- pending
    -- ... other fields
);
```

### SQLc Query Updates

**Current query (admin.go:809 context - GetPublishersForAdmin):**
```sql
-- name: GetPublishersForAdmin :many
SELECT
    p.id,
    p.name,
    p.slug,
    p.created_at,
    p.updated_at,
    s.name as status  -- Add this join
FROM publishers p
JOIN statuses s ON p.status_id = s.id
ORDER BY p.created_at DESC;
```

**Current query (admin.go:944 context - GetPublisherByID):**
```sql
-- name: GetPublisherByIDForAdmin :one
SELECT
    p.id,
    p.name,
    p.slug,
    p.created_at,
    p.updated_at,
    s.name as status  -- Add this join
FROM publishers p
JOIN statuses s ON p.status_id = s.id
WHERE p.id = $1;
```

### Handler Updates

**admin.go:809 - Replace hardcoded status:**
```go
// Before:
"status": "active", // TODO: Get actual status from lookup

// After:
"status": row.Status,  // From JOIN with statuses table
```

**admin.go:944 - Replace hardcoded status:**
```go
// Before:
"status": "active", // TODO: Get actual status from lookup

// After:
"status": row.Status,  // From JOIN with statuses table
```

### Response Format

No change to API response format - just data accuracy:
```json
{
  "id": "uuid",
  "name": "Publisher Name",
  "status": "pending",  // Now accurate instead of always "active"
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Identify all affected queries
  - [ ] 1.1 Audit admin.go for hardcoded status values
  - [ ] 1.2 List all SQLc queries that need status join
  - [ ] 1.3 Check for hardcoded status in other handlers

- [ ] Task 2: Update SQLc queries
  - [ ] 2.1 Update GetPublishersForAdmin query with status join
  - [ ] 2.2 Update GetPublisherByIDForAdmin query with status join
  - [ ] 2.3 Run `sqlc generate`
  - [ ] 2.4 Verify generated code includes Status field

- [ ] Task 3: Update admin handlers
  - [ ] 3.1 Update admin.go:809 to use row.Status
  - [ ] 3.2 Update admin.go:944 to use row.Status
  - [ ] 3.3 Remove TODO comments
  - [ ] 3.4 Verify all handlers use lookup values

- [ ] Task 4: Testing
  - [ ] 4.1 Create test data with different statuses
  - [ ] 4.2 Verify pending publisher shows "pending"
  - [ ] 4.3 Verify suspended publisher shows "suspended"
  - [ ] 4.4 Verify active publisher shows "active"
  - [ ] 4.5 Test admin dashboard displays correctly

- [ ] Task 5: Cleanup
  - [ ] 5.1 Search codebase for other hardcoded status values
  - [ ] 5.2 Remove any remaining hardcoded values
  - [ ] 5.3 Verify no regressions

---

## Dependencies

**Depends On:**
- statuses lookup table exists (already exists)
- publishers.status_id foreign key exists (already exists)

**Dependent Stories:**
- None

---

## Definition of Done

- [ ] SQLc queries updated with status join
- [ ] admin.go:809 uses row.Status
- [ ] admin.go:944 uses row.Status
- [ ] No hardcoded "active" status values remain
- [ ] All status types display correctly (pending, active, suspended, rejected)
- [ ] Unit tests pass
- [ ] Admin dashboard shows accurate statuses
- [ ] No regressions in admin functionality

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Missing status_id data | LOW | MEDIUM | Default to 'pending' or handle null |
| Query performance impact | LOW | LOW | Status table is tiny, JOIN is fast |
| Frontend display issues | LOW | LOW | No API format change, just data |

---

## Dev Notes

### Finding All Hardcoded Status Values

```bash
# Search for hardcoded status in Go files
grep -rn '"active"' api/internal/handlers/*.go
grep -rn '"pending"' api/internal/handlers/*.go
grep -rn '"status":' api/internal/handlers/*.go

# Verify queries in SQLc files
grep -rn 'status' api/internal/db/queries/*.sql
```

### NULL Status Handling

If `status_id` could be NULL (shouldn't be with proper constraints):
```go
status := "unknown"
if row.Status.Valid {
    status = row.Status.String
}
```

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 2_
