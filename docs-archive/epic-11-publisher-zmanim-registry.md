# Epic 11: Publisher Zmanim Registry Interface

**Author:** BMad
**Date:** 2025-12-22
**Version:** 1.0 (Consolidated)
**Status:** Ready for Development
**Project:** Shtetl Zmanim Platform Enhancement

---

## Executive Summary

**Goal:** Transform publisher onboarding from intimidating to empowering by making the DSL tangible through a comprehensive, read-only discovery interface that serves as both an educational tool and a practical catalog browser.

**User Value:** A new publisher can browse the master registry, see real-world DSL examples with comprehensive documentation, understand halachic sources, and import/link/copy zmanim with one click - accelerating onboarding from 5+ days to 2 days.

**Scope:** One epic delivering the complete Publisher Zmanim Registry Interface with 7 strategic stories consolidating what was previously 7 separate epics, plus PDF reporting.

**FRs Covered:** FR1-FR60 (60 functional requirements)

---

## Epic Overview

| Metric | Value |
|--------|-------|
| **Stories** | 7 (strategically consolidated from original 7 epics + PDF reporting) |
| **FRs** | 60 functional requirements |
| **Complexity** | Medium (Read-only interface + documentation backfill + data integrity audit + PDF generation) |
| **Key Deliverables** | Master Registry Browser, Publisher Examples Browser, Documentation Modals, Import/Link/Copy Actions, Algorithm Page Migration, PDF Report Generator |

---

## Success Criteria

### Adoption Metrics
- **70%+ of new publishers** browse the registry within their first week
- **50%+ of new publishers** import at least 1 master zman
- **30%+ of publishers** explore the publisher examples view
- **Zero duplicate zmanim** created through the interface

### Quality Metrics
- **100% master zman documentation** populated before launch (from KosherJava research)
- **100% Publisher 1 data integrity** - all zmanim correctly linked to master registry
- **Less than 5% duplicate requests** for master zman additions
- **Zero formula mismatches** between publisher zmanim and their linked master entries

### Behavioral Success
- **Reduced support burden:** Measurable decrease in "How do I write a DSL formula?" questions
- **Faster onboarding:** New publishers publish their first zman within 2 days (vs. current 5+ days)
- **Increased confidence:** 70%+ report feeling "confident" or "very confident" in DSL usage

---

## Story Breakdown

### Story 11.0: Data Foundation & Integrity Audit

**As a** platform administrator,
**I want** the master registry documentation fully populated and Publisher 1 data audited for correctness,
**So that** the registry launches with 100% quality data that new publishers can trust.

**Acceptance Criteria:**

**Given** the master zmanim registry has 172+ entries
**When** Story 11.0 is complete
**Then** ALL master zmanim have populated documentation fields:
- `full_description` (REQUIRED)
- `halachic_source` (REQUIRED)
- `formula_explanation` (REQUIRED)
- `usage_context` (RECOMMENDED)
- `related_zmanim_ids` (NICE TO HAVE)
- `shita` (e.g., "GRA", "MGA", "BAAL_HATANYA")
- `category` (e.g., "ALOS", "SHEMA", "TZAIS")

**And** ALL Publisher 1 zmanim have correct `master_zmanim_id` linkages
**And** Zero formula mismatches between Publisher 1 and linked master entries
**And** Database schema is extended with new fields:
- `master_zmanim_registry`: documentation fields, shita, category
- `publisher_zmanim`: `copied_from_publisher_id`, `linked_from_publisher_zman_id`
- Unique constraint: `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`

**Given** the KosherJava research documents are available
**When** documentation backfill migration runs
**Then** mapping from KosherJava methods to master registry zman_key is complete
**And** all documentation is populated via SQL migration script
**And** validation queries confirm 100% coverage

**Given** Publisher 1 (MH Zmanim) data exists
**When** audit process runs
**Then** audit report is generated showing:
- Total zmanim reviewed
- Exact matches count
- Semantic matches count (with details)
- Mismatches count (with recommended corrections)
- Missing linkages count
**And** correction migration script is created and tested
**And** 100% of Publisher 1 zmanim have correct master linkages after migration

**Prerequisites:** None (first story of Epic 11)

**Technical Notes:**
- Create migration: `db/migrations/YYYYMMDDHHMMSS_add_registry_fields.sql`
- Create migration: `db/migrations/YYYYMMDDHHMMSS_backfill_master_zmanim_documentation.sql`
- Create audit script: `scripts/audit-publisher-1-linkages.ts`
- Create migration: `db/migrations/YYYYMMDDHHMMSS_fix_publisher_1_master_linkages.sql`
- Source data: `docs/README-KOSHERJAVA-RESEARCH.md`, `docs/kosherjava-zmanim-complete-extraction.md`
- Audit deliverable: `docs/audit/publisher-1-master-linkages-audit.md`
- Run `sqlc generate` after migrations
- Create indexes for performance:
  ```sql
  CREATE INDEX idx_master_zmanim_shita ON master_zmanim_registry(shita) WHERE shita IS NOT NULL;
  CREATE INDEX idx_master_zmanim_category ON master_zmanim_registry(category) WHERE category IS NOT NULL;
  CREATE UNIQUE INDEX idx_publisher_zmanim_master_unique
    ON publisher_zmanim(publisher_id, master_zmanim_id)
    WHERE deleted_at IS NULL;
  ```

**FRs:** NFR12-NFR16 (Data Integrity), Infrastructure for all FRs

---

### Story 11.1: Master Registry Browser & Import Flow

**As a** publisher,
**I want** to browse the master zmanim registry with filters and search, see live preview times, and import zmanim with one click,
**So that** I can quickly find and add canonical zmanim to my algorithm without writing DSL from scratch.

**Acceptance Criteria:**

**Given** I am logged in as a verified publisher
**When** I navigate to `/publisher/registry`
**Then** I see the Master Registry tab (default) with:
- Paginated table/card view (50 items per page)
- Shared header controls: Location picker, date selector, location badge
- Filter panel (sidebar on desktop, drawer on mobile)
- Search box for zman name or formula keywords
- Zman cards showing: name (Hebrew + English), DSL formula, preview time, category badge, shita badge, status

**Given** I am viewing the master registry
**When** I select a location from the global locality dropdown (e.g., "Jerusalem, Israel")
**Then** all preview times recalculate for that location
**And** the location badge updates: "Selected: Jerusalem, Israel"
**And** location selection persists across tab switches

**Given** I am viewing the master registry
**When** I select a date (default: today)
**Then** all preview times recalculate for that date
**And** date selection persists across tab switches

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

**Given** I have ALREADY imported a specific master zman
**When** I view that master zman card
**Then** the "Import Zman" button is disabled (opacity-50, cursor-not-allowed)
**And** status shows "Imported ✓" badge
**And** hovering over disabled button shows tooltip: "You already imported this master zman"

**Given** no master zmanim match my active filters
**When** results are empty
**Then** I see helpful empty state message: "No master zmanim match your filters. Try adjusting your filters."

**Given** the master registry page loads
**When** initial render completes
**Then** page load time is <2 seconds (p95)
**And** preview calculations complete in <500ms per zman
**And** search/filter operations complete in <300ms

**Prerequisites:** Story 11.0 (Data Foundation)

