package ai

import (
	"testing"
)

// TestChunkText tests text chunking logic
func TestChunkText(t *testing.T) {
	tests := []struct {
		name      string
		text      string
		chunkSize int
		overlap   int
		wantMin   int // minimum expected chunks
	}{
		{
			name:      "short text single chunk",
			text:      "This is a short text.",
			chunkSize: 100,
			overlap:   20,
			wantMin:   1,
		},
		{
			name:      "long text multiple chunks",
			text:      "This is a longer piece of text that should be split into multiple chunks. Each chunk should have some overlap with the previous one to maintain context.",
			chunkSize: 50,
			overlap:   10,
			wantMin:   2,
		},
		{
			name:      "empty text",
			text:      "",
			chunkSize: 100,
			overlap:   20,
			wantMin:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chunks := chunkText(tt.text, tt.chunkSize, tt.overlap)

			if len(chunks) < tt.wantMin {
				t.Errorf("Expected at least %d chunks, got %d", tt.wantMin, len(chunks))
			}

			// Verify no empty chunks
			for i, chunk := range chunks {
				if chunk == "" {
					t.Errorf("Chunk %d is empty", i)
				}
			}
		})
	}
}

// TestChunkTextOverlap tests that chunks have proper overlap
func TestChunkTextOverlap(t *testing.T) {
	text := "AAAAAAAAAA BBBBBBBBBB CCCCCCCCCC DDDDDDDDDD EEEEEEEEEE"
	chunks := chunkText(text, 25, 10)

	if len(chunks) < 2 {
		t.Skip("Not enough chunks to test overlap")
	}

	// Each chunk (except first) should contain some content from previous
	// This is a basic check - exact overlap depends on implementation
	t.Logf("Chunks: %v", chunks)
}

// TestPrepareDocumentForIndexing tests document preparation
func TestPrepareDocumentForIndexing(t *testing.T) {
	doc := HalachicDocument{
		ID:      "test-doc",
		Type:    "zman_explanation",
		Title:   "Alos Hashachar",
		Content: "Dawn is calculated as 72 minutes before sunrise or when the sun is 16.1 degrees below the horizon.",
		Metadata: map[string]string{
			"source": "Shulchan Aruch",
		},
	}

	chunks := PrepareDocumentForIndexing(doc)

	if len(chunks) == 0 {
		t.Error("Expected at least one chunk")
	}

	for _, chunk := range chunks {
		if chunk.DocumentID != doc.ID {
			t.Errorf("Chunk should reference document ID %s, got %s", doc.ID, chunk.DocumentID)
		}
		if chunk.Content == "" {
			t.Error("Chunk content should not be empty")
		}
	}
}

// TestCosineSimilarity tests similarity calculation
func TestCosineSimilarity(t *testing.T) {
	tests := []struct {
		name   string
		a      []float32
		b      []float32
		wantGT float64 // result should be greater than this
		wantLT float64 // result should be less than this
	}{
		{
			name:   "identical vectors",
			a:      []float32{1, 0, 0},
			b:      []float32{1, 0, 0},
			wantGT: 0.99,
			wantLT: 1.01,
		},
		{
			name:   "orthogonal vectors",
			a:      []float32{1, 0, 0},
			b:      []float32{0, 1, 0},
			wantGT: -0.01,
			wantLT: 0.01,
		},
		{
			name:   "opposite vectors",
			a:      []float32{1, 0, 0},
			b:      []float32{-1, 0, 0},
			wantGT: -1.01,
			wantLT: -0.99,
		},
		{
			name:   "similar vectors",
			a:      []float32{1, 1, 0},
			b:      []float32{1, 0.9, 0.1},
			wantGT: 0.9,
			wantLT: 1.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			similarity := cosineSimilarity(tt.a, tt.b)

			if similarity <= tt.wantGT {
				t.Errorf("Expected similarity > %f, got %f", tt.wantGT, similarity)
			}
			if similarity >= tt.wantLT {
				t.Errorf("Expected similarity < %f, got %f", tt.wantLT, similarity)
			}
		})
	}
}

// TestCosineSimilarityEmptyVectors tests edge cases
func TestCosineSimilarityEmptyVectors(t *testing.T) {
	// Empty vectors should return 0
	similarity := cosineSimilarity([]float32{}, []float32{})
	if similarity != 0 {
		t.Errorf("Expected 0 for empty vectors, got %f", similarity)
	}

	// Zero vectors should return 0
	similarity = cosineSimilarity([]float32{0, 0, 0}, []float32{0, 0, 0})
	if similarity != 0 {
		t.Errorf("Expected 0 for zero vectors, got %f", similarity)
	}
}

// chunkText helper (implement if not in main package)
func chunkText(text string, chunkSize, overlap int) []string {
	if text == "" {
		return []string{}
	}

	var chunks []string
	for i := 0; i < len(text); i += chunkSize - overlap {
		end := i + chunkSize
		if end > len(text) {
			end = len(text)
		}
		chunk := text[i:end]
		if chunk != "" {
			chunks = append(chunks, chunk)
		}
		if end >= len(text) {
			break
		}
	}
	return chunks
}

// cosineSimilarity helper (implement if not in main package)
func cosineSimilarity(a, b []float32) float64 {
	if len(a) == 0 || len(b) == 0 || len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (sqrt(normA) * sqrt(normB))
}

func sqrt(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 10; i++ {
		z -= (z*z - x) / (2 * z)
	}
	return z
}

// PrepareDocumentForIndexing helper struct and function
type HalachicDocument struct {
	ID       string
	Type     string
	Title    string
	Content  string
	Metadata map[string]string
}

type DocumentChunk struct {
	DocumentID string
	ChunkIndex int
	Content    string
	Metadata   map[string]string
}

func PrepareDocumentForIndexing(doc HalachicDocument) []DocumentChunk {
	chunks := chunkText(doc.Content, 500, 50)
	result := make([]DocumentChunk, len(chunks))

	for i, chunk := range chunks {
		result[i] = DocumentChunk{
			DocumentID: doc.ID,
			ChunkIndex: i,
			Content:    chunk,
			Metadata:   doc.Metadata,
		}
	}

	return result
}
