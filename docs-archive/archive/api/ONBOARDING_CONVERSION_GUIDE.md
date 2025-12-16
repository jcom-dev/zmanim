# Onboarding Handler SQLc Conversion Guide

This guide provides exact code changes to replace raw SQL with SQLc queries in `api/internal/handlers/onboarding.go`.

## Summary

- **Total Raw SQL Violations**: 13
- **Can Fix Now**: 9 (69%)
- **Blocked by Schema**: 4 (31%)

## Changes Blocked by Schema Mismatch

These functions use columns that don't exist in the current schema and CANNOT be converted without migration:

### 1. GetOnboardingState (lines 41-49)
**Status**: ❌ BLOCKED - Uses non-existent columns (current_step, completed_steps, wizard_data, etc.)

**Current Code**:
```go
err := h.db.Pool.QueryRow(ctx, `
    SELECT id, current_step, completed_steps, wizard_data,
           started_at, last_updated_at, completed_at, skipped
    FROM publisher_onboarding
    WHERE publisher_id = $1
`, publisherID).Scan(...)
```

**Note**: Schema only has: profile_complete, algorithm_selected, zmanim_configured, coverage_set

### 2. SaveOnboardingState (lines 111-121)
**Status**: ❌ BLOCKED - Uses non-existent columns

**Current Code**:
```go
_, err = h.db.Pool.Exec(ctx, `
    INSERT INTO publisher_onboarding (
        publisher_id, current_step, completed_steps, wizard_data, last_updated_at
    ) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (publisher_id)
    DO UPDATE SET...
`, publisherID, req.CurrentStep, req.CompletedSteps, wizardData)
```

### 3. CompleteOnboarding - Get wizard_data (lines 219-221)
**Status**: ❌ BLOCKED - Queries non-existent wizard_data column

**Current Code**:
```go
err := h.db.Pool.QueryRow(ctx, `
    SELECT wizard_data FROM publisher_onboarding WHERE publisher_id = $1
`, publisherID).Scan(&wizardData)
```

### 4. CompleteOnboarding - Final update (lines 431-435)
**Status**: ❌ BLOCKED - Updates non-existent columns

**Current Code**:
```go
_, _ = h.db.Pool.Exec(ctx, `
    UPDATE publisher_onboarding
    SET completed_at = NOW(), current_step = 5
    WHERE publisher_id = $1
`, publisherID)
```

**Workaround**: Replace with `MarkZmanimConfigured` and `MarkCoverageSet` queries

## Changes That CAN Be Made Now

### Step 1: Add import for strconv (if not already present)

At the top of the file, ensure this import exists:
```go
import (
    "encoding/json"
    "log/slog"
    "net/http"
    "strconv"  // Add this if missing
    "time"
)
```

### Step 2: Add helper function for category mapping

Add this function before `CompleteOnboarding`:

```go
// getCategoryTimeCategoryID maps category string to time_category_id
// Returns 0 if not found (caller should handle this case)
func (h *Handlers) getCategoryTimeCategoryID(ctx context.Context, category string) (int32, error) {
    timeCategory, err := h.db.Queries.GetTimeCategoryByKey(ctx, category)
    if err != nil {
        return 0, err
    }
    return timeCategory.ID, nil
}
```

### Step 3: Replace Zmanim Upserts (lines 260-298)

**Current Code** (lines 260-298):
```go
if zman.MasterZmanID != "" {
    // Use the registry-based insert that links to master_zman_id
    _, err = h.db.Pool.Exec(ctx, `
        INSERT INTO publisher_zmanim (
            publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
            is_enabled, is_visible, is_published, is_custom, category,
            master_zman_id
        ) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6, $7)
        ON CONFLICT (publisher_id, zman_key) DO UPDATE SET...
    `, publisherID, zmanKey, hebrewName, englishName,
        zman.Formula, category, zman.MasterZmanID)
} else {
    // Legacy insert without master_zman_id
    _, err = h.db.Pool.Exec(ctx, `
        INSERT INTO publisher_zmanim (
            publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
            is_enabled, is_visible, is_published, is_custom, category
        ) VALUES ($1, $2, $3, $4, $5, true, true, false, false, $6)
        ON CONFLICT (publisher_id, zman_key) DO UPDATE SET...
    `, publisherID, zmanKey, hebrewName, englishName,
        zman.Formula, category)
}
```

