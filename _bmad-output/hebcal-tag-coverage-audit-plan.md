# HebCal Tag Coverage Audit - Research & Implementation Plan

**Analyst:** Mary (Business Analyst)
**Date:** 2025-12-25
**Status:** Research Complete - Ready for Implementation Approval
**Project:** Zmanim Platform Tag-Driven Architecture

---

## Executive Summary

This document outlines a comprehensive audit plan to verify 100% coverage between HebCal API events and the tag-driven architecture. The audit will test thousands of events across multiple years (5775-5785) in both Jerusalem and Salford to ensure complete mapping coverage.

**Key Findings from Research:**
- Current system has 53 HebCal-mappable tags out of 78 total tags
- Three match types in use: `exact` (42), `group` (6), `category` (5)
- New architecture uses PostgreSQL function `match_hebcal_event()` instead of old `tag_event_mappings` table
- HebCal-go library v0.10.6 already integrated in codebase

---

## Current Architecture Analysis

### 1. Tag Matching System

The system uses a **PostgreSQL-based** matching function with three priority levels:

#### Priority 1: Category Match (5 tags - Hidden)
Maps HebCal's `category` field to internal tags:
```
hebcal_candles      → candles
hebcal_havdalah     → havdalah
hebcal_mevarchim    → mevarchim
hebcal_parashat     → parashat
hebcal_rosh_chodesh → roshchodesh
```

#### Priority 2: Exact Match (42 tags)
Maps exact HebCal title strings:
```
Yom Kippur          → yom_kippur
Erev Pesach         → erev_pesach
Purim               → purim
Asara B'Tevet       → asara_btevet
... (38 more)
```

#### Priority 3: Group/Regex Match (6 tags)
Maps multi-day events using PostgreSQL regex patterns:
```
^Chanukah:                           → chanukah
^Pesach [IVX]+                       → pesach
^Rosh Hashana( [0-9]+| II)?$         → rosh_hashana
^Shavuot [IVX]+$                     → shavuos
^Sukkot [IVX]+                       → sukkos
^Tish'a B'Av( \(observed\))?$        → tisha_bav
```

### 2. Database Schema

**Key Table:** `zman_tags`
```sql
CREATE TABLE zman_tags (
    id                      SERIAL PRIMARY KEY,
    tag_key                 VARCHAR(50) NOT NULL UNIQUE,
    display_name_hebrew     TEXT NOT NULL,
    hebcal_match_type       hebcal_match_type,  -- 'exact', 'group', 'category'
    hebcal_match_string     TEXT,               -- For exact matches
    hebcal_match_pattern    TEXT,               -- For group (regex) matches
    hebcal_match_category   VARCHAR(50),        -- For category matches
    ...
);

CREATE TYPE hebcal_match_type AS ENUM ('exact', 'group', 'category');
```

**Matching Function:**
```sql
CREATE OR REPLACE FUNCTION match_hebcal_event(
    hebcal_title text,
    hebcal_category text DEFAULT NULL
) RETURNS TABLE(tag_id integer, tag_key varchar, match_type hebcal_match_type)
```

### 3. HebCal API Integration

**Library:** `github.com/hebcal/hebcal-go v0.10.6`

**Current Integration Points:**
- `api/internal/calendar/hebcal.go` - HTTP API client wrapper
- `api/internal/calendar/events.go` - Event processing and tag matching

**HebCal API Parameters Used:**
```
v=1              # API version
cfg=json         # JSON response
year/month/day   # Date specification
il=true/false    # Israel mode
maj=on           # Major holidays
min=on           # Minor holidays
mod=on           # Modern holidays
nx=on            # Rosh Chodesh
mf=on            # Minor fasts
ss=on            # Special Shabbatot
o=on             # Omer count
s=off            # No Torah readings
c=off            # No candle times (we calculate our own)
lg=a             # Ashkenazi transliterations (optional)
```

---

## Gap Analysis - Potential Coverage Issues

### Known Gaps from Documentation Review

1. **HebCal Event Categories Not Currently Handled:**
   - `omer` - Daily Omer count (49 days between Pesach and Shavuot)
   - Torah readings (we disable with `s=off`, but verify nothing gets through)

2. **Edge Cases to Test:**
   - Observed fast days (e.g., "Tzom Gedaliah (observed)")
   - Purim in Jerusalem vs. other locations (Shushan Purim)
   - Special years: Leap years with Adar I/II, Purim Katan
   - Israeli vs. Diaspora differences (Yom Tov Sheni)
   - Modern Israeli holidays (hidden by default but should still map)

