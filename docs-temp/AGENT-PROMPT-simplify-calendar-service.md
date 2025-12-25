# Agent Prompt: Simplify Calendar Service (No Database Metadata)

## Mission

Remove all database metadata dependencies from the calendar service while preserving the simple 1-to-1 HebCal event → tag mapping.

## What's Been Done So Far

### ✅ Database Cleanup (Complete)
1. **Removed 4 metadata columns** from `zman_tags` table:
   - `yom_tov_level` - DELETED
   - `fast_start_type` - DELETED
   - `day_number` - DELETED
   - `total_days` - DELETED
   - Migration: `db/migrations/20251224240000_remove_unused_metadata_columns.sql` (APPLIED ✅)

2. **Cleaned up to 1-to-1 mapping**:
   - Migration: `db/migrations/20251224235000_clean_1to1_hebcal_mappings.sql` (APPLIED ✅)
   - Result: **50 HebCal events → 50 mappings → 40 unique tags**
   - Zero duplicates, zero ghost tags

3. **Deleted SQL queries that used metadata**:
   - `GetEventMetadata` - DELETED from `api/internal/db/queries/tag_events.sql`
   - `GetEventMetadataByKeys` - DELETED from `api/internal/db/queries/tag_events.sql`

4. **Remaining query** (still exists, keep this):
   - `GetTagForHebcalEventName` - Returns tag info (tag_key, display names) without metadata

### ✅ Go Code Cleanup (Partial)
1. **Deleted files**:
   - `api/internal/calendar/db_adapter.go` - DELETED

2. **Updated files**:
   - `api/internal/calendar/hebrew.go` - Removed `EventMetadata`, `HebcalTagMatch`, `Querier` structs

3. **Simplified functions**:
   - `detectSpecialContexts()` - Now uses HebCal's built-in `Yomtov` flag instead of database metadata

### ❌ Code That Still Needs Fixing

**Files that WON'T compile:**
1. `api/internal/calendar/events.go`:
   - Line 282: `holidayToActiveEvent()` - Calls deleted `GetEventCodeFromHebcal()`
   - Line 328: `GetEventCodeFromHebcal()` - Calls deleted database queries
   - Line 124, 155, 199: Calls to `holidayToActiveEvent()` will fail

2. `api/internal/handlers/publisher_zmanim.go`:
   - Creates `DBAdapter` (deleted)
   - Calls `NewCalendarServiceWithDB(dbAdapter)` (function signature changed)

3. `api/internal/handlers/calendar.go`:
   - May have similar issues

---

## Your Task

### Goal: Make Calendar Service Work WITHOUT Metadata

**Requirements:**
1. **No database metadata** - Don't query/use `yom_tov_level`, `fast_start_type`, `day_number`, `total_days`
2. **Keep 1-to-1 tag mapping** - HebCal events still map to tags via `GetTagForHebcalEventName` query
3. **Simple defaults** - Use hardcoded defaults for missing metadata
4. **Code must compile** - Fix all broken references

---

## Step-by-Step Implementation Plan

### Phase 1: Simplify Calendar Service (30 min)

**File:** `api/internal/calendar/events.go`

#### 1.1: Delete `GetEventCodeFromHebcal()` function (lines 326-351)

This function queries deleted database methods. DELETE IT ENTIRELY.

#### 1.2: Simplify `holidayToActiveEvent()` function (lines 281-324)

**Current (broken):**
```go
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location, transliterationStyle string) *ActiveEvent {
    tagMatch, metadata := s.GetEventCodeFromHebcal(h.Name, hd, loc.IsIsrael)  // BROKEN
    if tagMatch == nil {
        return nil
    }
    // Uses metadata.DurationDaysIsrael, metadata.FastStartType, etc.
}
```

