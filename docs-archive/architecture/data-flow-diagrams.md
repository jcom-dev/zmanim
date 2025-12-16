# Data Flow Diagrams - Shtetl Zmanim

**Purpose:** Visual representation of data movement through the system for AI agent understanding
**Last Updated:** 2025-12-07

---

## 1. Zmanim Calculation Flow (Critical Path)

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │ 1. Select location
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ LocationPicker.tsx                                   ││
│  │ - Geolocation API (browser)                          ││
│  │ - City search autocomplete                           ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ GET /geo/boundaries/lookup?lat={}&lng={}     │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ZmanimCalculator.tsx                                 ││
│  │ - Date selection                                     ││
│  │ - Publisher filter (optional)                        ││
│  └────────┬─────────────────────────────────────────────┘│
└───────────┼──────────────────────────────────────────────┘
            │ POST /zmanim/calculate
            │ { city_id, date, publisher_id? }
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: calculation.go::CalculateZmanim()           ││
│  │ 1. Parse request body                                ││
│  │ 2. Validate city_id, date                            ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Check Redis Cache                                    ││
│  │ Key: zmanim:{city_id}:{date}:{publisher_id}          ││
│  └────┬────────────────────────────────────────────┬────┘│
│       │ Cache HIT                        Cache MISS│     │
│       │ (return cached)                             │     │
│       │                                             ▼     │
│       │                    ┌──────────────────────────┐  │
│       │                    │ Service: ZmanimService   │  │
│       │                    │ Calculate()              │  │
│       │                    └────┬─────────────────────┘  │
│       │                         │                        │
│       │                         ▼                        │
│       │            ┌────────────────────────────────┐    │
│       │            │ Query 1: Get Publishers        │    │
│       │            │ coverage.sql::GetPublishersFor │    │
│       │            │ City(city_id)                  │    │
│       │            │ → PostGIS ST_Contains query    │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │ Result: [pub1, pub2, ...]      │
│       │                 ▼                                │
│       │            ┌────────────────────────────────┐    │
│       │            │ For each publisher:            │    │
│       │            │                                │    │
│       │            │ Query 2: Get Active Algorithm  │    │
│       │            │ algorithms.sql::GetActive      │    │
│       │            │ Algorithm(publisher_id)        │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │                                │
│       │                 ▼                                │
│       │            ┌────────────────────────────────┐    │
│       │            │ Query 3: Get Zmanim List       │    │
│       │            │ zmanim.sql::FetchPublisher     │    │
│       │            │ Zmanim(publisher_id)           │    │
│       │            │ → 8-concept JOIN (!)           │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │ Result: [{zman}, {zman}...]    │
│       │                 ▼                                │
│       │            ┌────────────────────────────────┐    │
│       │            │ DSL Executor                   │    │
│       │            │ For each zman:                 │    │
│       │            │   Parse formula_dsl            │    │
│       │            │   Execute primitives:          │    │
│       │            │   - sunrise, sunset, noon      │    │
│       │            │   - solar(angle)               │    │
│       │            │   - proportional_hours()       │    │
│       │            │   └─→ astro/sun.go (NOAA)      │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │ Result: {zman: "05:42:16"}     │
│       │                 ▼                                │
│       │            ┌────────────────────────────────┐    │
│       │            │ Aggregate Results              │    │
│       │            │ Group by publisher             │    │
│       │            │ Format times (12-hour)         │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │                                │
│       │                 ▼                                │
│       │            ┌────────────────────────────────┐    │
│       │            │ Cache Result in Redis          │    │
│       │            │ SET zmanim:{city}:{date}:{pub} │    │
│       │            │ TTL: 24 hours                  │    │
│       │            └────┬───────────────────────────┘    │
│       │                 │                                │
│       └─────────────────┴───────────┐                    │
│                                     ▼                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Response: RespondJSON(200, results)                  ││
│  │ Format: { data: { publishers: [...] }, meta: {} }   ││
│  └────────┬─────────────────────────────────────────────┘│
└───────────┼──────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ZmanimCalculator.tsx                                 ││
│  │ - Display results table                              ││
│  │ - Format times (12-hour via formatTime())            ││
│  │ - Group by category                                  ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- **3 database queries** per publisher (coverage, algorithm, zmanim)
- **PostGIS** used for geographic filtering
- **Redis cache** (24hr TTL) prevents recalculation
- **DSL executor** runs formula for each zman
- **Astronomical calculations** via NOAA solar equations

---

## 2. Publisher Onboarding Flow

