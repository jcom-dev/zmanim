// File: sun.go
// Purpose: Astronomical calculations - sunrise, sunset, solar angles
// Pattern: calculation-primitive
// Dependencies: NOAA solar equations
// Frequency: critical - foundation for DSL primitives
// Compliance: Check docs/adr/ for pattern rationale

// Package astro provides astronomical calculations for zmanim times
// Based on NOAA Solar Calculator algorithms
// Reference: https://gml.noaa.gov/grad/solcalc/calcdetails.html
package astro

import (
	"math"
	"time"
)

// SunTimes contains calculated sun position times for a given date and location
type SunTimes struct {
	Date      time.Time
	Latitude  float64
	Longitude float64
	Elevation float64 // Elevation in meters above sea level
	Timezone  *time.Location

	// Core times
	Sunrise   time.Time
	SolarNoon time.Time
	Sunset    time.Time

	// Day length in minutes
	DayLengthMinutes float64
}

// Constants for astronomical calculations
const (
	// Degrees to radians
	deg2rad = math.Pi / 180.0
	// Radians to degrees
	rad2deg = 180.0 / math.Pi
	// Earth's radius in meters (mean radius)
	earthRadiusMeters = 6371000.0
)

// CalculateSunTimes calculates sunrise, solar noon, and sunset for a given date and location
// This version assumes sea level (elevation = 0). Use CalculateSunTimesWithElevation for elevation-adjusted times.
func CalculateSunTimes(date time.Time, latitude, longitude float64, tz *time.Location) *SunTimes {
	return CalculateSunTimesWithElevation(date, latitude, longitude, 0, tz)
}

// CalculateSunTimesWithElevation calculates sunrise, solar noon, and sunset with elevation adjustment
// Elevation is in meters above sea level. Higher elevations see sunrise earlier and sunset later
// due to the extended horizon visible from elevated positions.
func CalculateSunTimesWithElevation(date time.Time, latitude, longitude, elevation float64, tz *time.Location) *SunTimes {
	// Julian day calculation
	jd := julianDay(date)

	// Calculate solar noon first (not affected by elevation)
	solarNoon := calcSolarNoon(jd, longitude, tz, date)

	// Calculate sunrise with elevation adjustment
	sunrise := calcSunriseOrSunsetWithElevation(jd, latitude, longitude, elevation, tz, date, true)

	// Calculate sunset with elevation adjustment
	sunset := calcSunriseOrSunsetWithElevation(jd, latitude, longitude, elevation, tz, date, false)

	// Calculate day length
	dayLength := 0.0
	if !sunrise.IsZero() && !sunset.IsZero() {
		dayLength = sunset.Sub(sunrise).Minutes()
	}

	return &SunTimes{
		Date:             date,
		Latitude:         latitude,
		Longitude:        longitude,
		Elevation:        elevation,
		Timezone:         tz,
		Sunrise:          sunrise,
		SolarNoon:        solarNoon,
		Sunset:           sunset,
		DayLengthMinutes: dayLength,
	}
}

// SunTimeAtAngle calculates the time when the sun is at a specific angle below the horizon
// Positive angle = below horizon (e.g., 16.1 for alos hashachar)
// Returns both dawn (before sunrise) and dusk (after sunset) times
// This version assumes sea level. Use SunTimeAtAngleWithElevation for elevation-adjusted times.
func SunTimeAtAngle(date time.Time, latitude, longitude float64, tz *time.Location, angle float64) (dawn, dusk time.Time) {
	// Validate angle range
	if angle < 0 || angle > 90 {
		return time.Time{}, time.Time{} // Invalid angle
	}
	return SunTimeAtAngleWithElevation(date, latitude, longitude, 0, tz, angle)
}

// SunTimeAtAngleWithElevation calculates sun angle times with elevation adjustment
// Elevation is in meters above sea level
func SunTimeAtAngleWithElevation(date time.Time, latitude, longitude, elevation float64, tz *time.Location, angle float64) (dawn, dusk time.Time) {
	// Validate angle range
	if angle < 0 || angle > 90 {
		return time.Time{}, time.Time{} // Invalid angle
	}

	jd := julianDay(date)

	// Calculate dawn (before sunrise)
	dawn = calcSunAngleTimeWithElevation(jd, latitude, longitude, elevation, tz, date, angle, true)

	// Calculate dusk (after sunset)
	dusk = calcSunAngleTimeWithElevation(jd, latitude, longitude, elevation, tz, date, angle, false)

	return dawn, dusk
}

