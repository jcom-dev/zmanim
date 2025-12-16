// Package handlers contains HTTP request handlers and API type definitions.
// All types in this file are annotated for OpenAPI documentation generation.
package handlers

import "time"

// =============================================================================
// Common Response Types
// =============================================================================

// ErrorResponse represents a standard API error response
//
//	@Description	Standard error response format
type ErrorResponse struct {
	// Error message describing what went wrong
	Error string `json:"error" example:"Resource not found"`
	// HTTP status code
	Code int `json:"code" example:"404"`
	// Additional error details (optional)
	Details map[string]string `json:"details,omitempty"`
}

// SuccessResponse represents a standard success response
//
//	@Description	Standard success response format
type SuccessResponse struct {
	// Success indicator
	Success bool `json:"success" example:"true"`
	// Success message
	Message string `json:"message" example:"Operation completed successfully"`
}

// PaginatedResponse represents a paginated API response
//
//	@Description	Paginated response wrapper
type PaginatedResponse struct {
	// Data items
	Data interface{} `json:"data"`
	// Pagination metadata
	Meta PaginationMeta `json:"meta"`
}

// PaginationMeta contains pagination metadata
//
//	@Description	Pagination metadata
type PaginationMeta struct {
	// Current page number (1-indexed)
	Page int `json:"page" example:"1"`
	// Number of items per page
	PerPage int `json:"per_page" example:"20"`
	// Total number of items
	Total int `json:"total" example:"100"`
	// Total number of pages
	TotalPages int `json:"total_pages" example:"5"`
}

// =============================================================================
// Publisher Types
// =============================================================================

