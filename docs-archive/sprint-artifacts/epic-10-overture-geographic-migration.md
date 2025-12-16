# Epic 10: Overture Geographic Data Migration

**Epic:** Epic 10
**Status:** Contexted (Ready for Implementation)
**Created:** 2025-12-16
**Total Stories:** 6
**Total Story Points:** 55
**Priority:** HIGH - Foundation for all geographic features

---

## Executive Summary

Replace the current Who's On First (WOF) geographic data with Overture Maps Foundation data, implementing a flexible hierarchical schema that supports:

- **Flexible region hierarchy** (region → county → localadmin via `parent_region_id`)
- **Flexible locality hierarchy** (city → neighborhood via `parent_locality_id`)
- **Type lookups** for granularity preservation
- **Enhanced multi-language search** with ancestor names in ALL languages
- **Performance-optimized search index** with tiered ranking

This is a **clean slate migration** - no backward compatibility required since not in production.

---

## Business Value

### Problems Solved

1. **Data Quality:** WOF data is inconsistent and unmaintained; Overture provides high-quality, regularly updated geographic data
2. **Hierarchy Gaps:** Current schema lacks flexible hierarchy support (neighborhoods, boroughs, local admin areas)
3. **Search Limitations:** Current search doesn't support multi-language ancestor matching
4. **Code Duplication:** 3 separate location search components with duplicated logic
5. **Performance:** Current geo queries lack proper indexing strategy

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Locality count | ~163k cities | 500k+ localities (including neighborhoods) |
| Search latency | ~200ms | <50ms (keyword), <100ms (fuzzy) |
| Languages supported | 2 (English, transliterated) | 10+ (native scripts) |
| UI components | 3 duplicated | 1 unified LocalityPicker |
| Hierarchy depth | 2 levels | 4+ levels (continent→country→region→locality→neighborhood) |

---

## Scope

### In Scope

1. **Database Schema Migration** (Story 10.1)
   - Drop old tables: `geo_cities`, `geo_districts`, `geo_city_boundaries`, `geo_district_boundaries`
   - Create new tables: `geo_localities`, `geo_region_types`, `geo_locality_types`
   - Alter existing: `geo_regions` (add `parent_region_id`, `region_type_id`)
   - Create indexes and materialized views

2. **import-overture CLI Command** (Story 10.2)
   - Download Overture Parquet files from S3
   - Import continents, countries, regions, localities
   - Import boundaries (country, region only - NOT locality)
   - Import multi-language names
   - Refresh materialized views

3. **Search Index Implementation** (Story 10.3)
   - `geo_search_index` table with keyword arrays
   - `geo_hierarchy_populations` materialized view
   - Tiered search query (exact → fuzzy → population ranking)
   - GIN indexes for keyword and trigram search

4. **Code Updates** (Story 10.4)
   - SQLc queries: `cities.sql` → `localities.sql`
   - Handlers: `cities.go` → use `geo_localities`
   - Update `import-elevation`, `seed-geodata` commands
   - Update `publisher_coverage` references

5. **Frontend Unification** (Story 10.5)
   - Create `LocalityPicker` component (replaces 3 components)
   - Extract shared utilities to `locality-display.ts`
   - Create `useLocalitySearch` hook
   - Update home page, coverage management, algorithm preview

6. **Performance Optimization** (Story 10.6)
   - Enable slow query logging
   - Run EXPLAIN ANALYZE on search queries
   - Add missing indexes
   - Document performance benchmarks

### Out of Scope

- **API endpoint renaming** (deferred - Epic 9.1 will handle `/localities/*` if needed)
- **External API changes** (existing endpoints continue to work)
- **Backward compatibility** (clean slate - not in production)
- **Locality boundaries** (localities are point-only per decision)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API endpoints** | Keep `/cities/*` for now | Minimize disruption; can rename in Epic 9 |
| **Parquet access** | Pure Go parquet reader | No CGO/DuckDB dependency, simpler deployment |
| **Languages** | Simple codes only (`en`, `he`, `ar`) | Map complex BCP 47 during import |
| **Continents/Countries** | Fully replace from Overture | Not seeded - imported fresh |
| **Migration approach** | Clean slate | No backward compatibility needed (not in production) |
| **Locality boundaries** | Drop entirely | Localities are point-only; boundaries only for countries/regions |

---

## Technical Architecture

### New Schema Overview

