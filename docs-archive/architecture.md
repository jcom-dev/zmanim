# Architecture

> **Last Updated:** 2025-12-21
> **Status:** Production MVP - All core features implemented

## Executive Summary

Shtetl Zmanim is a multi-publisher platform enabling halachic authorities to publish customized Jewish Zmanim with full algorithm control and transparency.

**Key Architectural Characteristics:**
- Multi-tenant SaaS with publisher isolation
- Custom DSL-based calculation engine (Go backend)
- Unified zmanim service (consolidated December 2025)
- Geographic coverage at multiple levels (continent → country → region → locality)
- Redis caching with filter-aware keys (24hr TTL)
- Audit trail for all state changes

## Current Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js (App Router) | 16.x |
| **Frontend Lang** | TypeScript | 5.4+ |
| **UI Components** | shadcn/ui + Radix | Latest |
| **Styling** | Tailwind CSS | 4.x |
| **State** | TanStack Query | 5.x |
| **Backend** | Go + Chi | 1.24+ / 5.x |
| **Database** | PostgreSQL + PostGIS | 15+ |
| **Auth** | Clerk | Latest |
| **Cache** | Redis | 7.x |
| **Hosting (API)** | AWS EC2 | - |
| **Hosting (Web)** | AWS Lambda + CloudFront | - |
| **Production URL** | https://zmanim.shtetl.io | - |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Next.js 16 (web/)                                              │
│  ├── app/                 # Pages (admin/, publisher/, zmanim/) │
│  ├── components/          # React components (~122)             │
│  │   └── INDEX.md         # Component registry                  │
│  ├── lib/api-client.ts    # Unified API client                  │
│  └── providers/           # React context (Publisher, Prefs)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API                                     │
│  Go 1.24+ (api/)                                                │
│  ├── handlers/            # HTTP handlers (44 files)            │
│  │   └── INDEX.md         # Handler registry                    │
│  ├── services/            # Business logic (13 files)           │
│  │   ├── INDEX.md         # Services registry                   │
│  │   └── zmanim_service.go  # UNIFIED source of truth          │
│  ├── dsl/                 # Formula DSL (lexer, parser, exec)   │
│  └── db/queries/          # SQLc queries (31 files)             │
│       └── INDEX.md        # Queries registry                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  PostgreSQL + PostGIS                                           │
│  ├── publishers           # Publisher accounts                  │
│  ├── master_zmanim_registry  # Canonical zmanim definitions    │
│  ├── publisher_zmanim     # Publisher-specific zmanim           │
│  ├── publisher_coverage   # Coverage areas by level             │
│  ├── geo_localities       # ~4M localities with coordinates     │
│  ├── actions              # Audit trail                         │
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

## Key Consolidation (December 2025)

The codebase was significantly consolidated to eliminate duplication:

### Backend Services (Merged into `zmanim_service.go`)

| Former File | Merged Into | Reason |
|-------------|-------------|--------|
| zmanim_calculation.go | zmanim_service.go | DSL execution consolidated |
| zmanim_ordering.go | zmanim_service.go | Sorting logic consolidated |
| zmanim_linking_service.go | zmanim_service.go | Copy/link operations consolidated |
| timezone_service.go | (deleted) | Localities store timezone in database |

### UnifiedZmanimService

**THE single source of truth for all zmanim operations:**

```go
type UnifiedZmanimService struct {
    db        *db.Database
    cache     *cache.Client
    dsl       *dsl.Executor
}

// Key Methods
CalculateZmanim(params)     // Main entry point
CalculateFormula(params)    // Single formula
CalculateRange(params)      // Date range batch
SortZmanim(zmanim)          // Category-based sorting
LinkOrCopyZman(params)      // Cross-publisher propagation
ApplyRounding(time, mode)   // floor/ceil/math
InvalidateCache(pub, loc)   // Cache management
```

### Sorting Algorithm (3-Level Priority)

```
1. Time Category (database sort_order from time_categories table)
   └── Categories: dawn, sunrise, morning, midday, afternoon, sunset, night
2. Calculated Time (chronological within category)
3. Hebrew Name (alphabetical tiebreaker)
```

---

## DSL (Domain-Specific Language)

The formula DSL allows publishers to define zmanim calculations:

```
sunrise                           # Primitive
@sunrise + 72min                  # Reference + duration
solar(-16.1)                      # Solar angle (alos hashachar)
sha'a_zmanis_gra * 3             # Proportional hours
sunset - 18min                    # Offset from sunset
if (latitude > 50) { ... }        # Conditional (polar regions)
```

### DSL Components

| File | Purpose |
|------|---------|
| lexer.go | Tokenization |
| parser.go | AST construction |
| ast.go | 15+ node types |
| executor.go | Formula execution |
| validator.go | Type checking |

