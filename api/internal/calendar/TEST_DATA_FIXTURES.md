# Test Data Fixtures for Integration Tests

This document defines test data fixtures for validating the tag-driven zmanim architecture.

## Test Dates

### Regular Days (No Special Events)

| Date       | Day of Week | Hebrew Date          | Expected Behavior                                |
|------------|-------------|----------------------|--------------------------------------------------|
| 2025-12-24 | Wednesday   | 24 Kislev 5786      | No events, regular zmanim only                   |
| 2025-11-05 | Wednesday   | 13 Cheshvan 5786    | No events, regular zmanim only                   |

**Expected Zmanim:**
- alos_hashachar
- misheyakir
- sunrise
- sof_zman_shema (MGA & GRA)
- sof_zman_tefillah
- chatzos
- mincha_gedolah
- mincha_ketanah
- plag_hamincha
- sunset
- tzeis (multiple opinions)

**Expected Tags:**
- (none - no event tags active)

**Should NOT Show:**
- candle_lighting
- havdalah
- fast_begins
- fast_ends

---

### Shabbat

| Date       | Day of Week | Hebrew Date          | Expected Behavior                                |
|------------|-------------|----------------------|--------------------------------------------------|
| 2025-12-27 | Saturday    | 27 Kislev 5786      | Shabbat, havdalah after nightfall                |
| 2025-12-20 | Saturday    | 20 Kislev 5786      | Shabbat, havdalah after nightfall                |

**Expected Zmanim:**
- alos_hashachar
- misheyakir
- sunrise
- sof_zman_shema
- sof_zman_tefillah
- chatzos
- mincha_gedolah
- sunset
- havdalah (after tzeis)

**Expected Tags:**
- shabbos
- category_havdalah

**Should NOT Show:**
- candle_lighting (not on Saturday)

---

### Erev Shabbat (Friday)

| Date       | Day of Week | Hebrew Date          | Expected Behavior                                |
|------------|-------------|----------------------|--------------------------------------------------|
| 2025-12-26 | Friday      | 26 Kislev 5786      | Candle lighting before sunset                    |
| 2025-12-19 | Friday      | 19 Kislev 5786      | Candle lighting before sunset                    |

**Expected Zmanim:**
- (all regular zmanim)
- candle_lighting (18-40 min before sunset, location dependent)

**Expected Tags:**
- shabbos (from erev_events)
- category_candle_lighting

**Should NOT Show:**
- havdalah (not on Friday)

---

### Fast Days

#### Dawn-to-Dusk Fasts

| Date       | Hebrew Date          | Fast Name                | Fast Start | Fast End |
|------------|----------------------|--------------------------|------------|----------|
| 2025-01-10 | 10 Tevet 5785        | Asara B'Teves            | Dawn       | Nightfall|
| 2025-07-15 | 17 Tammuz 5785       | Shiva Asar B'Tammuz      | Dawn       | Nightfall|
| 2025-10-02 | 3 Tishrei 5786       | Tzom Gedaliah            | Dawn       | Nightfall|
| 2026-03-24 | 13 Adar 5786         | Ta'anit Esther           | Dawn       | Nightfall|

**Expected Zmanim:**
- (all regular zmanim)
- fast_begins (alos_hashachar)
- fast_ends (tzeis)

**Expected Tags:**
- asarah_bteves / shiva_asar_btamuz / tzom_gedaliah / taanis_esther
- category_fast_start
- category_fast_end

#### Sunset-to-Nightfall Fasts

| Date       | Hebrew Date          | Fast Name                | Fast Start | Fast End |
|------------|----------------------|--------------------------|------------|----------|
| 2025-10-02 | 10 Tishrei 5786      | Yom Kippur              | Sunset     | Nightfall|
| 2025-08-03 | 9 Av 5785            | Tisha B'Av              | Sunset     | Nightfall|

**Expected Zmanim:**
- (all regular zmanim)
- fast_begins (sunset on erev)
- fast_ends (tzeis after full day)

**Expected Tags:**
- yom_kippur / tisha_bav
- category_fast_start
- category_fast_end

**Special Notes:**
- Fast begins the evening before (erev_events)
- Fast ends after full day (moetzei_events)

---

### Yom Tov Days

#### Rosh Hashana

