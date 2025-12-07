# Lookup Table Normalization Plan

This plan normalizes all text-based enum/multi-value fields to use proper lookup tables with foreign keys.

## Overview

**Goal**: Replace all `text`/`varchar` fields that store enumerated values with `_id` foreign keys to lookup tables.

**Benefits**:
- Bilingual display names (Hebrew/English)
- UI metadata (colors, icons, sort order)
- Business logic flags
- Add new values without schema changes
- Referential integrity
- Consistent pattern across codebase

## Implementation Approach

**We will modify the existing migration files directly:**
- `db/migrations/00000000000001_schema.sql` - Add new lookup tables and change column definitions
- `db/migrations/00000000000002_seed_data.sql` - Add seed data for new lookup tables

**Then apply changes to running database:**
1. Run a migration script that applies the delta
2. Regenerate SQLc
3. Update Go code
4. Update frontend types

---

## Phase 1: New Lookup Tables

### 1.1 Status Tables

```sql
-- Generic statuses (reusable pattern)
CREATE TABLE public.publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color varchar(7),
    sort_order smallint NOT NULL DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);
-- Values: pending, active, suspended

CREATE TABLE public.algorithm_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color varchar(7),
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: draft, pending, published, deprecated

CREATE TABLE public.request_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color varchar(7),
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: pending, approved, rejected
-- Used by: publisher_requests, zman_registry_requests

CREATE TABLE public.ai_index_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color varchar(7),
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: pending, processing, completed, failed
```

### 1.2 Geographic Lookup Tables

```sql
CREATE TABLE public.geo_levels (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    sort_order smallint NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- Values: continent, country, region, district, city

CREATE TABLE public.coverage_levels (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- Values: city, district, region, country, continent
```

### 1.3 Domain Lookup Tables

```sql
CREATE TABLE public.jewish_event_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(30) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: weekly, yom_tov, fast, informational

CREATE TABLE public.fast_start_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- Values: dawn, sunset

CREATE TABLE public.calculation_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: horizon, solar_angle, transit, fixed_minutes

CREATE TABLE public.edge_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: center, top_edge, bottom_edge

CREATE TABLE public.zman_source_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: custom, registry, linked

CREATE TABLE public.zman_categories (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: essential, optional (for zmanim_templates.category)

CREATE TABLE public.publisher_roles (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    permissions jsonb,
    sort_order smallint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
-- Values: editor, admin
```

### 1.4 AI/Embeddings Lookup Tables

```sql
CREATE TABLE public.embedding_sources (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(50) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: TBD based on current usage

CREATE TABLE public.content_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(50) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: TBD based on current usage

CREATE TABLE public.ai_request_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(50) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: TBD based on current usage

CREATE TABLE public.ai_models (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(100) UNIQUE NOT NULL,
    display_name text NOT NULL,
    provider varchar(50),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);
-- Values: gpt-4, gpt-3.5-turbo, claude-3, etc.

CREATE TABLE public.explanation_sources (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- Values: ai, manual, imported
```

### 1.5 Import/Data Source Tables

```sql
CREATE TABLE public.import_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) UNIQUE NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);
-- Values: coordinates, elevation, hierarchy, full, boundaries
```

---

## Phase 2: Field Changes by Table

### 2.1 `publishers`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `status` | `text CHECK(...)` | `status_id` | `smallint NOT NULL` | `publisher_statuses` |

### 2.2 `algorithms`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `status` | `text CHECK(...)` | `status_id` | `smallint` | `algorithm_statuses` |

### 2.3 `publisher_requests`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `status` | `text CHECK(...)` | `status_id` | `smallint NOT NULL` | `request_statuses` |

### 2.4 `zman_registry_requests`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `status` | `varchar(20) CHECK(...)` | `status_id` | `smallint NOT NULL` | `request_statuses` |

### 2.5 `ai_index_status`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `status` | `varchar(20)` | `status_id` | `smallint NOT NULL` | `ai_index_statuses` |

