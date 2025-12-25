package calendar

import (
	"testing"
)

func TestGetTransliteratedName(t *testing.T) {
	tests := []struct {
		name                 string
		inputName            string
		transliterationStyle string
		expected             string
	}{
		{
			name:                 "Shabbat - Ashkenazi",
			inputName:            "Shabbat",
			transliterationStyle: "ashkenazi",
			expected:             "Shabbos",
		},
		{
			name:                 "Shabbat - Sephardi",
			inputName:            "Shabbat",
			transliterationStyle: "sephardi",
			expected:             "Shabbat",
		},
		{
			name:                 "Sukkot - Ashkenazi",
			inputName:            "Sukkot",
			transliterationStyle: "ashkenazi",
			expected:             "Sukkos",
		},
		{
			name:                 "Sukkot - Sephardi",
			inputName:            "Sukkot",
			transliterationStyle: "sephardi",
			expected:             "Sukkot",
		},
		{
			name:                 "Shavuot - Ashkenazi",
			inputName:            "Shavuot",
			transliterationStyle: "ashkenazi",
			expected:             "Shavuos",
		},
		{
			name:                 "Shavuot - Sephardi",
			inputName:            "Shavuot",
			transliterationStyle: "sephardi",
			expected:             "Shavuot",
		},
		{
			name:                 "Unknown name returns original",
			inputName:            "Unknown Holiday",
			transliterationStyle: "ashkenazi",
			expected:             "Unknown Holiday",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetTransliteratedName(tt.inputName, tt.transliterationStyle)
			if result != tt.expected {
				t.Errorf("GetTransliteratedName(%q, %q) = %q, expected %q",
					tt.inputName, tt.transliterationStyle, result, tt.expected)
			}
		})
	}
}
