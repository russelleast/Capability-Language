# Declarative Capability Language for VS Code

Current extension version: `0.3.14`

Declarative Capability Language (DCL) is a compiler-backed language for describing business capabilities, semantic boundaries, policies, effects, events, and lifecycles.

This extension provides end-user VS Code support for `.dcl` files. It intentionally stays thin: the DCL compiler remains the source of truth for diagnostics, formatting, semantic summaries, source locations, and graph data.

## Features

- `.dcl` file association, syntax highlighting, indentation, folding, brackets, and comments.
- Snippets for common DCL declarations and blocks.
- Static hover help for core DCL primitives.
- Compiler-backed diagnostics in VS Code Problems.
- Compiler-backed document formatting.
- Bundled DCL compiler binaries for macOS, Linux, and Windows.
- DCL Explorer Activity Bar view for semantic navigation.
- Source navigation for compiler-provided semantic locations.
- Interactive graph WebViews for:
  - Architecture Overview
  - Capability Graph
  - Lifecycle Graph
  - Event Flow Graph
  - Context Map
- Graph controls for fit, reset layout, centering, details, legends, and trusted node-to-source navigation.
- DCL extension icon and optional DCL file icon theme.

## Commands

- `DCL: Compile Current File`: run the compiler for the active `.dcl` file and publish diagnostics.
- `DCL: Compile Workspace`: compile workspace `.dcl` files together and refresh diagnostics.
- `DCL: Show Semantic Summary`: compile the active `.dcl` file and focus the semantic summary tree.
- `DCL: Show Compiler Info`: show which compiler the extension will run.
- `DCL: Format Document`: delegate formatting to the compiler.
- `DCL: Refresh Explorer`: refresh the DCL Explorer from the latest compiler summary.
- `DCL: Open Graph Workspace`: open the unified graph workbench for switching graph type and graph subject.
- `DCL: Export Current Graph`: export the currently visible graph from the Graph Workspace.
- `DCL: Show Architecture Overview`: open a workspace-level graph for contexts, capabilities, events, and lifecycle indicators.
- `DCL: Show Capability Graph`: open a capability-centered graph.
- `DCL: Show Lifecycle Graph`: open a lifecycle progression graph.
- `DCL: Show Event Flow Graph`: open an event emitter and reference graph.
- `DCL: Show Context Map`: open a graph of DCL contexts and explicit dependencies.

## Settings

`dcl.compilerPath`

Optional path to a custom DCL compiler executable. Leave empty to use the bundled compiler for supported platforms, falling back to `dcl` on PATH. The value may include fixed arguments, for example `go run ./cmd/dcl`.

The VSIX includes bundled compiler binaries for supported platforms. `dcl.compilerPath` is optional and is only needed when you want to use a custom compiler build.

`dcl.compileOnSave`

Legacy compile-on-save toggle. If `dcl.compileOnSaveMode` is not explicitly configured, `true` maps to `workspace` and `false` maps to `off`.

`dcl.compileOnSaveMode`

Controls compile-on-save for `.dcl` files. The default is `workspace`, which compiles all workspace DCL files together when any `.dcl` file is saved. This is the recommended mode for multi-file models where contexts, capabilities, events, or lifecycle data are split across files.

Available values:

- `workspace`: compile all workspace `.dcl` files together.
- `file`: compile only the saved `.dcl` file.
- `off`: disable compile-on-save.

## DCL Explorer

The DCL Explorer is an Activity Bar view for architecture navigation. It is built from compiler semantic summary data and keeps capabilities as the primary architectural unit.

The explorer can show contexts, capabilities, actors, policies, effects, events, and lifecycles when the compiler summary provides them. Selecting items with source locations reveals the corresponding DCL source. Items without source locations remain visible and fail gracefully.

Explorer context actions can open the relevant graph directly, including capability, lifecycle, event flow, context map, and architecture overview graphs.

## Graph Workspace

All graphs are built from the compiler semantic summary. The extension does not infer relationships from folders, parse DCL source in TypeScript, or invent missing dependencies.

Graph nodes use human-readable display labels for diagram readability while retaining the exact DCL source name in the details panel.

`DCL: Open Graph Workspace` opens a single graph workbench where you can switch between graph types without opening new panels.

The workspace includes:

