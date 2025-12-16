# Story 5.8: Admin Zman Request Review Page

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 5.6 (Request New Zman API)
**FRs:** FR111, FR112, FR113 (Admin zman request review)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Pattern (6 Steps)" (follow exactly)
- "Backend Standards > Error Handling" (log errors, user-friendly messages)
- "Frontend Standards > Unified API Client" (use `useAdminApi()` hook for admin pages)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Data Integrity:**
- Add UNIQUE constraint on `master_zmanim_registry.zman_key` to prevent duplicate zman_keys on approval
- Validate zman_key format (lowercase, underscores, alphanumeric only)

**Transaction Safety:**
- The approval handler MUST use a database transaction for all operations
- If any step fails (registry entry, tags, auto-add), rollback entire transaction

---

## Story

As an **admin**,
I want **a page to review and manage zman requests**,
So that **I can approve or reject publisher submissions**.

---

## Acceptance Criteria

### AC-5.8.1: Requests Table Page
- [ ] Page at `/admin/zmanim/requests`
- [ ] Table with columns: Publisher Name, Hebrew/English Name, Time Category, Status, Date, Actions
- [ ] Sortable by date, status, publisher
- [ ] Pagination for large lists

### AC-5.8.2: Filtering
- [ ] Filter by status: pending, approved, rejected, all
- [ ] Search by publisher name or zman name
- [ ] Status tabs for quick filtering

### AC-5.8.3: Request Detail View
- [ ] Click row to open detail panel/dialog
- [ ] Shows all submitted fields
- [ ] Shows formula with syntax highlighting and validation status
- [ ] Shows requested tags (existing + new tag requests)
- [ ] Shows justification

### AC-5.8.4: Approve Workflow
- [ ] "Approve" button opens approval dialog
- [ ] Required fields in dialog:
  - zman_key (admin-defined unique identifier)
  - sort_order (integer)
- [ ] Optional fields:
  - is_core (boolean)
  - admin_notes
- [ ] Checkbox: "Create requested new tags"
- [ ] Checkboxes: select which tags to apply

### AC-5.8.5: Approval Processing
- [ ] On approve: zman added to master registry
- [ ] If auto_add_on_approval: zman added to publisher's list
- [ ] Publisher receives approval email with zman details
- [ ] Request status updated to "approved"

### AC-5.8.6: Reject Workflow
- [ ] "Reject" button opens rejection dialog
- [ ] Required field: rejection reason (text area)
- [ ] Publisher receives rejection email with reason
- [ ] Request status updated to "rejected"

### AC-5.8.7: Admin API Endpoints
- [ ] `GET /api/v1/admin/zmanim/requests` - list all requests with filtering
- [ ] `GET /api/v1/admin/zmanim/requests/{id}` - get request details
- [ ] `POST /api/v1/admin/zmanim/requests/{id}/approve` - approve request
- [ ] `POST /api/v1/admin/zmanim/requests/{id}/reject` - reject request

---

## Technical Context

### Admin API Endpoints

**Request/Response Shapes**
```go
// GET /api/v1/admin/zmanim/requests?status=pending
type AdminRequestsListResponse struct {
    Requests []AdminRequestSummary `json:"requests"`
    Total    int                   `json:"total"`
}

type AdminRequestSummary struct {
    ID              string  `json:"id"`
    PublisherName   string  `json:"publisher_name"`
    HebrewName      string  `json:"hebrew_name"`
    EnglishName     string  `json:"english_name"`
    TimeCategory    *string `json:"time_category"`
    Status          string  `json:"status"`
    CreatedAt       string  `json:"created_at"`
}

// POST /api/v1/admin/zmanim/requests/{id}/approve
type ApproveRequestInput struct {
    ZmanKey          string   `json:"zman_key" validate:"required"`
    SortOrder        int      `json:"sort_order"`
    IsCore           bool     `json:"is_core"`
    CreateNewTags    bool     `json:"create_new_tags"`
    ApprovedTagIDs   []string `json:"approved_tag_ids"`
    AdminNotes       *string  `json:"admin_notes"`
}

// POST /api/v1/admin/zmanim/requests/{id}/reject
type RejectRequestInput struct {
    Reason string `json:"reason" validate:"required"`
}
```

### Admin Handler Implementation

