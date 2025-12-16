# Story 11.5: Request Addition Workflow & Algorithm Page Migration

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Status:** Ready for Development
**Priority:** High
**Date:** 2025-12-22
**Version:** 1.0

---

## User Story

**As a** publisher,
**I want** to request new master zmanim from the registry interface and have a seamless way to navigate between the registry and my algorithm page,
**So that** I can contribute to the platform and efficiently manage my zman catalog.

---

## Acceptance Criteria

### AC1: Request Addition Button on Registry Page

**Given** I am on the Master Registry tab OR Publisher Examples tab
**When** I see the page header
**Then** I see a "Request Addition" button (prominent, secondary style)

### AC2: Request Addition Modal Opens

**Given** I click the "Request Addition" button
**When** the button is clicked
**Then** the existing `RequestZmanModal` component opens (reused from algorithm page)
**And** the modal pre-populates the "source" field with value "registry"
**And** I can fill out the request form (zman name, description, justification, tags, optional formula)

### AC3: Request Submission from Registry

**Given** I submit a request via the registry
**When** the submission completes successfully
**Then** toast notification shows: "Request submitted for admin review"
**And** modal closes
**And** I remain on the registry page (no navigation)

### AC4: Algorithm Page Header - Browse Registry Button

**Given** I navigate to `/publisher/algorithm` (Algorithm page)
**When** the page loads
**Then** I see a prominent "Browse Registry" button in the header
**And** NO "Add Zman" button exists
**And** NO "Add Zman Mode" dialog exists
**And** NO `MasterZmanPicker` or `PublisherZmanPicker` components exist

### AC5: Browse Registry Navigation

**Given** I am on the algorithm page
**When** I click the "Browse Registry" button
**Then** I navigate to `/publisher/registry`

### AC6: Import/Link/Copy Redirect to Algorithm Page

**Given** I import/link/copy a zman from the registry
**When** the action completes successfully
**Then** I am redirected to `/publisher/algorithm?focus={zman_key}`

### AC7: Focus Highlighting on Algorithm Page

**Given** I land on `/publisher/algorithm?focus={zman_key}` after import/link/copy
**When** the page loads
**Then** the page scrolls to the newly added zman
**And** the zman card is highlighted with:
  - Green border (border-green-500)
  - Subtle animation (fade-in or scale)
  - Highlight remains for 3 seconds, then fades out

### AC8: Focus Fallback Handling

**Given** the algorithm page URL includes `?focus={zman_key}`
**When** no matching zman exists in my catalog
**Then** no scroll or highlight occurs (graceful fallback)

---

## Technical Notes

### File Changes

**Modified Files:**
```
web/app/publisher/registry/page.tsx          # Add "Request Addition" button + RequestZmanModal
web/app/publisher/algorithm/page.tsx         # Remove Add Zman dialog, add Browse Registry button, add focus handling
web/components/shared/RequestZmanModal.tsx   # Move from algorithm page to shared (if not already shared)
```

**Deleted Code:**
- Lines 1144-1238 in `algorithm/page.tsx` (Add Zman Mode dialog)
- `MasterZmanPicker` component import and usage
- `PublisherZmanPicker` component import and usage
- All "Add Zman Mode" state variables and handlers

### Request Addition Modal Integration

Move `RequestZmanModal` component to shared location:
```
web/components/shared/RequestZmanModal.tsx
```

Import `RequestZmanModal` in both:
- `web/app/publisher/registry/page.tsx`
- `web/app/publisher/algorithm/page.tsx` (if still needed for any legacy reason)

Add "source" field to request submission:
- `source: "registry"` when opened from registry
- `source: "algorithm"` when opened from algorithm page (if applicable)

### Algorithm Page Cleanup

**Remove:**
1. "Add Zman" button
2. "Add Zman Mode" dialog (lines 1144-1238)
3. `MasterZmanPicker` component import and usage
4. `PublisherZmanPicker` component import and usage
5. All state variables related to "Add Zman Mode"
6. All handlers related to "Add Zman Mode"

