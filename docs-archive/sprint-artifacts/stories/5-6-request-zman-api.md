# Story 5.6: Request New Zman API & Email Notifications

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 5.0 (Database Schema)
**FRs:** FR107, FR108 (Request new zman API and notifications)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Pattern (6 Steps)" (follow exactly)
- "Backend Standards > Error Handling" (log errors, user-friendly messages)
- "Backend Standards > SQLc Integration" (query definitions)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Configuration Note:**
- Admin email address should be configurable via environment variable: `ADMIN_NOTIFICATION_EMAIL`
- Add to `api/internal/config/config.go` struct
- Default to a no-reply address for development

**Response Enhancement:**
- Store `validation_error` message when formula validation fails (not just true/false)
- This helps admin understand what needs to be fixed

---

## Story

As a **publisher**,
I want **to submit a request for a new zman to be added to the master registry**,
So that **I can use zmanim not currently in the system**.

---

## Acceptance Criteria

### AC-5.6.1: Create Request Endpoint
- [ ] `POST /api/v1/publisher/zmanim/request` creates new request
- [ ] Required fields: hebrew_name, english_name, justification
- [ ] Optional fields: transliteration, time_category, formula_dsl, description, halachic_notes, halachic_source
- [ ] Returns 201 with request details on success

### AC-5.6.2: Tag Support
- [ ] Request can include `existing_tag_ids` array (UUIDs of existing tags)
- [ ] Request can include `new_tag_requests` array for proposing new tags
- [ ] Each new tag request has: name, tag_type (event/timing/behavior/shita/method), description
- [ ] Tags saved to `zman_request_tags` table

### AC-5.6.3: Formula Validation
- [ ] If `formula_dsl` provided, validate using existing DSL parser
- [ ] Validation errors returned but don't block request creation
- [ ] Request flagged with `formula_valid: true/false`

### AC-5.6.4: Auto-Add Option
- [ ] `auto_add_on_approval` boolean (default true)
- [ ] When true, approved zman automatically added to publisher's list
- [ ] Stored with request for admin reference

### AC-5.6.5: List Own Requests Endpoint
- [ ] `GET /api/v1/publisher/zmanim/requests` returns publisher's requests
- [ ] Include status (pending, approved, rejected)
- [ ] Include all submitted data and tags
- [ ] Sorted by created_at desc

### AC-5.6.6: Email Notifications
- [ ] On request submit: email to publisher confirming submission
- [ ] On request submit: email to admin notifying of new request
- [ ] Admin email includes direct link to review page

### AC-5.6.7: Minimum Mandatory Fields
- [ ] Only hebrew_name, english_name, justification are required
- [ ] All other fields are optional
- [ ] Validation error if required fields missing

---

## Technical Context

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/publisher/zmanim/request` | Create new request |
| `GET` | `/api/v1/publisher/zmanim/requests` | List own requests |
| `GET` | `/api/v1/publisher/zmanim/requests/{id}` | Get specific request |

### Request/Response Shapes

```go
// POST Request
type CreateZmanRequestInput struct {
    HebrewName         string   `json:"hebrew_name" validate:"required"`
    EnglishName        string   `json:"english_name" validate:"required"`
    Justification      string   `json:"justification" validate:"required"`
    Transliteration    *string  `json:"transliteration"`
    TimeCategory       *string  `json:"time_category"` // dawn, morning, midday, afternoon, evening, night
    FormulaDSL         *string  `json:"formula_dsl"`
    Description        *string  `json:"description"`
    HalachicNotes      *string  `json:"halachic_notes"`
    HalachicSource     *string  `json:"halachic_source"`
    ExistingTagIDs     []string `json:"existing_tag_ids"`
    NewTagRequests     []NewTagRequestInput `json:"new_tag_requests"`
    AutoAddOnApproval  *bool    `json:"auto_add_on_approval"` // default true
}

type NewTagRequestInput struct {
    Name        string `json:"name" validate:"required"`
    TagType     string `json:"tag_type" validate:"required,oneof=event timing behavior shita method"`
    Description string `json:"description"`
}

