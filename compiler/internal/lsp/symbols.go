package lsp

import (
	"os"
	"path/filepath"
	"sort"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/diagnostic"
)

const (
	symbolKindNamespace = 3
	symbolKindClass     = 5
	symbolKindMethod    = 6
	symbolKindProperty  = 7
	symbolKindInterface = 11
	symbolKindFunction  = 12
	symbolKindObject    = 19
	symbolKindStruct    = 23
	symbolKindEvent     = 24
)

type SymbolProvider struct {
	host *WorkspaceHost
}

func NewSymbolProvider(host *WorkspaceHost) *SymbolProvider {
	return &SymbolProvider{host: host}
}

func (p *SymbolProvider) DocumentSymbols(uri string) []DocumentSymbol {
	symbols, _ := p.DocumentSymbolsWithReason(uri)
	return symbols
}

func (p *SymbolProvider) DocumentSymbolsWithReason(uri string) ([]DocumentSymbol, string) {
	source, ok := p.documentSource(uri)
	if !ok {
		return nil, "document not found in workspace model"
	}
	parsed := compiler.ParseSources([]compiler.SourceFile{source})
	builder := DocumentSymbolBuilder{path: source.Path}
	symbols := builder.Build(parsed.Program)
	if len(symbols) == 0 {
		return symbols, "no symbols for document"
	}
	return symbols, ""
}

func (p *SymbolProvider) documentSource(uri string) (compiler.SourceFile, bool) {
	if document, ok := p.host.Documents().Get(uri); ok {
		path, ok := fileURIToPath(document.URI)
		if !ok {
			return compiler.SourceFile{}, false
		}
		absolute, _ := filepath.Abs(path)
		return compiler.SourceFile{Path: absolute, Text: document.Text}, true
	}
	path, ok := fileURIToPath(uri)
	if !ok {
		return compiler.SourceFile{}, false
	}
	absolute, _ := filepath.Abs(path)
	text, err := os.ReadFile(absolute)
	if err != nil {
		return compiler.SourceFile{}, false
	}
	return compiler.SourceFile{Path: absolute, Text: string(text)}, true
}

type DocumentSymbolBuilder struct {
	path string
}

func (b DocumentSymbolBuilder) Build(program ast.Program) []DocumentSymbol {
	var topLevel []DocumentSymbol
	contextsByName := map[string]*DocumentSymbol{}
	contextsByParent := map[string][]*DocumentSymbol{}

	for _, context := range program.Contexts {
		if !b.sameFile(context.Span) {
			continue
		}
		symbol := NewDocumentSymbol(context.Name, "Context", symbolKindNamespace, context.Span)
		contextsByName[context.Name] = &symbol
		contextsByParent[context.Parent] = append(contextsByParent[context.Parent], &symbol)
	}
	for _, symbol := range b.topLevelSymbols(program) {
		context := symbolContext(symbol, program)
		if context != "" {
			if parent, ok := contextsByName[context]; ok {
				parent.Children = append(parent.Children, symbol)
				continue
			}
		}
		topLevel = append(topLevel, symbol)
	}
	for _, context := range sortedContextSymbols(contextsByParent[""]) {
		topLevel = append(topLevel, b.attachContextChildren(context, contextsByParent, program)...)
	}

	sortDocumentSymbols(topLevel)
	sortChildren(topLevel)
	return topLevel
}

func (b DocumentSymbolBuilder) attachContextChildren(context *DocumentSymbol, contextsByParent map[string][]*DocumentSymbol, program ast.Program) []DocumentSymbol {
	children := sortedContextSymbols(contextsByParent[context.Name])
	for _, child := range children {
		context.Children = append(context.Children, b.attachContextChildren(child, contextsByParent, program)...)
	}
	return []DocumentSymbol{*context}
}

func (b DocumentSymbolBuilder) topLevelSymbols(program ast.Program) []DocumentSymbol {
	var symbols []DocumentSymbol
	for _, shape := range program.Shapes {
		if b.sameFile(shape.Span) {
			symbols = append(symbols, NewDocumentSymbol(shape.Name, "Shape", symbolKindStruct, shape.Span))
		}
	}
	for _, actor := range program.Actors {
		if b.sameFile(actor.Span) {
			symbols = append(symbols, NewDocumentSymbol(actor.Name, "Actor", symbolKindObject, actor.Span))
		}
	}
	for _, event := range program.Events {
		if b.sameFile(event.Span) {
			symbols = append(symbols, NewDocumentSymbol(event.Name, "Event", symbolKindEvent, event.Span))
		}
	}
	for _, effect := range program.Effects {
		if b.sameFile(effect.Span) {
			symbols = append(symbols, NewDocumentSymbol(effect.Name, "Effect", symbolKindFunction, effect.Span))
		}
	}
	for _, policy := range program.Policies {
		if b.sameFile(policy.Span) {
			symbols = append(symbols, NewDocumentSymbol(policy.Name, "Policy", symbolKindProperty, policy.Span))
		}
	}
	for _, capability := range program.Capabilities {
		if b.sameFile(capability.Span) {
			symbols = append(symbols, b.capabilitySymbol(capability))
		}
	}
	return symbols
}