| Date       | Hebrew Date          | Day Description          | Candles? | Havdalah? |
|------------|----------------------|--------------------------|----------|-----------|
| 2025-09-22 | 29 Elul 5785 (Erev)  | Erev Rosh Hashana       | Yes      | No        |
| 2025-09-23 | 1 Tishrei 5786       | Rosh Hashana Day 1      | Yes*     | No        |
| 2025-09-24 | 2 Tishrei 5786       | Rosh Hashana Day 2      | No       | Yes       |

*From existing flame (second night candles)

**Expected Tags:**
- rosh_hashanah
- category_candle_lighting (erev and day 1 → day 2)
- category_havdalah (day 2 motzei)

#### Yom Kippur

| Date       | Hebrew Date          | Day Description          | Candles? | Havdalah? | Fast? |
|------------|----------------------|--------------------------|----------|-----------|-------|
| 2025-10-01 | 9 Tishrei 5786 (Erev)| Erev Yom Kippur         | Yes      | No        | Start |
| 2025-10-02 | 10 Tishrei 5786      | Yom Kippur              | No       | Yes       | End   |

**Expected Tags:**
- yom_kippur
- category_candle_lighting (erev)
- category_havdalah (motzei)
- category_fast_start (erev sunset)
- category_fast_end (motzei nightfall)

#### Sukkot

| Date       | Hebrew Date          | Day Description          | Candles? | Havdalah? |
|------------|----------------------|--------------------------|----------|-----------|
| 2025-10-06 | 14 Tishrei 5786 (Erev)| Erev Sukkot            | Yes      | No        |
| 2025-10-07 | 15 Tishrei 5786       | Sukkot Day 1           | Yes*     | No (diaspora)|
| 2025-10-08 | 16 Tishrei 5786       | Sukkot Day 2 (diaspora)| No       | Yes       |
| 2025-10-09 | 17 Tishrei 5786       | Chol HaMoed Sukkot     | No       | No        |
| ...        | ...                   | ...                     | ...      | ...       |
| 2025-10-13 | 21 Tishrei 5786       | Hoshana Rabbah         | Yes      | No        |
| 2025-10-14 | 22 Tishrei 5786       | Shemini Atzeret        | Yes*     | No (diaspora)|
| 2025-10-15 | 23 Tishrei 5786       | Simchat Torah (diaspora)| No      | Yes       |

**Expected Tags:**
- sukkos (days 1-2)
- chol_hamoed_sukkos (days 3-7)
- hoshanah_rabbah (day 7)
- shemini_atzeres (day 8, or day 8-9 in diaspora)
- category_candle_lighting (various)
- category_havdalah (various)

#### Pesach

| Date       | Hebrew Date          | Day Description          | Candles? | Havdalah? |
|------------|----------------------|--------------------------|----------|-----------|
| 2025-04-12 | 14 Nisan 5785 (Erev) | Erev Pesach             | Yes      | No        |
| 2025-04-13 | 15 Nisan 5785        | Pesach Day 1            | Yes*     | No (diaspora)|
| 2025-04-14 | 16 Nisan 5785        | Pesach Day 2 (diaspora) | No       | Yes       |
| 2025-04-15 | 17 Nisan 5785        | Chol HaMoed Pesach      | No       | No        |
| ...        | ...                  | ...                     | ...      | ...       |
| 2025-04-18 | 20 Nisan 5785        | Chol HaMoed Pesach      | Yes      | No        |
| 2025-04-19 | 21 Nisan 5785        | Pesach Day 7            | Yes*     | No (diaspora)|
| 2025-04-20 | 22 Nisan 5785        | Pesach Day 8 (diaspora) | No       | Yes       |

**Expected Tags:**
- pesach_first (days 1-2)
- chol_hamoed_pesach (days 3-6)
- pesach_last (days 7-8)
- category_candle_lighting (various)
- category_havdalah (various)
- category_chametz (before/during)

#### Shavuot

| Date       | Hebrew Date          | Day Description          | Candles? | Havdalah? |
|------------|----------------------|--------------------------|----------|-----------|
| 2025-06-01 | 5 Sivan 5785 (Erev)  | Erev Shavuot            | Yes      | No        |
| 2025-06-02 | 6 Sivan 5785         | Shavuot Day 1           | Yes*     | No (diaspora)|
| 2025-06-03 | 7 Sivan 5785         | Shavuot Day 2 (diaspora)| No       | Yes       |

