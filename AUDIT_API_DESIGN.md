# Audit Log API Design Specification

## Executive Summary

This document specifies a comprehensive audit log API designed for the Zmanim platform. The design incorporates best practices from industry leaders (Stripe, GitHub, Auth0) and is optimized for the existing action reification architecture.

## Research Sources

This design is informed by:

- **Stripe API**: Cursor-based pagination, event filtering ([Stripe Pagination](https://docs.stripe.com/api/pagination), [Events API](https://docs.stripe.com/api/events))
- **GitHub Audit Logs**: Query syntax, event type filtering, organization scoping ([GitHub Audit Log API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise))
- **Auth0 Logs**: Lucene-style query language, log retention ([Auth0 Log Search](https://auth0.com/docs/deploy-monitor/logs/log-search-query-syntax))
- **Microsoft/GitHub Export**: CSV/JSON export formats, compression strategies ([GitHub Audit Export](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/exporting-audit-log-activity-for-your-enterprise))
- **Cursor Pagination Performance**: 17x performance improvement over offset pagination for deep pages ([Understanding Cursor Pagination](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive))

## Existing Infrastructure

### Database Schema

The platform already has a robust `actions` table:

```sql
CREATE TABLE public.actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type character varying(50) NOT NULL,
    concept character varying(50) NOT NULL,
    user_id text,
    publisher_id integer,
    request_id uuid NOT NULL,
    parent_action_id uuid,
    entity_type character varying(50),
    entity_id text,
    payload jsonb,
    result jsonb,
    status character varying(20) DEFAULT 'pending',
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    metadata jsonb
);
```

### Existing Queries

Current audit queries in `actions.sql`:
- `GetAdminAuditLog` - Admin activity with filtering (offset pagination)
- `GetPublisherActivities` - Publisher-scoped activities (offset pagination)
- `GetEntityAuditTrail` - Entity-specific audit trail
- `GetAllAuditLog` - Platform-wide audit log

**Gap**: Need cursor-based pagination for performance and export functionality.

---

## API Design

### Endpoint Structure

```
/api/v1/admin/audit-logs          # Admin view (all activities)
/api/v1/publisher/audit-logs      # Publisher view (own activities)
/api/v1/audit-logs/:id            # Single event details
/api/v1/admin/audit-logs/export   # Admin export
/api/v1/publisher/audit-logs/export # Publisher export
```

---

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: Zmanim Audit Log API
  version: 1.0.0
  description: |
    Comprehensive audit logging API for tracking all platform activities.
    Supports filtering, cursor-based pagination, and CSV/JSON export.

servers:
  - url: https://zmanim.shtetl.io/api/v1
    description: Production
  - url: http://localhost:8080/api/v1
    description: Development

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    AuditLogEntry:
      type: object
      required:
        - id
        - action_type
        - concept
        - status
        - started_at
      properties:
        id:
          type: string
          format: uuid
          description: Unique audit log entry ID
          example: "550e8400-e29b-41d4-a716-446655440000"
        action_type:
          type: string
          maxLength: 50
          description: Type of action performed
          example: "zman_update"
        concept:
          type: string
          maxLength: 50
          description: Business concept (publisher, admin, zman)
          example: "publisher"
        user_id:
          type: string
          nullable: true
          description: Clerk user ID who performed the action
          example: "user_2abc123xyz"
        publisher_id:
          type: integer
          nullable: true
          description: Publisher ID associated with the action
          example: 42
        entity_type:
          type: string
          nullable: true
          maxLength: 50
          description: Type of entity affected
          example: "publisher_zman"
        entity_id:
          type: string
          nullable: true
          description: ID of the affected entity
          example: "123"
        status:
          type: string
          enum: [pending, completed, failed]
          description: Action completion status
          example: "completed"
        started_at:
          type: string
          format: date-time
          description: When the action started (ISO 8601)
          example: "2025-12-26T10:30:00Z"
        completed_at:
          type: string
          format: date-time
          nullable: true
          description: When the action completed
          example: "2025-12-26T10:30:01.234Z"
        duration_ms:
          type: integer
          nullable: true
          description: Action duration in milliseconds
          example: 1234
        error_message:
          type: string
          nullable: true
          description: Error message if action failed
          example: "Validation failed: formula syntax error"
        payload:
          type: object
          nullable: true
          description: Input data for the action (JSON)
          example:
            formula: "sunrise + 30min"
            hebrew_name: "זמן א'"
        result:
          type: object
          nullable: true
          description: Result data from the action (JSON)
          example:
            zman_id: "123"
            updated_fields: ["formula", "hebrew_name"]
        metadata:
          type: object
          nullable: true
          description: Additional metadata (IP, user agent, etc.)
          example:
            ip_address: "203.0.113.42"
            user_agent: "Mozilla/5.0..."
            actor_name: "Rabbi Cohen"

    AuditLogList:
      type: object
      required:
        - entries
        - pagination
      properties:
        entries:
          type: array
          items:
            $ref: '#/components/schemas/AuditLogEntry'
        pagination:
          type: object
          required:
            - total
            - page_size
          properties:
            total:
              type: integer
              description: Total number of matching entries
              example: 1543
            page_size:
              type: integer
              description: Number of entries per page
              example: 50
            next_cursor:
              type: string
              nullable: true
              description: Cursor for next page (base64-encoded timestamp+ID)
              example: "MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
            prev_cursor:
              type: string
              nullable: true
              description: Cursor for previous page
              example: "MTcwMzU4NjUwMDAwMF80NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="

    ExportRequest:
      type: object
      required:
        - format
      properties:
        format:
          type: string
          enum: [json, csv]
          description: Export format
          example: "csv"
        filters:
          type: object
          description: Same filters as list endpoint
          properties:
            action_type:
              type: string
              example: "zman_update"
            user_id:
              type: string
              example: "user_2abc123xyz"
            from:
              type: string
              format: date-time
              example: "2025-12-01T00:00:00Z"
            to:
              type: string
              format: date-time
              example: "2025-12-31T23:59:59Z"

    ExportResponse:
      type: object
      required:
        - export_id
        - status
        - requested_at
      properties:
        export_id:
          type: string
          format: uuid
          description: Unique export job ID
          example: "660e8400-e29b-41d4-a716-446655440000"
        status:
          type: string
          enum: [pending, processing, completed, failed]
          description: Export job status
          example: "processing"
        requested_at:
          type: string
          format: date-time
          description: When export was requested
          example: "2025-12-26T10:30:00Z"
        download_url:
          type: string
          nullable: true
          description: Signed URL for download (available when status=completed)
          example: "https://zmanim.shtetl.io/exports/audit-2025-12-26.csv.gz"
        expires_at:
          type: string
          format: date-time
          nullable: true
          description: When download URL expires
          example: "2025-12-26T22:30:00Z"
        entry_count:
          type: integer
          nullable: true
          description: Number of entries in export
          example: 15432

    APIError:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "Invalid date range: 'from' must be before 'to'"
        details:
          type: object
          nullable: true
          example:
            field: "from"
            constraint: "must_be_before_to"

paths:
  /admin/audit-logs:
    get:
      summary: List all audit log entries (admin only)
      description: |
        Returns paginated audit log entries for all platform activities.
        Supports cursor-based pagination for optimal performance.
      tags:
        - Admin Audit Logs
      security:
        - BearerAuth: []
      parameters:
        - name: action_type
          in: query
          schema:
            type: string
          description: Filter by action type (exact match)
          example: "zman_update"
        - name: concept
          in: query
          schema:
            type: string
          description: Filter by business concept
          example: "publisher"
        - name: user_id
          in: query
          schema:
            type: string
          description: Filter by user ID
          example: "user_2abc123xyz"
        - name: publisher_id
          in: query
          schema:
            type: integer
          description: Filter by publisher ID
          example: 42
        - name: entity_type
          in: query
          schema:
            type: string
          description: Filter by entity type
          example: "publisher_zman"
        - name: entity_id
          in: query
          schema:
            type: string
          description: Filter by entity ID
          example: "123"
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, completed, failed]
          description: Filter by action status
          example: "completed"
        - name: from
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by start date (inclusive, ISO 8601)
          example: "2025-12-01T00:00:00Z"
        - name: to
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by end date (inclusive, ISO 8601)
          example: "2025-12-31T23:59:59Z"
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
          description: Number of entries per page
          example: 50
        - name: cursor
          in: query
          schema:
            type: string
          description: Cursor for pagination (from previous response)
          example: "MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditLogList'
                  meta:
                    type: object
                    properties:
                      timestamp:
                        type: string
                        format: date-time
                      request_id:
                        type: string
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    $ref: '#/components/schemas/APIError'
        '403':
          description: Forbidden - admin role required
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    $ref: '#/components/schemas/APIError'
        '429':
          description: Rate limit exceeded
          headers:
            Retry-After:
              schema:
                type: integer
              description: Seconds until rate limit resets
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    $ref: '#/components/schemas/APIError'

  /publisher/audit-logs:
    get:
      summary: List audit log entries for authenticated publisher
      description: |
        Returns paginated audit log entries for the authenticated publisher's activities.
        Automatically filtered by publisher_id from X-Publisher-Id header.
      tags:
        - Publisher Audit Logs
      security:
        - BearerAuth: []
      parameters:
        - name: X-Publisher-Id
          in: header
          required: true
          schema:
            type: string
          description: Publisher ID (validated against JWT)
          example: "42"
        - name: action_type
          in: query
          schema:
            type: string
          description: Filter by action type
          example: "zman_update"
        - name: user_id
          in: query
          schema:
            type: string
          description: Filter by user ID (must be team member)
          example: "user_2abc123xyz"
        - name: entity_type
          in: query
          schema:
            type: string
          description: Filter by entity type
          example: "publisher_zman"
        - name: entity_id
          in: query
          schema:
            type: string
          description: Filter by entity ID
          example: "123"
        - name: from
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by start date (ISO 8601)
          example: "2025-12-01T00:00:00Z"
        - name: to
          in: query
          schema:
            type: string
            format: date-time
          description: Filter by end date (ISO 8601)
          example: "2025-12-31T23:59:59Z"
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 50
          description: Number of entries per page
        - name: cursor
          in: query
          schema:
            type: string
          description: Cursor for pagination
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditLogList'
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - invalid publisher ID

  /audit-logs/{id}:
    get:
      summary: Get single audit log entry details
      description: |
        Returns detailed information for a specific audit log entry.
        Access control: Admin can access all, publishers can only access their own.
      tags:
        - Audit Logs
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: Audit log entry ID
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: X-Publisher-Id
          in: header
          schema:
            type: string
          description: Publisher ID (for publisher access)
          example: "42"
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/AuditLogEntry'
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - not allowed to access this entry
        '404':
          description: Audit log entry not found

  /admin/audit-logs/export:
    post:
      summary: Export audit logs to CSV or JSON (admin only)
      description: |
        Creates an asynchronous export job for audit logs.
        Large exports (>100k entries) are automatically split and compressed.
        Download URL is valid for 12 hours.
      tags:
        - Admin Audit Logs
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExportRequest'
      responses:
        '202':
          description: Export job created (async processing)
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ExportResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized
        '403':
          description: Forbidden - admin role required
        '429':
          description: Rate limit exceeded (max 10 exports/hour)

  /publisher/audit-logs/export:
    post:
      summary: Export publisher audit logs to CSV or JSON
      description: |
        Creates an export job for the authenticated publisher's audit logs.
        Automatically filtered by publisher_id.
      tags:
        - Publisher Audit Logs
      security:
        - BearerAuth: []
      parameters:
        - name: X-Publisher-Id
          in: header
          required: true
          schema:
            type: string
          description: Publisher ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExportRequest'
      responses:
        '202':
          description: Export job created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/ExportResponse'
        '400':
          description: Invalid request
        '401':
          description: Unauthorized
        '403':
          description: Forbidden
        '429':
          description: Rate limit exceeded (max 5 exports/hour)
```

---

## Query Parameter Design & Validation

### Filter Parameters

| Parameter | Type | Validation | Example | Notes |
|-----------|------|------------|---------|-------|
| `action_type` | string | max 50 chars, alphanumeric + underscore | `zman_update` | Exact match |
| `concept` | string | max 50 chars, enum validation | `publisher`, `admin`, `zman` | Business domain |
| `user_id` | string | Clerk user ID format | `user_2abc123xyz` | Actor filter |
| `publisher_id` | integer | positive int32 | `42` | Publisher scope |
| `entity_type` | string | max 50 chars | `publisher_zman` | Entity filter |
| `entity_id` | string | max 255 chars | `123` | Entity instance |
| `status` | string | enum: pending, completed, failed | `completed` | Completion status |
| `from` | datetime | ISO 8601, must be < `to` | `2025-12-01T00:00:00Z` | Start date (inclusive) |
| `to` | datetime | ISO 8601, must be > `from` | `2025-12-31T23:59:59Z` | End date (inclusive) |

### Pagination Parameters

| Parameter | Type | Validation | Default | Max | Notes |
|-----------|------|------------|---------|-----|-------|
| `limit` | integer | 1-100 | 50 | 100 | Page size |
| `cursor` | string | base64-encoded | - | - | Opaque cursor token |

### Validation Rules

```go
type AuditLogFilters struct {
    ActionType  *string    `json:"action_type" validate:"omitempty,max=50,alphanum_underscore"`
    Concept     *string    `json:"concept" validate:"omitempty,oneof=publisher admin zman"`
    UserID      *string    `json:"user_id" validate:"omitempty,clerk_user_id"`
    PublisherID *int32     `json:"publisher_id" validate:"omitempty,gt=0"`
    EntityType  *string    `json:"entity_type" validate:"omitempty,max=50"`
    EntityID    *string    `json:"entity_id" validate:"omitempty,max=255"`
    Status      *string    `json:"status" validate:"omitempty,oneof=pending completed failed"`
    From        *time.Time `json:"from" validate:"omitempty,before_field=To"`
    To          *time.Time `json:"to" validate:"omitempty,after_field=From"`
}

type PaginationParams struct {
    Limit  int    `json:"limit" validate:"min=1,max=100"`
    Cursor string `json:"cursor" validate:"omitempty,base64"`
}
```

### Validation Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "from": "must be before 'to'",
      "limit": "must be between 1 and 100"
    }
  }
}
```

---

## Cursor-Based Pagination Implementation

### Why Cursor-Based?

Based on research findings:
- **17x faster** for deep pages vs offset pagination
- **Consistent performance** regardless of page depth
- **Data consistency** - no skipped/duplicate entries when data changes
- **GitHub standard** - 1,750 queries/hour rate limit per user+IP

### Cursor Format

```
Cursor = Base64(timestamp_ms + "_" + uuid)
Example: MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA=
Decoded: 1703586600000_550e8400-e29b-41d4-a716-446655440000
```

### SQL Implementation

```sql
-- name: GetAuditLogCursorBased :many
-- Returns audit log entries using cursor-based pagination
-- Cursor format: base64(started_at_ms + "_" + id)
SELECT
    id,
    action_type,
    concept,
    user_id,
    publisher_id,
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
    -- Filters
    (sqlc.narg('action_type_filter')::text IS NULL OR action_type = sqlc.narg('action_type_filter'))
    AND (sqlc.narg('concept_filter')::text IS NULL OR concept = sqlc.narg('concept_filter'))
    AND (sqlc.narg('user_id_filter')::text IS NULL OR user_id = sqlc.narg('user_id_filter'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('entity_type_filter')::text IS NULL OR entity_type = sqlc.narg('entity_type_filter'))
    AND (sqlc.narg('entity_id_filter')::text IS NULL OR entity_id = sqlc.narg('entity_id_filter'))
    AND (sqlc.narg('status_filter')::text IS NULL OR status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR started_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR started_at <= sqlc.narg('to_date'))

    -- Cursor pagination (combined started_at + id for stable sorting)
    AND (
        sqlc.narg('cursor_timestamp')::timestamptz IS NULL
        OR (started_at, id) < (sqlc.narg('cursor_timestamp'), sqlc.narg('cursor_id')::uuid)
    )
ORDER BY started_at DESC, id DESC
LIMIT sqlc.arg('limit_val') + 1; -- Fetch one extra to determine if more pages exist

-- name: CountAuditLogEntries :one
-- Returns total count for pagination metadata
SELECT COUNT(*)::bigint
FROM public.actions
WHERE
    (sqlc.narg('action_type_filter')::text IS NULL OR action_type = sqlc.narg('action_type_filter'))
    AND (sqlc.narg('concept_filter')::text IS NULL OR concept = sqlc.narg('concept_filter'))
    AND (sqlc.narg('user_id_filter')::text IS NULL OR user_id = sqlc.narg('user_id_filter'))
    AND (sqlc.narg('publisher_id_filter')::integer IS NULL OR publisher_id = sqlc.narg('publisher_id_filter'))
    AND (sqlc.narg('entity_type_filter')::text IS NULL OR entity_type = sqlc.narg('entity_type_filter'))
    AND (sqlc.narg('entity_id_filter')::text IS NULL OR entity_id = sqlc.narg('entity_id_filter'))
    AND (sqlc.narg('status_filter')::text IS NULL OR status = sqlc.narg('status_filter'))
    AND (sqlc.narg('from_date')::timestamptz IS NULL OR started_at >= sqlc.narg('from_date'))
    AND (sqlc.narg('to_date')::timestamptz IS NULL OR started_at <= sqlc.narg('to_date'));
```

### Go Handler Implementation

```go
// GetAdminAuditLogs handles GET /api/v1/admin/audit-logs
func (h *Handlers) GetAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Parse and validate query parameters
    filters, paging, err := parseAuditLogParams(r)
    if err != nil {
        RespondValidationError(w, r, "Invalid query parameters", err)
        return
    }

    // 2. Decode cursor (if present)
    var cursorTimestamp *time.Time
    var cursorID *uuid.UUID
    if paging.Cursor != "" {
        ts, id, err := decodeCursor(paging.Cursor)
        if err != nil {
            RespondBadRequest(w, r, "Invalid cursor")
            return
        }
        cursorTimestamp = &ts
        cursorID = &id
    }

    // 3. Query with cursor pagination
    rows, err := h.db.Queries.GetAuditLogCursorBased(ctx, sqlcgen.GetAuditLogCursorBasedParams{
        ActionTypeFilter:   filters.ActionType,
        ConceptFilter:      filters.Concept,
        UserIDFilter:       filters.UserID,
        PublisherIDFilter:  filters.PublisherID,
        EntityTypeFilter:   filters.EntityType,
        EntityIDFilter:     filters.EntityID,
        StatusFilter:       filters.Status,
        FromDate:           toPgTimestamptz(filters.From),
        ToDate:             toPgTimestamptz(filters.To),
        CursorTimestamp:    toPgTimestamptz(cursorTimestamp),
        CursorID:           cursorID,
        LimitVal:           int32(paging.Limit),
    })
    if err != nil {
        slog.Error("failed to get audit logs", "error", err)
        RespondInternalError(w, r, "Failed to retrieve audit logs")
        return
    }

    // 4. Get total count (cached for 5 minutes)
    total, err := h.db.Queries.CountAuditLogEntries(ctx, sqlcgen.CountAuditLogEntriesParams{
        ActionTypeFilter:  filters.ActionType,
        ConceptFilter:     filters.Concept,
        UserIDFilter:      filters.UserID,
        PublisherIDFilter: filters.PublisherID,
        EntityTypeFilter:  filters.EntityType,
        EntityIDFilter:    filters.EntityID,
        StatusFilter:      filters.Status,
        FromDate:          toPgTimestamptz(filters.From),
        ToDate:            toPgTimestamptz(filters.To),
    })
    if err != nil {
        total = 0 // Non-critical, continue without count
    }

    // 5. Build response with next cursor
    hasMore := len(rows) > paging.Limit
    if hasMore {
        rows = rows[:paging.Limit] // Trim extra row
    }

    var nextCursor *string
    if hasMore && len(rows) > 0 {
        lastRow := rows[len(rows)-1]
        cursor := encodeCursor(lastRow.StartedAt.Time, lastRow.ID)
        nextCursor = &cursor
    }

    // 6. Format entries
    entries := make([]map[string]interface{}, 0, len(rows))
    for _, row := range rows {
        entry := formatAuditLogEntry(row)
        entries = append(entries, entry)
    }

    // 7. Respond
    RespondJSON(w, r, http.StatusOK, map[string]interface{}{
        "entries": entries,
        "pagination": map[string]interface{}{
            "total":       total,
            "page_size":   paging.Limit,
            "next_cursor": nextCursor,
        },
    })
}

// Helper: Encode cursor
func encodeCursor(timestamp time.Time, id uuid.UUID) string {
    timestampMs := timestamp.UnixMilli()
    raw := fmt.Sprintf("%d_%s", timestampMs, id.String())
    return base64.StdEncoding.EncodeToString([]byte(raw))
}

// Helper: Decode cursor
func decodeCursor(cursor string) (time.Time, uuid.UUID, error) {
    decoded, err := base64.StdEncoding.DecodeString(cursor)
    if err != nil {
        return time.Time{}, uuid.Nil, err
    }

    parts := strings.Split(string(decoded), "_")
    if len(parts) != 2 {
        return time.Time{}, uuid.Nil, errors.New("invalid cursor format")
    }

    timestampMs, err := strconv.ParseInt(parts[0], 10, 64)
    if err != nil {
        return time.Time{}, uuid.Nil, err
    }

    id, err := uuid.Parse(parts[1])
    if err != nil {
        return time.Time{}, uuid.Nil, err
    }

    timestamp := time.UnixMilli(timestampMs)
    return timestamp, id, nil
}
```

### Required Index

```sql
-- Composite index for cursor pagination performance
CREATE INDEX idx_actions_cursor_pagination
ON public.actions (started_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- Additional indexes for common filters
CREATE INDEX idx_actions_action_type ON public.actions (action_type);
CREATE INDEX idx_actions_publisher_id ON public.actions (publisher_id);
CREATE INDEX idx_actions_user_id ON public.actions (user_id);
CREATE INDEX idx_actions_entity ON public.actions (entity_type, entity_id);
```

---

## Export Functionality

### Design Principles

Based on industry best practices:
- **Async processing** for large exports (>10k entries)
- **Automatic compression** for exports >100k entries
- **Newline-delimited JSON** for streaming/chunked processing
- **12-hour expiry** on download URLs

### Export Flow

```
1. POST /api/v1/admin/audit-logs/export
   → Returns export_id, status=pending

2. Background job processes export
   → Queries in batches of 10k
   → Writes to S3/local storage
   → Compresses if >100k entries

3. GET /api/v1/admin/audit-logs/export/{export_id}
   → Returns status, download_url (when ready)

4. User downloads via signed URL
   → Auto-expires after 12 hours
```

### Database Schema for Export Jobs

```sql
CREATE TABLE public.audit_log_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id text NOT NULL,
    publisher_id integer, -- NULL for admin exports
    format character varying(10) NOT NULL, -- 'json' or 'csv'
    filters jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending' NOT NULL,
    file_path text,
    file_size_bytes bigint,
    entry_count integer,
    error_message text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone, -- Download URL expiry
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_log_exports_user ON public.audit_log_exports (user_id, requested_at DESC);
CREATE INDEX idx_audit_log_exports_status ON public.audit_log_exports (status) WHERE status IN ('pending', 'processing');
```

### CSV Export Format

```csv
id,action_type,concept,user_id,publisher_id,entity_type,entity_id,status,started_at,completed_at,duration_ms,error_message,payload,result,metadata
550e8400-e29b-41d4-a716-446655440000,zman_update,publisher,user_2abc123xyz,42,publisher_zman,123,completed,2025-12-26T10:30:00Z,2025-12-26T10:30:01.234Z,1234,,"{""formula"":""sunrise + 30min""}","{""zman_id"":""123""}","{""ip_address"":""203.0.113.42""}"
```

### JSON Export Format (Newline-Delimited)

```jsonl
{"id":"550e8400-e29b-41d4-a716-446655440000","action_type":"zman_update","concept":"publisher","user_id":"user_2abc123xyz","publisher_id":42,"entity_type":"publisher_zman","entity_id":"123","status":"completed","started_at":"2025-12-26T10:30:00Z","completed_at":"2025-12-26T10:30:01.234Z","duration_ms":1234,"payload":{"formula":"sunrise + 30min"},"result":{"zman_id":"123"},"metadata":{"ip_address":"203.0.113.42"}}
{"id":"660e8400-e29b-41d4-a716-446655440001","action_type":"zman_create","concept":"publisher","user_id":"user_2abc123xyz","publisher_id":42,"entity_type":"publisher_zman","entity_id":"124","status":"completed","started_at":"2025-12-26T10:29:00Z","completed_at":"2025-12-26T10:29:00.567Z","duration_ms":567,"payload":{"formula":"sunset - 18min"},"result":{"zman_id":"124"},"metadata":{"ip_address":"203.0.113.42"}}
```

### Export Handler

```go
// CreateAuditLogExport handles POST /api/v1/admin/audit-logs/export
func (h *Handlers) CreateAuditLogExport(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Parse request
    var req ExportRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 2. Validate format
    if req.Format != "json" && req.Format != "csv" {
        RespondValidationError(w, r, "format must be 'json' or 'csv'", nil)
        return
    }

    // 3. Get user ID
    userID := middleware.GetUserID(ctx)

    // 4. Create export job
    exportID := uuid.New()
    filtersJSON, _ := json.Marshal(req.Filters)

    _, err := h.db.Queries.CreateAuditLogExport(ctx, sqlcgen.CreateAuditLogExportParams{
        ID:        exportID,
        UserID:    userID,
        Format:    req.Format,
        Filters:   filtersJSON,
    })
    if err != nil {
        slog.Error("failed to create export job", "error", err)
        RespondInternalError(w, r, "Failed to create export")
        return
    }

    // 5. Trigger async processing
    go h.processAuditLogExport(context.Background(), exportID)

    // 6. Respond immediately
    RespondJSON(w, r, http.StatusAccepted, map[string]interface{}{
        "export_id":    exportID,
        "status":       "pending",
        "requested_at": time.Now().UTC(),
    })
}

// Background job processor
func (h *Handlers) processAuditLogExport(ctx context.Context, exportID uuid.UUID) {
    // Mark as processing
    _ = h.db.Queries.UpdateExportStatus(ctx, sqlcgen.UpdateExportStatusParams{
        ID:        exportID,
        Status:    "processing",
        StartedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
    })

    // Get export job details
    job, err := h.db.Queries.GetAuditLogExport(ctx, exportID)
    if err != nil {
        h.failExport(ctx, exportID, err)
        return
    }

    // Parse filters
    var filters AuditLogFilters
    json.Unmarshal(job.Filters, &filters)

    // Create temp file
    filename := fmt.Sprintf("audit-export-%s.%s", exportID, job.Format)
    filePath := filepath.Join(os.TempDir(), filename)

    file, err := os.Create(filePath)
    if err != nil {
        h.failExport(ctx, exportID, err)
        return
    }
    defer file.Close()

    // Create gzip writer for compression
    gzWriter := gzip.NewWriter(file)
    defer gzWriter.Close()

    var writer io.Writer
    if job.Format == "csv" {
        csvWriter := csv.NewWriter(gzWriter)
        defer csvWriter.Flush()

        // Write CSV header
        csvWriter.Write([]string{
            "id", "action_type", "concept", "user_id", "publisher_id",
            "entity_type", "entity_id", "status", "started_at", "completed_at",
            "duration_ms", "error_message", "payload", "result", "metadata",
        })

        writer = csvWriter
    } else {
        writer = gzWriter
    }

    // Stream data in batches
    const batchSize = 10000
    var cursor *string
    totalCount := 0

    for {
        rows, nextCursor, err := h.fetchAuditLogBatch(ctx, filters, cursor, batchSize)
        if err != nil {
            h.failExport(ctx, exportID, err)
            return
        }

        if len(rows) == 0 {
            break
        }

        // Write batch
        for _, row := range rows {
            if job.Format == "csv" {
                h.writeCSVRow(writer.(*csv.Writer), row)
            } else {
                h.writeJSONLine(writer, row)
            }
            totalCount++
        }

        if nextCursor == nil {
            break
        }
        cursor = nextCursor
    }

    // Get file size
    fileInfo, _ := file.Stat()
    fileSize := fileInfo.Size()

    // Upload to S3 (or keep local)
    downloadURL := h.generateDownloadURL(filePath)
    expiresAt := time.Now().Add(12 * time.Hour)

    // Mark as completed
    _ = h.db.Queries.CompleteAuditLogExport(ctx, sqlcgen.CompleteAuditLogExportParams{
        ID:          exportID,
        Status:      "completed",
        FilePath:    downloadURL,
        FileSizeBytes: &fileSize,
        EntryCount:  &totalCount,
        CompletedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
        ExpiresAt:   pgtype.Timestamptz{Time: expiresAt, Valid: true},
    })

    slog.Info("audit log export completed",
        "export_id", exportID,
        "entry_count", totalCount,
        "file_size_mb", fileSize/1024/1024)
}
```

---

## Performance Considerations

### Query Optimization

1. **Index Strategy**
   - Composite index: `(started_at DESC, id DESC)` for cursor pagination
   - Single-column indexes: `action_type`, `publisher_id`, `user_id`
   - Entity lookups: `(entity_type, entity_id)`

2. **Query Performance**
   - Cursor pagination: O(1) for any page depth
   - Offset pagination: O(n) - degrades linearly
   - Expected: <50ms for p95 with proper indexes

3. **Count Query Optimization**
   - Cache counts for 5 minutes (Redis)
   - Skip count for large datasets (>1M rows)
   - Return estimated count from pg_stat

### Caching Strategy

```go
type CacheStrategy struct {
    // Count queries - cache for 5 minutes
    CountTTL time.Duration = 5 * time.Minute

    // Metadata (action types, concepts) - cache for 1 hour
    MetadataTTL time.Duration = 1 * time.Hour

    // Individual entries - no caching (always fresh)
    EntryCacheTTL time.Duration = 0
}

// Cache key format
func buildCacheKey(filters AuditLogFilters) string {
    hash := sha256.Sum256([]byte(fmt.Sprintf("%+v", filters)))
    return fmt.Sprintf("audit:count:%x", hash[:8])
}
```

### Database Performance

```sql
-- Analyze query plan
EXPLAIN ANALYZE
SELECT * FROM public.actions
WHERE started_at >= '2025-12-01'
  AND started_at <= '2025-12-31'
  AND publisher_id = 42
ORDER BY started_at DESC, id DESC
LIMIT 50;

-- Expected plan:
-- Index Scan using idx_actions_cursor_pagination
-- Filter: publisher_id = 42
-- Rows: 50, Time: <50ms
```

### Scaling Considerations

| Metric | Target | Notes |
|--------|--------|-------|
| Response time (p50) | <20ms | With warm cache |
| Response time (p95) | <50ms | Cold cache |
| Response time (p99) | <100ms | Heavy filters |
| Throughput | 1000 req/s | Per server |
| Export job time | <5min | For 100k entries |
| Max export size | 10M entries | Split into chunks |

---

## Rate Limiting Strategy

### Rate Limit Tiers

Based on GitHub's approach (1,750 queries/hour):

| Endpoint | Admin | Publisher | Notes |
|----------|-------|-----------|-------|
| `GET /admin/audit-logs` | 2000/hour | - | ~33 req/min |
| `GET /publisher/audit-logs` | - | 1000/hour | ~16 req/min |
| `GET /audit-logs/:id` | 5000/hour | 2000/hour | Higher for details |
| `POST /admin/audit-logs/export` | 10/hour | - | Resource intensive |
| `POST /publisher/audit-logs/export` | - | 5/hour | Resource intensive |

### Implementation

```go
// Rate limit middleware
func (h *Handlers) AuditLogRateLimit(next http.Handler) http.Handler {
    limiter := rate.NewLimiter(rate.Every(time.Hour/2000), 10) // 2000/hour, burst 10

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !limiter.Allow() {
            RespondRateLimited(w, r, 3600) // Retry after 1 hour
            return
        }
        next.ServeHTTP(w, r)
    })
}

// Per-user rate limiting (Redis-backed)
func (h *Handlers) PerUserRateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := middleware.GetUserID(r.Context())
            key := fmt.Sprintf("ratelimit:audit:%s", userID)

            count, err := h.redis.Incr(r.Context(), key).Result()
            if err == nil && count == 1 {
                h.redis.Expire(r.Context(), key, window)
            }

            if count > int64(limit) {
                RespondRateLimited(w, r, int(window.Seconds()))
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Rate Limit Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 2000
X-RateLimit-Remaining: 1847
X-RateLimit-Reset: 1703620800
X-RateLimit-Resource: audit-logs
```

---

## Error Response Formats

### Standard Error Structure

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "specific error details"
    }
  },
  "meta": {
    "timestamp": "2025-12-26T10:30:00Z",
    "request_id": "req_abc123xyz"
  }
}
```

### Error Codes

| Code | HTTP Status | Description | Example |
|------|-------------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Invalid query parameters | Invalid date range |
| `BAD_REQUEST` | 400 | Malformed request | Invalid JSON |
| `UNAUTHORIZED` | 401 | Missing/invalid auth | No Bearer token |
| `FORBIDDEN` | 403 | Insufficient permissions | Not admin |
| `NOT_FOUND` | 404 | Resource not found | Audit log ID not found |
| `RATE_LIMITED` | 429 | Too many requests | Exceeded 2000/hour |
| `INTERNAL_ERROR` | 500 | Server error | Database connection failed |

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "from": "must be before 'to'",
      "limit": "must be between 1 and 100",
      "action_type": "must contain only alphanumeric characters and underscores"
    }
  }
}
```