### Supported Primitives

| Primitive | Description |
|-----------|-------------|
| `sunrise` | Sunrise time |
| `sunset` | Sunset time |
| `alos` | Dawn (configurable angle) |
| `tzeis` | Nightfall (configurable angle) |
| `chatzos` / `midday` | Solar noon |
| `solar(degrees)` | Custom solar angle |
| `sha'a_zmanis_gra` | GRA proportional hour |
| `sha'a_zmanis_mga` | MGA proportional hour |

---

## Project Structure

```
zmanim/
├── web/                          # Next.js Frontend
│   ├── app/                      # App Router pages
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Home/landing page
│   │   ├── (auth)/               # Auth routes (Clerk)
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   ├── zmanim/               # End user zmanim views
│   │   │   └── [city]/
│   │   │       └── [publisher]/
│   │   ├── publisher/            # Publisher dashboard (protected)
│   │   │   ├── dashboard/
│   │   │   ├── algorithm/
│   │   │   └── coverage/
│   │   └── admin/                # Admin portal (protected)
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── zmanim/               # Zmanim-specific components
│   │   │   ├── ZmanRow.tsx
│   │   │   ├── ZmanimList.tsx
│   │   │   └── FormulaPanel.tsx
│   │   ├── publisher/            # Publisher components
│   │   │   ├── AlgorithmEditor.tsx
│   │   │   └── CitySelector.tsx
│   │   └── shared/               # Shared components
│   │       ├── LocationPicker.tsx
│   │       └── PublisherCard.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── useZmanim.ts
│   │   ├── usePublishers.ts
│   │   └── useLocation.ts
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # API client
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── types/                    # TypeScript types
│   │   ├── api.ts                # API request/response types
│   │   ├── zmanim.ts             # Zmanim domain types
│   │   └── publisher.ts          # Publisher domain types
│   └── providers/                # React context providers
│       └── QueryProvider.tsx
├── api/                          # Go Backend
│   ├── cmd/
│   │   └── api/
│   │       └── main.go           # Entry point
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go         # Environment config
│   │   ├── db/
│   │   │   └── postgres.go       # Database connection
│   │   ├── handlers/
│   │   │   ├── health.go         # Health check
│   │   │   ├── publishers.go     # Publisher endpoints
│   │   │   ├── zmanim.go         # Zmanim calculation endpoints
│   │   │   ├── cities.go         # City/location endpoints
│   │   │   └── admin.go          # Admin endpoints
│   │   ├── middleware/
│   │   │   ├── auth.go           # Clerk JWT validation
│   │   │   ├── cors.go           # CORS handling
│   │   │   └── logging.go        # Request logging
│   │   ├── models/
│   │   │   ├── publisher.go
│   │   │   ├── algorithm.go
│   │   │   ├── zmanim.go
│   │   │   └── city.go
│   │   ├── services/
│   │   │   ├── publisher_service.go
│   │   │   ├── zmanim_service.go   # Calculation engine
│   │   │   ├── city_service.go
│   │   │   ├── cache_service.go    # Upstash Redis caching
│   │   │   └── algorithm/          # Algorithm DSL interpreter
│   │   │       ├── parser.go
│   │   │       ├── executor.go
│   │   │       └── methods.go      # Solar, fixed, proportional
│   │   └── astro/                  # Astronomical calculations
│   │       ├── sun.go              # Sunrise/sunset
│   │       ├── angles.go           # Solar depression angles
│   │       └── times.go            # Time calculations
│   └── Dockerfile
├── db/
│   └── migrations/               # SQL migrations
├── docs/                         # Documentation
│   ├── architecture.md           # This document
│   ├── prd.md
│   └── ux-design-specification.md
└── scripts/                      # Development scripts (to add)
    ├── setup.sh
    └── seed-cities.sql
```

## FR Category to Architecture Mapping

| FR Category | FRs | Architecture Component | Notes |
|-------------|-----|------------------------|-------|
| User Management | FR1-FR6 | Clerk + `api/handlers/admin.go` | Clerk handles auth, admin creates publishers |
| Algorithm Management | FR7-FR15 | `api/services/algorithm/` + `web/components/publisher/` | DSL parser in Go, editor UI in React |
| Coverage Area Management | FR16-FR20 | `api/handlers/cities.go` + `web/components/publisher/CitySelector` | City-based (simplified) |
| Location & Discovery | FR21-FR25 | `api/handlers/cities.go` + `web/components/shared/LocationPicker` | City search + publisher lookup |
| Zmanim Calculation | FR26-FR31 | `api/services/zmanim_service.go` + `api/internal/astro/` | Core calculation engine |
| Caching | FR32-FR33 | `api/services/cache_service.go` | Upstash Redis, 24hr TTL |
| Admin Portal | FR34-FR38 | `web/app/admin/` + `api/handlers/admin.go` | Publisher management |
| API | FR39-FR42 | All `api/handlers/` | REST endpoints with standard response format |

