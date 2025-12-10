// Package main imports city coordinates from SimpleMaps worldcities.csv.
//
// SimpleMaps provides high-quality coordinate data for ~48k cities worldwide.
// This tool:
//  1. Creates missing COUNTRIES from SimpleMaps ISO2/ISO3 codes with continent mapping
//  2. Matches SimpleMaps cities to existing WOF cities and imports coordinates
//  3. Creates NEW cities for unmatched SimpleMaps entries with:
//     - continent_id (derived from ISO2 → continent mapping)
//     - country_id (created if missing, from ISO2 code)
//     - region_id and district_id (via point-in-polygon matching)
//     - timezone (from SimpleMaps Pro version, UTC fallback for Basic)
//
// Matching Strategy (multi-pass):
//  1. Exact name match on name_ascii
//  2. Normalized name match (St./Saint, removes suffixes like "upon Tyne")
//  3. Alternative names via geo_names table (Rangoon->Yangon)
//  4. Trigram fuzzy matching with similarity > 0.4
//  5. Fuzzy match on geo_names alternative names
//  6. Create new city if no match found (with full geographic hierarchy)
//
// Country/Continent Mapping:
//   - Uses ISO 3166-1 alpha-2 → continent mapping from online data
//   - Source: https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes
//   - Automatically creates missing countries with proper continent assignment
//
// Timezone Handling:
//   - SimpleMaps Pro/Comprehensive version includes IANA timezone data
//   - SimpleMaps Basic (free) version does not include timezone (uses UTC fallback)
//   - For new cities: Uses SimpleMaps timezone if available
//   - For matched cities: WOF timezone is preserved (more reliable)
//
// Data Source:
//
//	https://simplemaps.com/data/world-cities (Basic version is free, Pro has timezone)
//
// Prerequisites:
//   - WOF data should be imported first (provides geo_cities to match against)
//   - Download worldcities.csv to data/simplemaps/worldcities.csv
package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim/internal/geo"
)

const (
	defaultCSVPath     = "data/simplemaps/worldcities.csv"
	defaultMaxDistance = 50.0 // km
)

// =============================================================================
// MAIN & COMMANDS
// =============================================================================

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "import":
		cmdImport(os.Args[2:])
	case "status":
		cmdStatus(os.Args[2:])
	case "reset":
		cmdReset(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `SimpleMaps City Coordinates Import Tool

Imports city coordinates from SimpleMaps worldcities.csv. This tool:
1. Matches SimpleMaps cities to existing WOF cities and imports coordinates
2. Creates NEW cities for unmatched entries with full geographic hierarchy

Commands:
  import      Import SimpleMaps data (matches to existing cities OR creates new)
  status      Show current import status
  reset       Delete all SimpleMaps coordinate data

Options (for import):
  --csv PATH         Path to worldcities.csv (default: %s)
  --max-distance KM  Maximum distance for matching (default: %.0fkm)
  --dry-run          Don't write to database, just report matches/creates
  --verbose, -v      Show detailed matching info

Environment:
  DATABASE_URL       PostgreSQL connection string (required)

Data Source:
  https://simplemaps.com/data/world-cities

Matching Strategy (multi-pass):
  1. Exact name match on name_ascii
  2. Normalized name (St.→Saint, remove "upon Tyne", "City" suffixes)
  3. Alternative names via geo_names (Rangoon→Yangon)
  4. Trigram fuzzy matching (similarity > 0.4, distance < 25km)
  5. Create new city if no match (with continent, country, region, district)

Country Creation:
  - Creates missing countries automatically from ISO2/ISO3 codes
  - Continent assignment via ISO 3166-1 alpha-2 → continent mapping
  - Source: https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes

City Creation:
  - Automatically assigns continent_id (from ISO2 → continent mapping)
  - Automatically assigns country_id (creates country if missing)
  - Attempts point-in-polygon matching for region_id and district_id
  - Uses SimpleMaps coordinates and population data

Note: WOF data should be imported first for best matching results.
`, defaultCSVPath, defaultMaxDistance)
}

// =============================================================================
// CMD: IMPORT
// =============================================================================

func cmdImport(args []string) {
	cfg := parseImportArgs(args)

	ctx := context.Background()
	pool, err := connectDB(ctx)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	imp := &Importer{
		pool:        pool,
		csvPath:     cfg.csvPath,
		maxDistance: cfg.maxDistance,
		dryRun:      cfg.dryRun,
		verbose:     cfg.verbose,
	}

	if err := imp.Run(ctx); err != nil {
		log.Fatalf("Import failed: %v", err)
	}
}

type importConfig struct {
	csvPath     string
	maxDistance float64
	dryRun      bool
	verbose     bool
}

func parseImportArgs(args []string) importConfig {
	cfg := importConfig{
		csvPath:     defaultCSVPath,
		maxDistance: defaultMaxDistance,
	}

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--dry-run":
			cfg.dryRun = true
		case "--verbose", "-v":
			cfg.verbose = true
		case "--csv":
			if i+1 < len(args) {
				cfg.csvPath = args[i+1]
				i++
			}
		case "--max-distance":
			if i+1 < len(args) {
				if d, err := strconv.ParseFloat(args[i+1], 64); err == nil {
					cfg.maxDistance = d
				}
				i++
			}
		}
	}

	return cfg
}

// =============================================================================
// CMD: STATUS
// =============================================================================

func cmdStatus(args []string) {
	ctx := context.Background()
	pool, err := connectDB(ctx)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	// Look up simplemaps source ID
	var sourceID int
	err = pool.QueryRow(ctx, "SELECT id FROM geo_data_sources WHERE key = 'simplemaps'").Scan(&sourceID)
	if err != nil {
		log.Fatalf("Failed to find simplemaps data source: %v", err)
	}

	fmt.Println("SimpleMaps Import Status")
	fmt.Println("========================")

	// Count SimpleMaps coordinates
	var count int64
	err = pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM geo_city_coordinates WHERE source_id = $1", sourceID).Scan(&count)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	fmt.Printf("SimpleMaps coordinates: %d\n", count)

	// Count total cities
	var cityCount int64
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_cities").Scan(&cityCount)
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	fmt.Printf("Total WOF cities:       %d\n", cityCount)

	if cityCount > 0 {
		fmt.Printf("Coverage:               %.1f%%\n", 100*float64(count)/float64(cityCount))
	}

	// Last import
	var lastImport *time.Time
	err = pool.QueryRow(ctx, `
		SELECT MAX(created_at) FROM geo_city_coordinates WHERE source_id = $1
	`, sourceID).Scan(&lastImport)
	if err == nil && lastImport != nil {
		fmt.Printf("Last import:            %s\n", lastImport.Format(time.RFC3339))
	}
}

