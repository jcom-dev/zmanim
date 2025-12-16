// File: master_registry.go
// Purpose: Master zmanim registry CRUD - canonical zman definitions for all publishers
// Pattern: 6-step-handler
// Dependencies: Queries: master_zmanim.sql, tags.sql | Services: ClerkService
// Frequency: critical - 3,255 lines
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	db "github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
	"github.com/jcom-dev/zmanim/internal/services"
)

// ============================================
// IN-MEMORY CACHE FOR STATIC DATA
// ============================================
// Astronomical primitives are static - cache them in memory

var (
	primitivesCache        []AstronomicalPrimitive
	primitivesGroupedCache []AstronomicalPrimitivesGrouped
	primitivesCacheMu      sync.RWMutex
	primitivesCacheLoaded  bool
)

// ============================================
// TYPES
// ============================================

// MasterZman represents a canonical zman from the master registry
type MasterZman struct {
	ID                   string    `json:"id"`
	ZmanKey              string    `json:"zman_key"`
	CanonicalHebrewName  string    `json:"canonical_hebrew_name"`
	CanonicalEnglishName string    `json:"canonical_english_name"`
	Transliteration      *string   `json:"transliteration,omitempty"`
	Description          *string   `json:"description,omitempty"`
	HalachicNotes        *string   `json:"halachic_notes,omitempty"`
	HalachicSource       *string   `json:"halachic_source,omitempty"`
	TimeCategory         string    `json:"time_category"`
	DefaultFormulaDSL    string    `json:"default_formula_dsl"`
	IsCore               bool      `json:"is_core"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	Tags                 []ZmanTag `json:"tags,omitempty"`
}

// ZmanTag represents a tag for categorizing zmanim
type ZmanTag struct {
	ID                 int32     `json:"id"`      // Changed from string to int32 to match database
	TagKey             string    `json:"tag_key"` // Unique key like "category_candle_lighting", "category_havdalah", "shabbos", "rosh_hashanah"
	Name               string    `json:"name"`
	DisplayNameHebrew  string    `json:"display_name_hebrew"`
	DisplayNameEnglish string    `json:"display_name_english"`
	TagType            string    `json:"tag_type"`
	Description        *string   `json:"description,omitempty"`
	Color              *string   `json:"color,omitempty"`
	SortOrder          int       `json:"sort_order"`
	IsNegated          bool      `json:"is_negated"`                  // When true, zman should NOT appear on days matching this tag
	IsModified         bool      `json:"is_modified"`                 // True if tag differs from master registry (added, removed, or negation changed)
	SourceIsNegated    *bool     `json:"source_is_negated,omitempty"` // Original negation state from master registry (nil if tag not in master)
	CreatedAt          time.Time `json:"created_at"`
}

// MasterZmanimGrouped represents zmanim grouped by time category
type MasterZmanimGrouped struct {
	TimeCategory string       `json:"time_category"`
	DisplayName  string       `json:"display_name"`
	Zmanim       []MasterZman `json:"zmanim"`
}

// ZmanVersion represents a version in the per-zman history
type ZmanVersion struct {
	ID              string    `json:"id"`
	PublisherZmanID string    `json:"publisher_zman_id"`
	VersionNumber   int       `json:"version_number"`
	FormulaDSL      string    `json:"formula_dsl"`
	CreatedBy       *string   `json:"created_by,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// DeletedZman represents a soft-deleted zman
type DeletedZman struct {
	ID           string    `json:"id"`
	PublisherID  string    `json:"publisher_id"`
	ZmanKey      string    `json:"zman_key"`
	HebrewName   string    `json:"hebrew_name"`
	EnglishName  string    `json:"english_name"`
	FormulaDSL   string    `json:"formula_dsl"`
	TimeCategory string    `json:"time_category"`
	DeletedAt    time.Time `json:"deleted_at"`
	DeletedBy    *string   `json:"deleted_by,omitempty"`
	MasterZmanID *string   `json:"master_zman_id,omitempty"`
}

// ZmanRegistryRequest represents a request to add a new zman to the registry
type ZmanRegistryRequest struct {
	ID                   string     `json:"id"`
	PublisherID          string     `json:"publisher_id"`
	RequestedKey         string     `json:"requested_key"`
	RequestedHebrewName  string     `json:"requested_hebrew_name"`
	RequestedEnglishName string     `json:"requested_english_name"`
	RequestedFormulaDSL  *string    `json:"requested_formula_dsl,omitempty"`
	TimeCategory         string     `json:"time_category"`
	Description          string     `json:"description"`
	Status               string     `json:"status"`
	ReviewedBy           *string    `json:"reviewed_by,omitempty"`
	ReviewedAt           *time.Time `json:"reviewed_at,omitempty"`
	ReviewerNotes        *string    `json:"reviewer_notes,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	PublisherName        *string    `json:"publisher_name,omitempty"`
	PublisherEmail       *string    `json:"publisher_email,omitempty"`
	SubmitterName        *string    `json:"submitter_name,omitempty"`
}

// Request bodies
type CreateZmanFromRegistryRequest struct {
	MasterZmanID string  `json:"master_zman_id" validate:"required"`
	FormulaDSL   *string `json:"formula_dsl"` // Optional override
}

type RollbackZmanRequest struct {
	VersionNumber int `json:"version_number" validate:"required"`
}

type CreateZmanRegistryRequestBody struct {
	RequestedKey         string  `json:"requested_key" validate:"required"`
	RequestedHebrewName  string  `json:"requested_hebrew_name" validate:"required"`
	RequestedEnglishName string  `json:"requested_english_name" validate:"required"`
	Transliteration      *string `json:"transliteration"`
	RequestedFormulaDSL  *string `json:"requested_formula_dsl"`
	TimeCategory         string  `json:"time_category" validate:"required"`
	Description          string  `json:"description" validate:"required"`
	HalachicNotes        *string `json:"halachic_notes"`
	HalachicSource       *string `json:"halachic_source"`
	TagIDs               []int32 `json:"tag_ids"`
	RequestedNewTags     []struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"requested_new_tags"`
	AutoAddOnApproval *bool `json:"auto_add_on_approval"`
}

type ReviewZmanRequestBody struct {
	Status        string  `json:"status" validate:"required"` // "approved" or "rejected"
	ReviewerNotes *string `json:"reviewer_notes"`
}

// ============================================
// REGISTRY BROWSER TYPES (Story 11.1)
// ============================================

// MasterZmanForRegistry represents a master zman for the registry browser
type MasterZmanForRegistry struct {
	ID                   string  `json:"id"`
	ZmanKey              string  `json:"zman_key"`
	CanonicalHebrewName  string  `json:"canonical_hebrew_name"`
	CanonicalEnglishName string  `json:"canonical_english_name"`
	Transliteration      *string `json:"transliteration,omitempty"`
	Description          *string `json:"description,omitempty"`
	DefaultFormulaDSL    *string `json:"default_formula_dsl,omitempty"`
	Category             *string `json:"category,omitempty"`
	Shita                *string `json:"shita,omitempty"`
	TimeCategory         *string `json:"time_category,omitempty"`
	IsCore               *bool   `json:"is_core,omitempty"`
	AlreadyImported      bool    `json:"already_imported"`
	ExistingIsDeleted    bool    `json:"existing_is_deleted"`
	PreviewTime          *string `json:"preview_time,omitempty"` // Calculated preview time
}

// RegistryBrowserResponse is the paginated response for the registry browser
type RegistryBrowserResponse struct {
	Items      []MasterZmanForRegistry `json:"items"`
	Total      int64                   `json:"total"`
	Page       int                     `json:"page"`
	Limit      int                     `json:"limit"`
	TotalPages int                     `json:"total_pages"`
}

// RegistryFiltersResponse returns available filter options
type RegistryFiltersResponse struct {
	Categories []string `json:"categories"`
	Shitas     []string `json:"shitas"`
}

// ============================================
// HELPER FUNCTIONS FOR SQLc TYPE CONVERSION
// ============================================

// MasterZmanRow is an interface that all SQLc master zman query results implement
type MasterZmanRow interface {
	GetID() int32
	GetZmanKey() string
	GetCanonicalHebrewName() string
	GetCanonicalEnglishName() string
	GetTransliteration() *string
	GetDescription() *string
	GetHalachicNotes() *string
	GetHalachicSource() *string
	GetTimeCategory() *string
	GetDefaultFormulaDsl() *string
	GetIsCore() *bool
	GetCreatedAt() time.Time
	GetUpdatedAt() time.Time
}

// convertToMasterZmanSlice converts various SQLc result types to []MasterZman
func convertToMasterZmanSlice[T any](rows []T) []MasterZman {
	result := make([]MasterZman, 0, len(rows))
	for _, row := range rows {
		result = append(result, convertToMasterZman(row))
	}
	return result
}

// convertToMasterZman converts a single SQLc row to MasterZman
func convertToMasterZman(row any) MasterZman {
	var z MasterZman

	switch r := row.(type) {
	case db.GetAllMasterZmanimRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.GetMasterZmanimByCategoryRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.SearchMasterZmanimRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.GetMasterZmanimByTagRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.GetEverydayMasterZmanimRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.AdminGetAllMasterZmanimRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.AdminGetMasterZmanimByCategoryRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.GetEventZmanimRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
		// Tags are returned as JSON interface, parse them
		if r.Tags != nil {
			// pgx can return either []byte or []interface{} depending on the driver
			if tagsBytes, ok := r.Tags.([]byte); ok {
				_ = json.Unmarshal(tagsBytes, &z.Tags)
			} else if tagsSlice, ok := r.Tags.([]interface{}); ok {
				// Convert []interface{} to ZmanTag structs
				z.Tags = make([]ZmanTag, 0, len(tagsSlice))
				for _, tagItem := range tagsSlice {
					if tagMap, ok := tagItem.(map[string]interface{}); ok {
						// Extract ID as int32
						var tagID int32
						switch v := tagMap["id"].(type) {
						case float64:
							tagID = int32(v)
						case int:
							tagID = int32(v)
						case int32:
							tagID = v
						case int64:
							tagID = int32(v)
						}

						tag := ZmanTag{
							ID:                 tagID,
							TagKey:             fmt.Sprintf("%v", tagMap["tag_key"]),
							Name:               fmt.Sprintf("%v", tagMap["name"]),
							DisplayNameHebrew:  fmt.Sprintf("%v", tagMap["display_name_hebrew"]),
							DisplayNameEnglish: fmt.Sprintf("%v", tagMap["display_name_english"]),
							TagType:            fmt.Sprintf("%v", tagMap["tag_type"]),
						}
						z.Tags = append(z.Tags, tag)
					}
				}
			}
		}
	case db.GetMasterZmanByKeyRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	case db.AdminGetMasterZmanByIDRow:
		z.ID = fmt.Sprintf("%d", r.ID)
		z.ZmanKey = r.ZmanKey
		z.CanonicalHebrewName = r.CanonicalHebrewName
		z.CanonicalEnglishName = r.CanonicalEnglishName
		z.Transliteration = r.Transliteration
		z.Description = r.Description
		z.HalachicNotes = r.HalachicNotes
		z.HalachicSource = r.HalachicSource
		z.TimeCategory = safeStringValue(r.TimeCategory)
		z.DefaultFormulaDSL = safeStringValue(r.DefaultFormulaDsl)
		z.IsCore = safeBoolValue(r.IsCore)
		z.CreatedAt = r.CreatedAt.Time
		z.UpdatedAt = r.UpdatedAt.Time
	}

	return z
}

// Helper to safely convert *string to string
func safeStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Helper to safely convert *bool to bool
func safeBoolValue(b *bool) bool {
	if b == nil {
		return false
	}
	return *b
}

// ============================================
// MASTER REGISTRY HANDLERS (PUBLIC)
// ============================================

// GetMasterZmanim returns all zmanim from the master registry
// Auth-aware: Admins see hidden zmanim and additional fields, public users don't
//
//	@Summary	Get all master zmanim
//	@Tags		Registry
//	@Produce	json
//	@Param		category		query	string	false	"Filter by time category"
//	@Param		search			query	string	false	"Search by name (public only)"
//	@Param		tag				query	string	false	"Filter by tag name (public only)"
//	@Param		include_hidden	query	boolean	false	"Include hidden zmanim (admin only, default: false)"
//	@Success	200				{array}	MasterZman
//	@Router		/api/v1/registry/zmanim [get]
func (h *Handlers) GetMasterZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Check if user is admin
	userRole := middleware.GetUserRole(ctx)
	isAdmin := userRole == "admin"

	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	tag := r.URL.Query().Get("tag")
	includeHidden := r.URL.Query().Get("include_hidden") == "true"

	// If admin, use admin queries with is_hidden field
	if isAdmin {
		var adminZmanim []AdminMasterZman
		var rows []db.AdminGetAllMasterZmanimRow
		var err error

		if category != "" {
			categoryRows, err := h.db.Queries.AdminGetMasterZmanimByCategory(ctx, db.AdminGetMasterZmanimByCategoryParams{
				Key:     category,
				Column2: includeHidden,
			})
			if err != nil {
				slog.Error("error getting master zmanim by category", "error", err)
				RespondInternalError(w, r, "Failed to get master zmanim")
				return
			}
			// Convert to AdminGetAllMasterZmanimRow
			rows = make([]db.AdminGetAllMasterZmanimRow, len(categoryRows))
			for i, cr := range categoryRows {
				rows[i] = db.AdminGetAllMasterZmanimRow{
					ID:                   cr.ID,
					ZmanKey:              cr.ZmanKey,
					CanonicalHebrewName:  cr.CanonicalHebrewName,
					CanonicalEnglishName: cr.CanonicalEnglishName,
					Transliteration:      cr.Transliteration,
					Description:          cr.Description,
					HalachicNotes:        cr.HalachicNotes,
					HalachicSource:       cr.HalachicSource,
					TimeCategory:         cr.TimeCategory,
					DefaultFormulaDsl:    cr.DefaultFormulaDsl,
					IsCore:               cr.IsCore,
					IsHidden:             cr.IsHidden,
					CreatedAt:            cr.CreatedAt,
					UpdatedAt:            cr.UpdatedAt,
				}
			}
		} else {
			rows, err = h.db.Queries.AdminGetAllMasterZmanim(ctx, includeHidden)
			if err != nil {
				slog.Error("error getting master zmanim", "error", err)
				RespondInternalError(w, r, "Failed to get master zmanim")
				return
			}
		}

		zmanIDs := make([]int32, 0, len(rows))
		for _, row := range rows {
			var z AdminMasterZman
			z.ID = fmt.Sprintf("%d", row.ID)
			z.ZmanKey = row.ZmanKey
			z.CanonicalHebrewName = row.CanonicalHebrewName
			z.CanonicalEnglishName = row.CanonicalEnglishName
			z.Transliteration = row.Transliteration
			z.Description = row.Description
			z.HalachicNotes = row.HalachicNotes
			z.HalachicSource = row.HalachicSource
			if row.TimeCategory != nil {
				z.TimeCategory = *row.TimeCategory
			}
			if row.DefaultFormulaDsl != nil {
				z.DefaultFormulaDSL = *row.DefaultFormulaDsl
			}
			if row.IsCore != nil {
				z.IsCore = *row.IsCore
			}
			z.IsHidden = row.IsHidden
			z.CreatedAt = row.CreatedAt.Time
			z.UpdatedAt = row.UpdatedAt.Time
			adminZmanim = append(adminZmanim, z)
			zmanIDs = append(zmanIDs, row.ID)
		}

		// Fetch tags for all zmanim
		if len(adminZmanim) > 0 {
			zmanIDMap := make(map[int32]int) // map zman ID to index
			for i := range adminZmanim {
				zmanIDMap[zmanIDs[i]] = i
			}

			// Get full tag details using SQLc query (pass int32 slice directly)
			slog.Info("fetching tags for zmanim", "count", len(zmanIDs), "sample_ids", zmanIDs[:min(5, len(zmanIDs))])
			tagRows, err := h.db.Queries.GetMasterZmanTagsWithDetails(ctx, zmanIDs)
			if err != nil {
				slog.Error("error getting master zman tags with details", "error", err, "zman_count", len(zmanIDs))
			} else {
				slog.Info("fetched tags", "tag_count", len(tagRows))
				assignedCount := 0
				for _, tagRow := range tagRows {
					var tag ZmanTag
					tag.ID = tagRow.ID
					tag.TagKey = tagRow.TagKey
					tag.DisplayNameHebrew = tagRow.DisplayNameHebrew
					tag.DisplayNameEnglish = tagRow.DisplayNameEnglishAshkenazi
					if tagRow.TagType != nil {
						tag.TagType = *tagRow.TagType
					}
					tag.Description = tagRow.Description
					tag.Color = tagRow.Color
					if tagRow.SortOrder != nil {
						tag.SortOrder = int(*tagRow.SortOrder)
					}
					tag.IsNegated = tagRow.IsNegated
					tag.CreatedAt = tagRow.CreatedAt.Time

					if idx, ok := zmanIDMap[tagRow.MasterZmanID]; ok {
						if adminZmanim[idx].Tags == nil {
							adminZmanim[idx].Tags = []ZmanTag{}
						}
						adminZmanim[idx].Tags = append(adminZmanim[idx].Tags, tag)
						// Also populate tag IDs for backward compatibility
						if adminZmanim[idx].TagIDs == nil {
							adminZmanim[idx].TagIDs = []int32{}
						}
						adminZmanim[idx].TagIDs = append(adminZmanim[idx].TagIDs, tag.ID)
						assignedCount++
					}
				}
				slog.Info("assigned tags", "assigned_count", assignedCount)
			}
		}

		if adminZmanim == nil {
			adminZmanim = []AdminMasterZman{}
		}

		RespondJSON(w, r, http.StatusOK, adminZmanim)
		return
	}

	// Public users: use public queries (filters out hidden zmanim)
	var zmanim []MasterZman

	// Build query based on filters
	if search != "" {
		// Search by name using SQLc query
		searchPtr := &search
		results, err := h.db.Queries.SearchMasterZmanim(ctx, searchPtr)
		if err != nil {
			slog.Error("error searching master zmanim", "error", err)
			RespondInternalError(w, r, "Failed to search master zmanim")
			return
		}
		zmanim = convertToMasterZmanSlice(results)
	} else if tag != "" {
		// Filter by tag using SQLc query
		results, err := h.db.Queries.GetMasterZmanimByTag(ctx, tag)
		if err != nil {
			slog.Error("error getting master zmanim by tag", "error", err)
			RespondInternalError(w, r, "Failed to get master zmanim")
			return
		}
		zmanim = convertToMasterZmanSlice(results)
	} else if category != "" {
		// Filter by category using SQLc query
		results, err := h.db.Queries.GetMasterZmanimByCategory(ctx, category)
		if err != nil {
			slog.Error("error getting master zmanim by category", "error", err)
			RespondInternalError(w, r, "Failed to get master zmanim")
			return
		}
		zmanim = convertToMasterZmanSlice(results)
	} else {
		// Get all using SQLc query
		results, err := h.db.Queries.GetAllMasterZmanim(ctx)
		if err != nil {
			slog.Error("error getting all master zmanim", "error", err)
			RespondInternalError(w, r, "Failed to get master zmanim")
			return
		}
		zmanim = convertToMasterZmanSlice(results)
	}

	if zmanim == nil {
		zmanim = []MasterZman{}
	}

	RespondJSON(w, r, http.StatusOK, zmanim)
}

