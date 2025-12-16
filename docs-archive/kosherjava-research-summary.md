# KosherJava Zmanim Library - Research Summary

**Date:** December 21, 2025
**Repository:** https://github.com/KosherJava/zmanim
**Purpose:** Comprehensive extraction for master zmanim registry

---

## Documents Generated

This research has produced three comprehensive documents:

### 1. Complete Extraction (`kosherjava-zmanim-complete-extraction.md`)
**73,000+ words | Comprehensive catalog**

Complete documentation including:
- All 180+ zman calculation methods
- 30+ degree constants with explanations
- Detailed categorization by zman type
- Halachic opinions and shitos
- Implementation patterns
- Community customs
- Complete method index

### 2. Formula Quick Reference (`kosherjava-formulas-quick-reference.md`)
**10,000+ words | Quick lookup**

Exact formulas for every method:
- Mathematical formulas in readable format
- Table-based organization by category
- Start/end definitions for each calculation
- Calculation helper methods
- Zmaniyos fraction reference

### 3. This Summary (`kosherjava-research-summary.md`)
**Overview and key statistics**

---

## Key Statistics

| Metric | Count |
|--------|-------|
| **Total Methods** | 180+ |
| **Degree Constants** | 30+ |
| **Alos Variations** | 18 |
| **Misheyakir Variations** | 5 |
| **Sof Zman Shma** | 42 |
| **Sof Zman Tfila** | 17 |
| **Mincha Gedola** | 9 |
| **Mincha Ketana** | 6 |
| **Plag Hamincha** | 19 |
| **Bain Hashmashos** | 14 |
| **Tzais Variations** | 35 |
| **Shaos Zmaniyos** | 20+ |
| **Poskim Represented** | 15+ |

---

## Core Constants

### Base Zeniths
```java
GEOMETRIC_ZENITH = 90°         // Base for all calculations
CIVIL_ZENITH = 96°             // Civil twilight
NAUTICAL_ZENITH = 102°         // Nautical twilight
ASTRONOMICAL_ZENITH = 108°     // Astronomical twilight
```

### Key Degree Values (subset)
```
1.583°  - Baal Hatanya netz/shkiah amiti
7.083°  - 3 medium stars (Dr. Cohen)
8.5°    - 3 small stars (Ohr Meir)
16.1°   - Standard 72-minute alos/tzais
19.8°   - 90-minute alos/tzais
```

### Time Constants
```java
MINUTE_MILLIS = 60,000          // 1 minute
HOUR_MILLIS = 3,600,000         // 1 hour
```

---

## Major Halachic Opinions

### GRA (Vilna Gaon)
- **Day:** Sunrise to sunset
- **Standard for:** Most basic calculations
- **Methods:** 6+ dedicated methods

### MGA (Magen Avraham)
- **Day:** Alos to tzais (multiple variations)
- **Primary:** 72 minutes (16.1°)
- **Variations:** 60, 90, 96, 120 min (fixed & zmaniyos)
- **Methods:** 40+ variations

### Baal Hatanya (Shneur Zalman of Liadi)
- **Unique:** Uses netz amiti (1.583°) not standard sunrise
- **Alos:** 16.9° (72 min before netz amiti)
- **Tzais:** 6° (24 min after shkiah amiti)
- **Methods:** 10+ dedicated methods

### Rabbeinu Tam
- **Tzais:** 72 minutes or 13.24° after sunset
- **Bain Hashmashos:** 58.5 minutes
- **Methods:** 4 variations

### Geonim
- **Focus:** Tzais calculations
- **Range:** 13.5 to 39 minutes
- **Methods:** 15+ variations (3.7° to 9.75°)

### Others
- **Yereim:** Bain hashmashos before sunset
- **Ateret Torah:** Configurable tzais
- **Kol Eliyahu:** Specific shma calculation
- **Ahavat Shalom:** Mincha variations

---

## Calculation Types

### 1. Fixed Time Offset (Simplest)
```
alos = sunrise - 72 minutes
tzais = sunset + 72 minutes
```

### 2. Degree-Based (Most Accurate)
```
alos = when sun reaches 16.1° below horizon
tzais = when sun reaches 8.5° below horizon
```

### 3. Proportional (Zmaniyos)
```
alos72Zmanis = sunrise - (day_length / 10)
tzais72Zmanis = sunset + (day_length / 10)
```

