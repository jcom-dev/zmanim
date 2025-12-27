# Component Registry

> **Last Updated:** 2025-12-22
> **Total Components:** ~123 React components
> **Compliance:** 98% useApi pattern, 100% design tokens, 95% Clerk isLoaded check

## Quick Reference

| Directory | Count | Purpose | Auth |
|-----------|-------|---------|------|
| ui/ | 25 | shadcn/ui primitives | N/A |
| registry/ | 4 | Zmanim registry browser | Publisher |
| publisher/ | 18 | Publisher dashboard | Publisher |
| shared/ | 19 | Reusable cross-role | Mixed |
| algorithm/ | 8 | Algorithm editor | Publisher |
| formula-builder/ | 10 | Visual formula builder | Publisher |
| onboarding/ | 6 | Publisher onboarding | Publisher |
| editor/ | 6 | DSL code editor | Publisher |
| zmanim/ | 5 | Public zmanim display | Public |
| admin/ | 5 | Admin dashboard | Admin |
| preview/ | 3 | Zmanim previews | Publisher |
| home/ | 2 | Landing page | Public |
| audit/ | 6 | Audit log components | Publisher |

---

## Core Components by Feature

### Publisher Dashboard (`/publisher/`)

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **PublisherCard.tsx** | GET /publisher/context | Publisher profile card |
| **ZmanCard.tsx** | GET/PUT/DELETE /publisher/zmanim/:key | Zman management card with formula, tags, settings |
| **ZmanTagEditor.tsx** | GET/PUT /publisher/zmanim/:key/tags | Tag management with negation support |
| **ZmanAliasEditor.tsx** | PUT /publisher/zmanim/:key | Hebrew/English alias editing |
| **ZmanTimePreview.tsx** | POST /publisher/zmanim/preview | Live formula preview with breakdown |
| **LogoUpload.tsx** | POST /upload | Publisher logo upload |
| **LogoUploadLocal.tsx** | (local) | Local logo processing |
| **LogoGenerator.tsx** | POST /ai/generate-logo | AI-powered logo generation |
| **CorrectionRequestDialog.tsx** | POST /corrections | Submit locality corrections |
| **DeletedZmanimDialog.tsx** | GET /publisher/zmanim/deleted, POST /restore | Soft-delete management |
| **DisabledZmanimDialog.tsx** | GET /publisher/zmanim/disabled | Disabled zmanim management |
| **ImportSnapshotDialog.tsx** | POST /publisher/snapshots/import | Import zmanim from snapshot |
| **YearExportDialog.tsx** | GET /publisher/export/year | Export year of zmanim |
| **LocationOverrideDialog.tsx** | GET/POST/PUT /publisher/location-overrides | Override locality coordinates |
| **MasterZmanPicker.tsx** | GET /master-registry | Select from master registry |
| **PublisherZmanPicker.tsx** | GET /publishers/:id/zmanim | Browse other publishers' zmanim |
| **RequestZmanModal.tsx** | POST /publisher/requests | Request new zman from registry |
| **ZmanimReportDialog.tsx** | POST /publisher/reports/zmanim-pdf | Generate PDF zmanim report (Story 11.6) |
| **WeeklyCalendarSelectionDialog.tsx** | POST /publisher/calendar/weekly-pdf | Weekly calendar PDF export with zman selection |
| **PublisherSwitcher.tsx** | (context) | Dropdown to switch publishers |
| **PublisherSelectionModal.tsx** | (context) | Multi-publisher selection (blocking) |

---

### Algorithm Editor (`/algorithm/`)

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **AIFormulaGenerator.tsx** | POST /ai/suggest-formula | AI formula suggestions |
| **RestoreDialog.tsx** | POST /version-history/:id/rollback | Restore from version |
| **VersionDiff.tsx** | (props) | Show diff between versions |
| **VersionHistory.tsx** | GET /version-history/zman/:key | List version history |
| **WeeklyPreviewDialog.tsx** | POST /publisher/zmanim/preview-week | 7-day preview modal |

---

### DSL Editor (`/editor/`)

