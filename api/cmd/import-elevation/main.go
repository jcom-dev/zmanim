// Package main populates elevation data for geo_cities using Copernicus GLO-90 DEM tiles.
//
// GLO-90 (Global 90m) provides high-quality elevation data derived from the
// TanDEM-X mission. Tiles must be pre-downloaded to data/glo90_data/.
//
// Memory optimizations (matching import-wof patterns):
//   - Disk-based streaming: cities written to temp file, then streamed back
//   - Sorted by tile for cache locality
//   - Shared LRU tile cache with max size limit
//   - Periodic GC during processing
//   - Memory logging at each phase
//
// Data Source:
//   - Copernicus DEM GLO-90: https://copernicus-dem-30m.s3.amazonaws.com/
//
// Usage:
//
//	go run ./cmd/import-elevation
package main

import (
	"bufio"
	"container/list"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/airbusgeo/godal"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/sync/singleflight"
)

const (
	glo90DataDir  = "data/glo90_data"
	maxCacheTiles = 200   // Keep ~200 tiles open (~100MB GDAL overhead)
	batchSize     = 10000 // Cities per DB batch update
	numWorkers    = 4     // Parallel workers
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	start := time.Now()

	// Initialize GDAL
	godal.RegisterAll()

	pgURL := os.Getenv("DATABASE_URL")
	if pgURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable required")
	}

	ctx := context.Background()

	// Configure pool for high throughput
	config, err := pgxpool.ParseConfig(pgURL)
	if err != nil {
		return fmt.Errorf("parse database URL: %w", err)
	}
	config.MaxConns = 20
	config.MinConns = 5

	pgPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("connect to PostgreSQL: %w", err)
	}
	defer pgPool.Close()

	// Check GLO-90 data directory exists
	if _, err := os.Stat(glo90DataDir); os.IsNotExist(err) {
		return fmt.Errorf("GLO-90 data directory not found: %s\n\nDownload tiles from https://copernicus-dem-30m.s3.amazonaws.com/", glo90DataDir)
	}

	// Count available tiles
	entries, err := os.ReadDir(glo90DataDir)
	if err != nil {
		return fmt.Errorf("read GLO-90 directory: %w", err)
	}

	fmt.Println("GLO-90 Elevation Import (using GDAL)")
	fmt.Println("=====================================")
	fmt.Printf("Data directory: %s\n", glo90DataDir)
	fmt.Printf("Tiles available: %d\n", len(entries))
	fmt.Printf("Tile cache: %d tiles max (~%dMB)\n", maxCacheTiles, maxCacheTiles*50)
	fmt.Println()

	// Count cities to process
	var totalCities int
	err = pgPool.QueryRow(ctx, `SELECT COUNT(*) FROM geo_cities`).Scan(&totalCities)
	if err != nil {
		return fmt.Errorf("count cities: %w", err)
	}

	if totalCities == 0 {
		fmt.Println("No cities found")
		return nil
	}

	fmt.Printf("Cities to process: %d\n", totalCities)
	fmt.Println()

	// Disable triggers for bulk import
	fmt.Println("Phase 1: Preparing database...")
	fmt.Println("  Disabling triggers...")
	_, err = pgPool.Exec(ctx, "ALTER TABLE geo_city_elevations DISABLE TRIGGER trg_geo_city_elevations_update_effective")
	if err != nil {
		fmt.Printf("  Warning: could not disable elevation trigger: %v\n", err)
	}
	_, err = pgPool.Exec(ctx, "ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy")
	if err != nil {
		fmt.Printf("  Warning: could not disable hierarchy trigger: %v\n", err)
	}
	_, err = pgPool.Exec(ctx, "ALTER TABLE geo_cities DISABLE TRIGGER update_geo_cities_updated_at")
	if err != nil {
		fmt.Printf("  Warning: could not disable updated_at trigger: %v\n", err)
	}
	defer func() {
		fmt.Println("Re-enabling triggers...")
		pgPool.Exec(ctx, "ALTER TABLE geo_city_elevations ENABLE TRIGGER trg_geo_city_elevations_update_effective")
		pgPool.Exec(ctx, "ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy")
		pgPool.Exec(ctx, "ALTER TABLE geo_cities ENABLE TRIGGER update_geo_cities_updated_at")
	}()
	logMemory("after prep")

	// Phase 2: Stream cities to disk file (sorted by tile for cache locality)
	fmt.Println("Phase 2: Streaming cities to disk (sorted by tile)...")
	tmpPath, totalWritten, err := streamCitiesToDisk(ctx, pgPool)
	if err != nil {
		return fmt.Errorf("stream cities to disk: %w", err)
	}
	defer os.Remove(tmpPath)
	fmt.Printf("  Written %d cities to %s\n", totalWritten, tmpPath)
	runtime.GC()
	logMemory("after disk write")

	// Look up glo90 source ID once for reuse
	var glo90SourceID int32
	err = pgPool.QueryRow(ctx, `SELECT id FROM geo_data_sources WHERE key = 'glo90'`).Scan(&glo90SourceID)
	if err != nil {
		return fmt.Errorf("lookup glo90 source ID: %w", err)
	}

	// Phase 3: Stream from disk, lookup elevation, update DB
	fmt.Println("Phase 3: Processing elevations...")
	updated, failed, err := processFromDisk(ctx, pgPool, tmpPath, totalCities, glo90SourceID)
	if err != nil {
		return fmt.Errorf("process elevations: %w", err)
	}
	runtime.GC()
	logMemory("after processing")

	// Phase 4: Bulk update geo_cities.elevation_m from geo_city_elevations
	fmt.Println("Phase 4: Bulk updating geo_cities.elevation_m...")
	bulkUpdated, err := bulkUpdateGeoCitiesElevation(ctx, pgPool)
	if err != nil {
		fmt.Printf("  Warning: bulk update failed: %v\n", err)
	} else {
		fmt.Printf("  Updated %d cities with GLO-90 elevation\n", bulkUpdated)
	}

	elapsed := time.Since(start)
	rate := float64(totalCities) / elapsed.Seconds()

	fmt.Println()
	fmt.Printf("Complete in %s (%.0f cities/sec)\n", elapsed.Round(time.Second), rate)
	fmt.Printf("  Inserted: %d\n", updated)
	fmt.Printf("  No tile: %d\n", failed)

	return nil
}

