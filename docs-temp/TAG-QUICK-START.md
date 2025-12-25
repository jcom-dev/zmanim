# Tag-Driven Events - Quick Start Guide

**For developers joining the project**

---

## Core Concept

**Tags control WHEN zmanim appear. Formulas control HOW they're calculated.**

```
User requests zmanim for date → HebCal says "Erev Shabbos" → System shows candle lighting
                                     ↓
                        Event mapped to tag: erev_shabbos
                                     ↓
                        Zmanim tagged with erev_shabbos appear
```

---

## 5-Minute Understanding

### The Flow

```
1. User: "Show me zmanim for December 26, 2025 in Jerusalem"
2. System: Calls HebCal API → Gets "Erev Shabbos"
3. System: Maps "Erev Shabbos" → tag_key: "erev_shabbos" (via SQL)
4. System: Filters zmanim → Only include zmanim tagged with "erev_shabbos"
5. System: Calculates formulas → Returns results
```

### The Tables

```sql
-- What tags exist?
SELECT * FROM zman_tags WHERE tag_type_id = 170;  -- Event tags

-- How do HebCal events map to tags?
SELECT * FROM tag_event_mappings;

-- Which zmanim have which tags?
SELECT * FROM publisher_zman_tags;
```

### The Code

```go
// Get events for date
hebcalEvents := GetHebCalEvents(ctx, date, location)
// ["Erev Shabbos", "Chanukah: 3 Candles"]

// Map to tag keys (SQL pattern matching)
activeEventCodes := getActiveEventCodes(ctx, hebcalEvents)
// ["erev_shabbos", "chanukah"]

// Filter and calculate
result := service.CalculateZmanim(ctx, CalculateParams{
    ActiveEventCodes: activeEventCodes,  // Service filters by tags
})
```

---

## Common Tasks

### Task 1: Add a New Jewish Event

**Scenario**: HebCal added "Yom HaBahir" and we need to support it

```sql
-- 1. Add the tag
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES ('yom_habahir', 'יום הבחיר', 'Yom HaBahir', 170);

-- 2. Map HebCal event to tag
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_pattern)
SELECT id, 'Yom HaBahir', false
FROM zman_tags WHERE tag_key = 'yom_habahir';

-- 3. Assign tag to relevant zmanim
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id)
SELECT
    pz.id,
    zt.id
FROM publisher_zmanim pz
CROSS JOIN zman_tags zt
WHERE pz.zman_key IN ('shacharis', 'mincha_gedolah')
  AND zt.tag_key = 'yom_habahir'
  AND pz.publisher_id = 2;  -- For specific publisher
```

**DONE!** No code changes needed.

### Task 2: Debug Why a Zman Isn't Showing

```sql
-- Check 1: Does the zman have the right tag?
SELECT zt.tag_key, zt.display_name_english_ashkenazi
FROM publisher_zman_tags pzt
JOIN zman_tags zt ON pzt.tag_id = zt.id
JOIN publisher_zmanim pz ON pzt.publisher_zman_id = pz.id
WHERE pz.zman_key = 'hadlakas_neiros'
  AND pz.publisher_id = 2;

-- Check 2: Is the event mapped correctly?
SELECT tem.hebcal_event_pattern, tem.is_pattern, zt.tag_key
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
WHERE tem.hebcal_event_pattern = 'Erev Shabbos';

-- Check 3: What did HebCal return? (check API logs)
-- GET /api/v1/zmanim?locality_id=X&date=Y
-- Look for "active_event_codes" in response JSON
```

### Task 3: Add a Zman That Shows on Multiple Events

```sql
-- Example: Plag HaMincha shows on weekdays AND Shabbos AND Yom Tov

-- 1. Create the zman (if not exists)
INSERT INTO publisher_zmanim (publisher_id, zman_key, formula_text)
VALUES (2, 'plag_hamincha', 'solar(4.625)');

-- 2. Tag it with ALL relevant events
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id)
SELECT
    (SELECT id FROM publisher_zmanim WHERE zman_key = 'plag_hamincha' AND publisher_id = 2),
    id
FROM zman_tags
WHERE tag_key IN ('weekday', 'shabbos', 'yom_tov');
```

