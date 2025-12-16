# Story 8-33: AI Explanation/Generation RAG Validation & Enriched Context - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium

---

## Executive Summary

Enhance AI formula generation and explanation endpoints to:
1. Validate RAG context availability (fail fast with 503 instead of silent degradation)
2. Accept optional `zman_key` and `publisher_id` to enrich AI prompts with zman metadata
3. Include master registry data, publisher-specific context, and tags in AI requests

---

## Current State Analysis

### Problem 1: Silent RAG Failures

**File:** `api/internal/handlers/ai_formula.go:82-94`

```go
// Current behavior - silently ignores RAG failures
if h.aiContext != nil {
    assembled, err := h.aiContext.AssembleContext(ctx, req.Description, opts)
    if err == nil && assembled != nil {  // ⚠️ Error ignored!
        ragContext = assembled.Context
        ragUsed = len(assembled.Sources) > 0
    }
}
// Proceeds without RAG context if assembly fails
```

**Impact:** Users receive lower-quality AI responses without knowing the knowledge base was unavailable.

### Problem 2: Missing Zman Context

Current request types:
```go
type GenerateFormulaRequest struct {
    Description string `json:"description"`
    // No zman context!
}

type ExplainFormulaRequest struct {
    Formula  string `json:"formula"`
    Language string `json:"language,omitempty"`
    // No zman context!
}
```

When explaining a formula like `solar(-16.1)`, the AI doesn't know:
- Which zman this formula is for
- The halachic background
- The publisher's existing comment/explanation
- Related tags (behavior, timing, shita)

---

## Technical Design

### Solution 1: RAG Validation

#### New Validation Helper

```go
// File: api/internal/handlers/ai_formula.go

// validateRAGAvailability validates that RAG context can be assembled
// Returns 503 if RAG is unavailable (unless AI_REQUIRE_RAG=false)
func (h *Handlers) validateRAGAvailability(ctx context.Context, query string) (*ai.AssembledContext, error) {
    // Check if RAG service is configured
    if h.aiContext == nil {
        if os.Getenv("AI_REQUIRE_RAG") == "false" {
            slog.Warn("RAG service not configured, proceeding without context")
            return nil, nil
        }
        return nil, &RAGUnavailableError{Message: "RAG service not configured"}
    }

    // Attempt to assemble context
    opts := ai.ContextOptions{
        MaxTokens:       1500,
        MaxDocs:         3,
        IncludeExamples: true,
        IncludeHalachic: true,
    }
    assembled, err := h.aiContext.AssembleContext(ctx, query, opts)
    if err != nil {
        if os.Getenv("AI_REQUIRE_RAG") == "false" {
            slog.Warn("RAG context assembly failed, proceeding without context", "error", err)
            return nil, nil
        }
        return nil, &RAGUnavailableError{Message: fmt.Sprintf("RAG context assembly failed: %v", err)}
    }

    // Check if any sources were found
    if len(assembled.Sources) == 0 {
        if os.Getenv("AI_REQUIRE_RAG") == "false" {
            slog.Warn("RAG returned no sources, proceeding without context")
            return assembled, nil
        }
        return nil, &RAGUnavailableError{Message: "Knowledge base not indexed - no RAG sources available"}
    }

    return assembled, nil
}

// RAGUnavailableError represents a RAG service unavailability
type RAGUnavailableError struct {
    Message string
}

func (e *RAGUnavailableError) Error() string {
    return e.Message
}
```

#### Error Response Format

```go
func (h *Handlers) respondRAGUnavailable(w http.ResponseWriter, r *http.Request, err error) {
    RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
        "error":       "AI service temporarily unavailable",
        "code":        "RAG_UNAVAILABLE",
        "message":     err.Error(),
        "retry_after": 60,
    })
}
```

### Solution 2: Zman Context Enrichment

#### Updated Request Types

```go
type GenerateFormulaRequest struct {
    Description string `json:"description"`
    ZmanKey     string `json:"zman_key,omitempty"`
    PublisherID *int32 `json:"publisher_id,omitempty"`
}

type ExplainFormulaRequest struct {
    Formula     string `json:"formula"`
    Language    string `json:"language,omitempty"`
    ZmanKey     string `json:"zman_key,omitempty"`
    PublisherID *int32 `json:"publisher_id,omitempty"`
}
```

#### SQLc Query for Zman Context

