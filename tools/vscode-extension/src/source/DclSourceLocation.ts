import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export type DclSourceIndexBase = "oneBased" | "zeroBased";

export type DclSourceLocation = {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  indexBase?: DclSourceIndexBase;
};

export type NormalizedSourceLocation = {
  file: string;
  line: number;
  column: number;
};

export type NormalizeSourceLocationResult =
  | { ok: true; location: NormalizedSourceLocation }
  | { ok: false; reason: string };

export type RevealSourceLocationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function normalizeSourceLocation(
  location: DclSourceLocation | undefined,
  indexBase: DclSourceIndexBase = "oneBased",
): NormalizeSourceLocationResult {
  if (!location) return { ok: false, reason: "No source location was provided." };
  if (!location.file || location.file.trim() === "") return { ok: false, reason: "The compiler did not provide a source file path." };
  if (!Number.isInteger(location.line)) return { ok: false, reason: "The compiler did not provide a valid source line." };

  const base = location.indexBase ?? indexBase;
  const rawLine = location.line as number;
  const rawColumn = Number.isInteger(location.column) ? (location.column as number) : base === "zeroBased" ? 0 : 1;
  const line = base === "zeroBased" ? rawLine : rawLine - 1;
  const column = base === "zeroBased" ? rawColumn : rawColumn - 1;

  if (line < 0) return { ok: false, reason: "The compiler source line is before the start of the file." };
  if (column < 0) return { ok: false, reason: "The compiler source column is before the start of the line." };

  return {
    ok: true,
    location: {
      file: location.file,
      line,
      column,
    },
  };
}

export async function revealSourceLocation(
  location: DclSourceLocation | undefined,
  indexBase: DclSourceIndexBase = "oneBased",
): Promise<RevealSourceLocationResult> {
  const normalized = normalizeSourceLocation(location, indexBase);
  if (!normalized.ok) return normalized;

  const uri = await resolveSourceUri(normalized.location.file);
  if (!uri) return { ok: false, reason: `Unable to locate DCL source file '${normalized.location.file}'.` };

  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(uri);
  } catch {
    return { ok: false, reason: `Unable to open DCL source file '${normalized.location.file}'.` };
  }

  if (normalized.location.line >= document.lineCount) {
    return {
      ok: false,
      reason: `Source line ${displayLine(normalized.location.line)} is outside '${path.basename(uri.fsPath)}'.`,
    };
  }

  const textLine = document.lineAt(normalized.location.line);
  if (normalized.location.column > textLine.range.end.character) {
    return {
      ok: false,
      reason: `Source column ${displayColumn(normalized.location.column)} is outside line ${displayLine(normalized.location.line)}.`,
    };
  }

  const editor = await vscode.window.showTextDocument(document, { preview: true });
  const endColumn = Math.min(normalized.location.column + 1, textLine.range.end.character);
  const range = new vscode.Range(normalized.location.line, normalized.location.column, normalized.location.line, endColumn);
  editor.selection = new vscode.Selection(range.start, range.end);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  return { ok: true };
}

async function resolveSourceUri(file: string): Promise<vscode.Uri | undefined> {
  if (path.isAbsolute(file)) {
    return fs.existsSync(file) ? vscode.Uri.file(file) : undefined;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const candidates = [
      vscode.Uri.joinPath(folder.uri, file),
      vscode.Uri.joinPath(folder.uri, "compiler", file),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate.fsPath)) return candidate;
    }
  }

  const basename = path.basename(file);
  const matches = await vscode.workspace.findFiles(`**/${basename}`, "**/{node_modules,.git}/**", 25);
  const comparable = comparableRelativePath(file);
  if (file === basename && matches.length === 1) return matches[0];
  if (file !== basename) {
    const exactMatch = matches.find((match) => {
      const matchPath = match.fsPath.replace(/\\/g, "/");
      return matchPath.endsWith(file.replace(/\\/g, "/")) || matchPath.endsWith(comparable);
    });
    if (exactMatch) return exactMatch;
  }
  return undefined;
}

function comparableRelativePath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
}

function displayLine(zeroBasedLine: number): number {
  return zeroBasedLine + 1;
}

function displayColumn(zeroBasedColumn: number): number {
  return zeroBasedColumn + 1;
}
