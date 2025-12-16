# Shtetl Zmanim - Epic Breakdown

**Author:** BMad
**Date:** 2025-11-25
**Project Type:** Brownfield (POC → Production MVP)

---

## Overview

Single epic delivering complete Shtetl Zmanim MVP - a multi-publisher platform for halachic authorities to publish customized prayer times with algorithm transparency.

**Architecture Decisions Applied:**
- City-based coverage (simplified from polygons) with country/region/city hierarchy
- Custom Go calculation engine (not kosher-zmanim library)
- Upstash Redis caching with 24hr TTL (FR32-33)
- TanStack Query for frontend state
- Playwright via MCP for E2E testing
- Coder cloud development environment

---

## Epic Summary

| Epic | Stories | FRs Covered | Status |
|------|---------|-------------|--------|
| **Epic 1: Shtetl Zmanim MVP** | 11 | FR1-FR42 | COMPLETED |
| **Epic 2: Publisher User Management** | 13 | FR43-FR66 | COMPLETED |
| **Epic 3: Consolidation & Quality** | 5 | Internal (0 FRs) | COMPLETED |
| **Epic 4: Algorithm Editor + AI** | 14 | FR67-FR95+ | COMPLETED |
| **Epic 5: DSL Editor Experience & Zman Management** | 11 | FR96-FR113 | CURRENT |

---

## FR Coverage Map

| Story | FRs |
|-------|-----|
| 1.1 Coder Development Environment | Infrastructure setup |
| 1.2 Foundation & Auth | FR2, FR5, FR6, FR39, FR40, FR41, FR42 |
| 1.3 Admin Publisher Management | FR1, FR4, FR34, FR35, FR36, FR37, FR38 |
| 1.4 Publisher Profile | FR3 |
| 1.5 Global Location System | FR21, FR22 |
| 1.6 Publisher Coverage | FR16, FR17, FR18, FR19, FR20 |
| 1.7 Calculation Engine & Caching | FR27, FR32, FR33 |
| 1.8 Algorithm Editor | FR7, FR8, FR9, FR10, FR11, FR15 |
| 1.9 Algorithm Publishing | FR12, FR13, FR14 |
| 1.10 Zmanim User Experience | FR23, FR24, FR25, FR26, FR28, FR29 |
| 1.11 Formula Reveal | FR30, FR31 |

**Coverage:** All 42 FRs included in MVP

---

## Epic 1: Shtetl Zmanim MVP

**Goal:** Deliver a complete, production-ready multi-publisher zmanim platform where halachic authorities can configure their calculation algorithms and end users can view zmanim with full formula transparency.

**User Value:** A rabbi can configure their preferred zmanim calculations, define their geographic coverage, and within minutes their community members can look up accurate prayer times and understand exactly how each time is calculated.

---

### Story 1.1: Coder Development Environment

**As a** developer,
**I want** a fully configured cloud development environment,
**So that** I can develop, test, and debug the application with consistent tooling across the team.

**Acceptance Criteria:**

**Given** I open the repository in Coder
**When** the workspace initializes
**Then** I have Go 1.21+, Node.js 20+, and all required tools installed

**Given** I am in the Coder workspace
**When** I run the start script
**Then** the web frontend (port 3000) and API backend (port 8080) are running

**Given** the development environment is running
**When** I access the database
**Then** I can connect to the database with proper credentials

**Given** I want to run E2E tests
**When** I execute Playwright tests
**Then** tests run against the local development environment

**Given** I want to cache data
**When** the API connects to Upstash Redis
**Then** I can read/write cache entries using the REST API

**Prerequisites:** None (first story)

**Technical Notes:**
- Adapt `.coder/` directory from "shtetl" project configuration
- Rename workspace from "shtetl" to "zmanim"
- Configure Terraform workspace with:
  - Go 1.21+ installation
  - Node.js 20 LTS
  - npm 10+
  - PostgreSQL client
  - Playwright browsers
- Update `start-services.sh` for zmanim ports:
  - Web: 3000
  - API: 8080
- Configure environment variables:
  - `DATABASE_URL` (PostgreSQL)
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `CLERK_SECRET_KEY`
- Remove multi-repo submodule configuration (single monorepo)
- Update README with setup instructions

**FRs:** Infrastructure (enables all FRs)

---

### Story 1.2: Foundation & Authentication

**As an** application user,
**I want** secure authentication and a reliable API,
**So that** I can safely access the platform with appropriate permissions.

**Acceptance Criteria:**

**Given** I am an unauthenticated user
**When** I visit the application
**Then** I can view public pages and access anonymous API endpoints (rate-limited)

**Given** I click "Sign In"
**When** the Clerk modal appears
**Then** I can authenticate via email/password or social providers

**Given** I am authenticated as a publisher
**When** I make API requests
**Then** my JWT is validated and I can access publisher-protected endpoints

**Given** I am authenticated as an admin
**When** I navigate to /admin
**Then** I can access the admin portal

**Given** I make an invalid API request
**When** the server processes it
**Then** I receive a structured error response: `{error: {code, message, details}}`

**Given** I am an anonymous user
**When** I exceed 100 requests/hour
**Then** I receive a 429 rate limit response

**Prerequisites:** Story 1.1 (Coder Development Environment)

**Technical Notes:**
- Install and configure `@clerk/nextjs` in `web/`
- Add Clerk middleware to protect `/publisher/*` and `/admin/*` routes
- Implement Go middleware in `api/internal/middleware/auth.go` for JWT validation
- Use Clerk Go SDK or manual JWT verification with JWKS
- Implement `respondJSON()` and `respondError()` helpers per architecture patterns
- Configure CORS for frontend domain in `api/internal/middleware/cors.go`
- Set up TanStack Query provider in `web/providers/QueryProvider.tsx`

**FRs:** FR2, FR5, FR6, FR39, FR40, FR41, FR42

---

### Story 1.3: Admin Publisher Management

**As an** administrator,
**I want** to create and manage publisher accounts,
**So that** I can onboard halachic authorities to the platform.

**Acceptance Criteria:**

**Given** I am logged in as an admin
**When** I navigate to /admin/publishers
**Then** I see a list of all publishers with their status (pending, verified, suspended)

**Given** I am on the publisher list
**When** I click "Create Publisher"
**Then** I see a form with fields: email, name, organization

**Given** I submit the create publisher form with valid data
**When** the system processes the request
**Then** a new publisher account is created with "pending" status
**And** the publisher receives an email invitation via Clerk

**Given** a publisher has "pending" status
**When** I click "Verify"
**Then** the publisher status changes to "verified"
**And** they can access publisher features

**Given** a publisher has "verified" status
**When** I click "Suspend"
**Then** the publisher status changes to "suspended"
**And** they cannot access publisher features

**Given** a publisher has "suspended" status
**When** I click "Reactivate"
**Then** the publisher status changes to "verified"

**Given** I am on the admin dashboard
**When** I view usage statistics
**Then** I see total publishers, active publishers, total calculations, and cache hit ratio

**Given** I am on the admin settings page
**When** I configure system settings
**Then** I can adjust rate limits, cache TTL, and feature flags

**Prerequisites:** Story 1.2 (Foundation & Auth)

**Technical Notes:**
- Create `web/app/admin/publishers/page.tsx` with publisher list
- Create `web/app/admin/publishers/new/page.tsx` for creation form
- Create `web/app/admin/dashboard/page.tsx` for stats dashboard
- Create `web/app/admin/settings/page.tsx` for system config
- Implement `api/internal/handlers/admin.go` with endpoints:
  - `GET /api/admin/publishers` - list all
  - `POST /api/admin/publishers` - create new
  - `PUT /api/admin/publishers/{id}/verify`
  - `PUT /api/admin/publishers/{id}/suspend`
  - `PUT /api/admin/publishers/{id}/reactivate`
  - `GET /api/admin/stats` - usage statistics
  - `GET /api/admin/config` - get system config
  - `PUT /api/admin/config` - update system config
- Add `publishers` table if not exists (see architecture data model)
- Add `system_config` table for feature flags and settings
- Use Clerk Admin API to create user accounts and send invitations

**FRs:** FR1, FR4, FR34, FR35, FR36, FR37, FR38

---

### Story 1.4: Publisher Profile

**As a** publisher,
**I want** to manage my profile information,
**So that** end users can identify and trust my organization.

**Acceptance Criteria:**

**Given** I am logged in as a verified publisher
**When** I navigate to /publisher/profile
**Then** I see my current profile information

**Given** I am on my profile page
**When** I update my name, organization, website, contact email, or bio
**Then** my changes are saved and displayed

**Given** I am on my profile page
**When** I upload a logo image
**Then** the logo is stored and displayed on my profile
**And** the logo appears when users view my publisher card

**Given** I leave required fields empty
**When** I try to save
**Then** I see inline validation errors below the fields

**Prerequisites:** Story 1.3 (Admin Publisher Management)

**Technical Notes:**
- Create `web/app/publisher/profile/page.tsx`
- Use shadcn/ui form components with react-hook-form
- Implement `api/internal/handlers/publishers.go`:
  - `GET /api/publisher/profile` - get own profile
  - `PUT /api/publisher/profile` - update profile
- Store logo in Object Storage or external CDN
- Profile fields: name, organization, email, website, bio, logo_url

**FRs:** FR3

---

### Story 1.5: Global Location System

**As a** user,
**I want** to find my location quickly,
**So that** I can see relevant zmanim publishers.

**Acceptance Criteria:**

**Given** I am on the home page
**When** I type in the location search box
**Then** I see autocomplete suggestions matching cities, regions, and countries

**Given** I search for "Brooklyn"
**When** results appear
**Then** I see "Brooklyn, New York, USA" with the full hierarchy

**Given** I search for "London"
**When** results appear
**Then** I see "London, Greater London, United Kingdom" (using UK-appropriate region type)

**Given** I click "Use My Location"
**When** I grant browser geolocation permission
**Then** my coordinates are resolved to the nearest city

