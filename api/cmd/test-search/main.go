package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	pool, _ := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	defer pool.Close()

	var entityTypes []string = nil
	var countryID *int32 = nil
	var regionID *int32 = nil
	limitVal := int32(5)
	query := "hackney london"

	// Just test exact_matches
	sql := `WITH individual_terms AS (
    SELECT unnest(string_to_array(lower($2), ' ')) AS term
),
exact_matches AS (
    SELECT s.entity_id, s.display_name, s.display_hierarchy, 1 AS tier
    FROM geo_search_index s
    WHERE s.keywords @> (SELECT ARRAY_AGG(term) FROM individual_terms)
      AND ($3::text[] IS NULL OR COALESCE(cardinality($3::text[]), 0) = 0 OR s.entity_type = ANY($3))
      AND ($4::int IS NULL OR s.country_id = $4)
      AND ($5::int IS NULL OR s.region_id = $5)
)
SELECT * FROM exact_matches LIMIT $1`

	rows, err := pool.Query(ctx, sql, limitVal, query, entityTypes, countryID, regionID)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var entityID, tier int32
		var displayName, displayHierarchy string
		err := rows.Scan(&entityID, &displayName, &displayHierarchy, &tier)
		if err != nil {
			fmt.Println("Scan error:", err)
			continue
		}
		fmt.Printf("Found: %d - %s - %s (tier %d)\n", entityID, displayName, displayHierarchy, tier)
		count++
	}
	fmt.Printf("Total: %d results\n", count)
}
