#!/bin/bash
# Local CI Checks - Reproduces pr-checks.yml workflow
# Run this before pushing to ensure CI will pass

set -e  # Exit on first error

echo "========================================="
echo "LOCAL CI CHECKS (pr-checks.yml)"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED_CHECKS=()

# Track check results
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    FAILED_CHECKS+=("$1")
}

# ============================================================================
# 1. SQLc Validation
# ============================================================================
echo "========================================="
echo "1. SQLc Validation"
echo "========================================="

cd api

echo "Validating SQL queries..."
if sqlc compile; then
    check_pass "SQLc compile"
else
    check_fail "SQLc compile"
fi

echo "Checking if generated code is up to date..."
sqlc generate
if git diff --exit-code internal/db/sqlcgen/; then
    check_pass "SQLc generated code is up to date"
else
    check_fail "SQLc generated code is out of sync"
    echo ""
    echo "To fix: cd api && sqlc generate"
fi

cd ..

# ============================================================================
# 2. Code Quality Checks
# ============================================================================
echo ""
echo "========================================="
echo "2. Code Quality Checks"
echo "========================================="

echo "Checking for TODO markers..."
if grep -r "// TODO\|TODO:" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules; then
    check_fail "Found TODO markers"
else
    check_pass "No TODO markers"
fi

echo "Checking for FIXME markers..."
if grep -r "FIXME" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules; then
    check_fail "Found FIXME markers"
else
    check_pass "No FIXME markers"
fi

echo "Checking for Legacy/DEPRECATED markers..."
if grep -r "// Legacy\|// DEPRECATED\|@deprecated\|/\* Legacy\|/\* DEPRECATED" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules | grep -v "sqlcgen"; then
    check_fail "Found Legacy/DEPRECATED markers"
else
    check_pass "No Legacy/DEPRECATED markers"
fi

echo "Checking for raw fetch() calls..."
if grep -r "await fetch\(" web/app web/components --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "api-client.ts" | grep -v node_modules; then
    check_fail "Found raw fetch() calls"
else
    check_pass "No raw fetch() calls"
fi

echo "Checking for log.Printf/fmt.Printf..."
if grep -r "log\.Printf\|fmt\.Printf" api/internal --include="*.go" --exclude="*_test.go" 2>/dev/null; then
    check_fail "Found log.Printf/fmt.Printf"
else
    check_pass "No log.Printf/fmt.Printf"
fi

# ============================================================================
# 3. Frontend Checks
# ============================================================================
echo ""
echo "========================================="
echo "3. Frontend Checks (web)"
echo "========================================="

cd web

echo "Installing dependencies..."
npm ci --quiet

echo "Type checking..."
if npm run type-check; then
    check_pass "TypeScript type check"
else
    check_fail "TypeScript type check"
fi

echo "Linting..."
if npm run lint; then
    check_pass "ESLint"
else
    check_fail "ESLint"
fi

echo "Unit tests..."
if npm run test; then
    check_pass "Unit tests"
else
    check_fail "Unit tests"
fi

echo "Building..."
if npm run build; then
    check_pass "Next.js build"
else
    check_fail "Next.js build"
fi

cd ..

# ============================================================================
# 4. Backend Checks
# ============================================================================
echo ""
echo "========================================="
echo "4. Backend Checks (api)"
echo "========================================="

cd api

echo "Downloading Go dependencies..."
go mod download

echo "Verifying Go dependencies..."
if go mod verify; then
    check_pass "Go mod verify"
else
    check_fail "Go mod verify"
fi

echo "Building..."
if go build -v ./...; then
    check_pass "Go build"
else
    check_fail "Go build"
fi

echo "Running tests with coverage..."
if go test -v -race -coverprofile=coverage.out -covermode=atomic ./...; then
    check_pass "Go tests"

    # Check coverage threshold
    COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
    echo "Total coverage: ${COVERAGE}%"

    if (( $(echo "$COVERAGE < 5" | bc -l) )); then
        check_fail "Coverage below 5% threshold"
    else
        check_pass "Coverage threshold (${COVERAGE}%)"
    fi
else
    check_fail "Go tests"
fi

echo "Running go vet..."
if go vet ./...; then
    check_pass "Go vet"
else
    check_fail "Go vet"
fi

cd ..

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "========================================="
echo "SUMMARY"
echo "========================================="

if [ ${#FAILED_CHECKS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "You can safely push to GitHub."
    exit 0
else
    echo -e "${RED}❌ ${#FAILED_CHECKS[@]} check(s) failed:${NC}"
    for check in "${FAILED_CHECKS[@]}"; do
        echo "  - $check"
    done
    echo ""
    echo "Fix these issues before pushing to GitHub."
    exit 1
fi
