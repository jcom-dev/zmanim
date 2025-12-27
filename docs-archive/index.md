# Shtetl Zmanim Documentation

> **Last Updated:** 2025-12-21
> **Project:** Multi-publisher platform for Jewish Zmanim
> **Stack:** Go 1.24+ / Next.js 16 / PostgreSQL+PostGIS / Clerk / Redis

---

## Quick Start

```bash
# Start all services
./restart.sh

# View logs
tmux attach -t zmanim    # Ctrl+B, 0=API, 1=Web, D=detach

# URLs
Web App:     http://localhost:3001
API:         http://localhost:8080
Swagger UI:  http://localhost:8080/swagger/index.html
```

---

## Documentation Index

### Development Standards

| Document | Purpose |
|----------|---------|
| **[coding-standards.md](coding-standards.md)** | Cast-iron rules for all code (PR blockers) |
| **[CLAUDE.md](../CLAUDE.md)** | AI agent quick reference |

### Architecture

| Document | Purpose |
|----------|---------|
| **[architecture.md](architecture.md)** | System architecture overview |
| **[architecture/dependency-map.md](architecture/dependency-map.md)** | Module dependencies |
| **[architecture/data-flow-diagrams.md](architecture/data-flow-diagrams.md)** | Data flow visualizations |

### API Reference

