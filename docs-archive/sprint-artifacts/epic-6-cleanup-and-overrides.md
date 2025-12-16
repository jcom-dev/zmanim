# Epic 6: Code Cleanup, Consolidation & Publisher Data Overrides

**Epic:** Epic 6 - Cleanup + Minimal Override System
**Author:** BMad
**Date:** 2025-12-08
**Status:** Planning
**Estimated Stories:** 5 (MVP - Cleanup Focus)

---

## Executive Summary

Epic 6 is a **cleanup and consolidation sprint** that also adds minimal publisher override functionality. The primary focus is removing technical debt, consolidating duplicate patterns, and ensuring code reuse across the codebase. The secondary goal is enabling publishers to fix incorrect city data (coordinates, elevation) either for their users only or by requesting public corrections.

### What We're Building

**60% Cleanup & Consolidation:**
1. Complete removal of old map code remnants
2. Consolidate location type definitions across frontend/backend
3. Unify search patterns and debouncing logic
4. Standardize error handling across components
5. Consolidate tag handling logic
6. Create shared hooks for common patterns

**40% New Features:**
7. Publisher location data overrides (lat/lon, elevation, timezone)
8. Public correction request system (minimal admin workflow)

---

## Goals & Success Criteria

### Primary Goals

1. **Reduce Technical Debt** - Remove all deprecated code, consolidate duplicates
2. **Increase Code Reuse** - Extract common patterns into shared utilities
3. **Simplify Maintenance** - One pattern for each common operation
4. **Enable Data Fixes** - Publishers can correct location errors

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Duplicate code reduction | 30% reduction | Lines of code analysis |
| Shared utility adoption | 100% | All components use shared hooks |
| Type definition locations | 1 source of truth | TypeScript centralized types |
| Tag handling implementations | 1 shared component | Grep for tag-related code |
| Publisher override usage | > 10 publishers | Database metrics |
| Code review time | < 30 min/PR | Average PR review duration |

---

## Current State Assessment (From Audit)

### ✅ Recently Completed Cleanup
- Deleted old `CoverageMapView/` directory (7 files removed)
- Deleted `CoverageSelector.tsx`, `LocationPicker.tsx`
- Created new `CoveragePreviewMap.tsx` (150 lines, production-ready)
- Created new `CoverageSearchPanel.tsx` (300 lines, production-ready)
- Created new `LocationSearch.tsx` (300 lines, production-ready)
- Documented in `/docs/refactoring/location-search-unification.md`

### 🔧 Still Needs Cleanup

#### 1. Type Definitions Scattered
```typescript
// Found in multiple places:
web/components/shared/CoverageSearchPanel.tsx:
  type LocationType = 'city' | 'district' | 'region' | 'country' | 'continent';
  interface LocationSelection { ... }

web/components/shared/LocationSearch.tsx:
  interface City { ... }

web/components/shared/CoveragePreviewMap.tsx:
  interface CoverageItem { ... }

// Should be: One central type file
web/types/geography.ts:
  export type LocationType = ...
  export interface Location { ... }
```

#### 2. Search Debouncing Repeated
```typescript
// Pattern repeated in 3 components:
- LocationSearch.tsx (useEffect with setTimeout)
- CoverageSearchPanel.tsx (useEffect with setTimeout)
- PrimitivesTable.tsx (similar pattern)

// Should be: Shared hook
web/lib/hooks/useDebounce.ts (already exists, not used everywhere!)
```

#### 3. API Client Patterns Inconsistent
```typescript
// Some components:
const data = await fetch('/api/...')

// Other components:
const api = useApi();
const data = await api.get('/api/...')

// Should be: 100% useApi() adoption
```

#### 4. Tag Handling Logic Duplicated
```typescript
// Tags selected/displayed differently across:
- Coverage setup
- Publisher profile
- Zman registry

// Should be: Shared TagSelector component + validation logic
```

#### 5. Error Handling Inconsistent
```typescript
// Some components:
catch (err) { toast.error('Failed') }

// Other components:
catch (err) { setError(err.message) }

// Other components:
catch (err) { console.error(err) }

// Should be: Shared error handler utility
```

#### 6. Map Library Confusion
```
// Need to verify:
- Are we using Mapbox GL or MapLibre GL consistently?
- CoveragePreviewMap uses MapLibre GL
- Need to audit if any old Mapbox GL imports remain
```

---

## Story Breakdown (5 Stories - MVP)

### Story 6.1: Consolidate Type Definitions

**As a** developer,
**I want** centralized TypeScript type definitions for geography/location data,
**So that** types are consistent across frontend and backend.

**Acceptance Criteria:**

**Given** I create `web/types/geography.ts`
**When** I define all location types centrally
**Then** all components import from this file

**Work Items:**
1. Create `web/types/geography.ts` with:
   - `LocationType` enum
   - `Location` interface (unified)
   - `CoverageItem` interface
   - `City` interface
   - `Region`, `Country`, `Continent` interfaces
   - `Coordinates`, `Timezone` types

2. Update imports in:
   - `CoverageSearchPanel.tsx`
   - `CoveragePreviewMap.tsx`
   - `LocationSearch.tsx`
   - `CitySelector.tsx`
   - Coverage page
   - Algorithm page

3. Remove duplicate type definitions

4. Run `npm run type-check` to verify

**Estimated:** 3 story points

---

### Story 6.2: Extract Shared Hooks & Utilities

**As a** developer,
**I want** shared React hooks for common patterns,
**So that** components don't duplicate logic.

**Acceptance Criteria:**

**Given** I extract common patterns
**When** I create shared hooks
**Then** all components use them

**Work Items:**

