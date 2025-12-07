#!/bin/bash
# Database migration script
# Runs PostgreSQL migrations from db/migrations directory

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )


# Check if we're in Coder environment
if [[ -d "/home/coder" ]] && [[ -f "$SCRIPT_DIR/../api/.env" ]]; then
    echo "Running database migrations..."


    # Use DATABASE_URL from environment, or fall back to .env file
    if [[ -z "$DATABASE_URL" ]]; then
        source $SCRIPT_DIR/../api/.env
    fi

    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    if [[ -z "$DATABASE_URL" ]]; then
        echo "Error: DATABASE_URL not set in environment or api/.env"
        exit 1
    fi

    # Extract components using regex
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        export DB_USER="${BASH_REMATCH[1]}"
        export DB_PASS="${BASH_REMATCH[2]}"
        export DB_HOST="${BASH_REMATCH[3]}"
        export DB_PORT="${BASH_REMATCH[4]}"
        export DB_NAME="${BASH_REMATCH[5]}"
    else
        echo "Error: Could not parse DATABASE_URL"
        exit 1
    fi

    MIGRATIONS_DIR="$SCRIPT_DIR/../db/migrations"

    # Create schema_migrations table if it doesn't exist
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" 2>/dev/null || true

    # Get list of applied migrations
    echo "Checking for applied migrations..."
    APPLIED=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
        "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || echo "")

    # Apply pending migrations
    echo "Looking for migrations in $MIGRATIONS_DIR..."

    for migration in $(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | sort); do
        MIGRATION_NAME=$(basename "$migration")

        # Check if already applied
        if echo "$APPLIED" | grep -q "$MIGRATION_NAME"; then
            echo "  [SKIP] $MIGRATION_NAME (already applied)"
            continue
        fi

        echo "  [APPLY] $MIGRATION_NAME"

        # Apply migration (continue on errors for idempotent migrations)
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration" 2>&1 || true

        # Record migration as applied
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
            "INSERT INTO schema_migrations (version) VALUES ('$MIGRATION_NAME') ON CONFLICT DO NOTHING;" 2>/dev/null
        echo "    Done"
    done

    echo ""
    echo "Migration complete!"
    echo ""
    echo "NOTE: To seed geographic data (cities, countries, regions), run:"
    echo "  cd api && DATABASE_URL=\$DATABASE_URL go run ./cmd/seed-geo/"

else
    echo "Error: Not in Coder environment"
    echo "Please run this script from the Coder workspace"
    exit 1
fi
