# Comprehensive Scope Analysis: Removing tag_type_id = 4 ("category")

## Executive Summary

The codebase has **tag_type_id = 4 ("category")** entries used for UI categorization of zmanim (e.g., candle_lighting, havdalah, fast_start). This analysis identifies all code, database, and configuration files that depend on this tag type and must be modified during removal.

**Total Files Affected: 38 files across 4 categories**

---

## 1. DATABASE SCHEMA & MIGRATIONS (4 files)

### Core Schema Definition
- **`db/migrations/00000000000001_schema.sql`**
  - Line 46: `hebcal_match_type` ENUM includes 'category' value
  - Line 3979: `CREATE TABLE tag_types` definition with tag_type_id = 4
  - Lines 4045-4080: `CREATE TABLE zman_tags` with `tag_type_id` NOT NULL column and foreign key constraint
  - Lines 3098-3200: `CREATE TABLE master_zmanim_registry` with `time_category_id` column
  - Lines 3742-3850: `CREATE TABLE publisher_zmanim` with `time_category_id` column
  - Lines 5180, 5228, 5366, 5390: Indexes and FK constraints on `tag_type_id`

### Seed Data
- **`db/migrations/00000000000002_seed_data.sql`**
  - Line 560: INSERT row for tag_type_id = 4 entry: `('category', 'קטגוריה', 'Category', 'gray', NULL, 4)`
  - Lines 580-603: **11 category tag insertions** with tag_type_id = 4:
    - `category_candle_lighting` (ID 15)
    - `category_havdalah` (ID 2)
    - `category_fast_start` (ID 16)
    - `category_fast_end` (ID 1)
    - `category_chametz` (ID 13)
    - `category_shema` (ID 10)
    - `category_tefila` (ID 11)
    - `category_mincha` (ID 12)
    - `category_kiddush_levana` (ID 14)
    - `category_tisha_bav_fast_start` (ID 24)
    - `category_tisha_bav_fast_end` (ID 25)

### Related Tables
- **`db/migrations/00000000000001_schema.sql` (continued)**
  - Lines 4009-4050: `CREATE TABLE time_categories` - UI grouping table (separate concept from tag_type_id = 4)
  - Lines 2306-2340: `CREATE TABLE display_groups` - UI display grouping table

---

## 2. BACKEND GO CODE (12 files)

### Category Configuration & Logic
- **`api/internal/calendar/category_mappings.go`** (ENTIRE FILE TO REMOVE/REFACTOR)
  - Lines 3-39: Defines `CategoryTagConfig` struct and `CategoryTags` array
  - Functions:
    - `CategoryTagToDisplayGroup()` - Maps category tags to display groups
    - `GetCategoryTagKeys()` - Returns slice of all category tag keys
  - **5 hardcoded category tags:**
    - category_candle_lighting → candles
    - category_havdalah → havdalah
    - category_fast_start → fast_day
    - category_fast_end → fast_day
    - category_chametz → pesach

### Event Processing
- **`api/internal/calendar/events.go`**
  - Line 550: Comment about "category tags (category_candle_lighting, category_havdalah, etc.)"

### HTTP Handlers
- **`api/internal/handlers/master_registry.go`**
  - Line 67: JSON tag field includes "e.g., category_candle_lighting"
  - Lines 706-751: `GetEventZmanimGrouped()` function uses:
    - Line 721: `categoryTagMap := calendar.CategoryTagToDisplayGroup()`
    - Lines 729-731: Filters tags with `TagType == "category"`
    - Lines 727-735: Groups zmanim by category tags from the map

### Service Layer
- **`api/internal/services/zmanim_service.go`**
  - Lines 216-224: `NewZmanimService()` loads time_categories table
  - Lines 227-231: Comment explains category filtering is now via tag system (legacy note)
  - Line 228: References "Category tags (category_candle_lighting, etc.)"

