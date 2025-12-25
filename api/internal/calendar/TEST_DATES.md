# Comprehensive Test Dates for HebCal Event Coverage

## Overview
This document provides a comprehensive list of test dates covering all Jewish calendar events, with expected event codes for validation.

## Hebrew Years Covered
- 5785 (2024-2025)
- 5786 (2025-2026)
- 5787 (2026-2027)

## Test Date Categories

### 1. High Holidays (Yamim Noraim)

| Date | Hebrew Date | Event | Expected Code | Israel | Diaspora | Notes |
|------|-------------|-------|---------------|--------|----------|-------|
| 2025-09-23 | 1 Tishrei 5786 | Rosh Hashana I | rosh_hashanah | Day 1/2 | Day 1/2 | |
| 2025-09-24 | 2 Tishrei 5786 | Rosh Hashana II | rosh_hashanah | Day 2/2 | Day 2/2 | |
| 2025-10-02 | 10 Tishrei 5786 | Yom Kippur | yom_kippur | 1/1 | 1/1 | Fast from sunset |
| 2026-09-12 | 1 Tishrei 5787 | Rosh Hashana I | rosh_hashanah | Day 1/2 | Day 1/2 | Next year |
| 2026-09-13 | 2 Tishrei 5787 | Rosh Hashana II | rosh_hashanah | Day 2/2 | Day 2/2 | Next year |

### 2. Sukkot and Related Holidays

