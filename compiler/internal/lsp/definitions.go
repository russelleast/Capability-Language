package lsp

import (
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
	path, ok := sourcePathForURI(uri)
	if !ok {
		return Location{}, "invalid file URI", false
	}
	index, pathToURI, sources := BuildSemanticSourceIndex(p.host)
	if len(sources) == 0 {
		return Location{}, "no compiled workspace model", false
	}
	definition, ok := index.DefinitionForPosition(path, position.Line+1, position.Character+1)
	if !ok {
		return Location{}, "not on a symbol or unresolved reference", false
	}
	location := locationFromEntry(definition, pathToURI)
	reason := "resolved reference"
	if definition.Role == compiler.SemanticSourceDeclaration && location.URI == uri && location.Range.Start.Line == position.Line {
		reason = "on declaration"
	}
	return location, reason, true
}

func (p *DefinitionProvider) TokenAt(uri string, position Position) string {
	path, ok := sourcePathForURI(uri)
	if !ok {
		return ""
	}
	sources, _ := WorkspaceSources(p.host)
	token, _ := compiler.TokenTextAt(sources, path, position.Line+1, position.Character+1)
	return token
}

type definitionParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     Position               `json:"position"`
}
