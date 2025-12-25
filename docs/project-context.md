---
project_name: zmanim
user_name: Daniel
date: 2025-12-25
sections_completed:
  - technology_stack
  - backend_rules
  - frontend_rules
  - database_rules
  - testing_rules
  - architecture_rules
  - critical_dont_miss
---

# Project Context for AI Agents

_Critical rules and patterns that AI agents must follow when implementing code in the zmanim project. Optimized for LLM context efficiency._

---

## Technology Stack & Versions

### Backend

| Technology | Version | Notes |
|------------|---------|-------|
| Go | 1.24.9+ | Minimum required |
| Chi | 5.0.11 | HTTP router |
| PostgreSQL | 17 | With PostGIS + pgvector |
| Redis | 7 | Caching layer |
| SQLc | latest | Type-safe query generation |
| Clerk SDK | v2 | Authentication |
| Swag | latest | OpenAPI generation |

### Frontend

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.1 | App Router |
| React | 19 | Latest |
| TypeScript | 5.9 | Strict mode |
| Tailwind CSS | 4.1 | PostCSS-based |
| Clerk | v6 | Authentication |
| React Query | v5 | State management |
| Radix UI | latest | 25 headless components |
| CodeMirror | 6 | DSL editor |

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Playwright | 1.57 | E2E tests |
| Vitest | 4.0 | Unit/component tests |

---

## Critical Implementation Rules

### 1. CHECK INDEX FILES FIRST

Before creating ANY new code, check these registries:

- `api/internal/handlers/INDEX.md` - 44 backend handlers
- `api/internal/db/queries/INDEX.md` - 33 SQL query files
- `web/components/INDEX.md` - 135 React components

**Rule:** One function per purpose. Extend existing code. Delete unused code.

### 2. Backend Handler Pattern (6-Step REQUIRED)

Every HTTP handler MUST follow this exact pattern:

```go
func (h *Handler) EndpointName(w http.ResponseWriter, r *http.Request) {
    // 1. Resolve publisher context (SECURITY-CRITICAL)
    pc := h.publisherResolver.MustResolve(w, r)

    // 2. Extract URL params
    id := chi.URLParam(r, "id")

    // 3. Parse request body
    var req RequestType
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondError(w, r, http.StatusBadRequest, "Invalid request")
        return
    }

    // 4. Validate input
    if req.Field == "" {
        RespondError(w, r, http.StatusBadRequest, "Field required")
        return
    }

    // 5. Execute SQLc query (NO raw SQL)
    result, err := h.db.Queries.QueryName(r.Context(), params)

    // 6. Respond JSON
    RespondJSON(w, r, http.StatusOK, result)
}
```

### 3. SQLc ONLY - Zero Tolerance for Raw SQL

```go
// CORRECT - Use SQLc generated queries
result, err := h.db.Queries.GetPublisherZmanim(ctx, publisherID)

// FORBIDDEN - Raw SQL
rows, err := db.Query("SELECT * FROM zmanim WHERE publisher_id = $1", id)
```

After modifying SQL files: `cd api && sqlc generate`

### 4. Tag-Driven Event Architecture (CRITICAL)

**ALL event filtering uses tags. NO hardcoded event logic allowed.**

```go
// FORBIDDEN - Hardcoded event logic
if isErevShabbos || isErevYomTov {
    showCandleLighting = true  // NEVER DO THIS
}

// REQUIRED - Tag-driven filtering
activeEventCodes := []string{"erev_shabbos", "chanukah"}
result := service.CalculateZmanim(ctx, CalculateParams{
    ActiveEventCodes: activeEventCodes,  // Service filters by tags
})
```

**Flow:** HebCal API -> `tag_event_mappings` table -> ActiveEventCodes -> Tag filtering

**Adding new events:** SQL ONLY, no code changes:

```sql
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES ('new_event', 'Hebrew', 'English', 170);

INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'HebCal Event Name' FROM zman_tags WHERE tag_key = 'new_event';
```

### 5. UnifiedZmanimService - Single Source of Truth

```go
// CORRECT - Use the unified service
result, err := h.zmanimService.CalculateZmanim(ctx, params)
result, err := h.zmanimService.GetOrderedZmanim(ctx, publisherID)

// FORBIDDEN - Direct DB queries for zmanim logic
rows, err := h.db.Queries.GetZmanim(ctx, id)  // Only for raw data, not business logic
```

### 6. Frontend API Client Pattern (REQUIRED)

```tsx
// CORRECT - Use useApi() hook
const api = useApi();
await api.get('/publisher/zmanim');           // Auth + X-Publisher-Id
await api.public.get('/countries');            // No auth needed
await api.admin.get('/admin/stats');           // Auth only (no publisher)

// FORBIDDEN - Raw fetch
const res = await fetch('/api/v1/publisher/zmanim');  // NEVER
```

### 7. Design Tokens ONLY - No Hardcoded Colors

```tsx
// CORRECT - Design tokens
className="text-foreground bg-card border-border"
className="text-primary hover:text-primary/80"
className="text-muted-foreground bg-muted"

// FORBIDDEN - Hardcoded colors
className="text-[#1e3a5f]"
style={{ color: '#ff0000' }}
className="bg-blue-500"  // Only if not in design system
```

### 8. Clerk Authentication Rules

```tsx
// REQUIRED - Always check isLoaded before accessing user
const { isLoaded, user } = useUser();

if (!isLoaded) {
    return <LoadingSpinner />;
}

// Now safe to use user
```

