# Backend-Driven Zmanim Filtering

## Overview

This document describes the implementation of centralized backend filtering for zmanim (Jewish Zmanim). Previously, filtering logic was scattered across frontend and backend. Now all filtering is done server-side with a single source of truth.

## Problem Statement

Event zmanim (Candle Lighting, Havdalah, Fast times) were being filtered inconsistently:
- Frontend had `filterZmanimForDay` function in `AlgorithmPreview.tsx`
- Backend had separate logic in `calendar/events.go`
- Duplicated hebcal integration on both sides
- Caching was not properly invalidated

**User requirement**: "should do all filtering in the back end not front end - it should all be in 1 place - remove any front end filtering"

## Solution Architecture

### Enhanced `GetPublisherZmanim` Endpoint

**File**: `api/internal/handlers/publisher_zmanim.go`

The endpoint now accepts optional query parameters for filtered/preview mode:

```
GET /api/v1/publisher/zmanim
GET /api/v1/publisher/zmanim?date=2024-12-06&latitude=40.7128&longitude=-74.006&timezone=America/New_York
```

**Behavior**:
- **Without date params**: Returns all zmanim (original behavior for editor list)
- **With date params**: Returns filtered zmanim + day context + calculated times

### Response Types

```go
// DayContext contains day-specific information for zmanim filtering
type DayContext struct {
    Date                 string   `json:"date"`                   // YYYY-MM-DD
    DayOfWeek            int      `json:"day_of_week"`            // 0=Sunday, 6=Saturday
    DayName              string   `json:"day_name"`               // "Sunday", "Friday", etc.
    HebrewDate           string   `json:"hebrew_date"`            // "23 Kislev 5785"
    HebrewDateFormatted  string   `json:"hebrew_date_formatted"`  // Hebrew letters format
    IsErevShabbos        bool     `json:"is_erev_shabbos"`        // Friday
    IsShabbos            bool     `json:"is_shabbos"`             // Saturday
    IsYomTov             bool     `json:"is_yom_tov"`             // Yom Tov day
    IsFastDay            bool     `json:"is_fast_day"`            // Fast day
    Holidays             []string `json:"holidays"`               // Holiday names
    ActiveEventCodes     []string `json:"active_event_codes"`     // Event codes active today
    ShowCandleLighting   bool     `json:"show_candle_lighting"`   // Should show candle lighting
    ShowHavdalah         bool     `json:"show_havdalah"`          // Should show havdalah
    ShowFastStart        bool     `json:"show_fast_start"`        // Should show fast start
    ShowFastEnd          bool     `json:"show_fast_end"`          // Should show fast end
    SpecialContexts      []string `json:"special_contexts"`       // shabbos_to_yomtov, etc.
}

// PublisherZmanWithTime extends PublisherZman with calculated time
type PublisherZmanWithTime struct {
    PublisherZman
    Time  *string `json:"time,omitempty"`  // Calculated time HH:MM:SS
    Error *string `json:"error,omitempty"` // Error message if calculation failed
}

// FilteredZmanimResponse is returned when date/location params are provided
type FilteredZmanimResponse struct {
    DayContext DayContext              `json:"day_context"`
    Zmanim     []PublisherZmanWithTime `json:"zmanim"`
}
```

### Tag-Driven Filtering

Filtering is entirely driven by database tags - no hardcoded zman keys:

```go
func (h *Handlers) shouldShowZman(z PublisherZman, dayCtx DayContext) bool {
    // Check for behavior tags
    isCandleLighting := hasTagKey(z.Tags, "is_candle_lighting")
    isHavdalah := hasTagKey(z.Tags, "is_havdalah")
    isFastStart := hasTagKey(z.Tags, "is_fast_start")
    isFastEnd := hasTagKey(z.Tags, "is_fast_end")

    // If it's not an event zman (no behavior tags), always show it
    if !isCandleLighting && !isHavdalah && !isFastStart && !isFastEnd {
        return true
    }

    // Filter event zmanim based on day context
    if isCandleLighting && !dayCtx.ShowCandleLighting {
        return false
    }
    if isHavdalah && !dayCtx.ShowHavdalah {
        return false
    }
    if isFastStart && !dayCtx.ShowFastStart {
        return false
    }
    if isFastEnd && !dayCtx.ShowFastEnd {
        return false
    }

    return true
}
```

