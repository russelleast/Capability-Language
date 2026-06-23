package mcp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"

	"capabilitylanguage/internal/version"
)

const ProtocolVersion = "2025-06-18"

type Server struct {
	out      io.Writer
	outMu    sync.Mutex
	debug    bool
	debugOut io.Writer
}

func NewServer() *Server {
	return &Server{
		debug:    os.Getenv("DCL_MCP_DEBUG") == "1",
		debugOut: os.Stderr,
	}
}

func (s *Server) Serve(in io.Reader, out io.Writer) error {
	s.out = out
	reader := bufio.NewReader(in)
	for {
		payload, err := readMessage(reader)
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := s.handlePayload(payload); err != nil {
			return err
		}
	}
}

func (s *Server) handlePayload(payload []byte) error {
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
		s.debugLog("initialize received")
		return initializeResult(), nil
	case "notifications/initialized":
		s.debugLog("initialized notification received")
		return nil, nil
	case "ping":
		s.debugLog("ping received")
		return map[string]any{}, nil
	case "tools/list":
		s.debugLog("tools/list received")
		return map[string]any{"tools": Tools()}, nil
	case "tools/call":
		var request callToolParams
		if err := json.Unmarshal(params, &request); err != nil {
			s.debugLog("tools/call invalid params: %s", err.Error())
			return nil, invalidParams(err)
		}
		s.debugLog("tools/call received: %s", request.Name)
		result, err := CallTool(request.Name, request.Arguments)
		if err != nil {
			s.debugLog("tools/call failed: %s: %s", request.Name, err.Error())
			return nil, invalidParams(err)
		}
		if result.IsError {
			s.debugLog("tools/call completed with tool error: %s", request.Name)
		} else {
			s.debugLog("tools/call succeeded: %s", request.Name)
		}
		return result, nil
	default:
		s.debugLog("method not found: %s", method)
		return nil, &rpcError{Code: -32601, Message: "Method not found"}
	}
}

func initializeResult() map[string]any {
	return map[string]any{
		"protocolVersion": ProtocolVersion,
		"capabilities": map[string]any{
			"tools": map[string]any{"listChanged": false},
		},
		"serverInfo": map[string]any{
			"name":    "dcl-mcp",
			"version": version.CompilerVersion(),
		},
	}
}

func invalidParams(err error) *rpcError {
	return &rpcError{Code: -32602, Message: fmt.Sprintf("Invalid params: %s", err)}
}

func readMessage(reader *bufio.Reader) ([]byte, error) {
	first, err := reader.Peek(1)
	if err != nil {
		return nil, err
	}
	if first[0] == '{' {
		line, err := reader.ReadBytes('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return nil, err
		}
		return bytes.TrimSpace(line), nil
	}

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
	_, err = io.ReadFull(reader, payload)
	return payload, err
}

func writeMessage(out io.Writer, payload []byte) error {
	_, err := out.Write(payload)
	if err != nil {
		return err
	}
	_, err = out.Write([]byte("\n"))
	return err
}

func EncodeMessage(value any) []byte {
	payload, _ := json.Marshal(value)
	var buffer bytes.Buffer
	_ = writeMessage(&buffer, payload)
	return buffer.Bytes()
}

func EncodeContentLengthMessage(value any) []byte {
	payload, _ := json.Marshal(value)
	var buffer bytes.Buffer
	_, _ = fmt.Fprintf(&buffer, "Content-Length: %d\r\n\r\n", len(payload))
	_, _ = buffer.Write(payload)
	return buffer.Bytes()
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

func (s *Server) debugLog(format string, args ...any) {
	if !s.debug || s.debugOut == nil {
		return
	}
	_, _ = fmt.Fprintf(s.debugOut, "dcl-mcp: "+format+"\n", args...)
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
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type callToolParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}
