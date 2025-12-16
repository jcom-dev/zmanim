# Story 10.5: Frontend LocalityPicker Unification

**Story ID:** 10.5
**Epic:** Epic 10 - Overture Geographic Data Migration
**Points:** 10
**Priority:** HIGH - UI/UX unification
**Risk:** Medium

---

## User Story

**As a** user
**I want** a consistent location search experience across the application
**So that** I can find localities quickly regardless of where I'm searching

---

## Background

Currently there are **3 separate components** with significant code duplication:
- `LocationSearch.tsx` (604 lines) - General search, single-select
- `CoverageSearchPanel.tsx` (538 lines) - Coverage multi-select + filters
- `CitySelector.tsx` (404 lines) - Step-by-step selection

**Duplicated code:**
- `getTypeIcon()` - defined 3x
- `getTypeBadgeColor()` - defined 3x
- `buildHierarchyDescription()` - defined 2x
- Search logic, debounce, keyboard navigation

This story creates a **unified `LocalityPicker`** component.

---

## Acceptance Criteria

### AC1: Shared Utilities Created - locality-display.ts
- [ ] File created: `web/lib/locality-display.ts`
- [ ] Exports `getEntityIcon(type, className)` function
- [ ] Exports `getEntityBadgeColor(type)` function
- [ ] Exports `getEntityLabel(type)` function
- [ ] Exports `buildHierarchyDisplay(locality, options)` function
- [ ] Exports `buildResponsiveHierarchy(locality)` function
- [ ] Exports `POPULAR_LOCALITIES` constant
- [ ] All functions use design tokens (no hardcoded colors per coding-standards.md)

**Verification:**
```bash
# Check file exists
ls -la web/lib/locality-display.ts

# Check exports
grep "export function\|export const" web/lib/locality-display.ts
# Expected: 6+ exports

# Check for hardcoded colors
grep -E "#[0-9a-fA-F]{3,6}" web/lib/locality-display.ts
# Expected: No matches (use design tokens)
```

### AC2: Search Hook Created - useLocalitySearch.ts
- [ ] File created: `web/lib/hooks/useLocalitySearch.ts`
- [ ] Uses `useApi()` hook (no raw fetch per coding-standards.md)
- [ ] Supports debounce (default 300ms)
- [ ] Supports type filtering
- [ ] Supports country/region filtering
- [ ] Supports exclude list
- [ ] Handles abort on unmount/new search
- [ ] Returns `{ results, isLoading, error, search, clear }`

**Verification:**
```bash
# Check file exists
ls -la web/lib/hooks/useLocalitySearch.ts

# Check uses useApi
grep "useApi" web/lib/hooks/useLocalitySearch.ts
# Expected: Match found

# Check NO raw fetch
grep "await fetch\|fetch(" web/lib/hooks/useLocalitySearch.ts
# Expected: No matches
```

### AC3: LocalityPicker Component Created
- [ ] File created: `web/components/shared/LocalityPicker.tsx`
- [ ] Uses `'use client'` directive
- [ ] Uses `useLocalitySearch` hook
- [ ] Uses shared utilities from `locality-display.ts`
- [ ] Supports `mode: 'single' | 'multi'`
- [ ] Supports `variant: 'inline' | 'dropdown' | 'compact'`
- [ ] Full keyboard navigation (Arrow keys, Enter, Escape)
- [ ] ARIA attributes for accessibility
- [ ] Uses design tokens only (no hardcoded colors)

**Verification:**
```bash
# Check file exists
ls -la web/components/shared/LocalityPicker.tsx

# Check client directive
head -5 web/components/shared/LocalityPicker.tsx
# Expected: 'use client'

# Check for hardcoded colors
grep -E "#[0-9a-fA-F]{3,6}\|rgb\|rgba" web/components/shared/LocalityPicker.tsx
# Expected: No matches
```

### AC4: Single-Select Mode Works
- [ ] User can search for locality
- [ ] Results appear with hierarchy (Brooklyn → NYC → NY → USA)
- [ ] Clicking result calls `onSelect` with selection
- [ ] Input clears after selection
- [ ] Keyboard navigation works

**Verification:**
```typescript
// Test usage
<LocalityPicker
  mode="single"
  onSelect={(selection) => console.log(selection)}
  placeholder="Search for a city..."
/>
// Expected: Works like current LocationSearch
```

### AC5: Multi-Select Mode Works
- [ ] User can search and select multiple localities
- [ ] Selected items appear as chips
- [ ] Can remove individual selections
- [ ] "Clear all" button works
- [ ] "Add X Localities" confirmation button
- [ ] Excluded items don't appear in search

