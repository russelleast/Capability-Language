package lsp

import (
	"capabilitylanguage/internal/compiler"
)

type ReferenceProvider struct {
	host *WorkspaceHost
}

func NewReferenceProvider(host *WorkspaceHost) *ReferenceProvider {
	return &ReferenceProvider{host: host}
}

func (p *ReferenceProvider) References(uri string, position Position, includeDeclaration bool) []Location {
	locations, _ := p.ReferencesWithReason(uri, position, includeDeclaration)
	return locations
}

func (p *ReferenceProvider) ReferencesWithReason(uri string, position Position, includeDeclaration bool) ([]Location, string) {
	path, ok := sourcePathForURI(uri)
	if !ok {
		return nil, "invalid file URI"
	}
	index, pathToURI, sources := BuildSemanticSourceIndex(p.host)
	if len(sources) == 0 {
		return nil, "no compiled workspace model"
	}
	references := index.ReferencesForPosition(path, position.Line+1, position.Character+1, includeDeclaration)
	locations := make([]Location, 0, len(references))
	for _, reference := range references {
		locations = append(locations, locationFromEntry(reference, pathToURI))
	}
	if len(locations) == 0 {
		return locations, "no semantic references found"
	}
	return locations, ""
}

func (p *ReferenceProvider) TokenAt(uri string, position Position) string {
	path, ok := sourcePathForURI(uri)
	if !ok {
		return ""
	}
	sources, _ := WorkspaceSources(p.host)
	token, _ := compiler.TokenTextAt(sources, path, position.Line+1, position.Character+1)
	return token
}

type referenceParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     Position               `json:"position"`
	Context      referenceContext       `json:"context"`
}

type referenceContext struct {
	IncludeDeclaration bool `json:"includeDeclaration"`
}
