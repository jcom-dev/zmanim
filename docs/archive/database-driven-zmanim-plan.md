# Plan: Make Zmanim Data Database-Driven

**Date:** 2025-12-03
**Status:** Proposed
**Priority:** High

## Problem Statement

The codebase contains hardcoded zmanim-related data scattered across 9+ files. This includes:
- Hebrew and English display names
- Time category configurations (icons, labels, colors)
- Tag type labels and ordering
- Section titles and groupings

This violates the principle that all zmanim metadata should be database-driven, making the system inflexible and requiring code changes for what should be data updates.

---

## Hardcoded Data Inventory

### High Severity

| File | Lines | Data Type |
|------|-------|-----------|
| `web/app/zmanim/[cityId]/[publisherId]/page.tsx` | 52-70 | `formatZmanName()` - English name mappings |
| `web/app/zmanim/[cityId]/[publisherId]/page.tsx` | 201-216 | `hebrewNames` - Hebrew name mappings |
| `web/app/zmanim/[cityId]/[publisherId]/page.tsx` | 218-240 | `mapTimeCategory()`, `getSectionTitle()`, `SECTION_ORDER` |

### Medium Severity

| File | Lines | Data Type |
|------|-------|-----------|
| `web/components/publisher/MasterZmanPicker.tsx` | 58-90 | `TIME_CATEGORY_CONFIG` - icons, labels, descriptions |
| `web/components/publisher/MasterZmanPicker.tsx` | 92-116 | `EVENT_CATEGORY_CONFIG` - event category configs |
| `web/components/onboarding/steps/CustomizeZmanimStep.tsx` | 85-143 | Duplicate of above (exact copy) |
| `web/components/admin/ZmanRegistryForm.tsx` | 85-94 | `TIME_CATEGORIES` array for dropdown |
| `web/lib/constants.ts` | 30-56 | `UI_TEXT.categories`, `CATEGORY_COLORS` |

### Low Severity

| File | Lines | Data Type |
|------|-------|-----------|
| `web/components/publisher/RequestZmanModal.tsx` | 76-85 | `TAG_TYPE_LABELS`, `TAG_TYPE_ORDER` |
| `web/app/admin/tag-requests/page.tsx` | 45-49 | `TAG_TYPE_COLORS` |
| `web/components/ui/color-badge.tsx` | 148-182 | `TAG_COLOR_MAP`, color helper functions |

### Backend SQL Queries

| File | Issue |
|------|-------|
| `api/internal/db/queries/master_registry.sql` | 6+ instances of hardcoded `CASE WHEN time_category` for ordering |

---

## Solution Design

### Phase 1: Database Schema Changes

#### 1.1 Create `time_categories` Table

```sql
CREATE TABLE time_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    icon_name VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER NOT NULL,
    is_everyday BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_time_categories_sort ON time_categories(sort_order);
```

#### 1.2 Create `event_categories` Table

```sql
CREATE TABLE event_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    icon_name VARCHAR(50),
    color VARCHAR(20),
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_categories_sort ON event_categories(sort_order);
```

#### 1.3 Create `tag_types` Table

```sql
CREATE TABLE tag_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    display_name_hebrew VARCHAR(100) NOT NULL,
    display_name_english VARCHAR(100) NOT NULL,
    color VARCHAR(50),
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tag_types_sort ON tag_types(sort_order);
```

#### 1.4 Update Foreign Key References

```sql
-- Add FK to master_zmanim_registry
ALTER TABLE master_zmanim_registry
    ADD COLUMN time_category_id UUID REFERENCES time_categories(id);

-- Migrate existing text data to FK
UPDATE master_zmanim_registry mr
SET time_category_id = tc.id
FROM time_categories tc
WHERE mr.time_category = tc.key;

-- Update zman_tags to reference tag_types
ALTER TABLE zman_tags
    ADD COLUMN tag_type_id UUID REFERENCES tag_types(id);

UPDATE zman_tags zt
SET tag_type_id = tt.id
FROM tag_types tt
WHERE zt.tag_type = tt.key;
```

---

### Phase 2: Seed Data Migration

