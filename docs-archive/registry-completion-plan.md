# Master Zmanim Registry - Comprehensive Completion Plan

**Created:** December 21, 2025
**Purpose:** Complete audit, validation, and enhancement of master_zmanim_registry
**Current Status:** 172 zmanim entries
**Target:** 187+ validated and tested entries

---

## Overview

This plan covers the complete audit, validation, and enhancement of all 172+ zmanim in the master_zmanim_registry, plus addition of 15 missing zmanim identified from KosherJava research.

**Key Objectives:**
1. Fix DSL engine to support `proportional_minutes()` function (CRITICAL - blocks seed data)
2. Add 1 missing shita tag (Manchester)
3. Audit ALL 172 existing zmanim for correctness
4. Add 15 missing zmanim (prioritized)
5. Validate all DSL formulas work correctly
6. Ensure proper tag associations

---

## Phase 0: DSL Enhancement (CRITICAL - DO FIRST)

**Problem:** The seed data contains formulas like `proportional_minutes(72, before_sunrise)` and `proportional_minutes(120, after_sunset)` but the DSL engine does NOT support this function. This causes 8 zmanim to fail parsing.

**Affected Zmanim (8):**
- `alos_120_zmanis` - `proportional_minutes(120, before_sunrise)`
- `alos_72_zmanis` - `proportional_minutes(72, before_sunrise)`
- `alos_90_zmanis` - `proportional_minutes(90, before_sunrise)`
- `alos_96_zmanis` - `proportional_minutes(96, before_sunrise)`
- `tzais_120_zmanis` - `proportional_minutes(120, after_sunset)`
- `tzais_72_zmanis` - `proportional_minutes(72, after_sunset)`
- `tzais_90_zmanis` - `proportional_minutes(90, after_sunset)`
- `tzais_96_zmanis` - `proportional_minutes(96, after_sunset)`

### Implementation Tasks

#### Task 0.1: Add `proportional_minutes` to Functions Map
**File:** `/home/daniel/repos/zmanim/api/internal/dsl/token.go`

- [ ] Add `proportional_minutes` to the `Functions` map (line 173-179)

```go
var Functions = map[string]bool{
	"solar":                true,
	"seasonal_solar":       true,
	"proportional_hours":   true,
	"proportional_minutes": true, // ADD THIS LINE
	"midpoint":             true,
	"coalesce":             true,
}
```

#### Task 0.2: Implement `executeProportionalMinutes()`
**File:** `/home/daniel/repos/zmanim/api/internal/dsl/executor.go`

- [ ] Add `proportional_minutes` case to `executeFunction()` (around line 278)
- [ ] Implement `executeProportionalMinutes()` function

**Add to executeFunction() switch statement (line ~278):**
```go
case "proportional_minutes":
	return e.executeProportionalMinutes(n)
```

**New function (add after executeProportionalHours(), around line 581):**
```go
// executeProportionalMinutes evaluates proportional_minutes(minutes, direction)
// This calculates a proportional offset based on day length
// Examples:
//   proportional_minutes(72, before_sunrise) = sunrise - (day_length / 10)
//   proportional_minutes(120, after_sunset) = sunset + (day_length / 6)
func (e *Executor) executeProportionalMinutes(n *FunctionNode) Value {
	if len(n.Args) != 2 {
		e.addError("proportional_minutes() requires 2 arguments")
		return Value{}
	}

	// Get minutes (the reference value - e.g., 72, 90, 120)
	minutesVal := e.executeNode(n.Args[0])
	if minutesVal.Type != ValueTypeNumber {
		e.addError("proportional_minutes() first argument must be a number (minutes)")
		return Value{}
	}
	minutes := minutesVal.Number

	// Get direction
	var direction string
	switch arg := n.Args[1].(type) {
	case *DirectionNode:
		direction = arg.Direction
	case *StringNode:
		direction = arg.Value
	default:
		dirVal := e.executeNode(n.Args[1])
		direction = dirVal.String
	}

	// Calculate the proportional offset
	// The formula: minutes * (current_day_length / 720)
	// Where 720 = 12 hours (equinox day in minutes)
	// This scales the offset based on how much longer/shorter the current day is
	st := e.ctx.getSunTimes()
	dayLengthMinutes := st.DayLengthMinutes

	// Calculate proportional offset
	// For 72 minutes: fraction = 72/720 = 1/10 of day
	// For 90 minutes: fraction = 90/720 = 1/8 of day
	// For 120 minutes: fraction = 120/720 = 1/6 of day
	fraction := minutes / 720.0
	offsetMinutes := dayLengthMinutes * fraction

	var t time.Time
	switch direction {
	case "before_sunrise":
		// Subtract proportional minutes from sunrise
		t = astro.SubtractMinutes(st.Sunrise, offsetMinutes)
	case "after_sunset":
		// Add proportional minutes to sunset
		t = astro.AddMinutes(st.Sunset, offsetMinutes)
	default:
		e.addError("proportional_minutes() direction must be before_sunrise or after_sunset, got: %s", direction)
		return Value{}
	}

	if t.IsZero() {
		e.addError("could not calculate proportional_minutes(%g, %s)", minutes, direction)
		return Value{}
	}

	// Cache the result
	stepName := fmt.Sprintf("proportional_minutes(%.0f, %s)", minutes, direction)
	e.ctx.ZmanimCache[stepName] = t

	return Value{Type: ValueTypeTime, Time: t}
}
```

