# ADR-004: Lookup Table Normalization (ID + Key Pattern)

**Status:** Accepted
**Date:** 2025-10-20
**Deciders:** Database Team, Architecture Team
**Impact:** Critical (PR Blocker for schema changes)

## Context

Early schema (2024-08) used VARCHAR enums for status/type fields:

```sql
-- Old problematic pattern
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    status VARCHAR(20) NOT NULL  -- 'pending', 'verified', 'suspended'
);
```

**Problems encountered:**
- **Typos in data:** `'verfied'`, `'Verified'`, `'pending '` (trailing space)
- **No referential integrity:** Can insert invalid status values
- **Difficult migrations:** Renaming `'verified'` → `'active'` requires UPDATE across millions of rows
- **No metadata:** Cannot add display names, colors, descriptions
- **Query inefficiency:** VARCHAR comparisons slower than integer
- **Inconsistent casing:** `'pending'` vs `'Pending'` vs `'PENDING'`

**Failed alternatives:**
- PostgreSQL ENUMs: Can't add values without table lock, brittle
- CHECK constraints: Harder to query metadata, no display names

## Decision

**ALL lookup/reference data MUST use normalized lookup tables with integer IDs.**

**Mandatory pattern:**
```sql
-- Lookup table
CREATE TABLE {domain}_statuses|_types|_levels|_categories (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,           -- Programmatic identifier
    display_name_hebrew text NOT NULL,                   -- UI display (Hebrew)
    display_name_english text NOT NULL,                  -- UI display (English)
    description text,                                     -- Optional documentation
    -- Optional metadata (color, sort_order, icon, etc.)
    created_at timestamp with time zone DEFAULT now()
);

-- Entity table
CREATE TABLE {domain}_entities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    status_id smallint NOT NULL,  -- FK to lookup table
    FOREIGN KEY (status_id) REFERENCES {domain}_statuses(id)
);
```

## Verified Lookup Tables (21 Total)

### Status Tables (4)
- `publisher_statuses` - pending, verified, suspended, deleted
- `algorithm_statuses` - draft, published, archived
- `ai_index_statuses` - pending, indexed, failed
- `request_statuses` - pending, approved, rejected, expired

### Role/Level Tables (2)
- `publisher_roles` - owner, editor, viewer
- `coverage_levels` - city, admin1, country, global

### Jewish Calendar Tables (4)
- `jewish_event_types` - holiday, fast, rosh_chodesh, etc.
- `fast_start_types` - dawn, midnight
- `day_types` - weekday, shabbat, yom_tov
- `event_categories` - major_holiday, minor_holiday, fast

### Zman Taxonomy Tables (5)
- `primitive_categories` - solar, lunar, fixed
- `time_categories` - shacharit, mincha, maariv, shabbat, etc.
- `zman_source_types` - mishnah, gemara, shulchan_aruch, minhag
- `calculation_types` - solar_angle, fixed_time, proportional
- `edge_types` - start, end, midpoint

### Technical Tables (5)
- `geo_levels` - city, admin1, admin2, country
- `data_types` - string, number, boolean, json
- `explanation_sources` - ai, manual, template
- `geo_data_sources` - simplemaps, whosonfirst, manual
- `tag_types` - category, feature, language, region

### AI/Content Tables (1)
- `ai_content_sources` - formula, explanation, tag

## Schema Pattern

### Lookup Table Structure

```sql
CREATE TABLE public.publisher_statuses (
    -- Auto-incrementing ID (never hardcode in application)
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Programmatic key (use in code, migrations, seeds)
    key character varying(20) NOT NULL UNIQUE,

    -- Bilingual display names (UI)
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,

    -- Optional documentation
    description text,

    -- Optional metadata
    color character varying(7),        -- Hex color for badges
    sort_order smallint DEFAULT 0,     -- Display order
    is_active boolean DEFAULT true,    -- Soft disable

    created_at timestamp with time zone DEFAULT now()
);

-- Seed data uses keys, NOT hardcoded IDs
INSERT INTO publisher_statuses (key, display_name_hebrew, display_name_english, description, color) VALUES
('pending', 'ממתין לאישור', 'Pending Approval', 'Awaiting admin review', '#FFA500'),
('verified', 'מאומת', 'Verified', 'Active and verified', '#00A000'),
('suspended', 'מושעה', 'Suspended', 'Temporarily disabled', '#FF0000'),
('deleted', 'נמחק', 'Deleted', 'Soft deleted', '#808080');
```

