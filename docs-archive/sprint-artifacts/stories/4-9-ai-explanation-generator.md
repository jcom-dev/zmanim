# Story 4.9: AI Explanation Generator

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** ready-for-dev
**Priority:** P2
**Story Points:** 5
**Dependencies:** Story 4.8 (AI Formula Service)

---

## Story

As an **end user viewing zmanim**,
I want **AI-generated explanations of how each time is calculated**,
So that **I can understand the halachic basis without needing to read technical formulas**.

---

## Acceptance Criteria

### AC-4.9.1: Explanation Generation API
- [ ] `POST /api/ai/explain-formula` endpoint accepts DSL formula
- [ ] Returns human-readable explanation in requested language (Hebrew/English)
- [ ] Explanation includes calculation method summary
- [ ] Explanation includes relevant halachic context
- [ ] Response cached to avoid repeated API calls

### AC-4.9.2: Explanation Content
- [ ] Explains what the zman represents halachically
- [ ] Describes the calculation method in plain language
- [ ] Mentions parameters (degrees, minutes, hours)
- [ ] References halachic sources when available
- [ ] Appropriate for non-technical audience

### AC-4.9.3: Bilingual Support
- [ ] Explanations can be generated in English
- [ ] Explanations can be generated in Hebrew
- [ ] Hebrew explanations use proper terminology
- [ ] Language selection based on user preference

### AC-4.9.4: Formula Panel Integration
- [ ] Explanation appears in Formula Reveal panel
- [ ] "Explain" button triggers generation if not cached
- [ ] Loading state during generation
- [ ] Graceful fallback if AI unavailable

### AC-4.9.5: Publisher Customization
- [ ] Publisher can provide custom explanation override
- [ ] Custom explanation takes precedence over AI
- [ ] Publisher can regenerate AI explanation
- [ ] Publisher can edit AI-generated explanation

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for explanation generation
- [ ] Integration tests pass for API endpoint
- [ ] E2E tests pass for Formula Panel integration
- [ ] Explanations verified for accuracy (sample review)
- [ ] Caching verified working
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Explanation Generation (AC: 4.9.1, 4.9.2)
  - [ ] 1.1 Create `api/internal/ai/explainer.go` service
  - [ ] 1.2 Design explanation prompt template
  - [ ] 1.3 Implement `ExplainFormula(formula, language string) (string, error)`
  - [ ] 1.4 Add RAG context for halachic background
  - [ ] 1.5 Write unit tests