#### Task 0.3: Add Validation Rules
**File:** `/home/daniel/repos/zmanim/api/internal/dsl/validator.go`

- [ ] Add validation for `proportional_minutes` function in `validateFunction()`

**Find the switch statement in validateFunction() and add:**
```go
case "proportional_minutes":
	// Requires 2 arguments: (minutes, direction)
	if len(n.Args) != 2 {
		v.addError(n.Pos, "proportional_minutes() requires exactly 2 arguments")
		return
	}

	// First argument must be a number (minutes)
	v.validateNode(n.Args[0])
	if !v.isNumericExpression(n.Args[0]) {
		v.addError(n.Pos, "proportional_minutes() first argument must be a number")
	}

	// Second argument must be a direction
	if !v.isDirectionExpression(n.Args[1]) {
		v.addError(n.Pos, "proportional_minutes() second argument must be a direction (before_sunrise, after_sunset)")
	}
```

#### Task 0.4: Add Unit Tests
**File:** `/home/daniel/repos/zmanim/api/internal/dsl/executor_test.go`

- [ ] Add test cases for `proportional_minutes()`

**Add test cases:**
```go
func TestProportionalMinutes(t *testing.T) {
	// Test location: Lakewood, NJ on Dec 21 (winter solstice - short day)
	date := time.Date(2025, 12, 21, 0, 0, 0, 0, time.UTC)
	tz, _ := time.LoadLocation("America/New_York")
	ctx := NewExecutionContext(date, 40.0828, -74.2094, 0, tz)

	tests := []struct {
		name    string
		formula string
		wantErr bool
	}{
		{
			name:    "72 minutes before sunrise (proportional)",
			formula: "proportional_minutes(72, before_sunrise)",
			wantErr: false,
		},
		{
			name:    "90 minutes before sunrise (proportional)",
			formula: "proportional_minutes(90, before_sunrise)",
			wantErr: false,
		},
		{
			name:    "120 minutes before sunrise (proportional)",
			formula: "proportional_minutes(120, before_sunrise)",
			wantErr: false,
		},
		{
			name:    "72 minutes after sunset (proportional)",
			formula: "proportional_minutes(72, after_sunset)",
			wantErr: false,
		},
		{
			name:    "invalid direction",
			formula: "proportional_minutes(72, before_noon)",
			wantErr: true,
		},
		{
			name:    "missing arguments",
			formula: "proportional_minutes(72)",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ExecuteFormula(tt.formula, ctx)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if result.IsZero() {
					t.Errorf("expected non-zero time")
				}
			}
		})
	}
}

func TestProportionalMinutesVsFixed(t *testing.T) {
	// Verify that proportional minutes scales with day length
	tz, _ := time.LoadLocation("America/New_York")

	// Winter solstice (short day ~9 hours)
	winterDate := time.Date(2025, 12, 21, 0, 0, 0, 0, time.UTC)
	winterCtx := NewExecutionContext(winterDate, 40.0828, -74.2094, 0, tz)

	// Summer solstice (long day ~15 hours)
	summerDate := time.Date(2025, 6, 21, 0, 0, 0, 0, time.UTC)
	summerCtx := NewExecutionContext(summerDate, 40.0828, -74.2094, 0, tz)

	// Calculate 72 proportional minutes for both
	winterAlos, _ := ExecuteFormula("proportional_minutes(72, before_sunrise)", winterCtx)
	summerAlos, _ := ExecuteFormula("proportional_minutes(72, after_sunset)", summerCtx)

	// Get sunrise/sunset for comparison
	winterSunrise := winterCtx.getSunTimes().Sunrise
	summerSunset := summerCtx.getSunTimes().Sunset

	// Calculate actual offset in minutes
	winterOffset := winterSunrise.Sub(winterAlos).Minutes()
	summerOffset := summerAlos.Sub(summerSunset).Minutes()

	// In winter (short day), 72 proportional minutes should be LESS than 72 clock minutes
	// In summer (long day), 72 proportional minutes should be MORE than 72 clock minutes
	if winterOffset >= 72 {
		t.Errorf("winter proportional offset should be < 72 minutes, got %.1f", winterOffset)
	}
	if summerOffset <= 72 {
		t.Errorf("summer proportional offset should be > 72 minutes, got %.1f", summerOffset)
	}

	t.Logf("Winter (short day): 72 proportional = %.1f clock minutes", winterOffset)
	t.Logf("Summer (long day): 72 proportional = %.1f clock minutes", summerOffset)
}
```

#### Task 0.5: Run Tests and Verify
- [ ] Run DSL tests: `cd api && go test ./internal/dsl -v`
- [ ] Fix any compilation errors
- [ ] Ensure all tests pass
- [ ] Test with actual seed data formulas

**Validation Commands:**
```bash
cd api

# Run DSL tests
go test ./internal/dsl -v -run TestProportionalMinutes

# Build to check for compilation errors
go build ./cmd/api

# Test parsing the actual formulas from seed data
go test ./internal/dsl -v -run TestExecute
```

---

## Phase 1: Add Missing Shita Tag

### Task 1.1: Add `shita_machzikei_hadass` Tag

**Background:** The Manchester Machzikei Hadass calendar uses an asymmetric day definition (alos 12° to tzais 7.083°) which is referenced in multiple zmanim.

- [ ] Add INSERT statement to seed data or create migration

