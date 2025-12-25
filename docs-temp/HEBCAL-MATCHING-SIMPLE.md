# HebCal Event Matching - Simple Design

## Overview
Clean, flat design with HebCal matching fields directly in `zman_tags`. No separate mapping table needed.

## Schema Design

### New Fields in `zman_tags`

```sql
hebcal_match_type    hebcal_match_type  -- 'exact', 'group', or 'category'
hebcal_match_string  TEXT               -- For exact matches
hebcal_match_pattern TEXT               -- For group regex matches
hebcal_match_category VARCHAR(50)       -- For category matches
```

### Match Types

#### 1. **EXACT** - Direct String Match
One tag for each distinct event name.

```sql
INSERT INTO zman_tags (..., hebcal_match_type, hebcal_match_string)
VALUES ('purim', ..., 'exact', 'Purim');
```

**Examples:**
- `Purim` → `purim`
- `Yom Kippur` → `yom_kippur`
- `Lag BaOmer` → `lag_baomer`
- `Pesach Sheni` → `pesach_sheni` ✓ (NOT matched by Pesach group)

#### 2. **GROUP** - Regex Pattern Match
One tag for multiple related events using a regex pattern.

```sql
INSERT INTO zman_tags (..., hebcal_match_type, hebcal_match_pattern)
VALUES ('chanukah', ..., 'group', '^Chanukah:');
```

**Examples:**

| Tag | Pattern | Matches |
|-----|---------|---------|
| `chanukah` | `^Chanukah:` | Chanukah: 1 Candle, ..., Chanukah: 8 Candles, Chanukah: 8th Day |
| `pesach` | `^Pesach [IVX]+` | Pesach I, Pesach II, ..., Pesach VIII (NOT Pesach Sheni) |
| `rosh_hashana` | `^Rosh Hashana( [0-9]+\| II)?$` | Rosh Hashana 5785, Rosh Hashana II |
| `sukkos` | `^Sukkot [IVX]+` | Sukkot I, ..., Sukkot VII |
| `shavuos` | `^Shavuot [IVX]+$` | Shavuot I, Shavuot II |
| `tisha_bav` | `^Tish'a B'Av( \(observed\))?$` | Tish'a B'Av, Tish'a B'Av (observed) |

#### 3. **CATEGORY** - HebCal Category Match
Match by HebCal's category field, not the title.

```sql
INSERT INTO zman_tags (..., hebcal_match_type, hebcal_match_category)
VALUES ('hebcal_candles', ..., 'category', 'candles');
```

**HebCal Categories:**
- `candles` → Candle lighting times (Erev Shabbos/Yom Tov)
- `havdalah` → Havdalah times (Motzei Shabbos/Yom Tov)
- `parashat` → Weekly Torah portion
- `mevarchim` → Mevarchim Chodesh announcements
- `roshchodesh` → Rosh Chodesh days

---

## Matching Function

```sql
SELECT * FROM match_hebcal_event(
    'Chanukah: 5 Candles',  -- HebCal title
    NULL                     -- HebCal category (optional)
);
```

**Returns:**
```
tag_id | tag_key  | match_type
-------+----------+-----------
   10  | chanukah | group
```

### Matching Priority
1. **Category** (if provided) - highest priority
2. **Exact** string match
3. **Group** regex match - longest pattern wins

---

## Tag Types

### tag_type_id = 170 (Events)
All Jewish calendar events from HebCal.

### tag_type_id = 180 (HebCal Categories)
Internal tags for HebCal categories. These are `is_hidden = TRUE` because they're system tags, not user-visible events.

---

## Key Design Decisions

### ✅ Why No Separate Mapping Table?
- Simpler schema
- Fewer joins
- All event data in one place
- Easy to query and maintain

### ✅ Why Groups Instead of Individual Entries?
**Problem:** Creating individual tags for every variation would be bloated:
- 8 tags for Chanukah days (Chanukah: 1 Candle, ..., Chanukah: 8 Candles)
- 8 tags for Pesach days (Pesach I, ..., Pesach VIII)
- 13 tags for Mevarchim Chodesh (one per month)
- Infinite tags for Rosh Hashana years (5785, 5786, 5787, ...)

**Solution:** One group tag with a regex pattern.
- 1 `chanukah` tag matches all 8+ Chanukah events
- 1 `pesach` tag matches all 8 Pesach events (but NOT Pesach Sheni)
- 1 `rosh_hashana` tag matches all years

### ✅ Why Regex Patterns?
PostgreSQL's `~` operator is:
- Fast (indexed)
- Powerful (handles complex patterns)
- Standard (no custom parsing needed)

