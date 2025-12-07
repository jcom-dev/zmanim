-- ============================================================================
-- Machzikei Hadass Manchester Publisher Seed Data
-- ============================================================================
-- This file contains all the data needed to set up the Machzikei Hadass
-- Manchester publisher in a fresh Zmanim Lab database.
--
-- Prerequisites:
--   1. Run the schema migration (00000000000001_schema.sql)
--   2. Run the seed data migration (00000000000002_seed_data.sql)
--
-- Usage:
--   PGPASSWORD=your_password psql -h host -p port -U user -d database -f seed_publisher.sql
-- ============================================================================

-- ============================================================================
-- SEEDING OPTIMIZATIONS
-- ============================================================================
-- Disable all triggers for faster bulk inserts
SET session_replication_role = 'replica';
SET synchronous_commit = OFF;
SET work_mem = '256MB';

-- ============================================================================
-- PUBLISHER
-- ============================================================================

INSERT INTO publishers (
    id,
    name,
    email,
    phone,
    website,
    description,
    logo_url,
    location,
    latitude,
    longitude,
    timezone,
    status,
    verification_token,
    verified_at,
    clerk_user_id,
    is_published,
    created_at,
    updated_at,
    bio,
    slug,
    is_verified,
    logo_data,
    is_certified,
    suspension_reason,
    deleted_at,
    deleted_by
) VALUES (
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'Machzikei Hadass - Manchester',
    'publications@mhmanchester.org.uk',
    NULL,
    NULL,
    'Official zmanim publisher for Machzikei Hadass Manchester community. Calculations based on nearly 80 years of community practice following the rulings of Minchas Yitzchak and local minhag.',
    NULL,
    NULL,
    53.4808,
    -2.2426,
    'Europe/London',
    'active',
    NULL,
    NULL,
    NULL,  -- Set this to a valid Clerk user ID if needed
    true,
    NOW(),
    NOW(),
    NULL,
    'machzikei-hadass-manchester',
    true,
    NULL,  -- Logo data omitted for brevity; can be added separately
    false,
    NULL,
    NULL,
    NULL
);

-- ============================================================================
-- ALGORITHM
-- ============================================================================

INSERT INTO algorithms (
    id,
    publisher_id,
    name,
    description,
    config,
    status,
    is_default,
    version,
    formula_cache,
    revision,
    created_at,
    updated_at
) VALUES (
    'ac0fcfb7-58cd-4e35-9ca4-1a36f4289687',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'Manchester Machzikei Hadass Standard',
    'Official zmanim calculation method for Machzikei Hadass Manchester community. Based on nearly 80 years of community practice, following Minchas Yitzchak 9:9 for Dawn at 12° and custom MGA calculations.',
    '{
        "notes": "Per Minchas Yitzchak, 12° dawn corresponds with reality in Northern Europe. Candle lighting 15 min before sunset is ancient custom.",
        "mga_base": {"end": "7.08_degrees", "start": "12_degrees"},
        "nightfall": "7.08_degrees",
        "misheyakir": "11.5_degrees",
        "primary_dawn": "12_degrees",
        "shabbos_ends": "8_degrees",
        "secondary_dawn": "16.1_degrees",
        "candle_lighting_offset": 15
    }'::jsonb,
    'published',
    true,
    NULL,
    NULL,
    0,
    NOW(),
    NOW()
);

-- ============================================================================
-- PUBLISHER ZMANIM
-- ============================================================================
-- Note: These are the zmanim configurations for this publisher.
-- They link to master_zmanim_registry entries via master_zman_id.

