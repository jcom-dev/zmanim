# HebCal Events Quick Reference

## Most Common Events for Zmanim Display

### Events Requiring Special Zmanim

| Event | Hebrew | Pattern Type | Notes |
|-------|--------|--------------|-------|
| Asara B’Tevet | עשרה בטבת | EXACT | "" |
| Chanukah: 1 Candle | חנוכה: א׳ נר | NUMBERED | Contains numeric variations |
| Chanukah: 2 Candles | חנוכה: ב׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 3 Candles | חנוכה: ג׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 4 Candles | חנוכה: ד׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 5 Candles | חנוכה: ה׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 6 Candles | חנוכה: ו׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 7 Candles | חנוכה: ז׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 8 Candles | חנוכה: ח׳ נרות | NUMBERED | Contains numeric variations |
| Chanukah: 8th Day | חנוכה: יום ח׳ | COMBINED | "" |
| Erev Pesach | ערב פסח | EXACT | "" |
| Erev Purim | ערב פורים | EXACT | "" |
| Erev Purim | ��רב פורים | EXACT | "" |
| Erev Shavuot | ערב שבועות | EXACT | "" |
| Erev Sukkot | ערב סוכות | EXACT | "" |
| Erev Yom Kippur | ערב יום כפור | EXACT | "" |
| Purim | פורים | EXACT | "" |
| Purim Katan | פורים קטן | EXACT | "" |
| Purim Meshulash | פורים משולש | EXACT | "" |
| Shushan Purim | שושן פורים | EXACT | "" |
| Shushan Purim Katan | שושן פורים קטן | EXACT | "" |
| Tzom Gedaliah | צום גדליה | EXACT | "" |
| Tzom Tammuz | צום י״ז בתמוז | EXACT | "" |

### Special Shabbatot

| Event | Hebrew | Notes |
|-------|--------|-------|
| Shabbat Chazon | שבת חזון | May affect zmanim display |
| Shabbat HaChodesh | שבת החדש | May affect zmanim display |
| Shabbat HaGadol | שבת הגדול | May affect zmanim display |
| Shabbat Nachamu | שבת נחמו | May affect zmanim display |
| Shabbat Parah | שבת פרה | May affect zmanim display |
| Shabbat Shekalim | שבת שקלים | May affect zmanim display |
| Shabbat Shirah | שבת שירה | May affect zmanim display |
| Shabbat Shuva | שבת שובה | May affect zmanim display |
| Shabbat Zachor | שבת זכור | May affect zmanim display |

### Rosh Chodesh (All Months)

| Event | Hebrew |
|-------|--------|
| Rosh Chodesh Adar | ראש חודש אדר |
| Rosh Chodesh Adar I | ראש חודש אדר א׳ |
| Rosh Chodesh Adar II | ראש חודש אדר ב׳ |
| Rosh Chodesh Av | ראש חודש אב |
| Rosh Chodesh Cheshvan | ראש חודש חשון |
| Rosh Chodesh Elul | ראש חודש אלול |
| Rosh Chodesh Iyyar | ראש חודש אייר |
| Rosh Chodesh Kislev | ראש חודש כסלו |
| Rosh Chodesh Nisan | ראש חודש ניסן |
| Rosh Chodesh Sh’vat | ראש חודש שבט |
| Rosh Chodesh Sivan | ראש חודש סיון |
| Rosh Chodesh Tamuz | ראש חודש תמוז |
| Rosh Chodesh Tevet | ראש חודש טבת |

### Pattern Matching Examples

#### Chanukah Candles (NUMBERED)
```
holiday,Chanukah: 1 Candle,חנוכה: א׳ נר,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 2 Candles,חנוכה: ב׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 3 Candles,חנוכה: ג׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 4 Candles,חנוכה: ד׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 5 Candles,חנוכה: ה׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 6 Candles,חנוכה: ו׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 7 Candles,חנוכה: ז׳ נרות,NUMBERED,Chanukah,Contains numeric variations
holiday,Chanukah: 8 Candles,חנוכה: ח׳ נרות,NUMBERED,Chanukah,Contains numeric variations
```

#### Rosh Hashana Years (YEARLY)
```
holiday,Rosh Hashana 5781,ראש השנה 5781,YEARLY,Rosh Hashana,""
holiday,Rosh Hashana 5782,ראש השנה 5782,YEARLY,Rosh Hashana,""
holiday,Rosh Hashana 5783,ראש השנה 5783,YEARLY,Rosh Hashana,""
holiday,Rosh Hashana 5784,ראש השנה 5784,YEARLY,Rosh Hashana,""
holiday,Rosh Hashana 5785,ראש השנה 5785,YEARLY,Rosh Hashana,""
```

## Database Mapping Strategy

### 1. Single Event → Single Tag (EXACT)
```sql
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'Purim' FROM zman_tags WHERE tag_key = 'purim';
```

### 2. Pattern Matching (NUMBERED, MONTHLY, YEARLY)
```sql
-- Chanukah (all candle counts)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'Chanukah:%' FROM zman_tags WHERE tag_key = 'chanukah';

-- Rosh Chodesh (all months)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'Rosh Chodesh%' FROM zman_tags WHERE tag_key = 'rosh_chodesh';

-- Rosh Hashana (all years)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'Rosh Hashana%' FROM zman_tags WHERE tag_key = 'rosh_hashana';
```

### 3. Multiple Events → Single Tag (Grouped)
```sql
-- All Pesach days map to 'pesach' tag
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern) VALUES
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach I'),
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach II'),
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach III (CH''''M)'),
  ((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach VII');
```
