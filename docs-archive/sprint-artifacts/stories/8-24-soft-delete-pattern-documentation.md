# Story 8.24: Soft Delete Pattern Documentation

Status: done

## Story

As a developer,
I want documented soft-delete patterns with examples,
So that future features implement deletion consistently.

## Acceptance Criteria

- [x] Soft-delete pattern documented in coding-standards.md
- [x] Existing implementations audited and listed
- [x] Example code snippets provided for handlers
- [x] SQLc query patterns documented
- [x] Frontend deletion flow patterns documented

## Tasks / Subtasks

- [x] Task 1: Audit existing implementations
  - [x] 1.1 List all resources with soft-delete (zmanim, publishers, snapshots)
  - [x] 1.2 Document current handler patterns
  - [x] 1.3 Document current SQLc query patterns
  - [x] 1.4 Note any inconsistencies
- [x] Task 2: Document backend pattern
  - [x] 2.1 Add "Soft Delete Pattern" section to coding-standards.md
  - [x] 2.2 Include handler code example
  - [x] 2.3 Include SQLc query example
  - [x] 2.4 Document restore and permanent delete
- [x] Task 3: Document frontend pattern
  - [x] 3.1 Document confirmation dialog pattern
  - [x] 3.2 Document cache invalidation on delete
  - [x] 3.3 Document "deleted items" list pattern
- [x] Task 4: Create reference implementation notes
  - [x] 4.1 Point to publisher_zmanim.go as reference
  - [x] 4.2 Point to snapshots as reference
  - [x] 4.3 Note which resources should add soft-delete (if any)

## Dev Notes

### Current Soft-Delete Resources
1. **Publisher Zmanim** - `deleted_at`, restore, permanent delete
2. **Publishers** - `deleted_at`, restore, permanent delete (admin)
3. **Snapshots** - Delete only (no soft-delete currently)

### Pattern Components
- `deleted_at TIMESTAMPTZ` column
- `SoftDeleteX` handler (sets deleted_at)
- `RestoreX` handler (clears deleted_at)
- `PermanentDeleteX` handler (hard delete)
- `GetDeletedX` query (WHERE deleted_at IS NOT NULL)
- Default queries exclude deleted (WHERE deleted_at IS NULL)

## Definition of Done (DoD)

- [x] Soft-delete section added to coding-standards.md
- [x] All existing implementations listed
- [x] Code examples provided
- [x] Pattern is clear enough for future implementation

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A - Documentation story, no debugging required

### Completion Notes List

1. **Audit Complete**: Identified two tables implementing soft-delete pattern:
   - `publisher_zmanim` - Full soft-delete lifecycle (delete, restore, permanent delete)
   - `publishers` - Admin-only soft-delete with restore capability

2. **Comprehensive Documentation Added**: Created extensive "Soft Delete Pattern" section in `docs/coding-standards.md` covering:
   - When to use soft vs hard delete (decision table)
   - Database schema pattern (deleted_at, deleted_by columns)
   - Backend patterns: SQLc queries, 6-step handler pattern, API routes
   - Frontend patterns: React Query hooks, confirmation dialogs, deleted items dialog
   - Cache invalidation strategies (Redis + React Query)
   - Database indexes for performance
   - Reference implementations with file paths
   - Testing patterns

3. **Code Examples**: Provided complete, production-ready code examples:
   - 5 SQLc query patterns (standard filter, soft delete, restore, permanent delete, get deleted)
   - 3 handler functions with full 6-step pattern implementation
   - API route structure
   - 3 React Query hooks with cache invalidation
   - 2 confirmation dialog patterns (soft vs permanent delete)
   - Complete deleted items dialog implementation
   - Backend test example

4. **Reference Implementations Documented**:
   - Backend: `api/internal/handlers/master_registry.go` (publisher zmanim), `api/internal/handlers/admin.go` (publishers)
   - Frontend: `web/components/publisher/DeletedZmanimDialog.tsx`, `web/app/admin/publishers/page.tsx`
   - Queries: `api/internal/db/queries/master_registry.sql`, `api/internal/db/queries/admin.sql`

5. **Consistency Analysis**: Identified consistent patterns across both implementations:
   - All queries filter by `deleted_at IS NULL` for active records
   - All soft deletes set timestamp + user ID
   - All restores clear timestamp and deleted_by
   - All permanent deletes require prior soft-delete (safety check)
   - Proper database indexes for both active and deleted record lookups

### File List

**Modified:**
- `docs/coding-standards.md` - Added comprehensive "Soft Delete Pattern" section (460+ lines)
- `docs/sprint-artifacts/stories/8-24-soft-delete-pattern-documentation.md` - Marked tasks complete, added completion notes

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story created from 8-20 rescoping | Claude Opus 4.5 |
