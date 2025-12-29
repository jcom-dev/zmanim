# Local E2E Test Results - Baseline

**Date:** 2025-12-29
**Branch:** dev
**Commit:** 66616b7 (fix: simplify day_before timing tag logic)

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 505 |
| Passed | 274 |
| Failed | 207 |
| Skipped | 18 |
| Did Not Run | 6 |
| **Pass Rate** | **56.96%** (274/481 runnable) |
| Runtime | 8.4 minutes |

## Environment Status

- **Web App:** ✅ Running on http://localhost:3001
- **API:** ✅ Running on http://localhost:8080
- **Database:** ✅ Connected
- **Playwright:** ✅ Configured correctly (conflict resolved)

## Comparison to CI

| Environment | Pass Rate | Tests Run | Passed | Failed |
|-------------|-----------|-----------|--------|--------|
| **CI (GitHub Actions)** | 66.7% | 465 | 337 | 128 |
| **Local** | 56.96% | 481 | 274 | 207 |
| **Difference** | -9.74% | +16 | -63 | +79 |

**Analysis:** Local environment has MORE failures than CI. This suggests:
- Potential local environment timing/performance issues
- Service state differences (database, cache)
- Different test execution patterns (parallel workers)

## Failures by Test File (Top 15)

| Count | Test File |
|-------|-----------|
| 22 | e2e/publisher/registry-publisher.spec.ts |
| 21 | e2e/publisher/algorithm-editor.spec.ts |
| 15 | e2e/publisher/registry-request.spec.ts |
| 13 | e2e/performance/registry-performance.spec.ts |
| 12 | e2e/auth/authentication.spec.ts |
| 11 | e2e/publisher/onboarding.spec.ts |
| 11 | e2e/publisher/dashboard.spec.ts |
| 10 | e2e/publisher/analytics.spec.ts |
| 9 | e2e/admin.spec.ts |
| 9 | e2e/admin/publishers.spec.ts |
| 8 | e2e/user/location.spec.ts |
| 7 | e2e/user/display-settings.spec.ts |
| 7 | e2e/publisher/profile.spec.ts |
| 7 | e2e/errors/unauthorized.spec.ts |
| 6 | e2e/registration/auth-flows.spec.ts |

## Complete List of Failing Tests

### Admin Tests (18 failures)

1. ✘ e2e/admin/publishers.spec.ts:137 - publisher details shows Users section (15.5s)
2. ✘ e2e/admin/publishers.spec.ts:149 - admin can open invite user dialog (15.7s)
3. ✘ e2e/admin/publishers.spec.ts:165 - admin can open edit publisher dialog (15.8s)
4. ✘ e2e/admin/publishers.spec.ts:114 - publisher details shows status badges (16.7s)
5. ✘ e2e/admin/publishers.spec.ts:102 - admin can view publisher details (16.8s)
6. ✘ e2e/admin/publishers.spec.ts:185 - admin sees delete publisher option (15.8s)
7. ✘ e2e/admin/publishers.spec.ts:126 - publisher details has impersonation button (16.7s)
8. ✘ e2e/admin/publishers.spec.ts:228 - verified publisher shows suspend button (15.3s)
9. ✘ e2e/admin/publishers.spec.ts:212 - pending publisher shows verify button (15.6s)
10. ✘ e2e/admin.spec.ts:133 - should show appropriate actions based on publisher status (3.4s)
11. ✘ e2e/admin.spec.ts:149 - should load admin dashboard (13.3s)
12. ✘ e2e/admin.spec.ts:157 - should display statistics cards (15.6s)
13. ✘ e2e/admin.spec.ts:88 - should have required form fields (15.1s)
14. ✘ e2e/admin.spec.ts:165 - should have refresh functionality (15.1s)
15. ✘ e2e/admin.spec.ts:176 - should load admin settings page (15.1s)
16. ✘ e2e/admin.spec.ts:184 - should display system configuration form (15.1s)
17. ✘ e2e/admin.spec.ts:195 - should have save functionality (15.1s)
18. ✘ e2e/admin.spec.ts:208 - all admin pages should load within timeout (15.1s)

