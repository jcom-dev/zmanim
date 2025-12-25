# Tag Mapping Rationalization Plan

## Goal

Transform the current mapping system from:
- **58 mappings → 42 tags** (messy many-to-many)

To:
- **~55 mappings → ~55 tags** (clean 1-to-1)
- **Group tags** for when HebCal events need categorization
- **Zero mappings** that don't relate to real HebCal events

## Current Problems

### Problem 1: Multiple HebCal Events → Same Tag

Some tags map to multiple HebCal events (collapsing specificity):

| Tag | HebCal Events | Problem |
|-----|---------------|---------|
| `chol_hamoed_sukkos` | `Sukkot III (CH''M)`, `IV`, `V`, `VI`, `VII (Hoshana Raba)` | 5 distinct days → 1 tag |
| `chol_hamoed_pesach` | `Pesach III (CH''M)`, `IV`, `V`, `VI` | 4 distinct days → 1 tag |
| `pesach` | `Pesach I`, `II`, `VII`, `VIII` | 4 distinct days → 1 tag |
| `fast_day` | 5 different fasts | Generic category, not specific event |
| `pesach_last` | `Pesach VII`, `VIII` | 2 days → 1 tag |
| `sukkos` | `Sukkot I`, `II` | 2 days → 1 tag |

### Problem 2: Same HebCal Event → Multiple Tags

Some HebCal events map to multiple tags (duplication):

| HebCal Event | Tags | Problem |
|--------------|------|---------|
| `Asara B'Tevet` | `asarah_bteves`, `fast_day` | Specific + generic |
| `Pesach VII` | `pesach`, `pesach_last` | Overlapping categories |
| `Pesach VIII` | `pesach`, `pesach_last` | Overlapping categories |
| `Sukkot VII (Hoshana Raba)` | `chol_hamoed_sukkos`, `hoshanah_rabbah` | Specific + CH"M category |
| `Ta'anit Bechorot` | `fast_day`, `taanis_bechoros` | Generic + specific |
| `Ta'anit Esther` | `fast_day`, `taanis_esther` | Generic + specific |
| `Tzom Gedaliah` | `fast_day`, `tzom_gedaliah` | Generic + specific |
| `Tzom Tammuz` | `fast_day`, `shiva_asar_btamuz` | Generic + specific |

### Problem 3: Ghost Tags (No HebCal Mapping)

7 tags with zero HebCal mappings:

| Tag | Reason | Action |
|-----|--------|--------|
| `yom_tov` | Generic category | Keep as group tag |
| `shabbos` | Hardcoded (day of week) | Keep (special case) |
| `fast_day` | Generic category | Keep as group tag |
| `three_weeks` | Period (17 Tamuz-9 Av) | Keep as period tag |
| `nine_days` | Period (1-9 Av) | Keep as period tag |
| `aseres_yemei_teshuva` | Period (RH-YK) | Keep as period tag |
| `selichos` | Missing mapping! | Add mapping to "Leil Selichot" |

---

## Proposed Solution

### Tier 1: Specific Event Tags (1-to-1 with HebCal)

Each HebCal event gets its own tag. Examples:

**Multi-Day Events:**
- `chanukah_1` ← "Chanukah: 1 Candle"
- `chanukah_2` ← "Chanukah: 2 Candles"
- ...
- `chanukah_8` ← "Chanukah: 8 Candles"

**Pesach:**
- `pesach_1` ← "Pesach I"
- `pesach_2` ← "Pesach II"
- `pesach_3_chm` ← "Pesach III (CH''M)"
- `pesach_4_chm` ← "Pesach IV (CH''M)"
- `pesach_5_chm` ← "Pesach V (CH''M)"
- `pesach_6_chm` ← "Pesach VI (CH''M)"
- `pesach_7` ← "Pesach VII"
- `pesach_8` ← "Pesach VIII"

