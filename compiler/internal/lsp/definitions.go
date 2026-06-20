package lsp

import (
	"path/filepath"

	"capabilitylanguage/internal/compiler"
)

type DefinitionProvider struct {
	host *WorkspaceHost
}

func NewDefinitionProvider(host *WorkspaceHost) *DefinitionProvider {
	return &DefinitionProvider{host: host}
}

func (p *DefinitionProvider) Definition(uri string, position Position) (Location, bool) {
	location, _, ok := p.DefinitionWithReason(uri, position)
	return location, ok
}

func (p *DefinitionProvider) DefinitionWithReason(uri string, position Position) (Location, string, bool) {
	path, ok := fileURIToPath(uri)
	if !ok {
		return Location{}, "invalid file URI", false
	}
	absolute, _ := filepath.Abs(path)
	sources, pathToURI := WorkspaceSources(p.host)
	if len(sources) == 0 {
		return Location{}, "no compiled workspace model", false
	}
	definition, ok := compiler.DefinitionAt(sources, absolute, position.Line+1, position.Character+1)
	if !ok {
		return Location{}, "not on a symbol or unresolved reference", false
	}
	targetURI := pathToURI[definition.Span.File]
	if targetURI == "" {
		targetURI = pathToFileURI(definition.Span.File)
	}
	location := Location{URI: targetURI, Range: RangeFromSpan(definition.Span)}
	reason := "resolved reference"
	if targetURI == uri && location.Range.Start.Line == position.Line {
		reason = "on declaration"
	}
	return location, reason, true
}

type definitionParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     Position               `json:"position"`
}
