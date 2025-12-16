package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// ClaudeService provides Claude AI integration for formula generation
type ClaudeService struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewClaudeService creates a new Claude service
func NewClaudeService(apiKey string) *ClaudeService {
	return &ClaudeService{
		apiKey: apiKey,
		model:  "claude-sonnet-4-20250514",
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// GenerationResult represents the result of formula generation
type GenerationResult struct {
	Formula    string  `json:"formula"`
	Confidence float64 `json:"confidence"`
	TokensUsed int     `json:"tokens_used"`
}

// ExplainResult represents the result of formula explanation
type ExplainResult struct {
	Explanation string `json:"explanation"`
	Source      string `json:"source"`
	Language    string `json:"language"`
}

// Claude API request/response structures
type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system,omitempty"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	StopReason string `json:"stop_reason"`
}

// System prompt for formula generation
const formulaSystemPrompt = `You are an expert in zmanim calculations and the Zmanim DSL language.

## DSL Syntax Reference

Primitives: sunrise, sunset, solar_noon, midnight, civil_dawn, civil_dusk, alos_hashachar, misheyakir, tzeis_hakochavim, bein_hashmashos

Functions:
- solar(degrees, direction) - Solar angle calculation. Direction: before_sunrise or after_sunset
- proportional_hours(hours, base) - Proportional hours. Base: gra (sunrise to sunset) or mga (dawn to nightfall)
- midpoint(time1, time2) - Middle point between two times

Operators: + and - for adding/subtracting durations (e.g., sunrise - 72min)

Durations: Nmin (minutes), Nh or Nhr (hours)

References: @zman_key to reference another zman

## Instructions

1. Generate a syntactically valid DSL formula based on the user's request
2. Return ONLY the formula wrapped in triple backticks
3. If ambiguous, use common halachic practice
4. If impossible to express in DSL, respond with "UNSUPPORTED: <reason>"

## Examples

Request: "72 minutes before sunrise"
Response: ` + "```" + `
sunrise - 72min
` + "```" + `

Request: "When sun is 16.1 degrees below horizon before sunrise"
Response: ` + "```" + `
solar(16.1, before_sunrise)
` + "```" + `

Request: "3 proportional hours after sunrise using GRA"
Response: ` + "```" + `
proportional_hours(3, gra)
` + "```" + ``

// GenerateFormula generates a DSL formula from a natural language description
func (s *ClaudeService) GenerateFormula(ctx context.Context, request string, ragContext string) (*GenerationResult, error) {
	systemPrompt := formulaSystemPrompt
	if ragContext != "" {
		systemPrompt += "\n\n## Additional Context\n\n" + ragContext
	}

	reqBody := claudeRequest{
		Model:     s.model,
		MaxTokens: 256,
		System:    systemPrompt,
		Messages: []claudeMessage{
			{Role: "user", Content: request},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Claude API error: status %d", resp.StatusCode)
	}

	var claudeResp claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return nil, errors.New("no content in response")
	}

	responseText := claudeResp.Content[0].Text
	formula := extractFormula(responseText)
	confidence := estimateConfidence(responseText)

	return &GenerationResult{
		Formula:    formula,
		Confidence: confidence,
		TokensUsed: claudeResp.Usage.InputTokens + claudeResp.Usage.OutputTokens,
	}, nil
}

// GenerateWithValidation generates a formula with automatic validation and retry
func (s *ClaudeService) GenerateWithValidation(ctx context.Context, request string, ragContext string, validateFn func(string) error) (*GenerationResult, error) {
	maxRetries := 2
	var lastErr error

	for i := 0; i <= maxRetries; i++ {
		result, err := s.GenerateFormula(ctx, request, ragContext)
		if err != nil {
			lastErr = err
			continue
		}

		// Check for unsupported
		if strings.HasPrefix(result.Formula, "UNSUPPORTED:") {
			return nil, errors.New(result.Formula)
		}

		// Validate formula
		if validateFn != nil {
			validationErr := validateFn(result.Formula)
			if validationErr == nil {
				return result, nil
			}

			if i < maxRetries {
				// Retry with error context
				request = fmt.Sprintf(`Previous attempt generated invalid formula:
Formula: %s
Error: %s

Please correct the formula and try again.

Original request: %s`, result.Formula, validationErr, request)
				lastErr = validationErr
				continue
			}
		} else {
			return result, nil
		}
	}

	return nil, fmt.Errorf("failed to generate valid formula after retries: %v", lastErr)
}

// ExplainFormula generates a human-readable explanation of a formula
func (s *ClaudeService) ExplainFormula(ctx context.Context, formula string, language string, ragContext string) (*ExplainResult, error) {
	var systemPrompt string
	switch language {
	case "he":
		// Full Hebrew - concise, no formatting
		systemPrompt = `הסבר קצר לתלמיד חכם. 2-3 משפטים בלבד.

כללים:
- ללא כותרות, ללא **bold**, ללא עיצוב
- טקסט רציף בלבד
- השתמש בקיצורים: נה"ח, עה"ש, צה"כ, שעו"ז
- ציין שיטה ומקור אם ידוע

דוגמא: "72 דקות לפני נה"ח לפי שיטת המג"א (שו"ע או"ח רל"ג). חישוב קבוע ללא תלות באורך היום."`
	case "mixed":
		// English sentences with Hebrew terms - for talmidei chachamim
		systemPrompt = `Explain to a talmid chacham. 2-3 sentences only. Plain text, no markdown, no bold, no headers.

Use Hebrew script for Jewish terms: נץ, שקיעה, עה"ש, צה"כ, שעו"ז, גר"א, מג"א, ר"ת, שו"ע, מ"ב.
Cite sources in Hebrew (שו"ע או"ח, פסחים, etc.)

Example: "72 minutes before נץ per the מג"א (שו"ע או"ח רל"ג). Fixed offset regardless of day length."`
	default:
		// Pure English with transliterated terms
		systemPrompt = `Explain to a talmid chacham. 2-3 sentences only. Plain text, no markdown, no bold, no headers.

Use transliterated terms: netz, shkia, alos, tzeis, sha'os zemanios.
Cite sources when relevant (Pesachim, Shabbos 34b, Shulchan Aruch OC, etc.)

Example: "72 minutes before netz per the Magen Avraham (SA OC 233). Fixed offset regardless of day length."`
	}

	// Add RAG context if available
	if ragContext != "" {
		systemPrompt += "\n\n## Reference Material\n\n" + ragContext
	}

	reqBody := claudeRequest{
		Model:     s.model,
		MaxTokens: 300,
		System:    systemPrompt,
		Messages: []claudeMessage{
			{Role: "user", Content: fmt.Sprintf("Explain this zman calculation: %s", formula)},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Claude API error: status %d", resp.StatusCode)
	}

	var claudeResp claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&claudeResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(claudeResp.Content) == 0 {
		return nil, errors.New("no content in response")
	}

	return &ExplainResult{
		Explanation: claudeResp.Content[0].Text,
		Source:      "ai",
		Language:    language,
	}, nil
}

// extractFormula extracts the formula from Claude's response
func extractFormula(response string) string {
	// Look for formula in code blocks
	codeBlockRe := regexp.MustCompile("```(?:dsl)?\\s*([^`]+)\\s*```")
	matches := codeBlockRe.FindStringSubmatch(response)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}

	// Check for UNSUPPORTED
	if strings.Contains(response, "UNSUPPORTED:") {
		idx := strings.Index(response, "UNSUPPORTED:")
		return strings.TrimSpace(response[idx:])
	}

	// Return trimmed response as fallback
	return strings.TrimSpace(response)
}

// estimateConfidence estimates confidence based on response characteristics
func estimateConfidence(response string) float64 {
	// Simple heuristic based on response format
	if strings.Contains(response, "```") {
		return 0.9 // High confidence if properly formatted
	}
	if strings.Contains(response, "UNSUPPORTED") {
		return 0.0
	}
	return 0.7 // Medium confidence otherwise
}