## Technology Stack Details

### Core Technologies

**Frontend Stack:**
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.4+ | Type safety |
| Tailwind CSS | 3.4+ | Utility-first styling |
| shadcn/ui | Latest | Accessible UI components |
| TanStack Query | 5.x | Server state management |
| Luxon | 3.4+ | Date/time handling |
| Clerk React | Latest | Auth UI components |

**Backend Stack:**
| Technology | Version | Purpose |
|------------|---------|---------|
| Go | 1.21+ | Backend language |
| Chi | 5.x | HTTP router |
| pgx | 5.x | PostgreSQL driver |
| slog | stdlib | Structured logging |
| Clerk Go SDK | Latest | JWT validation |

**Infrastructure:**
| Technology | Purpose |
|------------|---------|
| Xata PostgreSQL | Managed PostgreSQL + PostGIS |
| Fly.io | API hosting (Go backend) |
| Vercel | Frontend hosting (Next.js) |
| Upstash Redis | Serverless caching (REST API) |
| GitHub Actions | CI/CD (future) |

### Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                         End User Browser                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Next.js Frontend (Vercel)                   │    │
│  │  ┌───────────┐  ┌──────────────┐  ┌────────────────┐   │    │
│  │  │ Clerk UI  │  │ TanStack     │  │ shadcn/ui      │   │    │
│  │  │ Components│  │ Query Client │  │ Components     │   │    │
│  │  └─────┬─────┘  └──────┬───────┘  └────────────────┘   │    │
│  └────────│───────────────│────────────────────────────────┘    │
└───────────│───────────────│─────────────────────────────────────┘
            │               │
            ▼               ▼
┌───────────────────┐  ┌─────────────────────────────────────────┐
│   Clerk Service   │  │          Go API (Fly.io)                 │
│   (Auth/JWT)      │  │  ┌─────────────────────────────────┐    │
│                   │◀─│─▶│  Middleware (Auth, CORS, Log)   │    │
└───────────────────┘  │  └─────────────┬───────────────────┘    │
                       │                │                         │
                       │  ┌─────────────▼───────────────────┐    │
                       │  │           Handlers               │    │
                       │  │  /publishers, /zmanim, /cities   │    │
                       │  └─────────────┬───────────────────┘    │
                       │                │                         │
                       │  ┌─────────────▼───────────────────┐    │
                       │  │           Services               │    │
                       │  │  ZmanimService, AlgorithmParser  │    │
                       │  └─────────────┬───────────────────┘    │
                       │                │                         │
                       │  ┌─────────────▼───────────────────┐    │
                       │  │      Astro Calculations          │    │
                       │  │  Sun position, angles, times     │    │
                       │  └─────────────────────────────────┘    │
                       └────────────────┬────────────────────────┘
                                        │
                       ┌────────────────┼────────────────────────┐
                       │                │                        │
                       ▼                ▼                        │
┌─────────────────────────────┐  ┌─────────────────────────────┐ │
│      Upstash Redis          │  │     Xata (PostgreSQL)        │ │
│  (Serverless Cache)         │  │  publishers, algorithms,    │ │
│  - Zmanim calculations      │  │  cities, users              │ │
│  - 24hr TTL                 │  └─────────────────────────────┘ │
│  - REST API                 │                                  │
└─────────────────────────────┘                                  │
```

## Novel Pattern: Formula Reveal

**Purpose:** Enable users to understand the halachic basis for each zmanim time - the platform's key differentiator.

**Pattern Definition:**

| Aspect | Specification |
|--------|---------------|
| Trigger | Info icon (ⓘ) next to each zman time |
| Desktop | Side panel slides in from right |
| Mobile | Bottom sheet slides up |
| Content | Method name, parameters, optional halachic context |
| Dismissal | Click outside, X button, swipe down (mobile) |

**Data Flow:**
```
User taps ⓘ → Frontend requests formula details → API returns:
{
  "zman_name": "Alos HaShachar",
  "method": {
    "type": "solar_angle",
    "display_name": "Solar Depression Angle",
    "parameters": {
      "degrees": 16.1,
      "direction": "below_horizon"
    }
  },
  "explanation": "Dawn begins when the sun is 16.1° below the horizon",
  "halachic_context": "Based on the opinion that..." // Optional
}
```

**Component Architecture:**
```
ZmanRow (displays time + ⓘ icon)
    │
    └──▶ onClick → setSelectedZman(zmanId)
                        │
FormulaPanel (side panel / bottom sheet)
    │
    └──▶ useZmanimFormula(zmanId) → GET /api/zmanim/{id}/formula
                        │
                        └──▶ Displays method, params, context
