-- ============================================================================
-- MASTER ZMANIM TAGS RESTORATION
-- ============================================================================
--
-- This script restores missing tag associations for master_zmanim_registry
-- entries using intelligent pattern matching based on:
--   - Zman naming conventions (alos_*, tzais_*, etc.)
--   - Degree/minute values in names (16.1, 72, etc.)
--   - Known shita patterns from existing tagged zmanim
--   - Event-specific suffixes (_shemini_atzeres, etc.)
--
-- Current State:
--   Total master zmanim: 172
--   Tagged zmanim: 118
--   Missing tags: 54 zmanim
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: ALOS (DAWN) ZMANIM - Basic GRA variations
-- ============================================================================
-- Pattern: Various alos times using degrees or minutes
-- Strategy: Tag as shita_gra (default for non-attributed variations)
-- ============================================================================

-- Alos with degree-based variations (GRA approach)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('alos_12', 'alos_18', 'alos_19', 'alos_19_8', 'alos_26')
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Alos with minute-based variations (60, 90, 96 minutes - GRA)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('alos_60', 'alos_90', 'alos_96')
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Alos with zmanis (proportional hours) - MGA approach
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('alos_90_zmanis', 'alos_96_zmanis', 'alos_120_zmanis')
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Alos 120 minutes - MGA tradition
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'alos_120'
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Basic alos_hashachar - GRA default
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'alos_hashachar'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 2: EVENT-SPECIFIC ALOS
-- ============================================================================
-- Alos for Shemini Atzeres (Aravos time) - event + shita
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'alos_shemini_atzeres'
  AND zt.tag_key IN ('shmini_atzeres', 'shita_gra')
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 3: MISHEYAKIR (EARLIEST TALLIS/TEFILLIN TIME)
-- ============================================================================
-- Pattern: Various degree-based misheyakir times
-- Strategy: Tag as shita_gra (standard approach)
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN (
    'misheyakir',
    'misheyakir_7_65',
    'misheyakir_9_5',
    'misheyakir_10_2',
    'misheyakir_11',
    'misheyakir_11_5'
  )
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 4: TZAIS (NIGHTFALL) ZMANIM
-- ============================================================================
-- Pattern: Various tzais times using degrees, minutes, or stars
-- Strategy: Assign based on known shita patterns
-- ============================================================================

-- Tzais with degree variations - Geonim tradition
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN (
    'tzais_7_08',
    'tzais_13_5',
    'tzais_13_24',
    'tzais_18',
    'tzais_19_8',
    'tzais_26'
  )
  AND zt.tag_key = 'shita_geonim'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Tzais with minute variations - RT tradition (Rabbeinu Tam)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN (
    'tzais_20',
    'tzais_42',
    'tzais_50',
    'tzais_60',
    'tzais_90',
    'tzais_96'
  )
  AND zt.tag_key = 'shita_rt'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Tzais 120 minutes - MGA tradition
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'tzais_120'
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Tzais with zmanis (proportional hours) - MGA approach
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('tzais_72_zmanis', 'tzais_90_zmanis', 'tzais_96_zmanis', 'tzais_120_zmanis')
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Basic tzais (default) - GRA
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'tzais'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Tzais 3 stars - GRA (visual marker)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'tzais_3_stars'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Tzais 16.1 - MGA (matches alos_16_1 pattern)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'tzais_16_1'
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 5: CHATZOS (MIDDAY/MIDNIGHT)
-- ============================================================================
-- Pattern: Chatzos times
-- Strategy: Tag based on calculation method
-- ============================================================================

-- Basic chatzos (solar noon) - GRA
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'chatzos'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Chatzos layla (midnight) - GRA
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'chatzos_layla'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Fixed local chatzos (special shita)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'fixed_local_chatzos'
  AND zt.tag_key = 'shita_fixed_local_chatzos'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 6: SHAAH ZMANIS (PROPORTIONAL HOURS)
-- ============================================================================
-- Pattern: Proportional hour calculations
-- Strategy: Tag by shita (GRA vs MGA)
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'shaah_zmanis_gra'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'shaah_zmanis_mga'
  AND zt.tag_key = 'shita_mga'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 7: SOF ZMAN SHEMA (LATEST SHEMA) - Additional MGA variations
-- ============================================================================
-- Pattern: MGA variations with specific degree values
-- Strategy: Tag as category_shema + shita_mga
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('sof_zman_shma_mga_16_1', 'sof_zman_shma_mga_72')
  AND zt.tag_key IN ('category_shema', 'shita_mga')
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 8: PLAG HAMINCHA - Terumas HaDeshen variation
-- ============================================================================
-- Pattern: Specific plag calculation method
-- Strategy: Tag as category_mincha + specific shita
-- ============================================================================

