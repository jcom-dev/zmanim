# HebCal Event Matching System Design

## Executive Summary

This document describes a 2-column database matching system for handling HebCal events, supporting both **exact 1:1 matching** and **pattern-based regex matching** to map HebCal event names to internal tags.

**Problem**: HebCal returns ~170 different event names, but many are variations of the same logical event:
- "Chanukah: 1 Candle", "Chanukah: 2 Candles", ... "Chanukah: 8 Candles" → all map to `chanukah` tag
- "Rosh Hashana 5781", "Rosh Hashana 5782", ... "Rosh Hashana 5791" → all map to `rosh_hashanah` tag
- "Parashat Bereshit", "Parashat Noach", ... (59 parashiyot) → pattern-based matching

**Solution**: Add 2 columns to `tag_event_mappings` table:
1. `is_exact_hebcal_match` (boolean) - TRUE = exact 1:1 match, FALSE = use regex pattern
2. `hebcal_pattern_regex` (text) - PostgreSQL regex pattern when not exact match

---

## CSV Analysis

### Event Pattern Breakdown

From `/home/daniel/repos/zmanim/hebcal-events-complete.csv`:

| Pattern Type | Count | Description | Examples |
|--------------|-------|-------------|----------|
| EXACT | 77 | One-to-one mapping | "Purim", "Yom Kippur", "Lag BaOmer" |
| PARASHAT | 59 | Weekly Torah portions | "Parashat Bereshit", "Parashat Noach" |
| MONTHLY | 13 | Rosh Chodesh variants | "Rosh Chodesh Tevet", "Rosh Chodesh Adar" |
| YEARLY | 11 | Year-specific events | "Rosh Hashana 5781", "Rosh Hashana 5782" |
| NUMBERED | 8 | Numbered series | "Chanukah: 1 Candle" ... "Chanukah: 8 Candles" |
| COMBINED | 1 | Complex variations | "Chanukah: 8th Day" |

**Total Events**: 170 (169 unique event names + 1 duplicate "Erev Purim")

---

## Schema Design

### Current Schema (tag_event_mappings)

```sql
CREATE TABLE tag_event_mappings (
    id                     integer PRIMARY KEY,
    tag_id                 integer NOT NULL REFERENCES zman_tags(id) ON DELETE CASCADE,
    hebcal_event_pattern   varchar(100),          -- SQL LIKE pattern (e.g., "Chanukah%")
    hebrew_month           integer,
    hebrew_day_start       integer,
    hebrew_day_end         integer,
    priority               integer DEFAULT 100,
    created_at             timestamptz NOT NULL DEFAULT now(),
    yom_tov_level          integer NOT NULL DEFAULT 0,
    is_multi_day           boolean NOT NULL DEFAULT false,
    duration_days_israel   integer NOT NULL DEFAULT 1,
    duration_days_diaspora integer NOT NULL DEFAULT 1,
    fast_start_type        varchar(20)
);
```

### Proposed Enhancement

Add 2 new columns:

```sql
ALTER TABLE tag_event_mappings
ADD COLUMN is_exact_hebcal_match boolean NOT NULL DEFAULT false,
ADD COLUMN hebcal_pattern_regex text;

-- Add constraint: if not exact, must have regex
ALTER TABLE tag_event_mappings
ADD CONSTRAINT check_regex_required
    CHECK (is_exact_hebcal_match = true OR hebcal_pattern_regex IS NOT NULL);

-- Add index for regex queries
CREATE INDEX idx_tag_event_mappings_regex
    ON tag_event_mappings (hebcal_pattern_regex)
    WHERE hebcal_pattern_regex IS NOT NULL;
```

---

## Matching Strategy

### Decision Tree

```
HebCal Event Name
    |
    v
Try EXACT match first
    |
    +--- Found? → Return tag
    |
    +--- Not found?
         |
         v
    Try REGEX patterns (by priority DESC)
         |
         +--- Match found? → Return tag
         |
         +--- No match? → Return NULL (unmapped event)
```

