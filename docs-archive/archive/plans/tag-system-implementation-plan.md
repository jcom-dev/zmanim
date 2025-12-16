# Tag System Implementation Plan

## Overview

This document consolidates the implementation plan for enhancing the zmanim tag system with:
1. **Jewish Day Tags** - New tags for specific calendar days
2. **Tag UI Redesign** - Command palette style interface for managing tags

### Design Decision: No "Erev" Tags

We intentionally **do not** include erev (day before) tags like `erev_pesach`, `erev_yom_kippur`, etc. because:

1. **DSL already supports this**: The `day_before()` function handles erev-specific calculations
2. **Redundant**: "Day of" is always the default - no need for explicit tags
3. **Simpler model**: Tags identify WHAT day it is, DSL handles WHEN to calculate

**Example**: Chametz deadline on Erev Pesach
- Tag the zman with `pesach` (the holiday it relates to)
- Use `day_before(@sof_zman_achilas_chametz)` in DSL if calculating from day before
- The zman appears on Erev Pesach because it's calculated for day_before the tagged day

---

## Part 1: Database Changes

### 1.1 Add New Tag Type

```sql
-- Add 'jewish_day' to allowed tag types
ALTER TABLE zman_tags DROP CONSTRAINT IF EXISTS zman_tags_tag_type_check;
ALTER TABLE zman_tags ADD CONSTRAINT zman_tags_tag_type_check
CHECK (tag_type IN ('event', 'timing', 'behavior', 'shita', 'calculation', 'category', 'jewish_day'));
```

### 1.2 Insert Jewish Day Tags

