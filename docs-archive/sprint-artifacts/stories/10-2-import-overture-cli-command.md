# Story 10.2: import-overture CLI Command

**Story ID:** 10.2
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 13
**Priority:** HIGH - Core data import functionality
**Risk:** High (external data source, large dataset)

---

## User Story

**As a** developer
**I want** a CLI command to import Overture Maps geographic data
**So that** we can populate the new geo_localities schema with high-quality data

---

## Background

Overture Maps Foundation provides high-quality geographic data in Parquet format on AWS S3. We need a CLI tool to:
- Download Parquet files from S3
- Parse and transform data to our schema
- Import in batches with progress reporting
- Handle multi-language names
- Refresh materialized views after import

---

## Acceptance Criteria

### AC1: CLI Command Structure
- [ ] Command located at `api/cmd/import-overture/`
- [ ] Uses cobra for CLI framework (consistent with other commands)
- [ ] Supports subcommands: `download`, `import`, `refresh`, `status`, `reset`
- [ ] `--help` shows usage for all subcommands

**Verification:**
```bash
cd api && go build -o import-overture ./cmd/import-overture
./import-overture --help
# Expected: Shows subcommands

./import-overture download --help
./import-overture import --help
./import-overture refresh --help
./import-overture status --help
./import-overture reset --help
# Expected: Each shows specific help
```

### AC2: Download Subcommand
- [ ] Downloads Overture Parquet files from S3
- [ ] Supports `--release` flag for specific release (default: latest)
- [ ] Downloads to configurable local directory (default: `./data/overture/`)
- [ ] Shows download progress
- [ ] Skips already-downloaded files (unless `--force`)

**Verification:**
```bash
./import-overture download --release 2025-01 --output ./data/overture/
# Expected: Downloads files, shows progress
# Expected: Files appear in ./data/overture/
```

### AC3: Import Subcommand - Continents
- [ ] Imports continents from Overture divisions
- [ ] Maps to existing `geo_continents` table
- [ ] Updates boundaries if different
- [ ] Reports count: "Imported X continents"

**Verification:**
```sql
SELECT COUNT(*) FROM geo_continents;
-- Expected: 7 continents

SELECT name, ST_Area(boundary::geometry) > 0 as has_boundary FROM geo_continents;
-- Expected: All have boundaries
```

### AC4: Import Subcommand - Countries
- [ ] Imports countries from Overture divisions
- [ ] Maps to `geo_countries` with `continent_id` FK
- [ ] Updates boundaries
- [ ] Imports all language names to `geo_names`
- [ ] Reports count: "Imported X countries"

**Verification:**
```sql
SELECT COUNT(*) FROM geo_countries WHERE overture_id IS NOT NULL;
-- Expected: ~200 countries

SELECT COUNT(*) FROM geo_names WHERE entity_type = 'country';
-- Expected: Multiple names per country (different languages)
```

### AC5: Import Subcommand - Regions
- [ ] Imports regions with hierarchy (region → county → localadmin)
- [ ] Sets `parent_region_id` for sub-regions
- [ ] Sets `region_type_id` from lookup table
- [ ] Imports boundaries
- [ ] Imports all language names
- [ ] Reports counts by type: "Imported X regions, Y counties, Z localadmins"

**Verification:**
```sql
SELECT rt.code, COUNT(*)
FROM geo_regions r
JOIN geo_region_types rt ON r.region_type_id = rt.id
GROUP BY rt.code;
-- Expected: Multiple types with counts

SELECT COUNT(*) FROM geo_regions WHERE parent_region_id IS NOT NULL;
-- Expected: Sub-regions have parents
```

### AC6: Import Subcommand - Localities
- [ ] Imports localities (city, town, village, hamlet)
- [ ] Sets `locality_type_id` from lookup table
- [ ] Sets `region_id` to lowest-level containing region
- [ ] Sets `parent_locality_id` for neighborhoods/boroughs
- [ ] Imports population, coordinates, timezone
- [ ] Imports all language names
- [ ] Uses batch inserts (10,000 per batch)
- [ ] Reports progress every 100,000 records
- [ ] Reports final count: "Imported X localities"

