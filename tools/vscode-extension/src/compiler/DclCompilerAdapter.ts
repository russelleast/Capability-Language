import * as childProcess from "child_process";
import * as fs from "fs";
import * as vscode from "vscode";
import { DclCompilerCommand, DclCompilerInfo, getDclCompilerInfo, resolveDclCompiler } from "./DclCompilerResolver";

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

export type DclCompilerRunResult = { exitCode: number | null; stdout: string; stderr: string };
export type DclCompilerRunner = (spec: DclCompilerCommand, args: string[]) => Promise<DclCompilerRunResult>;

export type DclCompilerAdapterOptions = {
  compilerPath?: string;
  extensionPath?: string;
  runner?: DclCompilerRunner;
};

export class DclCompilerError extends Error {
  constructor(
    message: string,
    readonly stdout = "",
    readonly stderr = "",
    readonly compilerPath?: string,
    readonly exitCode?: number | null,
  ) {
    super(message);
  }
}

export class DclCompilerAdapter {
  constructor(
    private readonly workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
    private readonly options: DclCompilerAdapterOptions = {},
  ) {}

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

    if (irRun.exitCode === 0) {
      throw new DclCompilerError(
        compilerRunMessage("DCL compiler returned invalid JSON", this.compilerCommand(), irRun),
        irRun.stdout,
        irRun.stderr,
        this.compilerCommand().command,
        irRun.exitCode,
      );
    }

    const diagnostics = parseHumanDiagnostics(`${irRun.stderr}\n${irRun.stdout}`);
    if (diagnostics.length === 0) {
      const detail = (irRun.stderr || irRun.stdout).trim();
      throw new DclCompilerError(
        compilerRunMessage("DCL compiler failed before producing diagnostics", this.compilerCommand(), irRun, detail),
        irRun.stdout,
        irRun.stderr,
        this.compilerCommand().command,
        irRun.exitCode,
      );
    }

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
        ? compilerRunMessage("DCL formatter failed", this.compilerCommand(), run, detail)
        : compilerRunMessage("DCL formatter failed before producing output", this.compilerCommand(), run),
      run.stdout,
      run.stderr,
      this.compilerCommand().command,
      run.exitCode,
    );
  }

  private runCompiler(args: string[]): Promise<DclCompilerRunResult> {
    const spec = this.compilerCommand();
    if (this.options.runner) {
      return this.options.runner(spec, args);
    }
    ensureExecutable(spec);
    return new Promise((resolve, reject) => {
      const child = childProcess.execFile(spec.command, [...spec.args, ...args], { cwd: spec.cwd }, (error, stdout, stderr) => {
        const execError = error as childProcess.ExecFileException | null;
        if (execError?.code === "ENOENT") {
          reject(new DclCompilerError(
            compilerMissingMessage(spec),
            stdout,
            stderr,
            spec.command,
            null,
          ));
          return;
        }
        const exitCode = typeof execError?.code === "number"
          ? (execError.code as number)
          : error
            ? 1
            : 0;
        resolve({ exitCode, stdout, stderr });
      });

      child.on("error", (error) => {
        reject(new DclCompilerError(
          `DCL compiler was not found or could not be started.\nCompiler: ${spec.command}\nSource: ${spec.source}\nError: ${error.message}`,
          "",
          "",
          spec.command,
          null,
        ));
      });
    });
  }

  compilerInfo(): DclCompilerInfo {
    return getDclCompilerInfo({
      configuredCompilerPath: this.options.compilerPath ?? vscode.workspace.getConfiguration("dcl").get<string>("compilerPath", ""),
      extensionPath: this.options.extensionPath,
      workspaceFolders: this.workspaceFolders?.map((folder) => folder.uri.fsPath),
    });
  }

  private compilerCommand(): DclCompilerCommand {
    const configured = (this.options.compilerPath ?? vscode.workspace.getConfiguration("dcl").get<string>("compilerPath", "")).trim();
    if (configured.length === 0 && this.options.compilerPath !== undefined && this.options.compilerPath.trim() === "") {
      throw new DclCompilerError("dcl.compilerPath is empty. Configure a DCL compiler path or leave the setting unset.");
    }
    return resolveDclCompiler({
      configuredCompilerPath: configured,
      extensionPath: this.options.extensionPath,
      workspaceFolders: this.workspaceFolders?.map((folder) => folder.uri.fsPath),
    });
  }

  private workspaceRoot(): string | undefined {
    return this.workspaceFolders?.[0]?.uri.fsPath;
  }
}

function ensureExecutable(spec: DclCompilerCommand): void {
  if (spec.source !== "bundled" || process.platform === "win32") return;
  try {
    fs.chmodSync(spec.command, 0o755);
  } catch {
    // Let execFile surface the actionable failure with the attempted path.
  }
}

function compilerMissingMessage(spec: DclCompilerCommand): string {
  if (spec.source === "path") {
    const bundleDetail = spec.supportedBundleName
      ? `Expected bundled compiler: ${spec.bundledPath ?? spec.supportedBundleName}\nBundled compiler available: ${spec.bundledAvailable ? "yes" : "no"}`
      : `Bundled DCL compiler is not available for this platform.\nPlatform: ${spec.platform}\nArchitecture: ${spec.arch}`;
    return `DCL compiler was not found.\nCompiler: ${spec.command}\nSource: PATH\n${bundleDetail}\nSet dcl.compilerPath or install a VSIX that includes a bundled compiler for this platform.`;
  }
  return `DCL compiler was not found.\nCompiler: ${spec.command}\nSource: ${spec.source}`;
}

function compilerRunMessage(prefix: string, spec: DclCompilerCommand, run: DclCompilerRunResult, detail?: string): string {
  return [
    prefix,
    `Compiler: ${spec.command}`,
    spec.args.length ? `Compiler arguments: ${spec.args.join(" ")}` : undefined,
    `Source: ${spec.source}`,
    `Exit code: ${run.exitCode ?? "unknown"}`,
    run.stderr.trim() ? `stderr: ${run.stderr.trim()}` : undefined,
    !run.stderr.trim() && run.stdout.trim() ? `stdout: ${run.stdout.trim()}` : undefined,
    detail && detail !== run.stderr.trim() && detail !== run.stdout.trim() ? `Details: ${detail}` : undefined,
  ].filter(Boolean).join("\n");
}

export function diagnosticsFromIr(ir: unknown): DclDiagnostic[] {
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

export function parseHumanDiagnostics(output: string): DclDiagnostic[] {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
