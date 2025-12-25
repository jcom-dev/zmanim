# Migration Summary: Sync Hebcal Events (20251224210000)

## Overview

This migration synchronizes our `zman_tags` and `tag_event_mappings` tables with the authoritative hebcal-go source code to ensure perfect matching of event names and patterns.

**Migration File:** `/home/daniel/repos/zmanim/db/migrations/20251224210000_sync_hebcal_events.sql`

## Key Changes

### 1. Fixed Apostrophe Mismatches

Hebcal-go uses standard single apostrophes (`'`), not fancy quotes (`'`). Updated all patterns:

- `Asara B'Tevet` → `Asara B'Tevet`
- `Tu B'Av` → `Tu B'Av`
- `Ta'anit Esther` → `Ta'anit Esther`
- `Ta'anit Bechorot` → `Ta'anit Bechorot`
- `Tish'a B'Av` → `Tish'a B'Av`
- `Erev Tish'a B'Av` → `Erev Tish'a B'Av`

### 2. Fixed CH''M Double Apostrophe

Hebcal-go uses `(CH''M)` not `(CH'M)`. Updated all Chol HaMoed patterns:

- `Sukkot III-VI (CH'M)` → `Sukkot III-VI (CH''M)`
- `Pesach II-VI (CH'M)` → `Pesach II-VI (CH''M)`

### 3. Fixed Data Error

**Critical bug fix:** `tag_id 5` (shiva_asar_btamuz) was incorrectly mapped to:
- ❌ Pesach I (mapping id 13)
- ❌ Pesach II (mapping id 14)
- ✅ Tzom Tammuz (mapping id 30) - CORRECT

**Action:** Deleted incorrect Pesach I/II mappings for tag_id 5.

### 4. Added Missing Events

Added 17 new event tags (IDs 300-316):

#### New Major Events
- **300:** Rosh Hashana II (2nd day)
- **301:** Erev Purim
- **302:** Rosh Hashana LaBehemot (1 Elul)
- **303:** Leil Selichot
- **304:** Purim Katan (leap years)
- **305:** Shushan Purim Katan (leap years)
- **306:** Purim Meshulash (when Purim falls on Sunday)
- **307:** Chag HaBanot (1st of Rosh Chodesh Tevet)
- **316:** Birkat Hachamah (every 28 years)

#### Chanukah Individual Days
- **308-315:** Chanukah Days 1-8 (individual candle counts)
  - Allows precise tracking of each Chanukah day
  - Each day also maps to general `chanukah` tag (id 45) with lower priority

### 5. Added Metadata

Enhanced existing mappings with:

- **yom_tov_level:** Set to `1` for major holidays (Rosh Hashanah, Yom Kippur, Sukkot, Pesach, Shavuot, etc.)
- **fast_start_type:**
  - `'dawn'` for minor fasts (Tzom Gedaliah, Asara B'Tevet, Ta'anit Esther, etc.)
  - `'sunset'` for major fasts (Tisha B'Av, Erev Tisha B'Av)
- **multi_day_sequence:** For Chanukah days 1-8
- **priority:** Ensures correct tag precedence when multiple tags match

## Migration Structure

```sql
PART 1: Fix apostrophe mismatches in patterns
PART 2: Fix data error - tag_id 5 incorrect mappings
PART 3: Add missing events (17 new tags)
PART 4: Add tag_event_mappings for new tags
PART 5: Add metadata for existing tags
PART 6: Update sequences for auto-increment
```

## Verification

The migration includes commented-out verification queries:

```sql
-- Check all event patterns match hebcal-go format
-- Check new tags were added
-- Verify tag_id 5 only maps to Tzom Tammuz
-- Check apostrophe formatting
```

Uncomment these to validate the migration results.

## Events Still Missing (Not in Scope)

These hebcal-go events are **intentionally not included** as they are dynamic/recurring:

- **Rosh Chodesh {month}** - Dynamic month names
- **Shabbat Mevarchim Chodesh {month}** - Dynamic month names
- **Yom Kippur Katan {month}** - Dynamic month names
- **Rosh Hashana {year}** - Dynamic year numbers
- **Modern Israeli holidays** - Yom HaShoah, Yom HaZikaron, Yom HaAtzma'ut, etc.
  - These are Israeli-specific and may be added in a future migration

## Testing Recommendations

1. Run migration on development database
2. Execute verification queries
3. Test event matching with sample hebcal API responses
4. Verify tag assignments in publisher zmanim
5. Check UI displays correct event names

## Rollback

This migration does not include a rollback script because:

1. It fixes data errors (incorrect mappings)
2. It only adds new data, doesn't delete existing valid data
3. Pattern updates are corrections, not destructive changes

If rollback is needed, restore from database backup taken before migration.

## Files Created

1. `/home/daniel/repos/zmanim/db/migrations/20251224210000_sync_hebcal_events.sql` - Migration SQL
2. `/home/daniel/repos/zmanim/hebcal-events-analysis.txt` - Detailed comparison analysis
3. `/home/daniel/repos/zmanim/MIGRATION-SUMMARY.md` - This summary document
