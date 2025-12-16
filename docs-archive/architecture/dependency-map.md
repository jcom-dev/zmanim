# Dependency Map - Shtetl Zmanim

**Purpose:** Explicit dependency graph for AI agent navigation and impact analysis
**Last Updated:** 2025-12-07

---

## Handler → Query Dependencies

### Publisher Management
| Handler | SQL Queries | Complexity | Concepts Involved |
|---------|-------------|------------|-------------------|
| `admin.go` | `admin.sql`, `publishers.sql`, `users.sql` | HIGH | Publisher, User, Metadata |
| `publisher_profile.go` | `publishers.sql` | LOW | Publisher |
| `publisher_invitations.go` | `invitations.sql`, `publishers.sql` | MEDIUM | Publisher, User |

### Zmanim Management
| Handler | SQL Queries | Complexity | Concepts Involved |
|---------|-------------|------------|-------------------|
| `master_registry.go` | `master_zmanim.sql`, `tags.sql`, `events.sql` | CRITICAL | Zman (master), Tag, Event, DayType |
| `publisher_zmanim.go` | `zmanim.sql` (8-concept JOIN), `algorithms.sql` | CRITICAL | Publisher, Zman, Tag, Event, Link |
| `publisher_algorithm.go` | `algorithms.sql`, `algorithm_history.sql` | HIGH | Algorithm, Version, Snapshot |

### Coverage & Geography
| Handler | SQL Queries | Complexity | Concepts Involved |
|---------|-------------|------------|-------------------|
| `coverage.go` | `coverage.sql` (5-geo JOINs), `geo_boundaries.sql` | HIGH | Coverage, Geo (5 levels) |
| `geo_boundaries.go` | `geo_boundaries.sql` (PostGIS) | MEDIUM | Geo (PostGIS queries) |
| `location.go` | `cities.sql`, `geo_lookup.sql` | LOW | Geo |

### Calculation & Preview
| Handler | SQL Queries | Complexity | Concepts Involved |
|---------|-------------|------------|-------------------|
| `calculation.go` | `zmanim.sql`, `algorithms.sql`, `coverage.sql` | CRITICAL | Zman, Algorithm, Coverage, Geo |
| `calendar.go` | None (utility, hdate library) | LOW | Calendar conversion |
| `preview.go` | `zmanim.sql`, `algorithms.sql` | HIGH | Zman, Algorithm |

---

## Service → Database Dependencies

### Core Services
| Service | Queries Used | External APIs | Purpose |
|---------|-------------|---------------|---------|
| `ClerkService` | `users.sql` | Clerk API (auth metadata) | User sync, role management |
| `EmailService` | `publishers.sql`, `invitations.sql` | SMTP server | Notifications, invitations |
| `SnapshotService` | `algorithms.sql`, `zmanim.sql` | None | Export/import publisher data |
| `PublisherService` | `publishers.sql`, `coverage.sql` | None | **DEPRECATED** (raw SQL, migrate to SQLc) |
| `ZmanimService` | `zmanim.sql`, `algorithms.sql` | None | Calculation coordination |

### Calculation Pipeline
```
ZmanimService.Calculate()
  ├─→ Get publisher coverage (coverage.sql)
  ├─→ Get algorithm (algorithms.sql)
  ├─→ Get zmanim list (zmanim.sql)
  ├─→ DSL Executor
  │   └─→ Astro calculations (astro/sun.go)
  └─→ Cache result (Redis, 24hr TTL)
```

---

## Frontend → Backend API Dependencies

### Publisher Pages
| Component | API Endpoints | Methods | Auth Required |
|-----------|---------------|---------|---------------|
| `PublisherDashboard.tsx` | `/publisher/profile`, `/publisher/stats` | GET | ✅ + X-Publisher-Id |
| `PublisherZmanimList.tsx` | `/publisher/zmanim` | GET | ✅ + X-Publisher-Id |
| `ZmanEditor.tsx` | `/publisher/zmanim/{key}`, `/publisher/zmanim` | GET, PUT, POST | ✅ + X-Publisher-Id |
| `AlgorithmEditor.tsx` | `/publisher/algorithm`, `/publisher/algorithm/publish` | GET, PUT, POST | ✅ + X-Publisher-Id |
| `CoverageManager.tsx` | `/publisher/coverage`, `/geo/boundaries/*` | GET, POST, PUT, DELETE | ✅ + X-Publisher-Id |

### Public Pages
| Component | API Endpoints | Methods | Auth Required |
|-----------|---------------|---------|---------------|
| `PublicZmanimBrowser.tsx` | `/zmanim/browse`, `/publishers/for-city/{id}` | GET | ❌ Public |
| `ZmanimCalculator.tsx` | `/zmanim/calculate`, `/geo/boundaries/lookup` | POST, GET | ❌ Public |

### Admin Pages
| Component | API Endpoints | Methods | Auth Required |
|-----------|---------------|---------|---------------|
| `AdminPublisherList.tsx` | `/admin/publishers`, `/admin/publishers/{id}` | GET, PUT | ✅ Admin role |
| `AdminRegistryManager.tsx` | `/admin/registry/zmanim`, `/admin/registry/zmanim/{id}` | GET, POST, PUT, DELETE | ✅ Admin role |

