// Package main imports geographic data from Who's On First (WOF).
//
// WOF is the SINGLE SOURCE OF TRUTH for geographic hierarchy:
//   - Countries (placetype=country)
//   - Regions (placetype=region) - states, provinces
//   - Districts (placetype=county) - counties, boroughs
//   - Cities (placetype=locality)
//
// Each WOF record contains wof:hierarchy with direct ID links:
//
//	{"country_id": 85633147, "region_id": 85683255, "county_id": 102072387, "locality_id": 101750223}
//
// NO name matching. NO point-in-polygon. Just direct WOF ID references.
//
// Data Source:
//   - WOF: https://data.geocode.earth/wof/dist/sqlite/whosonfirst-data-admin-latest.db.bz2 (~8.6GB)
//
// Note: Elevation data is handled separately by cmd/import-elevation.
package main

import (
	"compress/bzip2"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim-lab/internal/geo"
	_ "github.com/mattn/go-sqlite3"
)

const (
	wofAdminDBURL  = "https://data.geocode.earth/wof/dist/sqlite/whosonfirst-data-admin-latest.db.bz2"
	defaultDataDir = "data/wof"
	defaultDBFile  = "whosonfirst-data-admin-latest.db"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "download":
		cmdDownload(os.Args[2:])
	case "import":
		cmdImport(os.Args[2:])
	case "seed":
		cmdSeed(os.Args[2:])
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
	fmt.Fprintf(os.Stderr, `WOF Geographic Data Import Tool

Single source of truth for geographic hierarchy (names, coordinates, boundaries).

Commands:
  download    Download WOF SQLite database (~8.6GB compressed → ~40GB)
  import      Import WOF data into PostgreSQL
  seed        Download + import in one step
  status      Show current status
  reset       Nuclear wipe - delete ALL geographic data from database

Options (for import):
  --dir PATH    Data directory (default: %s)
  -v, --verbose Show detailed logging
  --no-cache    Delete cache files before import (force re-extraction from WOF)

Environment:
  DATABASE_URL    PostgreSQL connection string (required for import/seed)

Data Source:
  WOF: %s

Hierarchy (from wof:hierarchy property - NO matching needed):
  country_id  → geo_countries
  region_id   → geo_regions
  county_id   → geo_districts
  locality_id → geo_cities

Cache Files (automatically reused if present):
  wof-cities-cache.jsonl      City records with resolved hierarchy
  wof-city-names-cache.jsonl  Multi-language city names
  wof-city-boundaries-cache.jsonl  City boundary geometries

Note: Cache files are automatically detected and reused. Delete them to force re-extraction.

Note: Run 'go run ./cmd/import-elevation' after import to populate elevation data.
`, defaultDataDir, wofAdminDBURL)
}

// =============================================================================
// DOWNLOAD
// =============================================================================

func cmdDownload(args []string) {
	dataDir := defaultDataDir
	forceDownload := false
	for i := 0; i < len(args); i++ {
		if args[i] == "--dir" && i+1 < len(args) {
			dataDir = args[i+1]
			i++
		}
		if args[i] == "--force" || args[i] == "-f" {
			forceDownload = true
		}
	}

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("Failed to create directory: %v", err)
	}

	dbPath := filepath.Join(dataDir, defaultDBFile)
	tmpPath := dbPath + ".tmp"

	// Clean up any stale .tmp file from interrupted downloads
	if _, err := os.Stat(tmpPath); err == nil {
		fmt.Printf("Removing stale temp file: %s\n", tmpPath)
		os.Remove(tmpPath)
	}

	// Skip if already downloaded (unless --force)
	if info, err := os.Stat(dbPath); err == nil && !forceDownload {
		fmt.Printf("✓ Already downloaded: %s (%.1f GB)\n", dbPath, float64(info.Size())/1e9)
		fmt.Println("  Use --force to re-download")
		return
	}

	fmt.Println("Downloading WOF admin database...")
	fmt.Printf("Source: %s\n", wofAdminDBURL)
	fmt.Printf("Target: %s\n", dbPath)
	fmt.Println("Size: ~8.6GB compressed → ~40GB uncompressed")
	fmt.Println("This may take 30-60 minutes...\n")

	if err := downloadBZ2(wofAdminDBURL, dbPath); err != nil {
		log.Fatalf("Download failed: %v", err)
	}

	info, _ := os.Stat(dbPath)
	fmt.Printf("\nDone: %s (%.1f GB)\n", dbPath, float64(info.Size())/1e9)
}

func downloadBZ2(url, destPath string) error {
	tmpPath := destPath + ".tmp"
	defer os.Remove(tmpPath)

	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer out.Close()

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	fmt.Printf("Downloading and decompressing (%.1f GB compressed)...\n", float64(resp.ContentLength)/1e9)

	pr := &progressReader{r: resp.Body, total: resp.ContentLength, start: time.Now()}
	bzr := bzip2.NewReader(pr)

	if _, err := io.Copy(out, bzr); err != nil {
		return err
	}

	out.Close()
	return os.Rename(tmpPath, destPath)
}

type progressReader struct {
	r       io.Reader
	total   int64
	read    int64
	start   time.Time
	lastLog time.Time
}

func (p *progressReader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	p.read += int64(n)
	if time.Since(p.lastLog) > 5*time.Second {
		p.lastLog = time.Now()
		pct := float64(p.read) / float64(p.total) * 100
		elapsed := time.Since(p.start)
		speed := float64(p.read) / elapsed.Seconds() / 1e6
		eta := time.Duration(float64(p.total-p.read)/float64(p.read)*float64(elapsed))
		fmt.Printf("  %.1f%% (%.1f MB/s, ETA %s)\n", pct, speed, eta.Round(time.Second))
	}
	return n, err
}

// =============================================================================
// IMPORT
// =============================================================================

func cmdImport(args []string) {
	dataDir := defaultDataDir
	verbose := false
	noCache := false
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--dir":
			if i+1 < len(args) {
				dataDir = args[i+1]
				i++
			}
		case "-v", "--verbose":
			verbose = true
		case "--no-cache":
			noCache = true
		}
	}

	dbPath := filepath.Join(dataDir, defaultDBFile)
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		log.Fatalf("WOF database not found: %s\nRun 'import-wof download' first.", dbPath)
	}

	pgURL := os.Getenv("DATABASE_URL")
	if pgURL == "" {
		log.Fatal("DATABASE_URL required")
	}

	ctx := context.Background()

	// Open WOF SQLite with optimizations
	wofDB, err := sql.Open("sqlite3", dbPath+"?mode=ro&_journal_mode=OFF&_synchronous=OFF&cache=shared")
	if err != nil {
		log.Fatalf("Failed to open WOF: %v", err)
	}
	defer wofDB.Close()
	// Allow more concurrent reads from SQLite
	wofDB.SetMaxOpenConns(4)

	// Open PostgreSQL with optimized pool for bulk operations
	pgConfig, err := pgxpool.ParseConfig(pgURL)
	if err != nil {
		log.Fatalf("Failed to parse DATABASE_URL: %v", err)
	}
	pgConfig.MaxConns = 20
	pgConfig.MinConns = 5

	pgPool, err := pgxpool.NewWithConfig(ctx, pgConfig)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pgPool.Close()

	// Wipe cache files if --no-cache flag is set
	if noCache {
		citiesPath := filepath.Join(dataDir, "wof-cities-cache.jsonl")
		namesPath := filepath.Join(dataDir, "wof-city-names-cache.jsonl")
		boundariesPath := filepath.Join(dataDir, "wof-city-boundaries-cache.jsonl")

		log.Println("--no-cache: Deleting cache files...")
		for _, path := range []string{citiesPath, namesPath, boundariesPath} {
			if _, err := os.Stat(path); err == nil {
				if err := os.Remove(path); err != nil {
					log.Printf("  Warning: could not delete %s: %v", path, err)
				} else {
					log.Printf("  Deleted: %s", path)
				}
			}
		}
	}

	imp := &Importer{
		wofDB:   wofDB,
		pgPool:  pgPool,
		verbose: verbose,
		wofToPG: make(map[int64]int64), // WOF ID → PostgreSQL ID
		dataDir: dataDir,
	}

	if err := imp.Run(ctx); err != nil {
		log.Fatalf("Import failed: %v", err)
	}
}

func cmdSeed(args []string) {
	// Check DATABASE_URL first
	if os.Getenv("DATABASE_URL") == "" {
		log.Fatal("DATABASE_URL required")
	}

	// Download if needed
	cmdDownload(args)
	fmt.Println()

	// Import
	cmdImport(args)
}