-- Alos HaShachar 1 (16.1°) - Primary Dawn for stringencies
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '9d708db2-368b-44ec-8313-dd1aa8b4f30a',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'alos_hashachar',
    'עלות השחר א׳',
    'Alos HaShachar 1',
    'solar(16.1, before_sunrise)',
    1,
    'Per Vilna Gaon and Siddur of the Rav. 72 minutes before sunrise in Eretz Yisrael during Nissan/Tishrei. Used as stringency for nighttime mitzvos like evening Shema and counting of the Omer. In polar summer (May-July), the sun does not descend to 16.1° in Manchester, so midnight is used.',
    true, true, true, false, 'essential', '{}',
    'ada9beca-6052-4150-9d22-6a875582e3dc',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Alos HaShachar Aleph',
    'Sun 16.1° below horizon. In polar summer (May-July), the sun does not descend to 16.1° in Manchester, so midnight (chatzos layla) is printed as dawn.'
);

-- Alos HaShachar 2 (12°) - PRIMARY dawn for Manchester MGA
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '1eb0ec06-eb8c-4a9b-a1b1-4370b8e76567',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'alos_12',
    'עלות השחר ב׳',
    'Alos HaShachar 2',
    'solar(12, before_sunrise)',
    2,
    'This has been the practice in the Manchester community for nearly 80 years since its founding. This is the PRIMARY dawn used for MGA calculations.',
    true, true, true, false, 'essential', '{}',
    '17a26364-11ca-4b16-9e29-18bdba18cf25',
    1, NULL, NULL, NOW(), NOW(), NULL, 'registry', false, NULL,
    'Alos HaShachar Beis',
    'Sun 12° below horizon. Per Minchas Yitzchak 9:9, this corresponds with reality in Northern Europe.'
);

-- Alos 72 minutes
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '73e3f134-386d-4444-9903-23b65124afd0',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'alos_72',
    'עלות 72 דק׳',
    'Alos 72 min',
    'sunrise - 72min',
    3,
    'For those whose custom it is. Some add in summer to account for mil being 22.5 min, making dawn 90 min before sunrise.',
    true, true, true, false, 'optional', '{}',
    'c2b8088d-da9f-4753-a245-eb2ba2346870',
    1, NULL, NULL, NOW(), NOW(), NULL, 'registry', false, NULL,
    'Alos 72 Dakos',
    '72 fixed minutes before sunrise throughout the year.'
);

-- Alos 90 minutes
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    'ebc33b7c-5b48-413a-85de-7e5b90b9a7df',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'alos_90',
    'עלות 90 דק׳',
    'Alos 90 min',
    'sunrise - 90min',
    4,
    'Some add in summer to account for the measure of a mil being 22.5 minutes.',
    true, true, true, false, 'optional', '{}',
    'ad46eeac-4a01-43f6-bb59-2e99c0c39824',
    1, NULL, NULL, NOW(), NOW(), NULL, 'registry', false, NULL,
    'Alos 90 Dakos',
    '90 fixed minutes before sunrise. For those who calculate a mil as 22.5 minutes (4 x 22.5 = 90).'
);

-- Misheyakir
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '8bdb8225-9580-4df1-b477-93620e51cc30',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'misheyakir',
    'משיכיר',
    'Misheyakir',
    'solar(11.5, before_sunrise)',
    5,
    'In pressing circumstances (e.g., traveling), one may put on tallis 2 degrees earlier.',
    true, true, true, false, 'essential', '{}',
    'fee6ae15-91bb-401d-be34-4a7256ed32cb',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Misheyakir',
    'Earliest time for tallis and tefillin with a blessing. The printed time is 15 minutes after the actual misheyakir time.'
);

-- Sunrise
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    'd844f0a4-3b01-4cc8-a0a8-8226f7073c23',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sunrise',
    'הנץ',
    'HaNetz',
    'sunrise',
    6,
    NULL,
    true, true, true, false, 'essential', '{}',
    '10d89e97-e29b-4a0c-8775-04ccd6c15ba3',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'HaNetz',
    'The time when the upper edge of the sun rises above the horizon at sea level.'
);

