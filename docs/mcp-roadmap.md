# DCL MCP Roadmap

This roadmap tracks MCP capabilities for DCL AI clients. MCP tools should remain local-first, stdio-based, read-only, and backed by compiler diagnostics, compiler IR, or compiler-owned analysis packages.

## Implemented

- `dcl_validate`: validates DCL source, files, or workspaces with compiler diagnostics.
- `dcl_compile`: compiles DCL source, files, or workspaces and reports success, diagnostics, source count, and version metadata.
- `dcl_ir`: returns compiler IR as structured JSON.
- `dcl_explain_diagnostics`: explains compiler diagnostics in deterministic prose.
- `dcl_version`: returns version metadata from `version.json`.
- `dcl_summary`: returns a concise semantic summary derived from compiler IR.

## Planned

- `dcl_capability_map`: return a capability-oriented map of intents, outcomes, effects, events, policies, and lifecycle relationships.
- `dcl_context_graph`: return context ownership and dependency relationships in a graph-friendly format.
- `dcl_policy_review`: summarize effective policy coverage, conflicts, obligations, and missing policy signals.

## Exploratory

- `dcl_find_smells`: identify modelling smells such as ambiguous outcomes, unused declarations, weak lifecycle completion, or surprising dependency patterns.
- `dcl_portability_analysis`: explain portability classifications and runtime obligations inferred from the compiler model.
- `dcl_event_flow`: produce a focused event emission and consumption view.
- `dcl_lifecycle_review`: produce lifecycle-specific analysis for terminal states, triggers, deadlines, and recovery paths.

## Non-Goals For V1

- HTTP transport
- hosted or remote MCP service
- authentication or authorization layer
- source editing or file mutation
- shell command execution
- MCP resources, prompts, or sampling

Future additions should prefer new compiler-backed packages over client-specific logic, so the CLI, LSP, website, extension, and MCP server can converge on the same semantic source of truth.
