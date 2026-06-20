# Changelog

## 0.5.5

- Added experimental compiler-backed LSP Find References through `textDocument/references`.
- Returned semantic references for shapes, events, outcomes, capabilities, lifecycles, and contexts across workspace files.
- Reused compiler workspace parsing, symbol resolution, source ranges, and semantic context rules to avoid textual reference search.
- Supported declaration inclusion through the LSP references context and returned empty results for unresolved or unreferenced symbols.
- Added tests for event, outcome, shape, cross-file, duplicate-context, no-reference, and server references request handling.

## 0.5.4

- Added experimental compiler-backed LSP Go To Definition through `textDocument/definition`.
- Supported definition navigation for shape, event, outcome, capability, context, and lifecycle references where compiler semantic data is available.
- Reused compiler workspace parsing, symbol resolution, source ranges, and semantic context rules for definition targets.
- Returned no result for unresolved symbols without surfacing protocol errors.
- Added tests for event, outcome, shape, cross-file, unresolved, duplicate-context, and server definition request handling.

## 0.5.3

- Added experimental compiler-backed LSP workspace symbols through `workspace/symbol`.
- Returned semantic DCL symbols across workspace files for contexts, capabilities, intents, outcomes, events, effects, policies, actors, lifecycles, lifecycle steps, and shapes.
- Added fuzzy and case-insensitive workspace symbol search for VS Code Ctrl+T and Go to Symbol in Workspace.
- Included compiler source locations, display containers, and semantic identity data for workspace symbol results.
- Added tests for empty, single-file, and multi-file workspaces, fuzzy and case-insensitive search, duplicate names in different contexts, source locations, and LSP workspace symbol requests.

## 0.5.2

- Added experimental compiler-backed LSP document symbols through `textDocument/documentSymbol`.
- Returned hierarchical DCL symbols for contexts, capabilities, intents, outcomes, events, effects, policies, actors, lifecycles, lifecycle steps, and shapes.
- Enabled VS Code Outline, breadcrumbs, and Ctrl+Shift+O support when the experimental language server is enabled.
- Reused compiler AST/source spans for document symbol locations without adding TypeScript-side parsing or duplicating compiler semantics.
- Added tests for capability hierarchy, contexts, lifecycles, nested symbols, empty documents, source ranges, and LSP document symbol requests.

## 0.5.1

- Added experimental compiler-backed diagnostics in `dcl-lsp`.
- Validated the DCL workspace on document open/save and debounced document changes.
- Published LSP `textDocument/publishDiagnostics` notifications for compiler errors and warnings, including empty diagnostics to clear fixed files.
- Added language-server validation status with diagnostics count and last validation timestamp.
- Disabled save-triggered extension-side diagnostics when the experimental language server is enabled, preserving the existing path when it is disabled.
- Added tests for diagnostic conversion, workspace validation, diagnostic publishing, debounced validation, clearing fixed diagnostics, and client validation status updates.

## 0.5.0

- Added the experimental `dcl-lsp` Go executable with stdio JSON-RPC/LSP lifecycle handling for `initialize`, `initialized`, `shutdown`, and `exit`.
- Added in-memory LSP workspace/document tracking for workspace folders and `didOpen`, `didChange`, `didSave`, and `didClose` document notifications.
- Added structured language-server logs for startup, initialization, document events, and shutdown.
- Added opt-in VS Code setting `dcl.languageServer.enabled`, disabled by default so existing compiler-backed extension behavior remains unchanged.
- Added `DCL Language Server` output channel and `DCL: Show Language Server Status`.
- Added tests for the LSP document store, workspace health/lifecycle tracking, protocol lifecycle, and VS Code language-server command resolution.

## 0.4.4

- Opened Graph Workspace in the active editor column instead of forcing a split editor.
- Reused the existing Graph Workspace panel on graph type, subject, and detail changes without revealing it beside the current editor.
- Made node selection update details only; source reveal now requires double-clicking a node or using the explicit `Open Source` details action.
- Improved initial graph fitting with more comfortable padding, a minimum useful initial zoom for small and medium graphs, and faster wheel zoom sensitivity while keeping zoom limits.
- Added regression tests for active-column panel creation, panel reuse, and explicit source navigation.

## 0.4.3

- Added Graph Workspace `Show in...` actions so selected semantic nodes can jump to the same element in another graph type.
- Used compiler-backed semantic identities to validate target graph availability instead of matching display labels.
- Preserved graph node source navigation while switching graph type, subject, and detail level before focusing the matching node.
- Added graph sync target availability tests for capability, event, context, lifecycle, and missing-target cases.

## 0.4.2

- Added `DCL: Navigate Symbol` for fuzzy semantic navigation across compiler-known contexts, capabilities, events, effects, policies, actors, lifecycles, and lifecycle steps.
- Added `DCL: Find Related Elements` with Quick Pick relationship discovery for capabilities, events, contexts, and lifecycles.
- Added `DCL: Open Semantic Inspector` for exact symbol details, source location, parent context, relationships, and graph availability.
- Reused semantic identities so selected navigation items reveal source and focus the open Graph Workspace where possible.
- Added semantic navigation model tests for symbol search, fuzzy matching, related discovery, and source/graph integration metadata.

