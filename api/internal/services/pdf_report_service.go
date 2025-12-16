package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"

	"github.com/jcom-dev/zmanim/internal/calendar"
	"github.com/jcom-dev/zmanim/internal/db"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/dsl"
)

// PDFReportService generates PDF reports for publisher zmanim
type PDFReportService struct {
	db            *db.DB
	zmanimService *UnifiedZmanimService
	cache         *redis.Client
	mapboxAPIKey  string
}

// NewPDFReportService creates a new PDF report service
func NewPDFReportService(database *db.DB, zmanimService *UnifiedZmanimService, cache *redis.Client, mapboxAPIKey string) *PDFReportService {
	return &PDFReportService{
		db:            database,
		zmanimService: zmanimService,
		cache:         cache,
		mapboxAPIKey:  mapboxAPIKey,
	}
}

// ZmanimReportParams contains parameters for generating a zmanim report
type ZmanimReportParams struct {
	PublisherID     int32
	LocalityID      int32
	Date            time.Time
	IncludeGlossary bool
}

// ZmanimReportData contains all data needed to generate a PDF report
type ZmanimReportData struct {
	Publisher         sqlcgen.GetPublisherForReportRow
	Locality          sqlcgen.GetLocalityForReportRow
	EffectiveLocation sqlcgen.GetEffectiveLocalityLocationRow
	Date              time.Time
	Zmanim            []ZmanReportRow
	Primitives        []dsl.PrimitiveDoc
	Functions         []dsl.FunctionDoc
	Bases             []dsl.BaseDoc
	MapImageURL       string
	MapImageData      []byte
}

// PDFZmanTag represents a tag for a zman in the PDF report
type PDFZmanTag struct {
	ID                 int32   `json:"id"`
	TagKey             string  `json:"tag_key"`
	Name               string  `json:"name"`
	DisplayNameHebrew  string  `json:"display_name_hebrew"`
	DisplayNameEnglish string  `json:"display_name_english"`
	TagType            string  `json:"tag_type"`
	Description        *string `json:"description"`
	Color              *string `json:"color"`
	SortOrder          int32   `json:"sort_order"`
	IsNegated          bool    `json:"is_negated"`
	IsModified         bool    `json:"is_modified"`
	SourceIsNegated    *bool   `json:"source_is_negated"`
}

// ZmanReportRow contains data for a single zman in the report
type ZmanReportRow struct {
	Name            string
	HebrewName      string
	CalculatedTime  time.Time
	DSLFormula      string
	Explanation     string
	RoundedTime     string
	HasError        bool
	ErrorMessage    string
	TimeCategory    string
	Tags            []PDFZmanTag
}

// GenerateZmanimReport generates a PDF report for the given parameters
func (s *PDFReportService) GenerateZmanimReport(ctx context.Context, params ZmanimReportParams) ([]byte, error) {
	// Fetch all required data
	data, err := s.fetchReportData(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("fetch report data: %w", err)
	}

	// Build PDF
	pdfBytes, err := s.buildPDF(data, params.IncludeGlossary)
	if err != nil {
		return nil, fmt.Errorf("build PDF: %w", err)
	}

	return pdfBytes, nil
}

// extractReferences extracts @reference keys from formulas
func extractReferences(formulas []string) []string {
	refSet := make(map[string]bool)
	refPattern := regexp.MustCompile(`@([a-zA-Z_][a-zA-Z0-9_]*)`)

	for _, formula := range formulas {
		matches := refPattern.FindAllStringSubmatch(formula, -1)
		for _, match := range matches {
			if len(match) > 1 {
				refSet[match[1]] = true
			}
		}
	}

	refs := make([]string, 0, len(refSet))
	for ref := range refSet {
		refs = append(refs, ref)
	}
	return refs
}