### 2.6 `publisher_coverage`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `coverage_level` | `text CHECK(...)` | `coverage_level_id` | `smallint NOT NULL` | `coverage_levels` |

### 2.7 `publisher_invitations`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `role` | `text CHECK(...)` | `role_id` | `smallint NOT NULL` | `publisher_roles` |

### 2.8 `jewish_events`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `event_type` | `varchar(30) CHECK(...)` | `event_type_id` | `smallint NOT NULL` | `jewish_event_types` |
| `fast_start_type` | `varchar(20) CHECK(...)` | `fast_start_type_id` | `smallint` | `fast_start_types` |

### 2.9 `zman_tags`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `tag_type` | `varchar(50) CHECK(...)` | `tag_type_id` | `smallint NOT NULL` | `tag_types` (existing!) |

**Note**: `tag_types` table already exists but isn't being used as FK!

### 2.10 `astronomical_primitives`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `category` | `varchar(50)` | `category_id` | `smallint NOT NULL` | Create `primitive_categories` or use `time_categories` |
| `calculation_type` | `varchar(20) CHECK(...)` | `calculation_type_id` | `smallint NOT NULL` | `calculation_types` |
| `edge_type` | `varchar(20) CHECK(...)` | `edge_type_id` | `smallint` | `edge_types` |

### 2.11 `publisher_zmanim`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source_type` | `varchar(20) CHECK(...)` | `source_type_id` | `smallint NOT NULL` | `zman_source_types` |
| `category` | `text` | `category_id` | `smallint NOT NULL` | Use `time_categories.id` or create new |

### 2.12 `zmanim_templates`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `category` | `text CHECK(...)` | `category_id` | `smallint NOT NULL` | `zman_categories` |

### 2.13 `master_zmanim_registry`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `time_category` | `varchar(50)` | `time_category_id` | `smallint` | `time_categories` (existing!) |

### 2.14 `zman_registry_requests` (additional)

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `time_category` | `varchar(50)` | `time_category_id` | `smallint NOT NULL` | `time_categories` |

### 2.15 `geo_cities`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `coordinate_source` | `varchar(20)` | `coordinate_source_id` | `varchar(20)` | `geo_data_sources` (existing!) |
| `elevation_source` | `varchar(20)` | `elevation_source_id` | `varchar(20)` | `geo_data_sources` (existing!) |

**Note**: `geo_data_sources` uses `varchar(20)` as PK, so just add FK constraint.

### 2.16 `geo_names`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `entity_type` | `varchar(20)` | `entity_type_id` | `smallint NOT NULL` | `geo_levels` |
| `source` | `varchar(20)` | `source_id` | `varchar(20)` | `geo_data_sources` |

### 2.17 `geo_name_mappings`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `level` | `text CHECK(...)` | `level_id` | `smallint NOT NULL` | `geo_levels` |
| `source` | `text` | `source_id` | `varchar(20)` | `geo_data_sources` |

### 2.18 `geo_boundary_imports`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source` | `text` | `source_id` | `varchar(20) NOT NULL` | `geo_data_sources` |
| `level` | `text` | `level_id` | `smallint NOT NULL` | `geo_levels` |

### 2.19 `geo_data_imports`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source` | `varchar(20)` | `source_id` | `varchar(20) NOT NULL` | `geo_data_sources` |
| `import_type` | `varchar(20)` | `import_type_id` | `smallint NOT NULL` | `import_types` |

### 2.20 `embeddings`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source` | `text` | `source_id` | `smallint NOT NULL` | `embedding_sources` |
| `content_type` | `varchar(50)` | `content_type_id` | `smallint NOT NULL` | `content_types` |

### 2.21 `ai_index_status`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source` | `text` | `source_id` | `smallint NOT NULL` | `embedding_sources` |

### 2.22 `ai_audit_logs`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `request_type` | `varchar(50)` | `request_type_id` | `smallint NOT NULL` | `ai_request_types` |
| `model` | `varchar(100)` | `model_id` | `smallint` | `ai_models` |

