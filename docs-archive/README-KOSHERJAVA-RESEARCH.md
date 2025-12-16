# KosherJava Zmanim Library - Comprehensive Research

> **Complete extraction of the KosherJava Zmanim library for master registry development**
>
> **Status:** COMPLETE ✓
> **Date:** December 21, 2025
> **Methods Documented:** 180+
> **Poskim Covered:** 15+

---

## What Is This?

This is a comprehensive extraction and analysis of the **KosherJava Zmanim library**, the most complete open-source implementation of Jewish prayer time calculations. This research documents every calculation method, formula, and halachic opinion for building a master zmanim registry.

---

## Documents Overview

| Document | Size | Purpose | Target Audience |
|----------|------|---------|-----------------|
| **[Complete Extraction](./kosherjava-zmanim-complete-extraction.md)** | 42 KB | Full reference | Researchers, Registry Builders |
| **[Formula Reference](./kosherjava-formulas-quick-reference.md)** | 20 KB | Math formulas | Developers, Validators |
| **[Research Summary](./kosherjava-research-summary.md)** | 14 KB | Executive overview | Stakeholders, PMs |
| **[Developer Guide](./kosherjava-developer-quick-lookup.md)** | 17 KB | Quick lookup | Developers, Integrators |
| **[Index](./kosherjava-research-index.md)** | 12 KB | Navigation | Everyone |

**Total:** ~105 KB of comprehensive documentation

---

## Quick Start

### "I want the full picture"
Read: [Complete Extraction](./kosherjava-zmanim-complete-extraction.md)

### "I need exact formulas"
Read: [Formula Reference](./kosherjava-formulas-quick-reference.md)

### "I'm coding right now"
Read: [Developer Guide](./kosherjava-developer-quick-lookup.md)

### "I need statistics"
Read: [Research Summary](./kosherjava-research-summary.md)

### "I'm lost"
Read: [Index](./kosherjava-research-index.md)

---

## Key Statistics

```
┌─────────────────────────────────────────┐
│  KosherJava Zmanim Library - By Numbers │
└─────────────────────────────────────────┘

Total Methods:          180+
Degree Constants:       30+
Calculation Types:      7
Poskim Represented:     15+

Method Breakdown:
  ├─ Alos (Dawn)              18
  ├─ Misheyakir                5
  ├─ Sof Zman Shma           42
  ├─ Sof Zman Tfila          17
  ├─ Chatzos                   3
  ├─ Mincha Gedola             9
  ├─ Mincha Ketana             6
  ├─ Plag Hamincha           19
  ├─ Bain Hashmashos         14
  ├─ Tzais                   35
  └─ Shaos Zmaniyos          20+

Major Opinions:
  ├─ GRA (Vilna Gaon)        15+
  ├─ MGA (Magen Avraham)     40+
  ├─ Baal Hatanya            10+
  ├─ Geonim                  15+
  └─ Others (RT, Yereim)     20+
```

---

## Visual Hierarchy

```
AstronomicalCalendar (Base)
├─ Basic astronomy
├─ Sunrise/sunset (90.833°)
├─ Civil/Nautical/Astronomical twilight
└─ Generic calculators
    │
    └─ ZmanimCalendar
        ├─ Alos (16.1°, 72 min)
        ├─ Sof Zman Shma (GRA, MGA)
        ├─ Sof Zman Tfila (GRA, MGA)
        ├─ Chatzos
        ├─ Mincha Gedola/Ketana
        ├─ Plag Hamincha
        ├─ Tzais (8.5°, 72 min)
        └─ Generic calculators
            │
            └─ ComplexZmanimCalendar
                ├─ 18 Alos variations
                ├─ 5 Misheyakir variations
                ├─ 42 Sof Zman Shma variations
                ├─ 17 Sof Zman Tfila variations
                ├─ 19 Plag Hamincha variations
                ├─ 35 Tzais variations
                ├─ Bain Hashmashos (14)
                ├─ Baal Hatanya (10+)
                ├─ Kiddush Levana (5)
                ├─ Chametz times (10)
                └─ 20+ Shaos Zmaniyos
```

---

## Calculation Type Flow

