# Story 8.27: Multi-Publisher Switcher with Cookie Persistence

Status: in-progress

**REMEDIATION NOTE:** Story was marked "ready-for-review" but implementation is only 60% complete. Backend fully implemented but frontend doesn't integrate with cookie API. See Dev Agent Record for details.

## Story

As a user with access to multiple publishers,
I want to stay logged into my last-selected publisher and have a UI to switch between publishers,
So that I don't have to re-select my publisher on every visit and can easily manage multiple organizations.

## Context

Users may have access to multiple publishers (e.g., a rabbi who serves multiple congregations, or a developer managing several publisher accounts). Currently, the system requires selecting a publisher context on each session, but there's no persistence of this choice.

**Requirements:**
1. **Cookie Persistence:** Store the last-selected publisher ID in a cookie
2. **Auto-Selection:** On login, automatically select the last-used publisher
3. **Publisher Switcher UI:** Button/dropdown in the header to switch between authorized publishers
4. **Validation:** Only allow switching to publishers the user has access to (ties into Story 8.26)

**Note:** Story 2-2 (`multi-publisher-switcher`) created the PublisherContext and basic switcher component. This story enhances it with proper cookie persistence and improved UX.

## Acceptance Criteria

- [ ] 1. Last-selected publisher ID stored in httpOnly cookie (`zmanim_publisher_id`)
- [ ] 2. Cookie persists for 30 days (or until logout)
- [ ] 3. On page load, if cookie exists and user has access, auto-select that publisher
- [ ] 4. If cookie references inaccessible publisher, fall back to primary_publisher_id
- [x] 5. Publisher switcher component shows in header for multi-publisher users
- [x] 6. Switcher displays publisher name and logo
- [ ] 7. Switching publisher updates cookie and refreshes relevant data
- [x] 8. Single-publisher users don't see the switcher (clean UX)
- [x] 9. Admin impersonation overrides cookie selection (existing behavior preserved)

## Tasks / Subtasks

- [x] Task 1: Backend - Cookie management endpoint
  - [x] 1.1 Create `POST /auth/publisher/select` endpoint
  - [x] 1.2 Validate requested publisher ID against user's access list
  - [x] 1.3 Set httpOnly cookie `zmanim_publisher_id` with 30-day expiry
  - [x] 1.4 Return selected publisher details
  - [x] 1.5 Create `GET /auth/publisher/current` to read cookie and return active publisher
- [x] Task 2: Backend - Publisher list endpoint enhancement
  - [x] 2.1 Enhance `GET /auth/publishers/accessible` to return user's authorized publishers
  - [x] 2.2 Include: id, name, logo_url, is_primary for each
  - [x] 2.3 Mark currently selected (from cookie) in response
- [x] Task 3: Frontend - Cookie reading and auto-selection
  - [x] 3.1 On app initialization, check for `zmanim_publisher_id` cookie
  - [x] 3.2 If cookie exists, validate against user's access list
  - [x] 3.3 If valid, set as active publisher context
  - [x] 3.4 If invalid/missing, use primary_publisher_id
  - [x] 3.5 Update PublisherContext provider to handle auto-selection
- [x] Task 4: Frontend - Publisher Switcher component
  - [x] 4.1 Create/enhance `PublisherSwitcher` component
  - [x] 4.2 Show current publisher name + logo in header
  - [x] 4.3 Dropdown lists all accessible publishers
  - [x] 4.4 On selection: call `/auth/publisher/select`, update context, invalidate React Query cache
  - [x] 4.5 Hide switcher for single-publisher users
  - [x] 4.6 Show switcher count badge (e.g., "2 publishers")
- [x] Task 5: Frontend - Integration
  - [x] 5.1 Add PublisherSwitcher to main layout header
  - [x] 5.2 Ensure admin impersonation takes precedence over cookie
  - [x] 5.3 Clear cookie on logout
  - [x] 5.4 Handle edge case: publisher removed from access list
- [x] Task 6: Testing
  - [x] 6.1 E2E: User with 2 publishers can switch between them
  - [x] 6.2 E2E: Cookie persists across page reloads
  - [x] 6.3 E2E: Invalid cookie falls back to primary
  - [x] 6.4 E2E: Single-publisher user doesn't see switcher
  - [x] 6.5 E2E: Admin impersonation overrides cookie
  - [x] 6.6 All existing E2E tests pass