**Verification:**
```sql
SELECT lt.code, COUNT(*)
FROM geo_localities l
JOIN geo_locality_types lt ON l.locality_type_id = lt.id
GROUP BY lt.code;
-- Expected: city, town, village, hamlet, neighborhood counts

SELECT COUNT(*) FROM geo_localities;
-- Expected: 500,000+ localities
```

### AC7: Import Subcommand - Names
- [ ] Imports names in all languages to `geo_names`
- [ ] Normalizes language codes (BCP 47 → simple: `en-US` → `en`)
- [ ] Stores entity_type, entity_id, language_code, name, name_type
- [ ] Handles duplicates gracefully (upsert)

**Verification:**
```sql
SELECT language_code, COUNT(*)
FROM geo_names
GROUP BY language_code
ORDER BY COUNT(*) DESC
LIMIT 10;
-- Expected: Multiple languages (en, he, ar, ru, etc.)

SELECT * FROM geo_names WHERE entity_type = 'locality' AND entity_id =
  (SELECT id FROM geo_localities WHERE name = 'Jerusalem' LIMIT 1);
-- Expected: Names in multiple languages
```

### AC8: Import Subcommand - Performance
- [ ] Disables indexes before bulk insert
- [ ] Re-enables indexes after bulk insert
- [ ] Uses COPY for bulk inserts where possible
- [ ] Total import time <60 minutes for full dataset

**Verification:**
```bash
time ./import-overture import
# Expected: <60 minutes
# Expected: Progress reports every 100k records
```

### AC9: Refresh Subcommand
- [ ] Refreshes `geo_hierarchy_populations` materialized view
- [ ] Truncates and repopulates `geo_search_index`
- [ ] Reports row counts after refresh
- [ ] Can be run independently of import

**Verification:**
```bash
./import-overture refresh
# Expected: "Refreshed geo_hierarchy_populations: X rows"
# Expected: "Refreshed geo_search_index: Y rows"

SELECT COUNT(*) FROM geo_hierarchy_populations;
-- Expected: >0 rows

SELECT COUNT(*) FROM geo_search_index;
-- Expected: ~500k+ rows
```

### AC10: Status Subcommand
- [ ] Shows import statistics: continent/country/region/locality counts
- [ ] Shows last import timestamp
- [ ] Shows index status (enabled/disabled)
- [ ] Shows materialized view freshness

**Verification:**
```bash
./import-overture status
# Expected: Table with counts
# Expected: Shows timestamps
```

### AC11: Reset Subcommand
- [ ] Requires `--confirm` flag (dangerous operation)
- [ ] Truncates all geo tables (localities, regions, names)
- [ ] Does NOT drop tables (schema preserved)
- [ ] Reports what was reset

**Verification:**
```bash
./import-overture reset
# Expected: Error "requires --confirm flag"

./import-overture reset --confirm
# Expected: "Reset complete. Tables truncated: geo_localities, geo_regions, ..."
```

### AC12: Error Handling
- [ ] Graceful handling of network errors during download
- [ ] Graceful handling of malformed Parquet records
- [ ] Logs errors to `geo_import_errors` table
- [ ] Continues import on individual record failures
- [ ] Reports error summary at end

**Verification:**
```sql
SELECT COUNT(*) FROM geo_import_errors;
-- Expected: Some errors logged (malformed data)

SELECT error_type, COUNT(*) FROM geo_import_errors GROUP BY error_type;
-- Expected: Categorized errors
```

### AC13: Pure Go Implementation
- [ ] Uses `github.com/parquet-go/parquet-go` for Parquet reading
- [ ] No CGO dependencies (no DuckDB)
- [ ] Builds on all platforms without special setup

**Verification:**
```bash
CGO_ENABLED=0 go build -o import-overture ./cmd/import-overture
# Expected: Builds successfully without CGO
```

---

## Technical Implementation

