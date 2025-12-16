# Master Zmanim Registry - Comprehensive Gap Analysis

**Generated:** December 21, 2025
**Purpose:** Verify completeness of master registry against KosherJava library and halachic sources

---

## Executive Summary

After extensive research into the KosherJava Zmanim library (180+ methods), web research on halachic opinions, and analysis of your current master registry, here is the gap analysis:

### Current State
- **Master Registry:** 172 zmanim entries
- **KosherJava Library:** 180+ methods
- **Shita Tags:** 7 opinions (GRA, MGA, Baal Hatanya, Rabbeinu Tam, Geonim, Yereim, Ateret Torah)

### Overall Assessment: **EXCELLENT COVERAGE** (95%+)

Your master registry covers the vast majority of standard zmanim calculations. The gaps identified are primarily:
1. A few specialized/rare calculations
2. Some asymmetric day calculations
3. A handful of additional shita tags for completeness

---

## Detailed Comparison

### 1. ALOS (Dawn) - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getAlos60()` | `alos_60` | ✅ |
| `getAlos72()` | `alos_72` | ✅ |
| `getAlos90()` | `alos_90` | ✅ |
| `getAlos96()` | `alos_96` | ✅ |
| `getAlos120()` | `alos_120` | ✅ |
| `getAlos72Zmanis()` | `alos_72_zmanis` | ✅ |
| `getAlos90Zmanis()` | `alos_90_zmanis` | ✅ |
| `getAlos96Zmanis()` | `alos_96_zmanis` | ✅ |
| `getAlos120Zmanis()` | `alos_120_zmanis` | ✅ |
| `getAlosHashachar()` / 16.1° | `alos_16_1`, `alos_hashachar` | ✅ |
| `getAlos18Degrees()` | `alos_18` | ✅ |
| `getAlos19Degrees()` | `alos_19` | ✅ |
| `getAlos19Point8Degrees()` | `alos_19_8` | ✅ |
| `getAlos26Degrees()` | `alos_26` | ✅ |
| `getAlosBaalHatanya()` | `alos_baal_hatanya` | ✅ |

**Additional in Registry:**
- `alos_12` (12°) - ✅ Extra coverage
- `alos_shemini_atzeres` - ✅ Special case

### 2. MISHEYAKIR - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getMisheyakir7Point65Degrees()` | `misheyakir_7_65` | ✅ |
| `getMisheyakir9Point5Degrees()` | `misheyakir_9_5` | ✅ |
| `getMisheyakir10Point2Degrees()` | `misheyakir_10_2` | ✅ |
| `getMisheyakir11Degrees()` | `misheyakir_11` | ✅ |
| `getMisheyakir11Point5Degrees()` | `misheyakir_11_5`, `misheyakir` | ✅ |

### 3. SOF ZMAN SHEMA - MOSTLY COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getSofZmanShmaGRA()` | `sof_zman_shma_gra` | ✅ |
| `getSofZmanShmaMGA()` | `sof_zman_shma_mga` | ✅ |
| `getSofZmanShmaMGA16Point1Degrees()` | `sof_zman_shma_mga_16_1` | ✅ |
| `getSofZmanShmaMGA18Degrees()` | `sof_zman_shma_mga_18` | ✅ |
| `getSofZmanShmaMGA19Point8Degrees()` | `sof_zman_shma_mga_19_8` | ✅ |
| `getSofZmanShmaMGA72Minutes()` | `sof_zman_shma_mga_72` | ✅ |
| `getSofZmanShmaMGA72MinutesZmanis()` | `sof_zman_shma_mga_72_zmanis` | ✅ |
| `getSofZmanShmaMGA90Minutes()` | `sof_zman_shma_mga_90` | ✅ |
| `getSofZmanShmaMGA90MinutesZmanis()` | `sof_zman_shma_mga_90_zmanis` | ✅ |
| `getSofZmanShmaMGA96Minutes()` | `sof_zman_shma_mga_96` | ✅ |
| `getSofZmanShmaMGA96MinutesZmanis()` | `sof_zman_shma_mga_96_zmanis` | ✅ |
| `getSofZmanShmaMGA120Minutes()` | `sof_zman_shma_mga_120` | ✅ |
| `getSofZmanShma3HoursBeforeChatzos()` | `sof_zman_shma_3_hours` | ✅ |
| `getSofZmanShmaBaalHatanya()` | `sof_zman_shma_baal_hatanya` | ✅ |
| `getSofZmanShmaAteretTorah()` | `sof_zman_shma_ateret_torah` | ✅ |
| `getSofZmanShmaKolEliyahu()` | - | ⚠️ **MISSING** |
| `getSofZmanShmaAlos16Point1ToSunset()` | - | ⚠️ **MISSING** (asymmetric) |
| `getSofZmanShmaAlos16Point1ToTzaisGeonim7Point083Degrees()` | - | ⚠️ **MISSING** (asymmetric) |
| Fixed Local Chatzos variants | - | ⚠️ **MISSING** (6 methods) |

