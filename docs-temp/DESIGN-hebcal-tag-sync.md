# Design: Perfect HebCal-to-Tag Synchronization

**Date**: 2025-12-24
**Status**: Design Ready for Implementation
**Requirement**: One-to-one mapping between HebCal events and zman_tags with zero drift

---

## Executive Summary

**Problem**: Event tags can drift out of sync with HebCal's canonical event list, causing missing zmanim or incorrect filtering.

**Solution**: Eliminate `mapHolidayToEventCode()` hardcoded mapping. Use database-driven pattern matching via `tag_event_mappings` table as single source of truth. Add validation queries to detect drift.

**Result**:
- Zero maintenance burden for new HebCal events
- Automated sync validation
- Database-driven event matching (already implemented)
- SQL migration to add missing events

---

## Current State Analysis

### What Exists (Database-Driven)

#### 1. Tag Event Mappings Table
```sql
CREATE TABLE tag_event_mappings (
    id INTEGER PRIMARY KEY,
    tag_id INTEGER REFERENCES zman_tags(id),
    hebcal_event_pattern VARCHAR(100),  -- SQL LIKE pattern (e.g., "Rosh Hashana%")
    hebrew_month INTEGER,               -- Optional: month-based matching
    hebrew_day_start INTEGER,           -- Optional: date range matching
    hebrew_day_end INTEGER,
    priority INTEGER DEFAULT 100,       -- Lower = higher priority
    created_at TIMESTAMP
);
```

**Current Mappings**: 60 rows covering 42 distinct tags

**Example Patterns**:
- `"Rosh Hashana%"` → matches `rosh_hashanah` tag
- `"Pesach I"` → matches both `pesach` (priority 20) and `pesach_first` (priority 10)
- `"Tzom Gedaliah"` → matches both `tzom_gedaliah` (priority 10) and `fast_day` (priority 50)

#### 2. Zman Tags with HebCal Basename
```sql
CREATE TABLE zman_tags (
    id INTEGER PRIMARY KEY,
    tag_key VARCHAR(50),                -- e.g., "rosh_hashanah"
    hebcal_basename VARCHAR(100),       -- e.g., "Rosh Hashana" (for exact matching)
    display_name_english_ashkenazi TEXT,
    display_name_english_sephardi TEXT,
    display_name_hebrew TEXT,
    tag_type_id INTEGER,
    ...
);
```

**Current Event Tags**: 40 tags with `tag_type = 'event'`

#### 3. Pattern Matching Code (Already Implemented)
**File**: `/home/daniel/repos/zmanim/api/internal/calendar/hebcal.go` (lines 194-240)

```go
func matchPattern(title, pattern string) bool {
    // Supports SQL LIKE-style % wildcards
    // "Rosh Hashana%" matches "Rosh Hashana 9547", "Rosh Hashana II"
    // "Pesach I" matches exactly
    // "%day of the Omer" matches "1st day of the Omer", "33rd day of the Omer"
}

func MatchEventToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
    // Returns matched tag keys based on pattern matching
}
```

### What's Broken (Hardcoded Logic)

