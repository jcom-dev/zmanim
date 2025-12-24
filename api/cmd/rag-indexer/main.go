// RAG Indexer - Indexes documentation for AI-powered formula generation
//
// This tool reads documentation files, chunks them, generates embeddings,
// and stores them in the PostgreSQL database for semantic search.
//
// Usage:
//
//	cd api && go run cmd/rag-indexer/main.go
//
// Environment variables:
//
//	DATABASE_URL - PostgreSQL connection string
//	OPENAI_API_KEY - OpenAI API key for embeddings
//
// When to run:
//
//	After initial deployment to seed the knowledge base
//	After significant documentation updates
//	Can be added to CI/CD pipeline after migrations
//
// CI/CD Integration:
//
//	Add this step after database migrations:
//	  go run cmd/rag-indexer/main.go
//
// Current indexed sources:
//
//	docs/ folder markdown files (DSL guide, architecture, API reference, etc.)
//	DSL code from api/internal/dsl/*.go and web/lib/*dsl*.ts
//	Master zmanim registry from database
//	Inline DSL examples with halachic context
//	KosherJava zmanim library (all Java source files)
package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim/internal/ai"
	pgvector "github.com/pgvector/pgvector-go"
)

// DocumentSource defines a source document to index
type DocumentSource struct {
	Path        string
	Source      string // e.g., "dsl-spec", "halacha", "examples"
	ContentType string // e.g., "documentation", "example", "reference"
}

func main() {
	ctx := context.Background()

	// Get environment variables
	databaseURL := os.Getenv("DATABASE_URL")
	openAIKey := os.Getenv("OPENAI_API_KEY")

	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}
	if openAIKey == "" {
		log.Fatal("OPENAI_API_KEY environment variable is required")
	}

	// Connect to database
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Initialize services
	embeddings := ai.NewEmbeddingService(openAIKey)
	chunker := ai.NewChunker()

	// Find all markdown documents to index
	projectRoot := findProjectRoot()

	log.Println("📚 Starting RAG indexer...")
	log.Printf("   Project root: %s", projectRoot)

	sources, err := findDocuments(projectRoot)
	if err != nil {
		log.Fatalf("Failed to find documents: %v", err)
	}
	log.Printf("   Found %d markdown documents to index", len(sources))

	// Clear existing embeddings (optional - for reindexing)
	log.Println("🗑️  Clearing existing embeddings...")
	_, err = pool.Exec(ctx, "TRUNCATE embeddings RESTART IDENTITY")
	if err != nil {
		log.Printf("Warning: Could not clear embeddings: %v", err)
	}

	totalChunks := 0
	totalTokens := 0

	// Index documents
	for _, source := range sources {
		chunks, tokens, err := indexDocument(ctx, pool, embeddings, chunker, source)
		if err != nil {
			log.Printf("❌ Failed to index %s: %v", source.Path, err)
			continue
		}
		totalChunks += chunks
		totalTokens += tokens
		log.Printf("✅ Indexed %s: %d chunks, ~%d tokens", filepath.Base(source.Path), chunks, tokens)
	}

	// Index master zmanim registry from database
	zmanimChunks, zmanimTokens, err := indexMasterZmanim(ctx, pool, embeddings, chunker)
	if err != nil {
		log.Printf("❌ Failed to index master zmanim: %v", err)
	} else {
		totalChunks += zmanimChunks
		totalTokens += zmanimTokens
		log.Printf("✅ Indexed master zmanim registry: %d chunks, ~%d tokens", zmanimChunks, zmanimTokens)
	}

	// Generate DSL examples
	examplesChunks, examplesTokens, err := indexDSLExamples(ctx, pool, embeddings, chunker)
	if err != nil {
		log.Printf("❌ Failed to index DSL examples: %v", err)
	} else {
		totalChunks += examplesChunks
		totalTokens += examplesTokens
		log.Printf("✅ Indexed DSL examples: %d chunks, ~%d tokens", examplesChunks, examplesTokens)
	}

	// Index DSL-related code from api/internal/dsl/*.go and web/lib/*dsl*.ts
	dslChunks, dslTokens, err := indexDSLCode(ctx, pool, embeddings, chunker, projectRoot)
	if err != nil {
		log.Printf("❌ Failed to index DSL code: %v", err)
	} else {
		totalChunks += dslChunks
		totalTokens += dslTokens
		log.Printf("✅ Indexed DSL code: %d chunks, ~%d tokens", dslChunks, dslTokens)
	}

	// Clone and index external repositories
	tempDir := filepath.Join("/tmp", "rag-indexer-"+uuid.New().String())
	log.Printf("📦 Cloning external repositories to %s...", tempDir)

	// Index KosherJava zmanim library (all Java source files)
	kosherJavaChunks, kosherJavaTokens, err := indexKosherJava(ctx, pool, embeddings, chunker, tempDir)
	if err != nil {
		log.Printf("❌ Failed to index KosherJava: %v", err)
	} else {
		totalChunks += kosherJavaChunks
		totalTokens += kosherJavaTokens
		log.Printf("✅ Indexed KosherJava: %d chunks, ~%d tokens", kosherJavaChunks, kosherJavaTokens)
	}

	// Cleanup temp directory
	log.Println("🧹 Cleaning up temporary files...")
	os.RemoveAll(tempDir)

	log.Println("")
	log.Printf("📊 Indexing complete!")
	log.Printf("   Total chunks: %d", totalChunks)
	log.Printf("   Total tokens: ~%d", totalTokens)
}

func findProjectRoot() string {
	// Start from current directory and look for go.mod
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			// Found go.mod, go up one level to project root
			return filepath.Dir(dir)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root, use current directory
			return "."
		}
		dir = parent
	}
}