**Given** the location database contains global cities
**When** I search for cities in Israel, UK, Canada, Australia, etc.
**Then** I find them with appropriate regional hierarchy (district, county, province, state)

**Prerequisites:** Story 1.2 (Foundation & Auth)

**Technical Notes:**
- Create `web/components/shared/LocationPicker.tsx` with Command (combobox) from shadcn/ui
- Implement `api/internal/handlers/cities.go`:
  - `GET /api/cities?search={query}` - search cities
  - `GET /api/cities/nearby?lat={lat}&lng={lng}` - reverse geocode
- Database schema for cities:
  ```sql
  cities (id, name, country, region, region_type, latitude, longitude, timezone, population)
  ```
- `region_type` values: 'state', 'county', 'province', 'district', 'prefecture', etc.
- Seed database with global cities (use GeoNames or similar dataset)
- Create `scripts/seed-cities.sql` or use database seed

**FRs:** FR21, FR22

---

### Story 1.6: Publisher Coverage

**As a** publisher,
**I want** to define my geographic coverage areas,
**So that** users in those locations can find me.

**Acceptance Criteria:**

**Given** I am a verified publisher
**When** I navigate to /publisher/coverage
**Then** I see my current coverage areas displayed on a map

**Given** I am on the coverage page
**When** I click "Add Coverage"
**Then** I can select coverage level: Country, Region, or City

**Given** I select "Country"
**When** I search and select "Israel"
**Then** Israel is added to my coverage with all its cities included

**Given** I select "Region"
**When** I search and select "New York" (state)
**Then** all cities in New York state are included in my coverage

**Given** I select "City"
**When** I search and select "Brooklyn"
**Then** only Brooklyn is added to my coverage

**Given** I have multiple coverage areas
**When** I set priority (1-10) for each
**Then** higher priority areas take precedence when users search

**Given** I have coverage areas
**When** I toggle "Active" off for one
**Then** that area is excluded from user searches

**Prerequisites:** Story 1.5 (Global Location System)

**Technical Notes:**
- Create `web/app/publisher/coverage/page.tsx`
- Create `web/components/publisher/CitySelector.tsx` for multi-level selection
- Use a simple map component (Leaflet or Mapbox) to display selected coverage
- Implement API endpoints:
  - `GET /api/publisher/coverage` - list own coverage
  - `POST /api/publisher/coverage` - add coverage area
  - `PUT /api/publisher/coverage/{id}` - update priority/active
  - `DELETE /api/publisher/coverage/{id}` - remove coverage
- Database: `publisher_coverage (id, publisher_id, level, geo_id, priority, is_active)`
  - `level`: 'country', 'region', 'city'
  - `geo_id`: references cities.id for city, or country/region code for higher levels

**FRs:** FR16, FR17, FR18, FR19, FR20

---

### Story 1.7: Calculation Engine & Caching

**As the** system,
**I want** to calculate accurate zmanim times,
**So that** users receive correct prayer times based on publisher algorithms.

**Acceptance Criteria:**

**Given** a location with latitude, longitude, and timezone
**When** I request zmanim calculation for a specific date
**Then** the system calculates all standard zmanim times

**Given** an algorithm specifies solar_angle method with 16.1 degrees for Alos
**When** calculation runs
**Then** Alos time is when sun is 16.1° below horizon (before sunrise)

**Given** an algorithm specifies fixed_minutes method with 72 minutes for Tzeis
**When** calculation runs
**Then** Tzeis time is exactly 72 minutes after sunset

**Given** an algorithm specifies proportional method with 3 hours GRA for Sof Zman Shma
**When** calculation runs
**Then** the time is 3 proportional hours (shaos zmaniyos) after sunrise
**And** proportional hour = (sunset - sunrise) / 12

**Given** an algorithm specifies proportional method with MGA base
**When** calculation runs
**Then** proportional hours are calculated from Alos to Tzeis (not sunrise to sunset)

**Given** calculated times
**When** returned to the API
**Then** times include the formula details (method, parameters) for each zman

**Given** a zmanim calculation is requested
**When** the same publisher/city/date was calculated within 24 hours
**Then** the cached result is returned from Upstash Redis (<100ms response)

**Given** a cached calculation exists
**When** the publisher updates their algorithm
**Then** the cache for that publisher is invalidated

**Given** the cache is empty or expired
**When** a calculation is requested
**Then** the result is calculated, cached with 24hr TTL, and returned

**Prerequisites:** Story 1.2 (Foundation & Auth)

**Technical Notes:**
- Create `api/internal/astro/` package:
  - `sun.go` - sunrise/sunset calculations using solar position algorithms
  - `angles.go` - solar depression angle calculations
  - `times.go` - time arithmetic and proportional hours
- Create `api/internal/services/algorithm/`:
  - `parser.go` - parse algorithm DSL JSON
  - `executor.go` - execute algorithm against date/location
  - `methods.go` - implement calculation methods
- Reference kosher-zmanim for algorithm inspiration but implement from scratch
- Test against known reference values (e.g., MyZmanim, Chabad.org)
- All times in UTC internally, convert to local timezone on output
- Create `api/internal/services/cache_service.go`:
  - Use Upstash Redis REST API (github.com/upstash/go-upstash-redis)
  - Cache key format: `zmanim:{publisher_id}:{city_id}:{date}`
  - TTL: 24 hours
  - Invalidation: Pattern delete on algorithm publish
- Environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**FRs:** FR27, FR32, FR33

---

### Story 1.8: Algorithm Editor

**As a** publisher,
**I want** to configure my zmanim calculation algorithm,
**So that** my community receives times according to my halachic opinions.

**Acceptance Criteria:**

**Given** I am a verified publisher
**When** I navigate to /publisher/algorithm
**Then** I see my current algorithm configuration (or empty state if none)

**Given** I am creating a new algorithm
**When** I click "Start from Template"
**Then** I can choose: Standard GRA, Magen Avraham, Rabbeinu Tam, or Custom

**Given** I am editing an algorithm
**When** I click on a zman (e.g., Alos Hashachar)
**Then** a modal opens with configuration options:
- Method: Solar Angle / Fixed Minutes / Proportional
- Parameters based on method (degrees, minutes, hours, base)

**Given** I configure Alos with solar_angle 16.1°
**When** I look at the preview panel
**Then** I see the calculated time for today's date at a sample location

**Given** I click "View Month"
**When** the preview expands
**Then** I see a calendar month view with all zmanim for each day

**Given** I enter invalid configuration (e.g., negative degrees)
**When** I try to save
**Then** I see validation error and cannot save

**Given** I have unsaved changes
**When** I try to navigate away
**Then** I am warned about losing changes

**Prerequisites:** Story 1.7 (Calculation Engine & Caching)

**Technical Notes:**
- Create `web/app/publisher/algorithm/page.tsx`
- Create `web/components/publisher/AlgorithmEditor.tsx`:
  - List of zmanim with current configuration
  - Modal for editing each zman
  - Live preview panel
  - Month view expansion
- Use shadcn/ui Dialog, Select, Input components
- Algorithm stored as JSON DSL (see architecture):
  ```json
  {
    "name": "My Algorithm",
    "zmanim": {
      "alos": {"method": "solar_angle", "params": {"degrees": 16.1}},
      ...
    }
  }
  ```
- API endpoints:
  - `GET /api/publisher/algorithm` - get current algorithm
  - `PUT /api/publisher/algorithm` - save algorithm (draft)
  - `POST /api/publisher/algorithm/preview` - calculate preview

**FRs:** FR7, FR8, FR9, FR10, FR11, FR15

---

### Story 1.9: Algorithm Publishing

**As a** publisher,
**I want** to publish my algorithm to make it active,
**So that** end users can see zmanim calculated with my method.

**Acceptance Criteria:**

**Given** I have a configured algorithm in draft status
**When** I click "Publish"
**Then** the algorithm becomes active and visible to users

**Given** I have a published algorithm
**When** I make changes and save
**Then** changes are saved as a new draft version
**And** the published version remains active

**Given** I have draft changes
**When** I click "Publish Changes"
**Then** the draft becomes the new active version
**And** the old version is archived

**Given** I have multiple algorithm versions
**When** I view version history
**Then** I see all versions with dates and can compare

**Given** I have an old published version
**When** I click "Deprecate"
**Then** that version is marked deprecated
**And** users on that version see a notice to refresh

**Prerequisites:** Story 1.8 (Algorithm Editor)

**Technical Notes:**
- Add version management to algorithm table:
  ```sql
  algorithms (id, publisher_id, version, config, status, created_at)
  ```
  - `status`: 'draft', 'published', 'deprecated'
- API endpoints:
  - `POST /api/publisher/algorithm/publish` - publish current draft
  - `GET /api/publisher/algorithm/versions` - list versions
  - `PUT /api/publisher/algorithm/versions/{id}/deprecate`
- Only one active (published) version per publisher at a time
- When new version published, old version auto-archived

**FRs:** FR12, FR13, FR14

---

### Story 1.10: Zmanim User Experience

**As an** end user,
**I want** to view zmanim times for my location,
**So that** I know when to pray according to my chosen authority.

**Acceptance Criteria:**

**Given** I am on the home page
**When** I select my city
**Then** I see a list of publishers covering that location

**Given** I see the publisher list
**When** publishers are displayed
**Then** they are sorted by priority (higher first), then alphabetically
**And** each card shows: name, organization, logo

**Given** I click on a publisher card
**When** I view publisher details
**Then** I see their full profile before selecting

**Given** I select a publisher
**When** the zmanim page loads
**Then** I see today's zmanim times in a clean list:
- Zman name, time, info icon (ⓘ)
- Times in local timezone with AM/PM

**Given** I am viewing zmanim
**When** I click the date navigation arrows (← →)
**Then** I can view zmanim for any past or future date

**Given** I am viewing zmanim
**When** I click the date
**Then** a date picker opens for quick navigation

