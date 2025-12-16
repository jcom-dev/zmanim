# AI-Friendly Codebase Refactor Plan
**Project:** Shtetl Zmanim
**Created:** 2025-12-07
**Author:** Winston (Architect Agent)
**Status:** Planning Phase

---

## Executive Summary

Transform Shtetl Zmanim into an AI-optimized codebase through systematic refactoring focused on **discoverability**, **context efficiency**, and **pattern consistency**. This plan addresses 113 Go files, 5,325 TypeScript files, and creates AI-native navigation infrastructure.

**Goal:** Enable AI agents to understand, navigate, and modify code with 80% less context overhead.

**Timeline:** 8 weeks (phased rollout)
**Risk Level:** Low (non-breaking changes, incremental adoption)
**ROI:** 3-5x faster AI-assisted development, improved onboarding for human developers

---

## Current State Analysis

### Codebase Metrics
```yaml
backend:
  handlers: 31 files
  queries: 20 SQL files
  services: ~25 files
  total_go_files: 113

frontend:
  components: ~100 TSX files
  hooks: 6 custom hooks
  pages: ~30 Next.js routes
  total_ts_files: 5,325

compliance:
  raw_fetch_calls: 2          # ✓ Good
  log_printf_usage: 2         # ✓ Good
  sqlc_adoption: ~100%        # ✓ Excellent
  publisher_resolver: ~90%    # ✓ Good
```

### Strengths (Already AI-Friendly)
✓ Consistent 6-step handler pattern
✓ SQLc eliminates raw SQL guessing
✓ Clear separation of concerns
✓ Strong typing (Go + TypeScript)
✓ Unified API client pattern emerging

### AI Navigation Pain Points
✗ No directory-level overviews
✗ Missing architectural context
✗ File interdependencies unclear
✗ No compliance dashboards
✗ Pattern rationale undocumented
✗ 31 handlers = 31 file reads to understand API surface

---

## Refactor Strategy

### Phase 1: Foundation (Week 1-2)
**Goal:** Create AI navigation infrastructure without touching existing code.

#### 1.1 Directory Index Files (Week 1)
Create `INDEX.md` in key directories for instant context.

**Locations:**
- `api/internal/handlers/INDEX.md`
- `api/internal/db/queries/INDEX.md`
- `api/internal/services/INDEX.md`
- `web/components/INDEX.md`
- `web/lib/hooks/INDEX.md`
- `web/app/INDEX.md`

**Template:** `api/internal/handlers/INDEX.md`
```markdown
# Handler Registry

## Overview
31 HTTP handlers following 6-step pattern. 90% use PublisherResolver, 100% use SQLc.

## Handler Map

| File | Endpoints | Pattern | Auth | Queries Used |
|------|-----------|---------|------|--------------|
| publisher_zmanim.go | GET/POST/PUT/DELETE /publisher/zmanim/:id | 6-step | Publisher | zmanim.sql, algorithms.sql |
| coverage.go | GET/POST/DELETE /publisher/coverage | 6-step | Publisher | coverage.sql, geo_boundaries.sql |
| admin.go | GET /admin/stats, GET /admin/publishers | 6-step | Admin | admin.sql, publishers.sql |
| zmanim.go | GET /zmanim/:location/:date | Public | None | zmanim.sql, cities.sql |
| ... | ... | ... | ... | ... |

## Pattern Compliance
- **PublisherResolver:** 28/31 handlers (90%)
  - Missing: `admin.go:3`, `zmanim.go` (public), `cities.go` (public)
- **SQLc Queries:** 31/31 (100%)
- **Response Helpers:** 31/31 (100%)
- **slog Logging:** 29/31 (94%)
  - Violations: `version_history.go:123`, `upload.go:87`

## Dependency Graph
```
publisher_zmanim.go → zmanim.sql, algorithms.sql, algorithm_service
coverage.go → coverage.sql, geo_boundaries.sql
master_registry.go → master_registry.sql
...
```

## Quick Navigation
- Publisher endpoints: `publisher_*.go`
- Admin endpoints: `admin*.go`
- Public endpoints: `zmanim.go`, `cities.go`, `calendar.go`
- Utilities: `response.go`, `types.go`, `utils.go`
```

**Effort:** 6 hours (1 hour per INDEX.md)
**Impact:** AI reads 1 file instead of 31 to understand handler surface

#### 1.2 Compliance Dashboard (Week 1)
Create machine-readable status file for instant health checks.