### Example Mappings

| tag_key | is_exact | hebcal_event_pattern (old) | hebcal_pattern_regex | matches_these_hebcal_events |
|---------|----------|----------------------------|----------------------|----------------------------|
| purim | TRUE | Purim | NULL | "Purim" (exact) |
| yom_kippur | TRUE | Yom Kippur | NULL | "Yom Kippur" (exact) |
| chanukah | FALSE | Chanukah% | ^Chanukah: [1-8] Candles?$ | "Chanukah: 1 Candle", "Chanukah: 2 Candles", ... "Chanukah: 8 Candles" |
| chanukah_8th_day | TRUE | Chanukah: 8th Day | NULL | "Chanukah: 8th Day" (exact) |
| rosh_hashanah | FALSE | Rosh Hashana% | ^Rosh Hashana \d{4}$ | "Rosh Hashana 5781", "Rosh Hashana 5782", ... |
| rosh_hashanah_ii | TRUE | Rosh Hashana II | NULL | "Rosh Hashana II" (exact) |
| rosh_chodesh | FALSE | Rosh Chodesh% | ^Rosh Chodesh [A-Z] | "Rosh Chodesh Tevet", "Rosh Chodesh Adar", ... |
| parashat_bereshit | TRUE | Parashat Bereshit | NULL | "Parashat Bereshit" (exact) |
| parashat_noach | TRUE | Parashat Noach | NULL | "Parashat Noach" (exact) |
| mevarchim_chodesh | FALSE | Mevarchim Chodesh% | ^Mevarchim Chodesh [A-Z] | "Mevarchim Chodesh Tevet", "Mevarchim Chodesh Adar", ... |
| pesach | FALSE | Pesach% | ^Pesach (I{1,3}|IV|V|VI{1,2}|VIII)( \(CH''M\))?$ | "Pesach I", "Pesach II", "Pesach III (CH''M)", ... |
| shabbat_special | FALSE | Shabbat% | ^Shabbat (Chazon|HaChodesh|HaGadol|Nachamu|Parah|Shekalim|Shirah|Shuva|Zachor)$ | "Shabbat Chazon", "Shabbat HaGadol", ... |

---

## Complete Regex Pattern Library

### 1. EXACT Matches (is_exact_hebcal_match = TRUE)

Most events are exact 1:1 matches. Examples:
- "Purim", "Yom Kippur", "Lag BaOmer", "Tu BiShvat"
- "Erev Pesach", "Erev Rosh Hashana", "Erev Yom Kippur"
- "Rosh Hashana II", "Rosh Hashana LaBehemot"
- "Pesach Sheni", "Purim Katan", "Shushan Purim"
- All 59 individual parashiyot: "Parashat Bereshit", "Parashat Noach", etc.
- All 13 individual Rosh Chodesh: "Rosh Chodesh Tevet", "Rosh Chodesh Adar I", etc.

**Count**: ~140-150 mappings with `is_exact_hebcal_match = TRUE`

### 2. NUMBERED Patterns (Chanukah)

**Tag**: `chanukah`

```regex
^Chanukah: [1-8] Candles?$
```

Matches:
- "Chanukah: 1 Candle"
- "Chanukah: 2 Candles"
- "Chanukah: 3 Candles"
- ... through "Chanukah: 8 Candles"

**Note**: "Chanukah: 8th Day" is a SEPARATE exact match (special case)

### 3. YEARLY Patterns (Rosh Hashana)

**Tag**: `rosh_hashanah` (or generic group tag)

```regex
^Rosh Hashana \d{4}$
```

Matches:
- "Rosh Hashana 5781"
- "Rosh Hashana 5782"
- ... through "Rosh Hashana 5791"

**Note**: "Rosh Hashana II" is a SEPARATE exact match

### 4. MONTHLY Patterns

#### Rosh Chodesh (Generic Group)

**Tag**: `rosh_chodesh` (group tag for all months)

```regex
^Rosh Chodesh [A-Z]
```

