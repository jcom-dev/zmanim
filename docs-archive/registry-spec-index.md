# Publisher Zmanim Registry Interface - Specification Index

**Generated:** 2025-12-22
**Product Brief:** [product-brief-publisher-zmanim-registry-2025-12-22.md](product-brief-publisher-zmanim-registry-2025-12-22.md)

---

## Executive Summary

This index links all implementation-ready specifications for the Publisher Zmanim Registry Interface, a dual-mode registry explorer that transforms publisher onboarding from a steep learning curve to a guided discovery experience.

### Key Statistics

| Metric | Value |
|--------|-------|
| **Sprint/Epic** | Sprint 11 = Epic 11 |
| **Total Stories** | 26 |
| **Total Story Points** | 155 points |
| **Estimated Duration** | 9-10 weeks (5 sprints) |
| **Functional Requirements** | 51 |
| **Non-Functional Requirements** | 32 |
| **New API Endpoints** | 8 |
| **New Frontend Components** | 6 |
| **Database Schema Changes** | 3 tables extended |

---

## Core Documents

### 1. Product Requirements Document (PRD)
**File:** [prd-publisher-zmanim-registry-2025-12-22.md](prd-publisher-zmanim-registry-2025-12-22.md)

Comprehensive requirements covering:
- 51 functional requirements with acceptance criteria
- 32 non-functional requirements (performance, security, usability)
- Technical architecture (API endpoints, database schema, components)
- Data migration requirements (documentation backfill + Publisher 1 audit)
- UX/UI specifications with ASCII mockups
- Risk assessment & mitigation strategies
- Testing requirements (unit, integration, E2E, accessibility)
- Success metrics & KPIs
- Deployment & rollout plan

**Key Sections:**
- **Functional Requirements:** FR1-FR51 covering all user workflows
- **Technical Architecture:** 8 API endpoints, 6 components, SQLc queries
- **Data Migration:** 172+ zmanim documentation backfill process
- **Risk Assessment:** 12 risks with probability, impact, mitigation

---

### 2. Epic & Story Breakdown
**File:** [epics-publisher-zmanim-registry-2025-12-22.md](epics-publisher-zmanim-registry-2025-12-22.md)

Single Epic 11 with 26 user stories:

**Epic 11: Publisher Zmanim Registry Interface**

Single comprehensive epic with 26 stories organized in 5 sequential phases:

| Phase | Focus | Stories |
|-------|-------|---------|
| **Phase 1: Foundation** | Documentation backfill + Publisher 1 audit + Schema | 11.1-11.3 |
| **Phase 2: Infrastructure** | API endpoints, database, page scaffold | 11.4-11.8 |
| **Phase 3: Master Registry** | Tab 1: Browse, search, import, request | 11.9-11.13 |
| **Phase 4: Publisher Examples** | Tab 2: Selection, filters, link, copy | 11.14-11.19 |
| **Phase 5: Launch** | Info modals, greenfield cleanup, polish, E2E | 11.20-11.26 |

**Note:** Epic 11 = Sprint 11 (155 points, 9-10 weeks, unified delivery)

**Each Story Includes:**
- User story format (As a... I want... So that...)
- Detailed acceptance criteria (Given/When/Then)
- Technical implementation notes
- Clear dependencies

---

### 3. Sprint Plan
**File:** [sprint-plan-publisher-zmanim-registry-2025-12-22.md](sprint-plan-publisher-zmanim-registry-2025-12-22.md)

Single comprehensive sprint:

| Sprint | Duration | Points | Goal |
|--------|----------|--------|------|
| **Sprint 11** | 9-10 weeks | 155 | Complete Publisher Zmanim Registry Interface with documentation, infrastructure, UI, and launch |

