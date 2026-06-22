# DCL MCP Server

`dcl-mcp` is the local-first Model Context Protocol server for Declarative Capability Language. It lets AI clients validate, compile, inspect, and explain DCL workspaces through the same Go compiler used by the CLI, language server, playground, and VS Code extension.

The server is intentionally small:

- stdio transport only
- local process execution only
- read-only analysis tools only
- no HTTP listener
- no hosting requirement
- no authentication flow
- no cloud dependency
- no shell command execution
- no source mutation

Supported MCP protocol version: `2025-06-18`.

## Tools

The MCP server exposes compiler-backed tools:

| Tool | Purpose |
| --- | --- |
| `dcl_validate` | Validate DCL source, files, or directories and return structured diagnostics. |
| `dcl_compile` | Compile DCL source, files, or directories and return success state, diagnostics, and version metadata. |
| `dcl_ir` | Return compiler IR as structured JSON for AI inspection. |
| `dcl_explain_diagnostics` | Convert compiler diagnostics into deterministic human-readable explanations. |
| `dcl_version` | Return version metadata loaded from repository `version.json`. |
| `dcl_summary` | Return a concise semantic summary derived from compiler IR. |

Source-taking tools accept one input mode:

```json
{
  "source": "language dcl 1.0\n...",
  "filename": "example.dcl"
}
```

or:

```json
{
  "path": "/absolute/path/to/workspace-or-file"
}
```

or:

```json
{
  "paths": ["/absolute/path/to/a.dcl", "/absolute/path/to/workspace"]
}
```

Directory paths are scanned recursively for `.dcl` files. `.git` and `node_modules` are skipped.

## Installation

### From Release Artifacts

Download the `dcl-mcp` binary for your platform from the project release artifacts when available. Place it somewhere stable, then use its absolute path in your MCP client configuration.

The intended release set is:

- `dcl`
- `dcl-lsp`
- `dcl-mcp`

All binaries use version metadata from root `version.json`.

### Build From Source

From the repository root:

```sh
cd compiler
go build -o dcl-mcp ./cmd/dcl-mcp
```

Use the absolute path to the built binary, for example:

```sh
/Users/alex/Code/Capability-Language/compiler/dcl-mcp
```

## Claude Desktop

Add `dcl` to your Claude Desktop MCP configuration. Use the absolute path to `dcl-mcp`.

macOS example:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/Users/alex/bin/dcl-mcp"
    }
  }
}
```

If you built from source:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/Users/alex/Code/Capability-Language/compiler/dcl-mcp"
    }
  }
}
```

Restart Claude Desktop after editing the configuration.

## Claude Code

Configure Claude Code to launch `dcl-mcp` as a stdio MCP server.

Example:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/Users/alex/bin/dcl-mcp"
    }
  }
}
```

Then ask Claude Code to use the DCL tools against the current workspace path.

## Generic MCP Client

Any MCP-compatible client that supports stdio servers can launch `dcl-mcp` with no arguments:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/path/to/dcl-mcp"
    }
  }
}
```

The server does not require environment variables. Clients should pass explicit source text or explicit file/workspace paths to tools.

## Example Prompts

- "Validate this DCL workspace."
- "Explain these diagnostics."
- "Generate IR for this capability."
- "Find ambiguous outcomes."
- "Explain this lifecycle."
- "Summarize this DCL workspace."
- "Explain the capabilities in this DCL file."
- "Summarize the lifecycle and policies in this capability."
- "Summarize the capabilities, outcomes, effects, policies, and lifecycles in this workspace."
- "Review this DCL model for lifecycle issues using compiler diagnostics and summary output."

## Troubleshooting

### The client cannot start the server

- Confirm the `command` path is absolute.
- Confirm the binary exists and is executable.
- On macOS/Linux, run `chmod +x /path/to/dcl-mcp` if needed.
- Run `/path/to/dcl-mcp` from a terminal; it should wait for stdio input and print nothing.

### Version metadata is missing

Release binaries embed metadata from `version.json`. Source builds look upward from the current working directory or executable directory for `version.json`. If you build from source and move only the binary, prefer a release binary or build with embedded metadata.

### No DCL files are found

- Pass an explicit `.dcl` file, a directory containing `.dcl` files, or inline `source`.
- Directory scans are recursive but skip `.git` and `node_modules`.
- Non-`.dcl` files are ignored.

### Diagnostics mention unexpected paths

Inline source uses `filename` for diagnostic display. If omitted, the server uses `inline.dcl`.

### The server does not expose prompts or resources

That is expected in v1. `dcl-mcp` is tool-only: no resources, prompts, sampling, HTTP transport, or source mutation.

## Safety Model

`dcl-mcp` only reads source text or paths provided by the MCP client. It does not execute shell commands, write source files, run formatters, start network listeners, or contact remote services. All semantic behavior comes from the DCL compiler and compiler IR.
