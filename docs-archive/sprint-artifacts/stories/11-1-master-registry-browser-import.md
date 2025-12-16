# Story 11.1: Master Registry Browser & Import Flow

Status: Ready for Development

## Story

As a publisher,
I want to browse the master zmanim registry with filters and search, see live preview times, and import zmanim with one click,
So that I can quickly find and add canonical zmanim to my algorithm without writing DSL from scratch.

## Context

This story delivers the core Master Registry Browser interface - the primary onboarding accelerator for new publishers. Currently, publishers must write DSL formulas from scratch with only documentation as a guide. This is intimidating and error-prone. The Master Registry Browser transforms the experience by providing:

1. **Visual Discovery** - Browse 172+ canonical zmanim with real-world examples
2. **Live Preview** - See calculated times for any location/date before importing
3. **One-Click Import** - Add master zmanim to your catalog without writing code
4. **Smart Filtering** - Find zmanim by category, shita, or custom search
5. **Duplicate Prevention** - Impossible to accidentally import the same zman twice

**Why This Matters:**
- **Reduces onboarding time** from 5+ days to 2 days (new publishers can publish their first zman faster)
- **Increases confidence** - Publishers see working formulas with preview times before importing
- **Prevents errors** - Pre-validated master formulas eliminate syntax errors
- **Reduces support burden** - "How do I write a DSL formula?" questions drop significantly

**Prerequisites:**
- Story 11.0 (Data Foundation) must be complete:
  - Master registry documentation fields populated (100% coverage)
  - Database schema extended with `shita`, `category`, documentation fields
  - Unique constraint on `(publisher_id, master_zmanim_id)` in place
  - Publisher 1 data integrity audit complete (all master linkages correct)

**User Journey:**
1. Publisher navigates to `/publisher/registry` (default: Master Registry tab)
2. Selects location (e.g., "Jerusalem, Israel") and date (default: today)
3. Filters by category (e.g., "Alos") and/or shita (e.g., "GRA")
4. Searches for "Alos Hashachar"
5. Sees zman cards with DSL formula, preview time, category/shita badges
6. Clicks Info (ℹ️) to view comprehensive documentation (Story 11.2)
7. Clicks "Import Zman" button
8. Redirected to `/publisher/algorithm?focus=alos_hashachar` with green highlight
9. Imported zman is now part of their catalog, ready to customize or publish

**Technical Architecture:**
- **Frontend:** Next.js 16 page at `/publisher/registry` with tab navigation
- **Backend:** Go API endpoints with 6-step handler pattern, PublisherResolver
- **Database:** SQLc queries with ownership checks, duplicate prevention logic
- **Caching:** Redis 24-hour TTL for master registry list, preview calculations
- **Performance:** Pagination (50 items), lazy loading, indexed queries

## Acceptance Criteria

### AC1: Page Structure & Navigation

**Given** I am logged in as a verified publisher
**When** I navigate to `/publisher/registry`
**Then** I see the Master Registry tab (active by default) with:
- Paginated table/card view (50 items per page)
- Shared header controls: Location picker, date selector, location badge
- Filter panel (sidebar on desktop, drawer on mobile)
- Search box for zman name or formula keywords
- Zman cards showing: name (Hebrew + English), DSL formula, preview time, category badge, shita badge, status

**Validation:**
- URL: `/publisher/registry` loads without errors
- Default tab: "Master Registry" is active (blue underline or highlight)
- Header controls: Location picker (autocomplete), date picker (calendar), location badge visible
- Filter panel: Sidebar on desktop (≥1024px), drawer on mobile/tablet (<1024px)
- Search box: Placeholder text "Search zmanim by name or formula"
- Pagination: Shows "Page 1 of X" with next/previous buttons

---

### AC2: Location Selection & Preview Times

**Given** I am viewing the master registry
**When** I select a location from the global locality dropdown (e.g., "Jerusalem, Israel")
**Then** all preview times recalculate for that location
**And** the location badge updates: "Selected: Jerusalem, Israel"
**And** location selection persists across tab switches

**Validation:**
- Location picker: Autocomplete dropdown with geo_localities data (4M+ localities)
- Location selection triggers API call: `GET /api/v1/publisher/registry/master?locality_id={id}&date={date}`
- Preview times update within 500ms per zman (concurrent calculation)
- Location badge: Shows "Selected: {locality_name}, {country}" with flag icon
- Persistence: Switching to Publisher Examples tab and back retains location selection
- Edge case: If no location selected, preview times show "Select a location to preview"

---

### AC3: Date Selection & Preview Times

**Given** I am viewing the master registry
**When** I select a date (default: today)
**Then** all preview times recalculate for that date
**And** date selection persists across tab switches