**Tag Matching Logic**: If ANY tag matches, the zman shows (OR logic)

### Task 4: Create Event-Specific Variation

```sql
-- Example: Different candle lighting times for Shabbos vs. Yom Tov

-- Option A: Single zman with both tags (same formula)
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id)
SELECT pz.id, zt.id
FROM publisher_zmanim pz
CROSS JOIN zman_tags zt
WHERE pz.zman_key = 'hadlakas_neiros'
  AND pz.publisher_id = 2
  AND zt.tag_key IN ('erev_shabbos', 'erev_yom_tov');

-- Option B: Separate zmanim (different formulas)
INSERT INTO publisher_zmanim (publisher_id, zman_key, formula_text)
VALUES
    (2, 'hadlakas_neiros_shabbos', 'sunset - 18min'),
    (2, 'hadlakas_neiros_yom_tov', 'sunset - 40min');

INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id)
VALUES
    ((SELECT id FROM publisher_zmanim WHERE zman_key = 'hadlakas_neiros_shabbos'),
     (SELECT id FROM zman_tags WHERE tag_key = 'erev_shabbos')),
    ((SELECT id FROM publisher_zmanim WHERE zman_key = 'hadlakas_neiros_yom_tov'),
     (SELECT id FROM zman_tags WHERE tag_key = 'erev_yom_tov'));
```

---

## Tag Types

```sql
-- Event Tags (170) - When to show
erev_shabbos, chanukah, yom_kippur, etc.

-- Category Tags (180) - Grouping for filtering
fast_days, yamim_tovim, shabbos, etc.

-- Modifier Tags (190) - Special behaviors
hadlakas_neiros, tzeis_taanis, etc.

-- Hidden Tags (200) - Advanced/rare
advanced_opinion, rare_minhag, etc.
```

**Most common use**: Event Tags (170)

---

## Pattern Matching

### Exact Match

```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_pattern)
VALUES (101, 'Erev Shabbos', false);
```

Matches ONLY: "Erev Shabbos"

### Wildcard Match

```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_pattern)
VALUES (107, 'Chanukah%', true);
```

Matches: "Chanukah: 1 Candle", "Chanukah: 2 Candles", ..., "Chanukah: 8 Candles"

### Multiple Patterns for Same Tag

```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_pattern)
VALUES
    (115, 'Pesach', false),
    (115, 'Pesach I', false),
    (115, 'Pesach II', false),
    (115, 'Pesach%', true);
```

All map to same tag: `pesach`

---

## Code Patterns

### DO ✅

```go
// Let the service filter by tags
activeEventCodes := getActiveEventCodes(ctx, hebcalEvents)
result := service.CalculateZmanim(ctx, CalculateParams{
    ActiveEventCodes: activeEventCodes,
})
```

```go
// Add new event support via SQL migration
// (No code changes needed)
```

```go
// Trust the database for event logic
if err := queries.CreateTagEventMapping(ctx, params); err != nil {
    return err
}
```

### DON'T ❌

```go
// NEVER check dates/events in code
if isErevShabbos {
    showCandleLighting = true  // ❌
}
```

```go
// NEVER hardcode event lists
specialDays := []string{"Pesach", "Sukkos", "Shavuos"}  // ❌
```

```go
// NEVER bypass tag filtering
if zman.Key == "hadlakas_neiros" {
    // always show  // ❌
}
```

---

## Testing

### Test a Specific Date

```bash
# 1. Check what HebCal returns
curl "https://www.hebcal.com/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&start=2025-12-26&end=2025-12-26&geo=geoname&geonameid=281184"

# 2. Check what our API returns
source api/.env
TOKEN=$(node scripts/get-test-token.js)
curl -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=281184&date=2025-12-26" | jq '.active_event_codes'

# 3. Check which zmanim have matching tags
source api/.env
psql "$DATABASE_URL" -c "
SELECT pz.zman_key, array_agg(zt.tag_key) as tags
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
JOIN zman_tags zt ON pzt.tag_id = zt.id
WHERE pz.publisher_id = 2
GROUP BY pz.zman_key
ORDER BY pz.zman_key;
"
```

