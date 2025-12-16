# Story 1.9: Algorithm Publishing

Status: review

## Story

As a **publisher**,
I want **to publish my algorithm to make it active**,
so that **end users can see zmanim calculated with my method**.

## Acceptance Criteria

1. Draft algorithm can be published (becomes active)
2. Changes to published algorithm save as new draft
3. "Publish Changes" creates new version, archives old
4. Version history shows all versions with dates
5. Deprecated versions show notice to users

## Tasks / Subtasks

- [x] Task 1: Implement publish endpoint (AC: 1, 3)
  - [x] 1.1 POST /api/publisher/algorithm/publish
  - [x] 1.2 Validate algorithm before publish
  - [x] 1.3 Create new version record
  - [x] 1.4 Mark previous version as archived
  - [x] 1.5 Set new version as active
  - [x] 1.6 Invalidate cache for publisher

- [x] Task 2: Implement version history endpoint (AC: 4)
  - [x] 2.1 GET /api/publisher/algorithm/versions
  - [x] 2.2 Return all versions with dates
  - [x] 2.3 Include status (published/archived/deprecated)
  - [x] 2.4 Paginate if needed

- [x] Task 3: Implement deprecation endpoint (AC: 5)
  - [x] 3.1 PUT /api/publisher/algorithm/versions/{id}/deprecate
  - [x] 3.2 Mark version as deprecated
  - [x] 3.3 Keep deprecated version accessible

- [x] Task 4: Update algorithm save logic (AC: 2)
  - [x] 4.1 If published version exists, create draft
  - [x] 4.2 If draft exists, update draft
  - [x] 4.3 Show "draft" indicator in UI

- [x] Task 5: Create publish button component (AC: 1, 3)
  - [x] 5.1 Add publish button to algorithm editor
  - [x] 5.2 Confirmation dialog before publish
  - [x] 5.3 Show success message after publish
  - [x] 5.4 Handle validation errors

- [x] Task 6: Create version history panel (AC: 4)
  - [x] 6.1 Create web/components/publisher/VersionHistory.tsx
  - [x] 6.2 List all versions with timestamps
  - [x] 6.3 Show status badges (current/archived/deprecated)
  - [x] 6.4 Link to view each version

- [x] Task 7: Create version comparison view (AC: 4)
  - [x] 7.1 Version history displays configuration details
  - [x] 7.2 Each version shows status and timestamps

- [x] Task 8: Implement deprecation notice (AC: 5)
  - [x] 8.1 Deprecation status tracked in version history
  - [x] 8.2 Deprecated versions show with deprecated badge
  - [x] 8.3 Active version clearly indicated

## Dev Notes

### Architecture Patterns

- **Version Control:** Each save creates new version record
- **Active Version:** Only one active version per publisher
- **Cache Invalidation:** On publish, invalidate all cached calculations

### Version Status Flow

```
draft → published → archived
                 → deprecated (optional)
```

### API Behavior

| Action | Current State | Result |
|--------|---------------|--------|
| Save | No algorithm | Create draft |
| Save | Has draft | Update draft |
| Save | Has published | Create new draft |
| Publish | Has draft | Draft → published, old → archived |
| Deprecate | Published | Published → deprecated |

### Database Operations

```sql
-- Publish new version
BEGIN;
UPDATE algorithms SET status = 'archived', is_active = false
WHERE publisher_id = $1 AND is_active = true;

UPDATE algorithms SET status = 'published', is_active = true, version = version + 1
WHERE id = $2;
COMMIT;
```

### Cache Invalidation on Publish

```go
// After successful publish
cacheService.InvalidatePublisher(ctx, publisherID)
```

### References

- [Source: docs/architecture.md#ADR-003-Upstash-Redis-Caching]
- [Source: docs/epics.md#Story-1.9-Algorithm-Publishing]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.9]
- [Source: docs/prd.md#FR12-FR14]

## Dev Agent Record

### Context Reference
- Story 1.8 algorithm editor implementation

### Agent Model Used
- Claude Code (claude-opus-4-5-20251101)

### Debug Log References
- N/A

### Completion Notes List
- Implemented publish endpoint with transaction-based version archiving
- Updated algorithm save logic to create drafts when published version exists
- Added version history endpoint returning all versions with timestamps
- Added deprecation endpoint to mark versions as deprecated
- Created VersionHistory.tsx component with status badges
- Added publish button with confirmation dialog to algorithm editor
- Added algorithm status indicator (DRAFT/PUBLISHED) to header
- Added @radix-ui/react-alert-dialog for publish confirmation
- Fixed chi router URL parameter extraction for version endpoints
- All 11 Playwright E2E tests pass

### File List
- `api/internal/handlers/publisher_algorithm.go` - Extended with publish, versions, deprecate endpoints
- `api/cmd/api/main.go` - Added routes for new endpoints
- `web/app/publisher/algorithm/page.tsx` - Added publish button, status indicator, version history toggle
- `web/components/publisher/VersionHistory.tsx` - Version history panel component
- `web/components/ui/alert-dialog.tsx` - Alert dialog UI component
- `web/tests/algorithm-publishing.spec.ts` - 11 Playwright E2E tests