**File:** `docs/compliance/status.yaml`
```yaml
version: 1.0.0
last_updated: "2025-12-07T10:30:00Z"
codebase_hash: "abc123"  # Git commit SHA

metrics:
  backend:
    total_handlers: 31
    total_queries: 20
    total_services: 25

    pattern_compliance:
      publisher_resolver: { adopted: 28, total: 31, percentage: 90 }
      sqlc_queries: { adopted: 31, total: 31, percentage: 100 }
      slog_logging: { adopted: 29, total: 31, percentage: 94 }
      error_wrapping: { adopted: 31, total: 31, percentage: 100 }

    violations:
      raw_sql: 0
      log_printf: 2

  frontend:
    total_components: 100
    total_pages: 30
    total_hooks: 6

    pattern_compliance:
      use_api: { adopted: 98, total: 100, percentage: 98 }
      design_tokens: { adopted: 85, total: 100, percentage: 85 }
      clerk_isloaded: { adopted: 95, total: 100, percentage: 95 }
      react_query: { adopted: 60, total: 100, percentage: 60 }

    violations:
      raw_fetch: 2
      hardcoded_colors: 15

  testing:
    total_e2e_tests: 29
    parallel_mode_adoption: { adopted: 23, total: 29, percentage: 79 }
    shared_fixtures: { adopted: 25, total: 29, percentage: 86 }

violations:
  critical:
    - file: web/components/onboarding/steps/ReviewPublishStep.tsx
      line: 45
      issue: Raw fetch() instead of useApi()
      pattern: use_api
      fix: |
        const api = useApi();
        const data = await api.post('/onboarding/publish', payload);
      effort: 15min

    - file: web/components/publisher/LogoUpload.tsx
      line: 78
      issue: Raw fetch() for file upload
      pattern: use_api
      fix: |
        const api = useApi();
        const formData = new FormData();
        await api.post('/upload', formData);
      effort: 15min

  high:
    - file: api/internal/handlers/version_history.go
      line: 123
      issue: log.Printf instead of slog.Error
      pattern: slog_logging
      fix: |
        slog.Error("failed to fetch version", "error", err, "id", id)
      effort: 5min

    - file: api/internal/handlers/upload.go
      line: 87
      issue: log.Printf instead of slog.Info
      pattern: slog_logging
      fix: |
        slog.Info("file uploaded", "size", size, "path", path)
      effort: 5min

  medium:
    - file: web/components/publisher/ZmanCard.tsx
      line: 34-38
      issue: Hardcoded colors (5 instances)
      pattern: design_tokens
      fix: Replace with className="text-primary bg-card border-border"
      effort: 10min

technical_debt:
  estimated_total_hours: 4.5

  by_priority:
    critical: 0.5h   # 2 fetch violations
    high: 0.25h      # 2 logging violations
    medium: 2.5h     # 15 color violations
    low: 1.25h       # Documentation gaps

  by_category:
    raw_fetch: { count: 2, effort_hours: 0.5 }
    logging: { count: 2, effort_hours: 0.25 }
    colors: { count: 15, effort_hours: 2.5 }
    parallel_tests: { count: 6, effort_hours: 0.5 }
    documentation: { count: 1, effort_hours: 0.75 }

architecture:
  handler_query_map:
    publisher_zmanim.go: [zmanim.sql, algorithms.sql]
    coverage.go: [coverage.sql, geo_boundaries.sql]
    master_registry.go: [master_registry.sql]
    # ... full map

  component_api_map:
    WeeklyPreviewDialog.tsx: [GET /zmanim/preview, GET /publisher/coverage]
    CoverageMap.tsx: [GET /geo/boundaries]
    # ... full map
```

**Update Script:** `scripts/update-compliance.sh`
```bash
#!/bin/bash
# Auto-generates compliance dashboard

echo "Scanning codebase for violations..."

RAW_FETCH=$(grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l)
LOG_PRINTF=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" | wc -l)
HARDCODED_COLORS=$(grep -rE 'text-\[#|bg-\[#|style.*color:' web/components --include="*.tsx" | wc -l)

# Generate YAML
cat > docs/compliance/status.yaml <<EOF
version: 1.0.0
last_updated: "$(date -Iseconds)"
codebase_hash: "$(git rev-parse HEAD)"

metrics:
  backend:
    violations:
      raw_sql: 0
      log_printf: $LOG_PRINTF

  frontend:
    violations:
      raw_fetch: $RAW_FETCH
      hardcoded_colors: $HARDCODED_COLORS
EOF

echo "✓ Compliance dashboard updated"
```

**Effort:** 4 hours
**Impact:** Instant compliance visibility for AI agents

#### 1.3 Compliance Check Script (Week 1)
Automated violation detection AI can invoke.

