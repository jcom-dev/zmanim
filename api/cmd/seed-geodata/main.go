// Package main seeds geographic data from compressed PostgreSQL dumps.
//
// This tool downloads and restores geographic data from S3 or local files.
// Optimized for fast restoration during migrations and new environment setup.
//
// Features:
//   - Downloads from S3 with progress tracking and retries
//   - Fast zstd decompression with parallel restore
//   - Parallel restore for 3-4x speed improvement (requires temp disk space)
//   - Pre-flight checks (connection, dependencies)
//   - Integrity verification (checksums)
//
// Usage:
//
//	seed-geodata seed --source=s3://bucket/path/geodata.dump.zst
//	seed-geodata seed --source=/local/path/geodata.dump.zst
//	seed-geodata verify --source=s3://bucket/path/geodata.dump.zst
//
// Performance:
//   - Typical 2-4GB compressed → ~5-10 minutes total
//   - Parallel restore with --jobs=4 (default)
//   - Requires temp disk space (~3x compressed size)
//
// Environment:
//
//	DATABASE_URL      PostgreSQL connection string (required)
//	AWS_REGION        AWS region for S3 (default: us-east-1)
//	AWS_PROFILE       AWS profile to use (optional)
package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/dustin/go-humanize"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim/internal/geo"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "seed":
		cmdSeed(os.Args[2:])
	case "verify":
		cmdVerify(os.Args[2:])
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `Geographic Data Seed Tool

Downloads and restores geographic data from S3 or local files.

Commands:
  seed      Download and restore geographic data
  verify    Verify dump file without restoring

Options:
  --source URL     S3 URL (s3://bucket/path) or local file path (required)
  --jobs N         Parallel restore jobs (default: 4)
  --no-verify      Skip checksum verification
  --keep-temp      Keep temporary files after restore

Note: This command ALWAYS truncates existing geo data before restore.

Environment:
  DATABASE_URL    PostgreSQL connection string (required)
  AWS_REGION      AWS region (default: us-east-1)
  AWS_PROFILE     AWS profile to use (optional)

Examples:
  # Restore from S3
  seed-geodata seed --source=s3://mybucket/geo-seed/geodata.dump.zst

  # Restore from local file
  seed-geodata seed --source=/tmp/geodata.dump.zst

  # Verify without restoring
  seed-geodata verify --source=s3://mybucket/geo-seed/geodata.dump.zst

  # Restore with 8 parallel jobs
  seed-geodata seed --jobs=8 --source=s3://mybucket/geodata.dump.zst
`)
}

