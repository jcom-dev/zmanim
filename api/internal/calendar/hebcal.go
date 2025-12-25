// Package calendar provides HebCal integration for Jewish calendar events
package calendar

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// HebCalEvent represents a single event from the HebCal API
type HebCalEvent struct {
	Title    string `json:"title"`
	Category string `json:"category"`
	Subcat   string `json:"subcat,omitempty"`   // "major" or "minor" for holidays
	Hebrew   string `json:"hebrew"`
	Date     string `json:"date"`
	Memo     string `json:"memo,omitempty"`
	YomTov   bool   `json:"yomtov,omitempty"`   // True for days with Yom Tov work restrictions
	HDate    string `json:"hdate,omitempty"`    // Hebrew date (e.g., "1 Tishrei 5785")
}

// HebCalResponse represents the response from the HebCal API
type HebCalResponse struct {
	Title       string         `json:"title"`
	Date        string         `json:"date"`
	Location    HebCalLocation `json:"location,omitempty"`
	Items       []HebCalEvent  `json:"items"`
	HebrewYear  int            `json:"hy,omitempty"`
	HebrewMonth int            `json:"hm,omitempty"`
	HebrewDay   int            `json:"hd,omitempty"`
}

// HebCalLocation represents location info from HebCal
type HebCalLocation struct {
	Title     string  `json:"title"`
	City      string  `json:"city"`
	Tzid      string  `json:"tzid"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	CC        string  `json:"cc"`
}

// TagEventMapping represents a mapping from database
type TagEventMapping struct {
	TagKey   string
	Pattern  string
	Priority int
}

// Client provides HebCal API integration
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new HebCal client
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: "https://www.hebcal.com/hebcal",
	}
}

// IsInIsrael determines if coordinates are within Israel
// Uses approximate bounding box for Israel
func IsInIsrael(lat, lng float64) bool {
	// Approximate Israel bounding box
	return lat >= 29.5 && lat <= 33.3 && lng >= 34.2 && lng <= 35.9
}

// GetEvents fetches Jewish calendar events for a given date and location
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations (lg=a), "sephardi" or "" for Sephardi (default)
func (c *Client) GetEvents(ctx context.Context, date time.Time, lat, lng float64, transliterationStyle string) ([]HebCalEvent, error) {
	isIsrael := IsInIsrael(lat, lng)

	// Build HebCal API URL
	// Parameters:
	// - v=1: API version
	// - cfg=json: JSON response format
	// - year, month, day: specific date
	// - il: Israel mode (true/false)
	// - maj=on: Major holidays
	// - min=on: Minor holidays
	// - mod=on: Modern holidays
	// - nx=on: Rosh Chodesh
	// - mf=on: Minor fasts
	// - ss=on: Special Shabbatot
	// - o=on: Omer count
	// - s=off: No Sedra/Torah reading
	// - c=on: Include candle lighting times
	// - geo=pos: Use position coordinates
	// - latitude, longitude: Location coordinates
	// - lg=a: Ashkenazi transliterations (when transliterationStyle is "ashkenazi")
	url := fmt.Sprintf(
		"%s?v=1&cfg=json&year=%d&month=%d&day=%d&il=%t&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&o=on&s=off&c=on&geo=pos&latitude=%.6f&longitude=%.6f",
		c.baseURL,
		date.Year(),
		int(date.Month()),
		date.Day(),
		isIsrael,
		lat,
		lng,
	)

	// Add language parameter for Ashkenazi transliterations
	if transliterationStyle == "ashkenazi" {
		url += "&lg=a"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hebcal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hebcal returned status %d", resp.StatusCode)
	}

	var result HebCalResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("hebcal decode failed: %w", err)
	}

	// Filter to only events on the requested date
	// HebCal API returns all events for the month when using year/month/day parameters
	targetDateStr := date.Format("2006-01-02")
	var filteredEvents []HebCalEvent
	for _, ev := range result.Items {
		// Parse event date (format: "2025-12-26" or "2025-12-26T15:36:00-00:00")
		eventDateStr := ev.Date
		if len(eventDateStr) >= 10 {
			eventDateStr = eventDateStr[:10] // Take just the YYYY-MM-DD part
		}
		if eventDateStr == targetDateStr {
			filteredEvents = append(filteredEvents, ev)
		}
	}

	return filteredEvents, nil
}

// GetEventsForDateRange fetches events for a date range (useful for week/month views)
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations (lg=a), "sephardi" or "" for Sephardi (default)
func (c *Client) GetEventsForDateRange(ctx context.Context, startDate, endDate time.Time, lat, lng float64, transliterationStyle string) ([]HebCalEvent, error) {
	isIsrael := IsInIsrael(lat, lng)

	url := fmt.Sprintf(
		"%s?v=1&cfg=json&start=%s&end=%s&il=%t&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&o=on&s=off&c=off",
		c.baseURL,
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		isIsrael,
	)

	// Add language parameter for Ashkenazi transliterations
	if transliterationStyle == "ashkenazi" {
		url += "&lg=a"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("hebcal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hebcal returned status %d", resp.StatusCode)
	}

	var result HebCalResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("hebcal decode failed: %w", err)
	}

	return result.Items, nil
}

// MatchEventToTags matches HebCal events against tag patterns
// Returns a list of matched tag keys
func MatchEventToTags(events []HebCalEvent, mappings []TagEventMapping) []string {
	matchedTags := make(map[string]bool)

	for _, event := range events {
		for _, mapping := range mappings {
			if matchPattern(event.Title, mapping.Pattern) {
				matchedTags[mapping.TagKey] = true
			}
		}
	}

	// Convert to slice
	result := make([]string, 0, len(matchedTags))
	for tagKey := range matchedTags {
		result = append(result, tagKey)
	}

	return result
}

// matchPattern supports SQL LIKE-style patterns with % wildcard
func matchPattern(title, pattern string) bool {
	// Exact match
	if title == pattern {
		return true
	}

	// No wildcard - exact match only
	if !strings.Contains(pattern, "%") {
		return title == pattern
	}

	// Handle wildcard patterns
	parts := strings.Split(pattern, "%")

	switch len(parts) {
	case 2:
		// Single wildcard
		if parts[0] == "" {
			// Pattern starts with %: suffix match
			return strings.HasSuffix(title, parts[1])
		}
		if parts[1] == "" {
			// Pattern ends with %: prefix match
			return strings.HasPrefix(title, parts[0])
		}
		// Wildcard in middle: contains both parts in order
		idx := strings.Index(title, parts[0])
		if idx == -1 {
			return false
		}
		return strings.Contains(title[idx+len(parts[0]):], parts[1])
	case 3:
		// Two wildcards: %X% means contains X
		if parts[0] == "" && parts[2] == "" {
			return strings.Contains(title, parts[1])
		}
	}

	// Fallback: simple contains check for the non-wildcard parts
	for _, part := range parts {
		if part != "" && !strings.Contains(title, part) {
			return false
		}
	}
	return true
}

// GetActiveTagsForDate is a convenience method that fetches events and matches them to tags
// transliterationStyle: "ashkenazi" for Ashkenazi transliterations (lg=a), "sephardi" or "" for Sephardi (default)
func (c *Client) GetActiveTagsForDate(ctx context.Context, date time.Time, lat, lng float64, transliterationStyle string, mappings []TagEventMapping) ([]string, error) {
	events, err := c.GetEvents(ctx, date, lat, lng, transliterationStyle)
	if err != nil {
		return nil, err
	}

	tags := MatchEventToTags(events, mappings)

	// Add shabbos tag for every Saturday
	if date.Weekday() == time.Saturday {
		tags = append(tags, "shabbos")
	}

	return tags, nil
}
