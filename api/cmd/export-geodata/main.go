// Package main exports geographic data to a compressed PostgreSQL dump.
//
// This tool creates a portable, compressed backup of all geo_* tables
// for seeding new environments. The dump includes:
//   - All geo_* tables (cities, countries, regions, boundaries, etc.)
//   - PostGIS geometry data preserved in custom format
//   - Zstandard compression for optimal size/speed tradeoff
//
// Output format: PostgreSQL custom dump → zstd compression
//
// Usage:
//
//	export-geodata export --output=/tmp/geodata.dump.zst
//	export-geodata verify --file=/tmp/geodata.dump.zst
//
// Performance:
//   - Custom format preserves types and supports parallel restore
//   - Zstd provides 60-75% compression with fast decompression
//   - Typical 10GB → 2-4GB compressed
//
// Environment:
//
//	DATABASE_URL    PostgreSQL connection string (required)
package main

import (
	"crypto/sha256"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/dustin/go-humanize"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "export":
		cmdExport(os.Args[2:])
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
	fmt.Fprintf(os.Stderr, `Geographic Data Export Tool

Creates compressed PostgreSQL dumps of all geo_* tables for fast seeding.

Commands:
  export     Export all geo data to compressed dump
  verify     Verify dump file integrity (checksum + structure)

Options:
  --output FILE    Output file path (default: ./geodata-YYYYMMDD.dump.zst)
  --file FILE      File to verify
  --compression N  Zstd compression level 1-22 (default: 3, balanced speed/size)
  --no-compress    Skip zstd compression (pg_dump only)

Environment:
  DATABASE_URL    PostgreSQL connection string (required for export)

Examples:
  export-geodata export --output=/tmp/geodata.dump.zst
  export-geodata export --compression=9  # Higher compression
  export-geodata verify --file=/tmp/geodata.dump.zst

Output:
  - geodata-YYYYMMDD.dump.zst      Compressed dump (~2-4GB)
  - geodata-YYYYMMDD.dump.zst.sha256   Checksum file
`)
}

func cmdExport(args []string) {
	// Parse args
	output := ""
	compression := 3
	skipZstd := false

	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--output=") {
			output = strings.TrimPrefix(args[i], "--output=")
		} else if args[i] == "--output" && i+1 < len(args) {
			output = args[i+1]
			i++
		} else if strings.HasPrefix(args[i], "--compression=") {
			fmt.Sscanf(args[i], "--compression=%d", &compression)
		} else if args[i] == "--no-compress" {
			skipZstd = true
		}
	}

	// Default output filename with timestamp
	if output == "" {
		output = fmt.Sprintf("geodata-%s.dump", time.Now().Format("20060102"))
		if !skipZstd {
			output += ".zst"
		}
	}

	// Validate environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Check dependencies
	if err := checkDependencies(skipZstd); err != nil {
		log.Fatal(err)
	}

	log.Printf("Starting geographic data export...")
	log.Printf("Output file: %s", output)
	log.Printf("Compression: level %d (zstd)", compression)

	start := time.Now()

	// Create output file
	outFile, err := os.Create(output)
	if err != nil {
		log.Fatalf("Failed to create output file: %v", err)
	}
	defer outFile.Close()

	// Build pg_dump command
	// Custom format (-Fc) with compression level 9
	pgDumpArgs := []string{
		"--format=custom",
		"--compress=9",
		"--no-owner",
		"--no-acl",
		"--verbose",
		dbURL,
	}

	// Add all geo_* tables (Overture schema)
	geoTables := []string{
		// Core lookup tables
		"geo_data_sources",
		"geo_region_types",
		"geo_locality_types",
		// Geographic hierarchy (order matters for FK dependencies)
		"geo_continents",
		"geo_countries",
		"geo_regions",
		"geo_localities",
		// Locality details
		"geo_locality_locations",
		"geo_locality_elevations",
		// Names
		"geo_names",
		// Search index (derived but export for faster seeding)
		"geo_search_index",
	}

	for _, table := range geoTables {
		pgDumpArgs = append(pgDumpArgs, "--table="+table)
	}

	log.Printf("Dumping %d geo tables...", len(geoTables))

	// Execute pg_dump
	pgDump := exec.Command("pg_dump", pgDumpArgs...)
	pgDump.Env = os.Environ()

	var writer io.Writer = outFile

	// If zstd compression requested, pipe through zstd
	if !skipZstd {
		zstdArgs := []string{
			fmt.Sprintf("-%d", compression),
			"-", // Read from stdin
		}

		zstd := exec.Command("zstd", zstdArgs...)
		zstd.Stdin, err = pgDump.StdoutPipe()
		if err != nil {
			log.Fatalf("Failed to create pipe: %v", err)
		}
		zstd.Stdout = outFile
		zstd.Stderr = os.Stderr

		// Start zstd first
		if err := zstd.Start(); err != nil {
			log.Fatalf("Failed to start zstd: %v", err)
		}

		// Start pg_dump
		if err := pgDump.Start(); err != nil {
			log.Fatalf("Failed to start pg_dump: %v", err)
		}

		// Wait for both to complete
		if err := pgDump.Wait(); err != nil {
			log.Fatalf("pg_dump failed: %v", err)
		}

		if err := zstd.Wait(); err != nil {
			log.Fatalf("zstd compression failed: %v", err)
		}
	} else {
		pgDump.Stdout = writer
		pgDump.Stderr = os.Stderr

		if err := pgDump.Run(); err != nil {
			log.Fatalf("pg_dump failed: %v", err)
		}
	}

	// Get file size
	stat, err := os.Stat(output)
	if err != nil {
		log.Fatalf("Failed to stat output file: %v", err)
	}

	elapsed := time.Since(start)

	log.Printf("✓ Export complete!")
	log.Printf("  File: %s", output)
	log.Printf("  Size: %s", humanize.Bytes(uint64(stat.Size())))
	log.Printf("  Time: %s", elapsed.Round(time.Second))

	// Generate checksum
	log.Printf("Generating SHA256 checksum...")
	checksum, err := generateChecksum(output)
	if err != nil {
		log.Printf("Warning: Failed to generate checksum: %v", err)
	} else {
		checksumFile := output + ".sha256"
		if err := os.WriteFile(checksumFile, []byte(fmt.Sprintf("%s  %s\n", checksum, filepath.Base(output))), 0644); err != nil {
			log.Printf("Warning: Failed to write checksum file: %v", err)
		} else {
			log.Printf("✓ Checksum: %s", checksum)
			log.Printf("  Saved to: %s", checksumFile)
		}
	}

	log.Printf("\nReady to upload to S3!")
	log.Printf("Next steps:")
	log.Printf("  1. aws s3 cp %s s3://your-bucket/geo-seed/", output)
	log.Printf("  2. aws s3 cp %s.sha256 s3://your-bucket/geo-seed/", output)
}

