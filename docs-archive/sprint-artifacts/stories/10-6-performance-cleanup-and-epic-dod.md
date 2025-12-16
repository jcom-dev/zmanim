# Story 10.6: Performance Optimization, Cleanup & Epic DoD Validation

**Story ID:** 10.6
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 8
**Priority:** CRITICAL - Epic completion gate
**Risk:** Low

---

## User Story

**As a** product owner
**I want** the Epic 10 deliverables fully validated against DoD and coding standards
**So that** we ship a clean, performant, well-documented product with no technical debt

---

## Background

This is the **FINAL STORY** in Epic 10. It ensures:
1. Performance targets are met
2. Old/deprecated code is deleted
3. All coding standards are enforced
4. Documentation is complete
5. No orphan code or TODO markers remain

**This story blocks epic completion.**

---

## Acceptance Criteria

### SECTION 1: PERFORMANCE VALIDATION

#### AC1.1: Search Query Performance
- [ ] Exact keyword search: <5ms (average)
- [ ] Fuzzy search: <30ms (average)
- [ ] Search with country filter: <5ms
- [ ] Benchmarks documented

**Verification:**
```sql
-- Enable timing
\timing on

-- Exact search benchmark (run 10x, average)
SELECT * FROM geo_search_index WHERE keywords @> ARRAY['london'] ORDER BY population DESC NULLS LAST LIMIT 20;
-- Expected: <5ms average

-- Fuzzy search benchmark
SELECT * FROM geo_search_index WHERE display_name % 'londn' ORDER BY similarity(display_name, 'londn') DESC LIMIT 20;
-- Expected: <30ms average

-- Filtered search benchmark
SELECT * FROM geo_search_index WHERE country_id = 234 AND keywords @> ARRAY['manchester'] LIMIT 20;
-- Expected: <5ms average
```

#### AC1.2: Search Index Refresh Performance
- [ ] `SELECT refresh_geo_search_index()` completes in <5 minutes
- [ ] Progress logged during refresh

**Verification:**
```sql
\timing on
SELECT refresh_geo_search_index();
-- Expected: <5 minutes for 500k+ localities
```

#### AC1.3: API Response Times
- [ ] `/cities/search?q=jerusalem` response: <100ms total
- [ ] `/cities/{id}` response: <50ms total
- [ ] No endpoints with >500ms response time

**Verification:**
```bash
# API benchmark
time curl -s "http://localhost:8080/api/v1/cities/search?q=jerusalem" > /dev/null
# Expected: real < 0.1s

time curl -s "http://localhost:8080/api/v1/cities/1234" > /dev/null
# Expected: real < 0.05s
```

#### AC1.4: Slow Query Logging Verified
- [ ] PostgreSQL slow query logging enabled (>100ms)
- [ ] No slow queries in log after full test run

**Verification:**
```sql
-- Check slow query setting
SHOW log_min_duration_statement;
-- Expected: 100 (or similar threshold)

-- Check for recent slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;
-- Expected: No application queries (system queries OK)
```

---

### SECTION 2: DATABASE CLEANUP

#### AC2.1: Old Tables Dropped
- [ ] `geo_cities` table DROPPED
- [ ] `geo_districts` table DROPPED
- [ ] `geo_city_boundaries` table DROPPED
- [ ] `geo_district_boundaries` table DROPPED

**Verification:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('geo_cities', 'geo_districts', 'geo_city_boundaries', 'geo_district_boundaries');
-- Expected: 0 rows (tables dropped)
```

#### AC2.2: Orphan Foreign Keys Cleaned
- [ ] No FKs referencing dropped tables
- [ ] `publisher_coverage.city_id` dropped (replaced by locality_id)
- [ ] `publisher_coverage.district_id` dropped

**Verification:**
```sql
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('geo_cities', 'geo_districts');
-- Expected: 0 rows
```

#### AC2.3: Auxiliary Tables Renamed
- [ ] `geo_city_coordinates` renamed to `geo_locality_coordinates`
- [ ] `geo_city_elevations` renamed to `geo_locality_elevations`

**Verification:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('geo_locality_coordinates', 'geo_locality_elevations');
-- Expected: 2 rows

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('geo_city_coordinates', 'geo_city_elevations');
-- Expected: 0 rows
```