// fetchReportData fetches all data needed for the report
func (s *PDFReportService) fetchReportData(ctx context.Context, params ZmanimReportParams) (*ZmanimReportData, error) {
	// Fetch publisher
	publisher, err := s.db.Queries.GetPublisherForReport(ctx, params.PublisherID)
	if err != nil {
		return nil, fmt.Errorf("get publisher: %w", err)
	}

	// Fetch locality
	locality, err := s.db.Queries.GetLocalityForReport(ctx, params.LocalityID)
	if err != nil {
		return nil, fmt.Errorf("get locality: %w", err)
	}

	// Fetch publisher zmanim
	publisherZmanim, err := s.db.Queries.ListPublisherZmanimForReport(ctx, params.PublisherID)
	if err != nil {
		return nil, fmt.Errorf("list publisher zmanim: %w", err)
	}

	// Load timezone
	tz, err := time.LoadLocation(locality.Timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", locality.Timezone, err)
	}

	// Extract all @references from formulas
	formulas := make([]string, 0, len(publisherZmanim))
	for _, pz := range publisherZmanim {
		formulas = append(formulas, pz.FormulaDsl)
	}
	refKeys := extractReferences(formulas)

	// Fetch reference formulas from master registry
	references := make(map[string]string)
	if len(refKeys) > 0 {
		masterFormulas, err := s.db.Queries.GetMasterZmanimFormulasByKeys(ctx, refKeys)
		if err != nil {
			return nil, fmt.Errorf("get master formulas: %w", err)
		}
		for _, mf := range masterFormulas {
			if mf.DefaultFormulaDsl != nil {
				references[mf.ZmanKey] = *mf.DefaultFormulaDsl
			}
		}
	}

	// Calculate all zman times
	zmanimRows := make([]ZmanReportRow, 0, len(publisherZmanim))
	usedPrimitives := make(map[string]bool)
	usedFunctions := make(map[string]bool)
	usedBases := make(map[string]bool)

	// Get effective location with publisher-specific overrides
	effectiveLocation, err := s.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
		LocalityID:  params.LocalityID,
		PublisherID: pgtype.Int4{Int32: params.PublisherID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("get effective locality location: %w", err)
	}

	lat := effectiveLocation.Latitude
	lon := effectiveLocation.Longitude
	elev := float64(effectiveLocation.ElevationM)

	for _, pz := range publisherZmanim {
		formula := pz.FormulaDsl

		var row ZmanReportRow
		row.Name = pz.EnglishName
		row.HebrewName = pz.HebrewName
		row.DSLFormula = formula
		row.TimeCategory = pz.TimeCategory

		if pz.Description != nil {
			row.Explanation = *pz.Description
		}
		if pz.FormulaExplanation != nil {
			row.Explanation = *pz.FormulaExplanation
		}

		// Parse tags from JSON
		if pz.Tags != nil {
			var tags []PDFZmanTag
			if tagBytes, err := json.Marshal(pz.Tags); err == nil {
				json.Unmarshal(tagBytes, &tags)
				row.Tags = tags
			}
		}

		// Calculate zman time using the formula
		if formula != "" {
			calcResult, err := s.zmanimService.CalculateFormula(ctx, FormulaParams{
				Formula:    formula,
				Date:       params.Date,
				Latitude:   lat,
				Longitude:  lon,
				Elevation:  elev,
				Timezone:   tz,
				References: references,
			})

			if err != nil {
				row.HasError = true
				row.ErrorMessage = err.Error()
			} else {
				row.CalculatedTime = calcResult.Time
				row.RoundedTime = calcResult.Time.Format("3:04 PM")
			}
		} else {
			row.HasError = true
			row.ErrorMessage = "No formula defined"
		}

		zmanimRows = append(zmanimRows, row)

		// Extract primitives, functions, and bases from formula for glossary
		if params.IncludeGlossary && formula != "" {
			extractDSLTokens(formula, usedPrimitives, usedFunctions, usedBases)
		}
	}

	// Build primitives documentation list
	primitiveDocs := make([]dsl.PrimitiveDoc, 0)
	for primName := range usedPrimitives {
		if doc := dsl.GetPrimitiveDoc(primName); doc != nil {
			primitiveDocs = append(primitiveDocs, *doc)
		}
	}

	// Build functions documentation list
	functionDocs := make([]dsl.FunctionDoc, 0)
	for funcName := range usedFunctions {
		if doc := dsl.GetFunctionDoc(funcName); doc != nil {
			functionDocs = append(functionDocs, *doc)
		}
	}

	// Build bases documentation list
	baseDocs := make([]dsl.BaseDoc, 0)
	for baseName := range usedBases {
		if doc := dsl.GetBaseDoc(baseName); doc != nil {
			baseDocs = append(baseDocs, *doc)
		}
	}

	// Generate static map URL and fetch image using effective location coordinates
	var mapImageData []byte
	if s.mapboxAPIKey != "" {
		mapURL := s.generateMapURL(effectiveLocation.Latitude, effectiveLocation.Longitude)
		mapImageData, _ = s.fetchMapImage(ctx, mapURL) // Ignore error - map is optional
	}

	return &ZmanimReportData{
		Publisher:         publisher,
		Locality:          locality,
		EffectiveLocation: effectiveLocation,
		Date:              params.Date,
		Zmanim:            zmanimRows,
		Primitives:        primitiveDocs,
		Functions:         functionDocs,
		Bases:             baseDocs,
		MapImageData:      mapImageData,
	}, nil
}