### Rate Limit Error

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 2000,
      "window": "1 hour",
      "retry_after_seconds": 1847
    }
  }
}
```

---

## Example Requests & Responses

### Example 1: List Admin Audit Logs

**Request:**
```http
GET /api/v1/admin/audit-logs?action_type=zman_update&from=2025-12-01T00:00:00Z&to=2025-12-31T23:59:59Z&limit=10
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "data": {
    "entries": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "action_type": "zman_update",
        "concept": "publisher",
        "user_id": "user_2abc123xyz",
        "publisher_id": 42,
        "entity_type": "publisher_zman",
        "entity_id": "123",
        "status": "completed",
        "started_at": "2025-12-26T10:30:00Z",
        "completed_at": "2025-12-26T10:30:01.234Z",
        "duration_ms": 1234,
        "payload": {
          "formula": "sunrise + 30min",
          "hebrew_name": "זמן א'"
        },
        "result": {
          "zman_id": "123",
          "updated_fields": ["formula", "hebrew_name"]
        },
        "metadata": {
          "ip_address": "203.0.113.42",
          "user_agent": "Mozilla/5.0...",
          "actor_name": "Rabbi Cohen"
        }
      }
    ],
    "pagination": {
      "total": 543,
      "page_size": 10,
      "next_cursor": "MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
    }
  },
  "meta": {
    "timestamp": "2025-12-26T15:45:00Z",
    "request_id": "req_xyz789"
  }
}
```

### Example 2: Get Single Audit Log Entry

**Request:**
```http
GET /api/v1/audit-logs/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "action_type": "zman_update",
    "concept": "publisher",
    "user_id": "user_2abc123xyz",
    "publisher_id": 42,
    "request_id": "660e8400-e29b-41d4-a716-446655440001",
    "parent_action_id": null,
    "entity_type": "publisher_zman",
    "entity_id": "123",
    "status": "completed",
    "started_at": "2025-12-26T10:30:00Z",
    "completed_at": "2025-12-26T10:30:01.234Z",
    "duration_ms": 1234,
    "error_message": null,
    "payload": {
      "formula": "sunrise + 30min",
      "hebrew_name": "זמן א'",
      "english_name_ashkenazi": "Zman A"
    },
    "result": {
      "zman_id": "123",
      "updated_fields": ["formula", "hebrew_name", "english_name_ashkenazi"],
      "old_values": {
        "formula": "sunrise + 20min"
      },
      "new_values": {
        "formula": "sunrise + 30min"
      }
    },
    "metadata": {
      "ip_address": "203.0.113.42",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "actor_name": "Rabbi Cohen",
      "actor_email": "rabbi@example.com"
    }
  },
  "meta": {
    "timestamp": "2025-12-26T15:46:00Z",
    "request_id": "req_abc456"
  }
}
```

### Example 3: Publisher Audit Logs

**Request:**
```http
GET /api/v1/publisher/audit-logs?entity_type=publisher_zman&limit=20
Authorization: Bearer eyJhbGc...
X-Publisher-Id: 42
```

**Response:**
```json
{
  "data": {
    "entries": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "action_type": "zman_create",
        "concept": "publisher",
        "user_id": "user_2abc123xyz",
        "publisher_id": 42,
        "entity_type": "publisher_zman",
        "entity_id": "124",
        "status": "completed",
        "started_at": "2025-12-26T09:15:00Z",
        "completed_at": "2025-12-26T09:15:00.567Z",
        "duration_ms": 567,
        "payload": {
          "formula": "sunset - 18min",
          "master_zman_id": 5
        },
        "result": {
          "zman_id": "124"
        }
      }
    ],
    "pagination": {
      "total": 87,
      "page_size": 20,
      "next_cursor": "MTcwMzU4NTcwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
    }
  }
}
```

### Example 4: Export Audit Logs

**Request:**
```http
POST /api/v1/admin/audit-logs/export
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "format": "csv",
  "filters": {
    "action_type": "zman_update",
    "from": "2025-12-01T00:00:00Z",
    "to": "2025-12-31T23:59:59Z"
  }
}
```

**Response (202 Accepted):**
```json
{
  "data": {
    "export_id": "770e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "requested_at": "2025-12-26T15:50:00Z"
  }
}
```

**Follow-up Request:**
```http
GET /api/v1/admin/audit-logs/export/770e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGc...
```

**Response (Completed):**
```json
{
  "data": {
    "export_id": "770e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "requested_at": "2025-12-26T15:50:00Z",
    "completed_at": "2025-12-26T15:52:34Z",
    "download_url": "https://zmanim.shtetl.io/exports/audit-2025-12-26-770e8400.csv.gz",
    "expires_at": "2025-12-27T03:52:34Z",
    "entry_count": 15432,
    "file_size_mb": 2.4
  }
}
```

### Example 5: Cursor-Based Pagination

**Request (First Page):**
```http
GET /api/v1/admin/audit-logs?limit=50
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "data": {
    "entries": [ /* 50 entries */ ],
    "pagination": {
      "total": 5432,
      "page_size": 50,
      "next_cursor": "MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
    }
  }
}
```

**Request (Second Page):**
```http
GET /api/v1/admin/audit-logs?limit=50&cursor=MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA=
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "data": {
    "entries": [ /* Next 50 entries */ ],
    "pagination": {
      "total": 5432,
      "page_size": 50,
      "next_cursor": "MTcwMzU4NjUwMDAwMF80NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA=",
      "prev_cursor": "MTcwMzU4NjYwMDAwMF81NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDA="
    }
  }
}
```

---

## Security Considerations

### Access Control

1. **Admin Endpoints**
   - Require `admin` role in JWT claims
   - Access to all audit logs across all publishers
   - Can export unlimited data

2. **Publisher Endpoints**
   - Require valid `X-Publisher-Id` header
   - Auto-filter by `publisher_id` (cannot bypass)
   - Can only access own audit logs

3. **Sensitive Data Masking**
   - Mask passwords in payload/result
   - Redact API keys in metadata
   - Hide PII for non-admin users

### Data Retention

| Scope | Retention | Notes |
|-------|-----------|-------|
| Active logs | 90 days | Hot storage (PostgreSQL) |
| Archived logs | 7 years | Cold storage (S3 Glacier) |
| Export files | 12 hours | Auto-delete after expiry |
| Failed exports | 24 hours | For debugging |

### Compliance

- **GDPR**: Support user data deletion requests
- **SOC 2**: Immutable audit trail (no UPDATE/DELETE)
- **HIPAA**: Encrypt exports at rest and in transit
- **CCPA**: Allow users to export their data

---

## Migration Plan

### Phase 1: Add Cursor Pagination (Week 1)

1. Add indexes:
   ```sql
   CREATE INDEX idx_actions_cursor_pagination
   ON public.actions (started_at DESC, id DESC);
   ```

2. Add new queries to `actions.sql`:
   - `GetAuditLogCursorBased`
   - `CountAuditLogEntries`

3. Generate SQLc code:
   ```bash
   cd api && sqlc generate
   ```

### Phase 2: Implement Handlers (Week 2)

1. Create `audit_logs.go` handler
2. Add routes to `routes.go`:
   ```go
   r.Route("/admin/audit-logs", func(r chi.Router) {
       r.Use(h.RequireRole("admin"))
       r.Get("/", h.GetAdminAuditLogs)
       r.Post("/export", h.CreateAuditLogExport)
   })

   r.Route("/publisher/audit-logs", func(r chi.Router) {
       r.Use(h.RequireAuth)
       r.Get("/", h.GetPublisherAuditLogs)
       r.Post("/export", h.CreatePublisherAuditLogExport)
   })

   r.Get("/audit-logs/{id}", h.OptionalAuth(h.GetAuditLogEntry))
   ```

3. Add response types to `types.go`

### Phase 3: Export Infrastructure (Week 3)

1. Add `audit_log_exports` table migration
2. Implement export job processor
3. Set up S3 bucket (or local storage for dev)
4. Add background worker for export processing

### Phase 4: Rate Limiting (Week 4)

1. Implement Redis-backed rate limiter
2. Add rate limit middleware
3. Add rate limit headers to responses

### Phase 5: Frontend Integration (Week 5)

1. Add audit log viewer to admin dashboard
2. Add export functionality UI
3. Add filtering/search UI

---

## Testing Strategy

### Unit Tests

```go
func TestGetAuditLogCursorPagination(t *testing.T) {
    // Test cursor encoding/decoding
    // Test pagination with various filters
    // Test edge cases (empty results, invalid cursor)
}

