# Technical Debt Remediation Plan

**Created:** 2025-12-18
**Status:** Ready for Implementation
**Total Violations:** 45

---

## Executive Summary

This plan addresses all technical debt identified by `scripts/check-compliance.sh`. Each task includes:
- Exact file locations and line numbers
- Step-by-step implementation instructions
- Verification commands to confirm completion

---

## Verification Protocol

### Pre-Implementation Baseline
```bash
# Run this BEFORE starting any work to establish baseline
bash scripts/check-compliance.sh 2>&1 | tee /tmp/debt-baseline.txt
```

### Post-Implementation Verification
```bash
# Run this AFTER completing ALL tasks
bash scripts/check-compliance.sh 2>&1 | tee /tmp/debt-after.txt

# Compare results
diff /tmp/debt-baseline.txt /tmp/debt-after.txt

# Expected final output:
# ✅ All checks passed! Codebase is compliant.
```

### Per-Task Verification
Each task below includes a specific verification command. Run it after completing that task.

---

## Task 1: Frontend - Native Select Elements (21 violations)

**Priority:** HIGH
**Estimated Effort:** Medium
**Verification:** `grep -rE '<select[^>]*>|<option[^>]*>' web/app web/components --include="*.tsx" | grep -v "Select" | wc -l` → Should be `0`

### 1.1 MonthPreview.tsx (2 violations)

**File:** `web/components/publisher/MonthPreview.tsx`
**Lines:** 159, 170

**Current Code Pattern:**
```tsx
<select ...>
  <option key={month} value={index}>{month}</option>
</select>
```

**Required Change:**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem key={month} value={index.toString()}>{month}</SelectItem>
  </SelectContent>
</Select>
```

**Verification:**
```bash
grep -n '<select\|<option' web/components/publisher/MonthPreview.tsx | wc -l
# Expected: 0
```

---

### 1.2 WeekPreview.tsx (4 violations)

**File:** `web/components/publisher/WeekPreview.tsx`
**Lines:** 398, 406, 430, 438

**Implementation Notes:**
- Contains both Gregorian and Hebrew date selectors
- Hebrew selectors need `dir="rtl"` and `font-hebrew` class
- Four `<select>` elements total: year, month, Hebrew month, Hebrew year

**Verification:**
```bash
grep -n '<select\|<option' web/components/publisher/WeekPreview.tsx | wc -l
# Expected: 0
```

---

### 1.3 ZmanimDisplay.tsx (12 violations)

**File:** `web/components/ZmanimDisplay.tsx`
**Lines:** 439-440, 450-451, 461-468

**Implementation Notes:**
- Three separate selectors: elevation mode (2 options), another elevation mode, calculation method (8 options)
- Use `SelectGroup` and `SelectLabel` if grouping options

**Verification:**
```bash
grep -n '<select\|<option' web/components/ZmanimDisplay.tsx | wc -l
# Expected: 0
```

---

### 1.4 WeeklyPreviewDialog.tsx (3 violations)

**File:** `web/components/algorithm/WeeklyPreviewDialog.tsx`
**Lines:** 172, 194, 215

**Implementation Notes:**
- Year selector, month selector, day selector
- Inside a Dialog component - ensure Select portal renders correctly

**Verification:**
```bash
grep -n '<select\|<option' web/components/algorithm/WeeklyPreviewDialog.tsx | wc -l
# Expected: 0
```

---

## Task 2: Frontend - Raw fetch() (1 violation)

**Priority:** MEDIUM
**Estimated Effort:** Low
**Verification:** `grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l` → Should be `0`

### 2.1 LogoUpload.tsx

**File:** `web/components/publisher/LogoUpload.tsx`
**Line:** 150

**Current Code:**
```tsx
const response = await fetch(dataUrl);
```

**Context:** This appears to be fetching a data URL (blob), not an API call. Review the context:
- If it's converting a data URL to blob, this is acceptable (not an API call)
- Add a comment explaining why this is not using `useApi()`

**Required Change:**
```tsx
// Note: This fetch converts a data URL to a Blob, not an API call
// Data URLs are local and don't require authentication
const response = await fetch(dataUrl);
```

**Alternative:** If the compliance check should ignore data URL fetches, update the regex in `check-compliance.sh`:
```bash
RAW_FETCH=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | grep -v "// data-url-fetch" | wc -l)
```

**Verification:**
```bash
grep -n "await fetch(" web/components/publisher/LogoUpload.tsx
# Expected: Line 150 with explanatory comment, or excluded from check
```

---

## Task 3: Backend - Raw SQL in Services (11 violations)

**Priority:** HIGH
**Estimated Effort:** High
**Verification:** `grep -rE "db\.Pool\.Query|db\.Pool\.Exec|db\.Pool\.QueryRow" api/internal/services --include="*.go" | wc -l` → Should be `0`

### 3.1 publisher_service.go (5 violations)

**File:** `api/internal/services/publisher_service.go`
**Lines:** 64, 101, 126, 160, 192

**Implementation Steps:**
1. Create SQLc queries in `api/internal/db/queries/publishers.sql`
2. Run `cd api && sqlc generate`
3. Replace raw SQL with generated SQLc methods
4. Ensure dynamic query building uses safe patterns

**Example Migration:**

**Before (line 64):**
```go
rows, err := s.db.Pool.Query(ctx, query, args...)
```

**After:**
```go
// In queries/publishers.sql:
// -- name: ListPublishersFiltered :many
// SELECT ... FROM publishers WHERE ...