### Publisher Tests (136 failures)

#### Algorithm Editor (21 failures)
1. ✘ e2e/publisher/algorithm-editor.spec.ts:52 - has Back to Dashboard button (13.4s)
2. ✘ e2e/publisher/algorithm-editor.spec.ts:65 - search input visible (13.4s)
3. ✘ e2e/publisher/algorithm-editor.spec.ts:41 - editor shows zmanim count (13.5s)
4. ✘ e2e/publisher/algorithm-editor.spec.ts:76 - filter tabs visible (13.4s)
5. ✘ e2e/publisher/algorithm-editor.spec.ts:117 - Add Custom button visible (13.0s)
6. ✘ e2e/publisher/algorithm-editor.spec.ts:143 - Import button visible (12.2s)
7. ✘ e2e/publisher/algorithm-editor.spec.ts:203 - shows default location (2.9s)
8. ✘ e2e/publisher/algorithm-editor.spec.ts:102 - can filter to custom (18.4s)
9. ✘ e2e/publisher/algorithm-editor.spec.ts:89 - can filter to enabled (18.4s)
10. ✘ e2e/publisher/algorithm-editor.spec.ts:128 - Add Custom navigates to new zman (18.0s)
11. ✘ e2e/publisher/algorithm-editor.spec.ts:192 - preview location visible (13.1s)
12. ✘ e2e/publisher/algorithm-editor.spec.ts:219 - city search visible (12.7s)
13. ✘ e2e/publisher/algorithm-editor.spec.ts:232 - Version History visible (12.8s)
14. ✘ e2e/publisher/algorithm-editor.spec.ts:166 - Import has default templates (18.1s)
15. ✘ e2e/publisher/algorithm-editor.spec.ts:178 - Import has copy from publisher (18.1s)
16. ✘ e2e/publisher/algorithm-editor.spec.ts:154 - Import opens dialog (18.2s)
17. ✘ e2e/publisher/algorithm-editor.spec.ts:243 - View Month visible (13.6s)
18. ✘ e2e/publisher/algorithm-editor.spec.ts:268 - Zmanim section visible (12.8s)
19. ✘ e2e/publisher/algorithm-editor.spec.ts:254 - View Month opens dialog (17.9s)
20. ✘ e2e/publisher/algorithm-editor.spec.ts:279 - Zmanim count visible (12.9s)
21. ✘ e2e/publisher/algorithm-editor.spec.ts:292 - Back to Dashboard works (17.7s)

#### Dashboard (11 failures)
1. ✘ e2e/publisher/dashboard.spec.ts:62 - publisher can access dashboard (7.4s)
2. ✘ e2e/publisher/dashboard.spec.ts:82 - dashboard shows Profile card (7.3s)
3. ✘ e2e/publisher/dashboard.spec.ts:72 - dashboard shows publisher name (15.6s)
4. ✘ e2e/publisher/dashboard.spec.ts:92 - dashboard shows Zmanim card (15.5s)
5. ✘ e2e/publisher/dashboard.spec.ts:102 - dashboard shows Coverage card (15.5s)
6. ✘ e2e/publisher/dashboard.spec.ts:112 - dashboard shows Analytics card (15.5s)
7. ✘ e2e/publisher/dashboard.spec.ts:122 - dashboard shows Recent Activity section (15.5s)
8. ✘ e2e/publisher/dashboard.spec.ts:132 - profile card links to profile page (15.6s)
9. ✘ e2e/publisher/dashboard.spec.ts:145 - zmanim card links to algorithm page (15.6s)
10. ✘ e2e/publisher/dashboard.spec.ts:158 - coverage card links to coverage page (15.6s)
11. ✘ e2e/publisher/dashboard.spec.ts:173 - dashboard shows algorithm status (15.6s)

