# Master Zmanim Tagging Patterns Reference

**Purpose:** Quick reference guide for tagging future master zmanim entries
**Last Updated:** 2025-12-25 (after restoration of 54 untagged entries)

---

## Tagging Decision Tree

### 1. Identify Zman Type (from zman_key prefix)

| Prefix | Type | Common Tags |
|--------|------|-------------|
| `alos_*` | Dawn | shita_gra (basic), shita_mga (zmanis/120) |
| `misheyakir_*` | Earliest Tallis/Tefillin | shita_gra |
| `sunrise_*` | Sunrise | shita_gra (basic), shita_baal_hatanya |
| `sof_zman_shma_*` | Latest Shema | category_shema + shita |
| `sof_zman_tfila_*` | Latest Prayer | category_tefila + shita |
| `chatzos*` | Midday/Midnight | shita_gra (basic) |
| `mincha_*` | Mincha Times | category_mincha + shita |
| `plag_*` | Plag HaMincha | category_mincha + shita |
| `shkia*` / `sunset*` | Sunset | shita_gra |
| `bein_hashmashos_*` | Twilight | shita_rt, shita_yereim, or shita_gra |
| `tzais_*` | Nightfall | Varies by value (see below) |
| `candle_lighting*` | Candle Lighting | category_candle_lighting + day_before |
| `havdalah*` / `shabbos_ends*` | Havdalah | category_havdalah + shita |
| `fast_*` | Fast Times | category_fast_start or category_fast_end |
| `sof_zman_achilas_chametz*` | Chametz Eating | category_chametz + shita |
| `sof_zman_biur_chametz*` | Chametz Burning | category_chametz + shita |
| `kiddush_levana*` | Kiddush Levana | category_kiddush_levana |

---

## Shita Attribution Patterns

### Based on Calculation Method

#### GRA (Vilna Gaon) - `shita_gra`
**Use when:**
- Basic/default zman without specific attribution
- Simple degree values: 12°, 18°, 19°, 19.8°, 26°
- Simple minute values: 60, 90, 96 minutes (when NOT zmanis)
- Visual markers: misheyakir, 3 stars
- Standard astronomical calculations

**Examples:**
```
alos_12, alos_18, alos_hashachar
misheyakir, misheyakir_10_2
tzais, tzais_3_stars
chatzos, chatzos_layla
visible_sunrise, visible_sunset
```

#### MGA (Magen Avraham) - `shita_mga`
**Use when:**
- 16.1 degree calculations (signature MGA value)
- 72 minutes or 120 minutes
- Anything with "zmanis" suffix (proportional hours)
- Calculations based on alos_72 or alos_16_1

**Examples:**
```
alos_16_1, alos_72, alos_120
alos_90_zmanis, alos_120_zmanis
sof_zman_shma_mga, sof_zman_shma_mga_16_1
tzais_16_1, tzais_72_zmanis
shaah_zmanis_mga
```

#### Geonim - `shita_geonim`
**Use when:**
- Fine-degree tzais calculations
- Degrees: 3.65°, 3.676°, 3.7°, 3.8°, 4.37°, 4.61°, 4.8°, 5.88°, 5.95°, 6°, 6.45°, 7.08°, 7.083°, 7.67°, 8.5°, 9.3°, 9.75°
- Historical Geonim calculation methods

**Examples:**
```
tzais_3_65, tzais_4_37, tzais_6, tzais_7_08
tzais_8_5, tzais_9_3
```

#### Rabbeinu Tam - `shita_rt`
**Use when:**
- Minute-based tzais: 20, 42, 50, 60, 72 min (when NOT zmanis)
- Post-sunset calculations
- Bein hashmashos RT variations

**Examples:**
```
tzais_20, tzais_42, tzais_50, tzais_72
bein_hashmashos_rt_13_24
bein_hashmashos_rt_2_stars
shabbos_ends_72
```

#### Baal HaTanya - `shita_baal_hatanya`
**Use when:**
- Explicitly named as Baal HaTanya
- Sunrise variations
- Mincha/tefila/shema variations specific to Chabad

