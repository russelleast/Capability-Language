package lsp

import (
	"testing"

	"capabilitylanguage/internal/diagnostic"
)

func TestDiagnosticConversionUsesLSPRangesAndSeverity(t *testing.T) {
	item := diagnostic.Diagnostic{
		Code:     "DCL_TEST",
		Severity: diagnostic.Warning,
		Message:  "test warning",
		Span:     diagnostic.Span{File: "/workspace/test.dcl", Line: 3, Column: 5},
	}

	converted := ToLSPDiagnostic(item)

	if converted.Severity != 2 {
		t.Fatalf("expected warning severity 2, got %d", converted.Severity)
	}
	if converted.Range.Start.Line != 2 || converted.Range.Start.Character != 4 {
		t.Fatalf("unexpected start range: %+v", converted.Range.Start)
	}
	if converted.Range.End.Line != 2 || converted.Range.End.Character != 5 {
		t.Fatalf("unexpected end range: %+v", converted.Range.End)
	}
	if converted.Code != "DCL_TEST" || converted.Source != "dcl" || converted.Message != "test warning" {
		t.Fatalf("unexpected diagnostic metadata: %+v", converted)
	}
}
