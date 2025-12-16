# Shtetl Zmanim Documentation

**Halachic Zmanim Publishing Platform** - A multi-publisher platform for rabbinic authorities to publish customized Jewish prayer times with complete algorithm control and transparency.

---

## 📚 Documentation Index

### Getting Started
1. **[README.md](README.md)** - Project overview and quick start guide
2. **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Complete developer onboarding and workflow guide

### Product & Design
3. **[PRD (Product Requirements)](prd.md)** - Complete product requirements document
4. **[Business Documentation](business/)** - Non-technical documentation
   - [What is Shtetl Zmanim?](business/01-what-is-zmanim.md) - Vision, purpose, problems solved
   - [Comprehensive Features List](business/02-features-comprehensive-list.md) - All 135+ features
   - [Technical Architecture Overview](business/03-technical-architecture.md) - High-level tech explanation
5. **[UX DSL Editor Spec](ux-dsl-editor-inline-guidance.md)** - Current UX specification for DSL editor

### Technical Architecture
6. **[Architecture](architecture.md)** - Complete system architecture, technology stack, patterns
7. **[Data Models](data-models.md)** - Database schema and model definitions
8. **[API Reference](api-reference.md)** - REST API endpoints documentation
9. **[Deployment](deployment.md)** - Deployment guide for Fly.io, Vercel, Xata
10. **[Coding Standards](coding-standards.md)** - Development standards and best practices

### Epic & Story History
11. **[Epics](epics.md)** - Complete epic history (Epics 1-5, 113 stories)
12. **[Epic-Specific Documents](sprint-artifacts/):**
    - [Epic 2: Publisher User Management](epic-2-publisher-user-management.md)
    - [Epic 3: Consolidation & Quality](epic-3-consolidation-quality.md)
    - [Epic 4: Comprehensive Plan](sprint-artifacts/epic-4-comprehensive-plan.md)
    - [Epic 4: DSL Specification](sprint-artifacts/epic-4-dsl-specification.md)
    - [Epic 4: UI Wireframes](sprint-artifacts/epic-4-ui-wireframes.md)
13. **[Sprint Artifacts](sprint-artifacts/)** - All epic plans, stories, and retrospectives
    - Epic 1 MVP stories: `1-1-coder...md` through `1-11-formula-reveal.md`
    - Epic 4 foundation: `4-0-postgres-pgvector-image.md`
    - Tech specs: `tech-spec-epic-1.md`, `tech-spec-epic-2.md`
    - Stories folder: All individual story files (Epic 2-5)

### Archived Documentation
14. **[Archive](archive/)** - Old snapshots and outdated documentation
    - Codebase audits (historical snapshots)
    - Old UX specs (superseded versions)
    - Dev agent context files (development artifacts)

---

## 🗂️ Documentation Structure

```
docs/
├── README.md                          # This file - documentation index
├── DEVELOPER_GUIDE.md                 # Developer onboarding
├── prd.md                             # Product requirements
├── architecture.md                    # System architecture (CURRENT)
├── data-models.md                     # Database schema
├── api-reference.md                   # API documentation
├── deployment.md                      # Deployment guide
├── coding-standards.md                # Development standards
├── epics.md                           # Complete epic history
├── epic-2-publisher-user-management.md
├── epic-3-consolidation-quality.md
├── ux-dsl-editor-inline-guidance.md   # Current UX spec
├── business/                          # Business documentation
│   ├── README.md
│   ├── 01-what-is-zmanim.md
│   ├── 02-features-comprehensive-list.md
│   └── 03-technical-architecture.md
├── sprint-artifacts/                  # Epic & story history
│   ├── 1-1-coder-development-environment.md
│   ├── 1-2-foundation-authentication.md
│   ├── ... (all Epic 1 stories)
│   ├── 4-0-postgres-pgvector-image.md
│   ├── epic-4-comprehensive-plan.md
│   ├── epic-4-dsl-specification.md
│   ├── epic-4-ui-wireframes.md
│   ├── epic-1-2-retro-2025-11-27.md
│   ├── tech-spec-epic-1.md
│   ├── tech-spec-epic-2.md
│   ├── tooltip-implementation-plan.md
│   └── stories/                       # Individual stories
│       ├── 2-0-code-review-refactor.md
│       ├── 2-1-publisher-user-invitation.md
│       ├── ... (all Epic 2-5 stories)
│       └── 5-19-zman-request-review-workflow.md
└── archive/                           # Historical documentation
    ├── ARCHITECTURE-old.md
    ├── codebase-audit.md
    ├── code-review-recommendations-2025-11-28.md
    ├── ... (old snapshots)
    └── *-context.md (dev agent artifacts)
```

---

## 📊 Project Status

**Current Sprint:** Epic 5 (DSL Editor Experience & Zman Management)
**Completed Epics:** 1, 2, 3, 4, 5
**Total Stories:** 113 across 5 epics
**Functional Requirements:** 125+ (FR1-FR125)
**Features:** 135+ distinct features

**Last Updated:** December 2, 2025

---

## 🎯 Quick Navigation by Role

### For Developers
→ Start with **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)**
→ Reference **[architecture.md](architecture.md)** for system design
→ Follow **[coding-standards.md](coding-standards.md)** for best practices
→ Use **[api-reference.md](api-reference.md)** for endpoints

### For Product/Business
→ Start with **[business/01-what-is-zmanim.md](business/01-what-is-zmanim.md)**
→ Review **[business/02-features-comprehensive-list.md](business/02-features-comprehensive-list.md)**
→ See **[prd.md](prd.md)** for requirements
→ Check **[epics.md](epics.md)** for development history

### For Designers
→ See **[ux-dsl-editor-inline-guidance.md](ux-dsl-editor-inline-guidance.md)** for current UX spec
→ Review **[business/02-features-comprehensive-list.md](business/02-features-comprehensive-list.md)** for UI features

### For DevOps
→ See **[deployment.md](deployment.md)** for deployment process
→ Review **[architecture.md](architecture.md)** for infrastructure

---

## 📖 Documentation Philosophy

- **Current over Historical**: Active docs in root, old versions in `archive/`
- **Business + Technical**: Separate business docs for non-technical stakeholders
- **Epic History Preserved**: All epics and stories retained for reference
- **Living Documents**: Architecture, PRD, standards updated as project evolves
- **Clear Structure**: Easy navigation via this index

---

## ✨ Key Documents You Should Read

| Priority | Document | Why? |
|----------|----------|------|
| 🔴 **High** | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | Complete developer onboarding |
| 🔴 **High** | [architecture.md](architecture.md) | System design and patterns |
| 🔴 **High** | [coding-standards.md](coding-standards.md) | Required development practices |
| 🟡 **Medium** | [prd.md](prd.md) | Product vision and requirements |
| 🟡 **Medium** | [epics.md](epics.md) | Development history and decisions |
| 🟡 **Medium** | [business/](business/) | Non-technical overview |
| 🟢 **Low** | [archive/](archive/) | Historical reference only |

---

**Generated:** December 2, 2025
**Maintained by:** Development Team
**Status:** Consolidated from 113 files → streamlined structure