**Given** no publisher covers my location
**When** I search for my city
**Then** I see a warning: "No local authority covers this area yet"
**And** I see default (non-authoritative) zmanim with disclaimer

**Prerequisites:** Story 1.6 (Publisher Coverage), Story 1.7 (Calculation Engine & Caching)

**Technical Notes:**
- Create `web/app/zmanim/page.tsx` - location selection
- Create `web/app/zmanim/[city]/page.tsx` - publisher list
- Create `web/app/zmanim/[city]/[publisher]/page.tsx` - zmanim display
- Create components:
  - `web/components/shared/PublisherCard.tsx`
  - `web/components/zmanim/ZmanimList.tsx`
  - `web/components/zmanim/ZmanRow.tsx`
- Use Luxon for date handling and timezone conversion
- Implement `GET /api/cities/{cityId}/publishers` - list publishers for city
- Implement `GET /api/zmanim?cityId={}&publisherId={}&date={}` - calculate zmanim
- Store last selected city in localStorage (FR per UX spec)

**FRs:** FR23, FR24, FR25, FR26, FR28, FR29

---

### Story 1.11: Formula Reveal

**As an** end user,
**I want** to see how each zmanim time is calculated,
**So that** I understand the halachic basis for my prayer times.

**Acceptance Criteria:**

**Given** I am viewing zmanim times
**When** I click the info icon (ⓘ) next to any time
**Then** a panel slides in showing formula details

**Given** I am on desktop (≥768px)
**When** the formula panel opens
**Then** it slides in from the right as a side panel

**Given** I am on mobile (<768px)
**When** the formula panel opens
**Then** it slides up from the bottom as a bottom sheet

**Given** the formula panel is open
**When** I view the contents
**Then** I see:
- Zman name (e.g., "Alos HaShachar")
- Method name (e.g., "Solar Depression Angle")
- Parameters (e.g., "16.1° below horizon")
- Brief explanation (e.g., "Dawn begins when the sun is 16.1° below the eastern horizon")

**Given** the publisher provided halachic context
**When** I view the formula panel
**Then** I also see the halachic source/reasoning (optional field)

**Given** the formula panel is open
**When** I click outside, press X, or swipe down (mobile)
**Then** the panel closes

**Prerequisites:** Story 1.10 (Zmanim User Experience)

**Technical Notes:**
- Create `web/components/zmanim/FormulaPanel.tsx`
- Use Radix Dialog (via shadcn/ui Sheet component) for side panel
- Implement responsive behavior with `useMediaQuery` hook or CSS media queries
- Formula data is included in zmanim API response (no extra API call):
  ```json
  {
    "name": "Alos HaShachar",
    "time": "05:23:00",
    "formula": {
      "method": "solar_angle",
      "display_name": "Solar Depression Angle",
      "parameters": {"degrees": 16.1},
      "explanation": "Dawn begins when..."
    }
  }
  ```
- Add subtle slide animation via Tailwind/CSS transitions
- Ensure keyboard accessibility (Escape to close, focus trap)

**FRs:** FR30, FR31

---

## FR Coverage Matrix

| FR | Description | Story |
|----|-------------|-------|
| FR1 | Admin creates publisher accounts | 1.3 |
| FR2 | Publishers login via Clerk | 1.2 |
| FR3 | Publishers update profile | 1.4 |
| FR4 | Admin verify/suspend/reactivate | 1.3 |
| FR5 | Anonymous access | 1.2 |
| FR6 | Auth users higher rate limits | 1.2 |
| FR7 | Create algorithms | 1.8 |
| FR8 | Configure zmanim methods | 1.8 |
| FR9 | Algorithm templates | 1.8 |
| FR10 | Preview calculations (+ month) | 1.8 |
| FR11 | Save as draft | 1.8 |
| FR12 | Publish algorithms | 1.9 |
| FR13 | Update creates new version | 1.9 |
| FR14 | Deprecate old versions | 1.9 |
| FR15 | Validate before publish | 1.8 |
| FR16 | Define coverage (country/region/city) | 1.6 |
| FR17 | View coverage on map | 1.6 |
| FR18 | Coverage priorities | 1.6 |
| FR19 | Name/describe coverage | 1.6 |
| FR20 | Activate/deactivate coverage | 1.6 |
| FR21 | Search locations | 1.5 |
| FR22 | Browser geolocation | 1.5 |
| FR23 | Display publishers for location | 1.10 |
| FR24 | Sort by priority/distance | 1.10 |
| FR25 | View publisher profile | 1.10 |
| FR26 | Select publisher for zmanim | 1.10 |
| FR27 | Calculate using algorithm | 1.7 |
| FR28 | Date selection | 1.10 |
| FR29 | Timezone display | 1.10 |
| FR30 | Reveal formula | 1.11 |
| FR31 | Show method/params/explanation | 1.11 |
| FR32 | Cache calculations (Upstash Redis) | 1.7 |
| FR33 | Cache invalidation | 1.7 |
| FR34 | Admin view publishers | 1.3 |
| FR35 | Admin create publishers | 1.3 |
| FR36 | Admin verify publishers | 1.3 |
| FR37 | Admin usage stats | 1.3 |
| FR38 | Admin system config | 1.3 |
| FR39 | REST API endpoints | 1.2 |
| FR40 | Error messages | 1.2 |
| FR41 | Rate limiting | 1.2 |
| FR42 | CORS support | 1.2 |

---

## Summary

**Epic 1: Shtetl Zmanim MVP**
- **Stories:** 11
- **FRs Covered:** 42 of 42 (100%)
- **Sequence:** Coder → Foundation → Publisher Management → Location → Algorithms → User Experience

**Story Dependency Chain:**
```
1.1 Coder Development Environment
 └── 1.2 Foundation
      ├── 1.3 Admin Publisher Management
      │    └── 1.4 Publisher Profile
      ├── 1.5 Global Location System
      │    └── 1.6 Publisher Coverage
      └── 1.7 Calculation Engine & Caching
           └── 1.8 Algorithm Editor
                └── 1.9 Algorithm Publishing
                     └── 1.10 Zmanim UX
                          └── 1.11 Formula Reveal
```

**After Epic 1 Completion:**
- Admins can onboard publishers
- Publishers can configure algorithms and define global coverage
- Users can find their location, select a publisher, view zmanim, and understand the calculations
- Calculations are cached with 24hr TTL via Upstash Redis
- **MVP is complete!**

---

## Epic 2: Publisher User Management & Dashboard

**Status:** COMPLETED (2025-11-26)
**Stories:** 13 (2.0 - 2.12)
**FRs:** FR43-FR66

See: [epic-2-publisher-user-management.md](epic-2-publisher-user-management.md)

**Key Deliverables:**
- Multi-publisher user access and switcher (FR43-FR46)
- Admin impersonation mode (FR47-FR49)
- Publisher dashboard hub (FR50)
- Enhanced coverage management (FR51-FR52)
- Analytics and activity logging (FR53-FR54)
- Email service via Resend (FR61-FR62, FR66)
- Self-service publisher registration (FR55-FR57)
- Publisher team invitations (FR58-FR60)
- User profile dropdown (FR63-FR65)

---

## Epic 3: Consolidation & Quality

**Status:** COMPLETED (2025-11-27)
**Stories:** 5 (3.0 - 3.4)
**FRs:** None (internal quality work)

See: [epic-3-consolidation-quality.md](epic-3-consolidation-quality.md)

**Goal:** Harden the foundation before building new features. Quality as a first-class citizen.

**Stories:**
| Story | Name | Focus |
|-------|------|-------|
| 3.0 | Testing Infrastructure | Clerk auth helpers, test fixtures |
| 3.1 | Comprehensive E2E Test Suite | 130+ scenarios validating Epic 1 & 2 |
| 3.2 | Codebase Audit & Documentation | Study patterns, document learnings |
| 3.3 | Coding Standards & Architecture | Formalize patterns, update docs |
| 3.4 | Refactor to Standards | Apply standards, fix inconsistencies |

**Key Outcomes:**
- `loginAsAdmin()` and `loginAsPublisher()` test helpers
- Comprehensive E2E coverage for authenticated flows (130+ tests)
- `coding-standards.md` with clear guidelines
- Updated `architecture.md` with proven patterns
- Technical debt reduced
- New Definition of Done includes mandatory E2E tests

---

## Epic 4: Intuitive Zmanim Algorithm Editor with AI-Powered DSL

**Status:** COMPLETED (2025-12-02)
**Stories:** 14 (4.0 - 4.13)
**FRs:** FR67-FR95+ (Algorithm Editor Enhancement)

**Goal:** Transform the algorithm editor into an Apple-quality UX experience with AI-powered formula generation, bilingual support, and collaborative features.

See detailed specifications:
- [epic-4-comprehensive-plan.md](sprint-artifacts/epic-4-comprehensive-plan.md)
- [epic-4-dsl-specification.md](sprint-artifacts/epic-4-dsl-specification.md)
- [epic-4-ui-wireframes.md](sprint-artifacts/epic-4-ui-wireframes.md)

### Epic 4 Phases

| Phase | Stories | Focus |
|-------|---------|-------|
| **Foundation** | 4.0-4.3 | Infrastructure, DSL design & parser, bilingual naming |
| **Editor UX** | 4.4-4.6 | Guided builder, halachic docs, advanced editor |
| **AI Features** | 4.7-4.9 | RAG context, formula generation, explanations |
| **User Experience** | 4.10-4.13 | Hebrew calendar, onboarding, collaboration, versioning |

### Stories

