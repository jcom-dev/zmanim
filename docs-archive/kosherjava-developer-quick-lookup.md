# KosherJava Zmanim - Developer Quick Lookup

**Quick reference for developers integrating KosherJava Zmanim**

---

## Instant Lookup: Find the Right Method

### "I need standard sunrise/sunset"
```java
zc.getSunrise()          // With elevation adjustment
zc.getSunset()           // With elevation adjustment
zc.getSeaLevelSunrise()  // Sea level only
zc.getSeaLevelSunset()   // Sea level only
```

### "I need dawn (alos)"
**Most common:**
```java
zc.getAlosHashachar()             // 16.1° (72 min) - Standard
czc.getAlos72()                   // 72 fixed minutes
```

**Other options:**
```java
czc.getAlos60()                   // 60 minutes
czc.getAlos90()                   // 90 minutes (5 mil)
czc.getAlos96()                   // 96 minutes
czc.getAlos120()                  // 120 minutes (lechumra)
czc.getAlos18Degrees()            // 18° astronomical
czc.getAlos19Point8Degrees()      // 19.8° (90 min)
czc.getAlosBaalHatanya()          // Baal Hatanya (16.9°)
```

### "I need nightfall (tzais)"
**Most common:**
```java
zc.getTzais()                     // 8.5° (3 small stars)
czc.getTzais72()                  // 72 fixed minutes
```

**Geonim (common in Israel/Sefard):**
```java
czc.getTzaisGeonim7Point083Degrees()  // 7.083° (30 min, 3 medium stars)
czc.getTzaisGeonim6Point45Degrees()   // 6.45° (28-31 min, Israel standard)
czc.getTzaisGeonim8Point5Degrees()    // 8.5° (36 min, 3 small stars)
```

**Other options:**
```java
czc.getTzais60()                  // 60 minutes
czc.getTzais90()                  // 90 minutes
czc.getTzais50()                  // 50 minutes
czc.getTzais16Point1Degrees()     // 16.1° (72 min)
czc.getTzaisBaalHatanya()         // Baal Hatanya (6°)
```

### "I need latest Shma time"
**GRA (sunrise-sunset day):**
```java
zc.getSofZmanShmaGRA()            // Standard GRA
```

**MGA (alos-tzais day):**
```java
zc.getSofZmanShmaMGA()                       // 72 minutes
czc.getSofZmanShmaMGA16Point1Degrees()       // 16.1° (common)
czc.getSofZmanShmaMGA72Minutes()             // 72 minutes
czc.getSofZmanShmaMGA90Minutes()             // 90 minutes
czc.getSofZmanShmaMGA18Degrees()             // 18°
czc.getSofZmanShmaMGA19Point8Degrees()       // 19.8°
```

**Baal Hatanya:**
```java
czc.getSofZmanShmaBaalHatanya()   // Baal Hatanya day
```

### "I need latest Tfila (prayer) time"
**GRA:**
```java
zc.getSofZmanTfilaGRA()           // Standard GRA
```

**MGA:**
```java
zc.getSofZmanTfilaMGA()                      // 72 minutes
czc.getSofZmanTfilaMGA16Point1Degrees()      // 16.1° (common)
czc.getSofZmanTfilaMGA72Minutes()            // 72 minutes
czc.getSofZmanTfilaMGA90Minutes()            // 90 minutes
```

**Baal Hatanya:**
```java
czc.getSofZmanTfilaBaalHatanya()  // Baal Hatanya day
```

### "I need chatzos (midday)"
```java
zc.getChatzos()                   // Astronomical or half-day (depends on setting)
zc.getChatzosAsHalfDay()          // Always half-day
czc.getFixedLocalChatzos()        // Fixed local time
```

### "I need Mincha Gedola"
```java
zc.getMinchaGedola()              // GRA (6.5 hours)
czc.getMinchaGedola30Minutes()    // Fixed 30 min after chatzos
czc.getMinchaGedolaBaalHatanya()  // Baal Hatanya
```

