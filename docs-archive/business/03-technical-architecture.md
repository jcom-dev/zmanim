# Shtetl Zmanim: Technical Architecture Overview

This document provides a high-level technical overview of Shtetl Zmanim's architecture, technology stack, key systems, and data models – written for business stakeholders who want to understand how it works under the hood.

---

## System Architecture

### High-Level Overview

Shtetl Zmanim is built as a **modern, cloud-native web application** with three main layers:

```
┌─────────────────────────────────────────────────────────┐
│                     Web Frontend                         │
│  (Next.js 16, React 19, TypeScript, Tailwind CSS)       │
│          Hosted on: Vercel                               │
└─────────────────────────────────────────────────────────┘
                           ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│                     REST API Backend                     │
│  (Go 1.25, Chi Router, Custom Calculation Engine)       │
│          Hosted on: Fly.io                               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│         Database           Cache          Auth           │
│  PostgreSQL + PostGIS   Upstash Redis   Clerk           │
│  (Xata)                 (24hr TTL)      (JWT)           │
└─────────────────────────────────────────────────────────┘
```

**Key Architectural Principles:**
- **Separation of concerns** - Frontend handles UI, backend handles business logic/calculations
- **API-first design** - All features accessible via REST API
- **Stateless backend** - Scales horizontally
- **Geographic intelligence** - PostGIS for precise location matching
- **Caching for performance** - Redis reduces calculation load

---

## Technology Stack

### Frontend

**Core Framework:**
- **Next.js 16** - React framework with App Router for modern routing
- **React 19** - UI component library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library

**Key Libraries:**
- **@clerk/nextjs** - Authentication
- **TanStack Query** - Server state management, caching
- **hebcal** - Hebrew calendar calculations
- **kosher-zmanim** - Client-side zmanim fallback
- **Luxon** - Date/time handling with timezone support
- **CodeMirror 6** - Advanced code editor for DSL
- **Leaflet/Mapbox** - Maps for coverage visualization
- **react-easy-crop** - Image cropping for logos

**Why These Choices:**
- **Next.js App Router** - SEO-friendly, server-side rendering, edge-ready
- **TypeScript** - Catches errors at compile-time, better IDE support
- **Tailwind** - Rapid UI development, consistent design system
- **Clerk** - Enterprise-grade auth, eliminates security burden

### Backend

**Core Language & Framework:**
- **Go 1.25** - High-performance, statically typed language
- **Chi v5** - Lightweight HTTP router
- **pgx** - PostgreSQL driver

**Custom Systems:**
- **Zmanim Calculation Engine** - Custom Go implementation (inspired by KosherJava)
- **DSL (Domain Specific Language)** - Custom lexer, parser, executor for formula definitions
- **Algorithm Executor** - Interprets DSL formulas, calculates times

**Key Services:**
- **Publisher Service** - Publisher CRUD, profile management
- **Zmanim Service** - Calculation orchestration
- **Clerk Service** - User authentication, metadata sync
- **Email Service** - Resend API integration for transactional emails
- **AI Services** (optional):
  - **Claude Service** - Anthropic API for formula generation
  - **Embedding Service** - OpenAI embeddings for RAG
  - **Context Service** - RAG (Retrieval Augmented Generation) for AI prompts
  - **Search Service** - pgvector semantic search

**Why Go:**
- **Performance** - Fast execution, low memory footprint
- **Concurrency** - Built-in goroutines for parallel calculations
- **Static typing** - Catches errors early, reliable deployments
- **Simplicity** - Easy to maintain, strong standard library

### Data Layer

**Primary Database:**
- **PostgreSQL** via Xata
- **PostGIS extension** - Geographic queries (point-in-polygon, distance calculations)
- **pgvector extension** - Vector embeddings for AI/RAG

**Caching:**
- **Upstash Redis** - Managed Redis with REST API
- **24-hour TTL** - Automatic expiration
- **Publisher-scoped** - Each publisher's calculations cached separately

**Authentication:**
- **Clerk** - User management, JWT generation
- **Role-based roles** - Anonymous, User, Publisher, Admin stored in JWT claims

**AI Infrastructure (Optional):**
- **Anthropic Claude** - Formula generation from natural language
- **OpenAI Embeddings (text-embedding-ada-002)** - Vector embeddings for semantic search
- **pgvector** - Stores embeddings for DSL documentation, halachic sources

