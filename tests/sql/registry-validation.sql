-- Registry Data Integrity Validation Script
-- Story 11.7 - AC-8: Data Validation Tests
--
-- Purpose: Validate data foundation integrity after Epic 11 implementation
-- Usage: Run this script to verify database integrity before deployment
--
-- Each query should return either:
--   - 0 rows (no violations found)
--   - COUNT = 0 (no violations found)
--
-- If violations are found, the output shows specific records that need attention.

-- ============================================
-- 1. Documentation Backfill Validation
-- ============================================
-- Verify all master zmanim have complete documentation required for registry UI

-- All master zmanim must have full_description
SELECT
    id,
    zman_key,
    canonical_english_name,
    'Missing full_description' AS violation
FROM master_zmanim_registry
WHERE full_description IS NULL OR TRIM(full_description) = ''
ORDER BY zman_key;
-- Expected: 0 rows

-- All master zmanim must have halachic_source
SELECT
    id,
    zman_key,
    canonical_english_name,
    'Missing halachic_source' AS violation
FROM master_zmanim_registry
WHERE halachic_source IS NULL OR TRIM(halachic_source) = ''
ORDER BY zman_key;
-- Expected: 0 rows

-- All master zmanim must have formula_explanation
SELECT
    id,
    zman_key,
    canonical_english_name,
    'Missing formula_explanation' AS violation
FROM master_zmanim_registry
WHERE formula_explanation IS NULL OR TRIM(formula_explanation) = ''
ORDER BY zman_key;
-- Expected: 0 rows

-- Summary: Count master zmanim with missing required documentation fields
SELECT
    COUNT(*) AS missing_docs_count,
    STRING_AGG(zman_key, ', ' ORDER BY zman_key) AS affected_zmanim
FROM master_zmanim_registry
WHERE full_description IS NULL OR TRIM(full_description) = ''
   OR halachic_source IS NULL OR TRIM(halachic_source) = ''
   OR formula_explanation IS NULL OR TRIM(formula_explanation) = '';
-- Expected: missing_docs_count = 0

-- ============================================
-- 2. Related Zmanim Validation
-- ============================================
-- Verify all related_zmanim_ids point to valid master zmanim

SELECT
    mzr.id,
    mzr.zman_key,
    mzr.canonical_english_name,
    related_id,
    'Invalid related_zman_id (does not exist)' AS violation
FROM master_zmanim_registry mzr,
     LATERAL unnest(COALESCE(mzr.related_zmanim_ids, ARRAY[]::integer[])) AS related_id
WHERE NOT EXISTS (
    SELECT 1
    FROM master_zmanim_registry mzr2
    WHERE mzr2.id = related_id
)
ORDER BY mzr.zman_key, related_id;
-- Expected: 0 rows

-- Summary: Count invalid related zmanim references
SELECT
    COUNT(*) AS invalid_related_count
FROM (
    SELECT mzr.id, related_id
    FROM master_zmanim_registry mzr,
         LATERAL unnest(COALESCE(mzr.related_zmanim_ids, ARRAY[]::integer[])) AS related_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM master_zmanim_registry mzr2
        WHERE mzr2.id = related_id
    )
) AS invalid_refs;
-- Expected: invalid_related_count = 0

-- ============================================
-- 3. Publisher 1 Linkage Validation
-- ============================================
-- Verify all Publisher 1 (MH Zmanim) zmanim have master linkage

SELECT
    id,
    zman_key,
    hebrew_name,
    english_name,
    'Missing master_zman_id linkage' AS violation
FROM publisher_zmanim
WHERE publisher_id = 1
  AND master_zman_id IS NULL
  AND deleted_at IS NULL
ORDER BY zman_key;
-- Expected: 0 rows

-- Summary: Count unlinked Publisher 1 zmanim
SELECT
    COUNT(*) AS unlinked_count,
    STRING_AGG(zman_key, ', ' ORDER BY zman_key) AS unlinked_zmanim