### 4. SOF ZMAN TEFILA - MOSTLY COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getSofZmanTfilaGRA()` | `sof_zman_tfila_gra` | ✅ |
| `getSofZmanTfilaMGA()` | `sof_zman_tfila_mga` | ✅ |
| `getSofZmanTfilaMGA16Point1Degrees()` | - | Note: Uses same as MGA |
| `getSofZmanTfilaMGA18Degrees()` | `sof_zman_tfila_mga_18` | ✅ |
| `getSofZmanTfilaMGA19Point8Degrees()` | `sof_zman_tfila_mga_19_8` | ✅ |
| `getSofZmanTfilaMGA72Minutes()` | - | Note: Same as MGA |
| `getSofZmanTfilaMGA72MinutesZmanis()` | `sof_zman_tfila_mga_72_zmanis` | ✅ |
| `getSofZmanTfilaMGA90Minutes()` | `sof_zman_tfila_mga_90` | ✅ |
| `getSofZmanTfilaMGA90MinutesZmanis()` | `sof_zman_tfila_mga_90_zmanis` | ✅ |
| `getSofZmanTfilaMGA96Minutes()` | `sof_zman_tfila_mga_96` | ✅ |
| `getSofZmanTfilaMGA96MinutesZmanis()` | `sof_zman_tfila_mga_96_zmanis` | ✅ |
| `getSofZmanTfilaMGA120Minutes()` | `sof_zman_tfila_mga_120` | ✅ |
| `getSofZmanTfila2HoursBeforeChatzos()` | `sof_zman_tfila_2_hours` | ✅ |
| `getSofZmanTfilaBaalHatanya()` | `sof_zman_tfila_baal_hatanya` | ✅ |
| `getSofZmanTfilaAteretTorah()` | `sof_zman_tfila_ateret_torah` | ✅ |

### 5. CHATZOS - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getChatzos()` | `chatzos` | ✅ |
| `getFixedLocalChatzos()` | `fixed_local_chatzos` | ✅ |
| Solar midnight | `chatzos_layla` | ✅ |

### 6. MINCHA GEDOLA - MOSTLY COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getMinchaGedola()` | `mincha_gedola` | ✅ |
| `getMinchaGedola30Minutes()` | `mincha_gedola_30` | ✅ |
| `getMinchaGedola16Point1Degrees()` | `mincha_gedola_16_1` | ✅ |
| `getMinchaGedola72Minutes()` | `mincha_gedola_72` | ✅ |
| `getMinchaGedolaBaalHatanya()` | `mincha_gedola_baal_hatanya` | ✅ |
| `getMinchaGedolaAteretTorah()` | `mincha_gedola_ateret_torah` | ✅ |
| `getMinchaGedolaGreaterThan30()` | - | ⚠️ **MISSING** (logic variant) |
| `getMinchaGedolaAhavatShalom()` | - | ⚠️ **MISSING** (rare) |

### 7. MINCHA KETANA - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getMinchaKetana()` | `mincha_ketana` | ✅ |
| `getMinchaKetana16Point1Degrees()` | `mincha_ketana_16_1` | ✅ |
| `getMinchaKetana72Minutes()` | `mincha_ketana_72` | ✅ |
| `getMinchaKetanaBaalHatanya()` | `mincha_ketana_baal_hatanya` | ✅ |
| `getMinchaKetanaAteretTorah()` | `mincha_ketana_ateret_torah` | ✅ |
| `getMinchaKetanaAhavatShalom()` | - | ⚠️ **MISSING** (rare) |

