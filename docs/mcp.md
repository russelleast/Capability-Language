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

## Quick Start

Download the DCL MCP server archive for your platform from the [current MCP release](https://github.com/russelleast/Capability-Language/releases/tag/mcp-v0.1.0).

MCP downloads are published on dedicated MCP releases, not VS Code extension releases. Current and older MCP releases can be found by searching GitHub Releases for [`DCL MCP Server`](https://github.com/russelleast/Capability-Language/releases?q=DCL+MCP+Server&expanded=true). Choose the newest release named like `DCL MCP Server v0.1.0`, then download the archive for your platform:

| Platform | Asset name |
| --- | --- |
| macOS Apple Silicon | `dcl-mcp-darwin-arm64.tar.gz` |
| macOS Intel | `dcl-mcp-darwin-amd64.tar.gz` |
| Linux x64 | `dcl-mcp-linux-amd64.tar.gz` |
| Windows x64 | `dcl-mcp-windows-amd64.zip` |

Extract the archive, then run the included install script.

macOS/Linux:

```sh
./install.sh
```

Windows PowerShell:

```powershell
.\install.ps1
```

The installer copies `dcl-mcp` to a predictable user-level location and prints ready-to-copy VS Code / Copilot MCP configuration.

Release binaries do not require Go or a repository checkout.

To build from source as a contributor instead, run this from the repository root:

```sh
make install-mcp
```

This builds the local stdio MCP server, installs it at `./bin/dcl-mcp`, and prints ready-to-copy VS Code / Copilot MCP configuration that uses the absolute binary path.

The source install path uses the repository-local `bin/` directory instead of a user-level directory such as `~/.dcl/bin`. That keeps contributor setup explicit, avoids modifying user shell state, and lets the source-built binary find the root `version.json` without extra packaging steps.

Source-build requirements:

- Go, because this repository builds the compiler and MCP server from Go source.
- Node.js only for `make test-mcp`, which uses the existing smoke-test script.

To print the VS Code / Copilot configuration again:

```sh
make mcp-config
```

To verify the installed server:

```sh
make test-mcp
```

`make test-mcp` confirms the binary exists, is executable, responds to MCP `initialize` and `tools/list`, and can call `dcl_version` and `dcl_summary`.

## AI Access Paths

DCL supports three AI access paths:

1. **stdio MCP**: best for MCP-native clients. This is the default `dcl-mcp` mode and is validated by the local smoke test below. Client support and chat-model tool selection can vary.
2. **CLI JSON**: the universal fallback for Codex, Copilot terminal agents, Claude Code, scripts, CI, and humans. Use this when MCP tool exposure is inconsistent.
3. **HTTP MCP**: a future optional local transport. It is not implemented yet; see the design note below.

For most agent workflows, the CLI is the most reliable path because it uses ordinary shell commands and returns compiler-backed JSON.

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

## CLI Fallback

The `dcl` CLI exposes the same compiler-backed semantics for AI clients that can run shell commands:

```sh
dcl validate <paths...> [--json]
dcl compile <paths...> [--json]
dcl ir <paths...> [--json]
dcl summary <paths...> [--json]
dcl explain-diagnostics <paths...|json-file> [--json]
dcl version [--json]
```

Examples:

```sh
dcl summary . --json
dcl validate . --json
dcl ir . --json
```

### Known-good AI demo workspace

Use `website/src/examples/ai-demo-workspace` for demos, docs, and agent smoke tests. It is a cohesive multi-file workspace that compiles as one unit and includes contexts, human/system/agent actors, capabilities, intents, outcomes, effects, events, policies, and a lifecycle.

From `compiler/` after building `dcl`:

```sh
dcl validate ../website/src/examples/ai-demo-workspace --json
dcl summary ../website/src/examples/ai-demo-workspace --json
dcl ir ../website/src/examples/ai-demo-workspace --json
```

Not every examples folder is intended to be compiled as a single workspace. Broad folders such as `website/src/examples` may contain independent examples with overlapping symbols or missing cross-example dependencies. Use a cohesive workspace directory, an explicit set of related `.dcl` files, or the AI demo workspace above.

Useful LLM instructions:

- Run `dcl summary . --json` and explain the business capabilities in this workspace.
- Run `dcl validate . --json` and explain any diagnostics.
- Run `dcl ir . --json` and identify lifecycle transitions.
- Run `dcl summary ../website/src/examples/ai-demo-workspace --json` and explain the business capabilities.
- Run `dcl validate ../website/src/examples/ai-demo-workspace --json` and explain any diagnostics.
- Run `dcl ir ../website/src/examples/ai-demo-workspace --json` and identify lifecycle transitions.

`dcl check <paths...>` remains available as a compatibility alias for validation.

## Installation

### Release binaries

Release archives are attached to dedicated `mcp-v*` GitHub Releases and use stable asset names:

- `dcl-mcp-darwin-arm64.tar.gz`
- `dcl-mcp-darwin-amd64.tar.gz`
- `dcl-mcp-linux-amd64.tar.gz`
- `dcl-mcp-windows-amd64.zip`

Each archive includes:

- the `dcl-mcp` binary for that platform
- a package README
- `mcp.vscode.json`
- `mcp.claude-desktop.json`
- an install script where practical
- the project license

The packaged binaries embed version metadata from `version.json`, so users do not need Go installed and do not need to clone the repository.

### Release publishing

Tagged MCP releases are packaged by GitHub Actions. Push a tag like:

```sh
git tag mcp-v0.1.0
git push origin mcp-v0.1.0
```

The release workflow runs on `mcp-v*` tags, builds the four supported platform binaries, creates the stable archive assets, and attaches them to a GitHub Release titled like `DCL MCP Server v0.1.0`.

MCP archives must not be attached to `vscode-extension-*` releases. The VS Code extension release flow remains separate and continues to publish VSIX assets only.

### Repository-local source install

From the repository root:

```sh
make install-mcp
```

The binary is installed at:

```sh
./bin/dcl-mcp
```

Use the absolute path printed by `make install-mcp` in MCP client configuration. Re-run the command after pulling compiler or MCP server changes.

### VS Code / Copilot

Run:

```sh
make mcp-config
```

For release installs, use the JSON printed by `install.sh` or `install.ps1`, or adapt the included `mcp.vscode.json` file.

For source installs, copy the JSON printed by `make mcp-config` into `.vscode/mcp.json` for workspace-local setup:

```json
{
  "servers": {
    "dcl": {
      "type": "stdio",
      "command": "/absolute/path/to/Capability-Language/bin/dcl-mcp"
    }
  }
}
```

You can also place the same server entry in your VS Code user MCP settings if you want it available outside this workspace.

After editing MCP configuration:

- Reload VS Code.
- Open Copilot Chat in a mode that supports tools or agents.
- Use the chat tool picker to confirm the DCL tools are enabled.
- Ask for a concrete tool-backed task, such as `Use the DCL MCP server to call dcl_version`.

### Claude Desktop

Claude Desktop uses the `mcpServers` shape. Use the same absolute binary path printed by `make install-mcp`:

```json
{
  "mcpServers": {
    "dcl": {
      "command": "/absolute/path/to/Capability-Language/bin/dcl-mcp"
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
      "command": "/absolute/path/to/Capability-Language/bin/dcl-mcp"
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
      "command": "/absolute/path/to/Capability-Language/bin/dcl-mcp"
    }
  }
}
```

The server does not require environment variables. Clients should pass explicit source text or explicit file/workspace paths to tools.

## Versioning

`version.json` includes MCP server metadata:

```json
{
  "mcp": {
    "name": "dcl-mcp",
    "version": "0.1.0"
  }
}
```

The `dcl_version` MCP tool returns the full version metadata object, including `language`, `compiler`, `mcp`, and `vscode`. The human-readable summary remains compiler-focused and continues to use the existing `dcl compiler ...` wording.

## HTTP MCP Design Note

HTTP MCP is deferred to a follow-up implementation pass. The intended local-only shape is:

```sh
dcl-mcp serve --http --host 127.0.0.1 --port 7331
```

The transport should use MCP Streamable HTTP on a single endpoint such as `/mcp`:

- stdio remains the default.
- HTTP is opt-in only.
- default bind address is `127.0.0.1`, not `0.0.0.0`.
- POST accepts JSON-RPC MCP messages.
- notifications return `202 Accepted`.
- requests return JSON-RPC responses with `Content-Type: application/json`, or SSE if streaming is later needed.
- GET returns `405 Method Not Allowed` unless SSE support is implemented.
- `Origin` must be validated for local HTTP use to avoid DNS rebinding risks.
- no authentication is planned for the first local-only version; this must be clearly documented.

This is intentionally not implemented in the CLI-first pass, because CLI access solves the immediate cross-agent reliability problem without adding HTTP session/security semantics.

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

### Smoke-test the stdio transport

From the repository root:

```sh
make test-mcp
```

This runs the existing smoke test against `./bin/dcl-mcp`. It validates initialization, tool discovery, `dcl_version`, and `dcl_summary`.

MCP stdio responses are newline-delimited JSON-RPC messages. Human-readable logs must not be written to stdout, because stdout is reserved for protocol messages.

Set `DCL_MCP_DEBUG=1` to write lifecycle and tool-call logs to stderr only:

```sh
DCL_MCP_DEBUG=1 make test-mcp
```

### VS Code discovers tools but Copilot does not call them

If VS Code shows `Discovered 6 tools`, the MCP server has started and `tools/list` succeeded. That does not guarantee the chat model will choose a tool for every prompt.

Check the following:

- Use a Copilot chat session that supports tools/agent behavior. VS Code documentation describes MCP servers as tools available in chat, and notes that models discover and invoke tools based on the prompt.
- In the Chat view, use the Configure Tools button in the chat input to see available tools and make sure the DCL tools are enabled.
- Reload the VS Code window or restart the MCP server after changing `.vscode/mcp.json` or rebuilding `dcl-mcp`.
- Use `MCP: List Servers` from the Command Palette to manage the server and view output. Some VS Code builds do not provide an `MCP: List Tools` command.
- Ask for a concrete tool-backed task, for example: `Use the DCL MCP server to call dcl_version` or `Use dcl_summary on this DCL source`.
- VS Code may display server-qualified tool names internally, such as `dcl-dcl_version`, where the first `dcl` is the MCP server id from `.vscode/mcp.json`. The MCP server itself still advertises tool names like `dcl_version`.

If `make test-mcp` passes but Copilot still says a tool is unavailable, the problem is likely VS Code/Copilot chat mode, tool enablement, trust, or model tool-selection behavior rather than DCL MCP protocol handling.

### The client cannot start the server

- Confirm the `command` path is absolute.
- Confirm the binary exists and is executable.
- On macOS/Linux, run `chmod +x /path/to/dcl-mcp` if needed.
- Run `/path/to/dcl-mcp` from a terminal; it should wait for stdio input and print nothing.
- Re-run `make install-mcp` from the repository root if the binary is missing.

### Version metadata is missing

Release binaries embed metadata from `version.json`. Source builds installed by `make install-mcp` look upward from `./bin/dcl-mcp` and find the repository root `version.json`. If you move only a source-built binary somewhere else, version metadata may be unavailable unless you also provide embedded release metadata.

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
