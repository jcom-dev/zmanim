# Jewish Day-Specific Zmanim Tag System Enhancement

## Problem Statement

The "Alos for Aravos" (Shemini Atzeres) zman should only display on Shemini Atzeres, not every day. Currently, tags like `shabbos`, `yom_tov`, `fast_day` are too broad - we need the ability to link zmanim to **specific** Jewish calendar days.

## Current Infrastructure Analysis

### Existing Systems (Already in Place)

The codebase already has substantial infrastructure for day-specific zmanim:

1. **`day_types` table** (41 entries)
   - Comprehensive list including: `shemini_atzeres`, `hoshanah_rabbah`, `chanukah`, `purim`, `erev_pesach`, etc.
   - Has parent relationships (`shemini_atzeres` → `yom_tov`, `hoshanah_rabbah` → `chol_hamoed`)

2. **`jewish_events` table** (23 entries)
   - Events like `shabbos`, `yom_kippur`, `chanukah`, `pesach_first`, `shemini_atzeres`
   - Includes `duration_days_israel/diaspora` and `fast_start_type`

3. **Junction Tables (Already Exist)**
   - `master_zman_day_types` - Links master zmanim to specific day types
   - `master_zman_events` - Links master zmanim to Jewish events (with `applies_to_day` for multi-day events)
   - `publisher_zman_events` - Publisher-level overrides

4. **`zman_tags` table** - Current tag types:
   - `event` (shabbos, yom_tov, fast_day, pesach, tisha_bav, yom_kippur)
   - `timing` (day_before, day_of, night_after)
   - `behavior` (is_candle_lighting, is_havdalah, is_fast_start, is_fast_end)
   - `shita` (shita_gra, shita_mga, shita_rt, etc.)
   - `calculation` (calc_degrees, calc_fixed, calc_zmanis)
   - `category` (category_shema, category_tefila, category_mincha, etc.)

### Gap Analysis

**The infrastructure exists but isn't fully utilized:**

1. `master_zman_day_types` and `master_zman_events` tables exist but are **empty**
2. The UI and API don't expose these associations
3. The zmanim display logic doesn't filter based on these associations

## Proposed Solution

### Phase 1: Extend Tag System with Jewish Day Tags

Add new tags of type `jewish_day` to the existing `zman_tags` table:

