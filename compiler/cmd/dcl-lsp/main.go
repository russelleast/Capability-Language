package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
	"capabilitylanguage/internal/parser"
)

const serverVersion = "0.5.6"

type server struct {
	folders []workspaceFolder
	docs    map[string]document
}

type document struct {
	URI     string
	Version int
	Text    string
}

func main() {
	s := &server{docs: map[string]document{}}
	if err := s.serve(os.Stdin, os.Stdout); err != nil {
		logEvent("server error", map[string]any{"error": err.Error()})
		os.Exit(1)
	}
}

func (s *server) serve(in io.Reader, out io.Writer) error {
	logEvent("startup", map[string]any{"version": serverVersion})
	reader := bufio.NewReader(in)
	for {
		payload, err := readMessage(reader)
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}
		var msg rpcMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			_ = writeResponse(out, nil, nil, &rpcError{Code: -32700, Message: "Parse error"})
			continue
		}
		result, rpcErr := s.handle(msg.Method, msg.Params)
		if len(msg.ID) > 0 {
			if err := writeResponse(out, msg.ID, result, rpcErr); err != nil {
				return err
			}
		}
	}
}

func (s *server) handle(method string, params json.RawMessage) (any, *rpcError) {
	switch method {
	case "initialize":
		var p initializeParams
		_ = json.Unmarshal(params, &p)
		s.folders = p.WorkspaceFolders
		if len(s.folders) == 0 && p.RootURI != "" {
			s.folders = []workspaceFolder{{URI: p.RootURI, Name: p.RootURI}}
		}
		logEvent("initialization", map[string]any{"workspaceCount": len(s.folders)})
		return initializeResult(), nil
	case "initialized":
		logEvent("initialized", nil)
		return nil, nil
	case "shutdown":
		logEvent("shutdown", nil)
		return nil, nil
	case "exit":
		logEvent("exit", nil)
		return nil, nil
	case "textDocument/didOpen":
		var p didOpenParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		s.docs[p.TextDocument.URI] = document{URI: p.TextDocument.URI, Version: p.TextDocument.Version, Text: p.TextDocument.Text}
		logEvent("file opened", map[string]any{"uri": p.TextDocument.URI, "version": p.TextDocument.Version})
		return nil, nil
	case "textDocument/didChange":
		var p didChangeParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		text := ""
		if len(p.ContentChanges) > 0 {
			text = p.ContentChanges[len(p.ContentChanges)-1].Text
		}
		s.docs[p.TextDocument.URI] = document{URI: p.TextDocument.URI, Version: p.TextDocument.Version, Text: text}
		logEvent("file changed", map[string]any{"uri": p.TextDocument.URI, "version": p.TextDocument.Version})
		return nil, nil
	case "textDocument/didClose":
		var p didCloseParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		delete(s.docs, p.TextDocument.URI)
		logEvent("file closed", map[string]any{"uri": p.TextDocument.URI})
		return nil, nil
	case "textDocument/didSave":
		var p didSaveParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		if p.Text != nil {
			current := s.docs[p.TextDocument.URI]
			current.URI = p.TextDocument.URI
			current.Text = *p.Text
			s.docs[p.TextDocument.URI] = current
		}
		logEvent("file saved", map[string]any{"uri": p.TextDocument.URI})
		return nil, nil
	case "textDocument/documentSymbol":
		var p documentSymbolParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		symbols, reason := s.documentSymbols(p.TextDocument.URI)
		logEvent("document symbols requested", map[string]any{"uri": p.TextDocument.URI, "resultCount": len(symbols), "zeroReason": reason})
		return symbols, nil
	case "workspace/symbol":
		var p workspaceSymbolParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		symbols := s.workspaceSymbols(p.Query)
		reason := ""
		if len(symbols) == 0 {
			reason = "no matching symbols"
		}
		logEvent("workspace symbols requested", map[string]any{"query": p.Query, "resultCount": len(symbols), "zeroReason": reason})
		return symbols, nil
	case "textDocument/definition":
		var p definitionParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		loc, reason, ok := s.definition(p.TextDocument.URI, p.Position)
		logEvent("definition requested", map[string]any{"uri": p.TextDocument.URI, "line": p.Position.Line, "character": p.Position.Character, "resultCount": boolCount(ok), "reason": reason})
		if !ok {
			return nil, nil
		}
		return loc, nil
	case "textDocument/references":
		var p referenceParams
		if err := json.Unmarshal(params, &p); err != nil {
			return nil, invalidParams(err)
		}
		refs, reason := s.references(p.TextDocument.URI, p.Position, p.Context.IncludeDeclaration)
		logEvent("references requested", map[string]any{"uri": p.TextDocument.URI, "line": p.Position.Line, "character": p.Position.Character, "resultCount": len(refs), "reason": reason})
		return refs, nil
	default:
		return nil, &rpcError{Code: -32601, Message: "Method not found"}
	}
}

