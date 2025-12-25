#!/bin/bash
# Run Phase 2 of the HebCal Tag Coverage Audit
# Tests all HebCal events against the database matching function

set -e

cd "$(dirname "$0")/.."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable not set"
    echo "Set it by running: source api/.env"
    exit 1
fi

echo "=== HebCal Tag Matching Audit (Phase 2) ==="
echo ""
echo "This test will:"
echo "1. Collect events from HebCal for years 5775-5785"
echo "2. Test each event against the database matching function"
echo "3. Generate a CSV report with match results"
echo ""

cd api

# Run the matching audit test
echo "Running audit test..."
go test -v -timeout=10m ./internal/calendar -run=TestHebCalTagMatching

echo ""
echo "=== Audit Complete ==="
echo "Results written to:"
echo "  - _bmad-output/hebcal-audit-match-results.csv (detailed match results)"
echo "  - _bmad-output/hebcal-audit-summary.md (executive summary)"
echo "  - _bmad-output/hebcal-audit-unused-tags.md (reverse gap - unused tags)"
echo ""
echo "To analyze results, open the files or check the test output above."
