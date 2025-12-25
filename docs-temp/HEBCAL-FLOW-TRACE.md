# Complete HebCal to ActiveEventCodes Flow Trace

## Executive Summary

This document traces the COMPLETE flow from HebCal library output to ActiveEventCodes population, with real examples.

### Key Finding: Dec 24, 2025 (4 Tevet) Behavior

**Date:** December 24, 2025
**Hebrew Date:** 4 Tevet 5786
**Day of Week:** Wednesday
**Is this Asara B'Tevet?** NO - Asara B'Tevet is 10 Tevet (6 days later)

**HebCal Output:** Empty (0 events)
**ActiveEventCodes:** Empty []
**DisplayContexts:** Empty []

**✅ CORRECT BEHAVIOR** - This is a regular Wednesday with no events.

---

## Flow Diagram

```
HebCal Go Library (github.com/hebcal/hebcal-go)
          ↓
  getHebcalEvents() - Gets raw Holiday[] array
          ↓
  mapHolidayToEventCode() - Maps Holiday.Name → event_code
          ↓
  holidayToActiveEvent() - Creates ActiveEvent with event_code
          ↓
  getActiveEvents() - Collects events for TODAY
  getErevEvents() - Collects events starting TONIGHT
  getMoetzeiEvents() - Collects events ending TONIGHT
          ↓
  GetEventDayInfo() - Returns EventDayInfo with all event arrays
          ↓
  GetZmanimContext() - Extracts ActiveEventCodes from events
          ↓
  Handler passes to CalculateZmanim() for filtering
```

---

## 1. HebCal Library Output

### File: `api/internal/calendar/events.go` lines 252-281

```go
func (s *CalendarService) getHebcalEvents(date time.Time) []Holiday {
    hd := hdate.FromTime(date)
    year := hd.Year()

    opts := hebcal.CalOptions{
        Year:             year,
        IsHebrewYear:     true,
        NoHolidays:       false,
        NoMinorFast:      false,
        NoModern:         false,
        NoRoshChodesh:    false,
        NoSpecialShabbat: true,
        ShabbatMevarchim: false,
    }

    events, _ := hebcal.HebrewCalendar(&opts)

    var holidays []Holiday
    dateStr := date.Format("2006-01-02")

    for _, ev := range events {
        evDate := ev.GetDate().Gregorian()
        if evDate.Format("2006-01-02") == dateStr {
            holidays = append(holidays, eventToHoliday(ev))
        }
    }

    return holidays
}
```

### What HebCal Returns (Real Examples)

#### December 24, 2025 (4 Tevet 5786) - Wednesday
```
HebCal returned 0 events
```

#### January 10, 2025 (10 Tevet 5785) - Friday
```
HebCal returned 1 event:
  Name: "Asara B'Tevet"
  Category: "fast"
  Yomtov: false
```

**EXACT STRING:** HebCal returns the string `"Asara B'Tevet"` (with apostrophe)

---

## 2. Event Code Mapping

### File: `api/internal/calendar/events.go` lines 310-412

The hardcoded mapping function:

```go
func mapHolidayToEventCode(name string, hd hdate.HDate, isIsrael bool) (code string, dayNum, totalDays int) {
    switch {
    // ... other cases ...

    case contains(name, "Asara B'Tevet"):
        return "asarah_bteves", 1, 1

    // ... other cases ...
    }

    return "", 0, 0
}
```

### How "Asara B'Tevet" becomes "asarah_bteves"

**Line 389-390:** Direct string matching
```go
case contains(name, "Asara B'Tevet"):
    return "asarah_bteves", 1, 1
```

**THIS IS THE ONLY PLACE** event codes are created from HebCal names.

### All Fast Day Mappings (lines 383-396)

```go
case contains(name, "Tish'a B'Av"):
    return "tisha_bav", 1, 1

case contains(name, "Tzom Gedaliah"):
    return "tzom_gedaliah", 1, 1

case contains(name, "Asara B'Tevet"):
    return "asarah_bteves", 1, 1

case contains(name, "Ta'anit Esther"):
    return "taanis_esther", 1, 1

case contains(name, "Tzom Tammuz"), contains(name, "17 of Tamuz"):
    return "shiva_asar_btamuz", 1, 1
```

---

## 3. ActiveEventCodes Population

### Step 3a: Create ActiveEvent from Holiday

**File:** `api/internal/calendar/events.go` lines 283-308

```go
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location, transliterationStyle string) *ActiveEvent {
    // Map holiday names to our event codes
    code, dayNum, totalDays := mapHolidayToEventCode(h.Name, hd, loc.IsIsrael)
    if code == "" {
        return nil  // ← If no mapping, skip this event
    }

    fastStartType := ""
    if h.Category == "fast" {
        fastStartType = getFastStartType(code)
    }

    englishName := getTransliteratedName(h.Name, transliterationStyle)

    return &ActiveEvent{
        EventCode:     code,           // ← "asarah_bteves"
        NameHebrew:    h.NameHebrew,
        NameEnglish:   englishName,
        DayNumber:     dayNum,         // ← 1
        TotalDays:     totalDays,      // ← 1
        IsFinalDay:    dayNum == totalDays,
        FastStartType: fastStartType,  // ← "dawn"
    }
}
```

