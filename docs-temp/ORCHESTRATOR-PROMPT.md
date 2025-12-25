# Orchestrator Prompt: Eliminate Hardcoded Event Logic

**Model**: Use `sonnet` model for all sub-agents

## Mission
Make the zmanim event filtering system 100% tag-driven by removing ALL hardcoded category flags (`ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd`).

## Context
The codebase currently has hardcoded event filtering logic scattered across handlers and services. This violates the tag-driven architecture where ALL filtering should be based on:
1. **Zman tags** (stored in `zman_tags` table with event/jewish_day types)
2. **Active event codes** (calendar-derived list like `["erev_shabbos", "chanukah"]`)

## The Problem
Search the codebase for these hardcoded fields and eliminate them:
- `ShowCandleLighting`
- `ShowHavdalah`
- `ShowFastStart`
- `ShowFastEnd`

These fields exist in:
1. `api/internal/calendar/events.go` (line 456) - `ZmanimContext` struct
2. `api/internal/services/zmanim_service.go` (line ~733) - `DayContext` struct (**DELETE THIS ENTIRE STRUCT**)
3. `api/internal/handlers/publisher_zmanim.go` (line ~108) - `DayContext` struct (remove Show* fields only, keep display fields)
4. Service filtering logic that maps category tags to these boolean flags (line ~753 in zmanim_service.go)

## Important: TWO Different DayContext Structs

### 1. Handler DayContext - `/api/internal/handlers/publisher_zmanim.go` (line ~108)
**Purpose**: JSON response to frontend with display information
**Action**: KEEP but remove `Show*` filtering fields

```go
// ❌ CURRENT (WRONG) - has filtering fields mixed with display:
type DayContext struct {
    Date                string        `json:"date"`
    HebrewDate          string        `json:"hebrew_date"`
    Holidays            []HolidayInfo `json:"holidays"`
    ActiveEventCodes    []string      `json:"active_event_codes"`
    ShowCandleLighting  bool          `json:"show_candle_lighting"`  // ❌ REMOVE
    ShowHavdalah        bool          `json:"show_havdalah"`         // ❌ REMOVE
    ShowFastStart       bool          `json:"show_fast_start"`       // ❌ REMOVE
    ShowFastEnd         bool          `json:"show_fast_end"`         // ❌ REMOVE
}

// ✅ CORRECTED - only display fields, no filtering:
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
    ActiveEventCodes    []string      `json:"active_event_codes"` // For frontend display only
    SpecialContexts     []string      `json:"special_contexts"`
}
```

### 2. Service DayContext - `/api/internal/services/zmanim_service.go` (line ~733)
**Purpose**: Internal filtering wrapper (UNNECESSARY)
**Action**: DELETE ENTIRELY - use `[]string` directly instead

```go
// ❌ CURRENT (WRONG) - Delete this entire struct:
type DayContext struct {
    ShowCandleLighting bool
    ShowHavdalah       bool
    ShowFastStart      bool
    ShowFastEnd        bool
    ActiveEventCodes   []string
}

// ✅ CORRECTED - No struct needed, use []string directly:
// (Just delete the struct, use []string in CalculateParams)
type CalculateParams struct {
    LocalityID         int64
    PublisherID        int32
    Date               time.Time
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    ActiveEventCodes   []string // ✅ Direct, no wrapper struct
}

// ✅ Change function signature:
// BEFORE: func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, dayCtx DayContext) bool
// AFTER:  func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool
```

### Summary
- **2 structs, 2 different files, 2 different purposes**
- **Handler struct** = Keep (for JSON response) but remove `Show*` fields
- **Service struct** = Delete entirely (use `[]string` instead)

## Your Tasks

### 1. Verify the Problem
Run these searches to confirm hardcoded logic exists:
```bash
grep -r "ShowCandleLighting" api/internal/
grep -r "ShowHavdalah" api/internal/
grep -r "ShowFastStart" api/internal/
grep -r "ShowFastEnd" api/internal/
grep -r "categoryFlagMap" api/internal/
```

### 2. Execute the Fix
Follow the detailed plan in `PLAN-eliminate-hardcoded-event-logic.md` to:

**Step A: Simplify Calendar Service**
- File: `/api/internal/calendar/events.go`
- Remove `Show*` fields from `ZmanimContext`
- Keep ONLY `ActiveEventCodes []string`