| Story | Name | Points | Dependencies |
|-------|------|--------|--------------|
| 4.0 | PostgreSQL + pgvector Image | 3 | None | **DONE** |
| 4.1 | Zmanim DSL Design | 3 | 4.0 |
| 4.2 | Zmanim DSL Parser | 8 | 4.1 |
| 4.3 | Bilingual Naming System | 5 | 4.2 |
| 4.4 | Guided Formula Builder | 13 | 4.2, 4.3 |
| 4.5 | Halachic Documentation | 5 | 4.3, 4.4 |
| 4.6 | Advanced Mode Editor (CodeMirror) | 8 | 4.2, 4.4 |
| 4.7 | AI Context System (RAG) | 8 | 4.0, 4.1 |
| 4.8 | AI Formula Service | 8 | 4.2, 4.7 |
| 4.9 | AI Explanation Generator | 5 | 4.8 |
| 4.10 | Weekly Preview (Hebrew Calendar) | 8 | 4.2, 4.3 |
| 4.11 | Publisher Onboarding Wizard | 8 | 4.4, 4.3 |
| 4.12 | Algorithm Collaboration | 5 | 4.2 |
| 4.13 | Formula Version History | 5 | 4.2, 4.6 |

**Total Story Points:** 92

### Epic 4 DoD Policy

**Story-Level:**
- Create comprehensive tests for the story (frontend + backend)
- Run only story-specific tests before marking "ready for review"
- If API/web not working: run `./restart.sh` from project root

**Epic-Level:**
- Full E2E regression (130+ existing tests + new tests) at epic completion
- All tests must pass before epic considered complete

### Key Deliverables

- **DSL Language:** Complete specification and parser for zmanim formulas
- **Visual Editor:** Apple-quality guided formula builder with live preview
- **CodeMirror Integration:** Syntax highlighting, autocomplete, inline validation
- **AI Features:** RAG-powered formula generation and human-readable explanations
- **Hebrew Calendar:** Weekly preview with 44 Jewish events via hebcal-go
- **Collaboration:** Copy/fork algorithms with attribution
- **Version History:** Visual diff and rollback capabilities

### Dependency Chain

```
4.0 PostgreSQL + pgvector ✅
 └── 4.1 DSL Design
      └── 4.2 DSL Parser
           ├── 4.3 Bilingual Naming
           │    └── 4.4 Guided Builder
           │         ├── 4.5 Halachic Docs
           │         └── 4.11 Onboarding
           ├── 4.6 Advanced Editor
           │    └── 4.13 Version History
           ├── 4.10 Hebrew Calendar
           └── 4.12 Collaboration
      └── 4.7 RAG Context (parallel with 4.2)
           └── 4.8 AI Formula
                └── 4.9 AI Explanations
```

---

## Epic 5: DSL Editor Experience & Zman Management

**Status:** CURRENT SPRINT
**Stories:** 18 (5.0 - 5.17)
**FRs:** FR96-FR120 (Editor Experience & Zman Management)

**Goal:** Deliver a "hand-holding" DSL editor experience for non-technical users, plus publisher zman customization and new zman request workflow.

**User Value:** A rabbi who knows halacha but not programming can define formulas in under 30 seconds with zero confusion. Publishers can customize zman names and request new zmanim, creating a community-driven master registry.

See detailed specifications:
- [ux-dsl-editor-inline-guidance.md](ux-dsl-editor-inline-guidance.md)

---

### Story 5.0: Database Schema for Publisher Aliases & Zman Requests

**As a** developer,
**I want** the database schema extended for publisher zman aliases and enhanced zman requests,
**So that** we have the data layer for all Epic 5 features.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Database Migrations" (migration file naming, idempotent SQL)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** the migration is applied
**When** I query the database
**Then** the `publisher_zman_aliases` table exists with:
- `id` (UUID, PK)
- `publisher_id` (FK to publishers)
- `publisher_zman_id` (FK to publisher_zmanim)
- `custom_hebrew_name` (TEXT, required)
- `custom_english_name` (TEXT, required)
- `custom_transliteration` (TEXT, optional)
- `is_active` (BOOLEAN, default true)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- UNIQUE constraint on (publisher_id, publisher_zman_id)

**And** the `zman_registry_requests` table is enhanced with:
- `transliteration` (TEXT)
- `description` (TEXT)
- `halachic_notes` (TEXT)
- `halachic_source` (TEXT)
- `publisher_email` (TEXT)
- `publisher_name` (TEXT)
- `auto_add_on_approval` (BOOLEAN, default true)

**And** the `zman_request_tags` table exists with:
- `id` (UUID, PK)
- `request_id` (FK to zman_registry_requests)
- `tag_id` (FK to zman_tags, nullable for new tag requests)
- `requested_tag_name` (TEXT, for new tag requests)
- `requested_tag_type` (TEXT, constrained to valid types)
- `is_new_tag_request` (BOOLEAN)
- CHECK constraint ensuring either tag_id or requested_tag_name is set

**Prerequisites:** None (first story of Epic 5)

**Technical Notes:**
- Create migration `00000000000023_publisher_zman_aliases.sql`
- Create migration `00000000000024_enhance_zman_registry_requests.sql`
- Regenerate SQLc code after migrations
- Add appropriate indexes for query performance

**FRs:** Infrastructure for FR96-FR115

---

### Story 5.1: Human-Friendly Error Messages

**As a** non-technical publisher,
**I want** error messages that explain what's wrong in plain language,
**So that** I can fix formula errors without understanding programming jargon.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure"
- "Error Handling Standards > Frontend Error Handling"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I type an invalid formula like `sunrise solar 11 before`
**When** the validation runs
**Then** I see a friendly error like:
- Headline: "Oops! `solar` needs parentheses to work."
- Suggestion: "Try: `solar(16.1, before_sunrise)`"
- An "Insert this example" button

**Given** I type `solar(120, before_sunrise)` (degrees too high)
**When** the validation runs
**Then** I see:
- Headline: "120° is too high."
- Explanation: "The sun can only be 0-90° below the horizon."
- Suggestion: "Common values: 8.5° (tzeis), 16.1° (alos), 18° (astronomical)"

**Given** I type `solar(16.1)` (missing argument)
**When** the validation runs
**Then** I see:
- Headline: "Almost there! `solar()` needs two things."
- Explanation: "A number for degrees AND a direction."
- Example with parameter breakdown

**Given** I type an unknown primitive like `sunrise2`
**When** the validation runs
**Then** I see:
- Headline: "I don't recognize 'sunrise2'."
- Suggestion: "Did you mean `sunrise`?"

**Given** the backend returns an error with a suggestion
**When** the frontend displays it
**Then** the backend suggestion is shown (not overridden by frontend mapping)

**Prerequisites:** Story 5.0

**Technical Notes:**
- Create `web/lib/error-humanizer.ts` with pattern matching
- Modify backend validator to include error codes
- Create `HumanErrorDisplay.tsx` component
- Integrate with existing error display in CodeMirrorDSLEditor
- Map all common errors per UX spec Appendix A

**FRs:** FR96 (Human-friendly validation feedback)

---

### Story 5.2: Contextual Tooltips in DSL Editor

**As a** non-technical publisher,
**I want** helpful hints that appear exactly where my cursor is,
**So that** I know what values to type without looking at documentation.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure"
- "Frontend Standards > Unified API Client" (if fetching tooltip data)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** my cursor is inside `solar(` after the opening parenthesis
**When** I pause for 100ms
**Then** a tooltip appears showing:
- Title: "📐 Degrees: Sun angle below horizon (0-90)"
- Common values: 8.5° (tzeis), 11° (misheyakir), 16.1° (alos), 18° (astronomical)
- "Type a number, e.g., 16.1"

**Given** my cursor is after the first comma in `solar(16.1,`
**When** I pause for 100ms
**Then** a tooltip appears showing:
- Title: "🧭 Direction: When does this angle occur?"
- Clickable buttons: before_sunrise, after_sunset, before_noon, after_noon
- Clicking a button inserts that value

**Given** my cursor is inside `proportional_hours(`
**When** I pause for 100ms
**Then** a tooltip appears showing hour values (3, 4, 6, 9.5, 10.75) with their meanings

**Given** I press Escape or click outside the tooltip
**When** the tooltip is visible
**Then** the tooltip dismisses

**Given** I click an option in the tooltip
**When** it inserts the value
**Then** the tooltip dismisses and cursor advances

**Given** I'm on mobile (touch interface)
**When** I tap in a parameter position
**Then** the tooltip appears and I can tap options to insert

**Prerequisites:** Story 5.1

**Technical Notes:**
- Create `web/lib/dsl-context-helper.ts` to parse cursor position context
- Create `web/components/editor/ContextualTooltip.tsx`
- Use CodeMirror `EditorView.updateListener` for cursor tracking
- Position tooltip relative to cursor coordinates
- Leverage existing `halachic-glossary.ts` for content
- Ensure keyboard accessibility (arrow key navigation)

**FRs:** FR97 (Contextual inline guidance)

---

### Story 5.3: Smart Placeholders with Real Examples

**As a** non-technical publisher,
**I want** function templates to show real examples instead of abstract placeholders,
**So that** I can immediately understand the correct format.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I click "solar()" in the reference panel
**When** the function is inserted
**Then** the editor shows `solar(16.1, before_sunrise)` (not `solar(degrees, direction)`)
**And** the `16.1` is selected/highlighted so I can immediately type my value

**Given** I click "proportional_hours()" in the reference panel
**When** the function is inserted
**Then** the editor shows `proportional_hours(4, gra)` (not `proportional_hours(hours, base)`)
**And** the `4` is selected

**Given** I have inserted a function with example values
**When** I press Tab
**Then** the cursor moves to the next parameter (e.g., from degrees to direction)
**And** the contextual tooltip appears for that parameter

**Given** I hover over a function in the reference panel
**When** the info appears
**Then** I see "Quick insert:" with clickable chips for common values (e.g., [8.5°] [11°] [16.1°] [18°])

**Prerequisites:** Story 5.2

**Technical Notes:**
- Modify `web/lib/dsl-reference-data.ts` to include `realWorldExample` property
- Update reference panel insert behavior to use examples
- Implement Tab-to-next-parameter using CodeMirror field markers
- Add quick-insert chips to reference panel entries

**FRs:** FR98 (Smart placeholders with examples)

---

### Story 5.4: Publisher Zman Alias API

