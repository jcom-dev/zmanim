package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/diff"
)

// VersionHistoryEntry represents a version in the history list
type VersionHistoryEntry struct {
	ID            string     `json:"id"`
	VersionNumber int        `json:"version_number"`
	Status        string     `json:"status"`
	Description   string     `json:"description,omitempty"`
	CreatedBy     string     `json:"created_by,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	IsCurrent     bool       `json:"is_current"`
	PublishedAt   *time.Time `json:"published_at,omitempty"`
}

// VersionDetail represents full version details including config snapshot
type VersionDetail struct {
	ID            string          `json:"id"`
	VersionNumber int             `json:"version_number"`
	Status        string          `json:"status"`
	Description   string          `json:"description,omitempty"`
	Config        json.RawMessage `json:"config"`
	CreatedBy     string          `json:"created_by,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

// DiffResponse represents the response for version diff
type DiffResponse struct {
	V1   int                 `json:"v1"`
	V2   int                 `json:"v2"`
	Diff *diff.AlgorithmDiff `json:"diff"`
}

// RollbackRequest represents a request to rollback to a previous version
type RollbackRequest struct {
	TargetVersion int    `json:"target_version"`
	Status        string `json:"status"` // draft or published
	Description   string `json:"description,omitempty"`
}

// GetVersionHistory returns the version history for an algorithm
// GET /api/v1/publisher/algorithm/history
func (h *Handlers) GetVersionHistory(w http.ResponseWriter, r *http.Request) {
	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	ctx := r.Context()

	// Parse publisher ID
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get algorithm ID
	algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found")
		return
	}

	// Get current version number
	currentVersionRaw, err := h.db.Queries.GetCurrentVersionNumber(ctx, algorithmID)
	if err != nil {
		RespondInternalError(w, r, "Failed to get current version")
		return
	}

	// Convert interface{} to int
	currentVersion := 0
	switch v := currentVersionRaw.(type) {
	case int64:
		currentVersion = int(v)
	case int32:
		currentVersion = int(v)
	case int:
		currentVersion = v
	}

	// Fetch version history
	versionRows, err := h.db.Queries.ListVersionHistory(ctx, algorithmID)
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch version history")
		return
	}

	versions := make([]VersionHistoryEntry, 0, len(versionRows))
	for _, row := range versionRows {
		var publishedAt *time.Time
		if row.PublishedAt.Valid {
			t := row.PublishedAt.Time
			publishedAt = &t
		}

		versions = append(versions, VersionHistoryEntry{
			ID:            fmt.Sprintf("%d", row.ID),
			VersionNumber: int(row.VersionNumber),
			Status:        row.Status,
			Description:   row.Description,
			CreatedBy:     row.CreatedBy,
			CreatedAt:     row.CreatedAt.Time,
			IsCurrent:     int(row.VersionNumber) == currentVersion,
			PublishedAt:   publishedAt,
		})
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"versions":        versions,
		"current_version": currentVersion,
		"total":           len(versions),
	})
}

// GetVersionDetail returns the full details of a specific version
// GET /api/v1/publisher/algorithm/history/{version}
func (h *Handlers) GetVersionDetail(w http.ResponseWriter, r *http.Request) {
	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	ctx := r.Context()

	// Step 2: Parse URL parameters
	versionNum := chi.URLParam(r, "version")
	version, err := strconv.Atoi(versionNum)
	if err != nil {
		RespondBadRequest(w, r, "Invalid version number")
		return
	}

	// Parse publisher ID
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get algorithm ID
	algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found")
		return
	}

	// Fetch version detail
	detail, err := h.db.Queries.GetVersionDetail(ctx, sqlcgen.GetVersionDetailParams{
		AlgorithmID:   algorithmID,
		VersionNumber: int32(version),
	})
	if err != nil {
		RespondNotFound(w, r, "Version not found")
		return
	}

	RespondJSON(w, r, http.StatusOK, VersionDetail{
		ID:            fmt.Sprintf("%d", detail.ID),
		VersionNumber: int(detail.VersionNumber),
		Status:        detail.Status,
		Description:   detail.Description,
		Config:        detail.ConfigSnapshot,
		CreatedBy:     detail.CreatedBy,
		CreatedAt:     detail.CreatedAt.Time,
	})
}

// GetVersionDiff compares two versions and returns the diff
// GET /api/v1/publisher/algorithm/diff?v1=X&v2=Y
func (h *Handlers) GetVersionDiff(w http.ResponseWriter, r *http.Request) {
	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	ctx := r.Context()

	// Step 2: Parse query parameters
	v1Str := r.URL.Query().Get("v1")
	v2Str := r.URL.Query().Get("v2")

	v1, err := strconv.Atoi(v1Str)
	if err != nil {
		RespondBadRequest(w, r, "Invalid v1 parameter")
		return
	}
	v2, err := strconv.Atoi(v2Str)
	if err != nil {
		RespondBadRequest(w, r, "Invalid v2 parameter")
		return
	}

	// Parse publisher ID
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get algorithm ID
	algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found")
		return
	}

	// Get both version configs
	v1Config, err := h.db.Queries.GetVersionConfig(ctx, sqlcgen.GetVersionConfigParams{
		AlgorithmID:   algorithmID,
		VersionNumber: int32(v1),
	})
	if err != nil {
		RespondNotFound(w, r, "Version v1 not found")
		return
	}

	v2Config, err := h.db.Queries.GetVersionConfig(ctx, sqlcgen.GetVersionConfigParams{
		AlgorithmID:   algorithmID,
		VersionNumber: int32(v2),
	})
	if err != nil {
		RespondNotFound(w, r, "Version v2 not found")
		return
	}

	// Compute diff
	algorithmDiff, err := diff.CompareAlgorithms(v1Config, v2Config)
	if err != nil {
		RespondInternalError(w, r, "Failed to compute diff")
		return
	}

	RespondJSON(w, r, http.StatusOK, DiffResponse{
		V1:   v1,
		V2:   v2,
		Diff: algorithmDiff,
	})
}