**Examples:**
```
sunrise_baal_hatanya
alos_baal_hatanya
sof_zman_shma_baal_hatanya
mincha_gedola_baal_hatanya
```

#### Ateret Torah - `shita_ateret_torah`
**Use when:**
- Explicitly named as Ateret Torah
- Special calculations for specific times

**Examples:**
```
sof_zman_shma_ateret_torah
mincha_gedola_ateret_torah
tzais_ateret_torah
```

#### Yereim - `shita_yereim`
**Use when:**
- Bein hashmashos Yereim variations
- Specific degree values: 2.1°, 2.8°, 3.05°, 13.5°, 16.875°, 18°

**Examples:**
```
bein_hashmashos_yereim_2_1
bein_hashmashos_yereim_13_5
bein_hashmashos_yereim_18
```

#### Fixed Local Chatzos - `shita_fixed_local_chatzos`
**Use when:**
- Geographic/fixed midday (not solar)

**Examples:**
```
fixed_local_chatzos
```

---

## Category Tag Patterns

### Always Add Category Tags For:

| Zman Type | Category Tag | Additional Notes |
|-----------|--------------|------------------|
| Shema times | `category_shema` | sof_zman_shma_* |
| Prayer times | `category_tefila` | sof_zman_tfila_* |
| Mincha times | `category_mincha` | mincha_*, plag_* |
| Candle lighting | `category_candle_lighting` | Also add `day_before` timing tag |
| Havdalah | `category_havdalah` | havdalah*, shabbos_ends* |
| Fast start | `category_fast_start` | fast_begins* (non-Tisha B'Av) |
| Fast end | `category_fast_end` | fast_ends* (non-Tisha B'Av) |
| Tisha B'Av fast start | `category_tisha_bav_fast_start` | fast_begins_sunset |
| Tisha B'Av fast end | `category_tisha_bav_fast_end` | fast_ends* |
| Chametz times | `category_chametz` | sof_zman_achilas/biur_chametz* |
| Kiddush Levana | `category_kiddush_levana` | kiddush_levana* |

---

## Event Tag Patterns

### Event-Specific Zmanim

When a zman is specific to an event (contains event name in zman_key):

**Pattern:** `{event_name}_{suffix}`

**Action:** Add both the event tag AND appropriate shita tag

**Examples:**
```sql
-- alos_shemini_atzeres
Tags: shmini_atzeres + shita_gra

-- candle_lighting_chanukah (if it existed)
Tags: chanukah + category_candle_lighting + day_before
```

**Available Event Tags:**
```
asara_btevet, chanukah, erev_pesach, erev_purim, erev_rosh_hashana,
erev_shavuos, erev_sukkos, erev_tisha_bav, erev_yom_kippur,
lag_baomer, pesach, purim, rosh_hashana, shavuos, shmini_atzeres,
simchas_torah, sukkos, taanit_bechorot, taanit_esther, tisha_bav,
yom_kippur, etc.
```

---

## Timing Tag Patterns

| Timing Tag | Use When | Examples |
|------------|----------|----------|
| `day_before` | Zman occurs day before event | candle_lighting*, fast_begins_sunset |
| `day_of` | Zman occurs on event day | Most regular zmanim |
| `day_after` | Zman occurs after event | (Rare, document if used) |

---

## Multi-Tag Strategy

### Most zmanim should have 1-2 tags:
1. **Shita tag** (required for calculation method)
2. **Category tag** (if zman has functional purpose)
3. **Event tag** (if event-specific)
4. **Timing tag** (if needed for event context)

### Examples:

```sql
-- Basic zman (shita only)
tzais → {shita_gra}

-- Functional zman (shita + category)
sof_zman_shma_gra → {shita_gra, category_shema}

-- Category-focused (category + shita)
havdalah → {category_havdalah, shita_gra}

-- Event-specific (event + shita)
alos_shemini_atzeres → {shmini_atzeres, shita_gra}

-- Full context (category + timing)
candle_lighting_18 → {category_candle_lighting, day_before}

-- Complex (category + shita + event)
fast_begins_sunset → {category_tisha_bav_fast_start, day_before}
```

---

## SQL Template for Adding New Tags

```sql
-- Template for adding tags to a new master zman
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'NEW_ZMAN_KEY'
  AND zt.tag_key IN ('tag1', 'tag2', 'tag3')  -- List all relevant tags
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );
```

---

## Validation Checklist

Before committing new master zman tags:

- [ ] Shita tag assigned based on calculation method
- [ ] Category tag added if zman has functional purpose
- [ ] Event tag added if zman is event-specific
- [ ] Timing tag added if needed for event context
- [ ] No duplicate tag associations
- [ ] Tags match existing patterns for similar zmanim
- [ ] Tags are consistent with halachic source

---

## Common Mistakes to Avoid

1. **Don't tag basic zmanim with MGA if they're not zmanis or 16.1/72/120**
   - ❌ `alos_90 → shita_mga` (should be shita_gra)
   - ✅ `alos_90_zmanis → shita_mga`

2. **Don't forget category tags for functional zmanim**
   - ❌ `sof_zman_shma_gra → {shita_gra}` (missing category)
   - ✅ `sof_zman_shma_gra → {shita_gra, category_shema}`

3. **Don't mix up RT and Geonim for tzais**
   - ❌ `tzais_42 → shita_geonim` (should be shita_rt)
   - ✅ `tzais_4_37 → shita_geonim`

4. **Don't use shita_gra for everything**
   - ❌ `tzais_16_1 → shita_gra` (should be shita_mga)
   - ✅ `tzais_16_1 → shita_mga`

---

## Reference Queries

### Find zmanim without tags
```sql
SELECT id, zman_key, canonical_english_name
FROM master_zmanim_registry
WHERE id NOT IN (
    SELECT DISTINCT master_zman_id
    FROM master_zman_tags
    WHERE master_zman_id IS NOT NULL
);
```

### View existing tag patterns for similar zmanim
```sql
SELECT mr.zman_key, ARRAY_AGG(zt.tag_key ORDER BY zt.tag_key) as tags
FROM master_zmanim_registry mr
JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id
JOIN zman_tags zt ON mzt.tag_id = zt.id
WHERE mr.zman_key LIKE 'pattern%'  -- e.g., 'alos_%', 'tzais_%'
GROUP BY mr.id, mr.zman_key
ORDER BY mr.zman_key;
```

### List available tags by type
```sql
SELECT zt.tag_key, zt.display_name_english_ashkenazi, tt.key as tag_type
FROM zman_tags zt
JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE tt.key IN ('shita', 'category', 'event', 'timing')
ORDER BY tt.key, zt.tag_key;
```

---

## Future Considerations

### When to Create New Shita Tags

Create a new shita tag when:
1. A recognized halachic authority has a unique calculation method
2. The calculation differs substantially from existing shitos
3. Multiple zmanim will use this shita

**Example:** If adding Chazon Ish-specific times:
```sql
-- First create the tag
INSERT INTO zman_tags (tag_key, display_name_english_ashkenazi, tag_type_id)
SELECT 'shita_chazon_ish', 'Chazon Ish', id
FROM tag_types WHERE key = 'shita';

-- Then apply to relevant zmanim
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key LIKE '%chazon_ish%'
  AND zt.tag_key = 'shita_chazon_ish';
```

---

## Appendix: Complete Shita → Degree/Minute Mapping

| Shita | Typical Degrees | Typical Minutes | Zmanis |
|-------|----------------|-----------------|--------|
| GRA | 12°, 18°, 19°, 19.8°, 26° | 60, 90, 96 | No |
| MGA | 16.1° | 72, 120 | Yes |
| Geonim | 3.65°-9.75° (fractional) | - | No |
| RT | - | 20, 42, 50, 60, 72 | No |
| Baal HaTanya | Varies | Varies | Sometimes |
| Ateret Torah | Varies | Varies | Yes |
| Yereim | 2.1°, 2.8°, 3.05°, 13.5°, 16.875°, 18° | - | No |

---

**Document Version:** 1.0
**Last Restoration:** 2025-12-25 (54 zmanim, 59 tag associations)
**Status:** All 172 master zmanim are tagged (100% coverage)
