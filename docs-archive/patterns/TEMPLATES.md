# Code Templates - Shtetl Zmanim

**Purpose:** Copy-paste templates for AI agents to maintain consistency
**Last Updated:** 2025-12-07

---

## Backend Templates

### 1. Standard 6-Step Handler

```go
// File: handler_name.go
// Purpose: [Brief description]
// Pattern: 6-step-handler
// Dependencies: Queries:[file.sql] Services:[ServiceName]
// Frequency: [high/medium/low]
// Compliance: Check docs/adr/ for pattern rationale

package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// HandlerName godoc
// @Summary     [Brief description]
// @Description [Detailed description]
// @Tags        [Tag name from main.go]
// @Accept      json
// @Produce     json
// @Param       id path string true "Resource ID"
// @Param       body body RequestStruct true "Request body"
// @Success     200 {object} ResponseStruct
// @Failure     400 {object} APIError "Bad request"
// @Failure     401 {object} APIError "Unauthorized"
// @Failure     404 {object} APIError "Not found"
// @Failure     500 {object} APIError "Internal error"
// @Security    BearerAuth
// @Router      /publisher/resource/{id} [post]
func (h *Handlers) HandlerName(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// STEP 1: Resolve publisher context (if publisher endpoint)
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // MustResolve sends error response
	}
	publisherID := pc.PublisherID

	// STEP 2: Extract URL params
	id := chi.URLParam(r, "id")
	if id == "" {
		RespondValidationError(w, r, "Validation failed", map[string]string{
			"id": "ID is required",
		})
		return
	}

	// Convert to int32 (if needed)
	idInt32, err := StringToInt32(id)
	if err != nil {
		RespondValidationError(w, r, "Validation failed", map[string]string{
			"id": "Invalid ID format",
		})
		return
	}

	// STEP 3: Parse request body (POST/PUT only)
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	// STEP 4: Validate
	validationErrors := make(map[string]string)
	if req.Name == "" {
		validationErrors["name"] = "Name is required"
	}
	if len(validationErrors) > 0 {
		RespondValidationError(w, r, "Validation failed", validationErrors)
		return
	}

	// STEP 5: SQLc query (NEVER raw SQL in handlers)
	result, err := h.db.Queries.CreateResource(ctx, sqlcgen.CreateResourceParams{
		PublisherID: publisherID,
		Name:        req.Name,
		Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		slog.Error("failed to create resource",
			"error", err,
			"publisher_id", publisherID,
			"name", req.Name,
		)
		RespondInternalError(w, r, "Failed to create resource")
		return
	}

	// STEP 6: Respond
	RespondJSON(w, r, http.StatusCreated, result)
}
```

**When to use:**
- Publisher-scoped endpoints (requires X-Publisher-Id)
- CRUD operations on single concept
- Standard auth + validation flow

**See:** `docs/adr/003-publisher-resolver.md`, `docs/adr/001-sqlc-mandatory.md`

---

### 2. Admin Handler (No Publisher Context)

```go
// File: admin_handler.go
// Purpose: [Description]
// Pattern: 6-step-handler-admin
// Dependencies: Queries:[file.sql] Services:[ClerkService]
// Frequency: [high/medium/low]
// Compliance: Check docs/adr/ for pattern rationale

package handlers

// AdminHandlerName godoc
// @Summary     [Brief description]
// @Description [Detailed description]
// @Tags        Admin
// @Accept      json
// @Produce     json
// @Param       id path string true "Resource ID"
// @Success     200 {object} ResponseStruct
// @Failure     401 {object} APIError "Unauthorized"
// @Failure     403 {object} APIError "Forbidden - admin only"
// @Failure     500 {object} APIError "Internal error"
// @Security    BearerAuth
// @Router      /admin/resource/{id} [get]
func (h *Handlers) AdminHandlerName(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// STEP 1: Get user ID (NO publisher resolver for admin endpoints)
	userID := middleware.GetUserID(ctx)
	if userID == "" {
		RespondUnauthorized(w, r, "Unauthorized")
		return
	}

	// STEP 2: Extract URL params
	id := chi.URLParam(r, "id")
	if id == "" {
		RespondValidationError(w, r, "Validation failed", map[string]string{
			"id": "ID is required",
		})
		return
	}

	idInt32, err := StringToInt32(id)
	if err != nil {
		RespondBadRequest(w, r, "Invalid ID format")
		return
	}

	// STEP 3: Parse body (if POST/PUT)
	// ...

	// STEP 4: Validate
	// ...

	// STEP 5: SQLc query
	result, err := h.db.Queries.AdminGetResource(ctx, idInt32)
	if err != nil {
		slog.Error("failed to get resource", "error", err, "id", id)
		RespondInternalError(w, r, "Failed to get resource")
		return
	}

	// STEP 6: Respond
	RespondJSON(w, r, http.StatusOK, result)
}
```

