# Story 11.7: E2E Testing & Performance Validation

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Status:** Draft
**Priority:** P1 (Testing - validates Epic 11 completion)
**Story Points:** 3

---

## User Story

**As a** developer,
**I want** comprehensive E2E tests and performance validation for the registry interface,
**So that** we ensure quality, prevent regressions, and meet performance targets before launch.

---

## Background

Story 11.7 is the final story of Epic 11, responsible for validating the complete Publisher Zmanim Registry Interface through comprehensive end-to-end testing and performance benchmarking. This story ensures all features work correctly in integration, meet performance targets, maintain data integrity, and provide excellent accessibility.

The registry interface represents a major shift in publisher onboarding workflows. Testing must verify:
- All user flows (browse, filter, search, import/link/copy, documentation)
- Performance targets (page load <2s, calculations <500ms, filters <300ms)
- Data integrity (duplicate prevention, correct linkages, validation)
- PDF report generation (all sections, styling, file size, generation time)
- Accessibility (keyboard navigation, screen readers, focus management)

This story depends on Stories 11.0-11.6 being complete, as it tests the entire integrated system.

---

## Acceptance Criteria

### AC-1: Master Registry Flow E2E Tests

**Test Suite 1: Master Registry Flow**

Given the Master Registry interface is implemented (Story 11.1)
When I run the E2E test suite `tests/e2e/publisher/registry-master.spec.ts`
Then the following test scenarios pass:

1. **Navigation & Default State**
   - Navigate to `/publisher/registry`
   - Verify Master Registry tab is active (default)
   - Verify shared header controls are visible (location picker, date selector)
   - Verify filter panel is visible (sidebar on desktop, drawer icon on mobile)

2. **Location & Date Selection**
   - Select location "Jerusalem, Israel" from global locality dropdown
   - Verify location badge updates: "Selected: Jerusalem, Israel"
   - Verify preview times recalculate for Jerusalem
   - Select date (today + 7 days)
   - Verify date selection persists
   - Verify preview times recalculate for new date

3. **Search & Filter Operations**
   - Search for "Alos" in search box
   - Verify search results are filtered to Alos-related zmanim
   - Filter by category "ALOS" (multi-select checkbox)
   - Verify active filter chip appears showing "ALOS"
   - Filter by shita "GRA" (multi-select checkbox)
   - Verify active filter chip appears showing "GRA"
   - Verify results show only ALOS category + GRA shita zmanim
   - Click chip "×" to remove ALOS filter
   - Verify ALOS filter removed, results update
   - Click "Clear All Filters" button
   - Verify all filters cleared, full results shown

4. **Zman Card Display**
   - Verify first zman card displays:
     - Hebrew name + English name
     - DSL formula with syntax highlighting (CodeMirror)
     - Preview time in 12-hour format (e.g., "5:24 AM")
     - Brief one-line description
     - Category badge (color-coded)
     - Shita badge (color-coded)
     - Status indicator: Available (green) or Imported (blue checkmark)
     - Info button (ℹ️)
     - Import button (enabled)

5. **Master Zman Documentation Modal**
   - Click Info (ℹ️) button on first result
   - Verify master documentation modal opens
   - Verify modal displays all sections:
     - Header with zman name and zman_key reference
     - Summary (brief description)
     - DSL Formula (syntax-highlighted) with "Copy to Clipboard" button
     - Scientific Explanation
     - Astronomical Definition
     - Algorithm
     - Halachic Significance
     - Halachic Sources (expandable cards)
     - Practical Notes
     - Related Zmanim (clickable links)
   - Click "Copy to Clipboard" button
   - Verify button text changes to "Copied ✓" for 2 seconds
   - Verify formula is copied to clipboard
   - Click a related zman link
   - Verify modal switches to related zman's documentation
   - Press Escape key
   - Verify modal closes

6. **Import Flow**
   - Click "Import Zman" button on first available zman
   - Verify redirect to `/publisher/algorithm?focus={zman_key}`
   - Verify newly imported zman is highlighted with green border
   - Verify toast notification: "[Zman Name] imported successfully"
   - Verify highlight fades out after 3 seconds

7. **Duplicate Prevention**
   - Return to `/publisher/registry`
   - Verify the imported zman now shows "Imported ✓" badge
   - Verify Import button is disabled (opacity-50, cursor-not-allowed)
   - Hover over disabled Import button
   - Verify tooltip: "You already imported this master zman"

8. **Empty State**
   - Apply filters that produce no results (e.g., category "ALOS" + shita "BAAL_HATANYA" if no matches)
   - Verify empty state message: "No master zmanim match your filters. Try adjusting your filters."

### AC-2: Publisher Examples Flow E2E Tests

**Test Suite 2: Publisher Examples Flow**

Given the Publisher Examples interface is implemented (Story 11.3)
When I run the E2E test suite `tests/e2e/publisher/registry-publisher.spec.ts`
Then the following test scenarios pass:

1. **Tab Switch & Publisher Search**
   - Navigate to `/publisher/registry`
   - Switch to "Publisher Examples" tab
   - Verify tab is active
   - Verify empty state: "Select a publisher to view their zmanim"
   - Search for publisher "MH Zmanim" in autocomplete dropdown
   - Verify autocomplete results show validated publishers only
   - Select "MH Zmanim" from dropdown