Matches:
- "Rosh Chodesh Tevet"
- "Rosh Chodesh Adar"
- "Rosh Chodesh Adar I"
- "Rosh Chodesh Adar II"
- ... all 13 months

**Alternative**: Each month could be EXACT match (see strategy below)

#### Mevarchim Chodesh (Blessing the New Month)

**Tag**: `mevarchim_chodesh` (group tag)

```regex
^Mevarchim Chodesh [A-Z]
```

Matches:
- "Mevarchim Chodesh Tevet"
- "Mevarchim Chodesh Adar"
- "Mevarchim Chodesh Adar I"
- ... all months

### 5. PARASHAT Patterns

**Strategy Choice A**: Each parasha is EXACT match (59 individual mappings)
- `parashat_bereshit` → "Parashat Bereshit"
- `parashat_noach` → "Parashat Noach"
- ... 59 total

**Strategy Choice B**: Group tag with regex pattern

**Tag**: `parashat` (generic group tag)

```regex
^Parashat [A-Za-z-]+$
```

Matches all 59 parashiyot plus combined parashiyot:
- "Parashat Bereshit"
- "Parashat Vayakhel-Pekudei" (combined)
- "Parashat Tazria-Metzora" (combined)

**Recommendation**: Use Choice A (59 exact matches) for flexibility - allows publishers to filter by specific parasha

### 6. MULTI-DAY Holiday Patterns

#### Pesach (8 days)

**Tag**: `pesach` (group tag for all Pesach days)

```regex
^Pesach (I{1,3}|IV|V|VI{1,2}|VIII)( \(CH''M\))?$
```

Matches:
- "Pesach I", "Pesach II"
- "Pesach III (CH''M)", "Pesach IV (CH''M)"
- "Pesach V (CH''M)", "Pesach VI (CH''M)"
- "Pesach VII", "Pesach VIII"

**Note**: "Erev Pesach" and "Pesach Sheni" are SEPARATE exact matches

#### Sukkot (7 days + 2)

**Tag**: `sukkot` (group tag)

```regex
^Sukkot (I{1,3}|IV|V|VI{1,2})( \(CH''M\))?|^Sukkot VII \(Hoshana Raba\)$
```

Matches:
- "Sukkot I", "Sukkot II"
- "Sukkot III (CH''M)" through "Sukkot VI (CH''M)"
- "Sukkot VII (Hoshana Raba)"

**Note**: "Shmini Atzeret" and "Simchat Torah" are SEPARATE exact matches

#### Shavuot (2 days)

**Tag**: `shavuos` (group tag)

```regex
^Shavuot (I|II)$
```

Matches:
- "Shavuot I"
- "Shavuot II"

### 7. SPECIAL Shabbat Patterns

**Tag**: `shabbat_special` (group tag for special Shabbatot)

```regex
^Shabbat (Chazon|HaChodesh|HaGadol|Nachamu|Parah|Shekalim|Shirah|Shuva|Zachor)$
```

Matches:
- "Shabbat Chazon", "Shabbat HaChodesh", "Shabbat HaGadol"
- "Shabbat Nachamu", "Shabbat Parah", "Shabbat Shekalim"
- "Shabbat Shirah", "Shabbat Shuva", "Shabbat Zachor"

**Alternative**: Each special Shabbat could be EXACT match (9 individual mappings)

---

## Matching Algorithm

### Query Logic (PostgreSQL)

```sql
-- STEP 1: Try exact match first
WITH exact_match AS (
    SELECT t.*, m.priority
    FROM tag_event_mappings m
    JOIN zman_tags t ON t.id = m.tag_id
    WHERE m.is_exact_hebcal_match = TRUE
      AND m.hebcal_event_pattern = $1  -- Exact string match
    ORDER BY m.priority DESC
    LIMIT 1
),
-- STEP 2: Try regex patterns if no exact match
regex_match AS (
    SELECT t.*, m.priority
    FROM tag_event_mappings m
    JOIN zman_tags t ON t.id = m.tag_id
    WHERE m.is_exact_hebcal_match = FALSE
      AND $1 ~ m.hebcal_pattern_regex  -- PostgreSQL regex match
    ORDER BY m.priority DESC
    LIMIT 1
)
-- STEP 3: Return exact match if found, otherwise regex match
SELECT * FROM exact_match
UNION ALL
SELECT * FROM regex_match
WHERE NOT EXISTS (SELECT 1 FROM exact_match)
LIMIT 1;
```