**Expected Tags:**
- shavuos
- category_candle_lighting (erev and day 1 → day 2)
- category_havdalah (day 2 motzei in diaspora)

---

### Multi-Day Events

#### Chanukah (8 days)

| Date       | Hebrew Date          | Chanukah Day | Expected Behavior                |
|------------|----------------------|--------------|----------------------------------|
| 2025-12-25 | 25 Kislev 5786       | Day 1        | Tag: chanukah (day 1 of 8)      |
| 2025-12-26 | 26 Kislev 5786       | Day 2        | Tag: chanukah (day 2 of 8)      |
| 2025-12-27 | 27 Kislev 5786       | Day 3        | Tag: chanukah (day 3 of 8)      |
| ...        | ...                  | ...          | ...                              |
| 2026-01-01 | 2 Tevet 5786         | Day 8        | Tag: chanukah (day 8 of 8)      |

**Expected Tags:**
- chanukah (all 8 days)
- (plus shabbos if coinciding with Saturday)

#### Rosh Chodesh

| Date       | Hebrew Date          | Expected Behavior                                |
|------------|----------------------|--------------------------------------------------|
| 2025-12-01 | 1 Kislev 5786        | Single-day Rosh Chodesh                         |
| 2026-01-01 | 30 Kislev + 1 Tevet  | Two-day Rosh Chodesh                            |

**Expected Tags:**
- rosh_chodesh

---

## HebCal Event Response Fixtures

### Sample Response: Asara B'Teves (Jan 10, 2025)

```json
{
  "title": "Hebcal Jerusalem January 2025",
  "date": "2025-01-10",
  "items": [
    {
      "title": "Asara B'Tevet",
      "date": "2025-01-10",
      "category": "fast",
      "hebrew": "עשרה בטבת"
    }
  ]
}
```

**Expected Mapping:**
- HebCal event: "Asara B'Tevet"
- Tag: asarah_bteves
- Pattern: "Asara B'Tevet" or "%Asara%Tevet%"
- Metadata: fast_start_type = "dawn"

### Sample Response: Shabbat (Dec 27, 2025)

```json
{
  "title": "Hebcal Jerusalem December 2025",
  "date": "2025-12-27",
  "items": []
}
```

**Expected Mapping:**
- No HebCal event (Shabbat is derived from day of week)
- Tag: shabbos
- Logic: date.Weekday() == time.Saturday

---

## Database Fixtures

### tag_event_mappings Table

| tag_id | hebcal_event_pattern | hebrew_month | hebrew_day_start | hebrew_day_end | priority |
|--------|----------------------|--------------|------------------|----------------|----------|
| 101    | "Asara B'Tevet"     | 10           | 10              | 10             | 100      |
| 102    | "%Shiva Asar%Tammuz%"| 4           | 17              | 17             | 100      |
| 103    | "Tzom Gedaliah"     | 7            | 3               | 3              | 100      |
| 104    | "%Ta'anit Esther%"  | 12           | 13              | 13             | 100      |
| 105    | "Yom Kippur"        | 7            | 10              | 10             | 100      |
| 106    | "%Tish'a B'Av%"     | 5            | 9               | 9              | 100      |
| 110    | "%Rosh Hashana%"    | 7            | 1               | 2              | 100      |
| 115    | "%Pesach%"          | 1            | 15              | 22             | 100      |
| 120    | "%Chanukah%"        | NULL         | NULL            | NULL           | 90       |
| 125    | "%Rosh Chodesh%"    | NULL         | 1               | 1              | 50       |

### zman_tags Table (Sample)

