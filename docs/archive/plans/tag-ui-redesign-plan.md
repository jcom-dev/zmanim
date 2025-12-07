# Tag UI Redesign Plan

## Problem Statement

With the addition of ~30 new `jewish_day` tags to the existing ~28 tags, the current tag UI becomes unwieldy:

- **ZmanTagEditor**: Simple checkbox list grouped by type - will have 7+ sections with 8-15 items each
- **ZmanRegistryForm**: Dropdown select grouped by type - already overflowing
- **ZmanCard**: Inline tag badges - will become a wall of badges

Total tags after enhancement: **~58 tags** across 7 categories:
- `event` (6): shabbos, yom_tov, fast_day, pesach, tisha_bav, yom_kippur
- `timing` (3): day_before, day_of, night_after
- `behavior` (4): is_candle_lighting, is_havdalah, is_fast_start, is_fast_end
- `shita` (7): shita_gra, shita_mga, shita_rt, etc.
- `calculation` (3): calc_degrees, calc_fixed, calc_zmanis
- `category` (5): category_shema, category_tefila, category_mincha, etc.
- `jewish_day` (30): All the new specific day tags

## Design Direction

**Aesthetic**: Refined minimalism with depth. Clean, functional, but with surprising micro-interactions that delight. Think: premium financial dashboard meets calendar app.

**Key Principles**:
1. **Progressive Disclosure** - Show what's relevant, hide complexity
2. **Context-Aware** - Only show applicable tags based on zman type
3. **Smart Defaults** - Suggest tags based on formula/category
4. **Visual Hierarchy** - Not all tags are equal in importance

---

## Component Redesigns

### 1. ZmanTagEditor (Dialog) → "Tag Command Palette"

**Current**: Flat list with checkboxes, grouped by type header
**Problem**: 7 sections × ~8 items = scrolling nightmare

**New Design**: Command palette style with search + smart sections

```
┌─────────────────────────────────────────────────────────────┐
│  🏷️ Manage Tags                                        ✕   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔍 Search tags...                               ⌘K │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ── Active Tags (3) ───────────────────────────────────     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ⬡ Shabbos          ⬡ Candle Lighting    ✕ Clear   │    │
│  │ ⬡ Day Before                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ── Suggested ─────────────────────────────────────────     │
│  │ Based on formula: "sunset - 15min"                 │    │
│  │ ○ is_candle_lighting  ○ erev_shabbos  ○ erev_yom_tov    │
│                                                             │
│  ── Quick Add ─────────────────────────────────────────     │
│  │  📅 Jewish Days ▾    ⚡ Behavior ▾    📊 Shita ▾   │    │
│  │                                                    │    │
│  │  ┌ Jewish Days ────────────────────────────────┐   │    │
│  │  │                                             │   │    │
│  │  │  YAMIM TOVIM                                │   │    │
│  │  │  ○ Rosh Hashanah  ○ Yom Kippur              │   │    │
│  │  │  ○ Sukkos         ○ Shemini Atzeres         │   │    │
│  │  │  ○ Pesach         ○ Shavuos                 │   │    │
│  │  │                                             │   │    │
│  │  │  FASTS                                      │   │    │
│  │  │  ○ Tzom Gedaliah  ○ Taanis Esther           │   │    │
│  │  │  ○ Tisha B'Av     ○ Asarah B'Teves          │   │    │
│  │  │                                             │   │    │
│  │  │  SPECIAL DAYS                               │   │    │
│  │  │  ○ Chanukah       ○ Purim                   │   │    │
│  │  │  ○ Omer           ○ Selichos                │   │    │
│  │  └─────────────────────────────────────────────┘   │    │
│  │                                                    │    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                     [ Cancel ]  [ Save ]    │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Notes**:

```tsx
// New component structure
interface TagPaletteProps {
  zmanKey: string;
  formula?: string;  // For smart suggestions
  currentTags: ZmanTag[];
  onSave: (tagIds: string[]) => void;
}

// Smart grouping for Jewish Days
const JEWISH_DAY_GROUPS = {
  'Yamim Tovim': ['rosh_hashanah', 'yom_kippur', 'sukkos', 'shemini_atzeres', 'simchas_torah', 'pesach', 'shavuos'],
  'Erev Holidays': ['erev_rosh_hashanah', 'erev_yom_kippur', 'erev_sukkos', 'erev_pesach', 'erev_shavuos'],
  'Sukkos Cycle': ['hoshanah_rabbah', 'chol_hamoed_sukkos'],
  'Fasts': ['tzom_gedaliah', 'taanis_esther', 'asarah_bteves', 'shiva_asar_btamuz', 'tisha_bav', 'erev_tisha_bav'],
  'Other Holidays': ['chanukah', 'purim', 'shushan_purim', 'rosh_chodesh', 'tu_bshvat'],
  'Periods': ['omer', 'selichos', 'aseres_yemei_teshuva', 'three_weeks', 'nine_days'],
};
```

**Animations**:
- Dropdown sections: `framer-motion` with spring physics
- Tag chips: Scale + opacity on add/remove
- Search: Instant filter with highlight matching text

---

### 2. Inline Tag Display (ZmanCard) → "Semantic Tag Groups"

**Current**: Flat row of ColorBadges
**Problem**: 10+ badges becomes visual noise

**New Design**: Grouped by semantic meaning, with overflow handling

```
┌─────────────────────────────────────────────────────────────┐
│ הדלקת נרות • Hadlakas Neiros                               │
│                                                             │
│ [sunset - 15min]                                            │
│                                                             │
│ 📅 Shabbos, Yom Tov      ⚡ Candle Lighting      🕐 15 min │
│                          ◎ +3 more...                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Collapsed State**:
- Show max 3 "primary" tags (behavior tags take priority)
- "+N more" pill that expands inline on click
- Subtle animation reveals hidden tags