**SQL:**
```sql
INSERT INTO zman_tags (tag_key, name, display_name_hebrew, display_name_english_ashkenazi, tag_type_id, description, sort_order)
VALUES (
    'shita_machzikei_hadass',
    'Machzikei Hadass Manchester',
    'מחזיקי הדת מנצ׳סטר',
    'Machzikei Hadass Manchester',
    173, -- shita tag type
    'Asymmetric day calculation used by Manchester Machzikei Hadass calendar (alos 12° to tzais 7.083°)',
    40
);
```

- [ ] Verify tag was created: `SELECT * FROM zman_tags WHERE tag_key = 'shita_machzikei_hadass';`

---

## Phase 2: Audit ALL Existing Zmanim (172 entries)

For EACH zman in the registry, verify:
1. DSL formula parses correctly (no syntax errors)
2. DSL formula produces valid time for test date/location
3. Correct time_category_id assigned
4. Appropriate shita tags linked
5. Hebrew/English names are accurate
6. Description is complete

### Organization by Category

Categories from database:
```sql
SELECT id, category_name FROM time_categories ORDER BY id;
```

**Test Location:** Lakewood, NJ (40.0828, -74.2094)
**Test Date:** December 21, 2025 (winter solstice - good edge case)
**Test Date 2:** June 21, 2025 (summer solstice - verify seasonal formulas)

### Task 2.1: Alos/Dawn Zmanim (~18 entries)

Query to get all alos zmanim:
```sql
SELECT id, zman_key, canonical_english_name, default_formula_dsl, time_category_id
FROM master_zmanim_registry
WHERE zman_key LIKE 'alos%' OR zman_key LIKE '%dawn%'
ORDER BY zman_key;
```

For each entry:
- [ ] `alos_12` - Verify formula: `solar(12, before_sunrise)`
- [ ] `alos_16_1` - Verify formula: `solar(16.1, before_sunrise)`
- [ ] `alos_18` - Verify formula: `solar(18, before_sunrise)`
- [ ] `alos_19` - Verify formula: `solar(19, before_sunrise)`
- [ ] `alos_19_8` - Verify formula: `solar(19.8, before_sunrise)`
- [ ] `alos_26` - Verify formula: `solar(26, before_sunrise)`
- [ ] `alos_60` - Verify formula: `sunrise - 60min`
- [ ] `alos_72` - Verify formula: `sunrise - 72min`
- [ ] `alos_90` - Verify formula: `sunrise - 90min`
- [ ] `alos_96` - Verify formula: `sunrise - 96min`
- [ ] `alos_120` - Verify formula: `sunrise - 120min`
- [ ] `alos_72_zmanis` - Verify formula: `proportional_minutes(72, before_sunrise)` (REQUIRES PHASE 0)
- [ ] `alos_90_zmanis` - Verify formula: `proportional_minutes(90, before_sunrise)` (REQUIRES PHASE 0)
- [ ] `alos_96_zmanis` - Verify formula: `proportional_minutes(96, before_sunrise)` (REQUIRES PHASE 0)
- [ ] `alos_120_zmanis` - Verify formula: `proportional_minutes(120, before_sunrise)` (REQUIRES PHASE 0)
- [ ] `alos_baal_hatanya` - Verify formula and shita tag
- [ ] `alos_hashachar` - Verify if duplicate of alos_16_1
- [ ] `alos_shemini_atzeres` - Verify special case formula

**Validation SQL for each:**
```sql
-- Example for alos_72
SELECT id, zman_key, default_formula_dsl,
       (SELECT ARRAY_AGG(tag_key) FROM zman_tags zt
        JOIN publisher_zman_tags pzt ON zt.id = pzt.tag_id
        WHERE pzt.zman_id = mzr.id) as tags
FROM master_zmanim_registry mzr
WHERE zman_key = 'alos_72';
```

### Task 2.2: Misheyakir Zmanim (~5 entries)

- [ ] `misheyakir` - Verify formula and if it's same as `misheyakir_11_5`
- [ ] `misheyakir_7_65` - Verify formula: `solar(7.65, before_sunrise)`
- [ ] `misheyakir_9_5` - Verify formula: `solar(9.5, before_sunrise)`
- [ ] `misheyakir_10_2` - Verify formula: `solar(10.2, before_sunrise)`
- [ ] `misheyakir_11_5` - Verify formula: `solar(11.5, before_sunrise)`

### Task 2.3: Sunrise Zmanim (~5 entries)

- [ ] `sunrise` - Verify formula: `sunrise` (primitive)
- [ ] `visible_sunrise` - Verify if duplicate or different
- [ ] `netz` - Verify if alias of sunrise
- [ ] `netz_amitis` - Verify Baal Hatanya netz (might be missing)
- [ ] Check for other sunrise variants

### Task 2.4: Sof Zman Shema (~17 entries)

Query:
```sql
SELECT id, zman_key, canonical_english_name, default_formula_dsl
FROM master_zmanim_registry
WHERE zman_key LIKE '%shma%' OR zman_key LIKE '%shema%'
ORDER BY zman_key;
```

- [ ] `sof_zman_shma_gra` - Verify: `proportional_hours(3, gra)`
- [ ] `sof_zman_shma_mga` - Verify: `proportional_hours(3, mga)`
- [ ] `sof_zman_shma_mga_16_1` - Verify formula
- [ ] `sof_zman_shma_mga_18` - Verify formula
- [ ] `sof_zman_shma_mga_19_8` - Verify formula
- [ ] `sof_zman_shma_mga_72` - Verify formula
- [ ] `sof_zman_shma_mga_72_zmanis` - Verify formula
- [ ] `sof_zman_shma_mga_90` - Verify formula
- [ ] `sof_zman_shma_mga_90_zmanis` - Verify formula
- [ ] `sof_zman_shma_mga_96` - Verify formula
- [ ] `sof_zman_shma_mga_96_zmanis` - Verify formula
- [ ] `sof_zman_shma_mga_120` - Verify formula
- [ ] `sof_zman_shma_3_hours` - Verify: 3 hours before chatzos
- [ ] `sof_zman_shma_baal_hatanya` - Verify shita tag
- [ ] `sof_zman_shma_ateret_torah` - Verify shita tag
- [ ] Check for other variants