2. **Publisher Selection & Display**
   - Verify publisher name "MH Zmanim" displayed prominently
   - Verify "Validated Publisher" badge visible
   - Verify location dropdown is enabled (restricted to publisher's coverage)
   - Verify filter panel is visible

3. **Location Selection (Coverage-Restricted)**
   - Select location "Jerusalem, Israel" (within MH Zmanim coverage)
   - Verify location badge updates
   - Verify preview times calculate for selected location/date
   - Switch to a different publisher (e.g., create test publisher with different coverage)
   - Verify location is auto-cleared if new publisher doesn't cover Jerusalem
   - Verify message: "Please select a location within [Publisher Name]'s coverage"

4. **Publisher Zman Card Display**
   - Verify first publisher zman card displays:
     - Zman name (may be customized by publisher)
     - Publisher name with "Validated Publisher" badge
     - DSL formula (syntax-highlighted)
     - Preview time (12-hour format)
     - Master registry name reference (e.g., "Master: Alos Hashachar (16.1°)")
     - Shita badge (inherited from master)
     - Category badge (inherited from master)
     - Status: Available or "Already in Your Catalog"
     - Info button (ℹ️)
     - Link button (enabled if not owned)
     - Copy button (enabled if not owned)

5. **Publisher Zman Documentation Modal**
   - Click Info (ℹ️) button on first result
   - Verify publisher zman modal opens with two sections:
   - **Top Section: Publisher-Specific Fields**
     - Publisher name + "Validated Publisher" badge
     - Zman name (customized)
     - Publisher DSL formula with "Copy to Clipboard" button
     - Master registry reference: "Based on: [Master Zman Name]"
     - Attribution (if linked or copied)
   - **Bottom Section: Inherited Master Documentation**
     - Divider with text: "Master Zman Documentation"
     - All master documentation sections (same as master modal)
   - Click "Copy to Clipboard" in publisher formula section
   - Verify publisher's DSL formula is copied (not master formula)
   - Close modal

6. **Link Flow**
   - Click "Link" button on first available publisher zman
   - Verify redirect to `/publisher/algorithm?focus={zman_key}`
   - Verify zman is highlighted with green border
   - Verify toast notification: "Linked to [Publisher Name]'s [Zman Name]"
   - Return to registry, switch to Publisher Examples tab
   - Re-select same publisher and location
   - Verify same zman shows "Already in Your Catalog" status
   - Verify Link and Copy buttons are both disabled
   - Hover over disabled buttons
   - Verify tooltip: "You already have this master zman"

7. **Copy Flow**
   - Select a different publisher zman (not yet imported)
   - Click "Copy" button
   - Verify redirect to `/publisher/algorithm?focus={zman_key}`
   - Verify zman is highlighted with green border
   - Verify toast notification: "Copied [Zman Name] from [Publisher Name]"
   - Return to registry, switch to Publisher Examples tab
   - Re-select same publisher and location
   - Verify same zman shows "Already in Your Catalog" status
   - Verify Link and Copy buttons are both disabled

8. **Search & Filter Within Publisher Catalog**
   - Search for "Alos"
   - Verify results filtered to Alos-related zmanim from this publisher
   - Filter by category "ALOS"
   - Verify active filter chip appears
   - Verify results update
   - Clear filters
   - Verify full catalog shown

### AC-3: Request Addition Flow E2E Tests

**Test Suite 3: Request Addition Flow**

Given the Request Addition workflow is implemented (Story 11.5)
When I run the E2E test suite `tests/e2e/publisher/registry-request.spec.ts`
Then the following test scenarios pass:

1. **Request from Master Registry Tab**
   - Navigate to `/publisher/registry`
   - Verify "Request Addition" button exists in page header
   - Click "Request Addition" button
   - Verify `RequestZmanModal` opens
   - Verify modal form has fields: zman name, description, justification, tags, optional formula
   - Fill out request form with test data
   - Submit
   - Verify toast notification: "Request submitted for admin review"
   - Verify modal closes
   - Verify remain on registry page (no navigation)

2. **Request from Publisher Examples Tab**
   - Switch to "Publisher Examples" tab
   - Verify "Request Addition" button exists in page header
   - Click "Request Addition" button
   - Verify `RequestZmanModal` opens
   - Verify modal pre-populates "source" field with value "registry"
   - Fill out and submit request
   - Verify toast notification
   - Verify modal closes
   - Verify remain on registry page

### AC-4: Algorithm Page Migration E2E Tests

**Test Suite 4: Algorithm Page Migration**

Given the Algorithm page migration is complete (Story 11.5)
When I run the E2E test suite `tests/e2e/publisher/algorithm-migration.spec.ts`
Then the following test scenarios pass:

1. **Algorithm Page UI Changes**
   - Navigate to `/publisher/algorithm`
   - Verify "Browse Registry" button exists in header (prominent, secondary style)
   - Verify NO "Add Zman" button exists
   - Verify page allows editing existing zmanim (edit functionality intact)

2. **Code Inspection Tests**
   - Read source file: `web/app/publisher/algorithm/page.tsx`
   - Verify NO "Add Zman Mode" dialog code exists (lines 1144-1238 deleted)
   - Verify NO `MasterZmanPicker` component import/usage exists
   - Verify NO `PublisherZmanPicker` component import/usage exists
   - Verify NO "Add Zman Mode" state variables exist

3. **Browse Registry Navigation**
   - Click "Browse Registry" button
   - Verify navigation to `/publisher/registry`
   - Verify Master Registry tab is active (default)

4. **Focus Param Handling**
   - Import a zman from registry (triggers redirect with `?focus={zman_key}`)
   - Verify URL contains `?focus={zman_key}`
   - Verify page scrolls to zman card with matching `data-zman-key` attribute
   - Verify zman card is highlighted with green border and animation
   - Wait 3 seconds
   - Verify highlight fades out
   - Navigate to `/publisher/algorithm?focus=nonexistent_key`
   - Verify no error (graceful fallback)
   - Verify no scroll or highlight occurs

### AC-5: PDF Report Generation E2E Tests

**Test Suite 5: PDF Report Generation**

Given the PDF Report feature is implemented (Story 11.6)
When I run the E2E test suite `tests/e2e/publisher/pdf-report.spec.ts`
Then the following test scenarios pass:

1. **Modal Open & Configuration**
   - Navigate to `/publisher/algorithm`
   - Verify "Print Zmanim Report" button exists in header (with printer icon 🖨️)
   - Click "Print Zmanim Report" button
   - Verify modal opens with configuration options:
     - Location selector (autocomplete dropdown)
     - Date picker (default: today)
     - "Include Glossary" toggle (default: ON)
     - Preview note text
     - "Generate PDF" button
     - "Cancel" button

2. **PDF Generation with Glossary**
   - Select location "Jerusalem, Israel"
   - Select date (today + 7 days)
   - Verify "Include Glossary" toggle is ON
   - Click "Generate PDF" button
   - Verify loading indicator shows: "Generating your report..."
   - Wait for PDF download to trigger (timeout: 15 seconds)
   - Verify toast notification: "Zmanim report generated successfully"
   - Verify modal closes
   - Verify downloaded file exists in Downloads folder
   - Verify filename matches pattern: `{publisher_name}_zmanim_{location_name}_{date}.pdf`
   - Example: `MH_Zmanim_Jerusalem_Israel_2025-12-29.pdf`

3. **PDF Content Validation (With Glossary)**
   - Open downloaded PDF
   - Verify PDF has multiple pages
   - Verify **Section 1: Publisher Header**
     - Publisher logo or fallback icon
     - Publisher name (large, bold)
     - Report generation timestamp
     - Colorful header background (gradient)
   - Verify **Section 2: Location Details**
     - Section title: "Location Information"
     - Location name: "Jerusalem, Israel"
     - Coordinates (latitude/longitude)
     - Elevation (meters)
     - Timezone (e.g., "Asia/Jerusalem (UTC+2)")
     - Embedded static map image (400x200px) with red pin
   - Verify **Section 3: Report Metadata**
     - Section title: "Report Date & Time"
     - Selected date in full format (e.g., "Friday, December 29, 2025")
     - Hebrew date (if available)
     - Sunrise/Sunset times
   - Verify **Section 4: Zmanim List**
     - Section title: "Zmanim Calculations"
     - Table with columns: Zman Name, Calculated Time, DSL Formula, Explanation, Rounded Time
     - At least 10 zmanim rows
     - DSL formulas are syntax-highlighted (color-coded)
     - Times in 12-hour format with AM/PM
     - Alternating row colors for readability
   - Verify **Section 5: Glossary - Primitives**
     - Section title: "Glossary: Primitives"
     - At least 3 primitive cards (e.g., sunrise, sunset, solar)
     - Each card has: name, definition, calculation method, scientific source
     - Cards have visual styling (borders, colors, icons)
   - Verify **Section 6: Glossary - Functions**
     - Section title: "Glossary: Functions"
     - At least 2 function cards (e.g., coalesce, min, max)
     - Each card has: name, purpose, syntax, parameters, example usage
     - Code examples in monospace font
   - Verify **Footer (on each page)**
     - Page number (e.g., "Page 2 of 5")
     - Shtetl Zmanim branding
     - Disclaimer text
     - Generated timestamp

4. **PDF Generation without Glossary**
   - Return to `/publisher/algorithm`
   - Click "Print Zmanim Report" button
   - Select same location and date
   - Toggle "Include Glossary" OFF
   - Click "Generate PDF"
   - Wait for download
   - Verify toast notification
   - Verify modal closes
   - Verify downloaded file exists
   - Open PDF
   - Verify Sections 1-4 are present (Publisher Header, Location, Metadata, Zmanim List)
   - Verify Sections 5-6 (Glossary) are OMITTED
   - Verify file size is smaller than glossary version (approximately 2MB vs. 5MB)

5. **PDF File Size & Performance**
   - Measure PDF generation time (from "Generate PDF" click to download start)
   - Verify generation time <10 seconds (p95)
   - Check downloaded file size
   - Verify file size <5MB (with glossary)
   - Verify file size <2MB (without glossary)

6. **Error Handling**
   - Select location outside publisher's coverage
   - Click "Generate PDF"
   - Verify API returns 400 error
   - Verify modal shows error message: "You don't have coverage for this location. Please select a location within your coverage area."
   - Verify modal does NOT close
   - Verify no PDF downloaded

### AC-6: Duplicate Prevention Tests

**Test Suite 6: Duplicate Prevention**

Given duplicate prevention logic is implemented (Stories 11.1, 11.3)
When I run the E2E test suite `tests/e2e/publisher/registry-duplicates.spec.ts`
Then the following test scenarios pass:

1. **UI-Level Duplicate Prevention**
   - Import a master zman via Master Registry tab
   - Verify import succeeds
   - Return to Master Registry tab
   - Verify same zman shows "Imported ✓" badge
   - Verify Import button is disabled
   - Switch to Publisher Examples tab
   - Select a publisher who has the same master zman
   - Verify that publisher zman shows "Already in Your Catalog" status
   - Verify Link button is disabled
   - Verify Copy button is disabled

2. **API-Level Duplicate Prevention**
   - Import a master zman via UI
   - Attempt to import same master zman via direct API call (bypassing UI):
     ```typescript
     const response = await api.post('/publisher/registry/import', {
       master_zmanim_id: importedMasterZmanId
     });
     ```
   - Verify response status is 400
   - Verify response body contains error: "You already have this master zman" or similar
   - Verify NO duplicate `publisher_zmanim` record created

3. **Database-Level Duplicate Prevention**
   - Query database for unique constraint:
     ```sql
     SELECT constraint_name, constraint_type
     FROM information_schema.table_constraints
     WHERE table_name = 'publisher_zmanim'
       AND constraint_name LIKE '%master_unique%';
     ```
   - Verify unique constraint exists: `idx_publisher_zmanim_master_unique`
   - Attempt to insert duplicate via raw SQL (bypassing API):
     ```sql
     INSERT INTO publisher_zmanim (publisher_id, master_zmanim_id, zman_key, ...)
     VALUES (1, 5, 'test_key', ...);
     -- Attempt duplicate
     INSERT INTO publisher_zmanim (publisher_id, master_zmanim_id, zman_key, ...)
     VALUES (1, 5, 'test_key_2', ...);
     ```
   - Verify second insert raises unique constraint violation error
   - Verify only ONE record exists for `(publisher_id=1, master_zmanim_id=5)`

### AC-7: Performance Tests

**Performance Test Suite**

Given the registry interface is complete
When I run the performance test suite `tests/e2e/performance/registry-performance.spec.ts`
Then the following performance targets are met:

1. **Performance Test 1: Page Load**
   - Navigate to `/publisher/registry` (cold load, clear cache)
   - Measure time to first contentful paint (FCP)
   - **Target:** <2 seconds (p95)
   - Verify initial 50 master zmanim load and render
   - Verify page is interactive

2. **Performance Test 2: Location Preview Calculation**
   - Select location "Jerusalem, Israel"
   - Measure time from location selection to all preview times rendered
   - **Target:** <500ms per zman (concurrent calculation)
   - Verify preview times update without blocking UI
   - Verify page remains interactive during calculation

3. **Performance Test 3: Search/Filter Operations**
   - Apply category filter "ALOS"
   - Measure time from filter selection to results update
   - **Target:** <300ms
   - Apply shita filter "GRA"
   - Measure time from filter selection to results update
   - **Target:** <300ms
   - Search for "Alos Hashachar"
   - Measure time from keypress (last character) to results update
   - **Target:** <300ms

4. **Performance Test 4: Pagination**
   - Load page 2 (items 51-100)
   - Measure time from page click to next page rendered
   - **Target:** <1 second
   - Verify smooth scroll to top
   - Verify no layout shift

5. **Performance Test 5: Modal Open/Close**
   - Click Info button to open master documentation modal
   - Measure time from click to modal fully rendered
   - **Target:** <200ms
   - Close modal
   - Measure time from close click to modal dismissed
   - **Target:** <100ms

6. **Performance Test 6: Concurrency**
   - Simulate 100 concurrent users browsing registry (load testing with k6 or Artillery)
   - Measure response times for API endpoints
   - **Target:** p95 response time <2 seconds
   - Simulate 50 concurrent import/link/copy operations
   - Measure success rate
   - **Target:** >95% success rate
   - Verify NO duplicate creation under concurrent load
   - Check cache effectiveness
   - **Target:** Cache hit rate >80%

### AC-8: Data Validation Tests

**Data Validation Test Suite**

Given data foundation is complete (Story 11.0)
When I run the SQL validation test suite `tests/sql/registry-validation.sql`
Then the following validation queries return expected results:

1. **Documentation Backfill Validation**
   ```sql
   -- All master zmanim have required documentation
   SELECT COUNT(*) AS missing_docs FROM master_zmanim_registry
   WHERE full_description IS NULL
      OR halachic_source IS NULL
      OR formula_explanation IS NULL;
   -- Expected: 0
   ```
   - Verify result: `missing_docs = 0`

2. **Related Zmanim Validation**
   ```sql
   -- All related_zmanim_ids point to existing master zmanim
   SELECT mzr.id, mzr.zman_key, unnest(mzr.related_zmanim_ids) AS related_id
   FROM master_zmanim_registry mzr
   WHERE NOT EXISTS (
     SELECT 1 FROM master_zmanim_registry mzr2
     WHERE mzr2.id = unnest(mzr.related_zmanim_ids)
   );
   -- Expected: 0 rows
   ```
   - Verify result: 0 rows returned

3. **Publisher 1 Linkage Validation**
   ```sql
   -- All Publisher 1 zmanim have master linkage
   SELECT COUNT(*) AS unlinked FROM publisher_zmanim
   WHERE publisher_id = 1
     AND master_zmanim_id IS NULL
     AND deleted_at IS NULL;
   -- Expected: 0
   ```
   - Verify result: `unlinked = 0`

4. **Publisher 1 Duplicate Check**
   ```sql
   -- No duplicate master_zmanim_id within Publisher 1
   SELECT master_zmanim_id, COUNT(*) AS duplicate_count
   FROM publisher_zmanim
   WHERE publisher_id = 1 AND deleted_at IS NULL
   GROUP BY master_zmanim_id
   HAVING COUNT(*) > 1;
   -- Expected: 0 rows
   ```
   - Verify result: 0 rows returned

5. **Schema Validation**
   ```sql
   -- Verify unique constraint exists
   SELECT constraint_name
   FROM information_schema.table_constraints
   WHERE table_name = 'publisher_zmanim'
     AND constraint_type = 'UNIQUE'
     AND constraint_name = 'idx_publisher_zmanim_master_unique';
   -- Expected: 1 row

   -- Verify indexes exist
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'master_zmanim_registry'
     AND indexname IN ('idx_master_zmanim_shita', 'idx_master_zmanim_category');
   -- Expected: 2 rows
   ```
   - Verify constraint exists
   - Verify indexes exist

### AC-9: Accessibility Tests

**Accessibility Test Suite**

Given the registry interface is built with accessibility in mind
When I run the accessibility test suite `tests/e2e/accessibility/registry-a11y.spec.ts`
Then the following accessibility requirements are met:

1. **Keyboard Navigation**
   - Tab through all interactive elements (filters, search, cards, buttons)
   - Verify focus moves in logical order
   - Verify all elements are reachable via keyboard
   - Press Enter/Space to activate buttons
   - Verify buttons activate correctly
   - Press Escape to close modals/drawers
   - Verify modals close
   - Use Arrow keys for dropdown navigation
   - Verify dropdowns navigate correctly

2. **Screen Reader Support (using axe-core)**
   - Run axe-core audit on `/publisher/registry`
   - Verify ARIA labels for all buttons:
     - "Import Alos Hashachar"
     - "Open filters"
     - "Close modal"
     - "Copy formula to clipboard"
   - Verify ARIA live regions for loading states
   - Verify ARIA expanded states for collapsible filter panel
   - Verify semantic HTML (header, nav, main, section)
   - Verify NO critical accessibility violations

3. **Focus Management**
   - Verify visible focus indicators (ring-2 ring-primary)
   - Open master documentation modal
   - Verify focus is trapped in modal (Tab cycles within modal)
   - Close modal
   - Verify focus returns to Info button (trigger element)
   - Open filter drawer on mobile
   - Verify focus trapped in drawer
   - Close drawer
   - Verify focus returns to trigger

4. **Color Contrast**
   - Run color contrast checker on all text elements
   - Verify all text meets 4.5:1 contrast ratio (WCAG AA)
   - Verify all UI elements (buttons, borders) meet 3:1 contrast ratio
   - Test with color blindness simulators:
     - Protanopia (red-blind)
     - Deuteranopia (green-blind)
     - Tritanopia (blue-blind)
   - Verify UI is still usable and distinguishable

5. **Skip to Content Link**
   - Load page and press Tab (first focusable element)
   - Verify "Skip to content" link appears
   - Press Enter on skip link
   - Verify focus jumps to main content area

---

## Technical Notes

### File Structure

```
tests/
  e2e/
    publisher/
      registry-master.spec.ts           # Test Suite 1: Master Registry
      registry-publisher.spec.ts        # Test Suite 2: Publisher Examples
      registry-request.spec.ts          # Test Suite 3: Request Addition
      algorithm-migration.spec.ts       # Test Suite 4: Algorithm Page Migration
      pdf-report.spec.ts                # Test Suite 5: PDF Report Generation
      registry-duplicates.spec.ts       # Test Suite 6: Duplicate Prevention
    performance/
      registry-performance.spec.ts      # Performance tests
    accessibility/
      registry-a11y.spec.ts             # Accessibility tests
  sql/
    registry-validation.sql             # SQL validation queries
  fixtures/
    registry-test-data.ts               # Test data fixtures for registry
  utils/
    pdf-validator.ts                    # PDF content validation helpers
    performance-metrics.ts              # Performance measurement helpers
```

### Playwright Test Configuration

```typescript
// tests/playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000 // 5 seconds for assertions
  },
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### Test Utilities

**PDF Validation Helper:**

```typescript
// tests/utils/pdf-validator.ts
import { readFileSync } from 'fs';
import * as pdfParse from 'pdf-parse';

export async function validatePDFContent(filePath: string) {
  const dataBuffer = readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    numPages: data.numpages,
    text: data.text,
    hasSection: (sectionTitle: string) => {
      return data.text.includes(sectionTitle);
    },
    hasTable: (columnName: string) => {
      return data.text.includes(columnName);
    },
    fileSize: dataBuffer.length,
  };
}

