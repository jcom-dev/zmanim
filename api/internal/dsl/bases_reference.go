package dsl

// BaseDoc contains documentation for a DSL base (day definition for proportional times)
type BaseDoc struct {
	Name       string
	Definition string
	DayStart   string // Human-readable description of when day starts
	DayEnd     string // Human-readable description of when day ends
	Source     string // Halachic source/authority
	Icon       string // Emoji for visual representation
}

// BasesReference contains documentation for all supported bases
var BasesReference = map[string]BaseDoc{
	"gra": {
		Name:       "gra",
		Definition: "The Vilna Gaon's (GRA) day definition, using visible sunrise to visible sunset. This is the most common opinion and represents the standard halachic day.",
		DayStart:   "Visible sunrise (hanetz hachama)",
		DayEnd:     "Visible sunset (shkiah)",
		Source:     "Vilna Gaon (Rabbi Eliyahu of Vilna, 1720-1797)",
		Icon:       "sun",
	},
	"mga": {
		Name:       "mga",
		Definition: "Magen Avraham's day definition, extending 72 fixed minutes before visible sunrise and after visible sunset. Based on the time it takes to walk 4 mil (approximately 72 minutes).",
		DayStart:   "72 minutes before visible sunrise",
		DayEnd:     "72 minutes after visible sunset",
		Source:     "Magen Avraham (Rabbi Avraham Gombiner, 1635-1682)",
		Icon:       "clock",
	},
	"mga_72": {
		Name:       "mga_72",
		Definition: "Explicit 72-minute MGA variant. Same as 'mga' but explicitly specifies the 72-minute offset.",
		DayStart:   "72 minutes before visible sunrise",
		DayEnd:     "72 minutes after visible sunset",
		Source:     "Magen Avraham",
		Icon:       "clock",
	},
	"mga_60": {
		Name:       "mga_60",
		Definition: "MGA variant using 60 fixed minutes. Some opinions hold this represents the walking time of 4 mil.",
		DayStart:   "60 minutes before visible sunrise",
		DayEnd:     "60 minutes after visible sunset",
		Source:     "Various poskim",
		Icon:       "clock",
	},
	"mga_90": {
		Name:       "mga_90",
		Definition: "MGA variant using 90 fixed minutes. Represents a stricter interpretation of the time to walk 4 mil.",
		DayStart:   "90 minutes before visible sunrise",
		DayEnd:     "90 minutes after visible sunset",
		Source:     "Various poskim",
		Icon:       "clock",
	},
	"mga_96": {
		Name:       "mga_96",
		Definition: "MGA variant using 96 fixed minutes (1.5 hours + 6 minutes). Used by some communities.",
		DayStart:   "96 minutes before visible sunrise",
		DayEnd:     "96 minutes after visible sunset",
		Source:     "Various poskim",
		Icon:       "clock",
	},
	"mga_120": {
		Name:       "mga_120",
		Definition: "MGA variant using 120 fixed minutes (2 hours). Represents 5 mil walking time according to some opinions.",
		DayStart:   "120 minutes before visible sunrise",
		DayEnd:     "120 minutes after visible sunset",
		Source:     "Various poskim",
		Icon:       "clock",
	},
	"mga_72_zmanis": {
		Name:       "mga_72_zmanis",
		Definition: "MGA with proportional 72 minutes (1/10th of daylight). The offset varies with day length, being longer in summer and shorter in winter.",
		DayStart:   "1/10th of daylight before visible sunrise",
		DayEnd:     "1/10th of daylight after visible sunset",
		Source:     "Magen Avraham (proportional interpretation)",
		Icon:       "calendar",
	},
	"mga_90_zmanis": {
		Name:       "mga_90_zmanis",
		Definition: "MGA with proportional 90 minutes (1/8th of daylight). Proportional variant that adjusts based on season.",
		DayStart:   "1/8th of daylight before visible sunrise",
		DayEnd:     "1/8th of daylight after visible sunset",
		Source:     "Various poskim",
		Icon:       "calendar",
	},
	"mga_96_zmanis": {
		Name:       "mga_96_zmanis",
		Definition: "MGA with proportional 96 minutes (1/7.5th of daylight). Proportional variant for stricter opinions.",
		DayStart:   "1/7.5th of daylight before visible sunrise",
		DayEnd:     "1/7.5th of daylight after visible sunset",
		Source:     "Various poskim",
		Icon:       "calendar",
	},
	"mga_16_1": {
		Name:       "mga_16_1",
		Definition: "MGA based on solar angle of 16.1 degrees. This angle corresponds to approximately 72 minutes at the Jerusalem equinox.",
		DayStart:   "Sun at 16.1° below horizon (alos)",
		DayEnd:     "Sun at 16.1° below horizon (tzais)",
		Source:     "Rabbi Moshe Feinstein",
		Icon:       "angle",
	},
	"mga_18": {
		Name:       "mga_18",
		Definition: "MGA based on astronomical twilight (18 degrees). Represents complete darkness/first light.",
		DayStart:   "Sun at 18° below horizon (astronomical dawn)",
		DayEnd:     "Sun at 18° below horizon (astronomical dusk)",
		Source:     "Various poskim",
		Icon:       "angle",
	},
	"mga_19_8": {
		Name:       "mga_19_8",
		Definition: "MGA based on 19.8 degree solar angle. Corresponds to approximately 90 minutes at the Jerusalem equinox.",
		DayStart:   "Sun at 19.8° below horizon",
		DayEnd:     "Sun at 19.8° below horizon",
		Source:     "Various poskim",
		Icon:       "angle",
	},
	"mga_26": {
		Name:       "mga_26",
		Definition: "MGA based on 26 degree solar angle. Corresponds to approximately 120 minutes at the Jerusalem equinox.",
		DayStart:   "Sun at 26° below horizon",
		DayEnd:     "Sun at 26° below horizon",
		Source:     "Various poskim",
		Icon:       "angle",
	},
	"baal_hatanya": {
		Name:       "baal_hatanya",
		Definition: "Shulchan Aruch HaRav/Chabad opinion. Uses 1.583 degrees below horizon for netz amiti (true sunrise) and shkiah amiti (true sunset).",
		DayStart:   "Sun at 1.583° below horizon (netz amiti)",
		DayEnd:     "Sun at 1.583° below horizon (shkiah amiti)",
		Source:     "Shulchan Aruch HaRav (Rabbi Shneur Zalman of Liadi)",
		Icon:       "book",
	},
}

// GetBaseDoc returns the documentation for a base, or nil if not found
func GetBaseDoc(name string) *BaseDoc {
	if doc, ok := BasesReference[name]; ok {
		return &doc
	}
	return nil
}

// GetAllBases returns all base documentation as a slice
func GetAllBases() []BaseDoc {
	result := make([]BaseDoc, 0, len(BasesReference))
	for _, doc := range BasesReference {
		result = append(result, doc)
	}
	return result
}