**Replace with (simple):**
```go
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location, transliterationStyle string) *ActiveEvent {
    // Simple approach: Just use the HebCal event name directly as the event code
    // Convert HebCal name to tag_key format: lowercase, replace spaces with underscores
    eventCode := strings.ToLower(strings.ReplaceAll(h.Name, " ", "_"))
    eventCode = strings.ReplaceAll(eventCode, "'", "")  // Remove apostrophes

    // Use HebCal's own display names
    hebrewName := h.NameHebrew
    englishName := h.Name

    // Simple defaults (no metadata needed)
    dayNum := extractDayNumber(h.Name, 1)  // Extracts from Roman numerals in name
    totalDays := 1  // Default to 1 day

    // Detect multi-day from HebCal name patterns
    if strings.Contains(h.Name, "Chanukah") {
        totalDays = 8
    } else if strings.Contains(h.Name, "Rosh Hashana") {
        totalDays = 2
    } else if strings.Contains(h.Name, "Pesach") && !strings.Contains(h.Name, "CH''M") {
        totalDays = 2  // Pesach I/II or VII/VIII are yom tov days
    } else if strings.Contains(h.Name, "Sukkot") && !strings.Contains(h.Name, "CH''M") {
        totalDays = 2  // Sukkot I/II
    }

    return &ActiveEvent{
        EventCode:     eventCode,
        NameHebrew:    hebrewName,
        NameEnglish:   englishName,
        DayNumber:     dayNum,
        TotalDays:     totalDays,
        IsFinalDay:    dayNum == totalDays,
        FastStartType: "",  // Not needed without metadata
    }
}
```

**Key Changes:**
- No database queries
- Event code derived from HebCal name (simple string transformation)
- Hardcoded defaults for multi-day events
- Uses HebCal's own display names

**Alternative (if you want database tag lookup):**

If you want to preserve the tag_key lookup from database:

```go
func (s *CalendarService) holidayToActiveEvent(h Holiday, hd hdate.HDate, loc Location, transliterationStyle string) *ActiveEvent {
    // Optional: Query database for tag_key (if you want DB lookup)
    // For now, skip this and use simple name transformation

    eventCode := normalizeHebcalEventName(h.Name)

    return &ActiveEvent{
        EventCode:     eventCode,
        NameHebrew:    h.NameHebrew,
        NameEnglish:   h.Name,
        DayNumber:     extractDayNumber(h.Name, 1),
        TotalDays:     1,  // Simple default
        IsFinalDay:    true,
        FastStartType: "",
    }
}

func normalizeHebcalEventName(name string) string {
    // Convert "Rosh Hashana I" → "rosh_hashanah"
    // Convert "Chanukah: 3 Candles" → "chanukah"
    // Convert "Pesach VII" → "pesach"

    s := strings.ToLower(name)
    s = strings.Split(s, ":")[0]  // Remove ": X Candles" suffix
    s = strings.Split(s, " i")[0]  // Remove " I", " II" suffix (before 'i')
    s = strings.Split(s, " v")[0]  // Remove " V", " VII" suffix
    s = strings.TrimSpace(s)
    s = strings.ReplaceAll(s, " ", "_")
    s = strings.ReplaceAll(s, "'", "")
    return s
}
```

**Choose whichever approach you prefer.** The first is simpler (no DB), the second preserves tag lookup.

---

### Phase 2: Fix Handler Imports (15 min)

**Files:**
- `api/internal/handlers/publisher_zmanim.go`
- `api/internal/handlers/calendar.go`
- `api/internal/handlers/zmanim.go`

#### 2.1: Remove DBAdapter usage

**Find and replace:**
```go
// OLD (broken)
dbAdapter := calendar.NewDBAdapter(h.db.Queries)
calService := calendar.NewCalendarServiceWithDB(dbAdapter)

// NEW (simple)
calService := calendar.NewCalendarService()
```

#### 2.2: Remove imports if unused

After removing `DBAdapter` usage, check if any imports are no longer needed.

---

### Phase 3: Run SQLc Generate (5 min)

```bash
cd api
sqlc generate
```

