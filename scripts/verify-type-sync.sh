#!/bin/bash
# Type Sync Validation Script
# Verifies that frontend TypeScript types match backend Go types
# Currently focused on SQLc-generated types (implicit sync via API)

set -e

echo "=================================================="
echo "Type Sync Validation"
echo "=================================================="
echo ""

FAILED=0

# 1. Verify SQLc generated code is in sync (primary type sync mechanism)
echo "1. SQLc Type Generation Sync"
echo "-----------------------------"
if [ -d "api" ]; then
  cd api
  if sqlc generate 2>/dev/null; then
    if git diff --exit-code internal/db/sqlcgen/ >/dev/null 2>&1; then
      echo "  ✅ PASSED: SQLc types are in sync"
    else
      echo "  ❌ FAILED: SQLc types are out of sync"
      echo "  This affects type sync between Go backend and TypeScript frontend."
      echo "  Run: cd api && sqlc generate"
      FAILED=1
    fi
  else
    echo "  ❌ FAILED: SQLc generation failed"
    FAILED=1
  fi
  cd ..
else
  echo "  ⚠️  SKIPPED: api/ directory not found"
fi

echo ""

# 2. Verify TypeScript compilation succeeds (catches type errors in frontend)
echo "2. TypeScript Type Checking"
echo "---------------------------"
if [ -d "web" ]; then
  cd web
  if [ -f "package.json" ]; then
    # Check if node_modules exists, if not suggest install
    if [ ! -d "node_modules" ]; then
      echo "  ⚠️  SKIPPED: node_modules not found. Run 'cd web && npm install' first."
    else
      if npm run type-check 2>/dev/null; then
        echo "  ✅ PASSED: TypeScript types are valid"
      else
        echo "  ❌ FAILED: TypeScript type checking failed"
        echo "  This may indicate type mismatch between frontend and backend."
        FAILED=1
      fi
    fi
  fi
  cd ..
else
  echo "  ⚠️  SKIPPED: web/ directory not found"
fi

echo ""

# 3. Future: Could add explicit type mapping validation here
# For now, type sync is handled through:
# - SQLc generates Go types from database schema
# - API endpoints return JSON with these types
# - TypeScript interfaces match the API response structure
# - Type errors caught by TypeScript compiler

echo "=================================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ Type sync validation PASSED"
  echo "=================================================="
  exit 0
else
  echo "❌ Type sync validation FAILED"
  echo "=================================================="
  echo ""
  echo "Types are out of sync between frontend and backend."
  echo "See error messages above for details."
  exit 1
fi