**Sukkot:**
- `sukkos_1` ← "Sukkot I"
- `sukkos_2` ← "Sukkot II"
- `sukkos_3_chm` ← "Sukkot III (CH''M)"
- `sukkos_4_chm` ← "Sukkot IV (CH''M)"
- `sukkos_5_chm` ← "Sukkot V (CH''M)"
- `sukkos_6_chm` ← "Sukkot VI (CH''M)"
- `hoshanah_rabbah` ← "Sukkot VII (Hoshana Raba)"

**Rosh Hashana:**
- `rosh_hashanah_1` ← "Rosh Hashana I"
- `rosh_hashanah_2` ← "Rosh Hashana II"

**Shavuos:**
- `shavuos_1` ← "Shavuot I" (diaspora day 1)
- `shavuos_2` ← "Shavuot II" (diaspora day 2)

**Fasts:**
- `asarah_bteves` ← "Asara B'Tevet"
- `tzom_gedaliah` ← "Tzom Gedaliah"
- `taanis_esther` ← "Ta'anit Esther"
- `shiva_asar_btamuz` ← "Tzom Tammuz"
- `tisha_bav` ← "Tish'a B'Av"
- `taanis_bechoros` ← "Ta'anit Bechorot"

**Special Shabbosim:**
- `shabbos_shekalim` ← "Shabbat Shekalim"
- `shabbos_zachor` ← "Shabbat Zachor"
- `shabbos_parah` ← "Shabbat Parah"
- `shabbos_hachodesh` ← "Shabbat HaChodesh"
- `shabbos_hagadol` ← "Shabbat HaGadol"
- `shabbos_chazon` ← "Shabbat Chazon"
- `shabbos_nachamu` ← "Shabbat Nachamu"
- `shabbos_shuva` ← "Shabbat Shuva"
- `shabbos_shirah` ← "Shabbat Shirah"

**Other Events:**
- `rosh_chodesh_*` ← One per month (12 tags)
- `erev_pesach` ← "Erev Pesach"
- `erev_yom_kippur` ← "Erev Yom Kippur"
- `erev_rosh_hashanah` ← "Erev Rosh Hashana"
- `erev_shavuos` ← "Erev Shavuot"
- `erev_sukkos` ← "Erev Sukkot"
- `erev_tisha_bav` ← "Erev Tish'a B'Av"
- `yom_kippur` ← "Yom Kippur"
- `simchas_torah` ← "Simchat Torah"
- `shemini_atzeres` ← "Shmini Atzeret"
- `purim` ← "Purim"
- `shushan_purim` ← "Shushan Purim"
- `tu_bshvat` ← "Tu BiShvat"
- `tu_bav` ← "Tu B'Av"
- `lag_baomer` ← "Lag BaOmer"
- `pesach_sheni` ← "Pesach Sheni"
- `selichos` ← "Leil Selichot"

**Omer:**
- `omer` ← "%day of the Omer" (wildcard matches all 49 days)

---

### Tier 2: Group Tags (Generic Categories)

These tags do NOT map to HebCal events. They're used for filtering zmanim by category:

| Group Tag | Purpose | Members (examples) |
|-----------|---------|-------------------|
| `yom_tov` | Any major Yom Tov | pesach_1, pesach_2, rosh_hashanah_1, sukkos_1, shavuos_1, etc. |
| `fast_day` | Any fast day | asarah_bteves, tzom_gedaliah, tisha_bav, etc. |
| `chol_hamoed` | Any Chol HaMoed | pesach_3_chm, pesach_4_chm, sukkos_3_chm, etc. |
| `pesach` | Any day of Pesach | pesach_1 through pesach_8 |
| `sukkos` | Any day of Sukkot | sukkos_1 through hoshanah_rabbah |
| `chanukah` | Any day of Chanukah | chanukah_1 through chanukah_8 |
| `rosh_hashanah` | Both days of RH | rosh_hashanah_1, rosh_hashanah_2 |
| `shavuos` | Both days of Shavuos | shavuos_1, shavuos_2 (diaspora) |
| `shabbos` | Every Shabbat | (hardcoded, not from HebCal) |

