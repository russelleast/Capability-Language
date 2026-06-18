# Declarative Capability Language for VS Code

This extension provides v0.3.4 editor support for Declarative Capability Language (`.dcl`) files.

The extension is intentionally thin. It does not implement a parser, duplicate compiler semantics, infer semantic validity, or run a language server. The DCL compiler CLI is the source of truth for diagnostics, formatting, semantic summary data, and graph inputs.

## Features

- `.dcl` file association and activation
- TextMate syntax highlighting for DCL declarations, keywords, blocks, comments, strings, numbers, and common scalar types
- Language configuration for braces, comments, folding markers, and indentation
- Snippets for `capability`, `actor`, `shape`, `event`, `effect`, `policy`, `when`, and `lifecycle`
- Static hover help for core DCL primitives
- Compiler-backed diagnostics in VS Code Problems
- Compiler-backed semantic summary tree
- DCL Explorer Activity Bar view for architecture navigation
- Interactive capability graph WebView for one selected capability at a time
- Commands for compiling files, compiling workspaces, showing summaries, and formatting documents

## Setup

From this folder:

```bash
npm install
npm run compile
```

Then open the extension in VS Code and run the extension host.

By default, when the repository layout is available, the extension runs the local compiler with:

```bash
go run ./cmd/dcl
```

from the repository `compiler` directory. Outside this repository, set `dcl.compilerPath` to a compiler executable or fixed command prefix.

Examples:

```json
{
  "dcl.compilerPath": "dcl"
}
```

```json
{
  "dcl.compilerPath": "go run ./cmd/dcl"
}
```

## Development

For local extension development:

```bash
cd tools/vscode-extension
npm install
npm run compile
npm run lint
npm test
```

Open this folder in VS Code and launch `Run DCL Extension` to start an Extension Development Host. (press F5, and select the Run DCL Extension launch configuration.)

To package a VSIX:

```bash
npm run package
```

Do not double-click the VSIX. Install it through VS Code using Extensions: Install from VSIX... (cmd + shift + p)

For a packaging smoke test:

```bash
npm run package:smoke
```

See `DEVELOPMENT.md` for fixture-based testing notes and handoff details.

## Commands

- `DCL: Compile Current File`: runs the compiler for the active `.dcl` file and publishes diagnostics.
- `DCL: Compile Workspace`: finds workspace `.dcl` files and compiles them together.
- `DCL: Show Semantic Summary`: compiles the active `.dcl` file and focuses the semantic summary tree.
- `DCL: Format Document`: delegates formatting to the compiler.
- `DCL: Refresh Explorer`: recompiles the active DCL file when one is open, otherwise compiles the workspace and refreshes the DCL Explorer.
- `DCL: Show Capability Graph`: opens an interactive Cytoscape graph for one selected capability.

## DCL Explorer

The DCL Explorer is a sidebar Activity Bar view for architecture navigation. It is built from compiler IR and keeps capabilities as the primary architectural unit.

It shows:

- Contexts
- Capabilities
- Actors
- Policies
- Effects
- Events
- Lifecycles

Capabilities expand into semantic child sections when available:

- Intents
- Outcomes
- Rules
- Effects
- Events
- Policies
- Lifecycle

Items with compiler-provided source locations open and reveal their source when selected. Items without source locations remain visible but do not perform navigation.

The explorer distinguishes these empty and failure states:

- no compiled summary yet
- compile failed
- no DCL files found
- compiler unavailable

The explorer title bar includes refresh and compile-workspace actions.

## Capability Graph

`DCL: Show Capability Graph` opens the first graph visualisation slice for DCL. The graph is built from the normalized compiler semantic summary and renders one capability as the central architectural unit.

When launched from a capability in the DCL Explorer, the command opens that capability directly. When launched from the Command Palette, it prompts for one of the available compiled capabilities.

The v0.3 graph includes available compiler-provided capability relationships:

- capability accepts intent
- capability produces outcome
- capability enforces rule
- capability causes effect
- capability emits event
- capability governed by policy
- capability owns lifecycle

Graph controls:

- `Fit`: fits the visible graph to the panel.
- `Reset Layout`: reruns the capability-centered layout.
- `Center Capability`: centers and selects the capability node.
- `Switch Capability`: opens a VS Code quick pick for another compiled capability.

The side panel includes node details, a legend for capability, intent, outcome, rule, effect, event, policy, and lifecycle nodes, and simple visibility filters for policies, lifecycle, and rules.

Selecting a graph node updates the node details panel with its label, kind, and relationship summary. If the compiler semantic summary includes a source location for that node, selection also reveals the DCL source in VS Code. Nodes without compiler-provided source locations remain selectable and never crash navigation.

Graph-to-source navigation is resolved by the extension host from the trusted graph model. The WebView sends only the selected node id; it does not send source file paths back to the extension.

Empty graph states are explicit: no compiled semantic summary, no capability selected, and selected capabilities with no child semantic items all show friendly guidance.

The graph remains intentionally narrow in v0.3.4. It does not provide source-to-graph navigation, event flow graphs, context graphs, dependency graphs, lifecycle-specific graphs, or full bidirectional syncing yet.

## Source Navigation

The extension expects DCL compiler source locations to use 1-based `line` and `column` values. Before opening source, locations are normalized and checked for missing paths, missing line values, deleted files, relative paths, absolute paths, and out-of-range lines or columns.

Malformed or stale locations never crash the extension. If a location cannot be revealed, VS Code shows a friendly warning and the explorer remains usable.

## Screenshots

### Diagnostics

Screenshot placeholder: compiler diagnostics shown in VS Code Problems for a `.dcl` file.

### Explorer

Screenshot placeholder: DCL Explorer showing capability-first architecture navigation.

### Semantic Summary

Screenshot placeholder: DCL Semantic Summary tree generated from compiler IR.

### Capability Graph

Screenshot placeholder: interactive capability graph with controls, legend, filters, and a selected node details panel.

## Settings

- `dcl.compilerPath`: path or command prefix for the DCL compiler. Leave empty to use the repository compiler when available, otherwise `dcl` on `PATH`.
- `dcl.compileOnSave`: when enabled, saved `.dcl` files are compiled and Problems are refreshed. Non-DCL files are ignored.

## Error Handling

If the compiler is missing, exits unexpectedly, returns invalid JSON for `ir --format json`, or does not support formatting, the extension reports a clear VS Code message and leaves the document unchanged.

Diagnostics are cleared for files that become valid after a successful compile.

## Roadmap

v0.3.4 includes:

- compiler-backed diagnostics
- compiler-backed formatting hook
- compiler-backed summary tree
- language basics for editing `.dcl`
- DCL Explorer for compiler-backed architecture navigation
- source-range hardening for explorer navigation
- packaging and contributor development hardening
- automated unit test foundation
- first capability graph visualisation with node selection, graph-to-source navigation, controls, legend, filters, and capability switching
- CI build, test, and VSIX packaging artifact

Deferred beyond v0.3.4:

- richer navigation and source linking
- source-to-graph navigation and full bidirectional graph syncing
- event flow, context, dependency, and lifecycle-specific graphs
- compiler-provided quick fixes
- optional language server, if the project chooses that architecture later

Service/workflow/BPMN-oriented views are not part of the DCL extension roadmap.