```
┌──────────────────────────────────────────────┐
│         How Zmanim Are Calculated            │
└──────────────────────────────────────────────┘

1. FIXED TIME
   sunrise - 72 minutes → alos
   sunset + 72 minutes → tzais
   ✓ Simple, consistent
   ✗ Doesn't adjust for latitude

2. DEGREE-BASED
   sun at 16.1° below horizon → alos
   sun at 8.5° below horizon → tzais
   ✓ Astronomically accurate
   ✓ Adjusts for latitude
   ✗ Complex calculation

3. PROPORTIONAL (ZMANIYOS)
   sunrise - (day_length / 10) → alos
   sunset + (day_length / 10) → tzais
   ✓ Adjusts for season
   ✗ Circular dependency

4. SHAOS ZMANIYOS (TEMPORAL HOURS)
   shaah = day_length / 12
   shma = start_of_day + (3 × shaah)
   ✓ Halachically precise
   ✓ Adjusts for season

5. HALF-DAY (CHATZOS-BASED)
   mincha_gedola = chatzos + (0.5 × afternoon_shaah)
   ✓ Symmetric calculations
   ✗ Only works for synchronous days

6. ASYMMETRIC
   day = alos(16.1°) to tzais(7.083°)
   ✓ Specific customs (Manchester)
   ✗ Chatzos not at solar transit

7. FIXED LOCAL CHATZOS
   chatzos at fixed clock time
   ✓ Consistent
   ✗ Not astronomically accurate
```

---

## Degree Reference Chart

```
Degrees Below Horizon → Time After Sunset (Jerusalem, Equinox)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 1.583° ┄┄┄┄┄┄┄┄┄┄ ~6 min    (Baal Hatanya netz/shkiah amiti)
 3.7°   ┄┄┄┄┄┄┄┄┄┄ 13.5 min  (Geonim - 3/4 of 18-min mil)
 4.61°  ┄┄┄┄┄┄┄┄┄┄ 18 min    (Geonim - 3/4 of 24-min mil)
 5.95°  ┄┄┄┄┄┄┄┄┄┄ 24 min    (Geonim - 1 mil)
 6°     ┄┄┄┄┄┄┄┄┄┄ 24 min    (Baal Hatanya tzais)
 6.45°  ┄┄┄┄┄┄┄┄┄┄ 28-31 min (R' Tucazinsky - Israel standard)
 7.083° ┄┄┄┄┄┄┄┄┄┄ 30 min    (Dr. Cohen - 3 medium stars)
 8.5°   ┄┄┄┄┄┄┄┄┄┄ 36 min    (Ohr Meir - 3 small stars)
 10.2°  ┄┄┄┄┄┄┄┄┄┄ 45 min    (Misheyakir)
 13.24° ┄┄┄┄┄┄┄┄┄┄ 58.5 min  (Rabbeinu Tam bain hashmashos)
 16.1°  ┄┄┄┄┄┄┄┄┄┄ 72 min    (Standard MGA/Rambam - 4 mil)
 16.9°  ┄┄┄┄┄┄┄┄┄┄ 72 min    (Baal Hatanya alos from netz amiti)
 18°    ┄┄┄┄┄┄┄┄┄┄ 76 min    (Astronomical twilight)
 19.8°  ┄┄┄┄┄┄┄┄┄┄ 90 min    (5 mil at 18 min/mil)
 26°    ┄┄┄┄┄┄┄┄┄┄ 120 min   (Lechumra only - very dark)
```

---

## Posek Quick Reference

```
┌────────────────────────────────────────────────┐
│  Rabbi/Posek → Their Calculation Method        │
└────────────────────────────────────────────────┘

GRA (Vilna Gaon)
  Day: sunrise → sunset
  Shaah: (sunset - sunrise) / 12
  Sof Zman Shma: sunrise + 3 shaos
  Use: Standard for basic calculations

MGA (Magen Avraham)
  Day: alos → tzais (multiple variants)
  Primary: 72 minutes (16.1°)
  Shaah: (tzais - alos) / 12
  Sof Zman Shma: alos + 3 shaos
  Use: Most common stringent opinion

Baal Hatanya (Shneur Zalman of Liadi)
  Netz Amiti: 1.583° (true sunrise)
  Shkiah Amiti: 1.583° (true sunset)
  Alos: 16.9° (72 min before netz amiti)
  Tzais: 6° (24 min after shkiah amiti)
  Use: Chabad community

Rabbeinu Tam
  Tzais: 72 minutes or 13.24°
  Bain Hashmashos: 58.5 minutes
  Use: Late nightfall opinion

Geonim
  Tzais: 3.7° to 9.75°
  Focus: Various mil-based calculations
  Use: Sefardi communities, Israel

Yereim (Rabbi Eliezer of Metz)
  Bain Hashmashos: BEFORE sunset
  13.5, 16.875, 18 minutes
  Use: Early twilight opinion
```

