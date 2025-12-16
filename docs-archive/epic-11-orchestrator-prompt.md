# Epic 11 Orchestration Prompt: Publisher Zmanim Registry Interface

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Stories:** 7 (11.0 → 11.7)
**Mode:** Full end-to-end implementation with quality gates
**Agent Role:** ORCHESTRATOR ONLY - You coordinate specialized agents, you do NOT implement tasks yourself

---

## 🎯 Your Mission (Orchestrator Agent)

You are the **Epic Orchestrator**. Your job is to:
1. **Delegate** each story to specialized implementation agents - use existing bmad agents available here - .agent/workflows/bmad - use for coding, tea for handling tests, architect for code quality - do stuff in parallel only if yu are sure they agents won't conflict
2. **Verify** completion criteria before moving to the next story
3. **Enforce quality gates** at each stage
4. **Never implement code yourself** - always spawn agents for actual work
5. **Track progress** and report status to the user

**Critical Rule:** You MUST NOT write any code, create any files, or run any tests yourself. You are a **coordinator**, not an implementer.

---

## 📋 Epic 11 Overview

**Goal:** Build a complete Publisher Zmanim Registry Interface that allows publishers to browse, import, and understand the master zmanim registry and other publishers' implementations.

**Documentation:**
- Epic Document: `docs/epic-11-publisher-zmanim-registry.md` (READ THIS FIRST)
- Tech Spec (Story 11.6): `docs/tech-spec-story-11.6-pdf-report.md`
- PRD: `docs/prd-publisher-zmanim-registry-2025-12-22.md`
- Architecture: Existing docs in `docs/`

**Stories in Sequence:**
1. Story 11.0: Data Foundation & Integrity Audit
2. Story 11.1: Master Registry Browser & Import Flow
3. Story 11.2: Master Zman Comprehensive Documentation Modal
4. Story 11.3: Publisher Examples Browser & Link/Copy Flow
5. Story 11.4: Publisher Zman Documentation Modal
6. Story 11.5: Request Addition Workflow & Algorithm Page Migration
7. Story 11.6: Publisher Zmanim Report (PDF Export)
8. Story 11.7: E2E Testing & Performance Validation

---

## 🔄 Orchestration Workflow (Per Story)

For EACH story, follow this exact workflow:


### Phase 1: Implementation
```
1. SPAWN a general-purpose agent for implementation
   - Agent type: /bmad:bmm:agents:dev
   - Model: sonnet (use opus for complex stories 11.1, 11.3, 11.6)
   - Task: "Implement Story 11.X according to approved plan. Follow acceptance criteria exactly."
   - Provide context: Story AC, approved plan, tech specs, coding standards
2. WAIT for agent to complete (do NOT interrupt)
3. VERIFY agent reports completion (check agent output)
4. Proceed to Phase 3
```

### Phase 2: Code Quality Review (DoD Gate)
```
1. SPAWN a code-reviewer agent
   - Agent type: general-purpose
   - Model: sonnet
   - Task: "Review Story 11.X implementation for Definition of Done compliance"
   - Checklist to verify:
     a. ALL acceptance criteria met (compare against epic doc)
     b. Code follows docs/coding-standards.md
     c. No TODOs, FIXMEs, or console.logs
     d. No raw fetch() (must use useApi hook)
     e. Backend uses 6-step handler pattern
     f. SQLc queries (no raw SQL)
     g. Proper error handling
     h. TypeScript types defined
     i. Components reuse existing patterns
     j. No over-engineering (YAGNI principle)
2. WAIT for review completion
3. READ review output
4. IF review finds issues:
   - SPAWN implementation agent again with fixes
   - Loop back to step 1 of this phase
5. IF review passes: Proceed to Phase 4
```

### Phase 4: Test Execution
```
1. SPAWN a test-runner agent
   - Agent type: general-purpose
   - Model: haiku (faster for test execution)
   - Task: "Run all relevant tests for Story 11.X"
   - Tests to run:
     - Backend: `cd api && go test ./... -v`
     - Frontend: `cd web && npm run type-check`
     - E2E (Story 11.7 only): `cd web && npm run test:e2e`
2. WAIT for test results
3. IF tests fail:
   - SPAWN implementation agent with test failures
   - Loop back to Phase 2
4. IF tests pass: Proceed to Phase 5
```

