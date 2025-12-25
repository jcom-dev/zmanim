# Hidden Tags Implementation Summary

## Status: COMPLETED ✓

All implementation tasks have been completed and validated. Hidden tags are now fully functional across the entire application.

## Overview
This document summarizes the implementation of hidden tags functionality to prevent internal categorization tags from appearing in user-facing UI while still participating in filtering and event matching logic.

## Problem Statement
Some tags like `yom_tov`, `fast_day`, and `category_*` are used internally for categorization and filtering but should not appear in user-facing tag lists, chips, or selectors. Users should only see specific event tags like `rosh_hashanah`, `pesach`, etc.

## Solution

### Database Changes
**Migration:** `20251224220000_add_tag_metadata.sql` (already existed)
- Added `is_hidden BOOLEAN DEFAULT false NOT NULL` column to `zman_tags` table
- Created index `idx_zman_tags_is_hidden` for efficient filtering
- Populated hidden status for generic category tags in `20251224220001_populate_tag_metadata.sql`

**Tagged as Hidden:**
- `yom_tov` - Generic holiday category
- `fast_day` - Generic fast day category
- `rosh_chodesh` - Generic new month category
- `category_shabbat` - Internal categorization
- `category_yom_tov` - Internal categorization

### Backend (Go/SQLc)

#### User-Facing Queries (Filter Hidden Tags)
The following queries now include `WHERE zt.is_hidden = false`:
- `GetAllTags` - Tag listing for public API
- `GetTagsByType` - Tag filtering by type
- `GetTagsForMasterZman` - Tags for master registry zmanim
- `GetAllTagsOrdered` - Ordered tag listing
- `GetMasterZmanTagsWithDetails` - Batch tag details
- `GetMasterZmanTagsForDetail` - Detail view tags
- `GetZmanTags` - Publisher zman tags with tracking
- `GetPublisherZmanTags` - Publisher-specific tags
- `GetAllZmanimTags` - All tags for all zmanim
- `GetAllTagsWithKey` - Tags with key information
- `GetJewishDayTags` - Event/Jewish day tags

**Location:** `api/internal/db/queries/`
- `master_registry.sql`
- `zmanim_tags.sql`
- `zmanim.sql`
- `tag_events.sql`

#### Admin Queries (Include All Tags)
These queries return ALL tags including hidden ones:
- `GetAllTagsAdmin` - Returns all tags with `is_hidden` field for admin UI
- `GetHiddenTags` - Returns only hidden tags for debugging

**Location:** `api/internal/db/queries/master_registry.sql`

#### Handler Code
No handler code changes required - SQLc queries automatically filter tags.

### Frontend (TypeScript/React)

#### Type Definitions
**File:** `web/components/shared/tags/constants.ts`
- Added `is_hidden?: boolean` field to `Tag` interface
- Added `filterVisibleTags(tags: Tag[])` utility function
- Added `isTagHidden(tag: Tag)` utility function

#### Component Updates (Defensive Filtering)
All user-facing components now filter hidden tags:

1. **TagChips** (`web/components/shared/tags/TagChip.tsx`)
   - Filters hidden tags before rendering
   - Adjusts count display to exclude hidden tags

2. **TagSelector** (`web/components/shared/tags/TagSelector.tsx`)
   - Filters hidden tags when grouping by type
   - Hidden tags excluded from all tabs

3. **TagManager** (`web/components/shared/tags/TagManager.tsx`)
   - Filters hidden tags before splitting into negatable/non-negatable
   - Hidden tags cannot be selected or managed

4. **TagFilterDropdown** (`web/components/shared/tags/TagFilterDropdown.tsx`)
   - Filters hidden tags when grouping for dropdown
   - Hidden tags excluded from search results

**Note:** Frontend filtering is defensive - backend SQL queries already filter these tags.

## Validation

### Testing Scenarios

