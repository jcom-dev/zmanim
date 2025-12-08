package dsl

import (
	"fmt"
	"strconv"
)

// Parser parses DSL tokens into an AST
type Parser struct {
	tokens  []Token
	pos     int
	current Token
	errors  ErrorList
}

// NewParser creates a new Parser
func NewParser(tokens []Token) *Parser {
	p := &Parser{tokens: tokens}
	if len(tokens) > 0 {
		p.current = tokens[0]
	}
	return p
}

// Parse parses a DSL formula and returns the AST root
func Parse(input string) (Node, error) {
	tokens, err := Tokenize(input)
	if err != nil {
		return nil, err
	}
	parser := NewParser(tokens)
	return parser.ParseFormula()
}

// ParseFormula parses a complete formula
func (p *Parser) ParseFormula() (Node, error) {
	node := p.parseExpression()
	if p.errors.HasErrors() {
		return nil, &p.errors
	}
	if p.current.Type != TOKEN_EOF {
		p.addError("unexpected token after expression: %s", p.current.Literal)
		return nil, &p.errors
	}
	return node, nil
}

// parseExpression parses an expression (handles +/-)
func (p *Parser) parseExpression() Node {
	// Check for conditional first
	if p.current.Type == TOKEN_IF {
		return p.parseConditional()
	}

	left := p.parseTerm()

	for p.current.Type == TOKEN_PLUS || p.current.Type == TOKEN_MINUS {
		op := p.current.Literal
		pos := Position{Line: p.current.Line, Column: p.current.Column}
		p.advance()
		right := p.parseTerm()
		left = &BinaryOpNode{
			Op:    op,
			Left:  left,
			Right: right,
			Pos:   pos,
		}
	}

	return left
}

// parseTerm parses a term (handles * and /)
func (p *Parser) parseTerm() Node {
	left := p.parseFactor()

	for p.current.Type == TOKEN_MULTIPLY || p.current.Type == TOKEN_DIVIDE {
		op := p.current.Literal
		pos := Position{Line: p.current.Line, Column: p.current.Column}
		p.advance()
		right := p.parseFactor()
		left = &BinaryOpNode{
			Op:    op,
			Left:  left,
			Right: right,
			Pos:   pos,
		}
	}

	return left
}

// parseFactor parses a factor (highest precedence)
func (p *Parser) parseFactor() Node {
	pos := Position{Line: p.current.Line, Column: p.current.Column}

	switch p.current.Type {
	case TOKEN_PRIMITIVE:
		name := p.current.Literal
		p.advance()
		return &PrimitiveNode{Name: name, Pos: pos}

	case TOKEN_FUNCTION:
		return p.parseFunction()

	case TOKEN_AT:
		// Reference to another zman
		zmanKey := p.current.Literal
		p.advance()
		return &ReferenceNode{ZmanKey: zmanKey, Pos: pos}

	case TOKEN_DURATION:
		literal := p.current.Literal
		minutes, err := ParseDuration(literal)
		if err != nil {
			p.addError("invalid duration: %s", literal)
			return nil
		}
		p.advance()
		return &DurationNode{Minutes: minutes, Raw: literal, Pos: pos}

	case TOKEN_NUMBER:
		val, err := strconv.ParseFloat(p.current.Literal, 64)
		if err != nil {
			p.addError("invalid number: %s", p.current.Literal)
			return nil
		}
		p.advance()
		return &NumberNode{Value: val, Pos: pos}

	case TOKEN_LPAREN:
		p.advance() // skip (
		node := p.parseExpression()
		if p.current.Type != TOKEN_RPAREN {
			p.addError("expected ')' but got %s", p.current.Literal)
			return nil
		}
		p.advance() // skip )
		return node

	case TOKEN_IF:
		return p.parseConditional()

	case TOKEN_DIRECTION:
		// Direction used as a value in function args
		dir := p.current.Literal
		p.advance()
		return &DirectionNode{Direction: dir, Pos: pos}

	case TOKEN_BASE:
		return p.parseBase()

	case TOKEN_LATITUDE, TOKEN_LONGITUDE, TOKEN_DAY_LENGTH, TOKEN_MONTH, TOKEN_SEASON:
		// Condition variable
		name := p.current.Literal
		p.advance()
		return &ConditionVarNode{Name: name, Pos: pos}

	case TOKEN_STRING:
		val := p.current.Literal
		p.advance()
		return &StringNode{Value: val, Pos: pos}

	case TOKEN_MINUS:
		// Unary minus - handle negative numbers
		p.advance()
		factor := p.parseFactor()
		if numNode, ok := factor.(*NumberNode); ok {
			numNode.Value = -numNode.Value
			return numNode
		}
		if durNode, ok := factor.(*DurationNode); ok {
			durNode.Minutes = -durNode.Minutes
			return durNode
		}
		p.addError("unary minus can only be applied to numbers and durations")
		return nil

	default:
		p.addError("unexpected token: %s (%s)", p.current.Literal, p.current.Type)
		return nil
	}
}