export async function validatePDFStructure(filePath: string, options: {
  withGlossary: boolean;
}) {
  const pdf = await validatePDFContent(filePath);

  // Required sections
  const requiredSections = [
    'Location Information',
    'Report Date & Time',
    'Zmanim Calculations'
  ];

  for (const section of requiredSections) {
    if (!pdf.hasSection(section)) {
      throw new Error(`Missing required section: ${section}`);
    }
  }

  // Optional glossary sections
  if (options.withGlossary) {
    if (!pdf.hasSection('Glossary: Primitives')) {
      throw new Error('Missing Glossary: Primitives section');
    }
    if (!pdf.hasSection('Glossary: Functions')) {
      throw new Error('Missing Glossary: Functions section');
    }
  } else {
    if (pdf.hasSection('Glossary: Primitives')) {
      throw new Error('Glossary should be omitted when withGlossary=false');
    }
  }

  return pdf;
}
```

**Performance Metrics Helper:**

```typescript
// tests/utils/performance-metrics.ts
import { Page } from '@playwright/test';

export async function measurePageLoad(page: Page, url: string) {
  const startTime = Date.now();

  await page.goto(url, { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
    };
  });

  const totalTime = Date.now() - startTime;

  return {
    ...metrics,
    totalTime,
  };
}

