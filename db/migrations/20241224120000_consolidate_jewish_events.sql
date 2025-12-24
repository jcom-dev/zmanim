-- +migrate Up
-- ============================================================================
-- Consolidate jewish_events into zman_tags
-- ============================================================================
-- Phase 1 Analysis confirmed:
-- - NO columns need to be added to zman_tags (duration/fast_start logic is HARDCODED in Go)
-- - NO foreign keys reference these tables
-- - The /api/v1/calendar/events endpoint was NEVER registered (dead code)
-- - Tables are safe to drop
-- ============================================================================

-- Drop tables in correct order (jewish_events has references to other tables)
DROP TABLE IF EXISTS jewish_events CASCADE;
DROP TABLE IF EXISTS jewish_event_types CASCADE;
DROP TABLE IF EXISTS fast_start_types CASCADE;
DROP TABLE IF EXISTS event_categories CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS jewish_events_id_seq CASCADE;
DROP SEQUENCE IF EXISTS jewish_event_types_id_seq CASCADE;
DROP SEQUENCE IF EXISTS event_categories_id_seq CASCADE;

-- +migrate Down
-- ============================================================================
-- Restore jewish_events tables and seed data
-- ============================================================================

-- Recreate event_categories table
CREATE TABLE event_categories (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    icon_name VARCHAR(50),
    color VARCHAR(50),
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate fast_start_types table
CREATE TABLE fast_start_types (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key VARCHAR(20) NOT NULL,
    display_name_hebrew TEXT NOT NULL,
    display_name_english TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate jewish_event_types table
CREATE TABLE jewish_event_types (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key VARCHAR(30) NOT NULL,
    display_name_hebrew TEXT NOT NULL,
    display_name_english TEXT NOT NULL,
    description TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate jewish_events table
CREATE TABLE jewish_events (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_hebrew TEXT NOT NULL,
    name_english TEXT NOT NULL,
    event_type_id SMALLINT NOT NULL,
    duration_days_israel INTEGER DEFAULT 1,
    duration_days_diaspora INTEGER DEFAULT 1,
    fast_start_type_id SMALLINT,
    parent_event_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Restore event_categories seed data
INSERT INTO event_categories (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, created_at) VALUES
(21, 'havdalah', 'הבדלה', 'Havdalah', 'End of Shabbos and Yom Tov', 'Flame', 'purple', 2, '2025-12-14 19:08:39.823519+00'),
(22, 'candles', 'הדלקת נרות', 'Candle Lighting', 'Shabbos, Yom Tov, and Yom Kippur', 'Flame', 'amber', 1, '2025-12-14 19:08:39.823519+00'),
(146, 'pesach', 'פסח', 'Pesach', 'Chametz eating and burning times', 'Utensils', 'green', 6, '2025-12-14 19:08:39.823519+00'),
(207, 'fast_day', 'תענית', 'Fast Days', 'Fast end times (regular fasts)', 'Timer', 'gray', 4, '2025-12-14 19:08:39.823519+00'),
(213, 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'Fast starts at sunset, ends at nightfall', 'Moon', 'slate', 5, '2025-12-14 19:08:39.823519+00'),
(248, 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'Fast start and end times', 'Moon', 'slate', 3, '2025-12-14 19:08:39.823519+00');

-- Restore fast_start_types seed data
INSERT INTO fast_start_types (id, key, display_name_hebrew, display_name_english, created_at) OVERRIDING SYSTEM VALUE VALUES
(1, 'dawn', 'עלות השחר', 'Dawn', '2025-12-14 19:08:39.792189+00'),
(2, 'sunset', 'שקיעה', 'Sunset', '2025-12-14 19:08:39.792189+00');

-- Restore jewish_event_types seed data
INSERT INTO jewish_event_types (id, key, display_name_hebrew, display_name_english, description, sort_order, created_at) OVERRIDING SYSTEM VALUE VALUES
(1, 'weekly', 'שבועי', 'Weekly', 'Weekly recurring events', 1, '2025-12-14 19:08:39.790802+00'),
(2, 'yom_tov', 'יום טוב', 'Yom Tov', 'Major festivals', 2, '2025-12-14 19:08:39.790802+00'),
(3, 'fast', 'תענית', 'Fast', 'Fast days', 3, '2025-12-14 19:08:39.790802+00'),
(4, 'informational', 'מידע', 'Informational', 'Informational dates', 4, '2025-12-14 19:08:39.790802+00');

-- Restore jewish_events seed data
INSERT INTO jewish_events (id, code, name_hebrew, name_english, event_type_id, duration_days_israel, duration_days_diaspora, fast_start_type_id, parent_event_id, sort_order, created_at) VALUES
(8, 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', 4, 1, 1, NULL, NULL, 152, '2025-12-14 19:08:39.811436+00'),
(35, 'shabbos', 'שבת', 'Shabbos', 1, 1, 1, NULL, NULL, 10, '2025-12-14 19:08:39.811436+00'),
(36, 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', 3, 1, 1, 1, NULL, 32, '2025-12-14 19:08:39.811436+00'),
(39, 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', 3, 1, 1, 1, NULL, 31, '2025-12-14 19:08:39.811436+00'),
(76, 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 4, 1, 1, NULL, NULL, 100, '2025-12-14 19:08:39.811436+00'),
(81, 'yom_kippur', 'יום כיפור', 'Yom Kippur', 3, 1, 1, 2, NULL, 20, '2025-12-14 19:08:39.811436+00'),
(90, 'lag_baomer', 'ל"ג בעומר', 'Lag BaOmer', 4, 1, 1, NULL, NULL, 130, '2025-12-14 19:08:39.811436+00'),
(91, 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 2, 2, 2, NULL, NULL, 40, '2025-12-14 19:08:39.811436+00'),
(104, 'shushan_purim', 'שושן פורים', 'Shushan Purim', 4, 1, 1, NULL, NULL, 121, '2025-12-14 19:08:39.811436+00'),
(106, 'shavuos', 'שבועות', 'Shavuos', 2, 1, 2, NULL, NULL, 70, '2025-12-14 19:08:39.811436+00'),
(109, 'pesach_last', 'פסח (אחרון)', 'Pesach (Last Days)', 2, 1, 2, NULL, NULL, 61, '2025-12-14 19:08:39.811436+00'),
(110, 'chanukah', 'חנוכה', 'Chanukah', 4, 8, 8, NULL, NULL, 110, '2025-12-14 19:08:39.811436+00'),
(111, 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 3, 1, 1, 1, NULL, 33, '2025-12-14 19:08:39.811436+00'),
(124, 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', 4, 1, 1, NULL, NULL, 150, '2025-12-14 19:08:39.811436+00'),
(152, 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', 2, 1, 2, NULL, NULL, 51, '2025-12-14 19:08:39.811436+00'),
(193, 'pesach_first', 'פסח (ראשון)', 'Pesach (First Days)', 2, 1, 2, NULL, NULL, 60, '2025-12-14 19:08:39.811436+00'),
(203, 'sukkos', 'סוכות', 'Sukkos', 2, 1, 2, NULL, NULL, 50, '2025-12-14 19:08:39.811436+00'),
(224, 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', 4, 1, 1, NULL, NULL, 151, '2025-12-14 19:08:39.811436+00'),
(230, 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 3, 1, 1, 2, NULL, 21, '2025-12-14 19:08:39.811436+00'),
(253, 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 3, 1, 1, 1, NULL, 30, '2025-12-14 19:08:39.811436+00'),
(263, 'yom_hashoah', 'יום השואה', 'Yom HaShoah', 4, 1, 1, NULL, NULL, 153, '2025-12-14 19:08:39.811436+00'),
(277, 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 4, 1, 1, NULL, NULL, 140, '2025-12-14 19:08:39.811436+00'),
(284, 'purim', 'פורים', 'Purim', 4, 1, 1, NULL, NULL, 120, '2025-12-14 19:08:39.811436+00');

-- Reset sequences to maintain ID continuity
SELECT setval('event_categories_id_seq', (SELECT MAX(id) FROM event_categories));
SELECT setval('fast_start_types_id_seq', (SELECT MAX(id) FROM fast_start_types));
SELECT setval('jewish_event_types_id_seq', (SELECT MAX(id) FROM jewish_event_types));
SELECT setval('jewish_events_id_seq', (SELECT MAX(id) FROM jewish_events));
