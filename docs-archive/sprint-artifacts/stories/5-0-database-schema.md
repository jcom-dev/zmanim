# Story 5.0: Database Schema for Publisher Aliases & Zman Requests

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 3
**Dependencies:** None (first story of Epic 5)
**FRs:** Infrastructure for FR96-FR113 (enables all Epic 5 features)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Database Migrations" (migration file naming, idempotent SQL)
- "Backend Standards > SQLc Integration" (query definitions, code generation)
- "Development Workflow > Service Restart" (always use `./restart.sh` after migrations)

---

## Story

As a **developer**,
I want **the database schema extended for publisher zman aliases and enhanced zman requests**,
So that **publishers can customize zman names and the platform can process zman requests systematically**.

---

## Acceptance Criteria

### AC-5.0.1: Publisher Zman Aliases Table
- [ ] `publisher_zman_aliases` table exists with all required columns
- [ ] `id` (UUID, PK) with default gen_random_uuid()
- [ ] `publisher_id` (FK to publishers) with ON DELETE CASCADE
- [ ] `publisher_zman_id` (FK to publisher_zmanim) with ON DELETE CASCADE
- [ ] `custom_hebrew_name` (TEXT, NOT NULL)
- [ ] `custom_english_name` (TEXT, NOT NULL)
- [ ] `custom_transliteration` (TEXT, nullable)
- [ ] `is_active` (BOOLEAN, default true)
- [ ] `created_at`, `updated_at` (TIMESTAMPTZ with defaults)
- [ ] UNIQUE constraint on (publisher_id, publisher_zman_id)
- [ ] Indexes on publisher_id and publisher_zman_id

### AC-5.0.2: Enhanced Zman Registry Requests
- [ ] `zman_registry_requests` table enhanced with new columns:
  - `transliteration` (TEXT)
  - `description` (TEXT)
  - `halachic_notes` (TEXT)
  - `halachic_source` (TEXT)
  - `publisher_email` (TEXT)
  - `publisher_name` (TEXT)
  - `auto_add_on_approval` (BOOLEAN, default true)

### AC-5.0.3: Zman Request Tags Table
- [ ] `zman_request_tags` table exists with all required columns
- [ ] `id` (UUID, PK)
- [ ] `request_id` (FK to zman_registry_requests) with ON DELETE CASCADE
- [ ] `tag_id` (FK to zman_tags, nullable) with ON DELETE SET NULL
- [ ] `requested_tag_name` (TEXT, for new tag requests)
- [ ] `requested_tag_type` (TEXT, constrained to: 'event', 'timing', 'behavior', 'shita', 'method')
- [ ] `is_new_tag_request` (BOOLEAN, default false)
- [ ] `created_at` (TIMESTAMPTZ)
- [ ] CHECK constraint: either tag_id OR requested_tag_name is set (not both null, not both set)
- [ ] Indexes on request_id and tag_id

### AC-5.0.4: SQLc Code Generation
- [ ] SQLc queries generated for alias CRUD operations
- [ ] SQLc queries generated for enhanced request operations
- [ ] All generated code compiles without errors

---

## Technical Context

### Migration Files to Create

**Migration 1: `db/migrations/00000000000023_publisher_zman_aliases.sql`**
```sql
-- Publisher Zman Aliases: Custom display names per publisher
CREATE TABLE publisher_zman_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    publisher_zman_id UUID NOT NULL REFERENCES publisher_zmanim(id) ON DELETE CASCADE,
    custom_hebrew_name TEXT NOT NULL,
    custom_english_name TEXT NOT NULL,
    custom_transliteration TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(publisher_id, publisher_zman_id)
);

CREATE INDEX idx_publisher_zman_aliases_publisher ON publisher_zman_aliases(publisher_id);
CREATE INDEX idx_publisher_zman_aliases_zman ON publisher_zman_aliases(publisher_zman_id);

CREATE TRIGGER update_publisher_zman_aliases_updated_at
    BEFORE UPDATE ON publisher_zman_aliases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE publisher_zman_aliases IS 'Custom display names for zmanim per publisher. Original master registry names remain accessible.';
```