func initializeResult() map[string]any {
	return map[string]any{
		"serverInfo": map[string]any{"name": "dcl-lsp", "version": serverVersion},
		"capabilities": map[string]any{
			"textDocumentSync":        map[string]any{"openClose": true, "change": 1, "save": map[string]any{"includeText": true}},
			"documentSymbolProvider":  true,
			"workspaceSymbolProvider": true,
			"definitionProvider":      true,
			"referencesProvider":      true,
		},
	}
}

func (s *server) documentSymbols(uri string) ([]documentSymbol, string) {
	source, ok := s.sourceForURI(uri)
	if !ok {
		return nil, "document not found in workspace model"
	}
	program := parseSources([]sourceFile{source})
	symbols := buildDocumentSymbols(program, source.Path)
	if len(symbols) == 0 {
		return symbols, "no symbols for document"
	}
	return symbols, ""
}

func (s *server) workspaceSymbols(query string) []workspaceSymbol {
	sources, pathToURI := s.workspaceSources()
	program := parseSources(sources)
	var symbols []workspaceSymbol
	for _, sym := range flattenSymbols(program) {
		if !fuzzyMatch(query, sym.Name) {
			continue
		}
		if uri := pathToURI[sym.Span.File]; uri != "" {
			symbols = append(symbols, workspaceSymbol{Name: sym.Name, Detail: sym.Detail, Kind: sym.LSPKind, Location: location{URI: uri, Range: rangeFromSpan(sym.Span)}, ContainerName: sym.Container})
		}
	}
	sort.SliceStable(symbols, func(i, j int) bool { return symbols[i].Name < symbols[j].Name })
	return symbols
}

func (s *server) definition(uri string, pos position) (location, string, bool) {
	sym, program, pathToURI, ok := s.symbolAt(uri, pos)
	if !ok {
		return location{}, "not on a symbol or unresolved reference", false
	}
	for _, candidate := range flattenSymbols(program) {
		if sameSemanticSymbol(candidate, sym) {
			return location{URI: pathToURI[candidate.Span.File], Range: rangeFromSpan(candidate.Span)}, "resolved reference", true
		}
	}
	return location{}, "unresolved reference", false
}

func (s *server) references(uri string, pos position, includeDeclaration bool) ([]location, string) {
	target, program, pathToURI, ok := s.symbolAt(uri, pos)
	if !ok {
		return nil, "not on a symbol or unresolved reference"
	}
	var refs []location
	if includeDeclaration {
		refs = append(refs, location{URI: pathToURI[target.Span.File], Range: rangeFromSpan(target.Span)})
	}
	for _, ref := range semanticReferences(program) {
		if sameSemanticSymbol(ref, target) {
			refs = append(refs, location{URI: pathToURI[ref.Span.File], Range: rangeFromSpan(ref.Span)})
		}
	}
	if len(refs) == 0 {
		return refs, "no semantic references found"
	}
	return dedupeLocations(refs), ""
}

func (s *server) symbolAt(uri string, pos position) (semanticSymbol, ast.Program, map[string]string, bool) {
	source, ok := s.sourceForURI(uri)
	if !ok {
		return semanticSymbol{}, ast.Program{}, nil, false
	}
	token := tokenAt(source, pos.Line+1, pos.Character+1)
	if token == "" {
		return semanticSymbol{}, ast.Program{}, nil, false
	}
	sources, pathToURI := s.workspaceSources()
	program := parseSources(sources)
	context := contextAt(program, source.Path, pos.Line+1)
	capability := capabilityAt(program, source.Path, pos.Line+1)
	if capability.Name != "" {
		context = capability.Meta.ContextName
	}
	for _, sym := range append(flattenSymbols(program), semanticReferences(program)...) {
		if sym.Name == token && (sym.Context == context || sym.Kind == "context" || sym.Kind == "event" || sym.Kind == "shape" || sym.Kind == "capability") {
			return sym, program, pathToURI, true
		}
	}
	return semanticSymbol{}, program, pathToURI, false
}

