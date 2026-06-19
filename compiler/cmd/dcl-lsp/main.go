package main

import (
	"os"

	"capabilitylanguage/internal/lsp"
)

func main() {
	server := lsp.NewServer(lsp.NewWorkspaceHost(), lsp.NewLogger(os.Stderr))
	if err := server.Serve(os.Stdin, os.Stdout); err != nil {
		lsp.NewLogger(os.Stderr).Event("server error", map[string]any{"error": err.Error()})
		os.Exit(1)
	}
}