### 4. Shaos Zmaniyos (Temporal Hours)
```
shaah_zmanis = day_length / 12
sof_zman_shma = start_of_day + (3 × shaah_zmanis)
plag_hamincha = start_of_day + (10.75 × shaah_zmanis)
```

### 5. Half-Day Based (Chatzos-Centric)
```
mincha_gedola = chatzos + (0.5 × afternoon_shaah_zmanis)
plag_hamincha = chatzos + (4.75 × afternoon_shaah_zmanis)
```

### 6. Asymmetric Days
```
Day: alos 16.1° to tzais 7.083° (Manchester calendar)
Day: alos 16.1° to sunset (some opinions)
```

---

## Zmanim Categories

### Dawn (Alos) - 18 Methods
**Purpose:** Earliest time for morning prayers, tallis, tefillin
**Range:** 120 minutes to ~35 minutes before sunrise

**Variations:**
- Time-based: 60, 72, 90, 96, 120 minutes
- Zmaniyos: 1/10, 1/8, 1/7.5, 1/6 of day
- Degrees: 16.1°, 18°, 19°, 19.8°, 26° (+ Baal Hatanya 16.9°)

### Misheyakir - 5 Methods
**Purpose:** When one can distinguish blue from white (tallis/tefillin)
**Range:** 52 to 35 minutes before sunrise
**All degree-based:** 11.5°, 11°, 10.2°, 9.5°, 7.65°

### Latest Shma - 42 Methods
**Purpose:** Deadline for reciting morning Shma
**Formula:** start_of_day + (3 × shaah_zmanis)
**Variations:** Different day definitions (GRA, MGA variants, special calculations)

### Latest Tfila - 17 Methods
**Purpose:** Deadline for Shacharit (morning prayer)
**Formula:** start_of_day + (4 × shaah_zmanis)
**Variations:** Different day definitions

### Chatzos - 3 Methods
**Purpose:** Halachic noon
**Types:** Solar transit, half-day, fixed local

### Mincha Gedola - 9 Methods
**Purpose:** Earliest mincha
**Formula:** 6.5 shaos OR chatzos + 0.5 shaos
**Minimum:** 30 minutes after chatzos (some opinions)

### Mincha Ketana - 6 Methods
**Purpose:** Preferred mincha time
**Formula:** 9.5 shaos OR chatzos + 3.5 shaos

### Plag Hamincha - 19 Methods
**Purpose:** Earliest Shabbat acceptance
**Formula:** 10.75 shaos OR chatzos + 4.75 shaos
**Most variations:** Due to different day definitions

### Bain Hashmashos - 14 Methods
**Purpose:** Twilight (uncertain day/night)
**Rabbeinu Tam:** After sunset
**Yereim:** Before sunset

### Tzais - 35 Methods
**Purpose:** End of day / nightfall
**Range:** 13.5 to 120 minutes
**Most variations:** Due to multiple Geonim opinions + other poskim

---

## Class Structure

```
AstronomicalCalendar (base)
│   - 13 methods
│   - Basic astronomy (sunrise, sunset, twilight)
│   - Generic calculation helpers
│
└── ZmanimCalendar
    │   - 27 methods
    │   - Core Jewish times (GRA, MGA standard)
    │   - Generic calculators
    │
    └── ComplexZmanimCalendar
        - 165 methods
        - All variations and opinions
        - Special calculations
```

---

## Important Patterns

### Method Naming
```
get[Zman]                     - Basic (usually GRA)
get[Zman]GRA                  - GRA opinion
get[Zman]MGA                  - MGA opinion
get[Zman][N]Minutes           - Fixed time
get[Zman][N]MinutesZmanis     - Proportional time
get[Zman][N]Degrees           - Degree-based
get[Zman][N]Point[M]Degrees   - Decimal degrees
get[Zman]BaalHatanya          - Baal Hatanya
getShaahZmanis[Variant]       - Temporal hour calculator
```

### Generic Calculators
```java
// Any shaos-based zman
getShaahZmanisBasedZman(startOfDay, endOfDay, hours)

// Half-day calculations
getHalfDayBasedZman(startOfHalf, endOfHalf, hours)

// Any degree offset
getSunriseOffsetByDegrees(zenith)
getSunsetOffsetByDegrees(zenith)

// Temporal hour
getTemporalHour(startOfDay, endOfDay)
```

