# Changelog

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