**When to use:**
- Admin-only endpoints
- No X-Publisher-Id header needed
- Still requires Bearer token

**See:** `docs/adr/003-publisher-resolver.md`

---

### 3. Transactional Handler (Multi-Step Writes)

```go
// File: transactional_handler.go
// Purpose: [Description]
// Pattern: 6-step-handler-transactional
// Dependencies: Queries:[file.sql]
// Frequency: [high/medium/low]
// Compliance: Check docs/adr/ for pattern rationale

package handlers

func (h *Handlers) TransactionalHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Steps 1-4: Context, params, body, validation
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return
	}
	publisherID := pc.PublisherID

	// Parse body, validate...

	// STEP 5a: Begin transaction
	tx, err := h.db.Pool.Begin(ctx)
	if err != nil {
		slog.Error("failed to begin transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}
	// Always rollback (no-op if committed)
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// STEP 5b: Create queries with transaction
	qtx := h.db.Queries.WithTx(tx)

	// STEP 5c: Multi-step operations
	// Operation 1
	err = qtx.ArchiveActiveRecords(ctx, publisherID)
	if err != nil {
		slog.Error("failed to archive records", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// Operation 2
	result, err := qtx.CreateNewRecord(ctx, sqlcgen.CreateNewRecordParams{
		PublisherID: publisherID,
		// ...
	})
	if err != nil {
		slog.Error("failed to create record", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// Operation 3 (example: versioning)
	_, err = qtx.CreateVersionSnapshot(ctx, sqlcgen.CreateVersionSnapshotParams{
		RecordID:      result.ID,
		VersionNumber: GetNextVersion(result.ID),
		// ...
	})
	if err != nil {
		slog.Error("failed to create version", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// STEP 5d: Commit transaction
	if err := tx.Commit(ctx); err != nil {
		slog.Error("failed to commit transaction", "error", err)
		RespondInternalError(w, r, "Failed to process request")
		return
	}

	// STEP 5e: Cache invalidation (AFTER commit, not during)
	h.cache.InvalidatePublisherCache(ctx, Int32ToString(publisherID))

	// STEP 6: Respond
	RespondJSON(w, r, http.StatusOK, result)
}
```

**When to use:**
- Multi-step writes to same concept
- State machine transitions (draft → active)
- Versioning/archival workflows

**Critical:** Always use `defer tx.Rollback()` + explicit `tx.Commit()`

---

### 4. Public Handler (No Auth)

```go
// File: public_handler.go
// Purpose: [Description]
// Pattern: public-handler
// Dependencies: Queries:[file.sql]
// Frequency: [high/medium/low]
// Compliance: Check docs/adr/ for pattern rationale

package handlers

// PublicHandlerName godoc
// @Summary     [Brief description]
// @Description [Detailed description]
// @Tags        Public
// @Accept      json
// @Produce     json
// @Param       param query string false "Optional param"
// @Success     200 {object} ResponseStruct
// @Failure     400 {object} APIError "Bad request"
// @Failure     500 {object} APIError "Internal error"
// @Router      /public/resource [get]
func (h *Handlers) PublicHandlerName(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// NO auth check, NO publisher resolver

	// Extract query params
	param := r.URL.Query().Get("param")

	// Validate
	if param == "" {
		RespondBadRequest(w, r, "Missing required parameter: param")
		return
	}

	// SQLc query
	result, err := h.db.Queries.GetPublicData(ctx, param)
	if err != nil {
		slog.Error("failed to get public data", "error", err, "param", param)
		RespondInternalError(w, r, "Failed to get data")
		return
	}

	// Respond
	RespondJSON(w, r, http.StatusOK, result)
}
```

**When to use:**
- Public endpoints (zmanim browse, country list)
- No authentication required
- Still use SQLc (NEVER raw SQL)

---

### 5. SQLc Query Template

