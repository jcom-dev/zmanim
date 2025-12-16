# KosherJava Zmanim - Formula Quick Reference

This document provides the exact calculation formula for every zman method.

## Legend
- **sunrise** = standard sunrise (90.833°)
- **sunset** = standard sunset (90.833°)
- **min** = minutes
- **°** = degrees below horizon
- **zmaniyos** = proportional time (fraction of day)
- **shaos** = shaah zmanis (temporal hour = day_length / 12)

---

## ALOS (Dawn) - 18 Methods

| Method | Formula | Notes |
|--------|---------|-------|
| `getAlos60()` | sunrise - 60 min | Fixed time |
| `getAlos72()` | sunrise - 72 min | Standard MGA/Rambam |
| `getAlos90()` | sunrise - 90 min | 5 mil at 18 min/mil |
| `getAlos96()` | sunrise - 96 min | 4 mil at 24 min/mil |
| `getAlos120()` | sunrise - 120 min | Lechumra only |
| `getAlos72Zmanis()` | sunrise - (day_length / 10) | 1/10 of day |
| `getAlos90Zmanis()` | sunrise - (day_length / 8) | 1/8 of day |
| `getAlos96Zmanis()` | sunrise - (day_length / 7.5) | 1/7.5 of day |
| `getAlos120Zmanis()` | sunrise - (day_length / 6) | 1/6 of day |
| `getAlosHashachar()` | sun at 90° + 16.1° | 72 min at equinox |
| `getAlos16Point1Degrees()` | sun at 90° + 16.1° | Same as above |
| `getAlos18Degrees()` | sun at 90° + 18° | Astronomical twilight |
| `getAlos19Degrees()` | sun at 90° + 19° | Various opinions |
| `getAlos19Point8Degrees()` | sun at 90° + 19.8° | 90 min at equinox |
| `getAlos26Degrees()` | sun at 90° + 26° | 120 min at equinox |
| `getAlosBaalHatanya()` | sun at 90° + 16.9° | 72 min before netz amiti |

---

## MISHEYAKIR (When One Can Distinguish) - 5 Methods