| Date | Hebrew Date | Event | Expected Code | Israel | Diaspora | Notes |
|------|-------------|-------|---------------|--------|----------|-------|
| 2025-10-07 | 15 Tishrei 5786 | Sukkot I | sukkos | Day 1/1 | Day 1/2 | Yom Tov |
| 2025-10-08 | 16 Tishrei 5786 | Sukkot II | chol_hamoed_sukkos | CH"M | Day 2/2 | Yom Tov diaspora only |
| 2025-10-09 | 17 Tishrei 5786 | Sukkot III (CH"M) | chol_hamoed_sukkos | CH"M | CH"M | |
| 2025-10-10 | 18 Tishrei 5786 | Sukkot IV (CH"M) | chol_hamoed_sukkos | CH"M | CH"M | |
| 2025-10-11 | 19 Tishrei 5786 | Sukkot V (CH"M) | chol_hamoed_sukkos | CH"M | CH"M | |
| 2025-10-12 | 20 Tishrei 5786 | Sukkot VI (CH"M) | chol_hamoed_sukkos | CH"M | CH"M | |
| 2025-10-13 | 21 Tishrei 5786 | Hoshana Raba | hoshanah_rabbah | 1/1 | 1/1 | Sukkot VII |
| 2025-10-14 | 22 Tishrei 5786 | Shemini Atzeret | shemini_atzeres | 1/1 | Day 1/2 | Simchat Torah same day in Israel |
| 2025-10-15 | 23 Tishrei 5786 | Simchat Torah | - | - | Day 2/2 | Only diaspora - code: shemini_atzeres |

### 3. Pesach

| Date | Hebrew Date | Event | Expected Code | Israel | Diaspora | Notes |
|------|-------------|-------|---------------|--------|----------|-------|
| 2025-04-12 | 14 Nisan 5785 | Erev Pesach | - | Erev | Erev | Fast of firstborn |
| 2025-04-13 | 15 Nisan 5785 | Pesach I | pesach_first | Day 1/1 | Day 1/2 | First Seder |
| 2025-04-14 | 16 Nisan 5785 | Pesach II | chol_hamoed_pesach | CH"M | Day 2/2 | Second Seder diaspora |
| 2025-04-15 | 17 Nisan 5785 | Pesach III (CH"M) | chol_hamoed_pesach | CH"M | CH"M | |
| 2025-04-16 | 18 Nisan 5785 | Pesach IV (CH"M) | chol_hamoed_pesach | CH"M | CH"M | |
| 2025-04-17 | 19 Nisan 5785 | Pesach V (CH"M) | chol_hamoed_pesach | CH"M | CH"M | |
| 2025-04-18 | 20 Nisan 5785 | Pesach VI (CH"M) | chol_hamoed_pesach | CH"M | CH"M | |
| 2025-04-19 | 21 Nisan 5785 | Pesach VII | pesach_last | Day 1/1 | Day 1/2 | |
| 2025-04-20 | 22 Nisan 5785 | Pesach VIII | - | - | Day 2/2 | Diaspora only |

### 4. Shavuot

| Date | Hebrew Date | Event | Expected Code | Israel | Diaspora | Notes |
|------|-------------|-------|---------------|--------|----------|-------|
| 2025-06-02 | 6 Sivan 5785 | Shavuot | shavuos | Day 1/1 | Day 1/2 | |
| 2025-06-03 | 7 Sivan 5785 | Shavuot II | - | - | Day 2/2 | Diaspora only |
| 2026-05-23 | 6 Sivan 5786 | Shavuot | shavuos | Day 1/1 | Day 1/2 | Next year |

### 5. Chanukah

| Date | Hebrew Date | Event | Expected Code | Day | Notes |
|------|-------------|-------|---------------|-----|-------|
| 2025-12-15 | 25 Kislev 5786 | Chanukah Day 1 | chanukah | 1/8 | |
| 2025-12-16 | 26 Kislev 5786 | Chanukah Day 2 | chanukah | 2/8 | |
| 2025-12-17 | 27 Kislev 5786 | Chanukah Day 3 | chanukah | 3/8 | |
| 2025-12-18 | 28 Kislev 5786 | Chanukah Day 4 | chanukah | 4/8 | |
| 2025-12-19 | 29 Kislev 5786 | Chanukah Day 5 | chanukah | 5/8 | |
| 2025-12-20 | 30 Kislev 5786 | Chanukah Day 6 | chanukah | 6/8 | Often Rosh Chodesh |
| 2025-12-21 | 1 Tevet 5786 | Chanukah Day 7 | chanukah | 7/8 | Rosh Chodesh |
| 2025-12-22 | 2 Tevet 5786 | Chanukah Day 8 | chanukah | 8/8 | Zot Chanukah |

### 6. Purim

| Date | Hebrew Date | Event | Expected Code | Notes |
|------|-------------|-------|---------------|-------|
| 2025-03-13 | 13 Adar 5785 | Ta'anit Esther | taanis_esther | Fast begins at dawn |
| 2025-03-14 | 14 Adar 5785 | Purim | purim | |
| 2025-03-15 | 15 Adar 5785 | Shushan Purim | shushan_purim | |
| 2026-03-03 | 13 Adar 5786 | Ta'anit Esther | taanis_esther | Next year |

### 7. Fast Days

| Date | Hebrew Date | Event | Expected Code | Start Type | Notes |
|------|-------------|-------|---------------|------------|-------|
| 2025-01-10 | 10 Tevet 5785 | Asara B'Tevet | asarah_bteves | dawn | Only fast on Friday |
| 2025-03-13 | 13 Adar 5785 | Ta'anit Esther | taanis_esther | dawn | |
| 2025-04-12 | 14 Nisan 5785 | Ta'anit Bechorot | - | dawn | Often avoided via siyum |
| 2025-07-13 | 17 Tammuz 5785 | Tzom Tammuz | shiva_asar_btamuz | dawn | |
| 2025-08-02 | 8 Av 5785 | Erev Tisha B'Av | - | Erev | Fast begins at sunset |
| 2025-08-03 | 9 Av 5785 | Tisha B'Av | tisha_bav | sunset | Major fast |
| 2025-09-25 | 3 Tishrei 5786 | Tzom Gedaliah | tzom_gedaliah | dawn | After Rosh Hashana |
| 2025-10-01 | 9 Tishrei 5786 | Erev Yom Kippur | - | Erev | Fast begins at sunset |
| 2025-10-02 | 10 Tishrei 5786 | Yom Kippur | yom_kippur | sunset | Major fast |

### 8. Special Shabbatot

| Date | Hebrew Date | Event | Expected Code | Torah Reading |
|------|-------------|-------|---------------|---------------|
| 2025-02-01 | 3 Shevat 5785 | Shabbat Shirah | - | Beshalach (Song of the Sea) |
| 2025-02-22 | 24 Shevat 5785 | Shabbat Shekalim | - | Before Adar |
| 2025-03-08 | 8 Adar 5785 | Shabbat Zachor | - | Before Purim |
| 2025-03-22 | 22 Adar 5785 | Shabbat Parah | - | After Purim |
| 2025-03-29 | 29 Adar 5785 | Shabbat HaChodesh | - | Before Nisan |
| 2025-04-05 | 7 Nisan 5785 | Shabbat HaGadol | - | Before Pesach |
| 2025-07-26 | 1 Av 5785 | Shabbat Chazon | - | Before Tisha B'Av |
| 2025-08-09 | 15 Av 5785 | Shabbat Nachamu | - | After Tisha B'Av |
| 2025-09-27 | 5 Tishrei 5786 | Shabbat Shuva | - | Between RH and YK |

### 9. Rosh Chodesh

| Date | Hebrew Date | Event | Expected Code | Days | Notes |
|------|-------------|-------|---------------|------|-------|
| 2025-01-30 | 1 Shevat 5785 | Rosh Chodesh Shevat | rosh_chodesh | 1 day | |
| 2025-02-28 | 1 Adar 5785 | Rosh Chodesh Adar | rosh_chodesh | 1 day | |
| 2025-03-30 | 30 Adar 5785 | Rosh Chodesh Nisan | rosh_chodesh | 2 days | Day 1 |
| 2025-03-31 | 1 Nisan 5785 | Rosh Chodesh Nisan | rosh_chodesh | 2 days | Day 2 |
| 2025-04-28 | 30 Nisan 5785 | Rosh Chodesh Iyar | rosh_chodesh | 2 days | Day 1 |
| 2025-04-29 | 1 Iyar 5785 | Rosh Chodesh Iyar | rosh_chodesh | 2 days | Day 2 |

### 10. Minor Holidays and Observances

| Date | Hebrew Date | Event | Expected Code | Notes |
|------|-------------|-------|---------------|-------|
| 2025-02-13 | 15 Shevat 5785 | Tu BiShvat | - | New Year for Trees |
| 2025-05-16 | 18 Iyar 5785 | Lag BaOmer | - | 33rd day of Omer |
| 2025-05-28 | 1 Sivan 5785 | Rosh Chodesh Sivan | rosh_chodesh | |
| 2025-06-14 | 15 Av 5785 | Tu B'Av | - | |
| 2025-11-03 | 14 Iyar 5786 | Pesach Sheni | - | Second Pesach |

### 11. Sefirat HaOmer (Omer Counting)

| Date | Hebrew Date | Event | Expected Code | Omer Day | Notes |
|------|-------------|-------|---------------|----------|-------|
| 2025-04-14 | 16 Nisan 5785 | 1st day of Omer | - | 1 | |
| 2025-04-20 | 22 Nisan 5785 | 7th day of Omer | - | 7 | Week 1 |
| 2025-04-27 | 29 Nisan 5785 | 14th day of Omer | - | 14 | Week 2 |
| 2025-05-16 | 18 Iyar 5785 | Lag BaOmer | - | 33 | |
| 2025-06-01 | 5 Sivan 5785 | 49th day of Omer | - | 49 | Erev Shavuot |

### 12. Erev Events

| Date | Hebrew Date | Event | Expected Code | Following Day |
|------|-------------|-------|---------------|---------------|
| 2025-09-22 | 29 Elul 5785 | Erev Rosh Hashana | - | Rosh Hashana |
| 2025-10-01 | 9 Tishrei 5786 | Erev Yom Kippur | - | Yom Kippur |
| 2025-10-06 | 14 Tishrei 5786 | Erev Sukkot | - | Sukkot |
| 2025-04-12 | 14 Nisan 5785 | Erev Pesach | - | Pesach |
| 2025-06-01 | 5 Sivan 5785 | Erev Shavuot | - | Shavuot |

### 13. Regular Weekdays (No Events)

| Date | Hebrew Date | Day of Week | Expected Events | Notes |
|------|-------------|-------------|-----------------|-------|
| 2025-01-15 | 16 Tevet 5785 | Wednesday | None | Mid-Tevet |
| 2025-02-11 | 13 Shevat 5785 | Tuesday | None | Mid-Shevat |
| 2025-05-07 | 9 Iyar 5785 | Wednesday | None | During Omer |
| 2025-11-05 | 15 Cheshvan 5786 | Wednesday | None | Regular day |

### 14. Regular Shabbat (No Special Event)

| Date | Hebrew Date | Day of Week | Expected Events | Notes |
|------|-------------|-------------|-----------------|-------|
| 2025-01-18 | 19 Tevet 5785 | Saturday | shabbos | Regular Shabbat |
| 2025-05-10 | 12 Iyar 5785 | Saturday | shabbos | During Omer |
| 2025-11-08 | 18 Cheshvan 5786 | Saturday | shabbos | Regular Shabbat |

### 15. Friday (Erev Shabbat)

| Date | Hebrew Date | Day of Week | Expected Erev Events | Notes |
|------|-------------|-------------|----------------------|-------|
| 2025-01-17 | 18 Tevet 5785 | Friday | shabbos | Regular Friday |
| 2025-05-09 | 11 Iyar 5785 | Friday | shabbos | During Omer |

## Edge Cases and Special Scenarios

### 16. Shabbat with Holiday

| Date | Hebrew Date | Events | Expected Codes | Notes |
|------|-------------|--------|----------------|-------|
| 2025-10-11 | 19 Tishrei 5786 | Shabbat Chol HaMoed Sukkot | shabbos, chol_hamoed_sukkos | |
| 2025-04-19 | 21 Nisan 5785 | Shabbat Pesach VII | shabbos, pesach_last | |

### 17. Rosh Chodesh on Shabbat

| Date | Hebrew Date | Events | Expected Codes | Notes |
|------|-------------|--------|----------------|-------|
| 2025-08-30 | 1 Elul 5785 | Shabbat Rosh Chodesh | shabbos, rosh_chodesh | Shabbat Mevarchim before |

### 18. Multiple Events Same Day

| Date | Hebrew Date | Events | Expected Codes | Notes |
|------|-------------|--------|----------------|-------|
| 2025-12-20 | 30 Kislev 5786 | Chanukah 6 + Rosh Chodesh | chanukah, rosh_chodesh | Often occurs |
| 2025-12-21 | 1 Tevet 5786 | Chanukah 7 + Rosh Chodesh | chanukah, rosh_chodesh | Day 2 |

## Testing Strategy

### Priority 1: Core Coverage (Must Have)
- All major holidays (Yom Tov)
- All fast days
- All special Shabbatot
- Rosh Chodesh patterns

### Priority 2: Multi-Day Events
- Correct day numbering (1/8, 2/8, etc.)
- Israel vs Diaspora differences
- Chol HaMoed days

### Priority 3: Edge Cases
- Shabbat + Holiday combinations
- Multiple events on same day
- Erev events
- Regular weekdays and Shabbatot

### Priority 4: Informational Events
- Omer counting
- Minor holidays (Tu BiShvat, Lag BaOmer, etc.)
- Yom HaAtzmaut, Yom Yerushalayim (if included)

## Expected Test Results

### Coverage Targets
- **100% coverage**: Major holidays, fasts, special Shabbatot
- **100% coverage**: Multi-day event numbering
- **100% coverage**: Israel vs Diaspora differences
- **95%+ coverage**: Minor holidays and informational events
- **0 failures**: All edge cases handled gracefully

### Validation Commands

```bash
# Run the comprehensive coverage test
cd api
go test -v ./internal/calendar -run TestEventCoverage

# Run specific date tests
go test -v ./internal/calendar -run TestSpecificDates

# Run multi-day event tests
go test -v ./internal/calendar -run TestMultiDayEvents

# Run Israel vs Diaspora tests
go test -v ./internal/calendar -run TestIsraelDiasporaDifferences

# Run all event tests
go test -v ./internal/calendar -run Test
```

## Maintenance

This document should be updated:
1. Annually when new Hebrew year begins
2. When new event types are added to hebcal-go
3. When database event mappings are modified
4. After discovering unmapped events in testing
