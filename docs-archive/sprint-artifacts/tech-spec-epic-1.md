# Epic Technical Specification: Shtetl Zmanim MVP

Date: 2025-11-25
Author: BMad
Epic ID: 1
Status: Draft

---

## Overview

Epic 1 delivers the complete Shtetl Zmanim MVP - a multi-publisher platform enabling halachic authorities to publish customized Jewish prayer times with full algorithm control and transparency. This epic transforms the existing brownfield POC into a production-ready application covering all 42 functional requirements across 11 stories.

The platform serves two primary user types:
- **Publishers (Halachic Authorities):** Configure calculation algorithms, define geographic coverage, and publish zmanim
- **End Users (Community Members):** Find local publishers, view accurate prayer times, and understand the halachic basis for each calculation through the Formula Reveal feature

---

## Objectives and Scope

### In Scope

- Coder cloud development environment setup
- Clerk authentication integration (admin, publisher, user roles)
- Admin portal for publisher management with usage statistics
- Publisher profile, algorithm configuration, and coverage management
- Global city-based location system with country/region/city hierarchy
- Custom Go calculation engine with solar angle, fixed minutes, and proportional methods
- Upstash Redis caching with 24-hour TTL and invalidation on algorithm publish
- End user zmanim display with date navigation
- Formula Reveal pattern (side panel on desktop, bottom sheet on mobile)
- REST API with standard response format and rate limiting
- Responsive web application (Next.js + shadcn/ui)

### Out of Scope

- Mobile native apps (iOS/Android)
- Push notifications
- Publisher self-registration (admin-only creation for MVP)
- User accounts with saved preferences
- Polygon-based geographic coverage (using city-based model)
- Multi-language support
- Offline/PWA capabilities

---

## System Architecture Alignment

This epic aligns with the documented architecture decisions:

| Decision | Implementation |
|----------|----------------|
| ADR-001: Custom Calculation Engine | Go backend in `api/internal/astro/` and `api/services/algorithm/` |
| ADR-002: City-Based Coverage | `cities` table with country/region/city hierarchy, `publisher_cities` join table |
| ADR-003: Upstash Redis Caching | `cache_service.go` with REST API, 24hr TTL, key format `zmanim:{publisher}:{city}:{date}` |
| ADR-004: REST API | Chi router with handlers in `api/internal/handlers/` |
| ADR-005: TanStack Query | Frontend state management in `web/providers/QueryProvider.tsx` |
| ADR-006: Clerk Authentication | Middleware in `api/internal/middleware/auth.go`, React components from `@clerk/nextjs` |

**Component Mapping:**

```
Frontend (Vercel)              Backend (Fly.io)              Data Layer
─────────────────              ────────────────              ──────────
web/app/                       api/handlers/                 PostgreSQL (Xata)
  ├── (auth)/                    ├── health.go               Upstash Redis
  ├── admin/                     ├── admin.go                Clerk (Auth)
  ├── publisher/                 ├── publishers.go
  └── zmanim/                    ├── cities.go
                                 └── zmanim.go
web/components/                api/services/
  ├── ui/ (shadcn)               ├── publisher_service.go
  ├── zmanim/                    ├── zmanim_service.go
  ├── publisher/                 ├── city_service.go
  └── shared/                    ├── cache_service.go
                                 └── algorithm/
                                     ├── parser.go
                                     ├── executor.go
                                     └── methods.go
```

---

## Detailed Design

### Services and Modules

| Service | Responsibility | Key Methods |
|---------|---------------|-------------|
| **ZmanimService** | Core calculation orchestration | `Calculate(ctx, cityID, publisherID, date)` |
| **AlgorithmParser** | Parse JSON DSL to executable config | `Parse(config []byte) (*Algorithm, error)` |
| **AlgorithmExecutor** | Execute parsed algorithm | `Execute(algo *Algorithm, location, date) []Zman` |
| **CacheService** | Redis caching via Upstash | `Get(key)`, `Set(key, value, ttl)`, `InvalidatePublisher(id)` |
| **CityService** | Location search and lookup | `Search(query)`, `GetByID(id)`, `GetNearby(lat, lng)` |
| **PublisherService** | Publisher CRUD operations | `Create()`, `Update()`, `GetByCity(cityID)` |

