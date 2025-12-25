# Clarification Needed: Calendar Service Database Dependency

## Current State

After removing the 4 metadata columns (`yom_tov_level`, `fast_start_type`, `day_number`, `total_days`), the calendar service no longer compiles because it depends on:

1. `DBAdapter` - deleted
2. `GetEventMetadata()` SQL query - deleted
3. `GetEventMetadataByKeys()` SQL query - deleted
4. `EventMetadata` struct - deleted

## Two Options

### Option 1: Keep Tag Mapping (Recommended)

**What:** Calendar service still queries database to map HebCal events → tags, but WITHOUT metadata

**Implementation:**
- Keep `GetTagForHebcalEventName` query (maps HebCal event → tag_key)
- Remove all metadata queries/structs
- `holidayToActiveEvent()` returns basic ActiveEvent with just:
  - `EventCode` (tag_key)
  - `NameHebrew`, `NameEnglish` (from tag display names)
  - `DayNumber`, `TotalDays` = defaults (1, 1)
  - No `FastStartType`

**Result:**
- HebCal events still map to your clean 50 tags
- No metadata complexity
- Handlers can filter zmanim by event tags

### Option 2: No Database Dependency

**What:** Calendar service becomes pure HebCal wrapper with NO tag mapping

**Implementation:**
- Remove all database queries
- `GetEventDayInfo()` returns HebCal holidays as-is
- No ActiveEvent conversion
- No tag mapping

**Result:**
- Simple, no database dependency
- But handlers can't filter zmanim by tags
- Loses the tag-driven architecture you just built

## Question

Which option do you prefer?

**I recommend Option 1** - keep the tag mapping (it's why we cleaned up to 1-to-1), just remove the metadata complexity.