### 2.23 `explanation_cache`

| Old Field | Old Type | New Field | New Type | Lookup Table |
|-----------|----------|-----------|----------|--------------|
| `source` | `varchar(20)` | `source_id` | `smallint NOT NULL` | `explanation_sources` |

---

## Phase 3: Implementation Steps

### Step 1: Modify `00000000000001_schema.sql`
1. Add all new lookup table CREATE statements (after existing tables, before PKs/FKs)
2. Change column definitions from `text`/`varchar` to `_id smallint`
3. Add FK constraints for the new `_id` columns
4. Update any CHECK constraints that reference the old text values

### Step 2: Modify `00000000000002_seed_data.sql`
1. Add INSERT statements for all new lookup tables (after languages, before other seed data)
2. Update existing INSERT statements that use old text values to use new `_id` values

### Step 3: Create Delta Migration Script
Since the database already has data, create a one-time script to:
1. Create new lookup tables
2. Add new `_id` columns (nullable)
3. Populate `_id` columns from existing text values via UPDATE...JOIN
4. Drop old text columns
5. Rename `_id` columns if needed
6. Add NOT NULL and FK constraints

### Step 4: Apply Changes
1. Run delta migration script on database
2. Run `sqlc generate`
3. Update Go code (handlers, services)
4. Update frontend TypeScript types

### Step 5: Cleanup
1. Remove delta migration script (it's a one-time operation)
2. Test all affected endpoints
3. Verify data integrity

---

## Phase 4: Code Changes Required

### 4.1 SQLc Queries to Update

All queries that SELECT, INSERT, or filter by the old text fields need updating:

- `api/internal/db/queries/publishers.sql`
- `api/internal/db/queries/algorithms.sql`
- `api/internal/db/queries/coverage.sql`
- `api/internal/db/queries/zmanim.sql`
- `api/internal/db/queries/master_registry.sql`
- `api/internal/db/queries/zman_requests.sql`
- `api/internal/db/queries/cities.sql`
- `api/internal/db/queries/admin.sql`

### 4.2 Go Services/Handlers

- Update request/response structs
- Update validation logic (remove string checks, use FK validation)
- Update any hardcoded status strings

### 4.3 Frontend

- Update TypeScript types
- Update API response handling
- Update forms/dropdowns to use lookup data

---

## Phase 5: Rollback Plan

Each step should be reversible:
1. Keep old columns until migration verified
2. Use database transactions
3. Have rollback migration ready

---

## Summary Statistics

| Category | New Tables | Field Changes |
|----------|------------|---------------|
| Status tables | 4 | 5 fields |
| Geographic | 2 | 8 fields |
| Domain/Zmanim | 7 | 10 fields |
| AI/Embeddings | 5 | 7 fields |
| **Total** | **18** | **30 fields** |

---

## Existing Lookup Tables to Leverage

These tables already exist and should be used as FKs:

| Table | Already Has | Use For |
|-------|-------------|---------|
| `tag_types` | `id`, `key`, Hebrew/English names | `zman_tags.tag_type` → `tag_type_id` |
| `time_categories` | `id`, `key`, Hebrew/English names | `master_zmanim_registry.time_category` → `time_category_id`, `publisher_zmanim.category` → `time_category_id`, `zman_registry_requests.time_category` → `time_category_id` |
| `geo_data_sources` | `id` (varchar PK), name, priority | All `source` fields in geo tables |

## Research Conclusions

### `publisher_zmanim.category` and `master_zmanim_registry.time_category`
- **Both use the SAME values**: `dawn`, `sunrise`, `morning`, `midday`, `afternoon`, `sunset`, `nightfall`, `midnight`
- **Solution**: Use existing `time_categories` table for both
- Rename both to `time_category_id` for consistency

### `astronomical_primitives.category`
- **Uses DIFFERENT values**: `horizon`, `civil_twilight`, `nautical_twilight`, `astronomical_twilight`, `solar_position`
- **Solution**: Create new `primitive_categories` table
