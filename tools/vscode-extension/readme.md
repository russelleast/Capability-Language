# Declarative Capability Language for VS Code

This extension provides v0.1 editor support for Declarative Capability Language (`.dcl`) files.

The extension is intentionally thin. It does not implement a parser, duplicate compiler semantics, infer semantic validity, run a language server, or render graphs. The DCL compiler CLI is the source of truth for diagnostics, formatting, and semantic summary data.

## Features

- `.dcl` file association and activation
- TextMate syntax highlighting for DCL declarations, keywords, blocks, comments, strings, numbers, and common scalar types
- Language configuration for braces, comments, folding markers, and indentation
- Snippets for `capability`, `actor`, `shape`, `event`, `effect`, `policy`, `when`, and `lifecycle`
- Static hover help for core DCL primitives
- Compiler-backed diagnostics in VS Code Problems
- Compiler-backed semantic summary tree
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

## Commands

- `DCL: Compile Current File`: runs the compiler for the active `.dcl` file and publishes diagnostics.
- `DCL: Compile Workspace`: finds workspace `.dcl` files and compiles them together.
- `DCL: Show Semantic Summary`: compiles the active `.dcl` file and focuses the semantic summary tree.
- `DCL: Format Document`: delegates formatting to the compiler.

## Settings

- `dcl.compilerPath`: path or command prefix for the DCL compiler. Leave empty to use the repository compiler when available, otherwise `dcl` on `PATH`.
- `dcl.compileOnSave`: when enabled, saved `.dcl` files are compiled and Problems are refreshed. Non-DCL files are ignored.

## Error Handling

If the compiler is missing, exits unexpectedly, returns invalid JSON for `ir --format json`, or does not support formatting, the extension reports a clear VS Code message and leaves the document unchanged.

Diagnostics are cleared for files that become valid after a successful compile.

## Roadmap

v0.1 is the foundation release:

- compiler-backed diagnostics
- compiler-backed formatting hook
- compiler-backed summary tree
- language basics for editing `.dcl`

Deferred beyond v0.1:

- v0.2 Capability Explorer
- richer navigation and source linking
- compiler-provided quick fixes
- optional language server, if the project chooses that architecture later

Graph visualisation, Cytoscape, WebViews, and service/workflow/BPMN-oriented views are not part of v0.1.
