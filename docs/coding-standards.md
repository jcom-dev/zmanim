# Coding Standards - Zmanim Lab

**Status:** CAST-IRON RULES - Violations block PRs
**Audience:** AI agents and developers

---

## CRITICAL VIOLATIONS (PR Blockers)

### 1. Publisher Zmanim - MUST Link
Every publisher zman MUST have `master_registry_id` OR `linked_zman_id` - no orphans.

### 2. Service Restart - Use `./restart.sh`
FORBIDDEN: `go run`, `npm run dev`, `pkill` - always use `./restart.sh`

### 3. Hardcoded Colors
```tsx
// FORBIDDEN
className="text-[#1e3a5f]" | className="bg-[#0051D5]" | style={{ color: '#ff0000' }}

// REQUIRED - design tokens
className="text-primary" | className="bg-primary/90" | className="text-muted-foreground"
```

### 4. Raw fetch() / API_BASE in Components
```tsx
// FORBIDDEN
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const response = await fetch(`${API_BASE}/api/v1/endpoint`, { headers: {...} });

// REQUIRED - unified API client
import { useApi } from '@/lib/api-client';
const api = useApi();
await api.get<DataType>('/publisher/profile');      // Auth + X-Publisher-Id automatic
await api.public.get('/countries');                  // No auth
await api.admin.get('/admin/stats');                 // Auth, no X-Publisher-Id
```

### 5. React Query Pattern
```tsx
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';
const { data, isLoading, error } = usePublisherQuery<ProfileData>('publisher-profile', '/publisher/profile');
const mutation = usePublisherMutation<Profile, UpdateRequest>('/publisher/profile', 'PUT', { invalidateKeys: ['publisher-profile'] });
```

### 6. Clerk Auth - MUST check isLoaded first
```tsx
const { isLoaded, isSignedIn, user } = useUser();
if (!isLoaded) return <LoadingSpinner />;
if (!isSignedIn) redirect('/sign-in');
// NOW safe to access user/token
```

**Common 401 causes:** Token null before isLoaded=true | Missing X-Publisher-Id header | Bearer null/undefined

---

## Clean Code Policy - ZERO TOLERANCE

**FORBIDDEN patterns - delete, don't mark:**
- `@deprecated` annotations
- `// Legacy`, `// Backward compat`, `// TODO: remove`, `// FIXME` comments
- Fallback logic for old formats
- Dual-format support (`status == 'verified' || status == 'active'`)
- Re-exports "for compatibility"

**Rule:** One format only. Migrate data, update code, delete old code.

---

## Frontend Standards

### File Structure
```
web/
├── app/                    # Next.js App Router (admin/, publisher/, zmanim/)
├── components/
│   ├── ui/                # shadcn/ui (don't modify)
│   ├── admin/ | publisher/ | shared/ | zmanim/
├── lib/
│   ├── api-client.ts      # Unified API client
│   └── hooks/             # React Query factory hooks
├── providers/             # PublisherContext, QueryProvider
└── types/
```

### Component Pattern
```tsx
'use client';
// 1. React/framework → 2. Third-party → 3. Internal → 4. Types
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useApi } from '@/lib/api-client';

export function Component() {
  // 1. Hooks (Clerk, context, state)
  const { user, isLoaded } = useUser();
  const api = useApi();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Callbacks
  const fetchData = useCallback(async () => {
    try {
      setData(await api.get('/endpoint'));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // 3. Effects
  useEffect(() => { if (isLoaded) fetchData(); }, [isLoaded, fetchData]);

  // 4. Early returns: Loading → Error → Content
  if (!isLoaded || isLoading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;
  return <div>{/* content */}</div>;
}
```

### Client vs Server Components
| Client (`'use client'`) | Server (default) |
|------------------------|------------------|
| React hooks, Clerk hooks, event handlers, browser APIs | Static content, server data fetching, SEO-critical |

### Clerk Metadata
```tsx
interface ClerkPublicMetadata {
  role?: 'admin' | 'publisher' | 'user';
  publisher_access_list?: string[];
  primary_publisher_id?: string;
}
const metadata = user.publicMetadata as ClerkPublicMetadata;
```

### PublisherContext
```tsx
const { selectedPublisher, publishers, setSelectedPublisherId, isImpersonating } = usePublisherContext();
```

### Design Tokens (MANDATORY)

