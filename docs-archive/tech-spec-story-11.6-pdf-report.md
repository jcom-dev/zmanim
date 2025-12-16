# Technical Specification: Story 11.6 - Publisher Zmanim Report (PDF Export)

**Story:** 11.6
**Epic:** 11 - Publisher Zmanim Registry Interface
**Author:** BMad
**Date:** 2025-12-22
**Version:** 1.0
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack Selection](#technology-stack-selection)
3. [Architecture Overview](#architecture-overview)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [PDF Layout & Design](#pdf-layout--design)
7. [Primitives & Functions Documentation](#primitives--functions-documentation)
8. [Static Map Integration](#static-map-integration)
9. [Data Models & API Contracts](#data-models--api-contracts)
10. [Caching Strategy](#caching-strategy)
11. [Error Handling](#error-handling)
12. [Testing Strategy](#testing-strategy)
13. [Performance Targets](#performance-targets)
14. [Security Considerations](#security-considerations)
15. [Deployment & Rollout](#deployment--rollout)
16. [Appendix: Code Examples](#appendix-code-examples)

---

## Executive Summary

### Purpose
Create a trust-building PDF report that publishers can generate to share transparent, beautiful documentation of their zmanim calculations with end-users. The report explains every calculation step, includes maps, DSL formulas, and optional glossaries explaining primitives and functions.

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **PDF Library** | Maroto v2 | Modern, actively maintained (Dec 2025), excellent table/image support, Bootstrap-inspired layout system, significant performance improvements over v1 |
| **Static Maps** | Mapbox Static Images API | 50,000 free requests/month (vs Google's lower limits), excellent pricing ($5/1k after free tier), high-quality maps |
| **HTML-to-PDF** | ❌ Rejected | chromedp too resource-intensive for concurrent generation, slower than native library |
| **Caching** | Redis with 1-hour TTL | Reports rarely change within an hour, cache key includes all parameters |
| **File Delivery** | Direct binary stream | Simpler than S3 upload, immediate download, no storage costs |

### Success Metrics
- **Generation Time:** <10 seconds (p95)
- **File Size:** <5MB with glossaries, <2MB without
- **Concurrency:** Support 50 simultaneous PDF generations
- **Cache Hit Rate:** >60% in production (same publisher often requests same location/date)

---

## Technology Stack Selection

### Research Summary

**Comparison of Go PDF Libraries (2025):**

| Library | Status | Pros | Cons | Recommendation |
|---------|--------|------|------|----------------|
| **Maroto v2** | Active (latest: Dec 2025) | Modern API, tables, images, colors, performance, grid system | No native gradient support | ✅ **SELECTED** |
| **gofpdf** | Archived (2021) | Pure Go, no dependencies | No maintenance, complex API, poor table support | ❌ Reject |
| **wkhtmltopdf** | Unmaintained | - | Ancient, security issues, deprecated | ❌ Reject |
| **chromedp** | Active | Full HTML/CSS support, perfect rendering | High memory usage (100-200MB per instance), slow (3-5s) | ❌ Too expensive |

**Decision: Maroto v2** (`github.com/johnfercher/maroto/v2`)

**Justification:**
- Latest update: December 6, 2025 (actively maintained)
- Built-in table support (crucial for zmanim list)
- Image embedding (for logos, maps)
- Color customization (for vibrant design)
- Grid-based layout system (Bootstrap-inspired, 12-column)
- Performance: 10x faster than chromedp for structured documents
- Pure Go, minimal dependencies

**Sources:**
- [Maroto v2 Official Docs](https://maroto.io/)
- [LogRocket: Generating PDFs in Golang with Maroto](https://blog.logrocket.com/go-long-generating-pdfs-golang-maroto/)
- [Go PDF Library Comparison](https://cbednarski.com/notes/golang-pdf-libraries/)

### Static Maps API Selection

**Comparison:**

| Provider | Free Tier | Pricing After | Features |
|----------|-----------|---------------|----------|
| **Mapbox** | 50,000 requests/month | $5 per 1,000 | High quality, customizable styles, markers |
| **Google Maps** | ~10,000 requests/month | Higher pricing | Limited free tier, good quality |

**Decision: Mapbox Static Images API**

**Justification:**
- 5x more generous free tier (50k vs 10k)
- Better pricing after free tier ($5/1k)
- Excellent documentation
- Easy marker customization
- Modern, clean map styles

**Sources:**
- [Mapbox Pricing](https://www.mapbox.com/pricing)
- [Mapbox vs Google Maps Comparison](https://www.softkraft.co/mapbox-vs-google-maps/)
- [Static Images API Docs](https://docs.mapbox.com/api/maps/static-images/)

---

## Architecture Overview

### System Flow

```
┌─────────────┐
│  Publisher  │
│   Browser   │
└──────┬──────┘
       │ 1. Click "Print Report"
       │
       ▼
┌─────────────────────────────┐
│  Frontend (Next.js)         │
│  - ZmanimReportModal.tsx    │
│  - Location picker          │
│  - Date picker              │
│  - "Include Glossary" toggle│
└──────────┬──────────────────┘
           │ 2. POST /api/v1/publisher/reports/zmanim-pdf
           │    { locality_id, date, include_glossary }
           ▼
┌────────────────────────────────────────────┐
│  Backend (Go API)                          │
│  Handler: publisher_reports.go             │
│    ├─ 1. Resolve publisher (middleware)    │
│    ├─ 2. Validate coverage                 │
│    ├─ 3. Fetch data (SQLc queries)         │
│    │    ├─ Publisher info (logo, name)     │
│    │    ├─ Locality details (lat/long/tz)  │
│    │    └─ Publisher zmanim list           │
│    ├─ 4. Calculate all zman times          │
│    ├─ 5. Extract DSL primitives/functions  │
│    ├─ 6. Generate static map URL           │
│    └─ 7. Build PDF (pdf_generator.go)      │
└──────────┬─────────────────────────────────┘
           │
           ├─── Cache Check (Redis)
           │    Key: pdf:zmanim:{pub_id}:{loc_id}:{date}:{glossary}
           │    TTL: 1 hour
           │
           ├─── Mapbox API
           │    GET static map image (cached 24h)
           │
           └─── PDF Generation (Maroto v2)
                ├─ Section 1: Publisher Header
                ├─ Section 2: Location Details (with map)
                ├─ Section 3: Report Metadata (date, times)
                ├─ Section 4: Zmanim Table
                ├─ Section 5: Primitives Glossary (optional)
                └─ Section 6: Functions Glossary (optional)
                │
                ▼
           Binary PDF Stream
           │
           ▼
┌──────────────────┐
│  Browser         │
│  Downloads PDF   │
│  Filename:       │
│  MH_Zmanim_      │
│  Jerusalem_      │
│  2025-12-22.pdf  │
└──────────────────┘
```

### File Structure

```
api/
├── cmd/api/
│   └── main.go                              # Register new route
├── internal/
│   ├── handlers/
│   │   └── publisher_reports.go             # NEW: Report handler
│   ├── services/
│   │   └── pdf_generator.go                 # NEW: PDF generation service
│   ├── dsl/
│   │   ├── primitives_reference.go          # NEW: Primitive docs
│   │   └── functions_reference.go           # NEW: Function docs
│   └── db/
│       └── queries/
│           ├── publisher_reports.sql        # NEW: Report-specific queries
│           └── INDEX.md                     # UPDATE: Add new queries

web/
├── app/publisher/algorithm/
│   └── page.tsx                             # UPDATE: Add "Print Report" button
└── components/
    └── reports/
        └── ZmanimReportModal.tsx            # NEW: Report configuration modal
```

---

## Backend Implementation

### 1. API Endpoint

**Route:** `POST /api/v1/publisher/reports/zmanim-pdf`

**Handler:** `internal/handlers/publisher_reports.go`

```go
package handlers

import (
    "encoding/json"
    "net/http"
    "github.com/go-chi/chi/v5"
    "your-project/internal/services"
    "your-project/internal/middleware"
)

type PublisherReportsHandler struct {
    db              *db.Queries
    publisherResolver *middleware.PublisherResolver
    pdfGenerator    *services.PDFGenerator
    cache           *redis.Client
}

type GenerateZmanimReportRequest struct {
    LocalityID       int64  `json:"locality_id"`
    Date             string `json:"date"` // YYYY-MM-DD
    IncludeGlossary  bool   `json:"include_glossary"`
}

// GenerateZmanimReport handles PDF report generation
// 6-step handler pattern:
// 1. Resolve publisher
// 2. Parse and validate request
// 3. Check coverage
// 4. Check cache
// 5. Generate PDF
// 6. Respond with binary stream
func (h *PublisherReportsHandler) GenerateZmanimReport(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher (middleware injects publisher context)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return // MustResolve already sent error response
    }

    // Step 2: Parse request body
    var req GenerateZmanimReportRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondError(w, r, http.StatusBadRequest, "Invalid request body")
        return
    }

    // Step 3: Validate request
    if req.LocalityID == 0 {
        RespondError(w, r, http.StatusBadRequest, "locality_id is required")
        return
    }

    parsedDate, err := time.Parse("2006-01-02", req.Date)
    if err != nil {
        RespondError(w, r, http.StatusBadRequest, "Invalid date format (use YYYY-MM-DD)")
        return
    }

    // Step 4: Verify coverage
    hasCoverage, err := h.db.PublisherHasCoverage(ctx, db.PublisherHasCoverageParams{
        PublisherID: pc.Publisher.ID,
        LocalityID:  req.LocalityID,
    })
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "Failed to check coverage")
        return
    }
    if !hasCoverage {
        RespondError(w, r, http.StatusBadRequest,
            "Publisher does not cover this location")
        return
    }

    // Step 5: Check cache
    cacheKey := fmt.Sprintf("pdf:zmanim:%d:%d:%s:%t",
        pc.Publisher.ID, req.LocalityID, req.Date, req.IncludeGlossary)

    cachedPDF, err := h.cache.Get(ctx, cacheKey).Bytes()
    if err == nil && len(cachedPDF) > 0 {
        // Cache hit - return cached PDF
        h.respondWithPDF(w, r, cachedPDF, pc.Publisher.Name, req.LocalityID, req.Date)
        return
    }

    // Step 6: Generate PDF
    pdfBytes, err := h.pdfGenerator.GenerateZmanimReport(ctx, services.ZmanimReportParams{
        PublisherID:     pc.Publisher.ID,
        LocalityID:      req.LocalityID,
        Date:            parsedDate,
        IncludeGlossary: req.IncludeGlossary,
    })
    if err != nil {
        slog.Error("PDF generation failed", "error", err)
        RespondError(w, r, http.StatusInternalServerError, "Failed to generate PDF")
        return
    }

    // Cache the generated PDF (1 hour TTL)
    h.cache.Set(ctx, cacheKey, pdfBytes, 1*time.Hour)

    // Step 7: Respond with PDF
    h.respondWithPDF(w, r, pdfBytes, pc.Publisher.Name, req.LocalityID, req.Date)
}

func (h *PublisherReportsHandler) respondWithPDF(
    w http.ResponseWriter,
    r *http.Request,
    pdfBytes []byte,
    publisherName string,
    localityID int64,
    date string,
) {
    // Generate filename: MH_Zmanim_Jerusalem_Israel_2025-12-22.pdf
    locality, _ := h.db.GetLocality(r.Context(), localityID)
    filename := fmt.Sprintf("%s_zmanim_%s_%s.pdf",
        sanitizeFilename(publisherName),
        sanitizeFilename(locality.Name),
        date,
    )

    w.Header().Set("Content-Type", "application/pdf")
    w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
    w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))

    w.WriteHeader(http.StatusOK)
    w.Write(pdfBytes)
}

func sanitizeFilename(s string) string {
    // Replace spaces with underscores, remove special chars
    s = strings.ReplaceAll(s, " ", "_")
    s = regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(s, "")
    return s
}
```

### 2. PDF Generator Service

**File:** `internal/services/pdf_generator.go`

```go
package services

import (
    "context"
    "fmt"
    "time"
    "github.com/johnfercher/maroto/v2"
    "github.com/johnfercher/maroto/v2/pkg/components/col"
    "github.com/johnfercher/maroto/v2/pkg/components/image"
    "github.com/johnfercher/maroto/v2/pkg/components/row"
    "github.com/johnfercher/maroto/v2/pkg/components/text"
    "github.com/johnfercher/maroto/v2/pkg/config"
    "github.com/johnfercher/maroto/v2/pkg/core"
    "github.com/johnfercher/maroto/v2/pkg/props"
)

type PDFGenerator struct {
    db             *db.Queries
    calculator     *calculator.Calculator // Existing zmanim calculation engine
    mapboxAPIKey   string
    mapboxCache    *redis.Client
}

type ZmanimReportParams struct {
    PublisherID     int64
    LocalityID      int64
    Date            time.Time
    IncludeGlossary bool
}

type ZmanimReportData struct {
    Publisher    db.Publisher
    Locality     db.GeoLocality
    Date         time.Time
    Zmanim       []ZmanRow
    Primitives   []PrimitiveDoc
    Functions    []FunctionDoc
    MapImageURL  string
}

type ZmanRow struct {
    Name            string
    HebrewName      string
    CalculatedTime  time.Time
    DSLFormula      string
    Explanation     string
    RoundedTime     string
    HasError        bool
    ErrorMessage    string
}

func (g *PDFGenerator) GenerateZmanimReport(
    ctx context.Context,
    params ZmanimReportParams,
) ([]byte, error) {
    // 1. Fetch all required data
    data, err := g.fetchReportData(ctx, params)
    if err != nil {
        return nil, fmt.Errorf("fetch report data: %w", err)
    }

    // 2. Initialize Maroto PDF
    cfg := config.NewBuilder().
        WithPageSize(config.A4).
        WithMargins(20, 20, 20). // top, left, right (mm)
        Build()

    m := maroto.New(cfg)

    // 3. Build PDF sections
    g.addPublisherHeader(m, data)
    g.addLocationDetails(m, data)
    g.addReportMetadata(m, data)
    g.addZmanimTable(m, data)

    if params.IncludeGlossary {
        g.addPrimitivesGlossary(m, data)
        g.addFunctionsGlossary(m, data)
    }

    g.addFooter(m, data)

    // 4. Generate PDF bytes
    document, err := m.Generate()
    if err != nil {
        return nil, fmt.Errorf("generate PDF: %w", err)
    }

    return document.GetBytes(), nil
}

func (g *PDFGenerator) fetchReportData(
    ctx context.Context,
    params ZmanimReportParams,
) (*ZmanimReportData, error) {
    // Fetch publisher
    publisher, err := g.db.GetPublisher(ctx, params.PublisherID)
    if err != nil {
        return nil, fmt.Errorf("get publisher: %w", err)
    }

    // Fetch locality
    locality, err := g.db.GetLocality(ctx, params.LocalityID)
    if err != nil {
        return nil, fmt.Errorf("get locality: %w", err)
    }

    // Fetch publisher zmanim
    publisherZmanim, err := g.db.ListPublisherZmanimForReport(ctx,
        db.ListPublisherZmanimForReportParams{
            PublisherID: params.PublisherID,
        })
    if err != nil {
        return nil, fmt.Errorf("list publisher zmanim: %w", err)
    }

    // Calculate all zman times
    zmanimRows := make([]ZmanRow, 0, len(publisherZmanim))
    usedPrimitives := make(map[string]bool)
    usedFunctions := make(map[string]bool)

    for _, pz := range publisherZmanim {
        // Calculate zman time using existing calculator
        calcResult, err := g.calculator.Calculate(ctx, calculator.CalculateParams{
            Formula:    pz.FormulaDsl,
            Latitude:   locality.Latitude,
            Longitude:  locality.Longitude,
            Elevation:  locality.Elevation,
            Timezone:   locality.Timezone,
            Date:       params.Date,
        })

        var row ZmanRow
        if err != nil {
            row = ZmanRow{
                Name:         pz.EnglishName,
                HebrewName:   pz.HebrewName,
                DSLFormula:   pz.FormulaDsl,
                Explanation:  pz.Description.String,
                HasError:     true,
                ErrorMessage: err.Error(),
            }
        } else {
            row = ZmanRow{
                Name:           pz.EnglishName,
                HebrewName:     pz.HebrewName,
                CalculatedTime: calcResult.Time,
                DSLFormula:     pz.FormulaDsl,
                Explanation:    pz.Description.String,
                RoundedTime:    calcResult.Time.Format("3:04 PM"),
                HasError:       false,
            }
        }
        zmanimRows = append(zmanimRows, row)

        // Extract primitives and functions from formula
        tokens := g.parseFormula(pz.FormulaDsl)
        for _, token := range tokens {
            if token.IsPrimitive {
                usedPrimitives[token.Name] = true
            }
            if token.IsFunction {
                usedFunctions[token.Name] = true
            }
        }
    }

    // Build primitives documentation list
    primitiveDocs := make([]PrimitiveDoc, 0)
    for primName := range usedPrimitives {
        if doc, ok := dsl.PrimitivesReference[primName]; ok {
            primitiveDocs = append(primitiveDocs, doc)
        }
    }

    // Build functions documentation list
    functionDocs := make([]FunctionDoc, 0)
    for funcName := range usedFunctions {
        if doc, ok := dsl.FunctionsReference[funcName]; ok {
            functionDocs = append(functionDocs, doc)
        }
    }

    // Generate static map URL
    mapURL := g.generateMapURL(locality)

    return &ZmanimReportData{
        Publisher:   publisher,
        Locality:    locality,
        Date:        params.Date,
        Zmanim:      zmanimRows,
        Primitives:  primitiveDocs,
        Functions:   functionDocs,
        MapImageURL: mapURL,
    }, nil
}

// See Appendix for full PDF section implementations
```

### 3. SQLc Queries

**File:** `internal/db/queries/publisher_reports.sql`

```sql
-- name: GetPublisherForReport :one
SELECT
    id,
    name,
    logo_url,
    description,
    status
FROM publishers
WHERE id = $1
  AND deleted_at IS NULL;

-- name: ListPublisherZmanimForReport :many
SELECT
    pz.id,
    pz.zman_key,
    pz.hebrew_name,
    pz.english_name,
    pz.description,
    pz.formula_dsl,
    pz.master_zmanim_id,
    mzr.formula_explanation,
    mzr.category,
    mzr.shita
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mzr ON pz.master_zmanim_id = mzr.id
WHERE pz.publisher_id = $1
  AND pz.deleted_at IS NULL
ORDER BY pz.display_order ASC, pz.english_name ASC;

-- name: PublisherHasCoverage :one
SELECT EXISTS(
    SELECT 1
    FROM publisher_coverage pc
    WHERE pc.publisher_id = $1
      AND pc.locality_id = $2
      AND pc.deleted_at IS NULL
) AS has_coverage;
```

---

## Frontend Implementation

### 1. Algorithm Page Update

**File:** `web/app/publisher/algorithm/page.tsx`

```tsx
// Add to imports
import { ZmanimReportModal } from '@/components/reports/ZmanimReportModal';

// Add state
const [isReportModalOpen, setIsReportModalOpen] = useState(false);

// Add button in header (next to "Browse Registry")
<div className="flex gap-2">
  <Button
    variant="secondary"
    onClick={() => router.push('/publisher/registry')}
  >
    <BookOpenIcon className="w-4 h-4 mr-2" />
    Browse Registry
  </Button>

  <Button
    variant="outline"
    onClick={() => setIsReportModalOpen(true)}
  >
    <PrinterIcon className="w-4 h-4 mr-2" />
    Print Zmanim Report
  </Button>
</div>

// Add modal component
<ZmanimReportModal
  open={isReportModalOpen}
  onClose={() => setIsReportModalOpen(false)}
/>
```

### 2. Report Modal Component

**File:** `web/components/reports/ZmanimReportModal.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LocalitySearch } from '@/components/shared/LocalitySearch';
import { useApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface ZmanimReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ZmanimReportModal({ open, onClose }: ZmanimReportModalProps) {
  const api = useApi();
  const [selectedLocality, setSelectedLocality] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [includeGlossary, setIncludeGlossary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedLocality) {
      toast.error('Please select a location');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await api.post('/publisher/reports/zmanim-pdf', {
        locality_id: selectedLocality,
        date: selectedDate.toISOString().split('T')[0], // YYYY-MM-DD
        include_glossary: includeGlossary,
      }, {
        responseType: 'blob', // Important for binary data
      });

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'zmanim_report.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Zmanim report generated successfully');
      onClose();
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Zmanim Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Selector */}
          <div>
            <Label>Location</Label>
            <LocalitySearch
              value={selectedLocality}
              onChange={setSelectedLocality}
              placeholder="Search for a location..."
            />
          </div>

          {/* Date Picker */}
          <div>
            <Label>Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
            />
          </div>

          {/* Include Glossary Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Glossary</Label>
              <p className="text-sm text-muted-foreground">
                Add detailed explanations of primitives and functions
              </p>
            </div>
            <Switch
              checked={includeGlossary}
              onCheckedChange={setIncludeGlossary}
            />
          </div>

          {/* Preview Note */}
          <p className="text-sm text-muted-foreground">
            This will generate a PDF with all your published zmanim for the selected location and date.
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## PDF Layout & Design

### Color Palette

```go
// Color constants (RGB values for Maroto)
var (
    ColorPrimary    = color.RGBA{79, 70, 229, 255}    // Indigo #4F46E5
    ColorAccent     = color.RGBA{124, 58, 237, 255}   // Purple #7C3AED
    ColorSuccess    = color.RGBA{16, 185, 129, 255}   // Green #10B981
    ColorWarning    = color.RGBA{245, 158, 11, 255}   // Orange #F59E0B
    ColorError      = color.RGBA{239, 68, 68, 255}    // Red #EF4444
    ColorGray100    = color.RGBA{243, 244, 246, 255}  // #F3F4F6
    ColorGray700    = color.RGBA{55, 65, 81, 255}     // #374151
    ColorGray900    = color.RGBA{17, 24, 39, 255}     // #111827
)
```

### Section 1: Publisher Header

```go
func (g *PDFGenerator) addPublisherHeader(m core.Maroto, data *ZmanimReportData) {
    // Gradient background (simulate with colored rectangle)
    m.AddRow(50,
        col.New(12).Add(
            // Background rectangle with primary color
            rect.NewCol(12, 50, props.Rect{
                Percent: 100,
                Color:   ColorPrimary,
            }),
        ),
    )

    // Logo and publisher name on top of background
    m.AddRow(50,
        col.New(2).Add(
            image.NewFromFileCol(12, data.Publisher.LogoURL, props.Rect{
                Center:  true,
                Percent: 80,
            }),
        ),
        col.New(10).Add(
            text.NewCol(12, data.Publisher.Name, props.Text{
                Size:   24,
                Color:  color.RGBA{255, 255, 255, 255}, // White
                Style:  fontstyle.Bold,
                Align:  align.Left,
                Top:    10,
            }),
            text.NewCol(12, data.Publisher.Description.String, props.Text{
                Size:   12,
                Color:  color.RGBA{255, 255, 255, 200}, // Semi-transparent white
                Align:  align.Left,
                Top:    30,
            }),
        ),
    )

    // Timestamp
    m.AddRow(10,
        col.New(12).Add(
            text.NewCol(12,
                fmt.Sprintf("Generated on %s", time.Now().Format("Jan 2, 2006 at 3:04 PM MST")),
                props.Text{
                    Size:  8,
                    Color: ColorGray700,
                    Align: align.Right,
                },
            ),
        ),
    )

    m.AddRow(5) // Spacer
}
```

### Section 4: Zmanim Table

```go
func (g *PDFGenerator) addZmanimTable(m core.Maroto, data *ZmanimReportData) {
    // Section title
    m.AddRow(10,
        col.New(12).Add(
            text.NewCol(12, "Zmanim Calculations", props.Text{
                Size:  18,
                Style: fontstyle.Bold,
                Color: ColorGray900,
            }),
        ),
    )

    // Instruction text
    m.AddRow(8,
        col.New(12).Add(
            text.NewCol(12,
                "All times calculated using our DSL (Domain-Specific Language) formulas. See glossary below for detailed explanations.",
                props.Text{
                    Size:  9,
                    Color: ColorGray700,
                },
            ),
        ),
    )

    // Table header
    m.AddRow(10,
        col.New(3).Add(text.NewCol(12, "Zman Name", props.Text{
            Size: 10, Style: fontstyle.Bold, Color: ColorGray900,
        })),
        col.New(2).Add(text.NewCol(12, "Calculated Time", props.Text{
            Size: 10, Style: fontstyle.Bold, Color: ColorGray900,
        })),
        col.New(3).Add(text.NewCol(12, "DSL Formula", props.Text{
            Size: 10, Style: fontstyle.Bold, Color: ColorGray900,
        })),
        col.New(2).Add(text.NewCol(12, "Explanation", props.Text{
            Size: 10, Style: fontstyle.Bold, Color: ColorGray900,
        })),
        col.New(2).Add(text.NewCol(12, "Rounded Time", props.Text{
            Size: 10, Style: fontstyle.Bold, Color: ColorGray900,
        })),
    )

    // Table rows (alternating background colors)
    for i, zman := range data.Zmanim {
        bgColor := color.RGBA{255, 255, 255, 255} // White
        if i%2 == 1 {
            bgColor = ColorGray100 // Light gray
        }

        if zman.HasError {
            bgColor = color.RGBA{254, 226, 226, 255} // Light red
        }

        rowHeight := 15.0

        // Background rectangle
        m.AddRow(rowHeight,
            col.New(12).Add(
                rect.NewCol(12, rowHeight, props.Rect{
                    Percent: 100,
                    Color:   bgColor,
                }),
            ),
        )

        // Row content
        m.AddRow(rowHeight,
            col.New(3).Add(text.NewCol(12,
                fmt.Sprintf("%s - %s", zman.HebrewName, zman.Name),
                props.Text{Size: 9, Color: ColorGray900},
            )),
            col.New(2).Add(text.NewCol(12,
                getCalculatedTimeDisplay(zman),
                props.Text{Size: 9, Color: ColorGray900, Family: fontstyle.Courier},
            )),
            col.New(3).Add(text.NewCol(12, zman.DSLFormula, props.Text{
                Size: 8, Color: ColorPrimary, Family: fontstyle.Courier,
            })),
            col.New(2).Add(text.NewCol(12, zman.Explanation, props.Text{
                Size: 8, Color: ColorGray700,
            })),
            col.New(2).Add(text.NewCol(12, zman.RoundedTime, props.Text{
                Size: 9, Color: ColorGray900, Style: fontstyle.Bold,
            })),
        )
    }
}

func getCalculatedTimeDisplay(zman ZmanRow) string {
    if zman.HasError {
        return "Error"
    }
    return zman.CalculatedTime.Format("3:04:05 PM")
}
```

Full layout implementations in Appendix.

---

## Primitives & Functions Documentation

### Primitives Reference

**File:** `api/internal/dsl/primitives_reference.go`

```go
package dsl

type PrimitiveDoc struct {
    Name               string
    Definition         string
    CalculationMethod  string
    ScientificSource   string
    Icon               string // Emoji for visual representation
}

var PrimitivesReference = map[string]PrimitiveDoc{
    "visible_sunrise": {
        Name:       "visible_sunrise",
        Definition: "The moment when the upper limb (top edge) of the sun first appears above the horizon as seen by an observer. This accounts for atmospheric refraction which bends light.",
        CalculationMethod: "Calculated using NOAA Solar Position Algorithm with zenith angle 90.833° (accounting for 0.833° correction from atmospheric refraction ~0.567° + solar semi-diameter ~0.266°). Uses spherical trigonometry to determine when sun's center crosses the apparent horizon.",
        ScientificSource: "NOAA Solar Calculator (National Oceanic and Atmospheric Administration), Jean Meeus 'Astronomical Algorithms' (2nd edition, Willmann-Bell, 1998)",
        Icon: "🌅",
    },
    "visible_sunset": {
        Name:       "visible_sunset",
        Definition: "The moment when the last visible edge of the sun disappears below the horizon, accounting for atmospheric refraction.",
        CalculationMethod: "Same NOAA algorithm as visible_sunrise, calculating when the sun's upper limb reaches the western apparent horizon (zenith 90.833°).",
        ScientificSource: "NOAA Solar Calculator, US Naval Observatory Astronomical Applications Department",
        Icon: "🌄",
    },
    "geometric_sunrise": {
        Name:       "geometric_sunrise",
        Definition: "Theoretical moment when the geometric center of the sun crosses the geometric horizon (0° altitude), without corrections for atmospheric refraction.",
        CalculationMethod: "NOAA algorithm using zenith angle 90° (pure geometric horizon). Represents mathematical moment, not observed phenomenon. Occurs ~2-4 minutes after visible sunrise.",
        ScientificSource: "NOAA Solar Calculator, spherical astronomy principles",
        Icon: "🌅",
    },
    "geometric_sunset": {
        Name:       "geometric_sunset",
        Definition: "Theoretical moment when the geometric center of the sun crosses the geometric horizon in the evening, without refraction correction.",
        CalculationMethod: "NOAA algorithm with zenith 90°. Occurs ~2-3 minutes before visible sunset.",
        ScientificSource: "NOAA Solar Calculator",
        Icon: "🌄",
    },
    "solar_noon": {
        Name:       "solar_noon",
        Definition: "The moment when the sun crosses the local meridian and reaches its highest point in the sky. Shadows point exactly north/south at this instant.",
        CalculationMethod: "Calculated using Equation of Time (EoT) to correct from mean solar time to apparent solar time. Formula: noon_UTC = 720 - 4×longitude - EoT (minutes from midnight). EoT accounts for Earth's elliptical orbit and axial tilt.",
        ScientificSource: "NOAA Solar Calculator, Equation of Time derivation from Meeus",
        Icon: "☀️",
    },
    "solar_midnight": {
        Name:       "solar_midnight",
        Definition: "The moment when the sun is at its lowest point, directly opposite to its noon position (anti-transit). Sun is on opposite side of Earth.",
        CalculationMethod: "Calculated as 12 hours after solar noon, with minor adjustment for changing Equation of Time during the 12-hour period.",
        ScientificSource: "Spherical astronomy principles",
        Icon: "🌙",
    },
    "civil_dawn": {
        Name:       "civil_dawn",
        Definition: "When the sun's center is 6° below the horizon. Enough natural light for most outdoor activities without artificial lighting. Horizon clearly visible.",
        CalculationMethod: "NOAA algorithm with zenith angle 96° (90° + 6°). Includes elevation adjustment for extended horizon.",
        ScientificSource: "US Naval Observatory twilight definitions, FAA aviation regulations",
        Icon: "🌆",
    },
    "civil_dusk": {
        Name:       "civil_dusk",
        Definition: "When the sun is 6° below the horizon in evening. After this point, artificial lighting becomes necessary.",
        CalculationMethod: "NOAA algorithm, zenith 96° for evening.",
        ScientificSource: "USNO, International Earth Rotation Service (IERS)",
        Icon: "🌇",
    },
    "nautical_dawn": {
        Name:       "nautical_dawn",
        Definition: "When the sun is 12° below the horizon. The horizon becomes visible at sea, allowing sailors to take star sightings while seeing the horizon line.",
        CalculationMethod: "NOAA algorithm, zenith 102° (90° + 12°).",
        ScientificSource: "Nautical Almanac Office, maritime navigation standards",
        Icon: "⛵",
    },
    "nautical_dusk": {
        Name:       "nautical_dusk",
        Definition: "When the sun is 12° below the horizon in evening. Horizon at sea becomes indistinguishable from sky.",
        CalculationMethod: "NOAA algorithm, zenith 102° for evening.",
        ScientificSource: "US Naval Observatory",
        Icon: "🌊",
    },
    "astronomical_dawn": {
        Name:       "astronomical_dawn",
        Definition: "When the sun is 18° below the horizon. Before this, the sky is completely dark (no moon/light pollution). Earliest faint glow on eastern horizon.",
        CalculationMethod: "NOAA algorithm, zenith 108° (90° + 18°). Represents boundary between astronomical night and twilight.",
        ScientificSource: "NOAA, USNO, KosherJava Zmanim Library",
        Icon: "🌌",
    },
    "astronomical_dusk": {
        Name:       "astronomical_dusk",
        Definition: "When the sun is 18° below the horizon in evening. After this, the sky is completely dark for astronomical observations.",
        CalculationMethod: "NOAA algorithm, zenith 108° for evening.",
        ScientificSource: "USNO, astronomical observatories worldwide",
        Icon: "⭐",
    },
}
```

### Functions Reference

**File:** `api/internal/dsl/functions_reference.go`

```go
package dsl

type ParameterDoc struct {
    Name         string
    Type         string
    Description  string
    ExampleValue string
}

type FunctionDoc struct {
    Name              string
    Purpose           string
    Syntax            string
    Parameters        []ParameterDoc
    ExampleUsage      string
    ResultExplanation string
    Icon              string
}

var FunctionsReference = map[string]FunctionDoc{
    "solar": {
        Name:    "solar",
        Purpose: "Returns the time when the sun reaches a specific angle below or above the horizon in a specified direction.",
        Syntax:  "solar(angle, direction)",
        Parameters: []ParameterDoc{
            {
                Name:         "angle",
                Type:         "number (decimal)",
                Description:  "Solar depression angle in degrees. Positive values are below the horizon (dawn/dusk), negative values are above the horizon (rare).",
                ExampleValue: "16.1 (for Alos HaShachar per many opinions)",
            },
            {
                Name:         "direction",
                Type:         "direction keyword",
                Description:  "Specifies when to calculate the angle: before_visible_sunrise, after_visible_sunrise, before_visible_sunset, after_visible_sunset, before_geometric_sunrise, after_geometric_sunrise, before_geometric_sunset, after_geometric_sunset, before_noon, after_noon",
                ExampleValue: "before_visible_sunrise",
            },
        },
        ExampleUsage:      "solar(16.1, before_visible_sunrise)",
        ResultExplanation: "Returns the time when the sun is 16.1° below the horizon in the morning (before sunrise). This is commonly used for Alos HaShachar (dawn).",
        Icon:              "📐",
    },

    "seasonal_solar": {
        Name:    "seasonal_solar",
        Purpose: "Calculates twilight times using proportional scaling based on equinox offset. Used by Rabbi Ovadia Yosef and Zemaneh-Yosef methodology.",
        Syntax:  "seasonal_solar(angle, direction)",
        Parameters: []ParameterDoc{
            {
                Name:         "angle",
                Type:         "number (decimal)",
                Description:  "Reference angle at equinox in degrees.",
                ExampleValue: "16.1",
            },
            {
                Name:         "direction",
                Type:         "direction keyword",
                Description:  "Same as solar() function.",
                ExampleValue: "before_visible_sunrise",
            },
        },
        ExampleUsage:      "seasonal_solar(16.1, before_visible_sunrise)",
        ResultExplanation: "Calculates equinox offset (sunrise - solar(16.1) at equinox), then scales by day length ratio. More lenient than fixed-angle method in winter, stricter in summer.",
        Icon:              "🌍",
    },

    "proportional_hours": {
        Name:    "proportional_hours",
        Purpose: "Divides the halachic day into 12 proportional hours (shaos zmaniyos) and returns a time offset from the start of the day.",
        Syntax:  "proportional_hours(hours, base)",
        Parameters: []ParameterDoc{
            {
                Name:         "hours",
                Type:         "number (decimal)",
                Description:  "Number of proportional hours from start of halachic day. Can include fractions (e.g., 3.5 for 3½ hours).",
                ExampleValue: "3 (for Sof Zman Shema GRA)",
            },
            {
                Name:         "base",
                Type:         "base keyword",
                Description:  "Defines the boundaries of the halachic day: gra (sunrise to sunset), mga (72 min before sunrise to 72 min after sunset), mga_16_1 (16.1° to 16.1°), mga_18 (18° to 18°), baal_hatanya (1.583° to 1.583°), custom(start, end)",
                ExampleValue: "gra",
            },
        },
        ExampleUsage:      "proportional_hours(3, gra)",
        ResultExplanation: "Returns the time that is 3/12 (1/4) of the day after sunrise (GRA day = sunrise to sunset). This is Sof Zman Shema according to the GRA.",
        Icon:              "⏰",
    },

    "proportional_minutes": {
        Name:    "proportional_minutes",
        Purpose: "Similar to proportional_hours but uses proportional minutes before/after sunrise/sunset. Used for calculating offset-based zmanim.",
        Syntax:  "proportional_minutes(minutes, direction, base)",
        Parameters: []ParameterDoc{
            {
                Name:         "minutes",
                Type:         "number (decimal)",
                Description:  "Number of proportional minutes as a fraction of the day length.",
                ExampleValue: "72",
            },
            {
                Name:         "direction",
                Type:         "direction keyword",
                Description:  "before_visible_sunrise, after_visible_sunset, etc.",
                ExampleValue: "before_visible_sunrise",
            },
            {
                Name:         "base",
                Type:         "base keyword",
                Description:  "Day definition (gra, mga, etc.)",
                ExampleValue: "gra",
            },
        },
        ExampleUsage:      "proportional_minutes(72, before_visible_sunrise, gra)",
        ResultExplanation: "Returns the time that is 72 zmaniyos minutes (1/10 of GRA day) before sunrise. Used for MGA 72 zmaniyos variant.",
        Icon:              "⏱️",
    },

    "midpoint": {
        Name:    "midpoint",
        Purpose: "Returns the midpoint (average) time between two zmanim.",
        Syntax:  "midpoint(time1, time2)",
        Parameters: []ParameterDoc{
            {
                Name:         "time1",
                Type:         "time expression",
                Description:  "First time (primitive, function result, or reference).",
                ExampleValue: "visible_sunset",
            },
            {
                Name:         "time2",
                Type:         "time expression",
                Description:  "Second time.",
                ExampleValue: "astronomical_dusk",
            },
        },
        ExampleUsage:      "midpoint(visible_sunset, astronomical_dusk)",
        ResultExplanation: "Returns the time exactly halfway between sunset and tzeis (18°). Used for some opinions on bein hashmashos.",
        Icon:              "↔️",
    },

    "first_valid": {
        Name:    "first_valid",
        Purpose: "Returns the first non-null value from a list of time expressions. Used for fallback calculations at extreme latitudes.",
        Syntax:  "first_valid(time1, time2, ...)",
        Parameters: []ParameterDoc{
            {
                Name:         "time1, time2, ...",
                Type:         "time expression (variadic)",
                Description:  "List of time expressions. Evaluated left to right until a valid (non-null) result is found.",
                ExampleValue: "solar(16.1, before_visible_sunrise), visible_sunrise - 72min",
            },
        },
        ExampleUsage:      "first_valid(solar(16.1, before_visible_sunrise), visible_sunrise - 72min)",
        ResultExplanation: "If solar(16.1) is calculable, returns that. Otherwise (e.g., white nights at high latitudes), falls back to fixed 72-minute offset.",
        Icon:              "🔄",
    },

    "earlier_of": {
        Name:    "earlier_of",
        Purpose: "Returns the earlier of two zmanim.",
        Syntax:  "earlier_of(time1, time2)",
        Parameters: []ParameterDoc{
            {
                Name:         "time1",
                Type:         "time expression",
                Description:  "First time to compare.",
                ExampleValue: "solar(8.5, after_visible_sunset)",
            },
            {
                Name:         "time2",
                Type:         "time expression",
                Description:  "Second time to compare.",
                ExampleValue: "visible_sunset + 50min",
            },
        },
        ExampleUsage:      "earlier_of(solar(8.5, after_visible_sunset), visible_sunset + 50min)",
        ResultExplanation: "Returns whichever time comes first. Useful for stringent (machmir) opinions.",
        Icon:              "⬅️",
    },

    "later_of": {
        Name:    "later_of",
        Purpose: "Returns the later of two zmanim.",
        Syntax:  "later_of(time1, time2)",
        Parameters: []ParameterDoc{
            {
                Name:         "time1",
                Type:         "time expression",
                Description:  "First time to compare.",
                ExampleValue: "solar(8.5, after_visible_sunset)",
            },
            {
                Name:         "time2",
                Type:         "time expression",
                Description:  "Second time to compare.",
                ExampleValue: "visible_sunset + 30min",
            },
        },
        ExampleUsage:      "later_of(solar(8.5, after_visible_sunset), visible_sunset + 30min)",
        ResultExplanation: "Returns whichever time comes last. Useful for lenient (meikil) opinions or ensuring a minimum waiting period.",
        Icon:              "➡️",
    },
}
```

---

## Static Map Integration

### Mapbox Static Images API

**Setup:**

1. **Sign up:** [Mapbox Account](https://account.mapbox.com/auth/signup/)
2. **Get API key:** Create access token with `styles:tiles` scope
3. **Store secret:** AWS SSM Parameter Store `/zmanim/prod/mapbox-api-key`

**URL Generation:**

```go
func (g *PDFGenerator) generateMapURL(locality db.GeoLocality) string {
    // Format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}{@2x}?access_token={access_token}

    // Check cache first
    cacheKey := fmt.Sprintf("map:static:%f:%f", locality.Longitude, locality.Latitude)
    cachedURL, err := g.mapboxCache.Get(context.Background(), cacheKey).Result()
    if err == nil && cachedURL != "" {
        return cachedURL
    }

    // Generate new URL
    mapURL := fmt.Sprintf(
        "https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l-marker+FF0000(%f,%f)/%f,%f,10/400x200@2x?access_token=%s",
        locality.Longitude,
        locality.Latitude,
        locality.Longitude,
        locality.Latitude,
        g.mapboxAPIKey,
    )

    // Cache for 24 hours (maps rarely change)
    g.mapboxCache.Set(context.Background(), cacheKey, mapURL, 24*time.Hour)

    return mapURL
}
```

**Map Parameters:**
- **Style:** `streets-v11` (clean, modern street map)
- **Marker:** `pin-l-marker+FF0000` (large red pin)
- **Zoom:** `10` (city-level view)
- **Size:** `400x200@2x` (800x400 actual pixels for retina displays)
- **Coordinates:** `{lon},{lat}` (centerpoint)

**Fallback Strategy:**

```go
func (g *PDFGenerator) fetchMapImage(mapURL string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    resp, err := http.Get(mapURL)
    if err != nil || resp.StatusCode != 200 {
        // Fallback: return nil (PDF will omit map section gracefully)
        return nil, fmt.Errorf("map fetch failed: %w", err)
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}
```

---

## Data Models & API Contracts

### Request

```json
{
  "locality_id": 4993250,
  "date": "2025-12-22",
  "include_glossary": true
}
```

### Response

**Content-Type:** `application/pdf`
**Content-Disposition:** `attachment; filename="MH_Zmanim_Jerusalem_Israel_2025-12-22.pdf"`
**Body:** Binary PDF stream

### Error Responses

```json
// 400 Bad Request
{
  "error": "Publisher does not cover this location"
}

// 500 Internal Server Error
{
  "error": "Failed to generate PDF"
}
```

---

## Caching Strategy

### Cache Layers

| Layer | Key | TTL | Purpose |
|-------|-----|-----|---------|
| **Generated PDFs** | `pdf:zmanim:{pub_id}:{loc_id}:{date}:{glossary}` | 1 hour | Full PDF documents |
| **Static Maps** | `map:static:{lon}:{lat}` | 24 hours | Map image URLs |
| **Locality Data** | `locality:{id}` | 24 hours | Locality metadata |

### Cache Hit Scenarios

**Common Case:**
Publisher generates report for Jerusalem on 2025-12-22 → caches for 1 hour → Publisher regenerates same report 10 minutes later → **cache hit** (instant response)

**Expected Hit Rate:** 60-70% in production (publishers often regenerate for same location/date)

### Cache Invalidation

```go
// When publisher updates their zmanim, clear all their cached PDFs
func InvalidatePublisherReportCache(publisherID int64, cache *redis.Client) error {
    pattern := fmt.Sprintf("pdf:zmanim:%d:*", publisherID)
    iter := cache.Scan(0, pattern, 0).Iterator()

    for iter.Next() {
        cache.Del(iter.Val())
    }

    return iter.Err()
}
```

---

## Error Handling

### Graceful Degradation

| Failure | Handling Strategy | User Impact |
|---------|------------------|-------------|
| **Map API fails** | Omit map section, show text-only location details | Report still generates, slightly less visual |
| **Logo URL broken** | Use fallback publisher icon (📊) | Report still generates with default icon |
| **Zman calculation error** | Show "Error" in table row, highlight in red | Report includes error details, doesn't fail completely |
| **Master zman documentation missing** | Use publisher's description only | Report generates, glossary may be incomplete |
| **Cache failure** | Generate fresh, skip caching | Slower response, but still succeeds |

### Timeout Strategy

```go
func (g *PDFGenerator) GenerateZmanimReport(ctx context.Context, params ZmanimReportParams) ([]byte, error) {
    // Enforce 30-second total timeout
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()

    // ... generation logic with context propagation
}
```

---

## Testing Strategy

### Unit Tests

```go
// Test PDF generation with mock data
func TestPDFGenerator_GenerateZmanimReport(t *testing.T) {
    mockData := &ZmanimReportData{
        Publisher: mockPublisher(),
        Locality:  mockLocality(),
        Zmanim:    mockZmanim(10),
    }

    generator := &PDFGenerator{...}
    pdfBytes, err := generator.buildPDF(mockData, true)

    assert.NoError(t, err)
    assert.Greater(t, len(pdfBytes), 1000) // Reasonable PDF size

    // Verify PDF structure (basic)
    assert.True(t, bytes.Contains(pdfBytes, []byte("%PDF")))
}
```

### Integration Tests

```go
// Test full API endpoint
func TestGenerateZmanimReportEndpoint(t *testing.T) {
    req := httptest.NewRequest("POST", "/api/v1/publisher/reports/zmanim-pdf",
        strings.NewReader(`{"locality_id": 4993250, "date": "2025-12-22", "include_glossary": true}`))
    req.Header.Set("Authorization", "Bearer "+testPublisherToken)

    rr := httptest.NewRecorder()
    handler.ServeHTTP(rr, req)

    assert.Equal(t, http.StatusOK, rr.Code)
    assert.Equal(t, "application/pdf", rr.Header().Get("Content-Type"))
    assert.Contains(t, rr.Header().Get("Content-Disposition"), "attachment")
}
```

### E2E Tests (Playwright)

```typescript
test('Generate PDF report with glossary', async ({ page }) => {
  await page.goto('/publisher/algorithm');
  await page.click('button:has-text("Print Zmanim Report")');

  // Select location
  await page.fill('[placeholder="Search for a location..."]', 'Jerusalem');
  await page.click('text=Jerusalem, Israel');

  // Select date
  await page.click('button:has-text("25")'); // 25th of current month

  // Verify glossary toggle is ON
  await expect(page.locator('input[type="checkbox"][role="switch"]')).toBeChecked();

  // Generate PDF
  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Generate PDF")');
  const download = await downloadPromise;

  // Verify filename pattern
  expect(download.suggestedFilename()).toMatch(/^.+_zmanim_.+_\d{4}-\d{2}-\d{2}\.pdf$/);

  // Save and verify file size
  const path = await download.path();
  const stat = fs.statSync(path);
  expect(stat.size).toBeGreaterThan(50000); // >50KB
  expect(stat.size).toBeLessThan(5000000); // <5MB
});
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **PDF Generation Time** | <10s (p95) | Time from API request to response |
| **File Size (with glossary)** | <5MB | Binary PDF size |
| **File Size (without glossary)** | <2MB | Binary PDF size |
| **Concurrent Generations** | 50 simultaneous | Load test with Apache Bench |
| **Cache Hit Rate** | >60% | Redis cache hit metrics |
| **Map Fetch Time** | <2s | HTTP request to Mapbox |

### Performance Optimizations

1. **Concurrent Calculations:** Calculate all zman times in parallel using goroutines
2. **Image Caching:** Cache Mapbox static map URLs (24h TTL)
3. **Font Embedding:** Embed fonts once, reuse across PDFs
4. **Lazy Loading:** Only load master zman documentation if glossary enabled

---

## Security Considerations

### Input Validation

```go
// Validate date range (prevent DOS with extreme dates)
if parsedDate.Before(time.Now().AddDate(-10, 0, 0)) ||
   parsedDate.After(time.Now().AddDate(10, 0, 0)) {
    RespondError(w, r, http.StatusBadRequest, "Date must be within 10 years of today")
    return
}

// Validate locality_id exists and is valid
locality, err := h.db.GetLocality(ctx, req.LocalityID)
if err != nil {
    RespondError(w, r, http.StatusBadRequest, "Invalid locality_id")
    return
}
```

### Rate Limiting

```go
// Middleware: Limit to 10 PDF generations per minute per publisher
rateLimiter := middleware.NewRateLimiter(10, time.Minute)
router.Use(rateLimiter.Middleware())
```

### API Key Security

```go
// Load Mapbox API key from AWS SSM (never hardcode)
func loadMapboxAPIKey() string {
    ssm := ssm.New(session.New())
    param, err := ssm.GetParameter(&ssm.GetParameterInput{
        Name:           aws.String("/zmanim/prod/mapbox-api-key"),
        WithDecryption: aws.Bool(true),
    })
    if err != nil {
        panic("Failed to load Mapbox API key from SSM")
    }
    return *param.Parameter.Value
}
```

---

## Deployment & Rollout

### Phase 1: Development (Week 1)

- [ ] Implement backend PDF generator service
- [ ] Implement API endpoint with coverage validation
- [ ] Create primitives & functions reference data
- [ ] Integrate Mapbox static maps API
- [ ] Write unit tests (services, handlers)

### Phase 2: Frontend & Testing (Week 2)

- [ ] Implement `ZmanimReportModal` component
- [ ] Update algorithm page with "Print Report" button
- [ ] Write integration tests (API endpoint)
- [ ] Write E2E tests (Playwright)
- [ ] Manual QA: Generate PDFs, test across devices

### Phase 3: Staging Deployment (Week 3)

- [ ] Deploy to staging environment
- [ ] Load test: 50 concurrent PDF generations
- [ ] Verify caching works (Redis)
- [ ] Verify Mapbox API integration (free tier usage)
- [ ] Test error scenarios (map API failure, invalid dates)

### Phase 4: Production Rollout (Week 4)

- [ ] Deploy to production (backend + frontend)
- [ ] Monitor PDF generation times (p95 target: <10s)
- [ ] Monitor cache hit rate (target: >60%)
- [ ] Monitor Mapbox API usage (stay under 50k/month free tier)
- [ ] Collect user feedback

### Monitoring Metrics

```go
// Prometheus metrics
pdfGenerationDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
    Name:    "pdf_generation_duration_seconds",
    Help:    "PDF generation duration in seconds",
    Buckets: prometheus.DefBuckets,
})

pdfCacheHits := prometheus.NewCounter(prometheus.CounterOpts{
    Name: "pdf_cache_hits_total",
    Help: "Total number of PDF cache hits",
})

pdfCacheMisses := prometheus.NewCounter(prometheus.CounterOpts{
    Name: "pdf_cache_misses_total",
    Help: "Total number of PDF cache misses",
})
```

---

## Appendix: Code Examples

### Full Primitives Glossary Section

```go
func (g *PDFGenerator) addPrimitivesGlossary(m core.Maroto, data *ZmanimReportData) {
    m.AddRow(15,
        col.New(12).Add(
            text.NewCol(12, "Glossary: Primitives", props.Text{
                Size:  18,
                Style: fontstyle.Bold,
                Color: ColorGray900,
            }),
        ),
    )

    m.AddRow(8,
        col.New(12).Add(
            text.NewCol(12,
                "Primitives are foundational astronomical events used in zmanim calculations.",
                props.Text{Size: 9, Color: ColorGray700},
            ),
        ),
    )

    // Two-column layout for primitive cards
    for i := 0; i < len(data.Primitives); i += 2 {
        leftPrim := data.Primitives[i]
        var rightPrim *PrimitiveDoc
        if i+1 < len(data.Primitives) {
            rightPrim = &data.Primitives[i+1]
        }

        g.addPrimitiveCardRow(m, leftPrim, rightPrim)
    }
}

func (g *PDFGenerator) addPrimitiveCardRow(m core.Maroto, left PrimitiveDoc, right *PrimitiveDoc) {
    cardHeight := 40.0

    // Left card
    m.AddRow(cardHeight,
        col.New(6).Add(
            // Card background
            rect.NewCol(12, cardHeight, props.Rect{
                Percent: 100,
                Color:   ColorGray100,
                Style:   borderstyle.Solid,
                Width:   0.5,
            }),
            // Icon + Primitive name
            text.NewCol(12, fmt.Sprintf("%s %s", left.Icon, left.Name), props.Text{
                Size:  11,
                Style: fontstyle.Bold,
                Color: ColorPrimary,
                Top:   2,
                Left:  2,
            }),
            // Definition
            text.NewCol(12, left.Definition, props.Text{
                Size:  8,
                Color: ColorGray900,
                Top:   8,
                Left:  2,
            }),
            // Calculation method
            text.NewCol(12, fmt.Sprintf("Calculation: %s", left.CalculationMethod), props.Text{
                Size:  7,
                Color: ColorGray700,
                Top:   20,
                Left:  2,
            }),
            // Scientific source (italics simulation)
            text.NewCol(12, fmt.Sprintf("Source: %s", left.ScientificSource), props.Text{
                Size:  7,
                Color: ColorGray600,
                Top:   30,
                Left:  2,
                Style: fontstyle.Italic,
            }),
        ),
        // Right card (if exists)
        col.New(6).Add(
            // Similar structure for right card
            // ...
        ),
    )
}
```

---

## Summary: Technology Choices

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **PDF Generation** | Maroto v2 | Modern, actively maintained (Dec 2025), excellent table support, Bootstrap grid system |
| **Static Maps** | Mapbox Static Images API | 50k free/month, great pricing, high quality |
| **Caching** | Redis | Fast, supports TTL, existing infrastructure |
| **File Delivery** | Binary stream | Simpler than S3, immediate download |
| **Error Handling** | Graceful degradation | Report always generates even if map fails |

---

## Next Steps

1. ✅ Review and approve this tech spec
2. 🔲 Set up Mapbox account and API key
3. 🔲 Add Mapbox API key to AWS SSM
4. 🔲 Implement backend service (`pdf_generator.go`)
5. 🔲 Implement API endpoint (`publisher_reports.go`)
6. 🔲 Create primitives/functions reference data
7. 🔲 Implement frontend modal
8. 🔲 Write tests (unit, integration, E2E)
9. 🔲 Deploy to staging
10. 🔲 Production rollout

**Estimated Effort:** 8 story points (2 weeks for 1 developer)

---

**Sources:**
- [Maroto v2 Official Docs](https://maroto.io/)
- [LogRocket: Generating PDFs in Golang with Maroto](https://blog.logrocket.com/go-long-generating-pdfs-golang-maroto/)
- [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/)
- [Mapbox Pricing](https://www.mapbox.com/pricing)
- [Mapbox vs Google Maps Comparison](https://www.softkraft.co/mapbox-vs-google-maps/)
- [Go PDF Library Comparison](https://cbednarski.com/notes/golang-pdf-libraries/)

---

_End of Technical Specification_
