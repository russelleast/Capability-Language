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

The extension defaults to the repository compiler when the repository layout is available. Outside this repository, configure:

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

## Test With Fixtures

Open files under `test-fixtures/` in the Extension Development Host.

Useful checks:

- Open `valid-basic.dcl`, run `DCL: Compile Current File`, and confirm no Problems remain.
- Open `invalid-diagnostic.dcl`, run `DCL: Compile Current File`, and confirm compiler diagnostics appear.
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

1. Build the VSIX with `npm run package`.
2. Create or open the matching GitHub Release.
3. Attach the generated `.vsix` as a release asset.
4. Link the release asset from the project website or release notes.

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
