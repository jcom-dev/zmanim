# Complete HebCal Event Mapping Logic

## Executive Summary

The zmanim system uses a **database-driven pattern matching** approach to map HebCal library events to internal event tags. This document explains the complete mapping logic, identifies "ghost tags" (tags with no HebCal mappings), and provides the full technical specification.

---

## How Mapping Works (Technical Flow)

### Step 1: HebCal Library Returns Events

The HebCal Go library (`github.com/hebcal/hebcal-go`) returns events with specific names like:
- `"Rosh Hashana I"`
- `"Rosh Hashana II"`
- `"Chanukah: 1 Candle"`
- `"Chanukah: 8 Candles"`
- `"Tzom Gedaliah"`
- `"Asara B'Tevet"`

**File:** `api/internal/calendar/events.go:298-327` (`getHebcalEvents()`)

### Step 2: Pattern Matching Against Database

Each HebCal event name is matched against the `tag_event_mappings` table using SQL pattern matching.

**Query:** `GetTagForHebcalEventName` in `api/internal/db/queries/tag_events.sql:269-293`

```sql
SELECT t.tag_key, t.display_name_hebrew, t.display_name_english_ashkenazi,
       t.display_name_english_sephardi, m.priority
FROM zman_tags t
JOIN tag_event_mappings m ON m.tag_id = t.id
WHERE m.hebcal_event_pattern IS NOT NULL
  AND $1 LIKE m.hebcal_event_pattern  -- Pattern matching with wildcards
ORDER BY m.priority DESC, t.sort_order
LIMIT 1;  -- Highest priority match wins
```

**Key Logic:**
- Uses SQL `LIKE` operator for pattern matching
- `%` wildcard in pattern matches any characters
- Example: pattern `"Rosh Hashana%"` matches both `"Rosh Hashana I"` and `"Rosh Hashana II"`
- Highest `priority` value wins if multiple patterns match
- Returns the **tag_key** (e.g., `rosh_hashanah`)

**File:** `api/internal/calendar/events.go:374-396` (`GetEventCodeFromHebcal()`)

### Step 3: Fetch Event Metadata

After finding the matching tag, the system fetches metadata from `zman_tags` table:

**Query:** `GetEventMetadata` in `api/internal/db/queries/tag_events.sql:250-267`

```sql
SELECT tag_key, yom_tov_level, day_number, total_days, fast_start_type
FROM zman_tags
WHERE tag_key = $1;
```

**Metadata Fields:**
- `yom_tov_level` (0=regular, 1=yom_tov, 2=chol_hamoed) - Replaces `isYomTovEvent()` hardcoded function
- `fast_start_type` ('dawn' | 'sunset' | null) - Replaces `getFastStartType()` hardcoded function
- `day_number` (1, 2, 3...) - Which day of multi-day event
- `total_days` (1, 2, 8...) - Total duration (location-aware: Israel vs Diaspora)

**File:** `api/internal/calendar/db_adapter.go:67-92` (`GetEventMetadata()`)

### Step 4: Build ActiveEvent Object

The system combines the tag match + metadata to build an `ActiveEvent`:

```go
type ActiveEvent struct {
    EventCode     string  // "rosh_hashanah" - from tag_key
    NameHebrew    string  // "ראש השנה" - from display_name_hebrew
    NameEnglish   string  // "Rosh Hashanah" (Ashkenazi) or "Rosh Hashana" (Sephardi)
    DayNumber     int     // 1 for "Rosh Hashana I", 2 for "Rosh Hashana II"
    TotalDays     int     // 2 (location-aware)
    IsFinalDay    bool    // true if DayNumber == TotalDays
    FastStartType string  // "dawn" or "sunset" for fasts
}
```

**Day Number Extraction:**
- Parses HebCal event name for Roman numerals (I, II, III, etc.)
- Example: `"Rosh Hashana II"` → extracts `2` as DayNumber
- Falls back to 1 if no Roman numeral found

**File:** `api/internal/calendar/events.go:329-372` (`holidayToActiveEvent()`)

---

## Database Tables

### `zman_tags` Table (49 event tags total)

