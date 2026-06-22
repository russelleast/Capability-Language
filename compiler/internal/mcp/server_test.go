package mcp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"testing"
)

func TestInitializeUsesSingleSupportedProtocolVersion(t *testing.T) {
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": ProtocolVersion,
			"capabilities":    map[string]any{},
			"clientInfo":      map[string]any{"name": "test", "version": "1.0"},
		},
	})

	response := decodeOneResponse(t, output)
	result := response["result"].(map[string]any)
	if result["protocolVersion"] != ProtocolVersion {
		t.Fatalf("protocolVersion = %v, want %s", result["protocolVersion"], ProtocolVersion)
	}
	capabilities := result["capabilities"].(map[string]any)
	if _, ok := capabilities["tools"]; !ok {
		t.Fatalf("initialize capabilities missing tools: %#v", capabilities)
	}
}

func TestToolsListExposesOnlyV1Tools(t *testing.T) {
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/list",
	})

	response := decodeOneResponse(t, output)
	result := response["result"].(map[string]any)
	tools := result["tools"].([]any)
	names := make([]string, 0, len(tools))
	for _, item := range tools {
		tool := item.(map[string]any)
		names = append(names, tool["name"].(string))
	}
	want := []string{"dcl_validate", "dcl_compile", "dcl_ir", "dcl_explain_diagnostics", "dcl_summary", "dcl_version"}
	if len(names) != len(want) {
		t.Fatalf("tool names = %#v, want %#v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("tool names = %#v, want %#v", names, want)
		}
	}
}

func TestUnknownToolReturnsInvalidParams(t *testing.T) {
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      "dcl_find_smells",
			"arguments": map[string]any{},
		},
	})

	response := decodeOneResponse(t, output)
	if response["error"] == nil {
		t.Fatalf("expected unknown tool error, got %#v", response)
	}
}

func TestSummaryToolReturnsCompilerDerivedSummary(t *testing.T) {
	source := `language dcl 1.0

actor User is human

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  when {
    always GreetingPrepared
  }
}`
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "dcl_summary",
			"arguments": map[string]any{
				"filename": "summary.dcl",
				"source":   source,
			},
		},
	})

	response := decodeOneResponse(t, output)
	result := response["result"].(map[string]any)
	structured := result["structuredContent"].(map[string]any)
	if structured["ok"] != true {
		t.Fatalf("ok = %v, want true: %#v", structured["ok"], structured)
	}
	content := result["content"].([]any)
	if len(content) == 0 || content[0].(map[string]any)["type"] != "text" {
		t.Fatalf("expected readable text content, got %#v", content)
	}
	summary := structured["summary"].(map[string]any)
	capabilities := summary["capabilities"].([]any)
	if len(capabilities) != 1 {
		t.Fatalf("capabilities = %#v, want one capability", capabilities)
	}
	capability := capabilities[0].(map[string]any)
	if capability["name"] != "SayHello" {
		t.Fatalf("capability name = %v, want SayHello", capability["name"])
	}
	intents := summary["intents"].([]any)
	if len(intents) != 1 {
		t.Fatalf("intents = %#v, want one intent", intents)
	}
	outcomes := summary["outcomes"].([]any)
	if len(outcomes) != 1 {
		t.Fatalf("outcomes = %#v, want one outcome", outcomes)
	}
	if structured["diagnosticsSummary"] == nil || summary["diagnosticsSummary"] == nil {
		t.Fatalf("expected diagnosticsSummary in root and summary: %#v", structured)
	}
}

func TestSummaryToolReturnsDiagnosticsForInvalidDCL(t *testing.T) {
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "dcl_summary",
			"arguments": map[string]any{
				"filename": "invalid-summary.dcl",
				"source":   "language dcl 99.0\nactor User is human\n",
			},
		},
	})

	response := decodeOneResponse(t, output)
	if response["error"] != nil {
		t.Fatalf("expected tool result with diagnostics, got protocol error: %#v", response["error"])
	}
	result := response["result"].(map[string]any)
	structured := result["structuredContent"].(map[string]any)
	if structured["ok"] != false {
		t.Fatalf("ok = %v, want false: %#v", structured["ok"], structured)
	}
	if structured["errorCount"].(float64) == 0 {
		t.Fatalf("expected compiler errors in summary result: %#v", structured)
	}
	diagnosticsSummary := structured["diagnosticsSummary"].(map[string]any)
	if diagnosticsSummary["errorCount"].(float64) == 0 {
		t.Fatalf("expected diagnosticsSummary error count: %#v", diagnosticsSummary)
	}
}

func TestValidateToolCallsCompilerValidation(t *testing.T) {
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "dcl_validate",
			"arguments": map[string]any{
				"filename": "invalid.dcl",
				"source":   "language dcl 99.0\nactor User is human\n",
			},
		},
	})

	response := decodeOneResponse(t, output)
	result := response["result"].(map[string]any)
	structured := result["structuredContent"].(map[string]any)
	if structured["valid"] != false {
		t.Fatalf("valid = %v, want false", structured["valid"])
	}
	if structured["errorCount"].(float64) == 0 {
		t.Fatalf("expected compiler error diagnostics, got %#v", structured)
	}
}

func TestIRToolReturnsCompilerIR(t *testing.T) {
	source := `language dcl 1.0

actor User is human

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  when {
    always GreetingPrepared
  }
}`
	output := serveMessages(t, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "dcl_ir",
			"arguments": map[string]any{
				"filename": "hello.dcl",
				"source":   source,
			},
		},
	})

	response := decodeOneResponse(t, output)
	result := response["result"].(map[string]any)
	structured := result["structuredContent"].(map[string]any)
	if structured["ok"] != true {
		t.Fatalf("ok = %v, want true: %#v", structured["ok"], structured)
	}
	if structured["ir"] == nil {
		t.Fatalf("expected IR in structured content: %#v", structured)
	}
}

func serveMessages(t *testing.T, messages ...any) []byte {
	t.Helper()
	var input bytes.Buffer
	for _, message := range messages {
		input.Write(EncodeMessage(message))
	}
	var output bytes.Buffer
	if err := NewServer().Serve(bytes.NewReader(input.Bytes()), &output); err != nil {
		t.Fatalf("Serve() error = %v", err)
	}
	return output.Bytes()
}

func decodeOneResponse(t *testing.T, framed []byte) map[string]any {
	t.Helper()
	payload, err := readMessage(bufio.NewReader(bytes.NewReader(framed)))
	if err != nil {
		t.Fatalf("readMessage() error = %v", err)
	}
	var response map[string]any
	if err := json.Unmarshal(payload, &response); err != nil {
		t.Fatalf("json.Unmarshal() error = %v", err)
	}
	return response
}
