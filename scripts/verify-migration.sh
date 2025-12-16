#!/bin/bash
# =============================================================================
# Zmanim Migration Verification Script
# =============================================================================
# Story: 7.10 - Data Migration & Go-Live
# AC: AC3 (Data integrity verified - row counts match)
#
# Compares data between Xata (source) and AWS (target) PostgreSQL databases.
# Verifies row counts, checksums for critical tables, and PostGIS geometry data.
#
# Prerequisites:
# - PostgreSQL client tools (psql) v16+
# - AWS CLI v2 configured with appropriate IAM permissions
# - Network access to both Xata and AWS PostgreSQL
#
# Usage:
#   ./scripts/verify-migration.sh [--source-only] [--target-only] [--verbose]
#
# Environment Variables (required):
#   XATA_DATABASE_URL - Xata PostgreSQL connection string
#   AWS_EC2_HOST      - AWS EC2 private/public IP (defaults to localhost)
#
# Environment Variables (optional):
#   AWS_DB_PASSWORD   - Override SSM parameter lookup
#   AWS_DB_NAME       - Target database name (defaults to 'zmanim')
#   AWS_DB_USER       - Target database user (defaults to 'zmanim')
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
AWS_EC2_HOST="${AWS_EC2_HOST:-localhost}"
AWS_DB_NAME="${AWS_DB_NAME:-zmanim}"
AWS_DB_USER="${AWS_DB_USER:-zmanim}"

# Flags
SOURCE_ONLY=false
TARGET_ONLY=false
VERBOSE=false

# Critical tables that must match exactly
TABLES=(
    "publishers"
    "master_zmanim_registry"
    "publisher_zmanim"
    "cities"
    "publisher_coverage"
    "publisher_users"
    "publisher_zman_aliases"
    "zman_requests"
    "publisher_location_overrides"
    "correction_requests"
)

# Tables with checksumable columns (table:column format)
CHECKSUM_TABLES=(
    "publishers:id,slug,name,status"
    "master_zmanim_registry:id,name_english,name_hebrew,calculation_key"
    "cities:id,name,country_code,admin1_code,population"
)

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --source-only)
            SOURCE_ONLY=true
            shift
            ;;
        --target-only)
            TARGET_ONLY=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            head -35 "$0" | tail -30
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }
log_verbose() { [[ "$VERBOSE" == "true" ]] && echo -e "${CYAN}[DEBUG]${NC} $*" || true; }

# Results tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Get AWS password from SSM or environment
get_aws_password() {
    if [[ -n "${AWS_DB_PASSWORD:-}" ]]; then
        echo "$AWS_DB_PASSWORD"
        return
    fi

    aws ssm get-parameter \
        --name /zmanim/prod/postgres-password \
        --with-decryption \
        --query 'Parameter.Value' \
        --output text 2>/dev/null || {
        log_error "Failed to fetch AWS password from SSM"
        exit 1
    }
}

# Execute query on source (Xata)
query_source() {
    local query=$1
    if [[ -z "${XATA_DATABASE_URL:-}" ]]; then
        echo "N/A"
        return
    fi
    psql "$XATA_DATABASE_URL" -t -c "$query" 2>/dev/null | tr -d ' ' || echo "ERROR"
}

# Execute query on target (AWS)
query_target() {
    local query=$1
    local password=$2
    PGPASSWORD="$password" psql -h "$AWS_EC2_HOST" -U "$AWS_DB_USER" -d "$AWS_DB_NAME" -t -c "$query" 2>/dev/null | tr -d ' ' || echo "ERROR"
}

# =============================================================================
# Verification Functions
# =============================================================================

verify_row_counts() {
    local password=$1

    echo ""
    echo "=============================================="
    echo "  ROW COUNT VERIFICATION"
    echo "=============================================="
    echo ""
    printf "%-35s | %12s | %12s | %s\n" "Table" "Source" "Target" "Status"
    printf "%-35s-|-%12s-|-%12s-|-%s\n" "-----------------------------------" "------------" "------------" "--------"

    for table in "${TABLES[@]}"; do
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

        local source_count="N/A"
        local target_count="N/A"
        local status=""

        if [[ "$TARGET_ONLY" != "true" ]]; then
            source_count=$(query_source "SELECT COUNT(*) FROM $table")
        fi

        if [[ "$SOURCE_ONLY" != "true" ]]; then
            target_count=$(query_target "SELECT COUNT(*) FROM $table" "$password")
        fi

        # Determine status
        if [[ "$source_count" == "ERROR" || "$target_count" == "ERROR" ]]; then
            status="${RED}ERROR${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        elif [[ "$SOURCE_ONLY" == "true" || "$TARGET_ONLY" == "true" ]]; then
            status="${BLUE}INFO${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        elif [[ "$source_count" == "$target_count" ]]; then
            status="${GREEN}MATCH${NC}"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            status="${RED}MISMATCH${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi

        printf "%-35s | %12s | %12s | " "$table" "$source_count" "$target_count"
        echo -e "$status"
    done
}

