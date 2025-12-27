# Story 4.8: AI Formula Service (Claude Integration)

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 4.2 (DSL Parser), Story 4.7 (RAG Context System)

---

## Story

As a **publisher**,
I want **to describe a zman calculation in natural language and have AI generate the DSL formula**,
So that **I can quickly create accurate formulas without memorizing syntax**.

---

## Acceptance Criteria

### AC-4.8.1: Claude API Integration
- [ ] Anthropic Claude API integrated (claude-3-5-sonnet or claude-3-5-haiku)
- [ ] API key securely configured via environment variable
- [ ] Rate limiting implemented (tokens/minute, requests/minute)
- [ ] Error handling for API failures with graceful degradation

### AC-4.8.2: Natural Language Input
- [ ] Text area for natural language description
- [ ] Example prompts shown as suggestions
- [ ] Hebrew input supported
- [ ] Character limit: 500 characters

### AC-4.8.3: Formula Generation
- [ ] AI generates syntactically valid DSL formula
- [ ] Generated formula is automatically validated via parser
- [ ] If invalid, AI prompted to self-correct (max 2 retries)
- [ ] Response includes confidence score

### AC-4.8.4: Context Enhancement
- [ ] RAG context automatically included in prompt
- [ ] Relevant DSL examples provided to model
- [ ] Halachic context included when applicable
- [ ] System prompt optimized for zmanim domain

### AC-4.8.5: User Interface
- [ ] "Generate with AI" button in formula builder
- [ ] Loading state during generation
- [ ] Generated formula displayed with "Accept" / "Edit" / "Regenerate" options
- [ ] Usage tracking displayed (requests remaining)

### AC-4.8.6: Audit Logging
- [ ] All AI requests logged (input, output, tokens used)
- [ ] Logs include publisher ID for attribution
- [ ] Logs queryable by admin

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for prompt construction
- [ ] Integration tests pass for Claude API calls (mocked)
- [ ] E2E tests pass for generation flow
- [ ] Generated formulas validate against DSL parser
- [ ] Rate limiting verified working
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Claude API Integration (AC: 4.8.1)
  - [ ] 1.1 Create `api/internal/ai/claude.go` service
  - [ ] 1.2 Implement `GenerateFormula(prompt string, context string) (string, error)`
  - [ ] 1.3 Add rate limiting with token bucket
  - [ ] 1.4 Add retry logic with exponential backoff
  - [ ] 1.5 Write unit tests with mocked API

- [ ] Task 2: Prompt Engineering (AC: 4.8.3, 4.8.4)
  - [ ] 2.1 Design system prompt for zmanim formula generation
  - [ ] 2.2 Create prompt template with context injection
  - [ ] 2.3 Add self-correction prompt for invalid formulas
  - [ ] 2.4 Test prompts with various inputs
  - [ ] 2.5 Document prompt versions

- [ ] Task 3: Context Integration (AC: 4.8.4)
  - [ ] 3.1 Call RAG search service for relevant context
  - [ ] 3.2 Format context for prompt inclusion
  - [ ] 3.3 Respect token budget for context
  - [ ] 3.4 Test context relevance

- [ ] Task 4: API Endpoint (AC: 4.8.3)
  - [ ] 4.1 Create `POST /api/ai/generate-formula` handler
  - [ ] 4.2 Validate input (length, content)
  - [ ] 4.3 Call Claude service with context
  - [ ] 4.4 Validate generated formula with DSL parser
  - [ ] 4.5 Implement retry logic if invalid
  - [ ] 4.6 Return formula with confidence score

- [ ] Task 5: Frontend UI (AC: 4.8.2, 4.8.5)
  - [ ] 5.1 Add "Generate with AI" button to formula builder
  - [ ] 5.2 Create AI input dialog/panel
  - [ ] 5.3 Show example prompts as suggestions
  - [ ] 5.4 Implement loading state
  - [ ] 5.5 Display generated formula with actions
  - [ ] 5.6 Show usage counter