**Schema:**
```sql
id                              INTEGER PRIMARY KEY
tag_key                         VARCHAR(50)   -- e.g., "rosh_hashanah"
display_name_hebrew             VARCHAR(100)  -- e.g., "ראש השנה"
display_name_english_ashkenazi  VARCHAR(100)  -- e.g., "Rosh Hashanah"
display_name_english_sephardi   VARCHAR(100)  -- e.g., "Rosh Hashana"
hebcal_basename                 VARCHAR(100)  -- Direct basename match (optional)
tag_type_id                     INTEGER       -- Foreign key to tag_types (170 = 'event')
is_hidden                       BOOLEAN       -- Hide from user-facing UI
yom_tov_level                   INTEGER       -- 0=regular, 1=yom_tov, 2=chol_hamoed
fast_start_type                 VARCHAR(20)   -- 'dawn' | 'sunset' | null
day_number                      INTEGER       -- Day within multi-day event
total_days                      INTEGER       -- Total duration
```

### `tag_event_mappings` Table (58 mappings for 42 unique tags)

**Schema:**
```sql
id                     INTEGER PRIMARY KEY
tag_id                 INTEGER   -- Foreign key to zman_tags
hebcal_event_pattern   VARCHAR(100)  -- Pattern with % wildcards
hebrew_month           INTEGER   -- Alternative: match by Hebrew date
hebrew_day_start       INTEGER   -- Alternative: match by Hebrew date
hebrew_day_end         INTEGER   -- Alternative: date range
priority               INTEGER   -- Higher = preferred (default 100)
```

**Pattern Examples:**
- `"Rosh Hashana%"` → matches "Rosh Hashana I", "Rosh Hashana II"
- `"Chanukah%"` → matches "Chanukah: 1 Candle", "Chanukah: 8 Candles", etc.
- `"%day of the Omer"` → matches "33rd day of the Omer" (Lag BaOmer)
- `"Asara B'Tevet"` → exact match (no wildcard)

**Statistics:**
- 58 total mappings
- 42 unique tags have mappings
- 7 tags have **NO** mappings (see Ghost Tags section)

---

## Ghost Tags (Tags Without HebCal Mappings)

These are **7 event tags** that exist in the database but have **no mappings** in `tag_event_mappings`:

### 1. Abstract/Generic Tags (3 tags) - ✅ KEEP

These are **meta-tags** used for filtering multiple events at once:

| Tag Key   | Display Name | Purpose | Used By |
|-----------|--------------|---------|---------|
| `yom_tov` | Yom Tov | Generic category for any major holiday | 11 zmanim |
| `shabbos` | Shabbos | Matches weekly Shabbat (hardcoded in code) | 11 zmanim |
| `fast_day` | Fast Day | Generic category for any fast | 7 zmanim |

**Why no HebCal mapping?**
- These are **conceptual categories**, not specific events
- `shabbos` is computed from `date.Weekday() == time.Saturday` (hardcoded logic in `events.go:108-119`)
- `yom_tov` and `fast_day` are filtered by metadata (`yom_tov_level > 0` or `h.Category == "fast"`)

**Decision:** ✅ **KEEP** - These serve a valid architectural purpose

---

### 2. Time Period Tags (3 tags) - ✅ KEEP

These represent **multi-day periods** rather than single events:

| Tag Key | Display Name | Period | Days |
|---------|--------------|--------|------|
| `three_weeks` | The Three Weeks | 17 Tammuz → Tisha B'Av | 21 days |
| `nine_days` | The Nine Days | 1 Av → 9 Av | 9 days |
| `aseres_yemei_teshuva` | Ten Days of Repentance | Rosh Hashanah → Yom Kippur | 10 days |

**Why no HebCal mapping?**
- HebCal returns **point events** (specific dates), not periods
- These require **date range logic** (Hebrew date start/end)
- Could be implemented using `hebrew_month` + `hebrew_day_start` + `hebrew_day_end` columns in `tag_event_mappings`

**Decision:** ✅ **KEEP** - Legitimate halachic periods, not yet implemented

**Recommendation:** Add date-range mappings later:
```sql
INSERT INTO tag_event_mappings (tag_id, hebrew_month, hebrew_day_start, hebrew_day_end)
VALUES
  ((SELECT id FROM zman_tags WHERE tag_key = 'three_weeks'), 4, 17, 29),  -- 17 Tammuz to end of Tammuz
  ((SELECT id FROM zman_tags WHERE tag_key = 'nine_days'), 5, 1, 9);      -- 1-9 Av
```

---

### 3. Missing HebCal Mapping (1 tag) - ❌ FIX NEEDED

| Tag Key | Display Name | Issue | HebCal Event Name |
|---------|--------------|-------|-------------------|
| `selichos` | Selichos | Missing mapping | `"Leil Selichot"` |

**Problem:** HebCal **DOES** have a Selichot event, but we have no mapping!

