# Developer Guide

Complete onboarding guide for Shtetl Zmanim development.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Go | 1.24+ | Backend API |
| Node.js | 20+ | Frontend, tooling |
| PostgreSQL | 17+ | Database (with PostGIS) |
| Redis | 7+ | Caching |
| tmux | Any | Service management |

---

## Environment Setup

### 1. Clone and Install

```bash
git clone <repository>
cd zmanim

# Backend dependencies
cd api && go mod download

# Frontend dependencies
cd ../web && npm install

# E2E test dependencies
cd ../tests && npm install
```

### 2. Database Setup

```bash
# Create database
createdb zmanim

# Enable extensions
psql zmanim -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql zmanim -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql zmanim -c "CREATE EXTENSION IF NOT EXISTS unaccent;"

# Run migrations
./scripts/migrate.sh
```

### 3. Environment Variables

Create `api/.env`:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/zmanim
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
JWT_SECRET=your-jwt-secret
```

### 4. Start Services

```bash
./restart.sh                      # Starts API (8080) + Web (3001) in tmux
tmux attach -t zmanim             # View logs
```

**tmux navigation:**
- `Ctrl+B, 0` - API logs
- `Ctrl+B, 1` - Web logs
- `Ctrl+B, D` - Detach (services keep running)

---

## Project Navigation

### INDEX Files

Before creating new code, check these registries:

| File | Contents |
|------|----------|
| `api/internal/handlers/INDEX.md` | All HTTP handlers (44 files) |
| `api/internal/db/queries/INDEX.md` | All SQLc queries (20 files) |
| `api/internal/services/INDEX.md` | Business logic services (13 files) |
| `web/components/INDEX.md` | React components (123+ components) |

**Rule:** One function per purpose. Extend existing code. Delete unused code.

### Key Directories

```
api/
├── cmd/api/main.go               # Entry point, router setup
├── internal/
│   ├── handlers/                 # HTTP handlers
│   │   ├── handlers.go           # Handler struct, initialization
│   │   ├── publisher_zmanim.go   # Core zmanim CRUD (1,901 LOC)
│   │   ├── zmanim.go             # Public endpoints
│   │   ├── admin.go              # Admin endpoints
│   │   └── ...
│   ├── services/                 # Business logic
│   │   ├── zmanim_service.go     # UnifiedZmanimService (critical)
│   │   ├── algorithm_service.go  # Algorithm management
│   │   └── ...
│   ├── db/
│   │   ├── queries/              # SQLc SQL files
│   │   └── sqlcgen/              # Generated Go code
│   ├── dsl/                      # Formula parser
│   │   ├── lexer.go              # Tokenization
│   │   ├── parser.go             # AST construction
│   │   └── executor.go           # Formula execution
│   ├── astro/                    # Sun calculations
│   └── middleware/               # Auth, CORS, rate limiting

