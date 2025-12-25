# PLAN: Eliminate ALL Hardcoded Event Logic - Make 100% Tag-Driven

**Status**: Ready for Review
**Created**: 2025-12-24
**Problem**: Event zmanim logic is scattered across handlers with hardcoded fields like `ShowCandleLighting`, `ShowHavdalah`, etc. This violates the tag-driven architecture.

---

## Problem Statement

### Current (WRONG) Approach
1. **Hardcoded category flags** in `DayContext`:
   - `ShowCandleLighting` (hardcoded)
   - `ShowHavdalah` (hardcoded)
   - `ShowFastStart` (hardcoded)
   - `ShowFastEnd` (hardcoded)

2. **Hardcoded mapping** in `zmanim_service.go`:
   ```go
   categoryFlagMap := map[string]bool{
       "category_candle_lighting": dayCtx.ShowCandleLighting,
       "category_havdalah":        dayCtx.ShowHavdalah,
       "category_fast_start":      dayCtx.ShowFastStart,
       "category_fast_end":        dayCtx.ShowFastEnd,
   }
   ```

3. **Logic scattered across**:
   - `api/internal/handlers/publisher_zmanim.go` - creates DayContext with hardcoded fields
   - `api/internal/handlers/zmanim.go` - uses hardcoded fields
   - `api/internal/services/zmanim_service.go` - hardcoded category mapping
   - `api/internal/calendar/*.go` - generates hardcoded flags

### Correct (Tag-Driven) Approach
**ONLY** these two pieces of information should exist:
1. **`ActiveEventCodes`** - List of event codes active today (e.g., `["erev_shabbos", "chanukah", "fast_gedaliah"]`)
2. **Zman tags** - Each zman has tags (stored in `zman_tags` table)

**Filtering rule**:
- If zman has tag `event:erev_shabbos` → show only if `"erev_shabbos"` in `ActiveEventCodes`
- If zman has tag `category_candle_lighting` → this is just metadata for the category system, NOT filtering
- Tag negation: `event:erev_shabbos (negated=true)` → hide if `"erev_shabbos"` in `ActiveEventCodes`

---

## Root Cause Analysis

### Where Hardcoded Logic Exists

#### 1. `/api/internal/calendar/events.go`
**Line ~200-400**: Hardcoded functions that return boolean flags:
```go
func (s *CalendarService) GetZmanimContext(...) *ZmanimContext {
    return &ZmanimContext{
        ShowCandleLighting: ..., // HARDCODED
        ShowHavdalah: ...,       // HARDCODED
        ShowFastStarts: ...,     // HARDCODED
        ShowFastEnds: ...,       // HARDCODED
        ActiveEventCodes: [...], // CORRECT - keep this
    }
}
```

**FIX**: Remove all `Show*` fields. Only return `ActiveEventCodes`.

#### 2. `/api/internal/handlers/publisher_zmanim.go`
**Lines 108-125**: `DayContext` struct has hardcoded fields:
```go
type DayContext struct {
    // ... other fields ...
    ShowCandleLighting  bool     // REMOVE
    ShowHavdalah        bool     // REMOVE
    ShowFastStart       bool     // REMOVE
    ShowFastEnd         bool     // REMOVE
    ActiveEventCodes    []string // KEEP - this is correct
}
```

**Lines 324-340**: Building DayContext with hardcoded assignments:
```go
dayCtx := DayContext{
    ShowCandleLighting: zmanimCtx.ShowCandleLighting, // REMOVE
    ShowHavdalah:       zmanimCtx.ShowHavdalah,       // REMOVE
    ShowFastStart:      zmanimCtx.ShowFastStarts,     // REMOVE
    ShowFastEnd:        zmanimCtx.ShowFastEnds,       // REMOVE
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes,   // KEEP
}
```

**Lines 368-373, 588-592, 1076-1078**: Handler calls `shouldShowZman()` to filter:
```go
isActiveToday := h.shouldShowZman(metadata, dayCtx)
if !isActiveToday && !includeInactive {
    continue
}
```

**FIX**: Don't filter in handler. Pass `ActiveEventCodes` to service, service filters before calculation.

#### 3. `/api/internal/services/zmanim_service.go`
**Lines 733-758**: Hardcoded category flag map:
```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, dayCtx DayContext) bool {
    categoryFlagMap := map[string]bool{
        "category_candle_lighting": dayCtx.ShowCandleLighting, // HARDCODED
        "category_havdalah":        dayCtx.ShowHavdalah,       // HARDCODED
        "category_fast_start":      dayCtx.ShowFastStart,      // HARDCODED
        "category_fast_end":        dayCtx.ShowFastEnd,        // HARDCODED
    }
    // ...
}
```

