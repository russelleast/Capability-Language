package lsp

import (
	"strings"

	"capabilitylanguage/internal/compiler"
)

type completionItem struct {
	Label         string `json:"label"`
	Kind          int    `json:"kind"`
	Detail        string `json:"detail,omitempty"`
	Documentation string `json:"documentation,omitempty"`
}

type hover struct {
	Contents markupContent `json:"contents"`
}

type markupContent struct {
	Kind  string `json:"kind"`
	Value string `json:"value"`
}

func languageVersionForText(text string) string {
	return compiler.DeclaredLanguageVersion(text)
}

func completionsForText(text string) []completionItem {
	types := compiler.BuiltinTypesForLanguage(languageVersionForText(text))
	types = append(types, "List<T>")
	out := make([]completionItem, 0, len(types))
	for _, name := range types {
		out = append(out, completionItem{Label: name, Kind: 7, Detail: "DCL built-in type"})
	}
	return out
}

func hoverForText(text, word string) *hover {
	documentation := map[string]string{
		"Integer": "Signed integral built-in type, distinct from Number. Since DCL 1.1.",
		"measure": "Declares a lightweight unit for measured Integer or Number values. Since DCL 1.1.",
		"enum":    "Marks a shape as a closed set of alternatives. Since DCL 1.1.",
	}
	value, ok := documentation[word]
	if !ok {
		return nil
	}
	if languageVersionForText(text) == "1.0" {
		value = word + " requires DCL language 1.1 or later; this source declares DCL language 1.0."
	}
	return &hover{Contents: markupContent{Kind: "markdown", Value: "**" + word + "**\n\n" + value}}
}

func wordAt(text string, position Position) string {
	lines := strings.Split(text, "\n")
	if position.Line < 0 || position.Line >= len(lines) {
		return ""
	}
	line := lines[position.Line]
	if position.Character < 0 || position.Character > len(line) {
		return ""
	}
	start, end := position.Character, position.Character
	for start > 0 && isWordByte(line[start-1]) {
		start--
	}
	for end < len(line) && isWordByte(line[end]) {
		end++
	}
	return line[start:end]
}

func isWordByte(value byte) bool {
	return value == '_' || value >= 'a' && value <= 'z' || value >= 'A' && value <= 'Z' || value >= '0' && value <= '9'
}