export async function measureOperation(page: Page, operation: () => Promise<void>) {
  const startTime = Date.now();
  await operation();
  const duration = Date.now() - startTime;
  return duration;
}

export async function measureAPIResponse(page: Page, urlPattern: string | RegExp) {
  const startTime = Date.now();

  const response = await page.waitForResponse(urlPattern);

  const duration = Date.now() - startTime;
  const status = response.status();

  return {
    duration,
    status,
    ok: response.ok(),
  };
}
```

### Deterministic Waits (No Arbitrary Timeouts)

All tests must use deterministic waits instead of `waitForTimeout`:

**Correct Patterns:**

```typescript
// Wait for API response
await page.waitForResponse(response =>
  response.url().includes('/api/v1/publisher/registry/master') && response.ok()
);

// Wait for element to be visible
await expect(page.locator('[data-testid="zman-card"]').first()).toBeVisible();

// Wait for navigation to complete
await page.waitForLoadState('networkidle');

// Wait for specific text to appear
await expect(page.locator('text=Imported successfully')).toBeVisible();
```

**Incorrect Pattern (DO NOT USE):**

```typescript
// NEVER use arbitrary timeouts
await page.waitForTimeout(2000); // BAD
```

### Test Data Cleanup

Each test suite must clean up created data after tests:

```typescript
// tests/e2e/publisher/registry-master.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsPublisher, cleanupTestData } from '../utils';

