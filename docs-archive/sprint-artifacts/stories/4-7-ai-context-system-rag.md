# Story 4.7: AI Context System (RAG with pgvector)

**Epic:** Epic 4 - Intuitive Zmanim Algorithm Editor with AI-Powered DSL
**Status:** dev-complete
**Priority:** P1
**Story Points:** 8
**Dependencies:** Story 4.0 (PostgreSQL + pgvector) ✅, Story 4.1 (DSL Design)

---

## Story

As a **system**,
I want **a RAG (Retrieval Augmented Generation) system using pgvector for semantic search**,
So that **AI-powered features have relevant halachic and DSL context for accurate formula generation**.

---

## Acceptance Criteria

### AC-4.7.1: Vector Embedding Infrastructure
- [ ] pgvector extension enabled and configured
- [ ] `embeddings` table created with vector column (1536 dimensions for text-embedding-3-small)
- [ ] OpenAI text-embedding-3-small API integrated
- [ ] Embedding generation service created in Go

### AC-4.7.2: Knowledge Base Ingestion
- [ ] DSL specification document chunked and embedded
- [ ] KosherJava zmanim documentation embedded
- [ ] Common halachic sources about zmanim embedded
- [ ] Chunk size: ~500 tokens with 50 token overlap
- [ ] Metadata stored: source, chunk_index, content_type

### AC-4.7.3: Semantic Search API
- [ ] `POST /api/ai/search` endpoint for semantic search
- [ ] Query embedding generated for user input
- [ ] Top-K similar chunks retrieved (K configurable, default 5)
- [ ] Results include relevance score
- [ ] Results include source attribution

### AC-4.7.4: Context Assembly
- [ ] Service assembles context from retrieved chunks
- [ ] Context formatted for Claude API prompt
- [ ] Context includes DSL examples when relevant
- [ ] Context includes halachic sources when relevant
- [ ] Total context respects token limits

### AC-4.7.5: Admin Management
- [ ] Admin can view indexed documents
- [ ] Admin can trigger re-indexing
- [ ] Admin can add new knowledge sources
- [ ] Index statistics displayed (total chunks, last updated)

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Unit tests pass for embedding generation
- [ ] Unit tests pass for semantic search
- [ ] Integration tests pass for search API
- [ ] E2E test verifies search returns relevant results
- [ ] Performance: search < 200ms for typical queries
- [ ] Code review workflow executed (`/bmad:bmm:workflows:code-review`)

---

## Tasks / Subtasks

- [ ] Task 1: Database Setup (AC: 4.7.1)
  - [ ] 1.1 Create migration for `embeddings` table
  - [ ] 1.2 Add vector column with proper dimensions
  - [ ] 1.3 Create IVFFlat or HNSW index for fast search
  - [ ] 1.4 Add metadata columns (source, chunk_index, content_type)

- [ ] Task 2: OpenAI Integration (AC: 4.7.1)
  - [ ] 2.1 Create `api/internal/ai/embeddings.go` service
  - [ ] 2.2 Implement `GenerateEmbedding(text string) ([]float32, error)`
  - [ ] 2.3 Add rate limiting and retry logic
  - [ ] 2.4 Add caching for repeated embeddings
  - [ ] 2.5 Write unit tests with mocked API

- [ ] Task 3: Document Chunking (AC: 4.7.2)
  - [ ] 3.1 Create `api/internal/ai/chunker.go`
  - [ ] 3.2 Implement token-based chunking (tiktoken)
  - [ ] 3.3 Add overlap for context continuity
  - [ ] 3.4 Preserve markdown headers as metadata
  - [ ] 3.5 Write chunking unit tests

- [ ] Task 4: Knowledge Base Ingestion (AC: 4.7.2)
  - [ ] 4.1 Create ingestion script/command
  - [ ] 4.2 Ingest DSL specification document
  - [ ] 4.3 Ingest zmanim calculation documentation
  - [ ] 4.4 Ingest halachic source summaries
  - [ ] 4.5 Store embeddings in database

- [ ] Task 5: Semantic Search (AC: 4.7.3)
  - [ ] 5.1 Create `api/internal/ai/search.go`
  - [ ] 5.2 Implement `SearchSimilar(query string, topK int) ([]SearchResult, error)`
  - [ ] 5.3 Use pgvector cosine distance operator (<=>)
  - [ ] 5.4 Create `POST /api/ai/search` handler
  - [ ] 5.5 Write search integration tests

- [ ] Task 6: Context Assembly (AC: 4.7.4)
  - [ ] 6.1 Create `api/internal/ai/context.go`
  - [ ] 6.2 Implement `AssembleContext(query string, maxTokens int) (string, error)`
  - [ ] 6.3 Format context for Claude prompt
  - [ ] 6.4 Add source attribution formatting
  - [ ] 6.5 Write context assembly tests

- [ ] Task 7: Admin Interface (AC: 4.7.5)
  - [ ] 7.1 Create `GET /api/admin/ai/index` - list indexed docs
  - [ ] 7.2 Create `POST /api/admin/ai/reindex` - trigger reindex
  - [ ] 7.3 Create `GET /api/admin/ai/stats` - index statistics
  - [ ] 7.4 Create admin UI page for management

- [ ] Task 8: Testing
  - [ ] 8.1 Write unit tests for all components
  - [ ] 8.2 Write integration tests for API
  - [ ] 8.3 Write E2E test for search relevance
  - [ ] 8.4 Performance testing

---

## Dev Notes

### Database Schema