**Add:**
1. "Browse Registry" button in header
   - Uses `router.push('/publisher/registry')`
   - Prominent placement (next to other header actions)

### URL Parameter Focus Handling

Parse `?focus={zman_key}` from URL on algorithm page:

```tsx
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const AlgorithmPage = () => {
  const searchParams = useSearchParams();

  useEffect(() => {
    const focusKey = searchParams.get('focus');
    if (focusKey) {
      const element = document.querySelector(`[data-zman-key="${focusKey}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlight-zman');
        setTimeout(() => element.classList.remove('highlight-zman'), 3000);
      }
    }
  }, [searchParams]);

  // ... rest of component
};
```

### Highlight CSS Class

Add to global CSS or component styles:

```css
.highlight-zman {
  @apply border-green-500 border-2 animate-in fade-in duration-500;
}
```

Or use Tailwind animation utilities:

```tsx
// Add to zman card element
data-zman-key={zman.zman_key}
className={cn(
  "zman-card",
  focusedKey === zman.zman_key && "border-green-500 border-2 animate-in fade-in duration-500"
)}
```

### Backend - No New Work Required

Reuse existing Request Addition API endpoint:
```
POST /api/v1/publisher/requests
```

No new backend endpoints needed for this story.

---

## Dependencies

**Prerequisites:**
- Story 11.1: Master Registry Browser & Import Flow (for redirect target)
- Story 11.3: Publisher Examples Browser & Link/Copy Flow (for link/copy redirects)

**Dependent Stories:**
- None

---

## Testing Checklist

### Manual Testing

- [ ] Verify "Request Addition" button appears on Master Registry tab
- [ ] Verify "Request Addition" button appears on Publisher Examples tab
- [ ] Click "Request Addition" button → RequestZmanModal opens
- [ ] Verify modal pre-populates source="registry"
- [ ] Fill out request form and submit
- [ ] Verify toast notification appears: "Request submitted for admin review"
- [ ] Verify modal closes after submission
- [ ] Verify remain on registry page (no navigation)
- [ ] Navigate to `/publisher/algorithm`
- [ ] Verify "Browse Registry" button exists in header
- [ ] Verify NO "Add Zman" button exists
- [ ] Click "Browse Registry" button → Navigate to `/publisher/registry`
- [ ] Import a zman from Master Registry
- [ ] Verify redirect to `/publisher/algorithm?focus={zman_key}`
- [ ] Verify page scrolls to newly added zman
- [ ] Verify zman card has green border + animation
- [ ] Verify highlight fades out after 3 seconds
- [ ] Test focus fallback: `/publisher/algorithm?focus=nonexistent_key`
- [ ] Verify no errors, graceful fallback

### Code Verification

- [ ] Verify Add Zman Mode dialog code removed (lines 1144-1238)
- [ ] Verify `MasterZmanPicker` component NOT imported
- [ ] Verify `PublisherZmanPicker` component NOT imported
- [ ] Verify NO state variables for "Add Zman Mode"
- [ ] Verify `RequestZmanModal` exists in shared location
- [ ] Verify algorithm page has ZERO zman addition functionality
- [ ] Verify algorithm page only allows editing existing zmanim

### E2E Tests

Create E2E test file: `tests/e2e/publisher/registry-navigation.spec.ts`

**Test Suite: Request Addition Flow**
1. Navigate to `/publisher/registry`
2. Click "Request Addition" button
3. Verify modal opens
4. Fill form and submit
5. Verify toast notification
6. Verify remain on registry page

**Test Suite: Algorithm Page Migration**
1. Navigate to `/publisher/algorithm`
2. Verify "Browse Registry" button exists
3. Verify NO "Add Zman" button
4. Click "Browse Registry" → Verify navigation

**Test Suite: Focus Highlighting**
1. Import zman from registry
2. Verify redirect to `/publisher/algorithm?focus={zman_key}`
3. Verify scroll to zman card
4. Verify green border + animation
5. Wait 3 seconds → Verify highlight fades out

---

## Definition of Done

- [ ] "Request Addition" button added to registry page (both tabs)
- [ ] `RequestZmanModal` component moved to shared location
- [ ] Modal pre-populates source field correctly
- [ ] Request submission works from registry
- [ ] Toast notification shows on success
- [ ] Algorithm page "Add Zman" button removed
- [ ] Algorithm page "Add Zman Mode" dialog removed (lines 1144-1238)
- [ ] `MasterZmanPicker` component removed from algorithm page
- [ ] `PublisherZmanPicker` component removed from algorithm page
- [ ] "Browse Registry" button added to algorithm page header
- [ ] Navigation to registry works from algorithm page
- [ ] URL param `?focus={zman_key}` parsed and handled
- [ ] Scroll to zman card works correctly
- [ ] Green border + animation applied to focused zman
- [ ] Highlight fades out after 3 seconds
- [ ] Graceful fallback for nonexistent zman keys
- [ ] E2E tests passing (3 test suites)
- [ ] Mobile responsive design verified
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Build passes successfully

---

## FRs Covered

| FR | Description |
|----|-------------|
| FR38 | Request Addition button available on registry |
| FR39 | Opens RequestZmanModal component |
| FR40 | Pre-populates source field with "registry" |
| FR41 | Available on both Master and Publisher Examples tabs |
| FR48 | Algorithm page has "Browse Registry" button |
| FR49 | Algorithm page NO "Add Zman" button |
| FR50 | Algorithm page URL param `?focus=` handling |
| FR51 | Algorithm page ZERO addition functionality (edit only) |

---

## Implementation Notes

### Algorithm Page - Before & After

**BEFORE (Current State):**
```tsx
// Header has "Add Zman" button
<button onClick={openAddZmanDialog}>Add Zman</button>