**Fix:**
```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
VALUES (
  (SELECT id FROM zman_tags WHERE tag_key = 'selichos'),
  'Leil Selichot',
  100
);
```

**Decision:** ❌ **FIX** - Add mapping for "Leil Selichot"

---

### 4. Potentially Redundant (1 tag) - ⚠️ INVESTIGATE

| Tag Key | Display Name | Issue | Used By |
|---------|--------------|-------|---------|
| `pesach_first` | Pesach (First Days) | Possibly duplicate | 0 zmanim |

**Problem:**
- We already have `pesach` tag (used by 4 zmanim)
- We also have `pesach_last` tag with mappings to Pesach VII/VIII
- `pesach_first` has **no mappings** and is **used by 0 zmanim**

**Hypothesis:** This was intended to match Pesach I/II but was never implemented.

**Decision:** ⚠️ **INVESTIGATE** - Either:
1. Add mappings: `INSERT ... VALUES ('Pesach I'), ('Pesach II');`
2. Delete if truly redundant

---

## Complete Tag Mapping Reference

### All 42 Tags WITH HebCal Mappings

| Tag Key | HebCal Pattern(s) | Multi-Match? |
|---------|-------------------|--------------|
| `asarah_bteves` | `Asara B'Tevet` | No |
| `chanukah` | `Chanukah%` | Yes (8 days) |
| `chol_hamoed_pesach` | `Pesach III (CH''M)`, `Pesach IV (CH''M)`, `Pesach V (CH''M)`, `Pesach VI (CH''M)` | Yes (4 mappings) |
| `chol_hamoed_sukkos` | `Sukkot III (CH''M)`, `Sukkot IV (CH''M)`, `Sukkot V (CH''M)`, `Sukkot VI (CH''M)`, `Sukkot VII (Hoshana Raba)` | Yes (5 mappings) |
| `erev_pesach` | `Erev Pesach` | No |
| `erev_rosh_hashanah` | `Erev Rosh Hashana` | No |
| `erev_shavuos` | `Erev Shavuot` | No |
| `erev_sukkos` | `Erev Sukkot` | No |
| `erev_tisha_bav` | `Erev Tish'a B'Av` | No |
| `erev_yom_kippur` | `Erev Yom Kippur` | No |
| `fast_day` | `Tzom Tammuz`, `Ta'anit Bechorot`, `Ta'anit Esther`, `Asara B'Tevet`, `Tzom Gedaliah` | Yes (5 fasts) |
| `hoshanah_rabbah` | `Sukkot VII (Hoshana Raba)` | No |
| `lag_baomer` | `Lag BaOmer` | No |
| `omer` | `%day of the Omer` | Yes (49 days) |
| `pesach` | `Pesach I`, `Pesach II`, `Pesach VII`, `Pesach VIII` | Yes (4 days) |
| `pesach_last` | `Pesach VII`, `Pesach VIII` | Yes (2 days) |
| `pesach_sheni` | `Pesach Sheni` | No |
| `purim` | `Purim` | No |
| `rosh_chodesh` | `Rosh Chodesh%` | Yes (12 months) |
| `rosh_hashanah` | `Rosh Hashana%` | Yes (2 days) |
| `shabbos_chazon` | `Shabbat Chazon` | No |
| `shabbos_hachodesh` | `Shabbat HaChodesh` | No |
| `shabbos_hagadol` | `Shabbat HaGadol` | No |
| `shabbos_nachamu` | `Shabbat Nachamu` | No |
| `shabbos_parah` | `Shabbat Parah` | No |
| `shabbos_shekalim` | `Shabbat Shekalim` | No |
| `shabbos_shirah` | `Shabbat Shirah` | No |
| `shabbos_shuva` | `Shabbat Shuva` | No |
| `shabbos_zachor` | `Shabbat Zachor` | No |
| `shavuos` | `Shavuot%` | Yes (2 days diaspora) |
| `shemini_atzeres` | `Shmini Atzeret` | No |
| `shiva_asar_btamuz` | `Tzom Tammuz` | No |
| `shushan_purim` | `Shushan Purim` | No |
| `simchas_torah` | `Simchat Torah` | No |
| `sukkos` | `Sukkot I`, `Sukkot II` | Yes (2 days) |
| `taanis_bechoros` | `Ta'anit Bechorot` | No |
| `taanis_esther` | `Ta'anit Esther` | No |
| `tisha_bav` | `Tish'a B'Av` | No |
| `tu_bav` | `Tu B'Av` | No |
| `tu_bshvat` | `Tu BiShvat` | No |
| `tzom_gedaliah` | `Tzom Gedaliah` | No |
| `yom_kippur` | `Yom Kippur` | No |

