#!/bin/bash
# Local E2E Tests - Reproduces pr-e2e.yml workflow
# Runs Playwright E2E tests exactly as GitHub Actions does

set -e  # Exit on first error

echo "========================================="
echo "LOCAL E2E TESTS (pr-e2e.yml)"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are running
echo "Checking if services are running..."

if ! curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${RED}❌ API server not running on http://localhost:8080${NC}"
    echo "Run: ./restart.sh"
    exit 1
fi

if ! curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${RED}❌ Web server not running on http://localhost:3001${NC}"
    echo "Run: ./restart.sh"
    exit 1
fi

echo -e "${GREEN}✅ Services are running${NC}"
echo ""

# Check Redis
echo "Checking Redis connection..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Redis not responding (optional)${NC}"
else
    echo -e "${GREEN}✅ Redis is ready${NC}"
fi
echo ""

# Check database connection
echo "Checking database connection..."
if source api/.env && psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection verified${NC}"

    # Count localities
    LOCALITIES=$(source api/.env && psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM geo_localities;")
    echo "   Localities in database: $(echo $LOCALITIES | xargs)"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi
echo ""

# Install Playwright if needed
echo "Installing Playwright dependencies..."
cd tests
npm ci --quiet
npx playwright install chromium --with-deps > /dev/null 2>&1
cd ..
echo -e "${GREEN}✅ Playwright ready${NC}"
echo ""

# Run E2E tests exactly as GitHub does
echo "========================================="
echo "Running Playwright E2E Tests"
echo "========================================="
echo ""

cd tests

# GitHub uses: npx playwright test --reporter=html,github
# For local, we use: npx playwright test --reporter=html
npx playwright test --reporter=html

TEST_EXIT_CODE=$?

cd ..

# Summary
echo ""
echo "========================================="
echo "SUMMARY"
echo "========================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All E2E tests passed!${NC}"
    echo ""
    echo "HTML Report: tests/test-results/html-report/index.html"
    exit 0
else
    echo -e "${RED}❌ E2E tests failed${NC}"
    echo ""
    echo "View report: tests/test-results/html-report/index.html"
    echo "View screenshots: tests/test-results/artifacts/"
    exit 1
fi