// RollbackVersion rolls back to a previous version
// POST /api/v1/publisher/algorithm/rollback
func (h *Handlers) RollbackVersion(w http.ResponseWriter, r *http.Request) {
	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	ctx := r.Context()

	// Step 3: Parse request body
	var req RollbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate
	if req.TargetVersion <= 0 {
		RespondBadRequest(w, r, "Target version must be positive")
		return
	}

	if req.Status == "" {
		req.Status = "draft"
	}
	if req.Status != "draft" && req.Status != "published" {
		RespondBadRequest(w, r, "Status must be 'draft' or 'published'")
		return
	}

	// Parse publisher ID
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Step 5: Get algorithm ID
	algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found")
		return
	}

	// Get current version number
	currentVersionRaw, err := h.db.Queries.GetCurrentVersionNumber(ctx, algorithmID)
	if err != nil {
		RespondInternalError(w, r, "Failed to get current version")
		return
	}

	// Convert interface{} to int32
	var currentVersion int32
	switch v := currentVersionRaw.(type) {
	case int64:
		currentVersion = int32(v)
	case int32:
		currentVersion = v
	case int:
		currentVersion = int32(v)
	default:
		currentVersion = 0
	}

	// Get target version config
	configSnapshot, err := h.db.Queries.GetVersionConfig(ctx, sqlcgen.GetVersionConfigParams{
		AlgorithmID:   algorithmID,
		VersionNumber: int32(req.TargetVersion),
	})
	if err != nil {
		RespondNotFound(w, r, "Target version not found")
		return
	}

	// Create new version with rolled-back config
	newVersion := currentVersion + 1
	description := req.Description
	if description == "" {
		description = "Rolled back from v" + strconv.Itoa(req.TargetVersion)
	}

	result, err := h.db.Queries.CreateVersionSnapshot(ctx, sqlcgen.CreateVersionSnapshotParams{
		AlgorithmID:    algorithmID,
		VersionNumber:  newVersion,
		Status:         req.Status,
		ConfigSnapshot: configSnapshot,
		Description:    &description,
		CreatedBy:      &pc.UserID,
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to create new version")
		return
	}

	// Update main algorithm with rolled-back config
	err = h.db.Queries.UpdateAlgorithmConfiguration(ctx, sqlcgen.UpdateAlgorithmConfigurationParams{
		Configuration: configSnapshot,
		ID:            algorithmID,
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to update algorithm")
		return
	}

	// Log the rollback
	_ = h.db.Queries.LogRollback(ctx, sqlcgen.LogRollbackParams{
		AlgorithmID:   algorithmID,
		SourceVersion: currentVersion,
		TargetVersion: int32(req.TargetVersion),
		NewVersion:    newVersion,
		Reason:        &description,
		RolledBackBy:  &pc.UserID,
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"new_version":    int(newVersion),
		"new_version_id": result.ID,
		"message":        "Successfully rolled back to version " + strconv.Itoa(req.TargetVersion),
	})
}

// CreateVersionSnapshot creates a version snapshot (called on save)
// POST /api/v1/publisher/algorithm/snapshot
func (h *Handlers) CreateVersionSnapshot(w http.ResponseWriter, r *http.Request) {
	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	ctx := r.Context()

	// Step 3: Parse request body
	var req struct {
		Config      json.RawMessage `json:"config"`
		Status      string          `json:"status"`
		Description string          `json:"description,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate
	if req.Status == "" {
		req.Status = "draft"
	}

	// Parse publisher ID
	publisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Step 5: Get algorithm ID and create snapshot
	algorithmID, err := h.db.Queries.GetLatestAlgorithmByPublisher(ctx, int32(publisherID))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found")
		return
	}

	// Get next version number
	nextVersion, err := h.db.Queries.GetNextVersionNumber(ctx, algorithmID)
	if err != nil {
		RespondInternalError(w, r, "Failed to get next version number")
		return
	}

	// Create version snapshot
	var descPtr *string
	if req.Description != "" {
		descPtr = &req.Description
	}

	result, err := h.db.Queries.CreateVersionSnapshot(ctx, sqlcgen.CreateVersionSnapshotParams{
		AlgorithmID:    algorithmID,
		VersionNumber:  nextVersion,
		Status:         req.Status,
		ConfigSnapshot: []byte(req.Config),
		Description:    descPtr,
		CreatedBy:      &pc.UserID,
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to create version snapshot")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"version_id":     result.ID,
		"version_number": int(result.VersionNumber),
		"status":         result.Status,
	})
}