#### Analytics (10 failures)
1. ✘ e2e/publisher/analytics.spec.ts:89 - publisher can access analytics page (12.3s)
2. ✘ e2e/publisher/analytics.spec.ts:101 - shows header and description (12.4s)
3. ✘ e2e/publisher/analytics.spec.ts:279 - displays sparkline charts for trend data (2.4s)
4. ✘ e2e/publisher/analytics.spec.ts:191 - monthly calculations <= total calculations (15.2s)
5. ✘ e2e/publisher/analytics.spec.ts:172 - total calculations stat is non-negative (15.6s)
6. ✘ e2e/publisher/analytics.spec.ts:216 - coverage stats are non-negative (15.5s)
7. ✘ e2e/publisher/analytics.spec.ts:244 - shows empty state when no activity (15.5s)
8. ✘ e2e/publisher/analytics.spec.ts:261 - empty state shows helpful message (15.6s)
9. ✘ e2e/publisher/analytics.spec.ts:149 - stat cards show numeric values (26.8s)
10. ✘ e2e/publisher/analytics.spec.ts:127 - displays all stat cards with data-testid (26.8s)

#### Onboarding (11 failures)
1. ✘ e2e/publisher/onboarding.spec.ts:38 - shows Hebrew text (18.3s)
2. ✘ e2e/publisher/onboarding.spec.ts:28 - displays welcome message (18.6s)
3. ✘ e2e/publisher/onboarding.spec.ts:48 - shows feature cards (18.2s)
4. ✘ e2e/publisher/onboarding.spec.ts:60 - shows time estimate (18.3s)
5. ✘ e2e/publisher/onboarding.spec.ts:70 - has Get Started button (19.1s)
6. ✘ e2e/publisher/onboarding.spec.ts:80 - has Skip button (19.6s)
7. ✘ e2e/publisher/onboarding.spec.ts:90 - Get Started advances to customize step (19.5s)
8. ✘ e2e/publisher/onboarding.spec.ts:113 - can navigate forward through steps (19.5s)
9. ✘ e2e/publisher/onboarding.spec.ts:132 - can navigate backward (19.5s)
10. ✘ e2e/publisher/onboarding.spec.ts:155 - shows step titles (18.3s)
11. ✘ e2e/publisher/onboarding.spec.ts:170 - skip exits onboarding (18.3s)

#### Profile (7 failures)
1. ✘ e2e/publisher/profile.spec.ts:97 - profile shows account status section (2.7s)
2. ✘ e2e/publisher/profile.spec.ts:55 - profile form is pre-filled with current data (14.0s)
3. ✘ e2e/publisher/profile.spec.ts:155 - validation error on empty name (12.8s)
4. ✘ e2e/publisher/profile.spec.ts:184 - validation error on empty email (12.8s)
5. ✘ e2e/publisher/profile.spec.ts:125 - publisher can update profile name (13.0s)
6. ✘ e2e/publisher/profile.spec.ts:245 - publisher can update bio (13.0s)
7. ✘ e2e/publisher/profile.spec.ts:215 - publisher can update website (13.1s)

#### Registry Publisher (22 failures)
1. ✘ e2e/publisher/registry-publisher.spec.ts:206 - should display filter panel after publisher selection (10.6s)
2. ✘ e2e/publisher/registry-publisher.spec.ts:122 - should display publisher name after selection (11.2s)
3. ✘ e2e/publisher/registry-publisher.spec.ts:539 - should open publisher zman documentation modal (10.7s)
4. ✘ e2e/publisher/registry-publisher.spec.ts:668 - should close modal on Escape key (11.5s)
5. ✘ e2e/publisher/registry-publisher.spec.ts:871 - should redirect to algorithm page after clicking Copy (11.0s)
6. ✘ e2e/publisher/registry-publisher.spec.ts:384 - should display publisher zman cards with all required elements (13.1s)
7. ✘ e2e/publisher/registry-publisher.spec.ts:1024 - should filter results when searching (11.7s)
8. ✘ e2e/publisher/registry-publisher.spec.ts:745 - should redirect to algorithm page after clicking Link (10.2s)
9. ✘ e2e/publisher/registry-publisher.spec.ts:917 - should display toast notification after copying (10.1s)
10. ✘ e2e/publisher/registry-publisher.spec.ts:427 - should display info button on zman cards (10.5s)
11. ✘ e2e/publisher/registry-publisher.spec.ts:1069 - should display filter chips when filters are applied (10.4s)
12. ✘ e2e/publisher/registry-publisher.spec.ts:76 - should display publisher search autocomplete (18.0s)
13. ✘ e2e/publisher/registry-publisher.spec.ts:273 - should allow location selection within publisher coverage (17.9s)
14. ✘ e2e/publisher/registry-publisher.spec.ts:149 - should display Validated Publisher badge (17.7s)
15. ✘ e2e/publisher/registry-publisher.spec.ts:581 - should display publisher-specific section in modal (17.6s)
16. ✘ e2e/publisher/registry-publisher.spec.ts:312 - should display preview times after location selection (10.5s)
17. ✘ e2e/publisher/registry-publisher.spec.ts:177 - should enable location dropdown after publisher selection (10.3s)
18. ✘ e2e/publisher/registry-publisher.spec.ts:624 - should display Copy to Clipboard button in modal (10.4s)
19. ✘ e2e/publisher/registry-publisher.spec.ts:997 - should display search box for publisher catalog (17.8s)
20. ✘ e2e/publisher/registry-publisher.spec.ts:791 - should display toast notification after linking (18.1s)
21. ✘ e2e/publisher/registry-publisher.spec.ts:465 - should display action buttons (Link/Copy) on zman cards (18.1s)
22. ✘ e2e/publisher/registry-publisher.spec.ts:1120 - should clear filters when Clear All is clicked (17.8s)