3. **Multi-Day Event Day Numbering:**
   - HebCal uses Roman numerals: "Pesach I", "Pesach II", etc.
   - Our system uses regex patterns - need to verify all variations match
   - Special handling for "Rosh Hashana" (sometimes no number, sometimes "I", "II")

4. **Special Shabbatot (9 tags):**
   All use exact match - verify HebCal spelling exactly matches:
   - Shabbat Shekalim, Zachor, Parah, HaChodesh
   - Shabbat HaGadol, Chazon, Nachamu, Shuva, Shirah

---

## Audit Implementation Plan

### Phase 1: Data Collection (Estimated: 30 min implementation)

**Objective:** Generate comprehensive HebCal event dataset

**Implementation:**
```go
// Create test utility: api/internal/calendar/audit_test.go
type HebCalAuditCollector struct {
    client      *Client
    locations   []AuditLocation
    years       []int      // Hebrew years 5775-5785
}

type AuditLocation struct {
    Name      string
    Lat       float64
    Lng       float64
    IsIsrael  bool
}

// Collect events for all years and locations
func (c *HebCalAuditCollector) CollectAllEvents() ([]AuditEvent, error)
```

**Test Parameters:**
- **Years:** 5775-5785 (10 Hebrew years = ~3650 days × 2 locations)
- **Locations:**
  1. Jerusalem: 31.7683°N, 35.2137°E (Israel mode: true)
  2. Salford, UK: 53.4875°N, 2.2901°W (Israel mode: false)

**Expected Output:**
- CSV file with all unique HebCal events
- ~100-200 unique event titles/patterns across 10 years
- Both Ashkenazi and Sephardi transliterations

### Phase 2: Tag Matching Audit (Estimated: 1 hour implementation)

**Objective:** Test every HebCal event against database matching logic

**Implementation:**
```go
type MatchResult struct {
    HebCalTitle     string
    HebCalCategory  string
    Date            string
    Location        string
    MatchedTag      *string  // nil if no match
    MatchType       *string  // 'exact', 'group', 'category'
}

func (a *Auditor) AuditEventMatching(events []AuditEvent, db *sql.DB) ([]MatchResult, error) {
    // For each event, call match_hebcal_event() function
    // Record match or no-match
}
```

**Database Query:**
```sql
SELECT * FROM match_hebcal_event($1, $2);
```

### Phase 3: Gap Analysis & Reporting (Estimated: 30 min implementation)

**Objective:** Generate comprehensive coverage report

**Reports to Generate:**

#### Report 1: Unmapped HebCal Events (Gap Analysis)
```
Event Title              | Category  | Dates Found | Location | Recommendation
-------------------------|-----------|-------------|----------|----------------
"Omer Day 15"           | omer      | 2025-05-05  | Both     | Add tag or ignore
"Parashat Vayeshev"     | parashat  | Multiple    | Both     | Already hidden
```

#### Report 2: Unused Tags (Reverse Gap)
```
Tag Key                 | Match Type | Match Pattern        | Status
------------------------|------------|----------------------|----------
purim_meshulash         | exact      | "Purim Meshulash"    | Never matched in 10 years
```

#### Report 3: Coverage Statistics
```
Total Unique HebCal Events:        147
Events Matched to Tags:            142 (96.6%)
Events Unmapped:                   5 (3.4%)

By Category:
  holiday:      45/47 matched (95.7%)
  fast:         7/7 matched (100%)
  roshchodesh:  12/12 matched (100%)
  candles:      52/52 matched (100%)
  havdalah:     52/52 matched (100%)
  parashat:     0/52 matched (0% - intentional, hidden)
  omer:         0/49 matched (0% - needs decision)
  mevarchim:    12/12 matched (100%)
```

#### Report 4: Multi-Day Event Verification
```
Event Group     | Days Expected | Days Found | All Matched? | Notes
----------------|---------------|------------|--------------|-------
Pesach Israel   | 7 days        | 7 days     | ✓ Yes        |
Pesach Diaspora | 8 days        | 8 days     | ✓ Yes        |
Chanukah        | 8 days        | 8 days     | ✓ Yes        |
Sukkot Israel   | 7 days        | 7 days     | ✓ Yes        |
Sukkot Diaspora | 8 days        | 8 days     | ✓ Yes        |
```

### Phase 4: Recommendation Generation (Manual Analysis)

For each unmapped event, provide one of these recommendations:

1. **Add New Tag** - Event should be tracked
   ```sql
   INSERT INTO zman_tags (...) VALUES (...);
   ```

2. **Extend Existing Pattern** - Modify regex to capture variation
   ```sql
   UPDATE zman_tags SET hebcal_match_pattern = '...' WHERE tag_key = '...';
   ```

3. **Intentionally Ignore** - Document why (e.g., Torah readings, Omer count)

4. **Flag as Data Quality Issue** - Investigate with HebCal team

---

## Implementation Approach

### Option A: Pure Go Test (Recommended)
**File:** `api/internal/calendar/hebcal_coverage_test.go`

**Pros:**
- Uses existing test infrastructure
- Type-safe with SQLc generated queries
- Can run as part of CI/CD
- Easy to maintain

**Cons:**
- Requires Go test knowledge to read

### Option B: Standalone CLI Tool
**File:** `api/cmd/audit-hebcal/main.go`

**Pros:**
- Can be run independently
- Easy to schedule/automate
- Outputs to files directly

**Cons:**
- Extra maintenance burden
- Duplication of logic

### Recommended: **Option A** (Go Test)

---

## Expected Deliverables

### Code Artifacts
1. `api/internal/calendar/hebcal_coverage_test.go` - Main audit test
2. `api/internal/calendar/audit_helpers.go` - Helper utilities
3. `scripts/run-hebcal-audit.sh` - Convenience script

### Report Artifacts (in `_bmad-output/`)
1. `hebcal-audit-full-events.csv` - All events collected
2. `hebcal-audit-unmapped-events.md` - Gap analysis
3. `hebcal-audit-unused-tags.md` - Reverse gap analysis
4. `hebcal-audit-summary.md` - Executive summary with coverage %
5. `hebcal-audit-recommendations.md` - Actionable next steps

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Write data collection code | 30 minutes |
| 2 | Write matching audit code | 1 hour |
| 3 | Write report generation code | 30 minutes |
| 4 | Run full audit (10 years × 2 locations) | 5-10 minutes (runtime) |
| 5 | Analyze results & write recommendations | 1-2 hours |
| **Total** | **3-4 hours development + analysis** | |

---

## Technical Considerations

### 1. Rate Limiting
HebCal API has rate limits. For ~7,300 requests (10 years × 365 days × 2 locations):
- **Solution:** Use `hebcal-go` library's built-in calendar generation (offline)
- **Alternative:** Cache responses or batch by year instead of day

### 2. Hebrew Year Boundaries
Jewish year doesn't align with Gregorian year:
- **Solution:** Use hebcal-go's `HebrewCalendar()` function with Hebrew year numbers
- Generate events by Hebrew year 5775-5785

### 3. Database Match Function
Current `match_hebcal_event()` function uses regex:
- **Verify:** PostgreSQL regex matches exactly as documented
- **Test:** Edge cases like "Rosh Hashana" (no number) vs. "Rosh Hashana II"

### 4. Transliteration Variations
HebCal supports Ashkenazi (`lg=a`) and Sephardi (default):
- **Test both:** Some tags have Ashkenazi/Sephardi variants
- **Example:** "Sukkos" (Ashkenazi) vs. "Sukkot" (Sephardi)

---

## Success Criteria

✅ **100% Coverage Goal:**
- Every HebCal event either maps to a tag OR is documented as intentionally unmapped
- No "silent failures" where events are lost

✅ **Zero False Positives:**
- Tags only match appropriate events
- Regex patterns don't over-match

✅ **Documentation:**
- Clear explanation for every unmapped event
- Recommendations for gaps (add tag vs. ignore)

✅ **Repeatability:**
- Audit can be re-run automatically
- Future HebCal API changes can be detected

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| HebCal API changes event names | High | Low | Maintain audit as regression test |
| Regex patterns don't match all variations | Medium | Medium | Test across 10 years to catch all |
| Translation differences (Ashkenazi vs Sephardi) | Medium | Medium | Test both transliteration modes |
| Performance (7,300+ API calls) | Low | High | Use hebcal-go library offline mode |

---

## Open Questions for Decision

1. **Omer Count Events:**
   - HebCal returns "1st day of the Omer", "2nd day of the Omer", etc. (49 events)
   - Do we want to track these? Create `omer` tag or ignore?
   - **Recommendation:** Add category tag `hebcal_omer` (hidden) to match but not display

