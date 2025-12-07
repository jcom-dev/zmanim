package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim-lab/internal/ai"
	"github.com/jcom-dev/zmanim-lab/internal/cache"
	"github.com/jcom-dev/zmanim-lab/internal/db"
	"github.com/jcom-dev/zmanim-lab/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim-lab/internal/middleware"
	"github.com/jcom-dev/zmanim-lab/internal/models"
	"github.com/jcom-dev/zmanim-lab/internal/services"
)

// Handlers holds all HTTP handlers
type Handlers struct {
	db               *db.DB
	cache            *cache.Cache
	publisherService *services.PublisherService
	zmanimService    *services.ZmanimService
	clerkService     *services.ClerkService
	emailService     *services.EmailService
	snapshotService  *services.SnapshotService
	completeExportService *services.CompleteExportService
	// PublisherResolver consolidates publisher ID resolution logic
	publisherResolver *PublisherResolver
	// AI services (optional - may be nil if not configured)
	aiSearch    *ai.SearchService
	aiContext   *ai.ContextService
	aiEmbedding *ai.EmbeddingService
	aiClaude    *ai.ClaudeService
}

// New creates a new handlers instance
func New(database *db.DB) *Handlers {
	publisherService := services.NewPublisherService(database)
	zmanimService := services.NewZmanimService(database, publisherService)
	clerkService, err := services.NewClerkService()
	if err != nil {
		// Log error but continue - Clerk features will be disabled
		fmt.Printf("Warning: Clerk service initialization failed: %v\n", err)
	}
	emailService := services.NewEmailService()
	snapshotService := services.NewSnapshotService(database)
	completeExportService := services.NewCompleteExportService(database)
	publisherResolver := NewPublisherResolver(database)

	return &Handlers{
		db:                database,
		publisherService:  publisherService,
		zmanimService:     zmanimService,
		clerkService:      clerkService,
		emailService:      emailService,
		snapshotService:   snapshotService,
		completeExportService: completeExportService,
		publisherResolver: publisherResolver,
	}
}

// SetAIServices configures the AI services (optional - services may be nil if not configured)
func (h *Handlers) SetAIServices(claude *ai.ClaudeService, search *ai.SearchService, context *ai.ContextService, embedding *ai.EmbeddingService) {
	h.aiClaude = claude
	h.aiSearch = search
	h.aiContext = context
	h.aiEmbedding = embedding
}

// SetCache configures the Redis cache (optional - may be nil if Redis is not available)
func (h *Handlers) SetCache(c *cache.Cache) {
	h.cache = c
}

// HealthCheck returns the health status of the API
// @Summary Health check
// @Description Returns the health status of the API and database connection
// @Tags System
// @Produce json
// @Success 200 {object} APIResponse{data=object} "Service healthy"
// @Failure 503 {object} APIResponse{error=APIError} "Service unavailable"
// @Router /health [get]
func (h *Handlers) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check database health
	dbStatus := "ok"
	if err := h.db.Health(ctx); err != nil {
		dbStatus = "error: " + err.Error()
		RespondServiceUnavailable(w, r, "Database health check failed")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":   "ok",
		"database": dbStatus,
		"version":  "1.0.0",
	})
}

// GetPublishers returns a list of publishers
// @Summary List publishers
// @Description Returns a paginated list of verified publishers, optionally filtered by region or search query
// @Tags Publishers
// @Produce json
// @Param page query int false "Page number (default 1)"
// @Param page_size query int false "Items per page (default 20, max 100)"
// @Param region_id query string false "Filter by region ID"
// @Param q query string false "Search query"
// @Param has_algorithm query bool false "Filter to publishers with published algorithms"
// @Success 200 {object} APIResponse{data=object} "List of publishers"
// @Failure 500 {object} APIResponse{error=APIError} "Internal server error"
// @Router /publishers [get]
func (h *Handlers) GetPublishers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	page := 1
	pageSize := 20
	regionID := r.URL.Query().Get("region_id")
	searchQuery := r.URL.Query().Get("q")
	hasAlgorithm := r.URL.Query().Get("has_algorithm") == "true"

	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := parseIntParam(p); err == nil && parsed > 0 {
			page = parsed
		}
	}

	if ps := r.URL.Query().Get("page_size"); ps != "" {
		if parsed, err := parseIntParam(ps); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}

	// If search query is provided, use search logic
	if searchQuery != "" {
		h.searchPublishers(w, r, ctx, searchQuery, hasAlgorithm, page, pageSize)
		return
	}

	var regionPtr *string
	if regionID != "" {
		regionPtr = &regionID
	}

	publishers, err := h.publisherService.GetPublishers(ctx, page, pageSize, regionPtr)
	if err != nil {
		slog.Error("failed to get publishers", "error", err)
		RespondInternalError(w, r, "Failed to get publishers")
		return
	}

	RespondJSON(w, r, http.StatusOK, publishers)
}

