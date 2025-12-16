# Story 11.6: Publisher Zmanim Report (PDF Export)

Status: ready

## Story

As a **publisher**,
I want **to generate a comprehensive, beautifully designed PDF report of my zmanim calculations for a specific location and date**,
so that **I can share transparent, trustworthy documentation with end-users who want to understand exactly how each time was calculated**.

## Acceptance Criteria

### Report Generation Flow

1. **Print Button on Algorithm Page**
   - Given I am on `/publisher/algorithm`
   - When I view the page header
   - Then I see a "Print Zmanim Report" button (prominent, with printer icon 🖨️)

2. **Configuration Modal**
   - Given I click the "Print Zmanim Report" button
   - When the button is clicked
   - Then a modal opens with report configuration options:
     - Location selector (autocomplete dropdown)
     - Date picker (default: today)
     - "Include Glossary" toggle (default: ON)
     - Preview note: "This will generate a PDF with all your published zmanim for the selected location and date"
     - "Generate PDF" button
     - "Cancel" button

3. **PDF Generation**
   - Given I have selected a location and date
   - When I click "Generate PDF"
   - Then a loading indicator shows: "Generating your report..."
   - And API call is made: `POST /api/v1/publisher/reports/zmanim-pdf`
   - And backend generates PDF and returns download URL or binary stream
   - And PDF automatically downloads to my browser
   - And toast notification shows: "Zmanim report generated successfully"
   - And modal closes

### PDF Content Requirements

4. **Section 1: Publisher Header**
   - Publisher logo (fetched from `publishers.logo_url`, fallback to default icon)
   - Publisher name (large, bold)
   - Publisher tagline/description (if available)
   - Report generation timestamp: "Generated on Dec 22, 2025 at 3:45 PM UTC"
   - Modern, colorful header background (gradient: indigo-to-purple or custom brand colors)

5. **Section 2: Location Details**
   - Section title: "Location Information"
   - Location name: Full name (e.g., "Jerusalem, Israel")
   - Coordinates: Latitude/Longitude (e.g., "31.7683°N, 35.2137°E")
   - Elevation: Meters above sea level (e.g., "754m")
   - Timezone: Full timezone name (e.g., "Asia/Jerusalem (UTC+2)")
   - Map: Embedded static map image showing location pin
     - Use static map API (e.g., Mapbox Static Images API)
     - Map dimensions: 400x200px
     - Zoom level: 10 (city-level view)
     - Marker: Red pin at exact coordinates
   - Visual design: Card layout with soft shadow, icon for each field (📍 location, 🗺️ coordinates, ⛰️ elevation, 🕐 timezone)

6. **Section 3: Report Metadata**
   - Section title: "Report Date & Time"
   - Selected date: Full date format (e.g., "Friday, December 22, 2025")
   - Hebrew date: (if available, e.g., "21 Kislev 5786")
   - Sunrise/Sunset times: Preview times for context (e.g., "Sunrise: 6:34 AM | Sunset: 4:49 PM")
   - Visual design: Horizontal timeline graphic showing daylight hours