```sql
-- Migration: create_embeddings_table.sql
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(255) NOT NULL,          -- 'dsl-spec', 'kosher-java', 'halacha'
    content_type VARCHAR(50) NOT NULL,      -- 'documentation', 'example', 'source'
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,                          -- headers, tags, etc.
    embedding vector(1536) NOT NULL,         -- OpenAI text-embedding-3-small
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(source, chunk_index)
);

-- Create IVFFlat index for approximate nearest neighbor search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Embedding Service

```go
// api/internal/ai/embeddings.go
package ai

import (
    "context"
    "github.com/sashabaranov/go-openai"
)

type EmbeddingService struct {
    client *openai.Client
}

func NewEmbeddingService(apiKey string) *EmbeddingService {
    return &EmbeddingService{
        client: openai.NewClient(apiKey),
    }
}

func (s *EmbeddingService) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
    resp, err := s.client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
        Model: openai.SmallEmbedding3,  // text-embedding-3-small
        Input: []string{text},
    })
    if err != nil {
        return nil, err
    }
    return resp.Data[0].Embedding, nil
}
```

### Chunking Strategy

```go
// api/internal/ai/chunker.go
package ai

type Chunk struct {
    Content    string
    Index      int
    Metadata   map[string]string
}

type Chunker struct {
    MaxTokens int  // ~500
    Overlap   int  // ~50
}

func (c *Chunker) Chunk(document string) []Chunk {
    // 1. Split by markdown headers first
    // 2. If section > MaxTokens, split by paragraphs
    // 3. If paragraph > MaxTokens, split by sentences
    // 4. Add Overlap tokens from previous chunk
    // 5. Store header hierarchy in metadata
}
```

### Semantic Search

```go
// api/internal/ai/search.go
package ai

type SearchResult struct {
    Content     string            `json:"content"`
    Source      string            `json:"source"`
    ContentType string            `json:"content_type"`
    Metadata    map[string]string `json:"metadata"`
    Score       float64           `json:"score"`
}

func (s *SearchService) SearchSimilar(ctx context.Context, query string, topK int) ([]SearchResult, error) {
    // 1. Generate embedding for query
    queryEmbed, err := s.embeddings.GenerateEmbedding(ctx, query)
    if err != nil {
        return nil, err
    }

    // 2. Search using pgvector cosine distance
    rows, err := s.db.Query(ctx, `
        SELECT content, source, content_type, metadata,
               1 - (embedding <=> $1) as score
        FROM embeddings
        ORDER BY embedding <=> $1
        LIMIT $2
    `, pgvector.NewVector(queryEmbed), topK)

    // 3. Parse and return results
}
```

### Context Assembly

```go
// api/internal/ai/context.go
package ai

const contextTemplate = `
## Relevant DSL Documentation

%s

## Halachic Context

%s

## DSL Examples

%s
`

func (s *ContextService) AssembleContext(ctx context.Context, query string, maxTokens int) (string, error) {
    // 1. Search for relevant chunks
    results, err := s.search.SearchSimilar(ctx, query, 10)

    // 2. Group by content type
    dslDocs := filterByType(results, "documentation")
    halachic := filterByType(results, "halachic")
    examples := filterByType(results, "example")

    // 3. Assemble within token budget
    // 4. Format for Claude prompt
}
```

### API Endpoints

```go
// POST /api/ai/search
type SearchRequest struct {
    Query string `json:"query"`
    TopK  int    `json:"top_k,omitempty"` // default 5
}

type SearchResponse struct {
    Results []SearchResult `json:"results"`
}

// GET /api/admin/ai/stats
type IndexStats struct {
    TotalChunks   int       `json:"total_chunks"`
    Sources       []string  `json:"sources"`
    LastIndexed   time.Time `json:"last_indexed"`
}
```

### Knowledge Sources

1. **DSL Specification** (`docs/sprint-artifacts/epic-4-dsl-specification.md`)
   - BNF grammar
   - Function documentation
   - Example formulas

2. **Zmanim Documentation**
   - KosherJava method descriptions
   - Calculation explanations
   - Parameter ranges

3. **Halachic Sources** (summaries)
   - Shulchan Aruch on zmanim
   - Mishnah Berurah explanations
   - Common minhagim variations

### References

- [Source: docs/sprint-artifacts/epic-4-comprehensive-plan.md#Story 4.7]
- [pgvector](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [go-openai](https://github.com/sashabaranov/go-openai)

---

## Testing Requirements

### Unit Tests (Go)
- [ ] `TestGenerateEmbedding` - with mocked OpenAI client
- [ ] `TestChunker` - correct chunk sizes and overlap
- [ ] `TestSearchSimilar` - returns sorted results
- [ ] `TestAssembleContext` - respects token limits

### Integration Tests (API)
- [ ] `POST /api/ai/search` returns relevant results
- [ ] Search handles empty results gracefully
- [ ] Admin endpoints require authentication
- [ ] Reindex triggers embedding regeneration

### E2E Tests (Playwright)
- [ ] Search for "alos hashachar" returns DSL examples
- [ ] Search for "solar angle" returns calculation docs
- [ ] Admin can view index statistics
- [ ] Admin can trigger reindex

### Performance Tests
- [ ] Search < 200ms for typical queries
- [ ] Embedding generation < 500ms
- [ ] Reindex completes in reasonable time

---

## Dev Agent Record

### Context Reference
- docs/sprint-artifacts/stories/4-7-ai-context-system-rag.context.xml
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
