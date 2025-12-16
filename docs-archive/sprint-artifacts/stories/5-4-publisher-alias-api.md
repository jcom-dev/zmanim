# Story 5.4: Publisher Zman Alias API

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** todo
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 5.0 (Database Schema)
**FRs:** FR104, FR105 (Publisher zman alias management)

---

## Standards Reference

See `docs/coding-standards.md` sections:
- "Backend Standards > Handler Pattern (6 Steps)" (follow exactly)
- "Backend Standards > Error Handling" (log errors, user-friendly messages)
- "Backend Standards > SQLc Integration" (query definitions)
- "Development Workflow > Service Restart" (always use `./restart.sh`)

**Error Handling Note:**
- When publisher tries to create alias for zman NOT in their list, return 404 with message: "Zman not found in your published zmanim"
- GET endpoint should return 200 with `null` data if no alias exists (not 404) - more RESTful

---

## Story

As a **publisher**,
I want **to create custom names for zmanim in my algorithm**,
So that **my community sees familiar terminology while the system maintains canonical references**.

---

## Acceptance Criteria

### AC-5.4.1: Create/Update Alias Endpoint
- [ ] `PUT /api/v1/publisher/zmanim/{zmanKey}/alias` creates or updates alias
- [ ] Request body: `{ custom_hebrew_name, custom_english_name, custom_transliteration? }`
- [ ] Response includes both custom and canonical names
- [ ] Returns 200 on success, 404 if zman_key not found

### AC-5.4.2: Get Alias Endpoint
- [ ] `GET /api/v1/publisher/zmanim/{zmanKey}/alias` returns alias for specific zman
- [ ] Response includes custom name AND canonical master registry name
- [ ] Returns 404 if no alias exists

### AC-5.4.3: Delete Alias Endpoint
- [ ] `DELETE /api/v1/publisher/zmanim/{zmanKey}/alias` removes alias
- [ ] Zman reverts to showing canonical names
- [ ] Returns 204 on success, 404 if no alias exists

### AC-5.4.4: List All Aliases Endpoint
- [ ] `GET /api/v1/publisher/zmanim/aliases` returns all aliases for publisher
- [ ] Each alias includes both custom and canonical names
- [ ] Sorted by zman sort_order

### AC-5.4.5: Zmanim API Enhancement
- [ ] When fetching publisher zmanim, include alias info if exists
- [ ] Response includes: custom_name (if alias) and canonical_name (always)
- [ ] End users see custom name prominently, canonical name as reference

### AC-5.4.6: Authorization
- [ ] Only authenticated publishers can manage their own aliases
- [ ] X-Publisher-Id header validated
- [ ] Cannot create alias for zman not in publisher's list

---

## Technical Context

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/v1/publisher/zmanim/{zmanKey}/alias` | Create/update alias |
| `GET` | `/api/v1/publisher/zmanim/{zmanKey}/alias` | Get single alias |
| `DELETE` | `/api/v1/publisher/zmanim/{zmanKey}/alias` | Remove alias |
| `GET` | `/api/v1/publisher/zmanim/aliases` | List all aliases |

### Request/Response Shapes

```go
// PUT Request
type CreateAliasRequest struct {
    CustomHebrewName      string  `json:"custom_hebrew_name" validate:"required"`
    CustomEnglishName     string  `json:"custom_english_name" validate:"required"`
    CustomTransliteration *string `json:"custom_transliteration,omitempty"`
}

// Response for single alias
type AliasResponse struct {
    ID                    string  `json:"id"`
    ZmanKey               string  `json:"zman_key"`
    CustomHebrewName      string  `json:"custom_hebrew_name"`
    CustomEnglishName     string  `json:"custom_english_name"`
    CustomTransliteration *string `json:"custom_transliteration,omitempty"`
    CanonicalHebrewName   string  `json:"canonical_hebrew_name"`
    CanonicalEnglishName  string  `json:"canonical_english_name"`
    CreatedAt             string  `json:"created_at"`
    UpdatedAt             string  `json:"updated_at"`
}