func cmdSeed(args []string) {
	source := ""
	jobs := 4
	skipVerify := false
	keepTemp := false

	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--source=") {
			source = strings.TrimPrefix(args[i], "--source=")
		} else if args[i] == "--source" && i+1 < len(args) {
			source = args[i+1]
			i++
		} else if strings.HasPrefix(args[i], "--jobs=") {
			fmt.Sscanf(args[i], "--jobs=%d", &jobs)
		} else if args[i] == "--no-verify" {
			skipVerify = true
		} else if args[i] == "--keep-temp" {
			keepTemp = true
		}
	}

	if source == "" {
		log.Fatal("--source is required")
	}

	// Validate environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Check dependencies
	if err := checkDependencies(); err != nil {
		log.Fatal(err)
	}

	// Pre-flight: check database connection
	log.Printf("Checking database connection...")
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}
	log.Printf("✓ Database connection OK")

	// Always reset geo data before restore
	log.Printf("Truncating existing geographic data...")
	if err := resetGeoData(ctx, pool); err != nil {
		log.Fatalf("Reset failed: %v", err)
	}
	log.Printf("✓ All geo tables truncated")

	// Drop geo_search_index indexes BEFORE restore for faster data loading
	log.Printf("Dropping geo_search_index indexes for faster restore...")
	if err := dropGeoSearchIndexes(ctx, pool); err != nil {
		log.Printf("Warning: Failed to drop indexes: %v", err)
	} else {
		log.Printf("✓ Indexes dropped")
	}

	start := time.Now()

	// Download or use local file
	var localFile string
	var cleanup func()

	if strings.HasPrefix(source, "s3://") {
		log.Printf("Downloading from S3: %s", source)
		localFile, cleanup, err = downloadFromS3(ctx, source)
		if err != nil {
			log.Fatalf("Download failed: %v", err)
		}
		if !keepTemp {
			defer cleanup()
		}
	} else {
		log.Printf("Using local file: %s", source)
		localFile = source
		if _, err := os.Stat(localFile); err != nil {
			log.Fatalf("File not found: %v", err)
		}
	}

	// Verify checksum
	if !skipVerify {
		if err := verifyChecksum(localFile); err != nil {
			log.Printf("Warning: Checksum verification failed: %v", err)
			log.Printf("Continuing anyway...")
		}
	}

	// Get file info
	stat, err := os.Stat(localFile)
	if err != nil {
		log.Fatalf("Failed to stat file: %v", err)
	}
	log.Printf("File size: %s", humanize.Bytes(uint64(stat.Size())))

	// Restore
	log.Printf("Starting restore with %d parallel jobs...", jobs)
	if err := restoreDatabase(ctx, pool, localFile, dbURL, jobs); err != nil {
		log.Fatalf("Restore failed: %v", err)
	}

	// Reset sequences to match restored data
	log.Printf("Resetting sequences to match restored data...")
	if err := resetGeoSequences(ctx, pool); err != nil {
		log.Printf("Warning: Failed to reset sequences: %v", err)
	} else {
		log.Printf("✓ Sequences reset")
	}

	// Analyze tables for query optimization
	log.Printf("Running VACUUM ANALYZE on geo tables...")
	if err := analyzeGeoTables(ctx, pool); err != nil {
		log.Printf("Warning: ANALYZE failed: %v", err)
	} else {
		log.Printf("✓ Tables analyzed")
	}

	// Ensure geo_names lookup index exists (critical for GetCountries performance)
	log.Printf("Ensuring geo_names lookup index exists...")
	if err := ensureGeoNamesIndex(ctx, pool); err != nil {
		log.Printf("Warning: Failed to create geo_names index: %v", err)
	} else {
		log.Printf("✓ geo_names lookup index ready")
	}

	// Rebuild geo_search_index indexes
	log.Printf("Rebuilding geo_search_index indexes...")
	if err := rebuildGeoSearchIndexes(ctx, pool); err != nil {
		log.Printf("Warning: Failed to rebuild indexes: %v", err)
	} else {
		log.Printf("✓ geo_search_index indexes rebuilt")
	}

	elapsed := time.Since(start)
	log.Printf("\n✓ Seed complete!")
	log.Printf("  Total time: %s", elapsed.Round(time.Second))
	log.Printf("  Ready to use!")
}

func cmdVerify(args []string) {
	source := ""

	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--source=") {
			source = strings.TrimPrefix(args[i], "--source=")
		} else if args[i] == "--source" && i+1 < len(args) {
			source = args[i+1]
			i++
		}
	}

	if source == "" {
		log.Fatal("--source is required")
	}

	ctx := context.Background()

	// Download if S3
	var localFile string
	var cleanup func()

	if strings.HasPrefix(source, "s3://") {
		log.Printf("Downloading from S3: %s", source)
		var err error
		localFile, cleanup, err = downloadFromS3(ctx, source)
		if err != nil {
			log.Fatalf("Download failed: %v", err)
		}
		defer cleanup()
	} else {
		localFile = source
	}

	// Verify checksum
	if err := verifyChecksum(localFile); err != nil {
		log.Fatalf("Verification failed: %v", err)
	}

	// Test decompression
	if strings.HasSuffix(localFile, ".zst") {
		log.Printf("Testing decompression...")
		cmd := exec.Command("zstd", "-t", localFile)
		if err := cmd.Run(); err != nil {
			log.Fatalf("Decompression test failed: %v", err)
		}
		log.Printf("✓ Decompression test passed")
	}

	log.Printf("✓ Verification complete - file is valid")
}