#### Registry Request (15 failures)
1. ✘ e2e/publisher/registry-request.spec.ts:69 - should display all required form fields in modal (17.7s)
2. ✘ e2e/publisher/registry-request.spec.ts:140 - should close modal after successful submission (18.1s)
3. ✘ e2e/publisher/registry-request.spec.ts:101 - should fill out and submit request form successfully (17.7s)
4. ✘ e2e/publisher/registry-request.spec.ts:199 - should close modal when clicking cancel or close button (18.0s)
5. ✘ e2e/publisher/registry-request.spec.ts:263 - should show Request Addition button in Publisher Examples tab (17.8s)
6. ✘ e2e/publisher/registry-request.spec.ts:304 - should pre-populate source field with "registry" value (17.9s)
7. ✘ e2e/publisher/registry-request.spec.ts:365 - should close modal and remain on registry page after submission (17.8s)
8. ✘ e2e/publisher/registry-request.spec.ts:447 - should show validation error for empty description (18.3s)
9. ✘ e2e/publisher/registry-request.spec.ts:501 - should not submit form when validation fails (18.4s)
10. ✘ e2e/publisher/registry-request.spec.ts:170 - should remain on registry page after submission (18.2s)
11. ✘ e2e/publisher/registry-request.spec.ts:281 - should open RequestZmanModal from Publisher Examples tab (17.6s)
12. ✘ e2e/publisher/registry-request.spec.ts:227 - should close modal when pressing Escape key (17.6s)
13. ✘ e2e/publisher/registry-request.spec.ts:333 - should submit request successfully from Publisher Examples tab (17.6s)
14. ✘ e2e/publisher/registry-request.spec.ts:420 - should show validation error for empty zman name (17.9s)
15. ✘ e2e/publisher/registry-request.spec.ts:474 - should show validation error for empty justification (18.2s)

#### Registry Duplicates (6 failures)
1. ✘ e2e/publisher/registry-duplicates.spec.ts:53 - should show "Imported" badge after importing (33.0s)
2. ✘ e2e/publisher/registry-duplicates.spec.ts:149 - should disable Link and Copy buttons after importing (33.1s)
3. ✘ e2e/publisher/registry-duplicates.spec.ts:289 - should return 400 error for duplicate import (33.0s)
4. ✘ e2e/publisher/registry-duplicates.spec.ts:385 - should handle API duplicate prevention (33.0s)
5. ✘ e2e/publisher/registry-duplicates.spec.ts:463 - should prevent duplicate when switching tabs (33.2s)
6. ✘ e2e/publisher/registry-duplicates.spec.ts:503 - should maintain duplicate prevention after refresh (33.1s)