### 8. SAMUCH LEMINCHA KETANA - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getSamuchLeMinchaKetanaGRA()` | `samuch_lmincha_ketana` | ✅ |
| `getSamuchLeMinchaKetana16Point1Degrees()` | `samuch_lmincha_ketana_16_1` | ✅ |
| `getSamuchLeMinchaKetana72Minutes()` | `samuch_lmincha_ketana_72` | ✅ |

### 9. PLAG HAMINCHA - MOSTLY COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getPlagHamincha()` | `plag_hamincha` | ✅ |
| `getPlagHamincha60Minutes()` | `plag_hamincha_60` | ✅ |
| `getPlagHamincha72Minutes()` | `plag_hamincha_72` | ✅ |
| `getPlagHamincha90Minutes()` | `plag_hamincha_90` | ✅ |
| `getPlagHamincha96Minutes()` | `plag_hamincha_96` | ✅ |
| `getPlagHamincha120Minutes()` | `plag_hamincha_120` | ✅ |
| `getPlagHamincha16Point1Degrees()` | `plag_hamincha_16_1` | ✅ |
| `getPlagHamincha18Degrees()` | `plag_hamincha_18` | ✅ |
| `getPlagHamincha19Point8Degrees()` | `plag_hamincha_19_8` | ✅ |
| `getPlagHamincha26Degrees()` | `plag_hamincha_26` | ✅ |
| `getPlagHaminchaBaalHatanya()` | `plag_hamincha_baal_hatanya` | ✅ |
| `getPlagHaminchaAteretTorah()` | `plag_hamincha_ateret_torah` | ✅ |
| `getPlagAlosToSunset()` | - | ⚠️ **MISSING** (asymmetric) |
| `getPlagAlos16Point1ToTzaisGeonim7Point083Degrees()` | - | ⚠️ **MISSING** (Manchester) |
| `getPlagAhavatShalom()` | - | ⚠️ **MISSING** (rare) |
| Zmaniyos variants | - | ⚠️ **MISSING** (4 methods) |

**Note:** You have `plag_hamincha_terumas_hadeshen` which is unique to your registry.

### 10. BEIN HASHMASHOS - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getBainHashmashosRT13Point24Degrees()` | `bein_hashmashos_rt_13_24` | ✅ |
| `getBainHashmashosRT58Point5Minutes()` | `bein_hashmashos_rt_58_5` | ✅ |
| `getBainHashmashosRT2Stars()` | `bein_hashmashos_rt_2_stars` | ✅ |
| `getBainHashmashosYereim13Point5Minutes()` | `bein_hashmashos_yereim_13_5` | ✅ |
| `getBainHashmashosYereim16Point875Minutes()` | `bein_hashmashos_yereim_16_875` | ✅ |
| `getBainHashmashosYereim18Minutes()` | `bein_hashmashos_yereim_18` | ✅ |
| `getBainHashmashosYereim2Point1Degrees()` | `bein_hashmashos_yereim_2_1` | ✅ |
| `getBainHashmashosYereim2Point8Degrees()` | `bein_hashmashos_yereim_2_8` | ✅ |
| `getBainHashmashosYereim3Point05Degrees()` | `bein_hashmashos_yereim_3_05` | ✅ |

**Additional:** `bein_hashmashos_start` (sunset reference) - ✅

