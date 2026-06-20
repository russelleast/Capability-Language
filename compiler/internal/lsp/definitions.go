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
	path, ok := fileURIToPath(uri)
	if !ok {
		return Location{}, false
	}
	absolute, _ := filepath.Abs(path)
	sources, pathToURI := WorkspaceSources(p.host)
	definition, ok := compiler.DefinitionAt(sources, absolute, position.Line+1, position.Character+1)
	if !ok {
		return Location{}, false
	}
	targetURI := pathToURI[definition.Span.File]
	if targetURI == "" {
		targetURI = pathToFileURI(definition.Span.File)
	}
	return Location{URI: targetURI, Range: RangeFromSpan(definition.Span)}, true
}

type definitionParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     Position               `json:"position"`
}