web/
├── app/                          # Next.js pages
│   ├── admin/                    # Admin dashboard
│   ├── publisher/                # Publisher portal
│   │   ├── algorithm/            # Formula editor
│   │   ├── dashboard/            # Main dashboard
│   │   ├── coverage/             # Geographic coverage
│   │   └── ...
│   └── zmanim/                   # Public zmanim display
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── publisher/                # Dashboard components
│   ├── algorithm/                # Formula editor
│   ├── shared/                   # Reusable components
│   └── ...
├── lib/
│   ├── api-client.ts             # useApi() hook
│   ├── hooks/                    # React Query hooks
│   └── ...
└── providers/                    # React contexts
```

---

## Backend Development

### Handler Pattern (6 Steps)

Every handler follows this structure:

```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context (SECURITY CRITICAL)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. Extract URL params
    id, err := strconv.Atoi(chi.URLParam(r, "id"))
    if err != nil {
        RespondValidationError(w, r, "Invalid ID", nil)
        return
    }

    // 3. Parse request body
    var req struct {
        Name string `json:"name"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondValidationError(w, r, "Invalid JSON", nil)
        return
    }

    // 4. Validate
    if req.Name == "" {
        RespondValidationError(w, r, "Name is required", nil)
        return
    }

    // 5. SQLc query (NO RAW SQL)
    result, err := h.db.Queries.GetSomething(ctx, sqlcgen.GetSomethingParams{
        PublisherID: pc.PublisherID,
        ID:          int32(id),
    })
    if err != nil {
        slog.Error("query failed", "error", err)
        RespondInternalError(w, r)
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

### SQLc Workflow

1. Write SQL in `api/internal/db/queries/*.sql`:

```sql
-- name: GetPublisherZman :one
SELECT * FROM publisher_zmanim
WHERE id = $1 AND publisher_id = $2 AND deleted_at IS NULL;

-- name: CreatePublisherZman :one
INSERT INTO publisher_zmanim (publisher_id, key, hebrew_name, formula_dsl)
VALUES ($1, $2, $3, $4)
RETURNING *;
```

2. Generate Go code:

```bash
cd api && sqlc generate
```

3. Use in handlers:

```go
result, err := h.db.Queries.GetPublisherZman(ctx, sqlcgen.GetPublisherZmanParams{
    ID:          zmanID,
    PublisherID: pc.PublisherID,
})
```

### Logging

Use `slog` only (never `fmt.Printf` or `log.Printf`):

```go
slog.Info("zman created", "id", result.ID, "publisher_id", pc.PublisherID)
slog.Error("operation failed", "error", err, "user_id", userID)
slog.Debug("processing request", "params", params)
```

### Response Helpers

```go
RespondJSON(w, r, http.StatusOK, data)        // Success with data
RespondCreated(w, r, data)                     // 201 Created
RespondNoContent(w, r)                         // 204 No Content
RespondValidationError(w, r, "msg", details)   // 400 Bad Request
RespondNotFound(w, r)                          // 404 Not Found
RespondInternalError(w, r)                     // 500 (generic message)
```

---

## Frontend Development

### API Client

Use the unified API client for all HTTP requests:

```tsx
import { useApi } from '@/lib/api-client';

function MyComponent() {
  const api = useApi();

  // Publisher endpoint (Auth + X-Publisher-Id)
  const profile = await api.get<Profile>('/publisher/profile');

  // Public endpoint (no auth)
  const countries = await api.public.get<Country[]>('/countries');

  // Admin endpoint (Auth only)
  const stats = await api.admin.get<Stats>('/admin/stats');
}
```

**FORBIDDEN:**
```tsx
// Never use raw fetch()
fetch(`${API_BASE}/api/v1/endpoint`)
```

### React Query Hooks

```tsx
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';

function ZmanEditor() {
  // Query with caching
  const { data, isLoading } = usePublisherQuery<Zman>(
    'zman-details',
    `/publisher/zmanim/${zmanId}`
  );

  // Mutation with cache invalidation
  const updateMutation = usePublisherMutation<Zman, UpdateRequest>(
    `/publisher/zmanim/${zmanId}`,
    'PUT',
    { invalidateKeys: ['zman-details', 'zmanim-list'] }
  );

  const handleSave = () => {
    updateMutation.mutate({ hebrew_name: 'Updated Name' });
  };
}
```

### Component Pattern

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

export function MyComponent() {
  // 1. Hooks first
  const { user, isLoaded } = useUser();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // 2. Effects
  useEffect(() => {
    if (isLoaded) fetchData();
  }, [isLoaded]);

  // 3. Early returns: Loading -> Error -> Content
  if (!isLoaded) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;

  return <div>{/* content */}</div>;
}
```

### Design Tokens

Use design tokens for all colors:

```tsx
// CORRECT
<div className="text-foreground bg-background">
<div className="text-muted-foreground">
<Button className="bg-primary text-primary-foreground">

// FORBIDDEN
<div className="text-[#1e3a5f]">
<div style={{ color: '#ff0000' }}>
```

| Token | Usage |
|-------|-------|
| `foreground` / `background` | Primary text / page background |
| `card` / `card-foreground` | Card surfaces |
| `primary` / `primary-foreground` | CTAs, links |
| `muted` / `muted-foreground` | Disabled, secondary text |
| `destructive` | Errors, delete actions |
| `border` / `input` / `ring` | Borders, form inputs, focus rings |

### Time Formatting

Always use 12-hour format:

```tsx
import { formatTime, formatTimeShort } from '@/lib/utils';

formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
```

---

## Database Patterns

### Soft Delete

All user data uses soft delete:

```sql
-- Always filter deleted records
SELECT * FROM publishers WHERE deleted_at IS NULL;

-- Soft delete (not hard delete)
UPDATE publishers SET deleted_at = now(), deleted_by = $1 WHERE id = $2;
```

### Lookup Tables

Reference data uses normalized lookup tables:

```sql
-- 21 lookup tables follow this pattern
CREATE TABLE publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL
);