```sql
-- New tag type constraint
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS zman_tags_tag_type_check;
ALTER TABLE zman_tags ADD CONSTRAINT zman_tags_tag_type_check
CHECK (tag_type IN ('event', 'timing', 'behavior', 'shita', 'calculation', 'category', 'jewish_day'));

-- Jewish Day Tags (linked to specific calendar days)
-- These are PRIMARY day markers - HebCal handles Israel vs Diaspora differences automatically
INSERT INTO zman_tags (tag_key, name, display_name_hebrew, display_name_english, tag_type, description, sort_order) VALUES

-- Omer Period (49 days from 2nd night Pesach to Shavuos)
('omer', 'omer', 'ספירת העומר', 'Sefirat HaOmer', 'jewish_day', 'During the Omer counting period (49 days)', 300),

-- Chanukah (8 days)
('chanukah', 'chanukah', 'חנוכה', 'Chanukah', 'jewish_day', 'Festival of Lights (8 days)', 310),

-- Purim
('purim', 'purim', 'פורים', 'Purim', 'jewish_day', 'Feast of Lots', 320),
('shushan_purim', 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'jewish_day', 'Purim in walled cities', 321),
('taanis_esther', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'jewish_day', 'Fast of Esther', 322),

-- Pesach (HebCal handles 7 vs 8 days for Israel/Diaspora)
('erev_pesach', 'erev_pesach', 'ערב פסח', 'Erev Pesach', 'jewish_day', 'Day before Passover (chametz times)', 330),
('pesach', 'pesach', 'פסח', 'Pesach', 'jewish_day', 'Passover festival days', 331),
('chol_hamoed_pesach', 'chol_hamoed_pesach', 'חול המועד פסח', 'Chol HaMoed Pesach', 'jewish_day', 'Intermediate days of Pesach', 332),

-- Shavuos (HebCal handles 1 vs 2 days for Israel/Diaspora)
('erev_shavuos', 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', 'jewish_day', 'Day before Shavuos', 340),
('shavuos', 'shavuos', 'שבועות', 'Shavuos', 'jewish_day', 'Feast of Weeks', 341),

-- Elul & High Holidays
('selichos', 'selichos', 'סליחות', 'Selichos', 'jewish_day', 'Penitential prayer period', 350),
('erev_rosh_hashanah', 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', 'jewish_day', 'Day before Rosh Hashanah', 351),
('rosh_hashanah', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'jewish_day', 'Jewish New Year (2 days)', 352),
('tzom_gedaliah', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'jewish_day', 'Fast of Gedaliah', 353),
('aseres_yemei_teshuva', 'aseres_yemei_teshuva', 'עשרת ימי תשובה', 'Ten Days of Repentance', 'jewish_day', 'Period from RH to YK', 354),
('erev_yom_kippur', 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', 'jewish_day', 'Day before Yom Kippur', 355),
('yom_kippur', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'jewish_day', 'Day of Atonement', 356),

-- Sukkos (HebCal handles Israel/Diaspora differences)
('erev_sukkos', 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', 'jewish_day', 'Day before Sukkos', 360),
('sukkos', 'sukkos', 'סוכות', 'Sukkos', 'jewish_day', 'Feast of Tabernacles', 361),
('chol_hamoed_sukkos', 'chol_hamoed_sukkos', 'חול המועד סוכות', 'Chol HaMoed Sukkos', 'jewish_day', 'Intermediate days of Sukkos', 362),
('hoshanah_rabbah', 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', 'jewish_day', '7th day of Sukkos', 363),
('shemini_atzeres', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', 'jewish_day', '8th day of assembly', 364),
('simchas_torah', 'simchas_torah', 'שמחת תורה', 'Simchas Torah', 'jewish_day', 'Rejoicing of the Torah (Diaspora: day 2)', 365),

-- Minor Fasts
('asarah_bteves', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', 'jewish_day', '10th of Teves fast', 370),
('shiva_asar_btamuz', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', 'jewish_day', '17th of Tamuz fast', 371),
('tisha_bav', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'jewish_day', '9th of Av', 372),
('erev_tisha_bav', 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', 'jewish_day', 'Day/night before Tisha B''Av', 373),

-- Mourning Periods (for restrictions, not zmanim)
('three_weeks', 'three_weeks', 'בין המצרים', 'The Three Weeks', 'jewish_day', 'Period between 17 Tamuz and 9 Av', 380),
('nine_days', 'nine_days', 'תשעת הימים', 'The Nine Days', 'jewish_day', 'First 9 days of Av', 381),

-- Other
('rosh_chodesh', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'jewish_day', 'New Moon/Month', 390),
('tu_bshvat', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'jewish_day', 'New Year for Trees', 391);

-- Note: We intentionally omit:
-- - lag_baomer (no special zmanim)
-- - megillah_reading (purim tag is sufficient)
-- - bedikas_chametz, biur_chametz (erev_pesach + pesach tags + existing category_chametz are sufficient)
-- - chanukah_day_1, chanukah_day_8 (chanukah tag covers all 8 days)
-- - Israeli national days (yom_hashoah, yom_hazikaron, yom_haatzmaut, yom_yerushalayim) - no halachic zmanim
-- - sheni_chamishi (no special zmanim, just Torah reading)
```

### Phase 2: Link Tags to HebCal Event Codes

Create a mapping table between tags and the HebCal event detection system.

**Key Design Principle**: HebCal automatically handles Israel vs Diaspora differences:
- Yom Tov Sheni (2nd day) only in Diaspora
- Pesach: 7 days in Israel, 8 in Diaspora
- Shavuos: 1 day in Israel, 2 in Diaspora
- Simchas Torah: Same day as Shemini Atzeres in Israel, separate day in Diaspora

We pass `il=true/false` to HebCal based on the user's location, and HebCal returns the correct events.