### Redis Caching

Results are cached by publisher + date + location with 24hr TTL:

```go
cacheKey := fmt.Sprintf("%s:%s:%.4f:%.4f", publisherID, dateStr, latitude, longitude)
```

### Cache Invalidation

Cache is invalidated when formula or is_enabled is updated:

```go
// In UpdatePublisherZman handler
if h.cache != nil && (req.FormulaDSL != nil || req.IsEnabled != nil) {
    if err := h.cache.InvalidateZmanim(ctx, publisherID); err != nil {
        slog.Warn("failed to invalidate zmanim cache", "error", err, "publisher_id", publisherID)
    }
}
```

## Frontend Changes

### AlgorithmPreview Component

**File**: `web/components/publisher/AlgorithmPreview.tsx`

The component was simplified:
- Removed `zmanim` prop - now fetches its own filtered data
- Removed `filterZmanimForDay` function
- Removed `hasTagKey` helper
- Removed debug console.logs
- Removed hebcal dependency for filtering (only kept for display badges)

**New behavior**:
```typescript
const loadPreview = useCallback(async () => {
  const params = new URLSearchParams({
    date: dateStr,
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    timezone: location.timezone,
  });

  const response = await api.get<FilteredZmanimResponse>(`/publisher/zmanim?${params}`);

  setDayContext(response.day_context);
  setPreview(response.zmanim || []);
}, [api, dateStr, location, hasCoverage]);
```

### Parent Component Updates

**File**: `web/app/publisher/algorithm/page.tsx`

Removed `zmanim` prop from `AlgorithmPreview` calls:

```tsx
<AlgorithmPreview
  location={previewLocation}
  selectedDate={previewDate}
  displayLanguage={displayLanguage}
  hasCoverage={coverageCities.length > 0 || coverageCountryCodes.length > 0}
/>
```

## Files Modified

1. **`api/internal/handlers/publisher_zmanim.go`**
   - Added `DayContext`, `PublisherZmanWithTime`, `FilteredZmanimResponse` types
   - Enhanced `GetPublisherZmanim` to accept optional date/location params
   - Added `fetchPublisherZmanim`, `filterAndCalculateZmanim`, `shouldShowZman`, `hasTagKey` helpers
   - Added cache invalidation in `UpdatePublisherZman`

2. **`api/internal/handlers/master_registry.go`**
   - Added `TagKey` field to `ZmanTag` struct

3. **`web/components/publisher/AlgorithmPreview.tsx`**
   - Complete rewrite to use backend filtering
   - Removed all frontend filtering logic

4. **`web/app/publisher/algorithm/page.tsx`**
   - Removed `zmanim` prop from `AlgorithmPreview` calls

## Database Tags Used for Filtering

The following behavior tags control which zmanim appear on which days:

| Tag Key | Purpose |
|---------|---------|
| `is_candle_lighting` | Shows on Erev Shabbos, Erev Yom Tov |
| `is_havdalah` | Shows on Motzei Shabbos, Motzei Yom Tov |
| `is_fast_start` | Shows on fast days (dawn or sunset start) |
| `is_fast_end` | Shows on fast days |

## Benefits

1. **Single source of truth** - All filtering logic in backend
2. **Reusable** - Same endpoint can power preview week, home page, etc.
3. **Cached** - Redis caching improves performance
4. **Tag-driven** - No hardcoded zman keys - everything controlled by database tags
5. **Consistent** - Frontend and backend always agree on what to show

## Testing

To test the endpoint directly:

```bash
# Without date params (returns all zmanim)
curl "http://localhost:8080/api/v1/publisher/zmanim" \
  -H "Authorization: Bearer <token>" \
  -H "X-Publisher-Id: <publisher_id>"

# With date params (returns filtered zmanim)
curl "http://localhost:8080/api/v1/publisher/zmanim?date=2024-12-06&latitude=40.7128&longitude=-74.006&timezone=America/New_York" \
  -H "Authorization: Bearer <token>" \
  -H "X-Publisher-Id: <publisher_id>"
```

## Known Issues / TODO

1. **API restart required** - After code changes, ensure the API is restarted (`./restart.sh`)
2. **Cache key format** - Consider if timezone should be part of cache key
3. **Week preview** - Can reuse this endpoint by calling 7 times (once per day)
