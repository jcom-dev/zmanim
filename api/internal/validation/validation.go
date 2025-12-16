// Package validation provides input validation utilities for the Shtetl Zmanim API.
// Includes validators for common types like coordinates, UUIDs, dates, and strings.
package validation

import (
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// ValidationError represents a validation failure
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors is a collection of validation errors
type ValidationErrors []ValidationError

func (e ValidationErrors) Error() string {
	if len(e) == 0 {
		return "no validation errors"
	}
	var msgs []string
	for _, err := range e {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

// HasErrors returns true if there are any validation errors
func (e ValidationErrors) HasErrors() bool {
	return len(e) > 0
}

// Add adds a validation error
func (e *ValidationErrors) Add(field, message, code string) {
	*e = append(*e, ValidationError{
		Field:   field,
		Message: message,
		Code:    code,
	})
}

// =============================================================================
// Validator
// =============================================================================

// Validator provides chainable validation
type Validator struct {
	errors ValidationErrors
}

// New creates a new validator
func New() *Validator {
	return &Validator{}
}

// Errors returns all validation errors
func (v *Validator) Errors() ValidationErrors {
	return v.errors
}

// HasErrors returns true if validation failed
func (v *Validator) HasErrors() bool {
	return len(v.errors) > 0
}

// =============================================================================
// String Validation
// =============================================================================

// RequiredString validates that a string is not empty
func (v *Validator) RequiredString(field, value string) *Validator {
	if strings.TrimSpace(value) == "" {
		v.errors.Add(field, "is required", "required")
	}
	return v
}

// MinLength validates minimum string length
func (v *Validator) MinLength(field, value string, min int) *Validator {
	if utf8.RuneCountInString(value) < min {
		v.errors.Add(field, fmt.Sprintf("must be at least %d characters", min), "min_length")
	}
	return v
}

// MaxLength validates maximum string length
func (v *Validator) MaxLength(field, value string, max int) *Validator {
	if utf8.RuneCountInString(value) > max {
		v.errors.Add(field, fmt.Sprintf("must be at most %d characters", max), "max_length")
	}
	return v
}

// StringLength validates string length is within bounds
func (v *Validator) StringLength(field, value string, min, max int) *Validator {
	length := utf8.RuneCountInString(value)
	if length < min || length > max {
		v.errors.Add(field, fmt.Sprintf("must be between %d and %d characters", min, max), "length")
	}
	return v
}

// Pattern validates a string matches a regex pattern
func (v *Validator) Pattern(field, value, pattern, message string) *Validator {
	if value == "" {
		return v // Skip pattern check for empty strings
	}
	matched, _ := regexp.MatchString(pattern, value)
	if !matched {
		v.errors.Add(field, message, "pattern")
	}
	return v
}

// =============================================================================
// UUID Validation
// =============================================================================

// UUID regex pattern
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// UUID validates a UUID string
func (v *Validator) UUID(field, value string) *Validator {
	if value == "" {
		return v // Use RequiredString for required UUIDs
	}
	if !uuidPattern.MatchString(value) {
		v.errors.Add(field, "must be a valid UUID", "uuid")
	}
	return v
}

// RequiredUUID validates a required UUID string
func (v *Validator) RequiredUUID(field, value string) *Validator {
	if value == "" {
		v.errors.Add(field, "is required", "required")
		return v
	}
	return v.UUID(field, value)
}

// =============================================================================
// Numeric Validation
// =============================================================================

// Min validates minimum int value
func (v *Validator) Min(field string, value, min int) *Validator {
	if value < min {
		v.errors.Add(field, fmt.Sprintf("must be at least %d", min), "min")
	}
	return v
}

// Max validates maximum int value
func (v *Validator) Max(field string, value, max int) *Validator {
	if value > max {
		v.errors.Add(field, fmt.Sprintf("must be at most %d", max), "max")
	}
	return v
}

// Range validates int is within range
func (v *Validator) Range(field string, value, min, max int) *Validator {
	if value < min || value > max {
		v.errors.Add(field, fmt.Sprintf("must be between %d and %d", min, max), "range")
	}
	return v
}

// MinFloat validates minimum float value
func (v *Validator) MinFloat(field string, value, min float64) *Validator {
	if value < min {
		v.errors.Add(field, fmt.Sprintf("must be at least %f", min), "min")
	}
	return v
}

// MaxFloat validates maximum float value
func (v *Validator) MaxFloat(field string, value, max float64) *Validator {
	if value > max {
		v.errors.Add(field, fmt.Sprintf("must be at most %f", max), "max")
	}
	return v
}

// =============================================================================
// Coordinate Validation
// =============================================================================

// Latitude validates a latitude value (-90 to 90)
func (v *Validator) Latitude(field string, value float64) *Validator {
	if value < -90 || value > 90 {
		v.errors.Add(field, "must be between -90 and 90 degrees", "latitude")
	}
	return v
}

// Longitude validates a longitude value (-180 to 180)
func (v *Validator) Longitude(field string, value float64) *Validator {
	if value < -180 || value > 180 {
		v.errors.Add(field, "must be between -180 and 180 degrees", "longitude")
	}
	return v
}

// Coordinates validates both latitude and longitude
func (v *Validator) Coordinates(latField string, lat float64, lonField string, lon float64) *Validator {
	v.Latitude(latField, lat)
	v.Longitude(lonField, lon)
	return v
}

// =============================================================================
// Date/Time Validation
// =============================================================================

// DateFormat validates a date string format (YYYY-MM-DD)
func (v *Validator) DateFormat(field, value string) *Validator {
	if value == "" {
		return v
	}
	_, err := time.Parse("2006-01-02", value)
	if err != nil {
		v.errors.Add(field, "must be in YYYY-MM-DD format", "date_format")
	}
	return v
}

// TimeFormat validates a time string format (HH:MM or HH:MM:SS)
func (v *Validator) TimeFormat(field, value string) *Validator {
	if value == "" {
		return v
	}
	_, err := time.Parse("15:04", value)
	if err != nil {
		_, err = time.Parse("15:04:05", value)
		if err != nil {
			v.errors.Add(field, "must be in HH:MM or HH:MM:SS format", "time_format")
		}
	}
	return v
}

// DateRange validates a date is within a range
func (v *Validator) DateRange(field, value string, minDate, maxDate time.Time) *Validator {
	if value == "" {
		return v
	}
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		v.errors.Add(field, "must be in YYYY-MM-DD format", "date_format")
		return v
	}
	if date.Before(minDate) || date.After(maxDate) {
		v.errors.Add(field, fmt.Sprintf("must be between %s and %s", minDate.Format("2006-01-02"), maxDate.Format("2006-01-02")), "date_range")
	}
	return v
}

// FutureDate validates a date is in the future
func (v *Validator) FutureDate(field, value string) *Validator {
	if value == "" {
		return v
	}
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		v.errors.Add(field, "must be in YYYY-MM-DD format", "date_format")
		return v
	}
	if !date.After(time.Now()) {
		v.errors.Add(field, "must be a future date", "future_date")
	}
	return v
}

// =============================================================================
// Email Validation
// =============================================================================

// Basic email pattern - not exhaustive but catches common mistakes
var emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Email validates an email address
func (v *Validator) Email(field, value string) *Validator {
	if value == "" {
		return v
	}
	if !emailPattern.MatchString(value) {
		v.errors.Add(field, "must be a valid email address", "email")
	}
	return v
}

// RequiredEmail validates a required email address
func (v *Validator) RequiredEmail(field, value string) *Validator {
	if value == "" {
		v.errors.Add(field, "is required", "required")
		return v
	}
	return v.Email(field, value)
}

// =============================================================================
// URL Validation
// =============================================================================

// Basic URL pattern
var urlPattern = regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)

