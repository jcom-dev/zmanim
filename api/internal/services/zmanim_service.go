// Package services provides the core business logic layer for the zmanim application.
// Services encapsulate domain operations and coordinate between handlers, database,
// and external systems like Clerk authentication and Redis caching.
//
// File: zmanim_service.go
// Purpose: THE single source of truth for ALL zmanim operations
// Pattern: unified-service
// Dependencies: dsl, cache, db/sqlcgen
// Frequency: critical - every zmanim endpoint uses this
//
// This file consolidates:
//   - Calculation: DSL formula execution with caching and rounding
//   - Ordering: Category-based chronological sorting of zmanim
//   - Linking: Copy/link zmanim between publishers with provenance tracking
//   - Filtering: Tag-based event filtering for calendar-aware zmanim display
//
// # Architecture
//
// ZmanimService is the single entry point for all zmanim calculations.
// It replaces the legacy fragmented approach with a consolidated service that:
//   - Handles all locality coordinate resolution (with publisher overrides)
//   - Manages Redis caching with intelligent key generation
//   - Executes DSL formulas in dependency order
//   - Applies publisher-specific rounding modes
//
// # Usage
//
// Create the service at application startup:
//
//	svc, err := services.NewZmanimService(ctx, db, cache)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
// Calculate zmanim for a publisher:
//
//	result, err := svc.CalculateZmanim(ctx, services.CalculateParams{
//	    PublisherID: 2,
//	    LocalityID:  4993250,
//	    Date:        time.Now(),
//	})

package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/algorithm"
	"github.com/jcom-dev/zmanim/internal/cache"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/dsl"
	"github.com/jcom-dev/zmanim/internal/models"
)

// ===========================================================================
// SECTION 1: TYPES & STRUCTS
// ===========================================================================

// ZmanimService consolidates ALL zmanim operations
// This is THE SINGLE SOURCE OF TRUTH for:
// - Calculation (DSL execution)
// - Ordering (category-based sorting)
// - Linking (copy/link between publishers)
// - Filtering (tag-based event filtering)
// - Caching (per-publisher, per-locality)
type ZmanimService struct {
	db            *db.DB
	cache         *cache.Cache
	categoryOrder map[string]int      // Populated from time_categories.sort_order
	behaviorTags  map[string][]string // Behavior tag -> required event codes
}

// CalculateParams defines parameters for publisher zmanim calculation
type CalculateParams struct {
	LocalityID         int64
	PublisherID        int32
	Date               time.Time
	IncludeDisabled    bool
	IncludeUnpublished bool
	IncludeBeta        bool
	IncludeInactive    bool     // If true, disable show_in_preview filtering (Algorithm Editor mode)
	// Active event codes for tag-driven filtering and is_active_today computation
	// ALWAYS provide actual event codes (even with IncludeInactive=true) for is_active_today computation
	ActiveEventCodes []string
	// Optional: Pre-loaded data to avoid duplicate queries (performance optimization)
	PreloadedLocation      *sqlcgen.GetEffectiveLocalityLocationRow
	PreloadedPublisherZman []sqlcgen.GetPublisherZmanimRow
}

// FormulaParams defines parameters for single formula calculation (preview mode)
type FormulaParams struct {
	Formula    string
	Date       time.Time
	Latitude   float64
	Longitude  float64
	Elevation  float64
	Timezone   *time.Location
	References map[string]string // Other formulas for @ references
}

// ActiveEventCodesProvider is a callback function that returns ActiveEventCodes for a given date.
// This allows CalculateRange to get calendar context for each day without importing calendar package.
type ActiveEventCodesProvider func(date time.Time) []string

// RangeParams defines parameters for date range calculations
type RangeParams struct {
	LocalityID  int64
	PublisherID int32
	StartDate   time.Time
	EndDate     time.Time
	ZmanKey     *string // Optional - if set, filter results to only this zman
	// Filter options
	IncludeDisabled    bool
	IncludeUnpublished bool
	IncludeBeta        bool
	// ActiveEventCodesProvider returns ActiveEventCodes for each day (for is_active_today calculation)
	// If nil, all event zmanim will have is_active_today=true (no filtering)
	ActiveEventCodesProvider ActiveEventCodesProvider
}

// CalculationResult represents the result of a zmanim calculation
type CalculationResult struct {
	Date      string           `json:"date"`
	Zmanim    []CalculatedZman `json:"zmanim"`
	FromCache bool             `json:"from_cache"`
	CachedAt  *time.Time       `json:"-"` // Not serialized, set from cache metadata
}

// CalculatedZman represents a single calculated zman
type CalculatedZman struct {
	ID            int64     `json:"id"`
	Key           string    `json:"zman_key"`
	Time          time.Time `json:"-"` // Not serialized (use TimeExact/TimeRounded for JSON)
	TimeExact     string    `json:"time"`          // HH:MM:SS with actual seconds
	TimeRounded   string    `json:"time_rounded"`  // HH:MM rounded (no seconds)
	Timestamp     int64     `json:"timestamp"`
	RoundingMode  string    `json:"rounding_mode"`
	IsActiveToday bool      `json:"is_active_today"` // Whether this zman is active for the current day's events
}

// FormulaResult represents the result of a single formula calculation
type FormulaResult struct {
	Time        time.Time
	TimeExact   string // HH:MM:SS with actual seconds
	TimeRounded string // HH:MM rounded (no seconds)
	FromCache   bool
	Breakdown   []dsl.CalculationStep // optional
}

// DayResult represents zmanim for a single day (used in range calculations)
type DayResult struct {
	Date   string
	Zmanim []CalculatedZman
}

