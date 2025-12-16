# Concept Independence Audit Report
**Date:** 2025-12-07
**Standard:** "What You See Is What It Does" (Jackson & Tsai, arXiv:2508.14511v2)
**Scope:** Database schema, backend handlers, services layer

---

## Executive Summary

**Overall Compliance Score: 4.5/10** ⚠️ **VIOLATIONS DOCUMENTED (ACCEPTED AS TECHNICAL DEBT)**

**⚠️ IMPORTANT: This audit is ASPIRATIONAL, not prescriptive.**

The Shtetl Zmanim codebase demonstrates violations of concept independence principles from the "What You See Is What It Does" paper. However, **these violations are ACCEPTED as pragmatic technical debt** for the existing codebase.

**Current Decision (2025-12-07):**
- ✅ **Existing codebase:** Continue using integer FKs (accepted pattern)
- ✅ **New projects:** SHOULD use UUIDs for cross-concept references
- 📋 **Future:** Migration roadmap available if team decides to pursue full compliance

**Documented Violations:**

1. **Direct foreign key dependencies** across concept boundaries (95% of relationships)
   - ✅ **Accepted for existing schema** (standard relational database practice)
   - ⚠️ **For new tables:** Consider UUIDs for concept independence

2. **Complex multi-concept JOINs** hidden in SQL queries (up to 8 concepts in single query)
   - ⚠️ **Recommended fix:** Split into separate queries (moderate effort)

3. **Handler-layer orchestration** of cross-concept workflows without service abstraction
   - ⚠️ **Recommended fix:** Extract service layer (moderate effort)

4. **Minimal provenance tracking** (version history exists but lacks causal chains)
   - 📋 **Future enhancement:** Action reification table (low priority)

**Key Insight:** This audit provides a **roadmap for improvement**, not mandatory changes. The violations are documented so AI agents understand current architecture and can suggest improvements when beneficial.

---

## 1. State Isolation Assessment

### CRITICAL VIOLATION: Direct Foreign Key Coupling

**Score: 2/10** 🚨

#### Finding: 95% of Cross-Concept References Use Integer FKs

The database schema uses **direct integer foreign keys** for all cross-concept relationships, creating tight coupling:

| Violation Type | Example | Impact |
|----------------|---------|--------|
| **Publisher ↔ Zman** | `publisher_zmanim.master_zman_id → master_zmanim_registry.id` | Publisher zmanim cannot exist without master registry dependency |
| **Publisher ↔ Geo** | `publisher_coverage.city_id → geo_cities.id` | Coverage directly references geo hierarchy internals |
| **Zman ↔ Tag** | `master_zman_tags.tag_id → zman_tags.id` | Tags cannot evolve independently of zmanim |
| **Zman ↔ Event** | `master_zman_events.jewish_event_id → jewish_events.id` | Event concept tightly coupled to zmanim |

#### Examples from Schema:

```sql
-- VIOLATION: Publisher concept depends on Zman concept state
CREATE TABLE public.publisher_zmanim (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,           -- ❌ Direct integer FK
    master_zman_id integer,                   -- ❌ Direct integer FK
    linked_publisher_zman_id integer,         -- ❌ Self-reference FK
    ...
);

ALTER TABLE publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_master_zman_id_fkey
    FOREIGN KEY (master_zman_id) REFERENCES master_zmanim_registry(id);
```

```sql
-- VIOLATION: Coverage concept depends on 5 geo concepts simultaneously
CREATE TABLE public.publisher_coverage (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    city_id integer,                         -- ❌ Direct geo FK
    country_id smallint,                     -- ❌ Direct geo FK
    region_id integer,                       -- ❌ Direct geo FK
    district_id integer,                     -- ❌ Direct geo FK
    continent_id smallint,                   -- ❌ Direct geo FK
    ...
);
```

#### What WYSIWYD Requires:

> "State declarations in one concept should have no dependencies on other concepts. All external references must use UUIDs rather than direct foreign keys."