// Response
type ZmanRequestResponse struct {
    ID                 string    `json:"id"`
    Status             string    `json:"status"` // pending, approved, rejected
    HebrewName         string    `json:"hebrew_name"`
    EnglishName        string    `json:"english_name"`
    Transliteration    *string   `json:"transliteration"`
    TimeCategory       *string   `json:"time_category"`
    FormulaDSL         *string   `json:"formula_dsl"`
    FormulaValid       *bool     `json:"formula_valid"`
    Description        *string   `json:"description"`
    HalachicNotes      *string   `json:"halachic_notes"`
    HalachicSource     *string   `json:"halachic_source"`
    Justification      string    `json:"justification"`
    Tags               []TagInfo `json:"tags"`
    NewTagRequests     []NewTagRequestInfo `json:"new_tag_requests"`
    AutoAddOnApproval  bool      `json:"auto_add_on_approval"`
    ReviewerNotes      *string   `json:"reviewer_notes"`
    CreatedAt          string    `json:"created_at"`
    ReviewedAt         *string   `json:"reviewed_at"`
}
```

### Handler Implementation

**File: `api/internal/handlers/zman_requests.go`**
```go
package handlers

func (h *Handlers) CreateZmanRequest(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    // Step 2: Parse request
    var req CreateZmanRequestInput
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Step 3: Validate required fields
    if req.HebrewName == "" || req.EnglishName == "" || req.Justification == "" {
        RespondValidationError(w, r, "hebrew_name, english_name, and justification are required", nil)
        return
    }

    // Step 4: Validate formula if provided
    var formulaValid *bool
    if req.FormulaDSL != nil && *req.FormulaDSL != "" {
        _, err := h.dslParser.Parse(*req.FormulaDSL)
        valid := err == nil
        formulaValid = &valid
    }

    // Step 5: Create request in database
    autoAdd := true
    if req.AutoAddOnApproval != nil {
        autoAdd = *req.AutoAddOnApproval
    }

    // Get publisher info for email
    publisher, _ := h.db.Queries.GetPublisherByID(ctx, pc.PublisherID)

    request, err := h.db.Queries.CreateZmanRegistryRequest(ctx, sqlcgen.CreateZmanRegistryRequestParams{
        PublisherID:        pc.PublisherID,
        RequestedHebrewName: req.HebrewName,
        RequestedEnglishName: req.EnglishName,
        Transliteration:    req.Transliteration,
        TimeCategory:       req.TimeCategory,
        FormulaDSL:         req.FormulaDSL,
        Description:        req.Description,
        HalachicNotes:      req.HalachicNotes,
        HalachicSource:     req.HalachicSource,
        Justification:      req.Justification,
        AutoAddOnApproval:  autoAdd,
        PublisherEmail:     publisher.Email,
        PublisherName:      publisher.Name,
        Status:             "pending",
    })
    if err != nil {
        slog.Error("failed to create zman request", "error", err)
        RespondInternalError(w, r, "Failed to create request")
        return
    }

    // Step 6: Add tags
    for _, tagID := range req.ExistingTagIDs {
        h.db.Queries.AddTagToZmanRequest(ctx, sqlcgen.AddTagToZmanRequestParams{
            RequestID:       request.ID,
            TagID:           uuid.MustParse(tagID),
            IsNewTagRequest: false,
        })
    }

    for _, newTag := range req.NewTagRequests {
        h.db.Queries.AddTagToZmanRequest(ctx, sqlcgen.AddTagToZmanRequestParams{
            RequestID:        request.ID,
            RequestedTagName: &newTag.Name,
            RequestedTagType: &newTag.TagType,
            IsNewTagRequest:  true,
        })
    }

    // Step 7: Send emails
    go h.emailService.SendZmanRequestSubmitted(publisher.Email, publisher.Name, req.EnglishName)
    go h.emailService.SendAdminNewZmanRequest(
        h.config.AdminEmail,
        publisher.Name,
        req.EnglishName,
        fmt.Sprintf("%s/admin/zmanim/requests/%s", h.config.AppURL, request.ID),
    )

    // Step 8: Respond
    RespondJSON(w, r, http.StatusCreated, buildRequestResponse(request, formulaValid))
}
```

### Email Templates

**Additions to: `api/internal/services/email_service.go`**
```go
const (
    TemplateZmanRequestSubmitted = "zman-request-submitted"
    TemplateAdminNewZmanRequest  = "admin-new-zman-request"
)

