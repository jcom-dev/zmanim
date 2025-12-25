# Solution: Event-Based Zmanim Preview Control

**Problem:** Event-based zmanim (like "Motzei Shabbos") show on ALL days in the week preview because `includeInactive=true` disables event filtering to allow the Algorithm Editor to show all zmanim.

**Root Cause:** [publisher_zmanim.go:296-301](api/internal/handlers/publisher_zmanim.go#L296-L301)
```go
if includeInactive {
    activeEventCodes = nil // nil = no filtering, show all zmanim
}
```

---

## Proposed Solutions (Pick One)

### Option 1: Use Existing `is_visible` Flag ⭐ RECOMMENDED

**Logic:**
- `is_visible = false` → Hide from ALL previews (Algorithm Editor AND Week Preview)
- `is_visible = true` + has event tags → Apply event filtering in Week Preview
- `includeInactive = true` → Still shows in Algorithm Editor list (but marked as "event-only")

**Code Change:**
```go
// In publisher_zmanim.go around line 295
var activeEventCodes []string
if includeInactive {
    // Algorithm Editor: disable filtering but mark event-based zmanim
    activeEventCodes = nil
} else {
    // Week Preview: apply event filtering for is_visible=true zmanim
    activeEventCodes = zmanimCtx.ActiveEventCodes
}
```

**No schema change needed!** Just use the existing `is_visible` flag.

**Benefits:**
- ✅ Zero migration needed
- ✅ Clear semantics: "not visible" = don't show in preview
- ✅ Publishers can control visibility per zman

**Drawbacks:**
- ⚠️ `is_visible` might already be used for something else
- ⚠️ Need to check if any zmanim have `is_visible=false` currently

---

### Option 2: Add New `requires_event` Boolean Flag

**Schema Change:**
```sql
ALTER TABLE publisher_zmanim
ADD COLUMN requires_event BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN publisher_zmanim.requires_event IS
'If true, this zman only appears when its event tags match active calendar events. Used to hide event-specific zmanim (like Motzei Shabbos) when the event is not active.';
```

**Auto-populate based on tags:**
```sql
-- Mark zmanim with event/jewish_day tags as requires_event
UPDATE publisher_zmanim pz
SET requires_event = true
WHERE EXISTS (
    SELECT 1 FROM publisher_zman_tags pzt
    JOIN zman_tags zt ON pzt.tag_id = zt.id
    JOIN tag_types tt ON zt.tag_type_id = tt.id
    WHERE pzt.publisher_zman_id = pz.id
    AND tt.key IN ('event', 'jewish_day')
);
```

**Code Change:**
```go
// In zmanim_service.go around line 312
if params.ActiveEventCodes != nil {
    var tags []EventFilterTag
    // ... existing tag extraction code ...

    // Only apply event filtering if zman requires_event=true
    if pz.RequiresEvent {
        shouldShow := s.ShouldShowZman(tags, params.ActiveEventCodes)
        if !shouldShow {
            continue
        }
    }
}
```

**Benefits:**
- ✅ Explicit and clear intent
- ✅ Can be auto-calculated from tags
- ✅ Backward compatible (default false = existing behavior)

**Drawbacks:**
- ❌ Requires migration
- ❌ Another column to maintain

---

### Option 3: Smart Detection (No Schema Change) ⚡ FASTEST

**Logic:** If a zman has event/jewish_day tags, automatically apply filtering in preview mode.

**Code Change:**
```go
// In zmanim_service.go around line 312
if params.ActiveEventCodes != nil {
    var tags []EventFilterTag
    // ... existing tag extraction code ...

    // Check if this zman has event-type tags
    hasEventTags := false
    for _, tag := range tags {
        if tag.TagType == "event" || tag.TagType == "jewish_day" {
            hasEventTags = true
            break
        }
    }

    // Only apply event filtering if zman has event tags
    if hasEventTags {
        shouldShow := s.ShouldShowZman(tags, params.ActiveEventCodes)
        if !shouldShow {
            continue
        }
    }
}
```

**Benefits:**
- ✅ Zero schema changes
- ✅ Automatic based on tag configuration
- ✅ Works for all publishers immediately

**Drawbacks:**
- ⚠️ Less explicit control
- ⚠️ Can't override (e.g., show event zman even without event)

---

## My Recommendation: **Option 3** (Smart Detection)

**Why:**
1. **No migration needed** - Deploy immediately
2. **Automatic** - Works based on existing tag configuration
3. **Tag-driven** - Follows your architecture principle
4. **Simple** - One 10-line code change

**The Logic:**
- Zman has NO event tags → Always show (existing behavior)
- Zman has event tags + `includeInactive=false` (preview) → Apply filtering
- Zman has event tags + `includeInactive=true` (editor) → Show all (existing behavior)

---

## Implementation Steps (Option 3)

### 1. Update the Service Logic

**File:** [api/internal/services/zmanim_service.go](api/internal/services/zmanim_service.go#L311-L345)

```go
// Apply calendar context filtering (event zmanim)
if params.ActiveEventCodes != nil {
    // Convert SQLc tags to EventFilterTag
    var tags []EventFilterTag
    if pz.Tags != nil {
        tagsBytes, err := json.Marshal(pz.Tags)
        if err != nil {
            slog.Error("failed to marshal tags", "zman_key", pz.ZmanKey, "error", err)
        } else {
            if err := json.Unmarshal(tagsBytes, &tags); err != nil {
                slog.Error("failed to unmarshal tags", "zman_key", pz.ZmanKey, "error", err)
            } else {
                // Check if this zman has event-type tags
                hasEventTags := false
                for _, tag := range tags {
                    if tag.TagType == "event" || tag.TagType == "jewish_day" {
                        hasEventTags = true
                        break
                    }
                }

                // Only apply event filtering if zman has event tags
                if hasEventTags {
                    shouldShow := s.ShouldShowZman(tags, params.ActiveEventCodes)
                    slog.Info("event filtering decision",
                        "zman_key", pz.ZmanKey,
                        "should_show", shouldShow,
                        "active_events", params.ActiveEventCodes,
                        "tag_count", len(tags))
                    if !shouldShow {
                        slog.Info("filtering out event-based zman",
                            "zman_key", pz.ZmanKey,
                            "active_events", params.ActiveEventCodes)
                        continue
                    }
                }
            }
        }
    }
}
```

### 2. Test Cases

**Test 1: Saturday (Shabbos) - Should show Motzei Shabbos**
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?publisherId=3&localityId=4993250&date=2025-12-27" | jq '.zmanim[] | select(.key == "shabbos_ends")'
# Expected: Returns shabbos_ends
```

**Test 2: Friday (Erev Shabbos) - Should NOT show Motzei Shabbos**
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?publisherId=3&localityId=4993250&date=2025-12-26" | jq '.zmanim[] | select(.key == "shabbos_ends")'
# Expected: null (not found)
```

**Test 3: Algorithm Editor - Should show ALL zmanim**
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?publisherId=3&localityId=4993250&date=2025-12-26&includeInactive=true" | jq '.zmanim[] | select(.key == "shabbos_ends")'
# Expected: Returns shabbos_ends (even though it's Friday)
```

### 3. Verify in Logs

After deploying, check logs for:
```
"event filtering decision" - Should show zman_key, should_show, active_events
"filtering out event-based zman" - Should appear for non-matching days
```

---

## Alternative: If You Want Explicit Control

If you want publishers to explicitly control this behavior, go with **Option 2** (add `requires_event` flag).

Then publishers can:
- Set `requires_event=true` for event-specific zmanim (Motzei Shabbos, Fast Ends, etc.)
- Set `requires_event=false` for universal zmanim that happen to have event tags but should always show

---

## Questions for You

1. **Do you want automatic detection (Option 3) or explicit control (Option 2)?**
2. **Is `is_visible` currently used for anything?** (If not, Option 1 works too)
3. **Should the Algorithm Editor visually indicate which zmanim are event-based?** (e.g., badge saying "Shabbos only")

Let me know which option you prefer and I can implement it! 🚀