---

## Component → Component Dependencies

### Shared Component Tree
```
App Layout (layout.tsx)
├─→ ClerkProvider (auth)
├─→ QueryClientProvider (React Query)
├─→ ThemeProvider (dark mode)
└─→ PublisherContextProvider (publisher selection)
    ├─→ Used by: All publisher pages
    ├─→ Provides: selectedPublisher, setSelectedPublisherId, isImpersonating
    └─→ Persists to: localStorage

Publisher Pages
├─→ ZmanimList
│   ├─→ ZmanCard (30+ instances)
│   │   ├─→ Badge (shadcn)
│   │   ├─→ Dialog (shadcn)
│   │   └─→ useApi hook
│   ├─→ CategoryFilter
│   └─→ useZmanimList hook
│
├─→ AlgorithmEditor
│   ├─→ CodeMirrorDSLEditor
│   │   ├─→ CodeMirror 6
│   │   ├─→ DSL language mode
│   │   └─→ dsl-reference-data.ts
│   ├─→ WeekPreview
│   │   ├─→ DatePickerDropdown
│   │   └─→ useApi hook (cached)
│   └─→ useApi hook
│
└─→ CoverageManager
    ├─→ CoverageSelector
    │   ├─→ LocationPicker
    │   └─→ useApi hook
    └─→ CitySelector
        └─→ useApi hook
```

### Hook Dependency Chain
```
useApi (api-client.ts)
└─→ Used by ALL components for API calls

usePublisherQuery (hooks/useApiQuery.ts)
├─→ Wraps useApi
├─→ Adds React Query caching
├─→ Adds X-Publisher-Id header
└─→ Used by: 30+ publisher pages

useZmanimList (hooks/useZmanimList.ts)
├─→ Uses usePublisherQuery
├─→ Adds filtering, sorting, grouping
└─→ Used by: ZmanimList, ZmanPicker components
```

---

## Critical Path Dependencies

### User Registration Flow
```
1. User signs up (Clerk) → Clerk webhook → ClerkService.SyncUser()
2. User selects "Publisher" role → Admin approval required
3. Admin approves → ClerkService.UpdateMetadata(role: "publisher")
4. Publisher creates profile → handlers.CreatePublisher() → publishers.sql
5. PublisherContext loads → localStorage persists selection
```

**Dependencies:**
- Clerk (external)
- `ClerkService` (internal)
- `admin.go` handler
- `PublisherContext.tsx` (frontend)

### Zmanim Calculation Flow
```
1. User selects location → LocationPicker → /geo/boundaries/lookup (PostGIS)
2. Frontend → /zmanim/calculate (city_id, date)
3. Backend → ZmanimService.Calculate()
   a. Get publishers for city (coverage.sql → PostGIS ST_Contains)
   b. For each publisher:
      - Get active algorithm (algorithms.sql)
      - Get zmanim list (zmanim.sql → 8-concept JOIN)
      - Execute DSL formulas (dsl/executor.go → astro/sun.go)
   c. Aggregate results
4. Cache result (Redis, key: "zmanim:{city_id}:{date}:{publisher_id}", TTL: 24hr)
5. Return JSON to frontend
```

**Dependencies:**
- PostGIS extension
- Redis cache
- Astro calculations (NOAA equations)
- DSL executor (4 primitive types, 12 operators)

### Publisher Onboarding Flow
```
1. Publisher creates profile → /publisher/profile (POST)
2. Publisher adds coverage → /publisher/coverage (POST)
   - Uses CoverageSelector (5-level cascade)
   - Validates with /geo/boundaries/* endpoints
3. Publisher creates algorithm → /publisher/algorithm (POST)
   - Uses CodeMirrorDSLEditor
   - Validates with /publisher/algorithm/validate
4. Publisher adds zmanim → /publisher/zmanim (POST)
   - Option 1: Link from master registry (MasterZmanPicker)
   - Option 2: Copy from another publisher (PublisherZmanPicker)
   - Option 3: Create custom
5. Publisher publishes algorithm → /publisher/algorithm/publish (POST)
   - Creates version snapshot
   - Archives previous active algorithm
   - Transaction-based (BEGIN/COMMIT)
```

**Dependencies:**
- PublisherResolver (auth + context)
- SnapshotService (versioning)
- Cache invalidation (on publish)
- DSL validation

---

## External Service Dependencies

### Production Dependencies
| Service | Purpose | Used By | Criticality |
|---------|---------|---------|-------------|
| **Clerk** | Authentication, user management | All protected routes, ClerkService | CRITICAL |
| **PostgreSQL + PostGIS** | Database + geographic queries | All handlers | CRITICAL |
| **Redis** | Zmanim calculation cache (24hr TTL) | ZmanimService, calculation.go | HIGH |
| **SMTP Server** | Email sending | EmailService, invitations/notifications | MEDIUM |

