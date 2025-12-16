package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/services"
)

// ExportPublisherSnapshot exports the current publisher state as JSON
// GET /api/v1/publisher/snapshot/export
func (h *Handlers) ExportPublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. No URL params

	// 3. No body

	// 4. No validation

	// 5. Build snapshot
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	description := fmt.Sprintf("Export - %s", time.Now().Format("Jan 2, 2006 3:04 PM"))
	snapshot, err := h.snapshotService.BuildSnapshot(ctx, publisherID, description)
	if err != nil {
		slog.Error("failed to build snapshot for export", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to export snapshot")
		return
	}

	// 6. Respond with JSON file download
	filename := fmt.Sprintf("publisher-snapshot-%s.json", time.Now().Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(snapshot); err != nil {
		slog.Error("failed to encode snapshot", "error", err)
	}
}

// ImportPublisherSnapshot imports a snapshot from JSON
// POST /api/v1/publisher/snapshot/import
func (h *Handlers) ImportPublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. No URL params

	// 3. Parse body - first as raw to detect complete backup format
	var rawBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		slog.Error("snapshot import: failed to decode raw body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}
	slog.Info("snapshot import: raw body decoded", "keys", fmt.Sprintf("%v", func() []string {
		keys := make([]string, 0, len(rawBody))
		for k := range rawBody {
			keys = append(keys, k)
		}
		return keys
	}()))

	// Check for complete backup format markers (incompatible with snapshot restore)
	if formatType, ok := rawBody["format_type"].(string); ok && formatType == "complete_backup" {
		RespondValidationError(w, r, "Incompatible file format", map[string]string{
			"format_type": "This is a complete backup file. Complete backups cannot be imported via the snapshot restore feature. Please use the admin restore functionality.",
		})
		return
	}
	if formatVersion, ok := rawBody["format_version"].(float64); ok && formatVersion >= 1000 {
		RespondValidationError(w, r, "Incompatible file format", map[string]string{
			"format_version": "This appears to be a complete backup file (version 1000+). Complete backups cannot be imported via the snapshot restore feature.",
		})
		return
	}

	// Parse as snapshot
	bodyBytes, err := json.Marshal(rawBody)
	if err != nil {
		slog.Error("snapshot import: failed to marshal raw body", "error", err)
		RespondInternalError(w, r, "Failed to process request body")
		return
	}

	var req struct {
		Snapshot services.PublisherSnapshot `json:"snapshot"`
	}
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		slog.Error("snapshot import: failed to unmarshal into struct", "error", err, "body_preview", string(bodyBytes[:min(500, len(bodyBytes))]))
		RespondBadRequest(w, r, "Invalid snapshot format")
		return
	}
	slog.Info("snapshot import: parsed snapshot", "format_version", req.Snapshot.FormatVersion, "zmanim_count", len(req.Snapshot.Zmanim))

	// 4. Validate format (supports both legacy version 1 and new format version 2)
	if req.Snapshot.FormatVersion == 0 {
		RespondValidationError(w, r, "Invalid snapshot format", map[string]string{
			"format_version": "Snapshot format version is required",
		})
		return
	}

	// 5. Import snapshot
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	result, err := h.snapshotService.ImportSnapshot(ctx, publisherID, pc.UserID, &req.Snapshot)
	if err != nil {
		slog.Error("failed to import snapshot", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, err.Error())
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, result)
}

// SavePublisherSnapshot creates a new version snapshot
// POST /api/v1/publisher/snapshot
func (h *Handlers) SavePublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. No URL params

	// 3. Parse body
	var req struct {
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Allow empty body - will use default description
		req.Description = ""
	}

	// 4. Validate & set default
	if req.Description == "" {
		req.Description = fmt.Sprintf("Version save - %s", time.Now().Format("Jan 2, 2006 3:04 PM"))
	}

	// 5. Save snapshot
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	meta, err := h.snapshotService.SaveSnapshot(ctx, publisherID, pc.UserID, req.Description)
	if err != nil {
		slog.Error("failed to save snapshot", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to save version")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusCreated, meta)
}

// ListPublisherSnapshots returns all saved versions
// GET /api/v1/publisher/snapshots
func (h *Handlers) ListPublisherSnapshots(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. No URL params

	// 3. No body

	// 4. No validation

	// 5. List snapshots
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	snapshots, err := h.snapshotService.ListSnapshots(ctx, publisherID)
	if err != nil {
		slog.Error("failed to list snapshots", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to list versions")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"snapshots": snapshots,
		"total":     len(snapshots),
	})
}

// GetPublisherSnapshot returns a single snapshot with full data
// GET /api/v1/publisher/snapshot/{id}
func (h *Handlers) GetPublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	snapshotIDStr := chi.URLParam(r, "id")
	if snapshotIDStr == "" {
		RespondValidationError(w, r, "Snapshot ID is required", nil)
		return
	}

	// 3. No body

	// 4. Convert and validate IDs
	snapshotID, err := stringToInt32(snapshotIDStr)
	if err != nil {
		slog.Error("invalid snapshot ID", "error", err, "snapshot_id", snapshotIDStr)
		RespondBadRequest(w, r, "Invalid snapshot ID")
		return
	}

	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 5. Get snapshot
	snapshot, err := h.snapshotService.GetSnapshot(ctx, snapshotID, publisherID)
	if err != nil {
		slog.Error("failed to get snapshot", "error", err, "snapshot_id", snapshotIDStr, "publisher_id", pc.PublisherID)
		RespondNotFound(w, r, "Snapshot not found")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, snapshot)
}

// RestorePublisherSnapshot restores from a saved version
// POST /api/v1/publisher/snapshot/{id}/restore
func (h *Handlers) RestorePublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	snapshotIDStr := chi.URLParam(r, "id")
	if snapshotIDStr == "" {
		RespondValidationError(w, r, "Snapshot ID is required", nil)
		return
	}

	// 3. No body

	// 4. Convert and validate IDs
	snapshotID, err := stringToInt32(snapshotIDStr)
	if err != nil {
		slog.Error("invalid snapshot ID", "error", err, "snapshot_id", snapshotIDStr)
		RespondBadRequest(w, r, "Invalid snapshot ID")
		return
	}

	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 5. Restore snapshot (auto-saves current state first)
	autoSave, err := h.snapshotService.RestoreSnapshot(ctx, snapshotID, publisherID, pc.UserID)
	if err != nil {
		slog.Error("failed to restore snapshot", "error", err, "snapshot_id", snapshotIDStr, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to restore version")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success":      true,
		"auto_save_id": autoSave.ID,
	})
}

// DeletePublisherSnapshot deletes a saved version
// DELETE /api/v1/publisher/snapshot/{id}
func (h *Handlers) DeletePublisherSnapshot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// 2. Extract URL params
	snapshotIDStr := chi.URLParam(r, "id")
	if snapshotIDStr == "" {
		RespondValidationError(w, r, "Snapshot ID is required", nil)
		return
	}

	// 3. No body

	// 4. Convert and validate IDs
	snapshotID, err := stringToInt32(snapshotIDStr)
	if err != nil {
		slog.Error("invalid snapshot ID", "error", err, "snapshot_id", snapshotIDStr)
		RespondBadRequest(w, r, "Invalid snapshot ID")
		return
	}

	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// 5. Delete snapshot
	err = h.snapshotService.DeleteSnapshot(ctx, snapshotID, publisherID)
	if err != nil {
		slog.Error("failed to delete snapshot", "error", err, "snapshot_id", snapshotIDStr, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to delete version")
		return
	}

	// 6. Respond
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}
