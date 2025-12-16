# Shtetl Zmanim Documentation

Welcome to the Shtetl Zmanim documentation. This is your guide to developing, deploying, and operating the platform for Halachic Authorities to publish zmanim with complete autonomy and transparency.

---

## Quick Start

1. Read [Coding Standards](coding-standards.md) **(MANDATORY before any work)**
2. Follow [Developer Guide](DEVELOPER_GUIDE.md) for environment setup
3. Run `./restart.sh` to start services

---

## Documentation Index

### Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [README](README.md) | Project overview and quick reference | Everyone |
| [Coding Standards](coding-standards.md) | **MANDATORY** - Development rules and patterns | Developers |
| [Developer Guide](DEVELOPER_GUIDE.md) | Complete onboarding and development workflow | New developers |

### Technical Reference

| Document | Description | Audience |
|----------|-------------|----------|
| [Architecture](ARCHITECTURE.md) | System design, data flow, security patterns | Architects, senior devs |
| [API Reference](API_REFERENCE.md) | REST endpoints, authentication, examples | Backend devs, integrators |
| [Database](DATABASE.md) | Schema, SQLc patterns, queries | Backend devs |
| [Frontend](FRONTEND.md) | Next.js structure, components, hooks | Frontend devs |
| [Infrastructure](INFRASTRUCTURE.md) | AWS deployment, CI/CD, operations | DevOps, SREs |

### Domain Knowledge

| Document | Description | Audience |
|----------|-------------|----------|
| [DSL Complete Guide](dsl-complete-guide.md) | Formula language for zmanim calculations | Everyone |

---

## Quick Links

### Development

- Start services: `./restart.sh`
- View logs: `tmux attach -t zmanim`
- Run CI checks: `./scripts/validate-ci-checks.sh`

### URLs

| Resource | URL |
|----------|-----|
| Web App (dev) | http://localhost:3001 |
| API (dev) | http://localhost:8080 |
| Swagger UI (dev) | http://localhost:8080/swagger/index.html |
| Production | https://zmanim.shtetl.io |

### INDEX Files

Check before creating new code:

- [api/internal/handlers/INDEX.md](../api/internal/handlers/INDEX.md) - Backend handlers
- [api/internal/db/queries/INDEX.md](../api/internal/db/queries/INDEX.md) - SQL queries
- [api/internal/services/INDEX.md](../api/internal/services/INDEX.md) - Business logic
- [web/components/INDEX.md](../web/components/INDEX.md) - React components

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
| Testing | Playwright (E2E), Go testing |

---

## Key Patterns

### Backend (6-Step Handler)

```go
pc := h.publisherResolver.MustResolve(w, r)  // 1. Resolve publisher
id := chi.URLParam(r, "id")                   // 2. URL params
json.NewDecoder(r.Body).Decode(&req)          // 3. Parse body
// validate                                    // 4. Validate
result, err := h.db.Queries.X(ctx, params)    // 5. SQLc query
RespondJSON(w, r, http.StatusOK, result)      // 6. Respond
```

### Frontend (API Client)

```tsx
const api = useApi();
await api.get('/publisher/profile');      // Auth + X-Publisher-Id
await api.public.get('/countries');       // No auth
await api.admin.get('/admin/stats');      // Auth only
```

### DSL Formulas

```
visible_sunset - 18min              # Fixed offset
solar(16.1, before_sunrise)         # Solar angle
proportional_hours(3, gra)          # Shaos zmaniyos
@alos_hashachar + 30min             # Reference
```

---

## Archive

Historical documentation has been moved to `docs-archive/`. This includes:
- Previous architecture documents
- Completed epic and story files
- Old planning documents
- Superseded specifications

The archive is preserved for reference but should not be used for current development.

---

## Contributing to Documentation

1. Keep documentation current with code changes
2. Follow CommonMark specification
3. No time estimates in documentation
4. Use task-oriented writing (focus on "how to" accomplish goals)
5. Include code examples where helpful

---

*Last updated: December 2025*
