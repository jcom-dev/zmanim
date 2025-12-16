# Master Registry Raw SQL Queries to Convert

## Queries to Extract (35 total)

### 1. Line 894-902: GetZmanApplicableDayTypes (QUERY)
```sql
SELECT dt.id, dt.name, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_type, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
JOIN master_zmanim_registry mr ON mr.id = mzdt.master_zman_id
WHERE mr.zman_key = $1 AND mzdt.is_default = true
ORDER BY dt.sort_order
```
**Status:** Similar query exists (GetZmanDayTypes) but uses zman_key parameter and filters on is_default

### 2. Line 951-959: GetPublisherZmanVersionHistory (QUERY)
```sql
SELECT pzv.id, pzv.publisher_zman_id, pzv.version_number,
    pzv.formula_dsl, pzv.created_by, pzv.created_at
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
ORDER BY pzv.version_number DESC
LIMIT 7
```
**Status:** ALREADY EXISTS as GetZmanVersionHistory in master_registry.sql

### 3. Line 1013-1019: GetPublisherZmanVersion (QUERYROW)
```sql
SELECT pzv.id, pzv.publisher_zman_id, pzv.version_number,
    pzv.formula_dsl, pzv.created_by, pzv.created_at
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pzv.version_number = $3
```
**Status:** ALREADY EXISTS as GetZmanVersion in master_registry.sql

### 4. Line 1063-1068: GetVersionFormula (QUERYROW)
```sql
SELECT pzv.formula_dsl
FROM publisher_zman_versions pzv
JOIN publisher_zmanim pz ON pz.id = pzv.publisher_zman_id
WHERE pz.publisher_id = $1 AND pz.zman_key = $2 AND pzv.version_number = $3
```
**Status:** NEW - for rollback

### 5. Line 1090-1098: RollbackPublisherZman (QUERYROW)
```sql
UPDATE publisher_zmanim
SET formula_dsl = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, category,
    dependencies, created_at, updated_at
```
**Status:** NEW - uses old schema (category field)

### 6. Line 1115-1124: CreateRollbackVersion (EXEC)
```sql
INSERT INTO publisher_zman_versions (publisher_zman_id, version_number, formula_dsl, created_by)
SELECT
    pz.id,
    COALESCE((SELECT MAX(version_number) FROM publisher_zman_versions WHERE publisher_zman_id = pz.id), 0) + 1,
    $3,
    $4
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
```
**Status:** Similar to CreateZmanVersion but different approach

### 7. Line 1162-1166: SoftDeletePublisherZmanByKey (EXEC)
```sql
UPDATE publisher_zmanim
SET deleted_at = NOW(), deleted_by = $3, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NULL
```
**Status:** ALREADY EXISTS as SoftDeletePublisherZman in master_registry.sql (but returns data)

### 8. Line 1201-1217: GetDeletedPublisherZmanim (QUERY)
```sql
SELECT
    pz.id,
    pz.publisher_id,
    pz.zman_key,
    COALESCE(mr.canonical_hebrew_name, pz.hebrew_name) AS hebrew_name,
    COALESCE(mr.canonical_english_name, pz.english_name) AS english_name,
    pz.formula_dsl,
    COALESCE(mr.time_category, pz.category) AS time_category,
    pz.deleted_at,
    pz.deleted_by,
    pz.master_zman_id
FROM publisher_zmanim pz
LEFT JOIN master_zmanim_registry mr ON pz.master_zman_id = mr.id
WHERE pz.publisher_id = $1 AND pz.deleted_at IS NOT NULL
ORDER BY pz.deleted_at DESC
```
**Status:** ALREADY EXISTS as GetDeletedPublisherZmanim in master_registry.sql (different columns)

### 9. Line 1262-1270: RestorePublisherZmanByKey (QUERYROW)
```sql
UPDATE publisher_zmanim
SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, category,
    dependencies, created_at, updated_at
```
**Status:** ALREADY EXISTS as RestorePublisherZman in master_registry.sql (different columns)

### 10. Line 1306-1309: PermanentDeletePublisherZmanByKey (EXEC)
```sql
DELETE FROM publisher_zmanim
WHERE publisher_id = $1 AND zman_key = $2 AND deleted_at IS NOT NULL
```
**Status:** ALREADY EXISTS as PermanentDeletePublisherZman in master_registry.sql

### 11. Line 1371-1373: GetMasterZmanDefaultFormula (QUERYROW)
```sql
SELECT default_formula_dsl FROM master_zmanim_registry WHERE id = $1
```
**Status:** NEW - simple query

### 12. Line 1386-1416: CreatePublisherZmanFromMasterRegistry (QUERYROW)
```sql
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, category,
    dependencies, master_zman_id, current_version
)
SELECT
    gen_random_uuid(),
    $1,
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    $3,
    NULL,
    NULL,
    true,
    true,
    false,
    false,
    CASE WHEN mr.is_core THEN 'essential' ELSE 'optional' END,
    '{}',
    mr.id,
    1
FROM master_zmanim_registry mr
WHERE mr.id = $2
RETURNING id, publisher_id, zman_key, hebrew_name, english_name,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, category,
    dependencies, created_at, updated_at
```
**Status:** NEW - uses old schema (category field instead of time_category_id)

