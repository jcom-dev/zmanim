# Global Coding Standards - Shtetl Projects

**Status:** CAST-IRON RULES - Violations block PRs
**Audience:** AI agents and developers
**Scope:** All Shtetl projects (Shtetl Zmanim, Shul Management, etc.)

---

## Purpose

This document defines reusable coding standards across all Shtetl projects. Project-specific rules live in each project's `docs/coding-standards.md` which inherits from this document.

---

## 1. Security - ZERO TOLERANCE

### 1.1 Secrets Management

**FORBIDDEN - NEVER commit to repository:**
- Passwords, API keys, tokens, secrets
- Database connection strings (with credentials)
- Private keys, certificates
- AWS credentials, S3 bucket URLs with keys
- OAuth client secrets
- Session secrets, JWT signing keys
- `.env` files with real credentials

**REQUIRED patterns:**
```bash
# .env (gitignored)
DATABASE_URL=postgresql://user:pass@host/db
API_KEY=sk_live_abc123

# .env.example (safe to commit - template)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
API_KEY=your_api_key_here
```

```go
// ✗ FORBIDDEN
const apiKey = "sk_live_abc123..."
const dbURL = "postgresql://user:pass@host/db"

// ✓ REQUIRED
apiKey := os.Getenv("API_KEY")
dbURL := os.Getenv("DATABASE_URL")
```

```typescript
// ✗ FORBIDDEN
const apiKey = "sk_live_abc123...";

// ✓ REQUIRED
const apiKey = process.env.API_KEY;
```

**If accidentally committed:**
1. Immediately rotate/revoke the exposed secret
2. Remove from git history: `git filter-branch` or BFG Repo-Cleaner
3. Force push (coordinate with team)
4. Update all environments with new secrets

### 1.2 Entity References - ALWAYS Use IDs

**FORBIDDEN:** Text-based lookups, name matching, string identifiers

**REQUIRED:** Numeric IDs for ALL entity references

```typescript
// ✗ FORBIDDEN
await api.post('/coverage', { city_name: 'Jerusalem' });

// ✓ REQUIRED
await api.post('/coverage', { city_id: 293397 });
```

**Why:** Text matching causes case sensitivity bugs, locale issues, ambiguity, performance problems.

---

## 2. Clean Code Policy

**FORBIDDEN patterns - delete, don't mark:**
- `@deprecated`, `// Legacy`, `// TODO: remove`, `// FIXME`
- Fallback logic for old formats
- Dual-format support
- Re-exports "for compatibility"

**Rule:** One format only. Migrate data, update code, delete old code.

---

## 3. Frontend Standards (React/Next.js)

### 3.1 Component Pattern
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api-client';

export function Component() {
  // 1. Hooks first
  const api = useApi();
  const [data, setData] = useState(null);

  // 2. Effects
  useEffect(() => { /* ... */ }, []);

  // 3. Early returns: Loading → Error → Content
  if (loading) return <Loader2 className="animate-spin" />;
  if (error) return <div className="text-destructive">{error}</div>;
  return <div>{/* content */}</div>;
}
```

### 3.2 API Client Pattern

**FORBIDDEN:**
```tsx
fetch(`${API_BASE}/api/v1/endpoint`)
```

**REQUIRED:**
```tsx
const api = useApi();
await api.get<DataType>('/endpoint');        // Auth
await api.public.get('/countries');           // No auth
await api.admin.get('/admin/stats');          // Admin auth
```

### 3.3 Design Tokens (Tailwind/shadcn)

**FORBIDDEN:**
```tsx
className="text-[#1e3a5f]" | style={{ color: '#ff0000' }}
```

**REQUIRED:**
```tsx
className="text-primary" | className="bg-muted" | className="text-destructive"
```

| Token | Usage |
|-------|-------|
| `foreground/background` | Primary text/page bg |
| `primary/primary-foreground` | CTAs, links |
| `muted/muted-foreground` | Disabled, secondary text |
| `destructive` | Errors, delete actions |
| `card/card-foreground` | Card components |
| `border/input/ring` | Borders, inputs, focus |

### 3.4 Auth Pattern (Clerk)

```tsx
const { isLoaded, isSignedIn, user } = useUser();
if (!isLoaded) return <LoadingSpinner />;
if (!isSignedIn) redirect('/sign-in');
```

### 3.5 React Query Pattern

```tsx
const { data, isLoading } = useQuery(['key'], () => api.get('/endpoint'));
const mutation = useMutation({
  mutationFn: (data) => api.post('/endpoint', data),
  onSuccess: () => queryClient.invalidateQueries(['key']),
});
```

---

## 4. Backend Standards (Go)

### 4.1 Handler Pattern (6 Steps)
```go
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Extract/resolve context (auth, publisher, etc.)
    // 2. Extract URL params
    id := chi.URLParam(r, "id")

    // 3. Parse body
    var req RequestStruct
    json.NewDecoder(r.Body).Decode(&req)

    // 4. Validate
    if req.Name == "" {
        RespondValidationError(w, r, "name required", nil)
        return
    }

    // 5. Database operation (SQLc - NO raw SQL)
    result, err := h.db.Queries.GetSomething(ctx, params)
    if err != nil {
        RespondError(w, r, http.StatusInternalServerError, "operation failed")
        return
    }

    // 6. Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

