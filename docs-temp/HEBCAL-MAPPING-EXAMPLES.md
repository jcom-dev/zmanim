# HebCal Event Mapping Examples

This document provides concrete mapping examples from the HebCal events CSV to demonstrate the 2-column matching system.

## Quick Reference

| Mapping Type | Count | Example Pattern |
|--------------|-------|-----------------|
| EXACT | ~140 | `hebcal_event_pattern = "Purim"` |
| NUMBERED | 8 | `regex = "^Chanukah: [1-8] Candles?$"` |
| YEARLY | 11 | `regex = "^Rosh Hashana \d{4}$"` |
| MONTHLY | 13 | `regex = "^Rosh Chodesh [A-Z]"` |
| MULTI-DAY | Variable | `regex = "^Pesach (I{1,3}|IV|V|VI{1,2}|VIII)..."` |
| PARASHAT | 59 | Individual EXACT matches |

---

## Complete Mapping Examples

### 1. EXACT Matches (1:1 Mapping)

These events map exactly to a single tag with no variations.

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | HebCal Event | Notes |
|---------|----------|---------------------|----------------------|--------------|-------|
| purim | TRUE | Purim | NULL | "Purim" | Major holiday |
| yom_kippur | TRUE | Yom Kippur | NULL | "Yom Kippur" | Day of Atonement |
| lag_baomer | TRUE | Lag BaOmer | NULL | "Lag BaOmer" | 33rd day of Omer |
| tu_bishvat | TRUE | Tu BiShvat | NULL | "Tu BiShvat" | New Year for Trees |
| tu_bav | TRUE | Tu B'Av | NULL | "Tu B'Av" | 15th of Av |
| erev_pesach | TRUE | Erev Pesach | NULL | "Erev Pesach" | Eve of Passover |
| erev_yom_kippur | TRUE | Erev Yom Kippur | NULL | "Erev Yom Kippur" | Eve of Yom Kippur |
| erev_rosh_hashanah | TRUE | Erev Rosh Hashana | NULL | "Erev Rosh Hashana" | Eve of Rosh Hashana |
| pesach_sheni | TRUE | Pesach Sheni | NULL | "Pesach Sheni" | Second Passover |
| purim_katan | TRUE | Purim Katan | NULL | "Purim Katan" | Small Purim (Adar I) |
| shushan_purim | TRUE | Shushan Purim | NULL | "Shushan Purim" | Day after Purim |
| purim_meshulash | TRUE | Purim Meshulash | NULL | "Purim Meshulash" | Triple Purim |
| rosh_hashanah_ii | TRUE | Rosh Hashana II | NULL | "Rosh Hashana II" | Second day of RH |
| rosh_hashanah_labehemot | TRUE | Rosh Hashana LaBehemot | NULL | "Rosh Hashana LaBehemot" | Cattle tithe new year |
| asara_bteves | TRUE | Asara B'Tevet | NULL | "Asara B'Tevet" | 10th of Tevet fast |
| tzom_gedaliah | TRUE | Tzom Gedaliah | NULL | "Tzom Gedaliah" | Fast of Gedaliah |
| taanis_esther | TRUE | Ta'anit Esther | NULL | "Ta'anit Esther" | Fast of Esther |
| shiva_asar_btamuz | TRUE | Tzom Tammuz | NULL | "Tzom Tammuz" | 17th of Tammuz fast |
| tisha_bav | TRUE | Tish'a B'Av | NULL | "Tish'a B'Av" | 9th of Av fast |
| tisha_bav_observed | TRUE | Tish'a B'Av (observed) | NULL | "Tish'a B'Av (observed)" | Postponed Tisha B'Av |
| erev_tisha_bav | TRUE | Erev Tish'a B'Av | NULL | "Erev Tish'a B'Av" | Eve of Tisha B'Av |
| taanis_bechoros | TRUE | Ta'anit Bechorot | NULL | "Ta'anit Bechorot" | Fast of Firstborns |
| shmini_atzeres | TRUE | Shmini Atzeret | NULL | "Shmini Atzeret" | 8th day of assembly |
| simchas_torah | TRUE | Simchat Torah | NULL | "Simchat Torah" | Rejoicing with Torah |
| yom_haatzmaut | TRUE | Yom HaAtzma'ut | NULL | "Yom HaAtzma'ut" | Israel Independence Day |
| yom_hazikaron | TRUE | Yom HaZikaron | NULL | "Yom HaZikaron" | Memorial Day |
| yom_hashoah | TRUE | Yom HaShoah | NULL | "Yom HaShoah" | Holocaust Remembrance |
| yom_yerushalayim | TRUE | Yom Yerushalayim | NULL | "Yom Yerushalayim" | Jerusalem Day |
| yom_haaliyah | TRUE | Yom HaAliyah | NULL | "Yom HaAliyah" | Aliyah Day |
| sigd | TRUE | Sigd | NULL | "Sigd" | Ethiopian Jewish holiday |
| chag_habanot | TRUE | Chag HaBanot | NULL | "Chag HaBanot" | Daughters' Day |
| leil_selichos | TRUE | Leil Selichot | NULL | "Leil Selichot" | First night of Selichot |

