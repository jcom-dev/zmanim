# HebCal Tag Coverage Audit - Phase 2: Tag Matching

## Overview

Phase 2 tests all HebCal events collected in Phase 1 against the PostgreSQL database matching function `match_hebcal_event()` to verify 100% coverage in the tag-driven architecture.

## Implementation

**File:** `/home/daniel/repos/zmanim/api/internal/calendar/hebcal_matching_audit_test.go`

**Test Function:** `TestHebCalTagMatching`

## What It Does

1. **Collects Events** - Gathers all HebCal events across 10 Hebrew years (5775-5785) in 2 locations (Jerusalem and Salford)

2. **Tests Database Matching** - For each unique event, calls:
   ```sql
   SELECT tag_id, tag_key, match_type
   FROM match_hebcal_event($1, $2)
   ```
   Where:
   - `$1` = HebCal event title (e.g., "Chanukah: 3 Candles", "Yom Kippur")
   - `$2` = HebCal category (e.g., "holiday", "fast", "roshchodesh")

3. **Tracks Match Results** - Records for each event:
   - Matched Tag (or empty if no match)
   - Match Type (exact, group, category, or empty)
   - Original HebCal metadata (title, category, date, location)

4. **Generates Reports** - Creates CSV with all results and comprehensive statistics

## How to Run

### Prerequisites

1. **Database must be running** with current schema
2. **Set DATABASE_URL** environment variable:
   ```bash
   source api/.env
   ```

### Run the Test

#### Option 1: Using the convenience script
```bash
./scripts/run-hebcal-matching-audit.sh
```

#### Option 2: Direct test execution
```bash
cd api
go test -v -timeout=10m ./internal/calendar -run=TestHebCalTagMatching
```

### Expected Output

```
=== RUN   TestHebCalTagMatching
Starting HebCal Tag Matching Audit - Phase 2: Tag Matching
Testing 10 Hebrew years across 2 locations
Collecting events for location: Jerusalem (IsIsrael=true)
Collecting events for location: Salford (IsIsrael=false)
Collected 7892 total event instances
Tested 147 unique events against database
Completed matching for 147 events

=== Match Statistics ===
Total Unique Events: 147
Mapped: 142 (96.6%)
Unmapped: 5 (3.4%)

=== Match Type Breakdown ===
  category: 12 (8.5% of mapped)
  exact: 108 (76.1% of mapped)
  group: 22 (15.5% of mapped)

=== Coverage by Category ===
  fast: 7/7 mapped (100.0%)
  holiday: 89/92 mapped (96.7%)
  mevarchim: 12/12 mapped (100.0%)
  omer: 0/49 mapped (0.0%)
  roshchodesh: 14/14 mapped (100.0%)

=== Unmapped Events (5) ===
  Category: omer (49 events)
    - 1st day of the Omer (location: Jerusalem)
    - 2nd day of the Omer (location: Jerusalem)
    - 3rd day of the Omer (location: Jerusalem)
    - 4th day of the Omer (location: Jerusalem)
    - 5th day of the Omer (location: Jerusalem)
    ... and 44 more

=== AUDIT SUMMARY ===
Coverage: 96.6% (142/147 events matched)
WARNING: 5 events unmapped
See _bmad-output/hebcal-audit-match-results.csv for full details
--- PASS: TestHebCalTagMatching (12.34s)
```

## Output Files

### CSV Report
**Location:** `_bmad-output/hebcal-audit-match-results.csv`

**Columns:**
- HebCal Title - The event name from HebCal
- HebCal Category - The category (holiday, fast, etc.)
- Date - First occurrence date (YYYY-MM-DD)
- Location - Test location (Jerusalem or Salford)
- Israel Mode - true/false
- Matched Tag - The tag_key that matched (empty if no match)
- Match Type - exact, group, category (empty if no match)
- Hebrew Year - The Hebrew year tested

**Example Rows:**
```csv
HebCal Title,HebCal Category,Date,Location,Israel Mode,Matched Tag,Match Type,Hebrew Year
Yom Kippur,holiday,2015-09-23,Jerusalem,true,yom_kippur,exact,5776
Chanukah: 1 Candles,holiday,2015-12-07,Jerusalem,true,chanukah,group,5776
Candle lighting,candles,2015-01-02,Jerusalem,true,candles,category,5775
1st day of the Omer,omer,2015-04-05,Jerusalem,true,,,5775
```

## Match Types Explained

### 1. Category Match (Priority 1)
Maps HebCal's `category` field to internal tags.

**Tags using category match (5):**
- `candles` (hebcal_category: "candles")
- `havdalah` (hebcal_category: "havdalah")
- `mevarchim` (hebcal_category: "mevarchim")
- `parashat` (hebcal_category: "parashat")
- `roshchodesh` (hebcal_category: "roshchodesh")

**Database Column:** `zman_tags.hebcal_match_category`

### 2. Exact Match (Priority 2)
Maps exact HebCal title strings.

**Examples:**
- "Yom Kippur" → `yom_kippur`
- "Erev Pesach" → `erev_pesach`
- "Purim" → `purim`

**Database Column:** `zman_tags.hebcal_match_string`

**Count:** 42 tags use exact matching

