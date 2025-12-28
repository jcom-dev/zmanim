# Audit Trail System Mission: World-Class Activity Tracking

## Mission Objective
Design and implement a production-grade audit trail system that captures all API mutations, provides intuitive visualization for publishers and admins, and follows industry best practices from leading audit libraries and frameworks.

---

## Orchestrator Instructions

You are the **Audit Trail Orchestrator**. Your role is to:
1. **Delegate all work** to specialized sub-agents running in parallel
2. **Never perform direct code analysis, research, or implementation yourself**
3. **Synthesize findings** from research agents into actionable design
4. **Coordinate implementation** through parallel execution
5. **Ensure comprehensive testing** via unit, integration, and E2E tests
6. **Verify production readiness** through performance benchmarking

---

## Phase 1: Research & Discovery (Parallel Execution)

Launch these agents **simultaneously** to research best practices:

### Agent 1: Audit Library Researcher
**Task**: Research leading audit trail libraries and frameworks
```
Research and analyze:
1. **Go Libraries**:
   - go-audit-log (if exists)
   - Any PostgreSQL audit frameworks for Go
   - Event sourcing libraries (e.g., eventhorizon, goes)

2. **General Audit Systems**:
   - Supabase audit system
   - Hasura event triggers
   - AWS CloudTrail patterns
   - Stripe audit log API design
   - GitHub audit log
   - Auth0 audit logs

3. **Database Solutions**:
   - PostgreSQL audit trigger toolbox
   - pgaudit extension
   - Temporal tables (system versioning)
   - Change Data Capture (CDC) patterns

For each solution, document:
- Core features (filtering, search, exports)
- Data model (what fields they track)
- Performance characteristics
- UI/UX patterns for viewing logs
- API design patterns
- Retention policies
- Compliance features (GDPR, SOC2)

Deliverable: AUDIT_RESEARCH_LIBRARIES.md with:
- Library comparison matrix
- Recommended patterns to adopt
- Anti-patterns to avoid
- Performance benchmarks (if available)
```

### Agent 2: Data Model Researcher
**Task**: Research optimal audit log data structures
```
Research best practices for:
1. **Core Fields** (analyze across Stripe, GitHub, Auth0, Supabase):
   - Event ID (UUID vs ULID vs Snowflake)
   - Timestamp precision (RFC3339, Unix nanos)
   - Actor identification (user_id, impersonation, API keys)
   - Action/event type taxonomy
   - Resource identification (entity type + ID)
   - Change tracking (before/after, diff, full snapshot)
   - Metadata/context fields
   - IP address, user agent, geolocation
   - Request ID correlation
   - Status (success, failure, error codes)

2. **Advanced Features**:
   - Versioning/schema evolution
   - Related event linking (transaction grouping)
   - Retention tiers (hot/warm/cold storage)
   - Privacy/PII masking
   - Tamper-evident logging (cryptographic hashing)

3. **Indexing Strategy**:
   - Time-series optimization
   - Actor lookups
   - Resource lookups
   - Full-text search
   - Composite indexes

Deliverable: AUDIT_DATA_MODEL.md with:
- Recommended schema design
- Index strategy
- Partitioning approach (time-based)
- Comparison to existing `actions` table
- Migration plan from current schema
```

### Agent 3: API Design Researcher
**Task**: Research audit log API patterns
```
Analyze API designs from:
1. **Stripe Audit Logs API**:
   - Filtering (actor, resource, date ranges)
   - Pagination (cursor-based)
   - Export formats (JSON, CSV)
   - Rate limiting

2. **GitHub Audit Log API**:
   - Query syntax
   - Event type filtering
   - Organization vs repo scoping
   - Streaming endpoints

3. **Auth0 Logs API**:
   - Search query language
   - Log retention
   - Real-time webhooks

Design recommendations for:
- GET /api/v1/admin/audit-logs (admin view all)
- GET /api/v1/publisher/audit-logs (publisher view own)
- GET /api/v1/audit-logs/:id (single event)
- POST /api/v1/audit-logs/export (CSV/JSON export)
- Query parameters: ?actor_id, ?resource_type, ?resource_id, ?action, ?from, ?to, ?limit, ?cursor
- Real-time updates (WebSocket, SSE, or polling)

Deliverable: AUDIT_API_DESIGN.md with:
- OpenAPI spec draft
- Query parameter design
- Filtering/search capabilities
- Export functionality
- Performance considerations
```

