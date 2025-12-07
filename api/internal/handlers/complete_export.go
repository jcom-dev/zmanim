// File: complete_export.go
// Pattern: 6-step-handler
// Compliance: PublisherResolver:✓ SQLc:✓ slog:✓

package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// ExportCompletePublisher exports complete publisher data (profile, logo, coverage, zmanim)
// GET /api/v1/publisher/export/complete
func (h *Handlers) ExportCompletePublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. No URL params

	// 3. No body

	// 4. No validation

	// 5. Build complete export
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	description := fmt.Sprintf("Complete Export - %s", time.Now().Format("Jan 2, 2006 3:04 PM"))
	exportJSON, err := h.completeExportService.ExportToJSON(ctx, publisherID, description)
	if err != nil {
		slog.Error("failed to build complete export", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to export publisher data")
		return
	}

	// 6. Respond with JSON file download
	filename := fmt.Sprintf("publisher-complete-%s.json", time.Now().Format("2006-01-02"))

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(exportJSON)
	if err != nil {
		slog.Error("failed to write export response", "error", err)
	}
}
