# Story 9.12: Hebrew Calendar Tag Resolution System

**Epic:** Epic 9 - API Restructuring & Endpoint Cleanup
**Status:** Ready for Dev
**Priority:** Low (Feature implementation)
**Story Points:** 5

---

## User Story

**As a** zmanim formula creator,
**I want** to assign event tags to zmanim and have the system automatically filter which zmanim to show based on the Hebrew calendar,
**So that** different zmanim appear on different days without embedding conditional logic in formulas.

---

## Context

The DSL formula executor currently has no Hebrew calendar awareness. This prevents the system from showing different zmanim on Shabbos vs weekdays, or Yom Tov vs regular days.

**Key Design Principle:**
- Formulas should be **pure calculations** (e.g., `sunset - 18min`)
- **When** a zman applies is determined by **tags**, not DSL conditionals
- The execution engine **filters** zmanim by matching active tags to the current day

**Source TODOs:**
- `api/internal/dsl/dsl.go:353` - Related to Yom Tov detection
- `api/internal/dsl/dsl.go:390` - Related to Hebrew calendar

**Current State:**
- Tag infrastructure exists (`zman_tags`, `master_zman_tags`, `publisher_zman_tags`)
- Tags have `is_negated` support for exclusion logic
- HebCal client exists (`api/internal/calendar/hebcal.go`)
- `tag_event_mappings` table exists but is **empty** (no mappings)
- No service-layer tag filtering when returning zmanim

**Target State:**
- Populate `tag_event_mappings` with HebCal event patterns
- Service layer detects active tags for a date via HebCal
- Zmanim filtered by matching tags (include) and negated tags (exclude)
- No DSL conditional functions needed

---

## Design: Tag-Driven Zman Selection

### Example: Candle Lighting Times

**Instead of:**
```
# BAD: Conditional logic in formula
formula: "if(IsYomTov, sunset - 18min, sunset - 40min)"
```

**Use:**
```
# GOOD: Two separate zmanim with tags

Zman: "Candle Lighting (Shabbos)"
  formula: "sunset - 18min"
  tags: [shabbos, day_before]
  negated_tags: [yom_tov]  # Don't show on Yom Tov

Zman: "Candle Lighting (Yom Tov)"
  formula: "sunset - 18min"
  tags: [yom_tov, day_before]

Zman: "Candle Lighting (Weekday before Yom Tov)"
  formula: "sunset - 40min"
  tags: [yom_tov, day_before]
  negated_tags: [shabbos]  # Not if it's also erev Shabbos
```

### Tag Matching Logic

For a zman to display on a given date:
1. **All positive tags** must be active on that date
2. **No negated tags** may be active on that date

```sql
-- Pseudocode for filtering
SELECT z.* FROM zmanim z
WHERE
  -- All required tags are active today
  NOT EXISTS (
    SELECT 1 FROM zman_tags zt
    WHERE zt.zman_id = z.id
      AND zt.is_negated = false
      AND zt.tag_key NOT IN (active_tags_today)
  )
  -- No excluded tags are active today
  AND NOT EXISTS (
    SELECT 1 FROM zman_tags zt
    WHERE zt.zman_id = z.id
      AND zt.is_negated = true
      AND zt.tag_key IN (active_tags_today)
  )
```

---

## Tag Audit & Recommendations

### Timing Tags (type: `timing`)

| Tag | Status | Rationale |
|-----|--------|-----------|
| `day_before` | **KEEP** | Zman appears on calendar day before the event (e.g., candle lighting on Friday for Shabbos) |
| `day_of` | **REMOVE** | Redundant - absence of timing tag = same day |
| `night_after` | **REMOVE** | Not needed - havdalah is still ON Shabbos (Saturday), just evening; the formula (`tzeis`) handles the time |

**Key Insight:** Timing tags answer "which calendar day?" not "what time of day?" The formula itself handles time constraints (before sunset, after tzeis, etc.).