- graph type selector
- subject selector for capability, lifecycle, event flow, and context map graphs
- architecture detail selector for overview, detailed, and full modes
- capability layout selector for default, layered, and radial layouts
- fit, reset layout, and center selection controls
- SVG and PNG export controls
- refresh from the latest compiled semantic summary
- compile workspace action when no compiled summary is available
- legend, node details, relationship summary, zoom limits, and source navigation

Existing graph commands still work as shortcuts into the Graph Workspace with the relevant graph type pre-selected.

### Exporting Graphs

Use `Export SVG` or `Export PNG` in the Graph Workspace toolbar, or run `DCL: Export Current Graph` from the Command Palette while a graph is open.

Exports use the current graph type, subject, detail level, layout, zoom, and node positions. VS Code always opens a save dialog before writing the file.

SVG is recommended for documentation and website screenshots because labels remain crisp. PNG is available for quick sharing.

Suggested filenames are generated from the graph type and subject, for example:

- `dcl-architecture-overview.svg`
- `dcl-capability-place-order.svg`
- `dcl-lifecycle-order-fulfilment.svg`
- `dcl-event-flow-order-submitted.svg`

### Architecture Overview

`DCL: Show Architecture Overview` is the workspace-level starting graph. It answers:

- what contexts exist
- what capabilities exist
- how capabilities are grouped
- what events connect behaviour when compiler data exists
- which capabilities have lifecycle semantics

Detail levels:

- `Overview`: contexts and capabilities
- `Detailed`: contexts, capabilities, and events
- `Full`: contexts, capabilities, events, and lifecycle indicators

If the compiler provides an explicit `default` context, capabilities without a more specific context are grouped there. If no context data exists, capabilities are grouped under `Workspace`.

### Capability Graph

`DCL: Show Capability Graph` opens one selected capability and compiler-provided relationships:

- accepts
- produces
- enforces
- causes
- emits
- governed by
- owns

The graph includes fit, reset, center, capability switching, policy/lifecycle/rule filters, and layout choices for `Default`, `Layered`, and `Radial`.

### Lifecycle Graph

`DCL: Show Lifecycle Graph` visualises business progression over time for a selected capability lifecycle. It distinguishes lifecycle, initial step, ordinary step, and terminal step nodes. Transition labels use compiler trigger data where available, such as `on outcome Accepted` or `on event CustomerRegistered`.

### Event Flow Graph

`DCL: Show Event Flow Graph` shows immutable events emitted by capabilities and compiler-known references, including lifecycle transitions triggered by events. It uses conservative labels such as `emits`, `triggers transition`, and `references`.

### Context Map

`DCL: Show Context Map` shows DCL contexts as semantic boundaries. It can display compiler-provided parent/child context hierarchy and explicit context dependencies. Contexts are not treated as services, modules, folders, or deployments.

## Installing From VSIX

The extension is currently distributed as a VSIX package. The VSIX includes the DCL compiler for macOS arm64, macOS x64, Linux x64, and Windows x64.

1. Download the `.vsix` file from the project website or GitHub Actions artifact.
2. In VS Code, open the Command Palette.
3. Run `Extensions: Install from VSIX...`.
4. Select the downloaded `.vsix`.
5. Reload VS Code when prompted.

Do not double-click the VSIX file; install it through VS Code.

## GitHub Actions Artifact

CI packages the extension as a downloadable VSIX artifact. Open the latest successful GitHub Actions run for the repository, download the VSIX artifact, and install it with `Extensions: Install from VSIX...`.

## Marketplace Status

The extension is not published to the VS Code Marketplace yet. Marketplace publishing is planned for a later release.

## Known Limitations

- No Language Server Protocol implementation yet.
- No TypeScript-side DCL parser.
- No inferred graph relationships from folders or source text.
- Graphs only show relationships exposed by the compiler semantic summary.
- Full source-to-graph bidirectional syncing is not implemented.
- Marketplace publishing is not automated yet.

## Troubleshooting Compiler Errors

Run `DCL: Show Compiler Info` to see the resolved compiler path, source, platform, architecture, and bundled compiler availability.

Compiler resolution order:

1. `dcl.compilerPath`, when configured.
2. Bundled compiler matching the current platform and architecture.
3. `dcl` from PATH.

If compilation fails before diagnostics are produced, the error message includes the compiler path, source, exit code, and stderr when available.

## Links

- Repository: [Capability-Language](https://github.com/russelleast/Capability-Language)
- Issues: [GitHub Issues](https://github.com/russelleast/Capability-Language/issues)
