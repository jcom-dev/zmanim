# KosherJava Zmanim Library - Comprehensive Extraction
**Extracted:** December 21, 2025
**Repository:** https://github.com/KosherJava/zmanim
**Version Analyzed:** Latest (as of Dec 2025)

## Executive Summary

The KosherJava Zmanim library is the most comprehensive Java implementation for calculating Jewish prayer times (zmanim). It contains:

- **180+ distinct zman calculation methods** across 3 main classes
- **30+ degree-based constants** for various halachic opinions
- **Multiple calculation frameworks** (time-based, degree-based, percentage-based)
- **Support for dozens of poskim** (halachic authorities) and their shitos

## Core Architecture

### Class Hierarchy
```
AstronomicalCalendar (base class - 13 methods)
  └── ZmanimCalendar (27 methods)
        └── ComplexZmanimCalendar (165 methods)
```

---

## PART 1: FUNDAMENTAL CONSTANTS

### Zenith Values (Degrees Below Horizon)

All values are relative to `GEOMETRIC_ZENITH = 90°`

#### Alos (Dawn) Calculations
- **16.1°** - Standard 72-minute dawn (Rambam, MGA) at equinox in Jerusalem
- **16.9°** - Baal Hatanya's alos (72 minutes before netz amiti)
- **18.0°** - Astronomical twilight
- **19.0°** - Various opinions for alos
- **19.8°** - 90-minute dawn at equinox in Jerusalem
- **26.0°** - 120-minute dawn (lechumra only)

#### Misheyakir (When One Can Distinguish)
- **7.65°** - 35-36 minutes before sunrise (strict opinion)
- **9.5°** - Rabbi Dovid Kronglass (45 minutes)
- **10.2°** - 45 minutes before sunrise
- **11.0°** - 48 minutes before sunrise
- **11.5°** - 52 minutes before sunrise