---

## Critical Configuration

```java
// Elevation (affects sunrise/sunset)
setUseElevation(true/false)

// Chatzos method
setUseAstronomicalChatzos(true/false)

// Use astronomical chatzos for other zmanim
setUseAstronomicalChatzosForOtherZmanim(true/false)

// Candle lighting offset
setCandleLightingOffset(minutes)

// Ateret Torah sunset offset
setAteretTorahSunsetOffset(minutes)
```

---

## Common Configurations

### Ashkenaz Standard
```
Alos: 72 min or 16.1°
Tzais: 72 min or 8.5°-9.3°
Shma/Tfila: MGA or GRA
```

### Chabad (Baal Hatanya)
```
Netz: 1.583° (netz amiti)
Alos: 16.9° (72 min before netz amiti)
Tzais: 6° (24 min after shkiah amiti)
All zmanim: Based on netz amiti
```

### Israel Common
```
Tzais: 6.45° (Rabbi Tucazinsky, 28-31 min)
Or: Rabbeinu Tam (72 min)
Shma/Tfila: Often MGA 16.1°
```

### Jerusalem
```
Candle Lighting: 40 minutes
Other zmanim: Varies by community
```

---

## Special Features

### Kiddush Levana (Moon Sanctification)
- Earliest: 3 days or 7 days after molad
- Latest: 15 days or halfway between molads

### Pesach (Chametz)
- Latest eating: 5 shaos zmaniyos
- Latest burning: 6 shaos zmaniyos
- Available for GRA, MGA variants, Baal Hatanya

### Fast Days
- Uses sof zman achila (eating) calculations

---

## Implementation Notes

### Null Safety
- All Date methods can return null
- Occurs in Arctic/Antarctic regions
- Occurs when sun doesn't reach required degrees
- Always null-check before using

### Synchronous vs Asymmetric
- **Synchronous:** Same offset for start/end (e.g., both 72 min)
- **Asymmetric:** Different offsets (e.g., alos 16.1°, tzais 7.083°)
- Affects whether chatzos-based calculations can be used

### Elevation Impact
- `setUseElevation(true)`: Earlier sunrise, later sunset
- `setUseElevation(false)`: Sea-level calculations
- Only affects sunrise/sunset, not degree calculations

---

## Source Material

**Primary Reference:**
- Sefer Yisroel Vehazmanim by Rabbi Yisrael Dovid Harfenes

**Additional Sources:**
- Zmanim Kehilchasam by Rabbi Dovid Yehuda Bursztyn
- Hazmanim Bahalacha by Rabbi Chaim Banish
- Birur Halacha by Rabbi Yechiel Avrahom Zilber
- Various responsa and halachic works

---

## Library Information

**Repository:** https://github.com/KosherJava/zmanim
**Author:** Eliyahu Hershfeld
**License:** LGPL 2.1
**Language:** Java
**First Release:** 2004
**Current Status:** Actively maintained (2025)
**File Count:** 20+ Java files
**Lines of Code:** 10,000+ (zmanim classes only)

---

## Files in Repository

### Core Classes
- `AstronomicalCalendar.java` - Base astronomy (1,142 lines)
- `ZmanimCalendar.java` - Core Jewish times (1,234 lines)
- `ComplexZmanimCalendar.java` - Extended variations (4,597 lines)

### Helper Classes
- `GeoLocation.java` - Location data
- `AstronomicalCalculator.java` - Calculation engine interface
- `NOAACalculator.java` - NOAA algorithm implementation
- `SunTimesCalculator.java` - Alternative algorithm

### Hebrew Calendar
- `JewishCalendar.java` - Hebrew date calculations
- `JewishDate.java` - Hebrew date representation
- `HebrewDateFormatter.java` - Hebrew formatting
- `TefilaRules.java` - Prayer rules

### Utilities
- `ZmanimFormatter.java` - Time formatting
- `GeoLocationUtils.java` - Location utilities
- `Zman.java` - Zman wrapper class

---

## Usage Examples

### Basic Sunrise/Sunset
```java
String locationName = "Lakewood, NJ";
double latitude = 40.0828;
double longitude = -74.2094;
TimeZone timeZone = TimeZone.getTimeZone("America/New_York");
GeoLocation location = new GeoLocation(locationName, latitude, longitude, timeZone);
ZmanimCalendar zc = new ZmanimCalendar(location);

Date sunrise = zc.getSunrise();
Date sunset = zc.getSunset();
```