---

## Core Systems & How They Work

### 1. Zmanim Calculation Engine

**Flow:**
```
1. User requests zmanim for (city, date, publisher)
   ↓
2. Check Redis cache → if hit, return immediately (<100ms)
   ↓
3. If cache miss:
   a. Fetch city (lat/lng/timezone) from PostgreSQL
   b. Fetch publisher's algorithm from PostgreSQL
   c. Parse algorithm (if not cached)
   d. Execute algorithm:
      - Calculate sunrise/sunset (astronomical formulas)
      - Apply solar angles (e.g., 16.1° below horizon)
      - Apply fixed minute offsets (e.g., +72 minutes)
      - Apply proportional hours (GRA/MGA methods)
      - Calculate midpoints, solar midnight
   e. Format times in local timezone
   f. Store in Redis cache
   g. Return result
```

**Calculation Methods Supported:**
- **Solar Angle** - Sun at specific degrees below horizon (e.g., alos at 16.1°)
- **Fixed Minutes** - Offset from sunrise/sunset (e.g., tzeis 72 minutes after sunset)
- **Proportional Hours (Shaos Zmaniyos)**:
  - **GRA method** - (sunset - sunrise) / 12
  - **MGA method** - (tzeis - alos) / 12
- **Midpoint** - Halfway between two other zmanim (e.g., chatzos)
- **Solar Midnight** - Exact halfway between sunset and sunrise

**Accuracy:**
- Sunrise/sunset accurate to ±1 minute
- Accounts for elevation, refraction
- Timezone-aware (handles DST automatically)

**Performance:**
- Cached: <100ms response time
- Uncached: 200-500ms (includes DB queries + calculation)
- Target: 85%+ cache hit ratio

### 2. Geographic Matching System

**Hierarchy:**
```
Continent (AF, EU, NA, SA, OC, AS, AN)
  ↓
Country (US, IL, CA, GB, AU, etc.)
  ↓
Region (California, Ontario, Île-de-France, etc.)
  ↓
City (Los Angeles, Jerusalem, Toronto, etc.)
```

**Data Source:**
- **GeoNames** dataset - 100,000+ cities worldwide
- **PostGIS** for spatial queries

**Matching Algorithm:**
```sql
-- Example: Find publishers covering Brooklyn, NY
1. Try exact city match: city_id = 'brooklyn-id'
2. If none, try region match: region = 'New York' AND country = 'US'
3. If none, try country match: country = 'US'
4. If none, try continent match: continent = 'NA'
5. Return all matches, sorted by priority (publisher-defined), then alphabetically
```

**Coverage Levels:**
- **City** - Specific city only (e.g., Jerusalem)
- **Region** - All cities in state/province (e.g., California = 1,000+ cities)
- **Country** - All cities in country (e.g., Israel = 200+ cities)
- **Continent** - All cities in continent (e.g., Europe = 50,000+ cities)

**Publisher Priority:**
- Publishers set priority 1-10
- Higher priority wins when multiple publishers overlap
- Use case: Local rabbi (priority 10) overrides national organization (priority 5) for specific city

### 3. Algorithm DSL (Domain Specific Language)

**Purpose:** Allow publishers to define formulas in a structured, parseable format without writing code.

**Example Formula:**
```
solar(16.1, before_sunrise)  // Alos at 16.1° below horizon
```

**DSL Components:**

| Component | Description | Example |
|-----------|-------------|---------|
| **Primitives** | Built-in zmanim | `sunrise`, `sunset`, `chatzos` |
| **Functions** | Calculation methods | `solar(degrees, direction)` |
| **Operators** | Math operations | `+`, `-`, `*`, `/` |
| **Literals** | Numbers | `16.1`, `72`, `3` |
| **Directions** | Before/after | `before_sunrise`, `after_sunset` |