### Development Dependencies
| Service | Purpose | Used By | Criticality |
|---------|---------|---------|-------------|
| **Next.js Dev Server** | Frontend hot reload | All .tsx files | DEV ONLY |
| **Go Live Reload (air)** | Backend hot reload | All .go files | DEV ONLY |
| **pgAdmin** | Database management | Manual queries | OPTIONAL |

---

## Concept Coupling Matrix

> **Note:** This matrix shows violations of concept independence (see `docs/compliance/concept-independence-audit.md`)

| Concept A | Concept B | Coupling Type | Location | Severity |
|-----------|-----------|---------------|----------|----------|
| Publisher | Zman | Direct FK (publisher_id) | `publisher_zmanim` table | CRITICAL |
| Zman | Master Registry | Direct FK (master_zman_id) | `publisher_zmanim` table | CRITICAL |
| Zman | Tag | Direct FK (tag_id) | `master_zman_tags`, `publisher_zman_tags` | HIGH |
| Zman | Event | Direct FK (jewish_event_id) | `master_zman_events` | HIGH |
| Coverage | Geo (5 levels) | 5 direct FKs | `publisher_coverage` table | CRITICAL |
| Publisher | User | Text reference (clerk_user_id) | `publishers` table | MEDIUM |

**Impact:** Changing master registry affects all publisher zmanim; changing geo hierarchy affects all coverage records.

**See:** `docs/compliance/concept-independence-audit.md` for remediation plan.

---

## Query Complexity Rankings

### Top 5 Most Complex Queries (by JOIN count)

1. **GetPublisherZmanim** (`zmanim.sql:8-108`) - **8 concepts**
   - JOINs: publisher_zmanim, publishers, master_zmanim_registry, zman_tags, tag_types, master_zman_tags, publisher_zman_tags, time_categories
   - **Violation:** Cross-concept JOINs hide dependencies

2. **GetPublisherCoverage** (`coverage.sql:4-26`) - **6 concepts**
   - JOINs: publisher_coverage, coverage_levels, geo_continents, geo_countries, geo_regions, geo_cities
   - **Acceptable:** Denormalized reads for display only

3. **GetPublishersForCity** (`coverage.sql:155-163`) - **5 concepts** (via function)
   - Uses: `get_publishers_for_city()` PostgreSQL function with PostGIS
   - **Acceptable:** Encapsulated logic in function

4. **FetchPublisherAlgorithm** (`algorithms.sql`) - **3 concepts**
   - JOINs: algorithms, algorithm_statuses, publishers
   - **Acceptable:** Single concept + lookup table + denorm

5. **GetMasterZmanimGrouped** (`master_zmanim.sql`) - **4 concepts**
   - JOINs: master_zmanim_registry, time_categories, tags (aggregated)
   - **Moderate:** Registry display with metadata

---

## Cache Invalidation Dependencies

### Redis Key Patterns
| Pattern | Invalidated By | TTL | Purpose |
|---------|----------------|-----|---------|
| `zmanim:{city_id}:{date}:{publisher_id}` | Algorithm publish, zman update | 24hr | Calculation results |
| `publisher:{id}:profile` | Profile update | 1hr | Publisher metadata |
| `coverage:{publisher_id}` | Coverage add/update/delete | 6hr | Coverage areas |

### Invalidation Triggers
```go
// Example from publisher_algorithm.go:539
func (h *Handlers) PublishAlgorithm(...) {
    // ... publish algorithm ...
    h.cache.InvalidatePublisherCache(ctx, publisherIDStr)
    // Invalidates: zmanim:*, publisher:{id}:*, coverage:{id}
}
```

---

## Migration Path: Reducing Coupling

### Phase 1: Service Layer (Current)
- ❌ Handlers call SQLc directly (8-concept JOINs)
- ✅ Some transactions (algorithm publish)

### Phase 2: Service Abstraction (In Progress)
- Create `ZmanimLinkingService` for multi-concept workflows
- Extract synchronization logic from handlers
- **Target:** Handlers call services, services call SQLc

### Phase 3: UUID Migration (Future)
- Replace integer FKs with UUID references
- Remove FK constraints across concepts
- **Target:** Concept independence per "What You See Is What It Does"

**See:** `docs/compliance/concept-independence-audit.md` Section 10

---

## Quick Reference: Finding Dependencies

### "Which handler uses this query?"
```bash
grep -r "GetPublisherZmanim" api/internal/handlers/ --include="*.go"
# → publisher_zmanim.go:165
```

### "Which components call this endpoint?"
```bash
grep -r "/publisher/zmanim" web/ --include="*.tsx" --include="*.ts"
# → 12 files (ZmanimList, ZmanEditor, etc.)
```

### "What does this service depend on?"
```bash
grep "import" api/internal/services/email_service.go | head -20
# → Shows: net/smtp, db/sqlcgen, models
```

### "Which queries JOIN this table?"
```bash
grep "FROM.*publisher_zmanim" api/internal/db/queries/*.sql
grep "JOIN.*publisher_zmanim" api/internal/db/queries/*.sql
# → zmanim.sql (3 occurrences)
```

---

**For AI Agents:**
- Use this map to assess impact before changes
- Check coupling matrix before adding new FKs
- Consult complexity rankings for query optimization
- Reference cache patterns for invalidation logic
