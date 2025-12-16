# Audit Trail Refactoring - Complete Implementation Guide

**Status:** Ready for Implementation
**Created:** 2025-12-19
**Purpose:** Comprehensive handoff document for agent implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current State Analysis](#current-state-analysis)
4. [Solution Architecture](#solution-architecture)
5. [Implementation Tasks](#implementation-tasks)
6. [Verification Criteria](#verification-criteria)
7. [Definition of Done](#definition-of-done)
8. [File Reference](#file-reference)
9. [Code Examples](#code-examples)
10. [Testing Requirements](#testing-requirements)

---

## Executive Summary

Refactor the zmanim audit trail system to:
1. **Add audit logging to all 17 admin handlers** (currently ZERO are audited)
2. **Capture before/after diffs** showing what actually changed
3. **Build admin audit UI** with filtering, search, and export
4. **Consolidate redundant tables** into unified `actions` table
5. **Enhance publisher activity page** with filters and diff display

---

## Problem Statement

### Current Issues

| Issue | Impact | Evidence |
|-------|--------|----------|
| Admin actions not audited | Critical | Search `admin.go` - no `LogAction` calls |
| No before/after diffs | High | `payload` field always `{}` empty |
| Redundant tables | Medium | `publisher_import_history`, `algorithm_rollback_audit` duplicate `actions` |
| No admin audit UI | High | No `/admin/audit-log` route exists |
| No filtering on activity | Medium | Publisher activity page has no filters |

### User Requirements

- "It doesn't show what's been done"
- "It doesn't have any description. Anything useful"
- "It just says something happened"
- "We should be able to reuse a common auditing framework"
- "Create a great UI that shows audit trail"

---

## Current State Analysis

### Database Schema

#### Primary Audit Table: `actions`
**Location:** `db/migrations/00000000000001_schema.sql` (lines 1700-1718)

```sql
CREATE TABLE public.actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type varchar(50) NOT NULL,        -- e.g., 'profile_update', 'algorithm_save'
    concept varchar(50) NOT NULL,            -- e.g., 'publisher', 'algorithm'
    user_id text,                            -- Clerk user ID
    publisher_id integer,                    -- Publisher context (nullable)
    request_id uuid NOT NULL,                -- Request correlation
    parent_action_id uuid,                   -- Action chaining
    entity_type varchar(50),                 -- e.g., 'publisher', 'zman'
    entity_id text,                          -- ID of affected entity
    payload jsonb,                           -- UNDERUTILIZED - should store old/new
    result jsonb,                            -- UNDERUTILIZED
    status varchar(20) DEFAULT 'pending',    -- pending, completed, failed
    error_message text,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    duration_ms integer,
    metadata jsonb                           -- Currently only stores actor_name
);
```

**Assessment:** Good structure, but `payload` and `metadata` are underutilized.

#### Redundant Table 1: `publisher_import_history`
**Location:** `db/migrations/00000000000001_schema.sql` (lines 3561-3577)

```sql
CREATE TABLE public.publisher_import_history (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    imported_by varchar(255) NOT NULL,
    imported_at timestamp DEFAULT now(),
    format_type varchar(50) NOT NULL,
    format_version integer NOT NULL,
    source_publisher_id integer,
    zmanim_created integer DEFAULT 0,
    zmanim_updated integer DEFAULT 0,
    zmanim_unchanged integer DEFAULT 0,
    zmanim_not_in_import integer DEFAULT 0,
    coverage_created integer DEFAULT 0,
    coverage_updated integer DEFAULT 0,
    profile_updated boolean DEFAULT false,
    import_summary jsonb
);
```

**Action:** Migrate to `actions` table with `action_type='import'`, store counters in `result` jsonb.

#### Redundant Table 2: `algorithm_rollback_audit`
**Location:** `db/migrations/00000000000001_schema.sql` (lines 1861-1870)

```sql
CREATE TABLE public.algorithm_rollback_audit (
    id integer NOT NULL,
    algorithm_id integer NOT NULL,
    source_version integer NOT NULL,
    target_version integer NOT NULL,
    new_version integer NOT NULL,
    reason text,
    rolled_back_by text,
    created_at timestamp DEFAULT now()
);
```

**Action:** Migrate to `actions` table with `action_type='algorithm_rollback'`, store versions in `payload` jsonb.

### Current Service Implementation

**File:** `api/internal/services/activity_service.go`

```go
// Existing action constants (lines 23-33)
const (
    ActionProfileUpdate    = "profile_update"
    ActionSettingsUpdate   = "settings_update"
    ActionAlgorithmSave    = "algorithm_save"
    ActionAlgorithmPublish = "algorithm_publish"
    ActionCoverageAdd      = "coverage_add"
    ActionCoverageRemove   = "coverage_remove"
    ActionZmanCreate       = "zman_create"      // DEFINED but NOT USED
    ActionZmanUpdate       = "zman_update"      // DEFINED but NOT USED
    ActionZmanDelete       = "zman_delete"      // DEFINED but NOT USED
)

// Existing concept constants (lines 35-41)
const (
    ConceptPublisher = "publisher"
    ConceptAlgorithm = "algorithm"
    ConceptCoverage  = "coverage"
    ConceptZman      = "zman"
)
```

**Current LogAction method (lines 57-131):**
- Takes: `ctx, actionType, concept, entityType, entityID, publisherIDStr, metadata`
- Resolves actor from context (user ID, impersonation detection)
- **DOES NOT** capture before/after diffs
- **DOES NOT** capture IP address, user agent
- Sets `payload` to empty `{}`

### Admin Handlers - NONE AUDITED

**File:** `api/internal/handlers/admin.go` (1,416 lines)

| Handler | Line | Action Type Needed | Currently Audited |
|---------|------|-------------------|-------------------|
| `AdminGetPublisherUsers` | 28 | (read-only, skip) | N/A |
| `AdminListPublishers` | 85 | (read-only, skip) | N/A |
| `AdminCreatePublisher` | 141 | `admin_publisher_create` | NO |
| `AdminUpdatePublisher` | ~250 | `admin_publisher_update` | NO |
| `AdminVerifyPublisher` | ~350 | `admin_publisher_verify` | NO |
| `AdminSuspendPublisher` | ~450 | `admin_publisher_suspend` | NO |
| `AdminReactivatePublisher` | ~550 | `admin_publisher_reactivate` | NO |
| `AdminDeletePublisher` | ~650 | `admin_publisher_delete` | NO |
| `AdminRestorePublisher` | ~750 | `admin_publisher_restore` | NO |
| `AdminPermanentDeletePublisher` | ~850 | `admin_publisher_permanent_delete` | NO |
| `AdminSetPublisherCertified` | ~950 | `admin_publisher_certified` | NO |
| `AdminAddUserToPublisher` | ~1050 | `admin_user_add` | NO |
| `AdminRemoveUserFromPublisher` | ~1150 | `admin_user_remove` | NO |
| `AdminExportPublisher` | ~1250 | `admin_publisher_export` | NO |
| `AdminImportPublisher` | ~1350 | `admin_publisher_import` | NO |

**File:** `api/internal/handlers/admin_corrections.go`

| Handler | Action Type Needed | Currently Audited |
|---------|-------------------|-------------------|
| `AdminApproveCorrectionRequest` | `admin_correction_approve` | NO |
| `AdminRejectCorrectionRequest` | `admin_correction_reject` | NO |

### Publisher Handlers - PARTIALLY AUDITED

**File:** `api/internal/handlers/handlers.go`
- `UpdatePublisherProfile` - YES (logs `profile_update`)

**File:** `api/internal/handlers/publisher_settings.go`
- `UpdatePublisherCalculationSettings` - YES (logs `settings_update`)

**File:** `api/internal/handlers/coverage.go`
- `AddCoverage` - YES (logs `coverage_add`)
- `RemoveCoverage` - YES (logs `coverage_remove`)

**File:** `api/internal/handlers/publisher_algorithm.go`
- `SaveAlgorithmDraft` - YES (logs `algorithm_save`)
- `PublishAlgorithm` - YES (logs `algorithm_publish`)

### Existing UI

**Publisher Activity Page:** `web/app/publisher/activity/page.tsx`
- Basic list view with icons
- NO filtering
- NO pagination
- NO diff display
- Fetches from `GET /publisher/activity`

**Admin Layout:** `web/app/admin/layout.tsx`
- NO audit log navigation item

---

## Solution Architecture

### Data Model Enhancement

#### Payload JSONB Structure (for diffs)
```json
{
  "old": {
    "status": "pending",
    "name": "Old Publisher Name"
  },
  "new": {
    "status": "active",
    "name": "New Publisher Name"
  }
}
```

#### Metadata JSONB Structure (enhanced context)
```json
{
  "actor_name": "admin@example.com",
  "actor_email": "admin@example.com",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "is_impersonation": false
}
```

### New Constants Required

```go
// Admin action type constants
const (
    ActionAdminPublisherVerify         = "admin_publisher_verify"
    ActionAdminPublisherSuspend        = "admin_publisher_suspend"
    ActionAdminPublisherReactivate     = "admin_publisher_reactivate"
    ActionAdminPublisherDelete         = "admin_publisher_delete"
    ActionAdminPublisherRestore        = "admin_publisher_restore"
    ActionAdminPublisherPermanentDelete = "admin_publisher_permanent_delete"
    ActionAdminPublisherCertified      = "admin_publisher_certified"
    ActionAdminPublisherCreate         = "admin_publisher_create"
    ActionAdminPublisherUpdate         = "admin_publisher_update"
    ActionAdminUserAdd                 = "admin_user_add"
    ActionAdminUserRemove              = "admin_user_remove"
    ActionAdminCorrectionApprove       = "admin_correction_approve"
    ActionAdminCorrectionReject        = "admin_correction_reject"
    ActionAdminPublisherExport         = "admin_publisher_export"
    ActionAdminPublisherImport         = "admin_publisher_import"
    ActionAdminCacheFlush              = "admin_cache_flush"
)

const ConceptAdmin = "admin"
```

---

## Implementation Tasks

### Task 1: Enhance ActivityService

**File:** `api/internal/services/activity_service.go`

**Changes:**

1. Add new types after line 41:
```go
// ActionDiff captures before/after state for auditing
type ActionDiff struct {
    Old map[string]interface{} `json:"old,omitempty"`
    New map[string]interface{} `json:"new,omitempty"`
}

// ActionContext captures HTTP request context for auditing
type ActionContext struct {
    IPAddress  string `json:"ip_address,omitempty"`
    UserAgent  string `json:"user_agent,omitempty"`
    ActorEmail string `json:"actor_email,omitempty"`
}
```

2. Add admin action constants after line 33:
```go
// Admin action type constants
const (
    ActionAdminPublisherVerify         = "admin_publisher_verify"
    ActionAdminPublisherSuspend        = "admin_publisher_suspend"
    ActionAdminPublisherReactivate     = "admin_publisher_reactivate"
    ActionAdminPublisherDelete         = "admin_publisher_delete"
    ActionAdminPublisherRestore        = "admin_publisher_restore"
    ActionAdminPublisherPermanentDelete = "admin_publisher_permanent_delete"
    ActionAdminPublisherCertified      = "admin_publisher_certified"
    ActionAdminPublisherCreate         = "admin_publisher_create"
    ActionAdminPublisherUpdate         = "admin_publisher_update"
    ActionAdminUserAdd                 = "admin_user_add"
    ActionAdminUserRemove              = "admin_user_remove"
    ActionAdminCorrectionApprove       = "admin_correction_approve"
    ActionAdminCorrectionReject        = "admin_correction_reject"
    ActionAdminPublisherExport         = "admin_publisher_export"
    ActionAdminPublisherImport         = "admin_publisher_import"
)

const ConceptAdmin = "admin"
```

3. Add new method `LogActionWithDiff`:
```go
// LogActionWithDiff logs an action with before/after state capture
func (s *ActivityService) LogActionWithDiff(
    ctx context.Context,
    actionType string,
    concept string,
    entityType string,
    entityID string,
    publisherIDStr string,
    diff *ActionDiff,
    actx *ActionContext,
) error {
    userID, actorName := s.resolveActor(ctx)

    var publisherID *int32
    if publisherIDStr != "" {
        if pid, err := stringToInt32(publisherIDStr); err == nil {
            publisherID = &pid
        }
    }

    requestID := middleware.GetRequestID(ctx)
    if requestID == "" {
        requestID = uuid.New().String()
    }

    // Build enhanced metadata
    metadata := map[string]interface{}{
        "actor_name": actorName,
    }
    if actx != nil {
        if actx.IPAddress != "" {
            metadata["ip_address"] = actx.IPAddress
        }
        if actx.UserAgent != "" {
            metadata["user_agent"] = actx.UserAgent
        }
        if actx.ActorEmail != "" {
            metadata["actor_email"] = actx.ActorEmail
        }
    }

    metadataJSON, err := json.Marshal(metadata)
    if err != nil {
        metadataJSON = []byte("{}")
    }

    // Build payload with diff
    var payloadJSON []byte
    if diff != nil {
        payloadJSON, err = json.Marshal(diff)
        if err != nil {
            payloadJSON = []byte("{}")
        }
    } else {
        payloadJSON = []byte("{}")
    }

    _, err = s.db.Queries.RecordAction(ctx, sqlcgen.RecordActionParams{
        ActionType:     actionType,
        Concept:        concept,
        UserID:         &userID,
        PublisherID:    publisherID,
        RequestID:      requestID,
        EntityType:     &entityType,
        EntityID:       &entityID,
        Payload:        payloadJSON,
        ParentActionID: pgtype.UUID{Valid: false},
        Metadata:       metadataJSON,
    })

    if err != nil {
        slog.Error("failed to record action with diff",
            "error", err,
            "action_type", actionType,
        )
        return err
    }

    slog.Info("action logged with diff",
        "action_type", actionType,
        "entity_type", entityType,
        "entity_id", entityID,
    )

    return nil
}

// ExtractActionContext extracts audit context from HTTP request
func ExtractActionContext(r *http.Request) *ActionContext {
    return &ActionContext{
        IPAddress:  r.RemoteAddr,
        UserAgent:  r.UserAgent(),
        ActorEmail: r.Header.Get("X-User-Email"), // If available from auth
    }
}
```

**Verification:**
```bash
cd api && go build ./...
```

---

### Task 2: Add SQL Queries for Admin Audit Log

**File:** `api/internal/db/queries/actions.sql`

**Add these queries:**

```sql
-- name: GetAdminAuditLog :many
-- Returns admin activity log with filtering and pagination
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    request_id,
    entity_type,
    entity_id,
    payload,
    result,
    status,
    error_message,
    started_at,
    completed_at,
    duration_ms,
    metadata
FROM public.actions
WHERE
    action_type LIKE 'admin_%'
    AND (sqlc.narg('action_type_filter')::text IS NULL OR action_type = sqlc.narg('action_type_filter'))
    AND (sqlc.narg('user_id_filter')::text IS NULL OR user_id = sqlc.narg('user_id_filter'))
    AND (sqlc.narg('start_date')::timestamptz IS NULL OR started_at >= sqlc.narg('start_date'))
    AND (sqlc.narg('end_date')::timestamptz IS NULL OR started_at <= sqlc.narg('end_date'))
ORDER BY started_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');

-- name: CountAdminAuditLog :one
-- Returns count for pagination
SELECT COUNT(*)::bigint
FROM public.actions
WHERE
    action_type LIKE 'admin_%'
    AND (sqlc.narg('action_type_filter')::text IS NULL OR action_type = sqlc.narg('action_type_filter'))
    AND (sqlc.narg('user_id_filter')::text IS NULL OR user_id = sqlc.narg('user_id_filter'))
    AND (sqlc.narg('start_date')::timestamptz IS NULL OR started_at >= sqlc.narg('start_date'))
    AND (sqlc.narg('end_date')::timestamptz IS NULL OR started_at <= sqlc.narg('end_date'));

-- name: GetEntityAuditTrail :many
-- Returns full audit trail for a specific entity
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    payload,
    result,
    status,
    started_at,
    metadata
FROM public.actions
WHERE entity_type = $1 AND entity_id = $2
ORDER BY started_at DESC
LIMIT $3 OFFSET $4;

-- name: GetAllAuditLog :many
-- Returns all activity log (not just admin) with filtering
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
    entity_type,
    entity_id,
    payload,
    status,
    started_at,
    metadata
FROM public.actions
WHERE
    (sqlc.narg('action_type_filter')::text IS NULL OR action_type = sqlc.narg('action_type_filter'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('start_date')::timestamptz IS NULL OR started_at >= sqlc.narg('start_date'))
    AND (sqlc.narg('end_date')::timestamptz IS NULL OR started_at <= sqlc.narg('end_date'))
ORDER BY started_at DESC
LIMIT sqlc.arg('limit_val') OFFSET sqlc.arg('offset_val');
```

**Verification:**
```bash
cd api && sqlc generate
cd api && go build ./...
```

---

### Task 3: Instrument Admin Handlers

**File:** `api/internal/handlers/admin.go`

**Pattern for each handler:**

```go
func (h *Handlers) AdminVerifyPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    // ... existing validation ...

    // CAPTURE BEFORE STATE
    beforePub, err := h.db.Queries.GetPublisherByID(ctx, idInt)
    if err != nil {
        // handle error
    }

    // ... existing update logic ...

    // CAPTURE AFTER STATE AND LOG
    afterPub, _ := h.db.Queries.GetPublisherByID(ctx, idInt)

    diff := &services.ActionDiff{
        Old: map[string]interface{}{"status": beforePub.StatusKey},
        New: map[string]interface{}{"status": afterPub.StatusKey},
    }

    _ = h.activityService.LogActionWithDiff(
        ctx,
        services.ActionAdminPublisherVerify,
        services.ConceptAdmin,
        "publisher",
        id,
        "", // No publisher context for admin actions
        diff,
        services.ExtractActionContext(r),
    )

    // ... existing response ...
}
```

**Handlers to instrument (with specific diffs):**

| Handler | Diff Fields |
|---------|-------------|
| `AdminCreatePublisher` | `new: {name, email, status}` |
| `AdminUpdatePublisher` | `old/new: {changed fields}` |
| `AdminVerifyPublisher` | `old/new: {status}` |
| `AdminSuspendPublisher` | `old/new: {status, suspension_reason}` |
| `AdminReactivatePublisher` | `old/new: {status}` |
| `AdminDeletePublisher` | `old/new: {deleted_at, deleted_by}` |
| `AdminRestorePublisher` | `old/new: {deleted_at}` |
| `AdminPermanentDeletePublisher` | `old: {id, name}` |
| `AdminSetPublisherCertified` | `old/new: {is_certified}` |
| `AdminAddUserToPublisher` | `new: {user_id, publisher_id}` |
| `AdminRemoveUserFromPublisher` | `old: {user_id, publisher_id}` |
| `AdminExportPublisher` | `new: {export_format}` (read audit) |
| `AdminImportPublisher` | `new: {import_stats}` |

**File:** `api/internal/handlers/admin_corrections.go`

| Handler | Diff Fields |
|---------|-------------|
| `AdminApproveCorrectionRequest` | `old/new: {status, approved_by}` |
| `AdminRejectCorrectionRequest` | `old/new: {status, rejection_reason}` |

**Verification:**
```bash
cd api && go build ./...
cd api && go test ./...
```

---

### Task 4: Add Admin Audit Log Endpoints

**File:** `api/internal/handlers/admin.go`

**Add new handler:**

```go
// AdminGetAuditLog returns the admin audit log with filtering
// GET /api/v1/admin/audit-log
func (h *Handlers) AdminGetAuditLog(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Parse query parameters
    actionType := r.URL.Query().Get("action_type")
    userID := r.URL.Query().Get("user_id")
    startDateStr := r.URL.Query().Get("start_date")
    endDateStr := r.URL.Query().Get("end_date")

    page, _ := strconv.Atoi(r.URL.Query().Get("page"))
    if page < 1 {
        page = 1
    }
    pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
    if pageSize < 1 || pageSize > 100 {
        pageSize = 50
    }

    offset := (page - 1) * pageSize

    // Parse dates
    var startDate, endDate *time.Time
    if startDateStr != "" {
        if t, err := time.Parse(time.RFC3339, startDateStr); err == nil {
            startDate = &t
        }
    }
    if endDateStr != "" {
        if t, err := time.Parse(time.RFC3339, endDateStr); err == nil {
            endDate = &t
        }
    }

    // Query
    rows, err := h.db.Queries.GetAdminAuditLog(ctx, sqlcgen.GetAdminAuditLogParams{
        ActionTypeFilter: nilIfEmpty(actionType),
        UserIDFilter:     nilIfEmpty(userID),
        StartDate:        startDate,
        EndDate:          endDate,
        LimitVal:         int32(pageSize),
        OffsetVal:        int32(offset),
    })
    if err != nil {
        slog.Error("failed to get admin audit log", "error", err)
        RespondInternalError(w, r, "Failed to retrieve audit log")
        return
    }

    // Get total count
    total, err := h.db.Queries.CountAdminAuditLog(ctx, sqlcgen.CountAdminAuditLogParams{
        ActionTypeFilter: nilIfEmpty(actionType),
        UserIDFilter:     nilIfEmpty(userID),
        StartDate:        startDate,
        EndDate:          endDate,
    })
    if err != nil {
        total = 0
    }

    // Format response
    entries := make([]map[string]interface{}, 0, len(rows))
    for _, row := range rows {
        entry := map[string]interface{}{
            "id":          row.ID,
            "action_type": row.ActionType,
            "concept":     row.Concept,
            "user_id":     row.UserID,
            "entity_type": row.EntityType,
            "entity_id":   row.EntityID,
            "status":      row.Status,
            "started_at":  row.StartedAt,
            "description": formatActionDescription(row.ActionType, row.EntityType),
        }

        // Parse payload for diff
        if len(row.Payload) > 2 { // Not empty "{}"
            var payload map[string]interface{}
            if json.Unmarshal(row.Payload, &payload) == nil {
                entry["payload"] = payload
            }
        }

        // Parse metadata
        if len(row.Metadata) > 2 {
            var metadata map[string]interface{}
            if json.Unmarshal(row.Metadata, &metadata) == nil {
                entry["metadata"] = metadata
                if actorName, ok := metadata["actor_name"]; ok {
                    entry["actor_name"] = actorName
                }
            }
        }

        entries = append(entries, entry)
    }

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "entries":   entries,
        "total":     total,
        "page":      page,
        "page_size": pageSize,
    })
}

// Helper function
func nilIfEmpty(s string) *string {
    if s == "" {
        return nil
    }
    return &s
}
```

**File:** `api/cmd/api/main.go`

**Add routes in admin section:**

```go
r.Route("/admin", func(r chi.Router) {
    // ... existing routes ...

    r.Get("/audit-log", h.AdminGetAuditLog)
})
```

**Verification:**
```bash
cd api && go build ./...
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/admin/audit-log"
curl -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/admin/audit-log?action_type=admin_publisher_verify"
```

---

### Task 5: Create Admin Audit Log UI

**File:** `web/app/admin/audit-log/page.tsx` (NEW)

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  action_type: string;
  concept: string;
  user_id: string;
  actor_name?: string;
  entity_type: string;
  entity_id: string;
  payload?: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  status: string;
  started_at: string;
  description: string;
}

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'admin_publisher_verify', label: 'Publisher Verified' },
  { value: 'admin_publisher_suspend', label: 'Publisher Suspended' },
  { value: 'admin_publisher_reactivate', label: 'Publisher Reactivated' },
  { value: 'admin_publisher_delete', label: 'Publisher Deleted' },
  { value: 'admin_publisher_restore', label: 'Publisher Restored' },
  { value: 'admin_publisher_certified', label: 'Publisher Certified' },
  { value: 'admin_publisher_create', label: 'Publisher Created' },
  { value: 'admin_publisher_update', label: 'Publisher Updated' },
  { value: 'admin_user_add', label: 'User Added' },
  { value: 'admin_user_remove', label: 'User Removed' },
  { value: 'admin_correction_approve', label: 'Correction Approved' },
  { value: 'admin_correction_reject', label: 'Correction Rejected' },
];

export default function AdminAuditLogPage() {
  const api = useApi();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Filters
  const [actionType, setActionType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAuditLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '50',
      });
      if (actionType) params.set('action_type', actionType);
      if (startDate) params.set('start_date', new Date(startDate).toISOString());
      if (endDate) params.set('end_date', new Date(endDate).toISOString());

      const data = await api.admin.get<{ entries: AuditEntry[]; total: number }>(
        `/admin/audit-log?${params}`
      );
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit log', err);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [api, page, actionType, startDate, endDate]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    // Build CSV from current entries
    const headers = ['Timestamp', 'Action', 'Actor', 'Entity Type', 'Entity ID', 'Status'];
    const rows = entries.map(e => [
      e.started_at,
      e.action_type,
      e.actor_name || e.user_id,
      e.entity_type,
      e.entity_id,
      e.status,
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ScrollText className="w-8 h-8" />
              Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Track all administrative actions
            </p>
          </div>
          <Button onClick={exportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value || 'all'}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                placeholder="Start date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />

              <Input
                type="date"
                placeholder="End date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />

              <Button onClick={() => { setActionType(''); setStartDate(''); setEndDate(''); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ScrollText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No audit entries found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {entries.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center gap-4 cursor-pointer"
                      onClick={() => toggleRow(entry.id)}
                    >
                      {entry.payload ? (
                        expandedRows.has(entry.id) ?
                          <ChevronDown className="w-4 h-4" /> :
                          <ChevronRight className="w-4 h-4" />
                      ) : <div className="w-4" />}

                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.started_at)}
                        </span>
                        <span className="font-medium">{entry.description}</span>
                        <span className="text-sm">{entry.actor_name || entry.user_id}</span>
                        <span className="text-sm">{entry.entity_type}</span>
                        <span className="text-sm text-muted-foreground">{entry.entity_id}</span>
                      </div>
                    </div>

                    {/* Expanded diff view */}
                    {expandedRows.has(entry.id) && entry.payload && (
                      <div className="mt-4 ml-8 p-4 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          {entry.payload.old && (
                            <div>
                              <h4 className="font-medium text-red-600 mb-2">Before</h4>
                              <pre className="text-sm bg-background p-2 rounded">
                                {JSON.stringify(entry.payload.old, null, 2)}
                              </pre>
                            </div>
                          )}
                          {entry.payload.new && (
                            <div>
                              <h4 className="font-medium text-green-600 mb-2">After</h4>
                              <pre className="text-sm bg-background p-2 rounded">
                                {JSON.stringify(entry.payload.new, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-6">
              <span className="text-sm text-muted-foreground">
                Showing {entries.length} of {total} entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={entries.length < 50}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**File:** `web/app/admin/layout.tsx`

**Add to navigation array:**

```tsx
{ href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText }
```

**Import at top:**
```tsx
import { ScrollText } from 'lucide-react';
```

**Verification:**
```bash
cd web && npm run type-check
cd web && npm run build
# Navigate to http://localhost:3001/admin/audit-log
```

---

### Task 6: Enhance Publisher Activity Page

**File:** `web/app/publisher/activity/page.tsx`

**Add to existing page:**

1. Add filter state and UI (date range, action type dropdown)
2. Add pagination controls
3. Display payload diffs when available
4. Update fetch to include query params

**Verification:**
```bash
cd web && npm run type-check
# Navigate to http://localhost:3001/publisher/activity and verify filters work
```

---

### Task 7: Database Migration (Optional - Separate PR)

**File:** `db/migrations/YYYYMMDDHHMMSS_audit_indexes.sql` (NEW)

```sql
-- Add indexes for audit log performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_admin_filter
ON actions(action_type, started_at DESC)
WHERE action_type LIKE 'admin_%';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_entity_lookup
ON actions(entity_type, entity_id, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actions_publisher_filter
ON actions(publisher_id, started_at DESC)
WHERE publisher_id IS NOT NULL;
```

---

## Verification Criteria

### Backend Verification

```bash
# 1. Build succeeds
cd api && go build ./...

# 2. SQLc generates without errors
cd api && sqlc generate

# 3. Tests pass
cd api && go test ./...

# 4. Type check passes
cd web && npm run type-check

# 5. Web builds
cd web && npm run build
```

### Functional Verification

```bash
# Get auth token
source api/.env && TOKEN=$(node scripts/get-test-token.js)

# 1. Verify admin audit endpoint works
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/admin/audit-log" | jq '.entries | length'

# 2. Verify filtering works
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/admin/audit-log?action_type=admin_publisher_verify" | jq

# 3. Perform an admin action and verify it's logged
# (e.g., verify a publisher, then check audit log)

# 4. Verify payload contains diff
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/v1/admin/audit-log" | jq '.entries[0].payload'
```

### UI Verification

1. Navigate to `http://localhost:3001/admin/audit-log`
2. Verify page loads without errors
3. Verify filters work (action type, date range)
4. Verify pagination works
5. Verify diff expansion works (click row to expand)
6. Verify CSV export downloads file

### Integration Verification

```bash
# Run full CI checks
./scripts/validate-ci-checks.sh
```

---

## Definition of Done

### Required (Must Have)

- [ ] **ActivityService enhanced** with `LogActionWithDiff` method
- [ ] **Admin action constants** added to activity_service.go
- [ ] **SQL queries** added for admin audit log with filtering
- [ ] **sqlc generate** runs without errors
- [ ] **All 15 admin handlers** instrumented with audit logging:
  - [ ] AdminCreatePublisher
  - [ ] AdminUpdatePublisher
  - [ ] AdminVerifyPublisher
  - [ ] AdminSuspendPublisher
  - [ ] AdminReactivatePublisher
  - [ ] AdminDeletePublisher
  - [ ] AdminRestorePublisher
  - [ ] AdminPermanentDeletePublisher
  - [ ] AdminSetPublisherCertified
  - [ ] AdminAddUserToPublisher
  - [ ] AdminRemoveUserFromPublisher
  - [ ] AdminExportPublisher
  - [ ] AdminImportPublisher
  - [ ] AdminApproveCorrectionRequest
  - [ ] AdminRejectCorrectionRequest
- [ ] **Admin audit endpoint** `GET /api/v1/admin/audit-log` works with filtering
- [ ] **Admin audit UI** at `/admin/audit-log` renders correctly
- [ ] **Diff display** shows before/after when expanding audit entries
- [ ] **CSV export** downloads valid CSV file
- [ ] **All CI checks pass** (`./scripts/validate-ci-checks.sh`)

### Nice to Have (Can Be Separate PR)

- [ ] Publisher activity page enhanced with filters
- [ ] Database indexes for performance
- [ ] Data migration from redundant tables
- [ ] Delete redundant tables after verification period

---

## File Reference

### Files to Modify

| File | Type | Priority |
|------|------|----------|
| `api/internal/services/activity_service.go` | Modify | P0 |
| `api/internal/db/queries/actions.sql` | Modify | P0 |
| `api/internal/handlers/admin.go` | Modify | P0 |
| `api/internal/handlers/admin_corrections.go` | Modify | P0 |
| `api/cmd/api/main.go` | Modify | P1 |
| `web/app/admin/layout.tsx` | Modify | P1 |
| `web/app/publisher/activity/page.tsx` | Modify | P2 |

### Files to Create

| File | Type | Priority |
|------|------|----------|
| `web/app/admin/audit-log/page.tsx` | Create | P1 |
| `web/components/shared/AuditDiffViewer.tsx` | Create | P2 |
| `db/migrations/YYYYMMDDHHMMSS_audit_indexes.sql` | Create | P3 |

### Files for Reference Only

| File | Purpose |
|------|---------|
| `db/migrations/00000000000001_schema.sql` | Current schema reference |
| `api/internal/db/sqlcgen/actions.sql.go` | Generated code reference |
| `web/lib/api-client.ts` | API client patterns |

---

## Code Examples

### Example: Instrumenting AdminVerifyPublisher

**Before (no audit):**
```go
func (h *Handlers) AdminVerifyPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    idInt, _ := parseIDParam(id)

    err := h.db.Queries.UpdatePublisherStatus(ctx, sqlcgen.UpdatePublisherStatusParams{
        ID:        idInt,
        StatusKey: "active",
    })

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{"success": true})
}
```

**After (with audit):**
```go
func (h *Handlers) AdminVerifyPublisher(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    id := chi.URLParam(r, "id")

    idInt, _ := parseIDParam(id)

    // Capture before state
    before, _ := h.db.Queries.GetPublisherByID(ctx, idInt)

    err := h.db.Queries.UpdatePublisherStatus(ctx, sqlcgen.UpdatePublisherStatusParams{
        ID:        idInt,
        StatusKey: "active",
    })

    // Log with diff
    _ = h.activityService.LogActionWithDiff(
        ctx,
        services.ActionAdminPublisherVerify,
        services.ConceptAdmin,
        "publisher",
        id,
        "",
        &services.ActionDiff{
            Old: map[string]interface{}{"status": before.StatusKey},
            New: map[string]interface{}{"status": "active"},
        },
        services.ExtractActionContext(r),
    )

    RespondJSON(w, r, http.StatusOK, map[string]interface{}{"success": true})
}
```

---

## Testing Requirements

### Unit Tests

**File:** `api/internal/services/activity_service_test.go`

```go
func TestLogActionWithDiff(t *testing.T) {
    // Test that diff is properly serialized to payload
}

func TestExtractActionContext(t *testing.T) {
    // Test IP and user agent extraction
}
```

### Integration Tests

```bash
# Manual test script
source api/.env

# 1. Create a test publisher
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Publisher"}' \
  http://localhost:8080/api/v1/admin/publishers

# 2. Check audit log for create action
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/admin/audit-log?action_type=admin_publisher_create"

# 3. Verify payload contains expected data
```

---

## Notes for Implementing Agent

1. **Start with Task 1** (ActivityService) - everything else depends on it
2. **Run `sqlc generate`** after adding SQL queries (Task 2)
3. **Test incrementally** - instrument 2-3 handlers, verify, then continue
4. **Don't modify redundant tables yet** - that's a separate PR
5. **Use existing patterns** - look at how `LogAction` is called in `handlers.go` for reference
6. **Check build after each task** - `cd api && go build ./...`

---

## Sources

- [PostgreSQL Audit Logging Best Practices](https://severalnines.com/blog/postgresql-audit-logging-best-practices/)
- [Audit logging using JSONB in Postgres](https://elephas.io/audit-logging-using-jsonb-in-postgres/)
- [PostgreSQL Audit Trigger Wiki](https://wiki.postgresql.org/wiki/Audit_trigger)
- [pgAudit Extension](https://www.pgaudit.org/)