**Technical Notes:**
- Create `web/app/publisher/registry/page.tsx` - Main registry page with tabs
- Create `web/components/registry/RegistryMasterBrowser.tsx` - Master registry tab
- Create `web/components/registry/ZmanCard.tsx` - Reusable zman card
- Create `web/components/registry/RegistryLocationPicker.tsx` - Shared location picker
- Create `web/components/registry/RegistryFilters.tsx` - Shared filter panel
- Reuse CodeMirror DSL setup from algorithm editor for syntax highlighting
- Create API endpoint: `GET /api/v1/publisher/registry/master`
  - Query params: `locality_id`, `date`, `category`, `shita`, `status`, `search`, `page`, `limit`
  - Returns: Master zmanim with calculated preview times, ownership status (`already_imported` flag)
- Create SQLc query: `ListMasterZmanimForRegistry` with ownership check
- Create API endpoint: `POST /api/v1/publisher/registry/import`
  - Body: `{ master_zmanim_id: number }`
  - Handler: 6-step pattern, PublisherResolver, duplicate check, validation
  - SQLc query: `ImportMasterZman` (inserts `publisher_zmanim` with master fields)
- Implement duplicate prevention logic:
  - SQLc query: `CheckPublisherHasMasterZman` checks existing `master_zmanim_id`
  - Unique constraint at DB level prevents duplicates if client logic fails
- Cache strategy:
  - Master registry list: 24-hour TTL (rarely changes)
  - Preview calculations: 24-hour TTL per location/date/master_zman_id
- Performance: Pagination (50 items), lazy loading for cards, indexes on `category`, `shita`

**FRs:** FR1-FR20 (Master Registry Browsing, Import Flow)

---

### Story 11.2: Master Zman Comprehensive Documentation Modal

**As a** publisher,
**I want** to view full documentation for any master zman including halachic sources, scientific explanations, and related zmanim,
**So that** I can understand the calculation method and halachic basis before importing.

**Acceptance Criteria:**

**Given** I am viewing a master zman card
**When** I click the Info button (ℹ️)
**Then** a full-screen modal opens displaying comprehensive documentation

**Given** the documentation modal is open
**When** I view the modal content
**Then** I see the following sections (in order):
1. **Header:**
   - Zman name (Hebrew + English)
   - zman_key reference (e.g., `[@alos_16_1]`)
   - Close button (✕)
2. **Summary:**
   - Brief one-line description
3. **DSL Formula:**
   - Syntax-highlighted formula (CodeMirror)
   - "Copy to Clipboard" button
4. **Scientific Explanation:**
   - Plain language explanation of what the zman represents
5. **Astronomical Definition:**
   - Technical astronomical details
6. **Algorithm:**
   - Calculation method (e.g., "NOAA Solar Calculator")
7. **Halachic Significance:**
   - How this zman is used in halacha, which opinions use it
8. **Halachic Sources:**
   - Expandable cards for each posek/opinion
   - Each card shows: Posek name, explanation, source text
9. **Practical Notes:**
   - Usage context, when applicable
10. **Related Zmanim:**
    - Clickable chips/links to similar/alternative calculations
    - Clicking a related zman opens ITS documentation modal (replaces current)

**Given** I click "Copy to Clipboard" button in formula section
**When** the button is clicked
**Then** the DSL formula is copied to my clipboard
**And** button text temporarily changes to "Copied ✓" for 2 seconds

**Given** the documentation has related zmanim
**When** I click a related zman link (e.g., "Alos 72 min")
**Then** the current modal is replaced with the related zman's documentation
**And** I can navigate back using browser back button or close modal

**Given** the modal implements cycle detection
**When** related zmanim links form a cycle (A → B → C → A)
**Then** breadcrumb trail shows path: "Alos 16.1° > Alos 72 min > ..."
**And** depth is limited to 5 levels
**And** visiting a zman already in the trail shows warning: "You've already viewed this zman in this session"

**Given** the documentation modal is open
**When** I press Escape key
**Then** the modal closes

**Given** the documentation modal is open
**When** I click outside the modal (on overlay)
**Then** the modal closes

**Given** the documentation modal has missing optional fields
**When** those sections are displayed
**Then** placeholder text is shown: "No additional information available"
**And** section is not completely hidden (maintains layout consistency)

**Prerequisites:** Story 11.1 (Master Registry Browser)

**Technical Notes:**
- Create `web/components/registry/MasterZmanDetailModal.tsx`
- Use shadcn/ui Dialog component for modal foundation
- Reuse CodeMirror for formula syntax highlighting
- Implement breadcrumb state for cycle detection
- Create API endpoint: `GET /api/v1/publisher/registry/master/{id}/documentation` (optional, may inline in list response)
- SQLc query: `GetMasterZmanDocumentation` (if separate endpoint)
- Handle `related_zmanim_ids` array to fetch related zman names
- Modal styling:
  - Desktop: Max width 800px, centered
  - Tablet: Max width 90vw
  - Mobile: Full screen
- Accessibility:
  - Focus trap in modal
  - Semantic HTML (header, section, nav)
  - ARIA labels for all interactive elements
  - Focus returns to Info button after close

**FRs:** FR12-FR15 (Master Zman Documentation)

---

### Story 11.3: Publisher Examples Browser & Link/Copy Flow

**As a** publisher,
**I want** to browse validated publishers' zmanim implementations and link or copy their formulas,
**So that** I can learn from real-world examples and reuse quality formulas from other authorities.

**Acceptance Criteria:**

**Given** I am on the registry page
**When** I switch to the "Publisher Examples" tab
**Then** I see a publisher search workflow:
- Publisher search/autocomplete dropdown (search by name)
- Instruction text: "Search for a publisher to view their catalog"
- Empty state: "Select a publisher to view their zmanim"

**Given** I am on the Publisher Examples tab
**When** I type in the publisher search box (e.g., "MH")
**Then** I see autocomplete results showing validated publishers only:
- Only publishers with `status = 'approved'`
- Excludes deleted, suspended, or inactive publishers
- Results sorted alphabetically