```sql
-- File: api/internal/db/queries/master_registry.sql

-- name: GetZmanContextForAI :one
SELECT
    mr.zman_key,
    mr.canonical_hebrew_name,
    mr.canonical_english_name,
    mr.transliteration,
    mr.description,
    mr.halachic_notes,
    mr.halachic_source,
    tc.key AS time_category,
    mr.default_formula_dsl,
    mr.is_core,
    -- Publisher-specific context (if publisher_id provided)
    pz.formula_dsl AS publisher_formula,
    pz.publisher_comment,
    pz.ai_explanation AS existing_explanation,
    pz.is_enabled,
    pz.is_visible,
    pz.is_published,
    -- Tags as JSON array
    COALESCE(
        (SELECT json_agg(json_build_object(
            'name', t.tag_key,
            'type', tt.key,
            'hebrew', t.display_name_hebrew,
            'english', t.display_name_english
        ))
        FROM master_zman_tags mzt
        JOIN zman_tags t ON mzt.tag_id = t.id
        JOIN tag_types tt ON t.tag_type_id = tt.id
        WHERE mzt.master_zman_id = mr.id),
        '[]'::json
    ) AS tags
FROM master_zmanim_registry mr
LEFT JOIN time_categories tc ON mr.time_category_id = tc.id
LEFT JOIN publisher_zmanim pz ON pz.master_zman_id = mr.id
    AND pz.publisher_id = sqlc.narg('publisher_id')
    AND pz.deleted_at IS NULL
WHERE mr.zman_key = $1;
```

#### Zman Context Fetcher

```go
// File: api/internal/handlers/ai_formula.go

type ZmanContext struct {
    Zman             *ZmanInfo             `json:"zman"`
    PublisherContext *PublisherZmanContext `json:"publisher_context,omitempty"`
}

type ZmanInfo struct {
    Key             string     `json:"key"`
    HebrewName      string     `json:"hebrew_name"`
    EnglishName     string     `json:"english_name"`
    Transliteration string     `json:"transliteration,omitempty"`
    Description     string     `json:"description,omitempty"`
    HalachicNotes   string     `json:"halachic_notes,omitempty"`
    HalachicSource  string     `json:"halachic_source,omitempty"`
    TimeCategory    string     `json:"time_category,omitempty"`
    DefaultFormula  string     `json:"default_formula,omitempty"`
    IsCore          bool       `json:"is_core"`
    Tags            []TagInfo  `json:"tags,omitempty"`
}

type PublisherZmanContext struct {
    CurrentFormula string `json:"current_formula,omitempty"`
    Comment        string `json:"publisher_comment,omitempty"`
    IsEnabled      bool   `json:"is_enabled"`
    IsPublished    bool   `json:"is_published"`
}

type TagInfo struct {
    Name    string `json:"name"`
    Type    string `json:"type"`
    Hebrew  string `json:"hebrew,omitempty"`
    English string `json:"english,omitempty"`
}

func (h *Handlers) fetchZmanContext(ctx context.Context, zmanKey string, publisherID *int32) (*ZmanContext, error) {
    if zmanKey == "" {
        return nil, nil
    }

    result, err := h.db.Queries.GetZmanContextForAI(ctx, sqlcgen.GetZmanContextForAIParams{
        ZmanKey:     zmanKey,
        PublisherID: publisherID,
    })
    if err != nil {
        slog.Warn("failed to fetch zman context for AI", "zman_key", zmanKey, "error", err)
        return nil, nil // Don't fail request, just proceed without context
    }

    zmanCtx := &ZmanContext{
        Zman: &ZmanInfo{
            Key:             result.ZmanKey,
            HebrewName:      result.CanonicalHebrewName,
            EnglishName:     result.CanonicalEnglishName,
            Transliteration: result.Transliteration.String,
            Description:     result.Description.String,
            HalachicNotes:   result.HalachicNotes.String,
            HalachicSource:  result.HalachicSource.String,
            TimeCategory:    result.TimeCategory.String,
            DefaultFormula:  result.DefaultFormulaDsl.String,
            IsCore:          result.IsCore.Bool,
        },
    }

    // Parse tags JSON
    var tags []TagInfo
    json.Unmarshal(result.Tags, &tags)
    zmanCtx.Zman.Tags = tags

    // Add publisher context if available
    if result.PublisherFormula.Valid {
        zmanCtx.PublisherContext = &PublisherZmanContext{
            CurrentFormula: result.PublisherFormula.String,
            Comment:        result.PublisherComment.String,
            IsEnabled:      result.IsEnabled.Bool,
            IsPublished:    result.IsPublished.Bool,
        }
    }

    return zmanCtx, nil
}

func (h *Handlers) formatZmanContextForPrompt(zmanCtx *ZmanContext) string {
    if zmanCtx == nil {
        return ""
    }

    b, _ := json.MarshalIndent(zmanCtx, "", "  ")
    return fmt.Sprintf("\n\n## Zman Context\n```json\n%s\n```", string(b))
}
```