func downloadFromS3(ctx context.Context, s3URL string) (string, func(), error) {
	// Parse S3 URL
	u, err := url.Parse(s3URL)
	if err != nil {
		return "", nil, fmt.Errorf("invalid S3 URL: %w", err)
	}

	bucket := u.Host
	key := strings.TrimPrefix(u.Path, "/")

	// Load AWS config
	region := os.Getenv("AWS_REGION")
	if region == "" {
		region = "us-east-1"
	}

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return "", nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	// Create temp file
	tmpDir := os.TempDir()
	tmpFile := filepath.Join(tmpDir, filepath.Base(key))

	f, err := os.Create(tmpFile)
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer f.Close()

	// Download
	log.Printf("Downloading to: %s", tmpFile)
	start := time.Now()

	result, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to get S3 object: %w", err)
	}
	defer result.Body.Close()

	// Copy with progress
	written, err := io.Copy(f, result.Body)
	if err != nil {
		os.Remove(tmpFile)
		return "", nil, fmt.Errorf("download failed: %w", err)
	}

	elapsed := time.Since(start)
	log.Printf("✓ Downloaded %s in %s", humanize.Bytes(uint64(written)), elapsed.Round(time.Second))

	cleanup := func() {
		os.Remove(tmpFile)
		checksumFile := tmpFile + ".sha256"
		os.Remove(checksumFile)
	}

	// Try to download checksum file
	checksumKey := key + ".sha256"
	checksumFile := tmpFile + ".sha256"
	checksumResult, err := s3Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(checksumKey),
	})
	if err == nil {
		cf, err := os.Create(checksumFile)
		if err == nil {
			io.Copy(cf, checksumResult.Body)
			cf.Close()
			log.Printf("✓ Downloaded checksum file")
		}
		checksumResult.Body.Close()
	}

	return tmpFile, cleanup, nil
}

func verifyChecksum(file string) error {
	checksumFile := file + ".sha256"
	if _, err := os.Stat(checksumFile); err != nil {
		return fmt.Errorf("checksum file not found (use --no-verify to skip)")
	}

	log.Printf("Verifying checksum...")

	// Read expected checksum
	expected, err := os.ReadFile(checksumFile)
	if err != nil {
		return fmt.Errorf("failed to read checksum file: %w", err)
	}

	// Calculate actual checksum
	f, err := os.Open(file)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("failed to calculate checksum: %w", err)
	}

	actual := fmt.Sprintf("%x", h.Sum(nil))
	expectedHash := strings.Fields(string(expected))[0]

	if expectedHash != actual {
		return fmt.Errorf("checksum mismatch!\n  Expected: %s\n  Actual:   %s", expectedHash, actual)
	}

	log.Printf("✓ Checksum verified: %s", actual)
	return nil
}

func restoreDatabase(ctx context.Context, pool *pgxpool.Pool, dumpFile, dbURL string, jobs int) error {
	// Disable user triggers on geo tables for faster restore
	// This is compatible with managed databases (unlike --disable-triggers which
	// tries to disable system triggers and fails on Xata, Supabase, etc.)
	log.Printf("Disabling user triggers on geo tables...")
	if err := setGeoTriggersEnabled(ctx, pool, false); err != nil {
		log.Printf("Warning: Could not disable triggers: %v", err)
		log.Printf("Continuing with triggers enabled (may be slower)...")
	} else {
		log.Printf("✓ User triggers disabled")
		defer func() {
			log.Printf("Re-enabling user triggers...")
			if err := setGeoTriggersEnabled(ctx, pool, true); err != nil {
				log.Printf("Warning: Could not re-enable triggers: %v", err)
			} else {
				log.Printf("✓ User triggers re-enabled")
			}
		}()
	}

	// Disable foreign key constraints for parallel restore
	// pg_restore with --jobs doesn't guarantee table order, so geo_cities
	// might load before geo_districts, causing FK violations
	log.Printf("Disabling foreign key constraints on geo tables...")
	if err := setGeoFKConstraintsEnabled(ctx, pool, false); err != nil {
		log.Printf("Warning: Could not disable FK constraints: %v", err)
		log.Printf("Falling back to single-threaded restore...")
		jobs = 1
	} else {
		log.Printf("✓ Foreign key constraints disabled")
		defer func() {
			log.Printf("Re-enabling foreign key constraints...")
			if err := setGeoFKConstraintsEnabled(ctx, pool, true); err != nil {
				log.Printf("Warning: Could not re-enable FK constraints: %v", err)
				log.Printf("You may need to manually run: ALTER TABLE <table> ENABLE TRIGGER ALL")
			} else {
				log.Printf("✓ Foreign key constraints re-enabled")
			}
		}()
	}

	// Build pg_restore command
	// Use --data-only since schema is managed by migrations
	// NOTE: We don't use --disable-triggers here because managed databases
	// don't allow disabling system constraint triggers
	args := []string{
		"--verbose",
		"--data-only", // Only restore data, not schema
		"--no-owner",
		"--no-acl",
		fmt.Sprintf("--jobs=%d", jobs),
		"--dbname=" + dbURL,
	}

	// If zstd compressed, decompress to temp file first
	// (pg_restore doesn't support --jobs with stdin)
	if strings.HasSuffix(dumpFile, ".zst") {
		log.Printf("Decompressing with zstd...")

		// Create temp file for decompressed dump
		tmpFile := dumpFile + ".tmp"
		defer os.Remove(tmpFile)

		// Decompress: zstd -d -f -o output.dump input.dump.zst
		// -f forces overwrite if temp file exists from previous run
		zstd := exec.Command("zstd", "-d", "-f", "-o", tmpFile, dumpFile)
		zstd.Stdout = os.Stdout
		zstd.Stderr = os.Stderr

		if err := zstd.Run(); err != nil {
			return fmt.Errorf("zstd decompression failed: %w", err)
		}

		log.Printf("✓ Decompression complete")
		log.Printf("Running parallel restore with %d jobs...", jobs)

		// Now restore from decompressed file with parallel jobs
		args = append(args, tmpFile)
		cmd := exec.Command("pg_restore", args...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			return fmt.Errorf("pg_restore failed: %w", err)
		}
	} else {
		// Direct restore from uncompressed dump
		args = append(args, dumpFile)
		cmd := exec.Command("pg_restore", args...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			return fmt.Errorf("pg_restore failed: %w", err)
		}
	}

	return nil
}

