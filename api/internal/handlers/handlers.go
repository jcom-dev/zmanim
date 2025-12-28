// Package handlers provides HTTP handlers for the zmanim API.
// Handlers follow a consistent 6-step pattern for request processing.
//
// # Handler Pattern
//
// Every handler should follow this structure:
//
//  1. Resolve publisher context (if needed): pc := h.publisherResolver.MustResolve(w, r)
//  2. Extract URL parameters: id := chi.URLParam(r, "id")
//  3. Parse request body (if any): json.NewDecoder(r.Body).Decode(&req)
//  4. Validate input parameters
//  5. Execute business logic via SQLc queries (NO raw SQL)
//  6. Return response: RespondJSON(w, r, http.StatusOK, result)
//
// # File Organization
//
// Handlers are organized by domain:
//   - handlers.go: Core handlers, main entry point, service initialization
//   - zmanim.go: Public zmanim calculation endpoints
//   - publisher_*.go: Publisher dashboard and management
//   - admin_*.go: Admin panel endpoints
//   - external_api.go: M2M external API for integrations
//   - geo.go, localities.go: Geographic and location endpoints
//
// # Response Helpers
//
// Use the response helpers from response.go for consistent JSON responses:
//   - RespondJSON: Success responses with consistent envelope
//   - RespondBadRequest, RespondNotFound, etc.: Error responses
//
// # Authentication
//
// Auth is handled by middleware. Use middleware.GetUserID(ctx) to get
// the authenticated user's Clerk ID.

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/ai"
	"github.com/jcom-dev/zmanim/internal/cache"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/models"
	"github.com/jcom-dev/zmanim/internal/services"
)