// buildPDF builds the PDF document using chromedp
func (s *PDFReportService) buildPDF(data *ZmanimReportData, includeGlossary bool) ([]byte, error) {
	// Prepare template data
	templateData := s.prepareTemplateData(data, includeGlossary)

	// Get HTML template
	htmlTemplate := PDFHTMLTemplate()

	// Parse and execute template
	tmpl, err := template.New("pdf").Funcs(template.FuncMap{
		"noescape": func(s string) template.HTML {
			return template.HTML(s)
		},
		"safeURL": func(s string) template.URL {
			return template.URL(s)
		},
	}).Parse(htmlTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse template: %w", err)
	}

	var htmlBuf bytes.Buffer
	if err := tmpl.Execute(&htmlBuf, templateData); err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}

	// Use chromedp to convert HTML to PDF
	// Create an allocator context with options for headless Chrome/Chromium
	allocatorOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.DisableGPU,
		chromedp.NoSandbox, // Required for running in containers
		chromedp.Flag("disable-dev-shm-usage", true), // Avoid /dev/shm issues in containers
	)

	// Check for Chrome/Chromium path in order of preference
	// Prefer google-chrome over chromium-browser (snap) due to file:// protocol sandbox issues
	chromePaths := []string{
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	}
	for _, chromePath := range chromePaths {
		if _, err := os.Stat(chromePath); err == nil {
			allocatorOpts = append(allocatorOpts, chromedp.ExecPath(chromePath))
			break
		}
	}

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), allocatorOpts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Set a timeout for the entire operation
	ctx, cancel2 := context.WithTimeout(ctx, 30*time.Second)
	defer cancel2()

	var pdfBuf []byte
	htmlContent := htmlBuf.String()

	// Write HTML to a temporary file - this ensures data URIs are handled correctly
	// by Chrome when loading the page via file:// protocol
	tmpFile, err := os.CreateTemp("", "zmanim-report-*.html")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.WriteString(htmlContent); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("write temp file: %w", err)
	}
	tmpFile.Close()

	if err := chromedp.Run(ctx,
		chromedp.Navigate("file://"+tmpPath),
		chromedp.Sleep(2*time.Second), // Wait for rendering and fonts to load
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return err
		}),
	); err != nil {
		return nil, fmt.Errorf("chromedp print to PDF: %w", err)
	}

	return pdfBuf, nil
}

// prepareTemplateData prepares the data structure for the HTML template
func (s *PDFReportService) prepareTemplateData(data *ZmanimReportData, includeGlossary bool) map[string]interface{} {
	// Calculate total pages
	totalPages := 1
	hasPrimitives := includeGlossary && len(data.Primitives) > 0
	hasFunctions := includeGlossary && len(data.Functions) > 0
	hasBases := includeGlossary && len(data.Bases) > 0
	if hasBases {
		totalPages++
	}
	if hasPrimitives {
		totalPages++
	}
	if hasFunctions {
		totalPages++
	}

	// Format location display name
	locationName := data.Locality.Name
	if data.Locality.DisplayHierarchy != nil && *data.Locality.DisplayHierarchy != "" {
		locationName = *data.Locality.DisplayHierarchy
	} else if data.Locality.CountryName != "" {
		if data.Locality.RegionName != nil && *data.Locality.RegionName != "" {
			locationName = fmt.Sprintf("%s, %s, %s", data.Locality.Name, *data.Locality.RegionName, data.Locality.CountryName)
		} else {
			locationName = fmt.Sprintf("%s, %s", data.Locality.Name, data.Locality.CountryName)
		}
	}

	// Format coordinates using effective location (includes publisher overrides)
	coordinates := fmt.Sprintf("%.4f°N, %.4f°E", data.EffectiveLocation.Latitude, data.EffectiveLocation.Longitude)

	// Format map image data as base64
	var mapImageBase64 string
	if len(data.MapImageData) > 0 {
		mapImageBase64 = base64.StdEncoding.EncodeToString(data.MapImageData)
	}

	// Prepare zmanim rows with syntax highlighting
	zmanimRows := make([]map[string]interface{}, 0, len(data.Zmanim))
	for _, zman := range data.Zmanim {
		// Separate tags into regular and negated
		regularTags := make([]map[string]interface{}, 0)
		negatedTags := make([]map[string]interface{}, 0)

		for _, tag := range zman.Tags {
			tagMap := map[string]interface{}{
				"DisplayNameEnglish": tag.DisplayNameEnglish,
				"DisplayNameHebrew":  tag.DisplayNameHebrew,
				"TagType":            tag.TagType,
				"IsModified":         tag.IsModified,
			}
			if tag.Color != nil {
				tagMap["Color"] = *tag.Color
			}

			if tag.IsNegated {
				negatedTags = append(negatedTags, tagMap)
			} else {
				regularTags = append(regularTags, tagMap)
			}
		}

		row := map[string]interface{}{
			"Name":                      zman.Name,
			"HebrewName":                zman.HebrewName,
			"DSLFormula":                zman.DSLFormula,
			"FormulaSyntaxHighlighted":  HighlightDSLFormula(zman.DSLFormula),
			"Explanation":               zman.Explanation,
			"RoundedTime":               zman.RoundedTime,
			"CalculatedTime":            zman.CalculatedTime.Format("15:04:05"),
			"HasError":                  zman.HasError,
			"ErrorMessage":              zman.ErrorMessage,
			"TimeCategory":              zman.TimeCategory,
			"CategoryDisplay":           formatCategoryDisplay(zman.TimeCategory),
			"CategoryIcon":              getCategoryIcon(zman.TimeCategory),
			"Tags":                      regularTags,
			"NegatedTags":               negatedTags,
			"HasTags":                   len(regularTags) > 0 || len(negatedTags) > 0,
		}
		zmanimRows = append(zmanimRows, row)
	}

	// Find sunrise and sunset for quick reference
	var sunriseTimes, sunsetTimes map[string]string
	for _, zman := range data.Zmanim {
		if !zman.HasError {
			if strings.Contains(strings.ToLower(zman.Name), "sunrise") && sunriseTimes == nil {
				sunriseTimes = map[string]string{"Sunrise": zman.RoundedTime}
			}
			if strings.Contains(strings.ToLower(zman.Name), "sunset") && sunsetTimes == nil {
				sunsetTimes = map[string]string{"Sunset": zman.RoundedTime}
			}
		}
	}

	// Prepare primitives
	primitives := make([]map[string]interface{}, 0, len(data.Primitives))
	if includeGlossary {
		for _, prim := range data.Primitives {
			primitives = append(primitives, map[string]interface{}{
				"Name":       prim.Name,
				"Definition": prim.Definition,
				"Method":     prim.CalculationMethod,
				"Source":     prim.ScientificSource,
			})
		}
	}

	// Prepare functions
	functions := make([]map[string]interface{}, 0, len(data.Functions))
	if includeGlossary {
		for _, fn := range data.Functions {
			functions = append(functions, map[string]interface{}{
				"Name":       fn.Name,
				"Purpose":    fn.Purpose,
				"Syntax":     fn.Syntax,
				"Parameters": fn.Parameters,
			})
		}
	}

	// Prepare bases (day definitions for proportional times)
	bases := make([]map[string]interface{}, 0, len(data.Bases))
	if includeGlossary {
		for _, base := range data.Bases {
			bases = append(bases, map[string]interface{}{
				"Name":       base.Name,
				"Definition": base.Definition,
				"DayStart":   base.DayStart,
				"DayEnd":     base.DayEnd,
				"Source":     base.Source,
			})
		}
	}

	// Prepare publisher logo data (already base64 encoded in DB)
	var logoData string
	if data.Publisher.LogoData != nil {
		logoData = *data.Publisher.LogoData
	}
	var logoURL string
	if data.Publisher.LogoUrl != nil {
		logoURL = *data.Publisher.LogoUrl
	}

	return map[string]interface{}{
		"Publisher": map[string]interface{}{
			"Name":        data.Publisher.Name,
			"Description": data.Publisher.Description,
			"LogoURL":     logoURL,
			"LogoData":    logoData,
			"IsVerified":  data.Publisher.IsVerified,
			"IsCertified": data.Publisher.IsCertified,
			"IsGlobal":    data.Publisher.IsGlobal,
		},
		"Locality": map[string]interface{}{
			"DisplayName": locationName,
			"Coordinates": coordinates,
			"Elevation":   data.EffectiveLocation.ElevationM,
			"Timezone":    data.Locality.Timezone,
		},
		"Date": map[string]interface{}{
			"Day":        data.Date.Day(),
			"MonthShort": data.Date.Format("Jan"),
			"Full":       data.Date.Format("Monday, January 2, 2006"),
			"Hebrew":     "", // TODO: Add Hebrew date formatting if needed
		},
		"GeneratedAt":   time.Now().Format("Jan 2, 2006 at 3:04 PM MST"),
		"MapImageData":  mapImageBase64,
		"SunTimes":      mergeSunTimes(sunriseTimes, sunsetTimes),
		"Zmanim":        zmanimRows,
		"Bases":         bases,
		"Primitives":    primitives,
		"Functions":     functions,
		"HasGlossary":   includeGlossary && (len(bases) > 0 || len(primitives) > 0 || len(functions) > 0),
		"TotalPages":    totalPages,
	}
}

