# CLAUDE.md

## ⚠️ MANDATORY: Read `docs/coding-standards.md` before ANY task

---

## Quick Reference

### Database
```bash
source api/.env && psql "$DATABASE_URL"
source api/.env && psql "$DATABASE_URL" -c "SELECT * FROM publishers LIMIT 5;"
```

### API Testing

**⚠️ Shell limitation:** `$()` command substitution causes "Exit code 2" in this environment.

**Step 1: Get token** (run this, then copy the eyJ... token from output)
```bash
source api/.env && node scripts/get-test-token.js
```

**Step 2: Use token inline** (paste the full token directly - do NOT use variables)
```bash
# Public endpoint (no auth)
curl -s http://localhost:8080/api/v1/publishers | jq '.'

# Admin endpoint
curl -s -H "Authorization: Bearer eyJhbG..." http://localhost:8080/api/v1/admin/stats | jq '.'

# Publisher endpoint
curl -s -H "Authorization: Bearer eyJhbG..." -H "X-Publisher-Id: 2" "http://localhost:8080/api/v1/publisher/zmanim?locality_id=4993250&date=2025-12-20" | jq '.'
```

**FORBIDDEN** (these do NOT work in this shell):
```bash
TOKEN=$(cat /tmp/token.txt)           # Exit code 2
curl -H "Authorization: Bearer $TOKEN" # Variable won't expand
```

### Services & Build
```bash
./restart.sh                      # Start/restart ALL services (ALWAYS use this)
tmux attach -t zmanim             # View logs (Ctrl+B, 0=API, 1=Web, D=detach)
cd api && go build ./cmd/api      # Build backend
cd api && sqlc generate           # After SQL query changes
cd web && npm run type-check      # Frontend type check
./scripts/validate-ci-checks.sh   # Run CI checks locally
```

### URLs
| Resource | URL |
|----------|-----|
| Web App | http://localhost:3001 |
| API | http://localhost:8080 |
| **Swagger UI** | http://localhost:8080/swagger/index.html |
| OpenAPI JSON | http://localhost:8080/swagger/doc.json |

---

## Code Quality (MANDATORY)

### REUSE BEFORE CREATE
Check these INDEX files first:
- `api/internal/handlers/INDEX.md` - Backend handlers
- `api/internal/db/queries/INDEX.md` - SQL queries
- `web/components/INDEX.md` - Frontend components

**Rules:** One function per purpose. Extend existing code. Delete unused code.

---

## Project Overview

Platform for Halachic Authorities to publish zmanim with complete autonomy over calculation formulas and transparency. Each authority defines their own algorithms using a DSL; users access zmanim specific to their chosen halachic authority.

**Stack:** Go 1.24+ / Next.js 16 / PostgreSQL+PostGIS / Clerk auth / Redis cache

### Key Tables
```
publishers, master_zmanim_registry, publisher_zmanim, publisher_coverage
geo_localities (~4M), geo_regions, geo_search_index
zman_tags, tag_event_mappings, publisher_zman_tags  # Tag-driven events
```

### Structure
```
api/internal/handlers/    # HTTP handlers (6-step pattern)
api/internal/db/queries/  # SQLc SQL files
web/app/                  # Next.js pages (admin/, publisher/, zmanim/)
web/lib/api-client.ts     # useApi() hook
```

### Tag-Driven Event Architecture

**CRITICAL**: ALL event filtering is tag-driven. NO hardcoded event logic allowed.

**Flow**: HebCal API → Database patterns (`tag_event_mappings`) → ActiveEventCodes → Tag filtering

```go
// FORBIDDEN - hardcoded event logic
if isErevShabbos || isErevYomTov {
    showCandleLighting = true  // ❌ NEVER DO THIS
}

// REQUIRED - tag-driven
activeEventCodes := []string{"erev_shabbos", "chanukah"}
result := service.CalculateZmanim(ctx, CalculateParams{
    ActiveEventCodes: activeEventCodes,  // ✅ Service filters by tags
})
```

**Adding new events**: SQL only, no code changes
```sql
-- Add event tag
INSERT INTO zman_tags (tag_key, display_name_hebrew, display_name_english_ashkenazi, tag_type_id)
VALUES ('new_event', 'Hebrew', 'English', 170);

-- Map to HebCal pattern
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern)
SELECT id, 'HebCal Event Name' FROM zman_tags WHERE tag_key = 'new_event';
```

**Docs**: `docs/architecture/tag-driven-events.md`, `docs/migration/eliminate-hardcoded-logic.md`

---

## Key Patterns

**Backend handler:**
```go
pc := h.publisherResolver.MustResolve(w, r)  // 1. Resolve publisher
id := chi.URLParam(r, "id")                   // 2. URL params
json.NewDecoder(r.Body).Decode(&req)          // 3. Parse body
// validate                                    // 4. Validate
result, err := h.db.Queries.X(ctx, params)    // 5. SQLc query (NO raw SQL)
RespondJSON(w, r, http.StatusOK, result)      // 6. Respond
```

**Frontend API:**
```tsx
const api = useApi();
await api.get('/endpoint');           // Auth + X-Publisher-Id
await api.public.get('/countries');   // No auth
await api.admin.get('/admin/stats');  // Auth only
```

**DSL formulas:** `sunrise`, `sunset - 18min`, `solar(-16.1)`, `@alos_hashachar + 30min`

**Tag-driven event filtering:**
```go
// Service filters BEFORE calculation
func (s *ZmanimService) CalculateZmanim(ctx, params CalculateParams) {
    for _, zman := range publisherZmanim {
        // Filter by tag matching with ActiveEventCodes
        if !s.ShouldShowZman(zman.tags, params.ActiveEventCodes) {
            continue  // Skip - don't calculate
        }
        formulas[zman.key] = zman.formula
    }
    // Calculate only filtered zmanim
    result := dsl.ExecuteFormulaSet(formulas, dslCtx)
}
```

**Key Query Files:**
- `tag_events.sql` - HebCal event pattern matching and tag lookups
- `master_registry.sql` - Master zmanim definitions
- `publisher_zmanim.sql` - Publisher-specific zmanim with tags
- `zmanim_unified.sql` - Combined queries for zmanim with metadata

---

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| pr-checks.yml | PR to dev | SQLc, code quality, tests (~6-8 min) |
| pr-e2e.yml | PR to dev | E2E tests (~15-20 min) |
| deploy-prod-*.yml | Push to main | Production deployment |

**Zero Tolerance:** No TODO/FIXME, no raw `fetch()`, no `fmt.Printf` (use `slog`)

```bash
./scripts/validate-ci-checks.sh  # Run before pushing
```

---

## AWS Production

**URL:** https://zmanim.shtetl.io

```
CloudFront → Next.js Lambda (/*) + API Gateway (/backend/*) → EC2 (Go API + PostgreSQL + Redis)
```

**Deploy:**
```bash
cd infrastructure && npx cdk deploy --all   # Infrastructure
git push origin main                         # Next.js (auto-deploys)
git tag v1.0.0-ami && git push origin v1.0.0-ami  # New AMI
```

SSM secrets: `/zmanim/prod/*` (postgres-password, clerk-secret-key, etc.)
