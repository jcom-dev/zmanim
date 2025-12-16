#!/bin/bash
# Test what misheyakir angle MBD might be using
cd /home/coder/workspace/zmanim
source api/.env

echo "Testing what solar angle produces MBD's Misheyakir times"
echo ""

# Create a temporary Go file to test various angles
cat > /tmp/find_angle.go << 'GOEOF'
package main

import (
    "fmt"
    "math"
    "time"
)

func solarAngle(date time.Time, lat, lon, angle float64, loc *time.Location) time.Time {
    // Use the NOAA solar calculator algorithm
    jd := julianDay(date)
    jc := julianCentury(jd)

    // Calculate sunrise for reference
    sunriseLHA := hourAngle(lat, solarDeclination(jc), -0.833)
    solarNoon := solarNoonUTC(jc, lon)
    sunriseUTC := solarNoon - sunriseLHA*4 // in minutes

    // Calculate the angle time
    angleLHA := hourAngle(lat, solarDeclination(jc), -angle) // negative for below horizon
    angleTime := solarNoon - angleLHA*4 // in minutes

    hours := int(angleTime / 60)
    minutes := int(angleTime) % 60
    seconds := int((angleTime - float64(int(angleTime))) * 60)

    return time.Date(date.Year(), date.Month(), date.Day(), hours, minutes, seconds, 0, time.UTC).In(loc)
}

func julianDay(date time.Time) float64 {
    y := float64(date.Year())
    m := float64(date.Month())
    d := float64(date.Day())

    if m <= 2 {
        y--
        m += 12
    }

    a := math.Floor(y / 100)
    b := 2 - a + math.Floor(a/4)

    return math.Floor(365.25*(y+4716)) + math.Floor(30.6001*(m+1)) + d + b - 1524.5
}

func julianCentury(jd float64) float64 {
    return (jd - 2451545.0) / 36525.0
}

func solarNoonUTC(jc, longitude float64) float64 {
    // Equation of time
    b := (360.0 / 365.24) * (julianCentury(2451545.0+jc*36525.0)*36525 - 79.5)
    eot := 9.87*math.Sin(2*b*math.Pi/180) - 7.53*math.Cos(b*math.Pi/180) - 1.5*math.Sin(b*math.Pi/180)

    return 720 - 4*longitude - eot
}

func solarDeclination(jc float64) float64 {
    obliquity := 23.439 - 0.0000004*jc*36525
    longitude := 280.46646 + 36000.76983*jc + 0.0003032*jc*jc
    anomaly := 357.52911 + 35999.05029*jc - 0.0001537*jc*jc

    equation := math.Sin(anomaly*math.Pi/180)*(1.9146-0.004817*jc-0.000014*jc*jc) +
        math.Sin(2*anomaly*math.Pi/180)*(0.019993-0.000101*jc) +
        math.Sin(3*anomaly*math.Pi/180)*0.00029

    sunLongitude := longitude + equation

    return math.Asin(math.Sin(obliquity*math.Pi/180)*math.Sin(sunLongitude*math.Pi/180)) * 180 / math.Pi
}

func hourAngle(lat, declination, elevation float64) float64 {
    latRad := lat * math.Pi / 180
    decRad := declination * math.Pi / 180
    elevRad := elevation * math.Pi / 180

    cosHA := (math.Sin(elevRad) - math.Sin(latRad)*math.Sin(decRad)) / (math.Cos(latRad) * math.Cos(decRad))

    if cosHA > 1 || cosHA < -1 {
        return 0 // Sun doesn't reach this angle
    }

    return math.Acos(cosHA) * 180 / math.Pi
}

func main() {
    loc, _ := time.LoadLocation("Europe/London")
    lat := 53.508945047109776
    lon := -2.258496600758501

    testCases := []struct {
        date    string
        mbdTime string
    }{
        {"2025-09-27", "05:55"},
        {"2025-10-04", "06:08"},
    }

    fmt.Println("Finding what solar angle matches MBD Misheyakir times")
    fmt.Println("======================================================")

    for _, tc := range testCases {
        date, _ := time.ParseInLocation("2006-01-02", tc.date, loc)
        mbdTime, _ := time.ParseInLocation("15:04", tc.mbdTime, loc)
        mbdTime = time.Date(date.Year(), date.Month(), date.Day(), mbdTime.Hour(), mbdTime.Minute(), 0, 0, loc)

        fmt.Printf("\nDate: %s, MBD Time: %s\n", tc.date, tc.mbdTime)

        // Test various angles
        for angle := 10.0; angle <= 13.0; angle += 0.1 {
            result := solarAngle(date, lat, lon, angle, loc)
            diff := result.Sub(mbdTime).Minutes()
            if math.Abs(diff) <= 2 {
                fmt.Printf("  Angle %.1f°: %s (diff: %.0f min) <- CLOSE MATCH\n", angle, result.Format("15:04:05"), diff)
            }
        }

        // Also test raw 11.5° (our documented angle)
        result115 := solarAngle(date, lat, lon, 11.5, loc)
        fmt.Printf("\n  11.5° raw: %s\n", result115.Format("15:04:05"))
        fmt.Printf("  11.5° + 15min: %s\n", result115.Add(15*time.Minute).Format("15:04:05"))
    }
}
GOEOF

go run /tmp/find_angle.go
