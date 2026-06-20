package lsp

import (
	"path/filepath"

	"capabilitylanguage/internal/compiler"
)

type SymbolInspector struct {
	host *WorkspaceHost
}

func NewSymbolInspector(host *WorkspaceHost) *SymbolInspector {
	return &SymbolInspector{host: host}
}

func (p *SymbolInspector) Inspect(uri string, position Position) (SymbolInspection, string) {
	path, ok := fileURIToPath(uri)
	if !ok {
		return SymbolInspection{URI: uri, Line: position.Line, Column: position.Character}, "invalid file URI"
	}
	absolute, _ := filepath.Abs(path)
	sources, pathToURI := WorkspaceSources(p.host)
	if len(sources) == 0 {
		return SymbolInspection{URI: uri, Line: position.Line, Column: position.Character}, "no compiled workspace model"
	}
	inspection := compiler.InspectSemanticAt(sources, absolute, position.Line+1, position.Character+1)
	result := SymbolInspection{
		URI:            uri,
		Line:           position.Line,
		Column:         position.Character,
		Token:          inspection.Token,
		Kind:           inspection.Kind,
		SymbolIdentity: semanticIdentity(inspection.Definition.Kind, inspection.Definition.Context, inspection.Definition.Name),
		ReferenceCount: inspection.ReferenceCount,
		Reason:         inspection.Reason,
	}
	if inspection.Definition.Span.File != "" {
		targetURI := pathToURI[inspection.Definition.Span.File]
		if targetURI == "" {
			targetURI = pathToFileURI(inspection.Definition.Span.File)
		}
		result.Definition = &Location{URI: targetURI, Range: RangeFromSpan(inspection.Definition.Span)}
	}
	if result.Reason != "" {
		return result, result.Reason
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
