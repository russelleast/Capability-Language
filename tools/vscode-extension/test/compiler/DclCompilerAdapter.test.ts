import { describe, expect, it } from "vitest";
import { Uri } from "vscode";
import { DclCompilerAdapter, DclCompilerError, DclCompilerRunResult } from "../../src/compiler/DclCompilerAdapter";

function adapter(result: DclCompilerRunResult | Promise<DclCompilerRunResult>) {
  return new DclCompilerAdapter(undefined, {
    compilerPath: "dcl",
    runner: async () => result,
  });
}

describe("DclCompilerAdapter", () => {
  const file = Uri.file("/tmp/example.dcl");

  it("returns compiler IR and diagnostics from valid JSON output", async () => {
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

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ severity: "warning", code: "DCL_WARN" });
  });

  it("throws a clear error for invalid JSON from a successful compiler run", async () => {
    const compiler = adapter({ exitCode: 0, stdout: "not json", stderr: "" });

    await expect(compiler.compileFiles([file])).rejects.toThrow(/DCL compiler returned invalid JSON[\s\S]*Compiler: dcl/);
  });

  it("surfaces missing compiler failures", async () => {
    const compiler = new DclCompilerAdapter(undefined, {
      compilerPath: "missing-dcl",
      runner: async () => {
        throw new DclCompilerError("Unable to run DCL compiler 'missing-dcl': spawn ENOENT");
      },
    });

    await expect(compiler.compileFiles([file])).rejects.toThrow(/Unable to run DCL compiler/);
  });

  it("maps non-zero compiler human diagnostics", async () => {
    const compiler = adapter({
      exitCode: 1,
      stdout: "",
      stderr: "/tmp/example.dcl:4:5 error DCL_BAD: broken\n",
    });

    const result = await compiler.compileFiles([file]);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      {
        code: "DCL_BAD",
        severity: "error",
        message: "broken",
        span: { file: "/tmp/example.dcl", line: 4, column: 5 },
        node: undefined,
      },
    ]);
  });

  it("throws when the compiler exits non-zero with empty output", async () => {
    const compiler = adapter({ exitCode: 1, stdout: "", stderr: "" });

    await expect(compiler.compileFiles([file])).rejects.toThrow(/failed before producing diagnostics[\s\S]*Exit code: 1/);
  });

  it("includes stderr in non-diagnostic compiler failures", async () => {
    const compiler = adapter({ exitCode: 2, stdout: "", stderr: "panic: bad things" });

    await expect(compiler.compileFiles([file])).rejects.toThrow(/stderr: panic: bad things/);
  });
});
