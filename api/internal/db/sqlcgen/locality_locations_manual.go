// File: locality_locations_manual.go
// Purpose: Locality location queries with hierarchical override support for zmanim calculations
// Pattern: data-access
// Dependencies: get_effective_locality_location() and get_locality_location() database functions
// Frequency: critical - used for every zmanim calculation with locality selection
// Compliance: Check docs/adr/ for pattern rationale
//
// NOTE: This file is manually written because SQLc cannot introspect PostgreSQL
// functions that return TABLE(...).

package sqlcgen

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// =============================================================================
// GetEffectiveLocalityLocation - New hierarchical resolution function
// Priority: publisher override > admin override > default (overture/glo90)
// =============================================================================

// GetEffectiveLocalityLocationRow represents the result of get_effective_locality_location() function
type GetEffectiveLocalityLocationRow struct {
	LocalityID                     int32   `json:"locality_id"`
	Latitude                       float64 `json:"latitude"`
	Longitude                      float64 `json:"longitude"`
	ElevationM                     int32   `json:"elevation_m"`
	Timezone                       string  `json:"timezone"`
	CoordinateSourceID             int32   `json:"coordinate_source_id"`
	CoordinateSourceKey            string  `json:"coordinate_source_key"`
	ElevationSourceID              int32   `json:"elevation_source_id"`
	ElevationSourceKey             string  `json:"elevation_source_key"`
	HasPublisherCoordinateOverride bool    `json:"has_publisher_coordinate_override"`
	HasAdminCoordinateOverride     bool    `json:"has_admin_coordinate_override"`
	HasPublisherElevationOverride  bool    `json:"has_publisher_elevation_override"`
	HasAdminElevationOverride      bool    `json:"has_admin_elevation_override"`
}

// GetEffectiveLocalityLocationParams holds the parameters for GetEffectiveLocalityLocation
type GetEffectiveLocalityLocationParams struct {
	LocalityID  int32       `json:"locality_id"`
	PublisherID pgtype.Int4 `json:"publisher_id"`
}

const getEffectiveLocalityLocation = `
SELECT
    locality_id,
    latitude,
    longitude,
    elevation_m,
    timezone,
    coordinate_source_id,
    coordinate_source_key,
    elevation_source_id,
    elevation_source_key,
    has_publisher_coordinate_override,
    has_admin_coordinate_override,
    has_publisher_elevation_override,
    has_admin_elevation_override
FROM get_effective_locality_location($1::int, $2::int)
`

// GetEffectiveLocalityLocation retrieves effective locality location data with hierarchical override resolution
// This is the PRIMARY query for zmanim calculations when user selects a locality
//
// Resolution Priority:
//  1. Publisher override (if publisher_id provided and override exists)
//  2. Admin override (source='admin', system-wide correction)
//  3. Default source (Overture for coordinates, GLO-90 for elevation)
//
// Usage:
//   - publisher_id = NULL: Returns admin override if exists, else default
//   - publisher_id = <id>: Returns publisher override if exists, else admin, else default
func (q *Queries) GetEffectiveLocalityLocation(ctx context.Context, arg GetEffectiveLocalityLocationParams) (GetEffectiveLocalityLocationRow, error) {
	var publisherID *int32
	if arg.PublisherID.Valid {
		publisherID = &arg.PublisherID.Int32
	}

	row := q.db.QueryRow(ctx, getEffectiveLocalityLocation, arg.LocalityID, publisherID)
	var i GetEffectiveLocalityLocationRow
	err := row.Scan(
		&i.LocalityID,
		&i.Latitude,
		&i.Longitude,
		&i.ElevationM,
		&i.Timezone,
		&i.CoordinateSourceID,
		&i.CoordinateSourceKey,
		&i.ElevationSourceID,
		&i.ElevationSourceKey,
		&i.HasPublisherCoordinateOverride,
		&i.HasAdminCoordinateOverride,
		&i.HasPublisherElevationOverride,
		&i.HasAdminElevationOverride,
	)
	return i, err
}

// =============================================================================
// GetLocalityLocationForCalculation - Legacy function (backward compatibility)
// Uses get_locality_location() which now wraps get_effective_locality_location()
// =============================================================================

// GetLocalityLocationForCalculationRow represents the result of get_locality_location() function
type GetLocalityLocationForCalculationRow struct {
	LocalityID            int32   `json:"locality_id"`
	Latitude              float64 `json:"latitude"`
	Longitude             float64 `json:"longitude"`
	ElevationM            int32   `json:"elevation_m"`
	Timezone              string  `json:"timezone"`
	HasCoordinateOverride bool    `json:"has_coordinate_override"`
	HasElevationOverride  bool    `json:"has_elevation_override"`
}

// GetLocalityLocationForCalculationParams holds the parameters for GetLocalityLocationForCalculation
type GetLocalityLocationForCalculationParams struct {
	LocalityID  int32       `json:"locality_id"`
	PublisherID pgtype.Int4 `json:"publisher_id"`
}

const getLocalityLocationForCalculation = `
SELECT
    locality_id,
    latitude,
    longitude,
    elevation_m,
    timezone,
    has_coordinate_override,
    has_elevation_override
FROM get_locality_location($1::int, $2::int)
`

// GetLocalityLocationForCalculation retrieves effective locality location data with optional publisher override
// DEPRECATED: Use GetEffectiveLocalityLocation for new code - provides more detailed override information
//
// This function is maintained for backward compatibility. It now uses the updated
// get_locality_location() which internally calls get_effective_locality_location().
//
// Usage:
//   - publisher_id = NULL: Returns baseline coordinates from geo_localities
//   - publisher_id = <id>: Returns publisher override if exists, else baseline
func (q *Queries) GetLocalityLocationForCalculation(ctx context.Context, arg GetLocalityLocationForCalculationParams) (GetLocalityLocationForCalculationRow, error) {
	var publisherID *int32
	if arg.PublisherID.Valid {
		publisherID = &arg.PublisherID.Int32
	}

	row := q.db.QueryRow(ctx, getLocalityLocationForCalculation, arg.LocalityID, publisherID)
	var i GetLocalityLocationForCalculationRow
	err := row.Scan(
		&i.LocalityID,
		&i.Latitude,
		&i.Longitude,
		&i.ElevationM,
		&i.Timezone,
		&i.HasCoordinateOverride,
		&i.HasElevationOverride,
	)
	return i, err
}
