package lsp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefinitionProviderEventDefinition(t *testing.T) {
	source := `language dcl 1.0

event PaymentCaptured is {
  paymentId: Uuid required
}

capability CapturePayment {
  intent PaymentInput from Customer
  events {
    emits PaymentCaptured
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	location, ok := NewDefinitionProvider(host).Definition(uri, positionOf(t, source, "emits PaymentCaptured", "PaymentCaptured"))
	if !ok {
		t.Fatal("expected event definition")
	}
	assertLocation(t, location, uri, 2, 6)
}

func TestDefinitionProviderOutcomeDefinition(t *testing.T) {
	source := `language dcl 1.0

capability CapturePayment {
  intent PaymentInput from Customer
  outcome PaymentCaptured

  when {
    always PaymentCaptured
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	location, ok := NewDefinitionProvider(host).Definition(uri, positionOf(t, source, "always PaymentCaptured", "PaymentCaptured"))
	if !ok {
		t.Fatal("expected outcome definition")
	}
	assertLocation(t, location, uri, 4, 10)
}

func TestDefinitionProviderShapeDefinition(t *testing.T) {
	source := `language dcl 1.0

shape PaymentInput {
  paymentId: Uuid required
}

capability CapturePayment {
  intent PaymentInput from Customer
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	location, ok := NewDefinitionProvider(host).Definition(uri, positionOf(t, source, "intent PaymentInput", "PaymentInput"))
	if !ok {
		t.Fatal("expected shape definition")
	}
	assertLocation(t, location, uri, 2, 6)
}

func TestDefinitionProviderCrossFileDefinition(t *testing.T) {
	dir := t.TempDir()
	events := writeDefinitionFixture(t, dir, "events.dcl", `language dcl 1.0

event PaymentCaptured is {
  paymentId: Uuid required
}
`)
	capabilitySource := `language dcl 1.0

capability CapturePayment {
  intent PaymentInput from Customer
  events {
    emits PaymentCaptured
  }
}
`
	capability := writeDefinitionFixture(t, dir, "capability.dcl", capabilitySource)

	host := hostWithFolder(dir)
	location, ok := NewDefinitionProvider(host).Definition(pathToFileURI(capability), positionOf(t, capabilitySource, "emits PaymentCaptured", "PaymentCaptured"))
	if !ok {
		t.Fatal("expected cross-file event definition")
	}
	assertLocation(t, location, pathToFileURI(events), 2, 6)
}

func TestDefinitionProviderUnresolvedSymbol(t *testing.T) {
	source := `language dcl 1.0

capability CapturePayment {
  intent MissingInput from Customer
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	if location, ok := NewDefinitionProvider(host).Definition(uri, positionOf(t, source, "intent MissingInput", "MissingInput")); ok {
		t.Fatalf("expected unresolved symbol, got %+v", location)
	}
}

func TestDefinitionProviderDuplicateNamesInDifferentContexts(t *testing.T) {
	source := `language dcl 1.0

context Payments {
  shape PaymentInput {
    paymentId: Uuid required
  }

  capability CapturePayment {
    intent PaymentInput from Customer
  }
}

context Refunds {
  shape PaymentInput {
    refundId: Uuid required
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	location, ok := NewDefinitionProvider(host).Definition(uri, positionOf(t, source, "intent PaymentInput", "PaymentInput"))
	if !ok {
		t.Fatal("expected local context shape definition")
	}
	assertLocation(t, location, uri, 3, 8)
}

func writeDefinitionFixture(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	return path
}

func positionOf(t *testing.T, source, lineNeedle, token string) Position {
	t.Helper()
	lines := splitLines(source)
	for lineIndex, line := range lines {
		lineStart := indexOf(line, lineNeedle)
		if lineStart < 0 {
			continue
		}
		tokenStart := indexOf(line[lineStart:], token)
		if tokenStart < 0 {
			t.Fatalf("token %q not found in line %q", token, line)
		}
		return Position{Line: lineIndex, Character: lineStart + tokenStart}
	}
	t.Fatalf("line containing %q not found", lineNeedle)
	return Position{}
}

func splitLines(source string) []string {
	var lines []string
	start := 0
	for i, char := range source {
		if char != '\n' {
			continue
		}
		lines = append(lines, source[start:i])
		start = i + 1
	}
	if start <= len(source) {
		lines = append(lines, source[start:])
	}
	return lines
}

func indexOf(source, needle string) int {
	for i := 0; i+len(needle) <= len(source); i++ {
		if source[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}

func assertLocation(t *testing.T, actual Location, uri string, line, character int) {
	t.Helper()
	if actual.URI != uri {
		t.Fatalf("expected URI %s, got %s", uri, actual.URI)
	}
	assertPosition(t, actual.Range.Start, line, character)
}