test.describe('Master Registry Flow', () => {
  let publisherId: number;

  test.beforeAll(async () => {
    // Create test publisher for all tests
    const publisher = await createTestPublisherEntity();
    publisherId = publisher.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  test('should browse master registry', async ({ page }) => {
    await loginAsPublisher(page, publisherId);
    await page.goto('/publisher/registry');
    // Test implementation...
  });
});
```

### Parallel Test Execution

Configure tests to run in parallel for speed:

```typescript
// Enable parallel execution
test.describe.configure({ mode: 'parallel' });

test.describe('Master Registry Flow', () => {
  // Tests run in parallel
});
```

### Performance Baseline Recording

Record performance baselines for future comparison:

```typescript
// tests/performance/baseline.json
{
  "pageLoad": {
    "p50": 1200,
    "p95": 1800,
    "p99": 2000
  },
  "previewCalculation": {
    "p50": 300,
    "p95": 450,
    "p99": 500
  },
  "filterOperation": {
    "p50": 150,
    "p95": 250,
    "p99": 300
  }
}
```

Compare current performance against baseline:

```typescript
import baseline from './baseline.json';

test('page load meets performance target', async ({ page }) => {
  const metrics = await measurePageLoad(page, '/publisher/registry');

  expect(metrics.totalTime).toBeLessThan(baseline.pageLoad.p95);
});
```

### Accessibility Testing with axe-core

```typescript
// tests/e2e/accessibility/registry-a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('registry page has no accessibility violations', async ({ page }) => {
  await page.goto('/publisher/registry');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test('modal has proper focus management', async ({ page }) => {
  await page.goto('/publisher/registry');

  const infoButton = page.locator('[data-testid="info-button"]').first();
  await infoButton.click();

  // Verify modal is open
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // Verify focus is in modal
  const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focusedElement).toContain('modal');

  // Tab through modal elements (focus trap)
  const modalInteractiveElements = modal.locator('button, a, input, [tabindex="0"]');
  const count = await modalInteractiveElements.count();

  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press('Tab');
  }

  // Focus should cycle back to first element (still in modal)
  const focusedAfterCycle = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
  expect(focusedAfterCycle).toBe(true);

  // Close modal
  await page.keyboard.press('Escape');

  // Verify focus returned to info button
  const focusedAfterClose = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  expect(focusedAfterClose).toBe('info-button');
});
```

### SQL Validation Script

```sql
-- tests/sql/registry-validation.sql

