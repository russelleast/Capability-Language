# Declarative Capability Language for VS Code

This extension provides v0.3.8 editor support for Declarative Capability Language (`.dcl`) files.

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
- Interactive architecture overview, capability, lifecycle, event flow, and context map graph WebViews
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
- `DCL: Show Architecture Overview`: opens a workspace-level graph for contexts, capabilities, events, and lifecycle indicators.
- `DCL: Show Capability Graph`: opens an interactive Cytoscape graph for one selected capability.
- `DCL: Show Context Map`: opens an interactive Cytoscape graph for DCL contexts and explicit dependencies.
- `DCL: Show Event Flow Graph`: opens an interactive Cytoscape graph for one selected event or all event flows.
- `DCL: Show Lifecycle Graph`: opens an interactive Cytoscape graph for one selected capability lifecycle.

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

## Architecture Overview

`DCL: Show Architecture Overview` opens the workspace-level starting graph for understanding the shape of a compiled DCL workspace. It is built from the normalized compiler semantic summary and keeps capabilities as the primary architectural unit.

The overview answers:

- what contexts exist
- what capabilities exist
- how capabilities are grouped by semantic context
- what events connect behaviour when compiler data exists
- which capabilities have lifecycle semantics

The architecture overview has three detail levels:

- `Overview`: contexts and capabilities only
- `Detailed`: contexts, capabilities, and events
- `Full`: contexts, capabilities, events, and lifecycle indicators

Architecture overview edges use compiler-provided relationships:

- context contains capability
- parent context contains child context
- capability emits event
- event references capability where compiler summary provides lifecycle event references
- capability has lifecycle

The WebView includes `Fit`, `Reset Layout`, `Center Selection`, and a detail-level selector. Selecting a graph node updates the detail panel with label, kind, context, capability count, event count, and lifecycle presence. If the compiler semantic summary includes a source location for that node, selection also reveals the DCL source in VS Code.

If context data is missing, capabilities are grouped under a `Workspace` context. If a capability has no context while other contexts exist, it is grouped under `Uncontexted`. These are display grouping nodes, not inferred DCL declarations.

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

## Lifecycle Graph

`DCL: Show Lifecycle Graph` visualises business progression over time for one compiled capability lifecycle. It is built from the normalized compiler semantic summary and uses compiler-provided lifecycle steps, terminal states, and transitions.

When launched from a lifecycle section in the DCL Explorer, the command opens that lifecycle directly. When launched from a capability with lifecycle data, it opens that capability lifecycle. When launched from the Command Palette, it prompts for one of the compiled capabilities that has lifecycle data.

Lifecycle graph nodes distinguish:

- lifecycle
- initial step
- step
- terminal step

Transition labels prefer compiler trigger data:

- `on outcome Accepted`
- `on event CustomerRegistered`
- `on outcome JobStarted from StartJob`

Lifecycle graph controls:

- `Fit`: fits the visible graph to the panel.
- `Reset Layout`: reruns the lifecycle-centered layout.
- `Center Lifecycle`: centers and selects the lifecycle node.

Selecting a lifecycle graph node updates the node details panel with its name, kind, incoming transition count, and outgoing transition count. If the compiler semantic summary includes a source location for that node, selection also reveals the DCL source in VS Code.

Lifecycle graph empty states are explicit: no compiled semantic summary, selected capability has no lifecycle, and lifecycle has no transitions.

## Event Flow Graph

`DCL: Show Event Flow Graph` visualises immutable facts emitted by capabilities and the compiler-known places where those events are referenced. It is built from the normalized compiler semantic summary and does not infer consumers by scanning source text.

When launched from an event in the DCL Explorer, the command opens that event directly. When launched from the Command Palette or Events section, it prompts for one event or `All event flows`.

Event flow graph nodes distinguish:

- capability
- event
- lifecycle
- lifecycle transition
- external/unknown reference, reserved for compiler-provided references that cannot be resolved to a capability

Event flow edges use conservative labels:

- `emits`
- `triggers transition`
- `references`