### Task 2.5: Sof Zman Tefila (~10 entries)

- [ ] `sof_zman_tfila_gra` - Verify: `proportional_hours(4, gra)`
- [ ] `sof_zman_tfila_mga` - Verify formula
- [ ] `sof_zman_tfila_mga_18` - Verify formula
- [ ] `sof_zman_tfila_mga_19_8` - Verify formula
- [ ] `sof_zman_tfila_mga_72_zmanis` - Verify formula
- [ ] `sof_zman_tfila_mga_90` - Verify formula
- [ ] `sof_zman_tfila_mga_90_zmanis` - Verify formula
- [ ] `sof_zman_tfila_mga_96` - Verify formula
- [ ] `sof_zman_tfila_mga_96_zmanis` - Verify formula
- [ ] `sof_zman_tfila_mga_120` - Verify formula
- [ ] `sof_zman_tfila_2_hours` - Verify: 2 hours before chatzos
- [ ] `sof_zman_tfila_baal_hatanya` - Verify shita tag
- [ ] `sof_zman_tfila_ateret_torah` - Verify shita tag

### Task 2.6: Chatzos/Midday Zmanim (~5 entries)

- [ ] `chatzos` - Verify: `solar_noon` (primitive)
- [ ] `chatzos_layla` - Verify: solar midnight
- [ ] `fixed_local_chatzos` - Verify if implemented
- [ ] Check for other variants

### Task 2.7: Mincha Gedola (~9 entries)

- [ ] `mincha_gedola` - Verify: `proportional_hours(6.5, gra)` or `chatzos + 30min`
- [ ] `mincha_gedola_30` - Verify: `chatzos + 30min`
- [ ] `mincha_gedola_16_1` - Verify formula
- [ ] `mincha_gedola_72` - Verify formula
- [ ] `mincha_gedola_baal_hatanya` - Verify shita tag
- [ ] `mincha_gedola_ateret_torah` - Verify shita tag
- [ ] Check for "greater than 30" variant (should be added)

### Task 2.8: Mincha Ketana (~6 entries)

- [ ] `mincha_ketana` - Verify: `proportional_hours(9.5, gra)`
- [ ] `mincha_ketana_16_1` - Verify formula
- [ ] `mincha_ketana_72` - Verify formula
- [ ] `mincha_ketana_baal_hatanya` - Verify shita tag
- [ ] `mincha_ketana_ateret_torah` - Verify shita tag

### Task 2.9: Samuch LeMincha Ketana (~3 entries)

- [ ] `samuch_lmincha_ketana` - Verify formula
- [ ] `samuch_lmincha_ketana_16_1` - Verify formula
- [ ] `samuch_lmincha_ketana_72` - Verify formula

### Task 2.10: Plag HaMincha (~15 entries)

Query:
```sql
SELECT id, zman_key, canonical_english_name, default_formula_dsl
FROM master_zmanim_registry
WHERE zman_key LIKE '%plag%'
ORDER BY zman_key;
```

- [ ] `plag_hamincha` - Verify: `proportional_hours(10.75, gra)`
- [ ] `plag_hamincha_16_1` - Verify formula
- [ ] `plag_hamincha_18` - Verify formula
- [ ] `plag_hamincha_19_8` - Verify formula
- [ ] `plag_hamincha_26` - Verify formula
- [ ] `plag_hamincha_60` - Verify formula
- [ ] `plag_hamincha_72` - Verify formula
- [ ] `plag_hamincha_90` - Verify formula
- [ ] `plag_hamincha_96` - Verify formula
- [ ] `plag_hamincha_120` - Verify formula
- [ ] `plag_hamincha_baal_hatanya` - Verify shita tag
- [ ] `plag_hamincha_ateret_torah` - Verify shita tag
- [ ] `plag_hamincha_terumas_hadeshen` - Verify unique formula
- [ ] Check for zmaniyos variants (missing - should be added)

### Task 2.11: Sunset Zmanim (~5 entries)

- [ ] `sunset` - Verify: `sunset` (primitive)
- [ ] `visible_sunset` - Verify if duplicate
- [ ] `shkia` - Verify if alias
- [ ] `shkia_amitis` - Verify Baal Hatanya variant
- [ ] Check for other sunset variants

### Task 2.12: Bein Hashmashos (~10 entries)

- [ ] `bein_hashmashos_start` - Verify: `sunset`
- [ ] `bein_hashmashos_rt_13_24` - Verify RT formula
- [ ] `bein_hashmashos_rt_58_5` - Verify: 58.5 minutes
- [ ] `bein_hashmashos_rt_2_stars` - Verify formula
- [ ] `bein_hashmashos_yereim_13_5` - Verify: 13.5 min before sunset
- [ ] `bein_hashmashos_yereim_16_875` - Verify: 16.875 min
- [ ] `bein_hashmashos_yereim_18` - Verify: 18 min
- [ ] `bein_hashmashos_yereim_2_1` - Verify: `solar(2.1, before_sunset)`
- [ ] `bein_hashmashos_yereim_2_8` - Verify formula
- [ ] `bein_hashmashos_yereim_3_05` - Verify formula

