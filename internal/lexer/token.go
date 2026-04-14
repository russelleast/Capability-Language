package lexer

import "capabilitylanguage/internal/diagnostic"

type Kind int

const (
	EOF Kind = iota
	Ident
	LBrace
	RBrace
	Colon
	Arrow
	Less
	Greater
	Newline
)

type Token struct {
	Kind Kind
	Text string
	Span diagnostic.Span
}

func (k Kind) String() string {
	switch k {
	case EOF:
		return "EOF"
	case Ident:
		return "identifier"
	case LBrace:
		return "{"
	case RBrace:
		return "}"
	case Colon:
		return ":"
	case Arrow:
		return "=>"
	case Less:
		return "<"
	case Greater:
		return ">"
	case Newline:
		return "newline"
	default:
		return "unknown"
	}
}
