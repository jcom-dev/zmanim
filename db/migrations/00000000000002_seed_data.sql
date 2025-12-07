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
INSERT INTO geo_data_sources (id, name, description, data_type, priority, default_accuracy_m, attribution, url) VALUES
('publisher', 'Publisher Override', 'Publisher-specific coordinate/elevation override', 'both', 1, NULL, NULL, NULL),
('community', 'Community Contribution', 'User-submitted corrections (verified)', 'both', 2, NULL, NULL, NULL),
('simplemaps', 'SimpleMaps World Cities', 'Government-surveyed coordinates (NGIA, USGS, Census)', 'coordinates', 3, 50, 'Data provided by SimpleMaps', 'https://simplemaps.com/data/world-cities'),
('wof', 'Who''s On First', 'Polygon centroids from WOF gazetteer', 'coordinates', 4, 1000, 'Data from Who''s On First, a gazetteer of places', 'https://whosonfirst.org/'),
('glo90', 'Copernicus GLO-90', 'Copernicus 90m Digital Elevation Model', 'elevation', 3, 1, '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA', 'https://copernicus-dem-90m.s3.amazonaws.com/');

-- ============================================================================
-- DAY TYPES
-- ============================================================================
INSERT INTO day_types (id, name, display_name_hebrew, display_name_english, description, parent_type, sort_order) VALUES
('827a57ba-81b4-49ec-a244-cd1c5455e6b6', 'weekday', 'יום חול', 'Weekday', 'Regular weekday (Sunday-Thursday)', NULL, 10),
('9bcc31da-94f2-4353-ac37-cedf4af14249', 'friday', 'יום שישי', 'Friday', 'Friday (Erev Shabbos)', 'weekday', 15),
('8db25bcc-2d32-4c29-9e9a-d33730e420cf', 'erev_shabbos', 'ערב שבת', 'Erev Shabbos', 'Friday afternoon before Shabbos', NULL, 20),
('19839ebc-e2d9-49bc-8482-be7d6ace2456', 'shabbos', 'שבת', 'Shabbos', 'Shabbat day', NULL, 25),
('7004052c-1337-46d3-8bc8-38481da2f7c4', 'motzei_shabbos', 'מוצאי שבת', 'Motzei Shabbos', 'Saturday night after Shabbos', NULL, 30),
('8b902cc1-96be-491d-af54-8702aa833768', 'erev_yom_tov', 'ערב יום טוב', 'Erev Yom Tov', 'Day before Yom Tov', NULL, 40),
('b4cf3d17-4a26-471d-a672-ff2a17651993', 'yom_tov', 'יום טוב', 'Yom Tov', 'Festival day (Pesach, Shavuos, Sukkos, etc.)', NULL, 45),
('96913326-3b01-4c64-945d-e45fe86d8f10', 'motzei_yom_tov', 'מוצאי יום טוב', 'Motzei Yom Tov', 'Night after Yom Tov', NULL, 50),
('4bf88b63-2b13-403b-b4c6-b269619ec39c', 'chol_hamoed', 'חול המועד', 'Chol HaMoed', 'Intermediate festival days', NULL, 55),
('68509553-7a7c-4cb3-ae2a-a3e69497604e', 'erev_pesach', 'ערב פסח', 'Erev Pesach', 'Day before Pesach', 'erev_yom_tov', 60),
('93a6a6b7-f228-499a-92c5-2d2a8f570e08', 'pesach', 'פסח', 'Pesach', 'Passover (first and last days)', 'yom_tov', 61),
('6f1a2e8c-f551-4f50-bb4d-8777704972e3', 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', 'Day before Shavuos', 'erev_yom_tov', 65),
('3af7a036-675f-4a74-a343-d91f64903448', 'shavuos', 'שבועות', 'Shavuos', 'Feast of Weeks', 'yom_tov', 66),
('f53a331d-8e20-45f4-a591-a36517ad08d9', 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', 'Day before Rosh Hashanah', 'erev_yom_tov', 70),
('49fc433f-fc18-43ce-9f03-c74d60d88e94', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'Jewish New Year', 'yom_tov', 71),
('db11bf2c-ff8a-4df0-9dc8-346f0d40f869', 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', 'Day before Yom Kippur', 'erev_yom_tov', 75),
('09cbc643-2d18-4bd3-b5e9-7507390d7cc5', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'Day of Atonement', 'yom_tov', 76),
('e4f6a20b-5192-49e9-b0f5-6db06a8736a6', 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', 'Day before Sukkos', 'erev_yom_tov', 80),
('a35192be-1755-4818-9dad-27d835beda0c', 'sukkos', 'סוכות', 'Sukkos', 'Feast of Tabernacles', 'yom_tov', 81),
('2b545007-b93c-4408-b4ea-1a7927d6422a', 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', '7th day of Sukkos', 'chol_hamoed', 82),
('b18d718b-cb6d-4c66-b733-574612034c3d', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', '8th day of Sukkos', 'yom_tov', 83),
('099faed5-4afc-4c07-a271-29d9e87f44b5', 'simchas_torah', 'שמחת תורה', 'Simchas Torah', 'Rejoicing of the Torah', 'yom_tov', 84),
('721bce1d-42ca-4d89-bfc2-d480c2be10d2', 'taanis', 'תענית', 'Fast Day', 'General fast day', NULL, 100),
('b808187f-e004-45a6-adbc-929cd8c8a045', 'taanis_start', 'תחילת תענית', 'Beginning of Fast', 'Start of a fast day', 'taanis', 101),
('f58a6b40-95d7-4d4a-9bba-d01a5962eb71', 'taanis_end', 'סוף תענית', 'End of Fast', 'End of a fast day', 'taanis', 102),
('fb97a26b-6f03-41cd-82ca-f3b57c05e3a2', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'Fast of Gedaliah', 'taanis', 110),
('1eecad76-c9ca-4f70-9fd2-675cc6b96dc0', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', '10th of Teves', 'taanis', 111),
('5b20382c-e8db-472b-b3a6-ebb8d289824a', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'Fast of Esther', 'taanis', 112),
('e37a2a0c-334b-4aba-8a6d-c340b73e2b7a', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', '17th of Tamuz', 'taanis', 113),
('e5e570c4-2efd-4dc0-8c42-eab66f254008', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', '9th of Av', 'taanis', 114),
('f8f1c070-97ff-4f78-b4a3-b187e2a56adc', 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', 'Evening before Tisha B''Av when the fast begins at sunset', 'taanis', 115),
('120b8448-8a83-437f-ae28-4634fe5ca8f5', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'New month', NULL, 120),
('2a11e6f7-6a4e-41ba-9b69-dd9762a2f674', 'chanukah', 'חנוכה', 'Chanukah', 'Festival of Lights', NULL, 130),
('b67c2fba-0f5f-424a-b0a5-0ecfbbcf5f24', 'purim', 'פורים', 'Purim', 'Feast of Lots', NULL, 135),
('91bd98fc-a3e9-4b33-9639-432a5e81e360', 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'Purim in walled cities', NULL, 136),
('cf2f182d-efab-4451-93ee-00231a9ec6c1', 'lag_baomer', 'ל"ג בעומר', 'Lag BaOmer', '33rd day of Omer', NULL, 140),
('e40c7369-a8ef-4e71-82d1-98f6f6098340', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'New Year of Trees', NULL, 145),
('7fb38b40-8b9f-42f7-9128-1838427e85bc', 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', 'Israel Independence Day', NULL, 150),
('e8a1d82c-6344-4d55-b3cf-884abaf9a9a4', 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', 'Jerusalem Day', NULL, 151),
('4ec64456-7b10-4a3b-9435-4b7b34b686e1', 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', 'Memorial Day', NULL, 152),
('3e5a2a6e-de81-4832-a86b-aa90733a745b', 'yom_hashoah', 'יום השואה', 'Yom HaShoah', 'Holocaust Remembrance Day', NULL, 153);

-- ============================================================================
-- JEWISH EVENTS
-- ============================================================================
INSERT INTO jewish_events (id, code, name_hebrew, name_english, event_type, duration_days_israel, duration_days_diaspora, fast_start_type, parent_event_code, sort_order) VALUES
('20a2e8d5-7462-471a-b8ea-f47757cad6c2', 'shabbos', 'שבת', 'Shabbos', 'weekly', 1, 1, NULL, NULL, 10),
('53fcba17-8db2-4355-aaf7-6f75a48cd6d6', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'fast', 1, 1, 'sunset', NULL, 20),
('d1283681-58e3-46cb-8c13-8cc22bc42228', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'fast', 1, 1, 'sunset', NULL, 21),
('e72351c4-b2e0-4325-a4b0-6251ffdbf137', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'fast', 1, 1, 'dawn', NULL, 30),
('28d8d191-1ef3-4214-97d9-c1f0a6313956', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', 'fast', 1, 1, 'dawn', NULL, 31),
('23235ac3-3c66-4d9f-a63a-769e1f3ebb7d', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', 'fast', 1, 1, 'dawn', NULL, 32),
('77664e4c-a0a4-458b-b30f-f735c31df243', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'fast', 1, 1, 'dawn', NULL, 33),
('621e3fb7-bbbb-4e5b-bc4f-0d4be8ba082e', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'yom_tov', 2, 2, NULL, NULL, 40),
('b6b8237c-2b9a-4782-8869-12f2a551ccb1', 'sukkos', 'סוכות', 'Sukkos', 'yom_tov', 1, 2, NULL, NULL, 50),
('9c86866a-5a90-4cb1-a248-d317b783dcc2', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', 'yom_tov', 1, 2, NULL, NULL, 51),
('b153da61-3924-4082-ac5c-1643205fd4c6', 'pesach_first', 'פסח (ראשון)', 'Pesach (First Days)', 'yom_tov', 1, 2, NULL, NULL, 60),
('76fefedc-7eff-4b11-a9eb-4d9df7e28acd', 'pesach_last', 'פסח (אחרון)', 'Pesach (Last Days)', 'yom_tov', 1, 2, NULL, NULL, 61),
('743f800b-d374-4e31-b3e0-b6cd011c11fb', 'shavuos', 'שבועות', 'Shavuos', 'yom_tov', 1, 2, NULL, NULL, 70),
('4fa4456c-db83-4b9b-ac91-4ea4b0a8acf1', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'informational', 1, 1, NULL, NULL, 100),
('771787f8-3cd3-431a-8604-624912953ab0', 'chanukah', 'חנוכה', 'Chanukah', 'informational', 8, 8, NULL, NULL, 110),
('f9fbed84-9199-4531-8fa7-70c2dd385766', 'purim', 'פורים', 'Purim', 'informational', 1, 1, NULL, NULL, 120),
('7363bad8-8c67-44a9-bd91-6e9cb1226d95', 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'informational', 1, 1, NULL, NULL, 121),
('5f8ef1e0-7e96-462e-8213-a54e62483423', 'lag_baomer', 'ל"ג בעומר', 'Lag BaOmer', 'informational', 1, 1, NULL, NULL, 130),
('f614de0a-4f35-4243-9c8b-686381b2cdbb', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'informational', 1, 1, NULL, NULL, 140),
('84bc0e7c-9d68-46ea-b759-377a2a1ce165', 'yom_haatzmaut', 'יום העצמאות', 'Yom HaAtzmaut', 'informational', 1, 1, NULL, NULL, 150),
('ccaacc09-1122-4ea6-a77f-c8ebc07a7b22', 'yom_yerushalayim', 'יום ירושלים', 'Yom Yerushalayim', 'informational', 1, 1, NULL, NULL, 151),
('096426f4-d9d0-4a8e-b73d-e6203ffed2e0', 'yom_hazikaron', 'יום הזיכרון', 'Yom HaZikaron', 'informational', 1, 1, NULL, NULL, 152),
('f0c3e82b-a187-426f-a6fd-69d0b2b36667', 'yom_hashoah', 'יום השואה', 'Yom HaShoah', 'informational', 1, 1, NULL, NULL, 153);

-- ============================================================================
-- TAG TYPES
-- ============================================================================
INSERT INTO tag_types (id, key, display_name_hebrew, display_name_english, color, sort_order) VALUES
('a1b2c3d4-1111-1111-1111-111111111111', 'event', 'אירוע', 'Event', 'blue', 1),
('a1b2c3d4-2222-2222-2222-222222222222', 'timing', 'זמן', 'Timing', 'green', 2),
('a1b2c3d4-3333-3333-3333-333333333333', 'behavior', 'התנהגות', 'Behavior', 'orange', 3),
('a1b2c3d4-4444-4444-4444-444444444444', 'shita', 'שיטה', 'Opinion', 'purple', 4),
('a1b2c3d4-5555-5555-5555-555555555555', 'calculation', 'חישוב', 'Calculation', 'red', 5),
('a1b2c3d4-6666-6666-6666-666666666666', 'category', 'קטגוריה', 'Category', 'gray', 6),
('a1b2c3d4-7777-7777-7777-777777777777', 'jewish_day', 'יום יהודי', 'Jewish Day', 'amber', 7);

-- ============================================================================
-- TIME CATEGORIES
-- ============================================================================
INSERT INTO time_categories (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, is_everyday) VALUES
('f1e2d3c4-0001-0001-0001-000100010001', 'dawn', 'שחר', 'Dawn', 'Pre-sunrise times', 'Moon', 'purple', 1, true),
('f1e2d3c4-0002-0002-0002-000200020002', 'sunrise', 'נץ', 'Sunrise', 'Sunrise times', 'Sun', 'amber', 2, true),
('f1e2d3c4-0003-0003-0003-000300030003', 'morning', 'בוקר', 'Morning', 'Morning times', 'Clock', 'yellow', 3, true),
('f1e2d3c4-0004-0004-0004-000400040004', 'midday', 'צהריים', 'Midday', 'Midday times', 'Clock', 'orange', 4, true),
('f1e2d3c4-0005-0005-0005-000500050005', 'afternoon', 'אחה"צ', 'Afternoon', 'Afternoon times', 'Clock', 'amber', 5, true),
('f1e2d3c4-0006-0006-0006-000600060006', 'sunset', 'שקיעה', 'Sunset', 'Sunset times', 'Sunset', 'rose', 6, true),
('f1e2d3c4-0007-0007-0007-000700070007', 'nightfall', 'לילה', 'Nightfall', 'Nightfall times', 'Moon', 'indigo', 7, true),
('f1e2d3c4-0008-0008-0008-000800080008', 'midnight', 'חצות', 'Midnight', 'Midnight times', 'Moon', 'slate', 8, true);

-- ============================================================================
-- DISPLAY GROUPS
-- ============================================================================
INSERT INTO display_groups (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, time_categories) VALUES
('0dd75197-9fad-4d7f-8244-50a57321b71e', 'dawn', 'שחר', 'Dawn', 'Pre-sunrise zmanim', 'Moon', 'purple', 1, '{dawn}'),
('006c073c-8c57-456e-854f-8a2389d272b8', 'morning', 'בוקר', 'Morning', 'Sunrise through late morning zmanim', 'Sun', 'amber', 2, '{sunrise,morning}'),
('e654deb8-7c91-4246-81f3-e890ee772983', 'midday', 'צהריים', 'Midday', 'Midday and afternoon zmanim', 'Clock', 'orange', 3, '{midday,afternoon}'),
('8596de98-4cd9-4588-8f1f-dd57680ad495', 'evening', 'ערב', 'Evening', 'Sunset through nightfall zmanim', 'Sunset', 'rose', 4, '{sunset,nightfall,midnight}');

-- ============================================================================
-- EVENT CATEGORIES
-- ============================================================================
INSERT INTO event_categories (id, key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order) VALUES
('176f4f87-4ed9-4b19-a49d-1e5539321965', 'candles', 'הדלקת נרות', 'Candle Lighting', 'Shabbos, Yom Tov, and Yom Kippur', 'Flame', 'amber', 1),
('1598cea6-9bf1-4c80-a06d-066f76850c7b', 'havdalah', 'הבדלה', 'Havdalah', 'End of Shabbos and Yom Tov', 'Flame', 'purple', 2),
('e412b990-18c2-4444-96e6-3cdbc61ee78b', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'Fast start and end times', 'Moon', 'slate', 3),
('b9320a2f-dc59-4493-a6ce-eb4d67d8c076', 'fast_day', 'תענית', 'Fast Days', 'Fast end times (regular fasts)', 'Timer', 'gray', 4),
('be81f9c3-1b2c-4e7b-994e-3edafea99a7f', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'Fast starts at sunset, ends at nightfall', 'Moon', 'slate', 5),
('9796dce4-88f2-4292-bf0b-6f94456a0da7', 'pesach', 'פסח', 'Pesach', 'Chametz eating and burning times', 'Utensils', 'green', 6);

-- ============================================================================
-- ASTRONOMICAL PRIMITIVES
-- ============================================================================
INSERT INTO astronomical_primitives (id, variable_name, display_name, description, formula_dsl, category, calculation_type, solar_angle, is_dawn, edge_type, sort_order) VALUES
('0321a89a-0bd3-44a1-9353-993cc97b35ea', 'sunrise', 'Sunrise', 'Geometric sunrise - sun center crosses the horizon (0°)', 'sunrise', 'horizon', 'horizon', NULL, true, 'center', 100),
('d9e48271-ae23-4340-add7-953011a84f6e', 'sunset', 'Sunset', 'Geometric sunset - sun center crosses the horizon (0°)', 'sunset', 'horizon', 'horizon', NULL, false, 'center', 101),
('bc54c077-fa5c-4eea-8d38-ee5991db43dc', 'sunrise_visible', 'Sunrise (Visible)', 'First visible edge of sun appears above horizon (accounting for refraction)', 'visible_sunrise', 'horizon', 'horizon', NULL, true, 'top_edge', 102),
('ce459996-0bc4-465a-8488-1f7aed1abcde', 'sunset_visible', 'Sunset (Visible)', 'Last visible edge of sun disappears below horizon (accounting for refraction)', 'visible_sunset', 'horizon', 'horizon', NULL, false, 'top_edge', 103),
('d035938b-8a66-46a3-a212-bea0e1cac378', 'civil_dawn', 'Civil Dawn', 'Sun 6° below horizon - enough light for outdoor activities without artificial light', 'solar(6, before_sunrise)', 'civil_twilight', 'solar_angle', 6.00, true, 'center', 200),
('bed4d0bb-2593-4085-9793-437f630bda81', 'civil_dusk', 'Civil Dusk', 'Sun 6° below horizon - artificial light needed for outdoor activities', 'solar(6, after_sunset)', 'civil_twilight', 'solar_angle', 6.00, false, 'center', 201),
('c4fe4542-ebb5-4641-aab0-a3e96696f410', 'nautical_dawn', 'Nautical Dawn', 'Sun 12° below horizon - horizon visible at sea for navigation', 'solar(12, before_sunrise)', 'nautical_twilight', 'solar_angle', 12.00, true, 'center', 300),
('35dedb70-b2c3-4355-a507-cedbf3927091', 'nautical_dusk', 'Nautical Dusk', 'Sun 12° below horizon - horizon no longer visible at sea', 'solar(12, after_sunset)', 'nautical_twilight', 'solar_angle', 12.00, false, 'center', 301),
('5ed694f0-32f6-4b46-8227-0948eac4cc3c', 'astronomical_dawn', 'Astronomical Dawn', 'Sun 18° below horizon - sky completely dark before this, first hint of light', 'solar(18, before_sunrise)', 'astronomical_twilight', 'solar_angle', 18.00, true, 'center', 400),
('98d890e2-6931-4e07-94c7-009ea4398fdf', 'astronomical_dusk', 'Astronomical Dusk', 'Sun 18° below horizon - sky becomes completely dark after this', 'solar(18, after_sunset)', 'astronomical_twilight', 'solar_angle', 18.00, false, 'center', 401),
('baa5e9be-ac0e-4b57-9493-b52a7cebe08c', 'solar_noon', 'Solar Noon', 'Sun at highest point in the sky (transit/meridian crossing)', 'solar_noon', 'solar_position', 'transit', NULL, NULL, 'center', 500),
('409372fe-3ff2-4a22-9890-ee2fa1978646', 'solar_midnight', 'Solar Midnight', 'Sun at lowest point (anti-transit) - opposite side of Earth', 'solar_midnight', 'solar_position', 'transit', NULL, NULL, 'center', 501);

-- ============================================================================
-- ALGORITHM TEMPLATES
-- ============================================================================
INSERT INTO algorithm_templates (id, template_key, name, description, configuration, sort_order, is_active) VALUES
('8bd80e4d-727e-4632-a485-7a9ef7a1a4f4', 'gra', 'GRA (Vilna Gaon)', 'Standard calculation based on the Vilna Gaon. Uses sunrise to sunset for proportional hours.', '{"name": "GRA", "zmanim": {"tzais": {"method": "solar_angle", "params": {"degrees": 8.5}}, "sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "gra", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "gra", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "gra", "hours": 10.75}}, "alos_hashachar": {"method": "solar_angle", "params": {"degrees": 16.1}}, "sof_zman_shma_gra": {"method": "proportional", "params": {"base": "gra", "hours": 3.0}}, "sof_zman_tfila_gra": {"method": "proportional", "params": {"base": "gra", "hours": 4.0}}}, "description": "Vilna Gaon standard calculation"}', 1, true),
('f6ee7167-7c94-41f9-9565-acf592d0c212', 'mga', 'MGA (Magen Avraham)', 'Magen Avraham calculation. Uses 72 minutes before sunrise to 72 minutes after sunset for proportional hours.', '{"name": "MGA", "zmanim": {"sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "tzeis_72": {"method": "fixed_minutes", "params": {"from": "sunset", "minutes": 72.0}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "mga", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "mga", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "mga", "hours": 10.75}}, "alos_hashachar": {"method": "fixed_minutes", "params": {"from": "sunrise", "minutes": -72.0}}, "sof_zman_shma_mga": {"method": "proportional", "params": {"base": "mga", "hours": 3.0}}, "sof_zman_tfila_mga": {"method": "proportional", "params": {"base": "mga", "hours": 4.0}}}, "description": "Magen Avraham calculation"}', 2, true),
('ef5d28b3-e8f9-4d56-a1a3-93d1c6eea8ce', 'rabbeinu_tam', 'Rabbeinu Tam', 'Uses 72 minutes after sunset for tzeis based on Rabbeinu Tam''s opinion.', '{"name": "Rabbeinu Tam", "zmanim": {"tzais": {"method": "solar_angle", "params": {"degrees": 8.5}}, "sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}, "tzeis_72": {"method": "fixed_minutes", "params": {"from": "sunset", "minutes": 72.0}}, "misheyakir": {"method": "solar_angle", "params": {"degrees": 11.5}}, "mincha_gedola": {"method": "proportional", "params": {"base": "gra", "hours": 6.5}}, "mincha_ketana": {"method": "proportional", "params": {"base": "gra", "hours": 9.5}}, "plag_hamincha": {"method": "proportional", "params": {"base": "gra", "hours": 10.75}}, "alos_hashachar": {"method": "solar_angle", "params": {"degrees": 16.1}}, "sof_zman_shma_gra": {"method": "proportional", "params": {"base": "gra", "hours": 3.0}}, "sof_zman_tfila_gra": {"method": "proportional", "params": {"base": "gra", "hours": 4.0}}}, "description": "Rabbeinu Tam calculation for tzeis"}', 3, true),
('d235c40d-adb2-4f9d-af4b-c8c0fde18216', 'custom', 'Custom', 'Start with basic times and customize each zman according to your minhag.', '{"name": "Custom", "zmanim": {"sunset": {"method": "sunset", "params": {}}, "chatzos": {"method": "midpoint", "params": {"end": "sunset", "start": "sunrise"}}, "sunrise": {"method": "sunrise", "params": {}}}, "description": "Custom algorithm"}', 4, true);

-- ============================================================================
-- ZMAN TAGS
-- ============================================================================
INSERT INTO zman_tags (id, tag_key, name, display_name_hebrew, display_name_english, tag_type, description, color, sort_order) VALUES
-- Event tags
('3d9fe336-6850-441e-b3c9-7a77a9905f86', 'shabbos', 'shabbos', 'שבת', 'Shabbos', 'event', 'Applies to Shabbos', NULL, 10),
('348cdd17-1d15-44a0-be8f-0e08eb3fd9d3', 'yom_tov', 'yom_tov', 'יום טוב', 'Yom Tov', 'event', 'Applies to Yom Tov (major holidays)', NULL, 20),
('1feaa67a-0113-4930-86e0-eaaca1d070e1', 'yom_kippur', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'event', 'Applies to Yom Kippur', NULL, 30),
('e017a942-e640-4b48-8cc6-1fdd30164454', 'fast_day', 'fast_day', 'תענית', 'Fast Day', 'event', 'Applies to minor fast days', NULL, 40),
('191e5b1f-7183-43b2-93f8-c8c7dea23332', 'tisha_bav', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'event', 'Applies to Tisha B''Av', NULL, 50),
('ac00968d-5d85-461f-bdf4-43705cae56e5', 'pesach', 'pesach', 'ערב פסח', 'Erev Pesach', 'event', 'Applies to Erev Pesach (chametz times)', NULL, 60),
-- Timing tags
('fe7d8d90-0161-45a1-94ca-9a9f9c8d5e78', 'day_before', 'day_before', 'יום לפני', 'Day Before', 'timing', 'Display on the day before the event (e.g., candle lighting)', NULL, 100),
('f5308ac8-cf95-4d73-9d44-f7e85fce6425', 'day_of', 'day_of', 'יום של', 'Day Of', 'timing', 'Display on the day of the event', NULL, 110),
('84b9580e-7adf-4bc1-9d22-5d9eacf296fd', 'night_after', 'night_after', 'לילה אחרי', 'Night After', 'timing', 'Display on the night after the event (e.g., havdalah)', NULL, 120),
-- Behavior tags
('b8946537-0457-4f9f-9068-e07b2d389c0a', 'is_candle_lighting', 'is_candle_lighting', 'הדלקת נרות', 'Candle Lighting', 'behavior', 'This is a candle lighting time', NULL, 200),
('6c10a75d-ab64-46ee-b801-66fce7c75844', 'is_havdalah', 'is_havdalah', 'הבדלה', 'Havdalah', 'behavior', 'This is a havdalah/end of Shabbos time', NULL, 210),
('e9783be0-7610-4441-ad36-ba24e980fcbd', 'is_fast_start', 'is_fast_start', 'תחילת צום', 'Fast Begins', 'behavior', 'This marks when a fast begins', NULL, 220),
('5059e4c2-2ccd-4a8c-9696-dc77de8bd4dd', 'is_fast_end', 'is_fast_end', 'סוף צום', 'Fast Ends', 'behavior', 'This marks when a fast ends', NULL, 230),
-- Shita (Opinion) tags
('a1000001-0001-0001-0001-000000000001', 'shita_gra', 'shita_gra', 'גר"א', 'GRA (Vilna Gaon)', 'shita', 'Gaon of Vilna - day from sunrise to sunset', NULL, 10),
('a1000001-0001-0001-0001-000000000002', 'shita_mga', 'shita_mga', 'מג"א', 'MGA (Magen Avraham)', 'shita', 'Magen Avraham - day from alos to tzais (72 min)', NULL, 20),
('a1000001-0001-0001-0001-000000000003', 'shita_rt', 'shita_rt', 'ר"ת', 'Rabbeinu Tam', 'shita', 'Rabbeinu Tam - 72 minutes after sunset for nightfall', NULL, 30),
('a1000001-0001-0001-0001-000000000004', 'shita_baal_hatanya', 'shita_baal_hatanya', 'בעל התניא', 'Baal HaTanya', 'shita', 'Shulchan Aruch HaRav (Chabad)', NULL, 40),
('a1000001-0001-0001-0001-000000000005', 'shita_ateret_torah', 'shita_ateret_torah', 'עטרת תורה', 'Ateret Torah', 'shita', 'Chacham Yosef Harari-Raful (Sephardic)', NULL, 50),
('a1000001-0001-0001-0001-000000000006', 'shita_geonim', 'shita_geonim', 'גאונים', 'Geonim', 'shita', 'Various Geonic opinions on nightfall degrees', NULL, 60),
('a1000001-0001-0001-0001-000000000007', 'shita_yereim', 'shita_yereim', 'יראים', 'Yereim', 'shita', 'Sefer Yereim - bein hashmashos calculations', NULL, 70),
-- Calculation tags
('a1000001-0001-0001-0001-000000000010', 'calc_fixed', 'calc_fixed', 'זמן קבוע', 'Fixed Time', 'calculation', 'Fixed minute offset (not proportional)', NULL, 100),
('a1000001-0001-0001-0001-000000000011', 'calc_zmanis', 'calc_zmanis', 'שעות זמניות', 'Proportional (Zmaniyos)', 'calculation', 'Proportional/seasonal minutes based on day length', NULL, 110),
('a1000001-0001-0001-0001-000000000012', 'calc_degrees', 'calc_degrees', 'מעלות', 'Solar Degrees', 'calculation', 'Based on sun position in degrees below horizon', NULL, 120),
-- Category tags
('a1000001-0001-0001-0001-000000000020', 'category_shema', 'category_shema', 'קריאת שמע', 'Shema Times', 'category', 'Times related to Shema recitation', NULL, 200),
('a1000001-0001-0001-0001-000000000021', 'category_tefila', 'category_tefila', 'תפילה', 'Prayer Times', 'category', 'Times related to prayer services', NULL, 210),
('a1000001-0001-0001-0001-000000000022', 'category_mincha', 'category_mincha', 'מנחה', 'Mincha Times', 'category', 'Times related to afternoon prayer', NULL, 220),
('a1000001-0001-0001-0001-000000000023', 'category_chametz', 'category_chametz', 'חמץ', 'Chametz Times', 'category', 'Times related to chametz on Erev Pesach', NULL, 230),
('a1000001-0001-0001-0001-000000000024', 'category_kiddush_levana', 'category_kiddush_levana', 'קידוש לבנה', 'Kiddush Levana', 'category', 'Times for sanctifying the moon', NULL, 240),
-- Jewish Day tags
('4bf5debe-da76-40c2-a815-a0e11a709464', 'omer', 'omer', 'ספירת העומר', 'Sefirat HaOmer', 'jewish_day', 'During the Omer counting period (49 days)', NULL, 300),
('302870a5-17f2-41f9-b4ac-481adbe52422', 'chanukah', 'chanukah', 'חנוכה', 'Chanukah', 'jewish_day', 'Festival of Lights (8 days)', NULL, 310),
('8bb294a7-66e3-4a94-9acc-8e58212a88ff', 'purim', 'purim', 'פורים', 'Purim', 'jewish_day', 'Feast of Lots', NULL, 320),
('8713dabe-b731-4eb3-84d4-6dac910a36e7', 'shushan_purim', 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'jewish_day', 'Purim in walled cities', NULL, 321),
('c71a0aaa-0476-434d-bf5f-bccc08c2e8fc', 'taanis_esther', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'jewish_day', 'Fast of Esther', NULL, 322),
('49a4fae2-1604-4456-a560-09abf5ef3b70', 'erev_pesach', 'erev_pesach', 'ערב פסח', 'Erev Pesach', 'jewish_day', 'Day before Passover (chametz times)', NULL, 330),
('1d191690-84c1-4c43-89b1-094e4764afe1', 'chol_hamoed_pesach', 'chol_hamoed_pesach', 'חול המועד פסח', 'Chol HaMoed Pesach', 'jewish_day', 'Intermediate days of Pesach', NULL, 332),
('368e1453-6c63-4882-9baa-6048f430c06c', 'erev_shavuos', 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', 'jewish_day', 'Day before Shavuos', NULL, 340),
('d381713f-dfa4-46ba-9efc-24eb782b93e6', 'shavuos', 'shavuos', 'שבועות', 'Shavuos', 'jewish_day', 'Feast of Weeks', NULL, 341),
('3f0b5b4a-ab95-4c13-b8a0-966164001cb8', 'selichos', 'selichos', 'סליחות', 'Selichos', 'jewish_day', 'Penitential prayer period', NULL, 350),
('e0fe3646-0a4d-4c64-8e5c-ada80aa603b7', 'erev_rosh_hashanah', 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', 'jewish_day', 'Day before Rosh Hashanah', NULL, 351),
('f6a0fb66-f459-48be-8b44-fe2f52ad225d', 'rosh_hashanah', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'jewish_day', 'Jewish New Year (2 days)', NULL, 352),
('64b6581c-c0f7-4346-aac4-2e758e10e531', 'tzom_gedaliah', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'jewish_day', 'Fast of Gedaliah', NULL, 353),
('99870a49-031f-4d13-a2e4-716159b60ca7', 'aseres_yemei_teshuva', 'aseres_yemei_teshuva', 'עשרת ימי תשובה', 'Ten Days of Repentance', 'jewish_day', 'Period from RH to YK', NULL, 354),
('d9f86bff-0b80-4a3e-b834-4b351794b310', 'erev_yom_kippur', 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', 'jewish_day', 'Day before Yom Kippur', NULL, 355),
('c9231e0a-5458-41fe-bf9c-bd26a79a353d', 'erev_sukkos', 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', 'jewish_day', 'Day before Sukkos', NULL, 360),
('913d1fb2-ffaf-4905-a515-08c1dd9ada52', 'sukkos', 'sukkos', 'סוכות', 'Sukkos', 'jewish_day', 'Feast of Tabernacles', NULL, 361),
('894e1790-17f6-40e3-8231-f888ec1832c2', 'chol_hamoed_sukkos', 'chol_hamoed_sukkos', 'חול המועד סוכות', 'Chol HaMoed Sukkos', 'jewish_day', 'Intermediate days of Sukkos', NULL, 362),
('bc628dac-715b-47ce-a34e-bc58e394090b', 'hoshanah_rabbah', 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', 'jewish_day', '7th day of Sukkos', NULL, 363),
('81865c20-30be-4fc1-8172-4d263bb3ae86', 'shemini_atzeres', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', 'jewish_day', '8th day of assembly', NULL, 364),
('66b44e12-2535-4269-b7a4-23de9602c300', 'simchas_torah', 'simchas_torah', 'שמחת תורה', 'Simchas Torah', 'jewish_day', 'Rejoicing of the Torah (Diaspora: day 2)', NULL, 365),
('2a9396fd-e00d-4f13-9cbd-bf60c665dbc8', 'asarah_bteves', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', 'jewish_day', '10th of Teves fast', NULL, 370),
('049f5f38-4746-44fa-b2b5-381f646edd38', 'shiva_asar_btamuz', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', 'jewish_day', '17th of Tamuz fast', NULL, 371),
('6c5249f7-971b-48e9-8a2f-29fbaf1c5f03', 'erev_tisha_bav', 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', 'jewish_day', 'Day/night before Tisha B''Av', NULL, 373),
('935e2362-dc26-4e27-becc-679c5a45bf78', 'three_weeks', 'three_weeks', 'בין המצרים', 'The Three Weeks', 'jewish_day', 'Period between 17 Tamuz and 9 Av', NULL, 380),
('537c62ae-1e6b-41b9-bb76-03cc2b61e243', 'nine_days', 'nine_days', 'תשעת הימים', 'The Nine Days', 'jewish_day', 'First 9 days of Av', NULL, 381),
('d17c3cc6-5e57-4f99-b979-765fa2a78d78', 'rosh_chodesh', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'jewish_day', 'New Moon/Month', NULL, 390),
('4ab63bdf-c41a-4c5e-b4a3-2663d2009187', 'tu_bshvat', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'jewish_day', 'New Year for Trees', NULL, 391);

-- ============================================================================
-- ZMANIM TEMPLATES
-- ============================================================================
INSERT INTO zmanim_templates (id, zman_key, hebrew_name, english_name, formula_dsl, category, description, is_required) VALUES
('a1c051a8-aae2-44b3-b6b1-4af02eac4419', 'alos_hashachar', 'עלות השחר', 'Alos Hashachar (Dawn)', 'solar(16.1, before_sunrise)', 'essential', NULL, true),
('4c5efb9a-0924-449f-ae30-0bdc946a2961', 'misheyakir', 'משיכיר', 'Misheyakir', 'solar(11.5, before_sunrise)', 'essential', NULL, true),
('c2c72a97-dca4-438b-b091-3d994dbc1262', 'sunrise', 'הנץ החמה', 'Sunrise', 'sunrise', 'essential', NULL, true),
('67c2b01f-4f5b-4ab0-a9cf-d7afd8d6eafa', 'sof_zman_shma_gra', 'סוף זמן ק"ש גר"א', 'Latest Shema (GRA)', 'proportional_hours(3, gra)', 'essential', NULL, true),
('1b3234d7-685d-41cf-be71-a7c573f8d301', 'sof_zman_shma_mga', 'סוף זמן ק"ש מג"א', 'Latest Shema (MGA)', 'proportional_hours(3, mga)', 'essential', NULL, true),
('b273b840-649f-48cb-b8ce-ea9f43fd27ab', 'sof_zman_tfila_gra', 'סוף זמן תפילה גר"א', 'Latest Shacharit (GRA)', 'proportional_hours(4, gra)', 'essential', NULL, true),
('309d8eed-f819-4727-afd3-d8344e7d1a61', 'chatzos', 'חצות היום', 'Chatzos (Midday)', 'solar_noon', 'essential', NULL, true),
('d330f82b-c977-4f11-b191-9f67bd27ef44', 'mincha_gedola', 'מנחה גדולה', 'Mincha Gedola', 'proportional_hours(6.5, gra)', 'essential', NULL, true),
('4483562c-9d1d-43b0-99a5-584f2bc252e5', 'mincha_ketana', 'מנחה קטנה', 'Mincha Ketana', 'proportional_hours(9.5, gra)', 'essential', NULL, true),
('0b19e9ea-7c4f-4097-b6ed-1a3373331fa1', 'plag_hamincha', 'פלג המנחה', 'Plag HaMincha', 'proportional_hours(10.75, gra)', 'essential', NULL, true),
('b151c82f-ee68-4964-b0e3-590cac3270d9', 'sunset', 'שקיעה', 'Sunset', 'sunset', 'essential', NULL, true),
('031877e8-f874-4771-8e11-af8b97e24264', 'tzais', 'צאת הכוכבים', 'Tzais (Nightfall)', 'solar(8.5, after_sunset)', 'essential', NULL, true),
('a4a6e4d6-46bf-4fdb-9a52-b3a76bfa8679', 'sof_zman_tfila_mga', 'סוף זמן תפילה מג"א', 'Latest Shacharit (MGA)', 'proportional_hours(4, mga)', 'optional', NULL, false),
('792767d2-995c-44bc-ac6a-e642a040505f', 'alos_72', 'עלות 72 דקות', 'Alos 72 Minutes', 'sunrise - 72min', 'optional', NULL, false),
('f8e11423-31e9-4f5c-926b-dedfb2b962c9', 'alos_90', 'עלות 90 דקות', 'Alos 90 Minutes', 'sunrise - 90min', 'optional', NULL, false),
('d415bbb9-3669-4155-9172-10c2ffa81a4a', 'alos_120', 'עלות 120 דקות', 'Alos 120 Minutes', 'sunrise - 120min', 'optional', NULL, false),
('3d180243-33c7-4641-bebc-5b18f31c3a86', 'tzais_72', 'צאת ר"ת', 'Tzais Rabbeinu Tam (72 min)', 'sunset + 72min', 'optional', NULL, false),
('80bf153a-a555-4a46-a1e6-26c83607ba43', 'tzais_42', 'צאת 42 דקות', 'Tzais 42 Minutes', 'sunset + 42min', 'optional', NULL, false),
('f171485b-3618-4c7f-8920-64c456b59c23', 'tzais_50', 'צאת 50 דקות', 'Tzais 50 Minutes', 'sunset + 50min', 'optional', NULL, false),
('537d4e02-04f2-498f-9b0d-4e213e1bee3b', 'tzais_3_stars', 'צאת 3 כוכבים', 'Tzais 3 Stars', 'solar(8.5, after_sunset)', 'optional', NULL, false),
('bb4185fd-37e3-4fb8-b6e8-77b6bcd6d415', 'candle_lighting', 'הדלקת נרות', 'Candle Lighting', 'sunset - 18min', 'optional', NULL, false),
('ef9a81d9-02af-43cc-bc59-30f75f2d5a38', 'candle_lighting_20', 'הדלקת נרות (ירושלים)', 'Candle Lighting (Jerusalem)', 'sunset - 20min', 'optional', NULL, false),
('197a2a64-2713-4007-8114-ebaa390c8386', 'candle_lighting_40', 'הדלקת נרות (40 דקות)', 'Candle Lighting (40 min)', 'sunset - 40min', 'optional', NULL, false),
('f01e769b-3601-497d-8895-b1fc900a5874', 'shkia_amitis', 'שקיעה אמיתית', 'True Sunset', 'sunset', 'optional', NULL, false),
('b82c1329-0aea-40b5-b069-10f34e8639a5', 'chatzos_layla', 'חצות לילה', 'Chatzos Layla (Midnight)', 'solar_noon + 12hr', 'optional', NULL, false),
('4b10aefe-55cb-4a10-9788-65f543fa5b68', 'samuch_lmincha', 'סמוך למנחה קטנה', 'Samuch L''Mincha Ketana', 'proportional_hours(9, gra)', 'optional', NULL, false),
('5bf2560e-dafe-4759-83a3-4e792233eb61', 'bein_hashmashos', 'בין השמשות', 'Bein Hashmashos', 'sunset', 'optional', NULL, false),
('533c5b41-3ba1-438f-8bb2-56fe0f2784a3', 'kiddush_levana_earliest', 'קידוש לבנה מוקדם', 'Earliest Kiddush Levana', 'sunset + 72min', 'optional', NULL, false),
('84ceffa1-2a3b-4a8d-8f9d-aa60bc660f09', 'kiddush_levana_latest', 'סוף קידוש לבנה', 'Latest Kiddush Levana', 'sunset', 'optional', NULL, false);

-- ============================================================================
-- MASTER ZMANIM REGISTRY
-- ============================================================================

-- Core zmanim (is_core = true)
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('ada9beca-6052-4150-9d22-6a875582e3dc', 'alos_hashachar', 'עלות השחר', 'Dawn (Alos Hashachar)', 'Alos Hashachar', 'Dawn - when the first light appears on the eastern horizon (16.1° below horizon)', 'dawn', 'solar(16.1, before_sunrise)', true, false),
('fee6ae15-91bb-401d-be34-4a7256ed32cb', 'misheyakir', 'משיכיר', 'Misheyakir', 'Misheyakir', 'Earliest time to put on tallit and tefillin', 'sunrise', 'solar(11.5, before_sunrise)', true, false),
('10d89e97-e29b-4a0c-8775-04ccd6c15ba3', 'sunrise', 'הנץ החמה', 'Sunrise', 'Netz Hachama', 'Geometric/sea-level sunrise', 'sunrise', 'sunrise', true, false),
('a03df06c-8cca-4115-9ff1-4bc04e759ffc', 'sof_zman_shma_gra', 'סוף זמן ק"ש גר"א', 'Latest Shema (GRA)', 'Sof Zman Shma GRA', 'Latest time for Shema - 3 proportional hours (GRA)', 'morning', 'proportional_hours(3, gra)', true, false),
('7faef612-5f93-4cb0-bf4d-b6ad67f22583', 'sof_zman_shma_mga', 'סוף זמן ק"ש מג"א', 'Latest Shema (MGA)', 'Sof Zman Shma MGA', 'Latest time for Shema - 3 proportional hours (MGA from 72min dawn)', 'morning', 'proportional_hours(3, mga)', true, false),
('31ef5cc3-e541-4750-b78b-99840dc7a372', 'sof_zman_tfila_gra', 'סוף זמן תפילה גר"א', 'Latest Shacharit (GRA)', 'Sof Zman Tefilla GRA', 'Latest time for Shacharit - 4 proportional hours (GRA)', 'morning', 'proportional_hours(4, gra)', true, false),
('b32f320e-4fe5-4ba1-99db-78ad7b65cb66', 'sof_zman_tfila_mga', 'סוף זמן תפילה מג"א', 'Latest Shacharit (MGA)', 'Sof Zman Tefilla MGA', 'Latest time for Shacharit - 4 proportional hours (MGA)', 'morning', 'proportional_hours(4, mga)', true, false),
('5c1806a7-5c5f-4231-8ea6-f2821a3f74ff', 'chatzos', 'חצות היום', 'Midday (Chatzos)', 'Chatzos', 'Solar noon - midpoint between sunrise and sunset', 'midday', 'solar_noon', true, false),
('a56cc3c5-2210-4945-8c48-85cd0b48d936', 'mincha_gedola', 'מנחה גדולה', 'Earliest Mincha (GRA)', 'Mincha Gedola', 'Earliest time for Mincha - 6.5 proportional hours (half shaah zmanis after chatzos)', 'midday', 'proportional_hours(6.5, gra)', true, false),
('8506c62a-2f48-42b4-a02f-0b18b8e8478c', 'mincha_ketana', 'מנחה קטנה', 'Mincha Ketana', 'Mincha Ketana', 'Mincha Ketana - 9.5 proportional hours', 'afternoon', 'proportional_hours(9.5, gra)', true, false),
('b4e6778c-cb14-4fe5-b3e8-99c85a19606c', 'plag_hamincha', 'פלג המנחה', 'Plag HaMincha', 'Plag Hamincha', 'Plag HaMincha - 10.75 proportional hours (1.25 hours before sunset)', 'afternoon', 'proportional_hours(10.75, gra)', true, false),
('c92d8740-af5c-4298-a65d-ce5f64d76551', 'sunset', 'שקיעה', 'Sunset', 'Shkiah', 'Geometric/sea-level sunset', 'sunset', 'sunset', true, false),
('8b861617-e264-4542-a8db-01f7512cab7d', 'candle_lighting', 'הדלקת נרות', 'Candle Lighting', 'Hadlakas Neiros', 'Shabbat candle lighting - 18 minutes before sunset', 'sunset', 'sunset - 18min', true, false),
('319dfba5-0cf0-4479-b0c5-16ae0218fef0', 'tzais', 'צאת הכוכבים', 'Nightfall (Tzais)', 'Tzais Hakochavim', 'Three stars visible - standard nightfall at 8.5°', 'nightfall', 'solar(8.5, after_sunset)', true, false),
('eb38f7a2-4e91-47b5-8e4c-ea2c70b83c8e', 'chatzos_layla', 'חצות לילה', 'Midnight (Chatzos Layla)', 'Chatzos Layla', 'Solar midnight - 12 hours after chatzos', 'midnight', 'solar_noon + 12hr', true, false);

-- Dawn variations (alos)
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('17a26364-11ca-4b16-9e29-18bdba18cf25', 'alos_12', 'עלות השחר 12°', 'Dawn (12°)', 'Alos Hashachar 12°', 'Dawn calculated at 12 degrees below the horizon. Used by Manchester and other Northern European communities per Minchas Yitzchak.', 'dawn', 'solar(12, before_sunrise)', false, false),
('e6f6f1a6-dd4e-4a52-b0fc-bfa5796fae25', 'alos_16_1', 'עלות השחר 16.1°', 'Dawn (16.1°)', 'Alos 16.1', 'Dawn calculated at 16.1° solar depression', 'dawn', 'solar(16.1, before_sunrise)', false, false),
('4674b885-df4c-4f8a-878e-f513e1bf7d09', 'alos_18', 'עלות השחר 18°', 'Dawn (18°)', 'Alos 18', 'Dawn at astronomical twilight (18°)', 'dawn', 'solar(18, before_sunrise)', false, false),
('abd5e6eb-b56c-4f82-91c5-e649d1874bbf', 'alos_19_8', 'עלות השחר 19.8°', 'Dawn (19.8°)', 'Alos 19.8', 'Dawn at 19.8° - stricter opinion', 'dawn', 'solar(19.8, before_sunrise)', false, false),
('b5f13561-2202-4b6e-aca7-554a2f841b86', 'alos_26', 'עלות השחר 26°', 'Dawn (26°)', 'Alos 26', 'Dawn at 26° - very stringent', 'dawn', 'solar(26, before_sunrise)', false, false),
('c2b8088d-da9f-4753-a245-eb2ba2346870', 'alos_72', 'עלות השחר 72 דקות', 'Dawn (72 minutes)', 'Alos 72', 'Dawn 72 fixed minutes before sunrise', 'dawn', 'sunrise - 72min', false, false),
('ad46eeac-4a01-43f6-bb59-2e99c0c39824', 'alos_90', 'עלות השחר 90 דקות', 'Dawn (90 minutes)', 'Alos 90', 'Dawn 90 fixed minutes before sunrise', 'dawn', 'sunrise - 90min', false, false),
('3eab123f-400e-4b22-85a4-fd6637e635bd', 'alos_96', 'עלות השחר 96 דקות', 'Dawn (96 minutes)', 'Alos 96', 'Dawn 96 fixed minutes before sunrise', 'dawn', 'sunrise - 96min', false, false),
('11ea57e7-473c-4589-bd9e-2e431864f2e7', 'alos_120', 'עלות השחר 120 דקות', 'Dawn (120 minutes)', 'Alos 120', 'Dawn 120 fixed minutes before sunrise (2 hours)', 'dawn', 'sunrise - 120min', false, false);

-- Misheyakir variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('ac45041d-31bb-4587-99e9-29e2402a1e07', 'misheyakir_10_2', 'משיכיר 10.2°', 'Misheyakir (10.2°)', 'Misheyakir 10.2', 'Misheyakir at 10.2° solar depression', 'sunrise', 'solar(10.2, before_sunrise)', false, false),
('82086ba5-11c7-47cd-83cd-d95e454515b7', 'misheyakir_11', 'משיכיר 11°', 'Misheyakir (11°)', 'Misheyakir 11', 'Misheyakir at 11° solar depression', 'sunrise', 'solar(11, before_sunrise)', false, false),
('5b1ba043-d0ff-4a73-8b39-056f60fc9314', 'misheyakir_7_65', 'משיכיר 7.65°', 'Misheyakir (7.65°)', 'Misheyakir 7.65', 'Misheyakir at 7.65° - lenient opinion', 'sunrise', 'solar(7.65, before_sunrise)', false, false),
('1eef41ea-2d2e-495d-8bd3-6aa05f44b6d9', 'visible_sunrise', 'הנץ הנראה', 'Visible Sunrise', 'Hanetz Hanireh', 'Actual visible sunrise accounting for refraction', 'sunrise', 'visible_sunrise', false, false);

-- Shema variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('f797e554-2bbc-4097-9266-94a8cb8966c4', 'sof_zman_shma_mga_90', 'סוף זמן ק"ש מג"א 90', 'Latest Shema (MGA 90)', 'Sof Zman Shma MGA 90', 'Latest time for Shema (MGA from 90min dawn)', 'morning', 'proportional_hours(3, mga_90)', false, false),
('1db212a4-6d0a-4e77-95db-b8bd04593c87', 'sof_zman_shma_mga_120', 'סוף זמן ק"ש מג"א 120', 'Latest Shema (MGA 120)', 'Sof Zman Shma MGA 120', 'Latest time for Shema (MGA from 120min dawn)', 'morning', 'proportional_hours(3, mga_120)', false, false),
('d7f0cbbe-504f-4841-9884-6260c01ea200', 'sof_zman_shma_16_1', 'סוף זמן ק"ש 16.1°', 'Latest Shema (16.1°)', 'Sof Zman Shma 16.1', 'Latest Shema based on 16.1° alos', 'morning', 'proportional_hours(3, alos_16_1)', false, false),
('8352186e-f209-47eb-837b-cba001e1d9aa', 'sof_zman_shma_ateret_torah', 'סוף זמן ק"ש עטרת תורה', 'Latest Shema (Ateret Torah)', 'Sof Zman Shma AT', 'Latest Shema per Chacham Yosef Harari-Raful', 'morning', 'proportional_hours(3, ateret_torah)', false, false),
('7c3c2d01-f0e9-4737-a1cc-ecc9f3d40c0f', 'sof_zman_shma_baal_hatanya', 'סוף זמן ק"ש בעל התניא', 'Latest Shema (Baal HaTanya)', 'Sof Zman Shma BH', 'Latest Shema according to Baal HaTanya', 'morning', 'proportional_hours(3, baal_hatanya)', false, false),
('d746de0a-fbdb-40ba-b604-31e848b3b2c5', 'sof_zman_shma_3_hours', 'סוף זמן ק"ש 3 שעות לפני חצות', 'Latest Shema (3 Hours Before Chatzos)', 'Sof Zman Shma 3H', 'Latest Shema - fixed 3 hours before chatzos', 'morning', 'solar_noon - 3hr', false, false);

-- Tefila variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('ab71cdb8-4d56-490a-9ff8-34eee1595700', 'sof_zman_tfila_mga_90', 'סוף זמן תפילה מג"א 90', 'Latest Shacharit (MGA 90)', 'Sof Zman Tefilla MGA 90', 'Latest Shacharit (MGA from 90min dawn)', 'morning', 'proportional_hours(4, mga_90)', false, false),
('0ea7da60-6add-4cb7-a868-6bfdf384d6dd', 'sof_zman_tfila_mga_120', 'סוף זמן תפילה מג"א 120', 'Latest Shacharit (MGA 120)', 'Sof Zman Tefilla MGA 120', 'Latest Shacharit (MGA from 120min dawn)', 'morning', 'proportional_hours(4, mga_120)', false, false),
('58651776-4bc2-4c9a-b7af-97f460d23659', 'sof_zman_tfila_mga_72_zmanis', 'סוף זמן תפילה מג"א 72 זמניות', 'Latest Shacharit (MGA 72 Zmaniyos)', 'Sof Zman Tfila MGA 72Z', 'Latest Shacharit MGA based on 72 proportional minute day', 'morning', 'proportional_hours(4, mga_72_zmanis)', false, false),
('c81163f7-57df-45ec-a3f6-ef84b468fa56', 'sof_zman_tfila_ateret_torah', 'סוף זמן תפילה עטרת תורה', 'Latest Shacharit (Ateret Torah)', 'Sof Zman Tfila AT', 'Latest Shacharit per Chacham Yosef Harari-Raful', 'morning', 'proportional_hours(4, ateret_torah)', false, false),
('d42078b3-46f3-434b-940e-a56f25cf7202', 'sof_zman_tfila_baal_hatanya', 'סוף זמן תפילה בעל התניא', 'Latest Shacharit (Baal HaTanya)', 'Sof Zman Tfila BH', 'Latest Shacharit according to Baal HaTanya', 'morning', 'proportional_hours(4, baal_hatanya)', false, false),
('730f3739-4109-49b0-a75f-b14482acc564', 'sof_zman_tfila_2_hours', 'סוף זמן תפילה 2 שעות לפני חצות', 'Latest Shacharit (2 Hours Before Chatzos)', 'Sof Zman Tfila 2H', 'Latest Shacharit - fixed 2 hours before chatzos', 'morning', 'solar_noon - 2hr', false, false);

-- Chametz times
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('b3793fb9-2ed5-489f-8865-eb423d66f860', 'sof_zman_achilas_chametz_gra', 'סוף זמן אכילת חמץ גר"א', 'Latest Eating Chametz (GRA)', 'Sof Achilat Chametz GRA', 'Latest time to eat chametz on Erev Pesach (GRA)', 'morning', 'proportional_hours(4, gra)', false, false),
('efcc1554-e707-40f8-8f57-afaca4fd691a', 'sof_zman_achilas_chametz_mga', 'סוף זמן אכילת חמץ מג"א', 'Latest Eating Chametz (MGA)', 'Sof Achilat Chametz MGA', 'Latest time to eat chametz on Erev Pesach (MGA)', 'morning', 'proportional_hours(4, mga)', false, false),
('ab0350ad-f992-45b3-b65b-18b6574e11a4', 'sof_zman_biur_chametz_gra', 'סוף זמן ביעור חמץ גר"א', 'Latest Burning Chametz (GRA)', 'Sof Biur Chametz GRA', 'Latest time to burn chametz on Erev Pesach (GRA)', 'morning', 'proportional_hours(5, gra)', false, false),
('6e276ba5-229b-428f-8599-fe252e4f0f68', 'sof_zman_biur_chametz_mga', 'סוף זמן ביעור חמץ מג"א', 'Latest Burning Chametz (MGA)', 'Sof Biur Chametz MGA', 'Latest time to burn chametz on Erev Pesach (MGA)', 'morning', 'proportional_hours(5, mga)', false, false);

-- Mincha variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('40fd024f-d517-495c-9862-4f49a785d6be', 'mincha_gedola_16_1', 'מנחה גדולה 16.1°', 'Earliest Mincha (16.1°)', 'Mincha Gedola 16.1', 'Earliest Mincha based on 16.1° calculation', 'midday', 'proportional_hours(6.5, alos_16_1)', false, false),
('325eda19-591a-4c52-ae01-8f80beeab800', 'mincha_gedola_30', 'מנחה גדולה 30 דקות', 'Earliest Mincha (30 min)', 'Mincha Gedola 30', 'Earliest Mincha - exactly 30 minutes after chatzos', 'midday', 'solar_noon + 30min', false, false),
('5cf379a0-cf2e-4b0f-b385-2e19c90f376a', 'mincha_gedola_72', 'מנחה גדולה 72 דקות', 'Earliest Mincha (72 min)', 'Mincha Gedola 72', 'Earliest Mincha based on 72 minute day', 'midday', 'proportional_hours(6.5, mga)', false, false),
('f2e0bf91-99e7-4268-b8a9-6382e7ecc2ac', 'mincha_ketana_16_1', 'מנחה קטנה 16.1°', 'Mincha Ketana (16.1°)', 'Mincha Ketana 16.1', 'Mincha Ketana based on 16.1° calculation', 'afternoon', 'proportional_hours(9.5, alos_16_1)', false, false),
('12677fd6-5f30-413a-9ab9-90bf3a784dad', 'mincha_ketana_72', 'מנחה קטנה 72 דקות', 'Mincha Ketana (72 min)', 'Mincha Ketana 72', 'Mincha Ketana (MGA 72 minute day)', 'afternoon', 'proportional_hours(9.5, mga)', false, false),
('c86c3980-0873-4677-a5b8-ec827a77f05e', 'samuch_lmincha_ketana', 'סמוך למנחה קטנה', 'Samuch L''Mincha Ketana', 'Samuch LMincha', 'Half hour before Mincha Ketana', 'afternoon', 'proportional_hours(9, gra)', false, false);

-- Plag variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('9366c0e4-fc7a-49d6-ab29-d6396be9aafb', 'plag_hamincha_16_1', 'פלג המנחה 16.1°', 'Plag HaMincha (16.1°)', 'Plag Hamincha 16.1', 'Plag HaMincha based on 16.1° calculation', 'afternoon', 'proportional_hours(10.75, alos_16_1)', false, false),
('cfbd81d7-dbc7-4108-b71e-2d9e33dd1a7e', 'plag_hamincha_72', 'פלג המנחה 72 דקות', 'Plag HaMincha (72 min)', 'Plag Hamincha 72', 'Plag HaMincha (MGA 72 minute day)', 'afternoon', 'proportional_hours(10.75, mga)', false, false),
('072070ad-c303-4f36-a7ab-f5fee318fafb', 'plag_hamincha_terumas_hadeshen', 'פלג המנחה - תרומת הדשן', 'Plag HaMincha (Terumas HaDeshen)', 'Plag Terumas HaDeshen', 'Plag 1.25 proportional hours before nightfall (used for accepting Shabbos early)', 'afternoon', 'proportional_hours_before_tzais(1.25)', false, false);

-- Candle lighting variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('74fd91dc-963f-47f1-b4aa-595acfc7fb3c', 'candle_lighting_15', 'הדלקת נרות 15 דקות', 'Candle Lighting (15 min)', 'Hadlakas Neiros 15', 'Candle lighting 15 minutes before sunset', 'sunset', 'sunset - 15min', false, false),
('2e51a9f7-98b2-4916-89f8-374a508ca84e', 'candle_lighting_18', 'הדלקת נרות 18 דקות', 'Candle Lighting (18 min)', 'Hadlakas Neiros 18', 'Candle lighting 18 minutes before sunset (standard)', 'sunset', 'sunset - 18min', false, false),
('d08c0f98-e36c-4ac2-9bb2-b9fcfb82698f', 'candle_lighting_20', 'הדלקת נרות 20 דקות', 'Candle Lighting (20 min)', 'Hadlakas Neiros 20', 'Candle lighting 20 minutes before sunset (Jerusalem)', 'sunset', 'sunset - 20min', false, false),
('49004e69-b792-4ff0-9bae-b2f1c9602c45', 'candle_lighting_22', 'הדלקת נרות 22 דקות', 'Candle Lighting (22 min)', 'Hadlakas Neiros 22', 'Candle lighting 22 minutes before sunset', 'sunset', 'sunset - 22min', false, false),
('acd2cfd4-c72a-42ce-9662-7e71462c72fd', 'candle_lighting_30', 'הדלקת נרות 30 דקות', 'Candle Lighting (30 min)', 'Hadlakas Neiros 30', 'Candle lighting 30 minutes before sunset', 'sunset', 'sunset - 30min', false, false),
('f838eb44-3813-4f3c-afb8-e3608d82aaab', 'candle_lighting_40', 'הדלקת נרות 40 דקות', 'Candle Lighting (40 min)', 'Hadlakas Neiros 40', 'Candle lighting 40 minutes before sunset (Jerusalem strict)', 'sunset', 'sunset - 40min', false, false);

-- Sunset and bein hashmashos
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('12867ef6-594d-4ecd-86e3-2d9033dbbe83', 'visible_sunset', 'שקיעה נראית', 'Visible Sunset', 'Shkiah Nireis', 'Actual visible sunset', 'sunset', 'visible_sunset', false, false),
('37613cc9-9e05-4562-b453-40e91002f8a8', 'shkia_amitis', 'שקיעה אמיתית', 'True Sunset', 'Shkia Amitis', 'True sunset accounting for elevation', 'sunset', 'sunset', false, false),
('a51e6c5a-b4f0-4a6b-8247-a696617be0f8', 'bein_hashmashos_start', 'תחילת בין השמשות', 'Bein Hashmashos Start', 'Bein Hashmashos', 'Start of twilight period', 'sunset', 'sunset', false, false);

-- Tzais (nightfall) variations
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('7949f93d-c348-4e0c-99e9-743212ecb00b', 'tzais_7_08', 'צאת הכוכבים 7.08°', 'Nightfall (7.08°)', 'Tzais Hakochavim 7.08°', 'Three small stars visible when sun is 7.08 degrees below horizon. Used by Manchester community.', 'nightfall', 'solar(7.08, after_sunset)', false, false),
('8fd3c6e9-7367-46ac-b730-932a54f89e86', 'tzais_3_stars', 'צאת 3 כוכבים', 'Tzais 3 Stars', 'Tzais 3 Kochavim', 'Three stars visible - standard nightfall', 'nightfall', 'solar(8.5, after_sunset)', false, false),
('2f515728-469d-43f2-8b3d-c3276560d602', 'tzais_4_37', 'צאת 4.37°', 'Tzais (4.37°)', 'Tzais 4.37', 'Nightfall at 4.37° - lenient', 'nightfall', 'solar(4.37, after_sunset)', false, false),
('c5fadaac-0fdc-4564-b1b6-93edb43fd636', 'tzais_4_61', 'צאת 4.61°', 'Tzais (4.61°)', 'Tzais 4.61', 'Nightfall at 4.61°', 'nightfall', 'solar(4.61, after_sunset)', false, false),
('f07d6bf6-5f7d-4cf8-abd1-e6e3cc760a6f', 'tzais_4_8', 'צאת 4.8°', 'Tzais (4.8°)', 'Tzais 4.8', 'Nightfall at 4.8°', 'nightfall', 'solar(4.8, after_sunset)', false, false),
('0513c887-bfe3-465c-b386-cd61e718fe71', 'tzais_5_95', 'צאת 5.95°', 'Tzais (5.95°)', 'Tzais 5.95', 'Nightfall at 5.95°', 'nightfall', 'solar(5.95, after_sunset)', false, false),
('8a1bae87-a9be-4875-9625-d312e7f7aa32', 'tzais_6', 'צאת 6°', 'Tzais (6°)', 'Tzais 6', 'Civil twilight end (6°)', 'nightfall', 'solar(6, after_sunset)', false, false),
('8bf5f3a5-f878-4cb3-a9f6-88ce08cdd33a', 'tzais_7_083', 'צאת 7.083°', 'Tzais (7.083°)', 'Tzais 7.083', 'Nightfall at 7.083° (Rabbeinu Tam geometric)', 'nightfall', 'solar(7.083, after_sunset)', false, false),
('eb3565bc-87e7-45bc-be54-f9417c16fbe5', 'tzais_7_67', 'צאת 7.67°', 'Tzais (7.67°)', 'Tzais 7.67', 'Nightfall at 7.67°', 'nightfall', 'solar(7.67, after_sunset)', false, false),
('713c0a24-95dc-4ab2-9502-8ae3a1952173', 'tzais_8_5', 'צאת 8.5°', 'Tzais (8.5°)', 'Tzais 8.5', 'Standard nightfall at 8.5°', 'nightfall', 'solar(8.5, after_sunset)', false, false),
('98e3be75-fbf6-4886-ba61-7177b4b83639', 'tzais_9_3', 'צאת 9.3°', 'Tzais (9.3°)', 'Tzais 9.3', 'Nightfall at 9.3°', 'nightfall', 'solar(9.3, after_sunset)', false, false),
('def31724-8b34-4274-88f2-c25b73f1c96d', 'tzais_9_75', 'צאת 9.75°', 'Tzais (9.75°)', 'Tzais 9.75', 'Nightfall at 9.75°', 'nightfall', 'solar(9.75, after_sunset)', false, false),
('ba46cc7a-5a5d-429a-ba14-214401fa863c', 'tzais_13_5', 'צאת 13.5°', 'Tzais (13.5°)', 'Tzais 13.5', 'Stringent nightfall at 13.5°', 'nightfall', 'solar(13.5, after_sunset)', false, false),
('b07aeb4a-3617-4a17-ab44-4c4f22e3adb7', 'tzais_18', 'צאת 18°', 'Tzais (18°)', 'Tzais 18', 'Astronomical nightfall (18°)', 'nightfall', 'solar(18, after_sunset)', false, false),
('39c785f9-f1d8-403e-9922-ff0ab39637d2', 'tzais_19_8', 'צאת 19.8°', 'Tzais (19.8°)', 'Tzais 19.8', 'Very stringent nightfall at 19.8°', 'nightfall', 'solar(19.8, after_sunset)', false, false),
('b661a9a5-3238-4da2-9834-80f23441a276', 'tzais_26', 'צאת 26°', 'Tzais (26°)', 'Tzais 26', 'Extremely stringent nightfall', 'nightfall', 'solar(26, after_sunset)', false, false);

-- Fixed minute tzais
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('278b6e09-5be4-4f37-b77b-ef1d92d59b40', 'tzais_20', 'צאת 20 דקות', 'Tzais (20 min)', 'Tzais 20', 'Fixed 20 minutes after sunset', 'nightfall', 'sunset + 20min', false, false),
('09ddda57-be56-4fc9-9866-a9e98f61a366', 'tzais_42', 'צאת 42 דקות', 'Tzais (42 min)', 'Tzais 42', 'Fixed 42 minutes after sunset', 'nightfall', 'sunset + 42min', false, false),
('a0267f7f-732e-4984-a0e4-ab6c87c37f5b', 'tzais_50', 'צאת 50 דקות', 'Tzais (50 min)', 'Tzais 50', 'Fixed 50 minutes after sunset', 'nightfall', 'sunset + 50min', false, false),
('869e55f1-c6c0-4d02-8d26-0996c588c3b7', 'tzais_60', 'צאת 60 דקות', 'Tzais (60 min)', 'Tzais 60', 'Fixed 60 minutes after sunset', 'nightfall', 'sunset + 60min', false, false),
('9b17c8f9-0f27-4e7a-b21e-f1f2f2e6e0a1', 'tzais_72', 'צאת 72 דקות', 'Tzais (72 min)', 'Tzais 72', 'Fixed 72 minutes after sunset (Rabbeinu Tam)', 'nightfall', 'sunset + 72min', false, false),
('46bc5af0-dedb-4de4-8377-0347db2f9c09', 'tzais_90', 'צאת 90 דקות', 'Tzais (90 min)', 'Tzais 90', 'Fixed 90 minutes after sunset', 'nightfall', 'sunset + 90min', false, false),
('556ca911-2a17-4bae-afe7-8d544b426285', 'tzais_96', 'צאת 96 דקות', 'Tzais (96 min)', 'Tzais 96', 'Fixed 96 minutes after sunset', 'nightfall', 'sunset + 96min', false, false),
('d87301a5-c1f7-4fd0-8099-110be8681d7c', 'tzais_120', 'צאת 120 דקות', 'Tzais (120 min)', 'Tzais 120', 'Fixed 120 minutes after sunset', 'nightfall', 'sunset + 120min', false, false);

-- Shabbos end and havdalah
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('038dc557-c1ec-4d82-b2b6-828a0cd82f73', 'havdalah', 'הבדלה', 'Havdalah', 'Havdalah', 'End of Shabbos/Yom Tov - default 42 minutes after sunset', 'nightfall', 'sunset + 42min', false, false),
('4ebdc38e-e320-45a8-8b25-6642a3459c74', 'shabbos_ends_42', 'מוצאי שבת 42 דקות', 'Shabbos Ends (42 min)', 'Motzei Shabbos 42', 'End of Shabbos - 42 minutes', 'nightfall', 'sunset + 42min', false, false),
('249b4706-eda1-4a4b-85f1-cd6bfcac4088', 'shabbos_ends_50', 'מוצאי שבת 50 דקות', 'Shabbos Ends (50 min)', 'Motzei Shabbos 50', 'End of Shabbos - 50 minutes', 'nightfall', 'sunset + 50min', false, false),
('8f6daeb7-b692-4e7d-88e7-e8b4724b81a6', 'shabbos_ends_72', 'מוצאי שבת 72 דקות', 'Shabbos Ends (72 min)', 'Motzei Shabbos 72', 'End of Shabbos - Rabbeinu Tam', 'nightfall', 'sunset + 72min', false, false);

-- Fast end times
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('19e9cf01-7db7-42e5-b6fb-eb6081d9a4fd', 'fast_ends_20', 'סוף הצום 20 דקות', 'Fast Ends (20 min)', 'Sof Hatzom 20', 'Fast ends 20 minutes after sunset', 'nightfall', 'sunset + 20min', false, false),
('73e14767-7d8e-4205-8ce1-d6d172d6dec5', 'fast_ends_42', 'סוף הצום 42 דקות', 'Fast Ends (42 min)', 'Sof Hatzom 42', 'Fast ends 42 minutes after sunset', 'nightfall', 'sunset + 42min', false, false),
('1c26151e-9056-4c5a-9cfb-48b430db8ee6', 'fast_ends_50', 'סוף הצום 50 דקות', 'Fast Ends (50 min)', 'Sof Hatzom 50', 'Fast ends 50 minutes after sunset', 'nightfall', 'sunset + 50min', false, false);

-- Fast begin times
INSERT INTO master_zmanim_registry (id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, time_category, default_formula_dsl, is_core, is_hidden) VALUES
('a37ca4f4-a2a1-42d2-8d4e-4967e26707e8', 'fast_begins', 'תחילת הצום', 'Fast Begins', 'Techilas Hatzom', 'Beginning of dawn-start fasts (minor fasts begin at alos)', 'dawn', 'solar(16.1, before_sunrise)', false, false),
('753cfe5d-5875-4b98-b92f-72e084cc7af5', 'fast_begins_72', 'תחילת הצום 72 דקות', 'Fast Begins (72 min)', 'Techilas Hatzom 72', 'Fast begins 72 minutes before sunrise', 'dawn', 'sunrise - 72min', false, false),
('114b86e5-5579-406b-bf50-617dcb3533c5', 'fast_begins_90', 'תחילת הצום 90 דקות', 'Fast Begins (90 min)', 'Techilas Hatzom 90', 'Fast begins 90 minutes before sunrise', 'dawn', 'sunrise - 90min', false, false),
('822c9e96-5fbf-4a1f-bc34-b13189b9d677', 'fast_begins_sunset', 'תחילת הצום (שקיעה)', 'Fast Begins (Sunset)', 'Techilas Hatzom Shkiah', 'Beginning of sunset-start fasts (Yom Kippur, Tisha B''Av)', 'sunset', 'sunset', false, false);

-- ============================================================================
-- RESTORE SETTINGS
-- ============================================================================
-- Re-enable triggers (restores normal operation for application)
SET session_replication_role = 'origin';

-- Restore synchronous commit (ensures durability for subsequent operations)
SET synchronous_commit = ON;

-- Reset work_mem to default
RESET work_mem;
