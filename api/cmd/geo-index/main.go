// Package main provides the geo-index CLI for building the geo_search_index table.
//
// This command builds the search index using fast Go-based batch processing.
// It pre-computes keyword lookups in memory and uses pgx.CopyFrom for maximum
// insert speed.
//
// Usage:
//
//	geo-index          # Build the search index
//	geo-index --verbose # With debug logging
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim/internal/geo"
	"github.com/spf13/cobra"
)

var (
	dbURL   string
	verbose bool
	pool    *pgxpool.Pool
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "geo-index",
		Short: "Build the geo_search_index table",
		Long: `Build the geo_search_index table using fast Go-based batch processing.

This command:
  1. Pre-loads all entity keywords from geo_names into memory
  2. Pre-computes region and locality ancestry chains
  3. Processes localities in batches using pgx.CopyFrom
  4. Builds keywords including all multi-language names and hierarchy context

The index enables fast geographic search with:
  - Exact keyword matching (e.g., "London")
  - Multi-language support (English, Hebrew, Arabic, etc.)
  - Context matching (e.g., "London England" vs "London Ontario")
  - Population-ranked results`,
		RunE: runIndex,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			// Setup logging
			level := slog.LevelInfo
			if verbose {
				level = slog.LevelDebug
			}
			logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
			slog.SetDefault(logger)

			// Get database URL
			if dbURL == "" {
				dbURL = os.Getenv("DATABASE_URL")
				if dbURL == "" {
					return fmt.Errorf("DATABASE_URL environment variable required")
				}
			}

			// Connect to database
			ctx := context.Background()
			config, err := pgxpool.ParseConfig(dbURL)
			if err != nil {
				return fmt.Errorf("parse database URL: %w", err)
			}

			config.MaxConns = 20
			config.MinConns = 5

			pool, err = pgxpool.NewWithConfig(ctx, config)
			if err != nil {
				return fmt.Errorf("connect to database: %w", err)
			}

			slog.Info("database connection established", "max_conns", config.MaxConns)
			return nil
		},
		PersistentPostRunE: func(cmd *cobra.Command, args []string) error {
			if pool != nil {
				pool.Close()
			}
			return nil
		},
	}

	rootCmd.PersistentFlags().StringVar(&dbURL, "db", "", "Database URL (defaults to DATABASE_URL env)")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Verbose logging")

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func runIndex(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	start := time.Now()

	fmt.Println()
	fmt.Println("Geographic Search Index Builder")
	fmt.Println("================================")
	fmt.Println()

	// Step 1: Ensure required indexes exist on geo_names
	fmt.Println("[1/18] Ensuring required indexes on geo_names...")
	stepStart := time.Now()
	if err := ensureGeoNamesIndexes(ctx); err != nil {
		return fmt.Errorf("ensure geo_names indexes: %w", err)
	}
	fmt.Printf("      Complete in %s\n\n", time.Since(stepStart))

	// Step 2: Drop and recreate table (much faster than TRUNCATE + DROP INDEX)
	fmt.Println("[2/18] Dropping and recreating geo_search_index table...")
	stepStart = time.Now()
	if err := recreateSearchIndexTable(ctx); err != nil {
		return fmt.Errorf("recreate search index table: %w", err)
	}
	fmt.Printf("      Complete in %s\n\n", time.Since(stepStart))

	// Step 3: Load entity keywords from geo_names
	fmt.Println("[3/18] Loading entity keywords from geo_names...")
	stepStart = time.Now()
	entityKeywords, err := loadEntityKeywords(ctx)
	if err != nil {
		return fmt.Errorf("load entity keywords: %w", err)
	}
	fmt.Printf("      Loaded keywords for %d entities in %s\n\n",
		countEntityKeywords(entityKeywords), time.Since(stepStart))

	// Step 3: Load region ancestry (parent chains)
	fmt.Println("[4/18] Loading region ancestry...")
	stepStart = time.Now()
	regionAncestry, err := loadRegionAncestry(ctx)
	if err != nil {
		return fmt.Errorf("load region ancestry: %w", err)
	}
	fmt.Printf("      Loaded %d region parent relationships in %s\n\n",
		len(regionAncestry), time.Since(stepStart))

	// Step 4: Load unified overture_id map (all entity types)
	fmt.Println("[5/18] Loading unified overture_id map...")
	stepStart = time.Now()
	overtureMap, err := loadOvertureIDMap(ctx)
	if err != nil {
		return fmt.Errorf("load overture map: %w", err)
	}
	fmt.Printf("      Loaded %d overture_id mappings in %s\n\n",
		len(overtureMap), time.Since(stepStart))

	// Step 5: Load locality parents (resolved to any entity type)
	fmt.Println("[6/18] Loading locality parents...")
	stepStart = time.Now()
	localityParents, err := loadLocalityParents(ctx, overtureMap)
	if err != nil {
		return fmt.Errorf("load locality parents: %w", err)
	}
	fmt.Printf("      Loaded %d locality parent relationships in %s\n\n",
		len(localityParents), time.Since(stepStart))

	// Step 6: Load locality ancestry (locality-to-locality chains for neighborhoods, boroughs, etc.)
	fmt.Println("[7/18] Loading locality ancestry...")
	stepStart = time.Now()
	localityAncestry, err := loadLocalityAncestry(ctx)
	if err != nil {
		return fmt.Errorf("load locality ancestry: %w", err)
	}
	fmt.Printf("      Loaded %d locality-to-locality ancestry chains in %s\n\n",
		len(localityAncestry), time.Since(stepStart))

	// Step 7: Load continent info
	fmt.Println("[8/18] Loading continent info...")
	stepStart = time.Now()
	continentInfo, err := loadContinentInfo(ctx)
	if err != nil {
		return fmt.Errorf("load continent info: %w", err)
	}
	fmt.Printf("      Loaded %d continents in %s\n\n", len(continentInfo), time.Since(stepStart))

	// Step 8: Load country info (code, continent_id)
	fmt.Println("[9/18] Loading country info...")
	stepStart = time.Now()
	countryInfo, err := loadCountryInfo(ctx)
	if err != nil {
		return fmt.Errorf("load country info: %w", err)
	}
	fmt.Printf("      Loaded %d countries in %s\n\n", len(countryInfo), time.Since(stepStart))

	// Step 9: Load region info (country_id, continent_id)
	fmt.Println("[10/18] Loading region info...")
	stepStart = time.Now()
	regionInfo, err := loadRegionInfo(ctx)
	if err != nil {
		return fmt.Errorf("load region info: %w", err)
	}
	fmt.Printf("      Loaded %d regions in %s\n\n", len(regionInfo), time.Since(stepStart))

	// Step 10: Load locality info (id -> name mapping for hierarchy building)
	fmt.Println("[11/18] Loading locality info for hierarchy...")
	stepStart = time.Now()
	localityInfo, err := loadLocalityInfo(ctx)
	if err != nil {
		return fmt.Errorf("load locality info: %w", err)
	}
	fmt.Printf("      Loaded %d localities in %s\n\n", len(localityInfo), time.Since(stepStart))

	// Step 11: Index continents (top level of hierarchy)
	fmt.Println("[12/18] Indexing continents...")
	stepStart = time.Now()
	continentCount, err := populateContinentIndex(ctx, continentInfo)
	if err != nil {
		return fmt.Errorf("populate continent index: %w", err)
	}
	fmt.Printf("      Indexed %d continents in %s\n\n", continentCount, time.Since(stepStart))

	// Step 12: Index countries
	fmt.Println("[13/18] Indexing countries...")
	stepStart = time.Now()
	countryCount, err := populateCountryIndex(ctx, entityKeywords, countryInfo, continentInfo)
	if err != nil {
		return fmt.Errorf("populate country index: %w", err)
	}
	fmt.Printf("      Indexed %d countries in %s\n\n", countryCount, time.Since(stepStart))

	// Step 13: Index regions
	fmt.Println("[14/18] Indexing regions...")
	stepStart = time.Now()
	regionCount, err := populateRegionIndex(ctx, entityKeywords, regionAncestry, countryInfo, regionInfo, continentInfo)
	if err != nil {
		return fmt.Errorf("populate region index: %w", err)
	}
	fmt.Printf("      Indexed %d regions in %s\n\n", regionCount, time.Since(stepStart))

	// Step 14: Index localities (bulk of the work)
	fmt.Println("[15/18] Indexing localities...")
	stepStart = time.Now()
	localityCount, err := populateLocalityIndex(ctx, entityKeywords, regionAncestry, localityAncestry, localityParents, countryInfo, regionInfo, localityInfo, continentInfo)
	if err != nil {
		return fmt.Errorf("populate locality index: %w", err)
	}
	fmt.Printf("      Indexed %d localities in %s\n\n", localityCount, time.Since(stepStart))

	// Step 15: Update region populations (sum of descendant localities)
	// This must happen AFTER localities are indexed since we use ancestor_region_ids
	fmt.Println("[16/18] Updating region populations...")
	stepStart = time.Now()
	if err := updateRegionPopulations(ctx); err != nil {
		return fmt.Errorf("update region populations: %w", err)
	}
	fmt.Printf("      Complete in %s\n\n", time.Since(stepStart))

	// Step 16: Compute descendant counts and direct child counts (in-memory for speed)
	fmt.Println("[17/18] Computing descendant and child counts...")
	stepStart = time.Now()
	if err := computeDescendantAndChildCounts(ctx); err != nil {
		return fmt.Errorf("compute descendant and child counts: %w", err)
	}
	fmt.Printf("      Complete in %s\n\n", time.Since(stepStart))

	// Step 17: Create indexes
	// Note: maintenance_work_mem and max_parallel_maintenance_workers are set in postgresql-custom.conf
	// Uses shared index definitions from internal/geo package (single source of truth)
	fmt.Println("[18/18] Creating indexes...")
	stepStart = time.Now()

	indexesToCreate := geo.SearchIndexes()

	for i, idx := range indexesToCreate {
		fmt.Printf("      [%d/%d] Creating %s (est: %s)...\n", i+1, len(indexesToCreate), idx.Name, idx.Estimate)
		idxStart := time.Now()
		_, err = pool.Exec(ctx, idx.SQL)
		if err != nil {
			return fmt.Errorf("create index %s: %w", idx.Name, err)
		}
		fmt.Printf("            Done in %s\n", time.Since(idxStart))
	}
	fmt.Printf("      All indexes created in %s\n\n", time.Since(stepStart))

	// Analyze table for query planner
	fmt.Println("Analyzing table...")
	stepStart = time.Now()
	_, err = pool.Exec(ctx, "ANALYZE geo_search_index")
	if err != nil {
		slog.Warn("failed to analyze table", "error", err)
	}
	fmt.Printf("      Complete in %s\n\n", time.Since(stepStart))

	// Final stats
	fmt.Println("================================")
	fmt.Println("Index Build Complete!")
	fmt.Println("================================")
	fmt.Printf("Continents indexed: %d\n", continentCount)
	fmt.Printf("Countries indexed:  %d\n", countryCount)
	fmt.Printf("Regions indexed:    %d\n", regionCount)
	fmt.Printf("Localities indexed: %d\n", localityCount)
	fmt.Printf("Total entries:      %d\n", continentCount+countryCount+regionCount+localityCount)
	fmt.Printf("Total duration:     %s\n", time.Since(start))
	fmt.Println()

	return nil
}

