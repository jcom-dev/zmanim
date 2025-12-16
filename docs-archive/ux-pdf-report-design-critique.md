# PDF Report Design Critique & Fix List

**Author:** Sally (UX Designer)
**Date:** December 22, 2025
**Related Epic:** Epic 11, Story 11.6
**Visual Mockup:** [ux-pdf-report-mockup.html](./ux-pdf-report-mockup.html)

---

## Executive Summary

The current PDF report implementation delivers functional output but fails to meet the design specifications in Story 11.6. The report looks like a generic document from 1995 - no colors, no visual hierarchy, broken Hebrew rendering, and missing the map entirely.

**Open the HTML mockup in your browser** to see exactly what the PDF should look like.

---

## Side-by-Side Comparison

| Aspect | Current Output | Target Design |
|--------|---------------|---------------|
| **Header** | Plain white, text only | Vibrant indigo→purple gradient with logo |
| **Map** | Missing entirely | Embedded Mapbox static map |
| **Hebrew Text** | Broken (shows dots) | Properly rendered with Frank Ruhl Libre font |
| **Table Rows** | All white, hard to scan | Alternating gray/white with hover states |
| **Category Badges** | None | Color-coded badges (Alos=indigo, Tzais=purple) |
| **Formula Styling** | Plain gray text | Syntax-highlighted (blue=primitives, green=functions) |
| **Section Backgrounds** | All white | Location section has gray background |
| **Error Rows** | Red text only | Full red background highlight |
| **Date Display** | Plain text | Visual date card with day/month |
| **Glossary** | Single column list | 2-column card grid |
| **Footer** | Basic page numbers | Branded footer with disclaimer |

---

## Critical Bugs

### 1. Hebrew Text Not Rendering
**Symptom:** Hebrew names show as "..... ......" dots
**Cause:** Maroto default fonts don't support Hebrew characters
**Fix:** Load a Hebrew-compatible font via `maroto.WithCustomFonts()`

```go
// Required: Add Hebrew font support
cfg := config.NewBuilder().
    WithCustomFonts([]*entity.CustomFont{
        {
            Family:   "FrankRuhl",
            Style:    fontstyle.Normal,
            File:     "fonts/FrankRuhlLibre-Regular.ttf",
        },
    }).
    Build()
```

### 2. Map Image Not Rendered
**Symptom:** Map is fetched (line 203-206) but never displayed
**Cause:** `data.MapImageData` is populated but `addLocationDetails()` doesn't use it
**Fix:** Add image rendering in location section

```go
// In addLocationDetails(), after timezone row:
if len(data.MapImageData) > 0 {
    m.AddRow(60,
        col.New(12).Add(
            image.NewFromBytes(data.MapImageData, extension.Png, props.Rect{
                Center: true,
                Percent: 80,
            }),
        ),
    )
}
```

### 3. No Visual Hierarchy
**Symptom:** All sections look identical
**Cause:** No background colors, no gradients, no section separation
**Fix:** Use Maroto's background color capabilities

---

## Required Changes in `pdf_report_service.go`

### Priority 1: Fix Hebrew Rendering
1. Download Frank Ruhl Libre font (Google Fonts, OFL license)
2. Add to `api/fonts/` directory
3. Register font in Maroto config
4. Use Hebrew font family for Hebrew text

### Priority 2: Add Gradient Header
```go
func (s *PDFReportService) addPublisherHeader(m core.Maroto, data *ZmanimReportData) {
    // Add colored background row
    m.AddRow(80,
        col.New(12).Add(
            // Background using Maroto's styling
        ),
    ).WithStyle(&props.Cell{
        BackgroundColor: &props.Color{Red: 79, Green: 70, Blue: 229},
    })
    // ... rest of header content
}
```

### Priority 3: Render Map Image
- Check if `data.MapImageData` has content
- Use `image.NewFromBytes()` to embed in PDF
- Position in location section, right column

### Priority 4: Add Alternating Row Colors
```go
for i, zman := range data.Zmanim {
    bgColor := &props.Color{Red: 255, Green: 255, Blue: 255} // White
    if i%2 == 1 {
        bgColor = &props.Color{Red: 249, Green: 250, Blue: 251} // Gray-50
    }
    if zman.HasError {
        bgColor = &props.Color{Red: 254, Green: 226, Blue: 226} // Error-100
    }

    m.AddRow(10,
        // ... columns
    ).WithStyle(&props.Cell{BackgroundColor: bgColor})
}
```

