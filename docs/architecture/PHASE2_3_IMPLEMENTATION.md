# Phase 2 & 3 Implementation Guide

**Status:** ✅ **COMPLETED**
**Date:** December 7, 2025
**Phases:** Foundation (Phase 2) + UUID Pattern (Phase 3)

---

## Executive Summary

This document details the implementation of **Phase 2 (Foundation)** and **Phase 3 (UUID Pattern)** from the concept independence roadmap. These phases establish provenance tracking infrastructure and provide templates for UUID-based concepts.

**What Changed:**
- ✅ Action reification table for provenance tracking
- ✅ Request ID middleware for distributed tracing
- ✅ Geo abstraction layer with UUID references
- ✅ Service layer integration with action tracking
- ✅ UUID-based table template for new concepts

**Impact:**
- **Provenance:** Full audit trail of state-changing operations
- **Debugging:** Request-level tracking across services
- **Performance:** Geo abstraction reduces FK complexity
- **Future:** Template for UUID-based concepts ready

---

## Table of Contents

1. [Phase 2: Foundation](#phase-2-foundation)
2. [Phase 3: UUID Pattern](#phase-3-uuid-pattern)
3. [Integration Guide](#integration-guide)
4. [Testing Strategy](#testing-strategy)
5. [Migration Instructions](#migration-instructions)
6. [Performance Considerations](#performance-considerations)

---

## Phase 2: Foundation

### 2.1 Action Reification Table

**File:** `db/migrations/20250208_action_reification.sql`

The `actions` table stores all state-changing operations as data, enabling provenance tracking and audit trails.

**Schema:**
```sql
CREATE TABLE public.actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Action identification
    action_type varchar(50) NOT NULL,  -- 'create_zman', 'link_zman', etc.
    concept varchar(50) NOT NULL,      -- 'zman', 'publisher', 'coverage', etc.

    -- Actor tracking
    user_id text,                      -- Clerk user ID
    publisher_id integer,              -- Publisher context

    -- Request tracking
    request_id UUID NOT NULL,          -- HTTP request that triggered this
    parent_action_id UUID,             -- Causal predecessor

    -- Action data
    entity_type varchar(50),           -- 'publisher_zman', 'algorithm', etc.
    entity_id text,                    -- ID of affected entity
    payload jsonb,                     -- Action parameters
    result jsonb,                      -- Action result

    -- Status
    status varchar(20) DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
    error_message text,

    -- Timing
    started_at timestamptz DEFAULT now() NOT NULL,
    completed_at timestamptz,
    duration_ms integer,

    -- Metadata
    metadata jsonb,

    CONSTRAINT fk_parent_action FOREIGN KEY (parent_action_id)
        REFERENCES public.actions(id)
);
```

**Key Features:**
- **UUID Primary Key:** Concept-independent identifier
- **Causal Chains:** `parent_action_id` links related actions
- **Request Tracking:** `request_id` links to HTTP requests
- **Payload/Result:** Full before/after state in JSON
- **Timing:** Duration tracking for performance analysis

**Added Columns to Existing Tables:**
```sql
-- publisher_zmanim, algorithms, publisher_coverage
ALTER TABLE ... ADD COLUMN created_by_action_id UUID;
ALTER TABLE ... ADD COLUMN updated_by_action_id UUID;
```

**Indexes:**
```sql
CREATE INDEX idx_actions_request_id ON actions(request_id);
CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_actions_publisher_id ON actions(publisher_id);
CREATE INDEX idx_actions_entity ON actions(entity_type, entity_id);
CREATE INDEX idx_actions_action_type ON actions(action_type);
CREATE INDEX idx_actions_started_at ON actions(started_at DESC);
CREATE INDEX idx_actions_parent ON actions(parent_action_id);
```

---

### 2.2 Request ID Middleware

**File:** `api/internal/middleware/request_id.go`

Generates or extracts unique request IDs for distributed tracing and log correlation.

**Implementation:**
```go
func RequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Check for existing X-Request-ID header
        requestID := r.Header.Get("X-Request-ID")

        // Generate new UUID if not present
        if requestID == "" {
            requestID = uuid.New().String()
        }

        // Add to response headers for client correlation
        w.Header().Set("X-Request-ID", requestID)

        // Add to context for handler access
        ctx := context.WithValue(r.Context(), RequestIDKey, requestID)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

**Helper Functions:**
```go
// GetRequestID retrieves request ID from context
func GetRequestID(ctx context.Context) string

// GetRequestIDOrGenerate generates fallback UUID if not found
func GetRequestIDOrGenerate(ctx context.Context) string

// ParseRequestID validates and parses request ID string
func ParseRequestID(requestID string) (uuid.UUID, error)
```

**Usage:**
```go
// In router setup
r.Use(middleware.RequestID)

// In handlers
requestID := middleware.GetRequestID(r.Context())
```

---

### 2.3 Action Reification Queries

**File:** `api/internal/db/queries/actions.sql`

SQLc queries for recording and completing actions.

**Core Queries:**

**RecordAction** - Start tracking an action:
```sql
-- name: RecordAction :one
INSERT INTO public.actions (
    action_type, concept, user_id, publisher_id,
    request_id, entity_type, entity_id, payload,
    parent_action_id, metadata
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id;
```

**CompleteAction** - Mark action as completed or failed:
```sql
-- name: CompleteAction :exec
UPDATE public.actions
SET
    status = $2,           -- 'completed' or 'failed'
    result = $3,           -- result JSON
    error_message = $4,
    completed_at = now(),
    duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::integer * 1000
WHERE id = $1;
```

**GetActionsByRequest** - Retrieve all actions for a request:
```sql
-- name: GetActionsByRequest :many
SELECT * FROM public.actions
WHERE request_id = $1
ORDER BY started_at ASC;
```

**GetActionChain** - Retrieve causal chain:
```sql
-- name: GetActionChain :many
WITH RECURSIVE action_chain AS (
    -- Base case
    SELECT *, 1 AS depth FROM actions WHERE id = $1

    UNION ALL

    -- Recursive case: child actions
    SELECT a.*, ac.depth + 1
    FROM actions a
    INNER JOIN action_chain ac ON a.parent_action_id = ac.id
)
SELECT * FROM action_chain ORDER BY depth, started_at;
```

**GetEntityActionHistory** - Retrieve all actions for an entity:
```sql
-- name: GetEntityActionHistory :many
SELECT * FROM actions
WHERE entity_type = $1 AND entity_id = $2
ORDER BY started_at DESC;
```

---

### 2.4 Service Layer Integration

**File:** `api/internal/services/zmanim_linking_service.go`

Updated `ZmanimLinkingService` to integrate action tracking.

**Before (Phase 1):**
```go
func (s *ZmanimLinkingService) LinkOrCopyZman(
    ctx context.Context,
    req LinkOrCopyZmanRequest,
) (*LinkOrCopyZmanResult, error) {
    tx, _ := s.db.Pool.Begin(ctx)
    defer tx.Rollback(ctx)

    // Step 1: Fetch source zman
    // Step 2: Verify publisher
    // Step 3: Check duplicate
    // Step 4: Create zman

    tx.Commit(ctx)
    return result, nil
}
```

**After (Phase 2):**
```go
func (s *ZmanimLinkingService) LinkOrCopyZman(
    ctx context.Context,
    req LinkOrCopyZmanRequest,
) (*LinkOrCopyZmanResult, error) {
    tx, _ := s.db.Pool.Begin(ctx)
    defer tx.Rollback(ctx)

    // STEP 0: Record action (provenance tracking)
    actionID, _ := qtx.RecordAction(ctx, RecordActionParams{
        ActionType: "link_zman",
        Concept: "zman",
        UserID: req.UserID,
        PublisherID: req.TargetPublisherID,
        RequestID: req.RequestID,
        EntityType: "publisher_zman",
        Payload: payloadJSON,
    })

    // Step 1-4: Same as before

    // STEP 5: Complete action with result
    qtx.CompleteAction(ctx, CompleteActionParams{
        ID: actionID,
        Status: "completed",
        Result: resultJSON,
    })

    tx.Commit(ctx)
    return result, nil
}
```

**Request Structure Updated:**
```go
type LinkOrCopyZmanRequest struct {
    TargetPublisherID   int32
    SourceZmanID        int32
    Mode                string
    UserID              string       // NEW: For provenance
    RequestID           uuid.UUID    // NEW: For provenance
}
```

**Error Handling:**
```go
result, err := qtx.CreateLinkedOrCopiedZman(ctx, params)
if err != nil {
    // Mark action as failed
    resultJSON, _ := json.Marshal(map[string]interface{}{"error": err.Error()})
    _ = qtx.CompleteAction(ctx, CompleteActionParams{
        ID: actionID,
        Status: "failed",
        Result: resultJSON,
        ErrorMessage: err.Error(),
    })
    return nil, fmt.Errorf("failed to create: %w", err)
}
```

---

### 2.5 Geo Abstraction Layer

**File:** `db/migrations/20250209_geo_abstraction.sql`

Decouples `publisher_coverage` from geo hierarchy with UUID-based references.

**Problem:**
```sql
-- OLD: publisher_coverage has 5 direct FKs to geo hierarchy
ALTER TABLE publisher_coverage
    ADD CONSTRAINT fk_continent FOREIGN KEY (continent_id) REFERENCES geo_continents(id),
    ADD CONSTRAINT fk_country FOREIGN KEY (country_id) REFERENCES geo_countries(id),
    ADD CONSTRAINT fk_region FOREIGN KEY (region_id) REFERENCES geo_regions(id),
    ADD CONSTRAINT fk_district FOREIGN KEY (district_id) REFERENCES geo_districts(id),
    ADD CONSTRAINT fk_city FOREIGN KEY (city_id) REFERENCES geo_cities(id);
```

**Solution:**
```sql
-- NEW: geo_location_references (UUID-based, no FK constraints)
CREATE TABLE geo_location_references (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Opaque references to geo entities (no FK constraints)
    continent_id smallint,
    country_id smallint,
    region_id integer,
    district_id integer,
    city_id integer,

    -- Coverage level (determines which ID is primary)
    coverage_level_id smallint NOT NULL,

    -- Display cache (denormalized for fast lookups)
    display_name_english text,
    display_name_hebrew text,
    display_hierarchy_english text,
    display_hierarchy_hebrew text,

    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    FOREIGN KEY (coverage_level_id) REFERENCES coverage_levels(id)
);

-- Add single reference to publisher_coverage
ALTER TABLE publisher_coverage
    ADD COLUMN geo_location_id UUID;
-- NO FK CONSTRAINT (concept independence)
```

**Materialized View for Performance:**
```sql
CREATE MATERIALIZED VIEW geo_locations_resolved AS
SELECT
    glr.id,
    glr.continent_id, glr.country_id, glr.region_id, glr.district_id, glr.city_id,
    cl.key AS coverage_level,
    -- Resolved names from geo tables
    COALESCE(ct.name, co.name, r.name, d.name, c.name) AS primary_name,
    ct.name AS continent_name,
    co.name AS country_name,
    co.code AS country_code,
    r.name AS region_name,
    d.name AS district_name,
    c.name AS city_name,
    c.latitude AS city_latitude,
    c.longitude AS city_longitude,
    -- Hierarchy string for display
    CASE
        WHEN cl.key = 'city' THEN c.name || ' > ' || d.name || ' > ' || r.name || ' > ' || co.name
        WHEN cl.key = 'district' THEN d.name || ' > ' || r.name || ' > ' || co.name
        WHEN cl.key = 'region' THEN r.name || ' > ' || co.name
        WHEN cl.key = 'country' THEN co.name || ' > ' || ct.name
        WHEN cl.key = 'continent' THEN ct.name
    END AS hierarchy_english
FROM geo_location_references glr
JOIN coverage_levels cl ON glr.coverage_level_id = cl.id
LEFT JOIN geo_continents ct ON glr.continent_id = ct.id
LEFT JOIN geo_countries co ON glr.country_id = co.id
LEFT JOIN geo_regions r ON glr.region_id = r.id
LEFT JOIN geo_districts d ON glr.district_id = d.id
LEFT JOIN geo_cities c ON glr.city_id = c.id;
```

**Helper Function:**
```sql
CREATE FUNCTION find_or_create_geo_location(
    p_coverage_level_id smallint,
    p_continent_id smallint DEFAULT NULL,
    p_country_id smallint DEFAULT NULL,
    p_region_id integer DEFAULT NULL,
    p_district_id integer DEFAULT NULL,
    p_city_id integer DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_location_id uuid;
BEGIN
    -- Try to find existing location reference
    SELECT id INTO v_location_id
    FROM geo_location_references
    WHERE
        coverage_level_id = p_coverage_level_id
        AND (continent_id = p_continent_id OR (continent_id IS NULL AND p_continent_id IS NULL))
        AND (country_id = p_country_id OR (country_id IS NULL AND p_country_id IS NULL))
        -- ... (all levels)
    LIMIT 1;

    -- If not found, create new reference
    IF v_location_id IS NULL THEN
        INSERT INTO geo_location_references (
            coverage_level_id, continent_id, country_id,
            region_id, district_id, city_id
        ) VALUES (
            p_coverage_level_id, p_continent_id, p_country_id,
            p_region_id, p_district_id, p_city_id
        ) RETURNING id INTO v_location_id;
    END IF;

    RETURN v_location_id;
END;
$$ LANGUAGE plpgsql;
```

**Backfill Existing Data:**
```sql
-- Migrate existing coverage records to geo_location_references
DO $$
DECLARE
    coverage_record RECORD;
    location_uuid UUID;
BEGIN
    FOR coverage_record IN
        SELECT id, coverage_level_id, continent_id, country_id,
               region_id, district_id, city_id
        FROM publisher_coverage
        WHERE geo_location_id IS NULL
    LOOP
        location_uuid := find_or_create_geo_location(
            coverage_record.coverage_level_id,
            coverage_record.continent_id,
            coverage_record.country_id,
            coverage_record.region_id,
            coverage_record.district_id,
            coverage_record.city_id
        );

        UPDATE publisher_coverage
        SET geo_location_id = location_uuid
        WHERE id = coverage_record.id;
    END LOOP;
END $$;
```

**Benefits:**
- ✅ Single UUID reference instead of 5 FK columns
- ✅ Geo hierarchy can change without affecting coverage
- ✅ Materialized view provides fast lookups
- ✅ Display names cached in view (no JOIN needed)

---

## Phase 3: UUID Pattern

### 3.1 UUID-Based Table Template

**File:** `db/migrations/TEMPLATE_uuid_concept.sql`

A comprehensive template for creating new UUID-based concepts. This is the **recommended pattern for all new domain concepts**.

**Template Structure:**
```sql
-- 1. Main concept table (UUID-based, concept-independent)
CREATE TABLE notifications (
    -- Identity
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Opaque references (NO FK CONSTRAINTS)
    user_id text,              -- Clerk user ID
    publisher_id integer,      -- Reference to publishers (opaque)
    zman_id integer,           -- Reference to zmanim (opaque)

    -- Domain attributes
    notification_type varchar(50) NOT NULL,
    title text NOT NULL,
    message text NOT NULL,

    -- Provenance tracking
    created_by_action_id UUID,
    updated_by_action_id UUID,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Soft delete (audit trail)
    deleted_at timestamptz
);

-- 2. Indexes for common queries
CREATE INDEX idx_notifications_user
    ON notifications(user_id) WHERE deleted_at IS NULL;

-- 3. Materialized view for cross-concept queries
CREATE MATERIALIZED VIEW notifications_resolved AS
SELECT
    n.*,
    p.name AS publisher_name,
    pz.english_name AS zman_name
FROM notifications n
LEFT JOIN publishers p ON n.publisher_id = p.id
LEFT JOIN publisher_zmanim pz ON n.zman_id = pz.id
WHERE n.deleted_at IS NULL;

-- 4. Refresh function
CREATE FUNCTION refresh_notifications_view() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW notifications_resolved;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger for updated_at
CREATE FUNCTION update_notifications_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();
```

**Key Features:**

1. **UUID Primary Key:**
   - Concept-independent identifier
   - Can be generated in application or database
   - No auto-increment coupling

2. **Opaque References:**
   - No FK constraints to other concepts
   - Allows referencing concepts that don't exist yet
   - Easier testing (no FK setup required)

3. **Materialized Views:**
   - Fast cross-concept queries
   - Refresh on schedule (not every write)
   - Denormalized for performance

4. **Provenance Tracking:**
   - `created_by_action_id` links to action reification
   - Full audit trail via actions table
   - Request-level tracking

5. **Soft Deletes:**
   - `deleted_at` timestamp preserves history
   - Indexes use `WHERE deleted_at IS NULL`
   - Audit trail maintained

**Usage Examples:**

```sql
-- Create notification
INSERT INTO notifications (user_id, publisher_id, notification_type, title, message)
VALUES ('clerk_user_123', 42, 'zman_reminder', 'Candle Lighting Soon', 'In 30 min');

-- Query with resolved data
SELECT * FROM notifications_resolved
WHERE user_id = 'clerk_user_123'
ORDER BY created_at DESC LIMIT 10;

-- Update status
UPDATE notifications
SET delivery_status = 'sent', sent_at = now()
WHERE id = 'uuid-here';

-- Soft delete
UPDATE notifications SET deleted_at = now() WHERE id = 'uuid-here';

-- Refresh view (run periodically)
SELECT refresh_notifications_view();
```

---

## Integration Guide

### 3.1 Handler Integration

**Step 1: Extract Request ID from Context**
```go
// In handler
func (h *Handler) CreateZman(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Get request ID from middleware
    requestIDStr := middleware.GetRequestID(ctx)
    requestID, _ := uuid.Parse(requestIDStr)

    // Get user ID from Clerk
    userID := GetUserID(ctx)

    // ... continue with handler logic
}
```

**Step 2: Call Service with Provenance**
```go
result, err := h.zmanimLinkingService.LinkOrCopyZman(ctx, services.LinkOrCopyZmanRequest{
    TargetPublisherID: publisherID,
    SourceZmanID:      sourceZmanID,
    Mode:              "link",
    UserID:            userID,      // NEW: Provenance
    RequestID:         requestID,   // NEW: Provenance
})
```

**Step 3: Service Records Actions**
```go
// Service layer handles action recording
func (s *ZmanimLinkingService) LinkOrCopyZman(...) {
    // Record action start
    actionID, _ := qtx.RecordAction(ctx, ...)

    // Do work
    result, err := qtx.CreateLinkedOrCopiedZman(ctx, ...)
    if err != nil {
        // Mark as failed
        qtx.CompleteAction(ctx, CompleteActionParams{
            ID: actionID,
            Status: "failed",
            ErrorMessage: err.Error(),
        })
        return nil, err
    }

    // Mark as completed
    qtx.CompleteAction(ctx, CompleteActionParams{
        ID: actionID,
        Status: "completed",
        Result: resultJSON,
    })

    return result, nil
}
```

### 3.2 Creating New UUID-Based Concepts

**Step 1: Copy Template**
```bash
cp db/migrations/TEMPLATE_uuid_concept.sql db/migrations/20250XXX_my_concept.sql
```

**Step 2: Find and Replace**
- Replace `notifications` with your concept name
- Replace domain attributes (title, message, etc.) with your fields
- Update opaque references (user_id, publisher_id, etc.)

**Step 3: Customize Indexes**
```sql
-- Add indexes for your common query patterns
CREATE INDEX idx_my_concept_status
    ON my_concept(status) WHERE deleted_at IS NULL;
```

**Step 4: Create SQLc Queries**
```sql
-- File: api/internal/db/queries/my_concept.sql

-- name: CreateMyConceptRecord :one
INSERT INTO my_concept (user_id, publisher_id, ...)
VALUES ($1, $2, ...)
RETURNING *;

-- name: GetMyConceptByID :one
SELECT * FROM my_concept WHERE id = $1 AND deleted_at IS NULL;

-- name: ListMyConceptsResolved :many
SELECT * FROM my_concept_resolved
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: SoftDeleteMyConcept :exec
UPDATE my_concept SET deleted_at = now() WHERE id = $1;
```

**Step 5: Generate Code**
```bash
cd api && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate
```

**Step 6: Create Service Layer**
```go
// api/internal/services/my_concept_service.go
type MyConceptService struct {
    db *db.DB
}

func (s *MyConceptService) CreateRecord(ctx context.Context, req CreateRequest) (*Result, error) {
    tx, _ := s.db.Pool.Begin(ctx)
    defer tx.Rollback(ctx)
    qtx := s.db.Queries.WithTx(tx)

    // Record action
    actionID, _ := qtx.RecordAction(ctx, RecordActionParams{
        ActionType: "create_my_concept",
        Concept: "my_concept",
        UserID: req.UserID,
        RequestID: req.RequestID,
        Payload: payloadJSON,
    })

    // Create record
    result, err := qtx.CreateMyConceptRecord(ctx, params)
    if err != nil {
        qtx.CompleteAction(ctx, CompleteActionParams{
            ID: actionID,
            Status: "failed",
            ErrorMessage: err.Error(),
        })
        return nil, err
    }

    // Complete action
    qtx.CompleteAction(ctx, CompleteActionParams{
        ID: actionID,
        Status: "completed",
        Result: resultJSON,
    })

    tx.Commit(ctx)
    return result, nil
}
```

---

## Testing Strategy

### 4.1 Unit Tests for Action Tracking

```go
func TestLinkOrCopyZman_RecordsAction(t *testing.T) {
    // Setup
    db := setupTestDB(t)
    service := services.NewZmanimLinkingService(db)

    // Create test request
    requestID := uuid.New()
    req := services.LinkOrCopyZmanRequest{
        TargetPublisherID: 1,
        SourceZmanID: 2,
        Mode: "link",
        UserID: "test_user",
        RequestID: requestID,
    }

    // Execute
    result, err := service.LinkOrCopyZman(context.Background(), req)
    require.NoError(t, err)

    // Verify action was recorded
    actions, err := db.Queries.GetActionsByRequest(context.Background(), requestID)
    require.NoError(t, err)
    require.Len(t, actions, 1)

    action := actions[0]
    assert.Equal(t, "link_zman", action.ActionType)
    assert.Equal(t, "zman", action.Concept)
    assert.Equal(t, "completed", action.Status)
    assert.NotNil(t, action.CompletedAt)
    assert.Greater(t, action.DurationMs, int32(0))
}

func TestLinkOrCopyZman_RecordsFailedAction(t *testing.T) {
    // Setup with invalid request that will fail
    db := setupTestDB(t)
    service := services.NewZmanimLinkingService(db)

    requestID := uuid.New()
    req := services.LinkOrCopyZmanRequest{
        TargetPublisherID: 1,
        SourceZmanID: 99999, // Non-existent
        Mode: "link",
        UserID: "test_user",
        RequestID: requestID,
    }

    // Execute (should fail)
    _, err := service.LinkOrCopyZman(context.Background(), req)
    require.Error(t, err)

    // Verify failed action was recorded
    actions, err := db.Queries.GetActionsByRequest(context.Background(), requestID)
    require.NoError(t, err)
    require.Len(t, actions, 1)

    action := actions[0]
    assert.Equal(t, "failed", action.Status)
    assert.NotEmpty(t, action.ErrorMessage)
}
```

### 4.2 Integration Tests for Geo Abstraction

```go
func TestGeoAbstraction_FindOrCreateLocation(t *testing.T) {
    db := setupTestDB(t)

    // Create geo location reference
    locationID, err := db.Queries.FindOrCreateGeoLocation(context.Background(), FindOrCreateGeoLocationParams{
        CoverageLevelID: 5, // City level
        ContinentID: sql.NullInt16{Int16: 1, Valid: true},
        CountryID: sql.NullInt16{Int16: 2, Valid: true},
        RegionID: sql.NullInt32{Int32: 3, Valid: true},
        DistrictID: sql.NullInt32{Int32: 4, Valid: true},
        CityID: sql.NullInt32{Int32: 5, Valid: true},
    })
    require.NoError(t, err)
    require.NotEmpty(t, locationID)

    // Call again with same params - should return existing
    locationID2, err := db.Queries.FindOrCreateGeoLocation(context.Background(), ...)
    require.NoError(t, err)
    assert.Equal(t, locationID, locationID2, "Should reuse existing location")

    // Query resolved view
    resolved, err := db.Queries.GetGeoLocationResolved(context.Background(), locationID)
    require.NoError(t, err)
    assert.Equal(t, "city", resolved.CoverageLevel)
    assert.NotEmpty(t, resolved.HierarchyEnglish)
}
```

### 4.3 E2E Tests

```go
func TestE2E_LinkZmanWithProvenance(t *testing.T) {
    // Start server with middleware
    server := setupTestServer(t)

    // Make request with custom X-Request-ID
    requestID := uuid.New().String()
    resp, err := http.Post(
        server.URL+"/api/publisher/zmanim/link",
        "application/json",
        strings.NewReader(`{"source_zman_id": 123, "mode": "link"}`),
    )
    resp.Header.Set("X-Request-ID", requestID)

    // Verify response includes same request ID
    assert.Equal(t, requestID, resp.Header.Get("X-Request-ID"))

    // Verify action was recorded in database
    actions := queryActionsForRequest(t, server.DB, requestID)
    require.Len(t, actions, 1)
    assert.Equal(t, "link_zman", actions[0].ActionType)
    assert.Equal(t, "completed", actions[0].Status)
}
```

---

## Migration Instructions

### 5.1 Run Migrations

```bash
# Phase 2 migrations
./scripts/migrate.sh up

# Migrations will run in order:
# 1. 20250208_action_reification.sql (creates actions table)
# 2. 20250209_geo_abstraction.sql (creates geo_location_references)
```

### 5.2 Verify Migrations

```sql
-- Check actions table
SELECT COUNT(*) FROM public.actions;

-- Check geo_location_references
SELECT COUNT(*) FROM public.geo_location_references;

-- Check materialized view
SELECT COUNT(*) FROM public.geo_locations_resolved;

-- Verify backfill of existing coverage
SELECT COUNT(*) FROM public.publisher_coverage WHERE geo_location_id IS NOT NULL;
```

### 5.3 Refresh Materialized Views

```sql
-- Initial refresh (migrations do this automatically)
REFRESH MATERIALIZED VIEW geo_locations_resolved;

-- Set up cron job to refresh periodically
-- Example: Every hour
-- 0 * * * * psql -d zmanim_lab -c "SELECT refresh_geo_locations_view();"
```

### 5.4 Update Application Code

**Step 1: Add Request ID Middleware**
```go
// In cmd/api/main.go
r.Use(middleware.RequestID)
```

**Step 2: Update Service Calls**
```go
// In handlers
requestID := middleware.GetRequestID(r.Context())
userID := GetUserID(r.Context())

result, err := h.service.SomeAction(ctx, Request{
    // ... existing fields
    UserID: userID,
    RequestID: requestID,
})
```

**Step 3: Regenerate SQLc Code**
```bash
cd api && go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate
```

**Step 4: Update Service Layer**
- Add action recording to critical operations
- Add request ID and user ID parameters
- Wrap operations in transactions

---

## Performance Considerations

### 6.1 Materialized View Refresh Strategy

**Option 1: Scheduled Refresh (Recommended)**
```sql
-- Cron job every hour
0 * * * * psql -d zmanim_lab -c "SELECT refresh_geo_locations_view();"
```

**Option 2: Manual Refresh After Bulk Changes**
```sql
-- After importing new cities/regions
REFRESH MATERIALIZED VIEW geo_locations_resolved;
```

**Option 3: Concurrent Refresh (PostgreSQL 9.4+)**
```sql
-- Non-blocking refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY geo_locations_resolved;
```

### 6.2 Action Table Maintenance

**Partition by Month (Optional):**
```sql
-- Create partitioned table for actions
CREATE TABLE actions (
    -- ... columns
) PARTITION BY RANGE (started_at);

-- Create monthly partitions
CREATE TABLE actions_2025_01 PARTITION OF actions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

**Archive Old Actions:**
```sql
-- Move actions older than 90 days to archive
INSERT INTO actions_archive
SELECT * FROM actions
WHERE started_at < now() - interval '90 days';

DELETE FROM actions
WHERE started_at < now() - interval '90 days';
```

### 6.3 Index Optimization

**Monitor Index Usage:**
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Drop unused indexes
-- (Be careful - only drop after monitoring!)
```

**Add Partial Indexes:**
```sql
-- Only index non-deleted records
CREATE INDEX idx_notifications_active_user
    ON notifications(user_id)
    WHERE deleted_at IS NULL;
```

---

## Rollback Instructions

### Phase 2 Rollback

**Step 1: Remove Service Integration**
```bash
git revert <commit-hash>  # Revert service changes
```

**Step 2: Drop Actions Table**
```sql
-- Remove FK constraints from tables
ALTER TABLE publisher_zmanim DROP CONSTRAINT IF EXISTS fk_created_by_action;
ALTER TABLE publisher_zmanim DROP CONSTRAINT IF EXISTS fk_updated_by_action;
-- (repeat for algorithms, publisher_coverage)

-- Remove columns
ALTER TABLE publisher_zmanim DROP COLUMN IF EXISTS created_by_action_id;
ALTER TABLE publisher_zmanim DROP COLUMN IF EXISTS updated_by_action_id;
-- (repeat for algorithms, publisher_coverage)

-- Drop functions
DROP FUNCTION IF EXISTS public.record_action;
DROP FUNCTION IF EXISTS public.complete_action;

-- Drop table
DROP TABLE IF EXISTS public.actions;
```

**Step 3: Drop Geo Abstraction**
```sql
-- Remove column from publisher_coverage
ALTER TABLE publisher_coverage DROP COLUMN IF EXISTS geo_location_id;

-- Drop materialized view and function
DROP MATERIALIZED VIEW IF EXISTS geo_locations_resolved;
DROP FUNCTION IF EXISTS find_or_create_geo_location;
DROP FUNCTION IF EXISTS refresh_geo_locations_view;

-- Drop table
DROP TABLE IF EXISTS geo_location_references;
```

---

## Summary

**Phase 2 Deliverables:**
- ✅ Action reification table for provenance tracking
- ✅ Request ID middleware for distributed tracing
- ✅ Geo abstraction layer with UUID references
- ✅ Service layer integration with action tracking
- ✅ Comprehensive SQLc queries for actions

**Phase 3 Deliverables:**
- ✅ UUID-based table template for new concepts
- ✅ Documentation and usage examples
- ✅ Integration guide for handlers and services

**Next Steps:**
- Apply template to new concepts as they emerge
- Monitor materialized view refresh performance
- Consider partitioning actions table by month
- Extend action tracking to more critical operations

**Reference:**
- Phase 1: `docs/architecture/PHASE1_IMPLEMENTATION.md`
- Compliance Audit: `docs/compliance/concept-independence-audit.md`
- Coding Standards: `docs/coding-standards.md`
