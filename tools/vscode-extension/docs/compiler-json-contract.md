# DCL Compiler JSON Contract

The VS Code extension treats compiler output as authoritative. It does not parse DCL source and does not infer semantic validity.

## Commands

The extension expects a compatible compiler command prefix from `dcl.compilerPath`, or the repository-local fallback:

```bash
go run ./cmd/dcl
```

The extension appends subcommands and file paths to that prefix.

## Diagnostics and Summary

For compile and summary operations, the extension runs:

```bash
dcl ir <files...> --format json
```

On success, stdout must be a JSON object representing the compiler IR. The extension currently reads these fields when present:

- `diagnostics`
- `contexts`
- `capabilities`
- `actors`
- `policies`
- `effects`
- `events`
- `effective_policies`

Diagnostics are expected to use the compiler diagnostic shape:

```json
{
  "code": "DCL_EXAMPLE",
  "severity": "error",
  "message": "Explanation",
  "span": {
    "file": "example.dcl",
    "line": 1,
    "column": 1
  },
  "node": "OptionalNode"
}
```

`severity` may be `error`, `warning`, or `info`.

## Source Location Semantics

The extension expects compiler source locations to use 1-based indexing:

- `line: 1` means the first line in the file.
- `column: 1` means the first character in the line.

This applies to diagnostic `span` values, symbol `declared` strings, and semantic summary source locations such as `effective_policies[].source_locations[]`.

The extension normalizes source locations before use and rejects malformed locations defensively. The following cases must not crash the extension:

- missing `file`
- missing or non-integer `line`
- missing `column`, which is treated as column 1
- line or column before the start of the file
- line or column beyond the opened document
- deleted files
- relative file paths
- absolute file paths

The internal source-location utility can also normalize explicit 0-based locations for tests or future adapters, but compiler JSON produced by `dcl ir --format json` should remain 1-based unless this contract is revised.

If the compiler exits non-zero, the extension falls back to parsing the current human diagnostic format:

```text
file.dcl:1:1 error DCL_CODE: message
```

This fallback is only for surfacing compiler diagnostics; it is not a semantic parser.

## Formatting

For formatting, the extension runs:

```bash
dcl format <file>
```

The expected successful response is the complete formatted document on stdout.

If the command is unavailable or exits non-zero, the extension shows a warning and returns no edits.

## Invalid Output

If `ir --format json` exits successfully but stdout is not valid JSON, the extension reports an error:

```text
DCL compiler returned invalid JSON for 'ir --format json'.
```

The summary tree is not updated from invalid output.