### Data Models and Contracts

**Database Schema (PostgreSQL):**

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
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending', -- pending, verified, suspended
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Algorithm configurations (JSON DSL)
CREATE TABLE algorithms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft', -- draft, published, deprecated
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cities (pre-seeded reference data)
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    region TEXT,
    region_type TEXT, -- state, county, province, district
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
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (publisher_id, city_id)
);

-- Publisher coverage at region/country level
CREATE TABLE publisher_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
    level TEXT NOT NULL, -- country, region, city
    geo_value TEXT NOT NULL, -- country code, region name, or city_id
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- System configuration
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_algorithms_publisher ON algorithms(publisher_id);
CREATE INDEX idx_algorithms_active ON algorithms(publisher_id, is_active) WHERE is_active = true;
CREATE INDEX idx_publisher_cities_city ON publisher_cities(city_id);
CREATE INDEX idx_cities_country ON cities(country);
CREATE INDEX idx_cities_search ON cities(name, country, region);
```

**Algorithm DSL Format:**

```json
{
  "name": "My Custom Algorithm",
  "version": 1,
  "zmanim": {
    "alos": { "method": "solar_angle", "params": { "degrees": 16.1 } },
    "misheyakir": { "method": "solar_angle", "params": { "degrees": 11.5 } },
    "sunrise": { "method": "sunrise", "params": {} },
    "sof_zman_shma": { "method": "proportional", "params": { "hours": 3, "base": "gra" } },
    "sof_zman_tefillah": { "method": "proportional", "params": { "hours": 4, "base": "gra" } },
    "chatzos": { "method": "midpoint", "params": { "start": "sunrise", "end": "sunset" } },
    "mincha_gedola": { "method": "proportional", "params": { "hours": 6.5, "base": "gra" } },
    "mincha_ketana": { "method": "proportional", "params": { "hours": 9.5, "base": "gra" } },
    "plag_hamincha": { "method": "proportional", "params": { "hours": 10.75, "base": "gra" } },
    "sunset": { "method": "sunset", "params": {} },
    "tzeis": { "method": "solar_angle", "params": { "degrees": 8.5 } },
    "tzeis_rt": { "method": "fixed_minutes", "params": { "minutes": 72, "from": "sunset" } }
  }
}
```

### APIs and Interfaces

**Base URL:** `https://api.zmanim.com` (production) / `http://localhost:8080` (development)

**Response Format:**
```json
// Success
{ "data": {...}, "meta": { "timestamp": "...", "request_id": "..." } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human message", "details": {...} } }
```

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | None | Health check |
| `/api/cities` | GET | None | Search cities `?search={query}` |
| `/api/cities/nearby` | GET | None | Reverse geocode `?lat={}&lng={}` |
| `/api/cities/{id}/publishers` | GET | None | Publishers covering city |
| `/api/zmanim` | GET | None | Calculate zmanim `?cityId={}&publisherId={}&date={}` |
| `/api/publisher/profile` | GET/PUT | Publisher | Own profile |
| `/api/publisher/algorithm` | GET/PUT | Publisher | Current algorithm |
| `/api/publisher/algorithm/preview` | POST | Publisher | Preview calculation |
| `/api/publisher/algorithm/publish` | POST | Publisher | Publish draft |
| `/api/publisher/algorithm/versions` | GET | Publisher | Version history |
| `/api/publisher/coverage` | GET/POST/DELETE | Publisher | Coverage areas |
| `/api/admin/publishers` | GET/POST | Admin | List/create publishers |
| `/api/admin/publishers/{id}/verify` | PUT | Admin | Verify publisher |
| `/api/admin/publishers/{id}/suspend` | PUT | Admin | Suspend publisher |
| `/api/admin/stats` | GET | Admin | Usage statistics |
| `/api/admin/config` | GET/PUT | Admin | System configuration |