### Agent 4: UI/UX Pattern Researcher
**Task**: Research audit log visualization best practices
```
Research UI patterns from:
1. **Stripe Dashboard** - Activity logs
2. **GitHub** - Audit log viewer
3. **Auth0** - Log streams
4. **AWS CloudTrail** - Event history
5. **Supabase** - Table activity
6. **Linear** - Issue activity feeds

Document:
- Timeline visualization patterns
- Filtering UI (date pickers, dropdowns, search)
- Diff visualization (before/after comparison)
- Actor display (with avatars, impersonation badges)
- Event grouping/threading
- Export UI flows
- Real-time update indicators
- Empty states and error handling
- Mobile responsiveness

Deliverable: AUDIT_UX_PATTERNS.md with:
- Wireframes/sketches (Excalidraw or text diagrams)
- Component breakdown
- Interaction flows
- Accessibility considerations
```

### Agent 5: Performance & Scale Researcher
**Task**: Research audit logging performance strategies
```
Research how to maintain performance with:
1. **Write Performance**:
   - Async/background logging patterns
   - Buffering strategies
   - Queue-based systems (Redis, PostgreSQL LISTEN/NOTIFY)
   - Failure handling (retry, dead letter queue)

2. **Read Performance**:
   - Partitioning strategies (monthly/quarterly tables)
   - Materialized views for aggregations
   - Caching hot queries
   - Archive/cold storage (S3, glacier)

3. **Scale Benchmarks**:
   - Expected write volume (events/second)
   - Read patterns (recent 90%, archive 10%)
   - Retention policies (90 days hot, 1 year warm, 7 years cold)
   - Disk space projections

Deliverable: AUDIT_PERFORMANCE.md with:
- Async logging architecture
- Partitioning strategy
- Retention implementation plan
- Performance benchmarks/targets
```

### Agent 6: Compliance & Security Researcher
**Task**: Research audit log compliance requirements
```
Research standards and best practices:
1. **Compliance Standards**:
   - SOC 2 audit log requirements
   - GDPR right to access/deletion
   - HIPAA audit requirements (if applicable)
   - PCI DSS logging standards

2. **Security Best Practices**:
   - Immutability guarantees
   - Tamper detection (hash chains, Merkle trees)
   - Access control (who can view audit logs)
   - PII handling (masking, encryption)
   - Separation of duties (no self-deletion)

3. **Data Retention**:
   - Legal retention requirements
   - Automated purging strategies
   - Archive compliance

Deliverable: AUDIT_COMPLIANCE.md with:
- Security requirements checklist
- Compliance feature list
- Data retention policies
- Access control matrix
```

---

## Phase 2: Design Synthesis (Sequential, After Phase 1)

### Agent 7: System Design Architect
**Task**: Synthesize all research into comprehensive system design
```
Input: All reports from Agents 1-6

Create master design document with:

1. **Data Model**:
   - Final audit_events table schema
   - Comparison with existing `actions` table
   - Migration strategy (if reusing vs new table)
   - Indexes and partitioning

2. **Architecture**:
   - Async logging pipeline (middleware → queue → writer)
   - Storage tier strategy (hot/warm/cold)
   - Read path optimization (cache, materialized views)
   - Integration points (all mutation handlers)

3. **API Specification**:
   - Complete OpenAPI spec for all endpoints
   - Query capabilities
   - Export functionality
   - Rate limiting

4. **UI Components**:
   - Component tree
   - Page layouts (admin vs publisher views)
   - Filtering and search UI
   - Real-time updates approach

5. **Implementation Plan**:
   - Phase 1: Core logging infrastructure
   - Phase 2: API endpoints
   - Phase 3: UI implementation
   - Phase 4: Advanced features (export, real-time)
   - Phase 5: Performance optimization
   - Phase 6: Compliance features

Deliverable: AUDIT_SYSTEM_DESIGN.md with:
- Complete technical specification
- Database DDL
- API OpenAPI spec
- UI component diagram
- Implementation roadmap
- Risk assessment
```

---

## Phase 3: Implementation (Parallel by Phase)

### Phase 3.1: Core Infrastructure (Parallel)