FROM publisher_zmanim
WHERE publisher_id = 1
  AND master_zman_id IS NULL
  AND deleted_at IS NULL;
-- Expected: unlinked_count = 0

-- ============================================
-- 4. Publisher 1 Duplicate Check
-- ============================================
-- Verify no duplicate master_zmanim_id within Publisher 1

SELECT
    master_zman_id,
    COUNT(*) AS duplicate_count,
    STRING_AGG(zman_key, ', ' ORDER BY zman_key) AS duplicate_zmanim,
    STRING_AGG(id::text, ', ' ORDER BY id) AS duplicate_ids
FROM publisher_zmanim
WHERE publisher_id = 1
  AND deleted_at IS NULL
  AND master_zman_id IS NOT NULL
GROUP BY master_zman_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, master_zman_id;
-- Expected: 0 rows

-- Summary: Count duplicate master zman references for Publisher 1
SELECT
    COUNT(*) AS duplicate_master_count
FROM (
    SELECT master_zman_id
    FROM publisher_zmanim
    WHERE publisher_id = 1
      AND deleted_at IS NULL
      AND master_zman_id IS NOT NULL
    GROUP BY master_zman_id
    HAVING COUNT(*) > 1
) AS duplicates;
-- Expected: duplicate_master_count = 0

-- ============================================
-- 5. Schema Validation - Unique Constraints
-- ============================================
-- Verify unique constraint exists on publisher_zmanim

SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'publisher_zmanim'
  AND constraint_name = 'idx_publisher_zmanim_master_unique';
-- Expected: 1 row with constraint_type = 'UNIQUE'

-- Additional constraint verification
SELECT
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
    pgc.condeferrable AS is_deferrable,
    pgc.condeferred AS initially_deferred
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
LEFT JOIN pg_constraint pgc
    ON pgc.conname = tc.constraint_name
WHERE tc.table_name = 'publisher_zmanim'
  AND tc.constraint_name = 'idx_publisher_zmanim_master_unique'
GROUP BY tc.constraint_name, tc.constraint_type, pgc.condeferrable, pgc.condeferred;
-- Expected: 1 row showing unique constraint on (publisher_id, master_zman_id)

-- ============================================
-- 6. Schema Validation - Indexes
-- ============================================
-- Verify required indexes exist on master_zmanim_registry

SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'master_zmanim_registry'
  AND indexname IN ('idx_master_zmanim_shita', 'idx_master_zmanim_category')
ORDER BY indexname;
-- Expected: 2 rows

-- Summary: Count missing indexes
SELECT
    2 - COUNT(*) AS missing_index_count,
    ARRAY_AGG(indexname ORDER BY indexname) AS found_indexes
FROM pg_indexes
WHERE tablename = 'master_zmanim_registry'
  AND indexname IN ('idx_master_zmanim_shita', 'idx_master_zmanim_category');
-- Expected: missing_index_count = 0

-- ============================================
-- 7. Data Integrity - Master Zman References
-- ============================================
-- Verify all publisher zmanim with master_zman_id reference valid master zmanim

SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.master_zman_id,
    'master_zman_id references non-existent master zman' AS violation
FROM publisher_zmanim pz
WHERE pz.master_zman_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM master_zmanim_registry mzr
      WHERE mzr.id = pz.master_zman_id
  )
ORDER BY pz.publisher_id, pz.zman_key;
-- Expected: 0 rows

-- Summary: Count invalid master zman references
SELECT
    COUNT(*) AS invalid_master_ref_count,
    COUNT(DISTINCT publisher_id) AS affected_publishers
FROM publisher_zmanim pz
WHERE pz.master_zman_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM master_zmanim_registry mzr
      WHERE mzr.id = pz.master_zman_id
  );
-- Expected: invalid_master_ref_count = 0

