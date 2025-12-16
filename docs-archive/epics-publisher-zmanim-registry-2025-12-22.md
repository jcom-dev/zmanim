# Epics & User Stories: Publisher Zmanim Registry Interface

**Date:** 2025-12-22
**Product Brief:** product-brief-publisher-zmanim-registry-2025-12-22.md
**Status:** Draft

---

## Epic Overview

This document breaks down the Publisher Zmanim Registry Interface into 7 logical epics with detailed user stories. Each epic represents a cohesive deliverable that can be developed and tested independently.

### Epic Dependency Map

```
Epic 1 (Master Registry Documentation) ─┐
Epic 2 (Data Integrity Audit)          ├──> Epic 3 (Master Registry Browser)
                                        │                 │
                                        │                 ├──> Epic 5 (Import/Link/Copy Actions)
                                        │                 │                 │
Epic 4 (Publisher Examples Browser) ────┘                 └──> Epic 6 (Algorithm Page Migration)
                                                                             │
Epic 7 (Info Modals & Documentation) ─────────────────────────────────────┘
```

**Critical Path:** Epic 1 → Epic 2 → Epic 3 → Epic 5 → Epic 6 → Epic 7
**Parallel Track:** Epic 4 (can develop alongside Epic 3)

---

## Epic 1: Master Registry Documentation (KosherJava Backfill)

**Goal:** Populate all master zmanim with comprehensive documentation sourced from KosherJava research to enable informed decision-making in the registry explorer.

**Business Value:** Without documentation, the registry is just a list of cryptic formulas. Documentation transforms it into an educational resource that builds publisher confidence.

**Dependencies:** None (foundational epic)

### User Stories

#### Story 1.1: Extract KosherJava Documentation

**As a** platform administrator
**I want** documentation extracted from KosherJava research files
**So that** I can populate master zmanim with authoritative information

**Acceptance Criteria:**

**Given** KosherJava research files exist in `docs/`
**When** I run the documentation extraction script
**Then** system extracts for each zman:
- Full description (comprehensive explanation)
- Halachic source (GRA, MGA, Baal Hatanya, etc.)
- Formula explanation (plain language)
- Usage context (when/where used)
- Related zmanim references

**And** output is structured JSON or CSV for database import
**And** extraction maps KosherJava method names to master zman keys
**And** unmapped methods are flagged for manual review

**Technical Notes:**
- Source files: `docs/README-KOSHERJAVA-RESEARCH.md`, `docs/kosherjava-zmanim-complete-extraction.md`
- Parse markdown sections for each zman method
- Map KosherJava naming conventions to DSL zman keys (e.g., `getAlos72()` → `@alos_hashachar_72min`)
- Output format: JSON array for bulk insert
- Handle variations in documentation format (some methods have more detail than others)

**Dependencies:** None

---

#### Story 1.2: Create Database Migration for Documentation Fields

**As a** platform administrator
**I want** new database columns for master zman documentation
**So that** documentation can be stored and retrieved efficiently

**Acceptance Criteria:**

**Given** master_zmanim_registry table exists
**When** migration is applied
**Then** new columns are added:
- `full_description` (TEXT, nullable initially)
- `halachic_source` (TEXT, nullable initially)
- `formula_explanation` (TEXT, nullable initially)
- `usage_context` (TEXT, nullable initially)
- `related_zmanim_ids` (INTEGER[], nullable)
- `shita` (TEXT, nullable) - standardized code (GRA, MGA, BAAL_HATANYA)
- `category` (TEXT, nullable) - primary category (ALOS, SHEMA, TZAIS, etc.)

**And** migration is reversible (has down migration)
**And** existing data is preserved
**And** indexes are created on `shita` and `category` for filtering

**Technical Notes:**
- Migration file: `db/migrations/YYYYMMDDHHMMSS_add_master_zman_documentation.sql`
- Use PostgreSQL array type for `related_zmanim_ids`
- Consider text search index on `full_description` for future search features
- Keep nullable initially to allow gradual backfill

**Dependencies:** None

---

#### Story 1.3: Backfill Documentation Data

**As a** platform administrator
**I want** extracted KosherJava documentation loaded into master_zmanim_registry
**So that** all zmanim have complete documentation before registry launch

**Acceptance Criteria:**

**Given** documentation extraction JSON exists
**And** database migration is applied
**When** I run the backfill script
**Then** 100% of master zmanim have `full_description` populated
**And** 100% have `halachic_source` populated
**And** 100% have `formula_explanation` populated
**And** 80%+ have `usage_context` populated (best effort)
**And** `shita` and `category` are standardized (using controlled vocabulary)

**And** script logs:
- Number of records updated
- Any missing mappings or errors
- Zmanim requiring manual documentation review

**And** verification query confirms no NULL values in required fields

**Technical Notes:**
- SQL script or Go program to bulk update records
- Match on `zman_key` field
- Use UPSERT pattern to avoid duplicates
- Log all updates for audit trail
- Create validation report showing coverage statistics
- Standardize shita values: "GRA", "MGA", "BAAL_HATANYA", "GEONIM", "RABBEINU_TAM"
- Standardize category values: "ALOS", "SHEMA", "TEFILLA", "CHATZOS", "MINCHA", "SHKIAH", "TZAIS"

**Dependencies:**
- Story 1.1 (extraction complete)
- Story 1.2 (migration applied)

---

#### Story 1.4: Populate Related Zmanim References

**As a** platform administrator
**I want** related zmanim linkages defined
**So that** users can discover alternative calculations and related concepts

**Acceptance Criteria:**

**Given** master zmanim exist with documentation
**When** related zmanim are identified
**Then** `related_zmanim_ids` array is populated with master zman IDs

**And** relationships are bidirectional (if A relates to B, B relates to A)
**And** relationships are semantically meaningful (e.g., alos 72 min relates to alos 90 min)

**And** common relationship patterns include:
- Alternative shita calculations (GRA vs MGA for same concept)
- Time range variations (72 min vs 90 min vs 120 min)
- Related halachic concepts (shkiah relates to tzais)

**Technical Notes:**
- Manual curation with SME review
- Document relationship rationale for audit
- Limit to 3-5 most relevant related zmanim per entry
- Consider categories: "alternative_calculation", "time_variant", "related_concept"
- Update script to validate IDs exist and avoid circular references

**Dependencies:**
- Story 1.3 (base documentation complete)

---

#### Story 1.5: Documentation Quality Validation

**As a** platform administrator
**I want** documentation quality validated before registry launch
**So that** publishers receive accurate, helpful information

**Acceptance Criteria:**