**Validation:**
- Date picker: Calendar component (shadcn/ui) with default value `today`
- Date selection triggers same API call with `date={YYYY-MM-DD}`
- Preview times update within 500ms per zman
- Date persistence: Switching tabs and back retains date selection
- Date format: Display as "Friday, December 22, 2025" in header badge
- Edge case: Future dates (e.g., today + 365 days) work correctly

---

### AC4: Filtering by Category, Shita, and Status

**Given** I am viewing the master registry
**When** I open the filter panel
**Then** I can filter by:
- Category (multi-select checkboxes: Alos, Shema, Tefilla, Chatzos, Mincha, Tzais, etc.)
- Shita (multi-select checkboxes: GRA, MGA, Baal Hatanya, Rabbeinu Tam, Geonim, etc.)
- Status (radio: All / Available to Import / Already Imported)

**And** active filter chips appear showing current selections
**And** I can click chip "×" to remove individual filter
**And** I can click "Clear All Filters" to reset
**And** results update immediately (no "Apply" button)

**Validation:**
- Filter panel: Collapsible sidebar (desktop) or drawer (mobile)
- Category checkboxes: All valid categories from `master_zmanim_registry.category` enum
- Shita checkboxes: All valid shitas from `master_zmanim_registry.shita` enum
- Status radio: "All" (default), "Available to Import", "Already Imported"
- Filter chips: Appear below search box with "(×)" close button
- "Clear All Filters" button: Resets all filters to default state
- Immediate update: Results refresh <300ms after filter change (no debounce needed)
- API params: `?category=ALOS,SHEMA&shita=GRA,MGA&status=available`

---

### AC5: Search Functionality

**Given** I am viewing the master registry
**When** I type in the search box (e.g., "Alos Hashachar")
**Then** results are filtered to zmanim matching:
- Zman name (Hebrew or English)
- DSL formula keywords
- zman_key reference

**And** search updates immediately (debounced 300ms)
**And** search is case-insensitive

**Validation:**
- Search box: Debounced 300ms to avoid excessive API calls
- Search scope: `hebrew_name`, `english_name`, `formula_dsl`, `zman_key`
- Case-insensitive: "alos" matches "Alos Hashachar", "ALOS", "alos_hashachar"
- Partial match: "solar" matches "solar(-16.1)", "solar(-18)", etc.
- API param: `?search=alos`
- Empty results: Show message "No master zmanim match your search. Try different keywords."

---

### AC6: Zman Card Display

**Given** I am viewing a master zman card
**When** the card is displayed
**Then** I see:
- DSL formula with syntax highlighting (CodeMirror)
- Preview time in 12-hour format (e.g., "5:24 AM")
- Brief one-line description
- Category badge (color-coded: Alos/Indigo, Shema/Blue, Chatzos/Yellow, Mincha/Orange, Tzais/Purple)
- Shita badge (color-coded: GRA/Blue, MGA/Green, Baal Hatanya/Purple, etc.)
- Status indicator: Available (🟢 green) or Imported (✓ blue)
- Info button (ℹ️)
- Import button (enabled or disabled based on ownership)