// =============================================================================
// CMD: RESET
// =============================================================================

func cmdReset(args []string) {
	// Check for --confirm flag
	confirmed := false
	for _, arg := range args {
		if arg == "--confirm" {
			confirmed = true
		}
	}

	if !confirmed {
		fmt.Println("This will delete all SimpleMaps coordinate data.")
		fmt.Println("Run with --confirm to proceed.")
		return
	}

	ctx := context.Background()
	pool, err := connectDB(ctx)
	if err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	defer pool.Close()

	// Look up simplemaps source ID
	var sourceID int
	err = pool.QueryRow(ctx, "SELECT id FROM geo_data_sources WHERE key = 'simplemaps'").Scan(&sourceID)
	if err != nil {
		log.Fatalf("Failed to find simplemaps data source: %v", err)
	}

	result, err := pool.Exec(ctx,
		"DELETE FROM geo_city_coordinates WHERE source_id = $1", sourceID)
	if err != nil {
		log.Fatalf("Delete failed: %v", err)
	}

	fmt.Printf("Deleted %d SimpleMaps coordinate records\n", result.RowsAffected())
}

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

func connectDB(ctx context.Context) (*pgxpool.Pool, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL environment variable required")
	}

	// Configure pool for high throughput (consistent with import-wof/elevation)
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}
	config.MaxConns = 20
	config.MinConns = 5

	return pgxpool.NewWithConfig(ctx, config)
}

// =============================================================================
// IMPORTER
// =============================================================================

// Importer handles SimpleMaps data import
type Importer struct {
	pool        *pgxpool.Pool
	csvPath     string
	maxDistance float64
	dryRun      bool
	verbose     bool

	// Runtime state
	countryCodeToID map[string]int64
	countryToCont   map[int64]int64 // country_id -> continent_id
	continentIDs    map[string]int64
	logFile         *os.File
	logMu           sync.Mutex
	skipReasons     map[string]int
	skipReasonsMu   sync.Mutex

	// Lookup maps for normalized database
	geoLevelIDs map[string]int // geo_levels lookup: "city" -> ID
	sourceIDs   map[string]int // geo_data_sources lookup: "simplemaps" -> ID
}

func (imp *Importer) Run(ctx context.Context) error {
	start := time.Now()

	fmt.Println("SimpleMaps City Coordinates Import")
	fmt.Println("===================================")
	fmt.Printf("CSV: %s\n", imp.csvPath)
	fmt.Printf("Max distance: %.1f km\n", imp.maxDistance)
	fmt.Println("Timezone policy: New countries/cities require timezone (Pro version)")
	if imp.dryRun {
		fmt.Println("DRY RUN - no changes will be made")
	}
	fmt.Println()

	// Initialize state
	imp.skipReasons = make(map[string]int)

	// Initialize lookup maps
	fmt.Println("Step 0: Loading lookup tables...")
	if err := imp.initializeLookupMaps(ctx); err != nil {
		return fmt.Errorf("failed to initialize lookup maps: %w", err)
	}
	fmt.Printf("  Loaded %d geo levels, %d data sources\n\n", len(imp.geoLevelIDs), len(imp.sourceIDs))

	// Create log file
	logPath := "simplemaps-import.log"
	var err error
	imp.logFile, err = os.Create(logPath)
	if err != nil {
		return fmt.Errorf("create log file: %w", err)
	}
	defer imp.logFile.Close()
	fmt.Printf("Log file: %s\n\n", logPath)

	// Step 1: Verify prerequisites
	fmt.Println("Step 1: Checking prerequisites...")
	cityCount, err := imp.checkPrerequisites(ctx)
	if err != nil {
		return err
	}
	fmt.Printf("  Found %d WOF cities to match against\n", cityCount)

	// Step 2: Load country mappings
	fmt.Println("Step 2: Loading country mappings...")
	if err := imp.loadCountryMappings(ctx); err != nil {
		return fmt.Errorf("load country mappings: %w", err)
	}
	fmt.Printf("  Loaded %d countries\n", len(imp.countryCodeToID))

	// Step 3: Create missing territories (only if not dry-run)
	if !imp.dryRun {
		fmt.Println("Step 3: Creating missing territories...")
		created, err := imp.createMissingTerritories(ctx)
		if err != nil {
			return fmt.Errorf("create territories: %w", err)
		}
		if created > 0 {
			fmt.Printf("  Created %d territories\n", created)
		} else {
			fmt.Println("  No new territories needed")
		}
	} else {
		fmt.Println("Step 3: Skipping territory creation (dry-run)")
	}

	// Step 4: Delete existing SimpleMaps data (only if not dry-run)
	if !imp.dryRun {
		fmt.Println("Step 4: Deleting existing SimpleMaps data...")
		deleted, err := imp.deleteExistingData(ctx)
		if err != nil {
			return fmt.Errorf("delete existing data: %w", err)
		}
		fmt.Printf("  Deleted %d existing records\n", deleted)
	} else {
		fmt.Println("Step 4: Skipping data deletion (dry-run)")
	}

	// Step 5: Disable trigger for bulk import (re-enable after)
	if !imp.dryRun {
		fmt.Println("Step 5: Disabling coordinate update trigger...")
		_, err := imp.pool.Exec(ctx, "ALTER TABLE geo_city_coordinates DISABLE TRIGGER trg_geo_city_coordinates_update_effective")
		if err != nil {
			fmt.Printf("  Warning: could not disable trigger: %v\n", err)
		}
	}

	// Step 6: Import coordinates
	fmt.Println("Step 6: Importing coordinates...")
	stats, err := imp.importCSV(ctx)
	if err != nil {
		// Re-enable trigger before returning error
		if !imp.dryRun {
			imp.pool.Exec(ctx, "ALTER TABLE geo_city_coordinates ENABLE TRIGGER trg_geo_city_coordinates_update_effective")
		}
		return fmt.Errorf("import CSV: %w", err)
	}

	// Step 7: Bulk update geo_cities from simplemaps coordinates (single query)
	if !imp.dryRun && stats.inserted > 0 {
		fmt.Println("Step 7: Bulk updating geo_cities coordinates...")
		updated, err := imp.bulkUpdateGeoCities(ctx)
		if err != nil {
			fmt.Printf("  Warning: bulk update failed: %v\n", err)
		} else {
			fmt.Printf("  Updated %d cities with SimpleMaps coordinates\n", updated)
		}
	}

	// Step 8: Re-enable trigger
	if !imp.dryRun {
		fmt.Println("Step 8: Re-enabling coordinate update trigger...")
		_, err := imp.pool.Exec(ctx, "ALTER TABLE geo_city_coordinates ENABLE TRIGGER trg_geo_city_coordinates_update_effective")
		if err != nil {
			fmt.Printf("  Warning: could not re-enable trigger: %v\n", err)
		}
	}

	// Print results
	elapsed := time.Since(start)
	fmt.Printf("\nComplete in %s\n\n", elapsed.Round(time.Second))

	fmt.Println("Results:")
	fmt.Printf("  Processed:    %d\n", stats.processed)
	fmt.Printf("  Matched:      %d (%.1f%%)\n", stats.matched, 100*float64(stats.matched)/float64(stats.processed))
	if !imp.dryRun {
		fmt.Printf("    Inserted:   %d\n", stats.inserted)
		fmt.Printf("    Updated:    %d\n", stats.updated)
	}
	if stats.citiesCreated > 0 {
		fmt.Printf("  Cities created: %d\n", stats.citiesCreated)
	}
	fmt.Println()
	fmt.Println("Not imported:")
	fmt.Printf("  No match:     %d\n", stats.skipped)
	fmt.Printf("  Rejected:     %d\n", stats.rejected)
	fmt.Printf("  No country:   %d\n", stats.noCountry)

	// Print skip reasons
	if len(imp.skipReasons) > 0 {
		fmt.Println("\nSkip reasons breakdown:")
		for reason, count := range imp.skipReasons {
			fmt.Printf("  %6d  %s\n", count, reason)
		}
	}

	fmt.Printf("\nDetailed log: %s\n", logPath)

	return nil
}