// cityRecord for disk storage (JSON lines format like import-wof)
type cityRecord struct {
	ID          int64   `json:"i"`
	Lat         float64 `json:"a"`
	Lng         float64 `json:"o"`
	CoordSource int32   `json:"c"`
}

// cityUpdate for batch DB updates
type cityUpdate struct {
	id          int64
	coordSource int32
	elevation   int32
}

func streamCitiesToDisk(ctx context.Context, pgPool *pgxpool.Pool) (string, int, error) {
	// Create temp file
	tmpFile, err := os.CreateTemp("", "elevation-cities-*.jsonl")
	if err != nil {
		return "", 0, fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	writer := bufio.NewWriter(tmpFile)
	encoder := json.NewEncoder(writer)

	// Query cities ordered by tile for cache locality
	// Must match tileKey logic: ceil for negative, floor for positive
	rows, err := pgPool.Query(ctx, `
		SELECT id, latitude, longitude, coordinate_source_id
		FROM geo_cities
		ORDER BY
			CASE WHEN latitude >= 0 THEN FLOOR(latitude)::int ELSE -CEIL(-latitude)::int END,
			CASE WHEN longitude >= 0 THEN FLOOR(longitude)::int ELSE -CEIL(-longitude)::int END
	`)
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return "", 0, fmt.Errorf("query cities: %w", err)
	}

	var count int
	for rows.Next() {
		var c cityRecord
		if err := rows.Scan(&c.ID, &c.Lat, &c.Lng, &c.CoordSource); err != nil {
			continue
		}
		if err := encoder.Encode(c); err != nil {
			rows.Close()
			tmpFile.Close()
			os.Remove(tmpPath)
			return "", 0, fmt.Errorf("encode city: %w", err)
		}
		count++
		if count%100000 == 0 {
			fmt.Printf("  Written %d cities...\n", count)
		}
	}
	rows.Close()

	if err := writer.Flush(); err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return "", 0, fmt.Errorf("flush writer: %w", err)
	}
	tmpFile.Close()

	return tmpPath, count, nil
}

