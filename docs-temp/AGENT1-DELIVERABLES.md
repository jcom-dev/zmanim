# Agent 1: Database Schema Enhancements - Deliverables

**Objective:** Enhance database schema to support hidden tags and eliminate need for hardcoded logic.

**Date:** 2025-12-24
**Status:** Complete

---

## Deliverables Completed

### 1. Schema Migration (`20251224220000_add_tag_metadata.sql`)

Added five new metadata columns to the `zman_tags` table:

- **`is_hidden`** (boolean, default: false)
  - Indicates if tag should be hidden from user-facing tag selectors
  - Used for internal categorization tags like `yom_tov`, `fast_day`, and `category_*` tags

- **`yom_tov_level`** (integer, default: 0)
  - 0 = regular day
  - 1 = yom tov (full Shabbos-like restrictions)
  - 2 = chol hamoed (intermediate days with some restrictions)

- **`fast_start_type`** (varchar(20), default: null)
  - 'dawn' for minor fasts (Tzom Gedaliah, Asarah B'Teves, etc.)
  - 'sunset' for Tisha B'Av and Yom Kippur
  - NULL for non-fast days

- **`day_number`** (integer, default: null)
  - For multi-day events, indicates which day this tag represents (1-based)
  - NULL for single-day or non-sequential events
  - Currently unused but available for future refinement

- **`total_days`** (integer, default: null)
  - For multi-day events, indicates total number of consecutive days
  - NULL for single-day events
  - Examples: Chanukah=8, Omer=49, Rosh Hashanah=2

### 2. Constraints & Indexes

**Constraints:**
- `chk_yom_tov_level`: Ensures yom_tov_level is 0, 1, or 2
- `chk_fast_start_type`: Ensures fast_start_type is 'dawn', 'sunset', or NULL
- `chk_day_number_positive`: Ensures day_number > 0 when set
- `chk_total_days_positive`: Ensures total_days > 0 when set
- `chk_day_number_within_total`: Ensures day_number <= total_days

**Indexes:**
- `idx_zman_tags_is_hidden`: B-tree index on is_hidden for fast filtering
- `idx_zman_tags_yom_tov_level`: Partial B-tree index on yom_tov_level WHERE yom_tov_level > 0

### 3. Data Population Migration (`20251224220001_populate_tag_metadata.sql`)

Populated metadata for all 74 existing tags:

**Hidden Tags (12):**
- yom_tov, fast_day (generic categories)
- category_candle_lighting, category_shema, category_havdalah, category_tefila
- category_fast_start, category_mincha, category_chametz, category_fast_end
- category_kiddush_levana, day_before

**Yom Tov Level 1 (9 tags):**
- yom_kippur (also fast_start_type='sunset')
- shabbos
- rosh_hashanah (total_days=2)
- pesach_first (total_days=2)
- pesach_last (total_days=2)
- shavuos (total_days=2)
- sukkos (total_days=2)
- shemini_atzeres
- simchas_torah

**Yom Tov Level 2 / Chol HaMoed (3 tags):**
- chol_hamoed_pesach (total_days=4)
- chol_hamoed_sukkos (total_days=4)
- hoshanah_rabbah

**Fast Days:**
- Sunset fasts: yom_kippur, tisha_bav
- Dawn fasts: tzom_gedaliah, asarah_bteves, shiva_asar_btamuz, taanis_esther, taanis_bechoros

**Multi-Day Events:**
- omer (49 days)
- three_weeks (21 days)
- aseres_yemei_teshuva (10 days)
- nine_days (9 days)
- chanukah (8 days)

### 4. Validation

**Schema Validation:**
- All columns created successfully
- All constraints enforced correctly
- All indexes created

**Data Validation:**
- 74 total tags in database
- 12 tags marked as hidden (16%)
- 62 tags visible (84%)
- 12 tags with yom_tov_level > 0 (9 level 1, 3 level 2)
- 7 tags with fast_start_type set (2 sunset, 5 dawn)
- 12 tags with total_days set (multi-day events)
- All constraints tested and working

**Query Performance:**
- Index on is_hidden enables fast filtering of visible tags
- Partial index on yom_tov_level enables fast queries for yom tov logic

### 5. Documentation

Created comprehensive validation queries in `/home/daniel/repos/zmanim/db/migrations/VALIDATION_QUERIES.md`:
- Schema validation queries
- Data validation queries
- Use case examples
- Constraint tests

---

## Migration Files Created

1. `/home/daniel/repos/zmanim/db/migrations/20251224220000_add_tag_metadata.sql`
   - Adds columns, constraints, and indexes to zman_tags table

2. `/home/daniel/repos/zmanim/db/migrations/20251224220001_populate_tag_metadata.sql`
   - Populates metadata for all existing tags

3. `/home/daniel/repos/zmanim/db/migrations/VALIDATION_QUERIES.md`
   - Documentation and validation queries

---

## Testing Performed

### Schema Tests
- Applied migration 20251224220000 successfully
- Verified all 5 columns added with correct data types and defaults
- Verified all 5 constraints created correctly
- Verified both indexes created

### Data Tests
- Applied migration 20251224220001 successfully
- Verified 12 tags marked as hidden
- Verified yom tov levels assigned correctly (9 level 1, 3 level 2)
- Verified fast start types assigned correctly (2 sunset, 5 dawn)
- Verified multi-day event durations set correctly

### Constraint Tests
- Attempted to insert invalid yom_tov_level (5) - REJECTED as expected
- Attempted to insert invalid fast_start_type ('midnight') - REJECTED as expected
- All constraints working correctly

---

## Example Queries Enabled

### Get all visible event tags (excluding internal categories)
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE is_hidden = false
ORDER BY tag_key;
```

### Get all yom tov days for candle lighting logic
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE yom_tov_level = 1
ORDER BY tag_key;
```

### Get all fasts that start at dawn
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE fast_start_type = 'dawn'
ORDER BY tag_key;
```

### Get all multi-day events
```sql
SELECT tag_key, display_name_english_ashkenazi, total_days
FROM zman_tags
WHERE total_days > 1
ORDER BY total_days DESC;
```

---

## Impact on Hardcoded Logic Elimination

This schema enhancement enables:

1. **Tag Filtering:** Frontend and backend can now query `is_hidden = false` to get only user-facing tags, eliminating need for hardcoded exclusion lists

2. **Yom Tov Detection:** Calendar logic can query `yom_tov_level >= 1` instead of hardcoded tag lists

3. **Fast Day Logic:** Can query `fast_start_type` to determine when fasts begin, instead of hardcoded switches

4. **Multi-Day Events:** Can query `total_days` to determine event duration for calendar rendering

5. **Chol HaMoed Detection:** Can query `yom_tov_level = 2` for intermediate days

---

## Next Steps for Other Agents

- **Agent 2 (API):** Update backend queries to use new metadata columns instead of hardcoded logic
- **Agent 3 (Frontend):** Update UI components to filter by `is_hidden = false`
- **Agent 4 (Calendar):** Update calendar sync logic to use metadata for event classification

---

## Rollback (if needed)

To rollback these changes:

```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_zman_tags_is_hidden;
DROP INDEX IF EXISTS idx_zman_tags_yom_tov_level;

-- Drop constraints
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS chk_yom_tov_level;
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS chk_fast_start_type;
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS chk_day_number_positive;
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS chk_total_days_positive;
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS chk_day_number_within_total;

-- Drop columns
ALTER TABLE zman_tags DROP COLUMN IF EXISTS is_hidden;
ALTER TABLE zman_tags DROP COLUMN IF EXISTS yom_tov_level;
ALTER TABLE zman_tags DROP COLUMN IF EXISTS fast_start_type;
ALTER TABLE zman_tags DROP COLUMN IF EXISTS day_number;
ALTER TABLE zman_tags DROP COLUMN IF EXISTS total_days;
```

---

**Completed by:** Agent 1
**Verified:** All migrations applied successfully to development database
**Status:** Ready for code review and integration