**Given** documentation backfill is complete
**When** validation script runs
**Then** it checks:
- No NULL values in required fields (`full_description`, `halachic_source`, `formula_explanation`)
- `shita` values match controlled vocabulary
- `category` values match controlled vocabulary
- `related_zmanim_ids` reference valid master zman IDs
- Text fields are not empty strings or placeholder text
- Formula explanation matches actual DSL formula (manual spot check)

**And** validation report generated with:
- Pass/fail status per zman
- List of issues requiring correction
- Coverage statistics

**And** 100% pass rate required before Epic 3 begins

**Technical Notes:**
- SQL validation queries for automated checks
- Export sample set for manual review (10-20 zmanim)
- Have SME review for halachic accuracy
- Check for common errors: copy-paste mistakes, formula mismatches
- Validate related_zmanim_ids don't create orphaned references

**Dependencies:**
- Story 1.3 (backfill complete)
- Story 1.4 (related zmanim populated)

---

## Epic 2: Data Integrity Audit (Publisher 1 Validation)

**Goal:** Ensure Publisher 1 (MH Zmanim) has 100% correct master_zmanim_id linkages to serve as quality example for platform.

**Business Value:** Publisher 1 data will be visible to all new publishers as examples. Incorrect linkages would teach wrong patterns and undermine trust.

**Dependencies:** Epic 1 (master registry documentation must exist to validate against)

### User Stories

#### Story 2.1: Extract Publisher 1 Catalog with Master Linkages

**As a** platform administrator
**I want** complete Publisher 1 data extracted with master registry mappings
**So that** I can analyze linkage accuracy

**Acceptance Criteria:**

**Given** Publisher 1 exists with publisher_zmanim records
**When** I run the extraction query
**Then** output includes for each Publisher 1 zman:
- `publisher_zmanim.id`
- `publisher_zmanim.zman_key`
- `publisher_zmanim.formula_dsl`
- `publisher_zmanim.master_zmanim_id` (may be NULL)
- `master_zmanim_registry.zman_key` (from linked master)
- `master_zmanim_registry.formula_dsl` (from linked master)
- `master_zmanim_registry.halachic_source`

**And** results exported to CSV for manual review
**And** query identifies:
- Total Publisher 1 zmanim count
- Zmanim with master linkage (has master_zmanim_id)
- Zmanim without master linkage (NULL master_zmanim_id)

**Technical Notes:**
- SQL query with LEFT JOIN to master_zmanim_registry
- Export to CSV for spreadsheet analysis
- Include metadata: zman name (Hebrew + English), shita, category
- Sort by category for easier review

**Dependencies:**
- Epic 1 complete (master registry populated)

---

#### Story 2.2: Formula Comparison Analysis

**As a** platform administrator
**I want** Publisher 1 formulas compared to linked master formulas
**So that** I can identify incorrect master_zmanim_id mappings

**Acceptance Criteria:**

**Given** Publisher 1 data extracted with master linkages
**When** comparison analysis runs
**Then** each zman is categorized as:
- **Exact Match:** Publisher formula = Master formula (✅ correct linkage)
- **Semantic Match:** Different syntax, same calculation (⚠️ verify linkage)
- **Mismatch:** Different calculations (🔴 wrong master_zmanim_id)
- **No Linkage:** master_zmanim_id is NULL (🔴 missing linkage)

**And** report includes:
- Count and percentage for each category
- Detailed list of mismatches with both formulas shown
- Detailed list of missing linkages
- Recommended corrections for each issue

**And** semantic matches flagged for manual SME review

**Technical Notes:**
- Comparison logic:
  - Exact: String equality after normalizing whitespace
  - Semantic: Parse both DSL expressions, compare AST (requires DSL parser)
  - Simple heuristic: Same base zman referenced (e.g., both use `sunrise`)
- Manual review needed for semantic matches (DSL parser may not catch all equivalences)
- Document comparison methodology for audit trail

**Dependencies:**
- Story 2.1 (data extracted)

---

#### Story 2.3: Identify Correct Master Mappings

**As a** platform administrator
**I want** correct master zman identified for each mismatched Publisher 1 zman
**So that** I can create correction migration script

**Acceptance Criteria:**

**Given** mismatches and missing linkages identified
**When** SME reviews each case
**Then** for each Publisher 1 zman:
- **Case 1 - Existing Master:** Identify correct master_zmanim_id from registry
- **Case 2 - New Master:** Flag for new master zman creation
- **Case 3 - Custom Formula:** Flag as publisher-specific (requires new master placeholder)

**And** correction plan documented with:
- Publisher zman ID
- Current master_zmanim_id (or NULL)
- Correct master_zmanim_id
- Rationale for change

**And** new master zmanim requirements documented (name, formula, documentation)

**Technical Notes:**
- Manual SME review required (halachic knowledge needed)
- Search master registry for similar formulas
- Consider shita and category when finding matches
- May need to create new master entries for Publisher 1 custom formulas
- Document decision rationale for each correction

**Dependencies:**
- Story 2.2 (mismatches identified)

---

#### Story 2.4: Create Master Zmanim for Publisher 1 Gaps

**As a** platform administrator
**I want** new master zmanim created for Publisher 1 unique formulas
**So that** all Publisher 1 zmanim can link to master registry

**Acceptance Criteria:**

**Given** Publisher 1 zmanim requiring new master entries identified
**When** new master zmanim are created
**Then** each new master entry has:
- `zman_key` (standardized naming)
- `formula_dsl` (canonical formula)
- `full_description`
- `halachic_source`
- `formula_explanation`
- `usage_context`
- `shita`
- `category`

**And** documentation quality matches existing master zmanim
**And** new entries logged in audit report

**Technical Notes:**
- SQL INSERT statements for new master zmanim
- Get next available master_zmanim_id
- Document source: "Created from Publisher 1 (MH Zmanim) custom formula"
- Follow documentation standards from Epic 1
- SME approval required for new entries

**Dependencies:**
- Story 2.3 (gaps identified)

---

#### Story 2.5: Apply Correction Migration

**As a** platform administrator
**I want** incorrect master_zmanim_id values corrected in database
**So that** Publisher 1 data has 100% accurate linkages

**Acceptance Criteria:**

**Given** correction plan approved
**And** new master zmanim created (if needed)
**When** correction migration applied
**Then** all Publisher 1 publisher_zmanim records updated with correct master_zmanim_id

**And** migration script:
- Updates each record with new master_zmanim_id
- Logs old and new values for audit
- Is reversible (has rollback)
- Validates all new master_zmanim_id references exist

