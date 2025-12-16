# Epic 8 Remediation Plan

**Generated:** 2025-12-15
**Total Stories Requiring Remediation:** 29 of 36

---

## Priority Tiers

| Tier | Description | Stories | Action Timeline |
|------|-------------|---------|-----------------|
| **P0 - Critical** | False completions, no code exists | 5 | Immediate |
| **P1 - High** | Major gaps, significant work needed | 8 | This sprint |
| **P2 - Medium** | Status/documentation fixes only | 10 | Next sprint |
| **P3 - Low** | Minor updates, correctly incomplete | 6 | As capacity allows |

---

## P0 - Critical (Immediate Action Required)

### 8-23: Correction Request Endpoint Consolidation
**Problem:** FALSE COMPLETION - Completion notes claim work done but NO code exists
**Current Status:** blocked
**Actual State:** 0% complete - handlers don't exist, routes unchanged

**Remediation Steps:**
1. [ ] Create `GetCorrectionRequests` unified handler with role-aware filtering
2. [ ] Create `UpdateCorrectionRequestStatus` handler
3. [ ] Add deprecation redirect handlers for old endpoints
4. [ ] Update frontend to use new endpoints
5. [ ] Write and run E2E tests
6. [ ] Add proper Dev Agent Record section

**Estimated Effort:** 2-3 hours
**Owner:** _______________

---

### 8-37: Unified Publisher Onboarding Flow
**Problem:** Marked "Done" but 32/32 DoD items UNCHECKED, missing Dev Agent Record
**Current Status:** Done (INCORRECT)
**Actual State:** Tasks checked but DoD never validated

**Remediation Steps:**
1. [ ] Run all DoD validation checks (code quality, functionality, security, testing)
2. [ ] Execute E2E tests for all flows (new user, existing user, admin approval/rejection)
3. [ ] Verify security requirements (no email enumeration, reCAPTCHA, token expiry)
4. [ ] Check all 32 DoD items as they pass
5. [ ] Add Dev Agent Record with Completion Notes and File List
6. [ ] Convert AC section to checkbox format and verify each

**Estimated Effort:** 4-6 hours (mostly testing/verification)
**Owner:** _______________

---

### 8-2: Implement Calculation Logging
**Problem:** Claims complete but 0/8 ACs, 0/7 tasks, 0/30 subtasks checked
**Current Status:** review
**Actual State:** Has completion notes but zero checkboxes marked

**Remediation Steps:**
1. [ ] Verify each of the 7 tasks actually implemented in code
2. [ ] Run through each subtask and check if complete
3. [ ] Validate all 8 acceptance criteria against running system
4. [ ] Check all DoD items (24 total)
5. [ ] If work IS done: check all boxes, update status to done
6. [ ] If work NOT done: update status to in-progress, complete missing work

**Estimated Effort:** 1-2 hours (verification) or 8+ hours (if work missing)
**Owner:** _______________

---

### 8-11: City Source Tracking Legacy Column Cleanup
**Problem:** Migration file doesn't exist, schema mismatch
**Current Status:** ready-for-review
**Actual State:** Documentation describes non-existent implementation

**Remediation Steps:**
1. [ ] Investigate: Is source tracking already in base schema (00000000000001)?
2. [ ] Clarify actual column names: `source_id` vs `source_type_id`
3. [ ] Determine if legacy columns (wof_id, geonameid) ever existed
4. [ ] Either:
   - a) Update story to document existing state (if already done), OR
   - b) Create the missing migration and implement changes
5. [ ] Correct File List to reference actual files
6. [ ] Update status appropriately

**Estimated Effort:** 2-4 hours
**Owner:** _______________

---

### 8-34: Seconds Display Toggle with Rounding
**Problem:** 11/11 ACs unchecked, 7 tasks unchecked, all DoD unchecked
**Current Status:** ready-for-review
**Actual State:** Minimal work done despite status

**Remediation Steps:**
1. [ ] Complete Task 4: Add RoundingModeToggle to ZmanCard (5 subtasks)
2. [ ] Complete Task 5: Backend API for rounding mode (4 subtasks)
3. [ ] Complete Task 6: Connect frontend to backend (3 subtasks)
4. [ ] Complete Task 7: Anonymous zmanim page integration (4 subtasks)
5. [ ] Complete Task 8: Publisher algorithm page integration (3 subtasks)
6. [ ] Complete Task 9: Testing (5 subtasks)
7. [ ] Validate all 11 ACs and check boxes
8. [ ] Complete all DoD items

**Estimated Effort:** 8-12 hours
**Owner:** _______________

---

## P1 - High (This Sprint)

