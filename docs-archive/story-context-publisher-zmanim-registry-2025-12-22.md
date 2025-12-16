# Story Context: Publisher Zmanim Registry Interface

**Date:** 2025-12-22
**Product Brief:** `/home/daniel/repos/zmanim/docs/product-brief-publisher-zmanim-registry-2025-12-22.md`
**Purpose:** Comprehensive context for implementing publisher zmanim registry explorer interface

---

## Table of Contents

1. [Overview](#overview)
2. [Existing Code Patterns](#existing-code-patterns)
3. [Component Patterns](#component-patterns)
4. [API Handler Patterns](#api-handler-patterns)
5. [Database Query Patterns](#database-query-patterns)
6. [DSL Integration](#dsl-integration)
7. [Security Patterns](#security-patterns)
8. [Data Models](#data-models)
9. [Reusable Components](#reusable-components)
10. [Coding Standards](#coding-standards)

---

## Overview

### What We're Building

A **Publisher Zmanim Registry Explorer** - a read-only discovery interface serving as both educational tool and practical catalog browser for publishers to explore and import zmanim.

**Two main tabs:**
1. **Master Registry** - Browse canonical master zmanim definitions with documentation
2. **Publisher Examples** - Explore real implementations from validated publishers

**Key Features:**
- Location-based preview (shared across tabs)
- Live calculation preview times
- Syntax-highlighted DSL formulas
- Comprehensive documentation modals
- Smart duplicate prevention
- Import/Link/Copy actions with redirect to algorithm page

### Reference Implementation

The **Algorithm Page** (`/home/daniel/repos/zmanim/web/app/publisher/algorithm/page.tsx`) contains similar patterns:
- Location selection with preview
- Zman listing with filters
- DSL formula display
- Live preview times
- Dual-calendar support (Gregorian/Hebrew)

**Key Difference:** Registry is read-only exploration; Algorithm is editing existing zmanim.

---

## Existing Code Patterns

### From `/home/daniel/repos/zmanim/docs/coding-standards.md`

#### CRITICAL: Publisher Zmanim MUST Link to Master Registry (Rule #1)

```
Every publisher zman MUST have `master_registry_id` OR `linked_zman_id` - no orphans.
```

**Implication for Registry Interface:**
- All Import/Link/Copy actions create `publisher_zmanim` with `master_zmanim_id`
- Duplicate prevention: Check if publisher already has zman with same `master_zmanim_id`

#### Backend Handler Pattern (6 Steps)

```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context (SECURITY CRITICAL)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. Extract URL params
    id := chi.URLParam(r, "id")

    // 3. Parse body
    var req RequestType
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // 4. Validate
    if req.Name == "" {
        RespondValidationError(w, r, "Name is required", nil)
        return
    }

    // 5. SQLc query (NO RAW SQL)
    result, err := h.db.Queries.GetSomething(ctx, sqlcgen.GetSomethingParams{
        ID:          id,
        PublisherID: pc.PublisherID,
    })
    if err != nil {
        slog.Error("operation failed", "error", err, "id", id)
        RespondInternalError(w, r)
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

#### Frontend API Client Pattern

```tsx
'use client';
import { useApi } from '@/lib/api-client';

export function Component() {
  const api = useApi();

  // Auth + X-Publisher-Id header
  const data = await api.get<DataType>('/publisher/profile');

  // No auth (public)
  const countries = await api.public.get('/countries');

  // Auth only (admin)
  const stats = await api.admin.get('/admin/stats');
}
```

**Compliance:** 98/100 (98%) - FORBIDDEN: Raw `fetch()` calls

#### React Query Pattern

```tsx
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';

// Query
const { data, isLoading, error } = usePublisherQuery<DataType>(
  'query-key',
  '/publisher/endpoint',
  { enabled: !!dependency }
);

// Mutation
const mutation = usePublisherMutation<Result, Payload>(
  '/publisher/endpoint',
  'POST',
  { invalidateKeys: ['query-key'] }
);
```

#### Design Tokens (MANDATORY)

```tsx
// REQUIRED - Design tokens
className="text-foreground bg-card border-border"
className="text-primary hover:text-primary/80"
className="text-muted-foreground"

// FORBIDDEN - Hardcoded colors
className="text-[#1e3a5f]"
style={{ color: '#ff0000' }}
```

#### Soft Delete Pattern

```sql
-- REQUIRED - All SELECT queries MUST filter out soft-deleted records
SELECT * FROM example_table WHERE deleted_at IS NULL;

-- Soft delete operation
UPDATE example_table
SET deleted_at = now(),
    deleted_by = $1
WHERE id = $2
  AND deleted_at IS NULL;
```

---

## Component Patterns

### From `/home/daniel/repos/zmanim/web/components/INDEX.md`

#### Reusable Components for Registry Interface

**Location Selection:**
```tsx
import { LocalityPicker } from '@/components/shared/LocalityPicker';

<LocalityPicker
  mode="single"
  placeholder="Search localities..."
  types={['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough']}
  publisherId={selectedPublisher?.id}
  autoFocus
  inlineResults
  onSelect={(selection) => {
    const loc = selection as LocalitySelection;
    setPreviewLocality(parseInt(loc.id, 10), loc.description || loc.name);
    setShowLocalityPicker(false);
  }}
/>
```

**Syntax Highlighting:**
```tsx
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';

<HighlightedFormula formula={zman.formula_dsl} />
```

**Info Tooltips:**
```tsx
import { InfoTooltip, StatusTooltip } from '@/components/shared/InfoTooltip';
import { STATUS_TOOLTIPS, ALGORITHM_TOOLTIPS } from '@/lib/tooltip-content';

<StatusTooltip status="published" tooltip={STATUS_TOOLTIPS.published}>
  <Badge>Published</Badge>
</StatusTooltip>
```

**Tag Management:**
```tsx
import { TagChip, TagFilterDropdown } from '@/components/shared/tags';
import { useTags } from '@/components/shared/tags/hooks/useTags';

const { data: allTags = [] } = useTags();

<TagFilterDropdown
  value={tagFilter}
  onChange={setTagFilter}
  tags={availableTags}
  placeholder="All Tags"
/>
```

**Zman Display:**
```tsx
import { ZmanName } from '@/components/shared/ZmanName';

<ZmanName
  hebrewName={zman.hebrew_name}
  englishName={zman.english_name}
  displayLanguage={displayLanguage}
/>
```

#### Component File Pattern

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';

export function Component() {
  // 1. Hooks
  const { user, isLoaded } = useUser();
  const api = useApi();
  const [data, setData] = useState(null);

  // 2. Effects
  useEffect(() => { if (isLoaded) fetchData(); }, [isLoaded]);

  // 3. Early returns: Loading → Error → Content
  if (!isLoaded) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;
  return <div>{/* content */}</div>;
}
```

#### Layout Pattern (Portal Layouts)

```tsx
<div className="min-h-screen flex flex-col bg-background text-foreground">
  {/* Header - Fixed height */}
  <header className="flex-none bg-card border-b border-border">
    ...
  </header>

  {/* Navigation - Hidden scrollbar */}
  <nav className="flex-none bg-card/50 border-b border-border">
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      ...
    </div>
  </nav>

  {/* Main Content - Fills remaining */}
  <main className="flex-1">
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  </main>
</div>
```

---

## API Handler Patterns

### From `/home/daniel/repos/zmanim/api/internal/handlers/INDEX.md`

#### Master Registry Endpoints (Reference)

**File:** `master_registry.go`

```go
// GET /api/v1/master-registry - List master zmanim
// GET /api/v1/master-registry/{key} - Get single master zman
// GET /api/v1/master-registry/grouped - Get grouped by category
// POST /api/v1/master-registry - Create master zman (Admin only)
// PUT /api/v1/master-registry/{key} - Update master zman (Admin only)
```

**Response Types:**
```go
type MasterZman struct {
    ID                   string    `json:"id"`
    ZmanKey              string    `json:"zman_key"`
    CanonicalHebrewName  string    `json:"canonical_hebrew_name"`
    CanonicalEnglishName string    `json:"canonical_english_name"`
    Transliteration      *string   `json:"transliteration,omitempty"`
    Description          *string   `json:"description,omitempty"`
    HalachicNotes        *string   `json:"halachic_notes,omitempty"`
    HalachicSource       *string   `json:"halachic_source,omitempty"`
    TimeCategory         string    `json:"time_category"`
    DefaultFormulaDSL    string    `json:"default_formula_dsl"`
    IsCore               bool      `json:"is_core"`
    Tags                 []ZmanTag `json:"tags,omitempty"`
    DayTypes             []string  `json:"day_types,omitempty"`
}
```

#### Publisher Zmanim Endpoints (Reference)

**File:** `publisher_zmanim.go` (1,901 LOC - most comprehensive handler)

```go
// GET /api/v1/publisher/zmanim - List all publisher zmanim
// POST /api/v1/publisher/zmanim - Create new zman
// GET /api/v1/publisher/zmanim/{key} - Get single zman
// PUT /api/v1/publisher/zmanim/{key} - Update zman
// DELETE /api/v1/publisher/zmanim/{key} - Soft-delete zman
// POST /api/v1/publisher/zmanim/{key}/restore - Restore soft-deleted
// POST /api/v1/publisher/zmanim/{key}/link - Link to another publisher's zman
// POST /api/v1/publisher/zmanim/{key}/copy - Copy from another publisher
// POST /api/v1/publisher/zmanim/preview - Preview formula calculation
```

**Key Functions:**
- `CreatePublisherZman()` - Create with `master_zman_id` or `linked_publisher_zman_id`
- `LinkOrCopyZman()` - Cross-publisher zman propagation with audit trail
- `PreviewFormula()` - DSL formula validation and preview

#### Public Zmanim Endpoints (Reference)

**File:** `zmanim.go`

```go
// GET /api/v1/zmanim - Calculate zmanim for locality+date
// GET /api/v1/publishers/{id}/zmanim - Get zmanim for specific publisher
```

**Response Format:**
```go
// Returns both `time` (HH:MM:SS) and `time_rounded` (HH:MM) fields
// Sorted by time category
```

#### New Endpoints Needed for Registry Interface

**Location:** `api/internal/handlers/registry.go` (NEW FILE)

```go
// GET /api/v1/publisher/registry/master - Browse master registry
// GET /api/v1/publisher/registry/master/{id} - Get master zman details + documentation
// GET /api/v1/publisher/registry/publishers - List validated publishers
// GET /api/v1/publisher/registry/publishers/{id}/zmanim - Get publisher's zmanim
// GET /api/v1/publisher/registry/preview - Preview zman for location + date
// POST /api/v1/publisher/registry/import - Import from master registry
// POST /api/v1/publisher/registry/link - Link to publisher's zman
// POST /api/v1/publisher/registry/copy - Copy from publisher's zman
```

**Validation Rules (CRITICAL):**
```go
// Validated publisher check
func isValidatedPublisher(ctx context.Context, publisherID int32) bool {
    // status = 'approved' AND deleted_at IS NULL
    // AND suspended_at IS NULL AND inactive_at IS NULL
}

// Duplicate prevention (ALL import/link/copy actions)
func hasZmanWithMasterId(ctx context.Context, publisherID int32, masterZmanID int32) bool {
    // Check if publisher already has ANY publisher_zmanim
    // where master_zmanim_id = target
}
```

---

## Database Query Patterns

### From `/home/daniel/repos/zmanim/api/internal/db/queries/INDEX.md`

#### Master Registry Queries (Reference)

**File:** `master_registry.sql`

```sql
-- name: GetAllMasterZmanim :many
SELECT
    mr.id, mr.zman_key, mr.canonical_hebrew_name, mr.canonical_english_name,
    mr.transliteration, mr.description, mr.halachic_notes, mr.halachic_source,
    tc.key as time_category, mr.default_formula_dsl, mr.is_core,
    mr.created_at, mr.updated_at
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
ORDER BY tc.sort_order, mr.canonical_hebrew_name;

-- name: GetMasterZmanByKey :one
-- name: GetMasterZmanByID :one
-- name: SearchMasterZmanim :many
-- name: GetMasterZmanimGroupedByCategory :many
```

#### Tag Queries (Reference)

```sql
-- name: GetAllTags :many
SELECT
    zt.id, zt.name, zt.display_name_hebrew, zt.display_name_english_ashkenazi,
    tt.key as tag_type, zt.description, zt.color, zt.sort_order, zt.created_at
FROM zman_tags zt
LEFT JOIN tag_types tt ON zt.tag_type_id = tt.id
ORDER BY tt.sort_order, zt.sort_order, zt.name;

-- name: GetTagsForMasterZman :many
```

#### Publisher Queries (Reference)

**File:** `publishers.sql`

```sql
-- Get validated publishers only
SELECT * FROM publishers
WHERE status_id = (SELECT id FROM publisher_statuses WHERE key = 'approved')
  AND deleted_at IS NULL
  -- Add additional checks for suspended/inactive if those columns exist
ORDER BY name;
```

#### Coverage Queries (Reference)

**File:** `coverage.sql`

```sql
-- Get localities within publisher's coverage
SELECT DISTINCT l.id, l.name, l.ascii_name, ...
FROM geo_localities l
JOIN publisher_coverage pc ON ST_Contains(pc.boundary, l.location::geometry)
WHERE pc.publisher_id = $1
  AND pc.deleted_at IS NULL
ORDER BY l.name;
```

#### New Queries Needed for Registry Interface

**Location:** `api/internal/db/queries/registry.sql` (NEW FILE)

```sql
-- name: GetValidatedPublishers :many
-- List all publishers eligible for public sharing
SELECT p.id, p.name, p.slug, p.logo_url, p.description
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'approved'
  AND p.deleted_at IS NULL
  -- Add suspended/inactive checks if those columns exist
ORDER BY p.name;

-- name: GetPublisherZmanimForRegistry :many
-- Get all zmanim for a validated publisher (for browsing)
SELECT
    pz.id, pz.zman_key, pz.hebrew_name, pz.english_name,
    pz.formula_dsl, pz.master_zmanim_id,
    mr.canonical_hebrew_name, mr.canonical_english_name,
    tc.key as time_category,
    pz.is_published, pz.created_at
FROM publisher_zmanim pz
JOIN master_zmanim_registry mr ON pz.master_zmanim_id = mr.id
JOIN time_categories tc ON mr.time_category_id = tc.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NULL
ORDER BY tc.sort_order, pz.hebrew_name;

-- name: CheckPublisherHasMasterZman :one
-- Duplicate prevention check
SELECT EXISTS(
    SELECT 1 FROM publisher_zmanim
    WHERE publisher_id = $1
      AND master_zmanim_id = $2
      AND deleted_at IS NULL
) as has_zman;

-- name: GetLocalitiesInPublisherCoverage :many
-- Get localities within specific publisher's coverage areas
SELECT DISTINCT
    l.id, l.name, l.ascii_name, l.country_code,
    l.admin1_code, l.latitude, l.longitude
FROM geo_localities l
JOIN publisher_coverage pc ON ST_Contains(pc.boundary, l.location::geometry)
WHERE pc.publisher_id = $1
  AND pc.deleted_at IS NULL
  AND l.name ILIKE '%' || $2 || '%'
ORDER BY l.population DESC NULLS LAST, l.name
LIMIT 20;
```

#### Soft Delete Pattern (CRITICAL)

**From coding-standards.md:**

```sql
-- REQUIRED - All SELECT queries MUST filter out soft-deleted records
WHERE deleted_at IS NULL

-- Soft delete operation
UPDATE example_table
SET deleted_at = now(),
    deleted_by = $1
WHERE id = $2
  AND deleted_at IS NULL;

-- Index for performance (CRITICAL)
CREATE INDEX idx_example_table_active ON example_table(id) WHERE deleted_at IS NULL;
```

---

## DSL Integration

### From `/home/daniel/repos/zmanim/docs/dsl-complete-guide.md`

#### DSL Formula Syntax

**Primitives (Basic astronomical events):**
```
sunrise          sunset           solar_noon         solar_midnight
visible_sunrise  visible_sunset   civil_dawn         civil_dusk
nautical_dawn    nautical_dusk    astronomical_dawn  astronomical_dusk
```

**Time Offsets:**
```
sunset - 18min       // Candle lighting (18 minutes before sunset)
sunrise - 72min      // Alos (72 minutes before sunrise)
sunset + 72min       // Tzeis Rabbeinu Tam (72 minutes after sunset)
solar_noon + 30min   // Mincha Gedola (30 minutes after midday)
```

**Solar Angles:**
```
solar(16.1, before_sunrise)    // Standard Alos (72-minute equivalent)
solar(8.5, after_sunset)       // Standard Tzeis (3 small stars)
solar(11.5, before_sunrise)    // Misheyakir (earliest tallis/tefillin)
```

**Proportional Hours (Shaos Zmaniyos):**
```
proportional_hours(3, gra)     // Sof Zman Shema (GRA opinion)
proportional_hours(4, mga)     // Sof Zman Tefilla (MGA opinion)
proportional_hours(10.75, gra) // Plag HaMincha
```

**Functions:**
```
midpoint(sunrise, sunset)                        // Chatzos
earlier_of(civil_dawn, sunrise - 90min)         // Whichever comes first
later_of(civil_dusk, sunset + 18min)            // Whichever comes last
first_valid(solar(16.1, before_sunrise), civil_dawn)  // Try primary, fallback if fails
```

**References:**
```
@alos_hashachar + 30min        // Reference another zman
@chatzos - 30min               // Build upon existing calculations
```

**Conditionals:**
```
if (latitude > 60) {
  civil_dawn
} else {
  solar(16.1, before_sunrise)
}
```

#### Common Zmanim Formulas (Reference Table)

| Zman | Formula | Notes |
|------|---------|-------|
| Alos (MGA 72) | `sunrise - 72min` | Fixed offset |
| Alos (Degrees) | `solar(16.1, before_sunrise)` | Astronomical |
| Misheyakir | `solar(11.5, before_sunrise)` | Earliest tallis/tefillin |
| Shema GRA | `proportional_hours(3, gra)` | Vilna Gaon |
| Shema MGA | `proportional_hours(3, mga)` | Magen Avraham |
| Tefilla GRA | `proportional_hours(4, gra)` | Morning prayer |
| Chatzos | `solar_noon` | Halachic midday |
| Mincha Gedola | `solar_noon + 30min` | Earliest Mincha |
| Mincha Ketana | `proportional_hours(9.5, gra)` | Preferred Mincha |
| Plag HaMincha | `proportional_hours(10.75, gra)` | End per R. Yehuda |
| Candle Lighting | `sunset - 18min` | Standard Ashkenazi |
| Tzeis (8.5°) | `solar(8.5, after_sunset)` | 3 small stars |
| Tzeis R"T | `sunset + 72min` | Rabbeinu Tam |

#### Syntax Highlighting Component

**Reuse existing CodeMirror integration:**

```tsx
import { CodeMirrorDSLEditor } from '@/components/editor/CodeMirrorDSLEditor';

<CodeMirrorDSLEditor
  value={formula}
  readOnly={true}
  className="bg-muted/30"
/>
```

Or for inline highlighting:

```tsx
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';

<HighlightedFormula formula={zman.formula_dsl} />
```

---

## Security Patterns

### From `/home/daniel/repos/zmanim/api/internal/docs/patterns/security-patterns.md` (referenced in coding-standards.md)

#### PublisherResolver (REQUIRED)

**SECURITY CRITICAL:** Always use PublisherResolver to prevent tenant isolation attacks.

```go
// ❌ FORBIDDEN - manual extraction (CRITICAL SECURITY VULNERABILITY)
publisherID := r.Header.Get("X-Publisher-Id")
// User can access ANY publisher by changing header!

// ✅ REQUIRED - Validated against JWT claims
pc := h.publisherResolver.MustResolve(w, r)
if pc == nil { return }  // Response already sent (401/404)
publisherID := pc.PublisherID  // Safe - validated against JWT
```

**Context Type:**
```go
type PublisherContext struct {
    PublisherID int32
    IsAdmin     bool
    UserID      string  // Clerk user ID
}
```

#### IDOR Prevention

**Critical Rules:**
1. **Always filter by publisher_id:** All queries must include `WHERE publisher_id = $1`
2. **Validate ownership:** Check resource belongs to current publisher before modification
3. **No trust in client data:** Validate all IDs against JWT claims

**Example:**
```go
// Get publisher's own zmanim (safe)
result, err := h.db.Queries.GetPublisherZmanim(ctx, pc.PublisherID)

// Get specific zman (validate ownership)
zman, err := h.db.Queries.GetPublisherZmanByKey(ctx, sqlcgen.GetPublisherZmanByKeyParams{
    PublisherID: pc.PublisherID,  // CRITICAL: Filter by owner
    ZmanKey:     zmanKey,
})
```

#### Input Validation

**Required checks:**
- All request body fields validated (required fields, format, range)
- URL parameters validated (format, existence)
- Cross-field validation (business rules)
- SQL injection prevention via SQLc (NEVER raw SQL)

**Pattern:**
```go
// 4. Validate
if req.MasterZmanID == "" {
    RespondValidationError(w, r, "Master zman ID is required", nil)
    return
}

// Validate master zman exists
masterZman, err := h.db.Queries.GetMasterZmanByID(ctx, masterZmanID)
if err == pgx.ErrNoRows {
    RespondValidationError(w, r, "Master zman not found", nil)
    return
}

// Check for duplicates (business rule)
hasDuplicate, err := h.db.Queries.CheckPublisherHasMasterZman(ctx, ...)
if hasDuplicate {
    RespondValidationError(w, r, "You already have this master zman", nil)
    return
}
```

---

## Data Models

### Core Tables

#### `master_zmanim_registry`

```sql
CREATE TABLE master_zmanim_registry (
    id SERIAL PRIMARY KEY,
    zman_key varchar(100) NOT NULL UNIQUE,
    canonical_hebrew_name text NOT NULL,
    canonical_english_name text NOT NULL,
    transliteration text,
    description text,
    halachic_notes text,
    halachic_source text,
    time_category_id smallint REFERENCES time_categories(id),
    default_formula_dsl text NOT NULL,
    is_core boolean DEFAULT false,
    is_hidden boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**Documentation Fields (Pre-Launch Backfill):**
- `description` - One-line summary
- `halachic_source` - Authority (e.g., "GRA", "MGA 72 min")
- `halachic_notes` - Detailed halachic explanation
- `default_formula_dsl` - Reference formula

#### `publisher_zmanim`

```sql
CREATE TABLE publisher_zmanim (
    id SERIAL PRIMARY KEY,
    publisher_id int NOT NULL REFERENCES publishers(id),
    zman_key varchar(100) NOT NULL,
    hebrew_name text NOT NULL,
    english_name text NOT NULL,
    formula_dsl text NOT NULL,
    master_zmanim_id int REFERENCES master_zmanim_registry(id),  -- REQUIRED (Rule #1)
    linked_publisher_zman_id int REFERENCES publisher_zmanim(id),
    copied_from_publisher_id int REFERENCES publishers(id),
    is_published boolean DEFAULT false,
    is_enabled boolean DEFAULT true,
    display_status varchar(20) DEFAULT 'core',  -- 'core', 'optional', 'hidden'
    deleted_at timestamptz,
    deleted_by text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(publisher_id, zman_key)
);

CREATE INDEX idx_publisher_zmanim_active
ON publisher_zmanim(id) WHERE deleted_at IS NULL;

CREATE INDEX idx_publisher_zmanim_master
ON publisher_zmanim(publisher_id, master_zmanim_id)
WHERE deleted_at IS NULL;
```

**Critical Constraint (Rule #1):**
```sql
-- Every publisher zman MUST link to master registry
ALTER TABLE publisher_zmanim
ADD CONSTRAINT publisher_zmanim_must_link_to_master
CHECK (master_zmanim_id IS NOT NULL);
```

#### `publishers`

```sql
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    slug varchar(100) UNIQUE NOT NULL,
    logo_url text,
    description text,
    status_id smallint REFERENCES publisher_statuses(id),
    deleted_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Validated publishers: status = 'approved' AND deleted_at IS NULL
```

#### `zman_tags`

```sql
CREATE TABLE zman_tags (
    id SERIAL PRIMARY KEY,
    name varchar(100) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english_ashkenazi text NOT NULL,
    tag_type_id smallint REFERENCES tag_types(id),
    description text,
    color varchar(20),
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
```

#### `master_zman_tags` (Junction)

```sql
CREATE TABLE master_zman_tags (
    master_zman_id int REFERENCES master_zmanim_registry(id) ON DELETE CASCADE,
    tag_id int REFERENCES zman_tags(id) ON DELETE CASCADE,
    is_negated boolean DEFAULT false,  -- When true, zman should NOT appear on days matching tag
    PRIMARY KEY (master_zman_id, tag_id)
);
```

### Response Types (Go)

**Registry Browse Response:**
```go
type RegistryBrowseResponse struct {
    MasterZmanim []MasterZmanWithStatus `json:"master_zmanim"`
    TotalCount   int                     `json:"total_count"`
}

type MasterZmanWithStatus struct {
    MasterZman
    AlreadyImported bool      `json:"already_imported"`
    PreviewTime     *string   `json:"preview_time,omitempty"`  // HH:MM AM/PM format
    PreviewError    *string   `json:"preview_error,omitempty"`
}
```

**Publisher Browse Response:**
```go
type PublisherZmanimBrowseResponse struct {
    Publisher       PublisherInfo        `json:"publisher"`
    Zmanim          []PublisherZmanWithStatus `json:"zmanim"`
    TotalCount      int                  `json:"total_count"`
}

type PublisherInfo struct {
    ID          int32   `json:"id"`
    Name        string  `json:"name"`
    Slug        string  `json:"slug"`
    LogoURL     *string `json:"logo_url,omitempty"`
    IsValidated bool    `json:"is_validated"`
}

type PublisherZmanWithStatus struct {
    PublisherZman
    MasterZmanInfo  MasterZmanInfo `json:"master_zman_info"`
    AlreadyImported bool           `json:"already_imported"`
    PreviewTime     *string        `json:"preview_time,omitempty"`
    PreviewError    *string        `json:"preview_error,omitempty"`
}

type MasterZmanInfo struct {
    ID                   int32  `json:"id"`
    CanonicalHebrewName  string `json:"canonical_hebrew_name"`
    CanonicalEnglishName string `json:"canonical_english_name"`
    TimeCategory         string `json:"time_category"`
}
```

**Import/Link/Copy Request:**
```go
type ImportFromMasterRequest struct {
    MasterZmanID int32   `json:"master_zman_id" validate:"required"`
    FormulaDSL   *string `json:"formula_dsl"`  // Optional override
}

type LinkToPublisherZmanRequest struct {
    PublisherZmanID int32 `json:"publisher_zman_id" validate:"required"`
}

type CopyFromPublisherZmanRequest struct {
    PublisherZmanID int32 `json:"publisher_zman_id" validate:"required"`
}
```

**Import/Link/Copy Response:**
```go
type ImportResponse struct {
    PublisherZmanID int32  `json:"publisher_zman_id"`
    ZmanKey         string `json:"zman_key"`
    Message         string `json:"message"`
    RedirectURL     string `json:"redirect_url"`  // /publisher/algorithm?focus={zman_key}
}
```

---

## Reusable Components

### Location Selection

**Component:** `LocalityPicker`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/LocalityPicker.tsx`

```tsx
import { LocalityPicker } from '@/components/shared/LocalityPicker';
import type { LocalitySelection } from '@/types/geography';

<LocalityPicker
  mode="single"
  placeholder="Search localities..."
  types={['locality', 'town', 'village', 'hamlet', 'neighborhood', 'borough']}
  publisherId={selectedPublisher?.id}  // For coverage filtering
  autoFocus
  inlineResults
  onSelect={(selection) => {
    const loc = selection as LocalitySelection;
    setPreviewLocality(parseInt(loc.id, 10), loc.description || loc.name);
  }}
/>
```

### DSL Syntax Highlighting

**Component:** `HighlightedFormula`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/HighlightedFormula.tsx`

```tsx
import { HighlightedFormula } from '@/components/shared/HighlightedFormula';

<HighlightedFormula
  formula={zman.formula_dsl}
  className="text-sm font-mono"
/>
```

**Or full editor (read-only):**

```tsx
import { CodeMirrorDSLEditor } from '@/components/editor/CodeMirrorDSLEditor';

<CodeMirrorDSLEditor
  value={formula}
  readOnly={true}
  className="bg-muted/30"
/>
```

### Zman Name Display

**Component:** `ZmanName`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/ZmanName.tsx`

```tsx
import { ZmanName } from '@/components/shared/ZmanName';

<ZmanName
  hebrewName={zman.hebrew_name}
  englishName={zman.english_name}
  displayLanguage={displayLanguage}  // 'hebrew' | 'english' | 'both'
/>
```

### Tags

**Components:** `TagChip`, `TagFilterDropdown`, `TagSelector`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/tags/`

```tsx
import { TagChip, TagFilterDropdown } from '@/components/shared/tags';
import { useTags } from '@/components/shared/tags/hooks/useTags';

// Fetch all tags
const { data: allTags = [] } = useTags();

// Display tag chip
<TagChip tag={tag} />

// Tag filter dropdown
<TagFilterDropdown
  value={tagFilter}
  onChange={setTagFilter}
  tags={availableTags}
  placeholder="All Tags"
/>
```

### Info Tooltips

**Component:** `InfoTooltip`, `StatusTooltip`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/InfoTooltip.tsx`

```tsx
import { InfoTooltip, StatusTooltip } from '@/components/shared/InfoTooltip';
import { STATUS_TOOLTIPS, ALGORITHM_TOOLTIPS } from '@/lib/tooltip-content';

<StatusTooltip status="published" tooltip={STATUS_TOOLTIPS.published}>
  <Badge>Published</Badge>
</StatusTooltip>

<InfoTooltip content="Additional information">
  <Icon className="h-4 w-4" />
</InfoTooltip>
```

### Time Formatting

**Utility:** `formatTime`, `formatTimeShort`
**Path:** `/home/daniel/repos/zmanim/web/lib/utils/time-format.ts`

```tsx
import { formatTime, formatTimeShort } from '@/lib/utils/time-format';

formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
```

### Display Settings

**Component:** `DisplaySettingsToggle`
**Path:** `/home/daniel/repos/zmanim/web/components/shared/DisplaySettingsToggle.tsx`

```tsx
import { DisplaySettingsToggle } from '@/components/shared/DisplaySettingsToggle';

<DisplaySettingsToggle
  defaultShowSeconds={true}  // Publisher pages default to seconds ON
  compact  // Compact mode for toolbars
/>
```

### shadcn/ui Components

**All UI primitives available:**

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```

---

## Coding Standards

### CRITICAL PR Blockers

#### 1. Publisher Zmanim MUST Link to Master Registry
```sql
-- Every publisher zman MUST have master_registry_id
-- No orphaned zmanim allowed
ALTER TABLE publisher_zmanim
ADD CONSTRAINT publisher_zmanim_must_link_to_master
CHECK (master_zmanim_id IS NOT NULL);
```

#### 2. PublisherResolver for ALL Publisher Endpoints
```go
// REQUIRED - Validates X-Publisher-Id against JWT claims
pc := h.publisherResolver.MustResolve(w, r)
if pc == nil { return }

// FORBIDDEN - Manual header extraction (SECURITY VULNERABILITY)
publisherID := r.Header.Get("X-Publisher-Id")
```

#### 3. SQLc for ALL Database Queries
```go
// REQUIRED - Type-safe SQLc queries
result, err := h.db.Queries.GetSomething(ctx, params)

// FORBIDDEN - Raw SQL (SQL injection risk)
query := fmt.Sprintf("SELECT * FROM table WHERE id = %d", id)
```

#### 4. Design Tokens for ALL Colors
```tsx
// REQUIRED - Design tokens
className="text-foreground bg-card border-border"

// FORBIDDEN - Hardcoded colors
className="text-[#1e3a5f]"
style={{ color: '#ff0000' }}
```

#### 5. useApi for ALL API Calls
```tsx
// REQUIRED - Unified API client
const api = useApi();
await api.get<DataType>('/publisher/endpoint');

// FORBIDDEN - Raw fetch()
fetch(`${API_BASE}/api/v1/endpoint`)
```

#### 6. Soft Delete Filter on ALL Queries
```sql
-- REQUIRED - Filter out soft-deleted records
WHERE deleted_at IS NULL
```

#### 7. Entity References ALWAYS Use IDs
```tsx
// REQUIRED - ID-based references
await api.post('/coverage', { city_id: 293397 });

// FORBIDDEN - Text-based lookups
await api.post('/coverage', { city_name: 'Jerusalem' });
```

### Code Quality Standards

**Clean Code Policy - ZERO TOLERANCE:**
- No `@deprecated` annotations
- No `// TODO:`, `// FIXME`, `// Legacy` comments
- No fallback logic for old formats
- One format only - migrate data, update code, delete old code

**Logging:**
```go
import "log/slog"

slog.Error("operation failed", "error", err, "user_id", userID)

// FORBIDDEN: fmt.Println, log.Printf
```

**Response Format:**
```json
{
  "data": <payload>,
  "meta": {
    "timestamp": "...",
    "request_id": "..."
  }
}
```

**Rule:** Pass data directly to `RespondJSON` - NEVER double-wrap

### Testing Standards

**Parallel Execution (REQUIRED):**
```typescript
test.describe.configure({ mode: 'parallel' });  // Top of every spec
```

**Shared Fixtures (REQUIRED):**
```typescript
// FORBIDDEN - per-test creation
test.beforeEach(async () => { testPublisher = await create(...); });

// REQUIRED - shared fixtures
import { getSharedPublisher } from '../utils';
const publisher = getSharedPublisher('verified-1');
```

### CI/CD Standards

**Run locally BEFORE pushing:**
```bash
# Backend checks
cd api && golangci-lint run ./...
cd api && go build -v ./cmd/api ./internal/...
cd api && go test ./...

# Frontend checks
cd web && npm run type-check
cd web && npm run build

# E2E checks
cd tests && npx playwright test

# Or run all checks
./scripts/validate-ci-checks.sh
```

---

## Migration Plan: Clean Slate Approach

### Remove from Algorithm Page

**File:** `/home/daniel/repos/zmanim/web/app/publisher/algorithm/page.tsx`

**Delete (Lines 1144-1238):** Entire "Add Zman Mode" dialog and related functionality

**Remove:**
1. `MasterZmanPicker` component usage
2. `PublisherZmanPicker` component usage
3. `RequestZmanModal` component usage (move to registry page)
4. All "Add Zman" button and handlers
5. State: `showAddZmanModeDialog`, `showZmanPicker`, `showPublisherZmanPicker`, `publisherZmanMode`, `showRequestZmanModal`

**Replace with:**
```tsx
<Button
  variant="default"
  onClick={() => router.push('/publisher/registry')}
  className="flex items-center gap-2"
>
  <Library className="h-4 w-4" />
  Browse Registry
</Button>
```

**Rationale:**
- Complete separation of concerns
- Registry Explorer = Discovery, browsing, importing (ADD new)
- Algorithm Page = Editing, configuring (EDIT existing only)

### Navigation Flow

**Registry → Algorithm (Post-Import):**
```tsx
// After successful import/link/copy
router.push(`/publisher/algorithm?focus=${zmanKey}`);
// Algorithm page scrolls to and highlights new zman
```

**Algorithm → Registry (Discovery):**
```tsx
// "Browse Registry" button in header
router.push('/publisher/registry');
```

---

## Summary Checklist

### Backend Requirements
- [ ] New file: `api/internal/handlers/registry.go`
- [ ] New file: `api/internal/db/queries/registry.sql`
- [ ] PublisherResolver for ALL endpoints
- [ ] SQLc queries (NO raw SQL)
- [ ] Soft delete filtering on ALL queries
- [ ] Duplicate prevention by `master_zmanim_id`
- [ ] Validated publisher filtering (approved, not deleted/suspended/inactive)
- [ ] Coverage-restricted location search
- [ ] Response helpers (RespondJSON, RespondError, etc.)
- [ ] slog for ALL logging

### Frontend Requirements
- [ ] New route: `/publisher/registry/page.tsx`
- [ ] Location picker (shared across tabs)
- [ ] Tab navigation (Master Registry | Publisher Examples)
- [ ] Live preview times
- [ ] Syntax highlighting (DSL formulas)
- [ ] Documentation modals
- [ ] Smart duplicate prevention UI
- [ ] Import/Link/Copy actions with redirect
- [ ] Search/filter functionality
- [ ] Design tokens (NO hardcoded colors)
- [ ] useApi (NO raw fetch)
- [ ] React Query patterns

### Data Requirements
- [ ] Master registry documentation backfill (REQUIRED for launch)
- [ ] Audit Publisher 1 (MH Zmanim) linkages
- [ ] Verify all publisher zmanim have `master_zmanim_id`

### Migration Requirements
- [ ] Remove "Add Zman" functionality from algorithm page
- [ ] Add "Browse Registry" button to algorithm page
- [ ] Test navigation flow (registry → algorithm with focus param)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-22
**Next Review:** Before story breakdown