### 13. Line 1434-1437: CreateInitialPublisherZmanVersion (EXEC)
```sql
INSERT INTO publisher_zman_versions (publisher_zman_id, version_number, formula_dsl)
VALUES ($1, 1, $2)
```
**Status:** NEW

### 14. Line 1547-1560: CreateZmanRegistryRequest (QUERYROW)
```sql
INSERT INTO zman_registry_requests (
    publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    transliteration, requested_formula_dsl, time_category, description,
    halachic_notes, halachic_source, auto_add_on_approval
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category, description, status, created_at
```
**Status:** NEW

### 15. Line 1572-1575: InsertZmanRequestTag (EXEC)
```sql
INSERT INTO zman_request_tags (request_id, tag_id, is_new_tag_request)
VALUES ($1, $2, false)
```
**Status:** NEW

### 16. Line 1582-1585: InsertZmanRequestNewTag (EXEC)
```sql
INSERT INTO zman_request_tags (request_id, requested_tag_name, requested_tag_type, is_new_tag_request)
VALUES ($1, $2, $3, true)
```
**Status:** NEW

### 17. Line 1610-1620: AdminGetZmanRegistryRequestsByStatus (QUERY)
```sql
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, zrr.time_category, zrr.description, zrr.status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at,
    zrr.publisher_name, zrr.publisher_email, p.name as submitter_name
FROM zman_registry_requests zrr
LEFT JOIN publishers p ON zrr.publisher_id = p.id
WHERE zrr.status = $1
ORDER BY zrr.created_at DESC
```
**Status:** NEW

### 18. Line 1622-1631: AdminGetAllZmanRegistryRequests (QUERY)
```sql
SELECT
    zrr.id, zrr.publisher_id, zrr.requested_key, zrr.requested_hebrew_name, zrr.requested_english_name,
    zrr.requested_formula_dsl, zrr.time_category, zrr.description, zrr.status,
    zrr.reviewed_by, zrr.reviewed_at, zrr.reviewer_notes, zrr.created_at,
    zrr.publisher_name, zrr.publisher_email, p.name as submitter_name
FROM zman_registry_requests zrr
LEFT JOIN publishers p ON zrr.publisher_id = p.id
ORDER BY zrr.created_at DESC
```
**Status:** NEW

### 19. Line 1726-1733: UpdateZmanRegistryRequestStatus (tx.QueryRow)
```sql
UPDATE zman_registry_requests
SET status = $2, reviewed_by = $3, reviewed_at = NOW(), reviewer_notes = $4
WHERE id = $1
RETURNING id, publisher_id, requested_key, requested_hebrew_name, requested_english_name,
    requested_formula_dsl, time_category, description, status,
    reviewed_by, reviewed_at, reviewer_notes, created_at
```
**Status:** NEW - but needs non-tx version

### 20. Line 1755-1770: AutoAddApprovedZmanToPublisher (tx.Exec)
```sql
INSERT INTO publisher_zmanim (
    id, publisher_id, zman_key, hebrew_name, english_name,
    transliteration, description,
    formula_dsl, ai_explanation, publisher_comment,
    is_enabled, is_visible, is_published, is_custom, category,
    dependencies, sort_order, current_version
)
SELECT
    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
    NULL, NULL, true, true, false, true, $8,
    '{}'::text[], 999, 1
ON CONFLICT (publisher_id, zman_key) DO NOTHING
```
**Status:** NEW - uses old schema

### 21. Line 2479-2488: AdminGetMasterZmanimByCategory (QUERY)
```sql
SELECT id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    COALESCE(is_hidden, false) as is_hidden,
    created_by, updated_by, created_at, updated_at
FROM master_zmanim_registry
WHERE time_category = $1 AND ($2 = true OR COALESCE(is_hidden, false) = false)
ORDER BY canonical_hebrew_name
```
**Status:** ALREADY EXISTS as AdminGetMasterZmanimByCategory

### 22. Line 2490-2499: AdminGetAllMasterZmanim (QUERY)
```sql
SELECT id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    COALESCE(is_hidden, false) as is_hidden,
    created_by, updated_by, created_at, updated_at
FROM master_zmanim_registry
WHERE ($1 = true OR COALESCE(is_hidden, false) = false)
ORDER BY time_category, canonical_hebrew_name
```
**Status:** ALREADY EXISTS as AdminGetAllMasterZmanim

### 23. Line 2532-2538: GetMasterZmanTagsBatch (QUERY)
```sql
SELECT mzt.master_zman_id, t.id, t.tag_key, t.display_name_hebrew, t.display_name_english,
    t.tag_type, t.description, t.color, t.sort_order, t.created_at
FROM master_zman_tags mzt
JOIN zman_tags t ON t.id = mzt.tag_id
WHERE mzt.master_zman_id = ANY($1)
ORDER BY t.sort_order
```
**Status:** ALREADY EXISTS as GetMasterZmanTagsWithDetails (uses uuid[] parameter)