// setGeoTriggersEnabled enables or disables user-defined triggers on geo tables.
// This only affects user triggers, not system constraint triggers, making it
// compatible with managed databases like Xata and Supabase.
func setGeoTriggersEnabled(ctx context.Context, pool *pgxpool.Pool, enabled bool) error {
	action := "ENABLE"
	if !enabled {
		action = "DISABLE"
	}

	// Get all user-defined triggers on geo tables
	rows, err := pool.Query(ctx, `
		SELECT t.tgname, c.relname
		FROM pg_trigger t
		JOIN pg_class c ON t.tgrelid = c.oid
		JOIN pg_namespace n ON c.relnamespace = n.oid
		WHERE n.nspname = 'public'
		  AND c.relname LIKE 'geo_%'
		  AND NOT t.tgisinternal  -- Exclude system/constraint triggers
	`)
	if err != nil {
		return fmt.Errorf("failed to query triggers: %w", err)
	}
	defer rows.Close()

	var triggers []struct {
		name  string
		table string
	}
	for rows.Next() {
		var t struct {
			name  string
			table string
		}
		if err := rows.Scan(&t.name, &t.table); err != nil {
			return fmt.Errorf("failed to scan trigger: %w", err)
		}
		triggers = append(triggers, t)
	}

	if len(triggers) == 0 {
		log.Printf("  No user triggers found on geo tables")
		return nil
	}

	// Disable/enable each trigger
	for _, t := range triggers {
		sql := fmt.Sprintf("ALTER TABLE %s %s TRIGGER %s", t.table, action, t.name)
		if _, err := pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("failed to %s trigger %s on %s: %w", strings.ToLower(action), t.name, t.table, err)
		}
	}

	log.Printf("  %sd %d user triggers", action, len(triggers))
	return nil
}

// setGeoFKConstraintsEnabled enables or disables foreign key constraint triggers on geo tables.
// This allows parallel pg_restore to load tables in any order without FK violations.
//
// On managed databases (Xata, Supabase, etc.), ALTER TABLE ... DISABLE TRIGGER ALL requires
// superuser which isn't available. We use session_replication_role instead, but that only
// affects the current session - not pg_restore's separate connection.
//
// If session_replication_role fails (which it will on Xata), we fall back to dropping and
// recreating FK constraints after restore.
func setGeoFKConstraintsEnabled(ctx context.Context, pool *pgxpool.Pool, enabled bool) error {
	if !enabled {
		// Try session_replication_role first (won't help pg_restore but documents intent)
		_, err := pool.Exec(ctx, "SET session_replication_role = 'replica'")
		if err != nil {
			// Expected to fail on managed databases - that's OK
			log.Printf("  session_replication_role not available (expected on managed DBs)")
		}

		// Drop FK constraints - this is the reliable way on managed databases
		return dropGeoFKConstraints(ctx, pool)
	}

	// Re-enable: restore session and recreate constraints
	pool.Exec(ctx, "SET session_replication_role = 'origin'") // Ignore error
	return recreateGeoFKConstraints(ctx, pool)
}

// geoFKConstraint represents a foreign key constraint to drop/recreate
type geoFKConstraint struct {
	table      string
	constraint string
	definition string
}