**Verification:**
```typescript
// Test usage
<LocalityPicker
  mode="multi"
  onSelect={(selections) => console.log(selections)}
  exclude={existingCoverage}
  showTypeFilters
/>
// Expected: Works like current CoverageSearchPanel
```

### AC6: Type Filters Work
- [ ] `showTypeFilters` prop shows filter tabs
- [ ] Tabs: All, Cities, Towns, Villages, Neighborhoods
- [ ] Filtering updates search results
- [ ] Filter state managed internally

**Verification:**
```typescript
<LocalityPicker
  mode="multi"
  showTypeFilters
  onSelect={handleSelect}
/>
// Expected: Shows filter tabs, clicking filters results
```

### AC7: Quick Select Works
- [ ] `showQuickSelect` prop shows popular localities
- [ ] Popular localities: Jerusalem, New York, Los Angeles, London, Tel Aviv, Miami
- [ ] Clicking quick select calls onSelect
- [ ] Already-selected items shown as disabled

**Verification:**
```typescript
<LocalityPicker
  mode="single"
  showQuickSelect
  onSelect={handleSelect}
/>
// Expected: Shows popular cities when search empty
```

### AC8: Responsive Hierarchy Display
- [ ] Mobile (<640px): Minimal format "Brooklyn, US"
- [ ] Tablet (640-1024px): Medium format "Brooklyn → NYC → US"
- [ ] Desktop (>1024px): Full format "Brooklyn (Neighborhood) → NYC → NY → USA"
- [ ] Uses Tailwind responsive classes

**Verification:**
```bash
# Check responsive classes
grep "sm:hidden\|lg:hidden\|hidden sm:inline\|hidden lg:inline" web/components/shared/LocalityPicker.tsx
# Expected: Matches found (responsive display)
```

### AC9: Home Page Updated
- [ ] `app/page.tsx` uses `LocalityPicker` instead of inline search
- [ ] Same functionality maintained
- [ ] No inline fetch calls removed

**Verification:**
```bash
# Check home page uses LocalityPicker
grep "LocalityPicker" web/app/page.tsx
# Expected: Match found

# Check NO raw fetch
grep "await fetch" web/app/page.tsx
# Expected: No matches
```

### AC10: Coverage Page Updated
- [ ] Coverage management uses `LocalityPicker mode="multi"`
- [ ] Type filters enabled
- [ ] Map preview integration maintained
- [ ] `CoverageSearchPanel.tsx` no longer used

**Verification:**
```bash
# Check coverage page
grep "LocalityPicker" web/app/publisher/coverage/page.tsx
# Expected: Match found

grep "CoverageSearchPanel" web/app/publisher/coverage/page.tsx
# Expected: No matches
```

### AC11: Algorithm Preview Updated
- [ ] Algorithm preview uses `LocalityPicker mode="single"`
- [ ] Current functionality maintained

**Verification:**
```bash
# Check algorithm pages use LocalityPicker
grep -r "LocalityPicker" web/app/publisher/algorithm/
# Expected: Matches found
```

### AC12: Old Components Deleted
- [ ] `web/components/shared/LocationSearch.tsx` DELETED
- [ ] `web/components/shared/CoverageSearchPanel.tsx` DELETED
- [ ] `web/components/publisher/CitySelector.tsx` DELETED
- [ ] No imports of deleted components remain

**Verification:**
```bash
# Check files deleted
ls web/components/shared/LocationSearch.tsx 2>/dev/null
ls web/components/shared/CoverageSearchPanel.tsx 2>/dev/null
ls web/components/publisher/CitySelector.tsx 2>/dev/null
# Expected: All "No such file"

# Check no remaining imports
grep -r "LocationSearch\|CoverageSearchPanel\|CitySelector" web/app web/components --include="*.tsx"
# Expected: No matches (or only LocalityPicker itself)
```

### AC13: TypeScript Types Updated
- [ ] `web/types/geography.ts` includes `LocalitySearchResult` type
- [ ] `web/types/geography.ts` includes `LocalityTypeCode` type
- [ ] `web/types/geography.ts` includes `LocalitySelection` type
- [ ] All components use proper types (no `any`)

**Verification:**
```bash
# Check types exist
grep "LocalitySearchResult\|LocalityTypeCode\|LocalitySelection" web/types/geography.ts
# Expected: Matches found

# Check no 'any' in LocalityPicker
grep ": any" web/components/shared/LocalityPicker.tsx
# Expected: No matches (or minimal justified cases)
```

