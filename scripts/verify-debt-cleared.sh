#!/bin/bash
# Technical Debt Verification Script
# Run this after completing all remediation tasks from docs/plans/technical-debt-remediation.md

set -e

echo "=== Technical Debt Verification ==="
echo ""

# Run full compliance check
bash scripts/check-compliance.sh
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ ALL TECHNICAL DEBT CLEARED"
    echo ""
    echo "Additional verification:"

    # Frontend checks
    NATIVE_SELECT=$(grep -rE '<select[^>]*>|<option[^>]*>' web/app web/components --include="*.tsx" 2>/dev/null | grep -v "SelectTrigger\|SelectContent\|SelectItem\|SelectValue\|SelectGroup" | wc -l)
    echo "  Native <select> elements: $NATIVE_SELECT (expected: 0)"

    # Backend checks
    RAW_SQL=$(grep -rE "db\.Pool\.(Query|Exec|QueryRow)" api/internal/services --include="*.go" 2>/dev/null | wc -l)
    echo "  Raw SQL in services: $RAW_SQL (expected: 0)"

    # Test checks
    MISSING_PARALLEL=$(find tests/e2e -name "*.spec.ts" -exec grep -L "test.describe.configure.*parallel" {} \; 2>/dev/null | wc -l)
    echo "  Tests missing parallel: $MISSING_PARALLEL (expected: 0)"

    # Type check
    echo ""
    echo "Running type check..."
    cd web && npm run type-check --silent && echo "  TypeScript: ✅" || echo "  TypeScript: ❌"
    cd ..

    # Build check
    echo ""
    echo "Running Go build..."
    cd api && go build -v ./cmd/api 2>&1 | tail -1 && echo "  Go build: ✅" || echo "  Go build: ❌"
    cd ..

    echo ""
    echo "✅ Verification complete"
    exit 0
else
    echo ""
    echo "❌ TECHNICAL DEBT REMAINS"
    echo ""
    echo "Review the violations above and continue remediation."
    echo "See: docs/plans/technical-debt-remediation.md"
    exit 1
fi
