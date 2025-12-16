# Shtetl Zmanim Business Documentation

This folder contains comprehensive, easily readable business documentation for the Shtetl Zmanim project. These documents are designed to explain what Shtetl Zmanim is, why it exists, what problems it solves, and provide an exhaustive breakdown of all features and technical architecture.

---

## Documents in This Folder

### 1. [What is Shtetl Zmanim?](01-what-is-zmanim.md)
**Purpose:** High-level overview of the platform
**Contents:**
- What Shtetl Zmanim is (the big picture)
- Why it exists (core mission)
- Problems it solves (for publishers and end users)
- Who it's for (publishers, end users, admins)
- How it works (user journeys)
- Key differentiators
- Success metrics
- Future vision

**Read this first** if you want to understand the platform's vision and value proposition.

---

### 2. [Comprehensive Features List](02-features-comprehensive-list.md)
**Purpose:** Exhaustive breakdown of all features
**Contents:**
- **End User Features** (30+)
  - Location discovery &selection
  - Publisher discovery
  - Zmanim viewing & display
  - User convenience features
- **Publisher Features** (60+)
  - Account management
  - Algorithm/zman management
  - Guided mode, advanced mode, AI mode
  - Hebrew & bilingual naming
  - Field ownership & registry sync
  - Preview & testing
  - Publishing & versioning
  - Import & collaboration
  - Coverage management
  - Analytics & activity
  - Team management
  - Onboarding wizard
  - Request new zman
- **Admin Features** (25+)
  - Publisher management
  - User management
  - Zman registry management
  - System management
- **Platform Features** (20+)
  - Security & authentication
  - Performance
  - API endpoints
  - Email notifications
  - Error handling

**Total: 135+ distinct features across 113 stories in 5 completed epics**

**Read this** if you want to understand everything Shtetl Zmanim can do.

---

### 3. [Technical Architecture Overview](03-technical-architecture.md)
**Purpose:** High-level technical explanation for non-engineers
**Contents:**
- **System Architecture** (frontend, backend, data layer)
- **Technology Stack** (Next.js, Go, PostgreSQL, Redis, Clerk, AI services)
- **Core Systems:**
  - Zmanim calculation engine
  - Geographic matching system
  - Algorithm DSL (Domain Specific Language)
  - AI-powered formula generation
  - Hebrew calendar integration
- **Data Models & Database Schema** (all tables explained)
- **API Architecture** (endpoints, auth flow, rate limiting)
- **Hosting & Infrastructure** (Vercel, Fly.io, PostgreSQL, Upstash)
- **Security Measures**
- **Performance Optimizations**
- **Testing Strategy**
- **Development Workflow**
- **Scalability**

**Read this** if you want to understand how Shtetl Zmanim works under the hood (written for business stakeholders).

---

## Quick Navigation Guide

**If you want to know...**

- **What Shtetl Zmanim is and why it exists** → Read document #1
- **What specific features are available** → Read document #2
- **How it works technically** → Read document #3
- **Everything in depth** → Read all three in order

---

## Document Generation

These documents were generated through comprehensive analysis of:

✅ **All code across the entire project:**
- Frontend (180+ React components, pages, shared components)
- Backend (27 API handler files, 17 internal service directories)
- Database (31 migrations, all tables and schemas)

✅ **All documentation (89 markdown files):**
- PRD (Product Requirements Document)
- Architecture documentation
- Data models
- 5 Epics (113 stories total)
- Sprint artifacts
- Technical specifications
- Implementation plans

✅ **Epic breakdown:**
- **Epic 1:** Shtetl Zmanim MVP (11 stories, FR1-FR42) - COMPLETED
- **Epic 2:** Publisher User Management (13 stories, FR43-FR66) - COMPLETED
- **Epic 3:** Consolidation & Quality (5 stories, Internal QA) - COMPLETED
- **Epic 4:** Algorithm Editor + AI (14 stories, FR67-FR95+) - COMPLETED
- **Epic 5:** DSL Editor Experience & Zman Management (20 stories, FR96-FR125) - COMPLETED

**Total coverage: 113 stories, 125+ functional requirements, 135+ distinct features**

---

## For Further Technical Detail

These business docs are complementary to the existing technical documentation in `/docs`:

- **`/docs/README.md`** - Developer guide
- **`/docs/ARCHITECTURE.md`** - Detailed system architecture
- **`/docs/prd.md`** - Full product requirements
- **`/docs/data-models.md`** - Database schema specifications
- **`/docs/epics.md`** - Complete epic and story breakdown
- **`/docs/api-reference.md`** - API endpoint documentation
- **`/docs/coding-standards.md`** - Development standards

---

## Maintenance

These business documents describe the platform **as of December 2, 2025** after completion of Epic 5.

If significant features are added in the future (Epic 6+), these documents should be updated to reflect new capabilities.

---

## Contact

For questions about this documentation or the Shtetl Zmanim platform:
- Review the technical docs in `/docs`
- Check the codebase at `/web` (frontend) and `/api` (backend)
- Refer to sprint artifacts in `/docs/sprint-artifacts`

---

**Created by:** Comprehensive codebase and documentation analysis
**Date:** December 2, 2025
**Coverage:** Epics 1-5 (113 stories, 125+ FRs, 135+ features)