### "I need Mincha Ketana"
```java
zc.getMinchaKetana()              // GRA (9.5 hours)
czc.getMinchaKetanaBaalHatanya()  // Baal Hatanya
```

### "I need Plag Hamincha"
```java
zc.getPlagHamincha()              // GRA (10.75 hours)
czc.getPlagHamincha72Minutes()    // MGA 72 minutes
czc.getPlagHaminchaBaalHatanya()  // Baal Hatanya
```

### "I need candle lighting time"
```java
zc.getCandleLighting()            // Default: 18 min before sunset
zc.setCandleLightingOffset(40)    // For Jerusalem (40 min)
```

### "I need Baal Hatanya times"
```java
czc.getSunriseBaalHatanya()       // Netz amiti (1.583°)
czc.getSunsetBaalHatanya()        // Shkiah amiti (1.583°)
czc.getAlosBaalHatanya()          // 16.9° (72 min before netz amiti)
czc.getTzaisBaalHatanya()         // 6° (24 min after shkiah amiti)
czc.getSofZmanShmaBaalHatanya()   // Based on Baal Hatanya day
czc.getSofZmanTfilaBaalHatanya()  // Based on Baal Hatanya day
czc.getMinchaGedolaBaalHatanya()  // Based on Baal Hatanya day
czc.getMinchaKetanaBaalHatanya()  // Based on Baal Hatanya day
czc.getPlagHaminchaBaalHatanya()  // Based on Baal Hatanya day
```

### "I need Rabbeinu Tam times"
```java
czc.getTzais72()                  // 72 minutes after sunset
czc.getBainHashmashosRT13Point24Degrees()     // 13.24° (58.5 min)
czc.getBainHashmashosRT58Point5Minutes()      // 58.5 fixed minutes
```

### "I need Pesach chametz times"
**Latest eating (5 hours):**
```java
czc.getSofZmanAchilasChametzGRA()             // GRA
czc.getSofZmanAchilasChametzMGA72Minutes()    // MGA 72 min
czc.getSofZmanAchilasChametzBaalHatanya()     // Baal Hatanya
```

**Latest burning (6 hours):**
```java
czc.getSofZmanBiurChametzGRA()                // GRA
czc.getSofZmanBiurChametzMGA72Minutes()       // MGA 72 min
czc.getSofZmanBiurChametzBaalHatanya()        // Baal Hatanya
```

### "I need Kiddush Levana times"
```java
czc.getZmanMolad()                            // Time of molad
czc.getTchilasZmanKidushLevana3Days()         // Earliest (3 days)
czc.getTchilasZmanKidushLevana7Days()         // Earliest (7 days, Mechaber)
czc.getSofZmanKidushLevana15Days()            // Latest (15 days)
czc.getSofZmanKidushLevanaBetweenMoldos()     // Latest (halfway)
```

---

## Community Quick Lookup

### "I'm building for Ashkenaz community"
```java
Date alos = czc.getAlos72();                      // 72 min
Date sofZmanShma = czc.getSofZmanShmaMGA72Minutes(); // MGA 72
Date sofZmanTfila = czc.getSofZmanTfilaMGA72Minutes(); // MGA 72
Date tzais = czc.getTzais72();                    // 72 min
```

### "I'm building for Israel (common)"
```java
Date tzais = czc.getTzaisGeonim6Point45Degrees(); // 28-31 min (R' Tucazinsky)
Date sofZmanShma = czc.getSofZmanShmaMGA16Point1Degrees(); // MGA 16.1°
```

### "I'm building for Chabad"
```java
Date netz = czc.getSunriseBaalHatanya();          // Netz amiti
Date alos = czc.getAlosBaalHatanya();             // 72 min before netz amiti
Date sofZmanShma = czc.getSofZmanShmaBaalHatanya(); // BH day
Date shkiah = czc.getSunsetBaalHatanya();         // Shkiah amiti
Date tzais = czc.getTzaisBaalHatanya();           // 24 min after shkiah
```

### "I'm building for Jerusalem"
```java
zc.setCandleLightingOffset(40);                   // 40 min before sunset
Date candleLighting = zc.getCandleLighting();
```

