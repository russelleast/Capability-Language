package lsp

import (
	"sync"
	"time"
)

type LifecycleState string

const (
	LifecycleCreated     LifecycleState = "created"
	LifecycleInitialized LifecycleState = "initialized"
	LifecycleShutdown    LifecycleState = "shutdown"
)

type WorkspaceFolder struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}

type Health struct {
	Running                 bool           `json:"running"`
	Lifecycle               LifecycleState `json:"lifecycle"`
	WorkspaceCount          int            `json:"workspaceCount"`
	OpenDocumentCount       int            `json:"openDocumentCount"`
	DiagnosticsCount        int            `json:"diagnosticsCount"`
	LastValidationTimestamp string         `json:"lastValidationTimestamp,omitempty"`
}

type WorkspaceHost struct {
	mu                      sync.RWMutex
	documents               *DocumentStore
	folders                 []WorkspaceFolder
	lifecycle               LifecycleState
	diagnosticsCount        int
	lastValidationTimestamp string
}

func NewWorkspaceHost() *WorkspaceHost {
	return &WorkspaceHost{
		documents: NewDocumentStore(),
		lifecycle: LifecycleCreated,
	}
}

func (h *WorkspaceHost) Documents() *DocumentStore {
	return h.documents
}

func (h *WorkspaceHost) SetWorkspaceFolders(folders []WorkspaceFolder) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.folders = append([]WorkspaceFolder(nil), folders...)
}

func (h *WorkspaceHost) WorkspaceFolders() []WorkspaceFolder {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return append([]WorkspaceFolder(nil), h.folders...)
}

func (h *WorkspaceHost) WorkspaceCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.folders)
}

func (h *WorkspaceHost) MarkInitialized() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lifecycle = LifecycleInitialized
}

func (h *WorkspaceHost) MarkShutdown() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.lifecycle = LifecycleShutdown
}

func (h *WorkspaceHost) Lifecycle() LifecycleState {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.lifecycle
}

func (h *WorkspaceHost) SetValidationResult(result ValidationResult) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.diagnosticsCount = result.DiagnosticsCount
	if !result.LastValidationTimestamp.IsZero() {
		h.lastValidationTimestamp = result.LastValidationTimestamp.Format(time.RFC3339Nano)
	}
}

func (h *WorkspaceHost) Health() Health {
	state := h.Lifecycle()
	h.mu.RLock()
	diagnosticsCount := h.diagnosticsCount
	lastValidationTimestamp := h.lastValidationTimestamp
	h.mu.RUnlock()
	return Health{
		Running:                 state != LifecycleShutdown,
		Lifecycle:               state,
		WorkspaceCount:          h.WorkspaceCount(),
		OpenDocumentCount:       h.documents.Count(),
		DiagnosticsCount:        diagnosticsCount,
		LastValidationTimestamp: lastValidationTimestamp,
	}
}