## Dev Notes

### Cookie Specification
```
Name: zmanim_publisher_id
Value: <publisher_id>
HttpOnly: true
Secure: true (production)
SameSite: Lax
Path: /
Max-Age: 2592000 (30 days)
```

### API Endpoints

**POST /api/v1/auth/publisher/select**
```json
Request:
{ "publisher_id": "5" }

Response:
{
  "publisher_id": "5",
  "name": "Congregation Beth Israel",
  "logo_url": "/logos/5.png"
}
```

**GET /api/v1/auth/publishers/accessible**
```json
Response:
{
  "publishers": [
    { "id": "1", "name": "OU", "logo_url": "...", "is_primary": true, "is_selected": false },
    { "id": "5", "name": "Beth Israel", "logo_url": "...", "is_primary": false, "is_selected": true }
  ],
  "selected_publisher_id": "5"
}
```

### Key Files
- `api/internal/handlers/publishers.go` - New endpoints
- `web/components/shared/PublisherSwitcher.tsx` - UI component (may exist from 2-2)
- `web/lib/contexts/PublisherContext.tsx` - Context provider
- `web/app/layout.tsx` - Header integration

### Existing Code (from Story 2-2)
Story 2-2 created `PublisherContext` and a basic switcher. Review existing implementation before starting:
- Check `web/lib/contexts/` for existing context
- Check `web/components/` for existing switcher component

### Integration with Story 8.26
This story depends on Story 8.26 (Publisher Access Validation) being complete. The `select` endpoint must validate that the user has access to the requested publisher before setting the cookie.

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md)
- **Context File:** [8-27-multi-publisher-switcher-with-cookie-persistence.context.xml](./8-27-multi-publisher-switcher-with-cookie-persistence.context.xml)
- **Tech Design:** See "Cookie Specification" and "API Endpoints" sections above
- **Dependency:** Story 8.26 (Publisher Access Validation) must be completed first

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

### Code Quality
- [ ] Cookie persistence works across sessions (httpOnly, 30-day TTL) - **BACKEND ONLY**: Frontend uses localStorage
- [x] Publisher switcher appears for multi-publisher users only
- [ ] Switching updates cookie and UI state atomically - **BACKEND ONLY**: Frontend doesn't call `/publisher/select`
- [x] Single-publisher users see clean header (no switcher)
- [x] Admin impersonation overrides cookie selection (via sessionStorage)
- [x] PublisherResolver pattern followed (per coding standards)
- [ ] React Query cache invalidation on publisher switch - **NOT IMPLEMENTED**: No cache invalidation on switch

### Testing
- [x] Backend tests pass: `cd api && go test ./...` - **PASSED**
- [x] Type check passes: `cd web && npm run type-check` - **PASSED**
- [ ] E2E tests created and pass:
  - [ ] E2E: User with 2+ publishers can switch between them - **SKIPPED**: Requires MULTI_PUBLISHER_TEST_USER env var
  - [ ] E2E: Cookie persists across page reloads - **SKIPPED**: Requires MULTI_PUBLISHER_TEST_USER env var
  - [ ] E2E: Invalid cookie falls back to primary_publisher_id - **FAILED**: Timeout (networkidle not reached)
  - [ ] E2E: Single-publisher user doesn't see switcher - **FAILED**: Timeout (networkidle not reached)
  - [ ] E2E: Admin impersonation overrides cookie - **SKIPPED**: Requires ADMIN_TEST_USER env var
- [ ] All existing E2E tests pass: `cd tests && npx playwright test` - **PARTIAL**: 3 passed, 2 failed, 5 skipped

### Verification Commands
```bash
# Backend tests
cd api && go test ./...

# Frontend type check
cd web && npm run type-check

# E2E tests
cd tests && npx playwright test

# Manual test: Check cookie is set after selection
curl -c cookies.txt -b cookies.txt \
     -H "Authorization: Bearer $USER_JWT" \
     -X POST http://localhost:8080/api/v1/auth/publisher/select \
     -d '{"publisher_id": "5"}'
cat cookies.txt | grep zmanim_publisher_id

# Manual test: Verify accessible publishers endpoint
curl -H "Authorization: Bearer $USER_JWT" \
     http://localhost:8080/api/v1/auth/publishers/accessible | jq
```