```sql
-- Jewish Day Tags (linked to specific calendar days)
-- These are PRIMARY day markers - HebCal handles Israel vs Diaspora differences automatically
INSERT INTO zman_tags (tag_key, name, display_name_hebrew, display_name_english, tag_type, description, sort_order) VALUES

-- Omer Period (49 days from 2nd night Pesach to Shavuos)
('omer', 'omer', 'ספירת העומר', 'Sefirat HaOmer', 'jewish_day', 'During the Omer counting period (49 days)', 300),

-- Chanukah (8 days)
('chanukah', 'chanukah', 'חנוכה', 'Chanukah', 'jewish_day', 'Festival of Lights (8 days)', 310),

-- Purim
('purim', 'purim', 'פורים', 'Purim', 'jewish_day', 'Feast of Lots', 320),
('shushan_purim', 'shushan_purim', 'שושן פורים', 'Shushan Purim', 'jewish_day', 'Purim in walled cities', 321),
('taanis_esther', 'taanis_esther', 'תענית אסתר', 'Taanis Esther', 'jewish_day', 'Fast of Esther', 322),

-- Pesach (HebCal handles 7 vs 8 days for Israel/Diaspora)
('erev_pesach', 'erev_pesach', 'ערב פסח', 'Erev Pesach', 'jewish_day', 'Day before Passover (chametz times)', 330),
('pesach', 'pesach', 'פסח', 'Pesach', 'jewish_day', 'Passover festival days', 331),
('chol_hamoed_pesach', 'chol_hamoed_pesach', 'חול המועד פסח', 'Chol HaMoed Pesach', 'jewish_day', 'Intermediate days of Pesach', 332),

-- Shavuos (HebCal handles 1 vs 2 days for Israel/Diaspora)
('erev_shavuos', 'erev_shavuos', 'ערב שבועות', 'Erev Shavuos', 'jewish_day', 'Day before Shavuos', 340),
('shavuos', 'shavuos', 'שבועות', 'Shavuos', 'jewish_day', 'Feast of Weeks', 341),

-- Elul & High Holidays
('selichos', 'selichos', 'סליחות', 'Selichos', 'jewish_day', 'Penitential prayer period', 350),
('erev_rosh_hashanah', 'erev_rosh_hashanah', 'ערב ראש השנה', 'Erev Rosh Hashanah', 'jewish_day', 'Day before Rosh Hashanah', 351),
('rosh_hashanah', 'rosh_hashanah', 'ראש השנה', 'Rosh Hashanah', 'jewish_day', 'Jewish New Year (2 days)', 352),
('tzom_gedaliah', 'tzom_gedaliah', 'צום גדליה', 'Tzom Gedaliah', 'jewish_day', 'Fast of Gedaliah', 353),
('aseres_yemei_teshuva', 'aseres_yemei_teshuva', 'עשרת ימי תשובה', 'Ten Days of Repentance', 'jewish_day', 'Period from RH to YK', 354),
('erev_yom_kippur', 'erev_yom_kippur', 'ערב יום כיפור', 'Erev Yom Kippur', 'jewish_day', 'Day before Yom Kippur', 355),
('yom_kippur', 'yom_kippur', 'יום כיפור', 'Yom Kippur', 'jewish_day', 'Day of Atonement', 356),

-- Sukkos (HebCal handles Israel/Diaspora differences)
('erev_sukkos', 'erev_sukkos', 'ערב סוכות', 'Erev Sukkos', 'jewish_day', 'Day before Sukkos', 360),
('sukkos', 'sukkos', 'סוכות', 'Sukkos', 'jewish_day', 'Feast of Tabernacles', 361),
('chol_hamoed_sukkos', 'chol_hamoed_sukkos', 'חול המועד סוכות', 'Chol HaMoed Sukkos', 'jewish_day', 'Intermediate days of Sukkos', 362),
('hoshanah_rabbah', 'hoshanah_rabbah', 'הושענא רבה', 'Hoshanah Rabbah', 'jewish_day', '7th day of Sukkos', 363),
('shemini_atzeres', 'shemini_atzeres', 'שמיני עצרת', 'Shemini Atzeres', 'jewish_day', '8th day of assembly', 364),
('simchas_torah', 'simchas_torah', 'שמחת תורה', 'Simchas Torah', 'jewish_day', 'Rejoicing of the Torah (Diaspora: day 2)', 365),

-- Minor Fasts
('asarah_bteves', 'asarah_bteves', 'עשרה בטבת', 'Asarah B''Teves', 'jewish_day', '10th of Teves fast', 370),
('shiva_asar_btamuz', 'shiva_asar_btamuz', 'שבעה עשר בתמוז', 'Shiva Asar B''Tamuz', 'jewish_day', '17th of Tamuz fast', 371),
('tisha_bav', 'tisha_bav', 'תשעה באב', 'Tisha B''Av', 'jewish_day', '9th of Av', 372),
('erev_tisha_bav', 'erev_tisha_bav', 'ערב תשעה באב', 'Erev Tisha B''Av', 'jewish_day', 'Day/night before Tisha B''Av', 373),

-- Mourning Periods (for restrictions, not zmanim)
('three_weeks', 'three_weeks', 'בין המצרים', 'The Three Weeks', 'jewish_day', 'Period between 17 Tamuz and 9 Av', 380),
('nine_days', 'nine_days', 'תשעת הימים', 'The Nine Days', 'jewish_day', 'First 9 days of Av', 381),

-- Other
('rosh_chodesh', 'rosh_chodesh', 'ראש חודש', 'Rosh Chodesh', 'jewish_day', 'New Moon/Month', 390),
('tu_bshvat', 'tu_bshvat', 'ט"ו בשבט', 'Tu B''Shvat', 'jewish_day', 'New Year for Trees', 391);
```

### 1.3 HebCal Event Mapping Table

