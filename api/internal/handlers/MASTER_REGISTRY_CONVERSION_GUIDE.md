# Master Registry Handler - SQLc Conversion Guide

## Overview
This document provides detailed mappings for converting all 50+ raw SQL queries in `master_registry.go` to use type-safe SQLc queries.

## Summary of Changes

### 1. New SQLc Queries Added to `master_registry.sql`
- `GetMasterZmanimByDayTypes` - Filter zmanim by day type keys
- `GetEventZmanim` - Get event zmanim with behavior tags
- `ValidateMasterZmanKeyExists` - Check if zman key exists
- `ValidatePendingRequestKeyExists` - Check for pending request
- `GetAllTagsOrdered` - Get all tags with custom type ordering
- `GetAllDayTypes` - Get all day types
- `GetDayTypesByParent` - Get day types by parent ID
- `GetZmanDayTypes` - Get day types for specific zman
- `SoftDeleteZman` - Soft delete publisher zman
- `RestoreZman` - Restore soft-deleted zman
- `PermanentDeleteZman` - Permanently delete zman
- `AdminGetAllMasterZmanim` - Admin: get all with optional hidden filter
- `AdminGetMasterZmanimByCategory` - Admin: get by category with filter
- `AdminGetMasterZmanByID` - Admin: get single zman
- `AdminCreateMasterZman` - Admin: create new master zman
- `AdminUpdateMasterZman` - Admin: update with partial fields
- `AdminDeleteMasterZman` - Admin: delete master zman
- `CheckMasterZmanInUse` - Check if zman used by publishers
- `AdminToggleZmanVisibility` - Toggle is_hidden flag
- `DeleteMasterZmanTags` - Delete all tags for zman
- `InsertMasterZmanTag` - Insert/update single tag
- `GetMasterZmanTagsWithDetails` - Batch get tags with details
- `GetMasterZmanDayTypesWithDetails` - Get day types with details

### 2. Existing SQLc Queries to Use
- `SearchMasterZmanim` - Already exists for search
- `GetMasterZmanimByCategory` - Already exists for category filter
- `GetAllMasterZmanim` - Already exists for unfiltered list
- `GetMasterZmanByKey` - Already exists for single zman
- `GetTagsForMasterZman` - Already exists for zman tags
- `GetMasterZmanimByTag` - Already exists for tag filter
- `GetZmanVersionHistory` - Already exists for version history
- `GetZmanVersion` - Already exists for specific version
- `GetDeletedPublisherZmanim` - Already exists for deleted zmanim

## Conversion Mappings

### Function: GetMasterZmanim (Lines 176-317)
**Current:** 4 different raw SQL queries based on filters (search/tag/category/all)

**Convert to:**
```go
// Search case (line 188)
zmanim, err := h.db.Queries.SearchMasterZmanim(ctx, search)

// Tag case (line 221)
zmanim, err := h.db.Queries.GetMasterZmanimByTag(ctx, tag)

// Category case (line 253)
zmanim, err := h.db.Queries.GetMasterZmanimByCategory(ctx, category)

// All case (line 283)
zmanim, err := h.db.Queries.GetAllMasterZmanim(ctx)
```

**Notes:**
- Remove manual row scanning loops
- Map SQLc result types to handler's `MasterZman` struct
- Existing queries already return proper schema fields

---

### Function: GetMasterZmanimGrouped (Lines 326-398)
**Current:** 2 raw SQL queries based on day_types parameter

**Convert to:**
```go
// With day types filter (line 344)
zmanim, err := h.db.Queries.GetMasterZmanimByDayTypes(ctx, dayTypes)

// Without filter (line 357)
zmanim, err := h.db.Queries.GetAllMasterZmanim(ctx)
```

**Notes:**
- Keep grouping logic in handler
- Use existing `GetAllMasterZmanim` for unfiltered case
- Use new `GetMasterZmanimByDayTypes` for filtered case

---

### Function: GetEventZmanimGrouped (Lines 406-516)
**Current:** 1 complex raw SQL query with JSON aggregation

**Convert to:**
```go
// Line 414
rows, err := h.db.Queries.GetEventZmanim(ctx)
```

**Notes:**
- New query already handles JSON tag aggregation
- Keep tag-based categorization logic in handler
- Query filters by behavior tag type and is_hidden=false

---

### Function: GetMasterZman (Lines 525-574)
**Current:** 2 raw SQL queries (main + tags)

**Convert to:**
```go
// Line 530
z, err := h.db.Queries.GetMasterZmanByKey(ctx, zmanKey)

// Line 553
tags, err := h.db.Queries.GetTagsForMasterZman(ctx, z.ID)
```