## 0.4.1

- Added source-to-Graph Workspace highlighting from active `.dcl` editor selections.
- Added debounced cursor-follow behavior controlled by `dcl.graph.followSourceSelection`.
- Added compiler-summary source matching for capabilities, contexts, events, effects, policies, lifecycle items, and lifecycle transitions where source locations are available.
- Added most-specific semantic match selection for overlapping source ranges.
- Added source selection matching tests.

## 0.4.0

- Added shared semantic identities for Explorer items and graph nodes.
- Added Explorer selection and `DCL: Focus in Graph Workspace` support for focusing matching Graph Workspace nodes.
- Graph Workspace now accepts trusted extension-host focus requests, selects the matching node, centers it, and updates the details panel.
- Explorer selections can open or switch to the relevant existing graph type when the currently open graph cannot show the selected item.
- Added semantic identity matching tests.

## 0.3.16

- Hardened graph/source navigation so ambiguous basename-only compiler source paths fail gracefully instead of opening an arbitrary matching file.
- Stopped missing absolute compiler source paths from falling back to unrelated basename matches.
- Added regression tests for unique, ambiguous, and missing source path resolution.
- Re-ran compile, tests, lint, and VSIX package smoke for the hardening release.

## 0.3.15

- Hid empty synthetic `default`, `Workspace`, and `Uncontexted` contexts from context display data.
- Added a single `Workspace` fallback only when declarations have no context.
- Preserved real user-authored `default` contexts when they own capabilities, declarations, children, or dependencies.
- Applied context cleanup across DCL Explorer, Semantic Summary, Architecture Overview, Context Map, and Graph Workspace context selectors.
- Added regression tests for fallback context normalization and graph rendering.

## 0.3.14

- Changed compile-on-save to compile the DCL workspace by default so multi-file models resolve cross-file contexts and dependencies correctly.
- Added `dcl.compileOnSaveMode` with `workspace`, `file`, and `off` modes.
- Kept legacy `dcl.compileOnSave` compatibility when the new mode is not explicitly configured.
- Debounced workspace compile-on-save to avoid redundant compiles during rapid saves.
- Added status-bar feedback for workspace compile-on-save.
- Refreshed an open Graph Workspace after successful workspace compiles and cleared it on compile failure.
- Added compile-on-save mode and debounce tests.

## 0.3.13

- Added graph export controls to the Graph Workspace for SVG and PNG.
- Added `DCL: Export Current Graph` as a command-palette export entry point.
- Routed graph exports through the extension host and VS Code save dialog.
- Added client-side SVG serialization from current Cytoscape positions and PNG export from the current graph viewport.
- Added deterministic lowercase kebab-case export filenames based on graph type and subject.
- Added export filename and command contribution tests.

## 0.3.12

- Added `DCL: Open Graph Workspace` as a unified graph workbench.
- Added graph type and subject selection inside one WebView for architecture overview, capability, lifecycle, event flow, and context map graphs.
- Routed existing graph commands into the Graph Workspace as pre-selected shortcuts.
- Preserved graph controls, legends, node details, source navigation, architecture detail levels, and capability layout choices in the workspace.
- Added refresh and compile-workspace actions inside the graph workspace.
- Cleared the workspace graph on compile failure to avoid showing stale graph data.
- Added graph workspace state selection tests.

## 0.3.11

- Added bundled DCL compiler binary support for macOS arm64, macOS x64, Linux x64, and Windows x64.
- Updated compiler resolution to prefer `dcl.compilerPath`, then the matching bundled compiler, then `dcl` from PATH.
- Added `DCL: Show Compiler Info` for inspecting resolved compiler path, source, platform, architecture, and bundle availability.
- Improved compiler failure messages with attempted path, source, exit code, stderr/stdout detail, missing compiler handling, and invalid JSON handling.
- Updated package and release workflows to build and include platform-specific compiler binaries in the VSIX.
- Added compiler resolver unit tests.

## 0.3.10

- Added the current extension version near the top of the packaged README.
- Added shared graph label normalisation for CamelCase, snake_case, kebab-case, dotted names, and common acronym names.
- Preserved original graph node names in `sourceName` metadata and WebView details panels.
- Improved graph node text wrapping and node sizing across all graph views.
- Added website VSIX download/install copy for the VS Code extension and Marketplace status.
- Added a tag-triggered GitHub Release workflow for attaching VSIX assets without Marketplace publishing.
- Added tests for graph label normalisation and stable display-label/source-name behaviour.

## 0.3.9

