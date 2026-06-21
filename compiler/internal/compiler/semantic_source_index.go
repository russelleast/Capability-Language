package compiler

import (
	"fmt"
	"sort"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
)

type SemanticSourceRole string

const (
	SemanticSourceDeclaration SemanticSourceRole = "declaration"
	SemanticSourceReference   SemanticSourceRole = "reference"
)

type SemanticSourceRange struct {
	File               string
	Line, Column       int
	EndLine, EndColumn int
}

type SemanticSourceEntry struct {
	File                string
	Range               SemanticSourceRange
	TokenRange          SemanticSourceRange
	Name                string
	DisplayName         string
	Kind                string
	Role                SemanticSourceRole
	SemanticID          string
	TargetSemanticID    string
	ParentSemanticID    string
	ContainerContext    string
	DeclarationLocation *SemanticSourceRange
	Reason              string
}

type SemanticSourceIndex struct {
	entries      []SemanticSourceEntry
	declarations map[string]SemanticSourceEntry
	unsupported  []string
	seen         map[string]bool
}

func NewSemanticSourceIndex(sources []SourceFile) *SemanticSourceIndex {
	index := &SemanticSourceIndex{
		declarations: map[string]SemanticSourceEntry{},
		seen:         map[string]bool{},
	}
	if len(sources) == 0 {
		return index
	}
	parsed := ParseSources(sources)
	index.addDeclarations(parsed.Program, sources)
	index.addReferences(sources, parsed.Program)
	sort.SliceStable(index.entries, func(i, j int) bool {
		return entryBefore(index.entries[i], index.entries[j])
	})
	return index
}

func (i *SemanticSourceIndex) Entries() []SemanticSourceEntry {
	return append([]SemanticSourceEntry(nil), i.entries...)
}

func (i *SemanticSourceIndex) UnsupportedReasons() []string {
	out := append([]string(nil), i.unsupported...)
	sort.Strings(out)
	return out
}

func (i *SemanticSourceIndex) SymbolsForDocument(file string) []SemanticSourceEntry {
	var out []SemanticSourceEntry
	for _, entry := range i.entries {
		if entry.Role == SemanticSourceDeclaration && entry.File == file {
			out = append(out, entry)
		}
	}
	return out
}

func (i *SemanticSourceIndex) SymbolsForWorkspace(query string) []SemanticSourceEntry {
	normalized := strings.ToLower(strings.TrimSpace(query))
	var out []SemanticSourceEntry
	for _, entry := range i.entries {
		if entry.Role != SemanticSourceDeclaration {
			continue
		}
		if normalized == "" || fuzzySourceMatch(normalized, strings.ToLower(entry.Name)) || fuzzySourceMatch(normalized, strings.ToLower(entry.DisplayName)) {
			out = append(out, entry)
		}
	}
	return out
}

func (i *SemanticSourceIndex) EntryAtPosition(file string, line, column int) (SemanticSourceEntry, bool) {
	var matches []SemanticSourceEntry
	for _, entry := range i.entries {
		if entry.File != file {
			continue
		}
		rng := entry.TokenRange
		if rng.File == "" {
			rng = entry.Range
		}
		if containsSourcePosition(rng, line, column) {
			matches = append(matches, entry)
		}
	}
	if len(matches) == 0 {
		return SemanticSourceEntry{}, false
	}
	sort.SliceStable(matches, func(a, b int) bool {
		left := sourceRangeWidth(matches[a].TokenRange)
		right := sourceRangeWidth(matches[b].TokenRange)
		if left != right {
			return left < right
		}
		if matches[a].Role != matches[b].Role {
			return matches[a].Role == SemanticSourceReference
		}
		return entryBefore(matches[a], matches[b])
	})
	return matches[0], true
}

func (i *SemanticSourceIndex) DefinitionForPosition(file string, line, column int) (SemanticSourceEntry, bool) {
	entry, ok := i.EntryAtPosition(file, line, column)
	if !ok {
		return SemanticSourceEntry{}, false
	}
	if entry.Role == SemanticSourceDeclaration {
		if entry.Kind == "intent" {
			return SemanticSourceEntry{}, false
		}
		return entry, true
	}
	if entry.TargetSemanticID == "" {
		return SemanticSourceEntry{}, false
	}
	target, ok := i.declarations[entry.TargetSemanticID]
	return target, ok
}

func (i *SemanticSourceIndex) ReferencesForPosition(file string, line, column int, includeDeclaration bool) []SemanticSourceEntry {
	entry, ok := i.EntryAtPosition(file, line, column)
	if !ok {
		return nil
	}
	id := entry.SemanticID
	if entry.Role == SemanticSourceReference && entry.TargetSemanticID != "" {
		id = entry.TargetSemanticID
	}
	var out []SemanticSourceEntry
	if includeDeclaration {
		if decl, ok := i.declarations[id]; ok {
			out = append(out, decl)
		}
	}
	for _, candidate := range i.entries {
		if candidate.Role == SemanticSourceReference && candidate.TargetSemanticID == id {
			out = append(out, candidate)
		}
	}
	return out
}