**Notes:**
- Both queries already exist in master_registry.sql
- Simple 1:1 replacement

---

### Function: ValidateZmanKey (Lines 590-681)
**Current:** 2 raw SQL EXISTS queries

**Convert to:**
```go
// Line 638 - Check master registry
exists, err := h.db.Queries.ValidateMasterZmanKeyExists(ctx, key)

// Line 658 - Check pending requests
exists, err = h.db.Queries.ValidatePendingRequestKeyExists(ctx, key)
```

**Notes:**
- New queries return bool directly
- Keep validation logic unchanged

---

### Function: GetAllTags (Lines 690-751)
**Current:** 2 raw SQL queries based on type filter

**Convert to:**
```go
// With type filter (line 699)
tags, err := h.db.Queries.GetTagsByType(ctx, tagType)

// Without filter (line 707)
tags, err := h.db.Queries.GetAllTagsOrdered(ctx)
```

**Notes:**
- `GetTagsByType` already exists
- `GetAllTagsOrdered` is new with custom CASE ordering

---

### Function: GetAllDayTypes (Lines 760-808)
**Current:** 2 raw SQL queries based on parent filter

**Convert to:**
```go
// With parent filter (line 769)
dayTypes, err := h.db.Queries.GetDayTypesByParent(ctx, parentID)

// Without filter (line 777)
dayTypes, err := h.db.Queries.GetAllDayTypes(ctx)
```

**Notes:**
- Both new queries added
- Schema uses `key` field, not `name`
- Schema uses `parent_id` (int), not `parent_type` (string)

---

### Function: GetZmanApplicableDayTypes (Lines 817-854)
**Current:** 1 raw SQL query

**Convert to:**
```go
// Line 821
dayTypes, err := h.db.Queries.GetZmanDayTypes(ctx, zmanKey)
```

