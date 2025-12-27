// File: publisher_algorithm.go
// Purpose: Algorithm lifecycle - draft/publish/archive with versioning and rollback
// Pattern: 6-step-handler-transactional
// Dependencies: Queries: algorithms.sql | Services: Cache, SnapshotService
// Frequency: high - 716 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jcom-dev/zmanim/internal/algorithm"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/services"
)

// Helper function to convert string publisher ID to int32
func publisherIDToInt32(publisherID string) (int32, error) {
	id, err := strconv.Atoi(publisherID)
	if err != nil {
		return 0, err
	}
	return int32(id), nil
}

// AlgorithmResponse represents the algorithm configuration response
type AlgorithmResponse struct {
	ID            string                     `json:"id"`
	Name          string                     `json:"name"`
	Description   string                     `json:"description"`
	Configuration *algorithm.AlgorithmConfig `json:"configuration"`
	Status        string                     `json:"status"`
	IsPublic      bool                       `json:"is_public"`
	CreatedAt     time.Time                  `json:"created_at"`
	UpdatedAt     time.Time                  `json:"updated_at"`
}

// AlgorithmVersionResponse represents a version in the history
type AlgorithmVersionResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	IsPublic  bool      `json:"is_public"`
	CreatedAt time.Time `json:"created_at"`
}

// AlgorithmUpdateRequest represents the request to update an algorithm
type AlgorithmUpdateRequest struct {
	Name          string                    `json:"name,omitempty"`
	Description   string                    `json:"description,omitempty"`
	Configuration algorithm.AlgorithmConfig `json:"configuration"`
}

// AlgorithmPreviewRequest represents the request for algorithm preview
type AlgorithmPreviewRequest struct {
	Configuration algorithm.AlgorithmConfig `json:"configuration"`
	Date          string                    `json:"date,omitempty"`
	Latitude      float64                   `json:"latitude"`
	Longitude     float64                   `json:"longitude"`
	Timezone      string                    `json:"timezone"`
}

// AlgorithmPreviewResponse represents the preview calculation result
type AlgorithmPreviewResponse struct {
	Date     string            `json:"date"`
	Location LocationInfo      `json:"location"`
	Zmanim   []ZmanWithFormula `json:"zmanim"`
}

// GetPublisherAlgorithmHandler returns the current publisher's algorithm configuration
func (h *Handlers) GetPublisherAlgorithmHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get algorithm for this publisher (prefer draft, then active)
	var alg interface{}
	var status string
	var isPublic bool

	// First try to get draft
	draftAlg, err := h.db.Queries.GetPublisherDraftAlgorithm(ctx, publisherID)
	if err == nil {
		alg = draftAlg
		status = draftAlg.StatusKey
		isPublic = draftAlg.IsPublic != nil && *draftAlg.IsPublic
	} else if err == pgx.ErrNoRows {
		// No draft, try to get active algorithm
		activeAlg, err := h.db.Queries.GetPublisherActiveAlgorithm(ctx, publisherID)
		if err == nil {
			alg = activeAlg
			status = activeAlg.StatusKey
			isPublic = activeAlg.IsPublic != nil && *activeAlg.IsPublic
		} else if err != pgx.ErrNoRows {
			RespondInternalError(w, r, "Failed to fetch algorithm")
			return
		}
	} else {
		RespondInternalError(w, r, "Failed to fetch algorithm")
		return
	}

	if alg == nil {
		// No algorithm exists, return default configuration
		defaultAlg := algorithm.DefaultAlgorithm()
		RespondJSON(w, r, http.StatusOK, AlgorithmResponse{
			ID:            "",
			Name:          "Default Algorithm",
			Description:   "Standard zmanim calculation algorithm",
			Configuration: defaultAlg,
			Status:        "draft",
			IsPublic:      false,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		})
		return
	}

	// Extract common fields based on type
	var algID int32
	var algName, description string
	var configJSON []byte
	var createdAt, updatedAt time.Time

	switch v := alg.(type) {
	case sqlcgen.GetPublisherDraftAlgorithmRow:
		algID = v.ID
		algName = v.Name
		description = v.Description
		configJSON = v.Configuration
		createdAt = v.CreatedAt.Time
		updatedAt = v.UpdatedAt.Time
	case sqlcgen.GetPublisherActiveAlgorithmRow:
		algID = v.ID
		algName = v.Name
		description = v.Description
		configJSON = v.Configuration
		createdAt = v.CreatedAt.Time
		updatedAt = v.UpdatedAt.Time
	}

	// Parse configuration
	var config algorithm.AlgorithmConfig
	if len(configJSON) > 2 {
		if err := json.Unmarshal(configJSON, &config); err != nil {
			// Return default if parse fails
			config = *algorithm.DefaultAlgorithm()
		}
	} else {
		config = *algorithm.DefaultAlgorithm()
	}

	RespondJSON(w, r, http.StatusOK, AlgorithmResponse{
		ID:            strconv.Itoa(int(algID)),
		Name:          algName,
		Description:   description,
		Configuration: &config,
		Status:        status,
		IsPublic:      isPublic,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	})
}

