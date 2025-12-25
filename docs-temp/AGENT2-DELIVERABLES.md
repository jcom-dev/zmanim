# Agent 2 Deliverables: Database-Driven Event Mapping

## Summary

Successfully eliminated all hardcoded event mapping logic and replaced it with database-driven pattern matching using the `tag_event_mappings` table.

## Changes Made

### 1. New Database-Driven Functions

Created in `/home/daniel/repos/zmanim/api/internal/calendar/events.go`:

- **`GetEventCodeFromHebcal()`** - Maps HebCal event names to tags using database pattern matching
  - Queries `tag_event_mappings` table via `GetTagForHebcalEventName`
  - Retrieves event metadata via `GetEventMetadata`
  - Returns tag match and metadata, or nil if no match
  - Gracefully degrades when database is unavailable

- **`extractDayNumber()`** - Extracts day number from HebCal event names
  - Handles Roman numerals (I, II, III, etc.) in event names
  - Supports multi-day events like "Rosh Hashana I", "Pesach VII"
  - Returns 1-based day number with sensible defaults

### 2. Updated Event Conversion

Updated `holidayToActiveEvent()` in `/home/daniel/repos/zmanim/api/internal/calendar/events.go`:

- Replaced hardcoded `mapHolidayToEventCode()` call with `GetEventCodeFromHebcal()`
- Uses database metadata for:
  - Event codes (tag_key)
  - Display names (Hebrew and English with transliteration support)
  - Day numbers and total days
  - Fast start types (dawn vs sunset)
  - Yom Tov levels
- Respects location (Israel vs Diaspora) for duration calculations

### 3. Deleted Hardcoded Functions

Completely removed from `/home/daniel/repos/zmanim/api/internal/calendar/events.go`:

- **`mapHolidayToEventCode()`** - 102 lines of switch statement logic (lines 357-458)
- **`getFastStartType()`** - 13 lines of hardcoded fast type mapping (lines 461-470)

### 4. Database Adapter Enhancements

Added to `/home/daniel/repos/zmanim/api/internal/calendar/db_adapter.go`:

- **`GetTagForHebcalEventName()`** - Adapter for pattern matching query
- **`GetEventMetadata()`** - Adapter for single event metadata lookup
- Proper type conversions from sqlcgen types to calendar types

### 5. Interface Extensions

Updated `/home/daniel/repos/zmanim/api/internal/calendar/hebrew.go`:

- Added `HebcalTagMatch` struct for tag match results
- Extended `Querier` interface with new methods:
  - `GetTagForHebcalEventName(ctx, hebcalEventName) (*HebcalTagMatch, error)`
  - `GetEventMetadata(ctx, tagKey) (*EventMetadata, error)`

### 6. Handler Updates

Updated handlers to use database-driven calendar service in:

- `/home/daniel/repos/zmanim/api/internal/handlers/calendar.go`:
  - `GetEventDayInfo()` - Now uses `NewCalendarServiceWithDB(dbAdapter)`
  - `GetZmanimContext()` - Now uses `NewCalendarServiceWithDB(dbAdapter)`
  - `GetWeekEventInfo()` - Now uses `NewCalendarServiceWithDB(dbAdapter)`

- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go`:
  - `GetPublisherZmanim()` - Now uses `NewCalendarServiceWithDB(dbAdapter)`
  - `GetPublisherWeekZmanim()` - Now uses `NewCalendarServiceWithDB(dbAdapter)`

## Validation

### Build Success
```bash
cd api && go build ./cmd/api
# ✓ Builds without errors
```

### Code Quality Checks

- ✓ No hardcoded event logic remains
- ✓ No switch statements on event codes
- ✓ No TODO/FIXME comments related to event mapping
- ✓ All handlers use database adapter for event-dependent operations
- ✓ Graceful degradation when database is unavailable

### Line Count
- Before: 553 lines in events.go
- After: 515 lines in events.go
- Reduction: 38 lines (removed 115 lines, added 77 lines)

## Database Dependencies

This implementation relies on:

1. **`tag_event_mappings` table** - Contains HebCal event pattern mappings
2. **`zman_tags` metadata columns** - Added by Agent 1:
   - `is_hidden`
   - `yom_tov_level`
   - `fast_start_type`
   - `day_number`
   - `total_days`

3. **SQL queries** (Agent 3):
   - `GetTagForHebcalEventName` - Pattern matching with priority
   - `GetEventMetadata` - Single tag metadata lookup
   - `GetEventMetadataByKeys` - Bulk metadata lookup

## How It Works

### Event Flow

1. **HebCal API** returns event name (e.g., "Rosh Hashana I")
2. **`GetEventCodeFromHebcal()`** queries database:
   - Matches against patterns in `tag_event_mappings` (e.g., "Rosh Hashana%")
   - Returns highest priority match
3. **Database returns**:
   - Tag key (e.g., "rosh_hashanah")
   - Display names (Hebrew and English)
   - Metadata (yom_tov_level, total_days, etc.)
4. **`holidayToActiveEvent()`** builds ActiveEvent:
   - Uses tag key as event code
   - Applies location-specific duration
   - Extracts day number from event name
   - Sets fast start type from metadata

### Example: Rosh Hashana I

```
HebCal Event: "Rosh Hashana I"
      ↓
Database Pattern Match: "Rosh Hashana%" → rosh_hashanah tag
      ↓
Metadata: total_days=2, yom_tov_level=1
      ↓
Day Number Extraction: "I" → 1
      ↓
ActiveEvent: {
  EventCode: "rosh_hashanah",
  DayNumber: 1,
  TotalDays: 2,
  IsFinalDay: false
}
```

## Benefits

1. **Zero Hardcoded Logic** - All event knowledge in database
2. **Single Source of Truth** - Database patterns drive behavior
3. **Easy Maintenance** - Add new events via SQL, no code changes
4. **Consistent Behavior** - Same pattern matching across all endpoints
5. **Graceful Degradation** - Works without database (returns nil)
6. **Type Safety** - SQLc-generated queries with compile-time validation

## Files Modified

- `/home/daniel/repos/zmanim/api/internal/calendar/events.go`
- `/home/daniel/repos/zmanim/api/internal/calendar/db_adapter.go`
- `/home/daniel/repos/zmanim/api/internal/calendar/hebrew.go`
- `/home/daniel/repos/zmanim/api/internal/handlers/calendar.go`
- `/home/daniel/repos/zmanim/api/internal/handlers/publisher_zmanim.go`

## Next Steps

Agent 2's work is complete. The system now uses pure database-driven event mapping with no hardcoded logic.