**Semantic tokens (use first):**
| Token | Usage |
|-------|-------|
| `foreground` / `background` | Primary text / page bg |
| `card` / `card-foreground` | Card bg / text |
| `primary` / `primary-foreground` | CTAs, links / text on primary |
| `muted` / `muted-foreground` | Disabled bg / secondary text |
| `destructive` | Errors, delete |
| `border` / `input` / `ring` | Borders / form inputs / focus |

**Correct:**
```tsx
className="text-foreground bg-card border-border text-muted-foreground bg-primary/90"
```

**Forbidden:**
```tsx
className="text-[#111827]" | className="bg-white" | style={{ color: '#ff0000' }}
```

**Exceptions (require dark: variant):**
- Status: `text-green-600 dark:text-green-400`
- Syntax highlighting: `text-blue-600 dark:text-blue-400`

**Status badges:** `status-badge-success` | `status-badge-warning` | `status-badge-error`
**Alerts:** `alert-warning` | `alert-error` | `alert-success` | `alert-info`

### Time Formatting - 12-hour ONLY
```tsx
import { formatTime, formatTimeShort } from '@/lib/utils';
formatTime('14:30:36')      // "2:30:36 PM"
formatTimeShort('14:30:36') // "2:30 PM"
// FORBIDDEN: <span>14:30:36</span>
```

### Icons - Lucide React only
```tsx
import { Settings, Loader2 } from 'lucide-react';
<Icon className="w-4 h-4" />  // Small
<Icon className="w-5 h-5" />  // Medium
<Icon className="w-8 h-8" />  // Large
```

---

## Backend Standards

### Handler Pattern (6 Steps)
```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }
    publisherID := pc.PublisherID

    // 2. Extract URL params
    id := chi.URLParam(r, "id")
    if id == "" { RespondValidationError(w, r, "ID required", nil); return }

    // 3. Parse body (POST/PUT)
    var req struct { Name string `json:"name"` }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body"); return
    }

    // 4. Validate
    if req.Name == "" { RespondValidationError(w, r, "Validation failed", map[string]string{"name": "required"}); return }

    // 5. SQLc query
    result, err := h.db.Queries.GetSomething(ctx, sqlcgen.GetSomethingParams{PublisherID: publisherID})
    if err != nil {
        slog.Error("operation failed", "error", err, "id", id)
        RespondInternalError(w, r, "Failed to process request"); return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

### PublisherResolver (REQUIRED for publisher endpoints)
```go
// FORBIDDEN - manual extraction
userID := middleware.GetUserID(ctx)
publisherID := r.Header.Get("X-Publisher-Id")

// REQUIRED
pc := h.publisherResolver.MustResolve(w, r)  // Returns nil + sends error if fails
pc, err := h.publisherResolver.Resolve(ctx, r)  // Custom error handling
pc := h.publisherResolver.ResolveOptional(ctx, r)  // Mixed endpoints
```

### SQLc (REQUIRED - no raw SQL in handlers)
```go
// FORBIDDEN
query := `SELECT * FROM publishers WHERE id = $1`
rows, _ := h.db.Pool.Query(ctx, query, id)

// REQUIRED
result, err := h.db.Queries.GetPublisher(ctx, publisherID)
```

### Response Helpers
```go
RespondJSON(w, r, http.StatusOK, data)        // 200
RespondJSON(w, r, http.StatusCreated, data)   // 201
RespondValidationError(w, r, "msg", details)  // 400
RespondBadRequest(w, r, "msg")                // 400
RespondUnauthorized(w, r, "msg")              // 401
RespondForbidden(w, r, "msg")                 // 403
RespondNotFound(w, r, "msg")                  // 404
RespondConflict(w, r, "msg")                  // 409
RespondInternalError(w, r, "msg")             // 500
```

### Logging - slog only
```go
slog.Error("operation failed", "error", err, "user_id", userID, "publisher_id", publisherID)
slog.Info("user created", "user_id", userID)
// FORBIDDEN: fmt.Println, log.Println, log.Printf
```

### Error Handling
```go
// REQUIRED - wrap with context
return nil, fmt.Errorf("failed to fetch publisher: %w", err)

// FORBIDDEN - naked returns
return nil, err