```
┌─────────────┐
│ New User    │
│ (Publisher) │
└──────┬──────┘
       │ 1. Sign up via Clerk
       ▼
┌──────────────────────────────────────────────┐
│ Clerk (External Service)                     │
│ - Email verification                         │
│ - JWT token generation                       │
│ - Webhook: user.created                      │
└──────┬───────────────────────────────────────┘
       │ Webhook POST /webhooks/clerk
       ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: webhooks.go::ClerkWebhook()                 ││
│  │ - Verify signature                                   ││
│  │ - Parse event type                                   ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Service: ClerkService.SyncUser()                     ││
│  │ - Create user record                                 ││
│  │ - Set default role: 'user'                           ││
│  │ - Store clerk_user_id                                ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/onboarding                          ││
│  │ Step 1: Request Publisher Role                       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/requests                     │
│           │ { reason: "..." }                            │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_requests.go::Create()             ││
│  │ - Create request record (status: 'pending')          ││
│  │ - Send email to admin                                ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Service: EmailService.SendAdminNotification()        ││
│  │ - Template: "New publisher request"                  ││
│  │ - Recipient: admin@zmanim.com                    ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       │ [Admin reviews and approves]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Admin Action                                    │
│  POST /admin/publisher-requests/{id}/approve             │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: admin.go::ApprovePublisherRequest()         ││
│  │ - Update request status: 'approved'                  ││
│  │ - Call ClerkService.UpdateMetadata()                 ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Service: ClerkService.UpdateMetadata()               ││
│  │ - PATCH Clerk API /users/{id}/metadata               ││
│  │ - Set publicMetadata.role = 'publisher'              ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Service: EmailService.SendApprovalEmail()            ││
│  │ - Notify user of approval                            ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/onboarding                          ││
│  │ Step 2: Create Publisher Profile                     ││
│  │ - Name, description, website                         ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/profile                      │
│           │ { name, description, ... }                   │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_profile.go::CreateProfile()       ││
│  │ - PublisherResolver.MustResolve() (auth check)       ││
│  │ - Create publisher record (status: 'pending')        ││
│  │ - Update Clerk metadata: publisher_access_list       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Service: ClerkService.UpdateMetadata()               ││
│  │ - Add publisher_id to publisher_access_list          ││
│  │ - Set primary_publisher_id (if first)                ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ PublisherContext loads                               ││
│  │ - Fetches publishers list from Clerk metadata        ││
│  │ - Sets selectedPublisher = primary_publisher_id      ││
│  │ - Stores in localStorage                             ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/onboarding                          ││
│  │ Step 3: Add Coverage Area                            ││
│  │ Component: CoverageSelector                          ││
│  │ - Select continent → country → region → city         ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/coverage                     │
│           │ { city_id, coverage_level: 'city' }          │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: coverage.go::CreateCoverage()               ││
│  │ - Validate city_id exists (geo_cities table)         ││
│  │ - Create coverage record                             ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/onboarding                          ││
│  │ Step 4: Create Algorithm                             ││
│  │ Component: CodeMirrorDSLEditor                       ││
│  │ - Write formula: "sunrise + 72min"                   ││
│  │ - Validate with /publisher/algorithm/validate        ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/algorithm                    │
│           │ { formula_dsl, status: 'draft' }             │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_algorithm.go::Create()            ││
│  │ - Validate DSL syntax (dsl/validator.go)             ││
│  │ - Create algorithm record (status: 'draft')          ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/onboarding                          ││
│  │ Step 5: Add Zmanim                                   ││
│  │ Component: MasterZmanPicker                          ││
│  │ - Search registry: "Alos HaShachar"                  ││
│  │ - Link or copy                                       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/zmanim/from-publisher        │
│           │ { source_zman_id, mode: 'link' }             │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_zmanim.go::CreateFrom()           ││
│  │ - Fetch source zman (8-concept JOIN query)           ││
│  │ - Verify publisher verified (if linking)             ││
│  │ - Create linked zman (linked_publisher_zman_id)      ││
│  │ - Invalidate cache                                   ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/dashboard                           ││
│  │ - Publisher profile complete                         ││
│  │ - Coverage added                                     ││
│  │ - Algorithm created (draft)                          ││
│  │ - Zmanim added                                       ││
│  │ → Ready to publish algorithm                         ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- **6-step onboarding** (sign up → request role → profile → coverage → algorithm → zmanim)
- **Clerk integration** for auth and metadata storage
- **Email notifications** at key steps (request, approval)
- **Publisher resolver** enforces authorization
- **Cache invalidation** on zman changes

---

## 3. Algorithm Publishing Flow (Transaction-Based)

```
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/algorithm                           ││
│  │ Component: AlgorithmEditor                           ││
│  │ - Edit formula_dsl                                   ││
│  │ - Test with WeekPreview                              ││
│  │ - Click "Publish" button                             ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ POST /publisher/algorithm/publish            │
│           │ { algorithm_id }                             │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_algorithm.go::PublishAlgorithm()  ││
│  │ 1. PublisherResolver.MustResolve()                   ││
│  │ 2. Parse algorithm_id from body                      ││
│  │ 3. Validate algorithm is draft                       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ BEGIN TRANSACTION                                    ││
│  │ tx, _ := h.db.Pool.Begin(ctx)                        ││
│  │ defer tx.Rollback(ctx)                               ││
│  │ qtx := h.db.Queries.WithTx(tx)                       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Step 1: Archive Active Algorithms                    ││
│  │ qtx.ArchiveActiveAlgorithms(ctx, publisher_id)       ││
│  │ → UPDATE algorithms SET status = 'archived'          ││
│  │    WHERE publisher_id = $1 AND status = 'active'     ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Step 2: Publish Draft Algorithm                      ││
│  │ qtx.PublishAlgorithm(ctx, algorithm_id)              ││
│  │ → UPDATE algorithms SET status = 'active'            ││
│  │    WHERE id = $1 AND status = 'draft'                ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Step 3: Create Version Snapshot                      ││
│  │ qtx.CreateAlgorithmVersion(ctx, {                    ││
│  │   algorithm_id,                                      ││
│  │   version_number: get_next_version(),                ││
│  │   formula_dsl,                                       ││
│  │   created_by: user_id                                ││
│  │ })                                                   ││
│  │ → INSERT INTO algorithm_version_history              ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ COMMIT TRANSACTION                                   ││
│  │ tx.Commit(ctx)                                       ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Cache Invalidation                                   ││
│  │ h.cache.InvalidatePublisherCache(ctx, publisher_id)  ││
│  │ → DELETE zmanim:*:{publisher_id}:*                   ││
│  │ → DELETE publisher:{publisher_id}:*                  ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Response: RespondJSON(200, { updated_at })           ││
│  └────────┬─────────────────────────────────────────────┘│
└───────────┼──────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/algorithm                           ││
│  │ - Show success toast                                 ││
│  │ - Refresh algorithm list                             ││
│  │ - Navigate to /publisher/dashboard                   ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Explicit transaction** boundaries (BEGIN/COMMIT)
- **3 database operations** in single transaction
- **Automatic version** snapshot creation
- **Cache invalidation** after commit (not during)
- **Rollback on error** (defer tx.Rollback())

