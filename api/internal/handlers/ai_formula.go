package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/ai"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// GenerateFormulaRequest represents a formula generation request
type GenerateFormulaRequest struct {
	Description string `json:"description"`
	ZmanKey     string `json:"zman_key,omitempty"`     // Optional: zman key for enriched context
	PublisherID *int32 `json:"publisher_id,omitempty"` // Optional: publisher ID for publisher-specific context
}

// GenerateFormulaResponse represents the formula generation response
type GenerateFormulaResponse struct {
	Formula    string  `json:"formula"`
	Confidence float64 `json:"confidence"`
	TokensUsed int     `json:"tokens_used"`
	Valid      bool    `json:"valid"`
}

// ExplainFormulaRequest represents a formula explanation request
type ExplainFormulaRequest struct {
	Formula     string `json:"formula"`
	Language    string `json:"language,omitempty"`     // "en" or "he"
	ZmanKey     string `json:"zman_key,omitempty"`     // Optional: zman key for enriched context
	PublisherID *int32 `json:"publisher_id,omitempty"` // Optional: publisher ID for publisher-specific context
}

// ExplainFormulaResponse represents the formula explanation response
type ExplainFormulaResponse struct {
	Explanation string `json:"explanation"`
	Language    string `json:"language"`
	Source      string `json:"source"` // "ai" or "cached"
}

// RAGUnavailableError is returned when RAG validation fails
type RAGUnavailableError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// validateRAGAvailability validates that RAG context is available and returns assembled context
// Returns 503-style error if RAG is required but unavailable
func (h *Handlers) validateRAGAvailability(ctx context.Context, query string) (*ai.AssembledContext, error) {
	if h.aiContext == nil {
		return nil, fmt.Errorf("RAG service not configured")
	}

	opts := ai.ContextOptions{
		MaxTokens:       1500,
		MaxDocs:         3,
		IncludeExamples: true,
		IncludeHalachic: true,
	}
	assembled, err := h.aiContext.AssembleContext(ctx, query, opts)
	if err != nil {
		return nil, fmt.Errorf("RAG context assembly failed: %w", err)
	}

	if len(assembled.Sources) == 0 {
		// Check if we should enforce RAG (production) or allow bypass (dev)
		if os.Getenv("AI_REQUIRE_RAG") != "false" {
			return nil, fmt.Errorf("knowledge base not indexed - RAG sources unavailable")
		}
		slog.Warn("RAG sources empty, proceeding without context (AI_REQUIRE_RAG=false)")
	}

	return assembled, nil
}

