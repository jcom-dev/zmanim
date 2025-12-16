# Story 5.19: Zman Request Review Workflow - Unified Edit/Review with Tag Approval Pipeline

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** Done
**Priority:** P1
**Story Points:** 13
**Dependencies:** 5.8 (Admin Review Page exists)

---

## Story

As an **admin**,
I want **to review zman requests using the same form as "Add to Registry" with approve/reject buttons, process new tag requests before the zman can be approved, and automatically email publishers about outcomes**,
So that **I can efficiently review requests with full editing capability, ensure tag quality, and keep publishers informed**.

---

## Background

Currently there are two separate UIs:
1. **Add to Registry** (`/admin/zmanim/registry`) - Full form for creating/editing zmanim
2. **Zman Requests** (`/admin/zman-requests`) - Simple list with basic dialog review

The current review dialog shows request details in a read-only format, but admins need the ability to edit fields before approving (fix typos, adjust formula, etc.). Instead of duplicating the form code, we should:
1. Extract the form into a reusable `ZmanRegistryForm` component
2. Use it in both "Add to Registry" and "Review Request" contexts
3. Add Approve/Reject buttons when in review mode
4. Handle new tag requests as a prerequisite step

**New Tag Request Pipeline:**
Publishers can request new tags when submitting a zman request (`zman_request_tags` table with `is_new_tag_request = true`). These must be processed BEFORE the zman can be approved:
1. Show pending tag requests with approve/reject for each
2. Disable zman approve button until all tag requests are resolved
3. Approved tags are automatically added to the zman request
4. Rejected tags are removed from the request

**Email Notifications:**
- On approval: Email publisher with approval confirmation + link to their zmanim
- On rejection: Email publisher with rejection reason from reviewer_notes

---

## Acceptance Criteria

### AC-5.19.1: Extract Reusable ZmanRegistryForm Component
- [x] Create `web/components/admin/ZmanRegistryForm.tsx` extracted from registry page
- [x] Form accepts `mode: 'create' | 'edit' | 'review'` prop
- [x] Form accepts `initialData` prop for edit/review modes
- [x] Form accepts `onSave` callback for create/edit modes
- [x] Form accepts `onApprove` and `onReject` callbacks for review mode
- [x] Form accepts `disabled` prop to make all fields read-only
- [x] Registry page (`/admin/zmanim/registry`) uses the new component
- [x] No code duplication between registry and review pages

### AC-5.19.2: Review Mode UI
- [x] When `mode='review'`, show source info banner (publisher name, submission date)
- [x] When `mode='review'`, show Approve/Reject buttons instead of Save
- [x] When `mode='review'`, fields are editable (admin can fix typos before approving)
- [x] Reviewer Notes field always visible in review mode
- [x] Show warning if admin made changes: "You modified the request. These changes will be saved."

### AC-5.19.3: Tag Request Approval Pipeline
- [x] Show "Pending Tag Requests" section above the form when reviewing
- [x] Each requested new tag shows: name, type, approve/reject buttons
- [x] Tag approval creates the tag in `zman_tags` table
- [x] Tag approval adds the new tag_id to the request's tag_ids
- [x] Tag rejection removes the tag request
- [x] Zman Approve button is disabled until all tag requests are resolved
- [x] Show message: "Resolve X pending tag request(s) before approving this zman"
- [x] Approved tags appear in the Tags section of the form (auto-selected)

### AC-5.19.4: Backend Tag Processing Endpoints
- [x] `POST /admin/zman-requests/:id/tags/:tagRequestId/approve` - Creates tag, returns new tag_id
- [x] `POST /admin/zman-requests/:id/tags/:tagRequestId/reject` - Removes tag request
- [x] `GetZmanRequestTags` query returns pending tag requests for a zman request
- [x] Approval flow: Create tag → Link to request → Return updated request

### AC-5.19.5: Review Page Integration
- [x] Review button opens full-page or large dialog with ZmanRegistryForm in review mode
- [x] Pre-populate form with request data (mapped to form field names)
- [x] On approve: Create/update zman in registry, update request status, send email
- [x] On reject: Update request status, send rejection email
- [x] After action: Return to requests list with success toast

### AC-5.19.6: Email Notifications
- [x] On approval: Email to `publisher_email` with subject "Your Zman Request Was Approved"
- [x] Approval email includes: zman name (Hebrew + English), registry link
- [x] On rejection: Email to `publisher_email` with subject "Your Zman Request Was Not Approved"
- [x] Rejection email includes: zman name, reviewer notes (reason)
- [x] Use existing email service pattern (if exists) or create simple transactional email

### AC-5.19.7: Auto-Add to Publisher's Zmanim
- [x] If request has `auto_add_on_approval = true` and is approved:
- [x] Automatically create `publisher_zmanim` entry for the requesting publisher
- [x] Copy the approved registry zman to their zmanim list
- [x] Include this in the approval email: "This zman has been added to your zmanim list"