### Step 3b: Collect Active Events for Date

**File:** `api/internal/calendar/events.go` lines 102-129

```go
func (s *CalendarService) getActiveEvents(date time.Time, loc Location, transliterationStyle string) []ActiveEvent {
    var events []ActiveEvent
    hd := hdate.FromTime(date)

    // Check if it's Shabbat
    if date.Weekday() == time.Saturday {
        // Add shabbos event
    }

    // Get holidays from hebcal
    holidays := s.getHebcalEvents(date)
    for _, h := range holidays {
        if ev := s.holidayToActiveEvent(h, hd, loc, transliterationStyle); ev != nil {
            events = append(events, *ev)
        }
    }

    return events
}
```

### Step 3c: GetEventDayInfo - Aggregate All Event Arrays

**File:** `api/internal/calendar/events.go` lines 65-100

```go
func (s *CalendarService) GetEventDayInfo(date time.Time, loc Location, transliterationStyle string) EventDayInfo {
    hd := s.GetHebrewDate(date)
    dow := int(date.Weekday())
    holidays := s.GetHolidays(date)

    info := EventDayInfo{
        GregorianDate: date.Format("2006-01-02"),
        HebrewDate:    hd,
        DayOfWeek:     dow,
        IsShabbat:     dow == 6,
        IsInIsrael:    loc.IsIsrael,
        Holidays:      holidays,
    }

    // Check for Yom Tov and fasts
    for _, h := range holidays {
        if h.Yomtov {
            info.IsYomTov = true
        }
        if h.Category == "fast" {
            info.IsFastDay = true
        }
    }

    // Get event arrays
    info.ActiveEvents = s.getActiveEvents(date, loc, transliterationStyle)
    info.ErevEvents = s.getErevEvents(date, loc, transliterationStyle)
    info.MoetzeiEvents = s.getMoetzeiEvents(date, loc, transliterationStyle)

    // Detect special contexts
    info.SpecialContexts = s.detectSpecialContexts(date, loc, &info)

    return info
}
```

### Step 3d: GetZmanimContext - Extract ActiveEventCodes

**File:** `api/internal/calendar/events.go` lines 461-510

```go
func (s *CalendarService) GetZmanimContext(date time.Time, loc Location, transliterationStyle string) ZmanimContext {
    info := s.GetEventDayInfo(date, loc, transliterationStyle)

    ctx := ZmanimContext{}

    // 1. Collect active event codes from events happening TODAY
    for _, ev := range info.ActiveEvents {
        ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, ev.EventCode)
    }

    // 2. Add erev events to ActiveEventCodes (for candle lighting, etc.)
    for _, erev := range info.ErevEvents {
        if erev.EventCode == "shabbos" || isYomTovEvent(erev.EventCode) {
            ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, erev.EventCode)

            if erev.EventCode == "shabbos" {
                ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, "shabbos")
            } else {
                ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, erev.EventCode)
            }
        }
    }

    // 3. Add motzei events to DisplayContexts (for havdalah, etc.)
    for _, motzei := range info.MoetzeiEvents {
        if motzei.EventCode == "shabbos" {
            ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, "shabbos")
        } else {
            ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, motzei.EventCode)
        }
    }

    // 4. Add fast day events to DisplayContexts
    for _, active := range info.ActiveEvents {
        if active.FastStartType != "" {
            ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, active.EventCode)
        }
    }

    // 5. Add erev fast events to DisplayContexts
    for _, erev := range info.ErevEvents {
        if erev.FastStartType == "sunset" {
            ctx.DisplayContexts = appendUnique(ctx.DisplayContexts, erev.EventCode)
        }
    }

    return ctx
}
```

---

## 4. Critical Question: Dec 24, 2025 Analysis

**Date:** December 24, 2025 (Wednesday)
**Hebrew Date:** 4 Tevet 5786
**Day of Week:** Wednesday (3)

### What HebCal Returns

```
HebCal returned 0 events
```

**Why?** Because 4 Tevet is not a special day. Asara B'Tevet is on 10 Tevet (6 days later).

### What ActiveEventCodes Contains

```
ActiveEventCodes: []
DisplayContexts: []
```

### Line-by-Line Trace