// Response for list
type AliasListResponse struct {
    Aliases []AliasResponse `json:"aliases"`
}
```

### Handler Implementation

**File: `api/internal/handlers/publisher_aliases.go`**
```go
package handlers

import (
    "encoding/json"
    "net/http"

    "github.com/go-chi/chi/v5"
)

// CreateOrUpdateAlias handles PUT /api/v1/publisher/zmanim/{zmanKey}/alias
func (h *Handlers) CreateOrUpdateAlias(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Step 1: Resolve publisher context
    pc := h.publisherResolver.MustResolve(w, r)
    if pc == nil {
        return
    }

    // Step 2: Extract URL params
    zmanKey := chi.URLParam(r, "zmanKey")

    // Step 3: Parse request body
    var req CreateAliasRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Step 4: Validate inputs
    if req.CustomHebrewName == "" || req.CustomEnglishName == "" {
        RespondValidationError(w, r, "Hebrew and English names are required", nil)
        return
    }

    // Step 5: Execute business logic
    alias, err := h.db.Queries.UpsertPublisherZmanAlias(ctx, sqlcgen.UpsertPublisherZmanAliasParams{
        PublisherID:           pc.PublisherID,
        ZmanKey:               zmanKey,
        CustomHebrewName:      req.CustomHebrewName,
        CustomEnglishName:     req.CustomEnglishName,
        CustomTransliteration: req.CustomTransliteration,
    })
    if err != nil {
        slog.Error("failed to upsert alias", "error", err, "publisher_id", pc.PublisherID)
        RespondInternalError(w, r, "Failed to save alias")
        return
    }

    // Get canonical names for response
    canonical, _ := h.db.Queries.GetMasterRegistryEntry(ctx, zmanKey)

    // Step 6: Respond
    response := AliasResponse{
        ID:                    alias.ID.String(),
        ZmanKey:               zmanKey,
        CustomHebrewName:      alias.CustomHebrewName,
        CustomEnglishName:     alias.CustomEnglishName,
        CustomTransliteration: alias.CustomTransliteration,
        CanonicalHebrewName:   canonical.HebrewName,
        CanonicalEnglishName:  canonical.EnglishName,
        CreatedAt:             alias.CreatedAt.String(),
        UpdatedAt:             alias.UpdatedAt.String(),
    }

    RespondJSON(w, r, http.StatusOK, response)
}
```

### SQLc Queries

**File: `api/internal/db/queries/aliases.sql`**
```sql
-- name: GetPublisherZmanAlias :one
SELECT
    pza.id,
    pza.custom_hebrew_name,
    pza.custom_english_name,
    pza.custom_transliteration,
    pza.created_at,
    pza.updated_at,
    pz.zman_key,
    mr.hebrew_name as canonical_hebrew_name,
    mr.english_name as canonical_english_name
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
JOIN master_zmanim_registry mr ON pz.zman_key = mr.zman_key
WHERE pza.publisher_id = $1 AND pz.zman_key = $2;

-- name: UpsertPublisherZmanAlias :one
INSERT INTO publisher_zman_aliases (
    publisher_id, publisher_zman_id, custom_hebrew_name, custom_english_name, custom_transliteration
)
SELECT $1, pz.id, $3, $4, $5
FROM publisher_zmanim pz
WHERE pz.publisher_id = $1 AND pz.zman_key = $2
ON CONFLICT (publisher_id, publisher_zman_id) DO UPDATE SET
    custom_hebrew_name = EXCLUDED.custom_hebrew_name,
    custom_english_name = EXCLUDED.custom_english_name,
    custom_transliteration = EXCLUDED.custom_transliteration,
    updated_at = NOW()
RETURNING id, custom_hebrew_name, custom_english_name, custom_transliteration, created_at, updated_at;

