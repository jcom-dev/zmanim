# SimpleMaps Timezone Support

## Summary

Enhanced the SimpleMaps import tool to read and use timezone data from SimpleMaps Pro/Comprehensive version CSV files.

## Changes Made

### 1. Added Timezone Field to Struct

Updated `SimpleMapsCity` struct to include timezone:

```go
type SimpleMapsCity struct {
    // ... existing fields ...
    Timezone   string // IANA timezone (e.g., "America/New_York")
}
```

### 2. Enhanced CSV Parsing

Modified `parseCSVRow()` to support both SimpleMaps versions:

- **Basic (free) version**: 11 columns, no timezone → defaults to UTC
- **Pro/Comprehensive version**: 20 columns, timezone at index 17

```go
// If Pro/Comprehensive version with timezone column (20 columns)
if len(record) >= 20 {
    city.Timezone = record[17] // timezone column at index 17
}
```

### 3. Updated City Creation

Modified `createCity()` to use SimpleMaps timezone when available:

```go
// Use SimpleMaps timezone if available, otherwise default to UTC
timezone := city.Timezone
if timezone == "" {
    timezone = "UTC"
}
```

## Timezone Priority System

The system uses a tiered approach for timezone data:

### Priority Order (Highest to Lowest)

1. **Publisher Override** - Custom timezone set by zmanim publishers
2. **Community Corrections** - User-submitted verified corrections
3. **WOF Timezone** - From Who's On First `wof:timezone` property (most reliable)
4. **SimpleMaps Timezone** - From SimpleMaps Pro version (for new cities only)
5. **UTC** - Fallback for cities without any timezone data

### Why WOF Has Higher Priority

- **WOF timezone is more reliable**:
  - Curated and validated against IANA timezone database
  - Uses polygon boundaries for accurate timezone regions
  - Community-reviewed open data

- **SimpleMaps timezone**:
  - Available only in Pro/Comprehensive version (not free)
  - Likely algorithmically derived from coordinates
  - Less transparent data provenance

### Import Behavior

**For matched cities** (SimpleMaps matches existing WOF city):
- Updates coordinates with SimpleMaps data (higher accuracy)
- **Preserves WOF timezone** (more reliable)
- Does NOT overwrite timezone with SimpleMaps value

**For new cities** (SimpleMaps city with no WOF match):
- Creates new city record
- Uses SimpleMaps timezone if available (Pro version)
- Falls back to UTC if not available (Basic version)

## SimpleMaps Versions

### Basic (Free)
- ~48,000 cities
- 11 columns: city, city_ascii, lat, lng, country, iso2, iso3, admin_name, capital, population, id
- **No timezone column** → New cities get UTC

### Pro/Comprehensive (Paid)
- ~4 million cities
- 20 columns including: timezone, density, population_proper, ranking, etc.
- **Includes IANA timezone** → New cities get proper timezone

## Database Impact

### Tables Modified
- `geo_cities` - New cities created with SimpleMaps timezone (when available)

### Example Data

**New city from Pro version**:
```
Tokyo, Japan
- Timezone: Asia/Tokyo (from SimpleMaps)
- Coordinates: SimpleMaps
- Hierarchy: Point-in-polygon matching
```

**New city from Basic version**:
```
Small Town, Country
- Timezone: UTC (fallback)
- Coordinates: SimpleMaps
- Hierarchy: Point-in-polygon matching
```

**Matched WOF city**:
```
London, United Kingdom
- Timezone: Europe/London (from WOF - preserved)
- Coordinates: SimpleMaps (updated)
- Hierarchy: WOF (preserved)
```

## Code Locations

- **Struct Definition**: `api/cmd/import-simplemaps/main.go:586-600`
- **CSV Parsing**: `api/cmd/import-simplemaps/main.go:698-738`
- **City Creation**: `api/cmd/import-simplemaps/main.go:1066-1095`
- **Package Documentation**: `api/cmd/import-simplemaps/main.go:1-37`

## Documentation Updates

Updated `/home/daniel/repos/zmanim/docs/location-data-process.md`:
- Added timezone priority explanation
- Documented SimpleMaps timezone support
- Explained why WOF timezone has higher priority
- Added timezone handling to import details

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing imports work unchanged
- Basic (free) version still works (uses UTC for new cities)
- Pro version now properly uses timezone data
- No changes required to existing database or code

## Testing

✅ Code compiles successfully
✅ Supports both Basic and Pro CSV formats
✅ Gracefully handles missing timezone column
✅ Falls back to UTC when timezone unavailable

## Data Sources

- **WOF Timezone**: [Who's On First](https://whosonfirst.org/) - `wof:timezone` property
- **SimpleMaps Timezone**: [SimpleMaps World Cities Database](https://simplemaps.com/data/world-cities) - Pro/Comprehensive version only
- **IANA Timezone Database**: Both sources use [IANA timezone identifiers](https://www.iana.org/time-zones)

## Recommendations

1. **For production**: Use SimpleMaps **Pro version** to get timezone data for new cities
2. **For development/testing**: Basic version works fine, new cities will have UTC timezone
3. **For existing WOF cities**: WOF timezone is automatically preserved (no action needed)
4. **For community corrections**: Allow users to submit timezone corrections via Community Corrections system
