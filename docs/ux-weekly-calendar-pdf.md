# UX Specification: Weekly Calendar PDF Export

**Feature:** Print/Export Weekly Zmanim Calendar
**Date:** 2025-12-24
**Designer:** Sally (UX Designer)
**Status:** Ready for Implementation

---

## Overview

Enable users to export a beautifully formatted weekly zmanim calendar as a printable A4 PDF. This feature transforms the digital weekly preview into a physical reference that users can print, post on their refrigerator, or keep at their desk for easy reference throughout the week.

### User Story

> "As a user viewing my weekly zmanim preview, I want to generate a printable weekly calendar PDF so that I can have a physical reference of the week's zmanim without needing to check my phone or computer."

---

## User Journey

### Entry Point

User is viewing the **WeekPreview** dialog (opened from Algorithm page via "View Week" button).

### Flow Steps

```
1. User views WeekPreview dialog
   ↓
2. User clicks "Print Calendar" button
   ↓
3. Zman Selection Dialog appears
   ↓
4. User selects which zmanim to include
   ↓
5. User clicks "Generate PDF"
   ↓
6. PDF downloads automatically
   ↓
7. User opens PDF and prints (or saves for digital reference)
```

---

## Design Decisions

### 1. Button Placement

**Decision:** Add "Print Calendar" button directly in the WeekPreview dialog

**Location:**
- Position in the dialog header/toolbar area alongside existing controls
- Icon: 📄 printer icon
- Label: "Print Calendar" or "Export PDF"

**Rationale:**
- Users are already viewing the week they want to print
- One-click access from the context where they need it
- Aligns with user's mental model: "I see the week → I print the week"

**Visual Design:**
- Secondary button style (not primary - viewing is primary action)
- Positioned near date navigation controls but visually separated
- Tooltip: "Export printable weekly calendar as PDF"

### 2. Zman Selection Interface

**Decision:** Status-based filter dialog with published zmanim always included

**Why:** Published zmanim are the core content - always required. Optional filters let users add draft/optional/hidden zmanim if needed.

**Dialog Spec:**

#### Dialog Structure

```
┌─────────────────────────────────────────────┐
│  Weekly Calendar Options                    │
│                                             │
│  ✓ Published zmanim (8)        [always on] │
│                                             │
│  Optionally include:                        │
│  ☐ Draft zmanim (2)                        │
│  ☐ Optional zmanim (3)                     │
│  ☐ Hidden zmanim (1)                       │
│                                             │
│  Calendar will include 8 zmanim             │
│                                             │
│  [ Cancel ]           [ Generate PDF ]     │
└─────────────────────────────────────────────┘
```

#### Selection Behavior

- **Published zmanim:** Always included (not a checkbox, shown as static/locked)
- **Default State:** Only published zmanim included (optional categories unchecked)
- **Count Display:** Show count of zmanim in each category dynamically
- **Total Preview:** "Calendar will include X zmanim" updates as checkboxes change

#### Dialog Controls

- **Published zmanim:** Static display with checkmark (not toggleable) - always included
- **Optional Checkboxes:**
  - Draft (is_beta = true OR is_published = false) - unchecked by default
  - Optional (marked as optional in publisher config) - unchecked by default
  - Hidden (is_enabled = false) - unchecked by default
- **Generate PDF Button:** Primary action, always enabled (published is always included)
- **Cancel Button:** Secondary action, closes dialog

#### Accessibility

- Keyboard navigation through checkboxes (Tab/Shift+Tab)
- Space to toggle checkbox
- Enter to submit (Generate PDF)
- Escape to cancel
- Checkboxes have clear labels and counts for screen readers
- Focus indicator clearly visible

### 3. Calendar Language & Date Display

**Decision:** Respect publisher's language setting (English/Hebrew) for all calendar content

**Date Display:**

**For English Publishers:**
- Day names: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Shabbos
- Gregorian dates: "January 2, 2025"
- Hebrew dates: "3 Tevet 5786" (in English transliteration)

**For Hebrew Publishers:**
- Day names: יום ראשון, יום שני, יום שלישי, יום רביעי, יום חמישי, יום שישי, שבת
- Gregorian dates: "2 January 2025" (in Hebrew characters if fully Hebrew)
- Hebrew dates: "ג׳ טבת ה׳תשפ״ו"