```sql
-- Time Categories
INSERT INTO time_categories (key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order, is_everyday) VALUES
('dawn', 'שחר', 'Dawn', 'Alos HaShachar variants', 'Sunrise', 'purple', 1, true),
('sunrise', 'זריחה', 'Sunrise', 'Sunrise and early morning', 'Sun', 'amber', 2, true),
('morning', 'בוקר', 'Morning', 'Shema and Tefillah times', 'Clock', 'yellow', 3, true),
('midday', 'צהריים', 'Midday', 'Chatzos and Mincha Gedolah', 'Sun', 'orange', 4, true),
('afternoon', 'אחה"צ', 'Afternoon', 'Mincha and Plag times', 'Clock', 'rose', 5, true),
('sunset', 'שקיעה', 'Sunset', 'Shkiah', 'Sunset', 'rose', 6, true),
('nightfall', 'צאת הכוכבים', 'Nightfall', 'Tzeis HaKochavim variants', 'Moon', 'indigo', 7, true),
('midnight', 'חצות לילה', 'Midnight', 'Chatzos Layla', 'Moon', 'slate', 8, true);

-- Event Categories
INSERT INTO event_categories (key, display_name_hebrew, display_name_english, description, icon_name, color, sort_order) VALUES
('candles', 'הדלקת נרות', 'Candle Lighting', 'Shabbos, Yom Tov, and Yom Kippur', 'CandlestickChart', 'amber', 1),
('havdalah', 'הבדלה', 'Havdalah', 'End of Shabbos and Yom Tov', 'Flame', 'purple', 2),
('yom_kippur', 'יום כיפור', 'Yom Kippur', 'Fast start and end times', 'Moon', 'slate', 3),
('fast_day', 'תענית', 'Fast Days', 'Fast end times (regular fasts)', 'Timer', 'gray', 4),
('tisha_bav', 'תשעה באב', 'Tisha B''Av', 'Fast starts at sunset, ends at nightfall', 'Moon', 'slate', 5),
('pesach', 'פסח', 'Pesach', 'Chametz eating and burning times', 'Utensils', 'green', 6);

-- Tag Types
INSERT INTO tag_types (key, display_name_hebrew, display_name_english, color, sort_order) VALUES
('timing', 'זמן', 'Time of Day', 'bg-green-500/10 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-700', 1),
('event', 'אירוע', 'Event Type', 'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700', 2),
('shita', 'שיטה', 'Shita (Halachic Opinion)', 'bg-cyan-500/10 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-700', 3),
('method', 'שיטת חישוב', 'Calculation Method', 'bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-700', 4),
('behavior', 'התנהגות', 'Behavior', 'bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-700', 5);
```

---

### Phase 3: Backend API Changes

#### 3.1 New SQLc Queries

Create `api/internal/db/queries/categories.sql`:

```sql
-- name: GetAllTimeCategories :many
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, is_everyday, created_at
FROM time_categories
ORDER BY sort_order;

-- name: GetTimeCategoryByKey :one
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, is_everyday, created_at
FROM time_categories
WHERE key = $1;

-- name: GetAllEventCategories :many
SELECT id, key, display_name_hebrew, display_name_english,
       description, icon_name, color, sort_order, created_at
FROM event_categories
ORDER BY sort_order;

-- name: GetAllTagTypes :many
SELECT id, key, display_name_hebrew, display_name_english,
       color, sort_order, created_at
FROM tag_types
ORDER BY sort_order;

-- name: GetTagTypeByKey :one
SELECT id, key, display_name_hebrew, display_name_english,
       color, sort_order, created_at
FROM tag_types
WHERE key = $1;
```

#### 3.2 Update Existing Queries

Replace hardcoded `CASE WHEN` ordering with JOIN-based ordering:

```sql
-- Before (hardcoded):
ORDER BY
    CASE time_category
        WHEN 'dawn' THEN 1
        WHEN 'sunrise' THEN 2
        ...
    END

-- After (database-driven):
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
ORDER BY tc.sort_order, mr.canonical_hebrew_name
```

#### 3.3 New API Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/categories/time` | `GetTimeCategories` | List all time categories |
| GET | `/api/categories/events` | `GetEventCategories` | List all event categories |
| GET | `/api/tag-types` | `GetTagTypes` | List all tag types |

These should be public endpoints (no auth required) and cached aggressively.

---

### Phase 4: Frontend Changes

#### 4.1 Create Category Hooks

Create `web/lib/hooks/useCategories.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';

export interface TimeCategory {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  description: string;
  icon_name: string;
  color: string;
  sort_order: number;
  is_everyday: boolean;
}

export interface EventCategory {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  description: string;
  icon_name: string;
  color: string;
  sort_order: number;
}

export interface TagType {
  id: string;
  key: string;
  display_name_hebrew: string;
  display_name_english: string;
  color: string;
  sort_order: number;
}

export function useTimeCategories() {
  const api = useApi();
  return useQuery<TimeCategory[]>({
    queryKey: ['time-categories'],
    queryFn: () => api.public.get('/categories/time'),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useEventCategories() {
  const api = useApi();
  return useQuery<EventCategory[]>({
    queryKey: ['event-categories'],
    queryFn: () => api.public.get('/categories/events'),
    staleTime: 1000 * 60 * 60,
  });
}

export function useTagTypes() {
  const api = useApi();
  return useQuery<TagType[]>({
    queryKey: ['tag-types'],
    queryFn: () => api.public.get('/tag-types'),
    staleTime: 1000 * 60 * 60,
  });
}
```

