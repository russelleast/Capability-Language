package lsp

import "testing"

func TestWorkspaceHostTracksFoldersDocumentsAndLifecycle(t *testing.T) {
	host := NewWorkspaceHost()
	host.SetWorkspaceFolders([]WorkspaceFolder{{URI: "file:///workspace", Name: "workspace"}})
	host.Documents().Open("file:///workspace/order.dcl", 1, "capability Order")
	host.MarkInitialized()

	health := host.Health()
	if !health.Running {
		t.Fatal("expected initialized host to be running")
	}
	if health.Lifecycle != LifecycleInitialized {
		t.Fatalf("expected initialized lifecycle, got %s", health.Lifecycle)
	}
	if health.WorkspaceCount != 1 {
		t.Fatalf("expected one workspace, got %d", health.WorkspaceCount)
	}
	if health.OpenDocumentCount != 1 {
		t.Fatalf("expected one open document, got %d", health.OpenDocumentCount)
	}

	host.MarkShutdown()
	health = host.Health()
	if health.Running {
		t.Fatal("expected shutdown host to report stopped")
	}
	if health.Lifecycle != LifecycleShutdown {
		t.Fatalf("expected shutdown lifecycle, got %s", health.Lifecycle)
	}
}