-- Sof Zman Shema GRA
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sof_zman_shma_gra',
    'ס״ז ק״ש-גר״א',
    'Sof Zman K"Sh GRA',
    'proportional_hours(3, gra)',
    7,
    NULL,
    true, true, true, false, 'essential', '{}',
    'a03df06c-8cca-4115-9ff1-4bc04e759ffc',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Sof Zman Krias Shema GRA',
    'Latest time for Shema according to Vilna Gaon and Rabbi Zalman. One quarter of the day from sunrise to sunset.'
);

-- Sof Zman Shema MGA (Manchester custom - 12° to 7.08°)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sof_zman_shma_mga',
    'ס״ז ק״ש-מג״א',
    'Sof Zman K"Sh MGA',
    'proportional_hours(3, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    8,
    'On Shabbos, additional stringency times are printed from Dawn 1 (16.1°).',
    true, true, true, false, 'essential', '{}',
    '7faef612-5f93-4cb0-bf4d-b6ad67f22583',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Sof Zman Krias Shema MGA',
    'Per Manchester Beth Din / Minchas Yitzchak using 12° dawn and 7.08° nightfall'
);

-- Sof Zman Tfila GRA
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sof_zman_tfila_gra',
    'ס״ז תפלה-גר״א',
    'Sof Zman Tefila GRA',
    'proportional_hours(4, gra)',
    9,
    NULL,
    true, true, true, false, 'essential', '{}',
    '31ef5cc3-e541-4750-b78b-99840dc7a372',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Sof Zman Tefila GRA',
    'Latest time for morning prayer according to Vilna Gaon. One third of the day from sunrise to sunset.'
);

-- Sof Zman Tfila MGA (Manchester custom)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sof_zman_tfila_mga',
    'ס״ז תפלה-מג״א',
    'Sof Zman Tefila MGA',
    'proportional_hours(4, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    10,
    'For those using 72 min dawn, this is always 24 min before GRA time.',
    true, true, true, false, 'essential', '{}',
    'b32f320e-4fe5-4ba1-99db-78ad7b65cb66',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Sof Zman Tefila MGA',
    'Per Manchester Beth Din / Minchas Yitzchak using 12° dawn and 7.08° nightfall'
);

-- Chatzos (Midday)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'chatzos',
    'חצות',
    'Chatzos',
    'solar_noon',
    11,
    'Per Igros Moshe, OC 2:20. May vary by one minute.',
    true, true, true, false, 'essential', '{}',
    '5c1806a7-5c5f-4231-8ea6-f2821a3f74ff',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Chatzos',
    'The time when the sun stands at highest point between east and west. Half the time between sunrise and sunset.'
);

-- Mincha Gedola
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'mincha_gedola',
    'מנחה גדולה',
    'Mincha Gedola',
    'solar_noon + 30min',
    12,
    'The practice is to be stringent - in winter when the proportional half-hour is less than 30 minutes, we use 30 minutes.',
    true, true, true, false, 'essential', '{}',
    'a56cc3c5-2210-4945-8c48-85cd0b48d936',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Mincha Gedola',
    'Earliest time for afternoon prayer. Half a proportional hour after midday, but no less than 30 minutes.'
);

-- Mincha Ketana
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '1c6e84f2-c916-4111-817b-f37195beaa28',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'mincha_ketana',
    'מנחה קטנה',
    'Mincha Ketana',
    'proportional_hours(9.5, gra)',
    13,
    NULL,
    true, true, true, false, 'essential', '{}',
    '8506c62a-2f48-42b4-a02f-0b18b8e8478c',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Mincha Ketana',
    'Two and a half proportional hours before sunset.'
);

-- Plag HaMincha (Levush/GRA)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'plag_hamincha',
    'פלג - לבוש',
    'Plag - Levush',
    'proportional_hours(10.75, gra)',
    14,
    NULL,
    true, true, true, false, 'essential', '{}',
    'b4e6778c-cb14-4fe5-b3e8-99c85a19606c',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Plag HaMincha Levush',
    'Earliest time for Maariv, lighting Shabbos candles, and Chanukah candles. One and a quarter proportional hours before sunset.'
);