// Handlers holds all HTTP handlers
type Handlers struct {
	db                    *db.DB
	cache                 *cache.Cache
	publisherService      *services.PublisherService
	zmanimService         *services.ZmanimService
	compatZmanimService   *services.CompatZmanimService
	clerkService          *services.ClerkService
	emailService          *services.EmailService
	recaptchaService      *services.RecaptchaService
	snapshotService       *services.SnapshotService
	completeExportService *services.CompleteExportService
	calculationLogService *services.CalculationLogService
	activityService       *services.ActivityService
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
	compatZmanimService := services.NewCompatZmanimService(database, publisherService)
	clerkService, err := services.NewClerkService()
	if err != nil {
		// Log error but continue - Clerk features will be disabled
		slog.Warn("clerk service initialization failed", "error", err)
	}
	emailService := services.NewEmailService()
	recaptchaService := services.NewRecaptchaService()
	snapshotService := services.NewSnapshotService(database)
	completeExportService := services.NewCompleteExportService(database)
	activityService := services.NewActivityService(database, clerkService)
	publisherResolver := NewPublisherResolver(database)

	return &Handlers{
		db:                    database,
		publisherService:      publisherService,
		compatZmanimService:   compatZmanimService,
		clerkService:          clerkService,
		emailService:          emailService,
		recaptchaService:      recaptchaService,
		snapshotService:       snapshotService,
		completeExportService: completeExportService,
		activityService:       activityService,
		publisherResolver:     publisherResolver,
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

// SetCalculationLogService configures the calculation logging service
func (h *Handlers) SetCalculationLogService(s *services.CalculationLogService) {
	h.calculationLogService = s
}

// SetZmanimService configures the zmanim service
func (h *Handlers) SetZmanimService(s *services.ZmanimService) {
	h.zmanimService = s
}

// GetPublisherResolver returns the publisher resolver for use by other handlers
func (h *Handlers) GetPublisherResolver() *PublisherResolver {
	return h.publisherResolver
}

// HealthCheck returns the health status of the API
//
//	@Summary		Health check
//	@Description	Returns the health status of the API and database connection
//	@Tags			System
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=object}	"Service healthy"
//	@Failure		503	{object}	APIResponse{error=APIError}	"Service unavailable"
//	@Router			/health [get]
func (h *Handlers) HealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check database health
	dbStatus := "ok"
	if err := h.db.Health(ctx); err != nil {
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
//
//	@Summary		List publishers
//	@Description	Returns a paginated list of verified publishers, optionally filtered by region or search query
//	@Tags			Publishers
//	@Produce		json
//	@Param			page			query		int							false	"Page number (default 1)"
//	@Param			page_size		query		int							false	"Items per page (default 20, max 100)"
//	@Param			region_id		query		string						false	"Filter by region ID"
//	@Param			q				query		string						false	"Search query"
//	@Param			has_algorithm	query		bool						false	"Filter to publishers with published algorithms"
//	@Success		200				{object}	APIResponse{data=object}	"List of publishers"
//	@Failure		500				{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/publishers [get]
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
//
//	@Summary		Get publisher
//	@Description	Returns details for a specific publisher by ID
//	@Tags			Publishers
//	@Produce		json
//	@Param			id	path		string								true	"Publisher ID"
//	@Success		200	{object}	APIResponse{data=models.Publisher}	"Publisher details"
//	@Failure		400	{object}	APIResponse{error=APIError}			"Invalid request"
//	@Failure		404	{object}	APIResponse{error=APIError}			"Publisher not found"
//	@Router			/publishers/{id} [get]
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

	response, err := h.compatZmanimService.CalculateZmanim(ctx, &req)
	if err != nil {
		RespondInternalError(w, r, "Failed to calculate zmanim")
		return
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetLocations returns a list of predefined locations
func (h *Handlers) GetLocations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	localities, err := h.db.Queries.GetTopLocalitiesAsLocations(ctx, 100)
	if err != nil {
		slog.Error("failed to get locations", "error", err)
		RespondInternalError(w, r, "Failed to get locations")
		return
	}

	var locations []map[string]interface{}
	for _, loc := range localities {
		locations = append(locations, map[string]interface{}{
			"id":        loc.ID,
			"name":      loc.Name,
			"latitude":  loc.Latitude,
			"longitude": loc.Longitude,
			"timezone":  loc.Timezone,
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
//
//	@Summary		Get publisher profile
//	@Description	Returns the authenticated publisher's profile
//	@Tags			Publisher
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string								false	"Publisher ID (optional, uses default if not specified)"
//	@Success		200				{object}	APIResponse{data=models.Publisher}	"Publisher profile"
//	@Failure		401				{object}	APIResponse{error=APIError}			"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}			"Publisher not found"
//	@Router			/publisher/profile [get]
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
			Email:        publisherRow.ContactEmail,
			Description:  publisherRow.Description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			Status:       publisherRow.StatusKey,
			IsVerified:   publisherRow.IsVerified,
			ContactEmail: publisherRow.ContactEmail,
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
			Email:        publisherRow.ContactEmail,
			Description:  publisherRow.Description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			Status:       publisherRow.StatusKey,
			IsVerified:   publisherRow.IsVerified,
			ContactEmail: publisherRow.ContactEmail,
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
//
//	@Summary		Get accessible publishers
//	@Description	Returns a list of publishers the authenticated user has access to
//	@Tags			Publisher
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	APIResponse{data=object}	"List of accessible publishers"
//	@Failure		401	{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Router			/publisher/accessible [get]
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

// SelectPublisher sets the selected publisher ID in a cookie
//
//	@Summary		Select publisher
//	@Description	Sets the selected publisher ID in an httpOnly cookie for multi-publisher users
//	@Tags			Publisher
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			request	body		object{publisher_id=string}	true	"Publisher selection request"
//	@Success		200		{object}	APIResponse{data=object}	"Publisher selected successfully"
//	@Failure		400		{object}	APIResponse{error=APIError}	"Invalid request"
//	@Failure		401		{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		403		{object}	APIResponse{error=APIError}	"Access denied to publisher"
//	@Router			/publisher/select [post]
func (h *Handlers) SelectPublisher(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Get user ID from context (set by auth middleware)
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "User ID not found in context")
		return
	}

	// 2. Parse request body
	var req struct {
		PublisherID string `json:"publisher_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate publisher_id
	if req.PublisherID == "" {
		RespondValidationError(w, r, "publisher_id is required", nil)
		return
	}

	publisherIDInt, err := stringToInt32(req.PublisherID)
	if err != nil {
		RespondValidationError(w, r, "Invalid publisher_id", nil)
		return
	}

	// 4. Verify user has access to this publisher
	// First check if Clerk service is available for access list verification
	hasAccess := false
	if h.clerkService != nil {
		metadata, err := h.clerkService.GetUserPublicMetadata(ctx, userID)
		if err == nil {
			// Check publisher_access_list
			if accessList, ok := metadata["publisher_access_list"].([]interface{}); ok {
				for _, v := range accessList {
					if s, ok := v.(string); ok && s == req.PublisherID {
						hasAccess = true
						break
					}
				}
			}
		}
	}

	// Fall back to database check if Clerk check didn't work
	if !hasAccess {
		publisher, err := h.db.Queries.GetAccessiblePublishersByClerkUserID(ctx, &userID)
		if err == nil && publisher.ID == req.PublisherID {
			hasAccess = true
		}
	}

	if !hasAccess {
		RespondForbidden(w, r, "Access denied to this publisher")
		return
	}

	// 5. Get publisher details for response
	publisher, err := h.db.Queries.GetPublisherByID(ctx, publisherIDInt)
	if err != nil {
		slog.Error("failed to get publisher", "error", err, "publisher_id", req.PublisherID)
		RespondNotFound(w, r, "Publisher not found")
		return
	}

	// 6. Set httpOnly cookie (30 days expiry)
	cookie := &http.Cookie{
		Name:     "zmanim_publisher_id",
		Value:    req.PublisherID,
		Path:     "/",
		MaxAge:   2592000, // 30 days in seconds
		HttpOnly: true,
		Secure:   r.URL.Scheme == "https" || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(w, cookie)

	// 7. Respond with selected publisher details
	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"publisher_id": req.PublisherID,
		"name":         publisher.Name,
		"logo_url":     publisher.LogoUrl,
	})
}

// UpdatePublisherProfile updates the current publisher's profile
//
//	@Summary		Update publisher profile
//	@Description	Updates the authenticated publisher's profile information
//	@Tags			Publisher
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string									false	"Publisher ID"
//	@Param			request			body		models.PublisherProfileUpdateRequest	true	"Profile update data"
//	@Success		200				{object}	APIResponse{data=models.Publisher}		"Updated publisher profile"
//	@Failure		400				{object}	APIResponse{error=APIError}				"Invalid request"
//	@Failure		401				{object}	APIResponse{error=APIError}				"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}				"Publisher not found"
//	@Router			/publisher/profile [put]
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
	var beforeState map[string]interface{}

	if publisherID != "" {
		// Convert string ID to int32
		id, convErr := stringToInt32(publisherID)
		if convErr != nil {
			RespondBadRequest(w, r, "Invalid publisher ID")
			return
		}

		// Fetch current state BEFORE update for audit logging
		currentProfile, err := h.db.Queries.GetPublisherFullProfileByID(ctx, id)
		if err != nil {
			slog.Error("Failed to fetch publisher profile before update", "error", err, "publisher_id", publisherID)
			RespondNotFound(w, r, "Publisher profile not found")
			return
		}

		// Capture before state
		beforeState = map[string]interface{}{
			"name":    currentProfile.Name,
			"email":   currentProfile.ContactEmail,
			"website": currentProfile.Website,
		}
		if currentProfile.Bio != "" {
			beforeState["bio"] = currentProfile.Bio
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
			Email:        publisherRow.ContactEmail,
			Description:  description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			ContactEmail: publisherRow.ContactEmail,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != nil {
			publisher.Bio = publisherRow.Bio
		}
	} else {
		// First, get publisher by clerk user ID to fetch before state
		currentProfile, err := h.db.Queries.GetPublisherFullProfileByClerkUserID(ctx, &userID)
		if err != nil {
			slog.Error("Failed to fetch publisher profile before update", "error", err, "user_id", userID)
			RespondNotFound(w, r, "Publisher profile not found")
			return
		}

		// Capture before state
		beforeState = map[string]interface{}{
			"name":    currentProfile.Name,
			"email":   currentProfile.ContactEmail,
			"website": currentProfile.Website,
		}
		if currentProfile.Bio != "" {
			beforeState["bio"] = currentProfile.Bio
		}

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
			Email:        publisherRow.ContactEmail,
			Description:  description,
			Website:      publisherRow.Website,
			LogoURL:      publisherRow.LogoUrl,
			LogoData:     publisherRow.LogoData,
			ContactEmail: publisherRow.ContactEmail,
			CreatedAt:    publisherRow.CreatedAt.Time,
			UpdatedAt:    publisherRow.UpdatedAt.Time,
		}

		if publisherRow.Bio != nil {
			publisher.Bio = publisherRow.Bio
		}

		publisherID = publisher.ID
	}

	// Build after state for audit logging
	afterState := map[string]interface{}{
		"name":    publisher.Name,
		"email":   publisher.Email,
		"website": publisher.Website,
	}
	if publisher.Bio != nil {
		afterState["bio"] = *publisher.Bio
	}

	// Create publisher context for audit logging
	pc := &PublisherContext{
		PublisherID: publisherID,
		UserID:      userID,
	}

	// Log profile update with before/after state
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:    services.ActionProfileUpdate,
		ResourceType:  "publisher_profile",
		ResourceID:    publisher.ID,
		ResourceName:  publisher.Name,
		ChangesBefore: beforeState,
		ChangesAfter:  afterState,
		Status:        AuditStatusSuccess,
	})

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

	// Parse limit/offset
	limit := int32(50)
	offset := int32(0)
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := parseIntParam(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = int32(parsed)
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := parseIntParam(o); err == nil && parsed >= 0 {
			offset = int32(parsed)
		}
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Fetch activities from database
	actions, err := h.db.Queries.GetPublisherActivities(ctx, sqlcgen.GetPublisherActivitiesParams{
		PublisherID: &publisherIDInt,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		slog.Error("failed to get publisher activities", "error", err, "publisher_id", publisherID)
		RespondInternalError(w, r, "Failed to fetch activities")
		return
	}

	// Format activities for response
	activities := make([]map[string]interface{}, 0, len(actions))
	for _, action := range actions {
		activity := map[string]interface{}{
			"id":          action.ID,
			"action_type": action.ActionType,
			"entity_type": action.EntityType,
			"entity_id":   action.EntityID,
			"created_at":  action.StartedAt.Time,
			"status":      action.Status,
		}

		// Add actor information from metadata
		if action.Metadata != nil {
			var metadata map[string]interface{}
			if err := json.Unmarshal(action.Metadata, &metadata); err == nil {
				if actorName, ok := metadata["actor_name"].(string); ok {
					activity["actor_name"] = actorName
				}
				// Add other metadata fields
				activity["metadata"] = metadata
			}
		}

		// Format description based on action type
		description := formatActionDescription(action.ActionType, action.EntityType, action.Metadata)
		activity["description"] = description

		activities = append(activities, activity)
	}

	// Calculate next offset
	var nextOffset *int32
	if len(actions) == int(limit) {
		next := offset + limit
		nextOffset = &next
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"activities":  activities,
		"total":       len(activities),
		"limit":       limit,
		"offset":      offset,
		"next_offset": nextOffset,
	})
}

// formatActionDescription creates a human-readable description for an action
func formatActionDescription(actionType string, entityType *string, metadataJSON []byte) string {
	switch actionType {
	case "profile_update":
		return "Updated publisher profile"
	case "algorithm_save":
		return "Saved algorithm draft"
	case "algorithm_publish":
		return "Published algorithm"
	case "coverage_add":
		return "Added coverage area"
	case "coverage_remove":
		return "Removed coverage area"
	default:
		if entityType != nil {
			return fmt.Sprintf("Performed %s on %s", actionType, *entityType)
		}
		return fmt.Sprintf("Performed %s", actionType)
	}
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

	// Estimate localities count
	localitiesCovered, err := h.db.Queries.GetPublisherLocalitiesCovered(ctx, pubID)
	if err != nil {
		slog.Error("failed to get localities covered", "error", err)
		localitiesCovered = 0
	}

	// Get real calculation stats from database
	calculationsTotal, err := h.db.Queries.GetPublisherTotalCalculations(ctx, pubID)
	if err != nil {
		slog.Error("failed to get total calculations", "error", err, "publisher_id", pubID)
		calculationsTotal = 0
	}

	calculationsThisMonth, err := h.db.Queries.GetPublisherMonthlyCalculations(ctx, pubID)
	if err != nil {
		slog.Error("failed to get monthly calculations", "error", err, "publisher_id", pubID)
		calculationsThisMonth = 0
	}

	// Get cache hit ratio
	cacheStats, err := h.db.Queries.GetPublisherCacheHitRatio(ctx, pubID)
	if err != nil {
		slog.Error("failed to get cache hit ratio", "error", err, "publisher_id", pubID)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"calculations_total":      calculationsTotal,
		"calculations_this_month": calculationsThisMonth,
		"cache_hit_ratio":         cacheStats.CacheHitRatio,
		"coverage_areas":          coverageAreas,
		"localities_covered":      localitiesCovered,
	})
}

// GetPublisherDashboardSummary returns a summary of the publisher's dashboard data
//
//	@Summary		Get dashboard summary
//	@Description	Returns a summary of the publisher's profile, algorithm, coverage, and analytics
//	@Tags			Publisher
//	@Produce		json
//	@Security		BearerAuth
//	@Param			X-Publisher-Id	header		string						false	"Publisher ID"
//	@Success		200				{object}	APIResponse{data=object}	"Dashboard summary"
//	@Failure		401				{object}	APIResponse{error=APIError}	"Unauthorized"
//	@Failure		404				{object}	APIResponse{error=APIError}	"Publisher not found"
//	@Router			/publisher/dashboard [get]
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

	localitiesCovered, err := h.db.Queries.GetPublisherLocalitiesCovered(ctx, pubID)
	if err != nil {
		slog.Error("failed to get localities covered", "error", err)
		localitiesCovered = 0
	}

	coverageSummary := map[string]interface{}{
		"total_areas":      coverageAreas,
		"total_localities": localitiesCovered,
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