// searchPublishers handles publisher search with optional algorithm filter
func (h *Handlers) searchPublishers(w http.ResponseWriter, r *http.Request, ctx context.Context, query string, hasAlgorithm bool, page, pageSize int) {
	offset := int32((page - 1) * pageSize)
	searchPattern := "%" + query + "%"

	type PublisherSearchResult struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		Description *string `json:"description,omitempty"`
		LogoURL     *string `json:"logo_url,omitempty"`
		IsVerified  bool    `json:"is_verified"`
		ZmanimCount int64   `json:"zmanim_count"`
	}

	var publishers []PublisherSearchResult
	var err error

	if hasAlgorithm {
		results, queryErr := h.db.Queries.SearchPublishersWithAlgorithm(ctx, sqlcgen.SearchPublishersWithAlgorithmParams{
			Name:   searchPattern,
			Limit:  int32(pageSize),
			Offset: offset,
		})
		err = queryErr
		if err == nil {
			for _, p := range results {
				isVerified := false
				if p.IsVerified != nil {
					isVerified = *p.IsVerified
				}
				publishers = append(publishers, PublisherSearchResult{
					ID:          p.ID,
					Name:        p.Name,
					Description: p.Description,
					LogoURL:     p.LogoUrl,
					IsVerified:  isVerified,
					ZmanimCount: p.ZmanimCount,
				})
			}
		}
	} else {
		results, queryErr := h.db.Queries.SearchPublishersAll(ctx, sqlcgen.SearchPublishersAllParams{
			Name:   searchPattern,
			Limit:  int32(pageSize),
			Offset: offset,
		})
		err = queryErr
		if err == nil {
			for _, p := range results {
				isVerified := false
				if p.IsVerified != nil {
					isVerified = *p.IsVerified
				}
				publishers = append(publishers, PublisherSearchResult{
					ID:          p.ID,
					Name:        p.Name,
					Description: p.Description,
					LogoURL:     p.LogoUrl,
					IsVerified:  isVerified,
					ZmanimCount: int64(p.ZmanimCount),
				})
			}
		}
	}

	if err != nil {
		slog.Error("failed to search publishers", "error", err)
		RespondInternalError(w, r, "Failed to search publishers")
		return
	}

	if publishers == nil {
		publishers = []PublisherSearchResult{}
	}

	// Return array directly - RespondJSON wraps it in { "data": [...], "meta": {...} }
	// Frontend accesses response.data to get the array
	RespondJSON(w, r, http.StatusOK, publishers)
}

// GetPublisher returns a single publisher by ID
// @Summary Get publisher
// @Description Returns details for a specific publisher by ID
// @Tags Publishers
// @Produce json
// @Param id path string true "Publisher ID"
// @Success 200 {object} APIResponse{data=models.Publisher} "Publisher details"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Router /publishers/{id} [get]
func (h *Handlers) GetPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	if id == "" {
		RespondValidationError(w, r, "Publisher ID is required", nil)
		return
	}

	publisher, err := h.publisherService.GetPublisherByID(ctx, id)
	if err != nil {
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	RespondJSON(w, r, http.StatusOK, publisher)
}

