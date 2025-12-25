# Simplification: Remove Event Metadata System

## Decision

Remove the 4 metadata columns that were added for eliminating hardcoded logic:
- `yom_tov_level`
- `fast_start_type`
- `day_number`
- `total_days`

## Rationale

These columns were added by Agent 1 to support database-driven event logic, but they add unnecessary complexity. The core HebCal tag mapping works without them.

## What to Remove

### Database Columns (DONE ✅)
- Migration created: `20251224240000_remove_unused_metadata_columns.sql`
- Columns dropped from `zman_tags` table

### SQL Queries (DONE ✅)
- Deleted `GetEventMetadata` query
- Deleted `GetEventMetadataByKeys` query

### Go Code (TODO)
Files that need updating:
1. `api/internal/calendar/db_adapter.go` - Delete entirely
2. `api/internal/calendar/hebrew.go` - Remove `EventMetadata` struct and `Querier` interface
3. `api/internal/calendar/events.go` - Simplify `detectSpecialContexts()` and `GetEventCodeFromHebcal()`
4. `api/internal/handlers/*.go` - Remove DBAdapter usage
5. Test files - Update or remove metadata tests

## Simplified Approach

**Before (complex):**
```go
metadata, err := s.db.GetEventMetadata(ctx, tagKey)
if metadata.YomTovLevel > 0 {
    // Yom Tov logic
}
```

**After (simple):**
```go
// Just map HebCal event → tag, no metadata needed
tagMatch, err := s.db.GetTagForHebcalEventName(ctx, hebcalEventName)
```

The `detectSpecialContexts()` function can be removed or simplified to not need metadata.

## Impact

- **Simpler schema** - Only tag mapping, no metadata
- **Less code** - Remove adapter layer
- **Same functionality** - HebCal → tag mapping still works
- **Potential loss** - Special context detection may need different approach

Do you want me to proceed with removing all this metadata code?
