# Solution: Perfect HebCal-to-Tag Synchronization

**Date**: 2025-12-24
**Status**: Ready for Implementation
**Current Coverage**: 82.86% (116/140 events mapped)

---

## Executive Summary

**ANSWER: Delete `mapHolidayToEventCode()` - Use database-driven pattern matching**

The codebase already has all the infrastructure needed for perfect HebCal synchronization:
- ✅ `tag_event_mappings` table with SQL LIKE patterns
- ✅ Pattern matching code in `hebcal.go`
- ✅ Validation script that auto-generates missing mappings
- ✅ 82.86% coverage already (116/140 events)

**What's needed**: Delete hardcoded logic, use existing database patterns, add 24 missing event tags.

---

## Answers to Design Questions

### 1. Should we keep mapHolidayToEventCode()?

**NO - Delete it entirely**

**Rationale**:
- Database already has 60 pattern mappings covering 42 tags
- Pattern matching already implemented (`hebcal.go:194-240`)
- Hardcoded function creates dual-maintenance burden
- No validation possible with hardcoded logic

**Delete**:
- `/home/daniel/repos/zmanim/api/internal/calendar/events.go` lines 310-425
  - `mapHolidayToEventCode()` function
  - `getFastStartType()` function (move fast info to category tags or database)

**Replace with**:
```go
// Use existing MatchEventToTags() from hebcal.go
activeEventCodes := s.GetActiveTagsForEvents(holidays, loc.IsIsrael)
```

### 2. What about multi-day events?

**Use separate tags when zmanim differ, one tag when they don't**

**Examples**:

| Event | Tag Strategy | Reason |
|-------|-------------|--------|
| Rosh Hashana I & II | One tag: `rosh_hashanah` | Same zmanim both days |
| Pesach I & II | Separate: `pesach_first` | Different from middle/last days |
| Pesach VII & VIII | Separate: `pesach_last` | Different from first days |
| Chanukah 1-8 | One tag: `chanukah` | Shared zmanim across all days |
| Sukkos I & II | One tag: `sukkos` | Different from Chol HaMoed |
| Chol HaMoed | Separate tags: `chol_hamoed_sukkos`, `chol_hamoed_pesach` | Different zmanim |

**Database pattern**:
```sql
-- Rosh Hashana: one tag for both days
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'),
    'Rosh Hashana%'  -- Matches both "Rosh Hashana 9547" and "Rosh Hashana II"
);

-- Pesach: separate tags for first/last
-- First days
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'pesach_first'),
    'Pesach I'
), (
    (SELECT id FROM zman_tags WHERE tag_key = 'pesach_first'),
    'Pesach II'
);

-- Last days
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'pesach_last'),
    'Pesach VII'
), (
    (SELECT id FROM zman_tags WHERE tag_key = 'pesach_last'),
    'Pesach VIII'
);
```

### 3. Generic vs Specific Tags?

**Keep BOTH - they serve different purposes**

**Specific Tags**: Unique zmanim for that event
- Example: `chanukah` → "Chanukah candle lighting" zman
- Example: `asarah_bteves` → Specific fast-day rules

**Generic Tags**: Shared zmanim across event category
- Example: `fast_day` → "Fast ends" (shows on ALL fasts)
- Example: `category_candle_lighting` → Candle lighting time (shows on all erev events)

**Current Database**:
```sql
-- Already implemented correctly with priority system
SELECT * FROM tag_event_mappings WHERE hebcal_event_pattern = 'Tzom Gedaliah';

-- Returns TWO mappings:
-- 1. tag_id=92 (tzom_gedaliah) priority=10 - SPECIFIC
-- 2. tag_id=244 (fast_day) priority=50 - GENERIC
```

**Priority System**:
- Lower priority number = higher priority
- Specific tags (priority 10) match first
- Generic tags (priority 50) also match but are lower priority

