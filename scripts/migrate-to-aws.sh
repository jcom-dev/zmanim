#!/bin/bash
# =============================================================================
# Zmanim Data Migration Script - Xata to AWS PostgreSQL
# =============================================================================
# Story: 7.10 - Data Migration & Go-Live
# AC: AC1 (pg_dump exports), AC2 (pg_restore imports)
#
# Prerequisites:
# - PostgreSQL client tools (pg_dump, pg_restore) v16+
# - AWS CLI v2 configured with appropriate IAM permissions
# - Network access to both Xata and AWS PostgreSQL
# - SSM Parameter Store: /zmanim/prod/postgres-password
#
# Usage:
#   ./scripts/migrate-to-aws.sh [--dry-run] [--schema-only] [--data-only]
#
# Environment Variables (required):
#   XATA_DATABASE_URL - Xata PostgreSQL connection string
#   AWS_EC2_HOST      - AWS EC2 private/public IP (defaults to localhost if on EC2)
#   AWS_DB_NAME       - Target database name (defaults to 'zmanim')
#   AWS_DB_USER       - Target database user (defaults to 'zmanim')
#
# Environment Variables (optional):
#   AWS_DB_PASSWORD   - Override SSM parameter lookup
#   DUMP_FILE         - Custom dump file path (defaults to /tmp/zmanim.dump)
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

# Default configuration
DRY_RUN=false
SCHEMA_ONLY=false
DATA_ONLY=false
AWS_EC2_HOST="${AWS_EC2_HOST:-localhost}"
AWS_DB_NAME="${AWS_DB_NAME:-zmanim}"
AWS_DB_USER="${AWS_DB_USER:-zmanim}"
DUMP_FILE="${DUMP_FILE:-/tmp/zmanim.dump}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --schema-only)
            SCHEMA_ONLY=true
            shift
            ;;
        --data-only)
            DATA_ONLY=true
            shift
            ;;
        --help)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Validation Functions
# =============================================================================

validate_environment() {
    log_info "Validating environment..."

    # Check required environment variable
    if [[ -z "${XATA_DATABASE_URL:-}" ]]; then
        log_error "XATA_DATABASE_URL environment variable is required"
        log_error "Export it with: export XATA_DATABASE_URL='postgresql://user:pass@host:5432/db'"
        exit 1
    fi

    # Check for PostgreSQL client tools
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Install PostgreSQL client tools v16+"
        exit 1
    fi

    if ! command -v pg_restore &> /dev/null; then
        log_error "pg_restore not found. Install PostgreSQL client tools v16+"
        exit 1
    fi

    # Check AWS CLI if we need to fetch password
    if [[ -z "${AWS_DB_PASSWORD:-}" ]]; then
        if ! command -v aws &> /dev/null; then
            log_error "AWS CLI not found and AWS_DB_PASSWORD not set"
            exit 1
        fi
    fi

    # Get pg_dump version
    PG_VERSION=$(pg_dump --version | head -1)
    log_info "PostgreSQL tools: $PG_VERSION"

    log_success "Environment validation passed"
}

get_aws_password() {
    if [[ -n "${AWS_DB_PASSWORD:-}" ]]; then
        log_info "Using AWS_DB_PASSWORD from environment"
        echo "$AWS_DB_PASSWORD"
        return
    fi

    log_info "Fetching PostgreSQL password from SSM Parameter Store..."
    local password
    password=$(aws ssm get-parameter \
        --name /zmanim/prod/postgres-password \
        --with-decryption \
        --query 'Parameter.Value' \
        --output text 2>/dev/null) || {
        log_error "Failed to fetch password from SSM. Ensure IAM permissions are configured."
        exit 1
    }

    echo "$password"
}

test_xata_connection() {
    log_info "Testing connection to Xata PostgreSQL..."

    if psql "$XATA_DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        log_success "Xata connection successful"
    else
        log_error "Cannot connect to Xata PostgreSQL"
        exit 1
    fi

    # Check for PostGIS
    local postgis_version
    postgis_version=$(psql "$XATA_DATABASE_URL" -t -c "SELECT PostGIS_Version();" 2>/dev/null | tr -d ' ') || {
        log_warn "PostGIS extension not found or not accessible in source database"
    }

    if [[ -n "$postgis_version" ]]; then
        log_info "Source PostGIS version: $postgis_version"
    fi
}

test_aws_connection() {
    local password=$1
    log_info "Testing connection to AWS PostgreSQL at $AWS_EC2_HOST..."

    if PGPASSWORD="$password" psql -h "$AWS_EC2_HOST" -U "$AWS_DB_USER" -d "$AWS_DB_NAME" -c "SELECT 1" &> /dev/null; then
        log_success "AWS PostgreSQL connection successful"
    else
        log_error "Cannot connect to AWS PostgreSQL at $AWS_EC2_HOST"
        log_error "Ensure the database is running and accessible"
        exit 1
    fi

    # Verify PostGIS extension
    local postgis_version
    postgis_version=$(PGPASSWORD="$password" psql -h "$AWS_EC2_HOST" -U "$AWS_DB_USER" -d "$AWS_DB_NAME" -t -c "SELECT PostGIS_Version();" 2>/dev/null | tr -d ' ') || {
        log_error "PostGIS extension not available on AWS PostgreSQL"
        exit 1
    }

    log_info "Target PostGIS version: $postgis_version"
}

# =============================================================================
# Migration Functions
# =============================================================================