// SortableZman interface for any zman type that can be sorted
// Implementing types only need to provide these three methods
type SortableZman interface {
	GetTimeCategory() string
	GetCalculatedTime() *string // HH:MM:SS format (nil if not calculated)
	GetHebrewName() string
}

// LinkOrCopyZmanRequest contains parameters for linking or copying a zman
type LinkOrCopyZmanRequest struct {
	TargetPublisherID int32
	SourceZmanID      int32
	Mode              string // "copy" or "link"
	UserID            string // Clerk user ID (for provenance)
	RequestID         string // Request ID as string (for provenance)
}

// LinkOrCopyZmanResult contains the created zman details
type LinkOrCopyZmanResult struct {
	ID                    int32
	ZmanKey               string
	HebrewName            string
	EnglishName           string
	FormulaDSL            string
	Dependencies          []string
	MasterZmanID          *int32
	LinkedPublisherZmanID *int32
	CreatedAt             pgtype.Timestamptz
	UpdatedAt             pgtype.Timestamptz
	IsLinked              bool
	SourceIsVerified      bool
}

// Linking errors
var (
	// ErrSourceNotFound indicates the source zman does not exist
	ErrSourceNotFound = errors.New("source zman not found")

	// ErrPublisherNotVerified indicates source publisher is not verified (required for linking)
	ErrPublisherNotVerified = errors.New("source publisher not verified - can only link from verified publishers")

	// ErrZmanKeyExists indicates the zman key already exists for this publisher
	ErrZmanKeyExists = errors.New("zman key already exists for this publisher")

	// ErrInvalidMode indicates the mode is not 'copy' or 'link'
	ErrInvalidMode = errors.New("mode must be 'copy' or 'link'")
)

// ===========================================================================
// SECTION 2: CONSTRUCTOR & INITIALIZATION
// ===========================================================================

// NewZmanimService creates the unified service and loads configuration from database
func NewZmanimService(ctx context.Context, database *db.DB, c *cache.Cache) (*ZmanimService, error) {
	s := &ZmanimService{
		db:            database,
		cache:         c,
		categoryOrder: make(map[string]int),
		behaviorTags:  make(map[string][]string),
	}

	// Load category order from time_categories table
	categories, err := database.Queries.GetAllTimeCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load time categories: %w", err)
	}

	for _, cat := range categories {
		s.categoryOrder[cat.Key] = int(cat.SortOrder)
	}
	s.categoryOrder["uncategorized"] = 99

	// Initialize behavior tags map (legacy - kept for reference but not actively used)
	// NOTE: Category filtering is now handled entirely by the tag system:
	// - Category tags (category_candle_lighting, etc.) are stored in zman_tags table
	// - Calendar service provides active event codes via ZmanimContext
	// - Handler functions (shouldShowZman) match category tags against calendar context flags
	// This map documents the conceptual relationship but is not used in filtering logic
	s.behaviorTags = make(map[string][]string)

	return s, nil
}

// ===========================================================================
// SECTION 3: CALCULATION METHODS
// ===========================================================================