---

## Configuration Quick Lookup

### "How do I set the location?"
```java
String locationName = "Lakewood, NJ";
double latitude = 40.0828;
double longitude = -74.2094;
double elevation = 20;  // meters, optional
TimeZone timeZone = TimeZone.getTimeZone("America/New_York");

GeoLocation location = new GeoLocation(locationName, latitude,
                                       longitude, elevation, timeZone);
ComplexZmanimCalendar czc = new ComplexZmanimCalendar(location);
```

### "How do I set the date?"
```java
// Set to specific date
czc.getCalendar().set(Calendar.YEAR, 2025);
czc.getCalendar().set(Calendar.MONTH, Calendar.JANUARY);
czc.getCalendar().set(Calendar.DAY_OF_MONTH, 15);

// Or use Date
czc.getCalendar().setTime(new Date());
```

### "How do I enable/disable elevation?"
```java
czc.setUseElevation(true);   // Use elevation (earlier sunrise, later sunset)
czc.setUseElevation(false);  // Sea level calculations
```

### "How do I configure chatzos?"
```java
czc.setUseAstronomicalChatzos(true);  // Solar transit (most accurate)
czc.setUseAstronomicalChatzos(false); // Half-day (sunrise+sunset)/2

// For afternoon zmanim
czc.setUseAstronomicalChatzosForOtherZmanim(true);  // Use chatzos-based calcs
```

### "How do I change candle lighting offset?"
```java
czc.setCandleLightingOffset(18);  // Standard (default)
czc.setCandleLightingOffset(40);  // Jerusalem
czc.setCandleLightingOffset(20);  // Some communities
```

### "How do I change Ateret Torah offset?"
```java
czc.setAteretTorahSunsetOffset(40);  // Default
czc.setAteretTorahSunsetOffset(45);  // Custom
```

---

## Custom Calculation Quick Lookup

### "I need a custom degree-based alos"
```java
double customDegrees = 14.0;
Date customAlos = czc.getSunriseOffsetByDegrees(
    AstronomicalCalendar.GEOMETRIC_ZENITH + customDegrees
);
```

### "I need a custom degree-based tzais"
```java
double customDegrees = 7.5;
Date customTzais = czc.getSunsetOffsetByDegrees(
    AstronomicalCalendar.GEOMETRIC_ZENITH + customDegrees
);
```

### "I need a custom shaos zmaniyos calculation"
```java
Date startOfDay = czc.getAlos72();
Date endOfDay = czc.getTzais72();
double hours = 3.5;  // e.g., 3.5 hours after start

Date customZman = czc.getShaahZmanisBasedZman(startOfDay, endOfDay, hours);
```

### "I need a custom chatzos-based calculation"
```java
Date chatzos = czc.getChatzos();
Date endOfDay = czc.getSunset();
double hoursAfterChatzos = 2.5;

Date customZman = czc.getHalfDayBasedZman(chatzos, endOfDay, hoursAfterChatzos);
```

### "I need an asymmetric day calculation"
```java
// Manchester calendar example: alos 12° to tzais 7.083°
Date alos = czc.getSunriseOffsetByDegrees(
    AstronomicalCalendar.GEOMETRIC_ZENITH + 12
);
Date tzais = czc.getSunsetOffsetByDegrees(
    AstronomicalCalendar.GEOMETRIC_ZENITH + 7.083
);

// Calculate plag for this day
Date plag = czc.getPlagHamincha(alos, tzais);
```

### "I need to calculate shaah zmanis for a custom day"
```java
Date startOfDay = /* your custom start */;
Date endOfDay = /* your custom end */;

long shaahZmanis = czc.getTemporalHour(startOfDay, endOfDay);
// Returns milliseconds per temporal hour
```

### "I need to add/subtract time from a zman"
```java
Date baseTime = czc.getSunrise();
long offsetMillis = 30 * 60 * 1000;  // 30 minutes

Date newTime = czc.getTimeOffset(baseTime, offsetMillis);     // Add
Date earlierTime = czc.getTimeOffset(baseTime, -offsetMillis); // Subtract
```

