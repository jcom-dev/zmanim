# Algorithm Editor Page - Comprehensive Fix Plan

## Problem Statement

The Algorithm Editor page is fundamentally broken and doesn't match the Epic 4 specifications. Key issues:

1. **Empty State**: Page shows "No zmanim in this category" for all 3 categories
2. **Onboarding Not Integrated**: Onboarding wizard exists (`OnboardingWizard.tsx`) but Algorithm Editor doesn't use it
3. **Overcomplicated Categories**: 3 categories (Essential/Optional/Custom) add unnecessary complexity
4. **Missing "Copy from Publisher"**: Template selection only offers GRA/MGA/Rabbeinu Tam, not copying from another publisher
5. **Slow Loading**: Performance issues with the page load
6. **Preview Location Not Persisted**: User's preview location resets on page refresh
7. **Missing API Routes**: POST/PUT/DELETE endpoints exist in handlers but aren't wired in router (line 152)
8. **Broken Live Preview**: AlgorithmPreview component passes `zmanim: {}` to legacy API

---

## Existing Infrastructure (Use, Don't Recreate)

### Already Built:
- `OnboardingWizard.tsx` - Full 5-step wizard with progress tracking
- `TemplateSelectionStep.tsx` - GRA, MGA, Rabbeinu Tam, Start Fresh options
- `CustomizeZmanimStep.tsx` - Customize after template selection
- `CoverageSetupStep.tsx` - Geographic coverage setup
- `ReviewPublishStep.tsx` - Final review before publishing
- `api/internal/handlers/onboarding.go` - Backend onboarding state persistence
- `publisher_zmanim.go` - CRUD handlers (exist but not wired)
- `BrowseTemplatesDialog.tsx` - Browse other publishers' zmanim (exists!)

### Missing Connections:
- Algorithm Editor page doesn't check for empty zmanim and show wizard
- TemplateSelectionStep doesn't have "Copy from Publisher" option
- API routes not wired in main.go
- AlgorithmPreview uses legacy API

---

## Proposed Architecture

### 1. First-Run Integration

When `useZmanimList()` returns empty array, redirect to or embed onboarding wizard.

**Option A (Recommended)**: Embed wizard directly in Algorithm Editor page
**Option B**: Redirect to `/publisher/onboarding` route

### 2. Enhanced Template Selection

Update `TemplateSelectionStep.tsx` to add "Copy from Publisher" option:

```
┌─────────────────────────────────────────────────────────────┐
│  Choose Your Starting Point                                  │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ GRA Standard │ │ Magen Avraham│ │ Rabbeinu Tam │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                              │
│  ┌──────────────┐ ┌────────────────────────────────┐        │
│  │ Start Fresh  │ │ 🔍 Copy from Another Publisher │ ← NEW  │
│  └──────────────┘ └────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 2. Simplified Page Structure (No Categories)

Replace 3-category layout with a single flat list with filters:

```
┌─────────────────────────────────────────────────────────────┐
│  Algorithm Editor          [12 Zmanim] [9 Enabled]          │
│  Configure your zmanim calculation formulas                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 📍 Brooklyn, NY  │  🔍 Search city...                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🔍 Search zmanim...  │ + Import │ + Add Custom │      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Filter: [All] [Enabled] [Disabled] [Custom]                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⬜ עלות השחר • Alos HaShachar                        │   │
│  │    sunrise - 72min                                    │   │
│  │    [Edit] [Toggle] ────────────────── 5:42 AM        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⬜ הנץ החמה • Sunrise                                │   │
│  │    sunrise                                            │   │
│  │    [Edit] [Toggle] ────────────────── 6:54 AM        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ... more zmanim ...                                        │
└─────────────────────────────────────────────────────────────┘
```

### 3. Import Dialog

When clicking "Import", show options to bulk-import:

```
┌─────────────────────────────────────────────────────────────┐
│  Import Zmanim                                        [X]   │
│                                                              │
│  ┌─ From Defaults ─────────────────────────────────────────┐│
│  │ Import all 18 standard zmanim                           ││
│  │ [Import All Defaults]                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ From Another Publisher ────────────────────────────────┐│
│  │ 🔍 Search publishers...                                 ││
│  │                                                          ││
│  │ ┌────────────────────────────────────────────────────┐  ││
│  │ │ OU Kosher               12 zmanim  [View] [Copy]   │  ││
│  │ │ Chabad.org             18 zmanim  [View] [Copy]   │  ││
│  │ │ Young Israel            9 zmanim  [View] [Copy]   │  ││
│  │ └────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ Import Single Zman ────────────────────────────────────┐│
│  │ 🔍 Search zmanim across all publishers...               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend - Wire Missing Routes (30 min)

**File: `api/cmd/api/main.go` (line 152)**