**Epic 11 Phases:**
- **Phase 1: Foundation** (Stories 11.1-11.3, 26 points) - Documentation backfill + Publisher 1 audit + Schema (BLOCKING)
- **Phase 2: Infrastructure** (Stories 11.4-11.8, 29 points) - API endpoints, database migrations, page scaffold
- **Phase 3: Master Registry** (Stories 11.9-11.13, 27 points) - Tab 1: list, search, import, request
- **Phase 4: Publisher Examples** (Stories 11.14-11.19, 39 points) - Tab 2: selection, filters, link, copy
- **Phase 5: Launch** (Stories 11.20-11.26, 34 points) - Info modals, greenfield cleanup, polish, E2E testing

**Critical Path:**
- Phase 1 (Foundation) must complete before other phases (data quality gates)
- Phase 2 (Infrastructure) gates Phase 3 & 4 (UI work)
- Phase 5 (Launch) requires Phase 3 & 4 completion

---

### 4. Story Context Document
**File:** [story-context-publisher-zmanim-registry-2025-12-22.md](story-context-publisher-zmanim-registry-2025-12-22.md)

Comprehensive implementation context:
- **Existing Code Patterns:** 6-step handler, useApi hook, React Query
- **Component Patterns:** 122 existing components, reusable references
- **API Handler Patterns:** Security, validation, response patterns
- **Database Query Patterns:** SQLc usage, soft deletes, indexes
- **DSL Integration:** Syntax highlighting, formula validation
- **Security Patterns:** PublisherResolver (CRITICAL), IDOR prevention
- **Data Models:** Database schema, Go types, response structures
- **Reusable Components:** LocalityPicker, HighlightedFormula, ZmanName
- **Coding Standards:** 7 PR blocker rules, zero tolerance policies
- **Migration Plan:** Clean slate approach, what to remove

**Key References:**
- `/home/daniel/repos/zmanim/docs/coding-standards.md`
- `/home/daniel/repos/zmanim/web/components/INDEX.md`
- `/home/daniel/repos/zmanim/api/internal/handlers/INDEX.md`
- `/home/daniel/repos/zmanim/api/internal/db/queries/INDEX.md`
- `/home/daniel/repos/zmanim/docs/dsl-complete-guide.md`

---

## Pre-Launch Blockers

### Critical Dependencies (Sprint 0)

1. **Master Registry Documentation Backfill**
   - **Stories:** Epic 1 (5 stories, 26 points total in Sprint 0)
   - **Requirement:** All 172+ master zmanim must have comprehensive documentation
   - **Source:** KosherJava research extraction
   - **Deliverable:** `master_zmanim_registry` table populated with:
     - `halachic_basis` (comprehensive explanation)
     - `common_uses` (practical applications)
     - `halachic_sources` (rabbinic sources with citations)
     - `related_zmanim_ids` (cross-references)
   - **Acceptance:** No master zman has NULL documentation fields

2. **Publisher 1 Data Integrity Audit**
   - **Stories:** Epic 2 (5 stories, subset of Sprint 0 points)
   - **Requirement:** Validate all Publisher 1 zmanim have correct `master_zmanim_id` linkages
   - **Process:**
     1. Extract Publisher 1 catalog with formulas
     2. Compare formulas to master registry
     3. Identify correct mappings
     4. Create missing master entries if needed
     5. Apply corrections to `publisher_zmanim` table
   - **Deliverable:** Audit report + correction SQL scripts
   - **Acceptance:** 100% of Publisher 1 zmanim have validated linkages

**Why Blocking:**
- Without complete master documentation, registry browser shows incomplete data
- Without validated Publisher 1 examples, publisher browser shows incorrect mappings
- Data quality directly impacts user trust in the system

---

## Success Metrics

### Adoption Metrics (Primary)
- **70% of publishers** browse registry before adding their first zman
- **50% of publishers** use Import action at least once
- **30% of publishers** explore publisher examples tab

### Quality Metrics (Primary)
- **Zero duplicate master zmanim** created after launch
- **<5% publisher support requests** about "how to add a zman"
- **95% of publisher zmanim** correctly linked to master registry

