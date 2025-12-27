# zmanim - Product Requirements Document

**Author:** BMad
**Date:** 2025-11-25
**Version:** 1.0

---

## Executive Summary

Shtetl Zmanim is a multi-publisher platform that empowers halachic (Jewish legal) authorities to publish customized Zmanim (zmanim) with complete control over calculation algorithms and geographic coverage. The platform transforms a proof-of-concept into a fully functional, tested application that serves both publishers (rabbinic authorities) and end users (community members seeking accurate zmanim).

The core mission is democratizing zmanim publishing: any qualified halachic authority should be able to publish their calculation methods without needing technical expertise, while end users gain transparency into exactly how their Zmanim are calculated.

### What Makes This Special

**Two-sided transparency that doesn't exist elsewhere:**

1. **For Publishers (Halachic Authorities):** The friendliest interface to configure zmanim algorithms. No JSON editing, no coding - just intuitive controls with sensible defaults. A rabbi can define their preferred calculation methods through a visual UI and immediately see the results.

2. **For End Users:** Complete transparency into the halachic reasoning. When viewing zmanim times, users can reveal the exact formula behind each time - seeing the solar angle, minute offset, or proportional hour method used. This creates accountability and education, connecting users to the halachic sources their times are based on.

**This is not just another zmanim app** - it's a publishing platform that brings authority-specific accuracy and halachic transparency to communities worldwide.

---

## Project Classification

**Technical Type:** SaaS B2B Platform (Multi-tenant with publisher management)
**Domain:** Religious/Community Technology
**Complexity:** Low (no regulatory requirements)

This is a brownfield project transforming an existing POC into a production-ready MVP. The technical foundation exists (Go backend, Next.js frontend, PostgreSQL database with PostGIS) but requires:
- End-to-end functionality completion
- Clerk authentication integration
- Comprehensive testing
- Publisher-friendly algorithm configuration UI
- Production deployment verification

**Project Context:**
- Existing codebase with documented architecture
- Backend deployed to Fly.io, frontend targeting Vercel
- Database schema designed but application never fully operational
- Authentication planned (Clerk) but not integrated

---

## Success Criteria

Success for Shtetl Zmanim MVP is defined by these concrete outcomes:

**Publisher Success:**
- A halachic authority can configure their complete zmanim algorithm through the UI without any technical assistance
- Publishers can define geographic coverage areas and see them visualized on a map
- Publishers can preview their calculated times before going live
- At least 3 publishers actively using the platform with live zmanim

**End User Success:**
- Users can find relevant publishers for any location with Jewish communities
- Zmanim calculations load in under 2 seconds
- Users can reveal and understand the formula behind each time
- Zero calculation errors reported (times match expected values)

**Technical Success:**
- End-to-end authentication flow works with Clerk
- All API endpoints function correctly with proper error handling
- Test coverage exceeds 80% for critical calculation paths
- Production deployment stable on Fly.io + Vercel

**The "It Works" Moment:**
A rabbi in Brooklyn can log into the admin portal, configure their preferred Alos calculation (16.1 degrees), set their coverage area to the NYC metro region, and within minutes their community members can look up zmanim and see exactly which method their rabbi uses.

---

## Product Scope

### MVP - Minimum Viable Product

**Core Publisher Features:**
- Admin-created publisher accounts (manual onboarding)
- Visual algorithm configuration UI with preset defaults
- Support for all standard zmanim calculation methods:
  - Solar angle-based (Alos, Tzeis with configurable degrees)
  - Fixed minute offsets (72 minutes, etc.)
  - Proportional hours (Shaos Zmaniyos - GRA, MGA methods)
- Geographic coverage area definition with map visualization
- Algorithm preview/testing before publishing
- Publisher profile management (name, organization, contact, logo)

**Core End User Features:**
- Location selection (search or geolocation)
- View publishers available for selected location
- Select publisher and view zmanim times
- Reveal formula behind each zmanim time
- Date selection for future/past dates

**Authentication & Admin:**
- Clerk authentication integration
- Admin portal for publisher account creation
- Publisher verification workflow
- Basic role-based access (admin, publisher, user)

**Technical Foundation:**
- Working Go backend with all API endpoints
- Responsive Next.js frontend
- PostgreSQL database with PostGIS queries
- 24-hour calculation caching
- Comprehensive test suite

### Growth Features (Post-MVP)

- Publisher self-registration with verification queue
- User accounts with saved preferences and favorite publishers
- Push notifications for candle lighting times
- Hebrew calendar integration and Jewish holiday awareness
- Multiple algorithms per publisher (seasonal variations)
- Publisher analytics dashboard
- API access for third-party integrations
- Offline support / PWA capabilities
- Comparison view (multiple publishers side-by-side)
- Shul/synagogue integration (custom locations)

### Vision (Future)

- Mobile apps (iOS/Android) with widgets
- Smart home integrations (Shabbat mode triggers)
- Community features (local minyan times, shiur schedules)
- Publisher federation (multiple authorities endorsing same calculations)
- Historical zmanim archive for research
- Embeddable widgets for synagogue websites
- Multi-language support (Hebrew, Yiddish, Spanish, French)
- Accessibility features for visually impaired users

