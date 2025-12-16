#!/bin/bash
# Production migration script for AWS EC2
# Reads credentials from SSM Parameter Store
# Usage: ./migrate-prod.sh [/path/to/migrations]
#
# This script is designed for production EC2 deployment.
# For local development, use scripts/migrate.sh instead.

set -e

MIGRATIONS_DIR="${1:-/data/migrations}"
SSM_PREFIX="/zmanim/prod"

echo "Production Migration Script"
echo "============================"
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Get database credentials from SSM Parameter Store
echo "Reading database credentials from SSM Parameter Store..."
DB_HOST="localhost"  # Local PostgreSQL on EC2
DB_PORT="5432"
DB_NAME="zmanim"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI not found. This script requires AWS CLI."
    exit 1
fi

# Get credentials from SSM
DB_USER=$(aws ssm get-parameter --name "${SSM_PREFIX}/postgres-user" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$DB_USER" ]; then
    echo "ERROR: Failed to retrieve postgres-user from SSM Parameter Store"
    exit 1
fi

DB_PASS=$(aws ssm get-parameter --name "${SSM_PREFIX}/postgres-password" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$DB_PASS" ]; then
    echo "ERROR: Failed to retrieve postgres-password from SSM Parameter Store"
    exit 1
fi

export PGPASSWORD="$DB_PASS"

echo "Successfully retrieved database credentials"
echo ""

# Create schema_migrations table if it doesn't exist
echo "Ensuring schema_migrations table exists..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" 2>&1

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create schema_migrations table"
    exit 1
fi

# Get list of applied migrations
echo "Checking for previously applied migrations..."
APPLIED=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT version FROM schema_migrations ORDER BY version;" 2>&1)

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to query schema_migrations table"
    exit 1
fi

echo ""

# Count migrations
APPLIED_COUNT=0
SKIPPED_COUNT=0
FAILED=0

# Apply pending migrations
echo "Processing migrations from $MIGRATIONS_DIR..."
echo ""

# Check if there are any migration files
MIGRATION_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
if [ -z "$MIGRATION_FILES" ]; then
    echo "No migration files found in $MIGRATIONS_DIR"
    echo ""
    echo "Migration complete: 0 applied, 0 skipped"
    exit 0
fi

for migration in $MIGRATION_FILES; do
    MIGRATION_NAME=$(basename "$migration")

    # Check if already applied
    if echo "$APPLIED" | grep -q "$MIGRATION_NAME"; then
        echo "[SKIP] $MIGRATION_NAME (already applied)"
        ((SKIPPED_COUNT++))
        continue
    fi

    echo "[APPLY] $MIGRATION_NAME"

    # Apply migration - FAIL on error (production safety)
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration" 2>&1

    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Migration failed: $MIGRATION_NAME"
        echo "Aborting deployment to prevent schema inconsistency"
        exit 1
    fi

    # Record migration as applied
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "INSERT INTO schema_migrations (version) VALUES ('$MIGRATION_NAME') ON CONFLICT DO NOTHING;" 2>&1

    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Failed to record migration in schema_migrations table: $MIGRATION_NAME"
        exit 1
    fi

    ((APPLIED_COUNT++))
    echo "    Success"
    echo ""
done

echo "============================"
echo "Migration complete: $APPLIED_COUNT applied, $SKIPPED_COUNT skipped"
echo ""

# Exit with success
exit 0
