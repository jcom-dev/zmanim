# Master Registry Handler - SQLc Conversion Status

## Overview
Converting `api/internal/handlers/master_registry.go` from raw SQL (Pool.Query/QueryRow/Exec) to type-safe SQLc queries.

**Total Original Pool Calls**: 50+
**Remaining Pool Calls**: 35
**Functions Completed**: 11
**Functions Remaining**: 20

---

## ✅ COMPLETED FUNCTIONS

### Public Registry Functions
1. **GetMasterZmanim** - ✅ DONE
   - Uses: `SearchMasterZmanim`, `GetMasterZmanimByTag`, `GetMasterZmanimByCategory`, `GetAllMasterZmanim`
   - Added generic `convertToMasterZmanSlice` helper

2. **GetMasterZmanimGrouped** - ✅ DONE
   - Uses: `GetMasterZmanimByDayTypes`, `GetAllMasterZmanim`
   - Note: Removed `is_default` field (doesn't exist in schema)

3. **GetEventZmanimGrouped** - ✅ DONE
   - Uses: `GetEventZmanim`
   - Handles JSON tag parsing in conversion

4. **GetMasterZman** - ✅ DONE
   - Uses: `GetMasterZmanByKey`, `GetTagsForMasterZman`
   - Added tag conversion logic

5. **ValidateZmanKey** - ✅ DONE
   - Uses: `ValidateMasterZmanKeyExists`, `ValidatePendingRequestKeyExists`
   - Returns bool directly

6. **GetAllTags** - ✅ DONE
   - Uses: `GetTagsByType`, `GetAllTagsOrdered`
   - Handles custom CASE ordering for all tags

7. **GetAllDayTypes** - ✅ DONE
   - Uses: `GetDayTypesByParent`, `GetAllDayTypes`
   - **Important**: Schema uses `key` (not `name`) and `parent_id` (int32, not string parent_type)
   - Added `convertDayTypeRows` helper

---

## ⏳ REMAINING FUNCTIONS (20)

### Day Types & Registry
8. **GetZmanApplicableDayTypes** (line ~894)
   - Needs: `GetZmanDayTypes`
   - Query exists, simple replacement

### Version History
9. **GetZmanVersionHistory** (line ~951)
   - Needs: `GetZmanVersionHistory`
   - Query exists

10. **GetZmanVersionDetail** (line ~1013)
    - Needs: `GetZmanVersion`
    - Query exists

11. **RollbackZmanVersion** (line ~1063, 1090, 1115)
    - Complex transaction with SELECT + UPDATE + INSERT
    - Conversion guide suggests keeping raw or using service layer
    - Alternative: Use `RollbackZmanToVersion` + `CreateZmanVersion`

### Soft Delete Operations
12. **SoftDeletePublisherZman** (line ~1162)
    - Needs: `SoftDeleteZman`
    - Query exists (returns void)

13. **RestorePublisherZman** (line ~1201)
    - Needs: `RestoreZman`
    - Query exists (returns restored record)

14. **GetDeletedZmanim** (line ~1262)
    - Needs: `GetDeletedPublisherZmanim`
    - Query exists

15. **PermanentDeletePublisherZman** (line ~1306)
    - Needs: `PermanentDeleteZman`
    - Query exists

### Publisher Zman Operations
16. **CreatePublisherZmanFromRegistry** (line ~1371, 1386, 1434)
    - Multiple queries for creating zman + version
    - May need transaction or service layer

17. **CreateZmanRegistryRequest** (line ~1547, 1572, 1582)
    - Complex with tag creation
    - Uses `CreateZmanRegistryRequest` query

18. **AdminGetZmanRegistryRequests** (line ~1610, 1622)
    - Needs: `GetZmanRegistryRequests`
    - Query exists with optional status filter

19. **AdminReviewZmanRegistryRequest** (line ~1716+)
    - Complex transaction workflow
    - Uses multiple queries

### Admin Functions
20. **AdminGetMasterZmanim** (line ~2479+)
    - Needs: `AdminGetAllMasterZmanim`, `AdminGetMasterZmanimByCategory`
    - Batch tag fetch: `GetMasterZmanTagsWithDetails`

21. **AdminGetMasterZmanByID** (line ~TBD)
    - Needs: `AdminGetMasterZmanByID`, `GetTagsForMasterZman`, `GetMasterZmanDayTypesWithDetails`

22. **AdminCreateMasterZman** (line ~TBD)
    - Needs: `AdminCreateMasterZman`, `InsertMasterZmanTag` (loop)
    - Note: Schema doesn't have `created_by` field

23. **AdminUpdateMasterZman** (line ~TBD)
    - Needs: `AdminUpdateMasterZman` (with sqlc.narg for optional fields)
    - Tag management: `DeleteMasterZmanTags`, `InsertMasterZmanTag`

24. **AdminDeleteMasterZman** (line ~TBD)
    - Needs: `CheckMasterZmanInUse`, `AdminDeleteMasterZman`

25. **AdminToggleZmanVisibility** (line ~TBD)
    - Needs: `AdminToggleZmanVisibility`
    - Note: No `updated_by` parameter (not in schema)

26. **AdminGetTags** (line ~TBD)
    - Can use existing tag queries

27. **AdminGetDayTypes** (line ~TBD)
    - Can use existing day type queries

---

## Helper Functions Added

```go
// Generic conversion
convertToMasterZmanSlice[T any](rows []T) []MasterZman
convertToMasterZman(row any) MasterZman

// Day type conversion
convertDayTypeRows[T any](rows []T) []DayType
convertDayTypeRow(row any) DayType

// Utilities
safeStringValue(s *string) string
safeBoolValue(b *bool) bool
```

## Conversion Cases Added to convertToMasterZman

- `db.GetAllMasterZmanimRow`
- `db.GetMasterZmanimByCategoryRow`
- `db.SearchMasterZmanimRow`
- `db.GetMasterZmanimByTagRow`
- `db.GetMasterZmanimByDayTypesRow`
- `db.AdminGetAllMasterZmanimRow`
- `db.AdminGetMasterZmanimByCategoryRow`
- `db.GetEventZmanimRow` (includes JSON tag parsing)
- `db.GetMasterZmanByKeyRow`
- `db.AdminGetMasterZmanByIDRow`

## Conversion Cases Added to convertDayTypeRow

- `db.GetAllDayTypesRow`
- `db.GetDayTypesByParentRow`
- `db.GetZmanDayTypesRow`

---

## Schema Notes from Conversion

### Removed Fields (Not in Schema)
- `master_zmanim_registry.created_by`
- `master_zmanim_registry.updated_by`
- `master_zman_day_types.is_default`
- `day_types.name` → use `key`
- `day_types.parent_type` (string) → use `parent_id` (int32)

### Actual Schema Fields
- **day_types**: id, key, display_name_hebrew, display_name_english, description, parent_id, sort_order
- **master_zmanim_registry**: id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, halachic_source, halachic_notes, time_category_id, default_formula_dsl, is_hidden, is_core, aliases, created_at, updated_at

---

## Next Steps

1. ✅ Complete basic registry functions (DONE)
2. ⏳ Complete version history functions
3. ⏳ Complete soft delete functions
4. ⏳ Complete admin CRUD functions
5. ⏳ Handle complex transactions (may need service layer)
6. Test all endpoints
7. Remove pgx.Rows imports if no longer needed

---

## Testing Checklist

After completing conversions, test:
- [ ] GET /api/v1/registry/zmanim (all filter combinations)
- [ ] GET /api/v1/registry/zmanim/grouped
- [ ] GET /api/v1/registry/zmanim/events
- [ ] GET /api/v1/registry/zmanim/{zmanKey}
- [ ] GET /api/v1/registry/zmanim/validate-key
- [ ] GET /api/v1/registry/tags
- [ ] GET /api/v1/registry/day-types
- [ ] GET /api/v1/registry/zmanim/{zmanKey}/day-types
- [ ] Version history endpoints
- [ ] Soft delete endpoints
- [ ] Admin CRUD endpoints