**As a** publisher,
**I want** to create custom names for zmanim in my algorithm,
**So that** my community sees familiar terminology while the system maintains canonical references.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Structure" (6-step pattern)
- "Backend Standards > Response Format" (use RespondJSON correctly)
- "Error Handling Standards > Backend Error Handling"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I am an authenticated publisher with a published zman
**When** I call `PUT /api/v1/publisher/zmanim/{zmanKey}/alias` with:
```json
{
  "custom_hebrew_name": "עמוד השחר",
  "custom_english_name": "Dawn Column",
  "custom_transliteration": "Amud HaShachar"
}
```
**Then** the alias is created/updated
**And** I receive a 200 response with the alias details including canonical names

**Given** I have an alias for a zman
**When** I call `GET /api/v1/publisher/zmanim/{zmanKey}/alias`
**Then** I receive both my custom name AND the canonical master registry name

**Given** I have an alias for a zman
**When** I call `DELETE /api/v1/publisher/zmanim/{zmanKey}/alias`
**Then** the alias is removed
**And** the zman reverts to showing canonical names

**Given** I have multiple aliases
**When** I call `GET /api/v1/publisher/zmanim/aliases`
**Then** I receive all my aliases with both custom and canonical names

**Given** a user views my zmanim
**When** the API returns zman data
**Then** both the custom name (if exists) and canonical name are included

**Prerequisites:** Story 5.0

**Technical Notes:**
- Create `api/internal/handlers/publisher_aliases.go`
- Add SQLc queries for alias CRUD operations
- Include canonical names in responses from `master_zmanim_registry`
- Register routes in publisher router

**FRs:** FR99 (Publisher zman custom naming), FR100 (Canonical name visibility)

---

### Story 5.5: Publisher Zman Alias UI

**As a** publisher,
**I want** to rename zmanim in the Advanced DSL editor,
**So that** I can customize display names while seeing the original canonical name.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Unified API Client" (use useApi hook)
- "Frontend Standards > Component Structure"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I am editing a zman in Advanced DSL mode
**When** I view the zman settings
**Then** I see a "Custom Display Name" section (not visible in Guided Builder)

**Given** I am in the Custom Display Name section
**When** I see the current state
**Then** I see the canonical name from master registry displayed as "Original: [name]"

**Given** I want to rename a zman
**When** I enter custom Hebrew name, English name, and transliteration
**Then** I can save the alias
**And** the canonical name remains visible in a subtle "Original: X" label

**Given** I have a custom name set
**When** I view the zman card in my algorithm list
**Then** I see my custom name prominently with canonical name in parentheses or subtitle

**Given** I want to revert to canonical naming
**When** I click "Remove Custom Name" or clear all fields
**Then** the alias is deleted and canonical names are used

**Prerequisites:** Story 5.4

**Technical Notes:**
- Create `web/components/publisher/ZmanAliasEditor.tsx`
- Modify `web/app/publisher/algorithm/edit/[zman_key]/page.tsx` to include alias editor
- Only show in Advanced DSL mode (check for mode flag)
- Show clear visual distinction between custom and canonical names

**FRs:** FR99, FR100

---

### Story 5.6: Request New Zman API & Email Notifications

**As a** publisher,
**I want** to submit a request for a new zman to be added to the master registry,
**So that** I can use zmanim not currently in the system.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Structure" (6-step pattern)
- "Backend Standards > Response Format" (use RespondJSON correctly)
- "Error Handling Standards > Backend Error Handling"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I am an authenticated publisher
**When** I call `POST /api/v1/publisher/zmanim/request` with:
```json
{
  "hebrew_name": "שקיעת החמה המאוחרת",
  "english_name": "Late Sunset",
  "time_category": "evening",
  "justification": "Needed for Rabbeinu Tam calculations",
  "existing_tag_ids": ["uuid-1", "uuid-2"],
  "new_tag_requests": [
    {"name": "Rabbeinu Tam", "tag_type": "shita", "description": "72 minutes method"}
  ],
  "formula_dsl": "sunset + 72min",
  "auto_add_on_approval": true
}
```
**Then** the request is created with status "pending"
**And** I receive a confirmation email
**And** admin receives a notification email with review link

**Given** I submit a request with formula_dsl
**When** the backend processes it
**Then** the formula is validated
**And** validation errors are returned if invalid (request still created but flagged)

**Given** a request only requires hebrew_name, english_name, and justification
**When** I submit with minimal fields
**Then** the request is accepted (most fields optional)

**Given** I want to see my pending requests
**When** I call `GET /api/v1/publisher/zmanim/requests`
**Then** I receive a list of my requests with status

**Prerequisites:** Story 5.0

**Technical Notes:**
- Create `api/internal/handlers/zman_requests.go`
- Add SQLc queries for request CRUD
- Extend `email_service.go` with new templates:
  - `TemplateZmanRequestSubmitted` (to publisher)
  - `TemplateAdminNewZmanRequest` (to admin)
- Validate formula_dsl if provided (but allow request even if invalid)

**FRs:** FR101 (Request new zman), FR102 (Guided tag selection), FR103 (Optional formula), FR104 (Email on submission)

---

### Story 5.7: Request New Zman UI

**As a** publisher,
**I want** a guided form to request new zmanim,
**So that** I can submit complete requests with proper tags and optional formulas.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Unified API Client" (use useApi hook)
- "Frontend Standards > Component Structure"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I navigate to `/publisher/zmanim/request`
**When** the page loads
**Then** I see a multi-step form with progress indicator

**Given** I am on Step 1 (Names)
**When** I fill in the form
**Then** Hebrew Name and English Name are required (marked with *)
**And** Transliteration is optional

**Given** I am on Step 2 (Classification)
**When** I see the tag selection
**Then** I can browse existing tags by category (event, timing, behavior, shita, method)
**And** I can multi-select tags
**And** I see a "Request New Tag" button

**Given** I click "Request New Tag"
**When** the dialog opens
**Then** I can enter: tag name, tag type (dropdown), description
**And** the new tag request is attached to my zman request

**Given** I am on Step 3 (Formula - Optional)
**When** I see the formula input
**Then** it's clearly marked as optional
**And** I see a simplified DSL editor (same as advanced mode but smaller)
**And** validation runs but doesn't block submission

**Given** I am on Step 4 (Review & Submit)
**When** I review my request
**Then** I see all entered data formatted nicely
**And** I must provide a Justification (required)
**And** I see "Auto-add to my zmanim on approval" checkbox (default checked)

**Given** I submit the request
**When** the API responds successfully
**Then** I see a success message with confirmation email notice
**And** I'm redirected to my requests list

**Prerequisites:** Story 5.6

**Technical Notes:**
- Create `web/app/publisher/zmanim/request/page.tsx`
- Create `web/components/publisher/ZmanRequestForm.tsx` (multi-step)
- Create `web/components/shared/TagSelector.tsx`
- Use shadcn/ui Stepper pattern for multi-step
- Reuse CodeMirror editor for formula input

**FRs:** FR101-FR104

---

### Story 5.8: Admin Zman Request Review Page

**As an** admin,
**I want** a page to review and manage zman requests,
**So that** I can approve or reject publisher submissions.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Unified API Client" (use useApi hook)
- "Frontend Standards > Component Structure"
- "Backend Standards > Handler Structure" (6-step pattern)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I am logged in as admin
**When** I navigate to `/admin/zmanim/requests`
**Then** I see a table of zman requests with columns:
- Publisher Name
- Hebrew Name / English Name
- Time Category
- Status (pending/approved/rejected)
- Submitted Date
- Actions

**Given** I view the requests table
**When** I want to filter
**Then** I can filter by status (pending, approved, rejected, all)
**And** I can search by publisher name or zman name

**Given** I click on a request row
**When** the detail panel opens
**Then** I see:
- All submitted fields
- Formula (if provided) with validation status
- Requested tags (existing + new tag requests)
- Justification

**Given** I click "Approve"
**When** the approval dialog opens
**Then** I must set:
- `zman_key` (admin-defined, unique identifier)
- Sort order (where it appears in lists)
- Whether to create requested new tags
- Which tags to apply
- Optional admin notes

**Given** I submit approval
**When** the backend processes it
**Then** the zman is added to master registry
**And** if auto_add_on_approval was true, it's added to publisher's zmanim
**And** publisher receives approval email with zman details

**Given** I click "Reject"
**When** the rejection dialog opens
**Then** I must provide a rejection reason
**And** publisher receives rejection email with reason

**Prerequisites:** Story 5.6

**Technical Notes:**
- Create `web/app/admin/zmanim/requests/page.tsx`
- Create `web/components/admin/ZmanRequestReview.tsx`
- Add admin API endpoints for approve/reject
- Extend email_service with approval/rejection templates
- Follow table patterns from existing admin pages

**FRs:** FR105 (Admin review page), FR106 (Approval workflow), FR107 (Rejection with reason), FR108 (Email on decision)

---

### Story 5.9: Reference Panel Contextual Enhancements

**As a** non-technical publisher,
**I want** the reference panel to highlight where I am in my formula,
**So that** I always know what documentation is relevant.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Component Structure"
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** my cursor is inside `solar(16.1, before_sunrise)`
**When** I look at the reference panel
**Then** the `solar()` function entry is highlighted
**And** I see a "YOU ARE HERE" indicator on the current parameter

**Given** my cursor is at the degrees position
**When** I look at the highlighted solar() entry
**Then** the degrees parameter is expanded with:
- Description: "0-90 (sun angle below horizon)"
- Quick-insert chips: [8.5°] [11°] [16.1°] [18°]

**Given** I click a quick-insert chip like [16.1°]
**When** the value is inserted
**Then** it replaces the current parameter value in my formula
**And** cursor moves to next parameter

**Given** my cursor is not inside any function
**When** I look at the reference panel
**Then** no function is specially highlighted (normal state)

**Prerequisites:** Story 5.3