### Task 2.13: Tzais/Nightfall (~35 entries)

Query:
```sql
SELECT id, zman_key, canonical_english_name, default_formula_dsl
FROM master_zmanim_registry
WHERE zman_key LIKE 'tzais%'
ORDER BY zman_key;
```

Check all tzais entries (time-based, degree-based, zmaniyos, Geonim variants):
- [ ] `tzais` - Verify default (8.5°)
- [ ] `tzais_3_stars` - Verify if same as 8.5°
- [ ] All degree-based (3.65°, 3.676°, 3.7°, 3.8°, 4.37°, 4.61°, 4.8°, 5.88°, 5.95°, 6°, 6.45°, 7.08°, 7.083°, 7.67°, 8.5°, 9.3°, 9.75°, 13.5°, 18°, 19.8°, 26°)
- [ ] All time-based (20, 42, 50, 60, 72, 90, 96, 120 minutes)
- [ ] All zmaniyos (72, 90, 96, 120 proportional - REQUIRES PHASE 0)
- [ ] `tzais_baal_hatanya` - Verify shita tag
- [ ] `tzais_ateret_torah` - Verify shita tag
- [ ] **MISSING:** `tzais_16_1` (should be added in Phase 3)

### Task 2.14: Candle Lighting (~10 entries)

- [ ] `candle_lighting` - Verify default (18 min before sunset)
- [ ] `candle_lighting_15` - Verify: `sunset - 15min`
- [ ] `candle_lighting_18` - Verify: `sunset - 18min`
- [ ] `candle_lighting_20` - Verify: `sunset - 20min`
- [ ] `candle_lighting_22` - Verify: `sunset - 22min`
- [ ] `candle_lighting_30` - Verify: `sunset - 30min`
- [ ] `candle_lighting_40` - Verify: `sunset - 40min` (Jerusalem)
- [ ] Check for other variants

### Task 2.15: Havdalah (~10 entries)

- [ ] `havdalah` - Verify default (usually tzais)
- [ ] `havdalah_42` - Verify: `sunset + 42min`
- [ ] `havdalah_50` - Verify: `sunset + 50min`
- [ ] `havdalah_60` - Verify: `sunset + 60min`
- [ ] `havdalah_72` - Verify: `sunset + 72min`
- [ ] Degree-based havdalah variants
- [ ] Check for RT havdalah

### Task 2.16: Special Zmanim (~30 entries)

Including:
- [ ] Kiddush Levana (3 days, 7 days, 15 days, between moldos)
- [ ] Chametz times (achilas, biur - GRA, MGA variants, Baal Hatanya)
- [ ] Shaos zmaniyos calculators
- [ ] Other special calculations

### Task 2.17: Create Audit Script

**File:** `/home/daniel/repos/zmanim/scripts/audit-registry.sh`

```bash
#!/bin/bash
# Audit all zmanim in master registry
# Tests DSL parsing and execution for each zman

set -e

source api/.env

echo "=== Master Zmanim Registry Audit ==="
echo "Date: $(date)"
echo ""

# Test location: Lakewood, NJ
LAT=40.0828
LON=-74.2094
DATE="2025-12-21"

echo "Test Location: Lakewood, NJ ($LAT, $LON)"
echo "Test Date: $DATE (Winter Solstice)"
echo ""

# Get count
TOTAL=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM master_zmanim_registry;")
echo "Total zmanim in registry: $TOTAL"
echo ""

# Test each zman
echo "Testing DSL formulas..."
psql "$DATABASE_URL" -c "
SELECT
    id,
    zman_key,
    canonical_english_name,
    default_formula_dsl,
    CASE
        WHEN default_formula_dsl IS NULL THEN 'NO FORMULA'
        ELSE 'OK'
    END as status
FROM master_zmanim_registry
ORDER BY id;
" | tee audit-results.txt

echo ""
echo "Audit complete. Results saved to audit-results.txt"
```

- [ ] Create script
- [ ] Make executable: `chmod +x scripts/audit-registry.sh`
- [ ] Run: `./scripts/audit-registry.sh`
- [ ] Review results and fix issues

---

## Phase 3: Add High Priority Missing Zmanim (2)

### Task 3.1: Add `tzais_16_1`

**Why:** This is a common degree equivalent of 72 minutes, frequently requested.

- [ ] Create SQL INSERT

```sql
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    transliteration,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES (
    'tzais_16_1',
    'צאת הכוכבים 16.1 מעלות',
    'Nightfall (16.1°)',
    'Tzais Hakochavim (16.1°)',
    'Nightfall when sun is 16.1° below horizon (equivalent to 72 minutes at equinox in Jerusalem)',
    271, -- tzais category
    'solar(16.1, after_sunset)',
    true
);
```

- [ ] Link to appropriate tags (event_maariv, event_end_shabbat, shita_mga)
- [ ] Test formula execution
- [ ] Verify in UI

### Task 3.2: Add `sunrise_baal_hatanya` (Netz Amiti)

**Why:** Baal Hatanya uses a unique sunrise definition (1.583° below horizon) for ALL his zmanim.

- [ ] Create SQL INSERT