**Required Pattern:**
```sql
-- Concept independence via UUID references
CREATE TABLE public.publisher_zmanim (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    publisher_uuid UUID NOT NULL,            -- ✅ Opaque reference
    master_zman_uuid UUID,                   -- ✅ No FK constraint
    ...
);

-- Synchronization layer manages relationships
CREATE TABLE public.zman_publisher_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    publisher_zman_uuid UUID NOT NULL,
    master_zman_uuid UUID NOT NULL,
    link_type TEXT NOT NULL,                 -- 'copy' or 'link'
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Current vs Required ID Types:

| Concept | Current PK Type | Current FK Type | Required Type |
|---------|-----------------|-----------------|---------------|
| Publisher | SERIAL (int32) | int32 | UUID |
| Zman | SERIAL (int32) | int32 | UUID |
| Geo | SERIAL/smallint | int32/smallint | UUID |
| Coverage | SERIAL (int32) | mixed int32/smallint | UUID |
| Tag | SERIAL (int32) | int32 | UUID |

**Exception:** Only `algorithm_version_history` uses UUID (but still references integer FKs):
```sql
CREATE TABLE public.algorithm_version_history (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,  -- ✅ UUID
    algorithm_id integer NOT NULL,  -- ❌ Still uses integer FK
    ...
);
```

---

## 2. Synchronization Boundaries Assessment

### HIGH VIOLATION: Handler-Layer Orchestration

**Score: 5/10** ⚠️

#### Finding: Handlers Directly Orchestrate Multi-Concept Workflows

The codebase lacks a **service layer** for cross-concept operations. Handlers directly call 4-6 SQLc queries to coordinate concepts:

**Example: CreateZmanFromPublisher Handler**
`api/internal/handlers/publisher_zmanim.go:1474-1639`

```go
func (h *Handlers) CreateZmanFromPublisher(w http.ResponseWriter, r *http.Request) {
    // Step 1: Fetch source zman (concepts: publisher_zmanim + publishers)
    sourceZman, err := h.db.Queries.GetSourceZmanForLinking(ctx, sourceZmanIDInt32)

    // Step 2: Verify publisher verification (concept: publishers)
    if req.Mode == "link" && !sourceZman.IsVerified {
        RespondForbidden(w, r, "Can only link from verified publishers")
        return
    }

    // Step 3: Check duplicate zman_key (concept: publisher_zmanim)
    existsResult, err := h.db.Queries.CheckZmanKeyExists(ctx, ...)

    // Step 4: CREATE linked/copied zman (concept: publisher_zmanim)
    result, err := h.db.Queries.CreateLinkedOrCopiedZman(ctx, ...)

    // Step 5: Invalidate cache
    h.cache.InvalidatePublisherCache(ctx, publisherID)
}
```

**WYSIWYD Violation:**
- Handler code shows 4 independent database calls
- No explicit transaction boundaries (implicit atomicity assumed)
- **Implicit dependency:** Source must be verified IF linking (not visible in code)
- If step 4 fails after verification, no rollback strategy shown

#### What WYSIWYD Requires:

> "Only a single bootstrap concept (Web) initiates external actions. Synchronizations may only access concept states and actions."

**Required Pattern:**
```go
// Handler delegates to synchronization service
func (h *Handlers) CreateZmanFromPublisher(w http.ResponseWriter, r *http.Request) {
    result, err := h.zmanimLinkingService.LinkZmanFromPublisher(
        ctx, publisherID, sourceZmanID, req.Mode,
    )
    if err != nil {
        switch {
        case errors.Is(err, services.ErrPublisherNotVerified):
            RespondForbidden(w, r, "Source publisher not verified")
        case errors.Is(err, services.ErrZmanKeyExists):
            RespondConflict(w, r, "Zman key already exists")
        default:
            RespondInternalError(w, r, "Failed to create zman")
        }
        return
    }
    RespondJSON(w, r, http.StatusCreated, result)
}
```

```go
// Synchronization service encapsulates multi-concept workflow
type ZmanimLinkingService struct { db *db.DB }