**Full DSL Syntax:**
```javascript
// Solar angle
solar(18.0, before_sunrise)        // 18° below horizon before sunrise
solar(8.5, after_sunset)           // 8.5° below horizon after sunset

// Fixed minutes
minutes(72, before, sunrise)       // 72 minutes before sunrise
minutes(42, after, sunset)         // 42 minutes after sunset

// Proportional hours (Shaos Zmaniyos)
shaos_zmaniyos(3, GRA, sunrise)    // 3 hours (GRA method) from sunrise
shaos_zmaniyos(4, MGA, alos)       // 4 hours (MGA method) from alos

// Midpoint
midpoint(sunrise, sunset)          // Chatzos (solar noon)

// Solar midnight
solar_midnight()                   // Exact halfway between sunset and sunrise

// Arithmetic
sunrise + minutes(30)              // 30 minutes after sunrise
sunset - minutes(18)               // 18 minutes before sunset (candle lighting)
```

**DSL Processing Pipeline:**
```
Publisher enters formula
   ↓
Lexer → Tokens (SOLAR, LPAREN, NUMBER, COMMA, BEFORE_SUNRISE, RPAREN)
   ↓
Parser → AST (Abstract Syntax Tree)
   ↓
Validator → Check syntax, types, ranges
   ↓
Executor → Calculate actual time for given date/location
   ↓
Result → Time in HH:MM:SS format
```

**Error Handling:**
- **Friendly errors** - "120° is too high. Use 0-90°" instead of "PARSE_ERROR"
- **Suggestions** - "Try: solar(16.1, before_sunrise)"
- **Examples** - "Common values: 8.5° (tzeis), 16.1° (alos), 18° (astronomical)"

### 4. AI-Powered Formula Generation

**Flow:**
```
1. Publisher types: "Dawn when sun is 16.1 degrees below horizon"
   ↓
2. System assembles RAG context:
   - DSL syntax reference (from pgvector)
   - Similar examples (from pgvector)
   - Halachic context (optional)
   ↓
3. Send to Claude API with system prompt + context + user input
   ↓
4. Claude generates: solar(16.1, before_sunrise)
   ↓
5. Validate via DSL parser
   ↓
6. If invalid, send back to Claude with error (max 2 retries)
   ↓
7. Return validated formula to publisher
   ↓
8. Publisher reviews, accepts, or regenerates
```

**RAG (Retrieval Augmented Generation):**
- **Knowledge base**: DSL docs, KosherJava docs, halachic sources
- **Chunking**: Documents split into 500-token chunks
- **Embeddings**: OpenAI text-embedding-ada-002
- **Storage**: pgvector in PostgreSQL
- **Retrieval**: Top-K semantic search (cosine similarity)
- **Token budget**: ~2000 tokens for context, ~500 for prompt

**Self-Correction:**
- If generated formula is invalid, Claude sees the validation error
- Retries with error context: "Previous formula failed validation: INVALID_ANGLE"
- Max 2 retries before giving up

### 5. Hebrew Calendar Integration

**Library:** hebcal-go (Go port of hebcal)

**Event Detection:**
- **44 Jewish events** tracked:
  - High Holidays: Rosh Hashanah, Yom Kippur
  - Pilgrim Festivals: Sukkot, Pesach, Shavuot
  - Minor holidays: Chanukah, Purim
  - Fast days: Tisha B'Av, Tzom Gedaliah, 10 Teves, 17 Tammuz, Fast of Esther
  - Special Shabbatot: Shabbat Shekalim, Zachor, Parah, HaChodesh, HaGadol
  - Sefirat HaOmer, Lag B'Omer, Tu B'Shvat

**Event-Specific Zmanim:**
- **Friday/Erev Yom Tov** → Candle lighting (18 min before sunset, configurable)
- **Saturday Night/Motzei Yom Tov** → Havdalah (42 min after sunset or solar angle)
- **Fast Days** → Fast start (alos), fast end (tzeis)
- **Sefirat HaOmer** → Earliest counting time (tzeis)

**Israel vs. Diaspora:**
- **Two-day Yom Tov** in Diaspora, one-day in Israel
- **Shmini Atzeret/Simchat Torah** - same day in Israel, separate in Diaspora
- **Detected by**: Geo-coordinates (Israel = lat ~29-33°N, lng ~34-36°E)

---

## Data Models & Database Schema

### Core Tables