```

**Implementation Notes:**
- Formula data is returned with initial zmanim calculation (no extra API call)
- Panel uses Radix Dialog for accessibility
- Animation via Tailwind + CSS transitions
- Mobile detection via media query or `useMediaQuery` hook

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### API Response Format

All API responses MUST use this wrapper structure:

```go
// Success response
{
  "data": { ... },      // The actual response payload
  "meta": {             // Optional metadata
    "timestamp": "2025-11-25T10:30:00Z",
    "request_id": "uuid"
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",     // Machine-readable code
    "message": "Invalid date format", // Human-readable message
    "details": { ... }               // Optional additional info
  }
}
```

### Algorithm DSL Format

Publishers configure algorithms using this JSON structure:

```json
{
  "name": "My Custom Algorithm",
  "version": 1,
  "zmanim": {
    "alos": {
      "method": "solar_angle",
      "params": { "degrees": 16.1 }
    },
    "misheyakir": {
      "method": "solar_angle",
      "params": { "degrees": 11.5 }
    },
    "sof_zman_shma": {
      "method": "proportional",
      "params": {
        "hours": 3,
        "base": "gra"  // or "mga"
      }
    },
    "tzeis": {
      "method": "fixed_minutes",
      "params": {
        "minutes": 72,
        "from": "sunset"
      }
    }
  }
}
```

**Supported Methods:**
| Method | Parameters | Description |
|--------|------------|-------------|
| `solar_angle` | `degrees` | Sun depression angle below horizon |
| `fixed_minutes` | `minutes`, `from` | Fixed offset from sunrise/sunset |
| `proportional` | `hours`, `base` | Proportional hours (shaos zmaniyos) |
| `midpoint` | `start`, `end` | Midpoint between two times |

### React Component Patterns

```typescript
// Component file naming: PascalCase.tsx
// Hook file naming: useCamelCase.ts
// Type file naming: lowercase.ts

// Component structure
export function ZmanRow({ zman, onInfoClick }: ZmanRowProps) {
  // 1. Hooks first
  const { formatTime } = useTimeFormat();

  // 2. Derived state
  const formattedTime = formatTime(zman.time);

  // 3. Handlers
  const handleInfoClick = () => onInfoClick(zman.id);

  // 4. Render
  return ( ... );
}
```

### Go Handler Patterns

```go
// Handler file naming: lowercase.go (publishers.go, zmanim.go)
// One domain per file

func (h *Handler) GetZmanim(w http.ResponseWriter, r *http.Request) {
    // 1. Parse request
    cityID := chi.URLParam(r, "cityId")
    publisherID := chi.URLParam(r, "publisherId")
    dateStr := r.URL.Query().Get("date")

    // 2. Validate
    if cityID == "" {
        h.respondError(w, http.StatusBadRequest, "MISSING_CITY", "City ID required")
        return
    }

    // 3. Call service
    result, err := h.zmanimService.Calculate(r.Context(), cityID, publisherID, date)
    if err != nil {
        h.handleServiceError(w, err)
        return
    }

    // 4. Respond
    h.respondJSON(w, http.StatusOK, result)
}
```

## Consistency Rules

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| **Go files** | lowercase | `publishers.go`, `zmanim_service.go` |
| **Go packages** | lowercase, no underscores | `handlers`, `services` |
| **Go types** | PascalCase | `Publisher`, `ZmanimResult` |
| **Go functions** | PascalCase (exported), camelCase (private) | `Calculate()`, `parseDate()` |
| **TS/React files** | PascalCase for components, camelCase for utils | `ZmanRow.tsx`, `api.ts` |
| **TS types** | PascalCase | `Publisher`, `ZmanimResponse` |
| **TS hooks** | camelCase with `use` prefix | `useZmanim`, `usePublishers` |
| **Database tables** | snake_case, plural | `publishers`, `algorithm_configs` |
| **Database columns** | snake_case | `created_at`, `publisher_id` |
| **API endpoints** | kebab-case, plural nouns | `/api/publishers`, `/api/zmanim` |
| **URL params** | camelCase | `/api/cities/:cityId` |
| **Query params** | camelCase | `?publisherId=123&date=2025-01-01` |
| **JSON keys** | snake_case | `publisher_id`, `created_at` |
| **Environment vars** | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `CLERK_SECRET_KEY` |

### Code Organization

**Frontend (`web/`):**
- Pages in `app/` follow Next.js App Router conventions
- Shared components in `components/shared/`
- Domain components in `components/{domain}/`
- All types in `types/` (not inline)
- Custom hooks in `hooks/`
- API client and utilities in `lib/`

**Backend (`api/`):**
- Entry point in `cmd/api/main.go`
- All application code in `internal/`
- Split handlers by domain (one file per resource)
- Services contain business logic
- Models are simple data structures (no methods)
- Keep `astro/` package pure (no DB dependencies)

### Error Handling

**Frontend:**
```typescript
// Use TanStack Query error handling
const { data, error, isLoading } = useZmanim(cityId, publisherId);