### 3. Group/Regex Match (Priority 3)
Maps multi-day events using PostgreSQL regex patterns.

**Examples:**
- `^Chanukah:` → `chanukah` (matches "Chanukah: 1 Candles", "Chanukah: 2 Candles", etc.)
- `^Pesach [IVX]+` → `pesach` (matches "Pesach I", "Pesach II", etc.)
- `^Sukkot [IVX]+` → `sukkos` (matches "Sukkot I", "Sukkot II", etc.)

**Database Column:** `zman_tags.hebcal_match_pattern`

**Count:** 6 tags use group matching

## Key Insights

### What Gets Tested
- ✅ All major holidays (Rosh Hashana, Yom Kippur, Sukkot, Pesach, Shavuot, etc.)
- ✅ All minor holidays (Chanukah, Purim, etc.)
- ✅ All fast days (Yom Kippur, Tisha B'Av, minor fasts)
- ✅ Rosh Chodesh (all 12 months + leap year)
- ✅ Special Shabbatot (Shekalim, Zachor, Parah, etc.)
- ✅ Modern holidays (Yom HaAtzmaut, Yom Yerushalayim)
- ✅ Multi-day events (all 8 days of Chanukah, all days of Pesach, etc.)

### Israel vs. Diaspora Testing
The test runs in **both modes** to catch:
- Yom Tov Sheni differences (extra day in diaspora)
- Shushan Purim (Jerusalem vs. other cities)
- Different Chol HaMoed patterns

### Deduplication
Events are deduplicated by `(Title, Category, Location)` to avoid testing the same event multiple times across different dates.

## Common Unmapped Events

Based on the audit plan, expected unmapped events include:

### 1. Omer Count (49 events)
**Events:** "1st day of the Omer", "2nd day of the Omer", ..., "49th day of the Omer"

**Decision Required:**
- Add category tag `hebcal_omer` (hidden) to track but not display?
- Or intentionally ignore?

**Recommendation:** Add category tag for completeness

### 2. Parashat (weekly Torah readings)
**Category:** parashat (hidden by default)

**Status:** Should already be handled by category match

### 3. Observed Fast Days
**Examples:** "Tzom Gedaliah (observed)" when falls on Shabbat

**Issue:** Current exact matches may miss " (observed)" suffix

**Fix Required:** Change to group match with pattern like:
```sql
UPDATE zman_tags
SET hebcal_match_type = 'group',
    hebcal_match_pattern = '^Tzom Gedaliah( \(observed\))?$'
WHERE tag_key = 'tzom_gedaliah';
```

## Troubleshooting

### Test Skipped
**Error:** "Skipping database test - DATABASE_URL not set"

**Solution:**
```bash
source api/.env
```

### Connection Refused
**Error:** "Failed to connect to database: connection refused"

**Solution:** Start the database:
```bash
./restart.sh
```

### Timeout
**Error:** "test timed out after 2m0s"

**Solution:** Increase timeout:
```bash
go test -v -timeout=10m ./internal/calendar -run=TestHebCalTagMatching
```

## Code Structure

### Main Test Function
```go
func TestHebCalTagMatching(t *testing.T)
```
- Orchestrates the entire audit process
- Skips if DATABASE_URL not set
- Collects events, matches them, generates reports

### Database Matching
```go
func auditEventMatching(t *testing.T, db *sql.DB, events []AuditEvent) ([]MatchResult, error)
```
- Tests each unique event against `match_hebcal_event()`
- Handles NULL returns (no match)
- Deduplicates events

### Statistics
```go
func calculateMatchStatistics(results []MatchResult) MatchStatistics
```
- Counts mapped vs. unmapped
- Breaks down by match type
- Analyzes by category

### Reporting
```go
func reportMatchStatistics(t *testing.T, stats MatchStatistics)
```
- Logs comprehensive statistics
- Groups unmapped events by category
- Shows coverage percentages

### CSV Export
```go
func exportMatchResultsToCSV(results []MatchResult) error
```
- Writes all results to CSV
- Sorts by category, then title
- Creates `_bmad-output/hebcal-audit-match-results.csv`

## Next Steps (Phase 3)

After running Phase 2, proceed to Phase 3:

1. **Analyze Unmapped Events** - Review the CSV to see what didn't match

2. **Generate Recommendations** - For each unmapped event:
   - Add new tag?
   - Extend existing pattern?
   - Intentionally ignore?
   - Flag as data quality issue?

3. **Create Action Items** - Generate SQL scripts to fix gaps

4. **Validate Multi-Day Events** - Verify all 8 days of Chanukah match, all days of Pesach, etc.

5. **Document Intentional Gaps** - Explain why certain events are unmapped (e.g., Omer count)

## Related Files

- **Phase 1 Test:** `api/internal/calendar/hebcal_coverage_test.go`
- **Helper Types:** `api/internal/calendar/audit_helpers.go`
- **Database Function:** `db/migrations/00000000000001_schema.sql` (search for `match_hebcal_event`)
- **Tag Schema:** `db/migrations/00000000000001_schema.sql` (table `zman_tags`)
- **Audit Plan:** `_bmad-output/hebcal-tag-coverage-audit-plan.md`
