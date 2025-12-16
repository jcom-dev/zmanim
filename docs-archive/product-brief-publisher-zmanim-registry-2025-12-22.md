# Product Brief: Publisher Zmanim Registry Interface

**Date:** 2025-12-22
**Author:** BMad
**Context:** Enhancement to existing multi-publisher zmanim platform

---

## Executive Summary

[To be completed after discovery]

---

## Core Vision

### Problem Statement

Publishers joining the platform face a steep learning curve:
- The DSL is powerful but unfamiliar - publishers don't know where to start
- Without real-world examples, they struggle to understand DSL patterns and best practices
- Publishers waste time recreating zmanim formulas that already exist in the master registry or other publisher catalogs
- No easy way to explore how validated, experienced publishers are using the system
- Fear of "doing it wrong" creates friction and delays publisher onboarding

**The core issue:** Publishers learn best by example, but currently have no way to browse, explore, and learn from the existing ecosystem of validated zmanim implementations.

### Proposed Solution

Create a **Publisher Zmanim Registry Explorer** - a read-only discovery interface that serves as both an educational tool and a practical catalog browser.

**Two main browsing modes:**

1. **Master Registry View** - Browse the canonical zmanim registry with:
   - Read-only display of all master zmanim definitions
   - Clear DSL formula display with syntax highlighting
   - **Comprehensive documentation** for each zman (sourced from KosherJava research):
     - Halachic source (GRA, MGA, Baal Hatanya, etc.)
     - Formula explanation in plain language
     - Usage context and when to apply
   - Visual indicators showing which zmanim the publisher has already imported
   - "Request Addition" button for suggesting new master zmanim
   - "Import" action (where available) to adopt master definitions
   - Smart rules preventing duplicate imports