### Run Tag-Driven Tests

```bash
cd api
go test -v ./internal/calendar -run TestTagDriven
go test -v ./internal/calendar -run TestEventCoverage
go test -v ./internal/handlers -run TestZmanimIntegration
```

---

## Debugging Checklist

**Zman not showing when expected?**

1. ✓ Check HebCal API response for the date
2. ✓ Verify event is in `tag_event_mappings`
3. ✓ Confirm zman has the right tag in `publisher_zman_tags`
4. ✓ Check `active_event_codes` in API response JSON
5. ✓ Review service filtering logic logs

**Event not being recognized?**

1. ✓ Check exact spelling in `tag_event_mappings.hebcal_event_pattern`
2. ✓ Verify `is_pattern` flag (true for wildcards, false for exact)
3. ✓ Ensure tag exists in `zman_tags` with correct tag_type_id (170 for events)

**New tag not working?**

1. ✓ Verify tag_type_id is correct (170 = event tags)
2. ✓ Check tag_key follows naming convention (lowercase, underscores)
3. ✓ Ensure mapping exists in `tag_event_mappings`
4. ✓ Confirm zmanim are tagged in `publisher_zman_tags`

---

## SQL Cheat Sheet

```sql
-- List all event tags
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE tag_type_id = 170
ORDER BY display_name_english_ashkenazi;

-- Show event mappings
SELECT
    zt.tag_key,
    tem.hebcal_event_pattern,
    tem.is_pattern
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
ORDER BY zt.tag_key;

-- Find zmanim for specific tag
SELECT
    pz.zman_key,
    pz.formula_text,
    zt.tag_key
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
JOIN zman_tags zt ON pzt.tag_id = zt.id
WHERE zt.tag_key = 'erev_shabbos'
  AND pz.publisher_id = 2;

-- Find tags for specific zman
SELECT
    zt.tag_key,
    zt.display_name_english_ashkenazi,
    zt.tag_type_id
FROM publisher_zman_tags pzt
JOIN zman_tags zt ON pzt.tag_id = zt.id
JOIN publisher_zmanim pz ON pzt.publisher_zman_id = pz.id
WHERE pz.zman_key = 'hadlakas_neiros'
  AND pz.publisher_id = 2;

-- Test event code lookup
SELECT get_event_codes_for_hebcal_events(ARRAY['Erev Shabbos', 'Chanukah: 3 Candles']);
```

---

## Resources

**Full Documentation**:
- `/docs/architecture/tag-driven-events.md` - Complete architecture guide
- `/docs/migration/eliminate-hardcoded-logic.md` - Migration details
- `/CHANGELOG-tag-driven.md` - User-facing changes

**Test Files**:
- `/api/internal/calendar/events_test.go` - HebCal integration tests
- `/api/internal/calendar/events_tag_driven_test.go` - Tag logic tests

**Key Code Files**:
- `/api/internal/calendar/hebcal.go` - HebCal API integration
- `/api/internal/calendar/db_adapter.go` - Database queries
- `/api/internal/services/zmanim_service.go` - Tag filtering logic

**Validation Scripts**:
- `/scripts/validate-hebcal-coverage.sh` - Ensure all events mapped
- `/scripts/validate-no-hardcoded-logic.sh` - Scan for forbidden patterns

---

## Support

**Questions?**
- Check `/docs/architecture/tag-driven-events.md` for deep dive
- Run validation scripts to verify setup
- Review test files for examples

**Found a bug?**
- Check if it's a tag mapping issue (SQL)
- Review active_event_codes in API response
- Verify HebCal API returned expected events

**Need to add event support?**
- SQL only! No code changes needed
- Follow "Task 1: Add a New Jewish Event" above
- Test with validation scripts

---

## TL;DR

1. **Tags control WHEN zmanim appear**
2. **Event logic lives in SQL, not code**
3. **Adding events = SQL INSERT, no deployment**
4. **Pattern matching supports wildcards (Chanukah%)**
5. **Tag matching is OR logic (any match = show)**
6. **Check active_event_codes in API response for debugging**

**Golden Rule**: If you're writing `if (isErevShabbos)` in Go code, you're doing it wrong. Use tags.