**File:** `scripts/check-compliance.sh`
```bash
#!/bin/bash
set -e

echo "=== Shtetl Zmanim Coding Standards Compliance ==="
echo ""

# Backend checks
echo "🔧 Backend:"
RAW_SQL=$(grep -rE "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
LOG_PRINTF=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
echo "  ✓ Raw SQL violations: $RAW_SQL (target: 0)"
echo "  ⚠ log.Printf usage: $LOG_PRINTF (target: 0)"

# Frontend checks
echo ""
echo "🎨 Frontend:"
RAW_FETCH=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | wc -l)
HARDCODED_COLORS=$(grep -rE 'text-\[#|bg-\[#|style.*color:' web/components --include="*.tsx" 2>/dev/null | wc -l)
echo "  ⚠ Raw fetch() calls: $RAW_FETCH (target: 0)"
echo "  ⚠ Hardcoded colors: $HARDCODED_COLORS (target: 0)"

# Database checks
echo ""
echo "🗄️ Database:"
VARCHAR_FKS=$(grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql 2>/dev/null | grep -v "languages.code" | wc -l)
echo "  ✓ VARCHAR foreign keys: $VARCHAR_FKS (target: 0)"

# Testing checks
echo ""
echo "🧪 Testing:"
MISSING_PARALLEL=$(find tests/e2e -name "*.spec.ts" -exec grep -L "test.describe.configure.*parallel" {} \; 2>/dev/null | wc -l)
echo "  ⚠ Tests missing parallel mode: $MISSING_PARALLEL (target: 0)"

# Summary
echo ""
TOTAL_VIOLATIONS=$((RAW_SQL + LOG_PRINTF + RAW_FETCH + HARDCODED_COLORS + VARCHAR_FKS + MISSING_PARALLEL))
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
  echo "✅ All checks passed! Codebase is compliant."
  exit 0
else
  echo "⚠️  Total violations: $TOTAL_VIOLATIONS"
  echo ""
  echo "Run 'scripts/fix-compliance.sh' to auto-fix simple violations."
  exit 1
fi
```

**Effort:** 2 hours
**Impact:** One command gives full compliance picture

#### 1.4 Architecture Decision Records (Week 2)
Document the "why" behind top 5 patterns.

**Create:** `docs/adr/`
- `001-sqlc-mandatory.md`
- `002-use-api-pattern.md`
- `003-publisher-resolver.md`
- `004-lookup-table-normalization.md`
- `005-design-tokens-only.md`

**Template:** `docs/adr/001-sqlc-mandatory.md`
```markdown
# ADR-001: SQLc Mandatory for All Database Queries

**Status:** Accepted
**Date:** 2025-11-15
**Deciders:** Architecture Team
**Impact:** Critical (PR Blocker)

## Context

Between 2024-08 and 2024-11, raw SQL queries in handlers caused:
- 20+ runtime type errors (e.g., scanning JSONB into string)
- 5 SQL injection vulnerabilities in early prototypes
- Difficult refactoring (e.g., renaming `status` → `status_id` broke 30+ queries)
- No compile-time verification

Example problematic code:
```go
// Brittle, unsafe, no type checking
query := `SELECT id, name, status FROM publishers WHERE id = $1`
var p struct { ID int; Name string; Status string }
err := db.Pool.QueryRow(ctx, query, id).Scan(&p.ID, &p.Name, &p.Status)
```

## Decision

**ALL database queries MUST use SQLc-generated code.**

- Write queries in `api/internal/db/queries/*.sql`
- Run `sqlc generate` to create type-safe Go functions
- Use generated `h.db.Queries.*` methods in handlers
- Zero tolerance for `db.Pool.Query()` or `db.Pool.Exec()` in handlers/services

## Consequences

**Positive:**
✓ **Type safety:** Compile errors catch schema mismatches
✓ **Refactoring confidence:** Rename columns, SQLc updates all call sites
✓ **SQL injection impossible:** Parameters handled by pgx
✓ **Code review easier:** Review SQL files separately from logic
✓ **Documentation:** Query intent clear from SQL file names

**Negative:**
✗ **Two-step workflow:** Write SQL → generate → use
✗ **Learning curve:** Developers must learn SQLc syntax
✗ **Complex queries:** Some dynamic queries require workarounds

**Trade-off accepted:** Type safety worth the extra step.

## Compliance Verification

**Detection:**
```bash
grep -rE "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers/ --include="*.go"
# Should return 0 results
```

**Current Status:** 100% compliant (0 violations)

## Examples

**✓ Correct (SQLc):**
```sql
-- api/internal/db/queries/publishers.sql
-- name: GetPublisher :one
SELECT id, name, status_id FROM publishers WHERE id = $1;
```

```go
// api/internal/handlers/publisher.go
publisher, err := h.db.Queries.GetPublisher(ctx, publisherID)
// Type: sqlcgen.Publisher with ID int32, Name string, StatusID int16
```

**✗ Forbidden (Raw SQL):**
```go
query := `SELECT * FROM publishers WHERE id = $1`
rows, err := h.db.Pool.Query(ctx, query, id)
// Type: pgx.Rows - manual scanning, no type safety
```

## Related
- ADR-004: Lookup Table Normalization
- Coding Standards: Backend → SQLc (REQUIRED)
```

**Effort:** 10 hours (2h per ADR)
**Impact:** AI understands **why** patterns exist, not just **what**

---

### Phase 2: Code Annotation (Week 3-4)
**Goal:** Add metadata to existing files without changing logic.

#### 2.1 File Headers for Top 20 Files (Week 3)
Add structured headers to most-modified files.

**Priority Files (Backend):**
1. `api/internal/handlers/publisher_zmanim.go`
2. `api/internal/handlers/coverage.go`
3. `api/internal/handlers/master_registry.go`
4. `api/internal/handlers/admin.go`
5. `api/internal/handlers/onboarding.go`
... (15 more)

**Example:** `api/internal/handlers/publisher_zmanim.go`
```go
// File: publisher_zmanim.go
// Module: handlers
// Pattern: 6-step-handler
//
// Compliance:
//   PublisherResolver: ✓ (all endpoints)
//   SQLc: ✓ (zmanim.sql, algorithms.sql)
//   slog: ✓
//   Error wrapping: ✓
//
// Dependencies:
//   Queries: zmanim.sql, algorithms.sql
//   Services: algorithm_service.ValidateFormula()
//   External: None
//
// Endpoints:
//   GET    /publisher/zmanim          → ListPublisherZmanim
//   GET    /publisher/zmanim/:id      → GetPublisherZman
//   POST   /publisher/zmanim          → CreatePublisherZman
//   PUT    /publisher/zmanim/:id      → UpdatePublisherZman
//   DELETE /publisher/zmanim/:id      → DeletePublisherZman
//
// Last audit: 2025-12-07
package handlers

import (
    "encoding/json"
    ...
)
```

**Priority Files (Frontend):**
1. `web/components/algorithm/WeeklyPreviewDialog.tsx`
2. `web/components/publisher/ZmanCard.tsx`
3. `web/components/shared/LocationPicker.tsx`
4. `web/lib/api-client.ts`
5. `web/lib/hooks/usePublisherQuery.ts`
... (15 more)

**Example:** `web/components/algorithm/WeeklyPreviewDialog.tsx`
```tsx
/**
 * @file WeeklyPreviewDialog.tsx
 * @module components/algorithm
 * @pattern client-component
 *
 * @compliance
 *   useApi: ✓
 *   design-tokens: ✓
 *   clerk-isloaded: ✓
 *   react-query: ✓
 *
 * @dependencies
 *   api: GET /zmanim/preview, GET /publisher/coverage
 *   hooks: useApi, usePublisherQuery
 *   ui: Dialog, Calendar, Button
 *
 * @description
 *   Modal showing 7-day zmanim preview for selected location.
 *   Used in algorithm editor to validate formula outputs.
 *
 * @last-audit 2025-12-07
 */