### 8-19: API Route Consolidation Deduplication
**Problem:** Only 3/10 ACs completed, 5 tasks deferred, 0/24 DoD checked
**Current Status:** review
**Actual State:** ~30% complete

**Remediation Steps:**
1. [ ] Complete deferred tasks: 2 (master registry), 5 (publisher filters), 6 (boundaries), 7 (metadata), 9 (swagger)
2. [ ] OR: Split into multiple smaller stories and close this as partially complete
3. [ ] Check all completed DoD items
4. [ ] Update status to reflect actual state

**Estimated Effort:** 6-10 hours OR split into 4 stories
**Owner:** _______________

---

### 8-27: Multi-Publisher Switcher with Cookie Persistence
**Problem:** 15 DoD items unchecked, missing Dev Agent Record
**Current Status:** ready-for-review
**Actual State:** Implementation tasks done but not validated

**Remediation Steps:**
1. [ ] Run through all 15 DoD checklist items
2. [ ] Execute manual testing for cookie persistence
3. [ ] Run E2E tests
4. [ ] Add Dev Agent Record section with Completion Notes and File List
5. [ ] Convert ACs to checkbox format and verify

**Estimated Effort:** 2-4 hours
**Owner:** _______________

---

### 8-15: React Query Cache Invalidation Bug Fixes
**Problem:** Task 7 (E2E tests) completely unchecked, 0/5 manual verification
**Current Status:** review
**Actual State:** Code done, testing not done

**Remediation Steps:**
1. [ ] Create E2E test for coverage add/remove updates
2. [ ] Create E2E test for location override updates
3. [ ] Create E2E test for profile update reflects immediately
4. [ ] Run manual verification (5 items)
5. [ ] Check all DoD items

**Estimated Effort:** 3-4 hours
**Owner:** _______________

---

### 8-31: Secure User Invitation Flow
**Problem:** Task 7 (Testing) completely unchecked, missing Dev Agent Record
**Current Status:** ready-for-review
**Actual State:** Implementation done, testing phase skipped

**Remediation Steps:**
1. [ ] Complete Task 7.1: E2E invite existing user flow
2. [ ] Complete Task 7.2: E2E invite new user flow
3. [ ] Complete Task 7.3: E2E expired token message
4. [ ] Complete Task 7.4: E2E admin cannot see if user exists
5. [ ] Complete Task 7.5: Security test API doesn't leak user existence
6. [ ] Add Dev Agent Record section
7. [ ] Check all DoD items

**Estimated Effort:** 3-4 hours
**Owner:** _______________

---

### 8-6: External API Bulk Zmanim Calculation
**Problem:** Core features (caching, performance) deferred, all 7 ACs unchecked
**Current Status:** review
**Actual State:** Basic implementation done, optimization deferred

**Remediation Steps:**
1. [ ] Complete Task 3: Add specialized caching for bulk requests
2. [ ] Complete Task 6: Performance testing (<2s for 365 days)
3. [ ] Verify and check all 7 ACs
4. [ ] Complete deferred DoD items (caching, integration tests, performance tests)
5. [ ] Run manual verification

**Estimated Effort:** 4-6 hours
**Owner:** _______________

---

### 8-26: Publisher Access Validation Security Fix
**Problem:** Missing Dev Agent Record, E2E unchecked
**Current Status:** ready-for-review
**Actual State:** Implementation complete, documentation incomplete

**Remediation Steps:**
1. [ ] Run E2E tests and check DoD item
2. [ ] Add Dev Agent Record section:
   - Context Reference
   - Agent Model Used
   - Debug Log References
   - Completion Notes List
   - File List
3. [ ] Update status to done

**Estimated Effort:** 1-2 hours
**Owner:** _______________

---

### 8-29: Unified User Preferences Cookie Persistence
**Problem:** Missing Dev Agent Record section
**Current Status:** ready-for-review
**Actual State:** All tasks/ACs checked, just missing formal record

**Remediation Steps:**
1. [ ] Convert Implementation Notes to proper Dev Agent Record format
2. [ ] Add File List with all modified files
3. [ ] Update status to done

**Estimated Effort:** 30 minutes
**Owner:** _______________

---

### 8-33: AI Explanation RAG Validation Enriched Context
**Problem:** E2E tests unchecked in DoD
**Current Status:** ready-for-review
**Actual State:** 99% complete, just E2E verification missing

**Remediation Steps:**
1. [ ] Run `cd tests && npx playwright test`
2. [ ] If passing, check DoD item
3. [ ] Update status to done

**Estimated Effort:** 30 minutes
**Owner:** _______________

---

