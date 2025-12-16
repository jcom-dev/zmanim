package ai

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

// Chunk represents a piece of content for embedding
type Chunk struct {
	Content    string            `json:"content"`
	Index      int               `json:"index"`
	Metadata   map[string]string `json:"metadata"`
	TokenCount int               `json:"token_count"`
}

// Chunker splits documents into chunks suitable for embedding
type Chunker struct {
	MaxTokens int // Maximum tokens per chunk (~500)
	Overlap   int // Overlap tokens between chunks (~50)
}

// NewChunker creates a new chunker with default settings
func NewChunker() *Chunker {
	return &Chunker{
		MaxTokens: 500,
		Overlap:   50,
	}
}

// NewChunkerWithOptions creates a chunker with custom settings
func NewChunkerWithOptions(maxTokens, overlap int) *Chunker {
	return &Chunker{
		MaxTokens: maxTokens,
		Overlap:   overlap,
	}
}

// ChunkDocument splits a document into chunks
func (c *Chunker) ChunkDocument(content string, source string, contentType string) []Chunk {
	// Split by markdown headers first
	sections := c.splitByHeaders(content)

	var chunks []Chunk
	chunkIndex := 0

	for _, section := range sections {
		header := section.header
		text := section.content

		// If section is small enough, keep as one chunk
		tokens := c.estimateTokens(text)
		if tokens <= c.MaxTokens {
			chunks = append(chunks, Chunk{
				Content:    text,
				Index:      chunkIndex,
				TokenCount: tokens,
				Metadata: map[string]string{
					"source":       source,
					"content_type": contentType,
					"header":       header,
				},
			})
			chunkIndex++
			continue
		}

		// Split large sections by paragraphs
		paragraphs := c.splitByParagraphs(text)
		var currentChunk strings.Builder
		currentTokens := 0

		for _, para := range paragraphs {
			paraTokens := c.estimateTokens(para)

			// If single paragraph is too large, split by sentences
			if paraTokens > c.MaxTokens {
				if currentChunk.Len() > 0 {
					chunks = append(chunks, Chunk{
						Content:    currentChunk.String(),
						Index:      chunkIndex,
						TokenCount: currentTokens,
						Metadata: map[string]string{
							"source":       source,
							"content_type": contentType,
							"header":       header,
						},
					})
					chunkIndex++
					currentChunk.Reset()
					currentTokens = 0
				}

				// Split paragraph by sentences
				sentenceChunks := c.chunkBySentences(para, header, source, contentType, chunkIndex)
				for _, sc := range sentenceChunks {
					chunks = append(chunks, sc)
					chunkIndex++
				}
				continue
			}

			// Add paragraph to current chunk if it fits
			if currentTokens+paraTokens <= c.MaxTokens {
				if currentChunk.Len() > 0 {
					currentChunk.WriteString("\n\n")
				}
				currentChunk.WriteString(para)
				currentTokens += paraTokens
			} else {
				// Save current chunk and start new one
				if currentChunk.Len() > 0 {
					chunks = append(chunks, Chunk{
						Content:    currentChunk.String(),
						Index:      chunkIndex,
						TokenCount: currentTokens,
						Metadata: map[string]string{
							"source":       source,
							"content_type": contentType,
							"header":       header,
						},
					})
					chunkIndex++
				}

				// Start new chunk with overlap
				currentChunk.Reset()
				overlap := c.getOverlapText(para)
				if overlap != "" {
					currentChunk.WriteString(overlap)
					currentChunk.WriteString("\n\n")
				}
				currentChunk.WriteString(para)
				currentTokens = paraTokens + c.estimateTokens(overlap)
			}
		}

		// Don't forget the last chunk
		if currentChunk.Len() > 0 {
			chunks = append(chunks, Chunk{
				Content:    currentChunk.String(),
				Index:      chunkIndex,
				TokenCount: currentTokens,
				Metadata: map[string]string{
					"source":       source,
					"content_type": contentType,
					"header":       header,
				},
			})
			chunkIndex++
		}
	}

	return chunks
}

// section represents a markdown section
type section struct {
	header  string
	content string
}

// splitByHeaders splits content by markdown headers
func (c *Chunker) splitByHeaders(content string) []section {
	// Match headers (# to ####)
	headerRe := regexp.MustCompile(`(?m)^(#{1,4})\s+(.+)$`)
	matches := headerRe.FindAllStringSubmatchIndex(content, -1)

	if len(matches) == 0 {
		return []section{{header: "", content: content}}
	}

	var sections []section
	lastEnd := 0

	for i, match := range matches {
		// Content before this header (or between headers)
		if match[0] > lastEnd {
			preContent := strings.TrimSpace(content[lastEnd:match[0]])
			if preContent != "" && len(sections) > 0 {
				// Append to previous section
				sections[len(sections)-1].content += "\n\n" + preContent
			} else if preContent != "" {
				sections = append(sections, section{header: "", content: preContent})
			}
		}

		// Extract header text
		headerText := content[match[4]:match[5]]

		// Find end of this section (start of next header or end of content)
		var sectionEnd int
		if i+1 < len(matches) {
			sectionEnd = matches[i+1][0]
		} else {
			sectionEnd = len(content)
		}

		sectionContent := strings.TrimSpace(content[match[1]:sectionEnd])
		sections = append(sections, section{
			header:  headerText,
			content: sectionContent,
		})

		lastEnd = sectionEnd
	}

	return sections
}