### AC14: Coding Standards Compliance
- [ ] No raw `fetch()` calls (use `useApi()`)
- [ ] No hardcoded colors (use design tokens)
- [ ] No TODO/FIXME/DEPRECATED markers
- [ ] Uses `useApi()` for all API calls
- [ ] 12-hour time format where applicable
- [ ] Clerk `isLoaded` checked before access (if used)

**Verification:**
```bash
# Run compliance checks on new files
grep -E "await fetch\(|#[0-9a-fA-F]{3,6}|TODO|FIXME|DEPRECATED" \
  web/lib/locality-display.ts \
  web/lib/hooks/useLocalitySearch.ts \
  web/components/shared/LocalityPicker.tsx
# Expected: No matches
```

### AC15: Build and Type Check Pass
- [ ] `cd web && npm run type-check` passes
- [ ] `cd web && npm run build` passes
- [ ] `cd web && npm run lint` passes

**Verification:**
```bash
cd web
npm run type-check
npm run build
npm run lint
# Expected: All pass
```

---

## Technical Implementation

### File Structure
```
web/
├── lib/
│   ├── locality-display.ts          # NEW: Shared display utilities
│   └── hooks/
│       └── useLocalitySearch.ts     # NEW: Search hook
├── components/
│   └── shared/
│       └── LocalityPicker.tsx       # NEW: Unified component
└── types/
    └── geography.ts                  # UPDATED: New types
```

### Component API
```typescript
interface LocalityPickerProps {
  mode?: 'single' | 'multi';
  variant?: 'inline' | 'dropdown' | 'compact';
  placeholder?: string;
  onSelect: (selection: LocalitySelection | LocalitySelection[]) => void;
  onHighlight?: (item: LocalitySelection | null) => void;
  exclude?: LocalitySelection[];
  types?: GeoEntityType[];
  countryId?: number;
  regionId?: number;
  publisherId?: string;
  showQuickSelect?: boolean;
  showTypeFilters?: boolean;
  autoFocus?: boolean;
  className?: string;
}
```

### Migration Mapping

| Old Component | New Usage |
|---------------|-----------|
| `LocationSearch` | `<LocalityPicker mode="single" />` |
| `CoverageSearchPanel` | `<LocalityPicker mode="multi" showTypeFilters showQuickSelect />` |
| `CitySelector` | `<LocalityPicker mode="single" />` |

---

## Definition of Done

### Code Complete
- [ ] `locality-display.ts` created with all utilities
- [ ] `useLocalitySearch.ts` hook created
- [ ] `LocalityPicker.tsx` component created
- [ ] Home page updated
- [ ] Coverage page updated
- [ ] Algorithm preview updated
- [ ] Old components DELETED

### Coding Standards Compliance (MANDATORY)
- [ ] `useApi()` used for all API calls (no raw fetch)
- [ ] Design tokens only (no hardcoded colors)
- [ ] No TODO/FIXME/DEPRECATED markers
- [ ] Proper TypeScript types (no `any`)
- [ ] `'use client'` directive where needed
- [ ] `isLoaded` check for Clerk (if used)

### Tests Pass
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Manual testing: single-select works
- [ ] Manual testing: multi-select works
- [ ] Manual testing: keyboard navigation works
- [ ] E2E tests pass

### Components Deleted
- [ ] `LocationSearch.tsx` - DELETED
- [ ] `CoverageSearchPanel.tsx` - DELETED
- [ ] `CitySelector.tsx` - DELETED
- [ ] No orphan imports remain

### Commit Requirements
- [ ] Commit message: `feat(ui): unify location search into LocalityPicker component`
- [ ] Push to remote after commit

---

## Out of Scope

- Backend API changes (done in Story 10.4)
- New features beyond current functionality
- Internationalization (i18n) of UI labels

---

## Dependencies

- Story 10.4 (Backend Code Updates) - API must return locality_type_code

## Blocks

- Story 10.6 (Performance & DoD - needs UI complete)

---

## Estimated Effort

| Task | Hours |
|------|-------|
| locality-display.ts | 2 |
| useLocalitySearch.ts | 3 |
| LocalityPicker.tsx | 6 |
| Home page update | 1 |
| Coverage page update | 2 |
| Algorithm preview update | 1 |
| Delete old components | 1 |
| Type updates | 1 |
| Testing | 3 |
| Documentation | 1 |
| **Total** | **21** |

---

## Notes

- Test on mobile viewport for responsive hierarchy
- Verify keyboard navigation with screen reader
- Consider adding Storybook story for component documentation