```sql
CREATE TABLE IF NOT EXISTS tag_event_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES zman_tags(id) ON DELETE CASCADE,

    -- HebCal integration (primary method)
    -- Pattern matching against HebCal event names
    -- HebCal automatically handles Israel/Diaspora when called with il=true/false
    hebcal_event_pattern VARCHAR(100),  -- e.g., "Chanukah", "Sukkot VII (Hoshana Raba)"

    -- Hebrew date matching (fallback/alternative)
    hebrew_month INTEGER,               -- 1-13 (13 for Adar II)
    hebrew_day_start INTEGER,           -- Start day
    hebrew_day_end INTEGER,             -- End day (for ranges)

    -- Priority for overlapping matches
    priority INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tag_event_mappings_tag ON tag_event_mappings(tag_id);
CREATE INDEX idx_tag_event_mappings_pattern ON tag_event_mappings(hebcal_event_pattern);

-- Insert HebCal mappings
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern) VALUES
-- Sukkos cycle
((SELECT id FROM zman_tags WHERE tag_key = 'shemini_atzeres'), 'Shmini Atzeret'),
((SELECT id FROM zman_tags WHERE tag_key = 'simchas_torah'), 'Simchat Torah'),
((SELECT id FROM zman_tags WHERE tag_key = 'hoshanah_rabbah'), 'Sukkot VII (Hoshana Raba)'),
((SELECT id FROM zman_tags WHERE tag_key = 'sukkos'), 'Sukkot%'),
((SELECT id FROM zman_tags WHERE tag_key = 'chol_hamoed_sukkos'), 'Sukkot % (CH''M)'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_sukkos'), 'Erev Sukkot'),

-- Pesach cycle
((SELECT id FROM zman_tags WHERE tag_key = 'erev_pesach'), 'Erev Pesach'),
((SELECT id FROM zman_tags WHERE tag_key = 'pesach'), 'Pesach%'),
((SELECT id FROM zman_tags WHERE tag_key = 'chol_hamoed_pesach'), 'Pesach % (CH''M)'),

-- Shavuos
((SELECT id FROM zman_tags WHERE tag_key = 'erev_shavuos'), 'Erev Shavuot'),
((SELECT id FROM zman_tags WHERE tag_key = 'shavuos'), 'Shavuot%'),

-- High Holidays
((SELECT id FROM zman_tags WHERE tag_key = 'erev_rosh_hashanah'), 'Erev Rosh Hashana'),
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_hashanah'), 'Rosh Hashana%'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_yom_kippur'), 'Erev Yom Kippur'),
((SELECT id FROM zman_tags WHERE tag_key = 'yom_kippur'), 'Yom Kippur'),
((SELECT id FROM zman_tags WHERE tag_key = 'tzom_gedaliah'), 'Tzom Gedaliah'),

-- Other holidays
((SELECT id FROM zman_tags WHERE tag_key = 'chanukah'), 'Chanukah%'),
((SELECT id FROM zman_tags WHERE tag_key = 'purim'), 'Purim'),
((SELECT id FROM zman_tags WHERE tag_key = 'shushan_purim'), 'Shushan Purim'),
((SELECT id FROM zman_tags WHERE tag_key = 'taanis_esther'), 'Ta''anit Esther'),
((SELECT id FROM zman_tags WHERE tag_key = 'rosh_chodesh'), 'Rosh Chodesh%'),
((SELECT id FROM zman_tags WHERE tag_key = 'tu_bshvat'), 'Tu BiShvat'),

-- Fasts
((SELECT id FROM zman_tags WHERE tag_key = 'asarah_bteves'), 'Asara B''Tevet'),
((SELECT id FROM zman_tags WHERE tag_key = 'shiva_asar_btamuz'), 'Shiva Asar B''Tamuz'),
((SELECT id FROM zman_tags WHERE tag_key = 'tisha_bav'), 'Tish''a B''Av'),
((SELECT id FROM zman_tags WHERE tag_key = 'erev_tisha_bav'), 'Erev Tish''a B''Av'),

-- Omer (special pattern)
((SELECT id FROM zman_tags WHERE tag_key = 'omer'), '%day of the Omer');
```

---

## Part 2: Backend Implementation

### 2.1 HebCal Integration Service

**File: `api/internal/calendar/hebcal.go`**