// Publisher represents a zmanim publisher profile
//
//	@Description	Publisher profile
type PublisherResponse struct {
	// Unique identifier
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Publisher display name (the organization name)
	Name string `json:"name" example:"Congregation Beth Israel"`
	// Contact email
	Email string `json:"email" example:"rabbi@bethisrael.org"`
	// Publisher description
	Description *string `json:"description,omitempty" example:"Orthodox synagogue serving the community since 1923"`
	// Short biography
	Bio *string `json:"bio,omitempty"`
	// Website URL
	Website *string `json:"website,omitempty" example:"https://bethisrael.org"`
	// Logo URL
	LogoURL *string `json:"logo_url,omitempty"`
	// Account status (pending, active, verified, suspended)
	Status string `json:"status" example:"active"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// PublisherProfileUpdateRequest represents a profile update request
//
//	@Description	Request body for updating publisher profile
type PublisherProfileUpdateRequest struct {
	// Publisher display name (the organization name)
	Name *string `json:"name,omitempty" example:"Congregation Beth Israel"`
	// Contact email
	Email *string `json:"email,omitempty" example:"rabbi@bethisrael.org"`
	// Website URL
	Website *string `json:"website,omitempty" example:"https://bethisrael.org"`
	// Short biography
	Bio *string `json:"bio,omitempty"`
}

// =============================================================================
// Zmanim Types
// =============================================================================

// LocationInfo represents location data for zmanim calculations
//
//	@Description	Geographic location information
type LocationInfo struct {
	// Locality ID
	LocalityID string `json:"locality_id" example:"123456"`
	// Locality name
	LocalityName string `json:"locality_name" example:"New York"`
	// Country
	Country string `json:"country" example:"United States"`
	// Country code (ISO 3166-1 alpha-2)
	CountryCode string `json:"country_code" example:"US"`
	// Region/State (optional)
	Region *string `json:"region,omitempty" example:"NY"`
	// Display hierarchy (e.g., "New York, NY, United States")
	DisplayHierarchy string `json:"display_hierarchy" example:"New York, NY, United States"`
	// Latitude coordinate
	Latitude float64 `json:"latitude" example:"40.7128"`
	// Longitude coordinate
	Longitude float64 `json:"longitude" example:"-74.0060"`
	// Elevation in meters
	Elevation float64 `json:"elevation" example:"10"`
	// Timezone identifier
	Timezone string `json:"timezone" example:"America/New_York"`
}

// =============================================================================
// Publisher Zmanim Configuration Types
// =============================================================================

// PublisherZmanConfig represents a publisher's zman configuration
//
//	@Description	Publisher's custom zman formula configuration
type PublisherZmanConfig struct {
	// Unique identifier
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Publisher ID
	PublisherID string `json:"publisher_id"`
	// Zman key identifier
	ZmanKey string `json:"zman_key" example:"sof_zman_shma_gra"`
	// Hebrew display name
	HebrewName string `json:"hebrew_name" example:"סוף זמן שמע גר״א"`
	// English display name
	EnglishName string `json:"english_name" example:"Latest Shema (GRA)"`
	// DSL formula for calculation
	FormulaDSL string `json:"formula_dsl" example:"@sunrise + sha'a_zmanis_gra * 3"`
	// AI-generated explanation (optional)
	AIExplanation *string `json:"ai_explanation,omitempty"`
	// Publisher's custom note
	PublisherComment *string `json:"publisher_comment,omitempty"`
	// Whether this zman is enabled for calculations
	IsEnabled bool `json:"is_enabled" example:"true"`
	// Whether this zman is publicly visible
	IsVisible bool `json:"is_visible" example:"true"`
	// Whether this zman is published (live to end users)
	IsPublished bool `json:"is_published" example:"false"`
	// Whether this is a custom (non-standard) zman
	IsCustom bool `json:"is_custom" example:"false"`
	// Category classification
	Category string `json:"category" example:"morning"`
	// List of dependency zman keys
	Dependencies []string `json:"dependencies"`
	// Sort order for display
	SortOrder int `json:"sort_order" example:"10"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateZmanConfigRequest represents a request to create a new zman config
//
//	@Description	Request body for creating a new publisher zman
type CreateZmanConfigRequest struct {
	// Zman key identifier (must be unique per publisher)
	ZmanKey string `json:"zman_key" validate:"required" example:"custom_zman"`
	// Hebrew display name
	HebrewName string `json:"hebrew_name" validate:"required" example:"זמן מיוחד"`
	// English display name
	EnglishName string `json:"english_name" validate:"required" example:"Custom Time"`
	// DSL formula for calculation
	FormulaDSL string `json:"formula_dsl" validate:"required" example:"@sunset - 30m"`
	// AI-generated explanation (optional)
	AIExplanation *string `json:"ai_explanation,omitempty"`
	// Publisher's custom note
	PublisherComment *string `json:"publisher_comment,omitempty"`
	// Whether this zman is enabled (default: true)
	IsEnabled *bool `json:"is_enabled,omitempty"`
	// Whether this zman is publicly visible (default: true)
	IsVisible *bool `json:"is_visible,omitempty"`
	// Sort order for display (default: 0)
	SortOrder *int `json:"sort_order,omitempty"`
}

// UpdateZmanConfigRequest represents a request to update a zman config
//
//	@Description	Request body for updating a publisher zman
type UpdateZmanConfigRequest struct {
	// Hebrew display name
	HebrewName *string `json:"hebrew_name,omitempty"`
	// English display name
	EnglishName *string `json:"english_name,omitempty"`
	// DSL formula for calculation
	FormulaDSL *string `json:"formula_dsl,omitempty"`
	// AI-generated explanation
	AIExplanation *string `json:"ai_explanation,omitempty"`
	// Publisher's custom note
	PublisherComment *string `json:"publisher_comment,omitempty"`
	// Whether this zman is enabled
	IsEnabled *bool `json:"is_enabled,omitempty"`
	// Whether this zman is publicly visible
	IsVisible *bool `json:"is_visible,omitempty"`
	// Whether this zman is published (live to end users)
	IsPublished *bool `json:"is_published,omitempty"`
	// Sort order for display
	SortOrder *int `json:"sort_order,omitempty"`
}

// =============================================================================
// Coverage Types
// =============================================================================

// PublisherCoverageResponse represents a coverage area
//
//	@Description	Geographic area covered by a publisher
type PublisherCoverageResponse struct {
	// Unique identifier
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Publisher ID
	PublisherID string `json:"publisher_id"`
	// Coverage level (country, region, locality)
	CoverageLevel string `json:"coverage_level" example:"locality"`
	// Country code (ISO 3166-1 alpha-2)
	CountryCode *string `json:"country_code,omitempty" example:"US"`
	// Region/State name
	Region *string `json:"region,omitempty" example:"New York"`
	// Locality ID (if locality-level coverage)
	LocalityID *int64 `json:"locality_id,omitempty"`
	// Locality name for display
	LocalityName string `json:"locality_name,omitempty" example:"Brooklyn"`
	// Country name for display
	Country string `json:"country,omitempty" example:"United States"`
	// Human-readable display name
	DisplayName string `json:"display_name" example:"Brooklyn, NY, United States"`
	// Priority (1-10, higher is more important)
	Priority int `json:"priority" example:"5"`
	// Whether this coverage is active
	IsActive bool `json:"is_active" example:"true"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateCoverageRequest represents a request to add coverage
//
//	@Description	Request body for adding a coverage area
type CreateCoverageRequest struct {
	// Coverage level (country, region, locality)
	CoverageLevel string `json:"coverage_level" validate:"required,oneof=country region locality" example:"locality"`
	// Country code (required for country/region level)
	CountryCode *string `json:"country_code,omitempty" example:"US"`
	// Region name (required for region level)
	Region *string `json:"region,omitempty" example:"New York"`
	// Locality ID (required for locality level)
	LocalityID *int64 `json:"locality_id,omitempty"`
	// Priority (1-10, default: 5)
	Priority *int `json:"priority,omitempty" example:"5"`
}

// UpdateCoverageRequest represents a request to update coverage
//
//	@Description	Request body for updating a coverage area
type UpdateCoverageRequest struct {
	// Priority (1-10)
	Priority *int `json:"priority,omitempty" example:"7"`
	// Whether this coverage is active
	IsActive *bool `json:"is_active,omitempty"`
}

// =============================================================================
// Algorithm Types
// =============================================================================

// AlgorithmConfigResponse represents an algorithm configuration
//
//	@Description	Publisher's algorithm configuration for zmanim calculations
type AlgorithmConfigResponse struct {
	// Unique identifier
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Algorithm name
	Name string `json:"name" example:"GRA Standard"`
	// Description
	Description string `json:"description" example:"Standard GRA-based calculations"`
	// Full algorithm configuration (JSON)
	Configuration interface{} `json:"configuration"`
	// Version number
	Version int `json:"version" example:"1"`
	// Status (draft, published, archived, deprecated)
	Status string `json:"status" example:"published"`
	// Whether this is the active algorithm
	IsActive bool `json:"is_active" example:"true"`
	// When this version was published
	PublishedAt *time.Time `json:"published_at,omitempty"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// =============================================================================
// Locality Types
// =============================================================================

// LocalityResponse represents a locality
//
//	@Description	Locality information for zmanim calculations
type LocalityResponse struct {
	// Unique identifier
	ID string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	// Locality name
	Name string `json:"name" example:"Jerusalem"`
	// Alternate names
	AlternateNames []string `json:"alternate_names,omitempty"`
	// Country
	Country string `json:"country" example:"Israel"`
	// Country code (ISO 3166-1 alpha-2)
	CountryCode string `json:"country_code" example:"IL"`
	// Region/State
	Region *string `json:"region,omitempty"`
	// Latitude coordinate
	Latitude float64 `json:"latitude" example:"31.7683"`
	// Longitude coordinate
	Longitude float64 `json:"longitude" example:"35.2137"`
	// Timezone identifier
	Timezone string `json:"timezone" example:"Asia/Jerusalem"`
	// Population (for ranking)
	Population *int `json:"population,omitempty" example:"936425"`
}

// LocalitySearchResponse represents locality search results
//
//	@Description	Locality search results
type LocalitySearchResponse struct {
	// Search results
	Localities []LocalityResponse `json:"localities"`
	// Total matching results
	Total int `json:"total" example:"15"`
	// Search query
	Query string `json:"query,omitempty" example:"Jerusalem"`
}

// =============================================================================
// DSL Types
// =============================================================================

// DSLValidationRequest represents a DSL validation request
//
//	@Description	Request to validate a DSL formula
type DSLValidationRequest struct {
	// DSL formula to validate
	Formula string `json:"formula" validate:"required" example:"@sunrise + sha'a_zmanis_gra * 3"`
}

// DSLValidationResponse represents DSL validation results
//
//	@Description	DSL formula validation result
type DSLValidationResponse struct {
	// Whether the formula is valid
	Valid bool `json:"valid" example:"true"`
	// List of validation errors (if any)
	Errors []string `json:"errors,omitempty"`
	// List of warnings (non-fatal issues)
	Warnings []string `json:"warnings,omitempty"`
	// Extracted dependencies
	Dependencies []string `json:"dependencies,omitempty"`
	// Normalized formula
	NormalizedFormula string `json:"normalized_formula,omitempty"`
}

// Note: DSLPreviewRequest, DSLPreviewResponse, and CalculationStep are defined in dsl.go

// =============================================================================
// Onboarding Types
// =============================================================================

// OnboardingStateResponse represents onboarding wizard state
//
//	@Description	Publisher onboarding wizard state
type OnboardingStateResponse struct {
	// Current step number
	CurrentStep int `json:"current_step" example:"2"`
	// Array of completed step numbers
	CompletedSteps []int `json:"completed_steps" example:"[0, 1]"`
	// Wizard data (selections, preferences)
	WizardData interface{} `json:"wizard_data"`
	// When onboarding started
	StartedAt time.Time `json:"started_at"`
	// When last updated
	LastUpdatedAt time.Time `json:"last_updated_at"`
	// When completed (null if not completed)
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	// Whether onboarding was skipped
	Skipped bool `json:"skipped" example:"false"`
}

// UpdateOnboardingRequest represents an onboarding state update
//
//	@Description	Request to update onboarding state
type UpdateOnboardingRequest struct {
	// Current step number
	CurrentStep *int `json:"current_step,omitempty"`
	// Step to mark as completed
	CompleteStep *int `json:"complete_step,omitempty"`
	// Wizard data to merge
	WizardData interface{} `json:"wizard_data,omitempty"`
}