#### `publishers`
- **Purpose**: Halachic authorities who publish zmanim
- **Key Fields**:
  - `id` (UUID, PK)
  - `name` (Organization name - e.g., "Congregation Beth Israel")
  - `email` (Contact email)
  - `clerk_user_id` (FK to Clerk user - for single-user publishers)
  - `website`, `bio` (Optional profile info)


  - `logo_url`, `logo_data` (Logo reference and base64 data)
  - `status` (pending, verified, suspended)
  - `created_at`, `updated_at`

#### `publisher_zmanim`
- **Purpose**: Each publisher's custom zman definitions
- **Key Fields**:
  - `id` (UUID, PK)
  - `publisher_id` (FK)
  - `zman_key` (Unique within publisher - e.g., "alos_hashachar")
  - `hebrew_name`, `english_name` (Mandatory bilingual names)
  - `transliteration`, `description` (Optional)
  - `formula_dsl` (DSL formula string)
  - `ai_explanation` (Human-readable explanation from AI)
  - `publisher_comment` (Halachic notes, sources)
  - `is_enabled`, `is_visible`, `is_published`, `is_beta`, `is_custom`
  - `category` (essential, optional, event)
  - `dependencies` (Other zmanim this formula references)
  - `sort_order` (Display order)
  - `master_zman_id` (FK to master registry - for non-custom zmanim)
  - `linked_publisher_zman_id` (FK for copied zmanim - tracks source)
  - `source_type` (registry, publisher, custom)
  - `deleted_at` (Soft delete)

#### `master_zmanim_registry`
- **Purpose**: Global catalog of all known zmanim
- **Key Fields**:
  - `id` (UUID, PK)
  - `zman_key` (Global unique key)
  - `canonical_hebrew_name`, `canonical_english_name`
  - `transliteration`, `description`
  - `default_formula_dsl` (Suggested formula)
  - `halachic_notes`, `halachic_source`
  - `time_category` (dawn, sunrise, morning, midday, afternoon, sunset, nightfall, midnight, event)
  - `is_core`, `is_hidden` (Essential vs. advanced)
  - `sort_order`

#### `publisher_coverage`
- **Purpose**: Geographic areas each publisher serves
- **Key Fields**:
  - `id` (UUID, PK)
  - `publisher_id` (FK)
  - `coverage_level` (continent, country, region, city)
  - `continent_code`, `country_code`, `region`, `city_id` (Depends on level)
  - `priority` (1-10 for match resolution)
  - `is_active` (Enable/disable without deleting)
  - `display_name` (Human-readable - e.g., "Paris, Île-de-France, France")

#### `cities`
- **Purpose**: Global city database
- **Key Fields**:
  - `id` (UUID, PK)
  - `name` (City name)
  - `name_ascii` (ASCII-only for search)
  - `country_id` (FK to geo_countries)
  - `region_id` (FK to geo_regions)
  - `latitude`, `longitude` (Coordinates)
  - `timezone` (IANA timezone - e.g., "America/New_York")
  - `elevation` (Meters above sea level - affects sunrise/sunset)
  - `population` (For search ranking)
  - **Source**: GeoNames dataset (100,000+ cities)

#### `geo_countries`, `geo_regions`, `geo_continents`
- **Purpose**: Geographic hierarchy
- **Key Fields**:
  - `id`, `code`, `name`
  - Countries have `continent_code` FK
  - Regions have `country_id` FK

#### `calculation_cache` (Legacy - mostly replaced by Redis)
- **Purpose**: Database-backed cache (fallback if Redis unavailable)
- **Key Fields**:
  - `id`, `algorithm_id`, `city_id`, `date`, `result` (JSONB), `cached_at`

#### `publisher_users`
- **Purpose**: Many-to-many relationship: users ↔ publishers (team access)
- **Key Fields**:
  - `id`, `publisher_id`, `user_id` (Clerk user ID), `role` (owner, member), `added_at`

#### `publisher_onboarding`
- **Purpose**: Tracks onboarding wizard progress
- **Key Fields**:
  - `id`, `publisher_id`, `current_step`, `completed_steps`, `wizard_data` (JSONB), `started_at`, `completed_at`, `skipped`

#### `ai_embeddings`
- **Purpose**: Vector embeddings for RAG
- **Key Fields**:
  - `id`, `content`, `embedding` (vector(1536)), `metadata` (JSONB), `source`, `chunk_index`
  - **Indexed**: pgvector HNSW index on `embedding` for fast cosine similarity search