### Phase 5: Story Completion
```
1. REPORT to user:
   - Story 11.X COMPLETE ✅
   - Implementation summary (what was built)
   - Files changed count
   - Tests passed
   - DoD verified
2. ASK user: "Story 11.X is complete. Proceed to Story 11.Y?"
3. WAIT for user confirmation
4. IF approved: Move to next story
5. IF rejected: User can manually intervene
```

---

## 📊 Story-Specific Instructions

### Story 11.0: Data Foundation & Integrity Audit

**Critical Dependencies:**
- KosherJava research docs already exist in `docs/`
- Master registry table schema: `db/migrations/`

**Implementation Agent Instructions:**
```
Story 11.0: Data Foundation & Integrity Audit

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.0 section)
- KosherJava research: docs/kosherjava-zmanim-complete-extraction.md
- Existing schema: Review master_zmanim_registry table

TASKS:
1. Create migration: db/migrations/YYYYMMDDHHMMSS_add_registry_fields.sql
   - Add fields: full_description, halachic_source, formula_explanation, usage_context,
     related_zmanim_ids, shita, category
   - Add indexes: idx_master_zmanim_shita, idx_master_zmanim_category
   - Add unique constraint: idx_publisher_zmanim_master_unique

2. Create migration: db/migrations/YYYYMMDDHHMMSS_backfill_master_zmanim_documentation.sql
   - Map KosherJava methods to master registry zman_key
   - Populate documentation fields from research docs
   - Include validation queries in migration comments

3. Create audit script: scripts/audit-publisher-1-linkages.ts
   - Query all Publisher 1 zmanim
   - Compare formulas with master registry
   - Generate report: docs/audit/publisher-1-master-linkages-audit.md
   - Output: exact matches, semantic matches, mismatches, missing linkages

4. Create migration: db/migrations/YYYYMMDDHHMMSS_fix_publisher_1_master_linkages.sql
   - Based on audit report, update publisher_zmanim.master_zmanim_id
   - Add copied_from_publisher_id, linked_from_publisher_zman_id columns

5. Run sqlc generate after all migrations

ACCEPTANCE CRITERIA (from epic doc):
- All master zmanim have populated documentation (full_description, halachic_source, formula_explanation)
- Database schema extended with all new fields
- Unique constraint exists and tested
- Publisher 1 audit complete with 100% correct linkages
- Validation queries confirm 100% coverage

CODING STANDARDS: docs/coding-standards.md
```

**Review Agent Checklist:**
- ✅ All 4 migrations created and tested
- ✅ Audit script exists and runs successfully
- ✅ Audit report generated with findings
- ✅ sqlc generate completed without errors
- ✅ No master zmanim have NULL in required fields (SQL validation query)
- ✅ All Publisher 1 zmanim have master_zmanim_id set

---

### Story 11.1: Master Registry Browser & Import Flow

**Implementation Agent Instructions:**
```
Story 11.1: Master Registry Browser & Import Flow

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.1 section)
- Story 11.0 MUST be complete (database migrations applied)

TASKS:
1. Backend API:
   - Create: api/internal/db/queries/publisher_registry.sql
     - Query: ListMasterZmanimForRegistry (with ownership check)
     - Query: ImportMasterZman (insert publisher_zmanim)
     - Query: CheckPublisherHasMasterZman (duplicate prevention)
   - Create: api/internal/handlers/publisher_registry.go
     - Handler: ListMasterZmanimForRegistry (GET /api/v1/publisher/registry/master)
     - Handler: ImportMasterZman (POST /api/v1/publisher/registry/import)
     - Use 6-step handler pattern (docs/coding-standards.md)
     - PublisherResolver for auth
   - Run: cd api && sqlc generate

2. Frontend:
   - Create: web/app/publisher/registry/page.tsx (main registry page)
   - Create: web/components/registry/RegistryMasterBrowser.tsx
   - Create: web/components/registry/ZmanCard.tsx
   - Create: web/components/registry/RegistryLocationPicker.tsx
   - Create: web/components/registry/RegistryFilters.tsx
   - Reuse CodeMirror DSL setup from algorithm editor

3. Features:
   - Location picker with persistence
   - Date selector with persistence
   - Filters: category, shita, status (Available/Imported)
   - Search: zman name or formula keywords
   - Pagination: 50 items per page
   - Import button with duplicate prevention (disabled if already imported)
   - Success redirect: /publisher/algorithm?focus={zman_key}
   - Toast notifications

ACCEPTANCE CRITERIA (from epic doc):
- GET /api/v1/publisher/registry/master returns master zmanim with ownership status
- POST /api/v1/publisher/registry/import creates publisher_zmanim record
- Duplicate prevention works (400 error if already imported)
- UI matches wireframes (location picker, filters, cards)
- Import redirects to algorithm page with focus param
- All filter/search combinations work
- Performance: <2s page load, <500ms preview calculations

CODING STANDARDS: docs/coding-standards.md
- No raw fetch() - use useApi()
- Backend: 6-step handler pattern
- SQLc queries only (no raw SQL)
- Reuse existing components where possible
```