#### Tzais (Nightfall) Calculations - Geonim
- **3.7°** - 13.5 minutes (3/4 of 18-minute mil)
- **3.8°** - 13.5 minutes (alternate calculation)
- **3.65°** - 13.5 minutes (deprecated - calculation error)
- **3.676°** - 13.5 minutes (deprecated)
- **4.37°** - 16.875 minutes (3/4 of 22.5-minute mil)
- **4.61°** - 18 minutes (3/4 of 24-minute mil)
- **4.8°** - Approximately 19 minutes
- **5.88°** - Approximately 23 minutes
- **5.95°** - 24 minutes
- **6.0°** - Baal Hatanya (24 minutes after sunset)
- **6.45°** - Rabbi Tucazinsky (28-31 minutes, commonly used in Israel)
- **7.083°** (7°5') - Dr. Baruch Cohen (3 medium stars, ~30 minutes)
- **7.67°** - Approximately 32 minutes
- **8.5°** - Ohr Meir (3 small stars, ~36 minutes)
- **9.3°** - Approximately 37 minutes
- **9.75°** - Approximately 39 minutes

#### Bain Hashmashos (Twilight) - Rabbeinu Tam
- **13.24°** - Rabbeinu Tam's bain hashmashos

#### Special Cases (Above Horizon)
- **-1.583°** - Baal Hatanya's netz/shkiah amiti (sunrise/sunset)
- **-2.1°** - Yereim (13.5 minutes before sunset)
- **-2.8°** - Yereim (16.875 minutes before sunset)
- **-3.05°** - Yereim (18 minutes before sunset)

---

## PART 2: ZMANIM METHODS CATALOG

### AstronomicalCalendar (Base Class)
**13 Methods - Basic astronomical calculations**

1. `getSunrise()` - Elevation-adjusted sunrise (90.83333°)
2. `getSeaLevelSunrise()` - Sea-level sunrise
3. `getSunset()` - Elevation-adjusted sunset
4. `getSeaLevelSunset()` - Sea-level sunset
5. `getBeginCivilTwilight()` - 96° (dawn)
6. `getBeginNauticalTwilight()` - 102° (dawn)
7. `getBeginAstronomicalTwilight()` - 108° (dawn)
8. `getEndCivilTwilight()` - 96° (dusk)
9. `getEndNauticalTwilight()` - 102° (dusk)
10. `getEndAstronomicalTwilight()` - 108° (dusk)
11. `getSunTransit()` - Astronomical noon
12. `getSolarMidnight()` - Solar midnight (nadir)
13. `getTemporalHour(startOfDay, endOfDay)` - Shaah zmanis calculator

### ZmanimCalendar (27 Methods)
**Core Jewish prayer time calculations**

#### Alos (Dawn)
1. `getAlosHashachar()` - 16.1° (standard 72-minute dawn)
2. `getAlos72()` - 72 fixed minutes before sunrise

#### Chatzos (Midday)
3. `getChatzos()` - Astronomical or half-day chatzos (configurable)
4. `getChatzosAsHalfDay()` - Halfway between sunrise-sunset

#### Sof Zman Shma (Latest Time for Shma)
5. `getSofZmanShmaGRA()` - 3 hours (GRA) after sunrise
6. `getSofZmanShmaMGA()` - 3 hours (MGA) from alos72 to tzais72
7. `getSofZmanShma(startOfDay, endOfDay)` - Generic (3 shaos zmaniyos)

#### Sof Zman Tfila (Latest Time for Morning Prayer)
8. `getSofZmanTfilaGRA()` - 4 hours (GRA) after sunrise
9. `getSofZmanTfilaMGA()` - 4 hours (MGA) from alos72 to tzais72
10. `getSofZmanTfila(startOfDay, endOfDay)` - Generic (4 shaos zmaniyos)

#### Mincha (Afternoon Prayer)
11. `getMinchaGedola()` - 6.5 hours (GRA) after sunrise
12. `getMinchaGedola(startOfDay, endOfDay)` - Generic (6.5 shaos zmaniyos)
13. `getMinchaKetana()` - 9.5 hours (GRA) after sunrise
14. `getMinchaKetana(startOfDay, endOfDay)` - Generic (9.5 shaos zmaniyos)
15. `getSamuchLeMinchaKetana(startOfDay, endOfDay)` - 9 hours (near mincha ketana)

#### Plag Hamincha (Earliest Shabbos Time)
16. `getPlagHamincha()` - 10.75 hours (GRA) after sunrise
17. `getPlagHamincha(startOfDay, endOfDay)` - Generic (10.75 shaos zmaniyos)

#### Tzais (Nightfall)
18. `getTzais()` - 8.5° (Ohr Meir - 3 small stars)
19. `getTzais72()` - 72 fixed minutes after sunset

#### Candle Lighting
20. `getCandleLighting()` - Configurable minutes before sunset (default: 18)

#### Utility Methods
21. `getShaahZmanisGra()` - Temporal hour (sunrise to sunset)
22. `getShaahZmanisMGA()` - Temporal hour (alos72 to tzais72)
23. `getShaahZmanisBasedZman(start, end, hours)` - Generic calculator
24. `getHalfDayBasedZman(startHalf, endHalf, hours)` - Half-day calculator
25. `getElevationAdjustedSunrise()` - Respects elevation setting
26. `getElevationAdjustedSunset()` - Respects elevation setting
27. `isAssurBemlacha(currentTime, tzais, inIsrael)` - Melacha prohibition checker

### ComplexZmanimCalendar (165 Methods)
**Extended zmanim for dozens of halachic opinions**

#### ALOS (Dawn) - 18 Variations

**Time-Based (Fixed Minutes)**
1. `getAlos60()` - 60 minutes before sunrise
2. `getAlos72()` - Inherited (72 minutes)
3. `getAlos90()` - 90 minutes before sunrise
4. `getAlos96()` - 96 minutes before sunrise
5. `getAlos120()` - 120 minutes before sunrise (lechumra)

**Time-Based (Zmaniyos Minutes - Proportional)**
6. `getAlos72Zmanis()` - 1/10 of day before sunrise
7. `getAlos90Zmanis()` - 1/8 of day before sunrise
8. `getAlos96Zmanis()` - 1/7.5 of day before sunrise
9. `getAlos120Zmanis()` - 1/6 of day before sunrise

**Degree-Based**
10. `getAlosHashachar()` / `getAlos16Point1Degrees()` - 16.1° (72 min)
11. `getAlos18Degrees()` - 18°
12. `getAlos19Degrees()` - 19°
13. `getAlos19Point8Degrees()` - 19.8° (90 min)
14. `getAlos26Degrees()` - 26° (120 min)

**Baal Hatanya**
15. `getAlosBaalHatanya()` - 16.9° before netz amiti

#### MISHEYAKIR (When One Can Distinguish) - 5 Variations
16. `getMisheyakir7Point65Degrees()` - 7.65° (35-36 min)
17. `getMisheyakir9Point5Degrees()` - 9.5° (45 min, R' Dovid Kronglass)
18. `getMisheyakir10Point2Degrees()` - 10.2° (45 min)
19. `getMisheyakir11Degrees()` - 11° (48 min)
20. `getMisheyakir11Point5Degrees()` - 11.5° (52 min)

#### SOF ZMAN SHMA (Latest Shma) - 20+ Variations

**MGA Degree-Based**
21. `getSofZmanShmaMGA16Point1Degrees()` - Day: alos 16.1° to tzais 16.1°
22. `getSofZmanShmaMGA18Degrees()` - Day: alos 18° to tzais 18°
23. `getSofZmanShmaMGA19Point8Degrees()` - Day: alos 19.8° to tzais 19.8°

**MGA Fixed Minutes**
24. `getSofZmanShmaMGA72Minutes()` - Day: alos 72 min to tzais 72 min
25. `getSofZmanShmaMGA90Minutes()` - Day: alos 90 min to tzais 90 min
26. `getSofZmanShmaMGA96Minutes()` - Day: alos 96 min to tzais 96 min
27. `getSofZmanShmaMGA120Minutes()` - Day: alos 120 min to tzais 120 min

**MGA Zmaniyos Minutes**
28. `getSofZmanShmaMGA72MinutesZmanis()` - Day: 1/10 day to 1/10 day
29. `getSofZmanShmaMGA90MinutesZmanis()` - Day: 1/8 day to 1/8 day
30. `getSofZmanShmaMGA96MinutesZmanis()` - Day: 1/7.5 day to 1/7.5 day

**Special Calculations**
31. `getSofZmanShma3HoursBeforeChatzos()` - 3 hours before chatzos
32. `getSofZmanShmaAlos16Point1ToSunset()` - Day: alos 16.1° to sunset
33. `getSofZmanShmaAlos16Point1ToTzaisGeonim7Point083Degrees()` - Asymmetric day
34. `getSofZmanShmaKolEliyahu()` - Kol Eliyahu calculation

**Ateret Torah**
35. `getSofZmanShmaAteretTorah()` - Ateret Torah method

**Baal Hatanya**
36. `getSofZmanShmaBaalHatanya()` - Baal Hatanya method

**Fixed Local Chatzos**
37. `getSofZmanShmaFixedLocal()` - Based on fixed local chatzos
38. `getSofZmanShmaMGA18DegreesToFixedLocalChatzos()` - MGA 18° to fixed chatzos
39. `getSofZmanShmaMGA16Point1DegreesToFixedLocalChatzos()` - MGA 16.1° to fixed chatzos
40. `getSofZmanShmaMGA90MinutesToFixedLocalChatzos()` - MGA 90 min to fixed chatzos
41. `getSofZmanShmaMGA72MinutesToFixedLocalChatzos()` - MGA 72 min to fixed chatzos
42. `getSofZmanShmaGRASunriseToFixedLocalChatzos()` - GRA to fixed chatzos

#### SOF ZMAN TFILA (Latest Morning Prayer) - 15+ Variations

**MGA Degree-Based**
43. `getSofZmanTfilaMGA16Point1Degrees()` - 4 hours, day: alos 16.1° to tzais 16.1°
44. `getSofZmanTfilaMGA18Degrees()` - 4 hours, day: alos 18° to tzais 18°
45. `getSofZmanTfilaMGA19Point8Degrees()` - 4 hours, day: alos 19.8° to tzais 19.8°

**MGA Fixed Minutes**
46. `getSofZmanTfilaMGA72Minutes()` - 4 hours, day: alos 72 to tzais 72
47. `getSofZmanTfilaMGA90Minutes()` - 4 hours, day: alos 90 to tzais 90
48. `getSofZmanTfilaMGA96Minutes()` - 4 hours, day: alos 96 to tzais 96
49. `getSofZmanTfilaMGA120Minutes()` - 4 hours, day: alos 120 to tzais 120

**MGA Zmaniyos Minutes**
50. `getSofZmanTfilaMGA72MinutesZmanis()` - 4 hours, day: 1/10 to 1/10
51. `getSofZmanTfilaMGA90MinutesZmanis()` - 4 hours, day: 1/8 to 1/8
52. `getSofZmanTfilaMGA96MinutesZmanis()` - 4 hours, day: 1/7.5 to 1/7.5

**Special Calculations**
53. `getSofZmanTfila2HoursBeforeChatzos()` - 2 hours before chatzos

**Ateret Torah & Baal Hatanya**
54. `getSofZmanTfilaAteretTorah()` / `getSofZmanTfilahAteretTorah()` - Ateret Torah
55. `getSofZmanTfilaBaalHatanya()` - Baal Hatanya

**Fixed Local Chatzos**
56. `getSofZmanTfilaGRASunriseToFixedLocalChatzos()` - GRA to fixed chatzos

#### MINCHA GEDOLA (Earliest Mincha) - 8+ Variations

**Special Methods**
57. `getMinchaGedola30Minutes()` - Fixed 30 min after chatzos
58. `getMinchaGedolaGreaterThan30()` - Later of 30 min or standard calculation

**Degree-Based**
59. `getMinchaGedola16Point1Degrees()` - Day: alos 16.1° to tzais 16.1°

**Fixed Minutes**
60. `getMinchaGedola72Minutes()` - Day: alos 72 to tzais 72

**Special Calculations**
61. `getMinchaGedolaAhavatShalom()` - Ahavat Shalom method

**Ateret Torah & Baal Hatanya**
62. `getMinchaGedolaAteretTorah()` - Ateret Torah
63. `getMinchaGedolaBaalHatanya()` - Baal Hatanya
64. `getMinchaGedolaBaalHatanyaGreaterThan30()` - Baal Hatanya with 30-min minimum

**Fixed Local Chatzos**
65. `getMinchaGedolaGRAFixedLocalChatzos30Minutes()` - 30 min after fixed chatzos

#### MINCHA KETANA (Preferred Mincha Time) - 5+ Variations

**Degree-Based**
66. `getMinchaKetana16Point1Degrees()` - Day: alos 16.1° to tzais 16.1°

**Fixed Minutes**
67. `getMinchaKetana72Minutes()` - Day: alos 72 to tzais 72

**Special Calculations**
68. `getMinchaKetanaAhavatShalom()` - Ahavat Shalom method

**Ateret Torah & Baal Hatanya**
69. `getMinchaKetanaAteretTorah()` - Ateret Torah
70. `getMinchaKetanaBaalHatanya()` - Baal Hatanya

**Fixed Local Chatzos**
71. `getMinchaKetanaGRAFixedLocalChatzosToSunset()` - Fixed chatzos to sunset

#### SAMUCH LEMINCHA KETANA (Near Mincha Ketana) - 3 Variations
72. `getSamuchLeMinchaKetanaGRA()` - GRA (9 hours)
73. `getSamuchLeMinchaKetana16Point1Degrees()` - 16.1° degrees
74. `getSamuchLeMinchaKetana72Minutes()` - 72 minutes

#### PLAG HAMINCHA (Earliest Shabbos) - 18+ Variations

**Fixed Minutes**
75. `getPlagHamincha60Minutes()` - Day: alos 60 to tzais 60
76. `getPlagHamincha72Minutes()` - Day: alos 72 to tzais 72
77. `getPlagHamincha90Minutes()` - Day: alos 90 to tzais 90
78. `getPlagHamincha96Minutes()` - Day: alos 96 to tzais 96
79. `getPlagHamincha120Minutes()` - Day: alos 120 to tzais 120

**Zmaniyos Minutes**
80. `getPlagHamincha72MinutesZmanis()` - Day: 1/10 to 1/10
81. `getPlagHamincha90MinutesZmanis()` - Day: 1/8 to 1/8
82. `getPlagHamincha96MinutesZmanis()` - Day: 1/7.5 to 1/7.5
83. `getPlagHamincha120MinutesZmanis()` - Day: 1/6 to 1/6

**Degree-Based**
84. `getPlagHamincha16Point1Degrees()` - Day: alos 16.1° to tzais 16.1°
85. `getPlagHamincha18Degrees()` - Day: alos 18° to tzais 18°
86. `getPlagHamincha19Point8Degrees()` - Day: alos 19.8° to tzais 19.8°
87. `getPlagHamincha26Degrees()` - Day: alos 26° to tzais 26°

**Asymmetric Days**
88. `getPlagAlosToSunset()` - Day: alos to sunset
89. `getPlagAlos16Point1ToTzaisGeonim7Point083Degrees()` - Day: alos 16.1° to tzais 7.083°

**Special Calculations**
90. `getPlagAhavatShalom()` - Ahavat Shalom method

**Ateret Torah & Baal Hatanya**
91. `getPlagHaminchaAteretTorah()` - Ateret Torah
92. `getPlagHaminchaBaalHatanya()` - Baal Hatanya

**Fixed Local Chatzos**
93. `getPlagHaminchaGRAFixedLocalChatzosToSunset()` - Fixed chatzos to sunset

#### BAIN HASHMASHOS (Twilight) - 14 Variations

**Rabbeinu Tam**
94. `getBainHashmashosRT13Point24Degrees()` / `getBainHasmashosRT13Point24Degrees()` - 13.24°
95. `getBainHashmashosRT58Point5Minutes()` / `getBainHasmashosRT58Point5Minutes()` - 58.5 fixed minutes
96. `getBainHashmashosRT13Point5MinutesBefore7Point083Degrees()` - 13.5 min before 7.083°
97. `getBainHashmashosRT2Stars()` / `getBainHasmashosRT2Stars()` - 2 stars visible

**Yereim**
98. `getBainHashmashosYereim18Minutes()` / `getBainHasmashosYereim18Minutes()` - 18 min before sunset
99. `getBainHashmashosYereim3Point05Degrees()` / `getBainHasmashosYereim3Point05Degrees()` - 3.05° (18 min)
100. `getBainHashmashosYereim16Point875Minutes()` / `getBainHasmashosYereim16Point875Minutes()` - 16.875 min
101. `getBainHashmashosYereim2Point8Degrees()` / `getBainHasmashosYereim2Point8Degrees()` - 2.8° (16.875 min)
102. `getBainHashmashosYereim13Point5Minutes()` / `getBainHasmashosYereim13Point5Minutes()` - 13.5 min
103. `getBainHashmashosYereim2Point1Degrees()` / `getBainHasmashosYereim2Point1Degrees()` - 2.1° (13.5 min)

#### TZAIS (Nightfall) - 29+ Variations

**Geonim (Degree-Based)**
104. `getTzaisGeonim3Point7Degrees()` - 3.7° (13.5 min)
105. `getTzaisGeonim3Point8Degrees()` - 3.8° (13.5 min)
106. `getTzaisGeonim3Point65Degrees()` - 3.65° (deprecated)
107. `getTzaisGeonim3Point676Degrees()` - 3.676° (deprecated)
108. `getTzaisGeonim4Point37Degrees()` - 4.37° (16.875 min)
109. `getTzaisGeonim4Point61Degrees()` - 4.61° (18 min)
110. `getTzaisGeonim4Point8Degrees()` - 4.8° (~19 min)
111. `getTzaisGeonim5Point88Degrees()` - 5.88° (~23 min)
112. `getTzaisGeonim5Point95Degrees()` - 5.95° (24 min)
113. `getTzaisGeonim6Point45Degrees()` - 6.45° (28-31 min, Israel standard)
114. `getTzaisGeonim7Point083Degrees()` - 7.083° (30 min, 3 medium stars)
115. `getTzaisGeonim7Point67Degrees()` - 7.67° (~32 min)
116. `getTzaisGeonim8Point5Degrees()` - 8.5° (36 min, Ohr Meir)
117. `getTzaisGeonim9Point3Degrees()` - 9.3° (~37 min)
118. `getTzaisGeonim9Point75Degrees()` - 9.75° (~39 min)

**Degree-Based (General)**
119. `getTzais()` - 8.5° (inherited from ZmanimCalendar)
120. `getTzais16Point1Degrees()` - 16.1° (72 min)
121. `getTzais18Degrees()` - 18°
122. `getTzais19Point8Degrees()` - 19.8° (90 min)
123. `getTzais26Degrees()` - 26° (120 min)

**Time-Based (Fixed Minutes)**
124. `getTzais50()` - 50 minutes
125. `getTzais60()` - 60 minutes
126. `getTzais72()` - 72 minutes (inherited)
127. `getTzais90()` - 90 minutes
128. `getTzais96()` - 96 minutes
129. `getTzais120()` - 120 minutes

**Time-Based (Zmaniyos Minutes)**
130. `getTzais72Zmanis()` - 1/10 of day after sunset
131. `getTzais90Zmanis()` - 1/8 of day after sunset
132. `getTzais96Zmanis()` - 1/7.5 of day after sunset
133. `getTzais120Zmanis()` - 1/6 of day after sunset

**Ateret Torah & Baal Hatanya**
134. `getTzaisAteretTorah()` - Ateret Torah (40 min default, configurable)
135. `getTzaisBaalHatanya()` - Baal Hatanya (6° after shkiah amiti)

#### SPECIAL ZMANIM

**Baal Hatanya Special Times**
136. `getSunriseBaalHatanya()` - Netz amiti (1.583°)
137. `getSunsetBaalHatanya()` - Shkiah amiti (1.583°)

**Fixed Local Chatzos**
138. `getFixedLocalChatzos()` - Fixed local mean time chatzos
139. `getFixedLocalChatzosBasedZmanim(start, end, hours)` - Generic calculator

**Kiddush Levana (Sanctifying the Moon)**
140. `getTchilasZmanKidushLevana3Days()` - Earliest: 3 days after molad
141. `getTchilasZmanKidushLevana7Days()` - Earliest: 7 days after molad (Mechaber)
142. `getSofZmanKidushLevana15Days()` - Latest: 15 days
143. `getSofZmanKidushLevanaBetweenMoldos()` - Latest: halfway between molads
144. `getZmanMolad()` - Time of molad

**Pesach - Chametz Times**
145. `getSofZmanAchilasChametzGRA()` - Latest eating (GRA, 5 hours)
146. `getSofZmanAchilasChametzMGA72Minutes()` - Latest eating (MGA 72 min, 5 hours)
147. `getSofZmanAchilasChametzMGA72MinutesZmanis()` - Latest eating (MGA zmanis, 5 hours)
148. `getSofZmanAchilasChametzMGA16Point1Degrees()` - Latest eating (MGA 16.1°, 5 hours)
149. `getSofZmanAchilasChametzBaalHatanya()` - Latest eating (Baal Hatanya, 5 hours)
150. `getSofZmanBiurChametzGRA()` - Latest burning (GRA, 6 hours)
151. `getSofZmanBiurChametzMGA72Minutes()` - Latest burning (MGA 72 min, 6 hours)
152. `getSofZmanBiurChametzMGA72MinutesZmanis()` - Latest burning (MGA zmanis, 6 hours)
153. `getSofZmanBiurChametzMGA16Point1Degrees()` - Latest burning (MGA 16.1°, 6 hours)
154. `getSofZmanBiurChametzBaalHatanya()` - Latest burning (Baal Hatanya, 6 hours)

#### SHAOS ZMANIYOS (Temporal Hours) - 20+ Variations

Each returns milliseconds for one temporal hour based on different day definitions:

**Degree-Based**
- `getShaahZmanis16Point1Degrees()` - Day: 16.1° to 16.1°
- `getShaahZmanis18Degrees()` - Day: 18° to 18°
- `getShaahZmanis19Point8Degrees()` - Day: 19.8° to 19.8°
- `getShaahZmanis26Degrees()` - Day: 26° to 26°

**Fixed Minutes**
- `getShaahZmanis60Minutes()` - Day: alos 60 to tzais 60
- `getShaahZmanis72Minutes()` - Day: alos 72 to tzais 72
- `getShaahZmanis90Minutes()` - Day: alos 90 to tzais 90
- `getShaahZmanis96Minutes()` - Day: alos 96 to tzais 96
- `getShaahZmanis120Minutes()` - Day: alos 120 to tzais 120

**Zmaniyos Minutes**
- `getShaahZmanis72MinutesZmanis()` - Day: 1/10 to 1/10
- `getShaahZmanis90MinutesZmanis()` - Day: 1/8 to 1/8
- `getShaahZmanis96MinutesZmanis()` - Day: 1/7.5 to 1/7.5
- `getShaahZmanis120MinutesZmanis()` - Day: 1/6 to 1/6

**Asymmetric**
- `getShaahZmanisAlos16Point1ToTzais7Point083()` - Day: alos 16.1° to tzais 7.083°

**Baal Hatanya**
- `getShaahZmanisBaalHatanya()` - Day: alos 16.9° to tzais 6°

**Ateret Torah**
- `getShaahZmanisAteretTorah()` - Day: alos to tzais Ateret Torah

---

## PART 3: HALACHIC OPINIONS & SHITOS

### Major Poskim (Halachic Authorities) Represented

#### GRA (Vilna Gaon)
- **Day Definition:** Sunrise to sunset (sea level or elevation-adjusted)
- **Shaah Zmanis:** 1/12 of sunrise-sunset period
- **Sof Zman Shma:** 3 hours after sunrise
- **Sof Zman Tfila:** 4 hours after sunrise
- **Mincha Gedola:** 6.5 hours after sunrise
- **Mincha Ketana:** 9.5 hours after sunrise
- **Plag Hamincha:** 10.75 hours after sunrise

#### MGA (Magen Avraham)
- **Day Definition:** Alos to tzais (multiple variations)
- **Primary:** 72 minutes before sunrise to 72 minutes after sunset
- **Variations:** 60, 90, 96, 120 minutes (fixed or zmaniyos)
- **Degree Variations:** 16.1°, 18°, 19.8°
- **Sof Zman Shma:** 3 shaos zmaniyos after alos
- **Sof Zman Tfila:** 4 shaos zmaniyos after alos

#### Baal Hatanya (Tanya, Shneur Zalman of Liadi)
- **Netz Amiti (True Sunrise):** 1.583° below horizon
- **Shkiah Amiti (True Sunset):** 1.583° below horizon
- **Alos:** 16.9° (72 minutes before netz amiti)
- **Tzais:** 6° (24 minutes after shkiah amiti)
- **All calculations:** Based on netz amiti/shkiah amiti, not standard sunrise/sunset

#### Rabbeinu Tam
- **Tzais:** 72 fixed minutes after sunset (or degree equivalent)
- **Bain Hashmashos:** 13.24° (58.5 minutes after sunset)
- **Variants:** 13.5 minutes before 7.083° tzais

#### Geonim
**Multiple tzais opinions based on time to walk fractions of a mil:**
- **3.7° - 3.8°:** 13.5 minutes (3/4 of 18-min mil)
- **4.37°:** 16.875 minutes (3/4 of 22.5-min mil)
- **4.61°:** 18 minutes (3/4 of 24-min mil)
- **5.95°:** 24 minutes (1 mil at 24 min/mil)
- **6.45°:** Rabbi Tucazinsky (28-31 minutes)
- **7.083°:** Dr. Baruch Cohen (3 medium stars, ~30 minutes)
- **8.5°:** Ohr Meir (3 small stars, ~36 minutes)

#### Yereim (Rabbi Eliezer of Metz)
**Bain Hashmashos before sunset:**
- **13.5 minutes:** 2.1° above horizon
- **16.875 minutes:** 2.8° above horizon
- **18 minutes:** 3.05° above horizon

#### Ateret Torah (Chacham Yosef Harari-Raful)
- **Tzais:** Configurable offset after sunset (default: 40 minutes)
- **All zmanim:** Calculated based on this tzais

#### Other Poskim
- **Kol Eliyahu:** Specific sof zman shma calculation
- **Ahavat Shalom:** Special mincha gedola/ketana methods
- **Machzikei Hadass (Manchester):** Asymmetric day (alos 12° to tzais 7.083°)

---

## PART 4: CALCULATION METHODOLOGIES

### 1. Fixed Time Offset
**Simple addition/subtraction from sunrise/sunset**
- Example: Alos72 = sunrise - 72 minutes
- Example: Tzais72 = sunset + 72 minutes
- Variants: 50, 60, 72, 90, 96, 120 minutes

### 2. Degree-Based Offset
**Sun's position below/above horizon**
- Calculate when sun reaches specific degree below horizon
- Example: Alos 16.1° = sun 16.1° below eastern horizon before sunrise
- Example: Tzais 8.5° = sun 8.5° below western horizon after sunset
- Degrees: 1.583°, 3.7°, 4.8°, 6°, 7.083°, 8.5°, 10.2°, 11°, 16.1°, 18°, 19.8°, 26°, etc.

### 3. Proportional (Zmaniyos) Time
**Fraction of day length**
- Calculate actual day length (sunrise to sunset)
- Take fraction of that length
- Example: Alos 72 Zmaniyos = sunrise - (1/10 × day_length)
- Fractions: 1/6, 1/7.5, 1/8, 1/10 of day

### 4. Shaos Zmaniyos (Temporal Hours)
**Divide day into 12 equal parts**
- Day definition varies by opinion (sunrise-sunset, alos-tzais, etc.)
- 1 shaah zmanis = day_length / 12
- Example: Sof Zman Shma = start_of_day + (3 × shaah_zmanis)
- Example: Plag Hamincha = start_of_day + (10.75 × shaah_zmanis)

### 5. Half-Day Based (Chatzos-Based)
**Split day at midpoint, calculate from chatzos**
- Morning zmanim: fractions of sunrise-to-chatzos
- Afternoon zmanim: fractions of chatzos-to-sunset
- Example: Mincha Gedola = chatzos + (0.5 × afternoon_shaah_zmanis)
- Used when `isUseAstronomicalChatzosForOtherZmanim()` is true

### 6. Fixed Local Chatzos
**Based on local mean time, not astronomical chatzos**
- Chatzos at fixed clock time for location
- Used by some calendars for consistency
- Helpful for locations where astronomical chatzos varies significantly

### 7. Asymmetric Days
**Different start and end offsets**
- Example: Day from alos 16.1° to sunset (not tzais)
- Example: Day from alos 16.1° to tzais 7.083° (Manchester calendar)
- More complex but accurate for certain customs

---

## PART 5: KEY CONCEPTS

### Mil (Halachic Distance Unit)
**Time to walk 4000 amos (cubits)**
- **18 minutes:** Most common (Rambam)
- **22.5 minutes:** Some opinions
- **24 minutes:** Some opinions
- **72 minutes = 4 mil** (standard dawn/dusk)
- **90 minutes = 5 mil** (some opinions)
- **Fractions:** 3/4 mil = 13.5, 16.875, 18 minutes (depending on mil length)

### Shaah Zmanis (Temporal Hour)
**1/12 of the defined day**
- Longer in summer, shorter in winter
- Different poskim define "day" differently:
  - GRA: sunrise to sunset
  - MGA: alos to tzais (various definitions)
  - Baal Hatanya: netz amiti to shkiah amiti

### Equinox vs. Equilux
**Critical for degree calculations**
- **Equinox:** Sun at celestial equator (March 20, Sept 22)
- **Equilux:** Equal day/night length (few days before/after equinox)
- **Jerusalem equilux:** Used as reference for many degree values
- Degree values calibrated to specific time offsets at Jerusalem equilux

### Elevation
**Configurable via `setUseElevation(boolean)`**
- **True:** Sunrise/sunset adjusted for elevation (earlier/later)
- **False:** Sea-level calculations
- **Debate:** Some poskim say only sunrise/sunset should use elevation
- **Impact:** Affects all zmanim based on sunrise/sunset

### Chatzos (Midday)
**Two calculation methods:**
1. **Astronomical:** Sun's transit (most accurate)
2. **Half-Day:** Midpoint between sunrise-sunset
3. **Fixed Local:** Based on local mean time

Configurable via `setUseAstronomicalChatzos(boolean)`

---

## PART 6: ZMANIM CATEGORIES

### Dawn (Alos) - 18 Methods
- **Purpose:** Earliest time for morning prayers, tallis, tefillin
- **Range:** 120 minutes to ~35 minutes before sunrise
- **Variations:** Fixed time, degrees, proportional

### When One Can Distinguish (Misheyakir) - 5 Methods
- **Purpose:** When one can distinguish between blue and white strings
- **Required for:** Tallis, tefillin (some opinions)
- **Range:** 52 to 35 minutes before sunrise
- **Based on:** Degree below horizon

### Latest Shma - 20+ Methods
- **Purpose:** Deadline for reciting morning Shma
- **Standard:** 3 shaos zmaniyos after day start
- **Variations:** Different day definitions (GRA, MGA variants)

### Latest Morning Prayer (Tfila) - 15+ Methods
- **Purpose:** Deadline for Shacharit (morning prayer)
- **Standard:** 4 shaos zmaniyos after day start
- **Variations:** Different day definitions

### Midday (Chatzos) - 3 Methods
- **Purpose:** Halachic noon, dividing point of day
- **Methods:** Astronomical transit, half-day, fixed local

### Earliest Mincha (Mincha Gedola) - 8+ Methods
- **Purpose:** Earliest time for afternoon prayer
- **Standard:** 6.5 shaos zmaniyos (or 0.5 after chatzos)
- **Minimum:** 30 minutes after chatzos (some opinions)

### Preferred Mincha (Mincha Ketana) - 5+ Methods
- **Purpose:** Preferred time for Mincha (Rambam)
- **Standard:** 9.5 shaos zmaniyos (or 3.5 after chatzos)

### Plag Hamincha - 18+ Methods
- **Purpose:** Earliest time to accept Shabbat/pray Maariv
- **Standard:** 10.75 shaos zmaniyos (or 1.25 hours before end of day)
- **Variations:** Different day definitions

### Twilight (Bain Hashmashos) - 14 Methods
- **Purpose:** Uncertain period (possibly day, possibly night)
- **Rabbeinu Tam:** After sunset
- **Yereim:** Before sunset
- **Practical:** Stricter for ending work, lenient for starting mitzvot

### Nightfall (Tzais) - 29+ Methods
- **Purpose:** End of day, start of next day
- **When:** 3 medium stars visible
- **Range:** 13.5 to 120 minutes after sunset
- **Most Common:** 18-50 minutes (varies by community)

### Candle Lighting - 1 Method (Configurable)
- **Default:** 18 minutes before sunset
- **Jerusalem:** 40 minutes
- **Some:** 15, 20, 30 minutes

### Special Times
- **Kiddush Levana:** Moon sanctification window
- **Chametz:** Pesach-specific eating/burning deadlines
- **Fast Days:** Start/end times

---

## PART 7: IMPLEMENTATION PATTERNS

### Generic Calculation Methods
**Base methods that power specific zmanim:**

```java
// Calculate any zman based on shaos zmaniyos
Date getShaahZmanisBasedZman(Date startOfDay, Date endOfDay, double hours)

// Calculate half-day based zmanim (morning or afternoon)
Date getHalfDayBasedZman(Date startOfHalfDay, Date endOfHalfDay, double hours)

// Generic sof zman shma (3 hours)
Date getSofZmanShma(Date startOfDay, Date endOfDay)

// Generic sof zman tfila (4 hours)
Date getSofZmanTfila(Date startOfDay, Date endOfDay)

// Generic mincha gedola (6.5 hours)
Date getMinchaGedola(Date startOfDay, Date endOfDay)

// Generic mincha ketana (9.5 hours)
Date getMinchaKetana(Date startOfDay, Date endOfDay)

// Generic plag hamincha (10.75 hours)
Date getPlagHamincha(Date startOfDay, Date endOfDay)
```

### Custom Zman Calculation Examples

**Example 1: Custom alos (14° below horizon)**
```java
Date alos14 = czc.getSunriseOffsetByDegrees(GEOMETRIC_ZENITH + 14);
```

**Example 2: Mincha Gedola with custom day**
```java
Date customAlos = czc.getSunriseOffsetByDegrees(GEOMETRIC_ZENITH + 12);
Date customTzais = czc.getSunsetOffsetByDegrees(GEOMETRIC_ZENITH + 7.083);
Date minchaGedola = czc.getMinchaGedola(customAlos, customTzais);
```

**Example 3: Custom shaah zmanis based zman**
```java
long shaahZmanis = czc.getTemporalHour(customAlos, customTzais);
Date sofZmanAchila = czc.getTimeOffset(customAlos, shaahZmanis * 9);
```

---

## PART 8: DEGREE VALUES REFERENCE TABLE

| Degrees | Minutes | Mil Fraction | Opinion/Source | Use Case |
|---------|---------|--------------|----------------|----------|
| 1.583° | ~6 min | - | Baal Hatanya | Netz/Shkiah Amiti |
| 3.7° | 13.5 min | 3/4 (18 min/mil) | Geonim | Tzais |
| 3.8° | 13.5 min | 3/4 (18 min/mil) | Geonim | Tzais |
| 4.37° | 16.875 min | 3/4 (22.5 min/mil) | Geonim | Tzais |
| 4.61° | 18 min | 3/4 (24 min/mil) | Geonim | Tzais |
| 4.8° | ~19 min | - | Geonim | Tzais |
| 5.88° | ~23 min | - | Geonim | Tzais |
| 5.95° | 24 min | 1 mil (24 min/mil) | Geonim | Tzais |
| 6.0° | 24 min | 1 mil | Baal Hatanya | Tzais |
| 6.45° | 28-31 min | - | R' Tucazinsky | Tzais (Israel) |
| 7.083° | 30 min | - | Dr. Cohen | Tzais (3 med stars) |
| 7.65° | 35-36 min | - | Various | Misheyakir |
| 7.67° | ~32 min | - | Geonim | Tzais |
| 8.5° | 36 min | 2 mil (18 min/mil) | Ohr Meir | Tzais (3 small stars) |
| 9.3° | ~37 min | - | Geonim | Tzais |
| 9.5° | 45 min | - | R' Kronglass | Misheyakir |
| 9.75° | ~39 min | - | Geonim | Tzais |
| 10.2° | 45 min | - | Various | Misheyakir |
| 11.0° | 48 min | - | Various | Misheyakir |
| 11.5° | 52 min | - | Various | Misheyakir |
| 13.24° | 58.5 min | - | Rabbeinu Tam | Bain Hashmashos |
| 16.1° | 72 min | 4 mil (18 min/mil) | Rambam/MGA | Alos/Tzais standard |
| 16.9° | 72 min | 4 mil | Baal Hatanya | Alos (to netz amiti) |
| 18.0° | ~76 min | - | Astronomical | Alos/Tzais |
| 19.0° | ~80 min | - | Various | Alos/Tzais |
| 19.8° | 90 min | 5 mil (18 min/mil) | Various | Alos/Tzais |
| 26.0° | 120 min | - | Lechumra | Alos/Tzais |

**Note:** Minute values calculated for Jerusalem at equinox/equilux. Will vary by location and season.

---

## PART 9: SHAOS ZMANIYOS METHODS

### Day Start → Day End Definitions

| Method | Day Start | Day End | Type |
|--------|-----------|---------|------|
| `getShaahZmanisGra()` | Sunrise | Sunset | GRA standard |
| `getShaahZmanisMGA()` | Alos 72 min | Tzais 72 min | MGA standard |
| `getShaahZmanis16Point1Degrees()` | Alos 16.1° | Tzais 16.1° | Degree |
| `getShaahZmanis18Degrees()` | Alos 18° | Tzais 18° | Degree |
| `getShaahZmanis19Point8Degrees()` | Alos 19.8° | Tzais 19.8° | Degree |
| `getShaahZmanis26Degrees()` | Alos 26° | Tzais 26° | Degree |
| `getShaahZmanis60Minutes()` | Alos 60 min | Tzais 60 min | Fixed |
| `getShaahZmanis72Minutes()` | Alos 72 min | Tzais 72 min | Fixed |
| `getShaahZmanis90Minutes()` | Alos 90 min | Tzais 90 min | Fixed |
| `getShaahZmanis96Minutes()` | Alos 96 min | Tzais 96 min | Fixed |
| `getShaahZmanis120Minutes()` | Alos 120 min | Tzais 120 min | Fixed |
| `getShaahZmanis72MinutesZmanis()` | Alos 1/10 day | Tzais 1/10 day | Zmaniyos |
| `getShaahZmanis90MinutesZmanis()` | Alos 1/8 day | Tzais 1/8 day | Zmaniyos |
| `getShaahZmanis96MinutesZmanis()` | Alos 1/7.5 day | Tzais 1/7.5 day | Zmaniyos |
| `getShaahZmanis120MinutesZmanis()` | Alos 1/6 day | Tzais 1/6 day | Zmaniyos |
| `getShaahZmanisBaalHatanya()` | Alos 16.9° | Tzais 6° | Baal Hatanya |
| `getShaahZmanisAteretTorah()` | Alos | Tzais Ateret Torah | Ateret Torah |
| `getShaahZmanisAlos16Point1ToTzais7Point083()` | Alos 16.1° | Tzais 7.083° | Asymmetric |

---

## PART 10: COMMUNITY CUSTOMS

### Common Configurations by Community

#### Ashkenaz (Standard)
- **Alos:** 72 minutes or 16.1°
- **Tzais:** 72 minutes or 8.5°-9.3°
- **Shma/Tfila:** MGA or GRA
- **Mincha:** GRA
- **Plag:** GRA or 72 minutes

#### Sefard
- **Varies by community**
- Often use Geonim opinions for tzais
- Some use earlier tzais (18-30 minutes)

#### Chabad (Baal Hatanya)
- **Netz:** 1.583° (netz amiti)
- **Shkiah:** 1.583° (shkiah amiti)
- **Alos:** 16.9° (72 min before netz amiti)
- **Tzais:** 6° (24 min after shkiah amiti)
- **All zmanim:** Based on netz amiti/shkiah amiti

#### Israel (Common)
- **Tzais:** 6.45° (Rabbi Tucazinsky, 28-31 minutes)
- **Or:** Rabbeinu Tam (72 minutes)
- **Shma/Tfila:** Often MGA 16.1°

#### Jerusalem
- **Candle Lighting:** 40 minutes before sunset
- **Varies by community** for other zmanim

#### Yeshivish/Kollel
- **Often:** MGA calculations
- **Alos:** 72 minutes
- **Tzais:** 72 minutes or Rabbeinu Tam

#### Modern Orthodox
- **Often:** GRA calculations
- **Earlier zmanim** generally preferred

---

## PART 11: PRACTICAL USAGE NOTES

### Critical Configuration Settings

```java
// Elevation setting (affects sunrise/sunset based zmanim)
zmanimCalendar.setUseElevation(true); // or false

// Chatzos calculation method
zmanimCalendar.setUseAstronomicalChatzos(true); // or false

// Use astronomical chatzos for other zmanim
zmanimCalendar.setUseAstronomicalChatzosForOtherZmanim(true); // or false

// Candle lighting offset
zmanimCalendar.setCandleLightingOffset(40); // minutes

// Ateret Torah sunset offset
complexZmanimCalendar.setAteretTorahSunsetOffset(45); // minutes
```

### Null Handling
**All Date methods can return null:**
- Arctic/Antarctic regions where sun doesn't rise/set
- Invalid degree calculations
- Always check for null before using

### Method Naming Patterns
- **get[Zman]** - Basic calculation
- **get[Zman][Opinion]** - Specific opinion (GRA, MGA, etc.)
- **get[Zman][Number]Minutes** - Fixed time offset
- **get[Zman][Number]MinutesZmanis** - Proportional time
- **get[Zman][Number]Degrees** - Degree-based calculation
- **getShaahZmanis[Variant]** - Temporal hour calculator
- **getSofZman[Shma|Tfila]** - Latest time calculators

---

## PART 12: DEPRECATED METHODS

**Marked for removal in v3.0:**
- `ZENITH_3_POINT_65` - Calculation error
- `ZENITH_3_POINT_676` - Calculation error
- `getTzaisGeonim3Point65Degrees()` - Calculation error
- `getTzaisGeonim3Point676Degrees()` - Calculation error
- `getSunLowerTransit()` - Use `getSolarMidnight()` instead

---

## PART 13: COMPLETE METHOD INDEX

### By Category

#### ALOS (18 methods)
1. getAlos60
2. getAlos72
3. getAlos72Zmanis
4. getAlos90
5. getAlos90Zmanis
6. getAlos96
7. getAlos96Zmanis
8. getAlos120
9. getAlos120Zmanis
10. getAlosHashachar / getAlos16Point1Degrees
11. getAlos18Degrees
12. getAlos19Degrees
13. getAlos19Point8Degrees
14. getAlos26Degrees
15. getAlosBaalHatanya

#### MISHEYAKIR (5 methods)
16. getMisheyakir7Point65Degrees
17. getMisheyakir9Point5Degrees
18. getMisheyakir10Point2Degrees
19. getMisheyakir11Degrees
20. getMisheyakir11Point5Degrees

#### SOF ZMAN SHMA (42 methods)
21. getSofZmanShmaGRA
22. getSofZmanShmaMGA
23. getSofZmanShmaMGA16Point1Degrees
24. getSofZmanShmaMGA18Degrees
25. getSofZmanShmaMGA19Point8Degrees
26. getSofZmanShmaMGA72Minutes
27. getSofZmanShmaMGA72MinutesZmanis
28. getSofZmanShmaMGA90Minutes
29. getSofZmanShmaMGA90MinutesZmanis
30. getSofZmanShmaMGA96Minutes
31. getSofZmanShmaMGA96MinutesZmanis
32. getSofZmanShmaMGA120Minutes
33. getSofZmanShma3HoursBeforeChatzos
34. getSofZmanShmaAlos16Point1ToSunset
35. getSofZmanShmaAlos16Point1ToTzaisGeonim7Point083Degrees
36. getSofZmanShmaKolEliyahu
37. getSofZmanShmaAteretTorah
38. getSofZmanShmaBaalHatanya
39. getSofZmanShmaFixedLocal
40. getSofZmanShmaMGA18DegreesToFixedLocalChatzos
41. getSofZmanShmaMGA16Point1DegreesToFixedLocalChatzos
42. getSofZmanShmaMGA90MinutesToFixedLocalChatzos
43. getSofZmanShmaMGA72MinutesToFixedLocalChatzos
44. getSofZmanShmaGRASunriseToFixedLocalChatzos
45. getSofZmanShma(startOfDay, endOfDay) [generic]

#### SOF ZMAN TFILA (17 methods)
46. getSofZmanTfilaGRA
47. getSofZmanTfilaMGA
48. getSofZmanTfilaMGA16Point1Degrees
49. getSofZmanTfilaMGA18Degrees
50. getSofZmanTfilaMGA19Point8Degrees
51. getSofZmanTfilaMGA72Minutes
52. getSofZmanTfilaMGA72MinutesZmanis
53. getSofZmanTfilaMGA90Minutes
54. getSofZmanTfilaMGA90MinutesZmanis
55. getSofZmanTfilaMGA96Minutes
56. getSofZmanTfilaMGA96MinutesZmanis
57. getSofZmanTfilaMGA120Minutes
58. getSofZmanTfila2HoursBeforeChatzos
59. getSofZmanTfilaAteretTorah / getSofZmanTfilahAteretTorah
60. getSofZmanTfilaBaalHatanya
61. getSofZmanTfilaGRASunriseToFixedLocalChatzos
62. getSofZmanTfila(startOfDay, endOfDay) [generic]

#### CHATZOS (3 methods)
63. getChatzos
64. getChatzosAsHalfDay
65. getFixedLocalChatzos

#### MINCHA GEDOLA (9 methods)
66. getMinchaGedola [GRA]
67. getMinchaGedola30Minutes
68. getMinchaGedolaGreaterThan30
69. getMinchaGedola16Point1Degrees
70. getMinchaGedola72Minutes
71. getMinchaGedolaAhavatShalom
72. getMinchaGedolaAteretTorah
73. getMinchaGedolaBaalHatanya
74. getMinchaGedolaBaalHatanyaGreaterThan30
75. getMinchaGedolaGRAFixedLocalChatzos30Minutes
76. getMinchaGedola(startOfDay, endOfDay) [generic]

#### MINCHA KETANA (6 methods)
77. getMinchaKetana [GRA]
78. getMinchaKetana16Point1Degrees
79. getMinchaKetana72Minutes
80. getMinchaKetanaAhavatShalom
81. getMinchaKetanaAteretTorah
82. getMinchaKetanaBaalHatanya
83. getMinchaKetanaGRAFixedLocalChatzosToSunset
84. getMinchaKetana(startOfDay, endOfDay) [generic]

#### SAMUCH LEMINCHA KETANA (4 methods)
85. getSamuchLeMinchaKetanaGRA
86. getSamuchLeMinchaKetana16Point1Degrees
87. getSamuchLeMinchaKetana72Minutes
88. getSamuchLeMinchaKetana(startOfDay, endOfDay) [generic]

#### PLAG HAMINCHA (19 methods)
89. getPlagHamincha [GRA]
90. getPlagHamincha60Minutes
91. getPlagHamincha72Minutes
92. getPlagHamincha90Minutes
93. getPlagHamincha96Minutes
94. getPlagHamincha120Minutes
95. getPlagHamincha72MinutesZmanis
96. getPlagHamincha90MinutesZmanis
97. getPlagHamincha96MinutesZmanis
98. getPlagHamincha120MinutesZmanis
99. getPlagHamincha16Point1Degrees
100. getPlagHamincha18Degrees
101. getPlagHamincha19Point8Degrees
102. getPlagHamincha26Degrees
103. getPlagAlosToSunset
104. getPlagAlos16Point1ToTzaisGeonim7Point083Degrees
105. getPlagAhavatShalom
106. getPlagHaminchaAteretTorah
107. getPlagHaminchaBaalHatanya
108. getPlagHaminchaGRAFixedLocalChatzosToSunset
109. getPlagHamincha(startOfDay, endOfDay) [generic]

#### BAIN HASHMASHOS (14 methods)
110. getBainHashmashosRT13Point24Degrees / getBainHasmashosRT13Point24Degrees
111. getBainHashmashosRT58Point5Minutes / getBainHasmashosRT58Point5Minutes
112. getBainHashmashosRT13Point5MinutesBefore7Point083Degrees
113. getBainHashmashosRT2Stars / getBainHasmashosRT2Stars
114. getBainHashmashosYereim18Minutes / getBainHasmashosYereim18Minutes
115. getBainHashmashosYereim3Point05Degrees / getBainHasmashosYereim3Point05Degrees
116. getBainHashmashosYereim16Point875Minutes / getBainHasmashosYereim16Point875Minutes
117. getBainHashmashosYereim2Point8Degrees / getBainHasmashosYereim2Point8Degrees
118. getBainHashmashosYereim13Point5Minutes / getBainHasmashosYereim13Point5Minutes
119. getBainHashmashosYereim2Point1Degrees / getBainHasmashosYereim2Point1Degrees

#### TZAIS (35 methods)
120. getTzais [8.5°]
121. getTzais50
122. getTzais60
123. getTzais72
124. getTzais90
125. getTzais96
126. getTzais120
127. getTzais72Zmanis
128. getTzais90Zmanis
129. getTzais96Zmanis
130. getTzais120Zmanis
131. getTzais16Point1Degrees
132. getTzais18Degrees
133. getTzais19Point8Degrees
134. getTzais26Degrees
135. getTzaisGeonim3Point7Degrees
136. getTzaisGeonim3Point8Degrees
137. getTzaisGeonim3Point65Degrees [deprecated]
138. getTzaisGeonim3Point676Degrees [deprecated]
139. getTzaisGeonim4Point37Degrees
140. getTzaisGeonim4Point61Degrees
141. getTzaisGeonim4Point8Degrees
142. getTzaisGeonim5Point88Degrees
143. getTzaisGeonim5Point95Degrees
144. getTzaisGeonim6Point45Degrees
145. getTzaisGeonim7Point083Degrees
146. getTzaisGeonim7Point67Degrees
147. getTzaisGeonim8Point5Degrees
148. getTzaisGeonim9Point3Degrees
149. getTzaisGeonim9Point75Degrees
150. getTzaisAteretTorah
151. getTzaisBaalHatanya

#### SUNRISE/SUNSET (6 methods)
152. getSunrise
153. getSeaLevelSunrise
154. getSunset
155. getSeaLevelSunset
156. getSunriseBaalHatanya (netz amiti)
157. getSunsetBaalHatanya (shkiah amiti)

#### SPECIAL TIMES (11 methods)
158. getCandleLighting
159. getTchilasZmanKidushLevana3Days
160. getTchilasZmanKidushLevana7Days
161. getSofZmanKidushLevana15Days
162. getSofZmanKidushLevanaBetweenMoldos
163. getZmanMolad
164. getSofZmanAchilasChametzGRA
165. getSofZmanAchilasChametzMGA72Minutes
166. getSofZmanAchilasChametzMGA72MinutesZmanis
167. getSofZmanAchilasChametzMGA16Point1Degrees
168. getSofZmanAchilasChametzBaalHatanya
169. getSofZmanBiurChametzGRA
170. getSofZmanBiurChametzMGA72Minutes
171. getSofZmanBiurChametzMGA72MinutesZmanis
172. getSofZmanBiurChametzMGA16Point1Degrees
173. getSofZmanBiurChametzBaalHatanya

#### SHAOS ZMANIYOS (20+ methods)
174. getShaahZmanisGra
175. getShaahZmanisMGA
176. getShaahZmanis16Point1Degrees
177. getShaahZmanis18Degrees
178. getShaahZmanis19Point8Degrees
179. getShaahZmanis26Degrees
180. getShaahZmanis60Minutes
181. getShaahZmanis72Minutes
182. getShaahZmanis90Minutes
183. getShaahZmanis96Minutes
184. getShaahZmanis120Minutes
185. getShaahZmanis72MinutesZmanis
186. getShaahZmanis90MinutesZmanis
187. getShaahZmanis96MinutesZmanis
188. getShaahZmanis120MinutesZmanis
189. getShaahZmanisBaalHatanya
190. getShaahZmanisAteretTorah
191. getShaahZmanisAlos16Point1ToTzais7Point083
192. getHalfDayBasedShaahZmanis(start, end)

---

## SUMMARY STATISTICS

- **Total Public Date Methods:** 180+
- **Degree Constants:** 30+
- **Alos Variations:** 18
- **Tzais Variations:** 35
- **Sof Zman Shma Variations:** 42
- **Plag Hamincha Variations:** 19
- **Shaos Zmaniyos Methods:** 20+
- **Poskim Represented:** 15+
- **Calculation Types:** 7 major types

---

## SOURCES & REFERENCES

**Primary Source:**
- Sefer Yisroel Vehazmanim by Rabbi Yisrael Dovid Harfenes

**Other Major Sources:**
- Zmanim Kehilchasam (7th ed.) by Rabbi Dovid Yehuda Bursztyn
- Hazmanim Bahalacha by Rabbi Chaim Banish
- Birur Halacha by Rabbi Yechiel Avrahom Zilber
- Various responsa and halachic works

**Library Information:**
- **GitHub:** https://github.com/KosherJava/zmanim
- **Author:** Eliyahu Hershfeld
- **License:** LGPL 2.1
- **Language:** Java
- **First Release:** 2004
- **Current Version:** Actively maintained (2025)

---

**END OF EXTRACTION**