#### Agent 8: Database Schema Implementer
**Task**: Create audit log database schema
```
Implement based on AUDIT_SYSTEM_DESIGN.md:

1. Create migration file: db/migrations/YYYYMMDDHHMMSS_audit_trail_system.sql
2. Define audit_events table (or enhance actions table)
3. Create indexes for common queries
4. Set up partitioning (if using)
5. Add helper functions (diff generation, hash chain)
6. Create SQLc queries in api/internal/db/queries/audit.sql:
   - RecordAuditEvent
   - GetAuditEvents (with filtering)
   - GetAuditEventByID
   - GetAuditEventsByResource
   - GetAuditEventsByActor
   - ExportAuditEvents

Follow:
- docs/coding-standards.md (SQLc only, no raw SQL)
- Proper indexing strategy
- Comment all schema decisions

Deliverable:
- Migration SQL file
- SQLc query file
- Schema documentation
```

#### Agent 9: Audit Service Implementer
**Task**: Create core audit logging service
```
Implement api/internal/services/audit_service.go:

1. AuditService struct with:
   - Database queries
   - Redis client (for async queue)
   - Config (retention policies, async mode)

2. Core methods:
   - LogEvent(ctx, params) - async write to queue
   - ProcessEventQueue() - background worker
   - GetEvents(ctx, filters) - paginated retrieval
   - GetEventByID(ctx, id)
   - ExportEvents(ctx, filters, format) - CSV/JSON export
   - ComputeDiff(before, after) - JSON diff
   - GenerateEventHash(event) - tamper detection

3. Actor resolution:
   - Normal user (from JWT)
   - Admin impersonation (with badge)
   - API key usage (if applicable)
   - System actions (automated jobs)

4. Error handling:
   - Graceful degradation (log but don't fail request)
   - Retry logic for queue failures
   - Dead letter queue for failed writes

Follow:
- docs/coding-standards.md patterns
- Structured logging (slog)
- Comprehensive error handling

Deliverable:
- api/internal/services/audit_service.go
- Unit tests: api/internal/services/audit_service_test.go
- Service documentation
```

#### Agent 10: Middleware Implementer
**Task**: Create audit logging middleware
```
Implement api/internal/middleware/audit.go:

1. AuditMiddleware that:
   - Captures request context (method, path, params)
   - Extracts actor information
   - Logs response status
   - Computes request duration
   - Only logs mutations (POST, PUT, PATCH, DELETE)
   - Skips health checks, static assets

2. Integration points:
   - Apply to all /api/v1/publisher/* routes
   - Apply to all /api/v1/admin/* routes
   - Configurable exclusions

3. Payload capture:
   - Request body (with PII masking)
   - Response body (for before/after diffs)
   - Query parameters
   - Headers (sanitized)

Follow:
- docs/coding-standards.md middleware patterns
- Performance considerations (async logging)
- Security (no sensitive data leakage)

Deliverable:
- api/internal/middleware/audit.go
- Middleware tests
- Integration documentation
```

---

### Phase 3.2: Handler Integration (Parallel)

#### Agent 11: Publisher Handler Integrator
**Task**: Integrate audit logging into publisher handlers
```
Enhance these handlers in api/internal/handlers/:

1. publisher_profile.go:
   - UpdatePublisherProfile (capture before/after)
   - DeletePublisher

2. publisher_zmanim.go:
   - CreatePublisherZman
   - UpdatePublisherZman
   - DeletePublisherZman
   - PublishAlgorithm
   - SaveDraft

3. coverage.go:
   - CreatePublisherCoverage
   - UpdatePublisherCoverage
   - DeletePublisherCoverage

4. publisher_algorithm.go:
   - UpdateAlgorithm
   - PublishAlgorithm

For each handler:
- Fetch "before" state
- Call auditService.LogEvent() with before/after
- Include relevant metadata (algorithm version, coverage details)
- Handle errors gracefully

Deliverable:
- Updated handler files
- Unit tests for audit integration
- Verification script
```

#### Agent 12: Admin Handler Integrator
**Task**: Integrate audit logging into admin handlers
```
Enhance admin handlers:

1. Impersonation actions (if exists)
2. Publisher management (admin creating/modifying publishers)
3. System configuration changes
4. Bulk operations

Mark all admin actions with:
- Admin user ID
- Impersonation context (if acting as publisher)
- Admin-specific metadata

Deliverable:
- Updated admin handlers
- Admin audit event tests
- Documentation
```

