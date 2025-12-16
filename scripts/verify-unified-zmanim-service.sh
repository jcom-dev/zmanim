#!/bin/bash
#
# Verification script for unified zmanim service refactoring
# Ensures all hardcoded zman logic has been removed
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

log_test() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Test 1: Only one zmanim service file in api/internal/services/
log_test "Test 1: Only one zmanim service file in api/internal/services/"
service_files=$(find "$API_DIR/internal/services" -name "zmanim*.go" -type f)
service_count=$(echo "$service_files" | wc -l)

echo "Found service files:"
echo "$service_files"

if [ "$service_count" -eq 1 ]; then
    pass "Only one zmanim service file exists"
else
    fail "Expected 1 zmanim service file, found $service_count"
fi

# Test 2: No hardcoded isCandleLighting/isHavdalah/isFastStart/isFastEnd variable names
log_test "Test 2: No hardcoded zman-specific variable names"
hardcoded_vars=$(rg "is(CandleLighting|Havdalah|FastStart|FastEnd)\s*:?=" "$API_DIR/internal/" --type go -l 2>/dev/null || true)

if [ -z "$hardcoded_vars" ]; then
    pass "No hardcoded zman-specific variable names found"
else
    fail "Found hardcoded zman-specific variable names in:"
    echo "$hardcoded_vars"
fi

# Test 3: No Show* boolean fields used for filtering
log_test "Test 3: No Show* boolean fields used for filtering"
show_fields=$(rg "Show(CandleLighting|Havdalah|FastStart|FastEnd)" "$API_DIR/internal/" --type go -l 2>/dev/null || true)

if [ -z "$show_fields" ]; then
    pass "No Show* boolean fields found"
else
    fail "Found Show* boolean fields in:"
    echo "$show_fields"
fi

# Test 4: No references to deleted services
log_test "Test 4: No references to deleted services"
deleted_services=$(rg "(ZmanimCalculationService|ZmanimOrderingService|ZmanimLinkingService)" "$API_DIR/internal/" --type go -l 2>/dev/null || true)

if [ -z "$deleted_services" ]; then
    pass "No references to deleted services found"
else
    fail "Found references to deleted services in:"
    echo "$deleted_services"
fi

# Test 5: Build succeeds
log_test "Test 5: API build succeeds"
cd "$API_DIR"
if go build ./cmd/api > /dev/null 2>&1; then
    pass "API builds successfully"
    rm -f api  # Clean up binary
else
    fail "API build failed"
fi

# Test 6: Check for duplicate applyRounding functions
log_test "Test 6: No duplicate applyRounding functions"
apply_rounding_count=$(rg "^func applyRounding" "$API_DIR/internal/" --type go | wc -l)

if [ "$apply_rounding_count" -le 1 ]; then
    pass "No duplicate applyRounding functions found (count: $apply_rounding_count)"
else
    warn "Found $apply_rounding_count applyRounding functions - check for duplicates:"
    rg "^func applyRounding" "$API_DIR/internal/" --type go
fi

# Additional check: Old tag patterns
log_test "Additional: Check for old tag patterns"
old_tags=$(rg "is_candle_lighting|is_havdalah|is_fast_start|is_fast_end" "$API_DIR/internal/" --type go -l 2>/dev/null || true)

if [ -z "$old_tags" ]; then
    pass "No old tag patterns found"
else
    fail "Found old tag patterns in:"
    echo "$old_tags"
fi

# Summary
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. See details above.${NC}"
    exit 1
fi
