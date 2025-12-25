# Tag-Driven Architecture Design
## The Complete Elimination of Hardcoded Event Logic

**Date**: 2025-12-24
**Status**: Design Document
**Principle**: "HebCal says what events are active → Use DSL + matching event tags → Decide which zmanim are relevant to that day. NO other logic should exist anywhere."

---

## Table of Contents

1. [The Goal](#the-goal)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Database Structure](#database-structure)
5. [Flow Design](#flow-design)
6. [Tag Matching Algorithm](#tag-matching-algorithm)
7. [What to Delete](#what-to-delete)
8. [What to Modify](#what-to-modify)
9. [Implementation Checklist](#implementation-checklist)

---

## The Goal

**Single Rule**: Event zmanim visibility is determined ENTIRELY by matching tags against active event codes from HebCal. No hardcoded category logic, no special-casing, no boolean flags.

### The Pure Tag-Driven Flow

```
HebCal API
    ↓ Returns event names
Calendar Service (events.go)
    ↓ Normalizes to event codes
Handler
    ↓ Passes ActiveEventCodes
ZmanimService
    ↓ Filters zmanim by tag matching
DSL Executor
    ↓ Calculates ONLY matching zmanim
Response
```

---

## Current State Analysis

### What EXISTS (Database - Correct)

**Table: `zman_tags`**
```sql
CREATE TABLE zman_tags (
    id integer PRIMARY KEY,
    tag_key varchar(50) NOT NULL,           -- e.g., "shabbos", "erev_pesach", "category_candle_lighting"
    tag_type_id integer NOT NULL,           -- FK to tag_types (event, jewish_day, category, etc.)
    display_name_hebrew text NOT NULL,
    display_name_english_ashkenazi text NOT NULL,
    display_name_english_sephardi text,
    hebcal_basename varchar(100),           -- e.g., "Shavuot" for direct matching
    ...
);
```

**Table: `tag_event_mappings`**
```sql
CREATE TABLE tag_event_mappings (
    id integer PRIMARY KEY,
    tag_id integer NOT NULL,                -- FK to zman_tags
    hebcal_event_pattern varchar(100),     -- e.g., "Rosh Hashana%", "Pesach I"
    hebrew_month integer,                   -- Alternative: Hebrew date matching
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,
    ...
);
```

**Junction: `publisher_zman_tags`**
```sql
CREATE TABLE publisher_zman_tags (
    publisher_zman_id integer NOT NULL,     -- FK to publisher_zmanim
    tag_id integer NOT NULL,                -- FK to zman_tags
    is_negated boolean DEFAULT false,       -- For exclusion rules
    created_at timestamptz NOT NULL,
    PRIMARY KEY (publisher_zman_id, tag_id)
);
```

**Examples from Seed Data**:
```sql
-- Tag #278: rosh_hashanah
-- Mapping: "Rosh Hashana%" → tag_id=278

-- Tag #34: erev_yom_kippur
-- Mapping: "Yom Kippur" → tag_id=34

-- Tag #155: category_candle_lighting (metadata tag)
-- Tag #156: category_havdalah (metadata tag)
```

### What EXISTS (Code - WRONG)

#### ❌ Hardcoded Boolean Flags
**File**: `api/internal/calendar/events.go` (line ~454-510)
```go
type ZmanimContext struct {
    ShowCandleLighting bool     // ← HARDCODED
    ShowHavdalah       bool     // ← HARDCODED
    ShowFastStarts     bool     // ← HARDCODED
    ShowFastEnds       bool     // ← HARDCODED
    ActiveEventCodes   []string // ← CORRECT (but drowned in noise)
}
```

#### ❌ Hardcoded Category Mappings
**File**: `api/internal/services/zmanim_service.go` (line ~753-758)
```go
categoryFlagMap := map[string]bool{
    "category_candle_lighting": dayCtx.ShowCandleLighting, // ← WRONG
    "category_havdalah":        dayCtx.ShowHavdalah,       // ← WRONG
    "category_fast_start":      dayCtx.ShowFastStart,      // ← WRONG
    "category_fast_end":        dayCtx.ShowFastEnd,        // ← WRONG
}
```

#### ❌ Post-Calculation Filtering
**File**: `api/internal/handlers/publisher_zmanim.go` (lines 368, 588, 1076)
```go
// Service calculates ALL zmanim, then handler filters afterward
isActiveToday := h.shouldShowZman(metadata, dayCtx)
if !isActiveToday && !includeInactive {
    continue // ← INEFFICIENT: Already calculated wastefully
}
```

#### ❌ Hardcoded Event Type Checking
**File**: `api/internal/calendar/events.go` (lines 426-438)
```go
func isYomTovEvent(code string) bool {
    yomTovCodes := map[string]bool{
        "rosh_hashanah":   true,
        "yom_kippur":      true,
        "sukkos":          true,
        // ... hardcoded list
    }
    return yomTovCodes[code]
}
```

---

## Target Architecture

### Layer 1: HebCal Integration

**Purpose**: Convert HebCal API responses to normalized event codes

**File**: `api/internal/calendar/hebcal.go`

**Current Implementation** (Partially Correct):
```go
// HebCal returns: "Rosh Hashana I", "Pesach II", "Shavuot", etc.
type HebCalEvent struct {
    Title    string `json:"title"`    // "Rosh Hashana I"
    Category string `json:"category"` // "holiday", "fast", etc.
    Hebrew   string `json:"hebrew"`
    Date     string `json:"date"`
}
```

**What It Should Return**:
```go
type ActiveEventCodes []string
// Example Friday: ["erev_shabbos", "chanukah_night_3"]
// Example Saturday: ["shabbos", "motzei_shabbos", "chanukah_day_3"]
```

**Normalization Rules**:
1. **String Matching via `tag_event_mappings`**:
   - HebCal: `"Rosh Hashana I"` → Pattern: `"Rosh Hashana%"` → Tag: `rosh_hashanah`
   - HebCal: `"Pesach VII"` → Pattern: `"Pesach VII"` → Tag: `pesach_last`
   - HebCal: `"Shavuot"` → Pattern: `"Shavuot%"` → Tag: `shavuos`

2. **Day-of-Week Rules**:
   - Friday → Add `"erev_shabbos"`
   - Saturday → Add `"shabbos"` + `"motzei_shabbos"`

3. **Multi-Day Events**:
   - Chanukah Day 3 → Add both `"chanukah"` AND `"chanukah_day_3"`

4. **Erev/Motzei Detection**:
   - Tomorrow is Yom Tov → Add `"erev_[yom_tov_code]"`
   - Today is Yom Tov ending → Add `"motzei_[yom_tov_code]"`

### Layer 2: Calendar Service

**Purpose**: Query HebCal and return ONLY normalized event codes

**File**: `api/internal/calendar/events.go`

**What to DELETE**:
```go
// DELETE ALL OF THESE:
type ZmanimContext struct {
    ShowCandleLighting bool     // ❌ DELETE
    ShowHavdalah       bool     // ❌ DELETE
    ShowFastStarts     bool     // ❌ DELETE
    ShowFastEnds       bool     // ❌ DELETE
    // ... other display fields are fine
}

// ❌ DELETE THESE FUNCTIONS:
func isYomTovEvent(code string) bool { ... }
func isFastEvent(code string) bool { ... }
```

**What to KEEP**:
```go
type ZmanimContext struct {
    ActiveEventCodes []string `json:"active_event_codes"` // ✅ ONLY THIS
    // Display-only fields (for JSON response metadata):
    DisplayContexts  []string `json:"display_contexts"`
    IsShabbat        bool     `json:"is_shabbat"`
    IsYomTov         bool     `json:"is_yomtov"`
    IsFastDay        bool     `json:"is_fast_day"`
    // ... other metadata OK
}
```

**New Implementation**:
```go
func (s *CalendarService) GetZmanimContext(date time.Time, loc Location, transliterationStyle string) ZmanimContext {
    // Step 1: Get HebCal events
    hebcalEvents := s.getHebcalEvents(date)

    // Step 2: Load tag mappings from database
    mappings := s.loadTagEventMappings(ctx)

    // Step 3: Match events to tags using database patterns
    eventCodes := s.matchEventsToTags(hebcalEvents, mappings)

    // Step 4: Add day-of-week codes
    if date.Weekday() == time.Friday {
        eventCodes = appendUnique(eventCodes, "erev_shabbos")
    }
    if date.Weekday() == time.Saturday {
        eventCodes = appendUnique(eventCodes, "shabbos")
        eventCodes = appendUnique(eventCodes, "motzei_shabbos")
    }

    // Step 5: Add erev/motzei codes for tomorrow's events
    tomorrow := date.AddDate(0, 0, 1)
    tomorrowEvents := s.getHebcalEvents(tomorrow)
    tomorrowCodes := s.matchEventsToTags(tomorrowEvents, mappings)
    for _, code := range tomorrowCodes {
        eventCodes = appendUnique(eventCodes, "erev_"+code)
    }

    return ZmanimContext{
        ActiveEventCodes: eventCodes,
        // ... populate display fields for response JSON
    }
}
```

**Pattern Matching**:
```go
func (s *CalendarService) matchEventsToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
    matched := make(map[string]bool)

    for _, event := range events {
        for _, mapping := range mappings {
            // SQL LIKE pattern matching
            if matchPattern(event.Title, mapping.HebcalEventPattern) {
                // Get tag_key from mapping.TagID
                tag := s.getTagByID(mapping.TagID)
                matched[tag.TagKey] = true
            }
        }
    }

    // Convert to slice
    result := make([]string, 0, len(matched))
    for tagKey := range matched {
        result = append(result, tagKey)
    }
    return result
}

func matchPattern(title, pattern string) bool {
    // Handle SQL LIKE wildcards (% = any chars)
    // "Rosh Hashana%" matches "Rosh Hashana I", "Rosh Hashana II"
    // "Pesach I" matches exactly "Pesach I"

    if !strings.Contains(pattern, "%") {
        return title == pattern // Exact match
    }

    // Convert SQL LIKE to Go matching
    parts := strings.Split(pattern, "%")
    switch len(parts) {
    case 2:
        if parts[0] == "" {
            return strings.HasSuffix(title, parts[1])
        }
        if parts[1] == "" {
            return strings.HasPrefix(title, parts[0])
        }
        return strings.HasPrefix(title, parts[0]) && strings.HasSuffix(title, parts[1])
    default:
        // Complex pattern - implement full SQL LIKE
        return matchSQLLike(title, pattern)
    }
}
```

### Layer 3: Handler

**Purpose**: Get event codes from calendar, pass to service

**File**: `api/internal/handlers/publisher_zmanim.go`

**What to DELETE**:
```go
// ❌ DELETE: Post-calculation filtering
isActiveToday := h.shouldShowZman(metadata, dayCtx)
if !isActiveToday && !includeInactive {
    continue
}

// ❌ DELETE: Entire function
func (h *PublisherHandler) shouldShowZman(metadata PublisherZmanMetadata, dayCtx DayContext) bool {
    // ... DELETE ALL THIS
}
```

**What to KEEP/MODIFY**:
```go
// ✅ CORRECT: Get calendar context
zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)

// ✅ CORRECT: Pass to service (service filters BEFORE calculation)
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:       localityID,
    PublisherID:      publisherIDInt32,
    Date:             date,
    ActiveEventCodes: zmanimCtx.ActiveEventCodes, // ← Service handles filtering
})

// ✅ CORRECT: Build DayContext for response JSON (NO filtering fields)
dayCtx := DayContext{
    Date:             dateStr,
    HebrewDate:       hebrewDate.Formatted,
    ActiveEventCodes: zmanimCtx.ActiveEventCodes, // For frontend display
    // ... other display fields
    // NO ShowCandleLighting, ShowHavdalah, etc.
}
```

### Layer 4: Zmanim Service

**Purpose**: Filter zmanim by tag matching, THEN calculate

**File**: `api/internal/services/zmanim_service.go`

**What to DELETE**:
```go
// ❌ DELETE: Hardcoded category map
categoryFlagMap := map[string]bool{
    "category_candle_lighting": dayCtx.ShowCandleLighting,
    "category_havdalah":        dayCtx.ShowHavdalah,
    "category_fast_start":      dayCtx.ShowFastStart,
    "category_fast_end":        dayCtx.ShowFastEnd,
}

// ❌ DELETE: Category checking logic
for _, tag := range tags {
    if tag.TagType == "category" {
        if shouldShow, exists := categoryFlagMap[tag.TagKey]; exists {
            if !shouldShow {
                return false
            }
        }
    }
}
```

**What to KEEP/MODIFY**:
```go
type CalculateParams struct {
    LocalityID         int64
    PublisherID        int32
    Date               time.Time
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    ActiveEventCodes   []string // ✅ Simple list, no DayContext struct needed
}

// ✅ CORRECT: Filter logic (event/jewish_day tags ONLY)
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // ONLY check event and jewish_day tags
    eventTags := []EventFilterTag{}
    for _, tag := range tags {
        if tag.TagType == "event" || tag.TagType == "jewish_day" {
            eventTags = append(eventTags, tag)
        }
    }

    // No event tags = always show (regular zmanim like sunrise, mincha)
    if len(eventTags) == 0 {
        return true
    }

    // Check positive and negated tags
    hasPositiveMatch := false
    hasNegativeMatch := false

    for _, tag := range eventTags {
        isActive := sliceContains(activeEventCodes, tag.TagKey)

        if tag.IsNegated {
            if isActive {
                hasNegativeMatch = true // Negated tag matched = hide
            }
        } else {
            if isActive {
                hasPositiveMatch = true // Positive tag matched = show
            }
        }
    }

    // Negated tags take precedence
    if hasNegativeMatch {
        return false
    }

    // If has positive tags but none match, hide
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

---

## Database Structure

### Core Tables (Already Exist - Correct)

```sql
-- Tag definitions
zman_tags (
    id, tag_key, tag_type_id, display_name_*, hebcal_basename
)

-- Tag types (event, jewish_day, category, etc.)
tag_types (
    id, key, display_name_*, description
)

-- Mapping HebCal event names to tags
tag_event_mappings (
    id, tag_id, hebcal_event_pattern, priority
)

-- Zman → Tag associations
publisher_zman_tags (
    publisher_zman_id, tag_id, is_negated
)
```

### Sample Data Flow

**HebCal Input**:
```json
{
  "title": "Rosh Hashana I",
  "category": "holiday",
  "date": "2025-09-23"
}
```

**Pattern Matching** (via `tag_event_mappings`):
```sql
SELECT t.tag_key
FROM tag_event_mappings tem
JOIN zman_tags t ON tem.tag_id = t.id
WHERE 'Rosh Hashana I' LIKE tem.hebcal_event_pattern
ORDER BY tem.priority DESC
LIMIT 1;

-- Result: tag_key = 'rosh_hashanah'
```

**Zman Tags** (via `publisher_zman_tags`):
```sql
-- Zman: hadlakas_neiros (candle lighting)
SELECT t.tag_key, pzt.is_negated
FROM publisher_zman_tags pzt
JOIN zman_tags t ON pzt.tag_id = t.id
WHERE pzt.publisher_zman_id = 123;

-- Results:
-- tag_key='erev_shabbos', is_negated=false
-- tag_key='erev_yom_tov', is_negated=false
```

**Filtering Logic**:
```
ActiveEventCodes = ['rosh_hashanah', 'erev_rosh_hashanah']
Zman: hadlakas_neiros has tags: ['erev_shabbos', 'erev_yom_tov']

Check: 'erev_shabbos' in ActiveEventCodes? NO
Check: 'erev_yom_tov' in ActiveEventCodes? NO (we have 'erev_rosh_hashanah')

Result: HIDE (no tag matches)
```

**Issue Found**: We need better erev handling!

---

## Tag Matching Algorithm

### The Complete Algorithm

```go
func (s *ZmanimService) ShouldShowZman(
    zmanTags []EventFilterTag,
    activeEventCodes []string,
) bool {
    // STEP 1: Filter to event/jewish_day tags ONLY
    // Category tags (category_*) are for sorting/grouping, NOT filtering
    eventTags := s.filterEventTags(zmanTags)

    // STEP 2: No event tags = always show (regular zmanim)
    if len(eventTags) == 0 {
        return true
    }

    // STEP 3: Check negated tags first (exclusions take precedence)
    for _, tag := range eventTags {
        if tag.IsNegated {
            if sliceContains(activeEventCodes, tag.TagKey) {
                return false // Negated tag matched = HIDE
            }
        }
    }

    // STEP 4: Check positive tags
    hasPositiveTags := false
    hasPositiveMatch := false

    for _, tag := range eventTags {
        if !tag.IsNegated {
            hasPositiveTags = true
            if sliceContains(activeEventCodes, tag.TagKey) {
                hasPositiveMatch = true
                break // At least one positive tag matched = SHOW
            }
        }
    }

    // STEP 5: Final decision
    if hasPositiveTags && !hasPositiveMatch {
        return false // Has positive tags but none matched = HIDE
    }

    return true // Either no positive tags OR at least one matched = SHOW
}
```

### Edge Cases

#### Case 1: Regular Zman (No Event Tags)
```
Zman: shacharit
Tags: [] (empty)
ActiveEventCodes: ['shabbos', 'chanukah']
Result: SHOW (no event tags = always show)
```

#### Case 2: Single Positive Tag Match
```
Zman: hadlakas_neiros
Tags: ['erev_shabbos']
ActiveEventCodes: ['erev_shabbos', 'chanukah']
Result: SHOW (tag matched)
```

#### Case 3: Multiple Positive Tags (OR logic)
```
Zman: hadlakas_neiros
Tags: ['erev_shabbos', 'erev_yom_tov']
ActiveEventCodes: ['erev_shabbos']
Result: SHOW (at least one tag matched)
```

#### Case 4: Negated Tag Takes Precedence
```
Zman: tefillah_without_tachanun
Tags: ['shabbos', '!rosh_chodesh']
ActiveEventCodes: ['shabbos', 'rosh_chodesh']
Result: HIDE (negated tag matched, even though positive tag also matched)
```

#### Case 5: No Tags Match
```
Zman: hadlakas_neiros
Tags: ['erev_shabbos', 'erev_yom_tov']
ActiveEventCodes: ['shabbos', 'chanukah']
Result: HIDE (no positive tags matched)
```

---

## Flow Design

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HTTP Request                                              │
│    GET /api/v1/publisher/zmanim?date=2025-12-26             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Handler: Get Calendar Context                            │
│    calService.GetZmanimContext(date, loc, translitStyle)    │
│                                                              │
│    → Calls HebCal API                                       │
│    → Gets events: ["Chanukah: Day 3"]                       │
│    → Matches to tags via tag_event_mappings                 │
│    → Returns: ActiveEventCodes = ["chanukah", "chanukah_3"] │
│                                 + ["erev_shabbos"] (Friday) │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Handler: Call Zmanim Service                             │
│    zmanimService.CalculateZmanim(ctx, CalculateParams{      │
│        PublisherID: 2,                                      │
│        LocalityID: 4993250,                                 │
│        Date: 2025-12-26,                                    │
│        ActiveEventCodes: ["chanukah", "chanukah_3",         │
│                          "erev_shabbos"]                    │
│    })                                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Service: Load Publisher Zmanim from DB                   │
│    SELECT pz.*, array_agg(jsonb_build_object(               │
│        'tag_key', zt.tag_key,                               │
│        'tag_type', tt.key,                                  │
│        'is_negated', pzt.is_negated                         │
│    )) as tags                                               │
│    FROM publisher_zmanim pz                                 │
│    LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id │
│    LEFT JOIN zman_tags zt ON zt.id = pzt.tag_id            │
│    LEFT JOIN tag_types tt ON tt.id = zt.tag_type_id        │
│    WHERE pz.publisher_id = 2                                │
│    GROUP BY pz.id                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Service: Filter Zmanim BEFORE Calculation                │
│    formulas := make(map[string]string)                      │
│                                                              │
│    for each zman in publisherZmanim:                        │
│        if !ShouldShowZman(zman.tags, ActiveEventCodes):    │
│            continue  // Skip this zman                      │
│        formulas[zman.key] = zman.formula                   │
│                                                              │
│    Example:                                                  │
│    - shacharit: no event tags → include                     │
│    - hadlakas_neiros: tag 'erev_shabbos' → include          │
│    - havdalah: tag 'motzei_shabbos' → exclude (not active) │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. DSL Executor: Calculate ONLY Filtered Zmanim             │
│    ExecuteFormulaSet(formulas, dslCtx)                      │
│                                                              │
│    Only calculates:                                          │
│    - shacharit (sunrise + 30min)                            │
│    - hadlakas_neiros (sunset - 18min)                       │
│    - mincha_gedola (solar(12))                              │
│    ... (40 zmanim calculated, not all 200)                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Service: Build Result                                    │
│    CalculationResult{                                       │
│        Date: "2025-12-26",                                  │
│        Zmanim: [                                            │
│            {Key: "shacharit", Time: "07:32:15", ...},       │
│            {Key: "hadlakas_neiros", Time: "16:12:00", ...}, │
│            ...                                              │
│        ]                                                    │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Handler: Build Response (NO FILTERING)                   │
│    DayContext{                                              │
│        Date: "2025-12-26",                                  │
│        HebrewDate: "כה כסלו",                               │
│        ActiveEventCodes: ["chanukah", "erev_shabbos"],     │
│        // Display metadata only, NO ShowCandleLighting     │
│    }                                                        │
│                                                              │
│    Response{                                                │
│        data: {                                              │
│            day_context: dayCtx,                             │
│            zmanim: calcResult.Zmanim  // Use as-is         │
│        }                                                    │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Insights

1. **Filtering happens ONCE** - in service before calculation
2. **No post-processing** - handler returns what service calculated
3. **Tag-driven** - ALL filtering logic in one function (`ShouldShowZman`)
4. **Database-driven** - Event mappings stored in `tag_event_mappings`, not code

---

## What to DELETE

### Files to Completely Remove

**NONE** - All files have valid purposes, but functions within them need deletion.

### Functions/Structs to DELETE

#### `api/internal/calendar/events.go`

```go
// ❌ DELETE: Hardcoded event type checks
func isYomTovEvent(code string) bool { ... }

// ❌ MODIFY: Remove boolean fields
type ZmanimContext struct {
    ShowCandleLighting bool     // DELETE THIS FIELD
    ShowHavdalah       bool     // DELETE THIS FIELD
    ShowFastStarts     bool     // DELETE THIS FIELD
    ShowFastEnds       bool     // DELETE THIS FIELD
    ActiveEventCodes   []string // KEEP THIS
}
```

#### `api/internal/services/zmanim_service.go`

```go
// ❌ DELETE: Hardcoded category map in ShouldShowZman
categoryFlagMap := map[string]bool{
    "category_candle_lighting": dayCtx.ShowCandleLighting,
    "category_havdalah":        dayCtx.ShowHavdalah,
    "category_fast_start":      dayCtx.ShowFastStart,
    "category_fast_end":        dayCtx.ShowFastEnd,
}

// ❌ DELETE: Category checking loop
for _, tag := range tags {
    if tag.TagType == "category" {
        if shouldShow, exists := categoryFlagMap[tag.TagKey]; exists {
            if !shouldShow {
                return false
            }
        }
    }
}

// ❌ DELETE: DayContext struct (replace with []string)
type DayContext struct {
    ShowCandleLighting bool
    ShowHavdalah       bool
    ShowFastStart      bool
    ShowFastEnd        bool
    ActiveEventCodes   []string
}
```

#### `api/internal/handlers/publisher_zmanim.go`

```go
// ❌ DELETE: Post-calculation filtering (lines 368, 588, 1076)
isActiveToday := h.shouldShowZman(metadata, dayCtx)
if !isActiveToday && !includeInactive {
    continue
}

// ❌ DELETE: Entire function (lines 1116-1140)
func (h *PublisherHandler) shouldShowZman(metadata PublisherZmanMetadata, dayCtx DayContext) bool {
    // DELETE ALL OF THIS
}

// ❌ MODIFY: Remove boolean fields from DayContext
type DayContext struct {
    Date             string   // KEEP
    HebrewDate       string   // KEEP
    ActiveEventCodes []string // KEEP
    ShowCandleLighting bool   // DELETE
    ShowHavdalah       bool   // DELETE
    ShowFastStart      bool   // DELETE
    ShowFastEnd        bool   // DELETE
}
```

#### `api/internal/calendar/category_mappings.go`

**File Status**: Review if needed

This file seems to define category tag configs for UI grouping:
```go
var CategoryTags = []CategoryTagConfig{
    {TagKey: "category_candle_lighting", DisplayGroup: "candles"},
    {TagKey: "category_havdalah", DisplayGroup: "havdalah"},
    ...
}
```

**Decision**:
- ✅ KEEP if used ONLY for UI display grouping
- ❌ DELETE if used for filtering logic

---

## What to MODIFY

### 1. Calendar Service Event Matching

**Add Database-Driven Pattern Matching**

**File**: `api/internal/calendar/events.go`

```go
// NEW: Load mappings from database
func (s *CalendarService) LoadTagEventMappings(ctx context.Context) ([]TagEventMapping, error) {
    rows, err := s.db.Query(ctx, `
        SELECT tem.id, tem.tag_id, zt.tag_key, tem.hebcal_event_pattern, tem.priority
        FROM tag_event_mappings tem
        JOIN zman_tags zt ON zt.id = tem.tag_id
        WHERE tem.hebcal_event_pattern IS NOT NULL
        ORDER BY tem.priority DESC
    `)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var mappings []TagEventMapping
    for rows.Next() {
        var m TagEventMapping
        if err := rows.Scan(&m.ID, &m.TagID, &m.TagKey, &m.HebcalEventPattern, &m.Priority); err != nil {
            return nil, err
        }
        mappings = append(mappings, m)
    }
    return mappings, nil
}

// NEW: Match HebCal events to tag keys
func (s *CalendarService) MatchEventsToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
    matched := make(map[string]bool)

    for _, event := range events {
        for _, mapping := range mappings {
            if matchSQLLikePattern(event.Title, mapping.HebcalEventPattern) {
                matched[mapping.TagKey] = true
                break // Use highest priority match
            }
        }
    }

    result := make([]string, 0, len(matched))
    for tagKey := range matched {
        result = append(result, tagKey)
    }
    return result
}

// MODIFY: Simplify to only return ActiveEventCodes
func (s *CalendarService) GetZmanimContext(date time.Time, loc Location, transliterationStyle string) ZmanimContext {
    ctx := context.Background()

    // Load mappings (could be cached)
    mappings, err := s.LoadTagEventMappings(ctx)
    if err != nil {
        slog.Error("failed to load tag mappings", "error", err)
        mappings = []TagEventMapping{} // Fallback to empty
    }

    // Get HebCal events for today
    hebcalEvents := s.getHebcalEvents(date)
    eventCodes := s.MatchEventsToTags(hebcalEvents, mappings)

    // Add day-of-week codes
    dow := date.Weekday()
    if dow == time.Friday {
        eventCodes = appendUnique(eventCodes, "erev_shabbos")
    }
    if dow == time.Saturday {
        eventCodes = appendUnique(eventCodes, "shabbos")
        eventCodes = appendUnique(eventCodes, "motzei_shabbos")
    }

    // Add erev codes for tomorrow
    tomorrow := date.AddDate(0, 0, 1)
    tomorrowEvents := s.getHebcalEvents(tomorrow)
    tomorrowCodes := s.MatchEventsToTags(tomorrowEvents, mappings)
    for _, code := range tomorrowCodes {
        // Only add erev codes for yom tov events
        if s.isYomTovCode(code) {
            eventCodes = appendUnique(eventCodes, "erev_"+code)
        }
    }

    return ZmanimContext{
        ActiveEventCodes: eventCodes,
        // ... other display fields for JSON response
    }
}
```

### 2. Service Filtering Simplification

**File**: `api/internal/services/zmanim_service.go`

```go
// MODIFY: Change CalculateParams
type CalculateParams struct {
    LocalityID         int64
    PublisherID        int32
    Date               time.Time
    IncludeDisabled    bool
    IncludeUnpublished bool
    IncludeBeta        bool
    ActiveEventCodes   []string // CHANGED: Was DayContext, now simple []string
}

// MODIFY: Update CalculateZmanim filtering logic (line ~311-324)
func (s *ZmanimService) CalculateZmanim(ctx context.Context, params CalculateParams) (*CalculationResult, error) {
    // ... (locality lookup, coordinates, etc.)

    publisherZmanim, err := s.db.Queries.GetPublisherZmanim(ctx, params.PublisherID)
    if err != nil {
        return nil, fmt.Errorf("failed to load publisher zmanim: %w", err)
    }

    formulas := make(map[string]string)
    zmanConfigMap := make(map[string]struct{ ID int32; RoundingMode string })

    for _, pz := range publisherZmanim {
        // Apply publication filters
        if !params.IncludeDisabled && !pz.IsEnabled {
            continue
        }
        if !params.IncludeUnpublished && !pz.IsPublished {
            continue
        }
        if !params.IncludeBeta && pz.IsBeta {
            continue
        }

        // Apply event filtering (ONLY if ActiveEventCodes provided)
        if len(params.ActiveEventCodes) > 0 {
            // Unmarshal tags
            var tags []EventFilterTag
            if pz.Tags != nil {
                tagsBytes, _ := json.Marshal(pz.Tags)
                if err := json.Unmarshal(tagsBytes, &tags); err == nil {
                    // Check if zman should show
                    if !s.ShouldShowZman(tags, params.ActiveEventCodes) {
                        continue // Skip this zman
                    }
                }
            }
        }

        // Add to calculation set
        formulas[pz.ZmanKey] = pz.FormulaDsl
        zmanConfigMap[pz.ZmanKey] = struct{ ID int32; RoundingMode string }{
            ID:           pz.ID,
            RoundingMode: pz.RoundingMode,
        }
    }

    // Execute DSL formulas (only for filtered zmanim)
    dslCtx := dsl.NewExecutionContext(params.Date, latitude, longitude, elevation, tz)
    calculatedTimes, err := dsl.ExecuteFormulaSet(formulas, dslCtx)
    if err != nil {
        return nil, fmt.Errorf("DSL execution failed: %w", err)
    }

    // ... (build result)
}

// MODIFY: Simplify ShouldShowZman (remove category checking)
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // Filter to event/jewish_day tags ONLY
    eventTags := []EventFilterTag{}
    for _, tag := range tags {
        if tag.TagType == "event" || tag.TagType == "jewish_day" {
            eventTags = append(eventTags, tag)
        }
    }

    // No event tags = always show
    if len(eventTags) == 0 {
        return true
    }

    // Check negated tags first
    for _, tag := range eventTags {
        if tag.IsNegated && s.sliceContainsString(activeEventCodes, tag.TagKey) {
            return false // Negated tag matched = HIDE
        }
    }

    // Check positive tags
    hasPositiveTags := false
    hasPositiveMatch := false
    for _, tag := range eventTags {
        if !tag.IsNegated {
            hasPositiveTags = true
            if s.sliceContainsString(activeEventCodes, tag.TagKey) {
                hasPositiveMatch = true
                break
            }
        }
    }

    // Final decision
    if hasPositiveTags && !hasPositiveMatch {
        return false // Has positive tags but none matched = HIDE
    }

    return true // No positive tags OR at least one matched = SHOW
}
```

### 3. Handler Simplification

**File**: `api/internal/handlers/publisher_zmanim.go`

```go
// MODIFY: Simplify DayContext (remove filtering fields)
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
    SpecialContexts     []string      `json:"special_contexts"`
    // NO ShowCandleLighting, ShowHavdalah, etc.
}

// MODIFY: Update handler endpoint
func (h *PublisherHandler) GetZmanimForDate(w http.ResponseWriter, r *http.Request) {
    // ... (parse params, get locality, etc.)

    // Get calendar context
    zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)

    // Call service with event codes (service filters before calculation)
    calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
        LocalityID:       localityID,
        PublisherID:      publisherIDInt32,
        Date:             date,
        IncludeDisabled:  includeDisabled,
        IncludeUnpublished: includeUnpublished,
        IncludeBeta:      true,
        ActiveEventCodes: zmanimCtx.ActiveEventCodes, // ← Pass event codes
    })
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, err.Error())
        return
    }

    // Build day context for response (display metadata only)
    dayCtx := DayContext{
        Date:                dateStr,
        DayOfWeek:           int(dateInTz.Weekday()),
        DayName:             dayNames[dateInTz.Weekday()],
        HebrewDate:          hebrewDate.Formatted,
        HebrewDateFormatted: hebrewDate.Hebrew,
        IsErevShabbos:       dateInTz.Weekday() == time.Friday,
        IsShabbos:           dateInTz.Weekday() == time.Saturday,
        IsYomTov:            zmanimCtx.IsYomTov,
        IsFastDay:           zmanimCtx.IsFastDay,
        Holidays:            holidayInfos,
        ActiveEventCodes:    zmanimCtx.ActiveEventCodes,
    }

    // NO POST-FILTERING - use service result as-is
    response := map[string]interface{}{
        "data": map[string]interface{}{
            "day_context": dayCtx,
            "zmanim":      calcResult.Zmanim, // Already filtered by service
        },
    }

    RespondJSON(w, r, http.StatusOK, response)
}
```

---

## Implementation Checklist

### Phase 1: Calendar Service (Database-Driven Matching)

- [ ] Add `LoadTagEventMappings()` to load patterns from DB
- [ ] Add `MatchEventsToTags()` for pattern matching
- [ ] Add `matchSQLLikePattern()` helper for SQL LIKE wildcards
- [ ] Remove `isYomTovEvent()`, `isFastEvent()` hardcoded functions
- [ ] Remove `ShowCandleLighting`, `ShowHavdalah`, etc. from `ZmanimContext`
- [ ] Keep only `ActiveEventCodes []string` in `ZmanimContext`
- [ ] Update `GetZmanimContext()` to use database mappings
- [ ] Test: Verify HebCal events correctly map to tag keys

### Phase 2: Service Simplification

- [ ] Change `CalculateParams.DayContext` to `CalculateParams.ActiveEventCodes`
- [ ] Remove `DayContext` struct entirely from service
- [ ] Update `CalculateZmanim()` filtering logic (line ~311-324)
- [ ] Simplify `ShouldShowZman()` - remove category checking
- [ ] Test: Verify filtering works with tag matching only

### Phase 3: Handler Cleanup

- [ ] Remove `ShowCandleLighting`, etc. from handler `DayContext` struct
- [ ] Update service calls to pass `ActiveEventCodes` directly
- [ ] Remove ALL `shouldShowZman()` calls (lines 368, 588, 1076)
- [ ] Delete `shouldShowZman()` function entirely (lines 1116-1140)
- [ ] Test: Verify no post-calculation filtering occurs

### Phase 4: Validation

- [ ] Friday: candle lighting shows
- [ ] Wednesday: candle lighting does NOT show
- [ ] Saturday: havdalah shows
- [ ] Regular zmanim (shacharit, mincha) always show
- [ ] Fast day: fast start/end show
- [ ] Non-fast day: fast start/end do NOT show
- [ ] Weekly PDF has event zmanim section on Friday/Saturday

### Phase 5: Code Cleanup

- [ ] Search codebase for `ShowCandleLighting` → 0 results
- [ ] Search codebase for `ShowHavdalah` → 0 results
- [ ] Search codebase for `categoryFlagMap` → 0 results
- [ ] Search codebase for `shouldShowZman` in handlers → 0 results
- [ ] Verify `category_*` tags used ONLY for sorting, not filtering

---

## Success Criteria

### Code Quality

1. **Zero Hardcoded Flags**: No `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd` anywhere
2. **Single Source of Truth**: `ActiveEventCodes` is the ONLY filtering mechanism
3. **Database-Driven**: Event mappings in `tag_event_mappings`, not code
4. **Service-Side Filtering**: Handler does NOT filter after calculation
5. **Tag-Driven Logic**: ALL event display determined by tag matching

### Functional Correctness

1. **Friday (Erev Shabbos)**: Candle lighting shows
2. **Wednesday (Regular Day)**: Candle lighting does NOT show
3. **Saturday (Shabbos)**: Havdalah shows, candle lighting does NOT show
4. **Fast Day**: Fast start/end zmanim show
5. **Chanukah**: Chanukah-specific zmanim show (if tagged)
6. **Regular Zmanim**: Shacharit, mincha, etc. always show (no event tags)

### Architecture

```
BEFORE (Wrong):
Handler → Service (calculates ALL) → Handler filters → Response
   ↑ Hardcoded flags everywhere ↑