-- ============================================
-- 8. Data Integrity - Linked Zmanim
-- ============================================
-- Verify all linked_publisher_zman_id references point to valid publisher zmanim

SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.linked_publisher_zman_id,
    'linked_publisher_zman_id references non-existent publisher zman' AS violation
FROM publisher_zmanim pz
WHERE pz.linked_publisher_zman_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publisher_zmanim pz2
      WHERE pz2.id = pz.linked_publisher_zman_id
  )
ORDER BY pz.publisher_id, pz.zman_key;
-- Expected: 0 rows

-- Summary: Count invalid linked zman references
SELECT
    COUNT(*) AS invalid_linked_ref_count,
    COUNT(DISTINCT publisher_id) AS affected_publishers
FROM publisher_zmanim pz
WHERE pz.linked_publisher_zman_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publisher_zmanim pz2
      WHERE pz2.id = pz.linked_publisher_zman_id
  );
-- Expected: invalid_linked_ref_count = 0

-- ============================================
-- 9. Data Integrity - Copied From Publisher
-- ============================================
-- Verify all copied_from_publisher_id references point to valid publishers

SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.copied_from_publisher_id,
    'copied_from_publisher_id references non-existent publisher' AS violation
FROM publisher_zmanim pz
WHERE pz.copied_from_publisher_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publishers p
      WHERE p.id = pz.copied_from_publisher_id
  )
ORDER BY pz.publisher_id, pz.zman_key;
-- Expected: 0 rows

-- Summary: Count invalid copied from publisher references
SELECT
    COUNT(*) AS invalid_copied_ref_count,
    COUNT(DISTINCT publisher_id) AS affected_publishers
FROM publisher_zmanim pz
WHERE pz.copied_from_publisher_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM publishers p
      WHERE p.id = pz.copied_from_publisher_id
  );
-- Expected: invalid_copied_ref_count = 0

-- ============================================
-- 10. Bonus Check - Time Category Integrity
-- ============================================
-- Verify all master zmanim have valid time categories

SELECT
    mzr.id,
    mzr.zman_key,
    mzr.canonical_english_name,
    mzr.time_category_id,
    'time_category_id references non-existent category' AS violation
FROM master_zmanim_registry mzr
WHERE mzr.time_category_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM time_categories tc
      WHERE tc.id = mzr.time_category_id
  )
ORDER BY mzr.zman_key;
-- Expected: 0 rows

-- Verify all publisher zmanim have valid time categories
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.time_category_id,
    'time_category_id references non-existent category' AS violation
FROM publisher_zmanim pz
WHERE pz.time_category_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM time_categories tc
      WHERE tc.id = pz.time_category_id
  )
ORDER BY pz.publisher_id, pz.zman_key;
-- Expected: 0 rows

-- ============================================
-- 11. Bonus Check - Shita and Category Enums
-- ============================================
-- Verify all master zmanim shita values are valid (within allowed enum)

SELECT
    id,
    zman_key,
    canonical_english_name,
    shita,
    'Invalid shita value (not in allowed enum)' AS violation
FROM master_zmanim_registry
WHERE shita IS NOT NULL
  AND shita NOT IN (
      'GRA', 'MGA', 'BAAL_HATANYA', 'RABBEINU_TAM', 'GEONIM',
      'ATERET_TORAH', 'YEREIM', 'AHAVAT_SHALOM', 'UNIVERSAL'
  )
ORDER BY zman_key;
-- Expected: 0 rows

-- Verify all master zmanim category values are valid (within allowed enum)
SELECT
    id,
    zman_key,
    canonical_english_name,
    category,
    'Invalid category value (not in allowed enum)' AS violation
FROM master_zmanim_registry
WHERE category IS NOT NULL
  AND category NOT IN (
      'ALOS', 'MISHEYAKIR', 'SHEMA', 'TEFILLA', 'CHATZOS',
      'MINCHA', 'PLAG', 'SHKIA', 'BEIN_HASHMASHOS', 'TZAIS',
      'CANDLE_LIGHTING', 'SPECIAL', 'OTHER'
  )