// Display errors via toast or inline
if (error) {
  toast.error(error.message);
}

// Error boundary for unexpected errors
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

**Backend:**
```go
// Define domain errors
var (
    ErrPublisherNotFound = errors.New("publisher not found")
    ErrInvalidAlgorithm  = errors.New("invalid algorithm configuration")
    ErrCityNotFound      = errors.New("city not found")
)

// Map to HTTP status in handlers
func (h *Handler) handleServiceError(w http.ResponseWriter, err error) {
    switch {
    case errors.Is(err, ErrPublisherNotFound):
        h.respondError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
    case errors.Is(err, ErrInvalidAlgorithm):
        h.respondError(w, http.StatusBadRequest, "INVALID_CONFIG", err.Error())
    default:
        h.respondError(w, http.StatusInternalServerError, "INTERNAL", "Internal server error")
        slog.Error("unhandled error", "error", err)
    }
}
```

### Logging Strategy

**Backend (Go):**
```go
// Use slog (stdlib) with structured logging
import "log/slog"

// At startup
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

// In code
slog.Info("calculating zmanim",
    "city_id", cityID,
    "publisher_id", publisherID,
    "date", date,
)

slog.Error("calculation failed",
    "error", err,
    "city_id", cityID,
)
```

**Levels:**
- `Debug`: Detailed debugging (disabled in production)
- `Info`: Normal operations (requests, calculations)
- `Warn`: Recoverable issues
- `Error`: Failures requiring attention

**Frontend:**
- Development: `console.log/warn/error`
- Production: Silent (errors tracked via error boundary)

## Data Architecture

### Core Entities

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    publishers   │      │   algorithms    │      │     cities      │
├─────────────────┤      ├─────────────────┤      ├─────────────────┤
│ id (uuid)       │──┐   │ id (uuid)       │      │ id (uuid)       │
│ clerk_user_id   │  │   │ publisher_id    │◀─────│ name            │
│ name            │  └──▶│ name            │      │ country         │
│ organization    │      │ config (jsonb)  │      │ state           │
│ email           │      │ is_active       │      │ latitude        │
│ website         │      │ created_at      │      │ longitude       │
│ logo_url        │      │ updated_at      │      │ timezone        │
│ is_verified     │      └─────────────────┘      └─────────────────┘
│ created_at      │                                       │
└─────────────────┘                                       │
        │                                                 │
        │              ┌─────────────────┐               │
        └─────────────▶│ publisher_cities │◀──────────────┘
                       ├─────────────────┤
                       │ publisher_id    │
                       │ city_id         │
                       │ priority        │
                       │ created_at      │
                       └─────────────────┘
```

### Database Tables

```sql
-- Publishers (halachic authorities)
CREATE TABLE publishers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    organization TEXT,
    email TEXT NOT NULL,
    website TEXT,
    logo_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Algorithm configurations (JSON DSL)
CREATE TABLE algorithms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,  -- Algorithm DSL JSON
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cities (pre-seeded reference data)
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    state TEXT,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    timezone TEXT NOT NULL,
    population INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Publisher coverage (many-to-many)
CREATE TABLE publisher_cities (
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,  -- Higher = preferred
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (publisher_id, city_id)
);

-- Indexes
CREATE INDEX idx_algorithms_publisher ON algorithms(publisher_id);
CREATE INDEX idx_publisher_cities_city ON publisher_cities(city_id);
CREATE INDEX idx_cities_country ON cities(country);
```

## API Contracts

### Base URL
- **Production API:** `https://api.zmanim.com` (Fly.io)
- **Development:** `http://localhost:8080`

### Endpoints

#### Cities & Discovery
```
GET /api/cities?search={query}
  → { data: [{ id, name, country, state }] }

GET /api/cities/{cityId}/publishers
  → { data: [{ id, name, organization, logo_url, priority }] }
```

#### Zmanim Calculation
```
GET /api/zmanim?cityId={id}&publisherId={id}&date={YYYY-MM-DD}
  → {
      data: {
        date: "2025-11-25",
        city: { name, timezone },
        publisher: { name, organization },
        zmanim: [
          {
            name: "Alos HaShachar",
            time: "05:23:00",
            formula: {
              method: "solar_angle",
              display_name: "Solar Depression Angle",
              parameters: { degrees: 16.1 }
            }
          },
          ...
        ]
      }
    }
```

