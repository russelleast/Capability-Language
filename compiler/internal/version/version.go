package version

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// embeddedJSON is populated by release build scripts from the repository root version.json.
var embeddedJSON string

var (
	currentOnce sync.Once
	current     Metadata
	currentErr  error
)

type Metadata struct {
	Language ComponentMetadata `json:"language"`
	Compiler CompilerMetadata  `json:"compiler"`
	MCP      ComponentMetadata `json:"mcp"`
	VSCode   VSCodeMetadata    `json:"vscode"`
}

type ComponentMetadata struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type CompilerMetadata struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Supports string `json:"supports"`
}

type VSCodeMetadata struct {
	Name     string `json:"name"`
	Version  string `json:"version"`
	Supports string `json:"supports"`
	Compiler string `json:"compiler"`
}

func Current() (Metadata, error) {
	currentOnce.Do(func() {
		current, currentErr = Load()
	})
	return current, currentErr
}

func Load() (Metadata, error) {
	if embeddedJSON != "" {
		return parse([]byte(embeddedJSON), "embedded version metadata")
	}
	path, err := FindFile()
	if err != nil {
		return Metadata{}, err
	}
	return LoadFile(path)
}

func LoadFile(path string) (Metadata, error) {
	payload, err := os.ReadFile(path)
	if err != nil {
		return Metadata{}, err
	}
	return parse(payload, path)
}

func FindFile() (string, error) {
	var roots []string
	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots, cwd)
	}
	if exe, err := os.Executable(); err == nil {
		roots = append(roots, filepath.Dir(exe))
	}
	for _, root := range roots {
		if path, ok := findUp(root, "version.json"); ok {
			return path, nil
		}
	}
	return "", errors.New("version.json not found")
}

func Summary() string {
	metadata, err := Current()
	if err != nil {
		return "dcl compiler unknown (DCL language unknown)"
	}
	return fmt.Sprintf("%s compiler %s (DCL language %s)", metadata.Compiler.Name, metadata.Compiler.Version, metadata.Language.Version)
}

func LanguageName() string {
	metadata, err := Current()
	if err != nil {
		return ""
	}
	return metadata.Language.Name
}

func LanguageVersion() string {
	metadata, err := Current()
	if err != nil {
		return ""
	}
	return metadata.Language.Version
}

func CompilerVersion() string {
	metadata, err := Current()
	if err != nil {
		return ""
	}
	return metadata.Compiler.Version
}

func findUp(root, name string) (string, bool) {
	current, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	for {
		candidate := filepath.Join(current, name)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, true
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", false
		}
		current = parent
	}
}

func parse(payload []byte, source string) (Metadata, error) {
	var metadata Metadata
	if err := json.Unmarshal(payload, &metadata); err != nil {
		return Metadata{}, fmt.Errorf("%s is not valid version metadata: %w", source, err)
	}
	if metadata.Language.Name == "" || metadata.Language.Version == "" {
		return Metadata{}, fmt.Errorf("%s is missing language metadata", source)
	}
	if metadata.Compiler.Name == "" || metadata.Compiler.Version == "" || metadata.Compiler.Supports == "" {
		return Metadata{}, fmt.Errorf("%s is missing compiler metadata", source)
	}
	if metadata.MCP.Name == "" || metadata.MCP.Version == "" {
		return Metadata{}, fmt.Errorf("%s is missing MCP metadata", source)
	}
	return metadata, nil
}
