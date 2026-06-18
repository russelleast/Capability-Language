import * as vscode from "vscode";
import { DclCompilerAdapter, DclCompilerError } from "../compiler/DclCompilerAdapter";

export class DclFormattingProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly compiler: DclCompilerAdapter) {}

  async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    try {
      const formatted = await this.compiler.formatFile(document.uri);
      if (formatted === document.getText()) return [];
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      );
      return [vscode.TextEdit.replace(fullRange, formatted)];
    } catch (error) {
      const message = error instanceof DclCompilerError ? error.message : String(error);
      void vscode.window.showWarningMessage(message);
      return [];
    }
  }
}
