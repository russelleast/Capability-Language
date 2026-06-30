package version

import (
	"path/filepath"
	"sync"
	"testing"
)

func TestLoadFileReadsRootVersionMetadata(t *testing.T) {
	path := filepath.Join("..", "..", "..", "version.json")
	metadata, err := LoadFile(path)
	if err != nil {
		t.Fatalf("LoadFile() error = %v", err)
	}
	if metadata.Language.Name != "dcl" {
		t.Fatalf("language name = %q, want dcl", metadata.Language.Name)
	}
	if metadata.Language.Version == "" || metadata.Compiler.Version == "" {
		t.Fatalf("metadata versions should be populated: %+v", metadata)
	}
}

func TestCurrentUsesEmbeddedMetadataWhenProvided(t *testing.T) {
	resetCurrentForTest(`{
		"language": {"name": "dcl", "version": "9.8"},
		"compiler": {"name": "dcl", "version": "7.6", "supports": "9.8"},
		"mcp": {"name": "dcl-mcp", "version": "0.1.0"},
		"vscode": {"name": "dcl-vscode-extension", "version": "5.4", "supports": "9.8", "compiler": "7.6"}
	}`)
	defer resetCurrentForTest("")

	metadata, err := Current()
	if err != nil {
		t.Fatalf("Current() error = %v", err)
	}
	if metadata.Language.Version != "9.8" || metadata.Compiler.Version != "7.6" {
		t.Fatalf("Current() = %+v, want embedded metadata", metadata)
	}
	if Summary() != "dcl compiler 7.6 (DCL language 9.8)" {
		t.Fatalf("Summary() = %q", Summary())
	}
}

func resetCurrentForTest(payload string) {
	embeddedJSON = payload
	current = Metadata{}
	currentErr = nil
	currentOnce = sync.Once{}
}