func (s *ZmanimLinkingService) LinkZmanFromPublisher(
    ctx context.Context,
    targetPublisherID int32,
    sourceZmanID int32,
    mode string,
) (*PublisherZman, error) {
    tx, _ := s.db.Pool.Begin(ctx)
    defer tx.Rollback(ctx)
    qtx := s.db.Queries.WithTx(tx)

    // Explicit workflow with transaction boundaries
    sourceZman, _ := qtx.GetSourceZmanForLinking(ctx, sourceZmanID)
    if mode == "link" {
        publisher, _ := qtx.GetPublisher(ctx, sourceZman.PublisherID)
        if !publisher.IsVerified { return nil, ErrPublisherNotVerified }
    }
    exists, _ := qtx.CheckZmanKeyExists(ctx, targetPublisherID, sourceZman.ZmanKey)
    if exists { return nil, ErrZmanKeyExists }

    result, _ := qtx.CreateLinkedOrCopiedZman(ctx, ...)
    tx.Commit(ctx)
    return result, nil
}
```

#### Current Service Layer Status

`api/internal/services/publisher_service.go:22-112` contains **RAW SQL** (pre-SQLc migration):

```go
// ❌ VIOLATION: Raw SQL in service layer
var query string
var args []interface{}

if regionID != nil && *regionID != "" {
    query = `
        SELECT DISTINCT p.id, p.name, ...
        FROM publishers p
        INNER JOIN coverage_areas ca ON p.id = ca.publisher_id
        WHERE (p.status = 'verified' OR p.status = 'active')
        ORDER BY subscriber_count DESC, p.name
        LIMIT $2 OFFSET $3
    `
    args = []interface{}{*regionID, pageSize, offset}
}

rows, err := s.db.Pool.Query(ctx, query, args...)
```

**Status:** Service layer is **deprecated/inconsistent**—new code bypasses it entirely.

---

## 3. Direct JOINs Across Concept Boundaries

### CRITICAL VIOLATION: 8-Concept Query

**Score: 3/10** 🚨

#### Finding: GetPublisherZmanim Query Spans 8 Concepts

`api/internal/db/queries/zmanim.sql:8-108`

This query JOINs **8 domain concepts** to return a single zman record:

```sql
SELECT
    pz.id, pz.publisher_id, pz.zman_key, ...,
    -- Formula resolution logic
    COALESCE(linked_pz.formula_dsl, pz.formula_dsl) AS formula_dsl,
    -- Master registry fallback
    COALESCE(mr.canonical_hebrew_name, linked_pz.hebrew_name) AS source_hebrew_name,
    -- Tag aggregation across 2 concepts
    COALESCE(
        (SELECT json_agg(...) FROM (
            SELECT t.id, t.tag_key, ...
            FROM master_zman_tags mzt
            JOIN zman_tags t ON mzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE mzt.master_zman_id = pz.master_zman_id
            UNION ALL
            SELECT t.id, t.tag_key, ...
            FROM publisher_zman_tags pzt
            JOIN zman_tags t ON pzt.tag_id = t.id
            JOIN tag_types tt ON t.tag_type_id = tt.id
            WHERE pzt.publisher_zman_id = pz.id
        ) sub),
        '[]'::json
    ) AS tags,
    -- Event zman detection (3-table subquery)
    EXISTS (
        SELECT 1 FROM master_zman_tags mzt
        JOIN zman_tags zt ON mzt.tag_id = zt.id
        JOIN tag_types tt ON zt.tag_type_id = tt.id
        WHERE mzt.master_zman_id = pz.master_zman_id
          AND tt.key IN ('event', 'behavior')
    ) AS is_event_zman
