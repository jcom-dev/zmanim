#!/bin/bash
set -euo pipefail

# Download latest API binary from S3 and run migrations before starting the service
# This allows code updates and migrations without rebuilding the AMI

BINARY_PATH="/opt/zmanim/zmanim-api"
S3_BUCKET="${S3_RELEASES_BUCKET:-zmanim-releases-prod}"
S3_KEY="${S3_BINARY_KEY:-releases/latest/zmanim-api}"
TEMP_BINARY="/tmp/zmanim-api.new"
REPO_DIR="/opt/zmanim/repo"
REPO_URL="https://github.com/jcom-dev/zmanim.git"

# ============================================
# Step 1: Download latest API binary from S3
# ============================================
echo "Checking for latest API binary in S3..."

if aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${TEMP_BINARY}" 2>/dev/null; then
    echo "Downloaded latest binary from s3://${S3_BUCKET}/${S3_KEY}"

    # Verify it's executable
    chmod +x "${TEMP_BINARY}"

    # Replace current binary
    mv "${TEMP_BINARY}" "${BINARY_PATH}"
    chown zmanim:zmanim "${BINARY_PATH}"

    echo "API binary updated successfully"
else
    echo "No binary found in S3, using AMI version"

    # Verify AMI binary exists and is executable
    if [ ! -f "${BINARY_PATH}" ]; then
        echo "ERROR: No API binary found in AMI or S3"
        exit 1
    fi

    chmod +x "${BINARY_PATH}"
    echo "Using AMI binary version"
fi

# Display binary info
ls -lh "${BINARY_PATH}"

# ============================================
# Step 2: Clone or pull latest repo for migrations
# ============================================
echo ""
echo "Updating repository for migrations..."

# Fix git safe.directory for systemd service context (no $HOME set)
export HOME=/root
git config --global --add safe.directory "${REPO_DIR}" 2>/dev/null || true

if [ -d "${REPO_DIR}/.git" ]; then
    echo "Pulling latest changes..."
    cd "${REPO_DIR}"
    git fetch origin main --depth=1
    git reset --hard origin/main
else
    echo "Cloning repository..."
    rm -rf "${REPO_DIR}"
    git clone --depth=1 --branch main "${REPO_URL}" "${REPO_DIR}"
fi

chown -R zmanim:zmanim "${REPO_DIR}"
echo "Repository updated"

# ============================================
# Step 3: Run database migrations
# ============================================
echo ""
echo "Running database migrations..."

MIGRATIONS_DIR="${REPO_DIR}/db/migrations"

if [ ! -d "${MIGRATIONS_DIR}" ]; then
    echo "No migrations directory found, skipping"
    exit 0
fi

# Source config.env to get DATABASE_URL
if [ -f /opt/zmanim/config.env ]; then
    set -a
    source /opt/zmanim/config.env
    set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL not set"
    exit 1
fi

# Parse DATABASE_URL for psql
# Format: postgresql://user:password@host:port/database?sslmode=disable
DB_URL_CLEAN="${DATABASE_URL%%\?*}"  # Remove query string
if [[ $DB_URL_CLEAN =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "ERROR: Could not parse DATABASE_URL"
    exit 1
fi

# Create schema_migrations table if it doesn't exist
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" 2>/dev/null || true

# Get list of applied migrations
APPLIED=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c \
    "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || echo "")

# Apply pending migrations
MIGRATION_COUNT=0
for migration in $(ls -1 ${MIGRATIONS_DIR}/*.sql 2>/dev/null | sort); do
    MIGRATION_NAME=$(basename "$migration")

    # Check if already applied
    if echo "$APPLIED" | grep -q "$MIGRATION_NAME"; then
        echo "  [SKIP] $MIGRATION_NAME (already applied)"
        continue
    fi

    echo "  [APPLY] $MIGRATION_NAME"

    # Apply migration
    if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration" 2>&1; then
        # Record migration as applied
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \
            "INSERT INTO schema_migrations (version) VALUES ('$MIGRATION_NAME') ON CONFLICT DO NOTHING;" 2>/dev/null
        echo "    Done"
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    else
        echo "    ERROR: Migration $MIGRATION_NAME failed"
        exit 1
    fi
done

if [ $MIGRATION_COUNT -eq 0 ]; then
    echo "No new migrations to apply"
else
    echo "Applied $MIGRATION_COUNT migration(s)"
fi

echo ""
echo "Startup preparation complete"
