# AI Quick Start Guide

**For AI agents working on Shtetl Zmanim**

This guide shows you how to efficiently navigate and modify the codebase using the AI-optimized infrastructure.

---

## 🚀 Quick Commands

```bash
# Get focused context for your task
./scripts/ai-context.sh handlers      # Backend handlers
./scripts/ai-context.sh components    # Frontend components
./scripts/ai-context.sh queries       # Database queries
./scripts/ai-context.sh database      # Schema standards
./scripts/ai-context.sh compliance    # Check violations

# Check compliance before making changes
./scripts/check-compliance.sh

# Update compliance metrics after changes
./scripts/update-compliance.sh
```

---

## 📚 Essential Files (Read These First)

### Project Overview
```bash
cat CLAUDE.md                    # Project overview, tech stack, commands
cat docs/coding-standards.md     # CRITICAL: Cast-iron rules
```

### Navigation Indexes (Instant Context)
```bash
cat api/internal/handlers/INDEX.md       # 28 HTTP handlers
cat api/internal/db/queries/INDEX.md     # 20 SQL query files
cat web/components/INDEX.md              # ~100 React components
```

### Pattern Rationale (Why Rules Exist)
```bash
cat docs/adr/001-sqlc-mandatory.md            # Why SQLc, not raw SQL
cat docs/adr/002-use-api-pattern.md           # Why useApi(), not fetch()
cat docs/adr/003-publisher-resolver.md        # Why PublisherResolver
cat docs/adr/004-lookup-table-normalization.md # Why id + key pattern
cat docs/adr/005-design-tokens-only.md        # Why tokens, not hardcoded colors
```

### Compliance Dashboard
```bash
cat docs/compliance/status.yaml  # Current metrics, violations
```

---

## 🎯 Task-Specific Workflows

### Adding a New Handler

**Context needed:**
```bash
./scripts/ai-context.sh handlers > /tmp/context.md
# Read: Handler INDEX, ADR-001 (SQLc), ADR-003 (PublisherResolver)
```

**Steps:**
1. Create SQL queries in `api/internal/db/queries/my_feature.sql`
2. Run `cd api && sqlc generate`
3. Create handler in `api/internal/handlers/my_feature.go` (6-step pattern)
4. Use `h.publisherResolver.MustResolve(w, r)` (step 1)
5. Use `h.db.Queries.*` for all DB operations (step 5)
6. Register route in `api/cmd/api/main.go`
7. Check compliance: `./scripts/check-compliance.sh`

**Compliance checklist:**
- [ ] Uses PublisherResolver (not manual header extraction)
- [ ] Uses SQLc queries (no `db.Pool.Query`)
- [ ] Uses slog (no `log.Printf` or `fmt.Printf`)
- [ ] Uses response helpers (RespondJSON, RespondError, etc.)

### Adding a New Component

**Context needed:**
```bash
./scripts/ai-context.sh components > /tmp/context.md
# Read: Component INDEX, ADR-002 (useApi), ADR-005 (Design Tokens)
```

**Steps:**
1. Create component in `web/components/[category]/MyComponent.tsx`
2. Mark as `'use client'` if uses hooks/events
3. Use `const api = useApi()` for API calls
4. Check `isLoaded` before using Clerk auth
5. Use design tokens (no hardcoded colors)
6. Use 12-hour time format (`formatTime`, `formatTimeShort`)
7. Check compliance: `./scripts/check-compliance.sh`

**Compliance checklist:**
- [ ] Uses `useApi()` (not raw fetch)
- [ ] Checks `isLoaded` before Clerk access
- [ ] Uses design tokens (`text-foreground`, `bg-card`, etc.)
- [ ] 12-hour time format
- [ ] Loading → Error → Content pattern

### Adding Database Tables

**Context needed:**
```bash
./scripts/ai-context.sh database > /tmp/context.md
# Read: ADR-004 (Lookup Tables), Database Standards
```