- **`api/internal/services/complete_export_service.go`**
  - Lines 110-112: Export struct fields reference category:
    - `Category string`
    - `CategoryDisplayHebrew string`
    - `CategoryDisplayEnglish string`

- **`api/internal/services/snapshot_service.go`**
  - Line 494: Comment about time_category_id from zmanim with same category

### Onboarding Handler
- **`api/internal/handlers/onboarding.go`**
  - Lines 25, 61-67: `WizardZman` struct has `TimeCategory string` field
  - Lines 136-167: Creates master/publisher zmanim with `TimeCategoryID`
  - Line 143: Queries `GetTimeCategoryByKey()`

### Zmanim Handler
- **`api/internal/handlers/publisher_zmanim.go`**
  - Line 48: `TimeCategory` field in `PublisherZmanWithTime` struct
  - Lines 129-131: `GetTimeCategory()` method
  - Lines 973, 1116, 1185: Sets `TimeCategory` in responses

### Tests
- **`api/internal/calendar/events_tag_driven_test.go`**
  - Lines 299-330: `TestCategoryTagConfiguration()` function
  - Validates category_mappings.go has expected 5 category tags
  - Checks for hardcoded switch/case statements

- **`api/internal/calendar/hidden_tags_test.go`**
  - Likely references hidden category tags (verify content)

- **`api/internal/handlers/zmanim_integration_test.go`**
  - Tests may reference category functionality

### RAG Indexer
- **`api/cmd/rag-indexer/main.go`**
  - May index category tag metadata

---

## 3. SQL QUERY FILES (12 files)

All query files have multiple references to `time_category_id` (NOT tag_type_id = 4, but related):

- **`api/internal/db/queries/categories.sql`**
  - Lines 1-71: Queries for time_categories and display_groups (different from tag_type_id = 4)

- **`api/internal/db/queries/master_registry.sql`**
  - 15+ JOIN clauses with `time_categories` table
  - Multiple subqueries selecting from time_categories

- **`api/internal/db/queries/zmanim.sql`**
  - 13+ references to `time_category_id` and time_categories table

- **`api/internal/db/queries/zmanim_unified.sql`**
  - Multiple time_categories JOINs

- **`api/internal/db/queries/zmanim_simplified.sql`**
  - 4+ time_categories references

- **`api/internal/db/queries/tag_events.sql`**
  - Lines 150, 173: JOINs with time_categories

- **`api/internal/db/queries/zman_requests.sql`**
  - 4+ time_categories references

- **`api/internal/db/queries/publisher_reports.sql`**
  - Lines 132-135: JOINs with time_categories

- **`api/internal/db/queries/publisher_snapshots.sql`**
  - Lines 76, 111, 276, 432: time_categories references

- **`api/internal/db/queries/external_api.sql`**
  - Line 42: LEFT JOIN with time_categories

- **`api/internal/db/queries/onboarding.sql`**
  - References time_categories table

---

## 4. GENERATED SQLC GO FILES (9 files)

Auto-generated from SQL queries. These will be **regenerated by `sqlc generate`**:

- **`api/internal/db/sqlcgen/categories.sql.go`**
  - All functions for time_categories and display_groups queries

- **`api/internal/db/sqlcgen/master_registry.sql.go`**
  - Generated query methods including time_category_id parameters

- **`api/internal/db/sqlcgen/zmanim.sql.go`**
  - Generated methods with time_category_id fields

- **`api/internal/db/sqlcgen/zmanim_unified.sql.go`**

- **`api/internal/db/sqlcgen/zmanim_simplified.sql.go`**

- **`api/internal/db/sqlcgen/tag_events.sql.go`**

- **`api/internal/db/sqlcgen/zman_requests.sql.go`**

- **`api/internal/db/sqlcgen/publisher_reports.sql.go`**

- **`api/internal/db/sqlcgen/external_api.sql.go`**

- **`api/internal/db/sqlcgen/models.go`**
  - TimeCategory model definition