### Sof Zman Shma (GRA)
```java
Date sofZmanShmaGRA = zc.getSofZmanShmaGRA();
```

### Sof Zman Shma (MGA 72 minutes)
```java
ComplexZmanimCalendar czc = new ComplexZmanimCalendar(location);
Date sofZmanShmaMGA = czc.getSofZmanShmaMGA72Minutes();
```

### Custom Calculation (Manchester Calendar)
```java
// Plag: alos 12° to tzais 7.083°
Date alos = czc.getSunriseOffsetByDegrees(GEOMETRIC_ZENITH + 12);
Date tzais = czc.getSunsetOffsetByDegrees(GEOMETRIC_ZENITH + 7.083);
Date plag = czc.getPlagHamincha(alos, tzais);
```

### Baal Hatanya
```java
Date alosBH = czc.getAlosBaalHatanya();
Date netzAmiti = czc.getSunriseBaalHatanya();
Date sofZmanShmaBH = czc.getSofZmanShmaBaalHatanya();
Date tzaisBH = czc.getTzaisBaalHatanya();
```

---

## Master Registry Mapping Recommendations

### Priority 1: Core Methods (Must Have)
1. `getSunrise()` / `getSunset()`
2. `getAlosHashachar()` (16.1°)
3. `getTzais()` (8.5°)
4. `getSofZmanShmaGRA()`
5. `getSofZmanShmaMGA()`
6. `getSofZmanTfilaGRA()`
7. `getSofZmanTfilaMGA()`
8. `getChatzos()`
9. `getMinchaGedola()`
10. `getMinchaKetana()`
11. `getPlagHamincha()`

### Priority 2: Common Variations (Should Have)
1. Degree-based alos: 18°, 19.8°
2. Time-based alos: 60, 90, 120 min
3. Geonim tzais: 3.7°, 7.083°, 6.45° (Israel)
4. MGA variations: 16.1°, 72 min, 90 min
5. Baal Hatanya: All methods

### Priority 3: Special Calculations (Nice to Have)
1. Rabbeinu Tam methods
2. Yereim methods
3. Ateret Torah
4. Kiddush Levana
5. Chametz times
6. Fixed local chatzos

### Generic Calculators (Essential for Flexibility)
1. `getShaahZmanisBasedZman(start, end, hours)`
2. `getHalfDayBasedZman(start, end, hours)`
3. `getSunriseOffsetByDegrees(zenith)`
4. `getSunsetOffsetByDegrees(zenith)`

---

## Next Steps for Integration

### 1. Database Schema
- Create `poskim` table (GRA, MGA, Baal Hatanya, etc.)
- Create `calculation_types` table (fixed_time, degrees, zmaniyos, shaos)
- Create `day_definitions` table (sunrise-sunset, alos-tzais variants)
- Link zmanim to calculation formulas

### 2. Formula Storage
Store as structured JSON:
```json
{
  "type": "shaos_zmaniyos",
  "start_of_day": {"type": "sunrise"},
  "end_of_day": {"type": "sunset"},
  "hours": 3
}
```

### 3. Degree Constants
Import all 30+ degree values as reference data

### 4. Opinion Mapping
Map each method to:
- Primary posek
- Source (if known)
- Common usage (location/community)

### 5. Validation
Cross-reference with other implementations:
- Hebcal (JavaScript)
- MyZmanim (iOS)
- Chabad.org
- OU.org

---

## Conclusion

The KosherJava Zmanim library is the most comprehensive open-source implementation of Jewish time calculations. With 180+ methods covering dozens of halachic opinions, it provides:

- **Completeness:** Every major opinion represented
- **Flexibility:** Generic calculators for custom opinions
- **Accuracy:** Multiple astronomical calculation engines
- **Reliability:** 20+ years of development and testing
- **Extensibility:** Clean object-oriented design

This research provides a complete mapping suitable for building a master zmanim registry that can serve as a reference for any Jewish calendar application.

---

**Research Completed:** December 21, 2025
**Documents:** 3 (Complete Extraction, Formula Reference, Summary)
**Total Words:** 85,000+
**Methods Documented:** 180+
**Poskim Covered:** 15+