FROM publisher_zmanim pz
LEFT JOIN zman_source_types zst ON pz.source_type_id = zst.id
LEFT JOIN time_categories tc ON pz.time_category_id = tc.id
LEFT JOIN publisher_zmanim linked_pz ON pz.linked_publisher_zman_id = linked_pz.id
LEFT JOIN publishers linked_pub ON linked_pz.publisher_id = linked_pub.id
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
LEFT JOIN time_categories mr_tc ON mr.time_category_id = mr_tc.id
```

**Concepts Involved:**
1. `publisher_zmanim` (primary)
2. `publishers` (linked publisher)
3. `master_zmanim_registry` (registry reference)
4. `zman_tags` (tag metadata)
5. `tag_types` (tag classification)
6. `master_zman_tags` (registry tag associations)
7. `publisher_zman_tags` (publisher tag overrides)
8. `time_categories`, `zman_source_types` (lookup tables)

**WYSIWYD Violation:**
- Handler shows `GetPublisherZmanim()` returns zmanim with tags
- **Hidden complexity:** WHERE tags come from (master vs publisher) is invisible
- **Formula resolution:** COALESCE logic mixes 3 sources (linked → publisher → master)
- **Tag precedence:** UNION ALL merges master + publisher tags without conflict resolution

#### What WYSIWYD Requires:

> "Avoid proliferating 'getter' methods that couple concepts to synchronizations."

**Required Pattern:** Split into explicit concept queries:

```go
func (h *Handlers) GetPublisherZmanim(w http.ResponseWriter, r *http.Request) {
    // Step 1: Fetch publisher zmanim (single concept)
    zmanim, err := h.db.Queries.GetPublisherZmanim(ctx, publisherID)

    // Step 2: Fetch tags for each zman (explicit concept access)
    for i, z := range zmanim {
        tags, _ := h.db.Queries.GetZmanTags(ctx, z.ID)  // Explicit call
        zmanim[i].Tags = tags
    }

    // Step 3: Fetch linked sources (explicit concept access)
    for i, z := range zmanim {
        if z.LinkedZmanID != nil {
            source, _ := h.db.Queries.GetZmanSource(ctx, *z.LinkedZmanID)
            zmanim[i].Source = source
        }
    }

    RespondJSON(w, r, http.StatusOK, zmanim)
}
```

**Benefit:** Handler code now **explicitly shows** all concept boundaries.

---

## 4. Read/Write Separation Assessment

### MODERATE COMPLIANCE: Clear Separation in Handlers

**Score: 7/10** ✅ (with caveats)

#### Finding: Handlers Separate Reads from Writes

Most handlers follow a clean pattern:

**Read Pattern:**
```go
// api/internal/handlers/publisher_zmanim.go:165
func (h *Handlers) GetPublisherZmanim(w http.ResponseWriter, r *http.Request) {
    sqlcResults, err := h.db.Queries.FetchPublisherZmanim(ctx, publisherIDInt32)
    // No state mutation
    RespondJSON(w, r, http.StatusOK, zmanim)
}
```

**Write Pattern:**
```go
// api/internal/handlers/publisher_zmanim.go:1003
func (h *Handlers) CreatePublisherZman(w http.ResponseWriter, r *http.Request) {
    // Validation
    if req.ZmanKey == "" { RespondValidationError(...); return }

    // Single concept write
    sqlcZman, err := h.db.Queries.CreatePublisherZman(ctx, params)

    // Cache invalidation (follows write)
    h.cache.InvalidatePublisherCache(ctx, publisherIDStr)

    RespondJSON(w, r, http.StatusCreated, ...)
}
```

✅ **Compliant:** Reads don't mutate, writes are explicit.

#### Caveat: Mixed Read/Write in Multi-Step Operations

Some handlers perform reads **during** write workflows:

```go
// api/internal/handlers/publisher_zmanim.go:1474
func (h *Handlers) CreateZmanFromPublisher(...) {
    sourceZman, _ := h.db.Queries.GetSourceZmanForLinking(...)  // READ
    if !sourceZman.IsVerified { ... }                            // READ (verification check)
    result, _ := h.db.Queries.CreateLinkedOrCopiedZman(...)     // WRITE
}
```

⚠️ **Moderate Violation:** Reads and writes mixed in handler without service abstraction.

#### Explicit Transactions (Good Pattern)

`api/internal/handlers/publisher_algorithm.go:510-539`

```go
tx, _ := h.db.Pool.Begin(ctx)
defer tx.Rollback(ctx)
qtx := h.db.Queries.WithTx(tx)

err = qtx.ArchiveActiveAlgorithms(ctx, publisherID)  // WRITE 1
updatedAt, _ := qtx.PublishAlgorithm(ctx, id)        // WRITE 2

