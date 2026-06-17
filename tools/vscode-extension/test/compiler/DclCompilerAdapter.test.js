"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const vscode_1 = require("vscode");
const DclCompilerAdapter_1 = require("../../src/compiler/DclCompilerAdapter");
function adapter(result) {
    return new DclCompilerAdapter_1.DclCompilerAdapter(undefined, {
        compilerPath: "dcl",
        runner: async () => result,
    });
}
(0, vitest_1.describe)("DclCompilerAdapter", () => {
    const file = vscode_1.Uri.file("/tmp/example.dcl");
    (0, vitest_1.it)("returns compiler IR and diagnostics from valid JSON output", async () => {
        const compiler = adapter({
            exitCode: 0,
            stdout: JSON.stringify({
                diagnostics: [
                    { severity: "warning", code: "DCL_WARN", message: "careful", span: { file: "/tmp/example.dcl", line: 2, column: 3 } },
                ],
            }),
            stderr: "",
        });
        const result = await compiler.compileFiles([file]);
        (0, vitest_1.expect)(result.ok).toBe(true);
        (0, vitest_1.expect)(result.diagnostics).toHaveLength(1);
        (0, vitest_1.expect)(result.diagnostics[0]).toMatchObject({ severity: "warning", code: "DCL_WARN" });
    });
    (0, vitest_1.it)("throws a clear error for invalid JSON from a successful compiler run", async () => {
        const compiler = adapter({ exitCode: 0, stdout: "not json", stderr: "" });
        await (0, vitest_1.expect)(compiler.compileFiles([file])).rejects.toThrow(/invalid JSON/);
    });
    (0, vitest_1.it)("surfaces missing compiler failures", async () => {
        const compiler = new DclCompilerAdapter_1.DclCompilerAdapter(undefined, {
            compilerPath: "missing-dcl",
            runner: async () => {
                throw new DclCompilerAdapter_1.DclCompilerError("Unable to run DCL compiler 'missing-dcl': spawn ENOENT");
            },
        });
        await (0, vitest_1.expect)(compiler.compileFiles([file])).rejects.toThrow(/Unable to run DCL compiler/);
    });
    (0, vitest_1.it)("maps non-zero compiler human diagnostics", async () => {
        const compiler = adapter({
            exitCode: 1,
            stdout: "",
            stderr: "/tmp/example.dcl:4:5 error DCL_BAD: broken\n",
        });
        const result = await compiler.compileFiles([file]);
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.diagnostics).toEqual([
            {
                code: "DCL_BAD",
                severity: "error",
                message: "broken",
                span: { file: "/tmp/example.dcl", line: 4, column: 5 },
                node: undefined,
            },
        ]);
    });
    (0, vitest_1.it)("throws when the compiler exits non-zero with empty output", async () => {
        const compiler = adapter({ exitCode: 1, stdout: "", stderr: "" });
        await (0, vitest_1.expect)(compiler.compileFiles([file])).rejects.toThrow(/without returning diagnostics/);
    });
});
//# sourceMappingURL=DclCompilerAdapter.test.js.map