**Review Agent Checklist:**
- ✅ 3 SQLc queries created in publisher_registry.sql
- ✅ 2 handlers in publisher_registry.go following 6-step pattern
- ✅ 5 React components created
- ✅ Import flow tested manually (no duplicate creation)
- ✅ Filters work (try each combination)
- ✅ Search works (try formula keywords)
- ✅ Redirect to algorithm page works with focus param
- ✅ No console.log, no TODO/FIXME
- ✅ TypeScript compiles without errors

---

### Story 11.2: Master Zman Comprehensive Documentation Modal

**Implementation Agent Instructions:**
```
Story 11.2: Master Zman Comprehensive Documentation Modal

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.2 section)
- Story 11.1 MUST be complete (master browser exists)

TASKS:
1. Frontend Component:
   - Create: web/components/registry/MasterZmanDetailModal.tsx
   - Use shadcn/ui Dialog component
   - Reuse CodeMirror for formula syntax highlighting

2. Modal Sections (in order):
   - Header: Zman name (Hebrew + English), zman_key reference, close button
   - Summary: Brief description
   - DSL Formula: Syntax-highlighted with copy-to-clipboard button
   - Scientific Explanation
   - Astronomical Definition
   - Algorithm
   - Halachic Significance
   - Halachic Sources (expandable cards)
   - Practical Notes
   - Related Zmanim (clickable chips)

3. Features:
   - Copy to clipboard (DSL formula)
   - Related zmanim navigation (replaces modal content)
   - Breadcrumb trail for cycle detection (max depth: 5)
   - Keyboard: Escape to close
   - Click outside to close
   - Mobile responsive (full screen on mobile)

4. Integration:
   - Add Info button (ℹ️) to ZmanCard component
   - Clicking Info opens MasterZmanDetailModal
   - Pass master zman data as props

ACCEPTANCE CRITERIA (from epic doc):
- Modal displays all 10 sections in correct order
- Copy to clipboard works (button shows "Copied ✓" for 2s)
- Related zmanim links replace modal content
- Breadcrumb trail prevents infinite cycles
- Escape key closes modal
- Click outside closes modal
- Missing optional fields show "No additional information available"
- Mobile responsive (full screen)

CODING STANDARDS: docs/coding-standards.md
- Reuse shadcn/ui Dialog
- Accessibility: focus trap, semantic HTML, ARIA labels
```

**Review Agent Checklist:**
- ✅ MasterZmanDetailModal component created
- ✅ All 10 sections present and populated
- ✅ Copy to clipboard works (test in browser)
- ✅ Related zmanim navigation works
- ✅ Breadcrumb trail shown (test with circular references)
- ✅ Keyboard Escape works
- ✅ Click outside works
- ✅ Mobile responsive (test at 375px width)
- ✅ No console.log, no raw fetch()

---

### Story 11.3: Publisher Examples Browser & Link/Copy Flow

