package lsp

import "testing"

func TestCompletionsAreLanguageVersionAware(t *testing.T) {
	for _, test := range []struct {
		version     string
		wantInteger bool
	}{{"1.0", false}, {"1.1", true}} {
		items := completionsForText("language dcl " + test.version)
		found := false
		for _, item := range items {
			found = found || item.Label == "Integer"
		}
		if found != test.wantInteger {
			t.Fatalf("Integer completion for %s = %v, want %v", test.version, found, test.wantInteger)
		}
	}
}

func TestHoverExplainsUnavailableLanguage11Feature(t *testing.T) {
	result := hoverForText("language dcl 1.0\nshape Value { value: Integer }", "Integer")
	if result == nil || result.Contents.Value == "" || result.Contents.Value == "Signed integral built-in type, distinct from Number. Since DCL 1.1." {
		t.Fatalf("expected version-aware hover, got %#v", result)
	}
}

