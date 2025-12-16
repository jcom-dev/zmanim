package validation

import "testing"

func TestContainsHebrew(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"Hebrew only", "עלות השחר", true},
		{"Hebrew with English", "Alos עלות", true},
		{"English only", "Dawn", false},
		{"Numbers only", "123", false},
		{"Empty", "", false},
		{"Mixed with punctuation", "סוף זמן שמע גר״א", true},
		{"Single Hebrew char", "א", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ContainsHebrew(tt.input); got != tt.want {
				t.Errorf("ContainsHebrew(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestCountHebrewChars(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"Hebrew only", "עלות השחר", 8}, // 4 + 4 Hebrew chars
		{"Hebrew with spaces", "עלות השחר", 8},
		{"English only", "Dawn", 0},
		{"Empty", "", 0},
		{"Single char", "א", 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CountHebrewChars(tt.input); got != tt.want {
				t.Errorf("CountHebrewChars(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestValidateHebrewName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"Valid Hebrew", "עלות השחר", false},
		{"Valid with numbers", "צאת 72 דקות", false},
		{"English only", "Dawn", true},
		{"Empty", "", true},
		{"Numbers only", "123", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateHebrewName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateHebrewName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateEnglishName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"Valid English", "Dawn", false},
		{"Valid with numbers", "Tzeis 72", false},
		{"Empty", "", true},
		{"Numbers only", "123", true},
		{"Hebrew", "עלות", false}, // Hebrew letters are still letters
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEnglishName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateEnglishName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestValidateBilingualNames(t *testing.T) {
	tests := []struct {
		name       string
		hebrew     string
		english    string
		wantErrors bool
		errorCount int
	}{
		{"Both valid", "עלות השחר", "Dawn", false, 0},
		{"Hebrew missing", "", "Dawn", true, 1},
		{"English missing", "עלות השחר", "", true, 1},
		{"Both missing", "", "", true, 2},
		{"Hebrew invalid", "Dawn", "Dawn", true, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := ValidateBilingualNames(tt.hebrew, tt.english)
			hasErrors := errors != nil
			if hasErrors != tt.wantErrors {
				t.Errorf("ValidateBilingualNames() hasErrors = %v, want %v", hasErrors, tt.wantErrors)
			}
			if hasErrors && len(errors) != tt.errorCount {
				t.Errorf("ValidateBilingualNames() errorCount = %v, want %v", len(errors), tt.errorCount)
			}
		})
	}
}

func TestIsHebrewChar(t *testing.T) {
	tests := []struct {
		name string
		char rune
		want bool
	}{
		{"Aleph", 'א', true},
		{"Tav", 'ת', true},
		{"Hebrew vowel", '\u05B0', true}, // Sheva
		{"English A", 'A', false},
		{"Number", '1', false},
		{"Space", ' ', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsHebrewChar(tt.char); got != tt.want {
				t.Errorf("IsHebrewChar(%q) = %v, want %v", tt.char, got, tt.want)
			}
		})
	}
}