ORDER BY zman_key;
-- Expected: 0 rows

-- ============================================
-- VALIDATION SUMMARY
-- ============================================
-- Overall summary of all validation checks

SELECT
    'Documentation Backfill' AS check_name,
    (SELECT COUNT(*) FROM master_zmanim_registry
     WHERE full_description IS NULL OR TRIM(full_description) = ''
        OR halachic_source IS NULL OR TRIM(halachic_source) = ''
        OR formula_explanation IS NULL OR TRIM(formula_explanation) = '') AS violations,
    'All master zmanim must have full documentation' AS description
UNION ALL
SELECT
    'Related Zmanim Integrity',
    (SELECT COUNT(*) FROM (
        SELECT mzr.id, related_id
        FROM master_zmanim_registry mzr,
             LATERAL unnest(COALESCE(mzr.related_zmanim_ids, ARRAY[]::integer[])) AS related_id
        WHERE NOT EXISTS (
            SELECT 1 FROM master_zmanim_registry mzr2 WHERE mzr2.id = related_id
        )
    ) AS invalid_refs),
    'All related_zmanim_ids must point to existing master zmanim'
UNION ALL
SELECT
    'Publisher 1 Linkage',
    (SELECT COUNT(*) FROM publisher_zmanim
     WHERE publisher_id = 1 AND master_zman_id IS NULL AND deleted_at IS NULL),
    'All Publisher 1 zmanim must have master_zman_id'
UNION ALL
SELECT
    'Publisher 1 No Duplicates',
    (SELECT COUNT(*) FROM (
        SELECT master_zman_id FROM publisher_zmanim
        WHERE publisher_id = 1 AND deleted_at IS NULL AND master_zman_id IS NOT NULL
        GROUP BY master_zman_id HAVING COUNT(*) > 1
    ) AS duplicates),
    'No duplicate master_zman_id within Publisher 1'
UNION ALL
SELECT
    'Master Zman References',
    (SELECT COUNT(*) FROM publisher_zmanim pz
     WHERE pz.master_zman_id IS NOT NULL AND pz.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM master_zmanim_registry mzr WHERE mzr.id = pz.master_zman_id)),
    'All publisher zmanim master_zman_id must reference valid master zmanim'
UNION ALL
SELECT
    'Linked Zmanim References',
    (SELECT COUNT(*) FROM publisher_zmanim pz
     WHERE pz.linked_publisher_zman_id IS NOT NULL AND pz.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM publisher_zmanim pz2 WHERE pz2.id = pz.linked_publisher_zman_id)),
    'All linked_publisher_zman_id must reference valid publisher zmanim'
UNION ALL
SELECT
    'Copied From Publisher References',
    (SELECT COUNT(*) FROM publisher_zmanim pz
     WHERE pz.copied_from_publisher_id IS NOT NULL AND pz.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM publishers p WHERE p.id = pz.copied_from_publisher_id)),
    'All copied_from_publisher_id must reference valid publishers'
UNION ALL
SELECT
    'Schema Constraint Check',
    (SELECT CASE WHEN COUNT(*) = 1 THEN 0 ELSE 1 END
     FROM information_schema.table_constraints
     WHERE table_name = 'publisher_zmanim'
       AND constraint_name = 'idx_publisher_zmanim_master_unique'),
    'Unique constraint idx_publisher_zmanim_master_unique must exist'
UNION ALL
SELECT
    'Schema Index Check',
    (SELECT 2 - COUNT(*)
     FROM pg_indexes
     WHERE tablename = 'master_zmanim_registry'
       AND indexname IN ('idx_master_zmanim_shita', 'idx_master_zmanim_category')),
    'Required indexes on master_zmanim_registry must exist'
ORDER BY check_name;
-- Expected: All violations = 0
