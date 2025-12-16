package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// PublicAlgorithm represents a public algorithm for browsing
type PublicAlgorithm struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	PublisherID   string        `json:"publisher_id"`
	PublisherName string        `json:"publisher_name"`
	PublisherLogo string        `json:"publisher_logo,omitempty"`
	Template      string        `json:"template,omitempty"`
	ZmanimPreview []ZmanPreview `json:"zmanim_preview"`
	ForkCount     int           `json:"fork_count"`
	CreatedAt     string        `json:"created_at"`
}

// ZmanPreview represents a preview of a zman in a public algorithm
type ZmanPreview struct {
	Key        string `json:"key"`
	Name       string `json:"name"`
	NameHebrew string `json:"name_hebrew,omitempty"`
	SampleTime string `json:"sample_time"`
}

// BrowsePublicAlgorithms returns a list of public algorithms
// GET /api/algorithms/public
func (h *Handlers) BrowsePublicAlgorithms(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query params
	search := r.URL.Query().Get("search")
	template := r.URL.Query().Get("template")
	page := 1
	pageSize := 20

	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := parseIntParam(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := r.URL.Query().Get("page_size"); ps != "" {
		if parsed, err := parseIntParam(ps); err == nil && parsed > 0 && parsed <= 50 {
			pageSize = parsed
		}
	}

	offset := (page - 1) * pageSize

	// Use SQLc query
	searchParam := ""
	if search != "" {
		searchParam = search
	}

	rows, err := h.db.Queries.BrowsePublicAlgorithms(ctx, sqlcgen.BrowsePublicAlgorithmsParams{
		Column1: searchParam,
		Limit:   int32(pageSize),
		Offset:  int32(offset),
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch algorithms")
		return
	}

	var algorithms []PublicAlgorithm
	for _, row := range rows {
		alg := PublicAlgorithm{
			ID:            stringFromInt32(row.ID),
			Name:          row.Name,
			Description:   row.Description,
			PublisherID:   stringFromInt32(row.PublisherID),
			PublisherName: row.PublisherName,
			PublisherLogo: row.PublisherLogo,
			ForkCount:     int(row.ForkCount),
			CreatedAt:     row.CreatedAt.Time.Format(time.RFC3339),
			Template:      template,
			ZmanimPreview: []ZmanPreview{}, // Would populate from configuration
		}
		algorithms = append(algorithms, alg)
	}

	if algorithms == nil {
		algorithms = []PublicAlgorithm{}
	}

	// Get total count
	total, err := h.db.Queries.CountPublicAlgorithms(ctx)
	if err != nil {
		total = 0
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"algorithms": algorithms,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
	})
}

// GetPublicAlgorithm returns details of a public algorithm
// GET /api/algorithms/{id}/public
func (h *Handlers) GetPublicAlgorithm(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	algorithmID := chi.URLParam(r, "id")

	algorithmIDInt, err := parseIntParam(algorithmID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid algorithm ID")
		return
	}

	row, err := h.db.Queries.GetPublicAlgorithmByID(ctx, int32(algorithmIDInt))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found or not public")
		return
	}

	alg := PublicAlgorithm{
		ID:            stringFromInt32(row.ID),
		Name:          row.Name,
		Description:   row.Description,
		PublisherID:   stringFromInt32(row.PublisherID),
		PublisherName: row.PublisherName,
		PublisherLogo: row.PublisherLogo,
		ForkCount:     int(row.ForkCount),
		CreatedAt:     row.CreatedAt.Time.Format(time.RFC3339),
		ZmanimPreview: []ZmanPreview{},
	}

	// Parse configuration for zmanim preview
	if row.Configuration != nil {
		var data map[string]interface{}
		if err := json.Unmarshal(row.Configuration, &data); err == nil {
			if zmanim, ok := data["zmanim"].([]interface{}); ok {
				for _, z := range zmanim {
					if zm, ok := z.(map[string]interface{}); ok {
						preview := ZmanPreview{
							Key:  getString(zm, "key"),
							Name: getString(zm, "nameEnglish"),
						}
						alg.ZmanimPreview = append(alg.ZmanimPreview, preview)
					}
				}
			}
		}
	}

	RespondJSON(w, r, http.StatusOK, alg)
}

// CopyAlgorithm copies a public algorithm to the user's account
// POST /api/algorithms/{id}/copy
func (h *Handlers) CopyAlgorithm(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User not authenticated")
		return
	}

	sourceAlgorithmID := chi.URLParam(r, "id")
	sourceAlgorithmIDInt, err := parseIntParam(sourceAlgorithmID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid algorithm ID")
		return
	}

	// Get publisher ID
	publisherID := r.Header.Get("X-Publisher-Id")
	var publisherIDInt int32
	if publisherID == "" {
		publisherIDInt, err = h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
	} else {
		pidInt, err := parseIntParam(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}
		publisherIDInt = int32(pidInt)
	}

	// Get the source algorithm (must be public)
	source, err := h.db.Queries.GetPublicAlgorithmConfig(ctx, int32(sourceAlgorithmIDInt))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found or not public")
		return
	}

	// Create the copy
	desc := source.Description
	name := source.Name
	newAlgorithmID, err := h.db.Queries.CopyPublicAlgorithm(ctx, sqlcgen.CopyPublicAlgorithmParams{
		PublisherID:   publisherIDInt,
		Column2:       &name,
		Description:   &desc,
		Configuration: source.Configuration,
	})

	if err != nil {
		RespondInternalError(w, r, "Failed to copy algorithm")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"new_algorithm_id": stringFromInt32(newAlgorithmID),
		"message":          "Algorithm copied successfully",
	})
}