// GetMasterZmanimGrouped returns zmanim grouped by time category
//
//	@Summary	Get master zmanim grouped by time category
//	@Tags		Registry
//	@Produce	json
//	@Success	200	{array}	MasterZmanimGrouped
//	@Router		/api/v1/registry/zmanim/grouped [get]
func (h *Handlers) GetMasterZmanimGrouped(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	categoryOrder := []string{"dawn", "sunrise", "morning", "midday", "afternoon", "sunset", "nightfall", "midnight"}

	// Get everyday zmanim (excludes event zmanim like candle lighting, havdalah, etc.)
	results, err := h.db.Queries.GetEverydayMasterZmanim(ctx)
	if err != nil {
		slog.Error("error getting everyday master zmanim", "error", err)
		RespondInternalError(w, r, "Failed to get master zmanim")
		return
	}
	zmanim := convertToMasterZmanSlice(results)

	// Group by category
	grouped := make(map[string][]MasterZman)
	for _, z := range zmanim {
		grouped[z.TimeCategory] = append(grouped[z.TimeCategory], z)
	}

	// Build result as map keyed by category (for frontend consumption)
	result := make(map[string][]MasterZman)
	for _, cat := range categoryOrder {
		if zmanimList, ok := grouped[cat]; ok {
			result[cat] = zmanimList
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// GetEventZmanimGrouped returns event zmanim grouped by behavior tags
//
//	@Summary	Get event zmanim grouped by category (candles, havdalah, etc.)
//	@Tags		Registry
//	@Produce	json
//	@Success	200	{object}	map[string][]MasterZman
//	@Router		/api/v1/registry/zmanim/events [get]
func (h *Handlers) GetEventZmanimGrouped(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Category order for display - derived from behavior tags
	categoryOrder := []string{"candles", "havdalah", "fast_day", "tisha_bav", "pesach"}

	// Get all event zmanim with their behavior tags using SQLc query
	results, err := h.db.Queries.GetEventZmanim(ctx)
	if err != nil {
		slog.Error("error getting event zmanim", "error", err)
		RespondInternalError(w, r, "Failed to get event zmanim")
		return
	}

	// Convert to MasterZman slice (includes tag parsing)
	zmanim := convertToMasterZmanSlice(results)

	// Group by category tags
	grouped := make(map[string][]MasterZman)
	for _, z := range zmanim {
		// Determine category from category tags
		category := ""
		for _, tag := range z.Tags {
			if tag.TagType == "category" {
				switch tag.Name {
				case "category_candle_lighting":
					category = "candles"
				case "category_havdalah":
					category = "havdalah"
				case "category_fast_start", "category_fast_end":
					// Check if it's Tisha B'Av specific
					for _, t := range z.Tags {
						if t.Name == "tisha_bav" {
							category = "tisha_bav"
							break
						}
					}
					if category == "" {
						category = "fast_day"
					}
				case "category_chametz":
					category = "pesach"
				}
				if category != "" {
					break
				}
			}
		}

		if category != "" {
			grouped[category] = append(grouped[category], z)
		}
	}

	// Build result in category order
	result := make(map[string][]MasterZman)
	for _, cat := range categoryOrder {
		if zmanimList, ok := grouped[cat]; ok {
			result[cat] = zmanimList
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// GetMasterZman returns a single zman from the master registry
//
//	@Summary	Get master zman by key
//	@Tags		Registry
//	@Produce	json
//	@Param		zmanKey	path		string	true	"Zman key"
//	@Success	200		{object}	MasterZman
//	@Router		/api/v1/registry/zmanim/{zmanKey} [get]
func (h *Handlers) GetMasterZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Get master zman using SQLc query
	row, err := h.db.Queries.GetMasterZmanByKey(ctx, zmanKey)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Master zman not found")
		return
	}
	if err != nil {
		slog.Error("error getting master zman", "error", err)
		RespondInternalError(w, r, "Failed to get master zman")
		return
	}

	// Convert to MasterZman
	z := convertToMasterZman(row)

	// Get tags for this zman using SQLc query
	tagRows, err := h.db.Queries.GetTagsForMasterZman(ctx, row.ID)
	if err == nil {
		z.Tags = make([]ZmanTag, 0, len(tagRows))
		for _, t := range tagRows {
			var sortOrder int
			if t.SortOrder != nil {
				sortOrder = int(*t.SortOrder)
			}
			z.Tags = append(z.Tags, ZmanTag{
				ID:                 t.ID,
				TagKey:             t.Name,
				Name:               t.Name,
				DisplayNameHebrew:  t.DisplayNameHebrew,
				DisplayNameEnglish: t.DisplayNameEnglishAshkenazi,
				TagType:            safeStringValue(t.TagType),
				Description:        t.Description,
				Color:              t.Color,
				SortOrder:          sortOrder,
				CreatedAt:          t.CreatedAt.Time,
			})
		}
	}

	RespondJSON(w, r, http.StatusOK, z)
}

// ValidateZmanKeyResponse is the response for key validation
type ValidateZmanKeyResponse struct {
	Available bool    `json:"available"`
	Reason    *string `json:"reason,omitempty"`
}

// ValidateZmanKey checks if a zman key is available for use
//
//	@Summary	Validate zman key availability
//	@Tags		Registry
//	@Accept		json
//	@Produce	json
//	@Param		key	query		string	true	"Zman key to validate"
//	@Success	200	{object}	ValidateZmanKeyResponse
//	@Router		/api/v1/registry/zmanim/validate-key [get]
func (h *Handlers) ValidateZmanKey(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	key := r.URL.Query().Get("key")

	if key == "" {
		reason := "Key is required"
		RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
			Available: false,
			Reason:    &reason,
		})
		return
	}

	// Check format: must start with lowercase letter, contain only lowercase letters, numbers, underscores
	if len(key) < 2 {
		reason := "Key must be at least 2 characters"
		RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
			Available: false,
			Reason:    &reason,
		})
		return
	}

	// Validate format
	for i, c := range key {
		if i == 0 {
			if c < 'a' || c > 'z' {
				reason := "Key must start with a lowercase letter"
				RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
					Available: false,
					Reason:    &reason,
				})
				return
			}
		} else {
			if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_') {
				reason := "Key can only contain lowercase letters, numbers, and underscores"
				RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
					Available: false,
					Reason:    &reason,
				})
				return
			}
		}
	}

	// Check if key exists in master registry using SQLc query
	exists, err := h.db.Queries.ValidateMasterZmanKeyExists(ctx, key)
	if err != nil {
		slog.Error("error checking zman key availability", "error", err, "key", key)
		RespondInternalError(w, r, "Failed to validate key")
		return
	}

	if exists {
		reason := "This zman key already exists in the registry"
		RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
			Available: false,
			Reason:    &reason,
		})
		return
	}

	// Also check pending requests using SQLc query
	exists, err = h.db.Queries.ValidatePendingRequestKeyExists(ctx, key)
	if err != nil {
		slog.Error("error checking pending requests", "error", err, "key", key)
		RespondInternalError(w, r, "Failed to validate key")
		return
	}

	if exists {
		reason := "This key has a pending request from another publisher"
		RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
			Available: false,
			Reason:    &reason,
		})
		return
	}

	// Key is available
	RespondJSON(w, r, http.StatusOK, ValidateZmanKeyResponse{
		Available: true,
	})
}

// GetAllTags returns all zman tags
//
//	@Summary	Get all zman tags
//	@Tags		Registry
//	@Produce	json
//	@Param		type	query	string	false	"Filter by tag type"
//	@Success	200		{array}	ZmanTag
//	@Router		/api/v1/registry/tags [get]
func (h *Handlers) GetAllTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	tagType := r.URL.Query().Get("type")

	var tagRows []db.GetTagsByTypeRow
	var allTagRows []db.GetAllTagsOrderedRow
	var err error

	// Use SQLc queries
	if tagType != "" {
		tagRows, err = h.db.Queries.GetTagsByType(ctx, tagType)
	} else {
		allTagRows, err = h.db.Queries.GetAllTagsOrdered(ctx)
	}

	if err != nil {
		slog.Error("error getting tags", "error", err)
		RespondInternalError(w, r, "Failed to get tags")
		return
	}

	// Convert to handler ZmanTag type
	tags := make([]ZmanTag, 0)
	if tagType != "" {
		for _, t := range tagRows {
			var sortOrder int
			if t.SortOrder != nil {
				sortOrder = int(*t.SortOrder)
			}
			tags = append(tags, ZmanTag{
				ID:                 t.ID,
				TagKey:             t.Name,
				Name:               t.Name,
				DisplayNameHebrew:  t.DisplayNameHebrew,
				DisplayNameEnglish: t.DisplayNameEnglishAshkenazi,
				TagType:            safeStringValue(t.TagType),
				Description:        t.Description,
				Color:              t.Color,
				SortOrder:          sortOrder,
				CreatedAt:          t.CreatedAt.Time,
			})
		}
	} else {
		for _, t := range allTagRows {
			var sortOrder int
			if t.SortOrder != nil {
				sortOrder = int(*t.SortOrder)
			}
			tags = append(tags, ZmanTag{
				ID:                 t.ID,
				TagKey:             t.TagKey,
				Name:               t.Name,
				DisplayNameHebrew:  t.DisplayNameHebrew,
				DisplayNameEnglish: t.DisplayNameEnglishAshkenazi,
				TagType:            safeStringValue(t.TagType),
				Description:        t.Description,
				Color:              t.Color,
				SortOrder:          sortOrder,
				CreatedAt:          t.CreatedAt.Time,
			})
		}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"tags": tags,
	})
}

// ============================================
// VERSION HISTORY HANDLERS (PUBLISHER)
// ============================================

// GetZmanVersionHistory returns the version history for a specific zman
//
//	@Summary	Get version history for a zman
//	@Tags		Publisher Zmanim
//	@Produce	json
//	@Param		zmanKey	path	string	true	"Zman key"
//	@Success	200		{array}	ZmanVersion
//	@Router		/api/v1/publisher/zmanim/{zmanKey}/history [get]
func (h *Handlers) GetZmanVersionHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	rows, err := h.db.Queries.GetZmanVersionHistory(ctx, db.GetZmanVersionHistoryParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
	})
	if err != nil {
		slog.Error("error getting zman version history", "error", err)
		RespondInternalError(w, r, "Failed to get version history")
		return
	}

	versions := make([]ZmanVersion, 0, len(rows))
	for _, row := range rows {
		var formulaDSL string
		if row.FormulaDsl != nil {
			formulaDSL = *row.FormulaDsl
		}
		versions = append(versions, ZmanVersion{
			ID:              fmt.Sprintf("%d", row.ID),
			PublisherZmanID: int32ToString(row.PublisherZmanID),
			VersionNumber:   int(row.VersionNumber),
			FormulaDSL:      formulaDSL,
			CreatedBy:       row.CreatedBy,
			CreatedAt:       row.CreatedAt.Time,
		})
	}

	RespondJSON(w, r, http.StatusOK, versions)
}

// GetZmanVersion returns a specific version of a zman
//
//	@Summary	Get specific version of a zman
//	@Tags		Publisher Zmanim
//	@Produce	json
//	@Param		zmanKey	path		string	true	"Zman key"
//	@Param		version	path		int		true	"Version number"
//	@Success	200		{object}	ZmanVersion
//	@Router		/api/v1/publisher/zmanim/{zmanKey}/history/{version} [get]
func (h *Handlers) GetZmanVersionDetail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")
	versionStr := chi.URLParam(r, "version")

	version, err := parseIntParam(versionStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid version number")
		return
	}

	// Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	row, err := h.db.Queries.GetZmanVersion(ctx, db.GetZmanVersionParams{
		PublisherID:   publisherIDInt,
		ZmanKey:       zmanKey,
		VersionNumber: int32(version),
	})
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Version not found")
		return
	}
	if err != nil {
		slog.Error("error getting zman version", "error", err)
		RespondInternalError(w, r, "Failed to get version")
		return
	}

	var formulaDSL string
	if row.FormulaDsl != nil {
		formulaDSL = *row.FormulaDsl
	}
	v := ZmanVersion{
		ID:              fmt.Sprintf("%d", row.ID),
		PublisherZmanID: int32ToString(row.PublisherZmanID),
		VersionNumber:   int(row.VersionNumber),
		FormulaDSL:      formulaDSL,
		CreatedBy:       row.CreatedBy,
		CreatedAt:       row.CreatedAt.Time,
	}

	RespondJSON(w, r, http.StatusOK, v)
}

