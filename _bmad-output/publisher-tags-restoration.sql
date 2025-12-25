-- ============================================================================
-- Publisher Zmanim Tags Restoration
-- ============================================================================
--
-- ANALYSIS SUMMARY:
-- - Total active publisher_zmanim: 171
-- - Publisher zmanim WITH tags: 114
-- - Publisher zmanim WITHOUT tags: 57
-- - Publisher zmanim without tags that HAVE master matches: 50
-- - Publisher zmanim without tags that have NO master match: 7
-- - Master zmanim that have tags: 118 out of 241
-- - Tags to be restored by copying from master: 3
--
-- STRATEGY:
-- Publisher zmanim inherit tags from their master zman entries when:
-- 1. The publisher zman_key matches a master zman_key
-- 2. The master zman has tags defined
-- 3. The tag doesn't already exist in publisher_zman_tags
--
-- Many basic zmanim (sunrise, sunset, chatzos, etc.) don't have tags in master
-- and therefore publisher versions shouldn't have tags either.
-- Tags are selectively applied for:
-- - Shita associations (shita_mga, shita_gra, shita_rt, etc.)
-- - Category groupings (category_shema, category_tefila, category_mincha, etc.)
-- - Event-specific timing (day_before, category_fast_start, etc.)
--
-- ============================================================================

-- ============================================================================
-- PART 1: Analysis Queries (for verification)
-- ============================================================================

-- Publisher zmanim WITHOUT tags
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    CASE WHEN mr.id IS NOT NULL THEN 'HAS_MASTER' ELSE 'NO_MASTER' END as master_status,
    CASE WHEN mzt.tag_id IS NOT NULL THEN 'MASTER_HAS_TAGS' ELSE 'NO_TAGS_AVAILABLE' END as tag_status
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON mr.zman_key = pz.zman_key
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
WHERE pz.deleted_at IS NULL
  AND pz.id NOT IN (SELECT DISTINCT publisher_zman_id FROM publisher_zman_tags WHERE publisher_zman_id IS NOT NULL)
ORDER BY pz.publisher_id, pz.zman_key;

-- Publisher zmanim that SHOULD get tags (have matching master with tags)
SELECT
    pz.id as publisher_zman_id,
    pz.publisher_id,
    pz.zman_key,
    mr.id as master_zman_id,
    ARRAY_AGG(DISTINCT zt.tag_key ORDER BY zt.tag_key) as tags_to_add
FROM publisher_zmanim pz
JOIN master_zmanim_registry mr ON mr.zman_key = pz.zman_key
JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
JOIN zman_tags zt ON zt.id = mzt.tag_id
WHERE pz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM publisher_zman_tags pzt
    WHERE pzt.publisher_zman_id = pz.id AND pzt.tag_id = mzt.tag_id
  )
GROUP BY pz.id, pz.publisher_id, pz.zman_key, mr.id
ORDER BY pz.publisher_id, pz.zman_key;

-- ============================================================================
-- PART 2: Restoration SQL
-- ============================================================================

-- Restore missing tags by copying from master zmanim
-- This will add tags only where:
-- 1. Publisher zman_key matches master zman_key
-- 2. Master has tags defined
-- 3. Tag doesn't already exist for that publisher zman
BEGIN;

INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id)
SELECT DISTINCT
    pz.id as publisher_zman_id,
    mzt.tag_id
FROM publisher_zmanim pz
JOIN master_zmanim_registry mr ON mr.zman_key = pz.zman_key
JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
WHERE pz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM publisher_zman_tags pzt
    WHERE pzt.publisher_zman_id = pz.id
      AND pzt.tag_id = mzt.tag_id
  )
ORDER BY pz.id, mzt.tag_id;

-- Verify the insertion
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    zt.tag_key,
    zt.display_name_english_ashkenazi as tag_name
FROM publisher_zman_tags pzt
JOIN publisher_zmanim pz ON pz.id = pzt.publisher_zman_id
JOIN zman_tags zt ON zt.id = pzt.tag_id
WHERE pzt.publisher_zman_id IN (9, 37, 38)  -- The 3 publisher zmanim that will get tags
ORDER BY pz.id, zt.tag_key;

