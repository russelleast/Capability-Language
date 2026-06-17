import * as path from "path";
import * as vscode from "vscode";
import { CompileResult, DclCompilerAdapter, DclDiagnostic } from "../compiler/DclCompilerAdapter";

export class DclDiagnosticProvider implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("dcl");

  constructor(private readonly compiler: DclCompilerAdapter) {}

  async compileFiles(files: vscode.Uri[]): Promise<CompileResult> {
    const result = await this.compiler.compileFiles(files);
    this.publish(result, files);
    return result;
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }

  private publish(result: CompileResult, files: vscode.Uri[]): void {
    const grouped = new Map<string, vscode.Diagnostic[]>();
    const knownFiles = new Map(files.map((file) => [normalizePath(file.fsPath), file]));

    for (const diagnostic of result.diagnostics) {
      const uri = uriForDiagnostic(diagnostic, knownFiles, files);
      if (!uri) continue;
      const key = normalizePath(uri.fsPath);
      const items = grouped.get(key) ?? [];
      items.push(toVsCodeDiagnostic(diagnostic));
      grouped.set(key, items);
    }

    for (const file of files) {
      this.collection.set(file, grouped.get(normalizePath(file.fsPath)) ?? []);
    }

    for (const [file, diagnostics] of grouped) {
      if (!knownFiles.has(file)) {
        this.collection.set(vscode.Uri.file(file), diagnostics);
      }
    }
  }
}

function toVsCodeDiagnostic(item: DclDiagnostic): vscode.Diagnostic {
  const line = Math.max((item.span?.line ?? 1) - 1, 0);
  const column = Math.max((item.span?.column ?? 1) - 1, 0);
  const range = new vscode.Range(line, column, line, column + 1);
  const message = item.code ? `${item.code}: ${item.message}` : item.message;
  const diagnostic = new vscode.Diagnostic(range, message, severity(item.severity));
  diagnostic.code = item.code;
  diagnostic.source = "dcl";
  return diagnostic;
}

function severity(value: DclDiagnostic["severity"]): vscode.DiagnosticSeverity {
  switch (value) {
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

function uriForDiagnostic(diagnostic: DclDiagnostic, knownFiles: Map<string, vscode.Uri>, fallbackFiles: vscode.Uri[]): vscode.Uri | undefined {
  const file = diagnostic.span?.file;
  if (!file) return fallbackFiles.length === 1 ? fallbackFiles[0] : undefined;

  const normalized = normalizePath(file);
  if (knownFiles.has(normalized)) return knownFiles.get(normalized);
  if (path.isAbsolute(file)) return vscode.Uri.file(file);

  const match = fallbackFiles.find((candidate) => candidate.fsPath.endsWith(file));
  return match ?? vscode.Uri.file(file);
}

function normalizePath(file: string): string {
  return path.resolve(file);
}