The graph uses `references` rather than `consumes` unless the compiler summary explicitly models consume or subscribe semantics.

Event flow graph controls:

- `Fit`: fits the visible graph to the panel.
- `Reset Layout`: reruns the event-flow layout.
- `Center Selected Event`: centers and selects the chosen event node.

Selecting an event flow graph node updates the details panel with label, kind, emitters, and known references or triggered transitions. If the compiler semantic summary includes a source location for that node, selection also reveals the DCL source in VS Code.

Event flow graph empty states are explicit: no compiled semantic summary, no declared events, selected event has no known emitters, and selected event has no known references or consumers.

## Context Map

`DCL: Show Context Map` visualises DCL contexts as semantic boundaries and capability grouping mechanisms. It is built from the normalized compiler semantic summary and does not infer relationships from folders, modules, or deployment structure.

When launched from a context in the DCL Explorer, the command opens the selected context with related parent, child, dependency, and dependent contexts where compiler data exists. When launched from the Command Palette or top-level Contexts section, it can show all contexts.

Context map nodes distinguish:

- context
- child context
- external/missing context reference

Context map edges use compiler-provided relationships:

- `contains`
- `depends on`

Context map controls:

- `Fit`: fits the visible graph to the panel.
- `Reset Layout`: reruns the context-map layout.
- `Center Selected Context`: centers and selects the chosen context node.

Selecting a context map node updates the details panel with context name, kind, parent context, child count, dependency count, and dependent count. If the compiler semantic summary includes a source location for that context, selection also reveals the DCL source in VS Code.

Context map empty states are explicit: no compiled semantic summary, no contexts declared, and selected contexts with no dependencies or children.

The graph feature remains intentionally narrow in v0.3.8. It does not provide source-to-graph navigation, dependency graph drilldowns, deployment diagrams, infrastructure concepts, or full bidirectional syncing yet.

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

### Architecture Overview

Screenshot placeholder: architecture overview graph with contexts, capabilities, events, and lifecycle indicators by detail level.

### Capability Graph

Screenshot placeholder: interactive capability graph with controls, legend, filters, and a selected node details panel.

### Lifecycle Graph

Screenshot placeholder: lifecycle graph showing initial, ordinary, and terminal steps with transition labels.

### Event Flow Graph

Screenshot placeholder: event flow graph showing emitting capabilities, event nodes, and compiler-known lifecycle transition references.

### Context Map

Screenshot placeholder: context map showing semantic context boundaries and explicit dependency relationships.

## Settings

- `dcl.compilerPath`: path or command prefix for the DCL compiler. Leave empty to use the repository compiler when available, otherwise `dcl` on `PATH`.
- `dcl.compileOnSave`: when enabled, saved `.dcl` files are compiled and Problems are refreshed. Non-DCL files are ignored.

## Error Handling

If the compiler is missing, exits unexpectedly, returns invalid JSON for `ir --format json`, or does not support formatting, the extension reports a clear VS Code message and leaves the document unchanged.

Diagnostics are cleared for files that become valid after a successful compile.

## Roadmap

v0.3.8 includes:

- compiler-backed diagnostics
- compiler-backed formatting hook
- compiler-backed summary tree
- language basics for editing `.dcl`
- DCL Explorer for compiler-backed architecture navigation
- source-range hardening for explorer navigation
- packaging and contributor development hardening
- automated unit test foundation
- first capability graph visualisation with node selection, graph-to-source navigation, controls, legend, filters, and capability switching
- lifecycle graph visualisation for compiler-provided lifecycle steps and transitions
- event flow graph visualisation for compiler-provided event emissions and lifecycle event references
- context map visualisation for compiler-provided context hierarchy and explicit dependencies
- architecture overview graph with overview, detailed, and full detail levels
- CI build, test, and VSIX packaging artifact

Deferred beyond v0.3.8:

- richer navigation and source linking
- source-to-graph navigation and full bidirectional graph syncing
- dependency graph drilldowns
- compiler-provided quick fixes
- optional language server, if the project chooses that architecture later

Service/workflow/BPMN-oriented views are not part of the DCL extension roadmap.