type sourceFile struct{ Path, Text string }

func (s *server) sourceForURI(uri string) (sourceFile, bool) {
	if doc, ok := s.docs[uri]; ok {
		path, ok := fileURIToPath(uri)
		if !ok {
			return sourceFile{}, false
		}
		abs, _ := filepath.Abs(path)
		return sourceFile{Path: abs, Text: doc.Text}, true
	}
	path, ok := fileURIToPath(uri)
	if !ok {
		return sourceFile{}, false
	}
	abs, _ := filepath.Abs(path)
	text, err := os.ReadFile(abs)
	if err != nil {
		return sourceFile{}, false
	}
	return sourceFile{Path: abs, Text: string(text)}, true
}

func (s *server) workspaceSources() ([]sourceFile, map[string]string) {
	byPath := map[string]sourceFile{}
	pathToURI := map[string]string{}
	for _, folder := range s.folders {
		root, ok := fileURIToPath(folder.URI)
		if !ok {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil || entry.IsDir() {
				if entry != nil && (entry.Name() == ".git" || entry.Name() == "node_modules") {
					return filepath.SkipDir
				}
				return nil
			}
			if filepath.Ext(path) != ".dcl" {
				return nil
			}
			abs, _ := filepath.Abs(path)
			text, err := os.ReadFile(abs)
			if err == nil {
				byPath[abs] = sourceFile{Path: abs, Text: string(text)}
				pathToURI[abs] = pathToFileURI(abs)
			}
			return nil
		})
	}
	for uri, doc := range s.docs {
		path, ok := fileURIToPath(uri)
		if !ok {
			continue
		}
		abs, _ := filepath.Abs(path)
		byPath[abs] = sourceFile{Path: abs, Text: doc.Text}
		pathToURI[abs] = uri
	}
	var sources []sourceFile
	for _, source := range byPath {
		sources = append(sources, source)
	}
	return sources, pathToURI
}

func parseSources(sources []sourceFile) ast.Program {
	var program ast.Program
	sort.SliceStable(sources, func(i, j int) bool { return sources[i].Path < sources[j].Path })
	for _, source := range sources {
		program.Files = append(program.Files, source.Path)
		tokens, _ := lexer.Lex(source.Path, source.Text)
		parsed, _ := parser.Parse(tokens)
		mergeProgram(&program, parsed)
	}
	return program
}

func mergeProgram(dst *ast.Program, src *ast.Program) {
	if src == nil {
		return
	}
	dst.Languages = append(dst.Languages, src.Languages...)
	dst.Contexts = append(dst.Contexts, src.Contexts...)
	dst.Dependencies = append(dst.Dependencies, src.Dependencies...)
	dst.Shapes = append(dst.Shapes, src.Shapes...)
	dst.Actors = append(dst.Actors, src.Actors...)
	dst.Events = append(dst.Events, src.Events...)
	dst.Effects = append(dst.Effects, src.Effects...)
	dst.Policies = append(dst.Policies, src.Policies...)
	dst.Capabilities = append(dst.Capabilities, src.Capabilities...)
}

type semanticSymbol struct {
	Kind, Name, Detail, Context, Container string
	Span                                   diagnostic.Span
	LSPKind                                int
}

