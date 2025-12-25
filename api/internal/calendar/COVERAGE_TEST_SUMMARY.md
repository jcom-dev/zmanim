# HebCal Event Coverage Test Suite - Summary

## Overview
This test suite validates 100% coverage of all hebcal-go events against our database tag_event_mappings and Go code logic in `mapHolidayToEventCode()`.

## Files Created

### 1. events_coverage_test.go
**Location**: `/home/daniel/repos/zmanim/api/internal/calendar/events_coverage_test.go`

**Purpose**: Comprehensive Go test suite that validates event coverage and behavior

**Test Functions**:
- `TestEventCoverage` - Validates ALL hebcal-go events are mapped (currently finds 26 unmapped)
- `TestSpecificDates` - Tests specific known dates with expected events
- `TestMultiDayEvents` - Validates multi-day event day numbering (1/8, 2/8, etc.)
- `TestErevEvents` - Validates erev event detection
- `TestFastDays` - Validates fast day detection and properties
- `TestIsraelDiasporaDifferences` - Validates Israel vs Diaspora differences

**Run Commands**:
```bash
# Run all coverage tests
cd api && go test -v ./internal/calendar -run Test

# Run specific test
cd api && go test -v ./internal/calendar -run TestEventCoverage

# Run with verbose output
cd api && go test -v ./internal/calendar -run TestSpecificDates
```

### 2. SQL_VALIDATION_QUERIES.md
**Location**: `/home/daniel/repos/zmanim/api/internal/calendar/SQL_VALIDATION_QUERIES.md`

**Purpose**: 15 SQL queries for validating database coverage

**Key Queries**:
1. Coverage statistics
2. List all event patterns by tag
3. Find tags without event mappings
4. Check for duplicate patterns
5. Validate pattern syntax
6. Major holidays coverage check
7. Fast days coverage check
8. Special Shabbatot coverage check
9. Erev events coverage
10. Pattern priority analysis
11. Tag type distribution
12. Chol HaMoed validation
13. Wildcard pattern analysis
14. Find coverage gaps
15. Cross-reference visibility flags

**Run Example**:
```bash
source api/.env && psql "$DATABASE_URL" -f api/internal/calendar/SQL_VALIDATION_QUERIES.md
# Or run individual queries
```

### 3. TEST_DATES.md
**Location**: `/home/daniel/repos/zmanim/api/internal/calendar/TEST_DATES.md`

**Purpose**: Comprehensive reference of test dates organized by category