// SeasonalSunTimeAtAngle calculates sun angle times using the seasonal proportional method.
// This method calculates the offset from sunrise/sunset at the equinox for the given angle,
// then scales that offset proportionally based on the current day's length compared to equinox.
// This produces times that match halachic seasonal hours (sha'os zmaniyos) calculations.
// The angle parameter is degrees below horizon (e.g., 16.04 for alos hashachar).
func SeasonalSunTimeAtAngle(date time.Time, latitude, longitude float64, tz *time.Location, angle float64) (dawn, dusk time.Time) {
	// Validate angle range
	if angle < 0 || angle > 90 {
		return time.Time{}, time.Time{} // Invalid angle
	}
	return SeasonalSunTimeAtAngleWithElevation(date, latitude, longitude, 0, tz, angle)
}

// SeasonalSunTimeAtAngleWithElevation calculates seasonal sun angle times with elevation adjustment.
// See SeasonalSunTimeAtAngle for methodology explanation.
func SeasonalSunTimeAtAngleWithElevation(date time.Time, latitude, longitude, elevation float64, tz *time.Location, angle float64) (dawn, dusk time.Time) {
	// Validate angle range
	if angle < 0 || angle > 90 {
		return time.Time{}, time.Time{} // Invalid angle
	}

	// Step 1: Calculate equinox date (March 20 of the same year)
	equinoxDate := time.Date(date.Year(), 3, 20, 12, 0, 0, 0, tz)

	// Step 2: Get equinox sunrise/sunset and solar angle times
	equinoxSunTimes := CalculateSunTimesWithElevation(equinoxDate, latitude, longitude, elevation, tz)
	equinoxDawn, equinoxDusk := SunTimeAtAngleWithElevation(equinoxDate, latitude, longitude, elevation, tz, angle)

	// Step 3: Calculate equinox offsets (minutes from sunrise/sunset)
	equinoxDawnOffset := equinoxSunTimes.Sunrise.Sub(equinoxDawn).Minutes()
	equinoxDuskOffset := equinoxDusk.Sub(equinoxSunTimes.Sunset).Minutes()
	equinoxDayLength := equinoxSunTimes.DayLengthMinutes

	// Step 4: Get current day sunrise/sunset
	currentSunTimes := CalculateSunTimesWithElevation(date, latitude, longitude, elevation, tz)
	currentDayLength := currentSunTimes.DayLengthMinutes

	// Step 5: Calculate day length ratio and scale offsets
	if equinoxDayLength == 0 || currentDayLength == 0 {
		return time.Time{}, time.Time{}
	}
	dayLengthRatio := currentDayLength / equinoxDayLength

	scaledDawnOffset := equinoxDawnOffset * dayLengthRatio
	scaledDuskOffset := equinoxDuskOffset * dayLengthRatio

	// Step 6: Apply scaled offsets to current day's sunrise/sunset
	dawn = currentSunTimes.Sunrise.Add(-time.Duration(scaledDawnOffset * float64(time.Minute)))
	dusk = currentSunTimes.Sunset.Add(time.Duration(scaledDuskOffset * float64(time.Minute)))

	return dawn, dusk
}

// julianDay calculates the Julian Day number for a given date
func julianDay(date time.Time) float64 {
	year := float64(date.Year())
	month := float64(date.Month())
	day := float64(date.Day())

	if month <= 2 {
		year--
		month += 12
	}

	A := math.Floor(year / 100)
	B := 2 - A + math.Floor(A/4)

	return math.Floor(365.25*(year+4716)) + math.Floor(30.6001*(month+1)) + day + B - 1524.5
}

// calcTimeJulianCent calculates the Julian Century from Julian Day
func calcTimeJulianCent(jd float64) float64 {
	return (jd - 2451545.0) / 36525.0
}

// calcGeomMeanLongSun calculates the geometric mean longitude of the sun (in degrees)
func calcGeomMeanLongSun(t float64) float64 {
	L0 := 280.46646 + t*(36000.76983+0.0003032*t)
	for L0 > 360 {
		L0 -= 360
	}
	for L0 < 0 {
		L0 += 360
	}
	return L0
}

// calcGeomMeanAnomalySun calculates the geometric mean anomaly of the sun (in degrees)
func calcGeomMeanAnomalySun(t float64) float64 {
	return 357.52911 + t*(35999.05029-0.0001537*t)
}

// calcEccentricityEarthOrbit calculates the eccentricity of earth's orbit
func calcEccentricityEarthOrbit(t float64) float64 {
	return 0.016708634 - t*(0.000042037+0.0000001267*t)
}

// calcSunEqOfCenter calculates the equation of center for the sun (in degrees)
func calcSunEqOfCenter(t float64) float64 {
	m := calcGeomMeanAnomalySun(t)
	mrad := m * deg2rad
	sinm := math.Sin(mrad)
	sin2m := math.Sin(2 * mrad)
	sin3m := math.Sin(3 * mrad)
	return sinm*(1.914602-t*(0.004817+0.000014*t)) + sin2m*(0.019993-0.000101*t) + sin3m*0.000289
}