| Component | Purpose |
|-----------|---------|
| **CodeMirrorDSLEditor.tsx** | Modern CodeMirror-based editor (primary) |
| **DSLEditor.tsx** | Main DSL editor wrapper with preview |
| **DSLEditor.legacy.tsx** | Legacy editor (fallback) |
| **DSLReferencePanel.tsx** | Reference panel for DSL syntax |
| **ContextualTooltip.tsx** | Context-aware tooltips in editor |
| **FormulaEditorPage.tsx** | Full-page formula editor layout |
| **HalachicNotesEditor.tsx** | Edit halachic notes/sources |
| **HumanErrorDisplay.tsx** | User-friendly error messages |
| **QuickInsertChip.tsx** | Quick insert chips for formula parts |

---

### Formula Builder (`/formula-builder/`)

Visual drag-and-drop formula construction.

| Component | Purpose |
|-----------|---------|
| **FormulaBuilder.tsx** | Main visual builder |
| **AIGeneratePanel.tsx** | AI formula generation panel |
| **BaseTimeSelector.tsx** | Select base times (sunrise, sunset) |
| **MethodCard.tsx** | Method selection card |
| **FixedOffsetForm.tsx** | Fixed time offset form |
| **FixedZmanForm.tsx** | Fixed zman reference form |
| **ProportionalHoursForm.tsx** | Proportional hours (shaos zmaniyos) |
| **SolarAngleForm.tsx** | Solar angle calculation form |
| **CalculationPreview.tsx** | Live calculation preview |
| **DayArcDiagram.tsx** | Sun arc visualization |
| **FormulaPreview.tsx** | Formula preview with breakdown |

---

### Onboarding (`/onboarding/`)

Multi-step publisher setup wizard.

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **OnboardingWizard.tsx** | POST /onboarding/init, /publish | Main wizard container |
| **WizardProgress.tsx** | (props) | Progress indicator |
| **WelcomeStep.tsx** | (props) | Welcome screen |
| **CustomizeZmanimStep.tsx** | GET /master-registry | Zmanim selection |
| **CoverageSetupStep.tsx** | GET /localities/search | Coverage configuration |
| **ReviewPublishStep.tsx** | POST /onboarding/publish | Final review and publish |

---

### Shared Components (`/shared/`)

Reusable across all user roles.

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **LocalityPicker.tsx** | GET /localities/search | Smart location search with geolocation |
| **LocationSearch.tsx** | GET /localities/search | Location search UI with suggestions |
| **LocationMapView.tsx** | (props) | Location display with map |
| **CoveragePreviewMap.tsx** | GET /geo/boundaries | Interactive coverage map (MapLibre) |
| **CoverageIndicator.tsx** | GET /publisher/coverage | Coverage areas popover for regional publishers |
| **BilingualInput.tsx** | (props) | Hebrew/English input pair |
| **ZmanName.tsx** | (props) | Display zman name (Hebrew+English) |
| **HighlightedFormula.tsx** | (props) | DSL formula with syntax highlighting |
| **InfoTooltip.tsx** | (props) | Info icon with tooltip |
| **PrimitivesTable.tsx** | GET /categories/primitives | Astronomical primitives reference |
| **ProfileDropdown.tsx** | (context) | User profile menu |
| **UserContextMenu.tsx** | (context) | Role-based navigation menu |
| **UserSettingsModal.tsx** | (context) | User preferences modal |
| **UnifiedSettingsPanel.tsx** | (context) | Display/preferences settings panel |
| **DisplaySettingsToggle.tsx** | (context) | Display preferences toggles |
| **LanguageToggle.tsx** | (context) | EN/עב language toggle (controls date format, zman names) |
| **PreviewDatePicker.tsx** | GET /calendar/hebrew-date, /calendar/gregorian-date | Language-aware date picker (Gregorian/Hebrew) |
| **PreviewToolbar.tsx** | usePreviewToolbar hook | Unified toolbar: locality picker, date picker, language toggle, coverage indicator |
| **DevModeBanner.tsx** | (env) | Development mode indicator |
| **Footer.tsx** | (static) | Site footer |
| **PublisherCard.tsx** | (props) | Publisher info card |

#### Tags Components (`/shared/tags/`)

| Component | Purpose |
|-----------|---------|
| **TagChip.tsx** | Tag display chip with colors |
| **TagFilterDropdown.tsx** | Filter zmanim by tags |
| **TagManager.tsx** | Full tag management UI |
| **TagSelector.tsx** | Select tags from list |
| **TagSelectorWithNegation.tsx** | Tag selector with exclude support |
| **useTags.ts** | Hook for tag selection state |