// UpdatePublisherAlgorithmHandler updates the publisher's algorithm configuration
func (h *Handlers) UpdatePublisherAlgorithmHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Parse request body
	var req AlgorithmUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate configuration
	if err := algorithm.ValidateAlgorithm(&req.Configuration); err != nil {
		RespondValidationError(w, r, err.Error(), nil)
		return
	}

	// Convert configuration to JSON
	configJSON, err := json.Marshal(req.Configuration)
	if err != nil {
		RespondInternalError(w, r, "Failed to encode configuration")
		return
	}

	// Check for existing draft algorithm
	draftAlg, err := h.db.Queries.GetPublisherDraftAlgorithm(ctx, publisherID)
	hasDraft := err == nil

	var algID int32
	var createdAt, updatedAt time.Time

	algName := req.Name
	if algName == "" {
		algName = "Custom Algorithm"
	}
	description := req.Description
	if description == "" {
		description = "Custom zmanim calculation algorithm"
	}

	if hasDraft {
		// Update existing draft
		result, err := h.db.Queries.UpdateAlgorithmDraft(ctx, sqlcgen.UpdateAlgorithmDraftParams{
			Configuration: configJSON,
			Column2:       req.Name,
			Column3:       req.Description,
			ID:            draftAlg.ID,
		})
		if err != nil {
			RespondInternalError(w, r, "Failed to update draft")
			return
		}
		algID = result.ID
		createdAt = result.CreatedAt.Time
		updatedAt = result.UpdatedAt.Time
	} else {
		// Create new draft (either published exists or first draft)
		var descPtr *string
		if description != "" {
			descPtr = &description
		}
		result, err := h.db.Queries.CreateAlgorithm(ctx, sqlcgen.CreateAlgorithmParams{
			PublisherID:   publisherID,
			Name:          algName,
			Description:   descPtr,
			Configuration: configJSON,
		})
		if err != nil {
			RespondInternalError(w, r, "Failed to create draft")
			return
		}
		algID = result.ID
		createdAt = result.CreatedAt.Time
		updatedAt = result.UpdatedAt.Time
	}

	// Log algorithm save activity
	metadata := map[string]interface{}{
		"algorithm_id": algID,
		"name":         algName,
		"status":       "draft",
		"action":       "save",
	}
	if hasDraft {
		metadata["update_type"] = "updated_existing_draft"
	} else {
		metadata["update_type"] = "created_new_draft"
	}

	_ = h.activityService.LogAction(
		ctx,
		services.ActionAlgorithmSave,
		services.ConceptAlgorithm,
		"algorithm",
		strconv.Itoa(int(algID)),
		strconv.Itoa(int(publisherID)),
		metadata,
	)

	RespondJSON(w, r, http.StatusOK, AlgorithmResponse{
		ID:            strconv.Itoa(int(algID)),
		Name:          algName,
		Description:   description,
		Configuration: &req.Configuration,
		Status:        "draft",
		IsPublic:      false,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	})
}

