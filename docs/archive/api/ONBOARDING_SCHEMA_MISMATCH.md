# Onboarding Handler Schema Mismatch Issue

## Problem

The `api/internal/handlers/onboarding.go` handler contains raw SQL violations (using `h.db.Pool.Query/QueryRow/Exec` instead of SQLc queries), but there's a critical schema mismatch that prevents straightforward conversion to SQLc.

## Schema Mismatch Details

### Current Schema (from migrations/00000000000001_schema.sql)
```sql
CREATE TABLE public.publisher_onboarding (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    profile_complete boolean DEFAULT false,
    algorithm_selected boolean DEFAULT false,
    zmanim_configured boolean DEFAULT false,
    coverage_set boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
```

### Handler's Expected Schema
The handler code expects these columns:
- `id` ✓ (exists)
- `publisher_id` ✓ (exists)
- `current_step` ❌ (missing)
- `completed_steps` ❌ (missing - array type)
- `wizard_data` ❌ (missing - jsonb type)
- `started_at` ❌ (missing)
- `last_updated_at` ❌ (missing)
- `completed_at` ❌ (missing - nullable)
- `skipped` ❌ (missing - boolean)

## Raw SQL Violations Found

### File: `api/internal/handlers/onboarding.go`

1. **GetOnboardingState** (lines 41-49)
   - Uses: `h.db.Pool.QueryRow`
   - Query: SELECT with non-existent columns

2. **SaveOnboardingState** (lines 111-121)
   - Uses: `h.db.Pool.Exec`
   - Query: UPSERT with non-existent columns

3. **CompleteOnboarding** (lines 219-221)
   - Uses: `h.db.Pool.QueryRow`
   - Query: SELECT wizard_data column (doesn't exist)

4. **CompleteOnboarding** (lines 262-276, 279-292)
   - Uses: `h.db.Pool.Exec` (2 variants)
   - Query: INSERT INTO publisher_zmanim with `category` field (should be `time_category_id`)

5. **CompleteOnboarding** - Geo lookups (lines 322, 346, 369, 397, 405)
   - Uses: `h.db.Pool.QueryRow` (5 instances)
   - Query: SELECT from geo_continents, geo_countries, geo_regions, geo_cities

6. **CompleteOnboarding** - Coverage inserts (lines 327-337, 351-361, 374-384, 411-421)
   - Uses: `h.db.Pool.Exec` (4 instances)
   - Query: INSERT INTO publisher_coverage with subquery for coverage_level_id

7. **CompleteOnboarding** (lines 431-435)
   - Uses: `h.db.Pool.Exec`
   - Query: UPDATE publisher_onboarding SET completed_at (column doesn't exist)

8. **SkipOnboarding** (lines 508-513)
   - Uses: `h.db.Pool.Exec`
   - Query: UPSERT with `skipped` column (doesn't exist)

9. **ResetOnboarding** (lines 538-540, 548-550, 557-559)
   - Uses: `h.db.Pool.Exec` (3 instances)
   - Query: DELETE operations (these could work with existing schema)

## Solution Options

### Option 1: Update Database Schema (Recommended)
Create a migration to add the missing columns to match the handler's expectations:

```sql
ALTER TABLE publisher_onboarding
ADD COLUMN current_step integer DEFAULT 0,
ADD COLUMN completed_steps integer[] DEFAULT '{}',
ADD COLUMN wizard_data jsonb,
ADD COLUMN started_at timestamp with time zone DEFAULT now(),
ADD COLUMN last_updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN completed_at timestamp with time zone,
ADD COLUMN skipped boolean DEFAULT false;

-- Drop old columns
ALTER TABLE publisher_onboarding
DROP COLUMN profile_complete,
DROP COLUMN algorithm_selected,
DROP COLUMN zmanim_configured,
DROP COLUMN coverage_set;
```

Then create SQLc queries in `api/internal/db/queries/onboarding.sql`.

### Option 2: Rewrite Handler to Match Existing Schema
Modify `onboarding.go` to work with boolean flags instead of step tracking and wizard_data.

### Option 3: Determine Runtime Schema
Check if the actual running database has different schema than the migration files (migrations may be outdated).

## Additional Issues

### publisher_zmanim Table
Handler uses string `category` parameter but table has `time_category_id` integer.
Need to map category string to time_category_id via lookup.

## Recommendation

1. Verify the actual runtime database schema
2. If schema matches migrations: choose Option 1 or 2
3. Create SQLc queries only after schema is aligned
4. Update handler to use `time_category_id` lookup instead of `category` string

## Files Requiring Changes

- `db/migrations/` - New migration file
- `api/internal/db/queries/onboarding.sql` - New SQLc query file
- `api/internal/db/sqlcgen/` - Regenerated Go code
- `api/internal/handlers/onboarding.go` - Update to use SQLc queries
