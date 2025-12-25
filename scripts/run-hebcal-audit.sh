#!/bin/bash
# HebCal Tag Coverage Audit Runner
# Runs the HebCal event coverage audit test and displays results location
# This test validates 100% coverage between HebCal events and tag-driven architecture

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
API_DIR="$PROJECT_ROOT/api"
OUTPUT_DIR="$PROJECT_ROOT/_bmad-output"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=================================================="
echo "HebCal Tag Coverage Audit"
echo "=================================================="
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Load environment
if [ -f "$API_DIR/.env" ]; then
  echo "Loading environment from $API_DIR/.env..."
  source "$API_DIR/.env"
fi

# Run the test
echo "Running audit test..."
echo "  Years: 5775-5785 (10 Hebrew years)"
echo "  Locations: Jerusalem, Salford"
echo ""

cd "$API_DIR" || exit 1

# Run the specific test with verbose output
go test -v -timeout 5m ./internal/calendar -run TestHebCalEventCoverage

TEST_EXIT_CODE=$?

echo ""
echo "=================================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✓ Audit test completed successfully${NC}"
else
  echo -e "${YELLOW}⚠ Audit test completed with warnings (check output above)${NC}"
fi
echo "=================================================="
echo ""

# Display report locations
echo "Generated Reports:"
echo "  CSV Files:"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-full-events.csv${NC}"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-unmapped-events.csv${NC}"
echo "  Markdown Reports:"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-summary.md${NC}"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-unmapped-analysis.md${NC}"
echo "  Coverage Reports:"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-coverage-by-category.md${NC}"
echo "  Multi-Day Event Results:"
echo -e "    ${BLUE}$OUTPUT_DIR/hebcal-audit-multiday-events.md${NC}"
echo ""

echo "Next Steps:"
echo "  1. Review the summary report: cat $OUTPUT_DIR/hebcal-audit-summary.md"
echo "  2. Check unmapped events: cat $OUTPUT_DIR/hebcal-audit-unmapped-analysis.md"
echo "  3. For gaps, run: grep -E '^[^0-9]' $OUTPUT_DIR/hebcal-audit-unmapped-events.csv"
echo ""

exit $TEST_EXIT_CODE