1. **Create `web/lib/hooks/useLocationSearch.ts`**
   - Encapsulates: debouncing + API call + result state
   - Used by: LocationSearch, CoverageSearchPanel, CitySelector

   ```typescript
   export function useLocationSearch(options: {
     endpoint: string;
     debounceMs?: number;
     filters?: Record<string, any>;
   }) {
     const [query, setQuery] = useState('');
     const [results, setResults] = useState([]);
     const [loading, setLoading] = useState(false);
     const debouncedQuery = useDebounce(query, options.debounceMs);

     useEffect(() => {
       // Fetch logic
     }, [debouncedQuery]);

     return { query, setQuery, results, loading };
   }
   ```

2. **Create `web/lib/hooks/useMapPreview.ts`**
   - Encapsulates: MapLibre initialization + boundary fetching + marker rendering
   - Used by: CoveragePreviewMap

3. **Create `web/lib/utils/errorHandler.ts`**
   - Standardized error handling with toast notifications
   - Logs errors to console in dev mode

   ```typescript
   export function handleApiError(error: unknown, userMessage?: string) {
     console.error('API Error:', error);
     toast.error(userMessage || 'An error occurred');
   }
   ```

4. **Update all components** to use new hooks:
   - Replace inline debouncing with `useDebounce` (already exists!)
   - Replace inline search with `useLocationSearch`
   - Replace inline error handling with `handleApiError`

5. **Verify:**
   - Run `npm run type-check`
   - Run `npm run lint`
   - Test coverage page, algorithm page, onboarding

**Estimated:** 5 story points

---

### Story 6.3: Unified Tag Manager with Registry Tracking & Negation

**As a** publisher,
**I want** a unified tag editor that supports negation and tracks changes from the registry,
**So that** I can exclude events (like "NOT on Yom Tov") and see when I've customized tags.

