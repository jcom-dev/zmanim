# Task: Redesign PDF Report Using HTML-to-PDF (chromedp)

**Priority:** High
**Epic:** 11, Story 11.6
**Estimated Complexity:** Medium-High

---

## Objective

Replace the current Maroto-based PDF generation in `api/internal/services/pdf_report_service.go` with an HTML-to-PDF approach using chromedp. This will enable the beautiful, modern design specified in the visual mockup.

---

## Context & Background

The current PDF report implementation produces ugly, unstyled output:
- No gradient header (just plain white)
- Hebrew text renders as dots (font doesn't support Hebrew)
- Map image is fetched but never rendered
- No alternating row colors
- No syntax highlighting for DSL formulas
- No category badges
- Looks like a document from 1995

**Visual mockup (THE TARGET):** `docs/ux-pdf-report-mockup.html`
**Design critique document:** `docs/ux-pdf-report-design-critique.md`
**Current implementation:** `api/internal/services/pdf_report_service.go`

---

## Requirements

### 1. Add chromedp Dependency

```bash
cd api && go get github.com/chromedp/chromedp
```

### 2. Create HTML Template System

Create a new file `api/internal/services/pdf_html_template.go` that:

1. Contains the HTML/CSS template as a Go template string (based on `docs/ux-pdf-report-mockup.html`)
2. Uses `html/template` to inject data into placeholders
3. Handles:
   - Publisher info (name, description, logo URL, badges)
   - Location details (name, coordinates, elevation, timezone)
   - Map image (base64 encoded or URL)
   - Date info (formatted date, Hebrew date if available)
   - Sunrise/sunset times for context
   - Zmanim table rows with:
     - Hebrew name (RTL text)
     - English name
     - Calculated time (precise)
     - Rounded time
     - DSL formula with syntax highlighting
     - Explanation text
     - Category badge (color-coded)
     - Error state (red background if error)
   - Primitives glossary (if includeGlossary=true)
   - Functions glossary (if includeGlossary=true)
   - Footer with page numbers, branding, disclaimer

### 3. Implement Syntax Highlighting

Create a function to parse DSL formulas and wrap tokens in styled spans:

```go
func highlightDSLFormula(formula string) string {
    // Primitives (blue): sunrise, sunset, solar_noon, visible_sunrise, etc.
    // Functions (green): solar, proportional_hours, proportional_minutes, etc.
    // Numbers (orange): digits, "72min", "16.1", etc.
    // Operators (gray): +, -, *, /
    // References (purple): @alos_12, @tzais_72, etc.

    // Return HTML with <span class="primitive">, <span class="function">, etc.
}
```

### 4. Refactor buildPDF Method

Replace the current Maroto-based `buildPDF` method with chromedp:

```go
func (s *PDFReportService) buildPDF(data *ZmanimReportData, includeGlossary bool) ([]byte, error) {
    // 1. Render HTML template with data
    html, err := s.renderHTMLTemplate(data, includeGlossary)
    if err != nil {
        return nil, fmt.Errorf("render template: %w", err)
    }

    // 2. Create chromedp context with allocator options
    opts := append(chromedp.DefaultExecAllocatorOptions[:],
        chromedp.Flag("headless", true),
        chromedp.Flag("disable-gpu", true),
        chromedp.Flag("no-sandbox", true),
    )
    allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
    defer cancel()

    ctx, cancel := chromedp.NewContext(allocCtx)
    defer cancel()

    // 3. Set timeout
    ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    // 4. Navigate to data URL and print to PDF
    var pdfBytes []byte
    err = chromedp.Run(ctx,
        chromedp.Navigate("data:text/html;charset=utf-8,"+url.PathEscape(html)),
        chromedp.ActionFunc(func(ctx context.Context) error {
            var err error
            pdfBytes, _, err = page.PrintToPDF().
                WithPrintBackground(true).
                WithPreferCSSPageSize(true).
                WithMarginTop(0).
                WithMarginBottom(0).
                WithMarginLeft(0).
                WithMarginRight(0).
                Do(ctx)
            return err
        }),
    )
    if err != nil {
        return nil, fmt.Errorf("chromedp PDF generation: %w", err)
    }

    return pdfBytes, nil
}
```

### 5. Handle Map Image Embedding

The map image should be embedded as base64 in the HTML:

```go
func (s *PDFReportService) getMapImageBase64(data *ZmanimReportData) string {
    if len(data.MapImageData) == 0 {
        return "" // Will show placeholder in template
    }
    return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data.MapImageData)
}
```

### 6. CSS Requirements (from mockup)

The HTML template must include these visual elements:

**Header:**
- Gradient background: `linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)`
- White text, large publisher name (32px, bold)
- Badges for "Verified Publisher" and "Certified"
- Generated timestamp in corner

**Location Section:**
- Gray background (`#F9FAFB`)
- Icon + label + value layout for each field
- Map image on the right (or placeholder if unavailable)

**Date Section:**
- Visual date card with day/month
- Hebrew date display
- Sunrise/sunset times with icons

**Zmanim Table:**
- Dark header (`#1F2937`)
- Alternating row colors (white / `#F9FAFB`)
- Error rows: red background (`#FEE2E2`)
- Hebrew text: RTL, proper font
- Syntax-highlighted formulas in monospace
- Category badges with colors:
  - Alos: `#4F46E5` (indigo)
  - Shema: `#3B82F6` (blue)
  - Tefilla: `#06B6D4` (cyan)
  - Chatzos: `#F59E0B` (amber)
  - Mincha: `#F97316` (orange)
  - Tzais: `#8B5CF6` (purple)

**Glossary:**
- 2-column card grid
- Separate sections for Primitives and Functions
- Card styling with borders and shadows

**Footer:**
- Fixed at bottom of each page
- Shtetl Zmanim branding
- Disclaimer text
- Page numbers

### 7. Fonts

Include Google Fonts via CSS import:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Frank+Ruhl+Libre:wght@400;500;700&display=swap');
```

- `Inter` for body text
- `JetBrains Mono` for code/formulas
- `Frank Ruhl Libre` for Hebrew text

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `api/go.mod` | Modify | Add chromedp dependency |
| `api/internal/services/pdf_report_service.go` | Modify | Replace Maroto with chromedp |
| `api/internal/services/pdf_html_template.go` | Create | HTML template and rendering |
| `api/internal/services/pdf_syntax_highlight.go` | Create | DSL syntax highlighting |

---

## Testing

1. **Unit Tests:**
   - Test HTML template rendering with mock data
   - Test syntax highlighting function
   - Test map image base64 encoding

2. **Integration Tests:**
   - Generate PDF with all sections
   - Generate PDF without glossary
   - Generate PDF with error rows
   - Generate PDF without map (fallback)

3. **Manual QA:**
   - Open generated PDF in Chrome
   - Open in Preview.app (macOS)
   - Open in Adobe Acrobat
   - Verify Hebrew text renders correctly
   - Verify colors match mockup
   - Verify page breaks are clean

---

## Acceptance Criteria

- [ ] PDF header has gradient background (indigo → purple)
- [ ] Publisher name, description, and badges display correctly
- [ ] Map image is embedded in location section (or placeholder if unavailable)
- [ ] Hebrew text renders correctly (not dots or boxes)
- [ ] Date card displays prominently with Hebrew date
- [ ] Sunrise/sunset times shown for context
- [ ] Zmanim table has alternating row colors
- [ ] Error rows have red background
- [ ] DSL formulas have syntax highlighting
- [ ] Category badges display with correct colors
- [ ] Glossary displays in 2-column card grid (when enabled)
- [ ] Footer appears on every page with page numbers
- [ ] PDF generation completes in <10 seconds
- [ ] PDF file size is reasonable (<5MB)

---

## Reference Files

1. **Visual mockup:** `docs/ux-pdf-report-mockup.html` - THE TARGET DESIGN
2. **Design critique:** `docs/ux-pdf-report-design-critique.md` - Color palette, issues list
3. **Current implementation:** `api/internal/services/pdf_report_service.go` - Data structures to reuse
4. **Epic spec:** `docs/epic-11-publisher-zmanim-registry.md` - Story 11.6 requirements

---

## Notes

- The current `fetchReportData` method is fine - reuse it as-is
- The data structures (`ZmanimReportData`, `ZmanReportRow`, etc.) are correct - keep them
- Remove all Maroto-related code after migration is complete
- chromedp requires Chrome/Chromium to be installed on the server
- For production (EC2), ensure Chrome is installed: `sudo amazon-linux-extras install chromium`

---

*Task created by Sally (UX Designer) - December 22, 2025*