- [ ] Task 6: Audit Logging (AC: 4.8.6)
  - [ ] 6.1 Create `ai_audit_logs` table
  - [ ] 6.2 Log all AI requests with metadata
  - [ ] 6.3 Create admin query endpoint
  - [ ] 6.4 Add simple admin UI for viewing logs

- [ ] Task 7: Testing
  - [ ] 7.1 Write unit tests (prompt construction, response parsing)
  - [ ] 7.2 Write integration tests (mocked Claude API)
  - [ ] 7.3 Write E2E tests (full generation flow)
  - [ ] 7.4 Test rate limiting

---

## Dev Notes

### Claude Service

```go
// api/internal/ai/claude.go
package ai

import (
    "context"
    "github.com/anthropics/anthropic-sdk-go"
)

type ClaudeService struct {
    client *anthropic.Client
    model  string // claude-3-5-sonnet-20241022
}

type GenerationResult struct {
    Formula    string  `json:"formula"`
    Confidence float64 `json:"confidence"`
    TokensUsed int     `json:"tokens_used"`
}

func (s *ClaudeService) GenerateFormula(ctx context.Context, request string, ragContext string) (*GenerationResult, error) {
    systemPrompt := buildSystemPrompt(ragContext)

    message, err := s.client.Messages.Create(ctx, anthropic.MessageCreateParams{
        Model:     s.model,
        MaxTokens: 256,
        System:    systemPrompt,
        Messages: []anthropic.MessageParam{
            anthropic.NewUserMessage(anthropic.NewTextBlock(request)),
        },
    })

    if err != nil {
        return nil, err
    }

    // Parse response and extract formula
    formula := extractFormula(message.Content)
    confidence := estimateConfidence(message)

    return &GenerationResult{
        Formula:    formula,
        Confidence: confidence,
        TokensUsed: message.Usage.InputTokens + message.Usage.OutputTokens,
    }, nil
}
```

### System Prompt

```go
const systemPromptTemplate = `You are an expert in Jewish Zmanim (zmanim) and the Zmanim DSL language.

Your task is to generate valid DSL formulas based on natural language descriptions.

## DSL Syntax Reference

%s

## Relevant Examples

%s

## Instructions

1. Analyze the user's request to understand the zman calculation needed
2. Generate a syntactically valid DSL formula
3. Return ONLY the formula, no explanations
4. If the request is ambiguous, make a reasonable assumption based on common halachic practice
5. If the request cannot be expressed in the DSL, respond with "UNSUPPORTED: <reason>"

## Response Format

Return the formula wrapped in triple backticks:
` + "```" + `
<formula here>
` + "```" + `
`

func buildSystemPrompt(ragContext string) string {
    return fmt.Sprintf(systemPromptTemplate,
        getDSLSyntaxReference(),
        ragContext,
    )
}
```

### Self-Correction Flow

```go
func (s *ClaudeService) GenerateWithValidation(ctx context.Context, request string, ragContext string) (*GenerationResult, error) {
    maxRetries := 2

    for i := 0; i <= maxRetries; i++ {
        result, err := s.GenerateFormula(ctx, request, ragContext)
        if err != nil {
            return nil, err
        }

        // Validate with DSL parser
        validationErr := s.dslParser.Validate(result.Formula)
        if validationErr == nil {
            return result, nil
        }

        if i < maxRetries {
            // Add error context for retry
            request = fmt.Sprintf(`Previous attempt generated invalid formula:
Formula: %s
Error: %s

Please correct the formula and try again.

Original request: %s`, result.Formula, validationErr, request)
        }
    }

    return nil, errors.New("failed to generate valid formula after retries")
}
```

### API Endpoint

