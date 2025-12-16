# Duplicate Localities Analysis Report

**Generated:** 2025-12-17
**Database:** Overture Geographic Data

## Executive Summary

The database contains **981,323 duplicate pairs** across **432,122 localities** (9.6% of 4.5M total localities). These duplicates exist because Overture Maps aggregates data from multiple sources (OpenStreetMap, government datasets, commercial providers) that may have overlapping coverage.

## Scale of Duplicates

| Metric | Value |
|--------|-------|
| Total localities in database | 4,515,340 |
| Total search index entries | 4,579,458 |
| Localities with population data | 667,951 (14.8%) |
| **Duplicate pairs (<10km apart, same name/country)** | **981,323** |
| **Localities involved in duplicates** | **432,122** |
| Countries affected | 230 |

## Top Countries by Duplicate Count

| Country | Duplicate Pairs | Unique Names Affected |
|---------|-----------------|----------------------|
| Indonesia 🇮🇩 | 610,970 | 4,253 |
| India 🇮🇳 | 32,412 | 20,195 |
| China 🇨🇳 | 32,412 | 14,113 |
| Chad 🇹🇩 | 29,925 | 571 |
| France 🇫🇷 | 21,767 | 8,649 |
| Spain 🇪🇸 | 20,999 | 5,293 |
| Jordan 🇯🇴 | 16,790 | 62 |
| Japan 🇯🇵 | 15,091 | 3,598 |
| Egypt 🇪🇬 | 14,477 | 307 |
| Poland 🇵🇱 | 13,855 | 3,643 |

**Note:** Indonesia's high count (610k pairs) is likely due to many neighborhoods with identical names.

## Duplicate Type Breakdown

Most duplicates are between these locality type pairs:

| Type Pair | Count | Avg Distance | Has Population |
|-----------|-------|--------------|----------------|
| neighborhood ↔ neighborhood | 677,063 | 5.2km | 1,593 |
| hamlet ↔ hamlet | 117,904 | 5.3km | 21,978 |
| village ↔ village | 37,357 | 4.1km | 3,473 |
| neighborhood ↔ village | 34,748 | 1.0km | 9,264 |
| hamlet ↔ neighborhood | 22,419 | 2.4km | 6,300 |
| city ↔ village | 17,019 | 1.6km | 14,947 |
| city ↔ city | 5,998 | 4.2km | 2,535 |

## Distance Distribution

| Distance Range | Count | Percentage | Interpretation |
|----------------|-------|------------|----------------|
| < 100m | 32,588 | 3.3% | **Likely exact duplicates** |
| 100m - 500m | 55,605 | 5.7% | Very close, probably same place |
| 500m - 1km | 61,864 | 6.3% | Close, overlapping boundaries |
| 1km - 2km | 98,431 | 10.0% | Adjacent areas, may be distinct |
| 2km - 5km | 258,685 | 26.4% | Possibly distinct neighborhoods |
| 5km - 10km | 474,150 | 48.3% | Likely different places |

**Key Insight:** ~88,000 pairs (9%) are within 500m - these are almost certainly data quality issues.

## UK-Specific Analysis (User's Salford Issue)

| Metric | Value |
|--------|-------|
| UK duplicate pairs | 1,317 |
| UK pairs with population | 216 |
| UK city↔city duplicates | 362 |

### Examples of UK City Duplicates

| City | Pop 1 | Pop 2 | Distance |
|------|-------|-------|----------|
| Birmingham | - | 1,036,878 | 3.8km |
| Newcastle upon Tyne | 809,000 | - | 6.2km |
| Leeds | - | 766,399 | 3.8km |
| Sheffield | 547,000 | - | 4.6km |
| Manchester | 503,100 | - | 4.2km |
| Liverpool | - | 434,900 | 3.6km |
| Belfast | - | 348,000 | 0.3km |
| **Salford** | **-** | **258,834** | **6.6km** |

## Deduplication Strategy Options

### Strategy A: Remove No-Population When Populated Exists
- **Localities to remove:** 35,551
- **Approach:** If two duplicates exist and only one has population, remove the one without
- **Risk:** Low - population data indicates more authoritative source
- **Recommended for:** Database cleanup

### Strategy B: Same-Type Pairs - Keep Higher Population
- **Localities to remove:** 402,699
- **Approach:** For same locality_type duplicates within 5km, keep higher population
- **Risk:** Medium - may remove legitimate distinct places
- **Recommended for:** Aggressive cleanup (not recommended)

### Strategy C: Search-Time Deduplication
- **Entries hidden:** 174,956
- **Approach:** Use `DISTINCT ON (display_name, country_code, ROUND(lat, 1), ROUND(lon, 1))`
- **Risk:** Low - doesn't delete data, just hides in search
- **Recommended for:** **Quick fix for user experience**

## Recommended Actions

### Immediate (Search UX Fix)
Add deduplication to the `SearchLocalities` query:
1. Use `DISTINCT ON (display_name, country_code)` or similar
2. Prefer entries with population over those without
3. Prefer city > town > village > neighborhood in ranking

### Short-Term (Data Quality)
1. Create a `locality_duplicates` table to track known duplicate pairs
2. Add a `canonical_locality_id` field for redirect/merge logic
3. Run Strategy A cleanup on production data (35k safe removals)

### Long-Term (Import Pipeline)
1. Add deduplication during Overture import
2. Merge entries within 500m with same name/country
3. Prefer source with population data

## Selection Criteria When Duplicates Exist

When multiple entries exist for the same place, prefer:

1. **Has population** > No population
2. **Higher population** > Lower population
3. **City/Town type** > Village/Neighborhood type
4. **Has region_id** > No region_id
5. **Longer display_hierarchy** > Shorter (more specific)

## Query for Manual Investigation

```sql
-- Find duplicates for a specific place
SELECT l.id, l.name, lt.code as type, l.population,
       l.latitude, l.longitude, l.overture_id
FROM geo_localities l
LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
WHERE l.name = 'Salford'  -- Change this
  AND l.country_id = (SELECT id FROM geo_countries WHERE code = 'GB')
ORDER BY l.population DESC NULLS LAST;
```