func cmdStatus(args []string) {
	dataDir := defaultDataDir
	for i := 0; i < len(args); i++ {
		if args[i] == "--dir" && i+1 < len(args) {
			dataDir = args[i+1]
			i++
		}
	}

	// Check WOF file
	dbPath := filepath.Join(dataDir, defaultDBFile)
	fmt.Println("=== WOF Database ===")
	if info, err := os.Stat(dbPath); err == nil {
		fmt.Printf("Path: %s\n", dbPath)
		fmt.Printf("Size: %.1f GB\n", float64(info.Size())/1e9)
	} else {
		fmt.Printf("Not found: %s\n", dbPath)
	}

	// Check PostgreSQL
	pgURL := os.Getenv("DATABASE_URL")
	if pgURL == "" {
		fmt.Println("\n(Set DATABASE_URL to see PostgreSQL status)")
		return
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		fmt.Printf("\nPostgreSQL error: %v\n", err)
		return
	}
	defer pool.Close()

	fmt.Println("\n=== PostgreSQL ===")
	var c, r, d, ci int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_countries").Scan(&c)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_regions").Scan(&r)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_districts").Scan(&d)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_cities").Scan(&ci)
	fmt.Printf("Countries:  %d\n", c)
	fmt.Printf("Regions:    %d\n", r)
	fmt.Printf("Districts:  %d\n", d)
	fmt.Printf("Cities:     %d\n", ci)
}

// =============================================================================
// RESET (Nuclear Wipe)
// =============================================================================

func cmdReset(args []string) {
	// Check for --confirm flag
	confirmed := false
	for _, arg := range args {
		if arg == "--confirm" || arg == "-y" {
			confirmed = true
		}
	}

	if !confirmed {
		fmt.Println("⚠️  NUCLEAR RESET - This will DELETE ALL geographic data:")
		fmt.Println("")
		fmt.Println("   Tables to be wiped:")
		fmt.Println("   - geo_cities (all rows)")
		fmt.Println("   - geo_city_coordinates (all WOF coordinates)")
		fmt.Println("   - geo_city_elevations (all elevation data)")
		fmt.Println("   - geo_districts + geo_district_boundaries")
		fmt.Println("   - geo_regions + geo_region_boundaries")
		fmt.Println("   - geo_countries + geo_country_boundaries")
		fmt.Println("   - geo_continents (imported from WOF)")
		fmt.Println("   - geo_boundary_imports")
		fmt.Println("   - geo_name_mappings")
		fmt.Println("   - publisher_coverage (all geographic coverage)")
		fmt.Println("")
		fmt.Println("   This will NOT delete:")
		fmt.Println("   - publishers (preserved)")
		fmt.Println("   - publisher_zmanim (preserved)")
		fmt.Println("")
		fmt.Println("To proceed, run:")
		fmt.Println("   go run ./cmd/import-wof reset --confirm")
		return
	}

	pgURL := os.Getenv("DATABASE_URL")
	if pgURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, pgURL)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pool.Close()

	fmt.Println("🔥 NUCLEAR RESET - Deleting all geographic data...")
	fmt.Println("")

	// Use TRUNCATE CASCADE on parent tables - it will cascade to children
	// This is faster and handles FK dependencies automatically
	_, err = pool.Exec(ctx, `
		TRUNCATE
			geo_continents,
			geo_countries,
			geo_regions,
			geo_districts,
			geo_cities,
			geo_names,
			geo_city_elevations,
			geo_city_coordinates,
			geo_country_boundaries,
			geo_region_boundaries,
			geo_district_boundaries,
			geo_city_boundaries,
			geo_boundary_imports,
			geo_name_mappings,
			publisher_coverage
		CASCADE
	`)
	if err != nil {
		fmt.Printf("   ❌ TRUNCATE failed: %v\n", err)
		fmt.Println("   Falling back to DELETE...")

		// Fallback: delete in order
		tables := []string{
			"publisher_coverage",
			"geo_boundary_imports",
			"geo_name_mappings",
			"geo_names",
			"geo_city_elevations",
			"geo_city_coordinates",
			"geo_city_boundaries",
			"geo_cities",
			"geo_district_boundaries",
			"geo_districts",
			"geo_region_boundaries",
			"geo_regions",
			"geo_country_boundaries",
			"geo_countries",
			"geo_continents",
		}
		for _, t := range tables {
			_, _ = pool.Exec(ctx, "DELETE FROM "+t)
			fmt.Printf("   ✓ %s cleared\n", t)
		}
	} else {
		fmt.Println("   ✓ All geographic tables truncated")
	}

	fmt.Println("")
	fmt.Println("✅ Database reset complete. Ready for fresh import.")
	fmt.Println("   Continents will be imported from WOF during import.")
	fmt.Println("")
	fmt.Println("Next step:")
	fmt.Println("   go run ./cmd/import-wof seed")
}

// =============================================================================
// IMPORTER
// =============================================================================

type Importer struct {
	wofDB           *sql.DB
	pgPool          *pgxpool.Pool
	verbose         bool
	wofToPG         map[int64]int64 // WOF ID → PostgreSQL ID (for all placetypes)
	wofContinentMap map[int64]int   // WOF continent ID → our geo_continents.id
	geoNamesBatch   []geoNameEntry  // Batch queue for geo_names inserts
	dataDir         string          // Data directory for cache files
	geoLevelIDs     map[string]int  // geo_levels lookup: "city" -> ID, "country" -> ID, etc.
	sourceIDs       map[string]int  // geo_data_sources lookup: "wof" -> ID
	importID        int             // geo_data_imports.id for this import run
	stats           importStats     // Statistics for this import
}

type importStats struct {
	continents int
	countries  int
	regions    int
	districts  int
	cities     int
	errors     []string
}

// WOFRecord holds data extracted from WOF SQLite
type WOFRecord struct {
	WOFID      int64
	Name       string
	Names      map[string]string // language code -> name (from name:xxx_x_preferred)
	Placetype  string
	Country    string  // ISO2
	Latitude   float64
	Longitude  float64
	Population int64
	Timezone   string
	Geometry   string // GeoJSON geometry
	Hierarchy  map[string]int64
}

// Supported language codes for geo_names (must match languages table)
var supportedLanguages = []string{
	"eng", "heb", "ara", "yid", "rus", "fra", "deu", "spa", "por",
	"zho", "jpn", "kor", "ita", "nld", "pol", "hun", "ukr", "tur", "fas", "hin",
}

// cityNameEntry stores names for batch city import (JSON-serializable for disk storage)
type cityNameEntry struct {
	WofID int64             `json:"w"`
	Names map[string]string `json:"n"`
}

// cityBoundaryEntry stores boundary geometry for batch city import (JSON-serializable for disk storage)
type cityBoundaryEntry struct {
	WofID    int64  `json:"w"`
	Geometry string `json:"g"` // GeoJSON geometry string
}

// Helper to get wofID from entry (for backwards compatibility)
func (e cityNameEntry) getWofID() int64 { return e.WofID }

// Helper to get names from entry (for backwards compatibility)
func (e cityNameEntry) getNames() map[string]string { return e.Names }

// geoNameEntry holds a single geo_name record for batch insertion
type geoNameEntry struct {
	entityTypeID int
	entityID     int64
	lang         string
	name         string
	sourceID     int
}

// insertGeoNames queues language names for batch insertion (called at flush)
func (imp *Importer) insertGeoNames(ctx context.Context, entityType string, entityID int64, names map[string]string) {
	entityTypeID := imp.geoLevelIDs[entityType]
	sourceID := imp.sourceIDs["wof"]

	for lang, name := range names {
		if name == "" {
			continue
		}
		imp.geoNamesBatch = append(imp.geoNamesBatch, geoNameEntry{
			entityTypeID: entityTypeID,
			entityID:     entityID,
			lang:         lang,
			name:         name,
			sourceID:     sourceID,
		})
	}
}

// flushGeoNames batch inserts all queued geo_names using batch INSERT with ON CONFLICT
func (imp *Importer) flushGeoNames(ctx context.Context) error {
	if len(imp.geoNamesBatch) == 0 {
		return nil
	}

	// Use batch INSERT with ON CONFLICT for upsert support
	batch := &pgx.Batch{}
	for _, e := range imp.geoNamesBatch {
		batch.Queue(`
			INSERT INTO geo_names (entity_type_id, entity_id, language_code, name, is_preferred, source_id)
			VALUES ($1, $2, $3, $4, true, $5)
			ON CONFLICT (entity_type_id, entity_id, language_code) DO UPDATE SET
				name = EXCLUDED.name
		`, e.entityTypeID, e.entityID, e.lang, e.name, e.sourceID)
	}

	br := imp.pgPool.SendBatch(ctx, batch)
	err := br.Close()

	imp.geoNamesBatch = nil
	return err
}

