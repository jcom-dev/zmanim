#!/bin/bash
# dump-seed.sh - Generate seed data migration from current database
#
# Usage: DATABASE_URL=postgresql://... ./scripts/dump-seed.sh
#
# This script dumps ONLY reference/lookup tables that contain static configuration data.
# It excludes:
# - Transactional data (actions, logs, user data, etc.)
# - Geography data (imported separately from external sources)
# - AI/RAG indexed content (generated dynamically)

set -euo pipefail

# Check for required DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL environment variable is required"
    echo ""
    echo "Usage: DATABASE_URL=postgresql://user:pass@host:port/db ./scripts/dump-seed.sh"
    echo ""
    echo "Or source your .env file first:"
    echo "  source api/.env && ./scripts/dump-seed.sh"
    exit 1
fi

# Output file
MIGRATION_FILE="db/migrations/00000000000002_seed_data.sql"

echo "Dumping seed data from database..."

# Core reference/lookup tables ONLY
# These contain static configuration data that should be seeded on fresh installs
SEED_TABLES=(
  # Algorithm & Calculation Configuration
  "algorithm_statuses"
  "algorithm_templates"
  "calculation_types"
  "edge_types"

  # Astronomical Primitives & Categories
  "astronomical_primitives"
  "primitive_categories"

  # Display & UI Configuration
  "display_groups"
  "time_categories"
  # Note: zman_display_contexts is DEPRECATED (empty, not used)

  # Tags & Mappings
  "tag_types"
  "zman_tags"

  # Master Zmanim Registry (canonical definitions)
  "master_zmanim_registry"
  "master_zman_tags"
  # Note: master_zman_day_types and master_zman_events are DEPRECATED (empty, tag-driven instead)

  # Publisher Configuration
  "publisher_statuses"
  "publisher_roles"

  # Request/Workflow Statuses
  "request_statuses"

  # Localization
  "languages"

  # Coverage/Geographic Levels (not geo data itself)
  "coverage_levels"
  "data_types"
  "geo_continents"
  "geo_data_sources"
  "geo_locality_types"
  "geo_region_types"

  # Help & Documentation Sources (types only, not indexed content)
  "explanation_sources"
)

# Create header
cat > "$MIGRATION_FILE" << 'HEADER'
-- Seed Data Migration
-- Generated from database dump on DATE_PLACEHOLDER
--
-- This migration populates core reference/lookup tables with initial configuration data.
--
-- EXCLUDED FROM THIS SEED:
-- - Geography data (geo_* tables) - imported separately via import scripts
-- - AI/RAG indexed content (ai_content_sources) - generated dynamically
-- - Transactional data (actions, logs, requests, etc.)
-- - User data (publishers, invitations, etc.)

HEADER

# Replace date placeholder
sed -i "s/DATE_PLACEHOLDER/$(date +%Y-%m-%d)/" "$MIGRATION_FILE"

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/dbname
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "Error: Could not parse DATABASE_URL"
    echo "Expected format: postgresql://user:password@host:port/dbname"
    exit 1
fi

# Track totals
total_tables=0
total_rows=0

# Dump each table
for table in "${SEED_TABLES[@]}"; do
  # Get row count
  row_count=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM public.$table;" 2>/dev/null | tr -d ' ')

  if [[ -z "$row_count" ]]; then
    echo "Warning: Table $table not found, skipping..."
    continue
  fi

  if [ "$row_count" -gt 0 ]; then
    echo "Dumping $table ($row_count rows)..."

    echo "" >> "$MIGRATION_FILE"
    echo "-- ============================================" >> "$MIGRATION_FILE"
    echo "-- $table ($row_count rows)" >> "$MIGRATION_FILE"
    echo "-- ============================================" >> "$MIGRATION_FILE"

    # Dump data with INSERT statements
    PGPASSWORD="$DB_PASS" pg_dump \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      --data-only \
      --inserts \
      --no-owner \
      --no-privileges \
      --table="public.$table" \
      >> "$MIGRATION_FILE" 2>&1

    total_tables=$((total_tables + 1))
    total_rows=$((total_rows + row_count))
  else
    echo "Skipping $table (0 rows)"
  fi
done

# Clean up problematic statements
echo "Cleaning up dump output..."
sed -i '/^SET /d' "$MIGRATION_FILE"
sed -i '/^SELECT pg_catalog/d' "$MIGRATION_FILE"
sed -i '/^--$/d' "$MIGRATION_FILE"
sed -i '/^-- Dumped/d' "$MIGRATION_FILE"
sed -i '/^-- PostgreSQL database dump/d' "$MIGRATION_FILE"
# Remove all psql backslash meta-commands that cause sqlc parsing issues
# This includes \restrict, \unrestrict, \connect, etc.
sed -i '/^\\[a-zA-Z]/d' "$MIGRATION_FILE"

# Get final stats
line_count=$(wc -l < "$MIGRATION_FILE")

echo ""
echo "=========================================="
echo "Seed data migration generated successfully!"
echo "=========================================="
echo "  File: $MIGRATION_FILE"
echo "  Tables: $total_tables"
echo "  Total rows: $total_rows"
echo "  Lines: $line_count"
echo ""
echo "SEED TABLES ($total_tables tables):"
printf '%s\n' "${SEED_TABLES[@]}" | sort | sed 's/^/  - /'
echo ""
echo "-- Do not make changes to this file after initial creation - create new migration files instead"
echo ""
echo "EXCLUDED (imported separately or generated dynamically):"
echo "  - geo_continents, geo_data_sources, geo_locality_types, geo_region_types"
echo "  - ai_content_sources, ai_index_statuses"
echo "  - All transactional/user data tables"
echo ""
echo "Next steps:"
echo "  1. Review the generated file"
echo "  2. Test on a fresh database"
echo "  3. Commit to version control"
echo ""
