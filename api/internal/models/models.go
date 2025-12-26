package models

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Publisher represents a zmanim calculation publisher
// Note: Publisher name IS the organization - no separate organization field
type Publisher struct {
	ID              string    `json:"id"`
	ClerkUserID     *string   `json:"clerk_user_id,omitempty"`
	Name            string    `json:"name"` // Publisher name is the organization name
	Email           string    `json:"email"`
	Description     string    `json:"description"`
	Bio             *string   `json:"bio,omitempty"`
	Website         *string   `json:"website,omitempty"`
	ContactEmail    string    `json:"contact_email"`
	LogoURL         *string   `json:"logo_url,omitempty"`
	LogoData        *string   `json:"logo_data,omitempty"` // Base64 encoded logo image
	Status          string    `json:"status"`
	IsVerified      bool      `json:"is_verified"`
	IsCertified     bool      `json:"is_certified"` // Whether this is a certified/authoritative source
	SubscriberCount int       `json:"subscriber_count"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Algorithm represents a calculation algorithm
type Algorithm struct {
	ID            string     `json:"id"`
	PublisherID   string     `json:"publisher_id"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	Version       string     `json:"version"`
	Configuration pgtype.Map `json:"configuration"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// GeographicRegion represents a geographic region
type GeographicRegion struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // country, state, locality, custom
	CountryCode *string   `json:"country_code,omitempty"`
	StateCode   *string   `json:"state_code,omitempty"`
	Bounds      *string   `json:"bounds,omitempty"` // GeoJSON polygon
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Locality represents a locality in the global localities database
type Locality struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Country          string  `json:"country"`
	CountryCode      string  `json:"country_code"`
	Region           *string `json:"region,omitempty"`
	RegionType       *string `json:"region_type,omitempty"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	Timezone         string  `json:"timezone"`
	Population       *int    `json:"population,omitempty"`
	Elevation        *int    `json:"elevation,omitempty"`          // Elevation in meters above sea level
	Continent        *string `json:"continent,omitempty"`          // Continent code (AF, AN, AS, EU, NA, OC, SA)
	LocalityType     *string `json:"locality_type,omitempty"`      // Locality type code (city, town, village, etc.)
	LocalityTypeName *string `json:"locality_type_name,omitempty"` // Human-readable locality type name
	DisplayHierarchy *string `json:"display_hierarchy,omitempty"`  // Full hierarchy path (e.g., "Brooklyn, NYC, NY, USA, North America")
	// Computed display field
	DisplayName string `json:"display_name"`
}

// LocalitySearchResponse represents the response for locality search
type LocalitySearchResponse struct {
	Localities []Locality `json:"localities"`
	Total      int        `json:"total"`
}

