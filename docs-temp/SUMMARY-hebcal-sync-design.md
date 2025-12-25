# Executive Summary: HebCal Tag Synchronization Design

**Date**: 2025-12-24
**Status**: Design Complete - Ready for Implementation
**Coverage**: 82.86% → Target: 100%

---

## TL;DR

**Question**: How to keep zman_tags perfectly synced with HebCal events?

**Answer**: Delete hardcoded `mapHolidayToEventCode()`, use existing database-driven pattern matching.

**Deliverables**:
1. ✅ Design document: `/home/daniel/repos/zmanim/DESIGN-hebcal-tag-sync.md`
2. ✅ Solution guide: `/home/daniel/repos/zmanim/SOLUTION-hebcal-tag-sync.md`
3. ✅ Validation script: `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh`
4. ✅ Migration SQL: `/home/daniel/repos/zmanim/db/migrations/20251224204010_add_missing_hebcal_events.sql`

---

## Key Findings

### Current Infrastructure (Already Built)

Your codebase ALREADY has everything needed:

1. **Database Pattern Matching** ✅
   - `tag_event_mappings` table with SQL LIKE patterns
   - 60 mappings covering 42 event tags
   - Priority system for generic vs specific tags

2. **Pattern Matching Code** ✅
   - `api/internal/calendar/hebcal.go:194-240`
   - `MatchEventToTags()` function supports wildcards
   - Already handles `%` wildcards like SQL LIKE

3. **Validation Script** ✅ (New)
   - Auto-fetches HebCal events for any year
   - Compares with database mappings
   - Auto-generates migration SQL for missing events
   - Current coverage: 82.86% (116/140 events)

### What's Broken (Hardcoded Logic)

**Problem File**: `/home/daniel/repos/zmanim/api/internal/calendar/events.go`

**Lines 310-425**: `mapHolidayToEventCode()` function
- Hardcoded switch statement with 30+ cases
- Duplicates database pattern logic
- No validation possible
- Requires code changes for new events

**Impact**:
- Two sources of truth (database + code)
- Maintenance burden
- Drift inevitable

---

## Design Answers

### 1. Keep mapHolidayToEventCode()?

**NO - Delete it**

Use database patterns exclusively via existing `MatchEventToTags()` function.

### 2. Multi-day Events?

**Use separate tags when zmanim differ**

Examples:
- ✅ `rosh_hashanah` - one tag for both days (same zmanim)
- ✅ `pesach_first` vs `pesach_last` - separate tags (different zmanim)
- ✅ `chanukah` - one tag for all 8 days (shared zmanim)

Database handles this with patterns:
```sql
-- One tag for both days
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
VALUES (rosh_hashanah_id, 'Rosh Hashana%');  -- Matches I and II

-- Separate tags
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
VALUES (pesach_first_id, 'Pesach I'), (pesach_first_id, 'Pesach II');
```

### 3. Generic vs Specific Tags?

**Keep BOTH - already implemented correctly**

Priority system handles this:
```sql
-- Specific fast (priority 10 = higher)
tag: tzom_gedaliah, pattern: "Tzom Gedaliah", priority: 10

-- Generic fast (priority 50 = lower)
tag: fast_day, pattern: "Tzom Gedaliah", priority: 50
```

Both tags match the event - allows specific AND generic zmanim.

### 4. Migration Strategy?

**Automated with validation script**

```bash
# Run validation
./scripts/validate-hebcal-coverage.sh 5786

# Output:
# Coverage: 82.86% (116/140 events)
# 24 unmapped events
# Migration SQL auto-generated

# Review + apply migration
psql "$DATABASE_URL" -f db/migrations/20251224204010_add_missing_hebcal_events.sql

# Re-validate
./scripts/validate-hebcal-coverage.sh 5786
# Expected: Coverage: 100.00%
```

---

## Architecture

### Before (Current - BROKEN)

```
┌─────────────────────────────────────────────┐
│ HebCal API                                  │
│ Returns: "Rosh Hashana 9547"                │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ mapHolidayToEventCode() [HARDCODED]         │
│ switch {                                     │
│   case contains("Rosh Hashana"):            │
│       return "rosh_hashanah"                │
│ }                                            │
└──────────────────┬──────────────────────────┘
                   ↓
              event codes
```

**Problems**:
- ❌ New events require Go code changes
- ❌ No validation possible
- ❌ Two sources of truth (code + database)

### After (Recommended - CORRECT)

```
┌─────────────────────────────────────────────┐
│ HebCal API                                  │
│ Returns: "Rosh Hashana 9547"                │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│ tag_event_mappings [DATABASE]               │
│ pattern: "Rosh Hashana%"                    │
│ tag_key: "rosh_hashanah"                    │
└──────────────────┬──────────────────────────┘
                   ↓
         MatchEventToTags() [EXISTING CODE]
                   ↓
              event codes
```

**Benefits**:
- ✅ New events = just INSERT SQL
- ✅ Validation script detects gaps
- ✅ Single source of truth (database)
- ✅ No code changes needed

---

## Missing Events (24 Total)

### Critical Issue: Apostrophe Mismatch ⚠️

**Root Cause**: Most "unmapped" events are already in database but pattern matching fails

**Problem**:
- Database patterns: `Asara B'Tevet` (straight apostrophe `'`)
- HebCal API: `Asara B'Tevet` (curly apostrophe `'`)
- Pattern match: FAIL