### Workflows and Sequencing

**End User Flow:**
```
1. User enters location (search or geolocation)
2. System searches cities table, returns matches
3. User selects city
4. System queries publisher_cities + publisher_coverage for covering publishers
5. User selects publisher
6. System checks cache for zmanim:{publisher}:{city}:{date}
   - Cache hit: Return cached result
   - Cache miss: Load algorithm, calculate, cache result
7. Display zmanim list with Formula Reveal icons
8. User taps info icon → Show formula panel
```

**Publisher Algorithm Configuration Flow:**
```
1. Publisher logs in via Clerk
2. Navigate to /publisher/algorithm
3. Load current algorithm (draft or published)
4. Select zman to configure
5. Modal opens with intellisense editor
6. Type method name → Autocomplete suggestions
7. Configure parameters
8. Live preview shows calculated time
9. Save (creates/updates draft)
10. Publish → Creates new version, invalidates cache
```

**Cache Invalidation Flow:**
```
1. Publisher publishes new algorithm version
2. API calls CacheService.InvalidatePublisher(publisherID)
3. CacheService uses SCAN to find all keys matching zmanim:{publisherID}:*
4. Delete all matching keys
5. Next zmanim request for this publisher triggers fresh calculation
```

---

## Non-Functional Requirements

### Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| NFR1: Zmanim calculation | < 500ms (p95) | New calculation without cache |
| NFR2: Cached response | < 100ms (p95) | Upstash Redis REST latency |
| NFR3: Frontend load | < 3s (3G) | Lighthouse performance score |
| NFR4: City search | < 300ms | PostgreSQL query with index |
| NFR5: Publisher list | < 500ms | Join query on publisher_cities |
| Cache hit ratio | > 80% | Most requests same day/location |

### Security

| Requirement | Implementation |
|-------------|----------------|
| NFR6: Authentication | Clerk JWT validation in Go middleware |
| NFR7: Authorization | Role-based access (admin, publisher, user, anonymous) |
| NFR8: Tenant isolation | All queries filtered by publisher_id |
| NFR9: TLS | Enforced by Fly.io and Vercel |
| NFR10: No sensitive data exposure | Structured error responses, no stack traces |
| NFR11: SQL injection prevention | pgx parameterized queries |
| NFR12: XSS prevention | React escaping, no dangerouslySetInnerHTML |

### Reliability/Availability

| Requirement | Target |
|-------------|--------|
| NFR13: Uptime | 99.5% |
| NFR14: Database backups | Daily (managed by hosting provider) |
| NFR15: Cache unavailable | Graceful degradation to direct calculation |
| NFR16: Error handling | Clear error messages, no silent failures |

### Observability

| Signal | Implementation |
|--------|----------------|
| Logging | Go slog (structured JSON), levels: Debug/Info/Warn/Error |
| Request logging | Middleware logs method, path, duration, status |
| Error tracking | Log error with context (city_id, publisher_id, request_id) |
| Health check | `/api/health` endpoint for Fly.io monitoring |

---

## Dependencies and Integrations

### Frontend Dependencies (web/package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^16.0.3 | React framework |
| react | ^19.2.0 | UI library |
| @clerk/nextjs | Latest (to add) | Authentication |
| @tanstack/react-query | 5.x (to add) | Server state |
| shadcn/ui | Latest (to add) | UI components |
| luxon | ^3.4.4 | Date/time handling |
| tailwindcss | ^3.4.0 | Styling |
| @playwright/test | ^1.56.1 | E2E testing |

**To Remove:** `kosher-zmanim` (calculations moving to Go backend)

### Backend Dependencies (api/go.mod)

| Package | Version | Purpose |
|---------|---------|---------|
| github.com/go-chi/chi/v5 | v5.0.11 | HTTP router |
| github.com/jackc/pgx/v5 | v5.5.1 | PostgreSQL driver |
| github.com/go-chi/cors | v1.2.1 | CORS middleware |
| github.com/joho/godotenv | v1.5.1 | Environment config |
| github.com/clerk/clerk-sdk-go | Latest (to add) | JWT validation |
| github.com/upstash/go-redis | Latest (to add) | Redis caching |
| github.com/stretchr/testify | Latest (to add) | Testing |

