# Agent Prompt: PDF Report Redesign Implementation

Copy everything below this line and paste it to a new Claude Code session:

---

## Task: Implement Beautiful PDF Report Using HTML-to-PDF (chromedp)

You are implementing a redesign of the PDF report generation system for the Shtetl Zmanim platform. The current implementation uses Maroto (a Go PDF library) and produces ugly, unstyled output. You will replace it with an HTML-to-PDF approach using chromedp for beautiful, modern PDFs.

### Your Mission

Replace the Maroto-based PDF generation in `api/internal/services/pdf_report_service.go` with chromedp HTML-to-PDF rendering. The HTML template should match the gorgeous design in the visual mockup.

### Critical Files to Read First

**READ THESE FILES BEFORE STARTING:**

1. `docs/ux-pdf-report-mockup.html` - **THE TARGET DESIGN** - Open this in a browser to see exactly what the PDF should look like. This is your north star.

2. `docs/task-pdf-report-redesign.md` - Detailed technical requirements, code examples, and acceptance criteria.

3. `docs/ux-pdf-report-design-critique.md` - Color palette reference, category badge colors, and design specifications.

4. `api/internal/services/pdf_report_service.go` - Current implementation. Reuse the data structures and `fetchReportData` method. Replace `buildPDF` and all the `add*` methods.

### Implementation Steps

1. **Add chromedp dependency:**
   ```bash
   cd api && go get github.com/chromedp/chromedp
   ```

2. **Create `api/internal/services/pdf_html_template.go`:**
   - Convert the HTML mockup into a Go template
   - Use `html/template` for data injection
   - Include all CSS inline (fonts via Google Fonts import)
   - Handle conditionals (glossary sections, error states, missing map)

3. **Create `api/internal/services/pdf_syntax_highlight.go`:**
   - Function to parse DSL formulas and wrap tokens in styled spans
   - Primitives = blue, Functions = green, Numbers = orange, Operators = gray, References = purple

4. **Modify `api/internal/services/pdf_report_service.go`:**
   - Add chromedp imports
   - Replace `buildPDF` method to use chromedp
   - Remove Maroto imports and all `add*` methods
   - Keep `fetchReportData` and data structures unchanged

5. **Run `go build ./cmd/api`** to verify compilation

6. **Test the PDF generation** via the API endpoint

### Design Requirements Summary

- **Header:** Gradient background `linear-gradient(135deg, #4F46E5, #7C3AED)`, white text
- **Location:** Gray background, 2-column layout with map image
- **Date:** Visual card with Hebrew date
- **Table:** Alternating rows, error rows red, syntax-highlighted formulas, category badges
- **Glossary:** 2-column card grid
- **Footer:** Branding, disclaimer, page numbers on every page
- **Fonts:** Inter (body), JetBrains Mono (code), Frank Ruhl Libre (Hebrew)

### Category Badge Colors

| Category | Hex | Usage |
|----------|-----|-------|
| Alos | `#4F46E5` | Dawn times |
| Shema | `#3B82F6` | Morning prayers |
| Tefilla | `#06B6D4` | Zmanim |
| Chatzos | `#F59E0B` | Midday |
| Mincha | `#F97316` | Afternoon |
| Tzais | `#8B5CF6` | Nightfall |

### Syntax Highlighting Colors

| Token Type | Hex | Examples |
|------------|-----|----------|
| Primitive | `#3B82F6` | sunrise, sunset, solar_noon |
| Function | `#10B981` | solar(), proportional_hours() |
| Number | `#F59E0B` | 12, 72min, 16.1 |
| Operator | `#6B7280` | +, - |
| Reference | `#8B5CF6` | @alos_12, @tzais |

### Acceptance Criteria

Your implementation is complete when:

- [ ] PDF has gradient header (indigo → purple)
- [ ] Hebrew text renders correctly (not dots)
- [ ] Map image embedded (or placeholder)
- [ ] Alternating table row colors
- [ ] Error rows have red background
- [ ] DSL formulas have syntax highlighting
- [ ] Category badges with correct colors
- [ ] 2-column glossary cards (when enabled)
- [ ] Footer on every page with page numbers
- [ ] `go build ./cmd/api` succeeds
- [ ] PDF opens correctly in browser

### Important Notes

- Keep all existing data structures (`ZmanimReportData`, `ZmanReportRow`, etc.)
- Keep `fetchReportData` method unchanged
- Remove all Maroto code after migration
- The HTML mockup (`docs/ux-pdf-report-mockup.html`) is your source of truth for styling
- Use inline CSS in the template (no external stylesheets)
- chromedp requires Chrome - it will use system Chrome or download Chromium

### Getting Started

```bash
# Read the visual mockup first
cat docs/ux-pdf-report-mockup.html

# Read the task requirements
cat docs/task-pdf-report-redesign.md

# Read current implementation
cat api/internal/services/pdf_report_service.go

# Add dependency
cd api && go get github.com/chromedp/chromedp

# Start implementing!
```

Good luck! The end result should be a beautiful, professional PDF that publishers will be proud to share.