// parseFunction parses a function call
func (p *Parser) parseFunction() Node {
	pos := Position{Line: p.current.Line, Column: p.current.Column}
	name := p.current.Literal
	p.advance()

	if p.current.Type != TOKEN_LPAREN {
		p.addError("expected '(' after function name %s", name)
		return nil
	}
	p.advance() // skip (

	var args []Node

	// Parse arguments
	for p.current.Type != TOKEN_RPAREN && p.current.Type != TOKEN_EOF {
		arg := p.parseExpression()
		if arg != nil {
			args = append(args, arg)
		}

		if p.current.Type == TOKEN_COMMA {
			p.advance()
		} else if p.current.Type != TOKEN_RPAREN {
			p.addError("expected ',' or ')' in function arguments, got %s", p.current.Literal)
			return nil
		}
	}

	if p.current.Type != TOKEN_RPAREN {
		p.addError("expected ')' to close function call")
		return nil
	}
	p.advance() // skip )

	return &FunctionNode{Name: name, Args: args, Pos: pos}
}

// parseBase parses a base keyword (gra, mga, custom)
func (p *Parser) parseBase() Node {
	pos := Position{Line: p.current.Line, Column: p.current.Column}
	base := p.current.Literal
	p.advance()

	if base == "custom" {
		if p.current.Type != TOKEN_LPAREN {
			p.addError("expected '(' after 'custom'")
			return nil
		}
		p.advance() // skip (

		var customArgs []Node
		for p.current.Type != TOKEN_RPAREN && p.current.Type != TOKEN_EOF {
			arg := p.parseExpression()
			if arg != nil {
				customArgs = append(customArgs, arg)
			}
			if p.current.Type == TOKEN_COMMA {
				p.advance()
			} else if p.current.Type != TOKEN_RPAREN {
				break
			}
		}

		if p.current.Type != TOKEN_RPAREN {
			p.addError("expected ')' to close custom base")
			return nil
		}
		p.advance() // skip )

		return &BaseNode{Base: base, CustomArgs: customArgs, Pos: pos}
	}

	return &BaseNode{Base: base, Pos: pos}
}

// parseConditional parses an if/else expression
func (p *Parser) parseConditional() Node {
	pos := Position{Line: p.current.Line, Column: p.current.Column}

	if p.current.Type != TOKEN_IF {
		p.addError("expected 'if'")
		return nil
	}
	p.advance() // skip 'if'

	if p.current.Type != TOKEN_LPAREN {
		p.addError("expected '(' after 'if'")
		return nil
	}
	p.advance() // skip (

	condition := p.parseCondition()

	if p.current.Type != TOKEN_RPAREN {
		p.addError("expected ')' after condition")
		return nil
	}
	p.advance() // skip )

	if p.current.Type != TOKEN_LBRACE {
		p.addError("expected '{' after condition")
		return nil
	}
	p.advance() // skip {

	trueBranch := p.parseExpression()

	if p.current.Type != TOKEN_RBRACE {
		p.addError("expected '}' after true branch")
		return nil
	}
	p.advance() // skip }

	var falseBranch Node
	if p.current.Type == TOKEN_ELSE {
		p.advance() // skip 'else'

		// Check for else if
		if p.current.Type == TOKEN_IF {
			falseBranch = p.parseConditional()
		} else {
			if p.current.Type != TOKEN_LBRACE {
				p.addError("expected '{' after 'else'")
				return nil
			}
			p.advance() // skip {

			falseBranch = p.parseExpression()

			if p.current.Type != TOKEN_RBRACE {
				p.addError("expected '}' after else branch")
				return nil
			}
			p.advance() // skip }
		}
	}

	return &ConditionalNode{
		Condition:   condition,
		TrueBranch:  trueBranch,
		FalseBranch: falseBranch,
		Pos:         pos,
	}
}

