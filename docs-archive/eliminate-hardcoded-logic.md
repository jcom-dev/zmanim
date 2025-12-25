# Migration Guide: Eliminate Hardcoded Event Logic

**Date**: 2025-12-24
**Status**: Completed
**Breaking Changes**: Internal APIs only (no external impact)

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Migration Checklist](#migration-checklist)
4. [Before & After Code Examples](#before--after-code-examples)
5. [Breaking Changes](#breaking-changes)
6. [Rollback Procedure](#rollback-procedure)
7. [Validation](#validation)

---

## Overview

This migration eliminates ALL hardcoded event filtering logic from the codebase, replacing it with a pure tag-driven architecture where:

- **Before**: Event display logic scattered across handlers with hardcoded boolean flags
- **After**: Single source of truth (`ActiveEventCodes`) with database-driven tag matching

### Goals Achieved

1. Removed hardcoded category flags (`ShowCandleLighting`, `ShowHavdalah`, etc.)
2. Consolidated filtering logic into single service function (`ShouldShowZman`)
3. Moved event mappings from code to database (`tag_event_mappings` table)
4. Enabled zero-code deployments for new events (SQL only)

---

## What Changed

### Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `api/internal/calendar/events.go` | Modified | Removed `ShowCandleLighting`, `ShowHavdalah`, etc. from `ZmanimContext` |
| `api/internal/services/zmanim_service.go` | Modified | Changed `CalculateParams` to use `ActiveEventCodes` instead of `DayContext` |
| `api/internal/services/zmanim_service.go` | Modified | Simplified `ShouldShowZman()` to only check event tags |
| `api/internal/handlers/publisher_zmanim.go` | Modified | Removed `shouldShowZman()` function and all post-calculation filtering |
| `api/internal/handlers/zmanim.go` | Modified | Updated to pass `ActiveEventCodes` to service |
| `db/migrations/20251224210000_sync_hebcal_events.sql` | Created | Synced HebCal events with database patterns |
| `api/internal/db/queries/tag_events.sql` | Created | Added queries for tag event mappings |

### What Was Deleted

1. **Hardcoded Boolean Flags**:
   - `ShowCandleLighting` - replaced by `"erev_shabbos"` in `ActiveEventCodes`
   - `ShowHavdalah` - replaced by `"motzei_shabbos"` in `ActiveEventCodes`
   - `ShowFastStart` - replaced by `"fast_day"` in `ActiveEventCodes`
   - `ShowFastEnd` - replaced by `"fast_day"` in `ActiveEventCodes`

2. **Hardcoded Category Mappings**:
   ```go
   // DELETED from zmanim_service.go
   categoryFlagMap := map[string]bool{
       "category_candle_lighting": dayCtx.ShowCandleLighting,
       "category_havdalah":        dayCtx.ShowHavdalah,
       "category_fast_start":      dayCtx.ShowFastStart,
       "category_fast_end":        dayCtx.ShowFastEnd,
   }
   ```

3. **Post-Calculation Filtering**:
   ```go
   // DELETED from publisher_zmanim.go
   func (h *PublisherHandler) shouldShowZman(metadata PublisherZmanMetadata, dayCtx DayContext) bool {
       // ... entire function deleted
   }
   ```

### What Was Added

1. **Tag Event Mappings Table** - Database-driven event patterns
2. **SQL Queries** - Type-safe queries for tag matching
3. **Validation Scripts** - Automated coverage checking

---

## Migration Checklist

### Phase 1: Database Migration

- [x] Apply migration `20251224210000_sync_hebcal_events.sql`
- [x] Verify 100% HebCal coverage with validation script
- [x] Check for duplicate or conflicting patterns
- [x] Validate apostrophe normalization (straight vs curly quotes)

```bash
# Apply migration
source api/.env
psql "$DATABASE_URL" -f db/migrations/20251224210000_sync_hebcal_events.sql

# Validate coverage
./scripts/validate-hebcal-coverage.sh 5786
# Expected: Coverage: 100.00%
```

### Phase 2: Code Changes

- [x] Remove `Show*` fields from `calendar.ZmanimContext`
- [x] Change `services.CalculateParams.DayContext` to `ActiveEventCodes`
- [x] Update `ShouldShowZman()` to only check event tags
- [x] Remove post-calculation filtering from handlers
- [x] Delete `shouldShowZman()` function from handlers
- [x] Run `sqlc generate` for new queries

```bash
# Generate type-safe Go code from SQL
cd api
sqlc generate
```

### Phase 3: Testing

- [x] Friday: Candle lighting shows
- [x] Wednesday: Candle lighting does NOT show
- [x] Saturday: Havdalah shows
- [x] Regular zmanim always show (no event tags)
- [x] Fast day: Fast start/end show
- [x] Weekly PDF has correct event sections

```bash
# Test Friday (erev Shabbos)
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26" | \
  jq '.data.zmanim[] | select(.zman_key == "hadlakas_neiros")'

# Test Wednesday (regular day)
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24" | \
  jq '.data.zmanim[] | select(.zman_key == "hadlakas_neiros")'
# Should be empty (no candle lighting on Wednesday)
```

### Phase 4: Code Quality Validation

- [x] No `ShowCandleLighting` references in code
- [x] No `ShowHavdalah` references in code
- [x] No `categoryFlagMap` in service
- [x] No `shouldShowZman` in handlers
- [x] All event mappings in database
- [x] Tests pass

```bash
# Verify no hardcoded flags remain
grep -r "ShowCandleLighting" api/internal/
grep -r "ShowHavdalah" api/internal/
grep -r "categoryFlagMap" api/internal/
grep -r "shouldShowZman" api/internal/handlers/

# All should return: no results
```

---

## Before & After Code Examples

### Example 1: Calendar Service Context

#### Before (WRONG)
```go
// api/internal/calendar/events.go

type ZmanimContext struct {
    ShowCandleLighting bool     // ❌ Hardcoded
    ShowHavdalah       bool     // ❌ Hardcoded
    ShowFastStarts     bool     // ❌ Hardcoded
    ShowFastEnds       bool     // ❌ Hardcoded
    ActiveEventCodes   []string // Correct but drowned in noise
}

func (s *CalendarService) GetZmanimContext(...) ZmanimContext {
    // Hardcoded logic to set boolean flags
    ctx := ZmanimContext{
        ShowCandleLighting: isErevShabbos || isErevYomTov,
        ShowHavdalah:       isMoetzeiShabbos || isMoetzeiYomTov,
        ShowFastStarts:     isFastDay,
        ShowFastEnds:       isFastDay,
        ActiveEventCodes:   eventCodes,
    }
    return ctx
}
```

#### After (CORRECT)
```go
// api/internal/calendar/events.go

type ZmanimContext struct {
    ActiveEventCodes []string // ✅ ONLY field needed for filtering
    // Display-only fields (for JSON response metadata):
    IsShabbat bool
    IsYomTov  bool
    IsFastDay bool
    // ... other metadata
}

func (s *CalendarService) GetEventDayInfo(...) EventDayInfo {
    // NO boolean flags - just return event codes
    eventCodes := s.matchEventsToTags(hebcalEvents)

    // Add day-of-week codes
    if date.Weekday() == time.Friday {
        eventCodes = append(eventCodes, "erev_shabbos")
    }
    if date.Weekday() == time.Saturday {
        eventCodes = append(eventCodes, "shabbos", "motzei_shabbos")
    }

    return EventDayInfo{
        ActiveEvents: activeEvents,
        // ActiveEventCodes implicitly available from ActiveEvents
    }
}
```

### Example 2: Service Filtering

#### Before (WRONG)
```go
// api/internal/services/zmanim_service.go

type CalculateParams struct {
    PublisherID int32
    LocalityID  int64
    Date        time.Time
    DayContext  *DayContext  // ❌ Complex struct with hardcoded flags
}

type DayContext struct {
    ShowCandleLighting bool
    ShowHavdalah       bool
    ShowFastStart      bool
    ShowFastEnd        bool
    ActiveEventCodes   []string
}

func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, dayCtx DayContext) bool {
    // ❌ Hardcoded category checking
    categoryFlagMap := map[string]bool{
        "category_candle_lighting": dayCtx.ShowCandleLighting,
        "category_havdalah":        dayCtx.ShowHavdalah,
        "category_fast_start":      dayCtx.ShowFastStart,
        "category_fast_end":        dayCtx.ShowFastEnd,
    }

    for _, tag := range tags {
        if tag.TagType == "category" {
            if shouldShow, exists := categoryFlagMap[tag.TagKey]; exists {
                if !shouldShow {
                    return false  // ❌ Category-based filtering
                }
            }
        }
    }
    // ... event checking
}
```

#### After (CORRECT)
```go
// api/internal/services/zmanim_service.go

type CalculateParams struct {
    PublisherID      int32
    LocalityID       int64
    Date             time.Time
    ActiveEventCodes []string  // ✅ Simple list, no complex struct
}

func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // ✅ ONLY check event tags - no category checking
    eventTags := []EventFilterTag{}
    for _, tag := range tags {
        if tag.TagType == "event" {
            eventTags = append(eventTags, tag)
        }
    }

    // No event tags = always show
    if len(eventTags) == 0 {
        return true
    }

    // Check negated tags first
    for _, tag := range eventTags {
        if tag.IsNegated && sliceContains(activeEventCodes, tag.TagKey) {
            return false
        }
    }

    // Check positive tags
    hasPositiveTags := false
    hasPositiveMatch := false
    for _, tag := range eventTags {
        if !tag.IsNegated {
            hasPositiveTags = true
            if sliceContains(activeEventCodes, tag.TagKey) {
                hasPositiveMatch = true
                break
            }
        }
    }

    return !hasPositiveTags || hasPositiveMatch
}
```

### Example 3: Handler Filtering

#### Before (WRONG)
```go
// api/internal/handlers/publisher_zmanim.go

// Build complex DayContext with hardcoded flags
dayCtx := DayContext{
    ShowCandleLighting: zmanimCtx.ShowCandleLighting,  // ❌ Hardcoded
    ShowHavdalah:       zmanimCtx.ShowHavdalah,        // ❌ Hardcoded
    ShowFastStart:      zmanimCtx.ShowFastStarts,      // ❌ Hardcoded
    ShowFastEnd:        zmanimCtx.ShowFastEnds,        // ❌ Hardcoded
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes,
}

// Call service
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    PublisherID: publisherID,
    LocalityID:  localityID,
    Date:        date,
    DayContext:  &dayCtx,  // ❌ Passing complex struct
})

// ❌ POST-CALCULATION FILTERING (inefficient!)
for _, zman := range calcResult.Zmanim {
    isActiveToday := h.shouldShowZman(metadata, dayCtx)
    if !isActiveToday && !includeInactive {
        continue  // Already wasted calculation!
    }
    responseZmanim = append(responseZmanim, zman)
}

// ❌ Hardcoded filtering function
func (h *PublisherHandler) shouldShowZman(metadata PublisherZmanMetadata, dayCtx DayContext) bool {
    // ... complex hardcoded logic
}
```

#### After (CORRECT)
```go
// api/internal/handlers/publisher_zmanim.go

// Get event info from calendar
eventInfo := calService.GetEventDayInfo(date, loc, translitStyle)

// Extract active event codes
activeEventCodes := []string{}
for _, event := range eventInfo.ActiveEvents {
    activeEventCodes = appendUnique(activeEventCodes, event.EventCode)
}
for _, event := range eventInfo.ErevEvents {
    activeEventCodes = appendUnique(activeEventCodes, event.EventCode)
}
for _, event := range eventInfo.MoetzeiEvents {
    activeEventCodes = appendUnique(activeEventCodes, event.EventCode)
}

// ✅ Pass simple event codes to service
calcResult, err := h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    PublisherID:      publisherID,
    LocalityID:       localityID,
    Date:            date,
    ActiveEventCodes: activeEventCodes,  // ✅ Simple list
})

// ✅ NO POST-FILTERING - service already filtered!
// Just use calcResult.Zmanim directly
response := map[string]interface{}{
    "data": map[string]interface{}{
        "day_context": eventInfo,
        "zmanim":      calcResult.Zmanim,  // Already filtered
    },
}
```

### Example 4: Database Event Mappings

#### Before (WRONG)
```go
// api/internal/calendar/events.go

// ❌ Hardcoded in Go code
func mapHolidayToEventCode(name string, hd HebrewDate, isIsrael bool) (string, int, int) {
    switch {
    case strings.HasPrefix(name, "Rosh Hashana"):
        return "rosh_hashanah", 1, 2
    case strings.HasPrefix(name, "Yom Kippur"):
        return "yom_kippur", 1, 1
    case strings.HasPrefix(name, "Chanukah"):
        // Extract candle number...
        if strings.Contains(name, "1 Candle") {
            return "chanukah", 1, 8
        }
        // ... 100+ lines of hardcoded logic
    }
    return "", 0, 0
}
```

#### After (CORRECT)
```sql
-- db/migrations/20251224210000_sync_hebcal_events.sql

-- ✅ Database-driven patterns
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority, yom_tov_level)
VALUES
    ((SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'),
     'Rosh Hashana%', 10, 1),

    ((SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'),
     'Yom Kippur', 10, 1),

    ((SELECT id FROM zman_tags WHERE tag_key = 'chanukah_day_1'),
     'Chanukah: 1 Candle', 10, NULL),

    ((SELECT id FROM zman_tags WHERE tag_key = 'chanukah'),
     'Chanukah%', 50, NULL);  -- Generic pattern, lower priority
```

```go
// api/internal/calendar/hebcal.go

// ✅ Database-driven matching (simplified)
func (s *CalendarService) matchEventsToTags(events []HebCalEvent) []string {
    // Load mappings from database
    mappings := s.loadTagEventMappings()

    matched := []string{}
    for _, event := range events {
        for _, mapping := range mappings {
            if matchPattern(event.Title, mapping.Pattern) {
                matched = appendUnique(matched, mapping.TagKey)
            }
        }
    }
    return matched
}
```

---

## Breaking Changes

### Internal APIs Only

All breaking changes are **internal** - no external API changes:

1. **Service Method Signature Changed**:
   ```go
   // Before
   CalculateZmanim(ctx, CalculateParams{..., DayContext: &dayCtx})

   // After
   CalculateZmanim(ctx, CalculateParams{..., ActiveEventCodes: []string{"erev_shabbos"}})
   ```

2. **Removed Handler Function**:
   ```go
   // Before
   shouldShowZman(metadata, dayCtx) bool  // ❌ DELETED

   // After
   // Function removed - no replacement needed (service handles filtering)
   ```

3. **Calendar Service Return Type**:
   ```go
   // Before
   GetZmanimContext(...) ZmanimContext  // Had ShowCandleLighting, etc.

   // After
   GetEventDayInfo(...) EventDayInfo     // Only has ActiveEvents
   ```

### No External Impact

- REST API endpoints unchanged
- Request/response JSON unchanged
- Frontend code unchanged
- Database schema extended (additive only - no deletions)

---

## Rollback Procedure

### If Issues Arise

**Step 1: Database Rollback** (if needed)

```bash
# Restore database from backup
source api/.env
psql "$DATABASE_URL" < backups/before_migration_$(date +%Y%m%d).sql
```

**Step 2: Code Rollback**

```bash
# Revert to previous commit
git log --oneline | grep -i "tag-driven"  # Find migration commit
git revert <commit-hash>

# Rebuild and restart
./restart.sh
```

**Step 3: Verify**

```bash
# Test that old behavior works
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26" | \
  jq '.data.zmanim | length'

# Should return normal number of zmanim
```

### Rollback Not Recommended

This migration is **additive and corrective**:
- Adds new database tables/columns (doesn't delete existing data)
- Fixes bugs (incorrect event mappings)
- Improves architecture (removes hardcoded logic)

**Forward fixes are preferred over rollback**.

---

## Validation

### Automated Validation

```bash
# 1. HebCal coverage check
./scripts/validate-hebcal-coverage.sh 5786
# Expected: Coverage: 100.00%

# 2. Code quality checks
./scripts/validate-ci-checks.sh
# Expected: All checks pass

# 3. Run tests
cd api
go test ./internal/services/...
cd ../web
npm run type-check
```

### Manual Validation

#### Test 1: Friday Candle Lighting
```bash
# Friday Dec 26, 2025
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26" | \
  jq '.data | {active_codes: .day_context.active_event_codes, has_candle_lighting: ([.zmanim[].zman_key] | contains(["hadlakas_neiros"]))}'

# Expected:
# {
#   "active_codes": ["erev_shabbos"],
#   "has_candle_lighting": true
# }
```

#### Test 2: Wednesday No Candle Lighting
```bash
# Wednesday Dec 24, 2025
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24" | \
  jq '.data | {active_codes: .day_context.active_event_codes, has_candle_lighting: ([.zmanim[].zman_key] | contains(["hadlakas_neiros"]))}'

# Expected:
# {
#   "active_codes": [],
#   "has_candle_lighting": false
# }
```

#### Test 3: Saturday Havdalah
```bash
# Saturday Dec 27, 2025
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-27" | \
  jq '.data | {active_codes: .day_context.active_event_codes, has_havdalah: ([.zmanim[].zman_key] | contains(["havdalah"]))}'

# Expected:
# {
#   "active_codes": ["shabbos", "motzei_shabbos"],
#   "has_havdalah": true
# }
```

#### Test 4: Regular Zmanim Always Show
```bash
# Any date - shacharit should always appear
curl -s "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24" | \
  jq '.data.zmanim[] | select(.zman_key == "shacharit")'

# Expected: shacharit object returned (not empty)
```

### Database Validation

```sql
-- 1. Verify no hardcoded fields in queries
SELECT query_text
FROM pg_stat_statements
WHERE query_text LIKE '%ShowCandleLighting%'
   OR query_text LIKE '%ShowHavdalah%';
-- Expected: 0 rows

-- 2. Check tag event coverage
SELECT
    COUNT(*) FILTER (WHERE mapped) as mapped,
    COUNT(*) FILTER (WHERE NOT mapped) as unmapped,
    ROUND(100.0 * COUNT(*) FILTER (WHERE mapped) / COUNT(*), 2) as coverage
FROM (
    SELECT EXISTS (
        SELECT 1 FROM tag_event_mappings tem
        WHERE 'Chanukah: 3 Candles' LIKE tem.hebcal_event_pattern
    ) as mapped
) c;
-- Expected: coverage = 100.00

-- 3. Verify apostrophe normalization
SELECT hebcal_event_pattern
FROM tag_event_mappings
WHERE hebcal_event_pattern LIKE '%''%'  -- Fancy quote check
   OR hebcal_event_pattern LIKE '%''%';
-- Expected: 0 rows (all should be straight apostrophes)
```

---

## Success Criteria

Migration is complete when ALL of the following are true:

- [ ] Database migration applied successfully
- [ ] HebCal coverage validation shows 100%
- [ ] No `Show*` flags exist in codebase
- [ ] Service uses only `ActiveEventCodes` for filtering
- [ ] Handlers do NOT filter after calculation
- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] CI/CD pipeline green
- [ ] Production deployment successful

---

## Contact & Support

**Questions?** See:
- `/home/daniel/repos/zmanim/docs/architecture/tag-driven-events.md` - Architecture details
- `/home/daniel/repos/zmanim/TAG-DRIVEN-ARCHITECTURE.md` - Original design document
- `/home/daniel/repos/zmanim/PLAN-eliminate-hardcoded-event-logic.md` - Implementation plan

**Issues?**
- Check `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh` for coverage problems
- Review migration SQL: `/home/daniel/repos/zmanim/db/migrations/20251224210000_sync_hebcal_events.sql`
- Examine tag queries: `/home/daniel/repos/zmanim/api/internal/db/queries/tag_events.sql`
