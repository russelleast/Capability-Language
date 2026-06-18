# Changelog

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