**And** post-migration verification confirms:
- Zero Publisher 1 zmanim with NULL master_zmanim_id
- Zero formula mismatches between publisher and master
- 100% of Publisher 1 zmanim have valid master linkage

**And** final audit report generated

**Technical Notes:**
- Migration file: `db/migrations/YYYYMMDDHHMMSS_correct_publisher1_master_linkages.sql`
- Use UPDATE statements with explicit WHERE publisher_id = 1
- Include verification queries in migration
- Backup publisher_zmanim table before running
- Test migration on staging environment first

**Dependencies:**
- Story 2.3 (correction plan documented)
- Story 2.4 (new master entries created if needed)

---

## Epic 3: Master Registry Browser (Tab 1)

**Goal:** Build read-only master registry browser with location-based preview, filtering, and import capability.

**Business Value:** Core discovery interface enabling publishers to explore canonical zmanim definitions and adopt them with one click.

**Dependencies:**
- Epic 1 (documentation must exist)
- Epic 2 (data integrity validated)

### User Stories

#### Story 3.1: Master Registry List View

**As a** publisher
**I want** to browse all master zmanim in a paginated table
**So that** I can discover available canonical definitions

**Acceptance Criteria:**

**Given** I'm on `/publisher/registry` page
**And** "Master Registry" tab is selected
**When** page loads
**Then** I see a table showing:
- Zman name (Hebrew + English)
- DSL formula (syntax highlighted)
- Brief description (one-line summary)
- Category badge (e.g., "Dawn - Alos", "Evening - Tzais")
- Shita badge (e.g., "GRA", "MGA 72min")
- Status indicator ("Available to Import" or "Imported ✓")

**And** table is paginated (50 items per page)
**And** pagination controls show: current page, total pages, prev/next buttons
**And** formulas use CodeMirror syntax highlighting (same as algorithm editor)

**Technical Notes:**
- Frontend: New component `RegistryMasterBrowser.tsx`
- API endpoint: `GET /api/v1/publisher/registry/master`
- Query params: `?page=1&per_page=50`
- Response includes:
  - Array of master zmanim with documentation
  - `is_imported` boolean per zman (check if current publisher has it)
  - Total count for pagination
- Reuse CodeMirror DSL highlighting setup from formula editor
- Responsive design: table on desktop, cards on mobile

**Dependencies:**
- Epic 1 complete (documentation populated)

---

#### Story 3.2: Location-Based Preview Times

**As a** publisher
**I want** to select a location and see calculated preview times for each master zman
**So that** I can understand what each formula produces in a real-world context

**Acceptance Criteria:**

**Given** I'm viewing master registry list
**When** I select a location from location picker dropdown
**And** optionally change preview date (defaults to today)
**Then** each master zman row displays:
- Calculated preview time for selected location/date
- Time formatted as 12-hour with AM/PM (e.g., "5:42 AM")

**And** location picker:
- Searches geo_localities globally (autocomplete)
- Shows locality name, region, country
- Persists selection across tab switches
- Shows badge with selected location and date

**And** preview times update when location or date changes
**And** loading state shown while calculating times

**Technical Notes:**
- API endpoint: `GET /api/v1/publisher/registry/master?locality_id={id}&date={YYYY-MM-DD}`
- Backend calculates times using DSL executor for each master formula
- Return calculated_time_utc and formatted time string
- Frontend shows loading spinner during calculation
- Store location selection in React state (shared with Publisher Examples tab)
- Date picker defaults to today, allows selecting past/future dates

**Dependencies:**
- Story 3.1 (list view working)
- DSL executor can calculate times for arbitrary formulas

---

#### Story 3.3: Filter and Search Master Registry

**As a** publisher
**I want** to filter master zmanim by category, shita, and search text
**So that** I can quickly find relevant zmanim

**Acceptance Criteria:**

**Given** I'm viewing master registry list
**When** I use filter panel
**Then** I can filter by:
- **Category:** Multi-select dropdown (ALOS, SHEMA, TEFILLA, CHATZOS, MINCHA, SHKIAH, TZAIS)
- **Shita:** Multi-select dropdown (GRA, MGA, BAAL_HATANYA, GEONIM, RABBEINU_TAM)
- **Status:** Single select (All / Available to Import / Already Imported)
- **Text Search:** Searches zman name (Hebrew or English), formula keywords

**And** active filters shown as removable chips
**And** "Clear all filters" button resets all filters
**And** filter panel collapsible on mobile
**And** filtered results update in real-time
**And** pagination resets to page 1 when filters change

**Technical Notes:**
- API endpoint accepts filter params: `?category=ALOS,SHEMA&shita=GRA&status=available&search=sunrise`
- Backend filters with SQL WHERE clauses
- Frontend: Collapsible filter sidebar (desktop) or drawer (mobile)
- Use React Query to cache filtered results
- Debounce text search (300ms) to avoid excessive API calls

**Dependencies:**
- Story 3.1 (list view working)

---

#### Story 3.4: Import from Master Registry

**As a** publisher
**I want** to import a master zman into my catalog with one click
**So that** I can quickly adopt canonical definitions

**Acceptance Criteria:**

**Given** I'm viewing a master zman I haven't imported
**When** I click "Import" button
**Then** system creates new `publisher_zmanim` record with:
- `master_zmanim_id` set to imported master zman ID
- `formula_dsl` copied from master
- `zman_key` auto-generated (e.g., `@{master_key}`)
- Default visibility settings from publisher config

**And** button changes to "Imported ✓" (disabled)
**And** success message shown: "Imported successfully"
**And** I'm redirected to `/publisher/algorithm?focus={zman_key}`
**And** algorithm page scrolls to and highlights newly imported zman

**And** import fails if:
- I already have a publisher zman with same master_zmanim_id
- Error message: "You already have this master zman in your catalog"

**Technical Notes:**
- API endpoint: `POST /api/v1/publisher/registry/import`
- Request body: `{ master_zmanim_id: number }`
- Backend:
  - Validate no existing publisher_zmanim with same master_zmanim_id for current publisher
  - Create publisher_zmanim record
  - Return new zman_key
- Frontend:
  - Optimistic UI update (disable button immediately)
  - On success: router.push with focus parameter
  - On error: revert UI, show error toast

**Dependencies:**
- Story 3.1 (list view working)

---

#### Story 3.5: Master Zman Ownership Indicators

**As a** publisher
**I want** clear visual indicators showing which master zmanim I've already imported
**So that** I don't waste time trying to import duplicates

**Acceptance Criteria:**

**Given** I'm viewing master registry list
**When** page loads
**Then** for each master zman:
- If I have imported it: Shows "Imported ✓" badge, Import button disabled
- If I haven't imported it: Shows "Available to Import" badge, Import button enabled

