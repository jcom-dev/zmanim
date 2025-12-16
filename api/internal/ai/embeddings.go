// Package ai provides AI-powered features including embeddings and semantic search
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// EmbeddingDimensions is the dimensionality of text-embedding-3-small
const EmbeddingDimensions = 1536

// EmbeddingModel is the OpenAI model used for embeddings
const EmbeddingModel = "text-embedding-3-small"

// EmbeddingService generates text embeddings using OpenAI API
type EmbeddingService struct {
	apiKey     string
	httpClient *http.Client
	cache      sync.Map // Simple in-memory cache
}

// OpenAI API request/response structures
type embeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

type openAIError struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(apiKey string) *EmbeddingService {
	return &EmbeddingService{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// GenerateEmbedding generates an embedding for a single text
func (s *EmbeddingService) GenerateEmbedding(ctx context.Context, text string) ([]float32, error) {
	// Check cache first
	if cached, ok := s.cache.Load(text); ok {
		return cached.([]float32), nil
	}

	embeddings, err := s.GenerateEmbeddings(ctx, []string{text})
	if err != nil {
		return nil, err
	}

	if len(embeddings) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	// Cache the result
	s.cache.Store(text, embeddings[0])

	return embeddings[0], nil
}

// GenerateEmbeddings generates embeddings for multiple texts
func (s *EmbeddingService) GenerateEmbeddings(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	// Filter out empty strings which cause OpenAI API errors
	var validTexts []string
	var originalIndices []int
	for i, t := range texts {
		if t != "" {
			validTexts = append(validTexts, t)
			originalIndices = append(originalIndices, i)
		}
	}

	if len(validTexts) == 0 {
		return nil, fmt.Errorf("all texts were empty")
	}

	reqBody := embeddingRequest{
		Model: EmbeddingModel,
		Input: validTexts,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/embeddings", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp openAIError
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
			return nil, fmt.Errorf("OpenAI API error: %s", errResp.Error.Message)
		}
		return nil, fmt.Errorf("OpenAI API error: status %d", resp.StatusCode)
	}

	var embResp embeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&embResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Map results back to original indices
	result := make([][]float32, len(texts))
	for _, data := range embResp.Data {
		if data.Index < len(originalIndices) {
			result[originalIndices[data.Index]] = data.Embedding
		}
	}

	return result, nil
}

// ClearCache clears the embedding cache
func (s *EmbeddingService) ClearCache() {
	s.cache = sync.Map{}
}
