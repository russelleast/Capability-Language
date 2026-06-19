package lsp

import (
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"capabilitylanguage/internal/compiler"
)

const validationDebounce = 500 * time.Millisecond

type WorkspaceValidator struct {
	host      *WorkspaceHost
	publisher *DiagnosticPublisher
	logger    *Logger

	mu          sync.Mutex
	timer       *time.Timer
	running     bool
	pending     bool
	lastResult  ValidationResult
	diagnostics map[string][]LSPDiagnostic
}

type ValidationResult struct {
	DiagnosticsCount        int
	LastValidationTimestamp time.Time
}

func NewWorkspaceValidator(host *WorkspaceHost, publisher *DiagnosticPublisher, logger *Logger) *WorkspaceValidator {
	return &WorkspaceValidator{
		host:        host,
		publisher:   publisher,
		logger:      logger,
		diagnostics: map[string][]LSPDiagnostic{},
	}
}

func (v *WorkspaceValidator) ValidateSoon() {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.timer != nil {
		v.timer.Stop()
	}
	v.timer = time.AfterFunc(validationDebounce, v.Validate)
}

func (v *WorkspaceValidator) Validate() {
	v.mu.Lock()
	if v.running {
		v.pending = true
		v.mu.Unlock()
		return
	}
	v.running = true
	v.mu.Unlock()

	result := v.runValidation()

	v.mu.Lock()
	v.lastResult = result
	v.running = false
	pending := v.pending
	v.pending = false
	v.mu.Unlock()
	v.host.SetValidationResult(result)

	if pending {
		go v.Validate()
	}
}

func (v *WorkspaceValidator) LastResult() ValidationResult {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.lastResult
}

func (v *WorkspaceValidator) runValidation() ValidationResult {
	v.logger.Event("validating workspace", map[string]any{"openDocumentCount": v.host.Documents().Count(), "workspaceCount": v.host.WorkspaceCount()})
	sources, pathToURI := WorkspaceSources(v.host)
	result := compiler.CompileSources(sources)
	grouped := DiagnosticsByURI(result.Diagnostics, pathToURI)

	knownURIs := map[string]bool{}
	for _, uri := range pathToURI {
		knownURIs[uri] = true
	}
	for uri := range v.diagnostics {
		knownURIs[uri] = true
	}
	for uri := range knownURIs {
		diagnostics := grouped[uri]
		_ = v.publisher.Publish(uri, diagnostics)
	}

	v.diagnostics = grouped
	validation := ValidationResult{
		DiagnosticsCount:        len(result.Diagnostics),
		LastValidationTimestamp: time.Now().UTC(),
	}
	v.logger.Event("validation completed", map[string]any{
		"diagnosticsCount": validation.DiagnosticsCount,
		"sourceCount":      len(sources),
	})
	_ = v.publisher.PublishValidationStatus(validation)
	return validation
}

func WorkspaceSources(host *WorkspaceHost) ([]compiler.SourceFile, map[string]string) {
	byPath := map[string]compiler.SourceFile{}
	pathToURI := map[string]string{}

	for _, folder := range host.WorkspaceFolders() {
		root, ok := fileURIToPath(folder.URI)
		if !ok {
			continue
		}
		_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil || entry.IsDir() {
				if entry != nil && (entry.Name() == ".git" || entry.Name() == "node_modules") {
					return filepath.SkipDir
				}
				return nil
			}
			if filepath.Ext(path) != ".dcl" {
				return nil
			}
			text, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			absolute, _ := filepath.Abs(path)
			uri := pathToFileURI(absolute)
			byPath[absolute] = compiler.SourceFile{Path: absolute, Text: string(text)}
			pathToURI[absolute] = uri
			return nil
		})
	}

	for _, document := range host.Documents().Snapshot() {
		path, ok := fileURIToPath(document.URI)
		if !ok {
			continue
		}
		absolute, _ := filepath.Abs(path)
		byPath[absolute] = compiler.SourceFile{Path: absolute, Text: document.Text}
		pathToURI[absolute] = document.URI
	}

	sources := make([]compiler.SourceFile, 0, len(byPath))
	for _, source := range byPath {
		sources = append(sources, source)
	}
	return sources, pathToURI
}

func fileURIToPath(uri string) (string, bool) {
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme != "file" {
		return "", false
	}
	path := parsed.Path
	if path == "" {
		return "", false
	}
	return filepath.FromSlash(path), true
}

func pathToFileURI(path string) string {
	return (&url.URL{Scheme: "file", Path: filepath.ToSlash(path)}).String()
}
