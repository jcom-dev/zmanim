#!/bin/bash
# Test HebCal event matching with simplified schema

set -e

source "$(dirname "$0")/../api/.env"

echo "Testing HebCal Event Matching (Simplified Schema)"
echo "==================================================

"

psql "$DATABASE_URL" <<'SQL'
-- ============================================
-- Test 1: EXACT matches
-- ============================================
\echo ''
\echo '=== TEST 1: EXACT MATCHES ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Purim'),
    ('Lag BaOmer'),
    ('Yom Kippur'),
    ('Shmini Atzeret'),
    ('Simchat Torah'),
    ('Erev Pesach'),
    ('Tu BiShvat'),
    ('Pesach Sheni')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 2: GROUP matches - Chanukah
-- ============================================
\echo ''
\echo '=== TEST 2: CHANUKAH GROUP ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Chanukah: 1 Candle'),
    ('Chanukah: 5 Candles'),
    ('Chanukah: 8 Candles'),
    ('Chanukah: 8th Day')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 3: GROUP matches - Pesach (NOT Pesach Sheni)
-- ============================================
\echo ''
\echo '=== TEST 3: PESACH GROUP (excluding Pesach Sheni) ==='
SELECT
    test_case,
    tag_key,
    match_type,
    CASE WHEN tag_key = 'pesach' THEN '✓ GROUP' WHEN tag_key = 'pesach_sheni' THEN '✓ EXACT' ELSE '✗ WRONG' END as validation
FROM (VALUES
    ('Pesach I'),
    ('Pesach II'),
    ('Pesach III (CH''M)'),
    ('Pesach VII'),
    ('Pesach VIII'),
    ('Pesach Sheni')  -- Should match 'pesach_sheni' EXACT, NOT 'pesach' GROUP
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 4: GROUP matches - Rosh Hashana
-- ============================================
\echo ''
\echo '=== TEST 4: ROSH HASHANA GROUP ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Rosh Hashana 5785'),
    ('Rosh Hashana 5786'),
    ('Rosh Hashana 5790'),
    ('Rosh Hashana II')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 5: GROUP matches - Sukkot
-- ============================================
\echo ''
\echo '=== TEST 5: SUKKOT GROUP ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Sukkot I'),
    ('Sukkot II'),
    ('Sukkot VII (Hoshana Raba)')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 6: GROUP matches - Shavuot
-- ============================================
\echo ''
\echo '=== TEST 6: SHAVUOT GROUP ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Shavuot I'),
    ('Shavuot II')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 7: GROUP matches - Tisha B'Av (including observed)
-- ============================================
\echo ''
\echo '=== TEST 7: TISHA B''AV GROUP (including observed) ==='
SELECT
    test_case,
    tag_key,
    match_type,
    CASE WHEN tag_key = 'tisha_bav' THEN '✓ GROUP' WHEN tag_key = 'erev_tisha_bav' THEN '✓ EXACT' ELSE '✗ WRONG' END as validation
FROM (VALUES
    ('Tish''a B''Av'),
    ('Tish''a B''Av (observed)'),
    ('Erev Tish''a B''Av')  -- Should match 'erev_tisha_bav' EXACT, NOT 'tisha_bav' GROUP
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 8: CATEGORY matches
-- ============================================
\echo ''
\echo '=== TEST 8: CATEGORY MATCHES ==='
SELECT
    title as test_case,
    category,
    tag_key,
    match_type
FROM (VALUES
    ('Candle lighting: 16:07', 'candles'),
    ('Havdalah: 17:28', 'havdalah'),
    ('Parashat Bereshit', 'parashat'),
    ('Mevarchim Chodesh Nisan', 'mevarchim'),
    ('Rosh Chodesh Tevet', 'roshchodesh')
) AS tests(title, category)
CROSS JOIN LATERAL match_hebcal_event(title, category) AS matches;

-- ============================================
-- Test 9: Special Shabbatot
-- ============================================
\echo ''
\echo '=== TEST 9: SPECIAL SHABBATOT ==='
SELECT
    test_case,
    tag_key,
    match_type
FROM (VALUES
    ('Shabbat Shekalim'),
    ('Shabbat Zachor'),
    ('Shabbat HaGadol'),
    ('Shabbat Chazon'),
    ('Shabbat Nachamu')
) AS tests(test_case)
CROSS JOIN LATERAL match_hebcal_event(test_case) AS matches;

-- ============================================
-- Test 10: Summary Statistics
-- ============================================
\echo ''
\echo '=== SUMMARY STATISTICS ==='
SELECT
    hebcal_match_type,
    COUNT(*) as tag_count
FROM zman_tags
WHERE hebcal_match_type IS NOT NULL
GROUP BY hebcal_match_type
ORDER BY hebcal_match_type;

\echo ''
\echo '=== ALL MAPPINGS ==='
SELECT * FROM v_hebcal_event_mappings;

SQL

echo
echo "✓ HebCal matching tests complete"