### 24. Line 2589-2596: AdminGetMasterZmanByIDFull (QUERYROW)
```sql
SELECT id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    COALESCE(is_hidden, false) as is_hidden,
    created_by, updated_by, created_at, updated_at
FROM master_zmanim_registry
WHERE id = $1
```
**Status:** ALREADY EXISTS as AdminGetMasterZmanByID

### 25. Line 2613-2620: GetMasterZmanTags (QUERY)
```sql
SELECT t.id, t.name, t.display_name_hebrew, t.display_name_english,
    t.tag_type, t.description, t.color, t.sort_order, t.created_at
FROM zman_tags t
JOIN master_zman_tags mzt ON t.id = mzt.tag_id
WHERE mzt.master_zman_id = $1
ORDER BY t.tag_type, t.sort_order
```
**Status:** Similar to GetTagsForMasterZman but different order

### 26. Line 2637-2643: GetMasterZmanDayTypes (QUERY)
```sql
SELECT dt.id, dt.name, dt.display_name_hebrew, dt.display_name_english,
    dt.description, dt.parent_type, dt.sort_order
FROM day_types dt
JOIN master_zman_day_types mzdt ON dt.id = mzdt.day_type_id
WHERE mzdt.master_zman_id = $1 AND mzdt.is_default = true
ORDER BY dt.sort_order
```
**Status:** Similar to GetMasterZmanDayTypesWithDetails but filters on is_default

### 27. Line 2711-2725: AdminCreateMasterZmanFull (QUERYROW)
```sql
INSERT INTO master_zmanim_registry (
    zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    is_hidden, created_by
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    COALESCE(is_hidden, false), created_by, updated_by, created_at, updated_at
```
**Status:** Similar to AdminCreateMasterZman but with created_by

### 28. Line 2744-2748: InsertMasterZmanTagWithNegation (EXEC)
```sql
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated)
VALUES ($1, $2, $3)
ON CONFLICT (master_zman_id, tag_id) DO UPDATE SET is_negated = EXCLUDED.is_negated
```
**Status:** ALREADY EXISTS as InsertMasterZmanTag

### 29. Line 2858: AdminUpdateMasterZmanDynamic (QUERYROW with dynamic query)
Dynamic query built at runtime - NEEDS SPECIAL HANDLING
**Status:** COMPLEX - dynamic SQL

### 30. Line 2877: DeleteMasterZmanTagsForUpdate (EXEC)
```sql
DELETE FROM master_zman_tags WHERE master_zman_id = $1
```
**Status:** ALREADY EXISTS as DeleteMasterZmanTags

### 31. Line 2884-2888: InsertMasterZmanTagOnUpdate (EXEC)
```sql
INSERT INTO master_zman_tags (master_zman_id, tag_id, is_negated)
VALUES ($1, $2, $3)
ON CONFLICT (master_zman_id, tag_id) DO UPDATE SET is_negated = EXCLUDED.is_negated
```
**Status:** ALREADY EXISTS as InsertMasterZmanTag

### 32. Line 2941-2943: CheckMasterZmanInUseByID (QUERYROW)
```sql
SELECT EXISTS(SELECT 1 FROM publisher_zmanim WHERE master_zman_id = $1 AND deleted_at IS NULL)
```
**Status:** ALREADY EXISTS as CheckMasterZmanInUse

### 33. Line 2955: AdminDeleteMasterZmanByID (EXEC)
```sql
DELETE FROM master_zmanim_registry WHERE id = $1
```
**Status:** ALREADY EXISTS as AdminDeleteMasterZman

### 34. Line 2991-2999: AdminToggleZmanVisibilityFull (QUERYROW)
```sql
UPDATE master_zmanim_registry
SET is_hidden = NOT COALESCE(is_hidden, false), updated_at = NOW(), updated_by = $2
WHERE id = $1
RETURNING id, zman_key, canonical_hebrew_name, canonical_english_name,
    transliteration, description, halachic_notes, halachic_source,
    time_category, default_formula_dsl, is_core,
    COALESCE(is_hidden, false), created_by, updated_by, created_at, updated_at
```
**Status:** Similar to AdminToggleZmanVisibility but with updated_by and more columns

### 35. Line 3047-3051: AdminGetAllTags (QUERY)
```sql
SELECT id, name, display_name_hebrew, display_name_english,
    tag_type, description, color, sort_order, created_at
FROM zman_tags
ORDER BY tag_type, sort_order, name
```
**Status:** NEW - admin version

### 36. Line 3088-3092: AdminGetAllDayTypes (QUERY)
```sql
SELECT id, name, display_name_hebrew, display_name_english,
    description, parent_type, sort_order
FROM day_types
ORDER BY sort_order, name
```
**Status:** Similar to GetAllDayTypes but different columns

## Summary
- Total violations found: ~36 (including tx calls)
- Already exist in SQL files: ~15
- Need to be added: ~21
- Complex dynamic SQL: 1 (AdminUpdateMasterZman)
- Schema mismatch issues: Several queries use old schema (category vs time_category_id)
