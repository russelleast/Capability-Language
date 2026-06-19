"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSourceLocation = normalizeSourceLocation;
exports.revealSourceLocation = revealSourceLocation;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function normalizeSourceLocation(location, indexBase = "oneBased") {
    if (!location)
        return { ok: false, reason: "No source location was provided." };
    if (!location.file || location.file.trim() === "")
        return { ok: false, reason: "The compiler did not provide a source file path." };
    if (!Number.isInteger(location.line))
        return { ok: false, reason: "The compiler did not provide a valid source line." };
    const base = location.indexBase ?? indexBase;
    const rawLine = location.line;
    const rawColumn = Number.isInteger(location.column) ? location.column : base === "zeroBased" ? 0 : 1;
    const line = base === "zeroBased" ? rawLine : rawLine - 1;
    const column = base === "zeroBased" ? rawColumn : rawColumn - 1;
    if (line < 0)
        return { ok: false, reason: "The compiler source line is before the start of the file." };
    if (column < 0)
        return { ok: false, reason: "The compiler source column is before the start of the line." };
    return {
        ok: true,
        location: {
            file: location.file,
            line,
            column,
        },
    };
}
async function revealSourceLocation(location, indexBase = "oneBased") {
    const normalized = normalizeSourceLocation(location, indexBase);
    if (!normalized.ok)
        return normalized;
    const uri = await resolveSourceUri(normalized.location.file);
    if (!uri)
        return { ok: false, reason: `Unable to locate DCL source file '${normalized.location.file}'.` };
    let document;
    try {
        document = await vscode.workspace.openTextDocument(uri);
    }
    catch {
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
async function resolveSourceUri(file) {
    if (path.isAbsolute(file)) {
        return fs.existsSync(file) ? vscode.Uri.file(file) : undefined;
    }
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        const candidates = [
            vscode.Uri.joinPath(folder.uri, file),
            vscode.Uri.joinPath(folder.uri, "compiler", file),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate.fsPath))
                return candidate;
        }
    }
    const basename = path.basename(file);
    const matches = await vscode.workspace.findFiles(`**/${basename}`, "**/{node_modules,.git}/**", 25);
    const comparable = comparableRelativePath(file);
    if (file === basename && matches.length === 1)
        return matches[0];
    if (file !== basename) {
        const exactMatch = matches.find((match) => {
            const matchPath = match.fsPath.replace(/\\/g, "/");
            return matchPath.endsWith(file.replace(/\\/g, "/")) || matchPath.endsWith(comparable);
        });
        if (exactMatch)
            return exactMatch;
    }
    return undefined;
}
function comparableRelativePath(file) {
    return file.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
}
function displayLine(zeroBasedLine) {
    return zeroBasedLine + 1;
}
function displayColumn(zeroBasedColumn) {
    return zeroBasedColumn + 1;
}
//# sourceMappingURL=DclSourceLocation.js.map