package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/ai"
)

// AISearchRequest represents a semantic search request
type AISearchRequest struct {
	Query       string   `json:"query"`
	TopK        int      `json:"top_k,omitempty"`
	Sources     []string `json:"sources,omitempty"`
	ContentType string   `json:"content_type,omitempty"`
}

// AISearchResponse represents search results
type AISearchResponse struct {
	Results []ai.SearchResult `json:"results"`
	Query   string            `json:"query"`
}

// AIContextRequest represents a context assembly request
type AIContextRequest struct {
	Query           string `json:"query"`
	MaxTokens       int    `json:"max_tokens,omitempty"`
	IncludeExamples bool   `json:"include_examples,omitempty"`
	IncludeHalachic bool   `json:"include_halachic,omitempty"`
}

// SearchAI performs semantic search on the knowledge base
// POST /api/ai/search
func (h *Handlers) SearchAI(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req AISearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Query == "" {
		RespondBadRequest(w, r, "Query is required")
		return
	}

	if req.TopK <= 0 {
		req.TopK = 5
	}

	// Check if AI services are configured
	if h.aiSearch == nil {
		RespondJSON(w, r, http.StatusOK, AISearchResponse{
			Results: []ai.SearchResult{},
			Query:   req.Query,
		})
		return
	}

	var results []ai.SearchResult
	var err error

	if req.ContentType != "" {
		results, err = h.aiSearch.SearchSimilarByType(ctx, req.Query, req.ContentType, req.TopK)
	} else {
		results, err = h.aiSearch.SearchSimilar(ctx, req.Query, req.TopK)
	}

	if err != nil {
		RespondInternalError(w, r, "Search failed")
		return
	}

	RespondJSON(w, r, http.StatusOK, AISearchResponse{
		Results: results,
		Query:   req.Query,
	})
}

// GetAIContext assembles context for AI prompts
// POST /api/ai/context
func (h *Handlers) GetAIContext(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req AIContextRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondBadRequest(w, r, "Invalid request body")
		return
	}

	if req.Query == "" {
		RespondBadRequest(w, r, "Query is required")
		return
	}

	// Check if AI services are configured
	if h.aiContext == nil {
		RespondJSON(w, r, http.StatusOK, map[string]interface{}{
			"context":     "",
			"sources":     []ai.SearchResult{},
			"token_count": 0,
		})
		return
	}

	opts := ai.ContextOptions{
		MaxTokens:       req.MaxTokens,
		MaxDocs:         5,
		IncludeExamples: req.IncludeExamples,
		IncludeHalachic: req.IncludeHalachic,
	}

	if opts.MaxTokens <= 0 {
		opts.MaxTokens = 2000
	}

	assembled, err := h.aiContext.AssembleContext(ctx, req.Query, opts)
	if err != nil {
		RespondInternalError(w, r, "Context assembly failed")
		return
	}

	RespondJSON(w, r, http.StatusOK, assembled)
}

// GetAIIndexStats returns index statistics
// GET /api/admin/ai/stats
func (h *Handlers) GetAIIndexStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if h.aiSearch == nil {
		RespondJSON(w, r, http.StatusOK, &ai.IndexStats{
			TotalChunks: 0,
			Sources:     []string{},
		})
		return
	}

	stats, err := h.aiSearch.GetIndexStats(ctx)
	if err != nil {
		RespondInternalError(w, r, "Failed to get index stats")
		return
	}

	RespondJSON(w, r, http.StatusOK, stats)
}

// TriggerReindex triggers re-indexing of the knowledge base
// POST /api/admin/ai/reindex
func (h *Handlers) TriggerReindex(w http.ResponseWriter, r *http.Request) {
	// In a real implementation, this would trigger an async job
	// For now, just acknowledge the request
	RespondJSON(w, r, http.StatusAccepted, map[string]string{
		"status":  "accepted",
		"message": "Reindex job queued",
	})
}