#### `zman_tags`
- **Purpose**: Categorize zmanim (e.g., GRA, MGA, Rosh Hashanah, Yom Kippur)
- **Key Fields**:
  - `id`, `tag_key`, `name`, `display_name_hebrew`, `display_name_english`, `tag_type` (event, timing, behavior), `sort_order`

#### `master_zman_tags`
- **Purpose**: Many-to-many: master_zmanim ↔ tags
- **Key Fields**:
  - `id`, `master_zman_id`, `tag_id`

#### `zman_registry_requests`
- **Purpose**: Publishers request new zmanim to be added
- **Key Fields**:
  - `id`, `publisher_id`, `requested_key`, `requested_hebrew_name`, `requested_english_name`, `transliteration`, `description`, `requested_formula_dsl`, `time_category`, `halachic_notes`, `halachic_source`, `status` (pending, approved, rejected), `reviewed_at`, `reviewer_notes`, `publisher_email`, `publisher_name`, `auto_add_on_approval`

#### `zman_request_tags`
- **Purpose**: New tag requests within zman requests
- **Key Fields**:
  - `id`, `request_id`, `tag_id` (if using existing tag), `requested_tag_name`, `requested_tag_type`, `is_new_tag_request`

---

## API Architecture

### Endpoint Categories

**Public (Anonymous):**
- Location search, city lookup
- Publisher listing
- Zmanim calculation (default/public)

**Authenticated (User):**
- Higher rate limits
- Save preferences (future)

**Publisher:**
- Profile management
- Algorithm editing
- Coverage management
- Team management
- Analytics

**Admin:**
- Publisher approval
- User management
- Zman request review
- System configuration

### Authentication Flow

```
1. User logs in via Clerk (email/password, Google, etc.)
   ↓
2. Clerk issues JWT token
   ↓
3. Frontend includes JWT in Authorization header: "Bearer <token>"
   ↓
4. Backend middleware validates JWT:
   - Verify signature (Clerk JWKS)
   - Extract user_id, role from claims
   - Look up publisher access (if publisher role)
   ↓
5. Request proceeds with user context
```

### Rate Limiting