tx.Commit(ctx)
```

✅ **Compliant:** Transaction boundaries are **explicit** in handler code.

---

## 5. Provenance Tracking Assessment

### PARTIAL COMPLIANCE: Version History Without Causal Chains

**Score: 5/10** ⚠️

#### Finding: Timestamps and Versions Present, Causality Missing

The schema includes:
- ✅ `created_at` on all tables
- ✅ `updated_at` with triggers
- ✅ Version history tables (`algorithm_version_history`, `publisher_zman_versions`)
- ❌ **No causal chain tracking** (which action triggered which state change)
- ❌ **No action reification** (actions stored as data)

**Example: Algorithm Version History**

```sql
CREATE TABLE public.algorithm_version_history (
    id text DEFAULT (gen_random_uuid())::text PRIMARY KEY,
    algorithm_id integer NOT NULL,
    version_number integer NOT NULL,
    formula_dsl text NOT NULL,
    created_by text,                           -- ✅ User tracking
    created_at timestamptz DEFAULT now(),      -- ✅ Timestamp
    -- ❌ MISSING: triggering_action_id (what caused this version?)
    -- ❌ MISSING: parent_version_id (causal link to previous)
    CONSTRAINT uq_algorithm_version UNIQUE (algorithm_id, version_number)
);
```

**Rollback Audit (Partial Provenance):**

```sql
CREATE TABLE public.algorithm_rollback_audit (
    id SERIAL PRIMARY KEY,
    algorithm_id integer NOT NULL,
    source_version integer NOT NULL,         -- ✅ Where we came from
    target_version integer NOT NULL,         -- ✅ Where we rolled back to
    new_version integer NOT NULL,            -- ✅ New version created
    created_by text,
    created_at timestamptz DEFAULT now()
    -- ❌ MISSING: rollback_reason (why was rollback triggered?)
    -- ❌ MISSING: triggering_request_id (which API call?)
);
```

#### What WYSIWYD Requires:

> "Record all actions as reified data for auditability and debugging. Include version references with every state record, establishing causal links between data and documentation."

**Required Pattern:**
```sql
-- Action reification table
CREATE TABLE public.actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT NOT NULL,               -- 'create_zman', 'link_zman', 'publish_algorithm'
    concept TEXT NOT NULL,                   -- Which concept owns this action
    actor_id UUID NOT NULL,                  -- Who triggered it
    request_id UUID NOT NULL,                -- Which API request
    parent_action_id UUID,                   -- Causal predecessor
    payload JSONB NOT NULL,                  -- Action parameters
    result JSONB,                            -- Action result
    created_at TIMESTAMPTZ DEFAULT now()
);

-- State changes reference actions
CREATE TABLE public.publisher_zmanim (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by_action_id UUID REFERENCES actions(id),  -- ✅ Causality
    updated_by_action_id UUID REFERENCES actions(id),  -- ✅ Causality
    version_number INTEGER NOT NULL,
    ...
);
```

#### Current State:

| Aspect | Status | Example |
|--------|--------|---------|
| Timestamps | ✅ Present | `created_at`, `updated_at` on all tables |
| User tracking | ✅ Partial | `created_by` (text) in version tables |
| Version numbers | ✅ Present | `algorithm_version_history`, `publisher_zman_versions` |
| Causal chains | ❌ Missing | No `parent_version_id` or `triggering_action_id` |
| Action reification | ❌ Missing | No `actions` table |
| Request tracking | ❌ Missing | No `request_id` linkage |

**Only Audit Log:** `ai_audit_logs` (limited scope)

```sql
CREATE TABLE public.ai_audit_logs (
    id SERIAL PRIMARY KEY,
    publisher_id integer,
    user_id text,                           -- ✅ User tracking
    action_type character varying(50),      -- ✅ Action type
    entity_type character varying(50),
    entity_id text,
    payload jsonb,
    created_at timestamptz DEFAULT now()
    -- ⚠️ LIMITED: Only AI-related actions, not all state changes
);
```

---

## 6. Naming Consistency Assessment

### MODERATE COMPLIANCE: URI Hierarchy Present, Not Enforced

**Score: 6/10** ⚠️

#### Finding: Consistent URL Patterns, Inconsistent Code Mapping

**API Routes** (`api/cmd/api/main.go:215-430`):

✅ **Good Patterns:**
```go
r.Get("/publisher/zmanim", h.GetPublisherZmanim)           // Concept → Resource
r.Get("/publisher/zmanim/{zmanKey}", h.GetPublisherZman)   // Concept → Resource → ID
r.Get("/publisher/coverage", h.GetPublisherCoverage)       // Concept → Resource

r.Get("/geo/boundaries/countries", h.GetCountryBoundaries) // Concept → Resource → Type
r.Get("/geo/boundaries/lookup", h.LookupPointLocation)     // Concept → Action

