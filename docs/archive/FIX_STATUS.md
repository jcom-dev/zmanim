# Database Normalization Fix Status

**Last Updated:** 2025-12-07
**Status:** 90% Complete - SQL Errors Remain

---

## ✅ Completed

### 1. Schema Migration
- ✅ Added `description` column to `tag_types` table
- ✅ All lookup tables exist with proper structure
- ✅ Foreign key constraints in place

### 2. SQL Files Updated
- ✅ `publishers.sql` - Fully normalized (pending minor fixes)
- ✅ `algorithms.sql` - Fully normalized (pending minor fixes)
- ✅ `coverage.sql` - Fully normalized and working
- ✅ `admin.sql` - Fully normalized (pending minor fixes)
- ✅ `lookups.sql` - Created and working
- ✅ `zmanim.sql` - Fully normalized by agent
- ✅ `master_registry.sql` - Partially normalized by agent
- ✅ `zman_requests.sql` - Partially normalized by agent
- ✅ `tag_events.sql` - Partially normalized by agent
- ✅ `publisher_snapshots.sql` - Partially normalized by agent
- ✅ `geo_boundaries.sql` - Fully normalized by agent

---

## ⚠️ Remaining SQLc Errors (25 total)

### Type 1: Ambiguous Column References (9 errors)
These occur in subqueries where SQLc can't determine which table the column belongs to.

**Files affected:**
- `admin.sql:39` - `column reference "id" is ambiguous`
- `algorithms.sql:80, 102` - `column reference "id" is ambiguous`
- `master_registry.sql:410` - `column reference "key" is ambiguous`
- `master_registry.sql:445` - `column reference "id" is ambiguous`
- `publishers.sql:84, 138` - `column reference "id" is ambiguous`
- `zman_requests.sql:118, 131` - `column reference "id" is ambiguous`

**Fix:** Add table alias to subquery columns
```sql
-- Before
WHERE id = (SELECT id FROM statuses WHERE key = 'active')

-- After
WHERE table.id = (SELECT s.id FROM statuses s WHERE s.key = 'active')
```

### Type 2: sqlc.narg Column Resolution (1 error)
- `publishers.sql:100` - `column "name" does not exist`

**Fix:** This is a known sqlc issue with named arguments in UPDATE SET clauses. May need to use positional parameters instead.

### Type 3: Missing Normalized Columns (15 errors)

**`master_registry.sql` (11 errors) - column "category" does not exist:**
- Lines: 165, 200, 249, 285, 304, 317, 480, 491, 497, 506
- Agent partially updated but missed some queries
- **Fix:** Change `category` → `time_category_id` and add JOINs

**`publisher_snapshots.sql` (4 errors) - column "source_type" does not exist:**
- Lines: 72, 106, 147, 171
- Agent partially updated but missed some queries
- **Fix:** Change `source_type` → `source_type_id` and add JOINs

**`zman_requests.sql` (1 error) - column "category" does not exist:**
- Line: 281
- **Fix:** Change `category` → `time_category_id`

---

## 🔧 Quick Fix Commands

### Fix Ambiguous IDs in Subqueries
```bash
# These need manual review - each is in a different context
# Example pattern for admin.sql:39
sed -i 's/WHERE id = \$1/WHERE publishers.id = $1/' api/internal/db/queries/admin.sql
```

### Fix Remaining category/source_type References
```bash
# Find all remaining occurrences
grep -n "category" api/internal/db/queries/master_registry.sql | grep -v "time_category"
grep -n "source_type" api/internal/db/queries/publisher_snapshots.sql | grep -v "source_type_id"
```

---

## 📋 Next Steps (In Order)

1. **Fix Remaining SQL Errors** (25 errors)
   - Manually fix ambiguous column references (add table aliases)
   - Complete normalization in master_registry.sql
   - Complete normalization in publisher_snapshots.sql
   - Fix sqlc.narg issue in publishers.sql

2. **Regenerate SQLc Models**
   ```bash
   cd api && ~/go/bin/sqlc generate
   ```

3. **Fix Go Code Compilation Errors**
   - Update handlers to use new struct fields (status_id instead of status)
   - Update services for status transitions
   - Fix any type mismatches

4. **Create Lookup API Handler**
   - Already have `lookups.sql` queries
   - Create `api/internal/handlers/lookups.go`
   - Register routes in main

5. **Test Backend**
   ```bash
   cd api && go build ./...
   cd api && go test ./...
   ```

6. **Update Frontend** (Can be done in parallel)
   - Update TypeScript types
   - Update components to use nested status objects
   - Create useLookupData hooks
   - Update all status/level/type displays

7. **Integration Testing**
   - Test all CRUD operations
   - Verify lookups work correctly
   - Check Hebrew/English switching

---

## 📁 File Status Summary

| File | Lines Changed | Status | Errors |
|------|---------------|--------|--------|
| `publishers.sql` | ~120 | 95% | 3 |
| `algorithms.sql` | ~80 | 95% | 2 |
| `coverage.sql` | ~100 | 100% | 0 |
| `admin.sql` | ~60 | 95% | 1 |
| `lookups.sql` | ~120 (new) | 100% | 0 |
| `zmanim.sql` | ~150 | 100% | 0 |
| `master_registry.sql` | ~200 | 70% | 12 |
| `zman_requests.sql` | ~100 | 90% | 3 |
| `tag_events.sql` | ~80 | 95% | 0 |
| `publisher_snapshots.sql` | ~90 | 60% | 4 |
| `geo_boundaries.sql` | ~50 | 100% | 0 |
| **TOTAL** | **~1,150** | **88%** | **25** |

---

## 💡 Lessons Learned

1. **Agents are great for bulk work** but miss edge cases
2. **SQLc is strict** about column ambiguity in subqueries
3. **Named parameters (sqlc.narg)** don't work well in UPDATE SET clauses
4. **Systematic approach needed** - fixing one file at a time is more reliable than parallel agents

---

## ⏱️ Estimated Remaining Time

- Fix 25 SQL errors: **1-2 hours** (careful manual fixes)
- Regenerate SQLc: **5 minutes**
- Fix Go compilation: **2-3 hours** (many files reference old fields)
- Create lookup handler: **30 minutes**
- Update frontend: **3-4 hours** (TypeScript + components)
- Testing: **2-3 hours**

**Total: 9-13 hours remaining**

---

## 🎯 Recommendation

**Option 1: Complete Fix Now (recommended for empty database)**
- Finish all 25 SQL errors
- Regenerate SQLc
- Fix Go code
- Deploy

**Option 2: Incremental Rollout**
- Fix critical paths first (publishers, algorithms, coverage)
- Leave less-used features for later
- Risk: Inconsistent data model

Given empty database status, **Option 1 is strongly recommended**.