```sql
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    transliteration,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES (
    'sunrise_baal_hatanya',
    'נץ אמיתי',
    'Sunrise (Baal HaTanya)',
    'Netz Amiti',
    'True sunrise per Baal HaTanya when sun is 1.583° below horizon (first light on mountain peaks)',
    266, -- sunrise category
    'solar(1.583, before_sunrise)',
    true
);
```

- [ ] Link to shita_baal_hatanya tag
- [ ] Test formula execution
- [ ] Verify against KosherJava output

---

## Phase 4: Add Medium Priority Missing Zmanim (8)

### Task 4.1: Plag Zmaniyos Variants (4 zmanim)

- [ ] `plag_hamincha_72_zmanis`
- [ ] `plag_hamincha_90_zmanis`
- [ ] `plag_hamincha_96_zmanis`
- [ ] `plag_hamincha_120_zmanis`

**SQL Template:**
```sql
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    transliteration,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES
('plag_hamincha_72_zmanis', 'פלג המנחה 72 דקות זמניות', 'Plag HaMincha (72 Zmaniyos)', 'Plag HaMincha (72 Zmaniyos)', 'Plag HaMincha using MGA 72 zmaniyos day', 269, 'proportional_hours(10.75, mga_72_zmanis)', false),
('plag_hamincha_90_zmanis', 'פלג המנחה 90 דקות זמניות', 'Plag HaMincha (90 Zmaniyos)', 'Plag HaMincha (90 Zmaniyos)', 'Plag HaMincha using MGA 90 zmaniyos day', 269, 'proportional_hours(10.75, mga_90_zmanis)', false),
('plag_hamincha_96_zmanis', 'פלג המנחה 96 דקות זמניות', 'Plag HaMincha (96 Zmaniyos)', 'Plag HaMincha (96 Zmaniyos)', 'Plag HaMincha using MGA 96 zmaniyos day', 269, 'proportional_hours(10.75, mga_96_zmanis)', false),
('plag_hamincha_120_zmanis', 'פלג המנחה 120 דקות זמניות', 'Plag HaMincha (120 Zmaniyos)', 'Plag HaMincha (120 Zmaniyos)', 'Plag HaMincha using MGA 120 zmaniyos day', 269, 'proportional_hours(10.75, mga_120_zmanis)', false);
```

### Task 4.2: Manchester Asymmetric Plag

- [ ] `plag_hamincha_manchester`

**Note:** Requires `custom()` base support in DSL or special asymmetric calculation.

```sql
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    transliteration,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES (
    'plag_hamincha_manchester',
    'פלג המנחה מנצ׳סטר',
    'Plag HaMincha (Manchester)',
    'Plag HaMincha (Machzikei Hadass Manchester)',
    'Plag HaMincha using asymmetric day (alos 16.1° to tzais 7.083°) per Manchester calendar',
    269,
    'proportional_hours(10.75, custom(solar(16.1, before_sunrise), solar(7.083, after_sunset)))',
    false
);
```

- [ ] Link to shita_machzikei_hadass tag

### Task 4.3: Kol Eliyahu Shma

- [ ] `sof_zman_shma_kol_eliyahu`

**Note:** Need to research exact formula from KosherJava.

### Task 4.4: Mincha Gedola Greater Than 30

- [ ] `mincha_gedola_greater_than_30`

**Note:** This uses logic to pick the later of two times. May require `max()` function in DSL or conditional.

```sql
-- Placeholder - may need DSL enhancement
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES (
    'mincha_gedola_greater_than_30',
    'מנחה גדולה המאוחר',
    'Earliest Mincha (Later of 30 min)',
    'Earliest mincha - the later of GRA calculation or 30 minutes after chatzos',
    268,
    'if (proportional_hours(6.5, gra) < chatzos + 30min) { chatzos + 30min } else { proportional_hours(6.5, gra) }',
    false
);
```

### Task 4.5: Asymmetric Shma (Alos to Sunset)

- [ ] `sof_zman_shma_alos_to_sunset`

```sql
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    description,
    time_category_id,
    default_formula_dsl,
    is_core
) VALUES (
    'sof_zman_shma_alos_to_sunset',
    'סוף זמן קריאת שמע (עלות עד שקיעה)',
    'Latest Shema (Alos to Sunset)',
    'Latest time for Shema using asymmetric day from alos 16.1° to sunset',
    267,
    'proportional_hours(3, custom(solar(16.1, before_sunrise), sunset))',
    false
);
```

---

## Phase 5: Add Low Priority Missing Zmanim (5)

### Task 5.1: Ahavat Shalom Variants (3)

**Note:** Need to research Ahavat Shalom day definition before implementing.

- [ ] `mincha_gedola_ahavat_shalom`
- [ ] `mincha_ketana_ahavat_shalom`
- [ ] `plag_hamincha_ahavat_shalom`

### Task 5.2: Fixed Local Chatzos Variants (2)

**Note:** Requires implementation of fixed local mean time calculation.

- [ ] `sof_zman_shma_fixed_local`
- [ ] `sof_zman_tfila_fixed_local`

---

## Phase 6: Final Validation

### Task 6.1: Run All DSL Tests

- [ ] `cd api && go test ./internal/dsl -v`
- [ ] Fix any failing tests
- [ ] Ensure 100% pass rate

### Task 6.2: Verify All Zmanim Have Valid Formulas

