# Epic 4: Comprehensive Planning Document
# Intuitive Zmanim Algorithm Editor with AI-Powered DSL

**Epic:** Epic 4 - Algorithm Editor UX Transformation
**Author:** BMad
**Date:** 2025-11-28
**Status:** Planning Phase
**Estimated Stories:** 14 (4.1 - 4.13, plus 4.0 completed)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Epic Goals & Success Criteria](#epic-goals--success-criteria)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema](#database-schema)
5. [DSL Specification](#dsl-specification)
6. [UI/UX Design](#uiux-design)
7. [AI Integration](#ai-integration)
8. [RAG System](#rag-system)
9. [Hebrew Calendar Integration](#hebrew-calendar-integration)
10. [Story Breakdown & Sequencing](#story-breakdown--sequencing)
11. [Technical Stack](#technical-stack)
12. [Dependencies & Prerequisites](#dependencies--prerequisites)
13. [Testing Strategy](#testing-strategy)
14. [Migration Path](#migration-path)
15. [Performance Targets](#performance-targets)
16. [Security Considerations](#security-considerations)
17. [Rollout Plan](#rollout-plan)

---

## Executive Summary

### What We're Building

Epic 4 transforms the zmanim algorithm editor from Epic 1's basic JSON-based system into an **Apple-quality, AI-powered** interface that makes complex halachic calculations accessible to rabbis and halachic authorities.

### Key Features

1. **Domain-Specific Language (DSL)** - Expressive, intuitive syntax for all zmanim calculations
2. **Visual Formula Editor** - CodeMirror 6 with intelligent autocomplete and real-time preview
3. **AI-Powered Assistance** - Generate formulas from natural language, auto-explanations
4. **Bilingual Interface** - Full Hebrew + English support throughout
5. **Weekly Preview** - Calendar view with Hebrew dates and Jewish events (hebcal-go)
6. **Copy/Fork System** - Browse and copy formulas from other publishers
7. **RAG Knowledge Base** - Vector embeddings from hebcal, KosherJava, and zmanim docs

### User Journey

```
Publisher Onboarding
       ↓
Wizard: Choose Zmanim (from 40+ templates)
       ↓
Configure each zman in beautiful Edit Modal:
  • View formula + AI explanation
  • Edit with live preview
  • AI generates from description
  • Test across dates/locations
  • Weekly calendar preview
       ↓
Publish algorithm
       ↓
Users see transparent calculations
```

---

## Epic Goals & Success Criteria

### Primary Goals

1. **Accessibility** - Non-programmers can create complex algorithms
2. **Accuracy** - DSL supports all 157+ zmanim from KosherJava
3. **Transparency** - Users understand every calculation step
4. **Efficiency** - Reduce algorithm setup time by 80%
5. **Quality** - Apple-level UX smoothness and polish

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Algorithm setup time | < 30 minutes | From signup to published |
| Formula errors | < 5% | Validation catches 95%+ |
| AI accuracy | > 90% | Generated formulas work correctly |
| User satisfaction | > 4.5/5 | Publisher feedback surveys |
| Page performance | < 2s load | Edit modal open time |

### Non-Goals (Out of Scope)

- ❌ Mobile app (web-only for Epic 4)
- ❌ Visual drag-and-drop builder (future enhancement)
- ❌ Live collaborative editing (future)
- ❌ Formula marketplace (future)
- ❌ Voice input (future)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Publisher Dashboard                                                │
│         ↓                                                            │
│  Algorithm Manager (list of all zmanim)                            │
│         ↓                                                            │
│  Edit Zman Modal ←──────────────┐                                  │
│    • CodeMirror 6 (DSL editor)   │                                  │
│    • Live Preview (split-screen) │                                  │
│    • AI Assistant                │                                  │
│    • Weekly Calendar             │                                  │
│    • Browse Templates            │                                  │
│         ↓                        │                                  │
│  Save Formula → API              │                                  │
│                                  │                                  │
└──────────────────────────────────┼──────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                       BACKEND (Go)                                   │
├──────────────────────────────────┴──────────────────────────────────┤
│                                                                      │
│  API Endpoints:                                                     │
│  ├─ POST /api/dsl/validate         (Client-side validation)        │
│  ├─ POST /api/dsl/preview           (Calculate with formula)        │
│  ├─ POST /api/dsl/preview-week      (Weekly calculations)          │
│  ├─ GET  /api/zmanim/templates      (System default formulas)      │
│  ├─ GET  /api/zmanim/browse         (Browse other publishers)      │
│  └─ PUT  /api/publisher/zmanim/:id  (Save formula)                 │
│                                                                      │
│  DSL Engine:                                                        │
│  ├─ Lexer (tokenize)                                                │
│  ├─ Parser (build AST)                                              │
│  ├─ Validator (semantic checks)                                     │
│  ├─ Dependency Resolver (topological sort)                          │
│  └─ Executor (calculate result)                                     │
│                                                                      │
│  AI Service:                                                        │
│  ├─ Formula Generator (Claude + RAG)                                │
│  ├─ Explanation Generator (Claude)                                  │
│  └─ Comment Generator (Claude)                                      │
│                                                                      │
│  Hebrew Calendar Service:                                           │
│  └─ hebcal-go wrapper                                               │
│                                                                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                    DATABASE (PostgreSQL + pgvector)                  │
├──────────────────────────────────┴──────────────────────────────────┤
│                                                                      │
│  Tables:                                                             │
│  ├─ zmanim_templates (40+ system defaults)                          │
│  ├─ publisher_zmanim (publisher formulas)                           │
│  ├─ zmanim_knowledge (RAG embeddings)                               │
│  └─ publisher_ai_usage (rate limiting)                              │
│                                                                      │
│  Extensions:                                                         │
│  ├─ pgvector (vector similarity search)                             │
│  └─ postgis (geographic calculations)                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

External Services:
├─ OpenAI API (text-embedding-3-small for RAG)
├─ Anthropic API (Claude for generation)
└─ hebcal.com (optional reference data)
```

### Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **DSL Syntax** | Hybrid (functions + operators) | Balance readability and expressiveness |
| **Editor Library** | CodeMirror 6 | Lighter than Monaco (100KB vs 2MB), excellent autocomplete |
| **Validation** | Server-side (Go) | Single source of truth, easier maintenance |
| **AI Provider** | Claude (Anthropic) | Superior reasoning for complex formulas |
| **Embeddings** | OpenAI text-embedding-3-small | Cost-effective, high quality |
| **Hebrew Calendar** | hebcal-go | Native Go, well-maintained, comprehensive |
| **Preview Strategy** | Split-screen with live updates | Immediate feedback, Apple-like UX |
| **Template Storage** | Database (not hardcoded) | Allows updates without deployment |

---

## Database Schema

### New Tables

#### 1. zmanim_templates

System-wide default formulas (seeded from hebcal-go during migration).

```sql
CREATE TABLE zmanim_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zman_key TEXT UNIQUE NOT NULL,
  hebrew_name TEXT NOT NULL,
  english_name TEXT NOT NULL,
  formula_dsl TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'essential', 'optional', 'advanced'
  is_required BOOLEAN DEFAULT false,
  description TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_zmanim_templates_category ON zmanim_templates(category);
CREATE INDEX idx_zmanim_templates_sort ON zmanim_templates(sort_order);

-- Example data:
INSERT INTO zmanim_templates (zman_key, hebrew_name, english_name, formula_dsl, category, is_required, sort_order) VALUES
  ('sunrise', 'הנץ החמה', 'Sunrise', 'sunrise', 'essential', true, 1),
  ('alos_hashachar', 'עלות השחר', 'Alos Hashachar', 'solar(16.1, before_sunrise)', 'essential', true, 2),
  ('sof_zman_shma_gra', 'סוף זמן ק"ש גר"א', 'Sof Zman Shma (GRA)', 'sunrise + shaos(3, gra)', 'essential', true, 3),
  ('sof_zman_shma_mga', 'סוף זמן ק"ש מג"א', 'Sof Zman Shma (MGA)', 'sunrise - 72min + shaos(3, mga)', 'optional', false, 20);
```

#### 2. publisher_zmanim

Publisher-specific zmanim formulas (migrated from Epic 1 algorithms table).

```sql
CREATE TABLE publisher_zmanim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
  zman_key TEXT NOT NULL,
  hebrew_name TEXT NOT NULL,
  english_name TEXT NOT NULL,
  formula_dsl TEXT NOT NULL,
  ai_explanation TEXT,
  publisher_comment TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,  -- true if user-created, false if copied from template
  dependencies TEXT[],  -- Auto-extracted from formula_dsl
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(publisher_id, zman_key)
);

CREATE INDEX idx_publisher_zmanim_publisher ON publisher_zmanim(publisher_id);
CREATE INDEX idx_publisher_zmanim_enabled ON publisher_zmanim(publisher_id, is_enabled);
CREATE INDEX idx_publisher_zmanim_visible ON publisher_zmanim(publisher_id, is_visible);
```

#### 3. zmanim_knowledge (RAG)

Vector embeddings for AI context retrieval.

```sql
CREATE TABLE zmanim_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,  -- 'hebcal', 'kosherjava', 'zmanim'
  source_url TEXT,
  category TEXT NOT NULL,  -- 'calculation', 'halacha', 'astronomy', 'example'
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON zmanim_knowledge USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_zmanim_knowledge_source ON zmanim_knowledge(source);
CREATE INDEX idx_zmanim_knowledge_category ON zmanim_knowledge(category);
```

#### 4. publisher_ai_usage (Rate Limiting)

Track AI API usage per publisher for cost management.

```sql
CREATE TABLE publisher_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE,
  month DATE NOT NULL,  -- YYYY-MM-01 format
  formula_generations INTEGER DEFAULT 0,
  explanation_generations INTEGER DEFAULT 0,
  comment_generations INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(publisher_id, month)
);

CREATE INDEX idx_publisher_ai_usage_month ON publisher_ai_usage(publisher_id, month);
```

### Schema Changes to Existing Tables

#### Migration: algorithms → publisher_zmanim

Epic 1's `algorithms` table used JSON. Epic 4 uses individual rows per zman.

```sql
-- Migration script (simplified)
-- For each publisher's algorithm JSON, create rows in publisher_zmanim

WITH algorithm_data AS (
  SELECT
    id,
    publisher_id,
    config->>'zmanim' as zmanim_json
  FROM algorithms
  WHERE status = 'published'
)
INSERT INTO publisher_zmanim (publisher_id, zman_key, hebrew_name, english_name, formula_dsl, is_enabled, is_visible)
SELECT
  publisher_id,
  zman_key,
  get_hebrew_name(zman_key),
  get_english_name(zman_key),
  convert_json_to_dsl(zman_config),  -- Custom function
  true,
  true
FROM algorithm_data, jsonb_each(zmanim_json::jsonb) AS z(zman_key, zman_config);

-- Keep algorithms table for version history
-- Add migration_status column to track completion
ALTER TABLE algorithms ADD COLUMN migrated_to_dsl BOOLEAN DEFAULT false;
```

---

## DSL Specification

**Full DSL specification:** See [`epic-4-dsl-specification.md`](./epic-4-dsl-specification.md)

### Quick Reference

```javascript
// === PRIMITIVES ===
sunrise, sunset, solar_noon, solar_midnight
civil_dawn, civil_dusk
nautical_dawn, nautical_dusk
astronomical_dawn, astronomical_dusk

// === FUNCTIONS ===
solar(degrees, direction)         // Solar angle: solar(16.1, before_sunrise)
shaos(hours, base)                // Proportional hours: shaos(3, gra)
midpoint(time1, time2)            // Midpoint: midpoint(sunrise, sunset)

// === OPERATORS ===
+  -  *  /  ()                    // Arithmetic

// === DURATIONS ===
72min, 1hr, 1h 30min              // Time offsets

// === REFERENCES ===
@zman_key                         // Reference other zmanim

// === CONDITIONALS ===
if (latitude > 60) { ... } else { ... }
```

### Example Formulas

```javascript
// Standard GRA Sof Zman Shma
sunrise + shaos(3, gra)

// MGA Sof Zman Shma
sunrise - 72min + shaos(3, mga)

// Rabbeinu Tam Tzais
sunset + 72min

// High latitude fallback
if (latitude > 60) {
  civil_dusk
} else {
  solar(8.5, after_sunset)
}

// Complex reference chain
@alos_hashachar + shaos(3, custom(@alos_hashachar, @tzais_symmetric))
```

---

## UI/UX Design

**Full wireframes:** See [`epic-4-ui-wireframes.md`](./epic-4-ui-wireframes.md)

### Key UI Components

#### 1. Onboarding Wizard

```
Step 1: Welcome
Step 2: Choose Base (Templates / Copy Publisher / From Scratch)
Step 3: Select Zmanim (with Show/Hide/Skip options)
Step 4: Review & Publish
```

#### 2. Algorithm Manager (Main Page)

```
┌─────────────────────────────────────────────────────────┐
│  Your Zmanim Algorithm                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Essential Zmanim (11)                                  │
│  ☑ Alos Hashachar        sunrise - 72min      [Edit]   │
│  ☑ Sunrise               sunrise              [Edit]   │
│  ☑ Sof Zman Shma         sunrise + ...        [Edit]   │
│  ...                                                     │
│                                                          │
│  Optional Zmanim (7) [Show/Hide]                        │
│  ☑ Sof Zman Shma MGA     @alos + ...    👁 [Edit]      │
│  ☐ Alos 90 Minutes       sunrise - 90min    [Edit]   │
│  ...                                                     │
│                                                          │
│  [+ Add Custom Zman]  [Preview Week]  [Publish]        │
└─────────────────────────────────────────────────────────┘
```

#### 3. Edit Zman Modal (Split-Screen)

Left side: **Formula Editor**
- CodeMirror 6 with DSL syntax highlighting
- Intelligent autocomplete
- Real-time validation
- AI Generate button
- Browse Templates button

Right side: **Live Preview**
- Real-time calculation result (updates as you type)
- Step-by-step breakdown
- Date/Location test controls
- Weekly preview button

Bottom: **AI Explanation + Public Comment**

#### 4. Weekly Preview Calendar

```
┌─────────────────────────────────────────────────────────┐
│  Week: Dec 1-7, 2024          [Year ▾] [Week ▾]       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Monday, Dec 2 • ב׳ כסלו תשפ״ה • 2nd Day Chanukah     │
│  Sunrise: 6:35 AM  →  Sof Zman Shma: 9:38 AM          │
│                                                          │
│  Tuesday, Dec 3 • ג׳ כסלו תשפ״ה • 3rd Day Chanukah    │
│  Sunrise: 6:36 AM  →  Sof Zman Shma: 9:39 AM          │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

### UX Principles

1. **Immediate Feedback** - Live preview updates as you type (300ms debounce)
2. **Progressive Disclosure** - Complex features hidden until needed
3. **Helpful Errors** - Clear messages with suggestions ("Did you mean...?")
4. **Zero Learning Curve** - AI generates formulas from descriptions
5. **Keyboard First** - Full keyboard navigation and shortcuts
6. **Responsive** - Desktop (side panel) and mobile (bottom sheet) optimized

---

## AI Integration

### Architecture

```
User Request
     ↓
Frontend → POST /api/ai/generate-formula
     ↓
Go API Handler
     ↓
AI Service (Go)
     ↓
1. Retrieve RAG Context (pgvector similarity search)
2. Build Prompt with Context
3. Call Claude API (Anthropic)
4. Parse Response
5. Validate Generated DSL
     ↓
Return Formula + Explanation
     ↓
Frontend displays result
```

### AI Features

#### 1. Formula Generation

**Input:** Natural language description
**Output:** Valid DSL formula

```typescript
POST /api/ai/generate-formula
Body: {
  prompt: "Calculate 45 minutes after sunset for normal latitudes, but use civil dusk above 60 degrees",
  context: "tzais" // optional hint
}

Response: {
  data: {
    formula_dsl: "if (latitude > 60) { civil_dusk } else { sunset + 45min }",
    explanation: "This formula uses a conditional...",
    confidence: 0.92
  }
}
```

**RAG Context Used:**
- Examples of conditional formulas from KosherJava
- Documentation on high-latitude handling
- Similar formulas from other publishers

#### 2. Explanation Generation

**Input:** DSL formula
**Output:** Human-readable explanation

```typescript
POST /api/ai/explain-formula
Body: {
  formula_dsl: "sunrise + shaos(3, gra)",
  zman_name: "Sof Zman Shma"
}

Response: {
  data: {
    explanation: "This zman is calculated as 3 proportional hours (shaos zmaniyos) after sunrise according to the Vilna Gaon (GRA) method. A proportional hour is 1/12 of the time from sunrise to sunset..."
  }
}
```

#### 3. Comment Generation

**Input:** Formula + Explanation
**Output:** Publisher-facing public comment

```typescript
POST /api/ai/generate-comment
Body: {
  formula_dsl: "sunrise + shaos(3, gra)",
  explanation: "This calculates 3 proportional hours...",
  zman_name: "Sof Zman Shma"
}

Response: {
  data: {
    comment: "We follow the opinion of the Vilna Gaon (GR\"A), calculating Sof Zman Shma as three proportional hours after sunrise. This calculation divides the daytime into 12 equal parts."
  }
}
```

### Rate Limiting

```go
// Per-publisher monthly limits (configurable)
const (
  DefaultFormulaGenerationsPerMonth  = 100
  DefaultExplanationGenerationsPerMonth = 200
  DefaultCommentGenerationsPerMonth  = 200
)

// Admin can adjust per publisher:
type AILimits struct {
  PublisherID            string
  FormulaGenerations     int
  ExplanationGenerations int
  CommentGenerations     int
}

// Check before API call
if usage.FormulaGenerations >= limits.FormulaGenerations {
  return errors.New("Monthly AI formula generation limit reached")
}
```

### Cost Tracking

```go
type AIUsageRecord struct {
  PublisherID string
  Month       time.Time

  // Token counts
  InputTokens  int
  OutputTokens int
  TotalTokens  int

  // Cost (USD)
  Cost float64

  // Breakdown
  FormulaGenerations     int
  ExplanationGenerations int
  CommentGenerations     int
}

// Pricing (as of 2024)
const (
  ClaudeInputTokenCost  = 0.003 / 1000  // $3 per 1M tokens
  ClaudeOutputTokenCost = 0.015 / 1000  // $15 per 1M tokens
)
```

---

## RAG System

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  1. Knowledge Ingestion (One-time Seeding)          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Clone Repos                                        │
│  ├─ hebcal                                          │
│  ├─ KosherJava/zmanim                               │
│  └─ zmanim                                      │
│       ↓                                              │
│  Extract Content                                     │
│  ├─ Code comments                                   │
│  ├─ Documentation                                    │
│  ├─ Example formulas                                 │
│  └─ Halachic sources                                 │
│       ↓                                              │
│  Chunk (~500 tokens each)                           │
│       ↓                                              │
│  Generate Embeddings (OpenAI text-embedding-3-small)│
│       ↓                                              │
│  Store in PostgreSQL (zmanim_knowledge table)       │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  2. Query-Time Retrieval                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  User Prompt                                         │
│       ↓                                              │
│  Embed Query (OpenAI)                               │
│       ↓                                              │
│  Vector Similarity Search (pgvector)                │
│  SELECT content                                      │
│  FROM zmanim_knowledge                               │
│  ORDER BY embedding <=> query_embedding              │
│  LIMIT 5                                             │
│       ↓                                              │
│  Retrieve Top 5 Chunks                              │
│       ↓                                              │
│  Build Context for Claude                           │
│  "Relevant documentation: ..."                      │
│       ↓                                              │
│  Send to Claude API                                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Seeding Process

#### Step 1: Clone Repositories

```bash
#!/bin/bash
# scripts/seed-rag/clone-repos.sh

mkdir -p tmp/rag-sources

# Clone hebcal
git clone --depth 1 https://github.com/hebcal/hebcal.git tmp/rag-sources/hebcal

# Clone KosherJava
git clone --depth 1 https://github.com/KosherJava/zmanim.git tmp/rag-sources/kosherjava

# Our own docs (already local)
cp -r docs tmp/rag-sources/zmanim
```

#### Step 2: Extract & Chunk Content

```typescript
// scripts/seed-rag/chunk-knowledge.ts

interface KnowledgeChunk {
  source: 'hebcal' | 'kosherjava' | 'zmanim';
  source_url: string;
  category: 'calculation' | 'halacha' | 'astronomy' | 'example';
  content: string;
  metadata: {
    file_path: string;
    line_start?: number;
    line_end?: number;
    zman_name?: string;
  };
}

async function extractFromHebcal(): Promise<KnowledgeChunk[]> {
  const chunks: KnowledgeChunk[] = [];

  // Extract from hebcal documentation
  // Extract from hebcal-go source comments
  // Extract formula examples

  return chunks;
}

async function extractFromKosherJava(): Promise<KnowledgeChunk[]> {
  // Extract JavaDoc comments
  // Extract calculation methods
  // Extract parameter descriptions
}

// Chunk size: ~500 tokens
// Overlap: 50 tokens between chunks
```

#### Step 3: Generate Embeddings

```typescript
// scripts/seed-rag/generate-embeddings.ts

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536
  });

  return response.data[0].embedding;
}

async function batchGenerateEmbeddings(chunks: KnowledgeChunk[]): Promise<void> {
  // Process in batches of 100
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100);

    const embeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk.content))
    );

    // Store in database
    await insertChunks(batch, embeddings);
  }
}
```

#### Step 4: Insert into PostgreSQL

```typescript
// scripts/seed-rag/seed-database.ts

async function insertChunks(
  chunks: KnowledgeChunk[],
  embeddings: number[][]
): Promise<void> {
  const values = chunks.map((chunk, i) => ({
    source: chunk.source,
    source_url: chunk.source_url,
    category: chunk.category,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: `[${embeddings[i].join(',')}]`
  }));

  await db.query(`
    INSERT INTO zmanim_knowledge
      (source, source_url, category, content, metadata, embedding)
    VALUES ${values.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6}::vector)`).join(', ')}
  `, values.flatMap(v => [v.source, v.source_url, v.category, v.content, JSON.stringify(v.metadata), v.embedding]));
}
```

### Query-Time Retrieval

```go
// api/internal/services/ai_service.go

func (s *AIService) GetRelevantContext(ctx context.Context, query string, limit int) ([]string, error) {
  // 1. Generate embedding for query
  queryEmbedding, err := s.generateEmbedding(ctx, query)
  if err != nil {
    return nil, err
  }

  // 2. Vector similarity search
  var chunks []string
  err = s.db.Select(ctx, &chunks, `
    SELECT content
    FROM zmanim_knowledge
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `, pgvector.NewVector(queryEmbedding), limit)

  return chunks, err
}

func (s *AIService) generateEmbedding(ctx context.Context, text string) ([]float32, error) {
  // Call OpenAI embeddings API
  resp, err := s.openaiClient.CreateEmbeddings(ctx, openai.EmbeddingRequest{
    Model: "text-embedding-3-small",
    Input: []string{text},
  })

  return resp.Data[0].Embedding, err
}
```

### Example RAG-Enhanced Prompt

```
System: You are a Jewish zmanim calculation expert. Generate DSL formulas based on user descriptions.

Context (from RAG):
---
[Chunk 1: hebcal documentation]
Alos Hashachar (dawn) is traditionally calculated as 72 minutes before sunrise,
which corresponds to the sun being 16.1 degrees below the geometric horizon...

[Chunk 2: KosherJava source]
public Date getAlos16Point1Degrees() {
  return getSunriseOffsetByDegrees(ZENITH_16_POINT_1);
}

[Chunk 3: Example formula]
alos_hashachar: solar(16.1, before_sunrise)
---

User: I want dawn to be 72 minutes before sunrise

AI (using RAG context):
Based on the halachic sources, I'll generate the DSL formula:

```
sunrise - 72min
```

This formula represents Alos Hashachar at 72 minutes before sunrise, which is a common calculation method used in many communities. This is equivalent to the sun being approximately 16.1 degrees below the horizon.

Would you also like me to add a note about the alternative degree-based calculation (solar(16.1, before_sunrise))?
```

### RAG Performance Expectations

- **Embedding generation:** ~100ms per query (OpenAI API)
- **Vector search:** <50ms for top-10 results (pgvector with HNSW index)
- **Total RAG overhead:** ~150-200ms per AI request
- **Context window:** 5-10 relevant chunks (2000-4000 tokens)

---

## Hebrew Calendar Integration

### hebcal-go Integration

Epic 4 integrates the **hebcal-go** library for accurate Hebrew calendar calculations and Jewish event tracking.

### Weekly Preview Features

#### 44 Jewish Events Tracked

```go
type JewishEvent struct {
  Date        time.Time
  HebrewDate  HebrewDate
  EventType   string  // "shabbos", "yom_tov", "fast", "rosh_chodesh", etc.
  Name        string
  HebrewName  string
  Zmanim      map[string]time.Time  // Calculated for this date
}

type HebrewDate struct {
  Year    int
  Month   string  // "Tishrei", "Cheshvan", etc.
  Day     int
  Display string  // "15 Nisan 5785"
}
```

#### Event Categories

1. **Shabbos & Yom Tov** (26 events)
   - Weekly Shabbos
   - Rosh Hashanah
   - Yom Kippur
   - Sukkos + Shmini Atzeres + Simchas Torah
   - Chanukah (8 days)
   - Purim + Shushan Purim
   - Pesach (8 days)
   - Shavuos
   - 3 Weeks (17 Tammuz to 9 Av)

2. **Fast Days** (6 events)
   - Fast of Gedaliah
   - 10th of Teves
   - Fast of Esther
   - 17th of Tammuz
   - 9th of Av
   - Tzom Gedalia

3. **Rosh Chodesh** (12 events)
   - Monthly new moon celebrations

4. **Special Days** (varies)
   - Tu B'Shvat
   - Lag B'Omer
   - Tu B'Av
   - Etc.

### Weekly Preview UI

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 WEEKLY PREVIEW: November 28 - December 4, 2025             │
│  15 Kislev - 21 Kislev 5785                      [← Week →]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Thursday, Nov 28  •  15 Kislev 5785                           │
│  ═══════════════════════════════════════                       │
│  🌅 Sunrise:        7:12 AM                                    │
│  ☀️  Solar Noon:    11:42 AM                                    │
│  🌇 Sunset:         4:12 PM                                    │
│  ⭐ Nightfall:      4:58 PM                                    │
│                                                                 │
│  🕐 Sof Zman Shma (GRA):     9:37 AM                           │
│  🕐 Sof Zman Tfila (GRA):    10:41 AM                          │
│  🕐 Plag HaMincha:            3:24 PM                          │
│  🕐 Candle Lighting:          N/A (not erev Shabbos)           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Friday, Nov 29  •  16 Kislev 5785  •  🕯️ Erev Shabbos         │
│  ═══════════════════════════════════════                       │
│  🌅 Sunrise:        7:13 AM                                    │
│  ☀️  Solar Noon:    11:43 AM                                    │
│  🌇 Sunset:         4:12 PM                                    │
│  ⭐ Nightfall:      4:57 PM                                    │
│                                                                 │
│  🕐 Sof Zman Shma (GRA):     9:38 AM                           │
│  🕐 Sof Zman Tfila (GRA):    10:41 AM                          │
│  🕐 Plag HaMincha:            3:24 PM                          │
│  🕯️ Candle Lighting:          4:12 PM (18 min before sunset)   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Saturday, Nov 30  •  17 Kislev 5785  •  🕯️ Shabbos Kodesh     │
│  ═══════════════════════════════════════                       │
│  📖 Parshas Vayeitzei                                          │
│                                                                 │
│  🌅 Sunrise:        7:14 AM                                    │
│  🕐 Sof Zman Shma (GRA):     9:38 AM                           │
│  ⭐ Nightfall:      4:57 PM                                    │
│  ⭐ Shabbos Ends (72 min):    5:30 PM                          │
│  ⭐ Rabbeinu Tam:             5:52 PM                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Bilingual Date Display

All dates shown in parallel Hebrew and English:

```typescript
interface BilingualDate {
  gregorian: {
    date: Date;
    display: string;  // "November 28, 2025"
  };
  hebrew: {
    year: number;     // 5785
    month: string;    // "Kislev" / "כסלו"
    day: number;      // 15
    display: string;  // "15 Kislev 5785" / "ט״ו כסלו תשפ״ה"
  };
}
```

### Implementation Notes

- **hebcal-go** runs as a **Go binary called from Node.js API**
- Calculations cached in Redis (TTL: 24 hours)
- Weekly preview pre-calculates all zmanim for 7 days
- Location-aware (uses publisher's default location)
- Timezone-aware (handles DST transitions)

---

## Story Breakdown & Sequencing

### Phase 1: Foundation (Stories 4.1-4.3) - **Week 1-2**

#### Story 4.1: Zmanim DSL Design
**Status:** ready-for-dev
**Estimated Effort:** 3 days

**Acceptance Criteria:**
- Research all 157+ zmanim from KosherJava/hebcal-go
- Complete DSL specification document (already created)
- BNF grammar finalized
- Example formulas for all common zmanim
- Validation rules documented

**Deliverables:**
- `docs/sprint-artifacts/epic-4-dsl-specification.md` ✓ (already complete)
- Research notes on zmanim calculation methods
- Edge case handling (high latitudes, polar regions)

**Dependencies:** None (Story 4.0 already completed)

---

#### Story 4.2: Zmanim DSL Parser
**Status:** ready-for-dev
**Estimated Effort:** 5 days

**Acceptance Criteria:**
- Lexer tokenizes DSL syntax
- Parser builds AST from tokens
- Compiler generates executable calculation
- Validation detects syntax errors with helpful messages
- Support all DSL features (primitives, functions, operators, conditionals)

**Deliverables:**
- `api/internal/zmanim/dsl/lexer.go`
- `api/internal/zmanim/dsl/parser.go`
- `api/internal/zmanim/dsl/compiler.go`
- `api/internal/zmanim/dsl/validator.go`
- Unit tests with 90%+ coverage

**Technical Approach:**
```go
// API structure
type DSLService interface {
  Parse(formula string) (*AST, error)
  Compile(ast *AST) (*Calculation, error)
  Validate(formula string) ([]ValidationError, error)
  Execute(calc *Calculation, ctx CalculationContext) (time.Time, error)
}

type AST struct {
  Root Node
}

type Node interface {
  Type() NodeType
  Evaluate(ctx CalculationContext) (Value, error)
}
```

**Dependencies:** 4.1 (DSL specification)

---

#### Story 4.3: Bilingual Naming
**Status:** ready-for-dev
**Estimated Effort:** 2 days

**Acceptance Criteria:**
- All zmanim have **mandatory** Hebrew + English names
- Database schema enforces non-null bilingual fields
- API returns both names in all responses
- UI displays Hebrew primary, English secondary (configurable)
- Search works in both languages

**Database Updates:**
```sql
ALTER TABLE zmanim_templates
  ALTER COLUMN hebrew_name SET NOT NULL,
  ALTER COLUMN english_name SET NOT NULL;

ALTER TABLE publisher_zmanim
  ALTER COLUMN hebrew_name SET NOT NULL,
  ALTER COLUMN english_name SET NOT NULL;

-- Search index for both languages
CREATE INDEX idx_zmanim_templates_names
  ON zmanim_templates USING gin(to_tsvector('hebrew', hebrew_name) || to_tsvector('english', english_name));
```

**Dependencies:** 4.2 (uses DSL service)

---

### Phase 2: Editor UX (Stories 4.4-4.6) - **Week 3-4**

#### Story 4.4: Guided Formula Builder
**Status:** ready-for-dev
**Estimated Effort:** 5 days

**Acceptance Criteria:**
- shadcn/ui components for visual formula construction
- Drag-and-drop formula elements
- Real-time preview with calculation breakdown
- Validation errors displayed inline
- Autocomplete for zman references
- Split-screen layout (editor left, preview right)

**Key Components:**
- `web/src/components/zmanim/FormulaBuilder.tsx`
- `web/src/components/zmanim/FormulaPreview.tsx`
- `web/src/components/zmanim/DSLAutocomplete.tsx`

**UI Wireframes:**
- See `docs/sprint-artifacts/epic-4-ui-wireframes.md` (State 2b)

**Dependencies:** 4.2 (DSL parser), 4.3 (bilingual names)

---

#### Story 4.5: Halachic Documentation
**Status:** ready-for-dev
**Estimated Effort:** 2 days

**Acceptance Criteria:**
- Comment field with Markdown + Hebrew support
- Rich text editor (shadcn/ui textarea with preview)
- RTL support for Hebrew text
- Publisher comments separate from AI explanations
- Search includes comment content

**Database Schema:**
```sql
ALTER TABLE publisher_zmanim
  ADD COLUMN publisher_comment_md TEXT,
  ADD COLUMN publisher_comment_html TEXT;

-- Full-text search
CREATE INDEX idx_publisher_zmanim_comments
  ON publisher_zmanim USING gin(to_tsvector('hebrew', publisher_comment_md));
```

**Dependencies:** 4.4 (formula builder)

---

#### Story 4.6: Advanced Mode Editor
**Status:** ready-for-dev
**Estimated Effort:** 4 days

**Acceptance Criteria:**
- CodeMirror 6 integration
- Custom DSL language mode
- Syntax highlighting for DSL keywords
- Autocomplete for primitives, functions, zman references
- Real-time validation with inline errors
- Split-screen preview (same as 4.4)

**CodeMirror Extensions:**
```typescript
import { EditorView } from '@codemirror/view';
import { StreamLanguage } from '@codemirror/language';

const zmanim DSLLanguage = StreamLanguage.define({
  token(stream, state) {
    // Tokenizer for DSL syntax
    if (stream.match(/sunrise|sunset|solar_noon/)) {
      return 'keyword';
    }
    if (stream.match(/solar|shaos|midpoint/)) {
      return 'function';
    }
    if (stream.match(/@[a-z_]+/)) {
      return 'variable';
    }
    // ... more rules
  }
});
```

**Dependencies:** 4.4 (formula builder), 4.2 (DSL parser)

---

### Phase 3: AI Features (Stories 4.7-4.9) - **Week 5-6**

#### Story 4.7: AI Context System (RAG)
**Status:** ready-for-dev
**Estimated Effort:** 5 days

**Acceptance Criteria:**
- Vector embeddings for hebcal docs, KosherJava source, zmanim patterns
- pgvector storage with HNSW index
- Semantic search retrieves top-K relevant chunks
- Seeding script processes documentation
- Embedding generation via OpenAI API

**Seeding Sources:**
1. **hebcal documentation** (markdown files)
2. **KosherJava source code** (Java comments + method signatures)
3. **zmanim internal docs** (architecture, patterns)

**Deliverables:**
- `api/cmd/seed-rag/main.go` - Seeding CLI
- `api/internal/ai/rag_service.go` - RAG query service
- Database migration for `zmanim_knowledge` table

**Dependencies:** 4.0 (pgvector), 4.1 (DSL spec for context)

---

#### Story 4.8: AI Formula Service
**Status:** ready-for-dev
**Estimated Effort:** 4 days

**Acceptance Criteria:**
- Claude API integration (Anthropic)
- Natural language → DSL formula generation
- RAG-enhanced prompts with relevant context
- Rate limiting per publisher (configurable)
- Usage tracking (tokens consumed)

**API Endpoint:**
```typescript
POST /api/publishers/:id/zmanim/generate
{
  "prompt": "I want dawn to be 72 minutes before sunrise",
  "language": "en"  // or "he"
}

Response:
{
  "formula": "sunrise - 72min",
  "explanation": "This formula calculates Alos Hashachar...",
  "sources": ["hebcal-alos.md", "KosherJava.getAlos72()"],
  "confidence": 0.95
}
```

**Rate Limiting:**
```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  publisher_id UUID REFERENCES publishers(id),
  feature TEXT NOT NULL,  -- 'formula_generation', 'explanation', etc.
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly limit check
SELECT SUM(tokens_used)
FROM ai_usage
WHERE publisher_id = $1
  AND created_at > NOW() - INTERVAL '30 days';
```

**Dependencies:** 4.7 (RAG system), 4.2 (DSL parser for validation)

---

#### Story 4.9: AI Explanation Generator
**Status:** ready-for-dev
**Estimated Effort:** 3 days

**Acceptance Criteria:**
- Auto-generate human-readable explanations for formulas
- Bilingual explanations (Hebrew + English)
- Explains each component of complex formulas
- Cached per formula (regenerate on formula change)

**Example:**
```
Formula: sunrise + shaos(3, gra)

Explanation (English):
This zman is calculated by adding 3 proportional hours (shaos zmaniyos)
to sunrise using the GR"A method. Shaos zmaniyos are calculated by dividing
the time between sunrise and sunset into 12 equal parts. This results in
Sof Zman Krias Shma according to the Vilna Gaon.

Explanation (Hebrew):
זמן זה מחושב על ידי הוספת 3 שעות זמניות לזמן הנץ החמה לפי שיטת הגר"א.
שעות זמניות מחושבות על ידי חלוקת הזמן בין הנץ לשקיעה ל-12 חלקים שווים.
התוצאה היא סוף זמן קריאת שמע לפי הגאון מווילנה.
```

**Dependencies:** 4.8 (AI formula service), 4.3 (bilingual)

---

### Phase 4: User Experience (Stories 4.10-4.13) - **Week 7-8**

#### Story 4.10: Weekly Preview (Hebrew Calendar)
**Status:** ready-for-dev
**Estimated Effort:** 5 days

**Acceptance Criteria:**
- hebcal-go integration for Hebrew dates
- 44 Jewish events tracked (Shabbos, Yom Tov, fasts, Rosh Chodesh)
- 7-day calendar view with bilingual dates
- All enabled zmanim calculated for each day
- Location-aware (uses publisher default)
- Responsive UI with day/week toggle

**API Endpoint:**
```typescript
GET /api/publishers/:id/preview/week?start=2025-11-28

Response:
{
  "days": [
    {
      "date": "2025-11-28",
      "hebrewDate": {
        "year": 5785,
        "month": "Kislev",
        "day": 15,
        "display": "15 Kislev 5785"
      },
      "events": [],
      "zmanim": {
        "sunrise": "07:12:00",
        "sof_zman_shma_gra": "09:37:00",
        // ... all enabled zmanim
      }
    },
    // ... 6 more days
  ]
}
```

**Dependencies:** 4.2 (DSL execution), 4.3 (bilingual), 4.4 (uses location)

---

#### Story 4.11: Publisher Onboarding Wizard
**Status:** ready-for-dev
**Estimated Effort:** 4 days

**Acceptance Criteria:**
- Multi-step wizard for first-time setup
- Template selection (System Default, OU, Chabad, etc.)
- Zman visibility toggles (show/hide per formula)
- Preview of selected templates
- One-click apply templates

**Wizard Steps:**
1. **Welcome** - Choose template source
2. **Select Templates** - Browse available formula sets
3. **Customize Visibility** - Toggle which zmanim to display
4. **Review** - Preview selected formulas
5. **Complete** - Copy formulas to publisher

**Copy Logic:**
```go
func (s *ZmanimService) CopyFromTemplate(ctx context.Context, req CopyTemplateRequest) error {
  // 1. Fetch template zmanim
  templates, err := s.getTemplateZmanim(ctx, req.TemplateID)

  // 2. Filter by visibility
  visible := filterVisible(templates, req.VisibleKeys)

  // 3. Copy to publisher (deep copy, not reference)
  for _, tmpl := range visible {
    _, err := s.db.Exec(ctx, `
      INSERT INTO publisher_zmanim
        (publisher_id, zman_key, formula_dsl, hebrew_name, english_name, is_visible)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, req.PublisherID, tmpl.ZmanKey, tmpl.FormulaDSL, tmpl.HebrewName, tmpl.EnglishName, true)
  }

  return nil
}
```

**Dependencies:** 4.3 (bilingual), 4.10 (preview)

---

#### Story 4.12: Algorithm Collaboration (Copy/Fork)
**Status:** ready-for-dev
**Estimated Effort:** 3 days

**Acceptance Criteria:**
- Browse other publishers' formulas (public only)
- Search by zman name (Hebrew + English)
- Preview formula + explanation
- One-click copy to own publisher
- Attribution tracking (optional)

**UI Flow:**
```
┌─────────────────────────────────────────────────────┐
│  📚 Browse Formulas from Other Publishers           │
├─────────────────────────────────────────────────────┤
│  Search: [alos hashachar____________________] 🔍    │
│                                                     │
│  Results (12):                                      │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ ⭐ Alos Hashachar (72 min) - OU               │ │
│  │ Publisher: Orthodox Union                     │ │
│  │ Formula: sunrise - 72min                      │ │
│  │ Used by: 127 publishers                       │ │
│  │                                               │ │
│  │ [👁️ Preview]  [📋 Copy to My Formulas]        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Alos Hashachar (16.1°) - Chabad              │ │
│  │ Publisher: Chabad.org                         │ │
│  │ Formula: solar(16.1, before_sunrise)          │ │
│  │ Used by: 89 publishers                        │ │
│  │                                               │ │
│  │ [👁️ Preview]  [📋 Copy to My Formulas]        │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Dependencies:** 4.4 (formula preview), 4.9 (explanations)

---

#### Story 4.13: Formula Version History
**Status:** ready-for-dev
**Estimated Effort:** 4 days

**Acceptance Criteria:**
- Track all formula changes (audit log)
- Visual diff between versions
- One-click rollback to previous version
- Change attribution (which user made the change)
- Timestamp for each version

**Database Schema:**
```sql
CREATE TABLE zmanim_history (
  id UUID PRIMARY KEY,
  publisher_zman_id UUID REFERENCES publisher_zmanim(id),
  formula_dsl TEXT NOT NULL,
  ai_explanation TEXT,
  publisher_comment TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_reason TEXT
);

-- Index for fast history lookup
CREATE INDEX idx_zmanim_history_lookup
  ON zmanim_history(publisher_zman_id, changed_at DESC);
```

**Diff UI:**
```
┌────────────────────────────────────────────────────────────┐
│  Version History: Sof Zman Shma - GR"A                    │
├────────────────────────────────────────────────────────────┤
│  📅 Nov 28, 2025 3:42 PM  •  Rabbi Cohen                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ - sunrise + shaos(3, gra)                            │ │
│  │ + if (latitude > 60) { civil_dawn } else {           │ │
│  │     sunrise + shaos(3, gra)                          │ │
│  │   }                                                  │ │
│  └──────────────────────────────────────────────────────┘ │
│  Reason: Added high-latitude fallback                    │
│  [🔄 Restore This Version]                                │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│  📅 Nov 15, 2025 10:22 AM  •  Rabbi Cohen                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │   sunrise + shaos(3, gra)                            │ │
│  └──────────────────────────────────────────────────────┘ │
│  Reason: Initial formula                                 │
│  [🔄 Restore This Version]                                │
└────────────────────────────────────────────────────────────┘
```

**Dependencies:** 4.4 (formula editor), 4.2 (DSL diff)

---

## Technical Stack

### Frontend (Web)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3+ | UI framework |
| **TypeScript** | 5.3+ | Type safety |
| **Vite** | 5.0+ | Build tool |
| **TanStack Query** | 5.0+ | Data fetching/caching |
| **shadcn/ui** | Latest | Component library |
| **Tailwind CSS** | 3.4+ | Styling |
| **CodeMirror 6** | 6.0+ | Code editor (Story 4.6) |
| **Lucide React** | Latest | Icons |
| **Recharts** | 2.10+ | Charts (for analytics) |

### Backend (API)

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Go** | 1.23+ | API server |
| **Fiber** | 3.0+ | HTTP framework |
| **sqlc** | 1.26+ | Type-safe SQL |
| **pgx** | 5.5+ | PostgreSQL driver |
| **hebcal-go** | Latest | Hebrew calendar (Story 4.10) |

### Database

| Technology | Version | Purpose |
|-----------|---------|---------|
| **PostgreSQL** | 17 | Primary database |
| **PostGIS** | 3.5+ | Geospatial queries |
| **pgvector** | 0.8.0 | Vector embeddings (Story 4.7) |

### AI & Embeddings

| Service | Model | Purpose |
|---------|-------|---------|
| **OpenAI** | text-embedding-3-small | Embeddings (1536-dim) |
| **Anthropic** | claude-3-5-sonnet | Formula generation, explanations |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| **Docker** | Local development |
| **Docker Compose** | Multi-container orchestration |
| **Coder** | Cloud development environment |
| **Redis** | Caching (hebcal results) |
| **Playwright** | E2E testing |

---

## Dependencies & Prerequisites

### Completed Prerequisites ✅

- ✅ **Story 4.0:** PostgreSQL 17 + PostGIS + pgvector Docker image
- ✅ **OpenAI API Key:** Configured in Coder workspace
- ✅ **Anthropic API Key:** Configured in Coder workspace
- ✅ **DSL Specification:** `docs/sprint-artifacts/epic-4-dsl-specification.md`
- ✅ **UI Wireframes:** `docs/sprint-artifacts/epic-4-ui-wireframes.md`
- ✅ **Comprehensive Plan:** This document

### External Dependencies

1. **hebcal-go Library**
   - Purpose: Hebrew calendar calculations
   - Installation: `go get github.com/hebcal/hebcal-go`
   - Used in: Story 4.10

2. **OpenAI API**
   - Purpose: Text embeddings for RAG
   - Rate limit: 1,000,000 tokens/min (tier 2)
   - Cost: $0.00002/1K tokens (~$0.03 per 1500 chunks)
   - Used in: Story 4.7

3. **Anthropic API (Claude)**
   - Purpose: Formula generation, explanations
   - Rate limit: 40,000 tokens/min (tier 1)
   - Cost: $3/MTok input, $15/MTok output
   - Used in: Stories 4.8, 4.9

4. **CodeMirror 6**
   - Purpose: Advanced code editor
   - Installation: `npm install @codemirror/view @codemirror/language`
   - Bundle size: ~100KB (much smaller than Monaco 2MB)
   - Used in: Story 4.6

### Internal Dependencies (Story Sequencing)

```
4.0 (done) ─┬─→ 4.1 (DSL Design) ─→ 4.2 (Parser) ─┬─→ 4.3 (Bilingual) ─→ 4.4 (Builder) ─┬─→ 4.5 (Docs)
            │                                      │                                     ├─→ 4.6 (Advanced Editor)
            │                                      │                                     └─→ 4.12 (Collaboration)
            │                                      │
            └─→ 4.7 (RAG) ─┬─→ 4.8 (AI Formula) ─→ 4.9 (AI Explanation) ────────────────┘
                           │
                           └─→ 4.10 (Weekly Preview) ─→ 4.11 (Onboarding)

4.4 + 4.2 ─→ 4.13 (Version History)
```

**Critical Path:** 4.1 → 4.2 → 4.3 → 4.4 → 4.6 (longest path: 19 days)

---

## Testing Strategy

### Unit Tests

**Target Coverage:** 90%+ for all new code

**Key Areas:**
1. **DSL Parser (Story 4.2)**
   - Lexer tokenization
   - Parser AST generation
   - Compiler output
   - Validation error messages
   - All DSL features (primitives, functions, operators, conditionals)

2. **RAG Service (Story 4.7)**
   - Embedding generation
   - Vector search
   - Context retrieval
   - Chunk ranking

3. **AI Services (Stories 4.8, 4.9)**
   - Formula generation
   - Explanation generation
   - Rate limiting
   - Error handling

**Test Framework:** Go testing package + testify

```go
func TestDSLParser(t *testing.T) {
  tests := []struct {
    name     string
    input    string
    expected *AST
    wantErr  bool
  }{
    {
      name:  "simple sunrise offset",
      input: "sunrise + 72min",
      expected: &AST{/* ... */},
      wantErr: false,
    },
    // ... 100+ test cases
  }

  for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
      parser := NewDSLParser()
      ast, err := parser.Parse(tt.input)
      if tt.wantErr {
        assert.Error(t, err)
      } else {
        assert.NoError(t, err)
        assert.Equal(t, tt.expected, ast)
      }
    })
  }
}
```

### Integration Tests

**Database Migrations:**
- Test all new migrations (zmanim_templates, publisher_zmanim, zmanim_knowledge, zmanim_history)
- Verify indexes created
- Test pgvector operations

**API Endpoints:**
- Test all new endpoints with real database
- Validate request/response schemas
- Test error cases (400, 401, 404, 500)

**AI Integration:**
- Mock OpenAI/Anthropic APIs in tests
- Test real APIs in staging only
- Validate rate limiting

### E2E Tests (Playwright)

**User Flows:**
1. **Onboarding Wizard (Story 4.11)**
   - New publisher selects template
   - Toggles visibility
   - Previews formulas
   - Completes setup

2. **Formula Editor (Story 4.4)**
   - Open edit modal
   - Modify formula
   - See live preview
   - Save changes

3. **AI Formula Generation (Story 4.8)**
   - Enter natural language prompt
   - Generate formula
   - Review explanation
   - Accept/reject

4. **Weekly Preview (Story 4.10)**
   - Navigate calendar
   - View Hebrew dates
   - Check zmanim calculations
   - Identify Jewish events

**E2E Test Command:**
```bash
npm run test:e2e -- --grep "Epic 4"
```

### DoD Testing Requirements

**Per Story:**
- ✅ Unit tests pass (90%+ coverage)
- ✅ Integration tests pass
- ✅ New E2E scenarios pass (story-specific only)
- ✅ Manual verification of AC completion

**Epic Completion:**
- ✅ **Full E2E regression suite** (all 130+ existing tests)
- ✅ Performance benchmarks met
- ✅ Security audit passed
- ✅ Cross-browser testing (Chrome, Firefox, Safari)

---

## Migration Path

### Migrating from Epic 1 JSON to DSL

Epic 1 stored zmanim formulas as **JSON configurations**. Epic 4 replaces this with the **DSL syntax**.

#### Epic 1 JSON Format (Old)

```json
{
  "zman_key": "sof_zman_shma_gra",
  "config": {
    "base": "sunrise",
    "offset": {
      "type": "shaos_zmaniyos",
      "count": 3,
      "method": "gra"
    }
  }
}
```

#### Epic 4 DSL Format (New)

```
sunrise + shaos(3, gra)
```

### Migration Script

```go
// api/cmd/migrate-dsl/main.go
package main

func migrateLegacyFormulas(ctx context.Context, db *pgxpool.Pool) error {
  // 1. Fetch all publisher_zmanim with JSON config
  rows, err := db.Query(ctx, `
    SELECT id, publisher_id, zman_key, config_json
    FROM publisher_zmanim
    WHERE formula_dsl IS NULL
  `)

  // 2. Convert each JSON config to DSL
  for rows.Next() {
    var id, publisherID, zmanKey string
    var configJSON string
    rows.Scan(&id, &publisherID, &zmanKey, &configJSON)

    dslFormula := convertJSONToDSL(configJSON)

    // 3. Update with DSL formula
    _, err := db.Exec(ctx, `
      UPDATE publisher_zmanim
      SET formula_dsl = $1,
          migrated_at = NOW()
      WHERE id = $2
    `, dslFormula, id)
  }

  return nil
}

func convertJSONToDSL(configJSON string) string {
  var config LegacyConfig
  json.Unmarshal([]byte(configJSON), &config)

  switch config.Offset.Type {
  case "shaos_zmaniyos":
    return fmt.Sprintf("%s + shaos(%d, %s)",
      config.Base, config.Offset.Count, config.Offset.Method)
  case "minutes":
    return fmt.Sprintf("%s + %dmin", config.Base, config.Offset.Minutes)
  case "degrees":
    return fmt.Sprintf("solar(%s, %s)",
      config.Offset.Degrees, config.Offset.Direction)
  // ... more cases
  }
}
```

### Migration Rollout

1. **Story 4.2 completion:** DSL parser ready
2. **Story 4.4 completion:** UI supports both JSON + DSL (read JSON, write DSL)
3. **Story 4.13 completion:** Version history tracks migration
4. **Post-Epic 4:** Run migration script on all publishers
5. **Verification:** Manual review of migrated formulas
6. **Deprecation:** Remove JSON config support in Epic 5

---

## Performance Targets

### API Response Times

| Endpoint | Target | Notes |
|----------|--------|-------|
| `GET /api/publishers/:id/zmanim` | <100ms | Cached in Redis |
| `POST /api/publishers/:id/zmanim` | <200ms | DSL validation + save |
| `POST /api/publishers/:id/zmanim/calculate` | <50ms | Single zman calculation |
| `POST /api/publishers/:id/zmanim/generate` (AI) | <3s | Claude API call + RAG |
| `GET /api/publishers/:id/preview/week` | <500ms | Pre-calculate 7 days |

### Database Performance

| Operation | Target | Optimization |
|-----------|--------|--------------|
| Vector search (RAG) | <50ms | HNSW index on `zmanim_knowledge.embedding` |
| Zman lookup | <10ms | Index on `(publisher_id, zman_key)` |
| Formula history | <20ms | Index on `(publisher_zman_id, changed_at DESC)` |

### Frontend Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Edit modal open | <200ms | Lazy load CodeMirror |
| Live preview update | <300ms | 300ms debounce on formula changes |
| Weekly preview render | <500ms | Virtualized list for large calendars |
| Bundle size increase | <150KB | CodeMirror 6 (~100KB) + DSL mode (~20KB) |

### AI Performance

| Operation | Target | Cost |
|-----------|--------|------|
| Embedding generation (OpenAI) | <100ms | $0.00002/1K tokens |
| RAG vector search | <50ms | Free (local pgvector) |
| Formula generation (Claude) | <2s | $0.003 per request (avg) |
| Explanation generation (Claude) | <1.5s | $0.002 per request (avg) |

**Rate Limits:**
- OpenAI: 1,000,000 tokens/min (tier 2) - ~5,000 embeddings/min
- Anthropic: 40,000 tokens/min (tier 1) - ~20 formula generations/min

---

## Security Considerations

### API Authentication

All Epic 4 endpoints require **authenticated publisher users**:

```typescript
// Middleware
app.use('/api/publishers/:id/zmanim/*', requirePublisherAuth);

function requirePublisherAuth(req, res, next) {
  // 1. Verify Clerk JWT
  const user = await clerkClient.verifyToken(req.headers.authorization);

  // 2. Check publisher membership
  const membership = await db.query(`
    SELECT role FROM publisher_users
    WHERE user_id = $1 AND publisher_id = $2
  `, user.id, req.params.id);

  if (!membership) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  req.user = user;
  req.publisherRole = membership.role;
  next();
}
```

### DSL Security

**Injection Prevention:**
- DSL parser runs in **sandboxed environment** (no eval, no code execution)
- Only mathematical operations allowed (no system calls)
- Formula length limit: 1000 characters
- Recursion depth limit: 10 levels

**Validation:**
```go
func (v *DSLValidator) Validate(formula string) error {
  if len(formula) > 1000 {
    return errors.New("formula too long")
  }

  ast, err := v.parser.Parse(formula)
  if err != nil {
    return err
  }

  // Check recursion depth
  if ast.MaxDepth() > 10 {
    return errors.New("formula too complex (max depth: 10)")
  }

  return nil
}
```

### AI Security

**Rate Limiting:**
```sql
-- Per publisher monthly limit
SELECT SUM(tokens_used) as total
FROM ai_usage
WHERE publisher_id = $1
  AND created_at > NOW() - INTERVAL '30 days';

-- Default limit: 100,000 tokens/month (~$3 cost)
-- Premium publishers: 1,000,000 tokens/month
```

**Prompt Injection Prevention:**
- User prompts sanitized before Claude API call
- System prompts separate from user input
- No reflection of raw user input in responses

**API Key Security:**
- OpenAI + Anthropic keys stored as **Coder workspace parameters** (sensitive=true)
- Never exposed to frontend
- Rotated quarterly

### Data Privacy

**Public vs Private Formulas:**
- Publishers choose visibility (public/private per formula)
- Private formulas not searchable by other publishers
- Attribution optional (publisher can disable)

```sql
ALTER TABLE publisher_zmanim
  ADD COLUMN is_public BOOLEAN DEFAULT false,
  ADD COLUMN allow_attribution BOOLEAN DEFAULT true;

-- Only public formulas shown in collaboration
CREATE INDEX idx_publisher_zmanim_public
  ON publisher_zmanim(is_public)
  WHERE is_public = true;
```

---

## Rollout Plan

### Sprint Timeline (8 weeks)

| Week | Stories | Focus |
|------|---------|-------|
| **1-2** | 4.1, 4.2, 4.3 | Foundation (DSL + Parser) |
| **3-4** | 4.4, 4.5, 4.6 | Editor UX |
| **5-6** | 4.7, 4.8, 4.9 | AI Features |
| **7-8** | 4.10, 4.11, 4.12, 4.13 | User Experience + Polish |

### Release Strategy

#### Alpha (Week 4)
- **Audience:** Internal team only
- **Features:** DSL parser + basic editor (Stories 4.1-4.4)
- **Goal:** Validate DSL syntax with real formulas

#### Beta (Week 6)
- **Audience:** 3-5 trusted publishers
- **Features:** AI features enabled (Stories 4.7-4.9)
- **Goal:** Test AI formula generation, gather feedback

#### General Availability (Week 8)
- **Audience:** All publishers
- **Features:** Full Epic 4 feature set
- **Migration:** Auto-convert Epic 1 JSON → DSL
- **Announcement:** Blog post + email to publishers

### Post-Launch

**Week 9-10:**
- Monitor AI usage and costs
- Gather user feedback
- Fix bugs and polish UX

**Week 11:**
- Epic 4 retrospective
- Plan Epic 5 (if needed)

---

## Success Metrics

### User Adoption

- **70%+ publishers** use new editor within 30 days
- **50%+ publishers** try AI formula generation
- **30%+ publishers** copy formulas from collaboration

### Performance

- **95%+ uptime** for API endpoints
- **<3s response time** for AI features
- **Zero data loss** in formula migrations

### User Satisfaction

- **NPS >40** (Net Promoter Score)
- **<5% support tickets** related to Epic 4 features
- **Positive feedback** from beta testers

### Technical

- **90%+ test coverage** maintained
- **Zero P0/P1 bugs** in production
- **<$500/month** AI costs (monitoring usage)

---

## Appendices

### A. Referenced Documents

1. **DSL Specification:** `docs/sprint-artifacts/epic-4-dsl-specification.md`
2. **UI Wireframes:** `docs/sprint-artifacts/epic-4-ui-wireframes.md`
3. **Tech Spec:** `docs/sprint-artifacts/tech-spec-epic-4.md`
4. **Epic Definition:** `docs/epic-4-algorithm-editor-ux.md`
5. **Sprint Status:** `docs/sprint-artifacts/sprint-status.yaml`

### B. External Resources

1. **hebcal-go:** https://github.com/hebcal/hebcal-go
2. **KosherJava:** https://github.com/KosherJava/zmanim
3. **OpenAI Embeddings:** https://platform.openai.com/docs/guides/embeddings
4. **Anthropic Claude:** https://docs.anthropic.com/claude/reference/getting-started
5. **pgvector:** https://github.com/pgvector/pgvector
6. **CodeMirror 6:** https://codemirror.net/

### C. Glossary

- **DSL:** Domain-Specific Language
- **RAG:** Retrieval-Augmented Generation
- **AST:** Abstract Syntax Tree
- **Shaos Zmaniyos:** Proportional hours (halachic time calculation)
- **GRA:** Vilna Gaon (Rabbi Eliyahu of Vilna)
- **MGA:** Magen Avraham (Rabbi Avraham Gombiner)
- **Alos Hashachar:** Dawn (first light)
- **Tzeis Hakochavim:** Nightfall (stars visible)
- **Sof Zman Shma:** Latest time for morning Shema
- **Plag HaMincha:** 1.25 proportional hours before sunset

---

**Document Version:** 1.0
**Last Updated:** 2025-11-28
**Next Review:** Post-Epic 4 completion (Week 9)