### Priority 5: Add Category Badges
```go
func getCategoryColor(category string) *props.Color {
    switch strings.ToLower(category) {
    case "alos":
        return &props.Color{Red: 79, Green: 70, Blue: 229}   // Indigo
    case "shema":
        return &props.Color{Red: 59, Green: 130, Blue: 246}  // Blue
    case "tefilla":
        return &props.Color{Red: 6, Green: 182, Blue: 212}   // Cyan
    case "chatzos":
        return &props.Color{Red: 245, Green: 158, Blue: 11}  // Amber
    case "mincha":
        return &props.Color{Red: 249, Green: 115, Blue: 22}  // Orange
    case "tzais":
        return &props.Color{Red: 139, Green: 92, Blue: 246}  // Purple
    default:
        return &props.Color{Red: 107, Green: 114, Blue: 128} // Gray
    }
}
```

### Priority 6: Syntax Highlighting for Formulas
- Parse DSL formula to identify tokens
- Apply different colors:
  - Primitives (sunrise, sunset, solar_noon): `#3B82F6` (blue)
  - Functions (solar, proportional_hours): `#10B981` (green)
  - Numbers (12, 72min): `#F59E0B` (orange)
  - Operators (+, -): `#6B7280` (gray)
  - References (@alos_12): `#8B5CF6` (purple)

---

## Color Palette Reference

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Primary-600 | `#4F46E5` | 79, 70, 229 | Header gradient start, primary actions |
| Accent-600 | `#7C3AED` | 124, 58, 237 | Header gradient end, references |
| Success-500 | `#10B981` | 16, 185, 129 | Verified badge, function syntax |
| Warning-500 | `#F59E0B` | 245, 158, 11 | Numbers in syntax, Chatzos category |
| Error-500 | `#EF4444` | 239, 68, 68 | Error times, error rows |
| Info-500 | `#3B82F6` | 59, 130, 246 | Primitives syntax, Shema category |
| Gray-900 | `#111827` | 17, 24, 57 | Main text, headers |
| Gray-600 | `#4B5563` | 75, 85, 99 | Secondary text |
| Gray-100 | `#F3F4F6` | 243, 244, 246 | Code backgrounds |
| Gray-50 | `#F9FAFB` | 249, 250, 251 | Alternating rows, section backgrounds |

---

## Alternative: HTML-to-PDF Approach

If Maroto proves too limiting for this design complexity, consider switching to HTML-to-PDF rendering using `chromedp`:

**Pros:**
- Full CSS control (gradients, custom fonts, complex layouts)
- Can use the HTML mockup as template
- Easier to maintain (HTML/CSS vs Go code)
- Better Hebrew text support

**Cons:**
- Requires headless Chrome dependency
- Slightly slower generation
- Additional infrastructure

```go
import "github.com/chromedp/chromedp"

func (s *PDFReportService) buildPDFViaChrome(data *ZmanimReportData) ([]byte, error) {
    // 1. Render HTML template with data
    html := s.renderHTMLTemplate(data)

    // 2. Create chromedp context
    ctx, cancel := chromedp.NewContext(context.Background())
    defer cancel()

    // 3. Print to PDF
    var pdfBytes []byte
    err := chromedp.Run(ctx,
        chromedp.Navigate("data:text/html,"+url.PathEscape(html)),
        chromedp.ActionFunc(func(ctx context.Context) error {
            var err error
            pdfBytes, _, err = page.PrintToPDF().
                WithPrintBackground(true).
                Do(ctx)
            return err
        }),
    )
    return pdfBytes, err
}
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Hebrew text renders correctly (not dots)
- [ ] Map image appears in location section
- [ ] Header has gradient background
- [ ] Table rows alternate colors
- [ ] Error rows have red background
- [ ] Category badges appear with correct colors
- [ ] Formulas have syntax highlighting
- [ ] Location section has gray background
- [ ] Date card displays prominently
- [ ] Glossary uses 2-column layout
- [ ] Footer appears on every page
- [ ] Page numbers are correct
- [ ] PDF opens in all readers (Chrome, Preview, Adobe)

---

## Files Modified

| File | Changes Needed |
|------|---------------|
| `api/internal/services/pdf_report_service.go` | All styling fixes |
| `api/fonts/` (new) | Hebrew font files |
| `api/go.mod` | May need chromedp if switching approach |

---

*This critique was prepared by Sally (UX Designer) to help developers implement Story 11.6 correctly. Open the HTML mockup to see the target design.*