```go
package calendar

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"
)

type HebCalEvent struct {
    Title    string `json:"title"`
    Category string `json:"category"`
    Hebrew   string `json:"hebrew"`
    Date     string `json:"date"`
}

type HebCalResponse struct {
    Items []HebCalEvent `json:"items"`
}

// IsInIsrael determines if coordinates are within Israel
func IsInIsrael(lat, lng float64) bool {
    // Approximate Israel bounding box
    return lat >= 29.5 && lat <= 33.3 && lng >= 34.2 && lng <= 35.9
}

// GetHebCalEvents fetches Jewish calendar events for a given date and location
func GetHebCalEvents(date time.Time, lat, lng float64) ([]HebCalEvent, error) {
    isIsrael := IsInIsrael(lat, lng)

    url := fmt.Sprintf(
        "https://www.hebcal.com/hebcal?v=1&cfg=json&year=%d&month=%d&day=%d&il=%t&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&o=on",
        date.Year(), int(date.Month()), date.Day(), isIsrael,
    )

    resp, err := http.Get(url)
    if err != nil {
        return nil, fmt.Errorf("hebcal request failed: %w", err)
    }
    defer resp.Body.Close()

    var result HebCalResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("hebcal decode failed: %w", err)
    }

    return result.Items, nil
}

// MatchEventToTags matches HebCal events against tag patterns
func MatchEventToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
    var matchedTags []string

    for _, event := range events {
        for _, mapping := range mappings {
            if matchPattern(event.Title, mapping.Pattern) {
                matchedTags = append(matchedTags, mapping.TagKey)
            }
        }
    }

    return matchedTags
}

// matchPattern supports SQL LIKE-style patterns with % wildcard
func matchPattern(title, pattern string) bool {
    if strings.Contains(pattern, "%") {
        // Convert SQL LIKE pattern to simple matching
        parts := strings.Split(pattern, "%")
        if len(parts) == 2 {
            if parts[0] == "" {
                return strings.HasSuffix(title, parts[1])
            }
            if parts[1] == "" {
                return strings.HasPrefix(title, parts[0])
            }
            return strings.Contains(title, parts[0]) && strings.Contains(title, parts[1])
        }
    }
    return title == pattern
}
```

### 2.2 SQLc Queries

**File: `api/internal/db/queries/tag_events.sql`**

```sql
-- name: GetTagEventMappings :many
SELECT
    t.tag_key,
    m.hebcal_event_pattern as pattern,
    m.priority
FROM tag_event_mappings m
JOIN zman_tags t ON t.id = m.tag_id
WHERE m.hebcal_event_pattern IS NOT NULL
ORDER BY m.priority DESC;

-- name: GetActiveTagsForDate :many
-- Returns tags that should be active for a given set of HebCal event patterns
SELECT DISTINCT t.tag_key, t.display_name_english, t.display_name_hebrew
FROM zman_tags t
JOIN tag_event_mappings m ON m.tag_id = t.id
WHERE m.hebcal_event_pattern LIKE ANY($1::text[])
ORDER BY t.sort_order;

-- name: GetZmanimByActiveTags :many
-- Returns publisher zmanim that have any of the given tags
SELECT pz.*
FROM publisher_zmanim pz
JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id
JOIN zman_tags t ON t.id = pzt.tag_id
WHERE pz.publisher_id = $1
  AND t.tag_key = ANY($2::text[])
  AND pz.is_active = true;
```

---

## Part 3: Frontend Components

### 3.1 Component Architecture

```
web/components/shared/tags/
├── TagPicker.tsx           # Main composable component
├── TagChip.tsx             # Individual tag badge with animations
├── TagGroup.tsx            # Grouped tags with collapsible header
├── TagSearch.tsx           # Search input with filtering
├── TagFilterDropdown.tsx   # Algorithm page filter (searchable, grouped)
├── TagDrawer.tsx           # Drawer variant for admin
├── TagDisplayGroup.tsx     # Inline display with overflow
├── hooks/
│   ├── useTagSuggestions.ts    # Smart suggestions from formula
│   ├── useRecentTags.ts        # Track recently used (localStorage)
│   └── useTagGroups.ts         # Grouping logic
├── constants.ts            # JEWISH_DAY_GROUPS, priorities, colors
└── index.ts                # Exports
```

### 3.2 Algorithm Page Filter Redesign

**Current Problem**: The "All Tags" dropdown on `/publisher/algorithm` shows a flat list of all tags (Fixed Minutes, GRA, MGA, Solar Angle...). With 58+ tags, this becomes unusable.