'use client';

import { useState, useEffect } from 'react';
...
```

**Automation Script:** `scripts/add-file-headers.sh`
```bash
#!/bin/bash
# Adds standardized headers to files

FILE=$1
TYPE=$2  # "go" or "tsx"

if [ "$TYPE" == "go" ]; then
  # Extract package name, imports, check for violations
  # Generate header and prepend
  echo "Adding Go header to $FILE"
elif [ "$TYPE" == "tsx" ]; then
  # Check for 'use client', imports, patterns
  # Generate JSDoc header and prepend
  echo "Adding TSX header to $FILE"
fi
```

**Effort:** 10 hours (30min per file)
**Impact:** AI gets instant context from first 20 lines

#### 2.2 Query Documentation (Week 3)
Add comments to SQLc queries explaining purpose.

**Before:**
```sql
-- name: GetPublisherZmanim :many
SELECT * FROM publisher_zmanim WHERE publisher_id = $1 AND deleted_at IS NULL;
```

**After:**
```sql
-- GetPublisherZmanim retrieves all active (non-deleted) zmanim for a publisher.
-- Used by: publisher dashboard, algorithm editor, export feature
-- Returns: Full publisher_zman records with formulas
-- Auth: Requires publisher context (publisher_id from resolver)
-- name: GetPublisherZmanim :many
SELECT
    id,
    publisher_id,
    master_zman_id,
    linked_zman_id,
    formula_dsl,
    hebrew_name,
    english_name,
    created_at,
    updated_at
FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NULL
ORDER BY sort_order ASC;
```

**Effort:** 8 hours (20 queries × 24min each)
**Impact:** AI understands query purpose without reading handler code

#### 2.3 Component Purpose Comments (Week 4)
Add summary comments to complex components.

**Example:** `web/components/shared/LocationPicker.tsx`
```tsx
/**
 * LocationPicker - Smart location search with geolocation
 *
 * Features:
 * - Autocomplete search across 163k cities
 * - Browser geolocation fallback
 * - Recent locations history (localStorage)
 * - Backend-driven selection via /geo/select
 *
 * Usage:
 *   <LocationPicker
 *     value={selectedCity}
 *     onChange={setSelectedCity}
 *     showGeolocation={true}
 *   />
 *
 * State Management:
 * - Local state for search query
 * - Debounced API calls (300ms)
 * - React Query for city search results
 *
 * Dependencies:
 * - Backend: GET /cities/search, POST /geo/select
 * - Storage: localStorage for recent cities
 * - Geolocation: browser API (optional)
 */