### 9. Entity References - IDs ONLY

```go
// CORRECT - ID-based reference
zman, err := h.db.Queries.GetZmanByID(ctx, zmanID)

// FORBIDDEN - Text-based lookup
zman, err := h.db.Queries.GetZmanByName(ctx, "Sunrise")  // NEVER
```

### 10. Soft Delete Pattern

```sql
-- CORRECT - Soft delete
UPDATE table SET deleted_at = NOW() WHERE id = $1;
SELECT * FROM table WHERE deleted_at IS NULL;

-- FORBIDDEN - Hard delete (except cleanup jobs)
DELETE FROM table WHERE id = $1;
```

---

## Database Patterns

### SQLc Query Naming Conventions

| Pattern | Usage |
|---------|-------|
| `GetEntity :one` | Single record by ID |
| `ListEntities :many` | Multiple records |
| `CreateEntity :one` | Insert + return created |
| `UpdateEntity :exec` | Update without return |
| `DeleteEntity :exec` | Soft delete |
| `CountEntities :one` | Aggregate count |

### Key Tables

```
publishers, publisher_zmanim, publisher_coverage
master_zmanim_registry, zman_tags, tag_event_mappings
geo_localities (~4M), geo_regions, geo_search_index
```

### Publisher Zmanim MUST Link

Every publisher zman MUST link to either:
- `master_registry_id` (master zman), OR
- `linked_publisher_zman_id` (another publisher's zman)

---

## Frontend Patterns

### React Query Hooks

```tsx
// Data fetching
const { data, isLoading } = usePublisherQuery<ZmanType>('key', '/endpoint');

// Mutations
const mutation = usePublisherMutation<Result, Payload>('/endpoint', 'POST');
await mutation.mutateAsync(payload);
```

### Time Formatting (12-hour ONLY)

```tsx
import { formatTime, formatTimeShort } from '@/lib/time';

formatTime('14:30:36');      // "2:30:36 PM"
formatTimeShort('14:30:36'); // "2:30 PM"
```

### Component Structure

```
web/components/
├── ui/              # shadcn/ui primitives (25 components)
├── shared/          # Reusable across features
├── publisher/       # Publisher dashboard
├── algorithm/       # Algorithm editor
├── dsl/             # DSL code editor
├── formula-builder/ # Visual formula construction
├── onboarding/      # Publisher setup wizard
└── tags/            # Tag management
```

---

## Testing Rules

### E2E Tests (Playwright)

- Location: `tests/e2e/`
- Auth projects: admin, publisher, public
- Storage state for Clerk auth (avoid rate limits)
- Parallel execution: 8 workers CI, 75% CPUs local

### Unit Tests (Vitest)

- Location: Alongside components
- Minimum coverage: 50%
- Environment: jsdom

---

## Development Workflow

### Service Management (REQUIRED)

```bash
./restart.sh              # Start/restart ALL services (ALWAYS use this)
tmux attach -t zmanim     # View logs
  Ctrl+B, 0 = API
  Ctrl+B, 1 = Web
  Ctrl+B, D = Detach
```

### Common Commands

```bash
source api/.env && psql "$DATABASE_URL"   # DB shell
cd api && go build ./cmd/api              # Build API
cd api && sqlc generate                   # After SQL changes
cd web && npm run type-check              # TypeScript check
./scripts/validate-ci-checks.sh           # Pre-push validation
```

### URLs

| Resource | URL |
|----------|-----|
| Web App | http://localhost:3001 |
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger/index.html |

---

## CI/CD Zero Tolerance

| Rule | Reason |
|------|--------|
| No TODO/FIXME comments | Track in issue tracker |
| No raw `fetch()` | Use `useApi()` hook |
| No `fmt.Printf` | Use `slog` for logging |
| No hardcoded colors | Use design tokens |
| No raw SQL | Use SQLc |

---

## DSL Formula Syntax

```
sunrise                    # Solar primitive
sunset - 18min             # Offset from sunset
solar(-16.1)               # Solar angle
@alos_hashachar + 30min    # Reference to another zman
```

**Primitives:** sunrise, sunset, solar(angle), fixed(HH:MM)
**Operations:** +, -, arithmetic with min/hour units
**References:** @zman_key (resolves to another formula)

---

## Critical Anti-Patterns

| DO NOT | DO INSTEAD |
|--------|------------|
| Create new handlers without checking INDEX | Check `handlers/INDEX.md` first |
| Use raw SQL in handlers | Use SQLc generated queries |
| Hardcode event logic | Use tag-driven filtering |
| Use `fetch()` directly | Use `useApi()` hook |
| Skip `isLoaded` check | Always check before user access |
| Use text-based entity lookups | Use ID-based references |
| Hard delete records | Use soft delete (deleted_at) |
| Run `go run` or `npm run dev` | Use `./restart.sh` |

---

## Architecture Quick Reference

```
CloudFront (CDN)
├─ Next.js Lambda (routes: /*)
└─ API Gateway (routes: /backend/*)
    └─ EC2 Instance
        ├─ Go API (port 8080)
        ├─ PostgreSQL 17 (port 5432)
        └─ Redis 7 (port 6379)
```

**Caching:** Redis with 24hr TTL, filter-aware keys
**Auth:** Clerk JWT + PublisherResolver middleware
**Multi-tenancy:** X-Publisher-Id header for publisher context
