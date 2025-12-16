# Task 2.1: usePreviewToolbar Hook - Implementation Summary

## Overview

Created a custom React hook for managing preview toolbar state with per-page cookie storage, while sharing language globally via PreferencesContext.

## Files Created

### 1. `/web/lib/hooks/usePreviewToolbar.ts` (Main Hook)

**Purpose:** Manages preview state for locality, date, and language across different pages

**Key Features:**
- Per-page cookie storage for locality and date using unique storage keys
- Global language management via PreferencesContext integration
- Cross-tab synchronization using CustomEvent broadcasting
- TypeScript-first with full type safety
- 90-day cookie TTL for preview settings

**Cookie Naming Pattern:**
```
zmanim_preview_{storageKey}_locality_id
zmanim_preview_{storageKey}_locality_name
zmanim_preview_{storageKey}_date
```

**API Surface:**
```typescript
interface UsePreviewToolbarOptions {
  storageKey: string;
  restrictToCoverage?: boolean;
  publisherId?: number;
  isGlobalPublisher?: boolean;
}

interface PreviewToolbarState {
  localityId: number | null;
  localityName: string | null;
  setLocality: (id: number | null, name: string | null) => void;
  date: string; // ISO YYYY-MM-DD
  setDate: (date: string) => void;
  language: 'en' | 'he';
  setLanguage: (lang: 'en' | 'he') => void;
  hasLocation: boolean;
  isGlobal: boolean;
  isHebrew: boolean;
}
```

### 2. `/web/lib/hooks/__tests__/usePreviewToolbar.test.ts` (Unit Tests)

**Test Coverage:**
- ✅ Initialize with default values when no cookies exist
- ✅ Initialize from cookies when they exist
- ✅ Use different cookie keys for different storage keys
- ✅ Set locality and update cookies
- ✅ Set date and update cookies
- ✅ Clear locality when set to null
- ✅ Set isGlobal based on isGlobalPublisher option
- ✅ Set hasLocation when locality is set

**Test Results:** All 8 tests passing

### 3. `/web/lib/hooks/usePreviewToolbar.example.tsx` (Documentation)

**Examples Provided:**
1. Basic Usage (Publisher Algorithm Page)
2. Global Publisher (No Coverage Restriction)
3. Admin Registry (Always Global Search)
4. Multiple Instances on Same Page
5. Conditional API Calls Based on hasLocation
6. Cookie Naming Pattern Demonstration

### 4. `/web/lib/hooks/index.ts` (Updated)

**Export Added:**
```typescript
export {
  usePreviewToolbar,
  type UsePreviewToolbarOptions,
  type PreviewToolbarState,
} from './usePreviewToolbar';
```

## Technical Decisions

### 1. Cookie Storage Strategy

**Rationale:** Cookies provide:
- SSR compatibility (accessible server-side)
- Persistence across sessions
- Cross-tab synchronization capability
- Consistent with existing PreferencesContext pattern

**Implementation:**
- Uses `js-cookie` library (already available via @clerk/nextjs)
- 90-day TTL for preview settings
- Secure flag in production
- SameSite=Lax for CSRF protection

### 2. Global Language Integration

**Rationale:**
- Language affects multiple aspects (date format, zman names, descriptions)
- Should be consistent across all pages
- Already managed by PreferencesContext

**Implementation:**
- Hook delegates to `setLanguage` from PreferencesContext
- No duplication of language state
- Automatic synchronization across all components

### 3. Cross-Tab Sync

**Implementation:**
- Uses CustomEvent 'preview-toolbar-cookie-change' for broadcasting
- Each hook instance listens for events matching its cookie keys
- Immediate state update when cookies change in other tabs

### 4. Initialization Guard

**Problem:** React hooks can trigger setters before component is mounted
**Solution:** `isInitialized` flag prevents cookie writes during mount phase

### 5. Date Storage Format

**Decision:** Always store as Gregorian ISO format (YYYY-MM-DD)
**Rationale:**
- Consistent internal representation
- Easy to parse and validate
- Display format (Hebrew vs Gregorian) handled by UI components

## Usage Examples

### Algorithm Page (Regional Publisher)
```typescript
const {
  localityId,
  localityName,
  setLocality,
  date,
  setDate,
  language,
  setLanguage,
  hasLocation,
} = usePreviewToolbar({
  storageKey: 'algorithm',
  restrictToCoverage: true,
  publisherId: 123,
  isGlobalPublisher: false,
});
```

### Admin Registry (Global Search)
```typescript
const { localityId, date, setLocality, setDate } = usePreviewToolbar({
  storageKey: 'admin_registry',
  restrictToCoverage: false,
});
```

## Integration Points

### Required Imports
```typescript
import { usePreviewToolbar } from '@/lib/hooks';
// or
import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';
```

### Dependencies
- `js-cookie` - Cookie management (via @clerk/nextjs)
- `@/lib/contexts/PreferencesContext` - Global language state

### Environment Requirements
- Client-side only (uses `'use client'` directive)
- Requires PreferencesProvider in component tree

## Next Steps

### Task 2.2: Create Sub-Components
1. LocalityPicker with coverage restriction
2. DatePicker with Gregorian/Hebrew support
3. CoverageIndicator popover
4. LanguageToggle button

### Task 2.3: Create PreviewToolbar Component
1. Compose sub-components
2. Integrate usePreviewToolbar hook
3. Handle all page configurations

### Task 2.4: Page Integration
1. Publisher Algorithm - replace custom controls
2. Publisher Registry - add toolbar
3. Publisher Primitives - replace custom controls
4. Admin Registry - add toolbar

## Acceptance Criteria Status

- ✅ Hook exports from `web/lib/hooks/usePreviewToolbar.ts`
- ✅ Locality/date stored in per-page cookies with correct naming pattern
- ✅ Language reads/writes from PreferencesContext (global)
- ✅ Cookie values persist across page refresh
- ✅ Default date is today's ISO string
- ✅ `hasLocation` is true when localityId is not null
- ✅ TypeScript types are exported for reuse
- ✅ Unit tests pass (8/8)
- ✅ Cross-tab synchronization implemented
- ✅ Example usage documented

## Performance Characteristics

- **Cookie reads:** 3 per mount (locality_id, locality_name, date)
- **Cookie writes:** 2-3 per state change (depending on operation)
- **Memory footprint:** Minimal (state is delegated to cookies)
- **Re-render triggers:** Only on state changes (via setState)

## Security Considerations

- ✅ Cookies are HttpOnly-safe (client-side only, no sensitive data)
- ✅ Secure flag enabled in production
- ✅ SameSite=Lax for CSRF protection
- ✅ No user input stored without validation
- ✅ Cookie TTL limits exposure window

## Known Limitations

1. **SSR Hydration:** Initial state may flash if cookies aren't available during SSR
   - **Mitigation:** Use `isLoading` from PreferencesContext if needed

2. **Browser Limit:** Browsers limit cookies to ~4KB per domain
   - **Impact:** Minimal - preview cookies are small (~100 bytes each)

3. **Cross-Domain:** Cookies don't sync across different domains
   - **Impact:** None - single-domain application

## Maintenance Notes

- Cookie keys are namespaced by storage key to prevent conflicts
- Future storage keys must follow pattern: `zmanim_preview_{key}_*`
- Language storage remains in PreferencesContext (global)
- Event names should remain consistent: 'preview-toolbar-cookie-change'
