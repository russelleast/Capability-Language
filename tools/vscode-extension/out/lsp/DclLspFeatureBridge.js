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
exports.DclLspFeatureBridge = void 0;
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const DclLspResolver_1 = require("./DclLspResolver");
const DCL_SELECTOR = { language: "dcl", scheme: "file" };
class DclLspFeatureBridge {
    constructor(extensionPath) {
        this.extensionPath = extensionPath;
        this.disposables = [];
        this.status = {
            diagnostics: { supported: true },
            documentSymbols: { supported: true },
            workspaceSymbols: { supported: true },
            definitions: { supported: true },
            references: { supported: true },
        };
        this.output = vscode.window.createOutputChannel("DCL Language Server");
        this.disposables.push(this.output);
    }
    register() {
        this.disposables.push(vscode.languages.registerDocumentSymbolProvider(DCL_SELECTOR, {
            provideDocumentSymbols: async (document) => {
                const symbols = await this.request("textDocument/documentSymbol", { textDocument: { uri: document.uri.toString() } }, document);
                this.record("documentSymbols", document.uri.toString(), symbols?.length ?? 0);
                return (symbols ?? []).map(toDocumentSymbol);
            },
        }), vscode.languages.registerWorkspaceSymbolProvider({
            provideWorkspaceSymbols: async (query) => {
                const symbols = await this.request("workspace/symbol", { query });
                this.record("workspaceSymbols", query || "(empty query)", symbols?.length ?? 0);
                return (symbols ?? []).flatMap(toSymbolInformation);
            },
        }), vscode.languages.registerDefinitionProvider(DCL_SELECTOR, {
            provideDefinition: async (document, position) => {
                const location = await this.request("textDocument/definition", {
                    textDocument: { uri: document.uri.toString() },
                    position: toLspPosition(position),
                }, document);
                const locations = Array.isArray(location) ? location : location ? [location] : [];
                this.record("definitions", `${document.uri.toString()}:${position.line}:${position.character}`, locations.length);
                return locations.map(toLocation);
            },
        }), vscode.languages.registerReferenceProvider(DCL_SELECTOR, {
            provideReferences: async (document, position, context) => {
                const locations = await this.request("textDocument/references", {
                    textDocument: { uri: document.uri.toString() },
                    position: toLspPosition(position),
                    context: { includeDeclaration: context.includeDeclaration },
                }, document);
                this.record("references", `${document.uri.toString()}:${position.line}:${position.character}`, locations?.length ?? 0);
                return (locations ?? []).map(toLocation);
            },
        }));
    }
    featureStatus() {
        const lines = [
            "DCL Language Server feature status:",
            `Diagnostics enabled: ${yesNo(this.status.diagnostics.supported)} (extension diagnostics remain the fallback in this build)`,
            `Document symbols supported: ${yesNo(this.status.documentSymbols.supported)}`,
            `Workspace symbols supported: ${yesNo(this.status.workspaceSymbols.supported)}`,
            `Definitions supported: ${yesNo(this.status.definitions.supported)}`,
            `References supported: ${yesNo(this.status.references.supported)}`,
            "",
            featureLine("Document symbols", this.status.documentSymbols),
            featureLine("Workspace symbols", this.status.workspaceSymbols),
            featureLine("Definitions", this.status.definitions),
            featureLine("References", this.status.references),
        ];
        return lines.join("\n");
    }
    dispose() {
        for (const disposable of this.disposables.splice(0))
            disposable.dispose();
    }
    record(feature, request, count, reason = "") {
        this.status[feature] = {
            ...this.status[feature],
            lastRequest: request,
            lastResultCount: count,
            lastReason: count === 0 ? reason || "no results returned" : "",
        };
    }
    async request(method, params, document) {
        const config = vscode.workspace.getConfiguration("dcl.languageServer");
        const trace = config.get("trace", "off");
        const spec = (0, DclLspResolver_1.resolveDclLsp)({
            configuredPath: config.get("path", ""),
            extensionPath: this.extensionPath,
            workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath),
        });
        ensureExecutable(spec);
        this.output.appendLine(`DCL LSP request: ${method}`);
        this.output.appendLine(`Starting DCL language server: ${spec.command}${spec.args.length ? ` ${spec.args.join(" ")}` : ""}`);
        this.output.appendLine(`Server source: ${spec.source}`);
        if (trace !== "off")
            this.output.appendLine(`LSP params: ${JSON.stringify(params)}`);
        try {
            const result = await sendRequest(spec, method, params, document, trace, this.output);
            this.output.appendLine(`DCL LSP ${method} completed.`);
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`DCL language server error: ${message}`);
            if (/ENOENT/i.test(message)) {
                this.output.appendLine("Build dcl-lsp or set dcl.languageServer.path.");
            }
            void vscode.window.showWarningMessage(`DCL language server request failed: ${message}`);
            return undefined;
        }
    }
}
exports.DclLspFeatureBridge = DclLspFeatureBridge;
function sendRequest(spec, method, params, document, trace, output) {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn(spec.command, spec.args, { cwd: spec.cwd, stdio: "pipe" });
        const parser = new LspMessageParser();
        let settled = false;
        let nextID = 1;
        const initializeID = nextID++;
        const requestID = nextID++;
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill();
                reject(new Error(`${method} timed out`));
            }
        }, 10000);
        child.on("error", (error) => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(error);
            }
        });
        child.stderr.on("data", (chunk) => {
            for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
                output.appendLine(formatServerLog(line));
            }
        });
        child.stdout.on("data", (chunk) => {
            for (const payload of parser.push(chunk)) {
                if (trace !== "off")
                    output.appendLine(`LSP response: ${payload}`);
                const message = JSON.parse(payload);
                if (message.id !== requestID)
                    continue;
                if (settled)
                    return;
                settled = true;
                clearTimeout(timeout);
                child.stdin.write(frame({ jsonrpc: "2.0", id: nextID++, method: "shutdown" }));
                child.stdin.write(frame({ jsonrpc: "2.0", method: "exit" }));
                child.stdin.end();
                if (message.error) {
                    reject(new Error(message.error.message ?? `${method} failed`));
                }
                else {
                    resolve(message.result);
                }
            }
        });
        child.on("exit", (code) => {
            if (!settled && code !== 0) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(`dcl-lsp exited with code ${code ?? "unknown"}`));
            }
        });
        child.stdin.write(frame({ jsonrpc: "2.0", id: initializeID, method: "initialize", params: initializeParams() }));
        child.stdin.write(frame({ jsonrpc: "2.0", method: "initialized", params: {} }));
        if (document) {
            child.stdin.write(frame({
                jsonrpc: "2.0",
                method: "textDocument/didOpen",
                params: {
                    textDocument: {
                        uri: document.uri.toString(),
                        languageId: "dcl",
                        version: document.version,
                        text: document.getText(),
                    },
                },
            }));
        }
        child.stdin.write(frame({ jsonrpc: "2.0", id: requestID, method, params }));
    });
}
function initializeParams() {
    const workspaceFolders = vscode.workspace.workspaceFolders?.map((folder) => ({
        uri: folder.uri.toString(),
        name: folder.name,
    })) ?? [];
    return {
        processId: process.pid,
        rootUri: workspaceFolders[0]?.uri ?? null,
        workspaceFolders,
        capabilities: {},
    };
}
function ensureExecutable(spec) {
    if (spec.source !== "bundled" || process.platform === "win32")
        return;
    try {
        fs.chmodSync(spec.command, 0o755);
    }
    catch {
        // Let spawn surface the actionable failure with the attempted path.
    }
}
function frame(message) {
    const payload = JSON.stringify(message);
    return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
}
function toDocumentSymbol(symbol) {
    const item = new vscode.DocumentSymbol(symbol.name, symbol.detail ?? "", symbol.kind, toRange(symbol.range), toRange(symbol.selectionRange));
    item.children = (symbol.children ?? []).map(toDocumentSymbol);
    return item;
}
function toSymbolInformation(symbol) {
    if (!symbol.location)
        return [];
    return [new vscode.SymbolInformation(symbol.name, symbol.kind, symbol.containerName ?? "", toLocation(symbol.location))];
}
function toLocation(location) {
    return new vscode.Location(vscode.Uri.parse(location.uri), toRange(location.range));
}
function toRange(range) {
    return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}
