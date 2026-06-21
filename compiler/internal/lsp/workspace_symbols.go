package lsp

import (
	"sort"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
)

type WorkspaceSymbolProvider struct {
	host *WorkspaceHost
}

func NewWorkspaceSymbolProvider(host *WorkspaceHost) *WorkspaceSymbolProvider {
	return &WorkspaceSymbolProvider{host: host}
}

func (p *WorkspaceSymbolProvider) WorkspaceSymbols(query string) []WorkspaceSymbol {
	index, pathToURI, sources := BuildSemanticSourceIndex(p.host)
	if len(sources) == 0 {
		return nil
	}
	entries := index.SymbolsForWorkspace(query)
	var symbols []WorkspaceSymbol
	for _, entry := range entries {
		symbols = append(symbols, sourceEntryToWorkspaceSymbol(entry, pathToURI)...)
	}
	return symbols
}

type WorkspaceSymbolBuilder struct {
	pathToURI map[string]string
}

func (b WorkspaceSymbolBuilder) Build(program ast.Program, query string) []WorkspaceSymbol {
	candidates := b.collect(program)
	matches := make([]workspaceSymbolMatch, 0, len(candidates))
	for _, candidate := range candidates {
		score, ok := fuzzyScore(query, candidate.Name)
		if !ok {
			continue
		}
		matches = append(matches, workspaceSymbolMatch{symbol: candidate, score: score})
	}
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].score != matches[j].score {
			return matches[i].score < matches[j].score
		}
		return workspaceSymbolBefore(matches[i].symbol, matches[j].symbol)
	})
	symbols := make([]WorkspaceSymbol, 0, len(matches))
	for _, match := range matches {
		symbols = append(symbols, match.symbol)
	}
	return symbols
}

func (b WorkspaceSymbolBuilder) collect(program ast.Program) []WorkspaceSymbol {
	var symbols []WorkspaceSymbol
	for _, context := range program.Contexts {
		symbols = append(symbols, b.symbol(context.Name, "Context", symbolKindNamespace, context.Span, context.Parent, semanticIdentity("context", context.Name, context.Name))...)
	}
	for _, shape := range program.Shapes {
		symbols = append(symbols, b.symbol(shape.Name, "Shape", symbolKindStruct, shape.Span, displayContext(shape.Meta.ContextName), semanticIdentity("shape", shape.Meta.ContextName, shape.Name))...)
	}
	for _, actor := range program.Actors {
		symbols = append(symbols, b.symbol(actor.Name, "Actor", symbolKindObject, actor.Span, displayContext(actor.Meta.ContextName), semanticIdentity("actor", actor.Meta.ContextName, actor.Name))...)
	}
	for _, event := range program.Events {
		symbols = append(symbols, b.symbol(event.Name, "Event", symbolKindEvent, event.Span, displayContext(event.Meta.ContextName), semanticIdentity("event", event.Meta.ContextName, event.Name))...)
	}
	for _, effect := range program.Effects {
		symbols = append(symbols, b.symbol(effect.Name, "Effect", symbolKindFunction, effect.Span, displayContext(effect.Meta.ContextName), semanticIdentity("effect", effect.Meta.ContextName, effect.Name))...)
	}
	for _, policy := range program.Policies {
		symbols = append(symbols, b.symbol(policy.Name, "Policy", symbolKindProperty, policy.Span, displayContext(policy.Meta.ContextName), semanticIdentity("policy", policy.Meta.ContextName, policy.Name))...)
	}
	for _, capability := range program.Capabilities {
		capabilityID := semanticIdentity("capability", capability.Meta.ContextName, capability.Name)
		symbols = append(symbols, b.symbol(capability.Name, "Capability", symbolKindClass, capability.Span, displayContext(capability.Meta.ContextName), capabilityID)...)
		symbols = append(symbols, b.capabilitySymbols(capability, capabilityID)...)
	}
	return symbols
}