- **`api/internal/db/sqlcgen/onboarding.sql.go`**

- **`api/internal/db/sqlcgen/querier.go`**
  - Interface methods for time_categories queries

---

## 5. FRONTEND CODE (3 files)

The frontend uses **time_categories table**, NOT tag_type_id = 4 directly, but provides UI for it:

- **`web/lib/hooks/useCategories.ts`**
  - Lines 36-46: `TimeCategory` interface definition
  - Lines 57-65: `DisplayGroup` interface definition
  - Lines 110-125: `useTimeCategories()` hook calls `/categories/time`
  - Lines 164-175: `useDisplayGroups()` hook calls `/categories/display-groups`
  - Lines 186-200: `useAllCategories()` utility hook
  - Lines 206-240: `useTimeCategoryByKey()` lookup hook
  - Lines 243-260: `useCategoryMaps()` creates lookup maps
  - Lines 275-295: `useDisplayGroupMapping()` maps time categories to display groups

- **`web/lib/icons.ts`**
  - Line 12: Example using TimeCategory in JSDoc
  - Lines 133-145: `getCategoryIcon()` generic function

- **`web/lib/halachic-glossary.ts`**
  - Lines 17, 31-201: Glossary terms with `category` field (NOT related to tag_type_id = 4)
  - Lines 249+: `getTermsByCategory()` function

---

## 6. TEST/VALIDATION FILES (3 files)

- **`tests/sql/registry-validation.sql`**
  - May validate category-related constraints

- **`_bmad-output/master-tags-restoration.sql`**
  - Backup of master registry tags (includes category tags)

- **`_bmad-output/publisher-tags-restoration.sql`**
  - Backup of publisher tags (includes category tags)

---

## KEY DEPENDENCIES & RELATIONSHIPS

### Conceptual Architecture
```
Tag System (zman_tags table):
├── tag_type_id = 1: "event" (e.g., shabbos, rosh_hashanah)
├── tag_type_id = 2: "timing" (e.g., morning, evening)
├── tag_type_id = 3: "shita" (e.g., gra, mga)
└── tag_type_id = 4: "category" ← TO BE REMOVED
    └── 11 instances (category_candle_lighting, etc.)

UI Organization (SEPARATE tables):
├── time_categories table (13 rows)
│   └── Used for: master_zmanim_registry.time_category_id
│       and: publisher_zmanim.time_category_id
└── display_groups table
    └── References time_categories via time_categories array field
```

### Foreign Key Dependencies
```
tag_type_id (tag_types.id = 4):
  ├── zman_tags.tag_type_id (FK constraint)
  │   └── 11 rows with tag_type_id = 4

time_category_id (time_categories.id):
  ├── master_zmanim_registry.time_category_id (FK constraint)
  ├── publisher_zmanim.time_category_id (FK constraint)
  └── zman_requests.time_category_id (FK constraint)
```

---

## REMOVAL IMPACT SUMMARY

### Database Changes Required
1. **Remove from tag_types seed**: 1 row (tag_type_id = 4)
2. **Remove from zman_tags seed**: 11 rows (all category_* tags)
3. **Remove category enum**: From hebcal_match_type ENUM in schema
4. **Remove foreign key constraints**: zman_tags.tag_type_id (not strictly necessary but good practice)

### Go Code Changes Required
1. **Delete entirely**: `api/internal/calendar/category_mappings.go`
2. **Remove/refactor**:
   - `api/internal/handlers/master_registry.go::GetEventZmanimGrouped()` (lines 706-751)
   - All references to `CategoryTagToDisplayGroup()` and `GetCategoryTagKeys()`
3. **Update**: All service layer references to category tags
4. **Update/Delete**: `TestCategoryTagConfiguration()` test

### SQL Query Changes Required
1. **No changes** to most query files - they reference `time_category_id` (different system)
2. **Verify**: Constraints and indexes on `tag_type_id` to ensure removal won't break anything