// findDocuments scans the docs/ directory for all markdown files to index
// Only indexes docs/ folder (not docs-archive/)
func findDocuments(projectRoot string) ([]DocumentSource, error) {
	var sources []DocumentSource
	docsDir := filepath.Join(projectRoot, "docs")

	err := filepath.Walk(docsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Only process markdown files
		if !strings.HasSuffix(path, ".md") {
			return nil
		}

		// Skip index files (usually just lists)
		if info.Name() == "index.md" || info.Name() == "INDEX.md" {
			return nil
		}

		// Create source key from relative path (max 50 chars for db constraint)
		relPath, _ := filepath.Rel(docsDir, path)
		sourceKey := makeSourceKey("doc", relPath)

		// Determine content type based on path
		contentType := "documentation"
		if strings.Contains(path, "api") || strings.Contains(path, "API") {
			contentType = "api-reference"
		} else if strings.Contains(path, "dsl") || strings.Contains(path, "DSL") {
			contentType = "dsl-documentation"
		}

		sources = append(sources, DocumentSource{
			Path:        path,
			Source:      sourceKey,
			ContentType: contentType,
		})

		return nil
	})

	return sources, err
}

// makeSourceKey creates a unique source key that fits within 50 chars
// Format: prefix:hash (e.g., "doc:abc123" or "kj:ZmanimCalendar")
func makeSourceKey(prefix, path string) string {
	// Clean up the path
	name := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))

	// If short enough, use prefix:name directly
	key := fmt.Sprintf("%s:%s", prefix, name)
	if len(key) <= 50 {
		return key
	}

	// Otherwise, use hash of full path for uniqueness
	h := sha256.Sum256([]byte(path))
	hash := fmt.Sprintf("%x", h[:8]) // 16 hex chars
	// Truncate name to fit: 50 - len(prefix) - 1 (colon) - 17 (underscore + hash)
	maxNameLen := 50 - len(prefix) - 18
	if maxNameLen < 0 {
		maxNameLen = 0
	}
	if len(name) > maxNameLen {
		name = name[:maxNameLen]
	}
	return fmt.Sprintf("%s:%s_%s", prefix, name, hash)
}

// getOrCreateSourceID gets or creates a source in ai_content_sources and returns its ID.
// It also deletes any existing embeddings for this source to allow re-indexing.
func getOrCreateSourceID(ctx context.Context, pool *pgxpool.Pool, sourceKey, displayName string) (int16, error) {
	var sourceID int16
	err := pool.QueryRow(ctx, `
		INSERT INTO ai_content_sources (key, display_name_hebrew, display_name_english, description)
		VALUES ($1, $2, $2, $3)
		ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
		RETURNING id
	`, sourceKey, displayName, "Indexed by RAG indexer").Scan(&sourceID)
	if err != nil {
		return 0, err
	}

	// Delete existing embeddings for this source to allow re-indexing
	_, err = pool.Exec(ctx, "DELETE FROM embeddings WHERE source_id = $1", sourceID)
	if err != nil {
		return 0, fmt.Errorf("failed to clear existing embeddings: %w", err)
	}

	return sourceID, nil
}

func indexDocument(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker, source DocumentSource) (int, int, error) {
	// Read file
	content, err := os.ReadFile(source.Path)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read file: %w", err)
	}

	// Get or create source ID
	sourceID, err := getOrCreateSourceID(ctx, pool, source.Source, source.Source)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get/create source: %w", err)
	}

	// Chunk document
	chunks := chunker.ChunkDocument(string(content), source.Source, source.ContentType)
	if len(chunks) == 0 {
		return 0, 0, nil
	}

	totalTokens := 0

	// Process chunks in batches
	batchSize := 10
	for i := 0; i < len(chunks); i += batchSize {
		end := i + batchSize
		if end > len(chunks) {
			end = len(chunks)
		}
		batch := chunks[i:end]

		// Extract content for embedding - filter out empty strings
		var texts []string
		var validChunks []ai.Chunk
		for _, chunk := range batch {
			trimmed := strings.TrimSpace(chunk.Content)
			if trimmed != "" {
				texts = append(texts, trimmed)
				validChunks = append(validChunks, chunk)
				totalTokens += chunk.TokenCount
			}
		}

		if len(texts) == 0 {
			continue
		}

		// Generate embeddings
		embeds, err := embeddings.GenerateEmbeddings(ctx, texts)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to generate embeddings: %w", err)
		}

		// Insert into database
		for j, chunk := range validChunks {
			vec := pgvector.NewVector(embeds[j])
			_, err := pool.Exec(ctx, `
				INSERT INTO embeddings (content, source_id, content_type, chunk_index, metadata, embedding)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, chunk.Content, sourceID, source.ContentType, chunk.Index, chunk.Metadata, vec)
			if err != nil {
				return 0, 0, fmt.Errorf("failed to insert embedding: %w", err)
			}
		}

		// Rate limit to avoid OpenAI API limits
		time.Sleep(100 * time.Millisecond)
	}

	return len(chunks), totalTokens, nil
}

func indexMasterZmanim(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker) (int, int, error) {
	// Query master zmanim registry with time_category join
	rows, err := pool.Query(ctx, `
		SELECT m.zman_key, m.canonical_hebrew_name, m.canonical_english_name,
		       COALESCE(tc.display_name_english, 'Unknown') as time_category,
		       m.description, m.default_formula_dsl
		FROM master_zmanim_registry m
		LEFT JOIN time_categories tc ON m.time_category_id = tc.id
		ORDER BY m.zman_key
	`)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to query master zmanim: %w", err)
	}
	defer rows.Close()

	var content strings.Builder
	content.WriteString("# Master Zmanim Registry\n\n")
	content.WriteString("This is the complete list of zmanim with their formulas.\n\n")

	for rows.Next() {
		var zmanKey, canonicalHebrew, canonicalEnglish, timeCategory string
		var description, defaultFormula *string

		if err := rows.Scan(&zmanKey, &canonicalHebrew, &canonicalEnglish, &timeCategory, &description, &defaultFormula); err != nil {
			continue
		}

		content.WriteString(fmt.Sprintf("## %s (%s)\n", canonicalEnglish, canonicalHebrew))
		content.WriteString(fmt.Sprintf("- **Key:** `%s`\n", zmanKey))
		content.WriteString(fmt.Sprintf("- **Time Category:** %s\n", timeCategory))
		if description != nil && *description != "" {
			content.WriteString(fmt.Sprintf("- **Description:** %s\n", *description))
		}
		if defaultFormula != nil && *defaultFormula != "" {
			content.WriteString(fmt.Sprintf("- **Default Formula:** `%s`\n", *defaultFormula))
		}
		content.WriteString("\n")
	}

	// Get or create source ID
	sourceID, err := getOrCreateSourceID(ctx, pool, "master-registry", "Master Zmanim Registry")
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get/create source: %w", err)
	}

	// Chunk and index
	chunks := chunker.ChunkDocument(content.String(), "master-registry", "reference")

	totalTokens := 0
	for _, chunk := range chunks {
		totalTokens += chunk.TokenCount

		// Generate embedding
		embed, err := embeddings.GenerateEmbedding(ctx, chunk.Content)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to generate embedding: %w", err)
		}

		vec := pgvector.NewVector(embed)
		_, err = pool.Exec(ctx, `
			INSERT INTO embeddings (content, source_id, content_type, chunk_index, metadata, embedding)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, chunk.Content, sourceID, "reference", chunk.Index, chunk.Metadata, vec)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to insert embedding: %w", err)
		}

		time.Sleep(100 * time.Millisecond)
	}

	return len(chunks), totalTokens, nil
}

