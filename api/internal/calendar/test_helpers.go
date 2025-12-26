package calendar

import (
	"context"
	"strings"
)

// MockDBAdapter is a mock database adapter for testing
type MockDBAdapter struct {
	// EventMappings defines HebCal pattern -> tag mappings for testing
	EventMappings map[string]MockTagMatch
}

// MockTagMatch represents a mock tag match result
type MockTagMatch struct {
	TagKey                      string
	DisplayNameHebrew           string
	DisplayNameEnglishAshkenazi string
	DisplayNameEnglishSephardi  *string
	DurationDaysIsrael          int32
	DurationDaysDiaspora        int32
	FastStartType               *string
}

// MatchHebcalEvent implements DBAdapter interface
func (m *MockDBAdapter) MatchHebcalEvent(ctx context.Context, params MatchHebcalEventParams) ([]MatchHebcalEventRow, error) {
	// Try exact match first
	if match, found := m.EventMappings[params.HebcalTitle]; found {
		return []MatchHebcalEventRow{{
			TagKey:                      match.TagKey,
			DisplayNameHebrew:           match.DisplayNameHebrew,
			DisplayNameEnglishAshkenazi: match.DisplayNameEnglishAshkenazi,
			DisplayNameEnglishSephardi:  match.DisplayNameEnglishSephardi,
		}}, nil
	}

	// Try pattern matching (prefix match for multi-day events like "Chanukah:" or "Rosh Chodesh ")
	for pattern, match := range m.EventMappings {
		if (strings.HasSuffix(pattern, ":") || strings.HasSuffix(pattern, " ")) && strings.HasPrefix(params.HebcalTitle, pattern) {
			return []MatchHebcalEventRow{{
				TagKey:                      match.TagKey,
				DisplayNameHebrew:           match.DisplayNameHebrew,
				DisplayNameEnglishAshkenazi: match.DisplayNameEnglishAshkenazi,
				DisplayNameEnglishSephardi:  match.DisplayNameEnglishSephardi,
			}}, nil
		}
	}

	// No match found
	return nil, nil
}