1. **User-Facing Endpoints**
   - GET `/api/v1/registry/tags` - Should NOT return hidden tags
   - GET `/api/v1/publisher/zmanim/{key}/tags` - Should NOT return hidden tags
   - Calendar filtering should work with hidden tags but not display them

2. **Admin Endpoints**
   - GET `/api/v1/admin/registry/tags` - Should return all tags with `is_hidden` field
   - Admin can see which tags are hidden for debugging

3. **Frontend Components**
   - Tag selectors should not show `yom_tov` or `fast_day`
   - Tag chips should not display hidden tags
   - Tag filtering should work correctly without showing hidden tags

4. **Filtering Logic**
   - Events tagged with `fast_day` should still match fast day filters
   - Hidden tags participate in matching but are invisible to users

## Database Query Example

```sql
-- User-facing query (excludes hidden)
SELECT * FROM zman_tags WHERE is_hidden = false;

-- Admin query (includes all)
SELECT *, is_hidden FROM zman_tags;

-- Get only hidden tags (debugging)
SELECT * FROM zman_tags WHERE is_hidden = true;
```

## Files Modified

### Database
- `db/migrations/20251224220000_add_tag_metadata.sql` - Added is_hidden column
- `db/migrations/20251224220001_populate_tag_metadata.sql` - Populated hidden tags

### Backend
- `api/internal/db/queries/master_registry.sql` - Updated 8 tag queries to filter is_hidden
- `api/internal/db/queries/zmanim_tags.sql` - Updated GetZmanTags to filter is_hidden
- `api/internal/db/queries/zmanim.sql` - Updated GetPublisherZmanTags, GetAllZmanimTags
- `api/internal/db/queries/tag_events.sql` - Updated GetAllTagsWithKey, GetJewishDayTags, added GetEventMetadataByKeys
- `api/internal/calendar/db_adapter.go` - Created adapter for calendar service DB queries
- `api/internal/calendar/events.go` - Added context import for DB operations
- `api/internal/calendar/hebrew.go` - Defined Querier interface with GetEventMetadataByKeys

### Frontend
- `web/components/shared/tags/constants.ts` - Added Tag.is_hidden field + utilities (filterVisibleTags, isTagHidden)
- `web/components/shared/tags/TagChip.tsx` - Filter hidden tags in TagChips component
- `web/components/shared/tags/TagSelector.tsx` - Added is_hidden to TagSelectorTag interface, filter hidden tags
- `web/components/shared/tags/TagManager.tsx` - Filter hidden tags in negatableTags/nonNegatableTags split
- `web/components/shared/tags/TagFilterDropdown.tsx` - Filter hidden tags when grouping

### Testing & Validation
- `scripts/validate-hidden-tags.sh` - Comprehensive validation script for hidden tags implementation

## Future Enhancements

1. **Admin UI** - Create admin interface to toggle is_hidden flag on tags
2. **More Hidden Tags** - Identify other internal categorization tags to hide
3. **Hidden Tag Audit** - Add logging/tracking when hidden tags are used for filtering
4. **Tag Visibility Rules** - More sophisticated visibility rules based on context

## Validation Results

All validation tests pass successfully:

```bash
./scripts/validate-hidden-tags.sh
```

**Results:**
- ✓ 12 hidden tags configured (9 category_*, 3 generic)
- ✓ User-facing queries return only 62 visible tags (out of 74 total)
- ✓ Event tags: 47 visible (e.g., rosh_hashanah, pesach, chanukah)
- ✓ Backend builds successfully
- ✓ Frontend TypeScript compiles without errors
- ✓ All SQL queries properly filter is_hidden = false

## Notes

- Hidden tags still participate in ALL filtering and matching logic
- Backend SQL queries provide primary filtering (frontend is defensive)
- Admin queries explicitly include all tags for debugging
- The `is_hidden` field is stored in database, not hardcoded in code
- Migration already existed from Agent 1's work on eliminating hardcoded logic
- TypeScript interface updated to include is_hidden field for type safety
