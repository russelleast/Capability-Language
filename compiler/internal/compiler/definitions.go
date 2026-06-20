package compiler

import (
	"sort"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
)

type DefinitionLocation struct {
	Kind    string
	Name    string
	Context string
	Span    diagnostic.Span
}

func DefinitionAt(sources []SourceFile, path string, line, column int) (DefinitionLocation, bool) {
	source, ok := sourceByPath(sources, path)
	if !ok {
		return DefinitionLocation{}, false
	}
	tokens, _ := lexer.Lex(source.Path, source.Text)
	tokenIndex, ok := tokenAt(tokens, line, column)
	if !ok {
		return DefinitionLocation{}, false
	}
	token := tokens[tokenIndex]
	parsed := ParseSources(sources)
	bag := diagnostic.Bag{}
	c := newCompiler(parsed.Program, &bag)
	context := contextAt(parsed.Program, source.Path, line)
	if cap, ok := capabilityAt(parsed.Program, source.Path, line); ok {
		context = declContext(cap.Meta.ContextName)
		if def, ok := definitionInCapability(c, cap, tokens, tokenIndex, context); ok {
			return def, true
		}
	}
	if def, ok := definitionByGlobalReference(c, parsed.Program, tokens, tokenIndex, context); ok {
		return def, true
	}
	if def, ok := contextDefinition(parsed.Program, token.Text); ok && looksLikeContextReference(tokens, tokenIndex) {
		return def, true
	}
	return DefinitionLocation{}, false
}

func sourceByPath(sources []SourceFile, path string) (SourceFile, bool) {
	for _, source := range sources {
		if source.Path == path {
			return source, true
		}
	}
	return SourceFile{}, false
}

func tokenAt(tokens []lexer.Token, line, column int) (int, bool) {
	for i, token := range tokens {
		if token.Kind != lexer.Ident || token.Span.Line != line {
			continue
		}
		start := token.Span.Column
		end := start + len(token.Text)
		if column >= start && column <= end {
			return i, true
		}
	}
	return 0, false
}

func definitionInCapability(c *compiler, cap ast.CapabilityDecl, tokens []lexer.Token, tokenIndex int, context string) (DefinitionLocation, bool) {
	token := tokens[tokenIndex]
	if kind, ok := referenceKind(tokens, tokenIndex); ok {
		switch kind {
		case "outcome":
			if outcome, ok := outcomeDefinition(cap, token.Text); ok {
				return DefinitionLocation{Kind: "outcome", Name: outcome.Name, Context: context, Span: outcome.Span}, true
			}
		case "lifecycle":
			if cap.Lifecycle != nil && (cap.Lifecycle.Name == token.Text || (cap.Lifecycle.Name == "" && token.Text == "lifecycle")) {
				return DefinitionLocation{Kind: "lifecycle", Name: token.Text, Context: context, Span: cap.Lifecycle.Span}, true
			}
		default:
			if info, ok := c.resolve(kind, token.Text, context, token.Span, false); ok {
				return definitionFromSymbol(info), true
			}
		}
	}
	for _, kind := range []string{"shape", "event", "capability", "context"} {
		if info, ok := c.resolve(kind, token.Text, context, token.Span, false); ok {
			return definitionFromSymbol(info), true
		}
	}
	if outcome, ok := outcomeDefinition(cap, token.Text); ok {
		return DefinitionLocation{Kind: "outcome", Name: outcome.Name, Context: context, Span: outcome.Span}, true
	}
	return DefinitionLocation{}, false
}

func definitionByGlobalReference(c *compiler, program ast.Program, tokens []lexer.Token, tokenIndex int, context string) (DefinitionLocation, bool) {
	token := tokens[tokenIndex]
	if kind, ok := referenceKind(tokens, tokenIndex); ok {
		if kind == "context" {
			return contextDefinition(program, token.Text)
		}
		if info, ok := c.resolve(kind, token.Text, context, token.Span, false); ok {
			return definitionFromSymbol(info), true
		}
	}
	for _, kind := range []string{"shape", "event", "capability"} {
		if info, ok := c.resolve(kind, token.Text, context, token.Span, false); ok {
			return definitionFromSymbol(info), true
		}
	}
	return DefinitionLocation{}, false
}

func definitionFromSymbol(info *symbolInfo) DefinitionLocation {
	return DefinitionLocation{Kind: info.Kind, Name: info.Name, Context: info.Context, Span: info.Span}
}

func referenceKind(tokens []lexer.Token, tokenIndex int) (string, bool) {
	prev := previousIdent(tokens, tokenIndex, 1)
	prev2 := previousIdent(tokens, tokenIndex, 2)
	prev3 := previousIdent(tokens, tokenIndex, 3)
	switch {
	case prev == "emits":
		return "event", true
	case prev == "event":
		return "event", true
	case prev == "outcome" || prev == "then":
		return "outcome", true
	case prev == "effect" || prev2 == "effect":
		return "effect", true
	case prev == "policy" || prev2 == "policy":
		return "policy", true
	case prev == "capability" || prev2 == "capability":
		return "capability", true
	case prev == "lifecycle":
		return "lifecycle", true
	case prev == "on" && prev2 == "depends":
		return "context", true
	case prev == "depends":
		return "context", true
	case prev == "from" && (prev2 == "event" || prev2 == "outcome" || prev3 == "event" || prev3 == "outcome"):
		return "capability", true
	}
	return "", false
}

func previousIdent(tokens []lexer.Token, tokenIndex, count int) string {
	seen := 0
	for i := tokenIndex - 1; i >= 0; i-- {
		if tokens[i].Kind != lexer.Ident {
			continue
		}
		seen++
		if seen == count {
			return tokens[i].Text
		}
	}
	return ""
}

func looksLikeContextReference(tokens []lexer.Token, tokenIndex int) bool {
	kind, ok := referenceKind(tokens, tokenIndex)
	return ok && kind == "context"
}

func outcomeDefinition(cap ast.CapabilityDecl, name string) (ast.OutcomeDecl, bool) {
	for _, outcome := range cap.Outcomes {
		if outcome.Name == name {
			return outcome, true
		}
	}
	return ast.OutcomeDecl{}, false
}

func contextDefinition(program ast.Program, name string) (DefinitionLocation, bool) {
	for _, context := range program.Contexts {
		if context.Name == name {
			return DefinitionLocation{Kind: "context", Name: context.Name, Context: context.Parent, Span: context.Span}, true
		}
	}
	return DefinitionLocation{}, false
}

func capabilityAt(program ast.Program, path string, line int) (ast.CapabilityDecl, bool) {
	caps := append([]ast.CapabilityDecl(nil), program.Capabilities...)
	sort.SliceStable(caps, func(i, j int) bool {
		return caps[i].Span.Line < caps[j].Span.Line
	})
	for i, cap := range caps {
		if cap.Span.File != path || cap.Span.Line > line {
			continue
		}
		if i+1 < len(caps) && caps[i+1].Span.File == path && caps[i+1].Span.Line <= line {
			continue
		}
		return cap, true
	}
	return ast.CapabilityDecl{}, false
}

func contextAt(program ast.Program, path string, line int) string {
	context := "default"
	contexts := append([]ast.ContextDecl(nil), program.Contexts...)
	sort.SliceStable(contexts, func(i, j int) bool {
		return contexts[i].Span.Line < contexts[j].Span.Line
	})
	for _, item := range contexts {
		if item.Span.File == path && item.Span.Line <= line {
			context = item.Name
		}
	}
	return context
}
