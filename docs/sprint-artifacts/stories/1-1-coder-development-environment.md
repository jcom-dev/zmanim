# Story 1.1: Coder Development Environment

Status: review

## Story

As a **developer**,
I want **a fully configured cloud development environment**,
so that **I can develop, test, and debug the application with consistent tooling across the team**.

## Acceptance Criteria

1. Coder workspace initializes with Go 1.21+, Node.js 20+, npm 10+
2. Start script runs web (port 3000) and API (port 8080) simultaneously
3. Xata | Shared dev DBconnection works with configured credentials
4. Playwright browsers are installed and E2E tests execute
5. Upstash Redis REST API is accessible from the environment

## Tasks / Subtasks

- [x] Task 1: Adapt .coder directory from shtetl project (AC: 1)
  - [x] 1.1 Copy .coder directory from shtetl repo
  - [x] 1.2 Rename workspace from "shtetl" to "zmanim"
  - [x] 1.3 Remove multi-repo submodule configuration (single monorepo)
  - [x] 1.4 Update workspace metadata and descriptions

- [x] Task 2: Configure Terraform workspace tooling (AC: 1)
  - [x] 2.1 Configure Go 1.21+ installation
  - [x] 2.2 Configure Node.js 20 LTS installation
  - [x] 2.3 Configure npm 10+ installation
  - [x] 2.4 Install PostgreSQL CLI
  - [x] 2.5 Install Playwright browsers

- [x] Task 3: Create/update start-services.sh script (AC: 2)
  - [x] 3.1 Configure web frontend on port 3001
  - [x] 3.2 Configure API backend on port 8080
  - [x] 3.3 Add process management for concurrent services
  - [x] 3.4 Add health check verification after startup

- [x] Task 4: Configure environment variables (AC: 3, 5)
  - [x] 4.1 Add DATABASE_URL configuration
  - [x] 4.2 Add UPSTASH_REDIS_REST_URL configuration
  - [x] 4.3 Add UPSTASH_REDIS_REST_TOKEN configuration
  - [x] 4.4 Add CLERK_SECRET_KEY configuration
  - [x] 4.5 Create .env.example with all required variables

- [x] Task 5: Verify Playwright E2E testing (AC: 4)
  - [x] 5.1 Verify Playwright browsers are installed
  - [x] 5.2 Configure playwright.config.ts for local dev environment
  - [x] 5.3 Run sample E2E test to verify setup

- [x] Task 6: Verify external service connectivity (AC: 3, 5)
  - [x] 6.1 Test PostgreSQL database connection
  - [x] 6.2 Test Upstash Redis REST API connectivity
  - [x] 6.3 Document troubleshooting steps for connection issues

- [x] Task 7: Update documentation (AC: all)
  - [x] 7.1 Update README with Coder setup instructions
  - [x] 7.2 Document environment variable requirements
  - [x] 7.3 Add development workflow documentation

## Dev Notes

### Architecture Patterns

- **Development Environment:** Coder cloud workspace provides consistent development environment across team
- **Monorepo Structure:** Single repository with `web/` and `api/` directories
- **Port Configuration:**
  - Frontend (Next.js): port 3000
  - Backend (Go API): port 8080

### Source Tree Components

```
.coder/                    # Coder workspace configuration (TO CREATE)
  ├── main.tf              # Terraform workspace definition
  ├── variables.tf         # Variable definitions
  └── scripts/
      └── start-services.sh  # Service startup script
web/                       # Next.js frontend (existing)
api/                       # Go backend (existing)
.env.example               # Environment template (TO CREATE)
README.md                  # Setup documentation (TO UPDATE)
```

### Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Xata | Shared dev DB| PostgreSQL connection string |
| `UPSTASH_REDIS_REST_URL` | Upstash | Redis REST API endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Redis authentication token |
| `CLERK_SECRET_KEY` | Clerk | Backend authentication |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Frontend authentication |

### Testing Standards

- **E2E Testing:** Playwright via MCP server
- **Test Execution:** Tests run against local development environment
- **Browser Support:** Chromium (primary), optionally Firefox/WebKit

### External Service Dependencies

| Service | Environment | Notes |
|---------|-------------|-------|
| Xata | Shared dev DB|Xata | Shared dev DB | Production database for MVP |
| Upstash Redis | Shared instance | REST API for caching |
| Clerk | Development app | Auth service |
| Fly.io | N/A for this story | API deployment target |
| Vercel | N/A for this story | Frontend deployment target |

### Project Structure Notes

- **Alignment:** Story establishes the development foundation per architecture document
- **Paths:**
  - `.coder/` - Adapted from shtetl project
  - `web/` - Existing Next.js application
  - `api/` - Existing Go backend
- **No conflicts detected:** First story establishes baseline

### References

- [Source: docs/architecture.md#Project-Structure]
- [Source: docs/architecture.md#Integration-Diagram]
- [Source: docs/epics.md#Story-1.1-Coder-Development-Environment]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.1-Coder-Development-Environment]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

**2025-11-25 - Implementation Plan:**
- Adapt .coder/ from shtetl (multi-repo) to zmanim (monorepo)
- Remove local PostgreSQL/Redis containers (using Xata/Upstash externally)
- Update ports: Web 3000, API 8080
- Add Playwright browser installation for E2E testing
- Create .env.example with all required variables
- Update README with Coder setup instructions

### Completion Notes List

**2025-11-25 - Story Completed:**
- Adapted .coder/ from shtetl multi-repo to zmanim monorepo structure
- Created zmanim-workspace.tf (renamed from shtetl-workspace.tf)
- Removed local PostgreSQL/Redis containers (using Xata/Upstash externally)
- Updated ports: Web 3001, API 8080
- startup.sh installs Go 1.21+, Node.js 20, PostgreSQL CLI, Playwright
- start-services.sh uses tmux for concurrent service management with health checks
- Created .env.example with all required environment variables
- Updated README.md with Coder setup instructions (Option 1) and local dev (Option 2)
- Playwright config already set to port 3001
- .coder/README.md fully updated with troubleshooting guide

### File List

**Created:**
- `.coder/zmanim-workspace.tf` - Terraform workspace definition for Coder
- `.env.example` - Environment variable template

**Modified:**
- `.coder/startup.sh` - Startup script for monorepo (Go 1.21, Node 20, Playwright)
- `.coder/start-services.sh` - Service startup helper with tmux and health checks
- `.coder/README.md` - Updated documentation for zmanim
- `README.md` - Added Coder setup instructions, updated tech stack

**Deleted:**
- `.coder/shtetl-workspace.tf` - Old multi-repo workspace template