func (b DocumentSymbolBuilder) capabilitySymbol(capability ast.CapabilityDecl) DocumentSymbol {
	symbol := NewDocumentSymbol(capability.Name, "Capability", symbolKindClass, capability.Span)
	for _, intent := range capability.Intents {
		if b.sameFile(intent.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(intent.Name, "Intent", symbolKindMethod, intent.Span))
		}
	}
	for _, outcome := range capability.Outcomes {
		if b.sameFile(outcome.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(outcome.Name, "Outcome", symbolKindEvent, outcome.Span))
		}
	}
	for _, event := range capability.Events {
		if b.sameFile(event.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(event.Name, "Event", symbolKindEvent, event.Span))
		}
	}
	for _, effect := range capability.Effects {
		if b.sameFile(effect.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(effect.Name, "Effect", symbolKindFunction, effect.Span))
		}
	}
	for _, policy := range capability.Policies {
		if b.sameFile(policy.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(policy.Name, "Policy", symbolKindProperty, policy.Span))
		}
	}
	if capability.Lifecycle != nil && b.sameFile(capability.Lifecycle.Span) {
		symbol.Children = append(symbol.Children, b.lifecycleSymbol(*capability.Lifecycle))
	}
	sortDocumentSymbols(symbol.Children)
	return symbol
}

func (b DocumentSymbolBuilder) lifecycleSymbol(lifecycle ast.LifecycleDecl) DocumentSymbol {
	name := lifecycle.Name
	if name == "" {
		name = "Lifecycle"
	}
	symbol := NewDocumentSymbol(name, "Lifecycle", symbolKindInterface, lifecycle.Span)
	for _, step := range lifecycle.Steps {
		if b.sameFile(step.Span) {
			symbol.Children = append(symbol.Children, NewDocumentSymbol(step.Name, "Lifecycle Step", symbolKindMethod, step.Span))
		}
	}
	sortDocumentSymbols(symbol.Children)
	return symbol
}

func (b DocumentSymbolBuilder) sameFile(span diagnostic.Span) bool {
	return span.File == b.path
}

func NewDocumentSymbol(name, detail string, kind int, span diagnostic.Span) DocumentSymbol {
	rng := RangeFromSpan(span)
	return DocumentSymbol{
		Name:           name,
		Detail:         detail,
		Kind:           kind,
		Range:          rng,
		SelectionRange: rng,
	}
}

func sortedContextSymbols(symbols []*DocumentSymbol) []*DocumentSymbol {
	out := append([]*DocumentSymbol(nil), symbols...)
	sort.SliceStable(out, func(i, j int) bool {
		return symbolBefore(*out[i], *out[j])
	})
	return out
}

func sortChildren(symbols []DocumentSymbol) {
	for i := range symbols {
		sortDocumentSymbols(symbols[i].Children)
		sortChildren(symbols[i].Children)
	}
}

func sortDocumentSymbols(symbols []DocumentSymbol) {
	sort.SliceStable(symbols, func(i, j int) bool {
		return symbolBefore(symbols[i], symbols[j])
	})
}

func symbolBefore(left, right DocumentSymbol) bool {
	if left.Range.Start.Line != right.Range.Start.Line {
		return left.Range.Start.Line < right.Range.Start.Line
	}
	if left.Range.Start.Character != right.Range.Start.Character {
		return left.Range.Start.Character < right.Range.Start.Character
	}
	return left.Name < right.Name
}

func symbolContext(symbol DocumentSymbol, program ast.Program) string {
	for _, shape := range program.Shapes {
		if shape.Name == symbol.Name && shape.Span.Line == symbol.Range.Start.Line+1 {
			return shape.Meta.ContextName
		}
	}
	for _, actor := range program.Actors {
		if actor.Name == symbol.Name && actor.Span.Line == symbol.Range.Start.Line+1 {
			return actor.Meta.ContextName
		}
	}
	for _, event := range program.Events {
		if event.Name == symbol.Name && event.Span.Line == symbol.Range.Start.Line+1 {
			return event.Meta.ContextName
		}
	}
	for _, effect := range program.Effects {
		if effect.Name == symbol.Name && effect.Span.Line == symbol.Range.Start.Line+1 {
			return effect.Meta.ContextName
		}
	}
	for _, policy := range program.Policies {
		if policy.Name == symbol.Name && policy.Span.Line == symbol.Range.Start.Line+1 {
			return policy.Meta.ContextName
		}
	}
	for _, capability := range program.Capabilities {
		if capability.Name == symbol.Name && capability.Span.Line == symbol.Range.Start.Line+1 {
			return capability.Meta.ContextName
		}
	}
	return ""
}

type documentSymbolParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
}

type DocumentSymbol struct {
	Name           string           `json:"name"`
	Detail         string           `json:"detail,omitempty"`
	Kind           int              `json:"kind"`
	Range          Range            `json:"range"`
	SelectionRange Range            `json:"selectionRange"`
	Children       []DocumentSymbol `json:"children,omitempty"`
}