func processFromDisk(ctx context.Context, pgPool *pgxpool.Pool, tmpPath string, totalCities int, glo90SourceID int32) (int, int, error) {
	file, err := os.Open(tmpPath)
	if err != nil {
		return 0, 0, fmt.Errorf("open temp file: %w", err)
	}
	defer file.Close()

	// Shared LRU cache (thread-safe)
	tileCache := NewLRUTileCache(maxCacheTiles)
	reader := &GLO90Reader{dataDir: glo90DataDir, cache: tileCache}

	// Channels for parallel processing
	jobs := make(chan cityRecord, numWorkers*100)
	results := make(chan *cityUpdate, numWorkers*100)
	var wg sync.WaitGroup

	// Start workers
	fmt.Printf("  Starting %d workers...\n", numWorkers)
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for c := range jobs {
				elev, err := reader.GetElevation(c.Lat, c.Lng)
				if err == nil {
					results <- &cityUpdate{id: c.ID, coordSource: c.CoordSource, elevation: int32(elev)}
				} else {
					results <- nil // Signal failure
				}
			}
		}()
	}

	// Collector goroutine
	var batch []cityUpdate
	var totalUpdated, totalFailed, processed int
	var mu sync.Mutex
	done := make(chan struct{})

	go func() {
		for result := range results {
			mu.Lock()
			if result != nil {
				batch = append(batch, *result)
			} else {
				totalFailed++
			}
			processed++

			// Quick progress every 1000
			if processed%1000 == 0 {
				pct := float64(processed) / float64(totalCities) * 100
				fmt.Printf("\r  %d/%d (%.1f%%)", processed, totalCities, pct)
			}

			// Flush batch to DB
			if len(batch) >= batchSize {
				batchToFlush := make([]cityUpdate, len(batch))
				copy(batchToFlush, batch)
				batch = batch[:0]
				mu.Unlock()

				if err := flushBatchBulk(ctx, pgPool, batchToFlush, glo90SourceID); err != nil {
					fmt.Printf("Warning: batch update failed: %v\n", err)
				} else {
					mu.Lock()
					totalUpdated += len(batchToFlush)
					mu.Unlock()
				}

				mu.Lock()
				if processed%10000 == 0 {
					var m runtime.MemStats
					runtime.ReadMemStats(&m)
					pct := float64(processed) / float64(totalCities) * 100
					fmt.Printf("  Progress: %d/%d (%.1f%%) updated:%d failed:%d mem:%dMB cache:%d\n",
						processed, totalCities, pct, totalUpdated, totalFailed, m.Alloc/1024/1024, tileCache.Len())
				}
				mu.Unlock()

				// Periodic GC
				if processed%100000 == 0 {
					runtime.GC()
				}
			} else {
				mu.Unlock()
			}
		}
		close(done)
	}()

	// Read and send jobs
	decoder := json.NewDecoder(file)
	for {
		var c cityRecord
		if err := decoder.Decode(&c); err != nil {
			if err.Error() == "EOF" {
				break
			}
			close(jobs)
			return 0, 0, fmt.Errorf("decode city: %w", err)
		}
		jobs <- c
	}
	close(jobs)

	// Wait for workers to finish
	wg.Wait()
	close(results)

	// Wait for collector to finish
	<-done

	// Flush remaining
	mu.Lock()
	remainingBatch := batch
	mu.Unlock()

	if len(remainingBatch) > 0 {
		if err := flushBatchBulk(ctx, pgPool, remainingBatch, glo90SourceID); err != nil {
			fmt.Printf("Warning: final batch update failed: %v\n", err)
		} else {
			totalUpdated += len(remainingBatch)
		}
	}

	return totalUpdated, totalFailed, nil
}