// RollbackZmanVersion rolls back a zman to a previous version
//
//	@Summary	Rollback zman to previous version
//	@Tags		Publisher Zmanim
//	@Accept		json
//	@Produce	json
//	@Param		zmanKey	path		string				true	"Zman key"
//	@Param		body	body		RollbackZmanRequest	true	"Rollback request"
//	@Success	200		{object}	PublisherZman
//	@Router		/api/v1/publisher/zmanim/{zmanKey}/rollback [post]
func (h *Handlers) RollbackZmanVersion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	var req RollbackZmanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get the target version's formula
	targetFormula, err := h.db.Queries.GetVersionFormula(ctx, db.GetVersionFormulaParams{
		PublisherID:   publisherIDInt,
		ZmanKey:       zmanKey,
		VersionNumber: int32(req.VersionNumber),
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Version not found")
		return
	}
	if err != nil {
		slog.Error("error getting target version", "error", err)
		RespondInternalError(w, r, "Failed to get target version")
		return
	}

	// Get user ID from context
	var userID *string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			userID = &sub
		}
	}

	var formulaToUse string
	if targetFormula != nil {
		formulaToUse = *targetFormula
	}

	// Update the zman with the target formula (this will trigger version creation)
	row, err := h.db.Queries.RollbackPublisherZmanFormula(ctx, db.RollbackPublisherZmanFormulaParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
		FormulaDsl:  formulaToUse,
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Zman not found")
		return
	}
	if err != nil {
		slog.Error("error rolling back zman", "error", err)
		RespondInternalError(w, r, "Failed to rollback zman")
		return
	}

	// Convert SQLc types to handler types
	var result PublisherZman
	result.ID = fmt.Sprintf("%d", row.ID)
	result.PublisherID = int32ToString(row.PublisherID)
	result.ZmanKey = row.ZmanKey
	result.HebrewName = row.HebrewName
	result.EnglishName = row.EnglishName
	result.Transliteration = row.Transliteration
	result.Description = row.Description
	result.FormulaDSL = row.FormulaDsl
	result.AIExplanation = row.AiExplanation
	result.PublisherComment = row.PublisherComment
	result.IsEnabled = row.IsEnabled
	result.IsVisible = row.IsVisible
	result.IsPublished = row.IsPublished
	result.IsCustom = row.IsCustom
	result.Dependencies = row.Dependencies
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time
	if row.MasterZmanID != nil {
		masterID := int32ToString(*row.MasterZmanID)
		result.MasterZmanID = &masterID
	}

	// Create a new version for the rollback
	err = h.db.Queries.CreateVersionForRollback(ctx, db.CreateVersionForRollbackParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
		FormulaDsl:  &formulaToUse,
		CreatedBy:   userID,
	})
	if err != nil {
		slog.Error("error creating version for rollback", "error", err)
		// Don't fail the request, the rollback itself succeeded
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// ============================================
// SOFT DELETE HANDLERS (PUBLISHER)
// ============================================

// SoftDeletePublisherZman soft deletes a publisher zman
//
//	@Summary	Soft delete a zman
//	@Tags		Publisher Zmanim
//	@Param		zmanKey	path		string	true	"Zman key"
//	@Success	200		{object}	map[string]string
//	@Router		/api/v1/publisher/zmanim/{zmanKey} [delete]
func (h *Handlers) SoftDeletePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// Get user ID from context
	var userID *string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			userID = &sub
		}
	}

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	err = h.db.Queries.SoftDeletePublisherZmanExec(ctx, db.SoftDeletePublisherZmanExecParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
		DeletedBy:   userID,
	})

	if err != nil {
		slog.Error("error soft deleting zman", "error", err)
		RespondInternalError(w, r, "Failed to delete zman")
		return
	}

	// Invalidate cache after successful soft delete
	if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
		slog.Error("failed to invalidate cache after soft delete", "error", err, "publisher_id", publisherID)
		// Don't fail the request - cache will eventually expire
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"message":  "Zman deleted successfully",
		"zman_key": zmanKey,
	})
}

// GetDeletedZmanim returns soft-deleted zmanim for a publisher
//
//	@Summary	Get deleted zmanim
//	@Tags		Publisher Zmanim
//	@Produce	json
//	@Success	200	{array}	DeletedZman
//	@Router		/api/v1/publisher/zmanim/deleted [get]
func (h *Handlers) GetDeletedZmanim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	rows, err := h.db.Queries.GetDeletedPublisherZmanim(ctx, publisherIDInt)
	if err != nil {
		slog.Error("error getting deleted zmanim", "error", err)
		RespondInternalError(w, r, "Failed to get deleted zmanim")
		return
	}

	var deleted []DeletedZman
	for _, row := range rows {
		var d DeletedZman
		d.ID = fmt.Sprintf("%d", row.ID)
		d.PublisherID = int32ToString(row.PublisherID)
		d.ZmanKey = row.ZmanKey
		d.HebrewName = row.HebrewName
		d.EnglishName = row.EnglishName
		d.FormulaDSL = row.FormulaDsl
		if row.TimeCategory != nil {
			d.TimeCategory = *row.TimeCategory
		}
		if row.DeletedAt.Valid {
			d.DeletedAt = row.DeletedAt.Time
		}
		d.DeletedBy = row.DeletedBy
		if row.MasterZmanID != nil {
			masterID := int32ToString(*row.MasterZmanID)
			d.MasterZmanID = &masterID
		}
		deleted = append(deleted, d)
	}

	if deleted == nil {
		deleted = []DeletedZman{}
	}

	RespondJSON(w, r, http.StatusOK, deleted)
}

// RestorePublisherZman restores a soft-deleted zman
//
//	@Summary	Restore a deleted zman
//	@Tags		Publisher Zmanim
//	@Param		zmanKey	path		string	true	"Zman key"
//	@Success	200		{object}	PublisherZman
//	@Router		/api/v1/publisher/zmanim/{zmanKey}/restore [post]
func (h *Handlers) RestorePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	row, err := h.db.Queries.RestoreZman(ctx, db.RestoreZmanParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Deleted zman not found")
		return
	}
	if err != nil {
		slog.Error("error restoring zman", "error", err)
		RespondInternalError(w, r, "Failed to restore zman")
		return
	}

	// Convert SQLc types to handler types
	var result PublisherZman
	result.ID = fmt.Sprintf("%d", row.ID)
	result.PublisherID = int32ToString(row.PublisherID)
	result.ZmanKey = row.ZmanKey
	result.HebrewName = row.HebrewName
	result.EnglishName = row.EnglishName
	result.FormulaDSL = row.FormulaDsl
	result.AIExplanation = row.AiExplanation
	result.PublisherComment = row.PublisherComment
	result.IsEnabled = row.IsEnabled
	result.IsVisible = row.IsVisible
	result.IsPublished = row.IsPublished
	result.IsCustom = row.IsCustom
	result.Dependencies = row.Dependencies
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time
	if row.MasterZmanID != nil {
		masterID := int32ToString(*row.MasterZmanID)
		result.MasterZmanID = &masterID
	}

	// Invalidate cache after successful restore
	if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
		slog.Error("failed to invalidate cache after restore", "error", err, "publisher_id", publisherID)
		// Don't fail the request - cache will eventually expire
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// PermanentDeletePublisherZman permanently deletes a soft-deleted zman
//
//	@Summary	Permanently delete a zman
//	@Tags		Publisher Zmanim
//	@Param		zmanKey	path		string	true	"Zman key"
//	@Success	200		{object}	map[string]string
//	@Router		/api/v1/publisher/zmanim/{zmanKey}/permanent [delete]
func (h *Handlers) PermanentDeletePublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	zmanKey := chi.URLParam(r, "zmanKey")

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	err = h.db.Queries.PermanentDeleteZman(ctx, db.PermanentDeleteZmanParams{
		PublisherID: publisherIDInt,
		ZmanKey:     zmanKey,
	})

	if err != nil {
		slog.Error("error permanently deleting zman", "error", err)
		RespondInternalError(w, r, "Failed to permanently delete zman")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"message":  "Zman permanently deleted",
		"zman_key": zmanKey,
	})
}

// ============================================
// CREATE FROM REGISTRY HANDLER
// ============================================

// CreatePublisherZmanFromRegistry creates a new zman from the master registry
//
//	@Summary	Add zman from master registry
//	@Tags		Publisher Zmanim
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateZmanFromRegistryRequest	true	"Create request"
//	@Success	201		{object}	PublisherZman
//	@Router		/api/v1/publisher/zmanim [post]
func (h *Handlers) CreatePublisherZmanFromRegistry(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	var req CreateZmanFromRegistryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Create the zman from the registry
	var result PublisherZman
	var formulaToUse string

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	masterZmanIDInt, err := stringToInt32(req.MasterZmanID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid master_zman_id")
		return
	}

	// Get the default formula or use override
	if req.FormulaDSL != nil && *req.FormulaDSL != "" {
		formulaToUse = *req.FormulaDSL
	} else {
		defaultFormula, err := h.db.Queries.GetMasterZmanDefaultFormula(ctx, masterZmanIDInt)
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Master zman not found")
			return
		}
		if err != nil {
			slog.Error("error getting master zman", "error", err)
			RespondInternalError(w, r, "Failed to get master zman")
			return
		}
		if defaultFormula != nil {
			formulaToUse = *defaultFormula
		}
	}

	// Insert the new publisher zman
	row, err := h.db.Queries.CreatePublisherZmanFromMasterWithFormula(ctx, db.CreatePublisherZmanFromMasterWithFormulaParams{
		PublisherID: publisherIDInt,
		ID:          masterZmanIDInt,
		FormulaDsl:  formulaToUse,
	})

	if err != nil {
		// Check for unique constraint violation
		if isDuplicateKeyError(err) {
			RespondConflict(w, r, "Zman already exists for this publisher")
			return
		}
		slog.Error("error creating publisher zman", "error", err)
		RespondInternalError(w, r, "Failed to create zman")
		return
	}

	// Convert SQLc types to handler types
	result.ID = fmt.Sprintf("%d", row.ID)
	result.PublisherID = int32ToString(row.PublisherID)
	result.ZmanKey = row.ZmanKey
	result.HebrewName = row.HebrewName
	result.EnglishName = row.EnglishName
	result.Transliteration = row.Transliteration
	result.Description = row.Description
	result.FormulaDSL = row.FormulaDsl
	result.AIExplanation = row.AiExplanation
	result.PublisherComment = row.PublisherComment
	result.IsEnabled = row.IsEnabled
	result.IsVisible = row.IsVisible
	result.IsPublished = row.IsPublished
	result.IsCustom = row.IsCustom
	result.Dependencies = row.Dependencies
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time
	if row.MasterZmanID != nil {
		masterID := int32ToString(*row.MasterZmanID)
		result.MasterZmanID = &masterID
	}

	// Create initial version
	err = h.db.Queries.CreateInitialZmanVersion(ctx, db.CreateInitialZmanVersionParams{
		PublisherZmanID: row.ID,
		FormulaDsl:      &result.FormulaDSL,
	})
	if err != nil {
		slog.Error("error creating initial version", "error", err)
		// Don't fail - the zman was created successfully
	}

	// Invalidate cache - new zman from registry affects calculations
	if h.cache != nil {
		if err := h.cache.InvalidatePublisherCache(ctx, publisherID); err != nil {
			slog.Warn("failed to invalidate cache after creating zman from registry", "error", err, "publisher_id", publisherID)
		}
	}

	RespondJSON(w, r, http.StatusCreated, result)
}

// ============================================
// ZMAN REGISTRY REQUEST HANDLERS (EDGE CASE)
// ============================================

// GetPublisherZmanRequests returns the current publisher's zman requests
//
//	@Summary	Get publisher's zman requests
//	@Tags		Publisher Zmanim
//	@Produce	json
//	@Success	200	{object}	map[string]interface{}
//	@Router		/api/v1/publisher/zman-requests [get]
func (h *Handlers) GetPublisherZmanRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	publisherIDInt, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	requests, err := h.db.Queries.GetPublisherZmanRequests(ctx, publisherIDInt)
	if err != nil {
		slog.Error("error getting publisher zman requests", "error", err, "publisher_id", pc.PublisherID)
		RespondInternalError(w, r, "Failed to get requests")
		return
	}

	if requests == nil {
		requests = []db.GetPublisherZmanRequestsRow{}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"requests": requests,
		"total":    len(requests),
	})
}

// CreateZmanRegistryRequest creates a request to add a new zman to the registry
//
//	@Summary	Request new zman for master registry
//	@Tags		Publisher Zmanim
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateZmanRegistryRequestBody	true	"Request body"
//	@Success	201		{object}	ZmanRegistryRequest
//	@Router		/api/v1/registry/zmanim/request [post]
func (h *Handlers) CreateZmanRegistryRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Resolve publisher ID
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	var req CreateZmanRegistryRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("failed to decode request body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	slog.Info("received zman request",
		"requested_key", req.RequestedKey,
		"hebrew_name", req.RequestedHebrewName,
		"english_name", req.RequestedEnglishName,
		"time_category", req.TimeCategory,
		"description", req.Description)

	// Validate required fields
	if req.RequestedKey == "" || req.RequestedHebrewName == "" || req.RequestedEnglishName == "" ||
		req.TimeCategory == "" || req.Description == "" {
		slog.Warn("missing required fields",
			"has_key", req.RequestedKey != "",
			"has_hebrew", req.RequestedHebrewName != "",
			"has_english", req.RequestedEnglishName != "",
			"has_category", req.TimeCategory != "",
			"has_description", req.Description != "")
		RespondBadRequest(w, r, "Missing required fields")
		return
	}

	// Default auto_add_on_approval to true if not provided
	autoAdd := true
	if req.AutoAddOnApproval != nil {
		autoAdd = *req.AutoAddOnApproval
	}

	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	row, err := h.db.Queries.CreateZmanRegistryRequestFull(ctx, db.CreateZmanRegistryRequestFullParams{
		PublisherID:          publisherIDInt,
		RequestedKey:         req.RequestedKey,
		RequestedHebrewName:  req.RequestedHebrewName,
		RequestedEnglishName: req.RequestedEnglishName,
		Transliteration:      req.Transliteration,
		RequestedFormulaDsl:  req.RequestedFormulaDSL,
		Key:                  req.TimeCategory,
		Description:          stringPtrIfNotEmpty(req.Description),
		HalachicNotes:        req.HalachicNotes,
		HalachicSource:       req.HalachicSource,
		AutoAddOnApproval:    &autoAdd,
	})

	if err != nil {
		slog.Error("error creating zman registry request", "error", err)
		RespondInternalError(w, r, "Failed to create request")
		return
	}

	// Convert SQLc types to handler types
	var result ZmanRegistryRequest
	result.ID = fmt.Sprintf("%d", row.ID)
	result.PublisherID = int32ToString(row.PublisherID)
	result.RequestedKey = row.RequestedKey
	result.RequestedHebrewName = row.RequestedHebrewName
	result.RequestedEnglishName = row.RequestedEnglishName
	result.RequestedFormulaDSL = row.RequestedFormulaDsl
	// Note: TimeCategory is stored as time_category_id, need to get the key from elsewhere or adjust
	result.TimeCategory = req.TimeCategory // Use request value for now
	if row.Description != nil {
		result.Description = *row.Description
	}
	result.CreatedAt = row.CreatedAt.Time

	// Insert tags if provided
	if len(req.TagIDs) > 0 || len(req.RequestedNewTags) > 0 {
		// Insert existing tag references
		for _, tagID := range req.TagIDs {
			err := h.db.Queries.InsertZmanRequestExistingTag(ctx, db.InsertZmanRequestExistingTagParams{
				RequestID: row.ID,
				TagID:     &tagID,
			})
			if err != nil {
				slog.Warn("failed to insert tag reference", "error", err, "tag_id", tagID)
			}
		}
		// Insert new tag requests
		for _, newTag := range req.RequestedNewTags {
			err := h.db.Queries.InsertZmanRequestNewTag(ctx, db.InsertZmanRequestNewTagParams{
				RequestID:        row.ID,
				RequestedTagName: stringPtrIfNotEmpty(newTag.Name),
				RequestedTagType: stringPtrIfNotEmpty(newTag.Type),
			})
			if err != nil {
				slog.Warn("failed to insert new tag request", "error", err, "tag_name", newTag.Name)
			}
		}
	}

	RespondJSON(w, r, http.StatusCreated, result)
}