-- ===========================
-- Documentation Backfill Validation
-- ===========================

-- All master zmanim have required documentation
SELECT
  COUNT(*) AS missing_docs_count,
  STRING_AGG(zman_key, ', ') AS missing_docs_zmanim
FROM master_zmanim_registry
WHERE full_description IS NULL
   OR halachic_source IS NULL
   OR formula_explanation IS NULL;
-- Expected: missing_docs_count = 0

-- ===========================
-- Related Zmanim Validation
-- ===========================

-- All related_zmanim_ids point to existing master zmanim
SELECT
  mzr.id,
  mzr.zman_key,
  unnest(mzr.related_zmanim_ids) AS related_id
FROM master_zmanim_registry mzr
WHERE NOT EXISTS (
  SELECT 1 FROM master_zmanim_registry mzr2
  WHERE mzr2.id = unnest(mzr.related_zmanim_ids)
);
-- Expected: 0 rows

-- ===========================
-- Publisher 1 Audit Validation
-- ===========================

-- All Publisher 1 zmanim have master linkage
SELECT
  COUNT(*) AS unlinked_count,
  STRING_AGG(zman_key, ', ') AS unlinked_zmanim
FROM publisher_zmanim
WHERE publisher_id = 1
  AND master_zmanim_id IS NULL
  AND deleted_at IS NULL;