#### 4.2 Create Icon Registry

Create `web/lib/icons.ts`:

```typescript
import {
  Sunrise,
  Sunset,
  Moon,
  Sun,
  Clock,
  Timer,
  Flame,
  CandlestickChart,
  Utensils,
  LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Sunrise,
  Sunset,
  Moon,
  Sun,
  Clock,
  Timer,
  Flame,
  CandlestickChart,
  Utensils,
};

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Clock;
}
```

#### 4.3 Component Updates

**MasterZmanPicker.tsx:**
```typescript
// Before
const TIME_CATEGORY_CONFIG: Record<string, {...}> = { ... };

// After
const { data: timeCategories } = useTimeCategories();
const { data: eventCategories } = useEventCategories();

// Use timeCategories.map() instead of Object.entries(TIME_CATEGORY_CONFIG)
```

**CustomizeZmanimStep.tsx:**
- Delete duplicate `TIME_CATEGORY_CONFIG` and `EVENT_CATEGORY_CONFIG`
- Import and use `useTimeCategories()` and `useEventCategories()`

**ZmanRegistryForm.tsx:**
```typescript
// Before
const TIME_CATEGORIES = [
  { key: 'dawn', display_name: 'Dawn' },
  ...
];

// After
const { data: timeCategories } = useTimeCategories();
// Use timeCategories directly in Select component
```

**[cityId]/[publisherId]/page.tsx:**
```typescript
// Before
const formatZmanName = (key: string): string => {
  const names: Record<string, string> = { ... };
  return names[key] || key;
};

// After
// Use zman.canonical_english_name and zman.canonical_hebrew_name
// directly from API response (already available via master_registry join)
```

**color-badge.tsx:**
```typescript
// Before
export const TAG_COLOR_MAP = { ... };

// After
// Colors come from database via useTimeCategories() and useTagTypes()
// Create helper that looks up color from cached data
```

---

### Phase 5: Cleanup

After all components are updated:

1. Remove `formatZmanName()` function from `page.tsx`
2. Remove `hebrewNames` object from `page.tsx`
3. Remove `mapTimeCategory()` and `getSectionTitle()` from `page.tsx`
4. Remove `TIME_CATEGORY_CONFIG` from `MasterZmanPicker.tsx`
5. Remove `EVENT_CATEGORY_CONFIG` from `MasterZmanPicker.tsx`
6. Remove entire duplicate section from `CustomizeZmanimStep.tsx`
7. Remove `TIME_CATEGORIES` from `ZmanRegistryForm.tsx`
8. Remove `TAG_TYPE_LABELS` and `TAG_TYPE_ORDER` from `RequestZmanModal.tsx`
9. Remove `TAG_TYPE_COLORS` from `tag-requests/page.tsx`
10. Remove `TAG_COLOR_MAP` and static helper functions from `color-badge.tsx`
11. Remove `UI_TEXT.categories` and `CATEGORY_COLORS` from `constants.ts`
12. Remove hardcoded `CASE WHEN` statements from SQL queries

---

## Acceptable Exceptions

The following can remain hardcoded as they are code-level concerns, not data:

1. **Tag type keys as TypeScript types** - e.g., `type TagType = 'event' | 'timing' | 'behavior'`
2. **Icon component imports** - React components must be imported in code
3. **Base Tailwind color tokens** - Design system primitives
4. **Algorithm template files** (`gra.json`, `mga.json`) - These are calculation configurations, not display metadata

---

## Implementation Order

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Schema | 2 hours | None |
| Phase 2: Seed Data | 1 hour | Phase 1 |
| Phase 3: Backend API | 3 hours | Phase 1, 2 |
| Phase 4: Frontend | 6 hours | Phase 3 |
| Phase 5: Cleanup | 2 hours | Phase 4 |

**Total Estimated Effort:** 14 hours

---

## Testing Checklist

- [ ] All time categories display correctly in MasterZmanPicker
- [ ] All event categories display correctly in CustomizeZmanimStep
- [ ] ZmanRegistryForm dropdown shows all categories
- [ ] Tag type labels and colors render correctly in RequestZmanModal
- [ ] Admin tag requests page shows correct colors
- [ ] Zmanim list page shows Hebrew and English names correctly
- [ ] Section grouping and ordering works correctly
- [ ] Color badges render with correct colors
- [ ] No console errors about missing data
- [ ] Performance is acceptable (category data cached)

---

## Rollback Plan

If issues arise:
1. Revert frontend components to use hardcoded configs
2. Keep database tables for future use
3. API endpoints can remain (unused)

The database changes are additive and don't break existing functionality.
