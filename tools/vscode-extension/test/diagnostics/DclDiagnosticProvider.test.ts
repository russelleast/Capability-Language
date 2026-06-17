import { describe, expect, it } from "vitest";
import { DiagnosticSeverity, Uri } from "vscode";
import { toVsCodeDiagnostic, uriForDiagnostic } from "../../src/diagnostics/DclDiagnosticProvider";

describe("diagnostics mapping", () => {
  it.each([
    ["error", DiagnosticSeverity.Error],
    ["warning", DiagnosticSeverity.Warning],
    ["info", DiagnosticSeverity.Information],
  ] as const)("maps %s severity", (severity, expected) => {
    const diagnostic = toVsCodeDiagnostic({
      severity,
      code: "DCL_TEST",
      message: "message",
      span: { file: "/tmp/a.dcl", line: 2, column: 4 },
    });

    expect(diagnostic.severity).toBe(expected);
    expect(diagnostic.range.start.line).toBe(1);
    expect(diagnostic.range.start.character).toBe(3);
    expect(diagnostic.message).toBe("DCL_TEST: message");
  });

  it("uses the fallback file when a diagnostic has no source range", () => {
    const fallback = Uri.file("/workspace/main.dcl");
    const uri = uriForDiagnostic({ severity: "error", message: "missing" }, new Map([[fallback.fsPath, fallback]]), [fallback]);
    expect(uri?.fsPath).toBe(fallback.fsPath);
  });

  it("matches relative diagnostic paths to known files", () => {
    const file = Uri.file("/repo/tools/vscode-extension/test-fixtures/valid-basic.dcl");
    const uri = uriForDiagnostic(
      { severity: "warning", message: "relative", span: { file: "../tools/vscode-extension/test-fixtures/valid-basic.dcl" } },
      new Map([[file.fsPath, file]]),
      [file],
    );
    expect(uri?.fsPath).toBe(file.fsPath);
  });

  it("uses absolute diagnostic paths directly", () => {
    const uri = uriForDiagnostic(
      { severity: "info", message: "absolute", span: { file: "/tmp/absolute.dcl" } },
      new Map(),
      [],
    );
    expect(uri?.fsPath).toBe("/tmp/absolute.dcl");
  });
});
