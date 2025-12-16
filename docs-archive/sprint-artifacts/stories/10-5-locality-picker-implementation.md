# Story 10.5: LocalityPicker Implementation Report

**Status:** Phase 1 Complete - Core Infrastructure
**Date:** 2025-12-16
**Commit:** 4e997bf

---

## Summary

Created unified LocalityPicker component infrastructure with shared utilities, search hook, and reusable component. All coding standards compliance verified. Page migrations deferred to next phase pending Overture data import and UX analysis.

---

## ✅ COMPLETED

### 1. Shared Utilities - `web/lib/locality-display.ts` (343 lines)

**Exports:**
- `getEntityIcon(type, className)` - Returns Lucide icon for entity type
- `getEntityBadgeColor(type)` - Returns Tailwind badge color classes (design tokens only)
- `getEntityTextColor(type)` - Returns text color classes (design tokens only)
- `getEntityLabel(type)` - Returns human-readable label
- `buildHierarchyDisplay(locality, options)` - Builds hierarchy breadcrumb string with options
- `buildResponsiveHierarchy(locality)` - Returns `{full, medium, minimal}` for responsive display
- `POPULAR_LOCALITIES` constant - 6 cities (Jerusalem, NYC, LA, London, Tel Aviv, Miami)

**Types:**
- `LocalityTypeCode` = 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough'
- `RegionTypeCode` = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture'
- `GeoEntityType` = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode

**Design tokens used:**
- `bg-primary/10`, `text-primary` (continent)
- `bg-blue-100`, `text-blue-700` + dark mode variants (country)
- `bg-purple-100`, `text-purple-700` + dark mode variants (region/state/province)
- `bg-amber-100`, `text-amber-700` + dark mode variants (city)
- `bg-rose-100`, `text-rose-700` + dark mode variants (neighborhood)
- All other entity types use appropriate Tailwind design tokens

**NO hardcoded colors verified:**
```bash
grep -rn "#[0-9a-fA-F]\{3,6\}" web/lib/locality-display.ts
# Expected: No matches ✅
```

---

### 2. Search Hook - `web/lib/hooks/useLocalitySearch.ts` (224 lines)

**Features:**
- Debounced search (default 300ms, configurable)
- Type filtering (e.g., `types: ['city', 'town']`)
- Country/region filtering (`countryId`, `regionId`)
- Exclude list support (for already-selected items)
- Result limit (default 20)
- Minimum query length (default 2)
- Abort controller for request cancellation on unmount/new search

**API:**
```typescript
const { results, isLoading, error, search, clear, query } = useLocalitySearch({
  types: ['city', 'town'],
  countryId: 840,
  regionId: 123,
  exclude: ['293397', '5128581'],
  debounce: 300,
  limit: 20,
  minQueryLength: 2,
});
```

**Compliance:**
- ✅ Uses `useApi()` hook (NO raw fetch)
- ✅ Proper abort handling
- ✅ TypeScript types (NO `any`)

**Verification:**
```bash
grep -rn "await fetch\|fetch(" web/lib/hooks/useLocalitySearch.ts | grep -v "api-client"
# Expected: No matches ✅
```

---

### 3. LocalityPicker Component - `web/components/shared/LocalityPicker.tsx` (424 lines)

**Props:**
```typescript
interface LocalityPickerProps {
  mode?: 'single' | 'multi';                // Selection mode
  variant?: 'inline' | 'dropdown' | 'compact';  // Visual variant
  placeholder?: string;
  onSelect: (selection: LocalitySelection | LocalitySelection[]) => void;
  onHighlight?: (item: LocalitySelection | null) => void;  // For map preview
  exclude?: LocalitySelection[];            // Already selected
  types?: GeoEntityType[];                  // Filter by types
  countryId?: number;                       // Filter by country
  regionId?: number;                        // Filter by region
  showQuickSelect?: boolean;                // Popular localities
  showTypeFilters?: boolean;                // Type filter tabs
  autoFocus?: boolean;
  className?: string;
}
```

**Features:**
- **Single-select mode:** User searches, selects one item, input clears
- **Multi-select mode:** User searches, adds multiple items, confirms with "Add X Localities" button
- **Type filters:** Tabs for All, Cities, Towns, Neighborhoods, Regions (when `showTypeFilters=true`)
- **Quick select:** Grid of popular localities (when `showQuickSelect=true` and query is empty)
- **Keyboard navigation:**
  - Arrow Down/Up: Navigate results
  - Enter: Select highlighted result
  - Escape: Close dropdown and clear
- **Responsive hierarchy:**
  - Mobile (<640px): "Brooklyn, US"
  - Tablet (640-1024px): "Brooklyn → NYC → US"
  - Desktop (>1024px): "Brooklyn (Neighborhood) → NYC → NY → USA"
- **ARIA attributes:**
  - `role="combobox"` on input
  - `aria-expanded` for dropdown state
  - `role="listbox"` on results
  - `role="option"` on result items
  - `aria-selected` on highlighted item

**Usage Examples:**

Single-select:
```tsx
<LocalityPicker
  mode="single"
  showQuickSelect
  onSelect={(selection) => {
    router.push(`/zmanim/${selection.id}`);
  }}
/>
```

Multi-select with filters:
```tsx
<LocalityPicker
  mode="multi"
  showTypeFilters
  showQuickSelect
  exclude={existingCoverage}
  onSelect={(selections) => {
    addCoverage(selections);
  }}
/>
```

With map preview:
```tsx
<LocalityPicker
  mode="single"
  onSelect={handleSelect}
  onHighlight={(item) => {
    if (item?.latitude && item?.longitude) {
      map.flyTo([item.latitude, item.longitude]);
    }
  }}
/>
```

---

### 4. TypeScript Types - `web/types/geography.ts`