// insertCityGeoNames batch inserts city names using batch INSERT with ON CONFLICT
func (imp *Importer) insertCityGeoNames(ctx context.Context, entries []cityNameEntry) error {
	if len(entries) == 0 {
		return nil
	}

	// Build a map of wof_id -> city id in chunks to avoid memory issues
	const chunkSize = 10000
	wofToCityID := make(map[int64]int64, len(entries))

	for i := 0; i < len(entries); i += chunkSize {
		end := i + chunkSize
		if end > len(entries) {
			end = len(entries)
		}

		wofIDs := make([]int64, 0, end-i)
		for _, e := range entries[i:end] {
			wofIDs = append(wofIDs, e.WofID)
		}

		rows, err := imp.pgPool.Query(ctx, `SELECT id, wof_id FROM geo_cities WHERE wof_id = ANY($1)`, wofIDs)
		if err != nil {
			return err
		}

		for rows.Next() {
			var id int64
			var wofID int64
			if err := rows.Scan(&id, &wofID); err != nil {
				continue
			}
			wofToCityID[wofID] = id
		}
		rows.Close()
	}

	// Use batch INSERT with ON CONFLICT (process in chunks to avoid memory issues)
	const batchSize = 10000
	batch := &pgx.Batch{}
	batchCount := 0

	entityTypeID := imp.geoLevelIDs["city"]
	sourceID := imp.sourceIDs["wof"]

	for _, e := range entries {
		cityID, ok := wofToCityID[e.WofID]
		if !ok {
			continue
		}
		for lang, name := range e.Names {
			if name == "" {
				continue
			}
			batch.Queue(`
				INSERT INTO geo_names (entity_type_id, entity_id, language_code, name, is_preferred, source_id)
				VALUES ($1, $2, $3, $4, true, $5)
				ON CONFLICT (entity_type_id, entity_id, language_code) DO UPDATE SET
					name = EXCLUDED.name
			`, entityTypeID, cityID, lang, name, sourceID)
			batchCount++

			// Flush batch periodically
			if batchCount >= batchSize {
				br := imp.pgPool.SendBatch(ctx, batch)
				if err := br.Close(); err != nil {
					return err
				}
				batch = &pgx.Batch{}
				batchCount = 0
			}
		}
	}

	// Flush remaining
	if batchCount > 0 {
		br := imp.pgPool.SendBatch(ctx, batch)
		if err := br.Close(); err != nil {
			return err
		}
	}

	return nil
}

// Aliases to geo package functions for convenience
var (
	toASCII              = geo.ToASCII
	normalizeCityName    = geo.NormalizeCityName
	generateNameVariants = geo.GenerateNameVariants
)

func (imp *Importer) Run(ctx context.Context) error {
	start := time.Now()

	// Helper to log memory usage
	logMemory := func(step string) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		log.Printf("  [mem] %s: %dMB alloc, %dMB sys", step, m.Alloc/1024/1024, m.Sys/1024/1024)
	}

	// Step 0: Initialize lookup maps from database
	log.Println("Step 0: Loading lookup tables and existing WOF data...")
	if err := imp.initializeLookupMaps(ctx); err != nil {
		return fmt.Errorf("failed to initialize lookup maps: %w", err)
	}
	log.Printf("  Loaded %d geo levels, %d data sources", len(imp.geoLevelIDs), len(imp.sourceIDs))

	// Start import tracking
	if err := imp.startImportTracking(ctx); err != nil {
		log.Printf("Warning: failed to start import tracking: %v", err)
	}

	// Load existing WOF IDs so we can skip duplicates and maintain hierarchy
	if err := imp.loadExistingWOFMappings(ctx); err != nil {
		return fmt.Errorf("failed to load existing WOF mappings: %w", err)
	}
	log.Printf("  Loaded %d existing WOF → PG mappings", len(imp.wofToPG))

	// Step 1: Import continents from WOF
	log.Println("Step 1: Importing continents from WOF...")
	continents, err := imp.importContinents(ctx)
	if err != nil {
		imp.stats.errors = append(imp.stats.errors, fmt.Sprintf("continents import: %v", err))
		imp.completeImportTracking(ctx, err)
		return err
	}
	imp.stats.continents = continents
	log.Printf("  %d continents", continents)
	log.Printf("  wofContinentMap now has %d entries", len(imp.wofContinentMap))

	// Step 2: Import countries
	log.Println("Step 2: Importing countries...")
	countries, err := imp.importPlacetype(ctx, "country")
	if err != nil {
		imp.stats.errors = append(imp.stats.errors, fmt.Sprintf("countries import: %v", err))
		imp.completeImportTracking(ctx, err)
		return err
	}
	imp.stats.countries = countries
	log.Printf("  %d countries", countries)
	log.Printf("  wofToPG now has %d entries", len(imp.wofToPG))
	if err := imp.flushGeoNames(ctx); err != nil {
		log.Printf("  Warning: failed to flush country names: %v", err)
	}
	runtime.GC()
	logMemory("after countries")

	// Step 3: Import regions
	log.Println("Step 3: Importing regions...")
	regions, err := imp.importPlacetype(ctx, "region")
	if err != nil {
		imp.stats.errors = append(imp.stats.errors, fmt.Sprintf("regions import: %v", err))
		imp.completeImportTracking(ctx, err)
		return err
	}
	imp.stats.regions = regions
	log.Printf("  %d regions", regions)
	log.Printf("  wofToPG now has %d entries", len(imp.wofToPG))
	if err := imp.flushGeoNames(ctx); err != nil {
		log.Printf("  Warning: failed to flush region names: %v", err)
	}
	runtime.GC()
	logMemory("after regions")

	// Step 4: Import districts (counties)
	log.Println("Step 4: Importing districts...")
	districts, err := imp.importPlacetype(ctx, "county")
	if err != nil {
		imp.stats.errors = append(imp.stats.errors, fmt.Sprintf("districts import: %v", err))
		imp.completeImportTracking(ctx, err)
		return err
	}
	imp.stats.districts = districts
	log.Printf("  %d districts", districts)
	log.Printf("  wofToPG now has %d entries", len(imp.wofToPG))
	if err := imp.flushGeoNames(ctx); err != nil {
		log.Printf("  Warning: failed to flush district names: %v", err)
	}
	runtime.GC()
	logMemory("after districts")

	// Step 5: Import cities (localities)
	log.Println("Step 5: Importing cities...")
	cities, err := imp.importCities(ctx)
	if err != nil {
		imp.stats.errors = append(imp.stats.errors, fmt.Sprintf("cities import: %v", err))
		imp.completeImportTracking(ctx, err)
		return err
	}
	imp.stats.cities = cities
	log.Printf("  %d cities", cities)
	runtime.GC()
	logMemory("after cities")

	duration := time.Since(start)
	log.Printf("\nComplete in %s", duration.Round(time.Second))

	// Complete import tracking
	if err := imp.completeImportTracking(ctx, nil); err != nil {
		log.Printf("Warning: failed to complete import tracking: %v", err)
	}

	return nil
}

// initializeLookupMaps loads lookup table IDs from the database
func (imp *Importer) initializeLookupMaps(ctx context.Context) error {
	imp.geoLevelIDs = make(map[string]int)
	imp.sourceIDs = make(map[string]int)

	// Load geo_levels
	rows, err := imp.pgPool.Query(ctx, "SELECT id, key FROM geo_levels")
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
	rows, err = imp.pgPool.Query(ctx, "SELECT id, key FROM geo_data_sources")
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
	requiredLevels := []string{"continent", "country", "region", "district", "city"}
	for _, level := range requiredLevels {
		if _, ok := imp.geoLevelIDs[level]; !ok {
			return fmt.Errorf("required geo_level '%s' not found in database", level)
		}
	}

	if _, ok := imp.sourceIDs["wof"]; !ok {
		return fmt.Errorf("required geo_data_source 'wof' not found in database")
	}

	return nil
}

// loadExistingWOFMappings loads existing WOF ID → PostgreSQL ID mappings from the database
func (imp *Importer) loadExistingWOFMappings(ctx context.Context) error {
	// Load continents
	rows, err := imp.pgPool.Query(ctx, "SELECT id, wof_id FROM geo_continents WHERE wof_id IS NOT NULL")
	if err != nil {
		return fmt.Errorf("query continents: %w", err)
	}
	for rows.Next() {
		var pgID int
		var wofID int64
		if err := rows.Scan(&pgID, &wofID); err != nil {
			continue
		}
		if imp.wofContinentMap == nil {
			imp.wofContinentMap = make(map[int64]int)
		}
		imp.wofContinentMap[wofID] = pgID
	}
	rows.Close()

	// Load countries, regions, districts (they all use wofToPG map)
	queries := []string{
		"SELECT id, wof_id FROM geo_countries WHERE wof_id IS NOT NULL",
		"SELECT id, wof_id FROM geo_regions WHERE wof_id IS NOT NULL",
		"SELECT id, wof_id FROM geo_districts WHERE wof_id IS NOT NULL",
	}

	for _, query := range queries {
		rows, err := imp.pgPool.Query(ctx, query)
		if err != nil {
			return fmt.Errorf("query existing WOF mappings: %w", err)
		}
		for rows.Next() {
			var pgID int64
			var wofID int64
			if err := rows.Scan(&pgID, &wofID); err != nil {
				continue
			}
			imp.wofToPG[wofID] = pgID
		}
		rows.Close()
	}

	return nil
}

func (imp *Importer) reset(ctx context.Context) error {
	// Delete in FK order (leaf tables first)
	queries := []string{
		"DELETE FROM publisher_coverage",
		"DELETE FROM geo_data_imports",
		"DELETE FROM geo_boundary_imports",
		"DELETE FROM geo_name_mappings",
		"DELETE FROM geo_names",
		"DELETE FROM geo_city_elevations",
		"DELETE FROM geo_city_coordinates",
		"DELETE FROM geo_city_boundaries",
		"DELETE FROM geo_district_boundaries",
		"DELETE FROM geo_region_boundaries",
		"DELETE FROM geo_country_boundaries",
		"DELETE FROM geo_cities",
		"DELETE FROM geo_districts",
		"DELETE FROM geo_regions",
		"DELETE FROM geo_countries",
		"DELETE FROM geo_continents",
	}
	for _, q := range queries {
		if _, err := imp.pgPool.Exec(ctx, q); err != nil {
			return fmt.Errorf("%s: %w", q, err)
		}
	}

	// Continents will be imported from WOF in importContinents()
	return nil
}