-- Plag HaMincha (Terumas HaDeshen - Manchester custom)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'plag_hamincha_terumas_hadeshen',
    'פלג - תה״ד',
    'Plag - T"HD',
    'proportional_hours(10.75, custom(solar(12, before_sunrise), solar(7.08, after_sunset)))',
    15,
    'Per Terumas Hadeshen method.',
    true, true, true, false, 'essential', '{}',
    '072070ad-c303-4f36-a7ab-f5fee318fafb',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', true, NULL,
    'Plag HaMincha Terumas HaDeshen',
    'One and a quarter proportional hours before nightfall, calculating the day from Dawn 2 (12°) until nightfall (7.08°).'
);

-- Plag MA (72 min)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '2910fbc5-a95b-46c0-9188-d1bf4bc5f2ad',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'plag_hamincha_72',
    'פלג - מ״א',
    'Plag - MA',
    'proportional_hours(10.75, mga)',
    16,
    'Since the time for accepting Shabbos, printed for the community.',
    true, true, true, false, 'optional', '{}',
    'cfbd81d7-dbc7-4108-b71e-2d9e33dd1a7e',
    1, NULL, NULL, NOW(), NOW(), NULL, 'registry', false, NULL,
    'Plag HaMincha MA',
    'Plag HaMincha according to MA/Terumas Hadeshen practiced in many communities. One and a quarter proportional hours before nightfall, calculating 72 minutes before sunrise to 72 minutes after sunset.'
);

-- Candle Lighting
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '2f56205d-5999-4bc7-aeae-515493df8840',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'candle_lighting',
    'הדלקת נרות',
    'Hadlakas Neiros',
    'sunset - 15min',
    17,
    '15 minutes before sunset, as has been the custom from ancient times.',
    true, true, true, false, 'essential', '{}',
    '8b861617-e264-4542-a8db-01f7512cab7d',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Hadlakas Neiros',
    'Time for lighting Shabbos candles and accepting Shabbos.'
);

-- Sunset
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'sunset',
    'שקיעה',
    'Shkiah',
    'sunset',
    18,
    NULL,
    true, true, true, false, 'essential', '{}',
    'c92d8740-af5c-4298-a65d-ce5f64d76551',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Shkiah',
    'The time when the sun is completely hidden from our eyes. Time printed is slightly before actual to be safe.'
);

-- Tzais HaKochavim (7.08°)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'tzais_7_08',
    'צאת הכוכבים',
    'Tzais HaKochavim',
    'solar(7.08, after_sunset)',
    19,
    'For rabbinic fasts, one may be lenient by several minutes - consult a halachic authority.',
    true, true, true, false, 'essential', '{}',
    '7949f93d-c348-4e0c-99e9-743212ecb00b',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Tzais HaKochavim',
    'Time when three small consecutive stars are visible. Sun 7.08° below horizon.'
);

-- Motzei Shabbos (8°)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '77f0b621-a0c5-4e4d-872f-192b09ab66f0',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'shabbos_ends',
    'מוצש״ק',
    'Motzei Shabbos',
    'solar(8, after_sunset)',
    20,
    NULL,
    true, true, true, false, 'optional', '{}',
    '888f7113-4a77-44a1-aa1d-22cb297297a5',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Motzei Shabbos Kodesh',
    'End of Shabbos when three small consecutive stars are visible. Sun 8° below horizon.'
);

-- Tzais Rabbeinu Tam (72 min)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'tzais_72',
    'ר״ת',
    'R"T',
    'sunset + 72min',
    21,
    NULL,
    true, true, true, false, 'essential', '{}',
    'd156b928-3c35-4360-acc9-f767fe425f18',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Rabbeinu Tam',
    '72 minutes after sunset throughout the year, provided sun is at least 8° below horizon.'
);

