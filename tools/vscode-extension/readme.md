# Declarative Capability Language (DCL)

Describe software systems by what they mean.

Declarative Capability Language (DCL) is a language for modelling software systems through capabilities, intents, outcomes, rules, effects, events, policies, lifecycles, and contexts. This extension brings DCL authoring, compiler-backed feedback, semantic navigation, and architecture graphs into VS Code.

- Website: https://russelleast.github.io/Capability-Language/
- Documentation: https://russelleast.github.io/Capability-Language/docs
- Examples: https://russelleast.github.io/Capability-Language/examples
- GitHub repository: https://github.com/russelleast/Capability-Language
- Issues: https://github.com/russelleast/Capability-Language/issues

## Version

- Extension version: `1.0.2`
- DCL language version: `1.0`

The extension is available on the VS Code Marketplace and can also be downloaded from the DCL website. DCL v1.0 defines the stable core language; editor tooling and ecosystem integrations continue to evolve around it.

## Screenshots

DCL authoring with syntax highlighting, hover help, and compiler diagnostics:

![DCL authoring](https://raw.githubusercontent.com/russelleast/Capability-Language/main/tools/vscode-extension/images/dcl-authoring.png)

DCL Explorer for contexts, capabilities, and events:

![DCL Explorer](https://raw.githubusercontent.com/russelleast/Capability-Language/main/tools/vscode-extension/images/dcl-explorer.png)

Graph Workspace with Architecture Overview:

![DCL Architecture Overview](https://raw.githubusercontent.com/russelleast/Capability-Language/main/tools/vscode-extension/images/architecture-overview.png)

Event Flow and Lifecycle graph views:

![DCL Event Flow or Lifecycle Graph](https://raw.githubusercontent.com/russelleast/Capability-Language/main/tools/vscode-extension/images/event-flow-or-lifecycle.png)

## Features

### Authoring

- Syntax highlighting for `.dcl` files
- Snippets for common DCL declarations
- Hover help for core DCL concepts
- Compiler-backed formatting
- Compiler-backed diagnostics in VS Code Problems

### Navigation

- DCL Explorer Activity Bar view
- Outline view support through the bundled language server
- Workspace Symbols
- Go To Definition
- Find References
- Source-to-graph and graph-to-source navigation where compiler source locations are available

### Architecture Visualisation

- Architecture Overview
- Capability Graph
- Lifecycle Graph
- Event Flow Graph
- Context Map
- SVG and PNG graph export

### Language Intelligence

- Bundled DCL compiler
- Bundled DCL language server
- Semantic source index for compiler-backed navigation
- Semantic summary for Explorer and graph views

## Quick Start

1. Install the DCL extension in VS Code.
2. Open a folder containing `.dcl` files.
3. Open a `.dcl` file.
4. Run `DCL: Compile Workspace` from the Command Palette.
5. Open the DCL Explorer from the Activity Bar.
6. Run `DCL: Open Graph Workspace` to explore architecture graphs.

## Commands

- `DCL: Compile Workspace`
- `DCL: Compile Current File`
- `DCL: Open Graph Workspace`
- `DCL: Show Architecture Overview`
- `DCL: Show Capability Graph`
- `DCL: Show Lifecycle Graph`
- `DCL: Show Event Flow Graph`
- `DCL: Show Context Map`
- `DCL: Navigate Symbol`
- `DCL: Find Related Elements`
- `DCL: Show Compiler Info`
- `DCL: Show Language Server Status`
- `DCL: Export Current Graph`

## Settings

`dcl.compileOnSaveMode`

Controls compile-on-save for `.dcl` files. The default is `workspace`.

- `workspace`: compile all workspace `.dcl` files together
- `file`: compile only the saved `.dcl` file
- `off`: disable compile-on-save

`dcl.compilerPath`

Optional path to a custom DCL compiler executable. Leave empty to use the bundled compiler for supported platforms, falling back to `dcl` on PATH.

`dcl.languageServer.enabled`

Enables the bundled DCL language server for compiler-backed diagnostics, document symbols, workspace symbols, definition navigation, and find references. Disabled by default.

`dcl.languageServer.path`

Optional path to a custom `dcl-lsp` executable. Leave empty to use the bundled language server for supported platforms, falling back to `dcl-lsp` on PATH.

`dcl.languageServer.trace`

Controls language server protocol logging. Use `off` for normal use, or `messages` / `verbose` when debugging language server traffic.

`dcl.graph.followSourceSelection`

When enabled, moving the cursor inside compiler-known DCL semantic items focuses the matching node in the open Graph Workspace.

`dcl.graph.autoRevealFromSource`

When enabled, source cursor movement can reveal the Graph Workspace from a DCL editor. Disabled by default.

## Bundled Compiler And Language Server

The extension includes the DCL compiler and DCL language server for supported macOS, Linux, and Windows platforms.

Use `dcl.compilerPath` or `dcl.languageServer.path` only when you need to run a custom local build or a separately installed executable.

## Known Limitations

- DCL v1.0 defines the stable language core; advanced tooling and compiler analysis may continue to evolve.
- Graphs and navigation use compiler-provided semantic data; unavailable relationships are not inferred by the extension.

## Feedback And Issues

Please report issues at https://github.com/russelleast/Capability-Language/issues.

## License

Apache-2.0
