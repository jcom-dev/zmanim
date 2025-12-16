# Publisher 1 Master Linkages Audit Report

**Date:** 2025-12-22
**Story:** 11.0 - Data Foundation & Integrity Audit
**Phase:** 3 - Publisher 1 Audit

## Summary

| Metric | Value |
|--------|-------|
| Total Publisher Zmanim | 28 |
| Linked to Master Registry | 27 (96.4%) |
| Unlinked (Custom) | 1 (3.6%) |
| Duplicate Linkages Fixed | 2 |

## Audit Results

### Linked Zmanim (27)

All linked zmanim have correct master_zman_id mappings with matching zman_keys:

| Publisher Zman ID | Publisher Key | Master ID | Master Key | Status |
|-------------------|---------------|-----------|------------|--------|
| 142 | tzais_72 | 18 | tzais_72 | CORRECT |
| 143 | sof_zman_shma_mga_16_1 | 113 | sof_zman_shma_mga_16_1 | CORRECT |
| 144 | plag_hamincha_72 | 81 | plag_hamincha_72 | CORRECT |
| 146 | sof_zman_tfila_mga_72 | 14 | sof_zman_tfila_mga | CORRECT |
| 147 | tzais_7_08 | 158 | tzais_7_08 | CORRECT |
| 148 | misheyakir_bedieved | 71 | misheyakir_11 | CORRECT |
| 149 | fast_begins | 52 | fast_begins | CORRECT |
| 150 | alos_shemini_atzeres | 35 | alos_shemini_atzeres | CORRECT |
| 151 | sof_zman_shma_mga | 12 | sof_zman_shma_mga | CORRECT |
| 152 | mincha_ketana | 7 | mincha_ketana | CORRECT |
| 153 | plag_hamincha | 9 | plag_hamincha | CORRECT |
| 154 | chatzos | 3 | chatzos | CORRECT |
| 155 | sunrise | 15 | (sunrise) | CORRECT |
| 156 | sof_zman_shma_gra | 11 | sof_zman_shma_gra | CORRECT |
| 157 | sof_zman_tfila_gra | 13 | sof_zman_tfila_gra | CORRECT |
| 158 | candle_lighting | 2 | candle_lighting | CORRECT |
| 159 | chatzos_layla | 4 | chatzos_layla | CORRECT |
| 160 | fast_ends | 5 | fast_ends | CORRECT |
| 161 | sunset | 16 | (sunset) | CORRECT |
| 162 | mincha_gedola | 6 | mincha_gedola | CORRECT |
| 163 | shabbos_ends | 10 | shabbos_ends | CORRECT |
| 164 | sof_zman_shma_mga_72 | 116 | sof_zman_shma_mga_72 | CORRECT |
| 165 | alos_hashachar | 1 | alos_hashachar | CORRECT |
| 166 | plag_hamincha_terumas_hadeshen | 86 | plag_hamincha_terumas_hadeshen | CORRECT |
| 167 | alos_12 | 19 | alos_12 | CORRECT |
| 168 | alos_72 | 28 | alos_72 | CORRECT |
| 169 | misheyakir | 8 | misheyakir | CORRECT |

### Unlinked Zmanim (1)

| Publisher Zman ID | Publisher Key | English Name | Reason |
|-------------------|---------------|--------------|--------|
| 145 | alos_eighth_day | Alos HaShachar 1/8 | Custom zman (Minchas Yitzchak stringency) - no master equivalent |

**Note:** This is a legitimate custom zman specific to Publisher 1. The formula `proportional_hours(-1.5, gra)` calculates dawn as 1/8 of the day before sunrise based on the Minchas Yitzchak's stringency. No master registry entry exists for this specific calculation, which is expected for publisher-specific custom zmanim.

### Issues Fixed During Audit

During the schema migration (Phase 1), the following duplicate linkages were identified and fixed:

1. **alos_eighth_day (ID 145)**: Was incorrectly linked to master_zman_id 1 (alos_hashachar), same as alos_hashachar (ID 165). Fixed by setting master_zman_id to NULL since it's a custom zman.

2. **misheyakir_bedieved (ID 148)**: Was incorrectly linked to master_zman_id 8 (misheyakir), same as misheyakir (ID 169). Fixed by linking to master_zman_id 71 (misheyakir_11) since the formula uses 11 degrees.

## Unique Constraint

A unique partial index was added to prevent future duplicate linkages:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_publisher_zmanim_master_unique
ON public.publisher_zmanim(publisher_id, master_zman_id)
WHERE deleted_at IS NULL AND master_zman_id IS NOT NULL;
```

## Conclusion

Publisher 1's master registry linkages are now fully audited and correct:
- All 27 linked zmanim have accurate master_zman_id mappings
- The 1 unlinked zman is a legitimate custom publisher-specific zman
- Duplicate linkage issues have been resolved
- Unique constraint prevents future duplicates

**Audit Status:** PASSED
