# Plan: Publisher Version Control & JSON Export/Import

## Overview

Add global publisher snapshot/version control system with:
1. **Export to JSON** - Download all publisher-editable data
2. **Import from JSON** - Restore from a JSON file
3. **Save Version** - Create a named snapshot with description
4. **Restore Version** - Restore from a saved version (auto-saves current state first)
5. **Version History** - View and manage all saved versions

## Data Scope (Publisher Snapshot)

All publisher-editable fields across tables:

```typescript
interface PublisherSnapshot {
  version: 1;  // Schema version for future compatibility
  exported_at: string;  // ISO timestamp
  description: string;  // User-provided or auto-generated

  // Profile (publishers table)
  profile: {
    name: string;
    email: string;
    website: string | null;
    bio: string | null;
    logo_data: string | null;  // Base64 PNG
  };

  // Coverage (publisher_coverage table)
  coverage: Array<{
    coverage_level: 'continent' | 'country' | 'region' | 'city';
    continent_code?: string;
    country_code?: string;
    region?: string;
    city_id?: string;
    priority: number;
    is_active: boolean;
  }>;

  // Zmanim (publisher_zmanim table) - ALL zmanim including deleted
  zmanim: Array<{
    zman_key: string;
    hebrew_name: string;
    english_name: string;
    transliteration?: string;
    description?: string;
    formula_dsl: string;
    ai_explanation?: string;
    publisher_comment?: string;
    is_enabled: boolean;
    is_visible: boolean;
    is_published: boolean;
    is_beta: boolean;
    is_custom: boolean;
    category: 'essential' | 'optional' | 'custom';
    master_zman_id?: string;
    linked_publisher_zman_id?: string;
    source_type: string;
  }>;
}
```

## Database Changes

### New Table: `publisher_snapshots`

```sql
CREATE TABLE publisher_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,  -- User description or "Auto-save before restore - DATETIME"
  snapshot_data JSONB NOT NULL,  -- The full PublisherSnapshot
  created_by TEXT NOT NULL,  -- Clerk user ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Keep max 20 snapshots per publisher (older ones auto-pruned)
  CONSTRAINT fk_publisher FOREIGN KEY (publisher_id) REFERENCES publishers(id)
);

CREATE INDEX idx_publisher_snapshots_publisher_created
  ON publisher_snapshots(publisher_id, created_at DESC);

-- Auto-prune trigger (keep last 20)
CREATE OR REPLACE FUNCTION prune_publisher_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM publisher_snapshots
  WHERE id IN (
    SELECT id FROM publisher_snapshots
    WHERE publisher_id = NEW.publisher_id
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prune_publisher_snapshots
AFTER INSERT ON publisher_snapshots
FOR EACH ROW EXECUTE FUNCTION prune_publisher_snapshots();
```

## API Endpoints

### 1. Export to JSON
```
GET /api/v1/publisher/snapshot/export
Response: JSON file download (application/json)
```

### 2. Import from JSON
```
POST /api/v1/publisher/snapshot/import
Body: { snapshot: PublisherSnapshot }
Response: { success: true, stats: { profile: boolean, coverage: number, zmanim: number } }
```

### 3. Save Version (Create Snapshot)
```
POST /api/v1/publisher/snapshot
Body: { description?: string }  // Defaults to "Version save - {datetime}"
Response: { id: string, description: string, created_at: string }
```

### 4. List Versions
```
GET /api/v1/publisher/snapshots
Response: { snapshots: Array<{ id, description, created_at, created_by }> }
```

### 5. Restore Version
```
POST /api/v1/publisher/snapshot/{id}/restore
- Auto-saves current state first with description "Auto-save before restore - {datetime}"
- Then restores the selected snapshot
Response: { success: true, auto_save_id: string }
```

### 6. Delete Version
```
DELETE /api/v1/publisher/snapshot/{id}
Response: { success: true }
```

### 7. Get Single Snapshot (for preview)
```
GET /api/v1/publisher/snapshot/{id}
Response: { snapshot: PublisherSnapshot, description: string, created_at: string }
```

## Backend Implementation

### Files to Create/Modify

1. **`db/migrations/YYYYMMDD_publisher_snapshots.sql`** - New table
2. **`api/internal/db/queries/publisher_snapshots.sql`** - SQLc queries
3. **`api/internal/handlers/publisher_snapshots.go`** - Handler with 6-step pattern
4. **`api/internal/services/snapshot_service.go`** - Business logic for:
   - Building snapshot from current state
   - Applying snapshot (transactional)
   - Export/import validation

### Handler Pattern (per coding-standards.md)

```go
func (h *Handlers) ExportSnapshot(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. No URL params needed

    // 3. No body needed

    // 4. No validation needed

    // 5. Build snapshot via service
    snapshot, err := h.snapshotService.BuildSnapshot(ctx, pc.PublisherID)
    if err != nil {
        slog.Error("failed to build snapshot", "error", err)
        RespondInternalError(w, r, "Failed to export snapshot")
        return
    }

    // 6. Respond with JSON download
    w.Header().Set("Content-Type", "application/json")
    w.Header().Set("Content-Disposition",
        fmt.Sprintf(`attachment; filename="publisher-snapshot-%s.json"`, time.Now().Format("2006-01-02")))
    json.NewEncoder(w).Encode(snapshot)
}
```