**Steps:**
1. Create migration: `db/migrations/YYYYMMDD_description.sql`
2. Follow `id` primary key pattern (except 4 documented exceptions)
3. Use lookup tables (id + key + display_name) for all enums
4. Reference lookups by integer `id` (not VARCHAR)
5. Run: `./scripts/migrate.sh`
6. Update SQLc: `cd api && sqlc generate`
7. Check compliance: `./scripts/check-compliance.sh`

**Compliance checklist:**
- [ ] All tables have `id` primary key (except exceptions)
- [ ] Lookup tables follow id + key + bilingual names
- [ ] Foreign keys reference integer `id` (except `languages.code`)
- [ ] Zero VARCHAR foreign keys
- [ ] Seed data uses `key` column (not hardcoded IDs)

### Adding SQL Queries

**Context needed:**
```bash
./scripts/ai-context.sh queries > /tmp/context.md
# Read: Query INDEX, ADR-001 (SQLc)
```

**Steps:**
1. Add query to `api/internal/db/queries/feature.sql`
2. Add SQLc annotation: `-- name: GetSomething :one` / `:many` / `:exec`
3. Run: `cd api && sqlc generate`
4. Use in handler: `h.db.Queries.GetSomething(ctx, params)`
5. Check compliance: `./scripts/check-compliance.sh`

**Compliance checklist:**
- [ ] Query in `.sql` file (not inline in Go)
- [ ] Has SQLc annotation (`:one`, `:many`, `:exec`)
- [ ] Uses parameterized queries (no string concatenation)
- [ ] Joins lookup tables by `id`, filters by `key`

---

## ⚠️ Common Pitfalls

### Backend

**❌ FORBIDDEN:**
```go
// Raw SQL
query := `SELECT * FROM publishers WHERE id = $1`
db.Pool.Query(ctx, query, id)

// Manual header extraction
publisherID := r.Header.Get("X-Publisher-Id")

// log.Printf
log.Printf("error: %v", err)
```

**✅ REQUIRED:**
```go
// SQLc
result, err := h.db.Queries.GetPublisher(ctx, id)

// PublisherResolver
pc := h.publisherResolver.MustResolve(w, r)

// slog
slog.Error("failed to get publisher", "error", err, "id", id)
```

### Frontend

**❌ FORBIDDEN:**
```tsx
// Raw fetch
const response = await fetch(`${API_BASE}/endpoint`)

// Hardcoded colors
className="text-[#111827] bg-white"

// Missing isLoaded check
const { user } = useUser();
const token = await getToken(); // May be null!
```

**✅ REQUIRED:**
```tsx
// useApi
const api = useApi();
const data = await api.get<DataType>('/endpoint');

// Design tokens
className="text-foreground bg-card"

// isLoaded check
const { isLoaded, user } = useUser();
if (!isLoaded) return <Loader2 />;
const token = await getToken(); // Now safe
```

### Database

**❌ FORBIDDEN:**
```sql
-- VARCHAR enum
status VARCHAR(20) NOT NULL  -- 'pending', 'verified'

-- VARCHAR foreign key
publisher_id VARCHAR(50) REFERENCES publishers(clerk_id)

-- Hardcoded ID in seed
INSERT INTO publishers (status_id) VALUES (2)
```

**✅ REQUIRED:**
```sql
-- Lookup table
CREATE TABLE publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key VARCHAR(20) NOT NULL UNIQUE
);

-- Integer foreign key
publisher_id INTEGER REFERENCES publishers(id)

-- Key-based seed
INSERT INTO publishers (status_id) VALUES
((SELECT id FROM publisher_statuses WHERE key = 'verified'))
```

---

## 🔍 Finding Information

### "Where is X handled?"

```bash
# Find handler
cat api/internal/handlers/INDEX.md | grep -i "endpoint_name"

# Find component
cat web/components/INDEX.md | grep -i "component_name"

# Find query
cat api/internal/db/queries/INDEX.md | grep -i "table_name"
```

### "What queries does handler X use?"

```bash
cat api/internal/handlers/INDEX.md
# Look in "Handler Map" table → "Queries Used" column
```

### "What APIs does component X call?"

```bash
cat web/components/INDEX.md
# Look in "Component → API Dependencies" section
```

