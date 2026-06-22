package compiler

import "testing"

const semanticIndexMainPath = "/workspace/payment.dcl"
const semanticIndexEventsPath = "/workspace/events.dcl"

func TestSemanticSourceIndexDocumentSymbolsFromSingleFile(t *testing.T) {
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: semanticIndexSource()}})

	symbols := index.SymbolsForDocument(semanticIndexMainPath)
	assertSemanticEntry(t, symbols, "capability", "CapturePayment", SemanticSourceDeclaration)
	assertSemanticEntry(t, symbols, "intent", "PaymentInput", SemanticSourceDeclaration)
	assertSemanticEntry(t, symbols, "outcome", "PaymentCaptured", SemanticSourceDeclaration)
}

func TestSemanticSourceIndexWorkspaceSymbolsAcrossFiles(t *testing.T) {
	index := NewSemanticSourceIndex(semanticIndexCrossFileSources())

	symbols := index.SymbolsForWorkspace("payment")
	assertSemanticEntry(t, symbols, "capability", "CapturePayment", SemanticSourceDeclaration)
	assertSemanticEntry(t, symbols, "event", "PaymentCaptured", SemanticSourceDeclaration)
	assertSemanticEntry(t, symbols, "lifecycle", "PaymentLifecycle", SemanticSourceDeclaration)
}

func TestSemanticSourceIndexEntryAtPositionOnDeclarationName(t *testing.T) {
	source := semanticIndexSource()
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "capability CapturePayment", "CapturePayment")

	entry, ok := index.EntryAtPosition(semanticIndexMainPath, pos.line, pos.column)
	if !ok {
		t.Fatal("expected semantic entry at declaration")
	}
	if entry.Kind != "capability" || entry.Role != SemanticSourceDeclaration || entry.Name != "CapturePayment" {
		t.Fatalf("unexpected declaration entry: %+v", entry)
	}
}

func TestSemanticSourceIndexEntryAtPositionOnReferenceToken(t *testing.T) {
	source := semanticIndexSource()
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "emits PaymentRequested", "PaymentRequested")

	entry, ok := index.EntryAtPosition(semanticIndexMainPath, pos.line, pos.column)
	if !ok {
		t.Fatal("expected semantic entry at reference")
	}
	if entry.Kind != "event" || entry.Role != SemanticSourceReference || entry.TargetSemanticID == "" {
		t.Fatalf("unexpected reference entry: %+v", entry)
	}
}

func TestSemanticSourceIndexDefinitionForEventReference(t *testing.T) {
	source := semanticIndexSource()
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "emits PaymentRequested", "PaymentRequested")

	definition, ok := index.DefinitionForPosition(semanticIndexMainPath, pos.line, pos.column)
	if !ok {
		t.Fatal("expected event definition")
	}
	if definition.Kind != "event" || definition.Name != "PaymentRequested" || definition.Role != SemanticSourceDeclaration {
		t.Fatalf("unexpected definition: %+v", definition)
	}
}

func TestSemanticSourceIndexDefinitionForShapeReference(t *testing.T) {
	source := semanticIndexSource()
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "intent PaymentInput", "PaymentInput")

	definition, ok := index.DefinitionForPosition(semanticIndexMainPath, pos.line, pos.column)
	if !ok {
		t.Fatal("expected shape definition")
	}
	if definition.Kind != "shape" || definition.Name != "PaymentInput" {
		t.Fatalf("unexpected definition: %+v", definition)
	}
}

func TestSemanticSourceIndexReferencesForEventDeclaration(t *testing.T) {
	source := semanticIndexSource()
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "event PaymentRequested is", "PaymentRequested")

	refs := index.ReferencesForPosition(semanticIndexMainPath, pos.line, pos.column, true)
	if len(refs) != 2 {
		t.Fatalf("expected declaration and one reference, got %+v", refs)
	}
	if refs[0].Role != SemanticSourceDeclaration || refs[1].Role != SemanticSourceReference {
		t.Fatalf("unexpected references: %+v", refs)
	}
}

func TestSemanticSourceIndexCrossFileReferenceResolution(t *testing.T) {
	sources := semanticIndexCrossFileSources()
	index := NewSemanticSourceIndex(sources)
	pos := semanticPositionOf(t, sources[1].Text, "emits PaymentCaptured", "PaymentCaptured")

	definition, ok := index.DefinitionForPosition(sources[1].Path, pos.line, pos.column)
	if !ok {
		t.Fatal("expected cross-file definition")
	}
	if definition.File != semanticIndexEventsPath || definition.Name != "PaymentCaptured" {
		t.Fatalf("unexpected cross-file definition: %+v", definition)
	}
}

