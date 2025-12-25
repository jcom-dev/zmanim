package calendar

import (
	"encoding/csv"
	"fmt"
	"io"
	"sort"
	"time"
)

// AuditEvent represents a HebCal event during audit collection
type AuditEvent struct {
	Title       string
	Category    string
	Date        time.Time
	Location    string
	IsIsrael    bool
	HebrewYear  int
	HebrewMonth int
	HebrewDay   int
}

// MatchResult represents the outcome of matching a HebCal event to a tag
type MatchResult struct {
	Title        string
	Category     string
	Date         string
	Location     string
	MatchedTag   string // Empty if no match
	MatchType    string // 'exact', 'group', 'category', or empty
	IsIsrael     bool
	HebrewYear   int
}

// AuditLocation represents a geographic location for audit testing
type AuditLocation struct {
	Name     string
	Lat      float64
	Lng      float64
	IsIsrael bool
}

// EventDeduplicator deduplicates events across multiple dates and locations
type EventDeduplicator struct {
	seen map[string]bool
}

// NewEventDeduplicator creates a new event deduplicator
func NewEventDeduplicator() *EventDeduplicator {
	return &EventDeduplicator{
		seen: make(map[string]bool),
	}
}

// AddEvent adds an event to the deduplicator and returns true if it's a new unique event
// Uniqueness is determined by (Title, Category, Location) - same event on different dates
// is considered the same for deduplication purposes
func (ed *EventDeduplicator) AddEvent(title, category, location string) bool {
	key := fmt.Sprintf("%s|%s|%s", title, category, location)
	if ed.seen[key] {
		return false
	}
	ed.seen[key] = true
	return true
}

// GetUniqueEventCount returns the number of unique events seen
func (ed *EventDeduplicator) GetUniqueEventCount() int {
	return len(ed.seen)
}

// CSVEventWriter writes audit events to CSV format
type CSVEventWriter struct {
	writer *csv.Writer
}

// NewCSVEventWriter creates a new CSV writer for events
func NewCSVEventWriter(w io.Writer) *CSVEventWriter {
	writer := csv.NewWriter(w)
	// Write header
	writer.Write([]string{
		"Title",
		"Category",
		"Date",
		"Location",
		"IsIsrael",
		"HebrewYear",
		"HebrewMonth",
		"HebrewDay",
	})
	writer.Flush()
	return &CSVEventWriter{writer: writer}
}

// WriteEvent writes an audit event to CSV
func (cw *CSVEventWriter) WriteEvent(event AuditEvent) error {
	return cw.writer.Write([]string{
		event.Title,
		event.Category,
		event.Date.Format("2006-01-02"),
		event.Location,
		fmt.Sprintf("%v", event.IsIsrael),
		fmt.Sprintf("%d", event.HebrewYear),
		fmt.Sprintf("%d", event.HebrewMonth),
		fmt.Sprintf("%d", event.HebrewDay),
	})
}

// Flush flushes all buffered data to the writer
func (cw *CSVEventWriter) Flush() error {
	cw.writer.Flush()
	return cw.writer.Error()
}

// CSVMatchResultWriter writes match results to CSV format
type CSVMatchResultWriter struct {
	writer *csv.Writer
}

// NewCSVMatchResultWriter creates a new CSV writer for match results
func NewCSVMatchResultWriter(w io.Writer) *CSVMatchResultWriter {
	writer := csv.NewWriter(w)
	// Write header
	writer.Write([]string{
		"Title",
		"Category",
		"Date",
		"Location",
		"MatchedTag",
		"MatchType",
		"IsIsrael",
		"HebrewYear",
	})
	writer.Flush()
	return &CSVMatchResultWriter{writer: writer}
}

// WriteResult writes a match result to CSV
func (cmw *CSVMatchResultWriter) WriteResult(result MatchResult) error {
	return cmw.writer.Write([]string{
		result.Title,
		result.Category,
		result.Date,
		result.Location,
		result.MatchedTag,
		result.MatchType,
		fmt.Sprintf("%v", result.IsIsrael),
		fmt.Sprintf("%d", result.HebrewYear),
	})
}

// Flush flushes all buffered data to the writer
func (cmw *CSVMatchResultWriter) Flush() error {
	cmw.writer.Flush()
	return cmw.writer.Error()
}

// HebrewYearRange returns a range of Hebrew years for audit testing
func HebrewYearRange(start, end int) []int {
	years := make([]int, 0, end-start+1)
	for year := start; year <= end; year++ {
		years = append(years, year)
	}
	return years
}

// GetAuditLocations returns the standard audit locations
// These locations are chosen to test both Israel and diaspora scenarios
func GetAuditLocations() []AuditLocation {
	return []AuditLocation{
		{
			Name:     "Jerusalem",
			Lat:      31.7683,
			Lng:      35.2137,
			IsIsrael: true,
		},
		{
			Name:     "Salford",
			Lat:      53.4875,
			Lng:      -2.2901,
			IsIsrael: false,
		},
	}
}

