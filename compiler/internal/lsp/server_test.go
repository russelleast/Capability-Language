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
	capabilities := responses[0]["result"].(map[string]any)["capabilities"].(map[string]any)
	if capabilities["documentSymbolProvider"] != true {
		t.Fatalf("expected documentSymbolProvider capability, got %+v", capabilities)
	}
	if capabilities["workspaceSymbolProvider"] != true {
		t.Fatalf("expected workspaceSymbolProvider capability, got %+v", capabilities)
	}
	if capabilities["definitionProvider"] != true {
		t.Fatalf("expected definitionProvider capability, got %+v", capabilities)
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

func TestServerHandlesDocumentSymbolRequest(t *testing.T) {
	host := NewWorkspaceHost()
	var logs bytes.Buffer
	server := NewServer(host, NewLogger(&logs))
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
				"textDocument": map[string]any{
					"uri":        "file:///workspace/order.dcl",
					"languageId": "dcl",
					"version":    1,
					"text": `language dcl 0.9

capability PlaceOrder {
  intent OrderInput from Customer
  outcome OrderAccepted
}
`,
				},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "textDocument/documentSymbol",
			"params":  map[string]any{"textDocument": map[string]any{"uri": "file:///workspace/order.dcl"}},
		}),
	}, nil)
	var output bytes.Buffer

	if err := server.Serve(bytes.NewReader(input), &output); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	responses := decodeResponses(t, output.Bytes())
	if len(responses) != 2 {
		t.Fatalf("expected initialize and document symbol responses, got %d", len(responses))
	}
	var symbols []DocumentSymbol
	payload, _ := json.Marshal(responses[1]["result"])
	if err := json.Unmarshal(payload, &symbols); err != nil {
		t.Fatalf("decode document symbols: %v", err)
	}
	capability := findSymbol(t, symbols, "PlaceOrder")
	_ = findSymbol(t, capability.Children, "OrderInput")
	_ = findSymbol(t, capability.Children, "OrderAccepted")

	if !strings.Contains(logs.String(), `"event":"document symbols requested"`) {
		t.Fatalf("expected document symbols log event in %s", logs.String())
	}
}

func TestServerHandlesWorkspaceSymbolRequest(t *testing.T) {
	host := NewWorkspaceHost()
	var logs bytes.Buffer
	server := NewServer(host, NewLogger(&logs))
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
				"textDocument": map[string]any{
					"uri":        "file:///workspace/payment.dcl",
					"languageId": "dcl",
					"version":    1,
					"text": `language dcl 0.9

capability CapturePayment {
  intent PaymentInput from Customer
  outcome PaymentCaptured
}
`,
				},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "workspace/symbol",
			"params":  map[string]any{"query": "payment"},
		}),
	}, nil)
	var output bytes.Buffer

	if err := server.Serve(bytes.NewReader(input), &output); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	responses := decodeResponses(t, output.Bytes())
	if len(responses) != 2 {
		t.Fatalf("expected initialize and workspace symbol responses, got %d", len(responses))
	}
	var symbols []WorkspaceSymbol
	payload, _ := json.Marshal(responses[1]["result"])
	if err := json.Unmarshal(payload, &symbols); err != nil {
		t.Fatalf("decode workspace symbols: %v", err)
	}
	_ = findWorkspaceSymbol(t, symbols, "CapturePayment", "Capability")
	_ = findWorkspaceSymbol(t, symbols, "PaymentInput", "Intent")

	logText := logs.String()
	if !strings.Contains(logText, `"event":"workspace symbols requested"`) ||
		!strings.Contains(logText, `"query":"payment"`) ||
		!strings.Contains(logText, `"symbolCount":`) {
		t.Fatalf("expected workspace symbol log fields in %s", logText)
	}
}

func TestServerHandlesDefinitionRequest(t *testing.T) {
	source := `language dcl 0.9

shape PaymentInput {
  paymentId: Uuid required
}

capability CapturePayment {
  intent PaymentInput from Customer
}
`
	host := NewWorkspaceHost()
	var logs bytes.Buffer
	server := NewServer(host, NewLogger(&logs))
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
				"textDocument": map[string]any{
					"uri":        "file:///workspace/payment.dcl",
					"languageId": "dcl",
					"version":    1,
					"text":       source,
				},
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "textDocument/definition",
			"params": map[string]any{
				"textDocument": map[string]any{"uri": "file:///workspace/payment.dcl"},
				"position":     positionOf(t, source, "intent PaymentInput", "PaymentInput"),
			},
		}),
		EncodeMessage(map[string]any{
			"jsonrpc": "2.0",
			"id":      3,
			"method":  "textDocument/definition",
			"params": map[string]any{
				"textDocument": map[string]any{"uri": "file:///workspace/payment.dcl"},
				"position":     Position{Line: 7, Character: 22},
			},
		}),
	}, nil)
	var output bytes.Buffer

	if err := server.Serve(bytes.NewReader(input), &output); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	responses := decodeResponses(t, output.Bytes())
	if len(responses) != 3 {
		t.Fatalf("expected initialize and definition responses, got %d", len(responses))
	}
	var location Location
	payload, _ := json.Marshal(responses[1]["result"])
	if err := json.Unmarshal(payload, &location); err != nil {
		t.Fatalf("decode definition location: %v", err)
	}
	assertLocation(t, location, "file:///workspace/payment.dcl", 2, 0)
	if responses[2]["result"] != nil {
		t.Fatalf("expected unresolved definition result to be null, got %+v", responses[2]["result"])
	}

	logText := logs.String()
	for _, event := range []string{"definition requested", "symbol resolved", "symbol unresolved"} {
		if !strings.Contains(logText, `"event":"`+event+`"`) {
			t.Fatalf("expected log event %q in %s", event, logText)
		}
	}
}

func TestServerPublishesDiagnosticsForOpenedDocuments(t *testing.T) {
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
				"textDocument": map[string]any{"uri": "file:///diagnostic.dcl", "languageId": "dcl", "version": 1, "text": "not valid"},
			},
		}),
	}, nil)
	var output bytes.Buffer

	if err := server.Serve(bytes.NewReader(input), &output); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	publishes := decodePublishDiagnosticsMessages(t, output.Bytes())
	if len(publishes) != 1 {
		t.Fatalf("expected one publishDiagnostics notification, got %d in %q", len(publishes), output.String())
	}
	if publishes[0].URI != "file:///diagnostic.dcl" {
		t.Fatalf("unexpected diagnostics uri: %s", publishes[0].URI)
	}
	if len(publishes[0].Diagnostics) == 0 {
		t.Fatal("expected at least one diagnostic")
	}
	if host.Health().DiagnosticsCount == 0 || host.Health().LastValidationTimestamp == "" {
		t.Fatalf("expected host health to include validation status, got %+v", host.Health())
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
		if _, ok := response["id"]; ok {
			responses = append(responses, response)
		}
	}
	return responses
}

func decodePublishDiagnosticsMessages(t *testing.T, framed []byte) []publishDiagnosticsParams {
	t.Helper()
	var publishes []publishDiagnosticsParams
	reader := bufio.NewReader(bytes.NewReader(framed))
	for {
		payload, err := readMessage(reader)
		if err != nil {
			break
		}
		if params, ok := DecodePublishDiagnostics(payload); ok {
			publishes = append(publishes, params)
		}
	}
	return publishes
}
