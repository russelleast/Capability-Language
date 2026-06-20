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
exports.resolveDclLsp = resolveDclLsp;
exports.splitCommand = splitCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function resolveDclLsp(options) {
    const platform = options.platform ?? process.platform;
    const existsSync = options.existsSync ?? fs.existsSync;
    const configured = (options.configuredPath ?? "").trim();
    const bundledName = platform === "win32" ? "dcl-lsp.exe" : "dcl-lsp";
    const bundledPath = options.extensionPath ? path.join(options.extensionPath, "bin", bundledName) : undefined;
    const bundledAvailable = Boolean(bundledPath && existsSync(bundledPath));
    const cwd = options.workspaceFolders?.[0];
    if (configured) {
        const [command, ...args] = splitCommand(configured);
        return { command: command || configured, args, cwd, source: "configured", bundledPath, bundledAvailable };
    }
    if (bundledPath && bundledAvailable) {
        return { command: bundledPath, args: [], cwd, source: "bundled", bundledPath, bundledAvailable };
    }
    return { command: "dcl-lsp", args: [], cwd, source: "path", bundledPath, bundledAvailable };
}
function splitCommand(commandLine) {
    const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
    return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}
//# sourceMappingURL=DclLspResolver.js.map