// splitByParagraphs splits content by double newlines
func (c *Chunker) splitByParagraphs(content string) []string {
	paragraphs := strings.Split(content, "\n\n")
	var result []string
	for _, p := range paragraphs {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// chunkBySentences splits a large paragraph into sentence-based chunks
// Falls back to line-based splitting for tables and structured content
func (c *Chunker) chunkBySentences(para, header, source, contentType string, startIndex int) []Chunk {
	// For tables (lines starting with |), split by lines instead
	if strings.Contains(para, "\n|") || strings.HasPrefix(para, "|") {
		return c.chunkByLines(para, header, source, contentType, startIndex)
	}

	// Simple sentence splitting (could be improved with NLP library)
	sentenceRe := regexp.MustCompile(`[.!?]\s+`)
	sentences := sentenceRe.Split(para, -1)

	var chunks []Chunk
	var currentChunk strings.Builder
	currentTokens := 0
	chunkIndex := startIndex

	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if sentence == "" {
			continue
		}
		sentence += ". " // Restore period

		sentenceTokens := c.estimateTokens(sentence)

		// If a single sentence exceeds max, split by lines
		if sentenceTokens > c.MaxTokens {
			if currentChunk.Len() > 0 {
				chunks = append(chunks, Chunk{
					Content:    strings.TrimSpace(currentChunk.String()),
					Index:      chunkIndex,
					TokenCount: currentTokens,
					Metadata: map[string]string{
						"source":       source,
						"content_type": contentType,
						"header":       header,
					},
				})
				chunkIndex++
				currentChunk.Reset()
				currentTokens = 0
			}
			// Split the oversized sentence by lines
			lineChunks := c.chunkByLines(sentence, header, source, contentType, chunkIndex)
			for _, lc := range lineChunks {
				chunks = append(chunks, lc)
				chunkIndex++
			}
			continue
		}

		if currentTokens+sentenceTokens <= c.MaxTokens {
			currentChunk.WriteString(sentence)
			currentTokens += sentenceTokens
		} else {
			if currentChunk.Len() > 0 {
				chunks = append(chunks, Chunk{
					Content:    strings.TrimSpace(currentChunk.String()),
					Index:      chunkIndex,
					TokenCount: currentTokens,
					Metadata: map[string]string{
						"source":       source,
						"content_type": contentType,
						"header":       header,
					},
				})
				chunkIndex++
			}
			currentChunk.Reset()
			currentChunk.WriteString(sentence)
			currentTokens = sentenceTokens
		}
	}

	if currentChunk.Len() > 0 {
		chunks = append(chunks, Chunk{
			Content:    strings.TrimSpace(currentChunk.String()),
			Index:      chunkIndex,
			TokenCount: currentTokens,
			Metadata: map[string]string{
				"source":       source,
				"content_type": contentType,
				"header":       header,
			},
		})
	}

	return chunks
}

// chunkByLines splits content by newlines (for tables, code blocks, etc.)
func (c *Chunker) chunkByLines(text, header, source, contentType string, startIndex int) []Chunk {
	lines := strings.Split(text, "\n")

	var chunks []Chunk
	var currentChunk strings.Builder
	currentTokens := 0
	chunkIndex := startIndex

	for _, line := range lines {
		lineTokens := c.estimateTokens(line)

		// If a single line exceeds max, truncate it (rare edge case)
		if lineTokens > c.MaxTokens {
			// Flush current chunk
			if currentChunk.Len() > 0 {
				chunks = append(chunks, Chunk{
					Content:    strings.TrimSpace(currentChunk.String()),
					Index:      chunkIndex,
					TokenCount: currentTokens,
					Metadata: map[string]string{
						"source":       source,
						"content_type": contentType,
						"header":       header,
					},
				})
				chunkIndex++
				currentChunk.Reset()
				currentTokens = 0
			}
			// Truncate the line to fit
			maxChars := c.MaxTokens * 2 // ~2.5 chars per token, be conservative
			if len(line) > maxChars {
				line = line[:maxChars] + "..."
				lineTokens = c.estimateTokens(line)
			}
		}

		if currentTokens+lineTokens <= c.MaxTokens {
			if currentChunk.Len() > 0 {
				currentChunk.WriteString("\n")
			}
			currentChunk.WriteString(line)
			currentTokens += lineTokens
		} else {
			if currentChunk.Len() > 0 {
				chunks = append(chunks, Chunk{
					Content:    strings.TrimSpace(currentChunk.String()),
					Index:      chunkIndex,
					TokenCount: currentTokens,
					Metadata: map[string]string{
						"source":       source,
						"content_type": contentType,
						"header":       header,
					},
				})
				chunkIndex++
			}
			currentChunk.Reset()
			currentChunk.WriteString(line)
			currentTokens = lineTokens
		}
	}

	if currentChunk.Len() > 0 {
		chunks = append(chunks, Chunk{
			Content:    strings.TrimSpace(currentChunk.String()),
			Index:      chunkIndex,
			TokenCount: currentTokens,
			Metadata: map[string]string{
				"source":       source,
				"content_type": contentType,
				"header":       header,
			},
		})
	}

	return chunks
}

// estimateTokens estimates token count conservatively
// Uses ~2.5 chars per token to be safe (tables, code, non-English text tokenize worse)
// OpenAI's text-embedding-3-small has 8192 token limit
func (c *Chunker) estimateTokens(text string) int {
	// For a more accurate count, use tiktoken library
	// Using conservative 2.5 chars/token (not 4) because:
	// - Markdown tables with | characters tokenize poorly
	// - Hebrew/non-Latin text has higher token ratios
	// - Code and special characters add overhead
	charCount := utf8.RuneCountInString(text)
	return (charCount*10 + 24) / 25 // ~2.5 chars per token, round up
}

// getOverlapText gets the last N tokens worth of text for overlap
func (c *Chunker) getOverlapText(text string) string {
	words := strings.Fields(text)
	if len(words) <= c.Overlap {
		return ""
	}

	// Take last ~overlap words
	overlapWords := words[len(words)-c.Overlap:]
	return strings.Join(overlapWords, " ")
}
