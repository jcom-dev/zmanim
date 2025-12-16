# Story 5.19 Context: Zman Request Review Workflow

**Generated:** 2025-12-02
**Story:** [5-19-zman-request-review-workflow.md](5-19-zman-request-review-workflow.md)
**Purpose:** Technical context for implementing unified review form, tag approval pipeline, and email notifications

---

## Overview

This story unifies the "Add to Registry" and "Review Request" workflows by:
1. Extracting form into reusable `ZmanRegistryForm` component
2. Adding review mode with Approve/Reject buttons
3. Implementing tag approval pipeline (block zman approval until tags resolved)
4. Adding email notifications on approval/rejection

---

## Current Architecture

### Admin Registry Page (Source to Extract)

**File:** `web/app/admin/zmanim/registry/page.tsx` (1081 lines)

Key sections to extract:
- **Form State** (lines 199-213): All the form field state variables
- **Form Dialog** (lines 724-1044): The entire form UI including:
  - Basic Info (zman_key, time_category)
  - Tags Section with tag selection
  - Names (hebrew, english, transliteration)
  - Formula DSL
  - Description, halachic notes, halachic source
  - Checkboxes (is_core, is_hidden)
  - Sort order

```typescript
// Current form state structure
const [formData, setFormData] = useState({
  zman_key: '',
  canonical_hebrew_name: '',
  canonical_english_name: '',
  transliteration: '',
  description: '',
  halachic_notes: '',
  halachic_source: '',
  time_category: 'sunrise',
  default_formula_dsl: '',
  is_core: false,
  is_hidden: false,
  sort_order: 0,
  tag_ids: [] as string[],
});
```

### Admin Zman Requests Page (Current Review)

**File:** `web/app/admin/zman-requests/page.tsx` (517 lines)

Current limitations:
- Review dialog shows read-only request details
- No ability to edit before approving
- No tag request handling
- No email notifications

```typescript
// Current ZmanRequest interface
interface ZmanRequest {
  id: string;
  publisher_id: string;
  requested_key: string;
  requested_hebrew_name: string;
  requested_english_name: string;
  transliteration?: string;
  time_category: string;
  description?: string;
  halachic_notes?: string;
  halachic_source?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  reviewer_notes?: string;
  publisher_name?: string;
  created_at: string;
}
```

### Backend Zman Request Queries

**File:** `api/internal/db/queries/zman_requests.sql`

Key existing queries:
- `CreateZmanRequest` - Create request with all fields
- `GetZmanRequest` - Get single request with publisher name
- `GetAllZmanRequests` - List for admin with status filter
- `ApproveZmanRequest` - Update status to approved
- `RejectZmanRequest` - Update status to rejected
- `AddZmanRequestTag` - Link existing tag to request
- `AddZmanRequestNewTag` - Request new tag (is_new_tag_request=true)
- `GetZmanRequestTags` - Get all tags for a request (existing + requested)

```sql
-- Current GetZmanRequestTags query (line 136-151)
SELECT
    zrt.id,
    zrt.request_id,
    zrt.tag_id,
    zrt.requested_tag_name,
    zrt.requested_tag_type,
    zrt.is_new_tag_request,
    zrt.created_at,
    zt.tag_key as existing_tag_key,
    zt.name as existing_tag_name,
    zt.tag_type as existing_tag_type
FROM zman_request_tags zrt
LEFT JOIN zman_tags zt ON zrt.tag_id = zt.id
WHERE zrt.request_id = $1;
```

### Database Schema

**Table: zman_request_tags** (from migration 00000000000024)

```sql
CREATE TABLE IF NOT EXISTS zman_request_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES zman_registry_requests(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES zman_tags(id),           -- NULL if is_new_tag_request=true
    requested_tag_name TEXT,                        -- Set if is_new_tag_request=true
    requested_tag_type TEXT,                        -- Set if is_new_tag_request=true
    is_new_tag_request BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Table: zman_registry_requests**

```sql
-- Key fields
publisher_id UUID NOT NULL,
requested_key TEXT NOT NULL,
requested_hebrew_name TEXT NOT NULL,
requested_english_name TEXT NOT NULL,
transliteration TEXT,
requested_formula_dsl TEXT,
time_category TEXT NOT NULL,
description TEXT,
halachic_notes TEXT,
halachic_source TEXT,
publisher_email TEXT,                -- For email notifications
publisher_name TEXT,
auto_add_on_approval BOOLEAN DEFAULT true,
status TEXT DEFAULT 'pending',
reviewed_by TEXT,
reviewed_at TIMESTAMPTZ,
reviewer_notes TEXT
```

---

## Implementation Tasks Detail

### Task 1: Extract ZmanRegistryForm Component

**Create:** `web/components/admin/ZmanRegistryForm.tsx`

```typescript
interface ZmanRegistryFormProps {
  // Mode determines button behavior
  mode: 'create' | 'edit' | 'review';