### Updated Handlers

#### GenerateFormula Handler

```go
func (h *Handlers) GenerateFormula(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    startTime := time.Now()

    var req GenerateFormulaRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    // Validate description
    if req.Description == "" {
        RespondBadRequest(w, r, "Description is required")
        return
    }

    if utf8.RuneCountInString(req.Description) > 500 {
        RespondBadRequest(w, r, "Description exceeds 500 character limit")
        return
    }

    // Check Claude service
    if h.aiClaude == nil {
        RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
            "error":   "AI service not configured",
            "message": "Formula generation is not available",
        })
        return
    }

    // *** NEW: Validate RAG availability ***
    assembled, err := h.validateRAGAvailability(ctx, req.Description)
    if err != nil {
        h.respondRAGUnavailable(w, r, err)
        return
    }

    var ragContext string
    var ragUsed bool
    if assembled != nil {
        ragContext = assembled.Context
        ragUsed = len(assembled.Sources) > 0
    }

    // *** NEW: Fetch zman context if provided ***
    zmanCtx, _ := h.fetchZmanContext(ctx, req.ZmanKey, req.PublisherID)
    if zmanCtx != nil {
        ragContext += h.formatZmanContextForPrompt(zmanCtx)
    }

    // Generate formula with validation
    result, err := h.aiClaude.GenerateWithValidation(ctx, req.Description, ragContext, h.validateDSL)
    durationMs := int(time.Since(startTime).Milliseconds())

    // Log to audit (include zman_key if provided)
    h.logAIAudit(ctx, r, "generate_formula", req.Description, result, err, durationMs, ragUsed)

    if err != nil {
        RespondJSON(w, r, http.StatusUnprocessableEntity, map[string]interface{}{
            "error":   "Failed to generate valid formula",
            "message": err.Error(),
        })
        return
    }

    RespondJSON(w, r, http.StatusOK, GenerateFormulaResponse{
        Formula:    result.Formula,
        Confidence: result.Confidence,
        TokensUsed: result.TokensUsed,
        Valid:      true,
    })
}
```

#### ExplainFormula Handler

```go
func (h *Handlers) ExplainFormula(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    startTime := time.Now()

    var req ExplainFormulaRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        RespondBadRequest(w, r, "Invalid request body")
        return
    }

    if req.Formula == "" {
        RespondBadRequest(w, r, "Formula is required")
        return
    }

    if req.Language == "" {
        req.Language = "en"
    }

    // *** NEW: Include zman_key in cache key ***
    cacheKey := fmt.Sprintf("%s:%s:%s", hashFormula(req.Formula), req.Language, req.ZmanKey)

    // Check cache
    cached, err := h.getCachedExplanation(ctx, cacheKey, req.Language)
    if err == nil && cached != "" {
        RespondJSON(w, r, http.StatusOK, ExplainFormulaResponse{
            Explanation: cached,
            Language:    req.Language,
            Source:      "cached",
        })
        return
    }

    if h.aiClaude == nil {
        RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
            "error":   "AI service not configured",
            "message": "Formula explanation is not available",
        })
        return
    }

    // *** NEW: Validate RAG availability ***
    assembled, err := h.validateRAGAvailability(ctx, req.Formula)
    if err != nil {
        h.respondRAGUnavailable(w, r, err)
        return
    }

    var ragContext string
    var ragUsed bool
    if assembled != nil {
        ragContext = assembled.Context
        ragUsed = len(assembled.Sources) > 0
    }

    // *** NEW: Fetch zman context if provided ***
    zmanCtx, _ := h.fetchZmanContext(ctx, req.ZmanKey, req.PublisherID)
    if zmanCtx != nil {
        ragContext += h.formatZmanContextForPrompt(zmanCtx)
    }

    // Generate explanation
    result, err := h.aiClaude.ExplainFormula(ctx, req.Formula, req.Language, ragContext)
    durationMs := int(time.Since(startTime).Milliseconds())

    // Log to audit
    // ...

    if err != nil {
        slog.Error("failed to generate explanation", "error", err)
        RespondInternalError(w, r, "Failed to generate explanation")
        return
    }

    // Cache with zman-aware key
    h.cacheExplanation(ctx, cacheKey, req.Language, result.Explanation)

    RespondJSON(w, r, http.StatusOK, ExplainFormulaResponse{
        Explanation: result.Explanation,
        Language:    result.Language,
        Source:      result.Source,
    })
}
```