**Solution**: Replace with searchable Command palette grouped by tag type.

#### Option A: Two-Level Filter (Recommended)

Two dropdowns - filter by TYPE first, then by specific TAG:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Search zmanim...                                         │
│                                                             │
│ Type: [All Types ▾]  Tag: [All ▾]  [Clear]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Type Dropdown** (7 options - always manageable):
```
┌─ Filter by Type ─────────────┐
│ ○ All Types                  │
│ ─────────────────────────────│
│ ○ Behavior (4)               │
│ ○ Events (6)                 │
│ ○ Jewish Days (31)           │
│ ○ Timing (3)                 │
│ ○ Shita (7)                  │
│ ○ Calculation (5)            │
│ ○ Category (5)               │
└──────────────────────────────┘
```

**Tag Dropdown** (contextual - only shows tags of selected type):
```
When Type = "Jewish Days":
┌─ Filter by Tag ──────────────┐
│ 🔍 Search...                 │
│ ○ All Jewish Days            │
│ ─────────────────────────────│
│ YAMIM TOVIM                  │
│ ○ Rosh Hashanah              │
│ ○ Yom Kippur                 │
│ ○ Sukkos                     │
│ FASTS                        │
│ ○ Tzom Gedaliah              │
│ ○ Tisha B'Av                 │
└──────────────────────────────┘

When Type = "Shita":
┌─ Filter by Tag ──────────────┐
│ ○ All Shitos                 │
│ ─────────────────────────────│
│ ○ GRA                        │
│ ○ MGA                        │
│ ○ Rabbeinu Tam               │
│ ○ Fixed Minutes              │
│ ○ Solar Angle                │
│ ○ Proportional Hours         │
└──────────────────────────────┘
```

#### Option B: Single Smart Dropdown with Search

For simpler implementation, a searchable dropdown with grouping:

```
┌─ Tags ───────────────────────┐
│ 🔍 Search tags...        ⌘K │
│                              │
│ ○ All Tags                   │
│ ─────────────────────────────│
│ BEHAVIOR                     │
│   ○ Candle Lighting          │
│   ○ Havdalah                 │
│   ○ Fast Start               │
│   ○ Fast End                 │
│ ─────────────────────────────│
│ SHITA                        │
│   ○ GRA                      │
│   ○ MGA                      │
│   ○ Rabbeinu Tam             │
│ ─────────────────────────────│
│ JEWISH DAYS ▸                │
│   (click to expand 31 items) │
│ ─────────────────────────────│
│ ...                          │
└──────────────────────────────┘
```

#### Implementation (using shadcn Command + Popover)