```sql
CREATE TABLE IF NOT EXISTS tag_event_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES zman_tags(id) ON DELETE CASCADE,

    -- HebCal integration (primary method)
    -- Pattern matching against HebCal event names
    -- HebCal automatically handles Israel/Diaspora when called with il=true/false
    hebcal_event_pattern VARCHAR(100),  -- e.g., "Chanukah", "Sukkot VII (Hoshana Raba)"

    -- Hebrew date matching (fallback/alternative)
    hebrew_month INTEGER,               -- 1-13 (13 for Adar II)
    hebrew_day_start INTEGER,           -- Start day
    hebrew_day_end INTEGER,             -- End day (for ranges)

    -- Priority for overlapping matches
    priority INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_tag_event_mappings_tag ON tag_event_mappings(tag_id);
CREATE INDEX idx_tag_event_mappings_pattern ON tag_event_mappings(hebcal_event_pattern);

-- HebCal Event Pattern Mappings
-- Note: HebCal returns different events based on il= parameter
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern) VALUES
-- Sukkos cycle
((SELECT id FROM zman_tags WHERE tag_key = 'shemini_atzeres'), 'Shmini Atzeret'),
((SELECT id FROM zman_tags WHERE tag_key = 'simchas_torah'), 'Simchat Torah'),
((SELECT id FROM zman_tags WHERE tag_key = 'hoshanah_rabbah'), 'Sukkot VII (Hoshana Raba)'),
((SELECT id FROM zman_tags WHERE tag_key = 'sukkos'), 'Sukkot%'),
((SELECT id FROM zman_tags WHERE tag_key = 'chol_hamoed_sukkos'), 'Sukkot % (CH''M)'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_sukkos'), 'Erev Sukkot'),

-- Pesach cycle
((SELECT id FROM zman_tags WHERE tag_key = 'erev_pesach'), 'Erev Pesach'),
((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach%'),
((SELECT id FROM zman_tags WHERE tag_key = 'chol_hamoed_pesach'), 'Pesach % (CH''M)'),

-- Shavuos
((SELECT id FROM zman_tags WHERE tag_key = 'erev_shavuos'), 'Erev Shavuot'),
((SELECT id FROM zman_tags WHERE tag_key = 'shavuos'), 'Shavuot%'),

-- High Holidays
((SELECT id FROM zman_tags WHERE tag_key = 'erev_rosh_hashanah'), 'Erev Rosh Hashana'),
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'), 'Rosh Hashana%'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_yom_kippur'), 'Erev Yom Kippur'),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), 'Yom Kippur'),
((SELECT id FROM zman_tags WHERE tag_key = 'tzom_gedaliah'), 'Tzom Gedaliah'),

-- Other holidays
((SELECT id FROM zman_tags WHERE tag_key = 'chanukah'), 'Chanukah%'),
((SELECT id FROM zman_tags WHERE tag_key = 'purim'), 'Purim'),
((SELECT id FROM zman_tags WHERE tag_key = 'shushan_purim'), 'Shushan Purim'),
((SELECT id FROM zman_tags WHERE tag_key = 'taanis_esther'), 'Ta''anit Esther'),
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_chodesh'), 'Rosh Chodesh%'),
((SELECT id FROM zman_tags WHERE tag_key = 'tu_bshvat'), 'Tu BiShvat'),

-- Fasts
((SELECT id FROM zman_tags WHERE tag_key = 'asarah_bteves'), 'Asara B''Tevet'),
((SELECT id FROM zman_tags WHERE tag_key = 'shiva_asar_btamuz'), 'Shiva Asar B''Tamuz'),
((SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), 'Tish''a B''Av'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_tisha_bav'), 'Erev Tish''a B''Av');

-- Omer uses special HebCal category
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern) VALUES
((SELECT id FROM zman_tags WHERE tag_key = 'omer'), '%day of the Omer');
```

**Israel Detection Logic** (already exists in codebase):
```go
// In api/internal/calendar/events.go
func IsInIsrael(lat, lng float64) bool {
    // Approximate Israel bounding box
    return lat >= 29.5 && lat <= 33.3 && lng >= 34.2 && lng <= 35.9
}

// HebCal API call with location-aware il parameter
func GetHebCalEvents(date time.Time, lat, lng float64) ([]HebCalEvent, error) {
    isIsrael := IsInIsrael(lat, lng)
    url := fmt.Sprintf("https://www.hebcal.com/hebcal?v=1&cfg=json&year=%d&month=%d&day=%d&il=%t",
        date.Year(), date.Month(), date.Day(), isIsrael)
    // ...
}
```

