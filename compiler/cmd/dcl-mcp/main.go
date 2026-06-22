package main

import (
	"os"

	"capabilitylanguage/internal/mcp"
)

func main() {
	server := mcp.NewServer()
	if err := server.Serve(os.Stdin, os.Stdout); err != nil {
		os.Exit(1)
	}
}