// parseCondition parses a boolean condition with logical operators
// Precedence (lowest to highest): || -> && -> comparison -> primary
func (p *Parser) parseCondition() Node {
	return p.parseLogicalOr()
}

// parseLogicalOr parses || expressions (lowest precedence)
func (p *Parser) parseLogicalOr() Node {
	left := p.parseLogicalAnd()

	for p.current.Type == TOKEN_OR {
		pos := Position{Line: p.current.Line, Column: p.current.Column}
		p.advance() // skip ||
		right := p.parseLogicalAnd()
		left = &LogicalOpNode{
			Op:    "||",
			Left:  left,
			Right: right,
			Pos:   pos,
		}
	}

	return left
}

// parseLogicalAnd parses && expressions
func (p *Parser) parseLogicalAnd() Node {
	left := p.parseLogicalNot()

	for p.current.Type == TOKEN_AND {
		pos := Position{Line: p.current.Line, Column: p.current.Column}
		p.advance() // skip &&
		right := p.parseLogicalNot()
		left = &LogicalOpNode{
			Op:    "&&",
			Left:  left,
			Right: right,
			Pos:   pos,
		}
	}

	return left
}

// parseLogicalNot parses ! expressions
func (p *Parser) parseLogicalNot() Node {
	if p.current.Type == TOKEN_NOT {
		pos := Position{Line: p.current.Line, Column: p.current.Column}
		p.advance()                    // skip !
		operand := p.parseLogicalNot() // Allow chained !
		return &NotOpNode{
			Operand: operand,
			Pos:     pos,
		}
	}

	return p.parseComparison()
}

// parseComparison parses comparison expressions
func (p *Parser) parseComparison() Node {
	// Handle parenthesized conditions
	if p.current.Type == TOKEN_LPAREN {
		p.advance() // skip (
		node := p.parseCondition()
		if p.current.Type != TOKEN_RPAREN {
			p.addError("expected ')' after condition")
			return nil
		}
		p.advance() // skip )
		return node
	}

	pos := Position{Line: p.current.Line, Column: p.current.Column}
	left := p.parseFactor()

	// Check for comparison operator
	var op string
	switch p.current.Type {
	case TOKEN_GT:
		op = ">"
	case TOKEN_LT:
		op = "<"
	case TOKEN_GTE:
		op = ">="
	case TOKEN_LTE:
		op = "<="
	case TOKEN_EQ:
		op = "=="
	case TOKEN_NEQ:
		op = "!="
	default:
		// No comparison operator - just return the left side
		return left
	}

	p.advance() // skip operator

	right := p.parseFactor()

	return &ConditionNode{
		Left:  left,
		Op:    op,
		Right: right,
		Pos:   pos,
	}
}

// advance moves to the next token
func (p *Parser) advance() {
	p.pos++
	if p.pos < len(p.tokens) {
		p.current = p.tokens[p.pos]
	} else {
		p.current = Token{Type: TOKEN_EOF}
	}
}

// peek looks at the next token without advancing
func (p *Parser) peek() Token {
	if p.pos+1 < len(p.tokens) {
		return p.tokens[p.pos+1]
	}
	return Token{Type: TOKEN_EOF}
}

// addError adds a parser error
func (p *Parser) addError(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	p.errors.Add(&DSLError{
		Type:    ErrorTypeSyntax,
		Message: msg,
		Line:    p.current.Line,
		Column:  p.current.Column,
	})
}

// Errors returns any parsing errors
func (p *Parser) Errors() ErrorList {
	return p.errors
}