// Priority languages for keyword indexing (reduces index size dramatically)
// These are the most commonly searched languages for Jewish communities
var priorityLanguages = map[string]bool{
	"en": true, // English
	"es": true, // Spanish
	"fr": true, // French
	"it": true, // Italian
	"he": true, // Hebrew
	"yi": true, // Yiddish
}

// EntityNames holds both keywords (for search) and display names (for UI)
type EntityNames struct {
	Keywords     []string          // Lowercased for search
	DisplayNames map[string]string // language_code -> name for UI display
}

// loadEntityKeywords loads names from geo_names into memory (priority languages only)
// Returns map[entity_type][entity_id] -> EntityNames (keywords + display names)
func loadEntityKeywords(ctx context.Context) (map[string]map[int32]*EntityNames, error) {
	result := map[string]map[int32]*EntityNames{
		"locality": make(map[int32]*EntityNames),
		"region":   make(map[int32]*EntityNames),
		"country":  make(map[int32]*EntityNames),
	}

	// Load priority language names for keywords and display_names
	rows, err := pool.Query(ctx, `
		SELECT entity_type, entity_id, language_code, name
		FROM geo_names
		WHERE name IS NOT NULL AND name != ''
		  AND language_code IN ('en', 'es', 'fr', 'it', 'he', 'yi')
		ORDER BY entity_type, entity_id, language_code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var entityType string
		var entityID int32
		var langCode, name string
		if err := rows.Scan(&entityType, &entityID, &langCode, &name); err != nil {
			return nil, err
		}

		m, ok := result[entityType]
		if !ok {
			continue
		}

		en := m[entityID]
		if en == nil {
			en = &EntityNames{
				Keywords:     make([]string, 0, 10),
				DisplayNames: make(map[string]string),
			}
			m[entityID] = en
		}

		// Add to keywords (lowercased, deduplicated later)
		en.Keywords = append(en.Keywords, strings.ToLower(name))

		// Store display name (first name per language wins)
		if _, exists := en.DisplayNames[langCode]; !exists {
			en.DisplayNames[langCode] = name
		}
	}

	return result, rows.Err()
}

func countEntityKeywords(m map[string]map[int32]*EntityNames) int {
	count := 0
	for _, sub := range m {
		count += len(sub)
	}
	return count
}

// displayNamesToJSON converts a map of language->name to JSONB bytes
func displayNamesToJSON(names map[string]string) []byte {
	if len(names) == 0 {
		return nil
	}
	data, err := json.Marshal(names)
	if err != nil {
		return nil
	}
	return data
}

// HierarchyEntry represents one level in the hierarchy path
type HierarchyEntry struct {
	Type string `json:"type"`
	ID   int32  `json:"id"`
	Name string `json:"name"`
}

// hierarchyPathToJSON converts hierarchy entries to JSONB bytes
func hierarchyPathToJSON(entries []HierarchyEntry) []byte {
	if len(entries) == 0 {
		return nil
	}
	data, err := json.Marshal(entries)
	if err != nil {
		return nil
	}
	return data
}

// loadRegionAncestry loads parent_region_id relationships and builds ancestry chains
// Returns map[region_id] -> []ancestor_region_ids (parent, grandparent, etc.)
func loadRegionAncestry(ctx context.Context) (map[int32][]int32, error) {
	// First load direct parent relationships
	parents := make(map[int32]int32)

	rows, err := pool.Query(ctx, `
		SELECT id, parent_region_id
		FROM geo_regions
		WHERE parent_region_id IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id, parentID int32
		if err := rows.Scan(&id, &parentID); err != nil {
			return nil, err
		}
		parents[id] = parentID
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Build ancestry chains by walking up the tree
	ancestry := make(map[int32][]int32)
	for regionID := range parents {
		var ancestors []int32
		current := regionID
		visited := make(map[int32]bool) // Prevent infinite loops

		for {
			parentID, hasParent := parents[current]
			if !hasParent || visited[parentID] {
				break
			}
			visited[parentID] = true
			ancestors = append(ancestors, parentID)
			current = parentID
		}

		if len(ancestors) > 0 {
			ancestry[regionID] = ancestors
		}
	}

	return ancestry, nil
}

// EntityRef represents a reference to any entity type (locality, region, country)
type EntityRef struct {
	Type string // "locality", "region", "country"
	ID   int32
}

// loadOvertureIDMap builds a unified overture_id -> EntityRef map for all entity types
// This allows resolving parent_overture_id to any entity type (locality, region, or country)
func loadOvertureIDMap(ctx context.Context) (map[string]EntityRef, error) {
	result := make(map[string]EntityRef)

	// Load localities
	rows, err := pool.Query(ctx, `SELECT id, overture_id FROM geo_localities WHERE overture_id IS NOT NULL`)
	if err != nil {
		return nil, fmt.Errorf("query localities: %w", err)
	}
	for rows.Next() {
		var id int32
		var overtureID string
		if err := rows.Scan(&id, &overtureID); err != nil {
			rows.Close()
			return nil, err
		}
		result[overtureID] = EntityRef{Type: "locality", ID: id}
	}
	rows.Close()

	// Load regions
	rows, err = pool.Query(ctx, `SELECT id, overture_id FROM geo_regions WHERE overture_id IS NOT NULL`)
	if err != nil {
		return nil, fmt.Errorf("query regions: %w", err)
	}
	for rows.Next() {
		var id int32
		var overtureID string
		if err := rows.Scan(&id, &overtureID); err != nil {
			rows.Close()
			return nil, err
		}
		result[overtureID] = EntityRef{Type: "region", ID: id}
	}
	rows.Close()

	// Load countries
	rows, err = pool.Query(ctx, `SELECT id, overture_id FROM geo_countries WHERE overture_id IS NOT NULL`)
	if err != nil {
		return nil, fmt.Errorf("query countries: %w", err)
	}
	for rows.Next() {
		var id int16
		var overtureID string
		if err := rows.Scan(&id, &overtureID); err != nil {
			rows.Close()
			return nil, err
		}
		result[overtureID] = EntityRef{Type: "country", ID: int32(id)}
	}
	rows.Close()

	return result, nil
}

// ParentInfo holds the resolved parent information for a locality
type ParentInfo struct {
	ParentType       string // "locality", "region", or "country"
	ParentID         int32
	InheritedRegion  *int32 // Set if parent is a region (or locality within a region)
	ParentOvertureID string // Original overture ID for ancestry chain walking
}

// loadLocalityParents loads parent_overture_id and resolves to actual parent entity
// Returns map[locality_id] -> ParentInfo
func loadLocalityParents(ctx context.Context, overtureMap map[string]EntityRef) (map[int32]ParentInfo, error) {
	result := make(map[int32]ParentInfo)

	rows, err := pool.Query(ctx, `
		SELECT id, parent_overture_id
		FROM geo_localities
		WHERE parent_overture_id IS NOT NULL AND parent_overture_id != ''
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int32
		var parentOvertureID string
		if err := rows.Scan(&id, &parentOvertureID); err != nil {
			return nil, err
		}

		if ref, ok := overtureMap[parentOvertureID]; ok {
			info := ParentInfo{
				ParentType:       ref.Type,
				ParentID:         ref.ID,
				ParentOvertureID: parentOvertureID,
			}
			// If parent is a region, set inherited_region_id
			if ref.Type == "region" {
				info.InheritedRegion = &ref.ID
			}
			result[id] = info
		}
	}

	return result, rows.Err()
}

// loadLocalityAncestry loads parent_overture_id relationships and builds ancestry chains
// Returns map[locality_id] -> []ancestor_locality_ids (parent, grandparent, etc.)
// Note: This only tracks locality-to-locality ancestry for building locality hierarchy chains
func loadLocalityAncestry(ctx context.Context) (map[int32][]int32, error) {
	// Load overture_id -> id mapping for localities only
	overtureToID := make(map[string]int32)
	// Load id -> parent_overture_id mapping
	parentOverture := make(map[int32]string)

	rows, err := pool.Query(ctx, `
		SELECT id, overture_id, parent_overture_id
		FROM geo_localities
		WHERE overture_id IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int32
		var overtureID string
		var parentOvertureID *string
		if err := rows.Scan(&id, &overtureID, &parentOvertureID); err != nil {
			return nil, err
		}
		overtureToID[overtureID] = id
		if parentOvertureID != nil && *parentOvertureID != "" {
			parentOverture[id] = *parentOvertureID
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Convert to parent ID relationships (locality-to-locality only)
	parents := make(map[int32]int32)
	for id, parentOID := range parentOverture {
		if parentID, ok := overtureToID[parentOID]; ok {
			parents[id] = parentID
		}
	}

	// Build ancestry chains by walking up the tree (locality parents only)
	ancestry := make(map[int32][]int32)
	for localityID := range parents {
		var ancestors []int32
		current := localityID
		visited := make(map[int32]bool) // Prevent infinite loops

		for {
			parentID, hasParent := parents[current]
			if !hasParent || visited[parentID] {
				break
			}
			visited[parentID] = true
			ancestors = append(ancestors, parentID)
			current = parentID
		}

		if len(ancestors) > 0 {
			ancestry[localityID] = ancestors
		}
	}

	return ancestry, nil
}

// CountryInfo holds country metadata for index building
type CountryInfo struct {
	Code        string
	ContinentID int16
	Name        string // English name for display hierarchy
	Latitude    *float64
	Longitude   *float64
}

// loadCountryInfo loads country code and continent_id for all countries
// Also loads centroid coordinates from boundary polygon if available
func loadCountryInfo(ctx context.Context) (map[int16]CountryInfo, error) {
	result := make(map[int16]CountryInfo)

	rows, err := pool.Query(ctx, `
		SELECT c.id, c.code, c.continent_id,
			COALESCE(
				(SELECT n.name FROM geo_names n
				 WHERE n.entity_type = 'country' AND n.entity_id = c.id AND n.language_code = 'en'
				 ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 ELSE 3 END
				 LIMIT 1),
				c.name
			) as display_name,
			ST_Y(ST_Centroid(c.boundary)) as latitude,
			ST_X(ST_Centroid(c.boundary)) as longitude
		FROM geo_countries c
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int16
		var code string
		var continentID int16
		var name string
		var latitude, longitude *float64
		if err := rows.Scan(&id, &code, &continentID, &name, &latitude, &longitude); err != nil {
			return nil, err
		}
		result[id] = CountryInfo{Code: code, ContinentID: continentID, Name: name, Latitude: latitude, Longitude: longitude}
	}

	return result, rows.Err()
}

// RegionInfo holds region metadata for index building
type RegionInfo struct {
	CountryID   int16
	ContinentID int16
	Name        string // English name for display hierarchy
	Latitude    *float64
	Longitude   *float64
}

// loadRegionInfo loads country_id and continent_id for all regions
// Also loads centroid coordinates from boundary polygon if available
func loadRegionInfo(ctx context.Context) (map[int32]RegionInfo, error) {
	result := make(map[int32]RegionInfo)

	rows, err := pool.Query(ctx, `
		SELECT r.id, r.country_id, COALESCE(r.continent_id, c.continent_id) as continent_id,
			COALESCE(
				(SELECT n.name FROM geo_names n
				 WHERE n.entity_type = 'region' AND n.entity_id = r.id AND n.language_code = 'en'
				 ORDER BY CASE n.name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 ELSE 3 END
				 LIMIT 1),
				r.name
			) as display_name,
			ST_Y(ST_Centroid(r.boundary)) as latitude,
			ST_X(ST_Centroid(r.boundary)) as longitude
		FROM geo_regions r
		JOIN geo_countries c ON r.country_id = c.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int32
		var countryID, continentID int16
		var name string
		var latitude, longitude *float64
		if err := rows.Scan(&id, &countryID, &continentID, &name, &latitude, &longitude); err != nil {
			return nil, err
		}
		result[id] = RegionInfo{CountryID: countryID, ContinentID: continentID, Name: name, Latitude: latitude, Longitude: longitude}
	}

	return result, rows.Err()
}

// LocalityInfo holds basic info for building hierarchy chains
type LocalityInfo struct {
	Name             string
	ParentOvertureID *string
	CountryID        int16
}

// loadLocalityInfo loads name and parent info for all localities (for hierarchy building)
func loadLocalityInfo(ctx context.Context) (map[int32]LocalityInfo, error) {
	result := make(map[int32]LocalityInfo)

	rows, err := pool.Query(ctx, `
		SELECT id, name, parent_overture_id, country_id
		FROM geo_localities
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int32
		var name string
		var parentOvertureID *string
		var countryID int16
		if err := rows.Scan(&id, &name, &parentOvertureID, &countryID); err != nil {
			return nil, err
		}
		result[id] = LocalityInfo{Name: name, ParentOvertureID: parentOvertureID, CountryID: countryID}
	}

	return result, rows.Err()
}

// ContinentInfo holds continent metadata for index building
type ContinentInfo struct {
	ID   int16
	Code string
	Name string
}

// loadContinentInfo loads all continent info for index building
func loadContinentInfo(ctx context.Context) (map[int16]ContinentInfo, error) {
	result := make(map[int16]ContinentInfo)

	rows, err := pool.Query(ctx, `
		SELECT id, code, name FROM geo_continents WHERE code != 'XX'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var id int16
		var code, name string
		if err := rows.Scan(&id, &code, &name); err != nil {
			return nil, err
		}
		result[id] = ContinentInfo{ID: id, Code: code, Name: name}
	}

	return result, rows.Err()
}

// populateContinentIndex adds all continents to the search index
func populateContinentIndex(
	ctx context.Context,
	continentInfo map[int16]ContinentInfo,
) (int64, error) {
	columns := []string{
		"entity_type", "entity_id", "entity_subtype", "locality_id", "keywords",
		"display_name", "display_hierarchy", "display_names",
		"locality_type_id", "direct_parent_type", "direct_parent_id", "inherited_region_id",
		"hierarchy_path", "country_id", "continent_id", "country_code",
		"population", "latitude", "longitude", "timezone",
	}

	// Query all continents with aggregated population from their countries' localities
	rows, err := pool.Query(ctx, `
		WITH continent_populations AS (
			SELECT c.continent_id, SUM(l.population) as total_pop
			FROM geo_countries c
			JOIN geo_localities l ON l.country_id = c.id
			GROUP BY c.continent_id
		)
		SELECT ct.id, ct.code, ct.name, COALESCE(cp.total_pop, 0) as population
		FROM geo_continents ct
		LEFT JOIN continent_populations cp ON cp.continent_id = ct.id
		WHERE ct.code != 'XX'
		ORDER BY ct.name
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var indexRows [][]any
	for rows.Next() {
		var id int16
		var code, name string
		var population int64
		if err := rows.Scan(&id, &code, &name, &population); err != nil {
			return 0, err
		}

		// Build keywords: continent name + code
		keywords := []string{strings.ToLower(name), strings.ToLower(code)}

		// Build hierarchy_path: just the continent itself
		hierarchyPath := hierarchyPathToJSON([]HierarchyEntry{
			{Type: "continent", ID: int32(id), Name: name},
		})

		indexRows = append(indexRows, []any{
			"continent",   // entity_type
			int32(id),     // entity_id
			nil,           // entity_subtype (continents have no subtype)
			nil,           // locality_id
			keywords,      // keywords
			name,          // display_name
			name,          // display_hierarchy (just continent name)
			nil,           // display_names (no multi-language for continents)
			nil,           // locality_type_id
			nil,           // direct_parent_type (continents are top-level)
			nil,           // direct_parent_id
			nil,           // inherited_region_id
			hierarchyPath, // hierarchy_path
			nil,           // country_id
			id,            // continent_id
			nil,           // country_code
			population,    // population
			nil,           // latitude (no single point for continent)
			nil,           // longitude
			nil,           // timezone
		})
	}

	if len(indexRows) == 0 {
		return 0, nil
	}

	_, err = pool.CopyFrom(ctx, pgx.Identifier{"geo_search_index"}, columns, pgx.CopyFromRows(indexRows))
	if err != nil {
		return 0, err
	}

	return int64(len(indexRows)), nil
}

// populateCountryIndex adds all countries to the search index
func populateCountryIndex(
	ctx context.Context,
	entityKeywords map[string]map[int32]*EntityNames,
	countryInfo map[int16]CountryInfo,
	continentInfo map[int16]ContinentInfo,
) (int64, error) {
	columns := []string{
		"entity_type", "entity_id", "entity_subtype", "locality_id", "keywords",
		"display_name", "display_hierarchy", "display_names",
		"locality_type_id", "direct_parent_type", "direct_parent_id", "inherited_region_id",
		"hierarchy_path", "country_id", "continent_id", "country_code",
		"population", "latitude", "longitude", "timezone",
	}

	// Query all countries with pre-aggregated population (single scan of geo_localities)
	rows, err := pool.Query(ctx, `
		WITH country_populations AS (
			SELECT country_id, SUM(population) as total_pop
			FROM geo_localities
			GROUP BY country_id
		),
		country_names AS (
			SELECT DISTINCT ON (entity_id)
				entity_id, name
			FROM geo_names
			WHERE entity_type = 'country' AND language_code = 'en'
			ORDER BY entity_id, CASE name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 ELSE 3 END
		)
		SELECT c.id, c.code, c.continent_id,
			COALESCE(cn.name, c.name) as display_name,
			cp.total_pop as population
		FROM geo_countries c
		LEFT JOIN country_populations cp ON cp.country_id = c.id
		LEFT JOIN country_names cn ON cn.entity_id = c.id
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var indexRows [][]any
	for rows.Next() {
		var id int16
		var code string
		var continentID int16
		var name string
		var population *int64
		if err := rows.Scan(&id, &code, &continentID, &name, &population); err != nil {
			return 0, err
		}

		// Build keywords: country name + all language variants + ISO code + continent name
		keywords := []string{strings.ToLower(name), strings.ToLower(code)}
		var displayNames map[string]string
		if en := entityKeywords["country"][int32(id)]; en != nil {
			keywords = append(keywords, en.Keywords...)
			displayNames = en.DisplayNames
		}
		// Add continent name to keywords for searchability
		if cont, ok := continentInfo[continentID]; ok {
			keywords = append(keywords, strings.ToLower(cont.Name))
		}
		keywords = uniqueStrings(keywords)

		// Get continent info for hierarchy
		cont := continentInfo[continentID]

		// Build hierarchy_path: country -> continent
		hierarchyPath := hierarchyPathToJSON([]HierarchyEntry{
			{Type: "country", ID: int32(id), Name: name},
			{Type: "continent", ID: int32(cont.ID), Name: cont.Name},
		})

		// Build display_hierarchy: "Country, Continent"
		displayHierarchy := name
		if cont.Name != "" {
			displayHierarchy = name + ", " + cont.Name
		}

		// Get centroid coordinates from country info
		cInfo := countryInfo[id]

		indexRows = append(indexRows, []any{
			"country",                        // entity_type
			int32(id),                        // entity_id
			nil,                              // entity_subtype (countries have no subtype)
			nil,                              // locality_id
			keywords,                         // keywords
			name,                             // display_name
			displayHierarchy,                 // display_hierarchy (Country, Continent)
			displayNamesToJSON(displayNames), // display_names
			nil,                              // locality_type_id
			"continent",                      // direct_parent_type
			int32(continentID),               // direct_parent_id
			nil,                              // inherited_region_id
			hierarchyPath,                    // hierarchy_path
			id,                               // country_id
			continentID,                      // continent_id
			code,                             // country_code
			population,                       // population
			cInfo.Latitude,                   // latitude (from boundary centroid)
			cInfo.Longitude,                  // longitude (from boundary centroid)
			nil,                              // timezone
		})
	}

	if len(indexRows) == 0 {
		return 0, nil
	}

	_, err = pool.CopyFrom(ctx, pgx.Identifier{"geo_search_index"}, columns, pgx.CopyFromRows(indexRows))
	if err != nil {
		return 0, err
	}

	return int64(len(indexRows)), nil
}

// populateRegionIndex adds all regions to the search index
// Note: Region populations are set to NULL here and updated AFTER localities are indexed
// via updateRegionPopulations() which calculates actual sum of descendant localities.
func populateRegionIndex(
	ctx context.Context,
	entityKeywords map[string]map[int32]*EntityNames,
	regionAncestry map[int32][]int32,
	countryInfo map[int16]CountryInfo,
	regionInfo map[int32]RegionInfo,
	continentInfo map[int16]ContinentInfo,
) (int64, error) {
	columns := []string{
		"entity_type", "entity_id", "entity_subtype", "locality_id", "keywords",
		"display_name", "display_hierarchy", "display_names",
		"locality_type_id", "direct_parent_type", "direct_parent_id", "inherited_region_id",
		"hierarchy_path", "country_id", "continent_id", "country_code",
		"population", "latitude", "longitude", "timezone", "ancestor_region_ids",
	}

	// Query all regions (population will be calculated AFTER localities are indexed)
	// This fixes the bug where all regions showed country population instead of their own
	rows, err := pool.Query(ctx, `
		WITH region_names AS (
			SELECT DISTINCT ON (entity_id)
				entity_id, name
			FROM geo_names
			WHERE entity_type = 'region' AND language_code = 'en'
			ORDER BY entity_id, CASE name_type WHEN 'common' THEN 1 WHEN 'official' THEN 2 ELSE 3 END
		)
		SELECT r.id, r.country_id, COALESCE(r.continent_id, c.continent_id) as continent_id,
			r.parent_region_id,
			COALESCE(rn.name, r.name) as display_name,
			rt.code as region_type_code
		FROM geo_regions r
		JOIN geo_countries c ON r.country_id = c.id
		LEFT JOIN geo_region_types rt ON r.region_type_id = rt.id
		LEFT JOIN region_names rn ON rn.entity_id = r.id
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var indexRows [][]any
	for rows.Next() {
		var id int32
		var countryID, continentID int16
		var parentRegionID *int32
		var name string
		var regionTypeCode *string
		if err := rows.Scan(&id, &countryID, &continentID, &parentRegionID, &name, &regionTypeCode); err != nil {
			return 0, err
		}

		// Build keywords: region name + all language variants + country names + continent
		keywords := []string{strings.ToLower(name)}
		var displayNames map[string]string
		if en := entityKeywords["region"][id]; en != nil {
			keywords = append(keywords, en.Keywords...)
			displayNames = en.DisplayNames
		}
		// Add ancestor region names
		if ancestors := regionAncestry[id]; ancestors != nil {
			for _, rid := range ancestors {
				if en := entityKeywords["region"][rid]; en != nil {
					keywords = append(keywords, en.Keywords...)
				}
			}
		}
		// Add country names
		cInfo := countryInfo[countryID]
		keywords = append(keywords, strings.ToLower(cInfo.Code))
		if en := entityKeywords["country"][int32(countryID)]; en != nil {
			keywords = append(keywords, en.Keywords...)
		}
		// Add continent name
		cont := continentInfo[continentID]
		keywords = append(keywords, strings.ToLower(cont.Name))
		keywords = uniqueStrings(keywords)

		// Build hierarchy: "Region, Country, Continent"
		displayHierarchy := name + ", " + cInfo.Name + ", " + cont.Name

		// Determine direct_parent_type and direct_parent_id
		var directParentType *string
		var directParentID *int32
		if parentRegionID != nil {
			t := "region"
			directParentType = &t
			directParentID = parentRegionID
		} else {
			// Top-level region - parent is the country
			t := "country"
			directParentType = &t
			cid := int32(countryID)
			directParentID = &cid
		}

		// Build hierarchy_path: region -> (parent regions) -> country -> continent
		var hierarchyEntries []HierarchyEntry
		hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "region", ID: id, Name: name})
		if ancestors := regionAncestry[id]; ancestors != nil {
			for _, rid := range ancestors {
				if rInfo, ok := regionInfo[rid]; ok {
					hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "region", ID: rid, Name: rInfo.Name})
				}
			}
		}
		hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "country", ID: int32(countryID), Name: cInfo.Name})
		hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "continent", ID: int32(cont.ID), Name: cont.Name})

		// Get centroid coordinates from region info
		currentRegionInfo := regionInfo[id]

		// Build ancestor_region_ids: self + all ancestor regions
		ancestorRegionIDs := []int32{id}
		if ancestors := regionAncestry[id]; ancestors != nil {
			ancestorRegionIDs = append(ancestorRegionIDs, ancestors...)
		}

		indexRows = append(indexRows, []any{
			"region",                              // entity_type
			id,                                    // entity_id
			regionTypeCode,                        // entity_subtype (state/county/localadmin)
			nil,                                   // locality_id
			keywords,                              // keywords
			name,                                  // display_name
			displayHierarchy,                      // display_hierarchy
			displayNamesToJSON(displayNames),      // display_names
			nil,                                   // locality_type_id
			directParentType,                      // direct_parent_type
			directParentID,                        // direct_parent_id
			id,                                    // inherited_region_id (self-reference for regions)
			hierarchyPathToJSON(hierarchyEntries), // hierarchy_path
			countryID,                             // country_id
			continentID,                           // continent_id
			cInfo.Code,                            // country_code
			nil,                                   // population (updated after localities indexed)
			currentRegionInfo.Latitude,            // latitude (from boundary centroid)
			currentRegionInfo.Longitude,           // longitude (from boundary centroid)
			nil,                                   // timezone
			ancestorRegionIDs,                     // ancestor_region_ids
		})
	}

	if len(indexRows) == 0 {
		return 0, nil
	}

	_, err = pool.CopyFrom(ctx, pgx.Identifier{"geo_search_index"}, columns, pgx.CopyFromRows(indexRows))
	if err != nil {
		return 0, err
	}

	return int64(len(indexRows)), nil
}

// populateLocalityIndex processes localities in batches and inserts into geo_search_index
// Uses cursor-based pagination (WHERE id > last_id) for O(1) batch fetching instead of OFFSET
func populateLocalityIndex(
	ctx context.Context,
	entityKeywords map[string]map[int32]*EntityNames,
	regionAncestry map[int32][]int32,
	localityAncestry map[int32][]int32,
	localityParents map[int32]ParentInfo,
	countryInfo map[int16]CountryInfo,
	regionInfo map[int32]RegionInfo,
	localityInfo map[int32]LocalityInfo,
	continentInfo map[int16]ContinentInfo,
) (int64, error) {
	const batchSize = 250000 // Large batches for fewer round-trips
	var totalCount int64
	var lastID int32 = 0
	startTime := time.Now()

	// Get total count for progress reporting
	var totalLocalities int64
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_localities").Scan(&totalLocalities)
	fmt.Printf("      Total localities to index: %d\n", totalLocalities)

	columns := []string{
		"entity_type", "entity_id", "entity_subtype", "locality_id", "keywords",
		"display_name", "display_hierarchy", "display_names",
		"locality_type_id", "direct_parent_type", "direct_parent_id", "inherited_region_id",
		"hierarchy_path", "country_id", "continent_id", "country_code",
		"population", "latitude", "longitude", "timezone", "ancestor_region_ids",
	}

	for {
		// Fetch batch using cursor-based pagination (O(1) instead of O(n) with OFFSET)
		// Coordinates from geo_locality_locations with priority: admin > default
		// Note: geo_localities doesn't have region_id - localities are linked via parent_overture_id
		rows, err := pool.Query(ctx, `
			WITH best_coords AS (
				SELECT DISTINCT ON (ll.locality_id)
					ll.locality_id,
					ll.latitude,
					ll.longitude
				FROM geo_locality_locations ll
				JOIN geo_data_sources ds ON ds.id = ll.source_id AND ds.is_active = true
				WHERE ll.publisher_id IS NULL
				ORDER BY ll.locality_id,
						 CASE ds.key WHEN 'admin' THEN 1 ELSE 2 END,
						 ds.priority
			)
			SELECT l.id, l.name, l.name_ascii, l.locality_type_id,
			       l.country_id, l.continent_id, l.population,
			       bc.latitude, bc.longitude, l.timezone,
			       lt.code as locality_type_code
			FROM geo_localities l
			JOIN best_coords bc ON bc.locality_id = l.id
			LEFT JOIN geo_locality_types lt ON l.locality_type_id = lt.id
			WHERE l.id > $1
			ORDER BY l.id
			LIMIT $2
		`, lastID, batchSize)
		if err != nil {
			return totalCount, fmt.Errorf("query localities: %w", err)
		}

		type localityRow struct {
			id               int32
			name             string
			nameAscii        *string
			localityTypeID   int16
			countryID        int16
			continentID      int16
			population       *int64
			latitude         float64
			longitude        float64
			timezone         string
			localityTypeCode *string
		}

		var batch []localityRow
		for rows.Next() {
			var r localityRow
			if err := rows.Scan(&r.id, &r.name, &r.nameAscii, &r.localityTypeID,
				&r.countryID, &r.continentID,
				&r.population, &r.latitude, &r.longitude, &r.timezone, &r.localityTypeCode); err != nil {
				rows.Close()
				return totalCount, fmt.Errorf("scan locality: %w", err)
			}
			batch = append(batch, r)
		}
		rows.Close()

		if len(batch) == 0 {
			break
		}

		// Build index rows
		indexRows := make([][]any, 0, len(batch))
		for _, loc := range batch {
			id := loc.id
			name := loc.name
			nameAscii := loc.nameAscii
			localityTypeID := loc.localityTypeID
			localityTypeCode := loc.localityTypeCode
			countryID := loc.countryID
			continentID := loc.continentID
			population := loc.population
			latitude := loc.latitude
			longitude := loc.longitude
			timezone := loc.timezone

			// Build keywords array
			keywords := make([]string, 0, 50)

			// 1. ORIGINAL native name (most important!)
			keywords = append(keywords, strings.ToLower(name))

			// 2. ASCII transliteration
			if nameAscii != nil && *nameAscii != "" && *nameAscii != name {
				keywords = append(keywords, strings.ToLower(*nameAscii))
			}

			// 3. ALL multi-language locality names from geo_names
			var displayNames map[string]string
			if en := entityKeywords["locality"][id]; en != nil {
				keywords = append(keywords, en.Keywords...)
				displayNames = en.DisplayNames
			}

			// 4. ALL parent locality names (for neighborhoods, boroughs, etc.)
			// localityAncestry is built from parent_overture_id relationships (locality-to-locality only)
			if ancestors := localityAncestry[id]; ancestors != nil {
				for _, ancestorID := range ancestors {
					// Add native name from localityInfo (always available)
					if lInfo, ok := localityInfo[ancestorID]; ok {
						keywords = append(keywords, strings.ToLower(lInfo.Name))
					}
					// Add multi-language names from geo_names (may be empty for some localities)
					if en := entityKeywords["locality"][ancestorID]; en != nil {
						keywords = append(keywords, en.Keywords...)
					}
				}
			}

			// 5. Parent region keywords (when parent is a region, e.g., London -> England)
			// This uses localityParents which resolves parent_overture_id to any entity type
			var inheritedRegionID *int32
			if parentInfo, hasParent := localityParents[id]; hasParent && parentInfo.ParentType == "region" {
				regionID := parentInfo.ParentID
				inheritedRegionID = &regionID

				// Add region name and multi-language names
				if rInfo, ok := regionInfo[regionID]; ok {
					keywords = append(keywords, strings.ToLower(rInfo.Name))
				}
				if en := entityKeywords["region"][regionID]; en != nil {
					keywords = append(keywords, en.Keywords...)
				}

				// Also add ancestor regions (e.g., county -> state)
				if ancestors := regionAncestry[regionID]; ancestors != nil {
					for _, ancestorRegionID := range ancestors {
						if rInfo, ok := regionInfo[ancestorRegionID]; ok {
							keywords = append(keywords, strings.ToLower(rInfo.Name))
						}
						if en := entityKeywords["region"][ancestorRegionID]; en != nil {
							keywords = append(keywords, en.Keywords...)
						}
					}
				}
			}

			// 6. ALL country names (multi-language) + ISO code
			if en := entityKeywords["country"][int32(countryID)]; en != nil {
				keywords = append(keywords, en.Keywords...)
			}

			// Get country info
			cInfo := countryInfo[countryID]
			keywords = append(keywords, strings.ToLower(cInfo.Code))

			// 6. Continent name
			cont := continentInfo[continentID]
			keywords = append(keywords, strings.ToLower(cont.Name))

			// Deduplicate keywords
			keywords = uniqueStrings(keywords)

			// Build display hierarchy: "Locality, ParentLocality, ..., Country, Continent"
			var hierarchyParts []string
			hierarchyParts = append(hierarchyParts, name)

			// Build hierarchy_path entries
			var hierarchyEntries []HierarchyEntry
			hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "locality", ID: id, Name: name})

			// Determine direct parent info using localityParents (resolves to any entity type)
			var directParentType *string
			var directParentID *int32

			if parentInfo, hasParent := localityParents[id]; hasParent {
				// Use the resolved parent type (locality, region, or country)
				directParentType = &parentInfo.ParentType
				directParentID = &parentInfo.ParentID

				// Add parent locality chain (for neighborhoods/boroughs within cities)
				if parentInfo.ParentType == "locality" {
					// Walk up the locality ancestry chain
					if ancestors := localityAncestry[id]; ancestors != nil {
						for _, ancestorID := range ancestors {
							if lInfo, ok := localityInfo[ancestorID]; ok {
								// Skip if this is the country-level locality (same or contains country name)
								if strings.EqualFold(lInfo.Name, cInfo.Name) ||
									strings.Contains(strings.ToLower(lInfo.Name), strings.ToLower(cInfo.Name)) {
									continue
								}
								hierarchyParts = append(hierarchyParts, lInfo.Name)
								hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "locality", ID: ancestorID, Name: lInfo.Name})
							}
						}
					}
				} else if parentInfo.ParentType == "region" {
					// Add region to hierarchy (e.g., London -> England)
					if rInfo, ok := regionInfo[parentInfo.ParentID]; ok {
						hierarchyParts = append(hierarchyParts, rInfo.Name)
						hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "region", ID: parentInfo.ParentID, Name: rInfo.Name})

						// Add ancestor regions to hierarchy
						if ancestors := regionAncestry[parentInfo.ParentID]; ancestors != nil {
							for _, ancestorRegionID := range ancestors {
								if ancestorRInfo, ok := regionInfo[ancestorRegionID]; ok {
									hierarchyParts = append(hierarchyParts, ancestorRInfo.Name)
									hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "region", ID: ancestorRegionID, Name: ancestorRInfo.Name})
								}
							}
						}
					}
				}
				// If parent is country, nothing extra to add to hierarchy (country added below)
			} else {
				// No parent found - default to country as parent
				t := "country"
				directParentType = &t
				cid := int32(countryID)
				directParentID = &cid
			}

			// Add country and continent
			hierarchyParts = append(hierarchyParts, cInfo.Name)
			hierarchyParts = append(hierarchyParts, cont.Name)
			hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "country", ID: int32(countryID), Name: cInfo.Name})
			hierarchyEntries = append(hierarchyEntries, HierarchyEntry{Type: "continent", ID: int32(cont.ID), Name: cont.Name})
			displayHierarchy := strings.Join(hierarchyParts, ", ")

			// Build ancestor_region_ids: inherited region + all its ancestors
			var ancestorRegionIDs []int32
			if inheritedRegionID != nil {
				// Start with immediate region parent
				ancestorRegionIDs = append(ancestorRegionIDs, *inheritedRegionID)
				// Add all ancestor regions from the pre-loaded map
				if ancestors := regionAncestry[*inheritedRegionID]; ancestors != nil {
					ancestorRegionIDs = append(ancestorRegionIDs, ancestors...)
				}
			}

			// Build row
			indexRows = append(indexRows, []any{
				"locality",                            // entity_type
				id,                                    // entity_id
				localityTypeCode,                      // entity_subtype (city/town/village/hamlet/neighborhood)
				id,                                    // locality_id
				keywords,                              // keywords
				name,                                  // display_name
				displayHierarchy,                      // display_hierarchy
				displayNamesToJSON(displayNames),      // display_names
				localityTypeID,                        // locality_type_id
				directParentType,                      // direct_parent_type
				directParentID,                        // direct_parent_id
				inheritedRegionID,                     // inherited_region_id (set when parent is a region)
				hierarchyPathToJSON(hierarchyEntries), // hierarchy_path
				countryID,                             // country_id
				continentID,                           // continent_id
				cInfo.Code,                            // country_code
				population,                            // population
				latitude,                              // latitude
				longitude,                             // longitude
				timezone,                              // timezone
				ancestorRegionIDs,                     // ancestor_region_ids
			})
		}

		// Update lastID for cursor pagination
		lastID = batch[len(batch)-1].id

		// Bulk insert using CopyFrom
		_, err = pool.CopyFrom(
			ctx,
			pgx.Identifier{"geo_search_index"},
			columns,
			pgx.CopyFromRows(indexRows),
		)
		if err != nil {
			return totalCount, fmt.Errorf("copy batch: %w", err)
		}

		totalCount += int64(len(batch))

		// Progress report every batch
		if totalCount%250000 < int64(len(batch)) {
			pct := float64(totalCount) / float64(totalLocalities) * 100
			elapsed := time.Since(startTime)
			rate := float64(totalCount) / elapsed.Seconds()
			remaining := int64(0)
			if rate > 0 {
				remaining = int64(float64(totalLocalities-totalCount) / rate)
			}
			eta := time.Duration(remaining) * time.Second
			fmt.Printf("      Progress: %d/%d (%.1f%%) - %.0f/sec - ETA: %s\n",
				totalCount, totalLocalities, pct, rate, eta.Round(time.Second))
		}
	}
	return totalCount, nil
}

// uniqueStrings removes duplicates from a string slice
func uniqueStrings(s []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(s))
	for _, v := range s {
		if !seen[v] {
			seen[v] = true
			result = append(result, v)
		}
	}
	return result
}

// updateRegionPopulations calculates region populations from descendant localities.
// Uses in-memory computation for speed: loads all locality populations and ancestor_region_ids,
// then sums populations per region in Go (O(n) where n = localities).
// This must be called AFTER localities are indexed with their ancestor_region_ids.
func updateRegionPopulations(ctx context.Context) error {
	const batchSize = 250000

	fmt.Println("      Loading locality populations into memory...")
	loadStart := time.Now()

	// Load all localities with their populations and ancestor_region_ids
	rows, err := pool.Query(ctx, `
		SELECT entity_id, population, ancestor_region_ids
		FROM geo_search_index
		WHERE entity_type = 'locality'
	`)
	if err != nil {
		return fmt.Errorf("load localities: %w", err)
	}

	// Sum populations per region
	regionPop := make(map[int32]int64)
	var localityCount int64

	for rows.Next() {
		var entityID int32
		var population *int64
		var ancestorRegionIDs []int32

		if err := rows.Scan(&entityID, &population, &ancestorRegionIDs); err != nil {
			rows.Close()
			return fmt.Errorf("scan locality: %w", err)
		}

		localityCount++
		if population == nil {
			continue
		}

		// Add this locality's population to each of its ancestor regions
		for _, regionID := range ancestorRegionIDs {
			regionPop[regionID] += *population
		}
	}
	rows.Close()

	fmt.Printf("      Loaded %d localities in %s\n", localityCount, time.Since(loadStart))
	fmt.Printf("      Computing populations for %d regions...\n", len(regionPop))

	// Now batch update the regions
	fmt.Println("      Updating database in batches...")
	updateStart := time.Now()

	type RegionUpdate struct {
		RegionID   int32
		Population int64
	}

	var updates []RegionUpdate
	for regionID, pop := range regionPop {
		updates = append(updates, RegionUpdate{RegionID: regionID, Population: pop})
	}

	// Create unlogged staging table (faster than temp table with connection pooling)
	_, err = pool.Exec(ctx, `DROP TABLE IF EXISTS _pop_update`)
	if err != nil {
		return fmt.Errorf("drop old staging table: %w", err)
	}
	_, err = pool.Exec(ctx, `
		CREATE UNLOGGED TABLE _pop_update (
			region_id integer PRIMARY KEY,
			population bigint
		)
	`)
	if err != nil {
		return fmt.Errorf("create staging table: %w", err)
	}

	// Copy all updates to staging table
	columns := []string{"region_id", "population"}
	copyRows := make([][]any, len(updates))
	for j, u := range updates {
		copyRows[j] = []any{u.RegionID, u.Population}
	}

	fmt.Printf("      Copying %d region populations to staging table...\n", len(updates))
	_, err = pool.CopyFrom(ctx, pgx.Identifier{"_pop_update"}, columns, pgx.CopyFromRows(copyRows))
	if err != nil {
		return fmt.Errorf("copy to staging table: %w", err)
	}

	// Single bulk update from staging table
	fmt.Println("      Running bulk update...")
	result, err := pool.Exec(ctx, `
		UPDATE geo_search_index g
		SET population = u.population
		FROM _pop_update u
		WHERE g.entity_type = 'region' AND g.entity_id = u.region_id
	`)
	if err != nil {
		return fmt.Errorf("bulk update: %w", err)
	}

	// Clean up staging table
	_, _ = pool.Exec(ctx, `DROP TABLE IF EXISTS _pop_update`)

	totalUpdated := int(result.RowsAffected())

	fmt.Printf("      Updated %d regions in %s\n", totalUpdated, time.Since(updateStart))
	return nil
}

// recreateSearchIndexTable drops and recreates the geo_search_index table
// This is much faster than TRUNCATE + DROP INDEX when dealing with large GIN indexes
func recreateSearchIndexTable(ctx context.Context) error {
	// Drop the table (cascades to all indexes)
	_, err := pool.Exec(ctx, "DROP TABLE IF EXISTS geo_search_index CASCADE")
	if err != nil {
		return fmt.Errorf("drop table: %w", err)
	}

	// Recreate the table (without indexes - we'll create them at the end)
	// Schema matches migration 00000000000001_schema.sql
	_, err = pool.Exec(ctx, `
		CREATE TABLE geo_search_index (
			entity_type character varying(20) NOT NULL,
			entity_id integer NOT NULL,
			entity_subtype character varying(30),
			locality_id integer,
			keywords text[] NOT NULL,
			display_name text NOT NULL,
			display_hierarchy text NOT NULL,
			display_names jsonb,
			locality_type_id smallint,
			direct_parent_type character varying(20),
			direct_parent_id integer,
			inherited_region_id integer,
			hierarchy_path jsonb,
			country_id smallint,
			continent_id smallint,
			country_code character varying(2),
			population bigint,
			latitude double precision,
			longitude double precision,
			timezone text,
			descendant_count integer DEFAULT 0,
			direct_child_count integer DEFAULT 0,
			has_children boolean DEFAULT false,
			ancestor_region_ids integer[]
		)
	`)
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}

	// Add table comment
	_, err = pool.Exec(ctx, `
		COMMENT ON TABLE geo_search_index IS
		'Denormalized search index with keywords from all languages for fast multi-entity geographic search'
	`)
	if err != nil {
		slog.Warn("failed to add table comment", "error", err)
	}

	return nil
}

// EntityKey is a composite key for entity lookups
type EntityKey struct {
	Type string
	ID   int32
}

// computeDescendantAndChildCounts calculates both direct child counts and total descendant counts
// using fast in-memory graph traversal instead of slow recursive SQL CTEs.
// This is O(n) where n = number of entities, much faster than SQL recursion.
func computeDescendantAndChildCounts(ctx context.Context) error {
	const batchSize = 250000

	fmt.Println("      Loading parent relationships...")
	loadStart := time.Now()

	// Load all entities with their parent relationships into memory
	rows, err := pool.Query(ctx, `
		SELECT entity_type, entity_id, direct_parent_type, direct_parent_id
		FROM geo_search_index
	`)
	if err != nil {
		return fmt.Errorf("load entities: %w", err)
	}

	// Build parent->children map and track all entities
	children := make(map[EntityKey][]EntityKey) // parent -> list of children
	allEntities := make(map[EntityKey]bool)     // all entities that exist

	var entityCount int64
	for rows.Next() {
		var entityType string
		var entityID int32
		var parentType *string
		var parentID *int32

		if err := rows.Scan(&entityType, &entityID, &parentType, &parentID); err != nil {
			rows.Close()
			return fmt.Errorf("scan entity: %w", err)
		}

		key := EntityKey{Type: entityType, ID: entityID}
		allEntities[key] = true
		entityCount++

		if parentType != nil && parentID != nil {
			parentKey := EntityKey{Type: *parentType, ID: *parentID}
			children[parentKey] = append(children[parentKey], key)
		}
	}
	rows.Close()

	fmt.Printf("      Loaded %d entities in %s\n", entityCount, time.Since(loadStart))
	fmt.Println("      Computing counts in memory...")
	computeStart := time.Now()

	// Compute direct child counts (simple: just count children)
	directChildCount := make(map[EntityKey]int32)
	for parent, kids := range children {
		directChildCount[parent] = int32(len(kids))
	}

	// Compute descendant counts using memoized DFS
	descendantCount := make(map[EntityKey]int32)
	var computeDescendants func(key EntityKey) int32
	computeDescendants = func(key EntityKey) int32 {
		if count, ok := descendantCount[key]; ok {
			return count
		}

		var total int32 = 0
		for _, child := range children[key] {
			total += 1 + computeDescendants(child) // 1 for the child + all its descendants
		}
		descendantCount[key] = total
		return total
	}

	// Compute for all entities (this triggers memoization)
	for key := range allEntities {
		computeDescendants(key)
	}

	fmt.Printf("      Computed counts for %d entities in %s\n", len(allEntities), time.Since(computeStart))
	fmt.Println("      Updating database in batches...")
	updateStart := time.Now()

	// Batch update the database
	// We'll update entities that have non-zero counts
	type UpdateRow struct {
		EntityType     string
		EntityID       int32
		DirectChildren int32
		Descendants    int32
		HasChildren    bool
	}

	var updates []UpdateRow
	for key := range allEntities {
		dc := directChildCount[key]
		desc := descendantCount[key]
		if dc > 0 || desc > 0 {
			updates = append(updates, UpdateRow{
				EntityType:     key.Type,
				EntityID:       key.ID,
				DirectChildren: dc,
				Descendants:    desc,
				HasChildren:    dc > 0,
			})
		}
	}

	// Create unlogged staging table (faster than temp table with connection pooling)
	_, err = pool.Exec(ctx, `DROP TABLE IF EXISTS _counts_update`)
	if err != nil {
		return fmt.Errorf("drop old staging table: %w", err)
	}
	_, err = pool.Exec(ctx, `
		CREATE UNLOGGED TABLE _counts_update (
			entity_type varchar(20),
			entity_id integer,
			direct_child_count integer,
			descendant_count integer,
			has_children boolean,
			PRIMARY KEY (entity_type, entity_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("create staging table: %w", err)
	}

	// Copy all updates to staging table
	columns := []string{"entity_type", "entity_id", "direct_child_count", "descendant_count", "has_children"}
	copyRows := make([][]any, len(updates))
	for j, u := range updates {
		copyRows[j] = []any{u.EntityType, u.EntityID, u.DirectChildren, u.Descendants, u.HasChildren}
	}

	fmt.Printf("      Copying %d entity counts to staging table...\n", len(updates))
	_, err = pool.CopyFrom(ctx, pgx.Identifier{"_counts_update"}, columns, pgx.CopyFromRows(copyRows))
	if err != nil {
		return fmt.Errorf("copy to staging table: %w", err)
	}

	// Single bulk update from staging table
	fmt.Println("      Running bulk update...")
	result, err := pool.Exec(ctx, `
		UPDATE geo_search_index g
		SET
			direct_child_count = u.direct_child_count,
			descendant_count = u.descendant_count,
			has_children = u.has_children
		FROM _counts_update u
		WHERE g.entity_type = u.entity_type AND g.entity_id = u.entity_id
	`)
	if err != nil {
		return fmt.Errorf("bulk update: %w", err)
	}

	// Clean up staging table
	_, _ = pool.Exec(ctx, `DROP TABLE IF EXISTS _counts_update`)

	totalUpdated := int(result.RowsAffected())
	fmt.Printf("      Updated %d entities in %s\n", totalUpdated, time.Since(updateStart))
	return nil
}

// ensureGeoNamesIndexes creates required indexes on geo_names table for fast lookups
// This dramatically speeds up loadCountryInfo() and loadRegionInfo() queries
func ensureGeoNamesIndexes(ctx context.Context) error {
	// Check if index already exists
	var exists bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM pg_indexes
			WHERE tablename = 'geo_names'
			AND indexname = 'idx_geo_names_entity_lookup'
		)
	`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check index existence: %w", err)
	}

	if exists {
		fmt.Println("      Index idx_geo_names_entity_lookup already exists")
		return nil
	}

	fmt.Println("      Creating index idx_geo_names_entity_lookup (this may take a few minutes)...")
	startTime := time.Now()

	// Create covering index for entity lookups
	// INCLUDE clause adds name_type and name to the index for index-only scans
	_, err = pool.Exec(ctx, `
		CREATE INDEX idx_geo_names_entity_lookup
		ON geo_names(entity_type, entity_id, language_code)
		INCLUDE (name_type, name)
	`)
	if err != nil {
		return fmt.Errorf("create index: %w", err)
	}

	fmt.Printf("      Index created in %s\n", time.Since(startTime))
	return nil
}