---

### SECTION 3: BACKEND CLEANUP

#### AC3.1: No References to Old Tables
- [ ] No `geo_cities` in any .go file
- [ ] No `geo_districts` in any .go file
- [ ] No `city_id` in coverage queries (use locality_id)

**Verification:**
```bash
grep -r "geo_cities\|geo_districts" api/internal --include="*.go"
# Expected: No matches

grep -r "city_id" api/internal/db/queries/coverage.sql
# Expected: No matches (or only in comments explaining migration)
```

#### AC3.2: No TODO/FIXME/DEPRECATED Markers
- [ ] Zero TODO markers in api/internal/
- [ ] Zero FIXME markers in api/internal/
- [ ] Zero DEPRECATED markers in api/internal/
- [ ] Zero "Legacy" comments in api/internal/

**Verification:**
```bash
grep -rn "TODO\|FIXME\|DEPRECATED\|Legacy" api/internal --include="*.go" | grep -v "_test.go"
# Expected: No matches
```

#### AC3.3: No log.Printf/fmt.Printf
- [ ] Zero `log.Printf` in production code
- [ ] Zero `fmt.Printf` in production code
- [ ] All logging uses `slog`

**Verification:**
```bash
grep -rn "log\.Printf\|fmt\.Printf" api/internal --include="*.go" | grep -v "_test.go"
# Expected: No matches
```

#### AC3.4: No Raw SQL in Handlers
- [ ] All queries via SQLc
- [ ] No string concatenation for SQL
- [ ] No `db.Exec` or `db.Query` with string SQL

**Verification:**
```bash
grep -rn "\.Exec\|\.Query\|\.QueryRow" api/internal/handlers --include="*.go" | grep -v "Queries\."
# Expected: No matches (only SQLc Queries.* calls)
```

#### AC3.5: Build and Tests Pass
- [ ] `cd api && go build ./...` succeeds
- [ ] `cd api && go test ./...` passes
- [ ] `cd api && go vet ./...` clean
- [ ] `cd api && golangci-lint run ./...` passes

**Verification:**
```bash
cd api
go build ./...
go test ./...
go vet ./...
golangci-lint run ./...
# Expected: All pass with no errors
```

---

### SECTION 4: FRONTEND CLEANUP

#### AC4.1: Old Components Deleted
- [ ] `LocationSearch.tsx` - FILE DOES NOT EXIST
- [ ] `CoverageSearchPanel.tsx` - FILE DOES NOT EXIST
- [ ] `CitySelector.tsx` - FILE DOES NOT EXIST

**Verification:**
```bash
ls -la web/components/shared/LocationSearch.tsx 2>&1
ls -la web/components/shared/CoverageSearchPanel.tsx 2>&1
ls -la web/components/publisher/CitySelector.tsx 2>&1
# Expected: All "No such file or directory"
```

#### AC4.2: No Orphan Imports
- [ ] No imports of deleted components
- [ ] No unused imports in new components

**Verification:**
```bash
grep -rn "from.*LocationSearch\|from.*CoverageSearchPanel\|from.*CitySelector" web/ --include="*.tsx" --include="*.ts"
# Expected: No matches
```

#### AC4.3: No Raw fetch() Calls
- [ ] Zero `await fetch(` in components
- [ ] All API calls use `useApi()` hook

**Verification:**
```bash
grep -rn "await fetch\(" web/app web/components --include="*.tsx" --include="*.ts" | grep -v "api-client.ts"
# Expected: No matches
```

