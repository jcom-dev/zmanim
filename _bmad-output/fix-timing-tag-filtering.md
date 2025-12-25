# Fix: Timing Tag Filtering for Event-Based Zmanim

## Problem Summary

Zmanim tagged with `day_before` timing tag + event tags (like `shabbos`) are not showing on the appropriate days because:

1. The calendar service generates **context-specific event codes** (e.g., `erev_shabbos` on Fridays)
2. Zmanim are tagged with **event tags** (e.g., `shabbos`) + **timing tags** (e.g., `day_before`)
3. `ShouldShowZman()` in `zmanim_service.go` **ignores timing tags completely**
4. Result: `shabbos` doesn't match `erev_shabbos`, so candle lighting is hidden on Fridays

## Current Behavior

**candle_lighting zman tags:**
- `shabbos` (event)
- `pesach`, `rosh_hashana`, `sukkos`, etc. (event)
- `day_before` (timing) - **IGNORED**

**Friday's ActiveEventCodes:** `["erev_shabbos"]`

**ShouldShowZman logic (zmanim_service.go:813-819):**
```go
// Filter to only event and jewish_day tags
eventTags := []EventFilterTag{}
for _, tag := range tags {
    if tag.TagType == "event" || tag.TagType == "jewish_day" {
        eventTags = append(eventTags, tag)
    }
}
// Timing tags like "day_before" are DISCARDED here
```

**Result:** `shabbos` not in `["erev_shabbos"]` → candle lighting hidden

## Root Cause

The timing tag system was designed but never fully implemented. The `day_before` tag exists in the database but has no effect on filtering logic.

## Recommended Fix

### Option A: Quick Fix - Add erev_* Tags to Zmanim (IMMEDIATE)

For each event that has candle lighting on erev, add the corresponding `erev_*` tag:

```sql
-- Add erev_shabbos tag to candle_lighting
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
SELECT 5, id, false FROM zman_tags WHERE tag_key = 'erev_shabbos';

-- Similarly for other events that have erev candle lighting
-- erev_pesach, erev_sukkos, erev_rosh_hashana, etc.
```

**Pros:** Immediate fix, no code changes
**Cons:** Duplicates information (shabbos + erev_shabbos), timing tags remain unused

### Option B: Implement Timing Tag Logic (ARCHITECTURAL FIX)

Modify `ShouldShowZman()` to understand timing semantics:

```go
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
    // Separate event and timing tags
    eventTags := []EventFilterTag{}
    timingTags := []EventFilterTag{}

    for _, tag := range tags {
        switch tag.TagType {
        case "event", "jewish_day":
            eventTags = append(eventTags, tag)
        case "timing":
            timingTags = append(timingTags, tag)
        }
    }

    // If no event tags, always show
    if len(eventTags) == 0 {
        return true
    }

    // Check if any event tag matches, considering timing modifiers
    for _, eventTag := range eventTags {
        // Direct match
        if s.sliceContainsString(activeEventCodes, eventTag.TagKey) {
            return true
        }

        // Timing-modified match: if zman has "day_before" timing tag,
        // also check for "erev_" + event code
        for _, timingTag := range timingTags {
            if timingTag.TagKey == "day_before" {
                erevCode := "erev_" + eventTag.TagKey
                if s.sliceContainsString(activeEventCodes, erevCode) {
                    return true
                }
            }
            if timingTag.TagKey == "motzei" || timingTag.TagKey == "day_of" {
                // For motzei/day_of, the event code itself should match
                // (motzei_shabbos events have "shabbos" in ActiveEventCodes from MoetzeiEvents)
                if s.sliceContainsString(activeEventCodes, eventTag.TagKey) {
                    return true
                }
            }
        }
    }

    // Check negated tags
    for _, tag := range eventTags {
        if tag.IsNegated && s.sliceContainsString(activeEventCodes, tag.TagKey) {
            return false
        }
    }

    return false
}
```

**Pros:**
- Uses timing tags as designed
- Single source of truth (shabbos + day_before = show on erev)
- More maintainable long-term

**Cons:**
- Code change required
- Need to ensure all timing scenarios are covered

### Option C: Hybrid Approach (RECOMMENDED)

1. **Immediate:** Add `erev_shabbos` tag to candle_lighting (and similar zmanim)
2. **Follow-up:** Implement timing tag logic for cleaner architecture
3. **Migration:** Once timing logic works, remove duplicate erev_* tags from zmanim

## Files to Modify

### For Option B (Timing Tag Logic):

1. **api/internal/services/zmanim_service.go**
   - Function: `ShouldShowZman()` (lines 797-897)
   - Add timing tag awareness to filtering logic

2. **api/internal/services/zmanim_service.go**
   - Ensure `EventFilterTag` struct includes timing tag data

3. **Tests:**
   - Add test cases for timing tag scenarios:
     - `shabbos` + `day_before` should match `erev_shabbos`
     - `shabbos` + `motzei` should match when shabbos is in MoetzeiEvents
     - Negation should still work with timing tags

## Test Scenarios

| Zman Tags | Active Event Codes | Expected | Current |
|-----------|-------------------|----------|---------|
| `shabbos, day_before` | `["erev_shabbos"]` | SHOW | HIDDEN |
| `shabbos` | `["shabbos"]` | SHOW | SHOW |
| `shabbos, motzei` | `["shabbos"]` (from MoetzeiEvents) | SHOW | SHOW |
| `erev_shabbos` | `["erev_shabbos"]` | SHOW | SHOW |
| `shabbos, !yom_tov` | `["shabbos", "yom_tov"]` | HIDDEN | HIDDEN |

## Database State (Current)

```sql
-- Existing erev_* tags (all have tag_type = 'event'):
erev_shabbos, erev_sukkos, erev_pesach, erev_purim,
erev_rosh_hashana, erev_shavuos, erev_yom_kippur, erev_tisha_bav

-- Timing tags (tag_type = 'timing'):
day_before

-- candle_lighting (publisher_zman_id = 5) current tags:
shabbos, pesach, rosh_hashana, sukkos, shavuos, yom_kippur,
shmini_atzeres, simchas_torah, day_before
```

## Implementation Priority

1. **HIGH (Immediate):** Add `erev_shabbos` tag to candle_lighting via SQL
2. **MEDIUM:** Implement timing tag logic in `ShouldShowZman()`
3. **LOW:** Add similar `erev_*` tags to other event zmanim as needed
4. **FUTURE:** Consider removing redundant erev_* tags once timing logic works

## Acceptance Criteria

- [ ] candle_lighting shows on Friday (Erev Shabbos)
- [ ] candle_lighting shows on Erev Yom Tov days
- [ ] Havdalah/shabbos_ends shows on Saturday night
- [ ] No regression: zmanim with only event tags (no timing) still work
- [ ] Negated tags still work correctly