// CalculateZmanim calculates zmanim for a given location and date
func (h *Handlers) CalculateZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.ZmanimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate request
	validationErrors := make(map[string]string)
	if req.Date == "" {
		validationErrors["date"] = "Date is required"
	}
	if req.Latitude < -90 || req.Latitude > 90 {
		validationErrors["latitude"] = "Latitude must be between -90 and 90"
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		validationErrors["longitude"] = "Longitude must be between -180 and 180"
	}
	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	if req.Timezone == "" {
		req.Timezone = "UTC"
	}

	response, err := h.zmanimService.CalculateZmanim(ctx, &req)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetLocations returns a list of predefined locations
func (h *Handlers) GetLocations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	cities, err := h.db.Queries.GetTopCitiesAsLocations(ctx, 100)
	if err != nil {
		slog.Error("failed to get locations", "error", err)
		RespondInternalError(w, r, "Failed to get locations")
		return
	}

	var locations []map[string]interface{}
	for _, city := range cities {
		locations = append(locations, map[string]interface{}{
			"id":        city.ID,
			"name":      city.Name,
			"latitude":  city.Latitude,
			"longitude": city.Longitude,
			"timezone":  city.Timezone,
		})
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"locations": locations,
		"total":     len(locations),
	})
}

// Helper functions

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
	}
}

func respondError(w http.ResponseWriter, status int, message string, err error) {
	errorMsg := message
	if err != nil {
		errorMsg = message + ": " + err.Error()
	}

	response := models.ErrorResponse{
		Error:   http.StatusText(status),
		Message: errorMsg,
		Code:    status,
	}

	respondJSON(w, status, response)
}

func parseIntParam(s string) (int, error) {
	var i int
	err := json.Unmarshal([]byte(s), &i)
	return i, err
}

// GetPublisherProfile returns the current publisher's profile
// @Summary Get publisher profile
// @Description Returns the authenticated publisher's profile
// @Tags Publisher
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string false "Publisher ID (optional, uses default if not specified)"
// @Success 200 {object} APIResponse{data=models.Publisher} "Publisher profile"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Router /publisher/profile [get]
func (h *Handlers) GetPublisherProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or query param
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		publisherID = r.URL.Query().Get("publisher_id")
	}

	var publisher models.Publisher

	if publisherID != "" {
		// Convert string ID to int32
		id, convErr := stringToInt32(publisherID)
		if convErr != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}
		publisherRow, err := h.db.Queries.GetPublisherFullProfileByID(ctx, id)
		if err != nil {
			slog.Error("GetPublisherProfile query failed", "error", err, "publisher_id", publisherID, "user_id", userID)
			if err.Error() == "no rows in result set" {
				RespondNotFound(w, r, "Publisher profile not found")
				return
			}
			RespondInternalError(w, r, "Failed to fetch publisher profile")
			return
		}

		publisher = models.Publisher{
			ID:           int32ToString(publisherRow.ID),
			ClerkUserID:  publisherRow.ClerkUserID,
			Name:         publisherRow.Name,
			Email:        publisherRow.Email,
			Description:  publisherRow.Description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			Status:       publisherRow.StatusKey,
			IsVerified:   publisherRow.IsVerified,
			ContactEmail: publisherRow.Email,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != "" {
			publisher.Bio = &publisherRow.Bio
		}
	} else {
		publisherRow, err := h.db.Queries.GetPublisherFullProfileByClerkUserID(ctx, &userID)
		if err != nil {
			slog.Error("GetPublisherProfile query failed", "error", err, "publisher_id", publisherID, "user_id", userID)
			if err.Error() == "no rows in result set" {
				RespondNotFound(w, r, "Publisher profile not found")
				return
			}
			RespondInternalError(w, r, "Failed to fetch publisher profile")
			return
		}

		publisher = models.Publisher{
			ID:           int32ToString(publisherRow.ID),
			ClerkUserID:  publisherRow.ClerkUserID,
			Name:         publisherRow.Name,
			Email:        publisherRow.Email,
			Description:  publisherRow.Description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			Status:       publisherRow.StatusKey,
			IsVerified:   publisherRow.IsVerified,
			ContactEmail: publisherRow.Email,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != "" {
			publisher.Bio = &publisherRow.Bio
		}
	}

	RespondJSON(w, r, http.StatusOK, publisher)
}