**Examples:**
- Candle lighting: `day_before` + `shabbos` = appears on Friday. Formula `sunset - 18min` ensures correct time.
- Havdalah: `shabbos` (no timing tag) = appears on Saturday. Formula `tzeis` ensures it's after nightfall.
- Mincha: `shabbos` (no timing tag) = appears on Saturday. Formula handles afternoon timing.

### Event Tags (type: `event`)

| Tag | Status | Rationale |
|-----|--------|-----------|
| `shabbos` | **KEEP** | Core event |
| `yom_tov` | **KEEP** | Core event (biblical holidays) |
| `yom_kippur` | **KEEP** | Unique restrictions (no leather, etc.) |
| `fast_day` | **KEEP** | Minor fasts have different rules |
| `tisha_bav` | **KEEP** | Major fast with unique rules |
| `pesach` | **RENAME** to `chametz_times` | Currently named "Erev Pesach" but tag is `pesach` |

### Jewish Day Tags (type: `jewish_day`) - Audit

These are specific days/periods. Evaluate which need `erev_*` variants:

| Tag | Has Erev? | Needs Erev? | Notes |
|-----|-----------|-------------|-------|
| `shabbos` | No (use `day_before`) | N/A | `day_before` + `shabbos` = erev shabbos |
| `rosh_hashanah` | Yes (`erev_rosh_hashanah`) | **Already has** | |
| `yom_kippur` | Yes (`erev_yom_kippur`) | **Already has** | |
| `sukkos` | Yes (`erev_sukkos`) | **Already has** | |
| `pesach` | Confusing (`pesach` = erev, `erev_pesach` also exists) | **Fix duplicate** | |
| `shavuos` | Yes (`erev_shavuos`) | **Already has** | |
| `chanukah` | No | No | No special erev zmanim |
| `purim` | No | No | Taanis Esther is separate |
| `tisha_bav` | Yes (`erev_tisha_bav`) | **Already has** | |

### Recommended Tag Cleanup

1. **Remove `day_of`** - redundant
2. **Rename `pesach` (id 186)** to `chametz_times` - it's specifically for chametz deadlines
3. **Keep `erev_pesach` (id 67)** - for Erev Pesach day

---

## Acceptance Criteria

### AC1: Tag Event Mappings Populated
**Given** the `tag_event_mappings` table
**When** a HebCal event occurs
**Then** the correct tag is activated via pattern matching

### AC2: Shabbos Detection
**Given** a Saturday date
**When** resolving active tags
**Then** `shabbos` tag is active (no HebCal needed - weekday check)

### AC3: Yom Tov Detection
**Given** a date that is Yom Tov (e.g., Rosh Hashanah)
**When** resolving active tags via HebCal
**Then** `yom_tov` tag AND specific holiday tag are active

### AC4: Day-Before Logic
**Given** a zman tagged with `shabbos` + `day_before`
**When** the date is Friday
**Then** the zman is included in results

### AC5: Negated Tag Exclusion
**Given** a zman tagged with `shabbos` + negated `yom_tov`
**When** the date is both Shabbos AND Yom Tov
**Then** the zman is excluded from results

### AC6: Israel vs Diaspora
**Given** a location in Israel vs diaspora
**When** checking 2nd day Yom Tov
**Then** Israel shows 1 day, diaspora shows 2 days

---

## Technical Notes

### Tag Event Mappings to Populate

