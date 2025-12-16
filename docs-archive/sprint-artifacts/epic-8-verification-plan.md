# Epic 8 Verification Plan

**Created:** 2025-12-15
**Reason:** Code was partially implemented but routes were not wired. Fresh start to verify each story.

---

## Verification Protocol

For each story, the dev agent must:

1. **Read the story file** - Understand acceptance criteria
2. **Check route registration** - Is it in `api/cmd/api/main.go`?
3. **Verify handler exists** - Does the handler function exist and compile?
4. **Verify database objects** - Tables, queries, migrations present?
5. **Test functionality** - Manual test or E2E test passes?
6. **Update status** - Mark `done` if working, or fix issues

---

## Story Verification Checklist

### Phase 1: Core Features (8.1-8.7) - PRIORITY HIGH

These are blocking for external API functionality.

| Story | Title | Known State | Verification Steps |
|-------|-------|-------------|-------------------|
| **8.1** | Wire Algorithm Version History Routes | Handlers exist in `version_history.go`, routes NOT in main.go | 1. Add routes to main.go 2. Test endpoints 3. Verify frontend integration |
| **8.2** | Implement Calculation Logging | Table exists, service exists | 1. Verify logging is called from zmanim handler 2. Check dashboard shows real stats |
| **8.3** | Activate Audit Trail | `actions` table exists, queries exist | 1. Verify handlers call `RecordAction` 2. Check activity endpoint returns data |
| **8.4** | External API - M2M Auth | `m2m_auth.go` complete | 1. Add `/external/*` route group 2. Wire middleware 3. Test with M2M token |
| **8.5** | External API - List Publisher Zmanim | Handler in `external_api.go` | 1. Register route 2. Test endpoint |
| **8.6** | External API - Bulk Calculation | Handler in `external_api.go` | 1. Register route 2. Test with date range |
| **8.7** | Rate Limiting | `rate_limit_external.go` complete | 1. Verify middleware applied to external routes |

### Phase 2: Geo & Search (8.8-8.14)

| Story | Title | Verification Steps |
|-------|-------|-------------------|
| **8.8** | Geo Alternative Names | Check for `geo_alternative_names` table, queries |
| **8.9** | Ultra-Fast Geo Search Index | Check for materialized view, verify search performance |
| **8.10** | Smart Search API | Verify `/locations/search` or `/coverage/search` works |
| **8.11** | City Source Tracking | Check `geo_source` columns populated |
| **8.12** | Geographic Hierarchy | Verify all cities have district_id, region_id |
| **8.13** | E2E Testing Search | Run search E2E tests |
| **8.14** | Unified Location Search | Verify frontend uses unified endpoint |

### Phase 3: Bug Fixes (8.15-8.16)

| Story | Title | Verification Steps |
|-------|-------|-------------------|
| **8.15** | React Query Cache | Check mutation hooks use `invalidateKeys` |
| **8.16** | Redis Cache Invalidation | Check handlers call `InvalidatePublisherCache` |

### Phase 4: API Cleanup (8.17-8.25)

| Story | Title | Verification Steps |
|-------|-------|-------------------|
| **8.17** | API Path Restructuring | Verify `/backend/*` paths work through gateway |
| **8.18** | Coding Standards Docs | Verify `docs/coding-standards.md` complete |
| **8.19** | Route Consolidation Phase 1 | Check for duplicate routes |
| **8.20** | Route Cleanup Phase 2 | Verify legacy routes removed |
| **8.21** | Backend Deployment | Verify deployment scripts work |
| **8.22** | Version History Pattern | Verify per-zman history standardized |
| **8.23** | Correction Request Consolidation | Verify single endpoint pattern |
| **8.24** | Soft Delete Documentation | Verify pattern documented |
| **8.25** | Registry Auth Consolidation | Verify auth-aware endpoints work |

### Phase 5: Security & Auth (8.26-8.32)

| Story | Title | Verification Steps |
|-------|-------|-------------------|
| **8.26** | Publisher Access Validation | Verify users can only access their publishers |
| **8.27** | Multi-Publisher Switcher | Verify cookie persistence works |
| **8.28** | CAPTCHA Bot Protection | Check reCAPTCHA integration |
| **8.29** | User Preferences Cookie | Verify preferences persist |
| **8.30** | User/Publisher Separation | Verify entity model correct |
| **8.31** | Secure Invitation Flow | Verify email verification |
| **8.32** | Publisher Registration Email | Verify verification email sent |

### Phase 6: UX Enhancements (8.33-8.37)

| Story | Title | Verification Steps |
|-------|-------|-------------------|
| **8.33** | AI RAG Validation | Verify context enrichment works |
| **8.34** | Seconds Display Toggle | Verify UI toggle works |
| **8.35** | Zman Card Preview | Verify time preview shows |
| **8.36** | Display Preferences | Verify preferences persist |
| **8.37** | Unified Onboarding | Verify onboarding flow complete |

---

## Execution Order

**Recommended order for dev agent:**

1. **8.4, 8.5, 8.6, 8.7** - External API (highest value, routes just need wiring)
2. **8.1** - Version History Routes (same pattern)
3. **8.2, 8.3** - Dashboard features
4. **8.15, 8.16** - Cache bug fixes (quick wins)
5. **8.8-8.14** - Geo/Search (may already work)
6. **8.17-8.25** - API cleanup (lower priority)
7. **8.26-8.32** - Security (verify working)
8. **8.33-8.37** - UX enhancements (verify working)

---

## Dev Agent Instructions

```
For each story in order:

1. Read: docs/sprint-artifacts/stories/8-{N}-{slug}.md
2. Check ACs against codebase
3. If working: Update sprint-status.yaml to `done`
4. If broken: Fix the issue, test, then mark `done`
5. If blocked: Note blocker, move to next story

Report format after each story:
- Story: 8.X
- Status: done | fixed | blocked
- Changes made: (if any)
- Notes: (blockers, issues found)
```

---

## Known Issues from Audit

1. **External API routes not registered** - `/external/*` group missing from main.go
2. **Version history routes not registered** - `/publisher/algorithm/history` etc missing
3. **M2M middleware not applied** - Exists but not wired
4. **Rate limiter not applied to external routes** - Exists but not wired

These should be quick fixes once the dev agent starts.
