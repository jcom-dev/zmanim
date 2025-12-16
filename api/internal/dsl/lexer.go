// File: lexer.go
// Purpose: DSL lexical analysis - tokenizes formula strings into tokens
// Pattern: lexer
// Dependencies: token.go
// Frequency: critical - used by all formula parsing
//
// The Lexer converts DSL formula strings into a stream of tokens.
// Supports: primitives (sunrise, sunset), functions (solar, proportional_hours),
// durations (72min, 1h 30min), references (@zman_key), operators, conditionals.

package dsl

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// Lexer tokenizes DSL input
type Lexer struct {
	input   string
	pos     int  // current position in input
	readPos int  // reading position (after current char)
	ch      byte // current char under examination
	line    int  // current line number
	column  int  // current column number
}

// NewLexer creates a new Lexer instance
func NewLexer(input string) *Lexer {
	l := &Lexer{input: input, line: 1, column: 0}
	l.readChar()
	return l
}

// Tokenize tokenizes the entire input and returns all tokens
func Tokenize(input string) ([]Token, error) {
	l := NewLexer(input)
	var tokens []Token

	for {
		tok := l.NextToken()
		if tok.Type == TOKEN_ILLEGAL {
			return nil, NewSyntaxError(tok.Line, tok.Column, fmt.Sprintf("illegal character: %q", tok.Literal))
		}
		tokens = append(tokens, tok)
		if tok.Type == TOKEN_EOF {
			break
		}
	}

	return tokens, nil
}

// NextToken returns the next token from the input
func (l *Lexer) NextToken() Token {
	l.skipWhitespace()
	l.skipComments()

	tok := Token{Line: l.line, Column: l.column}

	switch l.ch {
	case '+':
		tok.Type = TOKEN_PLUS
		tok.Literal = "+"
	case '-':
		tok.Type = TOKEN_MINUS
		tok.Literal = "-"
	case '*':
		tok.Type = TOKEN_MULTIPLY
		tok.Literal = "*"
	case '/':
		// Check for comments
		if l.peekChar() == '/' || l.peekChar() == '*' {
			l.skipComments()
			return l.NextToken()
		}
		tok.Type = TOKEN_DIVIDE
		tok.Literal = "/"
	case '(':
		tok.Type = TOKEN_LPAREN
		tok.Literal = "("
	case ')':
		tok.Type = TOKEN_RPAREN
		tok.Literal = ")"
	case '{':
		tok.Type = TOKEN_LBRACE
		tok.Literal = "{"
	case '}':
		tok.Type = TOKEN_RBRACE
		tok.Literal = "}"
	case ',':
		tok.Type = TOKEN_COMMA
		tok.Literal = ","
	case '@':
		tok.Type = TOKEN_AT
		tok.Literal = "@"
		l.readChar()
		// Read the identifier after @
		if isLetter(l.ch) {
			ident := l.readIdentifier()
			tok.Literal = ident
			return tok
		}
		tok.Type = TOKEN_ILLEGAL
		tok.Literal = "@"
		return tok
	case '>':
		if l.peekChar() == '=' {
			l.readChar()
			tok.Type = TOKEN_GTE
			tok.Literal = ">="
		} else {
			tok.Type = TOKEN_GT
			tok.Literal = ">"
		}
	case '<':
		if l.peekChar() == '=' {
			l.readChar()
			tok.Type = TOKEN_LTE
			tok.Literal = "<="
		} else {
			tok.Type = TOKEN_LT
			tok.Literal = "<"
		}
	case '=':
		if l.peekChar() == '=' {
			l.readChar()
			tok.Type = TOKEN_EQ
			tok.Literal = "=="
		} else {
			tok.Type = TOKEN_ILLEGAL
			tok.Literal = string(l.ch)
		}
	case '!':
		if l.peekChar() == '=' {
			l.readChar()
			tok.Type = TOKEN_NEQ
			tok.Literal = "!="
		} else {
			tok.Type = TOKEN_NOT
			tok.Literal = "!"
		}
	case '&':
		if l.peekChar() == '&' {
			l.readChar()
			tok.Type = TOKEN_AND
			tok.Literal = "&&"
		} else {
			tok.Type = TOKEN_ILLEGAL
			tok.Literal = string(l.ch)
		}
	case '|':
		if l.peekChar() == '|' {
			l.readChar()
			tok.Type = TOKEN_OR
			tok.Literal = "||"
		} else {
			tok.Type = TOKEN_ILLEGAL
			tok.Literal = string(l.ch)
		}
	case '"':
		tok.Type = TOKEN_STRING
		tok.Literal = l.readString()
		return tok
	case 0:
		tok.Type = TOKEN_EOF
		tok.Literal = ""
	default:
		if isLetter(l.ch) {
			tok.Literal = l.readIdentifier()
			tok.Type = LookupIdent(tok.Literal)

			// Check if this is a duration (e.g., 72min, 1hr, 1h)
			// This handles cases like "1h 30min" when we see just "h" after a number
			return tok
		} else if isDigit(l.ch) {
			return l.readNumberOrDuration()
		} else {
			tok.Type = TOKEN_ILLEGAL
			tok.Literal = string(l.ch)
		}
	}

	l.readChar()
	return tok
}