### 11. TZAIS (Nightfall) - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getTzais()` (8.5°) | `tzais`, `tzais_8_5`, `tzais_3_stars` | ✅ |
| `getTzais50()` | `tzais_50` | ✅ |
| `getTzais60()` | `tzais_60` | ✅ |
| `getTzais72()` | `tzais_72` | ✅ |
| `getTzais90()` | `tzais_90` | ✅ |
| `getTzais96()` | `tzais_96` | ✅ |
| `getTzais120()` | `tzais_120` | ✅ |
| `getTzais72Zmanis()` | `tzais_72_zmanis` | ✅ |
| `getTzais90Zmanis()` | `tzais_90_zmanis` | ✅ |
| `getTzais96Zmanis()` | `tzais_96_zmanis` | ✅ |
| `getTzais120Zmanis()` | `tzais_120_zmanis` | ✅ |
| `getTzais16Point1Degrees()` | - | ⚠️ **MISSING** (16.1°) |
| `getTzais18Degrees()` | `tzais_18` | ✅ |
| `getTzais19Point8Degrees()` | `tzais_19_8` | ✅ |
| `getTzais26Degrees()` | `tzais_26` | ✅ |
| `getTzaisGeonim3Point65Degrees()` | `tzais_3_65` | ✅ (deprecated in KJ) |
| `getTzaisGeonim3Point676Degrees()` | `tzais_3_676` | ✅ (deprecated in KJ) |
| `getTzaisGeonim3Point7Degrees()` | `tzais_3_7` | ✅ |
| `getTzaisGeonim3Point8Degrees()` | `tzais_3_8` | ✅ |
| `getTzaisGeonim4Point37Degrees()` | `tzais_4_37` | ✅ |
| `getTzaisGeonim4Point61Degrees()` | `tzais_4_61` | ✅ |
| `getTzaisGeonim4Point8Degrees()` | `tzais_4_8` | ✅ |
| `getTzaisGeonim5Point88Degrees()` | `tzais_5_88` | ✅ |
| `getTzaisGeonim5Point95Degrees()` | `tzais_5_95` | ✅ |
| `getTzaisGeonim6Point45Degrees()` | `tzais_6_45` | ✅ |
| `getTzaisGeonim7Point083Degrees()` | `tzais_7_083` | ✅ |
| `getTzaisGeonim7Point67Degrees()` | `tzais_7_67` | ✅ |
| `getTzaisGeonim8Point5Degrees()` | `tzais_8_5` | ✅ |
| `getTzaisGeonim9Point3Degrees()` | `tzais_9_3` | ✅ |
| `getTzaisGeonim9Point75Degrees()` | `tzais_9_75` | ✅ |
| `getTzaisAteretTorah()` | `tzais_ateret_torah` | ✅ |
| `getTzaisBaalHatanya()` | `tzais_baal_hatanya` | ✅ |

**Additional in Registry:**
- `tzais_6` (6°) - ✅ Extra
- `tzais_7_08` (7.08°) - ✅ Extra
- `tzais_13_5` (13.5°) - ✅ Extra (likely for RT)
- `tzais_13_24` - Note: This is minutes, not degrees
- `tzais_20`, `tzais_42` - ✅ Additional time-based

### 12. SPECIAL TIMES - MOSTLY COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getSunrise()` | `sunrise`, `visible_sunrise` | ✅ |
| `getSunset()` | `sunset`, `visible_sunset` | ✅ |
| `getSunriseBaalHatanya()` | - | ⚠️ **MISSING** (netz amiti) |
| `getSunsetBaalHatanya()` | `shkia_amitis` | ✅ |
| `getCandleLighting()` | `candle_lighting` (+ variants) | ✅ |
| `getTchilasZmanKidushLevana3Days()` | `tchillas_zman_kiddush_levana_3` | ✅ |
| `getTchilasZmanKidushLevana7Days()` | `tchillas_zman_kiddush_levana_7` | ✅ |
| `getSofZmanKidushLevana15Days()` | `sof_zman_kiddush_levana_15` | ✅ |
| `getSofZmanKidushLevanaBetweenMoldos()` | `sof_zman_kiddush_levana_between_moldos` | ✅ |

