# Negated Tags Implementation Plan

## Overview

Add the ability to negate tags on zmanim, allowing expressions like:
- "All Yom Tov **except** Pesach"
- "All fasts **except** Tisha B'Av"
- "Shabbos but **not** when it's also Yom Tov"

## Use Cases

1. **Candle lighting variants**: Different times for different holidays
   - Yom Kippur candle lighting (earlier than regular)
   - Tags: `is_candle_lighting` + `yom_kippur` (positive)
   - vs regular candle lighting: `is_candle_lighting` + NOT `yom_kippur`

2. **Fast-specific zmanim**: Some zmanim apply to most fasts but not all
   - Tags: `is_fast_end` + NOT `tisha_bav` (Tisha B'Av has different end time)

3. **Shabbos vs Yom Tov**: Some zmanim differ when Shabbos coincides with Yom Tov
   - Tags: `shabbos` + NOT `yom_tov` (regular Shabbos only)

## Database Changes

### Option A: Add `is_negated` column to join tables

```sql
-- Migration: Add is_negated to tag join tables
ALTER TABLE master_zman_tags
ADD COLUMN is_negated BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE publisher_zman_tags
ADD COLUMN is_negated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN master_zman_tags.is_negated IS
'When true, this zman should NOT appear on days with this tag';

COMMENT ON COLUMN publisher_zman_tags.is_negated IS
'When true, this zman should NOT appear on days with this tag';
```

**Pros:**
- Simple schema change
- No new tables
- Easy to query

**Cons:**
- Composite primary key needs updating (master_zman_id, tag_id) → (master_zman_id, tag_id, is_negated) OR just allow one row per zman/tag pair

### Option B: Separate negated tags table (NOT recommended)

Would require new tables and more complex queries. Not worth it.

## Recommended: Option A

Keep it simple - add `is_negated` to existing join tables.

---

## Schema Migration

```sql
-- Migration 00000000000012_negated_tags.sql

-- Add is_negated column to master_zman_tags
ALTER TABLE master_zman_tags
ADD COLUMN is_negated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN master_zman_tags.is_negated IS
'When true, this zman should NOT appear on days matching this tag';

-- Add is_negated column to publisher_zman_tags
ALTER TABLE publisher_zman_tags
ADD COLUMN is_negated BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN publisher_zman_tags.is_negated IS
'When true, this zman should NOT appear on days matching this tag';
```

---

## API Changes

### Tag Response Model

Update the tag object returned in API responses:

```go
// Current
type ZmanTag struct {
    ID                 string `json:"id"`
    TagKey             string `json:"tag_key"`
    Name               string `json:"name"`
    DisplayNameHebrew  string `json:"display_name_hebrew"`
    DisplayNameEnglish string `json:"display_name_english"`
    TagType            string `json:"tag_type"`
}

// Updated
type ZmanTag struct {
    ID                 string `json:"id"`
    TagKey             string `json:"tag_key"`
    Name               string `json:"name"`
    DisplayNameHebrew  string `json:"display_name_hebrew"`
    DisplayNameEnglish string `json:"display_name_english"`
    TagType            string `json:"tag_type"`
    IsNegated          bool   `json:"is_negated"` // NEW
}
```

### SQL Query Updates

Update queries that return tags to include `is_negated`:

```sql
-- In GetPublisherZmanim and similar queries
COALESCE(
    (SELECT json_agg(DISTINCT json_build_object(
        'id', t.id,
        'tag_key', t.tag_key,
        'name', t.name,
        'display_name_hebrew', t.display_name_hebrew,
        'display_name_english', t.display_name_english,
        'tag_type', t.tag_type,
        'is_negated', COALESCE(tag_link.is_negated, false)  -- NEW
    ))
    FROM (
        -- Master zman tags
        SELECT t.*, mzt.is_negated FROM master_zman_tags mzt
        JOIN zman_tags t ON mzt.tag_id = t.id
        WHERE mzt.master_zman_id = pz.master_zman_id
        UNION
        -- Publisher-specific tags
        SELECT t.*, pzt.is_negated FROM publisher_zman_tags pzt
        JOIN zman_tags t ON pzt.tag_id = t.id
        WHERE pzt.publisher_zman_id = pz.id
    ) AS tag_link(id, tag_key, name, ..., is_negated)),
    '[]'::json
) AS tags
```

### Update/Create Endpoints

The `SetPublisherZmanTags` endpoint needs to accept negation:

```go
type SetTagsRequest struct {
    Tags []TagAssignment `json:"tags"`
}

type TagAssignment struct {
    TagID     string `json:"tag_id"`
    IsNegated bool   `json:"is_negated"`
}
```

---

## Frontend Changes

### Tag Display: Negation Styling

**Visual Design:** Negated tags display inline with other tags, distinguished by:
- Red/destructive border/outline
- Small X icon inside the badge
- Same position in tag list (no separate column)

```tsx
// Negated tag badge - inline with other tags
<Badge
  className={cn(
    getTagTypeColor(tag.tag_type),
    tag.is_negated && "border-red-500 border-2"
  )}
>
  {tag.is_negated && <X className="h-3 w-3 mr-1 text-red-500" />}
  {tag.display_name_english}
</Badge>
```

**Example rendering:**
```
Formula & Tags
proportional_hours(9.5, gra)

[afternoon] [GRA] [Proportional Hours] [GRA (Vilna Gaon)]
[Proportional (Zmaniyos)] [Mincha Times] [Core] [X Pesach]
                                                 ↑ red border + X icon
```

### Files to Update

1. **`web/components/admin/ZmanRegistryForm.tsx`** - Admin registry tag display/editing
2. **`web/components/publisher/ZmanCard.tsx`** - Publisher zman card tag display
3. **`web/components/publisher/ZmanTagEditor.tsx`** - Tag selection with negation toggle
4. **`web/components/zmanim/FormulaPanel.tsx`** - Public zman detail view
5. **Create shared `TagBadge` component** - Reusable badge with negation styling

---

## Filtering Logic (Backend)

When filtering zmanim by active tags for a given date:

```go
func (s *ZmanimService) FilterByTags(zmanim []Zman, activeTags []string) []Zman {
    var result []Zman

    for _, z := range zmanim {
        include := true

        // Check positive tags (at least one must match if any positive tags exist)
        positiveTags := filterNonNegated(z.Tags)
        if len(positiveTags) > 0 {
            hasMatch := false
            for _, pt := range positiveTags {
                if contains(activeTags, pt.TagKey) {
                    hasMatch = true
                    break
                }
            }
            if !hasMatch {
                include = false
            }
        }

        // Check negated tags (none should match)
        negatedTags := filterNegated(z.Tags)
        for _, nt := range negatedTags {
            if contains(activeTags, nt.TagKey) {
                include = false
                break
            }
        }

        if include {
            result = append(result, z)
        }
    }

    return result
}
```

---

## Implementation Steps

### Phase 1: Database (Migration 12)
- [ ] Create migration adding `is_negated` column to both tables
- [ ] Run migration, regenerate SQLc

### Phase 2: Backend API
- [ ] Update SQLc queries to include `is_negated` in tag JSON
- [ ] Update tag models to include `IsNegated` field
- [ ] Update `SetPublisherZmanTags` to accept negation
- [ ] Update `SetMasterZmanTags` (admin) to accept negation

### Phase 3: Frontend - Admin Registry
- [ ] Update `ZmanRegistryForm.tsx` to show/set negated tags
- [ ] Visual distinction for negated tags

### Phase 4: Frontend - Publisher Algorithm
- [ ] Update `ZmanCard.tsx` / `ZmanTagEditor.tsx`
- [ ] Visual distinction for negated tags
- [ ] Toggle to negate selected tags

### Phase 5: Tag Display Components
- [ ] Create shared `TagBadge` component that handles negation styling
- [ ] Update all tag displays to use new component

---

## Example Usage

### Scenario: Candle Lighting Times

**Regular Candle Lighting (18 min before sunset)**
- Tags: `is_candle_lighting`
- NOT tags: `yom_kippur`
- Appears: Every Erev Shabbos and Erev Yom Tov except Yom Kippur

**Yom Kippur Candle Lighting (earlier)**
- Tags: `is_candle_lighting`, `yom_kippur`
- Appears: Only Erev Yom Kippur

### Scenario: Fast End Times

**Regular Fast End (3 stars)**
- Tags: `is_fast_end`
- NOT tags: `tisha_bav`, `yom_kippur`
- Appears: All minor fasts

**Tisha B'Av End (later)**
- Tags: `is_fast_end`, `tisha_bav`
- NOT tags: (none)
- Appears: Only Tisha B'Av

---

## Comprehensive Audit: Zmanim Rendering & Filtering Locations

This section documents ALL locations in the codebase where zmanim are rendered, filtered, or calculated. Each location needs to be reviewed to ensure tag-based filtering (including negation) works correctly.

### Backend: API Handlers & Services

#### 1. `api/internal/handlers/zmanim.go` - `GetZmanimForCity()`
**Endpoint:** `GET /zmanim?cityId=X&date=YYYY-MM-DD&publisherId=Y`
**Purpose:** Public endpoint returning calculated zmanim for end users

**Current Logic:**
- Fetches publisher zmanim from database
- Calculates times using DSL executor
- Adds event-based zmanim (candle lighting, havdalah) based on calendar context
- Checks `ShowCandleLighting` and `ShowShabbosYomTovEnds` flags

**Changes Needed:**
- [ ] Update to respect negated `jewish_day` tags
- [ ] Filter out zmanim where negated tag matches active day

#### 2. `api/internal/handlers/publisher_zmanim.go` - `GetPublisherZmanim()`
**Endpoint:** `GET /publisher/zmanim?date=YYYY-MM-DD&latitude=X&longitude=Y`
**Purpose:** Publisher preview with filtering

**Current Logic (Lines 592-647):**
```go
func filterAndCalculateZmanim(zmanim []PublisherZmanRow, ctx DayContext, execCtx *dsl.ExecutionContext) []CalculatedZman {
    // Calls shouldShowZman() for each zman
}
```

**`shouldShowZman()` (Lines 649-678):**
```go
func shouldShowZman(z PublisherZmanRow, ctx DayContext) bool {
    // Checks behavior tags: is_candle_lighting, is_havdalah, is_fast_start, is_fast_end
    // Maps to: ShowCandleLighting, ShowHavdalah, ShowFastStart, ShowFastEnd
}
```

**Changes Needed:**
- [ ] Extend `shouldShowZman()` to check `jewish_day` tags
- [ ] Implement negation logic: if negated tag matches active day tags, exclude zman
- [ ] Get active day tags from calendar service (HebCal integration)

#### 3. `api/internal/handlers/publisher_zmanim.go` - `GetPublisherZmanimWeek()`
**Endpoint:** `GET /publisher/zmanim/week?start_date=YYYY-MM-DD&latitude=X&longitude=Y`
**Purpose:** Batch calculation for 7 days

**Changes Needed:**
- [ ] Same filtering logic as above (calls same `filterAndCalculateZmanim`)

#### 4. `api/internal/calendar/events.go` - Calendar Context Service
**Purpose:** Determines what events/tags are active on a given day

**Key Functions:**
- `GetEventDayInfo()` - Returns comprehensive event info
- `GetZmanimContext()` - Returns flags for zmanim filtering
- `getActiveEvents()`, `getErevEvents()`, `getMoetzeiEvents()`

**Changes Needed:**
- [ ] Add method to return active `jewish_day` tag keys for a date
- [ ] Integrate with `tag_event_mappings` table (HebCal patterns)
- [ ] Return list of active tag_keys that can be matched against zman tags

#### 5. `api/internal/db/queries/zmanim.sql` - SQLc Queries
**Key Queries:**
- `GetPublisherZmanim` - Returns zmanim with tags JSON
- `GetMasterZmanById` - Returns master zman with tags

**Changes Needed:**
- [ ] Update tag JSON to include `is_negated` field
- [ ] Ensure both master and publisher tags include negation

### Frontend: Display Components

#### 6. `web/app/zmanim/[cityId]/[publisherId]/page.tsx`
**Purpose:** Main public zmanim display page
**Current Logic:**
- Groups zmanim by `time_category`
- Filters by `is_core` (optional toggle)
- Displays names, times, tags

**Changes Needed:**
- [ ] Backend handles filtering; frontend just displays (no changes needed)

#### 7. `web/components/zmanim/FormulaPanel.tsx`
**Purpose:** Zman detail view with tags display

**Changes Needed:**
- [ ] Display negated tags with visual distinction
- [ ] Use shared `TagBadge` component

#### 8. `web/components/publisher/ZmanCard.tsx`
**Purpose:** Publisher's view of individual zman

**Changes Needed:**
- [ ] Display negated tags distinctly
- [ ] Allow toggling negation when editing

#### 9. `web/components/publisher/ZmanTagEditor.tsx`
**Purpose:** Tag selection/editing UI

**Changes Needed:**
- [ ] Add negation toggle for each selected tag
- [ ] Visual indicator for negated state

#### 10. `web/components/publisher/AlgorithmPreview.tsx`
**Purpose:** Preview calculated zmanim for a location/date

**Changes Needed:**
- [ ] Backend handles all filtering; frontend just displays results (no changes needed)

#### 11. `web/components/publisher/WeekPreview.tsx` & `MonthPreview.tsx`
**Purpose:** Calendar previews

**Changes Needed:**
- [ ] Backend handles all filtering; frontend just displays results (no changes needed)

#### 12. `web/components/admin/ZmanRegistryForm.tsx`
**Purpose:** Admin editing of master registry zmanim

**Changes Needed:**
- [ ] Allow setting negated tags on master zmanim
- [ ] Visual distinction for negated tags

### Filtering Logic: Detailed Algorithm

```go
// GetActiveTagKeysForDate returns all tag_keys that are active on this date
// by checking tag_event_mappings against HebCal events
func (s *CalendarService) GetActiveTagKeysForDate(date time.Time, loc Location) []string {
    // 1. Get HebCal events for date
    events := s.hebcal.GetEvents(date, loc)

    // 2. Query tag_event_mappings for matching patterns
    var activeTags []string
    for _, event := range events {
        // Match against hebcal_event_pattern (supports % wildcard)
        tags := s.db.GetTagsMatchingEvent(event.Name)
        activeTags = append(activeTags, tags...)
    }

    // 3. Also check hebrew date-based mappings
    hebrewDate := s.GetHebrewDate(date)
    dateTags := s.db.GetTagsForHebrewDate(hebrewDate.Month, hebrewDate.Day)
    activeTags = append(activeTags, dateTags...)

    return unique(activeTags)
}

// shouldShowZman checks if a zman should be displayed on this date
func shouldShowZman(z Zman, activeDayTags []string, ctx DayContext) bool {
    // Separate positive and negated tags
    var positiveTags, negatedTags []Tag
    for _, t := range z.Tags {
        if t.IsNegated {
            negatedTags = append(negatedTags, t)
        } else {
            positiveTags = append(positiveTags, t)
        }
    }

    // 1. Check behavior tags (existing logic)
    if hasTag(z.Tags, "is_candle_lighting") && !ctx.ShowCandleLighting {
        return false
    }
    if hasTag(z.Tags, "is_havdalah") && !ctx.ShowHavdalah {
        return false
    }
    if hasTag(z.Tags, "is_fast_start") && !ctx.ShowFastStart {
        return false
    }
    if hasTag(z.Tags, "is_fast_end") && !ctx.ShowFastEnd {
        return false
    }

    // 2. Check jewish_day tags (NEW)
    jewishDayPositive := filterByType(positiveTags, "jewish_day")
    jewishDayNegated := filterByType(negatedTags, "jewish_day")

    // If there are positive jewish_day tags, at least one must match
    if len(jewishDayPositive) > 0 {
        hasMatch := false
        for _, pt := range jewishDayPositive {
            if contains(activeDayTags, pt.TagKey) {
                hasMatch = true
                break
            }
        }
        if !hasMatch {
            return false
        }
    }

    // 3. Check negated tags - if ANY match, exclude
    for _, nt := range jewishDayNegated {
        if contains(activeDayTags, nt.TagKey) {
            return false // Negated tag matches, hide this zman
        }
    }

    return true
}
```

### Data Flow Summary

```
User Request (date, location)
        │
        ▼
┌─────────────────────────────────────────┐
│  Calendar Service                        │
│  - GetActiveTagKeysForDate()            │
│  - Queries tag_event_mappings           │
│  - Returns: ["pesach", "chol_hamoed"... │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  Zmanim Handler                          │
│  - Fetch all publisher zmanim           │
│  - For each zman:                       │
│    - Get tags (with is_negated)         │
│    - Call shouldShowZman()              │
│    - Filter based on tag matching       │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  DSL Executor                            │
│  - Calculate times for filtered zmanim  │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  Frontend Display                        │
│  - Render filtered, calculated zmanim   │
│  - Show tags with negation styling      │
└─────────────────────────────────────────┘
```

---

## Implementation Phases (Updated)

### Phase 1: Database Schema
- [ ] Migration adding `is_negated` to `master_zman_tags`
- [ ] Migration adding `is_negated` to `publisher_zman_tags`
- [ ] Regenerate SQLc

### Phase 2: Calendar Service - Active Tags
- [ ] New function `GetActiveTagKeysForDate(date, loc)` in `calendar/events.go`
- [ ] Query `tag_event_mappings` for HebCal pattern matching
- [ ] Query hebrew date-based mappings
- [ ] Return list of active `tag_key` strings

### Phase 3: Backend Filtering Logic
- [ ] Update `shouldShowZman()` in `publisher_zmanim.go`
- [ ] Add `jewish_day` tag filtering with negation support
- [ ] Pass `activeDayTags` to filtering function
- [ ] Update `DayContext` struct to include active tag keys

### Phase 4: SQL Query Updates
- [ ] Update `GetPublisherZmanim` to include `is_negated` in tags JSON
- [ ] Update `GetMasterZmanById` similarly
- [ ] Ensure tag JSON structure includes negation

### Phase 5: API Endpoints
- [ ] Update `SetPublisherZmanTags` to accept `is_negated`
- [ ] Update `SetMasterZmanTags` (admin) to accept `is_negated`
- [ ] Update response models

### Phase 6: Frontend - Tag Display
- [ ] Create shared `TagBadge` component with negation styling
- [ ] Update `FormulaPanel.tsx`
- [ ] Update `ZmanCard.tsx`

### Phase 7: Frontend - Tag Editing
- [ ] Update `ZmanTagEditor.tsx` with negation toggle
- [ ] Update `ZmanRegistryForm.tsx` (admin)

### Phase 8: Testing
- [ ] Unit tests for `shouldShowZman()` with negation
- [ ] Unit tests for `GetActiveTagKeysForDate()`
- [ ] E2E tests for zmanim display with tag filtering

---

## Bugs to Fix

### Tag Count Display Bug
**Location:** `web/components/publisher/ZmanTagEditor.tsx` line 100
**Issue:** The tag count shows "2 tags" but 4 tags are actually visible. The count only reflects explicit database tags (`currentTags.length`), but the UI in `ZmanCard.tsx` also displays inferred tags from formula (lines 656-669).
**Root Cause:** `ZmanCard.tsx` renders two separate tag sections:
  1. Explicit tags from `zman.tags` (line 644-648)
  2. Inferred tags from `inferTagsFromFormula()` (line 656-669)

  But `ZmanTagEditor` only counts explicit tags.
**Fix Options:**
  1. Pass total count (explicit + inferred) to `ZmanTagEditor`
  2. Or move the tag count display to `ZmanCard.tsx` where both are known
  3. Or label it "2 explicit tags" to clarify

---

## Open Questions

1. **Should negation be inheritable?** If master registry has a negated tag, can publisher override to positive?
   - **Recommendation:** Yes, publisher tags completely override master tags for that specific tag_id

2. **UI: How to show both positive and negated in tag selector?**
   - **Recommendation:** Two-step: (1) select tag, (2) toggle negation. Or use a split button.

3. **What happens with conflicting tags?** (e.g., `pesach` positive AND `pesach` negated)
   - **Recommendation:** Treat as "negated wins" - if explicitly negated, don't show

4. **Should we show "hidden" zmanim to publishers in preview mode?**
   - **Decision:** No. Hidden zmanim are simply not shown. The tag system is deterministic and publishers can understand why a zman doesn't appear by looking at its tags.