**And** tooltip on disabled Import button explains: "You already have this master zman"
**And** greyed-out row styling for imported zmanim (optional visual enhancement)
**And** status filter allows showing only available or only imported zmanim

**Technical Notes:**
- Backend checks if current publisher has publisher_zmanim with matching master_zmanim_id
- Return `is_imported: boolean` for each master zman
- Frontend applies conditional styling and button states
- Consider adding visual hierarchy: available zmanim more prominent

**Dependencies:**
- Story 3.1 (list view working)

---

#### Story 3.6: Request Addition to Master Registry

**As a** publisher
**I want** to request a new master zman be added to the registry
**So that** missing canonical definitions can be included for all publishers

**Acceptance Criteria:**

**Given** I'm on master registry tab
**When** I click "Request Addition" button (in page header)
**Then** existing `RequestZmanModal` component opens

**And** modal pre-populates:
- Source context: "master_registry"
- Request type: "addition"

**And** I can submit request with:
- Zman name (Hebrew + English)
- DSL formula (optional - for suggestions)
- Halachic source reference
- Description of need

**And** request submitted to admin review queue
**And** success message: "Request submitted for admin review"
**And** modal closes

**Technical Notes:**
- Reuse existing `RequestZmanModal` component from algorithm page
- API endpoint: `POST /api/v1/publisher/registry/request-addition`
- Store request in database with status "pending_review"
- Admin notification (email or dashboard alert) - out of scope for MVP
- No request tracking for MVP (fire-and-forget)

**Dependencies:**
- Existing RequestZmanModal component available

---

## Epic 4: Publisher Examples Browser (Tab 2)

**Goal:** Build publisher examples browser enabling publishers to explore real-world implementations from validated peers with link/copy capability.

**Business Value:** Social learning through real examples accelerates publisher confidence and reduces trial-and-error.

**Dependencies:** Epic 2 (Publisher 1 data must be validated to serve as quality example)

### User Stories

#### Story 4.1: Publisher Selection and Catalog Display

**As a** publisher
**I want** to search and select a validated publisher to view their zmanim catalog
**So that** I can learn from real-world examples

**Acceptance Criteria:**

**Given** I'm on `/publisher/registry` page
**And** "Publisher Examples" tab is selected
**When** page loads
**Then** I see:
- Publisher search dropdown (autocomplete)
- Empty state: "Select a publisher to view their zmanim"

**When** I search for a publisher
**Then** autocomplete shows validated publishers matching search query
**And** dropdown displays: Publisher name, status badge ("Validated")

**When** I select a publisher
**Then** their full zmanim catalog loads in table with columns:
- Zman name (may be customized by publisher)
- Publisher name (attribution - prominently displayed)
- DSL formula (syntax highlighted)
- "Validated Publisher" badge
- Master registry name (inherited from master linkage)
- Shita badge (inherited from master)
- Category badge (inherited from master)

**And** table is paginated (50 items per page)

**Technical Notes:**
- Frontend component: `RegistryPublisherBrowser.tsx`
- API endpoints:
  - `GET /api/v1/publisher/registry/publishers` - List validated publishers
  - `GET /api/v1/publisher/registry/publishers/{id}` - Get publisher zmanim
- Query for validated publishers: `status = 'approved' AND deleted_at IS NULL AND suspended_at IS NULL AND inactive_at IS NULL`
- Cache publisher list (rarely changes)
- Store selected publisher in React state

**Dependencies:** None (can develop in parallel with Epic 3)

---

#### Story 4.2: Location-Based Preview with Coverage Restriction

**As a** publisher
**I want** to see preview times for selected publisher's zmanim at a specific location
**So that** I understand how their formulas calculate in real-world context

**Acceptance Criteria:**

**Given** I've selected a publisher
**When** I select a location from location dropdown
**Then** only localities where selected publisher has coverage are available

**And** each publisher zman row displays:
- Calculated preview time for selected location/date
- Time formatted as 12-hour with AM/PM

**And** if I switch to a different publisher:
- If new publisher doesn't cover current location, location is auto-cleared
- Message shown: "Location not covered by [Publisher Name]. Please select a new location."

**And** location selection persists across tab switches (shared with Master Registry tab)

**Technical Notes:**
- API endpoint: `GET /api/v1/publisher/registry/coverage/{publisher_id}` - Returns covered localities
- Location dropdown filters to only show localities in coverage array
- Frontend validates location against new publisher's coverage when publisher changes
- Share location state with Master Registry tab (lift state to parent component)
- Calculate times using selected publisher's formulas (not master formulas)

**Dependencies:**
- Story 4.1 (publisher selection working)

---

#### Story 4.3: Filter Publisher Catalog

**As a** publisher
**I want** to filter selected publisher's zmanim by category, shita, and search text
**So that** I can quickly find specific examples

**Acceptance Criteria:**

**Given** I'm viewing a publisher's zmanim catalog
**When** I use filter panel
**Then** I can filter by:
- **Text Search:** Searches zman name, formula keywords
- **Category:** Multi-select dropdown (inherited from master)
- **Shita:** Multi-select dropdown (inherited from master)
- **Status:** "Available" or "Already in Your Catalog"

**And** active filters shown as removable chips
**And** "Clear all filters" button resets all filters
**And** filtered results update in real-time
**And** pagination resets to page 1 when filters change

**Technical Notes:**
- API endpoint: `GET /api/v1/publisher/registry/publishers/{id}?category=ALOS&shita=GRA&search=sunrise&status=available`
- Backend joins to master_zmanim_registry to filter by inherited category/shita
- Frontend reuses filter component from Master Registry tab (Epic 3)
- Check ownership: does current publisher have publisher_zmanim with same master_zmanim_id?

**Dependencies:**
- Story 4.1 (publisher catalog display working)

---

#### Story 4.4: Link to Another Publisher's Zman

**As a** publisher
**I want** to create a reference link to another publisher's zman
**So that** I can adopt their exact implementation without duplicating

**Acceptance Criteria:**

**Given** I'm viewing another publisher's zman I don't already have
**When** I click "Link" button
**Then** system creates new `publisher_zmanim` record with:
- `master_zmanim_id` (inherited from source zman)
- `formula_dsl` (copied from source zman)
- `linked_from_publisher_zman_id` (set to source publisher_zmanim.id)
- `zman_key` auto-generated

**And** button changes to "Linked ✓" (disabled)
**And** success message: "Linked successfully"
**And** I'm redirected to `/publisher/algorithm?focus={zman_key}`
**And** algorithm page scrolls to and highlights newly linked zman