#### Publisher Management (Authenticated)
```
GET /api/publisher/profile
PUT /api/publisher/profile

GET /api/publisher/algorithm
PUT /api/publisher/algorithm
  Body: { name, config: { zmanim: {...} } }

GET /api/publisher/cities
POST /api/publisher/cities
  Body: { city_ids: ["uuid1", "uuid2"] }
DELETE /api/publisher/cities/{cityId}
```

#### Admin (Admin Role Required)
```
GET /api/admin/publishers
POST /api/admin/publishers
  Body: { email, name, organization }
PUT /api/admin/publishers/{id}/verify
PUT /api/admin/publishers/{id}/suspend
```

### Authentication
- All `/api/publisher/*` and `/api/admin/*` endpoints require Clerk JWT
- JWT passed via `Authorization: Bearer {token}` header
- Go middleware validates JWT with Clerk public key

## Security Architecture

### Authentication Flow
```
User → Clerk UI → Clerk Service → JWT issued
                                      │
Frontend stores JWT ◀─────────────────┘
                                      │
API Request + JWT ────────────────────▼
                              Go Middleware
                              (Clerk validation)
                                      │
                              Extract user_id
                              Check role (admin/publisher/user)
                                      │
                              Authorize request
```

### Authorization Model
| Role | Capabilities |
|------|-------------|
| **anonymous** | Read cities, calculate zmanim (rate limited) |
| **user** | All anonymous + higher rate limits |
| **publisher** | All user + manage own profile, algorithm, coverage |
| **admin** | All publisher + manage all publishers |

### Security Controls
- **TLS:** All traffic HTTPS (enforced by Fly.io/Vercel)
- **CORS:** Restrict to frontend domain
- **Input Validation:** Go handlers validate all inputs
- **SQL Injection:** pgx uses parameterized queries
- **XSS:** React escapes by default, no dangerouslySetInnerHTML
- **Tenant Isolation:** All publisher queries filtered by publisher_id

## Performance Considerations

### Caching Architecture

Zmanim calculations are cached using Upstash Redis with 24-hour TTL:

```
Request → Go API → Check Upstash → [Hit] → Return cached
                                 → [Miss] → Calculate → Cache → Return
```

**Cache Key Format:**
```
zmanim:{publisher_id}:{city_id}:{date}
```

