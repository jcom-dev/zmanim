# The Complete Guide to Zmanim Formulas

**A Plain-Language Guide to Writing Zmanim Calculation Formulas**

---

## Welcome

This guide teaches you how to write formulas that calculate zmanim using the Shtetl Zmanim DSL. Whether you're a Halachic Authority defining calculations for your community, a developer building zmanim features, or simply curious about how these calculations work, this guide will give you a complete understanding.

No programming experience is required. We'll start from the very basics and build up to advanced formulas step by step.

### DSL Feature Overview

The Zmanim DSL provides:
- **14 Primitives**: Core astronomical events (visible/geometric sunrise and sunset, solar noon/midnight, twilight stages)
- **8 Functions**: solar(), seasonal_solar(), proportional_hours(), proportional_minutes(), midpoint(), first_valid(), earlier_of(), later_of()
- **17 Bases**: Day boundary definitions (gra, mga variants, baal_hatanya, ateret_torah, custom)
- **13 Directions**: Time-of-day specifiers for solar calculations
- **8 Condition Variables**: For location and date-based conditional logic (latitude, longitude, day_length, month, day, day_of_year, date, season)
- **Conditionals**: Full if/else support for handling edge cases

---

## Table of Contents

1. [What is a Zmanim Formula?](#1-what-is-a-zmanim-formula)
2. [The Building Blocks: Primitives](#2-the-building-blocks-primitives)
3. [Adding and Subtracting Time](#3-adding-and-subtracting-time)
4. [Solar Angles: The Heart of Zmanim](#4-solar-angles-the-heart-of-zmanim)
5. [Proportional Hours (Shaos Zmaniyos)](#5-proportional-hours-shaos-zmaniyos)
6. [Finding the Middle: The Midpoint Function](#6-finding-the-middle-the-midpoint-function)
7. [Referencing Other Zmanim](#7-referencing-other-zmanim)
8. [Handling Special Cases with Conditions](#8-handling-special-cases-with-conditions)
9. [Choosing Between Times](#9-choosing-between-times)
10. [The Seasonal Solar Method](#10-the-seasonal-solar-method)
11. [Comments: Explaining Your Formulas](#11-comments-explaining-your-formulas)
12. [Complete Formula Examples](#12-complete-formula-examples)
13. [Common Zmanim Reference](#13-common-zmanim-reference)
14. [Quick Reference Card](#14-quick-reference-card)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. What is a Zmanim Formula?

A **formula** is a set of instructions that tells the computer how to calculate a specific prayer time. Think of it like a recipe: you provide the ingredients (the location and date), and the formula tells you what to do with them to get the result (the time).

### A Simple Example

```
visible_sunset - 18min
```

This formula says: "Take visible sunset, then subtract 18 minutes." This gives you **candle lighting time** for Shabbos in many communities.

### Why Do We Need Formulas?

Different rabbinical authorities have different opinions about how to calculate zmanim. Some use fixed time offsets (like "18 minutes before visible sunset"), while others use astronomical calculations (like "when the sun is 16.1 degrees below the horizon"). Formulas let each community define their calculations according to their tradition.

---

## 2. The Building Blocks: Primitives

**Primitives** are the basic astronomical events that the system calculates automatically. They're the foundation upon which all other calculations are built.

### The Core Four

These are the most commonly used primitives:

| Primitive | What It Means | Typical Use |
|-----------|---------------|-------------|
| `visible_sunrise` | When you first see the sun appear (accounts for atmospheric refraction) | Start of the halachic day (GRA opinion) |
| `visible_sunset` | When the sun completely disappears from view (accounts for atmospheric refraction) | End of the halachic day, start of Shabbos |
| `solar_noon` | The exact middle of the day when the sun is highest | Chatzos (halachic midday) |
| `solar_midnight` | The exact middle of the night when the sun is lowest | Chatzos HaLaylah (midnight) |

**Note:** For convenience, `sunrise` is an alias for `visible_sunrise` and `sunset` is an alias for `visible_sunset`. This guide uses the explicit forms for clarity.

### Twilight Primitives

These represent different stages of twilight, defined by how far the sun is below the horizon:

| Primitive | Sun Position | What It Means |
|-----------|--------------|---------------|
| `civil_dawn` | 6 degrees below | Enough light to see without artificial light |
| `civil_dusk` | 6 degrees below | Last usable daylight |
| `nautical_dawn` | 12 degrees below | Horizon visible at sea |
| `nautical_dusk` | 12 degrees below | Horizon no longer visible |
| `astronomical_dawn` | 18 degrees below | Complete darkness ends |
| `astronomical_dusk` | 18 degrees below | Complete darkness begins |

### Visible vs Geometric Sunrise and Sunset

The system provides two types of sunrise/sunset calculations:

| Primitive | What It Means |
|-----------|---------------|
| `visible_sunrise` | When you first see the sun appear (accounts for atmospheric refraction) |
| `visible_sunset` | When the sun completely disappears from view (accounts for atmospheric refraction) |
| `geometric_sunrise` | Pure geometric calculation when sun's center crosses horizon (no refraction) |
| `geometric_sunset` | Pure geometric calculation when sun's center crosses horizon (no refraction) |

**When to use which:**
- **Visible** (default): Standard halachic calculations accounting for atmospheric refraction (about 34 arc-minutes)
- **Geometric**: For calculations requiring pure geometric positions without atmospheric effects

### Using Primitives

Primitives can be used on their own or as part of larger formulas:

```
visible_sunrise            // Simply returns the visible sunrise time
visible_sunset             // Simply returns the visible sunset time
solar_noon                 // Returns chatzos
```

---

## 3. Adding and Subtracting Time

The most straightforward way to create a zman is to start with a primitive and add or subtract time.

### Writing Durations

Durations (amounts of time) can be written in several ways:

| Format | Example | Meaning |
|--------|---------|---------|
| Minutes | `18min` | 18 minutes |
| Hours | `1hr` or `1h` | 1 hour |
| Combined | `1h 30min` | 1 hour and 30 minutes |

### Subtracting Time (Before an Event)

When a zman occurs **before** another time, use subtraction (`-`):

```
visible_sunset - 18min       // 18 minutes before visible sunset (candle lighting)
visible_sunset - 40min       // 40 minutes before visible sunset (Jerusalem candle lighting)
visible_sunrise - 72min      // 72 minutes before visible sunrise (Alos - MGA opinion)
visible_sunrise - 90min      // 90 minutes before visible sunrise (more stringent Alos)
```

### Adding Time (After an Event)

When a zman occurs **after** another time, use addition (`+`):

```
visible_sunset + 72min       // 72 minutes after visible sunset (Rabbeinu Tam nightfall)
visible_sunset + 42min       // 42 minutes after visible sunset (standard Tzeis)
solar_noon + 30min           // 30 minutes after midday (Mincha Gedola - simple)
```

### Combining Multiple Operations

You can chain multiple additions and subtractions:

```
visible_sunrise - 1h 12min   // Same as visible_sunrise - 72min
visible_sunset + 1h 30min    // 90 minutes after visible sunset
```

### Common Offset-Based Zmanim

| Zman | Formula | Explanation |
|------|---------|-------------|
| Candle Lighting (Standard) | `visible_sunset - 18min` | 18 minutes before visible sunset |
| Candle Lighting (Jerusalem) | `visible_sunset - 40min` | 40 minutes before visible sunset |
| Alos (MGA 72) | `visible_sunrise - 72min` | 72 minutes before visible sunrise |
| Alos (90 minutes) | `visible_sunrise - 90min` | 90 minutes before visible sunrise |
| Alos (120 minutes) | `visible_sunrise - 120min` | Very stringent, 2 hours before visible sunrise |
| Tzeis Rabbeinu Tam | `visible_sunset + 72min` | 72 minutes after visible sunset |
| Mincha Gedola (Simple) | `solar_noon + 30min` | Half hour after midday |

---

## 4. Solar Angles: The Heart of Zmanim

Many zmanim are based on the sun's position relative to the horizon, measured in **degrees**. This is more astronomically accurate than fixed time offsets because it adjusts automatically for location and season.

### Understanding Solar Angles

Imagine you're standing outside watching the visible sunrise. Before the sun appears, it's below the horizon. We measure how far below using degrees:

- **0 degrees**: The sun is exactly at the horizon
- **6 degrees below**: Civil twilight (you can still see clearly)
- **12 degrees below**: Nautical twilight (getting quite dark)
- **18 degrees below**: Astronomical twilight (essentially night)

### The `solar()` Function

The `solar()` function calculates the time when the sun is at a specific angle:

```
solar(degrees, direction)
```

Where:
- `degrees` is a number between 0 and 90
- `direction` tells us which time of day we want

### Solar Directions

The `solar()` function accepts various direction parameters to specify which time of day you want to calculate. There are 13 directions available:

**Short aliases (most common):**
| Direction | Meaning | Used For |
|-----------|---------|----------|
| `before_sunrise` | Alias for `before_visible_sunrise` | Alos, Misheyakir |
| `after_sunrise` | Alias for `after_visible_sunrise` | Morning calculations |
| `after_sunset` | Alias for `after_visible_sunset` | Tzeis, nightfall |

**Visible sunrise/sunset variants:**
| Direction | Meaning |
|-----------|---------|
| `before_visible_sunrise` | Morning, before visible sunrise (with refraction) |
| `after_visible_sunrise` | Morning, after visible sunrise (with refraction) |
| `before_visible_sunset` | Evening, before visible sunset (with refraction) |
| `after_visible_sunset` | Evening, after visible sunset (with refraction) |

**Geometric sunrise/sunset variants:**
| Direction | Meaning |
|-----------|---------|
| `before_geometric_sunrise` | Morning, before geometric sunrise (no refraction) |
| `after_geometric_sunrise` | Morning, after geometric sunrise (no refraction) |
| `before_geometric_sunset` | Evening, before geometric sunset (no refraction) |
| `after_geometric_sunset` | Evening, after geometric sunset (no refraction) |

**Noon-based directions:**
| Direction | Meaning | Used For |
|-----------|---------|----------|
| `before_noon` | Morning, sun ascending toward noon | Less common |
| `after_noon` | Afternoon, sun descending from noon | Less common |

### Common Solar Angle Examples

#### Dawn (Alos HaShachar)

```
solar(16.1, before_sunrise)    // Standard Alos (72-minute equivalent)
solar(18, before_sunrise)      // Astronomical dawn
solar(19.8, before_sunrise)    // 90-minute equivalent
solar(26, before_sunrise)      // 120-minute equivalent (very stringent)
```

#### Misheyakir (Earliest Tallis and Tefillin)

```
solar(11.5, before_sunrise)    // Standard Misheyakir
solar(11, before_sunrise)      // Slightly earlier
solar(10.2, before_sunrise)    // Rabbi Heineman's opinion
solar(9.5, before_sunrise)     // Very early (Baltimore)
```

#### Nightfall (Tzeis HaKochavim)

```
solar(8.5, after_sunset)       // Standard Tzeis (3 small stars visible)
solar(7.083, after_sunset)     // 3 medium stars visible
solar(5.95, after_sunset)      // Yereim's opinion
solar(3.8, after_sunset)       // Chasam Sofer (very early)
solar(9.3, after_sunset)       // More stringent
solar(16.1, after_sunset)      // Rabbeinu Tam (degrees method)
```

### Why 16.1 Degrees?

The number 16.1 is significant because it corresponds to 72 minutes before visible sunrise in Jerusalem at the equinox. This is the standard Magen Avraham calculation converted to a solar angle. Using degrees instead of fixed minutes means the calculation adjusts properly for different locations and seasons.

### Solar Angles Reference Table

| Angle | Typical Use | Rabbinic Source |
|-------|-------------|-----------------|
| 3.7 | Very early Tzeis | Minor opinion |
| 3.8 | Early Tzeis | Chasam Sofer |
| 5.95 | Tzeis | Yereim |
| 7.083 | Tzeis (3 medium stars) | Dr. Baruch Cohn |
| 8.5 | Standard Tzeis | Geonim |
| 9.3 | Stringent Tzeis | Machmir opinion |
| 10.2 | Misheyakir | Rabbi Heineman |
| 11.5 | Standard Misheyakir | Jerusalem tradition |
| 16.1 | Standard Alos/Tzeis RT | MGA (72 min equivalent) |
| 16.9 | Alos/Tzeis | Baal HaTanya |
| 18 | Astronomical | Scientific definition |
| 19.8 | Stringent Alos | 90-minute equivalent |
| 26 | Very stringent Alos | 120-minute equivalent |

---

## 5. Proportional Hours (Shaos Zmaniyos)

Many zmanim are calculated using **proportional hours** (shaos zmaniyos). Instead of fixed 60-minute hours, a proportional hour is 1/12th of the daylight period. This means proportional hours are longer in summer and shorter in winter.

### The Concept

If visible sunrise is at 6:00 AM and visible sunset is at 6:00 PM:
- Day length = 12 hours
- One proportional hour = 12 ÷ 12 = 1 hour (same as a regular hour)

If visible sunrise is at 7:00 AM and visible sunset is at 5:00 PM:
- Day length = 10 hours
- One proportional hour = 10 ÷ 12 = 50 minutes

If visible sunrise is at 5:00 AM and visible sunset is at 9:00 PM:
- Day length = 16 hours
- One proportional hour = 16 ÷ 12 = 80 minutes (1 hour 20 minutes)

### The `proportional_hours()` Function

```
proportional_hours(hours, base)
```

Where:
- `hours` is how many proportional hours after the day starts (between 0.5 and 12)
- `base` defines what counts as the "day"

### Understanding Bases

Different authorities define the "day" differently:

**Standard Bases:**
| Base | Day Starts | Day Ends | Authority |
|------|------------|----------|-----------|
| `gra` | Visible sunrise | Visible sunset | Vilna Gaon (most common) |
| `baal_hatanya` | Netz Amiti (1.583° below horizon) | Shkiah Amiti (1.583° below horizon) | Shulchan Aruch HaRav (Chabad) |

**Fixed-Minute MGA Variants:**
| Base | Day Starts | Day Ends | Notes |
|------|------------|----------|-------|
| `mga` or `mga_72` | 72 min before visible sunrise | 72 min after visible sunset | Standard MGA |
| `mga_60` | 60 min before visible sunrise | 60 min after visible sunset | Less stringent |
| `mga_90` | 90 min before visible sunrise | 90 min after visible sunset | Stringent |
| `mga_96` | 96 min before visible sunrise | 96 min after visible sunset | More stringent |
| `mga_120` | 120 min before visible sunrise | 120 min after visible sunset | Very stringent |

**Zmaniyos (Proportional Minute) MGA Variants:**
| Base | Day Starts | Day Ends | Notes |
|------|------------|----------|-------|
| `mga_72_zmanis` | 1/10th of day before visible sunrise | 1/10th of day after visible sunset | Adjusts with season |
| `mga_90_zmanis` | 1/8th of day before visible sunrise | 1/8th of day after visible sunset | Adjusts with season |
| `mga_96_zmanis` | 1/7.5th of day before visible sunrise | 1/7.5th of day after visible sunset | Adjusts with season |

**Solar Angle MGA Variants:**
| Base | Day Starts | Day Ends | Notes |
|------|------------|----------|-------|
| `mga_16_1` | 16.1° below horizon | 16.1° below horizon | 72-min equivalent at Jerusalem equinox |
| `mga_18` | 18° below horizon | 18° below horizon | Astronomical twilight |
| `mga_19_8` | 19.8° below horizon | 19.8° below horizon | 90-min equivalent at Jerusalem equinox |
| `mga_26` | 26° below horizon | 26° below horizon | 120-min equivalent at Jerusalem equinox |

**Sephardic Bases:**
| Base | Day Starts | Day Ends | Authority |
|------|------------|----------|-----------|
| `ateret_torah` | Visible sunrise | Tzais 40 minutes | Sephardic method (Rabbi Ovadia Yosef) |

**Custom Base:**
| Base | Day Starts | Day Ends | Notes |
|------|------------|----------|-------|
| `custom(start, end)` | Any time | Any time | Your definition using zman references |

### Common Proportional Hour Zmanim

#### Sof Zman Krias Shema (Latest Time for Shema)

The Shema must be recited within the first 3 proportional hours of the day:

```
proportional_hours(3, gra)     // GRA: 3 hours after visible sunrise
proportional_hours(3, mga)     // MGA: 3 hours after (visible_sunrise - 72min)
```

#### Sof Zman Tefillah (Latest Time for Morning Prayer)

The morning prayer must be recited within the first 4 proportional hours:

```
proportional_hours(4, gra)     // GRA opinion
proportional_hours(4, mga)     // MGA opinion
```

#### Mincha Ketana (Preferred Afternoon Prayer Time)

The preferred time for Mincha begins at 9.5 proportional hours:

```
proportional_hours(9.5, gra)   // 9.5 hours into the day
```

#### Plag HaMincha

Plag is at 10.75 proportional hours (10 hours and 45 minutes into the day):

```
proportional_hours(10.75, gra)         // Standard GRA calculation
proportional_hours(10.75, ateret_torah) // Sephardic method (Ateret Torah)
```

### Custom Base Example

You can define your own day boundaries using `custom()`:

```
// Using Alos 16.1 degrees to Tzeis 8.5 degrees as the day
proportional_hours(3, custom(solar(16.1, before_sunrise), solar(8.5, after_sunset)))
```

### GRA vs MGA: A Visual Comparison

For a day with visible sunrise at 6:00 AM and visible sunset at 6:00 PM:

**GRA (visible sunrise to visible sunset):**
- Day = 12 hours
- 1 shaah = 1 hour
- Sof Zman Shema = 6:00 + 3 hours = 9:00 AM

**MGA (72 min before visible sunrise to 72 min after visible sunset):**
- Day starts at 4:48 AM (visible_sunrise - 72 min)
- Day ends at 7:12 PM (visible_sunset + 72 min)
- Day = 14 hours 24 minutes
- 1 shaah = 72 minutes
- Sof Zman Shema = 4:48 AM + 3 × 72 min = 4:48 + 3:36 = 8:24 AM

### Using `proportional_minutes()` for Scaled Time Offsets

Some zmanim use **proportional minutes** where the offset scales with the length of the day. This is commonly used for Alos calculations where "72 minutes" means 72 minutes proportional to the day length, not fixed clock minutes.

#### The Concept

On an equinox day (12 hours):
- 72 proportional minutes = exactly 72 clock minutes

On a long summer day (16 hours):
- The day is 16/12 = 1.333 times longer
- 72 proportional minutes = 72 × (16/12) ÷ 2 = 48 clock minutes from visible sunrise

On a short winter day (10 hours):
- The day is 10/12 = 0.833 times shorter
- 72 proportional minutes = 72 × (10/12) ÷ 2 = 30 clock minutes from visible sunrise

#### The `proportional_minutes()` Function

```
proportional_minutes(minutes, direction)
```

Where:
- `minutes` is the number of proportional minutes (typically 72, 90, etc.)
- `direction` specifies when to apply it (only 2 directions supported):
  - `before_sunrise` - Calculate time before sunrise
  - `after_sunset` - Calculate time after sunset

**Note:** Unlike `solar()` which supports 13 directions, `proportional_minutes()` only works with `before_sunrise` and `after_sunset`.

#### How It Works

The formula is: `offset = (minutes / 720) × day_length`

Where:
- 720 minutes = 12 hours (the reference day length)
- day_length = time from visible sunrise to visible sunset

#### Examples

```
// Alos 72 proportional minutes before visible sunrise
proportional_minutes(72, before_sunrise)

// Alos 90 proportional minutes before visible sunrise (more stringent)
proportional_minutes(90, before_sunrise)

// Tzeis 72 proportional minutes after visible sunset (Rabbeinu Tam proportional)
proportional_minutes(72, after_sunset)

// Alos 60 proportional minutes
proportional_minutes(60, before_sunrise)
```

#### When to Use

Use `proportional_minutes()` when you want the offset to adjust based on day length:
- **Fixed minutes** (`visible_sunrise - 72min`): Always exactly 72 clock minutes, regardless of season
- **Proportional minutes** (`proportional_minutes(72, before_sunrise)`): Scales with day length - longer in summer, shorter in winter

#### Comparison with Fixed Minutes

For a location at 40°N on June 21 (summer solstice, ~15 hour day):
```
visible_sunrise - 72min                  // Alos at exactly 72 clock minutes before visible sunrise
proportional_minutes(72, before_sunrise) // Alos at ~90 clock minutes before visible sunrise (scaled)
```

For the same location on December 21 (winter solstice, ~9 hour day):
```
visible_sunrise - 72min                  // Alos at exactly 72 clock minutes before visible sunrise
proportional_minutes(72, before_sunrise) // Alos at ~54 clock minutes before visible sunrise (scaled)
```

---

## 6. Finding the Middle: The Midpoint Function

The `midpoint()` function calculates the exact middle point between two times. This is useful for calculating chatzos and similar zmanim.

### Basic Usage

```
midpoint(time1, time2)
```

### Common Examples

#### Chatzos (Midday)

```
midpoint(visible_sunrise, visible_sunset)      // Exact middle of the day
```

This is equivalent to `solar_noon` but calculated differently (from visible sunrise/sunset rather than the sun's position).

#### Middle of a Period

```
// Middle of the twilight period (Bein Hashmashos midpoint)
midpoint(visible_sunset, solar(8.5, after_sunset))

// Middle of the night
midpoint(visible_sunset, visible_sunrise)      // Note: This would give midnight
```

#### MGA Chatzos

Some authorities define chatzos based on the MGA day:

```
midpoint(visible_sunrise - 72min, visible_sunset + 72min)
```

Or using references (explained in the next section):

```
midpoint(@alos_72, @tzeis_72)
```

---

## 7. Referencing Other Zmanim

When defining multiple zmanim for a publisher, you can reference zmanim that have already been calculated. This avoids repeating complex formulas and ensures consistency.

### The Reference Syntax

Use the `@` symbol followed by the zman's key (name):

```
@zman_key
```

### Example: Building a Consistent System

Suppose you've defined:
```
alos_hashachar: solar(16.1, before_sunrise)
tzeis: solar(16.1, after_sunset)
```

You can reference these in other formulas:

```
// Sof Zman Shema using the same day definition
sof_zman_shema: proportional_hours(3, custom(@alos_hashachar, @tzeis))

// Chatzos using MGA boundaries
chatzos_mga: midpoint(@alos_hashachar, @tzeis)

// A zman that's 30 minutes after Alos
earliest_tefillin: @alos_hashachar + 30min

// Tzeis symmetric to Alos
tzeis_symmetric: visible_sunset + (visible_sunrise - @alos_hashachar)
```

### Calculation Order

The system automatically figures out which zmanim depend on which others and calculates them in the correct order. For example, if `zman_b` references `@zman_a`, then `zman_a` will always be calculated first.

### Circular Reference Protection

You cannot create formulas that reference each other in a loop:

```
// This is NOT allowed - circular reference!
zman_a: @zman_b + 30min
zman_b: @zman_a - 30min
```

The system will detect this and show an error.

### Building Complex Systems

References allow you to build sophisticated, internally consistent systems:

```
// Define the base times
alos: solar(16.1, before_sunrise)
misheyakir: solar(11.5, before_sunrise)
netz: visible_sunrise
shkiah: visible_sunset
tzeis: solar(8.5, after_sunset)
tzeis_72: visible_sunset + 72min

// Build upon them
sof_zman_shema_gra: proportional_hours(3, gra)
sof_zman_shema_mga: proportional_hours(3, custom(@alos, @tzeis_72))

sof_zman_tefilla_gra: proportional_hours(4, gra)
sof_zman_tefilla_mga: proportional_hours(4, custom(@alos, @tzeis_72))

chatzos: solar_noon
mincha_gedola: @chatzos + 30min
mincha_ketana: proportional_hours(9.5, gra)
plag_hamincha: proportional_hours(10.75, gra)
```

---

## 8. Handling Special Cases with Conditions

Sometimes different rules apply in different situations. For example, high-latitude locations in summer may need different calculations because the sun doesn't go far enough below the horizon for standard calculations to work.

The DSL provides conditional logic using `if...else` statements with 8 condition variables that allow you to adapt calculations based on location, date, and day characteristics.

### The If-Else Structure

```
if (condition) { formula_if_true } else { formula_if_false }
```

### Available Condition Variables

The following 8 condition variables are available for use in conditional expressions:

| Variable | Type | Description |
|----------|------|-------------|
| `latitude` | Number | Geographic latitude (positive = north, negative = south) |
| `longitude` | Number | Geographic longitude (positive = east, negative = west) |
| `day_length` | Duration | Time from sunrise to sunset |
| `month` | Number | Month (1 = January, 12 = December) |
| `day` | Number | Day of the month (1-31) |
| `day_of_year` | Number | Day of the year (1-366) |
| `date` | Date | Current date (compared against date literals) |
| `season` | Text | "spring", "summer", "autumn", or "winter" |

### Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `>` | Greater than | `latitude > 60` |
| `<` | Less than | `day_length < 10hr` |
| `>=` | Greater than or equal | `month >= 5` |
| `<=` | Less than or equal | `month <= 8` |
| `==` | Equals | `season == "summer"` |
| `!=` | Not equal | `month != 7` |

### Combining Conditions

Use `&&` (and) and `||` (or) to combine multiple conditions:

```
// Both conditions must be true
if (latitude > 50 && month >= 5) { ... }

// Either condition can be true
if (month == 6 || month == 7) { ... }

// Negation
if (!(latitude > 60)) { ... }
```

### Practical Examples

#### High Latitude Fallback

In locations above 60 degrees latitude, the sun may not reach 16.1 degrees below the horizon in summer. Use civil twilight as a fallback:

```
if (latitude > 60) {
  civil_dawn
} else {
  solar(16.1, before_sunrise)
}
```

#### Seasonal Adjustments

Use different calculations for summer versus winter:

```
if (day_length > 14hr) {
  solar(19.8, before_sunrise)
} else {
  solar(16.1, before_sunrise)
}
```

#### Month-Based Rules

Adjust calculations for specific months:

```
if (season == "summer") {
  sunset + 90min
} else {
  sunset + 72min
}
```

#### Date Range Conditions

For locations where calculations fail during specific periods:

```
if (date >= 21-May && date <= 21-Jul) {
  // During polar summer, use midnight as Alos
  solar_midnight
} else {
  solar(16.1, before_sunrise)
}
```

### Chained Conditions (If-Else-If)

For multiple options, chain conditions together:

```
if (latitude > 65) {
  civil_dawn
} else if (latitude > 55) {
  solar(12, before_sunrise)
} else {
  solar(16.1, before_sunrise)
}
```

### Nested Conditions

You can put conditions inside other conditions:

```
if (latitude > 60) {
  if (day_length > 20hr) {
    civil_dusk
  } else {
    nautical_dusk
  }
} else {
  solar(8.5, after_sunset)
}
```

---

## 9. Choosing Between Times

Sometimes you need to select between different time values based on which comes first, which comes last, or which calculation succeeds. The DSL provides three functions for these scenarios.

### The `earlier_of()` Function

Returns whichever time comes first chronologically.

```
earlier_of(time1, time2)
```

#### Examples

```
// Dawn is whichever comes first: civil dawn or a custom offset
earlier_of(civil_dawn, visible_sunrise - 90min)

// Use earliest of two reference times
earlier_of(@alos, visible_sunrise - 72min)

// Ensure a time doesn't go past visible sunrise
earlier_of(visible_sunrise, @calculated_dawn)
```

#### Common Use Cases

- Ensuring a zman doesn't extend past a logical boundary
- Choosing the more stringent (earlier) of two opinions
- Setting a maximum time limit

### The `later_of()` Function

Returns whichever time comes last chronologically.

```
later_of(time1, time2)
```

#### Examples

```
// Nightfall is whichever comes last: civil dusk or a custom offset
later_of(civil_dusk, visible_sunset + 18min)

// Use latest of two reference times
later_of(@tzeis, visible_sunset + 42min)

// Ensure a time is at least visible sunset
later_of(visible_sunset, @calculated_nightfall)
```

#### Common Use Cases

- Ensuring a zman doesn't occur before a logical boundary
- Choosing the more stringent (later) of two opinions
- Setting a minimum time limit

### The `first_valid()` Function

Provides a way to handle calculation failures. It tries each formula in order and returns the first one that works.

#### Basic Usage

```
first_valid(primary_formula, fallback_formula)
```

Or with multiple fallbacks:

```
first_valid(first_try, second_try, third_try)
```

#### How It Works

1. Try the first formula
2. If it succeeds, return that result
3. If it fails (for example, the sun never reaches that angle), try the next formula
4. Continue until one succeeds or all fail

#### Practical Examples

**High Latitude Dawn:**

At high latitudes in summer, the sun may not reach 16.1 degrees below the horizon. Instead of writing complex conditions, use first_valid:

```
first_valid(solar(16.1, before_sunrise), solar_midnight)
```

This means: "Try to calculate Alos at 16.1 degrees. If that fails (sun never gets that low), use midnight instead."

**Progressive Fallback:**

Try increasingly conservative options:

```
first_valid(
  solar(16.1, before_sunrise),
  solar(12, before_sunrise),
  civil_dawn
)
```

This tries:
1. First, 16.1 degrees (standard Alos)
2. If that fails, 12 degrees (nautical twilight)
3. If that fails, civil dawn (6 degrees)

### Choosing the Right Function

| Function | Use When |
|----------|----------|
| `earlier_of()` | You want the earlier of two valid times |
| `later_of()` | You want the later of two valid times |
| `first_valid()` | You want automatic fallback when a calculation fails |

**Use conditions** when you know exactly what should happen in each situation:
```
if (latitude > 60) { civil_dawn } else { solar(16.1, before_sunrise) }
```

**Use first_valid** when you want automatic fallback based on whether a calculation succeeds:
```
first_valid(solar(16.1, before_sunrise), civil_dawn)
```

**Use earlier_of/later_of** when both calculations will succeed but you need to choose between them:
```
earlier_of(solar(16.1, before_sunrise), visible_sunrise - 90min)
```

The first_valid approach is often cleaner because it automatically detects when a calculation fails rather than requiring you to know in advance which latitudes will have problems.

---

## 10. The Seasonal Solar Method

Some Sephardic authorities, particularly following Rabbi Ovadia Yosef (ROY), use a **seasonal proportional method** for solar angles. This adjusts the calculation based on the current day length relative to the equinox.

### The Concept

On the equinox, day and night are equal (12 hours each). The seasonal method calculates how the sun behaves on the equinox, then scales that result proportionally based on the current day's length.

For example:
- On the equinox, 16.04 degrees below the horizon occurs about 72 minutes before visible sunrise
- On a long summer day, this might scale to 85 minutes
- On a short winter day, this might scale to 60 minutes

### The `seasonal_solar()` Function

```
seasonal_solar(degrees, direction)
```

**Important:** Only `before_sunrise` and `after_sunset` directions are valid for `seasonal_solar()`. The `before_noon` and `after_noon` directions are not supported.

### Examples

```
// ROY Alos (16.04 degrees, seasonal method)
seasonal_solar(16.04, before_sunrise)

// ROY Tzeis (8.5 degrees, seasonal method)
seasonal_solar(8.5, after_sunset)

// Misheyakir (11.5 degrees, seasonal method)
seasonal_solar(11.5, before_sunrise)
```

### When to Use Seasonal vs Standard

| Method | Use When |
|--------|----------|
| `solar()` | Following Ashkenazi customs, most standard calculations |
| `seasonal_solar()` | Following ROY, Zemaneh-Yosef, or Sephardic customs that use proportional scaling |

### Technical Detail

The seasonal calculation works like this:

1. Calculate the offset from visible sunrise/sunset at the equinox for the given angle
2. Calculate the current day length
3. Scale the equinox offset by the ratio: current day length ÷ 12 hours
4. Apply the scaled offset to today's visible sunrise/sunset

---

## 11. Comments: Explaining Your Formulas

Comments allow you to add explanations to your formulas. They're ignored by the calculator but help others (and your future self) understand why you wrote the formula a certain way.

### Single-Line Comments

Use `//` to start a comment that goes to the end of the line:

```
// This is Alos according to the Magen Avraham
visible_sunrise - 72min

solar(16.1, before_sunrise)  // Using 16.1 degrees (72-minute equivalent)
```

### Multi-Line Comments

Use `/* ... */` for comments spanning multiple lines:

```
/*
 * Sof Zman Shema according to the GRA
 * Calculated as 3 proportional hours after sunrise
 * This is the most widely used calculation
 */
proportional_hours(3, gra)
```

### Best Practices for Comments

1. **Explain the "why"**, not just the "what"
2. **Cite sources** when possible
3. **Note any special considerations** (high latitude, seasonal, etc.)

Good comment example:
```
// Tzeis according to Rabbeinu Tam - 72 minutes after visible sunset
// This is the stricter opinion, commonly used for ending Shabbos
visible_sunset + 72min
```

---

## 12. Complete Formula Examples

Let's look at complete systems of formulas that a publisher might use.

### Example 1: Standard GRA System

```
// === Dawn and Early Morning ===
alos_hashachar: solar(16.1, before_sunrise)
// Standard dawn - when there's first light
// 16.1 degrees = 72-minute equivalent in Jerusalem at equinox

misheyakir: solar(11.5, before_sunrise)
// Earliest time for tallis and tefillin
// When you can distinguish blue from white

netz: visible_sunrise
// Visible sunrise accounting for atmospheric refraction

// === Morning Zmanim ===
sof_zman_shema: proportional_hours(3, gra)
// Latest time for reciting the Shema
// 3 proportional hours into the day

sof_zman_tefilla: proportional_hours(4, gra)
// Latest time for the morning Amidah
// 4 proportional hours into the day

// === Midday ===
chatzos: solar_noon
// Halachic midday - sun at its highest point

// === Afternoon Zmanim ===
mincha_gedola: solar_noon + 30min
// Earliest time for Mincha
// Half a proportional hour after midday

mincha_ketana: proportional_hours(9.5, gra)
// Preferred time for Mincha
// 9.5 proportional hours into the day

plag_hamincha: proportional_hours(10.75, gra)
// End of the day according to Rabbi Yehuda
// 10.75 proportional hours (1.25 hours before sunset)

// === Evening ===
shkiah: visible_sunset
// Visible sunset accounting for atmospheric refraction
// Shabbos begins, weekday Mincha ends

candle_lighting: visible_sunset - 18min
// Standard Shabbos candle lighting time
// 18 minutes before visible sunset

tzeis: solar(8.5, after_sunset)
// Nightfall - three stars visible
// 8.5 degrees below horizon = 3 small stars
```

### Example 2: MGA System

```
// === Dawn (Alos) ===
alos: visible_sunrise - 72min
// Magen Avraham uses a fixed 72-minute offset

// === Shema and Tefilla (MGA) ===
sof_zman_shema_mga: proportional_hours(3, mga)
// 3 MGA hours from (visible_sunrise - 72min)

sof_zman_tefilla_mga: proportional_hours(4, mga)
// 4 MGA hours from (visible_sunrise - 72min)

// === Nightfall ===
tzeis_72: visible_sunset + 72min
// 72 minutes after visible sunset (Rabbeinu Tam)

// === MGA Chatzos ===
chatzos_mga: midpoint(visible_sunrise - 72min, visible_sunset + 72min)
// Midpoint of the MGA day
```

### Example 3: High-Latitude Aware System (for UK, Scandinavia)

```
// === Alos with High-Latitude Fallback ===
alos: if (latitude > 55) {
  first_valid(solar(16.1, before_sunrise), solar_midnight)
} else {
  solar(16.1, before_sunrise)
}
// Use solar angle where possible, fall back to midnight
// for summer months at high latitudes

// === Misheyakir with Fallback ===
misheyakir: first_valid(
  solar(11.5, before_sunrise),
  proportional_hours(0.5, gra)
)
// Standard misheyakir angle, or 30 proportional minutes after Alos

// === Tzeis with Seasonal Adjustment ===
tzeis: if (date >= 21-May && date <= 21-Jul) {
  // Summer months - sun doesn't set deeply
  solar(3.8, after_sunset)
} else {
  solar(8.5, after_sunset)
}
// Use earlier Tzeis in summer when it stays light
```

### Example 4: Baal HaTanya System

```
// === Alos (Tanya) ===
alos_tanya: solar(16.9, before_sunrise)
// Baal HaTanya uses 16.9 degrees

// === Tzeis (Symmetric to Alos) ===
tzeis_tanya: solar(16.9, after_sunset)
// Same angle after sunset as before sunrise

// === Shema (Tanya Custom Day) ===
sof_zman_shema_tanya: proportional_hours(3, custom(@alos_tanya, @tzeis_tanya))
// Uses the Tanya's day definition

// === Chatzos (Tanya) ===
chatzos_tanya: midpoint(@alos_tanya, @tzeis_tanya)
// Midpoint of the Tanya day
```

### Example 5: Sephardic System (Ateret Torah Method)

```
// === Dawn ===
alos: seasonal_solar(16.04, before_sunrise)
// ROY uses seasonal method with 16.04 degrees

// === Morning Times (Ateret Torah Base) ===
sof_zman_shema: proportional_hours(3, ateret_torah)
// Based on visible sunrise to tzais 40 minutes
// This is the Sephardic method following Rabbi Ovadia Yosef

sof_zman_tefilla: proportional_hours(4, ateret_torah)
// 4 proportional hours using Ateret Torah base

// === Afternoon Times ===
plag_hamincha: proportional_hours(10.75, ateret_torah)
// Plag using Sephardic day definition

// === Nightfall ===
tzeis_40: visible_sunset + 40min
// Tzais 40 minutes - defines the end of the Ateret Torah day

tzeis: seasonal_solar(8.5, after_sunset)
// Standard nightfall using seasonal method
```

### Example 6: Proportional Minutes System

```
// === Dawn (Proportional Minutes) ===
alos_72_prop: proportional_minutes(72, before_sunrise)
// 72 proportional minutes before visible sunrise
// Scales with day length: longer offset in summer, shorter in winter

alos_90_prop: proportional_minutes(90, before_sunrise)
// 90 proportional minutes (more stringent)

// === Nightfall (Proportional Minutes) ===
tzeis_72_prop: proportional_minutes(72, after_sunset)
// Rabbeinu Tam using proportional minutes
// More stringent in summer, more lenient in winter

// === Using Proportional Times in Custom Base ===
sof_zman_shema: proportional_hours(3, custom(@alos_72_prop, @tzeis_72_prop))
// Build a system using proportional minute boundaries
```

### Example 7: Special Zmanim (Holidays)

```
// === Pesach - Chametz Times ===
sof_zman_achilas_chametz: proportional_hours(4, gra)
// Latest time to eat chametz
// 4 proportional hours into the day

sof_zman_biur_chametz: proportional_hours(5, gra)
// Latest time to burn chametz
// 5 proportional hours into the day

// === Fast Days ===
fast_begins: if (month == 3 && day == 17) {
  // 17 Tammuz - dawn fast
  @alos
} else if (month == 5 && day == 9) {
  // 9 Av - previous evening
  visible_sunset
} else {
  @alos
}

fast_ends: @tzeis
// All fasts end at nightfall
```

---

## 13. Common Zmanim Reference

This section lists the most common zmanim with their typical formulas across different opinions.

### Dawn (Alos HaShachar)

| Opinion | Formula | Notes |
|---------|---------|-------|
| Standard (16.1°) | `solar(16.1, before_sunrise)` | Most common |
| MGA Fixed | `visible_sunrise - 72min` | Fixed offset |
| MGA Proportional | `proportional_minutes(72, before_sunrise)` | Scales with day length |
| 90 minutes fixed | `visible_sunrise - 90min` | Stringent |
| 90 minutes proportional | `proportional_minutes(90, before_sunrise)` | Stringent, scaled |
| 120 minutes | `visible_sunrise - 120min` | Very stringent |
| Baal HaTanya | `solar(16.9, before_sunrise)` | Chabad |
| 18 degrees | `solar(18, before_sunrise)` | Astronomical |
| ROY (Seasonal) | `seasonal_solar(16.04, before_sunrise)` | Sephardic |

### Misheyakir (Tallis/Tefillin)

| Opinion | Formula | Notes |
|---------|---------|-------|
| Standard | `solar(11.5, before_sunrise)` | Most common |
| Rabbi Heineman | `solar(10.2, before_sunrise)` | Baltimore |
| Early | `solar(9.5, before_sunrise)` | Very early |

### Sof Zman Shema

| Opinion | Formula | Notes |
|---------|---------|-------|
| GRA | `proportional_hours(3, gra)` | Vilna Gaon |
| MGA | `proportional_hours(3, mga)` | Magen Avraham |
| MGA 90 | `proportional_hours(3, mga_90)` | Stringent |
| Ateret Torah | `proportional_hours(3, ateret_torah)` | Sephardic method |

### Sof Zman Tefilla

| Opinion | Formula | Notes |
|---------|---------|-------|
| GRA | `proportional_hours(4, gra)` | Vilna Gaon |
| MGA | `proportional_hours(4, mga)` | Magen Avraham |
| Ateret Torah | `proportional_hours(4, ateret_torah)` | Sephardic method |

### Chatzos (Midday)

| Opinion | Formula | Notes |
|---------|---------|-------|
| Standard | `solar_noon` | Astronomical |
| Visible Sunrise-Sunset | `midpoint(visible_sunrise, visible_sunset)` | Simple midpoint |
| MGA | `midpoint(@alos, @tzeis_72)` | MGA day |

### Mincha Times

| Zman | Formula | Notes |
|------|---------|-------|
| Mincha Gedola | `solar_noon + 30min` | Earliest Mincha |
| Mincha Gedola (proportional) | `proportional_hours(6.5, gra)` | Same, proportional |
| Mincha Ketana | `proportional_hours(9.5, gra)` | Preferred time |
| Plag HaMincha | `proportional_hours(10.75, gra)` | End per R. Yehuda |

### Candle Lighting

| Community | Formula | Notes |
|-----------|---------|-------|
| Standard | `visible_sunset - 18min` | Most Ashkenazi |
| 20 minutes | `visible_sunset - 20min` | Some communities |
| Jerusalem | `visible_sunset - 40min` | Holy city custom |

### Tzeis (Nightfall)

| Opinion | Formula | Notes |
|---------|---------|-------|
| Standard (8.5°) | `solar(8.5, after_sunset)` | 3 small stars |
| 3 medium stars | `solar(7.083, after_sunset)` | Slightly earlier |
| Rabbeinu Tam (fixed) | `visible_sunset + 72min` | 72 minutes |
| Rabbeinu Tam (proportional) | `proportional_minutes(72, after_sunset)` | Scaled with day length |
| Rabbeinu Tam (degrees) | `solar(16.1, after_sunset)` | 16.1 degrees |
| Yereim | `solar(5.95, after_sunset)` | Early |
| Very stringent | `visible_sunset + 90min` | Shabbos stringency |
| Ateret Torah | `visible_sunset + 40min` | Sephardic method |

---

## 14. Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                        ZMANIM FORMULA QUICK REFERENCE                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  PRIMITIVES (Astronomical Events)                                         ║
║  ─────────────────────────────────                                        ║
║  visible_sunrise  visible_sunset   solar_noon         solar_midnight      ║
║  geometric_sunrise  geometric_sunset                                      ║
║  civil_dawn       civil_dusk       nautical_dawn      nautical_dusk       ║
║  astronomical_dawn  astronomical_dusk                                     ║
║  Note: sunrise is alias for visible_sunrise, sunset for visible_sunset    ║
║                                                                           ║
║  FUNCTIONS                                                                ║
║  ─────────                                                                ║
║  solar(degrees, direction)                                                ║
║    13 Directions Available:                                               ║
║    - Short aliases: before_sunrise, after_sunrise, after_sunset           ║
║    - Visible variants: before/after_visible_sunrise/sunset                ║
║    - Geometric variants: before/after_geometric_sunrise/sunset            ║
║    - Noon-based: before_noon, after_noon                                  ║
║    Example: solar(16.1, before_sunrise)                                   ║
║                                                                           ║
║  seasonal_solar(degrees, direction)                                       ║
║    Directions: before_sunrise, after_sunset (only these two)              ║
║    Example: seasonal_solar(16.04, before_sunrise)                         ║
║                                                                           ║
║  proportional_hours(hours, base)                                          ║
║    Bases: gra, baal_hatanya, mga, mga_60/72/90/96/120,                    ║
║           mga_72/90/96_zmanis, mga_16_1/18/19_8/26,                       ║
║           ateret_torah, custom(start, end)                                ║
║    Example: proportional_hours(3, gra)                                    ║
║                                                                           ║
║  proportional_minutes(minutes, direction)                                 ║
║    Directions: before_sunrise, after_sunset                               ║
║    Formula: offset = (minutes / 720) × day_length                         ║
║    Example: proportional_minutes(72, before_sunrise)                      ║
║                                                                           ║
║  midpoint(time1, time2)                                                   ║
║    Example: midpoint(visible_sunrise, visible_sunset)                     ║
║                                                                           ║
║  earlier_of(time1, time2)                                                 ║
║    Example: earlier_of(visible_sunrise, civil_dawn)                       ║
║                                                                           ║
║  later_of(time1, time2)                                                   ║
║    Example: later_of(visible_sunset, civil_dusk)                          ║
║                                                                           ║
║  first_valid(expr1, expr2, ...)                                           ║
║    Example: first_valid(solar(16.1, before_sunrise), civil_dawn)          ║
║                                                                           ║
║  TIME OFFSETS                                                             ║
║  ────────────                                                             ║
║  72min     18min     1hr     90min     1h 30min     2h 15min              ║
║                                                                           ║
║  OPERATORS                                                                ║
║  ─────────                                                                ║
║  +  (add time)      -  (subtract time)                                    ║
║  *  (multiply)      /  (divide)                                           ║
║  @  (reference another zman)                                              ║
║                                                                           ║
║  COMMON FORMULAS                                                          ║
║  ───────────────                                                          ║
║  Alos 72 min (fixed):       visible_sunrise - 72min                       ║
║  Alos 72 min (prop):        proportional_minutes(72, before_sunrise)      ║
║  Alos 16.1°:                solar(16.1, before_sunrise)                   ║
║  Misheyakir:                solar(11.5, before_sunrise)                   ║
║  Shema GRA:                 proportional_hours(3, gra)                    ║
║  Shema MGA:                 proportional_hours(3, mga)                    ║
║  Shema Ateret Torah:        proportional_hours(3, ateret_torah)           ║
║  Tefilla GRA:               proportional_hours(4, gra)                    ║
║  Chatzos:                   solar_noon                                    ║
║  Mincha Gedola:             solar_noon + 30min                            ║
║  Mincha Ketana:             proportional_hours(9.5, gra)                  ║
║  Plag HaMincha:             proportional_hours(10.75, gra)                ║
║  Candle Lighting:           visible_sunset - 18min                        ║
║  Tzeis 8.5°:                solar(8.5, after_sunset)                      ║
║  Tzeis R"T (fixed):         visible_sunset + 72min                        ║
║  Tzeis R"T (prop):          proportional_minutes(72, after_sunset)        ║
║                                                                           ║
║  CONDITIONALS                                                             ║
║  ────────────                                                             ║
║  if (latitude > 60) { civil_dawn } else { solar(16.1, before_sunrise) }   ║
║  if (day_length > 14hr) { ... } else { ... }                              ║
║  if (month >= 5 && month <= 8) { ... } else { ... }                       ║
║  if (date >= 21-May && date <= 21-Jul) { ... } else { ... }               ║
║                                                                           ║
║  CONDITION VARIABLES (8 total)                                            ║
║  ───────────────────                                                      ║
║  latitude     longitude     day_length                                    ║
║  month        day           day_of_year   date           season           ║
║                                                                           ║
║  COMPARISON OPERATORS                                                     ║
║  ────────────────────                                                     ║
║  >  (greater)    <  (less)       >=  (greater or equal)                   ║
║  <= (less or equal)   ==  (equals)     !=  (not equal)                    ║
║                                                                           ║
║  LOGICAL OPERATORS                                                        ║
║  ─────────────────                                                        ║
║  &&  (and)       ||  (or)        !  (not)                                 ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 15. Troubleshooting

### Common Errors and Solutions

#### "Cannot add two times"

**Problem:**
```
visible_sunrise + visible_sunset    // Error!
```

**Solution:** You can only add or subtract *durations* to/from times. To find the middle, use `midpoint()`:
```
midpoint(visible_sunrise, visible_sunset)    // Correct
```

Or to get the difference as a duration:
```
visible_sunset - visible_sunrise    // Returns the day length as a duration
```

#### "Circular reference detected"

**Problem:**
```
zman_a: @zman_b + 30min
zman_b: @zman_a - 30min    // Error: circular!
```

**Solution:** Break the circle by using a primitive or independent formula:
```
zman_a: visible_sunrise + 60min
zman_b: @zman_a + 30min    // Now this works
```

#### "Undefined reference"

**Problem:**
```
my_zman: @alos + 30min    // Error if 'alos' doesn't exist
```

**Solution:** Make sure the referenced zman exists. Check the spelling (references are case-sensitive).

#### "Parameter out of range"

**Problem:**
```
proportional_hours(15, gra)    // Error: hours must be 0.5-12
solar(100, before_sunrise)     // Error: degrees must be 0-90
```

**Solution:** Use valid parameter ranges:
- `proportional_hours`: hours must be between 0.5 and 12
- `solar`: degrees must be between 0 and 90

#### Solar angle calculation failed (high latitude)

**Problem:** At high latitudes in summer, the sun may never go far below the horizon.

**Solution:** Use `first_valid()` or conditional fallbacks:
```
first_valid(solar(16.1, before_sunrise), civil_dawn)

// Or with explicit condition:
if (latitude > 55) { civil_dawn } else { solar(16.1, before_sunrise) }
```

#### Duration format issues

**Problem:**
```
visible_sunrise + 72     // Missing 'min'
visible_sunset - 1hour   // Wrong format
```

**Solution:** Use correct duration formats:
```
visible_sunrise + 72min     // Correct
visible_sunset - 1hr        // or 1h
```

### Validation Tips

1. **Always test formulas** with known dates and locations
2. **Compare results** with authoritative sources like MyZmanim or Chabad.org
3. **Check edge cases**: equinoxes, solstices, your location at different seasons
4. **Consider high-latitude users** if your formulas might be used in places like the UK, Scandinavia, or Alaska

---

## Appendix A: Halachic Background

### Why Different Opinions?

The Torah commands us to recite Shema "when you lie down and when you rise up" (Deuteronomy 6:7). The Rabbis interpreted this to mean specific times of day. But determining exactly when "rising up" begins requires astronomical knowledge.

Different authorities through the ages have offered different interpretations:

- **Vilna Gaon (GRA)**: The day is from visible sunrise to visible sunset
- **Magen Avraham (MGA)**: The day includes twilight periods (72 minutes before visible sunrise to 72 minutes after visible sunset)
- **Rabbeinu Tam**: Nightfall doesn't occur until 72 minutes after visible sunset

### Why Use Degrees Instead of Minutes?

In Jerusalem at the equinox, the sun takes 72 minutes to travel from 16.1 degrees below the horizon to visible sunrise. But this relationship changes based on:

1. **Latitude**: At higher latitudes, the sun rises at a shallower angle, so it takes longer to travel the same number of degrees
2. **Season**: In summer at high latitudes, the sun may never go 16.1 degrees below the horizon

Using degrees instead of fixed minutes ensures the calculation reflects the actual amount of light, regardless of location or season.

### The Significance of Key Angles

| Angle | Significance |
|-------|-------------|
| 16.1° | Light first becomes visible on the horizon (MGA Alos) |
| 11.5° | Enough light to distinguish colors (Misheyakir) |
| 8.5° | Three small stars are visible (Tzeis) |
| 6° | Sufficient light to work without artificial light (Civil twilight) |
| 0° | Sun touches the horizon (Visible Sunrise/Sunset) |

---

## Appendix B: Technical Notes

### How Calculations Work

1. **Input**: Date, latitude, longitude, and optionally elevation
2. **Solar Position**: The system calculates the sun's exact position using NOAA algorithms
3. **Primitive Calculation**: Visible sunrise, visible sunset, and other primitives are determined
4. **Formula Parsing**: Your formula is analyzed and validated
5. **Execution**: The formula is calculated using the primitives and astronomical data
6. **Result**: A precise time is returned

**Note on Elevation**: Publishers can configure whether to include elevation in calculations. When elevation is ignored (via the `ignore_elevation` publisher setting), all astronomical calculations use sea level (0m elevation), regardless of the actual location elevation. This ensures consistency with certain halachic traditions that use sea-level calculations.

### Precision

- Times are calculated to the second
- Solar positions use the NOAA Solar Calculator algorithms
- Atmospheric refraction is accounted for (34 arc-minutes)
- Elevation adjustments can be applied or ignored based on publisher preference
- Results match authoritative sources like KosherJava and hebcal-go

### Type Safety

The formula system enforces type safety:
- Times can only be combined with durations
- Durations can be multiplied/divided by numbers
- References must point to existing zmanim
- Circular dependencies are prevented

This prevents common errors and ensures formulas always produce valid results.

---

*Document generated for Shtetl Zmanim*
*Based on Epic 4 DSL Specification and Implementation*
*Last Updated: 2025*