r.Get("/registry/zmanim/grouped", h.GetMasterZmanimGrouped) // Namespace → Resource → View
```

⚠️ **Inconsistent Patterns:**
```go
r.Post("/zmanim/from-publisher", h.CreateZmanFromPublisher)  // Missing /publisher prefix
r.Get("/zmanim/browse", h.BrowsePublicZmanim)                // Public vs publisher not clear
```

#### Database vs API Naming:

| Concept | Table Name | API Route | Consistency |
|---------|-----------|-----------|-------------|
| Publisher Zman | `publisher_zmanim` | `/publisher/zmanim` | ✅ Aligned |
| Master Zman | `master_zmanim_registry` | `/registry/zmanim` | ✅ Aligned |
| Coverage | `publisher_coverage` | `/publisher/coverage` | ✅ Aligned |
| Geo | `geo_cities` | `/geo/boundaries/...` | ⚠️ Partial (boundaries ≠ cities) |
| Algorithm | `algorithms` | `/publisher/algorithm` | ✅ Aligned |

#### What WYSIWYD Requires:

> "Use fully qualified names with consistent URI mapping across all system elements. Employ the Resource Description Framework structure mapping concept names to URIs at three hierarchical levels: concept, action, and argument."

**Required Pattern:**
```
/[concept]/[resource]/[id]/[action]
/publisher/zmanim/{zman_id}           ✅ Get zman
/publisher/zmanim/{zman_id}/link      ✅ Link action
/publisher/zmanim/{zman_id}/tags      ✅ Sub-resource
```

**Current Violations:**
```
/zmanim/from-publisher                ❌ Missing concept prefix
/zmanim/browse                        ❌ Ambiguous (publisher vs public)
```

---

## 7. Dependency Graph

```
PUBLISHER CONCEPT
├── publishers (owns state)
├── algorithms (owns via publisher_id FK) ───────┐
├── publisher_zmanim (owns via publisher_id FK) ─┼─┐
├── publisher_coverage (owns via publisher_id) ──┼─┤
├── publisher_invitations                        │ │
├── publisher_onboarding                         │ │
└── publisher_requests                           │ │
                                                 │ │
ALGORITHM CONCEPT ◄──────────────────────────────┘ │
├── algorithms                                     │ ❌ Coupled to Publisher
├── algorithm_version_history (UUID PK)            │
└── algorithm_rollback_audit                       │
                                                   │
ZMAN CONCEPT ◄─────────────────────────────────────┘
├── master_zmanim_registry (no owner) ◄────────┐   ❌ Coupled to Publisher
├── publisher_zmanim (inverse FK) ◄────────────┼─┐
├── master_zman_tags ◄─────────────────────────┼─┤ ❌ Coupled to Tags
├── publisher_zman_tags ◄──────────────────────┼─┤
├── master_zman_events ◄───────────────────────┼─┤ ❌ Coupled to Events
├── publisher_zman_events ◄────────────────────┼─┤
├── master_zman_day_types ◄────────────────────┼─┘
└── publisher_zman_day_types ◄─────────────────┘
                                                │
TAG CONCEPT ◄───────────────────────────────────┘
├── zman_tags (no owner)                          ❌ Owned by Zman concept
├── tag_types
├── master_zman_tags (references)
└── publisher_zman_tags (references)

EVENT CONCEPT
├── jewish_events (no owner)
├── jewish_event_types
├── master_zman_events (references) ◄─────────┐   ❌ Owned by Zman concept
└── publisher_zman_events (references) ◄──────┘

