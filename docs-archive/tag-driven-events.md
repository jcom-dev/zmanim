# Tag-Driven Event Architecture

**Status**: Implemented
**Date**: 2025-12-24
**Version**: 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [How Event Matching Works](#how-event-matching-works)
4. [Database Schema](#database-schema)
5. [Query Examples](#query-examples)
6. [Tag Matching Algorithm](#tag-matching-algorithm)
7. [Event Code Flow](#event-code-flow)
8. [Testing & Validation](#testing--validation)

---

## Overview

The tag-driven event architecture eliminates all hardcoded event logic from the application code. Instead, ALL event-based filtering is determined by:

1. **HebCal API** - Returns active Jewish events for a date
2. **Database patterns** - Maps HebCal event names to tag keys
3. **Tag matching** - Filters zmanim by matching tags against active event codes

**Key Principle**: "HebCal says what events are active → Database maps events to tags → Tags filter zmanim. NO hardcoded logic anywhere."

### Benefits

- **Zero Code Changes**: Adding new events requires only SQL, no code deployment
- **Perfect Sync**: Database patterns match HebCal exactly (validated by automated scripts)
- **Maintainable**: Single source of truth in database, not scattered across codebase
- **Testable**: All logic queryable and verifiable via SQL
- **Transparent**: Event mappings visible in database, not hidden in code

---

## Architecture Principles

### 1. Database-Driven Event Mapping

ALL event matching logic lives in the `tag_event_mappings` table:

```sql
CREATE TABLE tag_event_mappings (
    id integer PRIMARY KEY,
    tag_id integer NOT NULL REFERENCES zman_tags(id),
    hebcal_event_pattern varchar(100),  -- SQL LIKE pattern
    hebrew_month integer,               -- Alternative: date-based matching
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,       -- Lower = higher priority
    yom_tov_level integer,              -- 1=major holiday, 2=rabbinic, etc.
    fast_start_type varchar(10),        -- 'dawn' or 'sunset'
    multi_day_sequence integer,         -- For multi-day events
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);
```

### 2. Tag-Based Filtering

Zmanim have tags that determine when they should appear:

```sql
CREATE TABLE publisher_zman_tags (
    publisher_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false,  -- For exclusion rules
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (publisher_zman_id, tag_id)
);
```

**Filtering Logic**:
- Zman with tag `event:erev_shabbos` → Shows only when `"erev_shabbos"` in active event codes
- Zman with tag `event:erev_shabbos` (negated) → Hides when `"erev_shabbos"` in active event codes
- Zman with no event tags → Always shows (regular daily zmanim)

### 3. ActiveEventCodes as Single Source

The ONLY filtering mechanism is the `ActiveEventCodes` array:

```go
type CalculateParams struct {
    PublisherID      int32
    LocalityID       int64
    Date             time.Time
    ActiveEventCodes []string  // ← Single source of filtering truth
}
```

**Flow**:
1. Calendar service gets HebCal events → maps to tag keys → returns `ActiveEventCodes`
2. Handler passes `ActiveEventCodes` to service
3. Service filters zmanim by tag matching BEFORE calculation
4. Only matching zmanim are calculated and returned

---

## How Event Matching Works

### Step 1: HebCal API Returns Events

```json
{
  "date": "2025-12-26",
  "items": [
    {
      "title": "Chanukah: 3 Candles",
      "category": "holiday",
      "hebrew": "חנוכה: ג׳ נרות"
    }
  ]
}
```

### Step 2: Database Pattern Matching

The calendar service queries `tag_event_mappings` to find matching tags:

```sql
SELECT t.tag_key, m.hebcal_event_pattern, m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE 'Chanukah: 3 Candles' LIKE m.hebcal_event_pattern
ORDER BY m.priority DESC;
```

**Results**:
| tag_key | pattern | priority |
|---------|---------|----------|
| chanukah_day_3 | Chanukah: 3 Candles | 10 |
| chanukah | Chanukah% | 50 |

Both tags match, but `chanukah_day_3` has higher priority (lower number).

### Step 3: Active Event Codes Generated

Calendar service returns:

```go
ActiveEventCodes = ["chanukah", "chanukah_day_3", "erev_shabbos"]
```

(Friday during Chanukah Day 3)

### Step 4: Zmanim Filtered by Tags

Service checks each zman's tags:

**Example Zman 1**: Chanukah candle lighting
- Tags: `event:chanukah` (positive match)
- Active codes: `["chanukah", "chanukah_day_3", "erev_shabbos"]`
- Result: **SHOW** (tag matches)

**Example Zman 2**: Regular candle lighting
- Tags: `event:erev_shabbos` (positive match)
- Active codes: `["chanukah", "chanukah_day_3", "erev_shabbos"]`
- Result: **SHOW** (tag matches)

**Example Zman 3**: Havdalah
- Tags: `event:motzei_shabbos` (positive match)
- Active codes: `["chanukah", "chanukah_day_3", "erev_shabbos"]`
- Result: **HIDE** (tag does NOT match - it's Friday, not Saturday night)

---

## Database Schema

### Core Tables

#### 1. `zman_tags`

Defines all available tags (events, categories, etc.):

```sql
CREATE TABLE zman_tags (
    id integer PRIMARY KEY,
    tag_key varchar(50) UNIQUE NOT NULL,           -- snake_case key (e.g., "erev_shabbos")
    tag_type_id integer NOT NULL,                  -- FK to tag_types
    display_name_hebrew text NOT NULL,
    display_name_english_ashkenazi text NOT NULL,
    display_name_english_sephardi text,
    hebcal_basename varchar(100),                  -- Direct HebCal match (e.g., "Shavuot")
    description text,
    notes text,
    color varchar(7),
    sort_order integer DEFAULT 1000,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);
```

**Examples**:
```sql
-- Event tags
INSERT INTO zman_tags (tag_key, tag_type_id, display_name_hebrew, display_name_english_ashkenazi)
VALUES ('erev_shabbos', 170, 'ערב שבת', 'Erev Shabbos');

INSERT INTO zman_tags (tag_key, tag_type_id, display_name_hebrew, display_name_english_ashkenazi)
VALUES ('chanukah', 170, 'חנוכה', 'Chanukah');

-- Category tags (for grouping, not filtering)
INSERT INTO zman_tags (tag_key, tag_type_id, display_name_hebrew, display_name_english_ashkenazi)
VALUES ('category_candle_lighting', 172, 'הדלקת נרות', 'Candle Lighting');
```

#### 2. `tag_event_mappings`

Maps HebCal event names to tags:

```sql
CREATE TABLE tag_event_mappings (
    id integer PRIMARY KEY,
    tag_id integer NOT NULL REFERENCES zman_tags(id),
    hebcal_event_pattern varchar(100),   -- SQL LIKE pattern
    hebrew_month integer,                -- Optional: date-based matching
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,        -- Lower = higher priority
    yom_tov_level integer,               -- Metadata: holiday importance
    fast_start_type varchar(10),         -- Metadata: 'dawn' or 'sunset'
    multi_day_sequence integer,          -- Metadata: day number in sequence
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);
```

**Pattern Types**:

| Pattern | Matches | Use Case |
|---------|---------|----------|
| `Rosh Hashana%` | "Rosh Hashana I", "Rosh Hashana II", "Rosh Hashana 9547" | Wildcard match |
| `Chanukah: 3 Candles` | Exact match only | Specific day |
| `Pesach%` | All Pesach days | Generic event |
| `%day of the Omer` | "1st day of the Omer", "33rd day of the Omer" | Suffix match |

**Examples**:
```sql
-- Rosh Hashana (both days map to same tag)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority, yom_tov_level)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'),
    'Rosh Hashana%',
    10,
    1  -- Major holiday
);

-- Chanukah Day 3 (specific)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority, multi_day_sequence)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'chanukah_day_3'),
    'Chanukah: 3 Candles',
    10,
    3
);

-- Chanukah (generic - lower priority)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'chanukah'),
    'Chanukah%',
    50
);

-- Asara B'Teves (specific fast)
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority, fast_start_type)
VALUES (
    (SELECT id FROM zman_tags WHERE tag_key = 'asarah_bteves'),
    'Asara B''Tevet',
    10,
    'dawn'
);
```

#### 3. `publisher_zman_tags`

Links zmanim to tags:

```sql
CREATE TABLE publisher_zman_tags (
    publisher_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (publisher_zman_id, tag_id)
);
```

**Tag Negation**:
- `is_negated=false` → Show zman when tag is active (positive match)
- `is_negated=true` → Hide zman when tag is active (exclusion rule)

**Examples**:
```sql
-- Candle lighting: show on erev Shabbos OR erev Yom Tov
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
VALUES
    (123, (SELECT id FROM zman_tags WHERE tag_key = 'erev_shabbos'), false),
    (123, (SELECT id FROM zman_tags WHERE tag_key = 'erev_yom_tov'), false);

-- Tachanun: show on weekdays but NOT on Rosh Chodesh
INSERT INTO publisher_zman_tags (publisher_zman_id, tag_id, is_negated)
VALUES
    (456, (SELECT id FROM zman_tags WHERE tag_key = 'weekday'), false),
    (456, (SELECT id FROM zman_tags WHERE tag_key = 'rosh_chodesh'), true);  -- Negated
```

---

## Query Examples

### 1. Get All Event Mappings

```sql
SELECT
    t.tag_key,
    t.display_name_english_ashkenazi,
    m.hebcal_event_pattern,
    m.priority,
    m.yom_tov_level,
    m.fast_start_type
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.hebcal_event_pattern IS NOT NULL
ORDER BY m.priority ASC, t.tag_key;
```

### 2. Find Tags for a Specific HebCal Event

```sql
SELECT
    t.tag_key,
    t.display_name_english_ashkenazi,
    m.hebcal_event_pattern,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE 'Chanukah: 3 Candles' LIKE m.hebcal_event_pattern
ORDER BY m.priority ASC;
```

**Result**:
```
tag_key          | display_name           | pattern              | priority
-----------------|------------------------|----------------------|----------
chanukah_day_3   | Chanukah: 3 Candles   | Chanukah: 3 Candles | 10
chanukah         | Chanukah              | Chanukah%           | 50
```

### 3. Get Zmanim for Active Event Codes

```sql
SELECT DISTINCT
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    array_agg(DISTINCT t.tag_key) as tags
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
JOIN zman_tags t ON t.id = pzt.tag_id
WHERE pz.publisher_id = 2
  AND pz.is_enabled = true
  AND t.tag_key = ANY(ARRAY['erev_shabbos', 'chanukah'])
GROUP BY pz.id, pz.zman_key, pz.hebrew_name, pz.english_name;
```

### 4. Validate HebCal Coverage

```sql
-- Check how many HebCal events have matching patterns
WITH hebcal_events AS (
    SELECT 'Rosh Hashana I' as title
    UNION ALL SELECT 'Chanukah: 3 Candles'
    UNION ALL SELECT 'Asara B''Tevet'
    -- ... add all HebCal event names
)
SELECT
    COUNT(*) FILTER (WHERE matched) as mapped_count,
    COUNT(*) FILTER (WHERE NOT matched) as unmapped_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE matched) / COUNT(*), 2) as coverage_percent
FROM (
    SELECT
        he.title,
        EXISTS (
            SELECT 1
            FROM tag_event_mappings tem
            WHERE he.title LIKE tem.hebcal_event_pattern
        ) as matched
    FROM hebcal_events he
) coverage;
```

---

## Tag Matching Algorithm

### Algorithm Implementation

The `ShouldShowZman` function in `zmanim_service.go` implements tag-based filtering:

```go
func (s *ZmanimService) ShouldShowZman(
    tags []EventFilterTag,
    activeEventCodes []string,
) bool {
    // STEP 1: Filter to event tags ONLY
    // Category tags are for UI grouping, not filtering
    eventTags := []EventFilterTag{}
    for _, tag := range tags {
        if tag.TagType == "event" {
            eventTags = append(eventTags, tag)
        }
    }

    // STEP 2: No event tags = always show (regular zmanim)
    if len(eventTags) == 0 {
        return true
    }

    // STEP 3: Check negated tags first (exclusions take precedence)
    for _, tag := range eventTags {
        if tag.IsNegated {
            if sliceContains(activeEventCodes, tag.TagKey) {
                return false // Negated tag matched = HIDE
            }
        }
    }

    // STEP 4: Check positive tags
    hasPositiveTags := false
    hasPositiveMatch := false

    for _, tag := range eventTags {
        if !tag.IsNegated {
            hasPositiveTags = true
            if sliceContains(activeEventCodes, tag.TagKey) {
                hasPositiveMatch = true
                break // At least one positive tag matched = SHOW
            }
        }
    }

    // STEP 5: Final decision
    if hasPositiveTags && !hasPositiveMatch {
        return false // Has positive tags but none matched = HIDE
    }

    return true // No positive tags OR at least one matched = SHOW
}
```

### Tag Matching Logic Table

| Scenario | Tags | Active Codes | Result | Reason |
|----------|------|--------------|--------|--------|
| No event tags | `[]` | Any | SHOW | Regular zmanim always show |
| Single positive match | `[erev_shabbos]` | `[erev_shabbos, chanukah]` | SHOW | Tag matches |
| Single positive no match | `[erev_shabbos]` | `[chanukah]` | HIDE | Tag doesn't match |
| Multiple positive (OR) | `[erev_shabbos, erev_yom_tov]` | `[erev_shabbos]` | SHOW | At least one matches |
| Negated tag matches | `[shabbos, !rosh_chodesh]` | `[shabbos, rosh_chodesh]` | HIDE | Negated takes precedence |
| Negated tag doesn't match | `[shabbos, !rosh_chodesh]` | `[shabbos]` | SHOW | Negated doesn't block |
| Only negated tags | `[!rosh_chodesh]` | `[chanukah]` | SHOW | No positive tags to check |

---

## Event Code Flow

### Complete Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HTTP Request                                              │
│    GET /api/v1/publisher/zmanim?date=2025-12-26             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Handler: Get Calendar Context                            │
│    calService.GetEventDayInfo(date, loc, translitStyle)     │
│                                                              │
│    → Calls HebCal API                                       │
│    → Gets events: ["Chanukah: 3 Candles"]                   │
│    → Queries tag_event_mappings from database               │
│    → Matches patterns: "Chanukah: 3 Candles"                │
│    → Returns: ActiveEventCodes = ["chanukah",               │
│                                   "chanukah_day_3",         │
│                                   "erev_shabbos"]           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Handler: Call Zmanim Service                             │
│    zmanimService.CalculateZmanim(ctx, CalculateParams{      │
│        PublisherID: 2,                                      │
│        LocalityID: 4993250,                                 │
│        Date: 2025-12-26,                                    │
│        ActiveEventCodes: ["chanukah", "chanukah_day_3",     │
│                          "erev_shabbos"]                    │
│    })                                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Service: Load Publisher Zmanim with Tags                 │
│    SELECT pz.*, jsonb_agg(                                  │
│        jsonb_build_object(                                  │
│            'tag_key', zt.tag_key,                           │
│            'tag_type', tt.key,                              │
│            'is_negated', pzt.is_negated                     │
│        )                                                    │
│    ) as tags                                                │
│    FROM publisher_zmanim pz                                 │
│    LEFT JOIN publisher_zman_tags pzt ...                    │
│    WHERE pz.publisher_id = 2                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Service: Filter Zmanim BEFORE Calculation                │
│    for each zman:                                           │
│        if !ShouldShowZman(zman.tags, ActiveEventCodes):    │
│            continue  // Skip - don't calculate              │
│        formulas[zman.key] = zman.formula                   │
│                                                              │
│    Result: Only 42 zmanim passed filter (out of 150)        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. DSL Executor: Calculate ONLY Filtered Zmanim             │
│    ExecuteFormulaSet(formulas, dslCtx)                      │
│                                                              │
│    Only calculates the 42 zmanim that passed filtering      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Response: Return Calculated Zmanim                       │
│    {                                                        │
│        "day_context": {                                     │
│            "active_event_codes": ["chanukah",               │
│                                  "erev_shabbos"],          │
│            "is_shabbat": false,                             │
│            "is_yomtov": false                               │
│        },                                                   │
│        "zmanim": [                                          │
│            {key: "shacharit", time: "07:32:15", ...},       │
│            {key: "hadlakas_neiros", time: "16:12:00", ...}, │
│            {key: "chanukah_candles", time: "16:12:00", ...} │
│        ]                                                    │
│    }                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Filtering happens ONCE** - In service, before calculation
2. **No post-processing** - Handler returns exactly what service calculated
3. **Tag-driven** - ALL logic in `ShouldShowZman()` function
4. **Database-driven** - Patterns stored in database, not code
5. **Efficient** - Only calculates zmanim that will be displayed

---

## Testing & Validation

### Automated Coverage Validation

Script: `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh`

```bash
# Check current year coverage
./scripts/validate-hebcal-coverage.sh 5786

# Expected output:
# Coverage: 100.00%
# ✓ All 140 HebCal events are mapped!
```

### Manual Testing Scenarios

#### Friday (Erev Shabbos)
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-26" | \
  jq '.data.day_context.active_event_codes'

# Expected: ["erev_shabbos"]
# Should show: candle lighting, kabbalas shabbos zmanim
```

#### Saturday (Shabbos)
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-27" | \
  jq '.data.day_context.active_event_codes'

# Expected: ["shabbos", "motzei_shabbos"]
# Should show: havdalah, melave malka zmanim
```

#### Regular Weekday
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-24" | \
  jq '.data.day_context.active_event_codes'

# Expected: []
# Should show: only regular daily zmanim (no event-specific ones)
```

#### Fast Day (Asara B'Teves)
```bash
curl "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2026-01-09" | \
  jq '.data.day_context.active_event_codes'

# Expected: ["asarah_bteves", "fast_day"]
# Should show: fast start, fast end, specific fast zmanim
```

### Database Validation Queries

```sql
-- 1. Check for unmapped HebCal events
SELECT title
FROM (VALUES
    ('Rosh Hashana I'),
    ('Chanukah: 3 Candles'),
    ('Asara B''Tevet')
    -- Add all HebCal events here
) AS hebcal(title)
WHERE NOT EXISTS (
    SELECT 1
    FROM tag_event_mappings m
    WHERE hebcal.title LIKE m.hebcal_event_pattern
);

-- 2. Check for duplicate patterns
SELECT
    hebcal_event_pattern,
    COUNT(*) as pattern_count,
    string_agg(t.tag_key, ', ') as tags
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
GROUP BY hebcal_event_pattern
HAVING COUNT(*) > 1
ORDER BY pattern_count DESC;

-- 3. Verify priority ordering
SELECT
    t.tag_key,
    m.hebcal_event_pattern,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.hebcal_event_pattern LIKE 'Chanukah%'
ORDER BY m.priority ASC;
```

---

## Summary

The tag-driven event architecture achieves:

1. **Zero Hardcoded Logic** - All event mapping in database
2. **Perfect Synchronization** - Automated validation ensures 100% coverage
3. **Maintainability** - Add new events with SQL only, no code changes
4. **Performance** - Pre-calculation filtering reduces DSL execution
5. **Transparency** - All logic queryable and auditable

**Key Files**:
- `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go` - Tag matching logic
- `/home/daniel/repos/zmanim/api/internal/db/queries/tag_events.sql` - Database queries
- `/home/daniel/repos/zmanim/db/migrations/20251224210000_sync_hebcal_events.sql` - Latest migration
- `/home/daniel/repos/zmanim/scripts/validate-hebcal-coverage.sh` - Coverage validation
