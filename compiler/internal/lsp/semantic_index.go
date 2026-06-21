package lsp

import (
	"path/filepath"
	"sort"

	"capabilitylanguage/internal/compiler"
)

func BuildSemanticSourceIndex(host *WorkspaceHost) (*compiler.SemanticSourceIndex, map[string]string, []compiler.SourceFile) {
	sources, pathToURI := WorkspaceSources(host)
	return compiler.NewSemanticSourceIndex(sources), pathToURI, sources
}

func sourcePathForURI(uri string) (string, bool) {
	path, ok := fileURIToPath(uri)
	if !ok {
		return "", false
	}
	absolute, _ := filepath.Abs(path)
	return absolute, true
}

func locationFromEntry(entry compiler.SemanticSourceEntry, pathToURI map[string]string) Location {
	uri := pathToURI[entry.File]
	if uri == "" {
		uri = pathToFileURI(entry.File)
	}
	return Location{URI: uri, Range: RangeFromSourceRange(entry.TokenRange)}
}

func RangeFromSourceRange(rng compiler.SemanticSourceRange) Range {
	line := rng.Line - 1
	if line < 0 {
		line = 0
	}
	column := rng.Column - 1
	if column < 0 {
		column = 0
	}
	endLine := rng.EndLine - 1
	if endLine < line {
		endLine = line
	}
	endColumn := rng.EndColumn - 1
	if endColumn <= column {
		endColumn = column + 1
	}
	return Range{
		Start: Position{Line: line, Character: column},
		End:   Position{Line: endLine, Character: endColumn},
	}
}

func sourceEntriesToDocumentSymbols(entries []compiler.SemanticSourceEntry) []DocumentSymbol {
	byID := map[string]*DocumentSymbol{}
	children := map[string][]compiler.SemanticSourceEntry{}
	var roots []compiler.SemanticSourceEntry

	for _, entry := range entries {
		if entry.ParentSemanticID == "" {
			roots = append(roots, entry)
		} else {
			children[entry.ParentSemanticID] = append(children[entry.ParentSemanticID], entry)
		}
		rng := RangeFromSourceRange(entry.TokenRange)
		symbol := DocumentSymbol{
			Name:           entry.Name,
			Detail:         displayKind(entry.Kind),
			Kind:           symbolKindForSemanticKind(entry.Kind),
			Range:          rng,
			SelectionRange: rng,
		}
		byID[entry.SemanticID] = &symbol
	}

	var attach func(entry compiler.SemanticSourceEntry) DocumentSymbol
	attach = func(entry compiler.SemanticSourceEntry) DocumentSymbol {
		symbol := *byID[entry.SemanticID]
		for _, child := range children[entry.SemanticID] {
			symbol.Children = append(symbol.Children, attach(child))
		}
		sortDocumentSymbols(symbol.Children)
		return symbol
	}

	sort.SliceStable(roots, func(i, j int) bool {
		return sourceEntryBefore(roots[i], roots[j])
	})
	symbols := make([]DocumentSymbol, 0, len(roots))
	for _, root := range roots {
		symbols = append(symbols, attach(root))
	}
	return symbols
}

func sourceEntryToWorkspaceSymbol(entry compiler.SemanticSourceEntry, pathToURI map[string]string) []WorkspaceSymbol {
	location := locationFromEntry(entry, pathToURI)
	if location.URI == "" {
		return nil
	}
	return []WorkspaceSymbol{{
		Name:          entry.Name,
		Detail:        displayKind(entry.Kind),
		Kind:          symbolKindForSemanticKind(entry.Kind),
		Location:      location,
		ContainerName: entry.ContainerContext,
		Data: map[string]string{
			"semanticId":       entry.SemanticID,
			"parentSemanticId": entry.ParentSemanticID,
			"kind":             entry.Kind,
			"context":          entry.ContainerContext,
			"name":             entry.Name,
		},
	}}
}

func sourceEntryBefore(left, right compiler.SemanticSourceEntry) bool {
	if left.File != right.File {
		return left.File < right.File
	}
	if left.TokenRange.Line != right.TokenRange.Line {
		return left.TokenRange.Line < right.TokenRange.Line
	}
	if left.TokenRange.Column != right.TokenRange.Column {
		return left.TokenRange.Column < right.TokenRange.Column
	}
	return left.Name < right.Name
}

func displayKind(kind string) string {
	switch kind {
	case "lifecycleStep":
		return "Lifecycle Step"
	default:
		if kind == "" {
			return "Symbol"
		}
		return upperFirst(kind)
	}
}

func upperFirst(value string) string {
	if value == "" {
		return value
	}
	return string(value[0]-32) + value[1:]
}

func symbolKindForSemanticKind(kind string) int {
	switch kind {
	case "context":
		return symbolKindNamespace
	case "capability":
		return symbolKindClass
	case "intent", "lifecycleStep":
		return symbolKindMethod
	case "outcome", "event":
		return symbolKindEvent
	case "effect":
		return symbolKindFunction
	case "policy", "rule":
		return symbolKindProperty
	case "lifecycle":
		return symbolKindInterface
	case "shape":
		return symbolKindStruct
	case "actor":
		return symbolKindObject
	default:
		return symbolKindObject
	}
}