```
geo_continents (imported from Overture)
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_countries (imported, mapped to continent)
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_regions (flexible hierarchy)
    ├── country_id FK
    ├── parent_region_id FK (nullable, self-reference)
    ├── region_type_id FK → geo_region_types
    ├── boundary (PostGIS)
    └── names in all languages
         │
         ▼
geo_localities (replaces geo_cities)
    ├── region_id FK (lowest-level region)
    ├── parent_locality_id FK (nullable, self-reference)
    ├── locality_type_id FK → geo_locality_types
    ├── lat, lng, population, elevation_m, timezone
    ├── NO boundary
    └── names in all languages
```

### Lookup Tables

**geo_region_types:** `region`, `county`, `localadmin`, `district`, `prefecture`, `state`, `province`

**geo_locality_types:** `city`, `town`, `village`, `hamlet`, `neighborhood`, `borough`

### Search Architecture

```
User Query: "ברוקלין" (Brooklyn in Hebrew)
         │
         ▼
┌─────────────────────────────────────────────┐
│  geo_search_index                           │
│  keywords: ['brooklyn', 'ברוקלין', ...]     │
│  display_hierarchy: "Brooklyn → NYC → NY"   │
│  population: 2,700,000                      │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Tiered Search                              │
│  1. Exact keyword match (GIN index)         │
│  2. Fuzzy trigram match (GIN trigram)       │
│  3. Rank by population within tier          │
└─────────────────────────────────────────────┘
         │
         ▼
Result: Brooklyn, NYC, New York, USA (pop: 2.7M)
```

---

## Stories Overview

| Story | Title | Points | Risk | Dependencies |
|-------|-------|--------|------|--------------|
| **10.1** | Database Schema Migration | 8 | Medium | None |
| **10.2** | import-overture CLI Command | 13 | High | 10.1 |
| **10.3** | Search Index Implementation | 8 | Medium | 10.1 |
| **10.4** | Backend Code Updates | 8 | Medium | 10.1, 10.3 |
| **10.5** | Frontend LocalityPicker Unification | 10 | Medium | 10.4 |
| **10.6** | Performance Optimization & DoD Validation | 8 | Low | 10.1-10.5 |
| **Total** | | **55** | | |

### Story Execution Order

```
10.1 (Schema Migration)
  │
  ├──> 10.2 (import-overture CLI)
  │         │
  │         └──> [Run import to populate data]
  │
  └──> 10.3 (Search Index)
              │
              └──> 10.4 (Backend Code Updates)
                        │
                        └──> 10.5 (Frontend Unification)
                                  │
                                  └──> 10.6 (Performance & DoD)
```

---

## Definition of Done (Epic Level)

### Functional Requirements

- [ ] All Overture data imported successfully (500k+ localities)
- [ ] Multi-language search works (Hebrew, Arabic, Russian, etc.)
- [ ] Hierarchy navigation works (country → region → locality → neighborhood)
- [ ] Publisher coverage can reference localities (not just cities)
- [ ] Home page location search uses unified LocalityPicker
- [ ] Algorithm preview uses unified LocalityPicker
- [ ] Coverage management uses unified LocalityPicker

### Performance Requirements

- [ ] Search query latency <50ms for keyword match
- [ ] Search query latency <100ms for fuzzy match
- [ ] Search index refresh <5min for 500k localities
- [ ] No slow queries in PostgreSQL logs (>100ms)

### Quality Requirements

- [ ] All SQLc queries compile without errors
- [ ] TypeScript type-check passes
- [ ] Go build passes
- [ ] E2E tests pass for location search
- [ ] Zero TODO/FIXME markers in new code
- [ ] Coding standards compliance (per docs/coding-standards.md)

### Documentation Requirements

- [ ] Migration documented in db/migrations/
- [ ] import-overture CLI documented with --help
- [ ] Search index refresh procedure documented
- [ ] Performance benchmarks documented

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Overture data format changes | LOW | MEDIUM | Pin to specific release version |
| Import performance issues | MEDIUM | MEDIUM | Batch inserts, disable indexes during import |
| Search performance degradation | LOW | HIGH | GIN indexes, EXPLAIN ANALYZE, early testing |
| Frontend breaking changes | MEDIUM | MEDIUM | Parallel component deployment, feature flags |
| Data quality issues | LOW | MEDIUM | Validation scripts, spot-check samples |

---

## References

- **Detailed Plan:** [docs/refactoring/import-from-overture.md](../refactoring/import-from-overture.md)
- **Overture Maps:** https://overturemaps.org/
- **Overture S3:** `s3://overturemaps-us-west-2/release/2025-*/theme=divisions/*`
- **Coding Standards:** [docs/coding-standards.md](../coding-standards.md)
- **Superseded Epic:** [Epic 9 - API Restructuring](epic-9-api-restructuring-and-cleanup.md)

---

_Created: 2025-12-16_
_Author: Business Analyst (Mary)_
_Status: Contexted_
