#!/bin/bash
set -e

echo "=== Zmanim Lab Coding Standards Compliance ==="
echo ""

# Backend checks
echo "🔧 Backend:"
RAW_SQL=$(grep -rE "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
LOG_PRINTF=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
echo "  ⚠ Raw SQL violations: $RAW_SQL (target: 0)"
echo "  ⚠ log.Printf usage: $LOG_PRINTF (target: 0)"

# Frontend checks
echo ""
echo "🎨 Frontend:"
RAW_FETCH=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | wc -l)
HARDCODED_COLORS=$(grep -rE 'text-\[#|bg-\[#|style.*color:' web/components --include="*.tsx" 2>/dev/null | wc -l)
echo "  ⚠ Raw fetch() calls: $RAW_FETCH (target: 0)"
echo "  ✓ Hardcoded colors: $HARDCODED_COLORS (target: 0)"

# Database checks
echo ""
echo "🗄️ Database:"
VARCHAR_FKS=$(grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql 2>/dev/null | grep -v "languages.code" | wc -l)
echo "  ✓ VARCHAR foreign keys: $VARCHAR_FKS (target: 0)"

# Testing checks
echo ""
echo "🧪 Testing:"
TOTAL_TESTS=$(find tests/e2e -name "*.spec.ts" 2>/dev/null | wc -l)
PARALLEL_TESTS=$(grep -r "test.describe.configure.*parallel" tests/e2e --include="*.spec.ts" 2>/dev/null | wc -l)
MISSING_PARALLEL=$((TOTAL_TESTS - PARALLEL_TESTS))
echo "  ⚠ Tests missing parallel mode: $MISSING_PARALLEL (target: 0)"

# Summary
echo ""
TOTAL_VIOLATIONS=$((RAW_SQL + LOG_PRINTF + RAW_FETCH + HARDCODED_COLORS + VARCHAR_FKS + MISSING_PARALLEL))
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
  echo "✅ All checks passed! Codebase is compliant."
  exit 0
else
  echo "⚠️  Total violations: $TOTAL_VIOLATIONS"
  echo ""
  echo "Details:"
  if [ $RAW_FETCH -gt 0 ]; then
    echo ""
    echo "Raw fetch() violations:"
    grep -rn "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | head -10
  fi
  if [ $LOG_PRINTF -gt 0 ]; then
    echo ""
    echo "log.Printf/fmt.Printf violations:"
    grep -rn -E "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null
  fi
  if [ $RAW_SQL -gt 0 ]; then
    echo ""
    echo "Raw SQL violations (first 10):"
    grep -rn -E "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | head -10
  fi
  echo ""
  echo "Run 'scripts/fix-compliance.sh' to auto-fix simple violations."
  exit 1
fi