**Given** I have selected a publisher (e.g., "MH Zmanim")
**When** the publisher catalog loads
**Then** I see:
- Publisher name prominently displayed
- Location dropdown (restricted to publisher's coverage localities)
- Date selector (shared with master tab)
- Filter panel (category, shita, status within this publisher's catalog)
- Paginated table/card view of their zmanim

**Given** I have selected a publisher
**When** I select a location from the dropdown
**Then** ONLY localities where the selected publisher has coverage are shown
**And** preview times calculate for selected location/date

**Given** I switch to a different publisher
**When** the new publisher doesn't cover my currently selected location
**Then** location is auto-cleared
**And** I see message: "Please select a location within [Publisher Name]'s coverage"

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

**Given** I have NOT imported the master zman that this publisher zman links to
**When** I click the "Link" button
**Then** a `publisher_zmanim` record is created with:
- `master_zmanim_id` from the source publisher zman
- `linked_from_publisher_zman_id` set to the source publisher_zman.id
- `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl` copied from source
- `copied_from_publisher_id` is NULL (this is a link, not a copy)
**And** I am redirected to `/publisher/algorithm?focus={zman_key}`
**And** toast notification: "Linked to [Publisher Name]'s [Zman Name]"

**Given** I have NOT imported the master zman that this publisher zman links to
**When** I click the "Copy" button
**Then** a `publisher_zmanim` record is created with:
- `master_zmanim_id` from the source publisher zman
- `copied_from_publisher_id` set to the source publisher.id
- `zman_key`, `hebrew_name`, `english_name`, `description`, `formula_dsl` copied from source
- `linked_from_publisher_zman_id` is NULL (this is a copy, not a link)
**And** I am redirected to `/publisher/algorithm?focus={zman_key}`
**And** toast notification: "Copied [Zman Name] from [Publisher Name]"

**Given** I have ALREADY imported the master zman (via any method: master import, link, or copy)
**When** I view a publisher zman card linking to that master
**Then** both Link and Copy buttons are disabled
**And** status shows "Already in Your Catalog" badge
**And** hovering over disabled buttons shows tooltip: "You already have this master zman"

**Given** the Publisher Examples tab loads
**When** no publisher is selected yet
**Then** location dropdown is disabled
**And** helper text shows: "Select a publisher first to choose a location"

**Prerequisites:** Story 11.1 (Master Registry Browser)

**Technical Notes:**
- Create `web/components/registry/RegistryPublisherBrowser.tsx` - Publisher examples tab
- Create API endpoint: `GET /api/v1/publisher/registry/publishers`
  - Returns: List of validated publishers (status='approved', not deleted/suspended/inactive)
  - SQLc query: `ListValidatedPublishers`
- Create API endpoint: `GET /api/v1/publisher/registry/publishers/{publisher_id}`
  - Query params: `locality_id`, `date`, `category`, `shita`, `status`, `search`, `page`, `limit`
  - Returns: Publisher's zmanim with ownership status (`already_have_master` flag)
  - Validates locality is within publisher's coverage (returns 400 if not)
  - SQLc query: `ListPublisherZmanimForRegistry` with ownership check
- Create API endpoint: `GET /api/v1/publisher/registry/coverage/{publisher_id}`
  - Returns: List of localities covered by publisher
  - SQLc query: `GetPublisherCoverageLocalities`
- Create API endpoint: `POST /api/v1/publisher/registry/link`
  - Body: `{ publisher_zmanim_id: number }`
  - Handler: 6-step pattern, PublisherResolver, duplicate check
  - SQLc query: `LinkPublisherZman` (inserts with `linked_from_publisher_zman_id`)
- Create API endpoint: `POST /api/v1/publisher/registry/copy`
  - Body: `{ publisher_zmanim_id: number }`
  - Handler: 6-step pattern, PublisherResolver, duplicate check
  - SQLc query: `CopyPublisherZman` (inserts with `copied_from_publisher_id`)
- Duplicate prevention logic (same as import):
  - Check if current publisher has ANY `publisher_zmanim` with same `master_zmanim_id`
  - Server-side validation + unique constraint at DB level
- Cache strategy:
  - Publisher catalog: 1-hour TTL per publisher
  - Coverage data: 24-hour TTL per publisher
- Performance: Same pagination/caching as master tab

**FRs:** FR21-FR37 (Publisher Examples Browsing, Link/Copy Flow)

---

### Story 11.4: Publisher Zman Documentation Modal

**As a** publisher,
**I want** to view documentation for publisher zmanim showing both their custom implementation AND the inherited master documentation,
**So that** I can understand how a specific publisher adapted the formula while still seeing the canonical halachic basis.

**Acceptance Criteria:**

**Given** I am viewing a publisher zman card
**When** I click the Info button (ℹ️)
**Then** a documentation modal opens with two distinct sections

**Given** the publisher zman modal is open
**When** I view the modal content
**Then** I see the following structure:

**Top Section: Publisher-Specific Fields**
- Header: Publisher name + "Validated Publisher" badge
- Zman name (may be customized by publisher)
- Publisher DSL formula (syntax-highlighted) with copy button
- Master registry reference: "Based on: [Master Zman Name]"
- Custom notes (if publisher added any)
- Attribution:
  - If linked: "Linked from [Source Publisher Name]"
  - If copied: "Copied from [Source Publisher Name]"
  - If direct master import: (no attribution shown)

**Bottom Section: Inherited Master Zman Documentation**
- Divider with text: "Master Zman Documentation"
- Exact same comprehensive content as master zman modal:
  - Summary
  - Formula explanation
  - Scientific explanation
  - Astronomical definition
  - Algorithm
  - Halachic significance
  - Halachic sources (expandable cards)
  - Practical notes
  - Related zmanim (clickable links)

**Given** the publisher zman modal is open
**When** I click a related zman link in the master documentation section
**Then** the modal is replaced with that master zman's full documentation modal (from Story 11.2)
**And** I can navigate back or close modal

**Given** the publisher zman modal is open
**When** I click "Copy to Clipboard" in the publisher formula section
**Then** the publisher's DSL formula is copied (not the master formula)

**Given** the publisher zman has no custom notes
**When** that section would be displayed
**Then** the "Custom Notes" section is hidden (not shown)

**Given** the publisher zman modal is open
**When** I press Escape or click outside
**Then** the modal closes

**Prerequisites:** Story 11.2 (Master Zman Documentation Modal), Story 11.3 (Publisher Examples Browser)

**Technical Notes:**
- Create `web/components/registry/PublisherZmanDetailModal.tsx`
- Reuse master documentation rendering from `MasterZmanDetailModal.tsx`
  - Extract master doc section into shared component: `MasterDocumentationContent.tsx`
  - Both modals import and use this shared component
- Fetch master zman documentation via `master_zmanim_id` from publisher zman
- Modal styling: Same as master modal (desktop/tablet/mobile responsive)
- Accessibility: Same focus trap and keyboard handling as master modal

**FRs:** FR28-FR29 (Publisher Zman Documentation)

---

### Story 11.5: Request Addition Workflow & Algorithm Page Migration

**As a** publisher,
**I want** to request new master zmanim from the registry interface and have a seamless way to navigate between the registry and my algorithm page,
**So that** I can contribute to the platform and efficiently manage my zman catalog.

**Acceptance Criteria:**

**Given** I am on the Master Registry tab OR Publisher Examples tab
**When** I see the page header
**Then** I see a "Request Addition" button (prominent, secondary style)

**Given** I click the "Request Addition" button
**When** the button is clicked
**Then** the existing `RequestZmanModal` component opens (reused from algorithm page)
**And** the modal pre-populates the "source" field with value "registry"
**And** I can fill out the request form (zman name, description, justification, tags, optional formula)

**Given** I submit a request via the registry
**When** the submission completes successfully
**Then** toast notification shows: "Request submitted for admin review"
**And** modal closes
**And** I remain on the registry page (no navigation)

**Given** I navigate to `/publisher/algorithm` (Algorithm page)
**When** the page loads
**Then** I see a prominent "Browse Registry" button in the header
**And** NO "Add Zman" button exists
**And** NO "Add Zman Mode" dialog exists
**And** NO `MasterZmanPicker` or `PublisherZmanPicker` components exist

**Given** I am on the algorithm page
**When** I click the "Browse Registry" button
**Then** I navigate to `/publisher/registry`

**Given** I import/link/copy a zman from the registry
**When** the action completes successfully
**Then** I am redirected to `/publisher/algorithm?focus={zman_key}`

**Given** I land on `/publisher/algorithm?focus={zman_key}` after import/link/copy
**When** the page loads
**Then** the page scrolls to the newly added zman
**And** the zman card is highlighted with:
  - Green border (border-green-500)
  - Subtle animation (fade-in or scale)
  - Highlight remains for 3 seconds, then fades out

**Given** the algorithm page URL includes `?focus={zman_key}`
**When** no matching zman exists in my catalog
**Then** no scroll or highlight occurs (graceful fallback)

**Prerequisites:** Story 11.1 (for redirect target), Story 11.3 (for link/copy redirects)

**Technical Notes:**
- Move `RequestZmanModal` component to shared location: `web/components/shared/RequestZmanModal.tsx`
- Import `RequestZmanModal` in both:
  - `web/app/publisher/registry/page.tsx`
  - `web/app/publisher/algorithm/page.tsx` (if still needed)
- Add "source" field to request submission: `source: "registry"` or `source: "algorithm"`
- Algorithm page cleanup:
  - Delete lines 1144-1238 (Add Zman Mode dialog)
  - Delete `MasterZmanPicker` component import and usage
  - Delete `PublisherZmanPicker` component import and usage
  - Delete all "Add Zman Mode" state variables and handlers
  - Add "Browse Registry" button in header → `router.push('/publisher/registry')`
- Algorithm page URL param handling:
  - Parse `?focus={zman_key}` from URL
  - Use `useEffect` to scroll to zman card with matching `data-zman-key={zman_key}`
  - Apply highlight styling (add/remove CSS class with timeout)
  - Example:
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
- Add CSS class:
  ```css
  .highlight-zman {
    @apply border-green-500 border-2 animate-in fade-in duration-500;
  }
  ```
- Reuse existing Request Addition API endpoint (no new backend work)
- Algorithm page has ZERO zman addition functionality (edit existing zmanim only)

**FRs:** FR38-FR41 (Request Addition), FR42-FR51 (Visual Design, Navigation, Algorithm Page Migration)

---

### Story 11.6: Publisher Zmanim Report (PDF Export)

**As a** publisher,
**I want** to generate a comprehensive, beautifully designed PDF report of my zmanim calculations for a specific location and date,
**So that** I can share transparent, trustworthy documentation with end-users who want to understand exactly how each time was calculated.

**Acceptance Criteria:**

**Given** I am on `/publisher/algorithm`
**When** I view the page header
**Then** I see a "Print Zmanim Report" button (prominent, with printer icon 🖨️)

**Given** I click the "Print Zmanim Report" button
**When** the button is clicked
**Then** a modal opens with report configuration options:
- Location selector (autocomplete dropdown)
- Date picker (default: today)
- "Include Glossary" toggle (default: ON)
- Preview note: "This will generate a PDF with all your published zmanim for the selected location and date"
- "Generate PDF" button
- "Cancel" button

**Given** I have selected a location and date
**When** I click "Generate PDF"
**Then** a loading indicator shows: "Generating your report..."
**And** API call is made: `POST /api/v1/publisher/reports/zmanim-pdf`
**And** backend generates PDF and returns download URL or binary stream
**And** PDF automatically downloads to my browser
**And** toast notification shows: "Zmanim report generated successfully"
**And** modal closes

**Given** the PDF is being generated
**When** the backend processes the request
**Then** the PDF contains the following sections in order:

---

**PDF Section 1: Publisher Header**
- Publisher logo (fetched from `publishers.logo_url`, fallback to default icon)
- Publisher name (large, bold)
- Publisher tagline/description (if available)
- Report generation timestamp: "Generated on Dec 22, 2025 at 3:45 PM UTC"
- Modern, colorful header background (gradient: indigo-to-purple or custom brand colors)

---

**PDF Section 2: Location Details**
- **Section title:** "Location Information"
- **Location name:** Full name (e.g., "Jerusalem, Israel")
- **Coordinates:** Latitude/Longitude (e.g., "31.7683°N, 35.2137°E")
- **Elevation:** Meters above sea level (e.g., "754m")
- **Timezone:** Full timezone name (e.g., "Asia/Jerusalem (UTC+2)")
- **Map:** Embedded static map image showing location pin
  - Use static map API (e.g., Mapbox Static Images API or Google Maps Static API)
  - Map dimensions: 400x200px
  - Zoom level: 10 (city-level view)
  - Marker: Red pin at exact coordinates
- **Visual design:** Card layout with soft shadow, icon for each field (📍 location, 🗺️ coordinates, ⛰️ elevation, 🕐 timezone)

---

**PDF Section 3: Report Metadata**
- **Section title:** "Report Date & Time"
- **Selected date:** Full date format (e.g., "Friday, December 22, 2025")
- **Hebrew date:** (if available, e.g., "21 Kislev 5786")
- **Sunrise/Sunset times:** Preview times for context (e.g., "Sunrise: 6:34 AM | Sunset: 4:49 PM")
- **Visual design:** Horizontal timeline graphic showing daylight hours

---

**PDF Section 4: Zmanim List**
- **Section title:** "Zmanim Calculations"
- **Instruction text:** "All times calculated using our DSL (Domain-Specific Language) formulas. See glossary below for detailed explanations."
- **Table format** (alternating row colors for readability):

| Zman Name | Calculated Time | DSL Formula | Explanation | Rounded Time |
|-----------|----------------|-------------|-------------|--------------|
| Alos Hashachar (16.1°) | 5:24:37 AM | `solar(-16.1)` | Dawn when the sun is 16.1° below the horizon | 5:25 AM |
| ... | ... | ... | ... | ... |

**For each zman row:**
- **Zman Name:** Hebrew name + English name (e.g., "עלות השחר - Alos Hashachar (16.1°)")
- **Calculated Time:** Precise time (HH:MM:SS format, 12-hour with AM/PM)
- **DSL Formula:** Syntax-highlighted formula (color-coded: primitives in blue, functions in green, operators in gray)
- **Explanation:** Plain-language description from `master_zmanim_registry.formula_explanation`
- **Rounded Time:** User-friendly rounded time (HH:MM format, 12-hour with AM/PM)

**Visual design:**
- Monospace font for DSL formulas
- Color-coding for syntax (primitives: #3B82F6, functions: #10B981, numbers: #F59E0B)
- Alternating row background colors (white / light gray)
- Icons next to zman categories (🌅 Alos, 📖 Shema, 🕍 Tefilla, ☀️ Chatzos, 🌇 Mincha, 🌙 Tzais)

---

**PDF Section 5: Glossary - Primitives** (if "Include Glossary" is enabled)
- **Section title:** "Glossary: Primitives"
- **Instruction text:** "Primitives are foundational astronomical events used in zmanim calculations."
- **Format:** Expandable cards (2-column layout on desktop-sized PDF)

**For each primitive used in the report:**
- **Card header:** Primitive name (e.g., "`sunrise`", "`solar(-16.1)`")
- **Definition:** Brief explanation (e.g., "The moment when the upper edge of the sun's disc crosses the horizon")
- **Calculation method:** Technical details (e.g., "Calculated using NOAA Solar Position Algorithm based on location coordinates, date, and atmospheric refraction")
- **Scientific source:** Reference (e.g., "NOAA Solar Calculator, Jean Meeus 'Astronomical Algorithms'")
- **Visual:** Small icon representing the primitive (🌅 sunrise, 🌄 sunset, ☀️ solar angles)

**Primitives to include (only if used in the zmanim):**
- `sunrise`, `sunset`
- `visible_sunrise`, `visible_sunset`
- `solar(angle)` (with angle parameter explained)
- `noon`
- `alos_hashachar`, `tzais_hakochavim` (if referenced as primitives)

**Visual design:**
- Card layout with soft borders
- Color-coded by type (solar events: orange, angular calculations: blue)
- Technical details in smaller font
- Source references in italics

---

**PDF Section 6: Glossary - Functions** (if "Include Glossary" is enabled)
- **Section title:** "Glossary: Functions"
- **Instruction text:** "Functions perform operations on primitives and other values to calculate zmanim."
- **Format:** Expandable cards (2-column layout)

**For each function used in the report:**
- **Card header:** Function name (e.g., "`coalesce()`", "`min()`", "`max()`")
- **Purpose:** What the function does (e.g., "Returns the first non-null value from a list of inputs")
- **Syntax:** Function signature (e.g., "`coalesce(value1, value2, ...)`")
- **Parameters:** Detailed explanation of EACH parameter:
  - Parameter name
  - Parameter type (time, number, etc.)
  - Parameter description
  - Example value
- **Example usage:** Real example from the report (e.g., "`coalesce(solar(-16.1), sunrise - 72min)`")
- **Result explanation:** What the example returns

**Functions to include (only if used in the zmanim):**
- Time arithmetic: `+`, `-`
- Aggregation: `min()`, `max()`, `avg()`
- Conditional: `coalesce()`
- Fixed offset: `shaos_zmanios_gra()`, `shaos_zmanios_mga()`
- Seasonal hours: calculations based on sunrise/sunset

**Visual design:**
- Card layout matching primitives section
- Color-coded by category (arithmetic: green, aggregation: purple, conditional: blue)
- Code examples in monospace font with syntax highlighting
- Parameter tables with clear labels

---

**PDF Footer (on every page):**
- Page number (e.g., "Page 2 of 5")
- Shtetl Zmanim branding (small logo)
- Disclaimer: "Calculations are provided for educational purposes. Consult your local halachic authority for practical application."
- Generated timestamp (e.g., "Generated: Dec 22, 2025 3:45 PM UTC")

---

**PDF Design Requirements:**

**Visual Style:**
- **Modern & Vibrant:** Gradient headers, colorful badges, clean typography
- **Color palette:**
  - Primary: Indigo (#4F46E5)
  - Accent: Purple (#7C3AED)
  - Success: Green (#10B981)
  - Warning: Orange (#F59E0B)
  - Neutral: Gray scale (#F3F4F6 to #111827)
- **Typography:**
  - Headers: Bold, sans-serif (e.g., Inter, Helvetica)
  - Body: Regular, sans-serif
  - Code/DSL: Monospace (e.g., JetBrains Mono, Courier)
  - Hebrew: Hebrew-compatible font (e.g., Frank Ruehl CLM, Taamey Frank)
- **Layout:**
  - A4 page size (210mm x 297mm)
  - Margins: 20mm on all sides
  - Sections clearly separated with dividers or background colors
  - White space for readability
- **Accessibility:**
  - High contrast text (4.5:1 ratio minimum)
  - Clear hierarchy (H1, H2, H3 tags)
  - Readable font sizes (body: 11pt, headers: 14-18pt, fine print: 9pt)

**Performance:**
- PDF generation completes in <10 seconds (p95)
- File size <5MB (optimized images, compressed fonts)
- Concurrent generation support (up to 50 simultaneous requests)

**Given** "Include Glossary" toggle is OFF
**When** PDF is generated
**Then** Sections 1-4 are included (Publisher Header, Location, Metadata, Zmanim List)
**And** Sections 5-6 (Glossary) are omitted
**And** File size is smaller (~2MB vs. ~5MB)

**Given** the report includes zmanim with errors (e.g., formula validation failed)
**When** PDF is generated
**Then** those zmanim rows show:
- Calculated Time: "Error"
- Explanation: Error message (e.g., "Formula syntax error: unexpected token")
- Row highlighted in red background
**And** PDF still generates successfully (no hard failure)

**Given** the selected location has no coverage for this publisher
**When** I attempt to generate PDF
**Then** API returns 400 error: "Publisher does not cover this location"
**And** modal shows error message: "You don't have coverage for this location. Please select a location within your coverage area."

**Given** I have generated a PDF
**When** I open the downloaded file
**Then** filename is descriptive: `{publisher_name}_zmanim_{location_name}_{date}.pdf`
- Example: `MH_Zmanim_Jerusalem_Israel_2025-12-22.pdf`
- Spaces replaced with underscores
- Special characters removed

**Prerequisites:** Story 11.5 (Algorithm Page exists with button placement)

**Technical Notes:**

**Backend Implementation:**
- Create API endpoint: `POST /api/v1/publisher/reports/zmanim-pdf`
  - Request body: `{ locality_id: number, date: string (YYYY-MM-DD), include_glossary: boolean }`
  - Handler: 6-step pattern, PublisherResolver, validate coverage
  - Response: PDF binary stream OR download URL (if stored in S3)
- Create Go service: `internal/services/pdf_generator.go`
  - Use PDF library: `github.com/jung-kurt/gofpdf` OR `github.com/johnfercher/maroto` (modern, table-friendly)
  - Alternative: Use headless Chrome via `chromedp` for HTML-to-PDF conversion
- Create Go handler: `internal/handlers/publisher_reports.go`
  - `GenerateZmanimReport(w, r)` handler
  - SQLc queries:
    - `GetPublisherForReport` (logo, name, description)
    - `GetLocalityDetails` (name, lat, long, elevation, timezone)
    - `ListPublisherZmanimForReport` (all published zmanim for location/date)
    - `GetMasterZmanExplanations` (formula explanations from master registry)
  - Calculate all zman times for location/date (reuse existing calculation engine)
  - Extract unique primitives and functions used across all formulas
  - Generate static map URL (Mapbox Static API):
    - Example: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l-marker+FF0000({lng},{lat})/{lng},{lat},10/400x200?access_token={token}`
  - Build PDF using chosen library
  - Return PDF as `Content-Type: application/pdf` with `Content-Disposition: attachment; filename=...`

**Frontend Implementation:**
- Modify `web/app/publisher/algorithm/page.tsx`
  - Add "Print Zmanim Report" button in header (next to "Browse Registry" button)
  - Button icon: `<PrinterIcon />` from Heroicons
- Create `web/components/reports/ZmanimReportModal.tsx`
  - Location autocomplete (reuse from registry)
  - Date picker (shadcn/ui Calendar component)
  - "Include Glossary" toggle (Switch component)
  - Generate button triggers API call
- Use `fetch()` with blob response:
  ```tsx
  const response = await api.post('/publisher/reports/zmanim-pdf', body);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  ```

**Static Map Integration:**
- Sign up for Mapbox API key (free tier: 50,000 requests/month)
- Store API key in AWS SSM: `/zmanim/prod/mapbox-api-key`
- Cache static map URLs (24-hour TTL per location)
- Fallback: If map API fails, omit map section (don't fail entire PDF)

**Primitive & Function Documentation:**
- Create reference data file: `api/internal/dsl/primitives_reference.go`
  ```go
  type PrimitiveDoc struct {
    Name string
    Definition string
    CalculationMethod string
    ScientificSource string
  }
  var PrimitivesReference = map[string]PrimitiveDoc{
    "sunrise": { ... },
    "sunset": { ... },
    "solar": { ... },
  }
  ```
- Create reference data file: `api/internal/dsl/functions_reference.go`
  ```go
  type FunctionDoc struct {
    Name string
    Purpose string
    Syntax string
    Parameters []ParameterDoc
    Example string
    ResultExplanation string
  }
  type ParameterDoc struct {
    Name string
    Type string
    Description string
    ExampleValue string
  }
  var FunctionsReference = map[string]FunctionDoc{
    "coalesce": { ... },
    "min": { ... },
  }
  ```
- Parse DSL formulas to extract used primitives/functions:
  - Reuse existing DSL tokenizer/parser from `api/internal/dsl/`
  - Extract unique primitive/function names
  - Look up documentation from reference maps

**PDF Library Recommendation:**
- **Recommended:** `github.com/johnfercher/maroto` (modern, supports tables, images, colors, gradients)
- **Alternative:** HTML-to-PDF using `chromedp` (more flexible styling but slower)
- **Avoid:** `gofpdf` (older, limited styling capabilities)

**Error Handling:**
- Timeout: 30-second max for PDF generation
- If calculation engine fails for a zman, show "Error" in that row (don't fail entire PDF)
- If static map API fails, omit map (show text-only location details)
- If logo URL is broken, use fallback icon

**Caching Strategy:**
- Cache generated PDFs for 1 hour per unique `(publisher_id, locality_id, date, include_glossary)` tuple
- Cache key: `pdf:zmanim:{publisher_id}:{locality_id}:{date}:{glossary}`
- Store in Redis or S3 (if using download URLs)
- Invalidate cache when publisher updates their zmanim

**Testing:**
- Unit tests: PDF generation service (mock data)
- Integration tests: Full API endpoint test (verify PDF binary structure)
- E2E tests: Click button, verify download triggers, verify filename
- Manual QA: Open PDF in Adobe Reader, Preview.app, Chrome PDF viewer (verify rendering)

**FRs:** FR52-FR60 (new functional requirements for PDF report feature)

---

### Story 11.7: E2E Testing & Performance Validation

**As a** developer,
**I want** comprehensive E2E tests and performance validation for the registry interface,
**So that** we ensure quality, prevent regressions, and meet performance targets before launch.

**Acceptance Criteria:**

**E2E Test Coverage:**

**Test Suite 1: Master Registry Flow**
1. Navigate to `/publisher/registry`
2. Verify Master Registry tab is active (default)
3. Select location "Jerusalem, Israel"
4. Verify location badge updates
5. Select date (today + 7 days)
6. Search for "Alos"
7. Verify search results filtered
8. Filter by category "ALOS"
9. Filter by shita "GRA"
10. Verify active filter chips appear
11. Click Info (ℹ️) on first result
12. Verify master documentation modal opens with all sections
13. Verify "Copy to Clipboard" button works
14. Click related zman link
15. Verify modal switches to related zman documentation
16. Close modal
17. Click "Import Zman" button on first result
18. Verify redirect to `/publisher/algorithm?focus={zman_key}`
19. Verify zman is highlighted
20. Return to registry
21. Verify same zman shows "Imported ✓" badge
22. Verify Import button is disabled with tooltip

**Test Suite 2: Publisher Examples Flow**
1. Navigate to `/publisher/registry`
2. Switch to "Publisher Examples" tab
3. Search for publisher "MH Zmanim"
4. Select publisher from dropdown
5. Verify publisher name displayed
6. Select location "Jerusalem, Israel" (within coverage)
7. Verify preview times calculate
8. Search for "Alos"
9. Filter by category "ALOS"
10. Click Info (ℹ️) on first result
11. Verify publisher zman modal opens with two sections
12. Verify top section shows publisher fields
13. Verify bottom section shows master documentation
14. Close modal
15. Click "Link" button
16. Verify redirect to `/publisher/algorithm?focus={zman_key}`
17. Verify zman is highlighted
18. Return to registry, switch to Publisher Examples
19. Re-select same publisher and location
20. Verify same zman shows "Already in Your Catalog" status
21. Verify Link and Copy buttons are disabled with tooltip

**Test Suite 3: Request Addition Flow**
1. Navigate to `/publisher/registry`
2. Click "Request Addition" button
3. Verify `RequestZmanModal` opens
4. Fill out request form (name, description, justification)
5. Submit
6. Verify toast notification: "Request submitted for admin review"
7. Verify modal closes
8. Verify remain on registry page (no navigation)

**Test Suite 4: Algorithm Page Migration**
1. Navigate to `/publisher/algorithm`
2. Verify "Browse Registry" button exists in header
3. Verify NO "Add Zman" button exists
4. Verify NO "Add Zman Mode" dialog code exists (code inspection)
5. Verify NO `MasterZmanPicker` component usage exists (code inspection)
6. Click "Browse Registry" button
7. Verify navigation to `/publisher/registry`

**Test Suite 5: PDF Report Generation**
1. Navigate to `/publisher/algorithm`
2. Verify "Print Zmanim Report" button exists in header
3. Click "Print Zmanim Report" button
4. Verify modal opens with configuration options
5. Select location "Jerusalem, Israel"
6. Select date (today + 7 days)
7. Verify "Include Glossary" toggle is ON by default
8. Click "Generate PDF" button
9. Verify loading indicator shows: "Generating your report..."
10. Wait for PDF download to trigger
11. Verify toast notification: "Zmanim report generated successfully"
12. Verify modal closes
13. Verify downloaded file exists with correct filename pattern
14. Open PDF and verify:
    - Publisher header section present
    - Location details section present (with coordinates, elevation, timezone)
    - Map image embedded
    - Zmanim table present with all columns
    - DSL formulas syntax-highlighted
    - Primitives glossary section present
    - Functions glossary section present
    - Footer on each page with page numbers
15. Toggle "Include Glossary" OFF
16. Generate PDF again
17. Verify PDF file size is smaller
18. Open PDF and verify glossary sections are omitted

**Test Suite 6: Duplicate Prevention**
1. Import a master zman via Master Registry tab
2. Return to Master Registry tab
3. Verify same zman shows "Imported ✓" and Import button disabled
4. Switch to Publisher Examples tab
5. Select a publisher who has the same master zman
6. Verify that publisher zman shows "Already in Your Catalog"
7. Verify Link and Copy buttons are disabled
8. Attempt to import same master zman via direct API call (bypassing UI)
9. Verify 400 error response: "You already have this master zman"
10. Verify unique constraint at DB level prevents duplicate (SQL test)

**Performance Tests:**

**Performance Test 1: Page Load**
- Navigate to `/publisher/registry` (cold load)
- Measure: Time to first contentful paint (FCP)
- Target: <2 seconds (p95)
- Verify: Initial 50 master zmanim load and render

**Performance Test 2: Location Preview Calculation**
- Select location "Jerusalem, Israel"
- Measure: Time for all preview times to calculate and render
- Target: <500ms per zman (concurrent calculation)
- Verify: Preview times update without blocking UI

**Performance Test 3: Search/Filter Operations**
- Apply category filter "ALOS"
- Measure: Time for results to update
- Target: <300ms
- Apply shita filter "GRA"
- Measure: Time for results to update
- Target: <300ms
- Search for "Alos Hashachar"
- Measure: Time for results to update
- Target: <300ms

**Performance Test 4: Pagination**
- Load page 2 (items 51-100)
- Measure: Time to fetch and render next page
- Target: <1 second
- Verify: Smooth scroll to top

**Performance Test 5: Modal Open/Close**
- Click Info button to open master documentation modal
- Measure: Time for modal to render
- Target: <200ms
- Close modal
- Measure: Time for modal to dismiss
- Target: <100ms

**Concurrency Tests:**
- Simulate 100 concurrent users browsing registry
- Measure: Response times remain within targets (p95 <2s)
- Simulate 50 concurrent import/link/copy operations
- Measure: Success rate >95%, no duplicate creation
- Verify: Cache effectiveness (hit rate >80%)

**Data Validation Tests:**

**Documentation Backfill Validation:**
```sql
-- All master zmanim have required documentation
SELECT COUNT(*) FROM master_zmanim_registry
WHERE full_description IS NULL
   OR halachic_source IS NULL
   OR formula_explanation IS NULL;
-- Expected: 0

-- All related_zmanim_ids point to existing master zmanim
SELECT mzr.id, mzr.zman_key, unnest(mzr.related_zmanim_ids) AS related_id
FROM master_zmanim_registry mzr
WHERE NOT EXISTS (
  SELECT 1 FROM master_zmanim_registry mzr2
  WHERE mzr2.id = unnest(mzr.related_zmanim_ids)
);
-- Expected: 0 rows
```

**Publisher 1 Audit Validation:**
```sql
-- All Publisher 1 zmanim have master linkage
SELECT COUNT(*) FROM publisher_zmanim
WHERE publisher_id = 1
  AND master_zmanim_id IS NULL
  AND deleted_at IS NULL;
-- Expected: 0

-- No duplicate master_zmanim_id within Publisher 1
SELECT master_zmanim_id, COUNT(*)
FROM publisher_zmanim
WHERE publisher_id = 1 AND deleted_at IS NULL
GROUP BY master_zmanim_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

**Accessibility Tests:**

**Keyboard Navigation:**
- Tab through all interactive elements (filters, search, cards, buttons)
- Enter/Space to activate buttons
- Escape to close modals/drawers
- Arrow keys for dropdown navigation

**Screen Reader Support:**
- ARIA labels for all buttons ("Import Alos Hashachar", "Open filters", etc.)
- ARIA live regions for loading states
- ARIA expanded states for collapsible filter panel
- Semantic HTML (header, nav, main, section)

**Focus Management:**
- Visible focus indicators (ring-2 ring-primary)
- Focus trapped in modals
- Focus returns to trigger button after modal closes
- Skip to content link

**Color Contrast:**
- All text meets 4.5:1 contrast ratio (WCAG AA)
- All UI elements meet 3:1 contrast ratio
- Test with color blindness simulators

**Prerequisites:** Stories 11.0-11.5 (all features complete)

**Technical Notes:**
- E2E tests in Playwright: `tests/e2e/publisher/registry.spec.ts`
- Performance tests using Playwright's performance API
- Data validation tests as SQL scripts: `tests/sql/registry-validation.sql`
- Accessibility tests using axe-core integration in Playwright
- All tests must pass before Epic 11 considered complete
- Configure parallel test execution: `test.describe.configure({ mode: 'parallel' })`
- Use deterministic waits (no `waitForTimeout`):
  - `page.waitForResponse()` for API calls
  - `expect().toBeVisible()` for UI updates
  - `page.waitForLoadState('networkidle')` for navigation
- Test data cleanup after each test suite
- Performance baseline recorded for future comparison

**FRs:** All NFRs (Performance, Security, Data Integrity, Usability, Reliability, Maintainability)

---

## FR Coverage Matrix

| FR | Description | Story |
|----|-------------|-------|
| FR1 | Browse master zmanim (paginated) | 11.1 |
| FR2 | Search master zmanim (name/formula) | 11.1 |
| FR3 | Filter master zmanim (category/shita/tags/status) | 11.1 |
| FR4 | Select location for preview times | 11.1 |
| FR5 | Select date for preview | 11.1 |
| FR6 | Location/date persist across tabs | 11.1 |
| FR7 | DSL syntax highlighting | 11.1 |
| FR8 | Preview times (12-hour format) | 11.1 |
| FR9 | Status indicators (Available/Imported) | 11.1 |
| FR10 | Category badges | 11.1 |
| FR11 | Shita badges | 11.1 |
| FR12 | Info button opens documentation modal | 11.2 |
| FR13 | Documentation modal displays all sections | 11.2 |
| FR14 | Copy-to-clipboard for formula | 11.2 |
| FR15 | Clickable related zmanim links | 11.2 |
| FR16 | Import button creates publisher_zmanim | 11.1 |
| FR17 | Import button disabled if already imported | 11.1 |
| FR18 | Disabled button shows tooltip | 11.1 |
| FR19 | Already-imported shows badge | 11.1 |
| FR20 | Success redirect with focus param | 11.1, 11.5 |
| FR21 | Search for validated publishers | 11.3 |
| FR22 | Only validated publishers shown | 11.3 |
| FR23 | Select publisher to view catalog | 11.3 |
| FR24 | Location restricted to coverage | 11.3 |
| FR25 | Auto-clear location if not covered | 11.3 |
| FR26 | Publisher zman display fields | 11.3 |
| FR27 | Filter within publisher catalog | 11.3 |
| FR28 | Info button opens publisher zman modal | 11.4 |
| FR29 | Publisher modal shows two sections | 11.4 |
| FR30 | Link button creates linked publisher_zmanim | 11.3 |
| FR31 | Link records linked_from_publisher_zman_id | 11.3 |
| FR32 | Copy button creates independent copy | 11.3 |
| FR33 | Copy records copied_from_publisher_id | 11.3 |
| FR34 | Link/Copy disabled if already have master | 11.3 |
| FR35 | Disabled buttons show tooltips | 11.3 |
| FR36 | Already-owned shows badges | 11.3 |
| FR37 | Success redirect with focus param | 11.3, 11.5 |
| FR38 | Request Addition button available | 11.5 |
| FR39 | Opens RequestZmanModal component | 11.5 |
| FR40 | Pre-populates source field | 11.5 |
| FR41 | Available on both tabs | 11.5 |
| FR42 | Tab navigation (Master/Publisher) | 11.1, 11.3 |
| FR43 | Shared header controls | 11.1 |
| FR44 | Collapsible filter panel | 11.1 |
| FR45 | Active filter chips | 11.1 |
| FR46 | Helpful empty states | 11.1, 11.3 |
| FR47 | Responsive table/cards | 11.1, 11.3 |
| FR48 | Algorithm page "Browse Registry" button | 11.5 |
| FR49 | Algorithm page NO "Add Zman" button | 11.5 |
| FR50 | Algorithm page URL param ?focus= | 11.5 |
| FR51 | Algorithm page ZERO addition functionality | 11.5 |
| FR52 | Print Zmanim Report button on algorithm page | 11.6 |
| FR53 | PDF report configuration modal | 11.6 |
| FR54 | PDF includes publisher header with logo | 11.6 |
| FR55 | PDF includes location details with map | 11.6 |
| FR56 | PDF includes zmanim table with calculations | 11.6 |
| FR57 | PDF includes primitives glossary (optional) | 11.6 |
| FR58 | PDF includes functions glossary (optional) | 11.6 |
| FR59 | PDF modern, vibrant design with colors | 11.6 |
| FR60 | PDF generation <10s, file size <5MB | 11.6 |

---

## Dependency Chain

```
11.0 Data Foundation & Integrity Audit
 ├── Documentation backfill (KosherJava → master registry)
 ├── Publisher 1 audit & corrections
 └── Database schema extensions
      │
      ├─→ 11.1 Master Registry Browser & Import Flow
      │    ├── Master registry listing with filters
      │    ├── Import action (master → publisher zmanim)
      │    └── Duplicate prevention
      │         │
      │         ├─→ 11.2 Master Zman Documentation Modal
      │         │    ├── Full documentation display
      │         │    ├── Related zmanim navigation
      │         │    └── Copy-to-clipboard
      │         │
      │         ├─→ 11.3 Publisher Examples Browser & Link/Copy Flow
      │         │    ├── Publisher search & selection
      │         │    ├── Coverage-restricted location picker
      │         │    ├── Link action (publisher zman → publisher zmanim)
      │         │    ├── Copy action (publisher zman → publisher zmanim)
      │         │    └── Duplicate prevention
      │         │         │
      │         │         └─→ 11.4 Publisher Zman Documentation Modal
      │         │              ├── Publisher-specific section
      │         │              └── Inherited master documentation
      │         │
      │         └─→ 11.5 Request Addition & Algorithm Page Migration
      │              ├── Request Addition workflow (both tabs)
      │              ├── Algorithm page cleanup
      │              ├── Browse Registry button
      │              └── URL param focus handling
      │                   │
      │                   └─→ 11.6 Publisher Zmanim Report (PDF Export)
      │                        ├── Print button on algorithm page
      │                        ├── Report configuration modal
      │                        ├── PDF generation backend
      │                        ├── Publisher header section
      │                        ├── Location details with map
      │                        ├── Zmanim calculations table
      │                        ├── Primitives glossary (optional)
      │                        └── Functions glossary (optional)
      │
      └─→ 11.7 E2E Testing & Performance Validation
           ├── Master Registry flow tests
           ├── Publisher Examples flow tests
           ├── Request Addition tests
           ├── Algorithm page migration tests
           ├── PDF report generation tests
           ├── Duplicate prevention tests
           ├── Performance tests
           ├── Data validation tests
           └── Accessibility tests
```

---

## Epic 11 Summary

**Epic 11: Publisher Zmanim Registry Interface**
- **Stories:** 7 (consolidated from original 7 epics + PDF reporting)
- **FRs Covered:** FR1-FR60 (60 functional requirements) + All NFRs
- **Sequence:** Data Foundation → Master Browser → Master Docs → Publisher Browser → Publisher Docs → Navigation → PDF Reports → Testing
- **Story Points (Estimated):** 63 total
  - 11.0: 13 points (Data migration + audit)
  - 11.1: 13 points (Master browser with filters, search, import)
  - 11.2: 5 points (Documentation modal)
  - 11.3: 13 points (Publisher browser with link/copy)
  - 11.4: 3 points (Publisher modal - reuses master components)
  - 11.5: 5 points (Request workflow + algorithm page cleanup)
  - 11.6: 8 points (PDF generation with glossaries, maps, styling)
  - 11.7: 3 points (E2E tests + performance validation)

**After Epic 11 Completion:**
- **100% master zman documentation** populated from KosherJava research
- **100% Publisher 1 data integrity** verified and corrected
- Publishers can **browse** 172+ master zmanim with comprehensive halachic documentation
- Publishers can **import** master zmanim with one click (duplicate-safe)
- Publishers can **explore** validated publishers' real-world implementations
- Publishers can **link** or **copy** from other publishers (with attribution tracking)
- Publishers can **request** new master zmanim from registry interface
- Publishers can **generate beautiful PDF reports** with full transparency (glossaries explain every calculation)
- Algorithm page is **streamlined** (Browse Registry button, NO Add Zman dialog)
- New publishers onboard **faster** (2 days vs. 5+ days to first published zman)
- Support burden **reduced** ("How do I write DSL?" questions drop 50%)
- Trust **increased** (PDF reports build confidence with end-users)
- Platform **quality** maintained (zero duplicate zmanim, validated formulas only)

---

## Pre-Launch Checklist

**Data Preparation:**
- [ ] Master registry documentation backfill migration created and tested
- [ ] Publisher 1 audit complete (audit report approved)
- [ ] Publisher 1 correction migration created and tested
- [ ] All validation queries pass (100% documentation, 100% correct linkages)

**Code Complete:**
- [ ] All 6 stories implemented and tested
- [ ] All frontend components built (RegistryMasterBrowser, RegistryPublisherBrowser, modals, etc.)
- [ ] All backend API endpoints implemented (8 new endpoints)
- [ ] Algorithm page migration complete (Add Zman removed, Browse Registry button added)
- [ ] Integration tests passing
- [ ] E2E tests passing (all 5 test suites)
- [ ] Performance tests passing (all targets met)

**Database:**
- [ ] Schema changes deployed to staging
- [ ] Unique constraint tested (duplicate prevention works)
- [ ] Indexes created and tested (category, shita, master_zmanim_id)
- [ ] Soft delete filtering verified in all queries

**Documentation:**
- [ ] API documentation updated (new endpoints documented)
- [ ] Publisher onboarding guide updated
- [ ] Help center article: "How to use the Zmanim Registry"
- [ ] Internal runbook: "Registry troubleshooting"

**Deployment:**
- [ ] Staging deployment successful (full smoke test passed)
- [ ] Production deployment scheduled
- [ ] Rollback plan ready
- [ ] Monitoring dashboards configured
- [ ] Success metrics tracking configured

---

## Deployment Sequence

**Stage 1: Staging Deployment**
1. Deploy database migrations (schema + documentation backfill + Publisher 1 corrections)
2. Run data validation queries (confirm 100% coverage)
3. Deploy backend API (8 new endpoints)
4. Deploy frontend (registry page + algorithm page changes)
5. Run full E2E test suite on staging
6. Manual QA testing (all workflows)

**Stage 2: Production Deployment**
1. Create database backup
2. Deploy migrations (low-traffic window: Sunday 2am UTC)
3. Verify data integrity (validation queries)
4. Deploy backend API
5. Deploy frontend
6. Smoke test production (import one zman)
7. Monitor error logs for 1 hour
8. Send announcement to publishers: "New Registry Explorer available!"

**Stage 3: Gradual Rollout**
- Week 1: Monitor adoption metrics, gather feedback
- Week 2: Send reminder email to publishers
- Week 3: Publish success stories
- Month 1: Review metrics, plan iteration

---

## Success Metrics (Post-Launch)

### Week 1 Targets
- 70% of new publishers browse registry
- 50% of new publishers import at least 1 master zman
- 30% of publishers explore publisher examples

### Month 1 Targets
- 80% of active publishers have used registry
- Average 15 imports per publisher
- 50% of publishers have linked or copied from examples
- Time-to-first-zman-published: 2 days (vs. current 5+ days)
- Support questions reduced by 50%

### Quality Metrics
- Zero duplicate zmanim created (duplicate prevention works)
- <5% of Request Additions are duplicates (good search UX)
- Import/Link/Copy success rate >95%
- Page load <2s (p95), preview calculations <500ms

---

_Generated by BMad Epic Consolidation Workflow v1.0_
_Date: 2025-12-22_
_Updated: 2025-12-22 (Added Story 11.6: PDF Report Export)_
_Consolidated from 7 original epics into 7 strategic stories_
_For: Shtetl Zmanim Platform - Epic 11 Publisher Zmanim Registry Interface_