| Document | Purpose |
|----------|---------|
| **[api/internal/handlers/INDEX.md](../api/internal/handlers/INDEX.md)** | HTTP handlers registry (44 files) |
| **[api/internal/services/INDEX.md](../api/internal/services/INDEX.md)** | Services registry (13 files) |
| **[api/internal/db/queries/INDEX.md](../api/internal/db/queries/INDEX.md)** | SQL queries registry (31 files) |
| **[Swagger UI](http://localhost:8080/swagger/index.html)** | Interactive API docs |

### Frontend Reference

| Document | Purpose |
|----------|---------|
| **[web/components/INDEX.md](../web/components/INDEX.md)** | React components registry (~122 components) |
| **[web/lib/hooks/README.md](../web/lib/hooks/README.md)** | Custom hooks documentation |

### Patterns & ADRs

| Document | Purpose |
|----------|---------|
| **[patterns/README.md](patterns/README.md)** | Implementation patterns |
| **[patterns/TEMPLATES.md](patterns/TEMPLATES.md)** | Code templates |
| **[adr/](adr/)** | Architecture Decision Records (5 ADRs) |

### Compliance

| Document | Purpose |
|----------|---------|
| **[compliance/status.yaml](compliance/status.yaml)** | Compliance metrics |
| **[compliance/concept-independence-audit.md](compliance/concept-independence-audit.md)** | Concept independence audit |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 16 (web/)                                              │
│  ├── app/                 # Pages (admin/, publisher/, zmanim/) │
│  ├── components/          # React components (~122)             │
│  ├── lib/api-client.ts    # Unified API client                  │
│  └── providers/           # React context (Publisher, Prefs)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API                                     │
│  Go 1.24+ (api/)                                                │
│  ├── handlers/            # HTTP handlers (44 files)            │
│  ├── services/            # Business logic (13 files)           │
│  │   └── zmanim_service.go  # UNIFIED source of truth          │
│  ├── dsl/                 # Formula DSL (lexer, parser, exec)   │
│  └── db/queries/          # SQLc queries (31 files)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  PostgreSQL + PostGIS                                           │
│  ├── publishers           # Publisher accounts                  │
│  ├── master_zmanim_registry  # Canonical zmanim definitions    │
│  ├── publisher_zmanim     # Publisher-specific zmanim           │
│  ├── geo_localities       # ~4M localities with coordinates     │
│  └── 21 lookup tables     # Normalized reference data           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CACHE                                    │
│  Redis                                                          │
│  └── zmanim:{pub}:{loc}:{date}:{filter}  # 24h TTL             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Publisher
An organization that publishes zmanim (Zmanim) for their community. Publishers define calculation formulas and coverage areas.

### Zman (pl. Zmanim)
A single prayer time with:
- **Formula:** DSL expression like `sunrise + 72min` or `solar(-16.1)`
- **Master Registry:** Canonical definition inherited by publishers
- **Tags:** Behavioral tags for event filtering (fast days, candle lighting, etc.)

### DSL (Domain-Specific Language)
Formula syntax for zmanim calculations:

```
sunrise                           # Primitive
@sunrise + 72min                  # Reference + duration
solar(-16.1)                      # Solar angle (alos hashachar)
sha'a_zmanis_gra * 3             # Proportional hours
if (latitude > 50) { ... }        # Conditional (for polar regions)
```

### Coverage
Geographic areas where a publisher provides zmanim:
- **Levels:** continent, country, region, locality
- **Priority-based:** Most specific match wins

---

## Recent Consolidation (2025-12)

The codebase was significantly consolidated in December 2025:

### Backend Services (Merged into `zmanim_service.go`)
- `zmanim_calculation.go` → DSL execution
- `zmanim_ordering.go` → Category-based sorting
- `zmanim_linking_service.go` → Copy/link operations
- `timezone_service.go` → Deleted (localities have timezone)

### Key Changes
- **UnifiedZmanimService** is now THE single source of truth
- Sorting uses 3-level priority: category → time → name
- Filter-aware caching (different tags = different cache entries)
- Audit trail for all zman changes via `actions.sql`

---

## Development Workflow

### Before Coding

1. Read `docs/coding-standards.md` (MANDATORY)
2. Check INDEX files for existing code:
   - `api/internal/handlers/INDEX.md`
   - `api/internal/services/INDEX.md`
   - `web/components/INDEX.md`

### During Development

```bash
# Backend changes
cd api && go build ./cmd/api
cd api && sqlc generate        # After SQL changes

# Frontend changes
cd web && npm run type-check

# Validate before commit
./scripts/validate-ci-checks.sh
```

### Testing

```bash
# Backend
cd api && go test ./...

# E2E
cd tests && npx playwright test
```

---

## Key Patterns

### Backend: 6-Step Handler

```go
func (h *Handlers) Handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // 1. Resolve publisher (SECURITY)
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil { return }

    // 2. URL params
    // 3. Parse body
    // 4. Validate
    // 5. SQLc query
    // 6. Respond
}
```

### Frontend: useApi Pattern

```tsx
const api = useApi();
await api.get('/publisher/profile');     // Auth + Publisher ID
await api.public.get('/localities');      // Public
await api.admin.get('/admin/stats');      // Admin only
```

---

## Critical Rules

### FORBIDDEN

- Raw SQL (use SQLc)
- Raw `fetch()` in components (use `useApi`)
- Hardcoded colors (use design tokens)
- `fmt.Printf` (use `slog`)
- Manual X-Publisher-Id extraction (use `PublisherResolver`)
- TODO/FIXME comments in committed code

### REQUIRED

- PublisherResolver for all publisher endpoints
- SQLc for all database queries
- Design tokens for all colors
- 12-hour time format (AM/PM)
- Soft delete with `deleted_at` timestamp
- Activity logging for state changes

---

## Production

**URL:** https://zmanim.shtetl.io

```
CloudFront → Next.js Lambda (/*) + API Gateway (/backend/*) → EC2 (Go + PostgreSQL + Redis)
```

### Deployment

```bash
# Infrastructure
cd infrastructure && npx cdk deploy --all

# Next.js (auto)
git push origin main

# New AMI
git tag v1.0.0-ami && git push origin v1.0.0-ami
```

---

## Getting Help

- **Swagger UI:** http://localhost:8080/swagger/index.html
- **Issues:** https://github.com/[org]/zmanim/issues
- **AI Quick Start:** `docs/AI_QUICK_START.md`