---

### Phase 3.3: API Endpoints (Parallel)

#### Agent 13: Publisher Audit API Implementer
**Task**: Create publisher audit log endpoints
```
Implement in api/internal/handlers/publisher_audit.go:

1. GET /api/v1/publisher/audit-logs
   - Filter by: resource_type, resource_id, action, date_from, date_to
   - Pagination: cursor-based
   - Returns: event list with actor names, diffs
   - Only shows publisher's own events

2. GET /api/v1/publisher/audit-logs/:id
   - Single event detail
   - Full before/after payload
   - Related events

3. POST /api/v1/publisher/audit-logs/export
   - Format: CSV or JSON
   - Same filters as list endpoint
   - Streaming response for large exports

Follow:
- docs/coding-standards.md handler pattern (6-step)
- RespondJSON for responses
- Proper error handling

Deliverable:
- publisher_audit.go handler file
- OpenAPI spec update
- Handler tests
```

#### Agent 14: Admin Audit API Implementer
**Task**: Create admin audit log endpoints
```
Implement in api/internal/handlers/admin_audit.go:

1. GET /api/v1/admin/audit-logs
   - Same filters as publisher endpoint
   - PLUS: filter by publisher_id, actor_id
   - Can view ALL events across all publishers

2. GET /api/v1/admin/audit-logs/stats
   - Event counts by action type
   - Activity heatmap data
   - Top actors
   - Recent critical events

3. POST /api/v1/admin/audit-logs/export
   - Same as publisher, but full access

Deliverable:
- admin_audit.go handler file
- OpenAPI spec update
- Admin endpoint tests
```

---

### Phase 3.4: Frontend Implementation (Parallel)

#### Agent 15: Publisher Audit Page Implementer
**Task**: Create publisher audit log UI
```
Implement web/app/publisher/audit/page.tsx:

1. Components to create:
   - AuditEventList (timeline view)
   - AuditEventCard (single event display)
   - AuditFilters (date range, action type, resource type)
   - AuditEventDetails (modal with full diff)
   - ExportButton (download CSV/JSON)

2. Features:
   - Infinite scroll or cursor pagination
   - Real-time updates (polling every 30s or SSE)
   - Diff visualization (react-diff-viewer or similar)
   - Actor badges (user vs "Admin (Support)")
   - Relative timestamps with absolute on hover
   - Empty state ("No activity yet")
   - Error handling

3. Filtering UI:
   - Date range picker (shadcn/ui)
   - Action type dropdown
   - Resource type dropdown
   - Search by resource ID
   - Clear filters button

Follow:
- Existing component patterns in web/app/publisher/
- shadcn/ui components
- Responsive design
- Accessibility (ARIA labels)

Deliverable:
- web/app/publisher/audit/page.tsx
- Component files in web/components/audit/
- TypeScript types in web/lib/types/audit.ts
- Type check passing
```

#### Agent 16: Admin Audit Page Implementer
**Task**: Create admin audit log UI
```
Implement web/app/admin/audit/page.tsx:

1. Additional features vs publisher page:
   - Filter by publisher (dropdown)
   - Filter by actor
   - Stats dashboard (charts with recharts)
   - Bulk export
   - Search across all publishers

2. Charts/visualizations:
   - Activity timeline (events per day)
   - Action type breakdown (pie chart)
   - Top publishers by activity (bar chart)
   - Recent critical events (alerts)

3. Advanced filters:
   - Publisher selector (with search)
   - Actor selector
   - IP address filter
   - Status filter (success/failure)

Deliverable:
- web/app/admin/audit/page.tsx
- Admin audit components
- Dashboard visualizations
- Type check passing
```

#### Agent 17: API Client Implementer
**Task**: Add audit endpoints to API client
```
Enhance web/lib/api-client.ts:

1. Add methods:
   - api.getAuditLogs(filters, pagination)
   - api.getAuditLog(id)
   - api.exportAuditLogs(filters, format)
   - api.admin.getAuditLogs(filters, pagination)
   - api.admin.getAuditLogStats()

2. Types:
   - AuditEvent interface
   - AuditFilters interface
   - AuditExportFormat enum
   - PaginatedAuditResponse interface

3. Error handling:
   - Proper TypeScript types for responses
   - Error boundaries

Deliverable:
- Updated api-client.ts
- TypeScript types file
- Client usage documentation
```