**And** link fails if:
- I already have ANY publisher zman with same master_zmanim_id
- Error message: "You already have this master zman in your catalog"

**Technical Notes:**
- API endpoint: `POST /api/v1/publisher/registry/link`
- Request body: `{ publisher_zman_id: number }`
- Backend:
  - Look up source publisher_zman, get its master_zmanim_id
  - Validate current publisher doesn't have zman with that master_zmanim_id
  - Create publisher_zmanim with linked_from_publisher_zman_id
- Frontend: Optimistic UI, redirect on success

**Dependencies:**
- Story 4.1 (publisher catalog display working)

---

#### Story 4.5: Copy Another Publisher's Formula

**As a** publisher
**I want** to copy another publisher's formula as an independent zman
**So that** I can use it as a starting point for customization

**Acceptance Criteria:**

**Given** I'm viewing another publisher's zman I don't already have
**When** I click "Copy" button
**Then** system creates new `publisher_zmanim` record with:
- `master_zmanim_id` (inherited from source zman)
- `formula_dsl` (copied from source zman)
- `copied_from_publisher_id` (set to source publisher's ID)
- `zman_key` auto-generated
- No ongoing link (independent copy)

**And** button changes to "Copied ✓" (disabled)
**And** success message: "Copied successfully"
**And** I'm redirected to `/publisher/algorithm?focus={zman_key}`
**And** algorithm page scrolls to and highlights newly copied zman

**And** copy fails if:
- I already have ANY publisher zman with same master_zmanim_id
- Error message: "You already have this master zman in your catalog"

**Technical Notes:**
- API endpoint: `POST /api/v1/publisher/registry/copy`
- Request body: `{ publisher_zman_id: number }`
- Backend:
  - Look up source publisher_zman, get its master_zmanim_id and formula
  - Validate current publisher doesn't have zman with that master_zmanim_id
  - Create publisher_zmanim with copied_from_publisher_id (attribution)
- Difference from Link: No linked_from_publisher_zman_id (standalone copy)

**Dependencies:**
- Story 4.1 (publisher catalog display working)

---

#### Story 4.6: Publisher Zman Ownership Indicators

**As a** publisher
**I want** clear visual indicators showing which publisher zmanim I've already imported/linked/copied
**So that** I don't create duplicate entries

**Acceptance Criteria:**

**Given** I'm viewing a publisher's zmanim catalog
**When** page loads
**Then** for each publisher zman:
- If I already have it (by master_zmanim_id): Shows badge "Already in Your Catalog", Link/Copy buttons disabled
- If I don't have it: Shows "Available" badge, Link/Copy buttons enabled

**And** tooltip on disabled buttons explains: "You already have this master zman"
**And** detection logic: Check if current publisher has ANY publisher_zmanim where master_zmanim_id = target.master_zmanim_id
**And** works regardless of how zman was added (import, link, or copy)

**Technical Notes:**
- Backend returns `is_owned: boolean` for each publisher zman
- Check current publisher's publisher_zmanim for matching master_zmanim_id
- Frontend applies conditional styling and disables buttons
- Clear visual distinction between available and owned zmanim

**Dependencies:**
- Story 4.1 (publisher catalog display working)

---

## Epic 5: Import/Link/Copy Actions

**Goal:** Implement robust backend logic and database operations for import/link/copy actions with duplicate prevention and validation.

**Business Value:** Core platform functionality enabling safe zman adoption without data integrity issues.

**Dependencies:**
- Epic 3 (Master Registry browser needs these endpoints)
- Epic 4 (Publisher Examples browser needs these endpoints)

### User Stories

#### Story 5.1: Import Action Backend

**As a** publisher
**I want** the import action to create a proper publisher_zmanim record
**So that** I can adopt master zmanim safely

**Acceptance Criteria:**

**Given** I submit an import request
**When** backend processes request
**Then** it validates:
- Current publisher doesn't have ANY publisher_zmanim with same master_zmanim_id
- master_zmanim_id exists in master_zmanim_registry
- Publisher is active (not suspended/deleted/inactive)

**And** if validation passes:
- Creates publisher_zmanim record
- Sets master_zmanim_id
- Copies formula_dsl from master
- Auto-generates zman_key (unique for publisher)
- Sets created_at, updated_at timestamps
- Returns new zman_key and id

**And** if validation fails:
- Returns 400 error with descriptive message
- No database changes

**Technical Notes:**
- SQLc query: `queries/publisher_registry.sql` → `ImportMasterZman`
- Transaction: Check duplicate → Insert
- Handler: `handlers/publisher_registry.go` → `HandleImportMasterZman`
- Validation:
  - Check publisher_zmanim WHERE publisher_id = current AND master_zmanim_id = requested
  - Check master_zmanim_registry WHERE id = requested
- Generate zman_key: Use master zman_key as base, ensure uniqueness for publisher
- Return JSON: `{ id, zman_key, message: "Imported successfully" }`

**Dependencies:** None (foundational)

---

#### Story 5.2: Link Action Backend

**As a** publisher
**I want** the link action to create a reference to another publisher's zman
**So that** I can adopt proven implementations with attribution

**Acceptance Criteria:**

**Given** I submit a link request
**When** backend processes request
**Then** it validates:
- Source publisher_zman exists
- Current publisher doesn't have ANY publisher_zman with same master_zmanim_id
- Publisher is active

**And** if validation passes:
- Creates publisher_zmanim record
- Sets master_zmanim_id (from source zman)
- Copies formula_dsl (from source zman)
- Sets linked_from_publisher_zman_id (source zman id)
- Auto-generates zman_key
- Returns new zman_key and id

**And** if validation fails:
- Returns 400 error with descriptive message

**Technical Notes:**
- SQLc query: `LinkPublisherZman`
- Transaction:
  1. Look up source publisher_zman, get master_zmanim_id and formula
  2. Check current publisher doesn't have that master_zmanim_id
  3. Insert with linked_from_publisher_zman_id
- Handler: `HandleLinkPublisherZman`
- Track attribution: linked_from_publisher_zman_id enables "Linked from [Publisher]" display

**Dependencies:** None (foundational)

---

#### Story 5.3: Copy Action Backend

**As a** publisher
**I want** the copy action to create an independent duplicate of another publisher's zman
**So that** I can customize it without affecting the source

**Acceptance Criteria:**

**Given** I submit a copy request
**When** backend processes request
**Then** it validates:
- Source publisher_zman exists
- Current publisher doesn't have ANY publisher_zman with same master_zmanim_id
- Publisher is active

**And** if validation passes:
- Creates publisher_zmanim record
- Sets master_zmanim_id (from source zman)
- Copies formula_dsl (from source zman)
- Sets copied_from_publisher_id (source publisher id, not zman id)
- Auto-generates zman_key
- Returns new zman_key and id

**And** if validation fails:
- Returns 400 error with descriptive message

**Technical Notes:**
- SQLc query: `CopyPublisherZman`
- Transaction:
  1. Look up source publisher_zman, get master_zmanim_id, formula, publisher_id
  2. Check current publisher doesn't have that master_zmanim_id
  3. Insert with copied_from_publisher_id
- Handler: `HandleCopyPublisherZman`
- Difference from Link: Uses copied_from_publisher_id (publisher, not zman) and no ongoing reference

**Dependencies:** None (foundational)

---

#### Story 5.4: Duplicate Prevention Database Constraints

**As a** platform administrator
**I want** database constraints preventing duplicate master_zmanim_id per publisher
**So that** data integrity is enforced at the database level

**Acceptance Criteria:**

**Given** publisher_zmanim table exists
**When** migration is applied
**Then** unique constraint added:
- UNIQUE(publisher_id, master_zmanim_id)

**And** constraint prevents:
- Publisher from having multiple publisher_zmanim with same master_zmanim_id
- Duplicate imports/links/copies

**And** attempting to insert duplicate returns database error
**And** migration is reversible

**Technical Notes:**
- Migration file: `db/migrations/YYYYMMDDHHMMSS_unique_publisher_master_zman.sql`
- PostgreSQL constraint: `ALTER TABLE publisher_zmanim ADD CONSTRAINT unique_publisher_master_zman UNIQUE (publisher_id, master_zmanim_id);`
- Check for existing duplicates before applying constraint
- If duplicates exist, require cleanup first
- Backend should check before insert to provide user-friendly error (don't rely on DB error alone)

**Dependencies:** None (foundational)

---

#### Story 5.5: Attribution Metadata Fields

**As a** platform administrator
**I want** attribution fields in publisher_zmanim table
**So that** we can track import/link/copy sources

**Acceptance Criteria:**

**Given** publisher_zmanim table exists
**When** migration is applied
**Then** new nullable columns added:
- `linked_from_publisher_zman_id` (INTEGER, nullable, foreign key to publisher_zmanim.id)
- `copied_from_publisher_id` (INTEGER, nullable, foreign key to publishers.id)

**And** migration is reversible
**And** existing data preserved (columns NULL for existing records)

**Technical Notes:**
- Migration file: `db/migrations/YYYYMMDDHHMMSS_add_attribution_fields.sql`
- Foreign key constraints:
  - linked_from_publisher_zman_id REFERENCES publisher_zmanim(id) ON DELETE SET NULL
  - copied_from_publisher_id REFERENCES publishers(id) ON DELETE SET NULL
- SET NULL on delete: If source is deleted, attribution remains but reference is cleared
- Index on linked_from_publisher_zman_id for performance (future queries: "who linked to this zman?")

**Dependencies:** None (foundational)

---

#### Story 5.6: Request Addition Endpoint

**As a** publisher
**I want** to submit requests for new master zmanim
**So that** missing canonical definitions can be added by admins

**Acceptance Criteria:**

**Given** I submit a request addition form
**When** backend processes request
**Then** it validates:
- Publisher is authenticated and active
- Required fields provided (zman name, description)
- Optional fields: formula_dsl, halachic_source

**And** creates request record with:
- publisher_id (requester)
- request_type: "addition"
- source_context: "master_registry" or "publisher_examples"
- status: "pending_review"
- request_data JSON (name, description, formula, etc.)
- created_at timestamp

**And** returns success response
**And** admin notification sent (email or dashboard) - deferred to future

**Technical Notes:**
- SQLc query: `CreateZmanRequest`
- Table: `zman_requests` (may need to create)
- Handler: `HandleRequestAddition`
- Store request_data as JSONB for flexibility
- No status tracking UI in MVP (fire-and-forget from publisher perspective)
- Admin review workflow out of scope for MVP

**Dependencies:** None (foundational)

---

## Epic 6: Algorithm Page Migration (Greenfield Cleanup)

**Goal:** Remove all zman addition functionality from algorithm page, achieving complete separation of concerns between registry (add) and algorithm (edit).

**Business Value:** Cleaner UX, reduced code complexity, and clear mental model for publishers.

**Dependencies:** Epic 5 (Import/Link/Copy actions must work before removing old add functionality)

### User Stories

#### Story 6.1: Remove Add Zman Dialog

**As a** developer
**I want** the "Add Zman" dialog and all related components removed from algorithm page
**So that** we achieve clean separation of concerns

**Acceptance Criteria:**

**Given** algorithm page source code
**When** cleanup is complete
**Then** the following are DELETED:
- "Add Zman" button (in page header)
- `showAddZmanModeDialog` state and setter
- `showZmanPicker` state and setter
- `showPublisherZmanPicker` state and setter
- `showRequestZmanModal` state and setter
- Entire "Add Zman Mode" dialog component (lines ~1144-1238)
- All related handlers (handleAddZman, etc.)

**And** imports removed:
- `MasterZmanPicker` component
- `PublisherZmanPicker` component
- `RequestZmanModal` component (will be used in registry page instead)

**And** no compilation errors
**And** algorithm page still renders correctly

**Technical Notes:**
- File: `web/app/(protected)/publisher/algorithm/page.tsx`
- Search for all references to add zman functionality
- Remove state declarations, handlers, imports, JSX
- Test page still works after removal (edit functionality intact)
- Commit message: "refactor: remove add zman functionality from algorithm page"

**Dependencies:**
- Epic 5 complete (registry import/link/copy working)

---

#### Story 6.2: Add Browse Registry Button

**As a** publisher
**I want** a prominent "Browse Registry" button on algorithm page
**So that** I can easily navigate to add new zmanim

**Acceptance Criteria:**

**Given** I'm on algorithm page
**When** page loads
**Then** I see "Browse Registry" button in page header

**And** button is prominently styled (primary action)
**And** clicking button navigates to `/publisher/registry`
**And** button includes icon (e.g., search or catalog icon)
**And** tooltip explains: "Discover and import zmanim from master registry or other publishers"

**Technical Notes:**
- Add button next to existing page actions
- Use Next.js Link component for client-side navigation
- Icon: Use existing icon library (e.g., MagnifyingGlassIcon)
- Styling: Match existing primary buttons in the app
- Position: Top-right of page header, before other action buttons

**Dependencies:**
- Story 6.1 (old add functionality removed)

---

#### Story 6.3: Focus Parameter Handling

**As a** publisher
**I want** the algorithm page to scroll to and highlight a specific zman when navigated with focus parameter
**So that** I can immediately see newly imported/linked/copied zmanim

**Acceptance Criteria:**

**Given** I navigate to `/publisher/algorithm?focus={zman_key}`
**When** page loads
**Then** page scrolls to zman with matching zman_key
**And** zman card is highlighted with visual emphasis (e.g., border or background color)
**And** highlight fades after 2 seconds

**And** if zman_key not found:
- No error shown
- Page loads normally (no highlight)

**Technical Notes:**
- Parse URL param `focus` on page load
- Find zman card element by zman_key (data attribute)
- Use `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Add temporary CSS class for highlight effect
- Remove class after 2s timeout
- Use useEffect hook to trigger on mount when focus param present

**Dependencies:**
- Story 6.2 (navigation flow established)

---

#### Story 6.4: Update Algorithm Page Documentation

**As a** developer
**I want** algorithm page documentation updated to reflect new navigation flow
**So that** future developers understand the separated concerns

**Acceptance Criteria:**

**Given** algorithm page code
**When** documentation is updated
**Then** code comments explain:
- Algorithm page is for EDITING existing zmanim only
- Adding zmanim happens in `/publisher/registry`
- Focus parameter usage for post-import navigation

**And** component README updated (if exists)
**And** CLAUDE.md updated with new navigation flow (if applicable)

**Technical Notes:**
- Add JSDoc comment at top of component file
- Update any inline comments referencing add functionality
- Add note about focus parameter behavior
- Document the separation of concerns principle

**Dependencies:**
- Story 6.3 (focus handling implemented)

---

## Epic 7: Info Modals & Documentation Display

**Goal:** Create full-screen modals displaying comprehensive master zman documentation and publisher-specific details.

**Business Value:** Educational content transforms registry from simple catalog to learning platform, building publisher confidence.

**Dependencies:**
- Epic 1 (documentation must exist)
- Epic 3 or Epic 4 (modals triggered from these browsers)

### User Stories

#### Story 7.1: Master Zman Detail Modal Component

**As a** publisher
**I want** to view comprehensive documentation for a master zman in a modal
**So that** I can understand its halachic significance and usage

**Acceptance Criteria:**

**Given** I click info button (ℹ️) on a master zman
**When** modal opens
**Then** I see full-screen modal with sections:
- **Header:** Zman name (Hebrew + English), zman_key
- **Summary:** Brief one-line description
- **DSL Formula:** Syntax-highlighted formula with copy button
- **Scientific Explanation:** Plain language explanation
- **Astronomical Definition:** Technical astronomical details
- **Algorithm:** Calculation method (e.g., "NOAA Solar Calculator")
- **Halachic Significance:** How this zman is used in halacha
- **Halachic Sources:** Which poskim/opinions (expandable cards)
- **Practical Notes:** Usage context, when applicable
- **Related Zmanim:** Clickable links to similar calculations

**And** clicking related zman link closes current modal and opens new modal for that zman
**And** modal is scrollable (content may be long)
**And** close button in top-right corner
**And** pressing ESC key closes modal

**Technical Notes:**
- Component: `MasterZmanDetailModal.tsx`
- Props: `master_zmanim_id`, `onClose`, `onNavigateToRelated`
- API endpoint: `GET /api/v1/publisher/registry/master/{id}` - Get full documentation
- Use headlessui Dialog for accessibility
- Copy button uses clipboard API
- Related zmanim: Render as clickable chips/links
- Responsive design: Full-screen on mobile, large modal on desktop

**Dependencies:**
- Epic 1 (documentation populated)

---

#### Story 7.2: Publisher Zman Detail Modal Component

**As a** publisher
**I want** to view another publisher's zman details with inherited master documentation
**So that** I understand both their customization and the underlying halachic source

**Acceptance Criteria:**

**Given** I click info button (ℹ️) on a publisher's zman
**When** modal opens
**Then** I see full-screen modal with two sections:

**Top Section - Publisher Fields:**
- Zman name (Hebrew + English - may be customized)
- Publisher name (attribution)
- DSL formula (publisher's version - syntax highlighted)
- Custom notes/overrides (if any)
- Attribution: "Copied from [Publisher]" or "Linked to [Publisher]" (if applicable)

**Bottom Section - Master Zman Documentation (Inherited):**
- All fields from Master Zman Detail Modal
- Scientific explanation, halachic significance, sources, etc.
- Clearly labeled "From Master Registry"

**And** modal is scrollable
**And** close button and ESC key work
**And** related zmanim clickable (navigates within modals)

**Technical Notes:**
- Component: `PublisherZmanDetailModal.tsx`
- Props: `publisher_zmanim_id`, `onClose`, `onNavigateToRelated`
- API endpoint: `GET /api/v1/publisher/registry/publishers/{publisher_id}/zmanim/{zman_id}` - Get publisher zman + master documentation
- Reuse layout/sections from MasterZmanDetailModal for inherited content
- Visual separation between publisher customization and master documentation
- Consider tabbed interface if content is very long

**Dependencies:**
- Epic 1 (master documentation populated)
- Story 7.1 (MasterZmanDetailModal component exists - can reuse sections)

---

#### Story 7.3: Halachic Sources Expandable Cards

**As a** publisher
**I want** halachic sources displayed as expandable cards
**So that** I can explore detailed source information without overwhelming the modal

**Acceptance Criteria:**

**Given** master zman modal shows halachic sources
**When** I view sources section
**Then** each source displayed as card with:
- Source name (e.g., "Gra - Vilna Gaon")
- Brief summary (collapsed by default)
- Expand/collapse toggle

**When** I click expand
**Then** card shows detailed information:
- Full halachic opinion
- Relevant quotes or references
- Time period / geographic context
- Links to related sources (if applicable)

**And** multiple sources can be expanded simultaneously
**And** smooth animation on expand/collapse

**Technical Notes:**
- Use headlessui Disclosure component for accordion behavior
- Store halachic sources as JSONB in master_zmanim_registry
- Schema: Array of `{ name, summary, full_text, references }`
- CSS transition for smooth expand/collapse
- Consider limiting to 5-7 most relevant sources per zman

**Dependencies:**
- Story 7.1 (modal component exists)
- Epic 1 (sources documented)

---

#### Story 7.4: Related Zmanim Navigation

**As a** publisher
**I want** to navigate between related zmanim without closing the modal
**So that** I can explore interconnected concepts efficiently

**Acceptance Criteria:**

**Given** I'm viewing a master zman modal
**And** related zmanim section shows clickable links
**When** I click a related zman link
**Then** current modal content fades out
**And** new modal content fades in for selected related zman
**And** modal remains open (doesn't close and reopen)
**And** back/forward browser buttons don't affect modal navigation (client-side only)

**And** clicking same related zman multiple times doesn't cause issues

**Technical Notes:**
- Modal component manages own navigation state
- Props: `initialMasterZmanimId`, `onClose`
- Internal state: `currentMasterZmanimId`
- Fetch new data when currentMasterZmanimId changes
- Use loading state during fetch
- CSS transition for smooth content swap
- Consider breadcrumb trail showing navigation history within modal

**Dependencies:**
- Story 7.1 (modal component exists)

---

#### Story 7.5: Formula Copy to Clipboard

**As a** publisher
**I want** one-click copy of DSL formulas
**So that** I can easily paste them elsewhere

**Acceptance Criteria:**

**Given** I'm viewing a master or publisher zman modal
**When** I click copy button next to formula
**Then** formula text copied to clipboard
**And** button shows visual feedback: "Copied!" (2 seconds)
**And** button returns to "Copy" state after 2 seconds

**And** if clipboard API fails:
- Fallback: Select formula text for manual copy
- Show message: "Select and press Ctrl+C to copy"

**Technical Notes:**
- Use Clipboard API: `navigator.clipboard.writeText(formulaText)`
- Handle permission errors gracefully
- Fallback for browsers without clipboard API: select text in hidden input
- Button state: "Copy" → "Copied!" → "Copy"
- Use setTimeout for state reset
- Icon change: clipboard icon → checkmark → clipboard icon

**Dependencies:**
- Story 7.1 or 7.2 (modal components exist)

---

#### Story 7.6: Modal Accessibility

**As a** publisher using screen reader or keyboard-only navigation
**I want** modals to be fully accessible
**So that** I can explore documentation regardless of input method

**Acceptance Criteria:**

**Given** modal is open
**Then** it meets accessibility standards:
- Focus trapped within modal (tab cycles through modal elements only)
- ESC key closes modal
- Focus returns to trigger button when modal closes
- Proper ARIA attributes (role="dialog", aria-labelledby, aria-describedby)
- Screen reader announces modal opening and content
- All interactive elements keyboard accessible
- Related zmanim links navigable via keyboard
- Expandable sections work with keyboard (Enter/Space to toggle)

**And** color contrast meets WCAG AA standards
**And** no content hidden from screen readers

**Technical Notes:**
- Use headlessui Dialog component (built-in accessibility)
- Focus trap: headlessui handles automatically
- Test with NVDA/JAWS screen readers
- Test keyboard navigation thoroughly
- Use semantic HTML (headings, sections, lists)
- Ensure copy button has aria-label
- Test color contrast with accessibility tools

**Dependencies:**
- Story 7.1 and 7.2 (modal components exist)

---

## Implementation Timeline Estimate

### Phase 1: Foundation (2-3 weeks)
- **Week 1:** Epic 1 (Master Registry Documentation)
  - Extract KosherJava docs, create migration, backfill data
- **Week 2:** Epic 2 (Data Integrity Audit)
  - Audit Publisher 1, create corrections, apply migration
- **Week 3:** Epic 5 Stories 5.1-5.5 (Backend Foundation)
  - Import/Link/Copy endpoints, database constraints

### Phase 2: Core Browsers (2-3 weeks)
- **Week 4:** Epic 3 (Master Registry Browser)
  - List view, filters, preview times, import action
- **Week 5:** Epic 4 (Publisher Examples Browser)
  - Publisher selection, catalog display, link/copy actions
- **Week 6:** Epic 7 Stories 7.1-7.3 (Modals - Part 1)
  - Master modal, publisher modal, sources cards

### Phase 3: Integration & Polish (1-2 weeks)
- **Week 7:** Epic 6 (Algorithm Page Migration)
  - Remove add functionality, add browse button, focus handling
- **Week 8:** Epic 7 Stories 7.4-7.6 (Modals - Part 2)
  - Related zmanim navigation, clipboard, accessibility
- **Week 8:** Integration testing, bug fixes, polish

### Total Estimated Timeline: 5-8 weeks

**Note:** Timeline assumes:
- Single developer full-time
- SME available for halachic review (Epic 1, Epic 2)
- Existing DSL executor working for preview calculations
- No major architectural changes required

---

## Success Metrics

### Pre-Launch Validation
- ✅ 100% master zmanim have documentation (Epic 1)
- ✅ 100% Publisher 1 zmanim have correct master linkages (Epic 2)
- ✅ All API endpoints return < 500ms (95th percentile)
- ✅ Accessibility audit passes WCAG AA

### Post-Launch (30 days)
- 70%+ new publishers browse registry in first week
- 50%+ new publishers import ≥1 master zman
- 30%+ explore publisher examples tab
- < 5% duplicate zman request submissions
- Zero duplicate zmanim created (constraint works)

### Quality Metrics
- < 2% error rate on import/link/copy actions
- > 95% success rate on modal interactions
- Average time to first zman import < 5 minutes (from registry discovery)

---

## Risk Mitigation

### Technical Risks

**Risk:** DSL preview calculation slow for large datasets
**Mitigation:**
- Implement pagination (50 items)
- Cache calculated times (Redis)
- Consider lazy loading preview times (load on scroll)

**Risk:** KosherJava documentation incomplete for some zmanim
**Mitigation:**
- Flag incomplete entries during Epic 1
- SME manual review for gaps
- Use placeholder text: "Documentation pending" (temporary)

**Risk:** Publisher 1 audit reveals major data issues
**Mitigation:**
- Start Epic 2 early (parallel with Epic 1)
- Budget extra time for corrections
- Consider data reset if issues too severe

### UX Risks

**Risk:** Publishers confused by import/link/copy differences
**Mitigation:**
- Clear button labels and tooltips
- Documentation explaining each action
- User testing before launch

**Risk:** Too many filter options overwhelming
**Mitigation:**
- Collapsible filter panel
- Sensible defaults (e.g., show all categories)
- "Clear filters" always visible

---

## Out of Scope (Deferred)

- Batch import multiple zmanim
- Undo import functionality (use soft delete on algorithm page)
- Publisher opt-out from examples visibility
- Request status tracking dashboard
- Formula comparison tool (side-by-side diff)
- Social features (comments, ratings)
- Analytics dashboard (most popular formulas)
- Notifications for new master zmanim
- Export zmanim catalog
- Mobile app support (web-only MVP)

---

_This epic breakdown provides a clear roadmap for implementing the Publisher Zmanim Registry Interface with well-defined user stories, acceptance criteria, and technical guidance._