**Categories**:
- High Holidays (Rosh Hashana, Yom Kippur)
- Sukkot and related (7 days + Shemini Atzeret/Simchat Torah)
- Pesach (8 days including Chol HaMoed)
- Shavuot (Israel 1 day, Diaspora 2 days)
- Chanukah (8 days)
- Purim (3 days including Ta'anit Esther)
- Fast Days (6 major/minor fasts)
- Special Shabbatot (9 special Shabbatot)
- Rosh Chodesh (1-2 day events)
- Minor Holidays (Tu BiShvat, Lag BaOmer, Tu B'Av, etc.)
- Sefirat HaOmer (49 days)
- Erev Events
- Regular weekdays and Shabbatot
- Edge cases (Shabbat + Holiday, multiple events, etc.)

**Total Test Scenarios**: 100+ specific dates with expected outcomes

## Current Test Results

### TestEventCoverage Results
**Status**: FAILING (Expected - shows gaps to fix)

**Findings**:
- Total unique events from hebcal-go: **86**
- Unmapped events: **26** (30% unmapped)
- Mapped events: **60** (70% coverage)

**Unmapped Events** (need to add to `mapHolidayToEventCode()`):
1. Chag HaBanot
2. Shabbat Zachor ⚠️ (Special Shabbat)
3. Shabbat HaChodesh ⚠️ (Special Shabbat)
4. Pesach Sheni
5. Yom Yerushalayim
6. Shabbat Chazon ⚠️ (Special Shabbat)
7. Shabbat Nachamu ⚠️ (Special Shabbat)
8. Shabbat Shuva ⚠️ (Special Shabbat)
9. Yom HaAliyah
10. Yom HaShoah
11. Yom HaAtzma'ut
12. Lag BaOmer ⚠️ (Minor holiday)
13. Tu B'Av ⚠️ (Minor holiday)
14. Leil Selichot
15. Sukkot V (CH''M) ⚠️ (Chol HaMoed)
16. Pesach V (CH''M) ⚠️ (Chol HaMoed)
17. Yom HaZikaron
18. Erev Pesach ⚠️ (Important erev)
19. Sigd
20. Shabbat Shirah ⚠️ (Special Shabbat)
21. Tu BiShvat ⚠️ (Minor holiday)
22. Shabbat Shekalim ⚠️ (Special Shabbat)
23. Shabbat Parah ⚠️ (Special Shabbat)
24. Ta'anit Bechorot ⚠️ (Fast day)
25. Shabbat HaGadol ⚠️ (Special Shabbat)
26. Erev Sukkot ⚠️ (Important erev)

⚠️ = High priority (referenced in database or commonly used)

### TestSpecificDates Results
**Status**: FAILING (Expected - shows implementation gaps)

**Passing**: 27/43 test cases (63%)
**Failing**: 16/43 test cases (37%)

**Key Issues Found**:
1. **Chol HaMoed detection broken** - Israel Sukkot Day 2 mapped to "sukkos" instead of "chol_hamoed_sukkos"
2. **Chol HaMoed Pesach broken** - Not detecting Chol HaMoed days correctly
3. **Hoshana Raba** - Not extracting as separate event, just "Sukkot VII"
4. **Incorrect Shabbat detection** - Some test dates have wrong day of week
5. **Purim/Ta'anit Esther overlap** - Ta'anit Esther test shows unexpected purim code

### Other Test Results
**Not yet run** - waiting for implementation fixes:
- TestMultiDayEvents
- TestErevEvents
- TestFastDays
- TestIsraelDiasporaDifferences

## Root Causes

### Issue 1: mapHolidayToEventCode() Incomplete
**Location**: `api/internal/calendar/events.go:310-412`

**Problems**:
1. Only handles ~20 event types, missing 26 event types
2. String matching logic is too simplistic
3. Doesn't handle all hebcal-go event name variations
4. Missing special Shabbatot (9 events)
5. Missing minor holidays
6. Missing modern Israeli holidays
7. Missing Chol HaMoed individual days

**Example Current Logic**:
```go
case contains(name, "Sukkot") && contains(name, "Chol ha-Moed"):
    return "chol_hamoed_sukkos", 1, 1
```
This doesn't distinguish between different Chol HaMoed days.

### Issue 2: Day Numbering for Chol HaMoed
**Location**: Same function

**Problem**: Chol HaMoed days all return `1, 1` instead of proper day numbering

**Should be**:
- Sukkot III (CH"M) = chol_hamoed_sukkos, day 1/5
- Sukkot IV (CH"M) = chol_hamoed_sukkos, day 2/5
- Sukkot V (CH"M) = chol_hamoed_sukkos, day 3/5
- Sukkot VI (CH"M) = chol_hamoed_sukkos, day 4/5
- Hoshana Raba = hoshanah_rabbah, day 1/1 (also chol_hamoed_sukkos day 5/5)

### Issue 3: Test Date Accuracy
**Location**: `events_coverage_test.go`

**Problem**: Some test dates have incorrect day of week

**Need to verify**:
- 2025-10-11 (claimed to be Shabbat Chol HaMoed but test failed)
- 2025-04-19 (claimed to be Saturday but might not be)
- 2025-03-15 (Shushan Purim claimed to be Saturday)

## Recommendations

### Priority 1: Fix mapHolidayToEventCode()
1. Add all 26 unmapped events to the switch statement
2. Handle Chol HaMoed day numbering properly
3. Add special Shabbatot mapping
4. Add minor holidays mapping
5. Add erev events mapping
6. Add modern Israeli holidays mapping

### Priority 2: Database Coverage
1. Run SQL query #6 (Major holidays coverage) to verify database has all patterns
2. Run SQL query #7 (Fast days coverage) to verify all fasts
3. Run SQL query #8 (Special Shabbatot coverage) to verify all special Shabbatot
4. Add missing patterns to tag_event_mappings

### Priority 3: Fix Test Dates
1. Verify all test dates in TestSpecificDates
2. Fix day-of-week mismatches
3. Add more edge cases

### Priority 4: Documentation
1. Document the full hebcal-go event name format
2. Create mapping reference table (hebcal name -> event code)
3. Add examples for each event type

## Implementation Plan

### Step 1: Catalog All Events
```bash
# Run this to get full list
cd api && go test -v ./internal/calendar -run TestEventCoverage > /tmp/coverage.txt 2>&1
grep "  -" /tmp/coverage.txt
```

### Step 2: Update mapHolidayToEventCode()
Add cases for all 26 unmapped events in logical groups:
1. Special Shabbatot (9)
2. Minor holidays (4)
3. Modern Israeli holidays (5)
4. Chol HaMoed details (2)
5. Erev events (2)
6. Other (4)

### Step 3: Run SQL Validation
```bash
source api/.env
psql "$DATABASE_URL" -f api/internal/calendar/SQL_VALIDATION_QUERIES.md
```

### Step 4: Fix Database Gaps
Based on SQL results, add missing tag_event_mappings

### Step 5: Re-run Tests
```bash
cd api
go test -v ./internal/calendar -run TestEventCoverage
go test -v ./internal/calendar -run TestSpecificDates
go test -v ./internal/calendar -run TestMultiDayEvents
go test -v ./internal/calendar -run TestIsraelDiasporaDifferences
```

### Step 6: Iterate Until 100%
Repeat steps 2-5 until all tests pass

## Success Criteria

### Must Have (100% Coverage)
- [ ] All 86 hebcal-go events mapped in mapHolidayToEventCode()
- [ ] All major holidays in database tag_event_mappings
- [ ] All fast days in database tag_event_mappings
- [ ] All special Shabbatot in database tag_event_mappings
- [ ] TestEventCoverage passes with 0 unmapped events
- [ ] TestSpecificDates passes all 43 test cases

### Should Have (95%+ Coverage)
- [ ] TestMultiDayEvents passes (correct day numbering)
- [ ] TestErevEvents passes (erev detection)
- [ ] TestFastDays passes (fast properties)
- [ ] TestIsraelDiasporaDifferences passes
- [ ] SQL query #1 shows 100% pattern coverage

### Nice to Have
- [ ] Add tests for edge cases (Shabbat + Holiday)
- [ ] Add tests for multiple events same day
- [ ] Performance benchmarks
- [ ] Integration test with actual database

## Maintenance

### Annual Update
Before each Hebrew New Year (Tishrei):
1. Add new year to TestEventCoverage (e.g., 5788)
2. Update TEST_DATES.md with new year dates
3. Run full test suite
4. Fix any new event types from hebcal-go updates

### After hebcal-go Updates
When hebcal-go library updates:
1. Run TestEventCoverage to detect new events
2. Add new events to mapHolidayToEventCode()
3. Add new database patterns if needed
4. Update TEST_DATES.md if event names changed

### Continuous Validation
Add to CI/CD:
```yaml
- name: Test Event Coverage
  run: cd api && go test -v ./internal/calendar -run TestEventCoverage
```

This ensures we catch any drift immediately.

## References

### Code Files
- `api/internal/calendar/events.go` - Main event logic
- `api/internal/calendar/events_test.go` - Existing basic tests
- `api/internal/calendar/events_coverage_test.go` - New comprehensive tests (THIS SUITE)
- `api/internal/calendar/hebcal.go` - HebCal API integration
- `db/migrations/00000000000002_seed_data.sql` - tag_event_mappings data

### Database Tables
- `zman_tags` - Tag definitions (event, yomtov, fast, etc.)
- `tag_event_mappings` - Patterns that map hebcal events to tags
- `master_zmanim_registry` - Zman definitions with tag associations

### External Dependencies
- hebcal-go v0.10.6 - Jewish calendar library
- hebcal-go/event - Event types and interfaces
- hebcal-go/hdate - Hebrew date conversions