// GetAccessiblePublishers returns publishers the current user has access to
// @Summary Get accessible publishers
// @Description Returns a list of publishers the authenticated user has access to
// @Tags Publisher
// @Produce json
// @Security BearerAuth
// @Success 200 {object} APIResponse{data=object} "List of accessible publishers"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Router /publisher/accessible [get]
func (h *Handlers) GetAccessiblePublishers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// If no Clerk service, fall back to getting publisher by clerk_user_id
	if h.clerkService == nil {
		publisher, err := h.db.Queries.GetAccessiblePublishersByClerkUserID(ctx, &userID)
		if err != nil {
			// No publisher found - return empty list
			RespondJSON(w, r, http.StatusOK, map[string]interface{}{
				"publishers": []interface{}{},
			})
			return
		}

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"publishers": []map[string]string{{
				"id":     publisher.ID,
				"name":   publisher.Name,
				"status": publisher.StatusKey,
			}},
		})
		return
	}

	// Get user's publisher_access_list from Clerk
	metadata, err := h.clerkService.GetUserPublicMetadata(ctx, userID)
	if err != nil {
		// Fall back to database lookup
		publisher, err := h.db.Queries.GetAccessiblePublishersByClerkUserID(ctx, &userID)
		if err != nil {
			// No publisher found - return empty list
			RespondJSON(w, r, http.StatusOK, map[string]interface{}{
				"publishers": []interface{}{},
			})
			return
		}

		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"publishers": []map[string]string{{
				"id":     publisher.ID,
				"name":   publisher.Name,
				"status": publisher.StatusKey,
			}},
		})
		return
	}

	// Extract publisher_access_list from metadata
	var publisherIDs []int32
	if accessList, ok := metadata["publisher_access_list"].([]interface{}); ok {
		for _, v := range accessList {
			if s, ok := v.(string); ok {
				id, err := stringToInt32(s)
				if err != nil {
					slog.Warn("invalid publisher ID in access list", "id", s, "error", err)
					continue
				}
				publisherIDs = append(publisherIDs, id)
			}
		}
	}

	// If no publisher access list, return empty (admins don't auto-get publishers)
	if len(publisherIDs) == 0 {
		// For admin users without publisher access, just return empty list
		// They can create/access publishers through the admin panel
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"publishers": []interface{}{},
		})
		return
	}

	// Fetch publisher details from database
	publisherRows, err := h.db.Queries.GetAccessiblePublishersByIDs(ctx, publisherIDs)
	if err != nil {
		slog.Error("failed to get accessible publishers", "error", err)
		RespondInternalError(w, r, "Failed to get publishers")
		return
	}

	publishers := make([]map[string]string, 0)
	for _, p := range publisherRows {
		publishers = append(publishers, map[string]string{
			"id":     p.ID,
			"name":   p.Name,
			"status": p.StatusKey,
		})
	}

	// Return the publishers (empty array if user has no publisher access)
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"publishers": publishers,
	})
}

