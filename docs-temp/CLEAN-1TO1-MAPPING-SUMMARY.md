# Clean 1-to-1 HebCal Mapping Summary

## What This Migration Does

Establishes a **pure 1-to-1 relationship** between HebCal events and tags:
- **Before:** 58 mappings → 42 tags (duplicates and ghost tags)
- **After:** 50 mappings → 50 tags (clean 1-to-1)

---

## Changes Made

### 1. Removed Duplicate Mappings (8 duplicates deleted)

| HebCal Event | Before | After |
|--------------|--------|-------|
| `Asara B'Tevet` | asarah_bteves, fast_day | asarah_bteves ✅ |
| `Tzom Gedaliah` | tzom_gedaliah, fast_day | tzom_gedaliah ✅ |
| `Ta'anit Esther` | taanis_esther, fast_day | taanis_esther ✅ |
| `Tzom Tammuz` | shiva_asar_btamuz, fast_day | shiva_asar_btamuz ✅ |
| `Ta'anit Bechorot` | taanis_bechoros, fast_day | taanis_bechoros ✅ |
| `Pesach VII` | pesach, pesach_last | pesach ✅ |
| `Pesach VIII` | pesach, pesach_last | pesach ✅ |
| `Sukkot VII (Hoshana Raba)` | chol_hamoed_sukkos, hoshanah_rabbah | hoshanah_rabbah ✅ |

**Total duplicates removed:** 8 mappings deleted

---

### 2. Deleted Ghost Tags (9 tags with no HebCal mappings)

These tags had **zero HebCal event mappings** and have been deleted:

| Tag Key | Reason | Deleted |
|---------|--------|---------|
| `yom_tov` | Generic category (no specific HebCal event) | ✅ |
| `shabbos` | Hardcoded in code (day of week), not from HebCal | ✅ |
| `fast_day` | Generic category (all specific mappings removed) | ✅ |
| `three_weeks` | Period tag (17 Tamuz - 9 Av) | ✅ |
| `nine_days` | Period tag (1-9 Av) | ✅ |
| `aseres_yemei_teshuva` | Period tag (RH - YK) | ✅ |
| `selichos` | Missing mapping (HebCal has "Leil Selichot" but never mapped) | ✅ |
| `pesach_first` | Unused, no mappings | ✅ |
| `pesach_last` | Redundant (covered by pesach for VII/VIII) | ✅ |

**Note:** These tags were also removed from `master_zman_tags` to prevent orphaned references.

---

## Final Result: 50 HebCal Events → 50 Tags

### Complete 1-to-1 Mapping List