**How Group Tags Work:**

Zmanim are tagged with BOTH specific and group tags:

```sql
-- Example: Fast begins zman
INSERT INTO master_zman_tags (master_zman_id, tag_id)
VALUES
  (fast_begins_id, (SELECT id FROM zman_tags WHERE tag_key = 'asarah_bteves')),
  (fast_begins_id, (SELECT id FROM zman_tags WHERE tag_key = 'tzom_gedaliah')),
  (fast_begins_id, (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav')),
  (fast_begins_id, (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'));  -- Group tag
```

When `asarah_bteves` is active:
- User searches for "asarah_bteves" → finds fast_begins
- User searches for "fast_day" → finds fast_begins (because asarah_bteves is a fast)

---

### Tier 3: Period Tags (Date Ranges)

These tags represent multi-day periods:

| Period Tag | Hebrew Dates | HebCal Mapping |
|------------|--------------|----------------|
| `three_weeks` | 17 Tamuz - 9 Av | Date range (no HebCal event) |
| `nine_days` | 1 Av - 9 Av | Date range (no HebCal event) |
| `aseres_yemei_teshuva` | 1 Tishrei - 10 Tishrei | Date range (no HebCal event) |
| `omer` | Day after Pesach I - Erev Shavuos | Matches "%day of the Omer" |

**Implementation:** Use `hebrew_month` + `hebrew_day_start` + `hebrew_day_end` in `tag_event_mappings`.

---

## Migration Steps

### Step 1: Create New Specific Tags

Add specific tags for multi-day events that currently collapse to one tag:

```sql
-- Chanukah (8 tags)
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES
  ('chanukah_1', 'חנוכה יום א׳', 'Chanukah Day 1', 170),
  ('chanukah_2', 'חנוכה יום ב׳', 'Chanukah Day 2', 170),
  ... (through 8)

-- Pesach (8 tags)
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES
  ('pesach_1', 'פסח יום א׳', 'Pesach Day 1', 170),
  ('pesach_2', 'פסח יום ב׳', 'Pesach Day 2', 170),
  ('pesach_3_chm', 'פסח חול המועד יום א׳', 'Pesach Chol HaMoed Day 1', 170),
  ... (through 8)

-- Sukkot (8 tags including Hoshana Raba, Shmini Atzeret, Simchat Torah)
-- Rosh Hashana (2 tags)
-- Shavuos (2 tags)
```

### Step 2: Create 1-to-1 Mappings

Replace many-to-many mappings with 1-to-1:

```sql
-- DELETE old mappings
DELETE FROM tag_event_mappings WHERE tag_id IN (
  SELECT id FROM zman_tags WHERE tag_key IN ('chanukah', 'pesach', 'sukkos', 'rosh_hashanah', 'shavuos', 'chol_hamoed_pesach', 'chol_hamoed_sukkos', 'pesach_last')
);

-- INSERT new 1-to-1 mappings
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
VALUES
  ((SELECT id FROM zman_tags WHERE tag_key = 'chanukah_1'), 'Chanukah: 1 Candle', 100),
  ((SELECT id FROM zman_tags WHERE tag_key = 'chanukah_2'), 'Chanukah: 2 Candles', 100),
  ...
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach_1'), 'Pesach I', 100),
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach_2'), 'Pesach II', 100),
  ...
```

### Step 3: Mark Group Tags as Hidden

