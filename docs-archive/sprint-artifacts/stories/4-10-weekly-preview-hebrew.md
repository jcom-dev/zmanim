# Story 4.10: Weekly Preview with Hebrew Calendar

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P2
**Story Points:** 8
**Dependencies:** Story 4.2 (DSL Parser), Story 4.3 (Bilingual Naming)

---

## Story

As a **publisher**,
I want **a weekly preview showing zmanim with Hebrew dates and Jewish holidays**,
So that **I can verify my algorithm handles special days correctly and see how times vary throughout the week**.

---

## Acceptance Criteria

### AC-4.10.1: Hebrew Calendar Integration
- [ ] hebcal-go library integrated for Hebrew date calculations
- [ ] Hebrew dates display alongside Gregorian dates
- [ ] 44 Jewish events/holidays recognized (from hebcal)
- [ ] Shabbat and holiday indicators shown

### AC-4.10.2: Weekly View Layout
- [ ] 7-day horizontal scrollable view
- [ ] Each day shows: Gregorian date, Hebrew date, day of week
- [ ] Holiday/event badges displayed on relevant days
- [ ] Current day highlighted
- [ ] Navigation arrows to move week forward/backward

### AC-4.10.3: Zmanim Display Per Day
- [ ] All configured zmanim shown for each day
- [ ] Times update based on DSL formula calculations
- [ ] Candle lighting time shown on Friday (18 min before sunset default)
- [ ] Havdalah time shown on Saturday (configurable)
- [ ] Holiday-specific times shown when applicable

### AC-4.10.4: Bilingual Display
- [ ] Hebrew date in Hebrew characters (כ"ג כסלו תשפ"ה)
- [ ] Hebrew date transliteration available (23 Kislev 5785)
- [ ] Day names in Hebrew (יום ראשון, יום שני, etc.)
- [ ] Holiday names in Hebrew with English translation

### AC-4.10.5: Responsive Design
- [ ] Desktop: full 7-day view visible
- [ ] Tablet: 5-day view with scroll
- [ ] Mobile: 3-day view with swipe
- [ ] Touch-friendly navigation

### AC-4.10.6: Print/Export
- [ ] "Print Week" button generates printable view
- [ ] Clean layout for printing
- [ ] Option to export as PDF or image

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for Hebrew calendar calculations
- [ ] Integration tests pass for API endpoints
- [ ] Component tests pass for weekly view
- [ ] E2E tests pass for navigation and display
- [ ] Hebrew dates verified against authoritative sources
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: hebcal-go Integration (AC: 4.10.1)
  - [ ] 1.1 Add hebcal-go dependency
  - [ ] 1.2 Create `api/internal/calendar/hebrew.go` service
  - [ ] 1.3 Implement `GetHebrewDate(date time.Time) HebrewDate`
  - [ ] 1.4 Implement `GetHolidays(date time.Time) []Holiday`
  - [ ] 1.5 Implement `GetWeekInfo(startDate time.Time) WeekInfo`
  - [ ] 1.6 Write unit tests

- [ ] Task 2: Calendar API Endpoints (AC: 4.10.1, 4.10.3)
  - [ ] 2.1 Create `GET /api/calendar/week?date=YYYY-MM-DD` endpoint
  - [ ] 2.2 Include Hebrew dates for each day
  - [ ] 2.3 Include holidays/events for each day
  - [ ] 2.4 Include Shabbat times (candle lighting, havdalah)
  - [ ] 2.5 Write API tests

- [ ] Task 3: Weekly View Component (AC: 4.10.2)
  - [ ] 3.1 Create `WeeklyPreview` component
  - [ ] 3.2 Create `DayColumn` component
  - [ ] 3.3 Implement horizontal scroll/swipe
  - [ ] 3.4 Add navigation arrows
  - [ ] 3.5 Highlight current day
  - [ ] 3.6 Add holiday badges

- [ ] Task 4: Zmanim Per Day (AC: 4.10.3)
  - [ ] 4.1 Create `DayZmanim` component
  - [ ] 4.2 Fetch zmanim for each day in week
  - [ ] 4.3 Display candle lighting time on Friday
  - [ ] 4.4 Display havdalah time on Saturday
  - [ ] 4.5 Handle special holiday times

