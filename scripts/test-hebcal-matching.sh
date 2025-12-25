#!/bin/bash
# Test HebCal event matching after migration

set -e

source "$(dirname "$0")/../api/.env"

echo "Testing HebCal Event Matching..."
echo "=================================="
echo

# Test cases from hebcal-events-complete.csv
psql "$DATABASE_URL" <<'SQL'
-- Test exact matches
SELECT 'EXACT MATCHES:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Purim'),
    ('Lag BaOmer'),
    ('Yom Kippur'),
    ('Erev Pesach'),
    ('Shmini Atzeret'),
    ('Simchat Torah')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test pattern matches - Chanukah
SELECT '' as blank, 'CHANUKAH PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Chanukah: 1 Candle'),
    ('Chanukah: 8 Candles'),
    ('Chanukah: 8th Day')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test pattern matches - Pesach (should NOT match Pesach Sheni)
SELECT '' as blank, 'PESACH PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Pesach I'),
    ('Pesach II'),
    ('Pesach III (CH''M)'),
    ('Pesach VII'),
    ('Pesach Sheni')  -- Should match pesach_sheni, NOT pesach
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test pattern matches - Rosh Hashana
SELECT '' as blank, 'ROSH HASHANA PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Rosh Hashana 5785'),
    ('Rosh Hashana 5786'),
    ('Rosh Hashana II')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test pattern matches - Sukkot
SELECT '' as blank, 'SUKKOT PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Sukkot I'),
    ('Sukkot II'),
    ('Sukkot VII (Hoshana Raba)')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Tisha B'Av (should match both regular and observed, but NOT Erev)
SELECT '' as blank, 'TISHA B''AV PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Tish''a B''Av'),
    ('Tish''a B''Av (observed)'),
    ('Erev Tish''a B''Av')  -- Should match erev_tisha_bav, NOT tisha_bav
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Shavuot
SELECT '' as blank, 'SHAVUOT PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Shavuot I'),
    ('Shavuot II')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Rosh Chodesh
SELECT '' as blank, 'ROSH CHODESH PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Rosh Chodesh Nisan'),
    ('Rosh Chodesh Adar II'),
    ('Rosh Chodesh Tevet')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Mevarchim Chodesh
SELECT '' as blank, 'MEVARCHIM CHODESH PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Mevarchim Chodesh Nisan'),
    ('Mevarchim Chodesh Adar II')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Parashat
SELECT '' as blank, 'PARASHAT PATTERNS:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Parashat Bereshit'),
    ('Parashat Vayakhel-Pekudei'),
    ('Parashat Nitzavim-Vayeilech')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Test Special Shabbatot
SELECT '' as blank, 'SPECIAL SHABBATOT:' as test_section;
SELECT hebcal_event, tag_key, match_type
FROM (VALUES
    ('Shabbat HaGadol'),
    ('Shabbat Zachor'),
    ('Shabbat Shekalim')
) AS tests(hebcal_event)
CROSS JOIN LATERAL match_hebcal_event_to_tags(hebcal_event);

-- Verification: Count total tags created
SELECT '' as blank, 'SUMMARY:' as test_section;
SELECT 'Total event tags created:' as metric, COUNT(*) as count
FROM zman_tags WHERE tag_type_id = 170;

SELECT 'Tags with exact match:' as metric, COUNT(*) as count
FROM zman_tags WHERE tag_type_id = 170 AND hebcal_exact_match = TRUE;

SELECT 'Tags with pattern match:' as metric, COUNT(*) as count
FROM zman_tags WHERE tag_type_id = 170 AND hebcal_match_pattern IS NOT NULL;
SQL

echo
echo "✓ HebCal matching tests complete"