### 4.2 Logging - slog Only

```go
// ✓ REQUIRED
slog.Error("operation failed", "error", err, "user_id", userID)
slog.Info("request processed", "duration_ms", elapsed)

// ✗ FORBIDDEN
fmt.Println("Debug:", something)
log.Printf("Error: %v", err)
```

### 4.3 Database - SQLc Only

```go
// ✓ REQUIRED
result, err := h.db.Queries.GetUserByID(ctx, userID)

// ✗ FORBIDDEN
rows, err := db.Query("SELECT * FROM users WHERE id = $1", userID)
```

### 4.4 Response Format
```json
{ "data": <payload>, "meta": { "timestamp": "...", "request_id": "..." } }
```

**Rule:** Pass data directly to RespondJSON - NEVER double-wrap

---

## 5. Database Standards (PostgreSQL)

### 5.1 Primary Keys
```sql
-- Standard tables - Integer IDs
CREATE TABLE example_table (
    id SERIAL PRIMARY KEY,  -- or BIGSERIAL for high-volume
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Lookup tables - GENERATED ALWAYS
CREATE TABLE example_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) NOT NULL UNIQUE,
    display_name text NOT NULL
);
```

### 5.2 Foreign Keys
```sql
-- ✓ REQUIRED - Integer FKs
status_id smallint NOT NULL REFERENCES statuses(id)

-- ✗ FORBIDDEN - VARCHAR FKs
status varchar(20) NOT NULL
```

### 5.3 Lookup Tables Pattern
```sql
CREATE TABLE {entity}_types|_statuses|_levels (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key varchar(20) NOT NULL UNIQUE,           -- Programmatic ID
    display_name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- Seed using key, not id
INSERT INTO example_types (key, display_name) VALUES
('type_a', 'Type A'),
('type_b', 'Type B');
```

---

## 6. Testing Standards

### 6.1 Parallel Execution (REQUIRED)
```typescript
test.describe.configure({ mode: 'parallel' });  // Top of every spec
```

### 6.2 Shared Fixtures
```typescript
// ✗ FORBIDDEN - per-test creation
test.beforeEach(async () => { testData = await create(...); });

// ✓ REQUIRED - shared fixtures
const data = getSharedFixture('verified-1');
```

### 6.3 Stable Selectors
```typescript
// ✓ REQUIRED
await page.getByRole('button', { name: 'Submit' });
await page.getByTestId('user-profile');

// ✗ FORBIDDEN
await page.waitForTimeout(2000);
await page.locator('.btn-primary').click();
```

---

## 7. Git & CI/CD Standards

### 7.1 Branch Naming
```
feature/epic-{n}-{desc}
fix/{desc}
refactor/{scope}-{desc}
```

### 7.2 Commit Messages
```
<type>(<scope>): <description>

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### 7.3 Local Testing Before Push

**FORBIDDEN:** Push-and-wait cycle

**REQUIRED:** Test ALL changes locally BEFORE committing:
```bash
# Go
cd api && go build -v ./... && go test ./... && golangci-lint run ./...

