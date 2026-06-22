# DCL MCP Server

`dcl-mcp` is the local-first Model Context Protocol server for DCL. It runs over stdio, wraps the existing DCL compiler, and exposes read-only analysis tools for AI clients.

The server does not require hosting, authentication, cloud services, or an HTTP endpoint.

## Build

From the repository root:

```sh
cd compiler
go build -o dcl-mcp ./cmd/dcl-mcp
```

## Client Configuration

Use the absolute path to the built `dcl-mcp` binary:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/path/to/dcl-mcp"
    }
  }
}
```

## Tools

The v1 MCP server exposes tools only:

- `dcl_validate`: validate supplied DCL source, files, or workspace paths.
- `dcl_compile`: compile supplied DCL source, files, or workspace paths.
- `dcl_ir`: return compiler IR as structured JSON.
- `dcl_explain_diagnostics`: explain compiler diagnostics.
- `dcl_version`: return version metadata from `version.json`.

Tools accept inline `source` with optional `filename`, or explicit `path`/`paths`. Directory paths are scanned recursively for `.dcl` files, skipping `.git` and `node_modules`.

The server does not expose MCP resources, prompts, sampling, HTTP transport, source mutation, or shell execution in v1.

## Example Prompts

- "Validate this DCL workspace."
- "Explain these DCL diagnostics."
- "Generate the IR for this capability."
- "Find ambiguous outcomes or lifecycle issues."

## Packaging Note

Release packaging should include:

- `dcl`
- `dcl-lsp`
- `dcl-mcp`

The VS Code extension does not need to use or configure `dcl-mcp` in v1. Bundling the MCP binary with the extension can be evaluated later if there is a clear client workflow for it.
