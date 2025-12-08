# Story 6.3: Unified Tag Manager with Registry Tracking & Negation

**Epic:** Epic 6 - Code Cleanup, Consolidation & Publisher Data Overrides
**Status:** ready-for-dev
**Priority:** P0 (Critical - includes functional requirement for tag filtering)
**Story Points:** 8
**Dependencies:** None

---

## Story

As a **publisher**,
I want **a unified tag editor that supports negation, tracks changes from the registry, shows modification indicators, and filters zmanim based on negated tags**,
So that **I can exclude events (like "NOT on Yom Tov"), see when I've customized tags, revert changes, and users only see applicable times for each date**.

---

## Background

**Current State:**
- ✅ Database has `is_negated` column in both `master_zman_tags` and `publisher_zman_tags`
- ✅ Backend API fully supports negation in all tag endpoints
- ✅ `TagSelectorWithNegation` component exists with 3-state UI
- ❌ `ZmanTagEditor` uses simple checkboxes (doesn't leverage negation)
- ❌ No source tag tracking (no "Tags Modified" indicator like DSL has)
- ❌ No tag revert functionality
- ❌ **CRITICAL:** Tag negation filtering NOT implemented in calculation API

**What's Missing:**
1. **UI doesn't support negation** - Can't mark tags as "NOT shabbos"
2. **No modification tracking** - Can't see which tags differ from registry
3. **No revert functionality** - Can't undo tag changes
4. **No filtering logic** - Negated tags don't exclude zmanim from API response

**Example Use Case:**
```
Zman: "Mincha Gedola"
Tags: [shabbos: is_negated=true, yom_tov: is_negated=false]

Meaning:
- Show on Yom Tov ✓
- Do NOT show on Shabbos ✗

Today: Saturday (Shabbos)
Result: "Mincha Gedola" should be EXCLUDED from API response
```

---

## Acceptance Criteria

### AC-6.3.1: Update Backend to Return Source Tags
- [ ] Modify `GetZmanTags` SQLc query to include source tracking
- [ ] Add `source_is_negated` field (from master registry)
- [ ] Add `is_modified` field (true if differs from source)
- [ ] Add `tag_source` field ('master' or 'publisher')
- [ ] Update Go struct `ZmanTag` with new fields
- [ ] Test query returns correct source comparison

### AC-6.3.2: Create Tag Negation Eligibility Logic
- [ ] Create `web/lib/utils/tagNegation.ts`
- [ ] Define `NEGATABLE_TAG_TYPES` constant (event, timing, jewish_day)
- [ ] Export `canNegateTag(tag)` function
- [ ] Export `getTagDisplayState(tag)` function
- [ ] Unit tests for eligibility logic

### AC-6.3.3: Create Reusable TagManager Component
- [ ] Create `web/components/shared/tags/TagManager.tsx`
- [ ] Accept props: currentTags, allAvailableTags, onSave, onRevert, showModificationIndicators
- [ ] Use `TagSelectorWithNegation` for negatable tags
- [ ] Use simple checkboxes for non-negatable tags
- [ ] Group tags by type with tabs
- [ ] Show amber modification indicators
- [ ] Show "Revert All to Registry" button when source exists
- [ ] Show preview chips at top

### AC-6.3.4: Update ZmanCard with Modification Banner
- [ ] Add tag modification detection to ZmanCard
- [ ] Show amber banner when tags differ from registry
- [ ] Show diff: "Added: [tags]", "Removed: [tags]", "Negation changed: [tags]"
- [ ] Add "Revert Tags" button to banner
- [ ] Handle revert action

### AC-6.3.5: Add Tag Revert API Endpoint
- [ ] Create SQLc query `RevertPublisherZmanTags`
- [ ] Create handler `POST /api/v1/publisher/zmanim/{zmanKey}/tags/revert`
- [ ] Handler resets all publisher tags to master registry state
- [ ] Return updated tag list

### AC-6.3.6: Update ZmanTagEditor to Use TagManager
- [ ] Replace checkbox UI with TagManager component
- [ ] Pass all required props
- [ ] Handle save callback
- [ ] Handle revert callback
- [ ] Test in algorithm page context

### AC-6.3.7: Implement Tag Negation Filtering in Calculation API
- [ ] **CRITICAL:** Add Hebrew date lookup in zmanim calculation
- [ ] Call `GetTagsForHebrewDate` to get today's tags
- [ ] Filter zmanim: exclude if negated tag matches today
- [ ] Add unit tests for filtering logic
- [ ] Add integration test: Shabbos exclusion
- [ ] Add integration test: Yom Tov inclusion
- [ ] Performance test: < 200ms response time

---

## Tasks / Subtasks

- [ ] Task 1: Backend Source Tag Tracking (AC: 6.3.1)
  - [ ] 1.1 Update `api/internal/db/queries/zmanim_tags.sql`
  - [ ] 1.2 Add source_is_negated, is_modified, tag_source to query
  - [ ] 1.3 Update Go struct with new fields
  - [ ] 1.4 Run `sqlc generate`
  - [ ] 1.5 Test query with sample data

- [ ] Task 2: Tag Negation Logic (AC: 6.3.2)
  - [ ] 2.1 Create `web/lib/utils/tagNegation.ts`
  - [ ] 2.2 Define NEGATABLE_TAG_TYPES constant
  - [ ] 2.3 Implement `canNegateTag` function
  - [ ] 2.4 Implement `getTagDisplayState` function
  - [ ] 2.5 Add unit tests

- [ ] Task 3: TagManager Component (AC: 6.3.3)
  - [ ] 3.1 Create `web/components/shared/tags/TagManager.tsx`
  - [ ] 3.2 Accept props and set up state
  - [ ] 3.3 Render tabs grouped by tag type
  - [ ] 3.4 Use TagSelectorWithNegation for negatable tags
  - [ ] 3.5 Use checkboxes for non-negatable tags
  - [ ] 3.6 Show modification indicators (amber dots)
  - [ ] 3.7 Add "Revert All" button
  - [ ] 3.8 Show preview chips
  - [ ] 3.9 Add accessibility (ARIA labels, keyboard nav)

- [ ] Task 4: ZmanCard Modification Banner (AC: 6.3.4)
  - [ ] 4.1 Add `hasTagModification` detection function
  - [ ] 4.2 Calculate tag diff (added, removed, negation changed)
  - [ ] 4.3 Render amber banner with diff
  - [ ] 4.4 Add "Revert Tags" button
  - [ ] 4.5 Handle revert action

- [ ] Task 5: Tag Revert API (AC: 6.3.5)
  - [ ] 5.1 Create `RevertPublisherZmanTags` SQLc query
  - [ ] 5.2 Create handler function
  - [ ] 5.3 Add route to router
  - [ ] 5.4 Test endpoint

- [ ] Task 6: Update ZmanTagEditor (AC: 6.3.6)
  - [ ] 6.1 Import TagManager component
  - [ ] 6.2 Replace checkbox UI with TagManager
  - [ ] 6.3 Pass all required props
  - [ ] 6.4 Handle save callback
  - [ ] 6.5 Handle revert callback
  - [ ] 6.6 Test functionality

- [ ] Task 7: Tag Filtering in Calculation API (AC: 6.3.7) **CRITICAL**
  - [ ] 7.1 Add Hebrew date service method `GetHebrewDate(date)`
  - [ ] 7.2 Update zmanim calculation handler
  - [ ] 7.3 Call `GetTagsForHebrewDate` after fetching zmanim
  - [ ] 7.4 Filter zmanim based on negated tags
  - [ ] 7.5 Add unit tests for filtering logic
  - [ ] 7.6 Add integration test: Shabbos exclusion
  - [ ] 7.7 Add integration test: Yom Tov inclusion
  - [ ] 7.8 Performance test: < 200ms

---

## Dev Notes

### Backend: Source Tag Tracking SQL

**File:** `api/internal/db/queries/zmanim_tags.sql`

```sql
-- name: GetZmanTags :many
SELECT
  t.id, t.tag_key, t.name,
  t.display_name_hebrew, t.display_name_english,
  t.tag_type,
  COALESCE(pzt.is_negated, false) AS is_negated,
  CASE
    WHEN mzt.tag_id IS NOT NULL THEN 'master'
    ELSE 'publisher'
  END AS tag_source,
  mzt.is_negated AS source_is_negated,
  CASE
    WHEN mzt.tag_id IS NOT NULL
      AND COALESCE(pzt.is_negated, false) != COALESCE(mzt.is_negated, false)
    THEN true
    ELSE false
  END AS is_modified,
  COALESCE(pzt.sort_order, t.sort_order) AS sort_order
FROM publisher_zmanim pz
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id
LEFT JOIN zman_tags t ON t.id = mzt.tag_id OR t.id = pzt.tag_id
LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id AND pzt.tag_id = t.id
WHERE pz.zman_key = $1 AND pz.publisher_id = $2
ORDER BY sort_order;
```

### Frontend: Tag Negation Filtering Logic

**File:** `api/internal/handlers/zmanim.go` (line ~209)

```go
// Get Hebrew calendar context for tag filtering
hebrewDate, err := h.calendar.GetHebrewDate(date)
if err != nil {
    slog.Error("Failed to get Hebrew date", "error", err)
    // Continue without filtering
} else {
    todayTags, err := h.db.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
        HebrewMonth: hebrewDate.Month,
        HebrewDay:   hebrewDate.Day,
    })
    if err != nil {
        slog.Error("Failed to get tags for Hebrew date", "error", err)
    } else {
        // Create map of today's tag IDs for fast lookup
        todayTagIDs := make(map[int32]bool)
        for _, tag := range todayTags {
            todayTagIDs[tag.ID] = true
        }

        // Filter zmanim based on negated tags
        filteredZmanim := []ZmanWithFormula{}
        for _, zman := range response.Zmanim {
            shouldInclude := true
            for _, tag := range zman.Tags {
                if tag.IsNegated && todayTagIDs[tag.ID] {
                    shouldInclude = false
                    slog.Debug("Excluding zman due to negated tag",
                        "zman", zman.Key,
                        "tag", tag.Name,
                        "date", date)
                    break
                }
            }
            if shouldInclude {
                filteredZmanim = append(filteredZmanim, zman)
            }
        }
        response.Zmanim = filteredZmanim
    }
}
```

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md).

