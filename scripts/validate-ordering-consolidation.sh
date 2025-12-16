#!/bin/bash
# Run this after implementation to verify consolidation is complete

# Change to project root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== VALIDATION: Zmanim Ordering Consolidation ==="
echo ""

PASS=0
FAIL=0

# Test 1: No hardcoded category order maps in Go handlers
echo "Test 1: No hardcoded timeCategoryOrder maps in handlers..."
RESULT=$(rg "timeCategoryOrder\s*=" api/internal/handlers/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded category maps in handlers"
  ((PASS++))
else
  echo "  ❌ FAIL: Found hardcoded category maps:"
  rg "timeCategoryOrder\s*=" api/internal/handlers/ -l
  ((FAIL++))
fi

# Test 2: No CASE statements for category ordering in SQL
echo "Test 2: No CASE statements for time category ordering..."
RESULT=$(rg "WHEN 'dawn' THEN 1" api/internal/db/queries/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No hardcoded CASE ordering in SQL"
  ((PASS++))
else
  echo "  ❌ FAIL: Found CASE ordering:"
  rg "WHEN 'dawn' THEN 1" api/internal/db/queries/ -l
  ((FAIL++))
fi

# Test 3: SQL uses sort_order column
echo "Test 3: SQL queries use tc.sort_order..."
RESULT=$(grep -r "sort_order" api/internal/db/queries/*.sql -l 2>/dev/null | wc -l)
if [ "$RESULT" -ge 3 ]; then
  echo "  ✅ PASS: SQL uses sort_order column ($RESULT files)"
  ((PASS++))
else
  echo "  ⚠️  WARNING: May not be using sort_order in all queries (found $RESULT files)"
  ((FAIL++))
fi

# Test 4: No categoryOrder in frontend (except utility)
echo "Test 4: No categoryOrder objects in frontend app/components..."
RESULT=$(rg "categoryOrder\s*[:=]" web/app/ web/components/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No categoryOrder in frontend"
  ((PASS++))
else
  echo "  ❌ FAIL: Found categoryOrder:"
  rg "categoryOrder\s*[:=]" web/app/ web/components/ -l
  ((FAIL++))
fi

# Test 5: No sortOrderRef in frontend
echo "Test 5: No complex sorting refs in frontend..."
RESULT=$(rg "sortOrderRef|lastSortContextRef" web/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No complex sorting refs"
  ((PASS++))
else
  echo "  ❌ FAIL: Found sorting refs:"
  rg "sortOrderRef|lastSortContextRef" web/ -l
  ((FAIL++))
fi

# Test 6: No name_english/name_hebrew
echo "Test 6: Consistent field naming (english_name not name_english)..."
RESULT=$(rg '"name_english"|"name_hebrew"' api/internal/handlers/ -l 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: Consistent naming"
  ((PASS++))
else
  echo "  ❌ FAIL: Found inconsistent naming:"
  rg '"name_english"|"name_hebrew"' api/internal/handlers/ -l
  ((FAIL++))
fi

# Test 7: No deprecated category field
echo "Test 7: No deprecated 'category' field in API responses..."
RESULT=$(rg 'json:"category"' api/internal/handlers/publisher_zmanim.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: No deprecated category field"
  ((PASS++))
else
  echo "  ❌ FAIL: Found deprecated category field"
  ((FAIL++))
fi

# Test 8: ZmanimOrderingService exists
echo "Test 8: ZmanimOrderingService exists..."
if [ -f "api/internal/services/zmanim_ordering.go" ]; then
  echo "  ✅ PASS: Ordering service exists"
  ((PASS++))
else
  echo "  ❌ FAIL: Ordering service not found"
  ((FAIL++))
fi

# Test 9: Timestamp field in responses
echo "Test 9: Timestamp field in zman responses..."
RESULT_ZMANIM=$(grep -c 'Timestamp' api/internal/handlers/zmanim.go 2>/dev/null || echo 0)
RESULT_PUB=$(grep -c 'Timestamp' api/internal/handlers/publisher_zmanim.go 2>/dev/null || echo 0)
if [ "$RESULT_ZMANIM" -ge 1 ] && [ "$RESULT_PUB" -ge 1 ]; then
  echo "  ✅ PASS: Timestamp field present in zmanim.go ($RESULT_ZMANIM) and publisher_zmanim.go ($RESULT_PUB)"
  ((PASS++))
else
  echo "  ❌ FAIL: Timestamp field not found (zmanim.go: $RESULT_ZMANIM, publisher_zmanim.go: $RESULT_PUB)"
  ((FAIL++))
fi

# Test 10: Deprecated types deleted
echo "Test 10: Deprecated types removed..."
RESULT=$(rg "type ZmanResponse struct|type ZmanimListResponse struct" api/internal/handlers/types.go 2>/dev/null | wc -l)
if [ "$RESULT" -eq 0 ]; then
  echo "  ✅ PASS: Deprecated types removed"
  ((PASS++))
else
  echo "  ❌ FAIL: Deprecated types still exist"
  ((FAIL++))
fi

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -eq 0 ]; then
  echo "✅ ALL VALIDATION TESTS PASSED"
  exit 0
else
  echo "❌ SOME TESTS FAILED - Review and fix before completing"
  exit 1
fi