// CalculateZmanim is the main entry point for publisher zmanim calculation
// This method handles caching, locality lookup, coordinate resolution, and formula execution
func (s *ZmanimService) CalculateZmanim(ctx context.Context, params CalculateParams) (*CalculationResult, error) {
	// Format date for caching
	dateStr := params.Date.Format("2006-01-02")

	// Build cache key (includes filter parameters)
	cacheKey := s.buildCacheKey(params.PublisherID, params.LocalityID, dateStr, params.IncludeDisabled, params.IncludeUnpublished, params.IncludeBeta)

	// Check cache first (if available)
	if s.cache != nil {
		cached, err := s.getCachedResult(ctx, cacheKey)
		if err != nil {
			slog.Error("cache read error", "error", err, "key", cacheKey)
		} else if cached != nil {
			return cached, nil
		}
	}

	// Use preloaded location if provided, otherwise query database
	var location sqlcgen.GetEffectiveLocalityLocationRow
	if params.PreloadedLocation != nil {
		location = *params.PreloadedLocation
	} else {
		// Get effective locality location with hierarchical override resolution
		// Priority: publisher override > admin override > default (overture/glo90)
		localityID32 := int32(params.LocalityID)
		loc, err := s.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
			LocalityID:  localityID32,
			PublisherID: pgtype.Int4{Int32: params.PublisherID, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("locality not found: %w", err)
		}
		location = loc
	}

	// Load timezone from locality
	tz, err := time.LoadLocation(location.Timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q for locality: %w", location.Timezone, err)
	}

	// Coordinates already resolved with correct priority
	latitude := location.Latitude
	longitude := location.Longitude
	elevation := float64(location.ElevationM)

	// Use preloaded publisher zmanim if provided, otherwise query database
	var publisherZmanim []sqlcgen.GetPublisherZmanimRow
	if params.PreloadedPublisherZman != nil {
		publisherZmanim = params.PreloadedPublisherZman
	} else {
		// Load publisher's configured zmanim
		pz, err := s.db.Queries.GetPublisherZmanim(ctx, params.PublisherID)
		if err != nil {
			return nil, fmt.Errorf("failed to load publisher zmanim: %w", err)
		}
		publisherZmanim = pz
	}

	if len(publisherZmanim) == 0 {
		return nil, fmt.Errorf("publisher has no configured zmanim")
	}

	// Build formulas map (apply filters)
	formulas := make(map[string]string)
	zmanConfigMap := make(map[string]struct {
		ID           int32
		RoundingMode string
		Tags         []EventFilterTag
	})

	for _, pz := range publisherZmanim {
		// Apply publication status filters
		if !params.IncludeDisabled && !pz.IsEnabled {
			continue
		}
		if !params.IncludeUnpublished && !pz.IsPublished {
			continue
		}
		if !params.IncludeBeta && pz.IsBeta {
			continue
		}

		// Convert SQLc tags (interface{}) to EventFilterTag for this zman
		var tags []EventFilterTag
		if pz.Tags != nil {
			tagsBytes, err := json.Marshal(pz.Tags)
			if err != nil {
				slog.Error("failed to marshal tags", "zman_key", pz.ZmanKey, "error", err)
			} else {
				if err := json.Unmarshal(tagsBytes, &tags); err != nil {
					slog.Error("failed to unmarshal tags", "zman_key", pz.ZmanKey, "error", err)
				}
			}
		}

		// Apply calendar context filtering (event zmanim)
		// Only filter if ALL conditions met:
		// 1. NOT in Algorithm Editor mode (IncludeInactive = false)
		// 2. Zman requires event filtering (show_in_preview = false)
		if !params.IncludeInactive && !pz.ShowInPreview {
			slog.Info("preview mode: checking event filtering for event-based zman",
				"zman_key", pz.ZmanKey,
				"show_in_preview", pz.ShowInPreview,
				"active_event_codes", params.ActiveEventCodes)

			// Check if this zman should be shown based on calendar context
			shouldShow := s.ShouldShowZman(tags, params.ActiveEventCodes)
			slog.Info("event filtering decision",
				"zman_key", pz.ZmanKey,
				"should_show", shouldShow,
				"active_events", params.ActiveEventCodes,
				"tag_count", len(tags))
			if !shouldShow {
				slog.Info("filtering out event-based zman", "zman_key", pz.ZmanKey, "active_events", params.ActiveEventCodes)
				continue
			}
		} else if !params.IncludeInactive {
			slog.Debug("preview mode: skipping filter (show_in_preview=true)",
				"zman_key", pz.ZmanKey,
				"show_in_preview", pz.ShowInPreview)
		}

		// Skip if no formula
		if pz.FormulaDsl == "" {
			slog.Warn("publisher zman has no formula", "zman_key", pz.ZmanKey, "publisher_id", params.PublisherID)
			continue
		}

		formulas[pz.ZmanKey] = pz.FormulaDsl
		zmanConfigMap[pz.ZmanKey] = struct {
			ID           int32
			RoundingMode string
			Tags         []EventFilterTag
		}{
			ID:           pz.ID,
			RoundingMode: pz.RoundingMode,
			Tags:         tags,
		}
	}

	if len(formulas) == 0 {
		return nil, fmt.Errorf("no zmanim match the specified filters")
	}

	// Create DSL execution context
	dslCtx := dsl.NewExecutionContext(params.Date, latitude, longitude, elevation, tz)

	// Execute all formulas using DSL executor
	calculatedTimes, err := dsl.ExecuteFormulaSet(formulas, dslCtx)
	if err != nil {
		return nil, fmt.Errorf("DSL execution failed: %w", err)
	}

	// Build result
	result := &CalculationResult{
		Date:      dateStr,
		Zmanim:    make([]CalculatedZman, 0, len(calculatedTimes)),
		FromCache: false,
	}

	for zmanKey, calculatedTime := range calculatedTimes {
		config := zmanConfigMap[zmanKey]

		// Default rounding mode to "math" if not set
		roundingMode := config.RoundingMode
		if roundingMode == "" {
			roundingMode = "math"
		}

		// Apply rounding to get both exact and display times
		exactTime, displayTime := ApplyRounding(calculatedTime, roundingMode)

		// Compute is_active_today based on tags and active event codes
		// When includeInactive=true (ActiveEventCodes=nil), ALL zmanim pass filtering above,
		// but we still need to compute IsActiveToday for frontend preview filtering
		isActiveToday := true
		if params.ActiveEventCodes != nil {
			isActiveToday = s.ShouldShowZman(config.Tags, params.ActiveEventCodes)
		}

		result.Zmanim = append(result.Zmanim, CalculatedZman{
			ID:            int64(config.ID),
			Key:           zmanKey,
			Time:          calculatedTime,
			TimeExact:     exactTime,    // HH:MM:SS with actual seconds
			TimeRounded:   displayTime,  // HH:MM rounded
			Timestamp:     calculatedTime.Unix(),
			RoundingMode:  roundingMode,
			IsActiveToday: isActiveToday,
		})
	}

	// Cache the result (permanent - we'll invalidate explicitly)
	if s.cache != nil {
		if err := s.setCachedResult(ctx, cacheKey, result); err != nil {
			slog.Error("cache write error", "error", err, "key", cacheKey)
		}
	}

	return result, nil
}

// CalculateFormula calculates a single DSL formula (for preview mode)
func (s *ZmanimService) CalculateFormula(ctx context.Context, params FormulaParams) (*FormulaResult, error) {
	// Create DSL execution context
	dslCtx := dsl.NewExecutionContext(params.Date, params.Latitude, params.Longitude, params.Elevation, params.Timezone)

	// Pre-populate references if provided
	for key, formula := range params.References {
		// Parse and execute reference formula
		refTime, err := dsl.ExecuteFormula(formula, dslCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to execute reference @%s: %w", key, err)
		}
		dslCtx.ZmanimCache[key] = refTime
	}

	// Execute the formula with breakdown
	calculatedTime, breakdown, err := dsl.ExecuteFormulaWithBreakdown(params.Formula, dslCtx)
	if err != nil {
		return nil, fmt.Errorf("formula execution failed: %w", err)
	}

	// Apply default rounding (math)
	exactTime, displayTime := ApplyRounding(calculatedTime, "math")

	return &FormulaResult{
		Time:        calculatedTime,
		TimeExact:   exactTime,
		TimeRounded: displayTime,
		FromCache:   false,
		Breakdown:   breakdown,
	}, nil
}