GEO CONCEPT (Hierarchy)
├── geo_continents (root)
│   └── geo_countries (continent_id FK) ──┐
│       └── geo_regions (country_id FK) ──┼─┐
│           └── geo_districts ─────────────┼─┤
│               └── geo_cities ◄───────────┘ │
│                   ├── geo_city_coordinates │
│                   ├── geo_city_elevations  │
│                   └── geo_city_boundaries  │
│                                            │
COVERAGE CONCEPT ◄──────────────────────────┘
├── publisher_coverage                        ❌ References 5 Geo levels
├── city_id, country_id, region_id FKs
└── coverage_levels (lookup table)
```

**Key:**
- ✅ Proper ownership
- ❌ Concept coupling violation
- ◄─ Foreign key dependency

---

## 8. Critical Violations Summary

| # | Violation | Location | Severity | Fix Effort |
|---|-----------|----------|----------|-----------|
| 1 | **95% of FKs are direct integer references** | Entire schema | 🚨 CRITICAL | HIGH (schema redesign) |
| 2 | **8-concept JOIN in GetPublisherZmanim** | `zmanim.sql:8-108` | 🚨 CRITICAL | MEDIUM (split query) |
| 3 | **Handler orchestrates multi-concept linking** | `publisher_zmanim.go:1474` | 🔴 HIGH | MEDIUM (move to service) |
| 4 | **Coverage couples to 5 Geo levels directly** | `publisher_coverage` table | 🔴 HIGH | HIGH (geo abstraction) |
| 5 | **Service layer has raw SQL** | `publisher_service.go:22+` | 🟡 MEDIUM | MEDIUM (migrate to SQLc) |
| 6 | **No action reification** | Entire codebase | 🟡 MEDIUM | HIGH (add actions table) |
| 7 | **Tag resolution hidden in SQL** | `zmanim.sql:50-79` | 🟡 MEDIUM | LOW (extract to query) |
| 8 | **No causal chain tracking** | Version history tables | 🟡 MEDIUM | MEDIUM (add FK to actions) |

---

## 9. Compliance Scorecard

| Principle | Score | Status | Notes |
|-----------|-------|--------|-------|
| **State Isolation** | 2/10 | 🚨 CRITICAL | Direct integer FKs everywhere |
| **Synchronization Boundaries** | 5/10 | ⚠️ MODERATE | Handler orchestration, no service layer |
| **Read/Write Separation** | 7/10 | ✅ GOOD | Clear in handlers, mixed in workflows |
| **Provenance Tracking** | 5/10 | ⚠️ MODERATE | Timestamps + versions, no causality |
| **Naming Consistency** | 6/10 | ⚠️ MODERATE | Good URI patterns, some inconsistencies |
| **Cross-Concept JOINs** | 3/10 | 🚨 CRITICAL | 8-concept queries, hidden complexity |
| **Overall WYSIWYD Compliance** | **4.5/10** | 🚨 **CRITICAL** | Systematic violations across all layers |

---

## 10. Recommendations (Prioritized)

### Phase 1: Stop the Bleeding (Immediate - 1 week)

1. **Create Service Layer for Multi-Concept Operations**
   - Extract `ZmanimLinkingService` from `CreateZmanFromPublisher` handler
   - Extract `CoverageService` for geo-coverage workflows
   - Document: "Handlers call services for multi-concept ops"

2. **Split GetPublisherZmanim Query**
   - Separate tag fetching into `GetZmanTags(zman_id)`
   - Separate source resolution into `GetZmanSource(zman_id)`
   - Handler explicitly fetches tags + source

3. **Add Transaction Boundaries**
   - All multi-step writes must use explicit `tx.Begin()` / `tx.Commit()`
   - Document transaction scope in handler comments

### Phase 2: Architectural Foundation (1-2 months)

4. **Introduce UUID References for New Concepts**
   - New tables use UUID PKs (not SERIAL)
   - Cross-concept references use UUID columns (no FK constraints)
   - Pilot with new feature (e.g., user preferences concept)

5. **Create Action Reification Table**
   ```sql
   CREATE TABLE public.actions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       action_type TEXT NOT NULL,
       concept TEXT NOT NULL,
       actor_id UUID NOT NULL,
       request_id UUID NOT NULL,
       parent_action_id UUID REFERENCES actions(id),
       payload JSONB NOT NULL,
       result JSONB,
       created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
   - All state changes log to `actions` table
   - Version history tables add `created_by_action_id` FK

6. **Geo Abstraction Layer**
   - Create `geo_location_references` table with UUID PK
   - Replace 5 FKs in `publisher_coverage` with single `geo_location_id`
   - Geo hierarchy changes don't break coverage

### Phase 3: Schema Migration (2-4 months)

7. **Migrate Core Tables to UUID**
   - Generate UUIDs for existing rows
   - Add UUID columns alongside integer IDs
   - Update FK references incrementally
   - Drop integer PKs once migration complete
   - **Order:** Geo → Zman → Publisher → Coverage

8. **Decompose Junction Tables**
   - Replace `master_zman_tags` / `publisher_zman_tags` with:
     ```sql
     CREATE TABLE zman_tag_associations (
         id UUID PRIMARY KEY,
         zman_uuid UUID NOT NULL,  -- No FK constraint
         tag_uuid UUID NOT NULL,   -- No FK constraint
         association_type TEXT,    -- 'master', 'publisher', 'override'
         created_at TIMESTAMPTZ DEFAULT now()
     );
     ```