// readChar reads the next character
func (l *Lexer) readChar() {
	if l.readPos >= len(l.input) {
		l.ch = 0
	} else {
		l.ch = l.input[l.readPos]
	}
	l.pos = l.readPos
	l.readPos++

	if l.ch == '\n' {
		l.line++
		l.column = 0
	} else {
		l.column++
	}
}

// peekChar looks at the next character without advancing
func (l *Lexer) peekChar() byte {
	if l.readPos >= len(l.input) {
		return 0
	}
	return l.input[l.readPos]
}

// skipWhitespace skips whitespace characters
func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\n' || l.ch == '\r' {
		l.readChar()
	}
}

// skipComments skips single-line and multi-line comments
func (l *Lexer) skipComments() {
	for {
		if l.ch == '/' && l.peekChar() == '/' {
			// Single-line comment
			for l.ch != '\n' && l.ch != 0 {
				l.readChar()
			}
			l.skipWhitespace()
		} else if l.ch == '/' && l.peekChar() == '*' {
			// Multi-line comment
			l.readChar() // skip /
			l.readChar() // skip *
			for {
				if l.ch == 0 {
					break
				}
				if l.ch == '*' && l.peekChar() == '/' {
					l.readChar() // skip *
					l.readChar() // skip /
					break
				}
				l.readChar()
			}
			l.skipWhitespace()
		} else {
			break
		}
	}
}

// readIdentifier reads an identifier (letters, digits, underscores)
func (l *Lexer) readIdentifier() string {
	position := l.pos
	for isLetter(l.ch) || isDigit(l.ch) || l.ch == '_' {
		l.readChar()
	}
	return l.input[position:l.pos]
}