func cmdVerify(args []string) {
	file := ""

	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--file=") {
			file = strings.TrimPrefix(args[i], "--file=")
		} else if args[i] == "--file" && i+1 < len(args) {
			file = args[i+1]
			i++
		}
	}

	if file == "" {
		log.Fatal("--file is required")
	}

	log.Printf("Verifying: %s", file)

	// Check file exists
	stat, err := os.Stat(file)
	if err != nil {
		log.Fatalf("File not found: %v", err)
	}

	log.Printf("Size: %s", humanize.Bytes(uint64(stat.Size())))

	// Verify checksum if available
	checksumFile := file + ".sha256"
	if _, err := os.Stat(checksumFile); err == nil {
		log.Printf("Verifying checksum...")
		expected, err := os.ReadFile(checksumFile)
		if err != nil {
			log.Fatalf("Failed to read checksum file: %v", err)
		}

		actual, err := generateChecksum(file)
		if err != nil {
			log.Fatalf("Failed to calculate checksum: %v", err)
		}

		expectedHash := strings.Fields(string(expected))[0]
		if expectedHash != actual {
			log.Fatalf("Checksum mismatch!\n  Expected: %s\n  Actual:   %s", expectedHash, actual)
		}

		log.Printf("✓ Checksum verified: %s", actual)
	} else {
		log.Printf("No checksum file found, skipping verification")
	}

	// Test decompression if zstd compressed
	if strings.HasSuffix(file, ".zst") {
		log.Printf("Testing decompression...")
		cmd := exec.Command("zstd", "-t", file)
		if err := cmd.Run(); err != nil {
			log.Fatalf("Decompression test failed: %v", err)
		}
		log.Printf("✓ Decompression test passed")
	}

	log.Printf("✓ Verification complete - file is valid")
}

func checkDependencies(skipZstd bool) error {
	// Check pg_dump
	if _, err := exec.LookPath("pg_dump"); err != nil {
		return fmt.Errorf("pg_dump not found in PATH (install postgresql-client)")
	}

	// Check zstd if needed
	if !skipZstd {
		if _, err := exec.LookPath("zstd"); err != nil {
			return fmt.Errorf("zstd not found in PATH (install zstd)")
		}
	}

	return nil
}

func generateChecksum(file string) (string, error) {
	f, err := os.Open(file)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