// CalculateRange calculates zmanim for a date range (batch calculation)
func (s *ZmanimService) CalculateRange(ctx context.Context, params RangeParams) ([]DayResult, error) {
	// Validate date range
	if params.EndDate.Before(params.StartDate) {
		return nil, fmt.Errorf("end date must be after start date")
	}

	// Calculate number of days
	days := int(params.EndDate.Sub(params.StartDate).Hours()/24) + 1
	if days > 366 {
		return nil, fmt.Errorf("date range too large (max 366 days)")
	}

	results := make([]DayResult, 0, days)

	// Calculate for each day
	currentDate := params.StartDate
	for currentDate.Before(params.EndDate) || currentDate.Equal(params.EndDate) {
		// Get active event codes for this day if provider is available
		var activeEventCodes []string
		if params.ActiveEventCodesProvider != nil {
			activeEventCodes = params.ActiveEventCodesProvider(currentDate)
		}

		// Calculate zmanim for this day
		calcParams := CalculateParams{
			LocalityID:         params.LocalityID,
			PublisherID:        params.PublisherID,
			Date:               currentDate,
			IncludeDisabled:    params.IncludeDisabled,
			IncludeUnpublished: params.IncludeUnpublished,
			IncludeBeta:        params.IncludeBeta,
			ActiveEventCodes:   activeEventCodes,
		}

		dayResult, err := s.CalculateZmanim(ctx, calcParams)
		if err != nil {
			slog.Error("failed to calculate zmanim for day",
				"date", currentDate.Format("2006-01-02"),
				"error", err)
			// Continue with next day instead of failing entire range
			currentDate = currentDate.AddDate(0, 0, 1)
			continue
		}

		// If a specific zman is requested, filter to only that one
		zmanim := dayResult.Zmanim
		if params.ZmanKey != nil {
			filteredZmanim := make([]CalculatedZman, 0, 1)
			for _, z := range dayResult.Zmanim {
				if z.Key == *params.ZmanKey {
					filteredZmanim = append(filteredZmanim, z)
					break
				}
			}
			zmanim = filteredZmanim
		}

		results = append(results, DayResult{
			Date:   dayResult.Date,
			Zmanim: zmanim,
		})

		currentDate = currentDate.AddDate(0, 0, 1)
	}

	return results, nil
}

// ExecuteFormulasWithCoordinates executes a set of formulas using raw coordinates
// This is used for calculations that don't involve a specific locality (e.g., exports, previews)
// Returns a map of zman_key -> calculated time
func (s *ZmanimService) ExecuteFormulasWithCoordinates(
	date time.Time,
	latitude, longitude, elevation float64,
	timezone *time.Location,
	formulas map[string]string,
) (map[string]time.Time, error) {
	// Create DSL execution context
	dslCtx := dsl.NewExecutionContext(date, latitude, longitude, elevation, timezone)

	// Execute all formulas in dependency order
	calculatedTimes, err := dsl.ExecuteFormulaSet(formulas, dslCtx)
	if err != nil {
		return nil, fmt.Errorf("DSL execution failed: %w", err)
	}

	return calculatedTimes, nil
}

// ===========================================================================
// SECTION 4: ORDERING METHODS
// ===========================================================================

// GetCategoryOrder returns sort order for a category key
func (s *ZmanimService) GetCategoryOrder(category string) int {
	if order, ok := s.categoryOrder[category]; ok {
		return order
	}
	return 99 // uncategorized goes last
}

// SortZmanim sorts any slice of zmanim following the Jewish day structure.
//
// Sort order (3-level priority):
//  1. Category order (from time_categories.sort_order: dawn→sunrise→morning→midday→afternoon→sunset→nightfall→midnight)
//  2. Calculated time (chronological within category)
//  3. Hebrew name (alphabetical tiebreaker)
//
// The sortByCategory parameter is kept for API compatibility but category-based
// sorting is always applied since it correctly handles the Jewish day structure
// (sunset to sunset) where times after midnight belong at the end of the day.
func (s *ZmanimService) SortZmanim(zmanim []SortableZman, sortByCategory bool) {
	sort.SliceStable(zmanim, func(i, j int) bool {
		// 1. Category order - always applied to handle Jewish day correctly
		catI := s.GetCategoryOrder(zmanim[i].GetTimeCategory())
		catJ := s.GetCategoryOrder(zmanim[j].GetTimeCategory())
		if catI != catJ {
			return catI < catJ
		}

		// 2. Calculated time (chronological within same category)
		timeI := zmanim[i].GetCalculatedTime()
		timeJ := zmanim[j].GetCalculatedTime()

		if timeI != nil && timeJ != nil {
			// String comparison works for HH:MM:SS within the same category
			if *timeI != *timeJ {
				return *timeI < *timeJ
			}
		} else if timeI != nil {
			return true // i has time, j doesn't - i goes first
		} else if timeJ != nil {
			return false // j has time, i doesn't - j goes first
		}

		// 3. Hebrew name (consistent tiebreaker)
		return zmanim[i].GetHebrewName() < zmanim[j].GetHebrewName()
	})
}

