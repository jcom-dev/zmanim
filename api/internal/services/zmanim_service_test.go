package services

import (
	"testing"
)

func TestShouldShowZman_TimingTags(t *testing.T) {
	service := &ZmanimService{}

	tests := []struct {
		name             string
		tags             []EventFilterTag
		activeEventCodes []string
		expected         bool
	}{
		{
			name: "shabbos + day_before matches erev_shabbos",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         true,
		},
		{
			name: "shabbos without day_before does NOT match erev_shabbos",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         false,
		},
		{
			name: "pesach + day_before matches erev_pesach",
			tags: []EventFilterTag{
				{TagKey: "pesach", TagType: "event", IsNegated: false},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"erev_pesach"},
			expected:         true,
		},
		{
			name: "direct event match still works",
			tags: []EventFilterTag{
				{TagKey: "erev_shabbos", TagType: "event", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         true,
		},
		{
			name: "shabbos matches shabbos directly (for motzei zmanim)",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
				{TagKey: "motzei", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"shabbos"},
			expected:         true,
		},
		{
			name: "no event tags - always show",
			tags: []EventFilterTag{
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         true,
		},
		{
			name: "negated tag takes precedence",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
				{TagKey: "yom_tov", TagType: "event", IsNegated: true},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos", "yom_tov"},
			expected:         false,
		},
		{
			name: "multiple event tags - one match is enough",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
				{TagKey: "pesach", TagType: "event", IsNegated: false},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         true,
		},
		{
			name: "shita tags are ignored",
			tags: []EventFilterTag{
				{TagKey: "shita_gra", TagType: "shita", IsNegated: false},
			},
			activeEventCodes: []string{"erev_shabbos"},
			expected:         true,
		},
		{
			name: "day_before + shabbos does NOT match shabbos directly (candle lighting bug fix)",
			tags: []EventFilterTag{
				{TagKey: "shabbos", TagType: "event", IsNegated: false},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"shabbos"}, // On Shabbos itself, NOT erev
			expected:         false,               // Should NOT show candle lighting on Shabbos!
		},
		{
			name: "day_before + yom_tov does NOT match yom_tov directly",
			tags: []EventFilterTag{
				{TagKey: "yom_tov", TagType: "event", IsNegated: false},
				{TagKey: "day_before", TagType: "timing", IsNegated: false},
			},
			activeEventCodes: []string{"yom_tov"}, // On Yom Tov itself
			expected:         false,               // Should NOT show candle lighting on Yom Tov!
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.ShouldShowZman(tt.tags, tt.activeEventCodes)
			if result != tt.expected {
				t.Errorf("ShouldShowZman() = %v, want %v", result, tt.expected)
			}
		})
	}
}
