package dsl

// PrimitiveDoc contains documentation for a DSL primitive
type PrimitiveDoc struct {
	Name              string
	Definition        string
	CalculationMethod string
	ScientificSource  string
	Icon              string // Emoji for visual representation in PDF
}

// PrimitivesReference contains documentation for all supported primitives
var PrimitivesReference = map[string]PrimitiveDoc{
	"visible_sunrise": {
		Name:              "visible_sunrise",
		Definition:        "The moment when the upper limb (top edge) of the sun first appears above the horizon as seen by an observer. This accounts for atmospheric refraction which bends light.",
		CalculationMethod: "Calculated using NOAA Solar Position Algorithm with zenith angle 90.833 degrees (accounting for 0.833 degree correction from atmospheric refraction ~0.567 degrees + solar semi-diameter ~0.266 degrees). Uses spherical trigonometry to determine when sun's center crosses the apparent horizon.",
		ScientificSource:  "NOAA Solar Calculator (National Oceanic and Atmospheric Administration), Jean Meeus 'Astronomical Algorithms' (2nd edition, Willmann-Bell, 1998)",
		Icon:              "sunrise",
	},
	"visible_sunset": {
		Name:              "visible_sunset",
		Definition:        "The moment when the last visible edge of the sun disappears below the horizon, accounting for atmospheric refraction.",
		CalculationMethod: "Same NOAA algorithm as visible_sunrise, calculating when the sun's upper limb reaches the western apparent horizon (zenith 90.833 degrees).",
		ScientificSource:  "NOAA Solar Calculator, US Naval Observatory Astronomical Applications Department",
		Icon:              "sunset",
	},
	"geometric_sunrise": {
		Name:              "geometric_sunrise",
		Definition:        "Theoretical moment when the geometric center of the sun crosses the geometric horizon (0 degree altitude), without corrections for atmospheric refraction.",
		CalculationMethod: "NOAA algorithm using zenith angle 90 degrees (pure geometric horizon). Represents mathematical moment, not observed phenomenon. Occurs ~2-4 minutes after visible sunrise.",
		ScientificSource:  "NOAA Solar Calculator, spherical astronomy principles",
		Icon:              "sunrise",
	},
	"geometric_sunset": {
		Name:              "geometric_sunset",
		Definition:        "Theoretical moment when the geometric center of the sun crosses the geometric horizon in the evening, without refraction correction.",
		CalculationMethod: "NOAA algorithm with zenith 90 degrees. Occurs ~2-3 minutes before visible sunset.",
		ScientificSource:  "NOAA Solar Calculator",
		Icon:              "sunset",
	},
	"solar_noon": {
		Name:              "solar_noon",
		Definition:        "The moment when the sun crosses the local meridian and reaches its highest point in the sky. Shadows point exactly north/south at this instant.",
		CalculationMethod: "Calculated using Equation of Time (EoT) to correct from mean solar time to apparent solar time. Formula: noon_UTC = 720 - 4 x longitude - EoT (minutes from midnight). EoT accounts for Earth's elliptical orbit and axial tilt.",
		ScientificSource:  "NOAA Solar Calculator, Equation of Time derivation from Meeus",
		Icon:              "sun",
	},
	"solar_midnight": {
		Name:              "solar_midnight",
		Definition:        "The moment when the sun is at its lowest point, directly opposite to its noon position (anti-transit). Sun is on opposite side of Earth.",
		CalculationMethod: "Calculated as 12 hours after solar noon, with minor adjustment for changing Equation of Time during the 12-hour period.",
		ScientificSource:  "Spherical astronomy principles",
		Icon:              "moon",
	},
	"civil_dawn": {
		Name:              "civil_dawn",
		Definition:        "When the sun's center is 6 degrees below the horizon. Enough natural light for most outdoor activities without artificial lighting. Horizon clearly visible.",
		CalculationMethod: "NOAA algorithm with zenith angle 96 degrees (90 + 6). Includes elevation adjustment for extended horizon.",
		ScientificSource:  "US Naval Observatory twilight definitions, FAA aviation regulations",
		Icon:              "twilight",
	},
	"civil_dusk": {
		Name:              "civil_dusk",
		Definition:        "When the sun is 6 degrees below the horizon in evening. After this point, artificial lighting becomes necessary.",
		CalculationMethod: "NOAA algorithm, zenith 96 degrees for evening.",
		ScientificSource:  "USNO, International Earth Rotation Service (IERS)",
		Icon:              "twilight",
	},
	"nautical_dawn": {
		Name:              "nautical_dawn",
		Definition:        "When the sun is 12 degrees below the horizon. The horizon becomes visible at sea, allowing sailors to take star sightings while seeing the horizon line.",
		CalculationMethod: "NOAA algorithm, zenith 102 degrees (90 + 12).",
		ScientificSource:  "Nautical Almanac Office, maritime navigation standards",
		Icon:              "ship",
	},
	"nautical_dusk": {
		Name:              "nautical_dusk",
		Definition:        "When the sun is 12 degrees below the horizon in evening. Horizon at sea becomes indistinguishable from sky.",
		CalculationMethod: "NOAA algorithm, zenith 102 degrees for evening.",
		ScientificSource:  "US Naval Observatory",
		Icon:              "ship",
	},
	"astronomical_dawn": {
		Name:              "astronomical_dawn",
		Definition:        "When the sun is 18 degrees below the horizon. Before this, the sky is completely dark (no moon/light pollution). Earliest faint glow on eastern horizon.",
		CalculationMethod: "NOAA algorithm, zenith 108 degrees (90 + 18). Represents boundary between astronomical night and twilight.",
		ScientificSource:  "NOAA, USNO, KosherJava Zmanim Library",
		Icon:              "star",
	},
	"astronomical_dusk": {
		Name:              "astronomical_dusk",
		Definition:        "When the sun is 18 degrees below the horizon in evening. After this, the sky is completely dark for astronomical observations.",
		CalculationMethod: "NOAA algorithm, zenith 108 degrees for evening.",
		ScientificSource:  "USNO, astronomical observatories worldwide",
		Icon:              "star",
	},
}

// GetPrimitiveDoc returns the documentation for a primitive, or nil if not found
func GetPrimitiveDoc(name string) *PrimitiveDoc {
	if doc, ok := PrimitivesReference[name]; ok {
		return &doc
	}
	return nil
}

// GetAllPrimitives returns all primitive documentation as a slice
func GetAllPrimitives() []PrimitiveDoc {
	result := make([]PrimitiveDoc, 0, len(PrimitivesReference))
	for _, doc := range PrimitivesReference {
		result = append(result, doc)
	}
	return result
}