**Implementation**:

```tsx
function TagDisplayGroup({ tags }: { tags: ZmanTag[] }) {
  const [expanded, setExpanded] = useState(false);

  // Priority order: behavior > event > jewish_day > shita > calculation > category
  const prioritizedTags = useMemo(() =>
    sortTagsByPriority(tags), [tags]);

  const visibleTags = expanded ? prioritizedTags : prioritizedTags.slice(0, 3);
  const hiddenCount = prioritizedTags.length - 3;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Group by semantic meaning */}
      <TagCluster tags={visibleTags.filter(t => t.tag_type === 'jewish_day')}
                  icon={Calendar} label="Days" />
      <TagCluster tags={visibleTags.filter(t => t.tag_type === 'behavior')}
                  icon={Zap} label="Action" />
      {hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}
```

---

### 3. Admin Registry Form → "Tag Drawer"

**Current**: Multi-section dropdown select
**Problem**: Doesn't scale, awkward UX for bulk operations

**New Design**: Side drawer with category tabs

```
┌─────────────────────────────────────────────────────────────┐
│ Master Zman: alos_hashachar                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tags (4)                                          Edit │ │
│ │ ⬡ calc_degrees  ⬡ shita_mga  ⬡ category_dawn          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

        │ Click "Edit" │
        ▼

┌────────────────────────────────────┬────────────────────────┐
│ Edit Tags                      ✕   │                        │
├────────────────────────────────────┤                        │
│ ┌──────────────────────────────┐   │                        │
│ │ 🔍 Search...                 │   │    [Form content       │
│ └──────────────────────────────┘   │     stays visible      │
│                                    │     but dimmed]        │
│ ┌─────────────────────────────────┐│                        │
│ │ 📅 Days │ ⚡ Behavior │ 📊 All  ││                        │
│ ├─────────────────────────────────┤│                        │
│ │                                 ││                        │
│ │ [Tab content based on          ││                        │
│ │  selected category]            ││                        │
│ │                                 ││                        │
│ │ ☑ Shemini Atzeres             ││                        │
│ │ ☐ Hoshanah Rabbah             ││                        │
│ │ ☐ Simchas Torah               ││                        │
│ │ ...                            ││                        │
│ │                                 ││                        │
│ └─────────────────────────────────┘│                        │
│                                    │                        │
│ [ Cancel ]              [ Apply ]  │                        │
└────────────────────────────────────┴────────────────────────┘
```

---

### 4. Algorithm Page Filter → "Two-Level Filter"

**Current**: Single dropdown with flat list of all tags (Fixed Minutes, GRA, MGA, Solar Angle...)
**Problem**: With 58+ tags, dropdown becomes unusably long

**New Design**: Two-level approach - filter by TYPE first, then optionally by specific tag

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
│ ○ Behavior (4)         ⚡    │
│ ○ Events (6)           📅    │
│ ○ Jewish Days (31)     🕎    │
│ ○ Timing (3)           🕐    │
│ ○ Shita (7)            📖    │
│ ○ Calculation (5)      🔢    │
│ ○ Category (5)         📁    │
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
│ ...                          │
│ FASTS                        │
│ ○ Tzom Gedaliah              │
│ ○ Tisha B'Av                 │
│ ...                          │
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

**Alternative: Single Smart Dropdown with Search**

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

**Key UX Improvements**:
1. **Search**: Type to filter instantly (e.g., "shab" → shows "Shabbos")
2. **Grouped by type**: Visual organization with collapsible sections
3. **Jewish Days collapsed by default**: Since it has 31 items, collapse until needed
4. **Keyboard navigation**: Arrow keys, Enter to select
5. **Recent selections**: Show last 3-5 used filters at top

**Implementation with Popover + Command (shadcn)**:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';