### Foreign Key Pattern

```sql
-- Entity table references lookup by ID
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    status_id smallint NOT NULL,  -- FK to publisher_statuses.id

    CONSTRAINT publishers_status_id_fkey
        FOREIGN KEY (status_id)
        REFERENCES publisher_statuses(id)
);

-- Query using key (application code)
SELECT p.*
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'verified';  -- NOT hardcoded ID

-- SQLc query
-- name: GetVerifiedPublishers :many
SELECT p.id, p.name, ps.display_name_english
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'verified' AND p.deleted_at IS NULL;
```

## Consequences

### Positive
✅ **Data integrity:** Cannot insert invalid statuses (FK constraint)
✅ **Easy renaming:** Change key once, all references update
✅ **Metadata rich:** Store colors, icons, descriptions, translations
✅ **Query performance:** Integer FK faster than VARCHAR
✅ **Consistent casing:** Keys lowercase, display names proper case
✅ **Audit trail:** Can track when statuses added/changed
✅ **Type safety:** SQLc generates enums for keys

### Negative
✗ **More tables:** 21 lookup tables instead of CHECK constraints
✗ **Join overhead:** Must JOIN to get display names
✗ **Migration complexity:** Requires data backfill when converting

**Trade-off accepted:** Data quality and flexibility worth extra tables.

## Intentional Exceptions (ONLY 4)

### 1. Languages Table (ISO 639 Standard)
```sql
CREATE TABLE languages (
    code character varying(3) NOT NULL PRIMARY KEY,  -- 'en', 'he', 'yi'
    name text NOT NULL,
    native_name text NOT NULL
);
-- Exception: Use ISO code as PK (international standard)
```

### 2. Junction Tables (Many-to-Many)
```sql
CREATE TABLE master_zman_tags (
    master_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    PRIMARY KEY (master_zman_id, tag_id)  -- Composite PK
);
-- Exception: No separate ID needed for pure join table
```

### 3. Boundary Tables (1:1 with Parent)
```sql
CREATE TABLE geo_city_boundaries (
    city_id integer NOT NULL PRIMARY KEY,  -- Parent's ID is the PK
    boundary geography(MultiPolygon,4326) NOT NULL
);
-- Exception: 1:1 relationship, parent ID sufficient
```

### 4. Schema Migrations (Framework)
```sql
CREATE TABLE schema_migrations (
    version text NOT NULL PRIMARY KEY
);
-- Exception: Migration framework standard
```

## Migration Pattern

### Converting VARCHAR to Lookup Table

```sql
-- Step 1: Create lookup table
CREATE TABLE publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL
);

-- Step 2: Seed with existing values
INSERT INTO publisher_statuses (key, display_name_hebrew, display_name_english)
SELECT DISTINCT
    LOWER(status) as key,
    status as display_name_hebrew,  -- Placeholder
    status as display_name_english
FROM publishers
WHERE status IS NOT NULL;

-- Step 3: Add FK column
ALTER TABLE publishers ADD COLUMN status_id smallint;

-- Step 4: Backfill data (use keys, not hardcoded IDs)
UPDATE publishers p
SET status_id = (
    SELECT ps.id
    FROM publisher_statuses ps
    WHERE ps.key = LOWER(p.status)
);

-- Step 5: Add NOT NULL constraint
ALTER TABLE publishers ALTER COLUMN status_id SET NOT NULL;

-- Step 6: Add FK constraint
ALTER TABLE publishers
ADD CONSTRAINT publishers_status_id_fkey
FOREIGN KEY (status_id) REFERENCES publisher_statuses(id);

-- Step 7: Drop old column
ALTER TABLE publishers DROP COLUMN status;
```

