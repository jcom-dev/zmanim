# HebCal Events Complete Analysis

## Summary

Extracted **169 unique events** from HebCal API across years 2020-2030.

**Data Source:** HebCal API with all flags enabled (maj, min, mod, nx, ss, mf, M, s)

**Output File:** `/home/daniel/repos/zmanim/hebcal-events-complete.csv`

## Event Distribution by Category

| Category | Count | Description |
|----------|-------|-------------|
| holiday | 84 | Major holidays, minor holidays, modern holidays, fasts, special days |
| parashat | 59 | Weekly Torah portions (including combined portions) |
| roshchodesh | 13 | Rosh Chodesh for all 12 months + leap year variants |
| mevarchim | 13 | Shabbat Mevarchim Chodesh for all months |

## Pattern Types Analysis

| Pattern Type | Count | Description | Examples |
|--------------|-------|-------------|----------|
| EXACT | 77 | Single, unchanging event names | "Pesach I", "Yom Kippur", "Purim" |
| PARASHAT | 59 | Weekly Torah portions | "Parashat Bereshit", "Parashat Vayera" |
| MONTHLY | 13 | Monthly recurring with month name | "Rosh Chodesh Nisan", "Rosh Chodesh Tevet" |
| YEARLY | 11 | Event with Hebrew year number | "Rosh Hashana 5781", "Rosh Hashana 5782" |
| NUMBERED | 8 | Multi-day events with candle/day count | "Chanukah: 3 Candles", "Chanukah: 5 Candles" |
| COMBINED | 1 | Combination patterns | "Chanukah: 8th Day" |

## Key Event Categories

### Major Holidays (Yamim Tovim)
- Rosh Hashana (with yearly variants 5781-5791)
- Yom Kippur
- Sukkot (I, II, III-VII with CH''M variants)
- Shemini Atzeret
- Simchat Torah
- Pesach (I-VII with CH''M variants)
- Shavuot (I, II)

### Minor Holidays
- Chanukah (8 numbered candle variations + 8th Day)
- Purim (including Erev Purim, Purim Katan)
- Tu BiShvat
- Tu B'Av
- Lag BaOmer

### Fast Days
- Asara B'Tevet
- Tzom Gedaliah
- Tzom Tammuz
- Tish'a B'Av (Erev Tish'a B'Av included)
- Ta'anit Esther

### Modern Israeli Holidays
- Yom HaShoah (Holocaust Remembrance)
- Yom HaZikaron (Memorial Day)
- Yom HaAtzma'ut (Independence Day)
- Yom Yerushalayim (Jerusalem Day)
- Yom HaAliyah
- Sigd

### Special Shabbatot
- Shabbat Shekalim
- Shabbat Zachor
- Shabbat Parah
- Shabbat HaChodesh
- Shabbat HaGadol
- Shabbat Chazon
- Shabbat Nachamu
- Shabbat Shuva
- Shabbat Shirah

### Rosh Chodesh (13 variations)
All 12 months plus leap year variants:
- Regular months: Nisan, Iyyar, Sivan, Tamuz, Av, Elul, Tishrei, Cheshvan, Kislev, Tevet, Sh'vat
- Adar (regular year)
- Adar I & Adar II (leap year)

### Mevarchim Chodesh (13 variations)
Shabbat Mevarchim for all months (same pattern as Rosh Chodesh)

### Weekly Torah Portions (Parashiyot)
59 total variations including:
- Individual parshiyot (e.g., "Parashat Bereshit")
- Combined parshiyot in non-leap years (e.g., "Parashat Vayakhel-Pekudei")
- Special readings (e.g., "Parashat Zachor", "Parashat Parah")

## Pattern Recognition Notes

### EXACT Patterns
Single, unchanging event names that appear the same every year:
- All major holidays (except Rosh Hashana with year variants)
- All fast days
- Most minor holidays
- Special Shabbatot

### NUMBERED Patterns
Multi-day events with numeric variations:
- **Chanukah**: 8 candle variations ("Chanukah: 1 Candle" through "Chanukah: 8 Candles")
- Uses both English numbers and Hebrew letters in translations

### MONTHLY Patterns
Events that repeat monthly with the month name:
- **Rosh Chodesh**: 13 variants (12 months + leap year Adar I/II)
- **Mevarchim Chodesh**: 13 variants (blessing the new month on preceding Shabbat)

### YEARLY Patterns
Events that include the Hebrew year number:
- **Rosh Hashana**: 11 variants (5781-5791 captured in our dataset)
- Pattern: "Rosh Hashana XXXX" where XXXX is Hebrew year

### PARASHAT Patterns
Weekly Torah portions:
- 59 unique variations (including combined readings)
- Format: "Parashat [Name]" or "Parashat [Name1-Name2]" for combined portions
- Some parshiyot are combined in certain years (non-leap years)

### COMBINED Patterns
Complex patterns mixing multiple elements:
- "Chanukah: 8th Day" (combines holiday with ordinal day)

## Data Quality Notes

1. **Duplicate Detection**: One duplicate found - "Erev Purim" appears twice with different Hebrew encodings
2. **Character Encoding**: Hebrew text properly captured in UTF-8
3. **Completeness**: 11-year span (2020-2030) captures all leap year variations and special cases
4. **Candle Lighting**: Excluded candle lighting times (category="candles") - only events retained

## Usage Recommendations

### For Database Tag Mappings

1. **EXACT patterns** → Direct 1:1 mapping
   ```sql
   WHERE hebcal_event_pattern = 'Purim'
   ```

2. **NUMBERED patterns** → Pattern matching with wildcards
   ```sql
   WHERE hebcal_event_pattern LIKE 'Chanukah:%'
   ```

3. **MONTHLY patterns** → Pattern with month variable
   ```sql
   WHERE hebcal_event_pattern LIKE 'Rosh Chodesh%'
   ```

4. **YEARLY patterns** → Pattern with year variable
   ```sql
   WHERE hebcal_event_pattern LIKE 'Rosh Hashana%'
   ```

5. **PARASHAT patterns** → Remove prefix for base name
   ```sql
   WHERE hebcal_event_pattern LIKE 'Parashat%'
   ```

### For Event Coverage

- **84 holidays** require tag mappings for display logic
- **13 Rosh Chodesh** variants can share single tag with month metadata
- **13 Mevarchim** variants can share single tag with month metadata
- **59 parashiyot** may need individual tags OR generic "parashat" tag
- **11 Rosh Hashana** yearly variants should map to single "rosh_hashana" tag

## CSV Schema

```csv
category,event_name_english,event_name_hebrew,pattern_type,base_pattern,notes
```

- **category**: HebCal category (holiday, parashat, roshchodesh, mevarchim)
- **event_name_english**: Full English event name from HebCal API
- **event_name_hebrew**: Full Hebrew event name from HebCal API
- **pattern_type**: Analyzed pattern type (EXACT, NUMBERED, MONTHLY, YEARLY, PARASHAT, COMBINED)
- **base_pattern**: Base pattern without variations (for grouping related events)
- **notes**: Human-readable description of pattern characteristics

## Next Steps

1. Review CSV for tag mapping strategy
2. Determine which events need explicit tags vs. pattern matching
3. Design database schema for flexible pattern matching
4. Consider whether to store base_pattern as metadata in tag_event_mappings table
5. Plan migration strategy for existing hardcoded event logic

