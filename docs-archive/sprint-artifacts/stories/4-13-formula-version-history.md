# Story 4.13: Formula Version History

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P3
**Story Points:** 5
**Dependencies:** Story 4.2 (DSL Parser), Story 4.6 (Advanced Mode Editor)

---

## Story

As a **publisher**,
I want **version history for my algorithm with visual diff and rollback capabilities**,
So that **I can track changes over time, understand what was modified, and revert to previous versions if needed**.

---

## Acceptance Criteria

### AC-4.13.1: Version Tracking
- [ ] Every save creates a new version
- [ ] Versions numbered incrementally (v1, v2, v3...)
- [ ] Version includes timestamp and optional description
- [ ] Only published versions shown to end users
- [ ] Draft versions tracked separately

### AC-4.13.2: Version History View
- [ ] Timeline view showing all versions
- [ ] Each version shows: number, date, description, status (draft/published)
- [ ] Current version highlighted
- [ ] Click to view any version details

### AC-4.13.3: Visual Diff
- [ ] Side-by-side comparison of two versions
- [ ] Additions highlighted in green
- [ ] Deletions highlighted in red
- [ ] Changes highlighted in yellow
- [ ] Diff shows formula changes per zman
- [ ] Summary of what changed at top

### AC-4.13.4: Rollback Capability
- [ ] "Restore this version" button on any historical version
- [ ] Restoration creates a new version (doesn't overwrite history)
- [ ] Confirmation dialog with warning
- [ ] Option to restore as draft or publish immediately
- [ ] Audit log of who restored and when

### AC-4.13.5: Version Comparison Selection
- [ ] Select any two versions to compare
- [ ] Quick compare: current vs previous
- [ ] Quick compare: current vs any published version
- [ ] Permalink to specific version for sharing

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for versioning logic
- [ ] Unit tests pass for diff generation
- [ ] Integration tests pass for API endpoints
- [ ] E2E tests pass for history and rollback flow
- [ ] Diff display verified for accuracy
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Version Storage Schema (AC: 4.13.1)
  - [ ] 1.1 Create `algorithm_versions` table
  - [ ] 1.2 Add version number, timestamp, description columns
  - [ ] 1.3 Add status column (draft/published)
  - [ ] 1.4 Store full config snapshot per version
  - [ ] 1.5 Create migration

- [ ] Task 2: Version Tracking Logic (AC: 4.13.1)
  - [ ] 2.1 Update save endpoint to create version
  - [ ] 2.2 Implement version numbering
  - [ ] 2.3 Handle draft vs published versions
  - [ ] 2.4 Add version description field to save

- [ ] Task 3: History API (AC: 4.13.2)
  - [ ] 3.1 Create `GET /api/publisher/algorithm/{id}/versions` endpoint
  - [ ] 3.2 Return paginated version list
  - [ ] 3.3 Include metadata for each version
  - [ ] 3.4 Create `GET /api/publisher/algorithm/{id}/versions/{version}` endpoint

- [ ] Task 4: Diff Generation (AC: 4.13.3)
  - [ ] 4.1 Create `api/internal/diff/algorithm.go` service
  - [ ] 4.2 Implement JSON diff algorithm
  - [ ] 4.3 Generate per-zman change summary
  - [ ] 4.4 Create `GET /api/publisher/algorithm/{id}/diff?v1=X&v2=Y` endpoint
  - [ ] 4.5 Return structured diff data

- [ ] Task 5: Rollback API (AC: 4.13.4)
  - [ ] 5.1 Create `POST /api/publisher/algorithm/{id}/rollback` endpoint
  - [ ] 5.2 Accept version number and target status
  - [ ] 5.3 Create new version from historical data
  - [ ] 5.4 Log rollback action for audit

- [ ] Task 6: History UI (AC: 4.13.2)
  - [ ] 6.1 Create `VersionHistory` component
  - [ ] 6.2 Design timeline view
  - [ ] 6.3 Show version details on click
  - [ ] 6.4 Highlight current version

- [ ] Task 7: Diff UI (AC: 4.13.3, 4.13.5)
  - [ ] 7.1 Create `VersionDiff` component
  - [ ] 7.2 Implement side-by-side view
  - [ ] 7.3 Add syntax highlighting for changes
  - [ ] 7.4 Add version selector dropdowns
  - [ ] 7.5 Show change summary

- [ ] Task 8: Rollback UI (AC: 4.13.4)
  - [ ] 8.1 Add "Restore" button to version view
  - [ ] 8.2 Create confirmation dialog
  - [ ] 8.3 Handle restore action
  - [ ] 8.4 Show success message

- [ ] Task 9: Testing
  - [ ] 9.1 Write unit tests for versioning
  - [ ] 9.2 Write unit tests for diff
  - [ ] 9.3 Write integration tests
  - [ ] 9.4 Write E2E tests

---

## Dev Notes

### Database Schema

```sql
CREATE TABLE algorithm_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm_id UUID NOT NULL REFERENCES algorithms(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, published
    config JSONB NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(algorithm_id, version_number)
);

CREATE INDEX idx_algorithm_versions_alg ON algorithm_versions(algorithm_id);
CREATE INDEX idx_algorithm_versions_number ON algorithm_versions(algorithm_id, version_number DESC);
```

### Version Model

```go
type AlgorithmVersion struct {
    ID            string          `json:"id"`
    AlgorithmID   string          `json:"algorithm_id"`
    VersionNumber int             `json:"version_number"`
    Status        string          `json:"status"`
    Config        json.RawMessage `json:"config"`
    Description   string          `json:"description,omitempty"`
    CreatedBy     string          `json:"created_by"`
    CreatedAt     time.Time       `json:"created_at"`
}
```

### Diff Algorithm

```go
// api/internal/diff/algorithm.go
package diff

type AlgorithmDiff struct {
    Summary     string        `json:"summary"`
    Changes     []ZmanChange  `json:"changes"`
    AddedZmanim []string      `json:"added_zmanim"`
    RemovedZmanim []string    `json:"removed_zmanim"`
}

type ZmanChange struct {
    ZmanKey     string `json:"zman_key"`
    Field       string `json:"field"`       // "formula", "name_hebrew", "name_english", etc.
    OldValue    string `json:"old_value"`
    NewValue    string `json:"new_value"`
    ChangeType  string `json:"change_type"` // "modified", "added", "removed"
}

func CompareAlgorithms(v1, v2 *AlgorithmConfig) *AlgorithmDiff {
    diff := &AlgorithmDiff{}

    // Get all zman keys from both versions
    allKeys := mergeKeys(v1.Zmanim, v2.Zmanim)

    for _, key := range allKeys {
        z1, exists1 := v1.Zmanim[key]
        z2, exists2 := v2.Zmanim[key]

        if !exists1 {
            diff.AddedZmanim = append(diff.AddedZmanim, key)
            continue
        }
        if !exists2 {
            diff.RemovedZmanim = append(diff.RemovedZmanim, key)
            continue
        }

        // Compare fields
        if z1.Formula != z2.Formula {
            diff.Changes = append(diff.Changes, ZmanChange{
                ZmanKey:    key,
                Field:      "formula",
                OldValue:   z1.Formula,
                NewValue:   z2.Formula,
                ChangeType: "modified",
            })
        }
        // Compare other fields...
    }

    diff.Summary = generateSummary(diff)
    return diff
}
```

### API Endpoints

```go
// GET /api/publisher/algorithm/{id}/versions
type VersionsResponse struct {
    Versions []VersionSummary `json:"versions"`
    Current  int              `json:"current_version"`
}

type VersionSummary struct {
    VersionNumber int       `json:"version_number"`
    Status        string    `json:"status"`
    Description   string    `json:"description"`
    CreatedAt     time.Time `json:"created_at"`
    IsCurrent     bool      `json:"is_current"`
}

// GET /api/publisher/algorithm/{id}/diff?v1=5&v2=7
type DiffResponse struct {
    V1           int             `json:"v1"`
    V2           int             `json:"v2"`
    Diff         *AlgorithmDiff  `json:"diff"`
}

// POST /api/publisher/algorithm/{id}/rollback
type RollbackRequest struct {
    TargetVersion int    `json:"target_version"`
    Status        string `json:"status"` // "draft" or "published"
    Description   string `json:"description"`
}

type RollbackResponse struct {
    NewVersion int `json:"new_version"`
}
```

### Version History Component

```tsx
// web/components/algorithm/VersionHistory.tsx
interface VersionHistoryProps {
  algorithmId: string;
}

export function VersionHistory({ algorithmId }: VersionHistoryProps) {
  const { data } = useQuery({
    queryKey: ['algorithm-versions', algorithmId],
    queryFn: () => fetchVersions(algorithmId),
  });

  const [selectedVersions, setSelectedVersions] = useState<[number, number] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Version History</h3>
        {selectedVersions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedVersions(null)}
          >
            Clear Selection
          </Button>
        )}
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-gray-200 ml-3">
        {data?.versions.map((version, index) => (
          <div
            key={version.versionNumber}
            className={cn(
              "relative pl-6 pb-4",
              version.isCurrent && "bg-primary/5 -ml-3 pl-9 rounded-r-lg"
            )}
          >
            {/* Timeline dot */}
            <div
              className={cn(
                "absolute left-[-9px] w-4 h-4 rounded-full border-2",
                version.status === 'published'
                  ? "bg-green-500 border-green-500"
                  : "bg-white border-gray-300"
              )}
            />

            {/* Version info */}
            <div className="flex items-center gap-2">
              <span className="font-medium">v{version.versionNumber}</span>
              <Badge variant={version.status === 'published' ? 'default' : 'secondary'}>
                {version.status}
              </Badge>
              {version.isCurrent && <Badge>Current</Badge>}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {format(parseISO(version.createdAt), 'MMM d, yyyy HH:mm')}
            </p>

            {version.description && (
              <p className="text-sm mt-1">{version.description}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectForComparison(version.versionNumber)}
              >
                Compare
              </Button>
              {!version.isCurrent && (
                <RestoreButton
                  algorithmId={algorithmId}
                  version={version.versionNumber}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Diff View */}
      {selectedVersions && (
        <VersionDiff
          algorithmId={algorithmId}
          v1={selectedVersions[0]}
          v2={selectedVersions[1]}
        />
      )}
    </div>
  );
}
```

### Visual Diff Component

```tsx
// web/components/algorithm/VersionDiff.tsx
interface VersionDiffProps {
  algorithmId: string;
  v1: number;
  v2: number;
}

export function VersionDiff({ algorithmId, v1, v2 }: VersionDiffProps) {
  const { data } = useQuery({
    queryKey: ['algorithm-diff', algorithmId, v1, v2],
    queryFn: () => fetchDiff(algorithmId, v1, v2),
  });

  if (!data) return <Skeleton />;

  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium mb-4">
        Comparing v{v1} → v{v2}
      </h4>

      {/* Summary */}
      <div className="bg-muted p-3 rounded-md mb-4">
        <p className="text-sm">{data.diff.summary}</p>
        <div className="flex gap-4 mt-2 text-xs">
          {data.diff.addedZmanim.length > 0 && (
            <span className="text-green-600">
              +{data.diff.addedZmanim.length} added
            </span>
          )}
          {data.diff.removedZmanim.length > 0 && (
            <span className="text-red-600">
              -{data.diff.removedZmanim.length} removed
            </span>
          )}
          {data.diff.changes.length > 0 && (
            <span className="text-yellow-600">
              ~{data.diff.changes.length} modified
            </span>
          )}
        </div>
      </div>

      {/* Changes */}
      <div className="space-y-3">
        {data.diff.changes.map((change, i) => (
          <div key={i} className="border rounded p-3">
            <div className="font-medium text-sm mb-2">
              {change.zmanKey} - {change.field}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-red-50 p-2 rounded">
                <span className="text-red-600">- </span>
                <code>{change.oldValue}</code>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <span className="text-green-600">+ </span>
                <code>{change.newValue}</code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.13]

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestCreateVersion` - increments version number
- [ ] `TestCompareAlgorithms` - detects all change types
- [ ] `TestCompareAlgorithms` - handles added zmanim
- [ ] `TestCompareAlgorithms` - handles removed zmanim
- [ ] `TestRollback` - creates new version from historical

### Integration Tests (API)
- [ ] GET versions returns ordered list
- [ ] GET specific version returns correct data
- [ ] GET diff returns accurate changes
- [ ] POST rollback creates new version
- [ ] Rollback preserves history

### E2E Tests (Playwright)
- [ ] Publisher can view version history
- [ ] Publisher can select versions to compare
- [ ] Diff shows changes correctly
- [ ] Publisher can restore old version
- [ ] Restore creates new version (not overwrite)
- [ ] Timeline updates after changes

### Visual Tests
- [ ] Diff colors render correctly
- [ ] Timeline displays properly
- [ ] Mobile responsive

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-13-formula-version-history.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