// readNumberOrDuration reads a number, duration, or date literal token
func (l *Lexer) readNumberOrDuration() Token {
	tok := Token{Line: l.line, Column: l.column}
	startPos := l.pos

	// Read the numeric part
	for isDigit(l.ch) || l.ch == '.' {
		l.readChar()
	}

	numStr := l.input[startPos:l.pos]

	// Check for date literal (e.g., 21-May, 1-Jan)
	if l.ch == '-' {
		// Peek ahead to see if it's a month name
		savedPos := l.pos
		savedReadPos := l.readPos
		savedCh := l.ch
		savedLine := l.line
		savedCol := l.column

		l.readChar() // skip -
		if isLetter(l.ch) {
			monthStart := l.pos
			for isLetter(l.ch) {
				l.readChar()
			}
			monthStr := l.input[monthStart:l.pos]
			if _, ok := MonthNames[monthStr]; ok {
				tok.Type = TOKEN_DATE_LITERAL
				tok.Literal = numStr + "-" + monthStr
				return tok
			}
		}

		// Not a date literal, restore position
		l.pos = savedPos
		l.readPos = savedReadPos
		l.ch = savedCh
		l.line = savedLine
		l.column = savedCol
	}

	// Check for duration suffix
	if l.ch == 'm' && l.peekChar() == 'i' && l.peekAhead(2) == 'n' {
		// "min" suffix
		l.readChar() // m
		l.readChar() // i
		l.readChar() // n
		tok.Type = TOKEN_DURATION
		tok.Literal = numStr + "min"
		return tok
	}

	if l.ch == 'h' && l.peekChar() == 'r' {
		// "hr" suffix
		l.readChar() // h
		l.readChar() // r
		tok.Type = TOKEN_DURATION
		tok.Literal = numStr + "hr"
		return tok
	}

	if l.ch == 'h' {
		// "h" suffix - check for compound duration like "1h 30min"
		l.readChar() // h
		tok.Type = TOKEN_DURATION
		tok.Literal = numStr + "h"

		// Skip whitespace and check for additional minutes
		savedPos := l.pos
		savedReadPos := l.readPos
		savedCh := l.ch
		savedLine := l.line
		savedCol := l.column

		l.skipWhitespace()

		// Check if followed by a number and "min"
		if isDigit(l.ch) {
			minStart := l.pos
			for isDigit(l.ch) {
				l.readChar()
			}
			if l.ch == 'm' && l.peekChar() == 'i' && l.peekAhead(2) == 'n' {
				minStr := l.input[minStart:l.pos]
				l.readChar() // m
				l.readChar() // i
				l.readChar() // n
				tok.Literal = numStr + "h " + minStr + "min"
				return tok
			}
		}

		// Restore position if not a compound duration
		l.pos = savedPos
		l.readPos = savedReadPos
		l.ch = savedCh
		l.line = savedLine
		l.column = savedCol

		return tok
	}

	// Plain number
	tok.Type = TOKEN_NUMBER
	tok.Literal = numStr
	return tok
}

// peekAhead looks ahead n characters
func (l *Lexer) peekAhead(n int) byte {
	pos := l.readPos + n - 1
	if pos >= len(l.input) {
		return 0
	}
	return l.input[pos]
}

// readString reads a string literal
func (l *Lexer) readString() string {
	l.readChar() // skip opening quote
	position := l.pos
	for l.ch != '"' && l.ch != 0 {
		l.readChar()
	}
	str := l.input[position:l.pos]
	l.readChar() // skip closing quote
	return str
}

// isLetter checks if the character is a letter
func isLetter(ch byte) bool {
	return unicode.IsLetter(rune(ch)) || ch == '_'
}

// isDigit checks if the character is a digit
func isDigit(ch byte) bool {
	return unicode.IsDigit(rune(ch))
}

// ParseDuration parses a duration string (e.g., "72min", "1hr", "1h 30min") to minutes
func ParseDuration(s string) (float64, error) {
	s = strings.TrimSpace(s)

	// Handle compound duration like "1h 30min"
	if strings.Contains(s, "h ") && strings.Contains(s, "min") {
		parts := strings.Split(s, " ")
		if len(parts) == 2 {
			hourPart := strings.TrimSuffix(parts[0], "h")
			minPart := strings.TrimSuffix(parts[1], "min")
			hours, err := strconv.ParseFloat(hourPart, 64)
			if err != nil {
				return 0, fmt.Errorf("invalid hours in duration: %s", s)
			}
			mins, err := strconv.ParseFloat(minPart, 64)
			if err != nil {
				return 0, fmt.Errorf("invalid minutes in duration: %s", s)
			}
			return hours*60 + mins, nil
		}
	}

	// Handle "Xmin"
	if strings.HasSuffix(s, "min") {
		numStr := strings.TrimSuffix(s, "min")
		num, err := strconv.ParseFloat(numStr, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid duration: %s", s)
		}
		return num, nil
	}

	// Handle "Xhr"
	if strings.HasSuffix(s, "hr") {
		numStr := strings.TrimSuffix(s, "hr")
		num, err := strconv.ParseFloat(numStr, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid duration: %s", s)
		}
		return num * 60, nil
	}

	// Handle "Xh"
	if strings.HasSuffix(s, "h") {
		numStr := strings.TrimSuffix(s, "h")
		num, err := strconv.ParseFloat(numStr, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid duration: %s", s)
		}
		return num * 60, nil
	}

	return 0, fmt.Errorf("invalid duration format: %s", s)
}
