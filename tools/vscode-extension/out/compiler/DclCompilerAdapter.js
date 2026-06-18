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
exports.diagnosticsFromIr = diagnosticsFromIr;
exports.parseHumanDiagnostics = parseHumanDiagnostics;
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const DclCompilerResolver_1 = require("./DclCompilerResolver");
class DclCompilerError extends Error {
    constructor(message, stdout = "", stderr = "", compilerPath, exitCode) {
        super(message);
        this.stdout = stdout;
        this.stderr = stderr;
        this.compilerPath = compilerPath;
        this.exitCode = exitCode;
    }
}
exports.DclCompilerError = DclCompilerError;
class DclCompilerAdapter {
    constructor(workspaceFolders, options = {}) {
        this.workspaceFolders = workspaceFolders;
        this.options = options;
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
        if (irRun.exitCode === 0) {
            throw new DclCompilerError(compilerRunMessage("DCL compiler returned invalid JSON", this.compilerCommand(), irRun), irRun.stdout, irRun.stderr, this.compilerCommand().command, irRun.exitCode);
        }
        const diagnostics = parseHumanDiagnostics(`${irRun.stderr}\n${irRun.stdout}`);
        if (diagnostics.length === 0) {
            const detail = (irRun.stderr || irRun.stdout).trim();
            throw new DclCompilerError(compilerRunMessage("DCL compiler failed before producing diagnostics", this.compilerCommand(), irRun, detail), irRun.stdout, irRun.stderr, this.compilerCommand().command, irRun.exitCode);
        }
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
            ? compilerRunMessage("DCL formatter failed", this.compilerCommand(), run, detail)
            : compilerRunMessage("DCL formatter failed before producing output", this.compilerCommand(), run), run.stdout, run.stderr, this.compilerCommand().command, run.exitCode);
    }
    runCompiler(args) {
        const spec = this.compilerCommand();
        if (this.options.runner) {
            return this.options.runner(spec, args);
        }
        ensureExecutable(spec);
        return new Promise((resolve, reject) => {
            const child = childProcess.execFile(spec.command, [...spec.args, ...args], { cwd: spec.cwd }, (error, stdout, stderr) => {
                const execError = error;
                if (execError?.code === "ENOENT") {
                    reject(new DclCompilerError(compilerMissingMessage(spec), stdout, stderr, spec.command, null));
                    return;
                }
                const exitCode = typeof execError?.code === "number"
                    ? execError.code
                    : error
                        ? 1
                        : 0;
                resolve({ exitCode, stdout, stderr });
            });
            child.on("error", (error) => {
                reject(new DclCompilerError(`DCL compiler was not found or could not be started.\nCompiler: ${spec.command}\nSource: ${spec.source}\nError: ${error.message}`, "", "", spec.command, null));
            });
        });
    }
    compilerInfo() {
        return (0, DclCompilerResolver_1.getDclCompilerInfo)({
            configuredCompilerPath: this.options.compilerPath ?? vscode.workspace.getConfiguration("dcl").get("compilerPath", ""),
            extensionPath: this.options.extensionPath,
            workspaceFolders: this.workspaceFolders?.map((folder) => folder.uri.fsPath),
        });
    }
    compilerCommand() {
        const configured = (this.options.compilerPath ?? vscode.workspace.getConfiguration("dcl").get("compilerPath", "")).trim();
        if (configured.length === 0 && this.options.compilerPath !== undefined && this.options.compilerPath.trim() === "") {
            throw new DclCompilerError("dcl.compilerPath is empty. Configure a DCL compiler path or leave the setting unset.");
        }
        return (0, DclCompilerResolver_1.resolveDclCompiler)({
            configuredCompilerPath: configured,
            extensionPath: this.options.extensionPath,
            workspaceFolders: this.workspaceFolders?.map((folder) => folder.uri.fsPath),
        });
    }
    workspaceRoot() {
        return this.workspaceFolders?.[0]?.uri.fsPath;
    }
}
exports.DclCompilerAdapter = DclCompilerAdapter;
function ensureExecutable(spec) {
    if (spec.source !== "bundled" || process.platform === "win32")
        return;
    try {
        fs.chmodSync(spec.command, 0o755);
    }
    catch {
        // Let execFile surface the actionable failure with the attempted path.
    }
}
function compilerMissingMessage(spec) {
    if (spec.source === "path") {
        const bundleDetail = spec.supportedBundleName
            ? `Expected bundled compiler: ${spec.bundledPath ?? spec.supportedBundleName}\nBundled compiler available: ${spec.bundledAvailable ? "yes" : "no"}`
            : `Bundled DCL compiler is not available for this platform.\nPlatform: ${spec.platform}\nArchitecture: ${spec.arch}`;
        return `DCL compiler was not found.\nCompiler: ${spec.command}\nSource: PATH\n${bundleDetail}\nSet dcl.compilerPath or install a VSIX that includes a bundled compiler for this platform.`;
    }
    return `DCL compiler was not found.\nCompiler: ${spec.command}\nSource: ${spec.source}`;
}
function compilerRunMessage(prefix, spec, run, detail) {
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
function isRecord(value) {
    return Boolean(value) && typeof value === "object";
}
//# sourceMappingURL=DclCompilerAdapter.js.map