#### AC4.4: No Hardcoded Colors
- [ ] Zero hex colors (#XXXXXX) in components
- [ ] Zero rgb/rgba colors in components
- [ ] All colors use design tokens

**Verification:**
```bash
grep -rn "#[0-9a-fA-F]\{3,6\}\|rgb(\|rgba(" web/app web/components web/lib --include="*.tsx" --include="*.ts" | grep -v "node_modules\|.next"
# Expected: No matches (or only in documented exceptions)
```

#### AC4.5: No TODO/FIXME/DEPRECATED
- [ ] Zero TODO markers in web/
- [ ] Zero FIXME markers in web/
- [ ] Zero DEPRECATED markers in web/

**Verification:**
```bash
grep -rn "TODO\|FIXME\|DEPRECATED" web/app web/components web/lib --include="*.tsx" --include="*.ts"
# Expected: No matches
```

#### AC4.6: Build and Type Check Pass
- [ ] `cd web && npm run type-check` passes
- [ ] `cd web && npm run build` passes
- [ ] `cd web && npm run lint` passes

**Verification:**
```bash
cd web
npm run type-check
npm run build
npm run lint
# Expected: All pass with no errors or warnings
```

---

### SECTION 5: E2E TESTING

#### AC5.1: Location Search E2E Tests Pass
- [ ] Search by English name works
- [ ] Search by Hebrew name works
- [ ] Search shows hierarchy display
- [ ] Single-select works
- [ ] Multi-select works

**Verification:**
```bash
cd tests && npx playwright test locality-search --reporter=list
# Expected: All tests pass
```

#### AC5.2: Coverage Management E2E Tests Pass
- [ ] Add locality to coverage works
- [ ] Remove locality from coverage works
- [ ] Type filter works
- [ ] Quick select works

**Verification:**
```bash
cd tests && npx playwright test coverage --reporter=list
# Expected: All tests pass
```

#### AC5.3: Full E2E Regression
- [ ] All E2E tests in suite pass
- [ ] No flaky tests
- [ ] Test run completes in <10 minutes

**Verification:**
```bash
cd tests && npx playwright test --reporter=list
# Expected: All pass, <10 minutes
```

---

### SECTION 6: DOCUMENTATION

#### AC6.1: Migration File Documented
- [ ] `db/migrations/00000000000003_overture_schema.sql` has header comment
- [ ] Each major section has comment explaining purpose
- [ ] Rollback notes included (if applicable)

**Verification:**
```bash
head -50 db/migrations/00000000000003_overture_schema.sql
# Expected: Header comments present
```

#### AC6.2: import-overture CLI Documented
- [ ] README.md exists in `api/cmd/import-overture/`
- [ ] `--help` shows usage for all subcommands
- [ ] Examples included

**Verification:**
```bash
cat api/cmd/import-overture/README.md
./import-overture --help
# Expected: Documentation present
```

#### AC6.3: Performance Benchmarks Documented
- [ ] Document created: `docs/architecture/geo-search-performance.md`
- [ ] Contains benchmark results
- [ ] Contains EXPLAIN ANALYZE examples
- [ ] Contains index strategy explanation

**Verification:**
```bash
ls -la docs/architecture/geo-search-performance.md
# Expected: File exists with benchmarks
```

#### AC6.4: API Documentation Updated
- [ ] Swagger/OpenAPI updated for new endpoints
- [ ] Response schemas updated for locality fields

**Verification:**
```bash
./restart.sh
curl http://localhost:8080/swagger/doc.json | jq '.paths | keys | map(select(contains("localities") or contains("cities")))'
# Expected: Endpoints documented
```

---

### SECTION 7: CI/CD VALIDATION

#### AC7.1: SQLc Generation in CI
- [ ] `./scripts/validate-ci-checks.sh` passes
- [ ] SQLc generated code is committed and in sync

**Verification:**
```bash
./scripts/validate-ci-checks.sh
# Expected: Pass

cd api && sqlc generate && git diff --exit-code internal/db/sqlcgen/
# Expected: No changes (code in sync)
```

#### AC7.2: Type Sync Validation
- [ ] `./scripts/verify-type-sync.sh` passes
- [ ] Frontend types match backend response

**Verification:**
```bash
./scripts/verify-type-sync.sh
# Expected: Pass
```

---

### SECTION 8: FINAL EPIC DoD CHECKLIST

#### AC8.1: All Prior Stories Complete
- [ ] Story 10.1: Database Schema Migration - DONE
- [ ] Story 10.2: import-overture CLI - DONE
- [ ] Story 10.3: Search Index Implementation - DONE
- [ ] Story 10.4: Backend Code Updates - DONE
- [ ] Story 10.5: Frontend LocalityPicker - DONE

#### AC8.2: Epic Metrics Met
- [ ] Locality count: 500k+ (target met)
- [ ] Search latency: <50ms keyword, <100ms fuzzy (target met)
- [ ] Languages: 10+ supported (target met)
- [ ] UI components: 1 unified (3→1 reduction)
- [ ] Hierarchy depth: 4+ levels

**Verification:**
```sql
SELECT COUNT(*) FROM geo_localities;
-- Expected: >500,000

SELECT COUNT(DISTINCT language_code) FROM geo_names;
-- Expected: >10
```

#### AC8.3: No Technical Debt Created
- [ ] Zero new TODO markers
- [ ] Zero new FIXME markers
- [ ] Zero deprecated code
- [ ] Zero unused imports
- [ ] Zero dead code paths

#### AC8.4: Git History Clean
- [ ] Each story has dedicated commit
- [ ] Commit messages follow convention
- [ ] No "fix typo" or "oops" commits in final history

---

## Definition of Done

### Performance Validated
- [ ] All query benchmarks meet targets
- [ ] No slow queries in PostgreSQL log
- [ ] API response times verified

### Code Clean
- [ ] Old tables dropped
- [ ] Old components deleted
- [ ] No orphan code
- [ ] No TODO/FIXME/DEPRECATED

### Standards Compliant
- [ ] No raw fetch() (useApi only)
- [ ] No hardcoded colors (design tokens)
- [ ] No log.Printf (slog only)
- [ ] No raw SQL (SQLc only)
- [ ] PublisherResolver pattern used

### Tests Pass
- [ ] Backend: build, test, vet, lint
- [ ] Frontend: type-check, build, lint
- [ ] E2E: full regression passes

### Documented
- [ ] Migration documented
- [ ] CLI documented
- [ ] Performance benchmarks documented
- [ ] API documentation updated

### Commit Requirements
- [ ] Final commit message: `chore(epic-10): complete performance validation and cleanup`
- [ ] Push to remote
- [ ] PR created (if applicable)

---

## Technical Implementation

### Drop Old Tables (Migration Addendum)

```sql
-- Add to migration or run manually after verification
DROP TABLE IF EXISTS geo_city_boundaries CASCADE;
DROP TABLE IF EXISTS geo_district_boundaries CASCADE;
DROP TABLE IF EXISTS geo_districts CASCADE;
DROP TABLE IF EXISTS geo_cities CASCADE;

-- Drop old columns from publisher_coverage
ALTER TABLE publisher_coverage DROP COLUMN IF EXISTS city_id;
ALTER TABLE publisher_coverage DROP COLUMN IF EXISTS district_id;

-- Rename auxiliary tables
ALTER TABLE IF EXISTS geo_city_coordinates RENAME TO geo_locality_coordinates;
ALTER TABLE IF EXISTS geo_city_elevations RENAME TO geo_locality_elevations;
```

### Performance Documentation Template

```markdown
# Geographic Search Performance Benchmarks

## Test Environment
- PostgreSQL: 17.x
- Dataset: 500k+ localities
- Hardware: [specify]

## Query Benchmarks

| Query Type | Average | P99 | Index Used |
|------------|---------|-----|------------|
| Exact keyword (1 term) | Xms | Xms | idx_geo_search_keywords |
| Exact keyword (3 terms) | Xms | Xms | idx_geo_search_keywords |
| Fuzzy search | Xms | Xms | idx_geo_search_trgm |
| Filtered by country | Xms | Xms | Composite |

## EXPLAIN ANALYZE Results

[Include representative query plans]

## Index Strategy

[Explain GIN vs B-tree decisions]
```

---

## Out of Scope

- New features
- Further optimization beyond targets
- Renaming API endpoints

---

## Dependencies

- Stories 10.1-10.5 MUST be complete

## Blocks

- Epic completion
- Next epic planning

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Performance benchmarking | 2 |
| Database cleanup | 1 |
| Backend cleanup verification | 2 |
| Frontend cleanup verification | 2 |
| E2E test run | 1 |
| Documentation | 2 |
| Final validation | 2 |
| **Total** | **12** |

---

## Notes

- This is a GATING story - epic cannot close without all ACs met
- Be thorough - technical debt compounds exponentially
- Document everything for future reference
- Celebrate completion - this is a major milestone!