---

### Phase 3.5: Advanced Features (Parallel)

#### Agent 18: Export Functionality Implementer
**Task**: Implement audit log export
```
Enhance backend export capabilities:

1. Export formats:
   - CSV: columns for all key fields + flattened metadata
   - JSON: full event objects
   - JSON Lines (streaming for large exports)

2. Streaming implementation:
   - Use Go streaming response
   - Handle large result sets (millions of records)
   - Progress indication (Content-Length header)

3. Export limits:
   - Max 100k events per export
   - Rate limiting (1 export per minute per user)
   - Background job for exports > 10k events

Deliverable:
- Export service methods
- Streaming response handlers
- Export tests
- Documentation
```

#### Agent 19: Real-Time Updates Implementer
**Task**: Add real-time audit log updates
```
Options to evaluate and implement best one:

1. **Server-Sent Events (SSE)** (recommended):
   - GET /api/v1/publisher/audit-logs/stream
   - Pushes new events as they occur
   - Auto-reconnect on disconnect

2. **WebSocket** (if SSE not suitable):
   - WS /api/v1/publisher/audit-logs/ws
   - Bidirectional (could support filtering updates)

3. **Polling** (fallback):
   - Frontend polls every 30s for new events
   - Includes "last_seen" parameter

Implement chosen approach with:
- Connection management
- Error handling
- Reconnection logic
- Frontend integration

Deliverable:
- Real-time endpoint implementation
- Frontend integration
- Connection tests
- Documentation
```

#### Agent 20: Diff Visualization Implementer
**Task**: Implement before/after diff visualization
```
Enhance frontend diff display:

1. Library evaluation:
   - react-diff-viewer
   - diff2html
   - Custom implementation with diff library

2. Features:
   - Side-by-side view (before | after)
   - Inline view (unified diff)
   - Syntax highlighting for JSON
   - Collapsible sections
   - Copy to clipboard
   - Expand/collapse unchanged sections

3. Special handling:
   - Large JSON objects (truncate, expand)
   - Binary data (show hash, size)
   - Sensitive fields (mask PII)

Deliverable:
- Diff component: web/components/audit/AuditDiff.tsx
- Diff tests
- Storybook stories (if applicable)
```

---

## Phase 4: Testing (Parallel)

### Agent 21: Unit Test Engineer
**Task**: Comprehensive unit test coverage
```
Create/enhance unit tests:

1. Backend tests:
   - api/internal/services/audit_service_test.go
   - api/internal/middleware/audit_test.go
   - api/internal/handlers/publisher_audit_test.go
   - api/internal/handlers/admin_audit_test.go

2. Test coverage:
   - All service methods
   - Edge cases (missing actor, malformed events)
   - Error handling
   - Diff generation
   - Hash verification

3. Run and verify:
   - cd api && go test ./... -cover
   - Target: >80% coverage for new code

Deliverable:
- Complete unit test suite
- Coverage report
- Test documentation
```

### Agent 22: Integration Test Engineer
**Task**: Create integration tests
```
Implement integration tests:

1. Database integration tests:
   - Event writing (single, batch)
   - Event retrieval with filters
   - Pagination correctness
   - Partitioning (if implemented)
   - Performance under load

2. API integration tests:
   - Full request/response cycle
   - Authentication/authorization
   - Filter combinations
   - Export functionality
   - Real-time streaming

3. Test fixtures:
   - Sample audit events
   - Test publishers and users
   - Various event types

Deliverable:
- Integration test suite
- Test fixtures
- CI integration
```

### Agent 23: E2E Test Engineer
**Task**: Create end-to-end Playwright tests
```
Implement tests/e2e/audit/*.spec.ts:

1. Publisher audit flow:
   - test('publisher can view their audit log')
   - test('publisher can filter events by date')
   - test('publisher can filter by action type')
   - test('publisher can view event details')
   - test('publisher can export audit log as CSV')
   - test('publisher cannot see other publisher events')

2. Admin audit flow:
   - test('admin can view all audit logs')
   - test('admin can filter by publisher')
   - test('admin can view stats dashboard')
   - test('admin can export full audit trail')

3. Real-time updates:
   - test('new audit events appear in real-time')
   - test('audit log updates when action performed')

4. Edge cases:
   - test('handles empty audit log gracefully')
   - test('handles large exports')
   - test('displays impersonation correctly')

Deliverable:
- tests/e2e/audit/publisher-audit.spec.ts
- tests/e2e/audit/admin-audit.spec.ts
- Test helpers/fixtures
- E2E passing in CI
```