```sql
-- File: query_name.sql
-- Purpose: [Brief description]
-- Used by: handler1.go, handler2.go
-- Concepts: [Concept1, Concept2] (check concept independence)
-- Complexity: [low/medium/high/critical]

-- name: GetResourceByID :one
SELECT
    r.id,
    r.name,
    r.description,
    r.created_at,
    r.updated_at,
    -- Lookup table JOIN (acceptable - denormalized display data)
    s.key AS status_key,
    s.display_name_english AS status_name
FROM resources r
JOIN resource_statuses s ON r.status_id = s.id
WHERE r.id = $1
AND r.publisher_id = $2;

-- name: ListResources :many
SELECT
    r.id,
    r.name,
    s.key AS status_key
FROM resources r
JOIN resource_statuses s ON r.status_id = s.id
WHERE r.publisher_id = $1
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateResource :one
INSERT INTO resources (
    publisher_id,
    name,
    description,
    status_id
) VALUES (
    $1, $2, $3,
    (SELECT id FROM resource_statuses WHERE key = 'pending')
)
RETURNING *;

-- name: UpdateResource :exec
UPDATE resources
SET
    name = $2,
    description = $3,
    updated_at = NOW()
WHERE id = $1
AND publisher_id = $4;

-- name: DeleteResource :exec
DELETE FROM resources
WHERE id = $1
AND publisher_id = $2;
```

**Rules:**
- Always use named queries (`:one`, `:many`, `:exec`)
- JOINs to lookup tables OK (for display names)
- Avoid cross-concept JOINs (see concept independence audit)
- Use key-based lookups for foreign keys (not hardcoded IDs)

**See:** `docs/adr/001-sqlc-mandatory.md`, `docs/adr/004-lookup-table-normalization.md`

---

## Frontend Templates

### 1. Client Component with useApi

```tsx
/**
 * @file ComponentName.tsx
 * @purpose [Brief description]
 * @pattern client-component
 * @dependencies useApi, shadcn:[Button,Dialog,Form]
 * @frequency [high/medium/low]
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

// 1. React/framework imports
import { useState, useEffect, useCallback } from 'react';

// 2. Third-party imports
import { useUser } from '@clerk/nextjs';
import { Loader2, Save } from 'lucide-react';

// 3. Internal imports
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// 4. Types
interface Resource {
  id: string;
  name: string;
  description: string;
}

interface ComponentNameProps {
  resourceId?: string;
  onSuccess?: () => void;
}

export function ComponentName({ resourceId, onSuccess }: ComponentNameProps) {
  // SECTION 1: Hooks (Clerk, context, state)
  const { user, isLoaded } = useUser();
  const api = useApi();

  const [data, setData] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // SECTION 2: Callbacks
  const fetchData = useCallback(async () => {
    if (!resourceId) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await api.get<Resource>(`/publisher/resource/${resourceId}`);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [api, resourceId]);

  const handleSave = useCallback(async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);
      await api.put(`/publisher/resource/${resourceId}`, {
        body: JSON.stringify(data),
      });
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [api, data, resourceId, onSuccess]);

  // SECTION 3: Effects
  useEffect(() => {
    if (isLoaded) {
      fetchData();
    }
  }, [isLoaded, fetchData]);

  // SECTION 4: Early returns (Loading → Error → Content)
  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground">No data found</div>
    );
  }

  // SECTION 5: Render
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{data.name}</h2>
      <p className="text-muted-foreground">{data.description}</p>

      <Button
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 w-4 h-4" />
            Save
          </>
        )}
      </Button>
    </div>
  );
}
```

**When to use:**
- Components with hooks, state, effects
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, geolocation)

**See:** `docs/adr/002-use-api-pattern.md`

---

### 2. Server Component (No Hooks)

```tsx
/**
 * @file ComponentName.tsx
 * @purpose [Brief description]
 * @pattern server-component
 * @dependencies None (server-side only)
 * @frequency [high/medium/low]
 * @compliance Check docs/adr/ for pattern rationale
 */

// NO 'use client' directive

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

interface ComponentNameProps {
  title: string;
  children: React.ReactNode;
}

export function ComponentName({ title, children }: ComponentNameProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>

      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

export default ComponentName;
```

**When to use:**
- Static content, layouts
- SEO-critical pages
- No interactivity needed
- Server-side data fetching (optional)

---

### 3. React Query Hook

```tsx
/**
 * @file useResourceQuery.ts
 * @purpose [Brief description]
 * @pattern react-hook
 * @dependencies useApi, React Query
 * @frequency [high/medium/low]
 * @compliance Check docs/adr/ for pattern rationale
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';

interface Resource {
  id: string;
  name: string;
}

export function useResourceQuery(resourceId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ['resource', resourceId],
    queryFn: async () => {
      return api.get<Resource>(`/publisher/resource/${resourceId}`);
    },
    enabled: !!resourceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useResourceMutation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Resource>) => {
      return api.post('/publisher/resource', {
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });
    },
  });
}
```

