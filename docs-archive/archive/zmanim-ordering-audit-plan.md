# Zmanim API Ordering Audit Plan

## Executive Summary

This document outlines findings from an audit of all API endpoints that return lists of zmanim or calculated times, and provides a remediation plan to ensure times are consistently returned in chronological order (by calculated time).

## Current State Analysis

### Ordering Approaches Currently in Use

The codebase uses **two different ordering strategies**:

1. **Category-based ordering** (SQL `ORDER BY time_category`): Used in database queries for publisher zmanim and registry endpoints
2. **Hardcoded key-based ordering** (Go `standardOrder` map): Used in the algorithm executor for calculated times

**Problem**: These approaches don't guarantee chronological order by actual calculated times. Times within the same category are sorted alphabetically by Hebrew name rather than by time value.

### Affected Endpoints

| Endpoint | Current Ordering | Returns Times? | Issue |
|----------|------------------|----------------|-------|
| `GET /zmanim` | Executor's hardcoded key order, then event zmanim appended | Yes | Event zmanim (candle_lighting, havdalah) appended at end, not sorted by time |
| `POST /zmanim` | Depends on zmanimService | Yes | Unknown ordering |
| `GET /publisher/zmanim` (with location) | Category + hebrew_name | Yes | Times within category not sorted chronologically |
| `GET /publisher/zmanim` (no location) | Category + hebrew_name | No | N/A - no times |
| `GET /publisher/zmanim/week` | Same as above per day | Yes | Same issue per day |
| `POST /publisher/algorithm/preview` | Executor's hardcoded key order | Yes | Limited key coverage, unknown zmanim go to end |
| `GET /registry/zmanim` | Category + hebrew_name | No | N/A - no times |
| `GET /registry/zmanim/grouped` | Category + hebrew_name | No | N/A - no times |
| `GET /registry/zmanim/events` | Category + hebrew_name | No | N/A - no times |
| `GET /zmanim/browse` | usage_count DESC, hebrew_name | No | N/A - popularity sort is intentional |
| `GET /publishers/{id}/zmanim` | Category + hebrew_name | No | N/A - no times |

## Issues Identified

