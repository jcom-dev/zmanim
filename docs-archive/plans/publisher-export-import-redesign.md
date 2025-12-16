# Publisher Export/Import Redesign Plan

## Overview

Redesign the export/import system with two distinct flows sharing a common zmanim format:

1. **Publisher Export** - Algorithm-only export for publishers (self-service)
2. **Admin Export** - Complete publisher backup including profile, settings, and coverage

## Current State Analysis

### Existing Code
- `snapshot_service.go` - Zmanim-only snapshots (version control)
- `complete_export_service.go` - Full backup with profile/coverage/zmanim
- `publisher_snapshots.sql` - SQL queries for exports

### Missing Fields (Not Currently Exported)
| Field | Table | Notes |
|-------|-------|-------|
| `rounding_mode` | `publisher_zmanim` | floor/math/ceil |
| `display_status` | `publisher_zmanim` | core/optional/hidden |
| `tags` | `publisher_zman_tags` | Join table with `is_negated` |
| `ignore_elevation` | `publishers` | Publisher-level setting |

---

## Export Formats

### 1. Publisher Algorithm Export (New Format)

**Purpose:** Allow publishers to export/share their algorithm configurations.

**Header:**
```json
{
  "format_type": "publisher_algorithm",
  "format_version": 2,
  "exported_at": "2025-12-18T10:30:00Z",
  "publisher_id": 123
}
```

**Zman Fields (all publisher-editable fields):**
```json
{
  "zman_key": "alos_hashachar_72",
  "hebrew_name": "עלות השחר",
  "english_name": "Dawn (72 min)",
  "transliteration": "Alos HaShachar",
  "description": "Optional description",
  "formula_dsl": "sunrise - 72min",
  "ai_explanation": "72 fixed minutes before sunrise...",
  "publisher_comment": "Per Rav X's ruling",

  "is_enabled": true,
  "is_visible": true,
  "is_published": true,
  "is_beta": false,
  "is_custom": false,
  "display_status": "core",
  "rounding_mode": "floor",

  "category": "essential",

  "master_zman_id": 28,
  "linked_publisher_zman_id": null,

  "tags": [
    { "tag_key": "shita_gra", "is_negated": false },
    { "tag_key": "calc_fixed", "is_negated": false }
  ]
}
```

**Exclusions:**
- Deleted zmanim (filtered by `deleted_at IS NULL`)
- Internal IDs (`id`, `publisher_id`)
- Audit fields (`created_at`, `updated_at`, `deleted_at`, `deleted_by`)

---

### 2. Admin Complete Export (Enhanced)

**Purpose:** Full publisher backup for admin operations.

**Header:**
```json
{
  "format_type": "admin_complete_backup",
  "format_version": 2000,
  "exported_at": "2025-12-18T10:30:00Z",
  "publisher_id": 123
}
```

**Includes Everything from Publisher Export PLUS:**

**Publisher Profile:**
```json
{
  "publisher": {
    "name": "Machazikei Hadass Manchester",
    "contact_email": "rabbi@example.com",
    "phone": "+44...",
    "website": "https://...",
    "description": "...",
    "bio": "...",
    "logo_url": "...",
    "logo_data": "base64...",
    "latitude": 53.123,
    "longitude": -2.456,
    "timezone": "Europe/London",
    "ignore_elevation": true,
    "is_published": true,
    "status_key": "active"
  }
}
```

**Coverage Areas:**
```json
{
  "coverage": [
    {
      "coverage_level_key": "locality",
      "country_code": "GB",
      "region_code": "ENG",
      "locality_name": "Manchester",
      "priority": 100,
      "is_active": true
    }
  ]
}
```

---

## Import Behavior

### Publisher Import (Algorithm-Only)

**Validation:**
1. **Publisher ID must match** - Reject if `publisher_id` in file doesn't match authenticated publisher
2. Format type must be `publisher_algorithm`

**Import Logic (Smart Diff):**
1. **Match by `zman_key`** - Primary identifier
2. **Update existing** - If zman_key exists (non-deleted), update all fields
3. **Restore deleted** - If zman_key exists (deleted), un-delete and update
4. **Insert new** - If zman_key doesn't exist at all, create new zman
5. **No deletion** - Import never deletes; missing zmanim in import are left unchanged

**Default Handling (missing fields):**
| Field | Default Value |
|-------|---------------|
| `rounding_mode` | `"math"` |
| `display_status` | `"core"` |
| `is_enabled` | `true` |
| `is_visible` | `true` |
| `is_published` | `false` |
| `is_beta` | `false` |
| `is_custom` | `false` |
| `tags` | Empty array (inherits from master if linked) |
| `ai_explanation` | `null` |
| `publisher_comment` | `null` |

**Tag Import Logic:**
- Tags are **replaced entirely** on import (delete existing, insert from file)
- If `tags` array missing in import file: Clear all tags for that zman

---

### Admin Import (Complete)

**Validation:**
1. Format type must be `admin_complete_backup`
2. Publisher ID in file is informational only (not enforced)

**Import Modes:**
1. **Create New Publisher** - When no target publisher specified
2. **Update Existing** - When target publisher ID provided

**Import Logic:**
1. All Publisher Import logic applies to zmanim
2. **Profile fields** - Update publisher profile (if present in file)
3. **Coverage** - Sync coverage areas (add new, update existing, optionally remove missing)

