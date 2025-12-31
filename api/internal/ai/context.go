package ai

import (
	"context"
	"fmt"
	"strings"
)

// ContextService assembles context for AI prompts
type ContextService struct {
	search *SearchService
}

// NewContextService creates a new context service
func NewContextService(search *SearchService) *ContextService {
	return &ContextService{
		search: search,
	}
}

// ContextOptions configures context assembly
type ContextOptions struct {
	MaxTokens       int      // Maximum total tokens for context
	MaxDocs         int      // Maximum documents per type
	IncludeExamples bool     // Include DSL examples
	IncludeHalachic bool     // Include halachic sources
	FilterSources   []string // Filter by specific sources
}

// DefaultContextOptions returns default options
func DefaultContextOptions() ContextOptions {
	return ContextOptions{
		MaxTokens:       2000,
		MaxDocs:         3,
		IncludeExamples: true,
		IncludeHalachic: true,
	}
}

// AssembledContext represents the assembled context for AI
type AssembledContext struct {
	Context    string            `json:"context"`
	Sources    []SearchResult    `json:"sources"`
	TokenCount int               `json:"token_count"`
	Metadata   map[string]string `json:"metadata"`
}

// AssembleContext retrieves and assembles relevant context for a query
func (s *ContextService) AssembleContext(ctx context.Context, query string, opts ContextOptions) (*AssembledContext, error) {
	if opts.MaxTokens <= 0 {
		opts.MaxTokens = 2000
	}
	if opts.MaxDocs <= 0 {
		opts.MaxDocs = 3
	}

	// Search for relevant chunks
	results, err := s.search.SearchSimilar(ctx, query, opts.MaxDocs*3)
	if err != nil {
		return nil, fmt.Errorf("failed to search: %w", err)
	}

	// Group results by content type
	// Include all documentation-related types: documentation, dsl-documentation, api-reference
	docResults := filterByTypes(results, []string{"documentation", "dsl-documentation", "api-reference"})
	exampleResults := filterByTypes(results, []string{"example", "dsl-code"})
	// Reference content includes zmanim definitions and halachic sources
	referenceResults := filterByType(results, "reference")

	// Build context sections
	var sections []string
	var usedResults []SearchResult
	currentTokens := 0

	// Add documentation section
	if len(docResults) > 0 {
		docSection, tokens, used := s.buildSection("DSL Documentation", docResults, opts.MaxDocs, opts.MaxTokens-currentTokens)
		if docSection != "" {
			sections = append(sections, docSection)
			currentTokens += tokens
			usedResults = append(usedResults, used...)
		}
	}

	// Add examples section
	if opts.IncludeExamples && len(exampleResults) > 0 {
		exSection, tokens, used := s.buildSection("DSL Examples", exampleResults, opts.MaxDocs, opts.MaxTokens-currentTokens)
		if exSection != "" {
			sections = append(sections, exSection)
			currentTokens += tokens
			usedResults = append(usedResults, used...)
		}
	}

	// Add reference/halachic section (includes zmanim definitions from KosherJava, master registry)
	if opts.IncludeHalachic && len(referenceResults) > 0 {
		refSection, tokens, used := s.buildSection("Zmanim Reference", referenceResults, opts.MaxDocs, opts.MaxTokens-currentTokens)
		if refSection != "" {
			sections = append(sections, refSection)
			currentTokens += tokens
			usedResults = append(usedResults, used...)
		}
	}

	// Combine sections
	fullContext := strings.Join(sections, "\n\n---\n\n")

	return &AssembledContext{
		Context:    fullContext,
		Sources:    usedResults,
		TokenCount: currentTokens,
		Metadata: map[string]string{
			"query":       query,
			"num_docs":    fmt.Sprintf("%d", len(usedResults)),
			"token_count": fmt.Sprintf("%d", currentTokens),
		},
	}, nil
}

// buildSection builds a context section from results
func (s *ContextService) buildSection(title string, results []SearchResult, maxDocs, maxTokens int) (string, int, []SearchResult) {
	if maxTokens <= 0 || len(results) == 0 {
		return "", 0, nil
	}

	var content strings.Builder
	content.WriteString("## ")
	content.WriteString(title)
	content.WriteString("\n\n")

	headerTokens := estimateTokens(title) + 10 // Header overhead
	currentTokens := headerTokens
	var used []SearchResult
	count := 0

	for _, result := range results {
		if count >= maxDocs {
			break
		}

		resultTokens := estimateTokens(result.Content) + 20 // Formatting overhead
		if currentTokens+resultTokens > maxTokens {
			continue
		}

		// Add source attribution
		if result.Metadata["header"] != "" {
			content.WriteString("### ")
			content.WriteString(result.Metadata["header"])
			content.WriteString("\n\n")
		}

		content.WriteString(result.Content)
		content.WriteString("\n\n")

		// Add source citation
		content.WriteString(fmt.Sprintf("_Source: %s (relevance: %.2f)_\n\n", result.Source, result.Score))

		currentTokens += resultTokens
		used = append(used, result)
		count++
	}

	if len(used) == 0 {
		return "", 0, nil
	}

	return content.String(), currentTokens, used
}

// filterByType filters results by content type
func filterByType(results []SearchResult, contentType string) []SearchResult {
	var filtered []SearchResult
	for _, r := range results {
		if r.ContentType == contentType {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// filterByTypes filters results by multiple content types
func filterByTypes(results []SearchResult, contentTypes []string) []SearchResult {
	typeSet := make(map[string]bool)
	for _, t := range contentTypes {
		typeSet[t] = true
	}
	var filtered []SearchResult
	for _, r := range results {
		if typeSet[r.ContentType] {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// estimateTokens estimates token count (rough: ~4 chars per token)
func estimateTokens(text string) int {
	return (len(text) + 3) / 4
}

// FormatForClaude formats context for Claude API prompt
func (s *ContextService) FormatForClaude(assembled *AssembledContext, userQuery string) string {
	if assembled == nil || assembled.Context == "" {
		return userQuery
	}

	return fmt.Sprintf(`Here is relevant context about the Zmanim DSL and halachic sources:

<context>
%s
</context>

User Query: %s

Please use the above context to provide an accurate and helpful response. When referencing halachic sources, cite them appropriately.`, assembled.Context, userQuery)
}