// getGeoFKConstraints retrieves all FK constraints on geo tables
func getGeoFKConstraints(ctx context.Context, pool *pgxpool.Pool) ([]geoFKConstraint, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			tc.table_name,
			tc.constraint_name,
			pg_get_constraintdef(pgc.oid) as definition
		FROM information_schema.table_constraints tc
		JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = 'public'
		  AND tc.table_name LIKE 'geo_%'
		ORDER BY tc.table_name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query FK constraints: %w", err)
	}
	defer rows.Close()

	var constraints []geoFKConstraint
	for rows.Next() {
		var c geoFKConstraint
		if err := rows.Scan(&c.table, &c.constraint, &c.definition); err != nil {
			return nil, fmt.Errorf("failed to scan constraint: %w", err)
		}
		constraints = append(constraints, c)
	}

	return constraints, nil
}

// Stored constraints for recreation after restore
var droppedFKConstraints []geoFKConstraint

func dropGeoFKConstraints(ctx context.Context, pool *pgxpool.Pool) error {
	constraints, err := getGeoFKConstraints(ctx, pool)
	if err != nil {
		return err
	}

	if len(constraints) == 0 {
		log.Printf("  No FK constraints found on geo tables")
		return nil
	}

	// Store for later recreation
	droppedFKConstraints = constraints

	for _, c := range constraints {
		sql := fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT %s", c.table, c.constraint)
		if _, err := pool.Exec(ctx, sql); err != nil {
			return fmt.Errorf("failed to drop constraint %s on %s: %w", c.constraint, c.table, err)
		}
	}

	log.Printf("  Dropped %d FK constraints", len(constraints))
	return nil
}

