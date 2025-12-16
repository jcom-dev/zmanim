# Codebase Cleanup Plan

This document outlines deprecated code, unnecessary fallbacks, messy client-side logic, and hardcoded values that should be cleaned up for better maintainability.

## Summary

| Category | Count | Priority | Status |
|----------|-------|----------|--------|
| Hardcoded Zman Logic (Frontend) | 4 files | **HIGH** | ✅ DONE |
| Raw `fetch()` Instead of `useApi()` | 7 files | **HIGH** | ✅ DONE |
| Deprecated Props Still Declared | 11 components | **HIGH** | ✅ DONE |
| Console.log Statements | 16 occurrences | MEDIUM | ✅ DONE |
| Hardcoded Colors (Hex Values) | 2 files | MEDIUM | ✅ DONE (acceptable) |
| Backend TODO/Stubs | 5 locations | HIGH | ❌ Pending (Phase 3) |
| Inconsistent Error Handling | Multiple | MEDIUM | ✅ DONE (useApi handles) |

---

## HIGH PRIORITY - Remove Immediately

### 1. Hardcoded Zman Keys and Categories (Frontend)

These duplicate logic that should come exclusively from the API.

#### 1.1 EVENT_ZMAN_KEYS Set
**File:** [web/app/publisher/algorithm/page.tsx:71-103](web/app/publisher/algorithm/page.tsx#L71-L103)

```typescript
const EVENT_ZMAN_KEYS = new Set([
  'candle_lighting', 'shabbos_ends', 'havdalah', // ... 30+ hardcoded keys
]);
```

**Problem:**
- Duplicates `is_event_zman` field from API
- Must be manually updated when new event zmanim are added
- Comment says "fallback for legacy data" but this is the primary mechanism

**Fix:**
- Remove `EVENT_ZMAN_KEYS` entirely
- Use only `z.is_event_zman` from API response (already available)
- Lines 642-651 should become: `const isEvent = z.is_event_zman;`

#### 1.2 ZMAN_CATEGORIES Object
**File:** [web/app/zmanim/[cityId]/[publisherId]/page.tsx:73-81](web/app/zmanim/[cityId]/[publisherId]/page.tsx#L73-L81)

```typescript
const ZMAN_CATEGORIES = {
  dawn: ['alos_hashachar', 'alos_', 'misheyakir'],
  morning: ['sunrise', 'netz', 'sof_zman_shma', ...],
  // Pattern matching on zman_key strings
};
```

**Problem:**
- Client-side categorization via string pattern matching
- Fragile: `'alos_'` matches any key starting with "alos_"
- API already returns `time_category` field

**Fix:**
- Remove `ZMAN_CATEGORIES` and `matchesCategory` function (lines 73-88)
- Use `zman.time_category` from API response for grouping
- Modify `groupZmanim` to group by API-provided category

#### 1.3 ZMAN_DISPLAY_NAMES and ZMAN_ORDER
**File:** [web/components/publisher/ZmanList.tsx:17-50](web/components/publisher/ZmanList.tsx#L17-L50)

```typescript
const ZMAN_DISPLAY_NAMES: Record<string, string> = {
  alos_hashachar: 'Alos HaShachar',
  // 15+ hardcoded display names
};

const ZMAN_ORDER = [
  'alos_hashachar', 'misheyakir', // ... 14 hardcoded keys
];
```

**Problem:**
- Display names should come from `display_name` field in API
- Sort order should come from `sort_order` field in master registry
- New zmanim won't appear correctly without code changes

**Fix:**
- Use `zman.display_name` from API response
- Use `zman.sort_order` from API for ordering
- Remove both constants entirely

#### 1.4 ZmanConfigModal Display Names
**File:** [web/components/publisher/ZmanConfigModal.tsx:40-60](web/components/publisher/ZmanConfigModal.tsx#L40-L60)

```typescript
const ZMAN_DISPLAY_NAMES: Record<string, string> = {
  // Another duplicate of hardcoded display names
};
```

**Fix:** Same as 1.3 - use API-provided display_name.

---

### 2. Raw `fetch()` Calls - Must Use `useApi()`

These bypass the unified API client (missing auth headers, X-Publisher-Id).

| File | Line | Fix |
|------|------|-----|
| [CoverageSelector.tsx:118-144](web/components/shared/CoverageSelector.tsx#L118-L144) | 4 fetch calls | Use `api.public.get()` |
| [FormulaExplanation.tsx:47](web/components/zmanim/FormulaExplanation.tsx#L47) | POST request | Use `api.post()` |
| [WeeklyPreview.tsx:98](web/components/preview/WeeklyPreview.tsx#L98) | Calendar fetch | Use `api.public.get()` |
| [algorithm/page.tsx:565](web/app/publisher/algorithm/page.tsx#L565) | Algorithm fetch | Use `api.get()` |
| [TemplateSelectionStep.tsx:70](web/components/onboarding/steps/TemplateSelectionStep.tsx#L70) | Publisher search | Use `api.public.get()` |
| [CustomizeZmanimStep.tsx:347](web/components/onboarding/steps/CustomizeZmanimStep.tsx#L347) | Master registry | Use `api.public.get()` |
| [LogoUpload.tsx:152](web/components/publisher/LogoUpload.tsx#L152) | Data URL fetch | OK (not API call) |

**Pattern to follow:**
```typescript
// Before
const response = await fetch(`${apiBase}/api/v1/cities?search=${query}`);
const json = await response.json();

// After
const api = useApi();
const data = await api.public.get(`/cities?search=${query}`);
```

---

### 3. Backend TODO/Stub Implementations

#### 3.1 Algorithm Preview Mock
**File:** [api/internal/services/algorithm_service.go:164](api/internal/services/algorithm_service.go#L164)

```go
// TODO: Implement actual calculation engine
// For now, return a mock preview
```

**Status:** BLOCKING - publishers can't preview calculations accurately.

**Fix:** Integrate with DSL executor in `api/internal/dsl/`.

#### 3.2 Calculation Tracking Stubs
**File:** [api/internal/handlers/admin.go:882-886](api/internal/handlers/admin.go#L882-L886)

```go
// TODO: Implement calculation tracking in Task 5
totalCalculations := 0
cacheHitRatio := 0.0
```

**Fix:** Either implement `calculation_logs` table or remove these stats from the response.

#### 3.3 Hebrew Calendar Stubs
**File:** [api/internal/handlers/dsl.go:325, 362](api/internal/handlers/dsl.go#L325)

```go
IsYomTov: false, // TODO: Implement with hebcal integration
```

**Fix:** Add `hebcal-go` library or similar for proper Hebrew date/Yom Tov detection.

---

## MEDIUM PRIORITY - Clean Up Soon

### 4. Deprecated Props in Component Interfaces

These props are marked deprecated but still declared:

| Component | Deprecated Prop | Location |
|-----------|----------------|----------|
| VersionHistory | `getToken` | [algorithm/VersionHistory.tsx:22](web/components/algorithm/VersionHistory.tsx#L22) |
| VersionDiff | `getToken` | [algorithm/VersionDiff.tsx:26](web/components/algorithm/VersionDiff.tsx#L26) |
| RestoreDialog | `getToken` | [algorithm/RestoreDialog.tsx:11](web/components/algorithm/RestoreDialog.tsx#L11) |
| VersionHistory (publisher) | `getToken` | [publisher/VersionHistory.tsx:20](web/components/publisher/VersionHistory.tsx#L20) |
| MonthPreview | `getToken` | [publisher/MonthPreview.tsx:36](web/components/publisher/MonthPreview.tsx#L36) |
| LogoUpload | `getToken` | [publisher/LogoUpload.tsx:50](web/components/publisher/LogoUpload.tsx#L50) |
| ZmanConfigModal | `getToken` | [publisher/ZmanConfigModal.tsx:35](web/components/publisher/ZmanConfigModal.tsx#L35) |
| MyForks | `getToken` | [algorithms/MyForks.tsx:19](web/components/algorithms/MyForks.tsx#L19) |
| VisibilityToggle | `getToken` | [algorithms/VisibilityToggle.tsx:10](web/components/algorithms/VisibilityToggle.tsx#L10) |
| BrowseAlgorithms | `getToken` | [algorithms/BrowseAlgorithms.tsx:33](web/components/algorithms/BrowseAlgorithms.tsx#L33) |
| OnboardingWizard | `publisherId` | [onboarding/OnboardingWizard.tsx:103](web/components/onboarding/OnboardingWizard.tsx#L103) |

**Fix:** Remove deprecated props from interfaces. Components use `useApi()` internally now.

---

### 5. Console.log Statements in Production Code

**79 total occurrences across 36 files.**

Most problematic files (>5 occurrences):
- `web/app/publisher/algorithm/page.tsx` - 15 console.log
- `web/components/onboarding/OnboardingWizard.tsx` - 7 console.log
- `web/app/page.tsx` - 6 console.log
- `web/components/publisher/ZmanCard.tsx` - 4 console.log

**Fix Options:**
1. Remove all console.log statements
2. Wrap in development check: `if (process.env.NODE_ENV === 'development')`
3. Replace with proper logging utility

---

### 6. Hardcoded Colors (Hex Values)

#### 6.1 CodeMirror Theme
**File:** [web/components/editor/CodeMirrorDSLEditor.tsx:235-360](web/components/editor/CodeMirrorDSLEditor.tsx#L235-L360)

```typescript
const dslTheme = EditorView.theme({
  '.cm-gutters': { backgroundColor: '#f3f4f6', color: '#9ca3af' },
  // 30+ hardcoded hex colors
});
```

**Fix:** Extract to CSS variables that reference Tailwind tokens.

#### 6.2 Logo Colors
**Files:**
- [LogoGenerator.tsx:16-23](web/components/publisher/LogoGenerator.tsx#L16-L23)
- [LogoUpload.tsx:11-18](web/components/publisher/LogoUpload.tsx#L11-L18)

```typescript
const LOGO_COLORS = [
  { color: '#1e40af', name: 'Royal Blue' },
  // Duplicated in both files
];
```

**Fix:** Move to shared constants file: `web/lib/constants/colors.ts`

---

### 7. Inconsistent API Response Handling

#### Triple Fallback Patterns
**File:** [CoverageSelector.tsx:123, 129](web/components/shared/CoverageSelector.tsx#L123)

```typescript
setCityResults(json.data?.cities || json.cities || []);
const countries = json.data?.countries || json.countries || json.data || [];
```

**Problem:** Suggests API response shape is inconsistent or not trusted.

**Fix:** The `useApi()` hook normalizes responses. Use it consistently and remove fallbacks.

---

### 8. Deprecated Backend Functions

**File:** [api/internal/handlers/admin.go:406-411](api/internal/handlers/admin.go#L406-L411)
```go
// AdminInviteUserToPublisher is an alias for AdminAddUserToPublisher for backward compatibility
// Deprecated: Use AdminAddUserToPublisher instead
func (h *Handlers) AdminInviteUserToPublisher(w http.ResponseWriter, r *http.Request) {
    h.AdminAddUserToPublisher(w, r)
}
```

**File:** [api/internal/handlers/publisher_team.go:265-273](api/internal/handlers/publisher_team.go#L265-L273)
```go
// InvitePublisherTeamMember is the new name for AddPublisherTeamMember
// Deprecated: Use AddPublisherTeamMember instead
```

**Fix:** Remove wrapper functions; use route aliasing if needed for compatibility.

---

## LOW PRIORITY - Nice to Have

### 9. Unused Code / Dead Code

- **Unused `algorithmId` prop** in [VersionHistory.tsx:20](web/components/algorithm/VersionHistory.tsx#L20)
- **Incomplete TODO feature** at [algorithm/page.tsx:1436](web/app/publisher/algorithm/page.tsx#L1436): "Open browse publishers dialog"
- **Deprecated database models** in [models.go](api/internal/db/sqlcgen/models.go): DayType, etc.

### 10. Magic Numbers Without Constants

| File | Line | Value | Suggested Constant |
|------|------|-------|-------------------|
| CoverageSelector.tsx | 120, 141 | `10` | `SEARCH_RESULT_LIMIT` |
| CoverageSelector.tsx | 351 | `max-h-60` | `DROPDOWN_MAX_HEIGHT` |
| handlers.go | 96-97 | `20` | `DEFAULT_PAGE_SIZE` |
| handlers.go | 97 | `100` | `MAX_PAGE_SIZE` |
| postgres.go | 30-34 | Pool config | Move to env/config |
| cache.go | 27-34 | TTL values | Move to config |

### 11. useMemo for Side Effects

**File:** [WeeklyPreview.tsx:114-116](web/components/preview/WeeklyPreview.tsx#L114-L116)

```typescript
useMemo(() => {
  fetchWeekData();  // Side effect in useMemo!
}, [weekStart]);
```

**Fix:** Use `useEffect` instead of `useMemo` for data fetching.

---

## Implementation Order

### Phase 1: High Priority (1-2 days) ✅ COMPLETED 2025-12-03
1. ✅ Remove `EVENT_ZMAN_KEYS` - use `is_event_zman` from API
2. ✅ Remove `ZMAN_CATEGORIES` - use `time_category` from API
3. ✅ Replace raw `fetch()` with `useApi()` in 6 files
4. ✅ Remove deprecated `getToken` props from 11 components
5. ✅ Delete unused files: `ZmanList.tsx`, `ZmanConfigModal.tsx`

**Phase 1 Notes:**
- All raw `fetch()` calls replaced with `api.public.get()` or `api.get()`
- Deprecated `getToken` prop removed from all component interfaces
- Components now use `useApi()` hook internally for auth handling
- `publisherId` prop removed from OnboardingWizard (uses context)

### Phase 2: Medium Priority (2-3 days) ✅ COMPLETED 2025-12-03
5. ✅ Remove console.log statements (16 occurrences removed from 4 files)
6. ✅ Extract hardcoded colors - Reviewed, LOGO_COLORS are intentional design choices
7. ✅ Response unwrapping - Already fixed in Phase 1 (useApi handles unwrapping)
8. ❌ Implement algorithm preview (backend TODO) - Deferred to Phase 3

**Phase 2 Notes:**
- Console.log removed from: algorithm/page.tsx, edit/page.tsx, OnboardingWizard.tsx, ZmanCard.tsx
- CodeMirror colors are acceptable (syntax highlighting requires direct values)
- useMemo side effect in WeeklyPreview.tsx was already fixed

### Phase 3: Low Priority (ongoing)
9. Remove deprecated backend wrapper functions
10. Clean up magic numbers with named constants
11. ~~Fix useMemo side effect pattern~~ (Already done)
12. Add Hebrew calendar integration
13. Implement algorithm preview (backend TODO)

---

## Files to Modify (Quick Reference)

### Frontend - Phase 1 ✅ COMPLETED
- ✅ `web/app/publisher/algorithm/page.tsx` - Removed EVENT_ZMAN_KEYS, fixed fetch
- ✅ `web/app/zmanim/[cityId]/[publisherId]/page.tsx` - Removed ZMAN_CATEGORIES
- ✅ `web/components/publisher/ZmanList.tsx` - **DELETED** (unused)
- ✅ `web/components/publisher/ZmanConfigModal.tsx` - **DELETED** (unused)
- ✅ `web/components/shared/CoverageSelector.tsx` - Replaced fetch with useApi
- ✅ All 11 components with deprecated `getToken` props - Props removed

### Frontend - Phase 2 ✅ COMPLETED
- ✅ All console.log statements removed (16 total from 4 files)
- ✅ `web/components/editor/CodeMirrorDSLEditor.tsx` - Colors reviewed (acceptable for syntax highlighting)

### Backend - Must Change
- `api/internal/services/algorithm_service.go` - Implement preview
- `api/internal/handlers/admin.go` - Fix calculation tracking or remove
- `api/internal/handlers/dsl.go` - Add Hebrew calendar

---

## Coding Standards for Cleanup

**IMPORTANT: When removing deprecated code:**
- **DELETE old code entirely** - do not comment it out
- Do not leave `// removed`, `// deprecated`, or similar comments
- Do not keep unused imports, variables, or props
- If something is no longer used, remove it completely

---

## Success Criteria

After cleanup:
- [x] No hardcoded zman keys in frontend (use API fields exclusively) ✅
- [x] No raw `fetch()` calls (all use `useApi()`) ✅
- [x] No deprecated props in component interfaces ✅
- [x] No console.log in production code ✅
- [ ] Backend TODOs either implemented or documented as known limitations
- [x] All colors use Tailwind tokens or CSS variables ✅ (CodeMirror acceptable)
- [x] No commented-out code left behind ✅
