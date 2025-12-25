#!/bin/bash
# Validate HebCal event coverage in tag_event_mappings table
# Usage: ./scripts/validate-hebcal-coverage.sh [year]
# Example: ./scripts/validate-hebcal-coverage.sh 5786

set -euo pipefail

YEAR=${1:-5786}  # Default to Hebrew year 5786 (2025-2026)
ISRAEL=${2:-false}  # Default to Diaspora

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "HebCal Event Coverage Validation"
echo "========================================"
echo "Year: $YEAR"
echo "Israel mode: $ISRAEL"
echo ""

# Fetch HebCal events
echo "Fetching events from HebCal API..."
HEBCAL_URL="https://www.hebcal.com/hebcal?v=1&cfg=json&year=${YEAR}&il=${ISRAEL}&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&o=on&s=off&c=off"
EVENTS_JSON=$(curl -s "$HEBCAL_URL")

if [ -z "$EVENTS_JSON" ]; then
    echo -e "${RED}ERROR: Failed to fetch events from HebCal API${NC}"
    exit 1
fi

# Extract unique event titles
EVENTS=$(echo "$EVENTS_JSON" | jq -r '.items[] | .title' | sort -u)
TOTAL_EVENTS=$(echo "$EVENTS" | wc -l)

echo -e "${GREEN}Fetched $TOTAL_EVENTS unique events${NC}"
echo ""

# Load database connection from .env
if [ -f api/.env ]; then
    source api/.env
else
    echo -e "${RED}ERROR: api/.env file not found${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set in api/.env${NC}"
    exit 1
fi

# Create temp file with events
TEMP_EVENTS=$(mktemp)
echo "$EVENTS" > "$TEMP_EVENTS"

# Create SQL to validate coverage
VALIDATION_SQL=$(cat <<EOF
-- Validate HebCal event coverage
WITH hebcal_events AS (
    SELECT unnest(string_to_array('$(echo "$EVENTS" | paste -sd '|')', '|')) AS title
),
mapped_events AS (
    SELECT DISTINCT
        he.title,
        tem.hebcal_event_pattern,
        zt.tag_key
    FROM hebcal_events he
    LEFT JOIN tag_event_mappings tem ON (
        he.title LIKE tem.hebcal_event_pattern OR
        tem.hebcal_event_pattern LIKE '%' || he.title || '%'
    )
    LEFT JOIN zman_tags zt ON tem.tag_id = zt.id
)
SELECT
    COUNT(*) FILTER (WHERE tag_key IS NOT NULL) as mapped_count,
    COUNT(*) FILTER (WHERE tag_key IS NULL) as unmapped_count,
    COUNT(*) as total_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE tag_key IS NOT NULL) / COUNT(*), 2) as coverage_percent
FROM mapped_events;
EOF
)

# Run validation
echo "Running coverage analysis..."
COVERAGE=$(psql "$DATABASE_URL" -t -c "$VALIDATION_SQL")

MAPPED=$(echo "$COVERAGE" | awk '{print $1}')
UNMAPPED=$(echo "$COVERAGE" | awk '{print $3}')
TOTAL=$(echo "$COVERAGE" | awk '{print $5}')
PERCENT=$(echo "$COVERAGE" | awk '{print $7}')

echo ""
echo "========================================"
echo "Coverage Summary"
echo "========================================"
echo -e "Total HebCal events: ${YELLOW}$TOTAL${NC}"
echo -e "Mapped events:       ${GREEN}$MAPPED${NC}"
echo -e "Unmapped events:     ${RED}$UNMAPPED${NC}"
echo -e "Coverage:            ${YELLOW}$PERCENT%${NC}"
echo ""

# Get unmapped events
UNMAPPED_SQL=$(cat <<EOF
WITH hebcal_events AS (
    SELECT unnest(string_to_array('$(echo "$EVENTS" | paste -sd '|')', '|')) AS title
)
SELECT he.title
FROM hebcal_events he
WHERE NOT EXISTS (
    SELECT 1 FROM tag_event_mappings tem
    WHERE he.title LIKE tem.hebcal_event_pattern
       OR tem.hebcal_event_pattern LIKE '%' || he.title || '%'
)
ORDER BY he.title;
EOF
)