func indexDSLExamples(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker) (int, int, error) {
	// Create example content
	examples := `# DSL Formula Examples

## Time Offset Examples

### Fixed Minutes Before Sunrise
Request: "72 minutes before sunrise"
Formula: sunrise - 72min
Explanation: Alos HaShachar according to many Ashkenazi opinions

### Fixed Minutes After Sunset
Request: "42 minutes after sunset"
Formula: sunset + 42min
Explanation: Tzais according to Rabbeinu Tam

### Hours Before Sunrise
Request: "2 hours before sunrise"
Formula: sunrise - 2hr
Explanation: Some opinions for Misheyakir

## Solar Angle Examples

### Degrees Before Sunrise
Request: "When sun is 16.1 degrees below horizon before sunrise"
Formula: solar(16.1, before_sunrise)
Explanation: Alos according to the degree-based calculation

### Degrees After Sunset
Request: "When sun is 8.5 degrees below horizon after sunset"
Formula: solar(8.5, after_sunset)
Explanation: Tzais HaKochavim - 3 small stars visible

### Standard Twilight Angles
Request: "Tzais when 3 medium stars visible"
Formula: solar(7.083, after_sunset)
Explanation: Based on Dr. Baruch Cohn's calculations

## Proportional Hours (Shaos Zmaniyos) Examples

### GRA Method
Request: "End of Shema according to GRA"
Formula: proportional_hours(3, gra)
Explanation: 3 proportional hours into the day using GRA (sunrise to sunset)

### MGA Method
Request: "End of Shema according to Magen Avraham"
Formula: proportional_hours(3, mga)
Explanation: 3 proportional hours using MGA (72 minutes before sunrise to 72 after sunset)

### Chatzos
Request: "Midday"
Formula: proportional_hours(6, gra)
Explanation: Exactly half of the day

### Mincha Gedola
Request: "Earliest time for Mincha"
Formula: proportional_hours(6.5, gra)
Explanation: Half an hour after midday

### Mincha Ketana
Request: "Mincha Ketana"
Formula: proportional_hours(9.5, gra)
Explanation: 2.5 hours before sunset

### Plag HaMincha
Request: "Plag HaMincha"
Formula: proportional_hours(10.75, gra)
Explanation: 1.25 hours before sunset

## Midpoint Examples

### Between Two Times
Request: "Midpoint between sunrise and sunset"
Formula: midpoint(sunrise, sunset)
Explanation: Solar noon approximation

### Complex Midpoint
Request: "Middle of the period between alos and sunrise"
Formula: midpoint(sunrise - 72min, sunrise)
Explanation: 36 minutes before sunrise

## Reference Examples

### Using Another Zman
Request: "15 minutes before candle lighting"
Formula: @candle_lighting - 15min
Explanation: References the candle_lighting zman

## Combined Examples

### Complex Calculation
Request: "Misheyakir - when you can distinguish between blue and white"
Formula: solar(11.5, before_sunrise)
Explanation: 52 minutes before sunrise in Jerusalem at equinox

### Rabbeinu Tam Tzais
Request: "Nightfall according to Rabbeinu Tam"
Formula: sunset + 72min
Explanation: 72 fixed minutes after sunset

### 90 Minute Alos
Request: "Dawn according to stricter opinion"
Formula: sunrise - 90min
Explanation: Some opinions use 90 minutes

## Halachic Context

### Shabbos Candle Lighting
Most communities light 18 minutes before sunset:
Formula: sunset - 18min

Jerusalem custom is 40 minutes before:
Formula: sunset - 40min

### Havdalah
Standard is 42 minutes after sunset:
Formula: sunset + 42min

More stringent opinions wait 72 minutes:
Formula: sunset + 72min

### Fast Days
Minor fasts begin at alos (dawn):
Formula: sunrise - 72min

Major fasts (Yom Kippur, Tisha B'Av) begin at sunset the night before.
`

	// Get or create source ID
	sourceID, err := getOrCreateSourceID(ctx, pool, "dsl-examples", "DSL Examples")
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get/create source: %w", err)
	}

	// Chunk and index
	chunks := chunker.ChunkDocument(examples, "dsl-examples", "example")

	totalTokens := 0
	indexedCount := 0
	for _, chunk := range chunks {
		// Skip empty chunks
		trimmed := strings.TrimSpace(chunk.Content)
		if trimmed == "" {
			continue
		}

		totalTokens += chunk.TokenCount

		// Generate embedding
		embed, err := embeddings.GenerateEmbedding(ctx, trimmed)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to generate embedding: %w", err)
		}

		vec := pgvector.NewVector(embed)
		_, err = pool.Exec(ctx, `
			INSERT INTO embeddings (content, source_id, content_type, chunk_index, metadata, embedding)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, chunk.Content, sourceID, "example", chunk.Index, chunk.Metadata, vec)
		if err != nil {
			return 0, 0, fmt.Errorf("failed to insert embedding: %w", err)
		}

		indexedCount++
		time.Sleep(100 * time.Millisecond)
	}

	return indexedCount, totalTokens, nil
}

// indexDSLCode indexes DSL-related source code from api/internal/dsl/*.go and web/lib/*dsl*.ts
func indexDSLCode(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker, projectRoot string) (int, int, error) {
	totalChunks := 0
	totalTokens := 0

	// Index Go DSL files from api/internal/dsl/
	dslGoDir := filepath.Join(projectRoot, "api", "internal", "dsl")
	goFiles, err := filepath.Glob(filepath.Join(dslGoDir, "*.go"))
	if err != nil {
		log.Printf("   Warning: Failed to find Go DSL files: %v", err)
	}

	log.Printf("   Found %d Go DSL files to index", len(goFiles))

	for _, goFile := range goFiles {
		baseName := filepath.Base(goFile)
		// Skip test files
		if strings.HasSuffix(baseName, "_test.go") {
			continue
		}

		content, err := os.ReadFile(goFile)
		if err != nil {
			log.Printf("   Warning: Failed to read %s: %v", baseName, err)
			continue
		}

		sourceKey := makeSourceKey("dsl-go", baseName)
		extracted := formatGoCodeForIndex(string(content), baseName)
		if extracted == "" {
			continue
		}

		chunks, tokens, err := indexContent(ctx, pool, embeddings, chunker, extracted, sourceKey, "dsl-code")
		if err != nil {
			log.Printf("   Warning: Failed to index %s: %v", baseName, err)
		} else if chunks > 0 {
			totalChunks += chunks
			totalTokens += tokens
			log.Printf("   Indexed %s: %d chunks", baseName, chunks)
		}
	}

	// Index TypeScript DSL files from web/lib/
	webLibDir := filepath.Join(projectRoot, "web", "lib")
	tsPatterns := []string{
		filepath.Join(webLibDir, "*dsl*.ts"),
		filepath.Join(webLibDir, "codemirror", "*dsl*.ts"),
	}

	for _, pattern := range tsPatterns {
		tsFiles, err := filepath.Glob(pattern)
		if err != nil {
			log.Printf("   Warning: Failed to find TS files with pattern %s: %v", pattern, err)
			continue
		}

		log.Printf("   Found %d TypeScript DSL files matching %s", len(tsFiles), filepath.Base(pattern))

		for _, tsFile := range tsFiles {
			baseName := filepath.Base(tsFile)
			content, err := os.ReadFile(tsFile)
			if err != nil {
				log.Printf("   Warning: Failed to read %s: %v", baseName, err)
				continue
			}

			sourceKey := makeSourceKey("dsl-ts", baseName)
			extracted := formatTSCodeForIndex(string(content), baseName)
			if extracted == "" {
				continue
			}

			chunks, tokens, err := indexContent(ctx, pool, embeddings, chunker, extracted, sourceKey, "dsl-code")
			if err != nil {
				log.Printf("   Warning: Failed to index %s: %v", baseName, err)
			} else if chunks > 0 {
				totalChunks += chunks
				totalTokens += tokens
				log.Printf("   Indexed %s: %d chunks", baseName, chunks)
			}
		}
	}

	return totalChunks, totalTokens, nil
}

// formatGoCodeForIndex formats Go source code for RAG indexing
func formatGoCodeForIndex(content, filename string) string {
	var result strings.Builder

	result.WriteString(fmt.Sprintf("# DSL Go Source: %s\n\n", strings.TrimSuffix(filename, ".go")))

	// Extract package documentation
	packageDocPattern := regexp.MustCompile(`(?s)^((?:\s*//[^\n]*\n)+)\s*package\s+(\w+)`)
	if match := packageDocPattern.FindStringSubmatch(content); len(match) >= 3 {
		doc := strings.TrimSpace(match[1])
		doc = regexp.MustCompile(`(?m)^//\s?`).ReplaceAllString(doc, "")
		if doc != "" {
			result.WriteString("## Package Documentation\n\n")
			result.WriteString(doc)
			result.WriteString("\n\n")
		}
	}

	// Extract constants
	constBlockPattern := regexp.MustCompile(`(?s)const\s*\(([^)]+)\)`)
	constMatches := constBlockPattern.FindAllStringSubmatch(content, -1)
	if len(constMatches) > 0 {
		result.WriteString("## Constants\n\n```go\n")
		for _, m := range constMatches {
			if len(m) >= 2 {
				result.WriteString("const (\n")
				result.WriteString(m[1])
				result.WriteString(")\n\n")
			}
		}
		result.WriteString("```\n\n")
	}

	// Extract single const declarations
	singleConstPattern := regexp.MustCompile(`(?m)^const\s+(\w+)\s*=\s*(.+)$`)
	singleConstMatches := singleConstPattern.FindAllStringSubmatch(content, -1)
	if len(singleConstMatches) > 0 {
		result.WriteString("## Single Constants\n\n")
		for _, m := range singleConstMatches {
			if len(m) >= 3 {
				result.WriteString(fmt.Sprintf("- `%s = %s`\n", m[1], m[2]))
			}
		}
		result.WriteString("\n")
	}

	// Extract var declarations with maps/slices (often contain DSL definitions)
	varBlockPattern := regexp.MustCompile(`(?s)((?://[^\n]*\n)*)var\s+(\w+)\s*=\s*(map\[[^\]]+\][^\{]+\{[^}]+\}|(?:\[\][^\{]+\{[^}]+\}))`)
	varMatches := varBlockPattern.FindAllStringSubmatch(content, -1)
	if len(varMatches) > 0 {
		result.WriteString("## Variable Definitions\n\n")
		for _, m := range varMatches {
			if len(m) >= 4 {
				doc := ""
				if m[1] != "" {
					doc = strings.TrimSpace(m[1])
					doc = regexp.MustCompile(`(?m)^//\s?`).ReplaceAllString(doc, "")
				}
				result.WriteString(fmt.Sprintf("### %s\n\n", m[2]))
				if doc != "" {
					result.WriteString(doc)
					result.WriteString("\n\n")
				}
				result.WriteString("```go\n")
				result.WriteString(fmt.Sprintf("var %s = %s", m[2], m[3]))
				result.WriteString("\n```\n\n")
			}
		}
	}

	// Extract type definitions with their docs
	typeDocPattern := regexp.MustCompile(`(?m)((?://[^\n]*\n)+)\s*(type\s+\w+\s+(?:struct|interface|int|string|float64)[^\{]*(?:\{[^}]*\})?)`)
	typeMatches := typeDocPattern.FindAllStringSubmatch(content, -1)
	if len(typeMatches) > 0 {
		result.WriteString("## Types\n\n")
		for _, match := range typeMatches {
			if len(match) >= 3 {
				doc := strings.TrimSpace(match[1])
				doc = regexp.MustCompile(`(?m)^//\s?`).ReplaceAllString(doc, "")
				typeDef := strings.TrimSpace(match[2])

				result.WriteString("### ")
				result.WriteString(extractGoTypeName(typeDef))
				result.WriteString("\n\n")
				result.WriteString("```go\n")
				result.WriteString(typeDef)
				result.WriteString("\n```\n\n")
				result.WriteString(doc)
				result.WriteString("\n\n---\n\n")
			}
		}
	}

	// Extract function/method documentation
	funcDocPattern := regexp.MustCompile(`(?m)((?://[^\n]*\n)+)\s*(func\s+(?:\([^)]+\)\s*)?\w+[^\{]+)`)
	funcMatches := funcDocPattern.FindAllStringSubmatch(content, -1)

	if len(funcMatches) > 0 {
		result.WriteString("## Functions\n\n")
		for _, match := range funcMatches {
			if len(match) >= 3 {
				doc := strings.TrimSpace(match[1])
				doc = regexp.MustCompile(`(?m)^//\s?`).ReplaceAllString(doc, "")
				signature := strings.TrimSpace(match[2])

				// Skip short/trivial docs
				if len(doc) < 10 {
					continue
				}

				result.WriteString("### ")
				result.WriteString(extractGoFuncName(signature))
				result.WriteString("\n\n")
				result.WriteString("```go\n")
				result.WriteString(signature)
				result.WriteString("\n```\n\n")
				result.WriteString(doc)
				result.WriteString("\n\n---\n\n")
			}
		}
	}

	return result.String()
}

// formatTSCodeForIndex formats TypeScript source code for RAG indexing
func formatTSCodeForIndex(content, filename string) string {
	var result strings.Builder

	result.WriteString(fmt.Sprintf("# DSL TypeScript Source: %s\n\n", strings.TrimSuffix(filename, ".ts")))

	// Extract file-level JSDoc comments
	fileDocPattern := regexp.MustCompile(`(?s)^/\*\*(.+?)\*/`)
	if match := fileDocPattern.FindStringSubmatch(content); len(match) >= 2 {
		doc := strings.TrimSpace(match[1])
		doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
		if doc != "" {
			result.WriteString("## File Documentation\n\n")
			result.WriteString(doc)
			result.WriteString("\n\n")
		}
	}

	// Extract const/export const declarations
	constPattern := regexp.MustCompile(`(?m)^(?:export\s+)?const\s+(\w+)(?:\s*:\s*[^=]+)?\s*=\s*(.+)$`)
	constMatches := constPattern.FindAllStringSubmatch(content, -1)
	if len(constMatches) > 0 {
		result.WriteString("## Constants\n\n")
		for _, m := range constMatches {
			if len(m) >= 3 {
				result.WriteString(fmt.Sprintf("- `%s = %s`\n", m[1], m[2]))
			}
		}
		result.WriteString("\n")
	}

	// Extract interface/type definitions
	typePattern := regexp.MustCompile(`(?s)((?:/\*\*[^*]*\*+(?:[^/*][^*]*\*+)*/\s*)?)((?:export\s+)?(?:interface|type)\s+\w+[^{]*\{[^}]*\})`)
	typeMatches := typePattern.FindAllStringSubmatch(content, -1)
	if len(typeMatches) > 0 {
		result.WriteString("## Types and Interfaces\n\n")
		for _, match := range typeMatches {
			if len(match) >= 3 {
				doc := ""
				if match[1] != "" {
					doc = strings.TrimSpace(match[1])
					doc = regexp.MustCompile(`(?s)/\*\*(.+?)\*/`).ReplaceAllString(doc, "$1")
					doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
				}
				typeDef := strings.TrimSpace(match[2])

				// Extract name
				namePattern := regexp.MustCompile(`(?:interface|type)\s+(\w+)`)
				if nameMatch := namePattern.FindStringSubmatch(typeDef); len(nameMatch) >= 2 {
					result.WriteString(fmt.Sprintf("### %s\n\n", nameMatch[1]))
				}

				result.WriteString("```typescript\n")
				result.WriteString(typeDef)
				result.WriteString("\n```\n\n")
				if doc != "" {
					result.WriteString(doc)
					result.WriteString("\n\n")
				}
				result.WriteString("---\n\n")
			}
		}
	}

	// Extract function definitions with JSDoc
	funcPattern := regexp.MustCompile(`(?s)((?:/\*\*[^*]*\*+(?:[^/*][^*]*\*+)*/\s*)?)((?:export\s+)?(?:async\s+)?function\s+\w+[^{]+)`)
	funcMatches := funcPattern.FindAllStringSubmatch(content, -1)
	if len(funcMatches) > 0 {
		result.WriteString("## Functions\n\n")
		for _, match := range funcMatches {
			if len(match) >= 3 {
				doc := ""
				if match[1] != "" {
					doc = strings.TrimSpace(match[1])
					doc = regexp.MustCompile(`(?s)/\*\*(.+?)\*/`).ReplaceAllString(doc, "$1")
					doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
				}
				signature := strings.TrimSpace(match[2])

				// Extract name
				namePattern := regexp.MustCompile(`function\s+(\w+)`)
				if nameMatch := namePattern.FindStringSubmatch(signature); len(nameMatch) >= 2 {
					result.WriteString(fmt.Sprintf("### %s\n\n", nameMatch[1]))
				}

				result.WriteString("```typescript\n")
				result.WriteString(signature)
				result.WriteString("\n```\n\n")
				if doc != "" {
					result.WriteString(doc)
					result.WriteString("\n\n")
				}
				result.WriteString("---\n\n")
			}
		}
	}

	// Extract array/object definitions (often contain DSL reference data)
	dataPattern := regexp.MustCompile(`(?s)((?://[^\n]*\n|/\*\*[^*]*\*+(?:[^/*][^*]*\*+)*/\s*)?)(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(\[[^\]]+\]|\{[^}]+\})`)
	dataMatches := dataPattern.FindAllStringSubmatch(content, -1)
	if len(dataMatches) > 0 {
		result.WriteString("## Data Definitions\n\n")
		for _, match := range dataMatches {
			if len(match) >= 4 {
				doc := ""
				if match[1] != "" {
					doc = strings.TrimSpace(match[1])
					doc = regexp.MustCompile(`(?s)/\*\*(.+?)\*/`).ReplaceAllString(doc, "$1")
					doc = regexp.MustCompile(`(?m)^(?://\s?|\s*\*\s?)`).ReplaceAllString(doc, "")
				}
				name := match[2]
				value := match[3]

				result.WriteString(fmt.Sprintf("### %s\n\n", name))
				if doc != "" {
					result.WriteString(doc)
					result.WriteString("\n\n")
				}
				// Truncate long values
				if len(value) > 500 {
					value = value[:500] + "..."
				}
				result.WriteString("```typescript\n")
				result.WriteString(fmt.Sprintf("const %s = %s", name, value))
				result.WriteString("\n```\n\n---\n\n")
			}
		}
	}

	return result.String()
}

// cloneRepo clones a git repository to the specified directory
func cloneRepo(repoURL, destDir string) error {
	cmd := exec.Command("git", "clone", "--depth", "1", repoURL, destDir)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// indexKosherJava clones the KosherJava zmanim library and indexes ALL relevant files
func indexKosherJava(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker, tempDir string) (int, int, error) {
	repoDir := filepath.Join(tempDir, "KosherJava")

	log.Println("   Cloning KosherJava zmanim library...")
	err := cloneRepo("https://github.com/KosherJava/zmanim.git", repoDir)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to clone KosherJava: %w", err)
	}

	totalChunks := 0
	totalTokens := 0

	// Index markdown files (README, CHANGELOG)
	mdFiles := []string{"README.md", "CHANGELOG.md"}
	for _, mdFile := range mdFiles {
		mdPath := filepath.Join(repoDir, mdFile)
		if content, err := os.ReadFile(mdPath); err == nil {
			sourceKey := makeSourceKey("kj", mdFile)
			chunks, tokens, err := indexContent(ctx, pool, embeddings, chunker, string(content), sourceKey, "documentation")
			if err != nil {
				log.Printf("   Warning: Failed to index KosherJava %s: %v", mdFile, err)
			} else {
				totalChunks += chunks
				totalTokens += tokens
				log.Printf("   Indexed KosherJava %s: %d chunks", mdFile, chunks)
			}
		}
	}

	// Find ALL Java files in src/main (not tests)
	srcDir := filepath.Join(repoDir, "src", "main", "java")
	javaFiles, err := findJavaFiles(srcDir)
	if err != nil {
		log.Printf("   Warning: Failed to find Java files: %v", err)
	}

	log.Printf("   Found %d Java files to index", len(javaFiles))

	// Files that should have FULL content indexed (contain important constants/logic)
	fullContentFiles := map[string]bool{
		"ComplexZmanimCalendar.java": true,
		"ZmanimCalendar.java":        true,
		"AstronomicalCalendar.java":  true,
		"NOAACalculator.java":        true,
		"SunTimesCalculator.java":    true,
		"JewishCalendar.java":        true,
		"JewishDate.java":            true,
		"TefilaRules.java":           true,
	}

	for _, javaFile := range javaFiles {
		baseName := filepath.Base(javaFile)
		relPath, _ := filepath.Rel(repoDir, javaFile)
		sourceKey := makeSourceKey("kj", relPath)

		content, err := os.ReadFile(javaFile)
		if err != nil {
			continue
		}

		var extracted string
		var contentType string

		if baseName == "package-info.java" {
			// Extract package documentation
			extracted = extractPackageInfo(string(content), relPath)
			contentType = "documentation"
		} else if fullContentFiles[baseName] {
			// Index full content for key files (contains halachic constants)
			extracted = formatJavaForIndex(string(content), baseName)
			contentType = "reference"
		} else {
			// Extract Javadoc only for other files
			extracted = extractJavadocContent(string(content))
			contentType = "reference"
		}

		if extracted == "" {
			continue
		}

		chunks, tokens, err := indexContent(ctx, pool, embeddings, chunker, extracted, sourceKey, contentType)
		if err != nil {
			log.Printf("   Warning: Failed to index %s: %v", relPath, err)
		} else if chunks > 0 {
			totalChunks += chunks
			totalTokens += tokens
			log.Printf("   Indexed %s: %d chunks", relPath, chunks)
		}
	}

	return totalChunks, totalTokens, nil
}

// findJavaFiles recursively finds all .java files in a directory
func findJavaFiles(dir string) ([]string, error) {
	var files []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".java") {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

// extractPackageInfo extracts package-level documentation from package-info.java
func extractPackageInfo(content, filename string) string {
	var result strings.Builder

	// Extract package path from filename
	pkgPath := strings.TrimSuffix(filepath.Dir(filename), "/")
	pkgPath = strings.ReplaceAll(pkgPath, "src/main/java/", "")
	pkgPath = strings.ReplaceAll(pkgPath, "/", ".")

	result.WriteString(fmt.Sprintf("# Package: %s\n\n", pkgPath))

	// Extract Javadoc before package declaration
	packageDocPattern := regexp.MustCompile(`(?s)/\*\*(.+?)\*/\s*package`)
	if match := packageDocPattern.FindStringSubmatch(content); len(match) >= 2 {
		doc := strings.TrimSpace(match[1])
		doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
		// Remove HTML tags but keep content
		doc = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(doc, "")
		result.WriteString(doc)
		result.WriteString("\n")
	}

	return result.String()
}

// formatJavaForIndex formats a Java file for RAG indexing, keeping key content
func formatJavaForIndex(content, filename string) string {
	var result strings.Builder

	result.WriteString(fmt.Sprintf("# KosherJava: %s\n\n", strings.TrimSuffix(filename, ".java")))

	// Extract class-level Javadoc
	classDocPattern := regexp.MustCompile(`(?s)/\*\*(.+?)\*/\s*public\s+(?:abstract\s+)?class`)
	if match := classDocPattern.FindStringSubmatch(content); len(match) >= 2 {
		doc := strings.TrimSpace(match[1])
		doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
		doc = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(doc, "")
		result.WriteString("## Class Documentation\n\n")
		result.WriteString(doc)
		result.WriteString("\n\n")
	}

	// Extract constants (important halachic values)
	constantPattern := regexp.MustCompile(`(?m)^\s*((?:/\*\*(?:[^*]|\*[^/])*\*/\s*)?(?:public|protected|private)?\s*static\s+final\s+\w+\s+\w+\s*=\s*[^;]+;)`)
	constants := constantPattern.FindAllStringSubmatch(content, -1)
	if len(constants) > 0 {
		result.WriteString("## Constants\n\n")
		for _, c := range constants {
			if len(c) >= 2 {
				// Clean up the constant
				constant := strings.TrimSpace(c[1])
				// Extract any Javadoc
				if strings.Contains(constant, "/**") {
					parts := strings.SplitN(constant, "*/", 2)
					if len(parts) == 2 {
						doc := strings.TrimPrefix(parts[0], "/**")
						doc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(doc, "")
						doc = strings.TrimSpace(doc)
						decl := strings.TrimSpace(parts[1])
						result.WriteString(fmt.Sprintf("- `%s` - %s\n", decl, doc))
						continue
					}
				}
				result.WriteString(fmt.Sprintf("- `%s`\n", constant))
			}
		}
		result.WriteString("\n")
	}

	// Also extract Javadoc methods
	javadocMethods := extractJavadocContent(content)
	if javadocMethods != "" {
		result.WriteString("## Methods\n\n")
		result.WriteString(javadocMethods)
	}

	return result.String()
}

// extractJavadocContent extracts Javadoc comments and method signatures from Java source
func extractJavadocContent(content string) string {
	var result strings.Builder

	// Match Javadoc comments followed by method signatures
	// Pattern: /** ... */ followed by public/protected method
	javadocPattern := regexp.MustCompile(`(?s)/\*\*(.+?)\*/\s*((?:public|protected)\s+[^\{]+)`)
	matches := javadocPattern.FindAllStringSubmatch(content, -1)

	for _, match := range matches {
		if len(match) >= 3 {
			javadoc := strings.TrimSpace(match[1])
			signature := strings.TrimSpace(match[2])

			// Clean up Javadoc - remove asterisks at line starts
			javadoc = regexp.MustCompile(`(?m)^\s*\*\s?`).ReplaceAllString(javadoc, "")

			// Skip getters/setters and trivial methods
			if strings.Contains(signature, "get") && len(javadoc) < 50 {
				continue
			}
			if strings.Contains(signature, "set") && len(javadoc) < 50 {
				continue
			}

			result.WriteString("### ")
			result.WriteString(extractMethodName(signature))
			result.WriteString("\n\n")
			result.WriteString("```java\n")
			result.WriteString(signature)
			result.WriteString("\n```\n\n")
			result.WriteString(javadoc)
			result.WriteString("\n\n---\n\n")
		}
	}

	return result.String()
}

// extractMethodName extracts the method name from a Java method signature
func extractMethodName(signature string) string {
	// Remove access modifier and return type to find method name
	methodPattern := regexp.MustCompile(`(\w+)\s*\(`)
	match := methodPattern.FindStringSubmatch(signature)
	if len(match) >= 2 {
		return match[1]
	}
	return "Unknown"
}

// extractGoFuncName extracts the function name from a Go function signature
func extractGoFuncName(signature string) string {
	// Handle both regular functions and methods
	pattern := regexp.MustCompile(`func\s+(?:\([^)]+\)\s*)?(\w+)`)
	match := pattern.FindStringSubmatch(signature)
	if len(match) >= 2 {
		return match[1]
	}
	return "Unknown"
}

// extractGoTypeName extracts the type name from a Go type definition
func extractGoTypeName(signature string) string {
	pattern := regexp.MustCompile(`type\s+(\w+)`)
	match := pattern.FindStringSubmatch(signature)
	if len(match) >= 2 {
		return match[1]
	}
	return "Unknown"
}

// MaxTokensPerBatch is the maximum tokens per embedding API request
// OpenAI text-embedding-3-small has 8192 token limit, leave buffer
const MaxTokensPerBatch = 7500

// indexContent is a helper to index arbitrary content
func indexContent(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, chunker *ai.Chunker, content, source, contentType string) (int, int, error) {
	// Get or create source ID
	sourceID, err := getOrCreateSourceID(ctx, pool, source, source)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get/create source: %w", err)
	}

	chunks := chunker.ChunkDocument(content, source, contentType)
	if len(chunks) == 0 {
		return 0, 0, nil
	}

	totalTokens := 0

	// Process chunks in token-aware batches (not fixed size)
	var currentBatch []ai.Chunk
	var currentTexts []string
	currentBatchTokens := 0

	for _, chunk := range chunks {
		trimmed := strings.TrimSpace(chunk.Content)
		if trimmed == "" {
			continue
		}

		chunkTokens := chunk.TokenCount
		totalTokens += chunkTokens

		// If this chunk alone exceeds the limit, process it individually
		if chunkTokens > MaxTokensPerBatch {
			// Flush current batch first
			if len(currentTexts) > 0 {
				if err := processBatch(ctx, pool, embeddings, sourceID, contentType, currentTexts, currentBatch); err != nil {
					return 0, 0, err
				}
				currentBatch = nil
				currentTexts = nil
				currentBatchTokens = 0
			}

			// Process oversized chunk individually (will likely fail, but gives clear error)
			log.Printf("   Warning: chunk has %d tokens (exceeds %d limit), attempting anyway", chunkTokens, MaxTokensPerBatch)
			if err := processBatch(ctx, pool, embeddings, sourceID, contentType, []string{trimmed}, []ai.Chunk{chunk}); err != nil {
				return 0, 0, fmt.Errorf("failed to process large chunk: %w", err)
			}
			continue
		}

		// If adding this chunk would exceed limit, flush current batch
		if currentBatchTokens+chunkTokens > MaxTokensPerBatch && len(currentTexts) > 0 {
			if err := processBatch(ctx, pool, embeddings, sourceID, contentType, currentTexts, currentBatch); err != nil {
				return 0, 0, err
			}
			currentBatch = nil
			currentTexts = nil
			currentBatchTokens = 0
		}

		// Add to current batch
		currentTexts = append(currentTexts, trimmed)
		currentBatch = append(currentBatch, chunk)
		currentBatchTokens += chunkTokens
	}

	// Process remaining batch
	if len(currentTexts) > 0 {
		if err := processBatch(ctx, pool, embeddings, sourceID, contentType, currentTexts, currentBatch); err != nil {
			return 0, 0, err
		}
	}

	return len(chunks), totalTokens, nil
}

// processBatch generates embeddings for a batch and inserts into database
func processBatch(ctx context.Context, pool *pgxpool.Pool, embeddings *ai.EmbeddingService, sourceID int16, contentType string, texts []string, chunks []ai.Chunk) error {
	if len(texts) == 0 {
		return nil
	}

	// Generate embeddings
	embeds, err := embeddings.GenerateEmbeddings(ctx, texts)
	if err != nil {
		return fmt.Errorf("failed to generate embeddings: %w", err)
	}

	// Insert into database
	for j, chunk := range chunks {
		vec := pgvector.NewVector(embeds[j])
		_, err := pool.Exec(ctx, `
			INSERT INTO embeddings (content, source_id, content_type, chunk_index, metadata, embedding)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, chunk.Content, sourceID, contentType, chunk.Index, chunk.Metadata, vec)
		if err != nil {
			return fmt.Errorf("failed to insert embedding: %w", err)
		}
	}

	// Rate limit to avoid OpenAI API limits
	time.Sleep(100 * time.Millisecond)

	return nil
}