**Validation:**
- Card layout: 2-column grid on desktop, 1-column on mobile
- DSL formula: CodeMirror syntax highlighting (primitives: blue, functions: green, numbers: orange)
- Preview time: Format "h:mm A" (e.g., "5:24 AM", not "05:24:00")
- Description: From `master_zmanim_registry.description` (one-line summary)
- Category badge: Indigo (#4F46E5) for Alos, Blue (#3B82F6) for Shema, etc.
- Shita badge: Blue for GRA, Green for MGA, Purple for Baal Hatanya, etc.
- Status indicator: Green circle + "Available" or Blue checkmark + "Imported"
- Info button: Circular (ℹ️) icon button in top-right corner of card
- Import button: Primary button "Import Zman" (enabled) or "Imported" (disabled, opacity-50)

---

### AC7: Import Zman - Success Flow

**Given** I have NOT imported a specific master zman
**When** I click the "Import Zman" button
**Then** a `publisher_zmanim` record is created with:
- `master_zmanim_id` set to the master zman ID
- `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl` copied from master
- `linked_from_publisher_zman_id` is NULL (direct master import)
- `copied_from_publisher_id` is NULL (direct master import)

**And** I am redirected to `/publisher/algorithm?focus={zman_key}`
**And** the newly imported zman is highlighted with green border/animation
**And** toast notification shows: "Alos Hashachar imported successfully"

**Validation:**
- API endpoint: `POST /api/v1/publisher/registry/import` with body `{ master_zmanim_id: 123 }`
- Database insert: `INSERT INTO publisher_zmanim (...) VALUES (...)`
- Copied fields: `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl`
- Master linkage: `master_zmanim_id` = source master zman ID
- Provenance fields: `linked_from_publisher_zman_id` = NULL, `copied_from_publisher_id` = NULL
- Redirect: `router.push('/publisher/algorithm?focus=alos_hashachar')`
- Highlight: CSS class `.highlight-zman` applied for 3 seconds (green border, fade-in animation)
- Toast: Success notification with zman name (Hebrew or English)

---

### AC8: Import Zman - Duplicate Prevention

**Given** I have ALREADY imported a specific master zman
**When** I view that master zman card
**Then** the "Import Zman" button is disabled (opacity-50, cursor-not-allowed)
**And** status shows "Imported ✓" badge
**And** hovering over disabled button shows tooltip: "You already imported this master zman"

**Validation:**
- Ownership check: SQLc query `CheckPublisherHasMasterZman` returns true if publisher has `publisher_zmanim` with same `master_zmanim_id`
- UI state: Button disabled, status badge shows "Imported ✓" (blue checkmark)
- Tooltip: Hover over disabled button shows "You already imported this master zman"
- API validation: If client logic bypassed, server returns `400 Bad Request` with error "You already have this master zman"
- Database constraint: Unique constraint on `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL` prevents duplicates at DB level
- Edge case: If publisher deleted the zman (`deleted_at IS NOT NULL`), they can re-import it

---

### AC9: Empty State Handling

**Given** no master zmanim match my active filters
**When** results are empty
**Then** I see helpful empty state message: "No master zmanim match your filters. Try adjusting your filters."

**Validation:**
- Empty state: Shows when API returns `{ items: [], total: 0 }`
- Message: "No master zmanim match your filters. Try adjusting your filters."
- Suggestions: "Try: Clearing filters, searching different keywords, or selecting a different category"
- Empty state icon: Magnifying glass or filter icon
- Actionable: "Clear All Filters" button visible in empty state

---

### AC10: Performance Requirements

**Given** the master registry page loads
**When** initial render completes
**Then** page load time is <2 seconds (p95)
**And** preview calculations complete in <500ms per zman
**And** search/filter operations complete in <300ms

**Validation:**
- Initial page load: <2 seconds (p95) from navigation to first contentful paint
- Preview calculations: <500ms per zman (concurrent calculation using calculation engine)
- Search/filter: <300ms from input change to results update
- API response time: <1 second for `GET /api/v1/publisher/registry/master`
- Caching: Redis 24-hour TTL for master registry list (reduces DB queries)
- Pagination: Only load 50 items at a time (not all 172+ zmanim)
- Lazy loading: Zman cards render as they scroll into view (React Intersection Observer)

---

## Tasks / Subtasks

### Task 1: Backend API - Master Registry Listing

**1.1 Create API Endpoint: `GET /api/v1/publisher/registry/master`**

- [ ] 1.1.1 Create handler: `api/internal/handlers/registry_master.go`
  - [ ] Handler function: `ListMasterZmanimForRegistry(w, r)`
  - [ ] 6-step handler pattern:
    1. Resolve publisher: `pc := h.publisherResolver.MustResolve(w, r)`
    2. Parse query params: `locality_id`, `date`, `category`, `shita`, `status`, `search`, `page`, `limit`
    3. Validate inputs: locality_id > 0, date format YYYY-MM-DD, page ≥ 1, limit ∈ [10, 100]
    4. Call SQLc query: `ListMasterZmanimForRegistry(ctx, params)`
    5. Calculate preview times for each zman (concurrent goroutines)
    6. Respond JSON: `RespondJSON(w, r, http.StatusOK, response)`
  - [ ] Error handling: 400 for invalid params, 404 for invalid locality, 500 for calculation errors

- [ ] 1.1.2 Create SQLc query: `api/internal/db/queries/master_zmanim_registry.sql`
  ```sql
  -- name: ListMasterZmanimForRegistry :many
  SELECT
    mzr.id,
    mzr.zman_key,
    mzr.hebrew_name,
    mzr.english_name,
    mzr.description,
    mzr.formula_dsl,
    mzr.category,
    mzr.shita,
    mzr.created_at,
    -- Check if publisher already imported this master zman
    EXISTS(
      SELECT 1 FROM publisher_zmanim pz
      WHERE pz.publisher_id = $1
        AND pz.master_zmanim_id = mzr.id
        AND pz.deleted_at IS NULL
    ) AS already_imported
  FROM master_zmanim_registry mzr
  WHERE
    ($2::text IS NULL OR mzr.category = ANY($2::text[]))
    AND ($3::text IS NULL OR mzr.shita = ANY($3::text[]))
    AND (
      $4::text IS NULL
      OR mzr.hebrew_name ILIKE '%' || $4 || '%'
      OR mzr.english_name ILIKE '%' || $4 || '%'
      OR mzr.formula_dsl ILIKE '%' || $4 || '%'
      OR mzr.zman_key ILIKE '%' || $4 || '%'
    )
    AND (
      $5::text IS NULL
      OR ($5 = 'available' AND NOT EXISTS(SELECT 1 FROM publisher_zmanim WHERE publisher_id = $1 AND master_zmanim_id = mzr.id AND deleted_at IS NULL))
      OR ($5 = 'imported' AND EXISTS(SELECT 1 FROM publisher_zmanim WHERE publisher_id = $1 AND master_zmanim_id = mzr.id AND deleted_at IS NULL))
    )
  ORDER BY mzr.category, mzr.english_name
  LIMIT $6 OFFSET $7;
  ```

- [ ] 1.1.3 Wire route: `api/cmd/api/routes.go`
  ```go
  r.Route("/publisher/registry", func(r chi.Router) {
    r.Get("/master", handlers.ListMasterZmanimForRegistry)
  })
  ```

- [ ] 1.1.4 Run `cd api && sqlc generate`
- [ ] 1.1.5 Test manually: `curl -H "Authorization: Bearer {token}" -H "X-Publisher-Id: 2" "http://localhost:8080/api/v1/publisher/registry/master?locality_id=4993250&date=2025-12-22" | jq '.'`

---

### Task 2: Backend API - Import Master Zman

**2.1 Create API Endpoint: `POST /api/v1/publisher/registry/import`**

- [ ] 2.1.1 Create handler: `api/internal/handlers/registry_import.go`
  - [ ] Handler function: `ImportMasterZman(w, r)`
  - [ ] 6-step handler pattern:
    1. Resolve publisher: `pc := h.publisherResolver.MustResolve(w, r)`
    2. Parse body: `var req ImportMasterZmanRequest; json.NewDecoder(r.Body).Decode(&req)`
    3. Validate: `req.MasterZmanimID > 0`
    4. Duplicate check: Call SQLc query `CheckPublisherHasMasterZman`, return 400 if already exists
    5. Call SQLc query: `ImportMasterZman(ctx, params)` (inserts `publisher_zmanim`)
    6. Respond JSON: `RespondJSON(w, r, http.StatusCreated, response)`
  - [ ] Error handling: 400 for duplicate/invalid input, 404 for invalid master zman ID, 500 for DB errors

- [ ] 2.1.2 Create SQLc queries: `api/internal/db/queries/publisher_zmanim.sql`
  ```sql
  -- name: CheckPublisherHasMasterZman :one
  SELECT EXISTS(
    SELECT 1 FROM publisher_zmanim
    WHERE publisher_id = $1
      AND master_zmanim_id = $2
      AND deleted_at IS NULL
  ) AS has_master_zman;

  -- name: ImportMasterZman :one
  INSERT INTO publisher_zmanim (
    publisher_id,
    master_zmanim_id,
    zman_key,
    hebrew_name,
    english_name,
    description,
    formula_dsl,
    linked_from_publisher_zman_id,
    copied_from_publisher_id,
    created_at,
    updated_at
  )
  SELECT
    $1 AS publisher_id,
    mzr.id AS master_zmanim_id,
    mzr.zman_key,
    mzr.hebrew_name,
    mzr.english_name,
    mzr.description,
    mzr.formula_dsl,
    NULL AS linked_from_publisher_zman_id,
    NULL AS copied_from_publisher_id,
    NOW() AS created_at,
    NOW() AS updated_at
  FROM master_zmanim_registry mzr
  WHERE mzr.id = $2
  RETURNING *;
  ```

- [ ] 2.1.3 Wire route: `api/cmd/api/routes.go`
  ```go
  r.Route("/publisher/registry", func(r chi.Router) {
    r.Post("/import", handlers.ImportMasterZman)
  })
  ```

- [ ] 2.1.4 Run `cd api && sqlc generate`
- [ ] 2.1.5 Test manually: `curl -X POST -H "Authorization: Bearer {token}" -H "X-Publisher-Id: 2" -H "Content-Type: application/json" -d '{"master_zmanim_id": 123}' http://localhost:8080/api/v1/publisher/registry/import | jq '.'`

---

### Task 3: Frontend - Registry Page Structure

**3.1 Create Registry Page: `web/app/publisher/registry/page.tsx`**

- [ ] 3.1.1 Create file with tab navigation structure:
  ```tsx
  'use client';

  import { useState } from 'react';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import RegistryMasterBrowser from '@/components/registry/RegistryMasterBrowser';
  import RegistryPublisherBrowser from '@/components/registry/RegistryPublisherBrowser';
  import RegistryLocationPicker from '@/components/registry/RegistryLocationPicker';
  import { useSearchParams } from 'next/navigation';

  export default function RegistryPage() {
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'master';
    const [selectedLocality, setSelectedLocality] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Zmanim Registry</h1>

        {/* Shared Header Controls */}
        <div className="mb-6 flex gap-4 items-center">
          <RegistryLocationPicker
            value={selectedLocality}
            onChange={setSelectedLocality}
          />
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
          />
          {selectedLocality && (
            <LocationBadge localityId={selectedLocality} />
          )}
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="master">Master Registry</TabsTrigger>
            <TabsTrigger value="publishers">Publisher Examples</TabsTrigger>
          </TabsList>

          <TabsContent value="master">
            <RegistryMasterBrowser
              localityId={selectedLocality}
              date={selectedDate}
            />
          </TabsContent>

          <TabsContent value="publishers">
            <RegistryPublisherBrowser
              localityId={selectedLocality}
              date={selectedDate}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  ```

- [ ] 3.1.2 Add page metadata for SEO
- [ ] 3.1.3 Add loading state skeleton

---

### Task 4: Frontend - Master Registry Browser Component

**4.1 Create Component: `web/components/registry/RegistryMasterBrowser.tsx`**

- [ ] 4.1.1 Create component with filter panel, search, pagination
  ```tsx
  'use client';

  import { useState, useEffect } from 'react';
  import { useApi } from '@/lib/api-client';
  import RegistryFilters from './RegistryFilters';
  import ZmanCard from './ZmanCard';
  import { MasterZman } from '@/types/registry';

  interface Props {
    localityId: number | null;
    date: string;
  }

  export default function RegistryMasterBrowser({ localityId, date }: Props) {
    const api = useApi();
    const [zmanim, setZmanim] = useState<MasterZman[]>([]);
    const [filters, setFilters] = useState({ category: [], shita: [], status: 'all' });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      fetchZmanim();
    }, [localityId, date, filters, search, page]);

    async function fetchZmanim() {
      setLoading(true);
      try {
        const response = await api.get('/publisher/registry/master', {
          params: { locality_id: localityId, date, ...filters, search, page, limit: 50 }
        });
        setZmanim(response.data.items);
      } catch (error) {
        console.error('Failed to fetch master zmanim:', error);
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="flex gap-6">
        {/* Filter Panel (Sidebar) */}
        <RegistryFilters
          filters={filters}
          onFiltersChange={setFilters}
        />

        {/* Main Content */}
        <div className="flex-1">
          {/* Search Box */}
          <SearchInput value={search} onChange={setSearch} />

          {/* Zman Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {loading ? (
              <SkeletonCards count={6} />
            ) : zmanim.length === 0 ? (
              <EmptyState />
            ) : (
              zmanim.map(zman => (
                <ZmanCard
                  key={zman.id}
                  zman={zman}
                  localityId={localityId}
                  date={date}
                  onImport={handleImport}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <Pagination page={page} onPageChange={setPage} />
        </div>
      </div>
    );
  }
  ```

- [ ] 4.1.2 Implement search debouncing (300ms)
- [ ] 4.1.3 Add loading skeletons
- [ ] 4.1.4 Add empty state component

---

### Task 5: Frontend - Zman Card Component

**5.1 Create Component: `web/components/registry/ZmanCard.tsx`**

- [ ] 5.1.1 Create card with DSL formula, preview time, badges
  ```tsx
  'use client';

  import { useState } from 'react';
  import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import CodeMirror from '@uiw/react-codemirror';
  import { InfoIcon } from 'lucide-react';
  import { MasterZman } from '@/types/registry';

  interface Props {
    zman: MasterZman;
    localityId: number | null;
    date: string;
    onImport: (id: number) => void;
  }

  export default function ZmanCard({ zman, localityId, date, onImport }: Props) {
    const [previewTime, setPreviewTime] = useState<string | null>(null);

    useEffect(() => {
      if (localityId && date) {
        calculatePreviewTime();
      }
    }, [localityId, date]);

    async function calculatePreviewTime() {
      // Call calculation engine API
      const time = await api.post('/publisher/calculate', {
        formula_dsl: zman.formula_dsl,
        locality_id: localityId,
        date: date
      });
      setPreviewTime(time.data.result);
    }

    return (
      <Card className="relative">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold">{zman.hebrew_name}</h3>
              <p className="text-sm text-gray-600">{zman.english_name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => openDocModal(zman.id)}>
              <InfoIcon className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* DSL Formula */}
          <div className="mb-4">
            <label className="text-sm font-medium">Formula:</label>
            <CodeMirror
              value={zman.formula_dsl}
              height="50px"
              readOnly
              extensions={[dslLanguage()]}
            />
          </div>

          {/* Preview Time */}
          <div className="mb-4">
            <label className="text-sm font-medium">Preview Time:</label>
            <p className="text-2xl font-bold text-primary">
              {previewTime || 'Select a location'}
            </p>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-700">{zman.description}</p>

          {/* Badges */}
          <div className="flex gap-2 mt-4">
            <Badge variant="category" className={getCategoryColor(zman.category)}>
              {zman.category}
            </Badge>
            <Badge variant="shita" className={getShitaColor(zman.shita)}>
              {zman.shita}
            </Badge>
            <Badge variant="status" className={zman.already_imported ? 'bg-blue-500' : 'bg-green-500'}>
              {zman.already_imported ? 'Imported ✓' : 'Available 🟢'}
            </Badge>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            onClick={() => onImport(zman.id)}
            disabled={zman.already_imported}
            className="w-full"
            title={zman.already_imported ? 'You already imported this master zman' : ''}
          >
            {zman.already_imported ? 'Imported' : 'Import Zman'}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  ```

- [ ] 5.1.2 Add syntax highlighting for DSL (reuse from algorithm editor)
- [ ] 5.1.3 Add category/shita color coding
- [ ] 5.1.4 Add disabled button tooltip

---

### Task 6: Frontend - Filter Panel Component

**6.1 Create Component: `web/components/registry/RegistryFilters.tsx`**

- [ ] 6.1.1 Create filter panel with category, shita, status filters
  ```tsx
  'use client';

  import { Checkbox } from '@/components/ui/checkbox';
  import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { X } from 'lucide-react';

  interface Props {
    filters: { category: string[], shita: string[], status: string };
    onFiltersChange: (filters: any) => void;
  }

  export default function RegistryFilters({ filters, onFiltersChange }: Props) {
    const categories = ['ALOS', 'SHEMA', 'TEFILLA', 'CHATZOS', 'MINCHA', 'TZAIS'];
    const shitas = ['GRA', 'MGA', 'BAAL_HATANYA', 'RABBEINU_TAM', 'GEONIM'];

    function toggleCategory(category: string) {
      const newCategories = filters.category.includes(category)
        ? filters.category.filter(c => c !== category)
        : [...filters.category, category];
      onFiltersChange({ ...filters, category: newCategories });
    }

    function clearFilters() {
      onFiltersChange({ category: [], shita: [], status: 'all' });
    }

    return (
      <div className="w-64 border-r pr-6">
        <h2 className="text-lg font-bold mb-4">Filters</h2>

        {/* Active Filter Chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.category.map(cat => (
            <Badge key={cat} variant="secondary">
              {cat} <X onClick={() => toggleCategory(cat)} className="ml-1 h-3 w-3 cursor-pointer" />
            </Badge>
          ))}
        </div>

        {/* Clear All Button */}
        {(filters.category.length > 0 || filters.shita.length > 0) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All Filters
          </Button>
        )}

        {/* Category Filter */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Category</h3>
          {categories.map(cat => (
            <div key={cat} className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={filters.category.includes(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              />
              <label>{cat}</label>
            </div>
          ))}
        </div>

        {/* Shita Filter */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Shita</h3>
          {shitas.map(shita => (
            <div key={shita} className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={filters.shita.includes(shita)}
                onCheckedChange={() => toggleShita(shita)}
              />
              <label>{shita}</label>
            </div>
          ))}
        </div>

        {/* Status Filter */}
        <div>
          <h3 className="font-medium mb-2">Status</h3>
          <RadioGroup value={filters.status} onValueChange={(val) => onFiltersChange({ ...filters, status: val })}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" />
              <label>All</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="available" />
              <label>Available to Import</label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="imported" />
              <label>Already Imported</label>
            </div>
          </RadioGroup>
        </div>
      </div>
    );
  }
  ```

- [ ] 6.1.2 Make responsive (drawer on mobile)
- [ ] 6.1.3 Add filter count badges

---

### Task 7: Frontend - Location Picker Component

**7.1 Create Component: `web/components/registry/RegistryLocationPicker.tsx`**

- [ ] 7.1.1 Reuse existing locality autocomplete component
- [ ] 7.1.2 Add location badge display
- [ ] 7.1.3 Add persistence (localStorage or URL params)

---

### Task 8: Frontend - Import Handler

**8.1 Implement Import Function**

- [ ] 8.1.1 Add import handler in `RegistryMasterBrowser.tsx`
  ```tsx
  async function handleImport(masterZmanId: number) {
    try {
      const response = await api.post('/publisher/registry/import', {
        master_zmanim_id: masterZmanId
      });

      // Show success toast
      toast.success(`${response.data.hebrew_name} imported successfully`);

      // Redirect to algorithm page with focus
      router.push(`/publisher/algorithm?focus=${response.data.zman_key}`);
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error('You already have this master zman');
      } else {
        toast.error('Failed to import zman. Please try again.');
      }
    }
  }
  ```

- [ ] 8.1.2 Add optimistic UI updates (disable button immediately)
- [ ] 8.1.3 Add error handling with user-friendly messages

---

### Task 9: Frontend - Algorithm Page Focus Handling

**9.1 Modify Algorithm Page: `web/app/publisher/algorithm/page.tsx`**

- [ ] 9.1.1 Add URL param parsing for `?focus={zman_key}`
  ```tsx
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
  ```

- [ ] 9.1.2 Add CSS for highlight animation
  ```css
  .highlight-zman {
    @apply border-green-500 border-2 animate-in fade-in duration-500;
  }
  ```

- [ ] 9.1.3 Add `data-zman-key` attribute to zman cards in algorithm page

---

### Task 10: Testing

**10.1 Backend Integration Tests**

- [ ] 10.1.1 Test `GET /api/v1/publisher/registry/master` with various filters
- [ ] 10.1.2 Test `POST /api/v1/publisher/registry/import` success flow
- [ ] 10.1.3 Test duplicate import prevention (400 error)
- [ ] 10.1.4 Test database unique constraint enforcement
- [ ] 10.1.5 Test ownership check logic (already_imported flag)

**10.2 Frontend E2E Tests**

- [ ] 10.2.1 Test page navigation: Navigate to `/publisher/registry`
- [ ] 10.2.2 Test location selection and preview time update
- [ ] 10.2.3 Test date selection and preview time update
- [ ] 10.2.4 Test category filter (select "ALOS", verify results)
- [ ] 10.2.5 Test shita filter (select "GRA", verify results)
- [ ] 10.2.6 Test status filter (select "Available", verify results)
- [ ] 10.2.7 Test search (type "Alos", verify results)
- [ ] 10.2.8 Test import flow (click Import, verify redirect, verify highlight)
- [ ] 10.2.9 Test duplicate prevention (import same zman, verify button disabled)
- [ ] 10.2.10 Test empty state (apply filters with no matches, verify message)

**10.3 Performance Tests**

- [ ] 10.3.1 Measure page load time (<2 seconds)
- [ ] 10.3.2 Measure preview calculation time (<500ms per zman)
- [ ] 10.3.3 Measure search/filter response time (<300ms)
- [ ] 10.3.4 Test pagination performance (50 items per page)

---

## Technical Notes

### Backend Implementation Details

**API Endpoints:**
1. `GET /api/v1/publisher/registry/master`
   - Query params: `locality_id`, `date`, `category[]`, `shita[]`, `status`, `search`, `page`, `limit`
   - Returns: Paginated list of master zmanim with `already_imported` flag
   - Handler: 6-step pattern, PublisherResolver
   - Performance: Cached 24-hour TTL, indexed queries

2. `POST /api/v1/publisher/registry/import`
   - Body: `{ master_zmanim_id: number }`
   - Returns: Created `publisher_zmanim` record
   - Handler: 6-step pattern, duplicate check, validation
   - Duplicate prevention: SQLc query + unique constraint

**SQLc Queries:**
- `ListMasterZmanimForRegistry` - Main listing query with filters and ownership check
- `CheckPublisherHasMasterZman` - Duplicate check query
- `ImportMasterZman` - Insert `publisher_zmanim` from master

**Database Indexes (from Story 11.0):**
```sql
CREATE INDEX idx_master_zmanim_shita ON master_zmanim_registry(shita) WHERE shita IS NOT NULL;
CREATE INDEX idx_master_zmanim_category ON master_zmanim_registry(category) WHERE category IS NOT NULL;
CREATE UNIQUE INDEX idx_publisher_zmanim_master_unique
  ON publisher_zmanim(publisher_id, master_zmanim_id)
  WHERE deleted_at IS NULL;
```

**Caching Strategy:**
- Master registry list: 24-hour TTL (key: `registry:master:{publisher_id}:{filters}`)
- Preview calculations: 24-hour TTL per `locality_id:date:master_zman_id`
- Cache invalidation: When master registry updated (admin action)

---

### Frontend Implementation Details

**Components:**
- `web/app/publisher/registry/page.tsx` - Main registry page with tabs
- `web/components/registry/RegistryMasterBrowser.tsx` - Master registry tab
- `web/components/registry/ZmanCard.tsx` - Reusable zman card
- `web/components/registry/RegistryLocationPicker.tsx` - Shared location picker
- `web/components/registry/RegistryFilters.tsx` - Shared filter panel

**Syntax Highlighting:**
- Reuse CodeMirror DSL setup from algorithm editor
- Custom language mode for DSL primitives, functions, operators
- Color scheme: Primitives (blue), Functions (green), Numbers (orange)

**Responsive Design:**
- Desktop: 2-column zman cards, sidebar filter panel
- Tablet: 1-column zman cards, sidebar filter panel
- Mobile: 1-column zman cards, drawer filter panel (collapsible)

**Performance Optimizations:**
- Pagination: 50 items per page (not all 172+ zmanim)
- Lazy loading: Zman cards render as they scroll into view
- Debounced search: 300ms delay to avoid excessive API calls
- Concurrent preview calculations: Use `Promise.all()` for parallel requests

---

## Functional Requirements (FRs) Covered

This story covers the following FRs from Epic 11:

- **FR1:** Browse master zmanim (paginated)
- **FR2:** Search master zmanim (name/formula)
- **FR3:** Filter master zmanim (category/shita/tags/status)
- **FR4:** Select location for preview times
- **FR5:** Select date for preview
- **FR6:** Location/date persist across tabs
- **FR7:** DSL syntax highlighting
- **FR8:** Preview times (12-hour format)
- **FR9:** Status indicators (Available/Imported)
- **FR10:** Category badges
- **FR11:** Shita badges
- **FR16:** Import button creates publisher_zmanim
- **FR17:** Import button disabled if already imported
- **FR18:** Disabled button shows tooltip
- **FR19:** Already-imported shows badge
- **FR20:** Success redirect with focus param (partial - complete in Story 11.5)

---

## Prerequisites

**Must be complete before starting this story:**
- [x] Story 11.0: Data Foundation & Integrity Audit
  - Master registry documentation fields populated (100%)
  - Database schema extended (`shita`, `category`, `full_description`, etc.)
  - Unique constraint on `(publisher_id, master_zmanim_id)`
  - Publisher 1 data integrity verified

**Database readiness:**
- `master_zmanim_registry` table has all 172+ entries with complete documentation
- Indexes created: `idx_master_zmanim_shita`, `idx_master_zmanim_category`
- Unique constraint enforced: `idx_publisher_zmanim_master_unique`

---

## Definition of Done (DoD)

- [ ] All acceptance criteria validated (10 ACs)
- [ ] All tasks completed (10 tasks)
- [ ] Backend API endpoints implemented and tested
  - [ ] `GET /api/v1/publisher/registry/master` working
  - [ ] `POST /api/v1/publisher/registry/import` working
  - [ ] SQLc queries generated and verified
- [ ] Frontend components implemented and tested
  - [ ] Registry page loads without errors
  - [ ] Master Registry tab displays correctly
  - [ ] Filters work (category, shita, status)
  - [ ] Search works (debounced, case-insensitive)
  - [ ] Location/date selection updates preview times
  - [ ] Import flow works (button → redirect → highlight)
  - [ ] Duplicate prevention works (disabled button)
- [ ] Integration tests passing (backend)
- [ ] E2E tests passing (frontend)
- [ ] Performance tests passing (<2s page load, <500ms preview, <300ms search)
- [ ] Code review approved
- [ ] Documentation updated:
  - [ ] API documentation (Swagger/OpenAPI)
  - [ ] Component INDEX.md entries added
  - [ ] SQL queries INDEX.md entries added
- [ ] No TODO/FIXME comments in code
- [ ] No console.log statements (use proper logging)
- [ ] No raw `fetch()` calls (use `useApi()` hook)
- [ ] All TypeScript errors resolved
- [ ] All linting errors resolved
- [ ] Deployed to staging environment
- [ ] Manual QA completed (smoke test)
- [ ] Merged to `dev` branch

---

## Related Stories

**Dependencies:**
- Story 11.0: Data Foundation & Integrity Audit (MUST BE COMPLETE)

**Enables:**
- Story 11.2: Master Zman Comprehensive Documentation Modal (Info button)
- Story 11.3: Publisher Examples Browser & Link/Copy Flow (tab switching)
- Story 11.5: Request Addition Workflow & Algorithm Page Migration (redirect target)

**Related:**
- Story 4.8: Algorithm Editor (reuse DSL syntax highlighting)
- Story 10.5: Locality Picker (reuse location autocomplete)

---

## Story Points

**Estimated:** 13 points

**Breakdown:**
- Backend API (3 points): 2 endpoints, 3 SQLc queries, routing, error handling
- Frontend Components (5 points): Page, browser, cards, filters, location picker
- Preview Calculation Integration (2 points): Concurrent calculation, caching
- Import Flow & Redirect (1 point): Handler, toast, navigation
- Testing (2 points): Integration tests, E2E tests, performance tests

**Risk Factors:**
- Preview calculation performance (mitigated by caching, concurrent requests)
- Filter query complexity (mitigated by database indexes from Story 11.0)
- Duplicate prevention edge cases (mitigated by unique constraint + server validation)

---

_Created: 2025-12-22_
_Epic: 11 - Publisher Zmanim Registry Interface_
_Author: BMad Method_
_Status: Ready for Development_