// ForkAlgorithm forks a public algorithm with attribution
// POST /api/algorithms/{id}/fork
func (h *Handlers) ForkAlgorithm(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User not authenticated")
		return
	}

	sourceAlgorithmID := chi.URLParam(r, "id")
	sourceAlgorithmIDInt, err := parseIntParam(sourceAlgorithmID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid algorithm ID")
		return
	}

	// Get publisher ID
	publisherID := r.Header.Get("X-Publisher-Id")
	var publisherIDInt int32
	if publisherID == "" {
		publisherIDInt, err = h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
	} else {
		pidInt, err := parseIntParam(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}
		publisherIDInt = int32(pidInt)
	}

	// Get the source algorithm and publisher name
	source, err := h.db.Queries.GetPublicAlgorithmWithPublisher(ctx, int32(sourceAlgorithmIDInt))
	if err != nil {
		RespondNotFound(w, r, "Algorithm not found or not public")
		return
	}

	// Create attribution text
	attribution := "Based on " + source.PublisherName + "'s algorithm"

	// Create the fork
	desc := source.Description
	name := source.Name
	newAlgorithmID, err := h.db.Queries.ForkPublicAlgorithm(ctx, sqlcgen.ForkPublicAlgorithmParams{
		PublisherID:     publisherIDInt,
		Column2:         &name,
		Description:     &desc,
		Configuration:   source.Configuration,
		ForkedFrom:      int32Ptr(int32(sourceAlgorithmIDInt)),
		AttributionText: &attribution,
	})

	if err != nil {
		RespondInternalError(w, r, "Failed to fork algorithm")
		return
	}

	// Increment fork count on source
	_ = h.db.Queries.IncrementAlgorithmForkCount(ctx, int32(sourceAlgorithmIDInt))

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"new_algorithm_id": stringFromInt32(newAlgorithmID),
		"attribution":      attribution,
		"message":          "Algorithm forked successfully",
	})
}

// SetAlgorithmVisibility toggles algorithm public/private
// PUT /api/publisher/algorithm/visibility
func (h *Handlers) SetAlgorithmVisibility(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User not authenticated")
		return
	}

	var req struct {
		IsPublic bool `json:"is_public"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Get publisher ID
	publisherID := r.Header.Get("X-Publisher-Id")
	var publisherIDInt int32
	var err error
	if publisherID == "" {
		publisherIDInt, err = h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
	} else {
		pidInt, err := parseIntParam(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}
		publisherIDInt = int32(pidInt)
	}

	// Update visibility
	err = h.db.Queries.SetAlgorithmVisibility(ctx, sqlcgen.SetAlgorithmVisibilityParams{
		IsPublic:    boolPtr(req.IsPublic),
		PublisherID: publisherIDInt,
	})

	if err != nil {
		RespondInternalError(w, r, "Failed to update visibility")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"is_public": req.IsPublic,
	})
}

// GetMyForks returns the user's forked algorithms
// GET /api/publisher/algorithm/forks
func (h *Handlers) GetMyForks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User not authenticated")
		return
	}

	publisherID := r.Header.Get("X-Publisher-Id")
	var publisherIDInt int32
	var err error
	if publisherID == "" {
		publisherIDInt, err = h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
	} else {
		pidInt, err := parseIntParam(publisherID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}
		publisherIDInt = int32(pidInt)
	}

	rows, err := h.db.Queries.GetPublisherForks(ctx, publisherIDInt)
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch forks")
		return
	}

	type Fork struct {
		ID              string `json:"id"`
		Name            string `json:"name"`
		Attribution     string `json:"attribution"`
		SourceID        string `json:"source_id"`
		SourceName      string `json:"source_name"`
		SourcePublisher string `json:"source_publisher"`
	}

	var forks []Fork
	for _, row := range rows {
		fork := Fork{
			ID:              stringFromInt32(row.ID),
			Name:            row.Name,
			Attribution:     stringFromStringPtr(row.AttributionText),
			SourceID:        stringFromInt32(row.SourceID),
			SourceName:      row.SourceName,
			SourcePublisher: row.SourcePublisher,
		}
		forks = append(forks, fork)
	}

	if forks == nil {
		forks = []Fork{}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"forks": forks,
	})
}

// helper to get string from map
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