**Replace With**:
```go
// Map category string to time_category_id
timeCategoryID, err := h.getCategoryTimeCategoryID(ctx, category)
if err != nil {
    slog.Error("CompleteOnboarding failed to lookup time category", "category", category, "error", err)
    RespondInternalError(w, r, "Failed to lookup time category: "+err.Error())
    return
}

if zman.MasterZmanID != "" {
    // Convert master_zman_id from string to int32
    masterZmanID, err := strconv.ParseInt(zman.MasterZmanID, 10, 32)
    if err != nil {
        slog.Error("CompleteOnboarding invalid master_zman_id", "zman_key", zmanKey, "error", err)
        RespondInternalError(w, r, "Invalid master_zman_id: "+err.Error())
        return
    }

    // Use SQLc query
    err = h.db.Queries.UpsertPublisherZmanWithMaster(ctx, sqlcgen.UpsertPublisherZmanWithMasterParams{
        PublisherID:    publisherIDInt,
        ZmanKey:        zmanKey,
        HebrewName:     hebrewName,
        EnglishName:    englishName,
        FormulaDsl:     zman.Formula,
        TimeCategoryID: sql.NullInt32{Int32: timeCategoryID, Valid: true},
        MasterZmanID:   sql.NullInt32{Int32: int32(masterZmanID), Valid: true},
    })
} else {
    // Use SQLc query for legacy (no master_zman_id)
    err = h.db.Queries.UpsertPublisherZmanLegacy(ctx, sqlcgen.UpsertPublisherZmanLegacyParams{
        PublisherID:    publisherIDInt,
        ZmanKey:        zmanKey,
        HebrewName:     hebrewName,
        EnglishName:    englishName,
        FormulaDsl:     zman.Formula,
        TimeCategoryID: sql.NullInt32{Int32: timeCategoryID, Valid: true},
    })
}
```

**Required import**: Add `"database/sql"` to imports for sql.NullInt32

### Step 4: Replace Continent Lookup and Insert (lines 321-340)

**Current Code**:
```go
var continentID int16
err := h.db.Pool.QueryRow(ctx, `SELECT id FROM geo_continents WHERE code = $1`, cov.ID).Scan(&continentID)
if err != nil {
    slog.Error("CompleteOnboarding failed to find continent", "code", cov.ID, "error", err)
    continue
}
_, err = h.db.Pool.Exec(ctx, `
    INSERT INTO publisher_coverage (
        publisher_id, coverage_level_id, continent_id
    )
    VALUES (
        $1,
        (SELECT id FROM coverage_levels WHERE key = 'continent'),
        $2
    )
    ON CONFLICT DO NOTHING
`, publisherIDInt, continentID)
```

**Replace With**:
```go
continent, err := h.db.Queries.GetContinentByCode(ctx, cov.ID)
if err != nil {
    slog.Error("CompleteOnboarding failed to find continent", "code", cov.ID, "error", err)
    continue
}
_, err = h.db.Queries.CreateCoverageContinent(ctx, sqlcgen.CreateCoverageContinentParams{
    PublisherID: publisherIDInt,
    ContinentID: sql.NullInt16{Int16: continent.ID, Valid: true},
    Priority:    0,
    IsActive:    true,
})
```

### Step 5: Replace Country Lookup and Insert (lines 345-364)

**Current Code**:
```go
var countryID int16
err := h.db.Pool.QueryRow(ctx, `SELECT id FROM geo_countries WHERE code = $1 OR id::text = $1`, cov.ID).Scan(&countryID)
if err != nil {
    slog.Error("CompleteOnboarding failed to find country", "id", cov.ID, "error", err)
    continue
}
_, err = h.db.Pool.Exec(ctx, `
    INSERT INTO publisher_coverage (
        publisher_id, coverage_level_id, country_id
    )
    VALUES (
        $1,
        (SELECT id FROM coverage_levels WHERE key = 'country'),
        $2
    )
    ON CONFLICT DO NOTHING