**Solution**: Normalize apostrophes in pattern matching code
```go
// In hebcal.go
func normalizeTitle(title string) string {
    title = strings.ReplaceAll(title, "'", "'")  // curly → straight
    title = strings.ReplaceAll(title, "'", "'")  // curly → straight
    return title
}
```

### Truly Missing Events (Need SQL)

**Modern Holidays** (6):
- Yom HaAtzma'ut, Yom HaShoah, Yom HaZikaron
- Yom Yerushalayim, Yom HaAliyah, Sigd

**Minor Observances** (5):
- Tu B'Av, Erev Purim, Leil Selichot
- Purim Katan, Shushan Purim Katan

**Migration SQL**: Auto-generated at `/home/daniel/repos/zmanim/db/migrations/20251224204010_add_missing_hebcal_events.sql`

---

## Implementation Checklist

### Phase 1: Fix Apostrophe + Migration (30 min)

- [ ] Add `normalizeTitle()` to `api/internal/calendar/hebcal.go`
- [ ] Update Hebrew names in generated migration SQL
- [ ] Apply migration: `psql "$DATABASE_URL" -f db/migrations/20251224204010_add_missing_hebcal_events.sql`
- [ ] Validate: `./scripts/validate-hebcal-coverage.sh 5786` → Should be 100%

### Phase 2: Delete Hardcoded Logic (1 hour)

- [ ] Delete `mapHolidayToEventCode()` from `api/internal/calendar/events.go` (lines 310-425)
- [ ] Delete `getFastStartType()` (move to category tags)
- [ ] Create sqlc query: `api/internal/db/queries/tag_events.sql`
- [ ] Run `cd api && sqlc generate`

### Phase 3: Use Database Patterns (1 hour)

- [ ] Add `GetActiveTagsForEvents()` method to CalendarService
- [ ] Add `loadTagEventMappings()` with caching
- [ ] Update `GetZmanimContext()` to call `GetActiveTagsForEvents()`
- [ ] Test pattern matching with sample events

### Phase 4: Testing (30 min)

- [ ] Friday → `erev_shabbos` in active_event_codes
- [ ] Rosh Hashana → `rosh_hashanah` in active_event_codes
- [ ] Fast day → BOTH `asarah_bteves` AND `fast_day` in active_event_codes
- [ ] Regular day → empty or minimal active_event_codes

### Phase 5: CI/CD (30 min)

- [ ] Add monthly coverage validation to GitHub Actions
- [ ] Document process for adding new events (SQL only)
- [ ] Add validation to PR checks

---

## Success Metrics

### Before
- Coverage: 82.86% (116/140 events)
- Hardcoded logic: 103 lines in `mapHolidayToEventCode()`
- New events: Require Go code changes + deployment

### After (Target)
- Coverage: 100% (140/140 events)
- Hardcoded logic: 0 lines
- New events: Just INSERT SQL, no code changes

---

## Files Reference

| Document | Purpose | Location |
|----------|---------|----------|
| **Design** | Detailed architecture & rationale | `/home/daniel/repos/zmanim/DESIGN-hebcal-tag-sync.md` |
| **Solution** | Step-by-step implementation guide | `/home/daniel/repos/zmanim/SOLUTION-hebcal-tag-sync.md` |
| **Summary** | This file - executive overview | `/home/daniel/repos/zmanim/SUMMARY-hebcal-sync-design.md` |
| **Validation Script** | Auto-generate migration SQL | `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh` |
| **Migration SQL** | Add 24 missing event tags | `/home/daniel/repos/zmanim/db/migrations/20251224204010_add_missing_hebcal_events.sql` |

---

## Validation Queries (Post-Implementation)

### Perfect Coverage
```bash
./scripts/validate-hebcal-coverage.sh 5786
# Expected: Coverage: 100.00%
```

### No Hardcoded Logic
```bash
grep -r "mapHolidayToEventCode" api/internal/
# Expected: 0 results
```

### Database-Driven
```sql
SELECT COUNT(*) FROM tag_event_mappings;
-- Expected: ~84 mappings (60 current + 24 new)

SELECT COUNT(DISTINCT tag_id) FROM tag_event_mappings;
-- Expected: ~66 distinct tags (42 current + 24 new)
```

---

## Next Steps

1. **Review design** - team approval
2. **Fix apostrophe normalization** - 15 min code change
3. **Apply migration SQL** - add 24 missing tags
4. **Delete hardcoded logic** - remove `mapHolidayToEventCode()`
5. **Implement database queries** - use existing `MatchEventToTags()`
6. **Test thoroughly** - verify all scenarios
7. **Add CI/CD** - monthly validation

**Total Effort**: 2-4 hours

---

## Key Takeaways

1. ✅ **Infrastructure already exists** - pattern matching code + database table
2. ✅ **Validation script complete** - auto-detects gaps, generates migrations
3. ✅ **82.86% coverage today** - only 24 events missing (mostly apostrophe issue)
4. ✅ **Delete hardcoded logic** - use database patterns exclusively
5. ✅ **Zero future maintenance** - new events = just SQL, no code changes

**Recommendation**: Implement immediately. This eliminates a major technical debt and ensures perfect HebCal synchronization going forward.

---

**END OF SUMMARY**