// importContinents imports continents from WOF and builds the wofContinentMap
func (imp *Importer) importContinents(ctx context.Context) (int, error) {
	imp.wofContinentMap = make(map[int64]int)

	// Query WOF for all continents
	rows, err := imp.wofDB.Query(`
		SELECT s.id, s.name
		FROM spr s
		WHERE s.placetype = 'continent'
		  AND s.is_deprecated = 0
		  AND s.is_ceased = 0
		ORDER BY s.name
	`)
	if err != nil {
		return 0, fmt.Errorf("query WOF continents: %w", err)
	}
	defer rows.Close()

	// Generate 2-letter codes from continent names
	nameToCode := map[string]string{
		"Africa":        "AF",
		"Antarctica":    "AN",
		"Asia":          "AS",
		"Europe":        "EU",
		"North America": "NA",
		"Oceania":       "OC",
		"South America": "SA",
		"Seven Seas":    "XS", // Maritime territories get their own code
	}

	var count int
	for rows.Next() {
		var wofID int64
		var name string
		if err := rows.Scan(&wofID, &name); err != nil {
			return 0, fmt.Errorf("scan continent: %w", err)
		}

		// Get code for this continent
		code, ok := nameToCode[name]
		if !ok {
			// Generate code from first 2 chars if unknown
			if len(name) >= 2 {
				code = strings.ToUpper(name[:2])
			} else {
				code = "XX"
			}
			log.Printf("  Warning: Unknown continent %q, using code %s", name, code)
		}

		// Insert into database
		var pgID int
		err := imp.pgPool.QueryRow(ctx, `
			INSERT INTO geo_continents (code, name, wof_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, wof_id = EXCLUDED.wof_id
			RETURNING id
		`, code, name, wofID).Scan(&pgID)
		if err != nil {
			return 0, fmt.Errorf("insert continent %s: %w", name, err)
		}

		imp.wofContinentMap[wofID] = pgID
		count++

		if imp.verbose {
			log.Printf("  Continent: %s (%s) WOF %d → PG %d", name, code, wofID, pgID)
		}
	}

	if count == 0 {
		return 0, fmt.Errorf("no continents found in WOF database")
	}

	return count, nil
}

func (imp *Importer) importPlacetype(ctx context.Context, placetype string) (int, error) {
	// Query WOF for this placetype
	rows, err := imp.wofDB.Query(`
		SELECT s.id, s.name, s.placetype, s.country, s.latitude, s.longitude,
		       g.body
		FROM spr s
		JOIN geojson g ON s.id = g.id AND g.is_alt = 0
		WHERE s.placetype = ?
		  AND s.is_deprecated = 0
		  AND s.is_ceased = 0
		ORDER BY s.name
	`, placetype)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var count, skipped int
	for rows.Next() {
		rec, err := imp.scanRecord(rows)
		if err != nil {
			return 0, fmt.Errorf("scan %s record: %w", placetype, err)
		}

		pgID, err := imp.insertRecord(ctx, rec)
		if err != nil {
			if errors.Is(err, ErrSkipRecord) {
				log.Printf("  SKIP: %s (WOF %d) - %v", rec.Name, rec.WOFID, err)
				skipped++
				continue
			}
			return 0, fmt.Errorf("insert %s (WOF %d): %w", rec.Name, rec.WOFID, err)
		}

		imp.wofToPG[rec.WOFID] = pgID
		count++

		if imp.verbose && count%1000 == 0 {
			log.Printf("  %d %ss...", count, placetype)
		}
	}

	if skipped > 0 {
		log.Printf("  (skipped %d invalid entries)", skipped)
	}

	return count, nil
}

func (imp *Importer) scanRecord(rows *sql.Rows) (*WOFRecord, error) {
	var rec WOFRecord
	var body string

	if err := rows.Scan(&rec.WOFID, &rec.Name, &rec.Placetype, &rec.Country,
		&rec.Latitude, &rec.Longitude, &body); err != nil {
		return nil, err
	}

	// Parse GeoJSON to extract properties and geometry
	var feature struct {
		Properties map[string]interface{} `json:"properties"`
		Geometry   json.RawMessage        `json:"geometry"`
	}
	if err := json.Unmarshal([]byte(body), &feature); err != nil {
		return nil, err
	}

	rec.Geometry = string(feature.Geometry)

	// Extract hierarchy
	rec.Hierarchy = make(map[string]int64)
	if hier, ok := feature.Properties["wof:hierarchy"].([]interface{}); ok && len(hier) > 0 {
		if h, ok := hier[0].(map[string]interface{}); ok {
			for k, v := range h {
				switch vv := v.(type) {
				case float64:
					rec.Hierarchy[k] = int64(vv)
				case int64:
					rec.Hierarchy[k] = vv
				}
			}
		}
	}

	// Extract timezone
	if tz, ok := feature.Properties["wof:timezone"].(string); ok {
		rec.Timezone = tz
	}

	// Extract population
	if pop, ok := feature.Properties["wof:population"].(float64); ok {
		rec.Population = int64(pop)
	}

	// Extract all available language names
	rec.Names = make(map[string]string)
	for _, lang := range supportedLanguages {
		key := fmt.Sprintf("name:%s_x_preferred", lang)
		if names, ok := feature.Properties[key].([]interface{}); ok && len(names) > 0 {
			if name, ok := names[0].(string); ok && name != "" {
				rec.Names[lang] = name
			}
		}
	}

	return &rec, nil
}

func (imp *Importer) insertRecord(ctx context.Context, rec *WOFRecord) (int64, error) {
	switch rec.Placetype {
	case "country":
		return imp.insertCountry(ctx, rec)
	case "region":
		return imp.insertRegion(ctx, rec)
	case "county":
		return imp.insertDistrict(ctx, rec)
	default:
		return 0, fmt.Errorf("unknown placetype: %s", rec.Placetype)
	}
}

// ErrSkipRecord indicates a record should be skipped (not fatal)
var ErrSkipRecord = fmt.Errorf("skip record")

// City-states - countries that are essentially a single city
// Used for smart map selection to skip directly to city level
var cityStates = map[string]bool{
	"MC": true, // Monaco
	"VA": true, // Vatican City
	"SM": true, // San Marino
	"LI": true, // Liechtenstein
	"AD": true, // Andorra
	"MT": true, // Malta
	"SG": true, // Singapore
	"BH": true, // Bahrain
	"HK": true, // Hong Kong
	"MO": true, // Macau
	"GI": true, // Gibraltar
}

func (imp *Importer) insertCountry(ctx context.Context, rec *WOFRecord) (int64, error) {
	code := strings.ToUpper(rec.Country)
	if code == "" {
		// Skip entries without country code (like "Null Island")
		if imp.verbose {
			log.Printf("  Skipping %s (WOF %d): no country code", rec.Name, rec.WOFID)
		}
		return 0, ErrSkipRecord
	}

	// Determine continent from WOF hierarchy
	continentID := imp.getContinentID(rec)
	if continentID == 0 {
		// Skip entries without valid continent (like special WOF entries)
		if imp.verbose {
			log.Printf("  Skipping %s (WOF %d): no continent in hierarchy", rec.Name, rec.WOFID)
		}
		return 0, ErrSkipRecord
	}

	// Check if this is a city-state
	isCityState := cityStates[code]

	// Prefer English name, fall back to WOF native name
	countryName := rec.Name
	if engName, ok := rec.Names["eng"]; ok && engName != "" {
		countryName = engName
	}

	var pgID int64
	err := imp.pgPool.QueryRow(ctx, `
		INSERT INTO geo_countries (code, name, continent_id, wof_id, is_city_state)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (code) DO UPDATE SET
			name = EXCLUDED.name,
			wof_id = EXCLUDED.wof_id,
			is_city_state = EXCLUDED.is_city_state
		RETURNING id
	`, code, countryName, continentID, rec.WOFID, isCityState).Scan(&pgID)
	if err != nil {
		return 0, err
	}

	// Insert language names into geo_names
	imp.insertGeoNames(ctx, "country", int64(pgID), rec.Names)

	// Insert boundary if available
	if rec.Geometry != "" && rec.Geometry != "null" {
		imp.pgPool.Exec(ctx, `
			INSERT INTO geo_country_boundaries (country_id, boundary, centroid, area_km2)
			VALUES ($1, ST_GeomFromGeoJSON($2)::geography,
			        ST_Centroid(ST_GeomFromGeoJSON($2))::geography,
			        ST_Area(ST_GeomFromGeoJSON($2)::geography) / 1e6)
			ON CONFLICT (country_id) DO UPDATE SET
				boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2
		`, pgID, rec.Geometry)
	}

	return pgID, nil
}