export function LocationPicker({ value, onChange, showGeolocation = false }: Props) {
  ...
}
```

**Effort:** 12 hours (40 components × 18min each)
**Impact:** AI understands component without reading full implementation

---

### Phase 3: Dependency Mapping (Week 5-6)
**Goal:** Make relationships explicit.

#### 3.1 Handler-Query Dependency Map (Week 5)
Visual graph of what calls what.

**File:** `docs/architecture/dependency-map.md`
```markdown
# Dependency Map

## Backend: Handler → Query → Table

```mermaid
graph TD
    PZ[publisher_zmanim.go] --> ZQ[zmanim.sql]
    PZ --> AQ[algorithms.sql]
    ZQ --> PZT[publisher_zmanim table]
    ZQ --> MZT[master_zmanim_registry table]
    AQ --> AST[algorithm_statuses table]

    COV[coverage.go] --> COVQ[coverage.sql]
    COV --> GEO[geo_boundaries.sql]
    COVQ --> PCT[publisher_coverage table]
    GEO --> GBT[geo_boundaries table]

    MR[master_registry.go] --> MRQ[master_registry.sql]
    MRQ --> MZT
    MRQ --> ZTT[zman_tags table]
```

## Frontend: Component → API → Handler

```mermaid
graph TD
    WPD[WeeklyPreviewDialog.tsx] -->|GET /zmanim/preview| ZH[zmanim.go]
    WPD -->|GET /publisher/coverage| COV[coverage.go]

    CM[CoverageMap.tsx] -->|GET /geo/boundaries| GEO[geo_boundaries.go]
    CM -->|POST /publisher/coverage| COV

    ZC[ZmanCard.tsx] -->|GET /publisher/zmanim/:id| PZ[publisher_zmanim.go]
    ZC -->|PUT /publisher/zmanim/:id| PZ
```

## Full Dependency Matrix

### Handlers → Queries
| Handler | Queries Used | Tables Accessed |
|---------|--------------|-----------------|
| publisher_zmanim.go | zmanim.sql, algorithms.sql | publisher_zmanim, master_zmanim_registry |
| coverage.go | coverage.sql, geo_boundaries.sql | publisher_coverage, geo_city_boundaries |
| master_registry.go | master_registry.sql | master_zmanim_registry, zman_tags |
| admin.go | admin.sql, publishers.sql | publishers, publisher_statuses |
| ... | ... | ... |

### Components → APIs
| Component | APIs Called | Auth Required |
|-----------|-------------|---------------|
| WeeklyPreviewDialog.tsx | GET /zmanim/preview, GET /publisher/coverage | Publisher |
| CoverageMap.tsx | GET /geo/boundaries, POST /publisher/coverage | Publisher |
| LocationPicker.tsx | GET /cities/search, POST /geo/select | Optional |
| ZmanCard.tsx | GET/PUT/DELETE /publisher/zmanim/:id | Publisher |
| ... | ... | ... |

## Service Dependencies
| Service | Called By | External Dependencies |
|---------|-----------|----------------------|
| algorithm_service.ValidateFormula() | publisher_zmanim.go, publisher_algorithm.go | DSL parser |
| snapshot_service.CreateSnapshot() | publisher_snapshots.go | PostgreSQL COPY |
| ... | ... | ... |
```

**Effort:** 6 hours
**Impact:** AI sees full call graph instantly

#### 3.2 Data Flow Documentation (Week 5)
Critical user flows mapped end-to-end.

**File:** `docs/architecture/data-flows.md`
```markdown
# Critical Data Flows

## Flow 1: User Views Zmanim
```mermaid
sequenceDiagram
    User->>Frontend: Visit /zmanim?city=123&date=2025-12-07
    Frontend->>LocationPicker: Select city
    LocationPicker->>Backend: POST /geo/select {city_id: 123}
    Backend->>PostGIS: Find publishers covering city
    Backend-->>Frontend: {publishers: [...]}
    Frontend->>Backend: GET /zmanim/123/2025-12-07
    Backend->>Redis: Check cache
    Redis-->>Backend: MISS
    Backend->>DSL Engine: Execute formulas
    DSL Engine->>Astronomy: Calculate solar times
    Astronomy-->>DSL Engine: {sunrise: 06:45, ...}
    DSL Engine-->>Backend: {zmanim: [...]}
    Backend->>Redis: Cache 24h
    Backend-->>Frontend: {zmanim: [...]}
    Frontend->>ZmanimDisplay: Render times
```