| Role | Limit | Window |
|------|-------|--------|
| Anonymous | 100 req/hr | Per IP |
| User | 500 req/hr | Per user |
| Publisher | 2000 req/hr | Per publisher |
| Admin | Unlimited | N/A |

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "latitude": "Must be between -90 and 90",
      "date": "Invalid date format. Use YYYY-MM-DD"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "abc123"
  }
}
```

---

## Hosting & Infrastructure

### Vercel (Frontend)
- **CDN-powered** - Global edge network
- **Automatic deployments** - Git push → deploy
- **Preview environments** - Every PR gets a URL
- **SSR + Static** - Mix of server-side and static pages
- **Edge functions** - API routes run close to users

### Fly.io (Backend)
- **Multi-region** - Deploy to regions near users
- **Auto-scaling** - Scale instances based on load
- **Health checks** - Automatic restarts on failure
- **Metrics** - CPU, memory, request rate monitoring

### Xata (Database)
- **Managed PostgreSQL** - No server management
- **Automatic backups** - Point-in-time recovery
- **Connection pooling** - Handle thousands of connections
- **PostGIS support** - Geographic queries
- **pgvector support** - Vector similarity search
- **Serverless architecture** - Auto-scaling, pay-per-use
- **Built-in search** - Full-text and vector search capabilities

### Upstash Redis (Cache)
- **Serverless Redis** - Pay-per-request pricing
- **REST API** - No persistent connections needed
- **Global replication** - Low latency worldwide
- **Automatic eviction** - LRU policy

### Clerk (Auth)
- **User management** - Email, social, multi-factor auth
- **JWT tokens** - Secure, stateless authentication
- **User roles** - Custom role management
- **Metadata** - Store publisher access lists

### Resend (Email)
- **Transactional emails** - Publisher invites, approvals, notifications
- **Templates** - Reusable email designs
- **Delivery tracking** - Open rates, bounces
- **React Email** - JSX-based email templates

---

## Security Measures

### Authentication & Authorization
- **JWT tokens** - Clerk-issued, cryptographically signed
- **Role-based access control** - Middleware checks permissions
- **Publisher context** - X-Publisher-Id header scopes requests
- **Team access** - User-publisher many-to-many with role checks

### Data Protection
- **HTTPS everywhere** - No unencrypted traffic
- **SQL injection prevention** - Parameterized queries (pgx)
- **XSS prevention** - React auto-escapes, Content Security Policy
- **CSRF protection** - SameSite cookies

### Rate Limiting
- **Per-IP limiting** - Anonymous users
- **Per-user limiting** - Authenticated users
- **Exponential backoff** - Clients should retry with delays

### Audit Logging
- **Activity logs** - All publisher actions logged
- **Impersonation tracking** - Admin actions tagged
- **Clerk audit** - User login/logout events

---

## Performance Optimizations

### Caching Strategy
- **Redis** - 24-hour TTL for calculated zmanim
- **TanStack Query** - Frontend state caching
- **Browser cache** - Static assets, logos
- **CDN** - Vercel edge network for global speed

### Database Optimization
- **Indexes** - B-tree on common filters, PostGIS spatial indexes
- **Partial indexes** - Only published zmanim, active coverage
- **Connection pooling** - Xata connection pooling
- **Query optimization** - EXPLAIN ANALYZE for slow queries

### Code Optimization
- **Lazy loading** - Components load on demand
- **Image optimization** - Next.js Image component (WebP, responsive)
- **Tree shaking** - Unused code eliminated from bundles
- **Code splitting** - Separate bundles per route

---

## Testing Strategy

### E2E Testing (Playwright)
- **130+ tests** - Cover all critical user flows
- **Clerk auth helpers** - `loginAsAdmin()`, `loginAsPublisher()`
- **Visual regression** - Screenshot comparison
- **Parallel execution** - Fast test runs
- **CI integration** - Run on every PR

### Unit Testing
- **Backend** - Go testing package
- **Frontend** - Vitest
- **DSL parser** - Extensive test suite
- **Calculation engine** - Reference value comparison

### Integration Testing
- **API tests** - HTTP request/response validation
- **Database tests** - Schema validation, constraint checks

---

## Development Workflow

### Code Standards
- **Frontend**: ESLint, Prettier, TypeScript strict mode
- **Backend**: gofmt, golint, staticcheck
- **Git hooks**: Pre-commit linting
- **CI checks**: All tests + lint must pass

### Deployment Pipeline
```
Git Push → GitHub Actions → Run Tests → Build → Deploy
                              ↓
                         (if tests pass)
                              ↓
                    Vercel (frontend) + Fly.io (backend)
```

### Environment Management
- **Development** - Local (localhost:3000, localhost:8080)
- **Staging** - Preview deploys on Vercel/Fly
- **Production** - zmanim.com

---

## Scalability

### Current Capacity
- **Publishers**: Supports thousands
- **Users**: Millions
- **Calculations/day**: Millions (with caching)
- **Cities**: 100,000+
- **Response time**: <200ms (p95)

### Scaling Strategy
- **Horizontal scaling** - Add more backend instances
- **Database** - Xata serverless auto-scales, read replicas possible
- **Cache** - Upstash auto-scales
- **CDN** - Vercel edge network global

---

## Future Technical Enhancements

- **GraphQL API** - More flexible queries for advanced clients
- **WebSockets** - Real-time updates (algorithm published → notify users)
- **Service Workers** - Offline support, background sync
- **Mobile SDKs** - Native iOS/Android calculation libraries
- **Public API** - Third-party developer access
- **Advanced caching** - Edge cache with Vercel Data Cache
- **Microservices** - Split into smaller services if needed (AI service, calculation service)

---

## In Summary

Shtetl Zmanim is built with:

✅ **Modern stack** - Next.js, Go, PostgreSQL
✅ **Cloud-native** - Vercel, Fly.io, Xata
✅ **Performance-first** - Redis caching, PostGIS indexes, edge CDN
✅ **AI-powered** - Claude for formula generation, pgvector for RAG
✅ **Secure** - JWT auth, role-based access, rate limiting
✅ **Tested** - 130+ E2E tests, comprehensive coverage
✅ **Scalable** - Serverless database, horizontal scaling, automatic failover

**Built for reliability, accuracy, and growth.**