- [ ] Task 2: Caching Layer (AC: 4.9.1)
  - [ ] 2.1 Create `explanations` cache table
  - [ ] 2.2 Cache key: hash(formula + language)
  - [ ] 2.3 Cache TTL: 7 days (explanations don't change often)
  - [ ] 2.4 Cache invalidation on formula change

- [ ] Task 3: API Endpoint (AC: 4.9.1, 4.9.3)
  - [ ] 3.1 Create `POST /api/ai/explain-formula` handler
  - [ ] 3.2 Accept formula and language parameters
  - [ ] 3.3 Check cache first
  - [ ] 3.4 Generate if not cached
  - [ ] 3.5 Return explanation with source indicator

- [ ] Task 4: Formula Panel Integration (AC: 4.9.4)
  - [ ] 4.1 Update FormulaPanel component
  - [ ] 4.2 Add "Explain" button or auto-load
  - [ ] 4.3 Display explanation in readable format
  - [ ] 4.4 Add loading skeleton
  - [ ] 4.5 Handle errors gracefully

- [ ] Task 5: Publisher Customization (AC: 4.9.5)
  - [ ] 5.1 Add `custom_explanation` field to zman definition
  - [ ] 5.2 Add explanation editor in publisher UI
  - [ ] 5.3 Display custom explanation if present
  - [ ] 5.4 Add "Regenerate AI" button

- [ ] Task 6: Testing
  - [ ] 6.1 Write unit tests for explainer
  - [ ] 6.2 Write integration tests for API
  - [ ] 6.3 Write E2E tests for full flow
  - [ ] 6.4 Manual review of explanation quality

---

## Dev Notes

### Explainer Service

```go
// api/internal/ai/explainer.go
package ai

type ExplainResult struct {
    Explanation string `json:"explanation"`
    Source      string `json:"source"` // "ai", "custom", "cached"
    Language    string `json:"language"`
}

func (s *ExplainerService) ExplainFormula(ctx context.Context, formula string, lang string) (*ExplainResult, error) {
    // Check cache first
    cached, err := s.cache.Get(ctx, cacheKey(formula, lang))
    if err == nil {
        return &ExplainResult{
            Explanation: cached,
            Source:      "cached",
            Language:    lang,
        }, nil
    }

    // Get RAG context
    ragContext, _ := s.contextService.AssembleContext(ctx, formula, 1000)

    // Generate explanation
    prompt := s.buildExplanationPrompt(formula, lang, ragContext)

    response, err := s.claude.Generate(ctx, prompt)
    if err != nil {
        return nil, err
    }

    // Cache result
    s.cache.Set(ctx, cacheKey(formula, lang), response, 7*24*time.Hour)

    return &ExplainResult{
        Explanation: response,
        Source:      "ai",
        Language:    lang,
    }, nil
}
```

### Explanation Prompt

```go
const explanationPromptEN = `You are explaining a Jewish prayer time (zman) calculation to someone who is religiously observant but not technically trained.

## The Formula
%s

## DSL Reference
%s

## Task
Write a clear, warm explanation of:
1. What this zman represents in Jewish law
2. How it is calculated (in simple terms)
3. Why this particular method is used (if halachic context available)

Keep the explanation:
- 2-4 sentences for simple formulas
- 4-6 sentences for complex formulas
- Avoid technical jargon
- Use respectful religious terminology

Do not mention "DSL", "formula", or "code" - describe it as "this calculation" or "this method".
`

const explanationPromptHE = `אתה מסביר חישוב זמן תפילה יהודי לאדם שומר מצוות אך לא טכני.

## הנוסחה
%s

## משימה
כתוב הסבר ברור וחם של:
1. מה מייצג זמן זה בהלכה
2. איך הוא מחושב (במילים פשוטות)
3. למה נבחרה שיטה זו (אם יש הקשר הלכתי)

שמור על הסבר:
- 2-4 משפטים לנוסחאות פשוטות
- 4-6 משפטים לנוסחאות מורכבות
- הימנע ממונחים טכניים
- השתמש בטרמינולוגיה דתית מכובדת
`
```

### Example Explanations

**Formula:** `solar(16.1, before_sunrise)`

**English:**
> This calculation determines Alos HaShachar (dawn), the earliest time for certain morning prayers. It is calculated as the moment when the sun is 16.1 degrees below the eastern horizon, before it rises. This method follows the opinion that dawn begins approximately 72 minutes before sunrise at equatorial latitudes.

**Hebrew:**
> חישוב זה קובע את עלות השחר, הזמן המוקדם ביותר לתפילות בוקר מסוימות. הוא מחושב כרגע שבו השמש נמצאת 16.1 מעלות מתחת לאופק המזרחי, לפני זריחתה. שיטה זו מבוססת על הדעה שעלות השחר מתחילה כ-72 דקות לפני הזריחה בקו המשווה.

### Cache Table

```sql
CREATE TABLE explanation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_hash VARCHAR(64) NOT NULL,
    language VARCHAR(10) NOT NULL,
    explanation TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,

    UNIQUE(formula_hash, language)
);

CREATE INDEX idx_explanation_cache_lookup ON explanation_cache(formula_hash, language);
```

### API Endpoint

```go
// POST /api/ai/explain-formula
type ExplainRequest struct {
    Formula  string `json:"formula" validate:"required"`
    Language string `json:"language"` // "en" or "he", default "en"
}

type ExplainResponse struct {
    Explanation string `json:"explanation"`
    Source      string `json:"source"` // "ai", "custom", "cached"
}
```

### Formula Panel Integration

```tsx
// web/components/zmanim/FormulaPanel.tsx
function FormulaPanel({ zman }: { zman: ZmanWithFormula }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    if (zman.custom_explanation) {
      setExplanation(zman.custom_explanation);
      return;
    }

    setLoading(true);
    fetch('/api/ai/explain-formula', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formula: zman.formula,
        language: locale === 'he' ? 'he' : 'en',
      }),
    })
      .then(res => res.json())
      .then(data => setExplanation(data.explanation))
      .finally(() => setLoading(false));
  }, [zman.formula, locale]);

  return (
    <Sheet>
      {/* ... header with zman name ... */}

      <div className="mt-4">
        <h4 className="text-sm font-medium mb-2">How It's Calculated</h4>
        {loading ? (
          <Skeleton className="h-20" />
        ) : (
          <p className="text-sm text-muted-foreground" dir="auto">
            {explanation}
          </p>
        )}
      </div>

      {/* ... rest of panel ... */}
    </Sheet>
  );
}
```

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.9]
- [Source: docs/sprint-artifacts/epic-4-ui-wireframes.md#Formula Panel]

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestExplainFormula` - generates valid explanation
- [ ] `TestExplainFormula_Hebrew` - generates Hebrew explanation
- [ ] `TestExplainFormula_Cached` - returns cached result
- [ ] `TestCacheExpiration` - respects TTL

### Integration Tests (API)
- [ ] `POST /api/ai/explain-formula` returns explanation
- [ ] API respects language parameter
- [ ] API caches results
- [ ] API returns cached on subsequent calls

### E2E Tests (Playwright)
- [ ] User opens Formula Panel
- [ ] Explanation loads and displays
- [ ] Hebrew explanation displays with RTL
- [ ] Loading state shows during generation

### Quality Tests (Manual)
- [ ] Review 10 sample explanations for accuracy
- [ ] Verify terminology is appropriate
- [ ] Verify Hebrew grammar is correct
- [ ] Verify explanations are helpful to target audience

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-9-ai-explanation-generator.context.xml
- docs/sprint-artifacts/epic-4-comprehensive-plan.md
- docs/sprint-artifacts/epic-4-ui-wireframes.md

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
