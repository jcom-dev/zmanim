package astro

import (
	"fmt"
	"testing"
	"time"
)

func TestTimezoneDebug(t *testing.T) {
	// Test for New York on Dec 7, 2025
	tz, _ := time.LoadLocation("America/New_York")
	date := time.Date(2025, 12, 7, 0, 0, 0, 0, tz)
	lat := 40.7128
	lon := -74.006

	fmt.Printf("Date: %v\n", date)
	fmt.Printf("Timezone: %v\n", tz)

	st := CalculateSunTimes(date, lat, lon, tz)

	fmt.Printf("\nSunrise: %v (formatted: %s)\n", st.Sunrise, st.Sunrise.Format("15:04:05"))
	fmt.Printf("Sunrise.Location: %v\n", st.Sunrise.Location())
	fmt.Printf("SolarNoon: %v (formatted: %s)\n", st.SolarNoon, st.SolarNoon.Format("15:04:05"))
	fmt.Printf("Sunset: %v (formatted: %s)\n", st.Sunset, st.Sunset.Format("15:04:05"))

	// Also test with UTC to compare
	fmt.Println("\n--- With UTC timezone ---")
	tzUTC := time.UTC
	dateUTC := time.Date(2025, 12, 7, 0, 0, 0, 0, tzUTC)
	stUTC := CalculateSunTimes(dateUTC, lat, lon, tzUTC)

	fmt.Printf("Sunrise UTC: %v (formatted: %s)\n", stUTC.Sunrise, stUTC.Sunrise.Format("15:04:05"))
	fmt.Printf("Sunset UTC: %v (formatted: %s)\n", stUTC.Sunset, stUTC.Sunset.Format("15:04:05"))

	// Expected values for NY in December
	// Sunrise ~7:06 AM, Sunset ~4:28 PM EST
	if st.Sunrise.Hour() > 8 || st.Sunrise.Hour() < 6 {
		t.Errorf("Sunrise hour %d is wrong, expected around 7 AM EST", st.Sunrise.Hour())
	}
}
