# Story 1.2: Foundation & Authentication

Status: review

## Story

As an **application user**,
I want **secure authentication and a reliable API**,
so that **I can safely access the platform with appropriate permissions**.

## Acceptance Criteria

1. Unauthenticated users can view public pages and access anonymous endpoints
2. Clerk sign-in modal appears and supports email/password and social providers
3. Authenticated publishers can access /publisher/* routes
4. Authenticated admins can access /admin/* routes
5. API returns structured error responses: `{error: {code, message, details}}`
6. Anonymous users receive 429 after 100 requests/hour

## Tasks / Subtasks

- [x] Task 1: Install and configure Clerk frontend (AC: 2, 3, 4)
  - [x] 1.1 Install @clerk/nextjs package
  - [x] 1.2 Configure ClerkProvider in app layout
  - [x] 1.3 Add Clerk middleware for route protection
  - [x] 1.4 Create sign-in/sign-up pages with Clerk components
  - [x] 1.5 Protect /publisher/* routes (require publisher role)
  - [x] 1.6 Protect /admin/* routes (require admin role)

- [x] Task 2: Implement Go JWT middleware (AC: 3, 4)
  - [x] 2.1 Add Clerk SDK or manual JWKS verification
  - [x] 2.2 Create api/internal/middleware/auth.go
  - [x] 2.3 Extract user ID and roles from JWT claims
  - [x] 2.4 Create role-checking middleware (admin, publisher)

- [x] Task 3: Implement API response helpers (AC: 5)
  - [x] 3.1 Create respondJSON() helper function
  - [x] 3.2 Create respondError() helper with error codes
  - [x] 3.3 Define standard error code constants
  - [x] 3.4 Apply consistent response format across handlers

- [x] Task 4: Implement rate limiting (AC: 6)
  - [x] 4.1 Create api/internal/middleware/ratelimit.go
  - [x] 4.2 Implement 100 req/hour limit for anonymous users
  - [x] 4.3 Higher limits for authenticated users
  - [x] 4.4 Return 429 with Retry-After header

- [x] Task 5: Configure CORS (AC: 1)
  - [x] 5.1 Create api/internal/middleware/cors.go
  - [x] 5.2 Allow frontend domain in CORS headers
  - [x] 5.3 Configure allowed methods and headers

- [x] Task 6: Set up TanStack Query (AC: 1)
  - [x] 6.1 Install @tanstack/react-query
  - [x] 6.2 Create web/providers/QueryProvider.tsx
  - [x] 6.3 Configure query client defaults
  - [x] 6.4 Wrap app in QueryProvider

- [x] Task 7: Install shadcn/ui components (AC: 1)
  - [x] 7.1 Run npx shadcn-ui@latest init
  - [x] 7.2 Configure Midnight Trust color system in CSS variables
  - [x] 7.3 Install initial component set (Button, Card, Dialog, Input)

## Dev Notes

### Architecture Patterns

- **Response Format:** `{data, error, meta}` per architecture doc
- **JWT Validation:** Clerk JWKS endpoint for key verification
- **Rate Limiting:** In-memory or Redis-backed counter
- **Role Claims:** Custom claims in Clerk JWT for admin/publisher roles

### Source Tree Components

```
web/
  ├── app/
  │   ├── layout.tsx           # Add ClerkProvider
  │   ├── sign-in/[[...sign-in]]/page.tsx
  │   └── sign-up/[[...sign-up]]/page.tsx
  ├── middleware.ts            # Clerk route protection
  └── providers/
      └── QueryProvider.tsx    # TanStack Query setup
api/internal/
  ├── middleware/
  │   ├── auth.go              # JWT validation
  │   ├── cors.go              # CORS configuration
  │   └── ratelimit.go         # Rate limiting
  └── handlers/
      └── response.go          # Response helpers
```

### References

- [Source: docs/architecture.md#Authentication-Flow]
- [Source: docs/architecture.md#API-Response-Format]
- [Source: docs/epics.md#Story-1.2-Foundation-Authentication]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.2]

## Dev Agent Record

### Context Reference
No context file was used for this story.

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- Implemented Clerk frontend authentication with ClerkProvider in layout
- Created middleware.ts for route protection based on user roles
- Built comprehensive JWKS-based JWT validation in Go middleware
- Implemented rate limiter with 100 req/hour for anonymous, 1000 req/hour for authenticated users
- Created structured API response helpers with standard error codes
- Set up TanStack Query with optimized defaults
- Initialized shadcn/ui with Midnight Trust color scheme

### Completion Notes List
- All 7 tasks completed with all subtasks checked
- Frontend builds successfully with TypeScript type checking passing
- Backend compiles without errors
- Web app configured to run on port 3001
- CORS configured for both localhost:3000 and localhost:3001
- Rate limiting includes X-RateLimit-* headers and Retry-After on 429
- Auth middleware supports RequireAuth, RequireRole, and OptionalAuth patterns
- Response helpers provide consistent {data, error, meta} format

### File List
**New Files:**
- web/middleware.ts
- web/app/sign-in/[[...sign-in]]/page.tsx
- web/app/sign-up/[[...sign-up]]/page.tsx
- web/app/publisher/dashboard/page.tsx
- web/app/admin/page.tsx
- web/providers/QueryProvider.tsx
- web/components/ui/button.tsx
- web/components/ui/card.tsx
- web/components/ui/dialog.tsx
- web/components/ui/input.tsx
- web/lib/utils.ts
- api/internal/middleware/auth.go
- api/internal/middleware/ratelimit.go
- api/internal/middleware/cors.go
- api/internal/handlers/response.go

**Modified Files:**
- web/package.json (added @clerk/nextjs, @tanstack/react-query, shadcn deps, port 3001)
- web/app/layout.tsx (added ClerkProvider, QueryProvider)
- web/app/globals.css (added Midnight Trust theme colors)
- web/tailwind.config.ts (updated by shadcn init)
- api/cmd/api/main.go (integrated auth, rate limiting middleware, added protected routes)
- api/internal/config/config.go (added JWKS config, updated CORS origins)
- api/internal/middleware/middleware.go (removed placeholder RateLimiter)
- api/internal/handlers/handlers.go (updated to use new response helpers, added placeholder handlers)

## Change Log
- 2025-11-25: Story implementation completed - all tasks done, ready for review