#### 1. mapHolidayToEventCode() Function
**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go` (lines 310-412)

**Problem**: Hardcoded switch statement duplicates logic from database
```go
func mapHolidayToEventCode(name string, hd hdate.HDate, isIsrael bool) (code string, dayNum, totalDays int) {
    switch {
    case contains(name, "Rosh Hashana"):
        if contains(name, "I") && !contains(name, "II") {
            return "rosh_hashanah", 1, 2
        }
        return "rosh_hashanah", 2, 2
    case contains(name, "Yom Kippur"):
        return "yom_kippur", 1, 1
    // ... 30 more hardcoded cases
    }
    return "", 0, 0
}
```

**Issues**:
- **Two sources of truth**: Database patterns + hardcoded Go code
- **Maintenance burden**: New HebCal events require code changes
- **Location logic duplicated**: Israel/Diaspora day counting hardcoded
- **Can't be validated**: No way to detect missing events

---

## Design Questions & Answers

### Question 1: Should we keep mapHolidayToEventCode()?

**ANSWER: NO - Delete it entirely**

**Rationale**:
1. ✅ **Pattern matching already implemented** (`hebcal.go` lines 194-240)
2. ✅ **Database already has mappings** (60 patterns in `tag_event_mappings`)
3. ✅ **Multi-day logic can be database-driven** (add `day_number` and `total_days` columns)
4. ✅ **Location-aware logic can be database-driven** (add `israel_only`/`diaspora_only` columns)

**Migration Path**:
1. Add columns to `tag_event_mappings`: `day_number`, `total_days`, `israel_only`, `diaspora_only`
2. Use `MatchEventToTags()` from `hebcal.go` (already exists)
3. Delete `mapHolidayToEventCode()` entirely
4. Update `holidayToActiveEvent()` to use database patterns

### Question 2: What about multi-day events?

**ANSWER: Store day information in tag_event_mappings**

**Current HebCal Output**:
- `"Rosh Hashana 9547"` (Day 1)
- `"Rosh Hashana II"` (Day 2)
- `"Pesach I"` (Day 1), `"Pesach II"` (Day 2), ..., `"Pesach VIII"` (Day 8)

**Proposed Database Schema**:
```sql
ALTER TABLE tag_event_mappings ADD COLUMN day_number INTEGER DEFAULT 1;
ALTER TABLE tag_event_mappings ADD COLUMN total_days INTEGER DEFAULT 1;
ALTER TABLE tag_event_mappings ADD COLUMN israel_only BOOLEAN DEFAULT FALSE;
ALTER TABLE tag_event_mappings ADD COLUMN diaspora_only BOOLEAN DEFAULT FALSE;

-- Example: Rosh Hashana Day 1
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, day_number, total_days)
VALUES ((SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'), 'Rosh Hashana%', 1, 2);

-- Example: Pesach I (Israel: 1 day, Diaspora: 2 days)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, day_number, total_days, israel_only)
VALUES ((SELECT id FROM zman_tags WHERE tag_key = 'pesach_first'), 'Pesach I', 1, 1, TRUE);

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, day_number, total_days, diaspora_only)
VALUES ((SELECT id FROM zman_tags WHERE tag_key = 'pesach_first'), 'Pesach I', 1, 2, TRUE);
```

**Recommendation**: Keep separate tags for multi-day awareness
- ✅ `rosh_hashanah` - one tag for both days
- ✅ `pesach_first` - separate from `pesach_last`
- ✅ `sukkos` - separate from `chol_hamoed_sukkos`

**Reason**: Different zmanim for different days (e.g., Shemini Atzeres has different zmanim than Chol HaMoed)

### Question 3: Generic vs Specific Tags?

**ANSWER: Keep BOTH - they serve different purposes**

**Example**:
```sql
-- Specific tag (priority 10 = higher priority)
tag_id: asarah_bteves, pattern: "Asara B'Tevet", priority: 10

-- Generic tag (priority 50 = lower priority)
tag_id: fast_day, pattern: "Asara B'Tevet", priority: 50
```

**Why Both**:
1. **Specific tags** = zmanim unique to that fast (e.g., "Mincha on Asarah B'Teves")
2. **Generic tags** = zmanim common to all fasts (e.g., "Fast Ends")

**Use Cases**:
- Specific zman: "Chanukah candle lighting" → tag `event:chanukah`
- Generic zman: "Fast ends" → tag `category_fast_end` (shows on ALL fasts)

**Already Implemented**: Current system has both specific and generic tags

### Question 4: Migration Strategy?

**ANSWER: Automated SQL generation from HebCal API**

**Step 1: Fetch Complete HebCal Event List**
```bash
# Get all events for year 5786 (2025-2026)
curl "https://www.hebcal.com/hebcal?v=1&cfg=json&year=5786&il=false&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&o=on&s=off&c=off" \
  | jq -r '.items[] | .title' | sort -u
