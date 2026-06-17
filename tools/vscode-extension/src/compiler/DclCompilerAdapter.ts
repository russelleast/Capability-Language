import * as childProcess from "child_process";
import * as path from "path";
import * as vscode from "vscode";

export type DclDiagnosticSeverity = "error" | "warning" | "info";

export interface DclDiagnostic {
  code?: string;
  severity: DclDiagnosticSeverity;
  message: string;
  span?: {
    file?: string;
    line?: number;
    column?: number;
  };
  node?: string;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: DclDiagnostic[];
  ir?: unknown;
  stdout: string;
  stderr: string;
}

interface CommandSpec {
  command: string;
  args: string[];
  cwd?: string;
}

export class DclCompilerError extends Error {
  constructor(
    message: string,
    readonly stdout = "",
    readonly stderr = "",
  ) {
    super(message);
  }
}

export class DclCompilerAdapter {
  constructor(private readonly workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined) {}

  async compileFiles(files: vscode.Uri[]): Promise<CompileResult> {
    if (files.length === 0) {
      return { ok: true, diagnostics: [], stdout: "", stderr: "" };
    }

    const irRun = await this.runCompiler(["ir", ...files.map((file) => file.fsPath), "--format", "json"]);
    const ir = parseJson(irRun.stdout);
    if (irRun.exitCode === 0 && ir !== undefined) {
      return {
        ok: true,
        diagnostics: diagnosticsFromIr(ir),
        ir,
        stdout: irRun.stdout,
        stderr: irRun.stderr,
      };
    }

    const diagnostics = parseHumanDiagnostics(irRun.stderr || irRun.stdout);
    return {
      ok: false,
      diagnostics,
      stdout: irRun.stdout,
      stderr: irRun.stderr,
    };
  }

  async formatFile(file: vscode.Uri): Promise<string> {
    const run = await this.runCompiler(["format", file.fsPath]);
    if (run.exitCode === 0) {
      return run.stdout;
    }

    const detail = (run.stderr || run.stdout).trim();
    throw new DclCompilerError(
      detail
        ? `DCL formatter failed: ${detail}`
        : "DCL formatter is not available from the configured compiler.",
      run.stdout,
      run.stderr,
    );
  }

  private runCompiler(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    const spec = this.compilerCommand();
    return new Promise((resolve, reject) => {
      const child = childProcess.execFile(spec.command, [...spec.args, ...args], { cwd: spec.cwd }, (error, stdout, stderr) => {
        const exitCode = typeof (error as childProcess.ExecFileException | null)?.code === "number"
          ? ((error as childProcess.ExecFileException).code as number)
          : error
            ? 1
            : 0;
        resolve({ exitCode, stdout, stderr });
      });

      child.on("error", (error) => {
        reject(new DclCompilerError(`Unable to run DCL compiler '${spec.command}': ${error.message}`));
      });
    });
  }

  private compilerCommand(): CommandSpec {
    const configured = vscode.workspace.getConfiguration("dcl").get<string>("compilerPath", "").trim();
    if (configured) {
      const [command, ...args] = splitCommand(configured);
      return { command, args, cwd: this.workspaceRoot() };
    }

    const compilerRoot = this.defaultCompilerRoot();
    if (compilerRoot) {
      return { command: "go", args: ["run", "./cmd/dcl"], cwd: compilerRoot };
    }

    return { command: "dcl", args: [], cwd: this.workspaceRoot() };
  }

  private defaultCompilerRoot(): string | undefined {
    for (const folder of this.workspaceFolders ?? []) {
      const candidate = path.join(folder.uri.fsPath, "compiler");
      try {
        const stat = require("fs").statSync(path.join(candidate, "cmd", "dcl", "main.go"));
        if (stat.isFile()) return candidate;
      } catch {
        // Keep looking; absence just means this is not the source workspace.
      }
    }
    return undefined;
  }

  private workspaceRoot(): string | undefined {
    return this.workspaceFolders?.[0]?.uri.fsPath;
  }
}

function diagnosticsFromIr(ir: unknown): DclDiagnostic[] {
  if (!isRecord(ir) || !Array.isArray(ir.diagnostics)) return [];
  return ir.diagnostics.flatMap((item) => normalizeDiagnostic(item));
}

function normalizeDiagnostic(item: unknown): DclDiagnostic[] {
  if (!isRecord(item)) return [];
  const severity = item.severity === "error" || item.severity === "warning" || item.severity === "info" ? item.severity : "info";
  const message = typeof item.message === "string" ? item.message : undefined;
  if (!message) return [];
  const span = isRecord(item.span) ? item.span : undefined;
  return [{
    code: typeof item.code === "string" ? item.code : undefined,
    severity,
    message,
    span: span
      ? {
        file: typeof span.file === "string" ? span.file : undefined,
        line: typeof span.line === "number" ? span.line : undefined,
        column: typeof span.column === "number" ? span.column : undefined,
      }
      : undefined,
    node: typeof item.node === "string" ? item.node : undefined,
  }];
}

function parseHumanDiagnostics(output: string): DclDiagnostic[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = /^(.*?)(?::(\d+):(\d+))?\s+(error|warning|info)\s+([A-Z0-9_]+):\s+(.*?)(?:\s+\(([^)]+)\))?$/.exec(line);
      if (!match) return [];
      const [, file, lineNumber, column, severity, code, message, node] = match;
      return [{
        code,
        severity: severity as DclDiagnosticSeverity,
        message,
        span: {
          file: file === "-" ? undefined : file,
          line: lineNumber ? Number(lineNumber) : undefined,
          column: column ? Number(column) : undefined,
        },
        node,
      }];
    });
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    return undefined;
  }
}

function splitCommand(commandLine: string): string[] {
  const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