**Step B: Simplify Service DayContext**
- File: `/api/internal/services/zmanim_service.go`
- Remove `Show*` fields from `DayContext` struct (line ~733)
- Remove `categoryFlagMap` from `ShouldShowZman()` (line ~753)
- Change `CalculateParams.DayContext *DayContext` to `ActiveEventCodes []string` (line ~93)
- Update filtering logic (line ~313) to use `ActiveEventCodes` directly

**Step C: Simplify Handler DayContext**
- File: `/api/internal/handlers/publisher_zmanim.go`
- Remove `Show*` fields from handler `DayContext` struct (line ~120-123)
- Update service calls to pass `ActiveEventCodes` instead of full `DayContext`
- **CRITICAL**: Remove ALL post-calculation filtering:
  - Delete `shouldShowZman()` function (line ~1116-1140)
  - Delete filtering at line ~368, ~588, ~1076

**Step D: Update Other Handlers**
- File: `/api/internal/handlers/zmanim.go`
- Update to pass `ActiveEventCodes` to service

### 3. Verify the Fix
After making changes, run these verification checks:

```bash
# Should return ZERO results for each:
grep -r "ShowCandleLighting" api/internal/
grep -r "ShowHavdalah" api/internal/
grep -r "ShowFastStart" api/internal/
grep -r "ShowFastEnd" api/internal/
grep -r "categoryFlagMap" api/internal/
grep -r "shouldShowZman" api/internal/handlers/

# Should show filtering happens in service, not handler:
grep -A 10 "Apply calendar context filtering" api/internal/services/zmanim_service.go
```

### 4. Test the Fix
Verify event zmanim display correctly:

**Test 1: Candle Lighting**
```bash
# Friday (erev_shabbos in ActiveEventCodes)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("candle"))'
# Expected: Shows candle lighting zman

# Wednesday (no erev_shabbos)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("candle"))'
# Expected: Does NOT show candle lighting
```

**Test 2: Havdalah**
```bash
# Saturday (motzei_shabbos in ActiveEventCodes)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-27&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("havdalah"))'
# Expected: Shows havdalah zman

# Friday (no motzei_shabbos)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("havdalah"))'
# Expected: Does NOT show havdalah
```

### 5. Build and Restart
```bash
cd /home/daniel/repos/zmanim/api && go build ./cmd/api
```

**Note**: If you get build error about `pz.Tags` type assertion, the issue is that `pz.Tags` is `interface{}` from SQL JSON. You need to marshal it to JSON bytes first, then unmarshal to struct:
```go
// WRONG:
json.Unmarshal(pz.Tags, &tags)

// CORRECT:
tagsBytes, err := json.Marshal(pz.Tags)
if err == nil {
    json.Unmarshal(tagsBytes, &tags)
}
```

Then restart services:
```bash
cd /home/daniel/repos/zmanim && ./restart.sh
```

## Success Criteria
✅ Zero occurrences of `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd` in `api/internal/`
✅ Zero occurrences of `categoryFlagMap` in codebase
✅ Zero occurrences of `shouldShowZman` in handler files
✅ `DayContext` structs have ONLY `ActiveEventCodes` for filtering (can have other display fields)
✅ Filtering happens in `zmanim_service.go` BEFORE calculation (line ~311-324)
✅ Handler does NOT filter after calculation
✅ Tests pass: candle lighting shows Friday, not Wednesday; havdalah shows Saturday, not Friday

## Anti-Patterns to Reject
If you see ANY of these patterns, they are WRONG and must be removed:
```go
❌ if dayCtx.ShowCandleLighting { ... }
❌ ShowHavdalah: zmanimCtx.ShowHavdalah
❌ categoryFlagMap := map[string]bool{ "category_candle_lighting": ... }
❌ isActiveToday := h.shouldShowZman(...)
❌ if !isActiveToday { continue }  // in handler AFTER calculation
```

## Correct Patterns
```go
✅ ActiveEventCodes: []string{"erev_shabbos", "chanukah"}
✅ if sliceContains(dayCtx.ActiveEventCodes, tag.TagKey) { ... }
✅ // Filtering in SERVICE before calculation:
   if len(params.ActiveEventCodes) > 0 {
       if !s.ShouldShowZman(tags, dayCtx) { continue }
   }
```

## Reference
Full implementation details in: `/home/daniel/repos/zmanim/PLAN-eliminate-hardcoded-event-logic.md`

---

**CRITICAL**: Do NOT create new hardcoded mappings. The ONLY filtering mechanism is: check if event tag's key exists in `ActiveEventCodes` array. That's it. Nothing else.