### "Why does this rule exist?"

```bash
# Find ADR by topic
ls docs/adr/
cat docs/adr/001-sqlc-mandatory.md        # SQLc
cat docs/adr/002-use-api-pattern.md       # useApi
cat docs/adr/003-publisher-resolver.md    # PublisherResolver
cat docs/adr/004-lookup-table-normalization.md  # Lookup tables
cat docs/adr/005-design-tokens-only.md    # Design tokens
```

### "What violations exist?"

```bash
# Current status
cat docs/compliance/status.yaml

# Live scan
./scripts/check-compliance.sh
```

---

## 📊 Compliance Workflow

### Before Making Changes

```bash
# 1. Get context for your task
./scripts/ai-context.sh [topic] > /tmp/context.md

# 2. Check current compliance
./scripts/check-compliance.sh

# 3. Read relevant ADRs
cat docs/adr/00X-pattern-name.md
```

### While Making Changes

```bash
# Reference INDEX files for patterns
cat api/internal/handlers/INDEX.md       # Handler pattern
cat api/internal/db/queries/INDEX.md     # Query pattern
cat web/components/INDEX.md              # Component pattern

# Reference coding standards
grep "## [Category] Standards" docs/coding-standards.md
```

### After Making Changes

```bash
# 1. Check compliance
./scripts/check-compliance.sh
# Should show 0 violations (or reduced count)

# 2. Update metrics
./scripts/update-compliance.sh

# 3. Test changes
./restart.sh  # Restart services
cd tests && npx playwright test  # Run tests
```

---

## 🎓 Learning Path

**Day 1: Understand the project**
1. Read `CLAUDE.md` (15 min)
2. Read `docs/coding-standards.md` (30 min)
3. Scan all 3 INDEX files (20 min)

**Day 2: Understand patterns**
4. Read all 5 ADRs (60 min)
5. Run `./scripts/check-compliance.sh` (5 min)
6. Review `docs/compliance/status.yaml` (10 min)

**Day 3: Practice**
7. Use `ai-context.sh` for a sample task
8. Follow a handler/component example
9. Check compliance after changes

---

## 💡 Pro Tips

1. **Always use ai-context.sh** - Don't read full source files unless needed
2. **INDEX files are your friend** - Start there, not grep
3. **ADRs explain why** - Read them when pattern seems arbitrary
4. **Compliance dashboard is truth** - Trust the metrics
5. **Run check-compliance.sh** - Before committing, before PRs

---

## 🆘 Troubleshooting

### "I don't know where to start"

```bash
./scripts/ai-context.sh all > /tmp/full-context.md
# Read this first, then drill down
```

### "I'm not sure if my changes are compliant"

```bash
./scripts/check-compliance.sh
# Exit code 0 = compliant, 1 = violations
```

### "I need to understand a pattern"

```bash
ls docs/adr/
cat docs/adr/00X-pattern-name.md
```

### "I want to see examples"

```bash
# Look in INDEX files for "Examples" sections
cat api/internal/handlers/INDEX.md | grep -A 50 "## Common Patterns"
cat web/components/INDEX.md | grep -A 50 "## Pattern"
```

---

## 📞 Quick Reference

| Need | Command |
|------|---------|
| Handler context | `./scripts/ai-context.sh handlers` |
| Component context | `./scripts/ai-context.sh components` |
| Query context | `./scripts/ai-context.sh queries` |
| Database context | `./scripts/ai-context.sh database` |
| Check compliance | `./scripts/check-compliance.sh` |
| Update metrics | `./scripts/update-compliance.sh` |
| View handlers | `cat api/internal/handlers/INDEX.md` |
| View components | `cat web/components/INDEX.md` |
| View queries | `cat api/internal/db/queries/INDEX.md` |
| View violations | `cat docs/compliance/status.yaml` |
| Restart services | `./restart.sh` |
| Run tests | `cd tests && npx playwright test` |

---

**Last Updated:** 2025-12-07
**For Questions:** Read ADRs, check INDEX files, run compliance scripts