### Agent 24: Performance Test Engineer
**Task**: Benchmark and optimize
```
Create performance tests:

1. Write benchmarks:
   - Audit event write throughput
   - Query performance with 1M, 10M events
   - Export performance
   - Real-time streaming load

2. Load testing:
   - Use k6 or similar
   - Simulate realistic load
   - Identify bottlenecks

3. Optimization:
   - Index tuning based on results
   - Query optimization
   - Caching strategy

4. Targets:
   - Write: < 10ms per event
   - Read (recent): < 100ms
   - Read (filtered): < 500ms
   - Export (10k events): < 5s

Deliverable:
- Performance test suite
- Benchmark results
- Optimization recommendations
- Performance documentation
```

---

## Phase 5: Documentation (Parallel)

### Agent 25: Technical Documentation Writer
**Task**: Create comprehensive documentation
```
Create documentation in docs/:

1. docs/features/audit-trail.md:
   - Feature overview
   - User guide (publisher and admin)
   - Screenshots/diagrams
   - Use cases

2. docs/architecture/audit-system.md:
   - System architecture diagram
   - Data flow
   - Database schema
   - Performance characteristics
   - Compliance features

3. docs/api/audit-endpoints.md:
   - API reference for all endpoints
   - Query parameter documentation
   - Example requests/responses
   - Rate limits

4. docs/development/audit-integration.md:
   - How to add audit logging to new handlers
   - Best practices
   - Troubleshooting

Deliverable:
- Complete documentation in docs/
- Updated INDEX.md files
- Diagrams (Excalidraw or Mermaid)
```

### Agent 26: Code Documentation Writer
**Task**: Add inline documentation
```
Enhance code documentation:

1. Go files:
   - Package documentation (doc.go)
   - Function/method godoc comments
   - Complex logic explanations

2. TypeScript files:
   - JSDoc comments for all exported functions
   - Interface/type documentation
   - Component props documentation

3. SQL files:
   - Query purpose comments
   - Parameter documentation
   - Performance notes

4. INDEX files:
   - Update api/internal/handlers/INDEX.md
   - Update api/internal/services/INDEX.md
   - Update web/components/INDEX.md

Deliverable:
- Comprehensive inline documentation
- Updated INDEX files
- README updates (if needed)
```

### Agent 27: Migration Guide Writer
**Task**: Create migration/deployment guide
```
Create docs/migration/audit-trail-deployment.md:

1. Pre-deployment checklist:
   - Database backup
   - Migration script testing
   - Rollback plan

2. Deployment steps:
   - Run database migration
   - Deploy backend changes
   - Deploy frontend changes
   - Enable async logging
   - Monitor for errors

3. Post-deployment verification:
   - Verify events being logged
   - Check dashboard functionality
   - Test exports
   - Performance monitoring

4. Rollback procedure:
   - How to disable audit logging
   - How to revert migration
   - Data preservation

Deliverable:
- Deployment guide
- Rollback procedure
- Monitoring checklist
```

---

## Phase 6: Final Validation (Sequential)

### Agent 28: Quality Assurance Validator
**Task**: Comprehensive QA validation
```
Perform end-to-end quality validation:

1. Functional testing:
   - All user stories validated
   - All acceptance criteria met
   - Edge cases handled
   - Error states graceful

2. CI/CD validation:
   - ./scripts/validate-ci-checks.sh passes
   - cd api && go test ./... passes
   - cd api && sqlc generate clean
   - cd web && npm run type-check passes
   - E2E tests pass

3. Performance validation:
   - All benchmarks meet targets
   - No performance regressions
   - Load testing successful

4. Security validation:
   - No PII leakage
   - Access control verified
   - Audit logs immutable
   - Compliance requirements met

5. Documentation validation:
   - All docs complete and accurate
   - Code examples work
   - Diagrams clear

Deliverable: AUDIT_QA_REPORT.md with:
- Test results matrix
- Issues found (if any)
- Sign-off checklist
- Production readiness assessment
```

---

## Success Criteria

