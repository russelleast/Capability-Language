# DCL VS Code Extension Development

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

Unit tests use Vitest with a small mocked `vscode` module. They do not require the real DCL compiler binary.

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

## Build Output Policy

VS Code packages JavaScript from `out/`, so compiled output is intentionally included in the VSIX. TypeScript source, source maps, local fixtures, local VS Code config, and dependency folders are excluded by `.vscodeignore`.

The v0.3.1 capability graph WebView loads Cytoscape from the packaged extension. `npm run copy:vendor` copies `node_modules/cytoscape/dist/cytoscape.min.js` to `media/cytoscape.min.js`, and dependency folders remain excluded from the VSIX.

## Architecture Boundaries

The extension does not parse DCL in TypeScript. Compiler CLI JSON and diagnostics remain authoritative.

The v0.3.1 graph slice is intentionally narrow: one read-only capability graph built from compiler semantic summary data. Do not add additional graph types, bidirectional source/graph navigation, source parsing, or an LSP in this slice.