**Implementation Agent Instructions:**
```
Story 11.3: Publisher Examples Browser & Link/Copy Flow

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.3 section)
- Story 11.1 MUST be complete (registry page exists)

TASKS:
1. Backend API:
   - Add to: api/internal/db/queries/publisher_registry.sql
     - Query: ListValidatedPublishers (status='approved')
     - Query: ListPublisherZmanimForRegistry (with ownership check)
     - Query: GetPublisherCoverageLocalities
     - Query: LinkPublisherZman (insert with linked_from_publisher_zman_id)
     - Query: CopyPublisherZman (insert with copied_from_publisher_id)
   - Add to: api/internal/handlers/publisher_registry.go
     - Handler: GET /api/v1/publisher/registry/publishers
     - Handler: GET /api/v1/publisher/registry/publishers/{publisher_id}
     - Handler: GET /api/v1/publisher/registry/coverage/{publisher_id}
     - Handler: POST /api/v1/publisher/registry/link
     - Handler: POST /api/v1/publisher/registry/copy
   - Run: sqlc generate

2. Frontend:
   - Create: web/components/registry/RegistryPublisherBrowser.tsx (Publisher Examples tab)
   - Update: web/app/publisher/registry/page.tsx (add tab navigation)
   - Features:
     - Publisher search/autocomplete (validated publishers only)
     - Location dropdown (restricted to publisher's coverage)
     - Auto-clear location if new publisher doesn't cover it
     - Filter panel (category, shita, status)
     - Link button (creates linked publisher_zmanim)
     - Copy button (creates independent copy)
     - Both disabled if already have master zman

3. Duplicate Prevention:
   - Check if master_zmanim_id already exists for current publisher
   - Server-side validation + DB unique constraint
   - Disable Link/Copy buttons if already owned
   - Tooltip on disabled buttons: "You already have this master zman"

ACCEPTANCE CRITERIA (from epic doc):
- Publisher search shows validated publishers only
- Location dropdown restricted to selected publisher's coverage
- Auto-clear location when switching publishers
- Link button creates record with linked_from_publisher_zman_id
- Copy button creates record with copied_from_publisher_id
- Duplicate prevention works (400 error if master already exists)
- Success redirect: /publisher/algorithm?focus={zman_key}
- Both Link and Copy disabled if already have master

CODING STANDARDS: docs/coding-standards.md
```

**Review Agent Checklist:**
- ✅ 5 new SQLc queries created
- ✅ 5 new handlers following 6-step pattern
- ✅ RegistryPublisherBrowser component created
- ✅ Tab navigation works (Master / Publisher Examples)
- ✅ Publisher search works (only validated publishers)
- ✅ Location restriction works (try publisher without coverage)
- ✅ Link flow works (verify linked_from_publisher_zman_id set)
- ✅ Copy flow works (verify copied_from_publisher_id set)
- ✅ Duplicate prevention works (try importing same master twice)
- ✅ Redirect works with focus param

---

### Story 11.4: Publisher Zman Documentation Modal

**Implementation Agent Instructions:**
```
Story 11.4: Publisher Zman Documentation Modal

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.4 section)
- Story 11.2 MUST be complete (master modal exists)
- Story 11.3 MUST be complete (publisher browser exists)

TASKS:
1. Shared Component Refactoring:
   - Extract from MasterZmanDetailModal:
     - Create: web/components/registry/MasterDocumentationContent.tsx
     - This component renders master doc sections (5-10 from Story 11.2)
   - Both modals will import and reuse this component

2. New Component:
   - Create: web/components/registry/PublisherZmanDetailModal.tsx
   - Structure:
     - TOP SECTION: Publisher-specific fields
       - Publisher name + "Validated Publisher" badge
       - Zman name (may be customized)
       - Publisher DSL formula (syntax-highlighted) + copy button
       - Master registry reference: "Based on: [Master Zman Name]"
       - Custom notes (if exists)
       - Attribution (if linked/copied)
     - DIVIDER: "Master Zman Documentation"
     - BOTTOM SECTION: MasterDocumentationContent component
       - Reuses exact same rendering from master modal

3. Integration:
   - Add Info button to publisher zman cards in RegistryPublisherBrowser
   - Clicking Info opens PublisherZmanDetailModal
   - Pass publisher zman + master zman data

4. Features:
   - Copy to clipboard (publisher's formula, not master's)
   - Related zmanim links (navigates to master modal)
   - Hide "Custom Notes" section if empty
   - Same keyboard/click-outside behavior as master modal

ACCEPTANCE CRITERIA (from epic doc):
- Modal has two distinct sections (publisher + master)
- Publisher section shows all fields (name, formula, attribution)
- Master section reuses exact same component as master modal
- Copy button copies publisher formula (not master)
- Related zmanim links open master modal
- Custom notes hidden if empty
- Escape/click-outside closes modal

CODING STANDARDS: docs/coding-standards.md
```

**Review Agent Checklist:**
- ✅ MasterDocumentationContent component extracted (DRY principle)
- ✅ PublisherZmanDetailModal component created
- ✅ Two sections visible (publisher top, master bottom)
- ✅ Attribution shown correctly (linked vs copied)
- ✅ Copy button copies publisher formula
- ✅ Related zmanim navigation works (opens master modal)
- ✅ Custom notes section hidden when empty
- ✅ No code duplication between modals

---

### Story 11.5: Request Addition Workflow & Algorithm Page Migration