---

### 2. Special Shabbatot (Individual EXACT Matches)

Each special Shabbat is a unique event with its own significance.

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | HebCal Event |
|---------|----------|---------------------|----------------------|--------------|
| shabbat_hagadol | TRUE | Shabbat HaGadol | NULL | "Shabbat HaGadol" |
| shabbat_chazon | TRUE | Shabbat Chazon | NULL | "Shabbat Chazon" |
| shabbat_nachamu | TRUE | Shabbat Nachamu | NULL | "Shabbat Nachamu" |
| shabbat_shuva | TRUE | Shabbat Shuva | NULL | "Shabbat Shuva" |
| shabbat_zachor | TRUE | Shabbat Zachor | NULL | "Shabbat Zachor" |
| shabbat_parah | TRUE | Shabbat Parah | NULL | "Shabbat Parah" |
| shabbat_hachodesh | TRUE | Shabbat HaChodesh | NULL | "Shabbat HaChodesh" |
| shabbat_shekalim | TRUE | Shabbat Shekalim | NULL | "Shabbat Shekalim" |
| shabbat_shirah | TRUE | Shabbat Shirah | NULL | "Shabbat Shirah" |

**Alternative**: Could use a single group tag with regex `^Shabbat (Chazon|HaChodesh|HaGadol|...)$`

---

### 3. NUMBERED Patterns (Chanukah)

8 different HebCal events map to a single tag using regex.

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | Matches These Events |
|---------|----------|---------------------|----------------------|---------------------|
| chanukah | FALSE | NULL | `^Chanukah: [1-8] Candles?$` | "Chanukah: 1 Candle"<br>"Chanukah: 2 Candles"<br>"Chanukah: 3 Candles"<br>"Chanukah: 4 Candles"<br>"Chanukah: 5 Candles"<br>"Chanukah: 6 Candles"<br>"Chanukah: 7 Candles"<br>"Chanukah: 8 Candles" |
| chanukah_8th_day | TRUE | Chanukah: 8th Day | NULL | "Chanukah: 8th Day" |

**Note**: "Chanukah: 8th Day" is a separate exact match with higher priority (special case combining 8th candle + 8th day)

**Regex Explanation**:
- `^` = Start of string
- `Chanukah: ` = Literal text
- `[1-8]` = Any digit 1 through 8
- ` Candles?` = Space + "Candle" or "Candles" (s is optional)
- `$` = End of string

---

### 4. YEARLY Patterns (Rosh Hashana)

11 year-specific events map to a single tag.

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | Matches These Events |
|---------|----------|---------------------|----------------------|---------------------|
| rosh_hashanah | FALSE | NULL | `^Rosh Hashana \d{4}$` | "Rosh Hashana 5781"<br>"Rosh Hashana 5782"<br>"Rosh Hashana 5783"<br>...<br>"Rosh Hashana 5791"<br>(and any future year) |
| rosh_hashanah_ii | TRUE | Rosh Hashana II | NULL | "Rosh Hashana II" |