**FIX**: Remove category flag checking entirely. Only check event/jewish_day tags against `ActiveEventCodes`.

#### 4. `/api/internal/handlers/zmanim.go`
Uses the same hardcoded `DayContext` pattern.

---

## Solution Architecture

### New Flow (100% Tag-Driven)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HANDLER: Get Calendar Context                               │
│    - Input: date, timezone, latitude, longitude                │
│    - Output: ActiveEventCodes []string                          │
│    - Source: calendar.GetActiveEventCodes(date, tz, lat, lon)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. HANDLER: Call Service with Context                          │
│    zmanimService.CalculateZmanim(ctx, CalculateParams{          │
│        PublisherID: 2,                                          │
│        LocalityID: 4993250,                                     │
│        Date: date,                                              │
│        ActiveEventCodes: ["erev_shabbos", "chanukah"],         │
│    })                                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. SERVICE: Filter Zmanim Before Calculation                   │
│    for each zman in publisher_zmanim:                          │
│        if zman has event/jewish_day tags:                      │
│            check if ANY tag.key in ActiveEventCodes            │
│            if negated tag matches → skip zman                   │
│            if positive tag doesn't match → skip zman            │
│        → only calculate zmanim that pass filter                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SERVICE: Calculate Filtered Zmanim                          │
│    - Execute DSL formulas for filtered zmanim only             │
│    - Return CalculationResult with times                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. HANDLER: Return Results (NO FILTERING)                      │
│    - Service already filtered based on tags + event codes      │
│    - Handler just returns what service calculated              │
└─────────────────────────────────────────────────────────────────┘
```

### Tag Examples (Reference)

**Candle Lighting Zman**:
```sql
-- Tags for hadlakas_neiros:
event:erev_shabbos          (negated: false)  -- Show on Friday
event:erev_yom_tov          (negated: false)  -- Show before Yom Tov
```
**Result**: Shows when `ActiveEventCodes` contains `"erev_shabbos"` OR `"erev_yom_tov"`

**Havdalah Zman**:
```sql
-- Tags for havdalah:
event:motzei_shabbos        (negated: false)  -- Show after Shabbos
event:motzei_yom_tov        (negated: false)  -- Show after Yom Tov
```
**Result**: Shows when `ActiveEventCodes` contains `"motzei_shabbos"` OR `"motzei_yom_tov"`

**Mincha (NOT event-specific)**:
```sql
-- Tags for mincha_gedola:
(no event tags)
```
**Result**: Always shows (no event filtering)

---

## Implementation Tasks

### Task 1: Update Calendar Service
**File**: `/api/internal/calendar/events.go`

**Changes**:
1. Remove `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStarts`, `ShowFastEnds` fields from `ZmanimContext` struct
2. Keep only `ActiveEventCodes []string`
3. Simplify `GetZmanimContext()` to only populate `ActiveEventCodes` based on calendar events

**Before**:
```go
type ZmanimContext struct {
    ShowCandleLighting bool
    ShowHavdalah       bool
    ShowFastStarts     bool
    ShowFastEnds       bool
    ActiveEventCodes   []string
}
```

**After**:
```go
type ZmanimContext struct {
    ActiveEventCodes []string // ONLY field needed
}
```

### Task 2: Update Service DayContext
**File**: `/api/internal/services/zmanim_service.go`

**Changes**:
1. Remove all hardcoded fields from `DayContext` struct (lines 733-740)
2. Keep only `ActiveEventCodes []string`
3. Remove hardcoded `categoryFlagMap` from `ShouldShowZman()` (lines 753-758)
4. Only check event/jewish_day tags against `ActiveEventCodes`

**Before**:
```go
type DayContext struct {
    ShowCandleLighting bool
    ShowHavdalah       bool
    ShowFastStart      bool
    ShowFastEnd        bool
    ActiveEventCodes   []string
}
```

**After**:
```go
type DayContext struct {
    ActiveEventCodes []string // ONLY field needed
}
```

**Before** (ShouldShowZman):
```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, dayCtx DayContext) bool {
    // Map category tags to their corresponding visibility flags
    categoryFlagMap := map[string]bool{
        "category_candle_lighting": dayCtx.ShowCandleLighting,
        "category_havdalah":        dayCtx.ShowHavdalah,
        "category_fast_start":      dayCtx.ShowFastStart,
        "category_fast_end":        dayCtx.ShowFastEnd,
    }

    // Check category tags
    for _, tag := range tags {
        if tag.TagType != "category" {
            continue
        }
        if shouldShow, exists := categoryFlagMap[tag.TagKey]; exists {
            if !shouldShow {
                return false
            }
        }
    }

    // Check event/jewish_day tags...
}
```

**After** (ShouldShowZman):
```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, dayCtx DayContext) bool {
    // ONLY check event/jewish_day tags against ActiveEventCodes
    // NO category checking - categories are for sorting, not filtering

    eventTags := s.getEventAndJewishDayTags(tags)
    if len(eventTags) == 0 {
        return true // No event tags = always show
    }

    hasPositiveMatch := false
    hasNegativeMatch := false

    for _, tag := range eventTags {
        isActive := s.sliceContainsString(dayCtx.ActiveEventCodes, tag.TagKey)
        if tag.IsNegated {
            if isActive {
                hasNegativeMatch = true
            }
        } else {
            if isActive {
                hasPositiveMatch = true
            }
        }
    }

    // If negated tag matches, hide regardless
    if hasNegativeMatch {
        return false
    }

    // If there are positive tags but none match, hide
    hasPositiveTags := false
    for _, tag := range eventTags {
        if !tag.IsNegated {
            hasPositiveTags = true
            break
        }
    }
    if hasPositiveTags && !hasPositiveMatch {
        return false
    }

    return true
}
```

### Task 3: Update CalculateParams
**File**: `/api/internal/services/zmanim_service.go`

**Changes**:
1. Change `DayContext *DayContext` to `ActiveEventCodes []string` (simpler)

**Before**:
```go
type CalculateParams struct {
    LocalityID         int64
    PublisherID        int32
    Date               time.Time
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    DayContext         *DayContext // Complex struct
}
```

**After**:
```go
type CalculateParams struct {
    LocalityID         int64
    PublisherID        int32
    Date               time.Time
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    ActiveEventCodes   []string // Simple list
}
```

### Task 4: Update Service Filtering Logic
**File**: `/api/internal/services/zmanim_service.go` (lines 311-324)

**Changes**:
1. Replace `params.DayContext != nil` check with `len(params.ActiveEventCodes) > 0`
2. Pass `ActiveEventCodes` directly to `ShouldShowZman`

**Before**:
```go
if params.DayContext != nil {
    var tags []EventFilterTag
    if err := json.Unmarshal(pz.Tags, &tags); err != nil {
        slog.Error("failed to unmarshal tags", "zman_key", pz.ZmanKey, "error", err)
    } else {
        if !s.ShouldShowZman(tags, *params.DayContext) {
            continue
        }
    }
}
```

**After**:
```go
if len(params.ActiveEventCodes) > 0 {
    var tags []EventFilterTag
    if err := json.Unmarshal(pz.Tags, &tags); err != nil {
        slog.Error("failed to unmarshal tags", "zman_key", pz.ZmanKey, "error", err)
    } else {
        dayCtx := DayContext{ActiveEventCodes: params.ActiveEventCodes}
        if !s.ShouldShowZman(tags, dayCtx) {
            continue
        }
    }
}
```

### Task 5: Update Handler DayContext
**File**: `/api/internal/handlers/publisher_zmanim.go`

**Changes**:
1. Remove all hardcoded boolean fields from handler's `DayContext` struct (lines 108-125)
2. Keep only `ActiveEventCodes []string` for filtering
3. Keep display fields (`Date`, `HebrewDate`, `Holidays`, etc.) for response JSON

**Before**:
```go
type DayContext struct {
    Date                string        `json:"date"`
    DayOfWeek           int           `json:"day_of_week"`
    DayName             string        `json:"day_name"`
    HebrewDate          string        `json:"hebrew_date"`
    HebrewDateFormatted string        `json:"hebrew_date_formatted"`
    IsErevShabbos       bool          `json:"is_erev_shabbos"`
    IsShabbos           bool          `json:"is_shabbos"`
    IsYomTov            bool          `json:"is_yom_tov"`
    IsFastDay           bool          `json:"is_fast_day"`
    Holidays            []HolidayInfo `json:"holidays"`
    ActiveEventCodes    []string      `json:"active_event_codes"`
    ShowCandleLighting  bool          `json:"show_candle_lighting"`  // REMOVE
    ShowHavdalah        bool          `json:"show_havdalah"`         // REMOVE
    ShowFastStart       bool          `json:"show_fast_start"`       // REMOVE
    ShowFastEnd         bool          `json:"show_fast_end"`         // REMOVE
    SpecialContexts     []string      `json:"special_contexts"`
}
```

**After**:
```go
type DayContext struct {
    Date                string        `json:"date"`
    DayOfWeek           int           `json:"day_of_week"`
    DayName             string        `json:"day_name"`
    HebrewDate          string        `json:"hebrew_date"`
    HebrewDateFormatted string        `json:"hebrew_date_formatted"`
    IsErevShabbos       bool          `json:"is_erev_shabbos"`
    IsShabbos           bool          `json:"is_shabbos"`
    IsYomTov            bool          `json:"is_yom_tov"`
    IsFastDay           bool          `json:"is_fast_day"`
    Holidays            []HolidayInfo `json:"holidays"`
    ActiveEventCodes    []string      `json:"active_event_codes"` // ONLY filtering field
    SpecialContexts     []string      `json:"special_contexts"`
}
```

### Task 6: Update Handler Service Calls
**Files**:
- `/api/internal/handlers/publisher_zmanim.go` (lines 252-259)
- `/api/internal/handlers/zmanim.go` (lines 461-467)

**Changes**:
1. Get `ActiveEventCodes` from calendar service
2. Pass directly to `CalculateParams.ActiveEventCodes`
3. Remove all post-calculation filtering (`shouldShowZman` calls at lines 368, 588, 1076)

**Before**:
```go
// Line 252
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:         localityID,
    PublisherID:        publisherIDInt32,
    Date:               date,
    IncludeDisabled:    includeDisabled,
    IncludeUnpublished: includeUnpublished,
    IncludeBeta:        true,
})