```go
// POST /api/ai/generate-formula
type GenerateFormulaRequest struct {
    Description string `json:"description" validate:"required,max=500"`
}

type GenerateFormulaResponse struct {
    Formula    string  `json:"formula"`
    Confidence float64 `json:"confidence"`
    Valid      bool    `json:"valid"`
}

func (h *Handlers) GenerateFormula(w http.ResponseWriter, r *http.Request) {
    var req GenerateFormulaRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        respondError(w, r, http.StatusBadRequest, "Invalid request")
        return
    }

    // Get RAG context
    context, err := h.contextService.AssembleContext(r.Context(), req.Description, 2000)
    if err != nil {
        slog.Error("failed to assemble context", "error", err)
        // Continue without context
        context = ""
    }

    // Generate formula
    result, err := h.claudeService.GenerateWithValidation(r.Context(), req.Description, context)
    if err != nil {
        respondError(w, r, http.StatusInternalServerError, "Failed to generate formula")
        return
    }

    // Log for audit
    h.logAIRequest(r.Context(), req.Description, result)

    respondJSON(w, r, http.StatusOK, GenerateFormulaResponse{
        Formula:    result.Formula,
        Confidence: result.Confidence,
        Valid:      true,
    })
}
```

### Audit Logging

```sql
CREATE TABLE ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id UUID REFERENCES publishers(id),
    request_type VARCHAR(50) NOT NULL,  -- 'generate_formula', 'explain_formula'
    input_text TEXT NOT NULL,
    output_text TEXT,
    tokens_used INT,
    model VARCHAR(100),
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_publisher ON ai_audit_logs(publisher_id);
CREATE INDEX idx_ai_audit_created ON ai_audit_logs(created_at);
```

### Frontend Component

```tsx
// web/components/formula-builder/AIGeneratePanel.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  "Alos 72 minutes before sunrise",
  "Sunrise when sun is 16.1 degrees below horizon",
  "End of Shema 3 proportional hours after sunrise (GRA)",
  "Tzeis when 3 medium stars visible (8.5 degrees)",
];

export function AIGeneratePanel({ onAccept }: { onAccept: (formula: string) => void }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ formula: string; confidence: number } | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-500" />
        <h3 className="font-medium">Generate with AI</h3>
      </div>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe the calculation in plain language..."
        maxLength={500}
        dir="auto"
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            onClick={() => setDescription(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>

      <Button onClick={generate} disabled={loading || !description}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generate Formula
      </Button>

      {result && (
        <div className="p-3 bg-muted rounded-md">
          <code className="text-sm">{result.formula}</code>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onAccept(result.formula)}>Accept</Button>
            <Button size="sm" variant="outline" onClick={generate}>Regenerate</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.8]
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference)
- [anthropic-sdk-go](https://github.com/anthropics/anthropic-sdk-go)

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestBuildSystemPrompt` - includes context correctly
- [ ] `TestExtractFormula` - parses response format
- [ ] `TestGenerateWithValidation` - retries on invalid formula
- [ ] `TestRateLimiting` - enforces limits

### Integration Tests (API)
- [ ] `POST /api/ai/generate-formula` with valid input
- [ ] API returns valid DSL formula
- [ ] API handles rate limiting
- [ ] API logs request to audit table

### E2E Tests (Playwright)
- [ ] Publisher can open AI generate panel
- [ ] Publisher can enter description
- [ ] Publisher can click example prompts
- [ ] Generated formula appears after loading
- [ ] Publisher can accept formula into editor

### Mock API Tests
- [ ] Test with mocked Claude responses
- [ ] Test error handling with API failures
- [ ] Test retry logic with invalid first response

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-8-ai-formula-service.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md
- docs/sprint-artifacts/epic-4-dsl-specification.md

### Agent Model Used
(To be filled by dev agent)

### Completion Notes
(To be filled upon completion)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-28 | Story created from Epic 4 comprehensive plan | Party Mode Team |
| 2025-11-28 | Story context generated | Winston (Architect) |