```sql
-- Find zmanim with NULL formulas
SELECT id, zman_key, canonical_english_name
FROM master_zmanim_registry
WHERE default_formula_dsl IS NULL
ORDER BY zman_key;

-- Count by formula type
SELECT
    CASE
        WHEN default_formula_dsl LIKE 'solar(%' THEN 'solar'
        WHEN default_formula_dsl LIKE 'proportional_hours(%' THEN 'proportional_hours'
        WHEN default_formula_dsl LIKE 'proportional_minutes(%' THEN 'proportional_minutes'
        WHEN default_formula_dsl LIKE '%sunrise%' THEN 'fixed_time'
        WHEN default_formula_dsl LIKE '%sunset%' THEN 'fixed_time'
        ELSE 'other'
    END as formula_type,
    COUNT(*) as count
FROM master_zmanim_registry
WHERE default_formula_dsl IS NOT NULL
GROUP BY formula_type
ORDER BY count DESC;
```

- [ ] All zmanim have formulas (except possibly special cases)
- [ ] Formula type distribution looks correct

### Task 6.3: Check All Tag Associations

```sql
-- Zmanim with no tags
SELECT mzr.id, mzr.zman_key, mzr.canonical_english_name
FROM master_zmanim_registry mzr
LEFT JOIN publisher_zman_tags pzt ON mzr.id = pzt.zman_id
WHERE pzt.id IS NULL
ORDER BY mzr.zman_key;

-- Tag type distribution
SELECT
    tt.key as tag_type,
    COUNT(DISTINCT pzt.zman_id) as zmanim_count
FROM publisher_zman_tags pzt
JOIN zman_tags zt ON pzt.tag_id = zt.id
JOIN tag_types tt ON zt.tag_type_id = tt.id
GROUP BY tt.key
ORDER BY zmanim_count DESC;
```

- [ ] All core zmanim have appropriate tags
- [ ] Shita tags are correctly assigned
- [ ] Event tags are correctly assigned

### Task 6.4: Test Sample Zmanim in UI

- [ ] Start services: `./restart.sh`
- [ ] Navigate to zmanim UI: http://localhost:3001
- [ ] Test GRA shema calculation
- [ ] Test MGA shema calculation
- [ ] Test Baal Hatanya zmanim
- [ ] Test tzais variants
- [ ] Verify times look reasonable

### Task 6.5: Run CI Checks Locally

```bash
./scripts/validate-ci-checks.sh
```

- [ ] All checks pass
- [ ] No TODO/FIXME in new code
- [ ] No linting errors
- [ ] All tests pass

### Task 6.6: Performance Test

```sql
-- Test calculation speed for all zmanim
EXPLAIN ANALYZE
SELECT
    zman_key,
    default_formula_dsl
FROM master_zmanim_registry
WHERE default_formula_dsl IS NOT NULL;
```

- [ ] Query executes in reasonable time (<100ms)
- [ ] No obvious performance issues

### Task 6.7: Documentation Update

- [ ] Update `/home/daniel/repos/zmanim/docs/master-registry-gap-analysis.md` with completion status
- [ ] Create `/home/daniel/repos/zmanim/docs/registry-completion-summary.md` with before/after stats
- [ ] Update any relevant API documentation

---

## Validation Queries

### Query 1: Count by Category
```sql
SELECT
    tc.id,
    tc.category_name_en,
    COUNT(mzr.id) as zmanim_count
FROM time_categories tc
LEFT JOIN master_zmanim_registry mzr ON tc.id = mzr.time_category_id
GROUP BY tc.id, tc.category_name_en
ORDER BY tc.id;
```

### Query 2: Formula Type Distribution
```sql
SELECT
    CASE
        WHEN default_formula_dsl IS NULL THEN 'NO FORMULA'
        WHEN default_formula_dsl LIKE 'solar(%' THEN 'Degree-based'
        WHEN default_formula_dsl LIKE 'proportional_hours(%' THEN 'Shaos Zmaniyos'
        WHEN default_formula_dsl LIKE 'proportional_minutes(%' THEN 'Proportional Minutes'
        WHEN default_formula_dsl ~ '^(sunrise|sunset|solar_noon)' THEN 'Primitive'
        WHEN default_formula_dsl LIKE '%+%' OR default_formula_dsl LIKE '%-%' THEN 'Fixed Offset'
        ELSE 'Other'
    END as formula_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM master_zmanim_registry), 1) as percentage
FROM master_zmanim_registry
GROUP BY formula_type
ORDER BY count DESC;
```

### Query 3: Shita Tag Coverage
```sql
SELECT
    zt.tag_key,
    zt.name,
    COUNT(DISTINCT pzt.zman_id) as zmanim_count
FROM zman_tags zt
JOIN tag_types tt ON zt.tag_type_id = tt.id
LEFT JOIN publisher_zman_tags pzt ON zt.id = pzt.tag_id
WHERE tt.key = 'shita'
GROUP BY zt.tag_key, zt.name
ORDER BY zmanim_count DESC;
```

