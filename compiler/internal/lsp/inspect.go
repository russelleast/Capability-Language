package lsp

import (
	"capabilitylanguage/internal/compiler"
)

type SymbolInspector struct {
	host *WorkspaceHost
}

func NewSymbolInspector(host *WorkspaceHost) *SymbolInspector {
	return &SymbolInspector{host: host}
}

func (p *SymbolInspector) Inspect(uri string, position Position) (SymbolInspection, string) {
	path, ok := sourcePathForURI(uri)
	if !ok {
		return SymbolInspection{URI: uri, Line: position.Line, Column: position.Character}, "invalid file URI"
	}
	index, pathToURI, sources := BuildSemanticSourceIndex(p.host)
	if len(sources) == 0 {
		return SymbolInspection{URI: uri, Line: position.Line, Column: position.Character}, "no compiled workspace model"
	}
	token, _ := compiler.TokenTextAt(sources, path, position.Line+1, position.Character+1)
	entry, ok := index.EntryAtPosition(path, position.Line+1, position.Character+1)
	result := SymbolInspection{
		URI:    uri,
		Line:   position.Line,
		Column: position.Character,
		Token:  token,
	}
	if !ok {
		result.Reason = "No semantic symbol found"
		return result, result.Reason
	}
	target, targetOK := index.DefinitionForPosition(path, position.Line+1, position.Character+1)
	refs := index.ReferencesForPosition(path, position.Line+1, position.Character+1, true)
	result.Kind = displayKind(entry.Kind) + upperFirst(string(entry.Role))
	result.SymbolIdentity = map[string]string{"semanticId": entry.SemanticID, "kind": entry.Kind, "name": entry.Name, "context": entry.ContainerContext}
	result.ReferenceCount = len(refs)
	if targetOK {
		location := locationFromEntry(target, pathToURI)
		result.Definition = &location
	}
	return result, ""
}

type inspectSymbolParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     Position               `json:"position"`
}

type SymbolInspection struct {
	URI            string            `json:"uri"`
	Line           int               `json:"line"`
	Column         int               `json:"column"`
	Token          string            `json:"token,omitempty"`
	Kind           string            `json:"kind,omitempty"`
	SymbolIdentity map[string]string `json:"symbolIdentity,omitempty"`
	Definition     *Location         `json:"definition,omitempty"`
	ReferenceCount int               `json:"referenceCount"`
	Reason         string            `json:"reason,omitempty"`
}