**File: `api/internal/handlers/admin_requests.go`**
```go
func (h *Handlers) AdminApproveZmanRequest(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Verify admin role
    if !h.isAdmin(r) {
        RespondForbidden(w, r, "Admin access required")
        return
    }

    requestID := chi.URLParam(r, "id")

    var req ApproveRequestInput
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Validate required fields
    if req.ZmanKey == "" {
        RespondValidationError(w, r, "zman_key is required", nil)
        return
    }

    // Get the original request
    request, err := h.db.Queries.GetZmanRequestByID(ctx, uuid.MustParse(requestID))
    if err != nil {
        RespondNotFound(w, r, "Request not found")
        return
    }

    // Start transaction
    tx, _ := h.db.Pool.Begin(ctx)
    defer tx.Rollback(ctx)
    qtx := h.db.Queries.WithTx(tx)

    // 1. Create master registry entry
    zman, err := qtx.CreateMasterRegistryEntry(ctx, sqlcgen.CreateMasterRegistryEntryParams{
        ZmanKey:        req.ZmanKey,
        HebrewName:     request.RequestedHebrewName,
        EnglishName:    request.RequestedEnglishName,
        Transliteration: request.Transliteration,
        TimeCategory:   request.TimeCategory,
        DefaultFormula: request.FormulaDSL,
        SortOrder:      req.SortOrder,
        IsCore:         req.IsCore,
    })
    if err != nil {
        slog.Error("failed to create registry entry", "error", err)
        RespondInternalError(w, r, "Failed to create zman")
        return
    }

    // 2. Create new tags if requested
    if req.CreateNewTags {
        newTagRequests, _ := qtx.GetNewTagRequestsForRequest(ctx, request.ID)
        for _, tagReq := range newTagRequests {
            qtx.CreateTag(ctx, sqlcgen.CreateTagParams{
                Name:        tagReq.RequestedTagName,
                TagType:     tagReq.RequestedTagType,
                Description: "",
            })
        }
    }

    // 3. Apply approved tags
    for _, tagID := range req.ApprovedTagIDs {
        qtx.AddTagToZman(ctx, sqlcgen.AddTagToZmanParams{
            ZmanID: zman.ID,
            TagID:  uuid.MustParse(tagID),
        })
    }

    // 4. Auto-add to publisher if requested
    if request.AutoAddOnApproval {
        qtx.AddZmanToPublisher(ctx, sqlcgen.AddZmanToPublisherParams{
            PublisherID: request.PublisherID,
            ZmanKey:     req.ZmanKey,
        })
    }

    // 5. Update request status
    qtx.UpdateZmanRequestStatus(ctx, sqlcgen.UpdateZmanRequestStatusParams{
        ID:            request.ID,
        Status:        "approved",
        ReviewerNotes: req.AdminNotes,
        ReviewedAt:    sql.NullTime{Time: time.Now(), Valid: true},
    })

    tx.Commit(ctx)

    // 6. Send approval email
    go h.emailService.SendZmanRequestApproved(
        request.PublisherEmail,
        request.PublisherName,
        request.RequestedEnglishName,
        req.ZmanKey,
    )

    RespondJSON(w, r, http.StatusOK, map[string]string{"status": "approved"})
}
```

### Frontend Component