### Go Implementation (api/internal/calendar/events.go)

```go
// GetEventCodeFromHebcal maps a HebCal event name to a tag using the new 2-column system
func (s *Service) GetEventCodeFromHebcal(ctx context.Context, hebcalEventName string) (*EventMatch, error) {
    // STEP 1: Try exact match first
    exactMatch, err := s.db.Queries.GetTagByExactHebcalEvent(ctx, hebcalEventName)
    if err == nil {
        return &EventMatch{
            TagKey: exactMatch.TagKey,
            DisplayNameHebrew: exactMatch.DisplayNameHebrew,
            DisplayNameEnglish: exactMatch.DisplayNameEnglishAshkenazi,
            Priority: exactMatch.Priority,
            MatchType: "exact",
        }, nil
    }
    if !errors.Is(err, sql.ErrNoRows) {
        // Unexpected error
        return nil, fmt.Errorf("exact match query failed: %w", err)
    }

    // STEP 2: Try regex patterns if no exact match
    regexMatch, err := s.db.Queries.GetTagByRegexHebcalEvent(ctx, hebcalEventName)
    if err == nil {
        return &EventMatch{
            TagKey: regexMatch.TagKey,
            DisplayNameHebrew: regexMatch.DisplayNameHebrew,
            DisplayNameEnglish: regexMatch.DisplayNameEnglishAshkenazi,
            Priority: regexMatch.Priority,
            MatchType: "regex",
        }, nil
    }
    if !errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("regex match query failed: %w", err)
    }

    // STEP 3: No match found
    return nil, nil
}
```

---

## Edge Cases and Decision Points

### 1. Group Tags vs Individual Tags

**Question**: Should we create:
- A) Individual tags for each variation (e.g., `parashat_bereshit`, `parashat_noach`)
- B) Group tags with regex (e.g., `parashat` matches all parashiyot)

**Recommendation by Category**:

| Category | Strategy | Reason |
|----------|----------|--------|
| Parashiyot (59) | Individual EXACT tags | Publishers may want to show specific zmanim for specific parshiyot |
| Rosh Chodesh (13) | Individual EXACT tags | Different months may have different zmanim |
| Mevarchim Chodesh (13) | REGEX group tag | Unlikely to need per-month granularity |
| Chanukah (8 days) | REGEX group tag | All 8 days treated the same |
| Rosh Hashana years (11) | REGEX group tag | Year number is irrelevant |
| Pesach (8 days) | Could go either way | See analysis below |
| Special Shabbatot (9) | Individual EXACT tags | Each has unique significance |

### 2. Pesach Multi-Day Strategy

**Option A**: Single group tag `pesach` with regex (simpler)
```sql
tag_key: pesach
is_exact: false
regex: ^Pesach (I{1,3}|IV|V|VI{1,2}|VIII)( \(CH''M\))?$
```

**Option B**: Individual tags for each day (more flexible)
```sql
tag_key: pesach_i, is_exact: true, pattern: "Pesach I"
tag_key: pesach_ii, is_exact: true, pattern: "Pesach II"
tag_key: pesach_chol_hamoed, is_exact: false, regex: ^Pesach (III|IV|V|VI) \(CH''M\)$
tag_key: pesach_vii, is_exact: true, pattern: "Pesach VII"
tag_key: pesach_viii, is_exact: true, pattern: "Pesach VIII"
```

**Option C**: Hybrid - group tag + specific day tags
- `pesach` (group) matches all Pesach days
- `pesach_i`, `pesach_vii` (specific) for first/last days with higher priority
- Publishers assign to both tags: Filter by `pesach` for "any Pesach day", or `pesach_i` for "first day only"