---

## Community Configurations

```
┌─────────────────────────────────────────────┐
│  Community → Recommended Configuration      │
└─────────────────────────────────────────────┘

ASHKENAZ (Standard)
  ├─ Alos: 72 min or 16.1°
  ├─ Sof Zman Shma: MGA 72 min
  ├─ Sof Zman Tfila: MGA 72 min
  └─ Tzais: 72 min or 8.5°-9.3°

CHABAD (Lubavitch)
  ├─ Netz: 1.583° (netz amiti)
  ├─ Alos: 16.9° (72 min before netz)
  ├─ Sof Zman Shma: Baal Hatanya
  ├─ Shkiah: 1.583° (shkiah amiti)
  └─ Tzais: 6° (24 min after shkiah)

ISRAEL (Common)
  ├─ Alos: Often 16.1°
  ├─ Sof Zman Shma: MGA 16.1°
  └─ Tzais: 6.45° (R' Tucazinsky)
       OR 72 min (Rabbeinu Tam)

JERUSALEM
  ├─ Candle Lighting: 40 minutes
  └─ Other zmanim: Community dependent

YESHIVISH/KOLLEL
  ├─ Day: MGA calculations
  ├─ Alos: 72 minutes
  ├─ Tzais: 72 minutes or RT
  └─ Generally stringent

MODERN ORTHODOX
  ├─ Day: GRA calculations
  ├─ Earlier zmanim preferred
  └─ Generally lenient
```

---

## Data Flow Example

```
User Request: "Latest Shma time for MGA 72 minutes"
│
├─ 1. Get Location & Date
│   └─ GeoLocation(lat, lon, tz)
│   └─ Calendar.set(year, month, day)
│
├─ 2. Calculate Day Boundaries
│   ├─ alos = sunrise - 72 min
│   └─ tzais = sunset + 72 min
│
├─ 3. Calculate Shaah Zmanis
│   └─ shaah = (tzais - alos) / 12
│
├─ 4. Calculate Sof Zman Shma
│   └─ szs = alos + (3 × shaah)
│
└─ 5. Return Result
    └─ Date object with time
```

---

## Formula Examples

### Simple: Alos 72 Minutes
```
Input:  sunrise = 6:30 AM
Output: alos = 6:30 - 72 min = 5:18 AM
```

### Degree-Based: Alos 16.1°
```
Input:  location, date
Step 1: Calculate when sun is 16.1° below horizon
Step 2: Account for refraction, location
Output: alos = 5:15 AM (varies by location/season)
```

### Shaos Zmaniyos: Sof Zman Shma GRA
```
Input:  sunrise = 6:30 AM, sunset = 6:00 PM
Step 1: day_length = 6:00 PM - 6:30 AM = 11.5 hours
Step 2: shaah = 11.5 / 12 = 0.958 hours = 57.5 min
Step 3: szs = 6:30 AM + (3 × 57.5 min) = 9:22:30 AM
Output: 9:22:30 AM
```

---

## Integration Checklist

### Phase 1: Core Implementation
- [ ] Import basic sunrise/sunset
- [ ] Import alos (16.1°, 72 min)
- [ ] Import tzais (8.5°, 72 min)
- [ ] Import sof zman shma (GRA, MGA 72)
- [ ] Import sof zman tfila (GRA, MGA 72)
- [ ] Import chatzos
- [ ] Import mincha gedola/ketana
- [ ] Import plag hamincha