This will regenerate Go code from SQL queries. Since we deleted `GetEventMetadata` and `GetEventMetadataByKeys`, SQLc will remove the generated functions.

---

### Phase 4: Build and Verify (10 min)

```bash
cd api
go build ./cmd/api
```

**Expected result:** Clean build with no errors

If there are compilation errors, fix them by:
1. Removing references to deleted structs (`EventMetadata`, `HebcalTagMatch`, `DBAdapter`)
2. Updating function signatures that changed

---

### Phase 5: Test Basic Functionality (15 min)

```bash
# Start services
./restart.sh

# Test basic endpoint
curl -s http://localhost:8080/api/v1/publishers | jq '.'

# Test calendar functionality (should still work without metadata)
source api/.env
TOKEN=$(node scripts/get-test-token.js | grep eyJ | head -1)
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-25" | jq '.day_context'
```

**Expected:** Should return day context with events, even without metadata.

---

## Validation Checklist

- [ ] Code compiles: `go build ./cmd/api` (exit code 0)
- [ ] No references to deleted structs: `grep -r "EventMetadata\|HebcalTagMatch\|DBAdapter" api/internal/calendar`
- [ ] No references to deleted queries: `grep -r "GetEventMetadata" api/internal`
- [ ] Services start: `./restart.sh` (no errors)
- [ ] API responds: `curl http://localhost:8080/api/v1/publishers` (returns JSON)
- [ ] Calendar events work: Day context returns events for test dates

---

## Key Decisions for You

**Decision 1: Event Code Mapping**

Choose one:
- **A) Simple string transformation** (no database) - Convert "Rosh Hashana I" → "rosh_hashanah" via string manipulation
- **B) Database tag lookup** (preserve tag mapping) - Query `GetTagForHebcalEventName` to get tag_key

**Recommendation:** Start with A (simple), add B later if needed.

**Decision 2: Multi-Day Event Handling**

Without `total_days` metadata, how do you determine event duration?

Options:
- **A) Hardcode known multi-day events** (Chanukah=8, RH=2, Pesach yom tov=2)
- **B) Always use 1 day** (simplest, may lose some info)
- **C) Infer from HebCal name** (e.g., "Chanukah: 3 Candles" → day 3 of 8)

**Recommendation:** Start with B (always 1 day), add A if needed.

---

## Files You'll Modify

1. `api/internal/calendar/events.go` - Delete/simplify functions
2. `api/internal/handlers/publisher_zmanim.go` - Remove DBAdapter
3. `api/internal/handlers/calendar.go` - Remove DBAdapter (if used)
4. `api/internal/handlers/zmanim.go` - Verify no DBAdapter usage

## Files You Won't Touch

- `db/migrations/*` - Already applied
- `api/internal/db/queries/tag_events.sql` - Already cleaned
- `api/internal/calendar/hebrew.go` - Already cleaned
- `api/internal/calendar/category_mappings.go` - Don't touch (recently modified)

---

## Expected Timeline

- Phase 1: 30 min (simplify events.go)
- Phase 2: 15 min (fix handlers)
- Phase 3: 5 min (sqlc generate)
- Phase 4: 10 min (build/verify)
- Phase 5: 15 min (test)

**Total: ~75 minutes**

---

## Success Criteria

✅ Code compiles without errors
✅ No references to deleted metadata structs/functions
✅ Services start and respond to API requests
✅ Calendar events still work (even with simple defaults)
✅ Clean, simple code with no database metadata complexity

---

## Notes

- **Keep it simple** - No need to recreate the metadata system
- **Use HebCal's data** - HebCal library already has Yomtov flag, category, etc.
- **Hardcode sparingly** - Only for obvious cases (Chanukah=8 days)
- **Test as you go** - Compile after each major change

---

## Questions?

If you're unsure about a decision, choose the **simplest option** and document it. We can always add complexity later if needed.

**Remember:** The goal is a working system WITHOUT metadata, not a perfect system. Simple and working beats complex and broken.

Good luck! 🚀
