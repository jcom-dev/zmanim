# Performance Optimization Mission: Zmanim Service

## Mission Objective
Transform the zmanim calculation system from 3+ second response times to sub-200ms through comprehensive auditing, optimization planning, and systematic execution using parallel sub-agents.

---

## Orchestrator Instructions

You are the **Performance Optimization Orchestrator**. Your role is to:
1. **Delegate all work** to specialized sub-agents running in parallel
2. **Never perform direct code analysis or edits yourself**
3. **Synthesize findings** from sub-agents into actionable plans
4. **Verify results** through performance benchmarking
5. **Ensure zero regressions** via comprehensive testing

---

## Phase 1: Comprehensive Audit (Parallel Execution)

Launch these agents **simultaneously** to map the entire system:

### Agent 1: Endpoint Usage Analyzer
**Task**: Map all endpoints that use ZmanimService
```
Find and document:
1. All HTTP handlers calling zmanimService.CalculateZmanim()
2. All HTTP handlers calling zmanimService.CalculateRange()
3. Request patterns: daily, weekly, monthly, yearly, reports, exports
4. Current response time baselines for each endpoint
5. Request frequency/usage patterns from logs (if available)

Deliverable: Markdown table with columns:
- Endpoint path
- Handler file:line
- Service method called
- Date range (1 day, 7 days, 30 days, 365 days)
- Current avg response time
- Cache status (enabled/disabled)
- Critical path analysis
```

### Agent 2: Database Query Profiler
**Task**: Audit all database queries in the calculation pipeline
```
Analyze:
1. api/internal/db/queries/*.sql files used by ZmanimService
2. Query frequency in hot paths (GetPublisherZmanim, GetEffectiveLocalityLocation, etc.)
3. Missing indexes (use EXPLAIN ANALYZE on PostgreSQL)
4. N+1 query patterns
5. Table sizes and query performance

Deliverable: SQL optimization report with:
- Query file:name
- Execution frequency per request
- Current execution time (EXPLAIN ANALYZE)
- Missing indexes
- Proposed optimizations
```

### Agent 3: Service Layer Analyzer
**Task**: Deep-dive into ZmanimService implementation
```
Analyze api/internal/services/zmanim_service.go:
1. CalculateZmanim() call graph and dependencies
2. CalculateRange() loop inefficiencies
3. Cache key design and hit rate potential
4. Preload parameter usage (PreloadedLocation, PreloadedPublisherZman)
5. Unnecessary repeated work (duplicate calendar context fetches)
6. Opportunity for batch operations

Deliverable: Service optimization checklist:
- Method signature improvements
- Preloading opportunities
- Batch operation candidates
- Cache key enhancements
- Dead code removal
```

### Agent 4: Calendar Integration Profiler
**Task**: Analyze HebCal/Calendar service integration
```
Analyze api/internal/services/calendar/*.go:
1. GetZmanimContext() call frequency and cost
2. External API calls (HebCal) vs cached data
3. Redundant calendar context fetches
4. Batch calendar context retrieval opportunities
5. Database tag_event_mappings query efficiency

Deliverable: Calendar optimization plan:
- API call reduction strategies
- Batch context fetch design
- Caching improvements
- Database query optimizations
```

### Agent 5: Handler Layer Profiler
**Task**: Audit all handler implementations for inefficiencies
```
Analyze api/internal/handlers/*:
1. publisher_zmanim.go (GetPublisherZmanimWeek, etc.)
2. publisher_reports.go (GenerateWeeklyCalendarPDF, etc.)
3. calendar.go (GetWeekCalendar, GetWeekEventInfo)
4. Duplicate work before service calls
5. Sequential vs parallel opportunities
6. Response transformation overhead

Deliverable: Handler optimization checklist:
- Pre-query consolidation
- Parallel execution opportunities
- Response caching candidates
- Unnecessary data fetches
```

### Agent 6: Database Schema Analyzer
**Task**: PostgreSQL schema and index analysis
```
Analyze database schema:
1. Tables: publishers, publisher_zmanim, geo_localities, zman_tags, tag_event_mappings
2. Existing indexes (use \di+ in psql)
3. Missing composite indexes for common query patterns
4. Table statistics (row counts, bloat)
5. Foreign key performance

Deliverable: Index optimization DDL:
- CREATE INDEX statements for missing indexes
- Rationale for each index
- Impact estimation
```

---

## Phase 2: Optimization Planning (Sequential, After Phase 1)

### Agent 7: Master Plan Synthesizer
**Task**: Combine all audit findings into prioritized execution plan
```
Input: Reports from Agents 1-6

Create comprehensive optimization plan with:
1. **Quick Wins** (< 1 hour, high impact)
   - Missing indexes
   - Obvious N+1 fixes
   - Cache key fixes

2. **Medium Complexity** (1-4 hours)
   - Preload parameter implementation
   - Batch query refactoring
   - Handler consolidation

3. **Major Refactors** (4+ hours)
   - Service method signature changes
   - Calendar context batching architecture
   - Response caching layer

4. **Performance Targets** per endpoint type:
   - Daily: < 50ms (cached), < 200ms (cold)
   - Weekly: < 100ms (cached), < 400ms (cold)
   - Monthly: < 300ms (cached), < 1000ms (cold)
   - Yearly: < 2s (cached), < 8s (cold)

Deliverable: OPTIMIZATION_PLAN.md with:
- Prioritized task list (High/Medium/Low impact)
- Estimated implementation time
- Risk assessment
- Rollback plan
- Performance benchmarks for verification
```

---

## Phase 3: Implementation (Parallel by Priority Tier)