**Implementation Agent Instructions:**
```
Story 11.5: Request Addition Workflow & Algorithm Page Migration

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.5 section)
- Story 11.1 MUST be complete (registry page exists)

TASKS:
1. Component Refactoring:
   - Move: web/components/shared/RequestZmanModal.tsx (from algorithm page)
   - Add "source" field to request submission: "registry" | "algorithm"

2. Registry Page Integration:
   - Update: web/app/publisher/registry/page.tsx
   - Add "Request Addition" button in header (both tabs)
   - Import and use RequestZmanModal
   - Pre-populate source: "registry"

3. Algorithm Page Migration:
   - Update: web/app/publisher/algorithm/page.tsx
   - REMOVE (delete these sections):
     - Lines 1144-1238: Add Zman Mode dialog
     - MasterZmanPicker component import and usage
     - PublisherZmanPicker component import and usage
     - All "Add Zman Mode" state variables and handlers
   - ADD:
     - "Browse Registry" button in header
     - Button onClick: router.push('/publisher/registry')
   - KEEP:
     - Edit existing zmanim functionality
     - All other existing features

4. URL Parameter Handling:
   - Add to algorithm page: useEffect to parse ?focus={zman_key}
   - Scroll to zman card with data-zman-key attribute
   - Apply highlight styling (green border, animation)
   - Remove highlight after 3 seconds
   - Add CSS class: .highlight-zman with fade-in animation

ACCEPTANCE CRITERIA (from epic doc):
- RequestZmanModal moved to shared location
- "Request Addition" button on both registry tabs
- Modal pre-populates source field
- Algorithm page has "Browse Registry" button
- Algorithm page NO "Add Zman" button
- Algorithm page NO Add Zman Mode dialog code
- URL param ?focus={zman_key} scrolls and highlights zman
- Highlight fades after 3 seconds

CODING STANDARDS: docs/coding-standards.md
- Delete unused code completely (no comments like "// removed")
- No backwards-compatibility hacks
```

**Review Agent Checklist:**
- ✅ RequestZmanModal moved to shared location
- ✅ "Request Addition" button exists on registry page (both tabs)
- ✅ Algorithm page has "Browse Registry" button
- ✅ Algorithm page NO "Add Zman" button (verified)
- ✅ Add Zman Mode dialog code COMPLETELY REMOVED (check lines 1144-1238)
- ✅ MasterZmanPicker and PublisherZmanPicker COMPLETELY REMOVED
- ✅ URL param ?focus= works (test with ?focus=alos_hashachar)
- ✅ Zman scrolls into view and highlights
- ✅ Highlight fades after 3 seconds
- ✅ No dead code, no commented sections

---

### Story 11.6: Publisher Zmanim Report (PDF Export)