### Phase 2: Common Variations
- [ ] Import MGA 16.1°
- [ ] Import MGA 90 minutes
- [ ] Import Geonim tzais (7.083°, 6.45°)
- [ ] Import Baal Hatanya (all methods)
- [ ] Import Rabbeinu Tam

### Phase 3: Special Calculations
- [ ] Import Kiddush Levana
- [ ] Import chametz times
- [ ] Import misheyakir
- [ ] Import bain hashmashos

### Phase 4: Generic Calculators
- [ ] Implement shaos zmaniyos calculator
- [ ] Implement degree-based calculator
- [ ] Implement custom day calculator

### Phase 5: Validation
- [ ] Compare with Hebcal
- [ ] Compare with MyZmanim
- [ ] Compare with community calendars
- [ ] Test edge cases

---

## Source Information

**Repository:** https://github.com/KosherJava/zmanim
**Author:** Eliyahu Hershfeld
**License:** LGPL 2.1
**Language:** Java
**First Release:** 2004
**Status:** Actively maintained (2025)

**Main Classes:**
- `AstronomicalCalendar.java` - 1,142 lines
- `ZmanimCalendar.java` - 1,234 lines
- `ComplexZmanimCalendar.java` - 4,597 lines
- **Total:** ~7,000 lines of zmanim calculations

---

## Documentation Navigation

```
START HERE
    │
    ├─── Need overview? ─────→ Research Summary
    ├─── Need formulas? ─────→ Formula Reference
    ├─── Need code help? ────→ Developer Guide
    ├─── Need everything? ───→ Complete Extraction
    └─── Lost? ──────────────→ Index
```

---

## Research Methodology

This comprehensive extraction was conducted through:

1. **Complete source code review** of all calculation classes
2. **JavaDoc extraction** for halachic sources and explanations
3. **Constant cataloging** of all 30+ degree values
4. **Method signature analysis** of all 180+ methods
5. **Formula decomposition** into readable mathematical expressions
6. **Pattern identification** across calculation types
7. **Cross-referencing** with mentioned halachic sources
8. **Community usage analysis** based on code comments

**Tools:**
- Manual code reading and analysis
- grep/awk for systematic extraction
- Pattern matching for categorization
- Cross-referencing with library documentation

---

## Updates

**Version:** 1.0
**Date:** December 21, 2025
**Status:** Complete

**Future updates will include:**
- New methods from library updates
- Community feedback integration
- Additional halachic source citations
- Enhanced cross-referencing

---

## Acknowledgments

**Primary Source:**
- KosherJava Zmanim library by Eliyahu Hershfeld

**Halachic Sources (as referenced in library code):**
- Sefer Yisroel Vehazmanim (Rabbi Yisrael Dovid Harfenes)
- Zmanim Kehilchasam (Rabbi Dovid Yehuda Bursztyn)
- Hazmanim Bahalacha (Rabbi Chaim Banish)
- Birur Halacha (Rabbi Yechiel Avrahom Zilber)

---

## Contact

**For Library Questions:**
- GitHub: https://github.com/KosherJava/zmanim
- Issues: https://github.com/KosherJava/zmanim/issues

**For Halachic Questions:**
- Consult your local Orthodox Rabbi
- This is a technical reference, not halachic guidance

---

## License

This research documentation is derived from the KosherJava Zmanim library (LGPL 2.1).
The documentation itself is provided as-is for educational and development purposes.

The original library: Copyright (C) 2004-2025 Eliyahu Hershfeld

---

**Happy Coding! May your zmanim calculations be accurate and your code bug-free!**

---

## Quick Links

| Document | Purpose | Link |
|----------|---------|------|
| Complete Reference | Everything | [kosherjava-zmanim-complete-extraction.md](./kosherjava-zmanim-complete-extraction.md) |
| Formulas | Math reference | [kosherjava-formulas-quick-reference.md](./kosherjava-formulas-quick-reference.md) |
| Summary | Overview | [kosherjava-research-summary.md](./kosherjava-research-summary.md) |
| Developer Guide | Code help | [kosherjava-developer-quick-lookup.md](./kosherjava-developer-quick-lookup.md) |
| Index | Navigation | [kosherjava-research-index.md](./kosherjava-research-index.md) |
