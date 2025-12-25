# HebCal Event Coverage Test Suite

## Quick Start

### Run All Tests
```bash
cd /home/daniel/repos/zmanim/api
go test -v ./internal/calendar -run Test
```

### Run Specific Test
```bash
# Find unmapped events
go test -v ./internal/calendar -run TestEventCoverage

# Test specific dates
go test -v ./internal/calendar -run TestSpecificDates

# Test multi-day events
go test -v ./internal/calendar -run TestMultiDayEvents

# Test Israel vs Diaspora
go test -v ./internal/calendar -run TestIsraelDiasporaDifferences
```

### Run SQL Validation
```bash
source api/.env
psql "$DATABASE_URL" -c "SELECT * FROM tag_event_mappings ORDER BY priority DESC, event_name_pattern;"
```

## What This Test Suite Does

This comprehensive test suite validates **100% coverage** of all Jewish calendar events from the hebcal-go library against:

1. **Go Code Logic** - `mapHolidayToEventCode()` function in `events.go`
2. **Database Patterns** - `tag_event_mappings` table entries
3. **Event Behavior** - Multi-day events, Israel vs Diaspora, erev events, fasts

## Files in This Suite

| File | Purpose | Lines |
|------|---------|-------|
| **events_coverage_test.go** | Go test suite - 6 test functions | 850+ |
| **SQL_VALIDATION_QUERIES.md** | 15 SQL queries for database validation | 400+ |
| **TEST_DATES.md** | 100+ test dates with expected outcomes | 600+ |
| **COVERAGE_TEST_SUMMARY.md** | Detailed analysis and implementation plan | 500+ |
| **EVENT_COVERAGE_README.md** | This file - quick reference | 200+ |

## Current Status (As of 2025-12-24)

### Coverage Statistics
- **Total hebcal-go events**: 86
- **Mapped events**: 60 (70%)
- **Unmapped events**: 26 (30%)

### Test Results
- **TestEventCoverage**: ❌ FAILING (26 unmapped events)
- **TestSpecificDates**: ❌ FAILING (16/43 tests fail)
- **TestMultiDayEvents**: ⏸️ NOT RUN YET
- **TestErevEvents**: ⏸️ NOT RUN YET
- **TestFastDays**: ⏸️ NOT RUN YET
- **TestIsraelDiasporaDifferences**: ⏸️ NOT RUN YET

### Priority Fixes Needed

#### 1. High Priority: Special Shabbatot (9 events)
❌ Shabbat Zachor
❌ Shabbat Shekalim
❌ Shabbat Parah
❌ Shabbat HaChodesh
❌ Shabbat HaGadol
❌ Shabbat Chazon
❌ Shabbat Nachamu
❌ Shabbat Shuva
❌ Shabbat Shirah

#### 2. High Priority: Minor Holidays (4 events)
❌ Tu BiShvat
❌ Lag BaOmer
❌ Tu B'Av
❌ Pesach Sheni

#### 3. High Priority: Important Erev Events (2 events)
❌ Erev Pesach
❌ Erev Sukkot

#### 4. High Priority: Fast Days (1 event)
❌ Ta'anit Bechorot

#### 5. Medium Priority: Chol HaMoed Details (2 events)
❌ Sukkot V (CH''M)
❌ Pesach V (CH''M)

Note: Current code maps "Chol HaMoed" generically but doesn't extract individual days.

#### 6. Medium Priority: Modern Israeli Holidays (5 events)
❌ Yom HaShoah
❌ Yom HaZikaron
❌ Yom HaAtzma'ut
❌ Yom Yerushalayim
❌ Yom HaAliyah

#### 7. Low Priority: Other Events (3 events)
❌ Leil Selichot
❌ Sigd
❌ Chag HaBanot

## How to Use This Suite

### For Development

1. **Before Making Changes**
   ```bash
   # Run tests to establish baseline
   cd api && go test -v ./internal/calendar -run TestEventCoverage > /tmp/before.txt
   ```

2. **Make Your Changes**
   - Update `mapHolidayToEventCode()` in `events.go`
   - Add patterns to `tag_event_mappings` in database

3. **After Making Changes**
   ```bash
   # Run tests to see improvement
   cd api && go test -v ./internal/calendar -run TestEventCoverage > /tmp/after.txt
   diff /tmp/before.txt /tmp/after.txt
   ```

### For Validation

1. **Check Code Coverage**
   ```bash
   cd api && go test -v ./internal/calendar -run TestEventCoverage
   ```
   Look for "Total unmapped events: 0" in output.

2. **Check Database Coverage**
   ```bash
   source api/.env
   psql "$DATABASE_URL" -f api/internal/calendar/SQL_VALIDATION_QUERIES.md
   ```
   Run queries #6, #7, #8 for major holidays, fasts, special Shabbatot.

3. **Check Behavior**
   ```bash
   cd api && go test -v ./internal/calendar -run TestSpecificDates
   ```
   All 43 test cases should PASS.

