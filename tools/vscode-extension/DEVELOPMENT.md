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
- With `dcl.languageServer.enabled` set to `true`, open a `.dcl` file and confirm Problems update from LSP diagnostics, Outline shows DCL semantic symbols, breadcrumbs populate, Ctrl+Shift+O lists capabilities and nested members, Ctrl+T searches workspace DCL symbols, F12/Ctrl+Click navigates supported references to their definitions, and Shift+F12 lists semantic references.
- Run `DCL: Inspect Symbol At Cursor` on a referenced event, shape, or outcome to verify token text, semantic identity, definition location, and reference count.
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
3. Ensure Marketplace screenshots are committed under `tools/vscode-extension/images/`.
4. Keep `README.md` end-user focused.
5. Move contributor setup, test, and packaging notes here.
6. Run `npm run lint`, `npm test`, and `npm run package:smoke`.

## Marketplace Release

The VS Code Marketplace release workflow publishes only from explicit extension version tags. It does not publish from pushes to `main` or pull requests.

1. Update `tools/vscode-extension/package.json`.
2. Update `tools/vscode-extension/CHANGELOG.md`.
3. Ensure the four Marketplace screenshots are present:
   - `tools/vscode-extension/images/dcl-authoring.png`
   - `tools/vscode-extension/images/dcl-explorer.png`
   - `tools/vscode-extension/images/architecture-overview.png`
   - `tools/vscode-extension/images/event-flow-or-lifecycle.png`
4. Commit the release changes and merge them to `main`.
5. Run `npm run lint`, `npm test`, and `npm run package:smoke`.
6. Package the VSIX locally if desired with `npm run package`.
7. Create and push the release tag:

```bash
git tag vscode-extension-v1.0.1
git push origin vscode-extension-v1.0.1
```

8. Confirm GitHub Actions publishes the Marketplace extension using `VSCE_PAT`.
9. Confirm the GitHub Release contains `dcl-vscode-extension-v1.0.1.vsix`.
10. Download and install the VSIX if release verification needs a manual package check.
11. Uninstall any local VSIX build from VS Code.
12. Install the extension from the VS Code Marketplace.
13. Verify the extension version in VS Code is `1.0.1`.
14. Verify the website Marketplace and VSIX links.

The release tag convention is `vscode-extension-vX.Y.Z`, for example `vscode-extension-v1.0.1`. This keeps extension releases distinct from language, compiler, and website tags in the monorepo.

Required GitHub Actions secret:

- `VSCE_PAT`: a VS Code Marketplace publishing token for the configured publisher.

Create the Marketplace publishing token in the Visual Studio Marketplace publisher management area, grant it permission to publish extensions for the DCL publisher, then store it as a repository or environment secret named `VSCE_PAT`. Never commit publishing tokens, publisher secrets, or Marketplace credentials to the repository.

The publish workflow also supports manual `workflow_dispatch`. Manual runs require typing `publish-vscode-extension` into the confirmation input.

## GitHub Release VSIX

The GitHub Release VSIX flow remains available for website downloads and manual installs:

1. Push a tag named `vscode-extension-vX.Y.Z`.
2. The `Release VS Code Extension` workflow packages the VSIX and attaches it to the GitHub Release.
3. The website download link targets the latest release asset named `dcl-vscode-extension-vX.Y.Z.vsix`.

Do not add personal access tokens, publisher secrets, or Marketplace credentials to the repository.

## GitHub Actions Artifact

CI already packages a VSIX artifact for successful workflow runs. Users can download the artifact from GitHub Actions and install it with `Extensions: Install from VSIX...`.

## Future Marketplace Publishing

Marketplace automation now lives in `.github/workflows/vscode-extension-publish.yml`. Keep release automation changes separate from normal graph and extension feature work, and continue to store publishing credentials only as GitHub Actions secrets.

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