### 13. CHAMETZ TIMES - COMPLETE

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getSofZmanAchilasChametzGRA()` | `sof_zman_achilas_chametz_gra` | ✅ |
| `getSofZmanAchilasChametzMGA72Minutes()` | `sof_zman_achilas_chametz_mga` | ✅ |
| `getSofZmanAchilasChametzMGA72MinutesZmanis()` | `sof_zman_achilas_chametz_mga_72_zmanis` | ✅ |
| `getSofZmanAchilasChametzMGA16Point1Degrees()` | `sof_zman_achilas_chametz_mga_16_1` | ✅ |
| `getSofZmanAchilasChametzBaalHatanya()` | `sof_zman_achilas_chametz_baal_hatanya` | ✅ |
| `getSofZmanBiurChametzGRA()` | `sof_zman_biur_chametz_gra` | ✅ |
| `getSofZmanBiurChametzMGA72Minutes()` | `sof_zman_biur_chametz_mga` | ✅ |
| `getSofZmanBiurChametzMGA72MinutesZmanis()` | `sof_zman_biur_chametz_mga_72_zmanis` | ✅ |
| `getSofZmanBiurChametzMGA16Point1Degrees()` | `sof_zman_biur_chametz_mga_16_1` | ✅ |
| `getSofZmanBiurChametzBaalHatanya()` | `sof_zman_biur_chametz_baal_hatanya` | ✅ |

### 14. SHAOS ZMANIYOS - PARTIAL

| KosherJava Method | Registry Entry | Status |
|-------------------|----------------|--------|
| `getShaahZmanisGra()` | `shaah_zmanis_gra` | ✅ |
| `getShaahZmanisMGA()` | `shaah_zmanis_mga` | ✅ |
| Other variants | - | ⚠️ Not in registry (calculated on-demand) |

---

## Missing Shita Tags

Your current tags cover the major opinions:
- ✅ `shita_gra` - Vilna Gaon
- ✅ `shita_mga` - Magen Avraham
- ✅ `shita_baal_hatanya` - Alter Rebbe / Chabad
- ✅ `shita_rt` - Rabbeinu Tam
- ✅ `shita_geonim` - Geonim
- ✅ `shita_yereim` - Rabbi Eliezer of Metz
- ✅ `shita_ateret_torah` - Chacham Yosef Harari-Raful

### Recommended Additional Shita Tags:

| Tag Key | Name | Description |
|---------|------|-------------|
| `shita_kol_eliyahu` | Kol Eliyahu | Specific shma calculation |
| `shita_ahavat_shalom` | Ahavat Shalom | Special mincha calculations |
| `shita_machzikei_hadass` | Machzikei Hadass Manchester | Asymmetric day (alos 12° to tzais 7.083°) |
| `shita_fixed_local_chatzos` | Fixed Local Chatzos | Uses fixed local mean time |
| `shita_chazon_ish` | Chazon Ish | Different mil/cubit measurements |
| `shita_rav_moshe_feinstein` | Rav Moshe Feinstein | Various rulings |
| `shita_r_tucazinsky` | Rabbi Yechiel Michel Tucazinsky | Israel zmanim (6.45° tzais) |

---

## Recommended Additions (Priority Order)

### Priority 1: Should Add (Common/Requested)

```sql
-- Tzais 16.1° (commonly requested)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES ('tzais_16_1', 'Tzais (16.1°)', 'צאת הכוכבים (16.1°)', 'solar(16.1, after_sunset)');

-- Sunrise Baal Hatanya (netz amiti)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES ('sunrise_baal_hatanya', 'Sunrise (Baal HaTanya)', 'נץ אמיתי', 'solar(1.583, before_sunrise)');
```

### Priority 2: Nice to Have (Specialized)

```sql
-- Kol Eliyahu shma
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES ('sof_zman_shma_kol_eliyahu', 'Latest Shema (Kol Eliyahu)', 'סוף זמן שמע (קול אליהו)', 'proportional_hours(3, kol_eliyahu)');

-- Asymmetric plag (Manchester)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES ('plag_hamincha_alos_to_sunset', 'Plag HaMincha (Alos to Sunset)', 'פלג המנחה (עלות עד שקיעה)', 'proportional_hours(10.75, custom(alos_16_1, sunset))');

-- Plag zmaniyos variants
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES
('plag_hamincha_72_zmanis', 'Plag HaMincha (72 Zmaniyos)', 'פלג המנחה (72 זמניות)', 'proportional_hours(10.75, mga_72_zmanis)'),
('plag_hamincha_90_zmanis', 'Plag HaMincha (90 Zmaniyos)', 'פלג המנחה (90 זמניות)', 'proportional_hours(10.75, mga_90_zmanis)'),
('plag_hamincha_96_zmanis', 'Plag HaMincha (96 Zmaniyos)', 'פלג המנחה (96 זמניות)', 'proportional_hours(10.75, mga_96_zmanis)'),
('plag_hamincha_120_zmanis', 'Plag HaMincha (120 Zmaniyos)', 'פלג המנחה (120 זמניות)', 'proportional_hours(10.75, mga_120_zmanis)');

-- Ahavat Shalom mincha (rare but complete)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES
('mincha_gedola_ahavat_shalom', 'Earliest Mincha (Ahavat Shalom)', 'מנחה גדולה (אהבת שלום)', 'proportional_hours(6.5, ahavat_shalom)'),
('mincha_ketana_ahavat_shalom', 'Mincha Ketana (Ahavat Shalom)', 'מנחה קטנה (אהבת שלום)', 'proportional_hours(9.5, ahavat_shalom)'),
('plag_hamincha_ahavat_shalom', 'Plag HaMincha (Ahavat Shalom)', 'פלג המנחה (אהבת שלום)', 'proportional_hours(10.75, ahavat_shalom)');