2. **Publisher Examples View** - Explore real implementations from validated publishers:
   - Browse zmanim from other validated publishers (curated quality examples)
   - See how experienced publishers use the DSL in production
   - Link or copy proven formulas (with proper attribution/tracking)
   - Learn patterns and approaches through real-world examples
   - Visual indicators preventing duplicates (can't link/copy if you already have that master zman)

**Key principle:** Everything is read-only exploration with explicit, controlled actions (import, link, copy, request) - no accidental modifications.

---

## Target Users

### Primary Users

**Active Publishers** - Publishers with approved accounts (not suspended, deleted, or inactive) who need to:
- **New Publishers:** Understand how the DSL works before creating their first zmanim
- **Learning Publishers:** See real-world examples to build confidence and avoid mistakes
- **Expanding Publishers:** Discover proven formulas instead of recreating from scratch
- **Curious Publishers:** Explore how other publishers approach complex calculations

**User Journey:**
1. Publisher logs into their dashboard
2. Navigates to "Zmanim Registry" (new section)
3. **First Discovery:** Browses master registry - sees DSL formulas with syntax highlighting, understands "Oh, THAT'S how you write a formula!"
4. **Social Learning:** Switches to "Publisher Examples" view - sees real implementations from validated peers
5. **Light Bulb Moment:** "I can see how others calculate alos hashachar - I'll use that pattern!"
6. **Easy Adoption:** Clicks "Import" or "Copy" to bring proven formulas into their own catalog
7. **Confidence Built:** Returns to this interface whenever stuck or exploring new zmanim patterns

---

## MVP Scope

### Core Features

#### 1. Master Registry Browser (Read-Only)
- **Location Preview:**
  - Location dropdown (search any locality globally)
  - Selected location shows live preview times for all master zmanim
  - Persisted across tab switches (same location in both tabs)
- **Display:** Paginated table/card view of all `master_zmanim_registry` entries
- **Columns/Info:**
  - Zman name (Hebrew + English)
  - DSL formula (syntax highlighted)
  - **Preview time** (calculated for selected location, today's date)
  - Brief description (one-line summary)
  - Category (e.g., "Dawn - Alos", "Evening - Tzais")
  - Shita badge (e.g., "GRA", "MGA 72min", "Baal Hatanya")
  - Tags (if applicable)
  - Status indicator: "Already Imported" vs "Available to Import"
  - **Info button (ℹ️)** - opens detailed documentation modal
- **Actions:**
  - **Import Button:** Creates `publisher_zmanim` record linking to master registry
    - Disabled if already imported
    - Shows "Imported ✓" badge if exists
    - **On Success:** Redirect to `/publisher/algorithm` with new zman focused/scrolled into view
  - **Info Button (ℹ️):** Opens full-screen modal with comprehensive master zman documentation (similar to existing zman detail view):
    - **Header:** Zman name (Hebrew + English), key (`@zman_key`)
    - **Summary:** Brief one-line description
    - **DSL Formula:** Syntax-highlighted formula with copy button
    - **Scientific Explanation:** Plain language explanation of what the zman represents
    - **Astronomical Definition:** Technical astronomical details
    - **Algorithm:** Calculation method (e.g., "NOAA Solar Calculator")
    - **Halachic Significance:** How this zman is used in halacha, which opinions use it
    - **Halachic Sources:** Which poskim/opinions (with expandable cards)
    - **Practical Notes:** Usage context, when applicable
    - **Related Zmanim:** Links to similar/alternative calculations (clickable, opens their modal)
  - **Request Addition Button:** Opens form to suggest new master zmanim (admin review workflow)
- **Search/Filter:**
  - **Text Search:** Zman name (Hebrew or English), formula keywords
  - **Category:** Dawn (Alos), Morning (Shema, Tefilla), Midday (Chatzos, Mincha), Evening (Shkiah, Tzais), etc.
  - **Shita (Halachic Opinion):** GRA, MGA, Baal Hatanya, Geonim, Rabbeinu Tam, etc.
  - **Tags:** Candle lighting, Fast days, Shabbat, etc.
  - **Status:** "Available to Import" or "Already Imported"
- **Info Tooltips:** Hover over DSL syntax to see inline help

#### 2. Publisher Examples Browser (Read-Only)
- **Display:** Browse `publisher_zmanim` from validated publishers only
- **Validation Rule:** `publishers.status = 'approved' AND deleted_at IS NULL AND suspended_at IS NULL AND inactive_at IS NULL`
- **Location Preview (Coverage-Restricted):**
  - Location dropdown (search localities)
  - **Restriction:** Only show localities where selected publisher has coverage
  - Selected location shows live preview times for that publisher's zmanim
  - Persisted across tab switches (same location shared with Master Registry tab)
  - If switching publishers, location auto-clears if new publisher doesn't cover it
- **Publisher Search/Filter Workflow:**
  1. Search for publisher by name (autocomplete/dropdown)
  2. Select a publisher to view their zmanim catalog
  3. Select location (restricted to publisher's coverage areas)
  4. See all zmanim for that specific publisher with preview times
  5. Filter within publisher's catalog by category, shita, etc.
- **Columns/Info:**
  - Zman name (may be customized by publisher)
  - Publisher name (attribution - prominently displayed)
  - DSL formula (syntax highlighted)
  - **Preview time** (calculated for selected location, today's date)
  - "Validated Publisher" badge
  - Master registry name (all publisher zmanim link to master registry)
  - Shita badge (inherited from master, e.g., "GRA", "MGA")
  - **Info button (ℹ️)** - shows master registry documentation
- **Actions:**
  - **Link Button:** Creates reference link to the other publisher's zman
    - Disabled if current publisher already has ANY zman with the same `master_zmanim_id`
    - Adds metadata: `linked_from_publisher_zman_id` for tracking
    - **On Success:** Redirect to `/publisher/algorithm` with new zman focused/scrolled into view
  - **Copy Button:** Duplicates the formula as new independent `publisher_zmanim` (no ongoing link)
    - Disabled if current publisher already has ANY zman with the same `master_zmanim_id`
    - Adds metadata: `copied_from_publisher_id` for attribution
    - **On Success:** Redirect to `/publisher/algorithm` with new zman focused/scrolled into view
  - **Info Button (ℹ️):** Opens simplified modal showing publisher-specific fields + master zman documentation:
    - **Publisher Fields (Top Section):**
      - Zman name (Hebrew + English - may be customized by publisher)
      - Publisher name (attribution)
      - DSL formula (this publisher's version - may differ from master if customized)
      - Custom notes/overrides (if any)
      - Attribution: "Copied from [Publisher]" or "Linked to [Publisher]" (if applicable)
    - **Master Zman Documentation (Bottom Section - Inherited):**
      - Same comprehensive documentation as Master Registry modal
      - Scientific explanation, halachic significance, sources, etc.
      - All content comes from linked master zman
  - **View Details:** Expandable panel showing publisher-specific metadata (custom name, notes, overrides)
- **Smart Duplicate Prevention (by Master Registry ID):**
  - Button disabled with tooltip: "You already have this master zman"
  - Detection logic: Check if current publisher has ANY `publisher_zmanim` where `master_zmanim_id = target.master_zmanim_id`
  - **This prevents duplicates regardless of import/link/copy method**
- **Search/Filter:**
  - **Publisher Search (Primary):** Autocomplete dropdown to search and select specific publisher
    - Shows only validated publishers
    - Once selected, displays ALL zmanim for that publisher
  - **Text Search:** Filter selected publisher's zmanim by name or formula keywords
  - **Category:** Dawn, Morning, Midday, Evening, etc.
  - **Shita:** GRA, MGA, Baal Hatanya, etc. (inherited from master registry)
  - **Status:** "Available" or "Already in Your Catalog"
- **Privacy:** Only shows approved publishers (quality control + privacy)

#### 3. Visual Design & UX
- **Header Controls (Above Tabs):**
  - Location picker (shared across both tabs)
  - Preview date selector (default: today)
  - Location badge showing selected location and date
- **Tab Navigation:** "Master Registry" | "Publisher Examples"
- **Syntax Highlighting:** CodeMirror integration for DSL formulas (reuse existing editor)
- **Preview Times:** Display in each row, formatted 12-hour with AM/PM
- **Status Badges:** Clear visual indicators
  - 🟢 "Available" (can import/copy)
  - ✓ "Imported" / "Already in Your Catalog"
  - 🏷️ "Validated Publisher"
- **Shita Badges:** Color-coded by opinion
  - GRA (blue), MGA (green), Baal Hatanya (purple), Geonim (orange), etc.
  - Shows in both master registry and publisher examples
- **Filter Panel:**
  - Collapsible sidebar (desktop) or drawer (mobile)
  - Multi-select dropdowns for shita, category
  - Clear all filters button
  - Active filter chips showing current selections
- **Responsive Table/Cards:** Works on desktop and tablet
- **Empty States:**
  - "No master zmanim match your filters"
  - "No validated publishers have shared this type of zman yet"
  - "Try adjusting your filters"

#### 4. Business Rules (Duplicate Prevention)

**Action Availability Matrix:**

| Source Type | Import | Link | Copy |
|-------------|--------|------|------|
| Master Registry | ✅ Only option | ❌ N/A | ❌ N/A |
| Publisher Zman | ❌ N/A | ✅ Available | ✅ Available |

**Critical Rule: ALL publisher zmanim link to master registry**
- There is no such thing as a "custom" publisher zman
- Every `publisher_zmanim` record has a `master_zmanim_id`
- A publisher can only have ONE zman per master registry entry

**Cannot perform action if:**
- **Import/Link/Copy:** Current publisher already has ANY `publisher_zmanim` where `master_zmanim_id = target.master_zmanim_id`
- This single rule prevents ALL duplicates across all three actions

**Visual Feedback:**
- Disabled button with tooltip explaining why (e.g., "You already imported this master zman")
- Greyed out row styling for already-owned zmanim
- Badge showing ownership status: "Imported ✓", "Linked ✓", "Copied ✓"

#### 5. Request Addition Workflow
- **Trigger:** "Request Addition" button (available on BOTH tabs)
- **Behavior:** Opens existing `RequestZmanModal` component (reused from current algorithm page)
- **No duplicate form** - reuse existing request workflow
- **Context:** Pre-populate "source" field to indicate request came from registry explorer

#### 6. Migration from Algorithm Page (Clean Slate)
- **Greenfield Approach:** No backwards compatibility, no tech debt
- **Remove Completely:** "Add Zman" button and entire dialog from `/publisher/algorithm` page
  - Delete `MasterZmanPicker` component usage
  - Delete `PublisherZmanPicker` component usage
  - Delete `RequestZmanModal` component usage
  - Delete "Add Zman Mode" dialog (lines 1144-1238)
  - Delete all related state, handlers, and imports
- **No Replacement:** Algorithm page has ZERO zman addition functionality
- **Rationale:** Complete separation of concerns
  - Registry Explorer (`/publisher/registry`) = Discovery, browsing, importing (ADD new zmanim)
  - Algorithm Page (`/publisher/algorithm`) = Editing, configuring (EDIT existing zmanim only)
- **Navigation Flow:**
  - Algorithm page header: Prominent "Browse Registry" button → `/publisher/registry`
  - Registry actions (Import/Link/Copy): Success → `/publisher/algorithm?focus={zman_key}` (scroll to and highlight new zman)

### Pre-Launch Requirements

#### 1. Master Registry Documentation Backfill
- Populate all existing master zmanim with documentation from KosherJava research
- Priority fields:
  1. `full_description` - REQUIRED for all zmanim
  2. `halachic_source` - REQUIRED (e.g., "GRA", "MGA 72 min", "Baal Hatanya")
  3. `formula_explanation` - REQUIRED (plain language)
  4. `usage_context` - RECOMMENDED
  5. `related_zmanim_ids` - NICE TO HAVE

**Documentation Modal Design:**
- Clean, scannable layout
- Copy-to-clipboard for formula
- Links to related zmanim (clickable, opens their documentation)

**Quality Standard:**
- Every master zman must have documentation BEFORE publisher interface launches
- Use existing KosherJava research as primary source
- Supplement with community halachic knowledge where needed

#### 2. Data Integrity Audit: MH Zmanim (Publisher 1)
**Critical Pre-Launch Validation:**

**Audit Scope:**
- Review ALL `publisher_zmanim` records for Publisher 1 (MH Zmanim)
- Verify each `master_zmanim_id` mapping is correct
- Compare publisher formula against master registry formula
- Identify mismatches and incorrect linkages

**Audit Process:**
1. **Extract Data:**
   - Query all Publisher 1 zmanim with their `master_zmanim_id` references
   - Get corresponding master registry formulas
   - Get Publisher 1's actual formulas

2. **Formula Comparison:**
   - Compare Publisher 1 formula vs Master Registry formula
   - Flag exact matches ✅
   - Flag semantic matches (same calculation, different syntax) ⚠️
   - Flag mismatches (different calculations) 🔴

3. **Validation Checks:**
   - **Match:** Publisher formula = Master formula → Correct linkage ✅
   - **Mismatch:** Publisher formula ≠ Master formula → WRONG `master_zmanim_id` 🔴
   - **Missing:** Publisher zman has NO `master_zmanim_id` → Data migration issue 🔴

4. **Correction Strategy:**
   - For mismatches: Find correct master zman or create new master entry
   - For missing: Link to appropriate master or create placeholder
   - Document all corrections for review

**Deliverable:**
- Audit report showing:
  - Total zmanim reviewed
  - Correct mappings count
  - Incorrect mappings with details
  - Recommended corrections
- SQL migration script to fix incorrect `master_zmanim_id` values

**Acceptance Criteria:**
- 100% of Publisher 1 zmanim have correct `master_zmanim_id` linkage
- Zero formula mismatches between publisher and linked master
- Audit report approved before registry launch

**Why This Matters:**
- Publisher 1 data will be visible to ALL new publishers as example
- Incorrect linkages would teach wrong patterns
- Quality of Publisher 1 data sets the standard for the platform

### Out of Scope for MVP

- **Edit/Modify:** This is purely read-only exploration - editing happens on algorithm page
- **Publisher Stats:** "Most copied formulas", "Popular publishers" - nice analytics but not core
- **Comments/Ratings:** Social features deferred to future
- **Request Status Tracking:** V1 is fire-and-forget for addition requests
- **Formula Comparison:** Side-by-side DSL comparison tool
- **Notifications:** No alerts when new master zmanim added
- **Publisher Profiles:** Links to full publisher profile pages
- **Export:** Bulk export of formulas
- **Formula Testing:** Live DSL preview/test execution (done on algorithm page)
- **User-Editable Documentation:** Admin-only for MVP
- **Batch Import:** Multi-select and import multiple zmanim at once
- **Undo Import:** Cannot undo import from registry (use soft delete on algorithm page instead)

### MVP Success Criteria

**Adoption Metrics:**
- 70%+ of new publishers browse the registry within first week
- 50%+ of new publishers import at least 1 master zman
- 30%+ explore publisher examples view

**Quality Metrics:**
- Zero cases of duplicate zmanim created (smart prevention works)
- <5% of "Request Addition" submissions are duplicates (good search UX)
- 100% data integrity on Publisher 1 master linkages (pre-launch audit complete)

**Behavioral Success:**
- Reduction in support questions: "How do I write a DSL formula?"
- Increased publisher confidence (measured by: faster time-to-first-zman-published)

---

## Technical Preferences

### Frontend
- **New Route:** `/publisher/registry` (Registry Explorer page)
- **Greenfield Implementation:** Build new Registry Explorer from scratch, no tech debt
- **Components to Build New:**
  - `RegistryMasterBrowser.tsx` - Master registry tab with import
  - `RegistryPublisherBrowser.tsx` - Publisher examples tab with link/copy
  - `MasterZmanDetailModal.tsx` - Full-screen info modal for master zman (similar to existing zman detail view)
    - Sections: DSL Formula, Scientific Explanation, Astronomical Definition, Algorithm, Halachic Significance, Halachic Sources (expandable cards), Practical Notes, Related Zmanim
  - `PublisherZmanDetailModal.tsx` - Simplified modal for publisher zman
    - Top section: Publisher-specific fields (name, publisher attribution, formula, notes)
    - Bottom section: Inherited master zman documentation (reuse content from `MasterZmanDetailModal`)
  - Reuse `RequestZmanModal` component from algorithm page
- **Design Patterns to Reuse:**
  - Table/card layouts from existing publisher pages
  - CodeMirror DSL syntax highlighting setup
  - Filter/search patterns from algorithm page
- **Components to DELETE from Algorithm Page:**
  - "Add Zman" button and dialog (lines 959-1238 in `algorithm/page.tsx`)
  - `MasterZmanPicker` component and import
  - `PublisherZmanPicker` component and import
  - `RequestZmanModal` import (moves to registry)
  - `showAddZmanModeDialog`, `showZmanPicker`, `showPublisherZmanPicker`, `showRequestZmanModal` state
  - All "Add Zman Mode" handlers
- **Algorithm Page Updates:**
  - Add "Browse Registry" button in header → `/publisher/registry`
  - Add URL param handling: `?focus={zman_key}` to scroll to and highlight zman
  - Remove all zman addition UI completely
- **State Management:** React Query for data fetching, local state for filters/tabs
- **Post-Action Navigation:** After Import/Link/Copy success, use `router.push('/publisher/algorithm?focus=' + zmanKey)`

### Backend
- **Queries:** SQLc queries with publisher status validation
- **Security:** PublisherResolver ensures users only modify their own catalog
- **API Endpoints:**
  - `GET /api/v1/publisher/registry/master?locality_id={id}&date={YYYY-MM-DD}` - List master registry with preview times
    - Returns: master zmanim with calculated times for location/date
    - Includes ownership status (already imported by current publisher)
  - `GET /api/v1/publisher/registry/publishers/{publisher_id}?locality_id={id}&date={YYYY-MM-DD}` - List publisher's zmanim with preview times
    - Validates locality is within publisher's coverage
    - Returns: publisher zmanim with calculated times
    - Includes ownership status (already imported/linked/copied by current publisher)
  - `GET /api/v1/publisher/registry/publishers` - List all validated publishers (for dropdown)
  - `GET /api/v1/publisher/registry/coverage/{publisher_id}` - Get localities covered by publisher (for location dropdown restriction)
  - `POST /api/v1/publisher/registry/import` - Import from master (sets `master_zmanim_id`)
  - `POST /api/v1/publisher/registry/link` - Link to another publisher's zman (sets `linked_from_publisher_zman_id`)
  - `POST /api/v1/publisher/registry/copy` - Copy formula as independent zman (sets `copied_from_publisher_id`)
  - `POST /api/v1/publisher/registry/request-addition` - Request new master zman

### Database
- **Existing Tables:** `master_zmanim_registry`, `publisher_zmanim`, `publishers`
- **New Fields for Documentation:**
  - `master_zmanim_registry.full_description` (text) - Comprehensive explanation
  - `master_zmanim_registry.halachic_source` (text) - Posek/opinion reference (e.g., "GRA", "MGA 72 minutes")
  - `master_zmanim_registry.formula_explanation` (text) - Plain language formula meaning
  - `master_zmanim_registry.usage_context` (text) - When/where used
  - `master_zmanim_registry.related_zmanim_ids` (int[]) - Related master zman IDs
- **New Fields for Filtering:**
  - `master_zmanim_registry.shita` (text) - Standardized shita code (e.g., "GRA", "MGA", "BAAL_HATANYA")
  - `master_zmanim_registry.category` (text) - Primary category (e.g., "ALOS", "SHEMA", "TZAIS")
- **New Fields for Attribution:**
  - `publisher_zmanim.copied_from_publisher_id` (nullable, for copy attribution)
  - `publisher_zmanim.linked_from_publisher_zman_id` (nullable, for linking to another publisher's zman)

**Data Model Clarification:**
- `master_zmanim_id` (REQUIRED) - ALL publisher zmanim link to master registry
- `linked_from_publisher_zman_id` (optional) - If created via "Link" from another publisher's zman
- `copied_from_publisher_id` (optional) - If created via "Copy" from another publisher
- **Constraint:** One publisher cannot have multiple `publisher_zmanim` with same `master_zmanim_id`

**Documentation Population:**
- Source: KosherJava library research (docs/README-KOSHERJAVA-RESEARCH.md)
- 180+ methods documented with formulas, sources, and context
- Migration script to populate documentation fields from research

### Performance
- **Pagination:** 50 items per page
- **Caching:** Master registry rarely changes - cache aggressively
- **Query Optimization:** Index on `publishers.status` and `publisher_zmanim.master_id`

---

## Risks and Assumptions

### Assumptions
- Publishers WANT to see other publishers' formulas (not competitive secrets)
- Validated publishers produce quality examples worth showcasing
- DSL syntax highlighting works well in read-only context
- Publishers understand "import" vs "link" vs "copy" semantics

### Risks
- **Privacy Concern:** Some publishers may not want their formulas visible
  - **Mitigation:** Only show approved publishers (implies consent)
  - **Future:** Add opt-out setting per publisher
- **Quality Control:** What if a "validated" publisher has bad formulas?
  - **Mitigation:** Admin approval process ensures quality threshold
  - **Future:** Add reporting mechanism
- **Overwhelming Choice:** Too many options paralyzes new users
  - **Mitigation:** Good search/filter, curated master registry first
- **Stale Data:** Publisher examples might become outdated
  - **Mitigation:** Show "last updated" timestamp on formulas

---

## Future Vision Features

**Phase 2: Enhanced Discovery**
- Formula comparison tool (side-by-side DSL diff)
- "Popular formulas" ranking (most imported/copied)
- Publisher profile pages with full catalog
- Formula collections/bundles ("Import all Chabad zmanim")

**Phase 3: Social Learning**
- Comments on master registry entries
- "This formula worked for me" endorsements
- Request status tracking dashboard
- Publisher-to-publisher messaging about formulas

**Phase 4: Intelligence**
- AI-powered formula suggestions based on coverage area
- "Publishers similar to you are using..." recommendations
- DSL pattern library extracted from validated publishers
- Formula validation warnings ("This pattern is deprecated")

---

## Executive Summary

The **Publisher Zmanim Registry Explorer** transforms publisher onboarding from intimidating to empowering by making the DSL tangible through real-world examples.

**The Problem:** New publishers face a steep learning curve with the DSL and lack visibility into proven calculation patterns used by experienced publishers.

**The Solution:** A dual-mode read-only explorer that showcases:
1. **Master Registry** - canonical zmanim definitions with comprehensive documentation (sourced from KosherJava research) and one-click import
2. **Validated Publisher Examples** - real formulas from approved publishers demonstrating DSL patterns in production

**The Impact:** Publishers discover "aha moments" by seeing how others solve complex calculations, reducing time-to-confidence and eliminating duplicate formula creation through smart import/link/copy workflows.

**Target Users:** All active publishers, with particular value for new publishers learning the DSL and experienced publishers expanding their catalogs.

**MVP Scope:** Read-only browsing with controlled import/link/copy actions, duplicate prevention, and a "Request Addition" workflow for master registry expansion.

**Success Measure:** 70% of new publishers browse the registry in week one, 50% import at least one zman, and measurable reduction in "how do I write a formula?" support questions.

This feature shifts the publisher experience from "figuring it out alone" to "learning from the community" - accelerating adoption while maintaining quality through validation and smart guardrails.

---

_This Product Brief captures the vision and requirements for Publisher Zmanim Registry Interface._

_It was created through collaborative discovery and reflects the unique needs of this enhancement to existing multi-publisher zmanim platform project._

_Next: Use the PRD workflow to create detailed product requirements from this brief._