  // Initial data for edit/review modes
  initialData?: Partial<ZmanFormData>;

  // Callbacks based on mode
  onSave?: (data: ZmanFormData) => Promise<void>;
  onApprove?: (data: ZmanFormData, reviewerNotes: string) => Promise<void>;
  onReject?: (reviewerNotes: string) => Promise<void>;
  onCancel?: () => void;

  // For review mode - show source info
  sourceInfo?: {
    publisherName: string;
    publisherEmail: string;
    submittedAt: string;
    requestId: string;
  };

  // For review mode - pending tag requests
  pendingTagRequests?: PendingTagRequest[];
  onApproveTag?: (tagRequestId: string) => Promise<void>;
  onRejectTag?: (tagRequestId: string) => Promise<void>;

  // All available tags for selection
  availableTags: ZmanTag[];

  // Loading states
  isLoading?: boolean;
  isSaving?: boolean;
}

interface ZmanFormData {
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration: string;
  description: string;
  halachic_notes: string;
  halachic_source: string;
  time_category: string;
  default_formula_dsl: string;
  is_core: boolean;
  is_hidden: boolean;
  sort_order: number;
  tag_ids: string[];
}

interface PendingTagRequest {
  id: string;
  requested_tag_name: string;
  requested_tag_type: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

### Task 2: Add Review Mode UI

**Source Info Banner (review mode only):**
```tsx
{mode === 'review' && sourceInfo && (
  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
      <User className="h-4 w-4" />
      <span className="font-medium">Request from {sourceInfo.publisherName}</span>
    </div>
    <div className="mt-1 text-sm text-blue-600 dark:text-blue-400">
      Submitted {formatDate(sourceInfo.submittedAt)} • {sourceInfo.publisherEmail}
    </div>
  </div>
)}
```

**Footer Buttons by Mode:**
```tsx
<DialogFooter>
  <Button variant="outline" onClick={onCancel} disabled={isSaving}>
    Cancel
  </Button>

  {mode === 'review' ? (
    <>
      <Button
        variant="destructive"
        onClick={() => onReject?.(reviewerNotes)}
        disabled={isSaving}
      >
        <XCircle className="h-4 w-4 mr-2" />
        Reject
      </Button>
      <Button
        onClick={() => onApprove?.(formData, reviewerNotes)}
        disabled={isSaving || hasPendingTags}
        className="bg-green-600 hover:bg-green-700"
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Approve
      </Button>
    </>
  ) : (
    <Button onClick={() => onSave?.(formData)} disabled={isSaving}>
      {mode === 'create' ? 'Create' : 'Update'}
    </Button>
  )}
</DialogFooter>
```

### Task 3: Tag Request Pipeline UI

**PendingTagRequests Section:**
```tsx
{mode === 'review' && pendingTagRequests && pendingTagRequests.length > 0 && (
  <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
    <div className="flex items-center gap-2 mb-3">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <span className="font-medium text-amber-700 dark:text-amber-300">
        {pendingTagRequests.filter(t => t.status === 'pending').length} Pending Tag Request(s)
      </span>
    </div>
    <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
      Resolve all tag requests before approving this zman.
    </p>
    <div className="space-y-2">
      {pendingTagRequests.map((tag) => (
        <div
          key={tag.id}
          className="flex items-center justify-between p-2 bg-white dark:bg-background rounded border"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatTagName(tag.requested_tag_name)}</span>
            <Badge variant="outline" className="text-xs">
              {tag.requested_tag_type}
            </Badge>
          </div>
          {tag.status === 'pending' ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRejectTag?.(tag.id)}
                className="h-7 text-destructive hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onApproveTag?.(tag.id)}
                className="h-7 text-green-600 hover:text-green-700"
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Badge variant={tag.status === 'approved' ? 'default' : 'destructive'}>
              {tag.status}
            </Badge>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

### Task 4: Backend Tag Endpoints

**Add to:** `api/internal/db/queries/zman_requests.sql`

```sql
-- name: ApproveTagRequest :one
-- Approve a tag request: create the tag, link it to the request
WITH new_tag AS (
    INSERT INTO zman_tags (tag_key, name, display_name_hebrew, display_name_english, tag_type)
    SELECT
        zrt.requested_tag_name,
        zrt.requested_tag_name,
        zrt.requested_tag_name,
        zrt.requested_tag_name,
        zrt.requested_tag_type
    FROM zman_request_tags zrt
    WHERE zrt.id = $1
    RETURNING id
)
UPDATE zman_request_tags
SET tag_id = (SELECT id FROM new_tag),
    is_new_tag_request = false
WHERE id = $1
RETURNING id, tag_id, requested_tag_name, requested_tag_type;

-- name: RejectTagRequest :exec
-- Reject a tag request: remove it from the request
DELETE FROM zman_request_tags WHERE id = $1;

-- name: GetPendingTagRequestsForZman :many
-- Get pending tag requests for a zman request
SELECT
    id,
    request_id,
    requested_tag_name,
    requested_tag_type,
    is_new_tag_request
FROM zman_request_tags
WHERE request_id = $1 AND is_new_tag_request = true;
```

**Add handlers to:** `api/internal/handlers/admin.go`

```go
// POST /admin/zman-requests/:id/tags/:tagId/approve
func (h *Handlers) ApproveTagRequest(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Verify admin access
    if !h.adminResolver.IsAdmin(r) {
        RespondForbidden(w, r, "Admin access required")
        return
    }

    // Step 2: Extract URL params
    requestID := chi.URLParam(r, "id")
    tagID := chi.URLParam(r, "tagId")

    // Step 3: No body needed

    // Step 4: Validate UUIDs
    requestUUID, err := uuid.Parse(requestID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid request ID")
        return
    }
    tagUUID, err := uuid.Parse(tagID)
    if err != nil {
        RespondBadRequest(w, r, "Invalid tag request ID")
        return
    }

    // Step 5: Approve the tag request
    result, err := h.db.Queries.ApproveTagRequest(ctx, tagUUID)
    if err != nil {
        slog.Error("failed to approve tag request", "error", err, "tag_id", tagID)
        RespondInternalError(w, r, "Failed to approve tag")
        return
    }

    // Step 6: Respond
    RespondJSON(w, r, http.StatusOK, result)
}
```

### Task 5: Review Page Integration

**Update:** `web/app/admin/zman-requests/page.tsx`

```typescript
// Map request data to form data
const mapRequestToFormData = (request: ZmanRequest): Partial<ZmanFormData> => ({
  zman_key: request.requested_key,
  canonical_hebrew_name: request.requested_hebrew_name,
  canonical_english_name: request.requested_english_name,
  transliteration: request.transliteration || '',
  description: request.description || '',
  time_category: request.time_category,
  default_formula_dsl: request.requested_formula_dsl || '',
  halachic_notes: request.halachic_notes || '',
  halachic_source: request.halachic_source || '',
  is_core: false,
  is_hidden: false,
  sort_order: 0,
  tag_ids: request.existing_tag_ids || [],
});

// Handle approve
const handleApprove = async (formData: ZmanFormData, reviewerNotes: string) => {
  // 1. Create registry zman with (possibly modified) data
  await api.post('/admin/registry/zmanim', {
    body: JSON.stringify({
      ...formData,
      zman_key: formData.zman_key,
    }),
  });

  // 2. Update request status
  await api.put(`/admin/zman-requests/${selectedRequest.id}`, {
    body: JSON.stringify({
      status: 'approved',
      reviewer_notes: reviewerNotes,
    }),
  });

  // 3. Send email (handled by backend)
  // 4. Auto-add to publisher if flag set (handled by backend)

  toast.success('Request approved');
  setReviewDialogOpen(false);
  fetchRequests();
};
```

### Task 6: Email Notifications

**Check existing email service:**
```bash
grep -r "email" api/internal/services/
grep -r "mail" api/internal/
```

**If no email service exists, create:** `api/internal/services/email_service.go`

```go
package services

import (
    "fmt"
    "net/smtp"
)

type EmailService struct {
    smtpHost     string
    smtpPort     string
    senderEmail  string
    senderName   string
}

func NewEmailService(host, port, email, name string) *EmailService {
    return &EmailService{
        smtpHost:    host,
        smtpPort:    port,
        senderEmail: email,
        senderName:  name,
    }
}

func (s *EmailService) SendZmanApproved(to, hebrewName, englishName string, autoAdded bool) error {
    subject := fmt.Sprintf("Your Zman Request Was Approved - %s", englishName)

    body := fmt.Sprintf(`Your request for the zman "%s / %s" has been approved and added to the Zmanim Registry.

%s

Thank you for contributing to the Zmanim community!`,
        hebrewName,
        englishName,
        conditionalAutoAddMessage(autoAdded),
    )

    return s.sendEmail(to, subject, body)
}

func (s *EmailService) SendZmanRejected(to, hebrewName, englishName, reason string) error {
    subject := fmt.Sprintf("Your Zman Request Was Not Approved - %s", englishName)

    body := fmt.Sprintf(`Your request for the zman "%s / %s" was not approved.

Reviewer Notes:
%s

If you have questions, please contact support.`,
        hebrewName,
        englishName,
        reason,
    )

    return s.sendEmail(to, subject, body)
}
```

### Task 7: Auto-Add to Publisher

**In approval handler:**
```go
// After creating registry zman, check auto_add flag
if request.AutoAddOnApproval {
    // Copy to publisher's zmanim
    _, err = h.db.Queries.CreatePublisherZmanFromRegistry(ctx, sqlcgen.CreatePublisherZmanFromRegistryParams{
        PublisherID: request.PublisherID,
        MasterZmanID: newZmanID,
        // ... other fields copied from registry
    })
    if err != nil {
        slog.Warn("failed to auto-add zman to publisher", "error", err, "publisher_id", request.PublisherID)
        // Don't fail the approval, just log
    }
}
```

---

## Field Mapping Reference

| Request Field | Form Field |
|---------------|------------|
| requested_key | zman_key |
| requested_hebrew_name | canonical_hebrew_name |
| requested_english_name | canonical_english_name |
| transliteration | transliteration |
| description | description |
| requested_formula_dsl | default_formula_dsl |
| time_category | time_category |
| halachic_notes | halachic_notes |
| halachic_source | halachic_source |
| (existing_tag_ids) | tag_ids |
| N/A | is_core (default: false) |
| N/A | is_hidden (default: false) |
| N/A | sort_order (default: 0) |

---

## API Endpoints

### Existing Endpoints
- `GET /admin/zman-requests` - List requests
- `GET /admin/zman-requests/:id` - Get single request
- `PUT /admin/zman-requests/:id` - Update status (approve/reject)
- `POST /admin/registry/zmanim` - Create registry zman
- `GET /admin/registry/tags` - List all tags

### New Endpoints
- `POST /admin/zman-requests/:id/tags/:tagId/approve` - Approve tag request
- `POST /admin/zman-requests/:id/tags/:tagId/reject` - Reject tag request
- `GET /admin/zman-requests/:id/tags` - Get tags for request (existing + pending)

---

## Files to Modify/Create

### Create
1. `web/components/admin/ZmanRegistryForm.tsx` - Extracted form component

### Modify
2. `web/app/admin/zmanim/registry/page.tsx` - Use ZmanRegistryForm
3. `web/app/admin/zman-requests/page.tsx` - Use ZmanRegistryForm in review mode
4. `api/internal/db/queries/zman_requests.sql` - Add tag approval queries
5. `api/internal/handlers/admin.go` - Add tag approval handlers
6. `api/internal/services/email_service.go` - Create or extend for notifications
7. `api/cmd/api/main.go` - Register new routes

---

## Coding Standards Reference

**CRITICAL:** All implementation MUST strictly follow [docs/coding-standards.md](../../coding-standards.md).

**Backend:**
- 6-step handler pattern
- AdminResolver for admin endpoints
- SQLc for all database queries
- slog for structured logging
- Response helpers

**Frontend:**
- useAdminApi() for admin API calls
- Tailwind design tokens
- isLoaded checks for Clerk

---

## Testing Checklist

### Unit Tests
- [ ] ZmanRegistryForm renders in create mode
- [ ] ZmanRegistryForm renders in edit mode with initialData
- [ ] ZmanRegistryForm renders in review mode with sourceInfo
- [ ] Tag approval updates form tag_ids
- [ ] Approve button disabled when pending tags exist

### Integration Tests
- [ ] ApproveTagRequest creates tag and links to request
- [ ] RejectTagRequest removes tag request
- [ ] Zman approval creates registry entry
- [ ] Email service called on approval (mock)
- [ ] Auto-add creates publisher zman when flag set

### E2E Tests
- [ ] Admin opens review with full form
- [ ] Admin can approve/reject individual tags
- [ ] Approve button enables after all tags resolved
- [ ] Approval creates registry entry
- [ ] Rejection updates status

---

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| Extract form component | Medium | ~400 lines to extract, add props |
| Review mode UI | Low | Add conditional rendering |
| Tag pipeline UI | Medium | New section with state management |
| Backend tag endpoints | Medium | 2 new endpoints, queries |
| Review page integration | Low | Use new component |
| Email notifications | Medium | May need new service |
| Auto-add to publisher | Low | Conditional in approval |

**Total Story Points: 13** (as estimated)
