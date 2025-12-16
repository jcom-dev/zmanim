#!/bin/bash

# Local CI Pipeline Mirror
# Mirrors GitHub Actions CI pipeline for local testing before pushing
# Usage: ./scripts/test-local.sh [--skip-e2e] [--verbose] [--help]

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
SKIP_E2E=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-e2e)
      SKIP_E2E=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      echo "Usage: ./scripts/test-local.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-e2e    Skip E2E tests (faster, CI unit tests only)"
      echo "  --verbose     Show detailed output from all commands"
      echo "  --help        Show this help message"
      echo ""
      echo "This script mirrors the GitHub Actions CI pipeline locally."
      echo "It runs all checks that would run on a PR to dev branch."
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Timing
STEP_START=0
TOTAL_START=$(date +%s)

start_step() {
  STEP_START=$(date +%s)
  echo -e "\n${BLUE}==>${NC} $1"
}

end_step() {
  local duration=$(($(date +%s) - STEP_START))
  echo -e "${GREEN}✓${NC} Completed in ${duration}s"
}

error_step() {
  echo -e "${RED}✗${NC} Failed"
  exit 1
}

# Check required tools
start_step "Step 0: Checking required tools"

# Check Go
if ! command -v go &> /dev/null; then
  echo -e "${RED}✗ Go not found${NC}"
  echo "Install Go 1.24+ from https://go.dev/dl/"
  exit 1
fi
GO_VERSION=$(go version | awk '{print $3}')
echo "  Go: $GO_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  echo "Install Node.js 20+ from https://nodejs.org/"
  exit 1
fi
NODE_VERSION=$(node --version)
echo "  Node.js: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm not found${NC}"
  exit 1
fi
NPM_VERSION=$(npm --version)
echo "  npm: $NPM_VERSION"

# Check golangci-lint
if ! command -v golangci-lint &> /dev/null; then
  echo -e "${YELLOW}⚠ golangci-lint not found${NC}"
  echo "  Install: brew install golangci-lint"
  echo "  Or: https://golangci-lint.run/usage/install/"
  echo "  Skipping golangci-lint checks..."
  SKIP_GOLANGCI=true
else
  GOLANGCI_VERSION=$(golangci-lint --version | head -n1)
  echo "  golangci-lint: $GOLANGCI_VERSION"
  SKIP_GOLANGCI=false
fi

end_step

# Backend Linting
if [ "$SKIP_GOLANGCI" = false ]; then
  start_step "Step 1: Backend linting (golangci-lint)"
  cd "$PROJECT_ROOT/api"

  if [ "$VERBOSE" = true ]; then
    golangci-lint run ./... --timeout 5m || error_step
  else
    golangci-lint run ./... --timeout 5m > /dev/null || error_step
  fi

  cd "$PROJECT_ROOT"
  end_step
else
  echo -e "\n${YELLOW}Skipping Step 1: Backend linting (golangci-lint not installed)${NC}"
fi

# Frontend Linting
start_step "Step 2: Frontend linting (ESLint)"
cd "$PROJECT_ROOT/web"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm ci > /dev/null
fi

if [ "$VERBOSE" = true ]; then
  npm run lint || error_step
else
  npm run lint > /dev/null || error_step
fi

cd "$PROJECT_ROOT"
end_step

# Frontend Type Checking
start_step "Step 3: Frontend type checking (TypeScript)"
cd "$PROJECT_ROOT/web"

if [ "$VERBOSE" = true ]; then
  npm run type-check || error_step
else
  npm run type-check > /dev/null || error_step
fi

cd "$PROJECT_ROOT"
end_step

# Backend Build
start_step "Step 4: Backend build"
cd "$PROJECT_ROOT/api"

# Check if dependencies need downloading
if [ ! -d "vendor" ] && [ ! -f "go.sum" ]; then
  echo "  Downloading dependencies..."
  go mod download
fi

if [ "$VERBOSE" = true ]; then
  go build -v ./... || error_step
else
  go build -v ./... > /dev/null 2>&1 || error_step
fi

cd "$PROJECT_ROOT"
end_step

# Backend Tests
start_step "Step 5: Backend tests with coverage"
cd "$PROJECT_ROOT/api"

if [ "$VERBOSE" = true ]; then
  go test -v -race -coverprofile=coverage.out -covermode=atomic ./... || error_step