func (i *SemanticSourceIndex) addDeclarations(program ast.Program, sources []SourceFile) {
	tokenCache := newTokenCache(sources)
	for _, context := range program.Contexts {
		i.addDeclaration("context", context.Name, context.Name, context.Parent, "", context.Name, context.Span, tokenCache.nameRange(context.Span, context.Name))
	}
	for _, shape := range program.Shapes {
		context := declContext(shape.Meta.ContextName)
		i.addDeclaration("shape", shape.Name, shape.Name, context, "", context, shape.Span, tokenCache.nameRange(shape.Span, shape.Name))
	}
	for _, actor := range program.Actors {
		context := declContext(actor.Meta.ContextName)
		i.addDeclaration("actor", actor.Name, actor.Name, context, "", context, actor.Span, tokenCache.nameRange(actor.Span, actor.Name))
	}
	for _, event := range program.Events {
		context := declContext(event.Meta.ContextName)
		i.addDeclaration("event", event.Name, event.Name, context, "", context, event.Span, tokenCache.nameRange(event.Span, event.Name))
	}
	for _, effect := range program.Effects {
		context := declContext(effect.Meta.ContextName)
		i.addDeclaration("effect", effect.Name, effect.Name, context, "", context, effect.Span, tokenCache.nameRange(effect.Span, effect.Name))
	}
	for _, policy := range program.Policies {
		context := declContext(policy.Meta.ContextName)
		i.addDeclaration("policy", policy.Name, policy.Name, context, "", context, policy.Span, tokenCache.nameRange(policy.Span, policy.Name))
	}
	for _, capability := range program.Capabilities {
		context := declContext(capability.Meta.ContextName)
		capID := semanticSourceID("capability", context, capability.Name, "")
		i.addDeclaration("capability", capability.Name, capability.Name, context, "", context, capability.Span, tokenCache.nameRange(capability.Span, capability.Name))
		for _, intent := range capability.Intents {
			i.addDeclaration("intent", intent.Name, intent.Name, context, capID, context, intent.Span, tokenCache.nameRange(intent.Span, intent.Name))
		}
		for _, outcome := range capability.Outcomes {
			i.addDeclaration("outcome", outcome.Name, outcome.Name, context, capID, context, outcome.Span, tokenCache.nameRange(outcome.Span, outcome.Name))
		}
		for _, rule := range capability.Rules {
			i.addDeclaration("rule", rule.Name, rule.Name, context, capID, context, rule.Span, tokenCache.nameRange(rule.Span, rule.Name))
		}
		if capability.Lifecycle != nil {
			name := lifecycleName(capability)
			lifecycleID := semanticSourceID("lifecycle", context, name, capID)
			i.addDeclaration("lifecycle", name, name, context, capID, context, capability.Lifecycle.Span, tokenCache.nameRange(capability.Lifecycle.Span, name))
			for _, step := range capability.Lifecycle.Steps {
				i.addDeclaration("lifecycleStep", step.Name, step.Name, context, lifecycleID, context, step.Span, tokenCache.nameRange(step.Span, step.Name))
			}
		}
	}
}

func (i *SemanticSourceIndex) addDeclaration(kind, name, displayName, context, parentID, containerContext string, span diagnostic.Span, tokenRange SemanticSourceRange) {
	id := semanticSourceID(kind, context, name, parentID)
	entry := SemanticSourceEntry{
		File:             span.File,
		Range:            rangeFromSpan(span),
		TokenRange:       tokenRange,
		Name:             name,
		DisplayName:      displayName,
		Kind:             kind,
		Role:             SemanticSourceDeclaration,
		SemanticID:       id,
		ParentSemanticID: parentID,
		ContainerContext: containerContext,
	}
	i.entries = append(i.entries, entry)
	i.declarations[id] = entry
}

func (i *SemanticSourceIndex) addReferences(sources []SourceFile, program ast.Program) {
	tokenCache := newTokenCache(sources)
	for _, declaration := range i.declarations {
		refs := ReferencesAt(sources, declaration.File, declaration.TokenRange.Line, declaration.TokenRange.Column, false)
		for _, ref := range refs {
			targetID := semanticSourceID(ref.Kind, ref.Context, ref.Name, parentForReference(i.declarations, ref))
			target, ok := i.declarations[targetID]
			if !ok {
				i.unsupported = append(i.unsupported, fmt.Sprintf("unsupported reference kind %s for %s", ref.Kind, ref.Name))
				continue
			}
			tokenRange := tokenCache.nameRange(ref.Span, ref.Name)
			entry := SemanticSourceEntry{
				File:                ref.Span.File,
				Range:               rangeFromSpan(ref.Span),
				TokenRange:          tokenRange,
				Name:                ref.Name,
				DisplayName:         ref.Name,
				Kind:                ref.Kind,
				Role:                SemanticSourceReference,
				SemanticID:          target.SemanticID,
				TargetSemanticID:    target.SemanticID,
				ParentSemanticID:    target.ParentSemanticID,
				ContainerContext:    ref.Context,
				DeclarationLocation: &target.TokenRange,
			}
			i.addEntry(entry)
		}
	}
	i.addUnsupportedReferences(program)
}