// Lines 305-340: Build complex DayContext with hardcoded fields
zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)
dayCtx := DayContext{
    ShowCandleLighting: zmanimCtx.ShowCandleLighting,
    ShowHavdalah:       zmanimCtx.ShowHavdalah,
    ShowFastStart:      zmanimCtx.ShowFastStarts,
    ShowFastEnd:        zmanimCtx.ShowFastEnds,
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes,
}

// Lines 368-373: Filter AFTER calculation (inefficient)
isActiveToday := h.shouldShowZman(metadata, dayCtx)
if !isActiveToday && !includeInactive {
    continue
}
```

**After**:
```go
// Get calendar context BEFORE calculation
zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)

// Pass ActiveEventCodes to service - service filters BEFORE calculation
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:         localityID,
    PublisherID:        publisherIDInt32,
    Date:               date,
    IncludeDisabled:    includeDisabled,
    IncludeUnpublished: includeUnpublished,
    IncludeBeta:        true,
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes, // Service filters using this
})

// Build DayContext for response JSON (NO filtering fields)
dayCtx := DayContext{
    Date:                dateStr,
    DayOfWeek:           int(dateInTz.Weekday()),
    DayName:             dayNames[dateInTz.Weekday()],
    HebrewDate:          hebrewDate.Formatted,
    HebrewDateFormatted: hebrewDate.Hebrew,
    IsErevShabbos:       dateInTz.Weekday() == time.Friday,
    IsShabbos:           dateInTz.Weekday() == time.Saturday,
    IsYomTov:            isYomTov,
    IsFastDay:           zmanimCtx.ShowFastStarts || zmanimCtx.ShowFastEnds,
    Holidays:            holidayInfos,
    ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
}