UNMAPPED_EVENTS=$(psql "$DATABASE_URL" -t -c "$UNMAPPED_SQL" | sed 's/^[[:space:]]*//' | grep -v '^$' || true)

if [ -n "$UNMAPPED_EVENTS" ]; then
    echo "========================================"
    echo "Unmapped Events (require attention)"
    echo "========================================"
    echo "$UNMAPPED_EVENTS" | while read -r event; do
        echo -e "${RED}✗${NC} $event"
    done
    echo ""
else
    echo -e "${GREEN}✓ All events are mapped!${NC}"
    echo ""
fi

# Get duplicate mappings (potential conflicts)
DUPLICATE_SQL=$(cat <<'EOF'
SELECT
    tem.hebcal_event_pattern,
    tem.priority,
    STRING_AGG(zt.tag_key, ', ' ORDER BY zt.tag_key) as tags
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
WHERE tem.hebcal_event_pattern IS NOT NULL
GROUP BY tem.hebcal_event_pattern, tem.priority
HAVING COUNT(*) > 1
ORDER BY tem.hebcal_event_pattern, tem.priority;
EOF
)

DUPLICATES=$(psql "$DATABASE_URL" -t -c "$DUPLICATE_SQL" | sed 's/^[[:space:]]*//' | grep -v '^$' || true)

if [ -n "$DUPLICATES" ]; then
    echo "========================================"
    echo "Duplicate Mappings (intentional?)"
    echo "========================================"
    echo "$DUPLICATES" | while read -r line; do
        echo -e "${YELLOW}⚠${NC} $line"
    done
    echo ""
fi

# Generate migration SQL for unmapped events
if [ -n "$UNMAPPED_EVENTS" ]; then
    MIGRATION_FILE="db/migrations/$(date +%Y%m%d%H%M%S)_add_missing_hebcal_events.sql"

    echo "========================================"
    echo "Generating Migration SQL"
    echo "========================================"
    echo "File: $MIGRATION_FILE"
    echo ""

    cat > "$MIGRATION_FILE" <<'SQLHEADER'
-- Migration: Add missing HebCal event mappings
-- Generated by validate-hebcal-coverage.sh
-- Review and adjust tag_key values before running!

BEGIN;

SQLHEADER

    echo "$UNMAPPED_EVENTS" | while read -r event; do
        # Normalize event name to snake_case tag key
        TAG_KEY=$(echo "$event" | \
            sed 's/[^a-zA-Z0-9 ]//g' | \
            tr '[:upper:]' '[:lower:]' | \
            tr ' ' '_' | \
            sed 's/__*/_/g' | \
            sed 's/^_//' | \
            sed 's/_$//')

        cat >> "$MIGRATION_FILE" <<SQL

-- Event: $event
-- TODO: Review tag_key and display names before running
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, display_name_english_sephardi, tag_type_id, hebcal_basename)
SELECT '$TAG_KEY', '$event', '$event', '$event',
       (SELECT id FROM tag_types WHERE key = 'event'),
       '$event'
WHERE NOT EXISTS (SELECT 1 FROM zman_tags WHERE tag_key = '$TAG_KEY');

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, priority)
SELECT id, '$event', 10
FROM zman_tags WHERE tag_key = '$TAG_KEY';

SQL
    done

    cat >> "$MIGRATION_FILE" <<'SQLFOOTER'

COMMIT;

-- Validation: Check that all events are now mapped
-- (Re-run validate-hebcal-coverage.sh after applying this migration)
SQLFOOTER

    echo -e "${GREEN}✓ Migration SQL generated${NC}"
    echo -e "Review the file before running: ${YELLOW}$MIGRATION_FILE${NC}"
    echo ""
fi

# Cleanup
rm -f "$TEMP_EVENTS"

echo "========================================"
echo "Validation Complete"
echo "========================================"

if [ "$UNMAPPED" -eq 0 ]; then
    echo -e "${GREEN}✓ Perfect coverage - no action needed${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Action needed: Review migration file${NC}"
    exit 1
fi