The handlers already exist in `publisher_zmanim.go`. Just add the route wiring:

```go
// Publisher zmanim management (Story 4-4)
r.Get("/zmanim", h.GetPublisherZmanim)         // EXISTS
r.Post("/zmanim", h.CreatePublisherZman)       // ADD - handler at line 214
r.Post("/zmanim/import", h.ImportZmanim)       // ADD - NEW handler needed
r.Get("/zmanim/{zmanKey}", h.GetPublisherZman) // ADD - handler at line 168
r.Put("/zmanim/{zmanKey}", h.UpdatePublisherZman)   // ADD - handler at line 313
r.Delete("/zmanim/{zmanKey}", h.DeletePublisherZman) // ADD - handler at line 437
```

**File: `api/internal/handlers/publisher_zmanim.go`**

Add ONE new handler for bulk import:

```go
// ImportZmanim - Bulk import from defaults or another publisher
// POST /api/v1/publisher/zmanim/import
// Body: { source: "defaults" | "publisher", publisher_id?: string, zman_keys?: []string }
func (h *Handlers) ImportZmanim(w http.ResponseWriter, r *http.Request) {
    // 1. Parse source type
    // 2. If "defaults": Copy from zmanim_templates table
    // 3. If "publisher": Copy from another publisher's publisher_zmanim
    // 4. Insert into current publisher's publisher_zmanim
    // 5. Return newly created zmanim
}
```

### Phase 2: User Preferences for Preview Location (1 hr)

**Option A (Simpler)**: Use localStorage on frontend
- No backend changes needed
- Works immediately
- Lost if user clears browser data

**Option B (Recommended)**: Store in database

**Migration: `XXXXXX_user_publisher_preferences.sql`**
```sql
CREATE TABLE user_publisher_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    preview_location JSONB, -- {latitude, longitude, timezone, displayName}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, publisher_id)
);
```

**API Endpoints:**
```
GET  /api/v1/publisher/preferences  -- Returns user's preferences for current publisher
PUT  /api/v1/publisher/preferences  -- Updates preferences
```

### Phase 3: Frontend - Integrate Onboarding Wizard (2-3 hrs)

**File: `web/app/publisher/algorithm/page.tsx`**

Modify to show OnboardingWizard when zmanim list is empty:

```tsx
// Add to page.tsx
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

// In component:
const { data: zmanim = [], isLoading } = useZmanimList();

// Show wizard if no zmanim configured
if (!isLoading && zmanim.length === 0) {
  return (
    <OnboardingWizard
      onComplete={() => refetch()}
      onSkip={() => /* stay on page */}
    />
  );
}

// Otherwise show normal editor page...
```

**File: `web/components/onboarding/steps/TemplateSelectionStep.tsx`**

Add "Copy from Publisher" option:

```tsx
const TEMPLATES: Template[] = [
  // ... existing GRA, MGA, Rabbeinu Tam, custom ...
  {
    id: 'copy_publisher',
    name: 'Copy from Publisher',
    nameHebrew: 'העתק ממפרסם',
    description: 'Browse and copy the complete algorithm from another publisher.',
    previewTimes: [],
  },
];

// When 'copy_publisher' selected, show BrowseTemplatesDialog
```

### Phase 4: Frontend - Simplify Page Layout (2-3 hrs)

**File: `web/app/publisher/algorithm/page.tsx`**

Replace 3-category layout with flat list:

1. Remove `categorizeZmanim()` usage
2. Replace 3 Card sections with single list
3. Add filter buttons: [All] [Enabled] [Disabled] [Custom]
4. Move "Add Custom Zman" and "Import" to top action bar

### Phase 5: Fix Live Preview (1 hr)

**File: `web/components/publisher/AlgorithmPreview.tsx`**

The component currently passes empty `zmanim: {}` to legacy API. Fix to use new DSL preview:

```tsx
// OLD (broken):
const loadPreview = async () => {
  if (Object.keys(configuration.zmanim).length === 0) {
    setPreview([]);
    return;
  }
  // calls /api/v1/publisher/algorithm/preview
}

// NEW (fixed):
// Pass zmanim list as prop, call /api/v1/dsl/preview for each enabled zman
// Or create bulk preview endpoint
```

**Alternative**: Create bulk preview endpoint:
```
POST /api/v1/dsl/preview-bulk
Body: { formulas: [{key, formula}], date, location }
Returns: [{key, result, breakdown}]
```

### Phase 6: Performance Optimization (1-2 hrs)

1. **Parallel fetch**: Load zmanim + preferences simultaneously
2. **Lazy preview**: Only calculate visible zmanim times
3. **Debounce search**: 300ms delay on search input
4. **Memoize components**: Use React.memo for ZmanCard
5. **Virtual scroll**: For 50+ zmanim (optional, likely not needed)