- Cleaned the packaged README so the VS Code extension page is end-user focused.
- Moved contributor setup, development, packaging, and release notes into `DEVELOPMENT.md`.
- Added an extension icon and a minimal DCL file icon theme.
- Fixed architecture overview fallback grouping so explicit `default` contexts are respected and missing context data uses `Workspace`.
- Added min and max zoom limits across all graph WebViews.
- Added capability graph layout choices for default, layered, and radial views.
- Added architecture overview fallback context tests.
- Documented VSIX artifact distribution and noted that Marketplace publishing is planned later.

## 0.3.8

- Added `DCL: Show Architecture Overview` as the workspace-level starting graph.
- Added architecture overview graph model generation for overview, detailed, and full detail levels.
- Added architecture overview WebView detail selector, controls, legend, node details, empty states, and trusted graph-to-source navigation.
- Added DCL Explorer title/context entries for opening the architecture overview.
- Added architecture overview graph model tests.

## 0.3.7

- Added `DCL: Show Context Map` for compiler-provided contexts and explicit dependencies.
- Added context map graph model generation for context hierarchy, dependency edges, and missing context references.
- Added context map WebView controls, legend, node details, empty states, and trusted graph-to-source navigation.
- Added DCL Explorer context map entries for context nodes and the top-level Contexts section.
- Added context map graph model tests.

## 0.3.6

- Added `DCL: Show Event Flow Graph` for compiler-provided event emissions and references.
- Added event flow graph model generation for emitting capabilities, event nodes, lifecycle transitions, and lifecycle references.
- Added event flow WebView controls, legend, node details, empty states, and trusted graph-to-source navigation.
- Added DCL Explorer event flow entries for event nodes, event sections, and capabilities that emit events.
- Added event flow graph model tests for emitters, lifecycle event triggers, references, missing consumers, multiple events, missing sources, and incomplete summaries.

## 0.3.5

- Added `DCL: Show Lifecycle Graph` for compiler-provided capability lifecycles.
- Added lifecycle graph model generation for lifecycle roots, initial steps, ordinary steps, terminal steps, and transitions.
- Added lifecycle transition labels for outcome and event triggers, including source capability labels when available.
- Added lifecycle graph WebView controls, legend, node details, empty states, and trusted graph-to-source navigation.
- Added DCL Explorer lifecycle graph entries for lifecycle sections and lifecycle-capable capabilities.
- Added lifecycle graph model tests.

## 0.3.4

- Added capability graph controls for fit, reset layout, center capability, and switch capability.
- Added a graph legend and simple policy, lifecycle, and rule visibility filters.
- Shortened graph edge labels for readability while keeping relationship kinds stable.
- Added friendly empty states for missing summaries, missing selections, and capabilities without child semantic items.
- Added graph model tests for stable edge labels and optional node categories.

## 0.3.3

- Added graph node selection in the capability graph WebView.
- Added trusted graph-to-source navigation by resolving selected node ids in the extension host.
- Added selected-node styling and a node details panel with label, kind, and relationship summary.
- Kept source paths out of WebView selection messages.
- Added graph source metadata tests.

## 0.3.1

- Corrected the extension version line after the v0.3 graph foundation.
- Added CI coverage for building, testing, and packaging the VS Code extension.
- Added a downloadable VSIX artifact named from the extension package version.
- Kept marketplace publishing out of CI.

## 0.3.0

- Added `DCL: Show Capability Graph` for a read-only graph of one selected capability.
- Added a VS Code WebView panel backed by Cytoscape.
- Added a testable graph model layer for capability-centered nodes and semantic relationship edges.
- Added graph model unit tests.
- Updated packaging to include the Cytoscape browser bundle used by the WebView.

## 0.2.3

- Added Vitest unit test foundation with a mocked VS Code API.
- Added tests for compiler adapter behavior, diagnostics mapping, source-location normalization, semantic summary normalization, and explorer tree construction.
- Added `test` and `test:watch` npm scripts.
- Excluded test-only files from extension builds and VSIX packaging.

## 0.2.2

- Added packaging and contributor development hardening.
- Added VSCE packaging scripts and smoke test command.
- Added Extension Development Host launch configuration and recommended workspace settings.
- Added development guide for local build, run, compiler setup, fixtures, and VSIX packaging.
- Polished extension metadata for VS Code presentation.

## 0.2.1

- Hardened source-range normalization and source reveal behavior.
- Added explicit DCL Explorer empty and failure states.
- Added mocked compiler-output fixtures for source-location edge cases.
- Documented compiler source-location indexing semantics.

## 0.2.0

- Added the DCL Explorer Activity Bar view.
- Added capability-first semantic navigation for contexts, capabilities, actors, policies, effects, events, and lifecycles.
- Added source navigation for semantic items with compiler-provided locations.
- Added explorer refresh and compile workspace actions.

## 0.1.0

- Added `.dcl` language association, syntax highlighting, snippets, and language configuration.
- Added static hover help for DCL primitives.
- Added compiler-backed diagnostics, semantic summary, and formatting delegation.
- Added compiler path and compile-on-save settings.