---

### Public Zmanim Display (`/zmanim/`)

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **DatePickerDropdown.tsx** | (props) | Calendar picker for date |
| **FormulaExplanation.tsx** | (props) | Plain-language formula explanation |
| **FormulaPanel.tsx** | (props) | Formula editor with explanation |

---

### Preview Components (`/preview/`)

| Component | Purpose |
|-----------|---------|
| **DayColumn.tsx** | Single day zmanim display |
| **WeeklyPreview.tsx** | Week zmanim grid |
| **MonthPreview.tsx** | Month-long zmanim preview |

---

### Registry Browser (`/registry/`)

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **MasterZmanDetailModal.tsx** | GET /publisher/registry/master/:id/documentation | Master zman documentation modal |
| **MasterDocumentationContent.tsx** | (props) | Shared master documentation content (used by both modals) |
| **PublisherZmanDetailModal.tsx** | GET /publisher/registry/publisher-zman/:id/documentation | Publisher zman documentation modal with master section |
| **RegistryPublisherBrowser.tsx** | GET /publisher/registry/publishers, /publishers/:id/zmanim, /coverage/:id, POST /registry/link, /registry/copy | Browse other publishers' zmanim with link/copy actions |

---

### Admin Components (`/admin/`)

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **AdminLocalityEditDialog.tsx** | PUT /admin/localities/:id | Edit locality coordinates |
| **ImpersonationBanner.tsx** | (context) | Banner when impersonating |
| **PendingRequests.tsx** | GET /admin/requests | List pending requests |
| **RegistrationReview.tsx** | GET/PUT /admin/registrations | Review new publishers |
| **ZmanRegistryForm.tsx** | POST/PUT /master-registry | Master registry management |

---

### Home/Landing (`/home/`)

| Component | Purpose |
|-----------|---------|
| **RoleNavigation.tsx** | Role-based navigation (Public/Publisher/Admin) |

---

### Audit Log Components (`/audit/`)

Timeline-based audit log visualization for tracking publisher activity.

| Component | APIs Used | Purpose |
|-----------|-----------|---------|
| **AuditEventCard.tsx** | (props) | Single event card with timeline indicator, actor, and description |
| **AuditEventList.tsx** | (props) | Timeline view grouping events by date |
| **AuditFilters.tsx** | (props) | Filter controls: resource type, action, date range |
| **AuditEventDetailModal.tsx** | (props) | Full event details with diff view |
| **AuditDiff.tsx** | (props) | Before/after comparison for changes |
| **ExportButton.tsx** | POST /publisher/audit-logs/export | Export logs as CSV or JSON |

**Page:** `/publisher/audit` - Publisher audit log page with filtering and pagination

---

### UI Primitives (`/ui/`)

shadcn/ui components (25 total):

accordion, alert-dialog, alert, avatar, badge, button, card, checkbox, color-badge, command, dialog, dropdown-menu, input, label, popover, scroll-area, select, sheet, slider, switch, tabs, textarea, toggle-group, tooltip

---

## API Client Pattern (REQUIRED)

```tsx
'use client';
import { useApi } from '@/lib/api-client';

export function Component() {
  const api = useApi();

  // Auth + X-Publisher-Id header
  const data = await api.get<DataType>('/publisher/profile');

  // No auth (public)
  const countries = await api.public.get('/countries');

  // Auth only (admin)
  const stats = await api.admin.get('/admin/stats');
}
```

**Compliance:** 98/100 (98%)
**Exceptions:**
- `CoverageMapViewGL.tsx` - MapLibre tile URLs (third-party)
- `LogoUpload.tsx` - Blob conversion (needs migration)

---

## React Query Pattern (REQUIRED)

```tsx
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';

// Query
const { data, isLoading, error } = usePublisherQuery<DataType>(
  'query-key',
  '/publisher/endpoint',
  { enabled: !!dependency }
);

// Mutation
const mutation = usePublisherMutation<Result, Payload>(
  '/publisher/endpoint',
  'POST',
  { invalidateKeys: ['query-key'] }
);
```

**Migration Status:** 60% complete (40 components remaining)

---

## Key Hooks (`/lib/hooks/`)

### Data Fetching

