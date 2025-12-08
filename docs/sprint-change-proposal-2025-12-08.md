# Sprint Change Proposal - Epic 6 Requirement Correction

**Date:** 2025-12-08
**Proposal ID:** SCP-2025-12-08-001
**Epic Affected:** Epic 6 - Code Cleanup, Consolidation & Publisher Data Overrides
**Status:** APPROVED

---

## 1. Issue Summary

### Problem Statement

Epic 6 included a "Tag Correction Request Workflow" (Section 9 of Story 6.3) that was **incorrectly specified**. This feature would have allowed publishers to request changes to tag assignments on master registry zmanim.

**The actual requirement** is for a **Location Data Override & Correction System** - allowing publishers to manage city lat/long/elevation data, not tag corrections.

### Issue Type
- **Misunderstanding of original requirements**

### Discovery Context
- Identified during Sprint Change Navigation workflow
- User clarification: "Tag Correction Request Workflow - that was a complete mistake"

---

## 2. Impact Analysis

### Epic Impact

| Item | Impact |
|------|--------|
| Epic 6 completion | Can continue with modifications |
| Future epics | No impact |
| Epic priority/order | No change |

### Artifact Changes Required

| Artifact | Change Type | Details |
|----------|-------------|---------|
| Story 6.3 | REMOVE | Delete "Tag Correction Request Workflow" section (~230 lines) |
| Story 6.4 | ENHANCE | Add Inline Location Map View component |
| Story 6.5 | ENHANCE | Add admin direct edit capability + required emails |
| Epic 6 doc | UPDATE | Remove tag correction, update summary table |

---

## 3. Recommended Path Forward

**Selected Approach:** Direct Adjustment

**Rationale:**
- No rollback needed - tag correction workflow was not implemented
- Changes fit within existing epic structure
- Minimal timeline impact (+5 story points)
- Features align with actual business needs

---

## 4. Detailed Change Proposals

### Change 1: Remove Tag Correction from Story 6.3

**Files Modified:**
- `docs/sprint-artifacts/stories/6-3-unified-tag-manager.md`
- `docs/sprint-artifacts/epic-6-cleanup-and-overrides.md`

**Changes:**
- Removed AC-6.3.8 (Tag Correction Request Workflow)
- Removed Task 8 (Tag Correction Request Database)
- Removed Tag Correction Request Schema from Dev Notes

**Story Points Impact:** None (8 points unchanged)

---

### Change 2: Add Inline Location Map View to Story 6.4

**Files Modified:**
- `docs/sprint-artifacts/stories/6-4-publisher-location-overrides.md`

**New Acceptance Criteria:**
- AC-6.4.7: Inline Location Map View Component
- AC-6.4.8: Integrate Map View with Coverage Page
- AC-6.4.9: End-to-End Testing (updated)

**New Component:** `web/components/shared/LocationMapView.tsx`

**Features:**
- Display-only map (no click-to-select)
- NavigationControl (+/- zoom buttons)
- GeolocateControl (user location)
- Drag to pan, scroll wheel zoom, pinch zoom
- **Non-city locations:** Boundary polygon with dashed outline
- **City locations:** Street-level zoom, dot marker, hover tooltip (lat/long, elevation, timezone)
- Action buttons below map: "Override for My Publisher", "Request Public Correction"

**Story Points Impact:** 8 → 10 (+2 points)

---

### Change 3: Add Admin Direct Edit + Required Emails to Story 6.5

**Files Modified:**
- `docs/sprint-artifacts/stories/6-5-public-correction-requests.md`

**New Acceptance Criteria:**
- AC-6.5.9: Admin Direct Edit Capability
- AC-6.5.10: Email Notifications (Required)

**New Endpoints:**
- `PUT /api/v1/admin/cities/{cityId}` - Admin direct edit

**New Components:**
- `web/components/admin/AdminCityEditDialog.tsx`
- `api/internal/emails/correction-approved.tsx`
- `api/internal/emails/correction-rejected.tsx`

**Email Notifications:**
- Approval email: Subject, approved values, thank you
- Rejection email: Subject, admin review notes explaining why

**Story Points Impact:** 13 → 16 (+3 points)

---

### Change 4: Update Epic 6 Summary

**Old Summary:**
| Story | Points |
|-------|--------|
| 6.1 | 3 |
| 6.2 | 5 |
| 6.3 | 8 |
| 6.4 | 8 |
| 6.5 | 13 |
| 6.6 | 5 |
| **TOTAL** | **42** |

**New Summary:**
| Story | Points |
|-------|--------|
| 6.1 | 3 |
| 6.2 | 5 |
| 6.3 | 8 |
| 6.4 | 10 |
| 6.5 | 16 |
| 6.6 | 5 |
| **TOTAL** | **47** |

**Total Point Change:** +5 points (42 → 47)

---

## 5. Implementation Handoff

### Change Scope Classification
**Moderate** - Requires backlog update and story modifications

### Handoff Recipients
- **Scrum Master (Bob):** Story file updates - COMPLETED
- **Development Team:** Implement updated stories when ready

### Files Modified

| File | Status |
|------|--------|
| `docs/sprint-artifacts/stories/6-3-unified-tag-manager.md` | Updated |
| `docs/sprint-artifacts/stories/6-4-publisher-location-overrides.md` | Updated |
| `docs/sprint-artifacts/stories/6-5-public-correction-requests.md` | Updated |
| `docs/sprint-artifacts/epic-6-cleanup-and-overrides.md` | Updated |
| `docs/sprint-change-proposal-2025-12-08.md` | Created |

---

## 6. Success Criteria

- [x] Tag Correction Request Workflow removed from Story 6.3
- [x] Inline Location Map View added to Story 6.4
- [x] Admin direct edit capability added to Story 6.5
- [x] Email notifications marked as required (not future)
- [x] Epic 6 summary table updated with new points
- [x] All story files reflect approved changes
- [ ] Stories ready for development

---

## 7. Approval

**Proposal Status:** APPROVED

**Approved By:** BMad
**Approval Date:** 2025-12-08

---

**Generated:** 2025-12-08
**Workflow:** Correct-Course (Sprint Change Management)
**Agent:** Bob (Scrum Master)