**Regex Explanation**:
- `^Rosh Hashana ` = Literal prefix
- `\d{4}` = Exactly 4 digits (year)
- `$` = End of string

**Future-proof**: Pattern matches any 4-digit year (5792, 6000, etc.)

---

### 5. MONTHLY Patterns (Rosh Chodesh)

#### Option A: Individual EXACT Matches (Recommended)

| tag_key | is_exact | hebcal_event_pattern | HebCal Event |
|---------|----------|---------------------|--------------|
| rosh_chodesh_tevet | TRUE | Rosh Chodesh Tevet | "Rosh Chodesh Tevet" |
| rosh_chodesh_shvat | TRUE | Rosh Chodesh Sh'vat | "Rosh Chodesh Sh'vat" |
| rosh_chodesh_adar | TRUE | Rosh Chodesh Adar | "Rosh Chodesh Adar" |
| rosh_chodesh_adar_i | TRUE | Rosh Chodesh Adar I | "Rosh Chodesh Adar I" |
| rosh_chodesh_adar_ii | TRUE | Rosh Chodesh Adar II | "Rosh Chodesh Adar II" |
| rosh_chodesh_nisan | TRUE | Rosh Chodesh Nisan | "Rosh Chodesh Nisan" |
| rosh_chodesh_iyyar | TRUE | Rosh Chodesh Iyyar | "Rosh Chodesh Iyyar" |
| rosh_chodesh_sivan | TRUE | Rosh Chodesh Sivan | "Rosh Chodesh Sivan" |
| rosh_chodesh_tamuz | TRUE | Rosh Chodesh Tamuz | "Rosh Chodesh Tamuz" |
| rosh_chodesh_av | TRUE | Rosh Chodesh Av | "Rosh Chodesh Av" |
| rosh_chodesh_elul | TRUE | Rosh Chodesh Elul | "Rosh Chodesh Elul" |
| rosh_chodesh_cheshvan | TRUE | Rosh Chodesh Cheshvan | "Rosh Chodesh Cheshvan" |
| rosh_chodesh_kislev | TRUE | Rosh Chodesh Kislev | "Rosh Chodesh Kislev" |

**Total**: 13 individual mappings (allows month-specific zmanim)

#### Option B: Single Group Tag (Alternative)

| tag_key | is_exact | hebcal_pattern_regex | Matches All |
|---------|----------|---------------------|-------------|
| rosh_chodesh | FALSE | `^Rosh Chodesh [A-Z]` | All 13 months |

**Recommendation**: Use Option A for maximum flexibility.

---

### 6. Mevarchim Chodesh (Blessing the New Month)

Similar to Rosh Chodesh, but likely better as group tag.

| tag_key | is_exact | hebcal_pattern_regex | Matches These Events |
|---------|----------|---------------------|---------------------|
| mevarchim_chodesh | FALSE | `^Mevarchim Chodesh [A-Z]` | "Mevarchim Chodesh Tevet"<br>"Mevarchim Chodesh Adar"<br>"Mevarchim Chodesh Adar I"<br>"Mevarchim Chodesh Adar II"<br>...<br>(all 13 months) |

**Rationale**: Publishers unlikely to need per-month granularity for Mevarchim Chodesh.

---

### 7. PARASHAT (Weekly Torah Portions)

#### Recommended Strategy: Individual EXACT Matches

59 parashiyot + 7 combined = 66 individual mappings.

**Sample Individual Parshiyot**:

| tag_key | is_exact | hebcal_event_pattern | HebCal Event |
|---------|----------|---------------------|--------------|
| parashat_bereshit | TRUE | Parashat Bereshit | "Parashat Bereshit" |
| parashat_noach | TRUE | Parashat Noach | "Parashat Noach" |
| parashat_lech_lecha | TRUE | Parashat Lech-Lecha | "Parashat Lech-Lecha" |
| parashat_vayera | TRUE | Parashat Vayera | "Parashat Vayera" |
| parashat_chayei_sara | TRUE | Parashat Chayei Sara | "Parashat Chayei Sara" |
| ... | ... | ... | ... (52 more) |

