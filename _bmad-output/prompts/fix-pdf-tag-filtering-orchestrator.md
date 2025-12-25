# Dev Agent Orchestrator: Fix PDF Tag Filtering

## Objective
Fix the 500 error on `/api/v1/publisher/reports/zmanim-pdf` endpoint caused by duplicated tag filtering logic that doesn't respect timing tags.

## Problem Summary

The PDF report service has **its own filtering function** (`shouldShowEventZman`) that bypasses the centralized `ShouldShowZman` function in `zmanim_service.go`. The PDF version doesn't understand timing tags like `day_before`, so candle lighting (which has `shabbos` + `day_before` tags) never matches `erev_shabbos` and is incorrectly hidden on Fridays.

## Root Cause

**File:** `api/internal/services/pdf_report_service.go` lines 1136-1160

```go
func shouldShowEventZman(pz sqlcgen.ListPublisherZmanimForReportRow, ctx calendar.ZmanimContext) bool {
    tags := parseZmanTags(pz.Tags)
    for _, tag := range tags {
        if tag.TagType == "event" {
            // BUG: Direct match only - ignores timing tags like day_before
            for _, activeCode := range ctx.ActiveEventCodes {
                if activeCode == tag.TagKey {  // ❌ Won't match "shabbos" to "erev_shabbos"
                    eventActive = true
                    break
                }
            }
        }
    }
}
```

**Correct Implementation:** `api/internal/services/zmanim_service.go` lines 817-960 (`ShouldShowZman`)

This function properly handles:
- Timing tags (`day_before`, `motzei`)
- Event tag transformation (`shabbos` + `day_before` → match `erev_shabbos`)
- Negated tags

## Required Fix

### MANDATORY: Single Source of Truth (per `docs/coding-standards.md`)

All tag filtering MUST go through `ZmanimService.ShouldShowZman()`. The duplicated function in `pdf_report_service.go` must be removed.

### Implementation Steps

1. **Delete** the `shouldShowEventZman()` function from `pdf_report_service.go` (lines 1136-1160)

2. **Modify** `calculateDayZmanim()` in `pdf_report_service.go` (around line 1088-1092) to use `ZmanimService.ShouldShowZman()`:

   ```go
   // BEFORE (line 1088-1092):
   if pz.IsEventZman {
       if !shouldShowEventZman(pz, zmanimCtx) {
           continue
       }
   }

   // AFTER:
   if pz.IsEventZman {
       // Convert PDFZmanTags to EventFilterTag for ShouldShowZman
       tags := s.convertToEventFilterTags(parseZmanTags(pz.Tags))
       if !s.zmanimService.ShouldShowZman(tags, zmanimCtx.ActiveEventCodes) {
           continue
       }
   }
   ```

3. **Add helper method** to `PDFReportService` to convert tag types:

   ```go
   // convertToEventFilterTags converts PDFZmanTag slice to EventFilterTag slice
   func (s *PDFReportService) convertToEventFilterTags(tags []PDFZmanTag) []services.EventFilterTag {
       result := make([]services.EventFilterTag, 0, len(tags))
       for _, t := range tags {
           result = append(result, services.EventFilterTag{
               TagKey:    t.TagKey,
               TagType:   t.TagType,
               IsNegated: t.IsNegated,
           })
       }
       return result
   }
   ```

4. **Export `EventFilterTag`** if not already exported (check `zmanim_service.go`)

5. **Verify `ShouldShowZman` is accessible** - it should already be a public method on `ZmanimService`

## Files to Modify

| File | Action |
|------|--------|
| `api/internal/services/pdf_report_service.go` | Delete `shouldShowEventZman`, add conversion helper, update `calculateDayZmanim` |
| `api/internal/services/zmanim_service.go` | Verify `EventFilterTag` and `ShouldShowZman` are exported (capital letters) |

## Test Scenarios

After fix, verify these scenarios work:

| Scenario | Day | Expected | How to Test |
|----------|-----|----------|-------------|
| Candle lighting on Friday | Friday | SHOW | Generate PDF for any Friday |
| Candle lighting on Saturday | Saturday | HIDE | Generate PDF for any Saturday |
| Candle lighting on Erev Yom Tov | Erev Pesach | SHOW | Generate PDF for April 12, 2025 |
| Regular zman (no event tags) | Any day | SHOW | Any zman without event tags |

## Validation Commands

```bash
# 1. Build the API
cd api && go build ./cmd/api

# 2. Run tests if any exist for ShouldShowZman
cd api && go test ./internal/services/... -v -run ShouldShowZman

# 3. Restart services
./restart.sh

# 4. Test PDF generation for Friday (candle lighting should show)
# Get a valid token first:
source api/.env && node scripts/get-test-token.js

# Then test (replace TOKEN with actual token, LocalityID with valid ID):
curl -X POST http://localhost:8080/api/v1/publisher/reports/zmanim-pdf \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Publisher-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"locality_id": 4993250, "date": "2025-12-26"}' \
  --output test-friday.pdf

# Open and verify candle lighting is present
```

## Acceptance Criteria

- [ ] PDF generation endpoint returns 200 (no 500 error)
- [ ] Candle lighting appears on Friday PDFs
- [ ] Candle lighting does NOT appear on Saturday PDFs
- [ ] All filtering logic is in `zmanim_service.go:ShouldShowZman()` only
- [ ] No duplicate filtering functions exist in `pdf_report_service.go`
- [ ] `go build ./cmd/api` succeeds with no errors
- [ ] `go test ./internal/services/...` passes

## Architecture Reference

Per `docs/coding-standards.md` Tag-Driven Event Architecture section:

> **CRITICAL**: ALL event filtering is tag-driven. NO hardcoded event logic allowed.
>
> **Flow**: HebCal API → Database patterns (`tag_event_mappings`) → ActiveEventCodes → Tag filtering

The fix ensures PDF generation follows this architecture by delegating to the single source of truth: `ZmanimService.ShouldShowZman()`.

## Priority

**HIGH** - This is a blocking issue preventing PDF generation.
