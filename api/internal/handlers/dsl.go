package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jcom-dev/zmanim/internal/calendar"
	"github.com/jcom-dev/zmanim/internal/dsl"
	"github.com/jcom-dev/zmanim/internal/services"
)

// DSL API Request/Response Types

// DSLValidateRequest represents a request to validate a DSL formula
type DSLValidateRequest struct {
	Formula string `json:"formula"`
}

// DSLValidateResponse represents the response from formula validation
type DSLValidateResponse struct {
	Valid        bool                  `json:"valid"`
	Errors       []dsl.ValidationError `json:"errors,omitempty"`
	Dependencies []string              `json:"dependencies,omitempty"`
}

// DSLPreviewRequest represents a request to preview/calculate a DSL formula
type DSLPreviewRequest struct {
	Formula    string            `json:"formula"`
	Date       string            `json:"date"`                  // ISO 8601 date (YYYY-MM-DD)
	LocationID string            `json:"location_id,omitempty"` // Optional: locality/location ID
	Latitude   float64           `json:"latitude,omitempty"`    // Direct coordinates
	Longitude  float64           `json:"longitude,omitempty"`
	Timezone   string            `json:"timezone,omitempty"`   // e.g., "America/New_York"
	Elevation  float64           `json:"elevation,omitempty"`  // Optional elevation in meters
	References map[string]string `json:"references,omitempty"` // Resolved references: key -> formula
}

// DSLPreviewResponse represents the response from formula preview/calculation
type DSLPreviewResponse struct {
	Result      string                `json:"result"`       // Exact time (HH:MM:SS with actual seconds)
	ResultRound string                `json:"result_round"` // Rounded time (HH:MM)
	Timestamp   int64                 `json:"timestamp"`    // Unix timestamp
	Breakdown   []dsl.CalculationStep `json:"breakdown"`
}