**Migration 2: `db/migrations/00000000000024_enhance_zman_registry_requests.sql`**
```sql
-- Enhance zman_registry_requests for Epic 5 workflow
ALTER TABLE zman_registry_requests
    ADD COLUMN IF NOT EXISTS transliteration TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS halachic_notes TEXT,
    ADD COLUMN IF NOT EXISTS halachic_source TEXT,
    ADD COLUMN IF NOT EXISTS publisher_email TEXT,
    ADD COLUMN IF NOT EXISTS publisher_name TEXT,
    ADD COLUMN IF NOT EXISTS auto_add_on_approval BOOLEAN DEFAULT true;

-- Zman Request Tags (many-to-many with new tag request support)
CREATE TABLE zman_request_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES zman_registry_requests(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES zman_tags(id) ON DELETE SET NULL,
    requested_tag_name TEXT,
    requested_tag_type TEXT CHECK (requested_tag_type IN ('event', 'timing', 'behavior', 'shita', 'method')),
    is_new_tag_request BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT tag_reference_check CHECK (
        (tag_id IS NOT NULL AND requested_tag_name IS NULL) OR
        (tag_id IS NULL AND requested_tag_name IS NOT NULL)
    )
);

CREATE INDEX idx_zman_request_tags_request ON zman_request_tags(request_id);
CREATE INDEX idx_zman_request_tags_tag ON zman_request_tags(tag_id);

COMMENT ON TABLE zman_request_tags IS 'Tags associated with zman registry requests, including requests for new tags';
```

### SQLc Queries to Add

**File: `api/internal/db/queries/aliases.sql`**
```sql
-- name: GetPublisherZmanAlias :one
SELECT
    pza.id, pza.custom_hebrew_name, pza.custom_english_name, pza.custom_transliteration,
    pza.is_active, pza.created_at, pza.updated_at,
    pz.zman_key
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
WHERE pza.publisher_id = $1 AND pz.zman_key = $2;

-- name: UpsertPublisherZmanAlias :one
INSERT INTO publisher_zman_aliases (
    publisher_id, publisher_zman_id, custom_hebrew_name, custom_english_name, custom_transliteration
)
SELECT $1, pz.id, $3, $4, $5
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
ON CONFLICT (publisher_id, publisher_zman_id) DO UPDATE SET
    custom_hebrew_name = EXCLUDED.custom_hebrew_name,
    custom_english_name = EXCLUDED.custom_english_name,
    custom_transliteration = EXCLUDED.custom_transliteration,
    updated_at = NOW()
RETURNING id, custom_hebrew_name, custom_english_name, custom_transliteration, created_at, updated_at;

-- name: DeletePublisherZmanAlias :exec
DELETE FROM publisher_zman_aliases pza
USING publisher_zmanim pz
WHERE pza.publisher_zman_id = pz.id
  AND pza.publisher_id = $1
  AND pz.zman_key = $2;

-- name: GetAllPublisherZmanAliases :many
SELECT
    pza.id, pza.custom_hebrew_name, pza.custom_english_name, pza.custom_transliteration,
    pz.zman_key, pza.created_at, pza.updated_at
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
WHERE pza.publisher_id = $1 AND pza.is_active = true
ORDER BY pz.sort_order;
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Migration Files
  - [ ] 1.1 Create `00000000000023_publisher_zman_aliases.sql`
  - [ ] 1.2 Create `00000000000024_enhance_zman_registry_requests.sql`
  - [ ] 1.3 Review existing `zman_registry_requests` table structure

- [ ] Task 2: Run Migrations
  - [ ] 2.1 Run migrations locally with `./scripts/migrate.sh`
  - [ ] 2.2 Verify tables created successfully
  - [ ] 2.3 Test constraints and indexes

- [ ] Task 3: Create SQLc Queries
  - [ ] 3.1 Create `api/internal/db/queries/aliases.sql`
  - [ ] 3.2 Create `api/internal/db/queries/zman_requests.sql` with request operations
  - [ ] 3.3 Run `cd api && sqlc generate` to create Go code
  - [ ] 3.4 Verify generated code compiles with `go build ./...`

- [ ] Task 4: Verification
  - [ ] 4.1 Run `go build ./...` to ensure no compilation errors
  - [ ] 4.2 Write simple test to verify table creation
  - [ ] 4.3 Document any schema changes in architecture docs

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Both migrations applied successfully via `./restart.sh`
- [ ] All constraints and indexes verified with psql
- [ ] SQLc code generated and compiling (`cd api && sqlc generate`)
- [ ] Go build passes with no errors (`cd api && go build ./...`)
- [ ] Verify existing `zman_registry_requests` table structure before ALTER
- [ ] Changes documented in architecture docs
- [ ] Services restarted with `./restart.sh` and verified working

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `db/migrations/00000000000023_publisher_zman_aliases.sql` | Create | Aliases table |
| `db/migrations/00000000000024_enhance_zman_registry_requests.sql` | Create | Enhanced requests + tags |
| `api/internal/db/queries/aliases.sql` | Create | Alias CRUD queries |
| `api/internal/db/queries/zman_requests.sql` | Create | Request queries |

---

## Notes

- The `publisher_zman_aliases` table allows publishers to override display names while preserving canonical master registry references
- The `zman_request_tags` table supports both existing tag references AND new tag requests in the same workflow
- The CHECK constraint ensures data integrity: either linking to existing tag OR requesting new tag, never both/neither
