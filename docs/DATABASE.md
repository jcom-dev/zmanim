# Database

PostgreSQL database schema, patterns, and SQLc usage for Shtetl Zmanim.

---

## Overview

- **Database:** PostgreSQL 17 with PostGIS
- **Extensions:** `postgis`, `pg_trgm`, `unaccent`, `vector`
- **Query Layer:** SQLc (type-safe Go code generation)
- **Connection:** pgx driver

### Files

| Path | Purpose |
|------|---------|
| `db/migrations/00000000000001_schema.sql` | Full schema (~167 KB) |
| `db/migrations/00000000000002_seed_data.sql` | Seed data (~299 KB) |
| `api/sqlc.yaml` | SQLc configuration |
| `api/internal/db/queries/` | SQL query files (20 files) |
| `api/internal/db/queries/INDEX.md` | Query registry |
| `api/internal/db/sqlcgen/` | Generated Go code |

---

## Core Tables

### Publishers

```sql
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    slug varchar(100) NOT NULL UNIQUE,
    description text,
    status_id smallint NOT NULL REFERENCES publisher_statuses(id),
    is_global boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    deleted_by text
);
```

### Publisher Zmanim

```sql
CREATE TABLE publisher_zmanim (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL REFERENCES publishers(id),
    master_zman_id integer REFERENCES master_zmanim_registry(id),
    linked_publisher_zman_id integer REFERENCES publisher_zmanim(id),
    key varchar(100) NOT NULL,
    hebrew_name text NOT NULL,
    english_name text,
    description text,
    formula_dsl text NOT NULL,
    is_enabled boolean DEFAULT true,
    is_published boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    rounding_mode varchar(20) DEFAULT 'floor',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    deleted_by text,

    -- Every zman must link to registry OR another zman
    CONSTRAINT check_has_source CHECK (
        master_zman_id IS NOT NULL OR linked_publisher_zman_id IS NOT NULL
    )
);
```

### Master Zmanim Registry

Immutable reference catalog.

```sql
CREATE TABLE master_zmanim_registry (
    id SERIAL PRIMARY KEY,
    key varchar(100) NOT NULL UNIQUE,
    hebrew_name text NOT NULL,
    english_name text NOT NULL,
    description text,
    category varchar(50) NOT NULL,
    default_formula text,
    documentation text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
    -- No deleted_at - immutable
);
```

### Publisher Coverage

```sql
CREATE TABLE publisher_coverage (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL REFERENCES publishers(id),
    coverage_level_id smallint NOT NULL REFERENCES coverage_levels(id),
    coverage_id integer NOT NULL,  -- ID in the level's table
    boundary geometry(Geometry, 4326),  -- PostGIS
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);
```

### Users

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    clerk_id text NOT NULL UNIQUE,
    email text NOT NULL,
    first_name text,
    last_name text,
    is_admin boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);