### Functional Requirements
- ✅ All API mutations logged automatically
- ✅ Publisher can view their own audit trail
- ✅ Admin can view all audit trails
- ✅ Before/after state captured for all changes
- ✅ Actor identification (user, admin, impersonation)
- ✅ Filtering by date, action, resource
- ✅ Export to CSV and JSON
- ✅ Real-time updates (SSE or polling)
- ✅ Diff visualization for changes
- ✅ Search and pagination

### Performance Requirements
- ✅ Audit logging adds < 10ms to request latency
- ✅ Async logging for non-blocking writes
- ✅ Query recent logs (30 days) < 100ms
- ✅ Query historical logs (1 year) < 500ms
- ✅ Export 10k events < 5s
- ✅ Handle 1M+ events without degradation

### Security & Compliance
- ✅ Immutable audit logs (no deletion by users)
- ✅ Tamper detection (hash verification)
- ✅ Access control (publishers see own, admins see all)
- ✅ PII masking where required
- ✅ Retention policy implementation
- ✅ Audit log for audit log access (meta-auditing)

### Code Quality
- ✅ All CI checks pass
- ✅ Unit test coverage > 80% for new code
- ✅ E2E tests for all user flows
- ✅ Performance tests passing
- ✅ SQLc queries only (no raw SQL)
- ✅ docs/coding-standards.md compliance
- ✅ No TODO/FIXME in production code
- ✅ Comprehensive documentation

### User Experience
- ✅ Intuitive timeline UI
- ✅ Clear diff visualization
- ✅ Responsive design (mobile-friendly)
- ✅ Accessible (WCAG AA)
- ✅ Empty states and error handling
- ✅ Export functionality easy to use
- ✅ Real-time updates work smoothly

---

## Orchestrator Execution Checklist

```markdown
## Phase 1: Research (Parallel)
- [ ] Launch Agents 1-6 simultaneously (single message, 6 Task tool calls)
- [ ] Wait for all research agents to complete
- [ ] Review all deliverables for completeness
- [ ] Identify any gaps requiring follow-up research

## Phase 2: Design (Sequential)
- [ ] Launch Agent 7 with all Phase 1 research outputs
- [ ] Review AUDIT_SYSTEM_DESIGN.md thoroughly
- [ ] Get user approval for design before implementation

## Phase 3: Implementation

### Phase 3.1: Infrastructure (Parallel)
- [ ] Launch Agents 8-10 in parallel (database, service, middleware)
- [ ] Verify all infrastructure components working
- [ ] Run basic integration tests

### Phase 3.2: Handler Integration (Parallel)
- [ ] Launch Agents 11-12 in parallel
- [ ] Verify audit logging triggered on mutations
- [ ] Test before/after capture

### Phase 3.3: API Endpoints (Parallel)
- [ ] Launch Agents 13-14 in parallel
- [ ] Verify OpenAPI spec updated
- [ ] Test all endpoints with curl/Postman

### Phase 3.4: Frontend (Parallel)
- [ ] Launch Agents 15-17 in parallel
- [ ] Verify UI renders correctly
- [ ] Test filtering, pagination, exports

### Phase 3.5: Advanced Features (Parallel)
- [ ] Launch Agents 18-20 in parallel
- [ ] Test export functionality
- [ ] Verify real-time updates
- [ ] Test diff visualization

## Phase 4: Testing (Parallel)
- [ ] Launch Agents 21-24 in parallel (unit, integration, E2E, performance)
- [ ] Review all test results
- [ ] Address any test failures
- [ ] Verify coverage targets met

## Phase 5: Documentation (Parallel)
- [ ] Launch Agents 25-27 in parallel
- [ ] Review all documentation for accuracy
- [ ] Verify code examples work
- [ ] Update all INDEX.md files

## Phase 6: Final Validation (Sequential)
- [ ] Launch Agent 28 for comprehensive QA
- [ ] Review QA report
- [ ] Address any issues found
- [ ] Get final user sign-off

## Production Readiness
- [ ] All tests passing (unit, integration, E2E)
- [ ] All CI checks passing
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Migration guide ready
- [ ] Deployment plan reviewed
- [ ] Rollback procedure documented
- [ ] User acceptance complete
```

---

## Orchestrator Execution Command

**When ready to begin**, the orchestrator should state:

```
I am the Audit Trail Orchestrator. I will execute this mission by delegating all work to specialized sub-agents. I will NOT perform any direct research, coding, or documentation myself.

Starting Phase 1: Launching 6 research agents in parallel to discover best practices from industry-leading audit systems...
```