**Cache Strategy:**
- TTL: 24 hours (zmanim don't change within a day for same location)
- Invalidation: On algorithm publish (bust all publisher keys)
- Storage: JSON serialized ZmanimResponse

**Upstash Integration (Go):**
```go
// Using Upstash REST API (no TCP connection needed)
import "github.com/upstash/go-upstash-redis"

func (s *CacheService) GetZmanim(ctx context.Context, key string) (*ZmanimResult, error) {
    data, err := s.redis.Get(ctx, key).Result()
    if err == redis.Nil {
        return nil, nil // Cache miss
    }
    // Deserialize and return
}

func (s *CacheService) SetZmanim(ctx context.Context, key string, result *ZmanimResult) error {
    data, _ := json.Marshal(result)
    return s.redis.Set(ctx, key, data, 24*time.Hour).Err()
}
```

### Performance Targets
| Metric | Target | Notes |
|--------|--------|-------|
| API response (calculation) | <500ms | Single date, single publisher |
| City search | <300ms | Database query with index |
| Frontend load | <3s (3G) | Next.js SSR + code splitting |
| Cache hit ratio | >80% | Most requests for same day/location |
| API response (cached) | <100ms | Direct Upstash REST response |

### Future Optimization Strategies
- Database query optimization
- CDN for static assets
- API response compression
- City data caching (lower TTL)

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Production                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐         ┌─────────────────┐          │
│   │     Vercel      │         │     Fly.io      │          │
│   │  (Next.js Web)  │────────▶│   (Go API)      │          │
│   │                 │         │                 │          │
│   │  - SSR/SSG      │         │  - REST API     │          │
│   │  - Edge CDN     │         │  - Auto-scale   │          │
│   │  - Auto HTTPS   │         │  - Health check │          │
│   └─────────────────┘         └────────┬────────┘          │
│                                        │                    │
│                                        ▼                    │
│                            ┌─────────────────┐              │
│                            │       Xata      │              │
│                            │  (PostgreSQL)   │              │
│                            │                 │              │
│                            │  - Managed DB   │              │
│                            │  - Auto backup  │              │
│                            │  - Connection   │              │
│                            │    pooling      │              │
│                            └─────────────────┘              │
│                                                              │
│   ┌─────────────────┐                                       │
│   │      Clerk      │                                       │
│   │  (Auth Service) │                                       │
│   └─────────────────┘                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Commands
```bash
# API (Fly.io) - from api/ directory
fly deploy

# Web (Vercel) - automatic on push to main
# Or manual: vercel --prod
```

### Environment Variables

**API (Fly.io secrets):**
```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_live_...
ALLOWED_ORIGINS=https://zmanim.vercel.app
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AW-xxx...
```

**Web (Vercel env vars):**
```
NEXT_PUBLIC_API_URL=https://api.zmanim.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

## Development Environment

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Go | 1.21+ | Backend development |
| Node.js | 20+ LTS | Frontend development |
| npm | 10+ | Package management |
| Docker | Latest | Local services (optional) |
| psql | Latest | Database migrations |

### Local Setup

```bash
# Clone repository
git clone https://github.com/jcom-dev/zmanim.git
cd zmanim

# Frontend setup
cd web
npm install
cp .env.example .env.local
# Edit .env.local with Clerk keys and API URL
npm run dev

# Backend setup (separate terminal)
cd api
cp .env.example .env
# Edit .env with database connection and Clerk secret
go run cmd/api/main.go

# Run database migrations
./scripts/migrate.sh
```

### Testing Strategy

| Type | Tool | Location | Run Command |
|------|------|----------|-------------|
| Go Unit | Go testing + testify | `api/**/*_test.go` | `go test ./...` |
| Go Integration | Go testing | `api/internal/handlers/*_test.go` | `go test -tags=integration` |
| TS Unit | Vitest | `web/**/*.test.ts` | `npm run test` |
| E2E | Playwright (via MCP) | `web/tests/*.spec.ts` | `npm run test:e2e` |

**Playwright via MCP:**
- Use Playwright MCP server for browser automation
- Tests run against local or staging environment
- Critical flows: location search, publisher selection, zmanim display, formula reveal

### Coder Development Environment

**Status:** `.coder/` directory needs adaptation from "shtetl" project

**Required Changes:**
1. Rename workspace from "shtetl" to "zmanim"
2. Remove Redis (not needed for POC)
3. Update to single repo (not multi-repo submodules)
4. Configure database connection
5. Update ports: Web (3000), API (8080)
6. Add Playwright for E2E testing

## Architecture Decision Records (ADRs)

### ADR-001: Custom Calculation Engine
**Decision:** Build zmanim calculations from scratch in Go backend
**Context:** Existing kosher-zmanim library is TypeScript; need centralized, cacheable calculations
**Consequences:** More initial development, but full control over algorithm and consistency

### ADR-002: City-Based Coverage Model
**Decision:** Use city selection instead of polygon boundaries for geographic coverage
**Context:** Polygon drawing adds significant UX and PostGIS complexity
**Consequences:** Simpler MVP, may need polygon support for precise boundaries later

### ADR-003: Upstash Redis for Caching
**Decision:** Use Upstash Redis (REST API) for caching zmanim calculations with 24hr TTL
**Context:** Zmanim calculations are deterministic for same date/location/algorithm; caching reduces latency and compute cost
**Consequences:** Sub-100ms responses for cached requests; cache invalidation on algorithm publish; Upstash REST API works in serverless (Fly.io) without TCP connection pooling

### ADR-004: REST API (not GraphQL/tRPC)
**Decision:** Use REST for Go backend API
**Context:** Go ecosystem is REST-native; simple CRUD operations don't need GraphQL flexibility
**Consequences:** Straightforward implementation, familiar patterns

### ADR-005: TanStack Query for State Management
**Decision:** Use TanStack Query for server state in frontend
**Context:** Need efficient data fetching, caching, and SSR support with Next.js
**Consequences:** Clean separation of server/client state, automatic refetching

### ADR-006: Clerk for Authentication
**Decision:** Use Clerk managed auth service
**Context:** PRD specifies Clerk; provides ready-made UI components and JWT infrastructure
**Consequences:** Faster implementation, external dependency for auth

---

## Testing Infrastructure (Story 3.0 & 3.1)

### Overview

Shtetl Zmanim uses Playwright for comprehensive E2E testing with Clerk authentication injection. The testing infrastructure was built in Stories 3.0 and 3.1, providing 130+ test scenarios covering admin, publisher, and user flows.

**Test Stack:**
| Technology | Purpose |
|------------|---------|
| Playwright | E2E browser automation |
| @clerk/testing | Clerk auth injection |
| MailSlurp | Email testing |
| pg client | Test fixture creation |

### Test Organization

```
tests/
├── e2e/
│   ├── admin/                  # Admin flow tests (15+ scenarios)
│   │   ├── dashboard.spec.ts
│   │   ├── publishers.spec.ts
│   │   └── impersonation.spec.ts
│   ├── publisher/              # Publisher flow tests (20+ scenarios)
│   │   ├── dashboard.spec.ts
│   │   ├── algorithm.spec.ts
│   │   ├── coverage.spec.ts
│   │   └── profile.spec.ts
│   ├── user/                   # End user tests (10+ scenarios)
│   │   ├── location.spec.ts
│   │   └── zmanim.spec.ts
│   ├── registration/           # Registration flows
│   ├── email/                  # Email flow tests (MailSlurp)
│   ├── errors/                 # Error handling tests
│   ├── setup/                  # Global setup/teardown
│   │   ├── global-setup.ts
│   │   └── global-teardown.ts
│   └── utils/                  # Shared utilities
│       ├── clerk-auth.ts       # Auth injection helpers
│       ├── test-fixtures.ts    # Database fixtures
│       ├── email-testing.ts    # MailSlurp helpers
│       ├── cleanup.ts          # Cleanup utilities
│       └── index.ts            # Re-exports
```

### Authentication Pattern

The testing infrastructure uses `@clerk/testing/playwright` for programmatic authentication:

```typescript
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright';

// Setup testing token (bypasses bot detection)
await setupClerkTestingToken({ page });

// Sign in with credentials
await clerk.signIn({
  page,
  signInParams: {
    strategy: 'password',
    identifier: email,
    password: 'TestPassword123!',
  },
});
```

**Auth Helper Functions:**
| Function | Purpose |
|----------|---------|
| `loginAsAdmin(page)` | Inject admin auth |
| `loginAsPublisher(page, publisherId)` | Inject publisher auth linked to publisher |
| `loginAsUser(page)` | Inject regular user auth |
| `createTestAdmin()` | Create admin user in Clerk |
| `createTestPublisher(publisherId)` | Create publisher user in Clerk |
| `createTestUser()` | Create regular user in Clerk |

**Reference:** `tests/e2e/utils/clerk-auth.ts`

### Test Data Patterns

**Naming Convention:**
- Entity prefix: `TEST_` (e.g., `TEST_E2E_Publisher_Name`)
- Email domain: `test-zmanim.example.com` (Clerk-compatible)

**Fixture Functions:**
```typescript
// Create test publisher in database
const publisher = await createTestPublisherEntity({
  name: 'TEST_E2E_Publisher',
  organization: 'TEST_E2E_Org',
  status: 'verified',
});

// Create test algorithm
const algorithm = await createTestAlgorithm(publisher.id);

// Create test coverage
const coverage = await createTestCoverage(publisher.id, cityId);
```

**Caching:** Fixtures use a Map-based cache to avoid recreation:
```typescript
const testEntityCache = new Map<string, any>();
```

**Reference:** `tests/e2e/utils/test-fixtures.ts`

### Cleanup Pattern

Cleanup is idempotent and runs in `globalTeardown`:

```typescript
// Clean test users from Clerk
await cleanupTestUsers();

// Clean test data from database (TEST_ prefix)
await cleanupTestData();

// Clean MailSlurp inboxes
await cleanupAllInboxes();
```

**Characteristics:**
- Safe to run multiple times
- Uses `TEST_` prefix to identify test data
- Uses `test-zmanim.example.com` domain filter

**Reference:** `tests/e2e/utils/cleanup.ts`

### Email Testing (MailSlurp)

For flows requiring email verification (invitations, password reset):

```typescript
// Create test inbox
const inbox = await createTestInbox('test-user');

// Wait for email
const email = await waitForEmail(inbox.id, { timeout: 30000 });

// Extract links
const links = extractLinksFromEmail(email.body);
```

**Email Helpers:**
| Function | Purpose |
|----------|---------|
| `createTestInbox(name)` | Create MailSlurp inbox |
| `waitForEmail(inboxId)` | Wait for email arrival |
| `waitForInvitationEmail(inboxId)` | Wait for invitation email |
| `waitForPasswordResetEmail(inboxId)` | Wait for reset email |
| `extractLinksFromEmail(body)` | Extract URLs from email body |

**Reference:** `tests/e2e/utils/email-testing.ts`

### Running Tests

```bash
# Run all E2E tests
npm test

# Run specific test file
npx playwright test tests/e2e/admin/publishers.spec.ts

# Run with UI mode
npx playwright test --ui

# Run headed (visible browser)
npx playwright test --headed

# Cleanup test data manually
npx tsx tests/cleanup-clerk-users.ts
```

### Coverage Summary (Story 3.1)

| Category | Scenarios | Status |
|----------|-----------|--------|
| Admin flows | 15+ | ✅ |
| Publisher flows | 20+ | ✅ |
| User flows | 10+ | ✅ |
| Registration | 5+ | ✅ |
| Email flows | 5+ | ✅ |
| Error handling | 10+ | ✅ |
| **Total** | **130+** | ✅ |

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-11-25_
_Updated: 2025-11-27 (Testing Infrastructure section added)_
_For: BMad_
