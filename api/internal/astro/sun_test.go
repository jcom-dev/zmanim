package astro

import (
	"testing"
	"time"
)

func TestSunTimes(t *testing.T) {
	// Brooklyn coordinates
	lat := 40.6782
	lng := -73.9442

	loc, _ := time.LoadLocation("America/New_York")
	date := time.Date(2025, 11, 26, 0, 0, 0, 0, loc)

	sunTimes := CalculateSunTimes(date, lat, lng, loc)

	t.Logf("Date: %s", date.Format("2006-01-02"))
	t.Logf("Sunrise: %s", sunTimes.Sunrise.Format("15:04:05"))
	t.Logf("Solar Noon: %s", sunTimes.SolarNoon.Format("15:04:05"))
	t.Logf("Sunset: %s", sunTimes.Sunset.Format("15:04:05"))
	t.Logf("Day Length: %.1f minutes", sunTimes.DayLengthMinutes)

	// Sunrise should be around 6:55 AM in late November
	sunriseHour := sunTimes.Sunrise.Hour()
	if sunriseHour < 6 || sunriseHour > 7 {
		t.Errorf("Sunrise hour %d is out of expected range (6-7)", sunriseHour)
	}

	// Sunset should be around 4:30 PM
	sunsetHour := sunTimes.Sunset.Hour()
	if sunsetHour < 16 || sunsetHour > 17 {
		t.Errorf("Sunset hour %d is out of expected range (16-17)", sunsetHour)
	}

	// Sunrise should be before sunset
	if !sunTimes.Sunrise.Before(sunTimes.Sunset) {
		t.Errorf("Sunrise %v should be before sunset %v", sunTimes.Sunrise, sunTimes.Sunset)
	}

	// Solar noon should be between sunrise and sunset
	if !sunTimes.SolarNoon.After(sunTimes.Sunrise) || !sunTimes.SolarNoon.Before(sunTimes.Sunset) {
		t.Errorf("Solar noon %v should be between sunrise and sunset", sunTimes.SolarNoon)
	}
}

func TestSunTimeAtAngle(t *testing.T) {
	lat := 40.6782
	lng := -73.9442

	loc, _ := time.LoadLocation("America/New_York")
	date := time.Date(2025, 11, 26, 0, 0, 0, 0, loc)

	sunTimes := CalculateSunTimes(date, lat, lng, loc)

	// Test alos (16.1 degrees)
	dawn, dusk := SunTimeAtAngle(date, lat, lng, loc, 16.1)
	t.Logf("Alos (16.1°): dawn=%s, dusk=%s", dawn.Format("15:04:05"), dusk.Format("15:04:05"))

	// Dawn should be before sunrise
	if !dawn.Before(sunTimes.Sunrise) {
		t.Errorf("Dawn (16.1°) %v should be before sunrise %v", dawn, sunTimes.Sunrise)
	}

	// Dusk should be after sunset
	if !dusk.After(sunTimes.Sunset) {
		t.Errorf("Dusk (16.1°) %v should be after sunset %v", dusk, sunTimes.Sunset)
	}

	// Test tzeis (8.5 degrees)
	dawn2, dusk2 := SunTimeAtAngle(date, lat, lng, loc, 8.5)
	t.Logf("Tzeis (8.5°): dawn=%s, dusk=%s", dawn2.Format("15:04:05"), dusk2.Format("15:04:05"))

	// Dawn should be before sunrise
	if !dawn2.Before(sunTimes.Sunrise) {
		t.Errorf("Dawn (8.5°) %v should be before sunrise %v", dawn2, sunTimes.Sunrise)
	}
}
