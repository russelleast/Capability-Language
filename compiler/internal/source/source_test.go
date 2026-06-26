package source

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPathsDiscoversDCLFilesInDirectories(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "a.dcl"), "language dcl 1.0\n")
	writeFile(t, filepath.Join(root, "nested", "b.dcl"), "language dcl 1.0\n")
	writeFile(t, filepath.Join(root, "nested", "ignore.txt"), "not dcl")

	sources, err := LoadPaths([]string{root})
	if err != nil {
		t.Fatalf("LoadPaths() error = %v", err)
	}
	if len(sources) != 2 {
		t.Fatalf("source count = %d, want 2: %#v", len(sources), sources)
	}
}

func TestLoadPathsSkipsGitAndNodeModules(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.dcl"), "language dcl 1.0\n")
	writeFile(t, filepath.Join(root, ".git", "ignored.dcl"), "language dcl 1.0\n")
	writeFile(t, filepath.Join(root, "node_modules", "ignored.dcl"), "language dcl 1.0\n")

	sources, err := LoadPaths([]string{root})
	if err != nil {
		t.Fatalf("LoadPaths() error = %v", err)
	}
	if len(sources) != 1 {
		t.Fatalf("source count = %d, want 1: %#v", len(sources), sources)
	}
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