func (imp *Importer) insertRegion(ctx context.Context, rec *WOFRecord) (int64, error) {
	// Get continent (REQUIRED - anchor point for all regions)
	continentID := imp.getContinentID(rec)
	if continentID == 0 {
		return 0, fmt.Errorf("%w: no valid continent in hierarchy for %s", ErrSkipRecord, rec.Name)
	}

	// Get country (optional - must belong to same continent)
	// Overseas territories (e.g., French Guiana/France) have geographic continent != country's continent
	var countryPGID *int64
	countryWOFID := rec.Hierarchy["country_id"]
	if countryWOFID > 0 {
		if pgID, ok := imp.wofToPG[countryWOFID]; ok {
			// Verify country belongs to same continent
			var countryContinent int
			err := imp.pgPool.QueryRow(ctx, "SELECT continent_id FROM geo_countries WHERE id = $1", pgID).Scan(&countryContinent)
			if err == nil && countryContinent == continentID {
				countryPGID = &pgID
			}
			// If country is in different continent (overseas territory), skip setting country_id
		}
	}

	code := fmt.Sprintf("wof-%d", rec.WOFID)

	// Prefer English name, fall back to WOF native name
	regionName := rec.Name
	if engName, ok := rec.Names["eng"]; ok && engName != "" {
		regionName = engName
	}

	var pgID int64
	err := imp.pgPool.QueryRow(ctx, `
		INSERT INTO geo_regions (continent_id, country_id, code, name, wof_id)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (wof_id) DO UPDATE SET
			continent_id = EXCLUDED.continent_id,
			country_id = EXCLUDED.country_id,
			name = EXCLUDED.name
		RETURNING id
	`, continentID, countryPGID, code, regionName, rec.WOFID).Scan(&pgID)
	if err != nil {
		return 0, err
	}

	// Insert language names into geo_names
	imp.insertGeoNames(ctx, "region", int64(pgID), rec.Names)

	// Insert boundary
	if rec.Geometry != "" && rec.Geometry != "null" {
		imp.pgPool.Exec(ctx, `
			INSERT INTO geo_region_boundaries (region_id, boundary, centroid, area_km2)
			VALUES ($1, ST_GeomFromGeoJSON($2)::geography,
			        ST_Centroid(ST_GeomFromGeoJSON($2))::geography,
			        ST_Area(ST_GeomFromGeoJSON($2)::geography) / 1e6)
			ON CONFLICT (region_id) DO UPDATE SET
				boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2
		`, pgID, rec.Geometry)
	}

	return pgID, nil
}

func (imp *Importer) insertDistrict(ctx context.Context, rec *WOFRecord) (int64, error) {
	// Get continent (REQUIRED - anchor point for all districts)
	continentID := imp.getContinentID(rec)
	if continentID == 0 {
		return 0, fmt.Errorf("%w: no valid continent in hierarchy for %s", ErrSkipRecord, rec.Name)
	}

	// Get country (optional - must belong to same continent)
	// Overseas territories (e.g., New Caledonia/France) have geographic continent != country's continent
	var countryPGID *int64
	countryWOFID := rec.Hierarchy["country_id"]
	if countryWOFID > 0 {
		if pgID, ok := imp.wofToPG[countryWOFID]; ok {
			// Verify country belongs to same continent
			var countryContinent int
			err := imp.pgPool.QueryRow(ctx, "SELECT continent_id FROM geo_countries WHERE id = $1", pgID).Scan(&countryContinent)
			if err == nil && countryContinent == continentID {
				countryPGID = &pgID
			}
			// If country is in different continent (overseas territory), skip setting country_id
		}
	}

	// Get region (optional - must belong to same continent)
	var regionPGID *int64
	regionWOFID := rec.Hierarchy["region_id"]
	if regionWOFID > 0 {
		if pgID, ok := imp.wofToPG[regionWOFID]; ok {
			// Verify region belongs to same continent
			var regionContinent int
			err := imp.pgPool.QueryRow(ctx, "SELECT continent_id FROM geo_regions WHERE id = $1", pgID).Scan(&regionContinent)
			if err == nil && regionContinent == continentID {
				regionPGID = &pgID
				// Inherit country_id from region if we don't have one
				if countryPGID == nil {
					var regionCountryID *int64
					imp.pgPool.QueryRow(ctx, "SELECT country_id FROM geo_regions WHERE id = $1", pgID).Scan(&regionCountryID)
					if regionCountryID != nil {
						countryPGID = regionCountryID
					}
				}
			}
		}
	}

	code := fmt.Sprintf("wof-%d", rec.WOFID)

	// Prefer English name, fall back to WOF native name
	districtName := rec.Name
	if engName, ok := rec.Names["eng"]; ok && engName != "" {
		districtName = engName
	}

	var pgID int64
	err := imp.pgPool.QueryRow(ctx, `
		INSERT INTO geo_districts (continent_id, country_id, region_id, code, name, wof_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (wof_id) DO UPDATE SET
			continent_id = EXCLUDED.continent_id,
			country_id = EXCLUDED.country_id,
			region_id = EXCLUDED.region_id,
			name = EXCLUDED.name
		RETURNING id
	`, continentID, countryPGID, regionPGID, code, districtName, rec.WOFID).Scan(&pgID)
	if err != nil {
		return 0, err
	}

	// Insert language names into geo_names
	imp.insertGeoNames(ctx, "district", int64(pgID), rec.Names)

	// Insert boundary
	if rec.Geometry != "" && rec.Geometry != "null" {
		imp.pgPool.Exec(ctx, `
			INSERT INTO geo_district_boundaries (district_id, boundary, centroid, area_km2)
			VALUES ($1, ST_GeomFromGeoJSON($2)::geography,
			        ST_Centroid(ST_GeomFromGeoJSON($2))::geography,
			        ST_Area(ST_GeomFromGeoJSON($2)::geography) / 1e6)
			ON CONFLICT (district_id) DO UPDATE SET
				boundary = EXCLUDED.boundary, centroid = EXCLUDED.centroid, area_km2 = EXCLUDED.area_km2
		`, pgID, rec.Geometry)
	}

	return pgID, nil
}

// cityRecord holds pre-processed city data for batch operations
type cityRecord struct {
	continentID int16
	countryID   *int32
	regionID    *int32
	districtID  *int32
	name        string
	lat         float64
	lng         float64
	tz          string
	population  int64
	wofID       int64
	names       map[string]string
	elevation   *int32 // filled in by elevation lookup
}

// cityRecordDisk is a compact version for disk storage (stores WOF IDs, not PostgreSQL IDs)
type cityRecordDisk struct {
	ContinentWofID int64   `json:"c"`         // WOF continent ID (resolves to PG ID at insert time)
	CountryWofID   *int64  `json:"co,omitempty"` // WOF country ID
	RegionWofID    *int64  `json:"r,omitempty"`  // WOF region ID
	DistrictWofID  *int64  `json:"d,omitempty"` // WOF district ID
	Name           string  `json:"n"`
	Lat            float64 `json:"la"`
	Lng            float64 `json:"lo"`
	Tz             string  `json:"t"`
	Population     int64   `json:"p,omitempty"`
	WofID          int64   `json:"w"` // City's own WOF ID
	Elevation      *int32  `json:"e,omitempty"`
}