## Estimated Points

5 points (Feature - Medium Priority)

## Dependencies

- Story 8.26 (Publisher Access Validation) - Required for secure validation

## Dev Agent Record

### Context Reference

- [8-27-multi-publisher-switcher-with-cookie-persistence.context.xml](./8-27-multi-publisher-switcher-with-cookie-persistence.context.xml)
- [8-27-tech-design.md](./8-27-tech-design.md)

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Remediation review

### Debug Log References

N/A - Story remediation/validation only

### Completion Notes

**Implementation Status: PARTIAL (60% complete)**

**What Works:**
- Backend fully implemented:
  - `POST /api/v1/auth/publisher/select` endpoint sets httpOnly cookie with validation
  - `GET /api/v1/auth/publishers/accessible` returns user's accessible publishers
  - Cookie specification correct (30-day TTL, httpOnly, SameSite=Lax)
  - PublisherResolver pattern followed correctly
- Frontend UI implemented:
  - PublisherSwitcher component exists and displays correctly
  - Shows/hides based on publisher count (single vs multi)
  - Admin impersonation works via sessionStorage
- Tests pass:
  - Backend tests: PASS (`go test ./...`)
  - Type checking: PASS (`npm run type-check`)
  - httpOnly cookie test: PASS (cookie not accessible from JavaScript)

**What's Missing:**
- **CRITICAL**: Frontend doesn't call backend cookie API
  - `PublisherContext.tsx` uses `localStorage.setItem('selectedPublisherId', id)` instead of calling `/publisher/select`
  - No integration between frontend switcher and backend cookie management
  - Cookie is set by backend but never read by frontend
- **CRITICAL**: No React Query cache invalidation on publisher switch
  - Switching publishers doesn't invalidate cached data
  - Stale data may be displayed after switching
- E2E tests incomplete:
  - 5 tests skipped (require multi-publisher test users not configured in CI)
  - 2 tests failing (timeout issues, likely due to missing frontend-backend integration)

**Implementation Gap:**
The story was marked "ready-for-review" but the core feature (cookie persistence) is not integrated. The backend API exists, but the frontend doesn't use it. This means:
- Publishers selections persist in localStorage (browser-only, not httpOnly)
- No cross-device sync
- No SSR hydration from cookies
- Cookie security benefits not realized

**To Complete This Story:**
1. Update `PublisherContext.tsx` to call `/publisher/select` when switching publishers
2. Read `zmanim_publisher_id` cookie on initial page load (SSR via `layout.tsx`)
3. Add React Query cache invalidation when publisher changes
4. Fix E2E test timeouts
5. Configure multi-publisher test users for E2E tests

**Recommended Next Steps:**
- Change status back to "in-progress" or "blocked"
- Create subtask: "Frontend-Backend Cookie Integration"
- Complete integration before marking ready-for-review

### File List

**Backend Files (Fully Implemented):**
- `/home/coder/workspace/zmanim/api/internal/handlers/handlers.go` - SelectPublisher (line 603), GetAccessiblePublishers (line 488)
- `/home/coder/workspace/zmanim/api/internal/db/sqlcgen/publishers.sql.go` - GetAccessiblePublishersByClerkUserID, GetAccessiblePublishersByIDs

**Frontend Files (Partial Implementation):**
- `/home/coder/workspace/zmanim/web/providers/PublisherContext.tsx` - Uses localStorage, NOT backend API
- `/home/coder/workspace/zmanim/web/components/publisher/PublisherSwitcher.tsx` - UI component (working)
- `/home/coder/workspace/zmanim/web/app/publisher/layout.tsx` - Contains switcher in header

**Test Files:**
- `/home/coder/workspace/zmanim/tests/e2e/publisher/publisher-switcher.spec.ts` - E2E tests (partial pass)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted for multi-publisher UX improvement | Claude Opus 4.5 |
| 2025-12-15 | Remediation review - identified implementation gap | Claude Sonnet 4.5 |
