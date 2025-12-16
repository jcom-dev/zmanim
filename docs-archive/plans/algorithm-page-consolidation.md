# Algorithm Page Data Consolidation Plan

**Status:** Ready for Implementation
**Priority:** High
**Estimated Complexity:** Medium

---

## Problem Statement

The algorithm page (`web/app/publisher/algorithm/page.tsx`) currently has fragmented data fetching with **three separate query streams** for what is essentially the same data:

1. **Metadata stream** - `useZmanimList()` without params (raw metadata only)
2. **Single-day calculation stream** - `useZmanimList({date, lat, lon})` in AlgorithmPreview (independent query)
3. **Week calculation stream** - `GET /publisher/zmanim/week` in WeekPreview (completely separate endpoint, no caching)

This creates:
- Redundant API calls
- Duplicate calculation logic
- Complex state management across components
- Unnecessary client-side complexity

Additionally, the page renders even when there's no coverage/locality, which makes no sense for a preview-focused page.

---

## Target Architecture

### Core Principle: Single Fetch, Multiple Uses

```
Algorithm Page Load
    │
    ├── Check: Does publisher have coverage?
    │   ├── NO  → Render placeholder ("Add coverage first")
    │   └── YES → Continue with locality_id
    │
    └── Single API Call: GET /publisher/zmanim?locality_id=X&date=Y
        │
        └── Response: {
              day_context: { holidays, shabbat, hebrew_date, ... },
              zmanim: [ { ...metadata, calculated_time, display_order } ]
            }
            │
            ├── Used by: ZmanGrid (cards with formulas + times)
            ├── Used by: AlgorithmPreview (right-side preview)
            └── Used by: WeekPreview (uses same data structure, fetches week range)
```

### Key Changes

1. **Page requires locality_id** - No locality = placeholder only
2. **Single `useAlgorithmData()` hook** - Fetches once, provides to all consumers
3. **Zmanim arrive pre-sorted** - Server returns correct display_order
4. **Remove client-side ordering logic** - Trust server ordering
5. **Consolidate preview components** - Share data, don't re-fetch

---

## Implementation Tasks

### Phase 1: Backend - Unified Response

#### Task 1.1: Enhance `/publisher/zmanim` Endpoint
**File:** `api/internal/handlers/publisher_zmanim.go`

- [ ] Add `locality_id` query parameter (required for calculations)
- [ ] When `locality_id` provided, include calculated times in response
- [ ] Ensure zmanim returned in correct `display_order`
- [ ] Include `day_context` (holidays, shabbat, hebrew_date) in response

**Validation:**
```bash
# Should return zmanim with calculated times and day context
source api/.env && TOKEN=$(node scripts/get-test-token.js 2>&1 | grep "^ey")
curl -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=123&date=2024-01-15"
```

**Definition of Done:**
- Response includes `day_context` object
- All zmanim have `calculated_time` field when locality_id provided
- Zmanim sorted by `display_order` server-side
- No breaking changes to existing response structure (additive only)

#### Task 1.2: Deprecate Week Endpoint (or keep as optimization)
**File:** `api/internal/handlers/publisher_zmanim.go`

- [ ] Evaluate: Is `/publisher/zmanim/week` still needed?
- [ ] If kept, ensure it uses same response structure as main endpoint
- [ ] If removed, delete handler and route

**Validation:**
- Confirm WeekPreview can work with main endpoint + date range param

---

### Phase 2: Frontend - Unified Hook

#### Task 2.1: Create `useAlgorithmPageData()` Hook
**File:** `web/lib/hooks/useAlgorithmPageData.ts` (new file)

```typescript
interface AlgorithmPageData {
  // From coverage check
  hasCoverage: boolean;
  localityId: string | null;
  localityName: string;
  coordinates: { lat: number; lon: number };

  // From zmanim fetch (only when hasCoverage)
  dayContext: DayContext | null;
  zmanim: PublisherZman[] | null;

  // State
  isLoading: boolean;
  error: Error | null;

  // Actions
  refetch: () => void;
  setPreviewDate: (date: string) => void;
}
```

- [ ] Hook checks coverage first
- [ ] If no coverage, returns early with `hasCoverage: false`
- [ ] If coverage exists, fetches zmanim with locality_id
- [ ] Single React Query call, shared across page
- [ ] Provides stable references (no unnecessary re-renders)

**Validation:**
```typescript
// In component:
const { hasCoverage, zmanim, dayContext, isLoading } = useAlgorithmPageData();

if (!hasCoverage) return <NoCoveragePlaceholder />;
if (isLoading) return <LoadingSpinner />;

// zmanim is ready for both grid and preview
```

**Definition of Done:**
- Hook handles coverage check internally
- Single API call when coverage exists
- Data shared between ZmanGrid and AlgorithmPreview
- No direct API calls in page.tsx or preview components

#### Task 2.2: Refactor Algorithm Page
**File:** `web/app/publisher/algorithm/page.tsx`

- [ ] Remove all direct `useZmanimList()` calls
- [ ] Remove `loadCoverage()` effect and state
- [ ] Replace with single `useAlgorithmPageData()` hook
- [ ] Render placeholder when `!hasCoverage`
- [ ] Pass data to ZmanGrid and AlgorithmPreview as props