### Query 4: Find Duplicates
```sql
-- Find zmanim with identical formulas (potential duplicates)
SELECT
    default_formula_dsl,
    COUNT(*) as count,
    STRING_AGG(zman_key, ', ') as zman_keys
FROM master_zmanim_registry
WHERE default_formula_dsl IS NOT NULL
GROUP BY default_formula_dsl
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

---

## Success Criteria

### Phase 0 Complete When:
- [x] `proportional_minutes()` function added to DSL
- [x] All 8 zmaniyos zmanim parse successfully
- [x] Unit tests pass
- [x] Seed data loads without errors

### Phase 1 Complete When:
- [x] `shita_machzikei_hadass` tag exists in database
- [x] Tag has correct metadata

### Phase 2 Complete When:
- [x] All 172 zmanim have been audited
- [x] All formulas parse correctly
- [x] All formulas produce valid times for test cases
- [x] All zmanim have correct category assignments
- [x] All zmanim have appropriate tags
- [x] Audit results documented

### Phase 3 Complete When:
- [x] `tzais_16_1` added and tested
- [x] `sunrise_baal_hatanya` added and tested
- [x] Both produce correct results

### Phase 4 Complete When:
- [x] 4 plag zmaniyos variants added
- [x] Manchester plag added
- [x] Kol Eliyahu shma added
- [x] Mincha gedola greater-than-30 added
- [x] Asymmetric shma added
- [x] All formulas tested

### Phase 5 Complete When:
- [x] Ahavat Shalom variants added (if formula determined)
- [x] Fixed local chatzos variants added (if implemented)

### Phase 6 Complete When:
- [x] All DSL tests pass
- [x] All zmanim have valid formulas
- [x] All tags are correctly assigned
- [x] UI displays all zmanim correctly
- [x] CI checks pass
- [x] Performance is acceptable
- [x] Documentation updated

---

## Final Checklist

- [ ] Phase 0: DSL Enhancement complete
- [ ] Phase 1: Missing shita tag added
- [ ] Phase 2: All 172 zmanim audited
- [ ] Phase 3: 2 high-priority zmanim added
- [ ] Phase 4: 8 medium-priority zmanim added
- [ ] Phase 5: 5 low-priority zmanim added (if feasible)
- [ ] Phase 6: Final validation complete
- [ ] Total zmanim count: 187+ (172 + 15 new)
- [ ] All formulas parse and execute correctly
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Ready for production deployment

---

## Appendix A: SQL Example Scripts

### Script A.1: Add New Zman with Tags

```sql
-- Example: Add a new zman with full metadata and tags

-- 1. Insert the zman
INSERT INTO master_zmanim_registry (
    zman_key,
    canonical_hebrew_name,
    canonical_english_name,
    transliteration,
    description,
    halachic_source,
    time_category_id,
    default_formula_dsl,
    is_core,
    is_hidden
) VALUES (
    'example_zman',
    'דוגמה',
    'Example Zman',
    'Dugma',
    'This is an example zman for demonstration',
    'Based on opinion X in source Y',
    267, -- category ID
    'solar(16.1, before_sunrise)',
    false,
    false
) RETURNING id;

-- 2. Link to tags (use the returned ID from above)
INSERT INTO publisher_zman_tags (publisher_id, zman_id, tag_id)
SELECT
    1, -- publisher ID
    <ZMAN_ID>, -- from above
    id
FROM zman_tags
WHERE tag_key IN ('shita_mga', 'event_shacharit');
```

### Script A.2: Validate Formula Syntax

```sql
-- Check for potential formula syntax issues
SELECT
    id,
    zman_key,
    default_formula_dsl,
    CASE
        WHEN default_formula_dsl IS NULL THEN 'Missing formula'
        WHEN default_formula_dsl NOT LIKE '%(%' AND default_formula_dsl NOT IN ('sunrise', 'sunset', 'solar_noon', 'solar_midnight') THEN 'Possibly invalid'
        ELSE 'OK'
    END as status
FROM master_zmanim_registry
WHERE default_formula_dsl IS NOT NULL
ORDER BY status DESC, zman_key;
```

### Script A.3: Tag Association Report

```sql
-- Generate tag association report
SELECT
    mzr.zman_key,
    mzr.canonical_english_name,
    STRING_AGG(zt.tag_key, ', ' ORDER BY zt.tag_key) as tags
FROM master_zmanim_registry mzr
LEFT JOIN publisher_zman_tags pzt ON mzr.id = pzt.zman_id
LEFT JOIN zman_tags zt ON pzt.tag_id = zt.id
GROUP BY mzr.id, mzr.zman_key, mzr.canonical_english_name
ORDER BY mzr.zman_key;
```

---

## Appendix B: Testing Commands

### Test DSL Parsing
```bash
cd api

# Test specific formula
go test ./internal/dsl -v -run TestParse

# Test execution
go test ./internal/dsl -v -run TestExecute

# Test proportional_minutes specifically
go test ./internal/dsl -v -run TestProportionalMinutes
```

### Test Database Queries
```bash
source api/.env

# Count zmanim by category
psql "$DATABASE_URL" -c "
SELECT tc.category_name_en, COUNT(mzr.id)
FROM time_categories tc
LEFT JOIN master_zmanim_registry mzr ON tc.id = mzr.time_category_id
GROUP BY tc.category_name_en
ORDER BY tc.category_name_en;
"

# Find zmanim with no formula
psql "$DATABASE_URL" -c "
SELECT zman_key, canonical_english_name
FROM master_zmanim_registry
WHERE default_formula_dsl IS NULL;
"
```

### Test Full Stack
```bash
# Start all services
./restart.sh

# View logs
tmux attach -t zmanim
# Press Ctrl+B then 0 for API logs
# Press Ctrl+B then 1 for Web logs
# Press Ctrl+B then D to detach

# Test API endpoint
curl -s "http://localhost:8080/api/v1/zmanim?locality_id=4993250&date=2025-12-21" | jq '.'

# Run CI checks
./scripts/validate-ci-checks.sh
```

---

**End of Implementation Plan**

This plan provides a comprehensive, step-by-step approach to completing and validating the master zmanim registry. Each phase builds on the previous one, with clear success criteria and validation steps.