---

## Tasks / Subtasks

- [x] Task 1: Extract ZmanRegistryForm Component (AC: 5.19.1)
  - [x] 1.1 Create `web/components/admin/ZmanRegistryForm.tsx`
  - [x] 1.2 Move form JSX from registry page to new component
  - [x] 1.3 Add mode, initialData, onSave, onApprove, onReject props
  - [x] 1.4 Add disabled prop for read-only state
  - [x] 1.5 Update registry page to use new component
  - [x] 1.6 Verify registry page still works (create/edit)

- [x] Task 2: Add Review Mode to Form (AC: 5.19.2)
  - [x] 2.1 Show source info banner when mode='review'
  - [x] 2.2 Change footer buttons based on mode (Save vs Approve/Reject)
  - [x] 2.3 Add Reviewer Notes field (always visible in review mode)
  - [x] 2.4 Track if admin modified any fields
  - [x] 2.5 Show "changes will be saved" warning if modified

- [x] Task 3: Tag Request Pipeline UI (AC: 5.19.3)
  - [x] 3.1 Add PendingTagRequests section to ZmanRegistryForm
  - [x] 3.2 Show each tag with name, type, approve/reject buttons
  - [x] 3.3 Call tag approve/reject endpoints on button click
  - [x] 3.4 Update form state when tags are approved (add to selected tags)
  - [x] 3.5 Disable Approve button until all tags resolved
  - [x] 3.6 Show count of pending tag requests

- [x] Task 4: Backend Tag Endpoints (AC: 5.19.4)
  - [x] 4.1 Add `ApproveTagRequest` SQLc query (create tag, return id)
  - [x] 4.2 Add `RejectTagRequest` SQLc query (delete request)
  - [x] 4.3 Create handler `POST /admin/zman-requests/:id/tags/:tagId/approve`
  - [x] 4.4 Create handler `POST /admin/zman-requests/:id/tags/:tagId/reject`
  - [x] 4.5 Update approval to link new tag_id to request

- [x] Task 5: Review Page Integration (AC: 5.19.5)
  - [x] 5.1 Update zman-requests page to open ZmanRegistryForm in review mode
  - [x] 5.2 Map request fields to form fields
  - [x] 5.3 Handle approve action (create registry zman, update status)
  - [x] 5.4 Handle reject action (update status only)
  - [x] 5.5 Show success toast and refresh list

- [x] Task 6: Email Notifications (AC: 5.19.6)
  - [x] 6.1 Check for existing email service in codebase
  - [x] 6.2 Create email templates for approval/rejection
  - [x] 6.3 Send approval email with zman details and link
  - [x] 6.4 Send rejection email with reason from reviewer_notes
  - [x] 6.5 Handle email errors gracefully (don't block approval)

- [x] Task 7: Auto-Add to Publisher (AC: 5.19.7)
  - [x] 7.1 Check `auto_add_on_approval` flag in approval handler
  - [x] 7.2 If true, call CreatePublisherZmanFromRegistry
  - [x] 7.3 Include confirmation in approval email
  - [x] 7.4 Handle case where publisher already has this zman

---

## Dev Notes

### Component Architecture

```
ZmanRegistryForm (new shared component)
├── Props: mode, initialData, onSave, onApprove, onReject, disabled
├── PendingTagRequests (when mode='review' && hasPendingTags)
│   ├── Tag row with approve/reject buttons
│   └── Blocking message for zman approval
├── Form Fields (all existing fields)
│   ├── Basic Info (key, names, transliteration)
│   ├── Tags Section (with approved tags auto-added)
│   ├── Formula & Description
│   └── Halachic Sources
├── Source Info Banner (when mode='review')
└── Footer
    ├── mode='create'|'edit': Cancel, Save
    └── mode='review': Cancel, Reject, Approve (disabled if pending tags)
```

### Field Mapping: Request → Form

```typescript
// Mapping zman request fields to form fields
const mapRequestToFormData = (request: ZmanRequest) => ({
  zman_key: request.requested_key,
  canonical_hebrew_name: request.requested_hebrew_name,
  canonical_english_name: request.requested_english_name,
  transliteration: request.transliteration || '',
  description: request.description || '',
  time_category: request.time_category,
  default_formula_dsl: request.requested_formula_dsl || '',
  halachic_notes: request.halachic_notes || '',
  halachic_source: request.halachic_source || '',
  is_core: false, // Request doesn't include this
  is_hidden: false, // Request doesn't include this
  sort_order: 0, // Request doesn't include this
  tag_ids: request.existing_tag_ids || [],
});
```

### Tag Request Approval Flow

```
1. Admin opens review
2. GetZmanRequestTags returns:
   - Existing tags (tag_id set, is_new_tag_request=false)
   - New tag requests (requested_tag_name set, is_new_tag_request=true)

3. For each new tag request:
   - Admin clicks Approve →
     POST /admin/zman-requests/:id/tags/:tagId/approve
     → Creates zman_tags entry
     → Updates zman_request_tags to link new tag_id
     → Returns new tag object
   - Admin clicks Reject →
     POST /admin/zman-requests/:id/tags/:tagId/reject
     → Deletes from zman_request_tags

4. When all tags resolved → Enable Approve button
5. On zman approval → Save with all tag_ids (existing + newly approved)
```

### Email Templates

**Approval Email:**
```
Subject: Your Zman Request Was Approved - {english_name}

Your request for the zman "{hebrew_name} / {english_name}" has been approved
and added to the Zmanim Registry.

{if auto_add_on_approval}
This zman has also been automatically added to your zmanim list.
{/if}

View the registry: {registry_link}

Thank you for contributing to the Zmanim community!
```

**Rejection Email:**
```
Subject: Your Zman Request Was Not Approved - {english_name}

Your request for the zman "{hebrew_name} / {english_name}" was not approved.

Reviewer Notes:
{reviewer_notes}

If you have questions, please contact support.
```

### Coding Standards (MUST FOLLOW)

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md). Key requirements:

**Backend:**
- Follow the 6-step handler pattern
- Use `AdminResolver` for admin endpoints (not PublisherResolver)
- Use SQLc for ALL database queries
- Use `slog` for structured logging
- Use response helpers

**Frontend:**
- Use `useAdminApi()` hook for admin API calls
- Use Tailwind design tokens
- Check `isLoaded` before accessing Clerk user data

**Database:**
- All queries in `api/internal/db/queries/*.sql`
- Regenerate SQLc after schema changes

### References

- [web/app/admin/zmanim/registry/page.tsx](../../../../web/app/admin/zmanim/registry/page.tsx) - Form to extract
- [web/app/admin/zman-requests/page.tsx](../../../../web/app/admin/zman-requests/page.tsx) - Current review page
- [api/internal/db/queries/zman_requests.sql](../../../../api/internal/db/queries/zman_requests.sql) - Existing queries
- [web/components/publisher/RequestZmanModal.tsx](../../../../web/components/publisher/RequestZmanModal.tsx) - Publisher request form
- [docs/coding-standards.md](../../coding-standards.md) - **AUTHORITATIVE SOURCE**

---

## Testing Requirements

### Unit Tests
- [ ] ZmanRegistryForm renders correctly in all three modes
- [ ] Tag approval updates form state correctly
- [ ] Approve button disabled when pending tags exist
- [ ] Field mapping from request to form is correct

### Integration Tests
- [ ] Tag approval endpoint creates tag and links to request
- [ ] Tag rejection endpoint removes request
- [ ] Zman approval creates registry entry with all tags
- [ ] Email service called on approval/rejection (mock)

### E2E Tests
- [ ] Admin can review request using full form
- [ ] Admin can approve/reject individual tags
- [ ] Approve button enables after all tags resolved
- [ ] Approval creates registry entry and sends email
- [ ] Auto-add creates publisher zman entry

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/5-19-zman-request-review-workflow-context.md (to be generated)

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes
Implementation completed on 2025-12-02:

**Frontend:**
- Created `web/components/admin/ZmanRegistryForm.tsx` - Reusable form component supporting create/edit/review modes
- Updated `web/app/admin/zmanim/registry/page.tsx` to use the new component
- Updated `web/app/admin/zman-requests/page.tsx` with full review functionality using ZmanRegistryForm
- Form includes source info banner, pending tag requests panel, reviewer notes, and approve/reject buttons

**Backend:**
- Added SQLc queries for tag approval pipeline in `api/internal/db/queries/zman_requests.sql`:
  - `GetZmanRequestTag`, `ApproveTagRequest`, `LinkTagToRequest`, `RejectTagRequest`
  - `CreatePublisherZmanFromRequest` for auto-add functionality
- Added handlers in `api/internal/handlers/master_registry.go`:
  - `AdminGetZmanRegistryRequestByID`, `AdminGetZmanRequestTags`
  - `AdminApproveTagRequest`, `AdminRejectTagRequest`
- Updated `AdminReviewZmanRegistryRequest` to support email notifications and auto-add to publisher
- Added routes in `api/cmd/api/main.go` for new endpoints

**Email Notifications:**
- Added templates in `api/internal/services/email_service.go`:
  - `SendZmanRequestApproved()` with approval confirmation email
  - `SendZmanRequestRejected()` with rejection email including reviewer notes
- Emails sent asynchronously after transaction commit to not block the response

**Auto-Add to Publisher:**
- When `auto_add_on_approval` is true and request is approved, automatically creates `publisher_zmanim` entry
- Uses `ON CONFLICT DO NOTHING` to handle case where publisher already has this zman

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story created per user request | Mary (Business Analyst) |
