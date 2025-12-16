# Story 1.10: Zmanim User Experience

Status: review

## Story

As an **end user**,
I want **to view zmanim times for my location**,
so that **I know when to pray according to my chosen authority**.

## Acceptance Criteria

1. Home page shows location selection
2. Selecting city shows list of covering publishers
3. Publishers sorted by priority (higher first), then alphabetically
4. Publisher cards show name, organization, logo
5. Clicking publisher shows their profile before selection
6. Selecting publisher shows zmanim list for today
7. Date navigation arrows (← →) navigate days
8. Clicking date opens date picker
9. No covering publisher shows warning + default zmanim

## Tasks / Subtasks

- [ ] Task 1: Create home/landing page (AC: 1)
  - [ ] 1.1 Create web/app/page.tsx (update existing)
  - [ ] 1.2 Display LocationPicker prominently
  - [ ] 1.3 Show recent/saved location if available
  - [ ] 1.4 Hero section with app description

- [ ] Task 2: Create city page with publisher list (AC: 2, 3, 4)
  - [ ] 2.1 Create web/app/zmanim/[city]/page.tsx
  - [ ] 2.2 Fetch publishers for city
  - [ ] 2.3 Sort by priority descending, then alphabetically
  - [ ] 2.4 Display PublisherCard grid

- [ ] Task 3: Create publisher profile preview (AC: 5)
  - [ ] 3.1 Create web/components/zmanim/PublisherPreview.tsx
  - [ ] 3.2 Modal or expandable card with full profile
  - [ ] 3.3 "Select This Publisher" action button

- [ ] Task 4: Create zmanim display page (AC: 6)
  - [ ] 4.1 Create web/app/zmanim/[city]/[publisher]/page.tsx
  - [ ] 4.2 Fetch zmanim from API
  - [ ] 4.3 Display ZmanimList component

- [ ] Task 5: Create ZmanimList component (AC: 6)
  - [ ] 5.1 Create web/components/zmanim/ZmanimList.tsx
  - [ ] 5.2 List all zmanim with times
  - [ ] 5.3 Times in local timezone with AM/PM
  - [ ] 5.4 Info icon (ⓘ) for formula reveal

- [ ] Task 6: Create ZmanRow component (AC: 6)
  - [ ] 6.1 Create web/components/zmanim/ZmanRow.tsx
  - [ ] 6.2 Zman name, time, info icon
  - [ ] 6.3 Proper typography and spacing

- [ ] Task 7: Implement date navigation (AC: 7, 8)
  - [ ] 7.1 Create web/components/zmanim/DateNavigator.tsx
  - [ ] 7.2 Left/right arrows for day navigation
  - [ ] 7.3 Click date to open date picker
  - [ ] 7.4 Use shadcn/ui Calendar component
  - [ ] 7.5 Update URL with date parameter

- [ ] Task 8: Handle no publisher scenario (AC: 9)
  - [ ] 8.1 Create web/components/zmanim/NoPublisherWarning.tsx
  - [ ] 8.2 Warning message: "No local authority covers this area yet"
  - [ ] 8.3 Display default (non-authoritative) zmanim
  - [ ] 8.4 Disclaimer about default calculations

- [ ] Task 9: Create API endpoint for city publishers (AC: 2, 3)
  - [ ] 9.1 GET /api/cities/{cityId}/publishers
  - [ ] 9.2 Query publisher_cities + publisher_coverage
  - [ ] 9.3 Return sorted list with profiles

- [ ] Task 10: Implement localStorage persistence (AC: 1)
  - [ ] 10.1 Save last selected city
  - [ ] 10.2 Save last selected publisher
  - [ ] 10.3 Restore on app load
  - [ ] 10.4 Clear selection option

## Dev Notes

### Architecture Patterns

- **Routing:** Dynamic routes for city and publisher
- **State:** TanStack Query for server state, localStorage for persistence
- **Date Handling:** Luxon for timezone-aware date operations

### URL Structure

```
/                         # Home - location selection
/zmanim/[cityId]         # Publisher list for city
/zmanim/[cityId]/[publisherId]  # Zmanim display
/zmanim/[cityId]/[publisherId]?date=2025-11-25  # Specific date
```

### Source Tree Components

```
web/app/
  ├── page.tsx                    # Home/landing
  └── zmanim/
      ├── [city]/
      │   ├── page.tsx            # Publisher list
      │   └── [publisher]/
      │       └── page.tsx        # Zmanim display
web/components/zmanim/
  ├── ZmanimList.tsx
  ├── ZmanRow.tsx
  ├── DateNavigator.tsx
  ├── PublisherPreview.tsx
  └── NoPublisherWarning.tsx
```

### API Response for Zmanim

```json
{
  "data": {
    "date": "2025-11-25",
    "timezone": "America/New_York",
    "publisher": {
      "id": "...",
      "name": "Rabbi Smith",
      "organization": "Brooklyn Shul"
    },
    "zmanim": [
      {"name": "Alos HaShachar", "time": "05:23", "formula": {...}},
      {"name": "Sunrise", "time": "06:47", "formula": {...}},
      ...
    ]
  }
}
```

### Default Zmanim

When no publisher covers a location, use a standard GRA-based calculation with disclaimer that these are not from a local authority.

### References

- [Source: docs/architecture.md#Component-Architecture]
- [Source: docs/epics.md#Story-1.10-Zmanim-User-Experience]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.10]
- [Source: docs/ux-design-specification.md#User-Flow]
- [Source: docs/prd.md#FR23-FR29]

## Dev Agent Record

### Context Reference
- Story 1.9 algorithm publishing implementation

### Agent Model Used
- Claude Code (claude-opus-4-5-20251101)

### Debug Log References
- N/A

### Completion Notes List
- Refactored home page with Country → Region → City selection flow
- Created city page showing publishers for selected location
- Created zmanim display page with date navigation
- Implemented formula reveal via expandable zman rows
- Added "no publisher" warning with default zmanim option
- Implemented localStorage persistence for location selection
- All 13 Playwright E2E tests pass

### File List
- `web/app/page.tsx` - Refactored home page with location selection flow
- `web/app/zmanim/[cityId]/page.tsx` - Publisher selection for city
- `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - Zmanim display with date navigation
- `web/tests/zmanim-user-experience.spec.ts` - 13 Playwright E2E tests