```

**Total Events**: ~120 unique event names (including Omer days)

**Step 2: Generate Migration SQL**
Create script to:
1. Fetch HebCal events
2. Compare with existing `tag_event_mappings`
3. Generate INSERT statements for missing events
4. Flag unmapped patterns (require manual review)

**Step 3: Validation Query**
```sql
-- Find HebCal events with no matching tag
WITH hebcal_events AS (
    -- Populated by script from HebCal API
    SELECT 'Rosh Hashana 9547' AS event_name
    UNION ALL SELECT 'Rosh Hashana II'
    -- ... all events
)
SELECT he.event_name
FROM hebcal_events he
LEFT JOIN tag_event_mappings tem ON
    (tem.hebcal_event_pattern = he.event_name OR
     he.event_name LIKE tem.hebcal_event_pattern)
WHERE tem.id IS NULL
ORDER BY he.event_name;
```

---

## Recommended Architecture

### Single Source of Truth: tag_event_mappings

**Database Schema (Updated)**:
```sql
CREATE TABLE tag_event_mappings (
    id SERIAL PRIMARY KEY,
    tag_id INTEGER NOT NULL REFERENCES zman_tags(id),
    hebcal_event_pattern VARCHAR(100),  -- SQL LIKE pattern
    day_number INTEGER DEFAULT 1,       -- NEW: Day 1, 2, etc.
    total_days INTEGER DEFAULT 1,       -- NEW: Total days in event
    israel_only BOOLEAN DEFAULT FALSE,  -- NEW: Only matches in Israel
    diaspora_only BOOLEAN DEFAULT FALSE, -- NEW: Only matches outside Israel
    hebrew_month INTEGER,               -- Optional: date-based matching
    hebrew_day_start INTEGER,
    hebrew_day_end INTEGER,
    priority INTEGER DEFAULT 100,       -- Lower = higher priority
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_mapping CHECK (
        hebcal_event_pattern IS NOT NULL OR
        (hebrew_month IS NOT NULL AND hebrew_day_start IS NOT NULL)
    ),
    CONSTRAINT not_both_locations CHECK (
        NOT (israel_only AND diaspora_only)
    )
);
```

### Tag Naming Convention

**Event Tags**: Use normalized Hebrew names with snake_case

| HebCal Event Name | Tag Key | Reason |
|------------------|---------|--------|
| `Rosh Hashana%` | `rosh_hashanah` | Normalized spelling |
| `Yom Kippur` | `yom_kippur` | Standard transliteration |
| `Sukkot I` | `sukkos` | Ashkenazi standard |
| `Pesach I` | `pesach_first` | Distinguish from last days |
| `Pesach VII` | `pesach_last` | Separate tag for 7th/8th days |
| `Shavuot%` | `shavuos` | Matches both I and II |
| `Chanukah%` | `chanukah` | Matches all 8 days |
| `Asara B'Tevet` | `asarah_bteves` | Specific fast |
| `*fast*` (any) | `fast_day` | Generic category tag |

**Rules**:
1. ✅ Use snake_case: `rosh_hashanah`, not `roshHashanah`
2. ✅ Use Ashkenazi default: `shavuos`, not `shavuot`
3. ✅ Normalize apostrophes: `asarah_bteves`, not `asara_b'tevet`
4. ✅ Separate multi-day events when they have different zmanim: `pesach_first` vs `pesach_last`
5. ✅ Use wildcard patterns for variations: `Rosh Hashana%` matches year-specific names

### Code Changes Required

#### 1. Delete Hardcoded Mapping Function
**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**DELETE** lines 310-425:
- `mapHolidayToEventCode()` - entire function
- `getFastStartType()` - move to database or category tags
- Hardcoded location logic