-- Reference via ID, not text
SELECT * FROM publishers WHERE status_id = 1;  -- Correct
SELECT * FROM publishers WHERE status = 'active';  -- FORBIDDEN
```

### Entity References

Always use numeric IDs:

```tsx
// CORRECT
await api.post('/coverage', { city_id: 293397 });

// FORBIDDEN
await api.post('/coverage', { city_name: 'Jerusalem' });
```

---

## Testing

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsPublisher, getSharedPublisher, BASE_URL } from '../utils';

test.describe.configure({ mode: 'parallel' });

test('publisher can view dashboard', async ({ page }) => {
  const publisher = getSharedPublisher('verified-1');
  await loginAsPublisher(page, publisher.id);
  await page.goto(`${BASE_URL}/publisher/dashboard`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

**Required patterns:**
- `test.describe.configure({ mode: 'parallel' })` at top of every spec
- Use shared fixtures (`getSharedPublisher`), never create test data per-test
- `waitForLoadState('networkidle')` before assertions

### Running Tests

```bash
# All E2E tests
cd tests && npx playwright test

# Interactive mode
cd tests && npx playwright test --ui

# Specific test file
cd tests && npx playwright test publisher/dashboard.spec.ts

# Go unit tests
cd api && go test ./...

# Full CI check
./scripts/validate-ci-checks.sh
```

---

## Common Tasks

### Adding a New Endpoint

1. Add SQL query in `api/internal/db/queries/`:
   ```sql
   -- name: GetNewThing :one
   SELECT * FROM things WHERE id = $1 AND publisher_id = $2;
   ```

2. Generate SQLc: `cd api && sqlc generate`

3. Add handler in `api/internal/handlers/`:
   ```go
   func (h *Handlers) GetNewThing(w http.ResponseWriter, r *http.Request) {
       // 6-step pattern
   }
   ```

4. Register route in `api/cmd/api/main.go`:
   ```go
   r.Get("/publisher/things/{id}", h.GetNewThing)
   ```

5. Update Swagger annotations

6. Update `api/internal/handlers/INDEX.md`

### Adding a New Component

1. Check `web/components/INDEX.md` for existing similar components

2. Create component:
   ```tsx
   'use client';
   export function MyComponent() { ... }
   ```

3. Update `web/components/INDEX.md`

### Adding a Database Migration

1. Create migration file:
   ```bash
   touch db/migrations/$(date +%Y%m%d%H%M%S)_description.sql
   ```

2. Write migration (up only, no down):
   ```sql
   ALTER TABLE things ADD COLUMN new_column text;
   ```

3. Run migration: `./scripts/migrate.sh`

4. Regenerate SQLc: `cd api && sqlc generate`

---

## Troubleshooting

### Services Not Starting

```bash
# Check if ports are in use
lsof -i :8080
lsof -i :3001

# Kill existing processes
pkill -f "go run"
pkill -f "next"

# Restart
./restart.sh
```

### SQLc Errors

```bash
# Verify SQL syntax
cd api && sqlc compile

# Check for type mismatches in queries
cd api && sqlc generate
```

### TypeScript Errors

```bash
cd web && npm run type-check
```

### Database Connection Issues

```bash
source api/.env && psql "$DATABASE_URL" -c "SELECT 1;"
```

---

## CI/CD Pipeline

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| `pr-checks.yml` | PR to dev | 6-8 min | SQLc, linting, tests, build |
| `pr-e2e.yml` | PR to dev | 15-20 min | Playwright E2E tests |
| `deploy-prod-frontend.yml` | Push to main | 5 min | Next.js Lambda deploy |
| `deploy-prod-backend.yml` | Manual | 10 min | EC2 deployment |

### Before Pushing

```bash
./scripts/validate-ci-checks.sh
```

This runs:
- Go build and tests
- SQLc generation check
- TypeScript type check
- Linting (golangci-lint)

---

## Resources

- [Coding Standards](coding-standards.md) - **Read first, mandatory**
- [Architecture](ARCHITECTURE.md) - System design
- [API Reference](API_REFERENCE.md) - Endpoints
- [Database](DATABASE.md) - Schema and queries
- [Frontend](FRONTEND.md) - Component patterns
- [DSL Guide](dsl-complete-guide.md) - Formula language