**Admin-Only Operations:**
- Creating new publishers from backup
- Importing coverage areas
- Importing ALL profile settings (name, email, description, bio, logo, phone, website, timezone, coordinates, ignore_elevation)

---

## Implementation Steps

### Phase 1: Backend - Export Enhancement

1. **Add missing fields to export queries** (`publisher_snapshots.sql`)
   - Add `rounding_mode`, `display_status` to `GetPublisherZmanimForSnapshot`
   - Add `ignore_elevation` to `GetCompletePublisherExport`
   - Create new query `GetPublisherZmanTagsForExport` to fetch tags

2. **Update export types** (`snapshot_service.go`, `complete_export_service.go`)
   - Add `RoundingMode`, `DisplayStatus`, `Tags` to `SnapshotZman`
   - Add `IgnoreElevation` to `PublisherProfile`
   - Create `ZmanTag` struct with `TagKey` and `IsNegated`

3. **Update BuildSnapshot/BuildCompleteExport**
   - Fetch tags for each zman
   - Map new fields

4. **Update export format versions**
   - Publisher: `format_version: 2`, `format_type: "publisher_algorithm"`
   - Admin: `format_version: 2000`, `format_type: "admin_complete_backup"`

### Phase 2: Backend - Import Enhancement

1. **Add import queries** (`publisher_snapshots.sql`)
   - `UpsertPublisherZmanFromImport` - Handle insert/update with all fields
   - `DeletePublisherZmanTagsForImport` - Clear existing tags
   - `InsertPublisherZmanTag` - Add individual tag
   - `GetZmanTagIdByKey` - Lookup tag ID from key

2. **Update import logic** (`snapshot_service.go`)
   - Add publisher ID validation
   - Handle missing fields with defaults
   - Implement tag sync logic

3. **Update complete import** (`complete_export_service.go`)
   - Handle new profile fields (`ignore_elevation`)
   - Maintain backward compatibility with v1 format

### Phase 3: Frontend Updates

1. **Update export dialogs**
   - Show format version in filename
   - Add description field for export

2. **Update import dialogs**
   - Validate publisher ID match (publisher flow)
   - Show preview of changes before import
   - Display import results (created/updated counts)

### Phase 4: Testing

1. **Unit tests** - Export/import round-trip
2. **Integration tests** - Cross-publisher validation
3. **Manual testing** - Real publisher data export/import

---

## File Changes Summary

| File | Changes |
|------|---------|
| `api/internal/db/queries/publisher_snapshots.sql` | Add new fields, tag queries |
| `api/internal/services/snapshot_service.go` | Update types, export/import logic |
| `api/internal/services/complete_export_service.go` | Add profile fields, admin import |
| `api/internal/handlers/publisher_snapshots.go` | Add publisher ID validation |
| `web/components/publisher/ImportSnapshotDialog.tsx` | Publisher ID validation UI |
| `web/lib/hooks/useSnapshots.ts` | Update types |

---

## Migration Notes

- **Backward Compatibility:**
  - v1 format imports still supported (missing fields get defaults)
  - v2 exports can be imported by v1-compatible systems (extra fields ignored)

- **Database Migration Required:**
  - Add `publisher_import_history` table for audit trail

---

## Audit Trail Schema

```sql
CREATE TABLE publisher_import_history (
    id SERIAL PRIMARY KEY,
    publisher_id INT NOT NULL REFERENCES publishers(id),
    imported_by VARCHAR(255) NOT NULL,  -- Clerk user ID
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    format_type VARCHAR(50) NOT NULL,   -- 'publisher_algorithm' or 'admin_complete_backup'
    format_version INT NOT NULL,
    source_publisher_id INT,            -- From file header (for reference)
    zmanim_created INT NOT NULL DEFAULT 0,
    zmanim_updated INT NOT NULL DEFAULT 0,
    zmanim_unchanged INT NOT NULL DEFAULT 0,
    zmanim_not_in_import INT NOT NULL DEFAULT 0,
    coverage_created INT DEFAULT 0,     -- Admin imports only
    coverage_updated INT DEFAULT 0,
    profile_updated BOOLEAN DEFAULT FALSE,
    import_summary JSONB                -- Full details if needed
);

CREATE INDEX idx_import_history_publisher ON publisher_import_history(publisher_id);
CREATE INDEX idx_import_history_imported_at ON publisher_import_history(imported_at DESC);
```

---

## Design Decisions (Confirmed)

| Decision | Answer |
|----------|--------|
| Tag import behavior | **Replace** - delete existing, insert from file |
| Dry run preview | **No** - not needed |
| Admin profile fields | **All** - name, email, description, bio, logo, phone, website, timezone, coordinates, ignore_elevation |
| Admin coverage import | **Yes** - full coverage sync |
| Missing zmanim warning | **Yes** - show message: "The following X zmanim exist but were not in the import file and will remain unchanged: [list]" |
| Import audit trail | **Yes** - track who imported what, when |

---

## Import Result Response

```json
{
  "success": true,
  "zmanim_created": 5,
  "zmanim_updated": 12,
  "zmanim_unchanged": 3,
  "zmanim_not_in_import": [
    { "zman_key": "custom_zman_1", "english_name": "My Custom Zman" },
    { "zman_key": "local_minhag", "english_name": "Local Minhag Time" }
  ],
  "message": "Import complete. 2 existing zmanim were not in the import file and remain unchanged."
}
```