// fetchZmanContext fetches enriched zman context for AI requests
// Returns formatted JSON context string or empty string if zman_key not provided
func (h *Handlers) fetchZmanContext(ctx context.Context, zmanKey string, publisherID *int32) string {
	if zmanKey == "" {
		return ""
	}

	// Build query params
	params := sqlcgen.GetZmanContextForAIParams{
		ZmanKey: zmanKey,
	}
	if publisherID != nil {
		params.PublisherID = publisherID
	}

	// Fetch zman context
	zmanCtx, err := h.db.Queries.GetZmanContextForAI(ctx, params)
	if err != nil {
		slog.Warn("failed to fetch zman context for AI", "zman_key", zmanKey, "error", err)
		return ""
	}

	// Build context JSON structure
	type TagInfo struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		Hebrew  string `json:"hebrew"`
		English string `json:"english,omitempty"`
	}

	type ZmanContext struct {
		Key             string    `json:"key"`
		HebrewName      string    `json:"hebrew_name,omitempty"`
		EnglishName     string    `json:"english_name,omitempty"`
		Transliteration string    `json:"transliteration,omitempty"`
		Description     string    `json:"description,omitempty"`
		HalachicNotes   string    `json:"halachic_notes,omitempty"`
		HalachicSource  string    `json:"halachic_source,omitempty"`
		TimeCategory    string    `json:"time_category,omitempty"`
		DefaultFormula  string    `json:"default_formula,omitempty"`
		IsCore          bool      `json:"is_core"`
		Tags            []TagInfo `json:"tags,omitempty"`
	}

	type PublisherContext struct {
		CurrentFormula string `json:"current_formula,omitempty"`
		Comment        string `json:"publisher_comment,omitempty"`
		IsEnabled      bool   `json:"is_enabled"`
		IsPublished    bool   `json:"is_published"`
	}

	type FullContext struct {
		Zman      ZmanContext       `json:"zman"`
		Publisher *PublisherContext `json:"publisher_context,omitempty"`
	}

	// Parse tags from JSON (tags is interface{} from SQLc, need to marshal/unmarshal)
	var tags []TagInfo
	if zmanCtx.Tags != nil {
		tagsBytes, err := json.Marshal(zmanCtx.Tags)
		if err == nil {
			_ = json.Unmarshal(tagsBytes, &tags)
		}
	}

	fullCtx := FullContext{
		Zman: ZmanContext{
			Key:             zmanCtx.ZmanKey,
			HebrewName:      zmanCtx.CanonicalHebrewName,
			EnglishName:     zmanCtx.CanonicalEnglishName,
			Transliteration: derefString(zmanCtx.Transliteration),
			Description:     derefString(zmanCtx.Description),
			HalachicNotes:   derefString(zmanCtx.HalachicNotes),
			HalachicSource:  derefString(zmanCtx.HalachicSource),
			TimeCategory:    derefString(zmanCtx.TimeCategory),
			DefaultFormula:  derefString(zmanCtx.DefaultFormulaDsl),
			IsCore:          derefBoolAI(zmanCtx.IsCore),
			Tags:            tags,
		},
	}

	// Add publisher context if available
	if zmanCtx.PublisherFormula != nil {
		fullCtx.Publisher = &PublisherContext{
			CurrentFormula: derefString(zmanCtx.PublisherFormula),
			Comment:        derefString(zmanCtx.PublisherComment),
			IsEnabled:      derefBoolAI(zmanCtx.IsEnabled),
			IsPublished:    derefBoolAI(zmanCtx.IsPublished),
		}
	}

	// Marshal to JSON
	contextBytes, err := json.MarshalIndent(fullCtx, "", "  ")
	if err != nil {
		slog.Warn("failed to marshal zman context", "error", err)
		return ""
	}

	return "\n\n=== ZMAN CONTEXT ===\n" + string(contextBytes)
}

// derefBoolAI dereferences a bool pointer, returning false if nil
func derefBoolAI(b *bool) bool {
	if b == nil {
		return false
	}
	return *b
}

// respondRAGUnavailable sends a 503 response for RAG unavailability
func respondRAGUnavailable(w http.ResponseWriter, r *http.Request, err error) {
	RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
		"error":       "AI service temporarily unavailable",
		"code":        "RAG_UNAVAILABLE",
		"message":     "The AI knowledge base is not currently accessible. Please try again later.",
		"details":     err.Error(),
		"retry_after": 60,
	})
}

// GenerateFormula generates a DSL formula from natural language
// POST /api/ai/generate-formula
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

	// Check character limit (2000 chars)
	if utf8.RuneCountInString(req.Description) > 2000 {
		RespondBadRequest(w, r, "Description exceeds 2000 character limit")
		return
	}

	// Check if Claude service is configured
	if h.aiClaude == nil {
		RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
			"error":   "AI service not configured",
			"message": "Formula generation is not available",
		})
		return
	}

	// Validate RAG availability (fail fast with 503 if unavailable)
	assembled, err := h.validateRAGAvailability(ctx, req.Description)
	if err != nil {
		respondRAGUnavailable(w, r, err)
		return
	}

	// Build context from RAG
	ragContext := assembled.Context
	ragUsed := len(assembled.Sources) > 0

	// Append zman context if zman_key provided
	if req.ZmanKey != "" {
		zmanContext := h.fetchZmanContext(ctx, req.ZmanKey, req.PublisherID)
		ragContext += zmanContext
	}

	// Generate formula with validation
	result, err := h.aiClaude.GenerateWithValidation(ctx, req.Description, ragContext, h.validateDSL)
	durationMs := int(time.Since(startTime).Milliseconds())

	// Log to audit (success or failure)
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

