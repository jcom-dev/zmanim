-- Migration: Seed Data
-- Description: Core reference data for Zmanim Lab (no publisher data)

-- ============================================================================
-- SEEDING OPTIMIZATIONS
-- ============================================================================
-- Disable all triggers for faster bulk inserts (no trigger overhead)
-- This is safe for seeding because:
--   1. We're inserting clean, validated reference data
--   2. No FK violations possible (insert order respects dependencies)
--   3. updated_at triggers are only needed for UPDATE, not INSERT
SET session_replication_role = 'replica';

-- Disable synchronous commit for faster WAL writes during bulk insert
SET synchronous_commit = OFF;

-- Increase work_mem for this session (helps with index maintenance)
SET work_mem = '256MB';

-- ============================================================================
-- LOOKUP TABLES (must be seeded first - referenced by FKs)
-- ============================================================================

-- Publisher Statuses
INSERT INTO publisher_statuses (key, display_name_hebrew, display_name_english, description, color, sort_order) VALUES
('pending', 'ממתין', 'Pending', 'Awaiting approval', '#FFA500', 1),
('active', 'פעיל', 'Active', 'Active and visible', '#22C55E', 2),
('suspended', 'מושעה', 'Suspended', 'Temporarily suspended', '#EF4444', 3),
('inactive', 'לא פעיל', 'Inactive', 'Deactivated by user', '#6B7280', 4);

-- Algorithm Statuses
INSERT INTO algorithm_statuses (key, display_name_hebrew, display_name_english, description, color, sort_order) VALUES
('draft', 'טיוטה', 'Draft', 'Work in progress', '#6B7280', 1),
('active', 'פעיל', 'Active', 'Currently in use', '#22C55E', 2),
('archived', 'בארכיון', 'Archived', 'No longer in use', '#9CA3AF', 3);

-- AI Index Statuses
INSERT INTO ai_index_statuses (key, display_name_hebrew, display_name_english, description, color, sort_order) VALUES
('pending', 'ממתין', 'Pending', 'Waiting to be indexed', '#FFA500', 1),
('indexing', 'מאנדקס', 'Indexing', 'Currently being indexed', '#3B82F6', 2),
('completed', 'הושלם', 'Completed', 'Successfully indexed', '#22C55E', 3),
('failed', 'נכשל', 'Failed', 'Indexing failed', '#EF4444', 4);

-- AI Content Sources
INSERT INTO ai_content_sources (key, display_name_hebrew, display_name_english, description) VALUES
('master_zmanim_registry', 'רשם זמנים ראשי', 'Master Zmanim Registry', 'Canonical zmanim definitions'),
('publisher_zmanim', 'זמני מפרסמים', 'Publisher Zmanim', 'Publisher-specific zmanim'),
('algorithms', 'אלגוריתמים', 'Algorithms', 'Algorithm documentation'),
('help_docs', 'מסמכי עזרה', 'Help Documentation', 'User help and guides');

-- Request Statuses
INSERT INTO request_statuses (key, display_name_hebrew, display_name_english, description, color, sort_order) VALUES
('pending', 'ממתין', 'Pending', 'Awaiting review', '#FFA500', 1),
('approved', 'אושר', 'Approved', 'Request approved', '#22C55E', 2),
('rejected', 'נדחה', 'Rejected', 'Request rejected', '#EF4444', 3);

-- Publisher Roles
INSERT INTO publisher_roles (key, display_name_hebrew, display_name_english, description, permissions, sort_order) VALUES
('owner', 'בעלים', 'Owner', 'Full control over publisher', '{"all": true}', 1),
('admin', 'מנהל', 'Admin', 'Administrative access', '{"manage_zmanim": true, "manage_coverage": true, "manage_members": true}', 2),
('editor', 'עורך', 'Editor', 'Can edit zmanim and settings', '{"manage_zmanim": true, "manage_coverage": true}', 3),
('viewer', 'צופה', 'Viewer', 'Read-only access', '{"view": true}', 4);

-- Coverage Levels
INSERT INTO coverage_levels (key, display_name_hebrew, display_name_english, description, sort_order) VALUES
('city', 'עיר', 'City', 'City-level coverage', 1),
('district', 'מחוז', 'District', 'District-level coverage', 2),
('region', 'אזור', 'Region', 'Region-level coverage', 3),
('country', 'מדינה', 'Country', 'Country-level coverage', 4),
('continent', 'יבשת', 'Continent', 'Continent-level coverage', 5);

-- Jewish Event Types
INSERT INTO jewish_event_types (key, display_name_hebrew, display_name_english, description, sort_order) VALUES
('weekly', 'שבועי', 'Weekly', 'Weekly recurring events', 1),
('yom_tov', 'יום טוב', 'Yom Tov', 'Major festivals', 2),
('fast', 'תענית', 'Fast', 'Fast days', 3),
('informational', 'מידע', 'Informational', 'Informational dates', 4);

-- Fast Start Types
INSERT INTO fast_start_types (key, display_name_hebrew, display_name_english) VALUES
('dawn', 'עלות השחר', 'Dawn'),
('sunset', 'שקיעה', 'Sunset');

-- Calculation Types
INSERT INTO calculation_types (key, display_name_hebrew, display_name_english, description) VALUES
('solar_angle', 'זווית שמש', 'Solar Angle', 'Based on sun angle below horizon'),
('fixed_time', 'זמן קבוע', 'Fixed Time', 'Fixed offset from another time'),
('proportional', 'יחסי', 'Proportional', 'Based on halachic hours');

-- Edge Types
INSERT INTO edge_types (key, display_name_hebrew, display_name_english, description) VALUES
('upper', 'עליון', 'Upper', 'Upper edge of sun'),
('center', 'מרכז', 'Center', 'Center of sun'),
('lower', 'תחתון', 'Lower', 'Lower edge of sun');

-- Primitive Categories
INSERT INTO primitive_categories (key, display_name_hebrew, display_name_english, description, sort_order) VALUES
('dawn', 'שחר', 'Dawn', 'Dawn-related primitives', 1),
('sunrise', 'נץ', 'Sunrise', 'Sunrise-related primitives', 2),
('midday', 'צהריים', 'Midday', 'Midday-related primitives', 3),
('sunset', 'שקיעה', 'Sunset', 'Sunset-related primitives', 4),
('night', 'לילה', 'Night', 'Night-related primitives', 5);

-- Zman Source Types
INSERT INTO zman_source_types (key, display_name_hebrew, display_name_english, description) VALUES
('master', 'ראשי', 'Master', 'From master registry'),
('custom', 'מותאם', 'Custom', 'Custom publisher zman'),
('linked', 'מקושר', 'Linked', 'Linked from another publisher');

-- Geo Levels
INSERT INTO geo_levels (key, display_name_hebrew, display_name_english, sort_order) VALUES
('continent', 'יבשת', 'Continent', 1),
('country', 'מדינה', 'Country', 2),
('region', 'אזור', 'Region', 3),
('district', 'מחוז', 'District', 4),
('city', 'עיר', 'City', 5);

-- Data Types (for geo_data_sources)
INSERT INTO data_types (key, display_name_hebrew, display_name_english, description) VALUES
('coordinates', 'קואורדינטות', 'Coordinates', 'Latitude/longitude data'),
('elevation', 'גובה', 'Elevation', 'Elevation data'),
('both', 'שניהם', 'Both', 'Both coordinates and elevation');

-- Explanation Sources
INSERT INTO explanation_sources (key, display_name_hebrew, display_name_english) VALUES
('ai', 'בינה מלאכותית', 'AI'),
('manual', 'ידני', 'Manual'),
('cached', 'מהמטמון', 'Cached');

-- ============================================================================
-- LANGUAGES (ISO 639-3 codes used by WOF)
-- ============================================================================
INSERT INTO languages (code, name, native_name, script, direction, is_active) VALUES
('eng', 'English', 'English', 'Latn', 'ltr', true),
('heb', 'Hebrew', 'עברית', 'Hebr', 'rtl', true),
('ara', 'Arabic', 'العربية', 'Arab', 'rtl', true),
('yid', 'Yiddish', 'ייִדיש', 'Hebr', 'rtl', true),
('rus', 'Russian', 'Русский', 'Cyrl', 'ltr', true),
('fra', 'French', 'Français', 'Latn', 'ltr', true),
('deu', 'German', 'Deutsch', 'Latn', 'ltr', true),
('spa', 'Spanish', 'Español', 'Latn', 'ltr', true),
('por', 'Portuguese', 'Português', 'Latn', 'ltr', true),
('zho', 'Chinese', '中文', 'Hans', 'ltr', true),
('jpn', 'Japanese', '日本語', 'Jpan', 'ltr', true),
('kor', 'Korean', '한국어', 'Kore', 'ltr', true),
('ita', 'Italian', 'Italiano', 'Latn', 'ltr', true),
('nld', 'Dutch', 'Nederlands', 'Latn', 'ltr', true),
('pol', 'Polish', 'Polski', 'Latn', 'ltr', true),
('hun', 'Hungarian', 'Magyar', 'Latn', 'ltr', true),
('ukr', 'Ukrainian', 'Українська', 'Cyrl', 'ltr', true),
('tur', 'Turkish', 'Türkçe', 'Latn', 'ltr', true),
('fas', 'Persian', 'فارسی', 'Arab', 'rtl', true),
('hin', 'Hindi', 'हिन्दी', 'Deva', 'ltr', true),
('und', 'Undetermined', NULL, NULL, 'ltr', true);

-- ============================================================================
-- GEO DATA SOURCES (for multi-source coordinate/elevation system)
-- ============================================================================
INSERT INTO geo_data_sources (key, name, description, data_type_id, priority, default_accuracy_m, attribution, url) VALUES
('publisher', 'Publisher Override', 'Publisher-specific coordinate/elevation override', (SELECT id FROM data_types WHERE key = 'both'), 1, NULL, NULL, NULL),
('community', 'Community Contribution', 'User-submitted corrections (verified)', (SELECT id FROM data_types WHERE key = 'both'), 2, NULL, NULL, NULL),
('simplemaps', 'SimpleMaps World Cities', 'Government-surveyed coordinates (NGIA, USGS, Census)', (SELECT id FROM data_types WHERE key = 'coordinates'), 3, 50, 'Data provided by SimpleMaps', 'https://simplemaps.com/data/world-cities'),
('wof', 'Who''s On First', 'Polygon centroids from WOF gazetteer', (SELECT id FROM data_types WHERE key = 'coordinates'), 4, 1000, 'Data from Who''s On First, a gazetteer of places', 'https://whosonfirst.org/'),
('glo90', 'Copernicus GLO-90', 'Copernicus 90m Digital Elevation Model', (SELECT id FROM data_types WHERE key = 'elevation'), 3, 1, '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA', 'https://copernicus-dem-90m.s3.amazonaws.com/');