```sql
-- Map HebCal events to tags via patterns
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority) VALUES
-- Yom Tov (major holidays)
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Rosh Hashana%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Yom Kippur', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Sukkot I%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Shmini Atzeret', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Simchat Torah', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Pesach I%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Pesach VII%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), 'Shavuot%', 1),

-- Specific holidays
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'), 'Rosh Hashana%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), 'Yom Kippur', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'sukkos'), 'Sukkot%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'shemini_atzeres'), 'Shmini Atzeret', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'simchas_torah'), 'Simchat Torah', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'shavuos'), 'Shavuot%', 1),

-- Fast days
((SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), 'Tzom%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), 'Ta''anit%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), 'Tish''a B''Av', 1),

-- Chanukah/Purim
((SELECT id FROM zman_tags WHERE tag_key = 'chanukah'), 'Chanukah%', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'purim'), 'Purim', 1),
((SELECT id FROM zman_tags WHERE tag_key = 'shushan_purim'), 'Shushan Purim', 1),

-- Rosh Chodesh
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_chodesh'), 'Rosh Chodesh%', 1),

-- Omer
((SELECT id FROM zman_tags WHERE tag_key = 'omer'), '%Omer%', 1);
```

### Service Layer: GetActiveTagsForDate

```go
// In algorithm_service.go or new tag_service.go

func (s *Service) GetActiveTagsForDate(ctx context.Context, date time.Time, lat, lng float64) ([]string, error) {
    activeTags := []string{}

    // 1. Check Shabbos (no API needed)
    if date.Weekday() == time.Saturday {
        activeTags = append(activeTags, "shabbos")
    }

    // 2. Check day-before Shabbos (Friday)
    if date.Weekday() == time.Friday {
        activeTags = append(activeTags, "shabbos") // with day_before context
    }

    // 3. Get HebCal events and match to tags
    events, err := s.hebcalClient.GetEvents(ctx, date, lat, lng)
    if err != nil {
        return nil, err
    }

    // 4. Load tag mappings from DB
    mappings, err := s.db.Queries.GetTagEventMappings(ctx)
    if err != nil {
        return nil, err
    }

    // 5. Match events to tags
    matchedTags := calendar.MatchEventToTags(events, mappings)
    activeTags = append(activeTags, matchedTags...)

    return activeTags, nil
}
```

### Zman Filtering Query

```sql
-- name: GetZmanimForDateWithTagFilter :many
WITH active_tags AS (
    SELECT unnest($3::text[]) AS tag_key
),
zman_required_tags AS (
    SELECT pzt.publisher_zman_id, zt.tag_key
    FROM publisher_zman_tags pzt
    JOIN zman_tags zt ON zt.id = pzt.tag_id
    WHERE pzt.is_negated = false
),
zman_excluded_tags AS (
    SELECT pzt.publisher_zman_id, zt.tag_key
    FROM publisher_zman_tags pzt
    JOIN zman_tags zt ON zt.id = pzt.tag_id
    WHERE pzt.is_negated = true
)
SELECT pz.*
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1
  AND pz.status = 'active'
  -- All required tags must be active
  AND NOT EXISTS (
      SELECT 1 FROM zman_required_tags zrt
      WHERE zrt.publisher_zman_id = pz.id
        AND zrt.tag_key NOT IN (SELECT tag_key FROM active_tags)
  )
  -- No excluded tags may be active
  AND NOT EXISTS (
      SELECT 1 FROM zman_excluded_tags zet
      WHERE zet.publisher_zman_id = pz.id
        AND zet.tag_key IN (SELECT tag_key FROM active_tags)
  );
```

---

## Tasks / Subtasks

- [ ] Task 1: Tag cleanup
  - [ ] 1.1 Remove `day_of` tag (id 274) - redundant, absence of timing tag = same day
  - [ ] 1.2 Remove `night_after` tag (id 123) - not needed, formula handles time of day
  - [ ] 1.3 Rename `pesach` (id 186) to `chametz_times` for clarity
  - [ ] 1.4 Verify no data integrity issues (check master_zman_tags, publisher_zman_tags)

- [ ] Task 2: Populate tag_event_mappings
  - [ ] 2.1 Create migration with HebCal pattern mappings
  - [ ] 2.2 Map all major Yamim Tovim
  - [ ] 2.3 Map fast days
  - [ ] 2.4 Map special periods (Chanukah, Purim, Omer)
  - [ ] 2.5 Map Rosh Chodesh