---

## SaaS Platform Requirements

### Multi-Tenant Architecture

**Publisher Isolation:**
- Each publisher's algorithms and coverage areas are fully isolated
- Publishers can only view and edit their own data
- Shared infrastructure with logical data separation

**Admin Capabilities:**
- Create and manage publisher accounts
- Verify publisher credentials
- Monitor platform health and usage
- Suspend/reactivate publishers if needed

### Permission Model

| Role | Capabilities |
|------|--------------|
| **Admin** | Full platform access, publisher management, system configuration |
| **Publisher** | Manage own algorithms, coverage areas, profile; view own analytics |
| **User** | Search locations, view publishers, calculate zmanim, reveal formulas |
| **Anonymous** | Limited zmanim calculations (rate-limited) |

### Algorithm Configuration System

Publishers configure algorithms through a structured UI that generates the underlying JSON formula:

**Supported Calculation Methods:**
1. **Solar Angle** - Configure degrees below horizon (e.g., 16.1°, 18°, 19.8°)
2. **Fixed Minutes** - Offset from sunrise/sunset (e.g., 72 minutes before)
3. **Proportional Hours (Shaos Zmaniyos)** - Fraction of halachic day
4. **Midpoint** - Between two other zmanim (e.g., Chatzos)

**Pre-configured Defaults:**
- Standard GRA method
- Magen Avraham method
- Rabbeinu Tam (72 minutes)
- Common Israeli customs
- Common US customs

**Configurable Zmanim:**
| Zman | Default Method | Configurable |
|------|---------------|--------------|
| Alos Hashachar | 16.1° | Yes - angle or minutes |
| Misheyakir | 11.5° | Yes |
| Sunrise | Elevation-adjusted | No |
| Sof Zman Shma | 3 shaos zmaniyos | Yes - GRA/MGA |
| Sof Zman Tefillah | 4 shaos zmaniyos | Yes - GRA/MGA |
| Chatzos | Solar noon | No |
| Mincha Gedola | 30 min after Chatzos | Yes |
| Mincha Ketana | 9.5 shaos zmaniyos | Yes |
| Plag HaMincha | 10.75 shaos zmaniyos | Yes |
| Sunset | Elevation-adjusted | No |
| Tzeis Hakochavim | 8.5° | Yes - angle or minutes |
| Tzeis (Rabbeinu Tam) | 72 minutes | Yes |

---

## User Experience Principles

### Design Philosophy

**"Invisible Complexity"** - The sophisticated astronomical calculations and halachic logic happen behind the scenes. Users interact with simple, intuitive controls that feel effortless.

**Visual Personality:**
- Clean, modern interface inspired by Apple's design language
- High contrast for outdoor readability (checking times on the go)
- Respectful, understated aesthetic appropriate for religious content
- Clear typography optimized for time display

**Core UX Principles:**

1. **Location First** - Everything starts with where you are. Location selection is prominent and fast.

2. **Progressive Disclosure** - Show times simply, reveal complexity on demand. Formula details are one tap away but don't clutter the default view.

3. **Trust Through Transparency** - Every time shown can be traced back to its calculation method. This builds user confidence and honors halachic accountability.

4. **Publisher Identity** - Publishers are not anonymous data sources. Their name, organization, and credentials are clearly displayed, connecting users to trusted authorities.

5. **Instant Feedback** - For publishers configuring algorithms, show real-time preview of calculated times as they adjust parameters.

### Key Interactions

**End User Flow:**
```
Select Location → See Available Publishers → Choose Publisher → View Zmanim
                                                                    ↓
                                                            Tap any time
                                                                    ↓
                                                         Reveal Formula
```

**Publisher Configuration Flow:**
```
Login → Dashboard → Edit Algorithm → Select Zman → Choose Method → Set Parameters
                                                                        ↓
                                                              See Live Preview
                                                                        ↓
                                                                Save & Publish
```

**Formula Reveal Interaction:**
- User taps/clicks on any zmanim time
- Slide-up panel shows:
  - Calculation method name (e.g., "Solar Depression Angle")
  - Specific parameters (e.g., "16.1 degrees below horizon")
  - Brief halachic context (e.g., "Based on Shulchan Aruch...")
  - Link to publisher's full methodology documentation (if provided)

---

## Functional Requirements

### User Management

- **FR1:** Admins can create publisher accounts with email, name, and organization
- **FR2:** Publishers can log in via Clerk authentication
- **FR3:** Publishers can update their profile information (name, organization, website, logo, contact)
- **FR4:** Admins can verify, suspend, or reactivate publisher accounts
- **FR5:** End users can use the platform without authentication (anonymous access)
- **FR6:** Authenticated users receive higher API rate limits

### Algorithm Management

