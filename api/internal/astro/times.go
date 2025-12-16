package astro

import (
	"time"
)

// TimeArithmetic provides helpers for zmanim time calculations

// AddMinutes adds the specified number of minutes to a time
func AddMinutes(t time.Time, minutes float64) time.Time {
	return t.Add(time.Duration(minutes * float64(time.Minute)))
}

// SubtractMinutes subtracts the specified number of minutes from a time
func SubtractMinutes(t time.Time, minutes float64) time.Time {
	return t.Add(time.Duration(-minutes * float64(time.Minute)))
}

// Midpoint calculates the midpoint between two times
func Midpoint(start, end time.Time) time.Time {
	duration := end.Sub(start)
	return start.Add(duration / 2)
}

// ShaosZmaniyosGRA calculates proportional hours using GRA method (sunrise to sunset)
// Returns the time that is 'hours' proportional hours after sunrise
func ShaosZmaniyosGRA(sunrise, sunset time.Time, hours float64) time.Time {
	dayDuration := sunset.Sub(sunrise)
	hourDuration := time.Duration(float64(dayDuration) / 12)
	return sunrise.Add(time.Duration(float64(hourDuration) * hours))
}

// ShaosZmaniyosMGA calculates proportional hours using MGA method (alos 72 to tzeis 72)
// Returns the time that is 'hours' proportional hours after alos
func ShaosZmaniyosMGA(alos72, tzeis72 time.Time, hours float64) time.Time {
	dayDuration := tzeis72.Sub(alos72)
	hourDuration := time.Duration(float64(dayDuration) / 12)
	return alos72.Add(time.Duration(float64(hourDuration) * hours))
}

// ShaosZmaniyosCustom calculates proportional hours using custom start/end times
func ShaosZmaniyosCustom(start, end time.Time, hours float64) time.Time {
	dayDuration := end.Sub(start)
	hourDuration := time.Duration(float64(dayDuration) / 12)
	return start.Add(time.Duration(float64(hourDuration) * hours))
}

// GetShaahZmanisGRA returns the duration of one proportional hour using GRA method
func GetShaahZmanisGRA(sunrise, sunset time.Time) time.Duration {
	return sunset.Sub(sunrise) / 12
}

// GetShaahZmanisMGA returns the duration of one proportional hour using MGA method
func GetShaahZmanisMGA(alos72, tzeis72 time.Time) time.Duration {
	return tzeis72.Sub(alos72) / 12
}

// MinutesFromSunrise calculates a time that is N minutes after sunrise
func MinutesFromSunrise(sunrise time.Time, minutes float64) time.Time {
	return AddMinutes(sunrise, minutes)
}

// MinutesBeforeSunrise calculates a time that is N minutes before sunrise
func MinutesBeforeSunrise(sunrise time.Time, minutes float64) time.Time {
	return SubtractMinutes(sunrise, minutes)
}

// MinutesFromSunset calculates a time that is N minutes after sunset
func MinutesFromSunset(sunset time.Time, minutes float64) time.Time {
	return AddMinutes(sunset, minutes)
}

// MinutesBeforeSunset calculates a time that is N minutes before sunset
func MinutesBeforeSunset(sunset time.Time, minutes float64) time.Time {
	return SubtractMinutes(sunset, minutes)
}

// FormatTime formats a time for display (HH:MM:SS)
func FormatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("15:04:05")
}

// FormatTimeShort formats a time for display (HH:MM)
func FormatTimeShort(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("15:04")
}