```

### Publisher Users (Junction)

```sql
CREATE TABLE publisher_users (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL REFERENCES publishers(id),
    user_id integer NOT NULL REFERENCES users(id),
    role_id smallint NOT NULL REFERENCES publisher_roles(id),
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz,

    UNIQUE(publisher_id, user_id)
);
```

---

## Geographic Tables

### Cities (Localities)

~4 million rows of global city data.

```sql
CREATE TABLE cities (
    id integer PRIMARY KEY,  -- GeoNames ID
    name text NOT NULL,
    ascii_name text NOT NULL,
    alternate_names text,
    latitude numeric(10, 7) NOT NULL,
    longitude numeric(10, 7) NOT NULL,
    feature_class char(1),
    feature_code varchar(10),
    country_id integer REFERENCES geo_countries(id),
    region_id integer REFERENCES geo_regions(id),
    population bigint,
    elevation integer,
    timezone text NOT NULL,
    boundary geometry(Geometry, 4326),
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cities_geom ON cities USING GIST(boundary);
CREATE INDEX idx_cities_country ON cities(country_id);
CREATE INDEX idx_cities_population ON cities(population DESC);
```

### Geo Search Index

Full-text search for localities.

```sql
CREATE TABLE geo_search_index (
    id SERIAL PRIMARY KEY,
    locality_id integer NOT NULL REFERENCES cities(id),
    search_text text NOT NULL,
    search_vector tsvector,
    locale varchar(10) DEFAULT 'en'
);

CREATE INDEX idx_geo_search_vector ON geo_search_index USING GIN(search_vector);
```

### Regions

```sql
CREATE TABLE geo_regions (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    ascii_name text,
    country_id integer REFERENCES geo_countries(id),
    admin1_code varchar(20),
    boundary geometry(Geometry, 4326),
    created_at timestamptz DEFAULT now()
);
```

### Countries

```sql
CREATE TABLE geo_countries (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    iso_code char(2) NOT NULL UNIQUE,
    iso3_code char(3),
    continent varchar(20),
    boundary geometry(Geometry, 4326),
    created_at timestamptz DEFAULT now()
);
```

---

## Lookup Tables Pattern

All reference data follows this normalized pattern (21 tables):

```sql
CREATE TABLE {entity}_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Seed data (use key, not id)
INSERT INTO publisher_statuses (key, display_name_hebrew, display_name_english) VALUES
('pending', 'ממתין', 'Pending'),
('active', 'פעיל', 'Active'),
('suspended', 'מושעה', 'Suspended');
```

### Lookup Tables

| Table | Purpose |
|-------|---------|
| `publisher_statuses` | Publisher account states |
| `algorithm_statuses` | Algorithm version states |
| `request_statuses` | Correction request states |
| `publisher_roles` | Team member roles |
| `coverage_levels` | Geographic coverage granularity |
| `jewish_event_types` | Holiday/fast types |
| `fast_start_types` | Fast day start conditions |
| `calculation_types` | Zman calculation methods |
| `edge_types` | Polar region handling |
| `primitive_categories` | DSL primitive groups |
| `zman_source_types` | Zman origin types |
| `ai_content_sources` | AI documentation sources |
| `geo_levels` | Geographic hierarchy |
| `data_types` | Column type metadata |
| `explanation_sources` | Halachic source types |
| `day_types` | Day classifications |
| `event_categories` | Event groupings |
| `geo_data_sources` | Geographic data origins |
| `tag_types` | Tag categorization |
| `time_categories` | Zman time-of-day groups |
| `ai_index_statuses` | AI index build states |

---

## Audit Tables

### Actions (Audit Trail)

```sql
CREATE TABLE actions (
    id BIGSERIAL PRIMARY KEY,
    publisher_id integer REFERENCES publishers(id),
    user_id integer REFERENCES users(id),
    clerk_user_id text,
    action varchar(50) NOT NULL,  -- create, update, delete, restore
    entity_type varchar(50) NOT NULL,  -- publisher_zman, coverage, etc.
    entity_id integer,
    before_state jsonb,
    after_state jsonb,
    ip_address inet,
    user_agent text,
    request_id text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_actions_publisher ON actions(publisher_id, created_at DESC);
CREATE INDEX idx_actions_entity ON actions(entity_type, entity_id);
```

### Publisher Snapshots

```sql
CREATE TABLE publisher_snapshots (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL REFERENCES publishers(id),
    version integer NOT NULL,
    data jsonb NOT NULL,
    created_by integer REFERENCES users(id),
    created_at timestamptz DEFAULT now(),

    UNIQUE(publisher_id, version)
);
```

---

## Soft Delete Pattern

### Required Columns

```sql
ALTER TABLE {table} ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE {table} ADD COLUMN deleted_by text DEFAULT NULL;
```

### Required Index

```sql
-- CRITICAL for performance
CREATE INDEX idx_{table}_active ON {table}(id) WHERE deleted_at IS NULL;
```

### Query Patterns

```sql
-- ALWAYS filter deleted records
SELECT * FROM publishers WHERE deleted_at IS NULL;

-- Soft delete
UPDATE publishers
SET deleted_at = now(), deleted_by = $1
WHERE id = $2 AND deleted_at IS NULL;

-- Restore
UPDATE publishers
SET deleted_at = NULL, deleted_by = NULL, updated_at = now()
WHERE id = $1 AND deleted_at IS NOT NULL;
```

### SQLc Examples

```sql
-- name: GetActivePublisher :one
SELECT * FROM publishers
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListActivePublishers :many
SELECT * FROM publishers
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- name: SoftDeletePublisher :exec
UPDATE publishers
SET deleted_at = now(), deleted_by = $1
WHERE id = $2 AND deleted_at IS NULL;
```

---

## SQLc Usage

### Configuration

`api/sqlc.yaml`:

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "internal/db/queries"
    schema: "../db/migrations"
    gen:
      go:
        package: "sqlcgen"
        out: "internal/db/sqlcgen"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
```

### Workflow

1. Write SQL in `api/internal/db/queries/*.sql`
2. Run `cd api && sqlc generate`
3. Use generated code in handlers

### Query Annotations

```sql
-- name: GetPublisherZman :one
-- Returns a single row

-- name: ListPublisherZmanim :many
-- Returns multiple rows

-- name: CreatePublisherZman :one
-- INSERT with RETURNING

-- name: UpdatePublisherZman :exec
-- UPDATE without return

-- name: DeletePublisherZman :execrows
-- DELETE, returns affected row count
```

### Example Query File

`api/internal/db/queries/zmanim.sql`:

```sql
-- name: GetPublisherZman :one
SELECT * FROM publisher_zmanim
WHERE id = $1
  AND publisher_id = $2
  AND deleted_at IS NULL;

-- name: ListPublisherZmanim :many
SELECT * FROM publisher_zmanim
WHERE publisher_id = $1
  AND deleted_at IS NULL
ORDER BY sort_order, hebrew_name;

-- name: CreatePublisherZman :one
INSERT INTO publisher_zmanim (
    publisher_id,
    master_zman_id,
    key,
    hebrew_name,
    english_name,
    formula_dsl
) VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdatePublisherZman :one
UPDATE publisher_zmanim
SET hebrew_name = $1,
    english_name = $2,
    formula_dsl = $3,
    updated_at = now()
WHERE id = $4
  AND publisher_id = $5
  AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeletePublisherZman :exec
UPDATE publisher_zmanim
SET deleted_at = now(), deleted_by = $1
WHERE id = $2
  AND publisher_id = $3
  AND deleted_at IS NULL;
```

### Generated Go Code

```go
// Generated in sqlcgen/zmanim.sql.go

type GetPublisherZmanParams struct {
    ID          int32 `json:"id"`
    PublisherID int32 `json:"publisher_id"`
}

func (q *Queries) GetPublisherZman(ctx context.Context, arg GetPublisherZmanParams) (PublisherZman, error)

func (q *Queries) ListPublisherZmanim(ctx context.Context, publisherID int32) ([]PublisherZman, error)

func (q *Queries) CreatePublisherZman(ctx context.Context, arg CreatePublisherZmanParams) (PublisherZman, error)
```

### Handler Usage

```go
func (h *Handlers) GetPublisherZman(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    id, _ := strconv.Atoi(chi.URLParam(r, "id"))

    result, err := h.db.Queries.GetPublisherZman(ctx, sqlcgen.GetPublisherZmanParams{
        ID:          int32(id),
        PublisherID: pc.PublisherID,
    })
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            RespondNotFound(w, r)
            return
        }
        slog.Error("query failed", "error", err)
        RespondInternalError(w, r)
        return
    }

    RespondJSON(w, r, http.StatusOK, result)
}
```

---

## Query Files Reference

| File | Tables | Purpose |
|------|--------|---------|
| `zmanim.sql` | `publisher_zmanim` | Core zmanim CRUD |
| `master_registry.sql` | `master_zmanim_registry` | Registry queries |
| `publishers.sql` | `publishers`, `publisher_users` | Publisher management |
| `coverage.sql` | `publisher_coverage` | Geographic coverage |
| `algorithms.sql` | Algorithm versioning | Version history |
| `localities.sql` | `cities`, `geo_*` | Location services |
| `search.sql` | `geo_search_index` | Full-text search |
| `users.sql` | `users` | User management |
| `actions.sql` | `actions` | Audit trail |
| `admin.sql` | Various | Admin queries |
| `lookups.sql` | All lookup tables | Reference data |
| `snapshots.sql` | `publisher_snapshots` | Backup/restore |
| `correction_requests.sql` | Correction requests | Community feedback |
| `jewish_events.sql` | `jewish_events` | Calendar events |
| `tags.sql` | Tag tables | Tagging system |

---

## PostGIS Patterns

### Point in Polygon

Check if a locality is within coverage:

```sql
SELECT EXISTS (
    SELECT 1 FROM publisher_coverage pc
    JOIN cities c ON ST_Contains(pc.boundary, c.boundary)
    WHERE pc.publisher_id = $1
      AND c.id = $2
      AND pc.deleted_at IS NULL
);
```

### Find Nearby

```sql
SELECT id, name,
       ST_Distance(
           boundary::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       ) as distance_meters
FROM cities
WHERE ST_DWithin(
    boundary::geography,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    50000  -- 50km radius
)
ORDER BY distance_meters
LIMIT 10;
```

### Coverage Boundary

```sql
INSERT INTO publisher_coverage (publisher_id, coverage_level_id, coverage_id, boundary)
SELECT $1, $2, $3, boundary
FROM cities WHERE id = $3;
```

---

## Full-Text Search

### Search Query

```sql
-- name: SearchLocalities :many
SELECT
    c.id,
    c.name,
    c.ascii_name,
    r.name as region_name,
    gc.name as country_name,
    gc.iso_code,
    c.latitude,
    c.longitude,
    c.timezone,
    c.population,
    ts_rank(gsi.search_vector, query) as rank
FROM geo_search_index gsi
JOIN cities c ON gsi.locality_id = c.id
LEFT JOIN geo_regions r ON c.region_id = r.id
LEFT JOIN geo_countries gc ON c.country_id = gc.id,
     plainto_tsquery('english', $1) query
WHERE gsi.search_vector @@ query
ORDER BY rank DESC, c.population DESC NULLS LAST
LIMIT $2;
```

### Fuzzy Search (pg_trgm)

```sql
SELECT id, name, similarity(ascii_name, $1) as sim
FROM cities
WHERE ascii_name % $1  -- Trigram similarity
ORDER BY sim DESC
LIMIT 20;
```

---

## Migrations

### Creating Migrations

```bash
# Create new migration file
touch db/migrations/$(date +%Y%m%d%H%M%S)_description.sql
```

### Migration Format

```sql
-- Single-direction only (no DOWN)
-- Idempotent when possible

-- Add column
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS new_column text;

-- Add index
CREATE INDEX IF NOT EXISTS idx_publishers_new ON publishers(new_column);

-- Add foreign key
ALTER TABLE example
    ADD CONSTRAINT fk_example_publisher
    FOREIGN KEY (publisher_id) REFERENCES publishers(id);
```

### Running Migrations

```bash
./scripts/migrate.sh
```

---

## Indexing Strategy

### Soft Delete Indexes

```sql
-- All tables with soft delete MUST have this
CREATE INDEX idx_{table}_active ON {table}(id) WHERE deleted_at IS NULL;
```

### Foreign Key Indexes

```sql
-- Index all FK columns
CREATE INDEX idx_publisher_zmanim_publisher ON publisher_zmanim(publisher_id);
CREATE INDEX idx_publisher_users_user ON publisher_users(user_id);
```

### Query-Specific Indexes

```sql
-- Common filter combinations
CREATE INDEX idx_publisher_zmanim_active_published
ON publisher_zmanim(publisher_id, is_published)
WHERE deleted_at IS NULL AND is_enabled = true;

-- Sorting
CREATE INDEX idx_cities_population ON cities(population DESC NULLS LAST);
```

### PostGIS Indexes

```sql
CREATE INDEX idx_cities_geom ON cities USING GIST(boundary);
CREATE INDEX idx_coverage_geom ON publisher_coverage USING GIST(boundary);
```

---

## Connection Management

### Development

Direct connection via pgx:

```go
conn, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
```

### Production

Connection pooling via pgxpool:

```go
pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
```

### Connection String

```
postgresql://user:password@host:5432/zmanim?sslmode=require
```

---

## Common Queries

### Check Publisher Access

```sql
SELECT EXISTS (
    SELECT 1 FROM publisher_users pu
    JOIN users u ON pu.user_id = u.id
    WHERE pu.publisher_id = $1
      AND u.clerk_id = $2
      AND pu.deleted_at IS NULL
);
```

### Get Zmanim with Master Info

```sql
SELECT
    pz.*,
    mzr.category,
    mzr.default_formula,
    mzr.documentation
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mzr ON pz.master_zman_id = mzr.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NULL
ORDER BY mzr.category, pz.sort_order;
```

### Coverage Check

```sql
SELECT c.coverage_level_id, cl.key as level_name, COUNT(*) as count
FROM publisher_coverage c
JOIN coverage_levels cl ON c.coverage_level_id = cl.id
WHERE c.publisher_id = $1 AND c.deleted_at IS NULL
GROUP BY c.coverage_level_id, cl.key;
```

---

## Performance Tips

1. **Always use partial indexes** for soft delete
2. **Index all FK columns** even if PostgreSQL doesn't require it
3. **Use EXPLAIN ANALYZE** for slow queries
4. **Prefer JOIN over subqueries** for better optimization
5. **Use prepared statements** (SQLc does this automatically)
6. **Paginate large result sets** with LIMIT/OFFSET or keyset pagination
