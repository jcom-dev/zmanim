# Tag-Driven Architecture Documentation Index

**Complete reference for the tag-driven event system**

---

## Quick Navigation

| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| [Quick Start](#quick-start) | Get started in 5 minutes | Developers | 5 min read |
| [Architecture](#architecture) | Understand the system | Architects | 30 min read |
| [Migration](#migration) | Execute the migration | DevOps | 45 min read |
| [Deployment](#deployment) | Deploy to production | DevOps | 30 min read |
| [Changelog](#changelog) | What changed for users | Publishers | 10 min read |
| [Complete](#complete) | Full migration report | Stakeholders | 20 min read |

---

## Documents

### Quick Start
**File**: `/docs/TAG-QUICK-START.md`
**Purpose**: Get developers productive with tag-driven architecture in 5 minutes
**Contents**:
- Core concepts (tags vs. formulas)
- 5-minute understanding of the flow
- Common tasks (add event, debug zman, etc.)
- Tag types and pattern matching
- Code patterns (DO/DON'T)
- Testing and debugging
- SQL cheat sheet

**When to use**: First document to read when joining the project or working with tags

---

### Architecture
**File**: `/docs/architecture/tag-driven-events.md` (673 lines)
**Purpose**: Comprehensive architectural reference
**Contents**:
- Overview and motivation
- Data model (tables, relationships, constraints)
- Flow diagrams (request flow, data flow)
- Tag types and hierarchy
- Event pattern matching
- API contracts and examples
- Publisher configuration guide
- Performance considerations
- Edge cases and special handling

**When to use**: When designing new features, debugging complex issues, or onboarding senior developers

**Key Sections**:
```
1. Introduction
2. Architecture Overview
   - Data Model
   - Tag Types
   - Event Pattern Matching
3. Flow Diagrams
   - Request Flow
   - Data Flow
4. API Contracts
   - Service Layer
   - Database Layer
5. Publisher Configuration
6. Edge Cases
7. Performance
```

---

### Migration
**File**: `/docs/migration/eliminate-hardcoded-logic.md` (670 lines)
**Purpose**: Step-by-step migration execution guide
**Contents**:
- Migration overview and goals
- Pre-migration preparation
- Phase 1: Database schema changes
- Phase 2: Code refactoring
- Phase 3: Testing and validation
- Rollback procedures
- Troubleshooting guide
- Success criteria

**When to use**: When executing the migration, troubleshooting issues, or understanding what changed

**Key Sections**:
```
1. Overview
2. Preparation
   - Backup strategy
   - Testing plan
3. Migration Phases
   - Database migrations (SQL)
   - Code changes (Go)
   - Testing
4. Validation
   - Test scenarios
   - SQL validation queries
5. Rollback
6. Troubleshooting
```

---

### Deployment
**File**: `/DEPLOYMENT-CHECKLIST-TAG-DRIVEN.md`
**Purpose**: Production deployment checklist
**Contents**:
- Pre-deployment checklist
- Step-by-step deployment procedure
- Smoke testing procedures
- Monitoring setup
- Post-deployment validation
- Rollback plan
- Communication templates

**When to use**: When deploying to staging or production

**Key Sections**:
```
1. Pre-Deployment
   - Code review
   - Database preparation
   - Testing matrix
   - Documentation verification
2. Deployment Steps (8 steps)
   - Staging deployment
   - Smoke testing
   - Production deployment
   - Monitoring
3. Post-Deployment
   - Day 1 checks
   - Week 1 monitoring
   - Week 2 review
4. Rollback Plan
5. Success Criteria
6. Validation Queries
```

---

### Changelog
**File**: `/CHANGELOG-tag-driven.md` (496 lines)
**Purpose**: User-facing changes and migration notes
**Contents**:
- What changed (user perspective)
- New capabilities for publishers
- Breaking changes (none)
- Migration notes
- API changes
- Database schema changes
- Feature examples

**When to use**: When communicating changes to publishers or users

**Key Sections**:
```
1. Summary
2. For Publishers
   - New capabilities
   - How to use tags
3. For Developers
   - API changes
   - Database changes
   - Code patterns
4. Migration Notes
5. Examples
6. FAQ
```

---

### Complete
**File**: `/TAG-DRIVEN-MIGRATION-COMPLETE.md`
**Purpose**: Comprehensive migration report and reference
**Contents**:
- Executive summary
- What changed (before/after)
- Architecture overview
- Migration files applied
- HebCal event coverage
- Testing and validation
- Publisher configuration
- Adding new events (examples)
- Rollback plan
- Performance considerations
- Documentation inventory
- Next steps
- Success metrics
- Team knowledge transfer

**When to use**: Final reference document, handoff to stakeholders, project archive

**Key Sections**:
```
1. Executive Summary
2. What Changed
3. Architecture Overview
4. Migration Files Applied
5. HebCal Event Coverage
6. Testing & Validation
7. Publisher Configuration
8. Adding New Events
9. Performance
10. Documentation
11. Next Steps
12. Success Metrics
13. Team Knowledge Transfer
14. Appendix (file inventory)
```

---

## Supporting Documentation

### Test Documentation

**Location**: `/api/internal/calendar/`

| File | Purpose |
|------|---------|
| `TEST_DATA_FIXTURES.md` | Test data for all scenarios |
| `COVERAGE_TEST_SUMMARY.md` | Test coverage report |
| `SQL_VALIDATION_QUERIES.md` | Validation queries |
| `EVENT_COVERAGE_README.md` | Event coverage documentation |

### Validation Scripts

**Location**: `/scripts/`

| Script | Purpose |
|--------|---------|
| `validate-hebcal-coverage.sh` | Ensure all HebCal events mapped |
| `validate-no-hardcoded-logic.sh` | Scan for forbidden patterns |
| `verify-hebcal-sync.sh` | Database consistency check |

### Migration Files

**Location**: `/db/migrations/`

| File | Purpose |
|------|---------|
| `20251224204010_add_missing_hebcal_events.sql` | Add missing event tags |
| `20251224210000_sync_hebcal_events.sql` | Create event mappings |
| `20251224220000_add_tag_metadata.sql` | Add metadata table |
| `20251224220001_populate_tag_metadata.sql` | Populate metadata |
| `20251224230000_add_tisha_bav_category_tags.sql` | Special category tags |
| `VALIDATION_QUERIES.md` | Migration validation queries |

---

## Reading Paths

### Path 1: Developer Onboarding
**Goal**: Get productive quickly
**Time**: 30 minutes

1. Read: `/docs/TAG-QUICK-START.md` (10 min)
2. Skim: `/docs/architecture/tag-driven-events.md` (10 min - sections 1-3)
3. Run: Validation scripts (5 min)
4. Explore: Test files (5 min)

**Outcome**: Can add events, debug issues, understand core concepts

---

### Path 2: Architecture Deep Dive
**Goal**: Understand system design
**Time**: 90 minutes

1. Read: `/docs/architecture/tag-driven-events.md` (45 min)
2. Read: `/TAG-DRIVEN-MIGRATION-COMPLETE.md` (20 min - sections 2-5)
3. Review: Migration SQL files (15 min)
4. Explore: Code files (hebcal.go, zmanim_service.go) (10 min)

**Outcome**: Can design new features, explain architecture to others

---

### Path 3: Deployment Execution
**Goal**: Deploy to production safely
**Time**: 60 minutes + deployment time

1. Read: `/DEPLOYMENT-CHECKLIST-TAG-DRIVEN.md` (30 min)
2. Review: `/docs/migration/eliminate-hardcoded-logic.md` (20 min - rollback section)
3. Prepare: Run pre-deployment checks (10 min)
4. Execute: Follow deployment steps
5. Validate: Post-deployment checks

**Outcome**: Successful production deployment with confidence

---

### Path 4: Troubleshooting
**Goal**: Debug production issues
**Time**: As needed

1. Start: `/docs/TAG-QUICK-START.md` - Debugging Checklist
2. Reference: `/docs/architecture/tag-driven-events.md` - Edge Cases section
3. Use: `/api/internal/calendar/SQL_VALIDATION_QUERIES.md`
4. Check: Validation scripts output
5. Review: Error logs with context

**Outcome**: Issue identified and resolved

---

### Path 5: Publisher Support
**Goal**: Help publishers configure tags
**Time**: 20 minutes

1. Read: `/CHANGELOG-tag-driven.md` (10 min)
2. Reference: `/docs/TAG-QUICK-START.md` - Common Tasks (5 min)
3. Show: Examples from `/docs/architecture/tag-driven-events.md` (5 min)

**Outcome**: Publisher can configure event-specific zmanim

---

## Code Reference

### Key Files

**Backend (Go)**:
- `/api/internal/calendar/hebcal.go` - HebCal API integration
- `/api/internal/calendar/events.go` - Event processing
- `/api/internal/calendar/db_adapter.go` - Database queries
- `/api/internal/services/zmanim_service.go` - Tag filtering logic
- `/api/internal/handlers/zmanim.go` - HTTP handler orchestration

**Database (SQL)**:
- `/api/internal/db/queries/tag_events.sql` - Event/tag queries
- `/api/internal/db/queries/zmanim_unified.sql` - Zmanim with tags

**Tests (Go)**:
- `/api/internal/calendar/events_test.go` - HebCal integration
- `/api/internal/calendar/events_tag_driven_test.go` - Tag filtering
- `/api/internal/calendar/events_coverage_test.go` - Coverage validation
- `/api/internal/calendar/zmanim_context_test.go` - End-to-end

---

## Search Index

### By Topic

**Adding Events**:
- Quick Start: Common Tasks → Task 1
- Architecture: Publisher Configuration → Event Assignment
- Migration: Phase 1 → Event Mappings
- Complete: Adding New Events section

**Tag Types**:
- Quick Start: Tag Types section
- Architecture: Data Model → Tag Types
- Migration: Phase 1 → Tag Schema

**Pattern Matching**:
- Quick Start: Pattern Matching section
- Architecture: Event Pattern Matching section
- Migration: Phase 1 → tag_event_mappings

**Debugging**:
- Quick Start: Debugging Checklist
- Architecture: Edge Cases and Troubleshooting
- Migration: Troubleshooting Guide
- Deployment: Validation Queries

**Performance**:
- Architecture: Performance Considerations
- Complete: Performance Considerations section
- Deployment: Monitoring Dashboards

**Testing**:
- Quick Start: Testing section
- Migration: Phase 3 → Testing
- Complete: Testing & Validation section
- Deployment: Test Matrix

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2025-12-24 | Initial tag-driven architecture documentation |

---

## Contributing

### Adding New Documentation

When adding new tag-driven documentation:

1. Add entry to this index
2. Link to related documents
3. Include in appropriate reading path
4. Update search index
5. Add to file inventory in Complete document

### Updating Existing Documentation

When updating tag-driven documentation:

1. Update version history
2. Review all cross-references
3. Update index if structure changed
4. Notify team of significant changes

---

## Quick Reference

### Most Common Tasks

| Task | Document | Section |
|------|----------|---------|
| Add new event | Quick Start | Task 1 |
| Debug zman not showing | Quick Start | Debugging Checklist |
| Understand architecture | Architecture | Overview |
| Deploy to production | Deployment | Deployment Steps |
| Add new zman with tags | Quick Start | Task 3 |
| Understand tag types | Architecture | Tag Types |
| Test event coverage | Migration | Phase 3 |
| Validate migration | Deployment | Validation Queries |

### Most Common Queries

```sql
-- What events are mapped?
SELECT * FROM tag_event_mappings;

-- What tags does a zman have?
SELECT zt.tag_key FROM publisher_zman_tags pzt
JOIN zman_tags zt ON pzt.tag_id = zt.id
JOIN publisher_zmanim pz ON pzt.publisher_zman_id = pz.id
WHERE pz.zman_key = 'YOUR_ZMAN' AND pz.publisher_id = YOUR_ID;

-- What's active today?
-- GET /api/v1/zmanim?date=today
-- Check: active_event_codes field
```

### Most Common Commands

```bash
# Validate event coverage
./scripts/validate-hebcal-coverage.sh

# Check for hardcoded logic
./scripts/validate-no-hardcoded-logic.sh

# Verify database consistency
./scripts/verify-hebcal-sync.sh

# Run tag-driven tests
cd api && go test -v ./internal/calendar -run TestTagDriven
```

---

## Support

**Questions?**
1. Check this index for relevant document
2. Review Quick Start for common tasks
3. Search Architecture for deep concepts
4. Run validation scripts for verification

**Found an issue?**
1. Check Troubleshooting sections
2. Review validation queries
3. Check error logs
4. Consult Migration guide

**Need help?**
1. Start with Quick Start
2. Follow appropriate Reading Path
3. Reference specific sections
4. Use Search Index for topics

---

## Summary

**Total Documentation**: ~2,500 lines across 6 major documents
**Test Coverage**: 40+ test scenarios
**Migration Files**: 5 SQL migrations
**Validation Scripts**: 3 automated checks
**Code Files**: 10 major files (5 modified, 5 created)

**Status**: COMPLETE and PRODUCTION READY

**Next Action**: Deploy to production using Deployment Checklist