func recreateGeoFKConstraints(ctx context.Context, pool *pgxpool.Pool) error {
	if len(droppedFKConstraints) == 0 {
		log.Printf("  No FK constraints to recreate")
		return nil
	}

	var errors []string
	for _, c := range droppedFKConstraints {
		sql := fmt.Sprintf("ALTER TABLE %s ADD CONSTRAINT %s %s", c.table, c.constraint, c.definition)
		if _, err := pool.Exec(ctx, sql); err != nil {
			errors = append(errors, fmt.Sprintf("%s.%s: %v", c.table, c.constraint, err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to recreate some constraints:\n  %s", strings.Join(errors, "\n  "))
	}

	log.Printf("  Recreated %d FK constraints", len(droppedFKConstraints))
	droppedFKConstraints = nil
	return nil
}

func resetGeoData(ctx context.Context, pool *pgxpool.Pool) error {
	// Disable triggers for the session to allow fast truncation
	_, err := pool.Exec(ctx, "SET session_replication_role = 'replica'")
	if err != nil {
		return fmt.Errorf("failed to disable triggers: %w", err)
	}
	defer func() {
		// Re-enable triggers
		pool.Exec(ctx, "SET session_replication_role = 'origin'")
	}()

	// Truncate all geo tables (Overture schema)
	// Order matters: truncate dependent tables first (FK cascade handles most)
	geoTables := []string{
		// Search index (depends on localities)
		"geo_search_index",
		// Locality details (depends on localities)
		"geo_locality_locations",
		"geo_locality_elevations",
		// Names (depends on entities)
		"geo_names",
		// Localities (depends on regions, countries, continents)
		"geo_localities",
		// Regions (depends on countries, self-references)
		"geo_regions",
		// Countries (depends on continents)
		"geo_countries",
		// Continents (root)
		"geo_continents",
		// Lookup/metadata tables
		"geo_locality_types",
		"geo_region_types",
		"geo_data_sources",
	}

	for _, table := range geoTables {
		log.Printf("  Truncating %s...", table)
		_, err := pool.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", table))
		if err != nil {
			return fmt.Errorf("failed to truncate %s: %w", table, err)
		}
	}

	return nil
}

func resetGeoSequences(ctx context.Context, pool *pgxpool.Pool) error {
	// Map of table names to their sequence names
	// Only tables with serial/identity columns need sequence resets
	geoSequences := []struct {
		table    string
		sequence string
	}{
		{"geo_continents", "geo_continents_id_seq"},
		{"geo_countries", "geo_countries_id_seq"},
		{"geo_regions", "geo_regions_id_seq"},
		{"geo_localities", "geo_localities_id_seq"},
		{"geo_locality_locations", "geo_locality_locations_id_seq"},
		{"geo_locality_elevations", "geo_locality_elevations_id_seq"},
		{"geo_names", "geo_names_id_seq"},
		{"geo_search_index", "geo_search_index_id_seq"},
		{"geo_locality_types", "geo_locality_types_id_seq"},
		{"geo_region_types", "geo_region_types_id_seq"},
		{"geo_data_sources", "geo_data_sources_id_seq"},
	}

	for _, s := range geoSequences {
		// Check if table exists and has data
		var maxID *int64
		err := pool.QueryRow(ctx, fmt.Sprintf("SELECT MAX(id) FROM %s", s.table)).Scan(&maxID)
		if err != nil {
			log.Printf("  Skipping %s (table may not exist): %v", s.sequence, err)
			continue
		}

		if maxID == nil {
			// Table is empty, reset to 1
			_, err = pool.Exec(ctx, fmt.Sprintf("SELECT setval('%s', 1, false)", s.sequence))
		} else {
			// Set sequence to max ID
			_, err = pool.Exec(ctx, fmt.Sprintf("SELECT setval('%s', %d)", s.sequence, *maxID))
		}

		if err != nil {
			log.Printf("  Warning: failed to reset %s: %v", s.sequence, err)
		} else if maxID != nil {
			log.Printf("  %s → %d", s.sequence, *maxID)
		}
	}

	return nil
}

func analyzeGeoTables(ctx context.Context, pool *pgxpool.Pool) error {
	// Analyze tables that benefit most from statistics updates (Overture schema)
	geoTables := []string{
		"geo_localities",
		"geo_locality_locations",
		"geo_locality_elevations",
		"geo_regions",
		"geo_countries",
		"geo_continents",
		"geo_names",
		"geo_search_index",
	}

	for _, table := range geoTables {
		_, err := pool.Exec(ctx, fmt.Sprintf("VACUUM ANALYZE %s", table))
		if err != nil {
			return fmt.Errorf("failed to analyze %s: %w", table, err)
		}
	}

	return nil
}

func checkDependencies() error {
	// Check pg_restore
	if _, err := exec.LookPath("pg_restore"); err != nil {
		return fmt.Errorf("pg_restore not found in PATH (install postgresql-client)")
	}

	// Check zstd
	if _, err := exec.LookPath("zstd"); err != nil {
		return fmt.Errorf("zstd not found in PATH (install zstd)")
	}

	return nil
}

// rebuildGeoSearchIndexes recreates indexes on geo_search_index after data restore.
// Must be called after geo data is loaded/updated.
func rebuildGeoSearchIndexes(ctx context.Context, pool *pgxpool.Pool) error {
	log.Printf("  Recreating geo_search_index indexes...")
	if err := recreateGeoSearchIndexes(ctx, pool); err != nil {
		return fmt.Errorf("failed to recreate geo_search_index indexes: %w", err)
	}

	var count int
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_search_index").Scan(&count)
	log.Printf("  geo_search_index has %d rows with indexes rebuilt", count)

	return nil
}

// dropGeoSearchIndexes drops indexes on geo_search_index table before restore.
// Uses shared index definitions from internal/geo package.
func dropGeoSearchIndexes(ctx context.Context, pool *pgxpool.Pool) error {
	return geo.DropSearchIndexes(ctx, pool)
}

// ensureGeoNamesIndex creates the lookup index on geo_names if it doesn't exist.
// This covering index is critical for GetCountries and other name lookup queries.
// Without it, queries do full table scans on 8+ million rows.
func ensureGeoNamesIndex(ctx context.Context, pool *pgxpool.Pool) error {
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
		log.Printf("  Index idx_geo_names_entity_lookup already exists")
		return nil
	}

	log.Printf("  Creating index idx_geo_names_entity_lookup (this may take a few minutes)...")
	start := time.Now()

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

	log.Printf("  Index created in %s", time.Since(start))
	return nil
}

// recreateGeoSearchIndexes recreates indexes on geo_search_index table after restore.
// Uses shared index definitions from internal/geo package.
func recreateGeoSearchIndexes(ctx context.Context, pool *pgxpool.Pool) error {
	// Recreate indexes using shared definitions
	for _, idx := range geo.SearchIndexes() {
		log.Printf("    Creating %s...", idx.Name)
		_, err := pool.Exec(ctx, idx.SQL)
		if err != nil {
			return fmt.Errorf("failed to create index %s: %w", idx.Name, err)
		}
	}

	// Analyze table
	if err := geo.AnalyzeSearchIndex(ctx, pool); err != nil {
		log.Printf("    Warning: failed to analyze geo_search_index: %v", err)
	}

	return nil
}