---

## Notes for Orchestrator

### Agent Execution
- Use `Task` tool with `subagent_type='bmad:bmm:agents:dev'` for ALL agents
- Use `model='sonnet'` for all agents (cost-effective, high-quality)
- Launch parallel agents in **single response** with multiple Task tool calls
- Use `run_in_background=true` for long-running agents (> 2 min expected)
- Collect background results with `TaskOutput` tool when ready

### Context Management
- Provide each agent with specific file paths from codebase
- Include relevant sections from docs/coding-standards.md
- Pass research outputs from Phase 1 to Phase 2 agent
- Pass design doc from Phase 2 to Phase 3 agents

### Quality Control
- Review each agent's deliverable before proceeding
- Require structured outputs (markdown, code files, test files)
- Verify all CI checks after each implementation phase
- Get user approval before major phase transitions

### Performance Monitoring
- Track agent execution times
- Identify bottlenecks in orchestration
- Optimize parallel execution where possible
- Provide progress updates to user

### Deliverable Synthesis
- Don't just concatenate agent outputs
- Synthesize findings into coherent narratives
- Highlight key decisions and trade-offs
- Provide executive summaries for user

### Error Handling
- If agent fails, analyze why and retry with clearer instructions
- If multiple agents fail on same issue, escalate to user
- Keep user informed of any blockers
- Have fallback plans for critical components

---

## Final Deliverables Checklist

Upon mission completion, verify these artifacts exist:

### Research Phase
- [ ] AUDIT_RESEARCH_LIBRARIES.md
- [ ] AUDIT_DATA_MODEL.md
- [ ] AUDIT_API_DESIGN.md
- [ ] AUDIT_UX_PATTERNS.md
- [ ] AUDIT_PERFORMANCE.md
- [ ] AUDIT_COMPLIANCE.md

### Design Phase
- [ ] AUDIT_SYSTEM_DESIGN.md (master design document)

### Implementation
- [ ] Database migration: db/migrations/*_audit_trail_system.sql
- [ ] SQLc queries: api/internal/db/queries/audit.sql
- [ ] Audit service: api/internal/services/audit_service.go
- [ ] Middleware: api/internal/middleware/audit.go
- [ ] Publisher handlers: updated with audit logging
- [ ] Admin handlers: updated with audit logging
- [ ] Publisher API: api/internal/handlers/publisher_audit.go
- [ ] Admin API: api/internal/handlers/admin_audit.go
- [ ] API client: web/lib/api-client.ts (enhanced)
- [ ] Publisher UI: web/app/publisher/audit/page.tsx
- [ ] Admin UI: web/app/admin/audit/page.tsx
- [ ] Audit components: web/components/audit/*
- [ ] Export functionality
- [ ] Real-time updates
- [ ] Diff visualization

### Testing
- [ ] Unit tests: api/internal/services/audit_service_test.go
- [ ] Unit tests: api/internal/middleware/audit_test.go
- [ ] Unit tests: api/internal/handlers/*_audit_test.go
- [ ] Integration tests
- [ ] E2E tests: tests/e2e/audit/*.spec.ts
- [ ] Performance tests and benchmarks

### Documentation
- [ ] docs/features/audit-trail.md
- [ ] docs/architecture/audit-system.md
- [ ] docs/api/audit-endpoints.md
- [ ] docs/development/audit-integration.md
- [ ] docs/migration/audit-trail-deployment.md
- [ ] Updated INDEX.md files
- [ ] Inline code documentation (godoc, JSDoc)

### Quality Assurance
- [ ] AUDIT_QA_REPORT.md
- [ ] All CI checks passing
- [ ] Performance benchmarks met
- [ ] Security validation complete
- [ ] User acceptance sign-off

---

## Mission Complete

When all deliverables are verified and QA passes, the orchestrator should provide:

1. **Executive Summary**: High-level overview of what was built
2. **Key Features**: List of implemented capabilities
3. **Performance Results**: Before/after metrics
4. **Test Coverage**: Summary of test results
5. **Documentation Map**: Where to find all documentation
6. **Deployment Instructions**: How to deploy to production
7. **Next Steps**: Recommended follow-up work (if any)

The audit trail system is now production-ready! 🎉