// Log at handler boundary, not in services
// User messages: generic for 500s, never expose internals
```

---

## API Standards

### Response Format
```json
{ "data": <payload>, "meta": { "timestamp": "...", "request_id": "..." } }
```

**RULE:** Pass data directly to RespondJSON - NEVER double-wrap
```go
RespondJSON(w, r, 200, publishers)  // CORRECT: { "data": [...] }
RespondJSON(w, r, 200, map[string]interface{}{"publishers": publishers})  // FORBIDDEN
```

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Protected endpoints | `Bearer {token}` |
| `Content-Type` | POST/PUT | `application/json` |
| `X-Publisher-Id` | Publisher endpoints | Publisher context |

### Status Codes
200 OK | 201 Created | 204 No Content | 400 Bad Request | 401 Unauthorized | 403 Forbidden | 404 Not Found | 409 Conflict | 500 Internal Error

---

## Testing Standards

### Parallel Execution (REQUIRED)
```typescript
test.describe.configure({ mode: 'parallel' });  // REQUIRED at top of every spec file
```

### Shared Fixtures (REQUIRED - no per-test data creation)
```typescript
// FORBIDDEN
test.beforeEach(async () => { testPublisher = await createTestPublisherEntity({...}); });

// REQUIRED
import { getSharedPublisher, getPublisherWithAlgorithm } from '../utils';
const publisher = getSharedPublisher('verified-1');
```

### Shared Publisher Types
| Key | Use Case |
|-----|----------|
| `verified-1` to `verified-5` | General auth tests |
| `pending` / `suspended` | Status flow tests |
| `with-algorithm-1`, `with-algorithm-2` | Algorithm editor |
| `with-coverage` | Coverage page |
| `empty-1` to `empty-3` | Onboarding/empty state |

### Test Pattern
```typescript
import { test, expect } from '@playwright/test';
import { loginAsPublisher, getSharedPublisher, BASE_URL } from '../utils';

test.describe.configure({ mode: 'parallel' });