| Hook | Purpose |
|------|---------|
| `usePublisherQuery()` | Query with publisher context |
| `useGlobalQuery()` | Query without publisher context |
| `usePublisherMutation()` | Mutation with auto-invalidation |
| `useDeleteMutation()` | Delete with ID in path |
| `useDynamicMutation()` | Dynamic endpoint mutations |

### Zmanim Management (`useZmanimList.ts`)

| Hook | Purpose |
|------|---------|
| `useZmanimList()` | Get all publisher zmanim |
| `useZmanDetails()` | Get single zman |
| `useCreateZman()` | Create new zman |
| `useUpdateZman()` | Update zman (smart cache) |
| `useDeleteZman()` | Delete zman |
| `useRestoreZman()` | Restore soft-deleted |
| `usePreviewFormula()` | Preview formula |
| `usePreviewWeek()` | Preview week |
| `useValidateFormula()` | Validate DSL |
| `useMasterZmanim()` | Master registry |
| `useMasterZmanimGrouped()` | Grouped by category |
| `usePublisherZmanTags()` | Get zman tags |
| `useUpdatePublisherZmanTags()` | Update tags |

### Other Hooks

| Hook | Purpose |
|------|---------|
| `useLocality()` | Fetch single locality |
| `useLocationSearch()` | Search with debounce |
| `useUserRoles()` | Admin/publisher roles |
| `useTimeCategories()` | Time categories |
| `usePublisherCoverage()` | Coverage CRUD |
| `usePublisherSnapshots()` | Snapshot management |
| `useDebounce()` | Debounce values |

---

## Providers

### PublisherContext (`/providers/PublisherContext.tsx`)

```tsx
const {
  selectedPublisherId,
  selectedPublisher,
  setSelectedPublisherId,
  isImpersonating,
  publishers
} = usePublisherContext();
```

**Features:**
- Multi-publisher routing
- Admin impersonation (sessionStorage)
- Auto-invalidates React Query on publisher change

### PreferencesContext (`/lib/contexts/PreferencesContext.tsx`)

```tsx
const {
  preferences,
  setLocality,
  setTheme,
  setLanguage,
  setShowSeconds,
  setRoundingMode
} = usePreferences();
```

**Features:**
- Cookie persistence
- Cross-tab sync via CustomEvent
- localStorage migration

---

## Design Token Compliance (100%)

```tsx
// REQUIRED - Design tokens
className="text-foreground bg-card border-border"
className="text-primary hover:text-primary/80"
className="text-muted-foreground"

// FORBIDDEN - Hardcoded colors
className="text-[#1e3a5f]"
style={{ color: '#ff0000' }}
```

---

## Time Formatting (12-hour ONLY)

```tsx
import { formatTime, formatTimeShort } from '@/lib/utils';

formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
```

---

## Clerk isLoaded Pattern (95% Compliant)

```tsx
const { isLoaded, isSignedIn, user } = useUser();

if (!isLoaded) return <Loader2 className="animate-spin" />;
if (!isSignedIn) redirect('/sign-in');
// NOW safe to use user/token
```

---

## Component File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.tsx | `ZmanCard.tsx` |
| Hooks | camelCase.ts | `useZmanimList.ts` |
| Utils | kebab-case.ts | `time-format.ts` |

---

## Import Order

```tsx
import { useState, useEffect } from 'react';          // 1. React/framework
import { useUser } from '@clerk/nextjs';               // 2. Third-party
import { useApi } from '@/lib/api-client';             // 3. Internal
import { Button } from '@/components/ui/button';       // 4. Components
import type { Publisher } from '@/types';              // 5. Types
```

---

## Layout Pattern (Portal Layouts)

```tsx
<div className="min-h-screen flex flex-col bg-background text-foreground">
  {/* Header - Fixed height */}
  <header className="flex-none bg-card border-b border-border">
    ...
  </header>

  {/* Navigation - Hidden scrollbar */}
  <nav className="flex-none bg-card/50 border-b border-border">
    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
      ...
    </div>
  </nav>

  {/* Main Content - Fills remaining */}
  <main className="flex-1">
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  </main>
</div>
```

---

## Recent Changes (2025-12)

- **2025-12-26:** Added Audit Log components and publisher audit page
  - Created `/components/audit/` with 6 components for audit log visualization
  - Timeline-based event display with date grouping and relative timestamps
  - Filters for resource type, action type, and date range with presets
  - Event detail modal with before/after diff visualization
  - Export functionality for CSV and JSON formats
  - Added `/publisher/audit` page accessible from navigation
  - Added TypeScript types in `/lib/types/audit.ts`
