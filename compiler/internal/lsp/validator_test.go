package lsp

import (
	"sync"
	"testing"
	"time"
)

func TestWorkspaceValidatorPublishesAndClearsDiagnostics(t *testing.T) {
	host := NewWorkspaceHost()
	uri := "file:///workspace/broken.dcl"
	host.Documents().Open(uri, 1, "not a declaration")
	published := newPublishedDiagnostics()
	validator := NewWorkspaceValidator(host, NewDiagnosticPublisher(published.send), NewLogger(nil))

	validator.Validate()

	if count := len(published.latest(uri)); count == 0 {
		t.Fatal("expected diagnostics for invalid source")
	}
	if result := validator.LastResult(); result.DiagnosticsCount == 0 || result.LastValidationTimestamp.IsZero() {
		t.Fatalf("expected validation result to include count and timestamp, got %+v", result)
	}

	host.Documents().Save(uri, ptr("language dcl 0.10\n"))
	validator.Validate()

	if count := len(published.latest(uri)); count != 0 {
		t.Fatalf("expected diagnostics to clear after fix, got %d", count)
	}
}

func TestWorkspaceValidatorDebouncesValidation(t *testing.T) {
	host := NewWorkspaceHost()
	uri := "file:///workspace/debounce.dcl"
	host.Documents().Open(uri, 1, "language dcl 0.10\n")
	published := newPublishedDiagnostics()
	validator := NewWorkspaceValidator(host, NewDiagnosticPublisher(published.send), NewLogger(nil))

	host.Documents().Change(uri, 2, "not valid")
	validator.ValidateSoon()
	if published.count() != 0 {
		t.Fatal("expected debounced validation not to run immediately")
	}

	time.Sleep(validationDebounce + 100*time.Millisecond)
	if published.count() == 0 {
		t.Fatal("expected debounced validation to publish diagnostics")
	}
}

type publishedDiagnostics struct {
	mu      sync.Mutex
	byURI   map[string][]LSPDiagnostic
	updates int
}

func newPublishedDiagnostics() *publishedDiagnostics {
	return &publishedDiagnostics{byURI: map[string][]LSPDiagnostic{}}
}

func (p *publishedDiagnostics) send(method string, params any) error {
	if method != "textDocument/publishDiagnostics" {
		return nil
	}
	message := params.(publishDiagnosticsParams)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.byURI[message.URI] = message.Diagnostics
	p.updates++
	return nil
}

func (p *publishedDiagnostics) latest(uri string) []LSPDiagnostic {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]LSPDiagnostic(nil), p.byURI[uri]...)
}

func (p *publishedDiagnostics) count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.updates
}

func ptr(value string) *string {
	return &value
}