---

## Troubleshooting Quick Lookup

### "Why am I getting null?"
**Reasons:**
1. Arctic/Antarctic region (sun doesn't rise/set)
2. Invalid degree calculation (sun never reaches that degree on this date)
3. Null inputs to calculation methods

**Solution:**
```java
Date zman = czc.getSomeZman();
if (zman == null) {
    // Handle the null case
    // This is expected in certain locations/dates
}
```

### "Why are my times wrong?"
**Check:**
1. Location (lat/lon/timezone) correct?
2. Date set correctly?
3. Elevation setting appropriate?
4. Using the right method for your community?

```java
// Verify location
System.out.println(czc.getGeoLocation());

// Verify date
System.out.println(czc.getCalendar().getTime());

// Verify elevation setting
System.out.println(czc.isUseElevation());
```

### "How do I format the output?"
```java
// Use Java SimpleDateFormat
SimpleDateFormat sdf = new SimpleDateFormat("h:mm:ss a");
sdf.setTimeZone(location.getTimeZone());

Date sunrise = czc.getSunrise();
if (sunrise != null) {
    String formatted = sdf.format(sunrise);
    System.out.println("Sunrise: " + formatted);
}

// Or use ZmanimFormatter (included)
ZmanimFormatter formatter = new ZmanimFormatter();
String formatted = formatter.format(sunrise);
```

### "How do I get times for multiple dates?"
```java
Calendar cal = czc.getCalendar();
SimpleDateFormat sdf = new SimpleDateFormat("MM/dd/yyyy h:mm a");

for (int day = 1; day <= 7; day++) {
    cal.set(Calendar.DAY_OF_MONTH, day);

    Date sunrise = czc.getSunrise();
    Date sunset = czc.getSunset();

    System.out.println(sdf.format(cal.getTime()) +
                      " - Sunrise: " + sdf.format(sunrise) +
                      " Sunset: " + sdf.format(sunset));
}
```

---

## Performance Quick Lookup

### "How do I cache calculations?"
```java
// Create once, reuse
ComplexZmanimCalendar czc = new ComplexZmanimCalendar(location);

// Set date
czc.getCalendar().set(Calendar.YEAR, 2025);
czc.getCalendar().set(Calendar.MONTH, Calendar.JANUARY);
czc.getCalendar().set(Calendar.DAY_OF_MONTH, 15);

// Calculate multiple zmanim (calculations are not cached internally)
Date alos = czc.getAlos72();
Date sunrise = czc.getSunrise();
Date sofZmanShma = czc.getSofZmanShmaGRA();
// ... etc

// For next day, just change date
czc.getCalendar().add(Calendar.DAY_OF_MONTH, 1);
Date nextAlos = czc.getAlos72();
```

### "Is it thread-safe?"
**No.** Create separate instances per thread:
```java
// Thread 1
ComplexZmanimCalendar czc1 = new ComplexZmanimCalendar(location);

// Thread 2
ComplexZmanimCalendar czc2 = new ComplexZmanimCalendar(location);
```

Or synchronize:
```java
synchronized(czc) {
    Date sunrise = czc.getSunrise();
}
```

---

## Constants Reference

### Base Zeniths
```java
AstronomicalCalendar.GEOMETRIC_ZENITH = 90°
AstronomicalCalendar.CIVIL_ZENITH = 96°
AstronomicalCalendar.NAUTICAL_ZENITH = 102°
AstronomicalCalendar.ASTRONOMICAL_ZENITH = 108°
```

### Commonly Used Degrees
```java
// Add to GEOMETRIC_ZENITH
16.1  // 72 minutes (MGA standard)
18.0  // Astronomical twilight
19.8  // 90 minutes
7.083 // 30 minutes (3 medium stars)
8.5   // 36 minutes (3 small stars)
6.45  // Israel (R' Tucazinsky)
```

### Time Constants
```java
AstronomicalCalendar.MINUTE_MILLIS = 60,000
AstronomicalCalendar.HOUR_MILLIS = 3,600,000
```

---

## Common Patterns

### Pattern: "Calculate all morning zmanim"
```java
Date alos = czc.getAlos72();
Date misheyakir = czc.getMisheyakir10Point2Degrees();
Date sunrise = czc.getSunrise();
Date sofZmanShmaGRA = czc.getSofZmanShmaGRA();
Date sofZmanShmaMGA = czc.getSofZmanShmaMGA();
Date sofZmanTfilaGRA = czc.getSofZmanTfilaGRA();
Date sofZmanTfilaMGA = czc.getSofZmanTfilaMGA();
Date chatzos = czc.getChatzos();
```

### Pattern: "Calculate all afternoon zmanim"
```java
Date chatzos = czc.getChatzos();
Date minchaGedola = czc.getMinchaGedola();
Date minchaKetana = czc.getMinchaKetana();
Date plagHamincha = czc.getPlagHamincha();
Date sunset = czc.getSunset();
Date tzais = czc.getTzais();
```

### Pattern: "Calculate for a week"
```java
Map<Date, Map<String, Date>> week = new HashMap<>();
Calendar cal = czc.getCalendar();

for (int i = 0; i < 7; i++) {
    Map<String, Date> zmanim = new HashMap<>();

    zmanim.put("sunrise", czc.getSunrise());
    zmanim.put("sofZmanShma", czc.getSofZmanShmaGRA());
    zmanim.put("chatzos", czc.getChatzos());
    zmanim.put("sunset", czc.getSunset());
    zmanim.put("tzais", czc.getTzais());

    week.put(cal.getTime(), zmanim);

    cal.add(Calendar.DAY_OF_MONTH, 1);
}
```

### Pattern: "Calculate for multiple locations"
```java
List<GeoLocation> locations = Arrays.asList(
    new GeoLocation("NY", 40.7128, -74.0060, TimeZone.getTimeZone("America/New_York")),
    new GeoLocation("LA", 34.0522, -118.2437, TimeZone.getTimeZone("America/Los_Angeles")),
    new GeoLocation("Jerusalem", 31.7683, 35.2137, TimeZone.getTimeZone("Asia/Jerusalem"))
);

for (GeoLocation loc : locations) {
    ComplexZmanimCalendar czc = new ComplexZmanimCalendar(loc);
    Date sunrise = czc.getSunrise();
    System.out.println(loc.getLocationName() + ": " + sunrise);
}
```

---

## Error Handling

### Pattern: "Safe zman retrieval"
```java
public static Date safeGetZman(ComplexZmanimCalendar czc,
                                Supplier<Date> zmanMethod,
                                String zmanName) {
    try {
        Date zman = zmanMethod.get();
        if (zman == null) {
            System.err.println(zmanName + " not available for this date/location");
        }
        return zman;
    } catch (Exception e) {
        System.err.println("Error calculating " + zmanName + ": " + e.getMessage());
        return null;
    }
}

// Usage
Date sunrise = safeGetZman(czc, czc::getSunrise, "Sunrise");
```

---

## Quick Decision Tree

```
Need a zman? Start here:
│
├─ Is it a basic time? (sunrise, sunset, chatzos)
│  └─ Use ZmanimCalendar basic methods
│
├─ Is it for Baal Hatanya?
│  └─ Use ComplexZmanimCalendar get*BaalHatanya() methods
│
├─ Is it for a standard opinion? (GRA, MGA 72, etc.)
│  └─ Use ComplexZmanimCalendar get*GRA() or get*MGA*() methods
│
├─ Is it a custom calculation?
│  ├─ Degree-based? → getSunriseOffsetByDegrees() or getSunsetOffsetByDegrees()
│  ├─ Shaos-based? → getShaahZmanisBasedZman()
│  ├─ Chatzos-based? → getHalfDayBasedZman()
│  └─ Custom day definition? → Use generic methods with custom start/end
│
└─ Not sure?
   └─ Check the "Instant Lookup" section above
```

---

**End of Quick Lookup Guide**