// ValidateDSLFormula validates a DSL formula
//
//	@Summary		Validate DSL formula
//	@Description	Validates a zmanim formula written in the DSL syntax, returning any errors and dependencies
//	@Tags			DSL
//	@Accept			json
//	@Produce		json
//	@Param			request	body		DSLValidateRequest						true	"Formula to validate"
//	@Success		200		{object}	APIResponse{data=DSLValidateResponse}	"Validation result"
//	@Failure		400		{object}	APIResponse{error=APIError}				"Invalid request"
//	@Router			/dsl/validate [post]
func (h *Handlers) ValidateDSLFormula(w http.ResponseWriter, r *http.Request) {
	var req DSLValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Formula == "" {
		RespondValidationError(w, r, "Formula is required", map[string]string{
			"formula": "Formula cannot be empty",
		})
		return
	}

	// Parse and validate the formula
	node, validationErrors, err := dsl.ValidateFormula(req.Formula, nil)

	response := DSLValidateResponse{
		Valid: err == nil && len(validationErrors) == 0,
	}

	if len(validationErrors) > 0 {
		response.Errors = validationErrors
	}

	// Extract dependencies if valid
	if node != nil {
		refs := dsl.ExtractReferences(node)
		if len(refs) > 0 {
			response.Dependencies = refs
		}
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// PreviewDSLFormula calculates the result of a DSL formula
//
//	@Summary		Preview DSL formula
//	@Description	Calculates the result of a zmanim formula for a specific date and location, returning the time and calculation breakdown
//	@Tags			DSL
//	@Accept			json
//	@Produce		json
//	@Param			request	body		DSLPreviewRequest						true	"Formula, date, and location"
//	@Success		200		{object}	APIResponse{data=DSLPreviewResponse}	"Calculation result with breakdown"
//	@Failure		400		{object}	APIResponse{error=APIError}				"Invalid request or formula error"
//	@Failure		404		{object}	APIResponse{error=APIError}				"Location not found"
//	@Router			/dsl/preview [post]
func (h *Handlers) PreviewDSLFormula(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req DSLPreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	validationErrors := make(map[string]string)
	if req.Formula == "" {
		validationErrors["formula"] = "Formula is required"
	}
	if req.Date == "" {
		validationErrors["date"] = "Date is required"
	}

	// Need either location_id or lat/long
	hasLocation := req.LocationID != ""
	hasCoordinates := req.Latitude != 0 || req.Longitude != 0

	if !hasLocation && !hasCoordinates {
		validationErrors["location"] = "Either location_id or latitude/longitude is required"
	}

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	// Parse date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Get location data
	var latitude, longitude float64
	var timezone string

	if hasLocation {
		// Fetch location from database
		localityID, err := stringToInt32(req.LocationID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid location_id format")
			return
		}
		locality, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, localityID)
		if err != nil {
			RespondNotFound(w, r, "Location not found")
			return
		}
		// Coordinates come from view (nullable via LEFT JOIN)
		if locality.Latitude != nil {
			latitude = *locality.Latitude
		}
		if locality.Longitude != nil {
			longitude = *locality.Longitude
		}
		timezone = locality.Timezone
	} else {
		// Use provided coordinates
		latitude = req.Latitude
		longitude = req.Longitude
		timezone = req.Timezone
		if timezone == "" {
			timezone = "UTC"
		}
	}

	// Validate coordinates
	if latitude < -90 || latitude > 90 {
		RespondBadRequest(w, r, "Latitude must be between -90 and 90")
		return
	}
	if longitude < -180 || longitude > 180 {
		RespondBadRequest(w, r, "Longitude must be between -180 and 180")
		return
	}

	// Load timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	// Set date to start of day in timezone
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, loc)

	// Use the calculation service to execute the formula
	result, err := h.zmanimService.CalculateFormula(ctx, services.FormulaParams{
		Formula:    req.Formula,
		Date:       date,
		Latitude:   latitude,
		Longitude:  longitude,
		Elevation:  req.Elevation,
		Timezone:   loc,
		References: req.References,
	})

	if err != nil {
		// Log the error for debugging
		slog.Warn("DSL preview failed",
			"error", err.Error(),
			"formula", req.Formula,
			"date", req.Date,
			"lat", latitude,
			"lon", longitude,
		)
		// Check if it's a validation error
		if errList, ok := err.(*dsl.ErrorList); ok {
			RespondValidationError(w, r, "Formula execution failed", errList.ToValidationErrors())
			return
		}
		RespondBadRequest(w, r, "Formula execution failed: "+err.Error())
		return
	}

	response := DSLPreviewResponse{
		Result:      result.TimeExact,
		ResultRound: result.TimeRounded,
		Timestamp:   result.Time.Unix(),
		Breakdown:   result.Breakdown,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

// DSLPreviewWeekRequest represents a request for weekly preview
type DSLPreviewWeekRequest struct {
	Formula              string            `json:"formula"`
	StartDate            string            `json:"start_date"`            // ISO 8601 date (YYYY-MM-DD)
	LocationID           string            `json:"location_id,omitempty"` // Optional: locality/location ID
	Latitude             float64           `json:"latitude,omitempty"`    // Direct coordinates
	Longitude            float64           `json:"longitude,omitempty"`
	Timezone             string            `json:"timezone,omitempty"` // e.g., "America/New_York"
	Elevation            float64           `json:"elevation,omitempty"`
	References           map[string]string `json:"references,omitempty"`            // Resolved references: key -> formula
	TransliterationStyle string            `json:"transliteration_style,omitempty"` // ashkenazi or sephardi
}

// DayPreview represents a single day's calculation result
type DayPreview struct {
	Date        string   `json:"date"`         // YYYY-MM-DD
	HebrewDate  string   `json:"hebrew_date"`  // Hebrew date string
	Result      string   `json:"result"`       // Exact time HH:MM:SS with actual seconds
	ResultRound string   `json:"result_round"` // Rounded time HH:MM
	Events      []string `json:"events"`       // Jewish holidays, Shabbat, etc.
	IsShabbat   bool     `json:"is_shabbat"`
	IsYomTov    bool     `json:"is_yom_tov"`
}

// DSLPreviewWeekResponse represents weekly preview response
type DSLPreviewWeekResponse struct {
	Days []DayPreview `json:"days"`
}

// PreviewDSLFormulaWeek calculates formula for 7 consecutive days
//
//	@Summary		Preview DSL formula for a week
//	@Description	Calculates a zmanim formula for 7 consecutive days starting from the specified date, including Hebrew dates and Shabbat/holiday markers
//	@Tags			DSL
//	@Accept			json
//	@Produce		json
//	@Param			request	body		DSLPreviewWeekRequest						true	"Formula, start date, and location"
//	@Success		200		{object}	APIResponse{data=DSLPreviewWeekResponse}	"Weekly calculation results"
//	@Failure		400		{object}	APIResponse{error=APIError}					"Invalid request"
//	@Failure		404		{object}	APIResponse{error=APIError}					"Location not found"
//	@Router			/dsl/preview-week [post]
func (h *Handlers) PreviewDSLFormulaWeek(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req DSLPreviewWeekRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// Validate required fields
	validationErrors := make(map[string]string)
	if req.Formula == "" {
		validationErrors["formula"] = "Formula is required"
	}
	if req.StartDate == "" {
		validationErrors["start_date"] = "Start date is required"
	}

	// Need either location_id or lat/long
	hasLocation := req.LocationID != ""
	hasCoordinates := req.Latitude != 0 || req.Longitude != 0

	if !hasLocation && !hasCoordinates {
		validationErrors["location"] = "Either location_id or latitude/longitude is required"
	}

	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Invalid request parameters", validationErrors)
		return
	}

	// Parse start date
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		RespondBadRequest(w, r, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	// Get location data
	var latitude, longitude float64
	var timezone string

	if hasLocation {
		// Fetch location from database
		localityID, err := stringToInt32(req.LocationID)
		if err != nil {
			RespondBadRequest(w, r, "Invalid location_id format")
			return
		}
		locality, err := h.db.Queries.GetLocalityDetailsForZmanim(ctx, localityID)
		if err != nil {
			RespondNotFound(w, r, "Location not found")
			return
		}
		// Coordinates come from view (nullable via LEFT JOIN)
		if locality.Latitude != nil {
			latitude = *locality.Latitude
		}
		if locality.Longitude != nil {
			longitude = *locality.Longitude
		}
		timezone = locality.Timezone
	} else {
		// Use provided coordinates
		latitude = req.Latitude
		longitude = req.Longitude
		timezone = req.Timezone
		if timezone == "" {
			timezone = "UTC"
		}
	}

	// Load timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}

	// Get transliteration style (default to ashkenazi)
	transliterationStyle := req.TransliterationStyle
	if transliterationStyle == "" {
		transliterationStyle = "ashkenazi"
	}

	// Calculate for 7 days
	days := []DayPreview{}
	for i := 0; i < 7; i++ {
		currentDate := startDate.AddDate(0, 0, i)
		currentDate = time.Date(currentDate.Year(), currentDate.Month(), currentDate.Day(), 0, 0, 0, 0, loc)

		dayPreview := DayPreview{
			Date:       currentDate.Format("2006-01-02"),
			HebrewDate: formatHebrewDate(currentDate),
			Events:     []string{},
			IsShabbat:  isShabbat(currentDate),
			IsYomTov:   false,
		}

		// Calculate the requested formula using the service
		result, err := h.zmanimService.CalculateFormula(ctx, services.FormulaParams{
			Formula:    req.Formula,
			Date:       currentDate,
			Latitude:   latitude,
			Longitude:  longitude,
			Elevation:  req.Elevation,
			Timezone:   loc,
			References: req.References,
		})

		if err == nil {
			dayPreview.Result = result.TimeExact
			dayPreview.ResultRound = result.TimeRounded
		} else {
			dayPreview.Result = "Error: " + err.Error()
		}

		// Add Shabbat to events if applicable (with correct transliteration)
		if dayPreview.IsShabbat {
			shabbatName := calendar.GetTransliteratedName("Shabbat", transliterationStyle)
			dayPreview.Events = append(dayPreview.Events, shabbatName)
		}

		days = append(days, dayPreview)
	}

	response := DSLPreviewWeekResponse{
		Days: days,
	}

	RespondJSON(w, r, http.StatusOK, response)
}

func isShabbat(date time.Time) bool {
	return date.Weekday() == time.Saturday
}

func formatHebrewDate(date time.Time) string {
	return date.Format("Mon Jan 2, 2006")
}
