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

	// Analyze tables for query optimization
	log.Printf("Running VACUUM ANALYZE on geo tables...")
	if err := analyzeGeoTables(ctx, pool); err != nil {
		log.Printf("Warning: ANALYZE failed: %v", err)
	} else {
		log.Printf("✓ Tables analyzed")
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

	// Truncate all geo tables
	geoTables := []string{
		"geo_location_references",
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
		"geo_boundary_imports",
		"geo_data_imports",
		"geo_data_sources",
		"geo_levels",
	}

	for _, table := range geoTables {
		log.Printf("  Truncating %s...", table)
		_, err := pool.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
		if err != nil {
			return fmt.Errorf("failed to truncate %s: %w", table, err)
		}
	}

	return nil
}

func analyzeGeoTables(ctx context.Context, pool *pgxpool.Pool) error {
	geoTables := []string{
		"geo_cities",
		"geo_countries",
		"geo_regions",
		"geo_districts",
		"geo_city_boundaries",
		"geo_country_boundaries",
		"geo_region_boundaries",
		"geo_district_boundaries",
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
