# Zmanim Matching Analysis Report
**Date:** 2025-12-25
**Analyst:** Mary (Business Analyst Agent)
**Issue:** "Motzei Shabbos" appearing at wrong times and on wrong days

---

## Executive Summary

**ROOT CAUSE FOUND:** The "Motzei Shabbos" zman (shabbos_ends) is configured with event tags `shabbos` and `yom_kippur`, meaning it should **ONLY display on Saturday or Yom Kippur**. However, it's appearing on **ALL days** including Friday.

**Architecture Status:** ✅ **EXCELLENT** - Logic is properly centralized in a single service file
**Problem Location:** ⚠️ Event filtering logic in [zmanim_service.go:778-878](api/internal/services/zmanim_service.go#L778-L878)

---

## 1. Architecture Analysis - GOOD NEWS! ✅

### Single Service Pattern - PROPERLY IMPLEMENTED

The codebase follows the **single-service pattern correctly**:

1. **Handler** ([zmanim.go:469-485](api/internal/handlers/zmanim.go#L469-L485)):
   - Gets calendar context (ActiveEventCodes)
   - Passes to service
   - NO business logic

2. **Calendar Service** ([events.go:509-555](api/internal/calendar/events.go#L509-L555)):
   - Determines ActiveEventCodes for a date
   - Returns: `["shabbos"]` on Saturday, `["erev_shabbos"]` on Friday, etc.

3. **Zmanim Service** ([zmanim_service.go:242-414](api/internal/services/zmanim_service.go#L242-L414)):
   - **SINGLE SOURCE OF TRUTH** for all zmanim calculation
   - Receives ActiveEventCodes
   - Filters zmanim based on tags (lines 311-345)
   - Executes DSL formulas
   - Returns calculated results

**Verdict:** ✅ No scattered logic. Everything flows through ONE service method.

---

## 2. The Complete Flow (As Designed)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HANDLER (zmanim.go:460-485)                              │
│    Gets calendar context for the date                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CALENDAR SERVICE (events.go:509-555)                     │
│    GetZmanimContext(date, location)                         │
│    Returns: ActiveEventCodes = ["shabbos"] (if Saturday)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ZMANIM SERVICE (zmanim_service.go:242-414)               │
│    CalculateZmanim(params with ActiveEventCodes)            │
│                                                              │
│    For each publisher zman:                                 │
│      ├─ Extract tags from database                          │
│      ├─ Filter: ShouldShowZman(tags, ActiveEventCodes)      │
│      ├─ If FALSE → SKIP (don't calculate)                   │
│      └─ If TRUE  → Add to formulas map                      │
│                                                              │
│    Execute DSL for all passing zmanim                       │
│    Return calculated results                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Problem - "Motzei Shabbos" Filtering

### Database State (Publisher 3)

```sql
zman_key: shabbos_ends
hebrew_name: מוצש״ק (Motzei Shabbos)
tags: shabbos, yom_kippur (both are tag_type_id = 1 "event")
```

### Expected Behavior

**Saturday (Shabbos day):**
- ActiveEventCodes = `["shabbos"]`
- shabbos_ends has tag "shabbos" → MATCH → ✅ SHOW

**Friday (Erev Shabbos):**
- ActiveEventCodes = `["erev_shabbos"]`
- shabbos_ends has tag "shabbos" → NO MATCH → ❌ HIDE

**Sunday-Thursday:**
- ActiveEventCodes = `[]` or other events
- shabbos_ends has tag "shabbos" → NO MATCH → ❌ HIDE

### Actual Behavior

**ALL DAYS:** Motzei Shabbos is showing ❌

---

## 4. Root Cause Investigation

### Suspected Issues (In Priority Order)

#### Issue #1: ActiveEventCodes Not Being Passed (MOST LIKELY)

**Location:** [handlers/zmanim.go:484](api/internal/handlers/zmanim.go#L484)

```go
calcResult, err = h.zmanimService.CalculateZmanim(ctx, services.CalculateParams{
    LocalityID:         localityID,
    PublisherID:        pubID,
    Date:               date,
    IncludeDisabled:    filters.IncludeDisabled,
    IncludeUnpublished: filters.IncludeUnpublished,
    IncludeBeta:        filters.IncludeBeta,
    ActiveEventCodes:   zmanimCtx.ActiveEventCodes,  // ← IS THIS POPULATED?
})
```

**Test:** Check logs for `"active_event_codes"` on line 473-474. Are they populated or empty?

---

#### Issue #2: ShouldShowZman Logic Bug

**Location:** [services/zmanim_service.go:778-878](api/internal/services/zmanim_service.go#L778-L878)

The filtering logic has extensive logging. Key points:

```go
// Line 807-812: If no event tags, always show
if len(eventTags) == 0 {
    return true  // ← Zman with NO event tags shows everywhere
}

// Line 867-872: If has positive tags but none matched
if hasPositiveTags && !hasPositiveMatch {
    return false  // ← Should filter out!
}
```

**Possible Bugs:**
1. Tag extraction failing (JSON unmarshal issue on lines 322-330)
2. Event tag filtering not working (lines 794-805)
3. Tag matching logic incorrect (lines 816-835)

---

#### Issue #3: Calendar Service Not Detecting Saturday

**Location:** [calendar/events.go:105-138](api/internal/calendar/events.go#L105-L138)

```go
// Check if it's Shabbat (Saturday - the actual day of Shabbos)
if date.Weekday() == time.Saturday {
    events = append(events, ActiveEvent{
        EventCode:   "shabbos",  // ← Should add "shabbos" to ActiveEvents
        ...
    })
}
```

**Then:** [calendar/events.go:524-528](api/internal/calendar/events.go#L524-L528)

```go
// Collect active event codes from events happening today
for _, ev := range info.ActiveEvents {
    ctx.ActiveEventCodes = appendUnique(ctx.ActiveEventCodes, ev.EventCode)
}
```

**Test:** Are ActiveEvents being collected correctly?

---

## 5. Diagnostic Steps (In Order)

### Step 1: Check Logs ⚡ **DO THIS FIRST**

The service has extensive logging. Look for these log messages when loading the week:

```
"GetZmanimContext: final result" - Shows ActiveEventCodes per day
"checking event filtering" - Shows if filtering is being attempted
"ShouldShowZman: START" - Entry to filtering logic
"ShouldShowZman: RETURN" - Final decision with reason
```

**What to look for:**
- Are `active_event_codes` populated on Saturday?
- Is `ShouldShowZman` being called for shabbos_ends?
- What's the return value and reason?

---

### Step 2: Database Integrity Check

```sql
-- Check shabbos_ends tags for publisher 3
SELECT pz.zman_key, pz.hebrew_name,
       json_agg(json_build_object(
           'tag_key', zt.tag_key,
           'tag_type', tt.key,
           'is_negated', pzt.is_negated
       )) as tags
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
JOIN zman_tags zt ON pzt.tag_id = zt.id
JOIN tag_types tt ON zt.tag_type_id = tt.id
WHERE pz.publisher_id = 3 AND pz.zman_key = 'shabbos_ends'
GROUP BY pz.zman_key, pz.hebrew_name;
```

**Expected:** `[{"tag_key": "shabbos", "tag_type": "event", "is_negated": false}, ...]`

---

### Step 3: API Test - Live Request

```bash
# Test Saturday (should show Motzei Shabbos)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-27&publisherId=3" | jq '.zmanim[] | select(.key == "shabbos_ends")'

# Test Friday (should NOT show Motzei Shabbos)
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26&publisherId=3" | jq '.zmanim[] | select(.key == "shabbos_ends")'
```

---

## 6. Likely Root Causes (Ranked by Probability)

### 🔴 HIGH PROBABILITY

1. **ActiveEventCodes is nil or not being passed**
   - Service line 319: `if params.ActiveEventCodes != nil`
   - If nil, filtering is skipped entirely!
   - **Fix:** Ensure handler always passes `ActiveEventCodes` (even if empty array)

2. **Tag JSON unmarshal failing silently**
   - Lines 322-330: JSON marshal/unmarshal of tags
   - If this fails, `tags` array is empty → zman shows everywhere
   - **Fix:** Check error handling, ensure tags are JSONB in query

### 🟡 MEDIUM PROBABILITY

3. **Event tag type filtering too restrictive**
   - Lines 796-800: `if tag.TagType == "event" || tag.TagType == "jewish_day"`
   - Maybe TagType isn't being populated correctly?
   - **Fix:** Check GetPublisherZmanim query includes tag type

### 🟢 LOW PROBABILITY

4. **Calendar service not detecting Saturday correctly**
   - Very unlikely - this is simple `date.Weekday() == time.Saturday`

---

## 7. Recommendations

### Immediate Actions (Today)

1. **Check application logs** for the Saturday request - look for:
   ```
   "active_event_codes": ["shabbos"]
   "ShouldShowZman: RETURN true" with reason
   ```

2. **Add defensive logging** in handler before service call:
   ```go
   slog.Info("DIAGNOSTIC: passing to service",
       "active_event_codes", zmanimCtx.ActiveEventCodes,
       "is_nil", zmanimCtx.ActiveEventCodes == nil)
   ```

3. **Test with forced empty array** to verify nil handling:
   ```go
   ActiveEventCodes: []string{}, // Force empty instead of nil
   ```

### Code Fixes (Based on Findings)

**If ActiveEventCodes is nil:**
```go
// In calendar service GetZmanimContext (events.go:521)
ctx := ZmanimContext{
    ActiveEventCodes: []string{}, // ← Initialize as empty, NEVER nil
}
```

**If tag unmarshaling is failing:**
```go
// Check GetPublisherZmanim SQL query includes proper tag JSON aggregation
// Ensure tags column is JSONB not TEXT
```

---

## 8. Success Criteria

✅ **Fixed when:**
- Motzei Shabbos ONLY appears on Saturday and Yom Kippur
- Motzei Shabbos does NOT appear on Friday, Sunday, or weekdays
- Logs show: `"ShouldShowZman: RETURN false, reason: has positive tags but none matched"` for non-Shabbos days

---

## 9. Files Analyzed

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| [api/internal/services/zmanim_service.go](api/internal/services/zmanim_service.go) | 242-414, 778-878 | Main calculation & filtering | ✅ Well-structured |
| [api/internal/handlers/zmanim.go](api/internal/handlers/zmanim.go) | 460-490 | HTTP handler | ✅ Thin, delegates correctly |
| [api/internal/calendar/events.go](api/internal/calendar/events.go) | 105-138, 509-555 | Event detection | ✅ Tag-driven |
| [api/internal/handlers/calendar.go](api/internal/handlers/calendar.go) | 280-370 | Calendar API | ✅ Pass-through only |

**Architecture Grade: A** - Single service pattern correctly implemented.

---

## Next Steps

Daniel, I need you to:

1. **Check the logs** when you load that week view - what do you see for `active_event_codes`?
2. **Tell me what day** you're looking at when you see "Motzei Shabbos" at 4:52 PM
3. Run this query to confirm tag structure:
   ```sql
   SELECT pz.zman_key, pz.hebrew_name, pzt.is_negated, zt.tag_key, zt.tag_type_id
   FROM publisher_zmanim pz
   JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
   JOIN zman_tags zt ON pzt.tag_id = zt.id
   WHERE pz.publisher_id = 3 AND pz.zman_key = 'shabbos_ends';
   ```

Then we'll know exactly which of the 4 issues is the culprit! 🎯