**Technical Notes:**
- Modify `web/components/editor/DSLReferencePanel.tsx`
- Use cursor context from `dsl-context-helper.ts`
- Add highlighting state and "YOU ARE HERE" indicator
- Add quick-insert chips to parameter descriptions
- Wire chip clicks to editor insert behavior

**FRs:** FR109 (Reference panel contextual highlighting)

---

### Story 5.10: Mandatory Publisher Logo with Image Editor

**As a** publisher,
**I want** a proper logo upload experience with cropping and sizing tools,
**So that** my logo looks professional and consistent across the platform.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Unified API Client" (use useApi hook for uploads)
- "Frontend Standards > Component Structure"
- "Backend Standards > Handler Structure" (for upload endpoint)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Acceptance Criteria:**

**Given** I am creating or editing my publisher profile
**When** I view the logo section
**Then** logo upload is REQUIRED (marked with *)
**And** I cannot save my profile without a logo

**Given** I don't have a logo image
**When** I click "Generate from Initials"
**Then** the system creates a logo using my publisher name initials
**And** I can customize the background color
**And** the generated logo is displayed in preview

**Given** I upload an image
**When** the image loads
**Then** I see an image editor with:
- Crop selection box (drag to resize/reposition)
- Zoom in/out controls (+/- buttons or slider)
- Pan/drag the image within the crop area
- Aspect ratio locked to 1:1 (square)
- Preview of final result at actual display size

**Given** I have positioned the crop area
**When** I click "Apply"
**Then** the image is cropped and resized to 200x200px (or defined standard size)
**And** the preview updates to show the final logo

**Given** the publisher name field exists
**When** I view the field label
**Then** it reads "Publisher Name" (not "Name")
**And** helper text says "Organization or publication name (not personal name)"

**Given** I try to enter what looks like a personal name (e.g., "Rabbi David Cohen")
**When** I focus out of the field
**Then** I see a warning: "This appears to be a personal name. Publisher names should be organization names like 'Beth Israel Congregation' or 'Chicago Rabbinical Council'"

**Given** a publisher is displayed anywhere in the app
**When** I see the publisher reference
**Then** it uses "Publisher Name" terminology consistently (not just "Name")

**Prerequisites:** None (can be done in parallel with other Epic 5 stories)

**Technical Notes:**
- Make `logo_url` required in publisher profile validation
- Create `web/components/publisher/LogoEditor.tsx` using:
  - react-image-crop or react-easy-crop library
  - Canvas API for final crop/resize
- Create `web/components/publisher/InitialsLogoGenerator.tsx`
  - Generate SVG or canvas-based logo from initials
  - Color picker for background
- Standard logo size: 200x200px (stored), displayed at various sizes via CSS
- Update all UI text from "Name" to "Publisher Name" where appropriate
- Add name validation regex to detect likely personal names
- Store cropped image to cloud storage or existing CDN

**FRs:** FR110 (Mandatory logo), FR111 (Logo image editor), FR112 (Initials generator), FR113 (Publisher name not personal name)

---

### Story 5.11: Frontend API Client Migration (useApi Hook)

**As a** developer,
**I want** all frontend API calls to use the unified `useApi()` hook,
**So that** authentication headers and response handling are consistent across the application.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Frontend Standards > Unified API Client"
- "Technical Debt Audit > Current Violation Counts"
- "Enforcement Mechanisms"

**Risk Assessment:**
- **Severity:** 🔴 CRITICAL - Auth inconsistencies cause 401 errors and poor UX
- **Current Violations:** 73 raw `fetch()` calls in .tsx files
- **Impact:** Missing auth tokens, inconsistent error handling, duplicated code

**Acceptance Criteria:**

**Given** the codebase has 73 raw `fetch()` calls in .tsx files
**When** Story 5.11 is complete
**Then** all `fetch()` calls use `useApi()` hook instead
**And** running `grep -r "await fetch(" web/app web/components --include="*.tsx"` returns 0 results

**Given** a component makes an authenticated API request
**When** using the `useApi()` hook
**Then** the Authorization header is automatically included
**And** the X-Publisher-Id header is included for publisher routes
**And** response data is automatically unwrapped from `{data: ..., meta: ...}` format

**Given** a component makes a public API request
**When** using `api.public.get()` or similar
**Then** no authentication headers are included
**And** the request succeeds without Clerk token

**Prerequisites:** None (can run in parallel with other Epic 5 stories)

**Technical Notes:**

**Files to Update (73 instances):**
```bash
# Run to get full list:
grep -r "await fetch(" web/app web/components --include="*.tsx"
```

**Migration Pattern:**
```tsx
// BEFORE (violation):
const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const response = await fetch(`${API_BASE}/api/v1/publisher/profile`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Publisher-Id': publisherId,
    'Content-Type': 'application/json'
  }
});
const json = await response.json();
const data = json.data;

// AFTER (compliant):
import { useApi } from '@/lib/api-client';

const api = useApi();
const data = await api.get('/publisher/profile');
// Auth headers and response unwrapping handled automatically
```

**Request Types:**
- `api.get('/endpoint')` - Authenticated with publisher ID
- `api.post('/endpoint', { body: JSON.stringify(data) })` - POST with auth
- `api.public.get('/endpoint')` - No authentication
- `api.admin.get('/endpoint')` - Auth but no publisher ID

**Validation Command:**
```bash
grep -r "await fetch(" web/app web/components --include="*.tsx" | wc -l  # Should be 0
```

**Story Points:** 5

**FRs:** FR114 (Standards enforcement - useApi)

---

### Story 5.12: Backend Structured Logging Migration (slog)

**As a** developer,
**I want** all backend logging to use structured `slog` with context,
**So that** logs are searchable, debuggable, and provide meaningful context for incident response.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Backend Standards > Error Handling"
- "Technical Debt Audit > Current Violation Counts"
- "Exemptions" (api/cmd/ is exempt)

**Risk Assessment:**
- **Severity:** 🟠 HIGH - Unstructured logs slow incident response
- **Current Violations:** ~100 `log.Printf/fmt.Printf` calls in handlers/services
- **Impact:** Missing context in logs, difficult debugging, inconsistent log format

**Acceptance Criteria:**

**Given** the codebase has ~100 `log.Printf/fmt.Printf` calls in handlers/services
**When** Story 5.12 is complete
**Then** all logging uses `slog` with structured context
**And** running `grep -rE "log.Printf|fmt.Printf" api/internal/handlers api/internal/services --include="*.go"` returns 0 results

**Given** an error occurs in a handler
**When** the error is logged
**Then** the log includes: error message, error object, publisher_id, user_id, and operation context
**And** the log level is appropriate (Error for errors, Info for operations, Debug for verbose)

**Given** CLI tools in `api/cmd/`
**When** they use `log.Printf` or `fmt.Printf`
**Then** this is acceptable (exempt from standards)

**Prerequisites:** None (can run in parallel with other Epic 5 stories)

**Technical Notes:**

**Files to Update:**
```bash
# Run to get full list (handlers and services only):
grep -rE "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go"
```

**Migration Pattern:**
```go
// BEFORE (violation):
log.Printf("ERROR [GetPublisherProfile] Query failed: %v (publisherID=%s)", err, publisherID)

// AFTER (compliant):
slog.Error("query failed",
    "error", err,
    "publisher_id", publisherID,
    "user_id", userID,
    "operation", "GetPublisherProfile",
)
```

**Log Levels:**
- `slog.Error()` - Errors that need attention
- `slog.Warn()` - Potential issues, degraded functionality
- `slog.Info()` - Important operations (user actions, state changes)
- `slog.Debug()` - Verbose debugging (disabled in production)

**Context Fields to Include:**
- `error` - The error object (for Error/Warn)
- `publisher_id` - Publisher context
- `user_id` - User context (from Clerk)
- `operation` - Handler/function name
- `request_id` - From middleware if available

**Validation Command:**
```bash
grep -rE "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go" | wc -l  # Should be 0
```

**Story Points:** 3

**FRs:** FR114 (Standards enforcement - slog)

---

### Story 5.13: E2E Test Deterministic Waits Migration

**As a** developer,
**I want** all E2E tests to use deterministic wait strategies,
**So that** tests are reliable, fast, and don't flake in CI.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Testing Standards > E2E Test Pattern"
- "Technical Debt Audit > Current Violation Counts"
- See also `.bmad/bmm/testarch/knowledge/test-quality.md` for detailed patterns

**Risk Assessment:**
- **Severity:** 🟠 HIGH - Flaky tests erode developer confidence and slow CI
- **Current Violations:** 52 `waitForTimeout` hard waits
- **Impact:** Non-deterministic tests, slow CI, false failures

**Acceptance Criteria:**

**Given** the test suite has 52 `waitForTimeout` hard waits
**When** Story 5.13 is complete
**Then** all waits use deterministic strategies
**And** running `grep -r "waitForTimeout" tests/e2e --include="*.ts"` returns 0 results

**Given** a test needs to wait for an API response
**When** the test uses `page.waitForResponse()`
**Then** the test waits only until the response arrives (not arbitrary time)

**Given** a test needs to wait for UI to update
**When** the test uses `expect().toBeVisible()` or `waitForSelector()`
**Then** the test waits only until the element appears (not arbitrary time)

**Prerequisites:** None (can run in parallel with other Epic 5 stories)

**Technical Notes:**

**Files to Update (52 instances):**
```bash
# Run to get full list:
grep -r "waitForTimeout" tests/e2e --include="*.ts"
```

**Migration Patterns:**

```typescript
// BEFORE (violation):
await page.waitForTimeout(1000);

// AFTER - Option 1: Wait for network idle
await page.waitForLoadState('networkidle');

// AFTER - Option 2: Wait for specific API response
await page.waitForResponse(resp =>
  resp.url().includes('/api/v1/publisher') && resp.status() === 200
);

// AFTER - Option 3: Wait for element visibility
await expect(page.getByText('Dashboard')).toBeVisible();

// AFTER - Option 4: Wait for element state
await page.getByRole('button', { name: 'Save' }).waitFor({ state: 'visible' });
```

