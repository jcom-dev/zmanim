# Tag Metadata Validation Queries

This document contains validation queries for the tag metadata enhancement (migrations 20251224220000 and 20251224220001).

## Schema Validation

### Verify New Columns Exist
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'zman_tags'
  AND column_name IN ('is_hidden', 'yom_tov_level', 'fast_start_type', 'day_number', 'total_days')
ORDER BY ordinal_position;
```

### Verify Constraints
```sql
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'zman_tags'::regclass
  AND conname LIKE 'chk_%'
ORDER BY conname;
```

### Verify Indexes
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'zman_tags'
  AND (indexname LIKE '%hidden%' OR indexname LIKE '%yom_tov%')
ORDER BY indexname;
```

## Data Validation

### List All Hidden Tags
```sql
SELECT tag_key, display_name_english_ashkenazi, tag_type_id
FROM zman_tags
WHERE is_hidden = true
ORDER BY tag_key;
```

**Expected Result:** 12 hidden tags (yom_tov, fast_day, category_*, day_before)

### List All Yom Tov Tags
```sql
SELECT tag_key, display_name_english_ashkenazi, yom_tov_level, total_days
FROM zman_tags
WHERE yom_tov_level > 0
ORDER BY yom_tov_level DESC, tag_key;
```

**Expected Result:**
- Level 1 (Yom Tov): yom_kippur, shabbos, rosh_hashanah, pesach_first, pesach_last, shavuos, sukkos, shemini_atzeres, simchas_torah
- Level 2 (Chol HaMoed): chol_hamoed_pesach, chol_hamoed_sukkos, hoshanah_rabbah

### List All Fast Days with Start Times
```sql
SELECT tag_key, display_name_english_ashkenazi, fast_start_type
FROM zman_tags
WHERE fast_start_type IS NOT NULL
ORDER BY fast_start_type, tag_key;
```

**Expected Result:**
- Sunset fasts: yom_kippur, tisha_bav
- Dawn fasts: asarah_bteves, shiva_asar_btamuz, taanis_bechoros, taanis_esther, tzom_gedaliah

### List Multi-Day Events
```sql
SELECT tag_key, display_name_english_ashkenazi, total_days, day_number
FROM zman_tags
WHERE total_days IS NOT NULL
ORDER BY total_days DESC, tag_key;
```

**Expected Result:**
- Omer: 49 days
- Three Weeks: 21 days
- Aseres Yemei Teshuva: 10 days
- Nine Days: 9 days
- Chanukah: 8 days
- Chol HaMoed (Pesach & Sukkos): 4 days each
- Rosh Hashanah, Shavuos, Sukkos, Pesach First/Last: 2 days each

### Complete Metadata View
```sql
SELECT
    tag_key,
    display_name_english_ashkenazi,
    CASE
        WHEN is_hidden THEN 'Hidden'
        ELSE 'Visible'
    END as visibility,
    CASE yom_tov_level
        WHEN 0 THEN 'Regular'
        WHEN 1 THEN 'Yom Tov'
        WHEN 2 THEN 'Chol HaMoed'
    END as sanctity,
    fast_start_type,
    total_days
FROM zman_tags
WHERE is_hidden = true
   OR yom_tov_level > 0
   OR fast_start_type IS NOT NULL
   OR total_days IS NOT NULL
ORDER BY
    yom_tov_level DESC,
    CASE WHEN fast_start_type = 'sunset' THEN 1 WHEN fast_start_type = 'dawn' THEN 2 ELSE 3 END,
    total_days DESC NULLS LAST,
    tag_key;
```

## Use Case Examples

### Query: Get all visible event tags (excluding internal categories)
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE is_hidden = false
  AND tag_type_id = 170  -- Assuming 170 is the event tag type
ORDER BY sort_order, tag_key;
```

### Query: Get all yom tov days for candle lighting logic
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE yom_tov_level = 1
ORDER BY tag_key;
```

### Query: Get all fasts that start at dawn
```sql
SELECT tag_key, display_name_english_ashkenazi
FROM zman_tags
WHERE fast_start_type = 'dawn'
ORDER BY sort_order;
```

### Query: Get all multi-day events for calendar display
```sql
SELECT tag_key, display_name_english_ashkenazi, total_days
FROM zman_tags
WHERE total_days > 1
ORDER BY total_days DESC, tag_key;
```

## Constraint Tests

### Test 1: Try to insert invalid yom_tov_level (should fail)
```sql
-- This should fail with constraint violation
INSERT INTO zman_tags (tag_key, display_name_hebrew, tag_type_id, yom_tov_level, display_name_english_ashkenazi)
VALUES ('test_tag', 'טעסט', 170, 3, 'Test Tag');
```

### Test 2: Try to insert invalid fast_start_type (should fail)
```sql
-- This should fail with constraint violation
INSERT INTO zman_tags (tag_key, display_name_hebrew, tag_type_id, fast_start_type, display_name_english_ashkenazi)
VALUES ('test_tag', 'טעסט', 170, 'midnight', 'Test Tag');
```

### Test 3: Try to insert day_number > total_days (should fail)
```sql
-- This should fail with constraint violation
INSERT INTO zman_tags (tag_key, display_name_hebrew, tag_type_id, day_number, total_days, display_name_english_ashkenazi)
VALUES ('test_tag', 'טעסט', 170, 5, 3, 'Test Tag');
```

### Test 4: Valid insert with all metadata (should succeed)
```sql
-- This should succeed
INSERT INTO zman_tags (
    tag_key,
    display_name_hebrew,
    tag_type_id,
    is_hidden,
    yom_tov_level,
    fast_start_type,
    total_days,
    display_name_english_ashkenazi
)
VALUES (
    'test_yom_tov',
    'יום טוב טעסט',
    170,
    false,
    1,
    NULL,
    2,
    'Test Yom Tov'
);

-- Clean up
DELETE FROM zman_tags WHERE tag_key = 'test_yom_tov';
```