`, publisherIDInt, countryID)
```

**Replace With**:
```go
country, err := h.db.Queries.GetCountryByCodeOrID(ctx, cov.ID)
if err != nil {
    slog.Error("CompleteOnboarding failed to find country", "id", cov.ID, "error", err)
    continue
}
_, err = h.db.Queries.CreateCoverageCountry(ctx, sqlcgen.CreateCoverageCountryParams{
    PublisherID: publisherIDInt,
    CountryID:   sql.NullInt16{Int16: country.ID, Valid: true},
    Priority:    0,
    IsActive:    true,
})
```

### Step 6: Replace Region Lookup and Insert (lines 368-387)

**Current Code**:
```go
var regionID int32
err := h.db.Pool.QueryRow(ctx, `SELECT id FROM geo_regions WHERE id::text = $1`, cov.ID).Scan(&regionID)
if err != nil {
    slog.Error("CompleteOnboarding failed to find region", "id", cov.ID, "error", err)
    continue
}
_, err = h.db.Pool.Exec(ctx, `
    INSERT INTO publisher_coverage (
        publisher_id, coverage_level_id, region_id
    )
    VALUES (
        $1,
        (SELECT id FROM coverage_levels WHERE key = 'region'),
        $2
    )
    ON CONFLICT DO NOTHING
`, publisherIDInt, regionID)
```

**Replace With**:
```go
regionIDInt, err := strconv.ParseInt(cov.ID, 10, 32)
if err != nil {
    slog.Error("CompleteOnboarding invalid region ID", "id", cov.ID, "error", err)
    continue
}
region, err := h.db.Queries.GetRegionByID(ctx, int32(regionIDInt))
if err != nil {
    slog.Error("CompleteOnboarding failed to find region", "id", cov.ID, "error", err)
    continue
}
_, err = h.db.Queries.CreateCoverageRegion(ctx, sqlcgen.CreateCoverageRegionParams{
    PublisherID: publisherIDInt,
    RegionID:    sql.NullInt32{Int32: region.ID, Valid: true},
    Priority:    0,
    IsActive:    true,
})
```

### Step 7: Replace City Lookups and Insert (lines 392-424)

**Current Code**:
```go
var cityID int32
if isQuickSelectID(cov.ID) {
    cityName := extractCityNameFromQuickID(cov.ID)
    err = h.db.Pool.QueryRow(ctx, `
        SELECT id FROM geo_cities WHERE LOWER(name) = LOWER($1) LIMIT 1
    `, cityName).Scan(&cityID)
    if err != nil {
        slog.Warn("CompleteOnboarding could not find city for quick select", "id", cov.ID, "error", err)
        continue
    }
} else {
    err = h.db.Pool.QueryRow(ctx, `SELECT id FROM geo_cities WHERE id::text = $1`, cov.ID).Scan(&cityID)
    if err != nil {
        slog.Error("CompleteOnboarding could not find city", "id", cov.ID, "error", err)
        continue
    }
}
_, err = h.db.Pool.Exec(ctx, `
    INSERT INTO publisher_coverage (
        publisher_id, coverage_level_id, city_id
    )
    VALUES (
        $1,
        (SELECT id FROM coverage_levels WHERE key = 'city'),
        $2
    )
    ON CONFLICT DO NOTHING
`, publisherIDInt, cityID)
```

**Replace With**:
```go
var city sqlcgen.City
if isQuickSelectID(cov.ID) {
    cityName := extractCityNameFromQuickID(cov.ID)
    city, err = h.db.Queries.GetCityByName(ctx, cityName)
    if err != nil {
        slog.Warn("CompleteOnboarding could not find city for quick select", "id", cov.ID, "error", err)
        continue
    }
} else {
    cityIDInt, err := strconv.ParseInt(cov.ID, 10, 32)
    if err != nil {
        slog.Error("CompleteOnboarding invalid city ID", "id", cov.ID, "error", err)
        continue
    }
    city, err = h.db.Queries.GetCityByID(ctx, int32(cityIDInt))
    if err != nil {
        slog.Error("CompleteOnboarding could not find city", "id", cov.ID, "error", err)
        continue
    }
}
_, err = h.db.Queries.CreateCoverageCity(ctx, sqlcgen.CreateCoverageCityParams{
    PublisherID: publisherIDInt,
    CityID:      sql.NullInt32{Int32: city.ID, Valid: true},
    Priority:    0,
    IsActive:    true,
})
```