-- name: DeletePublisherZmanAlias :exec
DELETE FROM publisher_zman_aliases
WHERE publisher_id = $1
  AND publisher_zman_id = (SELECT id FROM publisher_zmanim WHERE publisher_id = $1 AND zman_key = $2);

-- name: GetAllPublisherZmanAliases :many
SELECT
    pza.id,
    pza.custom_hebrew_name,
    pza.custom_english_name,
    pza.custom_transliteration,
    pza.created_at,
    pza.updated_at,
    pz.zman_key,
    mr.hebrew_name as canonical_hebrew_name,
    mr.english_name as canonical_english_name
FROM publisher_zman_aliases pza
JOIN publisher_zmanim pz ON pza.publisher_zman_id = pz.id
JOIN master_zmanim_registry mr ON pz.zman_key = mr.zman_key
WHERE pza.publisher_id = $1 AND pza.is_active = true
ORDER BY pz.sort_order;
```

---

## Tasks / Subtasks

- [ ] Task 1: Create Handler File
  - [ ] 1.1 Create `api/internal/handlers/publisher_aliases.go`
  - [ ] 1.2 Implement CreateOrUpdateAlias handler
  - [ ] 1.3 Implement GetAlias handler
  - [ ] 1.4 Implement DeleteAlias handler
  - [ ] 1.5 Implement ListAliases handler

- [ ] Task 2: Create SQLc Queries
  - [ ] 2.1 Create `api/internal/db/queries/aliases.sql`
  - [ ] 2.2 Run `sqlc generate`
  - [ ] 2.3 Verify generated code compiles

- [ ] Task 3: Register Routes
  - [ ] 3.1 Add routes to publisher router in `api/cmd/api/main.go`
  - [ ] 3.2 Ensure auth middleware applied

- [ ] Task 4: Enhance Existing Endpoints
  - [ ] 4.1 Modify GetPublisherZmanim to include alias info
  - [ ] 4.2 Update response shape to include both custom and canonical names

- [ ] Task 5: Testing
  - [ ] 5.1 Test create alias
  - [ ] 5.2 Test update alias (upsert)
  - [ ] 5.3 Test delete alias
  - [ ] 5.4 Test list aliases
  - [ ] 5.5 Test auth (only own aliases)

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] All 4 endpoints implemented and tested
- [ ] SQLc queries generated and working (`cd api && sqlc generate`)
- [ ] Auth validated (only own aliases)
- [ ] Response includes both custom and canonical names
- [ ] Routes registered in `api/cmd/api/main.go`
- [ ] Error handling for "zman not in publisher's list" scenario
- [ ] Services restarted with `./restart.sh` and verified working
- [ ] E2E test for alias CRUD operations

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/internal/handlers/publisher_aliases.go` | Create | Handler implementations |
| `api/internal/db/queries/aliases.sql` | Create | SQLc query definitions |
| `api/cmd/api/main.go` | Modify | Route registration |
| `api/internal/handlers/publisher_zmanim.go` | Modify | Include alias in existing responses |

---

## API Examples

### Create/Update Alias
```bash
curl -X PUT http://localhost:8080/api/v1/publisher/zmanim/alos_hashachar/alias \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Publisher-Id: $PUBLISHER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_hebrew_name": "עמוד השחר",
    "custom_english_name": "Dawn Column",
    "custom_transliteration": "Amud HaShachar"
  }'
```

### Response
```json
{
  "data": {
    "id": "uuid",
    "zman_key": "alos_hashachar",
    "custom_hebrew_name": "עמוד השחר",
    "custom_english_name": "Dawn Column",
    "custom_transliteration": "Amud HaShachar",
    "canonical_hebrew_name": "עלות השחר",
    "canonical_english_name": "Dawn",
    "created_at": "2025-12-02T10:00:00Z",
    "updated_at": "2025-12-02T10:00:00Z"
  }
}
```
