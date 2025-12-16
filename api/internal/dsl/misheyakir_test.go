package dsl

import (
	"fmt"
	"testing"
	"time"
)

func TestMisheyakirComparison(t *testing.T) {
	// Manchester M7 4QY coordinates (from MBD calendar header)
	lat := 53.517254
	lon := -2.253071
	loc, _ := time.LoadLocation("Europe/London")

	// Test dates with expected Misheyakir times from MBD calendar PDF page 2
	// Format: date, MBD_Tallis/Tefillin (column 1), MBD_Sunrise (column 2)
	testDates := []struct {
		date          string
		mbdMisheyakir string // From Manchester Beis Din calendar
		mbdSunrise    string
	}{
		{"2025-09-27", "5:55", "7:04"},  // 27 Elul - Shabbos
		{"2025-10-04", "6:08", "7:17"},  // 12 Tishrei
		{"2025-10-11", "6:21", "7:29"},  // 19 Tishrei
		{"2025-11-08", "6:16", "7:21"},  // 17 Marcheshvan
		{"2025-12-20", "7:22", "8:16"},  // 29 Kislev - Chanukah
		{"2025-12-27", "7:25", "8:18"},  // 7 Teves
		{"2026-01-24", "7:03", "7:56"},  // 5 Shevat
		{"2026-02-21", "6:04", "7:02"},  // 4 Adar
		{"2026-03-28", "6:24", "7:37"},  // 9 Nissan - after clock change
		{"2026-06-06", "3:51", "5:27"},  // 21 Sivan - summer
	}

	fmt.Println("Misheyakir Comparison vs MBD Published Times")
	fmt.Println("=============================================")
	fmt.Println("Location: Manchester M7 4QY (53.517254, -2.253071)")
	fmt.Println()

	for _, td := range testDates {
		date, _ := time.ParseInLocation("2006-01-02", td.date, loc)
		fmt.Printf("Date: %s (MBD: Misheyakir=%s, Sunrise=%s)\n", td.date, td.mbdMisheyakir, td.mbdSunrise)

		ctx := NewExecutionContext(date, lat, lon, 0, loc)

		// Get visible sunrise
		sunrise, _ := ExecuteFormula("visible_sunrise", ctx)
		sunriseStr := sunrise.In(loc).Format("15:04")
		fmt.Printf("  Calc Sunrise:    %s (MBD: %s)\n", sunriseStr, td.mbdSunrise)

		// Test various Misheyakir formulas
		formulas := []struct {
			name    string
			formula string
		}{
			{"11.5° raw", "solar(11.5, before_sunrise)"},
			{"11.5° + 15min", "solar(11.5, before_sunrise) + 15min"},
			{"11.0°", "solar(11.0, before_sunrise)"},
			{"10.8°", "solar(10.8, before_sunrise)"},
			{"10.5°", "solar(10.5, before_sunrise)"},
		}

		for _, f := range formulas {
			result, err := ExecuteFormula(f.formula, ctx)
			if err != nil {
				fmt.Printf("  %-18s ERROR\n", f.name)
			} else {
				resultStr := result.In(loc).Format("15:04")
				diff := ""
				if td.mbdMisheyakir != "" {
					// Parse MBD time for comparison
					mbdTime, _ := time.ParseInLocation("15:04", td.mbdMisheyakir, loc)
					mbdTime = time.Date(date.Year(), date.Month(), date.Day(), mbdTime.Hour(), mbdTime.Minute(), 0, 0, loc)
					diffMins := result.Sub(mbdTime).Minutes()
					if diffMins == 0 {
						diff = " ✓ MATCH"
					} else {
						diff = fmt.Sprintf(" (diff: %+.0fmin)", diffMins)
					}
				}
				fmt.Printf("  %-18s %s%s\n", f.name, resultStr, diff)
			}
		}
		fmt.Println()
	}
}

// TestZmanimComparisonWithMBD is disabled pending mbdData definition
// func TestZmanimComparisonWithMBD(t *testing.T) { ... }
