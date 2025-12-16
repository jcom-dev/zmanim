-- ============================================================================
-- MACHZIKEI HADAS - MANCHESTER PUBLISHER EXPORT
-- ============================================================================
-- Generated: 2025-12-07 22:10:16
-- Publisher: Machzikei Hadass - Manchester
-- Email: dniasoff@gmail.com
--
-- USAGE:
-- 1. Ensure target database has the same schema (run migrations first)
-- 2. Execute this script: psql -d target_db -f machzikei_hadas_export.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PUBLISHER
-- ============================================================================

-- Insert publisher (will update if email already exists)
INSERT INTO publishers (
    name, email, phone, website, description,
    latitude, longitude, timezone,
    status_id, is_published, bio, slug, is_verified, is_certified
) VALUES (
    'Machzikei Hadass - Manchester',
    'dniasoff@gmail.com',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    (SELECT id FROM publisher_statuses WHERE key = 'active'),
    false,
    NULL,
    NULL,
    false,
    false
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    timezone = EXCLUDED.timezone,
    slug = EXCLUDED.slug;


-- ============================================================================
-- ALGORITHMS
-- ============================================================================

-- Insert algorithm
INSERT INTO algorithms (
    publisher_id, name, description, configuration, is_public, fork_count
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'Manchester Machzikei Hadass Standard',
    'Official zmanim calculation method for Machzikei Hadass Manchester community. Based on nearly 80 years of community practice, following Minchas Yitzchak 9:9 for Dawn at 12° and custom MGA calculations.',
    '{"notes": "Per Minchas Yitzchak, 12° dawn corresponds with reality in Northern Europe. Candle lighting 15 min before sunset is ancient custom.", "mga_base": {"end": "7.08_degrees", "start": "12_degrees"}, "nightfall": "7.08_degrees", "misheyakir": "11.5_degrees", "primary_dawn": "12_degrees", "shabbos_ends": "8_degrees", "secondary_dawn": "16.1_degrees", "candle_lighting_offset": 15}'::jsonb,
    false,
    0
);


-- ============================================================================
-- PUBLISHER ZMANIM
-- ============================================================================

-- Insert publisher zmanim (27 records)
INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'alos_12',
    'עלות השחר ב׳',
    'Alos HaShachar 2',
    'solar(12, before_sunrise)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_12'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Alos HaShachar Beis',
    'Sun 12° below horizon. Per Minchas Yitzchak 9:9, this corresponds with reality in Northern Europe.',
    'This has been the practice in the Manchester community for nearly 80 years since its founding. This is the PRIMARY dawn used for MGA calculations.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'alos_72',
    'עלות 72 דק׳',
    'Alos 72 min',
    'sunrise - 72min',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Alos 72 Dakos',
    '72 fixed minutes before sunrise throughout the year.',
    'For those whose custom it is. Some add in summer to account for mil being 22.5 min, making dawn 90 min before sunrise.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'alos_90',
    'עלות 90 דק׳',
    'Alos 90 min',
    'sunrise - 90min',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_90'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Alos 90 Dakos',
    '90 fixed minutes before sunrise. For those who calculate a mil as 22.5 minutes (4 x 22.5 = 90).',
    'Some add in summer to account for the measure of a mil being 22.5 minutes.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'alos_hashachar',
    'עלות השחר א׳',
    'Alos HaShachar 1',
    'if (month >= 5 && month <= 7 && latitude > 50) { solar_noon } else { solar(16.1, before_sunrise) }',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_hashachar'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Alos HaShachar Aleph',
    'Sun 16.1° below horizon. In polar summer (May-July), the sun does not descend to 16.1° in Manchester, so midnight (chatzos layla) is printed as dawn.',
    'Per Vilna Gaon and Siddur of the Rav. 72 minutes before sunrise in Eretz Yisrael during Nissan/Tishrei. Used as stringency for nighttime mitzvos like evening Shema and counting of the Omer. In polar summer, midnight is used as the dawn time.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'alos_shemini_atzeres',
    'עלות לערבות',
    'Alos for Aravos',
    'proportional_hours(-1.5, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    true,
    true,
    true,
    true,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_shemini_atzeres'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Alos LaAravos',
    'Dawn calculated as 1/8th of the day before sunrise, using the Manchester day definition (12° to 7.08°).',
    'Printed by the Minchas Yitzchak as a stringency.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'candle_lighting',
    'הדלקת נרות',
    'Hadlakas Neiros',
    'sunset - 15min',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Hadlakas Neiros',
    'Time for lighting Shabbos candles and accepting Shabbos.',
    '15 minutes before sunset, as has been the custom from ancient times.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'chatzos',
    'חצות',
    'Chatzos',
    'solar_noon',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'chatzos'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Chatzos',
    'The time when the sun stands at highest point between east and west. Half the time between sunrise and sunset. Midnight is 12 hours after.',
    'Per Igros Moshe, OC 2:20. May vary by one minute.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'chatzos_layla',
    'חצות לילה',
    'Chatzos Layla',
    'solar_noon + 12hr',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'chatzos_layla'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Chatzos Layla',
    'Midnight - 12 hours after midday. Per Igros Moshe OC 2:20.',
    'May vary by one minute from midday + 12 hours.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'fast_begins',
    'התחלת התענית',
    'Haschalas HaTaanis',
    'solar(12, before_sunrise)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Haschalas HaTaanis',
    'End time for eating in the morning on a minor fast day. One who sleeps and then wakes must stop eating at this time.',
    'Per Orach Chaim 564. Uses Dawn 2 (12°) as the cutoff.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'fast_ends',
    'סוף התענית',
    'Sof HaTaanis',
    'solar(7.08, after_sunset)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof HaTaanis',
    'End of fast. For rabbinic fasts, one may be lenient by several minutes.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'mincha_gedola',
    'מנחה גדולה',
    'Mincha Gedola',
    'if ((proportional_hours(6.5, gra) - solar_noon) > 30min) { proportional_hours(6.5, gra) } else { solar_noon + 30min }',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Mincha Gedola',
    'Earliest time for afternoon prayer. Half a proportional hour after midday, but no less than 30 minutes.',
    'The practice is to be stringent - in winter when the proportional half-hour is less than 30 minutes, we use 30 minutes.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'mincha_ketana',
    'מנחה קטנה',
    'Mincha Ketana',
    'proportional_hours(9.5, gra)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Mincha Ketana',
    'Two and a half proportional hours before sunset.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'misheyakir',
    'משיכיר',
    'Misheyakir',
    'solar(11.5, before_sunrise) + 15min',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Misheyakir',
    'Earliest time for tallis and tefillin with a blessing. The printed time is 15 minutes after the actual misheyakir time.',
    'In pressing circumstances (e.g., traveling), one may put on tallis 2 degrees earlier.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'plag_hamincha',
    'פלג - לבוש',
    'Plag - Levush',
    'proportional_hours(10.75, gra)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Plag HaMincha Levush',
    'Earliest time for Maariv, lighting Shabbos candles, and Chanukah candles. One and a quarter proportional hours before sunset.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'plag_hamincha_72',
    'פלג - מ״א',
    'Plag - MA',
    'proportional_hours(10.75, mga)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_72'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Plag HaMincha MA',
    'Plag HaMincha according to MA/Terumas Hadeshen practiced in many communities. One and a quarter proportional hours before nightfall, calculating 72 minutes before sunrise to 72 minutes after sunset.',
    'Since the time for accepting Shabbos, printed for the community.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'plag_hamincha_terumas_hadeshen',
    'פלג - תה״ד',
    'Plag - T"HD',
    'proportional_hours(10.75, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    true,
    true,
    true,
    true,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_terumas_hadeshen'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Plag HaMincha Terumas HaDeshen',
    'One and a quarter proportional hours before nightfall, calculating the day from Dawn 2 (12°) until nightfall (7.08°).',
    'Per Terumas Hadeshen method.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'shabbos_ends',
    'מוצש״ק',
    'Motzei Shabbos',
    'solar(8, after_sunset)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Motzei Shabbos Kodesh',
    'End of Shabbos when three small consecutive stars are visible. Sun 8° below horizon.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_shma_gra',
    'ס״ז ק״ש-גר״א',
    'Sof Zman K"Sh GRA',
    'proportional_hours(3, gra)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_gra'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Krias Shema GRA',
    'Latest time for Shema according to Vilna Gaon and Rabbi Zalman. One quarter of the day from sunrise to sunset.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_shma_mga',
    'ס״ז ק״ש-מג״א',
    'Sof Zman K"Sh MGA',
    'proportional_hours(3, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Krias Shema MGA',
    'Per Manchester Beth Din / Minchas Yitzchak using 12° dawn and 7.08° nightfall',
    'On Shabbos, additional stringency times are printed from Dawn 1 (16.1°).'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_shma_mga_16_1',
    'ס״ז ק״ש מ״א (16.1°)',
    'Sof Zman K"Sh MA (16.1°)',
    'proportional_hours(3, custom(solar(16.1, before_sunrise), solar(16.1, after_sunset)))',
    true,
    true,
    true,
    true,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_16_1'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Krias Shema MA 16.1',
    'Stringency from Dawn 1 (16.1°) to nightfall at 16.1°, so beginning and end of day are equal.',
    'Printed on Shabbos as additional stringency for Torah-level Shema obligation.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_shma_mga_72',
    'ס״ז ק״ש מ״א (72)',
    'Sof Zman K"Sh MA (72min)',
    'proportional_hours(3, mga)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_72'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Krias Shema MA 72',
    '72 min before sunrise to 72 min after sunset. Always 36 minutes before GRA time.',
    'Practiced in many communities.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_tfila_gra',
    'ס״ז תפלה-גר״א',
    'Sof Zman Tefila GRA',
    'proportional_hours(4, gra)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_gra'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Tefila GRA',
    'Latest time for morning prayer according to Vilna Gaon. One third of the day from sunrise to sunset.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sof_zman_tfila_mga',
    'ס״ז תפלה-מג״א',
    'Sof Zman Tefila MGA',
    'proportional_hours(4, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Sof Zman Tefila MGA',
    'Per Manchester Beth Din / Minchas Yitzchak using 12° dawn and 7.08° nightfall',
    'For those using 72 min dawn, this is always 24 min before GRA time.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sunrise',
    'הנץ',
    'HaNetz',
    'sunrise',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sunrise'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'HaNetz',
    'The time when the upper edge of the sun rises above the horizon at sea level.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'sunset',
    'שקיעה',
    'Shkiah',
    'sunset',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'sunset'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Shkiah',
    'The time when the sun is completely hidden from our eyes. Time printed is slightly before actual to be safe.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'tzais_7_08',
    'צאת הכוכבים',
    'Tzais HaKochavim',
    'solar(7.08, after_sunset)',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_7_08'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Tzais HaKochavim',
    'Time when three small consecutive stars are visible. Sun 7.08° below horizon.',
    'For rabbinic fasts, one may be lenient by several minutes - consult a halachic authority.'
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;

INSERT INTO publisher_zmanim (
    publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    is_enabled, is_visible, is_published, is_custom, is_beta,
    master_zman_id, source_type_id, transliteration, description, publisher_comment
) VALUES (
    (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
    'tzais_72',
    'ר״ת',
    'R"T',
    'if ((solar(8, after_sunset) - sunset) > 72min) { solar(8, after_sunset) } else { sunset + 72min }',
    true,
    true,
    true,
    false,
    false,
    (SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_72'),
    (SELECT id FROM zman_source_types WHERE key = 'custom'),
    'Rabbeinu Tam',
    '72 minutes after sunset throughout the year, provided sun is at least 8° below horizon.',
    NULL
)
ON CONFLICT (publisher_id, zman_key) DO UPDATE SET
    formula_dsl = EXCLUDED.formula_dsl,
    hebrew_name = EXCLUDED.hebrew_name,
    english_name = EXCLUDED.english_name;


-- ============================================================================


-- ============================================================================
-- PUBLISHER COVERAGE (OPTIONAL - REQUIRES MANUAL CONFIGURATION)
-- ============================================================================
-- 
-- NOTE: Coverage uses direct geographic IDs which may not exist in your database.
-- You have two options:
--
-- OPTION 1: Add coverage manually after import
--   Use the publisher management interface to add coverage areas
--
-- OPTION 2: Update the IDs below and uncomment
--   1. Find correct IDs in your database:
--      SELECT id, name FROM geo_cities WHERE name ILIKE '%manchester%';
--      SELECT id, name FROM geo_regions WHERE name ILIKE '%england%' OR name ILIKE '%greater manchester%';
--   2. Replace the IDs below
--   3. Uncomment the INSERT statements
--
-- Original coverage from source database:
--   - City ID: 1626940 (likely Manchester, England)
--   - Region ID: 1374 (likely Greater Manchester or England region)
--
-- ============================================================================
-- PUBLISHER COVERAGE
-- ============================================================================

-- Coverage: city
-- INSERT INTO publisher_coverage (
--     publisher_id, coverage_level_id,
--     city_id,
--     is_active, priority
-- ) VALUES (
--     (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
--     (SELECT id FROM coverage_levels WHERE key = 'city'),
--     1626940,  -- Note: city_id may need to be mapped in target DB
--     true,
--     5
-- )
-- ON CONFLICT DO NOTHING;

-- Coverage: region
-- INSERT INTO publisher_coverage (
--     publisher_id, coverage_level_id,
--     region_id,
--     is_active, priority
-- ) VALUES (
--     (SELECT id FROM publishers WHERE email = 'dniasoff@gmail.com'),
--     (SELECT id FROM coverage_levels WHERE key = 'region'),
--     1374,  -- Note: region_id may need to be mapped in target DB
--     true,
--     5
-- )
-- ON CONFLICT DO NOTHING;


COMMIT;

\echo 'Machzikei Hadas publisher import complete!'
\echo 'Publisher: Machzikei Hadass - Manchester'
\echo 'Algorithms: 1'
\echo 'Zmanim: 27'
\echo 'Coverage: 2 areas (city + region)'