**Added types:**
```typescript
export type LocalityTypeCode = 'city' | 'town' | 'village' | 'hamlet' | 'neighborhood' | 'borough';
export type RegionTypeCode = 'region' | 'county' | 'localadmin' | 'state' | 'province' | 'prefecture';
export type GeoEntityType = 'continent' | 'country' | RegionTypeCode | LocalityTypeCode;

export interface LocalitySearchResult {
  type: GeoEntityType;
  id: string;
  name: string;
  locality_type_code?: LocalityTypeCode;
  country_code: string;
  country_name?: string;
  region_name?: string;
  parent_locality_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  population?: number;
  display_hierarchy?: string;
  display_names?: Record<string, string>;
  description?: string;
}

export interface LocalitySelection {
  type: GeoEntityType;
  id: string;
  name: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  region?: string;
}
```

---

## ✅ COMPLIANCE VERIFICATION

### Coding Standards

| Standard | Status | Verification |
|----------|--------|--------------|
| NO raw fetch() | ✅ PASS | `grep -rn "await fetch\|fetch(" <files>` → No matches |
| NO hardcoded colors | ✅ PASS | `grep -rn "#[0-9a-fA-F]\{3,6\}" <files>` → No matches |
| NO TODO/FIXME/DEPRECATED | ✅ PASS | `grep -rn "TODO\|FIXME\|DEPRECATED" <files>` → No matches |
| Uses useApi() hook | ✅ PASS | All API calls via `useApi()` |
| Design tokens only | ✅ PASS | All colors use Tailwind tokens + dark mode variants |
| `'use client'` directive | ✅ PASS | Present in interactive components |
| Proper TypeScript types | ✅ PASS | NO `any` types used |

### Build & Type Check

```bash
cd web

# Type check
npm run type-check
# ✅ PASS - No errors

# Lint
npm run lint
# ✅ PASS - No errors in new files (only pre-existing warnings)

# Build
npm run build
# ✅ PASS - Build successful (29 routes)
```

---

## ⏸️ DEFERRED TO NEXT PHASE

### Page Updates

The story specifies updating these pages, but this is deferred pending:
1. Story 10.2 (Overture import) - Need real locality data for testing
2. UX analysis - Each page has unique selection workflows
3. Integration testing - Map preview, coverage logic, etc.

**Pages to update:**

1. **Home page** (`web/app/page.tsx`)
   - Current: Step-by-step selection (continent → country → region → city)
   - Story requirement: Replace with `<LocalityPicker mode="single" showQuickSelect />`
   - Issue: Home page UX is intentionally hierarchical, not unified search

2. **Coverage page** (`web/app/publisher/coverage/page.tsx`)
   - Story requirement: `<LocalityPicker mode="multi" showTypeFilters showQuickSelect />`
   - Needs: Integration with map preview, existing coverage management

3. **Algorithm preview pages**
   - Story requirement: Replace CitySelector with `<LocalityPicker mode="single" />`
   - Needs: Testing with algorithm preview functionality

### Old Component Deletion

Do NOT delete until all pages verified working:
- `web/components/shared/LocationSearch.tsx` (604 lines)
- `web/components/shared/CoverageSearchPanel.tsx` (538 lines)
- `web/components/publisher/CitySelector.tsx` (404 lines)

---

## 📊 METRICS

| Metric | Value |
|--------|-------|
| Lines of code created | ~1,168 |
| Files created | 4 |
| Functions/utilities | 8 |
| TypeScript types | 5 |
| Duplicate code eliminated | ~1,546 lines (deferred) |
| Build time | <2 min |
| Type check time | ~5s |

---

## 🎯 NEXT STEPS

### Immediate (Story 10.6)
1. Performance testing with real Overture data
2. Documentation updates

### Phase 2 (Post-10.2)
1. Test LocalityPicker with real locality data
2. Update home page (consider UX implications)
3. Update coverage page with thorough integration testing
4. Update algorithm preview pages
5. Verify all functionality works
6. Delete old components
7. Update story DoD to COMPLETED

---

## 🔍 DEPENDENCIES

**Blocking:**
- Story 10.2 (Overture import) - API must return locality_type_code and full hierarchy

**Blocked by this:**
- Story 10.6 (Performance & DoD) - Needs UI complete for end-to-end testing

---

## 📝 NOTES

### Why Home Page Not Updated

The home page has intentional step-by-step UX:
1. User selects continent
2. Countries load for that continent
3. User selects country
4. Regions load for that country
5. User selects region (optional)
6. Cities load for that region
7. User selects city

This differs from unified search where user types "brooklyn" and gets results immediately. Need product decision on which UX is preferred before migrating.

### Popular Localities

IDs in `POPULAR_LOCALITIES` are placeholders from old `geo_cities` table. These will need to be updated after Overture import (Story 10.2) with actual IDs from `geo_localities` table.

### API Endpoint

LocalityPicker expects `/localities/search` endpoint to return:
```json
{
  "results": [
    {
      "type": "city",
      "id": "123",
      "name": "Brooklyn",
      "locality_type_code": "neighborhood",
      "country_code": "US",
      "country_name": "United States",
      "region_name": "New York",
      "parent_locality_name": "New York City",
      "latitude": 40.6782,
      "longitude": -73.9442,
      "timezone": "America/New_York",
      "population": 2736074,
      "display_hierarchy": "New York City → NY → USA",
      "display_names": {
        "en": "Brooklyn",
        "he": "ברוקלין"
      }
    }
  ],
  "total": 1
}
```

This endpoint must be implemented in Story 10.4 (Backend Code Updates).

---

**Status:** Phase 1 Complete - Infrastructure Ready
**Next:** Story 10.2 (Import), then Phase 2 (Page Migrations)
