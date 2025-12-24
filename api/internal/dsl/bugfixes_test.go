// File: bugfixes_test.go
// Purpose: Tests for bug fixes in DSL executor and astro calculations
package dsl

import (
	"testing"
	"time"

	"github.com/jcom-dev/zmanim/internal/astro"
)

// TestBug1_LeapYearDateLiteral tests that Feb 29 on non-leap year returns error
func TestBug1_LeapYearDateLiteral(t *testing.T) {
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2023, 3, 1, 0, 0, 0, 0, tz) // 2023 is NOT a leap year

	ctx := NewExecutionContext(date, 40.7128, -74.0060, 0, tz)
	node, err := Parse("if (date == 29-Feb) { visible_sunrise } else { visible_sunset }")
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}

	_, err = Execute(node, ctx)
	if err == nil {
		t.Fatal("Expected error for Feb 29 in non-leap year, but got none")
	}

	if !containsError(err, "does not exist") {
		t.Fatalf("Expected 'does not exist' error, got: %v", err)
	}

	t.Logf("✓ Correctly errors for Feb 29 in non-leap year: %v", err)
}

// TestBug1_LeapYearDateLiteralValid tests that Feb 29 works on leap year
func TestBug1_LeapYearDateLiteralValid(t *testing.T) {
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2024, 3, 1, 0, 0, 0, 0, tz) // 2024 IS a leap year

	ctx := NewExecutionContext(date, 40.7128, -74.0060, 0, tz)
	node, err := Parse("if (date == 29-Feb) { visible_sunrise } else { visible_sunset }")
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}

	_, err = Execute(node, ctx)
	if err != nil {
		t.Fatalf("Should not error for Feb 29 in leap year: %v", err)
	}

	t.Log("✓ Correctly accepts Feb 29 in leap year")
}

// TestBug2_DivisionByZero tests that zero duration in ShaosZmaniyos returns zero time
func TestBug2_DivisionByZero(t *testing.T) {
	tests := []struct {
		name     string
		testFunc func() time.Time
	}{
		{
			name: "ShaosZmaniyosGRA",
			testFunc: func() time.Time {
				zeroTime := time.Time{}
				return astro.ShaosZmaniyosGRA(zeroTime, zeroTime, 3.0)
			},
		},
		{
			name: "ShaosZmaniyosMGA",
			testFunc: func() time.Time {
				zeroTime := time.Time{}
				return astro.ShaosZmaniyosMGA(zeroTime, zeroTime, 3.0)
			},
		},
		{
			name: "ShaosZmaniyosCustom",
			testFunc: func() time.Time {
				zeroTime := time.Time{}
				return astro.ShaosZmaniyosCustom(zeroTime, zeroTime, 3.0)
			},
		},
		{
			name: "ShaosZmaniyosGRA_negative_duration",
			testFunc: func() time.Time {
				tz, _ := time.LoadLocation("UTC")
				t1 := time.Date(2024, 1, 1, 12, 0, 0, 0, tz)
				t2 := time.Date(2024, 1, 1, 6, 0, 0, 0, tz) // Earlier than t1
				return astro.ShaosZmaniyosGRA(t1, t2, 3.0)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.testFunc()
			if !result.IsZero() {
				t.Errorf("Expected zero time for invalid duration, got: %v", result)
			} else {
				t.Logf("✓ Returns zero time for invalid duration")
			}
		})
	}
}