**File: `web/components/admin/ZmanRequestReview.tsx`**
```typescript
interface ZmanRequestReviewProps {
  request: ZmanRequestDetail;
  onApprove: (data: ApproveData) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export function ZmanRequestReview({ request, onApprove, onReject }: ZmanRequestReviewProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{request.englishName}</h2>
          <p dir="rtl" className="text-lg text-muted-foreground">{request.hebrewName}</p>
        </div>
        <Badge variant={getStatusVariant(request.status)}>{request.status}</Badge>
      </div>

      {/* Publisher Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Submitted By</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{request.publisherName}</p>
          <p className="text-sm text-muted-foreground">{request.publisherEmail}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(request.createdAt)}
          </p>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Request Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {request.timeCategory && (
            <div>
              <Label>Time Category</Label>
              <p className="capitalize">{request.timeCategory}</p>
            </div>
          )}
          {request.description && (
            <div>
              <Label>Description</Label>
              <p>{request.description}</p>
            </div>
          )}
          {request.halachicSource && (
            <div>
              <Label>Halachic Source</Label>
              <p>{request.halachicSource}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formula */}
      {request.formulaDsl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              Formula
              {request.formulaValid ? (
                <Badge variant="outline" className="text-green-600">Valid</Badge>
              ) : (
                <Badge variant="outline" className="text-red-600">Invalid</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded text-sm">{request.formulaDsl}</pre>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {request.tags.map((tag) => (
              <Badge key={tag.id}>{tag.name}</Badge>
            ))}
            {request.newTagRequests.map((tag, i) => (
              <Badge key={i} variant="outline" className="border-yellow-500">
                {tag.name} <span className="text-yellow-600 ml-1">(new)</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Justification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Justification</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{request.justification}</p>
        </CardContent>
      </Card>

      {/* Actions */}
      {request.status === 'pending' && (
        <div className="flex gap-2">
          <Button onClick={() => setShowApproveDialog(true)}>Approve</Button>
          <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>Reject</Button>
        </div>
      )}

      <ApproveDialog
        open={showApproveDialog}
        onClose={() => setShowApproveDialog(false)}
        onApprove={onApprove}
        request={request}
      />

      <RejectDialog
        open={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onReject={onReject}
      />
    </div>
  );
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Admin API Endpoints
  - [ ] 1.1 Create `api/internal/handlers/admin_requests.go`
  - [ ] 1.2 Implement AdminListZmanRequests handler
  - [ ] 1.3 Implement AdminGetZmanRequest handler
  - [ ] 1.4 Implement AdminApproveZmanRequest handler
  - [ ] 1.5 Implement AdminRejectZmanRequest handler

- [ ] Task 2: Create SQLc Queries
  - [ ] 2.1 Add admin request queries to SQLc
  - [ ] 2.2 CreateMasterRegistryEntry query
  - [ ] 2.3 UpdateZmanRequestStatus query
  - [ ] 2.4 Run `sqlc generate`

- [ ] Task 3: Create Admin Page
  - [ ] 3.1 Create `web/app/admin/zmanim/requests/page.tsx`
  - [ ] 3.2 Implement table with sorting/filtering
  - [ ] 3.3 Add status tabs
  - [ ] 3.4 Add search functionality

- [ ] Task 4: Create Review Component
  - [ ] 4.1 Create `web/components/admin/ZmanRequestReview.tsx`
  - [ ] 4.2 Display all request details
  - [ ] 4.3 Formula syntax highlighting

- [ ] Task 5: Create Approve Dialog
  - [ ] 5.1 Create ApproveDialog component
  - [ ] 5.2 Form for zman_key, sort_order, is_core
  - [ ] 5.3 Tag selection checkboxes
  - [ ] 5.4 "Create new tags" option

- [ ] Task 6: Create Reject Dialog
  - [ ] 6.1 Create RejectDialog component
  - [ ] 6.2 Rejection reason textarea
  - [ ] 6.3 Confirmation before submit

- [ ] Task 7: Email Templates
  - [ ] 7.1 Create "zman-request-approved" template
  - [ ] 7.2 Create "zman-request-rejected" template
  - [ ] 7.3 Add send methods to EmailService

- [ ] Task 8: Testing
  - [ ] 8.1 Test listing with filters
  - [ ] 8.2 Test approval workflow
  - [ ] 8.3 Test rejection workflow
  - [ ] 8.4 Verify emails sent
  - [ ] 8.5 Verify auto-add to publisher

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Admin API endpoints working
- [ ] Requests table with filtering
- [ ] Approve dialog with all fields (zman_key validated for uniqueness)
- [ ] Reject dialog with reason
- [ ] Emails sent on approve/reject
- [ ] Auto-add to publisher working
- [ ] Duplicate zman_key detection and error handling
- [ ] All approval operations in a single transaction
- [ ] Uses `useAdminApi()` hook (not raw fetch)

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/internal/handlers/admin_requests.go` | Create | Admin request handlers |
| `web/app/admin/zmanim/requests/page.tsx` | Create | Admin requests page |
| `web/components/admin/ZmanRequestReview.tsx` | Create | Request detail component |
| `web/components/admin/ApproveDialog.tsx` | Create | Approval form dialog |
| `web/components/admin/RejectDialog.tsx` | Create | Rejection dialog |
| `api/internal/services/email_service.go` | Modify | Add approval/rejection emails |