### External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| Clerk | Authentication | JWT validation, React components |
| Xata | Database | PostgreSQL via pgx |
| Upstash | Caching | Redis REST API |
| Fly.io | API hosting | Docker deployment |
| Vercel | Frontend hosting | Next.js deployment |

---

## Acceptance Criteria (Authoritative)

### Story 1.1: Coder Development Environment
1. Coder workspace initializes with Go 1.21+, Node.js 20+, npm 10+
2. Start script runs web (port 3000) and API (port 8080) simultaneously
3. PostgreSQL connection works with configured credentials
4. Playwright browsers are installed and E2E tests execute
5. Upstash Redis REST API is accessible from the environment

### Story 1.2: Foundation & Authentication
1. Unauthenticated users can view public pages and access anonymous endpoints
2. Clerk sign-in modal appears and supports email/password and social providers
3. Authenticated publishers can access /publisher/* routes
4. Authenticated admins can access /admin/* routes
5. API returns structured error responses: `{error: {code, message, details}}`
6. Anonymous users receive 429 after 100 requests/hour

### Story 1.3: Admin Publisher Management
1. Admin sees list of all publishers with status (pending/verified/suspended)
2. Admin can create new publisher with email, name, organization
3. New publisher receives Clerk invitation email
4. Admin can verify pending publishers (status → verified)
5. Admin can suspend verified publishers (status → suspended)
6. Admin can reactivate suspended publishers
7. Admin dashboard shows usage statistics (publishers, calculations, cache ratio)
8. Admin can configure system settings (rate limits, cache TTL, feature flags)

### Story 1.4: Publisher Profile
1. Publisher can view their current profile information
2. Publisher can update name, organization, website, contact email, bio
3. Publisher can upload logo image
4. Logo appears on publisher cards when users view zmanim
5. Required fields show inline validation errors

### Story 1.5: Global Location System
1. Location search returns autocomplete suggestions for cities
2. Search for "Brooklyn" shows "Brooklyn, New York, USA"
3. Search for "London" shows "London, Greater London, United Kingdom"
4. "Use My Location" resolves coordinates to nearest city
5. Global cities work with locale-appropriate region types

### Story 1.6: Publisher Coverage
1. Publisher sees current coverage areas on map
2. Publisher can add coverage at country, region, or city level
3. Selecting country includes all cities in that country
4. Selecting region includes all cities in that region
5. Publisher can set priority (1-10) per coverage area
6. Publisher can toggle coverage areas active/inactive

### Story 1.7: Calculation Engine & Caching
1. System calculates all standard zmanim for given location/date
2. Solar angle method calculates time when sun is N degrees below horizon
3. Fixed minutes method calculates time N minutes from sunrise/sunset
4. Proportional method calculates shaos zmaniyos (GRA or MGA base)
5. Formula details are included in response for each zman
6. Same calculation within 24hrs returns cached result (<100ms)
7. Algorithm publish invalidates publisher's cached calculations
8. Cache miss triggers calculation, caches result with 24hr TTL

### Story 1.8: Algorithm Editor
1. Publisher sees current algorithm configuration
2. Publisher can choose from templates (GRA, MGA, Rabbeinu Tam, Custom)
3. Clicking zman opens configuration modal
4. Modal shows method options with intellisense autocomplete
5. Live preview shows calculated time for today at sample location
6. "View Month" shows calendar with all zmanim for each day
7. Invalid configuration shows validation error
8. Unsaved changes trigger navigation warning

### Story 1.9: Algorithm Publishing
1. Draft algorithm can be published (becomes active)
2. Changes to published algorithm save as new draft
3. "Publish Changes" creates new version, archives old
4. Version history shows all versions with dates
5. Deprecated versions show notice to users

### Story 1.10: Zmanim User Experience
1. Home page shows location selection
2. Selecting city shows list of covering publishers
3. Publishers sorted by priority (higher first), then alphabetically
4. Publisher cards show name, organization, logo
5. Clicking publisher shows their profile before selection
6. Selecting publisher shows zmanim list for today
7. Date navigation arrows (← →) navigate days
8. Clicking date opens date picker
9. No covering publisher shows warning + default zmanim

### Story 1.11: Formula Reveal
1. Info icon (ⓘ) appears next to each zmanim time
2. Desktop: Clicking icon opens right side panel
3. Mobile: Clicking icon opens bottom sheet
4. Panel shows zman name, method name, parameters, explanation
5. Optional halachic context displays if publisher provided
6. Panel dismisses on click outside, X button, or swipe down (mobile)

---

## Traceability Mapping

| AC | Spec Section | Component | Test Approach |
|----|--------------|-----------|---------------|
| 1.1.1-5 | Dev Environment | .coder/ | Manual setup verification |
| 1.2.1-6 | Security, APIs | middleware/auth.go, Clerk | Integration test auth flows |
| 1.3.1-8 | APIs, Admin | handlers/admin.go | API integration tests |
| 1.4.1-5 | APIs, Data | handlers/publishers.go | Unit + integration tests |
| 1.5.1-5 | APIs, Data | handlers/cities.go | Query tests with seed data |
| 1.6.1-6 | APIs, Data | handlers/coverage.go | Integration tests |
| 1.7.1-8 | Services, Cache | zmanim_service.go, cache_service.go | Unit tests, cache tests |
| 1.8.1-8 | APIs, Frontend | AlgorithmEditor.tsx | E2E tests with Playwright |
| 1.9.1-5 | APIs, Data | handlers/algorithms.go | Integration tests |
| 1.10.1-9 | Frontend, APIs | web/app/zmanim/ | E2E tests |
| 1.11.1-6 | Frontend, UX | FormulaPanel.tsx | E2E + accessibility tests |

---

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Calculation accuracy | High | Test against known references (MyZmanim, Chabad.org), table-driven tests |
| Clerk integration complexity | Medium | Start with basic auth, add roles incrementally |
| City data quality | Medium | Use reputable source (GeoNames), validate sample cities |
| Upstash latency | Low | REST API is fast; fallback to calculation if slow |

### Assumptions

| Assumption | Impact if Wrong |
|------------|-----------------|
| City-based coverage sufficient for MVP | May need polygon support later |
| 24hr cache TTL is appropriate | May need shorter TTL for edge cases |
| Single algorithm per publisher | May need multiple algorithms later |
| Admin-only publisher creation | May need self-registration |

### Open Questions

| Question | Decision Needed By |
|----------|-------------------|
| Seed city data source - GeoNames vs SimpleMaps? | Story 1.5 |
| Algorithm templates - which defaults to include? | Story 1.8 |
| Rate limits - 100/hr anonymous, unlimited authenticated? | Story 1.2 |

---

## Test Strategy Summary

### Test Levels

| Level | Tool | Coverage Target | Focus Areas |
|-------|------|-----------------|-------------|
| Go Unit | go test + testify | 80%+ | Calculation engine, algorithm parser, cache service |
| Go Integration | go test | All endpoints | API handlers with test database |
| TS Unit | Vitest | Components | AlgorithmEditor, FormulaPanel, LocationPicker |
| E2E | Playwright | Critical flows | User journey, publisher config, formula reveal |

### Critical Test Scenarios

1. **Calculation Accuracy:** Table-driven tests comparing output against known values
2. **Auth Flows:** Login, logout, role-based access
3. **Cache Behavior:** Hit, miss, invalidation
4. **User Journey:** Location → Publisher → Zmanim → Formula
5. **Publisher Journey:** Login → Configure → Preview → Publish

### Test Data

- Seed database with 100+ cities across US, Israel, UK, Canada
- Create 3 test publishers with different algorithms
- Include edge cases: Arctic locations, daylight saving transitions

---

_Generated by BMAD Epic Tech Context Workflow v1.0_
_Date: 2025-11-25_