// calcSunTrueLong calculates the true longitude of the sun (in degrees)
func calcSunTrueLong(t float64) float64 {
	return calcGeomMeanLongSun(t) + calcSunEqOfCenter(t)
}

// calcSunApparentLong calculates the apparent longitude of the sun (in degrees)
func calcSunApparentLong(t float64) float64 {
	o := calcSunTrueLong(t)
	omega := 125.04 - 1934.136*t
	return o - 0.00569 - 0.00478*math.Sin(omega*deg2rad)
}

// calcMeanObliquityOfEcliptic calculates the mean obliquity of the ecliptic (in degrees)
func calcMeanObliquityOfEcliptic(t float64) float64 {
	seconds := 21.448 - t*(46.8150+t*(0.00059-t*0.001813))
	return 23.0 + (26.0+seconds/60.0)/60.0
}

// calcObliquityCorrection calculates the corrected obliquity of the ecliptic (in degrees)
func calcObliquityCorrection(t float64) float64 {
	e0 := calcMeanObliquityOfEcliptic(t)
	omega := 125.04 - 1934.136*t
	return e0 + 0.00256*math.Cos(omega*deg2rad)
}

// calcSunDeclination calculates the declination of the sun (in degrees)
func calcSunDeclination(t float64) float64 {
	e := calcObliquityCorrection(t)
	lambda := calcSunApparentLong(t)
	sint := math.Sin(e*deg2rad) * math.Sin(lambda*deg2rad)
	return math.Asin(sint) * rad2deg
}

// calcEquationOfTime calculates the equation of time (in minutes)
func calcEquationOfTime(t float64) float64 {
	epsilon := calcObliquityCorrection(t)
	l0 := calcGeomMeanLongSun(t)
	e := calcEccentricityEarthOrbit(t)
	m := calcGeomMeanAnomalySun(t)

	y := math.Tan(epsilon*deg2rad/2) * math.Tan(epsilon*deg2rad/2)

	sin2l0 := math.Sin(2 * l0 * deg2rad)
	sinm := math.Sin(m * deg2rad)
	cos2l0 := math.Cos(2 * l0 * deg2rad)
	sin4l0 := math.Sin(4 * l0 * deg2rad)
	sin2m := math.Sin(2 * m * deg2rad)

	eqTime := y*sin2l0 - 2*e*sinm + 4*e*y*sinm*cos2l0 - 0.5*y*y*sin4l0 - 1.25*e*e*sin2m
	return eqTime * rad2deg * 4 // Convert to minutes
}

// calcElevationAdjustment calculates the zenith adjustment for elevation
// At higher elevations, the visible horizon is lower, so the sun appears to rise earlier
// and set later. This returns the additional angle in degrees to add to the zenith.
// Formula: adjustment = arccos(R / (R + h)) where R = Earth radius, h = elevation
// This equals the depression angle to the geometric horizon from the elevated position.
func calcElevationAdjustment(elevationMeters float64) float64 {
	if elevationMeters <= 0 {
		return 0
	}
	// Depression angle to horizon from elevated position
	// cos(angle) = R / (R + h), so angle = acos(R / (R + h))
	// This angle needs to be subtracted from the zenith (making sun visible earlier)
	cosAngle := earthRadiusMeters / (earthRadiusMeters + elevationMeters)
	return math.Acos(cosAngle) * rad2deg
}

// calcHourAngleSunrise calculates the hour angle of sunrise for the given latitude and solar declination
// zenith is in degrees (90.833 for sunrise/sunset accounting for refraction)
func calcHourAngleSunrise(lat, solarDec, zenith float64) float64 {
	latRad := lat * deg2rad
	sdRad := solarDec * deg2rad
	zenithRad := zenith * deg2rad

	cosHA := (math.Cos(zenithRad) / (math.Cos(latRad) * math.Cos(sdRad))) - math.Tan(latRad)*math.Tan(sdRad)

	// Check for polar day/night
	if cosHA > 1 {
		return math.NaN() // No sunrise (polar night)
	}
	if cosHA < -1 {
		return math.NaN() // No sunset (polar day)
	}

	return math.Acos(cosHA) * rad2deg
}

// calcSolarNoon calculates solar noon for the given Julian day and longitude
func calcSolarNoon(jd, longitude float64, tz *time.Location, date time.Time) time.Time {
	tnoon := calcTimeJulianCent(jd + 0.5 + longitude/360.0)
	eqTime := calcEquationOfTime(tnoon)

	// Solar noon in minutes from midnight UTC
	solarNoonUTC := 720 - longitude*4 - eqTime

	// Convert to local time
	hours := int(solarNoonUTC / 60)
	minutes := int(math.Mod(solarNoonUTC, 60))
	seconds := int(math.Mod(solarNoonUTC*60, 60))

	utcTime := time.Date(date.Year(), date.Month(), date.Day(), hours, minutes, seconds, 0, time.UTC)
	return utcTime.In(tz)
}