// URL validates a URL
func (v *Validator) URL(field, value string) *Validator {
	if value == "" {
		return v
	}
	if !urlPattern.MatchString(value) {
		v.errors.Add(field, "must be a valid URL", "url")
	}
	return v
}

// =============================================================================
// Enum Validation
// =============================================================================

// OneOf validates value is one of allowed values
func (v *Validator) OneOf(field, value string, allowed []string) *Validator {
	if value == "" {
		return v
	}
	for _, a := range allowed {
		if value == a {
			return v
		}
	}
	v.errors.Add(field, fmt.Sprintf("must be one of: %s", strings.Join(allowed, ", ")), "one_of")
	return v
}

// =============================================================================
// Slice Validation
// =============================================================================

// MinItems validates minimum slice length
func (v *Validator) MinItems(field string, length, min int) *Validator {
	if length < min {
		v.errors.Add(field, fmt.Sprintf("must have at least %d items", min), "min_items")
	}
	return v
}

// MaxItems validates maximum slice length
func (v *Validator) MaxItems(field string, length, max int) *Validator {
	if length > max {
		v.errors.Add(field, fmt.Sprintf("must have at most %d items", max), "max_items")
	}
	return v
}

// =============================================================================
// Convenience Functions
// =============================================================================

// IsValidUUID checks if a string is a valid UUID
func IsValidUUID(value string) bool {
	return uuidPattern.MatchString(value)
}

// IsValidEmail checks if a string is a valid email
func IsValidEmail(value string) bool {
	return emailPattern.MatchString(value)
}

// IsValidLatitude checks if a float is a valid latitude
func IsValidLatitude(value float64) bool {
	return value >= -90 && value <= 90
}

// IsValidLongitude checks if a float is a valid longitude
func IsValidLongitude(value float64) bool {
	return value >= -180 && value <= 180
}

// IsValidDateFormat checks if a string is a valid date format
func IsValidDateFormat(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}