func TestSemanticSourceIndexDuplicateNamesInDifferentContexts(t *testing.T) {
	source := `language dcl 0.10

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
  capability RefundPayment {
    intent PaymentInput from Customer
  }
}
`
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	pos := semanticPositionOf(t, source, "intent PaymentInput from Customer", "PaymentInput")

	definition, ok := index.DefinitionForPosition(semanticIndexMainPath, pos.line, pos.column)
	if !ok {
		t.Fatal("expected context-specific definition")
	}
	if definition.ContainerContext != "Payments" {
		t.Fatalf("expected Payments definition, got %+v", definition)
	}
}

func TestSemanticSourceIndexEmpty(t *testing.T) {
	index := NewSemanticSourceIndex(nil)
	if len(index.SymbolsForWorkspace("")) != 0 {
		t.Fatal("expected empty workspace symbols")
	}
	if _, ok := index.EntryAtPosition("/missing.dcl", 1, 1); ok {
		t.Fatal("expected no entry in empty index")
	}
}

func TestSemanticSourceIndexUnsupportedReferenceKindReason(t *testing.T) {
	source := `language dcl 0.10

shape PaymentInput {
  paymentId: Uuid required
}

capability CapturePayment {
  intent PaymentInput from Customer
  rule PaymentReady: input.paymentId is present
}
`
	index := NewSemanticSourceIndex([]SourceFile{{Path: semanticIndexMainPath, Text: source}})
	reasons := index.UnsupportedReasons()
	if len(reasons) == 0 {
		t.Fatal("expected unsupported reference reason")
	}
}

func semanticIndexSource() string {
	return `language dcl 0.10

shape PaymentInput {
  paymentId: Uuid required
}

event PaymentRequested is PaymentInput

capability CapturePayment {
  intent PaymentInput from Customer
  outcome PaymentCaptured
  events {
    emits PaymentRequested
  }
  supervises lifecycle PaymentLifecycle {
    begin Pending
    step Pending
    end Captured
    move Pending to Captured
      on outcome PaymentCaptured
  }
}
`
}

func semanticIndexCrossFileSources() []SourceFile {
	eventSource := `language dcl 0.10

event PaymentCaptured is {
  paymentId: Uuid required
}
`
	capabilitySource := `language dcl 0.10

shape PaymentInput {
  paymentId: Uuid required
}

capability CapturePayment {
  intent PaymentInput from Customer
  events {
    emits PaymentCaptured
  }
  supervises lifecycle PaymentLifecycle {
    begin Pending
    step Pending
    end Captured
  }
}
`
	return []SourceFile{
		{Path: semanticIndexEventsPath, Text: eventSource},
		{Path: semanticIndexMainPath, Text: capabilitySource},
	}
}

type semanticSourcePosition struct {
	line   int
	column int
}

func semanticPositionOf(t *testing.T, source, lineNeedle, token string) semanticSourcePosition {
	t.Helper()
	lines := stringsSplitLines(source)
	for lineIndex, line := range lines {
		lineStart := stringsIndex(line, lineNeedle)
		if lineStart < 0 {
			continue
		}
		tokenStart := stringsIndex(line[lineStart:], token)
		if tokenStart < 0 {
			t.Fatalf("token %q not found in line %q", token, line)
		}
		return semanticSourcePosition{line: lineIndex + 1, column: lineStart + tokenStart + 1}
	}
	t.Fatalf("line containing %q not found", lineNeedle)
	return semanticSourcePosition{}
}

func assertSemanticEntry(t *testing.T, entries []SemanticSourceEntry, kind, name string, role SemanticSourceRole) SemanticSourceEntry {
	t.Helper()
	for _, entry := range entries {
		if entry.Kind == kind && entry.Name == name && entry.Role == role {
			return entry
		}
	}
	t.Fatalf("expected %s %s %s in %+v", role, kind, name, entries)
	return SemanticSourceEntry{}
}

func stringsSplitLines(source string) []string {
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

func stringsIndex(source, needle string) int {
	for i := 0; i+len(needle) <= len(source); i++ {
		if source[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
