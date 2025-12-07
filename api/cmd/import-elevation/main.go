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

	"github.com/gden173/geotiff/geotiff"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	glo90DataDir  = "data/glo90_data"
	maxCacheTiles = 30  // Max tiles in memory (~50MB each = ~1.5GB max)
	batchSize     = 5000 // Cities per DB batch update
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	start := time.Now()

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

	fmt.Println("GLO-90 Elevation Import")
	fmt.Println("=======================")
	fmt.Printf("Data directory: %s\n", glo90DataDir)
	fmt.Printf("Tiles available: %d\n", len(entries))
	fmt.Printf("Tile cache: %d tiles max (~%dMB)\n", maxCacheTiles, maxCacheTiles*50)
	fmt.Println()

	// Count cities needing elevation
	var totalMissing int
	err = pgPool.QueryRow(ctx, `SELECT COUNT(*) FROM geo_cities WHERE elevation_m IS NULL`).Scan(&totalMissing)
	if err != nil {
		return fmt.Errorf("count cities: %w", err)
	}

	if totalMissing == 0 {
		fmt.Println("All cities already have elevation data")
		return nil
	}

	fmt.Printf("Cities needing elevation: %d\n", totalMissing)
	fmt.Println()

	// Disable triggers for faster updates
	fmt.Println("Phase 1: Preparing database...")
	_, err = pgPool.Exec(ctx, "ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy")
	if err != nil {
		fmt.Printf("Warning: could not disable trigger: %v\n", err)
	}
	defer pgPool.Exec(ctx, "ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy")
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

	// Phase 3: Stream from disk, lookup elevation, update DB
	fmt.Println("Phase 3: Processing elevations...")
	updated, failed, err := processFromDisk(ctx, pgPool, tmpPath, totalMissing)
	if err != nil {
		return fmt.Errorf("process elevations: %w", err)
	}
	runtime.GC()
	logMemory("after processing")

	elapsed := time.Since(start)
	rate := float64(totalMissing) / elapsed.Seconds()

	fmt.Println()
	fmt.Printf("Complete in %s (%.0f cities/sec)\n", elapsed.Round(time.Second), rate)
	fmt.Printf("  Updated: %d\n", updated)
	fmt.Printf("  No tile: %d\n", failed)

	return nil
}

// cityRecord for disk storage (JSON lines format like import-wof)
type cityRecord struct {
	ID  string  `json:"i"`
	Lat float64 `json:"a"`
	Lng float64 `json:"o"`
}