// AdminGetZmanRegistryRequests returns all zman registry requests (admin only)
//
//	@Summary	Get all zman registry requests
//	@Tags		Admin
//	@Produce	json
//	@Param		status	query	string	false	"Filter by status"
//	@Success	200		{array}	ZmanRegistryRequest
//	@Router		/api/v1/admin/registry/requests [get]
func (h *Handlers) AdminGetZmanRegistryRequests(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	status := r.URL.Query().Get("status")

	var rows []db.AdminGetAllZmanRequestsRow
	var err error

	if status != "" {
		statusRows, err := h.db.Queries.AdminGetZmanRequestsByStatus(ctx, status)
		if err != nil {
			slog.Error("error getting zman registry requests by status", "error", err)
			RespondInternalError(w, r, "Failed to get requests")
			return
		}
		// Convert AdminGetZmanRequestsByStatusRow to AdminGetAllZmanRequestsRow
		rows = make([]db.AdminGetAllZmanRequestsRow, len(statusRows))
		for i, sr := range statusRows {
			rows[i] = db.AdminGetAllZmanRequestsRow{
				ID:                   sr.ID,
				PublisherID:          sr.PublisherID,
				RequestedKey:         sr.RequestedKey,
				RequestedHebrewName:  sr.RequestedHebrewName,
				RequestedEnglishName: sr.RequestedEnglishName,
				RequestedFormulaDsl:  sr.RequestedFormulaDsl,
				TimeCategory:         sr.TimeCategory,
				Description:          sr.Description,
				Status:               sr.Status,
				ReviewedBy:           sr.ReviewedBy,
				ReviewedAt:           sr.ReviewedAt,
				ReviewerNotes:        sr.ReviewerNotes,
				CreatedAt:            sr.CreatedAt,
				PublisherName:        sr.PublisherName,
				PublisherEmail:       sr.PublisherEmail,
				SubmitterName:        sr.SubmitterName,
			}
		}
	} else {
		rows, err = h.db.Queries.AdminGetAllZmanRequests(ctx)
		if err != nil {
			slog.Error("error getting zman registry requests", "error", err)
			RespondInternalError(w, r, "Failed to get requests")
			return
		}
	}

	var requests []ZmanRegistryRequest
	for _, row := range rows {
		var req ZmanRegistryRequest
		req.ID = fmt.Sprintf("%d", row.ID)
		req.PublisherID = int32ToString(row.PublisherID)
		req.RequestedKey = row.RequestedKey
		req.RequestedHebrewName = row.RequestedHebrewName
		req.RequestedEnglishName = row.RequestedEnglishName
		req.RequestedFormulaDSL = row.RequestedFormulaDsl
		if row.TimeCategory != nil {
			req.TimeCategory = *row.TimeCategory
		}
		if row.Description != nil {
			req.Description = *row.Description
		}
		if row.Status != nil {
			req.Status = *row.Status
		}
		req.ReviewedBy = row.ReviewedBy
		if row.ReviewedAt.Valid {
			req.ReviewedAt = &row.ReviewedAt.Time
		}
		req.ReviewerNotes = row.ReviewerNotes
		req.CreatedAt = row.CreatedAt.Time
		req.PublisherName = row.PublisherName
		req.PublisherEmail = row.PublisherEmail
		req.SubmitterName = row.SubmitterName
		requests = append(requests, req)
	}

	if requests == nil {
		requests = []ZmanRegistryRequest{}
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"requests": requests,
		"total":    len(requests),
	})
}

// AdminReviewZmanRegistryRequest approves or rejects a zman registry request
//
//	@Summary	Review zman registry request
//	@Tags		Admin
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"Request ID"
//	@Param		body	body		ReviewZmanRequestBody	true	"Review body"
//	@Success	200		{object}	ZmanRegistryRequest
//	@Router		/api/v1/admin/registry/requests/{id} [put]
func (h *Handlers) AdminReviewZmanRegistryRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestIDStr := chi.URLParam(r, "id")

	requestID, err := stringToInt32(requestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	// Get reviewer ID from context
	var reviewerID *string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			reviewerID = &sub
		}
	}

	var req ReviewZmanRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		RespondBadRequest(w, r, "Status must be 'approved' or 'rejected'")
		return
	}

	// First, fetch the full request to get email, name, and auto_add_on_approval
	fullRequest, err := h.db.Queries.GetZmanRequest(ctx, requestID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Request not found")
		return
	}
	if err != nil {
		slog.Error("error fetching zman request", "error", err, "request_id", requestID)
		RespondInternalError(w, r, "Failed to fetch request")
		return
	}

	// Start transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("error starting transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Update request status
	var result ZmanRegistryRequest
	err = tx.QueryRow(ctx, `
		UPDATE zman_registry_requests
		SET status = $2, reviewed_by = $3, reviewed_at = NOW(), reviewer_notes = $4
		WHERE id = $1
		RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
			requested_formula_dsl, time_category, description, status,
			reviewed_by, reviewed_at, reviewer_notes, created_at
	`, requestID, req.Status, reviewerID, req.ReviewerNotes).Scan(
		&result.ID, &result.PublisherID, &result.RequestedKey, &result.RequestedHebrewName,
		&result.RequestedEnglishName, &result.RequestedFormulaDSL, &result.TimeCategory,
		&result.Description, &result.Status, &result.ReviewedBy, &result.ReviewedAt,
		&result.ReviewerNotes, &result.CreatedAt)

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Request not found")
		return
	}
	if err != nil {
		slog.Error("error updating request", "error", err)
		RespondInternalError(w, r, "Failed to update request")
		return
	}

	// If approved, the registry entry is created by the frontend via POST /admin/registry/zmanim
	// with the admin's edits. We just need to handle auto-add to publisher's zmanim.
	if req.Status == "approved" {

		// Auto-add to publisher's zmanim if auto_add_on_approval is true
		if fullRequest.AutoAddOnApproval != nil && *fullRequest.AutoAddOnApproval {
			_, err = tx.Exec(ctx, `
				INSERT INTO publisher_zmanim (
					id, publisher_id, zman_key, hebrew_name, english_name,
					transliteration, description,
					formula_dsl, ai_explanation, publisher_comment,
					is_enabled, is_visible, is_published, is_custom, category,
					dependencies, sort_order, current_version
				)
				SELECT
					gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
					NULL, NULL, true, true, false, true, $8,
					'{}'::text[], 999, 1
				ON CONFLICT (publisher_id, zman_key) DO NOTHING
			`, fullRequest.PublisherID, result.RequestedKey, result.RequestedHebrewName,
				result.RequestedEnglishName, fullRequest.Transliteration,
				fullRequest.Description, result.RequestedFormulaDSL, result.TimeCategory)

			if err != nil {
				slog.Error("error auto-adding zman to publisher", "error", err, "publisher_id", fullRequest.PublisherID)
				// Don't fail the approval, just log the error
			} else {
				slog.Info("auto-added zman to publisher", "publisher_id", fullRequest.PublisherID, "zman_key", result.RequestedKey)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("error committing transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// Send email notification (non-blocking, after transaction commit)
	go func() {
		publisherEmail := ""
		if fullRequest.PublisherEmail != nil {
			publisherEmail = *fullRequest.PublisherEmail
		}
		publisherName := ""
		if fullRequest.PublisherName != nil {
			publisherName = *fullRequest.PublisherName
		}
		reviewerNotes := ""
		if req.ReviewerNotes != nil {
			reviewerNotes = *req.ReviewerNotes
		}

		if publisherEmail != "" && h.emailService != nil {
			hebrewName := result.RequestedHebrewName
			englishName := result.RequestedEnglishName
			zmanKey := result.RequestedKey

			var emailErr error
			if req.Status == "approved" {
				emailErr = h.emailService.SendZmanRequestApproved(
					publisherEmail,
					publisherName,
					hebrewName,
					englishName,
					zmanKey,
					reviewerNotes,
				)
			} else {
				emailErr = h.emailService.SendZmanRequestRejected(
					publisherEmail,
					publisherName,
					hebrewName,
					englishName,
					zmanKey,
					reviewerNotes,
				)
			}

			if emailErr != nil {
				slog.Error("failed to send zman request review email",
					"error", emailErr,
					"publisher_email", publisherEmail,
					"status", req.Status,
					"request_id", requestID,
				)
			} else {
				slog.Info("sent zman request review email",
					"publisher_email", publisherEmail,
					"status", req.Status,
					"request_id", requestID,
				)
			}
		}
	}()

	RespondJSON(w, r, http.StatusOK, result)
}

// AdminGetZmanRegistryRequestByID returns a specific zman registry request by ID
//
//	@Summary	Get zman registry request by ID
//	@Tags		Admin
//	@Produce	json
//	@Param		id	path		string	true	"Request ID"
//	@Success	200	{object}	ZmanRegistryRequest
//	@Router		/api/v1/admin/zman-requests/{id} [get]
func (h *Handlers) AdminGetZmanRegistryRequestByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestIDStr := chi.URLParam(r, "id")

	requestID, err := stringToInt32(requestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	request, err := h.db.Queries.GetZmanRequest(ctx, requestID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Request not found")
		return
	}
	if err != nil {
		slog.Error("error getting zman request by ID", "error", err, "request_id", requestID)
		RespondInternalError(w, r, "Failed to get request")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"id":                     request.ID,
		"publisher_id":           request.PublisherID,
		"requested_key":          request.RequestedKey,
		"requested_hebrew_name":  request.RequestedHebrewName,
		"requested_english_name": request.RequestedEnglishName,
		"transliteration":        request.Transliteration,
		"requested_formula_dsl":  request.RequestedFormulaDsl,
		"time_category":          request.TimeCategory,
		"description":            request.Description,
		"halachic_notes":         request.HalachicNotes,
		"halachic_source":        request.HalachicSource,
		"publisher_email":        request.PublisherEmail,
		"publisher_name":         request.PublisherName,
		"auto_add_on_approval":   request.AutoAddOnApproval,
		"status":                 request.Status,
		"reviewed_by":            request.ReviewedBy,
		"reviewed_at":            request.ReviewedAt,
		"reviewer_notes":         request.ReviewerNotes,
		"created_at":             request.CreatedAt,
		"submitter_name":         request.SubmitterName,
	})
}

// ZmanRequestTagResponse represents a tag associated with a zman request
type ZmanRequestTagResponse struct {
	ID               int32   `json:"id"`
	RequestID        int32   `json:"request_id"`
	TagID            *int32  `json:"tag_id,omitempty"`
	RequestedTagName *string `json:"requested_tag_name,omitempty"`
	RequestedTagType *string `json:"requested_tag_type,omitempty"`
	IsNewTagRequest  bool    `json:"is_new_tag_request"`
	ExistingTagKey   *string `json:"existing_tag_key,omitempty"`
	ExistingTagName  *string `json:"existing_tag_name,omitempty"`
	ExistingTagType  *string `json:"existing_tag_type,omitempty"`
}

// AdminGetZmanRequestTags returns all tags for a zman request
// If a requested new tag already exists in zman_tags, it will be auto-linked
//
//	@Summary	Get tags for zman request
//	@Tags		Admin
//	@Produce	json
//	@Param		id	path	string	true	"Request ID"
//	@Success	200	{array}	ZmanRequestTagResponse
//	@Router		/api/v1/admin/zman-requests/{id}/tags [get]
func (h *Handlers) AdminGetZmanRequestTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestIDStr := chi.URLParam(r, "id")

	requestID, err := stringToInt32(requestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	tags, err := h.db.Queries.GetZmanRequestTags(ctx, requestID)
	if err != nil {
		slog.Error("error getting zman request tags", "error", err, "request_id", requestID)
		RespondInternalError(w, r, "Failed to get tags")
		return
	}

	result := make([]ZmanRequestTagResponse, 0, len(tags))
	for _, t := range tags {
		tag := ZmanRequestTagResponse{
			ID:              t.ID,
			RequestID:       t.RequestID,
			IsNewTagRequest: t.IsNewTagRequest,
		}

		// Check if this is a new tag request that might already exist
		if t.IsNewTagRequest && t.RequestedTagName != nil {
			// Try to find an existing tag with the same name
			existingTag, findErr := h.db.Queries.FindTagByName(ctx, *t.RequestedTagName)
			if findErr == nil {
				// Tag already exists - auto-link it
				slog.Info("auto-linking existing tag to request",
					"tag_request_id", t.ID,
					"existing_tag_id", existingTag.ID,
					"tag_name", *t.RequestedTagName)

				// Link the tag to the request
				linkErr := h.db.Queries.LinkTagToRequest(ctx, db.LinkTagToRequestParams{
					ID:    t.ID,
					TagID: &existingTag.ID,
				})
				if linkErr != nil {
					slog.Error("failed to auto-link tag", "error", linkErr, "tag_request_id", t.ID)
					// Continue anyway, just don't auto-link
				} else {
					// Update the response to reflect the linked tag
					tag.TagID = &existingTag.ID
					tag.IsNewTagRequest = false
					tag.ExistingTagKey = &existingTag.TagKey
					tag.ExistingTagName = &existingTag.Name
					tag.ExistingTagType = &existingTag.TagType
					result = append(result, tag)
					continue
				}
			}
			// Tag doesn't exist or find failed - keep as new tag request
		}

		// Copy TagID if present
		if t.TagID != nil {
			tag.TagID = t.TagID
		}
		if t.RequestedTagName != nil {
			tag.RequestedTagName = t.RequestedTagName
		}
		if t.RequestedTagType != nil {
			tag.RequestedTagType = t.RequestedTagType
		}
		if t.ExistingTagKey != nil {
			tag.ExistingTagKey = t.ExistingTagKey
		}
		if t.ExistingTagName != nil {
			tag.ExistingTagName = t.ExistingTagName
		}
		if t.ExistingTagType != nil {
			tag.ExistingTagType = t.ExistingTagType
		}
		result = append(result, tag)
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// ApprovedTagResponse represents a newly created tag from approval
type ApprovedTagResponse struct {
	ID                 int32  `json:"id"`
	TagKey             string `json:"tag_key"`
	Name               string `json:"name"`
	DisplayNameHebrew  string `json:"display_name_hebrew"`
	DisplayNameEnglish string `json:"display_name_english"`
	TagType            string `json:"tag_type"`
}

// AdminApproveTagRequest approves a new tag request, creating the tag
//
//	@Summary	Approve tag request
//	@Tags		Admin
//	@Produce	json
//	@Param		id				path		string	true	"Request ID"
//	@Param		tagRequestId	path		string	true	"Tag Request ID"
//	@Success	200				{object}	ApprovedTagResponse
//	@Router		/api/v1/admin/zman-requests/{id}/tags/{tagRequestId}/approve [post]
func (h *Handlers) AdminApproveTagRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestIDStr := chi.URLParam(r, "id")
	tagRequestIDStr := chi.URLParam(r, "tagRequestId")

	requestID, err := stringToInt32(requestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	tagRequestID, err := stringToInt32(tagRequestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid tag request ID")
		return
	}

	// Get the tag request first
	tagReq, err := h.db.Queries.GetZmanRequestTag(ctx, tagRequestID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Tag request not found")
		return
	}
	if err != nil {
		slog.Error("error getting tag request", "error", err, "tag_request_id", tagRequestID)
		RespondInternalError(w, r, "Failed to get tag request")
		return
	}

	// Verify it belongs to the specified zman request
	if tagReq.RequestID != requestID {
		RespondBadRequest(w, r, "Tag request does not belong to this zman request")
		return
	}

	// Must be a new tag request
	if !tagReq.IsNewTagRequest {
		RespondBadRequest(w, r, "This is not a new tag request")
		return
	}

	if tagReq.RequestedTagName == nil {
		RespondBadRequest(w, r, "Tag request has no name")
		return
	}

	// Generate tag key from name (lowercase, underscores)
	tagKey := generateTagKey(*tagReq.RequestedTagName)
	tagTypeKey := "behavior" // Default type key
	if tagReq.RequestedTagType != nil {
		tagTypeKey = *tagReq.RequestedTagType
	}

	// Create the new tag
	newTag, err := h.db.Queries.ApproveTagRequest(ctx, db.ApproveTagRequestParams{
		TagKey:                      tagKey,
		Name:                        *tagReq.RequestedTagName,
		DisplayNameHebrew:           *tagReq.RequestedTagName, // Same for now
		DisplayNameEnglishAshkenazi: *tagReq.RequestedTagName, // Same for now
		Key:                         tagTypeKey,
	})
	if err != nil {
		slog.Error("error creating tag", "error", err, "tag_key", tagKey)
		RespondInternalError(w, r, "Failed to create tag")
		return
	}

	// Link the new tag to the request
	err = h.db.Queries.LinkTagToRequest(ctx, db.LinkTagToRequestParams{
		ID:    tagRequestID,
		TagID: &newTag.ID,
	})
	if err != nil {
		slog.Error("error linking tag to request", "error", err, "tag_id", newTag.ID)
		// Don't fail - tag was created
	}

	slog.Info("tag request approved", "tag_id", newTag.ID, "tag_key", tagKey, "request_id", requestID)

	RespondJSON(w, r, http.StatusOK, ApprovedTagResponse{
		ID:                 newTag.ID,
		TagKey:             newTag.TagKey,
		Name:               newTag.Name,
		DisplayNameHebrew:  newTag.DisplayNameHebrew,
		DisplayNameEnglish: newTag.DisplayNameEnglishAshkenazi,
		TagType:            tagTypeKey,
	})
}

// AdminRejectTagRequest rejects a new tag request
//
//	@Summary	Reject tag request
//	@Tags		Admin
//	@Produce	json
//	@Param		id				path		string	true	"Request ID"
//	@Param		tagRequestId	path		string	true	"Tag Request ID"
//	@Success	200				{object}	map[string]string
//	@Router		/api/v1/admin/zman-requests/{id}/tags/{tagRequestId}/reject [post]
func (h *Handlers) AdminRejectTagRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requestIDStr := chi.URLParam(r, "id")
	tagRequestIDStr := chi.URLParam(r, "tagRequestId")

	requestID, err := stringToInt32(requestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid request ID")
		return
	}

	tagRequestID, err := stringToInt32(tagRequestIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid tag request ID")
		return
	}

	// Get the tag request first to verify
	tagReq, err := h.db.Queries.GetZmanRequestTag(ctx, tagRequestID)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Tag request not found")
		return
	}
	if err != nil {
		slog.Error("error getting tag request", "error", err, "tag_request_id", tagRequestID)
		RespondInternalError(w, r, "Failed to get tag request")
		return
	}

	// Verify it belongs to the specified zman request
	if tagReq.RequestID != requestID {
		RespondBadRequest(w, r, "Tag request does not belong to this zman request")
		return
	}

	// Must be a new tag request
	if !tagReq.IsNewTagRequest {
		RespondBadRequest(w, r, "This is not a new tag request")
		return
	}

	// Delete the tag request
	err = h.db.Queries.RejectTagRequest(ctx, tagRequestID)
	if err != nil {
		slog.Error("error rejecting tag request", "error", err, "tag_request_id", tagRequestID)
		RespondInternalError(w, r, "Failed to reject tag request")
		return
	}

	slog.Info("tag request rejected", "tag_request_id", tagRequestID, "request_id", requestID)

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"status":  "rejected",
		"message": "Tag request has been removed",
	})
}