### Step 8: Replace ResetOnboarding Deletes (lines 538-559)

**Current Code**:
```go
// Delete ALL zmanim for this publisher (wizard will re-import)
_, err := h.db.Pool.Exec(ctx, `
    DELETE FROM publisher_zmanim WHERE publisher_id = $1
`, publisherID)
if err != nil {
    slog.Error("ResetOnboarding failed to delete zmanim", "error", err)
    RespondInternalError(w, r, "Failed to reset onboarding")
    return
}

// Delete coverage for this publisher (wizard will re-import)
_, err = h.db.Pool.Exec(ctx, `
    DELETE FROM publisher_coverage WHERE publisher_id = $1
`, publisherID)
if err != nil {
    slog.Error("ResetOnboarding failed to delete coverage", "error", err)
    // Continue anyway, coverage deletion is not critical
}

// Delete onboarding state
_, err = h.db.Pool.Exec(ctx, `
    DELETE FROM publisher_onboarding WHERE publisher_id = $1
`, publisherID)

if err != nil {
    RespondInternalError(w, r, "Failed to reset onboarding")
    return
}
```

**Replace With**:
```go
// Convert publisher ID to int32
publisherIDInt, err := stringToInt32(publisherID)
if err != nil {
    slog.Error("ResetOnboarding invalid publisher ID", "error", err)
    RespondInternalError(w, r, "Invalid publisher ID")
    return
}

// Delete ALL zmanim for this publisher (wizard will re-import)
err = h.db.Queries.DeleteAllPublisherZmanim(ctx, publisherIDInt)
if err != nil {
    slog.Error("ResetOnboarding failed to delete zmanim", "error", err)
    RespondInternalError(w, r, "Failed to reset onboarding")
    return
}

// Delete coverage for this publisher (wizard will re-import)
err = h.db.Queries.DeleteAllPublisherCoverage(ctx, publisherIDInt)
if err != nil {
    slog.Error("ResetOnboarding failed to delete coverage", "error", err)
    // Continue anyway, coverage deletion is not critical
}

// Delete onboarding state
err = h.db.Queries.DeleteOnboardingState(ctx, publisherIDInt)
if err != nil {
    RespondInternalError(w, r, "Failed to reset onboarding")
    return
}
```

### Step 9: Replace final onboarding completion update (line 431-435)

**Current Code** (BLOCKED by schema):
```go
_, _ = h.db.Pool.Exec(ctx, `
    UPDATE publisher_onboarding
    SET completed_at = NOW(), current_step = 5
    WHERE publisher_id = $1
`, publisherID)
```

**Workaround** (uses actual schema):
```go
// Mark onboarding steps as complete (using actual schema columns)
publisherIDInt, _ := stringToInt32(publisherID)
_ = h.db.Queries.MarkZmanimConfigured(ctx, publisherIDInt)
_ = h.db.Queries.MarkCoverageSet(ctx, publisherIDInt)
```

## Required Imports

Ensure these imports are present in `onboarding.go`:

```go
import (
    "database/sql"
    "encoding/json"
    "log/slog"
    "net/http"
    "strconv"
    "time"

    "github.com/yourusername/zmanim/api/internal/db/sqlcgen"
)
```

## Testing After Changes

1. Run `go build ./cmd/api` to verify compilation
2. Test each endpoint:
   - GET /api/publisher/onboarding
   - PUT /api/publisher/onboarding
   - POST /api/publisher/onboarding/complete
   - POST /api/publisher/onboarding/skip
   - DELETE /api/publisher/onboarding

## Summary of Results

After implementing these changes:
- ✓ 9 raw SQL calls converted to SQLc queries (69%)
- ❌ 4 raw SQL calls blocked by schema mismatch (31%)
- Schema migration required to complete the remaining 4 violations

The 4 blocked violations should be tracked as technical debt with the migration plan in `ONBOARDING_FIX_SUMMARY.md`.
