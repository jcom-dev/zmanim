package handlers

import (
	"log/slog"
	"net/http"
)

// TimeCategory represents a time of day category for zmanim grouping
type TimeCategory struct {
	ID                 string  `json:"id"`
	Key                string  `json:"key"`
	DisplayNameHebrew  string  `json:"display_name_hebrew"`
	DisplayNameEnglish string  `json:"display_name_english"`
	Description        *string `json:"description,omitempty"`
	IconName           *string `json:"icon_name,omitempty"`
	Color              *string `json:"color,omitempty"`
	SortOrder          int32   `json:"sort_order"`
	IsEveryday         bool    `json:"is_everyday"`
}

// TagType represents a type of tag used to categorize zmanim
type TagType struct {
	ID                 string  `json:"id"`
	Key                string  `json:"key"`
	DisplayNameHebrew  string  `json:"display_name_hebrew"`
	DisplayNameEnglish string  `json:"display_name_english"`
	Color              *string `json:"color,omitempty"`
	SortOrder          int32   `json:"sort_order"`
}

// DisplayGroup represents a UI display group that aggregates time categories
type DisplayGroup struct {
	ID                 string   `json:"id"`
	Key                string   `json:"key"`
	DisplayNameHebrew  string   `json:"display_name_hebrew"`
	DisplayNameEnglish string   `json:"display_name_english"`
	Description        *string  `json:"description,omitempty"`
	IconName           *string  `json:"icon_name,omitempty"`
	Color              *string  `json:"color,omitempty"`
	SortOrder          int32    `json:"sort_order"`
	TimeCategories     []string `json:"time_categories"`
}

// GetTimeCategories returns all time categories
// GET /api/v1/categories/time
//
//	@Summary		Get time categories
//	@Description	Returns all time of day categories for zmanim grouping (public endpoint, cached)
//	@Tags			Categories
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=[]TimeCategory}	"List of time categories"
//	@Failure		500	{object}	APIResponse{error=APIError}			"Internal server error"
//	@Router			/categories/time [get]
func (h *Handlers) GetTimeCategories(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	categories, err := h.db.Queries.GetAllTimeCategories(ctx)
	if err != nil {
		slog.Error("failed to get time categories", "error", err)
		RespondInternalError(w, r, "Failed to retrieve time categories")
		return
	}

	// Convert to response type
	result := make([]TimeCategory, len(categories))
	for i, c := range categories {
		result[i] = TimeCategory{
			ID:                 int32ToString(c.ID),
			Key:                c.Key,
			DisplayNameHebrew:  c.DisplayNameHebrew,
			DisplayNameEnglish: c.DisplayNameEnglish,
			Description:        c.Description,
			IconName:           c.IconName,
			Color:              c.Color,
			SortOrder:          c.SortOrder,
			IsEveryday:         c.IsEveryday != nil && *c.IsEveryday,
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// GetTagTypes returns all tag types
// GET /api/v1/tag-types
//
//	@Summary		Get tag types
//	@Description	Returns all tag types used to categorize zmanim (public endpoint, cached)
//	@Tags			Categories
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=[]TagType}	"List of tag types"
//	@Failure		500	{object}	APIResponse{error=APIError}	"Internal server error"
//	@Router			/tag-types [get]
func (h *Handlers) GetTagTypes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	tagTypes, err := h.db.Queries.GetAllTagTypes(ctx)
	if err != nil {
		slog.Error("failed to get tag types", "error", err)
		RespondInternalError(w, r, "Failed to retrieve tag types")
		return
	}

	// Convert to response type
	result := make([]TagType, len(tagTypes))
	for i, t := range tagTypes {
		result[i] = TagType{
			ID:                 int32ToString(t.ID),
			Key:                t.Key,
			DisplayNameHebrew:  t.DisplayNameHebrew,
			DisplayNameEnglish: t.DisplayNameEnglish,
			Color:              t.Color,
			SortOrder:          t.SortOrder,
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// GetDisplayGroups returns all display groups for UI grouping
// GET /api/v1/categories/display-groups
//
//	@Summary		Get display groups
//	@Description	Returns all display groups for UI section grouping (public endpoint, cached)
//	@Tags			Categories
//	@Produce		json
//	@Success		200	{object}	APIResponse{data=[]DisplayGroup}	"List of display groups"
//	@Failure		500	{object}	APIResponse{error=APIError}			"Internal server error"
//	@Router			/categories/display-groups [get]
func (h *Handlers) GetDisplayGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	groups, err := h.db.Queries.GetAllDisplayGroups(ctx)
	if err != nil {
		slog.Error("failed to get display groups", "error", err)
		RespondInternalError(w, r, "Failed to retrieve display groups")
		return
	}

	// Convert to response type
	result := make([]DisplayGroup, len(groups))
	for i, g := range groups {
		result[i] = DisplayGroup{
			ID:                 int32ToString(g.ID),
			Key:                g.Key,
			DisplayNameHebrew:  g.DisplayNameHebrew,
			DisplayNameEnglish: g.DisplayNameEnglish,
			Description:        g.Description,
			IconName:           g.IconName,
			Color:              g.Color,
			SortOrder:          g.SortOrder,
			TimeCategories:     g.TimeCategories,
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}