// UnmappedEventCollector collects events that don't map to any tags
type UnmappedEventCollector struct {
	events map[string]*UnmappedEventInfo
}

// UnmappedEventInfo tracks information about an unmapped event
type UnmappedEventInfo struct {
	Title        string
	Category     string
	FirstDate    string
	Dates        []string
	Locations    map[string]bool
	IsIsraelSeen map[string]bool // Per location
}

// NewUnmappedEventCollector creates a new unmapped event collector
func NewUnmappedEventCollector() *UnmappedEventCollector {
	return &UnmappedEventCollector{
		events: make(map[string]*UnmappedEventInfo),
	}
}

// AddUnmappedEvent adds an unmapped event to the collection
func (uec *UnmappedEventCollector) AddUnmappedEvent(title, category, dateStr, location string, isIsrael bool) {
	key := fmt.Sprintf("%s|%s", title, category)
	if _, exists := uec.events[key]; !exists {
		uec.events[key] = &UnmappedEventInfo{
			Title:        title,
			Category:     category,
			FirstDate:    dateStr,
			Dates:        []string{dateStr},
			Locations:    make(map[string]bool),
			IsIsraelSeen: make(map[string]bool),
		}
	} else {
		uec.events[key].Dates = append(uec.events[key].Dates, dateStr)
	}
	uec.events[key].Locations[location] = true
	uec.events[key].IsIsraelSeen[location] = isIsrael
}

// GetUnmappedEvents returns all collected unmapped events sorted by frequency
func (uec *UnmappedEventCollector) GetUnmappedEvents() []*UnmappedEventInfo {
	events := make([]*UnmappedEventInfo, 0, len(uec.events))
	for _, event := range uec.events {
		events = append(events, event)
	}

	// Sort by date count (most frequent first)
	sort.Slice(events, func(i, j int) bool {
		if len(events[i].Dates) != len(events[j].Dates) {
			return len(events[i].Dates) > len(events[j].Dates)
		}
		return events[i].Title < events[j].Title
	})

	return events
}

// GetUnmappedEventCount returns the total number of unique unmapped events
func (uec *UnmappedEventCollector) GetUnmappedEventCount() int {
	return len(uec.events)
}

// CoverageSummary provides overall coverage statistics
type CoverageSummary struct {
	TotalUniqueEvents    int
	MappedEvents         int
	UnmappedEvents       int
	MappedPercentage     float64
	UnmappedPercentage   float64
	ByCategory           map[string]*CategoryCoverageSummary
	MultiDayEventResults map[string]*MultiDayEventResult
}

// CategoryCoverageSummary provides coverage statistics for a category
type CategoryCoverageSummary struct {
	Category        string
	Total           int
	Mapped          int
	Unmapped        int
	MappedPercent   float64
	UnmappedPercent float64
}

// MultiDayEventResult tracks coverage for multi-day events like Pesach, Chanukah
type MultiDayEventResult struct {
	EventGroup      string
	DaysExpected    int
	DaysFound       int
	AllMatched      bool
	MatchType       string
	Notes           string
}

// NewCoverageSummary creates a new coverage summary
func NewCoverageSummary() *CoverageSummary {
	return &CoverageSummary{
		ByCategory:           make(map[string]*CategoryCoverageSummary),
		MultiDayEventResults: make(map[string]*MultiDayEventResult),
	}
}

// CalculateCoveragePercentages calculates and stores coverage percentages
func (cs *CoverageSummary) CalculateCoveragePercentages() {
	if cs.TotalUniqueEvents > 0 {
		cs.MappedPercentage = (float64(cs.MappedEvents) / float64(cs.TotalUniqueEvents)) * 100
		cs.UnmappedPercentage = (float64(cs.UnmappedEvents) / float64(cs.TotalUniqueEvents)) * 100
	}

	for _, catSummary := range cs.ByCategory {
		if catSummary.Total > 0 {
			catSummary.MappedPercent = (float64(catSummary.Mapped) / float64(catSummary.Total)) * 100
			catSummary.UnmappedPercent = (float64(catSummary.Unmapped) / float64(catSummary.Total)) * 100
		}
	}
}

// AddOrUpdateCategorySummary adds or updates category summary
func (cs *CoverageSummary) AddOrUpdateCategorySummary(category string, mapped, unmapped int) {
	if catSummary, exists := cs.ByCategory[category]; exists {
		catSummary.Mapped += mapped
		catSummary.Unmapped += unmapped
		catSummary.Total = catSummary.Mapped + catSummary.Unmapped
	} else {
		cs.ByCategory[category] = &CategoryCoverageSummary{
			Category: category,
			Mapped:   mapped,
			Unmapped: unmapped,
			Total:    mapped + unmapped,
		}
	}
}

// UnusedTagInfo represents a tag that exists in the database but was never matched
type UnusedTagInfo struct {
	TagKey             string
	TagID              int
	DisplayNameHebrew  string
	DisplayNameEnglish string
	MatchType          string
	MatchString        string
	MatchPattern       string
	MatchCategory      string
	IsHidden           bool
}