- [ ] Task 5: Bilingual Display (AC: 4.10.4)
  - [ ] 5.1 Format Hebrew dates in Hebrew characters
  - [ ] 5.2 Add transliteration option
  - [ ] 5.3 Display Hebrew day names
  - [ ] 5.4 Display bilingual holiday names
  - [ ] 5.5 Add RTL styling for Hebrew text

- [ ] Task 6: Responsive Design (AC: 4.10.5)
  - [ ] 6.1 Implement desktop layout (7 days)
  - [ ] 6.2 Implement tablet layout (5 days)
  - [ ] 6.3 Implement mobile layout (3 days)
  - [ ] 6.4 Add touch swipe support
  - [ ] 6.5 Test on various screen sizes

- [ ] Task 7: Print/Export (AC: 4.10.6)
  - [ ] 7.1 Create print stylesheet
  - [ ] 7.2 Add "Print Week" button
  - [ ] 7.3 Implement PDF export (optional)
  - [ ] 7.4 Test print output

- [ ] Task 8: Testing
  - [ ] 8.1 Write unit tests (calendar service)
  - [ ] 8.2 Write integration tests (API)
  - [ ] 8.3 Write component tests (weekly view)
  - [ ] 8.4 Write E2E tests (navigation, display)

---

## Dev Notes

### hebcal-go Integration

```go
// api/internal/calendar/hebrew.go
package calendar

import (
    "time"
    "github.com/hebcal/hebcal-go/hebcal"
    "github.com/hebcal/hebcal-go/hdate"
)

type HebrewDate struct {
    Day       int    `json:"day"`
    Month     string `json:"month"`
    MonthNum  int    `json:"month_num"`
    Year      int    `json:"year"`
    Hebrew    string `json:"hebrew"`     // כ"ג כסלו תשפ"ה
    Formatted string `json:"formatted"`  // 23 Kislev 5785
}

type Holiday struct {
    Name       string `json:"name"`
    NameHebrew string `json:"name_hebrew"`
    Category   string `json:"category"` // "major", "minor", "shabbat", "roshchodesh"
    Candles    bool   `json:"candles"`  // Should light candles
    Yomtov     bool   `json:"yomtov"`   // Is yom tov
}

type DayInfo struct {
    Date          time.Time    `json:"date"`
    HebrewDate    HebrewDate   `json:"hebrew_date"`
    DayOfWeek     int          `json:"day_of_week"`
    DayNameHebrew string       `json:"day_name_hebrew"`
    Holidays      []Holiday    `json:"holidays"`
    IsShabbat     bool         `json:"is_shabbat"`
}

func (s *CalendarService) GetHebrewDate(date time.Time) HebrewDate {
    hd := hdate.FromTime(date)
    return HebrewDate{
        Day:       hd.Day(),
        Month:     hd.MonthName("h"), // Hebrew
        MonthNum:  int(hd.Month()),
        Year:      hd.Year(),
        Hebrew:    hd.String(), // Full Hebrew string
        Formatted: hd.String(), // Transliterated
    }
}

func (s *CalendarService) GetWeekInfo(startDate time.Time, location *hebcal.Location) []DayInfo {
    var days []DayInfo

    for i := 0; i < 7; i++ {
        date := startDate.AddDate(0, 0, i)
        days = append(days, s.GetDayInfo(date, location))
    }

    return days
}
```

### Hebrew Day Names

```go
var hebrewDayNames = []string{
    "יום ראשון",   // Sunday
    "יום שני",     // Monday
    "יום שלישי",   // Tuesday
    "יום רביעי",   // Wednesday
    "יום חמישי",   // Thursday
    "יום שישי",    // Friday
    "שבת",         // Shabbat
}
```

### 44 Jewish Events (from hebcal)

Major holidays, minor holidays, Shabbat, Rosh Chodesh, fast days, and special Shabbatot are all recognized by hebcal-go.

### API Response

```go
// GET /api/calendar/week?date=2025-11-28&location_id=xxx
type WeekResponse struct {
    StartDate time.Time `json:"start_date"`
    EndDate   time.Time `json:"end_date"`
    Days      []DayInfo `json:"days"`
    Zmanim    map[string][]ZmanTime `json:"zmanim"` // date -> zmanim array
}
```