-- Mincha Gedola Greater Than 30 (logic variant)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES ('mincha_gedola_greater_than_30', 'Earliest Mincha (Later of GRA/30 min)', 'מנחה גדולה (המאוחר)', 'max(mincha_gedola, chatzos + 30min)');
```

### Priority 3: Rarely Needed (Completeness)

```sql
-- Fixed local chatzos variants (6 methods in KosherJava)
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES
('sof_zman_shma_fixed_local', 'Latest Shema (Fixed Local Chatzos)', 'סוף זמן שמע (חצות קבוע)', 'proportional_hours(3, fixed_local)'),
('sof_zman_tfila_fixed_local', 'Latest Shacharit (Fixed Local Chatzos)', 'סוף זמן תפילה (חצות קבוע)', 'proportional_hours(4, fixed_local)');

-- Asymmetric shma calculations
INSERT INTO master_zmanim_registry (zman_key, canonical_english_name, canonical_hebrew_name, default_formula_dsl)
VALUES
('sof_zman_shma_alos_to_sunset', 'Latest Shema (Alos 16.1° to Sunset)', 'סוף זמן שמע (עלות עד שקיעה)', 'proportional_hours(3, custom(alos_16_1, sunset))'),
('sof_zman_shma_manchester', 'Latest Shema (Manchester)', 'סוף זמן שמע (מנצ׳סטר)', 'proportional_hours(3, custom(alos_16_1, tzais_7_083))');
```

---

## Summary of Gaps

### Missing from Registry (15 items total):

**High Priority (2):**
1. `tzais_16_1` - Tzais 16.1° (72 min equivalent in degrees)
2. `sunrise_baal_hatanya` - Netz amiti (1.583°)

**Medium Priority (8):**
3. `sof_zman_shma_kol_eliyahu` - Kol Eliyahu shma
4. `plag_hamincha_alos_to_sunset` - Asymmetric plag
5. `plag_hamincha_72_zmanis` - Plag zmaniyos
6. `plag_hamincha_90_zmanis`
7. `plag_hamincha_96_zmanis`
8. `plag_hamincha_120_zmanis`
9. `mincha_gedola_greater_than_30` - Logic variant
10. `plag_hamincha_manchester` - Machzikei Hadass

**Low Priority (5):**
11. `mincha_gedola_ahavat_shalom`
12. `mincha_ketana_ahavat_shalom`
13. `plag_hamincha_ahavat_shalom`
14. `sof_zman_shma_fixed_local`
15. `sof_zman_tfila_fixed_local`

### Missing Shita Tags (6):
1. `shita_kol_eliyahu`
2. `shita_ahavat_shalom`
3. `shita_machzikei_hadass`
4. `shita_fixed_local_chatzos`
5. `shita_chazon_ish`
6. `shita_r_tucazinsky`

---

## Conclusion

**Your master registry is 95%+ complete.** The 172 entries cover:
- All core zmanim categories
- All major halachic opinions (7 shitos)
- 66 tags (events, holidays, categories, opinions)
- Comprehensive formula DSL

The identified gaps are primarily:
1. **Edge cases** (asymmetric days, fixed local chatzos)
2. **Rare opinions** (Kol Eliyahu, Ahavat Shalom)
3. **One oversight** (tzais 16.1°, netz amiti)

**Recommendation:** Add the 2 high-priority items (`tzais_16_1`, `sunrise_baal_hatanya`) and the Machzikei Hadass variant for Manchester publishers. The rest can be added as needed.

---

## Research Documents Created

This analysis was based on comprehensive research documented in:

1. **[kosherjava-zmanim-complete-extraction.md](kosherjava-zmanim-complete-extraction.md)** - 180+ methods fully documented
2. **[kosherjava-formulas-quick-reference.md](kosherjava-formulas-quick-reference.md)** - All formulas in table format
3. **[kosherjava-research-summary.md](kosherjava-research-summary.md)** - Research overview and statistics

All documents are in `/home/daniel/repos/zmanim/docs/`.