test.describe('Feature', () => {
  test('description', async ({ page }) => {
    const publisher = getSharedPublisher('verified-1');
    await loginAsPublisher(page, publisher.id);
    await page.goto(`${BASE_URL}/publisher/dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
```

### Auth Helpers
```typescript
await loginAsAdmin(page);
await loginAsPublisher(page, publisherId);
await loginAsUser(page);
```

### Assertions
```typescript
// CORRECT - role/text selectors
await expect(page.getByRole('heading', { name: 'Title' })).toBeVisible();
await expect(page.getByText('Success')).toBeVisible();
await page.waitForLoadState('networkidle');

// FORBIDDEN - fragile CSS selectors
await page.locator('.some-class > div:nth-child(2)').click();
```

### Test Data
- Use shared fixtures (pre-created)
- If creating: `TEST_E2E_${Date.now()}_Feature`
- Emails: `e2e-test-${Date.now()}@test.zmanim.com`
- FORBIDDEN: `.local` domains, non-unique names

---

## Database Standards

### Schema Normalization (STRICTLY ENFORCED)

**CRITICAL RULE:** All data must be normalized with lookup tables using integer IDs. ZERO VARCHAR lookups allowed.

#### Primary Key Pattern (MANDATORY)
```sql
-- REQUIRED - All tables use 'id' as primary key
CREATE TABLE public.example_table (
    id SERIAL PRIMARY KEY,              -- or BIGSERIAL for high-volume tables
    -- fields...
);

-- Lookup tables use GENERATED ALWAYS AS IDENTITY
CREATE TABLE public.example_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);
```

#### Lookup Table Pattern (id + key)
Every lookup/reference table MUST follow this exact pattern:

```sql
CREATE TABLE public.{name}_statuses|_types|_levels|_sources|_roles|_categories (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,           -- Programmatic identifier
    display_name_hebrew text NOT NULL,                   -- UI display (Hebrew)
    display_name_english text NOT NULL,                  -- UI display (English)
    description text,                                     -- Optional documentation
    -- Optional metadata fields (color, sort_order, etc.)
    created_at timestamp with time zone DEFAULT now()
);
```

**Verified Lookup Tables (21):**
- `publisher_statuses`, `algorithm_statuses`, `ai_index_statuses`, `request_statuses`
- `publisher_roles`, `coverage_levels`
- `jewish_event_types`, `fast_start_types`, `calculation_types`, `edge_types`
- `primitive_categories`, `zman_source_types`, `ai_content_sources`
- `geo_levels`, `data_types`, `explanation_sources`
- `day_types`, `event_categories`, `geo_data_sources`, `tag_types`, `time_categories`

#### Foreign Key Rules

```sql
-- REQUIRED - All FKs reference integer id columns
ALTER TABLE ONLY public.example_table
    ADD CONSTRAINT example_table_status_id_fkey
    FOREIGN KEY (status_id) REFERENCES public.example_statuses(id);

-- FORBIDDEN - VARCHAR foreign keys (except languages.code - see exceptions)
status character varying(20) NOT NULL  -- ✗ FORBIDDEN
status_id smallint NOT NULL            -- ✓ REQUIRED
```

**Naming Convention:**
- FK column: `{table_name}_id` (e.g., `publisher_id`, `status_id`)
- FK constraint: `{table}_{column}_fkey` (e.g., `publishers_status_id_fkey`)

#### Intentional Exceptions (ONLY these)

**1. Languages Table** (ISO 639 standard)
```sql
CREATE TABLE public.languages (
    code character varying(3) NOT NULL PRIMARY KEY,  -- 'en', 'he', 'yi'
    name text NOT NULL,
    -- ...
);
-- FK: geo_names.language_code → languages.code
```

**2. Junction Tables** (Many-to-Many with composite PKs)
```sql
CREATE TABLE public.master_zman_tags (
    master_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    PRIMARY KEY (master_zman_id, tag_id)
);
```

**3. Boundary Tables** (1:1 with parent entity)
```sql
CREATE TABLE public.geo_city_boundaries (
    city_id integer NOT NULL PRIMARY KEY,  -- Parent's ID is the PK
    boundary geography(MultiPolygon,4326) NOT NULL,
    -- ...
);
```

**4. Schema Migrations** (Framework standard)
```sql
CREATE TABLE public.schema_migrations (
    version text NOT NULL PRIMARY KEY
);
```

#### Validation Checklist

Before committing schema changes, verify:
- [ ] All tables have `id` field (except 10 documented exceptions)
- [ ] All lookup tables follow id + key pattern
- [ ] All foreign keys reference integer `id` columns (except `languages.code`)
- [ ] Zero VARCHAR/TEXT primary keys or foreign key columns
- [ ] Lookup table seed data uses `key` column, not hardcoded IDs

```bash
# Detection commands
grep -E "_id\s+(character varying|varchar|text)" db/migrations/*.sql  # Should be 0 results
grep "FOREIGN KEY.*REFERENCES.*[(]id[)]" db/migrations/*.sql | wc -l  # Should be 88
grep "FOREIGN KEY.*REFERENCES.*[(]code[)]" db/migrations/*.sql | wc -l  # Should be 1
```

---

## Database Migrations

### Run Migrations
```bash
./scripts/migrate.sh  # Auto-detects environment, tracks in schema_migrations
```

### Create Migration
```bash
# 1. Create: db/migrations/20240029_description.sql
# 2. Write idempotent SQL (IF NOT EXISTS, ON CONFLICT DO NOTHING)
# 3. Run: ./scripts/migrate.sh
# 4. Regenerate SQLc: cd api && sqlc generate
# 5. Rebuild: go build ./...
```

### Migration Patterns

#### Adding a Lookup Table
```sql
-- 1. Create lookup table (always use this pattern)
CREATE TABLE public.example_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Seed data (use key, not id)
INSERT INTO example_types (key, display_name_hebrew, display_name_english, description) VALUES
('type_a', 'סוג א', 'Type A', 'First type'),
('type_b', 'סוג ב', 'Type B', 'Second type');

-- 3. Add FK column to existing table
ALTER TABLE public.example_table
    ADD COLUMN type_id smallint;

-- 4. Backfill existing data (if applicable)
UPDATE example_table
SET type_id = (SELECT id FROM example_types WHERE key = 'type_a')
WHERE legacy_type_column = 'A';

-- 5. Add FK constraint
ALTER TABLE ONLY public.example_table
    ADD CONSTRAINT example_table_type_id_fkey
    FOREIGN KEY (type_id) REFERENCES public.example_types(id);

-- 6. Drop old VARCHAR column (after verification)
ALTER TABLE public.example_table DROP COLUMN legacy_type_column;
```

#### Converting VARCHAR Lookups to Normalized Tables
```sql
-- BEFORE (bad)
CREATE TABLE publishers (
    status character varying(20) -- 'pending', 'active', 'suspended'
);

-- AFTER (good)
CREATE TABLE publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE
);

CREATE TABLE publishers (
    status_id smallint REFERENCES publisher_statuses(id)
);
```

---

## Development Workflow

### Service Restart
```bash
./restart.sh  # ALWAYS use this - handles migrations, cleanup, tmux
# FORBIDDEN: manual go run, npm run dev, pkill
```

### Service URLs
| Service | Port |
|---------|------|
| Web | 3001 |
| API | 8080 |

### Redis Cache
```bash
redis-cli -h redis KEYS "zmanim:*" | xargs -r redis-cli -h redis DEL  # Clear zmanim
redis-cli -h redis FLUSHDB  # Clear all
```

### Code Changes
```bash
# Backend: cd api && go build ./... && go test ./... && cd .. && ./restart.sh
# Frontend: cd web && npm run type-check && npm run lint (hot reload works)
# Schema: ./scripts/migrate.sh && cd api && sqlc generate && go build ./... && cd .. && ./restart.sh
```

---

## Security Standards

- **Input validation:** Backend validates all fields, frontend validates before submit
- **SQL injection:** SQLc handles parameterization - NEVER string concat in queries
- **XSS:** React escapes by default - avoid `dangerouslySetInnerHTML`
- **Auth:** Use middleware.RequireAuth/RequireRole, check isLoaded before rendering protected content

---

## Code Organization

### File Naming
| Type | Convention | Example |
|------|------------|---------|
| Go handlers/services | snake_case | `publisher_zmanim.go` |
| React components | PascalCase | `WeeklyPreviewDialog.tsx` |
| React hooks | camelCase + use | `useApiQuery.ts` |
| Utilities | kebab-case | `api-client.ts` |

### Import Order
**Go:** stdlib → third-party → internal (blank lines between)
**TypeScript:** React/framework → third-party → internal → types

### Function Order
**Go:** Types → Constructors → Public → Private → Helpers
**React:** Imports → Types → Component (hooks → callbacks → effects → early returns → render) → Helpers

---

## Git Standards

### Branches
`feature/epic-{n}-{description}` | `fix/{description}` | `refactor/{scope}-{description}`

### Commits
```
<type>(<scope>): <description>

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```
Types: feat, fix, refactor, docs, test, chore, style, perf

---

## Technical Debt (2025-12-02)

| Category | Count | Severity |
|----------|-------|----------|
| Raw `fetch()` in .tsx | 73 | CRITICAL |
| `log.Printf/fmt.Printf` in Go | ~100 | HIGH |
| `waitForTimeout` in tests | 52 | HIGH |
| Double-wrapped API responses | 80+ | MEDIUM |
| Test files missing parallel mode | 23/29 | MEDIUM |

### Detection Commands
```bash
grep -r "await fetch\(" web/app web/components --include="*.tsx" | wc -l  # Should be 0
grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" | wc -l  # Should be 0
grep -r "waitForTimeout" tests/e2e --include="*.ts" | wc -l  # Should be 0
```

### Exemptions
`api/cmd/` (CLI tools) | `api/internal/db/sqlcgen/` (auto-generated)

---

## AI Agent Optimization

### File Headers (RECOMMENDED)
Add metadata headers to aid AI navigation and pattern recognition.

**TypeScript/React:**
```tsx
/**
 * @file ComponentName.tsx
 * @module components/publisher
 * @pattern client-component
 * @compliance useApi:✓ design-tokens:✓ clerk-isloaded:✓
 * @dependencies api:/publisher/profile hooks:useApi,usePublisherQuery
 */
```

**Go:**
```go
// File: handler_name.go
// Module: handlers
// Pattern: 6-step-handler
// Compliance: PublisherResolver:✓ SQLc:✓ slog:✓
// Dependencies: Queries:zmanim.sql,algorithms.sql Services:algorithm_service
```

### Directory Index Files (HIGH PRIORITY)
Create `INDEX.md` in major directories for quick AI navigation.

**Example:** `api/internal/handlers/INDEX.md`
```markdown
# Handler Registry

| File | Endpoints | Pattern | Dependencies |
|------|-----------|---------|--------------|
| publisher_zmanim.go | GET/POST/PUT /publisher/zmanim | 6-step | zmanim.sql |
| coverage.go | GET/POST /publisher/coverage | 6-step | coverage.sql |

Pattern Compliance: PublisherResolver 15/18 | SQLc 100% | Raw SQL 0
```

### Architecture Decision Records (CRITICAL)
Document **why** patterns exist: `docs/adr/{nnn}-{title}.md`

**Template:**
```markdown
# ADR-001: SQLc Mandatory for All Queries

Status: Accepted | Date: 2025-11-15

## Context
Raw SQL caused 20+ runtime type bugs, no compile-time safety.

## Decision
ALL database queries MUST use SQLc-generated code.

## Consequences
✓ Type safety | ✓ Zero SQL injection | ✗ Two-step workflow

## Compliance
grep -rE "db\.Pool\.Query" api/internal/handlers/ --include="*.go"  # Must be 0

## Examples
Good: h.db.Queries.GetPublisher(ctx, id)
Bad: db.Pool.Query(ctx, "SELECT * FROM publishers WHERE id = $1", id)
```

### Compliance Dashboard (HIGH PRIORITY)
Machine-readable status file: `docs/compliance/status.yaml`

```yaml
last_updated: "2025-12-07T10:30:00Z"

metrics:
  backend:
    raw_sql_violations: 0
    slog_adoption: 88%
  frontend:
    raw_fetch_calls: 73
    use_api_adoption: 62%
  testing:
    parallel_mode: 79%

violations:
  - file: web/components/onboarding/ReviewPublishStep.tsx
    line: 45
    issue: Raw fetch() call
    fix: Replace with useApi()
    priority: critical
```

### Dependency Maps (RECOMMENDED)
Explicit graphs in `docs/architecture/dependency-map.md`

```markdown
## Handler → Query Dependencies
- publisher_zmanim.go → zmanim.sql, algorithms.sql
- coverage.go → coverage.sql, geo_boundaries.sql

## Frontend → Backend
- WeeklyPreviewDialog.tsx → GET /zmanim/preview (auth required)
- CoverageMap.tsx → GET /geo/boundaries (auth optional)
```

### Compliance Check Script (CRITICAL)
Automated detection: `scripts/check-compliance.sh`

```bash
#!/bin/bash
echo "Backend:"
echo "  Raw SQL: $(grep -rE "db\.Pool\.Query" api/internal/handlers/ --include="*.go" | wc -l)"
echo "Frontend:"
echo "  Raw fetch: $(grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l)"
exit 0
```

### AI-Optimized File Structure

```
zmanim-lab/
├── .ai/                          # AI-specific metadata
│   ├── compliance/
│   │   └── status.yaml           # Machine-readable metrics
│   └── context/
│       ├── backend-patterns.md   # Quick reference
│       └── frontend-patterns.md
├── docs/
│   ├── adr/                      # Architecture decisions
│   │   ├── 001-sqlc-mandatory.md
│   │   └── 002-use-api-pattern.md
│   └── architecture/
│       └── dependency-map.md
└── api/internal/handlers/
    └── INDEX.md                  # Handler registry
```

### Implementation Priority

**Week 1:** Compliance dashboard + check script
**Week 2:** INDEX.md for handlers/, components/, queries/
**Week 3:** ADRs for top 5 patterns
**Week 4:** File headers for 20 most-used files

---

## Quick Reference Checklists

### Frontend
1. `'use client'` only for hooks/events
2. `useApi()` for all API calls
3. Design tokens for colors
4. 12-hour time format
5. Loading → Error → Content pattern
6. Check `isLoaded` before Clerk access

### Backend
1. PublisherResolver for publisher endpoints
2. SQLc for all queries
3. slog for logging
4. Response helpers for all responses
5. Wrap errors with context
6. Generic messages for 500s

### Testing
1. `test.describe.configure({ mode: 'parallel' })`
2. Shared fixtures only
3. `waitForLoadState('networkidle')` before assertions
4. Role/text selectors
5. `TEST_` prefix if creating data

### Database Schema
1. All tables use `id` primary key (except documented exceptions)
2. All lookup tables follow id + key pattern
3. All foreign keys reference integer `id` (except `languages.code`)
4. Zero VARCHAR/TEXT lookup fields
5. Lookup seed data uses `key` column, not hardcoded IDs

### PR Checklist
- [ ] Publisher zmanim linked (master_registry or linked_zman)
- [ ] Service restarts via `./restart.sh`
- [ ] No hardcoded colors
- [ ] No raw fetch()
- [ ] PublisherResolver pattern
- [ ] SQLc queries
- [ ] slog logging
- [ ] 12-hour time format
- [ ] E2E tests with parallel mode
- [ ] Database normalization (if schema changes):
  - [ ] All new tables use `id` primary key
  - [ ] Lookup tables follow id + key pattern with bilingual display names
  - [ ] Foreign keys reference integer `id` columns
  - [ ] Zero VARCHAR lookups or foreign keys
  - [ ] Seed data uses `key` column