-- Expected: unlinked_count = 0

-- No duplicate master_zmanim_id within Publisher 1
SELECT
  master_zmanim_id,
  COUNT(*) AS duplicate_count,
  STRING_AGG(zman_key, ', ') AS duplicate_zmanim
FROM publisher_zmanim
WHERE publisher_id = 1
  AND deleted_at IS NULL
GROUP BY master_zmanim_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- ===========================
-- Schema Validation
-- ===========================

-- Verify unique constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'publisher_zmanim'
  AND constraint_name = 'idx_publisher_zmanim_master_unique';
-- Expected: 1 row (UNIQUE constraint)

-- Verify indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'master_zmanim_registry'
  AND indexname IN ('idx_master_zmanim_shita', 'idx_master_zmanim_category');
-- Expected: 2 rows

-- ===========================
-- Data Integrity Validation
-- ===========================

-- All publisher zmanim with master_zmanim_id reference valid master zmanim
SELECT
  pz.id,
  pz.zman_key,
  pz.master_zmanim_id
FROM publisher_zmanim pz
WHERE pz.master_zmanim_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM master_zmanim_registry mzr
    WHERE mzr.id = pz.master_zmanim_id
  );
-- Expected: 0 rows

-- All publisher zmanim with linked_from_publisher_zman_id reference valid publisher zmanim
SELECT
  pz.id,
  pz.zman_key,
  pz.linked_from_publisher_zman_id
FROM publisher_zmanim pz
WHERE pz.linked_from_publisher_zman_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM publisher_zmanim pz2
    WHERE pz2.id = pz.linked_from_publisher_zman_id
  );
-- Expected: 0 rows

-- All publisher zmanim with copied_from_publisher_id reference valid publishers
SELECT
  pz.id,
  pz.zman_key,
  pz.copied_from_publisher_id
FROM publisher_zmanim pz
WHERE pz.copied_from_publisher_id IS NOT NULL
  AND pz.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM publishers p
    WHERE p.id = pz.copied_from_publisher_id
  );