// cityUpdate for batch DB updates
type cityUpdate struct {
	id        string
	elevation int32
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
	rows, err := pgPool.Query(ctx, `
		SELECT id, latitude, longitude
		FROM geo_cities
		WHERE elevation_m IS NULL
		ORDER BY FLOOR(latitude)::int, FLOOR(longitude)::int
	`)
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpPath)
		return "", 0, fmt.Errorf("query cities: %w", err)
	}

	var count int
	for rows.Next() {
		var c cityRecord
		if err := rows.Scan(&c.ID, &c.Lat, &c.Lng); err != nil {
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

func processFromDisk(ctx context.Context, pgPool *pgxpool.Pool, tmpPath string, totalMissing int) (int, int, error) {
	file, err := os.Open(tmpPath)
	if err != nil {
		return 0, 0, fmt.Errorf("open temp file: %w", err)
	}
	defer file.Close()

	// Shared LRU cache
	tileCache := NewLRUTileCache(maxCacheTiles)
	reader := &GLO90Reader{dataDir: glo90DataDir, cache: tileCache}

	decoder := json.NewDecoder(file)

	var batch []cityUpdate
	var totalUpdated, totalFailed, processed int

	for {
		var c cityRecord
		if err := decoder.Decode(&c); err != nil {
			if err.Error() == "EOF" {
				break
			}
			return 0, 0, fmt.Errorf("decode city: %w", err)
		}

		elev, err := reader.GetElevation(c.Lat, c.Lng)
		if err == nil {
			batch = append(batch, cityUpdate{id: c.ID, elevation: int32(elev)})
		} else {
			totalFailed++
		}
		processed++

		// Flush batch to DB
		if len(batch) >= batchSize {
			if err := flushBatch(ctx, pgPool, batch); err != nil {
				fmt.Printf("Warning: batch update failed: %v\n", err)
			} else {
				totalUpdated += len(batch)
			}
			batch = batch[:0] // Reset but keep capacity

			if processed%50000 == 0 {
				var m runtime.MemStats
				runtime.ReadMemStats(&m)
				pct := float64(processed) / float64(totalMissing) * 100
				fmt.Printf("  Progress: %d/%d (%.1f%%) updated:%d failed:%d mem:%dMB cache:%d\n",
					processed, totalMissing, pct, totalUpdated, totalFailed, m.Alloc/1024/1024, tileCache.Len())
			}

			// Periodic GC
			if processed%100000 == 0 {
				runtime.GC()
			}
		}
	}

	// Flush remaining
	if len(batch) > 0 {
		if err := flushBatch(ctx, pgPool, batch); err != nil {
			fmt.Printf("Warning: final batch update failed: %v\n", err)
		} else {
			totalUpdated += len(batch)
		}
	}

	return totalUpdated, totalFailed, nil
}

func flushBatch(ctx context.Context, pgPool *pgxpool.Pool, updates []cityUpdate) error {
	batch := &pgx.Batch{}
	for _, u := range updates {
		batch.Queue(`UPDATE geo_cities SET elevation_m = $1 WHERE id = $2`, u.elevation, u.id)
	}
	br := pgPool.SendBatch(ctx, batch)
	return br.Close()
}

func logMemory(step string) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("  [mem] %s: %dMB alloc, %dMB sys\n", step, m.Alloc/1024/1024, m.Sys/1024/1024)
}

// =============================================================================
// LRU TILE CACHE (thread-safe, bounded memory)
// =============================================================================

type cacheEntry struct {
	key   string
	tile  *geotiff.GeoTIFF
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
func (c *LRUTileCache) Get(key string) (*geotiff.GeoTIFF, bool, bool) {
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
func (c *LRUTileCache) Put(key string, tile *geotiff.GeoTIFF, valid bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.lru.MoveToFront(elem)
		entry := elem.Value.(*cacheEntry)
		entry.tile = tile
		entry.valid = valid
		return
	}

	// Evict oldest if at capacity
	for c.lru.Len() >= c.maxSize {
		oldest := c.lru.Back()
		if oldest != nil {
			entry := oldest.Value.(*cacheEntry)
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

// GLO90Reader reads elevation data from Copernicus GLO-90 DEM tiles
type GLO90Reader struct {
	dataDir string
	cache   *LRUTileCache
}

// tileKey returns the cache key for a tile
func tileKey(lat, lng float64) string {
	latInt := int(math.Floor(lat))
	lngInt := int(math.Floor(lng))
	return fmt.Sprintf("%d,%d", latInt, lngInt)
}

// glo90TilePath returns the path to the GLO-90 tile for a given lat/lng
func (r *GLO90Reader) glo90TilePath(lat, lng float64) string {
	latInt := int(math.Floor(lat))
	lngInt := int(math.Floor(lng))

	latDir := "N"
	if latInt < 0 {
		latDir = "S"
		latInt = -latInt
	}
	lngDir := "E"
	if lngInt < 0 {
		lngDir = "W"
		lngInt = -lngInt
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
		return tile.AtCoord(lng, lat, true)
	}

	// Load tile
	tilePath := r.glo90TilePath(lat, lng)
	f, err := os.Open(tilePath)
	if err != nil {
		// Cache the miss
		r.cache.Put(key, nil, false)
		return 0, fmt.Errorf("tile not found: %s", tilePath)
	}
	defer f.Close()

	gtiff, err := geotiff.Read(f)
	if err != nil {
		r.cache.Put(key, nil, false)
		return 0, fmt.Errorf("failed to read GeoTIFF: %w", err)
	}

	// Cache the tile
	r.cache.Put(key, gtiff, true)

	return gtiff.AtCoord(lng, lat, true)
}