// Add Zman Mode dialog exists (lines 1144-1238)
{showAddZmanDialog && (
  <Dialog>
    <MasterZmanPicker ... />
    <PublisherZmanPicker ... />
  </Dialog>
)}
```

**AFTER (This Story):**
```tsx
// Header has "Browse Registry" button
<button onClick={() => router.push('/publisher/registry')}>
  Browse Registry
</button>

// NO Add Zman dialog
// NO MasterZmanPicker
// NO PublisherZmanPicker
// Edit existing zmanim ONLY
```

### Registry Page - Header Addition

**Add to header:**
```tsx
<div className="flex justify-between items-center">
  <h1>Zmanim Registry</h1>
  <div className="flex gap-4">
    <button onClick={openRequestModal} className="btn-secondary">
      Request Addition
    </button>
  </div>
</div>

{/* Request Modal */}
{showRequestModal && (
  <RequestZmanModal
    source="registry"
    onClose={() => setShowRequestModal(false)}
    onSuccess={() => {
      toast.success("Request submitted for admin review");
      setShowRequestModal(false);
    }}
  />
)}
```

### Import/Link/Copy Actions - Redirect Logic

Update success handlers in Stories 11.1 and 11.3:

```tsx
// After successful import/link/copy
const handleSuccess = (zmanKey: string) => {
  toast.success("Zman added successfully");
  router.push(`/publisher/algorithm?focus=${zmanKey}`);
};
```

---

## Success Metrics

### Behavioral Success
- **50%+ of new publishers** use "Browse Registry" button within first week
- **Reduced confusion:** Zero support questions about "Add Zman" button (removed)
- **Increased contributions:** 20%+ increase in Request Addition submissions
- **Seamless navigation:** 80%+ of users successfully navigate registry → algorithm → registry

### Quality Metrics
- **Zero regressions:** Algorithm page edit functionality works perfectly
- **Zero dead code:** All Add Zman Mode code removed
- **Performance:** Focus highlighting completes in <200ms
- **Mobile UX:** Request Addition workflow works on mobile devices

---

_Epic 11: Publisher Zmanim Registry Interface_
_Story 11.5: Request Addition Workflow & Algorithm Page Migration_
_Date: 2025-12-22_
_Version: 1.0_