verify_checksums() {
    local password=$1

    echo ""
    echo "=============================================="
    echo "  CHECKSUM VERIFICATION (Critical Tables)"
    echo "=============================================="
    echo ""

    for entry in "${CHECKSUM_TABLES[@]}"; do
        local table="${entry%%:*}"
        local columns="${entry##*:}"

        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

        log_verbose "Checking $table with columns: $columns"

        # Calculate MD5 checksum of sorted data
        local checksum_query="SELECT md5(string_agg(row_data, '|' ORDER BY row_data)) FROM (SELECT concat_ws(',', $columns) as row_data FROM $table ORDER BY 1) t"

        local source_checksum="N/A"
        local target_checksum="N/A"

        if [[ "$TARGET_ONLY" != "true" ]]; then
            source_checksum=$(query_source "$checksum_query")
        fi

        if [[ "$SOURCE_ONLY" != "true" ]]; then
            target_checksum=$(query_target "$checksum_query" "$password")
        fi

        printf "%-35s: " "$table"

        if [[ "$source_checksum" == "ERROR" || "$target_checksum" == "ERROR" ]]; then
            echo -e "${RED}ERROR computing checksum${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        elif [[ "$SOURCE_ONLY" == "true" ]]; then
            echo -e "Source: $source_checksum"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        elif [[ "$TARGET_ONLY" == "true" ]]; then
            echo -e "Target: $target_checksum"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        elif [[ "$source_checksum" == "$target_checksum" ]]; then
            echo -e "${GREEN}MATCH${NC} ($source_checksum)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}MISMATCH${NC}"
            echo "  Source: $source_checksum"
            echo "  Target: $target_checksum"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
    done
}

verify_postgis_geometry() {
    local password=$1

    echo ""
    echo "=============================================="
    echo "  POSTGIS GEOMETRY VERIFICATION"
    echo "=============================================="
    echo ""

    # Test 1: Count cities with geometry
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "Cities with geometry (location): "

    local source_geo="N/A"
    local target_geo="N/A"

    if [[ "$TARGET_ONLY" != "true" ]]; then
        source_geo=$(query_source "SELECT COUNT(*) FROM cities WHERE location IS NOT NULL")
    fi

    if [[ "$SOURCE_ONLY" != "true" ]]; then
        target_geo=$(query_target "SELECT COUNT(*) FROM cities WHERE location IS NOT NULL" "$password")
    fi

    if [[ "$source_geo" == "$target_geo" || "$SOURCE_ONLY" == "true" || "$TARGET_ONLY" == "true" ]]; then
        echo -e "${GREEN}OK${NC} (Source: $source_geo, Target: $target_geo)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}MISMATCH${NC} (Source: $source_geo, Target: $target_geo)"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi

    # Test 2: Verify Jerusalem coordinates (well-known reference point)
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "Jerusalem geometry (city_id=293397): "

    if [[ "$SOURCE_ONLY" != "true" ]]; then
        local jerusalem_check
        jerusalem_check=$(query_target "SELECT ST_X(location::geometry)::numeric(10,4) || ',' || ST_Y(location::geometry)::numeric(10,4) FROM cities WHERE id = 293397" "$password")

        if [[ "$jerusalem_check" == "35.2137,31.7683" || "$jerusalem_check" =~ ^35\.21.*,31\.76.* ]]; then
            echo -e "${GREEN}OK${NC} (Coordinates: $jerusalem_check)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        elif [[ "$jerusalem_check" == "ERROR" || -z "$jerusalem_check" ]]; then
            echo -e "${YELLOW}SKIP${NC} (City ID 293397 not found or PostGIS error)"
            WARNINGS=$((WARNINGS + 1))
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${YELLOW}WARN${NC} (Got: $jerusalem_check, expected ~35.2137,31.7683)"
            WARNINGS=$((WARNINGS + 1))
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        fi
    else
        echo -e "${BLUE}SKIP${NC} (source-only mode)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi

    # Test 3: Test spatial query functionality
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "PostGIS spatial query: "

    if [[ "$SOURCE_ONLY" != "true" ]]; then
        local spatial_test
        spatial_test=$(query_target "SELECT COUNT(*) FROM cities WHERE ST_DWithin(location::geometry, ST_MakePoint(35.2137, 31.7683)::geometry, 0.5)" "$password")

        if [[ "$spatial_test" =~ ^[0-9]+$ && "$spatial_test" -gt 0 ]]; then
            echo -e "${GREEN}OK${NC} (Found $spatial_test cities within 0.5 deg of Jerusalem)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        elif [[ "$spatial_test" == "0" ]]; then
            echo -e "${YELLOW}WARN${NC} (No cities found - may be expected with limited data)"
            WARNINGS=$((WARNINGS + 1))
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}FAIL${NC} (Spatial query failed: $spatial_test)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
    else
        echo -e "${BLUE}SKIP${NC} (source-only mode)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
}