// UpdatePublisherProfile updates the current publisher's profile
// @Summary Update publisher profile
// @Description Updates the authenticated publisher's profile information
// @Tags Publisher
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string false "Publisher ID"
// @Param request body models.PublisherProfileUpdateRequest true "Profile update data"
// @Success 200 {object} APIResponse{data=models.Publisher} "Updated publisher profile"
// @Failure 400 {object} APIResponse{error=APIError} "Invalid request"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Router /publisher/profile [put]
func (h *Handlers) UpdatePublisherProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or query param
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		publisherID = r.URL.Query().Get("publisher_id")
	}

	// Parse request body
	var req models.PublisherProfileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Name != nil && *req.Name == "" {
		RespondBadRequest(w, r, "Name cannot be empty")
		return
	}
	if req.Email != nil && *req.Email == "" {
		RespondBadRequest(w, r, "Email cannot be empty")
		return
	}

	// Check if at least one field is being updated
	if req.Name == nil && req.Email == nil && req.Website == nil && req.Bio == nil {
		RespondBadRequest(w, r, "No fields to update")
		return
	}

	var publisher models.Publisher

	if publisherID != "" {
		// Convert string ID to int32
		id, convErr := stringToInt32(publisherID)
		if convErr != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}

		publisherRow, err := h.db.Queries.UpdatePublisherProfile(ctx, sqlcgen.UpdatePublisherProfileParams{
			ID:            id,
			UpdateName:    req.Name,
			UpdateEmail:   req.Email,
			UpdateWebsite: req.Website,
			UpdateBio:     req.Bio,
		})

		if err != nil {
			slog.Error("UpdatePublisherProfile query failed", "error", err, "publisher_id", publisherID, "user_id", userID)
			if err.Error() == "no rows in result set" {
				RespondNotFound(w, r, "Publisher profile not found")
				return
			}
			RespondInternalError(w, r, "Failed to update publisher profile")
			return
		}

		// Map to Publisher model
		description := ""
		if publisherRow.Description != nil {
			description = *publisherRow.Description
		}

		publisher = models.Publisher{
			ID:           int32ToString(publisherRow.ID),
			ClerkUserID:  publisherRow.ClerkUserID,
			Name:         publisherRow.Name,
			Email:        publisherRow.Email,
			Description:  description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			ContactEmail: publisherRow.Email,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != nil {
			publisher.Bio = publisherRow.Bio
		}
	} else {
		publisherRow, err := h.db.Queries.UpdatePublisherProfileByClerkUserID(ctx, sqlcgen.UpdatePublisherProfileByClerkUserIDParams{
			ClerkUserID:   &userID,
			UpdateName:    req.Name,
			UpdateEmail:   req.Email,
			UpdateWebsite: req.Website,
			UpdateBio:     req.Bio,
		})

		if err != nil {
			slog.Error("UpdatePublisherProfile query failed", "error", err, "publisher_id", publisherID, "user_id", userID)
			if err.Error() == "no rows in result set" {
				RespondNotFound(w, r, "Publisher profile not found")
				return
			}
			RespondInternalError(w, r, "Failed to update publisher profile")
			return
		}

		// Map to Publisher model
		description := ""
		if publisherRow.Description != nil {
			description = *publisherRow.Description
		}

		publisher = models.Publisher{
			ID:           int32ToString(publisherRow.ID),
			ClerkUserID:  publisherRow.ClerkUserID,
			Name:         publisherRow.Name,
			Email:        publisherRow.Email,
			Description:  description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			ContactEmail: publisherRow.Email,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != nil {
			publisher.Bio = publisherRow.Bio
		}
	}

	RespondJSON(w, r, http.StatusOK, publisher)
}

// GetPublisherActivity returns the activity log for the publisher
// GET /api/publisher/activity
func (h *Handlers) GetPublisherActivity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or query
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		publisherID = r.URL.Query().Get("publisher_id")
	}

	// If no publisher ID provided, get from database using clerk_user_id
	if publisherID == "" {
		pubID, err := h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			slog.Error("failed to get publisher by clerk user ID", "error", err)
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		publisherID = int32ToString(pubID)
	}

	// For now, return empty activities (will be populated when activity_logs table is created)
	// Parse limit/offset
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := parseIntParam(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := parseIntParam(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Placeholder response - will query activity_logs table when created
	activities := []map[string]interface{}{}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"activities":  activities,
		"total":       0,
		"limit":       limit,
		"offset":      offset,
		"next_offset": nil,
	})
}

