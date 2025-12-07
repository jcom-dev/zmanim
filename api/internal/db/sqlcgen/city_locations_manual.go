// File: city_locations_manual.go
// Purpose: City location queries with publisher override support for zmanim calculations
// Pattern: data-access
// Dependencies: get_city_location() database function (00000000000001_schema.sql)
// Frequency: critical - used for every zmanim calculation with city selection
// Compliance: Check docs/adr/ for pattern rationale
//
// NOTE: This file is manually written because SQLc cannot introspect PostgreSQL
// functions that return TABLE(...). The get_city_location() function signature
// is defined in db/migrations/00000000000001_schema.sql (lines ~1052-1128)

package sqlcgen

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

// GetCityLocationForCalculationRow represents the result of get_city_location() function
type GetCityLocationForCalculationRow struct {
	CityID                int32   `json:"city_id"`
	Latitude              float64 `json:"latitude"`
	Longitude             float64 `json:"longitude"`
	ElevationM            int32   `json:"elevation_m"`
	Timezone              string  `json:"timezone"`
	CoordinateSourceID    int32   `json:"coordinate_source_id"`
	ElevationSourceID     int32   `json:"elevation_source_id"`
	HasCoordinateOverride bool    `json:"has_coordinate_override"`
	HasElevationOverride  bool    `json:"has_elevation_override"`
}

// GetCityLocationForCalculationParams holds the parameters for GetCityLocationForCalculation
type GetCityLocationForCalculationParams struct {
	CityID      int32       `json:"city_id"`
	PublisherID pgtype.Int4 `json:"publisher_id"`
}

const getCityLocationForCalculation = `
SELECT
    city_id,
    latitude,
    longitude,
    elevation_m,
    timezone,
    coordinate_source_id,
    elevation_source_id,
    has_coordinate_override,
    has_elevation_override
FROM get_city_location($1::int, $2::int)
`

// GetCityLocationForCalculation retrieves effective city location data with optional publisher override
// This is the PRIMARY query for zmanim calculations when user selects a city
//
// Usage:
//   - publisher_id = NULL: Returns baseline coordinates from geo_cities
//   - publisher_id = <id>: Returns publisher override if exists, else baseline
func (q *Queries) GetCityLocationForCalculation(ctx context.Context, arg GetCityLocationForCalculationParams) (GetCityLocationForCalculationRow, error) {
	var publisherID *int32
	if arg.PublisherID.Valid {
		publisherID = &arg.PublisherID.Int32
	}

	row := q.db.QueryRow(ctx, getCityLocationForCalculation, arg.CityID, publisherID)
	var i GetCityLocationForCalculationRow
	err := row.Scan(
		&i.CityID,
		&i.Latitude,
		&i.Longitude,
		&i.ElevationM,
		&i.Timezone,
		&i.CoordinateSourceID,
		&i.ElevationSourceID,
		&i.HasCoordinateOverride,
		&i.HasElevationOverride,
	)
	return i, err
}