### For Debugging

1. **Find Unmapped Event Details**
   ```bash
   cd api
   go test -v ./internal/calendar -run TestEventCoverage 2>&1 | grep "  -"
   ```

2. **Test Specific Date**
   ```bash
   # Edit events_coverage_test.go, add your date to TestSpecificDates
   cd api
   go test -v ./internal/calendar -run "TestSpecificDates/Your_Test_Name"
   ```

3. **Check Database Pattern**
   ```bash
   source api/.env
   psql "$DATABASE_URL" -c "SELECT * FROM tag_event_mappings WHERE event_name_pattern LIKE '%Pesach%';"
   ```

## Test Scenarios Covered

### 1. Major Holidays (Yom Tov)
- Rosh Hashana (2 days)
- Yom Kippur
- Sukkot (2 days + Shemini Atzeret + Simchat Torah)
- Pesach (2 days first + 2 days last)
- Shavuot (1 day Israel, 2 days Diaspora)

### 2. Fast Days
- Yom Kippur (sunset start)
- Tisha B'Av (sunset start)
- Tzom Gedaliah (dawn start)
- Asara B'Tevet (dawn start)
- Ta'anit Esther (dawn start)
- Tzom Tammuz / 17 Tammuz (dawn start)
- Ta'anit Bechorot (dawn start)

### 3. Multi-Day Holidays
- Chanukah (8 days, each numbered 1/8 through 8/8)
- Rosh Hashana (2 days)
- Pesach (8 days including Chol HaMoed)
- Sukkot (7 days including Chol HaMoed)