---

## 4. Multi-Concept Query Flow (GetPublisherZmanim)

```
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Page: /publisher/zmanim                              ││
│  │ Component: ZmanimList                                ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ GET /publisher/zmanim                        │
│           │ Headers: Authorization, X-Publisher-Id       │
└───────────┼──────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────┐
│          Backend (Go)                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler: publisher_zmanim.go::GetPublisherZmanim()   ││
│  │ - PublisherResolver.MustResolve()                    ││
│  │ - Extract publisher_id                               ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ SQLc Query: FetchPublisherZmanim(publisher_id)       ││
│  │ File: api/internal/db/queries/zmanim.sql:8-108       ││
│  │                                                      ││
│  │ SELECT                                               ││
│  │   pz.id, pz.zman_key, pz.formula_dsl,                ││
│  │   -- Resolve formula from linked source              ││
│  │   COALESCE(                                          ││
│  │     linked_pz.formula_dsl,                           ││
│  │     pz.formula_dsl                                   ││
│  │   ) AS formula_dsl,                                  ││
│  │   -- Master registry fallback                        ││
│  │   COALESCE(                                          ││
│  │     mr.canonical_hebrew_name,                        ││
│  │     linked_pz.hebrew_name                            ││
│  │   ) AS source_hebrew_name,                           ││
│  │   -- Tag aggregation (UNION ALL)                     ││
│  │   COALESCE(                                          ││
│  │     (SELECT json_agg(...) FROM (                     ││
│  │       SELECT * FROM master_zman_tags                 ││
│  │       WHERE master_zman_id = pz.master_zman_id       ││
│  │       UNION ALL                                      ││
│  │       SELECT * FROM publisher_zman_tags              ││
│  │       WHERE publisher_zman_id = pz.id                ││
│  │     )),                                              ││
│  │     '[]'::json                                       ││
│  │   ) AS tags                                          ││
│  │ FROM publisher_zmanim pz                             ││
│  │ LEFT JOIN zman_source_types zst                      ││
│  │   ON pz.source_type_id = zst.id                      ││
│  │ LEFT JOIN time_categories tc                         ││
│  │   ON pz.time_category_id = tc.id                     ││
│  │ LEFT JOIN publisher_zmanim linked_pz                 ││
│  │   ON pz.linked_publisher_zman_id = linked_pz.id      ││
│  │ LEFT JOIN publishers linked_pub                      ││
│  │   ON linked_pz.publisher_id = linked_pub.id          ││
│  │ LEFT JOIN master_zmanim_registry mr                  ││
│  │   ON pz.master_zman_id = mr.id                       ││
│  │ LEFT JOIN time_categories mr_tc                      ││
│  │   ON mr.time_category_id = mr_tc.id                  ││
│  │ WHERE pz.publisher_id = $1                           ││
│  │                                                      ││
│  │ ❌ VIOLATION: 8-concept JOIN                         ││
│  │ Concepts: publisher_zmanim, publishers,              ││
│  │   master_zmanim_registry, zman_tags, tag_types,      ││
│  │   master_zman_tags, publisher_zman_tags,             ││
│  │   time_categories                                    ││
│  └────────┬─────────────────────────────────────────────┘│
│           │ Result: 50+ zmanim with full metadata        │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Handler Processing                                   ││
│  │ - Convert SQLc rows to PublisherZman structs         ││
│  │ - Parse JSON tags field                              ││
│  │ - Handle nullable fields                             ││
│  └────────┬─────────────────────────────────────────────┘│
│           │                                              │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Response: RespondJSON(200, zmanim)                   ││
│  └────────┬─────────────────────────────────────────────┘│
└───────────┼──────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│          Frontend (Next.js)                              │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Component: ZmanimList                                ││
│  │ - Group by category (useCategories hook)             ││
│  │ - Render ZmanCard for each zman                      ││
│  │ - Display tags, formulas, linked sources             ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Single SQL query** fetches all zmanim + metadata
- **8 concepts JOINed** (concept independence violation)
- **COALESCE logic** resolves formula precedence (linked > publisher > master)
- **JSON aggregation** for tags (UNION ALL of master + publisher tags)
- **Handler shows** simple `FetchPublisherZmanim()` call
- **Hidden complexity** in SQL (not visible in handler code)

**WYSIWYD Violation:** Handler doesn't show tag/source resolution logic

---

## 5. Cache Lifecycle Flow

```
┌──────────────────────────────────────────────────────────┐
│ Event: Algorithm Published                              │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Handler: publisher_algorithm.go::PublishAlgorithm()     │
│ - Transaction commits                                    │
│ - h.cache.InvalidatePublisherCache(ctx, publisher_id)   │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Redis Commands                                           │
│ DEL zmanim:*:{publisher_id}:*                            │
│ DEL publisher:{publisher_id}:profile                     │
│ DEL coverage:{publisher_id}                              │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Next Calculation Request                                 │
│ POST /zmanim/calculate { city_id, date, publisher_id }  │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Cache Check                                              │
│ GET zmanim:{city_id}:{date}:{publisher_id}               │
│ Result: MISS (invalidated)                               │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Recalculate                                              │
│ ZmanimService.Calculate()                                │
│ - Fetch NEW algorithm (recently published)               │
│ - Execute DSL with NEW formulas                          │
│ - Return fresh results                                   │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Cache Write                                              │
│ SET zmanim:{city_id}:{date}:{publisher_id} {result}      │
│ TTL: 24 hours                                            │
└──────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Invalidation triggers:** Algorithm publish, zman update, coverage change
- **Pattern matching:** Wildcard deletes (`zmanim:*:{publisher_id}:*`)
- **Recalculation:** Next request rebuilds cache
- **TTL:** 24 hours (prevents stale data)

---

## Quick Reference: Data Flow Patterns

| Pattern | Example | Concepts | Transactions | Cache |
|---------|---------|----------|--------------|-------|
| **Read Single Concept** | Get publisher profile | 1 | No | Optional |
| **Read Multi-Concept (JOIN)** | Get publisher zmanim | 8 | No | No |
| **Write Single Concept** | Create zman | 1 | Optional | Invalidate |
| **Write Multi-Concept** | Publish algorithm | 1 (but multi-step) | **Required** | Invalidate |
| **Calculation** | Calculate zmanim | 3+ | No | Write result |
| **External Integration** | Clerk webhook | 1 | No | No |

---

**For AI Agents:**
- Use these diagrams to understand data movement before making changes
- Check transaction patterns before adding multi-step operations
- Reference cache patterns for invalidation logic
- Consult multi-concept query flow to understand hidden dependencies
