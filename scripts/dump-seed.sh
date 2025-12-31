#!/bin/bash
# dump-seed.sh - Generate seed data migration from current database
#
# WE ARE IN PRODUCTION - DO NOT USE THIS SCRIPT ANYMORE
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
  "geo_continents"
  "geo_data_sources"
  "geo_locality_types"
  "geo_region_types"

  # Help & Documentation Sources (types only, not indexed content)
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

    # Dump data with INSERT statements using column-inserts for better formatting
    # and --rows-per-insert=1 to ensure each row is a separate statement (prevents truncation)
    PGPASSWORD="$DB_PASS" pg_dump \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      --data-only \
      --column-inserts \
      --rows-per-insert=1 \
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

# Make INSERT statements idempotent by adding ON CONFLICT DO NOTHING
# This allows the seed to be re-run without errors on existing data
echo "Making INSERT statements idempotent..."
sed -i 's/);$/) ON CONFLICT DO NOTHING;/' "$MIGRATION_FILE"

# Fix sequence values - pg_dump doesn't always include setval statements when using --data-only
# This adds a SELECT setval() after each "SEQUENCE SET" comment to ensure sequences are properly reset
echo "Adding sequence reset statements..."
for table in "${SEED_TABLES[@]}"; do
  seq_name="${table}_id_seq"
  pattern="-- Name: ${seq_name}; Type: SEQUENCE SET"
  setval_stmt="SELECT setval('public.${seq_name}', (SELECT COALESCE(MAX(id), 1) FROM public.${table}));"

  # Check if this sequence exists and has a corresponding SEQUENCE SET comment
  if grep -qF -- "$pattern" "$MIGRATION_FILE"; then
    # Add setval statement after the SEQUENCE SET comment if not already present
    if ! grep -qF -- "SELECT setval('public.${seq_name}'" "$MIGRATION_FILE"; then
      # Use awk for reliable multi-line insertion
      awk -v pat="$pattern" -v stmt="$setval_stmt" '{print} $0 ~ pat {print "\n" stmt}' "$MIGRATION_FILE" > "${MIGRATION_FILE}.tmp"
      mv "${MIGRATION_FILE}.tmp" "$MIGRATION_FILE"
      echo "  Added setval for ${seq_name}"
    fi
  fi
done

# Validate that all INSERT statements are properly terminated
echo "Validating INSERT statement integrity..."
truncated_count=$(grep -c "^INSERT INTO" "$MIGRATION_FILE" || true)
terminated_count=$(grep -c "ON CONFLICT DO NOTHING;$" "$MIGRATION_FILE" || true)

if [ "$truncated_count" -ne "$terminated_count" ]; then
  echo ""
  echo "ERROR: Found truncated INSERT statements!"
  echo "  Total INSERT statements: $truncated_count"
  echo "  Properly terminated: $terminated_count"
  echo "  Missing termination: $((truncated_count - terminated_count))"
  echo ""
  echo "Lines with potential truncation:"
  grep -n "^INSERT INTO" "$MIGRATION_FILE" | while IFS=: read -r num rest; do
    line=$(sed -n "${num}p" "$MIGRATION_FILE")
    if [[ ! "$line" == *"ON CONFLICT DO NOTHING;" ]]; then
      echo "  Line $num: $(echo "$rest" | cut -c1-80)..."
    fi
  done
  echo ""
  echo "This usually indicates pg_dump output was truncated. Try running the script again."
  exit 1
fi
echo "  All $truncated_count INSERT statements are properly terminated."

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