**Combined Parshiyot** (7 special cases):

| tag_key | is_exact | hebcal_event_pattern | HebCal Event |
|---------|----------|---------------------|--------------|
| parashat_vayakhel_pekudei | TRUE | Parashat Vayakhel-Pekudei | "Parashat Vayakhel-Pekudei" |
| parashat_tazria_metzora | TRUE | Parashat Tazria-Metzora | "Parashat Tazria-Metzora" |
| parashat_achrei_mot_kedoshim | TRUE | Parashat Achrei Mot-Kedoshim | "Parashat Achrei Mot-Kedoshim" |
| parashat_behar_bechukotai | TRUE | Parashat Behar-Bechukotai | "Parashat Behar-Bechukotai" |
| parashat_chukat_balak | TRUE | Parashat Chukat-Balak | "Parashat Chukat-Balak" |
| parashat_matot_masei | TRUE | Parashat Matot-Masei | "Parashat Matot-Masei" |
| parashat_nitzavim_vayeilech | TRUE | Parashat Nitzavim-Vayeilech | "Parashat Nitzavim-Vayeilech" |

**Total**: 66 individual mappings

**Why Individual Tags?**:
- Publishers may want parsha-specific zmanim
- Different communities read different parshiyot (Israel vs Diaspora sync issues)
- Allows filtering like "Show special zmanim for Parashat Zachor only"

**Alternative Group Tag** (not recommended):

| tag_key | is_exact | hebcal_pattern_regex | Matches All |
|---------|----------|---------------------|-------------|
| parashat | FALSE | `^Parashat [A-Za-z''-]+$` | All 66 parshiyot |

---

### 8. MULTI-DAY Holidays

#### Pesach (8 Days)

**Strategy**: Hybrid approach - group tag + specific day tags.

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | Priority | Notes |
|---------|----------|---------------------|----------------------|----------|-------|
| pesach | FALSE | NULL | `^Pesach (I{1,3}\|IV\|V\|VI{1,2}\|VIII)( \(CH''M\))?$` | 100 | Matches ALL Pesach days |
| pesach_i | TRUE | Pesach I | NULL | 200 | First day (higher priority) |
| pesach_ii | TRUE | Pesach II | NULL | 200 | Second day |
| pesach_chol_hamoed | FALSE | NULL | `^Pesach (III\|IV\|V\|VI) \(CH''M\)$` | 150 | Intermediate days only |
| pesach_vii | TRUE | Pesach VII | NULL | 200 | 7th day (Israel last day) |
| pesach_viii | TRUE | Pesach VIII | NULL | 200 | 8th day (Diaspora only) |

**HebCal Events**:
- "Pesach I"
- "Pesach II"
- "Pesach III (CH''M)"
- "Pesach IV (CH''M)"
- "Pesach V (CH''M)"
- "Pesach VI (CH''M)"
- "Pesach VII"
- "Pesach VIII"

**Publisher Use Cases**:
- Show zman for "any Pesach day" → filter by `pesach` tag
- Show zman for "first day only" → filter by `pesach_i` tag
- Show zman for "Chol HaMoed only" → filter by `pesach_chol_hamoed` tag

#### Sukkot (7 Days + Shmini Atzeret)

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | Notes |
|---------|----------|---------------------|----------------------|-------|
| sukkos | FALSE | NULL | `^Sukkot (I{1,3}\|IV\|V\|VI{1,2}\|VII)( \(CH''M\)\| \(Hoshana Raba\))?$` | Group tag |
| sukkos_i | TRUE | Sukkot I | NULL | First day |
| sukkos_ii | TRUE | Sukkot II | NULL | Second day |
| hoshana_rabbah | TRUE | Sukkot VII (Hoshana Raba) | NULL | 7th day |
| shmini_atzeres | TRUE | Shmini Atzeret | NULL | 8th day (separate holiday) |
| simchas_torah | TRUE | Simchat Torah | NULL | 9th day (Diaspora) |

