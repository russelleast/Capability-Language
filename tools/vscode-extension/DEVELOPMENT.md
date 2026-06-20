# DCL VS Code Extension Development

This document is for contributors working on the extension. The packaged README is intentionally end-user focused.

## Install Dependencies

```bash
cd tools/vscode-extension
npm install
```

## Build

```bash
npm run compile
```

For continuous TypeScript builds:

```bash
npm run watch
```

## Lint

The extension does not currently use a separate ESLint configuration. The `lint` script runs TypeScript in no-emit mode:

```bash
npm run lint
```

## Test

Unit tests use Vitest with a mocked `vscode` module. They do not require the real DCL compiler binary.

```bash
npm test
```

For watch mode:

```bash
npm run test:watch
```

## Run Locally

Open `tools/vscode-extension` in VS Code, then use the `Run DCL Extension` launch configuration. This starts an Extension Development Host with the local extension loaded.

The packaged extension defaults to the bundled compiler for supported platforms. During local development, configure `dcl.compilerPath` when you want to use a specific compiler build:

```json
{
  "dcl.compilerPath": "dcl"
}
```

or another fixed compiler command prefix such as:

```json
{
  "dcl.compilerPath": "go run ./cmd/dcl"
}
```

## Test The Experimental Language Server Locally

The language server is disabled by default. To test it in an Extension Development Host, first build a local LSP binary into the extension `bin/` directory:

```bash
cd tools/vscode-extension
npm run build:lsp
```

This writes `bin/dcl-lsp` on macOS/Linux or `bin/dcl-lsp.exe` on Windows. When `dcl.languageServer.enabled` is `true`, the development host prefers that local binary before platform-specific packaged binaries or PATH fallback.

Use these settings in the Extension Development Host:

```json
{
  "dcl.languageServer.enabled": true
}
```

You can override resolution explicitly:

```json
{
  "dcl.languageServer.enabled": true,
  "dcl.languageServer.path": "/absolute/path/to/dcl-lsp"
}
```

If startup fails with `spawn dcl-lsp ENOENT`, run `npm run build:lsp` or set `dcl.languageServer.path`. Inspect `DCL: Show Language Server Status` and the `DCL Language Server` output channel for the attempted command, source, and last error.

The output channel hides raw LSP framing by default. To debug protocol traffic, set:

```json
{
  "dcl.languageServer.trace": "messages"
}
```

Use `verbose` only when you need framed `Content-Length` protocol output.

## Test With Fixtures

Open files under `test-fixtures/` in the Extension Development Host.

Useful checks:

- Open `valid-basic.dcl`, run `DCL: Compile Current File`, and confirm no Problems remain.
- Open `invalid-diagnostic.dcl`, run `DCL: Compile Current File`, and confirm compiler diagnostics appear.
- With `dcl.languageServer.enabled` set to `true`, open a `.dcl` file and confirm Problems update from LSP diagnostics, Outline shows DCL semantic symbols, breadcrumbs populate, Ctrl+Shift+O lists capabilities and nested members, Ctrl+T searches workspace DCL symbols, and F12/Ctrl+Click navigates supported references to their definitions.
- Run `DCL: Compile Workspace` against the fixture workspace and confirm the DCL Explorer updates.
- Inspect mocked compiler output fixtures under `test-fixtures/compiler-output/` when changing summary normalization or source-location handling.

## Package VSIX

```bash
npm run package
```

For a packaging smoke test that writes outside the repo:

```bash
npm run package:smoke
```

The package command uses `vsce package`. The `vscode:prepublish` script copies the Cytoscape browser bundle into `media/` and compiles TypeScript before packaging.

## Build Output Policy

VS Code packages JavaScript from `out/`, so compiled output is intentionally included in the VSIX. TypeScript source, source maps, local fixtures, local VS Code config, dependency folders, docs, tests, generated VSIX files, and this development guide are excluded by `.vscodeignore`.

Packaged runtime assets include:

- `bin/dcl-darwin-arm64`
- `bin/dcl-darwin-x64`
- `bin/dcl-linux-x64`
- `bin/dcl-win32-x64.exe`
- `bin/dcl-lsp-darwin-arm64`
- `bin/dcl-lsp-darwin-x64`
- `bin/dcl-lsp-linux-x64`
- `bin/dcl-lsp-win32-x64.exe`
- `media/cytoscape.min.js`
- `syntaxes/`
- `snippets/`
- `resources/dcl.svg`
- `resources/dcl-extension.png`
- `resources/dcl-extension.svg`
- `resources/dcl-file.svg`
- `resources/dcl-file-theme.json`

## Release Notes

For each extension release:

1. Update `package.json` version.
2. Update `CHANGELOG.md`.
3. Keep `readme.md` end-user focused.
4. Move contributor setup, test, and packaging notes here.
5. Run `npm run lint`, `npm test`, and `npm run package:smoke`.

## GitHub Release VSIX

Marketplace publishing is not implemented yet. Until then, the recommended distribution path is:

1. Update `tools/vscode-extension/package.json`.
2. Update `tools/vscode-extension/CHANGELOG.md`.
3. Run `npm run package:smoke`.
4. Push a tag named `vscode-extension-v0.3.x`.
5. The `Release VS Code Extension` workflow packages the VSIX and attaches it to the GitHub Release.
6. The website download link targets the latest release asset named `dcl-vscode-extension-v0.3.x.vsix`.

Do not add personal access tokens, publisher secrets, or Marketplace credentials to the repository.

## GitHub Actions Artifact

CI already packages a VSIX artifact for successful workflow runs. Users can download the artifact from GitHub Actions and install it with `Extensions: Install from VSIX...`.

## Future Marketplace Publishing

Marketplace publishing can be added later with an explicit release workflow. Keep that work separate from normal graph and extension feature work.

Before adding Marketplace automation:

- choose and verify the publisher identity
- store publishing tokens only as GitHub Actions secrets
- keep manual release testing with `npm run package:smoke`
- document Marketplace installation separately from VSIX installation

## Architecture Boundaries

The extension does not parse DCL in TypeScript. Compiler CLI JSON and diagnostics remain authoritative.

The graph builders are pure, testable model generation layers built from compiler semantic summary data. Cytoscape-specific logic belongs in WebView panel files only.

Current graph types are:

- Architecture Overview
- Capability Graph
- Lifecycle Graph
- Event Flow Graph
- Context Map

Do not add source-text inference, folder-based architecture inference, an LSP, deployment diagrams, service diagrams, or full bidirectional source/graph syncing unless a future release explicitly scopes that work.