**Backend:**
- Follow 6-step handler pattern
- Use PublisherResolver for publisher endpoints
- Use AdminResolver for admin endpoints
- Use SQLc for all queries
- Use `slog` for logging

**Frontend:**
- Use `useApi` hook for API calls
- Use Tailwind design tokens
- Accessibility: ARIA labels, keyboard navigation

### References

- [web/components/shared/tags/TagSelectorWithNegation.tsx](../../../../web/components/shared/tags/TagSelectorWithNegation.tsx)
- [web/components/publisher/ZmanTagEditor.tsx](../../../../web/components/publisher/ZmanTagEditor.tsx)
- [api/internal/handlers/zmanim.go](../../../../api/internal/handlers/zmanim.go)
- [docs/coding-standards.md](../../coding-standards.md)

---

## Testing Requirements

### Unit Tests
- [ ] Tag negation eligibility logic
- [ ] Tag display state calculation
- [ ] Tag filtering logic (Shabbos/Yom Tov)

### Integration Tests
- [ ] Zmanim API excludes negated tag matches
- [ ] Zmanim API includes non-negated tags
- [ ] Tag revert resets to master state

### E2E Tests
- [ ] Publisher can negate event tag, save, verify persistence
- [ ] Publisher modifies tag from registry, sees amber indicator
- [ ] Publisher reverts tags, indicator disappears
- [ ] User requests zmanim on Shabbos, negated zmanim excluded
- [ ] User requests zmanim on Yom Tov, non-negated zmanim included

### Performance Tests
- [ ] Zmanim calculation with filtering: < 200ms (p95)
- [ ] Hebrew date lookup: < 50ms

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/6-3-unified-tag-manager-context.xml (generated 2025-12-08)

### Agent Model Used
TBD

### Completion Notes
TBD

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-08 | Story created from Epic 6 | Bob (Scrum Master) |
