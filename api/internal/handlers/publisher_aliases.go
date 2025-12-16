package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// CreateAliasRequest is the request body for creating/updating an alias
type CreateAliasRequest struct {
	AliasHebrew          string  `json:"alias_hebrew"`
	AliasEnglish         *string `json:"alias_english,omitempty"`
	AliasTransliteration *string `json:"alias_transliteration,omitempty"`
}

// AliasResponse is the response for a single alias
type AliasResponse struct {
	ID                   string  `json:"id"`
	ZmanKey              string  `json:"zman_key"`
	AliasHebrew          string  `json:"alias_hebrew"`
	AliasEnglish         *string `json:"alias_english,omitempty"`
	AliasTransliteration *string `json:"alias_transliteration,omitempty"`
	CanonicalHebrewName  string  `json:"canonical_hebrew_name"`
	CanonicalEnglishName string  `json:"canonical_english_name"`
	CreatedAt            string  `json:"created_at"`
}

// AliasListResponse is the response for listing aliases
type AliasListResponse struct {
	Aliases []AliasResponse `json:"aliases"`
}

// CreateOrUpdateAlias handles PUT /api/v1/publisher/zmanim/{zmanKey}/alias
// Creates a new alias or updates existing one (deletes old, creates new)
func (h *Handlers) CreateOrUpdateAlias(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// Step 2: Extract URL params
	zmanKey := chi.URLParam(r, "zmanKey")
	if zmanKey == "" {
		RespondBadRequest(w, r, "zman_key is required")
		return
	}

	// Step 3: Parse request body
	var req CreateAliasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Step 4: Validate inputs
	if req.AliasHebrew == "" {
		RespondValidationError(w, r, "Hebrew alias is required", nil)
		return
	}

	// Step 5: Delete existing alias (if any) and create new one
	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// First delete any existing primary alias for this zman
	_ = h.db.Queries.DeletePublisherZmanAliasByZmanKey(ctx, sqlcgen.DeletePublisherZmanAliasByZmanKeyParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})

	// Create new alias
	alias, err := h.db.Queries.CreatePublisherZmanAlias(ctx, sqlcgen.CreatePublisherZmanAliasParams{
		PublisherID:          publisherID,
		ZmanKey:              zmanKey,
		AliasHebrew:          req.AliasHebrew,
		AliasEnglish:         req.AliasEnglish,
		AliasTransliteration: req.AliasTransliteration,
		Context:              nil,
		IsPrimary:            true,
		SortOrder:            intPtr(0),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			RespondNotFound(w, r, "Zman not found in your published zmanim")
			return
		}
		slog.Error("failed to create alias", "error", err, "publisher_id", pc.PublisherID, "zman_key", zmanKey)
		RespondInternalError(w, r, "Failed to save alias")
		return
	}

	// Get the full alias with canonical names
	fullAlias, err := h.db.Queries.GetPublisherZmanAlias(ctx, sqlcgen.GetPublisherZmanAliasParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})
	if err != nil {
		slog.Error("failed to get alias after create", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to retrieve alias")
		return
	}

	// Step 6: Respond
	response := AliasResponse{
		ID:                   int32ToString(alias.ID),
		ZmanKey:              fullAlias.ZmanKey,
		AliasHebrew:          fullAlias.AliasHebrew,
		AliasEnglish:         fullAlias.AliasEnglish,
		AliasTransliteration: fullAlias.AliasTransliteration,
		CanonicalHebrewName:  fullAlias.CanonicalHebrewName,
		CanonicalEnglishName: fullAlias.CanonicalEnglishName,
		CreatedAt:            alias.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetAlias handles GET /api/v1/publisher/zmanim/{zmanKey}/alias
func (h *Handlers) GetAlias(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// Step 2: Extract URL params
	zmanKey := chi.URLParam(r, "zmanKey")
	if zmanKey == "" {
		RespondBadRequest(w, r, "zman_key is required")
		return
	}

	// Step 3-4: No request body to parse or validate

	// Step 5: Execute business logic
	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	alias, err := h.db.Queries.GetPublisherZmanAlias(ctx, sqlcgen.GetPublisherZmanAliasParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return null data (no alias exists) - not 404
			RespondJSON(w, r, http.StatusOK, nil)
			return
		}
		slog.Error("failed to get alias", "error", err, "publisher_id", pc.PublisherID, "zman_key", zmanKey)
		RespondInternalError(w, r, "Failed to retrieve alias")
		return
	}

	// Step 6: Respond
	response := AliasResponse{
		ID:                   int32ToString(alias.ID),
		ZmanKey:              alias.ZmanKey,
		AliasHebrew:          alias.AliasHebrew,
		AliasEnglish:         alias.AliasEnglish,
		AliasTransliteration: alias.AliasTransliteration,
		CanonicalHebrewName:  alias.CanonicalHebrewName,
		CanonicalEnglishName: alias.CanonicalEnglishName,
		CreatedAt:            alias.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// DeleteAlias handles DELETE /api/v1/publisher/zmanim/{zmanKey}/alias
func (h *Handlers) DeleteAlias(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// Step 2: Extract URL params
	zmanKey := chi.URLParam(r, "zmanKey")
	if zmanKey == "" {
		RespondBadRequest(w, r, "zman_key is required")
		return
	}

	// Step 3-4: No request body to parse or validate

	// Step 5: Execute business logic
	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	err = h.db.Queries.DeletePublisherZmanAliasByZmanKey(ctx, sqlcgen.DeletePublisherZmanAliasByZmanKeyParams{
		PublisherID: publisherID,
		ZmanKey:     zmanKey,
	})
	if err != nil {
		slog.Error("failed to delete alias", "error", err, "publisher_id", pc.PublisherID, "zman_key", zmanKey)
		RespondInternalError(w, r, "Failed to delete alias")
		return
	}

	// Step 6: Respond with 204 No Content
	w.WriteHeader(http.StatusNoContent)
}

// ListAliases handles GET /api/v1/publisher/zmanim/aliases
func (h *Handlers) ListAliases(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	// Step 2-4: No URL params or request body

	// Step 5: Execute business logic
	// Convert publisher ID from string to int32
	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		slog.Error("invalid publisher ID", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	aliases, err := h.db.Queries.GetAllPublisherZmanAliases(ctx, publisherID)
	if err != nil {
		slog.Error("failed to list aliases", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to retrieve aliases")
		return
	}

	// Step 6: Respond
	response := AliasListResponse{
		Aliases: make([]AliasResponse, 0, len(aliases)),
	}

	for _, alias := range aliases {
		response.Aliases = append(response.Aliases, AliasResponse{
			ID:                   int32ToString(alias.ID),
			ZmanKey:              alias.ZmanKey,
			AliasHebrew:          alias.AliasHebrew,
			AliasEnglish:         alias.AliasEnglish,
			AliasTransliteration: alias.AliasTransliteration,
			CanonicalHebrewName:  alias.CanonicalHebrewName,
			CanonicalEnglishName: alias.CanonicalEnglishName,
			CreatedAt:            alias.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
		})
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// Helper to create int pointer
func intPtr(i int32) *int32 {
	return &i
}