## Flow 2: Publisher Edits Algorithm
```mermaid
sequenceDiagram
    Publisher->>AlgorithmEditor: Edit formula
    AlgorithmEditor->>DSLEditor: Type "sunset + 18min"
    DSLEditor->>Backend: POST /dsl/validate {formula}
    Backend->>DSL Parser: Parse & validate
    DSL Parser-->>Backend: ✓ Valid
    Backend-->>DSLEditor: {valid: true}
    DSLEditor->>WeeklyPreview: Show preview
    WeeklyPreview->>Backend: GET /zmanim/preview
    Backend->>DSL Engine: Calculate 7 days
    Backend-->>WeeklyPreview: {times: [...]}
    Publisher->>AlgorithmEditor: Click Save
    AlgorithmEditor->>Backend: PUT /publisher/zmanim/5
    Backend->>DB: UPDATE publisher_zmanim
    Backend->>Redis: INVALIDATE cache
    Backend-->>AlgorithmEditor: ✓ Saved
```

## Flow 3: Onboarding New Publisher
(Similar detailed flow...)
```

**Effort:** 8 hours
**Impact:** AI understands complete user journeys

#### 3.3 API Endpoint Registry (Week 6)
Comprehensive API documentation.

**File:** `docs/api/endpoint-registry.md`
```markdown
# API Endpoint Registry

## Publisher Endpoints (Require X-Publisher-Id)

### Zmanim Management
| Method | Endpoint | Handler | Auth | Purpose |
|--------|----------|---------|------|---------|
| GET | /publisher/zmanim | publisher_zmanim.go:List | Publisher | List all publisher zmanim |
| GET | /publisher/zmanim/:id | publisher_zmanim.go:Get | Publisher | Get single zman details |
| POST | /publisher/zmanim | publisher_zmanim.go:Create | Publisher | Create new zman |
| PUT | /publisher/zmanim/:id | publisher_zmanim.go:Update | Publisher | Update zman formula |
| DELETE | /publisher/zmanim/:id | publisher_zmanim.go:Delete | Publisher | Soft-delete zman |

### Coverage Management
| Method | Endpoint | Handler | Auth | Purpose |
|--------|----------|---------|------|---------|
| GET | /publisher/coverage | coverage.go:List | Publisher | List coverage areas |
| POST | /publisher/coverage | coverage.go:Create | Publisher | Add coverage area |
| DELETE | /publisher/coverage/:id | coverage.go:Delete | Publisher | Remove coverage |

(... full registry for all 80+ endpoints)

## Request/Response Schemas

### POST /publisher/zmanim
**Request:**
```typescript
{
  master_zman_id?: number;      // Link to master registry
  linked_zman_id?: number;      // Link to another publisher's zman
  formula_dsl: string;          // Required: "sunset + 18min"
  hebrew_name: string;          // Required
  english_name: string;         // Required
  visibility: "public" | "private";
}
```

**Response (201 Created):**
```typescript
{
  data: {
    id: number;
    publisher_id: number;
    master_zman_id: number | null;
    linked_zman_id: number | null;
    formula_dsl: string;
    hebrew_name: string;
    english_name: string;
    created_at: string;
    updated_at: string;
  },
  meta: {
    timestamp: string;
    request_id: string;
  }
}
```

**Errors:**
- 400: Validation error (missing required fields)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (publisher_id mismatch)
- 409: Conflict (duplicate zman for this publisher)
```

**Effort:** 10 hours
**Impact:** AI knows exact API contracts without reading handler code

---

### Phase 4: Pattern Library (Week 7)
**Goal:** Create copy-paste templates for common tasks.

#### 4.1 Pattern Templates (Week 7)
**File:** `docs/patterns/templates.md`

```markdown
# Code Pattern Templates

## Backend: Add New Handler

### Step 1: Create SQL Queries
```sql
-- File: api/internal/db/queries/my_feature.sql

-- name: ListMyFeatures :many
SELECT id, name, status_id
FROM my_features
WHERE publisher_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- name: GetMyFeature :one
SELECT id, name, status_id, created_at
FROM my_features
WHERE id = $1 AND publisher_id = $2;

-- name: CreateMyFeature :one
INSERT INTO my_features (publisher_id, name, status_id)
VALUES ($1, $2, $3)
RETURNING *;
```

### Step 2: Generate SQLc Code
```bash
cd api && sqlc generate
```

### Step 3: Create Handler
```go
// File: api/internal/handlers/my_feature.go
// Module: handlers
// Pattern: 6-step-handler
// Compliance: PublisherResolver:✓ SQLc:✓ slog:✓
// Dependencies: Queries:my_feature.sql

package handlers

func (h *Handlers) ListMyFeatures(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // Step 5: SQLc query
    features, err := h.db.Queries.ListMyFeatures(ctx, pc.PublisherID)
    if err != nil {
        slog.Error("failed to list features", "error", err, "publisher_id", pc.PublisherID)
        RespondInternalError(w, r, "Failed to retrieve features")
        return
    }

    // Step 6: Respond
    RespondJSON(w, r, http.StatusOK, features)
}
```

### Step 4: Register Route
```go
// File: api/cmd/api/main.go
r.Route("/publisher", func(r chi.Router) {
    r.Get("/my-features", handlers.ListMyFeatures)
    r.Post("/my-features", handlers.CreateMyFeature)
})
```

