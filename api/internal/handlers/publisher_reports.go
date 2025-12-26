// File: publisher_reports.go
// Purpose: Publisher report endpoints (PDF generation)
// Pattern: 6-step handler pattern
// Dependencies: PDFReportService, PublisherResolver
// Frequency: medium
// Compliance: Story 11.6

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jcom-dev/zmanim/internal/services"
)

// PublisherReportsHandler handles publisher report endpoints
type PublisherReportsHandler struct {
	pdfService        *services.PDFReportService
	publisherResolver *PublisherResolver
}

// NewPublisherReportsHandler creates a new publisher reports handler
func NewPublisherReportsHandler(
	pdfService *services.PDFReportService,
	publisherResolver *PublisherResolver,
) *PublisherReportsHandler {
	return &PublisherReportsHandler{
		pdfService:        pdfService,
		publisherResolver: publisherResolver,
	}
}

// GenerateZmanimReportRequest is the request body for PDF generation
type GenerateZmanimReportRequest struct {
	LocalityID      int64  `json:"locality_id"`
	Date            string `json:"date"` // YYYY-MM-DD
	IncludeGlossary bool   `json:"include_glossary"`
}

// GenerateZmanimReport handles POST /api/v1/publisher/reports/zmanim-pdf
//
//	@Summary		Generate Zmanim PDF Report
//	@Description	Generate a comprehensive PDF report of zmanim calculations for a location and date
//	@Tags			Publisher Reports
//	@Accept			json
//	@Produce		application/pdf
//	@Param			body	body		GenerateZmanimReportRequest	true	"Report parameters"
//	@Success		200		{file}		binary						"PDF file"
//	@Failure		400		{object}	handlers.ErrorResponse		"Invalid request"
//	@Failure		401		{object}	handlers.ErrorResponse		"Unauthorized"
//	@Failure		500		{object}	handlers.ErrorResponse		"Internal server error"
//	@Router			/api/v1/publisher/reports/zmanim-pdf [post]
func (h *PublisherReportsHandler) GenerateZmanimReport(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // MustResolve already sent error response
	}

	// Step 2: Convert publisher ID to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Step 3: Parse request body
	var req GenerateZmanimReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate request
	if req.LocalityID == 0 {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	if req.Date == "" {
		RespondBadRequest(w, r, "date is required")
		return
	}

	parsedDate, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format (use YYYY-MM-DD)")
		return
	}

	// Validate date range (prevent DOS with extreme dates)
	now := time.Now()
	minDate := now.AddDate(-10, 0, 0)
	maxDate := now.AddDate(10, 0, 0)
	if parsedDate.Before(minDate) || parsedDate.After(maxDate) {
		RespondBadRequest(w, r, "Date must be within 10 years of today")
		return
	}

	// Step 5: Generate PDF with timeout
	timeoutCtx, cancel := ContextWithTimeout(ctx, 30*time.Second)
	defer cancel()

	pdfBytes, err := h.pdfService.GenerateZmanimReport(timeoutCtx, services.ZmanimReportParams{
		PublisherID:     publisherID,
		LocalityID:      int32(req.LocalityID),
		Date:            parsedDate,
		IncludeGlossary: req.IncludeGlossary,
	})
	if err != nil {
		slog.Error("PDF generation failed",
			"error", err,
			"publisher_id", publisherID,
			"locality_id", req.LocalityID,
			"date", req.Date,
		)
		RespondInternalError(w, r, "Failed to generate PDF report")
		return
	}

	// Step 6: Generate filename
	filename := services.GenerateReportFilename("zmanim", "location", req.Date)

	// Step 7: Respond with PDF
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(pdfBytes); err != nil {
		slog.Error("Failed to write PDF response", "error", err)
	}
}

// ContextWithTimeout creates a context with timeout (helper function)
func ContextWithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, timeout)
}

// GenerateWeeklyCalendarRequest is the request body for weekly calendar PDF generation
type GenerateWeeklyCalendarRequest struct {
	LocalityID      int64  `json:"locality_id"`
	StartDate       string `json:"start_date"` // YYYY-MM-DD (must be Sunday)
	Language        string `json:"language"`   // "en" for English, "he" for Hebrew (defaults to "en")
	IncludeDraft    bool   `json:"include_draft"`
	IncludeOptional bool   `json:"include_optional"`
	IncludeHidden   bool   `json:"include_hidden"`
	IncludeEvents   bool   `json:"include_events"` // Include event zmanim (candle lighting, havdalah, etc.)
}

// GenerateWeeklyCalendarPDF handles POST /api/v1/publisher/calendar/weekly-pdf
//
//	@Summary		Generate Weekly Calendar PDF
//	@Description	Generate a printable weekly zmanim calendar in PDF format (A4, Manchester-style layout)
//	@Tags			Publisher Reports
//	@Accept			json
//	@Produce		application/pdf
//	@Param			body	body		GenerateWeeklyCalendarRequest	true	"Weekly calendar parameters"
//	@Success		200		{file}		binary							"PDF file"
//	@Failure		400		{object}	handlers.ErrorResponse			"Invalid request"
//	@Failure		401		{object}	handlers.ErrorResponse			"Unauthorized"
//	@Failure		500		{object}	handlers.ErrorResponse			"Internal server error"
//	@Router			/api/v1/publisher/calendar/weekly-pdf [post]
func (h *PublisherReportsHandler) GenerateWeeklyCalendarPDF(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // MustResolve already sent error response
	}

	// Step 2: Convert publisher ID to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Step 3: Parse request body
	var req GenerateWeeklyCalendarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate request
	if req.LocalityID == 0 {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}

	if req.StartDate == "" {
		RespondBadRequest(w, r, "start_date is required")
		return
	}

	parsedDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format (use YYYY-MM-DD)")
		return
	}

	// Validate that start_date is a Sunday
	if parsedDate.Weekday() != time.Sunday {
		RespondBadRequest(w, r, "start_date must be a Sunday")
		return
	}

	// Validate date range (prevent DOS with extreme dates)
	now := time.Now()
	minDate := now.AddDate(-10, 0, 0)
	maxDate := now.AddDate(10, 0, 0)
	if parsedDate.Before(minDate) || parsedDate.After(maxDate) {
		RespondBadRequest(w, r, "Date must be within 10 years of today")
		return
	}

	// Step 5: Generate PDF with timeout
	timeoutCtx, cancel := ContextWithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Default to English if no language specified
	language := req.Language
	if language == "" {
		language = "en"
	}

	pdfBytes, err := h.pdfService.GenerateWeeklyCalendarPDF(timeoutCtx, services.WeeklyCalendarParams{
		PublisherID:     publisherID,
		LocalityID:      int32(req.LocalityID),
		StartDate:       parsedDate,
		Language:        language,
		IncludeDraft:    req.IncludeDraft,
		IncludeOptional: req.IncludeOptional,
		IncludeHidden:   req.IncludeHidden,
		IncludeEvents:   req.IncludeEvents,
	})
	if err != nil {
		slog.Error("Weekly calendar PDF generation failed",
			"error", err,
			"publisher_id", publisherID,
			"locality_id", req.LocalityID,
			"start_date", req.StartDate,
		)
		RespondInternalError(w, r, "Failed to generate weekly calendar PDF")
		return
	}

	// Step 6: Generate filename
	filename := fmt.Sprintf("Zmanim_Weekly_%s.pdf", req.StartDate)

	// Step 7: Respond with PDF
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(pdfBytes); err != nil {
		slog.Error("Failed to write weekly calendar PDF response", "error", err)
	}
}