**Notes:**
- New query added
- Removed `is_default` filter (column doesn't exist in schema)

---

### Function: GetZmanVersionHistory (Lines 867-911)
**Current:** 1 raw SQL query

**Convert to:**
```go
// Line 878
versions, err := h.db.Queries.GetZmanVersionHistory(ctx, db.GetZmanVersionHistoryParams{
    PublisherID: publisherID,
    ZmanKey: zmanKey,
})
```

**Notes:**
- Query already exists in master_registry.sql
- Simple replacement

---

### Function: GetZmanVersionDetail (Lines 921-960)
**Current:** 1 raw SQL query

**Convert to:**
```go
// Line 940
v, err := h.db.Queries.GetZmanVersion(ctx, db.GetZmanVersionParams{
    PublisherID: publisherID,
    ZmanKey: zmanKey,
    VersionNumber: int32(version),
})
```

**Notes:**
- Query already exists
- Need to convert version int to int32

---

### Function: RollbackZmanVersion (Lines 971-1058)
**Current:** 2 raw SQL queries (SELECT + UPDATE) + 1 INSERT

**Convert to:**
```go
// Line 990 - Get target formula (keep as raw for now - complex rollback logic)
// Or consider using GetZmanVersion and extracting formula_dsl

// Line 1017 - Update (keep as raw - uses formula from step 1)

// Line 1042 - Create version (keep as raw - complex version numbering)
// Or use CreateZmanVersion query
```

**Notes:**
- Complex multi-step transaction
- Consider keeping raw SQL or refactoring into service layer
- Alternative: Use existing `CreateZmanVersion` query

---

### Function: SoftDeletePublisherZman (Lines 1070-1103)
**Current:** 1 raw UPDATE query

**Convert to:**
```go
// Line 1089
err := h.db.Queries.SoftDeleteZman(ctx, db.SoftDeleteZmanParams{
    PublisherID: publisherID,
    ZmanKey: zmanKey,
    DeletedBy: userID,
})
```

**Notes:**
- New `SoftDeleteZman` query added
- Returns no rows (exec only)

---

### Function: RestorePublisherZman (Lines 1105-1157)
**Current:** 1 raw UPDATE query

**Convert to:**
```go
// Line 1128
result, err := h.db.Queries.RestoreZman(ctx, db.RestoreZmanParams{
    PublisherID: publisherID,
    ZmanKey: zmanKey,
})
```

**Notes:**
- New `RestoreZman` query added
- Returns restored zman record

---

### Function: GetDeletedZmanim (Lines 1159-1196)
**Current:** 1 raw SQL query

**Convert to:**
```go
// Line 1189 (approximately)
deletedZmanim, err := h.db.Queries.GetDeletedPublisherZmanim(ctx, publisherID)
```

**Notes:**
- Query already exists in master_registry.sql
- Simple replacement

---

### Function: PermanentDeletePublisherZman (Lines 1198-1234)
**Current:** 1 raw DELETE query

**Convert to:**
```go
// Line 1233
err := h.db.Queries.PermanentDeleteZman(ctx, db.PermanentDeleteZmanParams{
    PublisherID: publisherID,
    ZmanKey: zmanKey,
})
```

**Notes:**
- New `PermanentDeleteZman` query added

---

### Function: AdminGetMasterZmanim (Lines 2380-2495)
**Current:** 2 raw SQL queries (main + tags batch fetch)

**Convert to:**
```go
// Line 2406 or 2417 (category filtered or not)
if category != "" {
    zmanim, err = h.db.Queries.AdminGetMasterZmanimByCategory(ctx, db.AdminGetMasterZmanimByCategoryParams{
        Key: category,
        IncludeHidden: includeHidden,
    })
} else {
    zmanim, err = h.db.Queries.AdminGetAllMasterZmanim(ctx, includeHidden)
}

// Line 2459 - Batch tag fetch
tags, err := h.db.Queries.GetMasterZmanTagsWithDetails(ctx, zmanIDs)
```

**Notes:**
- New admin queries support `include_hidden` parameter
- Tags query batches by array of IDs
- Keep tag mapping logic in handler

---

### Function: AdminGetMasterZmanByID (Lines 2511-2588)
**Current:** 3 raw SQL queries (main + tags + day types)

**Convert to:**
```go
// Line 2516
z, err := h.db.Queries.AdminGetMasterZmanByID(ctx, id)

// Line 2540
tags, err := h.db.Queries.GetTagsForMasterZman(ctx, id)

// Line 2564
dayTypes, err := h.db.Queries.GetMasterZmanDayTypesWithDetails(ctx, id)
```

**Notes:**
- All queries now available
- Simple 1:1 replacements

---

### Function: AdminCreateMasterZman (Lines 2598-2689)
**Current:** 1 raw INSERT + N tag INSERTs

**Convert to:**
```go
// Line 2638
result, err := h.db.Queries.AdminCreateMasterZman(ctx, db.AdminCreateMasterZmanParams{
    ZmanKey: req.ZmanKey,
    CanonicalHebrewName: req.CanonicalHebrewName,
    CanonicalEnglishName: req.CanonicalEnglishName,
    Transliteration: req.Transliteration,
    Description: req.Description,
    HalachicNotes: req.HalachicNotes,
    HalachicSource: req.HalachicSource,
    TimeCategory: req.TimeCategory, // Converted to ID via subquery
    DefaultFormulaDsl: req.DefaultFormulaDSL,
    IsCore: req.IsCore,
    IsHidden: req.IsHidden,
})

// Line 2671 - Tag inserts
for _, tag := range req.Tags {
    err := h.db.Queries.InsertMasterZmanTag(ctx, db.InsertMasterZmanTagParams{
        MasterZmanID: result.ID,
        TagID: tag.TagID,
        IsNegated: tag.IsNegated,
    })
}
```

**Notes:**
- New query handles time_category lookup
- Schema doesn't have `created_by` field - removed from query
- Tag insert uses ON CONFLICT DO UPDATE

---

### Function: AdminUpdateMasterZman (Lines 2700-2854)
**Current:** Dynamic UPDATE query + tag management

**Convert to:**
```go
// Line 2785 (dynamic query)
// NOTE: AdminUpdateMasterZman query uses sqlc.narg() for optional fields
result, err := h.db.Queries.AdminUpdateMasterZman(ctx, db.AdminUpdateMasterZmanParams{
    ID: id,
    CanonicalHebrewName: req.CanonicalHebrewName, // Can be nil
    CanonicalEnglishName: req.CanonicalEnglishName,
    Transliteration: req.Transliteration,
    Description: req.Description,
    HalachicNotes: req.HalachicNotes,
    HalachicSource: req.HalachicSource,
    TimeCategory: req.TimeCategory,
    DefaultFormulaDsl: req.DefaultFormulaDSL,
    IsCore: req.IsCore,
    IsHidden: req.IsHidden,
})

// Line 2804 - Delete existing tags
err := h.db.Queries.DeleteMasterZmanTags(ctx, id)

// Line 2811 - Insert new tags
for _, tag := range req.Tags {
    err := h.db.Queries.InsertMasterZmanTag(ctx, db.InsertMasterZmanTagParams{
        MasterZmanID: id,
        TagID: tag.TagID,
        IsNegated: tag.IsNegated,
    })
}
```

**Notes:**
- SQLc query uses COALESCE + sqlc.narg() for partial updates
- Removed `updated_by` (not in schema)
- Keep cache invalidation logic

---

### Function: AdminDeleteMasterZman (Lines 2862-2897)
**Current:** 2 raw SQL queries (EXISTS check + DELETE)

**Convert to:**
```go
// Line 2868
inUse, err := h.db.Queries.CheckMasterZmanInUse(ctx, id)

// Line 2882
err = h.db.Queries.AdminDeleteMasterZman(ctx, id)
```

**Notes:**
- Both queries added
- Simple replacements

---

### Function: AdminToggleZmanVisibility (Lines 2899+)
**Current:** 1 raw UPDATE query

**Convert to:**
```go
result, err := h.db.Queries.AdminToggleZmanVisibility(ctx, id)
```

**Notes:**
- New query added
- Removed `updated_by` parameter (not in schema)

---

## Schema Differences Found

### Fields NOT in Schema (removed from queries):
- `master_zmanim_registry.created_by`
- `master_zmanim_registry.updated_by`
- `master_zman_day_types.is_default`
- `day_types.name` (use `key` instead)
- `day_types.parent_type` (use `parent_id` integer instead)

### Actual Schema Fields:
- `day_types` has: id, key, display_name_hebrew, display_name_english, description, parent_id, sort_order
- `master_zmanim_registry` has: id, zman_key, canonical_hebrew_name, canonical_english_name, transliteration, description, halachic_source, halachic_notes, time_category_id, default_formula_dsl, is_hidden, is_core, aliases, created_at, updated_at

## Type Mapping

Handler types to SQLc types:
- `MasterZman` → Various GetMasterZman* result types
- `ZmanTag` → GetTagsForMasterZmanRow
- `DayType` → GetAllDayTypesRow / GetZmanDayTypesRow
- `ZmanVersion` → GetZmanVersionHistoryRow
- `DeletedZman` → GetDeletedPublisherZmanimRow

**Important:** You'll need to add mapping functions or use the SQLc results directly.

## Additional Files Modified

1. **internal/db/queries/master_registry.sql**
   - Added 24 new SQLc queries

2. **internal/db/queries/lookups.sql**
   - Removed duplicate queries (GetRegionByID, GetCityByID, GetCityByName, GetTimeCategoryByKey)
   - These already exist in cities.sql and categories.sql

3. **internal/db/queries/algorithms.sql**
   - Removed duplicate onboarding queries (moved to onboarding.sql)

4. **internal/db/sqlcgen/*.go**
   - Auto-generated by SQLc - do not modify

## Testing Checklist

After conversion, test each endpoint:

- [ ] GET /api/v1/registry/zmanim (all filter combinations)
- [ ] GET /api/v1/registry/zmanim/grouped (with/without day_types)
- [ ] GET /api/v1/registry/zmanim/events
- [ ] GET /api/v1/registry/zmanim/{zmanKey}
- [ ] GET /api/v1/registry/zmanim/validate-key
- [ ] GET /api/v1/registry/tags
- [ ] GET /api/v1/registry/day-types
- [ ] GET /api/v1/registry/zmanim/{zmanKey}/day-types
- [ ] GET /api/v1/publisher/zmanim/{zmanKey}/history
- [ ] GET /api/v1/publisher/zmanim/{zmanKey}/history/{version}
- [ ] POST /api/v1/publisher/zmanim/{zmanKey}/rollback
- [ ] DELETE /api/v1/publisher/zmanim/{zmanKey}
- [ ] POST /api/v1/publisher/zmanim/{zmanKey}/restore
- [ ] GET /api/v1/publisher/zmanim/deleted
- [ ] DELETE /api/v1/publisher/zmanim/{zmanKey}/permanent
- [ ] GET /api/v1/admin/registry/zmanim
- [ ] GET /api/v1/admin/registry/zmanim/{id}
- [ ] POST /api/v1/admin/registry/zmanim
- [ ] PUT /api/v1/admin/registry/zmanim/{id}
- [ ] DELETE /api/v1/admin/registry/zmanim/{id}
- [ ] PATCH /api/v1/admin/registry/zmanim/{id}/toggle-visibility

## Notes

- All SQLc code has been generated successfully
- Queries follow existing pattern (joins on lookup tables, uses keys not IDs where appropriate)
- Some complex multi-step operations may benefit from service layer refactoring
- Cache invalidation logic should be preserved during conversion