### Execution Strategy
```
For each tier (Quick Wins → Medium → Major):
  1. Launch parallel implementation agents (one per task)
  2. Each agent:
     - Reads coding-standards.md
     - Implements optimization
     - Writes unit tests
     - Documents changes
     - Measures performance improvement
  3. Orchestrator reviews and validates
  4. Run CI checks via ./scripts/validate-ci-checks.sh
  5. Benchmark before/after
  6. Proceed to next tier only if targets met
```

### Agent Template: Implementation Agent
**Task**: Implement specific optimization from plan
```
Input:
- Optimization task description
- Target files
- Performance baseline

Execute:
1. Read docs/coding-standards.md
2. Implement optimization following patterns
3. Update tests
4. Measure performance (before/after)
5. Document changes

Deliverable:
- Code changes (via Edit/Write tools)
- Test coverage
- Performance metrics (% improvement)
- Migration notes (if schema changes)
```

---

## Phase 4: Verification & Benchmarking

### Agent 8: Performance Validator
**Task**: Comprehensive performance regression testing
```
For each optimized endpoint:
1. Cold cache test (clear Redis, measure first request)
2. Warm cache test (measure subsequent requests)
3. Load test (measure p50, p95, p99 under load)
4. Compare against baselines from Phase 1
5. Verify correctness (response data unchanged)

Deliverable: PERFORMANCE_REPORT.md
- Endpoint-by-endpoint improvements
- Cache hit rates
- Database query count reduction
- Response time percentiles
- Regressions (if any)
```

### Agent 9: CI/CD Validator
**Task**: Ensure all checks pass
```
Run:
1. ./scripts/validate-ci-checks.sh
2. SQLc generation (cd api && sqlc generate)
3. Type checking (cd web && npm run type-check)
4. Unit tests (cd api && go test ./...)
5. E2E critical paths (if applicable)

Deliverable: CI_STATUS.md
- All check results
- Any failures with remediation
```

---

## Phase 5: Documentation & Monitoring

### Agent 10: Documentation Writer
**Task**: Update all relevant documentation
```
Update:
1. api/internal/handlers/INDEX.md - performance notes
2. api/internal/services/INDEX.md - optimization patterns
3. docs/architecture/performance.md - new caching strategies
4. CHANGELOG.md - performance improvements
5. Code comments for complex optimizations

Deliverable: Updated documentation files
```

### Agent 11: Monitoring Setup
**Task**: Add observability for ongoing performance tracking
```
Implement:
1. slog metrics for cache hit/miss rates
2. Request duration logging per endpoint
3. Database query count tracking
4. Slow query alerts (> 500ms)
5. Dashboard queries (if Grafana/similar available)

Deliverable: Monitoring implementation
```

---

## Success Criteria

### Performance Targets
- ✅ Daily zmanim: < 50ms (cached), < 200ms (cold)
- ✅ Weekly zmanim: < 100ms (cached), < 400ms (cold)  ← **Current: 3000ms+ (CRITICAL)**
- ✅ Monthly reports: < 300ms (cached), < 1000ms (cold)
- ✅ Yearly exports: < 2s (cached), < 8s (cold)
- ✅ Database queries per request: < 5 (vs current ~20+)
- ✅ Cache hit rate: > 80% for repeat requests
- ✅ Zero functional regressions

### Code Quality
- ✅ All CI checks pass
- ✅ SQLc queries only (no raw SQL added)
- ✅ Test coverage maintained/improved
- ✅ coding-standards.md compliance
- ✅ No TODO/FIXME introduced

---

## Orchestrator Execution Checklist

```markdown
## Phase 1: Audit (Parallel)
- [ ] Launch Agents 1-6 simultaneously (single Task tool call with 6 agents)
- [ ] Wait for all agents to complete
- [ ] Review all deliverables for completeness
- [ ] Identify any gaps requiring follow-up

## Phase 2: Planning
- [ ] Launch Agent 7 with all Phase 1 outputs
- [ ] Review OPTIMIZATION_PLAN.md
- [ ] Get user approval for plan before implementation

## Phase 3: Implementation
- [ ] Execute Quick Wins tier (parallel agents)
- [ ] Benchmark and verify improvements
- [ ] Execute Medium Complexity tier (parallel agents)
- [ ] Benchmark and verify improvements
- [ ] Execute Major Refactors tier (parallel agents)
- [ ] Benchmark and verify improvements

## Phase 4: Verification
- [ ] Launch Agents 8-9 in parallel
- [ ] Review performance gains vs targets
- [ ] Address any regressions
- [ ] Final benchmark report

## Phase 5: Documentation
- [ ] Launch Agents 10-11 in parallel
- [ ] Review documentation updates
- [ ] Commit all changes

## Final Deliverables
- [ ] PERFORMANCE_REPORT.md with before/after metrics
- [ ] OPTIMIZATION_PLAN.md (executed)
- [ ] Updated codebase with all optimizations
- [ ] Passing CI/CD
- [ ] User sign-off
```

---

## Execution Command for Orchestrator

**When ready to begin**, run:
```
I am the Performance Optimization Orchestrator. I will now execute this mission by delegating to specialized sub-agents. I will NOT perform any direct code analysis or edits myself.

Starting Phase 1: Launching 6 audit agents in parallel...
```

---

## Notes for Orchestrator
- Use `Task` tool with `subagent_type='bmad:bmm:agents:dev'` and model `sonnet` for all agents
- Launch parallel agents in **single response** with multiple Task tool calls
- Use `run_in_background=true` for long-running agents, then collect with TaskOutput
- Provide each agent with specific file paths and context
- Require structured deliverables (markdown tables, checklists)
- Synthesize findings, don't just concatenate
- Get user approval before major changes
- Verify performance improvements with actual measurements
