# Publisher Zmanim Registry Interface - Product Requirements Document

**Author:** BMad
**Date:** 2025-12-22
**Version:** 1.0
**Status:** Draft
**Project:** Shtetl Zmanim Platform Enhancement

---

## Executive Summary

The Publisher Zmanim Registry Interface transforms publisher onboarding from intimidating to empowering by making the DSL (Domain-Specific Language) tangible through real-world examples and comprehensive documentation.

### The Problem

New publishers joining the Shtetl Zmanim platform face a steep learning curve:
- The DSL is powerful but unfamiliar - publishers don't know where to start
- Without real-world examples, they struggle to understand DSL patterns and best practices
- Publishers waste time recreating zmanim formulas that already exist in the master registry or other publisher catalogs
- No easy way to explore how validated, experienced publishers are using the system
- Fear of "doing it wrong" creates friction and delays publisher onboarding

**The core issue:** Publishers learn best by example, but currently have no way to browse, explore, and learn from the existing ecosystem of validated zmanim implementations.

### The Solution

A **Publisher Zmanim Registry Explorer** - a read-only discovery interface that serves as both an educational tool and a practical catalog browser with two main browsing modes:

1. **Master Registry View** - Browse the canonical zmanim registry with comprehensive documentation (sourced from KosherJava research), syntax highlighting, and one-click import
2. **Publisher Examples View** - Explore real implementations from validated publishers demonstrating DSL patterns in production

### Target Impact

**Behavioral Success Indicators:**
- 70% of new publishers browse the registry within their first week
- 50% of new publishers import at least one master zman
- 30% explore publisher examples view
- Measurable reduction in "how do I write a formula?" support questions
- Faster time-to-first-zman-published for new publishers

**Quality Metrics:**
- Zero cases of duplicate zmanim created (smart prevention works)
- Less than 5% of "Request Addition" submissions are duplicates (good search UX)
- 100% data integrity on Publisher 1 master linkages (pre-launch audit complete)

### What Makes This Special

This feature shifts the publisher experience from "figuring it out alone" to "learning from the community" - accelerating adoption while maintaining quality through validation and smart guardrails. It's not just a browsing interface; it's an educational platform that builds confidence through transparency and real-world examples.

---

## Project Classification

**Technical Type:** Platform Enhancement (New Feature Module)
**Domain:** Religious/Community Technology
**Complexity:** Medium (Read-only interface + documentation backfill + data integrity audit)
**Project Type:** Greenfield UI with Existing Backend Integration

**Context:**
- Brownfield platform enhancement (existing multi-publisher zmanim platform)
- New frontend module (`/publisher/registry`)
- New backend API endpoints (registry browsing, import/link/copy actions)
- Database schema extensions (documentation fields, attribution tracking)
- Pre-launch data requirements (documentation backfill + Publisher 1 audit)

---

## Success Criteria

Success for the Publisher Zmanim Registry Interface is defined by these concrete outcomes:

### Adoption Metrics
- **70%+ of new publishers** browse the registry within their first week
- **50%+ of new publishers** import at least 1 master zman
- **30%+ of publishers** explore the publisher examples view
- **Zero duplicate zmanim** created through the interface (prevention logic works)

### Quality Metrics
- **100% master zman documentation** populated before launch (from KosherJava research)
- **100% Publisher 1 data integrity** - all zmanim correctly linked to master registry
- **Less than 5% duplicate requests** for master zman additions (good search UX prevents redundant requests)
- **Zero formula mismatches** between publisher zmanim and their linked master entries

### Behavioral Success
- **Reduced support burden:** Measurable decrease in "How do I write a DSL formula?" questions
- **Faster onboarding:** New publishers publish their first zman within 2 days (vs. current 5+ days)
- **Increased confidence:** Publishers report feeling "confident" or "very confident" in DSL usage after browsing registry

### Technical Success
- **Page load performance:** Registry views load in under 2 seconds (p95)
- **Location-based calculation:** Preview times calculated and displayed in under 500ms
- **Zero data integrity issues:** No cases of broken master linkages or orphaned publisher zmanim
- **Smooth migration:** Algorithm page "Add Zman" functionality completely removed with zero regressions

### The "It Works" Moment

A new publisher logs in for the first time, navigates to "Zmanim Registry," sees the master registry with clear DSL formulas and live preview times, clicks "Info" to read comprehensive documentation about Alos Hashachar (16.1°), understands "Oh, THAT'S how you write a formula!", clicks "Import," and is immediately redirected to their algorithm page where the new zman is highlighted and ready to customize if needed.

---

## Product Scope

### MVP - Minimum Viable Product

#### Core Features

**1. Master Registry Browser (Read-Only)**
- Paginated table/card view of all master zmanim (172+ entries)
- Display columns:
  - Zman name (Hebrew + English)
  - DSL formula with syntax highlighting
  - Preview time (calculated for selected location)
  - Brief description (one-line summary)
  - Category badge (Dawn, Morning, Midday, Evening)
  - Shita badge (GRA, MGA, Baal Hatanya, etc.)
  - Status indicator (Available / Already Imported)
- Location preview dropdown (search any locality globally, persisted across tabs)
- Date selector for preview calculations (default: today)
- Search and filter capabilities:
  - Text search (zman name in Hebrew/English, formula keywords)
  - Category filter (Alos, Shema, Tefilla, Chatzos, Mincha, Tzais, etc.)
  - Shita filter (GRA, MGA, Baal Hatanya, Rabbeinu Tam, Geonim, etc.)
  - Status filter (Available to Import / Already Imported)
- Import action with duplicate prevention and success redirect
- Info button (ℹ️) opening full-screen documentation modal
- Request Addition button for suggesting new master zmanim

