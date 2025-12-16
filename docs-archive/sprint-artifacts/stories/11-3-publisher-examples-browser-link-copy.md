# Story 11.3: Other Publishers Browser & Link/Copy Flow

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Status:** Draft
**Priority:** High
**Story Points:** 13

---

## User Story

**As a** publisher,
**I want** to browse validated publishers' zmanim implementations and link or copy their formulas,
**So that** I can learn from real-world examples and reuse quality formulas from other authorities.

---

## Acceptance Criteria

### AC-1: Other Publishers Tab Navigation
**Given** I am on the registry page
**When** I switch to the "Other Publishers" tab
**Then** I see a publisher search workflow:
- Publisher search/autocomplete dropdown (search by name)
- Instruction text: "Search for a publisher to view their catalog"
- Empty state: "Select a publisher to view their zmanim"

### AC-2: Publisher Search Autocomplete
**Given** I am on the Other Publishers tab
**When** I type in the publisher search box (e.g., "MH")
**Then** I see autocomplete results showing validated publishers only:
- Only publishers with `status = 'approved'`
- Excludes deleted, suspended, or inactive publishers
- Results sorted alphabetically

### AC-3: Publisher Catalog Display
**Given** I have selected a publisher (e.g., "MH Zmanim")
**When** the publisher catalog loads
**Then** I see:
- Publisher name prominently displayed
- Location dropdown (restricted to publisher's coverage localities)
- Date selector (shared with master tab)
- Filter panel (category, shita, status within this publisher's catalog)
- Paginated table/card view of their zmanim

### AC-4: Coverage-Restricted Location Selection
**Given** I have selected a publisher
**When** I select a location from the dropdown
**Then** ONLY localities where the selected publisher has coverage are shown
**And** preview times calculate for selected location/date

### AC-5: Location Auto-Clear on Publisher Switch
**Given** I switch to a different publisher
**When** the new publisher doesn't cover my currently selected location
**Then** location is auto-cleared
**And** I see message: "Please select a location within [Publisher Name]'s coverage"

### AC-6: Publisher Zman Card Display
**Given** I am viewing a publisher zman card
**When** the card is displayed
**Then** I see:
- Zman name (may be customized by publisher)
- Publisher name with "Validated Publisher" badge
- DSL formula (syntax-highlighted)
- Preview time (12-hour format)
- Master registry name reference (e.g., "Master: Alos Hashachar (16.1°)")
- Shita badge (inherited from master)
- Category badge (inherited from master)
- Status: Available or "Already in Your Catalog"
- Info button (ℹ️)
- Link button (if not owned)
- Copy button (if not owned)

### AC-7: Link Button Creates Linked Zman
**Given** I have NOT imported the master zman that this publisher zman links to
**When** I click the "Link" button
**Then** a `publisher_zmanim` record is created with:
- `master_zmanim_id` from the source publisher zman
- `linked_from_publisher_zman_id` set to the source publisher_zman.id
- `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl` copied from source
- `copied_from_publisher_id` is NULL (this is a link, not a copy)
**And** I am redirected to `/publisher/algorithm?focus={zman_key}`
**And** toast notification: "Linked to [Publisher Name]'s [Zman Name]"

### AC-8: Copy Button Creates Independent Copy
**Given** I have NOT imported the master zman that this publisher zman links to
**When** I click the "Copy" button
**Then** a `publisher_zmanim` record is created with:
- `master_zmanim_id` from the source publisher zman
- `copied_from_publisher_id` set to the source publisher.id
- `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl` copied from source
- `linked_from_publisher_zman_id` is NULL (this is a copy, not a link)
**And** I am redirected to `/publisher/algorithm?focus={zman_key}`
**And** toast notification: "Copied [Zman Name] from [Publisher Name]"

### AC-9: Duplicate Prevention
**Given** I have ALREADY imported the master zman (via any method: master import, link, or copy)
**When** I view a publisher zman card linking to that master
**Then** both Link and Copy buttons are disabled
**And** status shows "Already in Your Catalog" badge
**And** hovering over disabled buttons shows tooltip: "You already have this master zman"

### AC-10: Location Dropdown Initial State
**Given** the Other Publishers tab loads
**When** no publisher is selected yet
**Then** location dropdown is disabled
**And** helper text shows: "Select a publisher first to choose a location"

---

## Technical Notes

### Backend Implementation

**Database Schema:**
- Ensure `publisher_zmanim` table has:
  - `master_zmanim_id` (FK to master_zmanim_registry)
  - `linked_from_publisher_zman_id` (FK to publisher_zmanim, nullable)
  - `copied_from_publisher_id` (FK to publishers, nullable)
  - Unique constraint: `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`

**SQLc Queries:**
- `ListValidatedPublishers` - Get all approved publishers
- `ListPublisherZmanimForRegistry` - Get publisher's zmanim with ownership check
  - Join with master_zmanim_registry for category/shita
  - Left join with current user's publisher_zmanim to check ownership
  - Return `already_have_master` boolean flag
- `GetPublisherCoverageLocalities` - Get localities covered by publisher
- `LinkPublisherZman` - Insert publisher_zmanim with linked_from_publisher_zman_id
- `CopyPublisherZman` - Insert publisher_zmanim with copied_from_publisher_id
- `CheckPublisherHasMasterZman` - Check if current publisher already has this master zman

**API Endpoints:**

```
GET /api/v1/publisher/registry/publishers
Response: {
  publishers: [{
    id: number,
    name: string,
    status: string,
    description: string | null
  }]
}
Errors: 401 (not authenticated)

GET /api/v1/publisher/registry/publishers/{publisher_id}
Query params: locality_id, date, category, shita, status, search, page, limit
Response: {
  publisher: { id, name, description },
  zmanim: [{
    id: number,
    zman_key: string,
    hebrew_name: string,
    english_name: string,
    formula_dsl: string,
    preview_time: string,
    master_zman_name: string,
    master_zmanim_id: number,
    category: string,
    shita: string,
    already_have_master: boolean
  }],
  total: number,
  page: number,
  limit: number
}
Errors: 400 (invalid locality/publisher), 404 (publisher not found)

GET /api/v1/publisher/registry/coverage/{publisher_id}
Response: {
  localities: [{
    id: number,
    name: string,
    country: string,
    region: string,
    latitude: number,
    longitude: number
  }]
}
Errors: 404 (publisher not found)

POST /api/v1/publisher/registry/link
Request: { publisher_zmanim_id: number }
Response: {
  zman_key: string,
  message: string
}
Errors: 400 (already have master zman), 404 (source zman not found), 401/403 (auth)

POST /api/v1/publisher/registry/copy
Request: { publisher_zmanim_id: number }
Response: {
  zman_key: string,
  message: string
}
Errors: 400 (already have master zman), 404 (source zman not found), 401/403 (auth)
```

**Handler Implementation (6-step pattern):**

```go
// api/internal/handlers/publisher_registry.go

func (h *PublisherRegistryHandler) LinkPublisherZman(w http.ResponseWriter, r *http.Request) {
	// 1. Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)

	// 2. URL params (none)

	// 3. Parse body
	var req struct {
		PublisherZmanimID int64 `json:"publisher_zmanim_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// 4. Validate
	if req.PublisherZmanimID == 0 {
		RespondError(w, r, http.StatusBadRequest, "publisher_zmanim_id is required")
		return
	}

	// Get source zman
	sourceZman, err := h.db.Queries.GetPublisherZmanById(r.Context(), req.PublisherZmanimID)
	if err != nil {
		RespondError(w, r, http.StatusNotFound, "Source zman not found")
		return
	}

	// Check if current publisher already has this master zman
	exists, err := h.db.Queries.CheckPublisherHasMasterZman(r.Context(), db.CheckPublisherHasMasterZmanParams{
		PublisherID:     pc.Publisher.ID,
		MasterZmanimID: sourceZman.MasterZmanimID,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to check ownership")
		return
	}
	if exists {
		RespondError(w, r, http.StatusBadRequest, "You already have this master zman")
		return
	}

	// 5. SQLc query
	newZman, err := h.db.Queries.LinkPublisherZman(r.Context(), db.LinkPublisherZmanParams{
		PublisherID:              pc.Publisher.ID,
		MasterZmanimID:          sourceZman.MasterZmanimID,
		LinkedFromPublisherZmanID: sql.NullInt64{Int64: req.PublisherZmanimID, Valid: true},
		ZmanKey:                  sourceZman.ZmanKey,
		HebrewName:               sourceZman.HebrewName,
		EnglishName:              sourceZman.EnglishName,
		Description:              sourceZman.Description,
		FormulaDsl:               sourceZman.FormulaDsl,
	})
	if err != nil {
		RespondError(w, r, http.StatusInternalServerError, "Failed to link zman")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"zman_key": newZman.ZmanKey,
		"message":  "Zman linked successfully",
	})
}

// Similar pattern for CopyPublisherZman
```

### Frontend Implementation

**Components to Create:**

- `web/components/registry/RegistryPublisherBrowser.tsx` - Other Publishers tab
  - Publisher search autocomplete
  - Selected publisher display
  - Coverage-restricted location picker
  - Publisher zman cards with Link/Copy buttons
  - Filter panel
  - Pagination

**Reusable Components:**
- Reuse `ZmanCard.tsx` from master browser (extend with Link/Copy buttons)
- Reuse `RegistryLocationPicker.tsx` with coverage restriction
- Reuse `RegistryFilters.tsx` for category/shita filtering
- Reuse CodeMirror DSL syntax highlighting

**API Client Integration:**

```typescript
// web/lib/api-client.ts additions
export type PublisherExamplesParams = {
  locality_id?: number;
  date?: string;
  category?: string;
  shita?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export async function getValidatedPublishers(api: ApiClient) {
  return api.get('/publisher/registry/publishers');
}

export async function getPublisherCatalog(
  api: ApiClient,
  publisherId: number,
  params: PublisherExamplesParams
) {
  return api.get(`/publisher/registry/publishers/${publisherId}`, { params });
}

export async function getPublisherCoverage(api: ApiClient, publisherId: number) {
  return api.get(`/publisher/registry/coverage/${publisherId}`);
}

export async function linkPublisherZman(api: ApiClient, publisherZmanimId: number) {
  return api.post('/publisher/registry/link', { publisher_zmanim_id: publisherZmanimId });
}

export async function copyPublisherZman(api: ApiClient, publisherZmanimId: number) {
  return api.post('/publisher/registry/copy', { publisher_zmanim_id: publisherZmanimId });
}
```

### Performance Considerations

**Caching Strategy:**
- Publisher catalog: 1-hour TTL per publisher
- Coverage data: 24-hour TTL per publisher
- Preview calculations: 24-hour TTL per location/date/publisher_zman_id

**Pagination:**
- 50 items per page
- Lazy loading for cards
- Indexes on `publisher_zmanim.master_zmanim_id`, `master_zmanim_registry.category`, `master_zmanim_registry.shita`

**Query Optimization:**
- Single query joins master registry for category/shita
- Single query checks ownership (no N+1 queries)
- Coverage query pre-filters localities by publisher_coverage table

### Duplicate Prevention

**Multiple Layers:**
1. **Frontend:** Disable Link/Copy buttons if `already_have_master` is true
2. **Backend:** Check ownership before insert using `CheckPublisherHasMasterZman`
3. **Database:** Unique constraint on `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`

This ensures NO duplicates can be created even if client logic is bypassed.

---

## Dependencies

- **Story 11.0:** Data Foundation & Integrity Audit - REQUIRED
- **Story 11.1:** Master Registry Browser & Import Flow - REQUIRED
  - Reuses components (ZmanCard, filters, location picker)
  - Duplicate prevention logic

---

## Definition of Done

- [ ] Backend API endpoints implemented:
  - GET /api/v1/publisher/registry/publishers
  - GET /api/v1/publisher/registry/publishers/{publisher_id}
  - GET /api/v1/publisher/registry/coverage/{publisher_id}
  - POST /api/v1/publisher/registry/link
  - POST /api/v1/publisher/registry/copy
- [ ] SQLc queries created:
  - ListValidatedPublishers
  - ListPublisherZmanimForRegistry
  - GetPublisherCoverageLocalities
  - LinkPublisherZman
  - CopyPublisherZman
  - CheckPublisherHasMasterZman
- [ ] Frontend components created:
  - RegistryPublisherBrowser.tsx
  - Publisher search autocomplete
  - Coverage-restricted location picker
  - Publisher zman cards with Link/Copy buttons
- [ ] All 10 acceptance criteria pass
- [ ] Duplicate prevention verified:
  - UI disables buttons correctly
  - Backend rejects duplicates with 400 error
  - DB unique constraint prevents duplicates
- [ ] Redirect to `/publisher/algorithm?focus={zman_key}` works
- [ ] Toast notifications display correctly
- [ ] Performance targets met:
  - Publisher catalog loads in <2s (p95)
  - Preview calculations <500ms per zman
  - Search/filter <300ms
- [ ] Unit tests:
  - Handler tests for Link/Copy endpoints
  - Duplicate prevention tests
- [ ] Integration tests:
  - Full Link workflow
  - Full Copy workflow
  - Coverage restriction validation
- [ ] E2E tests (will be in Story 11.7):
  - Publisher search and selection
  - Link button creates correct record
  - Copy button creates correct record
  - Duplicate prevention
  - Location auto-clear on publisher switch
- [ ] Code review completed
- [ ] Documentation updated:
  - API endpoints documented
  - Component INDEX.md updated

---

## Dev Agent Record

### Implementation Notes

_This section will be filled during implementation._

**Backend Changes:**
- List of files created/modified
- SQLc queries implemented
- API endpoints added

**Frontend Changes:**
- Components created/modified
- API client methods added
- Routing updates

**Testing:**
- Unit tests added
- Integration tests added
- Manual QA results

**Status:** _pending/in_progress/done_

---

## FRs Covered

**From Epic 11:**
- FR21: Search for validated publishers
- FR22: Only validated publishers shown
- FR23: Select publisher to view catalog
- FR24: Location restricted to coverage
- FR25: Auto-clear location if not covered
- FR26: Publisher zman display fields
- FR27: Filter within publisher catalog
- FR30: Link button creates linked publisher_zmanim
- FR31: Link records linked_from_publisher_zman_id
- FR32: Copy button creates independent copy
- FR33: Copy records copied_from_publisher_id
- FR34: Link/Copy disabled if already have master
- FR35: Disabled buttons show tooltips
- FR36: Already-owned shows badges
- FR37: Success redirect with focus param

**Total:** 17 functional requirements