func (i *SemanticSourceIndex) addUnsupportedReferences(program ast.Program) {
	for _, capability := range program.Capabilities {
		context := declContext(capability.Meta.ContextName)
		for _, rule := range capability.Rules {
			if strings.TrimSpace(rule.Expression) != "" {
				i.unsupported = append(i.unsupported, fmt.Sprintf("unsupported reference kind rule expression in %s.%s", context, rule.Name))
			}
		}
	}
}

func (i *SemanticSourceIndex) addEntry(entry SemanticSourceEntry) {
	key := fmt.Sprintf("%s|%s|%s|%d|%d|%s", entry.Role, entry.TargetSemanticID, entry.File, entry.TokenRange.Line, entry.TokenRange.Column, entry.SemanticID)
	if i.seen[key] {
		return
	}
	i.seen[key] = true
	i.entries = append(i.entries, entry)
}

func parentForReference(declarations map[string]SemanticSourceEntry, ref ReferenceLocation) string {
	if ref.Kind != "outcome" && ref.Kind != "intent" && ref.Kind != "rule" && ref.Kind != "lifecycle" && ref.Kind != "lifecycleStep" {
		return ""
	}
	for _, declaration := range declarations {
		if declaration.Kind == ref.Kind && declaration.Name == ref.Name && declaration.ContainerContext == ref.Context {
			return declaration.ParentSemanticID
		}
	}
	return ""
}

func semanticSourceID(kind, context, name, parentID string) string {
	return strings.Join([]string{kind, context, parentID, name}, "|")
}

type semanticTokenCache struct {
	tokens map[string][]lexer.Token
}

func newTokenCache(sources []SourceFile) semanticTokenCache {
	cache := semanticTokenCache{tokens: map[string][]lexer.Token{}}
	for _, source := range sources {
		tokens, _ := lexer.Lex(source.Path, source.Text)
		cache.tokens[source.Path] = tokens
	}
	return cache
}

func (c semanticTokenCache) nameRange(span diagnostic.Span, name string) SemanticSourceRange {
	for _, token := range c.tokens[span.File] {
		if token.Kind != lexer.Ident || token.Span.Line != span.Line || token.Text != name {
			continue
		}
		if token.Span.Column < span.Column {
			continue
		}
		return rangeFromToken(token)
	}
	for _, token := range c.tokens[span.File] {
		if token.Kind == lexer.Ident && token.Span.Line == span.Line && token.Text == name {
			return rangeFromToken(token)
		}
	}
	return rangeFromSpan(span)
}

func rangeFromToken(token lexer.Token) SemanticSourceRange {
	return SemanticSourceRange{
		File:      token.Span.File,
		Line:      token.Span.Line,
		Column:    token.Span.Column,
		EndLine:   token.Span.Line,
		EndColumn: token.Span.Column + len(token.Text),
	}
}

func rangeFromSpan(span diagnostic.Span) SemanticSourceRange {
	endColumn := span.Column + 1
	if endColumn < 1 {
		endColumn = 1
	}
	return SemanticSourceRange{File: span.File, Line: span.Line, Column: span.Column, EndLine: span.Line, EndColumn: endColumn}
}

func containsSourcePosition(rng SemanticSourceRange, line, column int) bool {
	if rng.File == "" || line < rng.Line || line > rng.EndLine {
		return false
	}
	if line == rng.Line && column < rng.Column {
		return false
	}
	if line == rng.EndLine && column > rng.EndColumn {
		return false
	}
	return true
}

func sourceRangeWidth(rng SemanticSourceRange) int {
	if rng.File == "" {
		return 1 << 30
	}
	return (rng.EndLine-rng.Line)*10000 + (rng.EndColumn - rng.Column)
}

func entryBefore(left, right SemanticSourceEntry) bool {
	if left.File != right.File {
		return left.File < right.File
	}
	if left.TokenRange.Line != right.TokenRange.Line {
		return left.TokenRange.Line < right.TokenRange.Line
	}
	if left.TokenRange.Column != right.TokenRange.Column {
		return left.TokenRange.Column < right.TokenRange.Column
	}
	return left.SemanticID < right.SemanticID
}

func fuzzySourceMatch(query, candidate string) bool {
	if strings.Contains(candidate, query) {
		return true
	}
	queryIndex := 0
	for _, char := range candidate {
		if queryIndex < len(query) && byte(char) == query[queryIndex] {
			queryIndex++
		}
	}
	return queryIndex == len(query)
}
