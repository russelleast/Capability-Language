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
exports.DclDiagnosticProvider = void 0;
exports.toVsCodeDiagnostic = toVsCodeDiagnostic;
exports.uriForDiagnostic = uriForDiagnostic;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class DclDiagnosticProvider {
    constructor(compiler) {
        this.compiler = compiler;
        this.collection = vscode.languages.createDiagnosticCollection("dcl");
    }
    async compileFiles(files) {
        const result = await this.compiler.compileFiles(files);
        this.publish(result, files);
        return result;
    }
    clear() {
        this.collection.clear();
    }
    dispose() {
        this.collection.dispose();
    }
    publish(result, files) {
        const grouped = new Map();
        const knownFiles = new Map(files.map((file) => [normalizePath(file.fsPath), file]));
        for (const diagnostic of result.diagnostics) {
            const uri = uriForDiagnostic(diagnostic, knownFiles, files);
            if (!uri)
                continue;
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
exports.DclDiagnosticProvider = DclDiagnosticProvider;
function toVsCodeDiagnostic(item) {
    const line = Math.max((item.span?.line ?? 1) - 1, 0);
    const column = Math.max((item.span?.column ?? 1) - 1, 0);
    const range = new vscode.Range(line, column, line, column + 1);
    const message = item.code ? `${item.code}: ${item.message}` : item.message;
    const diagnostic = new vscode.Diagnostic(range, message, severity(item.severity));
    diagnostic.code = item.code;
    diagnostic.source = "dcl";
    return diagnostic;
}
function severity(value) {
    switch (value) {
        case "error":
            return vscode.DiagnosticSeverity.Error;
        case "warning":
            return vscode.DiagnosticSeverity.Warning;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
}
function uriForDiagnostic(diagnostic, knownFiles, fallbackFiles) {
    const file = diagnostic.span?.file;
    if (!file)
        return fallbackFiles.length === 1 ? fallbackFiles[0] : undefined;
    const normalized = normalizePath(file);
    if (knownFiles.has(normalized))
        return knownFiles.get(normalized);
    if (path.isAbsolute(file))
        return vscode.Uri.file(file);
    const comparable = comparableRelativePath(file);
    const match = fallbackFiles.find((candidate) => {
        const candidatePath = candidate.fsPath.replace(/\\/g, "/");
        return candidatePath.endsWith(file.replace(/\\/g, "/")) || candidatePath.endsWith(comparable);
    });
    return match ?? vscode.Uri.file(file);
}
function normalizePath(file) {
    return path.resolve(file);
}
function comparableRelativePath(file) {
    return file.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
}
//# sourceMappingURL=DclDiagnosticProvider.js.map