func TestAuditLogFilters(t *testing.T) {
    // Test each filter parameter
    // Test filter combinations
    // Test validation errors
}

func TestExportGeneration(t *testing.T) {
    // Test CSV format
    // Test JSON format
    // Test compression
}
```

### Integration Tests

```bash
# Create test data
POST /api/v1/publisher/zmanim (create 100 zmanim)

# Test audit log creation
GET /api/v1/publisher/audit-logs
Expect: 100 zman_create actions

# Test pagination
GET /api/v1/publisher/audit-logs?limit=10
Expect: 10 entries, next_cursor present

# Test filters
GET /api/v1/publisher/audit-logs?action_type=zman_create&from=2025-12-01T00:00:00Z
Expect: Filtered results

# Test export
POST /api/v1/publisher/audit-logs/export {"format":"csv"}
GET /api/v1/publisher/audit-logs/export/{export_id}
Expect: download_url available
```

### Performance Tests

```bash
# Load test with k6
k6 run --vus 100 --duration 30s audit-log-load-test.js

# Test deep pagination
for i in {1..100}; do
    curl "/api/v1/admin/audit-logs?limit=1000&offset=$((i*1000))"
done

# Compare with cursor pagination
for i in {1..100}; do
    curl "/api/v1/admin/audit-logs?limit=1000&cursor=$CURSOR"
