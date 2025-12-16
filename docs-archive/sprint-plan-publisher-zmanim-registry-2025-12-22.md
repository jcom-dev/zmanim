# Sprint Plan: Publisher Zmanim Registry Interface

**Project:** Publisher Zmanim Registry Explorer
**Planning Date:** 2025-12-22
**Sprint Number:** Sprint 11
**Epic Number:** Epic 11
**Sprint Duration:** 9-10 weeks
**Sprint Points:** 155 points
**Sprint Goal:** Complete Publisher Zmanim Registry Interface with documentation, infrastructure, UI, and launch

---

## Table of Contents

1. [Sprint Overview](#sprint-overview)
2. [Epic 11: Stories 11.1-11.26](#epic-11-publisher-zmanim-registry-interface)
3. [Dependencies](#dependencies)
4. [Release Criteria](#release-criteria)
5. [Risk Management](#risk-management)

---

## Sprint Overview

**Sprint 11 = Epic 11** delivers the complete Publisher Zmanim Registry Explorer as a single unified epic over 9-10 weeks. This represents one cohesive feature delivery that enables publishers to browse, discover, and import zmanim from the master registry and other validated publishers.

### What We're Building

A comprehensive registry interface that allows publishers to:
- Browse the complete master zmanim catalog with full documentation
- Import master zmanim with one-click simplicity
- Explore other validated publishers' zmanim catalogs
- Link or copy zmanim from other publishers with proper attribution
- View detailed documentation and halachic sources for all zmanim
- Discover related zmanim and understand calculation methods

### Sequential Phases

While delivered as a single epic, the work progresses through natural phases:

**Phase 1: Foundation (Weeks 1-2)** - Stories 11.1-11.3
- Master registry documentation backfill (BLOCKING)
- Publisher 1 data integrity audit (BLOCKING)
- Database schema extensions (BLOCKING)

**Phase 2: Infrastructure (Weeks 2-4)** - Stories 11.4-11.8
- Core API endpoints for master registry and publisher examples
- Basic page scaffold and navigation
- Location and date controls

**Phase 3: Master Registry Browser (Weeks 4-6)** - Stories 11.9-11.13
- Master registry table with live preview times
- Search and filtering capabilities
- Import functionality with duplicate prevention
- Request addition workflow

**Phase 4: Publisher Examples Browser (Weeks 6-8)** - Stories 11.14-11.19
- Publisher search and selection
- Publisher zmanim catalog display
- Coverage-aware location restrictions
- Link and copy actions with attribution

**Phase 5: Polish & Launch (Weeks 8-10)** - Stories 11.20-11.26
- Comprehensive info modals for documentation
- Algorithm page cleanup (remove add functionality)
- Focus/scroll enhancements
- Visual polish and final UX refinements
- E2E testing and QA
- Launch

### Sprint Summary

**Total Stories:** 26
**Total Points:** 155
**Duration:** 9-10 weeks
**Epic:** Single Epic 11

---

## Epic 11: Publisher Zmanim Registry Interface

**Epic Goal:** Deliver complete publisher zmanim registry explorer with browsing, import, link/copy, and comprehensive documentation capabilities.

**Epic Points:** 155

---

### Story 11.1: Master Registry Documentation Backfill (13 points)
**Priority:** CRITICAL - BLOCKING
**Phase:** Foundation
**Description:** Populate all master zmanim entries with comprehensive documentation sourced from KosherJava research

**Tasks:**
- Extract documentation from `docs/README-KOSHERJAVA-RESEARCH.md` and related research files
- Create migration script to populate documentation fields:
  - `full_description` (REQUIRED)
  - `halachic_source` (REQUIRED - e.g., "GRA", "MGA 72 min")
  - `formula_explanation` (REQUIRED)
  - `usage_context` (RECOMMENDED)
  - `related_zmanim_ids` (NICE TO HAVE)
- Validate 100% coverage of all master registry entries
- Manual QA review of 20 sample entries for quality

**Acceptance Criteria:**
- Every master zman has `full_description`, `halachic_source`, and `formula_explanation`
- Documentation is accurate, clear, and matches KosherJava research
- No placeholder or empty documentation fields
- Related zmanim IDs correctly reference existing master entries

**Dependencies:** None (BLOCKING for all subsequent work)

---

### Story 11.2: Publisher 1 (MH Zmanim) Data Integrity Audit (8 points)
**Priority:** CRITICAL - BLOCKING
**Phase:** Foundation
**Description:** Audit all Publisher 1 zmanim to ensure correct master_zmanim_id linkages

**Tasks:**
- Query all Publisher 1 `publisher_zmanim` records
- Compare publisher formulas against linked master registry formulas
- Identify mismatches, incorrect linkages, and missing references
- Generate audit report with findings and recommendations
- Create SQL migration to fix incorrect `master_zmanim_id` values
- Execute corrections and re-validate

**Acceptance Criteria:**
- Audit report documents all Publisher 1 zmanim reviewed
- 100% of Publisher 1 zmanim have correct `master_zmanim_id` linkage
- Zero formula mismatches between publisher and master
- Correction migration script tested and applied
- Approval from tech lead on audit results

**Dependencies:** None (BLOCKING for Publisher Examples browser)

---

### Story 11.3: Database Schema Extensions (5 points)
**Priority:** HIGH - BLOCKING
**Phase:** Foundation
**Description:** Add new fields to support registry filtering, documentation, and attribution

**Tasks:**
- Create migration for `master_zmanim_registry` new fields:
  - `shita` (text) - Standardized shita code
  - `category` (text) - Primary category
  - `full_description` (text)
  - `halachic_source` (text)
  - `formula_explanation` (text)
  - `usage_context` (text)
  - `related_zmanim_ids` (int[])
- Create migration for `publisher_zmanim` attribution fields:
  - `copied_from_publisher_id` (nullable int)
  - `linked_from_publisher_zman_id` (nullable int)
- Add indexes on `publishers.status` and `publisher_zmanim.master_zmanim_id`
- Add unique constraint: `(publisher_id, master_zmanim_id)` on `publisher_zmanim`
- Update SQLc models

**Acceptance Criteria:**
- Migrations run successfully on dev/staging
- All new fields are nullable or have defaults (non-breaking)
- Indexes improve query performance (measured via EXPLAIN)
- Unique constraint prevents duplicate master linkages per publisher
- SQLc regenerated, models compile

**Dependencies:** None (BLOCKING for all API and database work)

---

### Story 11.4: Master Registry API - List with Preview Times (8 points)
**Priority:** HIGH
**Phase:** Infrastructure
**Description:** Create API endpoint to list master zmanim with calculated preview times for location

**Tasks:**
- Create SQLc query: `ListMasterZmanimForRegistry`
  - Include all master zmanim fields + documentation
  - Join to check ownership status (current publisher already imported)
  - Support pagination (50 per page)
- Add handler: `GET /api/v1/publisher/registry/master?locality_id={id}&date={YYYY-MM-DD}&page={n}`
- Integrate zmanim calculation engine to compute preview times
- Add filters: category, shita, status (available/imported)
- Return response with zmanim + ownership status + preview times
- Write tests for handler and query

**Acceptance Criteria:**
- Endpoint returns paginated master zmanim
- Each entry includes calculated preview time for location/date
- Ownership status correctly shows if current publisher already imported
- Filters work: category, shita, status
- Response time < 500ms for 50 items
- Unit tests pass, integration test with real calculation

**Dependencies:** Story 11.3 (schema extensions)

---

### Story 11.5: Publisher Examples API - List Validated Publishers (5 points)
**Priority:** HIGH
**Phase:** Infrastructure
**Description:** Create endpoint to list all validated publishers for dropdown

**Tasks:**
- Create SQLc query: `ListValidatedPublishers`
  - Filter: `status = 'approved' AND deleted_at IS NULL AND suspended_at IS NULL AND inactive_at IS NULL`
  - Return: `id`, `name`, `display_name`, `created_at`
- Add handler: `GET /api/v1/publisher/registry/publishers`
- Add caching (validated publishers change infrequently)
- Write tests

**Acceptance Criteria:**
- Endpoint returns only validated publishers
- Response includes id, name, display_name
- Results cached for 1 hour
- Unit and integration tests pass

**Dependencies:** Story 11.3 (schema extensions)

---

### Story 11.6: Publisher Examples API - List Publisher Zmanim with Preview (8 points)
**Priority:** HIGH
**Phase:** Infrastructure
**Description:** Create endpoint to list specific publisher's zmanim with preview times

**Tasks:**
- Create SQLc query: `ListPublisherZmanimForRegistry`
  - Filter by target publisher ID
  - Include master zman details (inherited shita, category)
  - Check ownership status (current publisher already has this master zman)
  - Support pagination
- Add handler: `GET /api/v1/publisher/registry/publishers/{publisher_id}?locality_id={id}&date={YYYY-MM-DD}`
- Validate locality is within target publisher's coverage
- Calculate preview times for publisher's zmanim
- Add filters: category, shita, status
- Write tests

**Acceptance Criteria:**
- Endpoint returns target publisher's zmanim with preview times
- Locality validation works (only covered areas allowed)
- Ownership status shows if current publisher has same master zman
- Filters work correctly
- Response time < 500ms
- Tests pass

**Dependencies:** Story 11.3 (schema extensions)

---

### Story 11.7: Coverage API - Get Publisher Coverage Localities (3 points)
**Priority:** MEDIUM
**Phase:** Infrastructure
**Description:** Create endpoint to get localities covered by a publisher

**Tasks:**
- Create SQLc query: `GetPublisherCoverageLocalities`
  - Query `publisher_coverage` for target publisher
  - Return locality IDs and names
- Add handler: `GET /api/v1/publisher/registry/coverage/{publisher_id}`
- Add caching (coverage changes infrequently)
- Write tests

**Acceptance Criteria:**
- Endpoint returns all localities covered by publisher
- Response cached for 30 minutes
- Tests pass

**Dependencies:** None

---

### Story 11.8: Registry Page Scaffold & Navigation (5 points)
**Priority:** HIGH
**Phase:** Infrastructure
**Description:** Create basic registry page structure with tab navigation

**Tasks:**
- Create route: `/publisher/registry`
- Create page component: `app/publisher/registry/page.tsx`
- Add tab navigation: "Master Registry" | "Publisher Examples"
- Add header controls:
  - Location picker (shared across tabs)
  - Date selector (default: today)
  - Location badge display
- Add "Browse Registry" button to `/publisher/algorithm` header
- Wire up basic navigation between pages
- Add empty state placeholders for each tab

**Acceptance Criteria:**
- `/publisher/registry` route accessible to authenticated publishers
- Tab switching works smoothly
- Location and date pickers functional (state persists across tabs)
- Navigation from algorithm page works
- Mobile responsive layout
- No content yet, just scaffold

**Dependencies:** None

---

### Story 11.9: Master Registry Table with Live Data (8 points)
**Priority:** HIGH
**Phase:** Master Registry Browser
**Description:** Build master registry table displaying zmanim with all metadata and preview times

**Tasks:**
- Create `RegistryMasterBrowser.tsx` component
- Integrate API: `GET /api/v1/publisher/registry/master`
- Display table/card layout with columns:
  - Zman name (Hebrew + English)
  - DSL formula (syntax highlighted using CodeMirror)
  - Preview time (formatted 12-hour AM/PM)
  - Description (one-line summary)
  - Category badge
  - Shita badge (color-coded)
  - Status indicator (Available / Imported)
- Add pagination controls (50 per page)
- Handle loading states and errors
- Responsive design (table on desktop, cards on mobile)

**Acceptance Criteria:**
- Table displays all master zmanim with correct data
- Preview times calculated and formatted correctly
- Syntax highlighting works for DSL formulas
- Status badges show correct ownership state
- Pagination works smoothly
- Mobile responsive
- Loading and error states handled gracefully

**Dependencies:** Story 11.4 (Master Registry API), Story 11.8 (page scaffold)

---

### Story 11.10: Master Registry Search & Filters (5 points)
**Priority:** HIGH
**Phase:** Master Registry Browser
**Description:** Add comprehensive search and filtering for master registry

**Tasks:**
- Add filter panel (collapsible sidebar on desktop, drawer on mobile)
- Implement filters:
  - Text search (zman name Hebrew/English, formula keywords)
  - Category multi-select dropdown
  - Shita multi-select dropdown
  - Status filter (Available / Imported)
- Add "Clear all filters" button
- Show active filter chips
- Debounce text search
- Update URL params with filter state

**Acceptance Criteria:**
- All filters work correctly and combine properly
- Text search filters client-side (fast feedback)
- Filter state persists in URL
- Active filters shown as chips with remove option
- Clear all resets to default state
- Mobile drawer works smoothly

**Dependencies:** Story 11.9 (Master Registry Table)

---

### Story 11.11: Import Action & Duplicate Prevention (8 points)
**Priority:** CRITICAL
**Phase:** Master Registry Browser
**Description:** Implement import functionality with smart duplicate prevention

**Tasks:**
- Create API endpoint: `POST /api/v1/publisher/registry/import`
  - Body: `{ master_zmanim_id: number }`
  - Create `publisher_zmanim` record linking to master
  - Check for duplicates: current publisher already has this master_zmanim_id
  - Return error if duplicate, success + new zman key if created
- Add SQLc query: `CreatePublisherZmanFromMaster`
- Frontend: Add "Import" button to each row
  - Disable if already imported (show "Imported ✓" badge)
  - Show loading state during import
  - On success: redirect to `/publisher/algorithm?focus={zman_key}`
  - On error: show toast with reason
- Add tooltip explaining why button is disabled
- Add confirmation dialog before import

**Acceptance Criteria:**
- Import creates correct publisher_zmanim record
- Duplicate prevention works (DB constraint + API validation)
- Button states reflect ownership correctly
- Success redirects to algorithm page with focus param
- Error handling shows clear messages
- Confirmation dialog prevents accidental imports
- Tests cover duplicate scenarios

**Dependencies:** Story 11.9 (Master Registry Table), Story 11.3 (unique constraint)

---

### Story 11.12: Request Addition Button & Workflow (3 points)
**Priority:** MEDIUM
**Phase:** Master Registry Browser
**Description:** Add "Request Addition" button to trigger existing request modal

**Tasks:**
- Add "Request Addition" button to master registry header
- Reuse existing `RequestZmanModal` component from algorithm page
- Pre-populate source field: "registry_explorer_master"
- Wire up modal open/close handlers
- On success: show toast, do not navigate

**Acceptance Criteria:**
- Button opens request modal
- Modal reuses existing component (no duplication)
- Source field indicates request from registry
- Success shows confirmation
- No navigation away from registry

**Dependencies:** Story 11.9 (Master Registry Table)

---

### Story 11.13: Empty States & Visual Polish (3 points)
**Priority:** LOW
**Phase:** Master Registry Browser
**Description:** Add empty states and polish visual design for master registry tab

**Tasks:**
- Add empty states:
  - "No master zmanim match your filters"
  - "Try adjusting your filters"
- Add shita badge color coding (GRA=blue, MGA=green, etc.)
- Add category badge styling
- Polish table/card styling for consistency
- Add hover states for rows
- Add tooltips for DSL syntax (hover over formula)

**Acceptance Criteria:**
- Empty states show appropriate messages
- Badges use consistent color scheme
- Hover states provide visual feedback
- Tooltips work on hover (DSL help)
- Design matches existing publisher UI patterns

**Dependencies:** Story 11.9 (Master Registry Table)

---

### Story 11.14: Publisher Search & Selection (5 points)
**Priority:** HIGH
**Phase:** Publisher Examples Browser
**Description:** Build publisher search dropdown to select which publisher's catalog to view

**Tasks:**
- Create publisher search autocomplete dropdown
- Integrate API: `GET /api/v1/publisher/registry/publishers`
- Display: publisher name, display_name
- On selection:
  - Load selected publisher's coverage localities
  - Clear location if current location not in coverage
  - Fetch selected publisher's zmanim
- Add "No publisher selected" empty state
- Add loading state while fetching publishers

**Acceptance Criteria:**
- Dropdown shows all validated publishers
- Search/autocomplete works smoothly
- Selection triggers zmanim fetch
- Coverage-aware location clearing works
- Empty and loading states handled
- Mobile friendly dropdown

**Dependencies:** Story 11.5 (Publisher Examples API), Story 11.8 (page scaffold)

---

### Story 11.15: Publisher Zmanim Table with Live Data (8 points)
**Priority:** HIGH
**Phase:** Publisher Examples Browser
**Description:** Display selected publisher's zmanim catalog with metadata and preview times

**Tasks:**
- Create `RegistryPublisherBrowser.tsx` component
- Integrate API: `GET /api/v1/publisher/registry/publishers/{id}?locality_id=&date=`
- Display table/card layout with columns:
  - Zman name (may be customized by publisher)
  - Publisher name (prominent attribution)
  - DSL formula (syntax highlighted)
  - Preview time (formatted)
  - "Validated Publisher" badge
  - Master registry name (inherited)
  - Shita badge (inherited from master)
  - Status indicator (Available / Already in Your Catalog)
- Add pagination
- Handle loading/error states
- Responsive design

**Acceptance Criteria:**
- Table displays selected publisher's zmanim
- Attribution shows clearly (publisher name)
- Preview times accurate for selected location
- Ownership status reflects current publisher's catalog
- Pagination works
- Mobile responsive
- Loading and error states handled

**Dependencies:** Story 11.6 (Publisher Zmanim API), Story 11.14 (publisher selection)

---

### Story 11.16: Coverage-Restricted Location Selection (5 points)
**Priority:** HIGH
**Phase:** Publisher Examples Browser
**Description:** Restrict location dropdown to only show localities covered by selected publisher

**Tasks:**
- Integrate API: `GET /api/v1/publisher/registry/coverage/{publisher_id}`
- Filter location dropdown options to coverage localities only
- Show message: "This publisher only covers certain localities"
- If selected location not in coverage: clear and show notification
- Handle case where publisher has no coverage (show warning)
- Share location state with Master Registry tab (cross-tab persistence)

**Acceptance Criteria:**
- Location dropdown only shows covered localities
- Switching publishers clears location if not covered
- Cross-tab location state works (same location in both tabs)
- Coverage message displays when appropriate
- No coverage warning shows clearly

**Dependencies:** Story 11.7 (Coverage API), Story 11.14 (publisher selection)

---

### Story 11.17: Publisher Examples Search & Filters (5 points)
**Priority:** MEDIUM
**Phase:** Publisher Examples Browser
**Description:** Add filtering within selected publisher's catalog

**Tasks:**
- Add filter panel (same design as master registry)
- Implement filters:
  - Text search (zman name, formula keywords)
  - Category multi-select
  - Shita multi-select
  - Status (Available / Already in Catalog)
- Active filter chips
- Clear all filters button
- URL param persistence

**Acceptance Criteria:**
- All filters work correctly
- Filters apply to selected publisher's catalog only
- Filter state persists in URL
- Clear all resets filters
- Mobile drawer works

**Dependencies:** Story 11.15 (Publisher Zmanim Table)

---

### Story 11.18: Link Action with Duplicate Prevention (8 points)
**Priority:** HIGH
**Phase:** Publisher Examples Browser
**Description:** Implement "Link" action to reference another publisher's zman

**Tasks:**
- Create API endpoint: `POST /api/v1/publisher/registry/link`
  - Body: `{ publisher_zman_id: number }`
  - Create `publisher_zmanim` record with:
    - `master_zmanim_id` (from source zman)
    - `linked_from_publisher_zman_id` (attribution)
  - Check duplicate: current publisher already has this master_zmanim_id
  - Return error if duplicate, success + zman key if created
- Add SQLc query: `CreatePublisherZmanLink`
- Frontend: Add "Link" button
  - Disable if already in catalog (same master_zmanim_id check)
  - Show loading state during link
  - On success: redirect to `/publisher/algorithm?focus={zman_key}`
  - On error: show toast
- Add tooltip explaining link vs copy
- Add confirmation dialog

**Acceptance Criteria:**
- Link creates correct publisher_zmanim with link attribution
- Duplicate prevention works (same master_zmanim_id)
- Button states reflect ownership
- Success redirects to algorithm page
- Error handling clear
- Confirmation prevents accidents
- Tests cover duplicate scenarios

**Dependencies:** Story 11.15 (Publisher Zmanim Table), Story 11.3 (unique constraint)

---

### Story 11.19: Copy Action with Duplicate Prevention (8 points)
**Priority:** HIGH
**Phase:** Publisher Examples Browser
**Description:** Implement "Copy" action to duplicate formula as independent zman

**Tasks:**
- Create API endpoint: `POST /api/v1/publisher/registry/copy`
  - Body: `{ publisher_zman_id: number }`
  - Create `publisher_zmanim` record with:
    - `master_zmanim_id` (from source)
    - `copied_from_publisher_id` (attribution)
  - Check duplicate: current publisher already has this master_zmanim_id
  - Return error if duplicate, success + zman key if created
- Add SQLc query: `CreatePublisherZmanCopy`
- Frontend: Add "Copy" button
  - Disable if already in catalog
  - Show loading state
  - On success: redirect to `/publisher/algorithm?focus={zman_key}`
  - On error: show toast
- Add tooltip explaining copy vs link
- Add confirmation dialog

**Acceptance Criteria:**
- Copy creates independent publisher_zmanim with copy attribution
- Duplicate prevention works
- Button states correct
- Success redirects to algorithm page
- Error handling clear
- Confirmation dialog shown
- Tests cover scenarios

**Dependencies:** Story 11.15 (Publisher Zmanim Table), Story 11.3 (unique constraint)

---

### Story 11.20: Master Zman Detail Modal (8 points)
**Priority:** HIGH
**Phase:** Polish & Launch
**Description:** Build comprehensive documentation modal for master zmanim

**Tasks:**
- Create `MasterZmanDetailModal.tsx` component
- Full-screen modal design (similar to existing zman detail view)
- Sections:
  - Header: Zman name (Hebrew + English), key
  - Summary: Brief description
  - DSL Formula: Syntax highlighted with copy button
  - Scientific Explanation: Plain language
  - Astronomical Definition: Technical details
  - Algorithm: Calculation method
  - Halachic Significance: Usage in halacha
  - Halachic Sources: Expandable cards for each posek/opinion
  - Practical Notes: When/where applicable
  - Related Zmanim: Clickable links (opens their modal)
- Add navigation between related zmanim within modal
- Add close button and keyboard shortcuts (ESC)
- Mobile responsive

**Acceptance Criteria:**
- Modal displays all documentation sections
- Formula copy button works
- Related zmanim links open correct modal
- Navigation smooth, no page refresh
- Mobile responsive and readable
- ESC key closes modal
- Accessible (keyboard navigation, ARIA labels)

**Dependencies:** Story 11.1 (documentation backfill), Story 11.9 (Master Registry Table)

---

### Story 11.21: Publisher Zman Detail Modal (5 points)
**Priority:** HIGH
**Phase:** Polish & Launch
**Description:** Build modal showing publisher-specific fields + inherited master documentation

**Tasks:**
- Create `PublisherZmanDetailModal.tsx` component
- Two-section layout:
  - **Top Section: Publisher-Specific Fields**
    - Zman name (may be customized)
    - Publisher name (attribution)
    - DSL formula (this publisher's version)
    - Custom notes/overrides
    - Attribution: "Copied from [Publisher]" or "Linked to [Publisher]"
  - **Bottom Section: Master Zman Documentation**
    - Reuse content/layout from `MasterZmanDetailModal`
    - All inherited documentation
- Add expandable "View Details" panel for metadata
- Mobile responsive

**Acceptance Criteria:**
- Modal shows both publisher and master sections
- Attribution displays correctly (copy/link source)
- Master documentation inherited and displayed
- Expandable details work
- Mobile responsive
- Accessible

**Dependencies:** Story 11.20 (Master Zman Detail Modal), Story 11.15 (Publisher Zmanim Table)

---

### Story 11.22: Info Buttons & Modal Triggers (3 points)
**Priority:** MEDIUM
**Phase:** Polish & Launch
**Description:** Wire up info buttons to trigger detail modals

**Tasks:**
- Add info button to each row in master registry table
- Add info button to each row in publisher examples table
- Wire up click handlers to open appropriate modal
- Pass correct zman data to modal
- Handle modal open/close state
- Add keyboard shortcuts (ESC to close)

**Acceptance Criteria:**
- Info buttons trigger correct modal
- Modal receives correct data
- Open/close animations smooth
- ESC key works
- Only one modal open at a time

**Dependencies:** Story 11.20 (Master Zman Modal), Story 11.21 (Publisher Zman Modal)

---

### Story 11.23: Remove Add Functionality from Algorithm Page (5 points)
**Priority:** HIGH - GREENFIELD CLEANUP
**Phase:** Polish & Launch
**Description:** Delete all zman addition UI from algorithm page (complete separation of concerns)

**Tasks:**
- Remove from `/app/publisher/algorithm/page.tsx`:
  - "Add Zman" button and dialog (lines 959-1238)
  - `MasterZmanPicker` component import and usage
  - `PublisherZmanPicker` component import and usage
  - `RequestZmanModal` import (moved to registry)
  - State: `showAddZmanModeDialog`, `showZmanPicker`, `showPublisherZmanPicker`, `showRequestZmanModal`
  - All "Add Zman Mode" handlers
- Verify no other references to removed components
- Update tests (remove tests for deleted functionality)
- Test algorithm page still works for editing existing zmanim

**Acceptance Criteria:**
- All add zman UI removed from algorithm page
- Algorithm page renders without errors
- Editing existing zmanim still works
- No console errors
- Tests updated and passing
- Code review confirms clean removal

**Dependencies:** Story 11.11 (Import), Story 11.18 (Link), Story 11.19 (Copy) - all actions moved to registry

---

### Story 11.24: Algorithm Page Focus & Scroll Enhancement (3 points)
**Priority:** MEDIUM
**Phase:** Polish & Launch
**Description:** Add URL param handling to focus and scroll to specific zman

**Tasks:**
- Add URL param parsing: `?focus={zman_key}`
- On page load with focus param:
  - Find zman in list by key
  - Scroll to zman (smooth scroll)
  - Highlight zman (temporary highlight animation)
  - Clear URL param after highlighting
- Add visual highlight effect (fade out after 2 seconds)
- Test with navigation from registry actions

**Acceptance Criteria:**
- Focus param triggers scroll to zman
- Zman highlighted visually
- Smooth scroll animation
- Highlight fades after 2 seconds
- Works from all registry actions (import, link, copy)
- No errors if zman not found (graceful handling)

**Dependencies:** Story 11.11 (Import), Story 11.18 (Link), Story 11.19 (Copy)

---

### Story 11.25: Visual Polish & Final UX Refinements (5 points)
**Priority:** MEDIUM
**Phase:** Polish & Launch
**Description:** Final polish pass on entire registry interface

**Tasks:**
- Consistent spacing, typography, colors across tabs
- Ensure all badges use same design system
- Hover states polished for all interactive elements
- Loading skeletons for data fetching
- Smooth transitions between tabs
- Empty states refined
- Error messages user-friendly
- Mobile testing and fixes
- Accessibility audit (keyboard nav, screen reader)
- Cross-browser testing (Chrome, Firefox, Safari)

**Acceptance Criteria:**
- Visual consistency across all pages
- Smooth animations and transitions
- Loading states provide good feedback
- Empty states helpful and clear
- Error messages actionable
- Mobile experience polished
- Keyboard navigation works throughout
- No accessibility violations
- Works in all major browsers

**Dependencies:** All previous UI stories (11.9-11.22)

---

### Story 11.26: E2E Testing & QA (5 points)
**Priority:** HIGH
**Phase:** Polish & Launch
**Description:** Comprehensive end-to-end testing of all registry workflows

**Tasks:**
- Write E2E tests for:
  - Master registry import flow
  - Publisher examples link flow
  - Publisher examples copy flow
  - Duplicate prevention scenarios
  - Filter and search
  - Modal opening and navigation
  - Cross-tab location persistence
- Manual QA checklist:
  - All user journeys from product brief
  - Edge cases (no coverage, no publishers, etc.)
  - Mobile and desktop
  - Different publisher accounts
- Performance testing (50 zmanim load time)
- Create bug list and prioritize fixes

**Acceptance Criteria:**
- All E2E tests pass
- Manual QA checklist 100% complete
- Critical bugs fixed before launch
- Performance targets met (< 500ms API, < 2s page load)
- No console errors in production build

**Dependencies:** All previous stories (complete feature set)

---

## Dependencies

### Story Dependencies Flow

**Phase 1: Foundation (BLOCKING)**
- Story 11.1: Master Registry Documentation Backfill (BLOCKING for info modals)
- Story 11.2: Publisher 1 Data Integrity Audit (BLOCKING for Publisher Examples browser)
- Story 11.3: Database Schema Extensions (BLOCKING for all API/database work)

↓

**Phase 2: Infrastructure**
- Story 11.4: Master Registry API (depends on 11.3)
- Story 11.5: Publisher Examples API (depends on 11.3)
- Story 11.6: Publisher Zmanim API (depends on 11.3)
- Story 11.7: Coverage API (no dependencies)
- Story 11.8: Registry Page Scaffold (no dependencies)

↓

**Phase 3: Master Registry Browser**
- Story 11.9: Master Registry Table (depends on 11.4, 11.8)
- Story 11.10: Master Registry Search & Filters (depends on 11.9)
- Story 11.11: Import Action (depends on 11.9, 11.3)
- Story 11.12: Request Addition Button (depends on 11.9)
- Story 11.13: Empty States & Polish (depends on 11.9)

↓

**Phase 4: Publisher Examples Browser**
- Story 11.14: Publisher Search & Selection (depends on 11.5, 11.8)
- Story 11.15: Publisher Zmanim Table (depends on 11.6, 11.14)
- Story 11.16: Coverage-Restricted Location (depends on 11.7, 11.14)
- Story 11.17: Publisher Examples Search & Filters (depends on 11.15)
- Story 11.18: Link Action (depends on 11.15, 11.3)
- Story 11.19: Copy Action (depends on 11.15, 11.3)

↓

**Phase 5: Polish & Launch**
- Story 11.20: Master Zman Detail Modal (depends on 11.1, 11.9)
- Story 11.21: Publisher Zman Detail Modal (depends on 11.20, 11.15)
- Story 11.22: Info Buttons & Modal Triggers (depends on 11.20, 11.21)
- Story 11.23: Remove Add Functionality (depends on 11.11, 11.18, 11.19)
- Story 11.24: Algorithm Page Focus & Scroll (depends on 11.11, 11.18, 11.19)
- Story 11.25: Visual Polish (depends on all UI stories 11.9-11.22)
- Story 11.26: E2E Testing & QA (depends on all previous stories)

### Critical Dependencies

**Story 11.1, 11.2, 11.3 (Foundation) - MUST COMPLETE FIRST:**
- Documentation backfill blocks info modal quality
- Publisher 1 audit blocks Publisher Examples browser reliability
- Schema extensions block all API and database work

**Technical Dependencies:**
- Database: PostgreSQL with PostGIS, Redis cache
- Authentication: Clerk integration, PublisherResolver
- Calculation Engine: Existing zmanim calculation service
- UI Components: CodeMirror for DSL syntax highlighting, existing modal patterns
- APIs: All new endpoints follow 6-step handler pattern

**External Dependencies:**
- Access to KosherJava research documentation
- Database migration permissions
- Publisher 1 data access for audit
- Domain expert availability for documentation review
- QA resources for final testing phase

---

## Release Criteria

### Pre-Launch Checklist

**Foundation Complete:**
- [ ] All master zmanim have complete documentation (3 required fields minimum)
- [ ] Publisher 1 audit complete with 100% correct linkages
- [ ] Database migrations deployed to dev/staging
- [ ] No breaking changes to existing APIs or queries
- [ ] Tech lead approval on audit report
- [ ] Documentation quality spot-checked and approved

**Technical Quality:**
- [ ] All story acceptance criteria met (26 stories)
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance targets met:
  - API response < 500ms for 50 items
  - Page load < 2 seconds
  - No memory leaks
- [ ] Accessibility audit passed
- [ ] Cross-browser testing complete (Chrome, Firefox, Safari)
- [ ] Mobile responsive on iOS and Android
- [ ] Security review complete (PublisherResolver, duplicate prevention)

**Documentation:**
- [ ] API docs updated (Swagger)
- [ ] User guide for registry created
- [ ] Developer onboarding documentation updated
- [ ] Release notes prepared

**Monitoring:**
- [ ] Analytics tracking configured:
  - Registry page views
  - Import/link/copy actions
  - Modal opens
  - Filter usage
- [ ] Error tracking configured
- [ ] Performance monitoring active

### Launch Day Tasks

- [ ] Deploy to production
- [ ] Run smoke tests on production
- [ ] Monitor error rates and performance
- [ ] Notify all publishers of new feature (email announcement)
- [ ] Update help docs and FAQs
- [ ] Monitor support tickets for issues
- [ ] Verify analytics data flowing

### Post-Launch (Week 1)

- [ ] Review analytics:
  - % of publishers who visited registry
  - Import/link/copy rates
  - Most viewed master zmanim
  - Filter usage patterns
- [ ] Collect user feedback
- [ ] Fix critical bugs (if any)
- [ ] Iterate on UX based on feedback
- [ ] Monitor performance metrics

### MVP Success Metrics (30 days post-launch)

- [ ] 70%+ of new publishers browse registry within first week
- [ ] 50%+ of new publishers import at least 1 master zman
- [ ] 30%+ explore publisher examples view
- [ ] Zero duplicate zmanim created (prevention works)
- [ ] < 5% of "Request Addition" submissions are duplicates
- [ ] Reduction in support questions about DSL syntax
- [ ] Positive user feedback (survey or direct feedback)

---

## Risk Management

### Sprint 11 Risks

Given the large scope of Sprint 11 (155 points over 9-10 weeks), comprehensive risk management is critical.

| Risk | Probability | Impact | Mitigation Strategy | Owner |
|------|-------------|--------|---------------------|-------|
| **Documentation quality inconsistent** | Medium | High | Manual QA review of samples, iterate on content, domain expert review sessions | Tech Lead |
| **Publisher 1 audit reveals major data issues** | Medium | High | Budget extra time for corrections, involve domain expert early, phased correction approach | Backend Dev |
| **Calculation performance slow with 50 zmanim** | Low | Medium | Load testing early, optimize calculations, implement caching, reduce page size if needed | Backend Dev |
| **Duplicate prevention has edge cases** | Medium | High | Comprehensive test coverage, DB constraint as backup layer, thorough code review | Backend Dev |
| **Coverage restriction UX confusing to users** | Medium | Medium | User testing with beta publishers, clear messaging and tooltips, iterate based on feedback | Frontend Dev |
| **Modal complexity causes performance issues** | Low | Medium | Lazy loading of modals, render optimization, performance profiling | Frontend Dev |
| **Algorithm page removal breaks existing workflows** | Medium | High | Thorough testing, staged rollout plan, rollback strategy prepared | Full Stack Dev |
| **Foundation stories run long** | Low | High | Start immediately, parallel work on infrastructure where possible | PM |
| **Privacy concerns from publishers** | Low | Medium | Only show approved publishers, add opt-out mechanism for future, clear communication in launch announcement | Product |
| **Sprint scope creep (155 points)** | Medium | High | Strict prioritization, weekly scope reviews, ready to descope non-critical stories | PM |
| **Team velocity mismatch** | Medium | High | Track actual velocity weekly, adjust timeline or scope early if needed | PM |
| **Integration issues between phases** | Low | Medium | Regular integration testing, clear phase handoffs, demo each phase completion | Tech Lead |

### Phase-Specific Risks

**Phase 1 Risks (Foundation):**
- Documentation extraction from research files complex
- Publisher 1 data quality worse than expected
- Schema migrations cause unforeseen issues
- **Mitigation:** Start immediately, allocate senior resources, have rollback plans

**Phase 2 Risks (Infrastructure):**
- Performance issues with calculation engine integration
- Coverage validation logic complex
- Tab state management issues
- **Mitigation:** Early performance testing, simple MVP for coverage, use URL params for state

**Phase 3 Risks (Master Registry):**
- Syntax highlighting performance with many rows
- Duplicate prevention edge cases
- Redirect with focus parameter unreliable
- **Mitigation:** Lazy load CodeMirror, comprehensive duplicate tests, fallback redirect strategy

**Phase 4 Risks (Publisher Examples):**
- Link vs Copy semantics unclear to users
- Coverage restriction UX confusing
- Performance with large publisher catalogs
- **Mitigation:** Clear tooltips and confirmation dialogs, user testing, same pagination as master registry

**Phase 5 Risks (Polish & Launch):**
- Modal navigation complexity
- Algorithm page removal breaks workflows
- E2E test brittleness
- Launch timing pressure
- **Mitigation:** Reuse modal patterns, comprehensive testing, stable test selectors, buffer time before launch

### Contingency Plans

**If Foundation stories run long:**
- Infrastructure work (Story 11.8) can start in parallel
- Documentation can continue while infrastructure progresses
- Publisher 1 audit MUST complete before Phase 4 (examples browser)
- Consider temporary placeholder documentation if needed

**If performance issues arise:**
- Reduce page size from 50 to 25 items
- Add server-side caching for master registry listings
- Implement pagination token system for better performance
- Defer heavy calculations to background job if necessary

**If duplicate prevention fails:**
- Database constraint will catch errors as backup
- Create admin tool to identify and clean up duplicates
- Add stronger client-side validation checks
- Consider adding warning system before hard block

**If user adoption low post-launch:**
- Add interactive onboarding tour
- Email campaign highlighting key benefits
- In-app prompts to explore registry
- Offer incentives for early adopters
- Conduct user interviews to understand barriers

**If timeline slips:**
- Descope polish stories (11.25, 11.26 partially)
- Launch with Phase 4 complete, polish in Sprint 12
- Prioritize core import/link/copy functionality
- Defer some modal features to post-launch iteration

**If critical bug found near launch:**
- Have rollback plan ready
- Delay launch if blocking issue
- Implement feature flag to disable registry if needed
- Communicate transparently with publishers

---

## Sprint 11 Definition of Done

### Phase Completion Criteria

**Phase 1 Complete (Foundation):**
- [ ] All master zmanim documented (100% coverage)
- [ ] Publisher 1 audit complete and corrections applied
- [ ] All schema migrations deployed
- [ ] SQLc models updated and compiling

**Phase 2 Complete (Infrastructure):**
- [ ] All API endpoints deployed and tested
- [ ] Registry page scaffold functional
- [ ] Navigation between pages working
- [ ] All tests passing

**Phase 3 Complete (Master Registry Browser):**
- [ ] Master registry tab fully functional
- [ ] Search and filters working
- [ ] Import action creating zmanim successfully
- [ ] Duplicate prevention working
- [ ] Request modal integrated

**Phase 4 Complete (Publisher Examples Browser):**
- [ ] Publisher search and selection working
- [ ] Publisher zmanim table functional
- [ ] Coverage-restricted location selection working
- [ ] Link and copy actions working
- [ ] All filters functional

**Phase 5 Complete (Polish & Launch):**
- [ ] Both info modals complete
- [ ] Algorithm page add functionality removed
- [ ] Focus/scroll enhancement working
- [ ] Visual polish complete
- [ ] E2E tests passing
- [ ] QA complete

### Epic 11 Final Definition of Done

- [ ] All 26 stories completed
- [ ] All 155 story points delivered
- [ ] All acceptance criteria met
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance targets met
- [ ] Accessibility compliant
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Deployed to production
- [ ] Release notes published
- [ ] Publishers notified
- [ ] Monitoring active

---

## Summary

**Sprint 11 = Epic 11** represents a unified 9-10 week effort to deliver the complete Publisher Zmanim Registry Explorer. With 26 stories totaling 155 points, this single epic consolidates the entire feature delivery from foundation through launch.

### Key Success Factors

1. **Foundation completion critical** - Documentation and data quality are the base
2. **Strong sequential dependencies** - Each phase builds on previous work
3. **Comprehensive risk management** - Large scope requires proactive mitigation
4. **Regular integration** - Demo each phase completion to catch issues early
5. **Scope discipline** - Resist adding features, maintain focus on defined stories
6. **Quality gates** - Don't progress to next phase until current is truly complete

### Development Timeline

**Weeks 1-2: Foundation**
- Documentation backfill and data audit (blocking foundation)

**Weeks 2-4: Infrastructure**
- API infrastructure and page scaffold

**Weeks 4-6: Master Registry Browser**
- Master registry browser and import

**Weeks 6-8: Publisher Examples Browser**
- Publisher examples and link/copy actions

**Weeks 8-10: Polish & Launch**
- Info modals, cleanup, polish, launch

### Expected Outcomes

Upon successful completion of Epic 11:
- Publishers can browse 100% documented master zmanim catalog
- Publishers can import master zmanim with one click
- Publishers can explore other validated publishers' catalogs
- Publishers can link or copy from other publishers with attribution
- Comprehensive documentation available via info modals
- Clean greenfield experience (add functionality removed from algorithm page)
- Zero duplicate zmanim created due to robust prevention
- Improved publisher onboarding and zmanim discovery experience

---

**Next Steps:**

1. Approve Sprint 11 / Epic 11 plan
2. Begin Phase 1 immediately (documentation and audit are blocking)
3. Assign stories to team members by phase
4. Set up sprint tracking and burndown monitoring
5. Schedule weekly phase review checkpoints
6. Plan phase completion demos

---

_Sprint 11 = Epic 11 delivers the complete Publisher Zmanim Registry Explorer as a single unified feature over 9-10 weeks with clear sequential phases, comprehensive dependencies, and robust risk management for successful launch._