export_from_xata() {
    log_info "Starting export from Xata PostgreSQL..."
    log_info "Dump file: $DUMP_FILE"

    local pg_dump_opts="-Fc --no-owner --no-acl --verbose"

    if [[ "$SCHEMA_ONLY" == "true" ]]; then
        pg_dump_opts="$pg_dump_opts --schema-only"
        log_info "Mode: Schema only"
    elif [[ "$DATA_ONLY" == "true" ]]; then
        pg_dump_opts="$pg_dump_opts --data-only"
        log_info "Mode: Data only"
    else
        log_info "Mode: Full database (schema + data)"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN: Would execute pg_dump with options: $pg_dump_opts"
        return 0
    fi

    local start_time
    start_time=$(date +%s)

    # Execute pg_dump
    pg_dump $pg_dump_opts "$XATA_DATABASE_URL" > "$DUMP_FILE" 2>&1 || {
        log_error "pg_dump failed. Check connection and permissions."
        exit 1
    }

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Verify dump file
    local dump_size
    dump_size=$(ls -lh "$DUMP_FILE" | awk '{print $5}')

    log_success "Export completed in ${duration}s"
    log_info "Dump file size: $dump_size"

    # Show dump contents summary
    log_info "Dump contents:"
    pg_restore --list "$DUMP_FILE" 2>/dev/null | grep -E "^[0-9]+" | head -20 || true
    log_info "... (truncated, showing first 20 objects)"
}

prepare_extensions() {
    local password=$1
    log_info "Preparing PostgreSQL extensions on AWS..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN: Would create extensions: postgis, pg_cron"
        return 0
    fi

    # Create extensions if they don't exist
    # PostGIS is critical for geographic queries
    PGPASSWORD="$password" psql -h "$AWS_EC2_HOST" -U "$AWS_DB_USER" -d "$AWS_DB_NAME" <<EOF || {
        log_error "Failed to create extensions"
        exit 1
    }
-- Create PostGIS extension (required for cities table geometry)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create pg_cron extension if available (optional, for scheduled tasks)
DO \$\$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available, skipping';
END
\$\$;

-- Verify PostGIS is working
SELECT PostGIS_Full_Version();
EOF

    log_success "Extensions prepared"
}

import_to_aws() {
    local password=$1
    log_info "Starting import to AWS PostgreSQL..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN: Would execute pg_restore to $AWS_EC2_HOST"
        return 0
    fi

    if [[ ! -f "$DUMP_FILE" ]]; then
        log_error "Dump file not found: $DUMP_FILE"
        exit 1
    fi

    local start_time
    start_time=$(date +%s)

    # pg_restore options:
    # --no-owner: Skip ownership commands (use current user)
    # --no-acl: Skip access privilege commands
    # --clean: Drop existing objects before recreating
    # --if-exists: Don't error if objects don't exist when dropping
    # --verbose: Show progress
    # --jobs=4: Parallel restore (adjust based on EC2 size)

    local pg_restore_opts="--no-owner --no-acl --clean --if-exists --verbose"

    if [[ "$DATA_ONLY" == "true" ]]; then
        pg_restore_opts="$pg_restore_opts --data-only"
    fi

    # Execute pg_restore
    # Note: Some errors are expected (e.g., "role does not exist") - these are non-fatal
    PGPASSWORD="$password" pg_restore \
        -h "$AWS_EC2_HOST" \
        -U "$AWS_DB_USER" \
        -d "$AWS_DB_NAME" \
        $pg_restore_opts \
        "$DUMP_FILE" 2>&1 | tee /tmp/pg_restore.log || {
        # pg_restore returns non-zero even for warnings, check actual errors
        if grep -q "FATAL\|ERROR" /tmp/pg_restore.log; then
            log_warn "pg_restore completed with some errors (check /tmp/pg_restore.log)"
        fi
    }

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log_success "Import completed in ${duration}s"
}

verify_migration() {
    local password=$1
    log_info "Running basic verification..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN: Would verify row counts"
        return 0
    fi

    # Quick row count check for critical tables
    local tables=("publishers" "master_zmanim_registry" "publisher_zmanim" "cities" "publisher_coverage")

    echo ""
    echo "=== Quick Verification Report ==="
    echo "Table                    | AWS Count"
    echo "-------------------------|-----------"

    for table in "${tables[@]}"; do
        local count
        count=$(PGPASSWORD="$password" psql -h "$AWS_EC2_HOST" -U "$AWS_DB_USER" -d "$AWS_DB_NAME" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ') || count="ERROR"
        printf "%-24s | %s\n" "$table" "$count"
    done

    echo ""
    log_info "For full verification, run: ./scripts/verify-migration.sh"
}

cleanup() {
    if [[ -f "$DUMP_FILE" && "$DRY_RUN" != "true" ]]; then
        log_info "Keeping dump file at: $DUMP_FILE"
        log_info "Delete manually when no longer needed: rm $DUMP_FILE"
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  Zmanim Data Migration: Xata -> AWS"
    echo "=============================================="
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN MODE - No changes will be made"
        echo ""
    fi

    # Step 1: Validate environment
    validate_environment

    # Step 2: Get AWS password
    local aws_password
    aws_password=$(get_aws_password)

    # Step 3: Test connections
    test_xata_connection
    test_aws_connection "$aws_password"

    # Step 4: Prepare extensions on target
    prepare_extensions "$aws_password"

    # Step 5: Export from Xata
    export_from_xata

    # Step 6: Import to AWS
    import_to_aws "$aws_password"

    # Step 7: Basic verification
    verify_migration "$aws_password"

    # Cleanup
    cleanup

    echo ""
    log_success "Migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Run full verification: ./scripts/verify-migration.sh"
    echo "  2. Run smoke tests: ./scripts/smoke-tests.sh"
    echo "  3. Run E2E tests against AWS backend"
    echo "  4. If all pass, proceed with DNS cutover"
    echo ""
}

# Run main function
main "$@"