-- Expected result:
-- id |  publisher_id | zman_key       | tag_key                     | tag_name
-- ----+---------------+----------------+-----------------------------+---------------------------
--   9 |             1 | fast_ends      | category_tisha_bav_fast_end | Tisha B'Av Fast End
--  37 |             2 | alos_72        | shita_mga                   | MGA
--  38 |             2 | alos_72_zmanis | shita_mga                   | MGA

COMMIT;

-- ============================================================================
-- PART 3: Verification Queries
-- ============================================================================

-- Count before and after
SELECT
    'Before restoration' as status,
    COUNT(DISTINCT pz.id) as total_publisher_zmanim,
    COUNT(DISTINCT CASE WHEN pzt.publisher_zman_id IS NOT NULL THEN pz.id END) as with_tags,
    COUNT(DISTINCT CASE WHEN pzt.publisher_zman_id IS NULL THEN pz.id END) as without_tags
FROM publisher_zmanim pz
LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
WHERE pz.deleted_at IS NULL;

-- After running the restoration, you should see:
-- status              | total_publisher_zmanim | with_tags | without_tags
-- --------------------+------------------------+-----------+--------------
-- Before restoration  |                    171 |       114 |           57
-- After restoration   |                    171 |       114 |           57
--
-- WAIT - why no change? Because only 3 tags are being added to existing entries!
-- Let's check the right metric:

SELECT
    COUNT(*) as total_tag_associations_before
FROM publisher_zman_tags;

-- After the INSERT, run again to see the increase:
SELECT
    COUNT(*) as total_tag_associations_after
FROM publisher_zman_tags;

-- Should increase by 3 (from the analysis above)

-- Detailed verification of restored tags
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    ARRAY_AGG(DISTINCT zt.tag_key ORDER BY zt.tag_key) as all_tags
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
JOIN zman_tags zt ON zt.id = pzt.tag_id
WHERE pz.id IN (9, 37, 38)
GROUP BY pz.id, pz.publisher_id, pz.zman_key, pz.hebrew_name, pz.english_name
ORDER BY pz.publisher_id, pz.zman_key;

-- ============================================================================
-- PART 4: Summary Report
-- ============================================================================

-- Final summary of publisher zmanim by tag status
SELECT
    'Total publisher zmanim' as metric,
    COUNT(*) as count
FROM publisher_zmanim
WHERE deleted_at IS NULL

UNION ALL

SELECT
    'Publisher zmanim with tags',
    COUNT(DISTINCT pz.id)
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
WHERE pz.deleted_at IS NULL

UNION ALL

SELECT
    'Publisher zmanim without tags (no master tags available)',
    COUNT(DISTINCT pz.id)
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON mr.zman_key = pz.zman_key
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = mr.id
WHERE pz.deleted_at IS NULL
  AND pz.id NOT IN (SELECT publisher_zman_id FROM publisher_zman_tags)
  AND mzt.tag_id IS NULL

UNION ALL

SELECT
    'Total tag associations',
    COUNT(*)
FROM publisher_zman_tags;

-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- 1. Why only 3 tags restored?
--    - Most master zmanim don't have tags themselves
--    - Tags are selectively applied for shita/category associations
--    - Basic astronomical zmanim (sunrise, sunset, etc.) don't need tags
--    - The system is working as designed
--
-- 2. The 7 publisher zmanim without master matches:
--    - misheyakir_bedieved (publisher 1)
--    - sunrise (publisher 1)
--    - sunset (publisher 1)
--    - shkia (publisher 2)
--    - sunrise (publisher 2)
--    - sunset (publisher 2)
--    - tzeis (publisher 2)
--
--    These are likely publisher-specific customizations or aliases
--    They don't need tags unless the publisher specifically requests them
--
-- 3. Publisher zmanim that have tags are primarily:
--    - Shita-specific calculations (MGA, GRA, RT, Yereim, Baal HaTanya)
--    - Category groupings (shema, tefila, mincha, havdalah)
--    - Event-specific timing (candle_lighting, fast_begins, fast_ends)
--
-- 4. This restoration is CONSERVATIVE by design:
--    - Only copies tags that exist in master
--    - Doesn't create new tags
--    - Doesn't guess or infer tags
--    - Respects the selective tagging strategy
--
-- ============================================================================