// formatCategoryDisplay formats the category for display
func formatCategoryDisplay(category string) string {
	switch category {
	case "alos":
		return "Dawn"
	case "dawn":
		return "Dawn"
	case "shema":
		return "Shema"
	case "tefilla":
		return "Prayer"
	case "chatzos":
		return "Midday"
	case "midday":
		return "Midday"
	case "mincha":
		return "Afternoon"
	case "afternoon":
		return "Afternoon"
	case "tzais":
		return "Nightfall"
	case "nightfall":
		return "Nightfall"
	case "sunrise":
		return "Sunrise"
	case "sunset":
		return "Sunset"
	case "morning":
		return "Morning"
	case "midnight":
		return "Midnight"
	default:
		return ""
	}
}

// getCategoryIcon returns an emoji icon for the category
func getCategoryIcon(category string) string {
	switch category {
	case "alos", "dawn":
		return "🌅"
	case "shema":
		return "📖"
	case "tefilla":
		return "🙏"
	case "chatzos", "midday":
		return "☀️"
	case "mincha", "afternoon":
		return "🌤️"
	case "tzais", "nightfall":
		return "🌙"
	case "sunrise":
		return "🌅"
	case "sunset":
		return "🌇"
	case "morning":
		return "🌤️"
	case "midnight":
		return "🌑"
	default:
		return ""
	}
}

// mergeSunTimes merges sunrise and sunset times into a single map
func mergeSunTimes(sunrise, sunset map[string]string) map[string]string {
	if sunrise == nil && sunset == nil {
		return nil
	}
	result := make(map[string]string)
	if sunrise != nil {
		for k, v := range sunrise {
			result[k] = v
		}
	}
	if sunset != nil {
		for k, v := range sunset {
			result[k] = v
		}
	}
	return result
}

