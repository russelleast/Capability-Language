package lsp

import (
	"path/filepath"

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
	path, ok := fileURIToPath(uri)
	if !ok {
		return nil, "invalid file URI"
	}
	absolute, _ := filepath.Abs(path)
	sources, pathToURI := WorkspaceSources(p.host)
	if len(sources) == 0 {
		return nil, "no compiled workspace model"
	}
	references := compiler.ReferencesAt(sources, absolute, position.Line+1, position.Character+1, includeDeclaration)
	locations := make([]Location, 0, len(references))
	for _, reference := range references {
		targetURI := pathToURI[reference.Span.File]
		if targetURI == "" {
			targetURI = pathToFileURI(reference.Span.File)
		}
		locations = append(locations, Location{URI: targetURI, Range: RangeFromSpan(reference.Span)})
	}
	if len(locations) == 0 {
		return locations, "no semantic references found"
	}
	return locations, ""
}

func (p *ReferenceProvider) TokenAt(uri string, position Position) string {
	path, ok := fileURIToPath(uri)
	if !ok {
		return ""
	}
	absolute, _ := filepath.Abs(path)
	sources, _ := WorkspaceSources(p.host)
	token, _ := compiler.TokenTextAt(sources, absolute, position.Line+1, position.Character+1)
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