**Implementation Agent Instructions:**
```
Story 11.6: Publisher Zmanim Report (PDF Export)

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.6 section)
- Tech spec: docs/tech-spec-story-11.6-pdf-report.md (READ THIS - 60 pages of detailed specs)
- Story 11.5 MUST be complete (algorithm page exists)

CRITICAL: This is the most complex story. Use Opus model for better reasoning.

TASKS:
1. Backend - Reference Data:
   - Create: api/internal/dsl/primitives_reference.go
     - Type: PrimitiveDoc (Name, Definition, CalculationMethod, ScientificSource, Icon)
     - Map: PrimitivesReference with all 12 primitives documented
     - Source: web/lib/primitives-documentation.ts (reference for content)
   - Create: api/internal/dsl/functions_reference.go
     - Type: FunctionDoc (Name, Purpose, Syntax, Parameters, Example, ResultExplanation)
     - Type: ParameterDoc (Name, Type, Description, ExampleValue)
     - Map: FunctionsReference with all 8 functions documented

2. Backend - PDF Generator:
   - Install: github.com/johnfercher/maroto/v2 (go get)
   - Create: api/internal/services/pdf_generator.go
     - Service: PDFGenerator struct
     - Method: GenerateZmanimReport(ctx, params) ([]byte, error)
     - PDF Sections (in order):
       1. Publisher Header (gradient background, logo, name)
       2. Location Details (lat/long, elevation, timezone, embedded map)
       3. Report Metadata (date, Hebrew date, sunrise/sunset)
       4. Zmanim Table (alternating rows, syntax-highlighted formulas)
       5. Primitives Glossary (optional, 2-column cards)
       6. Functions Glossary (optional, 2-column cards)
       7. Footer (page numbers, disclaimer, timestamp)
   - Mapbox Integration:
     - Generate static map URL using MAPBOX_API_KEY from env
     - Cache map URLs in Redis (24h TTL)
     - Fallback: Omit map section if API fails
   - Formula Parsing:
     - Reuse existing DSL tokenizer to extract primitives/functions
     - Build unique list of used primitives/functions
     - Look up documentation from reference maps

3. Backend - API Endpoint:
   - Create: api/internal/db/queries/publisher_reports.sql
     - Query: GetPublisherForReport
     - Query: ListPublisherZmanimForReport
     - Query: PublisherHasCoverage
   - Create: api/internal/handlers/publisher_reports.go
     - Handler: GenerateZmanimReport (POST /api/v1/publisher/reports/zmanim-pdf)
     - 6-step pattern: resolve publisher, parse request, check coverage, check cache, generate PDF, respond
     - Response: Binary PDF stream with Content-Disposition header
     - Cache: Redis 1-hour TTL per (publisher_id, locality_id, date, include_glossary)
   - Run: sqlc generate

4. Frontend:
   - Create: web/components/reports/ZmanimReportModal.tsx
     - Location autocomplete
     - Date picker (shadcn/ui Calendar)
     - "Include Glossary" toggle (Switch)
     - "Generate PDF" button
     - Loading state: "Generating your report..."
   - Update: web/app/publisher/algorithm/page.tsx
     - Add "Print Zmanim Report" button in header (next to "Browse Registry")
     - Button icon: PrinterIcon from Heroicons
     - onClick: Open ZmanimReportModal
   - Download Handling:
     - Fetch PDF as blob (responseType: 'blob')
     - Create object URL and trigger download
     - Extract filename from Content-Disposition header
     - Clean up object URL after download

5. Error Handling (Graceful Degradation):
   - Map API fails → Omit map section, show text-only location
   - Logo URL broken → Use fallback icon
   - Zman calculation error → Show "Error" in red-highlighted row
   - Master docs missing → Use publisher description only
   - Cache failure → Generate fresh, skip caching

ACCEPTANCE CRITERIA (from epic doc):
- PDF generation completes in <10 seconds (p95)
- File size <5MB with glossary, <2MB without
- All 7 sections render correctly
- Mapbox static map embedded (400x200px with red pin)
- DSL formulas syntax-highlighted (color-coded)
- Primitives glossary: 2-column cards with icons
- Functions glossary: parameter-by-parameter explanations
- Error handling: Report always generates (no hard failures)
- Cache works (1-hour TTL)
- Download triggers with correct filename pattern

CODING STANDARDS: docs/coding-standards.md
- Follow tech spec exactly (60 pages of detailed implementation)
- Use Maroto v2 for PDF (NOT gofpdf, NOT chromedp)
- Mapbox Static Images API (NOT Google Maps)
```

**Review Agent Checklist:**
- ✅ primitives_reference.go created with all 12 primitives
- ✅ functions_reference.go created with all 8 functions
- ✅ pdf_generator.go service created
- ✅ All 7 PDF sections implemented (verify by generating test PDF)
- ✅ Mapbox static map embedded (test with real location)
- ✅ publisher_reports.go handler follows 6-step pattern
- ✅ 3 SQLc queries created
- ✅ ZmanimReportModal component created
- ✅ "Print Zmanim Report" button on algorithm page
- ✅ PDF downloads with correct filename
- ✅ Test error scenarios (map API fail, calculation error)
- ✅ Cache works (generate same PDF twice, verify cache hit)
- ✅ File size within limits (<5MB)
- ✅ Generation time <10s (measure with time command)

---

### Story 11.7: E2E Testing & Performance Validation

