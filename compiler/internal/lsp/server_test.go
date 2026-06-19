package lsp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestServerLifecycleAndDocumentNotifications(t *testing.T) {
	host := NewWorkspaceHost()
	var logs bytes.Buffer
	server := NewServer(host, NewLogger(&logs))
	input := bytes.Join([][]byte{
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params": map[string]any{
				"workspaceFolders": []map[string]any{{"uri": "file:///workspace", "name": "workspace"}},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "initialized",
			"params":  map[string]any{},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "textDocument/didOpen",
			"params": map[string]any{
				"textDocument": map[string]any{
					"uri":        "file:///workspace/order.dcl",
					"languageId": "dcl",
					"version":    1,
					"text":       "capability Order",
				},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "textDocument/didChange",
			"params": map[string]any{
				"textDocument": map[string]any{"uri": "file:///workspace/order.dcl", "version": 2},
				"contentChanges": []map[string]any{{
					"text": "capability ChangedOrder",
				}},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "textDocument/didSave",
			"params": map[string]any{
				"textDocument": map[string]any{"uri": "file:///workspace/order.dcl"},
				"text":         "capability SavedOrder",
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "shutdown",
			"params":  map[string]any{},
		}),
	}, nil)
	var output bytes.Buffer

	if err := server.Serve(bytes.NewReader(input), &output); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	if host.WorkspaceCount() != 1 {
		t.Fatalf("expected one workspace folder, got %d", host.WorkspaceCount())
	}
	document, ok := host.Documents().Get("file:///workspace/order.dcl")
	if !ok {
		t.Fatal("expected open document")
	}
	if document.Version != 2 || document.Text != "capability SavedOrder" {
		t.Fatalf("unexpected document after notifications: %+v", document)
	}
	if host.Lifecycle() != LifecycleShutdown {
		t.Fatalf("expected shutdown lifecycle, got %s", host.Lifecycle())
	}

	responses := decodeResponses(t, output.Bytes())
	if len(responses) != 2 {
		t.Fatalf("expected initialize and shutdown responses, got %d: %q", len(responses), output.String())
	}
	if responses[0]["id"].(float64) != 1 {
		t.Fatalf("expected initialize response id 1, got %v", responses[0]["id"])
	}
	if responses[0]["result"] == nil {
		t.Fatal("expected initialize result")
	}

	logText := logs.String()
	for _, event := range []string{"startup", "initialization", "initialized", "file opened", "file changed", "file saved", "shutdown"} {
		if !strings.Contains(logText, `"event":"`+event+`"`) {
			t.Fatalf("expected log event %q in %s", event, logText)
		}
	}
}

func TestServerClosesDocuments(t *testing.T) {
	host := NewWorkspaceHost()
	server := NewServer(host, NewLogger(nil))
	input := bytes.Join([][]byte{
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params":  map[string]any{},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "textDocument/didOpen",
			"params": map[string]any{
				"textDocument": map[string]any{"uri": "file:///close.dcl", "languageId": "dcl", "version": 1, "text": "capability Close"},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"method":  "textDocument/didClose",
			"params":  map[string]any{"textDocument": map[string]any{"uri": "file:///close.dcl"}},
		}),
	}, nil)

	if err := server.Serve(bytes.NewReader(input), &bytes.Buffer{}); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}
	if host.Documents().Count() != 0 {
		t.Fatalf("expected no open documents, got %d", host.Documents().Count())
	}
}

func decodeResponses(t *testing.T, framed []byte) []map[string]any {
	t.Helper()
	var responses []map[string]any
	reader := bufio.NewReader(bytes.NewReader(framed))
	for {
		payload, err := readMessage(reader)
		if err != nil {
			break
		}
		var response map[string]any
		if err := json.Unmarshal(payload, &response); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		responses = append(responses, response)
	}
	return responses
}