### Behavioral Metrics (Secondary)
- Average time to add first zman: **<5 minutes** (vs. 15+ min baseline)
- Info modal engagement: **40% of users** click at least one info button
- Request addition usage: **10+ requests** in first month

### Business Metrics (Tertiary)
- Publisher onboarding completion rate: **+20%** increase
- Publisher catalog size: **+30%** average zmanim per publisher
- Publisher satisfaction (NPS): **+15 points** improvement

---

## Technical Architecture Summary

### API Endpoints (8 new)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/publisher/registry/master` | GET | Publisher | List master zmanim with pagination/filters |
| `/api/v1/publisher/registry/master/:id` | GET | Publisher | Get master zman detail with documentation |
| `/api/v1/publisher/registry/master/:id/preview` | POST | Publisher | Preview master zman for location |
| `/api/v1/publisher/registry/publishers` | GET | Publisher | List publishers for examples browser |
| `/api/v1/publisher/registry/publishers/:id/zmanim` | GET | Publisher | Get publisher's zmanim catalog |
| `/api/v1/publisher/registry/publishers/:id/coverage` | GET | Publisher | Check publisher coverage for locality |
| `/api/v1/publisher/zmanim/import` | POST | Publisher | Import from master registry |
| `/api/v1/publisher/zmanim/request` | POST | Publisher | Request new master zman addition |

### Frontend Components (6 new)

| Component | Path | Purpose |
|-----------|------|---------|
| `RegistryPage` | `web/app/publisher/registry/page.tsx` | Two-tab registry explorer |
| `MasterRegistryTab` | `web/components/registry/MasterRegistryTab.tsx` | Master zmanim browser |
| `PublisherExamplesTab` | `web/components/registry/PublisherExamplesTab.tsx` | Publisher examples browser |
| `MasterZmanDetailModal` | `web/components/registry/MasterZmanDetailModal.tsx` | Master zman info modal |
| `PublisherZmanDetailModal` | `web/components/registry/PublisherZmanDetailModal.tsx` | Publisher zman info modal |
| `RequestZmanModal` | `web/components/registry/RequestZmanModal.tsx` | Request new addition |

### Database Schema Changes

**Table: `master_zmanim_registry`**
```sql
ALTER TABLE master_zmanim_registry
  ADD COLUMN halachic_basis TEXT,
  ADD COLUMN common_uses TEXT,
  ADD COLUMN halachic_sources JSONB,
  ADD COLUMN related_zmanim_ids INTEGER[],
  ADD COLUMN filterable_tags TEXT[];
```

**Table: `publisher_zmanim`**
```sql
ALTER TABLE publisher_zmanim
  ADD COLUMN attribution_publisher_id INTEGER REFERENCES publishers(id),
  ADD COLUMN attribution_type TEXT CHECK (attribution_type IN ('import', 'link', 'copy'));
```

---

## Risk Assessment Summary

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Documentation backfill takes longer than estimated | Medium | High | Parallelize extraction, weekly progress reviews |
| Publisher 1 audit reveals systematic errors | Medium | High | Early audit in Sprint 0, correction scripts |
| Duplicate prevention logic has edge cases | Low | Medium | Comprehensive test coverage, staged rollout |
| Performance issues with large registries | Low | Medium | Pagination, indexes, caching strategy |
| Users don't discover registry tab | Medium | Medium | Prominent navigation, onboarding tooltips |
| Info modals become cluttered | Low | Low | Progressive disclosure, user testing |

---

## Implementation Checklist

### Phase 1: Foundation (Stories 11.1-11.3) - BLOCKING
- [ ] Extract KosherJava documentation for all 172+ master zmanim
- [ ] Populate `master_zmanim_registry` documentation fields
- [ ] Run Publisher 1 audit (extract, compare, identify, correct)
- [ ] Apply Publisher 1 corrections to database
- [ ] Extend database schema (documentation, attribution fields)
- [ ] Create indexes for filterable_tags, related_zmanim_ids
- [ ] Validate data quality gates (no NULL documentation, 100% linkage)