// PreviewAlgorithm calculates zmanim using the provided algorithm configuration
// POST /api/v1/publisher/algorithm/preview
func (h *Handlers) PreviewAlgorithm(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (optional - preview can be used without auth for demo)
	// Allow unauthenticated preview for demo purposes

	// Parse request body
	var req AlgorithmPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate configuration
	if err := algorithm.ValidateAlgorithm(&req.Configuration); err != nil {
		RespondValidationError(w, r, err.Error(), nil)
		return
	}

	// Default to today if no date specified
	dateStr := req.Date
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	// Parse date
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Validate location
	if req.Latitude < -90 || req.Latitude > 90 {
		RespondBadRequest(w, r, "Latitude must be between -90 and 90")
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		RespondBadRequest(w, r, "Longitude must be between -180 and 180")
		return
	}

	// Default timezone
	timezone := req.Timezone
	if timezone == "" {
		timezone = "America/New_York"
	}

	// Load timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
		timezone = "UTC"
	}

	// Execute algorithm
	executor := algorithm.NewExecutor(date, req.Latitude, req.Longitude, loc)
	results, err := executor.Execute(&req.Configuration)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim: "+err.Error())
		return
	}

	// Build response
	response := AlgorithmPreviewResponse{
		Date: dateStr,
		Location: LocationInfo{
			LocalityID:       "",
			LocalityName:     "",
			Country:          "",
			CountryCode:      "",
			Region:           nil,
			DisplayHierarchy: "",
			Latitude:         req.Latitude,
			Longitude:        req.Longitude,
			Elevation:        0,
			Timezone:         timezone,
		},
		Zmanim: make([]ZmanWithFormula, 0, len(results.Zmanim)),
	}

	for _, zman := range results.Zmanim {
		response.Zmanim = append(response.Zmanim, ZmanWithFormula{
			Name: zman.Name,
			Key:  zman.Key,
			Time: zman.TimeString,
			Formula: FormulaDetails{
				Method:      zman.Formula.Method,
				DisplayName: zman.Formula.DisplayName,
				Parameters:  zman.Formula.Parameters,
				Explanation: zman.Formula.Explanation,
			},
		})
	}

	// Sort all zmanim using the unified service
	if h.zmanimService != nil {
		sortable := make([]services.SortableZman, len(response.Zmanim))
		for i := range response.Zmanim {
			sortable[i] = &response.Zmanim[i]
		}
		h.zmanimService.SortZmanim(sortable, false)
		// Convert back to original slice (sorted order)
		sorted := make([]ZmanWithFormula, len(sortable))
		for i, s := range sortable {
			sorted[i] = *s.(*ZmanWithFormula)
		}
		response.Zmanim = sorted
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetZmanMethods returns available calculation methods for zmanim
// GET /api/v1/publisher/algorithm/methods
func (h *Handlers) GetZmanMethods(w http.ResponseWriter, r *http.Request) {
	methods := []map[string]interface{}{
		{
			"id":          "sunrise",
			"name":        "Sunrise",
			"description": "Standard sunrise time when the sun's upper edge crosses the horizon",
			"parameters":  []interface{}{},
		},
		{
			"id":          "sunset",
			"name":        "Sunset",
			"description": "Standard sunset time when the sun's upper edge crosses the horizon",
			"parameters":  []interface{}{},
		},
		{
			"id":          "solar_angle",
			"name":        "Solar Angle",
			"description": "Time when the sun is at a specific angle below the horizon",
			"parameters": []map[string]interface{}{
				{
					"name":        "degrees",
					"type":        "number",
					"description": "Degrees below horizon (e.g., 16.1 for alos, 8.5 for tzeis)",
					"required":    true,
					"min":         0,
					"max":         90,
				},
			},
		},
		{
			"id":          "fixed_minutes",
			"name":        "Fixed Minutes",
			"description": "A fixed number of minutes before or after a base time",
			"parameters": []map[string]interface{}{
				{
					"name":        "minutes",
					"type":        "number",
					"description": "Number of minutes (positive = after, negative = before)",
					"required":    true,
				},
				{
					"name":        "from",
					"type":        "select",
					"description": "Base time to calculate from",
					"required":    true,
					"options":     []string{"sunrise", "sunset", "alos", "tzeis"},
				},
			},
		},
		{
			"id":          "proportional",
			"name":        "Proportional Hours",
			"description": "Calculated based on proportional hours of the day",
			"parameters": []map[string]interface{}{
				{
					"name":        "hours",
					"type":        "number",
					"description": "Number of proportional hours from start of day",
					"required":    true,
					"min":         0,
					"max":         12,
				},
				{
					"name":        "base",
					"type":        "select",
					"description": "Base calculation method",
					"required":    true,
					"options":     []string{"gra", "mga"},
				},
			},
		},
		{
			"id":          "midpoint",
			"name":        "Midpoint",
			"description": "The midpoint between two times",
			"parameters": []map[string]interface{}{
				{
					"name":        "start",
					"type":        "select",
					"description": "Start time",
					"required":    true,
					"options":     []string{"sunrise", "sunset", "alos", "tzeis"},
				},
				{
					"name":        "end",
					"type":        "select",
					"description": "End time",
					"required":    true,
					"options":     []string{"sunrise", "sunset", "alos", "tzeis"},
				},
			},
		},
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"methods": methods,
	})
}