// generateTagKey creates a tag key from a display name
func generateTagKey(name string) string {
	// Convert to lowercase and replace spaces with underscores
	key := strings.ToLower(name)
	key = strings.ReplaceAll(key, " ", "_")
	// Remove special characters
	var result strings.Builder
	for _, ch := range key {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_' {
			result.WriteRune(ch)
		}
	}
	return result.String()
}

// Helper function to check for duplicate key errors
func isDuplicateKeyError(err error) bool {
	return err != nil && (
	// pgx error codes for unique violation
	err.Error() == "duplicate key value violates unique constraint" ||
		// Check for common PostgreSQL error patterns
		len(err.Error()) > 0 && (err.Error()[0:23] == "ERROR: duplicate key" ||
			err.Error() == "23505" ||
			// Match partial error messages
			containsString(err.Error(), "duplicate key") ||
			containsString(err.Error(), "unique constraint")))
}

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// ============================================
// ASTRONOMICAL PRIMITIVES HANDLERS (PUBLIC)
// ============================================

// AstronomicalPrimitive represents a core astronomical time calculation
type AstronomicalPrimitive struct {
	ID           int32   `json:"id"`
	VariableName string  `json:"variable_name"`
	DisplayName  string  `json:"display_name"`
	Description  *string `json:"description,omitempty"`
	FormulaDSL   string  `json:"formula_dsl"`
	Category     string  `json:"category"`
	SortOrder    int     `json:"sort_order"`
}

// AstronomicalPrimitivesGrouped represents primitives grouped by category
type AstronomicalPrimitivesGrouped struct {
	Category    string                  `json:"category"`
	DisplayName string                  `json:"display_name"`
	Primitives  []AstronomicalPrimitive `json:"primitives"`
}

// loadPrimitivesCache loads astronomical primitives into memory cache
func (h *Handlers) loadPrimitivesCache(ctx context.Context) error {
	primitivesCacheMu.Lock()
	defer primitivesCacheMu.Unlock()

	// Double-check after acquiring lock
	if primitivesCacheLoaded {
		return nil
	}

	primitives, err := h.db.Queries.GetAstronomicalPrimitivesGrouped(ctx)
	if err != nil {
		return err
	}

	// Build flat list
	flatList := make([]AstronomicalPrimitive, len(primitives))
	for i, p := range primitives {
		flatList[i] = convertPrimitive(p)
	}
	primitivesCache = flatList

	// Build grouped list
	categoryMap := make(map[string][]AstronomicalPrimitive)
	categoryOrder := []string{"horizon", "civil_twilight", "nautical_twilight", "astronomical_twilight", "solar_position"}
	categoryDisplayNames := map[string]string{
		"horizon":               "Horizon Events",
		"civil_twilight":        "Civil Twilight",
		"nautical_twilight":     "Nautical Twilight",
		"astronomical_twilight": "Astronomical Twilight",
		"solar_position":        "Solar Position",
	}

	for _, prim := range flatList {
		categoryMap[prim.Category] = append(categoryMap[prim.Category], prim)
	}

	grouped := make([]AstronomicalPrimitivesGrouped, 0, len(categoryOrder))
	for _, cat := range categoryOrder {
		if prims, ok := categoryMap[cat]; ok {
			grouped = append(grouped, AstronomicalPrimitivesGrouped{
				Category:    cat,
				DisplayName: categoryDisplayNames[cat],
				Primitives:  prims,
			})
		}
	}
	primitivesGroupedCache = grouped
	primitivesCacheLoaded = true

	slog.Info("loaded astronomical primitives into cache", "count", len(flatList))
	return nil
}

// convertPrimitive converts DB primitive to API type
func convertPrimitive(p db.GetAstronomicalPrimitivesGroupedRow) AstronomicalPrimitive {
	var sortOrder int
	if p.SortOrder != nil {
		sortOrder = int(*p.SortOrder)
	}
	var category string
	if p.Category != nil {
		category = *p.Category
	}
	return AstronomicalPrimitive{
		ID:           p.ID,
		VariableName: p.VariableName,
		DisplayName:  p.DisplayName,
		Description:  p.Description,
		FormulaDSL:   p.FormulaDsl,
		Category:     category,
		SortOrder:    sortOrder,
	}
}

// GetAstronomicalPrimitives returns all astronomical primitives (cached)
//
//	@Summary	Get all astronomical primitives
//	@Tags		Registry
//	@Produce	json
//	@Success	200	{array}	AstronomicalPrimitive
//	@Router		/api/v1/registry/primitives [get]
func (h *Handlers) GetAstronomicalPrimitives(w http.ResponseWriter, r *http.Request) {
	// Check cache first (read lock)
	primitivesCacheMu.RLock()
	if primitivesCacheLoaded {
		result := primitivesCache
		primitivesCacheMu.RUnlock()
		RespondJSON(w, r, http.StatusOK, result)
		return
	}
	primitivesCacheMu.RUnlock()

	// Load cache
	if err := h.loadPrimitivesCache(r.Context()); err != nil {
		slog.Error("failed to fetch astronomical primitives", "error", err)
		RespondInternalError(w, r, "Failed to fetch astronomical primitives")
		return
	}

	primitivesCacheMu.RLock()
	result := primitivesCache
	primitivesCacheMu.RUnlock()

	RespondJSON(w, r, http.StatusOK, result)
}

// GetAstronomicalPrimitivesGrouped returns primitives grouped by category (cached)
//
//	@Summary	Get astronomical primitives grouped by category
//	@Tags		Registry
//	@Produce	json
//	@Success	200	{array}	AstronomicalPrimitivesGrouped
//	@Router		/api/v1/registry/primitives/grouped [get]
func (h *Handlers) GetAstronomicalPrimitivesGrouped(w http.ResponseWriter, r *http.Request) {
	// Check cache first (read lock)
	primitivesCacheMu.RLock()
	if primitivesCacheLoaded {
		result := primitivesGroupedCache
		primitivesCacheMu.RUnlock()
		RespondJSON(w, r, http.StatusOK, result)
		return
	}
	primitivesCacheMu.RUnlock()

	// Load cache
	if err := h.loadPrimitivesCache(r.Context()); err != nil {
		slog.Error("failed to fetch astronomical primitives", "error", err)
		RespondInternalError(w, r, "Failed to fetch astronomical primitives")
		return
	}

	primitivesCacheMu.RLock()
	result := primitivesGroupedCache
	primitivesCacheMu.RUnlock()

	RespondJSON(w, r, http.StatusOK, result)
}

// PrimitivePreviewData represents calculated time for a single primitive
type PrimitivePreviewData struct {
	VariableName string `json:"variable_name"`
	Time         string `json:"time"`         // HH:mm:ss exact time
	TimeRounded  string `json:"time_rounded"` // HH:mm:ss rounded
	TimeDisplay  string `json:"time_display"` // HH:mm display format
}

// PrimitivesPreviewResponse represents preview calculation for all primitives
type PrimitivesPreviewResponse struct {
	Date         string                 `json:"date"`
	LocalityID   int                    `json:"locality_id"`
	LocalityName string                 `json:"locality_name"`
	Primitives   []PrimitivePreviewData `json:"primitives"`
}