#### Other Publisher Tests (33 failures)
1. ✘ e2e/publisher/algorithm-migration.spec.ts:239 - focus param is cleared from URL after delay (3.0s)
2. ✘ e2e/publisher/algorithm-migration.spec.ts:277 - Browse Registry button exists for new publishers (3.0s)
3. ✘ e2e/publisher/publisher-switcher.spec.ts:275 - Cookie is httpOnly (1.9s)
4. ✘ e2e/publisher/publisher-switcher.spec.ts:126 - Invalid cookie falls back to primary_publisher_id (30.7s)
5. ✘ e2e/publisher/publisher-switcher.spec.ts:164 - Single-publisher user does not see switcher dropdown (30.6s)
6. ✘ e2e/publisher/publisher-lifecycle.spec.ts:65 - Publisher completes onboarding with defaults (17.4s)
7. ✘ e2e/publisher/team.spec.ts:85 - shows description (12.9s)
8. ✘ e2e/publisher/team.spec.ts:116 - dialog has name input (17.1s)
9. ✘ e2e/publisher/team.spec.ts:193 - error for empty email (12.7s)
10. ✘ e2e/publisher/version-history.spec.ts:55 - can create version snapshot (2.9s)
11. ✘ e2e/publisher/version-history.spec.ts:27 - can retrieve version history list (4.0s)
12. ✘ e2e/publisher/version-history.spec.ts:250 - full version history workflow (3.1s)

### User Tests (16 failures)

#### Display Settings (7 failures)
1. ✘ e2e/user/display-settings.spec.ts:66 - seconds toggle defaults to OFF (11.5s)
2. ✘ e2e/user/display-settings.spec.ts:87 - seconds toggle can be turned ON (11.5s)
3. ✘ e2e/user/display-settings.spec.ts:53 - zmanim page shows display settings toggle (12.8s)
4. ✘ e2e/user/display-settings.spec.ts:110 - seconds toggle can be turned OFF after being ON (16.5s)
5. ✘ e2e/user/display-settings.spec.ts:168 - seconds preference stored in cookie (16.4s)
6. ✘ e2e/user/display-settings.spec.ts:132 - seconds toggle persists across page refresh (16.4s)
7. ✘ e2e/user/display-settings.spec.ts:191 - seconds OFF stored in cookie (16.4s)

#### Location (8 failures)
1. ✘ e2e/user/location.spec.ts:38 - clicking continent shows countries (11.4s)
2. ✘ e2e/user/location.spec.ts:29 - home page shows continent list (11.4s)
3. ✘ e2e/user/location.spec.ts:134 - home page has become publisher link in footer (1.4s)
4. ✘ e2e/user/location.spec.ts:142 - clicking become publisher navigates to registration (1.4s)
5. ✘ e2e/user/location.spec.ts:154 - shows multi-publisher subtitle (1.4s)
6. ✘ e2e/user/location.spec.ts:56 - breadcrumb navigation works (11.4s)
7. ✘ e2e/user/location.spec.ts:79 - selecting city navigates to zmanim page (11.4s)
8. ✘ e2e/user/location.spec.ts:126 - home page shows sign in option (11.4s)

#### Zmanim (1 failure)
1. ✘ e2e/user/zmanim.spec.ts:89 - zmanim page URL structure is correct (11.5s)

### Auth & Public Tests (37 failures)

#### Authentication (12 failures)
1. ✘ e2e/auth/authentication.spec.ts:138 - can access admin dashboard (2.8s)
2. ✘ e2e/auth/authentication.spec.ts:190 - publisher cannot access admin (2.6s)
3. ✘ e2e/auth/authentication.spec.ts:221 - user cannot access publisher (2.2s)
4. ✘ e2e/auth/authentication.spec.ts:206 - user cannot access admin (2.3s)
5. ✘ e2e/auth/authentication.spec.ts:31:9 - unauthenticated redirected from /publisher/dashboard (30.6s)
6. ✘ e2e/auth/authentication.spec.ts:31:9 - unauthenticated redirected from /publisher/algorithm (30.6s)
7. ✘ e2e/auth/authentication.spec.ts:31:9 - unauthenticated redirected from /publisher/profile (30.6s)
8. ✘ e2e/auth/authentication.spec.ts:31:9 - unauthenticated redirected from /publisher/coverage (30.6s)
9. ✘ e2e/auth/authentication.spec.ts:31:9 - unauthenticated redirected from /publisher/team (30.7s)
10. ✘ e2e/auth/authentication.spec.ts:49:9 - unauthenticated redirected from /admin/dashboard (30.7s)
11. ✘ e2e/auth/authentication.spec.ts:49:9 - unauthenticated redirected from /admin/publishers (30.6s)
12. ✘ e2e/auth/authentication.spec.ts:238 - can sign out (36.4s)

