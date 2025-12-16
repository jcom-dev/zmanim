# Story 5.11: Frontend useApi Migration

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P1
**Story Points:** 8
**Dependencies:** None (can start immediately)

---

## Story

As a **developer**,
I want **all raw fetch() calls migrated to the useApi hook**,
So that **authentication, error handling, and API response unwrapping are consistent across the entire frontend**.

---

## Problem Statement

The current codebase has **73 instances** of raw `fetch()` calls in frontend components. This violates the coding standards and causes:

1. **Inconsistent auth handling** - Each component manually adds Authorization header
2. **Missing X-Publisher-Id** - Easy to forget multi-tenancy header
3. **Duplicate error handling** - Same try/catch pattern repeated 73 times
4. **Response unwrapping bugs** - `data.data?.publishers || data.publishers` patterns
5. **No request ID tracking** - Hard to correlate frontend errors with backend logs

**Reference:** [docs/coding-standards.md](../../coding-standards.md#3-duplicated-fetch-logic---use-unified-api-client)

---

## Acceptance Criteria

### AC-5.11.1: Zero Raw Fetch Calls
- [ ] `grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l` returns 0
- [ ] All API calls use `useApi()` hook from `@/lib/api-client`
- [ ] No components define their own `API_BASE` constant

### AC-5.11.2: Publisher-Scoped Endpoints
- [ ] All publisher endpoints use `api.get()` / `api.post()` (auto-adds X-Publisher-Id)
- [ ] Publisher context properly injected via `usePublisherContext()`
- [ ] Token retrieval handled by useApi internally

### AC-5.11.3: Public Endpoints
- [ ] Public endpoints (no auth) use `api.public.get()` / `api.public.post()`
- [ ] Countries, cities, timezones endpoints migrated
- [ ] Health check endpoints migrated

### AC-5.11.4: Admin Endpoints
- [ ] Admin endpoints use `api.admin.get()` / `api.admin.post()` (auth but no X-Publisher-Id)
- [ ] Admin dashboard endpoints migrated
- [ ] Publisher management endpoints migrated

### AC-5.11.5: React Query Integration
- [ ] Data fetching uses `usePublisherQuery` / `useGlobalQuery` where appropriate
- [ ] Mutations use `usePublisherMutation` with cache invalidation
- [ ] Stale time configured appropriately per endpoint type

### AC-5.11.6: Error Handling
- [ ] All error handling uses `ApiError` class
- [ ] Toast notifications for mutation errors
- [ ] Proper error state rendering in components

---

## Technical Context

### Current Violation Locations

Run this command to find all violations:
```bash
grep -rn "await fetch(" web/app web/components --include="*.tsx" | head -50
```

**High-priority files (based on usage frequency):**
- `web/app/publisher/dashboard/page.tsx` - Multiple fetch calls
- `web/app/publisher/algorithm-editor/page.tsx` - Complex state
- `web/app/publisher/coverage/page.tsx` - CRUD operations
- `web/app/admin/publishers/page.tsx` - Admin operations
- `web/components/publisher/TeamManagement.tsx` - Invite flows

### Migration Pattern

**Before (WRONG):**
```tsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  async function fetchData() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/v1/publisher/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Publisher-Id': selectedPublisher?.id,
        },
      });
      const json = await response.json();
      setData(json.data || json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, [selectedPublisher]);
```

**After (CORRECT - Simple):**
```tsx
const api = useApi();
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  async function fetchData() {
    try {
      const result = await api.get<ProfileData>('/publisher/profile');
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, [api]);
```

**After (CORRECT - React Query):**
```tsx
const { data, isLoading, error } = usePublisherQuery<ProfileData>(
  'publisher-profile',
  '/publisher/profile'
);

// data is already unwrapped, loading/error states handled
```

### Files to Migrate (Prioritized by Impact)

| Priority | File | Fetch Count | Complexity |
|----------|------|-------------|------------|
| P1 | `web/app/publisher/dashboard/page.tsx` | 5 | High |
| P1 | `web/app/publisher/algorithm-editor/page.tsx` | 8 | High |
| P1 | `web/components/publisher/TeamManagement.tsx` | 4 | Medium |
| P1 | `web/app/publisher/coverage/page.tsx` | 6 | High |
| P2 | `web/app/admin/publishers/page.tsx` | 4 | Medium |
| P2 | `web/app/admin/dashboard/page.tsx` | 3 | Medium |
| P2 | `web/components/zmanim/*.tsx` | 12 | Low |
| P3 | `web/app/publisher/profile/page.tsx` | 2 | Low |
| P3 | Other components | ~30 | Low |

---

## Tasks / Subtasks

- [ ] Task 1: Audit and Categorize
  - [ ] 1.1 Run grep to list all violations
  - [ ] 1.2 Categorize by endpoint type (publisher/admin/public)
  - [ ] 1.3 Identify React Query candidates vs simple fetch
  - [ ] 1.4 Create migration checklist spreadsheet

- [ ] Task 2: High-Priority Publisher Pages
  - [ ] 2.1 Migrate `publisher/dashboard/page.tsx`
  - [ ] 2.2 Migrate `publisher/algorithm-editor/page.tsx`
  - [ ] 2.3 Migrate `publisher/coverage/page.tsx`
  - [ ] 2.4 Migrate `publisher/profile/page.tsx`
  - [ ] 2.5 Migrate `publisher/team/page.tsx`

- [ ] Task 3: Publisher Components
  - [ ] 3.1 Migrate `TeamManagement.tsx`
  - [ ] 3.2 Migrate `AlgorithmList.tsx`
  - [ ] 3.3 Migrate `CoverageSelector.tsx`
  - [ ] 3.4 Migrate `ZmanEditor.tsx`

- [ ] Task 4: Admin Pages
  - [ ] 4.1 Migrate `admin/dashboard/page.tsx`
  - [ ] 4.2 Migrate `admin/publishers/page.tsx`
  - [ ] 4.3 Migrate `admin/pending-requests/page.tsx`

- [ ] Task 5: Public/Zmanim Components
  - [ ] 5.1 Migrate zmanim display components
  - [ ] 5.2 Migrate location selectors
  - [ ] 5.3 Migrate public API calls

- [ ] Task 6: React Query Optimization
  - [ ] 6.1 Add `usePublisherQuery` to high-frequency endpoints
  - [ ] 6.2 Configure staleTime per endpoint type
  - [ ] 6.3 Add cache invalidation to mutations

- [ ] Task 7: Verification
  - [ ] 7.1 Run violation check: `grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l`
  - [ ] 7.2 Run `npm run type-check`
  - [ ] 7.3 Run `npm run lint`
  - [ ] 7.4 Manual testing of all migrated pages
  - [ ] 7.5 Run E2E tests

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Zero raw fetch() calls in web/app and web/components
- [ ] All API calls use appropriate useApi method (get/post/admin.get/public.get)
- [ ] TypeScript compiles without errors
- [ ] All migrated pages manually tested
- [ ] E2E tests pass

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `web/app/publisher/**/*.tsx` | Modify | Publisher page migrations |
| `web/app/admin/**/*.tsx` | Modify | Admin page migrations |
| `web/components/publisher/*.tsx` | Modify | Publisher component migrations |
| `web/components/zmanim/*.tsx` | Modify | Zmanim component migrations |
| `web/components/shared/*.tsx` | Modify | Shared component migrations |

---

## Testing Strategy

1. **Type Safety** - TypeScript compiler catches missing types
2. **Lint** - ESLint catches unused imports, etc.
3. **Manual Testing** - Test each migrated page in browser
4. **E2E Tests** - Run existing Playwright tests to catch regressions

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking auth flow | Test token refresh scenarios |
| Missing X-Publisher-Id | Verify multi-publisher switching works |
| Cache staleness | Configure appropriate staleTime |
| Error handling gaps | Use ApiError class consistently |

---

## Notes

- This story addresses CRITICAL technical debt per coding standards
- Migration should NOT change any business logic
- Focus on 1:1 replacement, not refactoring
- Can be parallelized by assigning different files to different sessions
