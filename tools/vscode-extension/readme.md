# Declarative Capability Language VS Code Extension

VS Code support for `.dcl` files.

## Features

- `.dcl` language association
- TextMate syntax highlighting
- language configuration for comments, braces, and indentation
- snippets for core DCL declarations
- static hover help for core primitives
- compiler-backed diagnostics
- compiler-backed semantic summary tree
- commands for compiling files, compiling workspaces, showing summaries, and formatting

The extension does not implement a parser and does not duplicate compiler semantics. Diagnostics, formatting, and semantic summary data are delegated to the configured DCL compiler.

## Settings

- `dcl.compilerPath`: path to the DCL compiler executable. Leave empty to use the repository compiler through `go run ./cmd/dcl` when available, otherwise `dcl` on PATH.
- `dcl.compileOnSave`: compile saved `.dcl` files and update Problems.

## Commands

- `DCL: Compile Current File`
- `DCL: Compile Workspace`
- `DCL: Show Semantic Summary`
- `DCL: Format Document`

Formatting requires a compiler command that supports `format <file>`. If the configured compiler does not provide that command, the extension reports that clearly and leaves the document unchanged.
