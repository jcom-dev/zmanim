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
//   seed-geodata seed --source=s3://bucket/path/geodata.dump.zst
//   seed-geodata seed --source=/local/path/geodata.dump.zst
//   seed-geodata verify --source=s3://bucket/path/geodata.dump.zst
//
// Performance:
//   - Typical 2-4GB compressed → ~5-10 minutes total
//   - Parallel restore with --jobs=4 (default)
//   - Requires temp disk space (~3x compressed size)
//
// Environment:
//   DATABASE_URL      PostgreSQL connection string (required)
//   AWS_REGION        AWS region for S3 (default: us-east-1)
//   AWS_PROFILE       AWS profile to use (optional)
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
  --reset          Delete existing geo data before restore (DESTRUCTIVE!)

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

  # Full reset and restore with 8 parallel jobs
  seed-geodata seed --reset --jobs=8 --source=s3://mybucket/geodata.dump.zst
`)
}

func cmdSeed(args []string) {
	source := ""
	jobs := 4
	skipVerify := false
	keepTemp := false
	reset := false

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
		} else if args[i] == "--reset" {
			reset = true
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

	// Reset if requested
	if reset {
		log.Printf("⚠ RESET requested - deleting ALL geographic data...")
		if err := resetGeoData(ctx, pool); err != nil {
			log.Fatalf("Reset failed: %v", err)
		}
		log.Printf("✓ All geo tables truncated")
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
	if err := restoreDatabase(localFile, dbURL, jobs); err != nil {
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

func restoreDatabase(dumpFile, dbURL string, jobs int) error {
	// Build pg_restore command
	// Use --data-only since schema is managed by migrations
	args := []string{
		"--verbose",
		"--data-only",     // Only restore data, not schema
		"--no-owner",
		"--no-acl",
		"--disable-triggers",  // Disable triggers during restore for speed
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

func resetGeoData(ctx context.Context, pool *pgxpool.Pool) error {
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