**Recommendation**: **Option C (Hybrid)** - provides maximum flexibility

### 3. Overlapping Patterns

**Problem**: Multiple regex patterns could match the same event.

**Example**:
- "Parashat Vayakhel-Pekudei" (combined parasha)
- Could match both `^Parashat Vayakhel` and `^Parashat Pekudei`

**Solution**: Use priority + specificity

```sql
-- Higher priority for exact combined parasha
tag_key: parashat_vayakhel_pekudei
is_exact: true
pattern: "Parashat Vayakhel-Pekudei"
priority: 200

-- Lower priority for individual parshiyot (fallback)
tag_key: parashat_vayakhel
is_exact: true
pattern: "Parashat Vayakhel"
priority: 100

tag_key: parashat_pekudei
is_exact: true
pattern: "Parashat Pekudei"
priority: 100
```

**Rule**: Most specific match wins. Exact matches have implicit priority over regex.

### 4. Combined Parashiyot

There are 7 combined parashiyot in the CSV:
- "Parashat Vayakhel-Pekudei"
- "Parashat Tazria-Metzora"
- "Parashat Achrei Mot-Kedoshim"
- "Parashat Behar-Bechukotai"
- "Parashat Chukat-Balak"
- "Parashat Matot-Masei"
- "Parashat Nitzavim-Vayeilech"

**Strategy**: Create EXACT tags for combined parashiyot (7 mappings)

**Rationale**: These are legitimate calendar events returned by HebCal API. A publisher might want to show special zmanim when parshiyot are combined.

### 5. Unicode and Encoding

**Issue**: CSV contains Unicode Hebrew characters and special quotes.

**Example**: `Pesach III (CH''M)` uses curly quotes `''` not straight quotes `''`

**Solution**: Store patterns EXACTLY as they appear in HebCal API responses
- Test with actual HebCal API calls
- Document encoding requirements
- Use exact string from HebCal response for matching

### 6. Diaspora vs Israel Variations

**Issue**: Some events differ between Israel and Diaspora:
- "Pesach VIII" (Diaspora only)
- "Shavuot II" (Diaspora only)
- "Sukkot II" (Diaspora only)

**Current Approach**: Store both as exact matches
- Tag system doesn't need to know about Israel vs Diaspora
- Calendar service determines which events apply based on locality

**Recommendation**: Keep separate exact tags
```sql
tag_key: pesach_viii, is_exact: true, pattern: "Pesach VIII"
tag_key: shavuos_ii, is_exact: true, pattern: "Shavuot II"
```

### 7. Future-Proofing for New Years

**Issue**: CSV only has Rosh Hashana 5781-5791. What about 5792+?

**Solution**: Regex pattern handles all years
```regex
^Rosh Hashana \d{4}$
```

Matches any 4-digit year: 5792, 5793, 5800, 6000, etc.

**Migration Strategy**: When HebCal adds new years, no database changes needed.

---

## Migration Strategy

### Step 1: Add New Columns

```sql
-- File: db/migrations/XXXXX_add_hebcal_matching_columns.sql

BEGIN;

-- Add new columns
ALTER TABLE tag_event_mappings
ADD COLUMN is_exact_hebcal_match boolean NOT NULL DEFAULT false,
ADD COLUMN hebcal_pattern_regex text;

-- Add constraint
ALTER TABLE tag_event_mappings
ADD CONSTRAINT check_regex_required
    CHECK (is_exact_hebcal_match = true OR hebcal_pattern_regex IS NOT NULL);

-- Add index for regex queries
CREATE INDEX idx_tag_event_mappings_regex
    ON tag_event_mappings (hebcal_pattern_regex)
    WHERE hebcal_pattern_regex IS NOT NULL;

-- Add index for exact matches
CREATE INDEX idx_tag_event_mappings_exact
    ON tag_event_mappings (hebcal_event_pattern)
    WHERE is_exact_hebcal_match = true;

COMMIT;
```