**When to use:**
- Reusable data fetching logic
- Automatic caching + refetching
- Multiple components need same data

---

### 4. Form with shadcn/ui

```tsx
/**
 * @file ResourceForm.tsx
 * @purpose [Brief description]
 * @pattern client-component-form
 * @dependencies useApi, shadcn:[Form,Input,Button]
 * @frequency [high/medium/low]
 * @compliance Check docs/adr/ for pattern rationale
 */

'use client';

import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ResourceFormProps {
  initialData?: {
    name: string;
    description: string;
  };
  onSuccess?: () => void;
}

export function ResourceForm({ initialData, onSuccess }: ResourceFormProps) {
  const api = useApi();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/publisher/resource', {
        body: JSON.stringify(formData),
      });
      onSuccess?.();
    } catch (err: any) {
      setErrors({ _form: err.message || 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {errors._form}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
```

**When to use:**
- Forms with validation
- shadcn/ui components
- Frontend + backend validation

---

## Database Migration Template

```sql
-- File: 20250207_description.sql
-- Purpose: [Brief description of what this migration does]
-- Reversible: [Yes/No]

-- ALWAYS use IF NOT EXISTS, IF EXISTS, ON CONFLICT for idempotency

-- 1. Create lookup table (if adding new concept)
CREATE TABLE IF NOT EXISTS public.resource_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Seed lookup data (use key, not hardcoded IDs)
INSERT INTO public.resource_types (key, display_name_hebrew, display_name_english, description)
VALUES
    ('type_a', 'סוג א', 'Type A', 'First type'),
    ('type_b', 'סוג ב', 'Type B', 'Second type')
ON CONFLICT (key) DO NOTHING;

-- 3. Add FK column to existing table
ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS type_id smallint;

-- 4. Backfill existing data (if migrating from VARCHAR)
UPDATE public.resources
SET type_id = (SELECT id FROM resource_types WHERE key = 'type_a')
WHERE type_id IS NULL AND legacy_column = 'A';

-- 5. Add FK constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'resources_type_id_fkey'
    ) THEN
        ALTER TABLE public.resources
            ADD CONSTRAINT resources_type_id_fkey
            FOREIGN KEY (type_id) REFERENCES public.resource_types(id);
    END IF;
END $$;

-- 6. Drop old column (ONLY after verification)
-- ALTER TABLE public.resources DROP COLUMN IF EXISTS legacy_column;

-- 7. Add updated_at trigger (if new table)
CREATE OR REPLACE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
```

**When to use:**
- Schema changes
- New tables, columns, constraints
- Data migrations

**See:** `docs/adr/004-lookup-table-normalization.md`, `docs/coding-standards.md#database-migrations`

---

## Quick Reference Checklist

### Before Creating a Handler:
- [ ] Check if similar handler exists (use INDEX.md)
- [ ] Determine auth pattern (publisher, admin, public)
- [ ] Check SQLc queries needed (use INDEX.md)
- [ ] Add Swagger annotations
- [ ] Log errors with slog
- [ ] Use response helpers (RespondJSON, RespondError)

### Before Creating a Component:
- [ ] Determine if client or server component
- [ ] Check if similar component exists (use INDEX.md)
- [ ] Use `useApi` hook (NEVER raw fetch)
- [ ] Use design tokens (NEVER hardcoded colors)
- [ ] Check `isLoaded` before accessing Clerk user
- [ ] Add proper TypeScript types

### Before Creating a Query:
- [ ] Check concept independence (avoid cross-concept JOINs)
- [ ] Use named queries (:one, :many, :exec)
- [ ] Add header comment with dependencies
- [ ] Test with `cd api && sqlc generate`

### Before Creating a Migration:
- [ ] Use IF NOT EXISTS / IF EXISTS
- [ ] Follow lookup table pattern (id + key)
- [ ] Use key-based seed data (not hardcoded IDs)
- [ ] Test with `./scripts/migrate.sh`

---

**For AI Agents:**
- Copy these templates as starting points
- Replace placeholders: `[Description]`, `ComponentName`, `resource`
- Follow section order exactly (hooks → callbacks → effects → render)
- Check compliance with ADRs before generating code