### Phase 3: UI Changes

1. **Tag Editor Enhancement**
   - Add "Jewish Day" category to tag picker
   - Show day-specific tags in a separate collapsible section
   - Allow publishers to override which days a zman appears

2. **Zmanim Display Logic**
   - Modify the display to check `jewish_day` tags against current date
   - Use HebCal integration to determine current Jewish day
   - Filter zmanim list based on applicable days

3. **Algorithm Preview**
   - Show which Jewish days a zman applies to
   - Preview appearance on specific Jewish dates

### Phase 4: API Changes

```go
// Add to calendar/events.go
func GetActiveJewishDayTags(date time.Time, lat, lng float64, isIsrael bool) ([]string, error) {
    // Returns list of tag_keys that apply to this date
    // e.g., ["shemini_atzeres", "yom_tov", "sukkos"]
}

// Modify zmanim display endpoint
type ZmanimDisplayRequest struct {
    Date      string  `json:"date"`
    Latitude  float64 `json:"latitude"`
    Longitude float64 `json:"longitude"`
    Timezone  string  `json:"timezone"`
}

// Returns filtered zmanim based on:
// 1. Publisher's enabled zmanim
// 2. Jewish day tags that match the current date
// 3. Timing tags (day_before, day_of, night_after)
```

## Implementation Order

### Immediate (Phase 1)
1. Add new tag type `jewish_day` to constraint
2. Insert all Jewish day tags
3. Update tag editor UI to show new category

### Short-term (Phase 2)
1. Create `tag_event_mappings` table
2. Add HebCal pattern matching
3. Implement `GetActiveJewishDayTags()` function

### Medium-term (Phase 3)
1. Update zmanim display API to filter by Jewish day
2. Add Jewish day tags to Manchester publisher zmanim
3. Add UI for previewing zmanim on specific Jewish dates

### Long-term (Phase 4)
1. Publisher override UI for day-specific zmanim
2. Calendar view showing which zmanim appear on which days
3. Documentation and help text

## Example Usage

For "Alos for Aravos" (Manchester):

```sql
-- Tag the zman with shemini_atzeres
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id) VALUES
(
    (SELECT id FROM publisher_zmanim WHERE zman_key = 'alos_shemini_atzeres'
     AND publisher_id = '6c85458d-2225-4f55-bc15-5c9844bcf362'),
    (SELECT id FROM zman_tags WHERE tag_key = 'shemini_atzeres')
);
```

When displaying zmanim for a given date:
1. Call HebCal API with `il=false` (Manchester is Diaspora)
2. HebCal returns events for that date, e.g., `["Shmini Atzeret"]`
3. Match events against `tag_event_mappings` to get active tags: `['shemini_atzeres']`
4. Include zmanim tagged with `shemini_atzeres`
5. Filter out zmanim tagged with `shemini_atzeres` on other days

**Israel vs Diaspora Example:**

On the same Hebrew date (22 Tishrei):
- **Israel**: HebCal returns `["Shmini Atzeret", "Simchat Torah"]` (same day)
- **Diaspora**: HebCal returns `["Shmini Atzeret"]` only (Simchas Torah is next day)

The system automatically handles this - no special code needed per location.

## Benefits

1. **Granular Control**: Publishers can specify exactly which days a zman appears
2. **HebCal Integration**: Automatic detection of Jewish calendar dates
3. **Backwards Compatible**: Existing `event` type tags still work for broad categories
4. **Extensible**: Easy to add new Jewish days or customs
5. **Publisher Overrides**: Each publisher can customize day-specific behavior

## Migration Notes

- Existing `event` type tags (`shabbos`, `yom_tov`, `fast_day`) remain for broad categories
- New `jewish_day` tags are more specific
- Both can be used together (e.g., `yom_tov` + `shemini_atzeres`)
- The UI will show both but group them logically