// flushBatchBulk updates geo_cities using a single UPDATE with VALUES clause
// Much faster than individual updates or even pgx.Batch
func flushBatchBulk(ctx context.Context, pgPool *pgxpool.Pool, updates []cityUpdate, sourceID int32) error {
	if len(updates) == 0 {
		return nil
	}

	// Build arrays for bulk insert
	ids := make([]int64, len(updates))
	coordSources := make([]int32, len(updates))
	elevations := make([]int32, len(updates))
	for i, u := range updates {
		ids[i] = u.id
		coordSources[i] = u.coordSource
		elevations[i] = u.elevation
	}

	// Insert into geo_city_elevations with ON CONFLICT to update existing
	_, err := pgPool.Exec(ctx, `
		INSERT INTO geo_city_elevations (city_id, coordinate_source_id, source_id, elevation_m)
		SELECT v.id, v.coord_source, $4, v.elevation
		FROM unnest($1::bigint[], $2::int[], $3::int[]) AS v(id, coord_source, elevation)
		ON CONFLICT (city_id, coordinate_source_id, source_id, COALESCE(publisher_id, 0))
		DO UPDATE SET elevation_m = EXCLUDED.elevation_m, updated_at = now()
	`, ids, coordSources, elevations, sourceID)

	return err
}

// bulkUpdateGeoCitiesElevation updates geo_cities.elevation_m and elevation_source from geo_city_elevations
// This replicates the trigger logic but in bulk for performance
func bulkUpdateGeoCitiesElevation(ctx context.Context, pgPool *pgxpool.Pool) (int64, error) {
	// Update geo_cities with the best elevation from geo_city_elevations
	// Priority: publisher (1) > community (2) > glo90 (3)
	// Only use elevations matching the city's current coordinate_source_id
	result, err := pgPool.Exec(ctx, `
		UPDATE geo_cities c
		SET elevation_m = e.elevation_m,
		    elevation_source_id = e.source_id,
		    updated_at = now()
		FROM (
			SELECT DISTINCT ON (ce.city_id, ce.coordinate_source_id)
				ce.city_id,
				ce.coordinate_source_id,
				ce.elevation_m,
				ce.source_id
			FROM geo_city_elevations ce
			JOIN geo_data_sources ds ON ds.id = ce.source_id
			ORDER BY ce.city_id, ce.coordinate_source_id, ds.priority ASC
		) e
		WHERE c.id = e.city_id
		  AND c.coordinate_source_id = e.coordinate_source_id
		  AND (c.elevation_m IS DISTINCT FROM e.elevation_m OR c.elevation_source_id IS DISTINCT FROM e.source_id)
	`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}

func logMemory(step string) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("  [mem] %s: %dMB alloc, %dMB sys\n", step, m.Alloc/1024/1024, m.Sys/1024/1024)
}

// =============================================================================
// LRU TILE CACHE (thread-safe, bounded memory)
// =============================================================================

// cachedTile holds a GDAL dataset for a tile
type cachedTile struct {
	mu    sync.Mutex // Per-tile lock for GDAL reads
	ds    *godal.Dataset
	gt    [6]float64 // GeoTransform
	band  godal.Band
	sizeX int
	sizeY int
}

type cacheEntry struct {
	key   string
	tile  *cachedTile
	valid bool // false = known missing tile
}

