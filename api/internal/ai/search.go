package ai

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"
)

// SearchResult represents a semantic search result
type SearchResult struct {
	ID          string            `json:"id"`
	Content     string            `json:"content"`
	Source      string            `json:"source"`
	ContentType string            `json:"content_type"`
	ChunkIndex  int               `json:"chunk_index"`
	Metadata    map[string]string `json:"metadata"`
	Score       float64           `json:"score"`
}

// SearchService provides semantic search capabilities
type SearchService struct {
	db         *pgxpool.Pool
	embeddings *EmbeddingService
}

// NewSearchService creates a new search service
func NewSearchService(db *pgxpool.Pool, embeddings *EmbeddingService) *SearchService {
	return &SearchService{
		db:         db,
		embeddings: embeddings,
	}
}

// SearchSimilar finds chunks similar to the query
func (s *SearchService) SearchSimilar(ctx context.Context, query string, topK int) ([]SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}

	// Generate embedding for query
	queryEmbed, err := s.embeddings.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	// Convert to pgvector
	vec := pgvector.NewVector(queryEmbed)

	// Search using cosine distance (join with ai_content_sources to get source key)
	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.content, s.key as source, e.content_type, e.chunk_index, e.metadata,
		       1 - (e.embedding <=> $1) as score
		FROM embeddings e
		JOIN ai_content_sources s ON s.id = e.source_id
		ORDER BY e.embedding <=> $1
		LIMIT $2
	`, vec, topK)
	if err != nil {
		return nil, fmt.Errorf("failed to search embeddings: %w", err)
	}
	defer rows.Close()

	return scanSearchResults(rows)
}

// SearchSimilarBySource searches within a specific source
func (s *SearchService) SearchSimilarBySource(ctx context.Context, query string, source string, topK int) ([]SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}

	queryEmbed, err := s.embeddings.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	vec := pgvector.NewVector(queryEmbed)

	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.content, s.key as source, e.content_type, e.chunk_index, e.metadata,
		       1 - (e.embedding <=> $1) as score
		FROM embeddings e
		JOIN ai_content_sources s ON s.id = e.source_id
		WHERE s.key = $2
		ORDER BY e.embedding <=> $1
		LIMIT $3
	`, vec, source, topK)
	if err != nil {
		return nil, fmt.Errorf("failed to search embeddings: %w", err)
	}
	defer rows.Close()

	return scanSearchResults(rows)
}

// SearchSimilarByType searches within a specific content type
func (s *SearchService) SearchSimilarByType(ctx context.Context, query string, contentType string, topK int) ([]SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}

	queryEmbed, err := s.embeddings.GenerateEmbedding(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to generate query embedding: %w", err)
	}

	vec := pgvector.NewVector(queryEmbed)

	rows, err := s.db.Query(ctx, `
		SELECT e.id, e.content, s.key as source, e.content_type, e.chunk_index, e.metadata,
		       1 - (e.embedding <=> $1) as score
		FROM embeddings e
		JOIN ai_content_sources s ON s.id = e.source_id
		WHERE e.content_type = $2
		ORDER BY e.embedding <=> $1
		LIMIT $3
	`, vec, contentType, topK)
	if err != nil {
		return nil, fmt.Errorf("failed to search embeddings: %w", err)
	}
	defer rows.Close()

	return scanSearchResults(rows)
}

// scanSearchResults scans rows into SearchResult slice
func scanSearchResults(rows pgx.Rows) ([]SearchResult, error) {
	var results []SearchResult

	for rows.Next() {
		var r SearchResult
		var metadataJSON []byte

		err := rows.Scan(
			&r.ID,
			&r.Content,
			&r.Source,
			&r.ContentType,
			&r.ChunkIndex,
			&metadataJSON,
			&r.Score,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &r.Metadata); err != nil {
				r.Metadata = make(map[string]string)
			}
		}

		results = append(results, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return results, nil
}

// IndexStats returns statistics about the embedding index
type IndexStats struct {
	TotalChunks int      `json:"total_chunks"`
	Sources     []string `json:"sources"`
	LastIndexed string   `json:"last_indexed,omitempty"`
}

// GetIndexStats returns index statistics
func (s *SearchService) GetIndexStats(ctx context.Context) (*IndexStats, error) {
	var stats IndexStats

	// Get total chunks
	err := s.db.QueryRow(ctx, "SELECT COUNT(*) FROM embeddings").Scan(&stats.TotalChunks)
	if err != nil {
		return nil, fmt.Errorf("failed to count embeddings: %w", err)
	}

	// Get distinct sources (join with ai_content_sources to get key)
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT s.key
		FROM embeddings e
		JOIN ai_content_sources s ON s.id = e.source_id
		ORDER BY s.key
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to get sources: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var source string
		if err := rows.Scan(&source); err != nil {
			continue
		}
		stats.Sources = append(stats.Sources, source)
	}

	// Get last indexed time
	var lastIndexed *string
	err = s.db.QueryRow(ctx, "SELECT MAX(updated_at)::text FROM embeddings").Scan(&lastIndexed)
	if err == nil && lastIndexed != nil {
		stats.LastIndexed = *lastIndexed
	}

	return &stats, nil
}
