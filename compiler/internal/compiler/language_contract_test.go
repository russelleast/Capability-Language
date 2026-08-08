package compiler

import (
	"strings"
	"testing"
)

func TestCompilerSupportsLanguage10And11(t *testing.T) {
	for _, languageVersion := range []string{"1.0", "1.1"} {
		t.Run(languageVersion, func(t *testing.T) {
			result := CompileSource("compatible.dcl", `language dcl `+languageVersion+`
shape Name { value: Text required }
`)
			if HasErrors(result.Diagnostics) {
				t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
			}
			if result.IR.Version.Language != languageVersion {
				t.Fatalf("IR language = %q, want %q", result.IR.Version.Language, languageVersion)
			}
		})
	}
}

func TestLanguage11FeaturesCompileUnderLanguage11(t *testing.T) {
	result := CompileSource("types.dcl", `language dcl 1.1
measure Quantity
shape Failure { Reason: Text required }
shape Result enum {
  Count is Integer
  Problem is Failure
  Failed is List<Failure>
}
shape Input { quantity: Integer<Quantity> min 1 max 10 default 2 }
`)
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
}

func TestLanguage11FeaturesAreRejectedUnderLanguage10(t *testing.T) {
	tests := map[string]string{
		"Integer":    "shape Value { value: Integer }",
		"measure":    "measure Quantity\nshape Value { value: Number<Quantity> }",
		"constraint": "shape Value { value: Number min 0 }",
		"enum":       "shape Result enum {\n  Failed is Text\n}",
	}
	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			result := CompileSource("legacy.dcl", "language dcl 1.0\n"+body)
			assertDiagnostic(t, result.Diagnostics, "DCL_VERSION_FEATURE_UNAVAILABLE")
		})
	}
}

func TestUnsupportedOldAndFutureLanguageVersionsAreRejected(t *testing.T) {
	for _, languageVersion := range []string{"0.9", "1.2"} {
		t.Run(languageVersion, func(t *testing.T) {
			result := CompileSource("unsupported.dcl", "language dcl "+languageVersion+"\nshape Value { value: Text }")
			assertDiagnostic(t, result.Diagnostics, "DCL_VERSION_UNSUPPORTED")
			if !strings.Contains(result.Diagnostics[0].Message, "DCL Compiler 1.1.0") || !strings.Contains(result.Diagnostics[0].Message, "1.0, 1.1") {
				t.Fatalf("diagnostic should identify compiler and supported versions: %#v", result.Diagnostics)
			}
		})
	}
}

func TestMixedLanguageVersionsAreRejected(t *testing.T) {
	result := CompileSources([]SourceFile{
		{Path: "one.dcl", Text: "language dcl 1.0\nshape One { value: Text }"},
		{Path: "two.dcl", Text: "language dcl 1.1\nshape Two { value: Text }"},
	})
	assertDiagnostic(t, result.Diagnostics, "DCL_VERSION_MIXED")
}