## Frontend Implementation

### UI Location

Add a new "Version Control" toolbar in the Algorithm page header, adjacent to existing buttons:

```tsx
// In web/app/publisher/algorithm/page.tsx header section
<div className="flex flex-wrap gap-2 w-full md:w-auto">
  {/* Existing buttons */}
  <Button variant="outline" size="sm" onClick={() => setShowRestartConfirm(true)}>
    Restart Wizard
  </Button>

  {/* NEW: Version Control Dropdown */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm">
        <History className="h-4 w-4 mr-2" />
        Versions
        <ChevronDown className="h-3 w-3 ml-1" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => handleExportJSON()}>
        <Download className="h-4 w-4 mr-2" />
        Export to JSON
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Import from JSON
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => setShowSaveVersionDialog(true)}>
        <Save className="h-4 w-4 mr-2" />
        Save Version
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowVersionHistoryDialog(true)}>
        <History className="h-4 w-4 mr-2" />
        Version History
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  {/* Existing buttons */}
  <Button variant="outline" size="sm" onClick={() => setShowMonthView(true)}>
    View Week
  </Button>
</div>
```

### New Components

1. **`web/components/publisher/SaveVersionDialog.tsx`**
   - Input for description (default: "Version save - {datetime}")
   - Save button
   - Shows loading/success/error states

2. **`web/components/publisher/VersionHistoryDialog.tsx`**
   - List of saved versions with description, date, created_by
   - Actions per row: Restore, Preview, Delete
   - Restore shows confirmation with "This will auto-save your current state first"

3. **`web/components/publisher/ImportSnapshotDialog.tsx`**
   - File input for JSON upload
   - Preview of what will be imported (counts)
   - Confirmation with warning about overwriting

4. **`web/lib/hooks/usePublisherSnapshots.ts`**
   - `useExportSnapshot()` - Triggers download
   - `useImportSnapshot()` - Upload and apply
   - `useSaveVersion()` - Create new snapshot
   - `useVersionHistory()` - List snapshots
   - `useRestoreVersion()` - Restore with auto-save

### Export Flow

```typescript
const handleExportJSON = async () => {
  try {
    const response = await api.getRaw('/publisher/snapshot/export');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publisher-snapshot-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Snapshot exported');
  } catch (err) {
    toast.error('Failed to export snapshot');
  }
};
```

### Import Flow

```typescript
const handleImportJSON = async (file: File) => {
  try {
    const text = await file.text();
    const snapshot = JSON.parse(text);

    // Validate schema version
    if (snapshot.version !== 1) {
      throw new Error('Unsupported snapshot version');
    }

    await api.post('/publisher/snapshot/import', { snapshot });
    toast.success('Snapshot imported successfully');
    refetch(); // Refresh zmanim list
  } catch (err) {
    toast.error('Failed to import snapshot');
  }
};
```

## Implementation Order

### Phase 1: Backend Foundation
1. Create migration for `publisher_snapshots` table
2. Run migration: `./scripts/migrate.sh`
3. Create SQLc queries in `publisher_snapshots.sql`
4. Generate SQLc: `cd api && sqlc generate`
5. Create `snapshot_service.go` with BuildSnapshot/ApplySnapshot
6. Create `publisher_snapshots.go` handler
7. Register routes

### Phase 2: Frontend - Export/Import
1. Add `usePublisherSnapshots.ts` hooks
2. Add Export/Import menu items to algorithm page
3. Create `ImportSnapshotDialog.tsx`
4. Test export/import flow

### Phase 3: Frontend - Version Management
1. Create `SaveVersionDialog.tsx`
2. Create `VersionHistoryDialog.tsx`
3. Add remaining menu items
4. Test save/restore flow

### Phase 4: Polish
1. Add toast notifications
2. Handle edge cases (empty publisher, large snapshots)
3. Add loading states
4. E2E tests

## Edge Cases

1. **Linked zmanim** - When importing, linked_publisher_zman_id references may be invalid
   - Solution: Skip linked zmanim if target doesn't exist, log warning

2. **Coverage conflicts** - City IDs may not exist in different environments
   - Solution: Validate city_id exists before inserting, skip invalid

3. **Large snapshots** - Publishers with many zmanim
   - Solution: JSONB handles this well, add progress indicator for UI

4. **Concurrent edits** - User editing while restore happens
   - Solution: Transactional restore with row locks

5. **Schema migration** - Future snapshot format changes
   - Solution: Version field in snapshot, migration functions per version

## Testing

### Unit Tests (Go)
- BuildSnapshot returns correct structure
- ApplySnapshot creates correct DB rows
- Prune trigger keeps max 20 versions

### E2E Tests (Playwright)
- Export creates valid JSON file
- Import from file updates zmanim list
- Save version appears in history
- Restore version works (verify zmanim change)
- Auto-save created before restore

## Success Criteria

1. Publisher can export all their data to a single JSON file
2. Publisher can import from JSON file (with confirmation)
3. Publisher can save named versions (default: "Version save - {datetime}")
4. Publisher can view version history with dates
5. Publisher can restore any version (auto-saves current state first)
6. Max 20 versions per publisher (auto-pruned)
7. All operations work correctly with coding standards (useApi, design tokens, etc.)