// NO MORE POST-FILTERING - service already did it
// Just use calcResult.Zmanim directly
```

### Task 7: Remove shouldShowZman from Handler
**File**: `/api/internal/handlers/publisher_zmanim.go`

**Changes**:
1. DELETE `shouldShowZman()` function entirely (lines 1116-1140)
2. Remove all calls to `shouldShowZman()` (lines 368, 588, 1076)

**Reason**: Service now handles ALL filtering. Handler should NOT filter.

---

## Testing Checklist

After implementing all changes, verify:

### ✅ Candle Lighting Display
- [ ] Friday before Shabbos → candle lighting shows
- [ ] Wednesday (not erev anything) → candle lighting does NOT show
- [ ] Erev Yom Tov → candle lighting shows
- [ ] Motzei Shabbos → candle lighting does NOT show

### ✅ Havdalah Display
- [ ] Motzei Shabbos → havdalah shows
- [ ] Friday → havdalah does NOT show
- [ ] Motzei Yom Tov → havdalah shows
- [ ] Tuesday → havdalah does NOT show

### ✅ Fast Day Zmanim
- [ ] Fast day → fast start/end show
- [ ] Non-fast day → fast start/end do NOT show

### ✅ Regular Zmanim
- [ ] Shacharit → always shows (no event tags)
- [ ] Mincha → always shows (no event tags)
- [ ] Chatzos → always shows (no event tags)

### ✅ Weekly PDF
- [ ] Event zmanim section appears on Friday (candle lighting)
- [ ] Event zmanim section appears on Saturday (havdalah)
- [ ] Event zmanim section empty on Wednesday

### ✅ Algorithm Page Preview
- [ ] Live preview on Friday shows candle lighting
- [ ] Live preview on Wednesday does NOT show candle lighting

---

## Files to Modify Summary

| File | Lines | Changes |
|------|-------|---------|
| `/api/internal/calendar/events.go` | ~200-400 | Remove `Show*` fields from `ZmanimContext`, keep only `ActiveEventCodes` |
| `/api/internal/services/zmanim_service.go` | 84-94 | Change `CalculateParams.DayContext` to `CalculateParams.ActiveEventCodes` |
| `/api/internal/services/zmanim_service.go` | 311-324 | Update filtering to use `ActiveEventCodes` directly |
| `/api/internal/services/zmanim_service.go` | 733-813 | Remove `Show*` fields from `DayContext`, simplify `ShouldShowZman()` |
| `/api/internal/handlers/publisher_zmanim.go` | 108-125 | Remove `Show*` fields from handler `DayContext` |
| `/api/internal/handlers/publisher_zmanim.go` | 252-259 | Pass `ActiveEventCodes` to service, remove DayContext param |
| `/api/internal/handlers/publisher_zmanim.go` | 324-340 | Simplify `DayContext` construction |
| `/api/internal/handlers/publisher_zmanim.go` | 368-373 | DELETE post-calculation filtering |
| `/api/internal/handlers/publisher_zmanim.go` | 588-592 | DELETE post-calculation filtering |
| `/api/internal/handlers/publisher_zmanim.go` | 1076-1078 | DELETE post-calculation filtering |
| `/api/internal/handlers/publisher_zmanim.go` | 1116-1140 | DELETE `shouldShowZman()` function entirely |
| `/api/internal/handlers/zmanim.go` | 461-467 | Pass `ActiveEventCodes` to service |

---

## Success Criteria

1. **Zero hardcoded category flags** - `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd` do not exist anywhere
2. **Single source of truth** - `ActiveEventCodes` is the ONLY filtering mechanism
3. **Service-side filtering** - Handler does NOT filter after calculation
4. **Tag-driven** - All event display logic determined by tags in `zman_tags` table
5. **Tests pass** - All scenarios in testing checklist pass

---

## Anti-Patterns to Avoid

❌ **DON'T**: Create new hardcoded category mappings
✅ **DO**: Use event tags and `ActiveEventCodes`

❌ **DON'T**: Filter in handlers after calculation
✅ **DO**: Filter in service before calculation

❌ **DON'T**: Add boolean flags for specific event types
✅ **DO**: Add event codes to `ActiveEventCodes` array

❌ **DON'T**: Check `IsShabbos` or `IsYomTov` for filtering
✅ **DO**: Check if `"erev_shabbos"` in `ActiveEventCodes`

---

## Review Questions for Orchestrator

1. **Are there ANY hardcoded category flags remaining?**
   - Search for: `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd`
   - Expected: 0 results

2. **Is filtering happening in the service BEFORE calculation?**
   - Check: `zmanim_service.go` line ~311-324
   - Expected: Filter loop before `formulas[pz.ZmanKey] = pz.FormulaDsl`

3. **Is handler doing ANY post-calculation filtering?**
   - Search for: `shouldShowZman` calls in handlers
   - Expected: 0 results

4. **Does `DayContext` only have `ActiveEventCodes` for filtering?**
   - Check: `services.DayContext` struct
   - Expected: Only 1 field: `ActiveEventCodes []string`

5. **Are category tags used ONLY for sorting, not filtering?**
   - Check: `ShouldShowZman()` implementation
   - Expected: NO checks for `category_*` tags

---

## Migration Notes

This is a **breaking change** for any code that:
- Uses `ShowCandleLighting`, `ShowHavdalah`, etc. fields
- Calls `shouldShowZman()` in handlers
- Expects `DayContext` to have hardcoded flags

**Mitigation**: These are all internal APIs, no external impact.

---

**END OF PLAN**