// generateMapURL generates a Mapbox static map URL
func (s *PDFReportService) generateMapURL(lat, lon float64) string {
	// Mapbox Static Images API
	// Zoom 14 shows street names clearly, 300x300@2x creates 600x600 image (square, no white space)
	return fmt.Sprintf(
		"https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-l-marker+FF0000(%.6f,%.6f)/%.6f,%.6f,14/300x300@2x?access_token=%s",
		lon, lat, lon, lat, s.mapboxAPIKey,
	)
}

// fetchMapImage fetches the map image from Mapbox
func (s *PDFReportService) fetchMapImage(ctx context.Context, mapURL string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mapURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("map fetch failed: %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// extractDSLTokens extracts primitive and function names from a DSL formula
func extractDSLTokens(formula string, primitives, functions, bases map[string]bool) {
	// Known primitives
	knownPrimitives := []string{
		"visible_sunrise", "visible_sunset",
		"geometric_sunrise", "geometric_sunset",
		"solar_noon", "solar_midnight",
		"civil_dawn", "civil_dusk",
		"nautical_dawn", "nautical_dusk",
		"astronomical_dawn", "astronomical_dusk",
	}

	// Known functions
	knownFunctions := []string{
		"solar", "seasonal_solar",
		"proportional_hours", "proportional_minutes",
		"midpoint", "first_valid",
		"earlier_of", "later_of",
	}

	// Known bases for proportional times
	knownBases := []string{
		"gra", "mga", "mga_72", "mga_60", "mga_90", "mga_96", "mga_120",
		"mga_72_zmanis", "mga_90_zmanis", "mga_96_zmanis",
		"mga_16_1", "mga_18", "mga_19_8", "mga_26",
		"baal_hatanya",
	}

	formulaLower := strings.ToLower(formula)

	for _, prim := range knownPrimitives {
		if strings.Contains(formulaLower, prim) {
			primitives[prim] = true
		}
	}

	for _, fn := range knownFunctions {
		if strings.Contains(formulaLower, fn+"(") {
			functions[fn] = true
		}
	}

	// Extract bases - look for them as function arguments
	for _, base := range knownBases {
		// Match base as a word boundary (not part of another word)
		// Check for patterns like ", gra)" or "(3, gra)" or "gra)"
		if strings.Contains(formulaLower, ", "+base+")") ||
			strings.Contains(formulaLower, ","+base+")") ||
			strings.Contains(formulaLower, ", "+base+",") ||
			strings.Contains(formulaLower, "("+base+")") {
			bases[base] = true
		}
	}

	// Check for arithmetic operators
	if strings.Contains(formula, "+") {
		functions["+"] = true
	}
	if strings.Contains(formula, "-") && !strings.HasPrefix(formula, "-") {
		functions["-"] = true
	}
}

// SanitizeFilename creates a safe filename from a string
func SanitizeFilename(s string) string {
	// Replace spaces with underscores
	s = strings.ReplaceAll(s, " ", "_")
	// Remove special characters
	reg := regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	s = reg.ReplaceAllString(s, "")
	return s
}

// GenerateReportFilename generates a filename for the PDF report
func GenerateReportFilename(publisherName, localityName, date string) string {
	return fmt.Sprintf("%s_zmanim_%s_%s.pdf",
		SanitizeFilename(publisherName),
		SanitizeFilename(localityName),
		date,
	)
}

// WeeklyCalendarParams contains parameters for generating a weekly calendar PDF
type WeeklyCalendarParams struct {
	PublisherID     int32
	LocalityID      int32
	StartDate       time.Time // Must be a Sunday
	Language        string    // "en" for English, "he" for Hebrew
	IncludeDraft    bool
	IncludeOptional bool
	IncludeHidden   bool
	IncludeEvents   bool // Include event zmanim (candle lighting, havdalah, etc.)
}

// WeeklyCalendarData contains all data needed to generate a weekly calendar PDF
type WeeklyCalendarData struct {
	Publisher    PublisherInfo
	Location     LocationInfo
	WeekRange    string
	Days         []DayData
	GeneratedAt  string
}

// PublisherInfo contains publisher information for the calendar
type PublisherInfo struct {
	Name       string
	HebrewName string
}

// LocationInfo contains location information for the calendar
type LocationInfo struct {
	Name        string
	Coordinates string
	Elevation   int32
	Timezone    string
}

// DayData contains data for a single day in the weekly calendar
type DayData struct {
	Date           time.Time
	DayOfWeek      string
	HebrewDayName  string
	HebrewDateNum  string
	GregorianDay   int
	IsShabbat      bool
	IsFriday       bool
	CSSClass       string
	ZmanimColumns  [][]ZmanItem
	EventZmanim    []ZmanItem // Event zmanim (candle lighting, havdalah, fast times) displayed at bottom
	SpecialTimes   []SpecialTime
}

// ZmanItem represents a single zman time entry
type ZmanItem struct {
	Name string
	Time string
}

// SpecialTime represents special times like candle lighting or havdalah
type SpecialTime struct {
	Label string
	Time  string
}

// GenerateWeeklyCalendarPDF generates a weekly calendar PDF for the given parameters
func (s *PDFReportService) GenerateWeeklyCalendarPDF(ctx context.Context, params WeeklyCalendarParams) ([]byte, error) {
	// Validate start date is a Sunday
	if params.StartDate.Weekday() != time.Sunday {
		return nil, fmt.Errorf("start_date must be a Sunday, got %s", params.StartDate.Weekday())
	}

	// Fetch publisher info
	publisher, err := s.db.Queries.GetPublisherForReport(ctx, params.PublisherID)
	if err != nil {
		return nil, fmt.Errorf("get publisher: %w", err)
	}

	// Fetch locality info
	locality, err := s.db.Queries.GetLocalityForReport(ctx, params.LocalityID)
	if err != nil {
		return nil, fmt.Errorf("get locality: %w", err)
	}

	// Get effective location with publisher-specific overrides
	effectiveLocation, err := s.db.Queries.GetEffectiveLocalityLocation(ctx, sqlcgen.GetEffectiveLocalityLocationParams{
		LocalityID:  params.LocalityID,
		PublisherID: pgtype.Int4{Int32: params.PublisherID, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("get effective locality location: %w", err)
	}

	// Fetch publisher zmanim based on filters
	publisherZmanim, err := s.fetchFilteredZmanim(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("fetch zmanim: %w", err)
	}

	// Load timezone
	tz, err := time.LoadLocation(locality.Timezone)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", locality.Timezone, err)
	}

	// Calculate 7 days of zmanim
	days := make([]DayData, 7)
	for i := 0; i < 7; i++ {
		date := params.StartDate.AddDate(0, 0, i)
		dayData, err := s.calculateDayZmanim(ctx, date, publisherZmanim, effectiveLocation, tz, params.IncludeEvents, params.Language)
		if err != nil {
			return nil, fmt.Errorf("calculate day %d zmanim: %w", i, err)
		}
		days[i] = dayData
	}

	// Build calendar data
	calendarData := s.buildCalendarData(publisher, locality, effectiveLocation, days, params.StartDate)

	// Generate PDF
	pdfBytes, err := s.buildWeeklyCalendarPDF(calendarData)
	if err != nil {
		return nil, fmt.Errorf("build PDF: %w", err)
	}

	return pdfBytes, nil
}

// fetchFilteredZmanim fetches zmanim based on the filter parameters
func (s *PDFReportService) fetchFilteredZmanim(ctx context.Context, params WeeklyCalendarParams) ([]sqlcgen.ListPublisherZmanimForReportRow, error) {
	// Get all zmanim for the publisher
	// Note: ListPublisherZmanimForReport already fetches published zmanim
	// Additional filtering based on params can be implemented later if needed
	allZmanim, err := s.db.Queries.ListPublisherZmanimForReport(ctx, params.PublisherID)
	if err != nil {
		return nil, err
	}

	// For now, use all returned zmanim
	// The query already handles the main filtering (published zmanim)
	// Future enhancement: Add support for IncludeDraft, IncludeOptional, IncludeHidden
	// by modifying the SQL query or adding additional filtering here

	return allZmanim, nil
}

// calculateDayZmanim calculates all zmanim for a single day
func (s *PDFReportService) calculateDayZmanim(
	ctx context.Context,
	date time.Time,
	publisherZmanim []sqlcgen.ListPublisherZmanimForReportRow,
	effectiveLocation sqlcgen.GetEffectiveLocalityLocationRow,
	tz *time.Location,
	includeEvents bool,
	language string,
) (DayData, error) {
	dayData := DayData{
		Date:          date,
		DayOfWeek:     date.Format("Monday"),
		GregorianDay:  date.Day(),
		IsShabbat:     date.Weekday() == time.Saturday,
		IsFriday:      date.Weekday() == time.Friday,
	}

	// Set CSS class for each day of the week (for colorful styling)
	dayClasses := map[time.Weekday]string{
		time.Sunday:    "sunday",
		time.Monday:    "monday",
		time.Tuesday:   "tuesday",
		time.Wednesday: "wednesday",
		time.Thursday:  "thursday",
		time.Friday:    "friday",
		time.Saturday:  "shabbos",
	}
	dayData.CSSClass = dayClasses[date.Weekday()]

	// Set Hebrew day name (basic implementation - can be enhanced)
	hebrewDays := map[time.Weekday]string{
		time.Sunday:    "יום ראשון",
		time.Monday:    "יום שני",
		time.Tuesday:   "יום שלישי",
		time.Wednesday: "יום רביעי",
		time.Thursday:  "יום חמישי",
		time.Friday:    "יום ששי",
		time.Saturday:  "שבת קודש",
	}
	dayData.HebrewDayName = hebrewDays[date.Weekday()]

	// Get calendar context to determine which event zmanim to show
	calService := calendar.NewCalendarService()
	lat := effectiveLocation.Latitude
	lon := effectiveLocation.Longitude
	loc := calendar.Location{
		Latitude:  lat,
		Longitude: lon,
		Timezone:  tz.String(),
		IsIsrael:  calendar.IsLocationInIsrael(lat, lon),
	}
	zmanimCtx := calService.GetZmanimContext(date, loc)

	// Extract all @references from formulas
	formulas := make([]string, 0, len(publisherZmanim))
	for _, pz := range publisherZmanim {
		formulas = append(formulas, pz.FormulaDsl)
	}
	refKeys := extractReferences(formulas)

	// Fetch reference formulas from master registry
	references := make(map[string]string)
	if len(refKeys) > 0 {
		masterFormulas, err := s.db.Queries.GetMasterZmanimFormulasByKeys(ctx, refKeys)
		if err != nil {
			return dayData, fmt.Errorf("get master formulas: %w", err)
		}
		for _, mf := range masterFormulas {
			if mf.DefaultFormulaDsl != nil {
				references[mf.ZmanKey] = *mf.DefaultFormulaDsl
			}
		}
	}

	// Calculate all zman times, separating regular zmanim from event zmanim
	zmanimItems := make([]ZmanItem, 0, len(publisherZmanim))
	eventZmanimItems := make([]ZmanItem, 0)           // Event zmanim displayed at bottom
	eventZmanimLookup := make(map[string]string)      // zman_key -> formatted time (for SpecialTimes lookup)
	elev := float64(effectiveLocation.ElevationM)

	for _, pz := range publisherZmanim {
		formula := pz.FormulaDsl
		if formula == "" {
			continue
		}

		// Calculate zman time
		calcResult, err := s.zmanimService.CalculateFormula(ctx, FormulaParams{
			Formula:    formula,
			Date:       date,
			Latitude:   lat,
			Longitude:  lon,
			Elevation:  elev,
			Timezone:   tz,
			References: references,
		})

		if err != nil {
			continue
		}

		formattedTime := calcResult.Time.Format("3:04 PM")

		// Select display name based on language preference
		displayName := pz.EnglishName
		if language == "he" && pz.HebrewName != "" {
			displayName = pz.HebrewName
		}

		// Check if this is an event zman
		if pz.IsEventZman {
			// Check if this event zman should be shown today based on its tags
			if !shouldShowEventZman(pz, zmanimCtx) {
				continue
			}

			// Store event zmanim separately for bottom display
			eventZmanimLookup[pz.ZmanKey] = formattedTime
			if includeEvents {
				eventZmanimItems = append(eventZmanimItems, ZmanItem{
					Name: displayName,
					Time: formattedTime,
				})
			}
		} else {
			zmanimItems = append(zmanimItems, ZmanItem{
				Name: displayName,
				Time: formattedTime,
			})
		}
	}

	// Organize zmanim into columns (3 columns for better layout)
	numColumns := 3
	itemsPerColumn := (len(zmanimItems) + numColumns - 1) / numColumns
	columns := make([][]ZmanItem, numColumns)

	for i := 0; i < numColumns; i++ {
		start := i * itemsPerColumn
		end := start + itemsPerColumn
		if end > len(zmanimItems) {
			end = len(zmanimItems)
		}
		if start < len(zmanimItems) {
			columns[i] = zmanimItems[start:end]
		}
	}
	dayData.ZmanimColumns = columns
	dayData.EventZmanim = eventZmanimItems

	// Add special times for Friday/Shabbos using actual calculated event zmanim
	// Use Hebrew labels when language is "he"
	candleLabel := "🕯️ Candles"
	havdalahLabel := "⭐ Havdalah"
	if language == "he" {
		candleLabel = "🕯️ הדלקת נרות"
		havdalahLabel = "⭐ הבדלה"
	}

	if dayData.IsFriday {
		// Look for candle lighting time
		candleTime := findEventTime(eventZmanimLookup, "candle_lighting", "hadlakas_neiros")
		if candleTime != "" {
			dayData.SpecialTimes = append(dayData.SpecialTimes, SpecialTime{
				Label: candleLabel,
				Time:  candleTime,
			})
		}
	}
	if dayData.IsShabbat {
		// Look for havdalah time
		havdalahTime := findEventTime(eventZmanimLookup, "shabbos_ends", "havdalah", "tzeis")
		if havdalahTime != "" {
			dayData.SpecialTimes = append(dayData.SpecialTimes, SpecialTime{
				Label: havdalahLabel,
				Time:  havdalahTime,
			})
		}
	}

	return dayData, nil
}

// shouldShowEventZman checks if an event zman should be shown on a given day
// based on its category tags and the calendar context
func shouldShowEventZman(pz sqlcgen.ListPublisherZmanimForReportRow, ctx calendar.ZmanimContext) bool {
	// Parse tags from the zman to check for category restrictions
	tags := parseZmanTags(pz.Tags)

	for _, tag := range tags {
		switch tag.TagKey {
		case "category_candle_lighting":
			if !ctx.ShowCandleLighting && !ctx.ShowCandleLightingSheni {
				return false
			}
		case "category_havdalah":
			if !ctx.ShowShabbosYomTovEnds {
				return false
			}
		case "category_fast_start":
			if !ctx.ShowFastStarts {
				return false
			}
		case "category_fast_end":
			if !ctx.ShowFastEnds {
				return false
			}
		}
	}

	return true
}

// parseZmanTags parses the JSON tags from a zman row
func parseZmanTags(tagsInterface interface{}) []PDFZmanTag {
	if tagsInterface == nil {
		return nil
	}

	// Try to convert to JSON bytes and unmarshal
	var tags []PDFZmanTag
	switch v := tagsInterface.(type) {
	case []byte:
		if err := json.Unmarshal(v, &tags); err != nil {
			return nil
		}
	case string:
		if err := json.Unmarshal([]byte(v), &tags); err != nil {
			return nil
		}
	default:
		// Try JSON encoding then decoding
		data, err := json.Marshal(v)
		if err != nil {
			return nil
		}
		if err := json.Unmarshal(data, &tags); err != nil {
			return nil
		}
	}
	return tags
}

// findEventTime searches for an event time by checking multiple possible zman keys
func findEventTime(eventZmanim map[string]string, keys ...string) string {
	for _, key := range keys {
		// Check exact match
		if t, ok := eventZmanim[key]; ok {
			return t
		}
		// Check keys that contain this substring
		for zmKey, t := range eventZmanim {
			if strings.Contains(strings.ToLower(zmKey), strings.ToLower(key)) {
				return t
			}
		}
	}
	return ""
}

// buildCalendarData builds the template data structure
func (s *PDFReportService) buildCalendarData(
	publisher sqlcgen.GetPublisherForReportRow,
	locality sqlcgen.GetLocalityForReportRow,
	effectiveLocation sqlcgen.GetEffectiveLocalityLocationRow,
	days []DayData,
	startDate time.Time,
) *WeeklyCalendarData {
	// Format week range
	endDate := startDate.AddDate(0, 0, 6)
	weekRange := fmt.Sprintf("%s - %s",
		startDate.Format("January 2"),
		endDate.Format("January 2, 2006"),
	)

	// Format location name
	locationName := locality.Name
	if locality.DisplayHierarchy != nil && *locality.DisplayHierarchy != "" {
		locationName = *locality.DisplayHierarchy
	}

	// Format coordinates
	coordinates := fmt.Sprintf("%.4f°N, %.4f°E", effectiveLocation.Latitude, effectiveLocation.Longitude)

	return &WeeklyCalendarData{
		Publisher: PublisherInfo{
			Name:       publisher.Name,
			HebrewName: "", // TODO: Add Hebrew name if available
		},
		Location: LocationInfo{
			Name:        locationName,
			Coordinates: coordinates,
			Elevation:   effectiveLocation.ElevationM,
			Timezone:    locality.Timezone,
		},
		WeekRange:   weekRange,
		Days:        days,
		GeneratedAt: time.Now().Format("Jan 2, 2006 at 3:04 PM MST"),
	}
}

// buildWeeklyCalendarPDF builds the PDF document using chromedp
func (s *PDFReportService) buildWeeklyCalendarPDF(data *WeeklyCalendarData) ([]byte, error) {
	// Get HTML template
	htmlTemplate := PDFWeeklyCalendarTemplate()

	// Parse and execute template
	tmpl, err := template.New("weekly-calendar").Parse(htmlTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse template: %w", err)
	}

	var htmlBuf bytes.Buffer
	if err := tmpl.Execute(&htmlBuf, data); err != nil {
		return nil, fmt.Errorf("execute template: %w", err)
	}

	// Use chromedp to convert HTML to PDF
	allocatorOpts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.DisableGPU,
		chromedp.NoSandbox,
		chromedp.Flag("disable-dev-shm-usage", true),
	)

	// Check for Chrome/Chromium path in order of preference
	// Prefer google-chrome over chromium-browser (snap) due to file:// protocol sandbox issues
	chromePaths := []string{
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	}
	for _, chromePath := range chromePaths {
		if _, err := os.Stat(chromePath); err == nil {
			allocatorOpts = append(allocatorOpts, chromedp.ExecPath(chromePath))
			break
		}
	}

	allocCtx, allocCancel := chromedp.NewExecAllocator(context.Background(), allocatorOpts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	// Set a timeout for the entire operation
	ctx, cancel2 := context.WithTimeout(ctx, 30*time.Second)
	defer cancel2()

	var pdfBuf []byte
	htmlContent := htmlBuf.String()

	// Write HTML to a temporary file
	tmpFile, err := os.CreateTemp("", "weekly-calendar-*.html")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.WriteString(htmlContent); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("write temp file: %w", err)
	}
	tmpFile.Close()

	if err := chromedp.Run(ctx,
		chromedp.Navigate("file://"+tmpPath),
		chromedp.Sleep(2*time.Second), // Wait for rendering and fonts to load
		chromedp.ActionFunc(func(ctx context.Context) error {
			var err error
			pdfBuf, _, err = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				Do(ctx)
			return err
		}),
	); err != nil {
		return nil, fmt.Errorf("chromedp print to PDF: %w", err)
	}

	return pdfBuf, nil
}

// Ensure PDFReportService implements interface
var _ interface {
	GenerateZmanimReport(ctx context.Context, params ZmanimReportParams) ([]byte, error)
	GenerateWeeklyCalendarPDF(ctx context.Context, params WeeklyCalendarParams) ([]byte, error)
} = (*PDFReportService)(nil)

// Helper to read bytes from reader
func readBytes(r io.Reader) ([]byte, error) {
	var buf bytes.Buffer
	_, err := buf.ReadFrom(r)
	return buf.Bytes(), err
}