else
  go test -race -coverprofile=coverage.out -covermode=atomic ./... || error_step
fi

# Show coverage summary
echo ""
go tool cover -func=coverage.out | grep total || true

# Check coverage threshold (5% minimum, same as CI)
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | tr -d '%')
if [ -n "$COVERAGE" ]; then
  echo "  Total coverage: ${COVERAGE}%"
  if (( $(echo "$COVERAGE < 5" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${YELLOW}⚠ Coverage ${COVERAGE}% is below 5% threshold${NC}"
  fi
fi

cd "$PROJECT_ROOT"
end_step

# Backend Vet
start_step "Step 6: Backend static analysis (go vet)"
cd "$PROJECT_ROOT/api"

if [ "$VERBOSE" = true ]; then
  go vet ./... || error_step
else
  go vet ./... > /dev/null || error_step
fi

cd "$PROJECT_ROOT"
end_step

# Frontend Build
start_step "Step 7: Frontend build (Next.js)"
cd "$PROJECT_ROOT/web"

# Note: Build requires CLERK env vars - check if they exist
if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
  echo -e "${YELLOW}  ⚠ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not set${NC}"
  echo "  Build may fail if Clerk middleware is required"
fi

if [ "$VERBOSE" = true ]; then
  npm run build || error_step
else
  npm run build > /dev/null || error_step
fi

cd "$PROJECT_ROOT"
end_step

# Frontend Unit Tests
start_step "Step 7.5: Frontend unit tests (Vitest)"
cd "$PROJECT_ROOT/web"

if [ "$VERBOSE" = true ]; then
  npm run test || error_step
else
  npm run test > /dev/null || error_step
fi

cd "$PROJECT_ROOT"
end_step

# E2E Tests (optional)
if [ "$SKIP_E2E" = false ]; then
  start_step "Step 8: E2E tests (Playwright)"

  echo -e "${YELLOW}  Note: E2E tests require running services (PostgreSQL, Redis, API, Web)${NC}"
  echo "  Use ./restart.sh to start services before running E2E tests"
  echo "  Or use --skip-e2e to skip this step"
  echo ""

  cd "$PROJECT_ROOT/tests"

  # Check if node_modules exists
  if [ ! -d "node_modules" ]; then
    echo "  Installing Playwright dependencies..."
    npm ci > /dev/null
    npx playwright install chromium --with-deps > /dev/null
  fi

  # Check if services are running
  if ! curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠ API not responding at http://localhost:8080${NC}"
    echo "  Run ./restart.sh to start services"
    error_step
  fi

  if ! curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠ Web app not responding at http://localhost:3001${NC}"
    echo "  Run ./restart.sh to start services"
    error_step
  fi

  echo "  Running Playwright tests..."
  if [ "$VERBOSE" = true ]; then
    npx playwright test || error_step
  else
    npx playwright test > /dev/null || error_step
  fi

  cd "$PROJECT_ROOT"
  end_step
else
  echo -e "\n${YELLOW}Skipping Step 8: E2E tests (--skip-e2e flag)${NC}"
fi

# Summary
TOTAL_DURATION=$(($(date +%s) - TOTAL_START))
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}All checks passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Total time: ${TOTAL_DURATION}s"
echo ""
echo -e "${BLUE}You're ready to push!${NC}"
echo ""
echo "Steps completed:"
echo "  ✓ Tool version checks"
if [ "$SKIP_GOLANGCI" = false ]; then
  echo "  ✓ Backend linting (golangci-lint)"
else
  echo "  ⊘ Backend linting (skipped - golangci-lint not installed)"
fi
echo "  ✓ Frontend linting (ESLint)"
echo "  ✓ Frontend type checking (TypeScript)"
echo "  ✓ Backend build"
echo "  ✓ Backend tests with coverage"
echo "  ✓ Backend static analysis (go vet)"
echo "  ✓ Frontend build (Next.js)"
echo "  ✓ Frontend unit tests (Vitest)"
if [ "$SKIP_E2E" = false ]; then
  echo "  ✓ E2E tests (Playwright)"
else
  echo "  ⊘ E2E tests (skipped with --skip-e2e)"
fi
echo ""
echo "Next steps:"
echo "  git add ."
echo "  git commit -m \"your message\""
echo "  git push"
echo ""