// PublishAlgorithm publishes the current draft algorithm
// POST /api/v1/publisher/algorithm/publish
func (h *Handlers) PublishAlgorithm(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get the draft algorithm
	draftAlg, err := h.db.Queries.GetPublisherDraftAlgorithm(ctx, publisherID)
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "No draft algorithm found to publish")
		} else {
			RespondInternalError(w, r, "Failed to fetch draft algorithm")
		}
		return
	}

	// Validate configuration before publishing
	var config algorithm.AlgorithmConfig
	if err := json.Unmarshal(draftAlg.Configuration, &config); err != nil {
		RespondBadRequest(w, r, "Invalid algorithm configuration")
		return
	}

	if err := algorithm.ValidateAlgorithm(&config); err != nil {
		RespondValidationError(w, r, "Algorithm validation failed: "+err.Error(), nil)
		return
	}

	// Start transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		RespondInternalError(w, r, "Failed to start transaction")
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Create queries with transaction
	qtx := h.db.Queries.WithTx(tx)

	// Archive any currently active algorithm
	err = qtx.ArchiveActiveAlgorithms(ctx, publisherID)
	if err != nil {
		RespondInternalError(w, r, "Failed to archive current algorithm")
		return
	}

	// Publish the draft
	updatedAt, err := qtx.PublishAlgorithm(ctx, draftAlg.ID)
	if err != nil {
		RespondInternalError(w, r, "Failed to publish algorithm")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		RespondInternalError(w, r, "Failed to commit publish")
		return
	}

	// Invalidate all cache for this publisher (zmanim calculations are now stale)
	if h.cache != nil {
		publisherIDStr := strconv.Itoa(int(publisherID))
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Error("cache invalidation error after publish", "error", err)
		} else {
			slog.Info("cache invalidated after algorithm publish", "publisher_id", publisherIDStr)
		}
	}

	// Log algorithm publish activity
	metadata := map[string]interface{}{
		"algorithm_id": draftAlg.ID,
		"name":         draftAlg.Name,
		"status":       "active",
		"action":       "publish",
	}

	_ = h.activityService.LogAction(
		ctx,
		services.ActionAlgorithmPublish,
		services.ConceptAlgorithm,
		"algorithm",
		strconv.Itoa(int(draftAlg.ID)),
		strconv.Itoa(int(publisherID)),
		metadata,
	)

	RespondJSON(w, r, http.StatusOK, AlgorithmResponse{
		ID:            strconv.Itoa(int(draftAlg.ID)),
		Name:          draftAlg.Name,
		Description:   draftAlg.Description,
		Configuration: &config,
		Status:        "active",
		IsPublic:      draftAlg.IsPublic != nil && *draftAlg.IsPublic,
		CreatedAt:     draftAlg.CreatedAt.Time,
		UpdatedAt:     updatedAt.Time,
	})
}