### Step 2: Populate Existing Mappings

Analyze current `hebcal_event_pattern` values and set flags:

```sql
-- Exact matches (no wildcards)
UPDATE tag_event_mappings
SET is_exact_hebcal_match = true
WHERE hebcal_event_pattern IS NOT NULL
  AND hebcal_event_pattern NOT LIKE '%\%%';  -- No SQL wildcards

-- Pattern matches (has wildcards) - convert to regex
UPDATE tag_event_mappings
SET is_exact_hebcal_match = false,
    hebcal_pattern_regex = CASE
        WHEN hebcal_event_pattern = 'Chanukah%' THEN '^Chanukah: [1-8] Candles?$'
        WHEN hebcal_event_pattern = 'Rosh Hashana%' THEN '^Rosh Hashana \d{4}$'
        WHEN hebcal_event_pattern = 'Rosh Chodesh%' THEN '^Rosh Chodesh [A-Z]'
        WHEN hebcal_event_pattern = 'Parashat%' THEN '^Parashat [A-Za-z-]+$'
        -- Add more conversions as needed
        ELSE NULL
    END
WHERE hebcal_event_pattern IS NOT NULL
  AND hebcal_event_pattern LIKE '%\%%';
```

### Step 3: Add New Mappings from CSV

For events not yet in database:

```sql
-- Example: Add all 59 individual parashiyot as exact matches
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_exact_hebcal_match, priority)
SELECT
    (SELECT id FROM zman_tags WHERE tag_key = 'parashat_bereshit'),
    'Parashat Bereshit',
    true,
    100
-- Repeat for all 59 parshiyot
;
```

### Step 4: Update SQLc Queries

Add new queries to `api/internal/db/queries/tag_events.sql`:

```sql
-- name: GetTagByExactHebcalEvent :one
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.is_exact_hebcal_match = true
  AND m.hebcal_event_pattern = $1
ORDER BY m.priority DESC
LIMIT 1;

-- name: GetTagByRegexHebcalEvent :one
SELECT
    t.id,
    t.tag_key,
    t.display_name_hebrew,
    t.display_name_english_ashkenazi,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.is_exact_hebcal_match = false
  AND m.hebcal_pattern_regex IS NOT NULL
  AND $1 ~ m.hebcal_pattern_regex  -- PostgreSQL regex operator
ORDER BY m.priority DESC
LIMIT 1;
```

### Step 5: Update Go Code

Modify `api/internal/calendar/events.go`:

```go
// Replace GetEventCodeFromHebcal to use 2-step matching (exact then regex)
// See "Go Implementation" section above for full code
```

---

## Testing Strategy

### Unit Tests

Test exact and regex matching independently:

```go
func TestExactHebcalMatch(t *testing.T) {
    tests := []struct {
        hebcalEvent string
        expectedTag string
    }{
        {"Purim", "purim"},
        {"Yom Kippur", "yom_kippur"},
        {"Parashat Bereshit", "parashat_bereshit"},
        {"Rosh Chodesh Tevet", "rosh_chodesh_tevet"},
    }
    // Run tests...
}

func TestRegexHebcalMatch(t *testing.T) {
    tests := []struct {
        hebcalEvent string
        expectedTag string
    }{
        {"Chanukah: 1 Candle", "chanukah"},
        {"Chanukah: 8 Candles", "chanukah"},
        {"Rosh Hashana 5785", "rosh_hashanah"},
        {"Rosh Hashana 9999", "rosh_hashanah"},  // Future year
    }
    // Run tests...
}

func TestMatchingPriority(t *testing.T) {
    // Exact match should win over regex
    hebcalEvent := "Chanukah: 8th Day"
    result := GetEventCodeFromHebcal(ctx, hebcalEvent)
    assert.Equal(t, "chanukah_8th_day", result.TagKey)  // NOT "chanukah"
}
```

### Integration Tests

Validate against real HebCal API responses:

```bash
# Fetch events for a specific date range
curl "https://www.hebcal.com/hebcal?v=1&cfg=json&start=2025-01-01&end=2025-12-31&maj=on&min=on&mod=on&nx=on&year=now&month=x&ss=on&mf=on&c=on&geo=geoname&geonameid=293397&M=on&s=on"

# Extract event names
jq -r '.items[].title' response.json | sort -u > actual_hebcal_events.txt

# Compare with our CSV
diff actual_hebcal_events.txt hebcal-events-complete.csv
```

### Validation Queries

Check database integrity:

```sql
-- All exact matches should have patterns
SELECT tag_id, hebcal_event_pattern
FROM tag_event_mappings
WHERE is_exact_hebcal_match = true
  AND hebcal_event_pattern IS NULL;
-- Should return 0 rows

-- All regex matches should have patterns
SELECT tag_id, hebcal_pattern_regex
FROM tag_event_mappings
WHERE is_exact_hebcal_match = false
  AND hebcal_pattern_regex IS NULL;
-- Should return 0 rows

-- Test regex syntax (PostgreSQL)
SELECT tag_id, hebcal_pattern_regex
FROM tag_event_mappings
WHERE is_exact_hebcal_match = false
  AND hebcal_pattern_regex IS NOT NULL
  AND NOT ('test' ~ hebcal_pattern_regex OR true);  -- Validate regex compiles
-- Should return 0 rows (all regex patterns are valid)
```

---

## Performance Considerations

### Query Performance

**Exact Match**: Very fast (indexed lookup)
```sql
-- Uses idx_tag_event_mappings_exact index
WHERE is_exact_hebcal_match = true AND hebcal_event_pattern = 'Purim'
```

**Regex Match**: Slower (pattern matching)
```sql
-- Uses idx_tag_event_mappings_regex index + sequential scan with regex
WHERE is_exact_hebcal_match = false AND 'Chanukah: 3 Candles' ~ hebcal_pattern_regex
```

**Optimization**: Always try exact match FIRST
- ~90% of events will match exactly
- Only ~10% need regex (Chanukah, Rosh Hashana years, generic groups)

### Caching Strategy

**Go Code**: Cache tag mappings in memory
```go
type HebcalMatcher struct {
    exactMap  map[string]*TagMatch  // O(1) lookup
    regexList []*RegexPattern       // Ordered by priority
    mu        sync.RWMutex
}

func (m *HebcalMatcher) Match(hebcalEvent string) *TagMatch {
    m.mu.RLock()
    defer m.mu.RUnlock()

    // Try exact map first (O(1))
    if match, ok := m.exactMap[hebcalEvent]; ok {
        return match
    }

    // Try regex patterns (O(n) where n = number of regex patterns)
    for _, pattern := range m.regexList {
        if pattern.Regex.MatchString(hebcalEvent) {
            return pattern.Tag
        }
    }

    return nil
}
```

**Cache Invalidation**: Reload on database change (rare)

---

## Future Enhancements

### 1. Event Aliases

Support multiple HebCal names for same tag:

```sql
ALTER TABLE tag_event_mappings
ADD COLUMN hebcal_aliases text[];

-- Example: Handle spelling variations
UPDATE tag_event_mappings
SET hebcal_aliases = ARRAY['Tisha B''Av', 'Tish''a B''Av', '9th of Av']
WHERE tag_id = (SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav');
```

### 2. Locale-Specific Patterns

Handle Hebrew event names:

```sql
ALTER TABLE tag_event_mappings
ADD COLUMN hebcal_pattern_regex_hebrew text;

-- Example
UPDATE tag_event_mappings
SET hebcal_pattern_regex_hebrew = '^חנוכה: .+ נרות?$'
WHERE tag_id = (SELECT id FROM zman_tags WHERE tag_key = 'chanukah');
```

### 3. Automatic Pattern Learning

Log unmatched events and suggest patterns:

```sql
CREATE TABLE hebcal_unmapped_events (
    id serial PRIMARY KEY,
    hebcal_event_name text NOT NULL,
    first_seen timestamptz NOT NULL DEFAULT now(),
    occurrence_count integer NOT NULL DEFAULT 1,
    suggested_pattern text,
    suggested_tag_key text
);

-- Alert when new events appear
SELECT * FROM hebcal_unmapped_events
WHERE occurrence_count > 5  -- Seen more than 5 times
ORDER BY occurrence_count DESC;
```

---

## Summary and Recommendations

### Core Design

1. **Add 2 columns** to `tag_event_mappings`:
   - `is_exact_hebcal_match` (boolean) - TRUE for 1:1 mapping
   - `hebcal_pattern_regex` (text) - PostgreSQL regex when FALSE

2. **Matching Strategy**:
   - Try exact match first (fast, covers ~90% of events)
   - Fall back to regex patterns (slower, covers remaining ~10%)

3. **Tag Strategy**:
   - **Parashiyot**: 59 individual EXACT tags (flexibility)
   - **Rosh Chodesh**: 13 individual EXACT tags (month-specific)
   - **Mevarchim Chodesh**: 1 REGEX group tag (no per-month need)
   - **Chanukah**: 1 REGEX group tag + 1 EXACT for 8th day
   - **Rosh Hashana**: 1 REGEX for years + EXACT for "II"
   - **Multi-day holidays**: Hybrid (group tag + specific day tags)
   - **Special Shabbatot**: 9 individual EXACT tags

### Performance

- **Exact lookup**: O(1) with index
- **Regex fallback**: O(n) where n = number of regex patterns (~5-10)
- **Total**: Average case O(1), worst case O(10)

### Migration Path

1. Add columns (non-breaking change)
2. Populate from existing `hebcal_event_pattern`
3. Add new mappings from CSV
4. Update SQLc queries
5. Update Go code to use 2-step matching
6. Deploy and monitor

### Next Steps

1. Review this design document
2. Create SQL migration file (see next section)
3. Update SQLc query files
4. Implement Go matching logic
5. Add comprehensive tests
6. Deploy to staging
7. Validate against real HebCal API
8. Deploy to production

---

## Appendix A: Complete Event Inventory

### EXACT Matches (77 + 59 parashiyot + 13 Rosh Chodesh = 149)

See CSV for complete list. Key categories:
- Major holidays: Yom Kippur, Purim, Lag BaOmer, Tu BiShvat, etc.
- Erev days: Erev Pesach, Erev Yom Kippur, etc.
- Special Shabbatot: Shabbat HaGadol, Shabbat Zachor, etc.
- All 59 weekly parashiyot (including 7 combined)
- All 13 Rosh Chodesh months

### REGEX Matches (8 numbered + 11 yearly + generic groups = ~20)

- Chanukah: 8 numbered days
- Rosh Hashana: 11 years
- Mevarchim Chodesh: Generic pattern
- Multi-day holidays (optional): Pesach, Sukkot, Shavuot

---

## Appendix B: PostgreSQL Regex Quick Reference

| Pattern | Meaning | Example |
|---------|---------|---------|
| `^` | Start of string | `^Purim` matches "Purim..." |
| `$` | End of string | `Purim$` matches "...Purim" |
| `\d` | Any digit | `\d{4}` matches "5785" |
| `[1-8]` | Character class | Matches 1, 2, 3, ..., 8 |
| `[A-Z]` | Uppercase letters | Matches A-Z |
| `[A-Za-z-]` | Letters + hyphen | Matches "Vayakhel-Pekudei" |
| `(I\|II)` | Alternation (OR) | Matches "I" or "II" |
| `?` | Optional | `Candles?` matches "Candle" or "Candles" |
| `+` | One or more | `[A-Z]+` matches "TEVET" |
| `*` | Zero or more | `.*` matches anything |
| `\s` | Whitespace | `\s+` matches spaces/tabs |
| `()` | Group | `(CH''M)` groups literal string |

**Note**: PostgreSQL uses POSIX regex syntax. Test patterns with `SELECT 'test' ~ 'pattern';`