2. **Torah Reading Events:**
   - Currently disabled (`s=off` parameter)
   - Should we enable and create hidden tags for data completeness?
   - **Recommendation:** Keep disabled unless needed for future features

3. **Yom Tov Sheni Variation:**
   - Diaspora has extra days (e.g., "Pesach VIII" only in diaspora)
   - Verify current regex patterns handle both Israel/Diaspora variants
   - **Action Required:** Test explicitly

4. **Observed Fast Days:**
   - Some fasts move (e.g., "Tzom Gedaliah (observed)")
   - Current exact matches may miss " (observed)" suffix
   - **Action Required:** Update patterns to handle optional " (observed)"

---

## Next Steps - Awaiting Your Approval

**Option 1: Proceed with Implementation (Recommended)**
I'll build the audit tool as outlined above and generate the comprehensive reports.

**Option 2: Refine the Approach**
If you have specific concerns or want to adjust the scope (e.g., fewer years, different locations, additional test cases), let me know.

**Option 3: Quick Spot Check First**
Before full implementation, run a quick manual test of 1 year in both locations to validate the approach.

**What's your preference, Daniel?**

---

## Appendix A: Example Code Structure

```go
// api/internal/calendar/hebcal_coverage_test.go
package calendar_test

import (
    "context"
    "testing"
    "time"

    "github.com/hebcal/hebcal-go/hebcal"
    "zmanim/api/internal/calendar"
    "zmanim/api/internal/db"
)

func TestHebCalEventCoverage(t *testing.T) {
    // Test across 10 Hebrew years in 2 locations
    years := []int{5775, 5776, 5777, 5778, 5779, 5780, 5781, 5782, 5783, 5784, 5785}
    locations := []struct{
        name string
        lat  float64
        lng  float64
    }{
        {"Jerusalem", 31.7683, 35.2137},
        {"Salford", 53.4875, -2.2901},
    }

    var allEvents []Event
    for _, year := range years {
        for _, loc := range locations {
            events := collectEventsForYear(t, year, loc)
            allEvents = append(allEvents, events...)
        }
    }

    // Match events against database
    matchResults := auditMatching(t, allEvents)

    // Generate reports
    generateCoverageReports(t, matchResults)

    // Assertions
    unmapped := countUnmapped(matchResults)
    t.Logf("Coverage: %d/%d events matched (%.1f%%)",
        len(matchResults)-unmapped, len(matchResults),
        float64(len(matchResults)-unmapped)/float64(len(matchResults))*100)

    // Fail if coverage below threshold (or just warn?)
    if unmapped > 0 {
        t.Logf("WARNING: %d events unmapped - see reports", unmapped)
    }
}
```

---

## Appendix B: Sample Report Format

```markdown
# HebCal Tag Coverage Audit Report
**Date:** 2025-12-25
**Years Tested:** 5775-5785 (10 Hebrew years)
**Locations:** Jerusalem, Salford

## Summary
- Total Unique Events: 147
- Events Mapped: 142 (96.6%)
- Events Unmapped: 5 (3.4%)

## Unmapped Events

### 1. "1st day of the Omer" (and 48 more)
- **Category:** omer
- **Dates:** 2025-04-14 to 2025-06-01 (49 days)
- **Locations:** Both
- **Recommendation:** Add category tag `hebcal_omer` (hidden)
- **SQL:**
  ```sql
  INSERT INTO zman_tags (tag_key, display_name_hebrew, ..., hebcal_match_type, hebcal_match_category)
  VALUES ('hebcal_omer', 'ספירת העומר', ..., 'category', 'omer');
  ```

### 2. "Tzom Gedaliah (observed)"
- **Category:** fast
- **Date:** 2025-09-28 (year 5776 example)
- **Locations:** Both
- **Issue:** Current exact match for "Tzom Gedaliah" doesn't match with " (observed)" suffix
- **Recommendation:** Change to group match with pattern
- **SQL:**
  ```sql
  UPDATE zman_tags
  SET hebcal_match_type = 'group',
      hebcal_match_pattern = '^Tzom Gedaliah( \(observed\))?$',
      hebcal_match_string = NULL
  WHERE tag_key = 'tzom_gedaliah';
  ```

## Unused Tags (Never Matched)
None found! All 53 mappable tags matched at least once across 10 years.

## Coverage by Category
| Category | Matched | Unmapped | % |
|----------|---------|----------|---|
| holiday | 45 | 0 | 100% |
| fast | 6 | 1 | 85.7% |
| omer | 0 | 49 | 0% |
```