```tsx
// web/components/shared/tags/TagFilterDropdown.tsx
import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Tag, ChevronDown } from 'lucide-react';

interface TagFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  tags: Array<{ tag_key: string; display_name_english: string; tag_type: string }>;
}

const TAG_TYPE_ORDER = ['behavior', 'event', 'jewish_day', 'timing', 'shita', 'calculation', 'category'];
const TAG_TYPE_LABELS: Record<string, string> = {
  behavior: 'Behavior',
  event: 'Events',
  jewish_day: 'Jewish Days',
  timing: 'Timing',
  shita: 'Shita',
  calculation: 'Calculation',
  category: 'Category',
};

export function TagFilterDropdown({ value, onChange, tags }: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Group tags by type
  const groupedTags = useMemo(() => {
    const groups: Record<string, typeof tags> = {};
    for (const tag of tags) {
      if (!groups[tag.tag_type]) groups[tag.tag_type] = [];
      groups[tag.tag_type].push(tag);
    }
    return groups;
  }, [tags]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedTags;
    const lower = search.toLowerCase();
    const filtered: Record<string, typeof tags> = {};
    for (const [type, typeTags] of Object.entries(groupedTags)) {
      const matches = typeTags.filter(t =>
        t.display_name_english.toLowerCase().includes(lower) ||
        t.tag_key.toLowerCase().includes(lower)
      );
      if (matches.length > 0) filtered[type] = matches;
    }
    return filtered;
  }, [groupedTags, search]);

  // Get display label for current value
  const displayLabel = useMemo(() => {
    if (value === 'all') return 'All Tags';
    const tag = tags.find(t => t.tag_key === value);
    return tag?.display_name_english || value;
  }, [value, tags]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 justify-between min-w-[140px]">
          <Tag className="h-4 w-4" />
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search tags..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No tags found.</CommandEmpty>

          <CommandGroup>
            <CommandItem
              onSelect={() => { onChange('all'); setOpen(false); setSearch(''); }}
              className={value === 'all' ? 'bg-muted' : ''}
            >
              All Tags
            </CommandItem>
          </CommandGroup>

          {TAG_TYPE_ORDER.map(type => {
            const typeTags = filteredGroups[type];
            if (!typeTags || typeTags.length === 0) return null;

            return (
              <CommandGroup key={type} heading={TAG_TYPE_LABELS[type] || type}>
                {typeTags.map(tag => (
                  <CommandItem
                    key={tag.tag_key}
                    onSelect={() => { onChange(tag.tag_key); setOpen(false); setSearch(''); }}
                    className={value === tag.tag_key ? 'bg-muted' : ''}
                  >
                    {tag.display_name_english}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

#### Key UX Improvements

1. **Search**: Type to filter instantly (e.g., "shab" → shows "Shabbos")
2. **Grouped by type**: Visual organization with section headers
3. **Jewish Days collapsed by default**: Since it has 31 items, optionally collapse until needed
4. **Keyboard navigation**: Arrow keys, Enter to select
5. **Recent selections**: Could track last 3-5 used filters at top (future enhancement)

### 3.2 TagPicker Component Interface

```tsx
interface TagPickerProps {
  // Data
  selectedIds: string[];
  onChange: (ids: string[]) => void;

  // Filtering
  allowedTypes?: TagType[];      // Limit to specific types
  suggestedIds?: string[];       // Smart suggestions

  // Display
  variant: 'inline' | 'dialog' | 'drawer' | 'dropdown';
  maxVisible?: number;           // For inline variant
  showSearch?: boolean;
  showGroups?: boolean;

  // Behavior
  multiSelect?: boolean;
  disabled?: boolean;
}
```

### 3.3 Jewish Day Groupings

```tsx
// constants.ts
export const JEWISH_DAY_GROUPS = {
  'Yamim Tovim': [
    'rosh_hashanah', 'yom_kippur', 'sukkos', 'shemini_atzeres',
    'simchas_torah', 'pesach', 'shavuos'
  ],
  'Erev Holidays': [
    'erev_rosh_hashanah', 'erev_yom_kippur', 'erev_sukkos',
    'erev_pesach', 'erev_shavuos'
  ],
  'Sukkos Cycle': [
    'hoshanah_rabbah', 'chol_hamoed_sukkos'
  ],
  'Pesach Cycle': [
    'chol_hamoed_pesach'
  ],
  'Fasts': [
    'tzom_gedaliah', 'taanis_esther', 'asarah_bteves',
    'shiva_asar_btamuz', 'tisha_bav', 'erev_tisha_bav'
  ],
  'Other Holidays': [
    'chanukah', 'purim', 'shushan_purim', 'rosh_chodesh', 'tu_bshvat'
  ],
  'Periods': [
    'omer', 'selichos', 'aseres_yemei_teshuva', 'three_weeks', 'nine_days'
  ],
};

export const TAG_TYPE_COLORS: Record<string, string> = {
  behavior: 'hsl(142 76% 36%)',     // Green - actions
  event: 'hsl(221 83% 53%)',        // Blue - occasions
  jewish_day: 'hsl(262 83% 58%)',   // Purple - calendar
  timing: 'hsl(24 95% 53%)',        // Orange - when
  shita: 'hsl(173 80% 40%)',        // Teal - methodology
  calculation: 'hsl(330 81% 60%)',  // Pink - how
  category: 'hsl(47 96% 53%)',      // Gold - what
};

