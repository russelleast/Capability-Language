package lsp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
)

const serverVersion = "0.5.4"

type Server struct {
	host             *WorkspaceHost
	logger           *Logger
	validator        *WorkspaceValidator
	symbols          *SymbolProvider
	workspaceSymbols *WorkspaceSymbolProvider
	definitions      *DefinitionProvider
	out              io.Writer
	outMu            sync.Mutex
}

func NewServer(host *WorkspaceHost, logger *Logger) *Server {
	if host == nil {
		host = NewWorkspaceHost()
	}
	server := &Server{host: host, logger: logger}
	server.validator = NewWorkspaceValidator(host, NewDiagnosticPublisher(server.sendNotification), logger)
	server.symbols = NewSymbolProvider(host)
	server.workspaceSymbols = NewWorkspaceSymbolProvider(host)
	server.definitions = NewDefinitionProvider(host)
	return server
}

func (s *Server) Host() *WorkspaceHost {
	return s.host
}

func (s *Server) Serve(in io.Reader, out io.Writer) error {
	s.log("startup", nil)
	reader := bufio.NewReader(in)
	for {
		payload, err := readMessage(reader)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := s.handlePayload(payload, out); err != nil {
			return err
		}
	}
}

func (s *Server) handlePayload(payload []byte, out io.Writer) error {
	s.out = out
	var message rpcMessage
	if err := json.Unmarshal(payload, &message); err != nil {
		return s.writeResponse(nil, nil, &rpcError{Code: -32700, Message: "Parse error"})
	}
	if message.Method == "" {
		return nil
	}

	result, responseErr := s.handle(message.Method, message.Params)
	if message.ID == nil {
		return nil
	}
	return s.writeResponse(message.ID, result, responseErr)
}

func (s *Server) handle(method string, params json.RawMessage) (any, *rpcError) {
	switch method {
	case "initialize":
		var request initializeParams
		_ = json.Unmarshal(params, &request)
		s.host.SetWorkspaceFolders(workspaceFoldersFromInitialize(request))
		s.host.MarkInitialized()
		s.log("initialization", map[string]any{"workspaceCount": s.host.WorkspaceCount()})
		return initializeResult(), nil
	case "initialized":
		s.log("initialized", s.healthFields())
		return nil, nil
	case "shutdown":
		s.host.MarkShutdown()
		s.log("shutdown", s.healthFields())
		return nil, nil
	case "exit":
		s.log("exit", s.healthFields())
		return nil, nil
	case "textDocument/didOpen":
		var request didOpenTextDocumentParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		s.host.Documents().Open(request.TextDocument.URI, request.TextDocument.Version, request.TextDocument.Text)
		s.log("file opened", map[string]any{"uri": request.TextDocument.URI, "version": request.TextDocument.Version, "openDocumentCount": s.host.Documents().Count()})
		s.validateNow()
		return nil, nil
	case "textDocument/didChange":
		var request didChangeTextDocumentParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		text := latestFullText(request.ContentChanges)
		s.host.Documents().Change(request.TextDocument.URI, request.TextDocument.Version, text)
		s.log("file changed", map[string]any{"uri": request.TextDocument.URI, "version": request.TextDocument.Version, "openDocumentCount": s.host.Documents().Count()})
		s.validator.ValidateSoon()
		return nil, nil
	case "textDocument/didClose":
		var request didCloseTextDocumentParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		s.host.Documents().Close(request.TextDocument.URI)
		s.log("file closed", map[string]any{"uri": request.TextDocument.URI, "openDocumentCount": s.host.Documents().Count()})
		s.validateNow()
		return nil, nil
	case "textDocument/didSave":
		var request didSaveTextDocumentParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		s.host.Documents().Save(request.TextDocument.URI, request.Text)
		s.log("file saved", map[string]any{"uri": request.TextDocument.URI, "openDocumentCount": s.host.Documents().Count()})
		s.validateNow()
		return nil, nil
	case "textDocument/documentSymbol":
		var request documentSymbolParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		s.log("document symbols requested", map[string]any{"uri": request.TextDocument.URI})
		return s.symbols.DocumentSymbols(request.TextDocument.URI), nil
	case "workspace/symbol":
		var request workspaceSymbolParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		symbols := s.workspaceSymbols.WorkspaceSymbols(request.Query)
		s.log("workspace symbols requested", map[string]any{"query": request.Query, "symbolCount": len(symbols)})
		return symbols, nil
	case "textDocument/definition":
		var request definitionParams
		if err := json.Unmarshal(params, &request); err != nil {
			return nil, invalidParams(err)
		}
		s.log("definition requested", map[string]any{"uri": request.TextDocument.URI, "line": request.Position.Line, "character": request.Position.Character})
		location, ok := s.definitions.Definition(request.TextDocument.URI, request.Position)
		if !ok {
			s.log("symbol unresolved", map[string]any{"uri": request.TextDocument.URI})
			return nil, nil
		}
		s.log("symbol resolved", map[string]any{"uri": request.TextDocument.URI, "targetUri": location.URI, "line": location.Range.Start.Line, "character": location.Range.Start.Character})
		return location, nil
	default:
		return nil, &rpcError{Code: -32601, Message: "Method not found"}
	}
}