1. **getHebcalEvents(2025-12-24)** → Returns empty array `[]`
2. **getActiveEvents()** →
   - Checks if Saturday: NO (it's Wednesday)
   - Loops through holidays: NONE
   - Returns: `[]`
3. **getErevEvents()** →
   - Checks if Friday: NO (it's Wednesday)
   - Checks tomorrow's holidays (Dec 25): NONE
   - Returns: `[]`
4. **getMoetzeiEvents()** →
   - Checks if Saturday: NO
   - Checks today's holidays: NONE
   - Returns: `[]`
5. **GetEventDayInfo()** →
   - ActiveEvents: `[]`
   - ErevEvents: `[]`
   - MoetzeiEvents: `[]`
6. **GetZmanimContext()** →
   - Loop 1 (ActiveEvents): Empty, nothing added
   - Loop 2 (ErevEvents): Empty, nothing added
   - Loop 3 (MoetzeiEvents): Empty, nothing added
   - Loop 4 (Fast days): Empty, nothing added
   - Loop 5 (Erev fasts): Empty, nothing added
   - **Result:** `ActiveEventCodes: []`, `DisplayContexts: []`

### ✅ EXPECTED BEHAVIOR

December 24, 2025 is a regular Wednesday with no Jewish events. The system correctly returns empty arrays.

---

## 5. Real Fast Day Example: Jan 10, 2025

**Date:** January 10, 2025 (Friday)
**Hebrew Date:** 10 Tevet 5785
**Day of Week:** Friday (5)

### What HebCal Returns

```
Name: "Asara B'Tevet"
Category: "fast"
Yomtov: false
```

### What ActiveEventCodes Contains

```
ActiveEventCodes: [asarah_bteves shabbos]
DisplayContexts: [shabbos asarah_bteves]
```

### Line-by-Line Trace

1. **getHebcalEvents(2025-01-10)** → Returns `[{Name: "Asara B'Tevet", Category: "fast"}]`

2. **mapHolidayToEventCode("Asara B'Tevet", ...)** → Returns `("asarah_bteves", 1, 1)`

3. **holidayToActiveEvent()** → Creates:
   ```go
   ActiveEvent{
       EventCode: "asarah_bteves",
       FastStartType: "dawn",
       DayNumber: 1,
       TotalDays: 1,
       IsFinalDay: true
   }
   ```

4. **getActiveEvents()** →
   - Checks if Saturday: NO (it's Friday)
   - Loops through holidays: Found "Asara B'Tevet"
   - Returns: `[{EventCode: "asarah_bteves", FastStartType: "dawn"}]`

5. **getErevEvents()** →
   - Checks if Friday: YES ✓
   - Tomorrow is Shabbat, adds shabbos event
   - Returns: `[{EventCode: "shabbos"}]`

6. **GetZmanimContext()** →
   - **Loop 1 (ActiveEvents):** Adds `"asarah_bteves"` to ActiveEventCodes
   - **Loop 2 (ErevEvents):** Finds `"shabbos"`, adds to both:
     - ActiveEventCodes: `["asarah_bteves", "shabbos"]`
     - DisplayContexts: `["shabbos"]`
   - **Loop 4 (Fast days):** Finds `"asarah_bteves"` with FastStartType="dawn", adds to DisplayContexts:
     - DisplayContexts: `["shabbos", "asarah_bteves"]`

   **Final Result:**
   ```
   ActiveEventCodes: [asarah_bteves shabbos]
   DisplayContexts: [shabbos asarah_bteves]
   ```

### Why "shabbos" is in ActiveEventCodes

Because January 10, 2025 is a **Friday**, the system adds Shabbos to ActiveEventCodes so that:
- Candle lighting times can be calculated (Friday evening)
- Users see Shabbat-related zmanim on Friday

This is **CORRECT BEHAVIOR** - Fridays should include Shabbos in the context.

---

## 6. Handler Usage

### File: `api/internal/handlers/publisher_zmanim.go` lines 281-291

```go
zmanimCtx := calService.GetZmanimContext(dateInTz, loc, transliterationStyle)

// Use unified calculation service
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:         localityID,
    PublisherID:        publisherIDInt32,
    Date:               date,
    IncludeDisabled:    includeDisabled,
    IncludeUnpublished: includeUnpublished,
    IncludeBeta:        true,
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes,  // ← Passed to filtering
})
```

The `ActiveEventCodes` array is used to filter which zmanim are displayed based on their tags.

---

## 7. Summary

### Single Source of Truth

**mapHolidayToEventCode() (lines 310-412)** is the ONLY place where HebCal event names are converted to event codes. This is the hardcoded mapping that needs to be replaced with the tag-driven system.

### Flow Summary

1. **HebCal Library** returns Holiday names (e.g., "Asara B'Tevet")
2. **mapHolidayToEventCode()** converts to event codes (e.g., "asarah_bteves")
3. **getActiveEvents/getErevEvents/getMoetzeiEvents()** collect events by time context
4. **GetEventDayInfo()** aggregates all event arrays
5. **GetZmanimContext()** extracts event codes into ActiveEventCodes[]
6. **Handler** passes ActiveEventCodes to CalculateZmanim for filtering

### December 24, 2025 Answer

**What does HebCal return?** Nothing (0 events)
**What should ActiveEventCodes contain?** Empty []
**What is it ACTUALLY returning?** Empty [] ✅

**NO BUG** - The system correctly handles non-event days.

---

## 8. Fast Start Types

**File:** `api/internal/calendar/events.go` lines 414-424

```go
func getFastStartType(code string) string {
    switch code {
    case "yom_kippur", "tisha_bav":
        return "sunset"
    case "tzom_gedaliah", "asarah_bteves", "shiva_asar_btamuz", "taanis_esther":
        return "dawn"
    default:
        return ""
    }
}
```

This determines when fasts begin:
- **sunset:** Previous evening (Yom Kippur, Tisha B'Av)
- **dawn:** Same morning (all minor fasts including Asara B'Tevet)