AFTER (Correct):
Handler → Service (filters THEN calculates) → Response
   ↑ Tag matching ONLY ↑
```

---

## Appendix: Pattern Matching Reference

### SQL LIKE to Go Conversion

| SQL Pattern | Go Implementation | Examples |
|-------------|-------------------|----------|
| `Rosh Hashana%` | `strings.HasPrefix(title, "Rosh Hashana")` | Matches "Rosh Hashana I", "Rosh Hashana II" |
| `%Tevet` | `strings.HasSuffix(title, "Tevet")` | Matches "Asara B'Tevet" |
| `%Omer` | `strings.Contains(title, "Omer")` | Matches "15th day of the Omer" |
| `Pesach I` | `title == "Pesach I"` | Exact match |

### Implementation

```go
func matchSQLLikePattern(text, pattern string) bool {
    // No wildcard = exact match
    if !strings.Contains(pattern, "%") {
        return text == pattern
    }

    parts := strings.Split(pattern, "%")

    switch len(parts) {
    case 2:
        // Single wildcard
        if parts[0] == "" && parts[1] == "" {
            return true // Pattern is just "%" - matches anything
        }
        if parts[0] == "" {
            return strings.HasSuffix(text, parts[1]) // "%X"
        }
        if parts[1] == "" {
            return strings.HasPrefix(text, parts[0]) // "X%"
        }
        // "X%Y" - must start with X and end with Y
        return strings.HasPrefix(text, parts[0]) && strings.HasSuffix(text, parts[1])

    case 3:
        // Two wildcards: "%X%" - contains X
        if parts[0] == "" && parts[2] == "" {
            return strings.Contains(text, parts[1])
        }
        fallthrough

    default:
        // Complex pattern - implement full SQL LIKE
        // For now, convert to regex
        regex := "^" + strings.ReplaceAll(regexp.QuoteMeta(pattern), "%", ".*") + "$"
        matched, _ := regexp.MatchString(regex, text)
        return matched
    }
}
```

---

## Conclusion

This architecture achieves the goal:

> "HebCal says what events are active → Use DSL + matching event tags → Decide which zmanim are relevant to that day. NO other logic should exist anywhere."

**Key Principle**: The ONLY filtering logic is tag matching in `ShouldShowZman()`. Everything else is metadata display.

**Implementation Order**:
1. Calendar Service database-driven matching
2. Service filtering simplification
3. Handler cleanup
4. Validation testing

**Expected Outcome**: Zero hardcoded event logic, 100% tag-driven filtering, efficient calculation (only what's needed).