| Method | Formula | Minutes (approx) |
|--------|---------|------------------|
| `getMisheyakir7Point65Degrees()` | sun at 90° + 7.65° | 35-36 min |
| `getMisheyakir9Point5Degrees()` | sun at 90° + 9.5° | 45 min (R' Kronglass) |
| `getMisheyakir10Point2Degrees()` | sun at 90° + 10.2° | 45 min |
| `getMisheyakir11Degrees()` | sun at 90° + 11° | 48 min |
| `getMisheyakir11Point5Degrees()` | sun at 90° + 11.5° | 52 min |

---

## CHATZOS (Midday) - 3 Methods

| Method | Formula | Notes |
|--------|---------|-------|
| `getChatzos()` | Depends on setting | See below |
| `getChatzosAsHalfDay()` | (sunrise + sunset) / 2 | Midpoint method |
| `getFixedLocalChatzos()` | Local mean solar noon | Fixed time |

**Note:** `getChatzos()` returns:
- Solar transit if `isUseAstronomicalChatzos() == true`
- `getChatzosAsHalfDay()` if `false`

---

## SOF ZMAN SHMA (Latest Shema) - Formula: start_of_day + (3 × shaah_zmanis)

### GRA (1 method)
| Method | Start of Day | End of Day | Shaah Zmanis |
|--------|--------------|------------|--------------|
| `getSofZmanShmaGRA()` | sunrise | sunset | (sunset - sunrise) / 12 |

### MGA Degree-Based (3 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanShmaMGA16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getSofZmanShmaMGA18Degrees()` | alos 18° | tzais 18° |
| `getSofZmanShmaMGA19Point8Degrees()` | alos 19.8° | tzais 19.8° |

### MGA Fixed Minutes (4 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanShmaMGA()` | alos 72 min | tzais 72 min |
| `getSofZmanShmaMGA72Minutes()` | alos 72 min | tzais 72 min |
| `getSofZmanShmaMGA90Minutes()` | alos 90 min | tzais 90 min |
| `getSofZmanShmaMGA96Minutes()` | alos 96 min | tzais 96 min |
| `getSofZmanShmaMGA120Minutes()` | alos 120 min | tzais 120 min |

### MGA Zmaniyos (4 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanShmaMGA72MinutesZmanis()` | sunrise - day/10 | sunset + day/10 |
| `getSofZmanShmaMGA90MinutesZmanis()` | sunrise - day/8 | sunset + day/8 |
| `getSofZmanShmaMGA96MinutesZmanis()` | sunrise - day/7.5 | sunset + day/7.5 |

### Special Calculations
| Method | Formula | Notes |
|--------|---------|-------|
| `getSofZmanShma3HoursBeforeChatzos()` | chatzos - 3 hours | 3 hours before chatzos |
| `getSofZmanShmaAlos16Point1ToSunset()` | alos 16.1° + 3 shaos | Day ends at sunset (asymmetric) |
| `getSofZmanShmaAlos16Point1ToTzaisGeonim7Point083Degrees()` | alos 16.1° + 3 shaos | Day: alos 16.1° to tzais 7.083° |
| `getSofZmanShmaKolEliyahu()` | Custom calculation | Kol Eliyahu opinion |
| `getSofZmanShmaBaalHatanya()` | alos BH + 3 shaos | Day: alos 16.9° to tzais 6° |
| `getSofZmanShmaAteretTorah()` | alos + 3 shaos | Day: alos to tzais AT |

---

## SOF ZMAN TFILA (Latest Morning Prayer) - Formula: start_of_day + (4 × shaah_zmanis)

### GRA (1 method)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanTfilaGRA()` | sunrise | sunset |

### MGA Degree-Based (3 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanTfilaMGA16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getSofZmanTfilaMGA18Degrees()` | alos 18° | tzais 18° |
| `getSofZmanTfilaMGA19Point8Degrees()` | alos 19.8° | tzais 19.8° |

### MGA Fixed Minutes (5 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanTfilaMGA()` | alos 72 min | tzais 72 min |
| `getSofZmanTfilaMGA72Minutes()` | alos 72 min | tzais 72 min |
| `getSofZmanTfilaMGA90Minutes()` | alos 90 min | tzais 90 min |
| `getSofZmanTfilaMGA96Minutes()` | alos 96 min | tzais 96 min |
| `getSofZmanTfilaMGA120Minutes()` | alos 120 min | tzais 120 min |

### MGA Zmaniyos (4 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSofZmanTfilaMGA72MinutesZmanis()` | sunrise - day/10 | sunset + day/10 |
| `getSofZmanTfilaMGA90MinutesZmanis()` | sunrise - day/8 | sunset + day/8 |
| `getSofZmanTfilaMGA96MinutesZmanis()` | sunrise - day/7.5 | sunset + day/7.5 |

### Special Calculations
| Method | Formula | Notes |
|--------|---------|-------|
| `getSofZmanTfila2HoursBeforeChatzos()` | chatzos - 2 hours | 2 hours before chatzos |
| `getSofZmanTfilaBaalHatanya()` | alos BH + 4 shaos | Day: alos 16.9° to tzais 6° |
| `getSofZmanTfilaAteretTorah()` | alos + 4 shaos | Day: alos to tzais AT |

---

## MINCHA GEDOLA (Earliest Mincha) - Formula: start_of_day + (6.5 × shaah_zmanis) OR chatzos + (0.5 × afternoon_shaah)

### Standard Methods
| Method | Formula | Notes |
|--------|---------|-------|
| `getMinchaGedola()` | sunrise + 6.5 shaos (GRA) | Standard GRA |
| `getMinchaGedola30Minutes()` | chatzos + 30 min | Fixed 30 min |
| `getMinchaGedolaGreaterThan30()` | max(getMinchaGedola(), chatzos + 30 min) | Later of two |

### Degree/Minute Based
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getMinchaGedola16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getMinchaGedola72Minutes()` | alos 72 min | tzais 72 min |

### Special
| Method | Formula | Notes |
|--------|---------|-------|
| `getMinchaGedolaAhavatShalom()` | Complex | Later of calculated or 30 min |
| `getMinchaGedolaBaalHatanya()` | alos BH + 6.5 shaos | Baal Hatanya day |
| `getMinchaGedolaAteretTorah()` | alos + 6.5 shaos | Ateret Torah day |

---

## MINCHA KETANA (Preferred Mincha) - Formula: start_of_day + (9.5 × shaah_zmanis) OR chatzos + (3.5 × afternoon_shaah)

| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getMinchaKetana()` | sunrise | sunset |
| `getMinchaKetana16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getMinchaKetana72Minutes()` | alos 72 min | tzais 72 min |
| `getMinchaKetanaAhavatShalom()` | alos 16.1° | tzais 13.5 min |
| `getMinchaKetanaBaalHatanya()` | alos BH | tzais BH |
| `getMinchaKetanaAteretTorah()` | alos | tzais AT |

---

## SAMUCH LEMINCHA KETANA (Near Mincha Ketana) - Formula: start_of_day + (9 × shaah_zmanis)

| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getSamuchLeMinchaKetanaGRA()` | sunrise | sunset |
| `getSamuchLeMinchaKetana16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getSamuchLeMinchaKetana72Minutes()` | alos 72 min | tzais 72 min |

---

## PLAG HAMINCHA (Earliest Shabbos) - Formula: start_of_day + (10.75 × shaah_zmanis) OR chatzos + (4.75 × afternoon_shaah)

### Fixed Minutes (5 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getPlagHamincha()` | sunrise | sunset |
| `getPlagHamincha60Minutes()` | alos 60 min | tzais 60 min |
| `getPlagHamincha72Minutes()` | alos 72 min | tzais 72 min |
| `getPlagHamincha90Minutes()` | alos 90 min | tzais 90 min |
| `getPlagHamincha96Minutes()` | alos 96 min | tzais 96 min |
| `getPlagHamincha120Minutes()` | alos 120 min | tzais 120 min |

### Zmaniyos (4 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getPlagHamincha72MinutesZmanis()` | sunrise - day/10 | sunset + day/10 |
| `getPlagHamincha90MinutesZmanis()` | sunrise - day/8 | sunset + day/8 |
| `getPlagHamincha96MinutesZmanis()` | sunrise - day/7.5 | sunset + day/7.5 |
| `getPlagHamincha120MinutesZmanis()` | sunrise - day/6 | sunset + day/6 |

### Degree-Based (4 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getPlagHamincha16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getPlagHamincha18Degrees()` | alos 18° | tzais 18° |
| `getPlagHamincha19Point8Degrees()` | alos 19.8° | tzais 19.8° |
| `getPlagHamincha26Degrees()` | alos 26° | tzais 26° |

### Asymmetric (2 methods)
| Method | Start of Day | End of Day |
|--------|--------------|------------|
| `getPlagAlosToSunset()` | alos | sunset |
| `getPlagAlos16Point1ToTzaisGeonim7Point083Degrees()` | alos 16.1° | tzais 7.083° |

### Special (3 methods)
| Method | Notes |
|--------|-------|
| `getPlagAhavatShalom()` | Ahavat Shalom calculation |
| `getPlagHaminchaBaalHatanya()` | Day: alos BH to tzais BH |
| `getPlagHaminchaAteretTorah()` | Day: alos to tzais AT |

---

## BAIN HASHMASHOS (Twilight)

### Rabbeinu Tam (4 methods)
| Method | Formula | Notes |
|--------|---------|-------|
| `getBainHashmashosRT13Point24Degrees()` | sun at 90° + 13.24° after sunset | ~58.5 min |
| `getBainHashmashosRT58Point5Minutes()` | sunset + 58.5 min | Fixed time |
| `getBainHashmashosRT13Point5MinutesBefore7Point083Degrees()` | tzais 7.083° - 13.5 min | Before 3-star tzais |
| `getBainHashmashosRT2Stars()` | When 2 stars visible | Custom calculation |

### Yereim (6 methods)
| Method | Formula | Notes |
|--------|---------|-------|
| `getBainHashmashosYereim18Minutes()` | sunset - 18 min | Before sunset |
| `getBainHashmashosYereim3Point05Degrees()` | sun at 90° - 3.05° | ~18 min before |
| `getBainHashmashosYereim16Point875Minutes()` | sunset - 16.875 min | Before sunset |
| `getBainHashmashosYereim2Point8Degrees()` | sun at 90° - 2.8° | ~16.875 min |
| `getBainHashmashosYereim13Point5Minutes()` | sunset - 13.5 min | Before sunset |
| `getBainHashmashosYereim2Point1Degrees()` | sun at 90° - 2.1° | ~13.5 min |

**Note:** Negative degrees mean sun is above horizon (before sunset)

---

## TZAIS (Nightfall)

### Geonim Degree-Based (15 methods)
| Method | Degrees | Approx Minutes | Notes |
|--------|---------|----------------|-------|
| `getTzaisGeonim3Point7Degrees()` | 3.7° | 13.5 | 3/4 of 18-min mil |
| `getTzaisGeonim3Point8Degrees()` | 3.8° | 13.5 | Alternate |
| `getTzaisGeonim4Point37Degrees()` | 4.37° | 16.875 | 3/4 of 22.5-min mil |
| `getTzaisGeonim4Point61Degrees()` | 4.61° | 18 | 3/4 of 24-min mil |
| `getTzaisGeonim4Point8Degrees()` | 4.8° | ~19 | |
| `getTzaisGeonim5Point88Degrees()` | 5.88° | ~23 | |
| `getTzaisGeonim5Point95Degrees()` | 5.95° | 24 | 1 mil at 24 min/mil |
| `getTzaisGeonim6Point45Degrees()` | 6.45° | 28-31 | R' Tucazinsky (Israel) |
| `getTzaisGeonim7Point083Degrees()` | 7.083° | 30 | 3 medium stars |
| `getTzaisGeonim7Point67Degrees()` | 7.67° | ~32 | |
| `getTzaisGeonim8Point5Degrees()` | 8.5° | 36 | 3 small stars (Ohr Meir) |
| `getTzaisGeonim9Point3Degrees()` | 9.3° | ~37 | |
| `getTzaisGeonim9Point75Degrees()` | 9.75° | ~39 | |

### General Degree-Based (6 methods)
| Method | Degrees | Approx Minutes |
|--------|---------|----------------|
| `getTzais()` | 8.5° | 36 |
| `getTzais16Point1Degrees()` | 16.1° | 72 |
| `getTzais18Degrees()` | 18° | ~76 |
| `getTzais19Point8Degrees()` | 19.8° | 90 |
| `getTzais26Degrees()` | 26° | 120 |

### Fixed Minutes (7 methods)
| Method | Formula |
|--------|---------|
| `getTzais50()` | sunset + 50 min |
| `getTzais60()` | sunset + 60 min |
| `getTzais72()` | sunset + 72 min |
| `getTzais90()` | sunset + 90 min |
| `getTzais96()` | sunset + 96 min |
| `getTzais120()` | sunset + 120 min |

### Zmaniyos (4 methods)
| Method | Formula |
|--------|---------|
| `getTzais72Zmanis()` | sunset + (day / 10) |
| `getTzais90Zmanis()` | sunset + (day / 8) |
| `getTzais96Zmanis()` | sunset + (day / 7.5) |
| `getTzais120Zmanis()` | sunset + (day / 6) |

### Special (2 methods)
| Method | Formula | Notes |
|--------|---------|-------|
| `getTzaisAteretTorah()` | sunset + offset (default: 40 min) | Configurable |
| `getTzaisBaalHatanya()` | shkiah amiti + 24 min OR sun at 90° + 6° | Baal Hatanya |

---

## SPECIAL TIMES

### Sunrise/Sunset
| Method | Formula | Notes |
|--------|---------|-------|
| `getSunrise()` | sun at 90.833° | Standard (with refraction) |
| `getSeaLevelSunrise()` | sun at 90.833° | No elevation adjustment |
| `getSunset()` | sun at 90.833° | Standard |
| `getSeaLevelSunset()` | sun at 90.833° | No elevation adjustment |
| `getSunriseBaalHatanya()` | sun at 90° + 1.583° | Netz amiti |
| `getSunsetBaalHatanya()` | sun at 90° + 1.583° | Shkiah amiti |

### Candle Lighting
| Method | Formula | Default |
|--------|---------|---------|
| `getCandleLighting()` | sunset - offset | offset = 18 min |

### Kiddush Levana
| Method | Formula | Notes |
|--------|---------|-------|
| `getZmanMolad()` | Jewish Calendar calculation | Time of new moon |
| `getTchilasZmanKidushLevana3Days()` | molad + 3 days | Earliest |
| `getTchilasZmanKidushLevana7Days()` | molad + 7 days | Mechaber |
| `getSofZmanKidushLevana15Days()` | molad + 15 days | Latest |
| `getSofZmanKidushLevanaBetweenMoldos()` | Halfway between molads | Latest (alt) |

### Chametz (Pesach) - Eating
| Method | Formula | Notes |
|--------|---------|-------|
| `getSofZmanAchilasChametzGRA()` | sunrise + 5 shaos (GRA) | GRA day |
| `getSofZmanAchilasChametzMGA72Minutes()` | alos 72 + 5 shaos | MGA 72 min |
| `getSofZmanAchilasChametzMGA72MinutesZmanis()` | alos (day/10) + 5 shaos | MGA zmaniyos |
| `getSofZmanAchilasChametzMGA16Point1Degrees()` | alos 16.1° + 5 shaos | MGA 16.1° |
| `getSofZmanAchilasChametzBaalHatanya()` | alos BH + 5 shaos | Baal Hatanya |

### Chametz (Pesach) - Burning
| Method | Formula | Notes |
|--------|---------|-------|
| `getSofZmanBiurChametzGRA()` | sunrise + 6 shaos (GRA) | GRA day |
| `getSofZmanBiurChametzMGA72Minutes()` | alos 72 + 6 shaos | MGA 72 min |
| `getSofZmanBiurChametzMGA72MinutesZmanis()` | alos (day/10) + 6 shaos | MGA zmaniyos |
| `getSofZmanBiurChametzMGA16Point1Degrees()` | alos 16.1° + 6 shaos | MGA 16.1° |
| `getSofZmanBiurChametzBaalHatanya()` | alos BH + 6 shaos | Baal Hatanya |

---

## SHAOS ZMANIYOS (Temporal Hours)

Returns: milliseconds per shaah zmanis = (end_of_day - start_of_day) / 12

### GRA & MGA
| Method | Start | End |
|--------|-------|-----|
| `getShaahZmanisGra()` | sunrise | sunset |
| `getShaahZmanisMGA()` | alos 72 | tzais 72 |

### Degree-Based
| Method | Start | End |
|--------|-------|-----|
| `getShaahZmanis16Point1Degrees()` | alos 16.1° | tzais 16.1° |
| `getShaahZmanis18Degrees()` | alos 18° | tzais 18° |
| `getShaahZmanis19Point8Degrees()` | alos 19.8° | tzais 19.8° |
| `getShaahZmanis26Degrees()` | alos 26° | tzais 26° |

### Fixed Minutes
| Method | Start | End |
|--------|-------|-----|
| `getShaahZmanis60Minutes()` | alos 60 | tzais 60 |
| `getShaahZmanis72Minutes()` | alos 72 | tzais 72 |
| `getShaahZmanis90Minutes()` | alos 90 | tzais 90 |
| `getShaahZmanis96Minutes()` | alos 96 | tzais 96 |
| `getShaahZmanis120Minutes()` | alos 120 | tzais 120 |

### Zmaniyos
| Method | Start | End |
|--------|-------|-----|
| `getShaahZmanis72MinutesZmanis()` | sunrise - day/10 | sunset + day/10 |
| `getShaahZmanis90MinutesZmanis()` | sunrise - day/8 | sunset + day/8 |
| `getShaahZmanis96MinutesZmanis()` | sunrise - day/7.5 | sunset + day/7.5 |
| `getShaahZmanis120MinutesZmanis()` | sunrise - day/6 | sunset + day/6 |

### Special
| Method | Start | End |
|--------|-------|-----|
| `getShaahZmanisBaalHatanya()` | alos 16.9° | tzais 6° |
| `getShaahZmanisAteretTorah()` | alos | tzais AT |
| `getShaahZmanisAlos16Point1ToTzais7Point083()` | alos 16.1° | tzais 7.083° |

---

## CALCULATION HELPER METHODS

### Generic Calculators (from ZmanimCalendar)
```
getShaahZmanisBasedZman(startOfDay, endOfDay, hours)
  = startOfDay + (hours × shaahZmanis)
  where shaahZmanis = (endOfDay - startOfDay) / 12

getHalfDayBasedZman(startOfHalf, endOfHalf, hours)
  = startOfHalf + (hours × halfDayShaahZmanis)
  where halfDayShaahZmanis = (endOfHalf - startOfHalf) / 6
```

### Astronomical Calculators (from AstronomicalCalendar)
```
getSunriseOffsetByDegrees(zenith)
  = Calculate when sun reaches 'zenith' degrees before sunrise

getSunsetOffsetByDegrees(zenith)
  = Calculate when sun reaches 'zenith' degrees after sunset

getTimeOffset(time, offset)
  = time + offset (in milliseconds)

getTemporalHour(startOfDay, endOfDay)
  = (endOfDay - startOfDay) / 12
```

### Special Methods (ComplexZmanimCalendar)
```
getZmanisBasedOffset(hours)
  = sunrise + (hours × dayLength)
  where dayLength = sunset - sunrise

  Used for zmaniyos alos/tzais:
  - getAlos72Zmanis() uses -1.2 (= -12/10)
  - getAlos90Zmanis() uses -1.5 (= -12/8)
  - getAlos96Zmanis() uses -1.6 (= -12/7.5)
  - getAlos120Zmanis() uses -2.0 (= -12/6)
```

---

## ZMANIYOS FRACTION REFERENCE

| Fraction | Decimal | Description | Used For |
|----------|---------|-------------|----------|
| 1/10 | 0.1 | 72 minutes (zmaniyos) | Alos/Tzais 72 zmanis |
| 1/8 | 0.125 | 90 minutes (zmaniyos) | Alos/Tzais 90 zmanis |
| 1/7.5 | 0.1333... | 96 minutes (zmaniyos) | Alos/Tzais 96 zmanis |
| 1/6 | 0.1666... | 120 minutes (zmaniyos) | Alos/Tzais 120 zmanis |
| 3/12 | 0.25 | 3 shaos zmaniyos | Sof Zman Shma |
| 4/12 | 0.3333... | 4 shaos zmaniyos | Sof Zman Tfila |
| 5/12 | 0.4166... | 5 shaos zmaniyos | Chametz eating |
| 6/12 | 0.5 | 6 shaos zmaniyos / Chatzos | Chametz burning |
| 6.5/12 | 0.5416... | 6.5 shaos zmaniyos | Mincha Gedola |
| 9/12 | 0.75 | 9 shaos zmaniyos | Samuch Lemincha Ketana |
| 9.5/12 | 0.7916... | 9.5 shaos zmaniyos | Mincha Ketana |
| 10.75/12 | 0.8958... | 10.75 shaos zmaniyos | Plag Hamincha |

---

## IMPORTANT NOTES

### Asymmetric Days
Some methods use different start and end points (asymmetric days):
- `getSofZmanShmaAlos16Point1ToSunset()` - alos 16.1° to sunset (not tzais)
- `getPlagAlosToSunset()` - alos to sunset
- `getPlagAlos16Point1ToTzaisGeonim7Point083Degrees()` - alos 16.1° to tzais 7.083°

**Impact:** Chatzos is NOT at solar transit for asymmetric days.

### Synchronous vs Non-Synchronous
Generic methods (`getSofZmanShma(start, end)`, etc.) have a `synchronous` parameter:
- **true:** Start and end have same offset (e.g., both 72 min, both 16.1°)
- **false:** Different offsets (asymmetric)

When synchronous=true and `isUseAstronomicalChatzosForOtherZmanim()=true`, uses half-day calculations.

### Elevation Setting
`setUseElevation(true/false)` affects:
- `getSunrise()` / `getSunset()` - adjusted if true, sea-level if false
- All methods that call these
- Does NOT affect degree-based calculations (always use geometric calculation)

### Return Values
- All methods return `java.util.Date` or `null`
- `null` means calculation impossible (Arctic/Antarctic, invalid parameters)
- Always null-check before using

---

**Generated from KosherJava Zmanim Library**
**https://github.com/KosherJava/zmanim**