// CoverageArea represents a publisher's coverage area
type CoverageArea struct {
	ID          string    `json:"id"`
	PublisherID string    `json:"publisher_id"`
	RegionID    string    `json:"region_id"`
	AlgorithmID string    `json:"algorithm_id"`
	Priority    int       `json:"priority"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// UserProfile represents a user profile
type UserProfile struct {
	ID               string    `json:"id"`
	Email            string    `json:"email"`
	FullName         *string   `json:"full_name,omitempty"`
	PreferredRegion  *string   `json:"preferred_region,omitempty"`
	DefaultPublisher *string   `json:"default_publisher,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// UserSubscription represents a user's subscription to a publisher
type UserSubscription struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	PublisherID string    `json:"publisher_id"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CalculationCache represents cached zmanim calculations
type CalculationCache struct {
	ID          string     `json:"id"`
	Date        time.Time  `json:"date"`
	Latitude    float64    `json:"latitude"`
	Longitude   float64    `json:"longitude"`
	AlgorithmID string     `json:"algorithm_id"`
	Results     pgtype.Map `json:"results"`
	ExpiresAt   time.Time  `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// AuditLog represents an audit log entry
type AuditLog struct {
	ID         string      `json:"id"`
	UserID     *string     `json:"user_id,omitempty"`
	Action     string      `json:"action"`
	EntityType string      `json:"entity_type"`
	EntityID   string      `json:"entity_id"`
	OldValues  *pgtype.Map `json:"old_values,omitempty"`
	NewValues  *pgtype.Map `json:"new_values,omitempty"`
	IPAddress  *string     `json:"ip_address,omitempty"`
	UserAgent  *string     `json:"user_agent,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
}

// Location represents a geographic location for zmanim calculations
type Location struct {
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
	Elevation *int    `json:"elevation,omitempty"`
}

// ZmanimRequest represents a request for zmanim calculations
type ZmanimRequest struct {
	Date        string  `json:"date"` // YYYY-MM-DD format
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Timezone    string  `json:"timezone"`
	PublisherID *string `json:"publisher_id,omitempty"`
	Elevation   *int    `json:"elevation,omitempty"`
}

// ZmanimResponse represents the response containing calculated zmanim
type ZmanimResponse struct {
	Date         string            `json:"date"`
	Location     Location          `json:"location"`
	Publisher    *Publisher        `json:"publisher,omitempty"`
	Algorithm    *Algorithm        `json:"algorithm,omitempty"`
	Zmanim       map[string]string `json:"zmanim"`
	CachedAt     *time.Time        `json:"cached_at,omitempty"`
	CalculatedAt time.Time         `json:"calculated_at"`
}

// PublisherListResponse represents a list of publishers with pagination
type PublisherListResponse struct {
	Publishers []Publisher `json:"publishers"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
}

// PublisherProfileUpdateRequest represents a request to update publisher profile
type PublisherProfileUpdateRequest struct {
	Name    *string `json:"name,omitempty"` // Publisher name is the organization name
	Email   *string `json:"email,omitempty"`
	Website *string `json:"website,omitempty"`
	Bio     *string `json:"bio,omitempty"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version"`
}

// PublisherCoverage represents a publisher's coverage area at continent, country, region, or locality level
// Uses normalized integer IDs with lookups for display names
type PublisherCoverage struct {
	ID              int32     `json:"id"`
	PublisherID     int32     `json:"publisher_id"`
	CoverageLevelID int16     `json:"coverage_level_id"`
	ContinentID     *int16    `json:"continent_id,omitempty"`
	CountryID       *int16    `json:"country_id,omitempty"`
	RegionID        *int32    `json:"region_id,omitempty"`
	LocalityID      *int32    `json:"locality_id,omitempty"`
	Priority        int       `json:"priority"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	// Computed fields for display (from joined geo tables and lookups)
	// Note: These fields should always be included (not omitempty) so frontend gets consistent shape
	CoverageLevelKey  *string  `json:"coverage_level_key"` // "continent", "country", etc.
	ContinentCode     *string  `json:"continent_code"`
	ContinentName     *string  `json:"continent_name"`
	CountryCode       *string  `json:"country_code"`
	CountryName       *string  `json:"country_name"`
	RegionCode        *string  `json:"region_code"`
	RegionName        *string  `json:"region_name"`
	LocalityName      *string  `json:"locality_name"`
	LocalityLatitude  *float64 `json:"locality_latitude"`
	LocalityLongitude *float64 `json:"locality_longitude"`
	LocalityTimezone  *string  `json:"locality_timezone"`
	LocalityCount     int64    `json:"locality_count"`
}

// PublisherCoverageCreateRequest represents a request to create coverage
type PublisherCoverageCreateRequest struct {
	CoverageLevel string  `json:"coverage_level"` // continent, country, region, locality
	ContinentCode *string `json:"continent_code,omitempty"`
	CountryID     *int16  `json:"country_id,omitempty"`
	RegionID      *int32  `json:"region_id,omitempty"`
	LocalityID    *int32  `json:"locality_id,omitempty"`
	Priority      *int    `json:"priority,omitempty"`
}

// PublisherCoverageUpdateRequest represents a request to update coverage
type PublisherCoverageUpdateRequest struct {
	Priority *int  `json:"priority,omitempty"`
	IsActive *bool `json:"is_active,omitempty"`
}

// PublisherCoverageListResponse represents a list of coverage areas
type PublisherCoverageListResponse struct {
	IsGlobal bool                `json:"is_global"`
	Coverage []PublisherCoverage `json:"coverage"`
	Total    int                 `json:"total"`
	Message  *string             `json:"message,omitempty"`
}

// PublisherForLocality represents a publisher found for a locality search
type PublisherForLocality struct {
	PublisherID   string `json:"publisher_id"`
	PublisherName string `json:"publisher_name"`
	CoverageLevel string `json:"coverage_level"`
	Priority      int    `json:"priority"`
	MatchType     string `json:"match_type"` // exact_locality, region_match, country_match
}

// PublishersForLocalityResponse represents the response for publishers serving a locality
type PublishersForLocalityResponse struct {
	Locality    *Locality              `json:"locality"`
	Publishers  []PublisherForLocality `json:"publishers"`
	HasCoverage bool                   `json:"has_coverage"`
}

// AlgorithmResponse represents an algorithm with its configuration
type AlgorithmResponse struct {
	ID          string                 `json:"id"`
	PublisherID string                 `json:"publisher_id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
	Status      string                 `json:"status"`
	IsActive    bool                   `json:"is_active"`
	Version     int                    `json:"version"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// AlgorithmRequest represents a request to create or update an algorithm
type AlgorithmRequest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
}

// AlgorithmPreviewRequest represents a request to preview algorithm calculations
type AlgorithmPreviewRequest struct {
	Config    map[string]interface{} `json:"config"`
	Date      string                 `json:"date"`
	Latitude  float64                `json:"latitude"`
	Longitude float64                `json:"longitude"`
	Timezone  string                 `json:"timezone"`
}

// PublisherLocationOverride represents a publisher-specific override for locality location data
type PublisherLocationOverride struct {
	ID                int       `json:"id"`
	PublisherID       int       `json:"publisher_id"`
	LocalityID        int       `json:"locality_id"`
	LocalityName      string    `json:"locality_name,omitempty"`
	CountryName       string    `json:"country_name,omitempty"`
	OverrideLatitude  *float64  `json:"override_latitude,omitempty"`
	OverrideLongitude *float64  `json:"override_longitude,omitempty"`
	OverrideElevation *int      `json:"override_elevation,omitempty"`
	Reason            string    `json:"reason,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// LocationOverrideCreateRequest represents a request to create a location override
type LocationOverrideCreateRequest struct {
	OverrideLatitude  *float64 `json:"override_latitude,omitempty"`
	OverrideLongitude *float64 `json:"override_longitude,omitempty"`
	OverrideElevation *int     `json:"override_elevation,omitempty"`
	Reason            string   `json:"reason,omitempty"`
}

// LocationOverrideUpdateRequest represents a request to update a location override
type LocationOverrideUpdateRequest struct {
	OverrideLatitude  *float64 `json:"override_latitude,omitempty"`
	OverrideLongitude *float64 `json:"override_longitude,omitempty"`
	OverrideElevation *int     `json:"override_elevation,omitempty"`
	Reason            string   `json:"reason,omitempty"`
}

// LocationOverridesListResponse represents a list of location overrides
type LocationOverridesListResponse struct {
	Overrides []PublisherLocationOverride `json:"overrides"`
	Total     int                         `json:"total"`
}
