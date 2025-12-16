#!/bin/bash

# Pre-commit Fast Checks
# Quick validation before committing (target: under 30 seconds)
# Usage: ./scripts/pre-commit-check.sh

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Timing
START_TIME=$(date +%s)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Pre-commit Fast Checks${NC}"
echo -e "${BLUE}========================================${NC}"

# Track failures
FAILURES=0

# Helper function for steps
run_check() {
  local name=$1
  local command=$2
  local step_start=$(date +%s)

  echo -e "\n${BLUE}→${NC} $name"

  if eval "$command" > /dev/null 2>&1; then
    local duration=$(($(date +%s) - step_start))
    echo -e "${GREEN}✓${NC} Passed (${duration}s)"
    return 0
  else
    local duration=$(($(date +%s) - step_start))
    echo -e "${RED}✗${NC} Failed (${duration}s)"
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

# 1. Go fmt check
echo -e "\n${YELLOW}Backend Checks${NC}"

if command -v gofmt &> /dev/null; then
  run_check "Go formatting (gofmt)" "cd $PROJECT_ROOT/api && test -z \"\$(gofmt -l .)\""
else
  echo -e "${YELLOW}⚠ gofmt not found, skipping Go formatting check${NC}"
fi

# 2. Frontend ESLint
echo -e "\n${YELLOW}Frontend Checks${NC}"

# Ensure web dependencies are installed
if [ ! -d "$PROJECT_ROOT/web/node_modules" ]; then
  echo "  Installing web dependencies..."
  (cd "$PROJECT_ROOT/web" && npm ci > /dev/null 2>&1)
fi

run_check "ESLint" "cd $PROJECT_ROOT/web && npm run lint"

# 3. TypeScript type checking
run_check "TypeScript type check" "cd $PROJECT_ROOT/web && npm run type-check"

# 4. Go vet (fast static analysis)
if command -v go &> /dev/null; then
  run_check "Go vet" "cd $PROJECT_ROOT/api && go vet ./..."
else
  echo -e "${YELLOW}⚠ Go not found, skipping go vet${NC}"
fi

# Summary
TOTAL_DURATION=$(($(date +%s) - START_TIME))

echo -e "\n${BLUE}========================================${NC}"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All pre-commit checks passed!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Time: ${TOTAL_DURATION}s"
  echo ""
  echo -e "${BLUE}Ready to commit!${NC}"
  echo ""
  echo "Run full CI checks before pushing:"
  echo "  ./scripts/test-local.sh --skip-e2e"
  echo ""
  exit 0
else
  echo -e "${RED}${FAILURES} check(s) failed${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo "Time: ${TOTAL_DURATION}s"
  echo ""
  echo "Fix the issues above before committing."
  echo ""

  # Provide helpful hints
  echo "Common fixes:"
  echo "  • Go formatting:  cd api && gofmt -w ."
  echo "  • ESLint:         cd web && npm run lint -- --fix"
  echo "  • TypeScript:     Check errors in your editor"
  echo ""

  exit 1
fi
