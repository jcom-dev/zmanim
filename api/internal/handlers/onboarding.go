package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// OnboardingState represents the publisher's onboarding progress (actual schema)
type OnboardingState struct {
	ID                int32  `json:"id,omitempty"`
	PublisherID       string `json:"publisher_id"`
	ProfileComplete   bool   `json:"profile_complete"`
	AlgorithmSelected bool   `json:"algorithm_selected"`
	ZmanimConfigured  bool   `json:"zmanim_configured"`
	CoverageSet       bool   `json:"coverage_set"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

// GetOnboardingState returns the publisher's onboarding state
// GET /api/publisher/onboarding
func (h *Handlers) GetOnboardingState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// Query onboarding state using SQLc
	onboarding, err := h.db.Queries.GetOnboardingState(ctx, publisherIDInt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// No onboarding state - return null (new publisher)
			RespondJSON(w, r, http.StatusOK, nil)
			return
		}
		slog.Error("GetOnboardingState failed to query", "error", err)
		RespondInternalError(w, r, "Failed to get onboarding state")
		return
	}

	// Convert to response format
	state := OnboardingState{
		ID:                onboarding.ID,
		PublisherID:       publisherID,
		ProfileComplete:   onboarding.ProfileComplete != nil && *onboarding.ProfileComplete,
		AlgorithmSelected: onboarding.AlgorithmSelected != nil && *onboarding.AlgorithmSelected,
		ZmanimConfigured:  onboarding.ZmanimConfigured != nil && *onboarding.ZmanimConfigured,
		CoverageSet:       onboarding.CoverageSet != nil && *onboarding.CoverageSet,
		CreatedAt:         onboarding.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:         onboarding.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}

	RespondJSON(w, r, http.StatusOK, state)
}

// SaveOnboardingState saves the publisher's onboarding state
// PUT /api/publisher/onboarding
func (h *Handlers) SaveOnboardingState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slog.Info("SaveOnboardingState starting")

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		slog.Error("SaveOnboardingState failed to resolve publisher")
		return // Response already sent
	}
	publisherID := pc.PublisherID
	slog.Info("SaveOnboardingState resolved publisher", "publisher_id", publisherID)

	var req OnboardingState
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("SaveOnboardingState invalid request body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		slog.Error("SaveOnboardingState invalid publisher ID", "error", err)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// Upsert onboarding state using SQLc
	err = h.db.Queries.UpsertOnboardingComplete(ctx, sqlcgen.UpsertOnboardingCompleteParams{
		PublisherID:       publisherIDInt,
		ProfileComplete:   boolPtr(req.ProfileComplete),
		AlgorithmSelected: boolPtr(req.AlgorithmSelected),
		ZmanimConfigured:  boolPtr(req.ZmanimConfigured),
		CoverageSet:       boolPtr(req.CoverageSet),
	})

	if err != nil {
		slog.Error("SaveOnboardingState failed to save", "error", err)
		RespondInternalError(w, r, "Failed to save onboarding state")
		return
	}

	slog.Info("SaveOnboardingState completed successfully")
	RespondJSON(w, r, http.StatusOK, map[string]string{
		"status": "saved",
	})
}

// WizardZman represents a zman from the onboarding wizard customizations
// Supports both legacy format (key, nameHebrew, nameEnglish) and new registry format (zman_key, hebrew_name, english_name)
type WizardZman struct {
	// Legacy format fields
	Key         string `json:"key"`
	NameHebrew  string `json:"nameHebrew"`
	NameEnglish string `json:"nameEnglish"`

	// New registry format fields
	MasterZmanID string `json:"master_zman_id"`
	ZmanKey      string `json:"zman_key"`
	HebrewName   string `json:"hebrew_name"`
	EnglishName  string `json:"english_name"`
	TimeCategory string `json:"time_category"`

	// Common fields
	Formula  string `json:"formula"`
	Category string `json:"category"`
	Enabled  bool   `json:"enabled"`
	Modified bool   `json:"modified"`
}

// GetKey returns the zman key from either format
func (z WizardZman) GetKey() string {
	if z.ZmanKey != "" {
		return z.ZmanKey
	}
	return z.Key
}

// GetHebrewName returns the hebrew name from either format
func (z WizardZman) GetHebrewName() string {
	if z.HebrewName != "" {
		return z.HebrewName
	}
	return z.NameHebrew
}

// GetEnglishName returns the english name from either format
func (z WizardZman) GetEnglishName() string {
	if z.EnglishName != "" {
		return z.EnglishName
	}
	return z.NameEnglish
}

// GetTimeCategoryKey returns the category key, mapping legacy categories to time_categories
func (z WizardZman) GetTimeCategoryKey() string {
	// Map legacy categories to time_categories keys
	if z.TimeCategory != "" {
		return z.TimeCategory
	}
	if z.Category == "event" {
		return "optional"
	}
	if z.Category == "everyday" {
		return "essential"
	}
	if z.Category != "" {
		return z.Category
	}
	return "essential"
}

// WizardCoverage represents a coverage selection from the onboarding wizard
type WizardCoverage struct {
	Type string `json:"type"` // "city", "region", "country", or "continent"
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CompleteOnboardingRequest represents the request body for completing onboarding
type CompleteOnboardingRequest struct {
	Customizations []WizardZman     `json:"customizations"`
	Coverage       []WizardCoverage `json:"coverage"`
}

// CompleteOnboarding marks onboarding as complete and imports zmanim from wizard customizations
// POST /api/publisher/onboarding/complete
func (h *Handlers) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slog.Info("CompleteOnboarding starting")

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		slog.Error("CompleteOnboarding failed to resolve publisher")
		return // Response already sent
	}
	publisherID := pc.PublisherID
	slog.Info("CompleteOnboarding resolved publisher", "publisher_id", publisherID)

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		slog.Error("CompleteOnboarding invalid publisher ID", "error", err)
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// Parse request body
	var req CompleteOnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("CompleteOnboarding invalid request body", "error", err)
		RespondBadRequest(w, r, "Invalid request body")
		return
	}
	slog.Info("CompleteOnboarding parsed data", "customizations", len(req.Customizations), "coverage_items", len(req.Coverage))

	// Import zmanim from wizard customizations (only enabled ones)
	if len(req.Customizations) > 0 {
		// Filter to only include enabled zmanim
		enabledZmanim := make([]WizardZman, 0)
		for _, zman := range req.Customizations {
			if zman.Enabled {
				enabledZmanim = append(enabledZmanim, zman)
			}
		}
		slog.Info("CompleteOnboarding importing zmanim", "enabled", len(enabledZmanim), "total", len(req.Customizations))

		for i, zman := range enabledZmanim {
			zmanKey := zman.GetKey()
			hebrewName := zman.GetHebrewName()
			englishName := zman.GetEnglishName()
			timeCategoryKey := zman.GetTimeCategoryKey()

			slog.Debug("CompleteOnboarding inserting zman", "index", i+1, "key", zmanKey, "hebrew", hebrewName, "english", englishName)

			// Get time_category_id from key
			var timeCategoryID *int32
			if timeCategoryKey != "" {
				timeCategory, err := h.db.Queries.GetTimeCategoryByKey(ctx, timeCategoryKey)
				if err != nil {
					slog.Warn("CompleteOnboarding time category not found", "key", timeCategoryKey, "error", err)
					// Continue with nil category
				} else {
					timeCategoryID = &timeCategory.ID
				}
			}

			// Check if this is a registry-based zman (has master_zman_id)
			if zman.MasterZmanID != "" {
				masterZmanIDInt, err := stringToInt32(zman.MasterZmanID)
				if err != nil {
					slog.Error("CompleteOnboarding invalid master_zman_id", "master_zman_id", zman.MasterZmanID, "error", err)
					RespondInternalError(w, r, "Invalid master_zman_id: "+zman.MasterZmanID)
					return
				}
				// Use the registry-based insert that links to master_zman_id
				err = h.db.Queries.UpsertPublisherZmanWithMaster(ctx, sqlcgen.UpsertPublisherZmanWithMasterParams{
					PublisherID:    publisherIDInt,
					ZmanKey:        zmanKey,
					HebrewName:     hebrewName,
					EnglishName:    englishName,
					FormulaDsl:     zman.Formula,
					TimeCategoryID: timeCategoryID,
					MasterZmanID:   &masterZmanIDInt,
				})
				if err != nil {
					slog.Error("CompleteOnboarding failed to insert zman with master", "zman_key", zmanKey, "error", err)
					RespondInternalError(w, r, "Failed to import zmanim: "+err.Error())
					return
				}
			} else {
				// Legacy insert without master_zman_id
				err = h.db.Queries.UpsertPublisherZmanLegacy(ctx, sqlcgen.UpsertPublisherZmanLegacyParams{
					PublisherID:    publisherIDInt,
					ZmanKey:        zmanKey,
					HebrewName:     hebrewName,
					EnglishName:    englishName,
					FormulaDsl:     zman.Formula,
					TimeCategoryID: timeCategoryID,
				})
				if err != nil {
					slog.Error("CompleteOnboarding failed to insert zman legacy", "zman_key", zmanKey, "error", err)
					RespondInternalError(w, r, "Failed to import zmanim: "+err.Error())
					return
				}
			}
		}
		slog.Info("CompleteOnboarding successfully imported zmanim", "count", len(enabledZmanim))

		// Mark zmanim as configured
		err = h.db.Queries.MarkZmanimConfigured(ctx, publisherIDInt)
		if err != nil {
			slog.Error("CompleteOnboarding failed to mark zmanim configured", "error", err)
		}
	}

	// Import coverage from wizard selections
	if len(req.Coverage) > 0 {
		slog.Info("CompleteOnboarding importing coverage", "count", len(req.Coverage))

		for i, cov := range req.Coverage {
			slog.Debug("CompleteOnboarding processing coverage", "index", i+1, "type", cov.Type, "id", cov.ID, "name", cov.Name)

			switch cov.Type {
			case "continent":
				// For continent coverage, the ID is the continent code (e.g., "EU", "NA")
				continent, err := h.db.Queries.GetContinentByCode(ctx, cov.ID)
				if err != nil {
					slog.Error("CompleteOnboarding failed to find continent", "code", cov.ID, "error", err)
					continue
				}
				_, err = h.db.Queries.CreateCoverageContinent(ctx, sqlcgen.CreateCoverageContinentParams{
					PublisherID: publisherIDInt,
					ContinentID: &continent.ID,
					Priority:    int32Ptr(100),
					IsActive:    true,
				})
				if err != nil {
					// Check if it's a duplicate
					if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
						slog.Debug("CompleteOnboarding continent coverage already exists", "id", cov.ID)
					} else {
						slog.Error("CompleteOnboarding failed to insert continent coverage", "id", cov.ID, "error", err)
					}
				}

			case "country":
				// For country coverage, the ID could be code or numeric ID
				country, err := h.db.Queries.GetCountryByCodeOrID(ctx, cov.ID)
				if err != nil {
					slog.Error("CompleteOnboarding failed to find country", "id", cov.ID, "error", err)
					continue
				}
				_, err = h.db.Queries.CreateCoverageCountry(ctx, sqlcgen.CreateCoverageCountryParams{
					PublisherID: publisherIDInt,
					CountryID:   &country.ID,
					Priority:    int32Ptr(100),
					IsActive:    true,
				})
				if err != nil {
					if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
						slog.Debug("CompleteOnboarding country coverage already exists", "id", cov.ID)
					} else {
						slog.Error("CompleteOnboarding failed to insert country coverage", "id", cov.ID, "error", err)
					}
				}

			case "region":
				// For region coverage, the ID should be the region_id (integer)
				regionID, err := stringToInt32(cov.ID)
				if err != nil {
					slog.Error("CompleteOnboarding invalid region ID", "id", cov.ID, "error", err)
					continue
				}
				region, err := h.db.Queries.GetRegionByID(ctx, regionID)
				if err != nil {
					slog.Error("CompleteOnboarding failed to find region", "id", cov.ID, "error", err)
					continue
				}
				_, err = h.db.Queries.CreateCoverageRegion(ctx, sqlcgen.CreateCoverageRegionParams{
					PublisherID: publisherIDInt,
					RegionID:    &region.ID,
					Priority:    int32Ptr(100),
					IsActive:    true,
				})
				if err != nil {
					if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
						slog.Debug("CompleteOnboarding region coverage already exists", "id", cov.ID)
					} else {
						slog.Error("CompleteOnboarding failed to insert region coverage", "id", cov.ID, "error", err)
					}
				}

			case "city":
				// For city coverage, the ID could be an integer or a quick-select ID
				var cityID int32
				if isQuickSelectID(cov.ID) {
					// Look up city by name from quick select
					cityName := extractCityNameFromQuickID(cov.ID)
					city, err := h.db.Queries.GetCityByName(ctx, cityName)
					if err != nil {
						slog.Warn("CompleteOnboarding could not find city for quick select", "id", cov.ID, "error", err)
						continue
					}
					cityID = city.ID
				} else {
					// Regular city ID (integer string)
					var err error
					cityID, err = stringToInt32(cov.ID)
					if err != nil {
						slog.Error("CompleteOnboarding invalid city ID", "id", cov.ID, "error", err)
						continue
					}
					// Verify city exists
					_, err = h.db.Queries.GetCityByID(ctx, cityID)
					if err != nil {
						slog.Error("CompleteOnboarding could not find city", "id", cov.ID, "error", err)
						continue
					}
				}
				_, err = h.db.Queries.CreateCoverageCity(ctx, sqlcgen.CreateCoverageCityParams{
					PublisherID: publisherIDInt,
					CityID:      &cityID,
					Priority:    int32Ptr(100),
					IsActive:    true,
				})
				if err != nil {
					if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
						slog.Debug("CompleteOnboarding city coverage already exists", "city_id", cityID)
					} else {
						slog.Error("CompleteOnboarding failed to insert city coverage", "city_id", cityID, "error", err)
					}
				}
			}
		}
		slog.Info("CompleteOnboarding finished importing coverage")

		// Mark coverage as set
		err = h.db.Queries.MarkCoverageSet(ctx, publisherIDInt)
		if err != nil {
			slog.Error("CompleteOnboarding failed to mark coverage set", "error", err)
		}
	}

	// Mark onboarding as complete
	err = h.db.Queries.UpsertOnboardingComplete(ctx, sqlcgen.UpsertOnboardingCompleteParams{
		PublisherID:       publisherIDInt,
		ProfileComplete:   boolPtr(true),
		AlgorithmSelected: boolPtr(true),
		ZmanimConfigured:  boolPtr(true),
		CoverageSet:       boolPtr(true),
	})
	if err != nil {
		slog.Error("CompleteOnboarding failed to mark as complete", "error", err)
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"status":  "completed",
		"message": "Onboarding completed successfully",
	})
}

// isQuickSelectID checks if the ID is a quick-select format (quick-cityname-countrycode)
func isQuickSelectID(id string) bool {
	return len(id) > 6 && id[:6] == "quick-"
}

// extractCityNameFromQuickID extracts the city name from a quick-select ID
// e.g., "quick-jerusalem-IL" -> "jerusalem", "quick-new-york-US" -> "new york"
func extractCityNameFromQuickID(id string) string {
	if len(id) <= 6 {
		return ""
	}
	// Remove "quick-" prefix
	rest := id[6:]
	// Remove the last part (country code) by finding the last dash
	lastDash := -1
	for i := len(rest) - 1; i >= 0; i-- {
		if rest[i] == '-' {
			lastDash = i
			break
		}
	}
	if lastDash == -1 {
		return rest
	}
	// Replace remaining dashes with spaces for city names like "new-york"
	cityName := rest[:lastDash]
	result := ""
	for _, c := range cityName {
		if c == '-' {
			result += " "
		} else {
			result += string(c)
		}
	}
	return result
}

// SkipOnboarding allows a publisher to skip the wizard
// POST /api/publisher/onboarding/skip
func (h *Handlers) SkipOnboarding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// Mark onboarding as complete (all flags true = skipped)
	err = h.db.Queries.UpsertOnboardingComplete(ctx, sqlcgen.UpsertOnboardingCompleteParams{
		PublisherID:       publisherIDInt,
		ProfileComplete:   boolPtr(true),
		AlgorithmSelected: boolPtr(true),
		ZmanimConfigured:  boolPtr(true),
		CoverageSet:       boolPtr(true),
	})

	if err != nil {
		RespondInternalError(w, r, "Failed to skip onboarding")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"status": "skipped",
	})
}

// ResetOnboarding deletes the onboarding state to allow restarting the wizard
// DELETE /api/publisher/onboarding
func (h *Handlers) ResetOnboarding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Use PublisherResolver to get publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Convert publisher ID to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondInternalError(w, r, "Invalid publisher ID")
		return
	}

	// Delete ALL zmanim for this publisher (wizard will re-import)
	err = h.db.Queries.DeleteAllPublisherZmanim(ctx, publisherIDInt)
	if err != nil {
		slog.Error("ResetOnboarding failed to delete zmanim", "error", err)
		RespondInternalError(w, r, "Failed to reset onboarding")
		return
	}

	// Delete coverage for this publisher (wizard will re-import)
	err = h.db.Queries.DeleteAllPublisherCoverage(ctx, publisherIDInt)
	if err != nil {
		slog.Error("ResetOnboarding failed to delete coverage", "error", err)
		// Continue anyway, coverage deletion is not critical
	}

	// Delete onboarding state
	err = h.db.Queries.DeleteOnboardingState(ctx, publisherIDInt)
	if err != nil {
		RespondInternalError(w, r, "Failed to reset onboarding")
		return
	}

	RespondJSON(w, r, http.StatusOK, map[string]string{
		"status": "reset",
	})
}