done
```

---

## Monitoring & Observability

### Metrics

```go
// Prometheus metrics
var (
    auditLogQueryDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "audit_log_query_duration_seconds",
            Help:    "Audit log query duration",
            Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 5},
        },
        []string{"endpoint", "status"},
    )

    auditLogExportCount = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "audit_log_exports_total",
            Help: "Total audit log exports",
        },
        []string{"format", "status"},
    )

    auditLogExportDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name:    "audit_log_export_duration_seconds",
            Help:    "Audit log export duration",
            Buckets: []float64{1, 5, 10, 30, 60, 300},
        },
    )
)
```

### Alerts

```yaml
# Prometheus alerts
groups:
  - name: audit_logs
    rules:
      - alert: AuditLogQuerySlow
        expr: histogram_quantile(0.95, audit_log_query_duration_seconds) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Audit log queries are slow"

      - alert: AuditLogExportFailing
        expr: rate(audit_log_exports_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High rate of audit log export failures"
```

### Logging

```go
slog.Info("audit log query",
    "endpoint", "/admin/audit-logs",
    "filters", filters,
    "duration_ms", duration,
    "entry_count", len(entries),
    "user_id", userID,
)

slog.Error("audit log export failed",
    "export_id", exportID,
    "error", err,
    "entry_count", totalCount,
    "duration_ms", duration,
)
```

---

## Future Enhancements

### Real-Time Updates (Phase 2)

**Option 1: Server-Sent Events (SSE)**
```http
GET /api/v1/admin/audit-logs/stream
Authorization: Bearer eyJhbGc...

> event: audit_log
> data: {"id":"...", "action_type":"zman_create", ...}

> event: audit_log
> data: {"id":"...", "action_type":"zman_update", ...}
```

**Option 2: WebSocket**
```javascript
const ws = new WebSocket('wss://zmanim.shtetl.io/api/v1/audit-logs/ws');
ws.onmessage = (event) => {
    const auditLog = JSON.parse(event.data);
    console.log('New audit log:', auditLog);
};
```

### Advanced Search (Phase 3)

**Lucene-Style Query Language** (inspired by Auth0):
```
GET /api/v1/admin/audit-logs?q=action_type:zman_* AND status:completed AND user_id:user_*
```

**Full-Text Search on Metadata**:
```sql
-- Add tsvector column
ALTER TABLE public.actions ADD COLUMN search_vector tsvector;

-- Populate search vector
UPDATE public.actions
SET search_vector = to_tsvector('english',
    coalesce(action_type, '') || ' ' ||
    coalesce(entity_type, '') || ' ' ||
    coalesce(metadata::text, '')
);

-- Create GIN index
CREATE INDEX idx_actions_search ON public.actions USING gin(search_vector);

-- Query
SELECT * FROM public.actions
WHERE search_vector @@ to_tsquery('english', 'zman & update');
```

### Retention Policies (Phase 4)

**Auto-Archive to S3 Glacier**:
```go
// Background job runs nightly
func (h *Handlers) archiveOldAuditLogs(ctx context.Context) {
    cutoffDate := time.Now().AddDate(0, 0, -90) // 90 days ago

    // Export to S3 Glacier
    entries, _ := h.db.Queries.GetOldAuditLogs(ctx, cutoffDate)
    h.exportToS3Glacier(entries)

    // Soft delete from hot storage
    h.db.Queries.ArchiveOldAuditLogs(ctx, cutoffDate)
}
```

### Anomaly Detection (Phase 5)

**ML-Based Anomaly Detection**:
- Unusual activity patterns (e.g., 100 zmanim created in 1 minute)
- Failed login attempts
- Bulk delete operations

```go
// Alert on suspicious activity
if activityCount > threshold {
    h.alertService.SendAlert("Suspicious activity detected",
        fmt.Sprintf("User %s performed %d %s actions in 1 minute",
            userID, activityCount, actionType))
}
```

---

## Conclusion

This audit log API design provides:

1. **Industry-standard pagination** - Cursor-based for optimal performance
2. **Comprehensive filtering** - Action type, user, date range, entity filters
3. **Export functionality** - CSV/JSON with automatic compression
4. **Security** - Role-based access, data masking, retention policies
5. **Performance** - <50ms p95 response times with proper indexes
6. **Observability** - Metrics, alerts, structured logging

The design leverages existing infrastructure (`actions` table, SQLc, middleware) and follows the established 6-step handler pattern for consistency.

### Key Differentiators

- **Cursor pagination**: 17x faster than offset for deep pages
- **Action reification**: Complete provenance tracking with parent chains
- **Publisher isolation**: Automatic filtering by publisher_id
- **Export scalability**: Handles 10M+ entries with chunking

### Next Steps

1. Review with team
2. Implement Phase 1 (cursor pagination)
3. Add handlers and routes
4. Build export infrastructure
5. Add frontend UI
6. Deploy and monitor

---

## References

- [Stripe API Pagination](https://docs.stripe.com/api/pagination)
- [GitHub Audit Log API](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/using-the-audit-log-api-for-your-enterprise)
- [Auth0 Log Search Query Syntax](https://auth0.com/docs/deploy-monitor/logs/log-search-query-syntax)
- [GitHub Audit Export](https://docs.github.com/en/enterprise-cloud@latest/admin/monitoring-activity-in-your-enterprise/reviewing-audit-logs-for-your-enterprise/exporting-audit-log-activity-for-your-enterprise)
- [Understanding Cursor Pagination](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive)
- [Stripe Events API](https://docs.stripe.com/api/events)
- [Auth0 Management API Logs](https://auth0.com/docs/api/management/v2/logs/get-logs)
