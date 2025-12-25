#!/bin/bash

# validate-no-hardcoded-logic.sh
# Searches for forbidden patterns that indicate hardcoded event logic
# Exit code 0 = clean (no hardcoded logic found)
# Exit code 1 = hardcoded logic detected

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FOUND_ISSUES=0

echo "========================================="
echo "Validating No Hardcoded Event Logic"
echo "========================================="
echo ""

# Function to search for pattern and report
check_pattern() {
    local pattern="$1"
    local description="$2"
    local exclude_pattern="${3:-}"

    echo -n "Checking for $description... "

    if [ -n "$exclude_pattern" ]; then
        results=$(grep -rn --include="*.go" \
            --exclude="*_test.go" \
            --exclude-dir="vendor" \
            --exclude-dir="node_modules" \
            "$pattern" "$PROJECT_ROOT" | grep -v "$exclude_pattern" || true)
    else
        results=$(grep -rn --include="*.go" \
            --exclude="*_test.go" \
            --exclude-dir="vendor" \
            --exclude-dir="node_modules" \
            "$pattern" "$PROJECT_ROOT" || true)
    fi

    if [ -n "$results" ]; then
        echo -e "${RED}FOUND${NC}"
        echo "$results"
        echo ""
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    else
        echo -e "${GREEN}OK${NC}"
    fi
}

# Check 1: Hardcoded event code strings in switch/case statements
echo "1. Checking for hardcoded event codes in switch/case..."
check_pattern 'case.*"shabbos"' "shabbos string in case statement"
check_pattern 'case.*"rosh_hashanah"' "rosh_hashanah string in case statement"
check_pattern 'case.*"yom_kippur"' "yom_kippur string in case statement"
check_pattern 'case.*"sukkos"' "sukkos string in case statement"
check_pattern 'case.*"pesach"' "pesach string in case statement"
check_pattern 'case.*"shavuos"' "shavuos string in case statement"
check_pattern 'case.*"chanukah"' "chanukah string in case statement"
check_pattern 'case.*"purim"' "purim string in case statement"
echo ""

# Check 2: Hardcoded event checking functions
echo "2. Checking for hardcoded event checking functions..."
check_pattern 'func isYomTovEvent' "isYomTovEvent function"
check_pattern 'func getFastStartType' "getFastStartType function"
check_pattern 'func mapHolidayToEventCode' "mapHolidayToEventCode function"
echo ""

# Check 3: Hardcoded event code maps
echo "3. Checking for hardcoded event code maps..."
check_pattern 'yomTovCodes.*:=.*map\[string\]bool' "yomTovCodes map"
check_pattern 'fastStartTypes.*:=.*map\[string\]string' "fastStartTypes map"
check_pattern 'eventCodeMap.*:=.*map\[string\]' "eventCodeMap"
echo ""

# Check 4: Direct event code comparisons
echo "4. Checking for direct event code comparisons..."
check_pattern 'if.*==.*"shabbos"' "direct shabbos comparison"
check_pattern 'if.*==.*"yom_kippur"' "direct yom_kippur comparison"
check_pattern 'if.*==.*"rosh_hashanah"' "direct rosh_hashanah comparison"
echo ""

# Check 5: Hardcoded Hebrew date logic
echo "5. Checking for hardcoded Hebrew date logic..."
check_pattern 'if.*hebrewMonth.*==.*[0-9].*&&.*hebrewDay.*==.*[0-9]' "hardcoded Hebrew date check"
echo ""

# Check 6: Fast day type logic
echo "6. Checking for hardcoded fast day type logic..."
check_pattern 'switch.*fastType' "switch on fast type" "// OK:"
check_pattern 'if.*fastType.*==.*"sunset"' "hardcoded sunset fast check"
check_pattern 'if.*fastType.*==.*"dawn"' "hardcoded dawn fast check"
echo ""

# Check 7: Event category hardcoding
echo "7. Checking for hardcoded event categories..."
check_pattern 'category.*==.*"yom_tov"' "hardcoded yom_tov category"
check_pattern 'category.*==.*"fast"' "hardcoded fast category"
echo ""

# Check 8: Ensure database-driven approach is used
echo "8. Verifying database-driven approach..."

# Check for presence of database query usage
db_queries=$(grep -rn --include="*.go" \
    --exclude-dir="vendor" \
    --exclude-dir="node_modules" \
    "GetTagEventMappings\|GetTagsForHebCalEvent\|GetTagsForHebrewDate" \
    "$PROJECT_ROOT/api/internal" || true)

if [ -z "$db_queries" ]; then
    echo -e "${YELLOW}WARNING${NC}: No database queries found for tag event mappings"
    echo "Expected queries: GetTagEventMappings, GetTagsForHebCalEvent, GetTagsForHebrewDate"
    echo ""
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo -e "${GREEN}OK${NC} - Database queries found"
fi
echo ""

# Check 9: Verify tag-driven architecture files exist
echo "9. Verifying tag-driven architecture files..."

required_files=(
    "api/internal/db/queries/tag_events.sql"
    "api/internal/calendar/category_mappings.go"
    "db/migrations/20251224210000_sync_hebcal_events.sql"
)

for file in "${required_files[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    fi
done
echo ""

# Summary
echo "========================================="
if [ $FOUND_ISSUES -eq 0 ]; then
    echo -e "${GREEN}SUCCESS${NC}: No hardcoded event logic detected!"
    echo "The codebase is fully tag-driven and database-driven."
    exit 0
else
    echo -e "${RED}FAILURE${NC}: Found $FOUND_ISSUES issue(s)"
    echo ""
    echo "Hardcoded event logic detected. All event logic should be:"
    echo "  1. Stored in the database (zman_tags, tag_event_mappings tables)"
    echo "  2. Retrieved via SQLc queries (GetTagEventMappings, etc.)"
    echo "  3. Applied dynamically based on calendar date and HebCal events"
    echo ""
    echo "Do NOT use:"
    echo "  ✗ Hardcoded event code strings in switch/case"
    echo "  ✗ Hardcoded event checking functions (isYomTovEvent, etc.)"
    echo "  ✗ Hardcoded maps of event codes"
    echo "  ✗ Direct event code comparisons in if statements"
    echo ""
    echo "Instead:"
    echo "  ✓ Query zman_tags and tag_event_mappings tables"
    echo "  ✓ Use pattern matching from database"
    echo "  ✓ Filter zmanim by active tags for the date"
    exit 1
fi