// LRUTileCache is a thread-safe LRU cache for GeoTIFF tiles
type LRUTileCache struct {
	maxSize int
	mu      sync.Mutex
	cache   map[string]*list.Element
	lru     *list.List
}

// NewLRUTileCache creates a new LRU cache with the given max size
func NewLRUTileCache(maxSize int) *LRUTileCache {
	return &LRUTileCache{
		maxSize: maxSize,
		cache:   make(map[string]*list.Element),
		lru:     list.New(),
	}
}

// Get retrieves a tile from the cache
func (c *LRUTileCache) Get(key string) (*cachedTile, bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.lru.MoveToFront(elem)
		entry := elem.Value.(*cacheEntry)
		return entry.tile, entry.valid, true
	}
	return nil, false, false
}

// Put adds a tile to the cache
func (c *LRUTileCache) Put(key string, tile *cachedTile, valid bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.lru.MoveToFront(elem)
		entry := elem.Value.(*cacheEntry)
		// Close old dataset if replacing
		if entry.tile != nil && entry.tile.ds != nil {
			entry.tile.ds.Close()
		}
		entry.tile = tile
		entry.valid = valid
		return
	}

	// Evict oldest if at capacity
	for c.lru.Len() >= c.maxSize {
		oldest := c.lru.Back()
		if oldest != nil {
			entry := oldest.Value.(*cacheEntry)
			// Close GDAL dataset when evicting
			if entry.tile != nil && entry.tile.ds != nil {
				entry.tile.ds.Close()
			}
			delete(c.cache, entry.key)
			c.lru.Remove(oldest)
		}
	}

	entry := &cacheEntry{key: key, tile: tile, valid: valid}
	elem := c.lru.PushFront(entry)
	c.cache[key] = elem
}

// Len returns the number of cached tiles
func (c *LRUTileCache) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lru.Len()
}

// =============================================================================
// GLO-90 READER
// =============================================================================

// gdalMu protects all GDAL operations. GDAL/libtiff have internal global state
// that is not thread-safe, so we must serialize all GDAL calls.
var gdalMu sync.Mutex

// GLO90Reader reads elevation data from Copernicus GLO-90 DEM tiles
type GLO90Reader struct {
	dataDir string
	cache   *LRUTileCache
	sfGroup singleflight.Group // Prevents duplicate tile loading
}

// tileKey returns the cache key for a tile (must match glo90TilePath logic)
func tileKey(lat, lng float64) string {
	var latKey int
	if lat >= 0 {
		latKey = int(math.Floor(lat))
	} else {
		latKey = -int(math.Ceil(-lat)) // Negative to distinguish S from N
	}

	var lngKey int
	if lng >= 0 {
		lngKey = int(math.Floor(lng))
	} else {
		lngKey = -int(math.Ceil(-lng)) // Negative to distinguish W from E
	}

	return fmt.Sprintf("%d,%d", latKey, lngKey)
}

// glo90TilePath returns the path to the GLO-90 tile for a given lat/lng
// GLO-90 tile naming convention:
//   - N tiles: named by floor of latitude (N51 covers 51.0 to 52.0)
//   - S tiles: named by ceiling of absolute latitude (S08 covers -7.0 to -8.0)
//   - E tiles: named by floor of longitude (E110 covers 110.0 to 111.0)
//   - W tiles: named by ceiling of absolute longitude (W001 covers -1.0 to 0.0)
func (r *GLO90Reader) glo90TilePath(lat, lng float64) string {
	var latInt int
	var latDir string
	if lat >= 0 {
		latDir = "N"
		latInt = int(math.Floor(lat))
	} else {
		latDir = "S"
		// For S tiles, use ceiling of absolute value
		// e.g., lat=-5.4: ceil(5.4) = 6 -> S06 (covers -5.0 to -6.0)
		latInt = int(math.Ceil(-lat))
	}

	var lngInt int
	var lngDir string
	if lng >= 0 {
		lngDir = "E"
		lngInt = int(math.Floor(lng))
	} else {
		lngDir = "W"
		// For W tiles, use ceiling of absolute value
		// e.g., lng=-0.5: ceil(0.5) = 1 -> W001
		lngInt = int(math.Ceil(-lng))
	}

	folderName := fmt.Sprintf("Copernicus_DSM_COG_30_%s%02d_00_%s%03d_00_DEM", latDir, latInt, lngDir, lngInt)
	tifName := folderName + ".tif"
	return filepath.Join(r.dataDir, folderName, tifName)
}