func flattenSymbols(program ast.Program) []semanticSymbol {
	var out []semanticSymbol
	for _, c := range program.Contexts {
		out = append(out, semanticSymbol{Kind: "context", Detail: "Context", Name: c.Name, Context: c.Name, Span: c.Span, LSPKind: 3})
	}
	for _, s := range program.Shapes {
		out = append(out, semanticSymbol{Kind: "shape", Detail: "Shape", Name: s.Name, Context: s.Meta.ContextName, Span: s.Span, LSPKind: 23})
	}
	for _, e := range program.Events {
		out = append(out, semanticSymbol{Kind: "event", Detail: "Event", Name: e.Name, Context: e.Meta.ContextName, Span: e.Span, LSPKind: 24})
	}
	for _, cap := range program.Capabilities {
		container := cap.Name
		out = append(out, semanticSymbol{Kind: "capability", Detail: "Capability", Name: cap.Name, Context: cap.Meta.ContextName, Span: cap.Span, LSPKind: 5})
		for _, i := range cap.Intents {
			out = append(out, semanticSymbol{Kind: "intent", Detail: "Intent", Name: i.Name, Context: cap.Meta.ContextName, Container: container, Span: i.Span, LSPKind: 6})
		}
		for _, o := range cap.Outcomes {
			out = append(out, semanticSymbol{Kind: "outcome", Detail: "Outcome", Name: o.Name, Context: cap.Meta.ContextName, Container: container, Span: o.Span, LSPKind: 24})
		}
		if cap.Lifecycle != nil {
			name := cap.Lifecycle.Name
			if name == "" {
				name = "Lifecycle"
			}
			out = append(out, semanticSymbol{Kind: "lifecycle", Detail: "Lifecycle", Name: name, Context: cap.Meta.ContextName, Container: container, Span: cap.Lifecycle.Span, LSPKind: 11})
			for _, step := range cap.Lifecycle.Steps {
				out = append(out, semanticSymbol{Kind: "lifecycleStep", Detail: "Lifecycle Step", Name: step.Name, Context: cap.Meta.ContextName, Container: name, Span: step.Span, LSPKind: 6})
			}
		}
	}
	return out
}

func semanticReferences(program ast.Program) []semanticSymbol {
	var out []semanticSymbol
	for _, cap := range program.Capabilities {
		context := cap.Meta.ContextName
		for _, i := range cap.Intents {
			out = append(out, semanticSymbol{Kind: "shape", Detail: "Shape", Name: i.InputType, Context: context, Span: i.Span, LSPKind: 23})
		}
		for _, e := range cap.Events {
			out = append(out, semanticSymbol{Kind: "event", Detail: "Event", Name: e.Name, Context: context, Span: e.Span, LSPKind: 24})
		}
		for _, w := range cap.When {
			if w.Outcome != "" {
				out = append(out, semanticSymbol{Kind: "outcome", Detail: "Outcome", Name: w.Outcome, Context: context, Span: w.Span, LSPKind: 24})
			}
		}
		if cap.Lifecycle != nil {
			for _, tr := range cap.Lifecycle.Transitions {
				out = append(out, semanticSymbol{Kind: tr.TriggerKind, Detail: tr.TriggerKind, Name: tr.TriggerName, Context: context, Span: tr.Span, LSPKind: 24})
				if tr.SourceCapability != "" {
					out = append(out, semanticSymbol{Kind: "capability", Detail: "Capability", Name: tr.SourceCapability, Context: context, Span: tr.Span, LSPKind: 5})
				}
			}
		}
	}
	return out
}

func sameSemanticSymbol(a, b semanticSymbol) bool {
	return a.Kind == b.Kind && a.Name == b.Name && (a.Context == b.Context || a.Kind == "event" || a.Kind == "shape" || a.Kind == "capability")
}

func buildDocumentSymbols(program ast.Program, path string) []documentSymbol {
	var out []documentSymbol
	for _, sym := range flattenSymbols(program) {
		if sym.Span.File == path && sym.Container == "" {
			out = append(out, documentSymbol{Name: sym.Name, Detail: sym.Detail, Kind: sym.LSPKind, Range: rangeFromSpan(sym.Span), SelectionRange: rangeFromSpan(sym.Span)})
		}
	}
	return out
}

func tokenAt(source sourceFile, line, column int) string {
	tokens, _ := lexer.Lex(source.Path, source.Text)
	for _, token := range tokens {
		if token.Span.Line == line && column >= token.Span.Column && column <= token.Span.Column+len(token.Text) {
			return token.Text
		}
	}
	return ""
}

func contextAt(program ast.Program, path string, line int) string {
	context := "default"
	for _, c := range program.Contexts {
		if c.Span.File == path && c.Span.Line <= line {
			context = c.Name
		}
	}
	return context
}

func capabilityAt(program ast.Program, path string, line int) ast.CapabilityDecl {
	var out ast.CapabilityDecl
	for _, cap := range program.Capabilities {
		if cap.Span.File == path && cap.Span.Line <= line {
			out = cap
		}
	}
	return out
}

func fuzzyMatch(query, name string) bool {
	query = strings.ToLower(strings.TrimSpace(query))
	name = strings.ToLower(name)
	if query == "" || strings.Contains(name, query) {
		return true
	}
	idx := 0
	for _, ch := range name {
		if idx < len(query) && byte(ch) == query[idx] {
			idx++
		}
	}
	return idx == len(query)
}