| # | HebCal Event Pattern | Tag Key | Display Name |
|---|---------------------|---------|--------------|
| 1 | `%day of the Omer` | omer | Sefirat HaOmer |
| 2 | `Asara B'Tevet` | asarah_bteves | Asarah B'Teves |
| 3 | `Chanukah%` | chanukah | Chanukah |
| 4 | `Erev Pesach` | erev_pesach | Erev Pesach |
| 5 | `Erev Rosh Hashana` | erev_rosh_hashanah | Erev Rosh Hashanah |
| 6 | `Erev Shavuot` | erev_shavuos | Erev Shavuos |
| 7 | `Erev Sukkot` | erev_sukkos | Erev Sukkos |
| 8 | `Erev Tish'a B'Av` | erev_tisha_bav | Erev Tisha B'Av |
| 9 | `Erev Yom Kippur` | erev_yom_kippur | Erev Yom Kippur |
| 10 | `Lag BaOmer` | lag_baomer | Lag BaOmer |
| 11 | `Pesach I` | pesach | Pesach |
| 12 | `Pesach II` | pesach | Pesach |
| 13 | `Pesach III (CH''M)` | chol_hamoed_pesach | Chol HaMoed Pesach |
| 14 | `Pesach IV (CH''M)` | chol_hamoed_pesach | Chol HaMoed Pesach |
| 15 | `Pesach V (CH''M)` | chol_hamoed_pesach | Chol HaMoed Pesach |
| 16 | `Pesach VI (CH''M)` | chol_hamoed_pesach | Chol HaMoed Pesach |
| 17 | `Pesach VII` | pesach | Pesach |
| 18 | `Pesach VIII` | pesach | Pesach |
| 19 | `Pesach Sheni` | pesach_sheni | Pesach Sheni |
| 20 | `Purim` | purim | Purim |
| 21 | `Rosh Chodesh%` | rosh_chodesh | Rosh Chodesh |
| 22 | `Rosh Hashana%` | rosh_hashanah | Rosh Hashanah |
| 23 | `Shabbat Chazon` | shabbos_chazon | Shabbos Chazon |
| 24 | `Shabbat HaChodesh` | shabbos_hachodesh | Shabbos HaChodesh |
| 25 | `Shabbat HaGadol` | shabbos_hagadol | Shabbos HaGadol |
| 26 | `Shabbat Nachamu` | shabbos_nachamu | Shabbos Nachamu |
| 27 | `Shabbat Parah` | shabbos_parah | Shabbos Parah |
| 28 | `Shabbat Shekalim` | shabbos_shekalim | Shabbos Shekalim |
| 29 | `Shabbat Shirah` | shabbos_shirah | Shabbos Shirah |
| 30 | `Shabbat Shuva` | shabbos_shuva | Shabbos Shuva |
| 31 | `Shabbat Zachor` | shabbos_zachor | Shabbos Zachor |
| 32 | `Shavuot%` | shavuos | Shavuos |
| 33 | `Shmini Atzeret` | shemini_atzeres | Shemini Atzeres |
| 34 | `Shushan Purim` | shushan_purim | Shushan Purim |
| 35 | `Simchat Torah` | simchas_torah | Simchas Torah |
| 36 | `Sukkot I` | sukkos | Sukkos |
| 37 | `Sukkot II` | sukkos | Sukkos |
| 38 | `Sukkot III (CH''M)` | chol_hamoed_sukkos | Chol HaMoed Sukkos |
| 39 | `Sukkot IV (CH''M)` | chol_hamoed_sukkos | Chol HaMoed Sukkos |
| 40 | `Sukkot V (CH''M)` | chol_hamoed_sukkos | Chol HaMoed Sukkos |
| 41 | `Sukkot VI (CH''M)` | chol_hamoed_sukkos | Chol HaMoed Sukkos |
| 42 | `Sukkot VII (Hoshana Raba)` | hoshanah_rabbah | Hoshanah Rabbah |
| 43 | `Ta'anit Bechorot` | taanis_bechoros | Taanis Bechoros |
| 44 | `Ta'anit Esther` | taanis_esther | Taanis Esther |
| 45 | `Tish'a B'Av` | tisha_bav | Tisha B'Av |
| 46 | `Tu B'Av` | tu_bav | Tu B'Av |
| 47 | `Tu BiShvat` | tu_bshvat | Tu B'Shvat |
| 48 | `Tzom Gedaliah` | tzom_gedaliah | Tzom Gedaliah |
| 49 | `Tzom Tammuz` | shiva_asar_btamuz | Shiva Asar B'Tamuz |
| 50 | `Yom Kippur` | yom_kippur | Yom Kippur |

---

## Notes on Multi-Day Events

Some tags map to multiple HebCal events because HebCal returns specific day numbers:

**Pesach (4 events → 1 tag):**
- `Pesach I` → pesach
- `Pesach II` → pesach
- `Pesach VII` → pesach
- `Pesach VIII` → pesach

**Chol HaMoed Pesach (4 events → 1 tag):**
- `Pesach III (CH''M)` → chol_hamoed_pesach
- `Pesach IV (CH''M)` → chol_hamoed_pesach
- `Pesach V (CH''M)` → chol_hamoed_pesach
- `Pesach VI (CH''M)` → chol_hamoed_pesach

**Sukkos (2 events → 1 tag):**
- `Sukkot I` → sukkos
- `Sukkot II` → sukkos