- **2025-12-24:** Added WeeklyCalendarSelectionDialog for weekly calendar PDF export
  - Dialog allows selection of which zman types to include (published always included, draft/optional/hidden optional)
  - Integrated into WeekPreview component with "Print Calendar" button
  - Downloads PDF with filename format: Zmanim_Weekly_[Location]_[Date].pdf
  - Shows counts for each zman category and total count preview
- **2025-12-22:** Added PreviewToolbar unified toolbar component (Story 10 - Tasks 2.1-2.5)
  - Combines LocalityPicker, PreviewDatePicker, LanguageToggle, and CoverageIndicator into one reusable toolbar
  - Replaces individual implementations across algorithm, registry, and primitives pages
  - State management via usePreviewToolbar hook with PreferencesContext integration
  - Enables global publisher flow: hides coverage indicator when isGlobal=true
  - LocalityPicker searches all localities worldwide for global publishers (no coverage filtering)
- **2025-12-22:** Added CoverageIndicator component for showing coverage areas in a popover (Task 2.4)
  - Displays list of coverage areas with locality counts
  - Shows total localities and link to manage coverage page
  - Hidden for global publishers (isGlobal=true)
  - Reusable in PreviewToolbar for algorithm and registry pages
- **2025-12-22:** Added PreviewDatePicker component for language-aware date selection (Task 2.3)
  - Displays Gregorian calendar when language='en', Hebrew calendar when language='he'
  - Internal storage always uses ISO format (YYYY-MM-DD) for consistency
  - Uses public API endpoints for Hebrew/Gregorian date conversion
  - Includes Hebrew numeral utilities (toHebrewNumerals, toHebrewYear)
  - Reusable across all preview toolbars (algorithm, registry, primitives, admin)
- **2025-12-22:** Added LanguageToggle component for unified EN/עב language switching (Task 2.2)
  - Reusable component controls date format, zman names, and descriptions
  - Integrates with PreferencesContext for global language state
  - Will replace inline toggle implementations in algorithm, registry, and primitives pages
- **2025-12-22:** Added global publisher support (Story 10 - Tasks 1.1-1.5)
  - Database migration adds is_global column to publishers table
  - API endpoint PUT /publisher/settings/global-coverage for toggling global flag
  - Coverage mutations blocked when is_global=true (returns 400 error)
  - Coverage GET endpoint returns is_global flag with coverage list
  - Coverage page UI shows GlobalCoverageBanner when enabled
  - Coverage page allows toggling between global and regional coverage modes
- **2025-12-22:** Added ZmanimReportDialog for PDF report generation (Story 11.6)
  - Creates PDF with zmanim calculations, location details, and glossary
  - Accessible from algorithm page dropdown menu
- **2025-12-22:** Migrated zman addition flow from algorithm page to registry (Story 11.5)
  - Removed MasterZmanPicker, PublisherZmanPicker, and Add Zman dialog from algorithm page
  - Added "Browse Registry" button to algorithm page that navigates to registry
  - Added "Request Addition" button to registry page with RequestZmanModal integration
- **2025-12-22:** Added PublisherZmanDetailModal and MasterDocumentationContent for publisher zman docs (Story 11.4)
- **2025-12-22:** Added RegistryPublisherBrowser for browsing/linking/copying publisher zmanim (Story 11.3)
- **2025-12-22:** Added MasterZmanDetailModal for viewing master zman documentation (Story 11.2)
- **2025-12-21:** Updated ImportSnapshotDialog with better error handling
- **2025-12-20:** Added DeletedZmanimDialog for soft-delete management
- **2025-12-19:** Enhanced TagSelectorWithNegation for exclusion support
- **2025-12-18:** Added PublisherSelectionModal (blocking selection)
- **2025-12-07:** Enhanced LocalityPicker with geolocation support
- **2025-12-02:** 100% design token compliance achieved

---

## Known Issues

- `CoverageMapViewGL.tsx:404`: Raw fetch for MapLibre tiles (exempted)
- `LogoUpload.tsx:150`: Raw fetch for blob conversion (needs migration)
- React Query migration 60% complete

---

## Testing

```bash
cd tests && npx playwright test
```

Component tests use Playwright E2E for integration testing.