#### Auth Pages (3 failures)
1. ✘ e2e/auth.spec.ts:22 - should load sign-in page (30.5s)
2. ✘ e2e/auth.spec.ts:31 - should display Clerk sign-in component (30.6s)
3. ✘ e2e/auth.spec.ts:47 - should load sign-up page (30.6s)

#### Registration (6 failures)
1. ✘ e2e/admin-auth.spec.ts:37 - sign-in page should load successfully (30.6s)
2. ✘ e2e/registration/auth-flows.spec.ts:17 - sign in page is accessible
3. ✘ e2e/registration/auth-flows.spec.ts:25 - sign in page shows email input
4. ✘ e2e/registration/auth-flows.spec.ts:39 - clicking sign in from home opens sign in
5. ✘ e2e/registration/auth-flows.spec.ts:59 - sign up page is accessible
6. ✘ e2e/registration/auth-flows.spec.ts:79 - unauthenticated user accessing /publisher redirects to sign-in
7. ✘ e2e/registration/auth-flows.spec.ts:96 - unauthenticated user accessing /admin redirects to sign-in
8. ✘ e2e/registration/publisher-registration.spec.ts:244 - sign-up redirects to register

#### Unauthorized Access (7 failures)
1. ✘ e2e/errors/unauthorized.spec.ts:23 - unauthenticated user cannot access /admin (30.6s)
2. ✘ e2e/errors/unauthorized.spec.ts:46 - unauthenticated user cannot access /admin/publishers (30.6s)
3. ✘ e2e/errors/unauthorized.spec.ts:59 - unauthenticated user cannot access /admin/dashboard (30.6s)
4. ✘ e2e/errors/unauthorized.spec.ts:96 - unauthenticated user cannot access /publisher/dashboard (30.6s)
5. ✘ e2e/errors/unauthorized.spec.ts:109 - unauthenticated user cannot access /publisher/profile (30.6s)
6. ✘ e2e/errors/unauthorized.spec.ts:135 - unauthenticated user cannot access /publisher/coverage (30.6s)
7. ✘ e2e/errors/unauthorized.spec.ts:122 - unauthenticated user cannot access /publisher/algorithm (30.6s)

#### Other Public Tests (9 failures)
1. ✘ e2e/home.spec.ts:32 - should display main heading and branding (11.4s)
2. ✘ e2e/home.spec.ts:43 - should display subtitle (1.5s)
3. ✘ e2e/home.spec.ts:55 - should show loading state for publishers (6.4s)
4. ✘ e2e/home.spec.ts:78 - should display footer (1.4s)
5. ✘ e2e/home.spec.ts:49 - should display description text (11.3s)
6. ✘ e2e/email/invitation-flows.spec.ts:42 - admin can open invite dialog (18.3s)
7. ✘ e2e/email/invitation-flows.spec.ts:61 - admin can send invitation to test email (22.1s)
8. ✘ e2e/errors/edge-cases.spec.ts:169 - publisher with special characters in name renders correctly (3.4s)
9. ✘ e2e/errors/edge-cases.spec.ts:192 - expired session redirects to sign-in (33.3s)
10. ✘ e2e/public/public-pages.spec.ts:128 - sign-in page shows Clerk auth component
11. ✘ e2e/public/public-pages.spec.ts:149 - sign-up page shows Clerk auth component
12. ✘ e2e/public/public-pages.spec.ts:258 - accept invitation with invalid token shows error

### Performance & Accessibility Tests (16 failures)

