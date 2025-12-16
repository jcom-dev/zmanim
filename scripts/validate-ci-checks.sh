#!/bin/bash
# CI validation script - Tests the same checks that run in GitHub Actions
# Run this locally before pushing to catch issues early

set -e

echo "=================================================="
echo "CI Validation - Running local checks"
echo "=================================================="
echo ""

FAILED=0

# Code Quality Checks
echo "1. Code Quality Checks"
echo "----------------------"

echo "  - Checking for TODO markers..."
if grep -r "// TODO\|TODO:" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules; then
  echo "    ❌ FAILED: Found TODO comments"
  FAILED=1
else
  echo "    ✅ PASSED: No TODO markers"
fi

echo "  - Checking for FIXME markers..."
if grep -r "FIXME" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules; then
  echo "    ❌ FAILED: Found FIXME comments"
  FAILED=1
else
  echo "    ✅ PASSED: No FIXME markers"
fi

echo "  - Checking for Legacy/DEPRECATED comment markers..."
if grep -r "// Legacy\|// DEPRECATED\|@deprecated\|/\* Legacy\|/\* DEPRECATED" web/ api/ --include="*.tsx" --include="*.ts" --include="*.go" 2>/dev/null | grep -v node_modules | grep -v "sqlcgen"; then
  echo "    ❌ FAILED: Found Legacy/DEPRECATED comment markers"
  FAILED=1
else
  echo "    ✅ PASSED: No Legacy/DEPRECATED comment markers"
fi

echo "  - Checking for raw fetch() calls..."
if grep -r "await fetch\(" web/app web/components --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "api-client.ts" | grep -v node_modules; then
  echo "    ❌ FAILED: Found raw fetch() calls"
  FAILED=1
else
  echo "    ✅ PASSED: No raw fetch() calls"
fi

echo "  - Checking for log.Printf/fmt.Printf..."
if grep -r "log\.Printf\|fmt\.Printf" api/internal --include="*.go" --exclude="*_test.go" 2>/dev/null; then
  echo "    ❌ FAILED: Found log.Printf/fmt.Printf in non-test code"
  FAILED=1
else
  echo "    ✅ PASSED: No log.Printf/fmt.Printf (test files excluded)"
fi

echo ""

# SQLc Validation
echo "2. SQLc Validation"
echo "------------------"

if [ -d "api" ]; then
  echo "  - Compiling SQL queries..."
  cd api
  if sqlc compile 2>/dev/null; then
    echo "    ✅ PASSED: SQLc compile successful"
  else
    echo "    ❌ FAILED: SQLc compile failed"
    FAILED=1
  fi

  echo "  - Checking generated code sync..."
  sqlc generate 2>/dev/null
  if git diff --exit-code internal/db/sqlcgen/ >/dev/null 2>&1; then
    echo "    ✅ PASSED: SQLc generated code is up to date"
  else
    echo "    ❌ FAILED: SQLc generated code is out of sync"
    echo "    Run: cd api && sqlc generate"
    FAILED=1
  fi
  cd ..
else
  echo "    ⚠️  SKIPPED: api/ directory not found"
fi

echo ""

# Summary
echo "=================================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ All CI validation checks PASSED"
  echo "=================================================="
  exit 0
else
  echo "❌ Some CI validation checks FAILED"
  echo "=================================================="
  echo ""
  echo "Fix the issues above before pushing."
  echo "See: docs/coding-standards.md for guidance"
  exit 1
fi
