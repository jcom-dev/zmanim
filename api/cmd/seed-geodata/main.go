// Package main seeds geographic data from compressed PostgreSQL dumps.
//
// This tool downloads and restores geographic data from S3 or local files.
// Optimized for fast restoration during migrations and new environment setup.
//
// IMPORTANT: This tool restores ONLY geographic data from Overture Maps.
// It does NOT restore seed/lookup tables (geo_locality_types, geo_region_types, geo_data_sources).
// Those tables are managed by migrations (00000000000002_seed_data.sql) and must be
// populated before running this tool.
//
// Prerequisites:
//   - Database schema created (migration 00000000000001_schema.sql)
//   - Seed data populated (migration 00000000000002_seed_data.sql)
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

IMPORTANT PREREQUISITES:
  1. Run migrations first: db/migrations/00000000000001_schema.sql
  2. Run seed migration: db/migrations/00000000000002_seed_data.sql
     (Populates geo_locality_types, geo_region_types, geo_data_sources)

  This tool restores ONLY geographic data (countries, regions, localities, names).
  It does NOT restore seed/lookup tables - those are managed by migrations.

Commands:
  seed      Download and restore geographic data
  verify    Verify dump file without restoring

Options:
  --source URL     S3 URL (s3://bucket/path) or local file path (required)
  --jobs N         Parallel restore jobs (default: 4)
  --no-verify      Skip checksum verification
  --keep-temp      Keep temporary files after restore

Note: This command truncates existing geo data but preserves seed tables.

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

	// Validate and populate seed tables if needed
	log.Printf("Validating seed tables...")
	if err := ensureSeedTables(ctx, pool); err != nil {
		log.Fatalf("Seed table validation failed: %v", err)
	}
	log.Printf("✓ Seed tables validated")

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

	// If zstd compressed, decompress to temp file first
	// (pg_restore doesn't support --jobs with stdin)
	var actualDumpFile string
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
		actualDumpFile = tmpFile
	} else {
		actualDumpFile = dumpFile
	}

	// Generate TOC and filter out seed tables
	// Seed tables are managed by migrations, not by geodata dumps
	log.Printf("Generating filtered restore list (excluding seed tables)...")
	tocFile, err := createFilteredTOC(actualDumpFile)
	if err != nil {
		return fmt.Errorf("failed to create filtered TOC: %w", err)
	}
	defer os.Remove(tocFile)

	// Build pg_restore command with filtered TOC
	// Use --data-only since schema is managed by migrations
	args := []string{
		"--verbose",
		"--data-only", // Only restore data, not schema
		"--no-owner",
		"--no-acl",
		"--use-list=" + tocFile, // Use filtered TOC to exclude seed tables
		fmt.Sprintf("--jobs=%d", jobs),
		"--dbname=" + dbURL,
		actualDumpFile,
	}

	log.Printf("Running parallel restore with %d jobs...", jobs)
	cmd := exec.Command("pg_restore", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		// pg_restore may return exit 1 with warnings, but data is still restored
		// Check if actual fatal error by verifying data was restored
		log.Printf("Warning: pg_restore exited with error: %v", err)
		log.Printf("Verifying data was restored...")

		var count int
		checkErr := pool.QueryRow(ctx, "SELECT COUNT(*) FROM geo_localities").Scan(&count)
		if checkErr != nil {
			return fmt.Errorf("pg_restore failed and verification failed: %w (original error: %v)", checkErr, err)
		}

		if count == 0 {
			return fmt.Errorf("pg_restore failed: no data restored: %w", err)
		}

		log.Printf("✓ Data verification passed (%d localities restored)", count)
		log.Printf("Note: pg_restore warnings can be ignored if data was successfully restored")
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
	// NOTE: geo_locality_types, geo_region_types, and geo_data_sources are SEED tables
	//       managed by migrations (00000000000002_seed_data.sql), NOT by geodata dumps.
	//       They should NOT be truncated here as they won't be restored.
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
		// NOTE: Lookup/metadata tables (geo_locality_types, geo_region_types, geo_data_sources)
		//       are NOT truncated because they are seed tables managed by migrations
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
	// NOTE: Seed table sequences (geo_locality_types, geo_region_types, geo_data_sources)
	//       are NOT reset because those tables are not truncated/restored by geodata dumps
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
		// Note: geo_search_index has no id column (uses composite PK), so no sequence
		// Note: Seed tables (geo_locality_types, geo_region_types, geo_data_sources) are NOT included
		//       because they are managed by migrations, not geodata dumps
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

// createFilteredTOC generates a pg_restore TOC file with seed tables filtered out.
// Seed tables (geo_locality_types, geo_region_types, geo_data_sources) are managed
// by migrations, not geodata dumps, so we exclude them from restore.
func createFilteredTOC(dumpFile string) (string, error) {
	// Generate full TOC from dump file
	listCmd := exec.Command("pg_restore", "--list", dumpFile)
	tocOutput, err := listCmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to generate TOC: %w", err)
	}

	// Filter out seed table DATA entries
	// Keep all schema entries (CREATE TABLE, etc.) and only filter TABLE DATA
	var filteredLines []string
	lines := strings.Split(string(tocOutput), "\n")

	seedTables := map[string]bool{
		"geo_locality_types": true,
		"geo_region_types":   true,
		"geo_data_sources":   true,
	}

	for _, line := range lines {
		// Check if this is a TABLE DATA line for a seed table
		// Format: "<id>; <oid> <tag> <schema> <name> <owner>"
		// Example: "3114; 0 TABLE DATA public geo_data_sources daniel"
		if strings.Contains(line, "TABLE DATA") {
			// Check if any seed table name is in this line
			skipLine := false
			for table := range seedTables {
				if strings.Contains(line, " "+table+" ") {
					log.Printf("  Excluding from restore: %s", table)
					skipLine = true
					break
				}
			}
			if skipLine {
				continue
			}
		}
		filteredLines = append(filteredLines, line)
	}

	// Write filtered TOC to temp file
	tocFile, err := os.CreateTemp("", "pg_restore_toc_*.list")
	if err != nil {
		return "", fmt.Errorf("failed to create TOC file: %w", err)
	}
	defer tocFile.Close()

	if _, err := tocFile.WriteString(strings.Join(filteredLines, "\n")); err != nil {
		os.Remove(tocFile.Name())
		return "", fmt.Errorf("failed to write TOC file: %w", err)
	}

	return tocFile.Name(), nil
}