func (imp *Importer) importCities(ctx context.Context) (int, error) {
	// Disable trigger for bulk import performance (COPY doesn't fire row triggers anyway,
	// but this ensures consistency if we switch to INSERT)
	if _, err := imp.pgPool.Exec(ctx, "ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy"); err != nil {
		log.Printf("  Warning: could not disable trigger: %v", err)
	}
	defer func() {
		// Re-enable trigger after import
		if _, err := imp.pgPool.Exec(ctx, "ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy"); err != nil {
			log.Printf("  Warning: could not re-enable trigger: %v", err)
		}
	}()

	// Use persistent cache files in data directory (not temp files)
	citiesPath := filepath.Join(imp.dataDir, "wof-cities-cache.jsonl")
	namesPath := filepath.Join(imp.dataDir, "wof-city-names-cache.jsonl")
	boundariesPath := filepath.Join(imp.dataDir, "wof-city-boundaries-cache.jsonl")

	// Phase 1: Extract from WOF to disk (or reuse cache if exists)
	log.Println("  Phase 1: Reading localities from WOF to disk...")
	log.Printf("    Cache dir: %s", imp.dataDir)

	totalRecords, err := imp.extractCitiesToDisk(ctx, citiesPath, namesPath, boundariesPath)
	if err != nil {
		return 0, err
	}
	log.Printf("  Phase 1 complete: %d localities ready", totalRecords)

	// Phase 2: Stream from disk, insert in batches (skip elevation to save memory)
	// Elevation lookup will be done in a separate pass or on-demand via API
	log.Println("  Phase 2: Inserting cities (elevation skipped to save memory)...")

	readFile, err := os.Open(citiesPath)
	if err != nil {
		return 0, fmt.Errorf("open cities cache file: %w", err)
	}
	defer readFile.Close()

	decoder := json.NewDecoder(readFile)
	var count int
	const batchSize = 10000 // Larger batch for throughput
	batch := make([][]interface{}, 0, batchSize)

	for {
		var diskRec cityRecordDisk
		if err := decoder.Decode(&diskRec); err != nil {
			if err == io.EOF {
				break
			}
			return 0, fmt.Errorf("read city from disk: %w", err)
		}

		// Resolve WOF IDs to PostgreSQL IDs
		var continentPGID int16
		if pgID, ok := imp.wofContinentMap[diskRec.ContinentWofID]; ok {
			continentPGID = int16(pgID)
		} else {
			// Skip city if continent doesn't exist
			if count == 0 {
				log.Printf("  ERROR: First city has continent WOF ID %d which is not in wofContinentMap", diskRec.ContinentWofID)
				log.Printf("  wofContinentMap has %d entries", len(imp.wofContinentMap))
				for wofID, pgID := range imp.wofContinentMap {
					log.Printf("    WOF %d -> PG %d", wofID, pgID)
				}
			}
			continue
		}

		var countryPGID *int32
		if diskRec.CountryWofID != nil {
			if pgID, ok := imp.wofToPG[*diskRec.CountryWofID]; ok {
				v := int32(pgID)
				countryPGID = &v
			}
		}

		var regionPGID *int32
		if diskRec.RegionWofID != nil {
			if pgID, ok := imp.wofToPG[*diskRec.RegionWofID]; ok {
				v := int32(pgID)
				regionPGID = &v
			}
		}

		var districtPGID *int32
		if diskRec.DistrictWofID != nil {
			if pgID, ok := imp.wofToPG[*diskRec.DistrictWofID]; ok {
				v := int32(pgID)
				districtPGID = &v
			}
		}

		// Skip elevation for now - populated separately by cmd/import-elevation
		// Elevation libraries cache tiles in RAM which causes OOM with 4.5M cities
		var elevation *int32 = nil

		// Get WOF source ID for coordinate_source_id
		wofSourceID := imp.sourceIDs["wof"]

		batch = append(batch, []interface{}{
			continentPGID,
			countryPGID,
			regionPGID,
			districtPGID,
			diskRec.Name,
			toASCII(diskRec.Name),
			diskRec.Lat,
			diskRec.Lng,
			diskRec.Tz,
			elevation,
			nullInt32(diskRec.Population),
			diskRec.WofID,
			wofSourceID, // coordinate_source_id
			nil,         // elevation_source_id (not populated yet)
		})

		if len(batch) >= batchSize {
			inserted, err := imp.insertCityBatch(ctx, batch)
			if err != nil {
				return 0, fmt.Errorf("batch insert cities: %w", err)
			}
			count += inserted
			batch = batch[:0] // Reset batch but keep capacity

			if count%50000 == 0 {
				var m runtime.MemStats
				runtime.ReadMemStats(&m)
				log.Printf("  Inserted %d/%d cities... (mem: %dMB)", count, totalRecords, m.Alloc/1024/1024)
			}
			// Periodic GC to prevent memory buildup
			if count%100000 == 0 {
				runtime.GC()
			}
		}
	}

	// Insert remaining batch
	if len(batch) > 0 {
		inserted, err := imp.insertCityBatch(ctx, batch)
		if err != nil {
			return 0, fmt.Errorf("batch insert cities: %w", err)
		}
		count += inserted
	}

	log.Printf("  Total cities inserted: %d", count)

	// Phase 3: Insert city coordinates into geo_city_coordinates
	log.Println("  Phase 3: Inserting city coordinates...")
	if err := imp.insertCityCoordinates(ctx); err != nil {
		log.Printf("  Warning: could not insert city coordinates: %v", err)
	}

	// Phase 4: Insert city names from disk file
	log.Println("  Phase 4: Inserting city name translations...")
	if err := imp.insertCityNamesFromDisk(ctx, namesPath); err != nil {
		log.Printf("  Warning: could not insert city names: %v", err)
	}

	// Clear memory before Phase 5
	runtime.GC()

	// Phase 5: Insert city boundaries from disk file
	log.Println("  Phase 5: Inserting city boundaries...")
	if err := imp.insertCityBoundariesFromDisk(ctx, boundariesPath); err != nil {
		log.Printf("  Warning: could not insert city boundaries: %v", err)
	}

	// Validate hierarchy integrity after bulk import
	log.Println("  Validating hierarchy integrity...")
	validationRows, validationErr := imp.pgPool.Query(ctx, "SELECT city_id, city_name, error_type, details FROM validate_all_city_hierarchies()")
	if validationErr != nil {
		log.Printf("  Warning: could not validate hierarchies: %v", validationErr)
	} else {
		defer validationRows.Close()
		var integrityErrors int
		for validationRows.Next() {
			var cityID int64
			var cityName, errorType, details string
			if err := validationRows.Scan(&cityID, &cityName, &errorType, &details); err != nil {
				continue
			}
			log.Printf("  INTEGRITY ERROR: city %d (%s) - %s: %s", cityID, cityName, errorType, details)
			integrityErrors++
		}
		if integrityErrors > 0 {
			return 0, fmt.Errorf("hierarchy integrity validation failed: %d errors found", integrityErrors)
		}
		log.Println("  Hierarchy integrity OK")
	}

	return count, nil
}