9. **Eliminate Cross-Concept JOINs**
   - All queries fetch single concept + denormalized display fields only
   - Multi-concept data assembled in services layer
   - Handler code explicitly shows concept access

### Phase 4: Compliance Enforcement (Ongoing)

10. **Add Schema Linting**
    ```bash
    # scripts/lint-schema.sh
    # Fail if: FK references cross concept boundaries
    # Fail if: New tables use SERIAL instead of UUID
    # Fail if: JOINs exceed 3 tables
    ```

11. **Update Coding Standards**
    - Document concept boundaries in `docs/architecture/concepts.md`
    - Add "Concept Independence Checklist" to PR template
    - Require service layer for all multi-concept operations

---

## 11. Files Demonstrating Patterns

### Violations

**Critical:**
- `db/migrations/00000000000001_schema.sql` (entire schema)
- `api/internal/db/queries/zmanim.sql:8-108` (8-concept JOIN)
- `api/internal/handlers/publisher_zmanim.go:1474-1639` (handler orchestration)

**High:**
- `api/internal/services/publisher_service.go:22-112` (raw SQL)
- `api/internal/db/queries/coverage.sql:4-26` (5-geo FK dependencies)

### Compliant Examples

- `api/internal/handlers/coverage.go:27-61` (single concept read)
- `api/internal/handlers/publisher_algorithm.go:510-539` (explicit transactions)
- `algorithm_version_history` table (UUID PK, version tracking)

---

## Conclusion

**⚠️ PRAGMATIC APPROACH ADOPTED (2025-12-07)**

This audit documents violations of concept independence principles from the "What You See Is What It Does" paper. However, **the team has decided to accept these as technical debt** for the existing codebase while adopting better practices going forward.

### Current Decision: Hybrid Approach

**For Existing Codebase (Accepted Patterns):**
- ✅ Integer FKs remain (standard relational database practice)
- ✅ Current query patterns continue (SQLc provides type safety)
- ✅ Focus on **actionable improvements** (not full rewrite)

**For New Development (Improved Patterns):**
- ✅ New domain tables SHOULD use UUIDs
- ✅ Multi-concept operations SHOULD use service layer
- ✅ Complex queries SHOULD be split when practical

**Actionable Improvements (Prioritized by ROI):**

**High ROI (Recommend):**
1. **Service layer for multi-concept operations** (Phase 1)
   - Extract `ZmanimLinkingService` from `CreateZmanFromPublisher` handler
   - Extract `CoverageService` for geo-coverage workflows
   - **Benefit:** Clearer code, easier testing, explicit dependencies
   - **Effort:** 1 week

2. **Split complex queries** (Phase 1)
   - Separate tag fetching from `GetPublisherZmanim`
   - Separate source resolution
   - **Benefit:** Simpler queries, easier to optimize
   - **Effort:** 1-2 days per query

**Medium ROI (Consider):**
3. **Action reification table** (Phase 2)
   - Track which actions triggered which state changes
   - **Benefit:** Better debugging, audit trails
   - **Effort:** 2-3 weeks

**Low ROI (Optional):**
4. **Schema migration to UUIDs** (Phase 3-4)
   - Migrate existing tables to UUID PKs
   - **Benefit:** Full concept independence
   - **Effort:** 4-6 months
   - **Recommendation:** Only if concept independence becomes critical

### Why This Approach Makes Sense

**The paper presents an ideal**, not a requirement. Most successful applications use integer FKs and cross-concept JOINs. The key insights from this audit:

1. **Understand the tradeoffs** - We know where coupling exists
2. **Make informed decisions** - When to use services vs. direct queries
3. **Improve incrementally** - Better patterns for new code
4. **Document architecture** - AI agents understand current state

**Bottom Line:** This audit is a **reference guide**, not a mandate. Use it to make architecture decisions with full knowledge of tradeoffs.

---

**Audit Completed:** 2025-12-07
**Auditor:** Claude Sonnet 4.5 (AI Agent)
**Status:** ACCEPTED AS REFERENCE (not prescriptive)
**Next Steps:** Implement Phase 1 improvements if team sees value (optional)