---

## Usage Statistics (Zmanim Using Event Tags)

| Tag Key | Zmanim Count | Hidden? | Purpose |
|---------|--------------|---------|---------|
| `yom_kippur` | 12 | No | Yom Kippur specific zmanim |
| `shabbos` | 11 | No | Shabbat candles/havdalah |
| `yom_tov` | 11 | Yes | Generic Yom Tov filter |
| `fast_day` | 7 | Yes | Generic fast day filter |
| `tisha_bav` | 5 | No | Tisha B'Av specific zmanim |
| `pesach` | 4 | No | Pesach zmanim |
| **All others** | 0 | No | Available but unused |

**Key Insight:** Only 6 tags are actively used by master zmanim. The other 43 tags exist for **publisher-specific customization** and **future expansion**.

---

## Special Cases

### Shabbos (Hardcoded)

Unlike other events, `shabbos` is **not** looked up from HebCal. It's computed directly:

```go
// api/internal/calendar/events.go:108-119
if date.Weekday() == time.Saturday {
    events = append(events, ActiveEvent{
        EventCode:   "shabbos",
        NameHebrew:  "שבת",
        NameEnglish: "Shabbat",
        ...
    })
}
```

**Why hardcoded?** Shabbat occurs **every week** on a fixed day (Saturday). It doesn't need HebCal lookup or database pattern matching.

### Generic Tags (yom_tov, fast_day)

These tags are **never returned as ActiveEvents** from HebCal mapping. Instead, they're used as **filter tags** on zmanim:

**Example:** A zman tagged with `fast_day` will appear on ANY fast:
- Tzom Gedaliah (3 Tishrei)
- Asarah B'Teves (10 Tevet)
- Ta'anit Esther (13 Adar)
- Tzom Tammuz (17 Tammuz)
- Tisha B'Av (9 Av)

**How it works:**
1. HebCal returns `"Tzom Gedaliah"`
2. Database maps to `tzom_gedaliah` tag
3. System adds `tzom_gedaliah` to `ActiveEventCodes[]`
4. Zmanim service filters zmanim by matching tags
5. Zman with `fast_day` tag shows because `tzom_gedaliah` has `category=fast`

**Note:** As of your request, Tisha B'Av has **no special handling**. It's just another fast day. Users can use tag negation (`fast_day` AND NOT `tisha_bav`) if they want to exclude it.

---

## Code Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| [api/internal/calendar/events.go](api/internal/calendar/events.go) | Main event mapping logic | 515 |
| [api/internal/calendar/db_adapter.go](api/internal/calendar/db_adapter.go) | Database query adapter | 92 |
| [api/internal/calendar/category_mappings.go](api/internal/calendar/category_mappings.go) | Category tag configuration | 42 |
| [api/internal/db/queries/tag_events.sql](api/internal/db/queries/tag_events.sql) | SQLc queries for tag matching | 307 |
| [db/migrations/20251224220000_add_tag_metadata.sql](db/migrations/20251224220000_add_tag_metadata.sql) | Schema with metadata columns | - |
| [db/migrations/20251224220001_populate_tag_metadata.sql](db/migrations/20251224220001_populate_tag_metadata.sql) | Populate tag metadata | - |

---

## Action Items

### Immediate Fixes Required

1. ❌ **Add Selichos mapping**
   ```sql
   INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
   VALUES (
     (SELECT id FROM zman_tags WHERE tag_key = 'selichos'),
     'Leil Selichot',
     100
   );
   ```

### Future Enhancements

2. ⚠️ **Investigate pesach_first tag** - Either implement or delete

3. ✅ **Add period tags** - Implement Three Weeks, Nine Days, Aseret Yemei Teshuva using date ranges

---

## Summary

**Total Event Tags:** 49

**HebCal Mapped:** 42 (86%)
**Ghost Tags:** 7 (14%)

**Ghost Tag Breakdown:**
- ✅ Abstract/Generic (3) - yom_tov, shabbos, fast_day - **KEEP**
- ✅ Period Tags (3) - three_weeks, nine_days, aseres_yemei_teshuva - **KEEP**
- ❌ Missing Mapping (1) - selichos - **FIX**
- ⚠️ Potentially Redundant (1) - pesach_first - **INVESTIGATE**

**Conclusion:** Your database is very clean! No "fake" events. All ghost tags are either intentional design choices or have clear fixes.
