package dsl

import (
	"testing"
)

func TestSunsetSunriseAliases(t *testing.T) {
	tests := []struct {
		name    string
		formula string
		wantErr bool
	}{
		{"sunset alias", "sunset - 15min", false},
		{"sunrise alias", "sunrise + 30min", false},
		{"conditional with sunset", "if ((solar(8, after_visible_sunset) - sunset) > 72min) { solar(8, after_visible_sunset) } else { sunset + 72min }", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Parse(tt.formula)
			if (err != nil) != tt.wantErr {
				t.Errorf("Parse() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