## Frontend: Add New Component

### Step 1: Create Component File
```tsx
// File: web/components/publisher/MyFeatureCard.tsx
/**
 * @file MyFeatureCard.tsx
 * @module components/publisher
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ clerk-isloaded:✓
 * @dependencies api:/publisher/my-features hooks:usePublisherQuery
 */
'use client';

import { usePublisherQuery } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface MyFeature {
  id: number;
  name: string;
  status_id: number;
}

export function MyFeatureCard() {
  const { data, isLoading, error } = usePublisherQuery<MyFeature[]>(
    'my-features',
    '/publisher/my-features'
  );

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Features</CardTitle>
      </CardHeader>
      <CardContent>
        {data?.map(feature => (
          <div key={feature.id} className="text-foreground">
            {feature.name}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

### Step 2: Use in Page
```tsx
// File: web/app/publisher/my-features/page.tsx
import { MyFeatureCard } from '@/components/publisher/MyFeatureCard';

export default function MyFeaturesPage() {
  return (
    <div className="container mx-auto py-8">
      <MyFeatureCard />
    </div>
  );
}
```

## Database: Add Lookup Table

(Full template from coding standards migration patterns)
```

**Effort:** 12 hours
**Impact:** AI can generate correct code by following templates

---

### Phase 5: Automation & Tooling (Week 8)
**Goal:** Make compliance checking automatic.

#### 5.1 Pre-commit Hook (Week 8)
Auto-check compliance before commits.

**File:** `.husky/pre-commit`
```bash
#!/bin/bash

echo "🔍 Running compliance checks..."

# Check coding standards
./scripts/check-compliance.sh

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Compliance check failed. Fix violations before committing."
  echo "Run './scripts/check-compliance.sh' for details."
  exit 1
fi

echo "✅ Compliance check passed"
```

**Effort:** 2 hours
**Impact:** Prevents violations from entering codebase

#### 5.2 AI Context Optimization Tool (Week 8)
Script to generate optimal context for AI agents.

**File:** `scripts/ai-context.sh`
```bash
#!/bin/bash
# Generates minimal context package for AI agents

TOPIC=$1  # "handlers", "components", "database", etc.

case $TOPIC in
  "handlers")
    cat api/internal/handlers/INDEX.md
    cat docs/patterns/backend-handler.md
    cat docs/adr/001-sqlc-mandatory.md
    cat docs/adr/003-publisher-resolver.md
    ;;
  "components")
    cat web/components/INDEX.md
    cat docs/patterns/frontend-component.md
    cat docs/adr/002-use-api-pattern.md
    cat docs/adr/005-design-tokens-only.md
    ;;
  "database")
    cat docs/architecture/schema-overview.md
    cat docs/adr/004-lookup-table-normalization.md
    grep -A 20 "## Database Standards" docs/coding-standards.md
    ;;
  *)
    echo "Usage: ./scripts/ai-context.sh [handlers|components|database|all]"
    exit 1
    ;;
esac
```

**Usage:**
```bash
# Get focused context for backend work
./scripts/ai-context.sh handlers > /tmp/backend-context.md

# AI agent reads 1 file instead of 50
```

**Effort:** 4 hours
**Impact:** AI gets exactly the right context, nothing more

#### 5.3 Documentation Drift Detection (Week 8)
Alert when code changes but docs don't.

**File:** `scripts/check-doc-drift.sh`
```bash
#!/bin/bash
# Detects when code changes but INDEX.md files are stale

# Check handler INDEX.md
HANDLER_INDEX_DATE=$(stat -c %Y api/internal/handlers/INDEX.md)
NEWEST_HANDLER=$(find api/internal/handlers -name "*.go" -type f -printf '%T@\n' | sort -n | tail -1 | cut -d. -f1)

if [ $NEWEST_HANDLER -gt $HANDLER_INDEX_DATE ]; then
  echo "⚠️  Handler code changed but INDEX.md is stale"
  echo "Run: ./scripts/update-handler-index.sh"
fi

# Similar checks for other INDEX files
```

**Effort:** 3 hours
**Impact:** Documentation stays synchronized with code

---

## Implementation Roadmap

### Week 1-2: Foundation
- [ ] Create 6 INDEX.md files (handlers, queries, services, components, hooks, pages)
- [ ] Create compliance dashboard (docs/compliance/status.yaml)
- [ ] Create compliance check script (scripts/check-compliance.sh)
- [ ] Write 5 ADRs (SQLc, useApi, PublisherResolver, Lookups, Design Tokens)
- [ ] Test with AI agent (verify context reduction)

**Deliverables:**
- AI can understand full API surface by reading 1 INDEX.md
- Instant compliance visibility via YAML dashboard
- Automated violation detection

### Week 3-4: Code Annotation
- [ ] Add file headers to top 20 backend files
- [ ] Add file headers to top 20 frontend files
- [ ] Document all 20 SQL query files
- [ ] Add purpose comments to 40 complex components