function TagFilterDropdown({ value, onChange, tags }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Group tags by type
  const groupedTags = useMemo(() => groupTagsByType(tags), [tags]);

  // Filter by search
  const filteredGroups = useMemo(() =>
    filterGroupsBySearch(groupedTags, search), [groupedTags, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between">
          <Tag className="h-4 w-4 mr-2" />
          {value === 'all' ? 'All Tags' : value}
          <ChevronDown className="h-3 w-3 ml-2 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search tags..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>No tags found.</CommandEmpty>

          <CommandGroup>
            <CommandItem onSelect={() => { onChange('all'); setOpen(false); }}>
              All Tags
            </CommandItem>
          </CommandGroup>

          {Object.entries(filteredGroups).map(([type, typeTags]) => (
            <CommandGroup key={type} heading={formatTagType(type)}>
              {typeTags.map(tag => (
                <CommandItem
                  key={tag.tag_key}
                  onSelect={() => { onChange(tag.tag_key); setOpen(false); }}
                >
                  {tag.display_name_english}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## New Shared Component: `<TagPicker />`

A reusable, composable tag picker component:

```tsx
interface TagPickerProps {
  // Data
  selectedIds: string[];
  onChange: (ids: string[]) => void;

  // Filtering
  allowedTypes?: TagType[];  // Limit to specific types
  suggestedIds?: string[];   // Smart suggestions

  // Display
  variant: 'inline' | 'dialog' | 'drawer' | 'dropdown';
  maxVisible?: number;       // For inline variant
  showSearch?: boolean;
  showGroups?: boolean;

  // Behavior
  multiSelect?: boolean;
  disabled?: boolean;
}

// Usage examples:

// Dialog with all features
<TagPicker
  selectedIds={tags}
  onChange={setTags}
  variant="dialog"
  suggestedIds={inferTagsFromFormula(formula)}
/>

// Inline display with overflow
<TagPicker
  selectedIds={tags}
  onChange={setTags}
  variant="inline"
  maxVisible={3}
/>

// Filter dropdown
<TagPicker
  selectedIds={filterTags}
  onChange={setFilterTags}
  variant="dropdown"
  allowedTypes={['jewish_day', 'event']}
/>
```

---

## Visual Design Details

### Color Palette for Tag Types

```css
:root {
  /* Tag type colors - semantic, not decorative */
  --tag-behavior: hsl(142 76% 36%);    /* Green - actions */
  --tag-event: hsl(221 83% 53%);       /* Blue - occasions */
  --tag-jewish-day: hsl(262 83% 58%);  /* Purple - calendar */
  --tag-timing: hsl(24 95% 53%);       /* Orange - when */
  --tag-shita: hsl(173 80% 40%);       /* Teal - methodology */
  --tag-calculation: hsl(330 81% 60%); /* Pink - how */
  --tag-category: hsl(47 96% 53%);     /* Gold - what */
}
```

### Typography

- Tag labels: `font-size: 0.75rem` (12px), `font-weight: 500`
- Group headers: `font-size: 0.625rem` (10px), `text-transform: uppercase`, `letter-spacing: 0.05em`
- Search input: `font-size: 0.875rem` (14px)

### Spacing

- Between tag chips: `gap: 0.375rem` (6px)
- Tag chip padding: `px: 0.5rem, py: 0.25rem`
- Section padding: `p: 1rem`
- Group header margin: `mb: 0.75rem, mt: 1.5rem`

### Animations

```tsx
// Tag chip enter/exit
const tagVariants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
};

// Dropdown/drawer
const panelVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.03 }
  },
};

// Group expand
const groupVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 }
  },
};
```

---

## Implementation Priority

### Phase 1: Core TagPicker Component
1. Create base `<TagPicker />` with `variant="dialog"`
2. Implement search and grouping logic
3. Add smart suggestions based on formula analysis
4. Replace `ZmanTagEditor` with new component

### Phase 2: Inline Display
1. Create `TagDisplayGroup` for ZmanCard
2. Implement overflow handling with "+N more"
3. Add expand/collapse animation

### Phase 3: Admin Integration
1. Replace registry form tag selector
2. Add drawer variant for bulk editing
3. Implement filter dropdown variant

### Phase 4: Polish
1. Keyboard navigation (arrow keys, tab, enter)
2. Recent tags tracking (localStorage)
3. Accessibility audit (ARIA labels, focus management)

---

## File Structure

```
web/components/shared/tags/
├── TagPicker.tsx           # Main composable component
├── TagChip.tsx             # Individual tag badge
├── TagGroup.tsx            # Grouped tags with header
├── TagSearch.tsx           # Search input with filtering
├── TagDropdown.tsx         # Dropdown variant
├── TagDrawer.tsx           # Drawer variant (admin)
├── TagDisplayGroup.tsx     # Inline display with overflow
├── hooks/
│   ├── useTagSuggestions.ts    # Smart suggestions
│   ├── useRecentTags.ts        # Track recently used
│   └── useTagGroups.ts         # Grouping logic
├── constants.ts            # JEWISH_DAY_GROUPS, priorities
└── index.ts                # Exports
```

---

## Migration Path

1. **Week 1**: Build TagPicker core, deploy behind feature flag
2. **Week 2**: Replace ZmanTagEditor, test in production
3. **Week 3**: Add inline display to ZmanCard
4. **Week 4**: Migrate admin registry form
5. **Week 5**: Add filter dropdown, final polish

No breaking changes - old components remain functional until fully replaced.