results, err := s.db.Queries.ListPublishersFiltered(ctx, params)
```

**Note:** Some queries may use dynamic filtering. Consider:
- Multiple SQLc queries for common filter combinations
- Or a builder pattern that generates safe SQL

**Verification:**
```bash
grep -n "db.Pool" api/internal/services/publisher_service.go | wc -l
# Expected: 0
```

---

### 3.2 algorithm_service.go (3 violations)

**File:** `api/internal/services/algorithm_service.go`
**Lines:** 54, 116, 137

**Verification:**
```bash
grep -n "db.Pool" api/internal/services/algorithm_service.go | wc -l
# Expected: 0
```

---

### 3.3 zmanim_service.go (3 violations)

**File:** `api/internal/services/zmanim_service.go`
**Lines:** 128, 175, 228

**Verification:**
```bash
grep -n "db.Pool" api/internal/services/zmanim_service.go | wc -l
# Expected: 0
```

---

## Task 4: Testing - Missing Parallel Mode (2 violations)

**Priority:** LOW
**Estimated Effort:** Low
**Verification:** `find tests/e2e -name "*.spec.ts" -exec grep -L "test.describe.configure.*parallel" {} \; | wc -l` → Should be `0`

### 4.1 publisher-switcher.spec.ts

**File:** `tests/e2e/publisher/publisher-switcher.spec.ts`

**Required Change:** Add at the top of the file (after imports):
```typescript
test.describe.configure({ mode: 'parallel' });
```

**Verification:**
```bash
grep -c "test.describe.configure.*parallel" tests/e2e/publisher/publisher-switcher.spec.ts
# Expected: 1
```

---

### 4.2 publisher-lifecycle.spec.ts

**File:** `tests/e2e/publisher/publisher-lifecycle.spec.ts`

**Required Change:** Add at the top of the file (after imports):
```typescript
test.describe.configure({ mode: 'parallel' });
```

**Verification:**
```bash
grep -c "test.describe.configure.*parallel" tests/e2e/publisher/publisher-lifecycle.spec.ts
# Expected: 1
```

---

## Task 5: Database - VARCHAR Foreign Keys (10 false positives)

**Priority:** INFORMATIONAL
**Status:** Review and whitelist legitimate cases

### Analysis

The 10 violations detected are NOT actual violations:

| Column | Table | Reason for VARCHAR |
|--------|-------|-------------------|
| `user_id text` | actions | Clerk user ID (external system) |
| `entity_id text` | actions | Polymorphic - can reference any entity |
| `overture_id text` | geo_* tables | External Overture Maps ID |
| `clerk_user_id text` | various | External Clerk system ID |

**Action Required:** Update `check-compliance.sh` to exclude known legitimate patterns:

```bash
VARCHAR_FKS=$(grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql 2>/dev/null | \
  grep -v "languages.code" | \
  grep -v "overture_id" | \
  grep -v "clerk_user_id" | \
  grep -v "entity_id.*-- polymorphic" | \
  grep -v "user_id.*-- clerk" | \
  wc -l)