#### 2. Replace with Database Queries
**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**NEW** function:
```go
// GetActiveTagsForEvents returns tag keys for HebCal events using database patterns
func (s *CalendarService) GetActiveTagsForEvents(
    events []Holiday,
    isIsrael bool,
) []string {
    // 1. Load tag_event_mappings from database (cache this)
    mappings := s.db.LoadTagEventMappings(ctx)

    // 2. Filter by location
    filteredMappings := filterMappingsByLocation(mappings, isIsrael)

    // 3. Use existing MatchEventToTags() from hebcal.go
    hebcalEvents := convertHolidaysToHebCalEvents(events)
    tagKeys := MatchEventToTags(hebcalEvents, filteredMappings)

    return tagKeys
}
```

**Benefits**:
- ✅ Reuses existing pattern matching code
- ✅ Database-driven (no code changes for new events)
- ✅ Location-aware filtering
- ✅ Cacheable mappings

#### 3. Update GetZmanimContext
**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**BEFORE**:
```go
func (s *CalendarService) GetZmanimContext(...) ZmanimContext {
    // Hardcoded mapHolidayToEventCode() calls
    for _, h := range holidays {
        code, _, _ := mapHolidayToEventCode(h.Name, hd, loc.IsIsrael)
        if code != "" {
            activeEventCodes = append(activeEventCodes, code)
        }
    }
}
```

**AFTER**:
```go
func (s *CalendarService) GetZmanimContext(...) ZmanimContext {
    // Database-driven pattern matching
    holidays := s.GetHolidays(date)
    activeEventCodes := s.GetActiveTagsForEvents(holidays, loc.IsIsrael)

    return ZmanimContext{
        ActiveEventCodes: activeEventCodes,
    }
}
```

---

## Migration SQL

### Step 1: Alter Table Schema
```sql
-- Add new columns for multi-day and location logic
ALTER TABLE tag_event_mappings
    ADD COLUMN day_number INTEGER DEFAULT 1,
    ADD COLUMN total_days INTEGER DEFAULT 1,
    ADD COLUMN israel_only BOOLEAN DEFAULT FALSE,
    ADD COLUMN diaspora_only BOOLEAN DEFAULT FALSE,
    ADD CONSTRAINT not_both_locations CHECK (NOT (israel_only AND diaspora_only));

-- Add comments
COMMENT ON COLUMN tag_event_mappings.day_number IS 'Day number in multi-day events (1 for day 1, 2 for day 2)';
COMMENT ON COLUMN tag_event_mappings.total_days IS 'Total days in this event (location-aware)';
COMMENT ON COLUMN tag_event_mappings.israel_only IS 'This mapping only applies in Israel';
COMMENT ON COLUMN tag_event_mappings.diaspora_only IS 'This mapping only applies outside Israel';
```

### Step 2: Add Missing Event Tags

**Analysis of Current Gaps**:
```bash
# Current coverage: 42 tags with 60 mappings
# HebCal events: ~120 unique events

# Major gaps:
# - Modern holidays: Yom HaAtzma'ut, Yom HaShoah, Yom Yerushalayim
# - Minor observances: Tu BiShvat, Tu B'Av
# - Omer counting: Individual Omer days (49 days)
```

**Add Missing Tags**:
```sql
-- Modern holidays
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', 'Yom HaAtzmaut',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Yom HaAtzma''ut'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'yom_haatzmaut');

INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'yom_hashoah', 'יום השואה', 'Yom HaShoah', 'Yom HaShoah',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Yom HaShoah'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'yom_hashoah');

INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', 'Yom Yerushalayim',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Yom Yerushalayim'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'yom_yerushalayim');

INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', 'Yom HaZikaron',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Yom HaZikaron'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'yom_hazikaron');

INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'tu_bishvat', 'ט״ו בשבט', 'Tu BiShvat', 'Tu BiShvat',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Tu BiShvat'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'tu_bishvat');

INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT 'tu_bav', 'ט״ו באב', 'Tu B''Av', 'Tu B''Av',
       (SELECT id FROM tag_types WHERE key = 'event'),
       'Tu B''Av'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = 'tu_bav');

-- Add mappings for new tags
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Yom HaAtzma''ut', 10 FROM zman_tags WHERE tag_key = 'yom_haatzmaut';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Yom HaShoah', 10 FROM zman_tags WHERE tag_key = 'yom_hashoah';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Yom Yerushalayim', 10 FROM zman_tags WHERE tag_key = 'yom_yerushalayim';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Yom HaZikaron', 10 FROM zman_tags WHERE tag_key = 'yom_hazikaron';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Tu BiShvat', 10 FROM zman_tags WHERE tag_key = 'tu_bishvat';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, 'Tu B''Av', 10 FROM zman_tags WHERE tag_key = 'tu_bav';
```

