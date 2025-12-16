# Zman Logic Decentralization Plan

## Executive Summary

**Problem:** Zman-specific business logic is hardcoded throughout the codebase instead of being driven by DSL formulas and tags. This violates the core architectural principle that all zman calculations and display rules should be data-driven.

**Impact:** Adding or modifying zman behavior requires code changes instead of database configuration. Publishers cannot customize zmanim (e.g., Jerusalem 40-minute candle lighting) without developer intervention.

---

## Findings Overview

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 2 | Hardcoded candle lighting (18 min) and havdalah (42 min) in handler |
| HIGH | 4 | Hardcoded MGA offsets (60/72/90/96/120 min), solar angles (16.1°, 18°) |
| MEDIUM | 3 | Tag-based display logic, rounding modes, fast start types |
| LOW | 1 | Israel bounding box detection |

---

## Detailed Findings

### 1. CRITICAL: Hardcoded Candle Lighting & Havdalah

**Location:** [zmanim.go:478-541](api/internal/handlers/zmanim.go#L478-L541)

```go
// Line 479-480: HARDCODED 18 MINUTES
candleLightingTime := astro.SubtractMinutes(sunsetTime, 18)

// Line 512-513: HARDCODED 42 MINUTES
havdalahTime := astro.AddMinutes(sunsetTime, 42)
```

**Problems:**
- These zmanim are synthesized in handler code, not fetched from `master_zmanim_registry`
- Formula, rounding mode, display name all hardcoded
- Cannot customize per-publisher (Jerusalem uses 40 min for candle lighting)
- Comment mentions "8.5° approximation" but uses fixed minutes

**Solution:**
1. Add `candle_lighting` and `havdalah` to `master_zmanim_registry` with proper DSL formulas
2. Create publisher_zmanim entries like any other zman
3. Use tags (`is_candle_lighting`, `is_havdalah`) for conditional display
4. Remove hardcoded synthesis from handler

---

### 2. HIGH: Hardcoded MGA Day Boundaries

**Location:** [executor.go:432-460](api/internal/dsl/executor.go#L432-L460)

```go
case "mga", "mga_72":
    alos72 := astro.SubtractMinutes(st.Sunrise, 72)
    tzeis72 := astro.AddMinutes(st.Sunset, 72)

case "mga_60":
    alos60 := astro.SubtractMinutes(st.Sunrise, 60)
    // ... 90, 96, 120 variants
```

**Analysis:** This is *partially acceptable* - these are named DSL methods that define specific halachic day boundaries. The DSL system needs to know what `mga_72` means.

**Recommendation:**
- Keep these as named DSL method definitions (they ARE the DSL implementation)
- Document that adding new MGA variants requires DSL executor changes
- Consider: Allow parameterized `mga(72)` syntax for extensibility

---

### 3. HIGH: Hardcoded Solar Angles

**Location:** [executor.go:489-510](api/internal/dsl/executor.go#L489-L510)

```go
case "mga_16_1":
    alos161, _ := astro.SunTimeAtAngleWithElevation(..., 16.1)

case "mga_18":
    alos18, _ := astro.SunTimeAtAngleWithElevation(..., 18.0)
```

**Analysis:** Similar to MGA offsets - these define what the DSL keywords mean.

**Recommendation:**
- Keep as DSL method definitions
- Add `solar(-16.1)` syntax for arbitrary angles (already exists in DSL)
- Document the named convenience methods

---

### 4. MEDIUM: Tag-Based Display Logic

**Location:** [publisher_zmanim.go:1072-1091](api/internal/handlers/publisher_zmanim.go#L1072-L1091)

```go
isCandleLighting := hasTagKey(z.Tags, "is_candle_lighting")
isHavdalah := hasTagKey(z.Tags, "is_havdalah")
isFastStart := hasTagKey(z.Tags, "is_fast_start")
isFastEnd := hasTagKey(z.Tags, "is_fast_end")

if isCandleLighting && !dayCtx.ShowCandleLighting {
    return false
}
```

**Analysis:** This is *acceptable architecture* - it's tag-driven, not zman-name-driven. The code checks for tags, not hardcoded zman keys.

**Minor Issue:** The tag keys themselves are hardcoded strings. Could be constants.

**Recommendation:**
- Keep current approach (it IS tag-driven)
- Extract tag key strings to constants for maintainability
- Add documentation explaining the tag-based filtering pattern

---

### 5. MEDIUM: Hardcoded Rounding Modes

**Location:** [zmanim.go:484, 517](api/internal/handlers/zmanim.go#L484-L517)

```go
_, candleTimeRounded := services.ApplyRounding(candleLightingTime, "floor")
_, havdalahTimeRounded := services.ApplyRounding(havdalahTime, "ceil")
```

**Problem:** Rounding mode should come from `publisher_zmanim.rounding_mode`, not be hardcoded per zman type.

**Solution:** When candle lighting/havdalah are proper database zmanim, rounding mode will be stored per-publisher.

---

### 6. MEDIUM: Hardcoded Fast Start Types

**Location:** [events.go:406-416](api/internal/calendar/events.go#L406-L416)

```go
func getFastStartType(code string) string {
    switch code {
    case "yom_kippur", "tisha_bav":
        return "sunset"
    case "tzom_gedaliah", "asarah_bteves", "shiva_asar_btamuz", "taanis_esther":
        return "dawn"
    }
}
```

**Problem:** Which zman marks fast start should be in `jewish_events` table, not code.

**Solution:** Add `fast_start_zman_key` column to `jewish_events` table:
- Yom Kippur: `candle_lighting` (starts at candle lighting, not sunset)
- Tisha B'Av: `sunset`
- Minor fasts: `alos_hashachar`

---

### 7. MEDIUM: Hardcoded Yom Tov List

**Location:** [events.go:419-429](api/internal/calendar/events.go#L419-L429)

```go
func isYomTovEvent(code string) bool {
    yomTovCodes := map[string]bool{
        "rosh_hashanah": true,
        "yom_kippur": true,
        // ...
    }
}
```

**Problem:** Yom Tov classification should be a column in `jewish_events` table.

**Solution:** Add `is_yom_tov BOOLEAN` column to `jewish_events`.

---

### 8. LOW: Hardcoded Israel Bounding Box

**Location:** [events.go:56-62](api/internal/calendar/events.go#L56-L62)

```go
func IsLocationInIsrael(lat, lon float64) bool {
    return lat >= 29.5 && lat <= 33.5 && lon >= 34.0 && lon <= 36.0
}
```

**Analysis:** Low priority - bounding box is stable. Could use `geo_regions` but adds complexity.

**Recommendation:** Keep as-is with a comment explaining why.

---

## Remediation Plan

### Phase 1: Database Schema Updates

```sql
-- 1. Add fast_start_zman_key to jewish_events
ALTER TABLE jewish_events ADD COLUMN fast_start_zman_key VARCHAR(100);
ALTER TABLE jewish_events ADD COLUMN is_yom_tov BOOLEAN DEFAULT FALSE;

-- 2. Populate fast start types
UPDATE jewish_events SET fast_start_zman_key = 'sunset', is_yom_tov = TRUE
  WHERE code = 'yom_kippur';
UPDATE jewish_events SET fast_start_zman_key = 'sunset', is_yom_tov = FALSE
  WHERE code = 'tisha_bav';
UPDATE jewish_events SET fast_start_zman_key = 'alos_hashachar', is_yom_tov = FALSE
  WHERE code IN ('tzom_gedaliah', 'asarah_bteves', 'shiva_asar_btamuz', 'taanis_esther');
UPDATE jewish_events SET is_yom_tov = TRUE
  WHERE code IN ('rosh_hashanah', 'sukkos', 'shemini_atzeres', 'pesach_first', 'pesach_last', 'shavuos');

-- 3. Ensure candle_lighting and havdalah in master_zmanim_registry
INSERT INTO master_zmanim_registry (key, name, hebrew_name, default_dsl, time_category, system_category)
VALUES
  ('candle_lighting', 'Candle Lighting', 'הדלקת נרות', 'sunset - 18min', 'sunset', 'shabbos_yomtov'),
  ('havdalah', 'Havdalah', 'הבדלה', 'sunset + 42min', 'nightfall', 'shabbos_yomtov')
ON CONFLICT (key) DO NOTHING;
```

### Phase 2: Code Changes

1. **Remove handler synthesis** ([zmanim.go:478-541](api/internal/handlers/zmanim.go#L478-L541))
   - Delete the `if zmanimContext.ShowCandleLighting` and `if zmanimContext.ShowShabbosYomTovEnds` blocks
   - Candle lighting and havdalah will come from unified zmanim query like all other zmanim

2. **Update calendar service** ([events.go](api/internal/calendar/events.go))
   - Query `jewish_events.fast_start_zman_key` instead of `getFastStartType()`
   - Query `jewish_events.is_yom_tov` instead of `isYomTovEvent()`

3. **Add tag constants** (new file: `api/internal/tags/constants.go`)
   ```go
   package tags

   const (
       IsCandleLighting = "is_candle_lighting"
       IsHavdalah       = "is_havdalah"
       IsFastStart      = "is_fast_start"
       IsFastEnd        = "is_fast_end"
   )
   ```

### Phase 3: Publisher Migration

For each publisher:
1. Create `publisher_zmanim` entries for `candle_lighting` and `havdalah`
2. Set appropriate DSL formula (e.g., Jerusalem: `sunset - 40min`)
3. Set rounding mode from publisher preferences
4. Add required tags (`is_candle_lighting`, `is_havdalah`)

---

## What NOT to Change

The following are acceptable as-is:

1. **DSL method definitions** (mga_72, mga_16_1, etc.) - These ARE the DSL implementation
2. **Tag-based filtering** - Already data-driven, just uses hardcoded tag key strings
3. **Israel bounding box** - Low priority, stable geography

---

## Success Criteria

1. Candle lighting time is configurable per-publisher via database
2. Havdalah time is configurable per-publisher via database
3. Adding new event-triggered zmanim requires no code changes
4. Fast start/end zman is determined by `jewish_events` table, not code
5. All zman calculations flow through DSL executor

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing API responses | Add feature flag, migrate incrementally |
| Missing candle_lighting for publishers | Migration script to auto-create entries |
| Complex havdalah variants (72 min, Rabbeinu Tam) | DSL already supports these formulas |
| Performance impact of additional DB queries | Already batched in unified service |

---

## Timeline Estimate

- Phase 1 (Schema): 1 story
- Phase 2 (Code): 2-3 stories
- Phase 3 (Migration): 1 story
- Testing: 1 story

**Total:** 5-6 stories across 1-2 sprints