// NewMockDBAdapter creates a mock DB adapter with standard event mappings
func NewMockDBAdapter() *MockDBAdapter {
	sephardi := func(s string) *string { return &s }
	fastDawn := "dawn"
	fastSunset := "sunset"

	return &MockDBAdapter{
		EventMappings: map[string]MockTagMatch{
			// Fast days
			"Asara B'Tevet": {
				TagKey:                      "asarah_bteves",
				DisplayNameHebrew:           "עשרה בטבת",
				DisplayNameEnglishAshkenazi: "Asarah B'Teves",
				DisplayNameEnglishSephardi:  sephardi("Asara B'Tevet"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastDawn,
			},
			"Yom Kippur": {
				TagKey:                      "yom_kippur",
				DisplayNameHebrew:           "יום כיפור",
				DisplayNameEnglishAshkenazi: "Yom Kippur",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastSunset,
			},
			"Tish'a B'Av": {
				TagKey:                      "tisha_bav",
				DisplayNameHebrew:           "תשעה באב",
				DisplayNameEnglishAshkenazi: "Tisha B'Av",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastSunset,
			},
			"Tzom Gedaliah": {
				TagKey:                      "tzom_gedaliah",
				DisplayNameHebrew:           "צום גדליה",
				DisplayNameEnglishAshkenazi: "Tzom Gedaliah",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastDawn,
			},
			"Ta'anit Esther": {
				TagKey:                      "taanis_esther",
				DisplayNameHebrew:           "תענית אסתר",
				DisplayNameEnglishAshkenazi: "Ta'anis Esther",
				DisplayNameEnglishSephardi:  sephardi("Ta'anit Esther"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastDawn,
			},
			"Shiva Asar B'Tamuz": {
				TagKey:                      "shiva_asar_btamuz",
				DisplayNameHebrew:           "שבעה עשר בתמוז",
				DisplayNameEnglishAshkenazi: "Shiva Asar B'Tamuz",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
				FastStartType:               &fastDawn,
			},

			// High Holidays
			"Rosh Hashana 5786": {
				TagKey:                      "rosh_hashanah",
				DisplayNameHebrew:           "ראש השנה",
				DisplayNameEnglishAshkenazi: "Rosh Hashanah",
				DisplayNameEnglishSephardi:  sephardi("Rosh HaShanah"),
				DurationDaysIsrael:          2,
				DurationDaysDiaspora:        2,
			},
			"Rosh Hashana II": {
				TagKey:                      "rosh_hashanah",
				DisplayNameHebrew:           "ראש השנה",
				DisplayNameEnglishAshkenazi: "Rosh Hashanah",
				DurationDaysIsrael:          2,
				DurationDaysDiaspora:        2,
			},

			// Sukkot
			"Sukkot I": {
				TagKey:                      "sukkos",
				DisplayNameHebrew:           "סוכות",
				DisplayNameEnglishAshkenazi: "Sukkos",
				DisplayNameEnglishSephardi:  sephardi("Sukkot"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Sukkot II": {
				TagKey:                      "sukkos",
				DisplayNameHebrew:           "סוכות",
				DisplayNameEnglishAshkenazi: "Sukkos",
				DisplayNameEnglishSephardi:  sephardi("Sukkot"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Sukkot V (CH''M)": {
				TagKey:                      "chol_hamoed_sukkos",
				DisplayNameHebrew:           "חול המועד סוכות",
				DisplayNameEnglishAshkenazi: "Chol HaMoed Sukkos",
				DisplayNameEnglishSephardi:  sephardi("Chol HaMoed Sukkot"),
				DurationDaysIsrael:          5,
				DurationDaysDiaspora:        4,
			},
			"Sukkot VII (Hoshana Raba)": {
				TagKey:                      "hoshanah_rabbah",
				DisplayNameHebrew:           "הושענא רבה",
				DisplayNameEnglishAshkenazi: "Hoshanah Rabbah",
				DisplayNameEnglishSephardi:  sephardi("Hoshana Rabbah"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},
			"Shmini Atzeret": {
				TagKey:                      "shemini_atzeres",
				DisplayNameHebrew:           "שמיני עצרת",
				DisplayNameEnglishAshkenazi: "Shemini Atzeres",
				DisplayNameEnglishSephardi:  sephardi("Shemini Atzeret"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},
			"Simchat Torah": {
				TagKey:                      "shemini_atzeres",
				DisplayNameHebrew:           "שמחת תורה",
				DisplayNameEnglishAshkenazi: "Simchas Torah",
				DisplayNameEnglishSephardi:  sephardi("Simchat Torah"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},

			// Chanukah (pattern match for "Chanukah Day X")
			"Chanukah:": {
				TagKey:                      "chanukah",
				DisplayNameHebrew:           "חנוכה",
				DisplayNameEnglishAshkenazi: "Chanukah",
				DisplayNameEnglishSephardi:  sephardi("Hanukkah"),
				DurationDaysIsrael:          8,
				DurationDaysDiaspora:        8,
			},

			// Pesach
			"Pesach I": {
				TagKey:                      "pesach_first",
				DisplayNameHebrew:           "פסח",
				DisplayNameEnglishAshkenazi: "Pesach",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Pesach II": {
				TagKey:                      "pesach_first",
				DisplayNameHebrew:           "פסח",
				DisplayNameEnglishAshkenazi: "Pesach",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Pesach IV (CH''M)": {
				TagKey:                      "chol_hamoed_pesach",
				DisplayNameHebrew:           "חול המועד פסח",
				DisplayNameEnglishAshkenazi: "Chol HaMoed Pesach",
				DurationDaysIsrael:          4,
				DurationDaysDiaspora:        4,
			},
			"Pesach VII": {
				TagKey:                      "pesach_last",
				DisplayNameHebrew:           "שביעי של פסח",
				DisplayNameEnglishAshkenazi: "Pesach VII",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Pesach VIII": {
				TagKey:                      "pesach_last",
				DisplayNameHebrew:           "אחרון של פסח",
				DisplayNameEnglishAshkenazi: "Pesach VIII",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},

			// Shavuot
			"Shavuot I": {
				TagKey:                      "shavuos",
				DisplayNameHebrew:           "שבועות",
				DisplayNameEnglishAshkenazi: "Shavuos",
				DisplayNameEnglishSephardi:  sephardi("Shavuot"),
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},
			"Shavuot II": {
				TagKey:                      "shavuos",
				DisplayNameHebrew:           "שבועות",
				DisplayNameEnglishAshkenazi: "Shavuos",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        2,
			},

			// Purim
			"Purim": {
				TagKey:                      "purim",
				DisplayNameHebrew:           "פורים",
				DisplayNameEnglishAshkenazi: "Purim",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},
			"Shushan Purim": {
				TagKey:                      "shushan_purim",
				DisplayNameHebrew:           "שושן פורים",
				DisplayNameEnglishAshkenazi: "Shushan Purim",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},

			// Rosh Chodesh (pattern match for "Rosh Chodesh Sh'vat" etc)
			"Rosh Chodesh": {
				TagKey:                      "rosh_chodesh",
				DisplayNameHebrew:           "ראש חודש",
				DisplayNameEnglishAshkenazi: "Rosh Chodesh",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},
			"Rosh Chodesh ": {
				TagKey:                      "rosh_chodesh",
				DisplayNameHebrew:           "ראש חודש",
				DisplayNameEnglishAshkenazi: "Rosh Chodesh",
				DurationDaysIsrael:          1,
				DurationDaysDiaspora:        1,
			},
		},
	}
}