### Step 3: Add Location-Specific Mappings

**Fix Yom Tov Sheni (Second day in Diaspora)**:
```sql
-- Update existing Pesach I/II mappings
UPDATE tag_event_mappings
SET total_days = 2, diaspora_only = TRUE
WHERE tag_id = (SELECT id FROM zman_tags WHERE tag_key = 'pesach_first')
  AND hebcal_event_pattern IN ('Pesach I', 'Pesach II');

-- Add Israel-only mapping (1 day)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, day_number, total_days, israel_only, priority)
SELECT id, 'Pesach I', 1, 1, TRUE, 10
FROM zman_tags WHERE tag_key = 'pesach_first';

-- Same for Shavuos, Sukkos, Shemini Atzeres
UPDATE tag_event_mappings
SET total_days = 2, diaspora_only = TRUE
WHERE tag_id = (SELECT id FROM zman_tags WHERE tag_key = 'shavuos')
  AND hebcal_event_pattern LIKE 'Shavuot%';

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, day_number, total_days, israel_only, priority)
SELECT id, 'Shavuot I', 1, 1, TRUE, 10
FROM zman_tags WHERE tag_key = 'shavuos';
```

---

## Validation Queries

### Query 1: Detect Missing Tag Mappings
```sql
-- Find HebCal events with no matching tag pattern
-- Run this with actual HebCal API data for year 5786

WITH hebcal_events AS (
    -- Replace with actual API response
    SELECT 'Rosh Hashana 9547' AS title UNION ALL
    SELECT 'Rosh Hashana II' UNION ALL
    SELECT 'Yom Kippur' UNION ALL
    SELECT 'Sukkot I' -- ... all events
)
SELECT he.title AS unmapped_event
FROM hebcal_events he
WHERE NOT EXISTS (
    SELECT 1 FROM tag_event_mappings tem
    WHERE he.title LIKE tem.hebcal_event_pattern
       OR tem.hebcal_event_pattern LIKE '%' || he.title || '%'
)
ORDER BY he.title;
```

### Query 2: Detect Orphaned Tag Patterns
```sql
-- Find tag patterns that don't match any real HebCal events
SELECT
    zt.tag_key,
    tem.hebcal_event_pattern,
    tem.priority
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
WHERE tem.hebcal_event_pattern NOT IN (
    -- Compare against actual HebCal API response
    SELECT title FROM (VALUES
        ('Rosh Hashana 9547'),
        ('Yom Kippur')
        -- ... all HebCal events
    ) AS hebcal(title)
)
ORDER BY zt.tag_key, tem.priority;
```

### Query 3: Validate Coverage Percentage
```sql
-- What percentage of HebCal events have tag mappings?
WITH hebcal_count AS (
    SELECT COUNT(*) as total FROM (VALUES
        ('Rosh Hashana 9547'), ('Yom Kippur') -- ... all events
    ) AS events(title)
),
mapped_count AS (
    SELECT COUNT(DISTINCT hebcal_event_pattern) as mapped
    FROM tag_event_mappings
    WHERE hebcal_event_pattern IS NOT NULL
)
SELECT
    m.mapped,
    h.total,
    ROUND(100.0 * m.mapped / h.total, 2) AS coverage_percent
FROM hebcal_count h, mapped_count m;
```

