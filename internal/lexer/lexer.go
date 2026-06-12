package lexer

import (
	"unicode"
	"unicode/utf8"

	"capabilitylanguage/internal/diagnostic"
)

func Lex(file, src string) ([]Token, []diagnostic.Diagnostic) {
	var tokens []Token
	var diags diagnostic.Bag
	line, col := 1, 1

	emit := func(kind Kind, text string, startLine, startCol int) {
		tokens = append(tokens, Token{
			Kind: kind,
			Text: text,
			Span: diagnostic.Span{File: file, Line: startLine, Column: startCol},
		})
	}

	for i := 0; i < len(src); {
		r, size := utf8.DecodeRuneInString(src[i:])
		startLine, startCol := line, col

		switch {
		case r == '\r':
			i += size
			continue
		case r == '\n':
			emit(Newline, "\n", startLine, startCol)
			i += size
			line++
			col = 1
		case r == ' ' || r == '\t':
			i += size
			col++
		case r == '#':
			for i < len(src) {
				r, size = utf8.DecodeRuneInString(src[i:])
				if r == '\n' {
					break
				}
				i += size
				col++
			}
		case r == '/' && i+1 < len(src) && src[i+1] == '/':
			for i < len(src) {
				r, size = utf8.DecodeRuneInString(src[i:])
				if r == '\n' {
					break
				}
				i += size
				col++
			}
		case r == '{':
			emit(LBrace, "{", startLine, startCol)
			i += size
			col++
		case r == '}':
			emit(RBrace, "}", startLine, startCol)
			i += size
			col++
		case r == ':':
			emit(Colon, ":", startLine, startCol)
			i += size
			col++
		case r == '<':
			emit(Less, "<", startLine, startCol)
			i += size
			col++
		case r == '>':
			emit(Greater, ">", startLine, startCol)
			i += size
			col++
		case r == '=' && i+1 < len(src) && src[i+1] == '>':
			emit(Arrow, "=>", startLine, startCol)
			i += 2
			col += 2
		case isIdentStart(r) || unicode.IsDigit(r):
			start := i
			for i < len(src) {
				r, size = utf8.DecodeRuneInString(src[i:])
				if !isIdentPart(r) {
					break
				}
				i += size
				col++
			}
			emit(Ident, src[start:i], startLine, startCol)
		default:
			diags.Error("DCL_LEX_UNEXPECTED_CHAR", "unexpected character "+string(r), diagnostic.Span{File: file, Line: startLine, Column: startCol}, "")
			i += size
			col++
		}
	}

	emit(EOF, "", line, col)
	return tokens, diags.Items()
}

func isIdentStart(r rune) bool {
	return unicode.IsLetter(r) || r == '_'
}

func isIdentPart(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '.'
}