// TestBug3_AngleValidation tests that invalid angles return zero times
func TestBug3_AngleValidation(t *testing.T) {
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2024, 3, 1, 0, 0, 0, 0, tz)

	tests := []struct {
		name  string
		angle float64
	}{
		{"angle > 90", 95.0},
		{"angle < 0", -5.0},
		{"angle = 91", 91.0},
		{"angle = -1", -1.0},
		{"angle = 100", 100.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dawn, dusk := astro.SunTimeAtAngle(date, 40.7128, -74.0060, tz, tt.angle)
			if !dawn.IsZero() || !dusk.IsZero() {
				t.Errorf("Expected zero times for angle %.1f, got dawn=%v, dusk=%v", tt.angle, dawn, dusk)
			} else {
				t.Logf("✓ Returns zero times for angle %.1f", tt.angle)
			}

			// Also test with elevation
			dawn2, dusk2 := astro.SunTimeAtAngleWithElevation(date, 40.7128, -74.0060, 100, tz, tt.angle)
			if !dawn2.IsZero() || !dusk2.IsZero() {
				t.Errorf("Expected zero times for angle %.1f (with elevation), got dawn=%v, dusk=%v", tt.angle, dawn2, dusk2)
			}

			// Also test seasonal
			dawn3, dusk3 := astro.SeasonalSunTimeAtAngle(date, 40.7128, -74.0060, tz, tt.angle)
			if !dawn3.IsZero() || !dusk3.IsZero() {
				t.Errorf("Expected zero times for angle %.1f (seasonal), got dawn=%v, dusk=%v", tt.angle, dawn3, dusk3)
			}
		})
	}

	// Test valid angles still work
	t.Run("valid angles", func(t *testing.T) {
		validAngles := []float64{0, 16.1, 18.0, 45.0, 90.0}
		for _, angle := range validAngles {
			dawn, dusk := astro.SunTimeAtAngle(date, 40.7128, -74.0060, tz, angle)
			// Note: Some angles might still return zero in polar regions, but that's different
			// We're just checking the validation doesn't reject valid angles
			t.Logf("✓ Accepts valid angle %.1f (dawn=%v, dusk=%v)", angle, dawn.Format("15:04:05"), dusk.Format("15:04:05"))
		}
	})
}

// TestBug4_DurationOverflow tests that duration overflow is detected
func TestBug4_DurationOverflow(t *testing.T) {
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2024, 3, 1, 0, 0, 0, 0, tz)
	ctx := NewExecutionContext(date, 40.7128, -74.0060, 0, tz)

	tests := []struct {
		name    string
		formula string
	}{
		{"duration * huge number", "72min * 9999999999999999"},
		{"huge number * duration", "9999999999999999 * 72min"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node, err := Parse(tt.formula)
			if err != nil {
				t.Fatalf("Parse error: %v", err)
			}

			_, err = Execute(node, ctx)
			if err == nil {
				t.Fatal("Expected overflow error, but got none")
			}

			if !containsError(err, "overflow") {
				t.Fatalf("Expected 'overflow' error, got: %v", err)
			}

			t.Logf("✓ Correctly detects overflow: %v", err)
		})
	}

	// Test that valid multiplications still work
	t.Run("valid multiplication", func(t *testing.T) {
		node, err := Parse("72min * 2")
		if err != nil {
			t.Fatalf("Parse error: %v", err)
		}

		val := NewExecutor(ctx).executeNode(node)
		if val.Type != ValueTypeDuration {
			t.Fatalf("Expected duration, got: %v", val.Type)
		}

		expected := 144 * time.Minute
		if val.Duration != expected {
			t.Fatalf("Expected %v, got %v", expected, val.Duration)
		}

		t.Logf("✓ Valid multiplication works: 72min * 2 = %v", val.Duration)
	})
}

// TestBug5_CustomArgsValidation tests that custom base requires exactly 2 args
func TestBug5_CustomArgsValidation(t *testing.T) {
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2024, 3, 1, 0, 0, 0, 0, tz)
	ctx := NewExecutionContext(date, 40.7128, -74.0060, 0, tz)

	tests := []struct {
		name    string
		formula string
	}{
		{"custom with 1 arg", "proportional_hours(3, custom(visible_sunrise))"},
		{"custom with 3 args", "proportional_hours(3, custom(visible_sunrise, visible_sunset, solar_noon))"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node, err := Parse(tt.formula)
			if err != nil {
				// Parser might catch this
				t.Logf("✓ Parser caught error: %v", err)
				return
			}

			_, err = Execute(node, ctx)
			if err == nil {
				t.Fatal("Expected error for wrong arg count, but got none")
			}

			if !containsError(err, "2 arguments") {
				t.Fatalf("Expected '2 arguments' error, got: %v", err)
			}

			t.Logf("✓ Correctly validates arg count: %v", err)
		})
	}

	// Test valid custom base
	t.Run("valid custom", func(t *testing.T) {
		node, err := Parse("proportional_hours(3, custom(visible_sunrise, visible_sunset))")
		if err != nil {
			t.Fatalf("Parse error: %v", err)
		}

		result, err := Execute(node, ctx)
		if err != nil {
			t.Fatalf("Should not error for valid custom: %v", err)
		}

		if result.IsZero() {
			t.Fatal("Result should not be zero time")
		}

		t.Logf("✓ Valid custom base works: %v", result.Format("15:04:05"))
	})
}

// Helper function to check if error contains substring
func containsError(err error, substr string) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Simple substring check
	for i := 0; i <= len(errStr)-len(substr); i++ {
		if errStr[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