### Query 4: Detect Duplicate Mappings
```sql
-- Find multiple tags mapping to same event with same priority (potential conflicts)
SELECT
    tem.hebcal_event_pattern,
    tem.priority,
    COUNT(*) as tag_count,
    STRING_AGG(zt.tag_key, ', ' ORDER BY zt.tag_key) as tags
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
GROUP BY tem.hebcal_event_pattern, tem.priority
HAVING COUNT(*) > 1
ORDER BY tem.hebcal_event_pattern, tem.priority;
```

---

## Implementation Checklist

### Phase 1: Database Schema (No Code Changes)
- [ ] Run migration: Add columns to `tag_event_mappings`
- [ ] Add missing event tags (modern holidays, Tu BiShvat, etc.)
- [ ] Add location-specific mappings (Israel vs Diaspora)
- [ ] Run validation queries to verify coverage

### Phase 2: Code Refactoring
- [ ] Delete `mapHolidayToEventCode()` from `events.go`
- [ ] Delete `getFastStartType()` (move to database or category tags)
- [ ] Create `GetActiveTagsForEvents()` using database patterns
- [ ] Update `GetZmanimContext()` to use database patterns
- [ ] Add database query to load `tag_event_mappings` (with caching)

### Phase 3: Testing
- [ ] Verify Friday → `erev_shabbos` tag
- [ ] Verify Rosh Hashana → `rosh_hashanah` tag (both days)
- [ ] Verify Pesach I → `pesach_first` tag (Israel: 1 day, Diaspora: 2 days)
- [ ] Verify fast days → both specific tag AND `fast_day` generic tag
- [ ] Verify Chanukah → `chanukah` tag (all 8 days)
- [ ] Verify no unmapped HebCal events (run validation query)

### Phase 4: Continuous Validation
- [ ] Create automated script to fetch HebCal events and validate mappings
- [ ] Add to CI/CD: Monthly check for new HebCal events
- [ ] Document process for adding new events (just INSERT SQL, no code)

---

## Success Criteria

### Zero Drift
```bash
# This query should return 0 rows:
psql -c "SELECT unmapped_event FROM (
    -- validation query from above
) WHERE unmapped_event IS NOT NULL;"
```

### Zero Maintenance
- ✅ New HebCal events require ONLY SQL INSERT, no code changes
- ✅ Location logic in database, not hardcoded in Go
- ✅ Multi-day logic in database, not hardcoded in Go

### Complete Coverage
- ✅ All major holidays mapped (Rosh Hashana, Yom Kippur, Pesach, etc.)
- ✅ All fasts mapped (Tzom Gedaliah, Tisha B'Av, etc.)
- ✅ Modern holidays mapped (Yom HaAtzma'ut, Yom HaShoah, etc.)
- ✅ Omer counting mapped (generic pattern: `%day of the Omer`)
- ✅ Rosh Chodesh mapped (pattern: `Rosh Chodesh%`)

### Validation Automation
- ✅ Script to compare HebCal API with database
- ✅ Automated coverage percentage report
- ✅ CI/CD check for unmapped events

---

## Anti-Patterns to Avoid

❌ **DON'T**: Add new hardcoded cases to `mapHolidayToEventCode()`
✅ **DO**: Add new pattern to `tag_event_mappings` table

❌ **DON'T**: Hardcode location logic in Go code
✅ **DO**: Use `israel_only`/`diaspora_only` columns in database

❌ **DON'T**: Create separate tags for "Rosh Hashana I" and "Rosh Hashana II"
✅ **DO**: Use one tag `rosh_hashanah` with pattern `Rosh Hashana%`

❌ **DON'T**: Skip validation queries
✅ **DO**: Run validation after every migration

❌ **DON'T**: Assume HebCal events are static
✅ **DO**: Automate validation as part of CI/CD

---

## Next Steps

1. **Review this design** with team
2. **Run Phase 1 migration** (database schema changes)
3. **Validate coverage** with HebCal API for year 5786
4. **Implement Phase 2** (delete hardcoded logic, use database)
5. **Test thoroughly** (all scenarios in testing checklist)
6. **Automate validation** (CI/CD integration)

---

**END OF DESIGN**
