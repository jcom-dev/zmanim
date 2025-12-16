# Story 1.7: Calculation Engine & Caching

Status: done

## Story

As the **system**,
I want **to calculate accurate zmanim times**,
so that **users receive correct prayer times based on publisher algorithms**.

## Acceptance Criteria

1. System calculates all standard zmanim for given location/date
2. Solar angle method calculates time when sun is N degrees below horizon
3. Fixed minutes method calculates time N minutes from sunrise/sunset
4. Proportional method calculates shaos zmaniyos (GRA or MGA base)
5. Formula details are included in response for each zman
6. Same calculation within 24hrs returns cached result (<100ms)
7. Algorithm publish invalidates publisher's cached calculations
8. Cache miss triggers calculation, caches result with 24hr TTL

## Tasks / Subtasks

- [x] Task 1: Create astronomy calculation package (AC: 1, 2, 3)
  - [x] 1.1 Create api/internal/astro/sun.go
  - [x] 1.2 Implement sunrise/sunset using NOAA algorithms
  - [x] 1.3 Create api/internal/astro/angles.go (combined in sun.go)
  - [x] 1.4 Implement solar depression angle calculations
  - [x] 1.5 Create api/internal/astro/times.go
  - [x] 1.6 Implement time arithmetic helpers

- [x] Task 2: Create algorithm parser (AC: 1, 5)
  - [x] 2.1 Create api/internal/algorithm/parser.go
  - [x] 2.2 Parse JSON DSL to Algorithm struct
  - [x] 2.3 Validate algorithm configuration
  - [x] 2.4 Extract formula metadata for each zman

- [x] Task 3: Create algorithm executor (AC: 1-4)
  - [x] 3.1 Create api/internal/algorithm/executor.go
  - [x] 3.2 Implement solar_angle method
  - [x] 3.3 Implement fixed_minutes method
  - [x] 3.4 Implement proportional method (GRA base)
  - [x] 3.5 Implement proportional method (MGA base)
  - [x] 3.6 Implement sunrise/sunset base methods
  - [x] 3.7 Implement midpoint calculation (chatzos)

- [x] Task 4: Create cache service (AC: 6-8)
  - [x] 4.1 Create api/internal/services/cache_service.go
  - [x] 4.2 Implement Upstash Redis REST client
  - [x] 4.3 Get with key format zmanim:{publisher}:{city}:{date}
  - [x] 4.4 Set with 24hr TTL
  - [x] 4.5 Implement InvalidatePublisher (pattern delete)
  - [x] 4.6 Handle cache unavailable gracefully

- [x] Task 5: Create zmanim service (AC: 1, 5-8)
  - [x] 5.1 Update api/internal/services/zmanim_service.go
  - [x] 5.2 Orchestrate: check cache → calculate → store
  - [x] 5.3 Include formula details in response
  - [x] 5.4 Handle missing algorithm (use default)

- [x] Task 6: Create zmanim API endpoint (AC: all)
  - [x] 6.1 Add handler in api/internal/handlers/zmanim.go
  - [x] 6.2 GET /api/v1/zmanim?cityId={}&publisherId={}&date={}
  - [x] 6.3 Validate parameters
  - [x] 6.4 Return zmanim list with formula details

- [x] Task 7: Write calculation tests (AC: 1-4)
  - [x] 7.1 Unit tests in api/internal/astro/sun_test.go
  - [x] 7.2 Test each calculation method
  - [x] 7.3 Verified against NOAA Solar Calculator reference
  - [x] 7.4 Playwright E2E tests for calculation accuracy

- [x] Task 8: Write cache tests (AC: 6-8)
  - [x] 8.1 Cache invalidation requires auth (401)
  - [x] 8.2 DELETE /api/v1/publisher/cache endpoint
  - [x] 8.3 Playwright E2E tests for cache behavior

## Dev Notes

### Architecture Patterns

- **Calculation Engine:** Pure Go implementation in api/internal/astro/
- **Algorithm DSL:** JSON format parsed to executable config
- **Caching:** Upstash Redis REST API with 24hr TTL
- **Cache Key:** `zmanim:{publisher_id}:{city_id}:{date}`

### Algorithm DSL Format

```json
{
  "name": "Custom Algorithm",
  "zmanim": {
    "alos": {"method": "solar_angle", "params": {"degrees": 16.1}},
    "sunrise": {"method": "sunrise", "params": {}},
    "sof_zman_shma": {"method": "proportional", "params": {"hours": 3, "base": "gra"}},
    "sunset": {"method": "sunset", "params": {}},
    "tzeis": {"method": "fixed_minutes", "params": {"minutes": 72, "from": "sunset"}}
  }
}
```

### Calculation Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| sunrise | Sunrise time | - |
| sunset | Sunset time | - |
| solar_angle | Sun N° below horizon | degrees |
| fixed_minutes | N minutes from base | minutes, from |
| proportional | Shaos zmaniyos | hours, base (gra/mga) |
| midpoint | Midpoint of two times | start, end |

### Response Format

```json
{
  "data": {
    "date": "2025-11-25",
    "timezone": "America/New_York",
    "zmanim": [
      {
        "name": "Alos HaShachar",
        "time": "05:23:00",
        "formula": {
          "method": "solar_angle",
          "display_name": "Solar Depression Angle",
          "parameters": {"degrees": 16.1},
          "explanation": "Dawn when sun is 16.1° below horizon"
        }
      }
    ]
  }
}
```

### References

- [Source: docs/architecture.md#ADR-001-Custom-Calculation-Engine]
- [Source: docs/architecture.md#ADR-003-Upstash-Redis-Caching]
- [Source: docs/epics.md#Story-1.7-Calculation-Engine-Caching]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.7]

## Dev Agent Record

### Context Reference
- NOAA Solar Calculator: https://gml.noaa.gov/grad/solcalc/calcdetails.html

### Agent Model Used
- Claude Code (claude-opus-4-5-20251101)

### Completion Notes List
- Implemented complete astronomy calculation engine from scratch using NOAA algorithms
- Created flexible algorithm DSL supporting solar_angle, fixed_minutes, proportional, and midpoint methods
- Fixed critical bug in hour angle sign logic (sunrise/sunset were swapped initially)
- All 19 Playwright E2E tests pass
- Unit tests verify calculations match expected values for Brooklyn, NY

### File List
- `api/internal/astro/sun.go` - NOAA-based sun position calculations (sunrise, sunset, solar noon)
- `api/internal/astro/times.go` - Time arithmetic helpers (shaos zmaniyos, addMinutes, etc.)
- `api/internal/astro/sun_test.go` - Unit tests for astronomical calculations
- `api/internal/algorithm/types.go` - Algorithm DSL types and default configuration
- `api/internal/algorithm/parser.go` - JSON algorithm parser and validator
- `api/internal/algorithm/executor.go` - Algorithm execution engine
- `api/internal/handlers/zmanim.go` - New GET /api/v1/zmanim endpoint with formula details
- `web/tests/calculation-engine.spec.ts` - 19 Playwright E2E tests covering all ACs