**Implementation Agent Instructions:**
```
Story 11.7: E2E Testing & Performance Validation

CONTEXT:
- Epic doc: docs/epic-11-publisher-zmanim-registry.md (Story 11.7 section)
- ALL Stories 11.0-11.6 MUST be complete

TASKS:
1. E2E Test Suites (Playwright):
   - Create: tests/e2e/publisher/registry.spec.ts
   - Test Suite 1: Master Registry Flow (22 steps - see epic doc)
   - Test Suite 2: Publisher Examples Flow (21 steps)
   - Test Suite 3: Request Addition Flow (8 steps)
   - Test Suite 4: Algorithm Page Migration (7 steps)
   - Test Suite 5: PDF Report Generation (18 steps)
   - Test Suite 6: Duplicate Prevention (10 steps)

2. Performance Tests (Playwright):
   - Test: Page load time (<2s FCP)
   - Test: Location preview calculation (<500ms per zman)
   - Test: Search/filter operations (<300ms)
   - Test: Pagination (<1s)
   - Test: Modal open/close (<200ms open, <100ms close)
   - Test: PDF generation (<10s)

3. Data Validation Tests (SQL):
   - Create: tests/sql/registry-validation.sql
   - Query: Verify all master zmanim have required docs (0 results expected)
   - Query: Verify all related_zmanim_ids point to existing zmanim (0 results expected)
   - Query: Verify all Publisher 1 zmanim have master linkage (0 results expected)
   - Query: Verify no duplicate master_zmanim_id within Publisher 1 (0 results expected)

4. Accessibility Tests (Playwright + axe-core):
   - Keyboard navigation (Tab through all elements)
   - Screen reader support (ARIA labels)
   - Focus management (focus trap in modals)
   - Color contrast (4.5:1 ratio for text)

5. Test Configuration:
   - Configure parallel execution: test.describe.configure({ mode: 'parallel' })
   - Use deterministic waits (page.waitForResponse, expect().toBeVisible)
   - Clean up test data after each suite
   - Record performance baseline for future comparison

ACCEPTANCE CRITERIA (from epic doc):
- All 6 E2E test suites pass
- All performance tests meet targets
- All SQL validation queries return 0 rows
- All accessibility tests pass (axe-core)
- Parallel execution works (no race conditions)
- Test data cleanup works

CODING STANDARDS: docs/coding-standards.md
```

**Review Agent Checklist:**
- ✅ registry.spec.ts created with all 6 test suites
- ✅ All test suites pass (run npm run test:e2e)
- ✅ Performance tests pass (verify targets met)
- ✅ SQL validation queries return 0 rows (run each query)
- ✅ Accessibility tests pass (axe-core report clean)
- ✅ Parallel execution works (no flaky tests)
- ✅ Test data cleanup works (verify database state)
- ✅ No console errors during test runs
- ✅ Test coverage adequate (all features tested)

---

## 🚦 Quality Gates (MANDATORY)

Each story MUST pass these gates before proceeding:

### Gate 1: Acceptance Criteria (100%)
- ✅ ALL AC from epic doc verified
- ✅ No partial implementations
- ✅ No "TODO: implement later"

### Gate 2: Definition of Done
- ✅ Code follows docs/coding-standards.md
- ✅ No console.log, no TODO/FIXME
- ✅ No raw fetch() (use useApi)
- ✅ Backend: 6-step handler pattern
- ✅ SQLc queries (no raw SQL)
- ✅ TypeScript types defined
- ✅ Error handling implemented
- ✅ No over-engineering (YAGNI)

### Gate 3: Tests Pass
- ✅ Backend: go test ./... passes
- ✅ Frontend: npm run type-check passes
- ✅ E2E (Story 11.7): npm run test:e2e passes

### Gate 4: Manual Verification (Orchestrator)
- ✅ Orchestrator reviews implementation summary
- ✅ Files changed align with story scope
- ✅ No unexpected changes to unrelated files

---

## 📝 Orchestrator Reporting Format

After EACH story completion, report to user:

```
═══════════════════════════════════════════════════════════
STORY 11.X COMPLETE ✅
═══════════════════════════════════════════════════════════

📊 IMPLEMENTATION SUMMARY:
- [Bullet point summary of what was built]
- [Key files created/modified]
- [API endpoints added]
- [Components created]

📈 STATISTICS:
- Files Changed: X
- Lines Added: +X
- Lines Removed: -X
- Time Taken: X minutes

✅ QUALITY GATES PASSED:
- Acceptance Criteria: ✅ 100% (X/X criteria met)
- Definition of Done: ✅ All checks passed
- Tests: ✅ All tests passing
- Manual Review: ✅ Verified by code-reviewer agent

🧪 TEST RESULTS:
- Backend Tests: ✅ X/X passed
- Type Check: ✅ No errors
- E2E Tests: [Story 11.7 only]

🔍 CODE REVIEW HIGHLIGHTS:
- [Key findings from reviewer agent]
- [Any issues found and fixed]

📂 KEY FILES:
- [List of important files created/modified]

═══════════════════════════════════════════════════════════
➡️  NEXT: Story 11.Y - [Story Name]
═══════════════════════════════════════════════════════════

Proceed to Story 11.Y? (yes/no)
```