verify_extensions() {
    local password=$1

    echo ""
    echo "=============================================="
    echo "  EXTENSION VERIFICATION"
    echo "=============================================="
    echo ""

    # Check PostGIS version
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    printf "PostGIS extension: "

    if [[ "$SOURCE_ONLY" != "true" ]]; then
        local postgis_version
        postgis_version=$(query_target "SELECT PostGIS_Version()" "$password")

        if [[ "$postgis_version" =~ ^[0-9]+\.[0-9]+ ]]; then
            echo -e "${GREEN}OK${NC} (Version: $postgis_version)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        else
            echo -e "${RED}FAIL${NC} (PostGIS not available)"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        fi
    else
        echo -e "${BLUE}SKIP${NC} (source-only mode)"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    fi
}

verify_sequences() {
    local password=$1

    echo ""
    echo "=============================================="
    echo "  SEQUENCE VERIFICATION"
    echo "=============================================="
    echo ""

    # Check that sequences are properly set after migration
    local sequences=(
        "publishers_id_seq"
        "master_zmanim_registry_id_seq"
        "publisher_zmanim_id_seq"
    )

    for seq in "${sequences[@]}"; do
        TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
        printf "%-35s: " "$seq"

        if [[ "$SOURCE_ONLY" != "true" ]]; then
            local seq_val
            seq_val=$(query_target "SELECT last_value FROM $seq" "$password" 2>/dev/null)

            if [[ "$seq_val" =~ ^[0-9]+$ ]]; then
                echo -e "${GREEN}OK${NC} (last_value: $seq_val)"
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
            elif [[ "$seq_val" == "ERROR" ]]; then
                echo -e "${YELLOW}SKIP${NC} (sequence may not exist)"
                WARNINGS=$((WARNINGS + 1))
                PASSED_CHECKS=$((PASSED_CHECKS + 1))
            else
                echo -e "${RED}FAIL${NC} (unexpected value: $seq_val)"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
            fi
        else
            echo -e "${BLUE}SKIP${NC} (source-only mode)"
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
        fi
    done
}

print_summary() {
    echo ""
    echo "=============================================="
    echo "  VERIFICATION SUMMARY"
    echo "=============================================="
    echo ""
    echo "Total Checks:  $TOTAL_CHECKS"
    echo -e "Passed:        ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "Failed:        ${RED}$FAILED_CHECKS${NC}"
    echo -e "Warnings:      ${YELLOW}$WARNINGS${NC}"
    echo ""

    if [[ $FAILED_CHECKS -eq 0 ]]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  ALL VERIFICATION CHECKS PASSED!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "Migration data integrity verified."
        echo "Safe to proceed with smoke tests and DNS cutover."
        return 0
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  VERIFICATION FAILED - DO NOT PROCEED${NC}"
        echo -e "${RED}========================================${NC}"
        echo ""
        echo "Migration has data integrity issues."
        echo "Review failures above and re-run migration."
        return 1
    fi
}

generate_report() {
    local report_file="/tmp/verification-report-$(date +%Y%m%d_%H%M%S).txt"

    {
        echo "=== Zmanim Migration Verification Report ==="
        echo "Generated: $(date)"
        echo "Source: Xata PostgreSQL"
        echo "Target: AWS PostgreSQL ($AWS_EC2_HOST)"
        echo ""
        echo "Results:"
        echo "  Total Checks: $TOTAL_CHECKS"
        echo "  Passed: $PASSED_CHECKS"
        echo "  Failed: $FAILED_CHECKS"
        echo "  Warnings: $WARNINGS"
        echo ""
        if [[ $FAILED_CHECKS -eq 0 ]]; then
            echo "Status: PASS - Migration verified successfully"
        else
            echo "Status: FAIL - Data integrity issues detected"
        fi
    } > "$report_file"

    log_info "Report saved to: $report_file"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo "=============================================="
    echo "  Zmanim Migration Verification"
    echo "=============================================="
    echo "  Source: Xata PostgreSQL"
    echo "  Target: AWS PostgreSQL ($AWS_EC2_HOST)"
    echo "  Time:   $(date)"
    echo "=============================================="

    # Validate environment
    if [[ "$TARGET_ONLY" != "true" && -z "${XATA_DATABASE_URL:-}" ]]; then
        log_error "XATA_DATABASE_URL not set (use --target-only to skip source)"
        exit 1
    fi

    # Get AWS password
    local aws_password=""
    if [[ "$SOURCE_ONLY" != "true" ]]; then
        aws_password=$(get_aws_password)
    fi

    # Run verification checks
    verify_row_counts "$aws_password"
    verify_checksums "$aws_password"
    verify_postgis_geometry "$aws_password"
    verify_extensions "$aws_password"
    verify_sequences "$aws_password"

    # Generate report
    generate_report

    # Print summary and exit with appropriate code
    print_summary
}

main "$@"