### File Structure
```
api/cmd/import-overture/
├── main.go           # Entry point, cobra setup
├── download.go       # S3 download logic
├── import.go         # Main orchestration
├── continents.go     # Continent import
├── countries.go      # Country import
├── regions.go        # Region hierarchy import
├── localities.go     # Locality import
├── names.go          # Multi-language name import
├── parquet.go        # Parquet reader wrapper
├── refresh.go        # Materialized view refresh
└── status.go         # Status reporting
```

### Data Source
```
s3://overturemaps-us-west-2/release/2025-*/theme=divisions/type=division/*
```

### Batch Insert Pattern
```go
const batchSize = 10000

func importLocalities(ctx context.Context, db *pgxpool.Pool, records []OvertureLocality) error {
    for i := 0; i < len(records); i += batchSize {
        end := min(i+batchSize, len(records))
        batch := records[i:end]

        if err := insertLocalityBatch(ctx, db, batch); err != nil {
            return fmt.Errorf("batch %d-%d: %w", i, end, err)
        }

        if (i+batchSize) % 100000 == 0 {
            slog.Info("import progress", "processed", i+batchSize)
        }
    }
    return nil
}
```

### Language Code Normalization
```go
var langCodeMap = map[string]string{
    "en-US": "en", "en-GB": "en", "en-AU": "en",
    "he-IL": "he",
    "ar-SA": "ar", "ar-EG": "ar",
    "ru-RU": "ru",
    // ... etc
}

func normalizeLanguageCode(bcp47 string) string {
    if simple, ok := langCodeMap[bcp47]; ok {
        return simple
    }
    // Default: take first 2 chars
    if len(bcp47) >= 2 {
        return bcp47[:2]
    }
    return bcp47
}
```

---

## Definition of Done

### Code Complete
- [ ] All 11 source files created in `api/cmd/import-overture/`
- [ ] All 5 subcommands implemented and working
- [ ] Batch processing with progress reporting
- [ ] Error handling with logging to database
- [ ] Pure Go (no CGO)

### Tests Pass
- [ ] `cd api && go build ./cmd/import-overture` succeeds
- [ ] `CGO_ENABLED=0 go build ./cmd/import-overture` succeeds
- [ ] Unit tests for parsing logic pass
- [ ] Integration test with sample data passes

### Data Imported
- [ ] 7 continents imported
- [ ] ~200 countries imported with boundaries
- [ ] Regions imported with hierarchy
- [ ] 500,000+ localities imported
- [ ] Multi-language names imported
- [ ] Materialized views refreshed

### Performance
- [ ] Full import completes in <60 minutes
- [ ] Progress reported every 100k records
- [ ] No memory leaks (checked with pprof)

### Documentation
- [ ] `--help` complete for all subcommands
- [ ] README in `api/cmd/import-overture/README.md`
- [ ] Usage examples documented

### Commit Requirements
- [ ] Commit message: `feat(import-overture): add Overture geographic data importer`
- [ ] Push to remote after commit

---

## Out of Scope

- Incremental updates (full reimport only for now)
- Differential sync with Overture releases
- Custom data transformations beyond schema mapping

---

## Dependencies

- Story 10.1 (Database Schema Migration) - MUST be complete

## Blocks

- Story 10.3 (Search Index - needs data)
- Story 10.4 (Backend Code - needs data for testing)

---

## Estimated Effort

| Task | Hours |
|------|-------|
| CLI framework setup | 2 |
| Download implementation | 3 |
| Parquet reader integration | 4 |
| Continent/country import | 2 |
| Region hierarchy import | 4 |
| Locality import | 4 |
| Names import | 3 |
| Refresh implementation | 2 |
| Status/reset commands | 1 |
| Error handling | 2 |
| Testing | 4 |
| Documentation | 1 |
| **Total** | **32** |

---

## Notes

- Overture releases monthly; pin to specific release for reproducibility
- First import will take longest; subsequent imports faster with cached files
- Consider running on EC2 instance close to S3 for faster downloads