**Validation:**
- Network tab shows only ONE `/publisher/zmanim` call per page load
- Changing date triggers one refetch, not multiple

**Definition of Done:**
- Page has single data source
- No client-side coverage loading logic
- No duplicate queries in network tab

#### Task 2.3: Refactor AlgorithmPreview
**File:** `web/components/publisher/AlgorithmPreview.tsx`

- [ ] Remove internal `useZmanimList()` call
- [ ] Accept `zmanim` and `dayContext` as props
- [ ] Purely presentational component (no data fetching)

**Validation:**
- Component renders correctly with prop data
- No network requests from this component

**Definition of Done:**
- Component is stateless regarding data fetching
- Displays holidays, shabbat status from props
- Displays zmanim times from props

#### Task 2.4: Refactor WeekPreview
**File:** `web/components/publisher/WeekPreview.tsx`

- [ ] Remove direct `api.get()` call
- [ ] Use React Query with proper caching
- [ ] Accept `localityId` and `baseDate` as props
- [ ] Optionally: Use same hook pattern as main page

**Validation:**
- Week data is cached (reopening dialog doesn't refetch)
- Uses consistent response structure

**Definition of Done:**
- No direct API calls (uses hook or React Query)
- Cached between dialog open/close
- Same data structure as main preview

---

### Phase 3: Cleanup

#### Task 3.1: Remove Dead Code
- [ ] Delete any unused hooks after consolidation
- [ ] Remove commented-out code
- [ ] Delete unused imports
- [ ] Remove backwards-compatibility shims

**Files to audit:**
- `web/lib/hooks/useZmanimList.ts` (may need modification or partial deletion)
- `web/app/publisher/algorithm/page.tsx` (remove dead state/effects)
- `web/components/publisher/AlgorithmPreview.tsx`
- `web/components/publisher/WeekPreview.tsx`

**Validation:**
```bash
cd web && npm run type-check  # No unused imports
cd web && npm run lint        # No dead code warnings
```

**Definition of Done:**
- No commented-out code
- No unused imports
- No backwards-compatibility comments
- Code is clean and minimal

#### Task 3.2: Remove Client-Side Ordering Logic
- [ ] Delete `web/lib/utils/zmanim-ordering.ts` if unused
- [ ] Remove any sorting logic in page.tsx
- [ ] Trust server-side `display_order`

**Validation:**
- Zmanim display in correct order without client-side sorting
- No `sort()` calls on zmanim arrays in components

---

## Verification Checklist

### Functional Tests

| Test | How to Verify | Expected Result |
|------|---------------|-----------------|
| No coverage placeholder | Remove all coverage, reload page | Shows "Add coverage first" message |
| Single fetch on load | Open Network tab, load page | ONE `/publisher/zmanim?locality_id=...` call |
| Preview shows times | Load page with coverage | Right-side preview shows calculated times |
| Card shows times | Load page with coverage | Each ZmanCard shows its calculated time |
| Date change refetches | Change date picker | ONE new fetch, preview + cards update |
| Week preview works | Open week preview dialog | Shows 7 days of data |
| Order is correct | Check zmanim list | Matches expected halachic order |

### Manual Test Script

```bash
# 1. Get test token
source api/.env && node scripts/get-test-token.js

# 2. Verify API returns expected structure
TOKEN="<paste-token>"
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim?locality_id=123&date=2024-01-15" | jq '.day_context, .zmanim[0]'

# 3. Open browser, navigate to /publisher/algorithm
# 4. Open DevTools Network tab
# 5. Verify only ONE zmanim request on page load
# 6. Change date - verify only ONE new request
# 7. Open week preview - verify caching works
```

### Type Safety

```bash
cd web && npm run type-check
# Expected: No errors
```

### Build Verification

```bash
cd web && npm run build
# Expected: Successful build with no warnings about unused code
```

---

## Files Changed Summary

| File | Action |
|------|--------|
| `api/internal/handlers/publisher_zmanim.go` | Modify - add locality_id param, day_context |
| `web/lib/hooks/useAlgorithmPageData.ts` | Create - unified data hook |
| `web/app/publisher/algorithm/page.tsx` | Modify - use new hook, simplify |
| `web/components/publisher/AlgorithmPreview.tsx` | Modify - receive props, no fetching |
| `web/components/publisher/WeekPreview.tsx` | Modify - use React Query, accept props |
| `web/lib/utils/zmanim-ordering.ts` | Delete - if unused after changes |
| `web/lib/hooks/useZmanimList.ts` | Audit - remove unused exports |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Run full test suite before/after each phase |
| Backend response format changes | Make changes additive (new fields, not modifications) |
| Cache invalidation issues | Clear React Query cache during testing |
| Performance regression | Measure before/after with Network tab timing |

---

## Success Criteria

1. **Single source of truth** - One hook provides all data for algorithm page
2. **Network efficiency** - Page load triggers ONE API call (not 3+)
3. **Clean code** - No backwards-compatibility comments, no dead code
4. **Correct ordering** - Zmanim display in server-defined order
5. **Proper gating** - Page requires locality; shows placeholder otherwise
6. **Type safety** - Full TypeScript coverage, no `any` types
7. **Maintainability** - New developer can understand data flow in 5 minutes