**Use Cases**:
- Zman with tag `event:asarah_bteves` → Only shows on this fast
- Zman with tag `event:fast_day` → Shows on ALL fasts (Gedaliah, Asarah B'Teves, etc.)
- Zman with tag `category_candle_lighting` → Shows on erev Shabbos, erev Yom Tov, etc.

### 4. Migration Strategy?

**Automated SQL generation + validation**

**Phase 1: Current State** ✅
- Validation script created: `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh`
- Coverage analyzed: 82.86% (116/140 events mapped)
- Migration SQL auto-generated: `/home/daniel/repos/zmanim/db/migrations/20251224204010_add_missing_hebcal_events.sql`

**Phase 2: Add Missing Events** (24 unmapped events)

**Unmapped Events**:
```
Fast Days (3):
- Asara B'Tevet (tag exists, mapping missing - likely exact match issue)
- Ta'anit Bechorot (mapping exists but pattern broken)
- Ta'anit Esther (mapping exists but pattern broken)
- Tish'a B'Av (mapping exists but pattern broken)
- Erev Tish'a B'Av (mapping exists but pattern broken)

Chol HaMoed Days (8):
- Pesach III (CH'M), IV, V, VI
- Sukkot III (CH'M), IV, V, VI
(These exist in seed data but exact match failed - apostrophe issue)

Modern Holidays (6):
- Yom HaAtzma'ut
- Yom HaShoah
- Yom HaZikaron
- Yom Yerushalayim
- Yom HaAliyah
- Sigd

Minor Observances (5):
- Tu B'Av
- Erev Purim
- Purim Katan
- Shushan Purim Katan
- Leil Selichot
```

**Root Cause**: Most "unmapped" events are **apostrophe mismatch issues**
- Database: `Asara B'Tevet` (straight apostrophe)
- HebCal API: `Asara B'Tevet` (curly apostrophe)
- Pattern matching fails due to exact character difference

**Fix**: Update patterns to handle both apostrophe types OR normalize input

**Phase 3: Validation Query**
```sql
-- Run after migration
SELECT
    COUNT(*) FILTER (WHERE mapped) as mapped,
    COUNT(*) FILTER (WHERE NOT mapped) as unmapped,
    ROUND(100.0 * COUNT(*) FILTER (WHERE mapped) / COUNT(*), 2) as coverage
FROM (
    SELECT
        he.title,
        EXISTS (
            SELECT 1 FROM tag_event_mappings tem
            WHERE he.title LIKE tem.hebcal_event_pattern
        ) as mapped
    FROM hebcal_events he
) coverage;

-- Target: 100% coverage
```

---

## Recommended Architecture

### Single Source of Truth: Database

**Before (WRONG)**:
```
HebCal API → mapHolidayToEventCode() [HARDCODED] → event codes
                    ↓
            Must update Go code for new events
```

**After (CORRECT)**:
```
HebCal API → tag_event_mappings [DATABASE] → event codes
                    ↓
            Just INSERT SQL for new events
```

### Tag Naming Convention

**Rules**:
1. ✅ snake_case: `rosh_hashanah` not `roshHashanah`
2. ✅ Ashkenazi default: `shavuos` not `shavuot`
3. ✅ Normalize apostrophes: `asarah_bteves` not `asara_b'tevet`
4. ✅ Wildcards for variations: `Rosh Hashana%` matches year-specific names
5. ✅ Exact match for specific days: `Pesach I` (not wildcard)

**Examples**:
```sql
-- Good patterns
'Rosh Hashana%'        → Matches "Rosh Hashana 9547", "Rosh Hashana II"
'Shavuot%'             → Matches "Shavuot I", "Shavuot II"
'Chanukah%'            → Matches "Chanukah: 1 Candle", "Chanukah: 8 Candles"
'%day of the Omer'     → Matches "1st day of the Omer", "33rd day of the Omer"
'Rosh Chodesh%'        → Matches "Rosh Chodesh Nisan", "Rosh Chodesh Elul"

-- Exact matches for multi-day events
'Pesach I'             → First day only
'Pesach II'            → Second day only
'Sukkot VII (Hoshana Raba)' → Specific day
```

### Database Schema (Current - No Changes Needed)

```sql
-- Already correct!
CREATE TABLE tag_event_mappings (
    id SERIAL PRIMARY KEY,
    tag_id INTEGER REFERENCES zman_tags(id),
    hebcal_event_pattern VARCHAR(100),  -- SQL LIKE pattern
    hebrew_month INTEGER,               -- Optional: date-based matching
    hebrew_day_start INTEGER,
    hebrew_day_end INTEGER,
    priority INTEGER DEFAULT 100,       -- Lower = higher priority
    created_at TIMESTAMP DEFAULT NOW()
);

-- Example mappings
INSERT INTO tag_event_mappings VALUES
    (1, 278, 'Rosh Hashana%', NULL, NULL, NULL, 10),  -- Specific
    (2, 34, 'Yom Kippur', NULL, NULL, NULL, 10),      -- Exact
    (26, 92, 'Tzom Gedaliah', NULL, NULL, NULL, 10),  -- Specific fast
    (33, 244, 'Tzom Gedaliah', NULL, NULL, NULL, 50); -- Generic fast_day
```

**Future Enhancement** (optional):
```sql
-- If location-specific logic needed later
ALTER TABLE tag_event_mappings
    ADD COLUMN israel_only BOOLEAN DEFAULT FALSE,
    ADD COLUMN diaspora_only BOOLEAN DEFAULT FALSE,
    ADD COLUMN day_number INTEGER DEFAULT 1,
    ADD COLUMN total_days INTEGER DEFAULT 1;
```

---

## Implementation Steps

### Step 1: Fix Apostrophe Issue ⚠️ CRITICAL

**Problem**: Database patterns use straight apostrophes `'` but HebCal API returns curly `'`

**Solution A: Normalize HebCal input** (RECOMMENDED)
```go
// In hebcal.go:MatchEventToTags()
func normalizeTitle(title string) string {
    // Replace curly apostrophes with straight
    title = strings.ReplaceAll(title, "'", "'")
    title = strings.ReplaceAll(title, "'", "'")
    return title
}

func MatchEventToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
    for _, event := range events {
        title := normalizeTitle(event.Title)
        for _, mapping := range mappings {
            if matchPattern(title, mapping.Pattern) {
                // ...
            }
        }
    }
}
```

**Solution B: Update database patterns** (ALTERNATIVE)
```sql
-- Replace all straight apostrophes with curly in patterns
UPDATE tag_event_mappings
SET hebcal_event_pattern = REPLACE(hebcal_event_pattern, '''', ''')
WHERE hebcal_event_pattern LIKE '%''%';
```

### Step 2: Apply Migration SQL

```bash
# 1. Review generated migration
cat db/migrations/20251224204010_add_missing_hebcal_events.sql

# 2. Update Hebrew display names (TODO)
# Edit the migration to add proper Hebrew names for:
# - Modern holidays (יום העצמאות, יום השואה, etc.)
# - Minor observances (ט״ו באב, פורים קטן, etc.)

# 3. Apply migration
source api/.env
psql "$DATABASE_URL" -f db/migrations/20251224204010_add_missing_hebcal_events.sql

# 4. Validate 100% coverage
./scripts/validate-hebcal-coverage.sh 5786
# Should report: Coverage: 100.00%
```

### Step 3: Delete Hardcoded Logic

**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**DELETE** these functions:
```bash
# Lines 310-425
# - mapHolidayToEventCode() - entire function (103 lines)
# - getFastStartType() - move to category tags
```

**REPLACE** in `holidayToActiveEvent()` (line ~283):
```go
// OLD (line 286):
code, dayNum, totalDays := mapHolidayToEventCode(h.Name, hd, loc.IsIsrael)
if code == "" {
    return nil
}

// NEW:
// Use database-driven pattern matching via hebcal.MatchEventToTags()
// This requires refactoring to:
// 1. Load tag_event_mappings from database (with caching)
// 2. Call MatchEventToTags() with HebCal events
// 3. Return matched tags

// See DESIGN-hebcal-tag-sync.md "Code Changes Required" section
```

### Step 4: Update GetZmanimContext

**File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**Add new method**:
```go
// GetActiveTagsForEvents returns tag keys for HebCal events using database patterns
func (s *CalendarService) GetActiveTagsForEvents(
    events []Holiday,
    isIsrael bool,
) []string {
    // 1. Convert Holiday to HebCalEvent
    hebcalEvents := make([]calendar.HebCalEvent, len(events))
    for i, h := range events {
        hebcalEvents[i] = calendar.HebCalEvent{
            Title:    h.Name,
            Category: h.Category,
            Hebrew:   h.NameHebrew,
        }
    }

    // 2. Load mappings from database (implement caching)
    mappings := s.loadTagEventMappings()

    // TODO: Filter by isIsrael if israel_only/diaspora_only columns added

    // 3. Use existing pattern matching from hebcal.go
    tagKeys := calendar.MatchEventToTags(hebcalEvents, mappings)

    return tagKeys
}

// Cache tag_event_mappings to avoid DB query on every request
func (s *CalendarService) loadTagEventMappings() []calendar.TagEventMapping {
    // TODO: Implement with sync.Map or similar caching
    // Reload every 1 hour or on cache miss
}
```

**Update GetZmanimContext**:
```go
func (s *CalendarService) GetZmanimContext(...) ZmanimContext {
    holidays := s.GetHolidays(date)

    // OLD: Hardcoded mapHolidayToEventCode()
    // NEW: Database-driven pattern matching
    activeEventCodes := s.GetActiveTagsForEvents(holidays, loc.IsIsrael)

    // Add Shabbat manually (not from HebCal)
    if date.Weekday() == time.Saturday {
        activeEventCodes = appendUnique(activeEventCodes, "shabbos")
    }
    if date.Weekday() == time.Friday {
        activeEventCodes = appendUnique(activeEventCodes, "erev_shabbos")
    }

    return ZmanimContext{
        ActiveEventCodes: activeEventCodes,
    }
}
```

### Step 5: Add Database Query

**File**: Create `/home/daniel/repos/zmanim/api/internal/db/queries/tag_events.sql`

```sql
-- name: GetTagEventMappings :many
SELECT
    tem.id,
    tem.tag_id,
    zt.tag_key,
    tem.hebcal_event_pattern,
    tem.hebrew_month,
    tem.hebrew_day_start,
    tem.hebrew_day_end,
    tem.priority
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
ORDER BY tem.priority ASC, tem.id ASC;
```

**Run sqlc**:
```bash
cd api
sqlc generate
```

**Use in CalendarService**:
```go
func (s *CalendarService) loadTagEventMappings() []calendar.TagEventMapping {
    ctx := context.Background()
    rows, err := s.db.Queries.GetTagEventMappings(ctx)
    if err != nil {
        slog.Error("failed to load tag event mappings", "error", err)
        return nil
    }

    mappings := make([]calendar.TagEventMapping, len(rows))
    for i, row := range rows {
        mappings[i] = calendar.TagEventMapping{
            TagKey:   row.TagKey,
            Pattern:  row.HebcalEventPattern.String, // sql.NullString
            Priority: int(row.Priority),
        }
    }
    return mappings
}
```

### Step 6: Testing

**Test Cases**:
```bash
# Friday → should include erev_shabbos
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26" | \
  jq '.context.active_event_codes'
# Expected: ["erev_shabbos"]

# Rosh Hashana I → should include rosh_hashanah
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-10-03" | \
  jq '.context.active_event_codes'
# Expected: ["rosh_hashanah"]

# Asarah B'Teves → should include BOTH asarah_bteves AND fast_day
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-01-09" | \
  jq '.context.active_event_codes'
# Expected: ["asarah_bteves", "fast_day"]

# Regular weekday → empty or just weekday events
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24" | \
  jq '.context.active_event_codes'
# Expected: []
```

---

## Validation & Continuous Sync

### Automated Coverage Check

**Run monthly in CI/CD**:
```bash
# Add to .github/workflows/monthly-validation.yml
name: HebCal Coverage Validation
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of each month
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate HebCal coverage
        run: |
          ./scripts/validate-hebcal-coverage.sh 5786
          ./scripts/validate-hebcal-coverage.sh 5787  # Next year
```

### Manual Validation

```bash
# Check current year
./scripts/validate-hebcal-coverage.sh 5786

# Check next year (before Rosh Hashana)
./scripts/validate-hebcal-coverage.sh 5787

# Check Israel-specific events
./scripts/validate-hebcal-coverage.sh 5786 true
```

### Adding New Events

**When HebCal adds a new event**:

1. Run validation script
```bash
./scripts/validate-hebcal-coverage.sh 5786
# Script auto-generates migration SQL
```

2. Review generated migration
```bash
cat db/migrations/[timestamp]_add_missing_hebcal_events.sql
```

3. Update Hebrew names and display names
```sql
-- Edit the generated SQL
INSERT INTO zman_tags (tag_key, display_name_hebrew, ...)
SELECT 'new_event', 'שם עברי', 'English Ashkenazi', 'English Sephardi', ...
```

4. Apply migration
```bash
source api/.env
psql "$DATABASE_URL" -f db/migrations/[timestamp]_add_missing_hebcal_events.sql
```

5. Validate 100% coverage
```bash
./scripts/validate-hebcal-coverage.sh 5786
# Should report: Coverage: 100.00%
```

**NO CODE CHANGES NEEDED** - only SQL!

---

## Success Criteria

### ✅ Zero Hardcoded Logic
```bash
# Should return 0 results:
grep -r "mapHolidayToEventCode" api/internal/
grep -r "getFastStartType" api/internal/
```

### ✅ Perfect Coverage
```bash
./scripts/validate-hebcal-coverage.sh 5786
# Expected output:
# Coverage: 100.00%
# ✓ All events are mapped!
```

### ✅ Database-Driven
```bash
# New events require ONLY SQL, not code
# Test by adding a fake event:
psql "$DATABASE_URL" -c "
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES ('test_event', 'Test', 'Test', (SELECT id FROM tag_types WHERE key = 'event'));

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'Test Event' FROM zman_tags WHERE tag_key = 'test_event';
"

# Verify pattern matching works immediately (no code deploy needed)
```

### ✅ Automated Validation
- [ ] CI/CD runs coverage check monthly
- [ ] Script alerts on <100% coverage
- [ ] Migration SQL auto-generated for missing events

---

## Files Modified Summary

| File | Action | Lines |
|------|--------|-------|
| **DELETE** |
| `api/internal/calendar/events.go` | Delete `mapHolidayToEventCode()` | 310-425 |
| **CREATE** |
| `scripts/validate-hebcal-coverage.sh` | ✅ Created | Validation script |
| `db/migrations/20251224204010_add_missing_hebcal_events.sql` | ✅ Generated | Add 24 missing tags |
| `api/internal/db/queries/tag_events.sql` | Create query | New file |
| **MODIFY** |
| `api/internal/calendar/events.go` | Add `GetActiveTagsForEvents()` | New method |
| `api/internal/calendar/events.go` | Update `GetZmanimContext()` | Replace hardcoded calls |
| `api/internal/calendar/hebcal.go` | Add `normalizeTitle()` | Fix apostrophe issue |

---

## Next Steps

1. ✅ **Review this solution** - design approved?
2. **Fix apostrophe normalization** - implement in `hebcal.go`
3. **Apply migration SQL** - add 24 missing event tags
4. **Delete hardcoded functions** - remove `mapHolidayToEventCode()`
5. **Implement database queries** - add sqlc query for tag_event_mappings
6. **Update GetZmanimContext** - use database patterns
7. **Test thoroughly** - verify all test cases pass
8. **Add CI/CD validation** - monthly coverage checks

**Estimated Effort**: 2-4 hours
- 30 min: Fix apostrophe + apply migration
- 1 hour: Delete hardcoded code, add database queries
- 1 hour: Update GetZmanimContext, caching
- 30 min: Testing
- 30 min: CI/CD setup

---

**END OF SOLUTION**