**2. Publisher Examples Browser (Read-Only)**
- Browse validated publishers' zmanim implementations
- Publisher search/filter workflow:
  1. Search for publisher by name (autocomplete dropdown)
  2. Select a publisher to view their catalog
  3. Select location (restricted to publisher's coverage areas)
  4. View all zmanim for that publisher with preview times
  5. Filter within catalog by category, shita, etc.
- Display columns:
  - Zman name (may be customized by publisher)
  - Publisher name (prominent attribution)
  - DSL formula with syntax highlighting
  - Preview time (calculated for selected location)
  - Validated Publisher badge
  - Master registry name reference
  - Shita badge (inherited from master)
- Actions: Link, Copy (both with duplicate prevention and success redirect)
- Info button (ℹ️) showing publisher-specific fields + inherited master documentation
- Smart duplicate prevention (checks master_zmanim_id)
- Coverage-restricted location picker (only show localities publisher covers)

**3. Comprehensive Master Zman Documentation Modal**
- Full-screen modal (reusable component: `MasterZmanDetailModal.tsx`)
- Sections:
  - Header: Zman name (Hebrew + English), zman_key reference
  - Summary: Brief one-line description
  - DSL Formula: Syntax-highlighted with copy button
  - Scientific Explanation: Plain language explanation of what the zman represents
  - Astronomical Definition: Technical astronomical details
  - Algorithm: Calculation method (e.g., "NOAA Solar Calculator")
  - Halachic Significance: How this zman is used in halacha, which opinions use it
  - Halachic Sources: Which poskim/opinions (expandable cards)
  - Practical Notes: Usage context, when applicable
  - Related Zmanim: Clickable links to similar/alternative calculations (opens their modal)

**4. Publisher Zman Detail Modal**
- Simplified modal (reusable component: `PublisherZmanDetailModal.tsx`)
- Two sections:
  - **Top:** Publisher-specific fields (custom name, publisher attribution, formula, notes, copy/link attribution)
  - **Bottom:** Inherited master zman documentation (same content as master modal)

**5. Visual Design & UX**
- Shared header controls (above tabs): Location picker, date selector, location badge
- Tab navigation: "Master Registry" | "Publisher Examples"
- CodeMirror DSL syntax highlighting (reuse existing editor)
- Preview times: 12-hour format with AM/PM
- Status badges: Available (🟢), Imported (✓), Validated Publisher (🏷️)
- Shita badges: Color-coded by opinion (GRA blue, MGA green, Baal Hatanya purple, etc.)
- Collapsible filter panel (sidebar on desktop, drawer on mobile)
- Active filter chips showing current selections
- Responsive table/cards (works on desktop and tablet)
- Empty states with helpful messages

**6. Business Rules (Duplicate Prevention)**
- **Critical Rule:** ALL publisher zmanim link to master registry (no orphans)
- **Detection Logic:** Check if current publisher has ANY `publisher_zmanim` where `master_zmanim_id = target.master_zmanim_id`
- **Action Availability:**
  - Master Registry: Import only (disabled if already imported)
  - Publisher Zman: Link or Copy (both disabled if already have that master zman)
- **Visual Feedback:** Disabled buttons with tooltips explaining why, greyed out rows, ownership badges

**7. Request Addition Workflow**
- Reuses existing `RequestZmanModal` component from algorithm page
- Available on BOTH tabs (Master Registry and Publisher Examples)
- Pre-populates "source" field to indicate request came from registry explorer
- No duplicate form - complete reuse of existing component

**8. Algorithm Page Migration (Clean Slate)**
- **Complete Removal:** "Add Zman" button and entire dialog removed
- **Deleted Components:**
  - Add Zman Mode dialog (lines 1144-1238 in algorithm/page.tsx)
  - `MasterZmanPicker` component usage
  - `PublisherZmanPicker` component usage
  - `RequestZmanModal` import (moves to registry)
  - All related state and handlers
- **New Addition:** Prominent "Browse Registry" button in header → `/publisher/registry`
- **URL Param Support:** `?focus={zman_key}` to scroll to and highlight specific zman
- **No Replacement:** Algorithm page has ZERO zman addition functionality (edit only)

**9. Post-Action Navigation**
- After successful Import/Link/Copy: Redirect to `/publisher/algorithm?focus={zman_key}`
- Algorithm page scrolls to and highlights the newly added zman
- Clear visual indicator showing which zman was just added

#### Pre-Launch Requirements

**1. Master Registry Documentation Backfill**
- **Goal:** Populate all 172+ master zmanim with comprehensive documentation
- **Priority Fields:**
  1. `full_description` (REQUIRED for all)
  2. `halachic_source` (REQUIRED - e.g., "GRA", "MGA 72 min")
  3. `formula_explanation` (REQUIRED - plain language)
  4. `usage_context` (RECOMMENDED)
  5. `related_zmanim_ids` (NICE TO HAVE - array of related master zman IDs)
- **Source:** KosherJava library research (docs/README-KOSHERJAVA-RESEARCH.md - 180+ methods documented)
- **Quality Standard:** Every master zman MUST have documentation BEFORE interface launches
- **Documentation Modal Design:** Clean, scannable layout with copy-to-clipboard for formula, clickable links to related zmanim

**2. Data Integrity Audit: Publisher 1 (MH Zmanim)**
- **Critical Pre-Launch Validation:** Verify ALL Publisher 1 zmanim have correct master linkages
- **Audit Process:**
  1. Extract all Publisher 1 zmanim with master_zmanim_id references
  2. Get corresponding master registry formulas
  3. Get Publisher 1's actual formulas
  4. Compare: Publisher formula vs Master formula
  5. Flag exact matches (✅), semantic matches (⚠️), mismatches (🔴), missing linkages (🔴)
  6. Find correct master zman for mismatches or create new master entries
  7. Document all corrections for review
- **Deliverable:** Audit report + SQL migration script to fix incorrect linkages
- **Acceptance Criteria:**
  - 100% of Publisher 1 zmanim have correct `master_zmanim_id` linkage
  - Zero formula mismatches between publisher and linked master
  - Audit report approved before registry launch
- **Why This Matters:** Publisher 1 data will be visible to ALL new publishers as example - incorrect linkages would teach wrong patterns

### Out of Scope for MVP

- Edit/Modify functionality (editing happens on algorithm page, not registry)
- Publisher statistics ("Most copied formulas", "Popular publishers")
- Comments/Ratings on master zmanim
- Request status tracking (V1 is fire-and-forget)
- Formula comparison tool (side-by-side DSL diff)
- Notifications when new master zmanim added
- Publisher profile pages (full bio, links, etc.)
- Export functionality (bulk export of formulas)
- Formula testing/preview execution (done on algorithm page)
- User-editable documentation (admin-only for MVP)
- Batch import (multi-select and import multiple at once)
- Undo import (use soft delete on algorithm page instead)

### Growth Features (Post-MVP)

**Phase 2: Enhanced Discovery**
- Formula comparison tool (side-by-side DSL diff)
- "Popular formulas" ranking (most imported/copied)
- Publisher profile pages with full catalog
- Formula collections/bundles ("Import all Chabad zmanim")
- Advanced search with DSL pattern matching
- Batch import (multi-select master zmanim)

**Phase 3: Social Learning**
- Comments on master registry entries
- "This formula worked for me" endorsements
- Request status tracking dashboard
- Publisher-to-publisher messaging about formulas
- Upvoting helpful documentation

**Phase 4: Intelligence**
- AI-powered formula suggestions based on coverage area
- "Publishers similar to you are using..." recommendations
- DSL pattern library extracted from validated publishers
- Formula validation warnings ("This pattern is deprecated")
- Automatic detection of formula improvements

---

## Functional Requirements

### Master Registry Browsing

**FR1:** Publishers can browse the master zmanim registry in a paginated table/card view (50 items per page)

**FR2:** Publishers can search master zmanim by name (Hebrew or English) or formula keywords

**FR3:** Publishers can filter master zmanim by:
- Category (Dawn/Alos, Morning/Shema/Tefilla, Midday/Chatzos/Mincha, Evening/Shkiah/Tzais)
- Shita (GRA, MGA, Baal Hatanya, Rabbeinu Tam, Geonim, Yereim, Ateret Torah)
- Tags (Candle lighting, Fast days, Shabbat, etc.)
- Status (Available to Import / Already Imported)

**FR4:** Publishers can select a location from a global locality search dropdown to see live preview times

**FR5:** Publishers can select a date (past/future) for preview calculations (default: today)

**FR6:** Selected location and date persist across tab switches (shared between Master Registry and Publisher Examples)

**FR7:** Master zmanim display DSL formulas with syntax highlighting (CodeMirror integration)

**FR8:** Master zmanim show preview times calculated for selected location/date in 12-hour format

**FR9:** Master zmanim show status indicators (Available 🟢 / Already Imported ✓)

**FR10:** Master zmanim show category badges (color-coded by time category)

**FR11:** Master zmanim show shita badges (color-coded by halachic opinion)

### Master Zman Documentation

**FR12:** Publishers can click Info button (ℹ️) to open full-screen documentation modal for any master zman

**FR13:** Documentation modal displays:
- Zman name (Hebrew + English) and zman_key
- Brief one-line summary
- DSL formula (syntax-highlighted) with copy button
- Scientific explanation (plain language)
- Astronomical definition (technical details)
- Calculation algorithm (e.g., "NOAA Solar Calculator")
- Halachic significance (how used in halacha, which opinions)
- Halachic sources (expandable cards for each posek/opinion)
- Practical notes (usage context, when applicable)
- Related zmanim (clickable links that open their modals)

**FR14:** Documentation modal has copy-to-clipboard button for DSL formula

**FR15:** Documentation modal has clickable links to related zmanim (opens their documentation modal)

### Master Zman Import

**FR16:** Publishers can click Import button to create a `publisher_zmanim` record linking to master registry

**FR17:** Import button is disabled if publisher already has ANY `publisher_zmanim` with same `master_zmanim_id`

**FR18:** Disabled Import button shows tooltip: "You already imported this master zman"

**FR19:** Already-imported master zmanim show "Imported ✓" badge

**FR20:** Successful import redirects to `/publisher/algorithm?focus={zman_key}` with new zman highlighted

### Publisher Examples Browsing

**FR21:** Publishers can search for validated publishers by name (autocomplete dropdown)

**FR22:** Only validated publishers are shown (status = 'approved', not deleted/suspended/inactive)

**FR23:** Publishers can select a specific publisher to view their complete zmanim catalog

**FR24:** Location dropdown is restricted to localities where selected publisher has coverage

**FR25:** If switching publishers, location auto-clears if new publisher doesn't cover it

**FR26:** Publisher zmanim display:
- Zman name (may be customized by publisher)
- Publisher name (prominent attribution)
- DSL formula (syntax-highlighted)
- Preview time (calculated for selected location/date)
- Validated Publisher badge
- Master registry name reference
- Shita badge (inherited from master)
- Status (Available / Already in Your Catalog)

**FR27:** Publishers can filter within selected publisher's catalog by:
- Text search (name or formula keywords)
- Category (Dawn, Morning, Midday, Evening)
- Shita (inherited from master)
- Status (Available / Already in Your Catalog)

### Publisher Zman Documentation

**FR28:** Publishers can click Info button (ℹ️) to open documentation modal for any publisher zman

**FR29:** Publisher zman modal shows two sections:
- Top: Publisher-specific fields (custom name, publisher attribution, DSL formula, custom notes, copy/link attribution)
- Bottom: Inherited master zman documentation (same comprehensive content as master modal)

### Publisher Zman Link/Copy

**FR30:** Publishers can click Link button to create reference link to another publisher's zman

**FR31:** Link action creates `publisher_zmanim` record with `linked_from_publisher_zman_id` for tracking

**FR32:** Publishers can click Copy button to duplicate formula as independent `publisher_zmanim`

**FR33:** Copy action creates `publisher_zmanim` record with `copied_from_publisher_id` for attribution

**FR34:** Link and Copy buttons are disabled if current publisher already has ANY `publisher_zmanim` with same `master_zmanim_id`

**FR35:** Disabled Link/Copy buttons show tooltip: "You already have this master zman"

**FR36:** Already-owned publisher zmanim show appropriate badge (Linked ✓ / Copied ✓)

**FR37:** Successful Link/Copy redirects to `/publisher/algorithm?focus={zman_key}` with new zman highlighted

### Request Addition Workflow

**FR38:** Publishers can click "Request Addition" button to suggest new master zmanim

**FR39:** Request Addition opens existing `RequestZmanModal` component (reused from algorithm page)

**FR40:** Request modal pre-populates "source" field to indicate request came from registry explorer

**FR41:** Request Addition is available on BOTH tabs (Master Registry and Publisher Examples)

### Visual Design & Navigation

**FR42:** Registry page has tab navigation: "Master Registry" | "Publisher Examples"

**FR43:** Shared header controls above tabs: Location picker, date selector, location badge

**FR44:** Filter panel is collapsible sidebar (desktop) or drawer (mobile)

**FR45:** Active filter chips show current selections with clear all button

**FR46:** Empty states show helpful messages:
- "No master zmanim match your filters"
- "No validated publishers have shared this type of zman yet"
- "Try adjusting your filters"

**FR47:** Responsive table/cards work on desktop and tablet

### Algorithm Page Migration

**FR48:** Algorithm page has prominent "Browse Registry" button in header → `/publisher/registry`

**FR49:** Algorithm page has NO "Add Zman" button or dialog (completely removed)

**FR50:** Algorithm page supports URL param `?focus={zman_key}` to scroll to and highlight specific zman

**FR51:** Algorithm page has ZERO zman addition functionality (edit existing zmanim only)

---

## Non-Functional Requirements

### Performance

**NFR1:** Registry page loads in under 2 seconds (p95)

**NFR2:** Location-based preview calculations complete in under 500ms

**NFR3:** Search/filter operations complete in under 300ms

**NFR4:** Master registry data is aggressively cached (rarely changes)

**NFR5:** Publisher catalog queries use proper indexes (on publisher_id, master_zmanim_id, status)

**NFR6:** Pagination limits to 50 items per page to maintain performance

### Security

**NFR7:** PublisherResolver ensures users only import/link/copy to their own catalog

**NFR8:** API endpoints enforce publisher tenant isolation (can't access other publishers' data)

**NFR9:** All import/link/copy actions validate master_zmanim_id exists before creating records

**NFR10:** Duplicate prevention logic runs server-side (not just client-side UI disable)

**NFR11:** Request Addition workflow validates publisher permissions

### Data Integrity

**NFR12:** ALL publisher zmanim MUST have `master_zmanim_id` (no orphans allowed)

**NFR13:** Import/Link/Copy actions enforce unique constraint: one publisher cannot have multiple `publisher_zmanim` with same `master_zmanim_id`

**NFR14:** Master registry documentation fields are populated before launch (no null required fields)

**NFR15:** Publisher 1 audit completes successfully before launch (100% correct linkages)

**NFR16:** Database constraints prevent creation of duplicate publisher zmanim (master_zmanim_id uniqueness per publisher)

### Usability

**NFR17:** DSL syntax highlighting uses same CodeMirror configuration as algorithm page (consistent experience)

**NFR18:** Preview times display in publisher's local timezone with clear 12-hour format

**NFR19:** Disabled buttons show clear tooltips explaining why action is unavailable

**NFR20:** Success redirects include focus parameter to highlight newly added zman

**NFR21:** Empty states are helpful and actionable (not just "No results")

**NFR22:** Filter panel remembers state within session (doesn't reset on pagination)

### Reliability

**NFR23:** Location preview falls back gracefully if calculation service unavailable

**NFR24:** Documentation modal handles missing optional fields gracefully (shows placeholder text)

**NFR25:** Publisher search handles empty results with helpful message

**NFR26:** Related zmanim links only show if target master zman exists

### Maintainability

**NFR27:** Registry components are in dedicated directory: `web/components/registry/`

**NFR28:** API endpoints follow 6-step handler pattern from coding standards

**NFR29:** SQLc queries handle soft delete filtering (deleted_at IS NULL)

**NFR30:** Code reuses existing components where possible (`RequestZmanModal`, CodeMirror setup, filter patterns)

**NFR31:** Documentation backfill uses migration script (auditable, repeatable)

**NFR32:** Publisher 1 audit produces SQL migration script (reviewable, version-controlled)

---

## Technical Architecture

### Frontend Components

**New Components to Build:**

1. **`RegistryMasterBrowser.tsx`** - Master registry tab
   - Master zmanim table/cards
   - Search and filter UI
   - Import action handling
   - Info modal trigger

2. **`RegistryPublisherBrowser.tsx`** - Publisher examples tab
   - Publisher search dropdown
   - Publisher zmanim table/cards
   - Link/Copy action handling
   - Coverage-restricted location picker

3. **`MasterZmanDetailModal.tsx`** - Full-screen master zman documentation
   - Header (name, key)
   - Summary section
   - Formula section (syntax-highlighted, copy button)
   - Scientific explanation section
   - Astronomical definition section
   - Algorithm section
   - Halachic significance section
   - Halachic sources (expandable cards)
   - Practical notes section
   - Related zmanim (clickable links)

4. **`PublisherZmanDetailModal.tsx`** - Publisher zman documentation
   - Top section: Publisher fields
   - Bottom section: Inherited master documentation (reuse from MasterZmanDetailModal)

5. **`RegistryLocationPicker.tsx`** - Shared location picker
   - Global locality search (master tab)
   - Coverage-restricted search (publisher tab)
   - Persistent state across tabs

6. **`RegistryFilters.tsx`** - Shared filter panel
   - Category multi-select
   - Shita multi-select
   - Status toggle
   - Active filter chips
   - Clear all button

**Components to Reuse:**
- `RequestZmanModal` (from algorithm page)
- CodeMirror DSL editor setup (syntax highlighting)
- Table/card layouts (from existing publisher pages)
- Filter/search patterns (from algorithm page)

**Components to Delete from Algorithm Page:**
- Add Zman Mode dialog (lines 1144-1238)
- `MasterZmanPicker` component usage
- `PublisherZmanPicker` component usage
- `RequestZmanModal` import (moves to registry)
- All "Add Zman Mode" state and handlers

**Algorithm Page Updates:**
- Add "Browse Registry" button in header
- Add URL param handling: `?focus={zman_key}`
- Remove all zman addition UI

**State Management:**
- React Query for data fetching
- Local state for filters/tabs
- URL state for focus parameter

**Post-Action Navigation:**
- After Import/Link/Copy: `router.push('/publisher/algorithm?focus=' + zmanKey)`

### Backend API Endpoints

**New Endpoints:**

1. **`GET /api/v1/publisher/registry/master`**
   - Query params: `locality_id`, `date` (YYYY-MM-DD), `category`, `shita`, `status`, `search`, `page`, `limit`
   - Returns: Master zmanim with calculated preview times, ownership status
   - SQLc query: List master registry with optional filters + ownership check
   - Handler: 6-step pattern, PublisherResolver for ownership check

2. **`GET /api/v1/publisher/registry/publishers`**
   - Returns: List of validated publishers (status = 'approved', not deleted/suspended/inactive)
   - SQLc query: List publishers with status validation
   - Handler: Simple query, no publisher resolution needed (public list)

3. **`GET /api/v1/publisher/registry/publishers/{publisher_id}`**
   - Query params: `locality_id`, `date` (YYYY-MM-DD), `category`, `shita`, `status`, `search`, `page`, `limit`
   - Returns: Selected publisher's zmanim with calculated preview times, ownership status
   - Validates locality is within publisher's coverage
   - SQLc query: List publisher zmanim with filters + ownership check
   - Handler: 6-step pattern, PublisherResolver for ownership check, coverage validation

4. **`GET /api/v1/publisher/registry/coverage/{publisher_id}`**
   - Returns: List of localities covered by publisher
   - SQLc query: Join publisher_coverage with geo_localities
   - Handler: Simple query, no resolution needed (public coverage data)

5. **`POST /api/v1/publisher/registry/import`**
   - Body: `{ master_zmanim_id: number }`
   - Returns: Created publisher_zmanim record
   - SQLc query: Insert publisher_zmanim with master_zmanim_id
   - Handler: 6-step pattern, PublisherResolver, duplicate check before insert, validation
   - Business logic: Prevent duplicate (check existing master_zmanim_id)

6. **`POST /api/v1/publisher/registry/link`**
   - Body: `{ publisher_zmanim_id: number }` (source publisher zman)
   - Returns: Created publisher_zmanim record
   - SQLc query: Insert publisher_zmanim with linked_from_publisher_zman_id and master_zmanim_id from source
   - Handler: 6-step pattern, PublisherResolver, duplicate check, validation
   - Business logic: Prevent duplicate (check existing master_zmanim_id from source)

7. **`POST /api/v1/publisher/registry/copy`**
   - Body: `{ publisher_zmanim_id: number }` (source publisher zman)
   - Returns: Created publisher_zmanim record
   - SQLc query: Insert publisher_zmanim with copied_from_publisher_id and master_zmanim_id from source
   - Handler: 6-step pattern, PublisherResolver, duplicate check, validation
   - Business logic: Prevent duplicate (check existing master_zmanim_id from source)

8. **`POST /api/v1/publisher/registry/request-addition`**
   - Body: Existing request zman structure + `source: "registry"`
   - Returns: Created request record
   - Handler: Reuse existing request handler, add source tracking

**Handler Pattern (6 Steps):**
```go
func (h *Handlers) ImportMasterZman(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. Parse body
    var req struct { MasterZmanimID int32 `json:"master_zmanim_id"` }
    json.NewDecoder(r.Body).Decode(&req)

    // 3. Validate
    if req.MasterZmanimID == 0 {
        RespondValidationError(w, r, "master_zmanim_id required", nil)
        return
    }

    // 4. Check for duplicates
    exists, err := h.db.Queries.CheckPublisherHasMasterZman(ctx, ...)
    if exists { RespondValidationError(...); return }

    // 5. SQLc query - create publisher_zmanim
    result, err := h.db.Queries.ImportMasterZman(ctx, ...)

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

### Database Schema Changes

**New Fields for `master_zmanim_registry`:**

```sql
-- Documentation fields
ALTER TABLE master_zmanim_registry
    ADD COLUMN full_description text,           -- Comprehensive explanation (REQUIRED)
    ADD COLUMN halachic_source text,            -- Posek/opinion (e.g., "GRA", "MGA 72 minutes") (REQUIRED)
    ADD COLUMN formula_explanation text,        -- Plain language formula meaning (REQUIRED)
    ADD COLUMN usage_context text,              -- When/where used (RECOMMENDED)
    ADD COLUMN related_zmanim_ids int[];        -- Array of related master zman IDs (NICE TO HAVE)

-- Filtering fields
ALTER TABLE master_zmanim_registry
    ADD COLUMN shita varchar(50),               -- Standardized shita code (e.g., "GRA", "MGA", "BAAL_HATANYA")
    ADD COLUMN category varchar(50);            -- Primary category (e.g., "ALOS", "SHEMA", "TZAIS")

-- Indexes for performance
CREATE INDEX idx_master_zmanim_shita ON master_zmanim_registry(shita) WHERE shita IS NOT NULL;
CREATE INDEX idx_master_zmanim_category ON master_zmanim_registry(category) WHERE category IS NOT NULL;
```

**New Fields for `publisher_zmanim`:**

```sql
-- Attribution tracking
ALTER TABLE publisher_zmanim
    ADD COLUMN copied_from_publisher_id int,               -- Publisher ID if copied from another publisher
    ADD COLUMN linked_from_publisher_zman_id int;          -- Publisher zman ID if linked to another publisher's zman

-- Foreign keys
ALTER TABLE publisher_zmanim
    ADD CONSTRAINT fk_copied_from_publisher
    FOREIGN KEY (copied_from_publisher_id) REFERENCES publishers(id);

ALTER TABLE publisher_zmanim
    ADD CONSTRAINT fk_linked_from_publisher_zman
    FOREIGN KEY (linked_from_publisher_zman_id) REFERENCES publisher_zmanim(id);
```

**Unique Constraint (Duplicate Prevention):**

```sql
-- Ensure one publisher cannot have multiple zmanim with same master_zmanim_id
CREATE UNIQUE INDEX idx_publisher_zmanim_master_unique
ON publisher_zmanim(publisher_id, master_zmanim_id)
WHERE deleted_at IS NULL;
```

**Data Model Clarification:**
- `master_zmanim_id` (REQUIRED on ALL publisher zmanim) - Links to master registry
- `linked_from_publisher_zman_id` (optional) - If created via "Link" action
- `copied_from_publisher_id` (optional) - If created via "Copy" action

### SQLc Queries

**Master Registry Queries:**

```sql
-- name: ListMasterZmanimForRegistry :many
-- Get master zmanim with optional filters and ownership check
SELECT
    mzr.*,
    (SELECT COUNT(*) > 0 FROM publisher_zmanim pz
     WHERE pz.master_zman_id = mzr.id
       AND pz.publisher_id = $1
       AND pz.deleted_at IS NULL) AS already_imported
FROM master_zmanim_registry mzr
WHERE
    ($2::varchar IS NULL OR mzr.category = $2) AND
    ($3::varchar IS NULL OR mzr.shita = $3) AND
    ($4::varchar IS NULL OR
        mzr.canonical_english_name ILIKE '%' || $4 || '%' OR
        mzr.canonical_hebrew_name LIKE '%' || $4 || '%' OR
        mzr.default_formula_dsl ILIKE '%' || $4 || '%')
ORDER BY mzr.canonical_english_name
LIMIT $5 OFFSET $6;

-- name: GetMasterZmanDocumentation :one
-- Get full documentation for a master zman
SELECT * FROM master_zmanim_registry WHERE id = $1;

-- name: CheckPublisherHasMasterZman :one
-- Check if publisher already has this master zman
SELECT EXISTS(
    SELECT 1 FROM publisher_zmanim
    WHERE publisher_id = $1
      AND master_zman_id = $2
      AND deleted_at IS NULL
);
```

**Publisher Examples Queries:**

```sql
-- name: ListValidatedPublishers :many
-- Get list of validated publishers for dropdown
SELECT p.id, p.name, p.bio
FROM publishers p
JOIN publisher_statuses ps ON p.status_id = ps.id
WHERE ps.key = 'approved'
  AND p.deleted_at IS NULL
  AND p.suspended_at IS NULL
  AND p.inactive_at IS NULL
ORDER BY p.name;

-- name: ListPublisherZmanimForRegistry :many
-- Get publisher's zmanim with ownership check
SELECT
    pz.*,
    mzr.canonical_english_name AS master_name,
    mzr.shita AS master_shita,
    (SELECT COUNT(*) > 0 FROM publisher_zmanim pz2
     WHERE pz2.master_zman_id = pz.master_zman_id
       AND pz2.publisher_id = $1
       AND pz2.deleted_at IS NULL) AS already_have_master
FROM publisher_zmanim pz
JOIN master_zmanim_registry mzr ON pz.master_zman_id = mzr.id
WHERE pz.publisher_id = $2
  AND pz.deleted_at IS NULL
  AND ($3::varchar IS NULL OR mzr.category = $3)
  AND ($4::varchar IS NULL OR mzr.shita = $4)
  AND ($5::varchar IS NULL OR
      pz.english_name ILIKE '%' || $5 || '%' OR
      pz.hebrew_name LIKE '%' || $5 || '%' OR
      pz.formula_dsl ILIKE '%' || $5 || '%')
ORDER BY pz.english_name
LIMIT $6 OFFSET $7;

-- name: GetPublisherCoverageLocalities :many
-- Get localities covered by publisher
SELECT DISTINCT l.*
FROM publisher_coverage pc
JOIN geo_localities l ON ST_Contains(pc.coverage_area, l.location)
WHERE pc.publisher_id = $1
  AND pc.deleted_at IS NULL
ORDER BY l.name;
```

**Import/Link/Copy Queries:**

```sql
-- name: ImportMasterZman :one
-- Create publisher_zmanim from master registry
INSERT INTO publisher_zmanim (
    publisher_id,
    zman_key,
    hebrew_name,
    english_name,
    description,
    formula_dsl,
    master_zman_id,
    time_category_id
)
SELECT
    $1,                          -- publisher_id
    mzr.zman_key,
    mzr.canonical_hebrew_name,
    mzr.canonical_english_name,
    mzr.description,
    mzr.default_formula_dsl,
    mzr.id,
    mzr.time_category_id
FROM master_zmanim_registry mzr
WHERE mzr.id = $2
RETURNING *;

-- name: LinkPublisherZman :one
-- Create publisher_zmanim linked to another publisher's zman
INSERT INTO publisher_zmanim (
    publisher_id,
    zman_key,
    hebrew_name,
    english_name,
    description,
    formula_dsl,
    master_zman_id,
    linked_from_publisher_zman_id,
    time_category_id
)
SELECT
    $1,                          -- current publisher_id
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.description,
    pz.formula_dsl,
    pz.master_zman_id,
    pz.id,                       -- linked_from_publisher_zman_id
    pz.time_category_id
FROM publisher_zmanim pz
WHERE pz.id = $2                 -- source publisher_zman_id
RETURNING *;

-- name: CopyPublisherZman :one
-- Create independent copy of publisher's zman
INSERT INTO publisher_zmanim (
    publisher_id,
    zman_key,
    hebrew_name,
    english_name,
    description,
    formula_dsl,
    master_zman_id,
    copied_from_publisher_id,
    time_category_id
)
SELECT
    $1,                          -- current publisher_id
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.description,
    pz.formula_dsl,
    pz.master_zman_id,
    pz.publisher_id,             -- copied_from_publisher_id
    pz.time_category_id
FROM publisher_zmanim pz
WHERE pz.id = $2                 -- source publisher_zman_id
RETURNING *;
```

### Performance Considerations

**Caching Strategy:**
- Master registry list: Cache aggressively (24 hours) - rarely changes
- Publisher catalog lists: Cache per publisher (1 hour)
- Location preview calculations: Cache per location/date/publisher (24 hours)
- Coverage data: Cache per publisher (24 hours)

**Query Optimization:**
- Index on `publishers.status_id` for validated publisher filter
- Index on `publisher_zmanim.master_zman_id` for ownership checks
- Index on `master_zmanim_registry.category` and `shita` for filters
- Partial index for active publisher zmanim: `WHERE deleted_at IS NULL`
- Unique index for duplicate prevention: `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`

**Pagination:**
- 50 items per page (configurable)
- Total count query separate from data query (avoid COUNT(*) overhead)

---

## Data Migration Requirements

### 1. Master Registry Documentation Backfill

**Goal:** Populate all 172+ master zmanim with comprehensive documentation from KosherJava research

**Source Data:** `docs/README-KOSHERJAVA-RESEARCH.md` and related research files (180+ methods documented)

**Migration Script:** `db/migrations/YYYYMMDDHHMMSS_backfill_master_zmanim_documentation.sql`

**Process:**
1. Parse KosherJava research documents
2. Extract documentation for each zman:
   - Full description
   - Halachic source (which posek/opinion)
   - Formula explanation (plain language)
   - Usage context
   - Related zmanim references
3. Map KosherJava methods to master registry zman_key values
4. Generate SQL UPDATE statements
5. Review and validate before applying

**Example Migration:**
```sql
-- Alos Hashachar 16.1°
UPDATE master_zmanim_registry
SET
    full_description = 'Dawn calculated when the sun is 16.1 degrees below the horizon. This is the most commonly used calculation for Alos Hashachar, based on the time it takes to walk 72 minutes at 18 minutes per mil, converted to a solar angle.',
    halachic_source = 'GRA (Vilna Gaon)',
    formula_explanation = 'Solar depression angle of 16.1 degrees before sunrise',
    usage_context = 'Used as the earliest time for morning prayers and certain mitzvot. Common in Israel and many Diaspora communities.',
    shita = 'GRA',
    category = 'ALOS',
    related_zmanim_ids = ARRAY[
        (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_72'),
        (SELECT id FROM master_zmanim_registry WHERE zman_key = 'alos_18')
    ]
WHERE zman_key = 'alos_16_1';
```

**Validation Criteria:**
- Every master zman has non-null `full_description`
- Every master zman has non-null `halachic_source`
- Every master zman has non-null `formula_explanation`
- All `related_zmanim_ids` references point to existing master zmanim
- No duplicate shita/category values

**Deliverable:** Migration script + validation report

### 2. Publisher 1 Data Integrity Audit

**Goal:** Verify ALL Publisher 1 (MH Zmanim) zmanim have correct `master_zmanim_id` linkages

**Why Critical:** Publisher 1 will be visible to new publishers as a quality example - incorrect data would teach wrong patterns

**Audit Process:**

**Step 1: Data Extraction**
```sql
-- Extract Publisher 1 zmanim with master linkages
SELECT
    pz.id AS publisher_zman_id,
    pz.zman_key AS publisher_key,
    pz.formula_dsl AS publisher_formula,
    pz.master_zman_id,
    mzr.zman_key AS master_key,
    mzr.default_formula_dsl AS master_formula
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mzr ON pz.master_zman_id = mzr.id
WHERE pz.publisher_id = 1
  AND pz.deleted_at IS NULL
ORDER BY pz.zman_key;
```

**Step 2: Formula Comparison**
- Compare `publisher_formula` vs `master_formula`
- Flag results:
  - ✅ **Exact Match:** Formulas identical → Correct linkage
  - ⚠️ **Semantic Match:** Different syntax, same calculation → Review needed
  - 🔴 **Mismatch:** Different calculations → WRONG `master_zmanim_id`
  - 🔴 **Missing:** `master_zman_id` is NULL → Data migration issue

**Step 3: Validation Checks**
```sql
-- Check for missing master linkages
SELECT COUNT(*) AS missing_master_linkages
FROM publisher_zmanim
WHERE publisher_id = 1
  AND master_zman_id IS NULL
  AND deleted_at IS NULL;

-- Check for formula mismatches (requires manual review)
SELECT
    pz.zman_key,
    pz.formula_dsl AS publisher_formula,
    mzr.default_formula_dsl AS master_formula,
    CASE
        WHEN pz.formula_dsl = mzr.default_formula_dsl THEN 'EXACT'
        WHEN pz.formula_dsl IS NULL THEN 'NULL_PUBLISHER'
        WHEN mzr.default_formula_dsl IS NULL THEN 'NULL_MASTER'
        ELSE 'DIFFERENT'
    END AS match_status
FROM publisher_zmanim pz
JOIN master_zmanim_registry mzr ON pz.master_zman_id = mzr.id
WHERE pz.publisher_id = 1
  AND pz.deleted_at IS NULL
ORDER BY match_status, pz.zman_key;
```

**Step 4: Correction Strategy**

For each mismatch:
1. **Identify correct master zman:**
   - Search master registry for matching formula
   - If no match exists, create new master entry (with documentation)
2. **Document correction:**
   - Publisher zman ID
   - Current (incorrect) master_zman_id
   - New (correct) master_zman_id
   - Justification
3. **Generate UPDATE statement:**
   ```sql
   UPDATE publisher_zmanim
   SET master_zman_id = {correct_id}
   WHERE id = {publisher_zman_id};
   ```

**Deliverable:**

1. **Audit Report (`docs/audit/publisher-1-master-linkages-audit.md`):**
   - Total zmanim reviewed
   - Exact matches count
   - Semantic matches count (with details)
   - Mismatches count (with details)
   - Missing linkages count (with details)
   - Recommended corrections (table)

2. **Migration Script (`db/migrations/YYYYMMDDHHMMSS_fix_publisher_1_master_linkages.sql`):**
   - UPDATE statements to fix incorrect linkages
   - INSERT statements for new master zmanim (if needed)
   - Validation queries to confirm corrections

**Acceptance Criteria:**
- 100% of Publisher 1 zmanim have non-null `master_zmanim_id`
- Zero formula mismatches between publisher and linked master
- Audit report reviewed and approved by BMad
- Migration script tested on staging database
- Zero regressions (Publisher 1 zmanim still calculate correctly)

---

## User Experience Specifications

### Visual Design

**Design Tokens (from coding standards):**
- Primary: CTAs, links (Import/Link/Copy buttons)
- Card/card-foreground: Zmanim cards background/text
- Muted/muted-foreground: Disabled states, secondary text
- Border: Card borders, filter panel borders
- Destructive: Error states
- Custom status colors: Available (green-600), Imported (blue-600), Validated (purple-600)

**Shita Badge Colors:**
- GRA: Blue (bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200)
- MGA: Green (bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200)
- Baal Hatanya: Purple (bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200)
- Rabbeinu Tam: Orange (bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200)
- Geonim: Amber (bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200)
- Yereim: Pink (bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200)
- Ateret Torah: Cyan (bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200)

**Category Badge Colors:**
- Alos/Dawn: Indigo
- Shema/Morning: Blue
- Chatzos/Midday: Yellow
- Mincha/Afternoon: Orange
- Tzais/Evening: Purple

**Typography:**
- Zman names: font-semibold text-foreground
- Formulas: font-mono text-sm (CodeMirror styling)
- Preview times: font-bold text-lg
- Publisher names: font-medium text-primary
- Descriptions: text-muted-foreground text-sm

**Spacing:**
- Card padding: p-4
- Section spacing: space-y-4
- Filter panel: p-6
- Modal padding: p-6

### Layout & Components

**Page Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: "Zmanim Registry" + Breadcrumbs                │
├─────────────────────────────────────────────────────────┤
│ Shared Controls (above tabs):                          │
│ [Location Picker ▼] [Date Picker] [Selected: Jerusalem]│
├─────────────────────────────────────────────────────────┤
│ Tabs: [Master Registry] [Publisher Examples]           │
├──────────────┬──────────────────────────────────────────┤
│ Filter Panel │ Content Area                            │
│              │                                          │
│ Categories   │ [Search: ___________] [Clear Filters]   │
│ □ Alos       │                                          │
│ □ Shema      │ ┌────────────────────────────┐          │
│ □ Chatzos    │ │ Alos Hashachar (16.1°)     │          │
│              │ │ עלות השחר                   │          │
│ Shitas       │ │ solar(16.1, before_sunrise) │          │
│ □ GRA        │ │ Preview: 5:24 AM            │          │
│ □ MGA        │ │ [GRA] [ALOS] [ℹ️] [Import] │          │
│ □ Baal Hat.  │ └────────────────────────────┘          │
│              │                                          │
│ Status       │ ┌────────────────────────────┐          │
│ ○ All        │ │ ... more zmanim cards ...  │          │
│ ○ Available  │ └────────────────────────────┘          │
│ ○ Imported   │                                          │
│              │ [← Prev] Page 1 of 4 [Next →]          │
└──────────────┴──────────────────────────────────────────┘
```

**Master Zman Card:**
```
┌─────────────────────────────────────────────────────────┐
│ **Alos Hashachar (16.1°)** • עלות השחר          [ℹ️]   │
│ ─────────────────────────────────────────────────────── │
│ Formula: solar(16.1, before_sunrise)                    │
│ Preview: 5:24 AM  (Jerusalem, Dec 22, 2025)             │
│ Description: Dawn when sun is 16.1° below horizon       │
│ [GRA] [ALOS] [Available ✓]                              │
│                                          [Import Zman]  │
└─────────────────────────────────────────────────────────┘
```

**Publisher Zman Card:**
```
┌─────────────────────────────────────────────────────────┐
│ **Alos Hashachar** • עלות השחר                  [ℹ️]   │
│ By: MH Zmanim [Validated Publisher]                     │
│ ─────────────────────────────────────────────────────── │
│ Formula: solar(16.1, before_sunrise)                    │
│ Preview: 5:24 AM  (Jerusalem, Dec 22, 2025)             │
│ Master: Alos Hashachar (16.1°)                          │
│ [GRA] [ALOS]                                            │
│                                    [Link] [Copy]        │
└─────────────────────────────────────────────────────────┘
```

**Documentation Modal (Master Zman):**
```
┌─────────────────────────────────────────────────────────┐
│ Alos Hashachar (16.1°) • עלות השחר           [@alos_16_1]│
│                                                    [✕]  │
├─────────────────────────────────────────────────────────┤
│ Summary:                                                │
│ Dawn calculated when sun is 16.1° below horizon         │
│                                                         │
│ DSL Formula:                           [Copy to Clipboard]│
│ ┌─────────────────────────────────────────────────────┐ │
│ │ solar(16.1, before_sunrise)                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Scientific Explanation:                                 │
│ The sun is 16.1 degrees below the eastern horizon...   │
│                                                         │
│ Astronomical Definition:                                │
│ Solar depression angle of 16.1° corresponds to...      │
│                                                         │
│ Algorithm:                                              │
│ NOAA Solar Calculator using WGS84 ellipsoid...         │
│                                                         │
│ Halachic Significance:                                  │
│ This is the most widely accepted time for Alos...      │
│                                                         │
│ Halachic Sources:                                       │
│ ┌──────────────────────────────────────────────────┐   │
│ │ ▶ GRA (Vilna Gaon)                    [Expand ▼]│   │
│ │   Based on 72 minutes at 18 min/mil...          │   │
│ └──────────────────────────────────────────────────┘   │
│                                                         │
│ Practical Notes:                                        │
│ Commonly used in Israel and many Diaspora communities  │
│                                                         │
│ Related Zmanim:                                         │
│ [Alos 72 min] [Alos 18°] [Misheyakir]                  │
│                                                         │
│                                              [Close]   │
└─────────────────────────────────────────────────────────┘
```

### Interaction Patterns

**Location Selection:**
1. Click location dropdown
2. Type to search (e.g., "Jerusalem")
3. Select from autocomplete results
4. Location badge updates: "Selected: Jerusalem, Israel"
5. All preview times recalculate immediately
6. Selection persists when switching tabs

**Filtering:**
1. Open filter panel (sidebar on desktop, drawer on mobile)
2. Select category checkboxes (multi-select)
3. Select shita checkboxes (multi-select)
4. Toggle status radio (All / Available / Imported)
5. Filter chips appear showing active filters
6. Click chip "×" to remove individual filter
7. Click "Clear All Filters" to reset
8. Results update immediately (no "Apply" button needed)

**Import Workflow:**
1. Browse master registry
2. Click Info (ℹ️) to read documentation
3. See preview time for selected location
4. Click "Import Zman" button
5. Button shows loading spinner
6. Success: Redirect to `/publisher/algorithm?focus=alos_16_1`
7. Algorithm page scrolls to newly imported zman, highlighted with green border
8. Toast notification: "Alos Hashachar imported successfully"

**Link Workflow:**
1. Browse publisher examples
2. Search for publisher "MH Zmanim"
3. Select location within their coverage
4. Click Info (ℹ️) to see their formula + master documentation
5. Click "Link" button
6. Button shows loading spinner
7. Success: Redirect to `/publisher/algorithm?focus=alos_hashachar`
8. Algorithm page scrolls to newly linked zman, highlighted
9. Toast notification: "Linked to MH Zmanim's Alos Hashachar"

**Copy Workflow:**
1. Same as Link, but click "Copy" instead
2. Creates independent copy (can be edited without affecting source)
3. Toast notification: "Copied Alos Hashachar from MH Zmanim"

**Request Addition Workflow:**
1. Click "Request Addition" button (available on both tabs)
2. Modal opens (existing `RequestZmanModal` component)
3. Fill out request form (zman name, description, justification)
4. Submit
5. Toast notification: "Request submitted for admin review"
6. Modal closes

**Disabled Button Interaction:**
1. Hover over disabled Import/Link/Copy button
2. Tooltip appears: "You already have this master zman"
3. Button remains disabled (cannot click)
4. Visual indicator: opacity-50, cursor-not-allowed

### Responsive Behavior

**Desktop (≥1024px):**
- Filter panel: Fixed sidebar (w-64)
- Content area: Remaining width
- Cards: Grid layout (2 columns)
- Modal: Max width 800px, centered

**Tablet (768px - 1023px):**
- Filter panel: Collapsible drawer (slide from left)
- Filter toggle button appears
- Cards: Single column
- Modal: Max width 90vw

**Mobile (<768px):**
- Filter panel: Bottom sheet drawer
- Cards: Single column, compact layout
- Simplified header controls
- Modal: Full screen

### Accessibility

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals/drawers
- Arrow keys for dropdown navigation

**Screen Reader Support:**
- ARIA labels for all buttons
- ARIA live regions for loading states
- ARIA expanded states for collapsible sections
- Semantic HTML (header, nav, main, section)

**Focus Management:**
- Visible focus indicators (ring-2 ring-primary)
- Focus trapped in modals
- Focus returns to trigger after modal closes
- Skip to content link

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Master Registry Documentation Backfill Incomplete**
- **Probability:** Medium
- **Impact:** High (cannot launch without documentation)
- **Mitigation:**
  - Start documentation backfill immediately after PRD approval
  - Use KosherJava research as primary source (already documented 180+ methods)
  - Create migration script for batch updates (auditable, repeatable)
  - Validation queries to confirm 100% coverage before launch
  - Allocate 2-3 days for this task in sprint planning

**Risk 2: Publisher 1 Audit Reveals Widespread Incorrect Linkages**
- **Probability:** Low-Medium
- **Impact:** High (delays launch, requires extensive corrections)
- **Mitigation:**
  - Perform audit early in sprint (before UI development)
  - Automated comparison scripts to speed up validation
  - If >20% incorrect, consider batch correction with admin review
  - Document correction rationale for transparency
  - Test Publisher 1 calculations before/after corrections to ensure no regressions

**Risk 3: Performance Degradation with Location Preview Calculations**
- **Probability:** Medium
- **Impact:** Medium (slow UX, frustrated users)
- **Mitigation:**
  - Aggressive caching (24-hour TTL for preview calculations)
  - Lazy loading (calculate only visible cards on current page)
  - Background calculation for next page (prefetch)
  - Loading skeleton states while calculating
  - Database indexes on master_zman_id, publisher_id for ownership checks
  - Consider Redis cache for preview times (locality_id + date + master_zman_id → time)

**Risk 4: Duplicate Prevention Logic Has Edge Cases**
- **Probability:** Low
- **Impact:** High (data integrity violation, duplicate zmanim created)
- **Mitigation:**
  - Unique constraint at database level: `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`
  - Server-side validation before insert (don't rely on client-side disable)
  - Integration tests for all duplicate scenarios
  - Audit queries to detect any existing duplicates before launch
  - Rollback plan if duplicates detected post-launch

### Business Risks

**Risk 5: Publishers Don't Use Registry (Low Adoption)**
- **Probability:** Low-Medium
- **Impact:** Medium (feature doesn't achieve adoption goals)
- **Mitigation:**
  - Prominent "Browse Registry" button on algorithm page (impossible to miss)
  - Onboarding email/guide highlighting registry for new publishers
  - Track usage analytics (views, imports, links, copies)
  - Gather feedback in first 2 weeks, iterate quickly
  - Success stories: "Publisher X imported 50 zmanim in 10 minutes"

**Risk 6: Privacy Concerns from Validated Publishers**
- **Probability:** Low
- **Impact:** Medium (publishers request to be hidden from examples)
- **Mitigation:**
  - Only show validated/approved publishers (implies consent)
  - Clear communication during publisher onboarding about visibility
  - Post-MVP: Add opt-out setting per publisher (hide from examples view)
  - Prominent attribution (publishers want credit for quality formulas)
  - Monitor for complaints, respond quickly with opt-out option

**Risk 7: Quality Control - Bad Formulas from Validated Publishers**
- **Probability:** Low
- **Impact:** Medium (new publishers copy incorrect formulas)
- **Mitigation:**
  - Admin approval process already ensures quality threshold
  - Report mechanism (post-MVP) for flagging incorrect formulas
  - Publisher 1 audit sets precedent for quality expectations
  - Monitor for duplicate requests to same master zman (indicates confusion)
  - Post-MVP: Formula validation warnings ("This pattern is uncommon")

### UX Risks

**Risk 8: Overwhelming Choice Paralyzes New Publishers**
- **Probability:** Medium
- **Impact:** Low-Medium (users don't import anything, explore endlessly)
- **Mitigation:**
  - Master registry first (curated, documented, recommended)
  - Good search/filter to narrow options quickly
  - Clear category organization (Alos, Shema, Chatzos, etc.)
  - Recommendations (post-MVP): "Most imported by publishers in your region"
  - Onboarding guide: "Start with these 10 essential zmanim"

**Risk 9: Publishers Confused by Import vs Link vs Copy**
- **Probability:** Low-Medium
- **Impact:** Low (minor UX friction, support burden)
- **Mitigation:**
  - Clear action labels: "Import from Master", "Link to [Publisher]", "Copy from [Publisher]"
  - Tooltips explaining difference
  - Help icon with modal: "What's the difference?"
  - Post-action feedback: "Linked to MH Zmanim's formula (updates if they update)"
  - Documentation in help center

**Risk 10: Stale Publisher Examples (Outdated Formulas)**
- **Probability:** Medium
- **Impact:** Low (minor confusion, not critical)
- **Mitigation:**
  - Show "last updated" timestamp on publisher zmanim
  - Cache invalidation when publisher updates their algorithm
  - Post-MVP: Badge for "Recently Updated" formulas
  - Filter option: "Updated in last 30 days"

### Data Integrity Risks

**Risk 11: Master Zmanim Missing from KosherJava Research**
- **Probability:** Low
- **Impact:** Medium (incomplete documentation)
- **Mitigation:**
  - Gap analysis already performed (docs/master-registry-gap-analysis.md)
  - Only 15 zmanim missing (95%+ coverage)
  - Supplement with community halachic knowledge where needed
  - Placeholder documentation for missing entries ("Research in progress")
  - Post-MVP: Community contribution workflow for documentation

**Risk 12: Related Zmanim Links Create Cycles**
- **Probability:** Low
- **Impact:** Low (infinite loop in UI)
- **Mitigation:**
  - Cycle detection in documentation modal (track visited zmanim)
  - Breadcrumb trail showing path (e.g., "Alos 16.1° > Alos 72 min > ...")
  - Limit depth of related zmanim traversal (max 3 levels)
  - Back button to return to previous zman

---

## Testing Requirements

### Unit Tests

**Backend:**
- SQLc query tests for all new queries (list master zmanim, list publisher zmanim, import/link/copy)
- Duplicate prevention logic tests (check if publisher has master zman)
- Coverage validation tests (locality within publisher coverage)
- Ownership check tests (already_imported, already_have_master flags)

**Frontend:**
- Filter logic tests (category, shita, status filters)
- Search logic tests (zman name, formula keywords)
- Duplicate detection tests (button disable logic)
- URL param handling tests (focus parameter)

### Integration Tests

**API Endpoint Tests:**
- `GET /api/v1/publisher/registry/master` - with/without filters, pagination
- `GET /api/v1/publisher/registry/publishers` - validated publishers only
- `GET /api/v1/publisher/registry/publishers/{id}` - with coverage validation
- `GET /api/v1/publisher/registry/coverage/{id}` - locality list
- `POST /api/v1/publisher/registry/import` - success, duplicate prevention, validation errors
- `POST /api/v1/publisher/registry/link` - success, duplicate prevention
- `POST /api/v1/publisher/registry/copy` - success, duplicate prevention
- `POST /api/v1/publisher/registry/request-addition` - request creation

**Database Constraint Tests:**
- Unique constraint on (publisher_id, master_zmanim_id) prevents duplicates
- Foreign key constraints prevent orphaned records
- Soft delete filtering (deleted_at IS NULL) in all queries

### E2E Tests (Playwright)

**Master Registry Flow:**
1. Navigate to `/publisher/registry`
2. Select location "Jerusalem, Israel"
3. Search for "Alos"
4. Filter by category "ALOS"
5. Filter by shita "GRA"
6. Click Info (ℹ️) on first result
7. Verify documentation modal opens with all sections
8. Close modal
9. Click "Import Zman" button
10. Verify redirect to `/publisher/algorithm?focus=alos_16_1`
11. Verify zman is highlighted
12. Return to registry
13. Verify same zman shows "Imported ✓" badge
14. Verify Import button is disabled with tooltip

**Publisher Examples Flow:**
1. Navigate to `/publisher/registry`
2. Switch to "Publisher Examples" tab
3. Search for publisher "MH Zmanim"
4. Select location "Jerusalem, Israel" (within coverage)
5. Search for "Alos"
6. Click Info (ℹ️) on first result
7. Verify modal shows publisher section + master documentation
8. Close modal
9. Click "Link" button
10. Verify redirect to `/publisher/algorithm?focus=alos_hashachar`
11. Verify zman is highlighted
12. Return to registry, switch to Publisher Examples
13. Verify same zman shows "Already in Your Catalog" status
14. Verify Link button is disabled with tooltip

**Request Addition Flow:**
1. Navigate to `/publisher/registry`
2. Click "Request Addition" button
3. Verify `RequestZmanModal` opens
4. Fill out request form
5. Submit
6. Verify toast notification
7. Verify modal closes

**Algorithm Page Migration:**
1. Navigate to `/publisher/algorithm`
2. Verify "Browse Registry" button exists in header
3. Verify NO "Add Zman" button exists
4. Verify NO "Add Zman Mode" dialog exists
5. Click "Browse Registry" button
6. Verify navigation to `/publisher/registry`

### Performance Tests

**Load Time Tests:**
- Registry page initial load: <2 seconds (p95)
- Master registry list (50 items): <1 second
- Publisher catalog list (50 items): <1 second
- Location preview calculation: <500ms per zman
- Search/filter operations: <300ms

**Concurrency Tests:**
- 100 concurrent users browsing registry
- 50 concurrent import/link/copy operations
- Cache effectiveness (hit rate >80%)

### Data Validation Tests

**Documentation Backfill:**
- Query: All master zmanim have non-null `full_description`
- Query: All master zmanim have non-null `halachic_source`
- Query: All master zmanim have non-null `formula_explanation`
- Query: All `related_zmanim_ids` references point to existing master zmanim
- Query: No duplicate shita/category values

**Publisher 1 Audit:**
- Query: All Publisher 1 zmanim have non-null `master_zmanim_id`
- Query: Zero formula mismatches between Publisher 1 and master
- Query: No duplicate master_zmanim_id within Publisher 1
- Calculation test: Publisher 1 times match expected values for sample dates/locations

### Accessibility Tests

**WCAG 2.1 AA Compliance:**
- Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Screen reader support (ARIA labels, live regions, semantic HTML)
- Focus management (visible indicators, trapped in modals)
- Color contrast (4.5:1 for text, 3:1 for UI elements)

---

## Deployment & Rollout Plan

### Pre-Launch Checklist

**Data Preparation:**
- [ ] Master registry documentation backfill complete (100% coverage)
- [ ] Publisher 1 audit complete (100% correct linkages)
- [ ] Documentation backfill migration tested on staging
- [ ] Publisher 1 correction migration tested on staging
- [ ] All validation queries pass

**Code Complete:**
- [ ] All frontend components built and tested
- [ ] All backend API endpoints implemented and tested
- [ ] Algorithm page migration complete (Add Zman removed)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance tests passing

**Database:**
- [ ] Schema changes deployed to staging
- [ ] Unique constraint on (publisher_id, master_zmanim_id) tested
- [ ] Indexes created (master_zmanim_id, category, shita)
- [ ] Soft delete filtering verified in all queries

**Documentation:**
- [ ] API documentation updated (new endpoints)
- [ ] Publisher onboarding guide updated (mention registry)
- [ ] Help center article: "How to use the Zmanim Registry"
- [ ] Internal runbook: "Registry troubleshooting"

### Deployment Sequence

**Stage 1: Staging Deployment**
1. Deploy database migrations (documentation fields, unique constraint)
2. Run documentation backfill migration
3. Run Publisher 1 correction migration
4. Deploy backend API (new endpoints)
5. Deploy frontend (new registry page, algorithm page changes)
6. Run full test suite on staging
7. Manual QA testing (smoke test all workflows)

**Stage 2: Production Deployment (Low-Risk Window)**
1. Schedule deployment during low-traffic period (e.g., Sunday 2am UTC)
2. Create database backup
3. Deploy database migrations (with rollback script ready)
4. Run documentation backfill migration
5. Run Publisher 1 correction migration
6. Verify data integrity (validation queries)
7. Deploy backend API
8. Deploy frontend
9. Smoke test production (browse registry, import one zman)
10. Monitor error logs for 1 hour
11. Send announcement to publishers: "New Registry Explorer available!"

**Stage 3: Gradual Rollout**
- Week 1: Monitor adoption metrics, gather feedback
- Week 2: Send reminder email to publishers who haven't used registry
- Week 3: Publish success stories ("Publisher X imported 50 zmanim")
- Month 1: Review metrics, plan iteration

### Rollback Plan

**If Critical Issue Detected:**
1. Feature flag: Disable registry link from algorithm page (hide "Browse Registry" button)
2. Return 503 from registry endpoints with maintenance message
3. Investigate issue, fix, redeploy
4. Re-enable feature flag
5. Monitor closely

**If Data Integrity Issue:**
1. Identify affected records (SQL query)
2. Create correction migration
3. Test on staging
4. Deploy during maintenance window
5. Verify corrections
6. Notify affected publishers if needed

### Monitoring

**Key Metrics:**
- Registry page views (daily)
- Master registry imports (count, which zmanim)
- Publisher examples links (count, from which publishers)
- Publisher examples copies (count, from which publishers)
- Request additions submitted (count, quality)
- Time to first import (new publishers)
- Error rate (4xx, 5xx)
- API response times (p50, p95, p99)
- Cache hit rate

**Alerts:**
- Error rate >5% (15 minutes)
- API response time p95 >2 seconds (15 minutes)
- Import failures >10% (5 minutes)
- Cache hit rate <70% (1 hour)

**Dashboards:**
- Registry adoption dashboard (views, imports, links, copies)
- Performance dashboard (response times, cache hits)
- Error dashboard (4xx, 5xx, error types)

---

## Success Metrics & KPIs

### Adoption Metrics (Primary)

**Week 1 Targets:**
- 70% of new publishers browse registry
- 50% of new publishers import at least 1 master zman
- 30% of publishers explore publisher examples

**Month 1 Targets:**
- 80% of active publishers have used registry
- Average 15 imports per publisher
- 50% of publishers have linked or copied from examples

**Leading Indicators:**
- Registry page views per active publisher per week (target: 3+)
- Imports per session (target: 2-3)
- Time spent on registry page (target: 5-10 minutes)

### Quality Metrics (Primary)

**Data Integrity:**
- 100% master zmanim documentation populated ✅
- 100% Publisher 1 correct linkages ✅
- Zero duplicate zmanim created (unique constraint works)
- <5% of Request Additions are duplicates (good search UX)

**Performance:**
- Registry page load <2 seconds (p95)
- Preview calculations <500ms
- Import/Link/Copy success rate >95%
- Zero data corruption incidents

### Behavioral Metrics (Secondary)

**Support Burden:**
- "How do I write DSL formula?" questions decreased by 50%
- "Where can I find examples?" questions decreased by 80%
- Average time-to-first-zman-published: 2 days (vs. current 5+ days)

**Confidence:**
- Post-onboarding survey: "How confident are you writing DSL formulas?"
- Target: 70%+ report "confident" or "very confident" (vs. current 40%)

**Engagement:**
- Publishers return to registry after initial onboarding (repeat usage)
- Publishers explore multiple tabs (Master + Publisher Examples)
- Publishers use Info (ℹ️) to read documentation (education happening)

### Business Metrics (Tertiary)

**Platform Growth:**
- New publisher onboarding velocity increased by 30%
- Publisher activation rate (first zman published) increased to 90%
- Publisher retention (30-day active) maintained or improved

**Content Quality:**
- Diversity of imported zmanim (not everyone copying same 10)
- Customization rate (publishers edit after import, showing understanding)
- Request Addition quality (fewer duplicates, better descriptions)

### Success Criteria Review

**After Week 1:**
- Review adoption metrics
- Gather qualitative feedback (interviews with 3-5 publishers)
- Identify friction points in UX
- Plan quick iteration if needed

**After Month 1:**
- Full metrics review against targets
- Success story: Write case study of high-adopter publisher
- Roadmap prioritization for Phase 2 features
- Celebrate wins with team!

---

## Open Questions & Decisions Needed

### Technical Decisions

**Q1: Should preview calculations be real-time or pre-calculated?**
- Option A: Calculate on-demand (slower, always accurate)
- Option B: Pre-calculate for common locations (faster, may be stale)
- Option C: Hybrid (on-demand with aggressive caching)
- **Recommendation:** Option C - Calculate on-demand, cache for 24 hours per location/date/master_zman_id

**Q2: How to handle related zmanim cycles in documentation modal?**
- Option A: Limit depth to 3 levels
- Option B: Cycle detection + breadcrumb trail
- Option C: No cycles (manual curation of related_zmanim_ids)
- **Recommendation:** Option B - Cycle detection with breadcrumb, limit depth to 5

**Q3: Should Link action auto-sync when source publisher updates?**
- Option A: Yes, linked zmanim update automatically (complex, powerful)
- Option B: No, link is snapshot (simple, predictable)
- Option C: Publisher chooses on link creation (flexible, confusing)
- **Recommendation:** Option B for MVP - Link is snapshot, can be re-linked later

### UX Decisions

**Q4: Should filters be persistent across sessions?**
- Option A: Yes, save to localStorage (convenient, may be confusing)
- Option B: No, reset on page load (clean slate each time)
- **Recommendation:** Option B for MVP - Reset on load, add persistence in Phase 2

**Q5: Should there be a "Favorites" feature for master zmanim?**
- Option A: Yes, publishers can star zmanim for quick access (nice to have)
- Option B: No, use search/filter to find zmanim (simpler)
- **Recommendation:** Option B for MVP - Out of scope, add in Phase 2

**Q6: How to display publisher name in examples view?**
- Option A: Prominent attribution in card header (increases trust)
- Option B: Small text below zman name (less prominent)
- **Recommendation:** Option A - Prominent attribution builds trust and credit

### Data Decisions

**Q7: Should documentation backfill be manual or automated?**
- Option A: Manual review of all 172 zmanim (slow, high quality)
- Option B: Automated mapping from KosherJava (fast, requires validation)
- Option C: Hybrid (automated + manual review of mismatches)
- **Recommendation:** Option C - Automated mapping with manual review/correction

**Q8: How to handle Publisher 1 zmanim with no matching master entry?**
- Option A: Create new master entries (increases registry size)
- Option B: Mark as "custom" and exclude from registry (loses examples)
- Option C: Create placeholder master entries (audit required)
- **Recommendation:** Option A if <10% of Publisher 1 zmanim, Option C if >10%

---

## Appendices

### Appendix A: Database Schema (New/Modified Tables)

**Modified: `master_zmanim_registry`**
```sql
ALTER TABLE master_zmanim_registry
    ADD COLUMN full_description text,
    ADD COLUMN halachic_source text,
    ADD COLUMN formula_explanation text,
    ADD COLUMN usage_context text,
    ADD COLUMN related_zmanim_ids int[],
    ADD COLUMN shita varchar(50),
    ADD COLUMN category varchar(50);

CREATE INDEX idx_master_zmanim_shita ON master_zmanim_registry(shita);
CREATE INDEX idx_master_zmanim_category ON master_zmanim_registry(category);
```

**Modified: `publisher_zmanim`**
```sql
ALTER TABLE publisher_zmanim
    ADD COLUMN copied_from_publisher_id int,
    ADD COLUMN linked_from_publisher_zman_id int;

ALTER TABLE publisher_zmanim
    ADD CONSTRAINT fk_copied_from_publisher
    FOREIGN KEY (copied_from_publisher_id) REFERENCES publishers(id);

ALTER TABLE publisher_zmanim
    ADD CONSTRAINT fk_linked_from_publisher_zman
    FOREIGN KEY (linked_from_publisher_zman_id) REFERENCES publisher_zmanim(id);

CREATE UNIQUE INDEX idx_publisher_zmanim_master_unique
ON publisher_zmanim(publisher_id, master_zmanim_id)
WHERE deleted_at IS NULL;
```

### Appendix B: API Endpoint Summary

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/publisher/registry/master` | List master zmanim with filters | Publisher |
| GET | `/api/v1/publisher/registry/publishers` | List validated publishers | Publisher |
| GET | `/api/v1/publisher/registry/publishers/{id}` | List publisher's zmanim | Publisher |
| GET | `/api/v1/publisher/registry/coverage/{id}` | Get publisher coverage localities | Publisher |
| POST | `/api/v1/publisher/registry/import` | Import master zman | Publisher |
| POST | `/api/v1/publisher/registry/link` | Link to publisher zman | Publisher |
| POST | `/api/v1/publisher/registry/copy` | Copy publisher zman | Publisher |
| POST | `/api/v1/publisher/registry/request-addition` | Request new master zman | Publisher |

### Appendix C: Component Directory Structure

```
web/
├── app/
│   └── publisher/
│       └── registry/
│           └── page.tsx                     # Main registry page
├── components/
│   └── registry/
│       ├── RegistryMasterBrowser.tsx        # Master registry tab
│       ├── RegistryPublisherBrowser.tsx     # Publisher examples tab
│       ├── MasterZmanDetailModal.tsx        # Master zman documentation modal
│       ├── PublisherZmanDetailModal.tsx     # Publisher zman documentation modal
│       ├── RegistryLocationPicker.tsx       # Shared location picker
│       ├── RegistryFilters.tsx              # Shared filter panel
│       ├── ZmanCard.tsx                     # Reusable zman card
│       └── index.ts                         # Barrel export
```

### Appendix D: Research Documents

**KosherJava Research:**
- `docs/README-KOSHERJAVA-RESEARCH.md` - Overview
- `docs/kosherjava-zmanim-complete-extraction.md` - 180+ methods documented
- `docs/kosherjava-formulas-quick-reference.md` - Formula reference table
- `docs/kosherjava-research-summary.md` - Statistics and insights

**Gap Analysis:**
- `docs/master-registry-gap-analysis.md` - Comparison of master registry vs KosherJava
- Missing zmanim identified (15 items)
- Recommended additions (priority order)

**Audit Templates:**
- `docs/audit/publisher-1-master-linkages-audit.md` (to be created)
- Audit report format and validation queries

### Appendix E: Migration Scripts

**Documentation Backfill:**
- `db/migrations/YYYYMMDDHHMMSS_backfill_master_zmanim_documentation.sql`
- Updates all 172+ master zmanim with documentation from KosherJava research

**Publisher 1 Corrections:**
- `db/migrations/YYYYMMDDHHMMSS_fix_publisher_1_master_linkages.sql`
- Fixes incorrect master_zmanim_id references for Publisher 1

**Schema Changes:**
- `db/migrations/YYYYMMDDHHMMSS_add_registry_fields.sql`
- Adds new fields to master_zmanim_registry and publisher_zmanim
- Creates indexes and unique constraints

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-22 | BMad | Initial PRD creation from product brief |

---

_This Product Requirements Document was created through collaborative discovery between BMad and AI facilitator, based on the Product Brief dated 2025-12-22._

_Next Steps: Review PRD → Approve → Begin Sprint Planning → Start Development_
