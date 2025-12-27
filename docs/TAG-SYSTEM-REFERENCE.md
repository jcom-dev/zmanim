# Tag System & HebCal Mapping Reference

## Table of Contents

1. [Overview](#overview)
2. [Tag Types](#tag-types)
3. [HebCal Mapping Mechanism](#hebcal-mapping-mechanism)
4. [Complete Tag Reference](#complete-tag-reference)
5. [Database Schema](#database-schema)
6. [Usage Examples](#usage-examples)
7. [Tag Filtering Logic (ShouldShowZman)](#tag-filtering-logic-shouldshowzman)
8. [Tag Negation System](#tag-negation-system)
9. [Timing Tags & Modifiers](#timing-tags--modifiers)
10. [Integration Architecture](#integration-architecture)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The Zmanim platform uses a comprehensive tag system to organize, categorize, and filter Jewish calendar events and zmanim (halachic times). This system provides a flexible, data-driven approach to handling the complexities of the Jewish calendar without hardcoded logic.

### Purpose

The tag system serves multiple critical functions:

1. **Event Matching**: Automatically maps events from the HebCal API to internal tags
2. **Zmanim Filtering**: Controls which zmanim appear on specific days based on active events
3. **Categorization**: Organizes zmanim by purpose (Zmanim, fast times, etc.)
4. **Halachic Opinions**: Associates zmanim with specific rabbinic authorities (shitos)
5. **Multilingual Support**: Provides Hebrew, Ashkenazi, and Sephardi name variants

### Architecture Principles

- **Tag-Driven**: ALL event filtering is controlled by tags, NO hardcoded logic
- **Database-Driven**: Event mappings live in the database, not in code
- **Extensible**: New events can be added via SQL migrations without code changes
- **Type-Safe**: SQLc generates type-safe Go code from SQL queries

---

## Tag Types

The system defines four distinct tag types, each serving a specific purpose:

| Type ID | Type Key | Hebrew | English | Sort Order | Count | Purpose |
|---------|----------|--------|---------|------------|-------|---------|
| 1 | `event` | אירוע | Event | 1 | 54 | Jewish calendar events (holidays, fasts, special Shabbatot) |
| 2 | `timing` | זמן | Timing | 2 | 1 | Temporal modifiers (day_before, motzei) |
| 3 | `shita` | שיטה | Opinion | 3 | 13 | Halachic calculation methods (GRA, MGA, etc.) |

### Tag Type Details

#### Event Tags (type_id=1)
Event tags represent Jewish calendar events that originate from the HebCal API. They control which zmanim appear on specific days.

**Characteristics:**
- Map to HebCal API events via exact strings, regex patterns, or categories
- Can be hidden from user-facing UI (`is_hidden` flag)
- Support both Ashkenazi and Sephardi pronunciations
- Include 5 HebCal category tags (hidden), 6 multi-day event groups, 42 specific events

#### Timing Tags (type_id=2)
Timing tags modify when zmanim should be displayed relative to an event. They work in conjunction with event tags.

**Available timing tags:**
- `day_before`: Display zman on the day BEFORE the event (e.g., candle lighting on Friday)
- `motzei`: Display zman at the END of the event (e.g., Havdalah on Saturday night)

See [Timing Tags & Modifiers](#timing-tags--modifiers) for detailed usage.

#### Shita Tags (type_id=3)
Shita (opinion) tags associate zmanim with specific halachic authorities and their calculation methods.

**Common Shitos:**
- `shita_gra`: Vilna Gaon (day = sunrise to sunset)
- `shita_mga`: Magen Avraham (day = alos to tzais, 72 min)
- `shita_rt`: Rabbeinu Tam (72 min after sunset for nightfall)
- `shita_baal_hatanya`: Chabad tradition (Shulchan Aruch HaRav)
- `shita_chazon_ish`: Different mil/cubit measurements
- `shita_r_tucazinsky`: Commonly used in Israel (6.45° tzais)
- `shita_machzikei_hadass`: Manchester asymmetric day (alos 12° to tzais 7.083°)

**Note:** Category tags (for organizing zmanim by function) are not currently used in the system. Zmanim are organized by `time_categories` table instead.

---

## HebCal Mapping Mechanism

The system uses three match types to map HebCal API events to internal tags:

### Match Types

| Match Type | Description | Use Case | Priority |
|------------|-------------|----------|----------|
| `exact` | Exact string match on HebCal event title | Single-day events (Purim, Yom Kippur, Asara B'Tevet) | 1 (highest) |
| `group` | PostgreSQL regex pattern match on title | Multi-day events (Chanukah, Pesach, Sukkos) | 2 (lowest) |

**Note:** The `hebcal_match_category` column exists for potential future use with HebCal category matching (candles, havdalah, etc.) but the current `match_hebcal_event()` function only uses `exact` and `group` match types.

### The `match_hebcal_event()` Function

The matching logic is implemented as a PostgreSQL function that searches for the best match:

```sql
CREATE OR REPLACE FUNCTION match_hebcal_event(
    hebcal_title text,
    hebcal_category text DEFAULT NULL  -- Retained for backwards compatibility
)
RETURNS TABLE(tag_id integer, tag_key varchar, match_type hebcal_match_type)
AS $$
BEGIN
    -- Priority 1: Exact string matches
    RETURN QUERY
    SELECT zt.id, zt.tag_key, zt.hebcal_match_type
    FROM zman_tags zt
    WHERE zt.hebcal_match_type = 'exact'
      AND zt.hebcal_match_string = hebcal_title
    LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Priority 2: Regex pattern matches (groups)
    -- Prefer more specific (longer) patterns
    RETURN QUERY
    SELECT zt.id, zt.tag_key, zt.hebcal_match_type
    FROM zman_tags zt
    WHERE zt.hebcal_match_type = 'group'
      AND hebcal_title ~ zt.hebcal_match_pattern
    ORDER BY length(zt.hebcal_match_pattern) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Match Type Examples

#### Category Match
Maps HebCal meta-events by their category field.

**HebCal API Response:**
```json
{
  "title": "Candle lighting: 4:15pm",
  "category": "candles",
  "date": "2025-12-19"
}
```

**Database Mapping:**
```sql
-- zman_tags row
tag_key: hebcal_candles
hebcal_match_type: category
hebcal_match_category: candles
```

**Result:** Matches `hebcal_candles` tag (hidden tag, used internally)

---

#### Exact Match
Maps single-day events by exact title string.

**HebCal API Response:**
```json
{
  "title": "Yom Kippur",
  "category": "holiday",
  "subcat": "major",
  "date": "2025-10-12"
}
```

**Database Mapping:**
```sql
-- zman_tags row
tag_key: yom_kippur
hebcal_match_type: exact
hebcal_match_string: Yom Kippur
```

**Result:** Matches `yom_kippur` tag

---

#### Group Match (Regex)
Maps multi-day events by regex pattern on the title.

**HebCal API Response:**
```json
[
  {
    "title": "Chanukah: 1 Candle",
    "category": "holiday",
    "date": "2025-12-14"
  },
  {
    "title": "Chanukah: 2 Candles",
    "category": "holiday",
    "date": "2025-12-15"
  },
  {
    "title": "Chanukah: 8th Day",
    "category": "holiday",
    "date": "2025-12-22"
  }
]
```

**Database Mapping:**
```sql
-- zman_tags row
tag_key: chanukah
hebcal_match_type: group
hebcal_match_pattern: ^Chanukah:
```

**Result:** All three events match the `chanukah` tag

**Other Group Match Examples:**
- `^Pesach [IVX]+` matches "Pesach I", "Pesach II", "Pesach III", etc.
- `^Rosh Hashana( [0-9]+| II)?$` matches "Rosh Hashana", "Rosh Hashana I", "Rosh Hashana II"
- `^Sukkot [IVX]+` matches "Sukkot I" through "Sukkot VII"

---

## Complete Tag Reference

### Event Tags (Type 170) - 53 Total

#### HebCal Category Tags (5 - Hidden)
These tags map to HebCal's category field and are hidden from user interfaces.

| Tag Key | Hebrew | English | Match Type | Match Value |
|---------|--------|---------|------------|-------------|
| `hebcal_candles` | הדלקת נרות | Candle Lighting | category | candles |
| `hebcal_havdalah` | הבדלה | Havdalah | category | havdalah |
| `hebcal_parashat` | פרשת השבוע | Parashas HaShavua | category | parashat |
| `hebcal_mevarchim` | מברכים חודש | Mevarchim HaChodesh | category | mevarchim |
| `hebcal_rosh_chodesh` | ראש חודש | Rosh Chodesh | category | roshchodesh |

---

#### Multi-Day Event Groups (6)
Events that span multiple days, matched by regex patterns.

| Tag Key | Hebrew | Ashkenazi | Sephardi | Match Pattern |
|---------|--------|-----------|----------|---------------|
| `chanukah` | חנוכה | Chanukah | Chanukah | `^Chanukah:` |
| `pesach` | פסח | Pesach | Pesach | `^Pesach [IVX]+` |
| `rosh_hashana` | ראש השנה | Rosh Hashana | Rosh Hashana | `^Rosh Hashana( [0-9]+\| II)?$` |
| `sukkos` | סוכות | Sukkos | Sukkot | `^Sukkot [IVX]+` |
| `shavuos` | שבועות | Shavuos | Shavuot | `^Shavuot [IVX]+$` |
| `tisha_bav` | תשעה באב | Tisha B'Av | Tish'a B'Av | `^Tish'a B'Av( \(observed\))?$` |

**Note:** These patterns match HebCal's day numbering (e.g., "Pesach I", "Pesach II") and observed dates.

---

#### Major Holidays (3)
Single-day major holidays with exact matches.

| Tag Key | Hebrew | Ashkenazi | Sephardi | HebCal Title |
|---------|--------|-----------|----------|--------------|
| `yom_kippur` | יום כפור | Yom Kippur | Yom Kippur | Yom Kippur |
| `shmini_atzeres` | שמיני עצרת | Shmini Atzeres | Shmini Atzeret | Shmini Atzeret |
| `simchas_torah` | שמחת תורה | Simchas Torah | Simchat Torah | Simchat Torah |

---

#### Purim Family (5)
Purim and related observances.

| Tag Key | Hebrew | English | HebCal Title |
|---------|--------|---------|--------------|
| `purim` | פורים | Purim | Purim |
| `purim_katan` | פורים קטן | Purim Katan | Purim Katan |
| `purim_meshulash` | פורים משולש | Purim Meshulash | Purim Meshulash |
| `shushan_purim` | שושן פורים | Shushan Purim | Shushan Purim |
| `shushan_purim_katan` | שושן פורים קטן | Shushan Purim Katan | Shushan Purim Katan |

---

#### Minor Holidays (4)

| Tag Key | Hebrew | English | HebCal Title |
|---------|--------|---------|--------------|
| `lag_baomer` | ל״ג בעומר | Lag BaOmer | Lag BaOmer |
| `tu_bav` | ט״ו באב | Tu B'Av | Tu B'Av |
| `tu_bishvat` | ט״ו בשבט | Tu BiShvat | Tu BiShvat |
| `pesach_sheni` | פסח שני | Pesach Sheni | Pesach Sheni |

---

#### Shabbos/Erev Shabbos (Core Weekly Events)

These are the most important event tags - used every week for candle lighting and havdalah.

| Tag Key | Hebrew | English | HebCal Match | Description |
|---------|--------|---------|--------------|-------------|
| `shabbos` | שבת | Shabbos | (code-generated) | Weekly Shabbat - active on Saturday |
| `erev_shabbos` | ערב שבת | Erev Shabbos | (code-generated) | Friday - the day before Shabbos |

**Note:** These tags are NOT matched from HebCal API. They are generated in Go code by the calendar service based on the day of week:
- Saturday (weekday 6) → `shabbos` added to ActiveEvents
- Friday (weekday 5) → `erev_shabbos` added to ErevEvents

See [events.go:105-156](api/internal/calendar/events.go#L105-L156) for the implementation.

---

#### Erev (Eve) Days (7)
Days before major holidays. These ARE matched from HebCal API.

| Tag Key | Hebrew | English | HebCal Title |
|---------|--------|---------|--------------|
| `erev_pesach` | ערב פסח | Erev Pesach | Erev Pesach |
| `erev_purim` | ערב פורים | Erev Purim | Erev Purim |
| `erev_rosh_hashana` | ערב ראש השנה | Erev Rosh Hashana | Erev Rosh Hashana |
| `erev_shavuos` | ערב שבועות | Erev Shavuos | Erev Shavuot |
| `erev_sukkos` | ערב סוכות | Erev Sukkos | Erev Sukkot |
| `erev_yom_kippur` | ערב יום כפור | Erev Yom Kippur | Erev Yom Kippur |
| `erev_tisha_bav` | ערב תשעה באב | Erev Tisha B'Av | Erev Tish'a B'Av |

---

#### Fast Days (5)

| Tag Key | Hebrew | Ashkenazi | Sephardi | HebCal Title |
|---------|--------|-----------|----------|--------------|
| `asara_btevet` | עשרה בטבת | Asara B'Teves | Asara B'Tevet | Asara B'Tevet |
| `taanit_esther` | תענית אסתר | Ta'anis Esther | Ta'anit Esther | Ta'anit Esther |
| `tzom_gedaliah` | צום גדליה | Tzom Gedaliah | Tzom Gedaliah | Tzom Gedaliah |
| `tzom_tammuz` | צום י״ז בתמוז | Tzom Tammuz | Tzom Tammuz | Tzom Tammuz |
| `taanit_bechorot` | תענית בכורות | Ta'anis Bechoros | Ta'anit Bechorot | Ta'anit Bechorot |

---

#### Special Shabbatot (9)

| Tag Key | Hebrew | Ashkenazi | Sephardi | HebCal Title |
|---------|--------|-----------|----------|--------------|
| `shabbos_shekalim` | שבת שקלים | Shabbos Shekalim | Shabbat Shekalim | Shabbat Shekalim |
| `shabbos_zachor` | שבת זכור | Shabbos Zachor | Shabbat Zachor | Shabbat Zachor |
| `shabbos_parah` | שבת פרה | Shabbos Parah | Shabbat Parah | Shabbat Parah |
| `shabbos_hachodesh` | שבת החדש | Shabbos HaChodesh | Shabbat HaChodesh | Shabbat HaChodesh |
| `shabbos_hagadol` | שבת הגדול | Shabbos HaGadol | Shabbat HaGadol | Shabbat HaGadol |
| `shabbos_chazon` | שבת חזון | Shabbos Chazon | Shabbat Chazon | Shabbat Chazon |
| `shabbos_nachamu` | שבת נחמו | Shabbos Nachamu | Shabbat Nachamu | Shabbat Nachamu |
| `shabbos_shuva` | שבת שובה | Shabbos Shuva | Shabbat Shuva | Shabbat Shuva |
| `shabbos_shirah` | שבת שירה | Shabbos Shirah | Shabbat Shirah | Shabbat Shirah |

---

#### Israeli National Days (5 - Hidden)
Modern Israeli national observances, hidden by default.

| Tag Key | Hebrew | English | HebCal Title |
|---------|--------|---------|--------------|
| `yom_hashoah` | יום השואה | Yom HaShoah | Yom HaShoah |
| `yom_hazikaron` | יום הזכרון | Yom HaZikaron | Yom HaZikaron |
| `yom_haatzmaut` | יום העצמאות | Yom HaAtzma'ut | Yom HaAtzma'ut |
| `yom_yerushalayim` | יום ירושלים | Yom Yerushalayim | Yom Yerushalayim |
| `yom_haaliyah` | יום העליה | Yom HaAliyah | Yom HaAliyah |

---

#### Other Observances (4)

| Tag Key | Hebrew | Ashkenazi | Sephardi | HebCal Title | Hidden |
|---------|--------|-----------|----------|--------------|--------|
| `leil_selichos` | סליחות | Leil Selichos | Leil Selichot | Leil Selichot | No |
| `rosh_hashana_labehemos` | ראש השנה למעשר בהמה | Rosh Hashana LaBehemos | Rosh Hashana LaBehemot | Rosh Hashana LaBehemot | Yes |
| `sigd` | חג הסיגד | Sigd | Sigd | Sigd | Yes |
| `chag_habanot` | חג הבנות | Chag HaBanot | Chag HaBanot | Chag HaBanot | Yes |

---

### Timing Tags (Type 171) - 1 Total

| Tag Key | Hebrew | English | Description |
|---------|--------|---------|-------------|
| `day_before` | יום לפני | Day Before | Display on the day before the event (e.g., candle lighting on Friday for Shabbat) |

**Note:** This tag is hidden and used internally for zmanim that appear the day before an event.

---

### Shita Tags (Type 173) - 13 Total

Halachic opinion tags representing different calculation methods from rabbinic authorities.

| Tag Key | Hebrew | English | Description |
|---------|--------|---------|-------------|
| `shita_gra` | גר"א | GRA (Vilna Gaon) | Day from sunrise to sunset |
| `shita_mga` | מג"א | MGA (Magen Avraham) | Day from alos to tzais (72 min) |
| `shita_rt` | ר"ת | Rabbeinu Tam | 72 minutes after sunset for nightfall |
| `shita_baal_hatanya` | בעל התניא | Baal HaTanya | Shulchan Aruch HaRav (Chabad) |
| `shita_ateret_torah` | עטרת תורה | Ateret Torah | Chacham Yosef Harari-Raful (Sephardic) |
| `shita_geonim` | גאונים | Geonim | Various Geonic opinions on nightfall degrees |
| `shita_yereim` | יראים | Yereim | Sefer Yereim - bein hashmashos calculations |
| `shita_kol_eliyahu` | קול אליהו | Kol Eliyahu | With specific shma calculation |
| `shita_chazon_ish` | חזון איש | Chazon Ish | Different mil/cubit measurements |
| `shita_r_tucazinsky` | ר׳ טוקצ׳ינסקי | R' Tucazinsky | Commonly used in Israel (6.45° tzais) |
| `shita_fixed_local_chatzos` | חצות קבוע | Fixed Local Chatzos | Uses fixed local mean time for chatzos |
| `shita_ahavat_shalom` | אהבת שלום | Ahavat Shalom | Special mincha calculations |
| `shita_machzikei_hadass` | מחזיקי הדת מנצ'סטר | Machzikei Hadass Manchester | Asymmetric day (alos 12° to tzais 7.083°) |

---

### Category Tags (Type 175) - 11 Total

Organizational tags for grouping zmanim by purpose.

| Tag Key | Hebrew | English | Description | Hidden |
|---------|--------|---------|-------------|--------|
| `category_shema` | קריאת שמע | Shema Times | Times related to Shema recitation | Yes |
| `category_tefila` | תפילה | Zmanim | Times related to prayer services | Yes |
| `category_mincha` | מנחה | Mincha Times | Times related to afternoon prayer | Yes |
| `category_candle_lighting` | הדלקת נרות | Candle Lighting | Candle lighting times | Yes |
| `category_havdalah` | הבדלה | Havdalah | End of Shabbos/Yom Tov times | Yes |
| `category_fast_start` | תחילת צום | Fast Begins | When a fast begins | Yes |
| `category_fast_end` | סוף צום | Fast Ends | When a fast ends | Yes |
| `category_chametz` | חמץ | Chametz Times | Times related to chametz on Erev Pesach | Yes |
| `category_kiddush_levana` | קידוש לבנה | Kiddush Levana | Times for sanctifying the moon | Yes |
| `category_tisha_bav_fast_start` | התחלת צום תשעה באב | Tisha B'Av Fast Begins | Tisha B'Av fast beginning times | No |
| `category_tisha_bav_fast_end` | סיום צום תשעה באב | Tisha B'Av Fast Ends | Tisha B'Av fast ending times | No |

**Note:** Most category tags are hidden to reduce UI clutter. They're used programmatically for filtering.

---

## Database Schema

### Main Table: `zman_tags`

```sql
CREATE TABLE zman_tags (
    id                             SERIAL PRIMARY KEY,
    tag_key                        VARCHAR(50) NOT NULL UNIQUE,
    display_name_hebrew            TEXT NOT NULL,
    display_name_english_ashkenazi TEXT NOT NULL,
    display_name_english_sephardi  TEXT,
    tag_type_id                    INTEGER NOT NULL REFERENCES tag_types(id),
    description                    TEXT,
    color                          VARCHAR(7),
    sort_order                     INTEGER DEFAULT 0,
    is_hidden                      BOOLEAN NOT NULL DEFAULT false,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- HebCal Matching Columns
    hebcal_match_type              hebcal_match_type,
    hebcal_match_string            TEXT,     -- For exact matches
    hebcal_match_pattern           TEXT,     -- For group (regex) matches
    hebcal_match_category          VARCHAR(50), -- For category matches

    CONSTRAINT chk_zman_tags_hebcal_match CHECK (
        hebcal_match_type IS NULL OR
        (hebcal_match_type = 'exact' AND
         hebcal_match_string IS NOT NULL AND
         hebcal_match_pattern IS NULL AND
         hebcal_match_category IS NULL) OR
        (hebcal_match_type = 'group' AND
         hebcal_match_pattern IS NOT NULL AND
         hebcal_match_string IS NULL AND
         hebcal_match_category IS NULL) OR
        (hebcal_match_type = 'category' AND
         hebcal_match_category IS NOT NULL AND
         hebcal_match_string IS NULL AND
         hebcal_match_pattern IS NULL)
    )
);
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `tag_key` | VARCHAR(50) | Unique identifier (e.g., `chanukah`, `shita_gra`) |
| `display_name_hebrew` | TEXT | Hebrew display name (e.g., חנוכה) |
| `display_name_english_ashkenazi` | TEXT | Ashkenazi pronunciation (e.g., Chanukah, Sukkos) |
| `display_name_english_sephardi` | TEXT | Sephardi pronunciation (e.g., Chanukah, Sukkot) |
| `tag_type_id` | INTEGER | References tag_types (170=event, 171=timing, etc.) |
| `description` | TEXT | Optional description of the tag's purpose |
| `color` | VARCHAR(7) | Hex color code for UI display |
| `sort_order` | INTEGER | Display order within tag type |
| `is_hidden` | BOOLEAN | Hide from user-facing tag selectors |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `hebcal_match_type` | ENUM | How to match HebCal: exact, group, category, or NULL |
| `hebcal_match_string` | TEXT | Exact HebCal title (for exact matches) |
| `hebcal_match_pattern` | TEXT | PostgreSQL regex (for group matches) |
| `hebcal_match_category` | VARCHAR(50) | HebCal category field (for category matches) |

### Enum Type: `hebcal_match_type`

```sql
CREATE TYPE hebcal_match_type AS ENUM ('exact', 'group', 'category');
```

### Indexes

```sql
CREATE INDEX idx_zman_tags_tag_key ON zman_tags(tag_key);
CREATE INDEX idx_zman_tags_tag_type ON zman_tags(tag_type_id);
CREATE INDEX idx_zman_tags_is_hidden ON zman_tags(is_hidden);
CREATE INDEX idx_zman_tags_hebcal_match_type ON zman_tags(hebcal_match_type)
    WHERE hebcal_match_type IS NOT NULL;
CREATE INDEX idx_zman_tags_hebcal_category ON zman_tags(hebcal_match_category)
    WHERE hebcal_match_category IS NOT NULL;
```

### View: `v_hebcal_event_mappings`

A convenience view showing all HebCal-mappable tags:

```sql
CREATE VIEW v_hebcal_event_mappings AS
SELECT
    tag_key,
    display_name_english_ashkenazi,
    hebcal_match_type,
    COALESCE(hebcal_match_string, hebcal_match_pattern, hebcal_match_category::text) AS match_value,
    sort_order
FROM zman_tags
WHERE hebcal_match_type IS NOT NULL
ORDER BY
    CASE hebcal_match_type
        WHEN 'category' THEN 1
        WHEN 'group' THEN 2
        WHEN 'exact' THEN 3
        ELSE NULL
    END,
    sort_order;
```

---

## Usage Examples

### SQL Queries

#### Example 1: Match a HebCal Event

```sql
-- Match "Chanukah: 3 Candles" from HebCal API
SELECT * FROM match_hebcal_event('Chanukah: 3 Candles', 'holiday');

-- Result:
-- tag_id: 11
-- tag_key: chanukah
-- match_type: group
```

#### Example 2: Get All Tags for Yom Tov Days

```sql
SELECT tag_key, display_name_hebrew, display_name_english_ashkenazi
FROM zman_tags
WHERE tag_type_id = 170  -- event type
  AND is_hidden = false
  AND tag_key IN ('pesach', 'shavuos', 'rosh_hashana', 'yom_kippur', 'sukkos')
ORDER BY sort_order;
```

#### Example 3: Get Zmanim for a Specific Day's Events

```sql
-- Get all publisher zmanim that should show on Chanukah
SELECT DISTINCT
    pz.zman_key,
    pz.hebrew_name,
    pz.formula_dsl
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
JOIN zman_tags t ON t.id = pzt.tag_id
WHERE pz.publisher_id = 1
  AND t.tag_key = 'chanukah'
  AND pz.is_enabled = true
ORDER BY pz.hebrew_name;
```

#### Example 4: Find All GRA-Based Zmanim

```sql
-- Get master registry zmanim using GRA calculation method
SELECT
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.default_formula_dsl
FROM master_zmanim_registry mr
JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
JOIN zman_tags t ON t.id = mzt.tag_id
WHERE t.tag_key = 'shita_gra'
ORDER BY mr.canonical_hebrew_name;
```

#### Example 5: Get All Fast Day Times

```sql
-- Get zmanim categorized as fast start/end times
SELECT DISTINCT
    mr.zman_key,
    mr.canonical_hebrew_name,
    t.tag_key as category
FROM master_zmanim_registry mr
JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
JOIN zman_tags t ON t.id = mzt.tag_id
WHERE t.tag_key IN ('category_fast_start', 'category_fast_end')
ORDER BY t.tag_key, mr.canonical_hebrew_name;
```

### Go Code Examples

#### Example 1: Get Active Tags for a Date

```go
// In calendar service
func (s *CalendarService) GetActiveTagsForDate(
    ctx context.Context,
    date time.Time,
    lat, lng float64,
) ([]string, error) {
    // Fetch HebCal events
    events, err := s.hebcalClient.GetEvents(ctx, date, lat, lng, "ashkenazi")
    if err != nil {
        return nil, fmt.Errorf("failed to fetch hebcal events: %w", err)
    }

    // Match each event to tags
    var tagKeys []string
    for _, event := range events {
        result, err := s.queries.MatchHebcalEvent(ctx, db.MatchHebcalEventParams{
            HebcalTitle:    event.Title,
            HebcalCategory: sql.NullString{String: event.Category, Valid: true},
        })
        if err == nil && result.TagKey != "" {
            tagKeys = append(tagKeys, result.TagKey)
        }
    }

    return tagKeys, nil
}
```

#### Example 2: Filter Zmanim by Active Tags

```go
// In zmanim service
func (s *ZmanimService) CalculateZmanim(
    ctx context.Context,
    params CalculateParams,
) (*ZmanimResult, error) {
    // Get publisher's zmanim configuration
    publisherZmanim, err := s.queries.GetPublisherZmanim(ctx, params.PublisherID)
    if err != nil {
        return nil, err
    }

    // Build formula map, filtering by active event tags
    formulas := make(map[string]string)
    for _, zman := range publisherZmanim {
        // Get tags for this zman
        tags, err := s.queries.GetTagsForZman(ctx, zman.ID)
        if err != nil {
            continue
        }

        // Check if any of this zman's tags are in active event tags
        if s.shouldShowZman(tags, params.ActiveEventCodes) {
            formulas[zman.ZmanKey] = zman.FormulaDSL
        }
    }

    // Execute filtered formulas
    return s.dslExecutor.ExecuteFormulaSet(formulas, params.DSLContext)
}

func (s *ZmanimService) shouldShowZman(zmanTags []string, activeEvents []string) bool {
    // If zman has no event tags, always show
    hasEventTags := false
    for _, tag := range zmanTags {
        if strings.HasPrefix(tag, "event_") || isKnownEventTag(tag) {
            hasEventTags = true
            break
        }
    }
    if !hasEventTags {
        return true
    }

    // Check if any zman tag matches active events
    for _, zmanTag := range zmanTags {
        for _, activeEvent := range activeEvents {
            if zmanTag == activeEvent {
                return true
            }
        }
    }

    return false
}
```

### Adding a New Event (SQL Only)

To add a new event, NO code changes are needed. Only SQL:

```sql
-- Step 1: Add the tag
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    display_name_english_ashkenazi,
    display_name_english_sephardi,
    tag_type_id,
    hebcal_match_type,
    hebcal_match_string,
    sort_order
) VALUES (
    'new_holiday',
    'חג חדש',
    'New Holiday',
    'New Holiday',
    170,  -- event type
    'exact',
    'New Holiday',  -- Exact HebCal API title
    90
);

-- Step 2: Associate zmanim with the new tag
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT
    mr.id,
    (SELECT id FROM zman_tags WHERE tag_key = 'new_holiday')
FROM master_zmanim_registry mr
WHERE mr.zman_key IN ('candle_lighting', 'havdalah');  -- Example zmanim

-- Done! The system will now:
-- 1. Match "New Holiday" from HebCal API to the new_holiday tag
-- 2. Activate candle_lighting and havdalah on that day
-- 3. Display them in the calendar and API
```

---

## Tag Filtering Logic (ShouldShowZman)

The core filtering logic lives in `ZmanimService.ShouldShowZman()` ([zmanim_service.go:817-960](api/internal/services/zmanim_service.go#L817-L960)). This function determines whether a zman should be displayed based on its tags and the active event codes for the current day.

### EventFilterTag Structure

Tags are represented as:

```go
type EventFilterTag struct {
    TagKey    string `json:"tag_key"`
    TagType   string `json:"tag_type"`   // "event", "timing", or "shita"
    IsNegated bool   `json:"is_negated"` // For exclusion logic
}
```

### Filtering Algorithm

The `ShouldShowZman` function follows this decision tree:

```
1. Separate tags into event/timing categories
2. Check for timing modifiers (day_before, motzei)
3. If NO event tags → SHOW (always display non-event zmanim)
4. For each event tag, determine match based on timing modifier:
   - day_before: ONLY check "erev_" + tag_key (NOT the tag itself!)
   - motzei: check tag_key directly (motzei events in activeEventCodes)
   - no modifier: check tag_key directly
5. Track positive vs negated matches
6. If ANY negated tag matches → HIDE (negation takes precedence)
7. If has positive tags but NONE match → HIDE
8. Otherwise → SHOW
```

**Critical:** Timing modifiers are EXCLUSIVE, not additive. A zman with `day_before` + `shabbos` will ONLY show on Friday (when `erev_shabbos` is active), never on Saturday.

### Code Implementation

```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // Separate event tags and timing tags
    eventTags := []EventFilterTag{}
    timingTags := []EventFilterTag{}
    for _, tag := range tags {
        switch tag.TagType {
        case "event", "jewish_day":
            eventTags = append(eventTags, tag)
        case "timing":
            timingTags = append(timingTags, tag)
        }
    }

    // Check for timing modifiers
    hasDayBefore := false
    hasMoetzei := false
    for _, tt := range timingTags {
        if tt.TagKey == "day_before" { hasDayBefore = true }
        if tt.TagKey == "motzei" { hasMoetzei = true }
    }

    // If no event tags, always show
    if len(eventTags) == 0 {
        return true
    }

    // Check event tags against activeEventCodes
    hasPositiveMatch := false
    hasNegativeMatch := false

    for _, tag := range eventTags {
        var isActive bool

        // Timing modifiers change HOW we match, not just add alternatives:
        // - day_before: ONLY match "erev_" + event (NOT the event itself)
        // - motzei: ONLY match the event when it's motzei time
        // - no timing tag: direct match to event

        if hasDayBefore && !tag.IsNegated {
            // day_before timing: candle lighting should show on EREV, not on the day itself
            // Example: shabbos + day_before matches erev_shabbos (Friday), NOT shabbos (Saturday)
            erevCode := "erev_" + tag.TagKey
            isActive = sliceContains(activeEventCodes, erevCode)
        } else if hasMoetzei && !tag.IsNegated {
            // motzei timing: havdalah should show when the event ends
            // MoetzeiEvents populates activeEventCodes with event codes for motzei
            isActive = sliceContains(activeEventCodes, tag.TagKey)
        } else {
            // No timing modifier: direct match to event
            isActive = sliceContains(activeEventCodes, tag.TagKey)
        }

        if tag.IsNegated {
            if isActive { hasNegativeMatch = true }
        } else {
            if isActive { hasPositiveMatch = true }
        }
    }

    // Negated tags take precedence
    if hasNegativeMatch {
        return false
    }

    // If there are positive tags, at least one must match
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

## Tag Negation System

Tag negation allows excluding zmanim on specific days, even when they would otherwise match. This is stored in the `publisher_zman_tags.is_negated` column.

### Database Schema

```sql
CREATE TABLE publisher_zman_tags (
    publisher_zman_id INTEGER NOT NULL REFERENCES publisher_zmanim(id),
    tag_id            INTEGER NOT NULL REFERENCES zman_tags(id),
    is_negated        BOOLEAN NOT NULL DEFAULT false,  -- ← Negation flag
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (publisher_zman_id, tag_id)
);
```

### How Negation Works

| Zman Tags | Active Events | Result |
|-----------|---------------|--------|
| `[shabbos]` | `[shabbos]` | ✅ SHOW |
| `[shabbos]` | `[chanukah]` | ❌ HIDE (no match) |
| `[sukkos, !shabbos]` | `[sukkos]` | ✅ SHOW |
| `[sukkos, !shabbos]` | `[sukkos, shabbos]` | ❌ HIDE (negation!) |
| `[!shabbos]` | `[chanukah]` | ✅ SHOW (no positive tags needed) |
| `[!shabbos]` | `[shabbos]` | ❌ HIDE |

### Real-World Example

**Scenario:** Alos for Sukkos lulav (עלות לערבות) should show on Sukkos but NOT on Shabbos (when lulav isn't taken).

**Database Configuration:**
```sql
-- Publisher zman for Machzikei Hadass
INSERT INTO publisher_zmanim (publisher_id, zman_key, hebrew_name, ...)
VALUES (3, 'alos_shemini_atzeres', 'עלות לערבות', ...);

-- Tags: show on sukkos, but NOT on shabbos
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
VALUES
    (123, (SELECT id FROM zman_tags WHERE tag_key = 'sukkos'), false),   -- Positive
    (123, (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), true);   -- Negated!
```

**Query Result:**
```sql
SELECT
    pz.zman_key,
    ARRAY_AGG(
        CASE WHEN pzt.is_negated THEN '!' || zt.tag_key ELSE zt.tag_key END
    ) as tags
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
JOIN zman_tags zt ON pzt.tag_id = zt.id
WHERE pz.zman_key = 'alos_shemini_atzeres'
GROUP BY pz.zman_key;

-- Result:
-- zman_key              | tags
-- ----------------------|-------------------
-- alos_shemini_atzeres  | {sukkos, !shabbos}
```

### Negation Precedence Rules

1. **Negated tags always take precedence** over positive tags
2. If ANY negated tag matches → zman is HIDDEN
3. If no negated tags match AND at least one positive tag matches → zman is SHOWN
4. If ONLY negated tags exist (no positive tags) → show unless negated tag matches

---

## Timing Tags & Modifiers

Timing tags modify WHEN zmanim are displayed relative to an event. They don't represent events themselves but change how event tags are matched.

### Available Timing Tags

| Tag Key | Hebrew | Purpose | Example Use |
|---------|--------|---------|-------------|
| `day_before` | יום לפני | Show zman on the day BEFORE the event | Candle lighting on Friday for Shabbos |
| `motzei` | מוצאי | Show zman at the END of the event | Havdalah on Saturday night |

### How Timing Tags Work

**IMPORTANT:** Timing modifiers change HOW matching works - they are NOT additive alternatives.

**day_before modifier:**

When a zman has `day_before` + an event tag like `shabbos`:
- The system **ONLY** checks if `erev_shabbos` is in activeEventCodes
- It does **NOT** also check for `shabbos` itself
- This ensures candle lighting shows on Friday (erev) but NOT on Saturday

```go
// From ShouldShowZman logic - day_before is EXCLUSIVE
if hasDayBefore && !tag.IsNegated {
    // day_before timing: ONLY match "erev_" + event (NOT the event itself)
    // Example: shabbos + day_before matches erev_shabbos (Friday), NOT shabbos (Saturday)
    erevCode := "erev_" + tag.TagKey
    isActive = sliceContains(activeEventCodes, erevCode)
} else {
    // No timing modifier: direct match to event
    isActive = sliceContains(activeEventCodes, tag.TagKey)
}
```

**motzei modifier:**

For zmanim that should appear at the END of an event (like Havdalah):
- The system **ONLY** matches when the event is in MoetzeiEvents
- MoetzeiEvents populates activeEventCodes with the base event code
- Direct matching works because the calendar service handles the timing

### Example: Candle Lighting Configuration

```sql
-- Candle lighting zman tags
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
SELECT
    pz.id,
    zt.id,
    false
FROM publisher_zmanim pz
CROSS JOIN zman_tags zt
WHERE pz.zman_key = 'candle_lighting'
  AND zt.tag_key IN (
    -- Timing modifier
    'day_before',
    -- Event tags (will match via erev_ prefix)
    'shabbos',
    'pesach',
    'shavuos',
    'sukkos',
    'rosh_hashana',
    'yom_kippur'
  );
```

**Runtime Behavior:**

| Today | activeEventCodes | Candle Lighting? | Why |
|-------|------------------|------------------|-----|
| Friday | `[erev_shabbos]` | ✅ YES | `day_before` + `shabbos` → checks `erev_shabbos` ✓ |
| Saturday | `[shabbos]` | ❌ NO | `day_before` + `shabbos` → checks `erev_shabbos` (not present) |
| Thursday before Pesach | `[erev_pesach]` | ✅ YES | `day_before` + `pesach` → checks `erev_pesach` ✓ |
| Pesach Day 1 | `[pesach]` | ❌ NO | `day_before` + `pesach` → checks `erev_pesach` (not present) |

**Key Insight:** With `day_before`, the zman NEVER shows on the actual event day - only on the erev.

### show_in_preview Field

The `publisher_zmanim.show_in_preview` field controls filtering behavior:

```sql
ALTER TABLE publisher_zmanim
ADD COLUMN show_in_preview BOOLEAN NOT NULL DEFAULT true;
```

| show_in_preview | Behavior |
|-----------------|----------|
| `true` | Always show in preview/algorithm editor (skip event filtering) |
| `false` | Apply event filtering based on tags + activeEventCodes |

**Use Cases:**

- `show_in_preview = true`: Core zmanim like sunrise, sunset, chatzos (always visible)
- `show_in_preview = false`: Event-specific zmanim like candle_lighting (filtered by calendar)

**In ZmanimService:**

```go
// Apply calendar context filtering (event zmanim)
// Only filter if ALL conditions met:
// 1. NOT in Algorithm Editor mode (IncludeInactive = false)
// 2. Zman requires event filtering (show_in_preview = false)
if !params.IncludeInactive && !pz.ShowInPreview {
    shouldShow := s.ShouldShowZman(tags, params.ActiveEventCodes)
    if !shouldShow {
        continue  // Skip this zman
    }
}
```

---

## Complete Tag Reference by Type (Updated)

### Summary Statistics

| Type | Count | Hidden | Visible | With HebCal Match |
|------|-------|--------|---------|-------------------|
| event | 54 | 10 | 44 | 48 |
| timing | 1 | 0 | 1 | 0 |
| shita | 13 | 0 | 13 | 0 |
| **Total** | **68** | **10** | **58** | **48** |

---

## Integration Architecture

### Data Flow

```
HebCal API
    ↓
[GET /hebcal?date=2025-12-25]
    ↓
{items: [
  {title: "Chanukah: 3 Candles", category: "holiday"},
  {title: "Shabbat Shirah", category: "holiday"},
  ...
]}
    ↓
PostgreSQL match_hebcal_event() function
    ↓
Active Tag Keys: ["chanukah", "shabbos_shirah"]
    ↓
ZmanimService filters by tags
    ↓
Only zmanim with these tags are calculated
    ↓
API Response / Calendar Display
```

### Key Integration Points

1. **Calendar Service** (`api/internal/calendar/`)
   - Fetches HebCal API events
   - Calls `match_hebcal_event()` for each event
   - Returns list of active tag keys

2. **Zmanim Service** (`api/internal/services/zmanim_service.go`)
   - Receives active tag keys from calendar service
   - Filters publisher zmanim by tags
   - Only calculates DSL formulas for matching zmanim

3. **Database Queries** (`api/internal/db/queries/tag_events.sql`)
   - SQLc generates type-safe Go code
   - Provides queries for tag lookups, filtering, and matching

4. **API Handlers** (`api/internal/handlers/calendar.go`, `zmanim.go`)
   - Coordinates between calendar and zmanim services
   - Returns filtered results to frontend

### HebCal API Parameters

The system calls HebCal with these parameters:

```
v=1              # API version
cfg=json         # JSON response
year=2025        # Gregorian year
month=12         # Gregorian month
day=25           # Gregorian day
il=false         # Israel mode (true/false based on coordinates)
maj=on           # Major holidays
min=on           # Minor holidays
mod=on           # Modern holidays
nx=on            # Rosh Chodesh
mf=on            # Minor fasts
ss=on            # Special Shabbatot
o=on             # Omer count
s=off            # No Torah readings
c=off            # No candle times (we calculate our own)
lg=a             # Ashkenazi transliterations (optional)
```

---

## Best Practices

### For Developers

1. **Never hardcode event logic** - Always use tags
   ```go
   // ❌ WRONG
   if isErevShabbos || isErevYomTov {
       showCandleLighting = true
   }

   // ✅ CORRECT
   activeEvents := calendarService.GetActiveTagsForDate(ctx, date, lat, lng)
   zmanim := zmanimService.CalculateZmanim(ctx, CalculateParams{
       ActiveEventCodes: activeEvents,
   })
   ```

2. **Use the view for debugging**
   ```sql
   -- See all HebCal mappings at a glance
   SELECT * FROM v_hebcal_event_mappings;
   ```

3. **Test pattern matches carefully**
   ```sql
   -- Test a regex pattern
   SELECT 'Chanukah: 8th Day' ~ '^Chanukah:';  -- Returns true
   SELECT 'Pesach VII' ~ '^Pesach [IVX]+';     -- Returns true
   ```

4. **Use SQLc for type safety**
   - All queries are in `api/internal/db/queries/tag_events.sql`
   - Run `sqlc generate` after schema changes
   - Use generated Go types in code

### For Database Administrators

1. **Maintain the CHECK constraint**
   - Ensures exactly one match column is populated per match type
   - Prevents invalid configurations

2. **Use migrations for new tags**
   ```sql
   -- db/migrations/YYYYMMDDHHMMSS_add_new_holiday.sql
   BEGIN;

   INSERT INTO zman_tags (...) VALUES (...);
   INSERT INTO master_zman_tags (...) VALUES (...);

   COMMIT;
   ```

3. **Monitor HebCal API changes**
   - HebCal may change event titles or categories
   - Update `hebcal_match_string` or `hebcal_match_pattern` as needed

---

## Troubleshooting

### Event Not Matching

**Problem:** HebCal event not mapping to expected tag.

**Diagnosis:**
```sql
-- Check what HebCal title you're getting
SELECT * FROM match_hebcal_event('Actual HebCal Title Here', 'holiday');

-- See all exact matches
SELECT tag_key, hebcal_match_string
FROM zman_tags
WHERE hebcal_match_type = 'exact'
ORDER BY hebcal_match_string;

-- See all pattern matches
SELECT tag_key, hebcal_match_pattern
FROM zman_tags
WHERE hebcal_match_type = 'group'
ORDER BY tag_key;
```

**Solution:** Update the tag's match string/pattern to match HebCal's actual output.

---

### Zmanim Not Showing on Expected Day

**Problem:** Zmanim not appearing on a specific event day.

**Diagnosis:**
```sql
-- Check what tags are active
SELECT * FROM match_hebcal_event('Event Title', 'category');

-- Check if zman has the required tag
SELECT t.tag_key
FROM publisher_zman_tags pzt
JOIN zman_tags t ON t.id = pzt.tag_id
WHERE pzt.publisher_zman_id = ?;
```

**Solution:** Add the appropriate tag to the zman in `publisher_zman_tags` or `master_zman_tags`.

---

### Multiple Tags Matching Same Event

**Problem:** One HebCal event matching multiple tags.

**Expected Behavior:** The `match_hebcal_event()` function returns only the FIRST match based on priority:
1. Category matches (highest priority)
2. Exact matches
3. Group/regex matches (lowest priority)

Within each priority level, it returns the first match found. For group matches, it prefers longer (more specific) patterns.

---

## Related Documentation

- [Tag-Driven Events Architecture](./architecture/tag-driven-events.md)
- [Eliminating Hardcoded Event Logic](./migration/eliminate-hardcoded-logic.md)
- [Database Schema Reference](./DATABASE.md)
- [DSL Complete Guide](./dsl-complete-guide.md)
- [API Reference](./API_REFERENCE.md)

---

## Appendix: HebCal Categories

HebCal API uses these category values:

| Category | Description | Example Events |
|----------|-------------|----------------|
| `holiday` | Major and minor Jewish holidays | Chanukah, Purim, Pesach |
| `roshchodesh` | New month celebrations | Rosh Chodesh Tevet |
| `fast` | Fast days | Asara B'Tevet, Tzom Gedaliah |
| `parashat` | Weekly Torah portions | Parashat Vayeshev |
| `candles` | Candle lighting times | Candle lighting: 4:15pm |
| `havdalah` | Shabbat/Yom Tov end times | Havdalah: 5:23pm |
| `mevarchim` | Shabbat announcing new month | Shabbat Mevarchim Chodesh Tevet |
| `omer` | Counting of Omer | 15th day of the Omer |

Our system maps these to internal tags via the `category` match type.
