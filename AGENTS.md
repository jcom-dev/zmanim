# Repository Guidelines

## Project Structure & Module Organization
- `web/` – Next.js 16 frontend (app router). Key folders: `app/` (routes), `components/`, `lib/` (API client + hooks), `types/`.
- `api/` – Go 1.25 backend (Chi). Entry in `cmd/api/`, logic in `internal/`, generated SQLc code in `internal/db/sqlcgen/`.
- `tests/` – Playwright E2E specs and config; outputs land in `test-results/`.
- `db/` – SQL migrations; run via scripts, not manually.
- `docs/` – Architecture, developer guide, coding standards; use for deeper context.

## Build, Test, and Development Commands
- Start or restart everything: `./restart.sh` (required; replaces manual `go run` / `npm run dev`).
- Backend: `cd api && go build ./... && go test ./...` (regen SQLC after migrations with `sqlc generate`).
- Frontend: `cd web && npm install && npm run type-check && npm run lint && npm run test`.
- E2E: `cd tests && npm install && npx playwright install chromium && npx playwright test` (set `INCLUDE_MOBILE=true` for mobile suites).
- Migrations: `./scripts/migrate.sh` (auto-detects env, records in `schema_migrations`).

## Coding Style & Naming Conventions
- Follow `docs/coding-standards.md` (PR blockers). Use design tokens (`text-primary`, `bg-card`)—no hardcoded colors. All API calls in React go through `useApi()`/React Query helpers; never raw `fetch`.
- Components: `'use client'` only when needed; loading → error → content order; 12-hour time formatting helpers (`formatTime*`).
- Go: slog for logging; SQL via SQLc only; wrap errors with context; handler pattern with `publisherResolver`.
- Naming: Go files snake_case; React components PascalCase; hooks camelCase prefixed with `use`; utilities kebab-case. Import order: stdlib → third-party → internal.
- Formatting: `gofmt` for Go; ESLint/TypeScript configs in `web` (2-space TS/JS indent); keep ASCII unless existing file uses otherwise.

## Testing Guidelines
- Frontend unit: Vitest (`npm run test`, `npm run test:coverage`). Keep assertions stable; prefer role/text selectors.
- E2E: Each spec must set `test.describe.configure({ mode: 'parallel' });` and use shared fixtures (`tests/utils`). Avoid `waitForTimeout`; use `waitForLoadState('networkidle')`.
- Naming: Playwright files in `tests/e2e/*.spec.ts`; new fixture-generated data should be prefixed `TEST_E2E_${Date.now()}`.

## Commit & Pull Request Guidelines
- Commits: `<type>(<scope>): <description>` using types feat/fix/refactor/docs/test/chore/style/perf. Include generated footers when applicable (e.g., `🤖 Generated with Claude Code`).
- Branches: `feature/epic-{n}-{desc}`, `fix/{desc}`, or `refactor/{scope}-{desc}`.
- PRs: Link issues, describe scope and risk, add screenshots for UI, list test commands run. Verify blockers: no hardcoded colors, no raw fetch, publisher resolver in Go, SQLc only, 12-hour times, services restarted via `./restart.sh`, E2E specs parallelized.
