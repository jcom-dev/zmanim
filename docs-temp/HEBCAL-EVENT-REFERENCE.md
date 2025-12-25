# Hebcal-Go Event Reference

## Complete List of Event Names from hebcal-go Source

This is the **authoritative list** extracted from `/home/daniel/repos/hebcal-go/hebcal/holidays.go`.

### Static Holidays (from staticHolidays array)

```
Rosh Hashana II
Erev Yom Kippur
Yom Kippur
Erev Sukkot
Sukkot I
Sukkot II
Sukkot III (CH''M)
Sukkot IV (CH''M)
Sukkot V (CH''M)
Sukkot VI (CH''M)
Sukkot VII (Hoshana Raba)
Shmini Atzeret
Simchat Torah
Chanukah: 1 Candle
Asara B'Tevet
Tu BiShvat
Erev Purim
Purim
Shushan Purim
Erev Pesach
Pesach I
Pesach II
Pesach II (CH''M)        [Israel only]
Pesach III (CH''M)
Pesach IV (CH''M)
Pesach V (CH''M)
Pesach VI (CH''M)
Pesach VII
Pesach VIII              [Diaspora only]
Pesach Sheni
Lag BaOmer
Erev Shavuot
Shavuot                  [Israel only]
Shavuot I                [Diaspora only]
Shavuot II               [Diaspora only]
Tu B'Av
Rosh Hashana LaBehemot
Erev Rosh Hashana
```

### Dynamic Holidays (generated in getAllHolidaysForYear)

```
Rosh Hashana 5785        [year appended]
Shabbat Shuva
Tzom Gedaliah
Shabbat Shekalim
Shabbat Zachor
Ta'anit Esther
Shabbat Parah
Shabbat HaChodesh
Shabbat HaGadol
Ta'anit Bechorot
Leil Selichot
Purim Meshulash          [when Purim falls on Sunday]
Purim Katan              [Adar I in leap years]
Shushan Purim Katan      [Adar I in leap years]
Chanukah: 2 Candles
Chanukah: 3 Candles
Chanukah: 4 Candles
Chanukah: 5 Candles
Chanukah: 6 Candles
Chanukah: 7 Candles
Chanukah: 8 Candles
Chanukah: 8th Day
Chag HaBanot
Tzom Tammuz
Shabbat Chazon
Erev Tish'a B'Av
Tish'a B'Av
Tish'a B'Av (observed)   [when 9 Av falls on Shabbat]
Shabbat Nachamu
Shabbat Shirah
Birkat Hachamah          [every 28 years]
```

### Modern Israeli Holidays (from staticModernHolidays)

```
Yom HaShoah              [since 5711/1951]
Yom HaZikaron            [since 5708/1948]
Yom HaAtzma'ut           [since 5708/1948]
Yom Yerushalayim         [since 5727/1967]
Ben-Gurion Day           [since 5737]
Family Day               [since 5750]
Yitzhak Rabin Memorial Day [since 5758]
Herzl Day                [since 5764]
Jabotinsky Day           [since 5765]
Sigd                     [since 5769]
Yom HaAliyah             [since 5777]
Yom HaAliyah School Observance [since 5777]
Hebrew Language Day      [since 5773]
```

### Recurring Events (with variable names)

```
Rosh Chodesh {MonthName}
Shabbat Mevarchim Chodesh {MonthName}
Yom Kippur Katan {MonthName}
```

## Important Pattern Matching Notes

### Apostrophe Style

Hebcal-go uses **standard single apostrophe** (`'` U+0027), NOT fancy quote (`'` U+2019):

```
✅ CORRECT:  Ta'anit Esther
❌ WRONG:    Ta'anit Esther
```

### CH''M Pattern

Hebcal-go uses **double apostrophe** for Chol HaMoed:

```
✅ CORRECT:  Sukkot III (CH''M)
❌ WRONG:    Sukkot III (CH'M)
```

In PostgreSQL SQL, this requires **quadruple apostrophe** for escaping:

```sql
-- To match (CH''M) you need:
UPDATE tag_event_mappings SET hebcal_event_pattern = 'Sukkot III (CH''''M)';
```

### Wildcard Patterns

Some events use SQL LIKE patterns:

- `Rosh Hashana%` - Matches "Rosh Hashana 5785", "Rosh Hashana II"
- `Chanukah%` - Matches "Chanukah: 1 Candle", "Chanukah: 2 Candles", etc.
- `Shavuot%` - Matches "Shavuot", "Shavuot I", "Shavuot II"
- `%day of the Omer` - Matches "1st day of the Omer", "33rd day of the Omer", etc.
- `Rosh Chodesh%` - Matches "Rosh Chodesh Nisan", "Rosh Chodesh Tishrei", etc.

## Source Code Reference

**File:** `/home/daniel/repos/hebcal-go/hebcal/holidays.go`

**Key Functions:**
- `staticHolidays` (line 42-195) - Fixed annual holidays
- `staticModernHolidays` (line 197-228) - Modern Israeli holidays
- `getAllHolidaysForYear()` (line 281-599) - Dynamic holiday generation

**Event Struct:** `/home/daniel/repos/hebcal-go/event/holiday.go` (line 14-21)

```go
type HolidayEvent struct {
    Date          hdate.HDate
    Desc          string       // Event description
    Flags         HolidayFlags
    Emoji         string
    CholHaMoedDay int
    ChanukahDay   int
}
```

## Mapping Strategy

Our `tag_event_mappings.hebcal_event_pattern` should match `HolidayEvent.Desc` **exactly** (or use SQL LIKE pattern).

Example mappings:

| Tag Key | Hebcal Pattern | Notes |
|---------|----------------|-------|
| `rosh_hashanah` | `Rosh Hashana%` | Wildcard for year suffix |
| `yom_kippur` | `Yom Kippur` | Exact match |
| `chanukah` | `Chanukah%` | Wildcard for candle count |
| `chanukah_day_1` | `Chanukah: 1 Candle` | Exact match for specific day |
| `tisha_bav` | `Tish'a B'Av` | Note apostrophe style |
| `chol_hamoed_sukkos` | `Sukkot III (CH''M)` | Note double apostrophe |

## Testing

To verify event matching, use hebcal API:

```bash
curl "https://www.hebcal.com/hebcal?v=1&cfg=json&year=2025&month=x&s=on&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&i=on"
```

Compare `event.description` from API response with our `hebcal_event_pattern`.