**Utility Functions Available:**
See `tests/e2e/utils/wait-helpers.ts` for existing helpers.

**Decision Guide:**
| Scenario | Use This |
|----------|----------|
| After navigation | `waitForLoadState('networkidle')` |
| After form submit | `waitForResponse(/api\/endpoint/)` |
| After click/action | `expect(element).toBeVisible()` |
| After state change | `waitFor({ state: 'visible' })` |

**Validation Command:**
```bash
grep -r "waitForTimeout" tests/e2e --include="*.ts" | wc -l  # Should be 0
```

**Story Points:** 5

**FRs:** FR115 (Technical debt reduction - deterministic waits)

---

### Story 5.14: E2E Test Parallel Mode Configuration

**As a** developer,
**I want** all E2E test files to have parallel mode configured,
**So that** tests run faster in CI and are guaranteed to be isolated.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Testing Standards > E2E Test Pattern"
- "Technical Debt Audit > Current Violation Counts"

**Risk Assessment:**
- **Severity:** 🟡 MEDIUM - Slower CI and potential state pollution
- **Current Violations:** 23/29 test files missing parallel mode
- **Impact:** Slower CI pipeline, tests may have hidden dependencies

**Acceptance Criteria:**

**Given** only 6/29 test files have parallel mode configured
**When** Story 5.14 is complete
**Then** all spec files include `test.describe.configure({ mode: 'parallel' })`
**And** all tests pass when run with `--workers=4`

**Given** a test file has parallel mode enabled
**When** tests in that file run
**Then** each test is isolated and doesn't depend on other tests' state
**And** tests can run in any order

**Prerequisites:** Story 5.13 (deterministic waits must be fixed first to ensure parallel safety)

**Technical Notes:**

**Files Missing Parallel Mode (23 files):**
```bash
# Files that HAVE parallel mode (6):
tests/e2e/publisher/coverage.spec.ts
tests/e2e/publisher/team.spec.ts
tests/e2e/public/public-pages.spec.ts
tests/e2e/publisher/algorithm-editor.spec.ts
tests/e2e/publisher/onboarding.spec.ts
tests/e2e/auth/authentication.spec.ts

# All other spec files need parallel mode added
```

**Migration Pattern:**
```typescript
// Add at the top of each describe block:
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.describe.configure({ mode: 'parallel' });  // ADD THIS LINE

  test('should do something', async ({ page }) => {
    // ...
  });
});
```

**Parallel Safety Checklist:**
- [ ] Tests don't share mutable state
- [ ] Tests use unique data (faker or unique IDs)
- [ ] Tests clean up after themselves
- [ ] Tests don't depend on execution order

**Validation Commands:**
```bash
# Verify all spec files have parallel mode
for f in tests/e2e/**/*.spec.ts; do
  grep -q "mode: 'parallel'" "$f" || echo "Missing: $f"
done

# Run tests in parallel to verify
npx playwright test --workers=4
```

**Story Points:** 2

**FRs:** FR115 (Technical debt reduction - parallel tests)

---

### Story 5.15: Backend API Response Standardization

**As a** developer,
**I want** all API handlers to use consistent response formatting,
**So that** frontend can rely on predictable response structures.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Structure"
- "Backend Standards > Response Format"
- "Technical Debt Audit > Current Violation Counts"

**Risk Assessment:**
- **Severity:** 🟡 MEDIUM - Inconsistent API contracts cause frontend bugs
- **Current Violations:** ~80 handlers double-wrap responses
- **Impact:** Frontend must handle both `data.publishers` and `data.data.publishers`

**Acceptance Criteria:**

**Given** ~80 handlers double-wrap API responses
**When** Story 5.15 is complete
**Then** handlers pass data directly to `RespondJSON()`
**And** frontend receives consistent `{data: ..., meta: ...}` structure

**Given** a handler returns a list of items
**When** `RespondJSON()` is called
**Then** the response is `{data: [...items], meta: {...}}`
**And** NOT `{data: {items: [...items]}, meta: {...}}`

**Given** frontend code expects `response.data.publishers`
**When** the API returns publishers
**Then** the data is at `response.publishers` (after useApi unwrapping)
**And** NOT at `response.data.publishers`

**Prerequisites:** Story 5.11 (frontend must use useApi which handles unwrapping)

**Technical Notes:**

**Files to Update (~80 instances):**
```bash
# Run to find double-wrapped responses:
grep -r "RespondJSON.*map\[string\]interface{}" api/internal/handlers --include="*.go"
```

**Migration Pattern:**
```go
// BEFORE (double-wrapped):
RespondJSON(w, r, http.StatusOK, map[string]interface{}{
    "publishers": publishers,
    "total":      len(publishers),
})

// AFTER (correct):
type PublishersResponse struct {
    Publishers []Publisher `json:"publishers"`
    Total      int         `json:"total"`
}
RespondJSON(w, r, http.StatusOK, PublishersResponse{
    Publishers: publishers,
    Total:      len(publishers),
})

// Or for simple cases:
RespondJSON(w, r, http.StatusOK, publishers)
```

**Response Structure After Fix:**
```json
{
  "data": {
    "publishers": [...],
    "total": 10
  },
  "meta": {
    "timestamp": "2025-12-02T10:30:00Z",
    "request_id": "uuid"
  }
}
```

**Frontend After useApi Unwrapping:**
```typescript
const result = await api.get('/publishers');
// result = { publishers: [...], total: 10 }
// NOT: result = { data: { publishers: [...] } }
```

**Validation:**
- Run frontend and verify no `data.data` access patterns needed
- Check network tab for consistent response structures

**Story Points:** 3

**FRs:** FR115 (Technical debt reduction - API consistency)

---

### Story 5.16: CI/CD Quality Gates and Pre-commit Hooks

**As a** developer,
**I want** automated enforcement of coding standards,
**So that** violations are caught before they enter the codebase.

**Standards Reference:** See `docs/coding-standards.md` sections:
- "Enforcement Mechanisms"
- "Pre-commit Hooks (Recommended)"
- "CI Linting (Required for PRs)"

**Risk Assessment:**
- **Severity:** 🟡 MEDIUM - Without enforcement, standards drift over time
- **Current State:** No pre-commit hooks, no CI standards check
- **Impact:** Technical debt accumulates silently

**Acceptance Criteria:**

**Given** no pre-commit hooks exist for standards enforcement
**When** Story 5.16 is complete
**Then** husky pre-commit hooks block commits with violations

**Given** a developer commits code with raw `fetch()` calls
**When** the pre-commit hook runs
**Then** the commit is blocked with a clear error message
**And** the developer is directed to use `useApi()` instead

**Given** a PR is opened with coding standard violations
**When** CI runs
**Then** the standards check step fails
**And** the PR cannot be merged until violations are fixed

**Prerequisites:** Stories 5.11-5.15 (existing violations must be fixed first)

**Technical Notes:**

**Pre-commit Hook Setup:**
```bash
# Install husky
cd web && npm install husky --save-dev
npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh

echo "🔍 Checking coding standards..."

# Block raw fetch in components
if grep -rq "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null; then
  echo "❌ ERROR: Raw fetch() found in components."
  echo "   Use useApi() hook instead. See docs/coding-standards.md"
  exit 1
fi

# Block log.Printf in handlers (allow cmd/)
if grep -rEq "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null; then
  echo "❌ ERROR: log.Printf found in handlers/services."
  echo "   Use slog instead. See docs/coding-standards.md"
  exit 1
fi

# Block waitForTimeout in tests
if grep -rq "waitForTimeout" tests/e2e --include="*.ts" 2>/dev/null; then
  echo "❌ ERROR: waitForTimeout found in tests."
  echo "   Use deterministic waits. See docs/coding-standards.md"
  exit 1
fi

echo "✅ Coding standards check passed"
EOF
chmod +x .husky/pre-commit
```

**CI GitHub Action Step:**
```yaml
# Add to .github/workflows/ci.yml
- name: Coding Standards Check
  run: |
    echo "🔍 Checking coding standards..."

    FETCH_COUNT=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | wc -l)
    if [ "$FETCH_COUNT" -gt 0 ]; then
      echo "::error::Found $FETCH_COUNT raw fetch() calls. Use useApi() hook."
      exit 1
    fi

    LOG_COUNT=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
    if [ "$LOG_COUNT" -gt 0 ]; then
      echo "::error::Found $LOG_COUNT log.Printf calls. Use slog instead."
      exit 1
    fi

    WAIT_COUNT=$(grep -r "waitForTimeout" tests/e2e --include="*.ts" 2>/dev/null | wc -l)
    if [ "$WAIT_COUNT" -gt 0 ]; then
      echo "::error::Found $WAIT_COUNT waitForTimeout calls. Use deterministic waits."
      exit 1
    fi

    echo "✅ All standards checks passed"
```

**Validation:**
```bash
# Test pre-commit hook
echo "await fetch(" > test.tsx
git add test.tsx
git commit -m "test"  # Should fail
rm test.tsx

# Test CI locally
act -j lint  # If using act for local CI testing
```

**Story Points:** 2

**FRs:** FR116 (CI quality gates and pre-commit hooks)

---

## Epic 5 FR Coverage Matrix