function toLspPosition(position) {
    return { line: position.line, character: position.character };
}
function yesNo(value) {
    return value ? "yes" : "no";
}
function featureLine(label, telemetry) {
    return `${label}: last request ${telemetry.lastRequest ?? "(none)"}, last result count ${telemetry.lastResultCount ?? "(none)"}${telemetry.lastReason ? `, reason: ${telemetry.lastReason}` : ""}`;
}
function formatServerLog(line) {
    try {
        const event = JSON.parse(line);
        const name = typeof event.event === "string" ? event.event : "server log";
        const resultCount = typeof event.resultCount === "number" ? `, result count ${event.resultCount}` : "";
        const reason = typeof event.reason === "string" && event.reason ? `, reason: ${event.reason}` : "";
        const zeroReason = typeof event.zeroReason === "string" && event.zeroReason ? `, reason: ${event.zeroReason}` : "";
        const uri = typeof event.uri === "string" ? `, ${event.uri}` : "";
        const query = typeof event.query === "string" ? `, query "${event.query}"` : "";
        return `Server: ${name}${uri}${query}${resultCount}${reason || zeroReason}`;
    }
    catch {
        return `Server: ${line}`;
    }
}
class LspMessageParser {
    constructor() {
        this.buffer = Buffer.alloc(0);
    }
    push(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const messages = [];
        for (;;) {
            const headerEnd = this.buffer.indexOf("\r\n\r\n");
            if (headerEnd < 0)
                return messages;
            const header = this.buffer.subarray(0, headerEnd).toString("utf8");
            const match = /Content-Length:\s*(\d+)/i.exec(header);
            if (!match) {
                this.buffer = Buffer.alloc(0);
                return messages;
            }
            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (this.buffer.length < bodyStart + length)
                return messages;
            messages.push(this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8"));
            this.buffer = this.buffer.subarray(bodyStart + length);
        }
    }
}
//# sourceMappingURL=DclLspFeatureBridge.js.map