func (s *EmailService) SendZmanRequestSubmitted(to, publisherName, zmanName string) error {
    return s.send(TemplateZmanRequestSubmitted, to, "Zman Request Submitted", map[string]any{
        "publisherName": publisherName,
        "zmanName":      zmanName,
    })
}

func (s *EmailService) SendAdminNewZmanRequest(to, publisherName, zmanName, reviewURL string) error {
    return s.send(TemplateAdminNewZmanRequest, to, fmt.Sprintf("New Zman Request: %s", zmanName), map[string]any{
        "publisherName": publisherName,
        "zmanName":      zmanName,
        "reviewURL":     reviewURL,
    })
}
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Handler File
  - [ ] 1.1 Create `api/internal/handlers/zman_requests.go`
  - [ ] 1.2 Implement CreateZmanRequest handler
  - [ ] 1.3 Implement ListZmanRequests handler
  - [ ] 1.4 Implement GetZmanRequest handler

- [ ] Task 2: Create SQLc Queries
  - [ ] 2.1 Create `api/internal/db/queries/zman_requests.sql`
  - [ ] 2.2 Add CreateZmanRegistryRequest query
  - [ ] 2.3 Add AddTagToZmanRequest query
  - [ ] 2.4 Add ListPublisherZmanRequests query
  - [ ] 2.5 Run `sqlc generate`

- [ ] Task 3: Formula Validation Integration
  - [ ] 3.1 Use existing DSL parser to validate formula_dsl
  - [ ] 3.2 Store validation result with request
  - [ ] 3.3 Don't block request creation on validation failure

- [ ] Task 4: Email Templates
  - [ ] 4.1 Create "zman-request-submitted" template
  - [ ] 4.2 Create "admin-new-zman-request" template
  - [ ] 4.3 Add send methods to EmailService
  - [ ] 4.4 Configure admin email address

- [ ] Task 5: Register Routes
  - [ ] 5.1 Add routes to publisher router
  - [ ] 5.2 Ensure auth middleware applied

- [ ] Task 6: Testing
  - [ ] 6.1 Test create request with minimal fields
  - [ ] 6.2 Test create request with all fields
  - [ ] 6.3 Test with existing tags
  - [ ] 6.4 Test with new tag requests
  - [ ] 6.5 Test formula validation (valid and invalid)
  - [ ] 6.6 Verify emails sent

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Create request endpoint working
- [ ] List requests endpoint working
- [ ] Tag support (existing + new) implemented
- [ ] Formula validation integrated (store error message, not just boolean)
- [ ] Email notifications sent (verify with Resend test mode or logs)
- [ ] Minimum mandatory fields enforced
- [ ] Admin email configured via `ADMIN_NOTIFICATION_EMAIL` env var
- [ ] Services restarted with `./restart.sh` and verified working

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/internal/handlers/zman_requests.go` | Create | Request handlers |
| `api/internal/db/queries/zman_requests.sql` | Create | SQLc queries |
| `api/internal/services/email_service.go` | Modify | Add email templates |
| `api/cmd/api/main.go` | Modify | Route registration |

---

## API Example

### Create Request
```bash
curl -X POST http://localhost:8080/api/v1/publisher/zmanim/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "hebrew_name": "שקיעת החמה המאוחרת",
    "english_name": "Late Sunset (Rabbeinu Tam)",
    "time_category": "evening",
    "justification": "Needed for communities following Rabbeinu Tam for motzei Shabbos",
    "formula_dsl": "sunset + 72min",
    "halachic_source": "Shulchan Aruch OC 293",
    "existing_tag_ids": ["tag-uuid-1"],
    "new_tag_requests": [
      {
        "name": "Rabbeinu Tam",
        "tag_type": "shita",
        "description": "Follows the 72 minutes calculation method"
      }
    ],
    "auto_add_on_approval": true
  }'
```