func (s *Server) log(event string, fields map[string]any) {
	if fields == nil {
		fields = map[string]any{}
	}
	s.logger.Event(event, fields)
}

func (s *Server) healthFields() map[string]any {
	health := s.host.Health()
	return map[string]any{
		"running":           health.Running,
		"lifecycle":         health.Lifecycle,
		"workspaceCount":    health.WorkspaceCount,
		"openDocumentCount": health.OpenDocumentCount,
		"diagnosticsCount":  health.DiagnosticsCount,
		"lastValidation":    health.LastValidationTimestamp,
	}
}

func (s *Server) validateNow() {
	s.validator.Validate()
}

func (s *Server) sendNotification(method string, params any) error {
	payload, err := json.Marshal(struct {
		JSONRPC string `json:"jsonrpc"`
		Method  string `json:"method"`
		Params  any    `json:"params"`
	}{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
	})
	if err != nil {
		return err
	}
	s.outMu.Lock()
	defer s.outMu.Unlock()
	return writeMessage(s.out, payload)
}

func (s *Server) writeResponse(id json.RawMessage, result any, responseErr *rpcError) error {
	response := rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
		Error:   responseErr,
	}
	payload, err := json.Marshal(response)
	if err != nil {
		return err
	}
	s.outMu.Lock()
	defer s.outMu.Unlock()
	return writeMessage(s.out, payload)
}

func initializeResult() map[string]any {
	return map[string]any{
		"serverInfo": map[string]any{
			"name":    "dcl-lsp",
			"version": serverVersion,
		},
		"capabilities": map[string]any{
			"textDocumentSync": map[string]any{
				"openClose": true,
				"change":    1,
				"save": map[string]any{
					"includeText": true,
				},
			},
			"documentSymbolProvider":  true,
			"workspaceSymbolProvider": true,
			"definitionProvider":      true,
		},
	}
}

func workspaceFoldersFromInitialize(request initializeParams) []WorkspaceFolder {
	if len(request.WorkspaceFolders) > 0 {
		return request.WorkspaceFolders
	}
	if request.RootURI != "" {
		return []WorkspaceFolder{{URI: request.RootURI, Name: request.RootURI}}
	}
	return nil
}

func latestFullText(changes []textDocumentContentChangeEvent) string {
	if len(changes) == 0 {
		return ""
	}
	return changes[len(changes)-1].Text
}

func invalidParams(err error) *rpcError {
	return &rpcError{Code: -32602, Message: fmt.Sprintf("Invalid params: %s", err)}
}

func readMessage(reader *bufio.Reader) ([]byte, error) {
	contentLength := -1
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
		if !ok {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(name), "Content-Length") {
			parsed, err := strconv.Atoi(strings.TrimSpace(value))
			if err != nil {
				return nil, err
			}
			contentLength = parsed
		}
	}
	if contentLength < 0 {
		return nil, errors.New("missing Content-Length header")
	}
	payload := make([]byte, contentLength)
	_, err := io.ReadFull(reader, payload)
	return payload, err
}

func writeMessage(out io.Writer, payload []byte) error {
	_, err := fmt.Fprintf(out, "Content-Length: %d\r\n\r\n", len(payload))
	if err != nil {
		return err
	}
	_, err = out.Write(payload)
	return err
}

func EncodeMessage(value any) []byte {
	payload, _ := json.Marshal(value)
	var buffer bytes.Buffer
	_ = writeMessage(&buffer, payload)
	return buffer.Bytes()
}

type rpcMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type initializeParams struct {
	RootURI          string            `json:"rootUri"`
	WorkspaceFolders []WorkspaceFolder `json:"workspaceFolders"`
}

type didOpenTextDocumentParams struct {
	TextDocument textDocumentItem `json:"textDocument"`
}

type textDocumentItem struct {
	URI        string `json:"uri"`
	LanguageID string `json:"languageId"`
	Version    int    `json:"version"`
	Text       string `json:"text"`
}

type didChangeTextDocumentParams struct {
	TextDocument   versionedTextDocumentIdentifier  `json:"textDocument"`
	ContentChanges []textDocumentContentChangeEvent `json:"contentChanges"`
}

type versionedTextDocumentIdentifier struct {
	URI     string `json:"uri"`
	Version int    `json:"version"`
}

type textDocumentContentChangeEvent struct {
	Text string `json:"text"`
}

type didCloseTextDocumentParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
}

type didSaveTextDocumentParams struct {
	TextDocument textDocumentIdentifier `json:"textDocument"`
	Text         *string                `json:"text,omitempty"`
}

type textDocumentIdentifier struct {
	URI string `json:"uri"`
}
