# API Patterns Index

This directory contains documentation for common API implementation patterns used in the Shtetl Zmanim backend.

## Available Patterns

### [Version History Pattern](./version-history.md)
Track changes to resources over time with two distinct versioning strategies:
- **Algorithm Version History** - Global versioning for entire algorithm configurations
- **Zman Version History** - Per-resource versioning for individual zman formulas

**Key Features:**
- Version number sequencing
- Rollback capability
- Diff functionality
- Audit trail with user attribution

**When to use:**
- Track configuration snapshots
- Enable rollback for complex changes
- Compare different versions
- Maintain change history per resource

**Key files:**
- Handler: `handlers/version_history.go`, `handlers/master_registry.go`
- Queries: `db/queries/algorithm_versions.sql`, `db/queries/zmanim.sql`
- Tables: `algorithm_version_snapshots`, `publisher_zman_versions`

---

### [Soft Delete Pattern](./soft-delete.md)
Reversible deletion mechanism that marks records as deleted rather than permanently removing them.

**Three Operations:**
- **Soft Delete** - Mark as deleted (`deleted_at = now()`)
- **Restore** - Unmark as deleted (`deleted_at = NULL`)
- **Permanent Delete** - Physical removal (admin-only)

**Key Features:**
- Audit trail (who deleted, when)
- Reversible deletions
- Admin views for deleted records
- Performance-optimized with partial indexes

**When to use:**
- User-generated content that may need restoration
- Records with dependencies
- Compliance/audit requirements
- Data that may be undeleted

**When NOT to use:**
- Cache/temporary data
- Test fixtures
- GDPR right-to-be-forgotten
- Performance-critical high-churn tables

**Key files:**
- Handler: `handlers/publisher_zmanim.go`, `handlers/publisher_snapshots.go`
- Queries: `db/queries/zmanim.sql`, `db/queries/publishers.sql`
- Services: `services/snapshot_service.go`
- Tables: `publisher_zmanim`, `publishers`, `publisher_snapshots`

---

## Pattern Selection Guide

| Use Case | Pattern | Why |
|----------|---------|-----|
| Track formula changes over time | Version History (Zman) | Per-resource granularity |
| Rollback entire algorithm config | Version History (Algorithm) | Global snapshot |
| User deletes a zman | Soft Delete | User may want to restore |
| Admin suspends publisher | Soft Delete | May need to restore |
| Session expires | Hard Delete | Temporary data |
| Cache invalidation | Hard Delete | No audit needed |
| Compare two configurations | Version History | Diff functionality |
| GDPR data removal | Hard Delete (after audit period) | Legal requirement |

## Implementation Checklist

### Version History Pattern
- [ ] Create `*_versions` table with `version_number` column
- [ ] Add unique constraint on `(entity_id, version_number)`
- [ ] Create index on `(entity_id, version_number DESC)`
- [ ] Implement SQLc queries for list, get, create
- [ ] Add `created_by` field for audit trail
- [ ] Implement rollback handler (creates new version)
- [ ] Add diff functionality if needed
- [ ] Test version number sequencing
- [ ] Test rollback creates new version

### Soft Delete Pattern
- [ ] Add `deleted_at` and `deleted_by` columns
- [ ] Create partial index `WHERE deleted_at IS NULL`
- [ ] Create index for deleted records `WHERE deleted_at IS NOT NULL`
- [ ] Update ALL SELECT queries to filter `deleted_at IS NULL`
- [ ] Update unique constraints with `WHERE deleted_at IS NULL`
- [ ] Implement SQLc queries for soft-delete, restore, permanent-delete
- [ ] Add restore endpoint
- [ ] Create admin view for deleted records
- [ ] Add `AND deleted_at IS NULL` check to delete operation
- [ ] Invalidate cache on delete and restore
- [ ] Test double-delete prevention
- [ ] Test restore functionality

## Common Pitfalls to Avoid

### Version History
1. ❌ Reusing version numbers
2. ❌ Not recording `created_by`
3. ❌ Rolling back without creating new version
4. ❌ Comparing versions across different entities
5. ❌ Missing index on `(entity_id, version_number DESC)`

### Soft Delete
1. ❌ Missing `deleted_at IS NULL` filter in queries
2. ❌ No partial index for active records
3. ❌ Using boolean `is_deleted` instead of timestamp
4. ❌ Not preventing double-delete
5. ❌ Unique constraints without `WHERE deleted_at IS NULL`
6. ❌ Hard delete when soft-delete is appropriate

## Performance Considerations

### Version History
- **Index strategy:** `(entity_id, version_number DESC)` for efficient lookups
- **Config size:** Use JSONB compression for large configs
- **Retention:** Archive old versions to cold storage
- **Diff performance:** Pre-compute diffs for large configs

### Soft Delete
- **Critical:** Partial index `WHERE deleted_at IS NULL` is mandatory
- **Query impact:** Every query needs `AND deleted_at IS NULL`
- **Index bloat:** Deleted records remain in table (plan for cleanup)
- **Unique constraints:** Use partial indexes to allow reuse after delete

## Testing Patterns

### Version History Tests
```go
// Unit tests
TestCreateVersionSnapshot()
TestGetVersionHistory()
TestRollback()
TestVersionNumberSequence()

// Integration tests
TestVersionHistoryFlow()  // Create → List → Get → Rollback
```

### Soft Delete Tests
```go
// Unit tests
TestSoftDelete()
TestRestore()
TestDoubleDelete()
TestPermanentDelete()

// Integration tests
TestSoftDeleteFlow()  // Create → Delete → List → Restore
TestAdminViewDeleted()
```

## Related Documentation

- **Coding Standards:** `/docs/coding-standards.md` - Database patterns section
- **ADRs:** `/docs/adr/` - Architecture decision records
- **Handler Pattern:** `/docs/coding-standards.md` - 6-step handler pattern
- **SQLc Guide:** `/docs/coding-standards.md` - SQLc query patterns
- **Concept Independence:** `/docs/compliance/concept-independence-audit.md`

## Contributing

When adding a new pattern:
1. Create a new `.md` file in this directory
2. Use the existing patterns as a template
3. Include: Overview, When to Use, Schema, Queries, Handlers, Examples
4. Add entry to this README.md
5. Update `/docs/coding-standards.md` with pattern reference
6. Add tests demonstrating the pattern

## Pattern Template Structure

Each pattern document should include:

1. **Overview** - What is this pattern?
2. **When to Use** - Decision criteria
3. **Database Schema Requirements** - Tables, columns, indexes
4. **SQLc Query Examples** - Complete query examples
5. **Handler Code Examples** - Full handler implementations
6. **Route Registration** - How to register routes
7. **Key Files Reference** - Where is this pattern used?
8. **Common Pitfalls** - What NOT to do
9. **Testing Considerations** - How to test this pattern
10. **Best Practices** - Summary of recommendations
11. **Related Patterns** - Links to complementary patterns