func dedupeLocations(items []location) []location {
	seen := map[string]bool{}
	var out []location
	for _, item := range items {
		key := fmt.Sprintf("%s:%d:%d", item.URI, item.Range.Start.Line, item.Range.Start.Character)
		if !seen[key] {
			seen[key] = true
			out = append(out, item)
		}
	}
	return out
}

func fileURIToPath(uri string) (string, bool) {
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "file" || parsed.Path == "" {
		return "", false
	}
	return filepath.FromSlash(parsed.Path), true
}

func pathToFileURI(path string) string {
	return (&url.URL{Scheme: "file", Path: filepath.ToSlash(path)}).String()
}

func rangeFromSpan(span diagnostic.Span) lspRange {
	line := span.Line - 1
	if line < 0 {
		line = 0
	}
	char := span.Column - 1
	if char < 0 {
		char = 0
	}
	return lspRange{Start: position{Line: line, Character: char}, End: position{Line: line, Character: char + 1}}
}

func boolCount(value bool) int {
	if value {
		return 1
	}
	return 0
}

func logEvent(event string, fields map[string]any) {
	if fields == nil {
		fields = map[string]any{}
	}
	fields["event"] = event
	fields["time"] = time.Now().UTC().Format(time.RFC3339Nano)
	payload, _ := json.Marshal(fields)
	fmt.Fprintln(os.Stderr, string(payload))
}

func invalidParams(err error) *rpcError {
	return &rpcError{Code: -32602, Message: "Invalid params: " + err.Error()}
}

func readMessage(reader *bufio.Reader) ([]byte, error) {
	length := -1
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}
		name, value, ok := strings.Cut(line, ":")
		if ok && strings.EqualFold(strings.TrimSpace(name), "Content-Length") {
			parsed, err := strconv.Atoi(strings.TrimSpace(value))
			if err != nil {
				return nil, err
			}
			length = parsed
		}
	}
	if length < 0 {
		return nil, fmt.Errorf("missing Content-Length")
	}
	payload := make([]byte, length)
	_, err := io.ReadFull(reader, payload)
	return payload, err
}

func writeResponse(out io.Writer, id json.RawMessage, result any, responseErr *rpcError) error {
	payload, err := json.Marshal(rpcResponse{JSONRPC: "2.0", ID: id, Result: result, Error: responseErr})
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(out, "Content-Length: %d\r\n\r\n%s", len(payload), payload)
	return err
}

type rpcMessage struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type workspaceFolder struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}
type initializeParams struct {
	RootURI          string            `json:"rootUri"`
	WorkspaceFolders []workspaceFolder `json:"workspaceFolders"`
}
type textDocumentIdentifier struct {
	URI string `json:"uri"`
}
type textDocumentItem struct {
	URI     string `json:"uri"`
	Version int    `json:"version"`
	Text    string `json:"text"`
}
type didOpenParams struct {
	TextDocument textDocumentItem `json:"textDocument"`
}
type didChangeParams struct {
	TextDocument struct {
		URI     string `json:"uri"`
		Version int    `json:"version"`
	} `json:"textDocument"`
	ContentChanges []struct {
		Text string `json:"text"`
	} `json:"contentChanges"`
}
type didCloseParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
}
type didSaveParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Text         *string                `json:"text,omitempty"`
}
type documentSymbolParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
}
type workspaceSymbolParams struct {
	Query string `json:"query"`
}
type definitionParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     position               `json:"position"`
}
type referenceParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Position     position               `json:"position"`
	Context      struct {
		IncludeDeclaration bool `json:"includeDeclaration"`
	} `json:"context"`
}
type position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}
type lspRange struct {
	Start position `json:"start"`
	End   position `json:"end"`
}
type location struct {
	URI   string   `json:"uri"`
	Range lspRange `json:"range"`
}
type documentSymbol struct {
	Name           string           `json:"name"`
	Detail         string           `json:"detail,omitempty"`
	Kind           int              `json:"kind"`
	Range          lspRange         `json:"range"`
	SelectionRange lspRange         `json:"selectionRange"`
	Children       []documentSymbol `json:"children,omitempty"`
}
type workspaceSymbol struct {
	Name          string   `json:"name"`
	Detail        string   `json:"detail,omitempty"`
	Kind          int      `json:"kind"`
	Location      location `json:"location"`
	ContainerName string   `json:"containerName,omitempty"`
}