---

## 🎯 Success Criteria for Epic Completion

Epic 11 is COMPLETE when:

1. ✅ All 7 stories completed and verified
2. ✅ All quality gates passed for each story
3. ✅ All E2E tests passing (Story 11.7)
4. ✅ All SQL validation queries return 0 rows
5. ✅ Performance targets met (<2s page load, <10s PDF generation)
6. ✅ Code review passed for each story
7. ✅ User manually tests and approves final implementation

---

## 🚨 Orchestrator Rules (CRITICAL)

**YOU MUST:**
1. ✅ ALWAYS spawn agents for implementation (NEVER implement yourself)
2. ✅ ALWAYS get user approval on plans before implementation
3. ✅ ALWAYS run code review after implementation
4. ✅ ALWAYS run tests before marking story complete
5. ✅ ALWAYS wait for user confirmation before proceeding to next story
6. ✅ ALWAYS verify acceptance criteria 100% met
7. ✅ ALWAYS report progress in the standardized format

**YOU MUST NOT:**
1. ❌ NEVER write code yourself (you are a coordinator)
2. ❌ NEVER skip quality gates (all gates are mandatory)
3. ❌ NEVER proceed to next story without user approval
4. ❌ NEVER accept partial implementations (100% or fail)
5. ❌ NEVER skip code review (DoD is non-negotiable)
6. ❌ NEVER skip tests (all tests must pass)
7. ❌ NEVER assume user approval (always ask explicitly)

---

## 🚀 Kickoff Instructions

**Step 1: Read Epic Documentation**
- Read: docs/epic-11-publisher-zmanim-registry.md (full epic)
- Read: docs/tech-spec-story-11.6-pdf-report.md (Story 11.6 tech spec)
- Read: docs/coding-standards.md (coding standards)

**Step 2: Verify Prerequisites**
- ✅ Database is running (PostgreSQL)
- ✅ Redis is running
- ✅ API is running (./restart.sh)
- ✅ Web is running (port 3001)
- ✅ Mapbox API keys configured (api/.env, Fly.io, AWS SSM, Vercel)

**Step 3: Confirm Understanding**
Report to user:
```
Epic 11 Orchestration Ready ✅

I have read:
- Epic 11 documentation (7 stories, 60 FRs)
- Story 11.6 technical specification (60 pages)
- Coding standards

I understand my role:
- Orchestrator ONLY (no implementation)
- Spawn agents for each phase
- Enforce quality gates
- Report progress after each story

Ready to begin Story 11.0?
```

**Step 4: Await User Confirmation**
WAIT for user to say "yes" or "begin" before starting Story 11.0.

---

## 📚 Reference Documents

**Epic Documentation:**
- `docs/epic-11-publisher-zmanim-registry.md` - Main epic document
- `docs/tech-spec-story-11.6-pdf-report.md` - PDF report technical spec
- `docs/prd-publisher-zmanim-registry-2025-12-22.md` - Product requirements
- `docs/coding-standards.md` - Coding standards (MANDATORY)

**KosherJava Research:**
- `docs/kosherjava-zmanim-complete-extraction.md` - Zmanim mappings
- `docs/kosherjava-formulas-quick-reference.md` - Formula reference
- `docs/README-KOSHERJAVA-RESEARCH.md` - Research index

**Existing Code Patterns:**
- `api/internal/handlers/` - Handler patterns (6-step)
- `api/internal/db/queries/` - SQLc query patterns
- `web/components/` - React component patterns
- `web/lib/api-client.ts` - useApi() hook pattern

---

## ✅ Orchestrator Checklist (Before Starting)

Before executing this orchestration, verify:

- [ ] I have read the entire epic document (60 FRs, 7 stories)
- [ ] I have read Story 11.6 tech spec (60 pages)
- [ ] I have read coding standards
- [ ] I understand I MUST NOT implement code myself
- [ ] I understand I MUST spawn agents for all tasks
- [ ] I understand I MUST enforce all quality gates
- [ ] I understand I MUST get user approval before each story
- [ ] I understand I MUST verify 100% of acceptance criteria
- [ ] I understand partial implementations are REJECTED
- [ ] I am ready to orchestrate the full epic end-to-end

---

**BEGIN ORCHESTRATION**

Start with Story 11.0: Data Foundation & Integrity Audit

Good luck! 🚀