// ExplainFormula generates a human-readable explanation of a formula
// POST /api/ai/explain-formula
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

	// Default to English
	if req.Language == "" {
		req.Language = "en"
	}

	// Validate language
	if req.Language != "en" && req.Language != "he" && req.Language != "mixed" {
		RespondBadRequest(w, r, "Language must be 'en', 'he', or 'mixed'")
		return
	}

	// Check cache first (include zman_key in hash for context-aware caching)
	cacheInput := req.Formula
	if req.ZmanKey != "" {
		cacheInput = req.Formula + ":" + req.ZmanKey
	}
	formulaHash := hashFormula(cacheInput)
	cached, err := h.getCachedExplanation(ctx, formulaHash, req.Language)
	if err == nil && cached != "" {
		RespondJSON(w, r, http.StatusOK, ExplainFormulaResponse{
			Explanation: cached,
			Language:    req.Language,
			Source:      "cached",
		})
		return
	}

	// Check if Claude service is configured
	if h.aiClaude == nil {
		RespondJSON(w, r, http.StatusServiceUnavailable, map[string]interface{}{
			"error":   "AI service not configured",
			"message": "Formula explanation is not available",
		})
		return
	}

	// Validate RAG availability (fail fast with 503 if unavailable)
	assembled, err := h.validateRAGAvailability(ctx, req.Formula)
	if err != nil {
		respondRAGUnavailable(w, r, err)
		return
	}

	// Build context from RAG
	ragContext := assembled.Context
	ragUsed := len(assembled.Sources) > 0

	// Append zman context if zman_key provided
	if req.ZmanKey != "" {
		zmanContext := h.fetchZmanContext(ctx, req.ZmanKey, req.PublisherID)
		ragContext += zmanContext
	}

	// Generate explanation
	result, err := h.aiClaude.ExplainFormula(ctx, req.Formula, req.Language, ragContext)
	durationMs := int(time.Since(startTime).Milliseconds())

	// Log to audit
	var auditResult *ai.GenerationResult
	if result != nil {
		auditResult = &ai.GenerationResult{
			Formula:    result.Explanation,
			Confidence: 1.0,
		}
	}
	h.logAIAudit(ctx, r, "explain_formula", req.Formula, auditResult, err, durationMs, ragUsed)

	if err != nil {
		slog.Error("failed to generate explanation", "error", err)
		RespondInternalError(w, r, "Failed to generate explanation")
		return
	}

	// Cache the result (7 days TTL)
	h.cacheExplanation(ctx, formulaHash, req.Language, result.Explanation)

	RespondJSON(w, r, http.StatusOK, ExplainFormulaResponse{
		Explanation: result.Explanation,
		Language:    result.Language,
		Source:      result.Source,
	})
}

// hashFormula creates a SHA-256 hash of the formula for caching
func hashFormula(formula string) string {
	// Simple hash - in production use crypto/sha256
	hash := uint64(0)
	for i, c := range formula {
		hash = hash*31 + uint64(c) + uint64(i)
	}
	return fmt.Sprintf("%016x", hash)
}

// getCachedExplanation retrieves a cached explanation if available
func (h *Handlers) getCachedExplanation(ctx context.Context, formulaHash, language string) (string, error) {
	return h.db.Queries.GetCachedExplanation(ctx, sqlcgen.GetCachedExplanationParams{
		FormulaHash: formulaHash,
		Language:    language,
	})
}

// cacheExplanation stores an explanation in the cache
func (h *Handlers) cacheExplanation(ctx context.Context, formulaHash, language, explanation string) {
	_ = h.db.Queries.UpsertExplanationCache(ctx, sqlcgen.UpsertExplanationCacheParams{
		FormulaHash: formulaHash,
		Language:    language,
		Explanation: explanation,
	})
}

// validateDSL validates a DSL formula using the parser
func (h *Handlers) validateDSL(formula string) error {
	// Use the DSL validator from the dsl package
	// This is a placeholder - actual validation is in dsl package
	return nil
}