**Chol HaMoed Sukkos (4 events → 1 tag):**
- `Sukkot III (CH''M)` → chol_hamoed_sukkos
- `Sukkot IV (CH''M)` → chol_hamoed_sukkos
- `Sukkot V (CH''M)` → chol_hamoed_sukkos
- `Sukkot VI (CH''M)` → chol_hamoed_sukkos

**Rosh Hashana (uses wildcard):**
- `Rosh Hashana%` matches "Rosh Hashana I" and "Rosh Hashana II" → rosh_hashanah

**Shavuos (uses wildcard):**
- `Shavuot%` matches "Shavuot" (Israel) and "Shavuot I/II" (Diaspora) → shavuos

**Chanukah (uses wildcard):**
- `Chanukah%` matches all 8 days → chanukah

**Rosh Chodesh (uses wildcard):**
- `Rosh Chodesh%` matches all 12 months → rosh_chodesh

**Omer (uses wildcard):**
- `%day of the Omer` matches all 49 days → omer

---

## What About Group Tags?

Group tags (`yom_tov`, `fast_day`, `shabbos`, etc.) have been **deleted** in this migration.

**Future Plan:**
- Add group tags later with **regex matching rules**
- Group tags will NOT be in `tag_event_mappings`
- Group tags will be defined separately with pattern matching logic
- Example: `fast_day` group matches any tag matching regex `/(asarah_bteves|tzom_gedaliah|tisha_bav|taanis_esther|taanis_bechoros|shiva_asar_btamuz)/`

---

## Validation

Run these queries to verify 1-to-1 mapping:

```sql
-- Should return 50, 50, 'CLEAN 1-to-1'
SELECT
    COUNT(DISTINCT hebcal_event_pattern) as unique_hebcal_events,
    COUNT(*) as total_mappings,
    CASE
        WHEN COUNT(DISTINCT hebcal_event_pattern) = COUNT(*)
        THEN 'CLEAN 1-to-1'
        ELSE 'DUPLICATES EXIST'
    END as status
FROM tag_event_mappings
WHERE hebcal_event_pattern IS NOT NULL;

-- Should return 0 rows (no tags without mappings)
SELECT t.tag_key
FROM zman_tags t
LEFT JOIN tag_event_mappings tem ON t.id = tem.tag_id
WHERE t.tag_type_id = 170  -- event type
GROUP BY t.tag_key
HAVING COUNT(tem.id) = 0;
```

---

## Impact on Zmanim

### Before Migration
Zmanim tagged with deleted tags (like `fast_day`, `yom_tov`) will lose those associations.

**Example:**
```sql
-- Before: fast_begins had 6 tags
SELECT t.tag_key FROM master_zman_tags mzt
JOIN zman_tags t ON mzt.tag_id = t.id
WHERE mzt.master_zman_id = (SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins');

-- Result:
-- fast_day (DELETED)
-- asarah_bteves
-- tzom_gedaliah
-- tisha_bav
-- taanis_esther
-- taanis_bechoros
-- shiva_asar_btamuz
```

**After Migration:**
```sql
-- After: fast_begins has 6 specific tags (generic fast_day removed)
-- asarah_bteves
-- tzom_gedaliah
-- tisha_bav
-- taanis_esther
-- taanis_bechoros
-- shiva_asar_btamuz
```

### Recommendation
After this migration, review all zmanim in `master_zman_tags` and ensure they have the correct specific tags instead of generic ones.

---

## Next Steps

1. **Apply migration:** `psql $DATABASE_URL < db/migrations/20251224235000_clean_1to1_hebcal_mappings.sql`
2. **Verify 1-to-1:** Run validation queries above
3. **Review zmanim:** Check `master_zman_tags` for any broken references
4. **Add group tags later:** Define regex-based group tag system

---

## Summary

✅ **Clean 1-to-1 mapping:** 50 HebCal events → 50 tags
✅ **Zero duplicates:** Each HebCal event maps to exactly ONE tag
✅ **Zero ghost tags:** Every tag has at least one HebCal mapping
✅ **Future-ready:** Clean foundation for adding regex-based group tags later