```

**Verification:**
```bash
# After updating check-compliance.sh
bash scripts/check-compliance.sh 2>&1 | grep "VARCHAR foreign keys"
# Expected: ✓ VARCHAR foreign keys: 0 (target: 0)
```

---

## Implementation Order

Recommended sequence for minimal risk:

| Order | Task | Risk | Dependencies |
|-------|------|------|--------------|
| 1 | Task 4: Test parallel mode | None | None |
| 2 | Task 5: Update compliance script | None | None |
| 3 | Task 2: LogoUpload fetch | Low | None |
| 4 | Task 1.1: MonthPreview | Low | None |
| 5 | Task 1.4: WeeklyPreviewDialog | Low | None |
| 6 | Task 1.2: WeekPreview | Medium | Test after 1.1 |
| 7 | Task 1.3: ZmanimDisplay | Medium | None |
| 8 | Task 3: Raw SQL services | High | SQLc knowledge |

---

## Final Verification Checklist

After ALL tasks complete, run:

```bash
#!/bin/bash
# Save as scripts/verify-debt-cleared.sh

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
    NATIVE_SELECT=$(grep -rE '<select[^>]*>|<option[^>]*>' web/app web/components --include="*.tsx" 2>/dev/null | grep -v "Select" | wc -l)
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
    cd web && npm run type-check && echo "  TypeScript: ✅" || echo "  TypeScript: ❌"

    # Build check
    echo ""
    echo "Running build..."
    cd ../api && go build -v ./cmd/api ./internal/... 2>&1 | tail -1

    echo ""
    echo "✅ Verification complete"
else
    echo ""
    echo "❌ TECHNICAL DEBT REMAINS"
    echo "Review the violations above and continue remediation."
    exit 1
fi
```

---

## Appendix: File Index

| File | Violations | Type |
|------|------------|------|
| `web/components/publisher/MonthPreview.tsx` | 2 | Native select |
| `web/components/publisher/WeekPreview.tsx` | 4 | Native select |
| `web/components/ZmanimDisplay.tsx` | 12 | Native select |
| `web/components/algorithm/WeeklyPreviewDialog.tsx` | 3 | Native select |
| `web/components/publisher/LogoUpload.tsx` | 1 | Raw fetch |
| `api/internal/services/publisher_service.go` | 5 | Raw SQL |
| `api/internal/services/algorithm_service.go` | 3 | Raw SQL |
| `api/internal/services/zmanim_service.go` | 3 | Raw SQL |
| `tests/e2e/publisher/publisher-switcher.spec.ts` | 1 | Missing parallel |
| `tests/e2e/publisher/publisher-lifecycle.spec.ts` | 1 | Missing parallel |

---

## Agent Instructions

When implementing this plan:

1. **Start each session** by running `bash scripts/check-compliance.sh` to see current state
2. **Work through tasks** in the recommended order
3. **After each task**, run the task-specific verification command
4. **After all tasks**, run `bash scripts/check-compliance.sh` to confirm zero violations
5. **Run builds** before committing:
   ```bash
   cd web && npm run type-check
   cd ../api && go build -v ./cmd/api ./internal/...
   ```
6. **Commit incrementally** with clear messages per task area
