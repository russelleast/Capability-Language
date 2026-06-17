import * as vscode from "vscode";
import { DclCompilerAdapter, DclCompilerError } from "./compiler/DclCompilerAdapter";
import { DclDiagnosticProvider } from "./diagnostics/DclDiagnosticProvider";
import { DclFormattingProvider } from "./formatting/DclFormattingProvider";
import { DclHoverProvider } from "./hovers/DclHoverProvider";
import { DclSummaryProvider } from "./views/DclSummaryProvider";

const DCL_SELECTOR: vscode.DocumentSelector = { language: "dcl", scheme: "file" };

export function activate(context: vscode.ExtensionContext): void {
  const compiler = new DclCompilerAdapter(vscode.workspace.workspaceFolders);
  const diagnostics = new DclDiagnosticProvider(compiler);
  const summary = new DclSummaryProvider();

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerHoverProvider(DCL_SELECTOR, new DclHoverProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(DCL_SELECTOR, new DclFormattingProvider(compiler)),
    vscode.window.registerTreeDataProvider("dclSemanticSummary", summary),
    vscode.commands.registerCommand("dcl.compileCurrentFile", () => compileCurrentFile(diagnostics, summary, false)),
    vscode.commands.registerCommand("dcl.compileWorkspace", () => compileWorkspace(diagnostics, summary)),
    vscode.commands.registerCommand("dcl.showSemanticSummary", () => compileCurrentFile(diagnostics, summary, true)),
    vscode.commands.registerCommand("dcl.formatDocument", () => vscode.commands.executeCommand("editor.action.formatDocument")),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const compileOnSave = vscode.workspace.getConfiguration("dcl").get<boolean>("compileOnSave", true);
      if (compileOnSave && document.languageId === "dcl" && document.uri.scheme === "file") {
        void compileFiles([document.uri], diagnostics, summary, false, false);
      }
    }),
  );
}

export function deactivate(): void {}

async function compileCurrentFile(
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  revealSummary: boolean,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "dcl") {
    void vscode.window.showWarningMessage("Open a .dcl file before running this DCL command.");
    return;
  }

  await editor.document.save();
  await compileFiles([editor.document.uri], diagnostics, summary, revealSummary, true);
}

async function compileWorkspace(diagnostics: DclDiagnosticProvider, summary: DclSummaryProvider): Promise<void> {
  const files = await vscode.workspace.findFiles("**/*.dcl", "**/{node_modules,.git}/**");
  if (files.length === 0) {
    void vscode.window.showInformationMessage("No .dcl files found in this workspace.");
    return;
  }

  await compileFiles(files, diagnostics, summary, false, true);
}

async function compileFiles(
  files: vscode.Uri[],
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  revealSummary: boolean,
  showStatus: boolean,
): Promise<void> {
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: files.length === 1 ? "Compiling DCL file" : `Compiling ${files.length} DCL files`,
      },
      () => diagnostics.compileFiles(files),
    );

    if (result.ir) {
      summary.refresh(result.ir);
    } else {
      summary.clear();
    }

    if (revealSummary) {
      await vscode.commands.executeCommand("dclSemanticSummary.focus");
    }

    if (showStatus) {
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
      const message = result.ok
        ? `DCL compile completed: ${warnings} warning${warnings === 1 ? "" : "s"}.`
        : `DCL compile failed: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`;
      void vscode.window.showInformationMessage(message);
    }
  } catch (error) {
    const message = error instanceof DclCompilerError ? error.message : String(error);
    void vscode.window.showErrorMessage(message);
  }
}