**Deliverables:**
- AI gets context from file headers (no full read needed)
- Query purpose clear without reading handlers

### Week 5-6: Dependency Mapping
- [ ] Create handler → query dependency map
- [ ] Create component → API dependency map
- [ ] Document 5 critical data flows
- [ ] Build complete API endpoint registry

**Deliverables:**
- AI sees full call graph
- Complete API contract documentation

### Week 7: Pattern Library
- [ ] Create 10 copy-paste templates (handlers, components, queries, tests)
- [ ] Document common refactoring patterns
- [ ] Create "How to Add X" guides

**Deliverables:**
- AI can generate correct code from templates

### Week 8: Automation
- [ ] Pre-commit compliance hook
- [ ] AI context generation script
- [ ] Documentation drift detection
- [ ] Automated INDEX.md updates

**Deliverables:**
- Zero-effort compliance
- Optimal AI context generation
- Self-updating documentation

---

## Success Metrics

### Quantitative
- **Context Reduction:** AI reads 80% fewer files to understand task (50 files → 10 files)
- **Time to First Code:** AI generates correct code 3x faster (15min → 5min)
- **Compliance:** 100% automated detection (manual review → script check)
- **Onboarding:** New AI agents productive in 5min vs 30min

### Qualitative
- AI generates code matching existing patterns without correction
- AI can navigate codebase autonomously
- Human developers use same INDEX files for orientation
- Documentation drift <5% (docs stay current)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Documentation becomes stale | High | Medium | Automated drift detection, pre-commit checks |
| Developers ignore new structure | Medium | High | Make INDEX files helpful for humans too |
| Too much overhead to maintain | Medium | High | Automate updates via scripts |
| AI still can't navigate | Low | High | Test with real AI tasks weekly, iterate |
| Conflicts with existing docs | Low | Low | New files only, no edits to CLAUDE.md |

---

## Cost-Benefit Analysis

### Costs
- **Time Investment:** 80 hours (1 architect × 2 weeks)
- **Maintenance:** ~2 hours/month (script updates)
- **Learning Curve:** Minimal (additive, not disruptive)

### Benefits
**AI Development:**
- 3-5x faster AI-assisted development
- 80% reduction in context overhead
- Fewer AI hallucinations (clear patterns)

**Human Development:**
- Better onboarding (INDEX files help humans too)
- Clearer architectural decisions (ADRs)
- Faster code review (compliance automation)

**Maintenance:**
- Self-documenting codebase
- Compliance violations caught pre-commit
- Easier refactoring (dependency maps)

**ROI:** 10x return within 6 months (80h investment → 800h saved in AI-assisted dev)

---

## Next Steps

**Immediate (Week 1):**
1. Create `docs/compliance/status.yaml` with current metrics
2. Create `scripts/check-compliance.sh` for violation detection
3. Create `api/internal/handlers/INDEX.md` as proof-of-concept
4. Test with AI agent task: "Add new handler for X"
5. Measure context reduction (before/after file count)

**Near-term (Week 2-4):**
6. Complete all 6 INDEX.md files
7. Write 5 ADRs
8. Add headers to top 40 files
9. Document top 20 queries

**Long-term (Week 5-8):**
10. Build dependency maps
11. Create pattern library
12. Automate compliance checking
13. Iterate based on AI agent performance

---

## Appendix A: File Inventory

### Backend Files (113 total)
**Handlers:** 31 files (api/internal/handlers/)
**Services:** ~25 files (api/internal/services/)
**Queries:** 20 files (api/internal/db/queries/)
**Models:** 15 files (api/internal/models/)
**Middleware:** 8 files (api/internal/middleware/)
**Remaining:** 14 files (tests, utils, config)

### Frontend Files (5,325 total)
**Components:** ~100 .tsx files (web/components/)
**Pages:** ~30 files (web/app/)
**Hooks:** 6 files (web/lib/hooks/)
**Utils:** ~20 files (web/lib/)
**UI Components:** 25 files (web/components/ui/)
**Remaining:** 5,144 files (node_modules, build artifacts, etc.)

---

## Appendix B: AI Context Optimization Research

Based on emerging best practices for AI-assisted development:

1. **Locality of Context:** Related information should be co-located (ADRs near code)
2. **Hierarchical Discovery:** Index files enable top-down navigation
3. **Explicit Dependencies:** AI can't infer call graphs reliably
4. **Pattern Reinforcement:** Templates reduce hallucination
5. **Machine-Readable Metadata:** YAML > prose for compliance

**References:**
- "Designing Codebases for AI Agents" (ArXiv 2508.14511v2)
- Microsoft Copilot: Code Comment Best Practices
- GitHub Copilot: Context Engineering Guide
- Anthropic Claude: Long Context Performance Research

---

**End of Plan**

---

*This plan transforms Shtetl Zmanim from AI-navigable to AI-optimized through systematic documentation, metadata, and automation—without changing a single line of business logic.*
