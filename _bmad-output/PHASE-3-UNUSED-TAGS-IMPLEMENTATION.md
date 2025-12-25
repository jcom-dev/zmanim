# Phase 3 Implementation: Unused Tags Report (Reverse Gap)

**Date:** 2025-12-25
**Status:** Complete
**File:** `api/internal/calendar/hebcal_matching_audit_test.go`

---

## Summary

Added `generateUnusedTagsReport()` function to generate a reverse gap analysis report that identifies tags with HebCal mappings that NEVER matched any event during the 10-year audit period.

## Changes Made

### 1. New Function: `generateUnusedTagsReport()`

**Location:** `api/internal/calendar/hebcal_matching_audit_test.go`

**Purpose:** Identify tags configured for HebCal matching that never matched any event

**Algorithm:**
1. Collect all tag_keys from match results (tags that matched events)
2. Query database for ALL tags with `hebcal_match_type IS NOT NULL`
3. Compare to find tags that never matched
4. Generate detailed markdown report with recommendations

**Key Features:**
- Queries `zman_tags` table for all HebCal-mappable tags
- Groups unused tags by match type (exact/group/category)
- Provides specific recommendations for each unused tag
- Handles special cases (rare events, leap year events, regional customs)

### 2. New Struct: `UnusedTag`

```go
type UnusedTag struct {
    TagKey        string
    MatchType     string
    MatchString   string
    MatchPattern  string
    MatchCategory string
    DisplayName   string
}
```

### 3. New Function: `getRecommendation()`

Generates actionable recommendations for unused tags with special handling for:
- **Rare Events:** Purim Meshulash (only when Shushan Purim falls on Shabbat)
- **Leap Year Events:** Purim Katan (only in Adar I)
- **Historical Events:** Rosh Hashana LaBehemot
- **Regional Customs:** Chag HaBanot (North African/Sephardic)

### 4. Updated Test: `TestHebCalTagMatching()`

Added call to `generateUnusedTagsReport()` after match statistics are calculated.

### 5. Updated Script: `scripts/run-hebcal-matching-audit.sh`

Updated to mention the new report output.

---

## Report Format

The generated report (`_bmad-output/hebcal-audit-unused-tags.md`) includes:

### Summary Section
- Total HebCal-mappable tags
- Tags matched vs. never matched (with percentages)

### Unused Tags by Match Type
- Grouped by match type (exact, group, category)
- For each unused tag:
  - Tag key
  - Display name
  - Match configuration (string/pattern/category)
  - Specific recommendation

### General Recommendations Section
- Guidelines for handling unused tags
- SQL examples for verification and cleanup
- Decision framework (verify/remove/mark-rare/check-location)

---

## SQL Query Used

```sql
SELECT
    tag_key,
    hebcal_match_type,
    COALESCE(hebcal_match_string, '') as match_string,
    COALESCE(hebcal_match_pattern, '') as match_pattern,
    COALESCE(hebcal_match_category, '') as match_category,
    display_name_english_ashkenazi
FROM zman_tags
WHERE hebcal_match_type IS NOT NULL
ORDER BY hebcal_match_type, tag_key
```

---

## Example Recommendations

### Exact Match
```
Tag: purim_meshulash
Match String: "Purim Meshulash"
Recommendation: **Rare Event** - Purim Meshulash only occurs when Purim
falls on Friday in Jerusalem (Shushan Purim on Shabbat). This is extremely
rare but valid. Keep mapping.
```

### Group Match (Regex)
```
Tag: some_holiday
Match Pattern: "^Some Holiday [IVX]+"
Recommendation: Verify regex pattern `^Some Holiday [IVX]+` against HebCal
event titles. Test pattern against known HebCal responses. Pattern may be
too strict or event name may have changed.
```

### Category Match
```
Tag: some_category
Match Category: "special_category"
Recommendation: Verify HebCal category `special_category` exists. Check if
HebCal still uses this category in their API responses.
```

---

## Integration with Test Suite

The function is called automatically during `TestHebCalTagMatching`:

```go
// Phase 3: Generate unused tags report (reverse gap analysis)
err = generateUnusedTagsReport(t, db, matchResults)
if err != nil {
    t.Fatalf("Failed to generate unused tags report: %v", err)
}

t.Log("Generated unused tags report: _bmad-output/hebcal-audit-unused-tags.md")
```

---

## Running the Audit

```bash
# Set database connection
source api/.env

# Run the audit test
./scripts/run-hebcal-matching-audit.sh

# Or run directly
cd api
go test -v -timeout=10m ./internal/calendar -run=TestHebCalTagMatching
```

---

## Success Criteria

✅ **Implemented:**
- Function compiles without errors
- Queries database for all HebCal-mappable tags
- Correctly identifies unused tags (never matched)
- Generates markdown report with recommendations
- Provides special handling for rare/seasonal events
- Integrated into test suite
- Updated documentation

✅ **Output Files:**
- `_bmad-output/hebcal-audit-match-results.csv` (existing)
- `_bmad-output/hebcal-audit-unused-tags.md` (new)

---

## Notes

1. **Zero Unused Tags = Success:** If all tags matched at least once, the report celebrates this success
2. **Special Case Handling:** Function knows about rare events that might not appear in 10-year window
3. **Actionable Recommendations:** Each unused tag gets specific guidance on what to do
4. **SQL Examples:** Report includes copy-paste SQL for verification and cleanup

---

## Next Steps

After running the audit:

1. **Review the report:** `_bmad-output/hebcal-audit-unused-tags.md`
2. **For each unused tag:**
   - Verify HebCal API documentation
   - Test against live HebCal API responses
   - Update mapping OR remove if obsolete
   - Document rare events in comments
3. **Update tests:** If patterns change, update tag mappings in migration
4. **Re-run audit:** Verify all changes work correctly

---

## Technical Details

### Database Schema
The function relies on these `zman_tags` columns:
- `tag_key` - Unique identifier
- `hebcal_match_type` - ENUM: 'exact', 'group', 'category'
- `hebcal_match_string` - For exact matches
- `hebcal_match_pattern` - For regex (group) matches
- `hebcal_match_category` - For category matches
- `display_name_english_ashkenazi` - Human-readable name

### Match Result Processing
Uses `MatchResult` struct from match results to build `matchedTags` map for O(1) lookup.

### Error Handling
- Returns error if database query fails
- Returns error if file I/O fails
- Logs progress to test output
- Gracefully handles zero unused tags (success case)

---

## Validation

Code has been validated:
- ✅ Compiles without errors
- ✅ No linter warnings
- ✅ Follows Go conventions
- ✅ Includes comprehensive comments
- ✅ Updated documentation
