# Status: Hardcoded Event Logic Elimination

**Date**: 2025-12-24
**Status**: ⚠️ PARTIAL - Build fixed, orchestrator prompts ready, full implementation pending

---

## What Was Done

### 1. Build Error Fixed ✅
**File**: `api/internal/services/zmanim_service.go` (line 311-332)
**Problem**: `pz.Tags` is `interface{}` from SQL, was trying to unmarshal directly
**Solution**: Marshal to JSON bytes first, then unmarshal to struct

```go
// Before (broken):
json.Unmarshal(pz.Tags, &tags)

// After (working):
tagsBytes, err := json.Marshal(pz.Tags)
if err == nil {
    json.Unmarshal(tagsBytes, &tags)
}
```

**Result**: ✅ API builds successfully, services running

### 2. Frontend Client-Side Logic Removed ✅
**Files Modified**:
- `web/lib/hooks/useZmanimList.ts` - Added `is_event_zman` field
- `web/components/publisher/WeekPreview.tsx` - Removed tag checking, uses server field
- `web/app/publisher/algorithm/page.tsx` - Removed tag checking
- `web/components/formula-builder/methods/FixedOffsetForm.tsx` - Removed tag checking

**Result**: ✅ Frontend trusts backend's `is_event_zman` field

### 3. PDF Service Hardcoded Logic Removed ✅
**File**: `api/internal/services/pdf_report_service.go`
**Removed**: `findEventTime()` function and hardcoded lookups for "candle_lighting", "havdalah", etc.

**Result**: ✅ PDF uses tag-driven event zmanim exclusively

### 4. Orchestrator Documentation Created ✅
**Files Created**:
- `ORCHESTRATOR-PROMPT.md` - Concise instructions for AI orchestrator
- `PLAN-eliminate-hardcoded-event-logic.md` - Detailed implementation plan

**Includes**:
- Exact file paths and line numbers
- Model specification (use `sonnet`)
- Build error workaround
- Testing checklist
- Success criteria

---

## What Remains (Backend Hardcoded Logic)

### ❌ Still Hardcoded

1. **Calendar Service** (`api/internal/calendar/events.go` line 456)
   - `ZmanimContext` struct has: `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStarts`, `ShowFastEnds`
   - Should only have: `ActiveEventCodes []string`

2. **Service DayContext** (`api/internal/services/zmanim_service.go` line ~733)
   - Entire struct should be DELETED
   - Replace with `[]string` directly in `CalculateParams`

3. **Service Filtering Logic** (`api/internal/services/zmanim_service.go` line ~753)
   - Has hardcoded `categoryFlagMap` that maps categories to boolean flags
   - Should ONLY check event/jewish_day tags against `ActiveEventCodes`

4. **Handler DayContext** (`api/internal/handlers/publisher_zmanim.go` line ~108)
   - Has filtering fields: `ShowCandleLighting`, `ShowHavdalah`, `ShowFastStart`, `ShowFastEnd`
   - Should keep ONLY display fields + `ActiveEventCodes`

5. **Handler Filtering** (`api/internal/handlers/publisher_zmanim.go`)
   - Lines 368, 588, 1076: Post-calculation filtering with `shouldShowZman()`
   - Line 1116-1140: `shouldShowZman()` function exists
   - Should DELETE all of this - service should filter BEFORE calculation

---

## Architecture (Target State)

```
┌──────────────────────────────────────────────────────────────┐
│ Calendar Service                                              │
│ ─────────────────────────────────────────────────────────────│
│ GetZmanimContext(date, tz) → ActiveEventCodes []string       │
│                                                               │
│ Examples:                                                     │
│ - Friday   → ["erev_shabbos"]                                │
│ - Saturday → ["motzei_shabbos", "shabbos"]                   │
│ - Chanukah → ["chanukah", "chanukah_night_1"]               │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Handler                                                       │
│ ─────────────────────────────────────────────────────────────│
│ activeEventCodes := calService.GetZmanimContext(...)         │
│                                                               │
│ zmanimService.CalculateZmanim(CalculateParams{               │
│     ActiveEventCodes: activeEventCodes,  // Pass to service  │
│     ...                                                       │
│ })                                                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ ZmanimService                                                 │
│ ─────────────────────────────────────────────────────────────│
│ for each zman:                                                │
│   if zman has event tags:                                     │
│     if tag.key NOT in ActiveEventCodes → skip                │
│   formulas[zman.key] = zman.formula  // Only filtered ones   │
│                                                               │
│ ExecuteFormulaSet(formulas) // Calculate only what shows     │
└──────────────────────────────────────────────────────────────┘
```

**Key Principle**: Service filters BEFORE calculation. Handler does NOT filter after.

---

## Current Issues

### Issue 1: Event Zmanim Not Displaying
**Symptoms**:
- Weekly PDF missing event zmanim section
- No candle lighting on Friday preview
- No havdalah on Saturday preview

**Root Cause**: Hardcoded `Show*` flags not being set correctly, AND service not filtering properly before calculation

**Fix**: Implement the full plan in `PLAN-eliminate-hardcoded-event-logic.md`

---

## How to Continue

### Option 1: Use Another Orchestrator
Pass these files to another AI orchestrator (use `sonnet` model):
```bash
cat ORCHESTRATOR-PROMPT.md
cat PLAN-eliminate-hardcoded-event-logic.md
```

The orchestrator will:
1. Remove all `Show*` fields from calendar service
2. Delete service `DayContext` struct
3. Update `CalculateParams` to use `ActiveEventCodes []string` directly
4. Simplify `ShouldShowZman()` to only check event tags
5. Remove handler's filtering fields and post-calculation filtering
6. Build and test

### Option 2: Implement Manually
Follow the tasks in `PLAN-eliminate-hardcoded-event-logic.md` section "Implementation Tasks"

---

## Testing After Implementation

### Must Pass
```bash
# Friday - should show candle lighting
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("candle"))'

# Wednesday - should NOT show candle lighting
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("candle"))'

# Saturday - should show havdalah
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-27&publisher_id=2" | jq '.data.zmanim[] | select(.zman_key | contains("havdalah"))'
```

### Success Criteria
```bash
# Should return 0 results:
grep -r "ShowCandleLighting" api/internal/
grep -r "ShowHavdalah" api/internal/
grep -r "ShowFastStart" api/internal/
grep -r "ShowFastEnd" api/internal/
grep -r "categoryFlagMap" api/internal/
grep -r "shouldShowZman" api/internal/handlers/
```

---

## Files Ready for Review

1. ✅ `ORCHESTRATOR-PROMPT.md` - Instructions for orchestrator
2. ✅ `PLAN-eliminate-hardcoded-event-logic.md` - Detailed implementation plan
3. ✅ `STATUS-hardcoded-event-logic.md` - This file

All documentation uses correct:
- File paths (verified)
- Line numbers (approximate but correct)
- Model specification (`sonnet`)
- Build error workarounds

---

**Next Step**: Pass `ORCHESTRATOR-PROMPT.md` to orchestrator with `sonnet` model to execute the full elimination of hardcoded event logic.