- [ ] Task 3: Implement tag resolution service
  - [ ] 3.1 Create `GetActiveTagsForDate` function
  - [ ] 3.2 Handle Shabbos detection (weekday check)
  - [ ] 3.3 Handle day-before logic (Friday = erev Shabbos context)
  - [ ] 3.4 Integrate with existing HebCal client
  - [ ] 3.5 Add caching (same date/location = same tags)

- [ ] Task 4: Implement zman filtering
  - [ ] 4.1 Add SQLc query for tag-filtered zmanim
  - [ ] 4.2 Update algorithm service to use tag filter
  - [ ] 4.3 Handle timing tags (day_before, night_after)
  - [ ] 4.4 Test negation logic

- [ ] Task 5: Testing
  - [ ] 5.1 Test Shabbos detection (Saturday)
  - [ ] 5.2 Test erev Shabbos (Friday with day_before)
  - [ ] 5.3 Test Yom Tov tag activation
  - [ ] 5.4 Test Israel vs diaspora 2nd day
  - [ ] 5.5 Test negated tag exclusion
  - [ ] 5.6 Test edge cases (Yom Tov on Shabbos)

- [ ] Task 6: Remove TODOs from DSL
  - [ ] 6.1 Remove/update TODO at `dsl.go:353`
  - [ ] 6.2 Remove/update TODO at `dsl.go:390`
  - [ ] 6.3 Document that Hebrew calendar is tag-driven, not DSL-based

---

## Dependencies

**Depends On:**
- Existing HebCal client (`api/internal/calendar/hebcal.go`)
- Existing tag infrastructure

**Dependent Stories:**
- None

---

## Definition of Done

- [ ] `day_of` tag removed (redundant)
- [ ] `night_after` tag removed (formula handles time of day)
- [ ] `tag_event_mappings` populated with HebCal patterns
- [ ] `GetActiveTagsForDate` service function implemented
- [ ] Zman filtering by active/negated tags working
- [ ] Shabbos correctly detected (weekday check)
- [ ] Yom Tov correctly detected via HebCal
- [ ] Israel vs diaspora logic working
- [ ] Negated tag exclusion working
- [ ] Unit tests for tag resolution
- [ ] Integration tests with real dates
- [ ] DSL TODOs resolved (redirected to tag system)
- [ ] No conditional DSL functions added

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| HebCal API downtime | LOW | MEDIUM | Cache results, fallback to last known |
| Pattern matching errors | MEDIUM | LOW | Comprehensive test suite |
| Performance on tag filtering | LOW | LOW | Indexed queries, caching |
| Edge cases (leap years, etc.) | LOW | LOW | Use HebCal for all calendar logic |

---

## Dev Notes

### Why Tag-Driven, Not DSL Conditionals?

1. **Separation of concerns** - Formulas calculate times, tags determine applicability
2. **Publisher flexibility** - Publishers can create multiple zmanim with different tag combinations
3. **No formula complexity** - `sunset - 18min` is clearer than `if(IsYomTov, sunset - 18min, ...)`
4. **Database queryable** - Tags can be filtered at the SQL level, conditionals cannot
5. **Auditable** - Easy to see which zmanim apply to which events

### Timing Tag Semantics

| Scenario | Tags | Calendar Day | Formula Handles |
|----------|------|--------------|-----------------|
| Candle lighting | `shabbos` + `day_before` | Friday | Time before sunset |
| Havdalah | `shabbos` | Saturday | Time after tzeis |
| Mincha Gedola | `shabbos` | Saturday | Afternoon timing |
| Candle lighting erev YT | `yom_tov` + `day_before` | Day before | Time before sunset |

**Note:** Only `day_before` timing tag is needed. The formula controls the actual time of day.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-15 | Story created for Epic 9 | Claude Opus 4.5 |
| 2025-12-15 | Revised to tag-driven approach per user feedback | Claude Opus 4.5 |

---

_Sprint: Epic 9_
_Created: 2025-12-15_
_Story Points: 5_