---

## Frontend Updates

### AIFormulaGenerator Component

```typescript
// File: web/components/algorithm/AIFormulaGenerator.tsx

interface AIFormulaGeneratorProps {
  onFormulaGenerated: (formula: string) => void;
  zmanKey?: string;           // NEW
  publisherId?: string;       // NEW
}

export function AIFormulaGenerator({ onFormulaGenerated, zmanKey, publisherId }: AIFormulaGeneratorProps) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/ai/generate-formula', {
        body: JSON.stringify({
          description,
          zman_key: zmanKey,              // NEW
          publisher_id: publisherId ? parseInt(publisherId) : undefined,  // NEW
        }),
      });

      onFormulaGenerated(response.formula);
    } catch (err) {
      if (err.status === 503) {
        setError('AI service temporarily unavailable. Please try again later.');
      } else {
        setError('Failed to generate formula');
      }
    } finally {
      setLoading(false);
    }
  };

  // ...
}
```

### FormulaExplanation Component

```typescript
// File: web/components/zmanim/FormulaExplanation.tsx

interface FormulaExplanationProps {
  formula: string;
  zmanKey?: string;           // NEW
  publisherId?: string;       // NEW
}

export function FormulaExplanation({ formula, zmanKey, publisherId }: FormulaExplanationProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/ai/explain-formula', {
        body: JSON.stringify({
          formula,
          language: 'en',
          zman_key: zmanKey,              // NEW
          publisher_id: publisherId ? parseInt(publisherId) : undefined,  // NEW
        }),
      });

      setExplanation(response.explanation);
    } catch (err) {
      if (err.status === 503) {
        setError('AI explanation temporarily unavailable.');
      } else {
        setError('Failed to get explanation');
      }
    } finally {
      setLoading(false);
    }
  };

  // ...
}
```

---

## Environment Configuration

```bash
# .env or environment variables

# Set to "false" to allow AI endpoints without RAG (for local dev)
AI_REQUIRE_RAG=true  # Default: enforce RAG availability

# Production should always have this as true
# Dev without embeddings indexed can set to false
```

---

## Test Plan

### Unit Tests

```go
func TestValidateRAGAvailability_ReturnsErrorWhenUnavailable(t *testing.T) {
    // Test: RAG service nil + AI_REQUIRE_RAG=true → error
}

func TestValidateRAGAvailability_AllowsBypassInDev(t *testing.T) {
    // Test: RAG service nil + AI_REQUIRE_RAG=false → nil error
}

func TestValidateRAGAvailability_ReturnsErrorWhenNoSources(t *testing.T) {
    // Test: RAG returns empty sources + AI_REQUIRE_RAG=true → error
}

func TestFetchZmanContext_IncludesTags(t *testing.T) {
    // Test: Tags JSON correctly parsed and included
}

func TestFetchZmanContext_IncludesPublisherContext(t *testing.T) {
    // Test: Publisher formula and comment included when publisher_id provided
}
```

### E2E Tests

```typescript
test('AI generation returns 503 when RAG unavailable', async ({ page }) => {
  // Mock RAG to fail, verify 503 response
});

test('AI generation includes zman context in prompt', async ({ page }) => {
  // Provide zman_key, verify enriched response
});
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `api/internal/handlers/ai_formula.go` | Add RAG validation, zman context fetching |
| `api/internal/db/queries/master_registry.sql` | Add GetZmanContextForAI query |
| `web/components/algorithm/AIFormulaGenerator.tsx` | Add zman_key, publisher_id props |
| `web/components/formula-builder/AIGeneratePanel.tsx` | Pass zman context |
| `web/components/zmanim/FormulaExplanation.tsx` | Add zman_key, publisher_id props |

---

## Estimated Effort

| Task | Points |
|------|--------|
| RAG validation logic | 2 |
| Zman context SQLc query | 1 |
| Backend handler updates | 1 |
| Frontend updates | 1 |
| Testing | 1 |
| Total | **5 points** |

---

## Security Considerations

1. **No sensitive data in AI prompts** - Only include public zman metadata
2. **Rate limiting** - Existing AI endpoint rate limits apply
3. **Audit logging** - All AI requests logged with zman_key if provided