// GetPublisherAnalytics returns analytics for the publisher
// GET /api/publisher/analytics
func (h *Handlers) GetPublisherAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or query
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		publisherID = r.URL.Query().Get("publisher_id")
	}

	// If no publisher ID provided, get from database using clerk_user_id
	if publisherID == "" {
		pubID, err := h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			slog.Error("failed to get publisher by clerk user ID", "error", err)
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		publisherID = int32ToString(pubID)
	}

	// Convert publisherID to int32 for queries
	pubID, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get coverage counts
	coverageAreas, err := h.db.Queries.GetPublisherCoverageCount(ctx, pubID)
	if err != nil {
		slog.Error("failed to get coverage count", "error", err)
		coverageAreas = 0
	}

	// Estimate cities count
	citiesCovered, err := h.db.Queries.GetPublisherCitiesCovered(ctx, pubID)
	if err != nil {
		slog.Error("failed to get cities covered", "error", err)
		citiesCovered = 0
	}

	// For now, calculations are placeholders (will be implemented with calculation_logs table)
	calculationsTotal := 0
	calculationsThisMonth := 0

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"calculations_total":      calculationsTotal,
		"calculations_this_month": calculationsThisMonth,
		"coverage_areas":          coverageAreas,
		"cities_covered":          citiesCovered,
	})
}

// GetPublisherDashboardSummary returns a summary of the publisher's dashboard data
// @Summary Get dashboard summary
// @Description Returns a summary of the publisher's profile, algorithm, coverage, and analytics
// @Tags Publisher
// @Produce json
// @Security BearerAuth
// @Param X-Publisher-Id header string false "Publisher ID"
// @Success 200 {object} APIResponse{data=object} "Dashboard summary"
// @Failure 401 {object} APIResponse{error=APIError} "Unauthorized"
// @Failure 404 {object} APIResponse{error=APIError} "Publisher not found"
// @Router /publisher/dashboard [get]
func (h *Handlers) GetPublisherDashboardSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// Get publisher ID from header or query
	publisherID := r.Header.Get("X-Publisher-Id")
	if publisherID == "" {
		publisherID = r.URL.Query().Get("publisher_id")
	}

	// If no publisher ID provided, get from database using clerk_user_id
	if publisherID == "" {
		pubID, err := h.db.Queries.GetPublisherByClerkUserID(ctx, &userID)
		if err != nil {
			slog.Error("failed to get publisher by clerk user ID", "error", err)
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		publisherID = int32ToString(pubID)
	}

	// Convert publisherID to int32 for queries
	pubID, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get profile summary
	profileData, err := h.db.Queries.GetPublisherDashboardSummary(ctx, pubID)
	if err != nil {
		slog.Error("failed to get publisher dashboard summary", "error", err)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	profileSummary := map[string]interface{}{
		"name":        profileData.Name,
		"is_verified": profileData.IsVerified,
		"status":      profileData.StatusKey,
	}

	// Get algorithm summary
	algorithmSummary := map[string]interface{}{
		"status": "none",
	}
	algorithmData, err := h.db.Queries.GetPublisherAlgorithmSummary(ctx, pubID)
	if err == nil {
		algorithmSummary["status"] = algorithmData.StatusKey
		algorithmSummary["name"] = algorithmData.Name
		algorithmSummary["updated_at"] = algorithmData.UpdatedAt
	}

	// Get coverage summary
	coverageAreas, err := h.db.Queries.GetPublisherCoverageCount(ctx, pubID)
	if err != nil {
		slog.Error("failed to get coverage count", "error", err)
		coverageAreas = 0
	}

	citiesCovered, err := h.db.Queries.GetPublisherCitiesCovered(ctx, pubID)
	if err != nil {
		slog.Error("failed to get cities covered", "error", err)
		citiesCovered = 0
	}

	coverageSummary := map[string]interface{}{
		"total_areas":  coverageAreas,
		"total_cities": citiesCovered,
	}

	// Analytics placeholder (will be enhanced in Story 2-7)
	var analyticsSummary struct {
		CalculationsThisMonth int `json:"calculations_this_month"`
		CalculationsTotal     int `json:"calculations_total"`
	}
	// For now, return 0 - will be implemented with analytics tables
	analyticsSummary.CalculationsThisMonth = 0
	analyticsSummary.CalculationsTotal = 0

	// Recent activity placeholder (will be enhanced in Story 2-8)
	recentActivity := []map[string]interface{}{}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"profile":         profileSummary,
		"algorithm":       algorithmSummary,
		"coverage":        coverageSummary,
		"analytics":       analyticsSummary,
		"recent_activity": recentActivity,
	})
}