| FR | Description | Story |
|----|-------------|-------|
| FR96 | Human-friendly validation error messages | 5.1 |
| FR97 | Contextual inline tooltips | 5.2 |
| FR98 | Smart placeholders with real examples | 5.3 |
| FR99 | Publisher zman custom naming | 5.4, 5.5 |
| FR100 | Canonical name always visible | 5.4, 5.5 |
| FR101 | Request new zman feature | 5.6, 5.7 |
| FR102 | Guided tag selection with new tag requests | 5.6, 5.7 |
| FR103 | Optional formula with validation | 5.6, 5.7 |
| FR104 | Email notifications (submit, to admin) | 5.6 |
| FR105 | Admin zman request review page | 5.8 |
| FR106 | Approval workflow with auto-add | 5.8 |
| FR107 | Rejection with reason | 5.8 |
| FR108 | Email notifications (approve/reject) | 5.8 |
| FR109 | Reference panel contextual highlighting | 5.9 |
| FR110 | Mandatory publisher logo | 5.10 |
| FR111 | Logo image editor with crop/zoom | 5.10 |
| FR112 | Generate logo from initials | 5.10 |
| FR113 | Publisher name (not personal name) enforcement | 5.10 |
| FR114 | Frontend useApi() hook migration | 5.11 |
| FR115 | Backend slog structured logging | 5.12 |
| FR116 | E2E deterministic waits | 5.13 |
| FR117 | E2E parallel mode configuration | 5.14 |
| FR118 | Backend API response standardization | 5.15 |
| FR119 | CI quality gates and pre-commit hooks | 5.16 |
| FR120 | Remove organization field, mandatory logo with AI generation | 5.17 |
| FR121 | Publisher owns copy of description, transliteration, formula with diff/revert | 5.18 |
| FR122 | Linked zmanim non-editable (edit button disabled) | 5.18 |
| FR123 | Unified zman review form (same as Add to Registry) | 5.19 |
| FR124 | Tag approval pipeline before zman approval | 5.19 |
| FR125 | Email notifications on request approval/rejection | 5.19 |

---

### Story 5.17: Publisher Schema Refactor - Remove Organization, Mandatory Logo with AI Generation

**As a** platform user,
**I want** publisher profiles to be simplified (publisher IS the organization) with mandatory logos that can be AI-generated,
**So that** the data model is cleaner and all publishers have professional visual identity.

**Acceptance Criteria:**

**Given** the publishers table has an organization column
**When** Story 5.17 is complete
**Then** the organization column is removed from publishers and publisher_requests tables

**Given** a publisher is creating or editing their profile
**When** they submit the form without a logo
**Then** validation fails and they must provide a logo

**Given** a publisher doesn't have a logo image
**When** they click "Generate Logo"
**Then** a professional logo is generated from their publisher name initials
**And** they can customize the background color

**Given** frontend forms show organization field
**When** Story 5.17 is complete
**Then** organization field is removed from all publisher forms and displays

**Prerequisites:** None (can run in parallel with other Epic 5 stories)

**Technical Notes:**
- Create migration `00000000000026_remove_organization_mandatory_logo.sql`
- Update all SQLc queries and regenerate
- Create `web/components/publisher/LogoGenerator.tsx` with canvas-based initials logo
- Update all publisher-related frontend pages and components
- Add backend validation for required logo_url

**FRs:** FR120

---

### Story 5.18: Publisher Zman Field Ownership - Description, Transliteration, Formula Diff/Revert

**As a** publisher,
**I want** my own editable copy of description, transliteration, and formula when I add a zman from the registry, with clear indication when my values differ from the source and easy one-click revert,
**So that** I can customize these fields for my community while maintaining visibility into registry changes.

**Acceptance Criteria:**

**Given** a publisher adds a zman from the registry
**When** the zman is created
**Then** description, transliteration, and formula are copied as the publisher's own values
**And** the original registry values are tracked for comparison

**Given** a publisher edits their copy of these fields
**When** the value differs from the registry
**Then** an amber "Modified" indicator appears
**And** a revert button allows one-click restoration to registry value

**Given** a zman is linked to another publisher (`source_type = 'linked'`)
**When** the publisher views the zman
**Then** the edit button is disabled with tooltip "Linked zmanim cannot be edited"
**And** the edit page shows all fields as read-only (except toggles)

**Prerequisites:** 5.0 (Database Schema)

**Technical Notes:**
- Extend pattern from `BilingualInput` (already handles names)
- Add `transliteration` and `description` columns to `publisher_zmanim`
- Return `source_*` fields from SQLc queries
- Create `DescriptionInput` and `FormulaSourceIndicator` components
- Disable edit button in `ZmanCard` for linked zmanim

**FRs:** FR121, FR122

---

### Story 5.19: Zman Request Review Workflow - Unified Edit/Review with Tag Approval Pipeline

**As an** admin,
**I want** to review zman requests using the same form as "Add to Registry" with approve/reject buttons, process new tag requests before the zman can be approved, and automatically email publishers about outcomes,
**So that** I can efficiently review requests with full editing capability, ensure tag quality, and keep publishers informed.

**Acceptance Criteria:**

**Given** an admin opens a zman request for review
**When** the review dialog opens
**Then** the same form as "Add to Registry" is shown with the request data pre-filled
**And** Approve/Reject buttons replace the Save button

**Given** a zman request includes new tag requests
**When** the admin views the request
**Then** pending tag requests are shown above the form
**And** the Approve button is disabled until all tags are approved/rejected

**Given** an admin approves a tag request
**When** they click Approve on a tag
**Then** the tag is created in the registry
**And** the tag is automatically linked to the zman request

**Given** an admin approves a zman request
**When** approval completes
**Then** the zman is added to the master registry
**And** an approval email is sent to the publisher
**And** if auto_add_on_approval is true, the zman is added to the publisher's list

**Prerequisites:** 5.8 (Admin Review Page)

**Technical Notes:**
- Extract form from registry page into `ZmanRegistryForm` component
- Add mode prop: 'create' | 'edit' | 'review'
- New endpoints: `/admin/zman-requests/:id/tags/:tagId/approve|reject`
- Use existing email service or create transactional email helper

**FRs:** FR123, FR124, FR125

---

## Epic 5 Dependency Chain

```
5.0 Database Schema (foundation)
 ├── 5.1 Human Error Messages
 │    └── 5.2 Contextual Tooltips
 │         └── 5.3 Smart Placeholders
 │              └── 5.9 Reference Panel Enhancements
 ├── 5.4 Alias API
 │    └── 5.5 Alias UI
 ├── 5.6 Request API & Email
 │    └── 5.7 Request UI
 │         └── 5.8 Admin Review Page
 │              └── 5.19 Zman Request Review Workflow (unified form, tag pipeline, email)
 ├── 5.10 Publisher Logo Editor (parallel track)
 ├── 5.17 Publisher Schema Refactor (parallel track - remove org, mandatory logo, AI generation)
 ├── 5.18 Publisher Zman Field Ownership (parallel track - extends edit page with diff/revert)
 │
 └── Technical Debt Track (parallel - no feature dependencies)
      ├── 5.11 Frontend useApi Migration (73 violations)
      ├── 5.12 Backend slog Migration (~100 violations)
      ├── 5.13 E2E Deterministic Waits (52 violations)
      │    └── 5.14 E2E Parallel Mode (depends on 5.13)
      ├── 5.15 API Response Standardization (~80 violations)
      │    └── (depends on 5.11 for frontend compatibility)
      └── 5.16 CI Quality Gates (depends on 5.11-5.15)
```

---

## Epic 5 Summary

**Epic 5: DSL Editor Experience & Zman Management**
- **Stories:** 20 (5.0-5.19)
- **FRs Covered:** FR96-FR125 (30 FRs)
- **Story Points:** 71 total
  - Feature Track: 51 points (5.0-5.10, 5.17-5.19)
  - Technical Debt Track: 20 points (5.11-5.16)
- **Sequence:** Schema → Error Messages → Tooltips → Placeholders → Aliases → Requests → Admin → Logo Editor → Schema Refactor
- **Parallel Track:** Technical Debt (5.11-5.16) can run alongside feature work

**Technical Debt Stories (NEW):**

| Story | Focus | Violations | Points | Standards Reference |
|-------|-------|------------|--------|---------------------|
| 5.11 | Frontend useApi() | 73 | 5 | Frontend Standards |
| 5.12 | Backend slog | ~100 | 3 | Backend Standards |
| 5.13 | E2E Deterministic Waits | 52 | 5 | Testing Standards |
| 5.14 | E2E Parallel Mode | 23 files | 2 | Testing Standards |
| 5.15 | API Response Format | ~80 | 3 | Backend Standards |
| 5.16 | CI Quality Gates | - | 2 | Enforcement Mechanisms |
| 5.17 | Publisher Schema Refactor | Remove org, mandatory logo | 5 | Data Model |
| 5.18 | Publisher Zman Field Ownership | Desc, transliteration, formula diff/revert | 8 | Edit UX |
| 5.19 | Zman Request Review Workflow | Unified form, tag pipeline, email | 13 | Admin UX |

**After Epic 5 Completion:**
- Non-technical publishers can write formulas with zero confusion (< 30 seconds to valid formula)
- Publishers can customize zman names, descriptions, transliterations, and formulas with registry sync
- Publishers see clear "Different from Registry" indicators with one-click sync buttons
- Publishers can request new zmanim with guided tag selection
- Admins can efficiently review and approve zman requests with full editing capability
- Tag requests are approved before zman requests (quality gate)
- Publishers receive email notifications on approval/rejection
- The platform becomes community-driven with publisher contributions
- All publishers have professional logos (mandatory with crop/zoom editor or initials generator)
- Publisher names are organization names, not personal names
- **Publisher = Organization** (organization field removed, cleaner data model)
- **All publishers have logos** (mandatory with AI initials generator)
- **Codebase follows established standards** (0 violations across all categories)
- **All API calls use unified useApi() hook** (consistent auth and response handling)
- **All logging uses structured slog** (searchable, contextual logs)
- **Test suite is deterministic** (no hard waits, all tests parallel-safe)
- **CI enforces standards** (pre-commit hooks and pipeline checks block violations)

**Standards Reference:**
All technical debt stories reference `docs/coding-standards.md` for:
- Specific violation patterns and migration examples
- Validation commands to verify compliance
- Exemptions (api/cmd/ for logging, sqlcgen/ for generated code)

---

_Generated by BMAD Epic Workflow v1.0_
_Last Updated: 2025-12-02 (Test Architect - Technical Debt Stories Added)_