// GetAstronomicalPrimitivesPreview calculates times for all primitives at a specific location and date
//
//	@Summary	Preview all astronomical primitives for a location and date
//	@Tags		Registry
//	@Produce	json
//	@Param		locality_id	query		int		true	"Locality ID"
//	@Param		date		query		string	true	"Date in YYYY-MM-DD format"
//	@Success	200			{object}	PrimitivesPreviewResponse
//	@Failure	400			{object}	APIResponse{error=APIError}	"Missing or invalid parameters"
//	@Failure	404			{object}	APIResponse{error=APIError}	"Locality not found"
//	@Router		/api/v1/registry/primitives/preview [get]
func (h *Handlers) GetAstronomicalPrimitivesPreview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get query parameters
	localityIDStr := r.URL.Query().Get("locality_id")
	dateStr := r.URL.Query().Get("date")

	if localityIDStr == "" {
		RespondBadRequest(w, r, "locality_id is required")
		return
	}
	if dateStr == "" {
		RespondBadRequest(w, r, "date is required")
		return
	}

	localityID, err := strconv.Atoi(localityIDStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid locality_id")
		return
	}

	// Validate date format (YYYY-MM-DD)
	_, err = time.Parse("2006-01-02", dateStr)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format, use YYYY-MM-DD")
		return
	}

	// Get locality info with coordinates and elevation
	locality, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, int32(localityID))
	if err != nil {
		slog.Warn("locality not found for primitives preview", "locality_id", localityID, "error", err)
		RespondNotFound(w, r, "Locality not found")
		return
	}

	// Load timezone location
	tz := locality.Timezone
	if tz == "" {
		tz = "UTC"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		slog.Warn("invalid timezone for locality", "locality_id", localityID, "timezone", tz, "error", err)
		loc = time.UTC
	}

	// Get all primitives from cache
	primitivesCacheMu.RLock()
	if !primitivesCacheLoaded {
		primitivesCacheMu.RUnlock()
		if err := h.loadPrimitivesCache(ctx); err != nil {
			slog.Error("failed to load primitives cache", "error", err)
			RespondInternalError(w, r, "Failed to load primitives")
			return
		}
		primitivesCacheMu.RLock()
	}
	allPrimitives := primitivesCache
	primitivesCacheMu.RUnlock()

	// Parse date string to time.Time
	parsedDate, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		// This shouldn't happen as we validated above, but handle it
		RespondBadRequest(w, r, "Invalid date format")
		return
	}
	// Set to start of day in timezone
	date := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 0, 0, 0, 0, loc)

	// Calculate each primitive
	results := make([]PrimitivePreviewData, 0, len(allPrimitives))

	// Get coordinates (may be nil from view)
	var lat, lon float64
	var elev int32
	if locality.Latitude != nil {
		lat = *locality.Latitude
	}
	if locality.Longitude != nil {
		lon = *locality.Longitude
	}
	elev = locality.Elevation // Not nullable, defaults to 0

	for _, primitive := range allPrimitives {
		// Execute the DSL formula using the unified service
		result, err := h.unifiedZmanimService.CalculateFormula(ctx, services.FormulaParams{
			Formula:    primitive.FormulaDSL,
			Date:       date,
			Latitude:   lat,
			Longitude:  lon,
			Elevation:  float64(elev),
			Timezone:   loc,
			References: nil, // Primitives don't use references
		})

		if err != nil {
			slog.Warn("primitive calculation failed",
				"variable_name", primitive.VariableName,
				"formula", primitive.FormulaDSL,
				"error", err,
			)
			// Skip primitives that fail to calculate
			continue
		}

		results = append(results, PrimitivePreviewData{
			VariableName: primitive.VariableName,
			Time:         result.TimeExact,
			TimeRounded:  result.TimeRounded,
			TimeDisplay:  result.TimeRounded, // Use TimeRounded for display (HH:mm format)
		})
	}

	response := PrimitivesPreviewResponse{
		Date:         dateStr,
		LocalityID:   localityID,
		LocalityName: locality.Name,
		Primitives:   results,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// ============================================
// ADMIN MASTER ZMANIM REGISTRY CRUD HANDLERS
// ============================================

// AdminMasterZman represents a master zman with admin-specific fields
type AdminMasterZman struct {
	ID                   string    `json:"id"`
	ZmanKey              string    `json:"zman_key"`
	CanonicalHebrewName  string    `json:"canonical_hebrew_name"`
	CanonicalEnglishName string    `json:"canonical_english_name"`
	Transliteration      *string   `json:"transliteration,omitempty"`
	Description          *string   `json:"description,omitempty"`
	HalachicNotes        *string   `json:"halachic_notes,omitempty"`
	HalachicSource       *string   `json:"halachic_source,omitempty"`
	TimeCategory         string    `json:"time_category"`
	DefaultFormulaDSL    string    `json:"default_formula_dsl"`
	IsCore               bool      `json:"is_core"`
	IsHidden             bool      `json:"is_hidden"`
	CreatedBy            *string   `json:"created_by,omitempty"`
	UpdatedBy            *string   `json:"updated_by,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	Tags                 []ZmanTag `json:"tags,omitempty"`
	TagIDs               []int32   `json:"tag_ids,omitempty"`
}

// TagAssignment represents a tag with its negation state
type TagAssignment struct {
	TagID     int32 `json:"tag_id"` // Changed from string to int32 to match database type
	IsNegated bool  `json:"is_negated"`
}

// AdminCreateMasterZmanRequest represents a request to create a master zman
type AdminCreateMasterZmanRequest struct {
	ZmanKey              string          `json:"zman_key" validate:"required"`
	CanonicalHebrewName  string          `json:"canonical_hebrew_name" validate:"required"`
	CanonicalEnglishName string          `json:"canonical_english_name" validate:"required"`
	Transliteration      *string         `json:"transliteration"`
	Description          *string         `json:"description"`
	HalachicNotes        *string         `json:"halachic_notes"`
	HalachicSource       *string         `json:"halachic_source"`
	TimeCategory         string          `json:"time_category" validate:"required"`
	DefaultFormulaDSL    string          `json:"default_formula_dsl" validate:"required"`
	IsCore               bool            `json:"is_core"`
	IsHidden             bool            `json:"is_hidden"`
	Tags                 []TagAssignment `json:"tags"`
}

// AdminUpdateMasterZmanRequest represents a request to update a master zman
type AdminUpdateMasterZmanRequest struct {
	CanonicalHebrewName  *string         `json:"canonical_hebrew_name"`
	CanonicalEnglishName *string         `json:"canonical_english_name"`
	Transliteration      *string         `json:"transliteration"`
	Description          *string         `json:"description"`
	HalachicNotes        *string         `json:"halachic_notes"`
	HalachicSource       *string         `json:"halachic_source"`
	TimeCategory         *string         `json:"time_category"`
	DefaultFormulaDSL    *string         `json:"default_formula_dsl"`
	IsCore               *bool           `json:"is_core"`
	IsHidden             *bool           `json:"is_hidden"`
	Tags                 []TagAssignment `json:"tags"`
}

// AdminMasterZmanDetail extends AdminMasterZman with tags
type AdminMasterZmanDetail struct {
	AdminMasterZman
	Tags []ZmanTag `json:"tags"`
}

// AdminGetMasterZmanByID returns a single master zman by ID with tags and day types
//
//	@Summary	Get master zman by ID (admin)
//	@Tags		Admin
//	@Produce	json
//	@Param		id	path		string	true	"Zman ID"
//	@Success	200	{object}	AdminMasterZmanDetail
//	@Router		/api/v1/admin/registry/zmanim/{id} [get]
func (h *Handlers) AdminGetMasterZmanByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	zmanIDInt, err := stringToInt32(id)
	if err != nil {
		RespondBadRequest(w, r, "Invalid zman ID")
		return
	}

	row, err := h.db.Queries.AdminGetMasterZmanByID(ctx, zmanIDInt)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Master zman not found")
		return
	}
	if err != nil {
		slog.Error("error getting master zman", "error", err)
		RespondInternalError(w, r, "Failed to get master zman")
		return
	}

	var z AdminMasterZmanDetail
	z.ID = fmt.Sprintf("%d", row.ID)
	z.ZmanKey = row.ZmanKey
	z.CanonicalHebrewName = row.CanonicalHebrewName
	z.CanonicalEnglishName = row.CanonicalEnglishName
	z.Transliteration = row.Transliteration
	z.Description = row.Description
	z.HalachicNotes = row.HalachicNotes
	z.HalachicSource = row.HalachicSource
	if row.TimeCategory != nil {
		z.TimeCategory = *row.TimeCategory
	}
	if row.DefaultFormulaDsl != nil {
		z.DefaultFormulaDSL = *row.DefaultFormulaDsl
	}
	if row.IsCore != nil {
		z.IsCore = *row.IsCore
	}
	z.IsHidden = row.IsHidden
	z.CreatedAt = row.CreatedAt.Time
	z.UpdatedAt = row.UpdatedAt.Time

	// Get tags for this zman
	tagRows, err := h.db.Queries.GetMasterZmanTagsForDetail(ctx, zmanIDInt)
	if err == nil {
		for _, tagRow := range tagRows {
			var tag ZmanTag
			tag.ID = tagRow.ID
			tag.Name = tagRow.Name
			tag.DisplayNameHebrew = tagRow.DisplayNameHebrew
			tag.DisplayNameEnglish = tagRow.DisplayNameEnglishAshkenazi
			if tagRow.TagType != nil {
				tag.TagType = *tagRow.TagType
			}
			tag.Description = tagRow.Description
			tag.Color = tagRow.Color
			if tagRow.SortOrder != nil {
				tag.SortOrder = int(*tagRow.SortOrder)
			}
			tag.CreatedAt = tagRow.CreatedAt.Time
			z.Tags = append(z.Tags, tag)
		}
	}
	if z.Tags == nil {
		z.Tags = []ZmanTag{}
	}

	RespondJSON(w, r, http.StatusOK, z)
}

// AdminCreateMasterZman creates a new master zman
//
//	@Summary	Create master zman (admin)
//	@Tags		Admin
//	@Accept		json
//	@Produce	json
//	@Param		body	body		AdminCreateMasterZmanRequest	true	"Create request"
//	@Success	201		{object}	AdminMasterZman
//	@Router		/api/v1/admin/registry/zmanim [post]
func (h *Handlers) AdminCreateMasterZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get admin user ID from context for audit
	_ = r.Context() // userID would be used for audit logging if implemented

	var req AdminCreateMasterZmanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	validationErrors := make(map[string]string)
	if req.ZmanKey == "" {
		validationErrors["zman_key"] = "Zman key is required"
	}
	if req.CanonicalHebrewName == "" {
		validationErrors["canonical_hebrew_name"] = "Hebrew name is required"
	}
	if req.CanonicalEnglishName == "" {
		validationErrors["canonical_english_name"] = "English name is required"
	}
	if req.TimeCategory == "" {
		validationErrors["time_category"] = "Time category is required"
	}
	if req.DefaultFormulaDSL == "" {
		validationErrors["default_formula_dsl"] = "Default formula is required"
	}
	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Validation failed", validationErrors)
		return
	}

	row, err := h.db.Queries.AdminCreateMasterZmanWithAudit(ctx, db.AdminCreateMasterZmanWithAuditParams{
		ZmanKey:              req.ZmanKey,
		CanonicalHebrewName:  req.CanonicalHebrewName,
		CanonicalEnglishName: req.CanonicalEnglishName,
		Transliteration:      req.Transliteration,
		Description:          req.Description,
		HalachicNotes:        req.HalachicNotes,
		HalachicSource:       req.HalachicSource,
		Key:                  req.TimeCategory,
		DefaultFormulaDsl:    stringPtrIfNotEmpty(req.DefaultFormulaDSL),
		IsCore:               &req.IsCore,
		IsHidden:             req.IsHidden,
	})

	if err != nil {
		if isDuplicateKeyError(err) {
			RespondConflict(w, r, "A zman with this key already exists")
			return
		}
		slog.Error("error creating master zman", "error", err)
		RespondInternalError(w, r, "Failed to create master zman")
		return
	}

	// Convert SQLc types to handler types
	var result AdminMasterZman
	result.ID = fmt.Sprintf("%d", row.ID)
	result.ZmanKey = row.ZmanKey
	result.CanonicalHebrewName = row.CanonicalHebrewName
	result.CanonicalEnglishName = row.CanonicalEnglishName
	result.Transliteration = row.Transliteration
	result.Description = row.Description
	result.HalachicNotes = row.HalachicNotes
	result.HalachicSource = row.HalachicSource
	if row.DefaultFormulaDsl != nil {
		result.DefaultFormulaDSL = *row.DefaultFormulaDsl
	}
	if row.IsCore != nil {
		result.IsCore = *row.IsCore
	}
	result.IsHidden = row.IsHidden
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time

	// Add tags if provided
	if len(req.Tags) > 0 {
		zmanUUID := row.ID
		for _, tag := range req.Tags {
			// TagID is now int32, no conversion needed
			err := h.db.Queries.InsertMasterZmanTag(ctx, db.InsertMasterZmanTagParams{
				MasterZmanID: zmanUUID,
				TagID:        tag.TagID,
				IsNegated:    tag.IsNegated,
			})
			if err != nil {
				slog.Error("error inserting tag", "error", err)
			}
		}
		// Build TagIDs for response
		tagIDs := make([]int32, len(req.Tags))
		for i, tag := range req.Tags {
			tagIDs[i] = tag.TagID
		}
		result.TagIDs = tagIDs
	}

	RespondJSON(w, r, http.StatusCreated, result)
}

// AdminUpdateMasterZman updates an existing master zman
//
//	@Summary	Update master zman (admin)
//	@Tags		Admin
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string							true	"Zman ID"
//	@Param		body	body		AdminUpdateMasterZmanRequest	true	"Update request"
//	@Success	200		{object}	AdminMasterZman
//	@Router		/api/v1/admin/registry/zmanim/{id} [put]
func (h *Handlers) AdminUpdateMasterZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	// Get admin user ID from context for audit (unused for now)
	var userID *string
	if claims, ok := r.Context().Value("claims").(map[string]interface{}); ok {
		if sub, ok := claims["sub"].(string); ok {
			userID = &sub
		}
	}
	_ = userID // Suppress unused warning

	var req AdminUpdateMasterZmanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	zmanIDInt, err := stringToInt32(id)
	if err != nil {
		RespondBadRequest(w, r, "Invalid zman ID")
		return
	}

	// Use SQLc query for update
	row, err := h.db.Queries.AdminUpdateMasterZmanSimple(ctx, db.AdminUpdateMasterZmanSimpleParams{
		ID:                   zmanIDInt,
		CanonicalHebrewName:  req.CanonicalHebrewName,
		CanonicalEnglishName: req.CanonicalEnglishName,
		Transliteration:      req.Transliteration,
		Description:          req.Description,
		HalachicNotes:        req.HalachicNotes,
		HalachicSource:       req.HalachicSource,
		TimeCategory:         req.TimeCategory,
		DefaultFormulaDsl:    req.DefaultFormulaDSL,
		IsCore:               req.IsCore,
		IsHidden:             req.IsHidden,
	})

	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Master zman not found")
		return
	}
	if err != nil {
		slog.Error("error updating master zman", "error", err)
		RespondInternalError(w, r, "Failed to update master zman")
		return
	}

	// Convert SQLc types to handler types
	var result AdminMasterZman
	result.ID = fmt.Sprintf("%d", row.ID)
	result.ZmanKey = row.ZmanKey
	result.CanonicalHebrewName = row.CanonicalHebrewName
	result.CanonicalEnglishName = row.CanonicalEnglishName
	result.Transliteration = row.Transliteration
	result.Description = row.Description
	result.HalachicNotes = row.HalachicNotes
	result.HalachicSource = row.HalachicSource
	if row.DefaultFormulaDsl != nil {
		result.DefaultFormulaDSL = *row.DefaultFormulaDsl
	}
	if row.IsCore != nil {
		result.IsCore = *row.IsCore
	}
	result.IsHidden = row.IsHidden
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time

	// Update tags if provided
	if req.Tags != nil {
		// Delete existing tags
		err := h.db.Queries.DeleteMasterZmanTags(ctx, zmanIDInt)
		if err != nil {
			slog.Error("error deleting existing tags", "error", err)
		}

		// Insert new tags with negation
		for _, tag := range req.Tags {
			// TagID is now int32, no conversion needed
			err := h.db.Queries.InsertMasterZmanTag(ctx, db.InsertMasterZmanTagParams{
				MasterZmanID: zmanIDInt,
				TagID:        tag.TagID,
				IsNegated:    tag.IsNegated,
			})
			if err != nil {
				slog.Error("error inserting tag", "error", err)
			}
		}
		// Build TagIDs for response
		tagIDs := make([]int32, len(req.Tags))
		for i, tag := range req.Tags {
			tagIDs[i] = tag.TagID
		}
		result.TagIDs = tagIDs
	}

	// If default_formula_dsl changed, invalidate cache for ALL publishers using this master zman
	if req.DefaultFormulaDSL != nil && h.cache != nil {
		// Convert string ID to int32
		masterZmanID, parseErr := stringToInt32(id)
		if parseErr != nil {
			slog.Error("failed to parse master zman ID for cache invalidation", "error", parseErr, "zman_id", id)
		} else {
			publisherIDs, err := h.db.Queries.GetPublishersUsingMasterZman(ctx, &masterZmanID)
			if err != nil {
				slog.Error("failed to get publishers using master zman", "error", err, "zman_id", id)
			} else if len(publisherIDs) > 0 {
				for _, pubID := range publisherIDs {
					// Convert int32 publisher ID to string for cache
					pubIDStr := int32ToString(pubID)
					if err := h.cache.InvalidatePublisherCache(ctx, pubIDStr); err != nil {
						slog.Warn("failed to invalidate publisher cache after registry update",
							"error", err, "publisher_id", pubIDStr, "zman_id", id)
					}
				}
				slog.Info("invalidated caches for publishers using updated master zman",
					"zman_id", id, "publisher_count", len(publisherIDs))
			}
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// AdminDeleteMasterZman deletes a master zman
//
//	@Summary	Delete master zman (admin)
//	@Tags		Admin
//	@Param		id	path		string	true	"Zman ID"
//	@Success	200	{object}	map[string]string
//	@Router		/api/v1/admin/registry/zmanim/{id} [delete]
func (h *Handlers) AdminDeleteMasterZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	zmanIDInt, err := stringToInt32(id)
	if err != nil {
		RespondBadRequest(w, r, "Invalid zman ID")
		return
	}

	// Check if any publishers are using this zman
	zmanIDPtr := &zmanIDInt
	inUse, err := h.db.Queries.CheckMasterZmanInUse(ctx, zmanIDPtr)
	if err != nil {
		slog.Error("error checking zman usage", "error", err)
		RespondInternalError(w, r, "Failed to check zman usage")
		return
	}

	if inUse {
		RespondConflict(w, r, "Cannot delete zman that is in use by publishers. Consider hiding it instead.")
		return
	}

	err = h.db.Queries.AdminDeleteMasterZman(ctx, zmanIDInt)
	if err != nil {
		slog.Error("error deleting master zman", "error", err)
		RespondInternalError(w, r, "Failed to delete master zman")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"message": "Master zman deleted successfully",
	})
}

// AdminToggleZmanVisibility toggles the hidden status of a master zman
//
//	@Summary	Toggle zman visibility (admin)
//	@Tags		Admin
//	@Param		id	path		string	true	"Zman ID"
//	@Success	200	{object}	AdminMasterZman
//	@Router		/api/v1/admin/registry/zmanim/{id}/toggle-visibility [post]
func (h *Handlers) AdminToggleZmanVisibility(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	zmanIDInt, err := stringToInt32(id)
	if err != nil {
		RespondBadRequest(w, r, "Invalid zman ID")
		return
	}

	row, err := h.db.Queries.AdminToggleZmanVisibilityWithAudit(ctx, zmanIDInt)
	if err == pgx.ErrNoRows {
		RespondNotFound(w, r, "Master zman not found")
		return
	}
	if err != nil {
		slog.Error("error toggling zman visibility", "error", err)
		RespondInternalError(w, r, "Failed to toggle visibility")
		return
	}

	// Convert SQLc types to handler types
	var result AdminMasterZman
	result.ID = fmt.Sprintf("%d", row.ID)
	result.ZmanKey = row.ZmanKey
	result.CanonicalHebrewName = row.CanonicalHebrewName
	result.CanonicalEnglishName = row.CanonicalEnglishName
	result.Transliteration = row.Transliteration
	result.Description = row.Description
	result.HalachicNotes = row.HalachicNotes
	result.HalachicSource = row.HalachicSource
	if row.DefaultFormulaDsl != nil {
		result.DefaultFormulaDSL = *row.DefaultFormulaDsl
	}
	if row.IsCore != nil {
		result.IsCore = *row.IsCore
	}
	result.IsHidden = row.IsHidden
	result.CreatedAt = row.CreatedAt.Time
	result.UpdatedAt = row.UpdatedAt.Time

	RespondJSON(w, r, http.StatusOK, result)
}

// AdminGetTimeCategories returns all available time categories
//
//	@Summary	Get time categories (admin)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{array}	map[string]string
//	@Router		/api/v1/admin/registry/time-categories [get]
func (h *Handlers) AdminGetTimeCategories(w http.ResponseWriter, r *http.Request) {
	categories := []map[string]string{
		{"key": "dawn", "display_name": "Dawn"},
		{"key": "sunrise", "display_name": "Sunrise"},
		{"key": "morning", "display_name": "Morning"},
		{"key": "midday", "display_name": "Midday"},
		{"key": "afternoon", "display_name": "Afternoon"},
		{"key": "sunset", "display_name": "Sunset"},
		{"key": "nightfall", "display_name": "Nightfall"},
		{"key": "midnight", "display_name": "Midnight"},
	}
	RespondJSON(w, r, http.StatusOK, categories)
}

// AdminGetTags returns all zman tags (admin)
//
//	@Summary	Get all zman tags (admin)
//	@Tags		Admin
//	@Produce	json
//	@Success	200	{array}	ZmanTag
//	@Router		/api/v1/admin/registry/tags [get]
func (h *Handlers) AdminGetTags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := h.db.Queries.GetAllTagsAdmin(ctx)
	if err != nil {
		slog.Error("error getting tags", "error", err)
		RespondInternalError(w, r, "Failed to get tags")
		return
	}

	var tags []ZmanTag
	for _, row := range rows {
		var tag ZmanTag
		tag.ID = row.ID
		tag.Name = row.Name
		tag.DisplayNameHebrew = row.DisplayNameHebrew
		tag.DisplayNameEnglish = row.DisplayNameEnglishAshkenazi
		if row.TagType != nil {
			tag.TagType = *row.TagType
		}
		tag.Description = row.Description
		tag.Color = row.Color
		if row.SortOrder != nil {
			tag.SortOrder = int(*row.SortOrder)
		}
		tag.CreatedAt = row.CreatedAt.Time
		tags = append(tags, tag)
	}

	if tags == nil {
		tags = []ZmanTag{}
	}

	RespondJSON(w, r, http.StatusOK, tags)
}

// ============================================
// REGISTRY BROWSER HANDLERS (Story 11.1)
// ============================================

// ListMasterZmanimForRegistry returns paginated master zmanim with filters for the registry browser
//
//	@Summary		List master zmanim for registry browser
//	@Description	Get paginated list of master zmanim with filtering by category, shita, status, and search
//	@Tags			Registry
//	@Accept			json
//	@Produce		json
//	@Param			category	query		[]string	false	"Filter by categories (e.g., ALOS, SHEMA)"
//	@Param			shita		query		[]string	false	"Filter by shitas (e.g., GRA, MGA)"
//	@Param			status		query		string		false	"Filter by import status: all, available, imported"
//	@Param			search		query		string		false	"Search by name, formula, or key"
//	@Param			locality_id	query		int			false	"Locality ID for preview time calculation"
//	@Param			date		query		string		false	"Date for preview times (YYYY-MM-DD, defaults to today)"
//	@Param			page		query		int			false	"Page number (default: 1)"
//	@Param			limit		query		int			false	"Items per page (default: 50, max: 100)"
//	@Success		200			{object}	RegistryBrowserResponse
//	@Router			/api/v1/publisher/registry/master [get]
func (h *Handlers) ListMasterZmanimForRegistry(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	publisherID, err := stringToInt32(pc.PublisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Step 2: Parse query params
	query := r.URL.Query()

	// Parse categories (comma-separated or multiple params)
	var categories []string
	if catParam := query.Get("category"); catParam != "" {
		categories = strings.Split(catParam, ",")
	} else if catParams := query["category"]; len(catParams) > 0 {
		categories = catParams
	}

	// Parse shitas (comma-separated or multiple params)
	var shitas []string
	if shitaParam := query.Get("shita"); shitaParam != "" {
		shitas = strings.Split(shitaParam, ",")
	} else if shitaParams := query["shita"]; len(shitaParams) > 0 {
		shitas = shitaParams
	}

	// Parse status filter
	status := query.Get("status")
	if status != "" && status != "all" && status != "available" && status != "imported" {
		RespondBadRequest(w, r, "Invalid status filter. Must be 'all', 'available', or 'imported'")
		return
	}
	if status == "all" {
		status = "" // Treat 'all' as no filter
	}

	// Parse search
	search := query.Get("search")

	// Parse locality_id for preview times
	var localityID int32
	if localityIDStr := query.Get("locality_id"); localityIDStr != "" {
		if lid, err := strconv.Atoi(localityIDStr); err == nil && lid > 0 {
			localityID = int32(lid)
		}
	}

	// Parse date for preview times (YYYY-MM-DD format)
	var previewDateParam string
	if dateStr := query.Get("date"); dateStr != "" {
		previewDateParam = dateStr
	}

	// Parse pagination
	page := 1
	if pageStr := query.Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := 50
	if limitStr := query.Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	offset := (page - 1) * limit

	// Step 3: Build query params
	var searchParam, statusParam *string
	if search != "" {
		searchParam = &search
	}
	if status != "" {
		statusParam = &status
	}

	// Step 4: Execute queries in parallel
	type listResult struct {
		rows []db.ListMasterZmanimForRegistryRow
		err  error
	}
	type countResult struct {
		count int64
		err   error
	}

	listCh := make(chan listResult, 1)
	countCh := make(chan countResult, 1)

	go func() {
		rows, err := h.db.Queries.ListMasterZmanimForRegistry(ctx, db.ListMasterZmanimForRegistryParams{
			PublisherID: publisherID,
			Categories:  categories,
			Shitas:      shitas,
			Search:      searchParam,
			Status:      statusParam,
			Limit:       int32(limit),
			Offset:      int32(offset),
		})
		listCh <- listResult{rows, err}
	}()

	go func() {
		count, err := h.db.Queries.CountMasterZmanimForRegistry(ctx, db.CountMasterZmanimForRegistryParams{
			PublisherID: publisherID,
			Categories:  categories,
			Shitas:      shitas,
			Search:      searchParam,
			Status:      statusParam,
		})
		countCh <- countResult{count, err}
	}()

	listRes := <-listCh
	countRes := <-countCh

	if listRes.err != nil {
		slog.Error("failed to list master zmanim for registry", "error", listRes.err)
		RespondInternalError(w, r, "Failed to list master zmanim")
		return
	}

	if countRes.err != nil {
		slog.Error("failed to count master zmanim for registry", "error", countRes.err)
		RespondInternalError(w, r, "Failed to count master zmanim")
		return
	}

	// Step 5: Convert to response format and calculate preview times if locality provided
	items := make([]MasterZmanForRegistry, 0, len(listRes.rows))

	// If locality_id provided, fetch locality and calculate preview times
	var locality *db.GetLocalityByIDRow
	var tz *time.Location
	var previewDate time.Time
	if localityID > 0 {
		loc, err := h.db.Queries.GetLocalityByID(ctx, localityID)
		if err == nil && loc.Latitude != nil && loc.Longitude != nil {
			locality = &loc
			tz, _ = time.LoadLocation(loc.Timezone)

			// Parse date parameter or use today's date in the locality's timezone
			if previewDateParam != "" {
				parsedDate, err := time.Parse("2006-01-02", previewDateParam)
				if err == nil {
					// Set the date in the locality's timezone
					if tz != nil {
						previewDate = time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 12, 0, 0, 0, tz)
					} else {
						previewDate = parsedDate
					}
				} else {
					// Fallback to today if parsing fails
					if tz != nil {
						previewDate = time.Now().In(tz)
					} else {
						previewDate = time.Now()
					}
				}
			} else {
				// Use today's date in the locality's timezone
				if tz != nil {
					previewDate = time.Now().In(tz)
				} else {
					previewDate = time.Now()
				}
			}
		}
	}

	for _, row := range listRes.rows {
		item := MasterZmanForRegistry{
			ID:                   int32ToString(row.ID),
			ZmanKey:              row.ZmanKey,
			CanonicalHebrewName:  row.CanonicalHebrewName,
			CanonicalEnglishName: row.CanonicalEnglishName,
			Transliteration:      row.Transliteration,
			Description:          row.Description,
			DefaultFormulaDSL:    row.DefaultFormulaDsl,
			Category:             row.Category,
			Shita:                row.Shita,
			TimeCategory:         row.TimeCategory,
			IsCore:               row.IsCore,
			AlreadyImported:      row.AlreadyImported,
			ExistingIsDeleted:    row.ExistingIsDeleted,
		}

		// Calculate preview time if locality available and formula exists
		if locality != nil && row.DefaultFormulaDsl != nil && *row.DefaultFormulaDsl != "" {
			var elevation float64
			if locality.ElevationM != nil {
				elevation = float64(*locality.ElevationM)
			}

			result, err := h.unifiedZmanimService.CalculateFormula(ctx, services.FormulaParams{
				Formula:   *row.DefaultFormulaDsl,
				Date:      previewDate,
				Latitude:  *locality.Latitude,
				Longitude: *locality.Longitude,
				Elevation: elevation,
				Timezone:  tz,
			})
			if err == nil && result.TimeRounded != "" {
				item.PreviewTime = &result.TimeRounded
			}
		}

		items = append(items, item)
	}

	totalPages := int(countRes.count) / limit
	if int(countRes.count)%limit > 0 {
		totalPages++
	}

	// Step 6: Respond
	response := RegistryBrowserResponse{
		Items:      items,
		Total:      countRes.count,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// GetRegistryFilters returns available filter options for the registry browser
//
//	@Summary		Get registry filter options
//	@Description	Get available categories and shitas for filtering
//	@Tags			Registry
//	@Produce		json
//	@Success		200	{object}	RegistryFiltersResponse
//	@Router			/api/v1/publisher/registry/filters [get]
func (h *Handlers) GetRegistryFilters(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get distinct categories
	categories, err := h.db.Queries.GetDistinctCategories(ctx)
	if err != nil {
		slog.Error("failed to get distinct categories", "error", err)
		RespondInternalError(w, r, "Failed to get filter options")
		return
	}

	// Get distinct shitas
	shitas, err := h.db.Queries.GetDistinctShitas(ctx)
	if err != nil {
		slog.Error("failed to get distinct shitas", "error", err)
		RespondInternalError(w, r, "Failed to get filter options")
		return
	}

	// Convert nil pointers to empty strings and filter nulls
	catStrings := make([]string, 0, len(categories))
	for _, c := range categories {
		if c != nil {
			catStrings = append(catStrings, *c)
		}
	}

	shitaStrings := make([]string, 0, len(shitas))
	for _, s := range shitas {
		if s != nil {
			shitaStrings = append(shitaStrings, *s)
		}
	}

	response := RegistryFiltersResponse{
		Categories: catStrings,
		Shitas:     shitaStrings,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// MasterZmanDocumentation represents full documentation for a master zman
type MasterZmanDocumentation struct {
	ID                   string  `json:"id"`
	ZmanKey              string  `json:"zman_key"`
	CanonicalHebrewName  string  `json:"canonical_hebrew_name"`
	CanonicalEnglishName string  `json:"canonical_english_name"`
	Transliteration      string  `json:"transliteration"`
	Description          string  `json:"description"`
	DefaultFormulaDsl    string  `json:"default_formula_dsl"`
	HalachicNotes        *string `json:"halachic_notes,omitempty"`
	HalachicSource       *string `json:"halachic_source,omitempty"`
	FullDescription      *string `json:"full_description,omitempty"`
	FormulaExplanation   *string `json:"formula_explanation,omitempty"`
	UsageContext         *string `json:"usage_context,omitempty"`
	RelatedZmanimIds     []int32 `json:"related_zmanim_ids,omitempty"`
	Shita                *string `json:"shita,omitempty"`
	Category             *string `json:"category,omitempty"`
	IsCore               bool    `json:"is_core"`
	TimeCategory         *string `json:"time_category,omitempty"`
	CreatedAt            string  `json:"created_at"`
	UpdatedAt            string  `json:"updated_at"`
}

// RelatedZmanInfo represents basic info for a related zman
type RelatedZmanInfo struct {
	ID                   string `json:"id"`
	ZmanKey              string `json:"zman_key"`
	CanonicalHebrewName  string `json:"canonical_hebrew_name"`
	CanonicalEnglishName string `json:"canonical_english_name"`
	Transliteration      string `json:"transliteration"`
}

// MasterZmanDocumentationResponse is the response for the documentation endpoint
type MasterZmanDocumentationResponse struct {
	MasterZman    MasterZmanDocumentation `json:"master_zman"`
	RelatedZmanim []RelatedZmanInfo       `json:"related_zmanim"`
}

// GetMasterZmanDocumentation returns full documentation for a master zman
//
//	@Summary		Get master zman documentation
//	@Description	Get full documentation for a specific master zman
//	@Tags			Registry
//	@Produce		json
//	@Param			id	path		int	true	"Master Zman ID"
//	@Success		200	{object}	MasterZmanDocumentationResponse
//	@Failure		400	{object}	ErrorResponse
//	@Failure		404	{object}	ErrorResponse
//	@Router			/api/v1/publisher/registry/master/{id}/documentation [get]
func (h *Handlers) GetMasterZmanDocumentation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Get ID from URL
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil || id <= 0 {
		RespondBadRequest(w, r, "Invalid master zman ID")
		return
	}

	// 2. Fetch documentation
	doc, err := h.db.Queries.GetMasterZmanDocumentation(ctx, int32(id))
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Master zman not found")
			return
		}
		slog.Error("failed to get master zman documentation", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get documentation")
		return
	}

	// 3. Fetch related zmanim if IDs exist
	var relatedZmanim []RelatedZmanInfo
	if len(doc.RelatedZmanimIds) > 0 {
		// Convert int32 to int64 for the query
		ids := make([]int64, len(doc.RelatedZmanimIds))
		for i, relId := range doc.RelatedZmanimIds {
			ids[i] = int64(relId)
		}

		relatedRows, err := h.db.Queries.GetRelatedZmanimDetails(ctx, ids)
		if err != nil {
			slog.Warn("failed to get related zmanim details", "error", err)
			// Non-fatal, continue without related zmanim
		} else {
			relatedZmanim = make([]RelatedZmanInfo, len(relatedRows))
			for i, row := range relatedRows {
				relatedZmanim[i] = RelatedZmanInfo{
					ID:                   strconv.Itoa(int(row.ID)),
					ZmanKey:              row.ZmanKey,
					CanonicalHebrewName:  row.CanonicalHebrewName,
					CanonicalEnglishName: row.CanonicalEnglishName,
					Transliteration:      derefString(row.Transliteration),
				}
			}
		}
	}

	// Dereference IsCore safely
	isCore := false
	if doc.IsCore != nil {
		isCore = *doc.IsCore
	}

	// 4. Build response
	response := MasterZmanDocumentationResponse{
		MasterZman: MasterZmanDocumentation{
			ID:                   strconv.Itoa(int(doc.ID)),
			ZmanKey:              doc.ZmanKey,
			CanonicalHebrewName:  doc.CanonicalHebrewName,
			CanonicalEnglishName: doc.CanonicalEnglishName,
			Transliteration:      derefString(doc.Transliteration),
			Description:          derefString(doc.Description),
			DefaultFormulaDsl:    derefString(doc.DefaultFormulaDsl),
			HalachicNotes:        doc.HalachicNotes,
			HalachicSource:       doc.HalachicSource,
			FullDescription:      doc.FullDescription,
			FormulaExplanation:   doc.FormulaExplanation,
			UsageContext:         doc.UsageContext,
			RelatedZmanimIds:     doc.RelatedZmanimIds,
			Shita:                doc.Shita,
			Category:             doc.Category,
			IsCore:               isCore,
			TimeCategory:         doc.TimeCategory,
			CreatedAt:            doc.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
			UpdatedAt:            doc.UpdatedAt.Time.Format("2006-01-02T15:04:05Z"),
		},
		RelatedZmanim: relatedZmanim,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// ============================================
// PUBLISHER EXAMPLES BROWSER (Story 11.3)
// ============================================

// ValidatedPublisher represents a publisher available for browsing examples
type ValidatedPublisher struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// ListValidatedPublishers returns all verified/active publishers
//
//	@Summary		List validated publishers
//	@Description	Get all verified publishers available for browsing zmanim examples
//	@Tags			Registry
//	@Produce		json
//	@Success		200	{object}	[]ValidatedPublisher
//	@Router			/api/v1/publisher/registry/publishers [get]
func (h *Handlers) ListValidatedPublishers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	publishers, err := h.db.Queries.ListValidatedPublishers(ctx)
	if err != nil {
		slog.Error("failed to list validated publishers", "error", err)
		RespondInternalError(w, r, "Failed to get publishers")
		return
	}

	result := make([]ValidatedPublisher, len(publishers))
	for i, p := range publishers {
		result[i] = ValidatedPublisher{
			ID:          strconv.Itoa(int(p.ID)),
			Name:        p.Name,
			Description: p.Description,
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// PublisherZmanForExamples represents a zman from another publisher for browsing
type PublisherZmanForExamples struct {
	ID                string  `json:"id"`
	ZmanKey           string  `json:"zman_key"`
	HebrewName        string  `json:"hebrew_name"`
	EnglishName       string  `json:"english_name"`
	Description       *string `json:"description,omitempty"`
	FormulaDsl        *string `json:"formula_dsl,omitempty"`
	MasterZmanId      *int32  `json:"master_zman_id,omitempty"`
	MasterEnglishName *string `json:"master_english_name,omitempty"`
	MasterHebrewName  *string `json:"master_hebrew_name,omitempty"`
	Category          *string `json:"category,omitempty"`
	Shita             *string `json:"shita,omitempty"`
	AlreadyHaveMaster bool    `json:"already_have_master"`
	ExistingIsDeleted bool    `json:"existing_is_deleted"`
}

// PublisherZmanimResponse is the response for listing a publisher's zmanim
type PublisherZmanimResponse struct {
	Publisher  ValidatedPublisher         `json:"publisher"`
	Zmanim     []PublisherZmanForExamples `json:"zmanim"`
	Total      int64                      `json:"total"`
	Page       int                        `json:"page"`
	Limit      int                        `json:"limit"`
	TotalPages int                        `json:"total_pages"`
}

// GetPublisherZmanimForExamples returns a publisher's zmanim for browsing
//
//	@Summary		Get publisher zmanim for examples
//	@Description	Get all visible zmanim from a specific publisher for browsing/copying
//	@Tags			Registry
//	@Produce		json
//	@Param			publisher_id	path		int		true	"Source Publisher ID"
//	@Param			category		query		string	false	"Filter by category"
//	@Param			shita			query		string	false	"Filter by shita"
//	@Param			search			query		string	false	"Search term"
//	@Param			page			query		int		false	"Page number"
//	@Param			limit			query		int		false	"Items per page"
//	@Success		200				{object}	PublisherZmanimResponse
//	@Failure		404				{object}	ErrorResponse
//	@Router			/api/v1/publisher/registry/publishers/{publisher_id}/zmanim [get]
func (h *Handlers) GetPublisherZmanimForExamples(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve current publisher for ownership check
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	currentPublisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid current publisher ID")
		return
	}

	// 2. Get source publisher ID from URL
	sourcePublisherIdStr := chi.URLParam(r, "publisher_id")
	sourcePublisherId, err := strconv.ParseInt(sourcePublisherIdStr, 10, 32)
	if err != nil || sourcePublisherId <= 0 {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Get source publisher info
	publisher, err := h.db.Queries.GetPublisherByIdForExamples(ctx, int32(sourcePublisherId))
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Publisher not found")
			return
		}
		slog.Error("failed to get publisher", "error", err)
		RespondInternalError(w, r, "Failed to get publisher")
		return
	}

	// 3. Parse query params
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	var categoryParam, shitaParam, searchParam *string
	if cat := q.Get("category"); cat != "" {
		categoryParam = &cat
	}
	if shita := q.Get("shita"); shita != "" {
		shitaParam = &shita
	}
	if search := q.Get("search"); search != "" {
		searchParam = &search
	}

	// 4. Fetch zmanim with ownership check
	zmanim, err := h.db.Queries.ListPublisherZmanimForExamples(ctx, db.ListPublisherZmanimForExamplesParams{
		PublisherID:   int32(currentPublisherID), // Current publisher for ownership check
		PublisherID_2: int32(sourcePublisherId),  // Source publisher to browse
		Limit:         int32(limit),
		Offset:        int32(offset),
		Category:      categoryParam,
		Shita:         shitaParam,
		Search:        searchParam,
	})
	if err != nil {
		slog.Error("failed to get publisher zmanim", "error", err, "publisher_id", sourcePublisherId)
		RespondInternalError(w, r, "Failed to get zmanim")
		return
	}

	// Get total count
	total, err := h.db.Queries.CountPublisherZmanimForExamples(ctx, db.CountPublisherZmanimForExamplesParams{
		PublisherID: int32(sourcePublisherId),
		Category:    categoryParam,
		Shita:       shitaParam,
		Search:      searchParam,
	})
	if err != nil {
		slog.Error("failed to count publisher zmanim", "error", err)
		total = int64(len(zmanim))
	}

	// 5. Build response
	result := make([]PublisherZmanForExamples, len(zmanim))
	for i, z := range zmanim {
		result[i] = PublisherZmanForExamples{
			ID:                strconv.Itoa(int(z.ID)),
			ZmanKey:           z.ZmanKey,
			HebrewName:        z.HebrewName,
			EnglishName:       z.EnglishName,
			Description:       z.Description,
			FormulaDsl:        &z.FormulaDsl,
			MasterZmanId:      z.MasterZmanID,
			MasterEnglishName: &z.MasterEnglishName,
			MasterHebrewName:  &z.MasterHebrewName,
			Category:          z.Category,
			Shita:             z.Shita,
			AlreadyHaveMaster: z.AlreadyHaveMaster,
			ExistingIsDeleted: z.ExistingIsDeleted,
		}
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	response := PublisherZmanimResponse{
		Publisher: ValidatedPublisher{
			ID:          strconv.Itoa(int(publisher.ID)),
			Name:        publisher.Name,
			Description: publisher.Description,
		},
		Zmanim:     result,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// CoverageLocality represents a locality in publisher's coverage
type CoverageLocality struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	CountryName *string `json:"country_name,omitempty"`
	Timezone    string  `json:"timezone"`
}

// GetPublisherCoverageLocalities returns localities where a publisher has coverage
//
//	@Summary		Get publisher coverage localities
//	@Description	Get all localities where a specific publisher has coverage
//	@Tags			Registry
//	@Produce		json
//	@Param			publisher_id	path		int	true	"Publisher ID"
//	@Success		200				{object}	[]CoverageLocality
//	@Failure		404				{object}	ErrorResponse
//	@Router			/api/v1/publisher/registry/coverage/{publisher_id} [get]
func (h *Handlers) GetPublisherCoverageLocalities(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	publisherIdStr := chi.URLParam(r, "publisher_id")
	publisherId, err := strconv.ParseInt(publisherIdStr, 10, 32)
	if err != nil || publisherId <= 0 {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	localities, err := h.db.Queries.GetPublisherCoverageLocalities(ctx, int32(publisherId))
	if err != nil {
		slog.Error("failed to get coverage localities", "error", err, "publisher_id", publisherId)
		RespondInternalError(w, r, "Failed to get coverage")
		return
	}

	result := make([]CoverageLocality, len(localities))
	for i, loc := range localities {
		result[i] = CoverageLocality{
			ID:          strconv.Itoa(int(loc.ID)),
			Name:        loc.Name,
			CountryName: loc.CountryName,
			Timezone:    loc.Timezone,
		}
	}

	RespondJSON(w, r, http.StatusOK, result)
}

// LinkCopyRequest is the request body for link/copy operations
type LinkCopyRequest struct {
	PublisherZmanimID int64 `json:"publisher_zmanim_id"`
}

// LinkCopyResponse is the response for link/copy operations
type LinkCopyResponse struct {
	ZmanKey string `json:"zman_key"`
	Message string `json:"message"`
}

// LinkPublisherZman creates a linked zman from another publisher's zman
//
//	@Summary		Link a publisher zman
//	@Description	Create a linked zman from another publisher's implementation
//	@Tags			Registry
//	@Accept			json
//	@Produce		json
//	@Param			body	body		LinkCopyRequest	true	"Source publisher zman ID"
//	@Success		200		{object}	LinkCopyResponse
//	@Failure		400		{object}	ErrorResponse
//	@Failure		404		{object}	ErrorResponse
//	@Router			/api/v1/publisher/registry/link [post]
func (h *Handlers) LinkPublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	currentPublisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid current publisher ID")
		return
	}

	// 2. Parse body
	var req LinkCopyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate
	if req.PublisherZmanimID <= 0 {
		RespondBadRequest(w, r, "publisher_zmanim_id is required")
		return
	}

	// Get source zman
	sourceZman, err := h.db.Queries.GetPublisherZmanForLinkCopy(ctx, int32(req.PublisherZmanimID))
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Source zman not found")
			return
		}
		slog.Error("failed to get source zman", "error", err)
		RespondInternalError(w, r, "Failed to get source zman")
		return
	}

	// Check if current publisher already has this master zman
	if sourceZman.MasterZmanID != nil {
		exists, err := h.db.Queries.CheckPublisherHasMasterZman(ctx, db.CheckPublisherHasMasterZmanParams{
			PublisherID:  int32(currentPublisherID),
			MasterZmanID: sourceZman.MasterZmanID,
		})
		if err != nil {
			slog.Error("failed to check ownership", "error", err)
			RespondInternalError(w, r, "Failed to check ownership")
			return
		}
		if exists {
			RespondBadRequest(w, r, "You already have this master zman")
			return
		}
	}

	// 4. Create linked zman
	newZman, err := h.db.Queries.LinkPublisherZmanFromExample(ctx, db.LinkPublisherZmanFromExampleParams{
		PublisherID:           int32(currentPublisherID),
		MasterZmanID:          sourceZman.MasterZmanID,
		LinkedPublisherZmanID: &sourceZman.ID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		Description:           sourceZman.Description,
		FormulaDsl:            sourceZman.FormulaDsl,
		TimeCategoryID:        sourceZman.TimeCategoryID,
	})
	if err != nil {
		slog.Error("failed to link zman", "error", err)
		RespondInternalError(w, r, "Failed to link zman")
		return
	}

	// 5. Invalidate cache - new linked zman affects calculations
	if h.cache != nil {
		publisherIDStr := fmt.Sprintf("%d", currentPublisherID)
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Warn("failed to invalidate cache after linking zman", "error", err, "publisher_id", publisherIDStr)
		}
	}

	// 6. Respond
	response := LinkCopyResponse{
		ZmanKey: newZman.ZmanKey,
		Message: fmt.Sprintf("Linked to %s's %s", sourceZman.SourcePublisherName, sourceZman.EnglishName),
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// CopyPublisherZman creates an independent copy from another publisher's zman
//
//	@Summary		Copy a publisher zman
//	@Description	Create an independent copy from another publisher's implementation
//	@Tags			Registry
//	@Accept			json
//	@Produce		json
//	@Param			body	body		LinkCopyRequest	true	"Source publisher zman ID"
//	@Success		200		{object}	LinkCopyResponse
//	@Failure		400		{object}	ErrorResponse
//	@Failure		404		{object}	ErrorResponse
//	@Router			/api/v1/publisher/registry/copy [post]
func (h *Handlers) CopyPublisherZman(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Resolve publisher
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}

	currentPublisherID, err := strconv.ParseInt(pc.PublisherID, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid current publisher ID")
		return
	}

	// 2. Parse body
	var req LinkCopyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// 3. Validate
	if req.PublisherZmanimID <= 0 {
		RespondBadRequest(w, r, "publisher_zmanim_id is required")
		return
	}

	// Get source zman
	sourceZman, err := h.db.Queries.GetPublisherZmanForLinkCopy(ctx, int32(req.PublisherZmanimID))
	if err != nil {
		if err == pgx.ErrNoRows {
			RespondNotFound(w, r, "Source zman not found")
			return
		}
		slog.Error("failed to get source zman", "error", err)
		RespondInternalError(w, r, "Failed to get source zman")
		return
	}

	// Check if current publisher already has this master zman
	if sourceZman.MasterZmanID != nil {
		exists, err := h.db.Queries.CheckPublisherHasMasterZman(ctx, db.CheckPublisherHasMasterZmanParams{
			PublisherID:  int32(currentPublisherID),
			MasterZmanID: sourceZman.MasterZmanID,
		})
		if err != nil {
			slog.Error("failed to check ownership", "error", err)
			RespondInternalError(w, r, "Failed to check ownership")
			return
		}
		if exists {
			RespondBadRequest(w, r, "You already have this master zman")
			return
		}
	}

	// 4. Create copied zman
	newZman, err := h.db.Queries.CopyPublisherZmanFromExample(ctx, db.CopyPublisherZmanFromExampleParams{
		PublisherID:           int32(currentPublisherID),
		MasterZmanID:          sourceZman.MasterZmanID,
		CopiedFromPublisherID: &sourceZman.PublisherID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		Description:           sourceZman.Description,
		FormulaDsl:            sourceZman.FormulaDsl,
		TimeCategoryID:        sourceZman.TimeCategoryID,
	})
	if err != nil {
		slog.Error("failed to copy zman", "error", err)
		RespondInternalError(w, r, "Failed to copy zman")
		return
	}

	// 5. Invalidate cache - new copied zman affects calculations
	if h.cache != nil {
		publisherIDStr := fmt.Sprintf("%d", currentPublisherID)
		if err := h.cache.InvalidatePublisherCache(ctx, publisherIDStr); err != nil {
			slog.Warn("failed to invalidate cache after copying zman", "error", err, "publisher_id", publisherIDStr)
		}
	}

	// 6. Respond
	response := LinkCopyResponse{
		ZmanKey: newZman.ZmanKey,
		Message: fmt.Sprintf("Copied %s from %s", sourceZman.EnglishName, sourceZman.SourcePublisherName),
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// ============================================
// PUBLISHER ZMAN DOCUMENTATION (Story 11.4)
// ============================================

// PublisherZmanDocumentation represents the full documentation for a publisher zman
type PublisherZmanDocumentation struct {
	ID                      string  `json:"id"`
	ZmanKey                 string  `json:"zman_key"`
	HebrewName              string  `json:"hebrew_name"`
	EnglishName             string  `json:"english_name"`
	Description             *string `json:"description,omitempty"`
	FormulaDsl              string  `json:"formula_dsl"`
	HalachicNotes           *string `json:"halachic_notes,omitempty"`
	PublisherID             string  `json:"publisher_id"`
	PublisherName           string  `json:"publisher_name"`
	IsVerified              bool    `json:"is_verified"`
	MasterZmanID            *string `json:"master_zman_id,omitempty"`
	MasterHebrewName        *string `json:"master_hebrew_name,omitempty"`
	MasterEnglishName       *string `json:"master_english_name,omitempty"`
	MasterZmanKey           *string `json:"master_zman_key,omitempty"`
	LinkedPublisherName     *string `json:"linked_publisher_name,omitempty"`
	CopiedFromPublisherName *string `json:"copied_from_publisher_name,omitempty"`
	CreatedAt               string  `json:"created_at"`
	UpdatedAt               string  `json:"updated_at"`
}

// PublisherZmanDocumentationResponse is the API response for publisher zman documentation
type PublisherZmanDocumentationResponse struct {
	PublisherZman PublisherZmanDocumentation `json:"publisher_zman"`
	MasterZman    *MasterZmanDocumentation   `json:"master_zman,omitempty"`
	RelatedZmanim []RelatedZmanInfo          `json:"related_zmanim"`
}

// GetPublisherZmanDocumentation returns full documentation for a publisher zman
// including master zman documentation if linked
//
//	@Summary	Get publisher zman documentation
//	@Tags		Registry
//	@Accept		json
//	@Produce	json
//	@Param		id	path		int	true	"Publisher Zman ID"
//	@Success	200	{object}	PublisherZmanDocumentationResponse
//	@Failure	404	{object}	ErrorResponse
//	@Failure	500	{object}	ErrorResponse
//	@Router		/publisher/registry/publisher-zman/{id}/documentation [get]
func (h *Handlers) GetPublisherZmanDocumentation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Parse publisher zman ID from URL
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher zman ID")
		return
	}

	// 2. Fetch publisher zman documentation
	doc, err := h.db.Queries.GetPublisherZmanDocumentation(ctx, int32(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			RespondNotFound(w, r, "Publisher zman not found")
			return
		}
		slog.Error("failed to get publisher zman documentation", "error", err)
		RespondInternalError(w, r, "Failed to load documentation")
		return
	}

	// 3. Build publisher zman response
	publisherZman := PublisherZmanDocumentation{
		ID:                      fmt.Sprintf("%d", doc.ID),
		ZmanKey:                 doc.ZmanKey,
		HebrewName:              doc.HebrewName,
		EnglishName:             doc.EnglishName,
		Description:             doc.Description,
		FormulaDsl:              doc.FormulaDsl,
		HalachicNotes:           doc.HalachicNotes,
		PublisherID:             fmt.Sprintf("%d", doc.PublisherID),
		PublisherName:           doc.PublisherName,
		IsVerified:              doc.PublisherIsVerified,
		LinkedPublisherName:     doc.LinkedPublisherName,
		CopiedFromPublisherName: doc.CopiedFromPublisherName,
		CreatedAt:               doc.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:               doc.UpdatedAt.Time.Format("2006-01-02T15:04:05Z"),
	}

	// Add master zman reference if exists
	if doc.MasterZmanID != nil {
		masterID := fmt.Sprintf("%d", *doc.MasterZmanID)
		publisherZman.MasterZmanID = &masterID
		publisherZman.MasterHebrewName = doc.MasterHebrewName
		publisherZman.MasterEnglishName = doc.MasterEnglishName
		publisherZman.MasterZmanKey = doc.MasterZmanKey
	}

	response := PublisherZmanDocumentationResponse{
		PublisherZman: publisherZman,
		RelatedZmanim: []RelatedZmanInfo{},
	}

	// 4. If there's a master zman, fetch its documentation
	if doc.MasterZmanID != nil {
		masterDoc, err := h.db.Queries.GetMasterZmanDocumentation(ctx, *doc.MasterZmanID)
		if err == nil {
			// Build master zman documentation
			isCore := false
			if masterDoc.IsCore != nil {
				isCore = *masterDoc.IsCore
			}

			masterZman := &MasterZmanDocumentation{
				ID:                   fmt.Sprintf("%d", masterDoc.ID),
				ZmanKey:              masterDoc.ZmanKey,
				CanonicalHebrewName:  masterDoc.CanonicalHebrewName,
				CanonicalEnglishName: masterDoc.CanonicalEnglishName,
				Transliteration:      derefString(masterDoc.Transliteration),
				Description:          derefString(masterDoc.Description),
				DefaultFormulaDsl:    derefString(masterDoc.DefaultFormulaDsl),
				HalachicNotes:        masterDoc.HalachicNotes,
				HalachicSource:       masterDoc.HalachicSource,
				FullDescription:      masterDoc.FullDescription,
				FormulaExplanation:   masterDoc.FormulaExplanation,
				UsageContext:         masterDoc.UsageContext,
				Shita:                masterDoc.Shita,
				Category:             masterDoc.Category,
				IsCore:               isCore,
				TimeCategory:         masterDoc.TimeCategory,
				CreatedAt:            masterDoc.CreatedAt.Time.Format("2006-01-02T15:04:05Z"),
				UpdatedAt:            masterDoc.UpdatedAt.Time.Format("2006-01-02T15:04:05Z"),
			}
			response.MasterZman = masterZman

			// Get related zmanim
			if len(masterDoc.RelatedZmanimIds) > 0 {
				// Convert []int32 to []int64 for the query
				relatedIDs := make([]int64, len(masterDoc.RelatedZmanimIds))
				for i, id := range masterDoc.RelatedZmanimIds {
					relatedIDs[i] = int64(id)
				}
				relatedDetails, err := h.db.Queries.GetRelatedZmanimDetails(ctx, relatedIDs)
				if err == nil {
					for _, rel := range relatedDetails {
						response.RelatedZmanim = append(response.RelatedZmanim, RelatedZmanInfo{
							ID:                   fmt.Sprintf("%d", rel.ID),
							ZmanKey:              rel.ZmanKey,
							CanonicalHebrewName:  rel.CanonicalHebrewName,
							CanonicalEnglishName: rel.CanonicalEnglishName,
							Transliteration:      derefString(rel.Transliteration),
						})
					}
				}
			}
		} else {
			slog.Warn("failed to get master zman documentation for publisher zman", "master_zman_id", *doc.MasterZmanID, "error", err)
		}
	}

	// 5. Respond
	RespondJSON(w, r, http.StatusOK, response)
}