### Weekly View Component

```tsx
// web/components/preview/WeeklyPreview.tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DayColumn } from './DayColumn';

interface WeeklyPreviewProps {
  publisherId: string;
  locationId: string;
}

export function WeeklyPreview({ publisherId, locationId }: WeeklyPreviewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-preview', weekStart, publisherId, locationId],
    queryFn: () => fetchWeekData(weekStart, publisherId, locationId),
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -7 : 7;
    setWeekStart(prev => addDays(prev, days));
  };

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <h3 className="text-lg font-medium">
          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </h3>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-2 md:grid-cols-5 sm:grid-cols-3 overflow-x-auto">
        {data?.days.map((day) => (
          <DayColumn
            key={day.date}
            day={day}
            zmanim={data.zmanim[day.date]}
            isToday={isToday(parseISO(day.date))}
          />
        ))}
      </div>
    </div>
  );
}
```

### Day Column Component

```tsx
// web/components/preview/DayColumn.tsx
interface DayColumnProps {
  day: DayInfo;
  zmanim: ZmanTime[];
  isToday: boolean;
}

export function DayColumn({ day, zmanim, isToday }: DayColumnProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-3 min-w-[120px]",
        isToday && "ring-2 ring-primary",
        day.isShabbat && "bg-amber-50"
      )}
    >
      {/* Date header */}
      <div className="text-center mb-3">
        <div className="text-sm text-muted-foreground">
          {format(parseISO(day.date), 'EEE')}
        </div>
        <div className="text-lg font-medium">
          {format(parseISO(day.date), 'd')}
        </div>
        <div className="text-sm font-hebrew" dir="rtl">
          {day.hebrewDate.hebrew}
        </div>
        <div className="text-xs text-muted-foreground">
          {day.dayNameHebrew}
        </div>
      </div>

      {/* Holiday badges */}
      {day.holidays.map((holiday) => (
        <Badge
          key={holiday.name}
          variant={holiday.yomtov ? 'default' : 'secondary'}
          className="text-xs mb-1"
        >
          {holiday.nameHebrew}
        </Badge>
      ))}

      {/* Zmanim list */}
      <div className="space-y-1 mt-3">
        {zmanim.map((zman) => (
          <div key={zman.key} className="flex justify-between text-xs">
            <span className="truncate">{zman.name}</span>
            <span className="font-mono">{zman.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Print Stylesheet

```css
/* web/styles/print.css */
@media print {
  .no-print {
    display: none !important;
  }

  .weekly-preview {
    grid-template-columns: repeat(7, 1fr) !important;
  }

  .day-column {
    break-inside: avoid;
    border: 1px solid #ccc;
    padding: 8px;
  }

  .hebrew-date {
    font-family: 'Noto Sans Hebrew', serif;
  }
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.10]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Weekly Preview]
- [hebcal-go](https://github.com/hebcal/hebcal-go)

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestGetHebrewDate` - correct conversion
- [ ] `TestGetHolidays` - returns holidays for dates
- [ ] `TestGetWeekInfo` - returns 7 days
- [ ] `TestShabbatDetection` - correctly identifies Shabbat

### Integration Tests (API)
- [ ] `GET /api/calendar/week` returns week data
- [ ] API includes Hebrew dates
- [ ] API includes holidays
- [ ] API includes zmanim for each day

### Component Tests (React)
- [ ] WeeklyPreview renders 7 days
- [ ] DayColumn shows Hebrew date
- [ ] Holiday badges display correctly
- [ ] Navigation changes week

### E2E Tests (Playwright)
- [ ] Publisher can view weekly preview
- [ ] Navigation moves week forward/backward
- [ ] Current day is highlighted
- [ ] Shabbat day styled differently
- [ ] Print button opens print dialog

### Verification Tests
- [ ] Hebrew dates match authoritative calendar
- [ ] Holiday names correct
- [ ] Candle lighting times accurate

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-10-weekly-preview-hebrew.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md
- docs/sprint-artifacts/epic-4-ui-wireframes.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