-- Note: Terumas HaDeshen doesn't have its own shita tag, use GRA as base
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'plag_hamincha_terumas_hadeshen'
  AND zt.tag_key IN ('category_mincha', 'shita_gra')
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 9: SUNRISE/SUNSET VARIATIONS
-- ============================================================================
-- Pattern: Alternative sunrise/sunset calculations
-- Strategy: Tag by shita
-- ============================================================================

-- Sunrise - Baal HaTanya
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'sunrise_baal_hatanya'
  AND zt.tag_key = 'shita_baal_hatanya'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- Visible sunrise/sunset - GRA (standard astronomical)
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key IN ('visible_sunrise', 'visible_sunset')
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- True sunset (shkia amitis) - GRA
INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'shkia_amitis'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 10: BEIN HASHMASHOS (TWILIGHT) - Start time
-- ============================================================================
-- Pattern: Beginning of twilight period
-- Strategy: Tag as shita_gra (default)
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'bein_hashmashos_start'
  AND zt.tag_key = 'shita_gra'
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SECTION 11: HAVDALAH
-- ============================================================================
-- Pattern: Basic havdalah time
-- Strategy: Tag as category_havdalah + shita_gra
-- ============================================================================

INSERT INTO master_zman_tags (master_zman_id, tag_id)
SELECT mr.id, zt.id
FROM master_zmanim_registry mr
CROSS JOIN zman_tags zt
WHERE mr.zman_key = 'havdalah'
  AND zt.tag_key IN ('category_havdalah', 'shita_gra')
  AND NOT EXISTS (
    SELECT 1 FROM master_zman_tags mzt
    WHERE mzt.master_zman_id = mr.id AND mzt.tag_id = zt.id
  );

-- ============================================================================
-- SUMMARY & VALIDATION QUERIES
-- ============================================================================

-- Count how many new associations were created
DO $$
DECLARE
    new_tag_count INTEGER;
    remaining_untagged INTEGER;
BEGIN
    -- Count new tags (this will show 0 if run multiple times - expected)
    SELECT COUNT(*) INTO new_tag_count
    FROM master_zman_tags
    WHERE created_at > NOW() - INTERVAL '1 minute';

    -- Count remaining untagged
    SELECT COUNT(*) INTO remaining_untagged
    FROM master_zmanim_registry
    WHERE id NOT IN (
        SELECT DISTINCT master_zman_id
        FROM master_zman_tags
        WHERE master_zman_id IS NOT NULL
    );

    RAISE NOTICE '============================================';
    RAISE NOTICE 'TAG RESTORATION SUMMARY';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'New tag associations created: %', new_tag_count;
    RAISE NOTICE 'Remaining untagged zmanim: %', remaining_untagged;
    RAISE NOTICE '============================================';
END $$;

-- Show breakdown by tag type
SELECT
    tt.key as tag_type,
    COUNT(DISTINCT mzt.master_zman_id) as zmanim_count,
    COUNT(*) as total_associations
FROM master_zman_tags mzt
JOIN zman_tags zt ON mzt.tag_id = zt.id
JOIN tag_types tt ON zt.tag_type_id = tt.id
GROUP BY tt.key
ORDER BY tt.key;

-- Show zmanim that still need tags
SELECT
    mr.id,
    mr.zman_key,
    mr.canonical_english_name,
    mr.time_category_id
FROM master_zmanim_registry mr
WHERE id NOT IN (
    SELECT DISTINCT master_zman_id
    FROM master_zman_tags
    WHERE master_zman_id IS NOT NULL
)
ORDER BY mr.zman_key;

COMMIT;

-- ============================================================================
-- POST-EXECUTION VERIFICATION
-- ============================================================================
-- Run these queries AFTER executing the script to verify results
-- ============================================================================

-- Verify specific zmanim got their tags
-- SELECT
--     mr.zman_key,
--     ARRAY_AGG(zt.tag_key ORDER BY zt.tag_key) as tags
-- FROM master_zmanim_registry mr
-- JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id
-- JOIN zman_tags zt ON mzt.tag_id = zt.id
-- WHERE mr.zman_key IN (
--     'alos_hashachar',
--     'tzais',
--     'misheyakir',
--     'chatzos',
--     'havdalah',
--     'alos_shemini_atzeres'
-- )
-- GROUP BY mr.id, mr.zman_key
-- ORDER BY mr.zman_key;

-- Count total tagged vs untagged
-- SELECT
--     COUNT(*) as total_zmanim,
--     COUNT(DISTINCT mzt.master_zman_id) as tagged_zmanim,
--     COUNT(*) - COUNT(DISTINCT mzt.master_zman_id) as untagged_zmanim
-- FROM master_zmanim_registry mr
-- LEFT JOIN master_zman_tags mzt ON mr.id = mzt.master_zman_id;