-- ============================================================================
-- DAY TYPES
-- ============================================================================
-- Insert parent types first (parent_id = NULL)
INSERT INTO day_types (id, key, display_name_hebrew, display_name_english, description, parent_id, sort_order) VALUES
(121, 'weekday', 'יום חול', 'Weekday', 'Regular weekday (Sunday-Thursday)', NULL, 10),
(137, 'erev_shabbos', 'ערב שבת', 'Erev Shabbos', 'Friday afternoon before Shabbos', NULL, 20),
(26, 'shabbos', 'שבת', 'Shabbos', 'Shabbat day', NULL, 25),
(100, 'motzei_shabbos', 'מוצאי שבת', 'Motzei Shabbos', 'Saturday night after Shabbos', NULL, 30),
(133, 'erev_yom_tov', 'ערב יום טוב', 'Erev Yom Tov', 'Day before Yom Tov', NULL, 40),
(198, 'yom_tov', 'יום טוב', 'Yom Tov', 'Festival day (Pesach, Shavuos, Sukkos, etc.)', NULL, 45),
(145, 'motzei_yom_tov', 'מוצאי יום טוב', 'Motzei Yom Tov', 'Night after Yom Tov', NULL, 50),
(72, 'chol_hamoed', 'חול המועד', 'Chol HaMoed', 'Intermediate festival days', NULL, 55),
(102, 'taanis', 'תענית', 'Fast Day', 'General fast day', NULL, 100),
(18, 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'New month', NULL, 120),
(40, 'chanukah', 'חנוכה', 'Chanukah', 'Festival of Lights', NULL, 130),
(202, 'purim', 'פורים', 'Purim', 'Feast of Lots', NULL, 135),
(141, 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'Purim in walled cities', NULL, 136),
(226, 'lag_baomer', 'ל"ג בעומר', 'Lag BaOmer', '33rd day of Omer', NULL, 140),
(247, 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'New Year of Trees', NULL, 145),
(116, 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', 'Israel Independence Day', NULL, 150),
(254, 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', 'Jerusalem Day', NULL, 151),
(75, 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', 'Memorial Day', NULL, 152),
(58, 'yom_hashoah', 'יום השואה', 'Yom HaShoah', 'Holocaust Remembrance Day', NULL, 153);

-- Insert child types (with parent_id references)
INSERT INTO day_types (id, key, display_name_hebrew, display_name_english, description, parent_id, sort_order) VALUES
(151, 'friday', 'יום שישי', 'Friday', 'Friday (Erev Shabbos)', 121, 15),
(95, 'erev_pesach', 'ערב פסח', 'Erev Pesach', 'Day before Pesach', 133, 60),
(144, 'pesach', 'פסח', 'Pesach', 'Passover (first and last days)', 198, 61),
(99, 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', 'Day before Shavuos', 133, 65),
(55, 'shavuos', 'שבועות', 'Shavuos', 'Feast of Weeks', 198, 66),
(275, 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', 'Day before Rosh Hashanah', 133, 70),
(68, 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'Jewish New Year', 198, 71),
(242, 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', 'Day before Yom Kippur', 133, 75),
(10, 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'Day of Atonement', 198, 76),
(249, 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', 'Day before Sukkos', 133, 80),
(178, 'sukkos', 'סוכות', 'Sukkos', 'Feast of Tabernacles', 198, 81),
(42, 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', '7th day of Sukkos', 72, 82),
(194, 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', '8th day of Sukkos', 198, 83),
(9, 'simchas_torah', 'שמחת תורה', 'Simchas Torah', 'Rejoicing of the Torah', 198, 84),
(204, 'taanis_start', 'תחילת תענית', 'Beginning of Fast', 'Start of a fast day', 102, 101),
(276, 'taanis_end', 'סוף תענית', 'End of Fast', 'End of a fast day', 102, 102),
(285, 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'Fast of Gedaliah', 102, 110),
(32, 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', '10th of Teves', 102, 111),
(85, 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'Fast of Esther', 102, 112),
(246, 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', '17th of Tamuz', 102, 113),
(250, 'tisha_bav', 'תשעה באב', 'Tisha B''Av', '9th of Av', 102, 114),
(283, 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', 'Evening before Tisha B''Av when the fast begins at sunset', 102, 115);

-- ============================================================================
-- JEWISH EVENTS
-- ============================================================================
INSERT INTO jewish_events (id, code, name_hebrew, name_english, event_type_id, duration_days_israel, duration_days_diaspora, fast_start_type_id, parent_event_id, sort_order) VALUES
(35, 'shabbos', 'שבת', 'Shabbos', (SELECT id FROM jewish_event_types WHERE key = 'weekly'), 1, 1, NULL, NULL, 10),
(81, 'yom_kippur', 'יום כיפור', 'Yom Kippur', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'sunset'), NULL, 20),
(230, 'tisha_bav', 'תשעה באב', 'Tisha B''Av', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'sunset'), NULL, 21),
(253, 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'dawn'), NULL, 30),
(39, 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'dawn'), NULL, 31),
(36, 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'dawn'), NULL, 32),
(111, 'taanis_esther', 'תענית אסתר', 'Taanis Esther', (SELECT id FROM jewish_event_types WHERE key = 'fast'), 1, 1, (SELECT id FROM fast_start_types WHERE key = 'dawn'), NULL, 33),
(91, 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 2, 2, NULL, NULL, 40),
(203, 'sukkos', 'סוכות', 'Sukkos', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 1, 2, NULL, NULL, 50),
(152, 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 1, 2, NULL, NULL, 51),
(193, 'pesach_first', 'פסח (ראשון)', 'Pesach (First Days)', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 1, 2, NULL, NULL, 60),
(109, 'pesach_last', 'פסח (אחרון)', 'Pesach (Last Days)', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 1, 2, NULL, NULL, 61),
(106, 'shavuos', 'שבועות', 'Shavuos', (SELECT id FROM jewish_event_types WHERE key = 'yom_tov'), 1, 2, NULL, NULL, 70),
(76, 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 100),
(110, 'chanukah', 'חנוכה', 'Chanukah', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 8, 8, NULL, NULL, 110),
(284, 'purim', 'פורים', 'Purim', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 120),
(104, 'shushan_purim', 'שושן פורים', 'Shushan Purim', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 121),
(90, 'lag_baomer', 'ל"ג בעומר', 'Lag BaOmer', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 130),
(277, 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 140),
(124, 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 150),
(224, 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 151),
(8, 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 152),
(263, 'yom_hashoah', 'יום השואה', 'Yom HaShoah', (SELECT id FROM jewish_event_types WHERE key = 'informational'), 1, 1, NULL, NULL, 153);

-- ============================================================================
-- TAG TYPES
-- ============================================================================
INSERT INTO tag_types (id, key, display_name_hebrew, display_name_english, color, sort_order) VALUES
(170, 'event', 'אירוע', 'Event', 'blue', 1),
(171, 'timing', 'זמן', 'Timing', 'green', 2),
(172, 'behavior', 'התנהגות', 'Behavior', 'orange', 3),
(173, 'shita', 'שיטה', 'Opinion', 'purple', 4),
(174, 'calculation', 'חישוב', 'Calculation', 'red', 5),
(175, 'category', 'קטגוריה', 'Category', 'gray', 6),
(176, 'jewish_day', 'יום יהודי', 'Jewish Day', 'amber', 7);

-- ============================================================================
-- TIME CATEGORIES
-- ============================================================================
INSERT INTO time_categories (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, is_everyday) VALUES
(265, 'dawn', 'שחר', 'Dawn', 'Pre-sunrise times', 'Moon', 'purple', 1, true),
(266, 'sunrise', 'נץ', 'Sunrise', 'Sunrise times', 'Sun', 'amber', 2, true),
(267, 'morning', 'בוקר', 'Morning', 'Morning times', 'Clock', 'yellow', 3, true),
(268, 'midday', 'צהריים', 'Midday', 'Midday times', 'Clock', 'orange', 4, true),
(269, 'afternoon', 'אחה"צ', 'Afternoon', 'Afternoon times', 'Clock', 'amber', 5, true),
(270, 'sunset', 'שקיעה', 'Sunset', 'Sunset times', 'Sunset', 'rose', 6, true),
(271, 'nightfall', 'לילה', 'Nightfall', 'Nightfall times', 'Moon', 'indigo', 7, true),
(272, 'midnight', 'חצות', 'Midnight', 'Midnight times', 'Moon', 'slate', 8, true);

-- ============================================================================
-- DISPLAY GROUPS
-- ============================================================================
INSERT INTO display_groups (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, time_categories) VALUES
(13, 'dawn', 'שחר', 'Dawn', 'Pre-sunrise zmanim', 'Moon', 'purple', 1, '{dawn}'),
(1, 'morning', 'בוקר', 'Morning', 'Sunrise through late morning zmanim', 'Sun', 'amber', 2, '{sunrise,morning}'),
(251, 'midday', 'צהריים', 'Midday', 'Midday and afternoon zmanim', 'Clock', 'orange', 3, '{midday,afternoon}'),
(127, 'evening', 'ערב', 'Evening', 'Sunset through nightfall zmanim', 'Sunset', 'rose', 4, '{sunset,nightfall,midnight}');

-- ============================================================================
-- EVENT CATEGORIES
-- ============================================================================
INSERT INTO event_categories (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order) VALUES
(22, 'candles', 'הדלקת נרות', 'Candle Lighting', 'Shabbos, Yom Tov, and Yom Kippur', 'Flame', 'amber', 1),
(21, 'havdalah', 'הבדלה', 'Havdalah', 'End of Shabbos and Yom Tov', 'Flame', 'purple', 2),
(248, 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'Fast start and end times', 'Moon', 'slate', 3),
(207, 'fast_day', 'תענית', 'Fast Days', 'Fast end times (regular fasts)', 'Timer', 'gray', 4),
(213, 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'Fast starts at sunset, ends at nightfall', 'Moon', 'slate', 5),
(146, 'pesach', 'פסח', 'Pesach', 'Chametz eating and burning times', 'Utensils', 'green', 6);

-- ============================================================================
-- ASTRONOMICAL PRIMITIVES
-- Note: category_id, calculation_type_id, edge_type_id refer to lookup tables
-- For now using direct IDs based on lookup inserts above. These need proper primitive_categories.
-- ============================================================================

-- First add missing primitive categories for astronomical primitives
INSERT INTO primitive_categories (key, display_name_hebrew, display_name_english, description, sort_order) VALUES
('horizon', 'אופק', 'Horizon', 'Horizon-related events', 6),
('civil_twilight', 'דמדומים אזרחיים', 'Civil Twilight', 'Civil twilight (6 degrees)', 7),
('nautical_twilight', 'דמדומים ימיים', 'Nautical Twilight', 'Nautical twilight (12 degrees)', 8),
('astronomical_twilight', 'דמדומים אסטרונומיים', 'Astronomical Twilight', 'Astronomical twilight (18 degrees)', 9),
('solar_position', 'מיקום השמש', 'Solar Position', 'Solar position events', 10)
ON CONFLICT DO NOTHING;

-- Add missing calculation types
INSERT INTO calculation_types (key, display_name_hebrew, display_name_english, description) VALUES
('horizon', 'אופק', 'Horizon', 'Horizon crossing calculation'),
('transit', 'מעבר', 'Transit', 'Meridian transit calculation')
ON CONFLICT DO NOTHING;

-- Add missing edge types
INSERT INTO edge_types (key, display_name_hebrew, display_name_english, description) VALUES
('top_edge', 'קצה עליון', 'Top Edge', 'Top edge of sun disk')
ON CONFLICT DO NOTHING;

INSERT INTO astronomical_primitives (id, variable_name, display_name, description, formula_dsl, category_id, calculation_type_id, solar_angle, is_dawn, edge_type_id, sort_order) VALUES
(3, 'sunrise', 'Sunrise', 'Geometric sunrise - sun center crosses the horizon (0°)', 'sunrise', (SELECT id FROM primitive_categories WHERE key = 'horizon'), (SELECT id FROM calculation_types WHERE key = 'horizon'), NULL, true, (SELECT id FROM edge_types WHERE key = 'center'), 100),
(240, 'sunset', 'Sunset', 'Geometric sunset - sun center crosses the horizon (0°)', 'sunset', (SELECT id FROM primitive_categories WHERE key = 'horizon'), (SELECT id FROM calculation_types WHERE key = 'horizon'), NULL, false, (SELECT id FROM edge_types WHERE key = 'center'), 101),
(211, 'sunrise_visible', 'Sunrise (Visible)', 'First visible edge of sun appears above horizon (accounting for refraction)', 'visible_sunrise', (SELECT id FROM primitive_categories WHERE key = 'horizon'), (SELECT id FROM calculation_types WHERE key = 'horizon'), NULL, true, (SELECT id FROM edge_types WHERE key = 'top_edge'), 102),
(225, 'sunset_visible', 'Sunset (Visible)', 'Last visible edge of sun disappears below horizon (accounting for refraction)', 'visible_sunset', (SELECT id FROM primitive_categories WHERE key = 'horizon'), (SELECT id FROM calculation_types WHERE key = 'horizon'), NULL, false, (SELECT id FROM edge_types WHERE key = 'top_edge'), 103),
(228, 'civil_dawn', 'Civil Dawn', 'Sun 6° below horizon - enough light for outdoor activities without artificial light', 'solar(6, before_sunrise)', (SELECT id FROM primitive_categories WHERE key = 'civil_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 6.00, true, (SELECT id FROM edge_types WHERE key = 'center'), 200),
(214, 'civil_dusk', 'Civil Dusk', 'Sun 6° below horizon - artificial light needed for outdoor activities', 'solar(6, after_sunset)', (SELECT id FROM primitive_categories WHERE key = 'civil_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 6.00, false, (SELECT id FROM edge_types WHERE key = 'center'), 201),
(217, 'nautical_dawn', 'Nautical Dawn', 'Sun 12° below horizon - horizon visible at sea for navigation', 'solar(12, before_sunrise)', (SELECT id FROM primitive_categories WHERE key = 'nautical_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 12.00, true, (SELECT id FROM edge_types WHERE key = 'center'), 300),
(51, 'nautical_dusk', 'Nautical Dusk', 'Sun 12° below horizon - horizon no longer visible at sea', 'solar(12, after_sunset)', (SELECT id FROM primitive_categories WHERE key = 'nautical_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 12.00, false, (SELECT id FROM edge_types WHERE key = 'center'), 301),
(89, 'astronomical_dawn', 'Astronomical Dawn', 'Sun 18° below horizon - sky completely dark before this, first hint of light', 'solar(18, before_sunrise)', (SELECT id FROM primitive_categories WHERE key = 'astronomical_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 18.00, true, (SELECT id FROM edge_types WHERE key = 'center'), 400),
(147, 'astronomical_dusk', 'Astronomical Dusk', 'Sun 18° below horizon - sky becomes completely dark after this', 'solar(18, after_sunset)', (SELECT id FROM primitive_categories WHERE key = 'astronomical_twilight'), (SELECT id FROM calculation_types WHERE key = 'solar_angle'), 18.00, false, (SELECT id FROM edge_types WHERE key = 'center'), 401),
(209, 'solar_noon', 'Solar Noon', 'Sun at highest point in the sky (transit/meridian crossing)', 'solar_noon', (SELECT id FROM primitive_categories WHERE key = 'solar_position'), (SELECT id FROM calculation_types WHERE key = 'transit'), NULL, NULL, (SELECT id FROM edge_types WHERE key = 'center'), 500),
(61, 'solar_midnight', 'Solar Midnight', 'Sun at lowest point (anti-transit) - opposite side of Earth', 'solar_midnight', (SELECT id FROM primitive_categories WHERE key = 'solar_position'), (SELECT id FROM calculation_types WHERE key = 'transit'), NULL, NULL, (SELECT id FROM edge_types WHERE key = 'center'), 501);

-- ============================================================================
-- ALGORITHM TEMPLATES
-- ============================================================================
INSERT INTO algorithm_templates (id, template_key, name, description, configuration, sort_order, is_active) VALUES
(135, 'gra', 'GRA (Vilna Gaon)', 'Standard calculation based on the Vilna Gaon. Uses sunrise to sunset for proportional hours.', '{"name": "GRA", "zmanim": {"tzais": {"method": "solar_angle", "params": {"degrees": 8.5}}, "sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "gra", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "gra", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "gra", "hours": 10.75}}, "alos_hashachar": {"method": "solar_angle", "params": {"degrees": 16.1}}, "sof_zman_shma_gra": {"method": "proportional", "params": {"base": "gra", "hours": 3.0}}, "sof_zman_tfila_gra": {"method": "proportional", "params": {"base": "gra", "hours": 4.0}}}, "description": "Vilna Gaon standard calculation"}', 1, true),
(279, 'mga', 'MGA (Magen Avraham)', 'Magen Avraham calculation. Uses 72 minutes before sunrise to 72 minutes after sunset for proportional hours.', '{"name": "MGA", "zmanim": {"sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "tzeis_72": {"method": "fixed_minutes", "params": {"from": "sunset", "minutes": 72.0}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "mga", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "mga", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "mga", "hours": 10.75}}, "alos_hashachar": {"method": "fixed_minutes", "params": {"from": "sunrise", "minutes": -72.0}}, "sof_zman_shma_mga": {"method": "proportional", "params": {"base": "mga", "hours": 3.0}}, "sof_zman_tfila_mga": {"method": "proportional", "params": {"base": "mga", "hours": 4.0}}}, "description": "Magen Avraham calculation"}', 2, true),
(258, 'rabbeinu_tam', 'Rabbeinu Tam', 'Uses 72 minutes after sunset for tzeis based on Rabbeinu Tam''s opinion.', '{"name": "Rabbeinu Tam", "zmanim": {"tzais": {"method": "solar_angle", "params": {"degrees": 8.5}}, "sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "tzeis_72": {"method": "fixed_minutes", "params": {"from": "sunset", "minutes": 72.0}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "gra", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "gra", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "gra", "hours": 10.75}}, "alos_hashachar": {"method": "solar_angle", "params": {"degrees": 16.1}}, "sof_zman_shma_gra": {"method": "proportional", "params": {"base": "gra", "hours": 3.0}}, "sof_zman_tfila_gra": {"method": "proportional", "params": {"base": "gra", "hours": 4.0}}}, "description": "Rabbeinu Tam calculation for tzeis"}', 3, true),
(232, 'custom', 'Custom', 'Start with basic times and customize each zman according to your minhag.', '{"name": "Custom", "zmanim": {"sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}}, "description": "Custom algorithm"}', 4, true);

-- ============================================================================
-- ZMAN TAGS
-- ============================================================================
INSERT INTO zman_tags (id, tag_key, name, display_name_hebrew, display_name_english, tag_type_id, description, color, sort_order) VALUES
-- Event tags
(57, 'shabbos', 'shabbos', 'שבת', 'Shabbos', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to Shabbos', NULL, 10),
(50, 'yom_tov', 'yom_tov', 'יום טוב', 'Yom Tov', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to Yom Tov (major holidays)', NULL, 20),
(34, 'yom_kippur', 'yom_kippur', 'יום כיפור', 'Yom Kippur', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to Yom Kippur', NULL, 30),
(244, 'fast_day', 'fast_day', 'תענית', 'Fast Day', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to minor fast days', NULL, 40),
(24, 'tisha_bav', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to Tisha B''Av', NULL, 50),
(186, 'pesach', 'pesach', 'ערב פסח', 'Erev Pesach', (SELECT id FROM tag_types WHERE key = 'event'), 'Applies to Erev Pesach (chametz times)', NULL, 60),
-- Timing tags
(286, 'day_before', 'day_before', 'יום לפני', 'Day Before', (SELECT id FROM tag_types WHERE key = 'timing'), 'Display on the day before the event (e.g., candle lighting)', NULL, 100),
(274, 'day_of', 'day_of', 'יום של', 'Day Of', (SELECT id FROM tag_types WHERE key = 'timing'), 'Display on the day of the event', NULL, 110),
(123, 'night_after', 'night_after', 'לילה אחרי', 'Night After', (SELECT id FROM tag_types WHERE key = 'timing'), 'Display on the night after the event (e.g., havdalah)', NULL, 120),
-- Behavior tags
(206, 'is_candle_lighting', 'is_candle_lighting', 'הדלקת נרות', 'Candle Lighting', (SELECT id FROM tag_types WHERE key = 'behavior'), 'This is a candle lighting time', NULL, 200),
(96, 'is_havdalah', 'is_havdalah', 'הבדלה', 'Havdalah', (SELECT id FROM tag_types WHERE key = 'behavior'), 'This is a havdalah/end of Shabbos time', NULL, 210),
(255, 'is_fast_start', 'is_fast_start', 'תחילת צום', 'Fast Begins', (SELECT id FROM tag_types WHERE key = 'behavior'), 'This marks when a fast begins', NULL, 220),
(77, 'is_fast_end', 'is_fast_end', 'סוף צום', 'Fast Ends', (SELECT id FROM tag_types WHERE key = 'behavior'), 'This marks when a fast ends', NULL, 230),
-- Shita (Opinion) tags
(155, 'shita_gra', 'shita_gra', 'גר"א', 'GRA (Vilna Gaon)', (SELECT id FROM tag_types WHERE key = 'shita'), 'Gaon of Vilna - day from sunrise to sunset', NULL, 10),
(156, 'shita_mga', 'shita_mga', 'מג"א', 'MGA (Magen Avraham)', (SELECT id FROM tag_types WHERE key = 'shita'), 'Magen Avraham - day from alos to tzais (72 min)', NULL, 20),
(157, 'shita_rt', 'shita_rt', 'ר"ת', 'Rabbeinu Tam', (SELECT id FROM tag_types WHERE key = 'shita'), 'Rabbeinu Tam - 72 minutes after sunset for nightfall', NULL, 30),
(158, 'shita_baal_hatanya', 'shita_baal_hatanya', 'בעל התניא', 'Baal HaTanya', (SELECT id FROM tag_types WHERE key = 'shita'), 'Shulchan Aruch HaRav (Chabad)', NULL, 40),
(159, 'shita_ateret_torah', 'shita_ateret_torah', 'עטרת תורה', 'Ateret Torah', (SELECT id FROM tag_types WHERE key = 'shita'), 'Chacham Yosef Harari-Raful (Sephardic)', NULL, 50),
(160, 'shita_geonim', 'shita_geonim', 'גאונים', 'Geonim', (SELECT id FROM tag_types WHERE key = 'shita'), 'Various Geonic opinions on nightfall degrees', NULL, 60),
(161, 'shita_yereim', 'shita_yereim', 'יראים', 'Yereim', (SELECT id FROM tag_types WHERE key = 'shita'), 'Sefer Yereim - bein hashmashos calculations', NULL, 70),
-- Calculation tags
(162, 'calc_fixed', 'calc_fixed', 'זמן קבוע', 'Fixed Time', (SELECT id FROM tag_types WHERE key = 'calculation'), 'Fixed minute offset (not proportional)', NULL, 100),
(163, 'calc_zmanis', 'calc_zmanis', 'שעות זמניות', 'Proportional (Zmaniyos)', (SELECT id FROM tag_types WHERE key = 'calculation'), 'Proportional/seasonal minutes based on day length', NULL, 110),
(164, 'calc_degrees', 'calc_degrees', 'מעלות', 'Solar Degrees', (SELECT id FROM tag_types WHERE key = 'calculation'), 'Based on sun position in degrees below horizon', NULL, 120),
-- Category tags
(165, 'category_shema', 'category_shema', 'קריאת שמע', 'Shema Times', (SELECT id FROM tag_types WHERE key = 'category'), 'Times related to Shema recitation', NULL, 200),
(166, 'category_tefila', 'category_tefila', 'תפילה', 'Prayer Times', (SELECT id FROM tag_types WHERE key = 'category'), 'Times related to prayer services', NULL, 210),
(167, 'category_mincha', 'category_mincha', 'מנחה', 'Mincha Times', (SELECT id FROM tag_types WHERE key = 'category'), 'Times related to afternoon prayer', NULL, 220),
(168, 'category_chametz', 'category_chametz', 'חמץ', 'Chametz Times', (SELECT id FROM tag_types WHERE key = 'category'), 'Times related to chametz on Erev Pesach', NULL, 230),
(169, 'category_kiddush_levana', 'category_kiddush_levana', 'קידוש לבנה', 'Kiddush Levana', (SELECT id FROM tag_types WHERE key = 'category'), 'Times for sanctifying the moon', NULL, 240),
-- Jewish Day tags
(71, 'omer', 'omer', 'ספירת העומר', 'Sefirat HaOmer', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'During the Omer counting period (49 days)', NULL, 300),
(45, 'chanukah', 'chanukah', 'חנוכה', 'Chanukah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Festival of Lights (8 days)', NULL, 310),
(134, 'purim', 'purim', 'פורים', 'Purim', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Feast of Lots', NULL, 320),
(129, 'shushan_purim', 'shushan_purim', 'שושן פורים', 'Shushan Purim', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Purim in walled cities', NULL, 321),
(219, 'taanis_esther', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Fast of Esther', NULL, 322),
(67, 'erev_pesach', 'erev_pesach', 'ערב פסח', 'Erev Pesach', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day before Passover (chametz times)', NULL, 330),
(30, 'chol_hamoed_pesach', 'chol_hamoed_pesach', 'חול המועד פסח', 'Chol HaMoed Pesach', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Intermediate days of Pesach', NULL, 332),
(52, 'erev_shavuos', 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day before Shavuos', NULL, 340),
(234, 'shavuos', 'shavuos', 'שבועות', 'Shavuos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Feast of Weeks', NULL, 341),
(60, 'selichos', 'selichos', 'סליחות', 'Selichos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Penitential prayer period', NULL, 350),
(245, 'erev_rosh_hashanah', 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day before Rosh Hashanah', NULL, 351),
(278, 'rosh_hashanah', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Jewish New Year (2 days)', NULL, 352),
(92, 'tzom_gedaliah', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Fast of Gedaliah', NULL, 353),
(149, 'aseres_yemei_teshuva', 'aseres_yemei_teshuva', 'עשרת ימי תשובה', 'Ten Days of Repentance', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Period from RH to YK', NULL, 354),
(241, 'erev_yom_kippur', 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day before Yom Kippur', NULL, 355),
(222, 'erev_sukkos', 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day before Sukkos', NULL, 360),
(140, 'sukkos', 'sukkos', 'סוכות', 'Sukkos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Feast of Tabernacles', NULL, 361),
(130, 'chol_hamoed_sukkos', 'chol_hamoed_sukkos', 'חול המועד סוכות', 'Chol HaMoed Sukkos', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Intermediate days of Sukkos', NULL, 362),
(212, 'hoshanah_rabbah', 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), '7th day of Sukkos', NULL, 363),
(118, 'shemini_atzeres', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', (SELECT id FROM tag_types WHERE key = 'jewish_day'), '8th day of assembly', NULL, 364),
(93, 'simchas_torah', 'simchas_torah', 'שמחת תורה', 'Simchas Torah', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Rejoicing of the Torah (Diaspora: day 2)', NULL, 365),
(41, 'asarah_bteves', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', (SELECT id FROM tag_types WHERE key = 'jewish_day'), '10th of Teves fast', NULL, 370),
(5, 'shiva_asar_btamuz', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', (SELECT id FROM tag_types WHERE key = 'jewish_day'), '17th of Tamuz fast', NULL, 371),
(97, 'erev_tisha_bav', 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Day/night before Tisha B''Av', NULL, 373),
(142, 'three_weeks', 'three_weeks', 'בין המצרים', 'The Three Weeks', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'Period between 17 Tamuz and 9 Av', NULL, 380),
(79, 'nine_days', 'nine_days', 'תשעת הימים', 'The Nine Days', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'First 9 days of Av', NULL, 381),
(231, 'rosh_chodesh', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'New Moon/Month', NULL, 390),
(69, 'tu_bshvat', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', (SELECT id FROM tag_types WHERE key = 'jewish_day'), 'New Year for Trees', NULL, 391);



-- ============================================================================
-- MASTER ZMANIM REGISTRY
-- ============================================================================

-- Core zmanim (is_core = true)
INSERT INTO master_zmanim_registry (zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category_id, default_formula_dsl, is_core, is_hidden) VALUES
('alos_hashachar', 'עלות השחר', 'Dawn (Alos Hashachar)', 'Alos Hashachar', 'Dawn - when the first light appears on the eastern horizon (16.1° below horizon)', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(16.1, before_sunrise)', true, false),
('candle_lighting', 'הדלקת נרות', 'Candle Lighting', 'Hadlakas Neiros', 'Shabbat candle lighting - 18 minutes before sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 18min', true, false),
('chatzos', 'חצות היום', 'Midday (Chatzos)', 'Chatzos', 'Solar noon - midpoint between sunrise and sunset', (SELECT id FROM time_categories WHERE key = 'midday'), 'solar_noon', true, false),
('chatzos_layla', 'חצות לילה', 'Midnight (Chatzos Layla)', 'Chatzos Layla', 'Halachic midnight - 12 hours after solar noon', (SELECT id FROM time_categories WHERE key = 'midnight'), 'solar_noon + 12hr', true, false),
('fast_ends', 'סוף הצום', 'Fast Ends', 'Sof Hatzom', 'End of fast day', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(8.5, after_sunset)', true, false),
('mincha_gedola', 'מנחה גדולה', 'Earliest Mincha (GRA)', 'Mincha Gedola', 'Earliest time for Mincha - 6.5 proportional hours (half shaah zmanis after chatzos)', (SELECT id FROM time_categories WHERE key = 'midday'), 'proportional_hours(6.5, gra)', true, false),
('mincha_ketana', 'מנחה קטנה', 'Mincha Ketana', 'Mincha Ketana', 'Mincha Ketana - 9.5 proportional hours', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9.5, gra)', true, false),
('misheyakir', 'משיכיר', 'Misheyakir', 'Misheyakir', 'Earliest time to put on tallit and tefillin', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(11.5, before_sunrise)', true, false),
('plag_hamincha', 'פלג המנחה', 'Plag HaMincha', 'Plag Hamincha', 'Plag HaMincha - 10.75 proportional hours (1.25 hours before sunset)', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, gra)', true, false),
('shabbos_ends', 'מוצאי שבת', 'Shabbos Ends', 'Motzei Shabbos', 'End of Shabbos - standard tzais', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(8.5, after_sunset)', true, false),
('sof_zman_shma_gra', 'סוף זמן ק"ש גר"א', 'Latest Shema (GRA)', 'Sof Zman Shma GRA', 'Latest time for Shema - 3 proportional hours (GRA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, gra)', true, false),
('sof_zman_shma_mga', 'סוף זמן ק"ש מג"א', 'Latest Shema (MGA)', 'Sof Zman Shma MGA', 'Latest time for Shema - 3 proportional hours (MGA from 72min dawn)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga)', true, false),
('sof_zman_tfila_gra', 'סוף זמן תפילה גר"א', 'Latest Shacharit (GRA)', 'Sof Zman Tefilla GRA', 'Latest time for Shacharit - 4 proportional hours (GRA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, gra)', true, false),
('sof_zman_tfila_mga', 'סוף זמן תפילה מג"א', 'Latest Shacharit (MGA)', 'Sof Zman Tefilla MGA', 'Latest time for Shacharit - 4 proportional hours (MGA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga)', true, false),
('sunrise', 'הנץ החמה', 'Sunrise', 'Netz Hachama', 'Geometric/sea-level sunrise', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'sunrise', true, false),
('sunset', 'שקיעה', 'Sunset', 'Shkiah', 'Geometric/sea-level sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset', true, false),
('tzais', 'צאת הכוכבים', 'Nightfall (Tzais)', 'Tzais Hakochavim', 'Nightfall - when 3 medium stars are visible (8.5°)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(8.5, after_sunset)', true, false),
('tzais_72', 'צאת ר"ת 72 דקות', 'Tzais Rabbeinu Tam (72 min)', 'Tzais RT 72', 'Rabbeinu Tam - 72 fixed minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 72min', true, false);

-- Zman variations (is_core = false)
INSERT INTO master_zmanim_registry (zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category_id, default_formula_dsl, is_core, is_hidden) VALUES
('alos_12', 'עלות השחר 12°', 'Dawn (12°)', 'Alos Hashachar 12°', 'Dawn calculated at 12 degrees below the horizon. Used by Manchester and other Northern European communities per Minchas Yitzchak.', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(12, before_sunrise)', false, false),
('alos_120', 'עלות השחר 120 דקות', 'Dawn (120 minutes)', 'Alos 120', 'Dawn 120 fixed minutes before sunrise (2 hours)', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 120min', false, false),
('alos_120_zmanis', 'עלות השחר 120 דקות זמניות', 'Dawn (120 Zmaniyos)', 'Alos 120 Zmanis', 'Dawn 120 proportional minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'proportional_minutes(120, before_sunrise)', false, false),
('alos_16_1', 'עלות השחר 16.1°', 'Dawn (16.1°)', 'Alos 16.1', 'Dawn calculated at 16.1° solar depression', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(16.1, before_sunrise)', false, false),
('alos_18', 'עלות השחר 18°', 'Dawn (18°)', 'Alos 18', 'Dawn at astronomical twilight (18°)', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(18, before_sunrise)', false, false),
('alos_19', 'עלות השחר 19°', 'Dawn (19°)', 'Alos 19', 'Dawn at 19° solar depression', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(19, before_sunrise)', false, false),
('alos_19_8', 'עלות השחר 19.8°', 'Dawn (19.8°)', 'Alos 19.8', 'Dawn at 19.8° - stricter opinion', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(19.8, before_sunrise)', false, false),
('alos_26', 'עלות השחר 26°', 'Dawn (26°)', 'Alos 26', 'Dawn at 26° - very stringent', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(26, before_sunrise)', false, false),
('alos_60', 'עלות השחר 60 דקות', 'Dawn (60 minutes)', 'Alos 60', 'Dawn 60 fixed minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 60min', false, false),
('alos_72', 'עלות השחר 72 דקות', 'Dawn (72 minutes)', 'Alos 72', 'Dawn 72 fixed minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 72min', false, false),
('alos_72_zmanis', 'עלות השחר 72 דקות זמניות', 'Dawn (72 Zmaniyos)', 'Alos 72 Zmanis', 'Dawn 72 proportional minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'proportional_minutes(72, before_sunrise)', false, false),
('alos_90', 'עלות השחר 90 דקות', 'Dawn (90 minutes)', 'Alos 90', 'Dawn 90 fixed minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 90min', false, false),
('alos_90_zmanis', 'עלות השחר 90 דקות זמניות', 'Dawn (90 Zmaniyos)', 'Alos 90 Zmanis', 'Dawn 90 proportional minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'proportional_minutes(90, before_sunrise)', false, false),
('alos_96', 'עלות השחר 96 דקות', 'Dawn (96 minutes)', 'Alos 96', 'Dawn 96 fixed minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 96min', false, false),
('alos_96_zmanis', 'עלות השחר 96 דקות זמניות', 'Dawn (96 Zmaniyos)', 'Alos 96 Zmanis', 'Dawn 96 proportional minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'proportional_minutes(96, before_sunrise)', false, false),
('alos_baal_hatanya', 'עלות השחר בעל התניא', 'Dawn (Baal HaTanya)', 'Alos Baal HaTanya', 'Dawn according to Baal HaTanya (16.9° solar depression)', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(16.9, before_sunrise)', false, false),
('alos_shemini_atzeres', 'עלות השחר - שמיני עצרת', 'Dawn for Aravos (Shemini Atzeres)', 'Alos HaShachar - Shemini Atzeret', 'Dawn calculation for the 8th day of Sukkot when Aravos is done early', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 24min', false, false),
('bein_hashmashos_rt_13_24', 'בין השמשות ר"ת 13.24°', 'Bein Hashmashos R"T (13.24°)', 'BH RT 13.24', 'Bein Hashmashos according to Rabbeinu Tam at 13.24°', (SELECT id FROM time_categories WHERE key = 'sunset'), 'solar(13.24, after_sunset)', false, false),
('bein_hashmashos_rt_2_stars', 'בין השמשות ר"ת 2 כוכבים', 'Bein Hashmashos R"T (2 Stars)', 'BH RT 2 Stars', 'Bein Hashmashos when 2 stars visible', (SELECT id FROM time_categories WHERE key = 'sunset'), 'solar(7.5, after_sunset)', false, false),
('bein_hashmashos_rt_58_5', 'בין השמשות ר"ת 58.5 דקות', 'Bein Hashmashos R"T (58.5 min)', 'BH RT 58.5', 'Bein Hashmashos 58.5 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset + 58min', false, false),
('bein_hashmashos_start', 'תחילת בין השמשות', 'Bein Hashmashos Start', 'Bein Hashmashos', 'Start of twilight period', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset', false, false),
('bein_hashmashos_yereim_13_5', 'בין השמשות יראים 13.5 דקות', 'Bein Hashmashos Yereim (13.5 min)', 'BH Yereim 13.5', 'Bein Hashmashos per Yereim 13.5 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset + 13min', false, false),
('bein_hashmashos_yereim_16_875', 'בין השמשות יראים 16.875 דקות', 'Bein Hashmashos Yereim (16.875 min)', 'BH Yereim 16.875', 'Bein Hashmashos per Yereim 16.875 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset + 17min', false, false),
('bein_hashmashos_yereim_18', 'בין השמשות יראים 18 דקות', 'Bein Hashmashos Yereim (18 min)', 'BH Yereim 18', 'Bein Hashmashos per Yereim 18 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset + 18min', false, false),
('bein_hashmashos_yereim_2_1', 'בין השמשות יראים 2.1°', 'Bein Hashmashos Yereim (2.1°)', 'BH Yereim 2.1', 'Bein Hashmashos per Yereim at 2.1°', (SELECT id FROM time_categories WHERE key = 'sunset'), 'solar(2.1, after_sunset)', false, false),
('bein_hashmashos_yereim_2_8', 'בין השמשות יראים 2.8°', 'Bein Hashmashos Yereim (2.8°)', 'BH Yereim 2.8', 'Bein Hashmashos per Yereim at 2.8°', (SELECT id FROM time_categories WHERE key = 'sunset'), 'solar(2.8, after_sunset)', false, false),
('bein_hashmashos_yereim_3_05', 'בין השמשות יראים 3.05°', 'Bein Hashmashos Yereim (3.05°)', 'BH Yereim 3.05', 'Bein Hashmashos per Yereim at 3.05°', (SELECT id FROM time_categories WHERE key = 'sunset'), 'solar(3.05, after_sunset)', false, false),
('candle_lighting_15', 'הדלקת נרות 15 דקות', 'Candle Lighting (15 min)', 'Hadlakas Neiros 15', 'Candle lighting 15 minutes before sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 15min', false, false),
('candle_lighting_18', 'הדלקת נרות 18 דקות', 'Candle Lighting (18 min)', 'Hadlakas Neiros 18', 'Candle lighting 18 minutes before sunset (standard)', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 18min', false, false),
('candle_lighting_20', 'הדלקת נרות 20 דקות', 'Candle Lighting (20 min)', 'Hadlakas Neiros 20', 'Candle lighting 20 minutes before sunset (Jerusalem)', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 20min', false, false),
('candle_lighting_22', 'הדלקת נרות 22 דקות', 'Candle Lighting (22 min)', 'Hadlakas Neiros 22', 'Candle lighting 22 minutes before sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 22min', false, false),
('candle_lighting_30', 'הדלקת נרות 30 דקות', 'Candle Lighting (30 min)', 'Hadlakas Neiros 30', 'Candle lighting 30 minutes before sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 30min', false, false),
('candle_lighting_40', 'הדלקת נרות 40 דקות', 'Candle Lighting (40 min)', 'Hadlakas Neiros 40', 'Candle lighting 40 minutes before sunset (Jerusalem strict)', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset - 40min', false, false),
('fast_begins', 'תחילת הצום', 'Fast Begins', 'Techilas Hatzom', 'Beginning of dawn-start fasts (minor fasts begin at alos)', (SELECT id FROM time_categories WHERE key = 'dawn'), 'solar(16.1, before_sunrise)', false, false),
('fast_begins_72', 'תחילת הצום 72 דקות', 'Fast Begins (72 min)', 'Techilas Hatzom 72', 'Fast begins 72 minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 72min', false, false),
('fast_begins_90', 'תחילת הצום 90 דקות', 'Fast Begins (90 min)', 'Techilas Hatzom 90', 'Fast begins 90 minutes before sunrise', (SELECT id FROM time_categories WHERE key = 'dawn'), 'sunrise - 90min', false, false),
('fast_begins_sunset', 'תחילת הצום (שקיעה)', 'Fast Begins (Sunset)', 'Techilas Hatzom Shkiah', 'Beginning of sunset-start fasts (Yom Kippur, Tisha B''Av)', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset', false, false),
('fast_ends_20', 'סוף הצום 20 דקות', 'Fast Ends (20 min)', 'Sof Hatzom 20', 'Fast ends 20 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 20min', false, false),
('fast_ends_42', 'סוף הצום 42 דקות', 'Fast Ends (42 min)', 'Sof Hatzom 42', 'Fast ends 42 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 42min', false, false),
('fast_ends_50', 'סוף הצום 50 דקות', 'Fast Ends (50 min)', 'Sof Hatzom 50', 'Fast ends 50 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 50min', false, false),
('fixed_local_chatzos', 'חצות קבוע', 'Fixed Local Chatzos', 'Chatzos Kavua', 'Fixed local chatzos (12:00 PM local standard time)', (SELECT id FROM time_categories WHERE key = 'midday'), '12:00', false, false),
('havdalah', 'הבדלה', 'Havdalah', 'Havdalah', 'End of Shabbos/Yom Tov - default 42 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 42min', false, false),
('mincha_gedola_16_1', 'מנחה גדולה 16.1°', 'Earliest Mincha (16.1°)', 'Mincha Gedola 16.1', 'Earliest Mincha based on 16.1° calculation', (SELECT id FROM time_categories WHERE key = 'midday'), 'proportional_hours(6.5, alos_16_1)', false, false),
('mincha_gedola_30', 'מנחה גדולה 30 דקות', 'Earliest Mincha (30 min)', 'Mincha Gedola 30', 'Earliest Mincha - exactly 30 minutes after chatzos', (SELECT id FROM time_categories WHERE key = 'midday'), 'solar_noon + 30min', false, false),
('mincha_gedola_72', 'מנחה גדולה 72 דקות', 'Earliest Mincha (72 min)', 'Mincha Gedola 72', 'Earliest Mincha based on 72 minute day', (SELECT id FROM time_categories WHERE key = 'midday'), 'proportional_hours(6.5, mga)', false, false),
('mincha_gedola_ateret_torah', 'מנחה גדולה עטרת תורה', 'Earliest Mincha (Ateret Torah)', 'Mincha Gedola AT', 'Earliest Mincha per Chacham Yosef Harari-Raful', (SELECT id FROM time_categories WHERE key = 'midday'), 'proportional_hours(6.5, ateret_torah)', false, false),
('mincha_gedola_baal_hatanya', 'מנחה גדולה בעל התניא', 'Earliest Mincha (Baal HaTanya)', 'Mincha Gedola BH', 'Earliest Mincha according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'midday'), 'proportional_hours(6.5, baal_hatanya)', false, false),
('mincha_ketana_16_1', 'מנחה קטנה 16.1°', 'Mincha Ketana (16.1°)', 'Mincha Ketana 16.1', 'Mincha Ketana based on 16.1° calculation', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9.5, alos_16_1)', false, false),
('mincha_ketana_72', 'מנחה קטנה 72 דקות', 'Mincha Ketana (72 min)', 'Mincha Ketana 72', 'Mincha Ketana (MGA 72 minute day)', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9.5, mga)', false, false),
('mincha_ketana_ateret_torah', 'מנחה קטנה עטרת תורה', 'Mincha Ketana (Ateret Torah)', 'Mincha Ketana AT', 'Mincha Ketana per Chacham Yosef Harari-Raful', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9.5, ateret_torah)', false, false),
('mincha_ketana_baal_hatanya', 'מנחה קטנה בעל התניא', 'Mincha Ketana (Baal HaTanya)', 'Mincha Ketana BH', 'Mincha Ketana according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9.5, baal_hatanya)', false, false),
('misheyakir_10_2', 'משיכיר 10.2°', 'Misheyakir (10.2°)', 'Misheyakir 10.2', 'Misheyakir at 10.2° solar depression', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(10.2, before_sunrise)', false, false),
('misheyakir_11', 'משיכיר 11°', 'Misheyakir (11°)', 'Misheyakir 11', 'Misheyakir at 11° solar depression', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(11, before_sunrise)', false, false),
('misheyakir_11_5', 'משיכיר 11.5°', 'Misheyakir (11.5°)', 'Misheyakir 11.5', 'Misheyakir at 11.5° solar depression - standard opinion', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(11.5, before_sunrise)', false, false),
('misheyakir_7_65', 'משיכיר 7.65°', 'Misheyakir (7.65°)', 'Misheyakir 7.65', 'Misheyakir at 7.65° - lenient opinion', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(7.65, before_sunrise)', false, false),
('misheyakir_9_5', 'משיכיר 9.5°', 'Misheyakir (9.5°)', 'Misheyakir 9.5', 'Misheyakir at 9.5° solar depression - lenient opinion', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'solar(9.5, before_sunrise)', false, false),
('plag_hamincha_120', 'פלג המנחה 120 דקות', 'Plag HaMincha (120 min)', 'Plag Hamincha 120', 'Plag HaMincha based on 120 minute day', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_120)', false, false),
('plag_hamincha_16_1', 'פלג המנחה 16.1°', 'Plag HaMincha (16.1°)', 'Plag Hamincha 16.1', 'Plag HaMincha based on 16.1° calculation', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, alos_16_1)', false, false),
('plag_hamincha_18', 'פלג המנחה 18°', 'Plag HaMincha (18°)', 'Plag Hamincha 18', 'Plag HaMincha based on 18° calculation', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_18)', false, false),
('plag_hamincha_19_8', 'פלג המנחה 19.8°', 'Plag HaMincha (19.8°)', 'Plag Hamincha 19.8', 'Plag HaMincha based on 19.8° calculation', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_19_8)', false, false),
('plag_hamincha_26', 'פלג המנחה 26°', 'Plag HaMincha (26°)', 'Plag Hamincha 26', 'Plag HaMincha based on 26° calculation', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_26)', false, false),
('plag_hamincha_60', 'פלג המנחה 60 דקות', 'Plag HaMincha (60 min)', 'Plag Hamincha 60', 'Plag HaMincha based on 60 minute day', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_60)', false, false),
('plag_hamincha_72', 'פלג המנחה 72 דקות', 'Plag HaMincha (72 min)', 'Plag Hamincha 72', 'Plag HaMincha (MGA 72 minute day)', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga)', false, false),
('plag_hamincha_90', 'פלג המנחה 90 דקות', 'Plag HaMincha (90 min)', 'Plag Hamincha 90', 'Plag HaMincha based on 90 minute day', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_90)', false, false),
('plag_hamincha_96', 'פלג המנחה 96 דקות', 'Plag HaMincha (96 min)', 'Plag Hamincha 96', 'Plag HaMincha based on 96 minute day', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, mga_96)', false, false),
('plag_hamincha_ateret_torah', 'פלג המנחה עטרת תורה', 'Plag HaMincha (Ateret Torah)', 'Plag Hamincha AT', 'Plag HaMincha per Chacham Yosef Harari-Raful', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, ateret_torah)', false, false),
('plag_hamincha_baal_hatanya', 'פלג המנחה בעל התניא', 'Plag HaMincha (Baal HaTanya)', 'Plag Hamincha BH', 'Plag HaMincha according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, baal_hatanya)', false, false),
('plag_hamincha_terumas_hadeshen', 'פלג המנחה - תרומת הדשן', 'Plag HaMincha (Terumas HaDeshen)', 'Plag HaMincha Terumas HaDeshen', 'Plag HaMincha calculated with day starting from midnight per Terumas HaDeshen', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(10.75, custom(sunrise - 90min, sunset + 90min))', false, false),
('samuch_lmincha_ketana', 'סמוך למנחה קטנה', 'Samuch L''Mincha Ketana', 'Samuch LMincha', 'Half hour before Mincha Ketana', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9, gra)', false, false),
('samuch_lmincha_ketana_16_1', 'סמוך למנחה קטנה 16.1°', 'Samuch L''Mincha Ketana (16.1°)', 'Samuch LMincha 16.1', 'Half hour before Mincha Ketana (16.1° day)', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9, mga_16_1)', false, false),
('samuch_lmincha_ketana_72', 'סמוך למנחה קטנה 72', 'Samuch L''Mincha Ketana (72 min)', 'Samuch LMincha 72', 'Half hour before Mincha Ketana (72 min day)', (SELECT id FROM time_categories WHERE key = 'afternoon'), 'proportional_hours(9, mga)', false, false),
('shaah_zmanis_gra', 'שעה זמנית גר"א', 'Shaah Zmanis (GRA)', 'Shaah Zmanis GRA', 'One proportional hour according to GRA', (SELECT id FROM time_categories WHERE key = 'midday'), 'shaah_zmanis(gra)', false, true),
('shaah_zmanis_mga', 'שעה זמנית מג"א', 'Shaah Zmanis (MGA)', 'Shaah Zmanis MGA', 'One proportional hour according to MGA', (SELECT id FROM time_categories WHERE key = 'midday'), 'shaah_zmanis(mga)', false, true),
('shabbos_ends_42', 'מוצאי שבת 42 דקות', 'Shabbos Ends (42 min)', 'Motzei Shabbos 42', 'End of Shabbos - 42 minutes', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 42min', false, false),
('shabbos_ends_50', 'מוצאי שבת 50 דקות', 'Shabbos Ends (50 min)', 'Motzei Shabbos 50', 'End of Shabbos - 50 minutes', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 50min', false, false),
('shabbos_ends_72', 'מוצאי שבת 72 דקות', 'Shabbos Ends (72 min)', 'Motzei Shabbos 72', 'End of Shabbos - Rabbeinu Tam', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 72min', false, false),
('shkia_amitis', 'שקיעה אמיתית', 'True Sunset', 'Shkia Amitis', 'True sunset accounting for elevation', (SELECT id FROM time_categories WHERE key = 'sunset'), 'sunset', false, false),
('sof_zman_achilas_chametz_baal_hatanya', 'סוף זמן אכילת חמץ בעל התניא', 'Latest Eating Chametz (Baal HaTanya)', 'Sof Achilat Chametz BH', 'Latest time to eat chametz per Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, baal_hatanya)', false, false),
('sof_zman_achilas_chametz_gra', 'סוף זמן אכילת חמץ גר"א', 'Latest Eating Chametz (GRA)', 'Sof Achilat Chametz GRA', 'Latest time to eat chametz on Erev Pesach (GRA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, gra)', false, false),
('sof_zman_achilas_chametz_mga', 'סוף זמן אכילת חמץ מג"א', 'Latest Eating Chametz (MGA)', 'Sof Achilat Chametz MGA', 'Latest time to eat chametz on Erev Pesach (MGA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga)', false, false),
('sof_zman_achilas_chametz_mga_16_1', 'סוף זמן אכילת חמץ מג"א 16.1°', 'Latest Eating Chametz (MGA 16.1°)', 'Sof Achilat Chametz MGA 16.1', 'Latest time to eat chametz based on 16.1° day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_16_1)', false, false),
('sof_zman_achilas_chametz_mga_72_zmanis', 'סוף זמן אכילת חמץ מג"א 72 זמניות', 'Latest Eating Chametz (MGA 72 Zmaniyos)', 'Sof Achilat Chametz MGA 72Z', 'Latest time to eat chametz based on 72 zmaniyos day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_72_zmanis)', false, false),
('sof_zman_biur_chametz_baal_hatanya', 'סוף זמן ביעור חמץ בעל התניא', 'Latest Burning Chametz (Baal HaTanya)', 'Sof Biur Chametz BH', 'Latest time to burn chametz per Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(5, baal_hatanya)', false, false),
('sof_zman_biur_chametz_gra', 'סוף זמן ביעור חמץ גר"א', 'Latest Burning Chametz (GRA)', 'Sof Biur Chametz GRA', 'Latest time to burn chametz on Erev Pesach (GRA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(5, gra)', false, false),
('sof_zman_biur_chametz_mga', 'סוף זמן ביעור חמץ מג"א', 'Latest Burning Chametz (MGA)', 'Sof Biur Chametz MGA', 'Latest time to burn chametz on Erev Pesach (MGA)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(5, mga)', false, false),
('sof_zman_biur_chametz_mga_16_1', 'סוף זמן ביעור חמץ מג"א 16.1°', 'Latest Burning Chametz (MGA 16.1°)', 'Sof Biur Chametz MGA 16.1', 'Latest time to burn chametz based on 16.1° day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(5, mga_16_1)', false, false),
('sof_zman_biur_chametz_mga_72_zmanis', 'סוף זמן ביעור חמץ מג"א 72 זמניות', 'Latest Burning Chametz (MGA 72 Zmaniyos)', 'Sof Biur Chametz MGA 72Z', 'Latest time to burn chametz based on 72 zmaniyos day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(5, mga_72_zmanis)', false, false),
('sof_zman_kiddush_levana_15', 'סוף זמן קידוש לבנה 15 ימים', 'Latest Kiddush Levana (15 Days)', 'Sof Kiddush Levana 15', 'Latest time for Kiddush Levana - 15 days after molad', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'molad + 15days', false, false),
('sof_zman_kiddush_levana_between_moldos', 'סוף זמן קידוש לבנה בין המולדות', 'Latest Kiddush Levana (Between Molados)', 'Sof Kiddush Levana BM', 'Latest Kiddush Levana - halfway between molados (~14.75 days)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'molad + 14days + 18hr', false, false),
('sof_zman_shma_16_1', 'סוף זמן ק"ש 16.1°', 'Latest Shema (16.1°)', 'Sof Zman Shma 16.1', 'Latest Shema based on 16.1° alos', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, alos_16_1)', false, false),
('sof_zman_shma_3_hours', 'סוף זמן ק"ש 3 שעות לפני חצות', 'Latest Shema (3 Hours Before Chatzos)', 'Sof Zman Shma 3H', 'Latest Shema - fixed 3 hours before chatzos', (SELECT id FROM time_categories WHERE key = 'morning'), 'solar_noon - 3hr', false, false),
('sof_zman_shma_ateret_torah', 'סוף זמן ק"ש עטרת תורה', 'Latest Shema (Ateret Torah)', 'Sof Zman Shma AT', 'Latest Shema per Chacham Yosef Harari-Raful', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, ateret_torah)', false, false),
('sof_zman_shma_baal_hatanya', 'סוף זמן ק"ש בעל התניא', 'Latest Shema (Baal HaTanya)', 'Sof Zman Shma BH', 'Latest Shema according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, baal_hatanya)', false, false),
('sof_zman_shma_mga_120', 'סוף זמן ק"ש מג"א 120', 'Latest Shema (MGA 120)', 'Sof Zman Shma MGA 120', 'Latest time for Shema (MGA from 120min dawn)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_120)', false, false),
('sof_zman_shma_mga_16_1', 'סוף זמן שמע - מג"א 16.1°', 'Latest Shema (MGA 16.1°)', 'Sof Zman Shma MGA 16.1', 'Latest time for Shema per MGA using 16.1° dawn and 16.1° tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga)', false, false),
('sof_zman_shma_mga_18', 'סוף זמן ק"ש מג"א 18°', 'Latest Shema (MGA 18°)', 'Sof Zman Shma MGA 18', 'Latest Shema MGA based on 18° alos/tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_18)', false, false),
('sof_zman_shma_mga_19_8', 'סוף זמן ק"ש מג"א 19.8°', 'Latest Shema (MGA 19.8°)', 'Sof Zman Shma MGA 19.8', 'Latest Shema MGA based on 19.8° alos/tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_19_8)', false, false),
('sof_zman_shma_mga_72', 'סוף זמן שמע - מג"א 72', 'Latest Shema (MGA 72)', 'Sof Zman Shma MGA 72', 'Latest time for Shema per MGA using 72-minute dawn and tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_90)', false, false),
('sof_zman_shma_mga_72_zmanis', 'סוף זמן ק"ש מג"א 72 זמניות', 'Latest Shema (MGA 72 Zmaniyos)', 'Sof Zman Shma MGA 72Z', 'Latest Shema MGA based on 72 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_72_zmanis)', false, false),
('sof_zman_shma_mga_90', 'סוף זמן ק"ש מג"א 90', 'Latest Shema (MGA 90)', 'Sof Zman Shma MGA 90', 'Latest time for Shema (MGA from 90min dawn)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_90)', false, false),
('sof_zman_shma_mga_90_zmanis', 'סוף זמן ק"ש מג"א 90 זמניות', 'Latest Shema (MGA 90 Zmaniyos)', 'Sof Zman Shma MGA 90Z', 'Latest Shema MGA based on 90 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_90_zmanis)', false, false),
('sof_zman_shma_mga_96', 'סוף זמן ק"ש מג"א 96', 'Latest Shema (MGA 96)', 'Sof Zman Shma MGA 96', 'Latest Shema MGA based on 96 minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_96)', false, false),
('sof_zman_shma_mga_96_zmanis', 'סוף זמן ק"ש מג"א 96 זמניות', 'Latest Shema (MGA 96 Zmaniyos)', 'Sof Zman Shma MGA 96Z', 'Latest Shema MGA based on 96 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(3, mga_96_zmanis)', false, false),
('sof_zman_tfila_2_hours', 'סוף זמן תפילה 2 שעות לפני חצות', 'Latest Shacharit (2 Hours Before Chatzos)', 'Sof Zman Tfila 2H', 'Latest Shacharit - fixed 2 hours before chatzos', (SELECT id FROM time_categories WHERE key = 'morning'), 'solar_noon - 2hr', false, false),
('sof_zman_tfila_ateret_torah', 'סוף זמן תפילה עטרת תורה', 'Latest Shacharit (Ateret Torah)', 'Sof Zman Tfila AT', 'Latest Shacharit per Chacham Yosef Harari-Raful', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, ateret_torah)', false, false),
('sof_zman_tfila_baal_hatanya', 'סוף זמן תפילה בעל התניא', 'Latest Shacharit (Baal HaTanya)', 'Sof Zman Tfila BH', 'Latest Shacharit according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, baal_hatanya)', false, false),
('sof_zman_tfila_mga_120', 'סוף זמן תפילה מג"א 120', 'Latest Shacharit (MGA 120)', 'Sof Zman Tefilla MGA 120', 'Latest Shacharit (MGA from 120min dawn)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_120)', false, false),
('sof_zman_tfila_mga_18', 'סוף זמן תפילה מג"א 18°', 'Latest Shacharit (MGA 18°)', 'Sof Zman Tfila MGA 18', 'Latest Shacharit MGA based on 18° alos/tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_18)', false, false),
('sof_zman_tfila_mga_19_8', 'סוף זמן תפילה מג"א 19.8°', 'Latest Shacharit (MGA 19.8°)', 'Sof Zman Tfila MGA 19.8', 'Latest Shacharit MGA based on 19.8° alos/tzais', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_19_8)', false, false),
('sof_zman_tfila_mga_72_zmanis', 'סוף זמן תפילה מג"א 72 זמניות', 'Latest Shacharit (MGA 72 Zmaniyos)', 'Sof Zman Tfila MGA 72Z', 'Latest Shacharit MGA based on 72 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_72_zmanis)', false, false),
('sof_zman_tfila_mga_90', 'סוף זמן תפילה מג"א 90', 'Latest Shacharit (MGA 90)', 'Sof Zman Tefilla MGA 90', 'Latest Shacharit (MGA from 90min dawn)', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_90)', false, false),
('sof_zman_tfila_mga_90_zmanis', 'סוף זמן תפילה מג"א 90 זמניות', 'Latest Shacharit (MGA 90 Zmaniyos)', 'Sof Zman Tfila MGA 90Z', 'Latest Shacharit MGA based on 90 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_90_zmanis)', false, false),
('sof_zman_tfila_mga_96', 'סוף זמן תפילה מג"א 96', 'Latest Shacharit (MGA 96)', 'Sof Zman Tfila MGA 96', 'Latest Shacharit MGA based on 96 minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_96)', false, false),
('sof_zman_tfila_mga_96_zmanis', 'סוף זמן תפילה מג"א 96 זמניות', 'Latest Shacharit (MGA 96 Zmaniyos)', 'Sof Zman Tfila MGA 96Z', 'Latest Shacharit MGA based on 96 proportional minute day', (SELECT id FROM time_categories WHERE key = 'morning'), 'proportional_hours(4, mga_96_zmanis)', false, false),
('tchillas_zman_kiddush_levana_3', 'תחילת זמן קידוש לבנה 3 ימים', 'Earliest Kiddush Levana (3 Days)', 'Tchillas Kiddush Levana 3', 'Earliest time for Kiddush Levana - 3 days after molad', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'molad + 3days', false, false),
('tchillas_zman_kiddush_levana_7', 'תחילת זמן קידוש לבנה 7 ימים', 'Earliest Kiddush Levana (7 Days)', 'Tchillas Kiddush Levana 7', 'Earliest time for Kiddush Levana - 7 days after molad', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'molad + 7days', false, false),
('tzais_120', 'צאת 120 דקות', 'Tzais (120 min)', 'Tzais 120', 'Fixed 120 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 120min', false, false),
('tzais_120_zmanis', 'צאת 120 דקות זמניות', 'Tzais (120 Zmaniyos)', 'Tzais 120 Zmanis', 'Nightfall 120 proportional minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'proportional_minutes(120, after_sunset)', false, false),
('tzais_13_24', 'צאת 13.24°', 'Tzais (13.24 min)', 'Tzais 13.24', 'Fixed 13.24 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 13min', false, false),
('tzais_13_5', 'צאת 13.5°', 'Tzais (13.5°)', 'Tzais 13.5', 'Stringent nightfall at 13.5°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(13.5, after_sunset)', false, false),
('tzais_18', 'צאת 18°', 'Tzais (18°)', 'Tzais 18', 'Astronomical nightfall (18°)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(18, after_sunset)', false, false),
('tzais_19_8', 'צאת 19.8°', 'Tzais (19.8°)', 'Tzais 19.8', 'Very stringent nightfall at 19.8°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(19.8, after_sunset)', false, false),
('tzais_20', 'צאת 20 דקות', 'Tzais (20 min)', 'Tzais 20', 'Fixed 20 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 20min', false, false),
('tzais_26', 'צאת 26°', 'Tzais (26°)', 'Tzais 26', 'Extremely stringent nightfall', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(26, after_sunset)', false, false),
('tzais_3_65', 'צאת 3.65°', 'Tzais (3.65°)', 'Tzais 3.65', 'Nightfall at 3.65° - Geonim opinion', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(3.65, after_sunset)', false, false),
('tzais_3_676', 'צאת 3.676°', 'Tzais (3.676°)', 'Tzais 3.676', 'Nightfall at 3.676° - Geonim opinion', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(3.676, after_sunset)', false, false),
('tzais_3_7', 'צאת 3.7°', 'Tzais (3.7°)', 'Tzais 3.7', 'Nightfall at 3.7° - Geonim opinion', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(3.7, after_sunset)', false, false),
('tzais_3_8', 'צאת 3.8°', 'Tzais (3.8°)', 'Tzais 3.8', 'Nightfall at 3.8° - Geonim opinion', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(3.8, after_sunset)', false, false),
('tzais_3_stars', 'צאת 3 כוכבים', 'Tzais 3 Stars', 'Tzais 3 Kochavim', 'Three stars visible - standard nightfall', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(8.5, after_sunset)', false, false),
('tzais_42', 'צאת 42 דקות', 'Tzais (42 min)', 'Tzais 42', 'Fixed 42 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 42min', false, false),
('tzais_4_37', 'צאת 4.37°', 'Tzais (4.37°)', 'Tzais 4.37', 'Nightfall at 4.37° - lenient', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(4.37, after_sunset)', false, false),
('tzais_4_61', 'צאת 4.61°', 'Tzais (4.61°)', 'Tzais 4.61', 'Nightfall at 4.61°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(4.61, after_sunset)', false, false),
('tzais_4_8', 'צאת 4.8°', 'Tzais (4.8°)', 'Tzais 4.8', 'Nightfall at 4.8°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(4.8, after_sunset)', false, false),
('tzais_50', 'צאת 50 דקות', 'Tzais (50 min)', 'Tzais 50', 'Fixed 50 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 50min', false, false),
('tzais_5_88', 'צאת 5.88°', 'Tzais (5.88°)', 'Tzais 5.88', 'Nightfall at 5.88°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(5.88, after_sunset)', false, false),
('tzais_5_95', 'צאת 5.95°', 'Tzais (5.95°)', 'Tzais 5.95', 'Nightfall at 5.95°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(5.95, after_sunset)', false, false),
('tzais_6', 'צאת 6°', 'Tzais (6°)', 'Tzais 6', 'Civil twilight end (6°)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(6, after_sunset)', false, false),
('tzais_60', 'צאת 60 דקות', 'Tzais (60 min)', 'Tzais 60', 'Fixed 60 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 60min', false, false),
('tzais_6_45', 'צאת 6.45°', 'Tzais (6.45°)', 'Tzais 6.45', 'Nightfall at 6.45°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(6.45, after_sunset)', false, false),
('tzais_7_08', 'צאת הכוכבים 7.08°', 'Nightfall (7.08°)', 'Tzais Hakochavim 7.08°', 'Three small stars visible when sun is 7.08 degrees below horizon. Used by Manchester community.', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(7.08, after_sunset)', false, false),
('tzais_7_083', 'צאת 7.083°', 'Tzais (7.083°)', 'Tzais 7.083', 'Nightfall at 7.083° (Rabbeinu Tam geometric)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(7.083, after_sunset)', false, false),
('tzais_72_zmanis', 'צאת 72 דקות זמניות', 'Tzais (72 Zmaniyos)', 'Tzais 72 Zmanis', 'Nightfall 72 proportional minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'proportional_minutes(72, after_sunset)', false, false),
('tzais_7_67', 'צאת 7.67°', 'Tzais (7.67°)', 'Tzais 7.67', 'Nightfall at 7.67°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(7.67, after_sunset)', false, false),
('tzais_8_5', 'צאת 8.5°', 'Tzais (8.5°)', 'Tzais 8.5', 'Standard nightfall at 8.5°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(8.5, after_sunset)', false, false),
('tzais_90', 'צאת 90 דקות', 'Tzais (90 min)', 'Tzais 90', 'Fixed 90 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 90min', false, false),
('tzais_90_zmanis', 'צאת 90 דקות זמניות', 'Tzais (90 Zmaniyos)', 'Tzais 90 Zmanis', 'Nightfall 90 proportional minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'proportional_minutes(90, after_sunset)', false, false),
('tzais_9_3', 'צאת 9.3°', 'Tzais (9.3°)', 'Tzais 9.3', 'Nightfall at 9.3°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(9.3, after_sunset)', false, false),
('tzais_96', 'צאת 96 דקות', 'Tzais (96 min)', 'Tzais 96', 'Fixed 96 minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 96min', false, false),
('tzais_96_zmanis', 'צאת 96 דקות זמניות', 'Tzais (96 Zmaniyos)', 'Tzais 96 Zmanis', 'Nightfall 96 proportional minutes after sunset', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'proportional_minutes(96, after_sunset)', false, false),
('tzais_9_75', 'צאת 9.75°', 'Tzais (9.75°)', 'Tzais 9.75', 'Nightfall at 9.75°', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(9.75, after_sunset)', false, false),
('tzais_ateret_torah', 'צאת עטרת תורה', 'Tzais (Ateret Torah)', 'Tzais AT', 'Nightfall per Chacham Yosef Harari-Raful (sunset + 40 min)', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'sunset + 40min', false, false),
('tzais_baal_hatanya', 'צאת בעל התניא', 'Tzais (Baal HaTanya)', 'Tzais BH', 'Nightfall according to Baal HaTanya', (SELECT id FROM time_categories WHERE key = 'nightfall'), 'solar(6.5, after_sunset)', false, false),
('visible_sunrise', 'הנץ הנראה', 'Visible Sunrise', 'Hanetz Hanireh', 'Actual visible sunrise accounting for refraction', (SELECT id FROM time_categories WHERE key = 'sunrise'), 'visible_sunrise', false, false),
('visible_sunset', 'שקיעה נראית', 'Visible Sunset', 'Shkiah Nireis', 'Actual visible sunset', (SELECT id FROM time_categories WHERE key = 'sunset'), 'visible_sunset', false, false);


-- ============================================================================
-- MASTER ZMAN TAGS (linking master_zmanim_registry to zman_tags)
-- ============================================================================

-- Calculation Method
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_90'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_96'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_120'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_30'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_13_24'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_20'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_42'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_50'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_60'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_90'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_96'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_120'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_20'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_60'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_13_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_16_875'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_18'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_72'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_58_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_fixed'), false);

-- Other tags
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_18'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_26'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_60'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_90'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_96'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_120'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_90'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_120'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_90'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_120'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_96'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_18'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_96'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_18'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_mga'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_18'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_26'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir_10_2'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir_11'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir_7_65'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_start'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_stars'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_37'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_61'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_8'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_5_95'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_6'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_7_083'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_7_67'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_8_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_9_3'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_9_75'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_13_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_18'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_26'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_hashachar'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_19'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir_9_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'misheyakir_11_5'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_65'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_676'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_7'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_8'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_5_88'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_6_45'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_2_1'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_2_8'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_3_05'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_13_24'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_2_stars'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_degrees'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_30'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_72'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_72'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_72'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana_72'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_18'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_26'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_60'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_90'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_96'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_120'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_mincha'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'samuch_lmincha_ketana'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_gra'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_sunset'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'yom_tov'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'shabbos'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'is_candle_lighting'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_15'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_18'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_20'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_22'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_30'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting_40'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'candle_lighting'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_sunset'), (SELECT id FROM zman_tags WHERE tag_key = 'day_before'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_37'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_61'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_4_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_5_95'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_6'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_7_083'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_7_67'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_8_5'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_9_3'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_9_75'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_65'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_676'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_7'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_3_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_5_88'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_6_45'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_geonim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'is_havdalah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'is_havdalah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'is_havdalah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'is_havdalah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'night_after'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'night_after'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'night_after'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'night_after'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'shabbos_ends_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_rt'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_72'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_rt'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_13_24'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_rt'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_58_5'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_rt'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_rt_2_stars'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_rt'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_20'), (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_sunset'), (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_20'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_end'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_end'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_end'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_end'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_20'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_72'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_90'), (SELECT id FROM zman_tags WHERE tag_key = 'fast_day'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_20'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_42'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends_50'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_ends'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_72'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_90'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'day_of'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_120_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_120_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'calc_zmanis'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_baal_hatanya'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_gedola_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'mincha_ketana_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'plag_hamincha_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tzais_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_ateret_torah'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_2_hours'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_90'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_120'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_96'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_18'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_tfila_mga_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'category_tefila'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_2_1'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_2_8'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_3_05'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_13_5'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_16_875'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'bein_hashmashos_yereim_18'), (SELECT id FROM zman_tags WHERE tag_key = 'shita_yereim'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_chametz'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tchillas_zman_kiddush_levana_3'), (SELECT id FROM zman_tags WHERE tag_key = 'category_kiddush_levana'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'tchillas_zman_kiddush_levana_7'), (SELECT id FROM zman_tags WHERE tag_key = 'category_kiddush_levana'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_kiddush_levana_15'), (SELECT id FROM zman_tags WHERE tag_key = 'category_kiddush_levana'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_kiddush_levana_between_moldos'), (SELECT id FROM zman_tags WHERE tag_key = 'category_kiddush_levana'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_start'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_72'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_start'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_90'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_start'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'fast_begins_sunset'), (SELECT id FROM zman_tags WHERE tag_key = 'is_fast_start'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_90'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_120'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_16_1'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_72_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_90_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_96'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_96_zmanis'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_18'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_mga_19_8'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_ateret_torah'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_baal_hatanya'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_shma_3_hours'), (SELECT id FROM zman_tags WHERE tag_key = 'category_shema'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'pesach'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_achilas_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'pesach'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_gra'), (SELECT id FROM zman_tags WHERE tag_key = 'pesach'), false);
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated) VALUES ((SELECT id FROM master_zmanim_registry WHERE zman_key = 'sof_zman_biur_chametz_mga'), (SELECT id FROM zman_tags WHERE tag_key = 'pesach'), false);

-- ============================================================================
-- RESTORE SETTINGS
-- ============================================================================
-- Re-enable triggers (restores normal operation for application)
SET session_replication_role = 'origin';

-- Restore synchronous commit (ensures durability for subsequent operations)
SET synchronous_commit = ON;

-- Reset work_mem to default
RESET work_mem;

-- ============================================================================
-- COVERAGE SEARCH MATERIALIZED VIEW
-- ============================================================================
-- Migration: Create materialized view for ultra-fast coverage search
-- This pre-computes all coverage areas with their descriptions for instant search

-- Drop if exists (for re-running)
DROP MATERIALIZED VIEW IF EXISTS coverage_search_mv;

-- Create materialized view with all searchable coverage areas
CREATE MATERIALIZED VIEW coverage_search_mv AS
-- Cities (largest set, ~163k rows)
SELECT
    'city'::text AS coverage_type,
    c.id::text AS id,
    c.name AS name,
    c.name_ascii AS name_ascii,
    CONCAT(
        CASE WHEN d.name IS NOT NULL THEN d.name || ', ' ELSE '' END,
        r.name, ', ', co.name
    ) AS description,
    co.code AS country_code,
    1 AS type_priority,
    COALESCE(c.population, 0) AS sort_population
FROM geo_cities c
JOIN geo_regions r ON c.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id
LEFT JOIN geo_districts d ON c.district_id = d.id

UNION ALL

-- Districts
SELECT
    'district'::text AS coverage_type,
    d.id::text AS id,
    d.name AS name,
    d.name AS name_ascii,  -- Districts don't have name_ascii, use name
    CONCAT(r.name, ', ', co.name) AS description,
    co.code AS country_code,
    2 AS type_priority,
    0::bigint AS sort_population
FROM geo_districts d
JOIN geo_regions r ON d.region_id = r.id
JOIN geo_countries co ON r.country_id = co.id

UNION ALL

-- Regions
SELECT
    'region'::text AS coverage_type,
    r.id::text AS id,
    r.name AS name,
    r.name AS name_ascii,
    co.name AS description,
    co.code AS country_code,
    3 AS type_priority,
    0::bigint AS sort_population
FROM geo_regions r
JOIN geo_countries co ON r.country_id = co.id

UNION ALL

-- Countries
SELECT
    'country'::text AS coverage_type,
    co.id::text AS id,
    co.name AS name,
    co.name AS name_ascii,
    ct.name AS description,
    co.code AS country_code,
    4 AS type_priority,
    0::bigint AS sort_population
FROM geo_countries co
JOIN geo_continents ct ON co.continent_id = ct.id

UNION ALL

-- Continents
SELECT
    'continent'::text AS coverage_type,
    ct.code AS id,
    ct.name AS name,
    ct.name AS name_ascii,
    ''::text AS description,
    ''::text AS country_code,
    5 AS type_priority,
    0::bigint AS sort_population
FROM geo_continents ct;

-- Create unique index for refresh concurrently
CREATE UNIQUE INDEX idx_coverage_search_mv_unique
ON coverage_search_mv (coverage_type, id);

-- GIN trigram indexes for fast fuzzy search (these are the key to performance!)
CREATE INDEX idx_coverage_search_mv_name_trgm
ON coverage_search_mv USING gin (name gin_trgm_ops);

CREATE INDEX idx_coverage_search_mv_name_ascii_trgm
ON coverage_search_mv USING gin (name_ascii gin_trgm_ops);

-- B-tree index for prefix searches (ILIKE 'term%' uses this)
CREATE INDEX idx_coverage_search_mv_name_lower
ON coverage_search_mv (lower(name) text_pattern_ops);

CREATE INDEX idx_coverage_search_mv_name_ascii_lower
ON coverage_search_mv (lower(name_ascii) text_pattern_ops);

-- Composite index for sorting
CREATE INDEX idx_coverage_search_mv_sort
ON coverage_search_mv (type_priority, sort_population DESC, name);

-- Analyze the view for query planner
ANALYZE coverage_search_mv;

-- Create function to refresh the view (call after geo data changes)
CREATE OR REPLACE FUNCTION refresh_coverage_search_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY coverage_search_mv;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW coverage_search_mv IS
'Pre-computed coverage search data for lightning-fast autocomplete. Refresh after geo data imports.';