| id  | tag_key              | tag_type | display_name_english_ashkenazi | display_name_hebrew | is_visible_to_users |
|-----|----------------------|----------|--------------------------------|---------------------|---------------------|
| 101 | asarah_bteves        | event    | Asara B'Teves                  | עשרה בטבת           | false               |
| 102 | shiva_asar_btamuz    | event    | Shiva Asar B'Tammuz            | שבעה עשר בתמוז      | false               |
| 103 | tzom_gedaliah        | event    | Tzom Gedaliah                  | צום גדליה           | false               |
| 104 | taanis_esther        | event    | Ta'anit Esther                 | תענית אסתר          | false               |
| 105 | yom_kippur           | event    | Yom Kippur                     | יום כיפור           | false               |
| 106 | tisha_bav            | event    | Tisha B'Av                     | תשעה באב            | false               |
| 110 | rosh_hashanah        | event    | Rosh Hashana                   | ראש השנה            | false               |
| 115 | pesach_first         | event    | Pesach                         | פסח                 | false               |
| 120 | chanukah             | event    | Chanukah                       | חנוכה               | false               |
| 125 | rosh_chodesh         | event    | Rosh Chodesh                   | ראש חודש            | false               |
| 201 | category_candle_lighting | category | Candle Lighting            | הדלקת נרות          | true                |
| 202 | category_havdalah    | category | Havdalah                       | הבדלה               | true                |
| 203 | category_fast_start  | category | Fast Begins                    | תחילת צום           | true                |
| 204 | category_fast_end    | category | Fast Ends                      | סיום צום            | true                |

---

## Test Coverage Matrix

| Scenario                    | Test Date  | Expected Active Tags                          | Expected Zmanim with Tags           |
|-----------------------------|------------|-----------------------------------------------|-------------------------------------|
| Regular weekday             | 2025-12-24 | (none)                                        | Regular zmanim only                 |
| Friday (Erev Shabbat)       | 2025-12-26 | shabbos, category_candle_lighting             | + candle_lighting                   |
| Saturday (Shabbat)          | 2025-12-27 | shabbos, category_havdalah                    | + havdalah                          |
| Dawn fast                   | 2025-01-10 | asarah_bteves, category_fast_*                | + fast_begins, fast_ends            |
| Sunset fast (Yom Kippur)    | 2025-10-02 | yom_kippur, category_fast_*, category_*       | + all fast/yom_tov zmanim           |
| Yom Tov Day 1               | 2025-09-23 | rosh_hashanah, category_candle_lighting       | + candle_lighting                   |
| Yom Tov Day 2 (diaspora)    | 2025-09-24 | rosh_hashanah, category_havdalah              | + havdalah                          |
| Chol HaMoed                 | 2025-04-15 | chol_hamoed_pesach                            | Regular zmanim (with pesach context)|
| Chanukah Day 5              | 2025-12-29 | chanukah                                      | Regular zmanim (with chanukah note) |

---

## Validation Queries

### SQL to verify tag-driven architecture

```sql
-- Check that all event tags have mappings
SELECT t.tag_key, COUNT(m.id) as mapping_count
FROM zman_tags t
LEFT JOIN tag_event_mappings m ON m.tag_id = t.id
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE tt.key = 'event'
GROUP BY t.tag_key
HAVING COUNT(m.id) = 0;

-- Expected: No results (all event tags should have mappings)

-- Check that all category tags exist
SELECT tag_key FROM zman_tags t
JOIN tag_types tt ON tt.id = t.tag_type_id
WHERE tt.key = 'category'
ORDER BY tag_key;

-- Expected:
-- category_candle_lighting
-- category_chametz
-- category_fast_end
-- category_fast_start
-- category_havdalah

-- Verify HebCal pattern coverage for major holidays
SELECT t.tag_key, m.hebcal_event_pattern
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.hebcal_event_pattern LIKE '%Rosh%'
   OR m.hebcal_event_pattern LIKE '%Kippur%'
   OR m.hebcal_event_pattern LIKE '%Pesach%'
   OR m.hebcal_event_pattern LIKE '%Shavuot%'
   OR m.hebcal_event_pattern LIKE '%Sukkot%';

-- Expected: Multiple patterns for each major holiday
```

---

## Notes

1. **Israel vs Diaspora**: Many tests need to be run twice - once for IL=true, once for IL=false
2. **Transliteration**: Tag display names should support both Ashkenazi and Sephardi
3. **Hidden Tags**: Event tags (is_visible_to_users=false) should not appear in UI
4. **Category Tags**: Category tags (is_visible_to_users=true) should appear as filters/chips
5. **Negated Tags**: Some zmanim have negated tags (e.g., "NOT shabbos") - test exclusion logic
