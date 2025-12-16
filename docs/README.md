# Shtetl Zmanim

**Platform for Halachic Authorities to publish zmanim with complete autonomy over calculations and full transparency.**

Halachic Authorities define custom calculation formulas using a domain-specific language with complete control and transparency; users access zmanim specific to their chosen halachic tradition.

---

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 20+
- PostgreSQL 17 with PostGIS
- Redis 7+

### Start Development Services

```bash
./restart.sh                      # Start API + Web in tmux
tmux attach -t zmanim             # View logs (Ctrl+B, 0=API, 1=Web, D=detach)
```

### URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:3001 |
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger/index.html |
| OpenAPI JSON | http://localhost:8080/swagger/doc.json |

### Production

- **URL:** https://zmanim.shtetl.io
- **Architecture:** CloudFront -> Next.js Lambda + API Gateway -> EC2 (Go API + PostgreSQL + Redis)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Coding Standards](coding-standards.md) | **MANDATORY** - Development rules and patterns |
| [Developer Guide](DEVELOPER_GUIDE.md) | Complete onboarding for new developers |
| [Architecture](ARCHITECTURE.md) | System design, data flow, and technical decisions |
| [API Reference](API_REFERENCE.md) | REST endpoints, authentication, and patterns |
| [Database](DATABASE.md) | Schema, queries, and SQLc patterns |
| [Frontend](FRONTEND.md) | Next.js app structure, components, and hooks |
| [Infrastructure](INFRASTRUCTURE.md) | AWS deployment, CI/CD, and operations |
| [DSL Complete Guide](dsl-complete-guide.md) | Formula language for zmanim calculations |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Go 1.24+, Chi router, pgx |
| Database | PostgreSQL 17 + PostGIS |
| Cache | Redis 7 (Upstash in production) |
| Auth | Clerk (JWT) |
| Infrastructure | AWS CDK (CloudFront, Lambda, API Gateway, EC2) |
| Testing | Playwright (E2E), Go testing, Vitest |

---

## Project Structure

```
zmanim/
├── api/                          # Go backend
│   ├── cmd/api/                  # Entry point
│   ├── internal/
│   │   ├── handlers/             # HTTP handlers (INDEX.md)
│   │   ├── services/             # Business logic (INDEX.md)
│   │   ├── db/queries/           # SQLc SQL files (INDEX.md)
│   │   ├── dsl/                  # Formula parser/executor
│   │   ├── astro/                # Astronomical calculations
│   │   └── middleware/           # Auth, CORS, rate limiting
│   └── sqlc.yaml                 # SQLc configuration
├── web/                          # Next.js frontend
│   ├── app/                      # Pages (admin/, publisher/, zmanim/)
│   ├── components/               # React components (INDEX.md)
│   ├── lib/                      # Utilities, API client, hooks
│   └── providers/                # React contexts
├── db/migrations/                # SQL migrations
├── infrastructure/               # AWS CDK stacks
├── tests/                        # Playwright E2E tests
└── docs/                         # Documentation (you are here)
```

---

## Key Concepts

### Halachic Authorities

Rabbinical authorities and halachic institutions that define their own zmanim calculation formulas with complete autonomy and transparency.

### Master Registry

Immutable reference catalog of all possible zmanim types. Halachic Authorities select from this registry and customize formulas according to their tradition.

### DSL (Domain-Specific Language)

Formula language for defining zmanim calculations with complete transparency:

```
visible_sunset - 18min              # Candle lighting
solar(16.1, before_sunrise)         # Alos 16.1 degrees
proportional_hours(3, gra)          # Sof Zman Shema (GRA)
@alos_hashachar + 30min             # Reference another zman
```

### Coverage

Geographic areas a Halachic Authority serves. Uses PostGIS for boundary calculations.

---

## Development Commands

```bash
# Services
./restart.sh                        # Start/restart all services

# Backend
cd api && go build ./cmd/api        # Build API
cd api && sqlc generate             # Regenerate SQLc after SQL changes
cd api && go test ./...             # Run Go tests

# Frontend
cd web && npm run type-check        # TypeScript check
cd web && npm run build             # Production build

# Database
source api/.env && psql "$DATABASE_URL"

# Testing
cd tests && npx playwright test     # Run E2E tests
./scripts/validate-ci-checks.sh     # Run CI checks locally
```

---

## Contributing

1. Read [Coding Standards](coding-standards.md) before ANY changes
2. Check INDEX files before creating new code:
   - `api/internal/handlers/INDEX.md`
   - `api/internal/db/queries/INDEX.md`
   - `web/components/INDEX.md`
3. Run `./scripts/validate-ci-checks.sh` before pushing
4. Follow commit format: `<type>(<scope>): <description>`

---

## License

Proprietary - Shtetl Labs