func (imp *Importer) checkPrerequisites(ctx context.Context) (int64, error) {
	var count int64
	err := imp.pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_cities").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("check cities: %w", err)
	}
	if count == 0 {
		return 0, fmt.Errorf("no cities found - run WOF import first")
	}
	return count, nil
}

func (imp *Importer) loadCountryMappings(ctx context.Context) error {
	imp.countryCodeToID = make(map[string]int64)
	imp.countryToCont = make(map[int64]int64)

	rows, err := imp.pool.Query(ctx, "SELECT id, code, continent_id FROM geo_countries")
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var code string
		var continentID int64
		if err := rows.Scan(&id, &code, &continentID); err != nil {
			continue
		}
		imp.countryCodeToID[code] = id
		imp.countryToCont[id] = continentID
	}

	return rows.Err()
}

// initializeLookupMaps loads lookup table IDs from the database
func (imp *Importer) initializeLookupMaps(ctx context.Context) error {
	imp.geoLevelIDs = make(map[string]int)
	imp.sourceIDs = make(map[string]int)

	// Load geo_levels
	rows, err := imp.pool.Query(ctx, "SELECT id, key FROM geo_levels")
	if err != nil {
		return fmt.Errorf("query geo_levels: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var key string
		if err := rows.Scan(&id, &key); err != nil {
			return fmt.Errorf("scan geo_levels: %w", err)
		}
		imp.geoLevelIDs[key] = id
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate geo_levels: %w", err)
	}

	// Load geo_data_sources
	rows, err = imp.pool.Query(ctx, "SELECT id, key FROM geo_data_sources")
	if err != nil {
		return fmt.Errorf("query geo_data_sources: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var key string
		if err := rows.Scan(&id, &key); err != nil {
			return fmt.Errorf("scan geo_data_sources: %w", err)
		}
		imp.sourceIDs[key] = id
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate geo_data_sources: %w", err)
	}

	// Validate required lookups exist
	if _, ok := imp.geoLevelIDs["city"]; !ok {
		return fmt.Errorf("required geo_level 'city' not found in database")
	}
	if _, ok := imp.sourceIDs["simplemaps"]; !ok {
		return fmt.Errorf("required geo_data_source 'simplemaps' not found in database")
	}

	return nil
}

func (imp *Importer) deleteExistingData(ctx context.Context) (int64, error) {
	sourceID := imp.sourceIDs["simplemaps"]
	result, err := imp.pool.Exec(ctx,
		"DELETE FROM geo_city_coordinates WHERE source_id = $1", sourceID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// =============================================================================
// CSV IMPORT
// =============================================================================

// SimpleMapsCity represents a row from worldcities.csv
type SimpleMapsCity struct {
	City       string
	CityASCII  string
	Lat        float64
	Lng        float64
	Country    string
	ISO2       string
	ISO3       string
	AdminName  string
	Capital    string
	Population int64
	ID         string
	Timezone   string // IANA timezone (e.g., "America/New_York")
}

// importStats tracks import progress
type importStats struct {
	processed     int
	matched       int
	inserted      int
	updated       int
	skipped       int
	rejected      int
	noCountry     int
	citiesCreated int
}

func (s *importStats) add(other *importStats) {
	s.processed += other.processed
	s.matched += other.matched
	s.inserted += other.inserted
	s.updated += other.updated
	s.skipped += other.skipped
	s.rejected += other.rejected
	s.noCountry += other.noCountry
	s.citiesCreated += other.citiesCreated
}

func (imp *Importer) importCSV(ctx context.Context) (*importStats, error) {
	file, err := os.Open(imp.csvPath)
	if err != nil {
		return nil, fmt.Errorf("open CSV: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)

	// Skip header
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	logMemory("start import")

	stats := &importStats{}
	batchSize := 1000
	batch := make([]SimpleMapsCity, 0, batchSize)

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}

		city, err := parseCSVRow(record)
		if err != nil {
			continue
		}

		batch = append(batch, city)

		if len(batch) >= batchSize {
			batchStats := imp.processBatch(ctx, batch)
			stats.add(batchStats)
			batch = batch[:0]

			if stats.processed%10000 == 0 {
				var m runtime.MemStats
				runtime.ReadMemStats(&m)
				fmt.Printf("  Processed %d rows (%d matched, %d skipped) mem:%dMB\n",
					stats.processed, stats.matched, stats.skipped, m.Alloc/1024/1024)
			}

			// Periodic GC to prevent memory buildup
			if stats.processed%20000 == 0 {
				runtime.GC()
			}
		}
	}

	// Process remaining
	if len(batch) > 0 {
		batchStats := imp.processBatch(ctx, batch)
		stats.add(batchStats)
	}

	runtime.GC()
	logMemory("end import")

	return stats, nil
}

func logMemory(step string) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("  [mem] %s: %dMB alloc, %dMB sys\n", step, m.Alloc/1024/1024, m.Sys/1024/1024)
}

func parseCSVRow(record []string) (SimpleMapsCity, error) {
	// SimpleMaps comes in two versions:
	// - Basic (free): 11 columns, no timezone
	// - Pro/Comprehensive: 20 columns, includes timezone at index 17
	if len(record) < 11 {
		return SimpleMapsCity{}, fmt.Errorf("invalid row: expected at least 11 columns, got %d", len(record))
	}

	lat, err := strconv.ParseFloat(record[2], 64)
	if err != nil {
		return SimpleMapsCity{}, fmt.Errorf("invalid lat: %w", err)
	}

	lng, err := strconv.ParseFloat(record[3], 64)
	if err != nil {
		return SimpleMapsCity{}, fmt.Errorf("invalid lng: %w", err)
	}

	pop, _ := strconv.ParseInt(record[9], 10, 64) // Population is optional

	city := SimpleMapsCity{
		City:       record[0],
		CityASCII:  record[1],
		Lat:        lat,
		Lng:        lng,
		Country:    record[4],
		ISO2:       record[5],
		ISO3:       record[6],
		AdminName:  record[7],
		Capital:    record[8],
		Population: pop,
		ID:         record[10],
	}

	// If Pro/Comprehensive version with timezone column (20 columns)
	if len(record) >= 20 {
		city.Timezone = record[17] // timezone column at index 17
	}

	return city, nil
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

type processResult struct {
	status      string // "matched", "created", "skipped", "rejected", "no_country"
	inserted    bool
	cityCreated bool
}

func (imp *Importer) processBatch(ctx context.Context, cities []SimpleMapsCity) *importStats {
	stats := &importStats{}

	// Process with worker pool
	numWorkers := 20
	jobs := make(chan SimpleMapsCity, len(cities))
	results := make(chan processResult, len(cities))

	var wg sync.WaitGroup
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for city := range jobs {
				result := imp.processCity(ctx, city)
				results <- result
			}
		}()
	}

	// Send jobs
	for _, city := range cities {
		jobs <- city
	}
	close(jobs)

	// Wait and close results
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	for result := range results {
		stats.processed++
		if result.cityCreated {
			stats.citiesCreated++
		}
		switch result.status {
		case "no_country":
			stats.noCountry++
		case "skipped":
			stats.skipped++
		case "rejected":
			stats.rejected++
		case "matched", "created":
			stats.matched++
			if result.inserted {
				stats.inserted++
			} else {
				stats.updated++
			}
		}
	}

	return stats
}

func (imp *Importer) processCity(ctx context.Context, city SimpleMapsCity) processResult {
	// Get country ID (create if missing AND timezone available)
	countryID, ok := imp.countryCodeToID[city.ISO2]
	if !ok {
		// Skip if no timezone - can't create country or city without timezone
		if city.Timezone == "" {
			imp.recordSkip("no_timezone", city, "SimpleMaps Basic lacks timezone - skip country/city creation (use Pro version)")
			return processResult{status: "no_country"}
		}

		// Create missing country (only if timezone available)
		if imp.dryRun {
			imp.log("CREATE COUNTRY (dry-run) %s (%s)", city.Country, city.ISO2)
			// In dry-run, we can't proceed without a country ID
			imp.recordSkip("no_country_dryrun", city, fmt.Sprintf("country %s would be created (dry-run)", city.ISO2))
			return processResult{status: "no_country"}
		}

		newCountryID, err := imp.createCountry(ctx, city)
		if err != nil {
			imp.recordSkip("create_country_error", city, fmt.Sprintf("failed to create country %s: %v", city.ISO2, err))
			return processResult{status: "no_country"}
		}
		countryID = newCountryID
		imp.log("CREATE COUNTRY %s (%s) -> country_id=%d", city.Country, city.ISO2, countryID)
	}

	// Find matching city
	match, err := imp.findMatchingCity(ctx, city, countryID)
	if err != nil {
		imp.recordSkip("error", city, err.Error())
		return processResult{status: "skipped"}
	}

	// If no match found, create new city ONLY if timezone is available
	if match == nil {
		// Skip city creation if no timezone (Basic version)
		if city.Timezone == "" {
			imp.recordSkip("no_timezone", city, "SimpleMaps Basic lacks timezone - skip city creation (use Pro version)")
			return processResult{status: "skipped"}
		}

		if imp.dryRun {
			imp.log("CREATE (dry-run) %s (%s) | timezone=%s | lat=%.4f lng=%.4f", city.City, city.ISO2, city.Timezone, city.Lat, city.Lng)
			return processResult{status: "created", cityCreated: true}
		}

		// Create new city (only reached if timezone is available)
		cityID, err := imp.createCity(ctx, city, countryID)
		if err != nil {
			imp.recordSkip("create_error", city, fmt.Sprintf("failed to create city: %v", err))
			return processResult{status: "skipped"}
		}

		// Assign region/district via point-in-polygon matching
		if err := imp.assignCityHierarchy(ctx, cityID); err != nil {
			imp.log("WARN: Created city %s but failed to assign hierarchy: %v", cityID, err)
		}

		imp.log("CREATE %s (%s) -> city_id=%s | timezone=%s | lat=%.4f lng=%.4f", city.City, city.ISO2, cityID, city.Timezone, city.Lat, city.Lng)

		// Insert coordinate for newly created city
		inserted, err := imp.upsertCoordinateByID(ctx, city, cityID)
		if err != nil {
			imp.recordSkip("upsert_error", city, fmt.Sprintf("created city but failed to add coordinates: %v", err))
			return processResult{status: "skipped"}
		}
		return processResult{status: "created", inserted: inserted, cityCreated: true}
	}

	// Validate match
	if !imp.validateMatch(city, match) {
		imp.recordSkip("rejected", city, fmt.Sprintf("validation failed (dist=%.1fkm, sim=%.2f)", match.DistanceKm, match.Similarity))
		return processResult{status: "rejected"}
	}

	// Log match
	imp.logMatch(city, match)

	// Insert/update if not dry run
	if !imp.dryRun {
		inserted, err := imp.upsertCoordinate(ctx, city, match)
		if err != nil {
			imp.recordSkip("upsert_error", city, err.Error())
			return processResult{status: "skipped"}
		}
		return processResult{status: "matched", inserted: inserted}
	}

	return processResult{status: "matched"}
}

// =============================================================================
// CITY MATCHING
// =============================================================================

// cityMatch represents a matched WOF city
type cityMatch struct {
	CityID       string
	CityName     string
	WOFLat       float64
	WOFLng       float64
	DistanceKm   float64
	MatchType    string
	RegionID     *int64
	RegionName   *string
	DistrictID   *int64
	DistrictName *string
	Similarity   float64
}

func (imp *Importer) findMatchingCity(ctx context.Context, city SimpleMapsCity, countryID int64) (*cityMatch, error) {
	var match cityMatch

	// Single query with prioritized matching using UNION ALL
	// Priority: 1=exact, 2=normalized, 3=alt_name, 4=fuzzy, 5=fuzzy_alt
	// Uses location GiST index via ST_DWithin on the indexed column
	normalizedName := normalizeCityName(city.CityASCII)

	err := imp.pool.QueryRow(ctx, `
		WITH search_point AS (
			SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
		),
		candidates AS (
			-- Pass 1: Exact name match
			SELECT c.id, c.name, c.latitude, c.longitude, c.region_id, c.district_id,
				1 AS priority, 1.0::float AS similarity
			FROM geo_cities c, search_point sp
			WHERE c.country_id = $3
			  AND LOWER(c.name_ascii) = LOWER($4)
			  AND ST_DWithin(c.location, sp.geog, $5 * 1000)

			UNION ALL

			-- Pass 2: Normalized name match
			SELECT c.id, c.name, c.latitude, c.longitude, c.region_id, c.district_id,
				2 AS priority, 1.0::float AS similarity
			FROM geo_cities c, search_point sp
			WHERE c.country_id = $3
			  AND $6 != ''
			  AND LOWER(c.name_ascii) LIKE $6 || '%'
			  AND ST_DWithin(c.location, sp.geog, $5 * 1000)

			UNION ALL

			-- Pass 3: Alternative names
			SELECT c.id, c.name, c.latitude, c.longitude, c.region_id, c.district_id,
				3 AS priority, 1.0::float AS similarity
			FROM geo_cities c
			INNER JOIN geo_names gn ON gn.entity_type_id = $7 AND gn.entity_id = c.id
			, search_point sp
			WHERE c.country_id = $3
			  AND LOWER(gn.name) = LOWER($4)
			  AND ST_DWithin(c.location, sp.geog, $5 * 1000)

			UNION ALL

			-- Pass 4: Fuzzy match (tighter 25km radius)
			SELECT c.id, c.name, c.latitude, c.longitude, c.region_id, c.district_id,
				4 AS priority, similarity(LOWER(c.name_ascii), LOWER($4)) AS similarity
			FROM geo_cities c, search_point sp
			WHERE c.country_id = $3
			  AND c.name_ascii != ''
			  AND c.name_ascii % $4
			  AND ST_DWithin(c.location, sp.geog, 25000)

			UNION ALL

			-- Pass 5: Fuzzy on alternative names (tighter 25km radius)
			SELECT c.id, c.name, c.latitude, c.longitude, c.region_id, c.district_id,
				5 AS priority, similarity(LOWER(gn.name), LOWER($4)) AS similarity
			FROM geo_cities c
			INNER JOIN geo_names gn ON gn.entity_type_id = $7 AND gn.entity_id = c.id
			, search_point sp
			WHERE c.country_id = $3
			  AND gn.name % $4
			  AND ST_DWithin(c.location, sp.geog, 25000)
		),
		best AS (
			SELECT DISTINCT ON (id) *
			FROM candidates
			WHERE similarity > 0.4
			ORDER BY id, priority, similarity DESC
		)
		SELECT b.id, b.name, b.latitude, b.longitude,
			ST_Distance(
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
				ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography
			) / 1000.0 AS distance_km,
			CASE b.priority
				WHEN 1 THEN 'exact'
				WHEN 2 THEN 'normalized'
				WHEN 3 THEN 'alt_name'
				WHEN 4 THEN 'fuzzy'
				WHEN 5 THEN 'fuzzy_alt'
			END AS match_type,
			b.region_id, r.name, b.district_id, d.name,
			b.similarity
		FROM best b
		LEFT JOIN geo_regions r ON r.id = b.region_id
		LEFT JOIN geo_districts d ON d.id = b.district_id
		ORDER BY b.priority, b.similarity DESC, distance_km
		LIMIT 1
	`, city.Lng, city.Lat, countryID, city.CityASCII, imp.maxDistance, normalizedName, imp.geoLevelIDs["city"]).Scan(
		&match.CityID, &match.CityName, &match.WOFLat, &match.WOFLng,
		&match.DistanceKm, &match.MatchType,
		&match.RegionID, &match.RegionName, &match.DistrictID, &match.DistrictName,
		&match.Similarity,
	)

	if err == nil {
		return &match, nil
	}
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return nil, err
}

func (imp *Importer) validateMatch(city SimpleMapsCity, match *cityMatch) bool {
	// Distance must be within limit
	if match.DistanceKm > imp.maxDistance {
		return false
	}

	// For fuzzy matches, require tighter distance (25km)
	if strings.HasPrefix(match.MatchType, "fuzzy") && match.DistanceKm > 25 {
		return false
	}

	return true
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

// createCountry creates a new geo_countries record from SimpleMaps data
func (imp *Importer) createCountry(ctx context.Context, city SimpleMapsCity) (int64, error) {
	// Get continent code from ISO2
	continentCode, ok := iso2ToContinent[city.ISO2]
	if !ok {
		return 0, fmt.Errorf("no continent mapping for ISO2 code %s", city.ISO2)
	}

	// Get continent ID
	continentID, ok := imp.continentIDs[continentCode]
	if !ok {
		return 0, fmt.Errorf("continent code %s not found in database", continentCode)
	}

	// Create country record
	var countryID int64
	err := imp.pool.QueryRow(ctx, `
		INSERT INTO geo_countries (code, code_iso3, name, continent_id, has_adm1, has_adm2, is_city_state)
		VALUES ($1, $2, $3, $4, false, false, false)
		RETURNING id
	`, city.ISO2, city.ISO3, city.Country, continentID).Scan(&countryID)

	if err != nil {
		return 0, fmt.Errorf("insert country: %w", err)
	}

	// Update local cache
	imp.countryCodeToID[city.ISO2] = countryID
	imp.countryToCont[countryID] = continentID

	return countryID, nil
}

// createCity creates a new geo_cities record with continent_id and country_id
// Region and district are assigned later via point-in-polygon matching
func (imp *Importer) createCity(ctx context.Context, city SimpleMapsCity, countryID int64) (string, error) {
	continentID := imp.countryToCont[countryID]

	// Use SimpleMaps timezone if available, otherwise default to UTC
	timezone := city.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	var cityID int
	err := imp.pool.QueryRow(ctx, `
		INSERT INTO geo_cities (
			name, name_ascii, latitude, longitude,
			country_id, continent_id, timezone,
			population, coordinate_source_id
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, city.City, city.CityASCII, city.Lat, city.Lng,
		countryID, continentID, timezone,
		city.Population, imp.sourceIDs["simplemaps"]).Scan(&cityID)

	if err != nil {
		return "", fmt.Errorf("insert city: %w", err)
	}

	return fmt.Sprintf("%d", cityID), nil
}

// assignCityHierarchy assigns region_id and district_id via point-in-polygon matching
func (imp *Importer) assignCityHierarchy(ctx context.Context, cityID string) error {
	// Try to assign region
	var regionID *int64
	err := imp.pool.QueryRow(ctx, `
		SELECT r.id
		FROM geo_regions r
		JOIN geo_cities c ON c.id = $1
		WHERE r.country_id = c.country_id
		  AND ST_Intersects(r.boundary, c.location)
		LIMIT 1
	`, cityID).Scan(&regionID)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("assign region: %w", err)
	}

	// Try to assign district
	var districtID *int64
	if regionID != nil {
		err = imp.pool.QueryRow(ctx, `
			SELECT d.id
			FROM geo_districts d
			JOIN geo_cities c ON c.id = $1
			WHERE d.region_id = $2
			  AND ST_Intersects(d.boundary, c.location)
			LIMIT 1
		`, cityID, *regionID).Scan(&districtID)
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("assign district: %w", err)
		}
	}

	// Update city with hierarchy
	if regionID != nil || districtID != nil {
		_, err = imp.pool.Exec(ctx, `
			UPDATE geo_cities
			SET region_id = $2, district_id = $3
			WHERE id = $1
		`, cityID, regionID, districtID)
		if err != nil {
			return fmt.Errorf("update city hierarchy: %w", err)
		}
	}

	return nil
}

func (imp *Importer) upsertCoordinate(ctx context.Context, city SimpleMapsCity, match *cityMatch) (bool, error) {
	return imp.upsertCoordinateByID(ctx, city, match.CityID)
}

func (imp *Importer) upsertCoordinateByID(ctx context.Context, city SimpleMapsCity, cityID string) (bool, error) {
	sourceID := imp.sourceIDs["simplemaps"]
	var inserted bool
	err := imp.pool.QueryRow(ctx, `
		INSERT INTO geo_city_coordinates (city_id, source_id, external_id, latitude, longitude, accuracy_m)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (city_id, source_id, COALESCE(publisher_id, '00000000-0000-0000-0000-000000000000'))
		DO UPDATE SET
			latitude = EXCLUDED.latitude,
			longitude = EXCLUDED.longitude,
			external_id = EXCLUDED.external_id,
			updated_at = now()
		RETURNING (xmax = 0) AS inserted
	`, cityID, sourceID, city.ID, city.Lat, city.Lng, 100).Scan(&inserted)

	return inserted, err
}

// bulkUpdateGeoCities updates geo_cities.latitude/longitude from simplemaps coordinates
// in a single query (much faster than per-row trigger)
func (imp *Importer) bulkUpdateGeoCities(ctx context.Context) (int64, error) {
	sourceID := imp.sourceIDs["simplemaps"]
	// Update geo_cities with simplemaps coordinates where simplemaps has higher priority than current source
	// This replicates the trigger logic but in bulk
	result, err := imp.pool.Exec(ctx, `
		UPDATE geo_cities c
		SET
			latitude = cc.latitude,
			longitude = cc.longitude,
			coordinate_source_id = $1,
			updated_at = now()
		FROM geo_city_coordinates cc
		JOIN geo_data_sources s_new ON s_new.id = cc.source_id
		LEFT JOIN geo_data_sources s_old ON s_old.id = c.coordinate_source_id
		WHERE cc.city_id = c.id
		  AND cc.source_id = $1
		  AND cc.publisher_id IS NULL
		  AND s_new.is_active = true
		  AND (s_old.id IS NULL OR s_new.priority < s_old.priority)
	`, sourceID)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

// =============================================================================
// TERRITORY CREATION
// =============================================================================

type territoryInfo struct {
	Name          string
	ContinentCode string
}

// iso2ToContinent maps ISO 3166-1 alpha-2 country codes to continent codes.
// Source: https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes
// Continent codes: AF=Africa, AS=Asia, EU=Europe, NA=North America, SA=South America, OC=Oceania, AN=Antarctica
var iso2ToContinent = map[string]string{
	"AF": "AS", "AX": "EU", "AL": "EU", "DZ": "AF", "AS": "OC", "AD": "EU", "AO": "AF", "AI": "NA",
	"AG": "NA", "AR": "SA", "AM": "AS", "AW": "NA", "AU": "OC", "AT": "EU", "AZ": "AS", "BS": "NA",
	"BH": "AS", "BD": "AS", "BB": "NA", "BY": "EU", "BE": "EU", "BZ": "NA", "BJ": "AF", "BM": "NA",
	"BT": "AS", "BO": "SA", "BQ": "NA", "BA": "EU", "BW": "AF", "BV": "SA", "BR": "SA", "IO": "AF",
	"BN": "AS", "BG": "EU", "BF": "AF", "BI": "AF", "CV": "AF", "KH": "AS", "CM": "AF", "CA": "NA",
	"KY": "NA", "CF": "AF", "TD": "AF", "CL": "SA", "CN": "AS", "CX": "OC", "CC": "OC", "CO": "SA",
	"KM": "AF", "CG": "AF", "CD": "AF", "CK": "OC", "CR": "NA", "CI": "AF", "HR": "EU", "CU": "NA",
	"CW": "NA", "CY": "AS", "CZ": "EU", "DK": "EU", "DJ": "AF", "DM": "NA", "DO": "NA", "EC": "SA",
	"EG": "AF", "SV": "NA", "GQ": "AF", "ER": "AF", "EE": "EU", "SZ": "AF", "ET": "AF", "FK": "SA",
	"FO": "EU", "FJ": "OC", "FI": "EU", "FR": "EU", "GF": "SA", "PF": "OC", "TF": "AF", "GA": "AF",
	"GM": "AF", "GE": "AS", "DE": "EU", "GH": "AF", "GI": "EU", "GR": "EU", "GL": "NA", "GD": "NA",
	"GP": "NA", "GU": "OC", "GT": "NA", "GG": "EU", "GN": "AF", "GW": "AF", "GY": "SA", "HT": "NA",
	"HM": "OC", "VA": "EU", "HN": "NA", "HK": "AS", "HU": "EU", "IS": "EU", "IN": "AS", "ID": "AS",
	"IR": "AS", "IQ": "AS", "IE": "EU", "IM": "EU", "IL": "AS", "IT": "EU", "JM": "NA", "JP": "AS",
	"JE": "EU", "JO": "AS", "KZ": "AS", "KE": "AF", "KI": "OC", "KP": "AS", "KR": "AS", "KW": "AS",
	"KG": "AS", "LA": "AS", "LV": "EU", "LB": "AS", "LS": "AF", "LR": "AF", "LY": "AF", "LI": "EU",
	"LT": "EU", "LU": "EU", "MO": "AS", "MG": "AF", "MW": "AF", "MY": "AS", "MV": "AS", "ML": "AF",
	"MT": "EU", "MH": "OC", "MQ": "NA", "MR": "AF", "MU": "AF", "YT": "AF", "MX": "NA", "FM": "OC",
	"MD": "EU", "MC": "EU", "MN": "AS", "ME": "EU", "MS": "NA", "MA": "AF", "MZ": "AF", "MM": "AS",
	"NA": "AF", "NR": "OC", "NP": "AS", "NL": "EU", "NC": "OC", "NZ": "OC", "NI": "NA", "NE": "AF",
	"NG": "AF", "NU": "OC", "NF": "OC", "MK": "EU", "MP": "OC", "NO": "EU", "OM": "AS", "PK": "AS",
	"PW": "OC", "PS": "AS", "PA": "NA", "PG": "OC", "PY": "SA", "PE": "SA", "PH": "AS", "PN": "OC",
	"PL": "EU", "PT": "EU", "PR": "NA", "QA": "AS", "RE": "AF", "RO": "EU", "RU": "EU", "RW": "AF",
	"BL": "NA", "SH": "AF", "KN": "NA", "LC": "NA", "MF": "NA", "PM": "NA", "VC": "NA", "WS": "OC",
	"SM": "EU", "ST": "AF", "SA": "AS", "SN": "AF", "RS": "EU", "SC": "AF", "SL": "AF", "SG": "AS",
	"SX": "NA", "SK": "EU", "SI": "EU", "SB": "OC", "SO": "AF", "ZA": "AF", "GS": "SA", "SS": "AF",
	"ES": "EU", "LK": "AS", "SD": "AF", "SR": "SA", "SJ": "EU", "SE": "EU", "CH": "EU", "SY": "AS",
	"TW": "AS", "TJ": "AS", "TZ": "AF", "TH": "AS", "TL": "AS", "TG": "AF", "TK": "OC", "TO": "OC",
	"TT": "NA", "TN": "AF", "TR": "AS", "TM": "AS", "TC": "NA", "TV": "OC", "UG": "AF", "UA": "EU",
	"AE": "AS", "GB": "EU", "US": "NA", "UM": "OC", "UY": "SA", "UZ": "AS", "VU": "OC", "VE": "SA",
	"VN": "AS", "VG": "NA", "VI": "NA", "WF": "OC", "EH": "AF", "YE": "AS", "ZM": "AF", "ZW": "AF",
	// Special cases
	"AQ": "AN", // Antarctica
	"XK": "EU", // Kosovo (disputed)
	"XG": "AS", // Gaza Strip
	"XW": "AS", // West Bank
}

// missingTerritories maps ISO codes to territory info for territories
// that SimpleMaps uses but WOF doesn't have
var missingTerritories = map[string]territoryInfo{
	// US Territories
	"PR": {Name: "Puerto Rico", ContinentCode: "NA"},
	"GU": {Name: "Guam", ContinentCode: "OC"},
	"VI": {Name: "U.S. Virgin Islands", ContinentCode: "NA"},
	"AS": {Name: "American Samoa", ContinentCode: "OC"},
	"MP": {Name: "Northern Mariana Islands", ContinentCode: "OC"},

	// French Territories
	"RE": {Name: "Réunion", ContinentCode: "AF"},
	"MQ": {Name: "Martinique", ContinentCode: "NA"},
	"GP": {Name: "Guadeloupe", ContinentCode: "NA"},
	"GF": {Name: "French Guiana", ContinentCode: "SA"},
	"YT": {Name: "Mayotte", ContinentCode: "AF"},
	"NC": {Name: "New Caledonia", ContinentCode: "OC"},
	"PF": {Name: "French Polynesia", ContinentCode: "OC"},
	"PM": {Name: "Saint Pierre and Miquelon", ContinentCode: "NA"},
	"WF": {Name: "Wallis and Futuna", ContinentCode: "OC"},
	"BL": {Name: "Saint Barthélemy", ContinentCode: "NA"},
	"MF": {Name: "Saint Martin", ContinentCode: "NA"},

	// UK Territories
	"GI": {Name: "Gibraltar", ContinentCode: "EU"},
	"FK": {Name: "Falkland Islands", ContinentCode: "SA"},
	"GG": {Name: "Guernsey", ContinentCode: "EU"},
	"JE": {Name: "Jersey", ContinentCode: "EU"},
	"IM": {Name: "Isle of Man", ContinentCode: "EU"},
	"KY": {Name: "Cayman Islands", ContinentCode: "NA"},
	"BM": {Name: "Bermuda", ContinentCode: "NA"},
	"VG": {Name: "British Virgin Islands", ContinentCode: "NA"},
	"TC": {Name: "Turks and Caicos Islands", ContinentCode: "NA"},
	"MS": {Name: "Montserrat", ContinentCode: "NA"},
	"AI": {Name: "Anguilla", ContinentCode: "NA"},
	"SH": {Name: "Saint Helena", ContinentCode: "AF"},

	// Netherlands Territories
	"AW": {Name: "Aruba", ContinentCode: "NA"},
	"CW": {Name: "Curaçao", ContinentCode: "NA"},
	"SX": {Name: "Sint Maarten", ContinentCode: "NA"},
	"BQ": {Name: "Caribbean Netherlands", ContinentCode: "NA"},

	// Other Territories
	"HK": {Name: "Hong Kong", ContinentCode: "AS"},
	"MO": {Name: "Macau", ContinentCode: "AS"},
	"FO": {Name: "Faroe Islands", ContinentCode: "EU"},
	"GL": {Name: "Greenland", ContinentCode: "NA"},
	"CK": {Name: "Cook Islands", ContinentCode: "OC"},
	"NU": {Name: "Niue", ContinentCode: "OC"},
	"TK": {Name: "Tokelau", ContinentCode: "OC"},

	// Disputed/Special territories
	"XG": {Name: "Gaza Strip", ContinentCode: "AS"},
	"XW": {Name: "West Bank", ContinentCode: "AS"},
	"XK": {Name: "Kosovo", ContinentCode: "EU"},
}

func (imp *Importer) createMissingTerritories(ctx context.Context) (int, error) {
	// Load continent IDs
	imp.continentIDs = make(map[string]int64)
	rows, err := imp.pool.Query(ctx, "SELECT id, code FROM geo_continents")
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var code string
		if err := rows.Scan(&id, &code); err != nil {
			continue
		}
		imp.continentIDs[code] = id
	}

	created := 0
	for code, info := range missingTerritories {
		if _, exists := imp.countryCodeToID[code]; exists {
			continue
		}

		continentID, ok := imp.continentIDs[info.ContinentCode]
		if !ok {
			imp.log("WARN: Unknown continent %s for territory %s", info.ContinentCode, code)
			continue
		}

		var newID int64
		err := imp.pool.QueryRow(ctx, `
			INSERT INTO geo_countries (code, name, continent_id, has_adm1, has_adm2, is_city_state)
			VALUES ($1, $2, $3, false, false, false)
			RETURNING id
		`, code, info.Name, continentID).Scan(&newID)
		if err != nil {
			imp.log("WARN: Failed to create territory %s: %v", code, err)
			continue
		}

		imp.countryCodeToID[code] = newID
		imp.log("Created territory: %s (%s)", info.Name, code)
		created++
	}

	return created, nil
}

// =============================================================================
// LOGGING
// =============================================================================

func (imp *Importer) log(format string, args ...interface{}) {
	imp.logMu.Lock()
	defer imp.logMu.Unlock()
	fmt.Fprintf(imp.logFile, format+"\n", args...)
}

func (imp *Importer) recordSkip(reason string, city SimpleMapsCity, detail string) {
	imp.skipReasonsMu.Lock()
	imp.skipReasons[reason]++
	imp.skipReasonsMu.Unlock()

	imp.log("SKIP [%s] %s (%s) | %s | lat=%.4f lng=%.4f | %s",
		reason, city.City, city.ISO2, city.AdminName, city.Lat, city.Lng, detail)
}

func (imp *Importer) logMatch(city SimpleMapsCity, match *cityMatch) {
	imp.log("MATCH [%s] %s (%s) -> %s | dist=%.2fkm sim=%.2f",
		match.MatchType, city.City, city.ISO2, match.CityName, match.DistanceKm, match.Similarity)
}

// Alias to geo package function for convenience
var normalizeCityName = geo.NormalizeCityName