// GetAlgorithmVersions returns the version history for the publisher's algorithm
// GET /api/v1/publisher/algorithm/versions
func (h *Handlers) GetAlgorithmVersions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get all versions using SQLc
	rows, err := h.db.Queries.GetAlgorithmVersions(ctx, publisherID)
	if err != nil {
		RespondInternalError(w, r, "Failed to fetch versions")
		return
	}

	versions := make([]AlgorithmVersionResponse, 0, len(rows))
	for _, row := range rows {
		versions = append(versions, AlgorithmVersionResponse{
			ID:        strconv.Itoa(int(row.ID)),
			Name:      row.Name,
			Status:    row.StatusKey,
			IsPublic:  row.IsPublic != nil && *row.IsPublic,
			CreatedAt: row.CreatedAt.Time,
		})
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"versions": versions,
		"total":    len(versions),
	})
}

// DeprecateAlgorithmVersion marks an algorithm version as deprecated
// PUT /api/v1/publisher/algorithm/versions/{id}/deprecate
func (h *Handlers) DeprecateAlgorithmVersion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get version ID from URL using chi
	versionIDStr := chi.URLParam(r, "id")
	if versionIDStr == "" {
		RespondBadRequest(w, r, "Version ID is required")
		return
	}

	// Convert to int32
	versionIDInt, err := strconv.Atoi(versionIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid version ID")
		return
	}
	versionID := int32(versionIDInt)

	// Verify version belongs to publisher and archive it using SQLc
	rowsAffected, err2 := h.db.Queries.DeprecateAlgorithmVersion(ctx, sqlcgen.DeprecateAlgorithmVersionParams{
		ID:          versionID,
		PublisherID: publisherID,
	})
	if err2 != nil {
		RespondInternalError(w, r, "Failed to deprecate version")
		return
	}

	if rowsAffected == 0 {
		RespondNotFound(w, r, "Version not found")
		return
	}

	// Log algorithm version deprecation
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		EventCategory: AuditCategoryAlgorithm,
		EventAction:   "deprecate",
		ResourceType:  "algorithm_version",
		ResourceID:    versionIDStr,
		Status:        AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"publisher_id": publisherID,
		},
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"message":    "Version deprecated successfully",
		"version_id": versionIDStr,
	})
}

// GetAlgorithmVersion returns a specific algorithm version
// GET /api/v1/publisher/algorithm/versions/{id}
func (h *Handlers) GetAlgorithmVersion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}

	publisherID, err := publisherIDToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get version ID from URL using chi
	versionIDStr := chi.URLParam(r, "id")
	if versionIDStr == "" {
		RespondBadRequest(w, r, "Version ID is required")
		return
	}

	// Convert to int32
	versionIDInt, err2 := strconv.Atoi(versionIDStr)
	if err2 != nil {
		RespondBadRequest(w, r, "Invalid version ID")
		return
	}
	versionID := int32(versionIDInt)

	// Get version using SQLc
	alg, err2 := h.db.Queries.GetAlgorithmByID(ctx, sqlcgen.GetAlgorithmByIDParams{
		ID:          versionID,
		PublisherID: publisherID,
	})
	if err2 != nil {
		if err2 == pgx.ErrNoRows {
			RespondNotFound(w, r, "Version not found")
		} else {
			RespondInternalError(w, r, "Failed to fetch version")
		}
		return
	}

	var config algorithm.AlgorithmConfig
	_ = json.Unmarshal(alg.Configuration, &config)

	RespondJSON(w, r, http.StatusOK, AlgorithmResponse{
		ID:            strconv.Itoa(int(alg.ID)),
		Name:          alg.Name,
		Description:   alg.Description,
		Configuration: &config,
		Status:        alg.StatusKey,
		IsPublic:      alg.IsPublic != nil && *alg.IsPublic,
		CreatedAt:     alg.CreatedAt.Time,
		UpdatedAt:     alg.UpdatedAt.Time,
	})
}