---

## Detailed File Changes

### Backend Changes

| File | Change | Effort |
|------|--------|--------|
| `api/cmd/api/main.go:152` | Add 4 missing routes (POST, GET/{key}, PUT, DELETE) + import route | 15 min |
| `api/internal/handlers/publisher_zmanim.go` | Add `ImportZmanim` handler for bulk import | 45 min |
| `api/internal/handlers/preferences.go` | NEW: User preferences handlers (Get/Update) | 30 min |
| `db/migrations/XXXXXX_user_preferences.sql` | NEW: Add user_publisher_preferences table | 15 min |

### Frontend Changes

| File | Change | Effort |
|------|--------|--------|
| `web/app/publisher/algorithm/page.tsx` | Major rewrite: add wizard integration, simplify layout | 2 hrs |
| `web/components/publisher/AlgorithmPreview.tsx` | Fix to use new DSL preview API with zmanim prop | 1 hr |
| `web/components/onboarding/steps/TemplateSelectionStep.tsx` | Add "Copy from Publisher" option | 30 min |
| `web/components/onboarding/OnboardingWizard.tsx` | Handle "copy_publisher" flow | 30 min |
| `web/lib/hooks/useZmanimList.ts` | Add `useImportZmanim` mutation | 15 min |
| `web/lib/hooks/useUserPreferences.ts` | NEW: Preferences hook (get/update preview location) | 30 min |

### No Changes Needed (Already Exist)

| File | Status |
|------|--------|
| `web/components/onboarding/OnboardingWizard.tsx` | EXISTS - full 5-step wizard |
| `web/components/algorithm/BrowseTemplatesDialog.tsx` | EXISTS - browse other publishers |
| `api/internal/handlers/publisher_zmanim.go` | EXISTS - CRUD handlers (just need wiring) |
| `api/internal/handlers/onboarding.go` | EXISTS - onboarding state handlers |

---

## Acceptance Criteria

### Must Have (P0)
- [ ] API routes wired: POST/GET/{key}/PUT/DELETE on `/api/v1/publisher/zmanim`
- [ ] Page loads zmanim from `publisher_zmanim` table (currently empty = broken)
- [ ] First-run wizard appears when no zmanim configured
- [ ] Can import all 18 default zmanim with one click
- [ ] Can copy all zmanim from another publisher
- [ ] Preview location defaults to Brooklyn, NY (40.6782, -73.9442)
- [ ] Preview location is saved and persisted per user
- [ ] Page loads in < 2 seconds

### Should Have (P1)
- [ ] Simplified flat list layout (no 3-category sections)
- [ ] Each zman row shows calculated time inline
- [ ] Filter by: All / Enabled / Disabled / Custom
- [ ] Import single zman from another publisher

### Nice to Have (P2)
- [ ] Virtual scrolling for 50+ zmanim
- [ ] Drag-drop reordering
- [ ] Bulk enable/disable

---

## Testing Plan

### E2E Tests (Playwright)
```
tests/e2e/algorithm-editor.spec.ts
- test('shows wizard when no zmanim configured')
- test('imports defaults and shows zmanim list')
- test('copies zmanim from another publisher')
- test('persists preview location across sessions')
- test('creates custom zman')
- test('edits existing zman formula')
- test('deletes custom zman')
```

### Unit Tests
- `ImportZmanim` handler: test defaults vs publisher source
- `useUserPreferences` hook: test localStorage fallback
- `AlgorithmPreview`: test DSL preview API integration

---

## Total Estimated Effort

| Phase | Description | Time |
|-------|-------------|------|
| 1 | Wire missing API routes | 30 min |
| 2 | User preferences (DB + API) | 1.5 hrs |
| 3 | Integrate onboarding wizard | 2-3 hrs |
| 4 | Simplify page layout | 2-3 hrs |
| 5 | Fix Live Preview | 1 hr |
| 6 | Performance optimization | 1-2 hrs |
| **Total** | | **8-11 hrs** |

---

## Quick Wins (Do First)

1. **Wire the routes** (30 min) - Biggest bang for buck, unblocks everything
2. **Fix AlgorithmPreview** (1 hr) - Makes the page actually show data
3. **Add wizard integration** (1 hr) - Shows wizard on empty state

After these 3 items (~2.5 hrs), the page will be functional. Rest is polish.

---

## Open Questions for Developer

1. **Location persistence**: Use localStorage (simpler) or database (more robust)?
   - Recommendation: Start with localStorage, add DB later if needed

2. **Import granularity**: Import all zmanim or allow picking individual ones?
   - Recommendation: Start with "Import All", add individual selection later

3. **Preview location default**: Hard-code Brooklyn or use publisher's first coverage city?
   - Recommendation: Brooklyn as fallback, publisher's coverage city if available