## Application Code Patterns

### Backend (Go + SQLc)

```go
// ✓ CORRECT - Use key in WHERE clause
-- name: GetVerifiedPublishers :many
SELECT p.* FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'verified';

// ✗ FORBIDDEN - Hardcoded ID
-- name: GetVerifiedPublishers :many
SELECT * FROM publishers WHERE status_id = 2;  -- Brittle!
```

### Frontend (TypeScript)

```tsx
// ✓ CORRECT - Use key for logic, display name for UI
interface Publisher {
  id: number;
  name: string;
  status: {
    key: 'pending' | 'verified' | 'suspended' | 'deleted';
    display_name_english: string;
    display_name_hebrew: string;
    color: string;
  };
}

if (publisher.status.key === 'verified') {
  // Logic uses key
}

<Badge color={publisher.status.color}>
  {publisher.status.display_name_english}
</Badge>
```

### Seed Data Best Practice

```sql
-- ✓ CORRECT - Use keys in dependent seeds
INSERT INTO publishers (name, status_id) VALUES
('OU', (SELECT id FROM publisher_statuses WHERE key = 'verified')),
('Chabad', (SELECT id FROM publisher_statuses WHERE key = 'pending'));

-- ✗ FORBIDDEN - Hardcoded IDs
INSERT INTO publishers (name, status_id) VALUES
('OU', 2),  -- What if seed order changes?
('Chabad', 1);
```

## Validation Checklist

Before committing schema changes:
- [ ] All new tables have `id` field (except 4 exceptions)
- [ ] Lookup tables follow id + key + display_name pattern
- [ ] All foreign keys reference integer `id` (except `languages.code`)
- [ ] Zero VARCHAR/TEXT primary keys or foreign key columns
- [ ] Seed data uses `key` column in lookups, never hardcoded IDs
- [ ] Display names in Hebrew AND English

**Detection:**
```bash
# Should return 0 results
grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql | grep -v "languages.code"

# Should match number of lookup tables (21)
grep "FOREIGN KEY.*REFERENCES.*[(]id[)]" db/migrations/*.sql | wc -l
```

## Performance Considerations

### Index Strategy
```sql
-- Lookup tables (auto-indexed)
PRIMARY KEY (id)           -- Clustered index
UNIQUE (key)               -- Unique index for key lookups

-- Entity tables
CREATE INDEX idx_publishers_status_id ON publishers(status_id);
-- Foreign key index for JOIN performance
```

### Query Optimization
```sql
-- ✓ FAST - Direct key lookup (uses unique index)
SELECT * FROM publisher_statuses WHERE key = 'verified';

-- ✓ FAST - FK join (uses indexes)
SELECT p.*, ps.display_name_english
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id;

-- ✗ SLOW - Multiple lookups in SELECT
SELECT p.*, (SELECT display_name FROM statuses WHERE id = p.status_id)
FROM publishers p;
```

## Related Standards

- Database Standards: All tables use `id` primary key
- SQLc Mandatory: All queries use SQLc (ADR-001)
- Migrations: Idempotent, use keys not IDs

## Related ADRs

- ADR-001: SQLc Mandatory (works with lookup JOINs)
- ADR-005: Design Tokens (frontend uses status colors)

## Review Checklist

When reviewing PRs:
- [ ] No VARCHAR/TEXT foreign keys (except `languages.code`)
- [ ] Lookup tables have id + key + display names
- [ ] Seed data uses keys, not hardcoded IDs
- [ ] Application code queries by key, not ID
- [ ] Bilingual display names (Hebrew + English)

## Last Audit

**Date:** 2025-12-07
**Result:** 100% compliance (0 VARCHAR foreign keys)
**Lookup Tables:** 21 verified
**Next Review:** 2026-01-07