**Rationale:** Users have already configured their publisher language preference - the printed calendar should match their digital experience.

### 4. Calendar Metadata (Header/Footer)

**Decision:** Include comprehensive context in header and footer

**Header Section (Top of Calendar):**

```
╔═══════════════════════════════════════════════════════════════╗
║  [Publisher Logo/Name]        Weekly Zmanim Calendar          ║
║                                                                ║
║  Week of January 2-8, 2025  •  Brooklyn, NY                  ║
║  Latitude: 40.6782, Longitude: -73.9442  •  America/New_York ║
╚═══════════════════════════════════════════════════════════════╝
```

**Footer Section (Bottom of Calendar):**

```
─────────────────────────────────────────────────────────────────
Generated: January 1, 2025 at 3:45 PM EST  •  via Shtetl.io
All times calculated according to [Publisher Name] algorithms
```

**Content:**
- **Publisher name:** Identifies whose halachic authority these zmanim represent
- **Location:** City name (if available) + coordinates for precision
- **Week date range:** Clear indication of which week this calendar covers
- **Timezone:** Critical for understanding the times
- **Generation timestamp:** When this calendar was created (version control)
- **Platform credit:** "via Shtetl.io" (branding)

---

## Calendar Layout Design

### A4 Paper Specifications

- **Size:** 210mm × 297mm (8.27" × 11.69")
- **Orientation:** Portrait
- **Margins:** 15mm all sides
- **Printable area:** 180mm × 267mm

### Layout Strategy: 7 Horizontal Rows (One Per Day)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                     │
│  [Publisher Name]                     Weekly Zmanim Calendar                │
│  Week of January 2-8, 2025  •  Brooklyn, NY  •  America/New_York          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ SUNDAY     │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 2      │ 5:45     │ 7:20     │ 9:32     │ 12:05    │ 4:38     │   │
│  │ 3 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ MONDAY     │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 3      │ 5:45     │ 7:20     │ 9:33     │ 12:05    │ 4:39     │   │
│  │ 4 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ TUESDAY    │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 4      │ 5:45     │ 7:21     │ 9:33     │ 12:06    │ 4:40     │   │
│  │ 5 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ WEDNESDAY  │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 5      │ 5:46     │ 7:21     │ 9:33     │ 12:06    │ 4:41     │   │
│  │ 6 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ THURSDAY   │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 6      │ 5:46     │ 7:21     │ 9:33     │ 12:07    │ 4:42     │   │
│  │ 7 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ FRIDAY     │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Candles  │ … │
│  │ Jan 7      │ 5:46     │ 7:21     │ 9:34     │ 12:07    │ 4:37 🕯️  │   │
│  │ 8 Tevet    │          │          │          │          │          │   │
│  ├────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤   │
│  │ SHABBOS    │ Alos     │ Sunrise  │ Shema    │ Chatzos  │ Sunset   │ … │
│  │ Jan 8      │ 5:47     │ 7:22     │ 9:34     │ 12:08    │ 4:43     │   │
│  │ 9 Tevet    │          │          │  (Last)  │          │          │   │
│  │            │          │          │          │          │ Havdalah │   │
│  │            │          │          │          │          │ 5:42 ⭐  │   │
│  └────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘   │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  FOOTER                                                                     │
│  Generated: Jan 1, 2025 3:45 PM EST  •  via Shtetl.io                     │
│  All times per [Publisher Name] algorithms                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

### Layout Specifications

#### 7-Row Table Structure

- **Equal Rows:** All 7 days get equal-height rows in a table
- **Horizontal Orientation:** Each row is a day, columns are zmanim
- **Reading Direction:** Left to right (day info → times across)
- **Rationale:**
  - Easier to scan a single day's zmanim (horizontal eye movement)
  - Better use of A4 portrait width
  - Similar to traditional luach (calendar) layouts
  - Can accommodate many zmanim as columns

#### Row Content

Each row (day) contains:

1. **Day Header Column (Left-most)**
   - Day name (SUNDAY, MONDAY, etc.)
   - Gregorian date (Jan 2)
   - Hebrew date (3 Tevet)
   - Holiday/event (if applicable) in smaller text
   - Fixed width: ~25-30mm