#### Performance (13 failures)
1. ✘ e2e/performance/registry-performance.spec.ts:63 - page loads initial 50 zmanim cards (4.7s)
2. ✘ e2e/performance/registry-performance.spec.ts:188 - shita filter applies within 300ms (3.9s)
3. ✘ e2e/performance/registry-performance.spec.ts:151 - category filter applies within 300ms (4.0s)
4. ✘ e2e/performance/registry-performance.spec.ts:252 - combined filters apply within 500ms (4.2s)
5. ✘ e2e/performance/registry-performance.spec.ts:443 - multiple filters maintain responsiveness (3.7s)
6. ✘ e2e/performance/registry-performance.spec.ts:84 - location preview calculates within 500ms per zman (19.0s)
7. ✘ e2e/performance/registry-performance.spec.ts:127 - preview times update without blocking UI (19.0s)
8. ✘ e2e/performance/registry-performance.spec.ts:291 - modal opens within 200ms (19.0s)
9. ✘ e2e/performance/registry-performance.spec.ts:321 - modal closes within 100ms (19.1s)
10. ✘ e2e/performance/registry-performance.spec.ts:353 - modal close button works within 100ms (19.0s)
11. ✘ e2e/performance/registry-performance.spec.ts:388 - master registry API responds within 1 second (19.0s)
12. ✘ e2e/performance/registry-performance.spec.ts:407 - zmanim calculation API responds within 500ms (19.0s)
13. ✘ e2e/performance/registry-performance.spec.ts:39 - page loads within 2 seconds (33.0s)

#### Accessibility (3 failures)
1. ✘ e2e/accessibility/registry-a11y.spec.ts:171 - has no critical accessibility violations (5.6s)
2. ✘ e2e/accessibility/registry-a11y.spec.ts:390 - meets WCAG AA color contrast requirements (5.9s)
3. ✘ e2e/accessibility/registry-a11y.spec.ts:437 - text content has sufficient contrast (5.6s)

## Common Failure Patterns

1. **Timeout Issues (30.6s timeouts)**
   - Auth flows (sign-in, sign-up pages)
   - Protected route redirects
   - Many tests timing out at exactly 30.6s

2. **Long-Running Tests (15-19s)**
   - Publisher dashboard, analytics, profile tests
   - Admin publisher details tests
   - Performance tests

3. **Quick Failures (1-5s)**
   - Simple UI element checks
   - Basic navigation tests
   - Suggests elements not rendering

4. **Consistent Timeout Duration**
   - Most failures around 15s, 18s, or 30.6s
   - Suggests network/service delays

## Playwright Configuration Fix Applied

**Problem:** Duplicate `@playwright/test` installations in both `web/package.json` and `tests/package.json`

**Solution:** Removed `@playwright/test` from `web/package.json`

**Result:** ✅ Tests now run successfully (505 tests detected and executed)

## Next Steps

1. **Investigate timeout issues**
   - Most common failure pattern is 30.6s timeout
   - Check service response times
   - Review Playwright timeout configuration

2. **Focus on high-impact files**
   - Start with registry-publisher.spec.ts (22 failures)
   - Then algorithm-editor.spec.ts (21 failures)
   - Fix these to improve pass rate significantly

3. **Compare to CI execution**
   - Run same tests in CI and compare timing
   - Identify environment-specific issues
   - May need to adjust local worker count or timeouts

4. **Database state investigation**
   - Some tests may be affected by local database state
   - Consider running with clean database state
   - Check if test isolation is working properly

5. **Service health check**
   - Monitor API response times during test execution
   - Check for rate limiting or connection pooling issues
   - Verify Redis cache is functioning

## How to Reproduce

```bash
# Start services
./restart.sh

# Run full test suite
cd tests
npx playwright test --reporter=list

# Run specific failing test file
npx playwright test e2e/publisher/registry-publisher.spec.ts --reporter=list

# Run with debug output
DEBUG=pw:api npx playwright test e2e/publisher/dashboard.spec.ts --reporter=list
```

## Files

- Full test output: `/tmp/playwright-full-run.log`
- This report: `/home/daniel/repos/zmanim/LOCAL_E2E_TEST_RESULTS.md`