// ===========================================================================
// SECTION 5: LINKING METHODS
// ===========================================================================

// LinkOrCopyZman creates a zman by copying or linking from another publisher
//
// This method encapsulates the multi-concept workflow:
// 1. Record action (provenance tracking)
// 2. Verify source zman exists (Zman concept)
// 3. Verify source publisher status (Publisher concept)
// 4. Check for duplicate zman_key (Zman concept)
// 5. Create linked or copied zman (Zman concept)
// 6. Complete action with result
//
// Transaction boundaries are explicit - this operation uses a transaction to ensure atomicity.
func (s *ZmanimService) LinkOrCopyZman(ctx context.Context, req LinkOrCopyZmanRequest) (*LinkOrCopyZmanResult, error) {
	// Validate mode
	if req.Mode != "copy" && req.Mode != "link" {
		return nil, ErrInvalidMode
	}

	// BEGIN TRANSACTION
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Always rollback (no-op if committed)
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Create queries with transaction
	qtx := s.db.Queries.WithTx(tx)

	// STEP 0: Record action (provenance tracking)
	actionType := "copy_zman"
	if req.Mode == "link" {
		actionType = "link_zman"
	}

	payloadJSON, _ := json.Marshal(map[string]interface{}{
		"source_zman_id":      req.SourceZmanID,
		"target_publisher_id": req.TargetPublisherID,
		"mode":                req.Mode,
	})

	// Convert to pointer types for SQLc
	var userIDPtr *string
	if req.UserID != "" {
		userIDPtr = &req.UserID
	}
	publisherIDPtr := &req.TargetPublisherID
	entityType := "publisher_zman"

	actionID, err := qtx.RecordAction(ctx, sqlcgen.RecordActionParams{
		ActionType:     actionType,
		Concept:        "zman",
		UserID:         userIDPtr,
		PublisherID:    publisherIDPtr,
		RequestID:      req.RequestID,
		EntityType:     &entityType,
		EntityID:       nil, // Will be set after creation
		Payload:        payloadJSON,
		ParentActionID: pgtype.UUID{Valid: false},
		Metadata:       nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to record action: %w", err)
	}

	// STEP 1: Fetch source zman (concept: Zman + Publisher)
	sourceZman, err := qtx.GetSourceZmanForLinking(ctx, req.SourceZmanID)
	if err == pgx.ErrNoRows {
		return nil, ErrSourceNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to fetch source zman: %w", err)
	}

	// STEP 2: Verify publisher status (concept: Publisher)
	// For linking mode, source publisher must be verified
	if req.Mode == "link" && !sourceZman.IsVerified {
		return nil, ErrPublisherNotVerified
	}

	// STEP 3: Check duplicate zman_key (concept: Zman)
	exists, err := qtx.CheckZmanKeyExists(ctx, sqlcgen.CheckZmanKeyExistsParams{
		PublisherID: req.TargetPublisherID,
		ZmanKey:     sourceZman.ZmanKey,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check zman key existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("%w: %s", ErrZmanKeyExists, sourceZman.ZmanKey)
	}

	// STEP 4: Prepare parameters based on mode
	var linkedID *int32
	var formulaDSL string
	if req.Mode == "copy" {
		linkedID = nil
		formulaDSL = sourceZman.FormulaDsl
	} else {
		// Mode is "link"
		linkedID = &req.SourceZmanID
		formulaDSL = "" // For linked zmanim, formula is resolved at query time
	}

	// STEP 5: Create linked or copied zman (concept: Zman)
	result, err := qtx.CreateLinkedOrCopiedZman(ctx, sqlcgen.CreateLinkedOrCopiedZmanParams{
		PublisherID:           req.TargetPublisherID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDsl:            formulaDSL,
		TimeCategoryID:        nil, // Will be inherited from source if needed
		Dependencies:          sourceZman.Dependencies,
		MasterZmanID:          sourceZman.MasterZmanID,
		LinkedPublisherZmanID: linkedID,
	})
	if err != nil {
		// Mark action as failed
		resultJSON, _ := json.Marshal(map[string]interface{}{"error": err.Error()})
		failedStatus := "failed"
		errMsg := err.Error()
		_ = qtx.CompleteAction(ctx, sqlcgen.CompleteActionParams{
			ID:           actionID,
			Status:       &failedStatus,
			Result:       resultJSON,
			ErrorMessage: &errMsg,
		})
		return nil, fmt.Errorf("failed to create linked/copied zman: %w", err)
	}

	// STEP 6: Complete action with result
	resultJSON, _ := json.Marshal(map[string]interface{}{
		"zman_id":    result.ID,
		"zman_key":   sourceZman.ZmanKey,
		"mode":       req.Mode,
		"created_at": result.CreatedAt,
	})
	completedStatus := "completed"
	err = qtx.CompleteAction(ctx, sqlcgen.CompleteActionParams{
		ID:           actionID,
		Status:       &completedStatus,
		Result:       resultJSON,
		ErrorMessage: nil,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to complete action: %w", err)
	}

	// COMMIT TRANSACTION
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Return result
	return &LinkOrCopyZmanResult{
		ID:                    result.ID,
		ZmanKey:               sourceZman.ZmanKey,
		HebrewName:            sourceZman.HebrewName,
		EnglishName:           sourceZman.EnglishName,
		FormulaDSL:            sourceZman.FormulaDsl,
		Dependencies:          sourceZman.Dependencies,
		MasterZmanID:          sourceZman.MasterZmanID,
		LinkedPublisherZmanID: linkedID,
		CreatedAt:             result.CreatedAt,
		UpdatedAt:             result.UpdatedAt,
		IsLinked:              req.Mode == "link",
		SourceIsVerified:      sourceZman.IsVerified,
	}, nil
}

// ===========================================================================
// SECTION 6: EVENT FILTERING METHODS
// ===========================================================================

// EventFilterTag represents a minimal tag interface for event filtering
type EventFilterTag struct {
	TagKey    string `json:"tag_key"`
	TagType   string `json:"tag_type"`
	IsNegated bool   `json:"is_negated"`
}

// ShouldShowZman determines if a zman should be shown based on its tags and active event codes
// This is entirely tag-driven with timing tag support:
// - event/jewish_day tags are checked against activeEventCodes
// - timing tags (day_before, motzei) modify how event tags are matched:
//   - day_before + shabbos matches erev_shabbos in activeEventCodes
//   - motzei + shabbos matches shabbos in activeEventCodes (from MoetzeiEvents)
func (s *ZmanimService) ShouldShowZman(tags []EventFilterTag, activeEventCodes []string) bool {
	// Extract zman_key for logging (if available in first tag)
	zmanKey := "unknown"
	if len(tags) > 0 {
		// Note: zman_key is not in EventFilterTag struct, using first tag_key as identifier
		zmanKey = tags[0].TagKey
	}

	slog.Debug("ShouldShowZman: START",
		"zman_key", zmanKey,
		"input_tags_count", len(tags),
		"input_tags", tags,
		"active_event_codes", activeEventCodes)

	// Separate event tags and timing tags
	eventTags := []EventFilterTag{}
	timingTags := []EventFilterTag{}
	for _, tag := range tags {
		switch tag.TagType {
		case "event", "jewish_day":
			eventTags = append(eventTags, tag)
		case "timing":
			timingTags = append(timingTags, tag)
		}
	}

	// Check for timing modifiers
	hasDayBefore := false
	hasMoetzei := false
	for _, tt := range timingTags {
		if tt.TagKey == "day_before" {
			hasDayBefore = true
		}
		if tt.TagKey == "motzei" {
			hasMoetzei = true
		}
	}

	slog.Debug("ShouldShowZman: after filtering tags",
		"zman_key", zmanKey,
		"event_tags", eventTags,
		"timing_tags", timingTags,
		"has_day_before", hasDayBefore,
		"has_motzei", hasMoetzei)

	// If no event tags, always show
	if len(eventTags) == 0 {
		slog.Debug("ShouldShowZman: RETURN true",
			"zman_key", zmanKey,
			"reason", "no event tags")
		return true
	}

	// Check event tags against activeEventCodes, considering timing modifiers
	hasPositiveMatch := false
	hasNegativeMatch := false
	positiveMatchedTags := []string{}
	negativeMatchedTags := []string{}

	for _, tag := range eventTags {
		var isActive bool

		// Timing modifiers change HOW we match, not just add alternatives:
		// - day_before: ONLY match "erev_" + event (NOT the event itself)
		// - motzei: ONLY match the event when it's motzei time
		// - no timing tag: direct match to event

		if hasDayBefore && !tag.IsNegated {
			// day_before timing: candle lighting should show on EREV, not on the day itself
			// Example: shabbos + day_before matches erev_shabbos (Friday), NOT shabbos (Saturday)
			erevCode := "erev_" + tag.TagKey
			isActive = s.sliceContainsString(activeEventCodes, erevCode)
			if isActive {
				slog.Debug("ShouldShowZman: day_before timing match",
					"zman_key", zmanKey,
					"event_tag", tag.TagKey,
					"matched_via", erevCode)
			}
		} else if hasMoetzei && !tag.IsNegated {
			// motzei timing: havdalah should show when the event ends
			// MoetzeiEvents populates activeEventCodes with event codes for motzei
			isActive = s.sliceContainsString(activeEventCodes, tag.TagKey)
			if isActive {
				slog.Debug("ShouldShowZman: motzei timing match",
					"zman_key", zmanKey,
					"event_tag", tag.TagKey)
			}
		} else {
			// No timing modifier: direct match to event
			isActive = s.sliceContainsString(activeEventCodes, tag.TagKey)
		}

		if tag.IsNegated {
			if isActive {
				hasNegativeMatch = true
				negativeMatchedTags = append(negativeMatchedTags, tag.TagKey)
			}
		} else {
			if isActive {
				hasPositiveMatch = true
				positiveMatchedTags = append(positiveMatchedTags, tag.TagKey)
			}
		}
	}

	slog.Debug("ShouldShowZman: after matching against active codes",
		"zman_key", zmanKey,
		"hasPositiveMatch", hasPositiveMatch,
		"positive_matched_tags", positiveMatchedTags,
		"hasNegativeMatch", hasNegativeMatch,
		"negative_matched_tags", negativeMatchedTags)

	// Negated tags take precedence
	if hasNegativeMatch {
		slog.Debug("ShouldShowZman: RETURN false",
			"zman_key", zmanKey,
			"reason", "negated tag matched",
			"matched_negated_tags", negativeMatchedTags)
		return false
	}

	// If there are positive tags, at least one must match
	hasPositiveTags := false
	for _, tag := range eventTags {
		if !tag.IsNegated {
			hasPositiveTags = true
			break
		}
	}

	slog.Debug("ShouldShowZman: checking positive tags requirement",
		"zman_key", zmanKey,
		"hasPositiveTags", hasPositiveTags,
		"hasPositiveMatch", hasPositiveMatch)

	if hasPositiveTags && !hasPositiveMatch {
		slog.Debug("ShouldShowZman: RETURN false",
			"zman_key", zmanKey,
			"reason", "has positive tags but none matched")
		return false
	}

	slog.Debug("ShouldShowZman: RETURN true",
		"zman_key", zmanKey,
		"reason", "all checks passed")
	return true
}

// sliceContainsString checks if a string slice contains a given string
func (s *ZmanimService) sliceContainsString(slice []string, str string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

// ===========================================================================
// SECTION 8: CACHE METHODS
// ===========================================================================

// buildCacheKey creates a unique cache key including filter parameters
func (s *ZmanimService) buildCacheKey(publisherID int32, localityID int64, date string, includeDisabled, includeUnpublished, includeBeta bool) string {
	// Format: calc:{publisherId}:{localityId}:{date}:{filterHash}
	filterParts := []string{}
	if includeDisabled {
		filterParts = append(filterParts, "d")
	}
	if includeUnpublished {
		filterParts = append(filterParts, "u")
	}
	if !includeBeta {
		filterParts = append(filterParts, "nb") // "no beta"
	}

	filterHash := "default"
	if len(filterParts) > 0 {
		filterHash = strings.Join(filterParts, "-")
	}

	return fmt.Sprintf("calc:%d:%d:%s:%s", publisherID, localityID, date, filterHash)
}

// getCachedResult retrieves a cached calculation result
func (s *ZmanimService) getCachedResult(ctx context.Context, cacheKey string) (*CalculationResult, error) {
	// Use cache's GetZmanim with the cache key format
	// Cache key format: calc:{publisherId}:{localityId}:{date}:{filterHash}
	// Extract components for cache lookup
	parts := strings.Split(cacheKey, ":")
	if len(parts) < 5 {
		return nil, fmt.Errorf("invalid cache key format: expected calc:publisherId:localityId:date:filterHash")
	}

	publisherID := parts[1]
	localityID := parts[2]
	date := parts[3]
	filterHash := parts[4]

	// Include filter hash in cache key by appending to date
	// This differentiates cached results with different filter settings
	dateWithFilter := fmt.Sprintf("%s:%s", date, filterHash)

	cached, err := s.cache.GetZmanim(ctx, publisherID, localityID, dateWithFilter)
	if err != nil {
		return nil, err
	}
	if cached == nil {
		return nil, nil
	}

	// Unmarshal the cached data into CalculationResult
	var result CalculationResult
	if err := json.Unmarshal(cached.Data, &result); err != nil {
		slog.Error("failed to unmarshal cached zmanim", "error", err, "key", cacheKey)
		return nil, fmt.Errorf("failed to unmarshal cached zmanim: %w", err)
	}

	result.FromCache = true
	result.CachedAt = &cached.CachedAt

	return &result, nil
}

// setCachedResult stores a calculation result in cache
func (s *ZmanimService) setCachedResult(ctx context.Context, cacheKey string, result *CalculationResult) error {
	// Extract cache key components
	parts := strings.Split(cacheKey, ":")
	if len(parts) < 5 {
		return fmt.Errorf("invalid cache key format: expected calc:publisherId:localityId:date:filterHash")
	}

	publisherID := parts[1]
	localityID := parts[2]
	date := parts[3]
	filterHash := parts[4]

	// Include filter hash in cache key by appending to date
	dateWithFilter := fmt.Sprintf("%s:%s", date, filterHash)

	// Store with 0 TTL (permanent - we'll invalidate explicitly)
	return s.cache.SetZmanim(ctx, publisherID, localityID, dateWithFilter, result)
}

// InvalidatePublisherCache clears all cached calculations for a publisher
// This should be called when publisher zmanim configuration changes
func (s *ZmanimService) InvalidatePublisherCache(ctx context.Context, publisherID int32) error {
	if s.cache == nil {
		return nil
	}

	publisherIDStr := strconv.FormatInt(int64(publisherID), 10)
	return s.cache.InvalidatePublisherCache(ctx, publisherIDStr)
}

// InvalidateLocalityCache clears cached calculations for a specific locality and publisher
// This should be called when locality coordinates are updated
func (s *ZmanimService) InvalidateLocalityCache(ctx context.Context, publisherID int32, localityID int64) error {
	if s.cache == nil {
		return nil
	}

	publisherIDStr := strconv.FormatInt(int64(publisherID), 10)
	localityIDStr := strconv.FormatInt(localityID, 10)
	return s.cache.InvalidateZmanimForLocality(ctx, publisherIDStr, localityIDStr)
}

// ===========================================================================
// SECTION 8: ROUNDING
// ===========================================================================

// ApplyRounding applies the specified rounding mode and returns two time formats
// Returns: (exact HH:MM:SS with actual seconds, display HH:MM rounded)
// This is the single source of truth for all time rounding in the application
func ApplyRounding(t time.Time, mode string) (string, string) {
	exact := t.Format("15:04:05")

	var rounded time.Time
	switch mode {
	case "floor":
		rounded = t.Truncate(time.Minute)
	case "ceil":
		if t.Second() > 0 || t.Nanosecond() > 0 {
			rounded = t.Truncate(time.Minute).Add(time.Minute)
		} else {
			rounded = t
		}
	case "math":
		fallthrough
	default:
		if t.Second() >= 30 {
			rounded = t.Truncate(time.Minute).Add(time.Minute)
		} else {
			rounded = t.Truncate(time.Minute)
		}
	}

	display := rounded.Format("15:04") // HH:MM (no seconds)

	return exact, display
}

// ===========================================================================
// COMPATIBILITY SERVICE (maintained for backward compatibility)
// ===========================================================================

// CompatZmanimService handles zmanim calculation business logic
// Note: Maintained for backward compatibility - use ZmanimService for new code
// This exists to avoid breaking builds during migration
type CompatZmanimService struct {
	db               *db.DB
	publisherService *PublisherService
}

// NewCompatZmanimService creates a new compatibility zmanim service
// Note: Use NewZmanimService for new implementations
func NewCompatZmanimService(database *db.DB, publisherService *PublisherService) *CompatZmanimService {
	return &CompatZmanimService{
		db:               database,
		publisherService: publisherService,
	}
}

// CalculateZmanim calculates zmanim for a given request
// Note: Backward compatibility implementation - prefer ZmanimService.CalculateZmanim for new code
func (s *CompatZmanimService) CalculateZmanim(ctx context.Context, req *models.ZmanimRequest) (*models.ZmanimResponse, error) {
	// Parse date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Check cache first
	cached, err := s.getFromCache(ctx, date, req.Latitude, req.Longitude, req.PublisherID)
	if err == nil && cached != nil {
		return cached, nil
	}

	// Get publisher and algorithm
	var publisher *models.Publisher
	var algoModel *models.Algorithm

	if req.PublisherID != nil && *req.PublisherID != "" {
		publisher, err = s.publisherService.GetPublisherByID(ctx, *req.PublisherID)
		if err != nil {
			return nil, fmt.Errorf("failed to get publisher: %w", err)
		}
		// Algorithm lookup disabled in compatibility mode
		algoModel = nil
	} else {
		publisher, algoModel, err = s.publisherService.GetPublisherForLocation(ctx, req.Latitude, req.Longitude)
		if err != nil {
			return nil, fmt.Errorf("failed to get publisher for location: %w", err)
		}
	}

	// Convert models.Algorithm to algorithm.AlgorithmConfig if needed
	var algorithmConfig *algorithm.AlgorithmConfig
	if algoModel != nil {
		// This conversion would happen here, but it's deprecated legacy code
		algorithmConfig = nil
	}

	// Get elevation from request or default to 0
	elevation := 0.0
	if req.Elevation != nil {
		elevation = float64(*req.Elevation)
	}

	// Calculate zmanim using the algorithm
	zmanim, err := s.calculateWithAlgorithm(ctx, date, req.Latitude, req.Longitude, elevation, req.Timezone, algorithmConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate zmanim: %w", err)
	}

	response := &models.ZmanimResponse{
		Date: req.Date,
		Location: models.Location{
			Name:      fmt.Sprintf("%.4f, %.4f", req.Latitude, req.Longitude),
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
			Timezone:  req.Timezone,
			Elevation: req.Elevation,
		},
		Publisher:    publisher,
		Zmanim:       zmanim,
		CalculatedAt: time.Now(),
	}

	if err := s.cacheResult(ctx, date, req.Latitude, req.Longitude, publisher.ID, zmanim); err != nil {
		slog.Error("failed to cache result", "error", err)
	}

	return response, nil
}

// getFromCache retrieves cached zmanim calculations
// DISABLED: calculation_cache table does not exist in current schema
// Caching is handled by Redis (see calculation_logs.cache_hit field)
func (s *CompatZmanimService) getFromCache(ctx context.Context, date time.Time, latitude, longitude float64, publisherID *string) (*models.ZmanimResponse, error) {
	_ = ctx
	_ = date
	_ = latitude
	_ = longitude
	_ = publisherID
	return nil, fmt.Errorf("cache not available")
}

// cacheResult stores calculation results in cache
// DISABLED: calculation_cache table does not exist in current schema
// Caching is handled by Redis (see calculation_logs.cache_hit field)
func (s *CompatZmanimService) cacheResult(ctx context.Context, date time.Time, latitude, longitude float64, algorithmID string, zmanim map[string]string) error {
	_ = ctx
	_ = date
	_ = latitude
	_ = longitude
	_ = algorithmID
	_ = zmanim
	return nil
}

// calculateWithAlgorithm performs the actual zmanim calculation
func (s *CompatZmanimService) calculateWithAlgorithm(ctx context.Context, date time.Time, latitude, longitude, elevation float64, timezone string, alg *algorithm.AlgorithmConfig) (map[string]string, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	// Use provided algorithm or default
	algorithmConfig := alg
	if algorithmConfig == nil {
		algorithmConfig = algorithm.DefaultAlgorithm()
	}

	// Create executor with elevation and run calculations
	executor := algorithm.NewExecutorWithElevation(date, latitude, longitude, elevation, loc)
	results, err := executor.Execute(algorithmConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to execute algorithm: %w", err)
	}

	// Convert to simple map for backward compatibility
	zmanim := make(map[string]string)
	for _, zman := range results.Zmanim {
		zmanim[zman.Key] = zman.TimeString
	}

	return zmanim, nil
}

// getAlgorithmForPublisher gets the active algorithm for a publisher
// DISABLED: Schema mismatch - algorithms table doesn't have version or is_active columns
// Current schema has: configuration (jsonb), status_id (smallint, FK to algorithm_statuses)
// Alternative: Use existing SQLc query (GetPublisherActiveAlgorithm) or create new one matching actual schema
func (s *CompatZmanimService) getAlgorithmForPublisher(ctx context.Context, publisherID string) (*algorithm.AlgorithmConfig, error) {
	_ = ctx
	_ = publisherID
	return nil, fmt.Errorf("getAlgorithmForPublisher: not implemented - schema mismatch (version, is_active columns don't exist)")
}
