"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const vscode_1 = require("vscode");
const DclDiagnosticProvider_1 = require("../../src/diagnostics/DclDiagnosticProvider");
(0, vitest_1.describe)("diagnostics mapping", () => {
    vitest_1.it.each([
        ["error", vscode_1.DiagnosticSeverity.Error],
        ["warning", vscode_1.DiagnosticSeverity.Warning],
        ["info", vscode_1.DiagnosticSeverity.Information],
    ])("maps %s severity", (severity, expected) => {
        const diagnostic = (0, DclDiagnosticProvider_1.toVsCodeDiagnostic)({
            severity,
            code: "DCL_TEST",
            message: "message",
            span: { file: "/tmp/a.dcl", line: 2, column: 4 },
        });
        (0, vitest_1.expect)(diagnostic.severity).toBe(expected);
        (0, vitest_1.expect)(diagnostic.range.start.line).toBe(1);
        (0, vitest_1.expect)(diagnostic.range.start.character).toBe(3);
        (0, vitest_1.expect)(diagnostic.message).toBe("DCL_TEST: message");
    });
    (0, vitest_1.it)("uses the fallback file when a diagnostic has no source range", () => {
        const fallback = vscode_1.Uri.file("/workspace/main.dcl");
        const uri = (0, DclDiagnosticProvider_1.uriForDiagnostic)({ severity: "error", message: "missing" }, new Map([[fallback.fsPath, fallback]]), [fallback]);
        (0, vitest_1.expect)(uri?.fsPath).toBe(fallback.fsPath);
    });
    (0, vitest_1.it)("matches relative diagnostic paths to known files", () => {
        const file = vscode_1.Uri.file("/repo/tools/vscode-extension/test-fixtures/valid-basic.dcl");
        const uri = (0, DclDiagnosticProvider_1.uriForDiagnostic)({ severity: "warning", message: "relative", span: { file: "../tools/vscode-extension/test-fixtures/valid-basic.dcl" } }, new Map([[file.fsPath, file]]), [file]);
        (0, vitest_1.expect)(uri?.fsPath).toBe(file.fsPath);
    });
    (0, vitest_1.it)("uses absolute diagnostic paths directly", () => {
        const uri = (0, DclDiagnosticProvider_1.uriForDiagnostic)({ severity: "info", message: "absolute", span: { file: "/tmp/absolute.dcl" } }, new Map(), []);
        (0, vitest_1.expect)(uri?.fsPath).toBe("/tmp/absolute.dcl");
    });
});
//# sourceMappingURL=DclDiagnosticProvider.test.js.map