# TypeScript
cd web && npm run type-check && npm run lint && npm run build

# After push - monitor
gh run watch
```

---

## 8. Infrastructure Strategy

### 8.1 Two-Environment Model

| Environment | Purpose | Stack |
|-------------|---------|-------|
| Development | Fast iteration, cheap | Fly.io + Vercel + Xata + Upstash |
| Production | Reliability, control | AWS (CDKTF) |

### 8.2 Development Stack (Cheap & Fast)
- **API:** Fly.io (free tier, auto-sleep)
- **Frontend:** Vercel (free tier, preview deployments)
- **Database:** Xata (free PostgreSQL with generous limits)
- **Redis:** Upstash (free tier, serverless)

**Benefits:**
- Zero infrastructure management
- Preview deployments per PR
- Free tiers sufficient for development
- Fast deploys (< 1 minute)

### 8.3 Production Stack (AWS with CDKTF)
```
CloudFront (CDN)
├── /* → Lambda@Edge or EC2
└── /api/* → API Gateway → EC2

EC2 (ARM64)
├── Application
├── PostgreSQL + PostGIS
└── Redis

EBS Volume (/data) - survives instance replacement
```

**Key Patterns:**
- **CDKTF (Terraform)** over CDK for better state management
- **Single EC2** for small apps (DB + Redis colocated)
- **Persistent EBS** mounted at `/data` for database
- **SSM Parameter Store** for secrets (free tier)
- **Packer** for AMI builds (reproducible)

### 8.4 GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-checks.yml` | PR to dev | Lint, type-check, unit tests |
| `pr-e2e.yml` | PR to dev | E2E tests with services |
| `deploy-dev-*.yml` | Push to dev | Deploy to development |
| `deploy-prod-*.yml` | Push to main | Deploy to production |
| `build-prod-ami.yml` | Tag v*-ami | Build production AMI |

---

## 9. AI-Friendly Code Practices

### 9.1 File Headers
```tsx
/**
 * @file ComponentName.tsx
 * @pattern client-component
 * @dependencies useApi, React Query
 */
```

```go
// File: handler.go
// Pattern: 6-step-handler
// Dependencies: SQLc, slog
```

### 9.2 Index Files
Maintain `INDEX.md` in key directories:
- `api/internal/handlers/INDEX.md`
- `api/internal/db/queries/INDEX.md`
- `web/components/INDEX.md`

### 9.3 Architecture Documentation
- ADRs in `docs/adr/` for decisions
- Data flow diagrams
- Dependency maps
- Quick start guides

### 9.4 Concept Independence (Aspirational)

**Source:** ["What You See Is What It Does" (arXiv:2508.14511v2)](https://arxiv.org/html/2508.14511v2#S3)

**Principles:**
1. **Provenance tracking** - Record all state changes with causal chain
2. **Service extraction** - Multi-concept operations use services
3. **Read/write separation** - Clear boundaries
4. **Focused queries** - 3-5 concepts max per query

---

## 10. PR Checklist (Global)

- [ ] **Security:** No secrets, passwords, or credentials
- [ ] No hardcoded colors (use design tokens)
- [ ] No raw fetch() (use API client)
- [ ] SQLc queries (no raw SQL)
- [ ] slog logging (no fmt.Printf)
- [ ] Entity references use IDs (not names)
- [ ] Tests use parallel mode
- [ ] Tests use shared fixtures
- [ ] Local testing completed before push
- [ ] Database tables use integer IDs
- [ ] Lookup tables follow id + key pattern

---

## Quick Reference

### Required Tools
```bash
# Go
golangci-lint    # Linting
sqlc             # SQL code generation

# TypeScript/React
npm              # Package management
playwright       # E2E testing

# Infrastructure
terraform/cdktf  # Infrastructure as code
packer           # AMI building
gh               # GitHub CLI
```

### Environment Variables Template
```bash
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

---

**Version:** 1.0
**Last Updated:** 2025-12-13
**Maintainer:** Shtetl Team