-- Chatzos Layla (Midnight)
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '321a278b-db4e-40a3-a9d7-804e85a372df',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'chatzos_layla',
    'חצות לילה',
    'Chatzos Layla',
    'solar_noon + 12hr',
    22,
    'May vary by one minute from midday + 12 hours.',
    true, true, true, false, 'optional', '{}',
    '6af15b21-1fd8-4958-89d0-8e8df94c059f',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Chatzos Layla',
    'Midnight - 12 hours after midday. Per Igros Moshe OC 2:20.'
);

-- Fast Ends
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    '255dad2e-9688-4e08-8a3f-357d1a85181a',
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'fast_ends',
    'סוף התענית',
    'Sof HaTaanis',
    'solar(7.08, after_sunset)',
    23,
    NULL,
    true, true, true, false, 'essential', '{}',
    '5873dd70-0a42-44e7-aba4-d0eeec0457a0',
    1, NULL, NULL, NOW(), NOW(), NULL, 'custom', false, NULL,
    'Sof HaTaanis',
    'End of fast. For rabbinic fasts, one may be lenient by several minutes.'
);

-- Fast Begins
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name, formula_dsl,
    sort_order, publisher_comment, is_enabled, is_visible, is_published,
    is_beta, category, tags, master_zman_id, version,
    linked_publisher_zman_id, algorithm_id, created_at, updated_at, deleted_at,
    source_type, is_custom, restored_at, transliteration, description
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'fast_begins',
    'התחלת התענית',
    'Haschalas HaTaanis',
    'solar(12, before_sunrise)',
    24,
    'Per Orach Chaim 564. Uses Dawn 2 (12°) as the cutoff.',
    true, true, true, false, 'essential', '{}',
    'a37ca4f4-a2a1-42d2-8d4e-4967e26707e8',
    1, NULL, NULL, NOW(), NOW(), NULL, 'registry', false, NULL,
    'Haschalas HaTaanis',
    'End time for eating in the morning on a minor fast day. One who sleeps and then wakes must stop eating at this time.'
);

-- ============================================================================
-- PUBLISHER COVERAGE
-- ============================================================================
-- By default, set coverage to United Kingdom (country level)
-- You may want to customize this for specific cities

INSERT INTO publisher_coverage (
    id,
    publisher_id,
    coverage_level,
    city_id,
    district_id,
    region_id,
    country_id,
    continent_code,
    is_primary,
    is_active,
    priority,
    notes,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '6c85458d-2225-4f55-bc15-5c9844bcf362',
    'country',
    NULL,
    NULL,
    NULL,
    (SELECT id FROM geo_countries WHERE iso_code = 'GB' LIMIT 1),
    'EU',
    true,
    true,
    100,
    'Default coverage for United Kingdom',
    NOW(),
    NOW()
);

-- ============================================================================
-- RESTORE SETTINGS
-- ============================================================================
SET session_replication_role = 'origin';
SET synchronous_commit = ON;
RESET work_mem;

-- ============================================================================
-- NOTES ON USAGE
-- ============================================================================
--
-- This seed file creates a fully functional publisher with:
--   1. Publisher profile (Machzikei Hadass Manchester)
--   2. Algorithm configuration (standard method with 12° dawn, 7.08° nightfall)
--   3. ~24 zmanim entries covering all essential and optional times
--   4. Country-level coverage for United Kingdom
--
-- The Manchester community's unique characteristics:
--   - PRIMARY dawn at 12° (per Minchas Yitzchak 9:9)
--   - Secondary dawn at 16.1° (stringency)
--   - Nightfall at 7.08° for everyday tzais
--   - Shabbos ends at 8°
--   - Candle lighting 15 minutes before sunset (ancient custom)
--   - MGA calculations use 12° dawn and 7.08° nightfall
--
-- For more information, see the "Calculation of Times" document in this folder.
-- ============================================================================
