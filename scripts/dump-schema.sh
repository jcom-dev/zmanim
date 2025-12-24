#!/bin/bash
# dump-schema.sh - Generate a new schema migration file from the current database
#
# Usage: DATABASE_URL=postgresql://... ./scripts/dump-schema.sh
#
# This script dumps the current database schema and creates a clean migration file
# suitable for use with psql in CI environments.

set -euo pipefail

# Check for required DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL environment variable is required"
    echo ""
    echo "Usage: DATABASE_URL=postgresql://user:pass@host:port/db ./scripts/dump-schema.sh"
    echo ""
    echo "Or source your .env file first:"
    echo "  source api/.env && ./scripts/dump-schema.sh"
    exit 1
fi

# Output file
MIGRATION_FILE="db/migrations/00000000000001_schema.sql"
TEMP_FILE=$(mktemp)

echo "Dumping schema from database..."

# Extract connection details from DATABASE_URL
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

# Dump schema using pg_dump
PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    > "$TEMP_FILE" 2>&1

if [[ $? -ne 0 ]]; then
    echo "Error: pg_dump failed"
    cat "$TEMP_FILE"
    rm -f "$TEMP_FILE"
    exit 1
fi

echo "Cleaning up schema dump..."

# Create the final migration file
cat > "$MIGRATION_FILE" << 'EOF'
-- Migration: Initial Schema
-- Generated from database dump on DATE_PLACEHOLDER
-- This migration creates the complete database schema for the Zmanim application
-- Do not make changes to this file after initial creation - create new migration files instead

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

EOF

# Replace date placeholder
sed -i "s/DATE_PLACEHOLDER/$(date +%Y-%m-%d)/" "$MIGRATION_FILE"

# Clean and append the schema dump
# First pass: remove schema_migrations table block entirely (comment + CREATE TABLE ... );)
TEMP_FILE2=$(mktemp)
cat "$TEMP_FILE" | \
    grep -v "^\\\\restrict" | \
    grep -v "^\\\\unrestrict" | \
    grep -v "^-- Dumped" | \
    grep -v "^-- PostgreSQL database dump" | \
    sed '/^--$/d' | \
    sed '/^CREATE SCHEMA test_migrations;$/d' | \
    sed '/^CREATE SCHEMA test_zmanim;$/d' | \
    sed '/^CREATE SCHEMA tiger;$/d' | \
    sed '/^CREATE SCHEMA tiger_data;$/d' | \
    sed '/^CREATE SCHEMA topology;$/d' | \
    sed '/^COMMENT ON SCHEMA topology/d' | \
    sed '/PostGIS Topology schema/d' | \
    sed '/^CREATE EXTENSION/d' | \
    sed '/^COMMENT ON EXTENSION/d' | \
    sed '/^CREATE SCHEMA public;$/d' | \
    grep -v "^-- Name: SCHEMA public" | \
    grep -v "^-- Name: public; Type: SCHEMA" | \
    grep -v "COMMENT ON SCHEMA public" \
    > "$TEMP_FILE2"

# Remove schema_migrations table and its related objects (multi-line blocks)
sed -i '/-- Name: schema_migrations/,/^);$/d' "$TEMP_FILE2"

cat "$TEMP_FILE2" >> "$MIGRATION_FILE"
rm -f "$TEMP_FILE2"

# Clean up temp file
rm -f "$TEMP_FILE"

# Get line count
LINES=$(wc -l < "$MIGRATION_FILE")

echo ""
echo "Schema migration generated successfully!"
echo "  File: $MIGRATION_FILE"
echo "  Lines: $LINES"
echo ""
echo "Next steps:"
echo "  1. Review the generated file"
echo "  2. Run 'cd api && sqlc generate' to verify"
echo "  3. Run 'cd api && go build ./...' to compile"