// extractCitiesToDisk extracts localities from WOF SQLite to disk cache files
func (imp *Importer) extractCitiesToDisk(ctx context.Context, citiesPath, namesPath, boundariesPath string) (int, error) {
	// Check if all cache files exist - if so, just count and return
	if _, err := os.Stat(citiesPath); err == nil {
		if _, err := os.Stat(namesPath); err == nil {
			if _, err := os.Stat(boundariesPath); err == nil {
				// All cache files exist - count records and return
				log.Println("    Cache files already exist, counting records...")
				countFile, err := os.Open(citiesPath)
				if err != nil {
					return 0, fmt.Errorf("open existing cache file: %w", err)
				}
				defer countFile.Close()

				decoder := json.NewDecoder(countFile)
				var count int
				for {
					var rec cityRecordDisk
					if err := decoder.Decode(&rec); err != nil {
						break
					}
					count++
				}
				log.Printf("    Found %d cached records, skipping extraction", count)
				return count, nil
			}
		}
	}

	// Create output files
	citiesFile, err := os.Create(citiesPath)
	if err != nil {
		return 0, fmt.Errorf("create cities file: %w", err)
	}

	namesFile, err := os.Create(namesPath)
	if err != nil {
		citiesFile.Close()
		return 0, fmt.Errorf("create names file: %w", err)
	}

	boundariesFile, err := os.Create(boundariesPath)
	if err != nil {
		citiesFile.Close()
		namesFile.Close()
		return 0, fmt.Errorf("create boundaries file: %w", err)
	}

	// Query WOF for localities
	rows, err := imp.wofDB.Query(`
		SELECT s.id, s.name, s.placetype, s.country, s.latitude, s.longitude,
		       g.body
		FROM spr s
		JOIN geojson g ON s.id = g.id AND g.is_alt = 0
		WHERE s.placetype = 'locality'
		  AND s.is_deprecated = 0
		  AND s.is_ceased = 0
		  AND s.latitude != 0
		  AND s.longitude != 0
		ORDER BY s.country, s.name
	`)
	if err != nil {
		citiesFile.Close()
		namesFile.Close()
		boundariesFile.Close()
		return 0, err
	}
	defer rows.Close()

	encoder := json.NewEncoder(citiesFile)
	namesEncoder := json.NewEncoder(namesFile)
	boundariesEncoder := json.NewEncoder(boundariesFile)
	var totalRecords, skipped int

	for rows.Next() {
		rec, err := imp.scanRecord(rows)
		if err != nil {
			citiesFile.Close()
			namesFile.Close()
			boundariesFile.Close()
			return 0, fmt.Errorf("scan locality record: %w", err)
		}

		// Get hierarchy IDs from WOF
		// Cities MUST have a continent (anchor point), everything else is optional

		// Get continent (REQUIRED)
		continentWOFID := rec.Hierarchy["continent_id"]
		var continentPGID int16
		if continentWOFID > 0 {
			if pgID, ok := imp.wofContinentMap[continentWOFID]; ok {
				continentPGID = int16(pgID)
			}
		}

		if continentPGID == 0 {
			if imp.verbose {
				log.Printf("  SKIP: locality %s (WOF %d) - no valid continent", rec.Name, rec.WOFID)
			}
			skipped++
			continue
		}

		// Get optional hierarchy IDs from WOF, then validate consistency
		var countryPGID, regionPGID, districtPGID *int32
		var countryContinent, regionCountry, districtRegion, districtCountry int32

		// Get country and its continent
		if countryWOFID := rec.Hierarchy["country_id"]; countryWOFID > 0 {
			if pgID, ok := imp.wofToPG[countryWOFID]; ok {
				v := int32(pgID)
				countryPGID = &v
				// Look up country's continent
				imp.pgPool.QueryRow(ctx, "SELECT continent_id FROM geo_countries WHERE id = $1", pgID).Scan(&countryContinent)
			}
		}

		// Get region and its country/continent
		var regionContinent int32
		if regionWOFID := rec.Hierarchy["region_id"]; regionWOFID > 0 {
			if pgID, ok := imp.wofToPG[regionWOFID]; ok {
				v := int32(pgID)
				regionPGID = &v
				// Look up region's country and continent
				imp.pgPool.QueryRow(ctx, "SELECT COALESCE(country_id, 0), continent_id FROM geo_regions WHERE id = $1", pgID).Scan(&regionCountry, &regionContinent)
			}
		}

		// Get district and its region/country
		if countyWOFID := rec.Hierarchy["county_id"]; countyWOFID > 0 {
			if pgID, ok := imp.wofToPG[countyWOFID]; ok {
				v := int32(pgID)
				districtPGID = &v
				// Look up district's region and country
				imp.pgPool.QueryRow(ctx, "SELECT COALESCE(region_id, 0), COALESCE(country_id, 0) FROM geo_districts WHERE id = $1", pgID).Scan(&districtRegion, &districtCountry)
			}
		}

		// Validate hierarchy consistency (geographic truth over political hierarchy)
		// Rule: City's continent must match country's continent
		if countryPGID != nil && countryContinent > 0 && int16(countryContinent) != continentPGID {
			continentPGID = int16(countryContinent)
		}

		// Rule: Region's continent must match city's continent (overseas territories like New Caledonia)
		// If region is in a different continent than the city/country, clear it to avoid trigger errors
		if regionPGID != nil && regionContinent > 0 && int16(regionContinent) != continentPGID {
			if imp.verbose {
				log.Printf("  CLEAR: region %d for %s (WOF %d) - region continent %d != city continent %d",
					*regionPGID, rec.Name, rec.WOFID, regionContinent, continentPGID)
			}
			regionPGID = nil
			districtPGID = nil // District depends on region
		}

		// Rule: If region has a country but city doesn't, or if region's country doesn't match city's country
		if regionPGID != nil && regionCountry != 0 {
			if countryPGID == nil {
				// Region requires a country, but city doesn't have one - clear region
				regionPGID = nil
				districtPGID = nil // District depends on region
			} else if regionCountry != *countryPGID {
				// WOF hierarchy has wrong region (e.g., Crimea city with Ukraine country but Russian region)
				// Find correct region by point-in-polygon using city coordinates
				var correctRegionID *int32
				err := imp.pgPool.QueryRow(ctx, `
					SELECT r.id FROM geo_regions r
					JOIN geo_region_boundaries rb ON rb.region_id = r.id
					WHERE r.country_id = $1
					  AND ST_Contains(rb.boundary::geometry, ST_SetSRID(ST_MakePoint($2, $3), 4326))
					LIMIT 1
				`, *countryPGID, rec.Longitude, rec.Latitude).Scan(&correctRegionID)
				if err == nil && correctRegionID != nil {
					regionPGID = correctRegionID
					// Update regionCountry for district validation below
					regionCountry = *countryPGID
				} else {
					// No matching region found, clear it
					regionPGID = nil
				}
				districtPGID = nil // Always clear district when region changes
			}
		}

		// Rule: If district has a country but city doesn't, or if district's country doesn't match city's country
		if districtPGID != nil && districtCountry != 0 {
			if countryPGID == nil {
				// District requires a country, but city doesn't have one - clear district
				districtPGID = nil
			} else if districtCountry != *countryPGID {
				// Find correct district by point-in-polygon
				var correctDistrictID *int32
				err := imp.pgPool.QueryRow(ctx, `
					SELECT d.id FROM geo_districts d
					JOIN geo_district_boundaries db ON db.district_id = d.id
					WHERE d.country_id = $1
					  AND ($2::int IS NULL OR d.region_id = $2)
					  AND ST_Contains(db.boundary::geometry, ST_SetSRID(ST_MakePoint($3, $4), 4326))
					LIMIT 1
				`, *countryPGID, regionPGID, rec.Longitude, rec.Latitude).Scan(&correctDistrictID)
				if err == nil && correctDistrictID != nil {
					districtPGID = correctDistrictID
				} else {
					districtPGID = nil
				}
			}
		}

		// Rule: If district has a region but city doesn't, or if district's region doesn't match city's region
		if districtPGID != nil && districtRegion != 0 {
			if regionPGID == nil {
				// District requires a region, but city doesn't have one - clear district
				districtPGID = nil
			} else if districtRegion != *regionPGID {
				// Find correct district by point-in-polygon within the correct region
				var correctDistrictID *int32
				err := imp.pgPool.QueryRow(ctx, `
					SELECT d.id FROM geo_districts d
					JOIN geo_district_boundaries db ON db.district_id = d.id
					WHERE d.region_id = $1
					  AND ST_Contains(db.boundary::geometry, ST_SetSRID(ST_MakePoint($2, $3), 4326))
					LIMIT 1
				`, *regionPGID, rec.Longitude, rec.Latitude).Scan(&correctDistrictID)
				if err == nil && correctDistrictID != nil {
					districtPGID = correctDistrictID
				} else {
					districtPGID = nil
				}
			}
		}

		tz := rec.Timezone
		if tz == "" {
			tz = "UTC"
		}

		// Determine best name: prefer English, fall back to WOF native name
		cityName := rec.Name
		if engName, ok := rec.Names["eng"]; ok && engName != "" {
			cityName = engName
		}

		// Write city record to disk using WOF IDs (not PostgreSQL IDs)
		// Extract WOF IDs from hierarchy
		continentWofID := rec.Hierarchy["continent_id"]

		var countryWofID *int64
		if cid := rec.Hierarchy["country_id"]; cid > 0 {
			countryWofID = &cid
		}

		var regionWofID *int64
		if rid := rec.Hierarchy["region_id"]; rid > 0 {
			regionWofID = &rid
		}

		var districtWofID *int64
		if did := rec.Hierarchy["county_id"]; did > 0 {
			districtWofID = &did
		}

		diskRec := cityRecordDisk{
			ContinentWofID: continentWofID,
			CountryWofID:   countryWofID,
			RegionWofID:    regionWofID,
			DistrictWofID:  districtWofID,
			Name:           cityName,
			Lat:            rec.Latitude,
			Lng:            rec.Longitude,
			Tz:             tz,
			Population:     rec.Population,
			WofID:          rec.WOFID,
		}
		if err := encoder.Encode(diskRec); err != nil {
			citiesFile.Close()
			namesFile.Close()
			boundariesFile.Close()
			return 0, fmt.Errorf("write city to disk: %w", err)
		}

		// Write names to separate file (if any)
		if len(rec.Names) > 0 {
			namesEntry := cityNameEntry{WofID: rec.WOFID, Names: rec.Names}
			if err := namesEncoder.Encode(namesEntry); err != nil {
				log.Printf("  Warning: could not write names for WOF %d: %v", rec.WOFID, err)
			}
		}

		// Write boundary to separate file (if geometry exists and is valid)
		if rec.Geometry != "" && rec.Geometry != "null" {
			boundaryEntry := cityBoundaryEntry{WofID: rec.WOFID, Geometry: rec.Geometry}
			if err := boundariesEncoder.Encode(boundaryEntry); err != nil {
				log.Printf("  Warning: could not write boundary for WOF %d: %v", rec.WOFID, err)
			}
		}

		totalRecords++
		if totalRecords%50000 == 0 {
			log.Printf("    Read %d localities to disk...", totalRecords)
		}
	}

	citiesFile.Close()
	namesFile.Close()
	boundariesFile.Close()

	if skipped > 0 {
		log.Printf("    Skipped %d localities (no valid continent)", skipped)
	}

	return totalRecords, nil
}

// insertCityNamesFromDisk reads city names from disk file and inserts into geo_names
func (imp *Importer) insertCityNamesFromDisk(ctx context.Context, namesPath string) error {
	file, err := os.Open(namesPath)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	const batchSize = 5000 // How many city name entries to process at once
	var entries []cityNameEntry
	var totalProcessed int

	for {
		var entry cityNameEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		entries = append(entries, entry)

		if len(entries) >= batchSize {
			if err := imp.insertCityGeoNames(ctx, entries); err != nil {
				return err
			}
			totalProcessed += len(entries)
			entries = entries[:0]

			if totalProcessed%50000 == 0 {
				log.Printf("    Processed %d city name entries...", totalProcessed)
			}
		}
	}

	// Insert remaining entries
	if len(entries) > 0 {
		if err := imp.insertCityGeoNames(ctx, entries); err != nil {
			return err
		}
		totalProcessed += len(entries)
	}

	log.Printf("    Total city name entries processed: %d", totalProcessed)
	return nil
}

// insertCityCoordinates inserts WOF coordinates into geo_city_coordinates for all cities
func (imp *Importer) insertCityCoordinates(ctx context.Context) error {
	// Get WOF source ID
	wofSourceID := imp.sourceIDs["wof"]
	if wofSourceID == 0 {
		return fmt.Errorf("wof source not found in geo_data_sources")
	}

	// Disable trigger temporarily for bulk import (trigger has a bug comparing integer to 'publisher' string)
	_, err := imp.pgPool.Exec(ctx, "ALTER TABLE geo_city_coordinates DISABLE TRIGGER trg_geo_city_coordinates_update_effective")
	if err != nil {
		log.Printf("    Warning: could not disable trigger: %v", err)
	}
	defer func() {
		// Re-enable trigger after import
		if _, err := imp.pgPool.Exec(ctx, "ALTER TABLE geo_city_coordinates ENABLE TRIGGER trg_geo_city_coordinates_update_effective"); err != nil {
			log.Printf("    Warning: could not re-enable trigger: %v", err)
		}
	}()

	// Batch insert coordinates from geo_cities into geo_city_coordinates
	// Use INSERT ... SELECT for efficiency
	result, err := imp.pgPool.Exec(ctx, `
		INSERT INTO geo_city_coordinates (city_id, source_id, external_id, latitude, longitude, accuracy_m, publisher_id)
		SELECT
			id,
			$1,
			'wof-' || wof_id::text,
			latitude,
			longitude,
			NULL,  -- WOF doesn't provide accuracy information
			NULL   -- Not a publisher override
		FROM geo_cities
		WHERE wof_id IS NOT NULL
		ON CONFLICT (city_id, source_id, COALESCE(publisher_id, 0)) DO UPDATE SET
			latitude = EXCLUDED.latitude,
			longitude = EXCLUDED.longitude,
			external_id = EXCLUDED.external_id,
			updated_at = now()
	`, wofSourceID)

	if err != nil {
		return fmt.Errorf("insert city coordinates: %w", err)
	}

	rowsAffected := result.RowsAffected()
	log.Printf("    Inserted/updated %d city coordinates", rowsAffected)

	return nil
}