### ✅ Edge Cases Handled
| Event | Expected Tag | Pattern | ✓ |
|-------|-------------|---------|---|
| Pesach I | `pesach` | `^Pesach [IVX]+` | ✓ |
| Pesach Sheni | `pesach_sheni` | Exact match | ✓ |
| Tish'a B'Av | `tisha_bav` | `^Tish'a B'Av( \(observed\))?$` | ✓ |
| Tish'a B'Av (observed) | `tisha_bav` | Same pattern | ✓ |
| Erev Tish'a B'Av | `erev_tisha_bav` | Exact match | ✓ |

---

## Usage Examples

### Example 1: Match Chanukah Day 5
```sql
SELECT * FROM match_hebcal_event('Chanukah: 5 Candles');
```
**Result:** `tag_key = 'chanukah'`, `match_type = 'group'`

### Example 2: Match Candle Lighting (Category)
```sql
SELECT * FROM match_hebcal_event('Candle lighting: 16:07', 'candles');
```
**Result:** `tag_key = 'hebcal_candles'`, `match_type = 'category'`

### Example 3: Match Exact Event
```sql
SELECT * FROM match_hebcal_event('Purim');
```
**Result:** `tag_key = 'purim'`, `match_type = 'exact'`

### Example 4: Ensure Pesach Sheni NOT Matched by Pesach Group
```sql
SELECT * FROM match_hebcal_event('Pesach Sheni');
```
**Result:** `tag_key = 'pesach_sheni'`, `match_type = 'exact'` ✓
**NOT:** `tag_key = 'pesach'` ✓

---

## Statistics

### Total Tags Created
```sql
SELECT
    hebcal_match_type,
    COUNT(*) as count
FROM zman_tags
WHERE hebcal_match_type IS NOT NULL
GROUP BY hebcal_match_type;
```

**Expected:**
- `category`: 5 tags (candles, havdalah, parashat, mevarchim, roshchodesh)
- `group`: 6 tags (chanukah, pesach, rosh_hashana, sukkos, shavuos, tisha_bav)
- `exact`: ~40 tags (individual holidays, fasts, special shabbatot)

**Total:** ~51 tags instead of 171 entries from the CSV!

---

## View: All Mappings

```sql
SELECT * FROM v_hebcal_event_mappings;
```

**Human-readable view** showing all HebCal mappings sorted by type.

---

## Migration File

`db/migrations/20251225030000_add_hebcal_fields_to_tags.sql`

**What it does:**
1. Creates `hebcal_match_type` enum
2. Adds 4 new columns to `zman_tags`
3. Adds constraint to ensure proper fields are set
4. Creates indexes for performance
5. Populates all event tags (category, group, exact)
6. Creates `match_hebcal_event()` function
7. Creates `v_hebcal_event_mappings` view

---

## Testing

Run the test script to verify all matching works correctly:

```bash
./scripts/test-hebcal-matching-simple.sh
```

**Tests:**
- Exact matches (Purim, Yom Kippur, etc.)
- Group matches (Chanukah, Pesach, Rosh Hashana, etc.)
- Category matches (candles, havdalah, parashat)
- Edge cases (Pesach Sheni, Tisha B'Av observed, etc.)

---

## Next Steps

### 1. Run Migration
```bash
source api/.env
psql "$DATABASE_URL" < db/migrations/20251225030000_add_hebcal_fields_to_tags.sql
```

### 2. Run Tests
```bash
./scripts/test-hebcal-matching-simple.sh
```

### 3. Update Go Code
Update `api/internal/calendar/events.go` to use the new matching function:

```go
// Instead of hardcoded event logic:
if eventName == "Chanukah: 1 Candle" || eventName == "Chanukah: 2 Candles" { ... }

// Use database lookup:
tag, err := s.db.MatchHebcalEvent(ctx, event.Title, event.Category)
```

### 4. Generate SQLc
Create query in `api/internal/db/queries/tag_events.sql`:

```sql
-- name: MatchHebcalEvent :one
SELECT * FROM match_hebcal_event($1, $2);
```

Then run:
```bash
cd api && sqlc generate
```

---

## Benefits

✅ **Simple** - No mapping table, all data in `zman_tags`
✅ **Efficient** - 51 tags instead of 171 CSV entries
✅ **Maintainable** - Add new events with single INSERT
✅ **Flexible** - Supports exact, group, and category matching
✅ **Accurate** - Handles edge cases (Pesach Sheni, Tisha B'Av observed)
✅ **Fast** - Indexed lookups, single function call