## P2 - Medium (Next Sprint - Status/Documentation Fixes)

### 8-22: Version History Pattern Standardization
**Remediation:** Update status from `ready-for-dev` to `done`
**Effort:** 5 minutes

### 8-25: Master Registry Auth-Aware Consolidation
**Remediation:** Update status from `ready-for-dev` to `done`, add AC checkboxes
**Effort:** 15 minutes

### 8-10: Smart Search API with Context Parsing
**Remediation:** Update status from `ready-for-dev` to `done`, add AC checkboxes
**Effort:** 15 minutes

### 8-13: E2E Testing Search Geo Features
**Remediation:** Update status from `ready-for-dev` to `done`
**Effort:** 5 minutes

### 8-14: Unified Location Search API Frontend Migration
**Remediation:** Update status, add AC checkboxes, run deferred E2E tests
**Effort:** 1 hour

### 8-35: Zman Card Time Preview
**Remediation:** Acknowledge tests as future work, update status with tech debt note
**Effort:** 15 minutes

### 8-36: Extended Display Preferences Persistence
**Remediation:** Run E2E tests, check box, update status to done
**Effort:** 30 minutes

### 8-24: Soft Delete Pattern Documentation
**Remediation:** Add AC checkboxes, update status to done
**Effort:** 15 minutes

### 8-3: Activate Audit Trail
**Remediation:** Add AC checkboxes (currently numbered list)
**Effort:** 15 minutes

### 8-4: External API Clerk M2M Authentication
**Remediation:** Complete manual verification items, update status
**Effort:** 1 hour

---

## P3 - Low (As Capacity Allows)

### 8-1: Wire Algorithm Version History Routes
**Status:** review (CORRECT)
**Remediation:** Wait for frontend component, then complete E2E tests
**Blocked By:** Frontend version history component

### 8-5: External API List Publisher Zmanim
**Remediation:** Complete 4 manual verification items
**Effort:** 30 minutes

### 8-7: Rate Limiting for External API
**Remediation:** Document AC 6 as deferred stretch goal
**Effort:** 15 minutes

### 8-8: Geo Alternative Names Foreign Names Tables
**Status:** review (CORRECT)
**Remediation:** Awaiting review - no action needed

### 8-17: API Path Restructuring Gateway Authentication
**Remediation:** Task 6 requires infrastructure deployment
**Blocked By:** Infrastructure team

### 8-21: Backend Deployment Migration Automation
**Remediation:** Requires production deployment to validate
**Blocked By:** Production deployment

---

## Not Started - Requires Prioritization Decision

### 8-20: API Route Cleanup Phase 2
**Recommendation:** Close as "Will Not Do" or rescope to Epic 9
**Reason:** Agent analysis concluded story cannot be safely completed as written

### 8-28: Publisher Signup Captcha Bot Protection
**Status:** blocked (CORRECT)
**Recommendation:** Assign to team member with Clerk Dashboard access
**Effort:** 30 minutes manual configuration

### 8-30: User Publisher Entity Separation
**Status:** approved (not started)
**Recommendation:** Prioritize or move to Epic 9

### 8-32: Publisher Registration Email Verification
**Status:** approved (not started)
**Recommendation:** Prioritize or move to Epic 9

---

## Summary Metrics

| Priority | Stories | Total Effort Estimate |
|----------|---------|----------------------|
| P0 - Critical | 5 | 17-27 hours |
| P1 - High | 8 | 20-31 hours |
| P2 - Medium | 10 | 4-5 hours |
| P3 - Low | 6 | ~2 hours |
| **Total** | **29** | **43-65 hours** |

---

## Recommended Sprint Allocation

**Sprint 1 (Immediate):**
- Complete all P0 stories (5 stories, ~20 hours)
- Begin P1 stories with highest business impact

**Sprint 2:**
- Complete remaining P1 stories
- All P2 status/documentation fixes

**Sprint 3:**
- P3 items as capacity allows
- Decision on not-started stories (8-20, 8-28, 8-30, 8-32)

---

## Process Improvements

Based on this audit, recommend implementing:

1. **Pre-Review Checklist Gate:** Status cannot change to "review" until:
   - All ACs have checkboxes and are checked
   - All DoD items are checked
   - Dev Agent Record section exists with Completion Notes + File List

2. **Automated Validation:** CI check that fails if:
   - Story status is "done" but unchecked items exist
   - Dev Agent Record section is missing

3. **Code Verification Step:** Before marking story complete:
   - Verify referenced files actually exist
   - Run referenced tests and confirm they pass

4. **Regular Story Audits:** Weekly automated scan for status/completion mismatches