- **FR7:** Publishers can create new calculation algorithms with name and description
- **FR8:** Publishers can configure each zmanim type using supported calculation methods
- **FR9:** Publishers can choose from pre-configured algorithm templates as starting points
- **FR10:** Publishers can preview calculated times for any date/location while configuring
- **FR11:** Publishers can save algorithms as draft before publishing
- **FR12:** Publishers can publish algorithms to make them active
- **FR13:** Publishers can update published algorithms (creates new version)
- **FR14:** Publishers can deprecate old algorithm versions
- **FR15:** System validates algorithm configurations before allowing publish

### Coverage Area Management

- **FR16:** Publishers can define geographic coverage areas using polygon boundaries
- **FR17:** Publishers can view coverage areas on an interactive map
- **FR18:** Publishers can set priority levels for overlapping coverage areas
- **FR19:** Publishers can name and describe each coverage area
- **FR20:** Publishers can activate/deactivate coverage areas

### Location & Publisher Discovery

- **FR21:** Users can search for locations by name (city, neighborhood)
- **FR22:** Users can use browser geolocation to detect current position
- **FR23:** System displays all publishers covering the selected location
- **FR24:** Publishers are sorted by coverage priority and distance
- **FR25:** Users can view publisher profile information before selecting

### Zmanim Calculation & Display

- **FR26:** Users can select a publisher to view their zmanim calculations
- **FR27:** System calculates zmanim using the publisher's active algorithm
- **FR28:** Users can select any date to view zmanim (past and future)
- **FR29:** Calculated times display in local timezone with clear formatting
- **FR30:** Users can reveal the calculation formula for any individual zman
- **FR31:** Formula reveal shows method type, parameters, and brief explanation
- **FR32:** System caches calculations for 24 hours to improve performance
- **FR33:** Cache is invalidated when publisher updates their algorithm

### Admin Portal

- **FR34:** Admins can view list of all publishers with status
- **FR35:** Admins can create new publisher accounts
- **FR36:** Admins can verify pending publisher accounts
- **FR37:** Admins can view platform usage statistics
- **FR38:** Admins can manage system configuration

### API

- **FR39:** REST API provides endpoints for all frontend functionality
- **FR40:** API returns appropriate error messages for invalid requests
- **FR41:** API enforces rate limiting based on authentication status
- **FR42:** API supports CORS for frontend domain

---

## Non-Functional Requirements

### Performance

- **NFR1:** Zmanim calculation API responds within 500ms (p95)
- **NFR2:** Cached calculations return within 100ms (p95)
- **NFR3:** Frontend initial page load under 3 seconds on 3G
- **NFR4:** Location search returns results within 300ms
- **NFR5:** Publisher list loads within 500ms

### Security

- **NFR6:** All authentication handled through Clerk with secure session management
- **NFR7:** API endpoints enforce role-based access control
- **NFR8:** Publisher can only access their own data (tenant isolation)
- **NFR9:** All traffic encrypted via HTTPS/TLS
- **NFR10:** No sensitive data logged or exposed in error messages
- **NFR11:** SQL injection prevented through parameterized queries
- **NFR12:** XSS prevented through proper output encoding

### Reliability

- **NFR13:** System maintains 99.5% uptime
- **NFR14:** Database backups performed daily
- **NFR15:** Graceful degradation when cache unavailable
- **NFR16:** Clear error messages when services unavailable

### Scalability

- **NFR17:** System handles 1000 concurrent users
- **NFR18:** Database schema supports unlimited publishers
- **NFR19:** Caching strategy reduces database load by 80%+

### Testing

- **NFR20:** Unit test coverage exceeds 80% for calculation logic
- **NFR21:** Integration tests cover all API endpoints
- **NFR22:** E2E tests cover critical user flows
- **NFR23:** Calculation accuracy validated against known reference values

### Maintainability

- **NFR24:** Code follows established patterns in existing codebase
- **NFR25:** API documented with request/response examples
- **NFR26:** Environment configuration via environment variables
- **NFR27:** Deployment automated via CI/CD

---

## Technical Constraints

**Existing Technology Decisions (Must Use):**
- Backend: Go with Chi router
- Frontend: Next.js with React
- Database: PostgreSQL (PostgreSQL + PostGIS)
- Authentication: Clerk
- Backend Hosting: Fly.io
- Frontend Hosting: Vercel
- Zmanim Library: kosher-zmanim (TypeScript)

**Integration Requirements:**
- Backend must integrate with Clerk for JWT validation
- Frontend must use Clerk React components for auth UI
- PostGIS queries required for geographic coverage matching

---

## PRD Summary

| Metric | Value |
|--------|-------|
| Functional Requirements | 42 |
| Non-Functional Requirements | 27 |
| MVP Features | Core publisher config, end user zmanim lookup, auth |
| Target Users | Halachic authorities (publishers), Jewish community members (users) |

### Product Value Summary

Shtetl Zmanim democratizes halachic time publishing by giving any qualified authority the tools to share their zmanim calculations, while giving end users unprecedented transparency into how their Zmanim are determined. It's the bridge between halachic expertise and modern technology.

---

_Created through collaborative discovery between BMad and AI facilitator._
_Generated: 2025-11-25_
