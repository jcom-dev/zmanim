package dsl

// ParameterDoc describes a function parameter
type ParameterDoc struct {
	Name         string
	Type         string
	Description  string
	ExampleValue string
}

// FunctionDoc contains documentation for a DSL function
type FunctionDoc struct {
	Name              string
	Purpose           string
	Syntax            string
	Parameters        []ParameterDoc
	ExampleUsage      string
	ResultExplanation string
	Icon              string
}

// FunctionsReference contains documentation for all supported functions
var FunctionsReference = map[string]FunctionDoc{
	"solar": {
		Name:    "solar",
		Purpose: "Returns the time when the sun reaches a specific angle below or above the horizon in a specified direction.",
		Syntax:  "solar(angle, direction)",
		Parameters: []ParameterDoc{
			{
				Name:         "angle",
				Type:         "number (decimal)",
				Description:  "Solar depression angle in degrees. Positive values are below the horizon (dawn/dusk), negative values are above the horizon.",
				ExampleValue: "16.1 (for Alos HaShachar per many opinions)",
			},
			{
				Name:         "direction",
				Type:         "direction keyword",
				Description:  "Specifies when to calculate the angle: before_visible_sunrise, after_visible_sunrise, before_visible_sunset, after_visible_sunset, before_geometric_sunrise, after_geometric_sunrise, before_geometric_sunset, after_geometric_sunset, before_noon, after_noon",
				ExampleValue: "before_visible_sunrise",
			},
		},
		ExampleUsage:      "solar(16.1, before_visible_sunrise)",
		ResultExplanation: "Returns the time when the sun is 16.1 degrees below the horizon in the morning (before sunrise). This is commonly used for Alos HaShachar (dawn).",
		Icon:              "angle",
	},

	"seasonal_solar": {
		Name:    "seasonal_solar",
		Purpose: "Calculates twilight times using proportional scaling based on equinox offset. Used by Rabbi Ovadia Yosef and Zemaneh-Yosef methodology.",
		Syntax:  "seasonal_solar(angle, direction)",
		Parameters: []ParameterDoc{
			{
				Name:         "angle",
				Type:         "number (decimal)",
				Description:  "Reference angle at equinox in degrees.",
				ExampleValue: "16.1",
			},
			{
				Name:         "direction",
				Type:         "direction keyword",
				Description:  "Same as solar() function.",
				ExampleValue: "before_visible_sunrise",
			},
		},
		ExampleUsage:      "seasonal_solar(16.1, before_visible_sunrise)",
		ResultExplanation: "Calculates equinox offset (sunrise - solar(16.1) at equinox), then scales by day length ratio. More lenient than fixed-angle method in winter, stricter in summer.",
		Icon:              "calendar",
	},

	"proportional_hours": {
		Name:    "proportional_hours",
		Purpose: "Divides the halachic day into 12 proportional hours (shaos zmaniyos) and returns a time offset from the start of the day.",
		Syntax:  "proportional_hours(hours, base)",
		Parameters: []ParameterDoc{
			{
				Name:         "hours",
				Type:         "number (decimal)",
				Description:  "Number of proportional hours from start of halachic day. Can include fractions (e.g., 3.5 for 3.5 hours).",
				ExampleValue: "3 (for Sof Zman Shema GRA)",
			},
			{
				Name:         "base",
				Type:         "base keyword",
				Description:  "Defines the boundaries of the halachic day: gra (sunrise to sunset), mga (72 min before sunrise to 72 min after sunset), mga_16_1 (16.1 degrees to 16.1 degrees), mga_18 (18 degrees to 18 degrees), baal_hatanya (1.583 degrees to 1.583 degrees), custom(start, end)",
				ExampleValue: "gra",
			},
		},
		ExampleUsage:      "proportional_hours(3, gra)",
		ResultExplanation: "Returns the time that is 3/12 (1/4) of the day after sunrise (GRA day = sunrise to sunset). This is Sof Zman Shema according to the GRA.",
		Icon:              "clock",
	},

	"proportional_minutes": {
		Name:    "proportional_minutes",
		Purpose: "Similar to proportional_hours but uses proportional minutes before/after sunrise/sunset. Used for calculating offset-based zmanim.",
		Syntax:  "proportional_minutes(minutes, direction, base)",
		Parameters: []ParameterDoc{
			{
				Name:         "minutes",
				Type:         "number (decimal)",
				Description:  "Number of proportional minutes as a fraction of the day length.",
				ExampleValue: "72",
			},
			{
				Name:         "direction",
				Type:         "direction keyword",
				Description:  "before_visible_sunrise, after_visible_sunset, etc.",
				ExampleValue: "before_visible_sunrise",
			},
			{
				Name:         "base",
				Type:         "base keyword",
				Description:  "Day definition (gra, mga, etc.)",
				ExampleValue: "gra",
			},
		},
		ExampleUsage:      "proportional_minutes(72, before_visible_sunrise, gra)",
		ResultExplanation: "Returns the time that is 72 zmaniyos minutes (1/10 of GRA day) before sunrise. Used for MGA 72 zmaniyos variant.",
		Icon:              "timer",
	},

	"midpoint": {
		Name:    "midpoint",
		Purpose: "Returns the midpoint (average) time between two zmanim.",
		Syntax:  "midpoint(time1, time2)",
		Parameters: []ParameterDoc{
			{
				Name:         "time1",
				Type:         "time expression",
				Description:  "First time (primitive, function result, or reference).",
				ExampleValue: "visible_sunset",
			},
			{
				Name:         "time2",
				Type:         "time expression",
				Description:  "Second time.",
				ExampleValue: "astronomical_dusk",
			},
		},
		ExampleUsage:      "midpoint(visible_sunset, astronomical_dusk)",
		ResultExplanation: "Returns the time exactly halfway between sunset and tzeis (18 degrees). Used for some opinions on bein hashmashos.",
		Icon:              "arrow-both",
	},

	"first_valid": {
		Name:    "first_valid",
		Purpose: "Returns the first non-null value from a list of time expressions. Used for fallback calculations at extreme latitudes.",
		Syntax:  "first_valid(time1, time2, ...)",
		Parameters: []ParameterDoc{
			{
				Name:         "time1, time2, ...",
				Type:         "time expression (variadic)",
				Description:  "List of time expressions. Evaluated left to right until a valid (non-null) result is found.",
				ExampleValue: "solar(16.1, before_visible_sunrise), visible_sunrise - 72min",
			},
		},
		ExampleUsage:      "first_valid(solar(16.1, before_visible_sunrise), visible_sunrise - 72min)",
		ResultExplanation: "If solar(16.1) is calculable, returns that. Otherwise (e.g., white nights at high latitudes), falls back to fixed 72-minute offset.",
		Icon:              "refresh",
	},

	"earlier_of": {
		Name:    "earlier_of",
		Purpose: "Returns the earlier of two zmanim.",
		Syntax:  "earlier_of(time1, time2)",
		Parameters: []ParameterDoc{
			{
				Name:         "time1",
				Type:         "time expression",
				Description:  "First time to compare.",
				ExampleValue: "solar(8.5, after_visible_sunset)",
			},
			{
				Name:         "time2",
				Type:         "time expression",
				Description:  "Second time to compare.",
				ExampleValue: "visible_sunset + 50min",
			},
		},
		ExampleUsage:      "earlier_of(solar(8.5, after_visible_sunset), visible_sunset + 50min)",
		ResultExplanation: "Returns whichever time comes first. Useful for stringent (machmir) opinions.",
		Icon:              "arrow-left",
	},

	"later_of": {
		Name:    "later_of",
		Purpose: "Returns the later of two zmanim.",
		Syntax:  "later_of(time1, time2)",
		Parameters: []ParameterDoc{
			{
				Name:         "time1",
				Type:         "time expression",
				Description:  "First time to compare.",
				ExampleValue: "solar(8.5, after_visible_sunset)",
			},
			{
				Name:         "time2",
				Type:         "time expression",
				Description:  "Second time to compare.",
				ExampleValue: "visible_sunset + 30min",
			},
		},
		ExampleUsage:      "later_of(solar(8.5, after_visible_sunset), visible_sunset + 30min)",
		ResultExplanation: "Returns whichever time comes last. Useful for lenient (meikil) opinions or ensuring a minimum waiting period.",
		Icon:              "arrow-right",
	},

	"+": {
		Name:    "Addition (+)",
		Purpose: "Adds a duration to a time value.",
		Syntax:  "time + duration",
		Parameters: []ParameterDoc{
			{
				Name:         "time",
				Type:         "time expression",
				Description:  "Base time value.",
				ExampleValue: "visible_sunset",
			},
			{
				Name:         "duration",
				Type:         "duration (e.g., 18min, 1h30min)",
				Description:  "Amount of time to add.",
				ExampleValue: "18min",
			},
		},
		ExampleUsage:      "visible_sunset + 18min",
		ResultExplanation: "Returns the time 18 minutes after visible sunset. Commonly used for candle lighting times.",
		Icon:              "plus",
	},

	"-": {
		Name:    "Subtraction (-)",
		Purpose: "Subtracts a duration from a time value.",
		Syntax:  "time - duration",
		Parameters: []ParameterDoc{
			{
				Name:         "time",
				Type:         "time expression",
				Description:  "Base time value.",
				ExampleValue: "visible_sunset",
			},
			{
				Name:         "duration",
				Type:         "duration (e.g., 18min, 1h30min)",
				Description:  "Amount of time to subtract.",
				ExampleValue: "40min",
			},
		},
		ExampleUsage:      "visible_sunset - 40min",
		ResultExplanation: "Returns the time 40 minutes before visible sunset. Used for Plag HaMincha and other offset-based zmanim.",
		Icon:              "minus",
	},
}

// GetFunctionDoc returns the documentation for a function, or nil if not found
func GetFunctionDoc(name string) *FunctionDoc {
	if doc, ok := FunctionsReference[name]; ok {
		return &doc
	}
	return nil
}

// GetAllFunctions returns all function documentation as a slice
func GetAllFunctions() []FunctionDoc {
	result := make([]FunctionDoc, 0, len(FunctionsReference))
	for _, doc := range FunctionsReference {
		result = append(result, doc)
	}
	return result
}