-- Expected: 0 rows
```

---

## Implementation Checklist

### Phase 1: E2E Test Suite Setup
- [ ] Create file structure under `tests/e2e/publisher/`
- [ ] Create performance test directory `tests/e2e/performance/`
- [ ] Create accessibility test directory `tests/e2e/accessibility/`
- [ ] Create SQL test directory `tests/sql/`
- [ ] Install test utilities: `@axe-core/playwright`, `pdf-parse`
- [ ] Create test data fixtures for registry
- [ ] Create PDF validation helper
- [ ] Create performance metrics helper

### Phase 2: Master Registry E2E Tests
- [ ] Implement `registry-master.spec.ts`
- [ ] Test navigation & default state
- [ ] Test location & date selection
- [ ] Test search & filter operations
- [ ] Test zman card display
- [ ] Test master zman documentation modal
- [ ] Test import flow
- [ ] Test duplicate prevention UI
- [ ] Test empty state
- [ ] Verify all tests pass locally

### Phase 3: Publisher Examples E2E Tests
- [ ] Implement `registry-publisher.spec.ts`
- [ ] Test tab switch & publisher search
- [ ] Test publisher selection & display
- [ ] Test coverage-restricted location selection
- [ ] Test publisher zman card display
- [ ] Test publisher zman documentation modal
- [ ] Test link flow
- [ ] Test copy flow
- [ ] Test search & filter within publisher catalog
- [ ] Verify all tests pass locally

### Phase 4: Request Addition & Algorithm Migration E2E Tests
- [ ] Implement `registry-request.spec.ts`
- [ ] Test request from Master Registry tab
- [ ] Test request from Publisher Examples tab
- [ ] Implement `algorithm-migration.spec.ts`
- [ ] Test algorithm page UI changes
- [ ] Test code inspection (no Add Zman components)
- [ ] Test browse registry navigation
- [ ] Test focus param handling
- [ ] Verify all tests pass locally

### Phase 5: PDF Report E2E Tests
- [ ] Implement `pdf-report.spec.ts`
- [ ] Test modal open & configuration
- [ ] Test PDF generation with glossary
- [ ] Test PDF content validation (all sections)
- [ ] Test PDF generation without glossary
- [ ] Test PDF file size & performance
- [ ] Test error handling (coverage validation)
- [ ] Verify all tests pass locally

### Phase 6: Duplicate Prevention E2E Tests
- [ ] Implement `registry-duplicates.spec.ts`
- [ ] Test UI-level duplicate prevention
- [ ] Test API-level duplicate prevention
- [ ] Test database-level duplicate prevention (unique constraint)
- [ ] Verify all tests pass locally

### Phase 7: Performance Tests
- [ ] Implement `registry-performance.spec.ts`
- [ ] Test page load performance (<2s)
- [ ] Test location preview calculation (<500ms)
- [ ] Test search/filter operations (<300ms)
- [ ] Test pagination (<1s)
- [ ] Test modal open/close (<200ms, <100ms)
- [ ] Test concurrency (100 users, 50 operations)
- [ ] Record performance baseline
- [ ] Verify all targets met

### Phase 8: Data Validation Tests
- [ ] Create `registry-validation.sql`
- [ ] Add documentation backfill validation queries
- [ ] Add related zmanim validation queries
- [ ] Add Publisher 1 linkage validation queries
- [ ] Add Publisher 1 duplicate check queries
- [ ] Add schema validation queries
- [ ] Add data integrity validation queries
- [ ] Run SQL validation suite
- [ ] Verify all queries return expected results

### Phase 9: Accessibility Tests
- [ ] Implement `registry-a11y.spec.ts`
- [ ] Test keyboard navigation
- [ ] Test screen reader support (axe-core)
- [ ] Test focus management (modal, drawer)
- [ ] Test color contrast (4.5:1 ratio)
- [ ] Test skip to content link
- [ ] Test with color blindness simulators
- [ ] Verify NO critical accessibility violations

### Phase 10: CI Integration
- [ ] Update `.github/workflows/pr-e2e.yml` to include registry tests
- [ ] Configure parallel test execution
- [ ] Configure test artifacts (screenshots, traces, videos)
- [ ] Run full test suite in CI
- [ ] Verify all tests pass in CI
- [ ] Verify test execution time <20 minutes

---

## Definition of Done

- [ ] All 9 acceptance criteria met (AC-1 through AC-9)
- [ ] All E2E test suites implemented and passing (6 suites)
- [ ] All performance tests passing (6 tests, all targets met)
- [ ] All data validation queries passing (8 queries, expected results)
- [ ] All accessibility tests passing (5 tests, no violations)
- [ ] Test coverage: 100% of Epic 11 features tested
- [ ] Test execution time <20 minutes (p95)
- [ ] Performance baseline recorded for future comparison
- [ ] All tests passing in CI (GitHub Actions)
- [ ] Test documentation updated (usage examples, patterns)
- [ ] Code reviewed and approved

---

## Dependencies

- **Story 11.0:** Data Foundation & Integrity Audit (database must be populated and validated)
- **Story 11.1:** Master Registry Browser & Import Flow (UI and API must exist)
- **Story 11.2:** Master Zman Documentation Modal (modal must exist)
- **Story 11.3:** Publisher Examples Browser & Link/Copy Flow (UI and API must exist)
- **Story 11.4:** Publisher Zman Documentation Modal (modal must exist)
- **Story 11.5:** Request Addition & Algorithm Page Migration (UI changes must be complete)
- **Story 11.6:** Publisher Zmanim Report (PDF Export) (PDF generation must work)

**Prerequisites:** ALL Stories 11.0-11.6 must be complete before Story 11.7 can begin.

---

## Dependent Stories

- None (Story 11.7 is the final story of Epic 11)

---

## Notes

### Testing Strategy

Story 11.7 follows the "Dev is QA" philosophy - comprehensive testing ensures Epic 11 launches with confidence. The test suite covers:

1. **Functional Testing:** All user flows work correctly (import, link, copy, search, filter, documentation)
2. **Performance Testing:** All targets met (page load, calculations, filters, modals)
3. **Data Integrity Testing:** Database is correct (documentation, linkages, no duplicates)
4. **Accessibility Testing:** Interface is usable by everyone (keyboard, screen readers, color contrast)
5. **Regression Prevention:** Future changes won't break existing functionality

### Test Execution Order

1. **Data Validation** (SQL queries) - Verify database foundation first
2. **E2E Tests** (Playwright) - Test all user flows
3. **Performance Tests** (Playwright with metrics) - Verify speed targets
4. **Accessibility Tests** (axe-core) - Verify WCAG compliance

### Performance Targets Summary

| Metric | Target | Test |
|--------|--------|------|
| Page Load (p95) | <2 seconds | AC-7.1 |
| Preview Calculation | <500ms per zman | AC-7.2 |
| Search/Filter Operation | <300ms | AC-7.3 |
| Pagination | <1 second | AC-7.4 |
| Modal Open | <200ms | AC-7.5 |
| Modal Close | <100ms | AC-7.5 |
| PDF Generation (p95) | <10 seconds | AC-5.5 |
| PDF File Size (with glossary) | <5MB | AC-5.5 |
| PDF File Size (without glossary) | <2MB | AC-5.5 |
| Concurrent Users | 100 users, p95 <2s | AC-7.6 |
| Success Rate (concurrent ops) | >95% | AC-7.6 |
| Cache Hit Rate | >80% | AC-7.6 |

### Key Decisions

1. **Deterministic Waits Only:** No `waitForTimeout` - all waits are based on network responses or element visibility
2. **Parallel Execution:** Tests run in parallel for speed (target: <20 minutes total)
3. **Test Data Cleanup:** Each suite cleans up after itself (idempotent, safe to re-run)
4. **Performance Baselines:** Record metrics for future comparison and regression detection
5. **Accessibility First:** axe-core integration ensures WCAG 2.1 AA compliance
6. **Real PDF Validation:** Parse actual PDF content to verify structure and content

### Epic 11 Completion Criteria

Story 11.7 is the FINAL gate before Epic 11 is considered complete. All tests must pass before:
- Merging to `dev` branch
- Deploying to staging
- Announcing to publishers
- Launching to production

**Zero tolerance for test failures.** If a test fails, either:
1. Fix the bug in the implementation (preferred)
2. Fix the test if it's incorrect (rare)
3. Update acceptance criteria if requirements changed (requires approval)

---

## Status

**Status:** Draft