// calcSunriseOrSunset calculates sunrise or sunset time (sea level)
func calcSunriseOrSunset(jd, latitude, longitude float64, tz *time.Location, date time.Time, isSunrise bool) time.Time {
	return calcSunriseOrSunsetWithElevation(jd, latitude, longitude, 0, tz, date, isSunrise)
}

// calcSunriseOrSunsetWithElevation calculates sunrise or sunset time with elevation adjustment
func calcSunriseOrSunsetWithElevation(jd, latitude, longitude, elevation float64, tz *time.Location, date time.Time, isSunrise bool) time.Time {
	// Standard zenith for sunrise/sunset (includes atmospheric refraction)
	zenith := 90.833

	// Apply elevation adjustment - higher elevation means the horizon is depressed,
	// so the sun appears earlier (sunrise) or later (sunset).
	// We ADD the elevation adjustment to zenith: a larger zenith means we're looking
	// for when the sun is geometrically lower, which occurs earlier in the morning.
	elevationAdj := calcElevationAdjustment(elevation)
	adjustedZenith := zenith + elevationAdj

	return calcSunTimeForZenith(jd, latitude, longitude, tz, date, adjustedZenith, isSunrise)
}

// calcSunAngleTime calculates time when sun is at a specific angle below horizon (sea level)
func calcSunAngleTime(jd, latitude, longitude float64, tz *time.Location, date time.Time, angle float64, isDawn bool) time.Time {
	return calcSunAngleTimeWithElevation(jd, latitude, longitude, 0, tz, date, angle, isDawn)
}

// calcSunAngleTimeWithElevation calculates time when sun is at a specific angle below horizon with elevation
func calcSunAngleTimeWithElevation(jd, latitude, longitude, elevation float64, tz *time.Location, date time.Time, angle float64, isDawn bool) time.Time {
	// Zenith = 90 + angle (angle below horizon)
	zenith := 90.0 + angle

	// Apply elevation adjustment - higher elevation means the horizon is depressed,
	// so we ADD the elevation adjustment to zenith for consistency with sunrise/sunset.
	elevationAdj := calcElevationAdjustment(elevation)
	adjustedZenith := zenith + elevationAdj

	return calcSunTimeForZenith(jd, latitude, longitude, tz, date, adjustedZenith, isDawn)
}

// calcSunTimeForZenith calculates the time when the sun reaches a specific zenith angle
func calcSunTimeForZenith(jd, latitude, longitude float64, tz *time.Location, date time.Time, zenith float64, isMorning bool) time.Time {
	// First pass: estimate using noon
	t := calcTimeJulianCent(jd)
	eqTime := calcEquationOfTime(t)
	solarDec := calcSunDeclination(t)
	hourAngle := calcHourAngleSunrise(latitude, solarDec, zenith)

	if math.IsNaN(hourAngle) {
		return time.Time{} // No sunrise/sunset at this location on this date
	}

	// Hour angle is positive. For morning times (sunrise, dawn), we subtract from solar noon.
	// For evening times (sunset, dusk), we add to solar noon.
	// The formula: solarNoon = 720 - 4*longitude - eqTime (minutes from midnight UTC)
	// sunrise = solarNoon - 4*hourAngle
	// sunset = solarNoon + 4*hourAngle
	var timeUTC float64
	if isMorning {
		timeUTC = 720 - longitude*4 - eqTime - hourAngle*4
	} else {
		timeUTC = 720 - longitude*4 - eqTime + hourAngle*4
	}

	// Second pass: refine calculation
	newt := calcTimeJulianCent(jd + timeUTC/1440.0)
	eqTime = calcEquationOfTime(newt)
	solarDec = calcSunDeclination(newt)
	hourAngle = calcHourAngleSunrise(latitude, solarDec, zenith)

	if math.IsNaN(hourAngle) {
		return time.Time{}
	}

	if isMorning {
		timeUTC = 720 - longitude*4 - eqTime - hourAngle*4
	} else {
		timeUTC = 720 - longitude*4 - eqTime + hourAngle*4
	}

	// Convert to local time
	hours := int(timeUTC / 60)
	minutesRemaining := timeUTC - float64(hours*60)
	minutes := int(minutesRemaining)
	seconds := int((minutesRemaining - float64(minutes)) * 60)

	// Handle day overflow/underflow
	dayOffset := 0
	if hours >= 24 {
		hours -= 24
		dayOffset = 1
	} else if hours < 0 {
		hours += 24
		dayOffset = -1
	}

	utcTime := time.Date(date.Year(), date.Month(), date.Day()+dayOffset, hours, minutes, seconds, 0, time.UTC)
	return utcTime.In(tz)
}