func (b WorkspaceSymbolBuilder) capabilitySymbols(capability ast.CapabilityDecl, capabilityID map[string]string) []WorkspaceSymbol {
	var symbols []WorkspaceSymbol
	container := capability.Name
	if displayContext(capability.Meta.ContextName) != "" {
		container = capability.Meta.ContextName + "." + capability.Name
	}
	for _, intent := range capability.Intents {
		symbols = append(symbols, b.symbol(intent.Name, "Intent", symbolKindMethod, intent.Span, container, childSemanticIdentity("intent", intent.Name, capabilityID))...)
	}
	for _, outcome := range capability.Outcomes {
		symbols = append(symbols, b.symbol(outcome.Name, "Outcome", symbolKindEvent, outcome.Span, container, childSemanticIdentity("outcome", outcome.Name, capabilityID))...)
	}
	for _, event := range capability.Events {
		symbols = append(symbols, b.symbol(event.Name, "Event", symbolKindEvent, event.Span, container, childSemanticIdentity("event", event.Name, capabilityID))...)
	}
	for _, effect := range capability.Effects {
		symbols = append(symbols, b.symbol(effect.Name, "Effect", symbolKindFunction, effect.Span, container, childSemanticIdentity("effect", effect.Name, capabilityID))...)
	}
	for _, policy := range capability.Policies {
		symbols = append(symbols, b.symbol(policy.Name, "Policy", symbolKindProperty, policy.Span, container, childSemanticIdentity("policy", policy.Name, capabilityID))...)
	}
	if capability.Lifecycle != nil {
		lifecycleName := capability.Lifecycle.Name
		if lifecycleName == "" {
			lifecycleName = "Lifecycle"
		}
		lifecycleID := childSemanticIdentity("lifecycle", lifecycleName, capabilityID)
		symbols = append(symbols, b.symbol(lifecycleName, "Lifecycle", symbolKindInterface, capability.Lifecycle.Span, container, lifecycleID)...)
		lifecycleContainer := container + "." + lifecycleName
		for _, step := range capability.Lifecycle.Steps {
			symbols = append(symbols, b.symbol(step.Name, "Lifecycle Step", symbolKindMethod, step.Span, lifecycleContainer, childSemanticIdentity("lifecycleStep", step.Name, lifecycleID))...)
		}
	}
	return symbols
}

func displayContext(context string) string {
	if context == "default" {
		return ""
	}
	return context
}

func (b WorkspaceSymbolBuilder) symbol(name, detail string, kind int, span diagnostic.Span, containerName string, data map[string]string) []WorkspaceSymbol {
	uri := b.pathToURI[span.File]
	if uri == "" {
		return nil
	}
	return []WorkspaceSymbol{{
		Name:          name,
		Detail:        detail,
		Kind:          kind,
		Location:      Location{URI: uri, Range: RangeFromSpan(span)},
		ContainerName: containerName,
		Data:          data,
	}}
}

func semanticIdentity(kind, context, name string) map[string]string {
	return map[string]string{
		"kind":    kind,
		"context": context,
		"name":    name,
	}
}

func childSemanticIdentity(kind, name string, parent map[string]string) map[string]string {
	identity := map[string]string{
		"kind":          kind,
		"context":       parent["context"],
		"name":          name,
		"parentKind":    parent["kind"],
		"parentName":    parent["name"],
		"parentContext": parent["context"],
	}
	return identity
}

type workspaceSymbolMatch struct {
	symbol WorkspaceSymbol
	score  int
}

func fuzzyScore(query, candidate string) (int, bool) {
	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	normalizedCandidate := strings.ToLower(candidate)
	if normalizedQuery == "" {
		return 1000, true
	}
	if normalizedCandidate == normalizedQuery {
		return 0, true
	}
	if strings.HasPrefix(normalizedCandidate, normalizedQuery) {
		return 1, true
	}
	if index := strings.Index(normalizedCandidate, normalizedQuery); index >= 0 {
		return 10 + index, true
	}
	queryIndex := 0
	firstMatch := -1
	lastMatch := -1
	for candidateIndex, char := range normalizedCandidate {
		if queryIndex >= len(normalizedQuery) {
			break
		}
		if byte(char) != normalizedQuery[queryIndex] {
			continue
		}
		if firstMatch == -1 {
			firstMatch = candidateIndex
		}
		lastMatch = candidateIndex
		queryIndex++
	}
	if queryIndex != len(normalizedQuery) {
		return 0, false
	}
	return 100 + firstMatch + lastMatch - firstMatch, true
}

func workspaceSymbolBefore(left, right WorkspaceSymbol) bool {
	if left.Location.URI != right.Location.URI {
		return left.Location.URI < right.Location.URI
	}
	if left.Location.Range.Start.Line != right.Location.Range.Start.Line {
		return left.Location.Range.Start.Line < right.Location.Range.Start.Line
	}
	if left.Location.Range.Start.Character != right.Location.Range.Start.Character {
		return left.Location.Range.Start.Character < right.Location.Range.Start.Character
	}
	if left.Name != right.Name {
		return left.Name < right.Name
	}
	return left.ContainerName < right.ContainerName
}

type workspaceSymbolParams struct {
	Query string `json:"query"`
}

type WorkspaceSymbol struct {
	Name          string            `json:"name"`
	Detail        string            `json:"detail,omitempty"`
	Kind          int               `json:"kind"`
	Location      Location          `json:"location"`
	ContainerName string            `json:"containerName,omitempty"`
	Data          map[string]string `json:"data,omitempty"`
}

type Location struct {
	URI   string `json:"uri"`
	Range Range  `json:"range"`
}