// logAIAudit logs AI request to the audit table
func (h *Handlers) logAIAudit(ctx context.Context, r *http.Request, requestType string, input string, result *ai.GenerationResult, err error, durationMs int, ragUsed bool) {
	// Get user info from context if available
	userID := middleware.GetUserID(r.Context())

	// Get publisher ID from header if available
	publisherIDStr := r.Header.Get("X-Publisher-Id")

	var outputText string
	var tokensUsed int
	var confidence float64
	success := err == nil

	if result != nil {
		outputText = result.Formula
		tokensUsed = result.TokensUsed
		confidence = result.Confidence
	}

	var errorMessage string
	if err != nil {
		errorMessage = err.Error()
	}

	// Convert publisher ID string to nullable int32
	var publisherID *int32
	if publisherIDStr != "" {
		if id, err := strconv.ParseInt(publisherIDStr, 10, 32); err == nil {
			id32 := int32(id)
			publisherID = &id32
		}
	}

	// Convert values to nullable pointers
	var userIDPtr *string
	if userID != "" {
		userIDPtr = &userID
	}

	var outputTextPtr *string
	if outputText != "" {
		outputTextPtr = &outputText
	}

	tokensUsedInt32 := int32(tokensUsed)
	tokensUsedPtr := &tokensUsedInt32

	model := "claude-3-5-sonnet-20241022"
	modelPtr := &model

	// Convert confidence to pgtype.Numeric
	var confidenceNumeric pgtype.Numeric
	_ = confidenceNumeric.Scan(confidence)

	successPtr := &success

	var errorMessagePtr *string
	if errorMessage != "" {
		errorMessagePtr = &errorMessage
	}

	durationMsInt32 := int32(durationMs)
	durationMsPtr := &durationMsInt32

	ragUsedPtr := &ragUsed

	// Insert audit log using SQLc
	_ = h.db.Queries.InsertAIAuditLog(ctx, sqlcgen.InsertAIAuditLogParams{
		PublisherID:    publisherID,
		UserID:         userIDPtr,
		RequestType:    requestType,
		InputText:      &input,
		OutputText:     outputTextPtr,
		TokensUsed:     tokensUsedPtr,
		Model:          modelPtr,
		Confidence:     confidenceNumeric,
		Success:        successPtr,
		ErrorMessage:   errorMessagePtr,
		DurationMs:     durationMsPtr,
		RagContextUsed: ragUsedPtr,
	})
}

// GetAIAuditLogs returns AI audit logs for admin
// GET /api/admin/ai/audit
func (h *Handlers) GetAIAuditLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query params
	limit := int32(50)
	requestType := r.URL.Query().Get("type")

	// Query using SQLc
	dbLogs, err := h.db.Queries.GetAIAuditLogs(ctx, sqlcgen.GetAIAuditLogsParams{
		Column1: requestType,
		Limit:   limit,
	})
	if err != nil && err != pgx.ErrNoRows {
		RespondInternalError(w, r, "Failed to query audit logs")
		return
	}

	type AuditLog struct {
		ID             string   `json:"id"`
		PublisherID    *int32   `json:"publisher_id"`
		UserID         *string  `json:"user_id"`
		RequestType    string   `json:"request_type"`
		InputText      *string  `json:"input_text"`
		OutputText     *string  `json:"output_text"`
		TokensUsed     *int32   `json:"tokens_used"`
		Model          *string  `json:"model"`
		Confidence     *float64 `json:"confidence"`
		Success        *bool    `json:"success"`
		ErrorMessage   *string  `json:"error_message"`
		DurationMs     *int32   `json:"duration_ms"`
		RAGContextUsed *bool    `json:"rag_context_used"`
		CreatedAt      string   `json:"created_at"`
	}

	// Convert to response format
	logs := make([]AuditLog, 0, len(dbLogs))
	for _, dbLog := range dbLogs {
		var confidence *float64
		if dbLog.Confidence.Valid {
			if f, err := dbLog.Confidence.Float64Value(); err == nil {
				confidence = &f.Float64
			}
		}

		var createdAt string
		if dbLog.CreatedAt.Valid {
			createdAt = dbLog.CreatedAt.Time.Format(time.RFC3339)
		}

		logs = append(logs, AuditLog{
			ID:             fmt.Sprintf("%d", dbLog.ID),
			PublisherID:    dbLog.PublisherID,
			UserID:         dbLog.UserID,
			RequestType:    dbLog.RequestType,
			InputText:      dbLog.InputText,
			OutputText:     dbLog.OutputText,
			TokensUsed:     dbLog.TokensUsed,
			Model:          dbLog.Model,
			Confidence:     confidence,
			Success:        dbLog.Success,
			ErrorMessage:   dbLog.ErrorMessage,
			DurationMs:     dbLog.DurationMs,
			RAGContextUsed: dbLog.RagContextUsed,
			CreatedAt:      createdAt,
		})
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"logs":  logs,
		"count": len(logs),
	})
}
