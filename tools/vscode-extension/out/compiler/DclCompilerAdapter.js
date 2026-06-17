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
exports.DclCompilerAdapter = exports.DclCompilerError = void 0;
const childProcess = __importStar(require("child_process"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class DclCompilerError extends Error {
    constructor(message, stdout = "", stderr = "") {
        super(message);
        this.stdout = stdout;
        this.stderr = stderr;
    }
}
exports.DclCompilerError = DclCompilerError;
class DclCompilerAdapter {
    constructor(workspaceFolders) {
        this.workspaceFolders = workspaceFolders;
    }
    async compileFiles(files) {
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
    async formatFile(file) {
        const run = await this.runCompiler(["format", file.fsPath]);
        if (run.exitCode === 0) {
            return run.stdout;
        }
        const detail = (run.stderr || run.stdout).trim();
        throw new DclCompilerError(detail
            ? `DCL formatter failed: ${detail}`
            : "DCL formatter is not available from the configured compiler.", run.stdout, run.stderr);
    }
    runCompiler(args) {
        const spec = this.compilerCommand();
        return new Promise((resolve, reject) => {
            const child = childProcess.execFile(spec.command, [...spec.args, ...args], { cwd: spec.cwd }, (error, stdout, stderr) => {
                const exitCode = typeof error?.code === "number"
                    ? error.code
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
    compilerCommand() {
        const configured = vscode.workspace.getConfiguration("dcl").get("compilerPath", "").trim();
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
    defaultCompilerRoot() {
        for (const folder of this.workspaceFolders ?? []) {
            const candidate = path.join(folder.uri.fsPath, "compiler");
            try {
                const stat = require("fs").statSync(path.join(candidate, "cmd", "dcl", "main.go"));
                if (stat.isFile())
                    return candidate;
            }
            catch {
                // Keep looking; absence just means this is not the source workspace.
            }
        }
        return undefined;
    }
    workspaceRoot() {
        return this.workspaceFolders?.[0]?.uri.fsPath;
    }
}
exports.DclCompilerAdapter = DclCompilerAdapter;
function diagnosticsFromIr(ir) {
    if (!isRecord(ir) || !Array.isArray(ir.diagnostics))
        return [];
    return ir.diagnostics.flatMap((item) => normalizeDiagnostic(item));
}
function normalizeDiagnostic(item) {
    if (!isRecord(item))
        return [];
    const severity = item.severity === "error" || item.severity === "warning" || item.severity === "info" ? item.severity : "info";
    const message = typeof item.message === "string" ? item.message : undefined;
    if (!message)
        return [];
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
function parseHumanDiagnostics(output) {
    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
        const match = /^(.*?)(?::(\d+):(\d+))?\s+(error|warning|info)\s+([A-Z0-9_]+):\s+(.*?)(?:\s+\(([^)]+)\))?$/.exec(line);
        if (!match)
            return [];
        const [, file, lineNumber, column, severity, code, message, node] = match;
        return [{
                code,
                severity: severity,
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
function parseJson(output) {
    try {
        return JSON.parse(output);
    }
    catch {
        return undefined;
    }
}
function splitCommand(commandLine) {
    const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
    return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object";
}
//# sourceMappingURL=DclCompilerAdapter.js.map