7. **Section 4: Zmanim List (Main Content)**
   - Section title: "Zmanim Calculations"
   - Instruction text: "All times calculated using our DSL (Domain-Specific Language) formulas. See glossary below for detailed explanations."
   - Table format with columns:
     - Zman Name (Hebrew + English)
     - Calculated Time (HH:MM:SS format, 12-hour with AM/PM)
     - DSL Formula (syntax-highlighted)
     - Explanation (plain-language from `master_zmanim_registry.formula_explanation`)
     - Rounded Time (HH:MM format, 12-hour with AM/PM)
   - Visual design:
     - Monospace font for DSL formulas
     - Color-coding for syntax (primitives: #3B82F6, functions: #10B981, numbers: #F59E0B)
     - Alternating row background colors (white / light gray)
     - Icons next to zman categories (🌅 Alos, 📖 Shema, 🕍 Tefilla, ☀️ Chatzos, 🌇 Mincha, 🌙 Tzais)

8. **Section 5: Glossary - Primitives** (if "Include Glossary" enabled)
   - Section title: "Glossary: Primitives"
   - Instruction text: "Primitives are foundational astronomical events used in zmanim calculations."
   - Format: Expandable cards (2-column layout)
   - For each primitive used in the report:
     - Card header: Primitive name (e.g., "`sunrise`", "`solar(-16.1)`")
     - Definition: Brief explanation
     - Calculation method: Technical details
     - Scientific source: Reference
     - Visual: Small icon representing the primitive
   - Primitives to include (only if used): `sunrise`, `sunset`, `visible_sunrise`, `visible_sunset`, `solar(angle)`, `noon`, `alos_hashachar`, `tzais_hakochavim`

9. **Section 6: Glossary - Functions** (if "Include Glossary" enabled)
   - Section title: "Glossary: Functions"
   - Instruction text: "Functions perform operations on primitives and other values to calculate zmanim."
   - Format: Expandable cards (2-column layout)
   - For each function used in the report:
     - Card header: Function name
     - Purpose: What the function does
     - Syntax: Function signature
     - Parameters: Detailed explanation of each parameter (name, type, description, example)
     - Example usage: Real example from the report
     - Result explanation: What the example returns
   - Functions to include (only if used): `+`, `-`, `min()`, `max()`, `avg()`, `coalesce()`, `shaos_zmanios_gra()`, `shaos_zmanios_mga()`

10. **PDF Footer (on every page)**
    - Page number (e.g., "Page 2 of 5")
    - Shtetl Zmanim branding (small logo)
    - Disclaimer: "if publisher is not official"
    - Generated timestamp

### PDF Design Requirements

11. **Visual Style**
    - Modern & Vibrant: Gradient headers, colorful badges, clean typography
    - Color palette:
      - Primary: Indigo (#4F46E5)
      - Accent: Purple (#7C3AED)
      - Success: Green (#10B981)
      - Warning: Orange (#F59E0B)
      - Neutral: Gray scale (#F3F4F6 to #111827)
    - Typography:
      - Headers: Bold, sans-serif (Inter, Helvetica)
      - Body: Regular, sans-serif
      - Code/DSL: Monospace (JetBrains Mono, Courier)
      - Hebrew: Hebrew-compatible font (Frank Ruehl CLM, Taamey Frank)
    - Layout:
      - A4 page size (210mm x 297mm)
      - Margins: 20mm on all sides
      - Sections clearly separated with dividers or background colors
      - White space for readability
    - Accessibility:
      - High contrast text (4.5:1 ratio minimum)
      - Clear hierarchy (H1, H2, H3 tags)
      - Readable font sizes (body: 11pt, headers: 14-18pt, fine print: 9pt)

12. **Performance**
    - PDF generation completes in <10 seconds (p95)
    - File size <5MB (optimized images, compressed fonts)
    - Concurrent generation support (up to 50 simultaneous requests)

### Edge Cases & Variations

13. **Glossary Toggle OFF**
    - Given "Include Glossary" toggle is OFF
    - When PDF is generated
    - Then Sections 1-4 are included (Publisher Header, Location, Metadata, Zmanim List)
    - And Sections 5-6 (Glossary) are omitted
    - And File size is smaller (~2MB vs. ~5MB)

14. **Formula Errors**
    - Given the report includes zmanim with errors (e.g., formula validation failed)
    - When PDF is generated
    - Then those zmanim rows show:
      - Calculated Time: "Error"
      - Explanation: Error message (e.g., "Formula syntax error: unexpected token")
      - Row highlighted in red background
    - And PDF still generates successfully (no hard failure)

15. **Coverage Validation**
    - Given the selected location has no coverage for this publisher
    - When I attempt to generate PDF
    - Then API returns 400 error: "Publisher does not cover this location"
    - And modal shows error message: "You don't have coverage for this location. Please select a location within your coverage area."

16. **Filename Convention**
    - Given I have generated a PDF
    - When I open the downloaded file
    - Then filename is descriptive: `{publisher_name}_zmanim_{location_name}_{date}.pdf`
    - Example: `MH_Zmanim_Jerusalem_Israel_2025-12-22.pdf`
    - Spaces replaced with underscores
    - Special characters removed

## Tasks / Subtasks

### Backend Implementation

- [ ] Task 1: Create PDF Generation Service (AC: 3, 4, 5, 6, 7, 8, 9, 11, 12)
  - [ ] 1.1 Research and select PDF library (recommend `github.com/johnfercher/maroto`)
  - [ ] 1.2 Create `api/internal/services/pdf_generator.go`
  - [ ] 1.3 Implement publisher header section generation
  - [ ] 1.4 Implement location details section with static map integration
  - [ ] 1.5 Implement report metadata section (date, Hebrew date, sunrise/sunset)
  - [ ] 1.6 Implement zmanim table generation with syntax highlighting
  - [ ] 1.7 Implement primitives glossary generation
  - [ ] 1.8 Implement functions glossary generation
  - [ ] 1.9 Implement footer on all pages
  - [ ] 1.10 Apply modern color scheme and typography
  - [ ] 1.11 Add PDF compression and optimization
  - [ ] 1.12 Add timeout handling (30-second max)

- [ ] Task 2: Create Primitive & Function Reference Data (AC: 8, 9)
  - [ ] 2.1 Create `api/internal/dsl/primitives_reference.go`
  - [ ] 2.2 Define PrimitiveDoc struct and populate reference map
  - [ ] 2.3 Document all primitives: sunrise, sunset, solar, noon, visible_*, etc.
  - [ ] 2.4 Create `api/internal/dsl/functions_reference.go`
  - [ ] 2.5 Define FunctionDoc and ParameterDoc structs
  - [ ] 2.6 Document all functions: coalesce, min, max, avg, arithmetic, shaos_zmanios_*

- [ ] Task 3: Create DSL Formula Parser for Glossary Extraction (AC: 8, 9)
  - [ ] 3.1 Implement DSL tokenizer/parser in `api/internal/dsl/parser.go`
  - [ ] 3.2 Extract unique primitives from formula list
  - [ ] 3.3 Extract unique functions from formula list
  - [ ] 3.4 Look up documentation from reference maps

- [ ] Task 4: Integrate Mapbox Static API (AC: 5)
  - [ ] 4.1 Sign up for Mapbox API key (free tier: 50,000 requests/month)
  - [ ] 4.2 Store API key in AWS SSM: `/zmanim/prod/mapbox-api-key`
  - [ ] 4.3 Create static map URL builder function
  - [ ] 4.4 Implement fallback if map API fails (omit map section, don't fail PDF)
  - [ ] 4.5 Cache static map URLs (24-hour TTL per location)

- [ ] Task 5: Create SQLc Queries for Report Data (AC: 4, 5, 6, 7)
  - [ ] 5.1 Create `GetPublisherForReport` query (logo, name, description)
  - [ ] 5.2 Create `GetLocalityDetails` query (name, lat, long, elevation, timezone)
  - [ ] 5.3 Create `ListPublisherZmanimForReport` query (all published zmanim for location/date)
  - [ ] 5.4 Create `GetMasterZmanExplanations` query (formula explanations from master registry)
  - [ ] 5.5 Run `sqlc generate`

- [ ] Task 6: Create API Endpoint (AC: 3, 12, 14, 15)
  - [ ] 6.1 Create `api/internal/handlers/publisher_reports.go`
  - [ ] 6.2 Implement `GenerateZmanimReport(w, r)` handler (6-step pattern)
  - [ ] 6.3 Use PublisherResolver to validate publisher
  - [ ] 6.4 Validate location coverage (return 400 if not covered)
  - [ ] 6.5 Call PDF generation service
  - [ ] 6.6 Return PDF as `Content-Type: application/pdf` with attachment filename
  - [ ] 6.7 Add route: `POST /api/v1/publisher/reports/zmanim-pdf`
  - [ ] 6.8 Add timeout middleware (30 seconds)

- [ ] Task 7: Implement PDF Caching Strategy (AC: 12)
  - [ ] 7.1 Define cache key: `pdf:zmanim:{publisher_id}:{locality_id}:{date}:{glossary}`
  - [ ] 7.2 Implement cache lookup before generation
  - [ ] 7.3 Store generated PDF in cache (1-hour TTL)
  - [ ] 7.4 Invalidate cache when publisher updates zmanim

### Frontend Implementation

- [ ] Task 8: Create Print Report Modal Component (AC: 1, 2, 3, 16)
  - [ ] 8.1 Create `web/components/reports/ZmanimReportModal.tsx`
  - [ ] 8.2 Add location autocomplete dropdown (reuse from registry)
  - [ ] 8.3 Add date picker (shadcn/ui Calendar component)
  - [ ] 8.4 Add "Include Glossary" toggle (Switch component)
  - [ ] 8.5 Add loading indicator: "Generating your report..."
  - [ ] 8.6 Implement Generate PDF button with API call
  - [ ] 8.7 Implement PDF download handling (blob response)
  - [ ] 8.8 Show toast notification on success
  - [ ] 8.9 Show error message on coverage validation failure

- [ ] Task 9: Add Print Button to Algorithm Page (AC: 1)
  - [ ] 9.1 Modify `web/app/publisher/algorithm/page.tsx`
  - [ ] 9.2 Add "Print Zmanim Report" button in header (next to "Browse Registry")
  - [ ] 9.3 Add printer icon from Heroicons
  - [ ] 9.4 Wire button to open ZmanimReportModal

### Testing

- [ ] Task 10: Unit Tests (AC: All)
  - [ ] 10.1 Test PDF generation service with mock data
  - [ ] 10.2 Test primitive/function extraction from DSL formulas
  - [ ] 10.3 Test static map URL builder
  - [ ] 10.4 Test filename sanitization logic

- [ ] Task 11: Integration Tests (AC: 3, 12, 14, 15)
  - [ ] 11.1 Test full API endpoint with valid request
  - [ ] 11.2 Verify PDF binary structure
  - [ ] 11.3 Test coverage validation (should return 400 if not covered)
  - [ ] 11.4 Test error handling for formula failures (should not fail entire PDF)

- [ ] Task 12: E2E Tests (AC: 1, 2, 3, 13, 16)
  - [ ] 12.1 Navigate to algorithm page, verify Print button exists
  - [ ] 12.2 Click Print button, verify modal opens
  - [ ] 12.3 Select location and date
  - [ ] 12.4 Toggle "Include Glossary" ON, generate PDF
  - [ ] 12.5 Verify download triggers, verify filename pattern
  - [ ] 12.6 Toggle "Include Glossary" OFF, generate PDF
  - [ ] 12.7 Verify smaller file size

- [ ] Task 13: Manual QA Testing (AC: 4, 5, 6, 7, 8, 9, 10, 11)
  - [ ] 13.1 Open generated PDF in Adobe Reader
  - [ ] 13.2 Verify publisher header section renders correctly
  - [ ] 13.3 Verify location section with map image
  - [ ] 13.4 Verify zmanim table with syntax highlighting
  - [ ] 13.5 Verify primitives glossary section
  - [ ] 13.6 Verify functions glossary section
  - [ ] 13.7 Verify footer on all pages
  - [ ] 13.8 Test in Chrome PDF viewer
  - [ ] 13.9 Test in macOS Preview.app
  - [ ] 13.10 Verify colors, fonts, and layout match design specs

## Dev Notes

### Architecture Patterns

- **PDF Library:** Use `github.com/johnfercher/maroto` (modern, supports tables, images, colors, gradients)
  - Alternative: HTML-to-PDF using `chromedp` (more flexible styling but slower)
  - Avoid: `gofpdf` (older, limited styling capabilities)

- **Static Map API:** Mapbox Static Images API
  - Example URL: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l-marker+FF0000({lng},{lat})/{lng},{lat},10/400x200?access_token={token}`
  - Free tier: 50,000 requests/month
  - Cache URLs to reduce API calls

- **DSL Parsing:** Reuse existing tokenizer/parser from `api/internal/dsl/`
  - Extract primitives: regex match or AST traversal
  - Extract functions: identify function calls in AST

- **Caching:** Redis cache with 1-hour TTL
  - Key format: `pdf:zmanim:{publisher_id}:{locality_id}:{date}:{glossary}`
  - Invalidate on publisher zmanim update

### API Endpoint

```go
// POST /api/v1/publisher/reports/zmanim-pdf
// Request body:
{
  "locality_id": 4993250,
  "date": "2025-12-22",
  "include_glossary": true
}

// Response: PDF binary stream
// Headers:
// Content-Type: application/pdf
// Content-Disposition: attachment; filename="MH_Zmanim_Jerusalem_Israel_2025-12-22.pdf"
```

### Frontend Download Logic

```tsx
const response = await api.post('/publisher/reports/zmanim-pdf', {
  locality_id: selectedLocation.id,
  date: selectedDate,
  include_glossary: includeGlossary,
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename; // From Content-Disposition header or construct client-side
a.click();
window.URL.revokeObjectURL(url);
```

### Primitive Reference Example

```go
type PrimitiveDoc struct {
    Name              string
    Definition        string
    CalculationMethod string
    ScientificSource  string
}

var PrimitivesReference = map[string]PrimitiveDoc{
    "sunrise": {
        Name:              "sunrise",
        Definition:        "The moment when the upper edge of the sun's disc crosses the horizon",
        CalculationMethod: "Calculated using NOAA Solar Position Algorithm based on location coordinates, date, and atmospheric refraction",
        ScientificSource:  "NOAA Solar Calculator, Jean Meeus 'Astronomical Algorithms'",
    },
    "solar": {
        Name:              "solar(angle)",
        Definition:        "The time when the sun is at a specific angle below or above the horizon",
        CalculationMethod: "Solves for the time when the sun's altitude equals the specified angle using the NOAA algorithm",
        ScientificSource:  "NOAA Solar Calculator",
    },
    // ... more primitives
}
```

### Function Reference Example

```go
type FunctionDoc struct {
    Name              string
    Purpose           string
    Syntax            string
    Parameters        []ParameterDoc
    Example           string
    ResultExplanation string
}

type ParameterDoc struct {
    Name         string
    Type         string
    Description  string
    ExampleValue string
}

var FunctionsReference = map[string]FunctionDoc{
    "coalesce": {
        Name:    "coalesce",
        Purpose: "Returns the first non-null value from a list of inputs",
        Syntax:  "coalesce(value1, value2, ...)",
        Parameters: []ParameterDoc{
            {
                Name:         "value1, value2, ...",
                Type:         "time",
                Description:  "Time values to evaluate in order",
                ExampleValue: "solar(-16.1), sunrise - 72min",
            },
        },
        Example:           "coalesce(solar(-16.1), sunrise - 72min)",
        ResultExplanation: "Returns the time when the sun is 16.1° below the horizon, or if that calculation fails (e.g., polar regions), returns 72 minutes before sunrise",
    },
    // ... more functions
}
```

### Error Handling

- **Timeout:** 30-second max for PDF generation (return 504 if exceeded)
- **Calculation Errors:** If zman calculation fails, show "Error" in that row (don't fail entire PDF)
- **Map API Failure:** Omit map image, show text-only location details
- **Logo URL Broken:** Use fallback icon
- **Coverage Validation:** Return 400 if location not covered by publisher

### Performance Optimization

- **Concurrent Calculation:** Calculate all zman times in parallel (use goroutines)
- **Image Optimization:** Compress map image before embedding
- **Font Subset:** Only embed characters used in document (reduce file size)
- **Caching:** Cache generated PDFs for 1 hour per unique request

### Prerequisites

- Story 11.5 (Algorithm Page exists with header for button placement)
- Mapbox API key configured in AWS SSM
- Existing DSL calculation engine functional
- Master zmanim registry populated with `formula_explanation` (from Story 11.0)

### References

- [Source: docs/epic-11-publisher-zmanim-registry.md#Story-11.6]
- [Mapbox Static Images API Documentation](https://docs.mapbox.com/api/maps/static-images/)
- [Maroto PDF Library](https://github.com/johnfercher/maroto)
- [NOAA Solar Calculator](https://www.esrl.noaa.gov/gmd/grad/solcalc/)

## Dev Agent Record

### Context Reference
- Story 11.0: Data Foundation & Integrity Audit (master registry documentation)
- Story 11.5: Algorithm Page Migration (button placement location)

### Agent Model Used
- (To be filled after implementation)

### Completion Notes List
- (To be filled after implementation)

### File List
- (To be filled after implementation)
