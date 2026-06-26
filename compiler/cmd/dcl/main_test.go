package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateJSONOutput(t *testing.T) {
	path := writeDCLFixture(t)
	code, stdout, stderr := runCommand("validate", path, "--json")
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	var out map[string]any
	decodeJSON(t, stdout, &out)
	if out["ok"] != true || out["sourceCount"].(float64) != 1 || out["diagnosticCount"].(float64) != 0 {
		t.Fatalf("unexpected validate output: %#v", out)
	}
}

func TestSummaryJSONOutput(t *testing.T) {
	path := writeDCLFixture(t)
	code, stdout, stderr := runCommand("summary", path, "--json")
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	var out map[string]any
	decodeJSON(t, stdout, &out)
	summary := out["summary"].(map[string]any)
	capabilities := summary["capabilities"].([]any)
	if len(capabilities) != 1 || capabilities[0].(map[string]any)["name"] != "SayHello" {
		t.Fatalf("unexpected summary output: %#v", out)
	}
}

func TestIRJSONOutput(t *testing.T) {
	path := writeDCLFixture(t)
	code, stdout, stderr := runCommand("ir", path, "--json")
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	var out map[string]any
	decodeJSON(t, stdout, &out)
	if out["ir"] == nil || out["ok"] != true {
		t.Fatalf("unexpected IR output: %#v", out)
	}
}

func TestVersionJSONReadsVersionMetadata(t *testing.T) {
	code, stdout, stderr := runCommand("version", "--json")
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	var out map[string]any
	decodeJSON(t, stdout, &out)
	version := out["version"].(map[string]any)
	compiler := version["compiler"].(map[string]any)
	if compiler["version"] == "" {
		t.Fatalf("expected compiler version metadata: %#v", out)
	}
}

func TestCheckCompatibilityAlias(t *testing.T) {
	path := writeDCLFixture(t)
	code, stdout, stderr := runCommand("check", path)
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	if !strings.Contains(stdout, "ok (DCL language") {
		t.Fatalf("unexpected check output: %q", stdout)
	}
}

func TestValidateDirectoryJSONOutput(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "one.dcl"), validDCL())
	writeFile(t, filepath.Join(root, "nested", "two.dcl"), "language dcl 1.0\nactor Admin is human\n")
	code, stdout, stderr := runCommand("validate", root, "--json")
	if code != 0 {
		t.Fatalf("exit code = %d, stderr = %s", code, stderr)
	}
	var out map[string]any
	decodeJSON(t, stdout, &out)
	if out["sourceCount"].(float64) != 2 {
		t.Fatalf("sourceCount = %v, want 2: %#v", out["sourceCount"], out)
	}
}

func runCommand(args ...string) (int, string, string) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := run(args, &stdout, &stderr)
	return code, stdout.String(), stderr.String()
}

func writeDCLFixture(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "hello.dcl")
	writeFile(t, path, validDCL())
	return path
}

func writeFile(t *testing.T, path, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(path, []byte(text), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}

func decodeJSON(t *testing.T, text string, out any) {
	t.Helper()
	if err := json.Unmarshal([]byte(text), out); err != nil {
		t.Fatalf("json.Unmarshal(%q) error = %v", text, err)
	}
}

func validDCL() string {
	return `language dcl 1.0

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
}