### Phase 2: Infrastructure (Stories 11.4-11.8)
- [ ] Implement 8 new API endpoints with PublisherResolver
- [ ] Create SQLc queries for registry operations
- [ ] Add duplicate prevention constraints
- [ ] Scaffold `/publisher/registry` page with two tabs
- [ ] Add "Browse Registry" button to algorithm page
- [ ] Update navigation to include registry link

### Phase 3: Master Registry (Stories 11.9-11.13)
- [ ] Build master registry table with pagination
- [ ] Implement search & filters (category, tags, ownership)
- [ ] Add location selection for preview times
- [ ] Implement import action with duplicate check
- [ ] Build request addition modal
- [ ] Add ownership indicators (imported, custom)

### Phase 4: Publisher Examples (Stories 11.14-11.19)
- [ ] Build publisher selection & catalog display
- [ ] Add coverage-restricted location selection
- [ ] Implement publisher catalog filters
- [ ] Build link action with duplicate check
- [ ] Build copy action with duplicate check
- [ ] Add attribution metadata display

### Phase 5: Launch (Stories 11.20-11.26)
- [ ] Build master zman detail modal (full-screen)
- [ ] Build publisher zman detail modal
- [ ] Implement expandable halachic sources
- [ ] Add related zmanim navigation
- [ ] Remove old add zman dialog completely (greenfield)
- [ ] Implement focus parameter for algorithm page
- [ ] Run E2E testing (Playwright scenarios)
- [ ] Conduct accessibility audit
- [ ] Deploy to production

---

## Related Documentation

### Research Foundation
- [product-brief-publisher-zmanim-registry-2025-12-22.md](product-brief-publisher-zmanim-registry-2025-12-22.md) - Original product brief
- [kosherjava-research-index.md](kosherjava-research-index.md) - Documentation source
- [master-registry-gap-analysis.md](master-registry-gap-analysis.md) - Current state assessment
- [registry-completion-plan.md](registry-completion-plan.md) - Data backfill strategy

### Technical Documentation
- [coding-standards.md](coding-standards.md) - **MANDATORY:** Read before any task
- [dsl-complete-guide.md](dsl-complete-guide.md) - DSL syntax reference
- [ux-dsl-editor-inline-guidance.md](ux-dsl-editor-inline-guidance.md) - Editor UX patterns

### Component References
- [../web/components/INDEX.md](../web/components/INDEX.md) - 122 existing components
- [../api/internal/handlers/INDEX.md](../api/internal/handlers/INDEX.md) - Handler patterns
- [../api/internal/db/queries/INDEX.md](../api/internal/db/queries/INDEX.md) - Query patterns

---

## Next Steps

1. **Review & Approve Specifications**
   - Review PRD with stakeholders
   - Validate epic breakdown aligns with business priorities
   - Confirm sprint plan timeline and resource allocation

2. **Initiate Sprint 11 / Epic 11**
   - Assign Phase 1 (Foundation) stories to data team
   - Set up daily standups for backfill progress
   - Establish data quality gates
   - Phase 1 is BLOCKING - must complete before Phase 2-5

3. **Prepare Development Environment**
   - Review story context document
   - Set up testing infrastructure
   - Configure CI/CD for new endpoints

4. **Begin Implementation**
   - Start Phase 1 (Foundation) immediately (blocking work)
   - Schedule Phase 2 (Infrastructure) kickoff after data validation
   - Set up monitoring for success metrics
   - Track progress across all 5 phases within Epic 11

---

**Document Status:** ✅ Complete - Ready for Implementation
**Last Updated:** 2025-12-22
**Generated By:** Claude Code (Parallel Workflow Orchestration)