**HebCal Events**:
- "Sukkot I", "Sukkot II"
- "Sukkot III (CH''M)" through "Sukkot VI (CH''M)"
- "Sukkot VII (Hoshana Raba)"
- "Shmini Atzeret" (separate exact match)
- "Simchat Torah" (separate exact match)

#### Shavuot (2 Days)

| tag_key | is_exact | hebcal_event_pattern | hebcal_pattern_regex | Notes |
|---------|----------|---------------------|----------------------|-------|
| shavuos | FALSE | NULL | `^Shavuot (I\|II)$` | Group tag |
| shavuos_i | TRUE | Shavuot I | NULL | First day |
| shavuos_ii | TRUE | Shavuot II | NULL | Second day (Diaspora only) |

**HebCal Events**:
- "Shavuot I"
- "Shavuot II"

---

## Regex Pattern Testing

### PostgreSQL Test Queries

```sql
-- Test Chanukah pattern
SELECT
    event_name,
    event_name ~ '^Chanukah: [1-8] Candles?$' AS matches
FROM (VALUES
    ('Chanukah: 1 Candle'),
    ('Chanukah: 8 Candles'),
    ('Chanukah: 8th Day'),  -- Should NOT match
    ('Purim')  -- Should NOT match
) AS t(event_name);

-- Expected results:
-- Chanukah: 1 Candle   | true
-- Chanukah: 8 Candles  | true
-- Chanukah: 8th Day    | false
-- Purim                | false

-- Test Rosh Hashana year pattern
SELECT
    event_name,
    event_name ~ '^Rosh Hashana \d{4}$' AS matches
FROM (VALUES
    ('Rosh Hashana 5785'),
    ('Rosh Hashana 9999'),  -- Future year
    ('Rosh Hashana II'),    -- Should NOT match
    ('Rosh Hashana LaBehemot')  -- Should NOT match
) AS t(event_name);

-- Test Parashat pattern
SELECT
    event_name,
    event_name ~ '^Parashat [A-Za-z''-]+$' AS matches
FROM (VALUES
    ('Parashat Bereshit'),
    ('Parashat Vayakhel-Pekudei'),  -- Combined
    ('Rosh Chodesh Tevet')  -- Should NOT match
) AS t(event_name);

-- Test Pesach pattern
SELECT
    event_name,
    event_name ~ '^Pesach (I{1,3}|IV|V|VI{1,2}|VIII)( \(CH''''M\))?$' AS matches
FROM (VALUES
    ('Pesach I'),
    ('Pesach III (CH''M)'),
    ('Pesach VIII'),
    ('Pesach Sheni')  -- Should NOT match
) AS t(event_name);
```

---

## Migration Data Examples

### SQL INSERT Statements

```sql
-- Example: Add Chanukah regex mapping
INSERT INTO tag_event_mappings (
    tag_id,
    hebcal_pattern_regex,
    is_exact_hebcal_match,
    priority,
    yom_tov_level,
    is_multi_day,
    duration_days_israel,
    duration_days_diaspora
) VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'chanukah'),
    '^Chanukah: [1-8] Candles?$',
    false,  -- regex match
    100,    -- priority
    0,      -- yom_tov_level (not a Yom Tov)
    true,   -- is_multi_day
    8,      -- duration_days_israel
    8       -- duration_days_diaspora
);

-- Example: Add exact match for Purim
INSERT INTO tag_event_mappings (
    tag_id,
    hebcal_event_pattern,
    is_exact_hebcal_match,
    priority,
    yom_tov_level,
    is_multi_day,
    duration_days_israel,
    duration_days_diaspora
) VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'purim'),
    'Purim',
    true,   -- exact match
    100,    -- priority
    0,      -- yom_tov_level
    false,  -- is_multi_day
    1,      -- duration_days_israel
    1       -- duration_days_diaspora
);

-- Example: Add all 59 individual parshiyot (loop in application or script)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_exact_hebcal_match, priority)
SELECT
    (SELECT id FROM zman_tags WHERE tag_key = 'parashat_bereshit'),
    'Parashat Bereshit',
    true,
    100
UNION ALL
SELECT
    (SELECT id FROM zman_tags WHERE tag_key = 'parashat_noach'),
    'Parashat Noach',
    true,
    100
-- ... repeat for all 59 parshiyot
;
```

