#!/bin/bash
set -e

echo "=== Shtetl Zmanim Coding Standards Compliance ==="
echo ""

# Security checks
echo "🔐 Security:"
DB_CONN_STRINGS=$(grep -rE "postgresql://[^\"]*:[^\"]*@" api web --include="*.go" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | grep -v ".env.example" | grep -v "docs/" | wc -l)
API_KEYS=$(grep -rE "(sk_live_|sk_prod_|AKIA|AIza)" api web --include="*.go" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | grep -v ".env.example" | grep -v "docs/" | wc -l)
echo "  ⚠ Hardcoded DB connection strings: $DB_CONN_STRINGS (target: 0)"
echo "  ⚠ Hardcoded API keys/secrets: $API_KEYS (target: 0)"

# Backend checks
echo "🔧 Backend:"
RAW_SQL=$(grep -rE "db\.Pool\.Query|db\.Pool\.Exec" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
LOG_PRINTF=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
echo "  ⚠ Raw SQL violations: $RAW_SQL (target: 0)"
echo "  ⚠ log.Printf usage: $LOG_PRINTF (target: 0)"

# Frontend checks
echo ""
echo "🎨 Frontend:"
# Exclude data URL fetch (marked with inline comment) - these don't require useApi()
RAW_FETCH=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | grep -v "data-url-fetch" | wc -l)
HARDCODED_COLORS=$(grep -rE 'text-\[#|bg-\[#|style.*color:' web/components --include="*.tsx" 2>/dev/null | wc -l)
NATIVE_SELECT=$(grep -rE '<select[^>]*>|<option[^>]*>' web/app web/components --include="*.tsx" 2>/dev/null | grep -v "SelectTrigger\|SelectContent\|SelectItem\|SelectValue\|SelectGroup" | wc -l)
echo "  ⚠ Raw fetch() calls: $RAW_FETCH (target: 0)"
echo "  ✓ Hardcoded colors: $HARDCODED_COLORS (target: 0)"
echo "  ⚠ Native <select> elements: $NATIVE_SELECT (target: 0, use shadcn Select)"

# Database checks
echo ""
echo "🗄️ Database:"
# Exclude known legitimate text IDs:
# - clerk_user_id/user_id: External Clerk system IDs
# - overture_id: External Overture Maps IDs
# - entity_id: Polymorphic references in actions table
VARCHAR_FKS=$(grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql 2>/dev/null | grep -v "languages.code" | grep -v "clerk_user_id" | grep -v "overture_id" | grep -v "entity_id" | grep -v "user_id text" | wc -l)
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
TOTAL_VIOLATIONS=$((DB_CONN_STRINGS + API_KEYS + RAW_SQL + LOG_PRINTF + RAW_FETCH + HARDCODED_COLORS + NATIVE_SELECT + VARCHAR_FKS + MISSING_PARALLEL))
if [ $TOTAL_VIOLATIONS -eq 0 ]; then
  echo "✅ All checks passed! Codebase is compliant."
  exit 0
else
  echo "⚠️  Total violations: $TOTAL_VIOLATIONS"
  echo ""
  echo "Details:"
  if [ $DB_CONN_STRINGS -gt 0 ]; then
    echo ""
    echo "⚠️  CRITICAL: Hardcoded database connection strings found:"
    grep -rn -E "postgresql://[^\"]*:[^\"]*@" api web --include="*.go" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | grep -v ".env.example" | grep -v "docs/"
  fi
  if [ $API_KEYS -gt 0 ]; then
    echo ""
    echo "⚠️  CRITICAL: Hardcoded API keys/secrets found:"
    grep -rn -E "(sk_live_|sk_prod_|AKIA|AIza)" api web --include="*.go" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules 2>/dev/null | grep -v ".env.example" | grep -v "docs/"
  fi
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
  if [ $NATIVE_SELECT -gt 0 ]; then
    echo ""
    echo "Native <select> violations (use shadcn Select instead):"
    grep -rn -E '<select[^>]*>|<option[^>]*>' web/app web/components --include="*.tsx" 2>/dev/null | grep -v "SelectTrigger\|SelectContent\|SelectItem\|SelectValue\|SelectGroup" | head -10
  fi
  echo ""
  echo "Run 'scripts/fix-compliance.sh' to auto-fix simple violations."
  exit 1
fi
