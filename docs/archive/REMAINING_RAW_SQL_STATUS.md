# Remaining Raw SQL Violations - Status

## Summary
- **Total raw SQL violations remaining:** 30 in master_registry.go
- **Coverage.go:** FIXED ✅
- **Onboarding.go:** FIXED ✅
- **All other handlers:** CLEAN ✅

## Current Build Errors

The main issues are **type mismatches** between SQLc-generated types and handler struct types:

### 1. Type Conversion Errors (lines 920, 974, etc.)
- SQLc returns `int32` but handler expects `string` for IDs
- SQLc returns `*int32` for nullable fields but handler uses `int`
- SQLc returns `pgtype.Timestamptz` but handler uses `time.Time`
- SQLc returns `*string` but handler uses `string` directly

### 2. Root Cause
These type mismatches exist because:
- Handler structs (like `DayType`, `ZmanVersion`) were written for raw SQL
- SQLc generates proper typed structs with correct nullability
- Need conversion layer between SQLc output and handler response types

## Two Paths Forward

### Option A: Fix Type Conversions (Current Approach - 90% done)
Continue fixing type conversions in master_registry.go. Estimated remaining:
- 5-10 more type conversion fixes needed
- Add helper functions for common conversions (int32→string, pgtype→time.Time)
- Total time: ~15 more minutes

### Option B: Use SQLc Types Directly (Better long-term)
Refactor handler response types to match SQLc-generated types:
- Change handler structs to use SQLc types
- Remove custom type conversion code
- More aligned with coding standards
- Total time: ~30 minutes but cleaner result

## Recommendation

**Continue with Option A** since we're 90% done. After all raw SQL is eliminated, we can refactor response types in a separate cleanup task.

## Next Steps

1. Fix remaining type conversion errors in master_registry.go (lines 920, 974, etc.)
2. Add helper functions:
   - `int32ToString()` - already exists in utils.go ✅
   - `timestamptzToTime(pgtype.Timestamptz) time.Time`
   - `int32PtrToInt(*int32) int` - already exists in utils.go ✅
3. Build and verify
4. Check for remaining raw SQL: `grep -c "Pool\." master_registry.go` should be 0

## Violations Location
All 30 remaining violations are in `/home/daniel/repos/zmanim/api/internal/handlers/master_registry.go`

Lines with raw SQL still present:
```
1082, 1107, 1154, 1193, 1254, 1298, 1363, 1378, 1426, 1539,
1564, 1574, 1602, 1614, 2471, 2482, 2524, 2581, 2605, 2629,
2703, 2736, 2850, 2869, 2876, 2933, 2947, 2983, 3039, 3080
```

Most of these have corresponding SQLc queries already created - they just need to be hooked up with proper type conversions.