export const TAG_PRIORITY_ORDER = [
  'behavior', 'event', 'jewish_day', 'timing', 'shita', 'calculation', 'category'
];
```

### 3.4 Animations (Framer Motion)

```tsx
// animations.ts
export const tagVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
};

export const panelVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.03 }
  },
};

export const groupVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
};
```

---

## Part 4: Implementation Phases

### Phase 1: Database & Backend (Days 1-3)
1. Create migration file with new tags and mapping table
2. Run migration: `./scripts/migrate.sh`
3. Regenerate SQLc: `cd api && sqlc generate`
4. Implement HebCal service
5. Add API endpoints for tag retrieval with day filtering

### Phase 2: Core TagPicker Component (Days 4-7)
1. Create base `<TagPicker />` with `variant="dialog"`
2. Implement search and grouping logic
3. Add smart suggestions based on formula analysis
4. Replace existing `ZmanTagEditor` with new component

### Phase 3: Inline Display (Days 8-10)
1. Create `TagDisplayGroup` for ZmanCard
2. Implement overflow handling with "+N more"
3. Add expand/collapse animation
4. Replace inline tag display in ZmanCard

### Phase 4: Admin Integration (Days 11-14)
1. Replace registry form tag selector with TagPicker drawer variant
2. Add filter dropdown variant for registry page
3. Implement bulk tag editing

### Phase 5: Polish & Testing (Days 15-17)
1. Keyboard navigation (arrow keys, tab, enter)
2. Recent tags tracking (localStorage)
3. Accessibility audit (ARIA labels, focus management)
4. E2E tests for tag selection flows

---

## Part 5: Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Review existing tag usage

### Database Migration
- [ ] Add `jewish_day` tag type constraint
- [ ] Insert 31 new jewish_day tags
- [ ] Create `tag_event_mappings` table
- [ ] Insert HebCal event mappings
- [ ] Verify with: `SELECT * FROM zman_tags WHERE tag_type = 'jewish_day';`

### Backend
- [ ] Add HebCal service (`api/internal/calendar/hebcal.go`)
- [ ] Add SQLc queries (`api/internal/db/queries/tag_events.sql`)
- [ ] Regenerate SQLc code
- [ ] Add API endpoint for day-filtered zmanim
- [ ] Unit tests for HebCal matching

### Frontend
- [ ] Create `web/components/shared/tags/` directory
- [ ] Implement TagPicker component
- [ ] Replace ZmanTagEditor
- [ ] Replace ZmanCard tag display
- [ ] Replace registry form tag selector
- [ ] Add filter dropdown to registry page

### Testing
- [ ] Unit tests for tag grouping logic
- [ ] E2E tests for tag selection
- [ ] Manual testing of Israel vs Diaspora scenarios
- [ ] Performance testing with 58 tags

---

## Appendix: Israel vs Diaspora Examples

### Same Hebrew Date (22 Tishrei)

**Israel** (HebCal with `il=true`):
```json
{"items": [
  {"title": "Shmini Atzeret", "category": "holiday"},
  {"title": "Simchat Torah", "category": "holiday"}
]}
```
Active tags: `shemini_atzeres`, `simchas_torah`

**Diaspora** (HebCal with `il=false`):
```json
{"items": [
  {"title": "Shmini Atzeret", "category": "holiday"}
]}
```
Active tags: `shemini_atzeres` only

### Pesach Duration

**Israel**: 7 days of Pesach events
**Diaspora**: 8 days of Pesach events

The system handles this automatically - no special code needed per location.

---

## Appendix: Omitted Tags

We intentionally omit these tags as they have no special zmanim:

| Omitted Tag | Reason |
|-------------|--------|
| `lag_baomer` | No special zmanim |
| `megillah_reading` | `purim` tag is sufficient |
| `bedikas_chametz` | `erev_pesach` + `pesach` + `category_chametz` are sufficient |
| `biur_chametz` | Same as above |
| `chanukah_day_1`, etc. | `chanukah` tag covers all 8 days |
| `yom_hashoah`, `yom_hazikaron`, etc. | No halachic zmanim |
| `sheni_chamishi` | No special zmanim, just Torah reading |