Generic group tags should NOT show to users (they're internal filters):

```sql
UPDATE zman_tags
SET is_hidden = true
WHERE tag_key IN ('yom_tov', 'fast_day', 'chol_hamoed', 'pesach', 'sukkos', 'chanukah', 'rosh_hashanah', 'shavuos', 'shabbos');
```

**Exception:** `shabbos` might stay visible if users want to filter for "any Shabbat zmanim".

### Step 4: Remove Duplicate Mappings

Delete mappings where a specific event maps to both specific AND generic tags:

```sql
-- Keep ONLY specific tag mappings in tag_event_mappings
DELETE FROM tag_event_mappings
WHERE tag_id = (SELECT id FROM zman_tags WHERE tag_key = 'fast_day');
```

**Instead:** Add group tags directly to zmanim in `master_zman_tags`:

```sql
-- Tag fast_begins with all 6 fasts + generic fast_day
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT
  (SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins'),
  id
FROM zman_tags
WHERE tag_key IN ('asarah_bteves', 'tzom_gedaliah', 'tisha_bav', 'taanis_esther', 'taanis_bechoros', 'shiva_asar_btamuz', 'fast_day');
```

### Step 5: Add Missing Selichos Mapping

```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
VALUES (
  (SELECT id FROM zman_tags WHERE tag_key = 'selichos'),
  'Leil Selichot',
  100
);
```

### Step 6: Delete or Repurpose Redundant Tags

**Investigate:**
- `pesach_first` - unused, no mappings → DELETE
- `pesach_last` - replaced by pesach_7, pesach_8 → DELETE
- `chol_hamoed_pesach` - replaced by pesach_3_chm through pesach_6_chm → DELETE or repurpose as group tag
- `chol_hamoed_sukkos` - replaced by sukkos_3_chm through sukkos_6_chm → DELETE or repurpose as group tag

---

## Final Tag Count

### Specific Event Tags (with HebCal mappings): ~55

- Chanukah: 8
- Pesach: 8
- Sukkot: 8 (including Hoshana Raba, Shmini Atzeret, Simchat Torah)
- Rosh Hashana: 2
- Shavuos: 2
- Fasts: 6
- Special Shabbosim: 9
- Omer: 1 (wildcard)
- Rosh Chodesh: 1 (wildcard - or 12 specific?)
- Other holidays: ~10 (Purim, Tu B'Shvat, etc.)

### Group Tags (NO HebCal mappings, hidden): ~9

- yom_tov
- fast_day
- chol_hamoed
- pesach
- sukkos
- chanukah
- rosh_hashanah
- shavuos
- shabbos

### Period Tags (date ranges, hidden): 3

- three_weeks
- nine_days
- aseres_yemei_teshuva

**Total:** ~67 tags (55 specific + 9 group + 3 period)

---

## Benefits

1. **Clean 1-to-1 mapping** - Each HebCal event → exactly 1 tag
2. **No ambiguity** - "Pesach III" always means `pesach_3_chm`, never confused with generic `pesach`
3. **Flexible grouping** - Users can filter by specific day (`pesach_3_chm`) or all of Pesach (`pesach` group tag)
4. **Zero ghost mappings** - Every mapping in `tag_event_mappings` corresponds to a real HebCal event
5. **Hidden complexity** - Users don't see internal group tags, only specific events

---

## Alternative: Keep Current System with Clarifications

If you want to keep the current collapsing system (58 → 42), we should:

1. **Mark `fast_day` as hidden** - It's a group tag, not specific
2. **Remove duplicate mappings** - `Asara B'Tevet` should map ONLY to `asarah_bteves`, not also to `fast_day`
3. **Document clearly** which tags are "group tags" vs "specific event tags"
4. **Add selichos mapping**

This would give:
- 42 tags with HebCal mappings (specific events)
- 7 group/period tags (no HebCal mappings)
- ~42 HebCal mappings (1-to-1 after removing duplicates)

---

## Recommendation

I recommend the **full rationalization** to specific tags because:
- Publishers may want zmanim for specific days (e.g., "only on Chanukah day 1")
- Current system loses day-level granularity
- Cleaner architecture long-term

But if that's too much work, the **minimal fix** is:
1. Remove duplicate mappings (1 HebCal event → 1 tag only)
2. Mark group tags as hidden
3. Add selichos mapping

**Your call!** Which approach do you prefer?