### Frontend Changes Required
- **No changes**: Frontend uses `time_categories` table, not tag_type_id = 4
- **Note**: `useCategories.ts` and related hooks will continue to work

---

## DETAILED FILE MODIFICATION CHECKLIST

### Phase 1: Database & Seed Data
- [ ] Remove tag_type_id = 4 from `db/migrations/00000000000002_seed_data.sql` (line 560)
- [ ] Remove 11 category_* tag insertions from seed_data.sql (lines 580-603)
- [ ] Add migration file to remove 'category' from hebcal_match_type ENUM
- [ ] Verify no foreign key violations for tag_type_id = 4 removal

### Phase 2: Go Code Cleanup
- [ ] Delete `api/internal/calendar/category_mappings.go` entirely
- [ ] Refactor `api/internal/handlers/master_registry.go::GetEventZmanimGrouped()` (remove category grouping logic)
- [ ] Remove `calendar.CategoryTagToDisplayGroup()` calls from master_registry handler
- [ ] Remove category tag references from event processing pipeline
- [ ] Delete `TestCategoryTagConfiguration()` from events_tag_driven_test.go
- [ ] Verify no other code imports category_mappings functions

### Phase 3: SQL Code Regeneration
- [ ] Run `cd api && sqlc generate`
- [ ] This will regenerate all 9 sqlcgen/*.go files

### Phase 4: Testing & Validation
- [ ] Run all tests: `./scripts/validate-ci-checks.sh`
- [ ] Run E2E tests if available
- [ ] Test API endpoints that reference categories
- [ ] Verify frontend still works with time_categories table

### Phase 5: Documentation
- [ ] Update CLAUDE.md if it references category functionality
- [ ] Update any architecture docs
- [ ] Remove category-related comments from code

---

## IMPORTANT NOTES

1. **time_categories ≠ tag_type_id = 4**
   - The `time_categories` table is a SEPARATE UI grouping system
   - It's not being removed - only tag_type_id = 4 rows are being removed

2. **Impact on Frontend**
   - Frontend is safe - it uses time_categories table
   - No frontend code changes needed

3. **Backward Compatibility**
   - Old `category` field in exports may need deprecation handling
   - Check if external integrations depend on category_* tags

4. **References in Comments**
   - Multiple comments reference category_* tags
   - Update comments during removal to clarify the architecture

5. **Backup Files**
   - `_bmad-output/` contains backups of category tags
   - These are manually created backups, not part of normal flow

---

## FILES ORGANIZED BY MODIFICATION TYPE

### Delete Entirely (1)
- `api/internal/calendar/category_mappings.go`

### Significant Refactor (2)
- `db/migrations/00000000000002_seed_data.sql` (remove 12 lines)
- `api/internal/handlers/master_registry.go` (remove GetEventZmanimGrouped function)

### Remove Code Sections (3)
- `api/internal/calendar/events_tag_driven_test.go` (remove test function)
- `api/internal/calendar/events.go` (remove comment)
- `api/internal/services/complete_export_service.go` (remove category fields)

### Remove References Only (6)
- `api/internal/services/zmanim_service.go`
- `api/internal/services/snapshot_service.go`
- `api/internal/handlers/onboarding.go`
- `api/internal/handlers/publisher_zmanim.go`
- `api/internal/calendar/hidden_tags_test.go`
- `api/cmd/rag-indexer/main.go`

### Schema/Migration Update (2)
- `db/migrations/00000000000001_schema.sql` (add new migration)
- Create `db/migrations/00000000000003_remove_category_tag_type.sql`

### Regenerate on Build (11)
- All `api/internal/db/sqlcgen/*.go` files (via `sqlc generate`)

### No Changes Needed (3)
- `web/lib/hooks/useCategories.ts` (uses time_categories table)
- `web/lib/icons.ts` (generic icon logic)
- `web/lib/halachic-glossary.ts` (different category field)