// GetElevation returns the elevation at the given lat/lng
func (r *GLO90Reader) GetElevation(lat, lng float64) (float32, error) {
	key := tileKey(lat, lng)

	// Check cache first
	if tile, valid, found := r.cache.Get(key); found {
		if !valid {
			return 0, fmt.Errorf("tile not available")
		}
		return r.readElevation(tile, lat, lng)
	}

	// Use singleflight to prevent duplicate tile loading when multiple
	// goroutines request the same tile simultaneously
	result, err, _ := r.sfGroup.Do(key, func() (interface{}, error) {
		// Double-check cache after acquiring singleflight (another goroutine may have loaded it)
		if tile, valid, found := r.cache.Get(key); found {
			if !valid {
				return nil, fmt.Errorf("tile not available")
			}
			return tile, nil
		}

		// Load tile using GDAL
		tilePath := r.glo90TilePath(lat, lng)

		gdalMu.Lock()
		ds, err := godal.Open(tilePath)
		if err != nil {
			gdalMu.Unlock()
			r.cache.Put(key, nil, false)
			return nil, fmt.Errorf("tile not found: %s", tilePath)
		}

		gt, err := ds.GeoTransform()
		if err != nil {
			ds.Close()
			gdalMu.Unlock()
			r.cache.Put(key, nil, false)
			return nil, fmt.Errorf("failed to get geotransform: %w", err)
		}

		bands := ds.Bands()
		if len(bands) == 0 {
			ds.Close()
			gdalMu.Unlock()
			r.cache.Put(key, nil, false)
			return nil, fmt.Errorf("no bands in tile")
		}

		structure := ds.Structure()
		gdalMu.Unlock()

		tile := &cachedTile{
			ds:    ds,
			gt:    gt,
			band:  bands[0],
			sizeX: structure.SizeX,
			sizeY: structure.SizeY,
		}

		r.cache.Put(key, tile, true)
		return tile, nil
	})

	if err != nil {
		return 0, err
	}

	return r.readElevation(result.(*cachedTile), lat, lng)
}

// readElevation reads elevation from a cached tile at the given lat/lng
func (r *GLO90Reader) readElevation(tile *cachedTile, lat, lng float64) (float32, error) {
	// Convert geo coords to pixel coords using inverse geotransform
	// gt[0] = origin X, gt[1] = pixel width, gt[2] = rotation (usually 0)
	// gt[3] = origin Y, gt[4] = rotation (usually 0), gt[5] = pixel height (negative)
	px := (lng - tile.gt[0]) / tile.gt[1]
	py := (lat - tile.gt[3]) / tile.gt[5]

	x := int(px)
	y := int(py)

	// Clamp to valid bounds (handles edge cases like lat=51.0 exactly on tile boundary)
	if x < 0 {
		x = 0
	} else if x >= tile.sizeX {
		x = tile.sizeX - 1
	}
	if y < 0 {
		y = 0
	} else if y >= tile.sizeY {
		y = tile.sizeY - 1
	}

	// Per-tile lock allows parallel reads on different tiles
	tile.mu.Lock()
	buf := make([]float32, 1)
	err := tile.band.Read(x, y, buf, 1, 1)
	tile.mu.Unlock()

	if err != nil {
		return 0, fmt.Errorf("failed to read pixel: %w", err)
	}

	return buf[0], nil
}
