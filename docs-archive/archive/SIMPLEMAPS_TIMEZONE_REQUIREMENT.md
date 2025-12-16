# SimpleMaps Timezone Requirement Feature

## Summary

Added `--allow-no-timezone` flag to control whether SimpleMaps import can create new cities without timezone data. By default, timezone is now **required** for new city creation.

## Rationale

Cities without timezone data are not useful for zmanim calculations. The default behavior now prevents creating cities from SimpleMaps Basic (free) version, which lacks timezone data.

## Default Behavior

**Timezone is REQUIRED by default** for new city creation:
- ✅ SimpleMaps **Pro version** → Creates new cities (has timezone data)
- ❌ SimpleMaps **Basic version** → Skips new city creation (no timezone data)
- ✅ **Matched cities** → Always updated with SimpleMaps coordinates (regardless of timezone)

## Flag: `--allow-no-timezone`

Use this flag to allow creating cities without timezone (they will use UTC as fallback):

```bash
# Default (timezone required - recommended):
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv
# Result: Updates matched cities only, skips unmatched cities

# With flag (allows UTC fallback):
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv --allow-no-timezone
# Result: Updates matched cities, creates new cities with UTC timezone
```

## Impact by SimpleMaps Version

### Pro/Comprehensive Version (Recommended)
- **Has timezone column** (index 17)
- **Default behavior**: Creates new cities with timezone ✅
- **Cities created**: All unmatched cities
- **Timezone source**: SimpleMaps IANA timezone

### Basic Version (Free)
- **No timezone column**
- **Default behavior**: Skips new city creation ⚠️
- **Cities updated**: Only matched WOF cities
- **Override**: Use `--allow-no-timezone` to create with UTC

## Code Changes

### 1. Added `requireTimezone` Config Flag

```go
type importConfig struct {
    // ... other fields ...
    requireTimezone bool // Default: true
}
```

### 2. Added Command-Line Flag

```bash
--allow-no-timezone   Allow creating cities without timezone (UTC fallback)
```

### 3. Updated Import Logic

```go
// Skip city creation if timezone required but not available
if imp.requireTimezone && city.Timezone == "" {
    imp.recordSkip("no_timezone", city, "timezone required...")
    return processResult{status: "skipped"}
}
```

### 4. Added Status Output

```
SimpleMaps City Coordinates Import
===================================
CSV: data/simplemaps/worldcities.csv
Max distance: 50.0 km
Timezone policy: REQUIRED (new cities need timezone from Pro version)
                 Use --allow-no-timezone to create cities with UTC fallback
```

## Usage Examples

### Recommended: Pro Version (Has Timezone)

```bash
# Import with Pro version
cd api
./import-simplemaps import --csv data/simplemaps/worldcities.csv

# Expected behavior:
# - Matched cities: Update coordinates (preserve WOF timezone)
# - New cities: Create with SimpleMaps timezone
# - Countries: Create if missing
```

### Basic Version: Update Only

```bash
# Import with Basic version (default - no new cities)
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv

# Expected behavior:
# - Matched cities: Update coordinates (preserve WOF timezone)
# - New cities: SKIP (no timezone available)
# - Countries: NOT created (no cities to create)
# - Output: Shows count of skipped cities with "no_timezone" reason
```

### Basic Version: Allow UTC Fallback

```bash
# Import with Basic version (allow UTC)
./import-simplemaps import --csv data/simplemaps/worldcities-basic.csv --allow-no-timezone

# Expected behavior:
# - Matched cities: Update coordinates (preserve WOF timezone)
# - New cities: Create with UTC timezone
# - Countries: Create if needed
# - Warning: New cities will have UTC timezone (not ideal for zmanim)
```

## Statistics Output

The import now tracks "no_timezone" as a skip reason:

```
Results:
  Processed:      48000
  Matched:        35000 (72.9%)
    Inserted:     30000
    Updated:      5000
  Cities created: 0       (timezone required)

Not imported:
  No match:       0
  Rejected:       0
  No country:     0

Skip reasons breakdown:
  13000  no_timezone
```

## When to Use Each Approach

### Use Default (Timezone Required)

**Scenario**: Production environment with Pro version
```bash
./import-simplemaps import --csv worldcities.csv
```

**Benefits**:
- Only creates cities with proper timezone
- No UTC fallback cities
- Clean, usable data for zmanim

### Use `--allow-no-timezone`

**Scenario**: Testing or development with Basic version
```bash
./import-simplemaps import --csv worldcities-basic.csv --allow-no-timezone
```

**Trade-offs**:
- ✅ Creates cities from free data
- ⚠️ New cities have UTC timezone (not accurate)
- ⚠️ Requires manual timezone updates later

## Migration Path

### Current State (Free Version)
1. Import WOF data → Get cities with WOF timezone
2. Import SimpleMaps Basic → Update matched cities only
3. **Gap**: Missing cities not in WOF

### After Purchasing Pro
1. Keep existing WOF cities (preserve WOF timezone)
2. Import SimpleMaps Pro → Create missing cities with timezone
3. **Complete**: All cities have proper timezones

### Alternative (Keep Free Version)
1. Import WOF data → Comprehensive coverage with timezone
2. Import SimpleMaps Basic → Better coordinates for matched cities
3. **Accept**: Only WOF cities available (but with good coordinates)

## Documentation Updates

Updated files:
- `api/cmd/import-simplemaps/main.go` - Code implementation
- `docs/location-data-process.md` - User-facing documentation

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing imports work unchanged
- Default behavior is safe (requires timezone)
- Flag opt-in for UTC fallback
- No database changes required

## Testing

✅ Code compiles successfully
✅ Default requires timezone (skips Basic new cities)
✅ Flag allows UTC fallback
✅ Status output shows policy
✅ Skip reasons track "no_timezone"

## Recommendations

1. **Production**: Use SimpleMaps **Pro version** for complete timezone coverage
2. **Development**: Use WOF only (comprehensive + free + has timezone)
3. **Avoid**: Creating cities without timezone (use flag only for testing)
4. **When upgrading**: Re-run SimpleMaps Pro import to fill timezone gaps