### 4. Special Shabbatot
- Shabbat Shekalim, Zachor, Parah, HaChodesh (before Pesach)
- Shabbat HaGadol (before Pesach)
- Shabbat Chazon (before Tisha B'Av)
- Shabbat Nachamu (after Tisha B'Av)
- Shabbat Shuva (between Rosh Hashana and Yom Kippur)
- Shabbat Shirah (Parshat Beshalach)

### 5. Israel vs Diaspora Differences
- Sukkot: 1 day Yom Tov (Israel) vs 2 days (Diaspora)
- Pesach: 1 day Yom Tov (Israel) vs 2 days (Diaspora)
- Shavuot: 1 day (Israel) vs 2 days (Diaspora)
- Shemini Atzeret/Simchat Torah: Same day (Israel) vs 2 days (Diaspora)

### 6. Chol HaMoed
- Sukkot: 5 days (days 3-7 in Israel, days 3-6 in Diaspora)
- Pesach: 4-5 days depending on location

### 7. Minor Holidays
- Tu BiShvat
- Purim + Shushan Purim
- Lag BaOmer
- Tu B'Av
- Rosh Chodesh (1-2 days)

### 8. Erev Events
- Erev Shabbat (Friday)
- Erev Pesach
- Erev Sukkot
- Erev Rosh Hashana
- Erev Yom Kippur
- Erev Shavuot

### 9. Edge Cases
- Shabbat + Holiday combination
- Multiple events same day (e.g., Chanukah + Rosh Chodesh)
- Rosh Chodesh on Shabbat
- Regular weekdays (no events)
- Regular Shabbat (no special event)

## Implementation Workflow

### Step 1: Identify Gaps
```bash
cd api
go test -v ./internal/calendar -run TestEventCoverage 2>&1 | tee /tmp/gaps.txt
grep "  -" /tmp/gaps.txt
```

### Step 2: Choose Event to Fix
Pick one unmapped event from the list, e.g., "Shabbat Zachor"

### Step 3: Add to mapHolidayToEventCode()
**File**: `api/internal/calendar/events.go`

Add case to the switch statement:
```go
case contains(name, "Shabbat Zachor"):
    return "shabbat_zachor", 1, 1
```

### Step 4: Verify Database Pattern Exists
```bash
source api/.env
psql "$DATABASE_URL" -c "SELECT * FROM tag_event_mappings WHERE event_name_pattern = 'Shabbat Zachor';"
```

If missing, add to database:
```sql
INSERT INTO tag_event_mappings (zman_tag_id, event_name_pattern, priority)
SELECT zt.id, 'Shabbat Zachor', 10
FROM zman_tags zt
WHERE zt.tag_key = 'shabbat_zachor';
```

### Step 5: Test
```bash
cd api
go test -v ./internal/calendar -run TestEventCoverage
```

### Step 6: Repeat
Continue until "Total unmapped events: 0"

## Expected Timeline

### Quick Wins (1-2 hours)
- Add all special Shabbatot (9 events)
- Add all minor holidays (4 events)
- Add important erev events (2 events)
- Total: 15 events → 57% reduction in unmapped events

### Medium Effort (2-3 hours)
- Add modern Israeli holidays (5 events)
- Add Ta'anit Bechorot (1 event)
- Fix Chol HaMoed day numbering (2 events)
- Total: 8 events → 88% reduction in unmapped events

### Full Coverage (4-5 hours total)
- Add remaining events (3 events)
- Fix all TestSpecificDates failures
- Validate with SQL queries
- Documentation updates
- Total: 26 events → 100% coverage

## Success Metrics

### Milestone 1: High Priority Events (Target: 2 hours)
- [ ] All special Shabbatot mapped (9/9)
- [ ] All minor holidays mapped (4/4)
- [ ] Important erev events mapped (2/2)
- [ ] Ta'anit Bechorot mapped (1/1)
- **Target**: 16/26 events = 62% → 81% total coverage

### Milestone 2: Full Event Coverage (Target: 5 hours)
- [ ] All 86 hebcal-go events mapped
- [ ] TestEventCoverage shows 0 unmapped events
- **Target**: 26/26 events = 100% total coverage

### Milestone 3: Behavior Validation (Target: 7 hours)
- [ ] TestSpecificDates passes 43/43 tests
- [ ] TestMultiDayEvents passes all tests
- [ ] TestIsraelDiasporaDifferences passes all tests
- [ ] TestErevEvents passes all tests
- [ ] TestFastDays passes all tests

### Milestone 4: Database Validation (Target: 8 hours)
- [ ] SQL query #6 shows 100% major holiday coverage
- [ ] SQL query #7 shows 100% fast day coverage
- [ ] SQL query #8 shows 100% special Shabbat coverage
- [ ] No orphaned tags (SQL query #3)
- [ ] No malformed patterns (SQL query #5)

## Maintenance Schedule

### Weekly
- Run TestEventCoverage in CI/CD
- Monitor for any hebcal-go library updates

### Monthly
- Review SQL query #1 (coverage statistics)
- Check for new event types

### Annually (Before Tishrei)
- Add new Hebrew year to test suite (e.g., 5788)
- Update TEST_DATES.md with new dates
- Run full validation suite
- Update documentation if event names changed

## Common Issues

### Issue: "Event not found in ActiveEvents"
**Cause**: `mapHolidayToEventCode()` doesn't handle this event name
**Fix**: Add case to switch statement in events.go

### Issue: "Unexpected event code found"
**Cause**: Event mapped but shouldn't be for this date
**Fix**: Check date in test or logic in mapHolidayToEventCode()

### Issue: "IsFinalDay = false, want true"
**Cause**: Day numbering incorrect (e.g., showing 1/2 instead of 1/1)
**Fix**: Check totalDays calculation in mapHolidayToEventCode()

### Issue: "Expected erev event not found"
**Cause**: getErevEvents() doesn't detect tomorrow's event
**Fix**: Check getHebcalEvents() is called for tomorrow

### Issue: "Pattern not found in database"
**Cause**: Missing tag_event_mappings entry
**Fix**: Run SQL queries to find gap, add INSERT statement

## Resources

### Documentation
- [HebCal Go Documentation](https://pkg.go.dev/github.com/hebcal/hebcal-go)
- [HDate Documentation](https://pkg.go.dev/github.com/hebcal/hdate)
- [Hebrew Calendar Basics](https://www.hebcal.com/home/195/jewish-calendar-facts)

### Code References
- `api/internal/calendar/events.go` - Main event logic
- `api/internal/calendar/hebcal.go` - HebCal API integration
- `db/migrations/00000000000002_seed_data.sql` - Database seed data

### Test Data
- TEST_DATES.md - Comprehensive test date reference
- COVERAGE_TEST_SUMMARY.md - Detailed analysis

### SQL Tools
- SQL_VALIDATION_QUERIES.md - Database validation queries

## Getting Help

### Check Test Output
```bash
cd api
go test -v ./internal/calendar -run TestEventCoverage 2>&1 | less
```

### Check Specific Event
```bash
# Replace "Shabbat Zachor" with your event
cd api
go test -v ./internal/calendar -run TestEventCoverage 2>&1 | grep -A2 "Shabbat Zachor"
```

### Debug Specific Date
```bash
# Add t.Logf() statements to events_coverage_test.go
cd api
go test -v ./internal/calendar -run "TestSpecificDates/Your_Test"
```

### Database Debug
```bash
source api/.env
psql "$DATABASE_URL" -c "SELECT zt.tag_key, tem.event_name_pattern FROM tag_event_mappings tem JOIN zman_tags zt ON zt.id = tem.zman_tag_id WHERE event_name_pattern LIKE '%your_pattern%';"
```

## Next Steps

1. **Immediate**: Run TestEventCoverage to see current state
2. **Short-term**: Fix high priority events (special Shabbatot, minor holidays)
3. **Medium-term**: Achieve 100% event coverage
4. **Long-term**: Add to CI/CD, maintain over time

## Contact

For questions or issues with this test suite, refer to:
- COVERAGE_TEST_SUMMARY.md for detailed analysis
- TEST_DATES.md for specific test scenarios
- SQL_VALIDATION_QUERIES.md for database validation