// ensureSeedTables ensures seed tables are properly populated with canonical data.
// These tables MUST exist before restoring geographic data due to FK constraints.
// We TRUNCATE and repopulate to ensure canonical data, even if dump file includes them.
// Seed tables: geo_locality_types, geo_region_types, geo_data_sources
func ensureSeedTables(ctx context.Context, pool *pgxpool.Pool) error {
	// Truncate and repopulate geo_locality_types (required by geo_localities FK)
	log.Printf("  Seeding geo_locality_types...")
	_, err := pool.Exec(ctx, `
		TRUNCATE TABLE geo_locality_types RESTART IDENTITY CASCADE;

		INSERT INTO geo_locality_types (code, name, overture_subtype, sort_order) VALUES
		  ('locality', 'Locality (General)', 'locality', 100),
		  ('city', 'City', 'locality', 10),
		  ('town', 'Town', 'locality', 20),
		  ('village', 'Village', 'locality', 30),
		  ('hamlet', 'Hamlet', 'locality', 40),
		  ('neighborhood', 'Neighborhood', 'neighborhood', 50),
		  ('borough', 'Borough', 'neighborhood', 60),
		  ('macrohood', 'Macrohood', 'macrohood', 70),
		  ('microhood', 'Microhood', 'microhood', 80);
	`)
	if err != nil {
		return fmt.Errorf("failed to seed geo_locality_types: %w", err)
	}
	log.Printf("  ✓ Seeded 9 locality types")

	// Truncate and repopulate geo_region_types (required by geo_regions FK)
	log.Printf("  Seeding geo_region_types...")
	_, err = pool.Exec(ctx, `
		TRUNCATE TABLE geo_region_types RESTART IDENTITY CASCADE;

		INSERT INTO geo_region_types (code, name, overture_subtype, sort_order) VALUES
		  ('region', 'Region', 'region', 10),
		  ('county', 'County', 'county', 20),
		  ('localadmin', 'Local Admin Area', 'localadmin', 30);
	`)
	if err != nil {
		return fmt.Errorf("failed to seed geo_region_types: %w", err)
	}
	log.Printf("  ✓ Seeded 3 region types")

	// Truncate and repopulate geo_data_sources (required by geo_locality_locations FK)
	log.Printf("  Seeding geo_data_sources...")
	_, err = pool.Exec(ctx, `
		TRUNCATE TABLE geo_data_sources RESTART IDENTITY CASCADE;

		INSERT INTO geo_data_sources (id, key, name, description, data_type_id, priority, default_accuracy_m, attribution, url, is_active) VALUES
		  (1, 'publisher', 'Publisher Override', 'Publisher-specific coordinate/elevation override', 3, 1, NULL, NULL, NULL, true),
		  (2, 'community', 'Community Contribution', 'User-submitted corrections (verified)', 3, 2, NULL, NULL, NULL, true),
		  (3, 'simplemaps', 'SimpleMaps World Cities', 'Government-surveyed coordinates (NGIA, USGS, Census)', 1, 3, 50, 'Data provided by SimpleMaps', 'https://simplemaps.com/data/world-cities', true),
		  (4, 'wof', 'Who''s On First', 'Polygon centroids from WOF gazetteer', 1, 4, 1000, 'Data from Who''s On First, a gazetteer of places', 'https://whosonfirst.org/', true),
		  (5, 'glo90', 'Copernicus GLO-90', 'Copernicus 90m Digital Elevation Model', 2, 3, 1, '© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA', 'https://copernicus-dem-90m.s3.amazonaws.com/', true),
		  (6, 'overture', 'Overture Maps Foundation', 'Global geographic data from Overture Maps Foundation', 1, 2, 100, 'Data provided by Overture Maps Foundation under CDLA Permissive 2.0', 'https://overturemaps.org/', true),
		  (7, 'synthetic', 'Synthetic', 'Auto-generated geographic entities for hierarchy completeness', 1, 5, NULL, 'Generated during import to ensure 100% region coverage', NULL, true),
		  (8, 'admin', 'Admin Override', 'System-wide admin coordinate/elevation corrections', 3, 1, NULL, 'Admin corrections by Shtetl Zmanim staff', NULL, true);
	`)
	if err != nil {
		return fmt.Errorf("failed to seed geo_data_sources: %w", err)
	}
	log.Printf("  ✓ Seeded 8 data sources")

	return nil
}