// insertCityBoundariesFromDisk reads city boundaries from disk file and inserts into geo_city_boundaries
func (imp *Importer) insertCityBoundariesFromDisk(ctx context.Context, boundariesPath string) error {
	file, err := os.Open(boundariesPath)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	const batchSize = 1000 // Batch for geometry (larger data per record)
	var entries []cityBoundaryEntry
	var totalProcessed, totalInserted, totalErrors int

	for {
		var entry cityBoundaryEntry
		if err := decoder.Decode(&entry); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		entries = append(entries, entry)

		if len(entries) >= batchSize {
			inserted, errors, err := imp.insertCityBoundaries(ctx, entries)
			if err != nil {
				return err
			}
			totalInserted += inserted
			totalErrors += errors
			totalProcessed += len(entries)
			entries = entries[:0]

			if totalProcessed%10000 == 0 {
				log.Printf("    Processed %d boundary entries (%d inserted, %d errors)...", totalProcessed, totalInserted, totalErrors)
			}
		}
	}

	// Insert remaining entries
	if len(entries) > 0 {
		inserted, errors, err := imp.insertCityBoundaries(ctx, entries)
		if err != nil {
			return err
		}
		totalInserted += inserted
		totalErrors += errors
		totalProcessed += len(entries)
	}

	log.Printf("    Total boundary entries processed: %d (inserted: %d, errors: %d)", totalProcessed, totalInserted, totalErrors)
	return nil
}

// isPolygonGeometry checks if the GeoJSON geometry is a Polygon or MultiPolygon
func isPolygonGeometry(geojson string) bool {
	var geom struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal([]byte(geojson), &geom); err != nil {
		return false
	}
	return geom.Type == "Polygon" || geom.Type == "MultiPolygon"
}

// insertCityBoundaries batch inserts city boundaries, returns (inserted, errors, fatalError)
func (imp *Importer) insertCityBoundaries(ctx context.Context, entries []cityBoundaryEntry) (int, int, error) {
	if len(entries) == 0 {
		return 0, 0, nil
	}

	// Filter to only Polygon/MultiPolygon geometries
	var validEntries []cityBoundaryEntry
	var skippedGeomType int
	for _, e := range entries {
		if isPolygonGeometry(e.Geometry) {
			validEntries = append(validEntries, e)
		} else {
			skippedGeomType++
		}
	}

	if len(validEntries) == 0 {
		return 0, skippedGeomType, nil
	}

	// Build a map of wof_id -> city uuid in chunks
	wofIDs := make([]int64, 0, len(validEntries))
	for _, e := range validEntries {
		wofIDs = append(wofIDs, e.WofID)
	}

	wofToUUID := make(map[int64]string, len(validEntries))
	rows, err := imp.pgPool.Query(ctx, `SELECT id, wof_id FROM geo_cities WHERE wof_id = ANY($1)`, wofIDs)
	if err != nil {
		return 0, 0, err
	}
	for rows.Next() {
		var id string
		var wofID int64
		if err := rows.Scan(&id, &wofID); err != nil {
			continue
		}
		wofToUUID[wofID] = id
	}
	rows.Close()

	// Insert boundaries one at a time to catch individual errors
	var inserted, errorCount int
	for _, e := range validEntries {
		cityID, ok := wofToUUID[e.WofID]
		if !ok {
			continue
		}

		_, err := imp.pgPool.Exec(ctx, `
			INSERT INTO geo_city_boundaries (city_id, boundary, area_km2)
			VALUES ($1, ST_Multi(ST_GeomFromGeoJSON($2))::geography, ST_Area(ST_GeomFromGeoJSON($2)::geography) / 1e6)
			ON CONFLICT (city_id) DO UPDATE SET
				boundary = EXCLUDED.boundary,
				area_km2 = EXCLUDED.area_km2,
				updated_at = now()
		`, cityID, e.Geometry)

		if err != nil {
			errorCount++
			// Log first 10 errors with details
			if errorCount <= 10 {
				log.Printf("    ERROR: WOF %d (city %s): %v", e.WofID, cityID, err)
			}
			continue
		}
		inserted++
	}

	return inserted, errorCount + skippedGeomType, nil
}

func (imp *Importer) insertCityBatch(ctx context.Context, batch [][]interface{}) (int, error) {
	// Batch format: [continent_id, country_id, region_id, district_id, name, name_ascii, lat, lng, tz, elevation, population, wof_id, coordinate_source_id, elevation_source_id]
	// Use batch INSERT with ON CONFLICT to skip existing cities

	b := &pgx.Batch{}
	for _, row := range batch {
		b.Queue(`
			INSERT INTO geo_cities (continent_id, country_id, region_id, district_id, name, name_ascii,
				latitude, longitude, timezone, elevation_m, population, wof_id,
				coordinate_source_id, elevation_source_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			ON CONFLICT (wof_id) DO UPDATE SET
				continent_id = EXCLUDED.continent_id,
				country_id = EXCLUDED.country_id,
				region_id = EXCLUDED.region_id,
				district_id = EXCLUDED.district_id,
				name = EXCLUDED.name,
				name_ascii = EXCLUDED.name_ascii,
				latitude = EXCLUDED.latitude,
				longitude = EXCLUDED.longitude,
				timezone = EXCLUDED.timezone,
				elevation_m = EXCLUDED.elevation_m,
				population = EXCLUDED.population,
				coordinate_source_id = EXCLUDED.coordinate_source_id,
				elevation_source_id = EXCLUDED.elevation_source_id,
				updated_at = now()
		`, row...)
	}

	br := imp.pgPool.SendBatch(ctx, b)
	defer br.Close()

	// Count successful inserts/updates
	count := 0
	for range batch {
		_, err := br.Exec()
		if err != nil {
			return count, err
		}
		count++
	}

	return count, nil
}

// getContinentID looks up the continent for a country using WOF hierarchy.
// Returns 0 if continent cannot be determined (country will be skipped).
func (imp *Importer) getContinentID(rec *WOFRecord) int {
	wofContID := rec.Hierarchy["continent_id"]
	if wofContID == 0 {
		return 0 // No continent in hierarchy
	}

	if ourID, ok := imp.wofContinentMap[wofContID]; ok {
		return ourID
	}

	return 0 // Unknown continent
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullInt64(i int64) interface{} {
	if i == 0 {
		return nil
	}
	return i
}

// nullInt32 converts int64 to *int32 for PostgreSQL integer columns, returning nil if zero
func nullInt32(i int64) interface{} {
	if i == 0 {
		return nil
	}
	v := int32(i)
	return v
}

// startImportTracking creates a geo_data_imports record and returns the ID
func (imp *Importer) startImportTracking(ctx context.Context) error {
	sourceID, ok := imp.sourceIDs["wof"]
	if !ok {
		return fmt.Errorf("source 'wof' not found")
	}

	var importID int
	err := imp.pgPool.QueryRow(ctx, `
		INSERT INTO geo_data_imports (source_id, import_type, version, started_at)
		VALUES ($1, $2, $3, now())
		RETURNING id
	`, sourceID, "wof-full", "latest").Scan(&importID)

	if err != nil {
		return fmt.Errorf("create import tracking record: %w", err)
	}

	imp.importID = importID
	log.Printf("  Started import tracking (ID: %d)", importID)
	return nil
}

// completeImportTracking updates the geo_data_imports record with final statistics
func (imp *Importer) completeImportTracking(ctx context.Context, importErr error) error {
	if imp.importID == 0 {
		return nil // No tracking started
	}

	totalProcessed := imp.stats.continents + imp.stats.countries + imp.stats.regions + imp.stats.districts + imp.stats.cities
	totalImported := totalProcessed // WOF is insert-or-update, so all processed = imported

	var errorArray interface{}
	if len(imp.stats.errors) > 0 {
		errorArray = imp.stats.errors
	}

	notes := fmt.Sprintf("Continents: %d, Countries: %d, Regions: %d, Districts: %d, Cities: %d",
		imp.stats.continents, imp.stats.countries, imp.stats.regions, imp.stats.districts, imp.stats.cities)

	_, err := imp.pgPool.Exec(ctx, `
		UPDATE geo_data_imports
		SET completed_at = now(),
		    records_processed = $2,
		    records_imported = $3,
		    errors = $4,
		    notes = $5
		WHERE id = $1
	`, imp.importID, totalProcessed, totalImported, errorArray, notes)

	if err != nil {
		return fmt.Errorf("update import tracking record: %w", err)
	}

	if importErr != nil {
		log.Printf("  Import tracking completed with errors (ID: %d)", imp.importID)
	} else {
		log.Printf("  Import tracking completed successfully (ID: %d)", imp.importID)
	}

	return nil
}
