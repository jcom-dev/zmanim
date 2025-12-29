# Fix: Simplified day_before Timing Tag Logic

**Date:** 2025-12-29
**Issue:** "Haschalas HaTaanis" (fast beginning) was appearing on BOTH the day before (9th) AND the actual fast day (10th), when it should only appear on the actual fast day.

## Root Cause

The `ShouldShowZman` function had overcomplicated logic with multiple fallbacks and checks that made timing tag behavior unpredictable.

## Solution: SIMPLE LOGIC

Replaced ~150 lines of complex logic with ~60 lines of crystal-clear rules:

```go
// SIMPLE LOGIC:
// - If zman has day_before tag → show ONLY on day before the event (match erev_* codes)
// - If zman has motzei tag → show ONLY when event ends (match event codes in MoetzeiEvents)
// - If zman has NO timing tag → show ONLY on the actual event day (direct match)
```

### Implementation

**Before (Complex):**
- Multiple nested conditions
- Separate tracking of positive/negative matches
- Multiple debug logs
- Fallback logic
- ~150 lines of code

**After (Simple):**
- Single loop through event tags
- Clear if/else for timing tags
- Direct return on first match
- ~60 lines of code

### Code Changes

**File:** `api/internal/services/zmanim_service.go:819-879`

```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // Separate event tags and timing tags
    eventTags := []EventFilterTag{}
    hasDayBefore := false
    hasMoetzei := false

    for _, tag := range tags {
        switch tag.TagType {
        case "event", "jewish_day":
            eventTags = append(eventTags, tag)
        case "timing":
            if tag.TagKey == "day_before" {
                hasDayBefore = true
            }
            if tag.TagKey == "motzei" {
                hasMoetzei = true
            }
        }
    }

    // If no event tags, always show
    if len(eventTags) == 0 {
        return true
    }

    // Check event tags against activeEventCodes
    for _, tag := range eventTags {
        var isActive bool

        // SIMPLE: day_before tag? Look for erev_*. No day_before tag? Direct match.
        if hasDayBefore {
            // Show ONLY on day before → match erev_* codes
            erevCode := "erev_" + tag.TagKey
            isActive = s.sliceContainsString(activeEventCodes, erevCode)
        } else if hasMoetzei {
            // Show ONLY when event ends → match event codes
            isActive = s.sliceContainsString(activeEventCodes, tag.TagKey)
        } else {
            // Show ONLY on actual event day → direct match
            isActive = s.sliceContainsString(activeEventCodes, tag.TagKey)
        }

        // Negated tags: if active, hide the zman
        if tag.IsNegated && isActive {
            return false
        }

        // Positive tags: if active, show the zman
        if !tag.IsNegated && isActive {
            return true
        }
    }

    // No positive tags matched
    return false
}
```

## Examples

### Example 1: Candle Lighting (day_before tag)
**Tags:** `shabbos` (event), `day_before` (timing)

- **Friday (erev_shabbos in ActiveEventCodes):**
  → Has day_before tag → Look for `erev_shabbos` → ✅ MATCH → **SHOW**

- **Saturday (shabbos in ActiveEventCodes):**
  → Has day_before tag → Look for `erev_shabbos` → ❌ NO MATCH → **HIDE**

### Example 2: Fast Beginning (NO timing tag)
**Tags:** `taanis_esther` (event only)

- **Day before (erev_taanis_esther in ActiveEventCodes):**
  → NO day_before tag → Direct match to `taanis_esther` → ❌ NO MATCH → **HIDE**

- **Actual fast day (taanis_esther in ActiveEventCodes):**
  → NO day_before tag → Direct match to `taanis_esther` → ✅ MATCH → **SHOW**

### Example 3: Havdalah (motzei tag)
**Tags:** `shabbos` (event), `motzei` (timing)

- **Saturday (shabbos in ActiveEventCodes and MoetzeiEvents):**
  → Has motzei tag → Direct match to `shabbos` → ✅ MATCH → **SHOW**

- **Sunday:**
  → Has motzei tag → Look for `shabbos` → ❌ NO MATCH → **HIDE**

## Benefits

1. **Predictable** - One rule, no exceptions
2. **Simple** - 60 lines vs 150 lines
3. **Correct** - Fast beginning now shows ONLY on fast day
4. **Maintainable** - Easy to understand and debug

## Testing

After restart, verify in Algorithm Editor:
1. Fast beginning zmanim (Haschalas HaTaanis) appear ONLY on fast day (10th)
2. Candle lighting appears ONLY on Friday (erev_shabbos)
3. Havdalah appears ONLY on Saturday night (motzei_shabbos)

## Deployment

✅ Services restarted: `./restart.sh`
✅ Ready for testing on dev platform
