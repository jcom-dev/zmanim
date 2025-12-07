# SimpleMaps City & Country Creation Feature

## Summary

Modified the SimpleMaps import tool (`api/cmd/import-simplemaps/main.go`) to:
1. **Create missing countries** from SimpleMaps ISO2/ISO3 codes with automatic continent assignment
2. **Create new cities** when no matching WOF city is found, instead of skipping them

## Changes Made

### 1. Enhanced Statistics Tracking
- Added `citiesCreated` field to `importStats` struct
- Updated stats reporting to show number of cities created

### 2. Geographic Hierarchy Mapping
- Modified `loadCountryMappings()` to load `continent_id` for each country
- Added `countryToCont` map to track country → continent relationships
- Ensures new cities always map to:
  - ✅ **continent_id** (derived from country's continent)
  - ✅ **country_id** (required - from ISO2 code)
  - ✅ **region_id** (optional - via point-in-polygon matching)
  - ✅ **district_id** (optional - via point-in-polygon matching)

### 3. ISO2 → Continent Mapping

Added comprehensive `iso2ToContinent` map with all ~250 countries:
- **Source**: [lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes)
- **Coverage**: All ISO 3166-1 alpha-2 country codes
- **Continent Codes**: AF (Africa), AS (Asia), EU (Europe), NA (North America), SA (South America), OC (Oceania), AN (Antarctica)
- **Special Handling**:
  - Americas region split into NA/SA based on geographic location
  - Disputed territories (Kosovo, Gaza, West Bank) included
  - Taiwan mapped to Asia

### 4. New Database Functions

#### `createCountry()`
Creates a new `geo_countries` record when SimpleMaps encounters an unknown ISO2 code:
- Uses SimpleMaps data: ISO2, ISO3, country name
- Looks up continent via `iso2ToContinent` map
- Creates country with proper continent assignment
- Updates local cache (`countryCodeToID`, `countryToCont`)

#### `createCity()`
Creates a new `geo_cities` record with:
- Basic info: name, name_ascii, coordinates
- Geographic hierarchy: continent_id, country_id
- Metadata: timezone (UTC default), population, coordinate_source_id

#### `assignCityHierarchy()`
Assigns region_id and district_id via PostGIS point-in-polygon matching:
1. Finds region where city point intersects region boundary
2. If region found, finds district within that region
3. Updates the city record with hierarchy

#### `upsertCoordinateByID()`
Refactored from `upsertCoordinate()` to work with city IDs directly.

### 4. Updated Processing Logic

Modified `processCity()` to:
1. **Check if country exists** - If not, create it via `createCountry()`
2. Try to match against existing WOF cities (existing behavior)
3. If no match found:
   - Create new city record via `createCity()`
   - Assign geographic hierarchy via `assignCityHierarchy()`
   - Add coordinate data
   - Log creation event

### 5. Dry-Run Support
- Dry-run mode now reports countries and cities that would be created
- Shows creation count without writing to database
- Country creation is skipped in dry-run mode

### 6. Updated Documentation
- Package documentation reflects city creation capability
- Usage help updated to explain new behavior
- Matching strategy now includes "create if no match"

## Behavior

### Before
- Missing countries caused cities to be **skipped** ("no_country" status)
- Unmatched SimpleMaps entries were **skipped** ("no_match" status)
- No new countries or cities created

### After
- **Missing countries are created automatically**:
  - Uses ISO2/ISO3 codes and country name from SimpleMaps
  - Continent assigned via `iso2ToContinent` lookup
  - Logged as "CREATE COUNTRY"
- **Unmatched cities trigger city creation**:
  - Continent (always - via ISO2 → continent mapping)
  - Country (always - created if missing, from ISO2 code)
  - Region (when point-in-polygon match found)
  - District (when point-in-polygon match found)
- Coordinate data added to `geo_city_coordinates`
- Logged as "CREATE" with city_id

## Example Log Output

```
CREATE COUNTRY Hypothetical Country (XX) -> country_id=250
CREATE Jerusalem (IL) -> city_id=123456 | lat=31.7683 lng=35.2137
MATCH Tel Aviv (IL) -> Tel Aviv-Yafo | dist=2.3km sim=0.85
CREATE Bnei Brak (IL) -> city_id=123457 | lat=32.0814 lng=34.8338
```

## Statistics Output

```
Results:
  Processed:      48000
  Matched:        35000 (72.9%)
    Inserted:     30000
    Updated:      5000
  Cities created: 13000

Not imported:
  No match:       0      (now creates instead of skipping)
  Rejected:       0
  No country:     0
```

## Database Impact

### Tables Modified
1. `geo_countries` - New records for missing countries from SimpleMaps ISO2 codes
2. `geo_cities` - New records for unmatched SimpleMaps entries
3. `geo_city_coordinates` - Coordinate data for all cities (matched + created)

### Point-in-Polygon Matching
Uses PostGIS spatial queries:
- `ST_Intersects(region.boundary, city.location)` for region assignment
- `ST_Intersects(district.boundary, city.location)` for district assignment

## Testing

Compile test successful:
```bash
cd api && go build -o /tmp/test-import-simplemaps ./cmd/import-simplemaps/
# No errors
```

## Usage

```bash
# Import with city creation
cd api
./import-simplemaps import --csv data/simplemaps/worldcities.csv

# Dry-run to see what would be created
./import-simplemaps import --csv data/simplemaps/worldcities.csv --dry-run

# Check status
./import-simplemaps status
```

## Data Sources

- **ISO 3166-1 Country Codes**: [lukes/ISO-3166-Countries-with-Regional-Codes](https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes)
- **SimpleMaps City Data**: [SimpleMaps World Cities](https://simplemaps.com/data/world-cities)

## Notes

1. **Country Creation**: Uses ISO2/ISO3 from SimpleMaps + continent from `iso2ToContinent` map
2. **Continent Mapping**: Based on ISO 3166-1 alpha-2 standard with Americas split into NA/SA
3. **Timezone**: New cities use "UTC" as default timezone (should be updated via separate process)
4. **Hierarchy**: Region/district assignment is best-effort via point-in-polygon
5. **WOF First**: Still recommended to import WOF data first for better matching
6. **Idempotent**: Re-running import updates existing coordinates, creates missing countries/cities
