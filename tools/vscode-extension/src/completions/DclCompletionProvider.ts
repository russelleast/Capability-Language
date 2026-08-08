import * as vscode from "vscode";

const DCL_10_TYPES = ["Text", "Boolean", "Number", "Date", "DateTime", "Uuid", "Email", "Money", "List<T>"];
const DCL_11_TYPES = [...DCL_10_TYPES, "Integer"];

export function authoredLanguageVersion(text: string): string {
  return /^\s*language\s+dcl\s+(\d+\.\d+)\b/m.exec(text)?.[1] ?? "1.1";
}

export function completionLabels(text: string): string[] {
  const labels = authoredLanguageVersion(text) === "1.0" ? [...DCL_10_TYPES] : [...DCL_11_TYPES];
  if (authoredLanguageVersion(text) === "1.1") labels.push("measure", "shape-enum");
  return labels;
}

export class DclCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument): vscode.CompletionItem[] {
    return completionLabels(document.getText()).map((label) => {
      const item = new vscode.CompletionItem(
        label,
        label === "measure" || label === "shape-enum" ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.TypeParameter,
      );
      if (label === "measure") {
        item.insertText = new vscode.SnippetString("measure ${1:Quantity}");
        item.documentation = new vscode.MarkdownString("Declares a measured numeric unit. Since DCL 1.1.");
      } else if (label === "shape-enum") {
        item.insertText = new vscode.SnippetString("shape ${1:Result} enum {\n  ${2:Success}\n  ${3:Failed} is ${4:Failure}\n}");
        item.documentation = new vscode.MarkdownString("Declares an enum shape with optional typed cases. Since DCL 1.1.");
      } else {
        item.insertText = label;
        item.detail = "DCL built-in type";
      }
      return item;
    });
  }
}