2. **Zman Columns (Across)**
   - Column header: Zman name (Alos, Sunrise, Shema, etc.)
   - Cell value: Time in HH:mm format
   - Each zman gets equal-width column
   - Dynamic column width based on number of zmanim selected

#### Shabbos Row

**Special Treatment:**
- Same row structure as other days (consistency)
- Visual distinction: Slightly bolder border or subtle background
- Candle lighting replaces "Sunset" column on Friday row
- Havdalah appears in Shabbos row, additional line or merged cell
- Icon indicators: 🕯️ for candles, ⭐ for havdalah

### Visual Design Elements

#### Typography

**Font Families:**
- **English:** Sans-serif font (Arial, Helvetica)
- **Hebrew:** Hebrew-compatible font (Arial, David, Times New Roman)

**Font Sizes:**
- Header (Publisher/Location): 16pt bold
- Day names: 10pt bold
- Dates: 8pt regular
- Zman names: 8pt regular
- Times: 9pt bold
- Shabbos header: 14pt bold
- Footer: 7pt regular

#### Colors (Print-Optimized)

**Black & White Design (Recommended for cost-effective printing):**
- Headers: Black
- Text: Black
- Borders: Gray (#666)
- Shabbos section: Light gray background (#F5F5F5)
- Holidays/Special days: Bold text

**Optional Color Enhancements (if color printing available):**
- Shabbos: Blue accent (#1E40AF)
- Candle lighting: Gold/Orange (#F59E0B)
- Yom Tov: Amber (#FFC107)
- Fast days: Gray

#### Spacing & Alignment

- **Column gutters:** 3-5mm between columns
- **Row spacing:** 2-3mm between zmanim
- **Section spacing:** 5mm between weekdays grid and Shabbos section
- **Text alignment:** Left-aligned for zman names, right-aligned for times (or centered)

### Responsive Zman Display

#### If Too Many Zmanim Selected

**Strategy 1: Abbreviate Names**
- "Latest Shema (GRA)" → "Shema (GRA)"
- "Plag HaMincha" → "Plag"
- "Mincha Gedolah" → "M. Gedolah"

**Strategy 2: Reduce Font Size**
- Scale down to 7pt if needed (still readable when printed)

**Strategy 3: Two-Line Layout**
```
Shema
9:32
```

**Strategy 4: Warning Before Generation**
- If > 12 zmanim: "Calendar may be cramped with this many zmanim. Consider selecting fewer for better readability."

### Holiday & Event Indicators

**Visual Treatment:**
- **Yom Tov:** Colored background in day header (amber/gold)
- **Fast Day:** Gray background, day name in italics
- **Rosh Chodesh:** Small moon icon 🌙
- **Holiday name:** Display under Hebrew date in small text

**Example:**
```
┌─────────────┐
│   FRIDAY    │ ← Day name
│   Jan 7     │ ← Gregorian date
│  8 Tevet    │ ← Hebrew date
│  Chanukah   │ ← Holiday (if applicable)
│─────────────│
│ Alos: 5:46  │
│ ...         │
```

---

## Technical Requirements

### PDF Generation

**Library:** chromedp (same as existing zmanim PDF export)

**Why chromedp:**
- Already proven to work well for PDF reports
- Render HTML → PDF using headless Chrome
- Full control over layout with HTML/CSS
- Supports complex typography (Hebrew fonts)
- Handles page sizing and printing accurately

**Approach:**
1. Generate HTML template with calendar layout
2. Render HTML with chromedp in headless mode
3. Use chromedp's PDF printing capability with A4 specs
4. Return PDF binary blob to frontend

**Page Setup:**
- Page size: A4 (210mm × 297mm)
- Orientation: Portrait
- Margins: 15mm all sides (or controlled via CSS `@page` directive)
- Print background: Enabled (for Shabbos row styling)

**Filename Convention:**
```
Zmanim_Weekly_[LocationName]_[StartDate].pdf

Example:
Zmanim_Weekly_Brooklyn_2025-01-02.pdf
```

**Reference Implementation:**
See existing `GenerateZmanimPDF` in `api/internal/handlers/publisher_reports.go` for chromedp pattern

### Data Requirements

**API Request:**
```http
POST /api/v1/publisher/calendar/weekly-pdf
Content-Type: application/json

{
  "start_date": "2025-01-02",      // Sunday of the week
  "locality_id": 4993250,          // Brooklyn
  "include_published": true,       // Include published zmanim
  "include_draft": false,          // Include draft/beta zmanim
  "include_optional": false,       // Include optional zmanim
  "include_hidden": false          // Include hidden zmanim
}
```

**Backend Logic:**
Filter zmanim based on status flags:
- `include_published`: WHERE is_published = true
- `include_draft`: WHERE is_beta = true OR is_published = false
- `include_optional`: WHERE is_enabled = true AND is_published = true AND [optional flag]
- `include_hidden`: WHERE is_enabled = false

Return zmanim in their defined `display_order`

**API Response:**
```json
{
  "publisher_name": "Machazekei Hadass Manchester",
  "location": {
    "name": "Brooklyn, NY",
    "latitude": 40.6782,
    "longitude": -73.9442,
    "timezone": "America/New_York"
  },
  "week_range": "January 2-8, 2025",
  "days": [
    {
      "date": "2025-01-02",
      "day_of_week": "Sunday",
      "hebrew_date": "3 Tevet 5786",
      "is_shabbat": false,
      "is_yom_tov": false,
      "holidays": [],
      "show_candle_lighting": false,
      "zmanim": {
        "alos_hashachar": "5:45",
        "sunrise": "7:20",
        "latest_shema_gra": "9:32",
        "sunset": "4:38",
        "nightfall_3stars": "5:43"
      }
    },
    // ... 6 more days
    {
      "date": "2025-01-08",
      "day_of_week": "Shabbos",
      "hebrew_date": "9 Tevet 5786",
      "is_shabbat": true,
      "is_yom_tov": false,
      "holidays": [],
      "show_candle_lighting": true,
      "candle_lighting": "4:37",
      "havdalah": "5:42",
      "zmanim": { /* full zmanim list */ }
    }
  ],
  "generated_at": "2025-01-01T15:45:00-05:00"
}
```

### Component Structure

**New Components:**

1. **`WeeklyCalendarButton.tsx`**
   - Button component for WeekPreview dialog
   - Click handler opens selection dialog

2. **`ZmanSelectionDialog.tsx`**
   - Modal dialog for zman selection
   - Checkbox list with Select All / Clear All
   - Validation (minimum 1 zman)
   - Generate PDF action

3. **`useWeeklyCalendarPDF.ts`** (hook)
   - API call to generate PDF
   - File download handling
   - Loading states
   - Error handling

**Backend:**

4. **`weekly_calendar_pdf.go`** (handler)
   - Endpoint: `POST /publisher/calendar/weekly-pdf`
   - Validate request (date, locality, zman keys)
   - Fetch week data (reuse existing `GetWeekZmanim` logic)
   - Generate PDF with layout
   - Return binary PDF blob

5. **PDF Template Library**
   - Reusable functions for A4 layout
   - Header/footer rendering
   - Grid layout with dynamic columns
   - Hebrew/English font handling

---

## User Experience Details

### Loading States

**During PDF Generation:**
- Show loading spinner in Generate PDF button
- Button text changes to "Generating..."
- Disable button to prevent double-clicks
- Estimated time: 1-3 seconds

### Success State

**After PDF Generation:**
- Dialog auto-closes
- PDF downloads automatically
- Success toast notification: "📄 Weekly calendar downloaded! Check your downloads folder."

### Error States

**If PDF Generation Fails:**
- Show error message in dialog: "Unable to generate PDF. Please try again."
- Keep dialog open with selections preserved
- Log error details for debugging
- Retry button available

**If No Zmanim Selected:**
- Generate PDF button disabled
- Subtle message below checkbox list: "Select at least one zman to continue"

### Accessibility

**Dialog Accessibility:**
- Modal has proper ARIA role="dialog"
- Focus trap within dialog (Tab cycles through elements)
- Escape key closes dialog
- Focus returns to "Print Calendar" button on close
- Checkboxes have clear labels for screen readers

**PDF Accessibility:**
- PDF includes text (not just images) for screen readers
- Proper heading structure (H1, H2, H3)
- Semantic structure for assistive technology

---

## Design Rationale Summary

### Why This Approach Works

1. **Discoverability:** Button right in the WeekPreview where users need it
2. **Control:** Users select which zmanim to include (respects space constraints)
3. **Flexibility:** Works for both English and Hebrew publishers
4. **Context:** All necessary metadata included (location, timezone, generation time)
5. **Print-Optimized:** Black & white design keeps printing costs low
6. **Shabbos Prominence:** Special treatment reflects its spiritual importance
7. **Consistency:** Matches existing export patterns (Excel, PDF reports)

### Inspiration from Manchester Calendar

**What We Borrowed:**
- 7-day week layout (Sunday → Shabbos)
- Column-based structure for multiple zmanim
- Compact but readable design fitting A4
- Hebrew + Gregorian date display

**What We Modernized:**
- Clean, spacious typography
- User control over zman selection
- Digital-first workflow (select → generate → download)
- Responsive to different numbers of zmanim
- Bilingual support (English/Hebrew based on preference)

---

## Future Enhancements (Out of Scope for V1)

**Potential Future Features:**
- [ ] Multi-week calendars (month view)
- [ ] Customizable color themes for PDF
- [ ] Include zman explanations/footnotes
- [ ] Calendar sync (iCal export)
- [ ] Email delivery option
- [ ] Save selection preferences (remember last selected zmanim)
- [ ] Landscape orientation option
- [ ] Letter size (US) paper option
- [ ] Weekly view with zman formulas included

---

## Implementation Checklist

### Frontend
- [ ] Create `WeeklyCalendarButton` component
- [ ] Create `ZmanSelectionDialog` component
- [ ] Add button to `WeekPreview` dialog
- [ ] Implement `useWeeklyCalendarPDF` hook
- [ ] Handle PDF download with proper filename
- [ ] Add loading/success/error states
- [ ] Write tests for components

### Backend
- [ ] Create `/publisher/calendar/weekly-pdf` endpoint
- [ ] Implement PDF generation logic
- [ ] Design A4 layout template
- [ ] Handle Hebrew font rendering
- [ ] Add timezone formatting for times
- [ ] Implement abbreviation logic for long zman names
- [ ] Add endpoint to API documentation (Swagger)
- [ ] Write integration tests

### Design
- [ ] Review calendar layout mockup
- [ ] Finalize typography scale for print
- [ ] Test print output on physical A4 paper
- [ ] Validate Hebrew rendering
- [ ] Ensure accessibility compliance

### QA
- [ ] Test with 5 zmanim
- [ ] Test with 15 zmanim (cramped layout)
- [ ] Test with English publisher
- [ ] Test with Hebrew publisher
- [ ] Test Shabbos rendering
- [ ] Test holiday indicators
- [ ] Test PDF download in all browsers
- [ ] Test printed output quality
- [ ] Verify timezone display accuracy

---

## Success Metrics

**How We'll Know This Feature Works:**

1. **Adoption Rate:** X% of users who open WeekPreview generate at least one PDF
2. **Print Rate:** Users report printing the calendars (survey/feedback)
3. **Selection Patterns:** Average number of zmanim selected (helps optimize default)
4. **Error Rate:** < 1% PDF generation failures
5. **User Feedback:** Positive comments about print quality and usefulness

---

## Appendix: Example Scenarios

### Scenario 1: Shabbos-Only User

**User:** Only cares about Shabbos times
**Selection:** Candle lighting, Sunset, Nightfall
**Result:** Clean, spacious calendar with just 3 times per day

### Scenario 2: Davening Times Focus

**User:** Wants minyan times
**Selection:** Sunrise, Latest Shema, Mincha Gedolah, Sunset, Nightfall
**Result:** Focused on prayer-time requirements

### Scenario 3: Comprehensive Calendar

**User:** Wants everything
**Selection:** All 12 zmanim enabled
**Result:** Dense but readable layout with abbreviations

### Scenario 4: Hebrew Publisher

**User:** Machazekei Hadass Manchester (Hebrew mode)
**Selection:** Full zmanim list
**Result:** Right-to-left Hebrew calendar with Hebrew day names and dates

---

**End of UX Specification**

*This document provides complete UX guidance for implementing the Weekly Calendar PDF Export feature. For implementation questions, consult the UX Designer (Sally) or refer to existing export patterns in the codebase.*