---

## Performance Optimization

### In-Memory Caching Strategy

```go
type HebcalMatchCache struct {
    // Fast O(1) lookup for exact matches
    exactMap map[string]*EventMatch

    // Ordered regex patterns (try in priority order)
    regexPatterns []*RegexPattern

    mu sync.RWMutex
}

type EventMatch struct {
    TagKey            string
    DisplayNameHebrew string
    DisplayNameEnglish string
    Priority          int
    YomTovLevel       int
    IsMultiDay        bool
    DurationDaysIsrael int
    DurationDaysDiaspora int
}

type RegexPattern struct {
    Regex    *regexp.Regexp
    Match    *EventMatch
    Priority int
}

func (c *HebcalMatchCache) Load(ctx context.Context, db *DB) error {
    // Load exact matches into map
    exactMappings, err := db.GetAllExactHebcalMappings(ctx)
    if err != nil {
        return err
    }

    exactMap := make(map[string]*EventMatch, len(exactMappings))
    for _, m := range exactMappings {
        exactMap[m.HebcalEventPattern] = &EventMatch{
            TagKey:            m.TagKey,
            DisplayNameHebrew: m.DisplayNameHebrew,
            DisplayNameEnglish: m.DisplayNameEnglishAshkenazi,
            Priority:          int(m.Priority),
            // ... other fields
        }
    }

    // Load regex patterns into ordered list
    regexMappings, err := db.GetAllRegexHebcalMappings(ctx)
    if err != nil {
        return err
    }

    regexPatterns := make([]*RegexPattern, 0, len(regexMappings))
    for _, m := range regexMappings {
        regex, err := regexp.Compile(m.HebcalPatternRegex)
        if err != nil {
            return fmt.Errorf("invalid regex '%s': %w", m.HebcalPatternRegex, err)
        }

        regexPatterns = append(regexPatterns, &RegexPattern{
            Regex: regex,
            Match: &EventMatch{
                TagKey:            m.TagKey,
                DisplayNameHebrew: m.DisplayNameHebrew,
                DisplayNameEnglish: m.DisplayNameEnglishAshkenazi,
                Priority:          int(m.Priority),
            },
            Priority: int(m.Priority),
        })
    }

    // Sort by priority DESC
    sort.Slice(regexPatterns, func(i, j int) bool {
        return regexPatterns[i].Priority > regexPatterns[j].Priority
    })

    c.mu.Lock()
    c.exactMap = exactMap
    c.regexPatterns = regexPatterns
    c.mu.Unlock()

    return nil
}

func (c *HebcalMatchCache) Match(hebcalEventName string) *EventMatch {
    c.mu.RLock()
    defer c.mu.RUnlock()

    // Step 1: Try exact match (O(1))
    if match, ok := c.exactMap[hebcalEventName]; ok {
        return match
    }

    // Step 2: Try regex patterns (O(n) where n ~= 5-10)
    for _, pattern := range c.regexPatterns {
        if pattern.Regex.MatchString(hebcalEventName) {
            return pattern.Match
        }
    }

    return nil
}
```

### Benchmarking

Expected performance:
- **Exact match**: ~10-50 nanoseconds (map lookup)
- **Regex fallback**: ~1-10 microseconds (5-10 regex checks)
- **Cache miss**: Query database (~1-5 milliseconds)

---

## Summary

This document provides comprehensive mapping examples covering all 170 HebCal events. Key decisions:

1. **~140 EXACT matches**: Major holidays, special Shabbatot, individual parshiyot
2. **~20 REGEX patterns**: Chanukah (8), Rosh Hashana years (11), monthly patterns
3. **Hybrid approach**: Multi-day holidays have both group tags and specific day tags
4. **Performance**: In-memory caching with O(1) exact + O(10) regex fallback

**Next Steps**:
1. Review examples with stakeholders
2. Implement SQLc queries (see SQLC-QUERIES-hebcal-matching.sql)
3. Generate complete INSERT statements for all 170 events
4. Deploy migration and test against real HebCal API