### Issue 1: Event Zmanim Appended Without Re-sorting
**Location**: [zmanim.go:289-358](api/internal/handlers/zmanim.go#L289-L358)

When `candle_lighting` and `havdalah` are dynamically added in `GetZmanimForCity`, they are appended to the end of the response array without re-sorting. This means:
- Candle lighting (~18 min before sunset) appears AFTER tzeis (~42-72 min after sunset)
- Havdalah (~42 min after sunset) appears at the very end

### Issue 2: Executor Uses Static Key Order, Not Time Order
**Location**: [executor.go:253-291](api/internal/algorithm/executor.go#L253-L291)

The `getOrderedZmanimKeys` function uses a hardcoded map with only 14 known zman keys. Any zman not in this list gets order `100` and appears at the end. The order is conceptually chronological but:
- Limited coverage (only standard zmanim)
- Custom zmanim default to end
- No actual time-based sorting

### Issue 3: Category-Based Sorting Within Categories is Alphabetical
**Location**: [publisher_zmanim.go:538-550](api/internal/handlers/publisher_zmanim.go#L538-L550)

The SQL query sorts by `time_category` CASE expression then `hebrew_name`. Within the same category, zmanim appear alphabetically, not by calculated time.

### Issue 4: Filtered Zmanim Response Maintains Source Order
**Location**: [publisher_zmanim.go:594-644](api/internal/handlers/publisher_zmanim.go#L594-L644)

The `filterAndCalculateZmanim` function iterates through zmanim and calculates times, but doesn't re-sort after calculation. The result maintains the database order (category + hebrew_name).

## Proposed Solution

### Strategy: Sort by Calculated Time at Response Time

For endpoints that return calculated times, sort the response array by actual time values before returning. This ensures chronological order regardless of how the data was fetched or categories assigned.

### Implementation Plan

#### Phase 1: Create Time-Based Sorting Utilities

**File**: `api/internal/handlers/zmanim_sort.go` (new file)

```go
package handlers

import (
    "sort"
    "time"
)

// sortZmanimByTime sorts a slice of ZmanWithFormula by parsed time value
func sortZmanimByTime(zmanim []ZmanWithFormula) {
    sort.Slice(zmanim, func(i, j int) bool {
        ti, _ := parseTimeString(zmanim[i].Time)
        tj, _ := parseTimeString(zmanim[j].Time)
        return ti.Before(tj)
    })
}

// parseTimeString parses HH:MM:SS format to time.Time (uses today's date)
func parseTimeString(timeStr string) (time.Time, error) {
    return time.Parse("15:04:05", timeStr)
}

// sortPublisherZmanimByTime sorts PublisherZmanWithTime by time
func sortPublisherZmanimByTime(zmanim []PublisherZmanWithTime) {
    sort.Slice(zmanim, func(i, j int) bool {
        if zmanim[i].Time == nil {
            return false // nil times go to end
        }
        if zmanim[j].Time == nil {
            return true
        }
        ti, _ := parseTimeString(*zmanim[i].Time)
        tj, _ := parseTimeString(*zmanim[j].Time)
        return ti.Before(tj)
    })
}
```

#### Phase 2: Update `GET /zmanim` Endpoint

**File**: [api/internal/handlers/zmanim.go](api/internal/handlers/zmanim.go)

**Change**: Add sorting call after building response and before caching/returning

```go
// After line 358 (after havdalah is added), before line 360 (cache):
// Sort zmanim by calculated time for consistent chronological display
sortZmanimByTime(response.Zmanim)
```

#### Phase 3: Update `GET /publisher/zmanim` (with location)

**File**: [api/internal/handlers/publisher_zmanim.go](api/internal/handlers/publisher_zmanim.go)

**Change**: Add sorting in `filterAndCalculateZmanim` before returning

```go
// At end of filterAndCalculateZmanim, before return (line ~643):
// Sort by calculated time for chronological display
sortPublisherZmanimByTime(result)
return result
```

#### Phase 4: Update `GET /publisher/zmanim/week`

**File**: [api/internal/handlers/publisher_zmanim.go](api/internal/handlers/publisher_zmanim.go)

**Change**: Sorting already handled by Phase 3 (uses `filterAndCalculateZmanim`)

No additional changes needed - the helper function fix propagates automatically.

#### Phase 5: Update `POST /publisher/algorithm/preview`

**File**: [api/internal/handlers/publisher_algorithm.go](api/internal/handlers/publisher_algorithm.go)

**Change**: Add sorting after building response

```go
// After line 378 (end of for loop), before line 380 (RespondJSON):
// Sort preview results by calculated time
sortZmanimByTime(response.Zmanim)
```

#### Phase 6: Update Algorithm Executor (Optional Enhancement)

**File**: [api/internal/algorithm/executor.go](api/internal/algorithm/executor.go)

**Change**: Sort by calculated time instead of hardcoded key order

```go
// Replace getOrderedZmanimKeys implementation with time-based sorting
func (e *Executor) sortResultsByTime(results *ZmanimResults) {
    sort.Slice(results.Zmanim, func(i, j int) bool {
        return results.Zmanim[i].Time.Before(results.Zmanim[j].Time)
    })
}
```

### Summary of Changes

| File | Function/Location | Change |
|------|-------------------|--------|
| `handlers/zmanim_sort.go` | New file | Add sorting utilities |
| `handlers/zmanim.go` | `GetZmanimForCity` | Add `sortZmanimByTime()` before response |
| `handlers/publisher_zmanim.go` | `filterAndCalculateZmanim` | Add `sortPublisherZmanimByTime()` before return |
| `handlers/publisher_algorithm.go` | `PreviewAlgorithm` | Add `sortZmanimByTime()` before response |
| `algorithm/executor.go` | `Execute` (optional) | Replace key-based ordering with time-based |

### Testing Requirements

1. **Unit Tests**: Add tests for sorting utilities with edge cases (nil times, same times, empty arrays)
2. **Integration Tests**: Verify API responses are chronologically ordered
3. **E2E Tests**: Update existing tests to assert time ordering

### Migration Notes

- No database changes required
- No breaking API changes (response structure unchanged, only order differs)
- Cache invalidation not required (cache stores complete response which will be sorted on rebuild)

## Endpoints That Don't Need Changes

| Endpoint | Reason |
|----------|--------|
| `GET /publisher/zmanim` (no location) | Returns definitions, not calculated times |
| `GET /registry/zmanim` | Returns registry entries, not calculated times |
| `GET /registry/zmanim/grouped` | Returns grouped definitions, not times |
| `GET /registry/zmanim/events` | Returns event definitions, not times |
| `GET /zmanim/templates` | Returns templates, not times |
| `GET /zmanim/browse` | Intentionally sorted by popularity |
| `GET /publishers/{id}/zmanim` | Returns definitions for linking |

## Risks and Considerations

1. **Performance**: Sorting adds O(n log n) overhead, but n is typically <30 zmanim, so negligible
2. **Consistency**: Ensures all time-returning endpoints behave identically
3. **Cache Impact**: Cached responses will reflect old order until rebuilt (24hr TTL)

## Acceptance Criteria

- [ ] All endpoints returning calculated times return them in chronological order
- [ ] Event zmanim (candle_lighting, havdalah) appear in correct temporal position
- [ ] Zmanim with calculation errors (nil time) appear at end of list
- [ ] Tests validate chronological ordering
- [ ] No regression in existing functionality