**Context from Audit:**
- ✅ Database has `is_negated` column in both `master_zman_tags` and `publisher_zman_tags`
- ✅ Backend API fully supports negation in all tag endpoints
- ✅ `TagSelectorWithNegation` component exists with 3-state UI (unselected → selected → negated)
- ❌ `ZmanTagEditor` uses simple checkboxes (doesn't leverage negation)
- ❌ No source tag tracking (no "Tags Modified" indicator like DSL has)
- ❌ No tag revert functionality

**Acceptance Criteria:**

#### 1. Update Backend to Return Source Tags

**Given** I query `/api/v1/publisher/zmanim/{zmanKey}/tags`
**When** the zman is linked to master registry
**Then** response includes both current and source tags:

```typescript
interface TagWithSource {
  id: string;
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  tag_type: string;
  is_negated: boolean;
  tag_source: 'master' | 'publisher';
  sort_order: number;

  // NEW: Source comparison fields (from master registry)
  source_is_negated?: boolean;  // null if not from master
  is_modified?: boolean;         // true if differs from source
}
```

**SQL Update** (`api/internal/db/queries/zmanim_tags.sql`):
```sql
-- Add source tag tracking like DSL source tracking
SELECT
  t.id, t.tag_key, t.name,
  COALESCE(pzt.is_negated, false) AS is_negated,
  CASE WHEN mzt.tag_id IS NOT NULL THEN 'master' ELSE 'publisher' END AS tag_source,
  mzt.is_negated AS source_is_negated,  -- NEW: Source negation state
  CASE
    WHEN mzt.tag_id IS NOT NULL
      AND COALESCE(pzt.is_negated, false) != COALESCE(mzt.is_negated, false)
    THEN true
    ELSE false
  END AS is_modified  -- NEW: Change indicator
FROM publisher_zmanim pz
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id
LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id AND pzt.tag_id = t.id
...
```

#### 2. Replace ZmanTagEditor with Unified TagManager

**Given** I open tag editor for a zman
**When** the dialog loads
**Then** I see:
- Tabs grouped by tag type (Event, Timing, Jewish Day, Behavior, etc.)
- 3-state buttons for **event-related tags only** (event, timing, jewish_day types):
  - Click 1: ✓ Green border "Selected"
  - Click 2: ✗ Red border + strikethrough "NOT [tag name]"
  - Click 3: Unselected (gray)
- Simple checkboxes for **non-negatable tags** (behavior, shita, calculation, category)
- Modified tags show amber dot indicator
- Summary chip preview at top

**Given** a tag has been modified from master registry
**When** I view the tag in the editor
**Then** I see:
- Amber dot next to tag name
- Tooltip: "Modified from registry (was: [source state])"

**Given** I click "Revert All to Registry"
**When** confirmation dialog appears
**Then** all modified tags are reset to master registry values

#### 3. Add Tag Modification Indicators to ZmanCard

**Given** I view a zman card on `/publisher/algorithm` page
**When** tags have been modified from master registry
**Then** I see:
- Amber "Tags Modified" banner (like DSL modification banner)
- Shows diff: "Added: [tags]", "Removed: [tags]", "Negation changed: [tags]"
- "Revert Tags" button

**Given** I click "Revert Tags"
**When** confirmation appears
**Then** tags are reset to master registry state

**Example UI:**
```tsx
{hasTagModification(zman) && (
  <div className="px-3 py-2 rounded-md bg-amber-100/80 border border-amber-300">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="text-sm font-medium text-amber-900">Tags Modified</span>
        <div className="text-xs text-amber-700 mt-1">
          {tagDiff.added.length > 0 && `Added: ${tagDiff.added.join(', ')}`}
          {tagDiff.removed.length > 0 && `Removed: ${tagDiff.removed.join(', ')}`}
          {tagDiff.negationChanged.length > 0 && `Negation: ${tagDiff.negationChanged.join(', ')}`}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRevertTags}
      >
        Revert
      </Button>
    </div>
  </div>
)}
```

#### 4. Create Reusable TagManager Component

**File:** `web/components/shared/tags/TagManager.tsx`

**Props:**
```typescript
interface TagManagerProps {
  currentTags: TagWithSource[];
  allAvailableTags: ZmanTag[];
  onSave: (tags: TagAssignment[]) => Promise<void>;
  onRevert?: () => Promise<void>;  // Only if master registry source exists
  showModificationIndicators?: boolean;
  disabled?: boolean;
}

interface TagAssignment {
  tag_id: string;
  is_negated: boolean;
}
```

**Features:**
- Uses existing `TagSelectorWithNegation` for event-related tags
- Uses simple checkboxes for non-negatable tags
- Groups by tag type with tabs
- Shows modification indicators (amber dots)
- Revert button (if source exists)
- Preview chips at top
- Accessibility (keyboard navigation, ARIA labels)

**Usage Example:**
```tsx
// In ZmanTagEditor dialog
<TagManager
  currentTags={zman.tags}
  allAvailableTags={allTags}
  onSave={handleSaveTags}
  onRevert={zman.master_zman_id ? handleRevertTags : undefined}
  showModificationIndicators={true}
/>

// In coverage setup (simpler, no registry tracking)
<TagManager
  currentTags={coverage.tags}
  allAvailableTags={allTags}
  onSave={handleSaveTags}
  showModificationIndicators={false}
/>
```

#### 5. Determine Tag Negation Eligibility

**File:** `web/lib/utils/tagNegation.ts`

```typescript
// Tag types that support negation (event-related)
const NEGATABLE_TAG_TYPES = ['event', 'timing', 'jewish_day'];

export function canNegateTag(tag: ZmanTag): boolean {
  return NEGATABLE_TAG_TYPES.includes(tag.tag_type);
}

export function getTagDisplayState(tag: TagWithSource): {
  state: 'unselected' | 'selected' | 'negated';
  isModified: boolean;
  sourceState?: 'unselected' | 'selected' | 'negated';
} {
  const currentState = tag.is_negated ? 'negated' : 'selected';
  const sourceState = tag.source_is_negated === null ? undefined :
                     tag.source_is_negated ? 'negated' : 'selected';

  return {
    state: currentState,
    isModified: tag.is_modified || false,
    sourceState,
  };
}
```

#### 6. Update Components to Use TagManager

**Components to Update:**
1. `web/components/publisher/ZmanTagEditor.tsx` - Replace checkbox UI with TagManager
2. `web/components/publisher/ZmanCard.tsx` - Add tag modification banner
3. `web/app/publisher/algorithm/page.tsx` - Use TagManager when editing tags

**Remove Duplicate Logic:**
- Delete inline tag selection logic from ZmanTagEditor
- Consolidate tag display logic into TagChip component
- Use TagManager everywhere tags are edited

#### 7. API Integration

**New endpoint for tag revert:**
```
POST /api/v1/publisher/zmanim/{zmanKey}/tags/revert
```

Response: Reverts all publisher tags to master registry state

**Update existing endpoint:**
```
PUT /api/v1/publisher/zmanim/{zmanKey}/tags
```
Body includes `is_negated` for each tag (already supported, verify frontend sends it)

**Work Items:**

1. **Backend:**
   - [ ] Update `GetZmanTags` query to include `source_is_negated`, `is_modified`
   - [ ] Add `RevertPublisherZmanTags` handler
   - [ ] Update `ZmanTag` struct with new fields
   - [ ] Add route for revert endpoint

2. **Frontend Core:**
   - [ ] Create `web/lib/utils/tagNegation.ts` with eligibility logic
   - [ ] Create `web/components/shared/tags/TagManager.tsx` (reusable component)
   - [ ] Update `web/components/shared/tags/TagChip.tsx` to show modification state

3. **Frontend Integration:**
   - [ ] Update `ZmanTagEditor.tsx` to use TagManager
   - [ ] Update `ZmanCard.tsx` to show tag modification banner
   - [ ] Add `handleRevertTags` to algorithm page

4. **Testing:**
   - [ ] Unit tests for tag negation logic
   - [ ] E2E test: Negate event tag, save, verify persistence
   - [ ] E2E test: Modify tag from registry, revert, verify reset
   - [ ] Visual regression tests for 3-state button UI

5. **Documentation:**
   - [ ] Update `/docs/tagging-guide.md` with negation rules
   - [ ] Document which tag types support negation
   - [ ] Add screenshots of tag modification indicators

#### 8. Implement Tag Negation Filtering in Calculation API

**CRITICAL FUNCTIONAL REQUIREMENT**

**As a** user viewing zmanim,
**I want** negated tags to exclude zmanim on specific dates,
**So that** I only see times that apply to today's calendar events.

**Current State (From Audit):**
- ✅ Database: `tag_event_mappings` table maps tags to Hebrew dates
- ✅ Queries: `GetTagsForHebrewDate()` exists but **NOT USED** in calculation flow
- ✅ API Response: `is_negated` field returned but **IGNORED** for filtering
- ❌ Filtering: NO logic to exclude zmanim based on negated tags

**Example Use Case:**
```
Zman: "Mincha Gedola"
Tags: [shabbos: is_negated=true, yom_tov: is_negated=false]

Meaning:
- Show on Yom Tov ✓
- Do NOT show on Shabbos ✗

Today: Saturday (Shabbos)
Result: "Mincha Gedola" should be EXCLUDED from API response
```

**Implementation:**

Add filtering in `api/internal/handlers/zmanim.go` after line 209:

```go
// Get Hebrew calendar context for tag filtering
hebrewDate, err := h.calendar.GetHebrewDate(date)
todayTags, err := h.db.Queries.GetTagsForHebrewDate(ctx, sqlcgen.GetTagsForHebrewDateParams{
    HebrewMonth: hebrewDate.Month,
    HebrewDay: hebrewDate.Day,
})

// Filter zmanim based on negated tags
filteredZmanim := []ZmanWithFormula{}
for _, zman := range response.Zmanim {
    shouldInclude := true
    for _, tag := range zman.Tags {
        if tag.IsNegated && todayTagIDs[tag.ID] {
            shouldInclude = false  // Tag negated + matches today = exclude
            break
        }
    }
    if shouldInclude {
        filteredZmanim = append(filteredZmanim, zman)
    }
}
response.Zmanim = filteredZmanim
```

**Acceptance Criteria:**

**Given** zman has tag `shabbos` with `is_negated=true`
**When** I request zmanim for Saturday
**Then** zman is **excluded** from response

**Given** zman has tag `yom_tov` with `is_negated=false`
**When** I request zmanim for Rosh Hashana
**Then** zman is **included** in response

**Work Items:**
- [ ] Add `GetHebrewDate()` to calendar service
- [ ] Add tag filtering logic to `GetZmanimForCity`
- [ ] Unit tests for Shabbos/Yom Tov filtering
- [ ] Performance test (verify < 200ms response)

---

### Story 6.4: Publisher Location Overrides + Inline Map View

**As a** publisher,
**I want** to override city coordinates/elevation for my users,
**So that** my calculations use accurate data.

**Acceptance Criteria:**

**Database:**

**Given** migration is applied
**Then** table `publisher_location_overrides` exists:
```sql
CREATE TABLE publisher_location_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  city_id BIGINT NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,

  -- Overrides (NULL = use original)
  override_latitude DOUBLE PRECISION,
  override_longitude DOUBLE PRECISION,
  override_elevation INTEGER,
  override_timezone TEXT,

  -- Metadata
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(publisher_id, city_id)
);

CREATE INDEX idx_publisher_overrides_publisher ON publisher_location_overrides(publisher_id);
CREATE INDEX idx_publisher_overrides_city ON publisher_location_overrides(city_id);
```

**API:**

**Given** I'm authenticated as a publisher
**When** I call `POST /api/v1/publisher/locations/{cityId}/override`
```json
{
  "latitude": 40.7589,
  "elevation": 33,
  "reason": "Using One World Trade Center elevation"
}
```
**Then** override is stored for this publisher

**Given** I call `GET /api/v1/publisher/location-overrides`
**Then** I see all my overrides with city names

**Given** I call `DELETE /api/v1/publisher/location-overrides/{id}`
**Then** override is removed

**UI:**

**Given** I'm on `/publisher/coverage` page
**When** I click a city
**Then** I see a dialog showing:
- Current data (lat/lon/elevation/timezone)
- "Override for My Users" button
- Form to enter override values + reason

**Given** I submit an override
**When** saved successfully
**Then** city shows badge "⚙️ Overridden" in coverage list

**Calculation Integration:**

**Given** a zmanim calculation request for a city
**When** the publisher has an override for that city
**Then** override values are used instead of original data

**Technical Implementation:**
- Migration: `db/migrations/00000000000026_publisher_location_overrides.sql`
- SQLc queries: `api/internal/db/queries/location_overrides.sql`
- Handler: `api/internal/handlers/location_overrides.go`
- Component: `web/components/publisher/LocationOverrideDialog.tsx`
- Update calculation service to check for overrides

**Estimated:** 8 story points

---

### Story 6.5: Public Correction Requests (Minimal Admin)

**As a** publisher,
**I want** to request corrections to city data that affect all users,
**So that** everyone benefits from accurate data.

**As an** admin,
**I want** to review and approve correction requests,
**So that** data quality is maintained.

**Acceptance Criteria:**

**Database:**

**Given** migration is applied
**Then** table `city_correction_requests` exists:
```sql
CREATE TABLE city_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id BIGINT NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,
  publisher_id UUID REFERENCES publishers(id) ON DELETE SET NULL,

  -- Requester info
  requester_email TEXT NOT NULL,
  requester_name TEXT,

  -- Proposed corrections (NULL = no change)
  proposed_latitude DOUBLE PRECISION,
  proposed_longitude DOUBLE PRECISION,
  proposed_elevation INTEGER,
  proposed_timezone TEXT,

  -- Request details
  correction_reason TEXT NOT NULL,
  evidence_urls TEXT[], -- Array of URLs

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Admin review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_correction_requests_status ON city_correction_requests(status);
CREATE INDEX idx_correction_requests_city ON city_correction_requests(city_id);
CREATE INDEX idx_correction_requests_publisher ON city_correction_requests(publisher_id);
```

**Publisher API:**

**Given** I'm authenticated as a publisher
**When** I call `POST /api/v1/publisher/correction-requests`
```json
{
  "cityId": 5128581,
  "proposedElevation": 33,
  "reason": "Current elevation is incorrect, should be 33m",
  "evidenceUrls": ["https://usgs.gov/..."]
}
```
**Then** request is created with status "pending"

**Given** I call `GET /api/v1/publisher/correction-requests`
**Then** I see **only my requests** with status

**Admin API:**

**Given** I'm authenticated as admin
**When** I call `GET /api/v1/admin/correction-requests?status=pending`
**Then** I see all pending requests

**Given** I call `POST /api/v1/admin/correction-requests/{id}/approve`
```json
{
  "reviewNotes": "Verified with USGS data"
}
```
**Then**:
- Request status → "approved"
- `geo_cities` table updated with new values
- Publisher notified via email (future)

**Given** I call `POST /api/v1/admin/correction-requests/{id}/reject`
```json
{
  "reviewNotes": "Current data is correct per Geonames"
}
```
**Then**:
- Request status → "rejected"
- City data unchanged
- Publisher notified (future)

**Publisher UI:**

**Given** I'm viewing a city in coverage
**When** I click "Request Public Correction"
**Then** I see form:
- Current values (read-only)
- Proposed values (editable)
- Reason (required textarea)
- Evidence URLs (optional, multi-input)

**Given** I submit a correction request
**Then** I see success message "Request submitted for admin review"

**Given** I navigate to `/publisher/correction-requests`
**Then** I see list of my requests with status badges

**Admin UI (Minimal):**

**Given** I'm admin at `/admin/correction-requests`
**When** page loads
**Then** I see table of pending requests:
- City name
- Proposed changes (diff view)
- Requester info
- Reason + evidence links
- [Approve] [Reject] buttons

**Given** I click [Approve]
**When** confirmation dialog appears
**Then** I can add review notes and confirm

**Given** I click [Reject]
**When** confirmation dialog appears
**Then** I must provide reason for rejection

**Technical Implementation:**
- Migration: `db/migrations/00000000000027_city_correction_requests.sql`
- SQLc queries: `api/internal/db/queries/correction_requests.sql`
- Handler: `api/internal/handlers/correction_requests.go`
- Admin handler: `api/internal/handlers/admin_corrections.go`
- Publisher component: `web/components/publisher/CorrectionRequestDialog.tsx`
- Publisher page: `web/app/publisher/correction-requests/page.tsx`
- Admin page: `web/app/admin/correction-requests/page.tsx`

**Estimated:** 13 story points

---

### Story 6.6: Database Query Optimization & Indexing

**As a** developer,
**I want** all new queries optimized with proper indexes,
**So that** the application performs well under load.

**Context:**

Stories 6.3, 6.4, and 6.5 introduce several new queries and tables:
- Tag filtering queries (Hebrew date lookups)
- Tag correction request queries
- Location override queries
- City correction request queries

**Without proper indexes, these queries could cause performance degradation**, especially as data grows.

**Performance Targets:**

| Query Type | Target | Measurement |
|------------|--------|-------------|
| Tag filtering (GetTagsForDate) | < 50ms | p95 response time |
| Location override lookup | < 20ms | Single record query |
| Correction request list (publisher) | < 100ms | Paginated query |
| Correction request list (admin) | < 150ms | Filtered query with joins |
| Zmanim calculation with filtering | < 200ms | Full API response |

**Acceptance Criteria:**

#### 1. Analyze All New Queries with EXPLAIN ANALYZE

**Given** all new queries from Stories 6.3-6.5
**When** I run `EXPLAIN ANALYZE` on each query
**Then** I see:
- No sequential scans on large tables
- Index usage confirmed
- Estimated rows close to actual rows
- Query cost within acceptable range

**Queries to Analyze:**

**Story 6.3 - Tag Queries:**
```sql
-- GetTagsForDate (tag filtering in calculations)
EXPLAIN ANALYZE
SELECT DISTINCT t.id, t.tag_key, t.name
FROM tag_event_mappings tem
JOIN zman_tags t ON tem.tag_id = t.id
WHERE tem.hebrew_month = $1 AND $2 BETWEEN tem.hebrew_day_start AND COALESCE(tem.hebrew_day_end, tem.hebrew_day_start)
ORDER BY tem.priority, t.sort_order;

-- GetZmanTags with source tracking
EXPLAIN ANALYZE
SELECT t.id, t.tag_key, t.name,
  COALESCE(pzt.is_negated, false) AS is_negated,
  mzt.is_negated AS source_is_negated,
  CASE WHEN mzt.tag_id IS NOT NULL AND COALESCE(pzt.is_negated, false) != COALESCE(mzt.is_negated, false) THEN true ELSE false END AS is_modified
FROM publisher_zmanim pz
LEFT JOIN master_zman_tags mzt ON mzt.master_zman_id = pz.master_zman_id
LEFT JOIN publisher_zman_tags pzt ON pzt.publisher_zman_id = pz.id AND pzt.tag_id = t.id
WHERE pz.id = $1;

-- GetPendingTagCorrectionRequests (admin dashboard)
EXPLAIN ANALYZE
SELECT tcr.*, mz.canonical_english_name, t.name AS tag_name, p.name AS publisher_name
FROM master_zman_tag_correction_requests tcr
JOIN master_zmanim_registry mz ON tcr.master_zman_id = mz.id
JOIN zman_tags t ON tcr.tag_id = t.id
LEFT JOIN publishers p ON tcr.publisher_id = p.id
WHERE tcr.status = 'pending'
ORDER BY tcr.created_at DESC
LIMIT 20;
```

**Story 6.4 - Location Override Queries:**
```sql
-- GetPublisherLocationOverrides
EXPLAIN ANALYZE
SELECT plo.*, c.name AS city_name, c.country AS country_name
FROM publisher_location_overrides plo
JOIN geo_cities c ON plo.city_id = c.id
WHERE plo.publisher_id = $1
ORDER BY plo.updated_at DESC;

-- GetLocationOverrideForCalculation (called during zmanim calculation)
EXPLAIN ANALYZE
SELECT override_latitude, override_longitude, override_elevation, override_timezone
FROM publisher_location_overrides
WHERE publisher_id = $1 AND city_id = $2;
```

**Story 6.5 - Correction Request Queries:**
```sql
-- GetPendingCityCorrectionRequests (admin dashboard)
EXPLAIN ANALYZE
SELECT ccr.*, c.name AS city_name, c.country AS country_name, p.name AS publisher_name
FROM city_correction_requests ccr
JOIN geo_cities c ON ccr.city_id = c.id
LEFT JOIN publishers p ON ccr.publisher_id = p.id
WHERE ccr.status = 'pending'
ORDER BY ccr.created_at DESC
LIMIT 20;

-- GetPublisherCorrectionRequests
EXPLAIN ANALYZE
SELECT ccr.*, c.name AS city_name
FROM city_correction_requests ccr
JOIN geo_cities c ON ccr.city_id = c.id
WHERE ccr.publisher_id = $1
ORDER BY ccr.created_at DESC;
```

#### 2. Create Required Indexes

**Migration:** `db/migrations/00000000000028_epic6_performance_indexes.sql`

```sql
-- ============================================================================
-- Epic 6: Performance Indexes
-- ============================================================================

-- Tag Event Mappings (Story 6.3)
-- Used for: Hebrew date → tag lookups in zmanim calculations
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_hebrew_date
  ON tag_event_mappings(hebrew_month, hebrew_day_start, hebrew_day_end);

CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_priority
  ON tag_event_mappings(priority);

-- Tag event pattern matching (for HebCal events)
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_pattern
  ON tag_event_mappings(hebcal_event_pattern)
  WHERE hebcal_event_pattern IS NOT NULL;

-- Master Zman Tags (Story 6.3)
-- Used for: Source tag comparison
CREATE INDEX IF NOT EXISTS idx_master_zman_tags_lookup
  ON master_zman_tags(master_zman_id, tag_id);

-- Publisher Zman Tags (Story 6.3)
-- Used for: Tag modification detection
CREATE INDEX IF NOT EXISTS idx_publisher_zman_tags_lookup
  ON publisher_zman_tags(publisher_zman_id, tag_id);

-- Tag Correction Requests (Story 6.3)
-- Used for: Admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_status_created
  ON master_zman_tag_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_master_zman
  ON master_zman_tag_correction_requests(master_zman_id);

CREATE INDEX IF NOT EXISTS idx_tag_correction_requests_tag
  ON master_zman_tag_correction_requests(tag_id);

-- Publisher Location Overrides (Story 6.4)
-- Used for: Fast lookup during zmanim calculation
CREATE INDEX IF NOT EXISTS idx_publisher_location_overrides_lookup
  ON publisher_location_overrides(publisher_id, city_id);

-- Covering index for calculation queries (includes all needed columns)
CREATE INDEX IF NOT EXISTS idx_publisher_location_overrides_calculation
  ON publisher_location_overrides(publisher_id, city_id)
  INCLUDE (override_latitude, override_longitude, override_elevation, override_timezone);

-- City Correction Requests (Story 6.5)
-- Used for: Admin dashboard filtering and publisher list
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_status_created
  ON city_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_city_correction_requests_city
  ON city_correction_requests(city_id);

-- Composite index for publisher requests
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_publisher_created
  ON city_correction_requests(publisher_id, created_at DESC)
  WHERE publisher_id IS NOT NULL;

-- ============================================================================
-- Vacuum and Analyze
-- ============================================================================

-- Update statistics for query planner
ANALYZE tag_event_mappings;
ANALYZE master_zman_tags;
ANALYZE publisher_zman_tags;
ANALYZE master_zman_tag_correction_requests;
ANALYZE publisher_location_overrides;
ANALYZE city_correction_requests;
```

#### 3. Add Query Performance Tests

**File:** `api/internal/handlers/performance_test.go`

```go
package handlers

import (
    "context"
    "testing"
    "time"
)

func TestTagFilteringPerformance(t *testing.T) {
    ctx := context.Background()

    // Test GetTagsForDate
    start := time.Now()
    tags, err := db.Queries.GetTagsForDate(ctx, sqlcgen.GetTagsForDateParams{
        HebrewMonth: 7,
        HebrewDay: 1,
    })
    duration := time.Since(start)

    if err != nil {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 50*time.Millisecond {
        t.Errorf("GetTagsForDate too slow: %v (target: < 50ms)", duration)
    }

    t.Logf("GetTagsForDate: %v, returned %d tags", duration, len(tags))
}

func TestLocationOverrideLookupPerformance(t *testing.T) {
    ctx := context.Background()

    start := time.Now()
    override, err := db.Queries.GetLocationOverrideForCalculation(ctx, sqlcgen.GetLocationOverrideForCalculationParams{
        PublisherID: testPublisherID,
        CityID: testCityID,
    })
    duration := time.Since(start)

    if err != nil && err != sql.ErrNoRows {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 20*time.Millisecond {
        t.Errorf("GetLocationOverrideForCalculation too slow: %v (target: < 20ms)", duration)
    }

    t.Logf("GetLocationOverrideForCalculation: %v", duration)
}

func TestCorrectionRequestListPerformance(t *testing.T) {
    ctx := context.Background()

    // Admin dashboard query
    start := time.Now()
    requests, err := db.Queries.GetPendingCityCorrectionRequests(ctx, sqlcgen.GetPendingCityCorrectionRequestsParams{
        Limit: 20,
    })
    duration := time.Since(start)

    if err != nil {
        t.Fatalf("Query failed: %v", err)
    }

    if duration > 150*time.Millisecond {
        t.Errorf("GetPendingCityCorrectionRequests too slow: %v (target: < 150ms)", duration)
    }

    t.Logf("GetPendingCityCorrectionRequests: %v, returned %d requests", duration, len(requests))
}

func BenchmarkZmanimCalculationWithFiltering(b *testing.B) {
    ctx := context.Background()

    for i := 0; i < b.N; i++ {
        // Full zmanim calculation flow with tag filtering
        _, err := handlers.GetZmanimForCity(ctx, testCityID, testDate, testPublisherID)
        if err != nil {
            b.Fatalf("Calculation failed: %v", err)
        }
    }
}
```

#### 4. Monitor Query Plans in CI/CD

**GitHub Actions Workflow:** `.github/workflows/performance-check.yml`

```yaml
name: Database Performance Check

on:
  pull_request:
    paths:
      - 'api/internal/db/queries/**'
      - 'db/migrations/**'

jobs:
  analyze-queries:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgis/postgis:15-3.3
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Run migrations
        run: ./scripts/migrate.sh

      - name: Seed test data
        run: psql -f db/seed/performance_test_data.sql

      - name: Run EXPLAIN ANALYZE on critical queries
        run: |
          psql -c "EXPLAIN ANALYZE SELECT ..." > query_plans.txt

      - name: Check for sequential scans
        run: |
          if grep -q "Seq Scan" query_plans.txt; then
            echo "❌ Sequential scan detected - add index!"
            exit 1
          fi

      - name: Run performance tests
        run: go test -v ./api/internal/handlers -run Performance
```

#### 5. Document Index Strategy

**File:** `/docs/database-indexes.md`

```markdown
# Database Index Strategy - Epic 6

## Tag Event Mappings

**Table:** `tag_event_mappings` (maps tags to Hebrew dates/events)

**Query Pattern:** Lookup tags for a specific Hebrew date
```sql
WHERE hebrew_month = X AND Y BETWEEN hebrew_day_start AND hebrew_day_end
```

**Indexes:**
- `idx_tag_event_mappings_hebrew_date` (hebrew_month, hebrew_day_start, hebrew_day_end)
- `idx_tag_event_mappings_priority` (priority) - for ordering
- `idx_tag_event_mappings_pattern` (hebcal_event_pattern) - partial index

**Rationale:** Hebrew date lookups happen on EVERY zmanim calculation request.

---

## Publisher Location Overrides

**Table:** `publisher_location_overrides`

**Query Pattern:** Lookup override for publisher + city during calculation
```sql
WHERE publisher_id = X AND city_id = Y
```

**Indexes:**
- `idx_publisher_location_overrides_lookup` (publisher_id, city_id) - composite
- `idx_publisher_location_overrides_calculation` - covering index with INCLUDE

**Rationale:**
- Composite index covers the WHERE clause exactly
- Covering index avoids table lookup (index-only scan)
- Called during every zmanim calculation for publishers with overrides

---

## Correction Requests

**Tables:** `city_correction_requests`, `master_zman_tag_correction_requests`

**Query Patterns:**
1. Admin dashboard: `WHERE status = 'pending' ORDER BY created_at DESC`
2. Publisher list: `WHERE publisher_id = X ORDER BY created_at DESC`

**Indexes:**
- Partial index on `(status, created_at DESC)` WHERE status = 'pending'
- Regular index on `(publisher_id, created_at DESC)`

**Rationale:**
- Partial index is smaller and faster for pending-only queries
- Sorted index avoids separate sort operation

---

## Performance Monitoring

**Tools:**
- `EXPLAIN ANALYZE` - Check actual query plans
- `pg_stat_statements` - Monitor query performance in production
- Performance tests in CI/CD

**Targets:**
- Tag filtering: < 50ms
- Override lookup: < 20ms
- Correction request lists: < 150ms
```

**Work Items:**

1. **Query Analysis:**
   - [ ] Run EXPLAIN ANALYZE on all new queries
   - [ ] Identify missing indexes
   - [ ] Check for sequential scans on large tables

2. **Index Creation:**
   - [ ] Create migration `00000000000028_epic6_performance_indexes.sql`
   - [ ] Add indexes for tag event mappings
   - [ ] Add indexes for location overrides (including covering index)
   - [ ] Add indexes for correction requests (partial indexes)

3. **Testing:**
   - [ ] Create `performance_test.go` with benchmarks
   - [ ] Set up CI/CD performance checks
   - [ ] Verify all queries meet performance targets

4. **Documentation:**
   - [ ] Document index strategy in `/docs/database-indexes.md`
   - [ ] Add query optimization guidelines
   - [ ] Document performance targets for new queries

5. **Monitoring:**
   - [ ] Enable `pg_stat_statements` in production
   - [ ] Add performance metrics to observability dashboard
   - [ ] Set up alerts for slow queries (> 500ms)

**Acceptance Criteria:**

**Given** all Epic 6 features are implemented
**When** I run performance tests
**Then**:
- Tag filtering query completes in < 50ms (p95)
- Location override lookup completes in < 20ms (p95)
- Correction request lists complete in < 150ms (p95)
- Full zmanim calculation with filtering completes in < 200ms (p95)

**Given** I run EXPLAIN ANALYZE on all new queries
**When** examining query plans
**Then**:
- All queries use indexes (no sequential scans on large tables)
- Estimated rows match actual rows (statistics are accurate)
- Query cost is within expected range

**Given** Epic 6 is deployed to production
**When** monitoring query performance
**Then**:
- No new slow query alerts
- No increase in database CPU usage
- Response times remain within SLA

**Estimated:** 5 story points

---

## Summary: 6 Stories

| Story | Title | Points | Type |
|-------|-------|--------|------|
| 6.1 | Consolidate Type Definitions | 3 | Cleanup |
| 6.2 | Extract Shared Hooks & Utilities | 5 | Cleanup |
| 6.3 | Unified Tag Manager with Registry Tracking | 8 | Cleanup + Feature |
| 6.4 | Publisher Location Overrides + Inline Map View | 10 | Feature |
| 6.5 | Public Correction Requests + Admin Edit + Emails | 16 | Feature |
| 6.6 | Database Query Optimization & Indexing | 5 | Performance |
| **TOTAL** | **6 stories** | **47 points** | **34% Cleanup, 55% Features, 11% Performance** |

---

## Code Reuse Opportunities (From Audit)

### ✅ Components to Reuse (Already Built)
1. **CoveragePreviewMap** - Use for showing correction locations on map
2. **CoverageSearchPanel** - Pattern for multi-level search (reusable)
3. **LocationSearch** - City search with debouncing (done right)

### 🔧 Patterns to Extract
1. **Search + Debounce Pattern** → `useLocationSearch` hook
2. **Map Initialization Pattern** → `useMapPreview` hook
3. **Error Handling** → `handleApiError` utility
4. **Tag Selection** → `TagSelector` component
5. **Type Definitions** → `web/types/geography.ts`

### 📦 Utilities to Create
1. **`web/lib/hooks/useLocationSearch.ts`** - Unified search hook
2. **`web/lib/hooks/useMapPreview.ts`** - Map initialization hook
3. **`web/lib/utils/errorHandler.ts`** - Standardized error handling
4. **`web/lib/utils/tagValidation.ts`** - Tag validation rules
5. **`web/types/geography.ts`** - Central type definitions

---

## Files to Update/Create

### New Files (14)
```
web/types/geography.ts                               # Central types
web/lib/hooks/useLocationSearch.ts                   # Search hook
web/lib/hooks/useMapPreview.ts                       # Map hook
web/lib/utils/errorHandler.ts                        # Error handling
web/lib/utils/tagValidation.ts                       # Tag validation
web/components/shared/TagSelector.tsx                # Tag component
web/components/shared/LocationMapView.tsx            # Inline map view (display only)
web/components/publisher/LocationOverrideDialog.tsx  # Override UI
web/components/publisher/CorrectionRequestDialog.tsx # Request UI
web/components/admin/AdminCityEditDialog.tsx         # Admin direct edit dialog
web/app/publisher/correction-requests/page.tsx       # Publisher requests
web/app/admin/correction-requests/page.tsx           # Admin dashboard

db/migrations/00000000000026_publisher_location_overrides.sql
db/migrations/00000000000027_city_correction_requests.sql

api/internal/db/queries/location_overrides.sql
api/internal/db/queries/correction_requests.sql
api/internal/handlers/location_overrides.go
api/internal/handlers/correction_requests.go
api/internal/handlers/admin_corrections.go
api/internal/emails/correction-approved.tsx          # Approval email template
api/internal/emails/correction-rejected.tsx          # Rejection email template

docs/tagging-guide.md
```

### Files to Update (8+)
```
web/components/shared/CoverageSearchPanel.tsx        # Use new types/hooks
web/components/shared/LocationSearch.tsx             # Use new types/hooks
web/components/shared/CoveragePreviewMap.tsx         # Use new types
web/components/publisher/CitySelector.tsx            # Use new hooks
web/app/publisher/coverage/page.tsx                  # Use TagSelector
web/app/publisher/profile/page.tsx                   # Use TagSelector
api/cmd/api/main.go                                  # Add routes
api/internal/services/calculation_service.go         # Check overrides
```

---

## Testing Strategy

### Unit Tests
- Tag validation logic
- Error handler utility
- Location search hook (React Testing Library)
- Map preview hook

### Integration Tests
- Override CRUD endpoints
- Correction request submission
- Admin approval workflow
- Calculation service with overrides

### E2E Tests (Playwright)
```typescript
test('publisher can override city data', async ({ page }) => {
  // Login as publisher
  await page.goto('/publisher/coverage');

  // Click city
  await page.click('text=New York, NY');

  // Click override button
  await page.click('text=Override for My Users');

  // Enter override values
  await page.fill('[name="elevation"]', '33');
  await page.fill('[name="reason"]', 'Using WTC elevation');
  await page.click('text=Save Override');

  // Verify badge appears
  await expect(page.locator('text=⚙️ Overridden')).toBeVisible();
});

test('publisher can request public correction', async ({ page }) => {
  await page.goto('/publisher/coverage');
  await page.click('text=Jerusalem');
  await page.click('text=Request Public Correction');

  await page.fill('[name="proposedElevation"]', '786');
  await page.fill('[name="reason"]', 'Old City center elevation');
  await page.click('text=Submit Request');

  await expect(page.locator('text=submitted for review')).toBeVisible();
});

test('admin can approve correction request', async ({ page }) => {
  // Login as admin
  await page.goto('/admin/correction-requests');

  // Find pending request
  await page.click('text=Jerusalem');

  // Approve
  await page.click('text=Approve');
  await page.fill('[name="reviewNotes"]', 'Verified');
  await page.click('text=Confirm Approval');

  // Verify status changed
  await expect(page.locator('text=Approved')).toBeVisible();
});
```

---

## Migration Path

### Phase 1: Cleanup (Stories 6.1-6.3)
- No breaking changes
- Extract shared code
- Update components to use shared utilities
- Verify everything still works

### Phase 2: Overrides (Story 6.4)
- Add database table
- Build API endpoints
- Build publisher UI
- Integrate with calculation service
- **Publishers can now override data**

### Phase 3: Corrections (Story 6.5)
- Add database table
- Build request submission API
- Build admin review API
- Build publisher UI
- Build minimal admin dashboard
- **Full correction workflow operational**

---

## Success Criteria

✅ **Epic 6 is complete when:**

1. **All type definitions centralized** in `web/types/geography.ts`
2. **All components use shared hooks** (`useLocationSearch`, `useDebounce`)
3. **Error handling is standardized** across all API calls
4. **Tag handling uses single component** (`TagSelector`)
5. **Publishers can override** city data for their users
6. **Publishers can request** public corrections
7. **Admins can approve/reject** correction requests
8. **Calculation service** uses override data when present
9. **All E2E tests pass**
10. **Code duplication reduced** by 30% (measured)
11. **Type check passes** with no errors
12. **Lint passes** with no warnings

---

## Non-Goals (Future Enhancements)

- ❌ Batch correction imports (Story 6.7 - future)
- ❌ Data quality dashboards (Epic 7)
- ❌ Historical correction tracking (Epic 7)
- ❌ Custom boundary drawing (Epic 8)
- ❌ Shapefile imports (Epic 8)

---

**Generated:** 2025-12-08
**Updated:** 2025-12-08 (Sprint Change Proposal applied)
**For:** Epic 6 - Shtetl Zmanim
**Status:** READY FOR REVIEW 🧹
**Author:** BMad
**Focus:** 34% Cleanup, 55% Features, 11% Performance
**Estimated:** 47 story points (6 stories)
